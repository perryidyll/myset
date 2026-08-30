import { json, bad, checkAdmin } from './_lib.mjs';
import { normEmail, validEmail, issueCode, checkCode, sendCode,
         signToken, verifyToken, readArtists, mutateArtists } from './_auth.mjs';

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
                  name: me ? (me.artist.name || '') : null });
  }

  /* ---- send a code ---- */
  if (action === 'request') {
    const email = normEmail(body.email);
    if (!validEmail(email)) return bad('That doesn’t look like an email address');

    // "is email switched on" is a property of the SITE, so it must be answered
    // before we look at the address. Answering it after meant a listed address
    // got a different reply from an unlisted one — an oracle for finding out
    // which emails have artist accounts.
    if (!process.env.RESEND_API_KEY)
      return bad('Email sign-in isn’t switched on yet — use your studio code.', 503);

    const artists = await readArtists();
    const artist = artists.emails[email];
    if (!artist) return json(SENT);                     // silent no-op, on purpose

    const code = await issueCode(email);
    if (!code) return json(SENT);                       // rate limited, also silent

    await sendCode(email, code, artist.name);           // failures stay silent too
    return json(SENT);
  }

  /* ---- redeem it ---- */
  if (action === 'verify') {
    const email = normEmail(body.email);
    const code = String(body.code || '').replace(/\D/g, '').slice(0, 6);
    if (!validEmail(email) || code.length !== 6) return bad('Check the code and try again');

    const artists = await readArtists();
    if (!artists.emails[email]) return bad('Check the code and try again', 401);
    if (!(await checkCode(email, code))) return bad('Check the code and try again', 401);

    const token = await signToken(email, artists.rev);
    return json({ ok: true, token, email, name: artists.emails[email].name || '' });
  }

  /* ---- managing who can sign in (artist-only) ---- */
  if (action === 'list' || action === 'add' || action === 'remove' || action === 'revokeAll') {
    if (!(await checkAdmin(req))) return bad('unauthorized', 401);

    if (action === 'add') {
      const email = normEmail(body.email);
      if (!validEmail(email)) return bad('That doesn’t look like an email address');
      let full = false;
      await mutateArtists((a) => {
        if (Object.keys(a.emails).length >= 25 && !a.emails[email]) { full = true; return false; }
        a.emails[email] = { name: String(body.name || '').slice(0, 60),
                            addedAt: a.emails[email] ? a.emails[email].addedAt : Date.now() };
        return true;
      });
      if (full) return bad('That’s as many sign-ins as this show can hold');
    }
    if (action === 'remove') {
      const email = normEmail(body.email);
      await mutateArtists((a) => { delete a.emails[email]; return true; });
    }
    if (action === 'revokeAll') {
      await mutateArtists((a) => { a.rev = (a.rev || 1) + 1; return true; });
    }

    const a = await readArtists();
    return json({ ok: true,
      emails: Object.entries(a.emails).map(([e, v]) => ({ email: e, name: v.name || '', addedAt: v.addedAt })),
      emailReady: !!process.env.RESEND_API_KEY });
  }

  return bad('unknown action');
};
