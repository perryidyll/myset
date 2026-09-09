import { mutateFan, mutateMeta, readMeta, cleanFanId, readDoc, grantPaidSongVotes } from './_lib.mjs';
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
   that leads to a shrug.

   It stays synchronous by reading `show.pay`, which _connect.mjs mirrors from Stripe
   and which every caller has already loaded — so gating on Connect costs ZERO extra
   blob reads on the path the whole room hammers. Stripe is the authority; this is a
   cache with exactly one writer.

   The founder's clause is not a special case for its own sake: his account predates
   Connect and charges on the platform account directly, so removing it would switch
   off live payments at the next deploy. */
export const canTakeMoney = (aid, show) =>
  !!process.env.STRIPE_SECRET_KEY &&
  (isPlatformOwner(aid) || !!(show && show.pay && show.pay.ready));

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
  /* CLAIMED IS NOT DELIVERED. The claim used to be the only marker, so a grant that
     failed after it — a lost shard write, the function dying between the two — left
     the money taken, the votes ungranted, and all three recovery paths answering
     "already". That is the 2026-08-30 failure with a different cause, and it is why
     `delivered` exists. A marker without it is a claim from before this change and
     is treated as delivered, because those really were. */
  if (pre.paid[sid] && pre.paid[sid].delivered !== false) {
    return { ok: true, already: true, ...pre.paid[sid] };
  }
  const retrying = !!pre.paid[sid];        // claimed before, never delivered

  const md = session.metadata || {};
  const who = cleanFanId(md.fan) || cleanFanId(fallbackFan);
  const amount = (session.amount_total || 0) / 100;
  const at = (session.created ? session.created * 1000 : Date.now());
  let granted = 0, already = false;

  /* Claim first so a double-tap or a webhook race cannot grant twice — but claim it
     as UNDELIVERED, so a failure below leaves work to be picked up rather than a
     receipt for nothing. A tip needs no grant, so it is delivered on the spot. */
  if (!retrying) {
    await mutateMeta(aid, (m) => {
      if (m.paid[sid] && m.paid[sid].delivered !== false) { already = true; return false; }
      if (md.kind === 'votes') granted = parseInt(md.votes, 10) || 0;
      if (md.kind === 'song_votes') granted = parseInt(md.votes, 10) || 0;
      if (md.kind === 'tip') m.tips.push({ fan: who, amount, note: md.note || '', at });
      /* MERCH. What the buyer bought is an ORDER the artist fulfils by hand, so the
         order record IS the delivery — written inside this same claim, so a session
         can never be claimed without it. Nothing about the buyer is stored: their
         name and address stay on Stripe and are fetched when the artist opens the
         order (orderDetail), never kept in Blobs (0bu's posture). */
      if (md.kind === 'merch') {
        m.orders ||= [];
        m.orders.push({ sid, item: String(md.item || '').slice(0, 8), title: String(md.title || '').slice(0, 60),
                        qty: Math.max(1, Math.min(9, parseInt(md.qty, 10) || 1)), amount, fan: who, at,
                        ship: md.ship === 'ship' ? 'ship' : 'pickup', status: 'new' });
      }
      const needsGrant = (md.kind === 'votes' || md.kind === 'song_votes') && !!who && granted > 0;
      m.paid[sid] = { kind: md.kind || 'unknown', amount, granted, fan: who, at,
                      song: md.song || '', delivered: !needsGrant };
      return true;
    });
    if (already) {
      const m = await readMeta(aid);
      return { ok: true, already: true, ...(m.paid[sid] || {}) };
    }
  } else {
    granted = Number(pre.paid[sid].granted)
      || (md.kind === 'votes' || md.kind === 'song_votes' ? parseInt(md.votes, 10) || 0 : 0);
  }

  if (md.kind === 'votes' && who && granted) {
    /* THE GRANT IS IDEMPOTENT PER (fan, session), recorded on the fan record itself.
       Without that, a re-attempt after a lost `delivered` flip would hand out the
       pack twice — so the retry that fixes losing votes would start minting them.
       INVARIANT 4's read-back verify stays: a silently-dropped write here is exactly
       what this whole two-phase dance is guarding against. */
    let target = null, alreadyGranted = false;
    await mutateFan(
      aid, who,
      (me) => {
        me.gr ||= [];
        if (me.gr.includes(sid)) { alreadyGranted = true; return false; }
        me.gr.push(sid);
        if (me.gr.length > 20) me.gr = me.gr.slice(-20);
        target = (me.extra || 0) + granted;
        me.extra = target;
        return true;
      },
      (me) => alreadyGranted || (target !== null && (me.extra || 0) >= target
              && (me.gr || []).includes(sid))
    );
    /* Only now is it delivered. If this flip is lost the marker stays undelivered and
       the sweep tries again — which is safe, because of the guard above. */
    await mutateMeta(aid, (m) => {
      if (!m.paid[sid] || m.paid[sid].delivered === true) return false;
      m.paid[sid].delivered = true;
      m.paid[sid].deliveredAt = Date.now();
      return true;
    }).catch(() => {});
  }
  if (md.kind === 'song_votes' && who && granted && md.song) {
    /* These dollars were offered for one specific replay. They become ballot
       entries directly, with paid attribution, rather than wallet credits the fan
       would still have to remember to cast after returning from Stripe. */
    await grantPaidSongVotes(aid, who, String(md.song).slice(0, 60), granted, sid);
    await mutateMeta(aid, (m) => {
      if (!m.paid[sid] || m.paid[sid].delivered === true) return false;
      m.paid[sid].delivered = true;
      m.paid[sid].deliveredAt = Date.now();
      return true;
    }).catch(() => {});
  }
  return { ok: true, kind: md.kind || 'unknown', amount, granted, song: md.song || '', fan: who, at,
           redelivered: retrying || undefined };
}
