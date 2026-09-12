/* THE VERIFICATION TICK — venues and artists.

   The tick is the only trust signal MySet has, and a wrong one on a real bar sends
   a real person to the wrong place (INVARIANT 0ak). Two things must both be true and
   they pull in opposite directions: it is now a PREMIUM feature, and it is still not
   for sale. Paying opens the door to being checked; it does not buy the tick.

   `/api/venueauth checkDomain` used to grant it on an email-domain match alone —
   buy any domain, put an email on it, claim a bar you have never been to. These
   cases pin that shut, and pin the artist path's privacy rule: an ID photo is never
   servable and never kept past the decision. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin    = (await import('../netlify/functions/admin.mjs')).default;
const vauthFn  = (await import('../netlify/functions/venueauth.mjs')).default;
const imgFn    = (await import('../netlify/functions/img.mjs')).default;
const V        = await import('../netlify/functions/_venues.mjs');
const VER      = await import('../netlify/functions/_verify.mjs');
const { SLOTS, getImage } = await import('../netlify/functions/_img.mjs');
const { createArtist, signToken, readArtists, revOf, mutateArtists } =
  await import('../netlify/functions/_auth.mjs');
const { casDoc } = await import('../netlify/functions/_lib.mjs');
const { readFileSync } = await import('node:fs');
const { src } = await import('./_src.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body, token) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, body === undefined
    ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const OWNER = (action, extra = {}) =>
  hit(admin, 'https://x/api/admin?code=devlocal', { action, ...extra });
const AS = (token, action, extra = {}) =>
  hit(admin, 'https://x/api/admin', { action, ...extra }, token);

console.log('\nPERRY ASKED FOR THREE ARTISTS, NOT FIVE');
eq('MIN_VOUCHES', VER.MIN_VOUCHES, 3);

console.log('\nA DOMAIN MATCH ALONE NO LONGER GRANTS THE TICK');
const ven = await V.createVenue({ email: 'boss@uglyduckling.example', name: 'The Ugly Duckling',
  slug: 'ugly-duckling', city: 'Koh Phangan', country: 'Thailand' });
ok('venue created', ven.ok, ven);
const vreg0 = await V.readVenues();
const TV = await V.signVenueToken('boss@uglyduckling.example', V.vRevOf(vreg0, ven.venueId));
// its own website, so the email domain genuinely matches — the old instant-tick case
await hit((await import('../netlify/functions/venueadmin.mjs')).default,
  'https://x/api/venueadmin', { action: 'set', links: { website: 'https://uglyduckling.example' } }, TV);

const cd = await hit(vauthFn, 'https://x/api/venueauth', { action: 'checkDomain' }, TV);
ok('the domain does match', cd.matched === true, cd);
eq('THE BUG: and the venue is still NOT verified', cd.verified, false);
ok('it reports what is still missing', cd.checks && cd.checks.emailOnDomain === true, cd.checks);
eq('including that a free page is not checked at all', cd.checks.paidPlan, false);
eq('and that it needs three artists', cd.checks.artistsNeeded, 3);
const vregAfter = await V.readVenues();
eq('nothing was written to the registry', !!vregAfter.byId[ven.venueId].verified, false);

console.log('\nPAYING OPENS THE DOOR TO BEING CHECKED — IT DOES NOT BUY THE TICK');
eq('a free venue is unpaid', V.venuePaid({ plan: 'free' }), false);
eq('a pro venue is paid', V.venuePaid({ plan: 'pro' }), true);
const setPlan = await OWNER('venuePlan', { venueId: ven.venueId, plan: 'pro' });
ok('the owner can put a venue on Pro', setPlan.ok, setPlan);
const cd2 = await hit(vauthFn, 'https://x/api/venueauth', { action: 'checkDomain' }, TV);
eq('now the paid check passes', cd2.checks.paidPlan, true);
eq('but with no artist vouches it is STILL not verified', cd2.verified, false);
ok('and the tick is blocked on the artists, not on the money',
   cd2.checks.artistsDone === false, cd2.checks);
eq('an unknown plan is refused', (await OWNER('venuePlan', { venueId: ven.venueId, plan: 'platinum' })).status, 400);

console.log('\nTHE ARTIST PATH  premium + payments + an ID + a human');
const ana = await createArtist({ email: 'ana@example.com', name: 'Ana Reyes', slug: 'ana-reyes' });
let reg = await readArtists();
const TA = await signToken('ana@example.com', revOf(reg, ana.artistId));
const st0 = await AS(TA, 'verifyStatus');
eq('a free artist fails the plan check', st0.checks.paidPlan, false);
eq('and starts with no ID on file', st0.checks.state, 'none');
const up0 = await AS(TA, 'idUpload', { data: 'data:image/png;base64,iVBORw0KGgo=' });
eq('THE RIGHT WAY ROUND: refused before the photo is taken', up0.status, 402);
ok('and it says why', /Plus and Pro/.test(up0.error || ''), up0.error);

await mutateArtists((r) => { r.byId[ana.artistId].plan = 'pro'; return true; });
const st1 = await AS(TA, 'verifyStatus');
eq('on Pro the plan check passes', st1.checks.paidPlan, true);
eq('but payments are not set up, so still not ready', st1.checks.payments, false);
const up1 = await AS(TA, 'idUpload', { data: 'data:image/png;base64,iVBORw0KGgo=' });
eq('and the ID is refused for that reason', up1.status, 409);
ok('naming the real blocker', /card payments/i.test(up1.error || ''), up1.error);

// Stand in for what the Connect webhook will write, so the rest of the path is real.
await casDoc(`connect_${ana.artistId}`, () => ({}), (d) => { d.chargesEnabled = true; return true; });
process.env.STRIPE_SECRET_KEY = 'sk_test_notreal_forlocaltestsonly';
const st2 = await AS(TA, 'verifyStatus');
eq('with Connect usable, payments pass', st2.checks.payments, true);
/* The LEGAL name and date of birth, not the page name — a stage name is normal. */
const up2 = await AS(TA, 'idUpload',
  { data: 'data:image/png;base64,iVBORw0KGgo=', legalName: 'Ana Reyes', dob: '1990-06-05' });
ok('now the ID is accepted', up2.ok, up2);
eq('and it is waiting for a human', up2.checks.state, 'pending');
eq('ready for review', up2.checks.readyForReview, true);
eq('but NOT verified yet — a machine does not decide this', up2.checks.reviewed, false);

console.log('\nTHE ID PHOTO IS NEVER PUBLIC, AND NEVER KEPT');
eq('its slot is deliberately not a servable one', SLOTS.has(VER.ID_SLOT), false);
ok('the photo really is stored', !!(await getImage(ana.artistId, VER.ID_SLOT)));
const served = await imgFn(new Request(
  `https://x/api/img?a=${ana.artistId}&s=${VER.ID_SLOT}`));
eq('THE BUG THAT MUST NEVER EXIST: /api/img refuses to serve it', served.status, 404);

const q = await OWNER('idQueue');
ok('it shows up in the owner queue', (q.queue || []).some((r) => r.artistId === ana.artistId), q);
ok('only the owner can see that queue', (await AS(TA, 'idQueue')).status === 401);

const appr = await OWNER('idApprove', { artistId: ana.artistId });
ok('the owner approves', appr.ok && appr.approved, appr);
reg = await readArtists();
eq('the artist is now verified', !!reg.byId[ana.artistId].verified, true);
eq('THE PRIVACY RULE: the ID photo is gone', await getImage(ana.artistId, VER.ID_SLOT), null);
const qAfter = await OWNER('idQueue');
ok('and the queue is clear', !(qAfter.queue || []).some((r) => r.artistId === ana.artistId));

console.log('\nA REJECTION ALSO DESTROYS THE PHOTO');
const bo = await createArtist({ email: 'bo@example.com', name: 'Bo Tran', slug: 'bo-tran' });
reg = await readArtists();
const TB = await signToken('bo@example.com', revOf(reg, bo.artistId));
await mutateArtists((r) => { r.byId[bo.artistId].plan = 'plus'; return true; });
await casDoc(`connect_${bo.artistId}`, () => ({}), (d) => { d.chargesEnabled = true; return true; });
ok('Bo gets an ID on file', (await AS(TB, 'idUpload',
  { data: 'data:image/png;base64,iVBORw0KGgo=', legalName: 'Bo Tran', dob: '1988-02-29' })).ok);
const rej = await OWNER('idReject', { artistId: bo.artistId, why: 'name did not match' });
ok('the owner rejects', rej.ok && rej.approved === false, rej);
reg = await readArtists();
eq('he is not verified', !!reg.byId[bo.artistId].verified, false);
eq('and his photo is gone too', await getImage(bo.artistId, VER.ID_SLOT), null);
const stB = await AS(TB, 'verifyStatus');
eq('he is told he was rejected', stB.checks.state, 'rejected');
eq('and why', stB.checks.rejectedWhy, 'name did not match');

console.log('\nAPPROVING RE-CHECKS, RATHER THAN TRUSTING THE QUEUE ROW');
const cy = await createArtist({ email: 'cy@example.com', name: 'Cy Lo', slug: 'cy-lo' });
const blind = await OWNER('idApprove', { artistId: cy.artistId });
eq('an artist who has done none of it is refused', blind.status, 409);
ok('and told which step is missing', /paid plan/i.test(blind.error || ''), blind.error);
reg = await readArtists();
eq('so they are NOT verified', !!reg.byId[cy.artistId].verified, false);
eq('a target that does not exist is a 404, not a cheerful ok',
   (await OWNER('idApprove', { artistId: 'no-such-artist' })).status, 404);

console.log('\nA REJECTION CAN UNDO AN APPROVAL  (a mistake must not be permanent)');
reg = await readArtists();
eq('Ana is verified from earlier', !!reg.byId[ana.artistId].verified, true);
const undo = await OWNER('idReject', { artistId: ana.artistId, why: 'approved by mistake' });
ok('the owner can take it back', undo.ok, undo);
reg = await readArtists();
eq('she is no longer verified', !!reg.byId[ana.artistId].verified, false);

console.log('\nAND THE ID DELETE IS VERIFIED, NOT ASSUMED');
ok('the decision reports it', undo.idDeleted === true, undo);

console.log('\nA VENUE THAT STOPS PAYING STOPS BEING VERIFIED');
await V.mutateVenues((r) => { r.byId[ven.venueId].verified = true;
  r.byId[ven.venueId].verifiedVia = 'website+artists'; return true; });
let vreg = await V.readVenues();
eq('verified while on Pro', V.shapeVenue(await V.getVenueProfile(ven.venueId), vreg.byId[ven.venueId]).verified, true);
ok('the owner drops them to free', (await OWNER('venuePlan', { venueId: ven.venueId, plan: 'free' })).ok);
vreg = await V.readVenues();
eq('the stored flag is cleared', !!vreg.byId[ven.venueId].verified, false);
eq('and a lingering flag could not render one either',
   V.shapeVenue(await V.getVenueProfile(ven.venueId),
                { ...vreg.byId[ven.venueId], verified: true, plan: 'free' }).verified, false);
eq('an unknown venue is a 404', (await OWNER('venuePlan', { venueId: 'nope', plan: 'pro' })).status, 404);

console.log('\nTHE FLAG SWITCH IS PERRY\u2019S ALONE  (server-side, not just hidden in the UI)');
/* Perry asked whether "Trying things out" is only on his account. It is, and the
   guarantee has to be the SERVER's — a card hidden by `PLAN.owner` in the page is a
   suggestion anyone can step around with curl. */
const anaFlags = await AS(TA, 'flagList');
eq('another artist cannot even list the flags', anaFlags.status, 401);
const anaSet = await AS(TA, 'flagSet', { flag: 'featuredShows', on: false });
eq('nor set one', anaSet.status, 401);
const anaSetOther = await AS(TA, 'flagSet', { flag: 'featuredShows', on: false, artistId: 'perry-idyll' });
eq('nor set one on somebody else', anaSetOther.status, 401);
ok('while the founder can', (await OWNER('flagList')).ok);
const { flagValue, readFlags } = await import('../netlify/functions/_flags.mjs');
eq('and none of that changed the flag', flagValue(await readFlags(), 'featuredShows', 'perry-idyll'), true);
const studioSrc = src(new URL('../public/studio.html', import.meta.url));
ok('the card is also hidden for everyone else, as a courtesy',
   /function flagCard\(\)\{[\s\S]{0,120}PLAN\.owner/.test(studioSrc), 'flagCard must gate on PLAN.owner');

delete process.env.STRIPE_SECRET_KEY;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
