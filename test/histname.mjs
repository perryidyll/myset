/* NAMING A NIGHT BY HAND  (_history.mjs, history.mjs, decision 0057)

   A show started from the Live tab is filed under whatever venue was typed, or as
   "Untitled show – <date>" when nothing was; placeShows only renames what the
   calendar can prove. The founder asked (2026-09-12) to be able to tap the title
   on the Money tab and type what the night was called. This pins what that is:

     · the detail document AND the index row both carry the new name
     · an empty name is refused, an unknown night is 404
     · another artist's token cannot reach it — their key, their document, not there
     · a re-archive with a RICHER snapshot keeps the hand-typed name (archiveShow
       replaces the detail with the richer one; the name must survive that)
     · the name is cut at 100 characters, and the reply says what was kept */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const history = (await import('../netlify/functions/history.mjs')).default;
const { createArtist, signToken, readArtists, revOf } = await import('../netlify/functions/_auth.mjs');
const { archiveShow, readHistIndex, readHistShow } = await import('../netlify/functions/_history.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body, token) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const rename = (token, show, title) => hit(history, 'https://x/api/history', { action: 'rename', show, title }, token);
const row = async (aid, id) => (await readHistIndex(aid)).shows.find((x) => x.showId === id) || {};

const H = 3600e3, NOW = Date.now();
/* A night the way endShow files a hand-started one: no venue, the dated fallback
   as its title, a few songs in the log. */
const play = (n) => Array.from({ length: n }, (_, i) => ({
  songId: 's' + i, title: 'Song ' + i, artist: '', at: NOW - 2 * H + i * 300e3, votes: 3, roundVotes: 3, voters: 4, round: [] }));
const night = (songs, extra = {}) => ({
  showId: 'hand-1', venue: '', city: '', startedAt: NOW - 2 * H,
  songs: play(songs).map((p) => ({ id: p.songId, title: p.title })),
  log: play(songs), nowPlaying: null, archiveTitle: 'Untitled show – 2026-09-12', ...extra });

console.log('\nSETUP  an artist with one hand-started night on file, and a second artist');
const mo = await createArtist({ email: 'mo@example.com', name: 'Mo Vale', slug: 'mo-vale' });
const TM = await signToken('mo@example.com', revOf(await readArtists(), mo.artistId));
const other = await createArtist({ email: 'ann@example.com', name: 'Ann Other', slug: 'ann-other' });
const TA = await signToken('ann@example.com', revOf(await readArtists(), other.artistId));
const filed = await archiveShow(mo.artistId, night(5), {});
ok('the night is filed', filed && filed.stored && filed.indexed, filed && { stored: filed.stored, indexed: filed.indexed });
eq('under the dated fallback, since nothing was typed', (await row(mo.artistId, 'hand-1')).title, 'Untitled show – 2026-09-12');

console.log('\nTHE NAME LANDS ON THE DETAIL AND THE ROW');
{
  const r = await rename(TM, 'hand-1', '  Friday   at the pier ');
  ok('the rename is accepted', r.ok && r.status === 200, r);
  eq('and the reply says what was kept, whitespace folded', r.title, 'Friday at the pier');
  const doc = await readHistShow(mo.artistId, 'hand-1');
  eq('the detail document carries it', doc.title, 'Friday at the pier');
  eq('stamped as typed by hand', doc.titleByHand, true);
  eq('and so does the index row the Money tab lists', (await row(mo.artistId, 'hand-1')).title, 'Friday at the pier');
  const one = await hit(history, 'https://x/api/history?show=hand-1', undefined, TM);
  eq('opening the night from the Studio agrees', one.show.title, 'Friday at the pier');
  const list = await hit(history, 'https://x/api/history', undefined, TM);
  eq('and so does the list the Studio reads', (list.shows || []).map((x) => x.title), ['Friday at the pier']);
  eq('nothing but the name moved: the songs are still there', doc.stats.songsPlayed, 5);
}

console.log('\nWHAT IS REFUSED');
{
  const r = await rename(TM, 'hand-1', '   ');
  eq('an empty name is a 400', r.status, 400);
  ok('and says so in words', /name/i.test(r.error || ''), r);
  const r2 = await rename(TM, 'no-such-night', 'Anything');
  eq('an unknown night is a 404', r2.status, 404);
  const r3 = await rename(TA, 'hand-1', 'Mine now');
  eq('another artist’s token gets a 404 — it is not their document', r3.status, 404);
  eq('and the name did not move', (await readHistShow(mo.artistId, 'hand-1')).title, 'Friday at the pier');
  const r4 = await hit(history, 'https://x/api/history', { action: 'rename', show: 'hand-1', title: 'Nope' });
  eq('no token at all is a 401', r4.status, 401);
}

console.log('\nA RICHER RE-ARCHIVE KEEPS THE HAND-TYPED NAME');
{
  /* The artist ended by accident, carried on for eight more songs and ended again.
     archiveShow replaces the five-song snapshot with the thirteen-song one — and
     the title on that snapshot is the dated fallback again. */
  const again = await archiveShow(mo.artistId, night(13, { archiveTitle: 'Untitled show – 2026-09-12' }), {});
  ok('the richer snapshot is taken', again && again.stored, again && again.stored);
  const doc = await readHistShow(mo.artistId, 'hand-1');
  eq('the detail now has all thirteen songs', doc.stats.songsPlayed, 13);
  eq('and STILL the name the artist typed', doc.title, 'Friday at the pier');
  eq('still marked as by hand', doc.titleByHand, true);
  eq('the index row keeps the name too', (await row(mo.artistId, 'hand-1')).title, 'Friday at the pier');
  eq('with the richer count', (await row(mo.artistId, 'hand-1')).songsPlayed, 13);
  /* And a night that was NOT renamed still takes the archive's title on a richer
     re-archive — the protection is only for names typed by hand. */
  await archiveShow(mo.artistId, night(3, { showId: 'hand-2', archiveTitle: 'First name' }), {});
  await archiveShow(mo.artistId, night(6, { showId: 'hand-2', archiveTitle: 'Second name' }), {});
  eq('a night nobody renamed follows the richer archive’s title', (await readHistShow(mo.artistId, 'hand-2')).title, 'Second name');
}

console.log('\nTHE NAME IS CUT AT 100 CHARACTERS');
{
  const long = 'x'.repeat(140);
  const r = await rename(TM, 'hand-1', long);
  ok('accepted', r.ok, r);
  eq('the reply carries the cut name', r.title.length, 100);
  eq('the detail has 100 characters', (await readHistShow(mo.artistId, 'hand-1')).title.length, 100);
  eq('and so does the row', (await row(mo.artistId, 'hand-1')).title.length, 100);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
