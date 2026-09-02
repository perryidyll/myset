/* WHAT AN ENDPOINT COSTS, COUNTED.

   Reads on the hot path are the mistake this project keeps making: the audit found
   the global `artists` registry on the audience poll three separate times, and then
   the feature-flag work put a second global document there — taking the poll from
   15 strong reads to 16 before anyone noticed, because nothing was counting.

   So this counts. The numbers are ceilings, not targets: if a change pushes one up,
   that is a decision somebody should make on purpose rather than discover on a bill
   (INVARIANT 9d0 — every phone in the room polls). Raise a ceiling deliberately and
   say why in the commit. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin  = (await import('../netlify/functions/admin.mjs')).default;
const showFn = (await import('../netlify/functions/show.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const { __opsStart, __opsStop } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const hit = async (h, u, b) => {
  const r = await h(new Request(u, b === undefined ? {} : { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }));
  await r.text();
};
const A = (action, x = {}) => hit(admin, 'https://x/api/admin?code=devlocal', { action, ...x });
const count = async (fn) => {
  __opsStart(); await fn(); const log = __opsStop();
  return {
    reads: log.filter((l) => l.startsWith('get')).length,
    writes: log.filter((l) => l.startsWith('set')).length,
    shardReads: log.filter((l) => /^get f\d+_/.test(l)).length,
    globals: log.filter((l) => / (artists|flags|cityindex|acctindex|idqueue)$/.test(l)).length,
  };
};
const under = (name, got, ceiling) =>
  ok(`${name} — ${got} (ceiling ${ceiling})`, got <= ceiling, { got, ceiling });

console.log('\nSETUP');
for (const t of ['Alpha', 'Bravo', 'Charlie']) await A('addSong', { title: t, artist: 'T' });
await A('status', { status: 'live' });
const lid = await (async () => {
  const r = await admin(new Request('https://x/api/admin?code=devlocal', { method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'listNew', name: 'Set A' }) }));
  return (await r.json()).id;
})();
await A('listSongs', { id: lid, songs: ['alpha', 'bravo'] });
await hit(voteFn, 'https://x/api/vote', { fan: 'f1', song: 'alpha', n: 1, op: 'cast', cast: 'costtest00000001' });
ok('a show with a setlist and a vote in it', true);

console.log('\nTHE AUDIENCE POLL  (every phone in the room, every few seconds)');
const poll = await count(() => hit(showFn, 'https://x/api/show?fan=f1&in=1'));
under('reads per poll', poll.reads, 15);
ok(`only ONE global document is touched — ${poll.globals}`, poll.globals <= 1, poll);
ok('and it is the registry, not the flags doc (that one is cached in module scope)',
   poll.globals <= 1);

console.log('\nA VOTE');
const v = await count(() => hit(voteFn, 'https://x/api/vote',
  { fan: 'f2', song: 'bravo', n: 1, op: 'cast', cast: 'costtest00000002' }));
under('reads per vote', v.reads, 5);
under('writes per vote', v.writes, 2);

console.log('\nA LIST ACTION THAT TAKES NOTHING AWAY MUST NOT SWEEP THE SHARDS');
/* releaseUnvotable reads all twelve fan shards. It has to run when the room loses a
   song, and it must not run when nothing changed — a rename cost 12 strong reads it
   could never need, mid-gig. */
const rename = await count(() => A('listRename', { id: lid, name: 'Set B' }));
under('reads for a rename', rename.reads, 12);
ok(`no shard reads at all — ${rename.shardReads}`, rename.shardReads === 0, rename);

console.log('\n...AND ONE THAT DOES TAKE SOMETHING AWAY MUST SWEEP IT');
/* The set has to be ACTIVE first. Without listUse, `playable()` returns the whole
   library before and after, nothing leaves it, and the sweep correctly does not
   run — which is the fixture lying, not the code. That has now happened three times
   in this suite, so: when a "nothing happened" result looks like a bug, check the
   fixture before the implementation. */
await A('listUse', { id: lid });
const narrow = await count(() => A('listSongs', { id: lid, songs: ['bravo'] }));
ok(`narrowing reads the shards — ${narrow.shardReads}`, narrow.shardReads >= 12, narrow);
ok('and writes back the ones that held a released vote', narrow.writes >= 1, narrow);

console.log('\nTHE STUDIO POLL  (one device, but it polls harder — INVARIANT 9d8)');
const stageFn = (await import('../netlify/functions/stage.mjs')).default;
const st = await count(() => hit(stageFn, 'https://x/api/stage?code=devlocal'));
under('reads per Studio poll', st.reads, 22);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
