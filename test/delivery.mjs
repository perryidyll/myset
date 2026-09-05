/* A PAYMENT THAT IS TAKEN MUST BE DELIVERED, OR STILL BE OWED.

   `redeemSession` claims the Stripe session before it grants the votes, so that a
   double-tap and a webhook racing the return page cannot grant twice. The claim used
   to be the ONLY marker — so if the grant failed after it (a shard write acked but
   not stuck, the function dying between the two), the money was taken, the votes were
   never granted, and all three recovery paths answered "already". That is the
   2026-08-30 failure — a real $3 charge that delivered nothing — with a different
   cause, and INVARIANT 5c says a payment must have more than one path to delivery.

   So the claim is now UNDELIVERED until the grant lands, and the grant is idempotent
   per (fan, session) on the fan record — because without that, the retry that fixes
   losing votes would start minting them instead. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake_for_local_tests_only';

const admin  = (await import('../netlify/functions/admin.mjs')).default;
const revFn  = (await import('../netlify/functions/revenue.mjs')).default;
const { redeemSession } = await import('../netlify/functions/_pay.mjs');
const { readMeta, readFans } = await import('../netlify/functions/_lib.mjs');
const { __failWrites } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const A = (action, extra = {}) => (async () => {
  const r = await admin(new Request('https://x/api/admin?code=devlocal', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...extra }) }));
  return r.json();
})();

/* A REALISTIC CREATION TIME. These were a fixed 2025 timestamp, which only worked
   because the Stripe test double ignored the `created` window. It no longer does —
   and neither does Stripe — so a session dated last year now falls outside
   revenue.mjs's 180-day window exactly as a real one would. */
const RECENT = Math.floor(Date.now() / 1000) - 3600;
const sess = (id, fan, votes) => ({
  id, payment_status: 'paid', amount_total: 500, created: RECENT,
  metadata: { fan, kind: 'votes', votes: String(votes) },
});
const extraOf = async (fan) => ((await readFans('perry-idyll'))[fan] || {}).extra || 0;
const marker  = async (sid) => (await readMeta('perry-idyll')).paid[sid] || null;

console.log('\nSETUP');
await A('addSong', { title: 'Alpha', artist: 'T' });
await A('status', { status: 'live' });

console.log('\nTHE HAPPY PATH IS UNCHANGED');
const r1 = await redeemSession('perry-idyll', sess('cs_ok', 'ann', 5));
ok('it grants', r1.ok, r1);
eq('five votes', await extraOf('ann'), 5);
eq('and the marker says delivered', (await marker('cs_ok')).delivered, true);
const r1b = await redeemSession('perry-idyll', sess('cs_ok', 'ann', 5));
eq('a replay is refused as already done', r1b.already, true);
eq('and grants nothing more', await extraOf('ann'), 5);

console.log('\nA GRANT LOST AFTER THE CLAIM LEAVES THE MONEY OWED, NOT SETTLED');
__failWrites(/^f\d+_/);                     // every fan shard: acked, never stuck
const r2 = await redeemSession('perry-idyll', sess('cs_lost', 'bob', 9)).catch((e) => ({ threw: String(e.message) }));
eq('bob got nothing', await extraOf('bob'), 0);
const m2 = await marker('cs_lost');
ok('the session IS claimed, so nothing can double-grant', !!m2, m2);
eq('THE FIX: and it is marked UNDELIVERED', m2.delivered, false);
eq('with the amount still owed recorded', m2.granted, 9);

console.log('\nAND THE SWEEP SEES IT AS WORK TO DO');
const { __stripe } = await import('./stripe-fake.mjs');
__stripe.sessions.set('cs_lost', { session: { ...sess('cs_lost', 'bob', 9),
  metadata: { fan: 'bob', kind: 'votes', votes: '9', artist: 'perry-idyll' } }, onAccount: '' });
const rev = await (await revFn(new Request('https://x/api/revenue?code=devlocal'))).json();
const row = (rev.payments || []).find((p) => p.id === 'cs_lost');
ok('the sweep lists it', !!row, rev.payments);
eq('THE FIX: and does NOT call it redeemed', row.redeemed, false);
ok('so it counts as outstanding', rev.unredeemed >= 1, rev.unredeemed);

console.log('\nWITH THE STORE HEALTHY, THE RETRY DELIVERS — EXACTLY ONCE');
__failWrites(null);
const r3 = await redeemSession('perry-idyll', sess('cs_lost', 'bob', 9));
ok('it re-attempts rather than answering "already"', r3.ok && !r3.already, r3);
eq('and says it was a redelivery', r3.redelivered, true);
eq('bob finally has his nine', await extraOf('bob'), 9);
eq('the marker is delivered now', (await marker('cs_lost')).delivered, true);

console.log('\nAND A THIRD ATTEMPT CANNOT MINT A SECOND PACK');
await redeemSession('perry-idyll', sess('cs_lost', 'bob', 9));
await redeemSession('perry-idyll', sess('cs_lost', 'bob', 9));
eq('still exactly nine', await extraOf('bob'), 9);

console.log('\nEVEN IF THE DELIVERED FLIP ITSELF IS LOST  (the double-grant trap)');
/* The dangerous case: the votes DID land but the marker never got flipped. A retry
   must see the fan-side record and hand out nothing. */
const gone = await redeemSession('perry-idyll', sess('cs_flip', 'cara', 4));
ok('cara is granted', gone.ok, gone);
eq('four', await extraOf('cara'), 4);
const { casDoc } = await import('../netlify/functions/_lib.mjs');
await casDoc('meta_perry-idyll', () => ({}), (m) => { m.paid['cs_flip'].delivered = false; return true; });
const again = await redeemSession('perry-idyll', sess('cs_flip', 'cara', 4));
ok('the retry runs', again.ok, again);
eq('THE TRAP: she still has exactly four, not eight', await extraOf('cara'), 4);
eq('and the marker is repaired', (await marker('cs_flip')).delivered, true);
ok('her grant history records the session once',
   ((await readFans('perry-idyll')).cara.gr || []).filter((x) => x === 'cs_flip').length === 1,
   ((await readFans('perry-idyll')).cara || {}).gr);

console.log('\nA TIP NEEDS NO GRANT, SO IT IS DELIVERED ON THE SPOT');
const tip = await redeemSession('perry-idyll', { id: 'cs_tip', payment_status: 'paid',
  amount_total: 2000, created: RECENT, metadata: { fan: 'dan', kind: 'tip', note: 'great set' } });
ok('accepted', tip.ok, tip);
eq('delivered immediately', (await marker('cs_tip')).delivered, true);
eq('and it reached the tips ledger', (await readMeta('perry-idyll')).tips.slice(-1)[0].amount, 20);

delete process.env.STRIPE_SECRET_KEY;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
