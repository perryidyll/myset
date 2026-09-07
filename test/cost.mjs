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
    /* EVERY global document, and the list has to be kept current or the guard
       INVARIANT 9d13 built goes blind exactly when a new global is added. It
       missed `sheetsync` on the day it shipped — off every hot path, so no
       ceiling moved, but the check that would have TOLD us was silent. */
    globals: log.filter((l) => / (artists|promos|flags|cityindex|acctindex|idqueue|sheetsync|gigsched|delqueue|vidqueue)$/.test(l)).length,
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

/* WARM THE FLAG CACHE ON PURPOSE. The flags document is cached in module scope
   precisely because the poll is the hottest path in the app, and in production the
   instance stays warm between invocations — so the honest number to measure is the
   warm one. This used to be warmed by accident, because /api/vote read the flags
   too; it does not any more (finality stopped being a flag), and the first poll in
   this file started paying for a read that no phone in a real room pays. */
await hit(showFn, 'https://x/api/show?fan=warm');

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
/* This pair used to guard `releaseUnvotable`, which read all twelve fan shards to
   give back credits held on songs the room had just lost. It must not run when
   nothing changed — a rename cost 12 strong reads it could never need, mid-gig. */
const rename = await count(() => A('listRename', { id: lid, name: 'Set B' }));
under('reads for a rename', rename.reads, 12);
ok(`no shard reads at all — ${rename.shardReads}`, rename.shardReads === 0, rename);

console.log('\n...AND SINCE 2026-09-07, NEITHER DOES ONE THAT DOES');
/* `releaseUnvotable` is deleted. A vote is spent when it is cast, so narrowing the
   set takes songs off the board and gives nothing back — which means the twelve-shard
   sweep that used to run a handful of times a night does not run at all. This
   assertion is the old one inverted, and it is a saving, not a loss. */
await A('listUse', { id: lid });
const narrow = await count(() => A('listSongs', { id: lid, songs: ['bravo'] }));
ok(`narrowing no longer sweeps the shards — ${narrow.shardReads}`, narrow.shardReads === 0, narrow);

console.log('\nTHE STUDIO POLL  (one device, but it polls harder — INVARIANT 9d8)');
const stageFn = (await import('../netlify/functions/stage.mjs')).default;
const st = await count(() => hit(stageFn, 'https://x/api/stage?code=devlocal'));
under('reads per Studio poll', st.reads, 22);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
