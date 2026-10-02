/* ONE TAP, ONE SONG  (decision 0151)

   The Studio's request has no clock. A Play that takes longer than the server's
   double-tap window — eight seconds in production — comes back to a retry that the
   window no longer covers, and Play Top then starts the NEXT song down while the
   first goes to "played" unperformed. The 2 October 2026 audit found it.

   The window is scaled down here (MYSET_DOUBLE_TAP_MS) so the suite does not wait
   eight seconds a case; the shape is the production one: reads are slowed until
   Play itself takes longer than the window, and the retry arrives after it. */
process.env.ADMIN_CODE = 'devlocal';
const WINDOW = 300;
process.env.MYSET_DOUBLE_TAP_MS = String(WINDOW);

const admin = (await import('../netlify/functions/admin.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const { getShow, readFans, store, KEY, TAPS_KEPT, DEFAULT_ARTIST } = await import('../netlify/functions/_lib.mjs');
const { readEventLog } = await import('../netlify/functions/_evlog.mjs');
const { __slowReads, __dump } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body) => {
  const r = await h(new Request(url, body === undefined ? {} : { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { code: r.status, ...JSON.parse(t) }; } catch { return { code: r.status, raw: t }; }
};
const A = (action, extra = {}) => hit(admin, 'https://x/api/admin?code=devlocal', { action, ...extra });
const cast = (fan, song, n = 1) => hit(voteFn, 'https://x/api/vote', { fan, song, n, op: 'cast', cast: 'c' + Math.random().toString(36).slice(2, 12) });
const AID = DEFAULT_ARTIST;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/* past the window, measured from when the song started — whatever Play itself took */
const pastWindow = async () => {
  const at = (await getShow(AID)).nowPlayingAt || 0;
  const left = at + WINDOW + 60 - Date.now();
  if (left > 0) await wait(left);
};
const plays = async () => (await readEventLog(AID, (await getShow(AID)).showId)).events.filter((e) => e.k === 'play');

for (const t of ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot']) await A('addSong', { title: t, artist: 'Test' });
await A('newShow');
const [alpha, bravo, charlie, delta, echo, foxtrot] = (await getShow(AID)).songs.map((s) => s.id);
for (const [f, s] of [['f1', alpha], ['f2', alpha], ['f3', alpha], ['f4', bravo], ['f5', bravo], ['f6', charlie],
                      ['f7', delta], ['f8', echo]]) await cast(f, s);

console.log('\nA SLOW PLAY TOP, THEN ITS RETRY AFTER THE WINDOW');
__slowReads(Math.ceil(WINDOW / 4));
const t0 = Date.now();
const p1 = await A('playTop', { tap: 'tapslow0001' });
const took = Date.now() - t0;
__slowReads(0);
ok(`Play Top itself took longer than the window (${took} ms > ${WINDOW} ms)`, took > WINDOW, took);
eq('it started alpha', [p1.code, p1.ok, (await getShow(AID)).nowPlaying], [200, true, alpha]);
await pastWindow();
const p2 = await A('playTop', { tap: 'tapslow0001' });
const s2 = await getShow(AID);
eq('the retry is answered as done, not obeyed', [p2.code, p2.ok, p2.repeat], [200, true, true]);
eq('alpha is still playing — bravo was not started', s2.nowPlaying, alpha);
eq('nothing went to played unperformed', s2.played, []);
eq('one song started, once: one count, one entry in the night\'s list, one play in the event log',
   [s2.plays, s2.log.length, (await plays()).length], [1, 1, 1]);
ok('the answer carries the stage, and the stage names alpha', p2.stage && p2.stage.show && p2.stage.show.nowPlaying === alpha, p2.stage && p2.stage.show);
ok('and the stage lists the tap, so the Studio can see it landed', ((p2.stage && p2.stage.show && p2.stage.show.taps) || []).includes('tapslow0001'));
eq('bravo\'s votes are where their fans put them', (await readFans(AID)).f4.v, [bravo]);

console.log('\nA NEW TAP IS A NEW TAP');
await pastWindow();
const p3 = await A('playTop', { tap: 'tapnext0002' });
eq('a different id after the window starts the next song', [p3.code, p3.repeat || false, (await getShow(AID)).nowPlaying], [200, false, bravo]);
eq('and alpha goes to played, having been played', (await getShow(AID)).played, [alpha]);
await pastWindow();
const p3b = await A('playTop');
eq('a page that sends no id is served exactly as before', [p3b.code, (await getShow(AID)).nowPlaying], [200, charlie]);

console.log('\nTWO COPIES OF ONE TAP IN FLIGHT AT ONCE');
/* Both read the show before either writes. The loser's write is refused, it reads
   again, and finds its own tap already there. */
await pastWindow();
__slowReads(60);
const [c1, c2] = await Promise.all([A('playTop', { tap: 'tapboth0003' }), A('playTop', { tap: 'tapboth0003' })]);
__slowReads(0);
const s4 = await getShow(AID);
eq('both are answered as done', [c1.code, c1.ok, c2.code, c2.ok], [200, true, 200, true]);
eq('exactly one of them acted', [c1.repeat || false, c2.repeat || false].sort(), [false, true]);
eq('one song started: delta, and only delta', [s4.nowPlaying, s4.played, s4.plays], [delta, [alpha, bravo, charlie], 4]);
eq('one play in the event log for it', (await plays()).filter((e) => e.s === delta).length, 1);

console.log('\nPLAY (A NAMED SONG) RETRIED AFTER THE WINDOW');
await pastWindow();
const n1 = await A('play', { song: echo, tap: 'tapecho0004' });
eq('echo starts', [n1.code, (await getShow(AID)).nowPlaying], [200, echo]);
const before = await getShow(AID);
await pastWindow();
const n2 = await A('play', { song: echo, tap: 'tapecho0004' });
const after = await getShow(AID);
eq('its retry is answered as done', [n2.code, n2.repeat], [200, true]);
eq('echo is not started a second time: no new count, no new mark, no second entry',
   [after.plays, after.col[echo], after.log.length, after.nowPlayingAt], [before.plays, before.col[echo], before.log.length, before.nowPlayingAt]);
eq('one play of echo in the event log', (await plays()).filter((e) => e.s === echo).length, 1);

console.log('\nTHE SHOW KEEPS A FEW, NOT ALL');
for (let i = 0; i < TAPS_KEPT + 3; i++) {
  await pastWindow();
  await A('play', { song: [alpha, bravo][i % 2], tap: 'tapmany' + String(i).padStart(4, '0') });
}
const kept = (await getShow(AID)).taps;
eq(`the last ${TAPS_KEPT}, newest last`, [kept.length, kept[kept.length - 1].id], [TAPS_KEPT, 'tapmany' + String(TAPS_KEPT + 2).padStart(4, '0')]);
ok('each says what it started', kept.every((t) => t.song === alpha || t.song === bravo), kept);
await pastWindow();
const junk = await A('play', { song: bravo, tap: '<script>' + 'x'.repeat(80) });
const last = (await getShow(AID)).taps.slice(-1)[0];
eq('an id is cleaned and cut, never stored as sent', [junk.code, last.id], [200, ('script' + 'x'.repeat(80)).slice(0, 40)]);

console.log('\nTHIS REQUEST\'S OWN WRITE LANDED, AND ITS READ-BACK MET A LATER WRITE');
/* The write sticks; before the read-back looks, something else writes the show (here
   the test, directly). The loop goes round again and finds the tap — its own. That
   is not a retry from somewhere else: the sweep and the event log still run. */
await pastWindow();
await cast('g1', foxtrot); await cast('g2', foxtrot);
__slowReads(250, /^show_/);
const own = A('play', { song: foxtrot, tap: 'tapown00005' });
let seen = null;
for (let i = 0; i < 600 && !seen; i++) {
  const e = __dump().get(KEY.show(AID));
  if (e && String(e.body).includes('tapown00005')) seen = e; else await wait(5);
}
ok('the play\'s write landed', !!seen);
const doc = JSON.parse(String(seen.body));
doc.updatedAt += 1; doc.venue = 'A later write';
await store().set(KEY.show(AID), JSON.stringify(doc));
const o1 = await own;
__slowReads(0);
const s6 = await getShow(AID);
eq('it is answered as the tap that acted, not as a repeat', [o1.code, o1.ok, o1.repeat || false], [200, true, false]);
eq('foxtrot playing, the later write kept', [s6.nowPlaying, s6.venue], [foxtrot, 'A later write']);
eq('its play is in the event log, with the votes it collected', (await plays()).filter((e) => e.s === foxtrot && e.votes === 2).length, 1);
ok('and the sweep ran: foxtrot\'s votes are off the fans\' files', !(await readFans(AID)).g1.v.includes(foxtrot), (await readFans(AID)).g1);

console.log('\nTHE STUDIO\'S SIDE: ONE ID PER TAP, THE SAME ID ON ITS RETRY');
/* playAct as shipped in public/studio.js, run with act() and load() stubbed: what the
   page sends, and when it lets go of a tap. */
const { readFileSync } = await import('node:fs');
const vm = await import('node:vm');
const studio = readFileSync(new URL('../public/studio.js', import.meta.url), 'utf8');
const from = studio.indexOf('let TAP=null;');
const to = studio.indexOf('\n}\n', studio.indexOf('async function playAct')) + 3;
ok('playAct is where the page keeps it', from > 0 && to > from);
let clock = 1e12, answer = 'offline', stageTaps = [], heldDuringLoad = null;
const sent = [];
const ctx = vm.createContext({
  PRACTICE: null, WRITING: false, D: null,
  Date: { now: () => clock }, Math,
  act: async (action, extra) => { sent.push({ action, ...extra }); return answer === 'ok' ? undefined : answer === 'offline' ? { ok: false, offline: true } : { ok: false, error: 'nothing left in the pool' }; },
  load: async () => { heldDuringLoad = ctx.WRITING; ctx.D = { show: { taps: stageTaps } }; },
});
vm.runInContext(studio.slice(from, to) + '\nglobalThis.tapNow = () => TAP;', ctx);
const tapOf = (i) => sent[i] && sent[i].tap;
await ctx.playAct('playTop', {});
ok('a tap carries an id', /^[a-z0-9]{10,}$/.test(tapOf(0)), sent[0]);
ok('with no answer, the stage is read again, and no other tap gets through meanwhile', heldDuringLoad === true && ctx.WRITING === false);
await ctx.playAct('playTop', {});
eq('the retry carries the same id', tapOf(1), tapOf(0));
answer = 'refused';
await ctx.playAct('playTop', {});
eq('a refusal keeps it too: a tap the server never acted on left nothing behind', tapOf(2), tapOf(0));
answer = 'ok';
await ctx.playAct('playTop', {});
eq('the answer that it landed lets it go', [tapOf(3), ctx.tapNow()], [tapOf(0), null]);
await ctx.playAct('playTop', {});
ok('so the next tap is a new tap', tapOf(4) && tapOf(4) !== tapOf(0), sent);
answer = 'offline';
await ctx.playAct('play', { song: 'alpha' });
stageTaps = [tapOf(5)];
await ctx.playAct('play', { song: 'alpha' });
eq('a stage that lists the tap lets it go: it landed', ctx.tapNow(), null);
stageTaps = [];
await ctx.playAct('play', { song: 'bravo' });
ok('another song is another tap', tapOf(7) !== tapOf(6) && tapOf(7) !== tapOf(5), sent.slice(5));
clock += 121000;
await ctx.playAct('play', { song: 'bravo' });
ok('two minutes on, a tap is a new tap', tapOf(8) !== tapOf(7), sent.slice(7));
ctx.WRITING = true;
const n = sent.length;
await ctx.playAct('play', { song: 'bravo' });
ok('a tap while one is in flight sends nothing new from here', sent.length === n + 1 && sent[n].tap === undefined, sent.slice(n));
ctx.WRITING = false; ctx.PRACTICE = {};
await ctx.playAct('playTop', {});
ok('a practice round never sends an id', sent[sent.length - 1].tap === undefined);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
