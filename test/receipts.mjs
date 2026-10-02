/* THE CAST RECEIPTS ARE SHORT  (decision 0148)

   Every vote rewrites one of the twelve fan files whole, so every byte on every
   record in it is moved by every writer of that file. The receipts that make a retry
   safe (INVARIANT 15h) were the largest thing on a voter's record — about 118 bytes
   each, twenty kept for the night. They are now [key, at, votes, cost, remaining],
   kept for thirty minutes. This file holds the three things that must stay true:
   a retry is still answered from memory, a receipt written before the change is
   still honoured, and the next write to a file leaves nothing long or stale in it. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin = (await import('../netlify/functions/admin.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const L = await import('../netlify/functions/_lib.mjs');
const { readFans, readDoc, store, KEY, shardOf, mutateFan, keepReceipts, findReceipt, receipt,
        RECEIPTS_KEPT, RECEIPT_MS, DEFAULT_ARTIST } = L;

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
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const A = (action, extra = {}) => hit(admin, 'https://x/api/admin?code=devlocal', { action, ...extra });
const send = (fan, song, cast, n = 1) => hit(voteFn, 'https://x/api/vote', { fan, song, n, op: 'cast', cast });
const AID = DEFAULT_ARTIST;
const rec = async (fan) => (await readFans(AID))[fan] || null;
const votesOn = async (fan, song) => (((await rec(fan)) || {}).v || []).filter((x) => x === song).length;
/* A fan id that lives in the same file as `target`, so one's write can be watched
   tidying the other's record. */
const sameFile = (base, target = base) => {
  const want = shardOf(target);
  for (let i = 0; ; i++) { const id = base + 'n' + i; if (shardOf(id) === want) return id; }
};

console.log('\nSETUP');
for (const t of ['Alpha', 'Bravo', 'Charlie', 'Delta']) await A('addSong', { title: t, artist: 'T' });
await A('freeCredits', { n: 40 });
await A('status', { status: 'live' });
ok('the room is live', (await L.getShow(AID)).status === 'live');

console.log('\nA CAST LEAVES A SHORT RECEIPT');
const first = await send('ann', 'alpha', 'castreceipt000001', 2);
ok('the cast lands', first.ok && first.votes === 2, first);
const r1 = (await rec('ann')).casts;
ok('one receipt, an array, not an object', Array.isArray(r1) && r1.length === 1 && Array.isArray(r1[0]), r1);
ok('the id is a twelve-character hash, never the id itself',
   /^[0-9a-f]{12}$/.test(r1[0][0]) && !JSON.stringify(r1).includes('castreceipt000001'), r1[0]);
eq('and the outcome is three numbers: votes, cost, credits left', r1[0].slice(2), [2, 2, 38]);
ok('it is under fifty bytes', JSON.stringify(r1[0]).length < 50, JSON.stringify(r1[0]).length);

console.log('\nTHE RETRY IS STILL ANSWERED FROM MEMORY  (INVARIANT 15h)');
const again = await send('ann', 'alpha', 'castreceipt000001', 2);
ok('the same id is a replay', again.ok && again.replay === true, again);
eq('with the first answer', [again.votes, again.cost, again.remaining], [2, 2, 38]);
eq('and nothing was cast twice', await votesOn('ann', 'alpha'), 2);
const other = await send('ann', 'bravo', 'castreceipt000002');
ok('a different id is a different cast', other.ok && !other.replay && other.remaining === 37, other);
await A('unlimitedFan', { fan: 'ulla', on: true });
const ul = await send('ulla', 'charlie', 'castreceipt000003');
const ul2 = await send('ulla', 'charlie', 'castreceipt000003');
ok('an unlimited phone has nothing left to count, and its replay says so too',
   ul.ok && ul.remaining === null && ul2.replay === true && ul2.remaining === null, [ul, ul2]);

console.log('\nA RECEIPT WRITTEN BEFORE THE CHANGE IS STILL HONOURED');
/* The record as every voter's looked before decision 0148: the long kind. Written
   straight into the file, the way it sits on the night this deploys. */
const old = sameFile('olga'), key = KEY.fan(AID, shardOf(old));
const now = Date.now();
{
  const { data } = await readDoc(key, {});
  data[old] = { v: ['delta'], extra: 0, ts: { delta: now - 6e4 }, spent: 0, va: { delta: [[1, 0, now - 6e4, 0]] },
    used: 1, freeUsed: 1, casts: [{ id: 'oldlongcast000001', at: now - 6e4, out: { voted: true, votes: 1, cost: 1, remaining: 39 } },
                                  { id: 'oldlongcast000000', at: now - RECEIPT_MS - 6e4, out: { voted: true, votes: 1, cost: 1, remaining: 40 } }] };
  await store().set(key, JSON.stringify(data));
}
const fromOld = await send(old, 'delta', 'oldlongcast000001');
ok('a retry of a cast made before the change is a replay', fromOld.ok && fromOld.replay === true, fromOld);
eq('with the answer it had', [fromOld.votes, fromOld.cost, fromOld.remaining], [1, 1, 39]);
eq('and it cast nothing', await votesOn(old, 'delta'), 1);

console.log('\nTHE NEXT WRITE TO A FILE TIDIES EVERY RECORD IN IT');
/* Somebody else in the same file votes. Their write carries the whole file, so it
   shortens the long receipt and drops the stale one — on a record it did not own. */
const neighbour = sameFile('nell', old);
ok('(a neighbour in the same file)', shardOf(neighbour) === shardOf(old));
const before = await rec(old);
await send(neighbour, 'alpha', 'castreceipt000004');
const after = await rec(old);
ok('the long receipt is short now', Array.isArray(after.casts) && after.casts.every(Array.isArray), after.casts);
eq('the one past thirty minutes is gone, the recent one kept', after.casts.length, 1);
const { casts: _a, ...restAfter } = after, { casts: _b, ...restBefore } = before;
eq('and nothing else on that record moved', restAfter, restBefore);
const stillOld = await send(old, 'delta', 'oldlongcast000001');
ok('the shortened receipt still answers its retry', stillOld.replay === true && stillOld.remaining === 39, stillOld);
eq('still one vote', await votesOn(old, 'delta'), 1);
const stale = await send(old, 'delta', 'oldlongcast000000');
ok('a retry older than the window is a new cast — the limit, said plainly', stale.ok && !stale.replay, stale);
const all = await readFans(AID);
ok('no long receipt is left in any file that was written',
   Object.entries(all).filter(([id]) => shardOf(id) === shardOf(old))
     .every(([, f]) => !f.casts || f.casts.every(Array.isArray)));

console.log('\nAT MOST TWENTY ARE KEPT, NEWEST LAST');
const many = Array.from({ length: RECEIPTS_KEPT + 5 }, (_, i) => receipt('manycast' + String(i).padStart(10, '0'), now - 1000 + i, { votes: 1, cost: 1, remaining: 0 }));
const kept = keepReceipts(many, now);
eq('twenty', kept.length, RECEIPTS_KEPT);
ok('the newest twenty', findReceipt(kept, 'manycast' + String(RECEIPTS_KEPT + 4).padStart(10, '0')) && !findReceipt(kept, 'manycast0000000000'));
ok('an empty list is no receipts', keepReceipts(undefined, now).length === 0 && findReceipt(undefined, 'x') === null);
/* A record whose every receipt has aged out carries no `casts` at all — not an
   empty array, which is still bytes on every write of the file. */
{
  const quiet = 'quinn';
  await mutateFan(AID, quiet, (me) => { me.casts = [receipt('quietcast00000001', now - RECEIPT_MS - 1, { votes: 1, cost: 1, remaining: 0 })]; return true; });
  ok('a record whose receipts all aged out has no receipt list at all', !('casts' in (await rec(quiet))), await rec(quiet));
}

console.log('\nA VOTER\'S RECORD IS LIGHTER');
/* The measured figure before decision 0148: 794 bytes after three casts on three
   songs, 358 of them receipts. The ceiling below is the change, held. */
const three = 'thea';
for (const [i, s] of ['alpha', 'bravo', 'charlie'].entries()) await send(three, s, 'threecast00000' + i);
const tr = await rec(three);
ok(`three receipts in ${JSON.stringify(tr.casts).length} bytes (were 358)`, JSON.stringify(tr.casts).length <= 130, tr.casts);
ok(`the whole record in ${JSON.stringify(tr).length} bytes (was 794)`, JSON.stringify(tr).length <= 600, JSON.stringify(tr).length);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
