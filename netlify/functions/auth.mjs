import { guard } from './_errlog.mjs';
import { json, bad, requireArtist } from './_lib.mjs';
import { normEmail, validEmail, issueCode, checkCode, sendCode, signToken, verifyToken,
         signTicket, readTicket, readArtists, mutateArtists, createArtist,
         cleanSlug, RESERVED , revOf, artistBySlug, sendNotice, emailReady } from './_auth.mjs';
import { newSid, addSession, touchSession, readSessions, killSessions, killEverything,
         deviceLabel, note, readLog, makeRecovery, recoveryStatus, useRecovery,
         sidsFor, can } from './_session.mjs';
import { newChallenge, register as pkRegister, assert as pkAssert, listKeys as pkList,
         forget as pkForget, hasPasskey } from './_passkey.mjs';

/* Every response to an unauthenticated caller is deliberately identical whether
   or not the address is on the list — otherwise this becomes a way to find out
   which emails have artist accounts. */
const SENT = { ok: true, sent: true };

/* One place that opens a session, so the three sign-in doors cannot drift. The
   device label and the timezone are what the person will recognise in the list;
   the browser volunteers the zone, which is free and needs no IP handling at all. */
async function open(req, body, aid, email, rev) {
  const sid = newSid();
  const token = await signToken(email, rev, sid);
  await addSession(aid, {
    sid, email,
    label: deviceLabel(req.headers.get('user-agent'), body.standalone),
    tz: String(body.tz || '').slice(0, 40),
    at: Date.now(),
  }).catch(() => {});
  return token;
}

const main = async (req) => {
  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }
  const action = body.action;

  /* ---- who am I? ---- */
  if (action === 'me') {
    const me = await verifyToken(body.token);
    return json({ ok: true, signedIn: !!me, email: me ? me.email : null,
                  role: me ? (me.role || 'owner') : null,
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
    if (!emailReady())
      return bad('Email sign-in isn’t switched on yet.', 503);

    /* Byte-identical for every valid address, account or not. An earlier version
       returned `needName` only for unknown addresses, which turned this into a
       way to discover who has an account. Whether a name is needed is answered
       by `verify`, once they have proved they own the inbox. */
    const reg = await readArtists();
    const link = reg.byEmail[email];
    const code = await issueCode(email);
    if (!code) return json(SENT);                       // rate limited, silently
    const sent = await sendCode(email, code, link ? (reg.byId[link.artistId] || {}).name : '');
    if (!sent.ok) return bad('We couldn’t send that email right now. Please try again shortly.', 502);
    return json(SENT);
  }

  /* ---- redeem it ---- */
  if (action === 'verify') {
    const email = normEmail(body.email);
    const code = String(body.code || '').replace(/\D/g, '').slice(0, 6);
    if (!validEmail(email) || code.length !== 6) return bad('Check the code and try again');

    const got = await checkCode(email, code);
    if (!got.ok) return bad('Check the code and try again', 401);

    const reg = await readArtists();
    if (!reg.byEmail[email]) {
      // They own the inbox, so it is now safe to say there is no account here.
      return json({ ok: true, needName: true, ticket: await signTicket(email) });
    }
    const link = reg.byEmail[email];
    const artist = reg.byId[link.artistId];
    const token = await open(req, body, link.artistId, email, revOf(reg, link.artistId));
    note(link.artistId, 'signin', email);
    return json({ ok: true, token, email, artistId: link.artistId,
                  slug: artist.slug, name: artist.name || '', isNew: !!got.name });
  }

  /* ---- finish signing up: ticket + the name they want ---- */
  if (action === 'claim') {
    const email = await readTicket(body.ticket);
    if (!email) return bad('That took too long — ask for a new code', 401);
    const name = String(body.name || '').trim().slice(0, 60);
    if (!name) return bad('What should we call you?');

    const reg0 = await readArtists();
    if (!reg0.byEmail[email]) {
      const made = await createArtist({ email, name, slug: body.slug, ref: body.ref,
                                        src: body.src });
      if (!made.ok) return bad(made.error === 'already' ? 'That address already has a page'
                                                       : 'Couldn’t create that page', 409);
    }
    const reg = await readArtists();
    const link = reg.byEmail[email];
    const artist = reg.byId[link.artistId];
    const token = await open(req, body, link.artistId, email, revOf(reg, link.artistId));
    note(link.artistId, 'signin', email, 'new account');
    return json({ ok: true, token, email,
                  artistId: link.artistId, slug: artist.slug, name: artist.name, isNew: true });
  }

  /* ---- the recovery door: unauthenticated, and it must not become an oracle ---- */
  /* ---------- PASSKEYS ----------------------------------------------------
     Two doors here, and only the second one is public.

     `passkeyStart` / `passkeyFinish` ADD a key to an account somebody is already
     signed in to. A passkey can never create an account: the first proof of who
     you are is still an email you can receive, because that is also the thing
     that gets you back in when the phone is lost.

     `passkeySignInStart` / `passkeySignInFinish` are the fast door, keyed by the
     page's PUBLIC address the same way the recovery door is — and answering
     identically for an unknown page, so neither becomes a way to find out which
     pages exist (INVARIANT 9h).

     WHERE. The origin and the domain are taken from the request, never from the
     body: they are the anti-phishing property, and a client that gets to name its
     own origin has thrown it away. */
  const WHERE = () => { const u = new URL(req.url); return { origin: u.origin, rpId: u.hostname }; };

  if (action === 'passkeySignInStart') {
    const aid = await artistBySlug(String(body.slug || ''));
    /* An unknown page and a page with no passkey answer the same: a challenge and
       an empty list. The phone then finds nothing to offer and says so locally. */
    if (!aid || !(await hasPasskey(aid)))
      return json({ ok: true, challenge: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url'),
                    rpId: WHERE().rpId, keys: [] });
    return json({ ok: true, challenge: await newChallenge(aid, 'get'), rpId: WHERE().rpId,
                  keys: (await pkList(aid)).map((k) => k.id) });
  }

  if (action === 'passkeySignInFinish') {
    const aid = await artistBySlug(String(body.slug || ''));
    const nope = () => bad('That didn’t work — sign in with a code instead', 401);
    if (!aid) return nope();
    const r = await pkAssert(aid, body, WHERE());
    if (!r.ok) return nope();
    const reg = await readArtists();
    /* The OWNER's address, the same rule the recovery door uses — a passkey is
       registered by whoever is signed in, and today only the owner may add one. */
    const row = Object.entries(reg.byEmail)
      .find(([, v]) => v.artistId === aid && v.role !== 'member' && v.role !== 'crew');
    if (!row) return nope();
    const token = await open(req, body, aid, row[0], revOf(reg, aid));
    note(aid, 'signin.passkey', r.label || '');
    return json({ ok: true, token, artist: aid, slug: (reg.byId[aid] || {}).slug || '' });
  }

  if (action === 'recoverySignIn') {
    const aid = await artistBySlug(String(body.slug || ''));
    const given = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
    const { codeLocked, noteCodeFailure, clearCodeFailures } = await import('./_lib.mjs');
    /* An unknown page, a locked-out page and a wrong code all answer identically,
       for the same reason requireArtist's code door does (INVARIANT 9h). */
    const nope = () => bad('That code didn’t work', 401);
    if (!aid || given.length !== 8) return nope();
    if (await codeLocked(aid)) return nope();
    if (!(await useRecovery(aid, given))) { await noteCodeFailure(aid); return nope(); }
    await clearCodeFailures(aid);
    /* A recovery code means something went wrong. Everything else goes out — and
       then this device gets a fresh session, so the person who just proved
       themselves is not ejected by their own rescue. */
    await killEverything(aid);
    const reg = await readArtists();
    const artist = reg.byId[aid] || {};
    const owner = Object.entries(reg.byEmail).find(([, v]) => v.artistId === aid && v.role !== 'member' && v.role !== 'crew');
    const email = owner ? owner[0] : (Object.entries(reg.byEmail).find(([, v]) => v.artistId === aid) || [''])[0];
    if (!email) return nope();
    const token = await open(req, body, aid, email, revOf(reg, aid));
    note(aid, 'signin.recovery', email);
    /* Everyone on the account hears about it, because a recovery sign-in is
       exactly the event somebody would want to know about. */
    for (const [e] of Object.entries(reg.byEmail).filter(([, v]) => v.artistId === aid)) {
      sendNotice(e, 'A recovery code was used on your MySet page',
        [`Someone signed in to ${artist.name || 'your page'} using one of your recovery codes.`,
         'Every other device has been signed out.',
         'If that was you, nothing to do. If it wasn’t, use another recovery code to sign in and make a new set straight away.'],
        artist.name || '').catch(() => {});
    }
    const { left } = await recoveryStatus(aid);
    return json({ ok: true, token, email, artistId: aid, slug: artist.slug || '',
                  name: artist.name || '', left });
  }

  /* ---- signed in from here ---- */
  if (['list','add','remove','revokeAll','setSlug','sessions','sessionRevoke','signOut',
       'signOutOthers','recoveryStatus','recoveryMake','activity','emailChangeStart',
       'emailChangeFinish','roleSet',
       'passkeyList','passkeyStart','passkeyFinish','passkeyForget'].includes(action)) {
    const me = await requireArtist(req);
    if (!me) return bad('unauthorized', 401);
    const aid = me.aid, role = me.role || 'owner';

    /* THE MISSING CHECK. Every one of add / remove / revokeAll / setSlug ran on a
       bare "are you signed in", and `verifyToken` has always returned the role. So
       a member on a five-seat Pro page could delete the OWNER's sign-in address and
       take the account, or rename the public page address that is printed on every
       QR code on every table in the bar. Both are one POST. */
    const OWNER_ONLY = ['add','remove','revokeAll','setSlug','recoveryMake','emailChangeStart','emailChangeFinish','roleSet',
      /* A passkey signs the OWNER in (passkeySignInFinish opens the owner's
         session), so letting a band mate on a Pro seat add one would hand them the
         owner's account with a thumbprint. */
      'passkeyStart','passkeyFinish','passkeyList','passkeyForget'];
    if (OWNER_ONLY.includes(action) && role !== 'owner')
      return bad('Only the account owner can change this', 403);
    if (action === 'activity' && !can(role, 'audit')) return bad('Not for this sign-in', 403);

    /* The two places "last opened Settings" moves. Nothing calls `/auth me`, so
       putting the touch there would have meant a `seen` that never advanced and a
       row that quietly lied about it. At most one write an hour. */
    if ((action === 'sessions' || action === 'list') && me.sid) touchSession(aid, me.sid).catch(() => {});

    /* ---- passkeys on THIS account ---- */
    if (action === 'passkeyList')
      return json({ ok: true, keys: await pkList(aid), can: true });
    if (action === 'passkeyStart') {
      const { origin, rpId } = WHERE();
      return json({ ok: true, rpId, origin,
                    challenge: await newChallenge(aid, 'create'),
                    /* The user handle must be STABLE and must not be an email —
                       it is stored on the phone and shown in its passkey list, and
                       an email there would follow somebody around after they
                       changed it. The artist id is stable and means nothing
                       outside MySet. */
                    userId: Buffer.from(aid).toString('base64url'),
                    userName: (await readArtists()).byId[aid]?.slug || aid,
                    displayName: (await readArtists()).byId[aid]?.name || 'MySet',
                    have: (await pkList(aid)).map((k) => k.id) });
    }
    if (action === 'passkeyFinish') {
      const r = await pkRegister(aid, body, WHERE());
      if (!r.ok) return bad(r.error, 400);
      note(aid, 'passkey.add', me.email || 'code');
      return json({ ok: true, keys: await pkList(aid) });
    }
    if (action === 'passkeyForget') {
      const r = await pkForget(aid, String(body.id || ''));
      if (!r.ok) return bad(r.error, 404);
      note(aid, 'passkey.remove', me.email || 'code');
      return json({ ok: true, keys: await pkList(aid) });
    }

    /* ---- where you are signed in ---- */
    if (action === 'sessions') return json({ ok: true, ...(await readSessions(aid, me.sid)) });
    if (action === 'sessionRevoke') {
      const sid = String(body.sid || '').slice(0, 24);
      if (!sid) return bad('which one?');
      await killSessions(aid, [sid]);
      note(aid, 'session.revoke', me.email || 'code');
      return json({ ok: true, ...(await readSessions(aid, me.sid)) });
    }
    /* SIGNING OUT NOW SIGNS YOU OUT. It used to clear localStorage and nothing
       else, so a copy of the token kept working for the rest of its thirty days. */
    if (action === 'signOut') {
      if (me.sid) await killSessions(aid, [me.sid]);
      note(aid, 'signout', me.email || 'code');
      return json({ ok: true, sid: me.sid || null });
    }
    if (action === 'signOutOthers') {
      const { list } = await readSessions(aid, me.sid);
      const others = list.filter((x) => !x.current).map((x) => x.sid);
      if (others.length) await killSessions(aid, others);
      note(aid, 'session.revokeAll', me.email || 'code', `${others.length} device(s)`);
      return json({ ok: true, gone: others.length, ...(await readSessions(aid, me.sid)) });
    }
    if (action === 'activity') return json({ ok: true, list: await readLog(aid) });

    /* ---- recovery codes ---- */
    if (action === 'recoveryStatus') return json({ ok: true, ...(await recoveryStatus(aid)) });
    if (action === 'recoveryMake') {
      const codes = await makeRecovery(aid);
      note(aid, 'recovery.made', me.email || 'code');
      return json({ ok: true, codes });     // the one and only time they exist in plain
    }

    /* ---- changing your sign-in address ----
       Two proofs, never one: a code to the NEW address says the person owns the
       inbox they are moving to, and a code to the OLD one says they are the person
       moving. A live session is the credential in a passwordless system, so
       without the second proof anyone holding a stolen token could walk off with
       the account — and the payout hold below is there for the same reason. */
    if (action === 'emailChangeStart') {
      const to = normEmail(body.email);
      if (!validEmail(to)) return bad('That doesn’t look like an email address');
      if (!me.email) return bad('Sign in with your email first — this door needs an inbox to move.');
      if (to === me.email) return bad('That’s already your address');
      if (!emailReady()) return bad('Email sign-in isn’t switched on yet.', 503);
      const reg = await readArtists();
      const row = reg.byId[aid] || {};
      if (Date.now() - (Number(row.emailAt) || 0) < 24 * 3600e3)
        return bad('You changed this in the last day. For safety we allow one change a day.');
      /* Taken or not, the answer is the same sentence: whether an address already
         has a MySet account is not something this door gets to reveal. */
      if (reg.byEmail[to]) return bad('We couldn’t move your account to that address');
      const a = await issueCode(to, null, `c-${aid}`);
      const b = await issueCode(me.email, null, `o-${aid}`);
      if (!a || !b) return bad('Too many codes were requested. Try again in an hour.', 429);
      const [newSent, oldSent] = await Promise.all([
        sendCode(to, a, row.name || '', 'new sign-in address'),
        sendCode(me.email, b, row.name || '', 'moving your account'),
      ]);
      if (!newSent.ok || !oldSent.ok)
        return bad('We couldn’t send both emails right now. Please try again shortly.', 502);
      /* THE OLD INBOX IS TOLD AT REQUEST TIME, not at the end. If a stolen session
         is trying to walk off with the account, the owner hears about it while
         there is still something they can do. */
      sendNotice(me.email, 'Someone asked to move your MySet page',
        [`A request was made to change your sign-in address to ${to}.`,
         'Nothing moves until codes from BOTH addresses are entered.',
         'If this wasn’t you, sign out everywhere from Settings right now and don’t enter the code we just sent you.'],
        row.name || '').catch(() => {});
      note(aid, 'email.start', me.email, to);
      return json({ ok: true, sent: true });
    }
    if (action === 'emailChangeFinish') {
      const to = normEmail(body.email);
      const from = me.email;
      if (!validEmail(to) || !from) return bad('Start again from Settings');
      const newOk = await checkCode(to, String(body.newCode || '').replace(/\D/g, '').slice(0, 6), `c-${aid}`);
      if (!newOk.ok) return bad('Check the code we sent to the new address', 401);
      const proof = String(body.proof || '').trim();
      const viaCode = /^\d{6}$/.test(proof)
        ? (await checkCode(from, proof, `o-${aid}`)).ok
        : false;
      const viaRecovery = !viaCode && proof.length >= 8
        ? await useRecovery(aid, proof.toUpperCase().replace(/[^A-Z0-9]/g, ''))
        : false;
      if (!viaCode && !viaRecovery)
        return bad('Check the code we sent to your current address — or use a recovery code', 401);
      const kill = await sidsFor(aid, from);
      let moved = false, taken = false;
      await mutateArtists((r) => {
        const cur = r.byEmail[from];
        if (!cur || cur.artistId !== aid) return false;      // access changed mid-flight
        if (r.byEmail[to]) { taken = true; return false; }
        r.byEmail[to] = { ...cur };                          // the role travels with it
        delete r.byEmail[from];
        const row = r.byId[aid];
        if (row) { row.prevEmail = from; row.emailAt = Date.now(); }
        moved = true;
        return true;
      });
      if (taken) return bad('We couldn’t move your account to that address');
      if (!moved) return bad('Something changed while we were doing that — try again');
      /* Only the moved address's devices go. A bandmate signed in on their own
         address is left alone, because this might be happening at 11pm while they
         are running the screen. */
      await killSessions(aid, kill.filter((x) => x !== me.sid));
      const reg2 = await readArtists();
      const token = await open(req, body, aid, to, revOf(reg2, aid));
      if (me.sid) await killSessions(aid, [me.sid]);
      note(aid, 'email.done', to, from);
      const nm = (reg2.byId[aid] || {}).name || '';
      sendNotice(from, 'Your MySet sign-in address was changed',
        [`Your MySet page now signs in with ${to}.`,
         'This address can no longer get in.',
         'If you didn’t do this, reply to this email now.'], nm).catch(() => {});
      sendNotice(to, 'This is now your MySet sign-in address',
        [`You’ll get your sign-in codes here from now on.`,
         'The old address can no longer get in.'], nm).catch(() => {});
      return json({ ok: true, email: to, token });
    }

    /* ---- who runs this page ---- */
    if (action === 'roleSet') {
      const email = normEmail(body.email);
      const want = ['member', 'crew'].includes(body.role) ? body.role : null;
      if (!want) return bad('unknown role');
      if (email === me.email) return bad('You can’t change your own role');
      let hit = false;
      await mutateArtists((a) => {
        const cur = a.byEmail[email];
        if (!cur || cur.artistId !== aid || cur.role === 'owner') return false;
        cur.role = want; hit = true; return true;
      });
      if (!hit) return bad('That address isn’t on this page');
      note(aid, 'role.change', me.email || 'code', `${email} → ${want}`);
    }

    // an artist can only ever touch access to their OWN page
    if (action === 'add') {
      const email = normEmail(body.email);
      if (!validEmail(email)) return bad('That doesn’t look like an email address');
      const wantRole = ['member', 'crew'].includes(body.role) ? body.role : 'member';
      const { planForArtist } = await import('./_plan.mjs');
      const { limits } = await planForArtist(me.aid);
      const reg0 = await readArtists();
      const mine = Object.entries(reg0.byEmail).filter(([, v]) => v.artistId === me.aid);
      if (!mine.some(([e]) => e === email) && mine.length >= limits.seats)
        return bad(limits.seats === 1
          ? 'Your plan allows one sign-in. Pro allows five.'
          : `Your plan allows ${limits.seats} sign-ins.`, 402);
      let taken = false;
      await mutateArtists((a) => {
        const cur = a.byEmail[email];
        if (cur && cur.artistId !== me.aid) { taken = true; return false; }
        a.byEmail[email] = { artistId: me.aid, role: (cur && cur.role === 'owner') ? 'owner' : wantRole };
        return true;
      });
      /* One sentence for both outcomes. "That address already runs another page"
         told any signed-up stranger whether a given email has a MySet account,
         which is the fact INVARIANT 9h protects at the front door. */
      if (taken) return bad('We couldn’t add that address');
      note(me.aid, 'seat.add', me.email || 'code', email);
    }
    if (action === 'remove') {
      const email = normEmail(body.email);
      let refused = '';
      await mutateArtists((a) => {
        const mine = Object.entries(a.byEmail).filter(([, v]) => v.artistId === me.aid);
        /* NEVER LOCK THE PAGE OUT, and never let the owner's own row be removed
           from here — the venue side had the first guard and the artist side had
           neither, so removing the last address stranded the account for good. */
        if (mine.length <= 1) { refused = 'That’s the only way in — add another address first.'; return false; }
        const cur = a.byEmail[email];
        if (!cur || cur.artistId !== me.aid) return false;
        if (cur.role === 'owner' && email !== me.email) { refused = 'That’s the owner’s address.'; return false; }
        if (email === me.email) { refused = 'That’s your own address — use “change my sign-in address” instead.'; return false; }
        delete a.byEmail[email];
        return true;
      });
      if (refused) return bad(refused, 400);
      await killSessions(me.aid, await sidsFor(me.aid, email)).catch(() => {});
      note(me.aid, 'seat.remove', me.email || 'code', email);
    }
    if (action === 'revokeAll') {
      await killEverything(me.aid);
      note(me.aid, 'session.revokeAll', me.email || 'code', 'everything');
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
        if (old && old !== want) {
          delete a.bySlug[old];
          /* THE PRINTED QR CODE OUTLIVES THE RENAME. Every table tent, poster and
             Instagram bio still points at the old address, so it keeps resolving to
             this same page rather than 404ing the room mid-gig. It is not claimable
             by anyone else while it is here — pickSlug and setSlug both refuse a
             name already in bySlug. */
          a.oldSlug ||= {};
          a.oldSlug[old] = { aid: me.aid, at: Date.now() };
        }
        a.bySlug[want] = me.aid;
        if (a.byId[me.aid]) a.byId[me.aid].slug = want;
        return true;
      });
      if (clash) return bad('Someone already has that address');
      note(me.aid, 'slug.change', me.email || 'code', want);
    }

    const a = await readArtists();
    const mine = a.byId[me.aid] || {};
    const invited = Object.values(a.byId).filter((x) => x.referredBy === me.aid);
    /* Whether a studio code EXISTS, never the code itself. The Settings row has to
       say "on" or "not set" and had no way to know which. */
    const { getShow } = await import('./_lib.mjs');
    const codeSet = !!(await getShow(me.aid)).codeHash;
    return json({ ok: true, codeSet,
      artistId: me.aid, slug: mine.slug || '', name: mine.name || '', plan: mine.plan || 'free',
      role, invited: invited.length,
      invitedNames: invited.slice(0, 20).map((x) => x.name),
      emails: Object.entries(a.byEmail)
        .filter(([, v]) => v.artistId === me.aid)
        .map(([e, v]) => ({ email: e, role: v.role || 'owner', me: e === me.email })),
      emailReady: emailReady() });
  }

  return bad('unknown action');
};
export default guard('auth', main);
