import { readMeta, mutateMeta, mutateFan, getShow, unspentPaid, own, cleanFanId, DEFAULT_ARTIST } from './_lib.mjs';
import { redeemSession, cleanOwnerId } from './_pay.mjs';
import { stripeClient, artistForAccount } from './_connect.mjs';

/* MONEY THAT WENT BACK (decision 0177, INVARIANT 0iq).

   A refund, a chargeback or a bank's question about a payment never reached MySet.
   The Checkout Session stays `paid` for ever, so every record built from it — the
   night's money, tonight's tips, the merch order list — kept counting money that
   had gone, the fan kept the votes it bought, and an order refunded from the Stripe
   dashboard still sat in the Studio waiting to be handed over. The scale audit
   (2 October 2026) put it plainly: the first stolen card lands its loss on the
   platform, and nobody finds out.

   This is the one place a `charge.refunded` or a `charge.dispute.*` event lands. It
   follows the founder's recommended answer on his desk, "Take back what is unspent"
   (his word is still pending):

     · the payment's marker (meta.paid[sid]) says what went back: `refunded` (cents,
       Stripe's running total), `dispute` ({ id, status, cents }) and `lost`, the
       cents MySet's records no longer count. The tip row and the order row carry
       the same `lost`; a refund of the whole order also closes it (`refunded`).
     · votes come back only from the fan's WALLET, and only those not yet spent:
       a pack, or song votes that went to the wallet (0182, `wallet`). A vote cast
       is never pulled off a board, a free vote is never touched, and paid song votes
       that went straight onto a song are cast votes.
     · a chargeback the bank decides for the artist (`won`) gives back what it took,
       to the wallet, never onto a board — the fan paid for those votes after all.
     · the artist hears it once per change, on the seats that can see money.

   SAFE UNDER STRIPE'S RETRIES. Every figure is Stripe's own running total, never a
   delta: a second delivery of the same event finds nothing to change. Two events
   racing (a dispute opens and its money is withdrawn in the same second) are
   ordered by `seq` on the marker, which goes up each time what is owed changes; the
   fan's receipt (`rb[sid] = [want, took, seq]`, written in the same write as the
   votes it moves) refuses a step older than the one it already holds. A decided
   dispute is never re-opened by a late "created".

   A throw goes on to guard() and Stripe is answered 500 and sends the event again
   (0138, INVARIANT 0hm). There is no catch that falls through to a 200. */

export const LOSS_KINDS = ['votes', 'song_votes', 'tip', 'merch', 'request_hold'];
// the kinds redeemSession delivers; a request is settled by its capture (_requests.mjs)
const DELIVERS = new Set(['votes', 'song_votes', 'tip', 'merch']);
/* How many take-back receipts a fan record keeps — the same reasoning and the same
   number as `gr` (GR_KEEP): one per refunded payment of this fan's, newest last. */
export const RB_KEEP = 40;
const NOTE_MS = 1500;

const cents = (dollars) => Math.round((Number(dollars) || 0) * 100);
const idOf = (v) => (typeof v === 'string' ? v : (v && v.id) || '');
const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

/* A DISPUTE THAT HOLDS NO MONEY. Stripe withdraws a chargeback's amount the moment
   it opens and gives it back only if it is won. A bank's question (an inquiry, the
   `warning_*` statuses) takes nothing unless it becomes a chargeback, which Stripe
   reports as the same dispute moving to `needs_response`. `charge_refunded` means
   the charge was refunded and the refund already says so; `prevented` never took. */
export const disputeKeeps = (st) => {
  const s = String(st || '');
  return s === 'won' || s === 'charge_refunded' || s === 'prevented' || s.startsWith('warning_');
};
const CLOSED = new Set(['won', 'lost', 'warning_closed', 'charge_refunded', 'prevented']);

/** The cents of a payment MySet no longer holds: what was refunded, plus what a
 *  chargeback holds while it is open or since it was lost. Never more than was paid. */
export function lostCents(p) {
  if (!p) return 0;
  const d = p.dispute;
  const held = d && !disputeKeeps(d.status) ? Math.max(0, Number(d.cents) || 0) : 0;
  return Math.max(0, Math.min(cents(p.amount), (Number(p.refunded) || 0) + held));
}

/** How many of the payment's votes should no longer be the fan's: the share of the
 *  pack that went back, rounded up — money returned is a vote returned, never half
 *  of one left behind. Only wallet votes: a pack, or song votes that went to the
 *  wallet. Ballot entries are cast votes and stay where they are. */
export function backWanted(p) {
  const g = Math.max(0, parseInt(p && p.granted, 10) || 0);
  const wallet = p && (p.kind === 'votes' || (p.kind === 'song_votes' && p.wallet === true));
  const paid = cents(p && p.amount);
  if (!wallet || !g || !paid) return 0;
  return Math.min(g, Math.ceil((g * lostCents(p)) / paid));
}

/* Fold what an event says into the marker. Refunds only ever add up, so the larger
   running total wins and an older event lowers nothing. Returns true when the
   marker changed. */
function mergeLoss(p, seen, now) {
  let changed = false;
  if (seen.refunded != null) {
    const r = Math.max(Number(p.refunded) || 0, seen.refunded);
    if (r !== (Number(p.refunded) || 0)) { p.refunded = r; p.refundedAt = now; changed = true; }
  }
  if (seen.dispute) {
    const was = p.dispute || null, d = seen.dispute;
    const stale = was && CLOSED.has(was.status) && !CLOSED.has(d.status);   // a late "created" after "closed"
    if (!stale && (!was || was.status !== d.status || was.cents !== d.cents || was.id !== d.id)) {
      p.dispute = { id: d.id, status: d.status, cents: d.cents, at: now };
      changed = true;
    }
  }
  const lost = lostCents(p);
  if (lost !== (Number(p.lost) || 0)) changed = true;
  if (lost) p.lost = lost; else delete p.lost;
  return changed;
}

/* The tip row and the order row say the same `lost` as their marker, so the readers
   that sum the rows (tonight's tips, the founder's register, the Studio's order
   list) need nothing but the row. An order refunded in full is closed: it must
   never be handed over. A won dispute is not a refund and leaves the order as the
   artist left it. */
function markRows(m, sid, p, now) {
  const lost = Number(p.lost) || 0;
  if (p.kind === 'tip') {
    const t = (m.tips || []).find((x) => x && (x.sid === sid
      || (!x.sid && x.fan === p.fan && Number(x.at) === Number(p.at) && cents(x.amount) === cents(p.amount))));
    if (t) { if (lost) t.lost = lost; else delete t.lost; }
  }
  if (p.kind === 'merch') {
    const o = (m.orders || []).find((x) => x && x.sid === sid);
    if (!o) return;
    if (lost) o.lost = lost; else delete o.lost;
    if (p.dispute) o.dispute = p.dispute.status;
    if ((Number(p.refunded) || 0) >= cents(o.amount) && cents(o.amount) > 0 && !o.refunded) {
      o.refunded = true;
      if (o.status !== 'done') { o.status = 'done'; o.doneAt = now; }
    }
  }
}

/** Handle one `charge.refunded` or `charge.dispute.*` event. Throws when the work
 *  could not be made durable, so the webhook answers 500 and Stripe sends it again. */
export async function settleLoss(event, { stripe = stripeClient(), now = Date.now() } = {}) {
  const o = (event && event.data && event.data.object) || {};
  const dispute = String((event && event.type) || '').startsWith('charge.dispute.');
  /* A request's card hold that was released, never captured, is reported by Stripe
     as a refunded charge. Nothing was taken, so nothing comes back. */
  if (!dispute && o.captured === false) return { ok: true, skip: 'never captured' };
  // a subscription or a featured spot labels its charge too, and is not a fan's payment
  const k0 = (o.metadata || {}).kind;
  if (!dispute && k0 && !LOSS_KINDS.includes(k0)) return { ok: true, skip: 'not a fan payment' };
  const pi = idOf(o.payment_intent);
  if (!pi || !stripe) return { ok: true, skip: 'no payment' };

  /* THE SESSION, ON THE ACCOUNT THE MONEY LIVES ON (0183). A refund and a dispute
     carry only the payment; the session is what says who bought what. `event.account`
     is the connected account the event happened on; a platform event has none. */
  const opts = event.account ? [{ stripeAccount: event.account }] : [];
  const found = await stripe.checkout.sessions.list({ payment_intent: pi, limit: 1 }, ...opts);
  const session = ((found && found.data) || [])[0];
  const md = (session && session.metadata) || {};
  if (!session || !LOSS_KINDS.includes(md.kind)) return { ok: true, skip: 'not a fan payment' };
  const owner = cleanOwnerId(md.artist) || (event.account ? await artistForAccount(event.account) : '') || DEFAULT_ARTIST;
  const sid = session.id;
  const seen = dispute
    ? { dispute: { id: String(o.id || ''), status: String(o.status || ''), cents: Math.max(0, Number(o.amount) || 0) } }
    : { refunded: Math.max(0, Number(o.amount_refunded) || 0) };
  const paidCents = Math.max(0, Number(session.amount_total) || 0);
  const fresh = () => ({ kind: md.kind, amount: paidCents / 100, granted: 0, fan: cleanFanId(md.fan),
                         at: session.created ? session.created * 1000 : now, song: md.song || '',
                         show: String(md.show || '').slice(0, 40), delivered: true, settledBy: 'loss' });

  /* ---- 1. delivered first, or never ----
     A payment that went back IN FULL before anything was delivered is never
     delivered: its marker is written settled (`settledBy: 'loss'`) with nothing
     granted, so the return page, the bell and the Studio's sweep all answer
     "already" — no votes for money that is gone, no order to hand over, no stock
     taken. Anything less than all of it is delivered first (redeemSession, replay
     safe), so what follows has a grant to take back from. A tombstone whose loss
     later shrinks — a dispute won — is lifted and the payment delivered after all:
     the fan paid. Its loss fields are carried into the new marker. */
  const pre = await readMeta(owner);
  const had = own(pre.paid, sid);
  const draft = { ...(had || fresh()), amount: paidCents / 100 };
  mergeLoss(draft, seen, now);
  const whole = paidCents > 0 && lostCents(draft) >= paidCents;
  let carried = null;
  if (!had && whole) {
    await mutateMeta(owner, (m) => {
      if (own(m.paid, sid)) return false;            // somebody claimed it meanwhile: step 2 folds the loss in
      m.paid[sid] = fresh();
      return true;
    });
  } else if (had && had.settledBy === 'loss' && !had.granted && !whole && DELIVERS.has(md.kind)) {
    await mutateMeta(owner, (m) => {
      const q = own(m.paid, sid);
      if (!q || q.settledBy !== 'loss' || q.granted) return false;
      carried = { refunded: q.refunded, refundedAt: q.refundedAt, dispute: q.dispute, told: q.told, seq: q.seq };
      delete m.paid[sid];
      return true;
    });
    if (carried) await redeemSession(owner, session);
  } else if ((!had || had.delivered === false) && DELIVERS.has(md.kind)) {
    await redeemSession(owner, session);
  }

  /* ---- 2. the state, in one write ---- */
  let snap = null;
  await mutateMeta(owner, (m) => {
    snap = null;
    let p = own(m.paid, sid), changed = false;
    if (!p) { p = m.paid[sid] = fresh(); changed = true; }     // a request whose capture marker was lost
    if (carried) {
      for (const k of ['refunded', 'refundedAt', 'dispute', 'told']) if (carried[k] != null && p[k] == null) { p[k] = carried[k]; changed = true; }
      if (Number(carried.seq) > (Number(p.seq) || 0)) { p.seq = Number(carried.seq); changed = true; }
    }
    if (mergeLoss(p, seen, now)) changed = true;
    if (changed) { p.seq = (Number(p.seq) || 0) + 1; markRows(m, sid, p, now); }
    snap = { ...p, want: backWanted(p) };
    return changed;
  });

  /* ---- 3. the votes, on the fan's own record ---- */
  const seq = Number(snap.seq) || 0, want = snap.want;
  const walletKind = snap.kind === 'votes' || snap.kind === 'song_votes';
  let moved = { took: snap.back ? Number(snap.back.took) || 0 : 0, n: 0, g: 0 };
  if (walletKind && snap.fan && !String(owner).startsWith('v_'))
    moved = await moveVotes(owner, snap.fan, sid, want, seq, snap.back);

  /* ---- 4. the mirror, and telling the artist once ---- */
  let tell = null;
  await mutateMeta(owner, (m) => {
    tell = null;
    const p = own(m.paid, sid);
    if (!p) return false;
    let w = false;
    const bk = p.back || null;
    if (walletKind && (!bk || ((Number(bk.seq) || 0) <= seq && (bk.want !== want || bk.took !== moved.took || bk.seq !== seq)))
        && (want || bk || moved.took)) {
      p.back = { want, took: moved.took, seq, at: now };
      w = true;
    }
    const sig = `${Number(p.lost) || 0}|${(p.dispute && p.dispute.status) || ''}`;
    if (p.told !== sig) {
      tell = { p: { ...p }, was: String(p.told || ''), order: p.kind === 'merch' ? (m.orders || []).find((x) => x && x.sid === sid) || null : null };
      p.told = sig;
      w = true;
    }
    return w;
  });
  if (tell) await tellLoss(owner, tell, moved).catch(() => {});
  return { ok: true, owner, sid, kind: md.kind, lost: Number(snap.lost) || 0, want, took: moved.took, moved: moved.n - moved.g };
}

/** Bring the fan's wallet to step `seq`, which wants `want` of this payment's votes
 *  back. Only the wallet, only what is unspent (unspentPaid: the pack less the paid
 *  votes already cast); a step that wants fewer gives the difference back. The
 *  receipt `rb[sid] = [want, took, seq]` is written in the same write as `extra`,
 *  and a step older than the one the receipt (or the marker's mirror, `back`)
 *  already holds changes nothing — the order two racing events land in cannot undo
 *  the newer one. Returns what moved: `n` taken, `g` given, `took` in all. */
export async function moveVotes(owner, fanId, sid, want, seq, back = null) {
  const mirror = back ? [Number(back.want) || 0, Number(back.took) || 0, Number(back.seq) || 0] : [0, 0, 0];
  let moved = { took: mirror[1], n: 0, g: 0 };
  const show = await getShow(owner, { withName: false });
  await mutateFan(owner, fanId, (me) => {
    const r = Array.isArray(own(me.rb || {}, sid)) ? me.rb[sid] : null;
    const b = r && (Number(r[2]) || 0) >= mirror[2] ? [Number(r[0]) || 0, Number(r[1]) || 0, Number(r[2]) || 0] : mirror;
    if (b[2] >= seq) { moved = { took: b[1], n: 0, g: 0 }; return false; }       // this step, or a later one, is already here
    let took = b[1], n = 0, g = 0;
    if (want > b[0]) { n = Math.min(want - b[0], unspentPaid(me, show, fanId)); took += n; }
    else if (want < b[0]) { g = Math.max(0, took - want); took -= g; }
    moved = { took, n, g };
    if (!n && !g) return false;                     // nothing moves: the marker's mirror records the step
    me.extra = Math.max(0, (me.extra || 0) - n + g);
    me.rb = me.rb && typeof me.rb === 'object' ? me.rb : {};
    delete me.rb[sid];
    me.rb[sid] = [want, took, seq];                 // newest last, so the trim keeps it
    const ids = Object.keys(me.rb);
    if (ids.length > RB_KEEP) for (const k of ids.slice(0, ids.length - RB_KEEP)) delete me.rb[k];
    return true;
  }, (me) => (!moved.n && !moved.g) || (Array.isArray(me.rb && me.rb[sid]) && Number(me.rb[sid][2]) >= seq));
  return moved;
}

/* ---------- what the artist hears ----------
   One alert per change: a refund, a dispute opening, a dispute decided. The seats
   that can see money hear it (`{ tab: 'money' }`); a merch order goes to the seats
   that fulfil orders (`{ tab: 'merch' }`), because "don't hand it over" is for them.
   A venue's every seat hears a tab alert (0124). Time-boxed and never thrown: the
   records above are already right whatever happens to the alert. Nothing about the
   buyer is in it (0bu). */
const WHAT = { votes: 'vote pack', song_votes: 'song-vote payment', tip: 'tip', merch: 'merch order', request_hold: 'song request' };
const usd = (c) => '$' + (Math.max(0, c || 0) / 100).toFixed(2);
const votesWord = (n) => `${n} vote${n === 1 ? '' : 's'}`;

export function lossNote(p, was, moved, order = null, orderLine = (x) => String((x && x.title) || 'An item')) {
  const paid = cents(p.amount), amount = usd(paid), what = WHAT[p.kind] || 'payment';
  const d = p.dispute || null, wasStatus = String(was || '').split('|')[1] || '';
  const r = Number(p.refunded) || 0;
  // the dispute moved, or it is the only thing there is to say
  if (d && (d.status !== wasStatus || !r)) {
    if (d.status === 'won') return { title: `You won the dispute on a ${amount} ${what}`,
      body: `The money is back with you.${moved.g ? ` ${votesWord(moved.g)} went back to the fan.` : ''}` };
    if (d.status === 'lost') return { title: `The bank sided with the buyer on a ${amount} ${what}`,
      body: 'The money has gone back to them.' };
    if (d.status === 'warning_closed') return { title: `The bank’s question about a ${amount} ${what} is closed`,
      body: 'Nothing was taken.' };
    if (String(d.status).startsWith('warning_')) return { title: `A bank is asking about a ${amount} ${what}`,
      body: 'Nothing has been taken yet. Answer it in your Stripe dashboard.' };
    if (!disputeKeeps(d.status) || !r) return { title: `A ${amount} ${what} is disputed`,
      body: `The bank is holding the money while it decides — answer it in your Stripe dashboard.${moved.n ? ` ${votesWord(moved.n)} not yet spent were taken back.` : ''}` };
  }
  const whole = r >= paid;
  const title = whole ? `A ${amount} ${what} was refunded` : `${usd(r)} of a ${amount} ${what} was refunded`;
  let body = 'The money has gone back to the buyer.';
  if (p.kind === 'merch' && order) body = whole ? `${orderLine(order)} — don’t hand it over.` : `${orderLine(order)} — the order still stands.`;
  if (moved.n) body = `${votesWord(moved.n)} not yet spent were taken back; votes already cast stay.`;
  return { title, body };
}

async function tellLoss(owner, { p, was, order }, moved) {
  const venue = String(owner).startsWith('v_');
  const merch = p.kind === 'merch';
  const { orderLine } = await import('./_ordernote.mjs');
  const { title, body } = lossNote(p, was, moved, order, orderLine);
  const url = venue ? '/venues?tab=merch' : (merch ? '/studio?tab=merch' : '/studio?tab=money');
  const { notify } = await import('./_push.mjs');
  await within(notify(owner, { title, body, url, tag: 'loss-' + String(p.at || '').slice(-8) },
                      { tab: venue || merch ? 'merch' : 'money' }), NOTE_MS);
}
