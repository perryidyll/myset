/* NO DEPLOY LANDS ON A LIVE ROOM  (decision 0196; live.mjs, tools/hold.sh)

   One address answers how many shows are on right now, from the artists' own show
   records (0154), and says when it is not sure. Netlify's build asks it before
   building production; the outside watch asks it before releasing a held build. */
process.env.ADMIN_CODE = 'devlocal';
const { countLive, LIVE_READ_MS } = await import('../netlify/functions/live.mjs');
const liveFn = (await import('../netlify/functions/live.mjs')).default;
const { createArtist } = await import('../netlify/functions/_auth.mjs');
const { casDoc, readDoc } = await import('../netlify/functions/_lib.mjs');
const { __failReads, __slowReads } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const quiet = console.error; const hush = async (fn) => { console.error = () => {}; try { return await fn(); } finally { console.error = quiet; } };
const ask = async () => { const r = await liveFn(new Request('https://x/api/live')); return { status: r.status, cdn: r.headers.get('netlify-cdn-cache-control'), ...(await r.json().catch(() => ({}))) }; };
const setShow = (aid, status) => casDoc(`show_${aid}`, () => ({ v: 1, songs: [] }), (d) => { d.status = status; d.startedAt = Date.now(); return true; });

console.log('\nTHREE ARTISTS, NOBODY ON STAGE');
const ids = [];
for (const [i, slug] of ['hold-one', 'hold-two', 'hold-three'].entries()) {
  const a = await createArtist({ email: `${slug}@hold.example`, name: `Hold ${i + 1}`, slug });
  ids.push(a.artistId);
}
ok('three artists exist', ids.every(Boolean), ids);
await setShow(ids[0], 'ended'); await setShow(ids[1], 'pre');
let r = await countLive();
eq('no show is live', r.live, 0);
ok('and the count is sure: every record was read or absent', r.sure === true && r.unread === 0 && r.artists >= 3, r);
let h = await ask();
eq('the address answers 200', h.status, 200);
ok('never kept at the edge', /no-store/.test(h.cdn || ''), h.cdn);
ok('counts only — no names, no ids', !JSON.stringify(h).includes(ids[0]) && !/Hold/.test(JSON.stringify(h)), h);

console.log('\nONE SHOW STARTS');
await setShow(ids[1], 'live');
r = await countLive();
eq('one show is live', r.live, 1);
eq('sure', r.sure, true);
h = await ask();
eq('the address says so', h.live, 1);

console.log('\nIT ENDS');
await setShow(ids[1], 'ended');
r = await countLive();
eq('nobody is live', r.live, 0);

console.log('\nA RECORD CANNOT BE READ');
__failReads(new RegExp(`^show_${ids[2]}$`));
r = await hush(() => countLive());
eq('the ones it could read still count', r.live, 0);
eq('but it is not sure', r.sure, false);
eq('and says how many it missed', r.unread, 1);
__failReads(null);

console.log('\nOUT OF TIME');
__slowReads(60);
r = await hush(() => countLive({ deadline: Date.now() + 1 }));
ok('a deadline stops the walk and says it is not sure', r.sure === false && r.unread > 0, r);
__slowReads(0);
ok('the budget is a few seconds, not a page load', LIVE_READ_MS >= 5000 && LIVE_READ_MS <= 15000, LIVE_READ_MS);

console.log('\nTHE STORE IS DOWN');
__failReads(/^artists$/);
h = await hush(() => ask());
eq('the address answers 503, which the callers read as "hold"', h.status, 503);
__failReads(null);

console.log(`\n${pass} ✓  ${fail} ✗`);
process.exit(fail ? 1 : 0);
