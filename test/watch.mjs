/* SOMEBODY IS TOLD WHEN PRODUCTION BREAKS  (decision 0157; _watch.mjs, health.mjs)

   Three questions — is the bell ringing, is a payment still owed, is the error log
   filling — and a push to the founder when an answer changes: once when it goes
   wrong, hourly while it stays wrong, once when it is right again. And an address a
   machine outside MySet can ask. */
process.env.ADMIN_CODE = 'devlocal';
const { watch, look, WATCH, BELL_STALE_MS, OWED_STALE_MS, ERRS_PER_HOUR, AGAIN_MS } = await import('../netlify/functions/_watch.mjs');
const healthFn = (await import('../netlify/functions/health.mjs')).default;
const { casDoc, readDoc, DEFAULT_ARTIST } = await import('../netlify/functions/_lib.mjs');
const { noteOwed, OWED } = await import('../netlify/functions/_pay.mjs');
const { logErr, shardKeys } = await import('../netlify/functions/_errlog.mjs');
const { __failReads } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const told = [];
const tell = async (aid, msg, to) => { told.push({ aid, to, ...msg }); return { ok: true, sent: 1 }; };
const health = async () => { const r = await healthFn(new Request('https://x/api/health')); return { status: r.status, cdn: r.headers.get('netlify-cdn-cache-control'), ...(await r.json()) }; };
const bell = (at) => casDoc('gigsched', () => ({ v: 1, byArtist: {} }), (d) => { d.lastRunAt = at; return true; });
const quiet = console.error; const hush = async (fn) => { console.error = () => {}; try { return await fn(); } finally { console.error = quiet; } };
const T = Date.now();

console.log('\nALL WELL');
await bell(T - 60e3);
let r = await watch({ now: T, tell });
eq('nothing is wrong', r.problems, []);
eq('and nobody is told', told.length, 0);
let h = await health();
eq('the health address answers 200', h.status, 200);
eq('ok', h.ok, true);
ok('and is never kept at the edge', /no-store/.test(h.cdn || ''), h.cdn);
ok('it carries ages and counts, nothing else', h.bellAgeSec >= 0 && h.owed === 0 && typeof h.watchAgeSec === 'number', h);

console.log('\nTHE BELL STOPS');
await bell(T - BELL_STALE_MS - 5 * 60e3);
r = await watch({ now: T, tell });
eq('the stalled scheduler is seen', r.problems, ['bell']);
eq('the founder is told, once', told.length, 1);
eq('on the founding page', told[0].aid, DEFAULT_ARTIST);
eq('to the owner seat only', told[0].to, { owner: true });
ok('in words a person can act on', /scheduler has stopped/.test(told[0].title) && /15 minutes/.test(told[0].body), told[0]);
r = await watch({ now: T + 10 * 60e3, tell });
eq('ten minutes later it is still wrong', r.problems, ['bell']);
eq('but he is not told again', told.length, 1);
r = await watch({ now: T + AGAIN_MS + 60e3, tell });
eq('an hour later he is', told.length, 2);
h = await health();
eq('the health address says 503', h.status, 503);
eq('and why', h.why, ['bell']);
await bell(T + AGAIN_MS + 2 * 60e3);
r = await watch({ now: T + AGAIN_MS + 3 * 60e3, tell });
eq('when it rings again', r.problems, []);
ok('he is told it is back to normal', told.length === 3 && /back to normal/.test(told[2].title) && /scheduler/.test(told[2].body), told[2]);
await bell(T + AGAIN_MS + 12 * 60e3);
r = await watch({ now: T + AGAIN_MS + 13 * 60e3, tell });
eq('and only once', told.length, 3);

console.log('\nA PAYMENT STAYS OWED');
const T2 = T + 3 * 3600e3;
await bell(T2 - 60e3);
await noteOwed(DEFAULT_ARTIST, 'cs_watch_1', '', T2 - 5 * 60e3);
r = await watch({ now: T2, tell });
eq('five minutes owed is the bell’s to retry, not an alarm', r.problems, []);
await bell(T2 + OWED_STALE_MS);
r = await watch({ now: T2 + OWED_STALE_MS, tell });
eq('past fifteen it is', r.problems, ['owed']);
ok('and says how many and for how long', /1 payment not delivered/.test(told[told.length - 1].title), told[told.length - 1]);
await casDoc(OWED, () => ({}), (d) => { d.rows = {}; return true; });

console.log('\nTHE ERROR LOG FILLS');
const T3 = Date.now();
await bell(T3 - 60e3);
await hush(async () => { for (let i = 0; i < ERRS_PER_HOUR; i++) await logErr('test', new Error('boom ' + i)); });
const before = told.length;
r = await watch({ now: Date.now(), tell });
ok('a burst of server errors is seen', r.problems.includes('errors'), r.problems);
ok('and told', told.slice(before).some((m) => /server errors in the last hour/.test(m.title)), told.slice(before));

console.log('\nPAST A SHARD\'S CAP, STILL COUNTED  (decision 0187)');
for (const k of shardKeys()) await casDoc(k, () => ({}), (d) => { d.list = []; d.n = 0; return true; });
await casDoc(shardKeys()[2], () => ({}), (d) => { d.list = [{ at: Date.now(), where: 'x', msg: 'kept' }]; d.n = 400; return true; });
eq('rows that fell off a full shard are still in the hour\'s count', (await look(Date.now())).errors, 400);

console.log('\nTHE STORE DOES NOT ANSWER');
__failReads(/^gigsched$/);
const s = await hush(() => look(Date.now()));
ok('a failed read is itself a problem, not "all well"', s.problems.some((p) => p.kind === 'store'), s.problems);
h = await hush(health);
eq('and the health address is a 503', h.status, 503);
__failReads(null);

console.log('\nTHE WATCH ITSELF STOPS');
await bell(Date.now() - 30e3);
await casDoc(WATCH, () => ({}), (d) => { d.lastAt = Date.now() - 45 * 60e3; d.told = {}; return true; });
for (const k of shardKeys()) await casDoc(k, () => ({}), (d) => { d.list = []; d.n = 0; return true; });
h = await health();
eq('the outside check can see it: 503', h.status, 503);
eq('why: the watch has not run', h.why, ['watch']);

console.log('\nA FAILED TELL DOES NOT STOP THE WATCH');
await bell(Date.now() - BELL_STALE_MS - 60e3);
r = await hush(() => watch({ now: Date.now(), tell: async () => { throw new Error('push is down'); } }));
eq('it still reports what it saw', r.problems, ['bell']);
ok('and stamps that it ran', Date.now() - (((await readDoc(WATCH, null)).data || {}).lastAt || 0) < 5000);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
