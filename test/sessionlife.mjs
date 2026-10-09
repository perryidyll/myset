/* A SESSION LASTS A WEEK AND RENEWS ITSELF IN USE (decision 0199).

   A token was good for thirty days from the moment it was minted, whatever happened
   in between: a copy off a borrowed phone, a browser profile, a backup kept working
   for a month. Now a token lives a week — and a device that is used inside the week
   never notices, because a token more than a day old is answered with a fresh one for
   the same device, on the reply, and the Studio keeps it.

   What is pinned here, artist side and venue side:
     · a young token is answered as it always was, with nothing extra
     · a token more than a day old comes back renewed: same address, same device
       (sid), same rev, a week from now, exposed to a Studio on another origin
     · a device used once a week stays signed in; one left for eight days does not
     · signing a device out still signs it out — the renewed token is refused too
       (INVARIANT 0dd holds across a renewal)
     · a token minted before sessions had ids renews to the same shape
     · a shared reply never carries a token, whatever was offered. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin  = (await import('../netlify/functions/admin.mjs')).default;
const authFn = (await import('../netlify/functions/auth.mjs')).default;
const vadmin = (await import('../netlify/functions/venueadmin.mjs')).default;
const { createArtist, readArtists, signToken, verifyToken, revOf, TOKEN_LIFE, RENEW_AFTER_MS, renewToken } = await import('../netlify/functions/_auth.mjs');
const { createVenue, readVenues, signVenueToken, verifyVenueToken, vRevOf } = await import('../netlify/functions/_venues.mjs');
const { newSid, addSession, killSessions } = await import('../netlify/functions/_session.mjs');
const { json, jsonCached, offerRenewal, renewalFor } = await import('../netlify/functions/_lib.mjs');
const { withRenewal } = await import('../netlify/functions/_errlog.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + ' \n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const DAY = 86400e3, HOUR = 3600e3;
const hit = async (h, url, body, token) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = { raw: t }; }
  return { status: r.status, renewed: r.headers.get('x-myset-token'), exposed: r.headers.get('access-control-expose-headers'), ...j };
};
const S = (body, token) => hit(admin, 'https://x/api/admin', body, token);
const A = (body, token) => hit(authFn, 'https://x/api/auth', body, token);
const V = (body, token) => hit(vadmin, 'https://x/api/venueadmin', body, token);
const bodyOf = (t) => Buffer.from(t.split('.')[0], 'base64url').toString();
const expOf = (t) => { const p = bodyOf(t).split('|'); return Number(p[p.length >= 4 ? p.length - 3 : p.length - 2]); };

console.log('\nTHE NUMBERS  a week, renewed after a day');
eq('a session lasts seven days', TOKEN_LIFE, 7 * DAY);
eq('…and renews once it is more than a day old', RENEW_AFTER_MS, DAY);

console.log('\nAN ARTIST  the Studio is answered as always, and once a day handed a fresh token');
await createArtist({ email: 'rita@example.com', name: 'Rita Vance', slug: 'rita' });
let reg = await readArtists();
const rita = reg.byEmail['rita@example.com'].artistId;
const rev = revOf(reg, rita);
const sid = newSid();
await addSession(rita, { sid, email: 'rita@example.com', label: 'iPhone · Safari', at: Date.now() });
const now = Date.now();
const young = await signToken('rita@example.com', rev, sid);
let r = await S({ action: 'planGet' }, young);
ok('a token minted just now opens the Studio', r.ok, r);
eq('…and nothing rides back on the reply', [r.renewed, r.exposed], [null, null]);

const dayOld = await signToken('rita@example.com', rev, sid, now - 25 * HOUR);
r = await S({ action: 'planGet' }, dayOld);
ok('a token a day old opens the Studio', r.ok, r);
ok('THE RENEWAL: the reply carries a fresh token', !!r.renewed && r.renewed !== dayOld, r.renewed);
eq('…exposed, so a Studio on another origin can read it', r.exposed, 'x-myset-token');
const fresh = await verifyToken(r.renewed);
ok('…which verifies', !!fresh);
eq('…for the same address, the same device and the same rev', [fresh.email, fresh.sid, String(fresh.rev)], ['rita@example.com', sid, String(rev)]);
ok('…good for a week from now, not from the old token', expOf(r.renewed) > now + 7 * DAY - 10e3 && expOf(r.renewed) <= Date.now() + 7 * DAY, expOf(r.renewed) - now);
r = await S({ action: 'planGet' }, r.renewed);
ok('the fresh token opens the Studio and is young: nothing extra', r.ok && r.renewed === null, r);
r = await A({ action: 'me', token: dayOld });
eq('the sign-in door answers a day-old token too', r.signedIn, true);

console.log('\nTHE WEEK  used weekly stays in; left for eight days does not');
const sixDays = await signToken('rita@example.com', rev, sid, now - 6 * DAY - 23 * HOUR);
r = await S({ action: 'planGet' }, sixDays);
ok('a device used on day seven is still signed in, and renewed', r.ok && !!r.renewed, r);
const eightDays = await signToken('rita@example.com', rev, sid, now - 8 * DAY);
r = await S({ action: 'planGet' }, eightDays);
eq('a device left for eight days has to sign in again', r.status, 401);
eq('…and is handed nothing', r.renewed, null);
eq('renewToken itself gives nothing for a token that is still young', await renewToken(await verifyToken(young)), null);

console.log('\nSIGNED OUT  a renewal is not a way back in (0dd)');
const t1 = await signToken('rita@example.com', rev, sid, now - 2 * DAY);
const renewed = (await S({ action: 'planGet' }, t1)).renewed;
ok('a renewed token, in hand', !!renewed);
await killSessions(rita, [sid]);
eq('the device is signed out: the old token is refused', (await S({ action: 'planGet' }, t1)).status, 401);
eq('…and so is the renewed one', (await S({ action: 'planGet' }, renewed)).status, 401);

console.log('\nBEFORE SESSIONS HAD IDS  a three-field token renews to a three-field token');
const legacy = await signToken('rita@example.com', rev, null, now - 2 * DAY);
r = await S({ action: 'planGet' }, legacy);
ok('an old-shape token still opens the Studio and is renewed', r.ok && !!r.renewed, r);
eq('…to the same shape', bodyOf(r.renewed).split('|').length, 3);
ok('…which verifies', !!(await verifyToken(r.renewed)));

console.log('\nA VENUE  the same week, the same renewal');
const bar = await createVenue({ email: 'boss@bar.com', name: 'The Corner Bar', city: 'Koh Phangan', country: 'Thailand' });
const vreg = await readVenues();
const vsid = newSid();
await addSession('v_' + bar.venueId, { sid: vsid, email: 'boss@bar.com', label: 'Android · Chrome', at: Date.now() });
const vrev = vRevOf(vreg, bar.venueId);
r = await V({ action: 'get' }, await signVenueToken('boss@bar.com', vrev, vsid));
ok('a young venue token: answered, nothing extra', r.ok && r.renewed === null, r);
r = await V({ action: 'get' }, await signVenueToken('boss@bar.com', vrev, vsid, now - 25 * HOUR));
ok('a day-old venue token is renewed', r.ok && !!r.renewed, r);
const vfresh = await verifyVenueToken(r.renewed);
eq('…for the same venue, device and rev', [vfresh && vfresh.venueId, vfresh && vfresh.sid, String(vfresh && vfresh.rev)], [bar.venueId, vsid, String(vrev)]);
ok('…good for a week', expOf(r.renewed) > now + 7 * DAY - 10e3, expOf(r.renewed) - now);
eq('a venue token eight days old is refused', (await V({ action: 'get' }, await signVenueToken('boss@bar.com', vrev, vsid, now - 8 * DAY))).status, 401);
ok('a venue token is never accepted at the artist door, renewed or not', (await S({ action: 'planGet' }, r.renewed)).status === 401);

console.log('\nONLY A REPLY THAT IS NOBODY ELSE\'S  a shared reply never carries a token');
{
  const req = new Request('https://x/api/x');
  offerRenewal(req, 'tok.en');
  eq('the offer is kept against the request', renewalFor(req), 'tok.en');
  const personal = withRenewal(req, json({ ok: true }));
  eq('a personal reply (no-store) carries it', personal.headers.get('x-myset-token'), 'tok.en');
  const shared = withRenewal(req, jsonCached({ ok: true }, 30));
  eq('a reply the edge may share does NOT', shared.headers.get('x-myset-token'), null);
  const page = withRenewal(req, new Response('<html>', { headers: { 'content-type': 'text/html' } }));
  eq('nor a page', page.headers.get('x-myset-token'), null);
  eq('another request is offered nothing', renewalFor(new Request('https://x/api/y')), null);
  const frozen = withRenewal(req, new Response('{}', { headers: { 'cache-control': 'no-store' } }));
  eq('a plain no-store reply takes it', frozen.headers.get('x-myset-token'), 'tok.en');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
