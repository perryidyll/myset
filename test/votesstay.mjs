/* A VOTE STAYS ON THE SONG IT WAS CAST FOR.

   Perry, 2026-09-07: "the votes do NOT go back to the audience members whose songs
   were not chosen. They stay attached to the song you voted for, and that song stays
   in the queue until it is played or the show is over. If they paid for votes and
   their song doesn't get played, they lose the money and the votes — that's the whole
   game. But they don't really lose, because they're tipping the artist, and that's
   the point."

   Until that day the opposite was true, and it was one line doing it:
   `clearAllFanVotes` wiped every fan's votes each time a song started. The board went
   back to zero every few minutes, free credits appeared to refresh, and a song nobody
   started never accumulated anything. This file is the rule stated as behaviour,
   because it is the kind of change that a later "tidy-up" could quietly undo.

   The other suites carry the same rule from their own angles — credits.mjs for the
   money, finality.mjs for what a fan cannot undo. This one is about the QUEUE. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin  = (await import('../netlify/functions/admin.mjs')).default;
const showFn = (await import('../netlify/functions/show.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const { readFans } = await import('../netlify/functions/_lib.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body) => {
  const r = await h(new Request(url, body === undefined ? {} : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const A    = (action, extra = {}) => hit(admin, 'https://x/api/admin?code=devlocal', { action, ...extra });
const pub  = (fan) => hit(showFn, `https://x/api/show?fan=${fan}`);
const cast = (fan, song, n = 1) => hit(voteFn, 'https://x/api/vote', { fan, song, n, op: 'cast' });
const votesOn = async (fan, id) =>
  (((await readFans('perry-idyll'))[fan] || {}).v || []).filter((x) => x === id).length;
const boardOf = async (id) => {
  const d = await pub('watcher');
  const s = (d.songs || []).concat(d.played || []).find((x) => x.id === id);
  return s ? (s.votes || 0) : null;
};

console.log('\nSETUP  six songs, ten free votes each');
for (const t of ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'])
  await A('addSong', { title: t, artist: 'T' });
await A('freeCredits', { n: 10 });
await A('status', { status: 'live' });
eq('ten free votes', (await pub('x')).credits.total, 10);

console.log('\nA VOTE SURVIVES EVERY SONG THAT IS NOT ITS OWN');
await cast('ann', 'foxtrot', 4);
eq('four on foxtrot', await boardOf('foxtrot'), 4);
/* Four songs go by. Under the old rule ann's four votes were gone after the first
   one, and she had ten fresh credits every time. */
for (const id of ['alpha', 'bravo', 'charlie', 'delta']) await A('play', { song: id });
eq('four songs later, her votes are still on foxtrot', await votesOn('ann', 'foxtrot'), 4);
eq('and the board still shows them', await boardOf('foxtrot'), 4);
eq('she has six credits left, not ten', (await pub('ann')).credits.remaining, 6);
eq('and six is what she has for the rest of the night', (await pub('ann')).credits.used, 4);

console.log('\nSO THE QUEUE BUILDS UP INSTEAD OF STARTING AGAIN');
/* THE POINT OF THE WHOLE CHANGE. Three people put votes on foxtrot across the
   evening, at moments that used to be separate contests. Under the old rule those
   votes never met each other. */
await cast('bob', 'foxtrot', 3);
await A('play', { song: 'echo' });
await cast('cat', 'foxtrot', 2);
eq('nine votes from three people, cast across four songs', await boardOf('foxtrot'), 9);
const top = (await pub('x')).songs.filter((s) => !s.now)[0];
eq('and it is what the room wants next', top.id, 'foxtrot');

console.log('\nAND ITS OWN SONG IS THE ONE THING THAT TAKES IT');
await A('play', { song: 'foxtrot' });
eq('ann’s votes are gone', await votesOn('ann', 'foxtrot'), 0);
eq('so are bob’s', await votesOn('bob', 'foxtrot'), 0);
eq('and cat’s', await votesOn('cat', 'foxtrot'), 0);
eq('but ann is no better off for it', (await pub('ann')).credits.remaining, 6);
eq('and neither is bob', (await pub('bob')).credits.remaining, 7);

console.log('\nNONE OF THE ORDINARY EXIT PATHS GIVE A CREDIT BACK');
await A('newShow');
await A('freeCredits', { n: 10 });
await A('status', { status: 'live' });
const spent = async (fan) => (await pub(fan)).credits.used;
await cast('dee', 'alpha', 2);
await cast('dee', 'bravo', 2);
await cast('dee', 'charlie', 2);
eq('six spent across three songs', await spent('dee'), 6);
await A('play', { song: 'alpha' });            // her song wins
eq('winning gives nothing back', await spent('dee'), 6);
await A('toggleSong', { song: 'bravo' });      // the artist hides one
eq('hiding gives nothing back', await spent('dee'), 6);
await A('removeSong', { song: 'charlie' });    // the artist deletes another
eq('deleting gives nothing back', await spent('dee'), 6);
await A('status', { status: 'ended' });
eq('and ending the show gives nothing back', await spent('dee'), 6);

console.log('\nWHAT A FAN IS OWED IS BEING TOLD, AND THEY ARE');
/* The design is only fair if nobody finds out afterwards. Check the approved
   wording as text that actually ships. */
const { readFileSync } = await import('node:fs');
const page = readFileSync(new URL('../public/vote.html', import.meta.url), 'utf8');
ok('the sheet says how many they have right now', /vote\$\{c\.remaining===1\?'':'s'\} right now/.test(page));
ok('that a vote cannot be changed', /can.{0,6}t be changed<\/b>/.test(page));
ok('that it does not come back', /don.{0,6}t come back<\/i><\/b>/.test(page));
ok('the warning under Confirm agrees with all of it',
   /Votes can.{0,6}t be changed!/.test(page));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
