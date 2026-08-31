import { json, bad } from './_lib.mjs';
import { normEmail, validEmail, issueCode, checkCode, sendCode,
         signTicket, readTicket, cleanSlug } from './_auth.mjs';
import { readVenues, mutateVenues, createVenue, requireVenue, signVenueToken,
         verifyVenueToken, getVenueProfile, domainMatches } from './_venues.mjs';

/* Sign-in for VENUES. The same email-and-a-code flow as artists, in its own
   realm: separate registry, separate token tag, separate one-time-code key. The
   same address can run an artist page and a venue page without either one being
   able to reach the other. */

const REALM = 'v';
const SENT = { ok: true, sent: true };

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
    if (!process.env.RESEND_API_KEY) return bad('Email sign-in isn’t switched on yet.', 503);
    const reg = await readVenues();
    const link = reg.byEmail[email];
    const code = await issueCode(email, null, REALM);
    if (!code) return json(SENT);                                  // rate limited, silently
    await sendCode(email, code, link ? (reg.byId[link.venueId] || {}).name : '', 'Venue Studio');
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
    return json({ ok: true, token: await signVenueToken(email, reg.rev), email,
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
    return json({ ok: true, token: await signVenueToken(email, reg.rev), email,
                  venueId: link.venueId, slug: venue.slug, name: venue.name, isNew: true });
  }

  /* ---- signed in, from here ---- */
  const me = await requireVenue(req);
  if (!me) return bad('unauthorized', 401);

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
      r.byEmail[email] = { venueId: me.vid, role: 'staff' };
      return true;
    });
    if (taken) return bad('Couldn’t add that address');
  }

  if (action === 'remove') {
    const email = normEmail(body.email);
    await mutateVenues((r) => {
      const mine = Object.entries(r.byEmail).filter(([, v]) => v.venueId === me.vid);
      if (mine.length <= 1) return false;                 // never lock the venue out
      if (r.byEmail[email] && r.byEmail[email].venueId === me.vid) delete r.byEmail[email];
      return true;
    });
  }

  if (action === 'revokeAll')
    await mutateVenues((r) => { r.rev = (r.rev || 1) + 1; return true; });

  /* Instant verification when the person who claimed it has an email at the
     venue's own website. Everything else stays an unverified listing until a
     human says otherwise — see VERIFYING-A-VENUE.md. */
  if (action === 'checkDomain') {
    const prof = await getVenueProfile(me.vid);
    const site = prof.links.website;
    let ok = false;
    if (site && domainMatches(me.email, site)) {
      await mutateVenues((r) => {
        const v = r.byId[me.vid];
        if (!v || v.verified) return false;
        v.verified = true; v.verifiedVia = 'domain'; v.verifiedAt = Date.now();
        return true;
      });
      ok = true;
    }
    const reg = await readVenues();
    return json({ ok: true, verified: !!(reg.byId[me.vid] || {}).verified, matched: ok,
                  website: site || '' });
  }

  const reg = await readVenues();
  const mine = reg.byId[me.vid] || {};
  return json({ ok: true,
    venueId: me.vid, slug: mine.slug || '', name: mine.name || '',
    verified: !!mine.verified, verifiedVia: mine.verifiedVia || null,
    emails: Object.entries(reg.byEmail)
      .filter(([, v]) => v.venueId === me.vid)
      .map(([e, v]) => ({ email: e, role: v.role || 'owner' })),
    emailReady: !!process.env.RESEND_API_KEY });
};
