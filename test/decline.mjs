/* An artist may decline an unplayed song and return exactly the credits attached
   to it. Paid-vote attribution is stored per vote so another song's paid spend is
   never refunded by mistake. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin = (await import('../netlify/functions/admin.mjs')).default;
const showFn = (await import('../netlify/functions/show.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const { mutateFan, mutateMeta, readFans, getShow, DEFAULT_ARTIST } = await import('../netlify/functions/_lib.mjs');
const { __failWrites } = await import('./blobs-fake.mjs');
const { readFileSync } = await import('node:fs');
const { src } = await import('./_src.mjs');
const votePage = readFileSync(new URL('../public/vote.html', import.meta.url), 'utf8');
const studioPage = src(new URL('../public/studio.html', import.meta.url));

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (handler, url, body) => {
  const r = await handler(new Request(url, body === undefined ? {} : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }));
  return { status: r.status, ...JSON.parse(await r.text()) };
};
const A = (action, extra = {}) => hit(admin, 'https://x/api/admin?code=devlocal', { action, ...extra });
const send = (body) => hit(voteFn, 'https://x/api/vote', body);
const pub = (fan) => hit(showFn, `https://x/api/show?fan=${fan}`);

console.log('\nSETUP AND ATTRIBUTION');
await A('addSong', { title: 'Alpha', artist: 'Artist' });
await A('addSong', { title: 'Bravo', artist: 'Artist' });
await A('addSong', { title: 'Charlie', artist: 'Artist' });
await A('freeCredits', { n: 2 });
await A('status', { status: 'live' });
await mutateFan(DEFAULT_ARTIST, 'ann', (me) => { me.extra = 3; return true; });

ok('four votes land on Alpha', (await send({ fan: 'ann', song: 'alpha', n: 4, cast: 'declinecast00001' })).ok);
ok('one paid vote lands on Bravo', (await send({ fan: 'ann', song: 'bravo', n: 1, cast: 'declinecast00002' })).ok);
ok('a second fan adds a free Alpha vote', (await send({ fan: 'bob', song: 'alpha', n: 1, cast: 'declinecast00003' })).ok);

let stage = (await A('window', { open: true })).stage;
let alpha = stage.songs.find((s) => s.id === 'alpha');
let bravo = stage.songs.find((s) => s.id === 'bravo');
eq('Alpha has five votes total', alpha.votes, 5);
eq('two Alpha votes used paid credits', alpha.paidVotes, 2);
eq('Bravo has one paid vote', [bravo.votes, bravo.paidVotes], [1, 1]);

/* A TIPPER'S VOTES ARE PAID VOTES (decision 0079): Bob voted for free, then tipped
   tonight — his Alpha vote joins the paid count. Cal voted for free and tipped
   LAST WEEK — the night boundary is the show's start, so nothing changes. Ann's
   two bought Alpha votes are not counted again when she tips. */
console.log('\nWHO PUT MONEY IN');
const startedAt = (await getShow(DEFAULT_ARTIST)).startedAt;
ok('Cal adds a free Bravo vote', (await send({ fan: 'cal', song: 'bravo', n: 1, cast: 'declinecast00010' })).ok);
await mutateMeta(DEFAULT_ARTIST, (m) => { m.tips.push({ fan: 'bob', amount: 5, note: '', at: Date.now() });
  m.tips.push({ fan: 'cal', amount: 20, note: '', at: startedAt - 7 * 86400e3 }); return true; });
stage = (await A('window', { open: true })).stage;
alpha = stage.songs.find((s) => s.id === 'alpha'); bravo = stage.songs.find((s) => s.id === 'bravo');
eq('Bob’s free vote now counts as paid on Alpha', [alpha.votes, alpha.paidVotes], [5, 3]);
eq('Cal’s last-week tip counts for nothing tonight', [bravo.votes, bravo.paidVotes], [2, 1]);
await mutateMeta(DEFAULT_ARTIST, (m) => { m.tips.push({ fan: 'ann', amount: 2, note: '', at: Date.now() }); return true; });
stage = (await A('window', { open: true })).stage;
alpha = stage.songs.find((s) => s.id === 'alpha');
eq('a tipper who also bought votes is counted once per vote', alpha.paidVotes, 5);
eq('the Studio is told what the room may see', stage.show.crowd, { votes: false, tips: false });
/* THE LIVE TAB'S "TIPS" IS TONIGHT'S (15 Sep): Cal's $20 from last week is in the account's
   history, not in tonight — the Studio used to add it in and the founder counted $30 for $20 */
eq('the Studio’s tip total is tonight’s, not the account’s history', [stage.tips.total, stage.tips.count], [7, 2]);
eq('…and the account’s all-time total travels beside it, named', [stage.tips.allTime, stage.tips.allTimeCount], [27, 3]);
ok('recent tips on the Live tab are tonight’s only', stage.tips.recent.length === 2 && stage.tips.recent.every((t) => t.fan !== 'cal'), stage.tips.recent);

/* WHAT THE ROOM SEES (0079): nothing until the artist switches it on; then the
   tally, then the tips — this window's tips, not the account's history. */
console.log('\nWHAT THE ROOM SEES');
eq('the vote page gets no numbers by default', (await pub('bob')).numbers, null);
ok('votes + voters switched on', (await A('crowdSet', { which: 'votes', on: true })).ok);
let seen = (await pub('bob')).numbers;
eq('the room sees the tally and how many people cast it', seen, { votes: 7, voters: 3 });
ok('tips switched on', (await A('crowdSet', { which: 'tips', on: true })).ok);
seen = (await pub('bob')).numbers;
eq('and tonight’s tips, not last week’s', seen.tips, { total: 7, count: 2 });
ok('votes switched off again', (await A('crowdSet', { which: 'votes', on: false })).ok);
seen = (await pub('bob')).numbers;
eq('each switch stands alone', [seen.votes, seen.tips.total], [undefined, 7]);
eq('a switch that is not votes or tips is refused', (await A('crowdSet', { which: 'room', on: true })).status, 400);
ok('tips switched off', (await A('crowdSet', { which: 'tips', on: false })).ok);
eq('both off: nothing again', (await pub('bob')).numbers, null);

console.log('\nDECLINE AND REFUND');
const declined = await A('declineSong', { song: 'alpha' });
ok('decline succeeds', declined.ok, declined);
alpha = declined.stage.songs.find((s) => s.id === 'alpha');
bravo = declined.stage.songs.find((s) => s.id === 'bravo');
eq('the declined song is hidden and empty', [alpha.active, alpha.votes, alpha.paidVotes], [false, 0, 0]);
eq('another song keeps its votes and paid attribution', [bravo.votes, bravo.paidVotes], [2, 1]);

const ann = await pub('ann');
const bob = await pub('bob');
eq('Ann gets Alpha’s four credits back', [ann.credits.used, ann.credits.remaining, ann.credits.paidLeft], [1, 4, 2]);
eq('Bob gets his free vote back', [bob.credits.used, bob.credits.remaining], [0, 2]);
const fans = await readFans(DEFAULT_ARTIST);
eq('only Bravo remains on Ann’s ballot', fans.ann.v, ['bravo']);

const retry = await A('declineSong', { song: 'alpha' });
ok('retry is harmless and succeeds', retry.ok, retry);
eq('retry cannot mint more credits', (await pub('ann')).credits.remaining, 4);
eq('the hidden song cannot receive a new vote', (await send({ fan: 'bob', song: 'alpha', n: 1, cast: 'declinecast00004' })).status, 404);

console.log('\nA LOST SHARD WRITE IS REPORTED AND RECOVERABLE');
ok('Cara casts two on Charlie', (await send({ fan: 'cara', song: 'charlie', n: 2, cast: 'declinecast00005' })).ok);
__failWrites(/^f\d+_/);
const interrupted = await A('declineSong', { song: 'charlie' });
__failWrites(null);
eq('an acknowledged-but-lost refund does not report success', interrupted.status, 503);
eq('nothing was falsely returned', (await pub('cara')).credits.used, 2);
ok('repeating the action completes the pending refund', (await A('declineSong', { song: 'charlie' })).ok);
eq('and returns the credits exactly once', [(await pub('cara')).credits.used, (await pub('cara')).credits.remaining], [0, 2]);

console.log('\nTHE TWO SCREENS SAY AND SHOW IT');
ok('audience heading has the requested copy', /Vote your favorite songs below/.test(votePage));
ok('played songs carry the exact replay note', /already played \(pay to request again\)/.test(votePage));
/* the ring is the brand gradient since 2026-09-13: a box with a real border paints
   var(--grad) to its border box, a box without one draws it with ::after */
ok('the search, sort control, and voting list wear the brand-gradient ring',
  /search input[\s\S]{0,260}var\(--grad\) border-box/.test(votePage) &&
  /\.sortbar::after\{[^}]*var\(--grad\)/.test(votePage) &&
  /\.list\.votelist[\s\S]{0,360}var\(--grad\) border-box/.test(votePage));
ok('the vote-pack sheet uses first-name-only pink-orange copy',   // "<First> will receive through Stripe Connect" since 2026-09-13
  /lede buyline[^>]*>\$\{esc\(artistFirst\('The artist'\)\)\} will receive through Stripe Connect/.test(votePage) && /fine secure-votes/.test(votePage));
ok('the Studio renders paid-vote pills and the decline action',
  /paidVotes/.test(studioPage) && /Paid votes: \$\{x\.paidVotes\}/.test(studioPage) && /Decline \+ refund votes/.test(studioPage));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
