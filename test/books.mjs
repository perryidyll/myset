/* THE BOOKS  (_ledger.mjs, the ledger/books actions in admin.mjs and venueadmin.mjs)

   Pins, in order:
     · every figure comes from Stripe's BALANCE TRANSACTIONS and is only bucketed,
       never recomputed — INVARIANT 5d, made structural
     · a direct charge is read with fee_details, so "Stripe's fee" never silently
       includes MySet's cut (the trap _feesplit.mjs documents)
     · the platform's side nets the fee split off by itself
     · a payout is NOT an expense; a refund IS
     · the monthly close: a month that has ended is computed once and never again
     · scope — an artist's gross can never appear in MySet's revenue
     · a band mate on a Pro seat cannot open the statement
     · the CSV says what the numbers mean
     · costs are recorded by hand, and the P&L is revenue MINUS them, with Stripe's
       fee counted exactly once */
process.env.ADMIN_CODE = 'devlocal';
process.env.STRIPE_SECRET_KEY = 'sk_test_notreal_forlocaltestsonly';

const admin = (await import('../netlify/functions/admin.mjs')).default;
const vadmin = (await import('../netlify/functions/venueadmin.mjs')).default;
const { createArtist, signToken, readArtists, revOf, mutateArtists } = await import('../netlify/functions/_auth.mjs');
const { createVenue, signVenueToken, readVenues, vRevOf } = await import('../netlify/functions/_venues.mjs');
const { DEFAULT_ARTIST } = await import('../netlify/functions/_lib.mjs');
const { statement, books, foldTx, toCsv, setCost, readLedger, lastMonths,
        monthKey, platformSplit } = await import('../netlify/functions/_ledger.mjs');
const { mutateConnect } = await import('../netlify/functions/_connect.mjs');
const ready = (owner, acct) => mutateConnect(owner, (c) => { c.acct = acct; c.chargesEnabled = true; c.payoutsEnabled = true; return true; });
const { __stripe } = await import('./stripe-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, got === want, { got, want });
const post = (tok, body) => new Request('https://x/api/admin', { method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` },
  body: JSON.stringify(body) });
const jget = async (r) => { try { return await r.json(); } catch { return {}; } };

const NOW = Date.UTC(2026, 8, 15);                 // 15 Sep 2026
const THIS = monthKey(NOW), LAST = lastMonths(2, NOW)[1];
const at = (month, day) => Math.floor(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1, day) / 1000);
let seq = 0;
const bt = (o) => { const id = `txn_b${++seq}`; __stripe.bts.set(id, { id, currency: 'usd', fee: 0, net: o.amount, fee_details: [], ...o }); return id; };

console.log('\nHOW ONE PAYMENT IS READ FROM BOTH SIDES');
{
  const e = () => ({ currency: '', gross: 0, stripeFee: 0, platformFee: 0, net: 0, refunds: 0, disputes: 0, payouts: 0, other: 0, count: 0 });
  /* $10 of votes on an artist's own account: Stripe took 59c, MySet took 20c. */
  const artist = foldTx(e(), { type: 'charge', amount: 1000, fee: 79, net: 921, currency: 'usd',
    fee_details: [{ type: 'stripe_fee', amount: 59 }, { type: 'application_fee', amount: 20 }] });
  eq('the artist sees gross', artist.gross, 1000);
  eq('Stripe’s fee alone, from fee_details', artist.stripeFee, 59);
  eq('MySet’s cut, named as ours', artist.platformFee, 20);
  eq('and what actually landed', artist.net, 921);
  ok('THE TRAP: stripeFee is not bt.fee, which includes our cut too', artist.stripeFee !== 79);

  /* fee_details missing (an older or partial object): infer rather than overstate. */
  const partial = foldTx(e(), { type: 'charge', amount: 1000, fee: 79, net: 921, currency: 'usd', fee_details: [] });
  eq('with no breakdown at all it falls back to the whole fee', partial.stripeFee, 79);

  const plat = e();
  foldTx(plat, { type: 'application_fee', amount: 20, fee: 0, net: 20, currency: 'usd' });
  foldTx(plat, { type: 'application_fee_refund', amount: -15, fee: 0, net: -15, currency: 'usd' });
  eq('the platform earns the fee and gives the split back, netted', plat.gross, 5);
  ok('and the artist’s $10 never appears in it', plat.gross < 1000);

  const money = e();
  foldTx(money, { type: 'payout', amount: -5000, fee: 0, net: -5000, currency: 'usd' });
  foldTx(money, { type: 'refund', amount: -300, fee: 0, net: -300, currency: 'usd' });
  eq('a payout is not an expense', money.net, -300);
  eq('it is reported on its own line', money.payouts, -5000);
  eq('a refund is', money.refunds, -300);
}

console.log('\nAN ARTIST’S STATEMENT');
const A = await createArtist({ email: 'booker@example.com', name: 'Booker' });
const aid = A.artistId;
const atok = await signToken('booker@example.com', revOf(await readArtists(), aid));
await ready(aid, 'acct_artist1');
{
  bt({ __account: 'acct_artist1', created: at(LAST, 10), type: 'charge', amount: 2000, fee: 118, net: 1882,
       fee_details: [{ type: 'stripe_fee', amount: 88 }, { type: 'application_fee', amount: 30 }] });
  bt({ __account: 'acct_artist1', created: at(THIS, 3), type: 'charge', amount: 500, fee: 45, net: 455,
       fee_details: [{ type: 'stripe_fee', amount: 40 }, { type: 'application_fee', amount: 5 }] });
  bt({ __account: 'acct_artist1', created: at(THIS, 4), type: 'payout', amount: -1882, fee: 0, net: -1882 });

  const st = await statement(aid, new (await import('stripe')).default('sk'), { stripeAccount: 'acct_artist1' },
    { months: 3, now: NOW });
  const m = Object.fromEntries(st.months.map((x) => [x.month, x]));
  eq('last month’s gross', m[LAST].gross, 2000);
  eq('this month’s gross', m[THIS].gross, 500);
  /* A PAYOUT IS NOT AN EXPENSE. `net` is what was earned; moving it to a bank
     account does not un-earn it. Getting this backwards would show an artist who
     had just been paid out as having earned nothing. */
  eq('the year so far, net to the artist', st.total.net, 1882 + 455);
  eq('MySet’s cut, totalled', st.total.platformFee, 35);
  eq('the payout is on its own line, not in net', m[THIS].payouts, -1882);
}

console.log('\nTHE MONTHLY CLOSE — a finished month is computed once');
{
  const before = __stripe.calls.filter((c) => c.method === 'balanceTransactions.list').length;
  const cached = await readLedger(aid);
  ok('last month is on disk', !!cached.months[LAST]);
  await statement(aid, new (await import('stripe')).default('sk'), { stripeAccount: 'acct_artist1' },
    { months: 3, now: NOW });
  const after = __stripe.calls.filter((c) => c.method === 'balanceTransactions.list').length;
  ok('a second read still asks Stripe (the current month can move)', after > before);
  const win = __stripe.calls.filter((c) => c.method === 'balanceTransactions.list').pop().args.created;
  ok('but ONLY for the current month — the window starts this month',
    win.gte >= at(THIS, 1), { gte: win.gte, wanted: at(THIS, 1) });
}

console.log('\nSCOPE — whose money is whose');
{
  bt({ __account: '', created: at(THIS, 6), type: 'charge', amount: 1000, fee: 59, net: 941,
       fee_details: [{ type: 'stripe_fee', amount: 59 }] });                      // a Pro subscription
  bt({ __account: '', created: at(THIS, 3), type: 'application_fee', amount: 5, fee: 0, net: 5 });
  bt({ __account: '', created: at(LAST, 10), type: 'application_fee', amount: 30, fee: 0, net: 30 });

  const b = await books(new (await import('stripe')).default('sk'), {}, { months: 3, now: NOW, force: true });
  const m = Object.fromEntries(b.months.map((x) => [x.month, x]));
  eq('MySet earned the subscription plus its cut', m[THIS].gross, 1005);
  ok('and the artist’s $5 and $20 gross are nowhere in it', m[THIS].gross < 1500, m[THIS]);
  eq('last month, just the fee', m[LAST].gross, 30);
}

console.log('\nCOSTS, AND A PROFIT LINE THAT COUNTS STRIPE ONCE');
{
  await setCost(THIS, 'hosting', 900, 'Netlify Personal');
  await setCost(THIS, 'email', 0);                       // never set, stays absent
  await setCost(THIS, 'domain', 120, 'myset.vip');
  ok('an unknown kind of cost is refused', !(await setCost(THIS, 'yacht', 500000)).ok);
  ok('a month that is not a month is refused', !(await setCost('soon', 'hosting', 100)).ok);

  const b = await books(new (await import('stripe')).default('sk'), {}, { months: 3, now: NOW });
  const m = Object.fromEntries(b.months.map((x) => [x.month, x]));
  eq('the costs are added up', m[THIS].spend, 1020);
  /* net is ALREADY after Stripe's fee. Subtracting stripeFee again here is the
     easiest mistake in the whole file, so it is pinned. */
  eq('profit is what landed, minus what was spent', m[THIS].profit, m[THIS].net - 1020);
  eq('and net is after Stripe, not before', m[THIS].net, 941 + 5);
  ok('setting a cost to zero removes it rather than recording nothing',
    m[THIS].costs.email === undefined, m[THIS].costs);
}

console.log('\nNEVER FURTHER BACK THAN THE DAY THEY JOINED');
{
  const joined = Date.UTC(2026, 6, 20);                 // 20 July 2026
  eq('twelve months asked for, three delivered',
    lastMonths(12, NOW, joined).length, 3);
  eq('and the oldest is the month they joined', lastMonths(12, NOW, joined).pop(), '2026-07');
  eq('with no floor it is still twelve', lastMonths(12, NOW, 0).length, 12);
  ok('a page opened this month gets one row, not eleven of zero',
    lastMonths(12, NOW, NOW).length === 1);

  /* And through the endpoint, which reads createdAt off the registry. */
  const J = await createArtist({ email: 'joinedlate@example.com', name: 'New' });
  await mutateArtists((reg) => { reg.byId[J.artistId].createdAt = Date.now() - 40 * 86400e3; return true; });
  const jt = await signToken('joinedlate@example.com', revOf(await readArtists(), J.artistId));
  const d = await jget(await admin(post(jt, { action: 'ledger', months: 12 })));
  /* Forty days back can touch three CALENDAR months (late July -> September), so
     three is the honest ceiling here, not two. What matters is that it is nowhere
     near twelve. */
  ok('a page six weeks old shows three months, not twelve',
    !d.months || d.months.length <= 3, (d.months || []).map((m) => m.month));
}

console.log('\nTHE FOUNDER\u2019S GIGS, SPLIT OUT OF MYSET\u2019S REVENUE');
{
  /* Both live in the same platform balance. A payment MySet sold on his behalf is
     a charge whose session was tagged kind+artist; everything else is the company's. */
  const stripe = new (await import('stripe')).default('sk');
  __stripe.sessions.set('cs_gig1', { onAccount: '', session: { id: 'cs_gig1', mode: 'payment',
    payment_status: 'paid', created: at(LAST, 12), payment_intent: 'pi_gig1',
    metadata: { kind: 'votes', artist: DEFAULT_ARTIST } } });
  bt({ __account: '', created: at(LAST, 12), type: 'charge', amount: 700, fee: 50, net: 650,
       source: { id: 'ch_gig1', object: 'charge', payment_intent: 'pi_gig1', metadata: {} },
       fee_details: [{ type: 'stripe_fee', amount: 50 }] });
  bt({ __account: '', created: at(LAST, 14), type: 'charge', amount: 2000, fee: 88, net: 1912,
       source: { id: 'ch_sub9', object: 'charge', payment_intent: 'pi_sub9', metadata: {} },
       fee_details: [{ type: 'stripe_fee', amount: 88 }] });

  const split = await platformSplit(DEFAULT_ARTIST, stripe, { months: 3, now: NOW, force: true });
  const mine = Object.fromEntries(split.mine.months.map((m) => [m.month, m]));
  const bk = Object.fromEntries(split.books.months.map((m) => [m.month, m]));
  eq('his own gig money is his', mine[LAST].gross, 700);
  ok('and the subscription is not', mine[LAST].gross !== 2700, mine[LAST]);
  ok('the company keeps the subscription', bk[LAST].gross >= 2000, bk[LAST]);
  ok('and not his gig takings', bk[LAST].gross < 2700, bk[LAST]);

  /* A REFUND OF HIS OWN GIG MONEY IS HIS LOSS, NOT THE COMPANY'S. A refund lands
     in the month it settles but the charge may be months older, and a refund object
     carries no kind/artist of its own — so the session window has to reach back
     past the transaction window or this is booked against MySet. */
  bt({ __account: '', created: at(THIS, 5), type: 'refund', amount: -700, fee: 0, net: -700,
       source: { id: 're_1', object: 'refund', payment_intent: 'pi_gig1', metadata: {} } });
  const sr = await platformSplit(DEFAULT_ARTIST, stripe, { months: 3, now: NOW, force: true });
  const rm = Object.fromEntries(sr.mine.months.map((m) => [m.month, m]));
  const rb = Object.fromEntries(sr.books.months.map((m) => [m.month, m]));
  eq('the refund is taken off HIS side', rm[THIS].refunds, -700);
  eq('and not off the company\u2019s', rb[THIS].refunds, 0);

  /* A charge that labels ITSELF needs no session at all — which is what
     payment_intent_data.metadata buys from here on. */
  bt({ __account: '', created: at(THIS, 2), type: 'charge', amount: 300, fee: 39, net: 261,
       source: { id: 'ch_self', object: 'charge', payment_intent: 'pi_self',
                 metadata: { kind: 'tip', artist: DEFAULT_ARTIST } },
       fee_details: [{ type: 'stripe_fee', amount: 39 }] });
  const s2 = await platformSplit(DEFAULT_ARTIST, stripe, { months: 3, now: NOW, force: true });
  const m2 = Object.fromEntries(s2.mine.months.map((m) => [m.month, m]));
  eq('a self-labelled charge lands on his side with no session lookup', m2[THIS].gross, 300);
}

console.log('\nTHE FILE YOU HAND AN ACCOUNTANT');
{
  const st = await statement(aid, new (await import('stripe')).default('sk'), { stripeAccount: 'acct_artist1' }, { months: 3, now: NOW });
  const csv = toCsv(st, { who: 'Booker' });
  ok('it names itself and where the figures came from', /balance transactions/.test(csv));
  ok('it says which currency', /amounts are in USD/.test(csv));
  ok('it has a header row a spreadsheet understands', /Month,Currency,Gross taken/.test(csv));
  ok('and dollars, not cents', /,20,/.test(csv), csv.split('\n').slice(3).join('\n'));
  const bcsv = toCsv(await books(new (await import('stripe')).default('sk'), {}, { months: 2, now: NOW }), { who: 'MySet', kind: 'books' });
  ok('the founder’s version has a profit column', /Costs,Profit/.test(bcsv));
}

console.log('\nWHO MAY LOOK');
{
  const r = await admin(post(atok, { action: 'ledger', months: 3 }));
  const d = await jget(r);
  ok('the owner can read their statement', r.status === 200 && d.ok, d);

  await mutateArtists((reg) => { reg.byEmail['bandmate@example.com'] = { artistId: aid, role: 'member' }; return true; });
  const mtok = await signToken('bandmate@example.com', revOf(await readArtists(), aid));
  eq('a band mate on a Pro seat cannot', (await admin(post(mtok, { action: 'ledger' }))).status, 403);
  eq('nor open MySet’s books', (await admin(post(mtok, { action: 'books' }))).status, 403);
  eq('an ordinary artist cannot open MySet’s books either',
    (await admin(post(atok, { action: 'books' }))).status, 403);

  const F = await createArtist({ email: 'founder-books@example.com', name: 'F' });
  await mutateArtists((reg) => {
    reg.byEmail['founder-books@example.com'] = { artistId: DEFAULT_ARTIST, role: 'owner' };
    reg.byId[DEFAULT_ARTIST] ||= { slug: DEFAULT_ARTIST, name: 'Perry', plan: 'pro', createdAt: 1 };
    return true;
  });
  const ftok = await signToken('founder-books@example.com', revOf(await readArtists(), DEFAULT_ARTIST));
  /* The founder's own gig money shares the platform balance with every artist's
     subscription — and IS separable, because a payment MySet sold on his behalf
     carries kind+artist. He gets his own half, not a refusal. */
  const fl = await jget(await admin(post(ftok, { action: 'ledger' })));
  ok('the founder gets his OWN earnings, split out of the company’s',
    fl.ok && fl.enabled === true && Array.isArray(fl.months), fl);

  const fr = await admin(post(ftok, { action: 'books', months: 3 }));
  const fd = await jget(fr);
  ok('the founder can', fr.status === 200 && fd.ok && Array.isArray(fd.months), fd);
  ok('and gets the list of cost kinds to fill in', (fd.kinds || []).includes('hosting'));

  const csvR = await admin(post(atok, { action: 'ledgerCsv', months: 3 }));
  ok('the CSV comes back as a download', /text\/csv/.test(csvR.headers.get('content-type') || ''));
  ok('named for the artist', /filename=/.test(csvR.headers.get('content-disposition') || ''));
}

console.log('\nA VENUE HAS BOOKS TOO');
{
  const V = await createVenue({ email: 'vbooks@example.com', name: 'The Bar', city: 'Koh Phangan', country: 'TH' });
  /* Backdated, because the statement now refuses to reach back past the day the
     venue joined — and a venue created a second ago genuinely has no last month. */
  await (await import('../netlify/functions/_venues.mjs')).mutateVenues((reg) => {
    reg.byId[V.venueId].createdAt = Date.UTC(2026, 0, 1); return true; });
  const vtok = await signVenueToken('vbooks@example.com', vRevOf(await readVenues(), V.venueId));
  await ready(`v_${V.venueId}`, 'acct_venue1');
  /* LAST month, not this one: the handler uses the real clock (it takes no `now`),
     so a date later in THIS month is in the future and Stripe is asked for a window
     that has not happened yet. Worth pinning — it is exactly how a report can read
     zero while the money is plainly there. */
  bt({ __account: 'acct_venue1', created: at(LAST, 10), type: 'charge', amount: 3000, fee: 117, net: 2883,
       fee_details: [{ type: 'stripe_fee', amount: 117 }] });
  const r = await vadmin(new Request('https://x/api/venueadmin', { method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${vtok}` },
    body: JSON.stringify({ action: 'ledger', months: 2 }) }));
  const d = await jget(r);
  ok('a venue owner can read theirs', r.status === 200 && d.ok, d);
  eq('with the venue’s own gross', (d.months || []).reduce((s, m) => s + m.gross, 0), 3000);

}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
