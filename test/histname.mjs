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
const { createArtist, signToken, readArtists, revOf, mutateArtists } = await import('../netlify/functions/_auth.mjs');
const { archiveShow, readHistIndex, readHistShow, healHistory, placeShows, reconcileShow } = await import('../netlify/functions/_history.mjs');
const { __stripe } = await import('./stripe-fake.mjs');
const admin = (await import('../netlify/functions/admin.mjs')).default;
const { casDoc, KEY } = await import('../netlify/functions/_lib.mjs');

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
   as its title, a few songs in the log — and, since 0065, the gig the lifecycle
   stamped on it (`autoKey`), which the archive copies as `key`. */
const play = (n) => Array.from({ length: n }, (_, i) => ({
  songId: 's' + i, title: 'Song ' + i, artist: '', at: NOW - 2 * H + i * 300e3, votes: 3, roundVotes: 3, voters: 4, round: [] }));
const night = (songs, extra = {}) => ({
  showId: 'hand-1', venue: '', city: '', startedAt: NOW - 2 * H, autoKey: 'ghand@2026-09-12',
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
  /* READING a filed night is a Bar Star feature since 2026-09-13 (decision 0060);
     the rename above landed on a free plan because it is a write, not a report. */
  const shut = await hit(history, 'https://x/api/history?show=hand-1', undefined, TM);
  eq('on the free plan the night cannot be opened — data reports are Bar Star', shut.status, 402);
  const shutList = await hit(history, 'https://x/api/history', undefined, TM);
  ok('and the list comes back locked, with the count and no rows',
     shutList.ok && shutList.locked === 'plus' && shutList.nights === 1 && shutList.shows.length === 0, shutList);
  await mutateArtists((reg) => { reg.byId[mo.artistId].plan = 'plus'; return true; });
  const one = await hit(history, 'https://x/api/history?show=hand-1', undefined, TM);
  eq('on Bar Star, opening the night from the Studio agrees', one.show.title, 'Friday at the pier');
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
  await archiveShow(mo.artistId, night(3, { showId: 'hand-2', autoKey: null, archiveTitle: 'First name' }), {});
  await archiveShow(mo.artistId, night(6, { showId: 'hand-2', autoKey: null, archiveTitle: 'Second name' }), {});
  eq('a night nobody renamed follows the richer archive’s title', (await readHistShow(mo.artistId, 'hand-2')).title, 'Second name');
}

console.log('\nA FILED NIGHT KNOWS WHICH GIG IT WAS, AND WHETHER ITS MONEY IS KNOWN  (0065)');
{
  const doc = await readHistShow(mo.artistId, 'hand-1');
  eq('the detail carries the key the lifecycle stamped', doc.key, 'ghand@2026-09-12');
  eq('and so does the row', (await row(mo.artistId, 'hand-1')).key, 'ghand@2026-09-12');
  eq('the row says where its money came from — no Stripe key here, so "off"', (await row(mo.artistId, 'hand-1')).source, 'off');
  eq('a night the calendar never claimed files null', (await row(mo.artistId, 'hand-2')).key, null);
  /* The heal rebuilds a row from the detail: a row restored from histpend_ keeps
     the key, and a row filed before 0065 has `source` filled in on the next plain
     heal — `source` is in ROW_TOPS, `key` deliberately is not. */
  await casDoc(KEY.histIdx(mo.artistId), () => ({ shows: [] }), (d) => { d.shows = d.shows.filter((r) => r.showId !== 'hand-1'); return true; });
  await casDoc(`histpend_${mo.artistId}`, () => ({ ids: [] }), (d) => { d.ids = ['hand-1']; return true; });
  eq('the row is gone', (await row(mo.artistId, 'hand-1')).key, undefined);
  eq('the heal restores it', (await healHistory(mo.artistId, { force: true })).added, 1);
  eq('with its key', (await row(mo.artistId, 'hand-1')).key, 'ghand@2026-09-12');
  await casDoc(KEY.histIdx(mo.artistId), () => ({ shows: [] }), (d) => { for (const r of d.shows) delete r.source; return true; });
  eq('a row with no source re-opens a plain heal', (await healHistory(mo.artistId)).fixed, 2);
  eq('which back-fills it', (await row(mo.artistId, 'hand-1')).source, 'off');
  eq('and then retires', (await healHistory(mo.artistId)).skipped, true);
  /* placeShows stamps the key it proves, so nights filed before the lifecycle
     stamped one migrate to an exact join the first time the artist taps "Name
     these from my calendar". hand-2 has none; a gig was running when it started. */
  const st = new Date(NOW - 2 * H);
  const p2 = (n) => String(n).padStart(2, '0');
  ok('a gig on the calendar when hand-2 started', (await hit(admin, 'https://x/api/admin', { action: 'eventSave', event: {
    id: 'gpier', venue: 'The Pier', city: 'Koh Phangan', country: 'Thailand', tz: 'UTC',
    date: st.toISOString().slice(0, 10), time: `${p2(st.getUTCHours())}:${p2(st.getUTCMinutes())}`,
    endTime: `${p2((st.getUTCHours() + 3) % 24)}:${p2(st.getUTCMinutes())}` } }, TM)).ok);
  /* hand-3: already at the right venue, only missing its key — a stamp, not a
     rename, and the reply must say which, because the Studio toasts "Renamed N
     nights" from `placed`. */
  await archiveShow(mo.artistId, night(2, { showId: 'hand-3', autoKey: null, venue: 'The Pier', archiveTitle: 'Pier again' }), {});
  const placed = await placeShows(mo.artistId);
  ok('placing runs', placed.ok && placed.placed >= 1, placed);
  const key2 = `gpier@${st.toISOString().slice(0, 10)}`;
  eq('hand-2 is stamped with the gig it was under', (await row(mo.artistId, 'hand-2')).key, key2);
  eq('on the detail too', (await readHistShow(mo.artistId, 'hand-2')).key, key2);
  eq('and named after it', (await row(mo.artistId, 'hand-2')).venue, 'The Pier');
  eq('hand-1 keeps the key the scheduler gave it — a stamp beats a time window', (await row(mo.artistId, 'hand-1')).key, 'ghand@2026-09-12');
  eq('hand-3 gains its key too', (await row(mo.artistId, 'hand-3')).key, key2);
  // three nights touched: hand-1 and hand-2 renamed (hand-1 keeps its own key), hand-2 and hand-3 keyed
  eq('hand-3 is not counted as renamed — it was already at The Pier', [placed.placed, placed.keyed], [2, 2]);
  eq('running it again changes nothing', [(await placeShows(mo.artistId)).placed, (await placeShows(mo.artistId)).keyed], [0, 0]);
}

console.log('\nRE-CHECK CLEARS "APP MONEY NOT AVAILABLE" ON THE ROW TOO  (0065)');
{
  /* The dashboard reads `source` off the index ROW. A night archived while Stripe
     was unreachable — nine of the founder's nineteen real nights in the 2026-09-12
     backup — stays "app money not available" until the artist taps Re-check, which
     re-pulls Stripe and rewrote the detail's money block but copied only `gross`
     onto the row. So the row never learned, the gross never joined profit, and the
     button was offered again for ever. */
  const { casDoc: cas } = await import('../netlify/functions/_lib.mjs');
  await cas(`hist_${mo.artistId}_hand-1`, () => ({}), (d) => { d.money = { ...(d.money || {}), gross: 0, source: 'stripe-unreachable' }; return true; });
  await cas(KEY.histIdx(mo.artistId), () => ({ shows: [] }), (d) => { const r = d.shows.find((x) => x.showId === 'hand-1'); r.gross = 0; r.source = 'stripe-unreachable'; return true; });
  eq('the night is on file as unreachable', (await row(mo.artistId, 'hand-1')).source, 'stripe-unreachable');
  ok('a night filed without Stripe answering has no paid counts — unknown, not zero', (await row(mo.artistId, 'hand-1')).paidVotes == null);
  const started = (await readHistShow(mo.artistId, 'hand-1')).startedAt;
  __stripe.sessions.set('cs_hand1', { onAccount: '', session: { id: 'cs_hand1', mode: 'payment', payment_status: 'paid',
    created: Math.floor(started / 1000) + 600, amount_total: 500, metadata: { kind: 'tip', artist: mo.artistId, show: 'hand-1' } } });
  /* What the room paid for, on the same night: a ten-vote pack, a five-vote song
     pack and an accepted paid request — the three counts the dashboard lists. */
  __stripe.sessions.set('cs_hand1v', { onAccount: '', session: { id: 'cs_hand1v', mode: 'payment', payment_status: 'paid',
    created: Math.floor(started / 1000) + 700, amount_total: 1000, metadata: { kind: 'votes', votes: '10', artist: mo.artistId, show: 'hand-1' } } });
  __stripe.sessions.set('cs_hand1s', { onAccount: '', session: { id: 'cs_hand1s', mode: 'payment', payment_status: 'paid',
    created: Math.floor(started / 1000) + 800, amount_total: 500, metadata: { kind: 'song_votes', votes: '5', artist: mo.artistId, show: 'hand-1' } } });
  __stripe.sessions.set('cs_hand1r', { onAccount: '', session: { id: 'cs_hand1r', mode: 'payment', payment_status: 'paid',
    created: Math.floor(started / 1000) + 900, amount_total: 500, metadata: { kind: 'request_hold', artist: mo.artistId, show: 'hand-1' } } });
  process.env.STRIPE_SECRET_KEY = 'sk_test_notreal_forlocaltestsonly';   // this time Stripe answers
  const re = await reconcileShow(mo.artistId, 'hand-1');
  delete process.env.STRIPE_SECRET_KEY;
  eq('the re-check hears from Stripe', [re.money.source, re.money.gross], ['stripe', 25]);
  eq('the money block counts the votes bought and the requests accepted', [re.money.votes.paid, re.money.requests.count, re.money.requests.amount], [15, 1, 5]);
  eq('the tip is a tip, the request is not', [re.money.tips.count, re.money.votes.count], [1, 3]);
  const doc = await readHistShow(mo.artistId, 'hand-1');
  eq('the detail carries the answer', doc.money.source, 'stripe');
  const r = await row(mo.artistId, 'hand-1');
  eq('and so does the row the dashboard reads — source equals the detail\'s', r.source, doc.money.source);
  eq('with the gross', r.gross, 25);
  eq('and the paid counts, so the editor can say what the room paid for', [r.paidVotes, r.paidRequests], [15, 1]);
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


console.log('\nHIDING A NIGHT ("Delete show" on the Money tab, 2026-09-17)');
{
  const hide = (token, show) => hit(history, 'https://x/api/history', { action: 'hide', show }, token);
  const list = async (token) => (await hit(history, 'https://x/api/history', undefined, token)).shows || [];
  ok('the night is listed before', (await list(TM)).some((x) => x.showId === 'hand-1'));
  const r = await hide(TM, 'hand-1');
  ok('hiding answers ok', r.ok && r.hidden === true, r);
  ok('and the night is gone from the list', !(await list(TM)).some((x) => x.showId === 'hand-1'));
  eq('but the row is still on the index, flagged — nothing was destroyed', (await row(mo.artistId, 'hand-1')).hidden, true);
  ok('and the detail document is untouched', !!(await readHistShow(mo.artistId, 'hand-1')));
  eq('another artist cannot hide it', (await hide(TA, 'hand-1')).status, 404);
  eq('nor a night that does not exist', (await hide(TM, 'nope')).status, 404);
  ok('hiding twice is fine', (await hide(TM, 'hand-1')).ok);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
