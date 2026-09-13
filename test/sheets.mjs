/* THE GOOGLE SHEET.

   Perry's sheet is the only place MySet data leaves Netlify, so the tests here are
   less about "did a row appear" and more about the four ways an export quietly
   goes wrong:

     · IT LIES BY OMISSION. A sync that half-fails and then MOVES its watermark
       loses those rows forever, and nobody notices because the sheet looks fine.
       So: a failed write must leave the watermark alone, and the next sync must
       re-send exactly what the failed one was carrying.
     · IT DUPLICATES. Run it twice and every night is in there twice, so every
       chart doubles. So: a second sync with nothing new appends nothing.
     · IT EXECUTES. A song called "=1+1" or a name starting with "+" is a real
       thing an artist will type, and Sheets runs both as formulas. So: anything
       formula-shaped comes out as text.
     · IT LEAKS. The private key is the one thing in this system that must never
       appear in a response, a log or a chat window (INVARIANT 11/11b).

   Google is stubbed at `fetch`, but everything on this side of that call is the
   real code — including RS256 signing against a key generated here, so the JWT
   path is exercised rather than mocked past. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const { generateKeyPairSync } = await import('node:crypto');
const admin = (await import('../netlify/functions/admin.mjs')).default;
const reqFn = (await import('../netlify/functions/request.mjs')).default;
const fbFn = (await import('../netlify/functions/feedback.mjs')).default;
const { createArtist, signToken, readArtists, revOf } =
  await import('../netlify/functions/_auth.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body, token) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, body === undefined ? { headers } : {
    method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};

/* ---------- a stubbed Google ---------- */
const SHEET = { tabs: new Map(), calls: [], failNext: 0, title: 'MySet data' };
const realFetch = globalThis.fetch;
function stubGoogle() {
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    SHEET.calls.push(u);
    const R = (o, status = 200) =>
      new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

    if (u.startsWith('https://oauth2.googleapis.com/token')) {
      /* Assert the assertion really is a signed JWT, not a placeholder. */
      const body = new URLSearchParams(init.body);
      const jwt = body.get('assertion') || '';
      if (jwt.split('.').length !== 3) return R({ error: 'bad assertion' }, 400);
      SHEET.lastJwt = jwt;
      return R({ access_token: 'tok', expires_in: 3600 });
    }
    if (!u.startsWith('https://sheets.googleapis.com/')) return realFetch(url, init);

    if (SHEET.failNext > 0) { SHEET.failNext--; return R({ error: { message: 'Google is having a day' } }, 500); }

    const tab = decodeURIComponent((/values\/'([^']*)'/.exec(u) || [, ''])[1].replace(/''/g, "'"));
    const payload = init.body ? JSON.parse(init.body) : {};

    if (u.includes(':batchUpdate')) {
      for (const r of payload.requests || []) {
        if (r.addSheet) SHEET.tabs.set(r.addSheet.properties.title, []);
      }
      return R({ replies: [] });
    }
    if (u.includes(':clear')) { SHEET.tabs.set(tab, []); return R({}); }
    if (u.includes(':append')) {
      const rows = SHEET.tabs.get(tab) || [];
      SHEET.tabs.set(tab, rows.concat(payload.values || []));
      return R({});
    }
    if (init.method === 'PUT') { SHEET.tabs.set(tab, payload.values || []); return R({}); }
    if (u.includes('fields=sheets.properties')) {
      return R({ properties: { title: SHEET.title },
                 sheets: [...SHEET.tabs.keys()].map((t) => ({ properties: { title: t } })) });
    }
    // a values GET — used to decide whether a log tab needs its header
    const rows = SHEET.tabs.get(tab) || [];
    return R(rows.length ? { values: [rows[0]] } : {});
  };
}
const rowsOf = (t) => SHEET.tabs.get(t) || [];
const bodyOf = (t) => rowsOf(t).slice(1);
const col = (t, name) => (rowsOf(t)[0] || []).indexOf(name);
const cellsIn = (t, name) => bodyOf(t).map((r) => r[col(t, name)]);

/* ---------- off is a state, not a failure ---------- */
console.log('\nSWITCHED OFF IS A REAL ANSWER  (the app must work fine without it)');
const W = await import('../netlify/functions/_warehouse.mjs');
const S = await import('../netlify/functions/_sheets.mjs');
delete process.env.GSHEET_ID; delete process.env.GSHEET_EMAIL; delete process.env.GSHEET_KEY;
ok('with nothing set it is off', !S.sheetsOn());
const off = await W.syncSheet();
eq('and a sync is a clean no-op', [off.ok, off.off], [false, true]);
ok('the reason names every missing setting',
   /GSHEET_ID/.test(off.error) && /GSHEET_EMAIL/.test(off.error) && /GSHEET_KEY/.test(off.error), off.error);

process.env.GSHEET_ID = 'sheet-abc'; process.env.GSHEET_EMAIL = 'bot@x.iam.gserviceaccount.com';
process.env.GSHEET_KEY = 'not-a-key';
ok('a key that is not a key says so, before any network call',
   /private key/i.test(S.sheetsOffReason() || ''), S.sheetsOffReason());

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
process.env.GSHEET_KEY = PEM;
ok('a real key switches it on', S.sheetsOn(), S.sheetsOffReason());

/* An escaped newline is what every paste path produces, and it must work too. */
process.env.GSHEET_KEY = PEM.replace(/\n/g, '\\n');
ok('and so does one with escaped newlines', S.sheetsOn(), S.sheetsOffReason());
process.env.GSHEET_KEY = PEM;

/* ---------- a night to export ---------- */
console.log('\nA NIGHT, END TO END');
stubGoogle();
const mk = async (email, name, slug) => {
  const r = await createArtist({ email, name, slug, src: 'poster-qr', ref: '' });
  const reg = await readArtists();
  return { aid: r.artistId, slug: r.slug, token: await signToken(email, revOf(reg, r.artistId)) };
};
/* perry-idyll is the founding artist — the only one allowed to run a sync. */
const P = await mk('perry@x.com', 'Perry Idyll', 'perry-idyll');
eq('the founding artist is who the store defaults to', P.aid, 'perry-idyll');
const OTHER = await mk('sam@x.com', 'Sam Vega', 'sam-vega');

const AS = (t, action, extra = {}) => hit(admin, 'https://x/api/admin', { action, ...extra }, t);
await AS(P.token, 'venue', { venue: 'The Ugly Duckling' });
await AS(P.token, 'city', { city: 'Koh Phangan' });
await AS(P.token, 'addSong', { title: 'Wonderwall', artist: 'Oasis', tags: ['singalong'] });
/* The two that Sheets would otherwise run as formulas. */
await AS(P.token, 'addSong', { title: '=1+1', artist: '+Plus Band' });
await AS(P.token, 'addSong', { title: 'Half', artist: 'Nobody' });
await AS(P.token, 'status', { status: 'live' });

const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const cast = (fan, song) => hit(voteFn, 'https://x/api/vote?a=' + P.slug, { fan, song, n: 2 });
await cast('ann', 'wonderwall');
await cast('bob', 'wonderwall');
await AS(P.token, 'play', { song: 'wonderwall' });

await AS(P.token, 'askSet', { kind: 'song', on: true });
await hit(reqFn, 'https://x/api/request?a=' + P.slug, { fan: 'cara', kind: 'song', title: 'Zombie', artist: 'Cranberries' });
await hit(fbFn, 'https://x/api/feedback?a=' + P.slug, { fan: 'ann', stars: 5, note: 'brilliant idea' });
await AS(P.token, 'eventSave', { event: { venue: 'The Ugly Duckling', city: 'Koh Phangan',
                                 country: 'Thailand', date: isoIn(7), time: '20:00',
                                 tz: 'Asia/Bangkok' } });
await AS(P.token, 'status', { status: 'ended' });

const r1 = await W.syncSheet();
ok('the sync runs', r1.ok, r1);
eq('and made all nine tabs', (r1.made || []).length, 9);
ok('the token was a real signed JWT', (SHEET.lastJwt || '').split('.').length === 3);

console.log('\nARTISTS  — the marketing tab');
eq('one row per artist', bodyOf('Artists').length, 2);
ok('the founding artist is in it', cellsIn('Artists', 'Name').includes('Perry Idyll'));
eq('with the plan they are on', cellsIn('Artists', 'Plan')[0], 'free');
eq('and where they signed up from', cellsIn('Artists', 'Signed up from')[0], 'poster-qr');
ok('their email is there, because it is his own CRM',
   cellsIn('Artists', 'Email').includes('perry@x.com'));
eq('nights played', cellsIn('Artists', 'Nights played')[0], 1);
eq('songs kept', cellsIn('Artists', 'Songs kept')[0], 3);

console.log('\nSHOWS  — one immutable row per night');
eq('the night is there once', bodyOf('Shows').length, 1);
eq('at the right venue', cellsIn('Shows', 'Venue')[0], 'The Ugly Duckling');
eq('with the songs it played', cellsIn('Shows', 'Songs played')[0], 1);
eq('and the votes it took', cellsIn('Shows', 'Votes')[0], 4);
eq('money says "off" rather than pretending a zero is a fact',
   cellsIn('Shows', 'Money source')[0], 'off');

console.log('\nSONGS  — the product-improvement tab');
eq('every song in the library', bodyOf('Songs').length, 3);
eq('with how often it was played', cellsIn('Songs', 'Times played')[0], 1);
eq('and what it pulled', cellsIn('Songs', 'Votes all time')[0], 4);
ok('a song called "=1+1" is TEXT, not a formula',
   cellsIn('Songs', 'Song').includes("'=1+1"), cellsIn('Songs', 'Song'));
ok('and so is an artist called "+Plus Band"',
   cellsIn('Songs', 'Original artist').includes("'+Plus Band"), cellsIn('Songs', 'Original artist'));

console.log('\nREQUESTS  — what to learn next');
eq('the ask is logged', cellsIn('Requests', 'Asked for'), ['Zombie']);
eq('with what it cost the fan in votes', cellsIn('Requests', 'Cost in votes')[0], 3);

console.log('\nRATINGS, GIGS, GROWTH');
eq('the rating is logged', cellsIn('Ratings', 'Stars'), [5]);
eq('and what they actually said', cellsIn('Ratings', 'What they said'), ['brilliant idea']);
ok('the future gig is in the calendar tab',
   cellsIn('Gigs', 'Past or future').includes('upcoming'), bodyOf('Gigs'));
eq('growth has one row', bodyOf('Growth').length, 1);
eq('counting both artists', cellsIn('Growth', 'Artists')[0], 2);
/* EVERY NUMBER IN GROWTH IS A RUNNING TOTAL, not this sync's delta. It is the tab
   somebody charts, and a column that flips between "how much there is" and "how
   much arrived" makes that line meaningless. The first draft put the string "+1"
   in the Requests column, which is both a delta and not a number. */
eq('requests is the total, as a number', cellsIn('Growth', 'Requests')[0], 1);
eq('ratings likewise', cellsIn('Growth', 'Ratings')[0], 1);
eq('and the average is real, not blank', cellsIn('Growth', 'Average stars')[0], 5);
ok('rows added this sync is its OWN column',
   col('Growth', 'Rows added this sync') >= 0 &&
   col('Growth', 'Rows added this sync') !== col('Growth', 'Requests'));
eq('every Growth cell is as wide as the header',
   bodyOf('Growth').every((r) => r.length === rowsOf('Growth')[0].length), true);
eq('and so is every Artists row',
   bodyOf('Artists').every((r) => r.length === rowsOf('Artists')[0].length), true);
ok('the guide got written', bodyOf('Guide').length > 10);

/* ---------- the four ways an export goes wrong ---------- */
console.log('\nRUN IT AGAIN: NOTHING NEW MUST MEAN NOTHING ADDED');
const before = { shows: bodyOf('Shows').length, reqs: bodyOf('Requests').length,
                 rat: bodyOf('Ratings').length, guide: bodyOf('Guide').length };
const r2 = await W.syncSheet();
ok('the second sync runs', r2.ok, r2);
eq('no duplicate night', bodyOf('Shows').length, before.shows);
eq('no duplicate request', bodyOf('Requests').length, before.reqs);
eq('no duplicate rating', bodyOf('Ratings').length, before.rat);
eq('the guide is not rewritten', bodyOf('Guide').length, before.guide);
eq('but growth gains a row, because that is what it is for', bodyOf('Growth').length, 2);
eq('and the snapshot tabs are still one row per artist', bodyOf('Artists').length, 2);

console.log('\nA FAILED WRITE MUST NOT MOVE THE WATERMARK  (this is the one that loses data)');
await hit(fbFn, 'https://x/api/feedback?a=' + P.slug, { fan: 'cat', stars: 4, note: 'good fun' });
SHEET.failNext = 99;
const boom = await W.syncSheet().catch((e) => ({ ok: false, threw: String(e.message || e) }));
ok('the sync fails loudly', !boom.ok, boom);
SHEET.failNext = 0;
const r3 = await W.syncSheet();
ok('the next one succeeds', r3.ok, r3);
eq('and the rating the failed sync was carrying is NOT lost',
   cellsIn('Ratings', 'What they said'), ['brilliant idea', 'good fun']);

console.log('\nOWNER ONLY, AND NO SECRET EVER COMES BACK');
const mine = await AS(P.token, 'sheetStatus');
ok('the founding artist can ask', mine.ok, mine);
eq('and gets told it is on', mine.on, true);
ok('the reply names the address to share the sheet with',
   String(mine.account || '').includes('gserviceaccount'), mine.account);
const dump = JSON.stringify(mine);
ok('THE PRIVATE KEY IS NOT IN THE REPLY', !dump.includes('PRIVATE KEY') && !dump.includes(PEM.slice(40, 80)));
eq('another artist cannot read the status', (await AS(OTHER.token, 'sheetStatus')).status, 401);
eq('another artist cannot trigger a sync', (await AS(OTHER.token, 'sheetSync')).status, 401);
eq('and neither can a stranger', (await hit(admin, 'https://x/api/admin', { action: 'sheetSync' })).status, 401);

console.log('\nA DRY RUN COUNTS WITHOUT WRITING');
const callsBefore = SHEET.calls.length;
const dry = await W.syncSheet({ dry: true });
ok('it reports counts', dry.ok && dry.dry && dry.counts, dry);
eq('and touched Google not once', SHEET.calls.length, callsBefore);

console.log('\nGOOGLE\'S UNHELPFUL ERRORS ARE TRANSLATED');
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.startsWith('https://oauth2.googleapis.com/token'))
    return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }),
                        { headers: { 'content-type': 'application/json' } });
  return new Response(JSON.stringify({ error: { message: 'The caller does not have permission' } }),
                      { status: 403, headers: { 'content-type': 'application/json' } });
};
const denied = await W.sheetStatus();
ok('a 403 says to share the sheet with the service account, which is the actual fix',
   /share the sheet/i.test(denied.error || ''), denied.error);
globalThis.fetch = realFetch;

/* ---------- the three ways the first version lost data ----------
   The 403 section above deliberately left the REAL fetch in place, so put the
   stub back before doing anything that talks to "Google" again. */
stubGoogle();

/* All three were found by an independent review with fresh context, and all three
   passed the original 70 tests. The lesson in every one of them is the same: the
   tests asserted row COUNTS and never row VALUES, so a tab full of zeroes and a
   tab full of numbers looked identical. */

console.log('\nTHE SONGS TAB MUST NOT ZERO ITSELF EVERY NIGHT');
/* Songs is a SNAPSHOT — cleared and rewritten every run. Its play and vote counts
   were built from the shows that were NEW since last time, so the morning after a
   gig it read "played 1, votes 4" and the next sync rewrote the same rows as
   "played 0, votes 0". Every night. The column says "Votes all time". It cannot be
   recomputed either: the tally a song won is destroyed when the next song starts
   (INVARIANT 17b), so it has to be an accumulator that persists. */
const songVal = (title, colName) => {
  const i = bodyOf('Songs').findIndex((r) => r[col('Songs', 'Song')] === title);
  return i < 0 ? null : bodyOf('Songs')[i][col('Songs', colName)];
};
eq('after the first sync the song has its plays', songVal('Wonderwall', 'Times played'), 1);
eq('and its votes', songVal('Wonderwall', 'Votes all time'), 4);
await W.syncSheet();
eq('AFTER A SECOND SYNC THE PLAYS ARE STILL THERE', songVal('Wonderwall', 'Times played'), 1);
eq('and so are the votes', songVal('Wonderwall', 'Votes all time'), 4);
await W.syncSheet(); await W.syncSheet();
eq('and after two more', songVal('Wonderwall', 'Times played'), 1);
eq('a night is never counted twice', songVal('Wonderwall', 'Votes all time'), 4);
/* Another night must ADD, not replace.
   `newShow` rather than re-opening the ended one: on the same show Wonderwall is
   already played, so voting for it is a REPLAY at 5 credits and a 2-vote cast is
   refused for want of credits — which is correct app behaviour and made the first
   version of this fixture assert against a night that took no votes at all. */
await AS(P.token, 'newShow');
await AS(P.token, 'status', { status: 'live' });
await cast('zed', 'wonderwall');
await AS(P.token, 'play', { song: 'wonderwall' });
await AS(P.token, 'status', { status: 'ended' });
await W.syncSheet();
eq('a second night adds a play', songVal('Wonderwall', 'Times played'), 2);
eq('and adds its votes on top', songVal('Wonderwall', 'Votes all time'), 6);

const { casDoc } = await import('../netlify/functions/_lib.mjs');

console.log('\nENDING A SHOW TWICE MUST NOT COUNT THE NIGHT TWICE');
/* INVARIANT 17c's case: an artist ends by accident, plays eight more and ends
   again. That RE-ARCHIVES the same showId with a later endedAt and a richer
   snapshot — so a tally keyed on "newest night already counted" added the whole
   night a second time. The tally is keyed by SHOW, so a re-archive replaces. */
const playsNow = () => songVal('Wonderwall', 'Times played');
const wasPlays = playsNow();
await AS(P.token, 'status', { status: 'live' });      // reopen the SAME show
await AS(P.token, 'status', { status: 'ended' });     // and end it again
await W.syncSheet();
eq('re-ending the same night changes nothing', playsNow(), wasPlays);
eq('and the votes are not doubled either', songVal('Wonderwall', 'Votes all time'), 6);

console.log('\nONE SYNC AT A TIME');
/* The 03:20 cron and Perry tapping the button a second later would both walk the
   store and both append — the same night twice in Shows. The Studio's own busy
   flag is client-side, so it cannot help. */
/* Firing two at once does NOT reproduce it: the in-memory store has no latency,
   so the first finishes in about a millisecond and releases the lock before the
   second reaches it. Racing a scheduler is not a test. So the lock is HELD
   directly, which is exactly the state a real overlap produces, and asserted. */
await casDoc('sheetsync', () => ({}), (d) => { d.runningSince = Date.now(); return true; });
const busy = await W.syncSheet();
eq('a sync while one is running is refused', [busy.ok, busy.busy], [false, true]);
ok('and says so plainly', /already running/.test(busy.error || ''), busy.error);
ok('a dry run is never blocked — it writes nothing', (await W.syncSheet({ dry: true })).ok);
/* And it cannot wedge shut: a run that died mid-flight leaves a stale mark. */
await casDoc('sheetsync', () => ({}), (d) => { d.runningSince = Date.now() - 6 * 60e3; return true; });
ok('a lock older than five minutes is ignored', (await W.syncSheet()).ok);
const cleared = await W.readSyncState();
eq('and a finished run leaves the lock open', Number(cleared.runningSince) || 0, 0);

console.log('\nA LONG HISTORY IS DEFERRED, NEVER DROPPED');
/* The index is newest-first, and taking the first forty took the NEWEST forty and
   then set the watermark to the newest of THOSE — so every older unsynced night
   was instantly behind the mark and gone for good, while the code, the result note
   and INVARIANT 0bw all promised "the rest come next sync". */
const LOTS = 45;
const base = Date.parse('2026-01-01T20:00:00Z');
await casDoc(`histidx_${OTHER.aid}`, () => ({ shows: [] }), (idx) => {
  idx.shows = [];
  for (let i = 0; i < LOTS; i++) {
    idx.shows.push({ showId: 'n' + i, venue: 'Room ' + i, city: 'Town',
      startedAt: base + i * 86400000, endedAt: base + i * 86400000 + 7200e3,
      songsPlayed: 1, totalVotes: i, peakVoters: 1, room: 1, nets: 1, gross: 0 });
  }
  idx.shows.sort((a, b) => b.endedAt - a.endedAt);      // newest first, as the real one is
  return true;
});
const seenIds = () => new Set(cellsIn('Shows', 'Show id'));
await W.syncSheet();
const after1 = seenIds();
ok('the first sync takes a batch', after1.size >= 40, after1.size);
ok('and it starts at the OLDEST, not the newest', after1.has('n0'), [...after1].slice(0, 3));
await W.syncSheet();
const after2 = seenIds();
for (let i = 0; i < LOTS; i++) ok(`night n${i} reached the sheet`, after2.has('n' + i));
eq('and no night arrived twice',
   cellsIn('Shows', 'Show id').filter((x) => x === 'n7').length, 1);

console.log('\nONE TAB FAILING MUST NOT DUPLICATE ANOTHER TAB\'S ROWS');
/* Every watermark used to commit together at the end, so a failure on the LAST
   append re-sent every earlier tab next time — one night appearing twice in Shows
   because a rating failed to write. Marks now commit per tab, right after that
   tab's own append lands. */
await hit(fbFn, 'https://x/api/feedback?a=' + P.slug, { fan: 'dee', stars: 3, note: 'fine' });
await AS(P.token, 'status', { status: 'live' });
await AS(P.token, 'play', { song: 'half' });
await AS(P.token, 'status', { status: 'ended' });
const showsBefore = bodyOf('Shows').length;
/* Fail ONLY the Ratings append. Shows is appended first and must stay committed. */
const realStub = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("'Ratings'") && u.includes(':append'))
    return new Response(JSON.stringify({ error: { message: 'nope' } }),
                        { status: 500, headers: { 'content-type': 'application/json' } });
  return realStub(url, init);
};
let threw = null;
try { await W.syncSheet(); } catch (e) { threw = String(e.message || e); }
globalThis.fetch = realStub;
ok('the sync reports the failure', threw && /Ratings/.test(threw), threw);
ok('and says nothing is lost', threw && /come again next sync/.test(threw), threw);
const showsAfterFail = bodyOf('Shows').length;
eq('the new night landed once', showsAfterFail, showsBefore + 1);
const r4 = await W.syncSheet();
ok('the next sync succeeds', r4.ok, r4);
eq('AND DID NOT RE-SEND THE NIGHT THAT ALREADY LANDED', bodyOf('Shows').length, showsAfterFail);
eq('while the rating it was carrying does arrive', cellsIn('Ratings', 'What they said').includes('fine'), true);

/* ---------- the neighbour that the venue change nearly broke ---------- */
console.log('\nWIDENING THE SLOT SET MUST NOT UNCAP THE ARTIST  (a fix breaking its neighbour)');
/* SLOTS went from p0..p2 to p0..p11 so a venue on Pro can hold twelve photos.
   Until that moment SLOTS was ALSO, by accident, the artist's cap — the endpoint
   refused p3 because the name was not in the set. Widening it removed a guard
   nobody had written down, and an artist could then store nine images that
   normProfile trims away on every read: bytes in Blobs, referenced by nothing.
   The cap is now explicit and named, so this is the test that says so. */
const { SLOTS } = await import('../netlify/functions/_img.mjs');
const { MAX_PHOTOS } = await import('../netlify/functions/_profile.mjs');
ok('the slot set is wide enough for venue Pro', SLOTS.has('p11'), [...SLOTS]);
eq('but an artist still only gets three', MAX_PHOTOS, 3);
/* A real 1x1 PNG: _img.mjs checks the file SIGNATURE, not the label, so a
   made-up base64 string is refused before the slot is ever looked at. */
const PNG1 = 'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const shot = (t, slot) => hit(admin, 'https://x/api/admin', { action: 'photoUpload', slot, data: PNG1 }, t);
ok('p0 is fine', (await shot(P.token, 'p0')).ok);
ok('p2 is fine', (await shot(P.token, 'p2')).ok);
eq('p3 is refused', (await shot(P.token, 'p3')).status, 400);
eq('and so is p11', (await shot(P.token, 'p11')).status, 400);
const prof = await hit(admin, 'https://x/api/admin', { action: 'profileGet' }, P.token);
ok('only three ever land on the page',
   ((prof.profile || {}).photos || []).length <= 3, (prof.profile || {}).photos);

console.log('\nAND A VENUE ON PRO MUST ACTUALLY KEEP ITS TWELVE');
/* The mirror-image bug: venueadmin accepted p3..p11 at cap 12, and normVenue then
   trimmed the array to 3 on the very next read. Accepted, stored, silently
   discarded — worse than a 402, because it looked like it worked. */
const { normVenue } = await import('../netlify/functions/_venues.mjs');
const twelve = normVenue({ photos: Array.from({ length: 12 }, (_, i) => '/p' + i) });
eq('a venue record holds twelve', twelve.photos.length, 12);
const overflow = normVenue({ photos: Array.from({ length: 20 }, (_, i) => '/p' + i) });
eq('and no more than twelve', overflow.photos.length, 12);
/* And slots are ADDRESSES: compacting the array made the Studio draw photo 3 in
   slot 2, so clearing one photo appeared to move another. */
eq('a gap in the middle stays a gap',
   normVenue({ photos: ['/zero', '', '/two'] }).photos, ['/zero', '', '/two']);
eq('trailing blanks are still dropped',
   normVenue({ photos: ['/zero', '', ''] }).photos, ['/zero']);
const { normProfile } = await import('../netlify/functions/_profile.mjs');
eq('the artist side is positional too',
   normProfile({ photos: ['/a', '', '/c'] }).photos, ['/a', '', '/c']);
eq('an artist label or management company survives profile normalization',
   normProfile({ management: 'Independent Artists Management' }).management,
   'Independent Artists Management');
eq('a valid management website survives profile normalization',
   normProfile({ managementUrl: 'https://example.com/team?utm_source=test#people' }).managementUrl,
   'https://example.com/team');
eq('an unsafe management website is discarded',
   normProfile({ managementUrl: 'javascript:alert(1)' }).managementUrl, '');

/* THE NAME IN TWO PARTS (decision 0062): a first name or a band name, and an
   optional last name; `name` is rebuilt from them, and a profile saved before the
   split keeps the name it had. */
const { firstOf } = await import('../netlify/functions/_profile.mjs');
eq('first + last make the name', normProfile({ first: 'Perry', last: 'Idyll' }).name, 'Perry Idyll');
eq('a band has no last name and keeps its whole name', normProfile({ first: 'The Weekend Warriors', last: '' }).name, 'The Weekend Warriors');
eq('a profile saved before the split keeps its name', normProfile({ name: 'Perry Idyll' }).name, 'Perry Idyll');
eq('the word for a band is the band name', firstOf({ first: 'The Weekend Warriors', name: 'The Weekend Warriors' }), 'The Weekend Warriors');
eq('the word for an artist without the split is the first word', firstOf({ name: 'Perry Idyll' }), 'Perry');
eq('and nobody at all is the fallback', firstOf(null, 'the artist'), 'the artist');
/* THE TOP VIDEO: one hero at most, and it leads the list. */
const yt = (id, hero) => ({ mid: 'm' + id, provider: 'youtube', type: 'video', id: 'v' + id, hero });
const pm = normProfile({ media: [yt(1), yt(2, true), yt(3, true)] }).media;
eq('the first ticked one is the hero', pm.map((m) => m.hero), [true, false, false]);
eq('and it moves to the front', pm.map((m) => m.mid), ['m2', 'm1', 'm3']);
eq('no tick, no hero, order kept', normProfile({ media: [yt(1), yt(2)] }).media.map((m) => m.hero), [false, false]);

/* ---------- the nightly job is a public URL ---------- */
console.log('\nTHE CRON IS REACHABLE OVER HTTP, SO IT RATE-LIMITS ITSELF');
/* Every file in netlify/functions is reachable at /.netlify/functions/<name>
   whatever the redirects say. Netlify's own refusal to invoke a scheduled
   function over HTTP is their implementation detail, not something to lean on.
   The guard is a minimum gap, which cannot break the schedule the way enforcing
   a scheduler marker would. */
stubGoogle();
const cron = (await import('../netlify/functions/sheetcron.mjs'));
eq('it runs at 03:20 UTC', cron.config.schedule, '20 3 * * *');
const ring = (body) => cron.default(new Request('https://x/.netlify/functions/sheetcron', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body || {}) }));
const clearGap = () => casDoc('sheetsync', () => ({}), (d) => { d.lastRunAt = 0; return true; });

/* The button syncs above have just stamped lastRunAt, so a ring right now is
   ALREADY inside the gap — which is the guard working, and is worth asserting
   before clearing it. The first draft of this test assumed the ring would sync
   and read the skip as a failure. */
eq('a ring straight after a manual sync is refused', await (await ring({})).text(), 'too soon');
await clearGap();
const growthBefore = bodyOf('Growth').length;
const c1 = await ring({ next_run: '2026-09-04T03:20:00Z' });
eq('after the gap it runs', await c1.text(), 'ok');
eq('and writes exactly one Growth row', bodyOf('Growth').length, growthBefore + 1);
const c2 = await ring({});
eq('a second ring straight after is refused as too soon', await c2.text(), 'too soon');
eq('so hammering it cannot multiply rows', bodyOf('Growth').length, growthBefore + 1);
/* A scheduler with no recognisable marker must still work — enforcing the marker
   would silently kill the nightly job the day Netlify changed its shape. */
await clearGap();
const c3 = await ring({});
eq('an unmarked ring after the gap still syncs', await c3.text(), 'ok');
/* And the button bypasses the gap, because "you already did this" is the wrong
   answer to a person who just asked. */
ok('the button still works immediately after', (await AS(P.token, 'sheetSync')).ok);
globalThis.fetch = realFetch;

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

function isoIn(days) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}
