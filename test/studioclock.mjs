/* EVERY STUDIO CALL HAS A CLOCK, AND THE LIVE TAB POLLS ONE AT A TIME  (decision 0201, INVARIANT 0jd)

   The scale audit of 2 October 2026: no request the Studio made had a timeout. A
   store that stalled held the function as long as the platform let it run, and the
   Studio waited with it — the overlay up, the tap dead (WRITING never let go), and
   the Live tab's four-second poll stacking a new stage read on top of the last one
   every four seconds, exactly when the room was biggest.

   This runs `api()` and `start()` as shipped in public/studio.js, with fetch, load()
   and the interval stubbed:
     · a read that never answers gives up and is a dropped connection, not a sign-out
     · the artist's own tap that never answers says it may still land, and reads the stage
     · a background POST that never answers is a plain dropped connection
     · the clock stops a reply whose body never finishes, and aborts the request
     · an answer in time is the answer, and the session renewal still rides on it
     · the first load waits longer than a poll; a photo passes its own clock
     · nothing in studio.js fetches outside api() and clocked(), and clocked() gives up too
     · the Live tab's poll never starts a second read while one is in flight */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });

const studio = readFileSync(new URL('../public/studio.js', import.meta.url), 'utf8');
const cut = (start, endAfter) => {
  const from = studio.indexOf(start);
  const to = studio.indexOf('\n}\n', studio.indexOf(endAfter, from)) + 3;
  return from >= 0 && to > from ? studio.slice(from, to) : '';
};
const apiSrc = cut('const READ_MS=', 'async function api(');
ok('api() and its clocks are where the page keeps them', apiSrc.includes('async function api('));

let loads = 0, aborted = 0, stored = {};
const never = () => new Promise(() => {});
let fetchImpl = () => never();
const ctx = vm.createContext({
  window: { __early: null, AbortController }, SAMPLE: null, sampleRoute: () => null,
  CODE: '', TOKEN: '', ASLUG: '', API: '',
  localStorage: { setItem: (k, v) => { stored[k] = v; } },
  busy: () => {}, load: async () => { loads++; },
  fetch: (u, o) => { if (o && o.signal) o.signal.addEventListener('abort', () => { aborted++; }); return fetchImpl(u, o); },
  AbortController, setTimeout, clearTimeout, Promise, Error,
});
vm.runInContext(apiSrc + '\nglobalThis.MS = { READ_MS, WRITE_MS, FIRST_MS, UPLOAD_MS };', ctx);
const tick = () => new Promise((r) => setTimeout(r, 0));

console.log('\nTHE CLOCKS');
{
  const { READ_MS, WRITE_MS, FIRST_MS, UPLOAD_MS } = ctx.MS;
  ok('a read gives up before a tap, a tap before the first load, the first load before a photo',
    READ_MS < WRITE_MS && WRITE_MS < FIRST_MS && FIRST_MS < UPLOAD_MS, ctx.MS);
  ok('and a poll gives up within ten seconds', READ_MS <= 10000, READ_MS);
  ok('the first load is given its own clock', /api\('\/stage',\{quiet:!D, \.\.\.\(D\?\{\}:\{timeout:FIRST_MS\}\)/.test(studio));
  ok('every photo upload passes the photo clock', (studio.match(/action:'(merch|diary)Photo',[^}]*\}\)[^)]*timeout:UPLOAD_MS/g) || []).length === 4,
    studio.match(/action:'(merch|diary)Photo'[^\n]{0,80}/g));
}

console.log('\nA READ THAT NEVER ANSWERS');
{
  fetchImpl = () => never(); loads = 0; aborted = 0;
  const t0 = Date.now();
  const d = await ctx.api('/stage', { quiet: true, timeout: 40 });
  ok('gives up on its clock', Date.now() - t0 < 1000, Date.now() - t0);
  eq('and is a dropped connection — the last good screen stays, nobody is signed out', [d.ok, d.offline, d.late], [false, true, undefined]);
  eq('the request itself is aborted', aborted, 1);
  eq('a read that gave up does not read the stage again by itself', loads, 0);
}

console.log('\nTHE ARTIST\'S OWN TAP THAT NEVER ANSWERS');
{
  fetchImpl = () => never(); loads = 0;
  const d = await ctx.api('/admin', { method: 'POST', body: '{"action":"endSong"}', timeout: 40 });
  await tick();
  eq('says it may still land', [d.ok, d.offline, d.late], [false, true, true]);
  ok('in words the artist can act on', /may still go through/.test(d.error) && /before you tap again/.test(d.error), d.error);
  eq('and reads the stage, so the screen shows what happened', loads, 1);
}

console.log('\nA BACKGROUND POST THAT NEVER ANSWERS');
{
  fetchImpl = () => never(); loads = 0;
  const d = await ctx.api('/admin', { method: 'POST', body: '{"action":"msgCount"}', quiet: true, timeout: 40 });
  await tick();
  eq('is a plain dropped connection', [d.ok, d.offline, d.late], [false, true, undefined]);
  eq('with no stage read of its own', loads, 0);
}

console.log('\nA REPLY WHOSE BODY NEVER FINISHES');
{
  fetchImpl = () => Promise.resolve({ status: 200, headers: { get: () => null }, json: () => never() });
  aborted = 0;
  const d = await ctx.api('/stage', { quiet: true, timeout: 40 });
  eq('the same clock stops it', [d.ok, d.offline], [false, true]);
  eq('and aborts the request', aborted, 1);
}

console.log('\nAN ANSWER IN TIME');
{
  fetchImpl = () => Promise.resolve({ status: 200, headers: { get: (k) => (k === 'x-myset-token' ? 'fresh-token' : null) }, json: async () => ({ ok: true, show: { status: 'live' } }) });
  aborted = 0; stored = {};
  const d = await ctx.api('/stage', { quiet: true, timeout: 40 });
  eq('is the answer', d, { ok: true, show: { status: 'live' } });
  await new Promise((r) => setTimeout(r, 80));
  eq('and its clock is stopped: nothing is aborted after the fact', aborted, 0);
  eq('a renewed session still rides back on it (0199)', [ctx.TOKEN, stored['myset.token']], ['fresh-token', 'fresh-token']);
  fetchImpl = () => Promise.resolve({ status: 503, headers: { get: () => null }, json: async () => ({ ok: false, error: 'busy' }) });
  const b = await ctx.api('/stage', { quiet: true, timeout: 40 });
  eq('a 503 "busy" in time is still a dropped connection, as before (0142)', [b.ok, b.offline], [false, true]);
}

console.log('\nTHE FEW CALLS THAT CANNOT GO THROUGH api()');
{
  const fetches = studio.match(/\bfetch\(/g) || [];
  eq('studio.js has no fetch outside api() and clocked()', fetches.length, 2);
  const cSrc = cut('function clocked(', 'function clocked(');
  const cctx = vm.createContext({ window: { AbortController }, AbortController, setTimeout, READ_MS: 40,
    fetch: (u, o) => new Promise((_, no) => o.signal.addEventListener('abort', () => no(new Error('aborted')))) });
  vm.runInContext(cSrc, cctx);
  const t0 = Date.now();
  const r = await cctx.clocked('/api/profile').then(() => 'answered', () => 'gave up');
  eq('clocked() gives up on a request that never answers', r, 'gave up');
  ok('on its clock', Date.now() - t0 < 1000, Date.now() - t0);
}

console.log('\nTHE LIVE TAB POLLS ONE AT A TIME');
{
  const s0 = studio.indexOf('function start(){'), s1 = studio.indexOf('},4000);}', s0);
  const startSrc = s0 >= 0 && s1 > s0 ? studio.slice(s0, s1 + 9) : '';
  ok('start() is where the page keeps it', startSrc.includes('setInterval'));
  let tickFn = null, pollLoads = 0, release = null;
  const sctx = vm.createContext({
    timer: null, clearInterval: () => {}, setTimeout: () => {}, bootDone: () => {}, handleSubReturn: () => {},
    window: {}, document: { hidden: false }, TAB: 'live', D: { show: { status: 'live' } },
    setInterval: (fn) => { tickFn = fn; return 1; },
    load: (o) => { if (!o) return Promise.resolve(); pollLoads++; return new Promise((r) => { release = r; }); },
  });
  vm.runInContext(startSrc, sctx);
  sctx.start();
  tickFn();
  eq('the first lap starts a stage read', pollLoads, 1);
  tickFn(); tickFn(); tickFn();
  eq('THE FIX: three more laps while it is out start nothing', pollLoads, 1);
  release(); await tick(); await tick();
  tickFn();
  eq('the lap after it answers starts the next one', pollLoads, 2);
  release(); await tick(); await tick();
  sctx.TAB = 'money'; tickFn();
  eq('off the Live tab it does not poll', pollLoads, 2);
  sctx.TAB = 'live'; sctx.document.hidden = true; tickFn();
  eq('nor with the screen off', pollLoads, 2);
  sctx.document.hidden = false; sctx.D = { show: { status: 'ended' } }; tickFn();
  eq('nor once the show has ended', pollLoads, 2);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
