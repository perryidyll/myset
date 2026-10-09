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
const { __failWrites, __failReads } = await import('./blobs-fake.mjs');

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

console.log('\nTHE WEBHOOK SAYS SO WHEN A GRANT FAILS  (decision 0138)');
/* It used to catch the failure and answer 200, so Stripe — told "received" — never
   sent the event again. A failed grant must answer non-2xx, and must be written down
   for the bell to retry, because Stripe's own retries back off over hours. */
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
const hookFn = (await import('../netlify/functions/webhook.mjs')).default;
const { redeliverOwed, noteOwed, OWED, OWED_KEEP_MS } = await import('../netlify/functions/_pay.mjs');
const { readDoc } = await import('../netlify/functions/_lib.mjs');
const hook = (event) => hookFn(new Request('https://x/api/webhook', { method: 'POST',
  headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=testsig' }, body: JSON.stringify(event) }));
const owed = async () => (((await readDoc(OWED, null)).data || {}).rows) || {};
const paidEvent = (id, fan, votes) => {
  const session = { ...sess(id, fan, votes), metadata: { fan, kind: 'votes', votes: String(votes), artist: 'perry-idyll' } };
  __stripe.sessions.set(id, { session, onAccount: '' });
  return { type: 'checkout.session.completed', data: { object: session } };
};

const good = await hook(paidEvent('cs_hook_ok', 'eve', 3));
eq('a grant that lands answers 200', good.status, 200);
eq('eve has her three', await extraOf('eve'), 3);
eq('and nothing is owed', Object.keys(await owed()).length, 0);

__failWrites(/^f\d+_/);
const lost = await hook(paidEvent('cs_hook_lost', 'fay', 7));
ok('THE FIX: a grant that fails answers an error, so Stripe sends it again', lost.status >= 500, lost.status);
eq('fay has nothing yet', await extraOf('fay'), 0);
ok('and the payment is written down as owed', !!(await owed()).cs_hook_lost, await owed());
eq('to the right artist', ((await owed()).cs_hook_lost || {}).aid, 'perry-idyll');

console.log('\nTHE BELL RETRIES WHAT IS OWED');
let ring = await redeliverOwed({});
eq('while the store is still failing, nothing is delivered', ring.delivered, 0);
ok('and the row stays, with the try counted', ((await owed()).cs_hook_lost || {}).tries === 1, await owed());
__failWrites(null);
ring = await redeliverOwed({});
eq('once the store is healthy, the next ring delivers it', ring.delivered, 1);
eq('fay has her seven', await extraOf('fay'), 7);
eq('the marker is delivered', (await marker('cs_hook_lost')).delivered, true);
eq('and nothing is owed any more', Object.keys(await owed()).length, 0);

console.log('\nSTRIPE’S OWN REDELIVERY AND THE BELL CANNOT GRANT TWICE');
const replay = await hook(paidEvent('cs_hook_lost', 'fay', 7));
eq('the redelivered event answers 200', replay.status, 200);
eq('and fay still has exactly seven', await extraOf('fay'), 7);
await noteOwed('perry-idyll', 'cs_hook_lost', '');
ring = await redeliverOwed({});
eq('a stale owed row is cleared without granting again', await extraOf('fay'), 7);
eq('cleared', Object.keys(await owed()).length, 0);

console.log('\nAN OWED ROW IS NOT KEPT FOR EVER');
await noteOwed('perry-idyll', 'cs_never', '', Date.now() - OWED_KEEP_MS - 1000);
ring = await redeliverOwed({});
eq('after three days it is dropped, not retried for ever', Object.keys(await owed()).length, 0);
ok('without asking Stripe for it', ![...__stripe.calls].some((c) => c.method === 'checkout.sessions.retrieve' && c.args.id === 'cs_never'));

console.log('\nA LOST "DELIVERED" FLIP IS NOTICED, AND THE BELL MAKES IT  (decision 0180)');
/* The votes land but the flip does not: it used to be written once with its error
   swallowed, so the marker said undelivered with nothing scheduled to look again. */
{
  const id = 'cs_flip_lost';
  const session = { ...sess(id, 'gil', 6), metadata: { fan: 'gil', kind: 'votes', votes: '6', artist: 'perry-idyll' } };
  __stripe.sessions.set(id, { session, onAccount: '' });
  await casDoc('meta_perry-idyll', () => ({}), (m) => {      // claimed before, never delivered
    m.paid[id] = { kind: 'votes', amount: 5, granted: 6, fan: 'gil', at: Date.now(), delivered: false }; return true; });
  __failWrites(/^meta_/);                                       // every meta write: acked, never stuck
  const r = await redeemSession('perry-idyll', session);
  __failWrites(null);
  ok('the buyer is still told it worked — the votes are on their phone', r.ok, r);
  eq('gil has his six', await extraOf('gil'), 6);
  eq('the marker still says undelivered', (await marker(id)).delivered, false);
  ok('THE FIX: and the session is on the owed list for the bell', !!(await owed())[id], await owed());
  const ring2 = await redeliverOwed({});
  eq('the bell flips it', (await marker(id)).delivered, true);
  eq('without granting a second pack', await extraOf('gil'), 6);
  eq('nothing is owed any more', Object.keys(await owed()).length, 0);
}

console.log('\nTHE GRANT RECEIPT OUTLIVES THE FAN RECORD  (decision 0180)');
/* A record with nothing to carry is deleted when the next show starts, and its
   receipts with it. With the flip lost too, the next sweep granted the pack again. */
{
  const { mutateFan, carryFans, getShow, GR_KEEP } = await import('../netlify/functions/_lib.mjs');
  const id = 'cs_carry';
  const session = { ...sess(id, 'hal', 4), metadata: { fan: 'hal', kind: 'votes', votes: '4', artist: 'perry-idyll' } };
  await redeemSession('perry-idyll', session);
  eq('hal is granted', await extraOf('hal'), 4);
  await mutateFan('perry-idyll', 'hal', (me) => { me.extra = 0; return true; });   // spent it all
  await casDoc('meta_perry-idyll', () => ({}), (m) => { m.paid[id].delivered = false; return true; });  // and the flip was lost
  await carryFans('perry-idyll', await getShow('perry-idyll'));
  ok('his record is gone (nothing to carry)', !(await readFans('perry-idyll')).hal);
  const mk = await marker(id);
  eq('THE FIX: the marker was settled from the receipt first', [mk.delivered, mk.settledBy], [true, 'carry']);
  const sweep = await redeemSession('perry-idyll', session);
  eq('so a later delivery attempt answers "already"', sweep.already, true);
  eq('and hal is not handed the pack again', await extraOf('hal'), 0);
  eq('one receipt cap everywhere', GR_KEEP, 40);
}

console.log('\nTHE SWEEP DOES ONLY WHAT IS OWED  (decision 0181)');
{
  __stripe.sessions.set('cs_sweep_owed', { session: { ...sess('cs_sweep_owed', 'ivy', 2),
    metadata: { fan: 'ivy', kind: 'votes', votes: '2', artist: 'perry-idyll' } }, onAccount: '' });
  const calls = () => __stripe.calls.length;
  const res = await (await revFn(new Request('https://x/api/revenue?code=devlocal', { method: 'POST' }))).json();
  ok('it recovers the one that was owed', (res.results || []).some((x) => x.id === 'cs_sweep_owed'), res);
  eq('ivy has her two', await extraOf('ivy'), 2);
  eq('and says nothing is left', res.left, 0);
  const res2 = await (await revFn(new Request('https://x/api/revenue?code=devlocal', { method: 'POST' }))).json();
  eq('a second press finds nothing to do', [res2.recovered, res2.left], [0, 0]);
}

console.log('\nOLD MARKERS MOVE TO THEIR YEAR, AND STILL ANSWER "ALREADY"  (decision 0193)');
/* `meta.paid` kept every marker for ever and every payment rewrote all of it. A
   delivered marker older than 130 days (past Stripe's 120-day dispute window) now moves to `paidarc_<aid>_<YYYY>`, and
   the dangerous case is the one PAY-6 named: the fan record (and its receipt) is
   long gone, so if the claim check did not look in the archive, any later delivery
   attempt would grant the pack again. */
{
  const P = await import('../netlify/functions/_pay.mjs');
  const { archivePaid, archiveDue, readPaidAll, PAIDARC, PAID_KEEP_MS } = P;
  const AID = 'perry-idyll';
  const DAY = 86400e3;
  const NOW = Date.now();
  const oldAt = NOW - 140 * DAY;                      // past the 130 days
  const Y = new Date(oldAt).getUTCFullYear();
  const oldSess = (id, fan, votes) => ({ id, payment_status: 'paid', amount_total: 500, created: Math.floor(oldAt / 1000),
    metadata: { fan, kind: 'votes', votes: String(votes), artist: AID } });
  const arcDoc = async (y = Y) => (await readDoc(PAIDARC(AID, y), null)).data;
  const seed = (rows) => casDoc('meta_perry-idyll', () => ({}), (m) => { Object.assign(m.paid, rows); return true; });
  await seed({
    cs_arc_old:   { kind: 'votes', amount: 5, granted: 5, fan: 'jo', at: oldAt, song: '', show: 'show-old', delivered: true, deliveredAt: oldAt + 5000 },
    cs_arc_owed:  { kind: 'votes', amount: 5, granted: 3, fan: 'kit', at: oldAt - DAY, song: '', show: 'show-old', delivered: false },
    cs_arc_young: { kind: 'tip', amount: 2, granted: 0, fan: 'lu', at: NOW - 10 * DAY, song: '', show: 'show-new', delivered: true },
    cs_arc_2025:  { kind: 'tip', amount: 1, granted: 0, fan: 'mo', at: Date.UTC(2025, 5, 1), song: '', show: '', delivered: true },
  });
  const before = JSON.stringify((await readMeta(AID)).paid.cs_arc_old);
  eq('jo has no fan record — his receipt went with his last show', (await readFans(AID)).jo, undefined);

  // the archive write is acked and never sticks: nothing may leave meta
  __failWrites(/^paidarc_/);
  const failed = await archivePaid(AID, { now: NOW });
  __failWrites(null);
  eq('THE ORDER: with the archive write lost, nothing is moved', failed.moved, 0);
  ok('and the old marker is still in meta, untouched', JSON.stringify((await readMeta(AID)).paid.cs_arc_old) === before);
  ok('the failed year is named', failed.failedYears.includes(Y), failed);

  // the archive lands but the trim of meta is lost: the marker is in BOTH, never neither
  __failWrites(/^meta_/);
  const half = await archivePaid(AID, { now: NOW });
  __failWrites(null);
  eq('with the meta trim lost, nothing counts as moved', half.moved, 0);
  ok('the marker is in its year', !!((await arcDoc()) || { paid: {} }).paid.cs_arc_old);
  ok('AND still in meta — both, never neither', !!(await readMeta(AID)).paid.cs_arc_old);
  eq('a replay while it is in both answers "already"', (await redeemSession(AID, oldSess('cs_arc_old', 'jo', 5))).already, true);

  const moved = await archivePaid(AID, { now: NOW });
  eq('the next pass finishes the move: one marker', moved.moved, 1);
  const m = (await readMeta(AID)).paid;
  ok('the delivered old marker left meta', !m.cs_arc_old, m.cs_arc_old);
  eq('and sits in paidarc_<aid>_<year>, byte for byte', JSON.stringify((await arcDoc()).paid.cs_arc_old), before);
  eq('the archive is shaped { v:1, paid }', (await arcDoc()).v, 1);
  ok('THE RULE: an UNDELIVERED marker never moves, however old', !!m.cs_arc_owed && !(await arcDoc()).paid.cs_arc_owed);
  ok('a delivered marker inside 130 days stays', !!m.cs_arc_young && !(await arcDoc()).paid.cs_arc_young);
  ok('a marker dated before MySet’s first year stays (no key could find it)', !!m.cs_arc_2025);
  eq('a second pass moves nothing', (await archivePaid(AID, { now: NOW })).moved, 0);
  eq('the limit is honoured (oldest first, none here)', (await archivePaid(AID, { now: NOW + 365 * DAY, limit: 0 })).moved, 0);

  console.log('\n  the double-grant guard');
  const calls = __stripe.calls.length;
  const replay = await redeemSession(AID, oldSess('cs_arc_old', 'jo', 5));
  ok('THE GUARD: an archived session answers "already"', replay.ok && replay.already === true, replay);
  eq('with its marker', [replay.kind, replay.granted, replay.fan], ['votes', 5, 'jo']);
  eq('and grants NOTHING — jo has no record to hold a receipt, so only the archive stood between him and a second pack', await extraOf('jo'), 0);
  ok('nor is the session re-claimed in meta', !(await readMeta(AID)).paid.cs_arc_old);
  eq('Stripe was not asked anything', __stripe.calls.length, calls);

  __failReads(/^paidarc_/);
  const blind = await redeemSession(AID, oldSess('cs_arc_old', 'jo', 5)).catch((e) => ({ threw: String(e.message) }));
  __failReads(null);
  ok('an archive that cannot be read is an error, never a grant', !!blind.threw, blind);
  eq('still nothing for jo', await extraOf('jo'), 0);

  const never = await redeemSession(AID, oldSess('cs_arc_never', 'nia', 4));
  ok('an OLD session that was never claimed at all is still owed — granted, not refused', never.ok && !never.already, never);
  eq('nia has her four', await extraOf('nia'), 4);

  const young = { id: 'cs_arc_fresh', payment_status: 'paid', amount_total: 500, created: Math.floor(NOW / 1000) - 60,
    metadata: { fan: 'ola', kind: 'votes', votes: '2', artist: AID } };
  __failReads(/^paidarc_/);                           // a fresh claim must not even look
  const fresh = await redeemSession(AID, young).catch((e) => ({ threw: String(e.message) }));
  __failReads(null);
  ok('a session younger than the margin never reads the archive (the fan’s path costs nothing)', fresh.ok && !fresh.already, fresh);

  console.log('\n  the Money tab');
  __stripe.sessions.set('cs_arc_old', { session: oldSess('cs_arc_old', 'jo', 5), onAccount: '' });
  const rev = await (await revFn(new Request('https://x/api/revenue?code=devlocal'))).json();
  const row = (rev.payments || []).find((p) => p.id === 'cs_arc_old');
  ok('the old session is listed (inside the 180-day window)', !!row, rev.payments && rev.payments.map((p) => p.id));
  eq('THE FIX: and called redeemed, from its archive', row && row.redeemed, true);
  const sweep = await (await revFn(new Request('https://x/api/revenue?code=devlocal', { method: 'POST' }))).json();
  ok('the sweep does not touch it', !(sweep.results || []).some((x) => x.id === 'cs_arc_old'), sweep);
  eq('jo still has nothing', await extraOf('jo'), 0);

  console.log('\n  the lifetime readers');
  const all = await readPaidAll(AID);
  ok('readPaidAll: the archive and meta together', !!all.cs_arc_old && !!all.cs_arc_young && !!all.cs_arc_owed, Object.keys(all));
  const { artistPart } = await import('../netlify/functions/_metrics.mjs');
  const meta = await readMeta(AID);
  const pack = (part) => part.money.filter((x) => x.t === oldAt && x.kind === 'pack');
  eq('_metrics without the archive has lost the old pack (why the archive is passed in)', pack(artistPart(AID, { meta })).length, 0);
  eq('_metrics with it counts the pack once', pack(artistPart(AID, { meta, arc: [await arcDoc()] })).map((x) => [x.amount, x.votes]), [[5, 5]]);
  eq('a marker in both places is counted once', pack(artistPart(AID, { meta: { ...meta, paid: { ...meta.paid, cs_arc_old: (await arcDoc()).paid.cs_arc_old } }, arc: [await arcDoc()] })).length, 1);

  console.log('\n  the key lists');
  const { keysFor } = await import('../netlify/functions/_account.mjs');
  const { keysForVenue } = await import('../netlify/functions/_venueaccount.mjs');
  ok('deleting an artist deletes their archive years', (await keysFor(AID)).includes(PAIDARC(AID, Y)));
  ok('and a venue’s', (await keysForVenue('somebar')).includes(PAIDARC('v_somebar', Y)));
  const { skipped } = await import('../netlify/functions/_mirror.mjs');
  ok('the off-site copy keeps it (real money history)', !skipped(PAIDARC(AID, Y)));

  console.log('\n  the bell’s pass');
  await casDoc('artists', () => ({ byId: {} }), (r) => { r.byId ||= {}; r.byId[AID] ||= { slug: 'perry', name: 'Perry' }; return true; });
  await seed({ cs_arc_bell: { kind: 'votes', amount: 5, granted: 2, fan: 'pip', at: oldAt + 1000, song: '', show: '', delivered: true } });
  const ring1 = await archiveDue({ now: NOW, deadline: Date.now() + 2000 });
  ok('a pass over every owner reaches the end and resets its cursor', ring1.done && ring1.next === 0, ring1);
  ok('and moves what is due', ring1.moved >= 1 && !!(await arcDoc()).paid.cs_arc_bell && !(await readMeta(AID)).paid.cs_arc_bell, ring1);
  const ring2 = await archiveDue({ now: NOW, deadline: 0 });
  ok('with no time left it still does one chunk, so a pass always moves', ring2.looked >= 1, ring2);
  eq('PAID_KEEP_DAYS is 130 — a dispute (up to 120 days) always finds its marker in meta', PAID_KEEP_MS, 130 * DAY);
}

console.log('\nTHE MONEY TAB IS NET OF WHAT WENT BACK  (decision 0194, after 0177)');
{
  const id = 'cs_refund_tip';
  const session = { id, payment_status: 'paid', amount_total: 1500, created: RECENT,
    metadata: { fan: 'jo', kind: 'tip', artist: 'perry-idyll' } };
  __stripe.sessions.set(id, { session, onAccount: '' });
  await redeemSession('perry-idyll', session);
  const get = async () => (await revFn(new Request('https://x/api/revenue?code=devlocal'))).json();
  const before = await get();
  const row0 = before.payments.find((p) => p.id === id);
  eq('untouched: the row reads its full price, nothing went back', [row0.amount, row0.gross, row0.lost, row0.refunded, row0.dispute], [15, 15, 0, 0, '']);
  await casDoc('meta_perry-idyll', () => ({}), (m) => { m.paid[id].lost = 500; m.paid[id].refunded = 500; return true; });
  const after = await get();
  const row = after.payments.find((p) => p.id === id);
  eq('THE FIX: $5 refunded reads $5 less on its row', row.amount, 10);
  eq('and gross keeps the original charge', row.gross, 15);
  eq('the row carries what went back', [row.lost, row.refunded, row.dispute], [500, 500, '']);
  eq('the total is $5 less', Math.round((before.totals.all - after.totals.all) * 100), 500);
  eq('and so are the tips', Math.round((before.totals.tips - after.totals.tips) * 100), 500);
  eq('the total is the sum of the net rows', after.totals.all, Math.round(after.payments.reduce((a, p) => a + p.amount, 0) * 100) / 100);
  await casDoc('meta_perry-idyll', () => ({}), (m) => {
    m.paid[id].dispute = { id: 'dp_1', status: 'needs_response', cents: 1000 }; m.paid[id].lost = 1500; return true; });
  const disp = (await get()).payments.find((p) => p.id === id);
  eq('a chargeback on the rest: nothing left, gross unchanged, the status carried', [disp.amount, disp.gross, disp.lost, disp.dispute], [0, 15, 1500, 'needs_response']);
  await casDoc('meta_perry-idyll', () => ({}), (m) => { m.paid[id].lost = 99999; return true; });
  eq('a marker can never take back more than was charged', (await get()).payments.find((p) => p.id === id).amount, 0);
}

delete process.env.STRIPE_WEBHOOK_SECRET;
delete process.env.STRIPE_SECRET_KEY;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
