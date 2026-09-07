/* WHAT A FAN SEES WHEN NOTHING IS HAPPENING, AND THE TEN-SECOND LAST CALL.

   Two things Perry asked for on 2026-09-07, both about the same page.

   1. Between shows the room is DARK. Somebody who opens the page when no show is
      running was being shown the LAST one — its votes, its running order, its
      "Playing now", and the songs it had already played missing from the list. All
      true of a night that is over; all wrong for the person holding the phone. They
      should see the SETLIST, whole and quiet.

      The dangerous half is what must NOT happen: none of this may delete anything.
      "Resume it instead" has to find the night exactly as the artist left it, so this
      is display and only display, and the cases below check the record afterwards.

   2. Last call — the artist taps a button and every phone gets a ten-second box. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin  = (await import('../netlify/functions/admin.mjs')).default;
const showFn = (await import('../netlify/functions/show.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const { getShow, COUNTDOWN_MS } = await import('../netlify/functions/_lib.mjs');

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

console.log('\nSETUP  a night that happened');
for (const t of ['Alpha', 'Bravo', 'Charlie', 'Delta']) await A('addSong', { title: t, artist: 'T' });
await A('freeCredits', { n: 10 });
await A('status', { status: 'live' });
await cast('ann', 'charlie', 3);
await cast('bob', 'delta', 2);
await A('play', { song: 'alpha' });          // alpha is now playing, and played
await A('play', { song: 'bravo' });          // alpha joins played[], bravo is playing
{
  const d = await pub('ann');
  eq('mid-show she sees what is playing', (d.nowPlaying || {}).id, 'bravo');
  eq('and a song already played', (d.played || []).map((x) => x.id), ['alpha']);
  eq('and her three votes on charlie',
     ((d.songs || []).find((x) => x.id === 'charlie') || {}).votes, 3);
}

console.log('\nTHE SHOW ENDS, AND THE ROOM GOES DARK');
await A('status', { status: 'ended' });
{
  const d = await pub('ann');
  eq('nothing claims to be playing', d.nowPlaying, null);
  eq('nothing is in the played list', d.played, []);
  eq('THE WHOLE SETLIST IS BACK, including the two that were played',
     (d.songs || []).map((x) => x.id).sort(), ['alpha', 'bravo', 'charlie', 'delta']);
  eq('with no votes on any of it',
     (d.songs || []).reduce((n, x) => n + (x.votes || 0), 0), 0);
  ok('and none of it is marked as hers', (d.songs || []).every((x) => !x.mine && !x.mineCount));
  /* A song in `played[]` costs replayCost to ask for again. Quoting last night's
     price for a song tonight's room has not heard would be its own small lie. */
  ok('and every song is back to costing one', (d.songs || []).every((x) => x.cost === 1));
}

console.log('\nBUT NOTHING WAS DELETED  ("Resume it instead" still has to work)');
{
  const sh = await getShow('perry-idyll');
  eq('the show record still knows what was played', sh.played, ['alpha']);
  eq('and what was on stage', sh.nowPlaying, 'bravo');
  await A('status', { status: 'live' });
  const d = await pub('ann');
  eq('so resuming brings the night straight back', (d.nowPlaying || {}).id, 'bravo');
  eq('with its played list', (d.played || []).map((x) => x.id), ['alpha']);
  eq('and her votes still standing',
     ((d.songs || []).find((x) => x.id === 'charlie') || {}).votes, 3);
}

console.log('\nA SHOW THAT HAS NEVER STARTED IS DARK TOO');
await A('status', { status: 'pre' });
{
  const d = await pub('cat');
  eq('four songs, no votes, nothing playing',
     [(d.songs || []).length, (d.played || []).length, d.nowPlaying], [4, 0, null]);
}

console.log('\nLAST CALL  ten seconds, on every phone');
eq('it is refused while no show is running', (await A('countdown')).status, 409);
await A('status', { status: 'live' });
eq('nothing is counting down to start with', (await pub('ann')).countdownIn, 0);
const fired = await A('countdown');
ok('the artist can fire it', fired.ok, fired);
{
  const d = await pub('ann');
  ok(`the room is told how long is LEFT, not when it ends — ${d.countdownIn}ms`,
     d.countdownIn > COUNTDOWN_MS - 2000 && d.countdownIn <= COUNTDOWN_MS, d.countdownIn);
  /* Milliseconds remaining rather than a timestamp on purpose: a phone whose clock
     is four minutes fast would read an end time as long past and show nothing. */
  ok('and it is a number a phone can use without trusting its own clock',
     typeof d.countdownIn === 'number');
}
eq('voting is NOT closed by it — there is a switch for that',
   (await pub('ann')).windowOpen, true);
ok('and a fan can still vote while it runs', (await cast('cat', 'charlie', 1)).ok);

console.log('\nAND IT EXPIRES BY ITSELF');
{
  const sh = await getShow('perry-idyll');
  /* Wind the stamp back rather than waiting ten seconds in a test suite. */
  const { mutateShow } = await import('../netlify/functions/_lib.mjs');
  await mutateShow('perry-idyll', (x) => { x.countdownAt = Date.now() - 1; return true; });
  eq('an expired countdown is simply absent', (await pub('ann')).countdownIn, 0);
  await mutateShow('perry-idyll', (x) => { x.countdownAt = Date.now() + 60 * 60000; return true; });
  eq('and a nonsense one far in the future is refused, not rendered',
     (await pub('ann')).countdownIn, 0);
}

console.log('\nAND THE FOUR PAGES AGREE WITH THE SERVER');
/* Source-level, because the behaviour above is only half of each of these — the
   other half is a button existing on a page, which no handler test can see.
   tools/uicheck.mjs drives all four in a real browser; this is the cheap guard that
   runs on every deploy. */
const { readFileSync } = await import('node:fs');
const read = (f) => readFileSync(new URL('../public/' + f, import.meta.url), 'utf8');
{
  const studio = read('studio.html');
  ok('the Studio has a Last call button', /onclick="lastCall\(\)"/.test(studio));
  ok('and it is only offered while a show is running',
     /s\.status==='live'\?`<div class="wrap"[^`]*lastcall/.test(studio.replace(/\n\s*/g, '')),
     'the button must be inside the status===live branch');
  ok('and it asks the server for it', /act\('countdown'\)/.test(studio));

  const vote = read('vote.html');
  ok('the audience page has the box', /id="lastcall"/.test(vote) && /id="lcN"/.test(vote));
  ok('and reads the milliseconds left, not an end time',
     /lastCall\(Number\(d\.countdownIn\)\|\|0\)/.test(vote));
  ok('the box is fixed to the top and does not reflow the page',
     /\.lastcall\{position:fixed;top:0/.test(vote));
  ok('"More votes" carries the orange ring',
     /\.dock \.btn-buy\{box-shadow:inset 0 0 0 1\.5px var\(--accent\)\}/.test(vote));
  ok('and the dock is never hidden, so the tip is always there',
     !/dock\.hidden=true/.test(vote) && /dock\.hidden=false/.test(vote));

  const comm = read('community.html');
  ok('the community page has a tip button', /class="tipbar"/.test(comm) && /openTip\(\)/.test(comm));
  ok('only on an artist page, never a venue', /if\(!VENUE\) h\+=`<div class="tipbar"/.test(comm));
  ok('and its checkout comes back HERE, not to the voting page',
     /from:'community'/.test(comm));

  const artist = read('artist.html');
  const order = /const LABEL=\{([^}]*)\}/.exec(artist)[1].split(',').map((x) => x.split(':')[0]);
  eq('Instagram first, then the three music services', order,
     ['instagram', 'spotify', 'applemusic', 'ytmusic', 'website']);
  ok('and the links block is built before the bio',
     artist.indexOf('Listen &amp; follow') < artist.indexOf('<div class="sect">About</div>'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
