import { createHash } from 'node:crypto';
import { mutateFan, mutateMeta, readMeta, cleanFanId, cleanArtistId, readDoc, grantPaidSongVotes,
         casDoc, own, roomHash, clientIp, GR_KEEP, KEY, emptyMeta } from './_lib.mjs';
import { isPlatformOwner } from './_plan.mjs';

/* THE DOOR TO CHECKOUT HAS A LIMIT (decision 0111). /api/pay made a Checkout Session
   for every request it was handed, and a script handing it a fresh `attempt` each
   time could open thousands — on the artist's own Stripe account — until Stripe's
   rate limit shut the door on the real buyer behind it. Two token buckets, in one
   small document per owner, in the shape decision 0030 chose for casting: a device
   may open PAY_BURST checkouts in a row and PAY_PER_MIN a minute after that; a
   whole network, PAY_NET_BURST and PAY_NET_PER_MIN. A real buyer taps Buy a handful
   of times a night, so the device's numbers are wide enough that a page retrying
   on a bad connection is never refused. The network's are sized for the worst real
   night, not the average one: a bar's wifi is one address with two hundred phones
   behind it, and the moment the artist says "tip jar's open" is when they all tap
   at once — so the network may open more checkouts in a row than the bar holds
   phones, and refill faster than a room can tap. The first sizing (sixty in a row)
   would have shown that room "Too many tries" at the buy moment; the cross-session
   review caught it before it shipped. A device id is the client's to choose, so the
   network bucket is the one a script actually meets — and a script held to a couple
   of checkouts a second is a nuisance on the artist's Stripe dashboard, not a
   denial of the door. A refused attempt writes nothing; a limiter that cannot be
   written never refuses a sale (the CAS gets five tries, then lets go). */
export const PAY_BURST = 40, PAY_PER_MIN = 10;
export const PAY_NET_BURST = 300, PAY_NET_PER_MIN = 120;
const PAYLIM = (owner) => `paylim_${owner}`;
const MAX_BUCKETS = 400;
export async function payAllowed(owner, fan, req, now = Date.now()) {
  const net = roomHash(owner, clientIp(req));
  let allowed = true;
  try {
    await casDoc(PAYLIM(owner), () => ({ v: 1, b: {} }), (d) => {
      d.b = d.b && typeof d.b === 'object' ? d.b : {};
      const take = (id, burst, perMin) => {
        const b = own(d.b, id) || { t: burst, at: now };
        const t = Math.min(burst, (Number(b.t) || 0) + Math.max(0, now - (Number(b.at) || now)) / 60e3 * perMin);
        if (t < 1) return false;
        d.b[id] = { t: t - 1, at: now };
        return true;
      };
      const okFan = take('f:' + fan, PAY_BURST, PAY_PER_MIN);
      const okNet = !net || take('n:' + net, PAY_NET_BURST, PAY_NET_PER_MIN);
      if (!okFan || !okNet) { allowed = false; return false; }
      const ids = Object.keys(d.b);
      if (ids.length > MAX_BUCKETS) {
        ids.sort((a, c) => (d.b[a].at || 0) - (d.b[c].at || 0));
        for (const id of ids.slice(0, ids.length - MAX_BUCKETS)) delete d.b[id];
      }
      return true;
    }, null, 5);
  } catch { /* the limiter is not the sale */ }
  return allowed;
}

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

/* The artist's profile or the venue's, by the owner id's shape (`v_<vid>` is a venue,
   cleanOwnerId). Imported lazily: _profile and _venues both import _lib, as this does. */
async function takeStockFor(owner, item, qty, variant) {
  const { takeStock } = await import('./_profile.mjs');
  if (String(owner).startsWith('v_')) {
    const { mutateVenueProfile } = await import('./_venues.mjs');
    return mutateVenueProfile(String(owner).slice(2), (p) => takeStock(p.merch, item, qty, variant));
  }
  const { mutateProfile } = await import('./_profile.mjs');
  return mutateProfile(owner, (p) => takeStock(p.merch, item, qty, variant));
}

/* THE "DELIVERED" FLIP IS CHECKED (decision 0180). It was written once with its
   error swallowed, so a flip lost under load left the marker saying undelivered
   with nothing scheduled to look again until somebody pressed the sweep — by which
   time the fan record holding the grant receipt could be gone (see carryFans).
   Now the write is read back, and if it still does not land the session goes on
   the owed list, where the bell retries it within minutes: the retry finds the
   receipt on the fan, grants nothing, and makes the flip. The buyer is never told
   about any of this — their votes are already on their phone. */
/* `also` rides in the same write: `{ wallet: true }` when song votes went to the
   fan's wallet (0182), which is what lets a refund later know there are wallet votes
   to take back rather than ballot entries it must leave alone (decision 0177). */
async function markDelivered(aid, sid, also = null) {
  try {
    await casDoc(KEY.meta(aid), emptyMeta, (m) => {
      m.paid ||= {};
      if (!m.paid[sid] || m.paid[sid].delivered === true) return false;
      m.paid[sid].delivered = true;
      m.paid[sid].deliveredAt = Date.now();
      if (also) Object.assign(m.paid[sid], also);
      return true;
    }, (m) => !!(m && m.paid && m.paid[sid] && m.paid[sid].delivered === true));
  } catch (e) {
    console.error(`pay: the delivered flip for ${sid} (${aid}) did not land; the bell will retry it:`, String((e && e.message) || e));
    await noteOwed(aid, sid).catch(() => {});
  }
}

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
      // the night it was tagged with rides along (0095) so the app's own record can say which show a tip or a pack belonged to without asking Stripe;
      // the session id too, so a refund can find the row it takes back (0177)
      if (md.kind === 'tip') m.tips.push({ fan: who, amount, note: md.note || '', at, show: String(md.show || '').slice(0, 40), sid });
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
                      song: md.song || '', show: String(md.show || '').slice(0, 40), delivered: !needsGrant };
      return true;
    });
    if (already) {
      const m = await readMeta(aid);
      const o = (m.paid[sid] || {}).kind === 'merch' ? pubOrder(orderOf(m, sid)) : null;
      return { ok: true, already: true, ...(m.paid[sid] || {}), ...(o ? { order: o } : {}) };
    }
    /* THE COUNT COMES DOWN once, on the claim that wrote the order (the founder,
       2026-09-14: a quantity "that automatically adjusts itself as purchases are
       made"). Best-effort and after the money is safe: a lost write here leaves the
       count one high and the artist corrects it in the Studio; a double write is
       impossible because only the fresh claim reaches this line. An item that is
       not counting (stock null) is left alone. */
    if (orderRow) await takeStockFor(aid, orderRow.item, orderRow.qty, orderRow.variant).catch(() => {});
    /* …and the owner hears about it (the founder, 2026-09-27): a push and an email,
       once, from this fresh claim only — time-boxed, never thrown (_ordernote.mjs). */
    if (orderRow) await import('./_ordernote.mjs').then(({ tellOrder }) => tellOrder(aid, orderRow)).catch(() => {});
    if (md.kind === 'tip' && String(aid).startsWith('v_')) await import('./_ordernote.mjs').then(({ tellVenueTip }) => tellVenueTip(aid, amount, md.note)).catch(() => {});
  } else {
    granted = Number(pre.paid[sid].granted)
      || (md.kind === 'votes' || md.kind === 'song_votes' ? parseInt(md.votes, 10) || 0 : 0);
  }

  /* SONG VOTES THE ROOM CAN NO LONGER GIVE (decision 0182). pay.mjs checks the replay
     is open when Checkout starts, but a card form can take minutes: by the time the
     money lands the show may have ended, a new one started, or that very song be
     playing. Ballot entries then would sit on a dead or spent board. They become
     wallet votes instead — the same pack-shaped grant, carried to the fan's next
     show like any unspent paid vote — and the reply says so. The receipt (`gr`) is
     the same either way, so a later retry cannot grant both. */
  let asCredits = false;
  if (md.kind === 'song_votes' && who && granted) {
    const { getShow } = await import('./_lib.mjs');
    const sh = await getShow(aid, { withName: false });
    const song = String(md.song || '').slice(0, 60);
    asCredits = !song || sh.status !== 'live' || String(md.show || '') !== String(sh.showId || '')
      || sh.nowPlaying === song || !(sh.played || []).includes(song);
  }

  if ((md.kind === 'votes' || asCredits) && who && granted) {
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
        if (me.gr.length > GR_KEEP) me.gr = me.gr.slice(-GR_KEEP);
        target = (me.extra || 0) + granted;
        me.extra = target;
        return true;
      },
      (me) => alreadyGranted || (target !== null && (me.extra || 0) >= target
              && (me.gr || []).includes(sid))
    );
    /* Only now is it delivered. If this flip is lost the marker stays undelivered and
       the sweep tries again — which is safe, because of the guard above. Song votes
       that went to the wallet say so, but only from the call that granted them: a
       retry cannot tell which road the first grant took, and leaving the flag off
       means a refund takes nothing back, never the wrong thing (0177). */
    await markDelivered(aid, sid, asCredits && !alreadyGranted ? { wallet: true } : null);
  }
  if (md.kind === 'song_votes' && !asCredits && who && granted && md.song) {
    /* These dollars were offered for one specific replay. They become ballot
       entries directly, with paid attribution, rather than wallet credits the fan
       would still have to remember to cast after returning from Stripe. */
    await grantPaidSongVotes(aid, who, String(md.song).slice(0, 60), granted, sid);
    await markDelivered(aid, sid);
  }
  /* A merch order is delivered on the claim, so a retry of one never reaches here
     with the row unwritten — but if it did, the row from the first claim is in
     `pre`, already read. */
  const order = md.kind === 'merch' ? pubOrder(orderRow || orderOf(pre, sid)) : null;
  return { ok: true, kind: md.kind || 'unknown', amount, granted, song: md.song || '', fan: who, at,
           redelivered: retrying || undefined, asCredits: asCredits || undefined, ...(order ? { order } : {}) };
}

/* ---------- A PAYMENT STILL OWED (decision 0138) ----------

   The webhook is the path that runs whatever the buyer's phone does, and it used to
   answer 200 after a grant had failed — so Stripe, told "received", never came back,
   and the only roads left were the buyer returning to the page or the artist
   pressing the sweep. Now a failed grant answers 500, which is the one thing that
   makes Stripe redeliver. But Stripe's retries back off over hours, and a fan at a
   gig has minutes. So the failure is also written HERE, one small global document,
   and the bell (autocron, every two minutes) retries it from the scheduler.

   The row is a pointer, not a payment: the session id, whose it is, and which
   Stripe account it lives on. The session is read back from Stripe on every try, so
   nothing here can grant what Stripe does not say was paid, and `redeemSession`'s
   own claim and per-fan receipt make a row that is retried twice — or retried
   after Stripe's own redelivery already landed — a no-op (INVARIANT 5c, 7b).

   Bounded: OWED_MAX rows, three days each. Three days is how long Stripe itself
   keeps trying; after that the Money tab still shows the payment as not delivered
   and the Studio's sweep still recovers it. */
export const OWED = 'payowed';
export const OWED_KEEP_MS = 3 * 86400e3;
const OWED_MAX = 500;
const emptyOwed = () => ({ v: 1, rows: {} });

/** Remember that this paid session has not been delivered. */
export async function noteOwed(aid, sid, acct = '', now = Date.now()) {
  if (!aid || !sid) return;
  await casDoc(OWED, emptyOwed, (d) => {
    d.rows ||= {};
    if (d.rows[sid]) return false;
    d.rows[sid] = { aid, acct: String(acct || ''), at: now, tries: 0, lastAt: 0 };
    const ids = Object.keys(d.rows);
    if (ids.length > OWED_MAX) {
      ids.sort((a, b) => (d.rows[a].at || 0) - (d.rows[b].at || 0));
      for (const id of ids.slice(0, ids.length - OWED_MAX)) delete d.rows[id];
    }
    return true;
  });
}

/**
 * Retry what is owed. Called by the bell; bounded by `limit` and by `deadline` (a
 * real clock time), least-recently-tried first so one stuck row cannot starve the
 * rest. Never throws.
 */
export async function redeliverOwed({ now = Date.now(), limit = 10, deadline = Date.now() + 8000, log = () => {} } = {}) {
  let rows = [];
  try { rows = Object.entries((((await readDoc(OWED, null)).data || {}).rows) || {}); }
  catch (e) { console.error('redeliver: could not read what is owed:', String((e && e.message) || e)); return { checked: 0, delivered: 0 }; }
  if (!rows.length) return { checked: 0, delivered: 0 };
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { checked: 0, delivered: 0 };
  const stripe = new (await import('stripe')).default(key);
  rows.sort((a, b) => (a[1].lastAt || 0) - (b[1].lastAt || 0));
  const done = [], again = [];
  let delivered = 0;
  for (const [sid, r] of rows.slice(0, limit)) {
    if (Date.now() > deadline) break;
    if (now - (Number(r.at) || 0) > OWED_KEEP_MS) {
      console.error(`redeliver: gave up on ${sid} for ${r.aid} after three days — the Studio's sweep still recovers it`);
      done.push(sid); continue;
    }
    try {
      /* A row noted by the delivered flip (markDelivered) knows the owner but not
         the account; the owner's own Connect account is where their sessions live. */
      let opts = r.acct ? { stripeAccount: r.acct } : null;
      if (!opts) opts = (await (await import('./_connect.mjs')).stripeFor(r.aid)).opts || {};
      const session = await stripe.checkout.sessions.retrieve(sid, opts);
      if (session && session.payment_status === 'paid') {
        const got = await redeemSession(r.aid, session);
        // `already` is Stripe's own redelivery, or the buyer's return trip, having got there first
        if (got && got.ok && !got.already) { delivered += 1; log(`autocron: delivered a payment that was still owed to ${r.aid}`); }
      }
      done.push(sid);
    } catch (e) {
      again.push(sid);
      console.error(`redeliver: ${sid} for ${r.aid} failed again:`, String((e && e.message) || e));
    }
  }
  if (done.length || again.length) {
    await casDoc(OWED, emptyOwed, (d) => {
      d.rows ||= {};
      for (const sid of done) delete d.rows[sid];
      for (const sid of again) if (d.rows[sid]) { d.rows[sid].tries = (d.rows[sid].tries || 0) + 1; d.rows[sid].lastAt = now; }
      return true;
    }).catch(() => {});
  }
  return { checked: done.length + again.length, delivered, owed: rows.length - done.length };
}
