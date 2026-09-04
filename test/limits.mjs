/* THE FREE PLAN'S TWO LIMITS, AND THAT THEY ARE REALLY ENFORCED.

   Shows are capped per CALENDAR MONTH, UTC, resetting on the 1st. The number lives
   in the plan table and is read from there rather than repeated here, because it
   has already changed twice — four a month, briefly two a week, then back — and a
   test that hard-codes it turns every pricing decision into a test edit.

   And CREATING a setlist is a Plus feature. Everything else about setlists keeps
   working on free, because a cap never deletes anything (INVARIANT 0s). */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin = (await import('../netlify/functions/admin.mjs')).default;
const { gigMonthOf, getShow } = await import('../netlify/functions/_lib.mjs');
const { PLANS } = await import('../netlify/functions/_plan.mjs');
const { createArtist, signToken, readArtists, revOf, mutateArtists } =
  await import('../netlify/functions/_auth.mjs');
const { readFileSync } = await import('node:fs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body, token) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};

console.log('\nTHE NUMBERS ARE WHAT PERRY ASKED FOR');
eq('four shows a month', PLANS.free.gigs, 4);
eq('and setlists are not on free', PLANS.free.setlists, false);
eq('but are on Plus', PLANS.plus.setlists, true);
eq('and on Pro', PLANS.pro.setlists, true);

console.log('\nTHE BUCKET IS A CALENDAR MONTH, THE SAME ONE EVERYWHERE');
eq('early September', gigMonthOf(Date.parse('2026-09-03T12:00:00Z')), '2026-09');
eq('the last instant of the month is still it', gigMonthOf(Date.parse('2026-09-30T23:59:59Z')), '2026-09');
eq('the 1st is a new one', gigMonthOf(Date.parse('2026-10-01T00:00:00Z')), '2026-10');
eq('and it rolls over the year', gigMonthOf(Date.parse('2027-01-01T00:00:00Z')), '2027-01');

console.log('\nSETUP  a free artist');
const ana = await createArtist({ email: 'ana@example.com', name: 'Ana Reyes', slug: 'ana-reyes' });
const reg = await readArtists();
const TA = await signToken('ana@example.com', revOf(reg, ana.artistId));
const A = (action, extra = {}) => hit(admin, 'https://x/api/admin', { action, ...extra }, TA);
await A('addSong', { title: 'Valerie', artist: 'Amy Winehouse' });
await A('addSong', { title: 'Dreams', artist: 'Fleetwood Mac' });

console.log(`\n${PLANS.free.gigs} SHOWS A MONTH, THEN A REFUSAL THAT EXPLAINS ITSELF`);
const CAP = PLANS.free.gigs;
for (let i = 0; i < CAP; i++) ok(`show ${i + 1} starts`, (await A('newShow')).ok);
const over = await A('newShow');
eq('one past the cap is refused', over.status, 402);
ok('and says it is a MONTHLY allowance', /this month/i.test(over.error || ''), over.error);
ok('and when it comes back', /on the 1st/i.test(over.error || ''), over.error);

console.log('\nIT IS COUNTED ON THE RECORD, NOT GUESSED');
const show = await getShow(ana.artistId);
eq('the month is stamped', show.gigMonth, gigMonthOf());
eq('and every show is counted', show.gigCount, CAP);
ok('the short-lived weekly field is gone', show.gigWeek === undefined, show.gigWeek);

console.log('\nA NEW MONTH GIVES THE ALLOWANCE BACK');
const { mutateShow } = await import('../netlify/functions/_lib.mjs');
await mutateShow(ana.artistId, (sh) => { sh.gigMonth = '2020-01'; return true; });
ok('a show starts again', (await A('newShow')).ok);
const after = await getShow(ana.artistId);
eq('and the counter restarted at one', after.gigCount, 1);
eq('in the current month', after.gigMonth, gigMonthOf());

console.log('\nPAYING LIFTS IT');
await mutateArtists((r) => { r.byId[ana.artistId].plan = 'plus'; return true; });
for (let i = 0; i < 4; i++) ok(`an extra show on Plus (${i + 1})`, (await A('newShow')).ok);

console.log('\nCREATING A SETLIST IS A PLUS FEATURE');
await mutateArtists((r) => { r.byId[ana.artistId].plan = 'free'; return true; });
const blocked = await A('listNew', { name: 'Late set' });
eq('a free artist is refused', blocked.status, 402);
ok('and told it is a Plus feature', /Plus feature/i.test(blocked.error || ''), blocked.error);
ok('and reassured nothing is taken away',
   /keeps working/i.test(blocked.error || ''), blocked.error);
eq('nothing was created', ((await A('listAll')).lists || []).length, 0);

console.log('\n...AND EVERYTHING ELSE ABOUT SETLISTS STILL WORKS ON FREE');
/* A cap never deletes anything (INVARIANT 0s). An artist who made sets on Plus and
   then downgraded must keep using them — only making ANOTHER one is gated. */
await mutateArtists((r) => { r.byId[ana.artistId].plan = 'plus'; return true; });
const made = await A('listNew', { name: 'Late set' });
ok('made on Plus', made.ok, made);
await mutateArtists((r) => { r.byId[ana.artistId].plan = 'free'; return true; });
ok('a free artist can still put songs in it',
   (await A('listSongs', { id: made.id, songs: ['valerie'] })).ok);
ok('...still rename it', (await A('listRename', { id: made.id, name: 'Early set' })).ok);
ok('...still play it tonight', (await A('listUse', { id: made.id })).ok);
ok('...and still delete it', (await A('listDelete', { id: made.id })).ok);

console.log('\nTHE STUDIO SAYS THE SAME THING THE SERVER ENFORCES');
const page = readFileSync(new URL('../public/studio.html', import.meta.url), 'utf8');
ok('the Live warning counts by month', /s\.gigMonth===monthKey\(\)/.test(page));
ok('and the page computes the SAME bucket the server does', /const monthKey=/.test(page));
ok('the wording says month', /free shows this month/.test(page));
ok('and the 1st, not Monday', /resets on the 1st/i.test(page));
/* The copy has been wrong in both directions now. Nothing weekly may survive
   anywhere in the Studio, including inside the founder's note. */
ok('NOTHING weekly is left anywhere', !/this week|resets Monday|2\/week|isoWeek|gigWeek/.test(page));

console.log('\nAND THE STUDIO SAYS SO BEFORE THE TAP, NOT AFTER  (INVARIANT 0ad)');
const adminSrc = readFileSync(new URL('../netlify/functions/admin.mjs', import.meta.url), 'utf8');
ok('the plan payload carries the setlists flag', /setlists: !!l\.setlists/.test(adminSrc));
/* This used to assert the exact sentence on a bespoke greyed-out button. Perry
   asked on 2026-09-03 for EVERY unavailable feature to be shown greyed rather
   than hidden, so that one-off was replaced by a shared `lock()` treatment — and
   asserting the copy again would just break the next time the copy improves.
   What has to hold is the behaviour: setlists go through the shared lock, and the
   lock is a real lock rather than a bit of opacity. */
ok('the new setlist button goes through the shared lock', /lock\('setlists'/.test(page));
ok('with the promise that existing sets keep working',
   /Sets you already have keep working/.test(page));
ok('and the old one-off greyed button is gone', !/a Plus feature<\/button>/.test(page));

console.log('\nA LOCK IS POINTER-EVENTS, NOT OPACITY  — AND IT HAS TO REACH THE PAGE');
const css = readFileSync(new URL('../public/lock.css', import.meta.url), 'utf8');
ok('the greyed content cannot be tapped through', /\.lock>\.lockin\{[^}]*pointer-events:none/.test(css));
ok('and the veil sits above it', /\.lockveil\{[^}]*z-index:2/.test(css));
/* THE BUG THIS BLOCK EXISTS FOR. These rules were first written into app.css,
   which looked obviously right and did nothing whatsoever: NEITHER Studio links
   app.css, and the Studios are the only two pages that have a lock. It was
   believed until computed styles were measured in a real browser — reading the
   diff would never have caught it. So this checks the LINK, in both pages, and
   that the rules live in exactly one file. */
const vpage = readFileSync(new URL('../public/venue-studio.html', import.meta.url), 'utf8');
const appcss = readFileSync(new URL('../public/app.css', import.meta.url), 'utf8');
ok('the Artist Studio links it', /<link rel="stylesheet" href="\/lock\.css">/.test(page));
ok('the Venue Studio links it', /<link rel="stylesheet" href="\/lock\.css">/.test(vpage));
ok('and there is exactly one copy of the rules',
   !/\.lock>\.lockin/.test(page) && !/\.lock>\.lockin/.test(vpage) && !/\.lock>\.lockin/.test(appcss));

console.log('\nDESIGNED BUT NOT BUILT IS SHOWN AS "COMING", NEVER AS "YOURS"');
const { NOT_BUILT } = await import('../netlify/functions/_plan.mjs');
const { VENUE_PLANS, VENUE_NOT_BUILT } = await import('../netlify/functions/_venues.mjs');
eq('the four Pro features with no code behind them are named',
   [...NOT_BUILT].sort(), ['analytics', 'branding', 'presskit', 'promote']);
/* merch is BUILT (2026-09-04): sold on Plus and Pro, refused with a 402 on free in
   admin.mjs (merchSave / merchPhoto), and on venue Free in venueadmin.mjs. */
ok('merch is a real flag on every row', 'merch' in PLANS.free && PLANS.plus.merch === true && PLANS.pro.merch === true);
ok('and is not in the coming-soon list', !NOT_BUILT.includes('merch'));
ok('merch is refused server-side on free', /merchAllowed\(aid/.test(adminSrc));
ok('with the plan named', /Merch on your page is a Plus feature/.test(adminSrc));
ok('and forwarded to the Studio', /merch: !!l\.merch/.test(adminSrc));
ok('every one of them is a real plan flag',
   NOT_BUILT.every((f) => f in PLANS.pro), NOT_BUILT);
ok('the plan payload ships the list, so the Studio can grey them', /soon: NOT_BUILT/.test(adminSrc));
/* THE POINT OF THE LIST: Perry is comped to Pro. Without it he would open the
   Studio, see four features presented as his, and find four dead ends. */
ok('a Pro artist is still shown "coming soon" for them',
   /if\(isSoon\(flag\)\) return false;[\s\S]{0,80}if\(PLAN\.owner\) return true;/.test(page));
ok('and the two that ARE built are not in the list',
   !NOT_BUILT.includes('pricing') && !NOT_BUILT.includes('setlists'));
/* Both built flags have to be enforced somewhere, or "built" is a claim. */
ok('pricing is refused server-side on free', /canPrice = isPlatformOwner/.test(adminSrc));
ok('setlists are refused server-side on free', /limits\.setlists !== true/.test(adminSrc));

eq('the three venue features with no code behind them are named',
   [...VENUE_NOT_BUILT].sort(), ['speakerVotes', 'tips']);
/* `reviews` became the community page on 2026-09-04 and is free on both rows (0w). */
ok('venue reviews are free on both plans', VENUE_PLANS.free.reviews === true && VENUE_PLANS.pro.reviews === true);
ok('venue merch is Pro', VENUE_PLANS.free.merch === false && VENUE_PLANS.pro.merch === true);
ok('every one is a real venue flag',
   VENUE_NOT_BUILT.every((f) => f in VENUE_PLANS.pro), VENUE_NOT_BUILT);
/* photos is NOT in that list, so it has to be genuinely enforced — and until
   2026-09-03 it was not: VENUE_PLANS said 3 free / 12 Pro and photoUpload would
   write p11 for anybody who asked. */
const vadmin = readFileSync(new URL('../netlify/functions/venueadmin.mjs', import.meta.url), 'utf8');
ok('the venue photo cap is actually enforced', /venueLimits\(await venueById\(vid\)\)\.photos/.test(vadmin));
ok('and refused with a 402, like every other plan limit', /Extra photos come with Pro\.`, 402\)/.test(vadmin));

console.log('\nA NUMERIC LIMIT IS NOT A YES/NO');
/* `photos` is 3 or 12 and `featured` is 50 or unlimited, so the first version of
   has() — `limits[flag]===true` — was false for both, and a Pro venue was shown a
   dash beside twelve photo slots it fully had. Caught in a browser, not in review.
   Both Studios carry the same fix and both are checked, because they are meant to
   be a matched pair. */
for (const [who, src] of [['the Artist Studio', page], ['the Venue Studio', vpage]]) {
  ok(`${who} treats unlimited (null) as having it`, /if\(mine===null\) return true;/.test(src));
  ok(`${who} compares a number against the top plan`, /return top===mine;/.test(src));
  ok(`${who} still requires a literal true for a flag`, /return mine===true;/.test(src));
}
/* And the shape that makes it work: unlimited has to survive JSON as null. */
ok('Infinity is sent as null, not dropped', /featured: l\.featured === Infinity \? null : l\.featured/.test(adminSrc));

console.log('\nTHE FOUNDER\'S NOTE IS THERE, AND IT COLLAPSES');
ok('it is a real disclosure element', /<details class="why">/.test(page));
ok('the heading is the button', /<summary>Why there's a limit at all/.test(page));
ok('it names him', /Perry Idyll<\/summary>/.test(page));
ok('and his line matches what is enforced', /limited to 4\/month on the free plan/.test(page));
ok('and the old explainer is gone', !/shows a month<\/b> rather than by/.test(page));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
