/* THE FREE PLAN'S TWO LIMITS, AND THAT THEY ARE REALLY ENFORCED.

   Shows are capped at 2 per ISO WEEK (Monday to Sunday), not 4 a month — a working
   act plays in a weekly rhythm, and a monthly bucket let somebody burn the whole
   allowance on one weekend and then sit dark for three. It is also a limit you can
   hold in your head.

   And CREATING a setlist is a Plus feature. Everything else about setlists keeps
   working on free, because a cap never deletes anything (INVARIANT 0s). */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin = (await import('../netlify/functions/admin.mjs')).default;
const { gigWeekOf, getShow } = await import('../netlify/functions/_lib.mjs');
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
eq('two shows', PLANS.free.gigs, 2);
eq('and setlists are not on free', PLANS.free.setlists, false);
eq('but are on Plus', PLANS.plus.setlists, true);
eq('and on Pro', PLANS.pro.setlists, true);

console.log('\nTHE WEEK RUNS MONDAY TO SUNDAY, AND DOES NOT DRIFT');
eq('a Thursday', gigWeekOf(Date.parse('2026-09-03T12:00:00Z')), '2026-W36');
eq('the Sunday after is the SAME week', gigWeekOf(Date.parse('2026-09-06T23:59:00Z')), '2026-W36');
eq('the Monday after is a NEW week', gigWeekOf(Date.parse('2026-09-07T00:00:00Z')), '2026-W37');
eq('1 Jan 2026 is week 1', gigWeekOf(Date.parse('2026-01-01T12:00:00Z')), '2026-W01');
eq('3 Jan 2027 still belongs to 2026', gigWeekOf(Date.parse('2027-01-03T12:00:00Z')), '2026-W53');

console.log('\nSETUP  a free artist');
const ana = await createArtist({ email: 'ana@example.com', name: 'Ana Reyes', slug: 'ana-reyes' });
const reg = await readArtists();
const TA = await signToken('ana@example.com', revOf(reg, ana.artistId));
const A = (action, extra = {}) => hit(admin, 'https://x/api/admin', { action, ...extra }, TA);
await A('addSong', { title: 'Valerie', artist: 'Amy Winehouse' });
await A('addSong', { title: 'Dreams', artist: 'Fleetwood Mac' });

console.log('\nTWO SHOWS A WEEK, THEN A REFUSAL THAT EXPLAINS ITSELF');
ok('the first show starts', (await A('newShow')).ok);
ok('and the second', (await A('newShow')).ok);
const third = await A('newShow');
eq('the third is refused', third.status, 402);
ok('and says it is a WEEKLY allowance', /this week/i.test(third.error || ''), third.error);
ok('and when it comes back', /Monday/i.test(third.error || ''), third.error);

console.log('\nIT IS COUNTED ON THE RECORD, NOT GUESSED');
const show = await getShow(ana.artistId);
eq('the week is stamped', show.gigWeek, gigWeekOf());
eq('and two are counted', show.gigCount, 2);
ok('the old monthly field is gone', show.gigMonth === undefined, show.gigMonth);

console.log('\nA NEW WEEK GIVES THE ALLOWANCE BACK');
const { mutateShow } = await import('../netlify/functions/_lib.mjs');
await mutateShow(ana.artistId, (sh) => { sh.gigWeek = '2020-W01'; return true; });
ok('a show starts again', (await A('newShow')).ok);
const after = await getShow(ana.artistId);
eq('and the counter restarted at one', after.gigCount, 1);
eq('in the current week', after.gigWeek, gigWeekOf());

console.log('\nPAYING LIFTS IT');
await mutateArtists((r) => { r.byId[ana.artistId].plan = 'plus'; return true; });
for (let i = 0; i < 4; i++) ok(`show ${i + 3} on Plus`, (await A('newShow')).ok);

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
ok('the Live warning counts by week', /s\.gigWeek===isoWeek\(\)/.test(page));
ok('and the page computes the SAME week the server does', /function isoWeek\(/.test(page));
ok('the wording says week, not month', /free shows this week/.test(page));
ok('and Monday, not the 1st', /resets Monday/i.test(page));
ok('no stale monthly copy is left', !/free shows this month/.test(page));

console.log('\nTHE FOUNDER\'S NOTE IS THERE, AND IT COLLAPSES');
ok('it is a real disclosure element', /<details class="why">/.test(page));
ok('the heading is the button', /<summary>Why there's a limit at all/.test(page));
ok('it names him', /Perry Idyll<\/summary>/.test(page));
ok('it carries his 2\/week line', /limited to 2\/week on the free plan/.test(page));
ok('and the old monthly explainer is gone', !/shows a month<\/b> rather than by/.test(page));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
