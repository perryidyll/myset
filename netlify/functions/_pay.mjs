import { mutateFan, mutateMeta, readMeta, cleanFanId, readDoc } from './_lib.mjs';
import { isPlatformOwner } from './_plan.mjs';

/* ---------- CAN THIS ARTIST TAKE MONEY AT ALL? ----------
   There is ONE Stripe account behind MySet: the founding artist's. Stripe Connect,
   which would give each artist their own, is not built — grep the tree for
   `application_fee_amount`, `transfer_data`, `stripeAccount`, `on_behalf_of` or
   `accounts.create` and you will find nothing. INVARIANT 0r says so and says not to
   onboard a second paying artist before it exists.

   But nothing in the code ENFORCED that. A second artist's room got working Buy and
   Tip buttons, and every payment landed in the founding artist's account — verified
   findings C031, C054 and C067, which are all this. That is somebody else's money
   sitting in your Stripe balance, which is a legal problem and not just an awkward
   one.

   So: until an artist can actually receive money, their audience is not asked for
   any. A switched-off button with an honest label is a far better failure than a
   silent misdirection of funds, and INVARIANT 9 already guarantees the whole app
   works with payments off. INVARIANT 0w is untouched — everything the ROOM
   experiences stays free either way.

   When Connect lands, this becomes "has this artist finished payout onboarding?"
   and the rest of the app needs no change. That is the whole point of putting it
   here, in one function, rather than testing it at each call site. */
/* Has this account finished Stripe Connect onboarding, as STRIPE says — not as a
   local "they clicked the button" flag? Stored per account by the Connect webhook /
   onboarding return, read here so every money button in the app has ONE gate.

   Returns false for everyone today because Connect is not built yet (INVARIANT 0r).
   That is the correct answer, not a placeholder: until it exists, a second artist's
   money would land in the founder's Stripe balance. */
export async function connectReady(aid) {
  if (!process.env.STRIPE_SECRET_KEY) return false;
  if (isPlatformOwner(aid)) return true;          // the founder's own account
  const { data } = await readDoc(`connect_${aid}`, null);
  return !!(data && data.chargesEnabled);
}

/* Sync, because it is read on the hot audience poll. It answers "may this account
   show a money button at all", and INVARIANT 0ad says never show the room a button
   that leads to a shrug. */
export const canTakeMoney = (aid) =>
  !!process.env.STRIPE_SECRET_KEY && isPlatformOwner(aid);

/* ONE implementation of "grant what this payment bought".
   Used by the return page (/api/confirm), the Stripe webhook and the artist's
   reconcile sweep, so all three grant identically and none can drift.
   Replay-safe: the session is claimed in meta.paid before anything is granted,
   so a refresh, a webhook retry and a sweep can all race without double-paying. */
export async function redeemSession(aid, session, fallbackFan = '') {
  if (!session || !session.id) return { ok: false, error: 'no session' };
  if (session.payment_status !== 'paid') return { ok: false, error: 'not paid' };

  const sid = session.id;
  const pre = await readMeta(aid);
  if (pre.paid[sid]) return { ok: true, already: true, ...pre.paid[sid] };

  const md = session.metadata || {};
  const who = cleanFanId(md.fan) || cleanFanId(fallbackFan);
  const amount = (session.amount_total || 0) / 100;
  const at = (session.created ? session.created * 1000 : Date.now());
  let granted = 0, already = false;

  // claim first so a double-tap / webhook race can't grant twice
  await mutateMeta(aid, (m) => {
    if (m.paid[sid]) { already = true; return false; }
    if (md.kind === 'votes') granted = parseInt(md.votes, 10) || 0;
    if (md.kind === 'tip') m.tips.push({ fan: who, amount, note: md.note || '', at });
    m.paid[sid] = { kind: md.kind || 'unknown', amount, granted, fan: who, at };
    return true;
  });

  if (already) {
    const m = await readMeta(aid);
    return { ok: true, already: true, ...(m.paid[sid] || {}) };
  }

  if (md.kind === 'votes' && who && granted) {
    // INVARIANT 4: the session is already claimed, so a silent write failure here
    // would lose paid-for votes permanently. Verify by read-back and retry.
    let target = null;
    await mutateFan(
      aid, who,
      (me) => { target = (me.extra || 0) + granted; me.extra = target; return true; },
      (me) => target !== null && (me.extra || 0) >= target
    );
  }
  return { ok: true, kind: md.kind || 'unknown', amount, granted, fan: who, at };
}
