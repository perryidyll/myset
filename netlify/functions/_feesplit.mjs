import { createHash } from 'node:crypto';
import { casDoc, readDoc, KEY, emptyMeta } from './_lib.mjs';
import { stripeFor, stripeFeeEstimate } from './_connect.mjs';

/* THE EXACT HALF OF STRIPE'S CARD FEE.

   Perry's rule is that Stripe's own processing fee on a venue's merch sale is
   shared evenly between MySet and the venue. At checkout we can only ESTIMATE it
   (2.9% + 30c) because the real number depends on the card and the country, and
   the real number does not exist yet. So `feeCents` subtracts half the estimate
   from MySet's cut and the arithmetic is close but not exact.

   This is the correction, and it only ever runs one way: IT PAYS THE VENUE AND
   NEVER BILLS THEM. If the real fee lands lower than the estimate, MySet has
   under-charged itself and eats the difference rather than clawing cents back
   from a bar. That asymmetry is deliberate; the opposite failure mode is taking
   money back off somebody after the Studio has already shown them a figure.

   FIVE THINGS THAT ARE EASY TO GET BACKWARDS, all of them load-bearing:

     1. THE EVENT IS `charge.updated`, not `charge.succeeded`. With Stripe's
        default async capture, `balance_transaction` and `application_fee` are
        both null on succeeded, so a handler there would quietly do nothing on
        most charges.
     2. THE BALANCE TRANSACTION IS THE CONNECTED ACCOUNT'S and must be read with
        that account in scope. THE APPLICATION FEE IS THE PLATFORM'S and must be
        read WITHOUT it. Same charge, two different accounts, and swapping them
        gives "no such object" rather than a wrong number, which is at least loud.
     3. STRIPE'S FEE IS `fee_details[type === 'stripe_fee']`, never `bt.fee` — on
        a direct charge `bt.fee` also contains MySet's own application fee, so
        halving it would hand the venue back a share of our own cut.
     4. THE CURRENCY. The charge is in USD; a Thai venue settles in THB, so the
        fee comes back in THB and has to be converted with the balance
        transaction's own exchange rate before it is halved. No rate, no guess.
     5. THE MECHANISM IS `applicationFees.createRefund`, NOT `transfers.create`.
        A platform-to-Thailand transfer is a cross-border transfer Stripe refuses
        outright, and MySet's first venues are Thai. A fee refund reverses money
        that arrived from this very charge, needs no platform balance, reconciles
        in Stripe's own reports, and Stripe itself enforces our "never below
        zero" rule by refusing to refund more than the fee that was taken.

   HOW SMALL THE NUMBERS ARE, said plainly: venue merch is a Pro feature, so every
   venue sale runs the 2% row, and half of Stripe's fee exceeds 2% of anything
   under about $29. Below that, MySet's fee is already zero at checkout, there is
   nothing to refund, and this records `nothing` and stops. It is built so the
   arithmetic is right when the baskets get bigger, not because it moves money
   today. */

const SPLIT_CLAIM_MS = 10 * 60e3;
const KEEP_MS = 180 * 86400e3;
const MAX_ROWS = 500;
const idem = (chargeId) => 'fs-' + createHash('sha256').update('myset-feesplit|' + chargeId).digest('hex').slice(0, 40);

/** Settle one direct charge. Never throws: the webhook must always answer 200. */
export async function settleSplit(owner, acct, ch) {
  const cid = ch && ch.id;
  if (!cid || !acct) return { ok: false, why: 'no charge' };
  const { stripe, opts } = await stripeFor(owner);
  if (!stripe) return { ok: false, why: 'no stripe' };

  const btId = typeof ch.balance_transaction === 'string' ? ch.balance_transaction
             : (ch.balance_transaction && ch.balance_transaction.id) || '';
  if (!btId) return { ok: false, why: 'not settled yet' };     // another charge.updated will come

  let bt;
  try { bt = await stripe.balanceTransactions.retrieve(btId, opts); }
  catch { return { ok: false, why: 'could not read the balance transaction' }; }

  const line = (bt.fee_details || []).find((x) => x.type === 'stripe_fee');
  if (!line) return record(owner, cid, ch, { state: 'unknown-breakdown' });
  let realFee = line.amount;
  if (bt.currency !== ch.currency) {
    if (!bt.exchange_rate) return record(owner, cid, ch, { state: 'unconvertible', btCur: bt.currency });
    realFee = Math.round(realFee / bt.exchange_rate);
  }

  /* The application fee lives on the PLATFORM. Stripe creates it asynchronously
     for a direct charge, so `ch.application_fee` can still be empty on an early
     event and the list is the fallback. */
  let fee = null;
  try {
    if (ch.application_fee) {
      const id = typeof ch.application_fee === 'string' ? ch.application_fee : ch.application_fee.id;
      fee = await stripe.applicationFees.retrieve(id);
    } else {
      const l = await stripe.applicationFees.list({ charge: cid, limit: 1 });
      fee = (l.data || [])[0] || null;
    }
  } catch { /* fall through: no fee found */ }
  if (!fee) return record(owner, cid, ch, { state: 'nothing', stripeFee: realFee, why: 'no fee was taken' });

  const estHalf = Math.round(stripeFeeEstimate(ch.amount) / 2);   // already deducted at checkout
  const realHalf = Math.round(realFee / 2);
  const room = Math.max(0, (fee.amount || 0) - (fee.amount_refunded || 0));
  const give = Math.max(0, Math.min(realHalf - estHalf, room));

  /* CLAIMED IS NOT DELIVERED (INVARIANT 7b). Claim first so a duplicate webhook
     cannot call Stripe twice, then move the money, then mark it done — and the
     Stripe idempotency key covers the window in between. */
  let go = false;
  await casDoc(KEY.meta(owner), emptyMeta, (m) => {
    m.fees ||= {};
    const r = m.fees[cid];
    if (r && (r.state === 'done' || r.state === 'nothing')) return false;
    if (r && r.state === 'claimed' && Date.now() - (r.at || 0) < SPLIT_CLAIM_MS) return false;
    m.fees[cid] = { v: 1, pi: typeof ch.payment_intent === 'string' ? ch.payment_intent : '',
      amount: ch.amount, cur: ch.currency, stripeFee: realFee, btCur: bt.currency,
      rate: bt.exchange_rate || null, charged: fee.amount, feeId: fee.id, give,
      state: give > 0 ? 'claimed' : 'nothing', refundId: '', at: Date.now(), doneAt: 0 };
    trim(m);
    go = true;
    return true;
  }).catch(() => {});
  if (!go) return { ok: true, already: true };
  if (give <= 0) return { ok: true, give: 0 };

  let refund = null;
  try {
    refund = await stripe.applicationFees.createRefund(fee.id, { amount: give,
      metadata: { myset_owner: owner, myset_charge: cid } }, { idempotencyKey: idem(cid) });
  } catch (e) {
    /* Left `claimed`. Ten minutes later another event, or the sweep, tries again;
       Stripe's own `amount_refunded` stops it ever paying twice. */
    console.error('feesplit: refund failed for', cid, e && e.message);
    return { ok: false, why: 'refund failed' };
  }
  await casDoc(KEY.meta(owner), emptyMeta, (m) => {
    m.fees ||= {};
    const r = m.fees[cid]; if (!r) return false;
    r.state = 'done'; r.refundId = refund.id || ''; r.doneAt = Date.now();
    return true;
  }, (m) => ((m.fees || {})[cid] || {}).state === 'done').catch(() => {});
  return { ok: true, give, refund: refund.id };
}

function record(owner, cid, ch, extra) {
  return casDoc(KEY.meta(owner), emptyMeta, (m) => {
    m.fees ||= {};
    if ((m.fees[cid] || {}).state === 'done') return false;
    m.fees[cid] = { v: 1, amount: ch.amount, cur: ch.currency, give: 0,
      at: Date.now(), doneAt: 0, refundId: '', ...extra };
    trim(m);
    return true;
  }).catch(() => {}).then(() => ({ ok: true, ...extra }));
}

/* Bounded in the same write. Stripe retries a webhook for about three days, so a
   row trimmed at 180 can never be re-processed by a retry — and a `claimed` row
   is never dropped, because that is the one that still owes somebody money. */
function trim(m) {
  const ids = Object.keys(m.fees || {});
  if (ids.length <= MAX_ROWS) {
    const cut = Date.now() - KEEP_MS;
    for (const id of ids) {
      const r = m.fees[id];
      if (r && r.state !== 'claimed' && (r.doneAt || r.at || 0) < cut) delete m.fees[id];
    }
    return;
  }
  const rows = ids.map((id) => [id, m.fees[id] || {}])
    .sort((a, b) => (a[1].at || 0) - (b[1].at || 0));
  let over = ids.length - MAX_ROWS;
  for (const [id, r] of rows) {
    if (over <= 0) break;
    if (r.state === 'claimed') continue;
    delete m.fees[id]; over--;
  }
}

/** What the Studio and the docs show: the correction, per charge. */
export async function feesFor(owner) {
  const { data } = await readDoc(KEY.meta(owner), null);
  return (data && data.fees) || {};
}
