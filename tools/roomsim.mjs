/* A BIG ROOM, WITHOUT A BIG ROOM.

   Drives the REAL handlers (vote, me, admin) against the test store with latency
   switched on (test/blobs-fake.mjs `__latency`), on a VIRTUAL clock — node:test's
   mock timers — so this one process's CPU time does not bend the timing of what
   would be thousands of separate function calls. It answers the question the rest
   of the suite cannot: what happens when many phones write the same file at once.

     node tools/roomsim.mjs '{"P":5000,"burst":1500,"burstSec":20}'

   P          phones already in the room
   votedShare share of them that already voted (their records are bigger); 0.5
   burst      votes cast, spread evenly at random over burstSec seconds
   arrive     NEW phones opening the page (the "I'm here" stamp) over arriveSec
   play       the artist taps Play Top halfway through the burst
   oneSong    every vote goes to the first song (the worst case for Play)
   ghosts     devices that are in the files but not in the room
   songs      library size; 60
   r, w       storage read and write time in ms; 42 and 80
   timeout    the function limit a slow answer is scored against; 10000
   seed       the run repeats exactly for a given seed; 1
   capSec     stop after this many virtual seconds; 240

   Prints one line of JSON. It is a MODEL: the store's real write time has never
   been measured (ledger P3-005), so the times are only as true as r and w. What
   does not depend on them is the shape — who wins, who retries, what is lost.

   First written for the 2 October 2026 scale audit; test/contention.mjs runs a few
   rooms through it on every suite run. Re-run it by hand after any change to
   casDoc, the fan files or the vote path. */
import * as nodeModule from 'node:module';
import { mock } from 'node:test';
import { readdirSync } from 'node:fs';
/* In-thread hooks where Node has them (22.15 and later). The older off-thread hooks
   answer every dynamic import() through another thread, which takes real time, so
   on a slow machine a request's work slid from one virtual millisecond to the next
   and the same seed gave a different, slower night (GitHub's runner, Node 22). */
{
  const { redirect } = await import('../test/hooks.mjs');
  if (nodeModule.registerHooks) nodeModule.registerHooks({ resolve: (spec, ctx, next) => { const url = redirect(spec); return url ? { url, shortCircuit: true } : next(spec, ctx); } });
  else nodeModule.register(new URL('../test/hooks.mjs', import.meta.url));
}

const A = JSON.parse(process.argv[2] || '{}');
const P = A.P ?? 5000;
const votedShare = A.votedShare ?? 0.5;
const burst = A.burst ?? 0;
const burstSec = A.burstSec ?? 20;
const arrive = A.arrive ?? 0;
const arriveSec = A.arriveSec ?? 60;
const play = A.play ?? false;
const ghosts = A.ghosts ?? 0;
const TIMEOUT = A.timeout ?? 10000;

/* One seeded source for every random draw in the process — the handlers' retry
   jitter included — so the same options give the same run. */
let seed = (A.seed ?? 1) >>> 0;
Math.random = () => {
  seed = (seed + 0x6D2B79F5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';
process.env.MYSET_SECRET = 'sim-secret-sim-secret-sim-secret-0001';
const F = '../netlify/functions/';
const blobs = await import('../test/blobs-fake.mjs');
const vote = (await import(F + 'vote.mjs')).default;
const me = (await import(F + 'me.mjs')).default;
const admin = (await import(F + 'admin.mjs')).default;
const lib = await import(F + '_lib.mjs');
const auth = await import(F + '_auth.mjs');
/* Every module a handler may import on first use is loaded now, on the real clock.
   A first dynamic import reads a file from disk, and how many turns of the event
   loop that takes is up to the disk: inside the rush it would move work from one
   virtual millisecond to the next, and a seeded run would not repeat (it did not,
   on Node 20 and 22). */
for (const f of readdirSync(new URL(F, import.meta.url)).filter((n) => n.endsWith('.mjs')).sort()) await import(F + f);

// ---- the room, built with no latency on the real clock ----
const a = await auth.createArtist({ email: 'sim@example.com', name: 'Sim', slug: 'sim' });
const T = await auth.signToken('sim@example.com', auth.revOf(await auth.readArtists(), a.artistId));
const adm = async (action, extra = {}) => {
  const r = await admin(new Request('https://x/api/admin', { method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + T },
    body: JSON.stringify({ action, ...extra }) }));
  return { code: r.status, ...(await r.json().catch(() => ({}))) };
};
const fail = (o) => { console.log(JSON.stringify(o)); process.exit(1); };
for (let i = 0; i < (A.songs ?? 60); i++) await adm('addSong', { title: 'Song number ' + i, artist: 'Some Artist' });
const ns = await adm('newShow');
const show = await lib.getShow(a.artistId);
if (show.status !== 'live') fail({ error: 'show not live', code: ns.code, status: show.status });
const songs = show.songs.map((s) => s.id);
const rid = (n) => { let s = ''; while (s.length < n) s += Math.random().toString(36).slice(2); return s.slice(0, n); };
const fid = () => 'f' + rid(12);
const pick = () => songs[Math.min(songs.length - 1, Math.floor(Math.pow(Math.random(), 2.2) * songs.length))];
const now0 = Date.now();
const bags = Array.from({ length: lib.SHARDS }, () => ({}));
const blank = () => ({ v: [], extra: 0, ts: {}, spent: 0, va: {}, ipH: rid(16), seenShow: show.showId });
const fresh = [];                         // in the room, every free vote unspent
for (let i = 0; i < P; i++) {
  const id = fid(), rec = blank();
  if (Math.random() < votedShare) {       // a phone that used its three free votes ten minutes ago
    const casts = [];
    for (let k = 0; k < 3; k++) {
      const s = pick(); rec.v.push(s); rec.ts[s] ||= now0 - 6e5;
      (rec.va[s] ||= []).push([1, 0, now0 - 6e5]);
      casts.push({ id: rid(32), at: now0 - 6e5, out: { voted: true, votes: 1, cost: 1, remaining: 2 - k } });
    }
    Object.assign(rec, { casts, rl: { t: 19.5, at: now0 - 6e5 }, lastAt: now0 - 6e5, used: 3, freeUsed: 3 });
  } else fresh.push(id);
  bags[lib.shardOf(id)][id] = rec;
}
for (let i = 0; i < ghosts; i++) { const id = fid(); bags[lib.shardOf(id)][id] = blank(); }
const shardBytes = [];
for (let n = 0; n < lib.SHARDS; n++) {
  const body = JSON.stringify(bags[n]);
  await blobs.getStore().set(lib.KEY.fan(a.artistId, n), body);
  shardBytes.push(body.length);
}
const voters = fresh.slice(0, burst);
if (voters.length < burst) fail({ error: 'not enough phones with free votes for the burst', have: fresh.length });

// ---- the rush, on a virtual clock ----
mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() });
blobs.__latency({ r: A.r ?? 42, w: A.w ?? 80, rand: Math.random });
const res = { vote: [], me: [], play: null, err: null };
let pending = 0;
const at = (ms, fn) => { pending++; setTimeout(async () => { try { await fn(); } catch (e) { res.err = String((e && e.message) || e); } pending--; }, ms); };
const ip = (net) => net + (1 + Math.floor(Math.random() * 250));
voters.forEach((f) => at(Math.random() * burstSec * 1000, async () => {
  const t0 = Date.now();
  const r = await vote(new Request('https://x/api/vote?a=sim', { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip('203.0.113.') },
    body: JSON.stringify({ fan: f, song: A.oneSong ? songs[0] : pick(), n: 1, cast: rid(32), op: 'cast' }) }));
  res.vote.push([r.status, Date.now() - t0, f]);
}));
for (let i = 0; i < arrive; i++) at(Math.random() * arriveSec * 1000, async () => {
  const t0 = Date.now();
  const r = await me(new Request('https://x/api/me?a=sim&in=1&fan=' + fid(), { headers: { 'x-forwarded-for': ip('198.51.100.') } }));
  res.me.push([r.status, Date.now() - t0]);
});
if (play) at(burstSec * 500, async () => {
  const t0 = Date.now();
  const r = await adm('playTop');
  res.play = { code: r.code, ms: Date.now() - t0, error: r.error || null };
});
/* Let everything that can happen at this virtual millisecond happen before the
   clock moves. One turn of the event loop is not always enough (reading a request
   body takes more turns on some Node versions), and a run whose work spilled into
   the next millisecond by chance would not repeat to the byte. So turn the loop
   until the store has seen no new call for a whole turn. */
const flush = async () => {
  for (let i = 0, seen = -1; i < 64 && seen !== blobs.stats.calls; i++) {
    seen = blobs.stats.calls;
    await new Promise((r) => setImmediate(r));
  }
};
const cap = (A.capSec ?? 240) * 1000, wall0 = process.hrtime.bigint();
let vt = 0;
while (pending > 0 && vt < cap) { mock.timers.tick(1); vt++; await flush(); }
const store = { ...blobs.stats };
blobs.__latency(null);
mock.timers.reset();

// ---- what happened ----
const pct = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const score = (rows) => {
  const d = rows.map((r) => r[1]), status = {};
  for (const r of rows) status[r[0]] = (status[r[0]] || 0) + 1;
  return { n: rows.length, status, p50: pct(d, .5), p95: pct(d, .95), p99: pct(d, .99), max: pct(d, 1), overTimeout: d.filter((x) => x > TIMEOUT).length };
};
const fans = await lib.readFans(a.artistId);
const showEnd = await lib.getShow(a.artistId);
const holds = (f) => !!(fans[f] && (fans[f].v || []).length);
/* The two things that must never happen. A vote the fan was told landed (a 200)
   that is on no song and was not taken by Play is LOST. A vote still sitting on
   the song that is now playing is STRANDED: Play collected before it landed. */
const nowPlaying = showEnd.nowPlaying || null;
const said200 = res.vote.filter((r) => r[0] === 200).map((r) => r[2]);
const onSong = (fs) => Object.values(fs).reduce((n, f) => n + ((f && f.v) || []).filter((x) => x === nowPlaying).length, 0);
/* Raw: rows still in the files. Since decision 0147 a late row may sit there and be
   ignored: what the board counts is the file read through liveFans. */
const rawOnSong = nowPlaying ? onSong(fans) : null;
const stranded = nowPlaying ? onSong(lib.liveFans ? lib.liveFans(fans, showEnd) : fans) : null;
console.log(JSON.stringify({
  cfg: { P, burst, burstSec, arrive, arriveSec, play, ghosts, r: A.r ?? 42, w: A.w ?? 80, timeout: TIMEOUT, seed: A.seed ?? 1 },
  shardKB: Math.round(shardBytes.reduce((x, y) => x + y, 0) / lib.SHARDS / 1024),
  virtualSec: Math.round(vt / 100) / 10, unfinished: pending,
  vote: score(res.vote), votesLanded: voters.filter(holds).length,
  votesLost: play ? null : said200.filter((f) => !holds(f)).length,
  me: score(res.me), presenceLanded: arrive ? Object.values(fans).filter((f) => f.seenShow === show.showId).length - P - ghosts : null,
  play: res.play, strandedOnPlayedSong: stranded, rowsLeftInFiles: rawOnSong,
  store: { ...store, MBread: Math.round(store.bytesR / 1e6), MBwritten: Math.round(store.bytesW / 1e6) },
  wallSec: Math.round(Number(process.hrtime.bigint() - wall0) / 1e8) / 10, err: res.err }));
process.exit(0);
