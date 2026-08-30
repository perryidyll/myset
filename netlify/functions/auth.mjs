import { json, bad, requireArtist } from './_lib.mjs';
import { normEmail, validEmail, issueCode, checkCode, sendCode, signToken, verifyToken,
         readArtists, mutateArtists, createArtist, cleanSlug, RESERVED } from './_auth.mjs';

/* Every response to an unauthenticated caller is deliberately identical whether
   or not the address is on the list — otherwise this becomes a way to find out
   which emails have artist accounts. */
const SENT = { ok: true, sent: true };

export default async (req) => {
  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }
  const action = body.action;

  /* ---- who am I? ---- */
  if (action === 'me') {
    const me = await verifyToken(body.token);
    return json({ ok: true, signedIn: !!me, email: me ? me.email : null,
                  artistId: me ? me.artistId : null,
                  slug: me ? me.artist.slug : null,
                  name: me ? (me.artist.name || '') : null });
  }

  /* ---- send a code: the same door whether you have an account or not ----
     If we branched here, the difference in response would tell a stranger which
     emails already belong to an artist. So both paths send a code and say the
     same thing; `verify` is where a new account actually gets created. ---- */
  if (action === 'start' || action === 'request') {
    const email = normEmail(body.email);
    if (!validEmail(email)) return bad('That doesn’t look like an email address');
    if (!process.env.RESEND_API_KEY)
      return bad('Email sign-in isn’t switched on yet.', 503);

    const reg = await readArtists();
    const known = !!reg.byEmail[email];
    const name = String(body.name || '').trim().slice(0, 60);
    if (!known && !name) return json({ ...SENT, needName: true });

    const code = await issueCode(email, known ? null : name);
    if (!code) return json(SENT);                       // rate limited, silently
    await sendCode(email, code, known ? reg.byId[reg.byEmail[email].artistId].name : name);
    return json(SENT);
  }

  /* ---- redeem it ---- */
  if (action === 'verify') {
    const email = normEmail(body.email);
    const code = String(body.code || '').replace(/\D/g, '').slice(0, 6);
    if (!validEmail(email) || code.length !== 6) return bad('Check the code and try again');

    const got = await checkCode(email, code);
    if (!got.ok) return bad('Check the code and try again', 401);

    let reg = await readArtists();
    if (!reg.byEmail[email]) {
      // brand-new artist: the name came in with the code request
      if (!got.name) return bad('No account for that address yet', 401);
      const made = await createArtist({ email, name: got.name, slug: body.slug });
      if (!made.ok) return bad(made.error === 'already' ? 'Check the code and try again'
                                                       : 'Couldn’t create that page', 409);
      reg = await readArtists();
    }
    const link = reg.byEmail[email];
    const artist = reg.byId[link.artistId];
    const token = await signToken(email, reg.rev);
    return json({ ok: true, token, email, artistId: link.artistId,
                  slug: artist.slug, name: artist.name || '', isNew: !!got.name });
  }

  /* ---- managing who can sign in (artist-only) ---- */
  if (['list','add','remove','revokeAll','setSlug'].includes(action)) {
    const me = await requireArtist(req);
    if (!me) return bad('unauthorized', 401);

    // an artist can only ever touch access to their OWN page
    if (action === 'add') {
      const email = normEmail(body.email);
      if (!validEmail(email)) return bad('That doesn’t look like an email address');
      let taken = false;
      await mutateArtists((a) => {
        const cur = a.byEmail[email];
        if (cur && cur.artistId !== me.aid) { taken = true; return false; }
        a.byEmail[email] = { artistId: me.aid, role: 'member' };
        return true;
      });
      if (taken) return bad('That address already runs another page');
    }
    if (action === 'remove') {
      const email = normEmail(body.email);
      await mutateArtists((a) => {
        if (a.byEmail[email] && a.byEmail[email].artistId === me.aid) delete a.byEmail[email];
        return true;
      });
    }
    if (action === 'revokeAll') {
      await mutateArtists((a) => { a.rev = (a.rev || 1) + 1; return true; });
    }
    if (action === 'setSlug') {
      const want = cleanSlug(body.slug);
      if (want.length < 3) return bad('At least 3 letters or numbers');
      if (RESERVED.has(want)) return bad('That one’s reserved — try another');
      let clash = false;
      await mutateArtists((a) => {
        const owner = a.bySlug[want];
        if (owner && owner !== me.aid) { clash = true; return false; }
        const old = a.byId[me.aid] && a.byId[me.aid].slug;
        if (old && old !== want) delete a.bySlug[old];
        a.bySlug[want] = me.aid;
        if (a.byId[me.aid]) a.byId[me.aid].slug = want;
        return true;
      });
      if (clash) return bad('Someone already has that address');
    }

    const a = await readArtists();
    const mine = a.byId[me.aid] || {};
    return json({ ok: true,
      artistId: me.aid, slug: mine.slug || '', name: mine.name || '', plan: mine.plan || 'free',
      emails: Object.entries(a.byEmail)
        .filter(([, v]) => v.artistId === me.aid)
        .map(([e, v]) => ({ email: e, role: v.role || 'owner' })),
      emailReady: !!process.env.RESEND_API_KEY });
  }

  return bad('unknown action');
};
