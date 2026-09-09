/* An artist may decline an unplayed song and return exactly the credits attached
   to it. Paid-vote attribution is stored per vote so another song's paid spend is
   never refunded by mistake. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin = (await import('../netlify/functions/admin.mjs')).default;
const showFn = (await import('../netlify/functions/show.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const { mutateFan, readFans, DEFAULT_ARTIST } = await import('../netlify/functions/_lib.mjs');
const { __failWrites } = await import('./blobs-fake.mjs');
const { readFileSync } = await import('node:fs');
const votePage = readFileSync(new URL('../public/vote.html', import.meta.url), 'utf8');
const studioPage = readFileSync(new URL('../public/studio.html', import.meta.url), 'utf8');

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

console.log('\nDECLINE AND REFUND');
const declined = await A('declineSong', { song: 'alpha' });
ok('decline succeeds', declined.ok, declined);
alpha = declined.stage.songs.find((s) => s.id === 'alpha');
bravo = declined.stage.songs.find((s) => s.id === 'bravo');
eq('the declined song is hidden and empty', [alpha.active, alpha.votes, alpha.paidVotes], [false, 0, 0]);
eq('another song keeps its vote and paid attribution', [bravo.votes, bravo.paidVotes], [1, 1]);

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
ok('the search, sort control, and voting list use the orange border',
  /search input[\s\S]{0,220}accent-2/.test(votePage) &&
  /\.sortbar[\s\S]{0,180}accent-2/.test(votePage) &&
  /\.list\.votelist[\s\S]{0,320}accent-2/.test(votePage));
ok('the vote-pack sheet uses first-name-only orange copy',
  /lede buyline[^>]*>goes straight to \$\{esc\(artistFirst/.test(votePage) && /fine secure-votes/.test(votePage));
ok('the Studio renders paid-vote pills and the decline action',
  /paidVotes/.test(studioPage) && /paid votes/.test(studioPage) && /Decline \+ refund votes/.test(studioPage));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
