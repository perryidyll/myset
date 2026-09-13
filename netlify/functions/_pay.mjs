import { createHash } from 'node:crypto';
import { mutateFan, mutateMeta, readMeta, cleanFanId, cleanArtistId, readDoc, grantPaidSongVotes } from './_lib.mjs';
import { isPlatformOwner } from './_plan.mjs';

/* WHOSE MONEY A SESSION IS. `metadata.artist` is an OWNER id: an artist id, or
   `v_<vid>` for a venue (0x). Running it through cleanArtistId strips the
   underscore, so a venue's merch order was written under `meta_v<vid>` — a
   document nobody reads — and the Venue Studio never saw the sale, on the return
   trip and on the webhook alike. Found on 2026-09-13 by the shop's venue redeem
   test; confirm.mjs and webhook.mjs both resolve the owner through this now, so
   the two paths cannot disagree about which document an order lives in. */
export const cleanOwnerId = (v) => {
  const s = String(v || '');
  return s.startsWith('v_') ? `v_${cleanArtistId(s.slice(2))}` : cleanArtistId(s);
};

/* ---------- THE PICKUP CODE ----------
   Four characters the buyer reads out at the merch table — "7K2Q" — and the artist
   finds in the Studio's order list. It is what every order-ahead counter uses,
   because matching a face to an order by the email on a Stripe receipt does not
   work in a loud bar.

   It is a LOOKUP KEY, nothing more: derived from the Checkout Session id (so the
   same session always says the same code, and the Studio can back-fill one for an
   order written before codes existed), never from the fan id (0bu), never a
   secret, and never proof of payment — `orderDone` is the only fulfilment. The
   alphabet drops 0/O and 1/I so it can be said across a room and written on a
   hand; 32 symbols is exactly five bits, so each character is one hash byte
   masked. Four characters is a million codes; a clash with another OPEN order of
   the same owner gets a fifth character, decided inside the same CAS that writes
   the order so two orders landing together cannot both take the short form. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const codeDigest = (sid) => createHash('sha256').update('pickup|' + String(sid || '')).digest();
const codePick = (h, i) => CODE_ALPHABET[h[i] & 31];
const shortCode = (h) => codePick(h, 0) + codePick(h, 1) + codePick(h, 2) + codePick(h, 3);
/* The code an existing row SHOWS: what was stored, or — for a row written before
   codes existed — the four the Studio back-fills from its session id (pubOrder,
   ownerOrder below). The clash rule must compare against what the room will
   actually read, or an old open order and a new one can both say the same four. */
const codeOf = (o) => o.code || shortCode(codeDigest(o.sid));
export function pickupCode(sid, orders = []) {
  const h = codeDigest(sid);
  let code = shortCode(h);
  const clash = (Array.isArray(orders) ? orders : []).some((o) =>
    o && o.sid !== sid && o.status !== 'done' && codeOf(o) === code);
  if (clash) code += codePick(h, 4);
  return code;
}

/* What the buyer's phone may know about its own order — everything the receipt
   shows, nothing that identifies a person. `fan` and `sid` stay in the record;
   `cents` is the LINE total (price × quantity) and `post` the postage on top, so
   the receipt can say both the way Stripe's page did. Rows written before the shop
   page carry no `cents`, `post`, `variant` or `code`: they are rebuilt here from
   `amount` and the session id, so an older order reads the same as a new one. */
export const pubOrder = (o) => o ? {
  item: o.item || '', title: o.title || '', qty: o.qty || 1, variant: o.variant || '',
  ship: o.ship === 'ship' ? 'ship' : 'pickup',
  cents: Number.isInteger(o.cents) ? o.cents : Math.max(0, Math.round((o.amount || 0) * 100) - (o.post || 0)),
  post: o.post || 0, code: o.code || pickupCode(o.sid), show: o.show || '', at: o.at || 0,
} : null;
const orderOf = (m, sid) => ((m && m.orders) || []).find((o) => o && o.sid === sid) || null;

/* What the OWNER's Studio sees of an order: the whole row less the buyer's device
   id — which the artist has no use for and which must never leave the store
   (0bu) — with the code, size and postage filled in for rows written before they
   existed, so one Studio row renders every order the same way. */
export const ownerOrder = (o) => {
  if (!o) return o;
  const { fan, ...rest } = o;
  return { ...rest, code: o.code || pickupCode(o.sid), variant: o.variant || '', post: o.post || 0 };
};

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
    /* The order rides along on a replay too — the meta document is already in hand,
       so the shop's receipt costs no extra read whichever page finishes the trip. */
    const o = pre.paid[sid].kind === 'merch' ? pubOrder(orderOf(pre, sid)) : null;
    return { ok: true, already: true, ...pre.paid[sid], ...(o ? { order: o } : {}) };
  }
  const retrying = !!pre.paid[sid];        // claimed before, never delivered

  const md = session.metadata || {};
  const who = cleanFanId(md.fan) || cleanFanId(fallbackFan);
  const amount = (session.amount_total || 0) / 100;
  const at = (session.created ? session.created * 1000 : Date.now());
  let granted = 0, already = false, orderRow = null;

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
        /* `post` is what pay.mjs asked Stripe to add as a shipping rate, so the line
           total is the session total less that; `variant` and `show` are the
           metadata pay.mjs validated against the record. The code is minted HERE,
           against the orders already in this document, so the clash rule sees
           every order that will be there when this one lands. */
        const post = Math.max(0, parseInt(md.post, 10) || 0);
        orderRow = { sid, item: String(md.item || '').slice(0, 8), title: String(md.title || '').slice(0, 60),
                     qty: Math.max(1, Math.min(9, parseInt(md.qty, 10) || 1)), amount,
                     cents: Math.max(0, (session.amount_total || 0) - post), post,
                     variant: String(md.variant || '').slice(0, 24), code: pickupCode(sid, m.orders),
                     show: String(md.show || '').slice(0, 40), fan: who, at,
                     ship: md.ship === 'ship' ? 'ship' : 'pickup', status: 'new' };
        m.orders.push(orderRow);
      }
      const needsGrant = (md.kind === 'votes' || md.kind === 'song_votes') && !!who && granted > 0;
      m.paid[sid] = { kind: md.kind || 'unknown', amount, granted, fan: who, at,
                      song: md.song || '', delivered: !needsGrant };
      return true;
    });
    if (already) {
      const m = await readMeta(aid);
      const o = (m.paid[sid] || {}).kind === 'merch' ? pubOrder(orderOf(m, sid)) : null;
      return { ok: true, already: true, ...(m.paid[sid] || {}), ...(o ? { order: o } : {}) };
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
  /* A merch order is delivered on the claim, so a retry of one never reaches here
     with the row unwritten — but if it did, the row from the first claim is in
     `pre`, already read. */
  const order = md.kind === 'merch' ? pubOrder(orderRow || orderOf(pre, sid)) : null;
  return { ok: true, kind: md.kind || 'unknown', amount, granted, song: md.song || '', fan: who, at,
           redelivered: retrying || undefined, ...(order ? { order } : {}) };
}
