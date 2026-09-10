import { json, bad } from './_lib.mjs';
import { normEmail, validEmail, issueCode, checkCode, sendCode, emailReady,
         signTicket, readTicket, cleanSlug } from './_auth.mjs';
import { readVenues, mutateVenues, createVenue, requireVenue, signVenueToken,
         verifyVenueToken, getVenueProfile, domainMatches , vRevOf } from './_venues.mjs';

/* Sign-in for VENUES. The same email-and-a-code flow as artists, in its own
   realm: separate registry, separate token tag, separate one-time-code key. The
   same address can run an artist page and a venue page without either one being
   able to reach the other. */

const REALM = 'v';
const SENT = { ok: true, sent: true };

/* One place that opens a venue session, so the two sign-in doors cannot drift.
   See the artist twin in auth.mjs and _session.mjs for why this exists at all. */
async function openV(req, body, vid, email, rev) {
  const { newSid, addSession, deviceLabel } = await import('./_session.mjs');
  const sid = newSid();
  const token = await signVenueToken(email, rev, sid);
  await addSession('v_' + vid, { sid, email,
    label: deviceLabel(req.headers.get('user-agent'), body.standalone),
    tz: String(body.tz || '').slice(0, 40), at: Date.now() }).catch(() => {});
  return token;
}

export default async (req) => {
  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }
  const action = body.action;

  if (action === 'me') {
    const me = await verifyVenueToken(body.token);
    return json({ ok: true, signedIn: !!me, email: me ? me.email : null,
                  venueId: me ? me.venueId : null,
                  slug: me ? me.venue.slug : null,
                  name: me ? (me.venue.name || '') : null });
  }

  /* Identical response for every valid address, account or not — same reason as
     the artist door (INVARIANT 15e). */
  if (action === 'start') {
    const email = normEmail(body.email);
    if (!validEmail(email)) return bad('That doesn’t look like an email address');
    if (!emailReady()) return bad('Email sign-in isn’t switched on yet.', 503);
    const reg = await readVenues();
    const link = reg.byEmail[email];
    const code = await issueCode(email, null, REALM);
    if (!code) return json(SENT);                                  // rate limited, silently
    const sent = await sendCode(email, code, link ? (reg.byId[link.venueId] || {}).name : '', 'Venue Studio');
    if (!sent.ok) return bad('We couldn’t send that email right now. Please try again shortly.', 502);
    return json(SENT);
  }

  if (action === 'verify') {
    const email = normEmail(body.email);
    const code = String(body.code || '').replace(/\D/g, '').slice(0, 6);
    if (!validEmail(email) || code.length !== 6) return bad('Check the code and try again');

    const got = await checkCode(email, code, REALM);
    if (!got.ok) return bad('Check the code and try again', 401);

    const reg = await readVenues();
    if (!reg.byEmail[email])
      return json({ ok: true, needName: true, ticket: await signTicket(email) });

    const link = reg.byEmail[email];
    const venue = reg.byId[link.venueId];
    return json({ ok: true, token: await openV(req, body, reg.byEmail[email].venueId, email, vRevOf(reg, reg.byEmail[email].venueId)), email,
                  venueId: link.venueId, slug: venue.slug, name: venue.name || '' });
  }

  if (action === 'claim') {
    const email = await readTicket(body.ticket);
    if (!email) return bad('That took too long — ask for a new code', 401);
    const name = String(body.name || '').trim().slice(0, 70);
    if (!name) return bad('What’s the venue called?');

    const reg0 = await readVenues();
    if (!reg0.byEmail[email]) {
      const made = await createVenue({ email, name, slug: body.slug,
                                       city: body.city, country: body.country });
      if (!made.ok) return bad(made.error === 'already' ? 'That address already runs a venue page'
                                                       : 'Couldn’t create that page', 409);
    }
    const reg = await readVenues();
    const link = reg.byEmail[email];
    const venue = reg.byId[link.venueId];
    return json({ ok: true, token: await openV(req, body, reg.byEmail[email].venueId, email, vRevOf(reg, reg.byEmail[email].venueId)), email,
                  venueId: link.venueId, slug: venue.slug, name: venue.name, isNew: true });
  }

  /* ---- signed in, from here ---- */
  const me = await requireVenue(req);
  if (!me) return bad('unauthorized', 401);

  /* THE MISSING CHECK, the same one the artist side was missing. Everything below
     changes who can get in or what the public page is called, and all of it ran on
     "are you signed in" alone. */
  if (['setSlug', 'add', 'remove', 'revokeAll', 'roleSet'].includes(action) && me.role !== 'owner')
    return bad('Only the venue owner can change this', 403);

  const { newSid, killSessions, killEverything, readSessions, sidsFor, note } = await import('./_session.mjs');
  const owner = 'v_' + me.vid;

  if (action === 'sessions') return json({ ok: true, ...(await readSessions(owner, me.sid)) });
  if (action === 'sessionRevoke') {
    await killSessions(owner, [String(body.sid || '').slice(0, 24)].filter(Boolean));
    note(owner, 'session.revoke', me.email || '');
    return json({ ok: true, ...(await readSessions(owner, me.sid)) });
  }
  if (action === 'signOut') {
    if (me.sid) await killSessions(owner, [me.sid]);
    note(owner, 'signout', me.email || '');
    return json({ ok: true });
  }
  if (action === 'signOutOthers') {
    const { list } = await readSessions(owner, me.sid);
    const others = list.filter((x) => !x.current).map((x) => x.sid);
    if (others.length) await killSessions(owner, others);
    return json({ ok: true, gone: others.length, ...(await readSessions(owner, me.sid)) });
  }
  if (action === 'roleSet') {
    const email = normEmail(body.email);
    const want = ['manager', 'crew'].includes(body.role) ? body.role : null;
    if (!want) return bad('unknown role');
    if (email === me.email) return bad('You can’t change your own role');
    let hit = false;
    await mutateVenues((r) => {
      const cur = r.byEmail[email];
      if (!cur || cur.venueId !== me.vid || cur.role === 'owner') return false;
      cur.role = want; hit = true; return true;
    });
    if (!hit) return bad('That address isn’t on this page');
    note(owner, 'role.change', me.email || '', `${email} → ${want}`);
  }

  if (action === 'setSlug') {
    const want = cleanSlug(body.slug);
    if (want.length < 3) return bad('At least 3 letters or numbers');
    let clash = false;
    await mutateVenues((r) => {
      const owner = r.bySlug[want];
      if (owner && owner !== me.vid) { clash = true; return false; }
      const old = r.byId[me.vid] && r.byId[me.vid].slug;
      if (old && old !== want) delete r.bySlug[old];
      r.bySlug[want] = me.vid;
      if (r.byId[me.vid]) r.byId[me.vid].slug = want;
      return true;
    });
    if (clash) return bad('Another venue already has that address');
  }

  if (action === 'add') {
    const email = normEmail(body.email);
    if (!validEmail(email)) return bad('That doesn’t look like an email address');
    let taken = false;
    await mutateVenues((r) => {
      const cur = r.byEmail[email];
      if (cur && cur.venueId !== me.vid) { taken = true; return false; }
      const mine = Object.entries(r.byEmail).filter(([, v]) => v.venueId === me.vid);
      if (mine.length >= 5 && !mine.some(([e]) => e === email)) { taken = true; return false; }
      /* 'staff' was a role name nothing ever read. A manager runs the page; crew
         works tonight and touches neither money nor access. */
      r.byEmail[email] = { venueId: me.vid,
        role: (cur && cur.role === 'owner') ? 'owner'
            : (['manager', 'crew'].includes(body.role) ? body.role : 'crew') };
      return true;
    });
    if (taken) return bad('Couldn’t add that address');
    note(owner, 'seat.add', me.email || '', email);
  }

  if (action === 'remove') {
    const email = normEmail(body.email);
    await mutateVenues((r) => {
      const mine = Object.entries(r.byEmail).filter(([, v]) => v.venueId === me.vid);
      if (mine.length <= 1) return false;                 // never lock the venue out
      const cur = r.byEmail[email];
      if (!cur || cur.venueId !== me.vid) return false;
      if (cur.role === 'owner' && email !== me.email) return false;   // never the owner's row
      delete r.byEmail[email];
      return true;
    });
    await killSessions(owner, await sidsFor(owner, email)).catch(() => {});
    note(owner, 'seat.remove', me.email || '', email);
  }

  if (action === 'revokeAll') {
    // only THIS venue's devices — see vRevOf() in _venues.mjs
    await killEverything(owner);
    note(owner, 'session.revokeAll', me.email || '');
  }

  /* THIS USED TO GRANT THE TICK ON AN EMAIL-DOMAIN MATCH ALONE, which INVARIANT
     0ak says is not proof: anyone can buy a domain, put an email on it, and claim
     to be a bar they have never been to — and a wrong tick sends a real person to
     the wrong place. It now only REPORTS whether the domain matches, and the single
     verdict in _verify.mjs (paid plan + domain + the site naming the venue + three
     artists who gig there) is the only thing that can set `verified`. */
  if (action === 'checkDomain') {
    const prof = await getVenueProfile(me.vid);
    const site = prof.links.website;
    /* REPORT ONLY, and this is the second attempt at that. The first still called
       tryVerifyByWebsite, which WRITES `verified` — so the action went on granting
       the tick, just with more conditions attached. And it judged `me.email`, the
       session that happened to be signed in, when a venue can add staff: a barman
       added on Tuesday could verify the page off his own domain. `recheck()`
       resolves the OWNER's address and shapes the profile the same way the Venue
       Studio's own check does, so there is one verdict, computed one way. */
    const { checksOnly } = await import('./_verify.mjs');
    const matched = !!(site && domainMatches(me.email, site));
    const verdict = await checksOnly(me.vid);
    const reg = await readVenues();
    return json({ ok: true, verified: !!(reg.byId[me.vid] || {}).verified,
                  matched, checks: verdict.checks, why: verdict.why,
                  website: site || '' });
  }

  /* Explicit, not a fall-through. Everything above either acted or returned, so
     anything else is a typo — and silently answering "ok" to a typo'd action is
     how a broken client looks like a working one. */
  if (!['list', 'setSlug', 'add', 'remove', 'revokeAll'].includes(action))
    return bad('unknown action');

  const reg = await readVenues();
  const mine = reg.byId[me.vid] || {};
  return json({ ok: true,
    venueId: me.vid, slug: mine.slug || '', name: mine.name || '',
    verified: !!mine.verified, verifiedVia: mine.verifiedVia || null,
    emails: Object.entries(reg.byEmail)
      .filter(([, v]) => v.venueId === me.vid)
      .map(([e, v]) => ({ email: e, role: v.role || 'owner' })),
    emailReady: emailReady() });
};
