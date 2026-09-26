/* STRIPE'S OWN FEE, NOT AN ESTIMATE  (_history.mjs feeOfSession, _register.mjs, _showcosts.mjs — EVS-005)

   The shows table's Stripe column was an estimate at the published card rates. The
   founder asked for the exact fee, always. It is read off each payment's balance
   transaction when the night's money is asked of Stripe (filing, Re-check, the
   morning-after ask), filed with the night, and carried to the register and the
   table. A night filed before this is asked once more by the register, a few a ring,
   whatever its age — and never at the cost of the morning-after ask for late tips.

     · the fee is the `stripe_fee` lines, never `bt.fee` (which carries MySet's own
       application fee on a direct charge)
     · a balance transaction settled in another currency comes back with its own rate
     · a payment whose fee did not come back makes the night's fee not exact (null)
     · exact where filed, the estimate only where not, and ≈ only on the estimate */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const { createArtist } = await import('../netlify/functions/_auth.mjs');
const { archiveShow, readHistIndex, readHistShow, feeOfSession, refreshShowFees } = await import('../netlify/functions/_history.mjs');
const { casDoc, KEY } = await import('../netlify/functions/_lib.mjs');
const { recheckSome, slimNight, foldRegister, readView } = await import('../netlify/functions/_register.mjs');
const { costOf } = await import('../netlify/functions/_showcosts.mjs');
const { __stripe } = await import('./stripe-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); } };
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });

const bt = (fee, { app = 0, cur = 'usd', rate = null } = {}) => ({ id: 'txn_' + Math.random().toString(36).slice(2), currency: cur, exchange_rate: rate, fee: fee + app,
  fee_details: [{ type: 'stripe_fee', amount: fee }, ...(app ? [{ type: 'application_fee', amount: app }] : [])] });
const sess = (cents, b) => ({ amount_total: cents, currency: 'usd', payment_intent: { id: 'pi_x', latest_charge: { id: 'ch_x', balance_transaction: b } } });

console.log('\nONE PAYMENT\'S FEE');
eq('US dollars: the stripe_fee line, in dollars', feeOfSession(sess(1500, bt(74))), 0.74);
eq('a direct charge: MySet\'s application fee is not Stripe\'s', feeOfSession(sess(1500, bt(74, { app: 150 }))), 0.74);
eq('settled in baht: back to dollars at the transaction\'s own rate', feeOfSession(sess(1500, bt(2664, { cur: 'thb', rate: 36 }))), 0.74);
eq('the tax Stripe charges on its own fee is part of the fee; MySet\'s application fee is not', feeOfSession(sess(1500, { currency: 'usd', fee: 229, fee_details: [{ type: 'stripe_fee', amount: 74 }, { type: 'tax', amount: 5 }, { type: 'application_fee', amount: 150 }] })), 0.79);
eq('another currency and no rate: no figure, not a guess', feeOfSession(sess(1500, bt(2664, { cur: 'thb' }))), null);
eq('no balance transaction yet (a hold not captured): no figure', feeOfSession({ amount_total: 500, currency: 'usd', payment_intent: 'pi_x' }), null);
eq('nothing charged: nothing taken', feeOfSession({ amount_total: 0 }), 0);

console.log('\nA NIGHT FILED WITH ITS FEES');
const H = 3600e3, NOW = Date.now(), sec = (ms) => Math.floor(ms / 1000);
const kai = await createArtist({ email: 'kai@example.com', name: 'Kai Fee', slug: 'kai-fee' });
process.env.STRIPE_SECRET_KEY = 'sk_test_notreal_forlocaltestsonly';
const paid = (id, showId, cents, at, b, kind = 'tip') => __stripe.sessions.set(id, { onAccount: '', session: { id, mode: 'payment', payment_status: 'paid', created: sec(at), amount_total: cents, currency: 'usd',
  metadata: { kind, artist: kai.artistId, show: showId, ...(kind === 'tip' ? {} : { votes: '5' }) }, payment_intent: b === undefined ? 'pi_bare' : { id: 'pi_' + id, latest_charge: { id: 'ch_' + id, balance_transaction: b } } } });
const S1 = NOW - 30 * H;
paid('cs_a', 'f1', 1500, S1 + H, bt(74));
paid('cs_b', 'f1', 500, S1 + 2 * H, bt(45), 'votes');
const night = (showId, startedAt) => ({ showId, venue: 'The Duck', city: 'Koh Phangan, Thailand', startedAt,
  songs: [{ id: 's1', title: 'Song' }], log: [{ songId: 's1', title: 'Song', at: startedAt + 60e3, votes: 3, roundVotes: 3 }], nowPlaying: null });
const realNow = Date.now; Date.now = () => S1 + 3 * H;
await archiveShow(kai.artistId, night('f1', S1), {});
Date.now = realNow;
const d1 = await readHistShow(kai.artistId, 'f1');
eq('the night\'s money carries Stripe\'s own fees: two payments, $1.19, none missing', d1.money.fees, { usd: 1.19, charges: 2, missing: 0 });
eq('the index row carries the exact figure', (await readHistIndex(kai.artistId)).shows.find((x) => x.showId === 'f1').stripeFees, 1.19);
eq('the register reads it off the record', slimNight(d1).money.fees, { usd: 1.19, charges: 2, missing: 0 });

{
  const saved = process.env.STRIPE_SECRET_KEY; delete process.env.STRIPE_SECRET_KEY;   // fold without asking Stripe again
  await foldRegister({ full: true, reason: 'test' });
  process.env.STRIPE_SECRET_KEY = saved;
  const v = await readView({ months: 'all' });
  const r = (v && v.rows || []).find((x) => x.showId === 'f1');
  eq('and the register\'s row for the night says $1.19, exact', r && [r.status, r.money.stripeFees], ['counted', 1.19]);
}

console.log('\nONE FEE THAT DID NOT COME BACK');
const S2 = NOW - 20 * H;
paid('cs_c', 'f2', 1000, S2 + H, bt(59));
paid('cs_d', 'f2', 1000, S2 + H + 60e3, undefined);
Date.now = () => S2 + 3 * H;
await archiveShow(kai.artistId, night('f2', S2), {});
Date.now = realNow;
eq('the night says one was missing', (await readHistShow(kai.artistId, 'f2')).money.fees, { usd: 0.59, charges: 1, missing: 1 });
eq('so the row has no exact figure', (await readHistIndex(kai.artistId)).shows.find((x) => x.showId === 'f2').stripeFees, null);

console.log('\nTHE TABLE: EXACT WHERE FILED, THE ESTIMATE ONLY WHERE NOT');
{
  const B = { usdPerCredit: 0.01, creditsPerShow: 3, byKey: {}, stripe: { effectivePct: 3.095, fixed: 0.3 } };
  const row = (money) => ({ status: 'counted', showId: 'x', artist: { id: 'a' }, money: { known: true, total: 20, tips: { count: 1 }, packs: { count: 1 }, requests: { count: 0 }, merch: { orders: 0, amount: 0 }, ...money } });
  const exact = costOf(row({ stripeFees: 1.19 }), B).stripe;
  eq('a night with its fee: Stripe\'s figure, exact, no ≈', [exact.usd, exact.exact, exact.estimate], [1.19, true, false]);
  const old = costOf(row({ stripeFees: null }), B).stripe;
  eq('a night without: the published-rate estimate, marked', [old.usd, old.exact, old.estimate], [Math.round((20 * 0.03095 + 0.6) * 1e4) / 1e4, false, true]);
  const merch = costOf(row({ stripeFees: 1.19, merch: { orders: 1, amount: 10 } }), B).stripe;
  eq('merch orders are not in the night\'s payments: their part stays the estimate, and says so', [merch.usd, merch.estimate], [Math.round((1.19 + 10 * 0.03095 + 0.3) * 1e4) / 1e4, true]);
}

console.log('\nTHE REGISTER ASKS AN OLDER NIGHT ONCE FOR ITS FEE — NEVER SPENDING THE LATE-TIP ASK');
{
  const regRow = (showId, endedAt, fees = null) => ({ id: `${kai.artistId}|${showId}`, showId, status: 'counted', endedAt, artist: { id: kai.artistId }, money: { known: true, stripeFees: fees } });
  const old = regRow('f1', NOW - 10 * 24 * H);                       // filed before fees, ten days ago
  const fresh = regRow('f2', NOW - 2 * H);                           // last night, morning-after ask still ahead
  const done = regRow('f9', NOW - 10 * 24 * H, 0.5);                 // already exact
  const work = { rechecked: {}, feesAsked: {} };
  await recheckSome([old, fresh, done], work, NOW);
  eq('the old night was asked, and marked asked', Object.keys(work.feesAsked), [old.id]);
  eq('the morning-after mark was not spent on it, nor on last night', work.rechecked, {});
  const again = { ...work, feesAsked: { ...work.feesAsked } };
  await recheckSome([old], again, NOW + 600e3);
  eq('asked once, not every ring', again.feesAsked[old.id], NOW);
  const due = regRow('f2', NOW - 11 * H);                            // now in its morning-after window
  const w2 = { rechecked: {}, feesAsked: {} };
  await recheckSome([due], w2, NOW);
  eq('a night in its morning-after window takes the late-tip ask (which reads fees too), not the fee ask', [Object.keys(w2.rechecked), Object.keys(w2.feesAsked)], [[due.id], []]);
  const w3 = { rechecked: {}, feesAsked: {} };
  await recheckSome([regRow('f1', NOW - 10 * 24 * H)], w3, NOW, Date.now() - 1);
  eq('past the ring\'s time box nothing is asked, and nothing is marked — the next ring asks', w3.feesAsked, {});
}

console.log('\nAN OLDER NIGHT GETS ITS FEE — AND NOTHING ELSE');
{
  /* make f1 look filed before fees were read: no fees on the record, none on the row */
  const strip = async () => { await casDoc(KEY.hist(kai.artistId, 'f1'), () => ({}), (d) => { delete d.money.fees; return true; });
    await casDoc(KEY.histIdx(kai.artistId), () => ({ shows: [] }), (x) => { const r = x.shows.find((y) => y.showId === 'f1'); if (r) r.stripeFees = null; return true; }); };
  const keyOk = !!(await readHistShow(kai.artistId, 'f1'));
  await strip();
  const before = (await readHistShow(kai.artistId, 'f1')).money;
  ok('(set up: f1 has money and no fees)', keyOk && before.gross === 20 && !before.fees, before);
  eq('the fee is written when Stripe\'s takings match the night\'s', await refreshShowFees(kai.artistId, 'f1'), 1.19);
  const after = (await readHistShow(kai.artistId, 'f1')).money;
  eq('…the fee only: the takings are untouched', [after.gross, after.tips.count, after.fees.usd], [before.gross, before.tips.count, 1.19]);
  await strip();
  const saved = process.env.STRIPE_SECRET_KEY; delete process.env.STRIPE_SECRET_KEY;
  eq('Stripe cannot be asked: nothing is written', await refreshShowFees(kai.artistId, 'f1'), null);
  process.env.STRIPE_SECRET_KEY = saved;
  eq('…and the night still says $20 from Stripe', [(await readHistShow(kai.artistId, 'f1')).money.gross, (await readHistShow(kai.artistId, 'f1')).money.source], [20, 'stripe']);
  paid('cs_e', 'f1', 300, NOW - 29 * H, bt(39));
  eq('Stripe now reads different takings for the window: nothing is written (the morning-after ask owns that)', await refreshShowFees(kai.artistId, 'f1'), null);
  eq('…and the night still says $20', (await readHistShow(kai.artistId, 'f1')).money.gross, 20);
  __stripe.sessions.delete('cs_e');
}

console.log('\nIF STRIPE REFUSES THE FEE EXPANSION, THE TAKINGS ARE STILL READ');
{
  const { moneyForShow } = await import('../netlify/functions/_history.mjs');
  const Stripe = (await import('./stripe-fake.mjs')).default;
  const list = Stripe.prototype.__lookupGetter__('checkout');
  Object.defineProperty(Stripe.prototype, 'checkout', { configurable: true, get() { const c = list.call(this); const real = c.sessions.list;
    c.sessions.list = async (p, o) => { if (p && p.expand) throw new Error('This property cannot be expanded');
      const r = await real(p, o); return { ...r, data: r.data.map((x) => ({ ...x, payment_intent: x.payment_intent && x.payment_intent.id })) }; };   // unexpanded, as Stripe answers
    return c; } });
  const m = await moneyForShow(kai.artistId, 'f1', NOW - 30 * H, NOW - 27 * H);
  Object.defineProperty(Stripe.prototype, 'checkout', { configurable: true, get: list });
  eq('the money is Stripe\'s answer, $20, with both fees missing', [m.source, m.gross, m.fees.missing, m.fees.charges], ['stripe', 20, 2, 0]);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
