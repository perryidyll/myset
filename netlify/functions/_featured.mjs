import { readDoc, casDoc, sha } from './_lib.mjs';

/* FEATURED SHOWS — three paid spots at the top of a city's night.

   Perry, 2026-09-05: "give them the option to select one of the gigs they've added,
   and then pay $10 to place it in the featured shows section of a city's shows
   list... only 3 featured show spots are listed for each day — first come first
   serve."

   THE HARD PART IS NOT THE PAYMENT, IT IS THE RACE. Three spots, first come first
   served, and two artists can tap Promote in the same second. Two ways to get that
   wrong, and both are worse than they sound:

     · CHARGE FIRST, CLAIM AFTER — somebody pays $10 for a spot that filled while
       Stripe was thinking, and now MySet owes a refund it has to remember to make.
     · CLAIM FIRST, NEVER EXPIRE — anyone can fill a city's night for free by
       opening checkout three times and walking away.

   So: a HOLD. The slot is claimed before the checkout opens and expires by itself
   twenty minutes later unless the payment lands. Abandoning checkout costs the
   artist nothing and frees the spot on its own; nobody is ever charged for a spot
   they did not get. The claim happens inside a compare-and-set, so "first come" is
   decided by the store rather than by whose request arrived at which instance.

   The refund path still exists — for the genuine case where the payment succeeds
   after the hold expired AND the day filled up in between. Rare, and the honest
   answer to it is money back, not a credit note nobody asked for.

   TWO DOCUMENTS, ON PURPOSE:
     · `feat_<citykey>` is the shared truth about who holds the three spots. Keyed by
       city, reachable from `cityindex` (which the app already keeps), so nothing
       here needs Blobs `list()` — INVARIANT 1.
     · `feats_<aid>` is the artist's own copy: what they bought, so the Studio can
       show it and `deleteArtist` can clean up without walking every city.

   IF THE GIG IS CANCELLED the spot is spent. The city feed renders a featured row
   only when the occurrence still exists, so a deleted gig simply stops appearing —
   and the sheet says so before anybody pays, rather than after. */

export const FEAT_PRICE = 1000;          // $10, Perry's number
export const SLOTS = 3;                  // per city, per date
export const HOLD_MS = 20 * 60e3;
export const MINE = (aid) => `feats_${aid}`;

/* A blob key for a city. Lowercased and stripped, with a short hash on the end so
   two cities that clean to the same string ("Sao Paulo" / "São Paulo") cannot share
   a slot table. Derived, never stored, so it cannot drift from the city index. */
export const cityKey = (country, city) => {
  const flat = `${String(country || '')}|${String(city || '')}`.trim().toLowerCase();
  const slug = flat.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `feat_${slug || 'x'}-${sha(flat).slice(0, 8)}`;
};

const empty = () => ({ v: 1, byDate: {} });
/* A TOMBSTONE IS NOT A SPOT. A refunded row stays only long enough to stop the
   other settle path granting the same payment; it must never count against the
   three, or refunding somebody would quietly shrink the night. */
const holdsASpot = (r) => !!r && !r.refunded;
const occupied = (rows) => (rows || []).filter(holdsASpot).length;

/* WHOSE "TODAY"? NOBODY'S — a floor two days behind UTC.

   This was very nearly a quiet way to delete paid spots. `prune` runs inside the
   compare-and-set of claimSlot and markPaid, so it DOES write, and it was given the
   calling artist's own local date. A city table is shared: an artist in Bangkok
   claiming a spot has a `today` up to a day ahead of an artist in London, and
   pruning on it would have deleted London's rows for a night that had not happened
   there yet — including ones somebody had paid for.

   So deletion never uses the caller's date. Two days behind UTC is past for every
   timezone on earth (the real spread is 26 hours), and this is garbage collection:
   keeping a dead row a day too long costs nothing, deleting a live one costs
   somebody $10 and their spot. The caller's `today` is still used for FILTERING what
   to show, which is a display question and safe to get locally right. */
const DELETE_FLOOR_DAYS = 2;
const safeFloor = (now) =>
  new Date(now - DELETE_FLOOR_DAYS * 86400e3).toISOString().slice(0, 10);

/** Drop expired holds and days that are past for everyone. Pure — the caller writes. */
function prune(d, today, now) {
  d.byDate = d.byDate && typeof d.byDate === 'object' ? d.byDate : {};
  const floor = safeFloor(now);
  let changed = false;
  for (const [date, rows] of Object.entries(d.byDate)) {
    if (date < floor) { delete d.byDate[date]; changed = true; continue; }
    /* A TOMBSTONE OUTLIVES A HOLD. It is `paid:false`, so the hold clock would have
       swept it after twenty minutes — and then the OTHER settle path (the webhook
       and the browser return trip both run) could grant a spot for a payment that
       had already been refunded. The two paths can be minutes apart, or an hour if
       somebody leaves the tab open. A tombstone therefore lives as long as the
       night does; it costs one small row and it never occupies a spot. */
    const keep = (Array.isArray(rows) ? rows : [])
      .filter((r) => r && (r.paid || r.refunded || now - Number(r.at || 0) < HOLD_MS));
    if (keep.length !== (rows || []).length) changed = true;
    if (keep.length) d.byDate[date] = keep; else { delete d.byDate[date]; changed = true; }
  }
  return changed;
}

export async function readFeatured(key, today = '', now = Date.now()) {
  const { data } = await readDoc(key, null);
  const d = { ...empty(), ...(data || {}) };
  prune(d, today, now);                    // read-side only; nothing is written here
  return d;
}

/**
 * Take one of the three spots, or say the day is full.
 *
 * `sid` is the checkout session's idempotency handle — minted before the session
 * so a retry finds its own hold rather than taking a second spot.
 */
export async function claimSlot(key, date, { aid, eventId, sid, today = '', now = Date.now() }) {
  let out = { ok: false, full: false, already: false };
  await casDoc(key, empty, (d) => {
    prune(d, today, now);
    const rows = (d.byDate[date] ||= []);
    const mineSame = rows.find((r) => r.sid === sid);
    if (mineSame) { out = { ok: true, already: true }; return false; }
    /* One spot per artist per night — otherwise the section is one act three times,
       which is not a listing.
       BUT ONLY ONCE IT IS PAID FOR. An UNPAID row is this artist's own abandoned
       hold from a minute ago, and blocking on it told somebody who had just backed
       out of checkout that they "already had a spot" — for twenty minutes, with no
       way to retry and nothing bought. Their own stale hold is replaced, not
       treated as a rival. */
    const held = rows.findIndex((r) => r.aid === aid);
    if (held >= 0) {
      if (rows[held].paid) { out = { ok: false, mine: true }; return false; }
      rows.splice(held, 1);
    }
    if (occupied(rows) >= SLOTS) { out = { ok: false, full: true }; return false; }
    rows.push({ aid, eventId: String(eventId || '').slice(0, 40), sid, at: now, paid: false });
    out = { ok: true, left: SLOTS - rows.length };
    return true;
  });
  return out;
}

/**
 * The payment landed.
 *
 * Returns { ok }, or { lost } when the hold expired and the day filled, or
 * { duplicate } when this artist has ALREADY PAID for that night.
 *
 * THE DUPLICATE CHECK IS NOT OPTIONAL, and it is the one that was missing.
 * `claimSlot` replaces an artist's own UNPAID hold so that backing out of checkout
 * does not lock them out — which means one artist can open three checkout sessions
 * a minute apart, each replacing the last hold, and then pay all three. Nothing in
 * the claim path can stop that, because at any instant only one hold exists. The
 * only place it can be caught is here, when the money actually arrives — and the
 * answer is to refuse the second and third and refund them, not to keep $20 for
 * spots that would turn a city's featured section into one act three times.
 */
export async function markPaid(key, date, sid, { aid = '', eventId = '', today = '', now = Date.now() } = {}) {
  let out = { ok: false, lost: false };
  await casDoc(key, empty, (d) => {
    prune(d, today, now);
    const rows = (d.byDate[date] ||= []);
    /* ALREADY REFUNDED. settleFeature runs from two directions — the Studio's
       return trip and the Stripe webhook — and if one refunds while the other
       grants, MySet has paid the money back AND given the spot away. The refund
       leaves a tombstone; this refuses to grant against one. */
    if (rows.some((r) => r.sid === sid && r.refunded)) { out = { ok: false, refundedAlready: true }; return false; }
    const mine = rows.find((r) => r.sid === sid);
    const someoneElsesTurn = (r) => r.sid !== sid;
    /* Already paid, by this artist, under a DIFFERENT handle. */
    const dupe = aid && rows.some((r) => r.paid && r.aid === aid && someoneElsesTurn(r));
    if (mine) {
      if (mine.paid) { out = { ok: true, already: true }; return false; }
      if (dupe) { out = { ok: false, duplicate: true }; return false; }
      mine.paid = true; out = { ok: true }; return true;
    }
    if (dupe) { out = { ok: false, duplicate: true }; return false; }
    /* The hold expired. If there is still room, honour the payment — the money is
       real, so refusing would be pedantry with a refund attached.
       COUNTED BY PAID ROWS, NOT BY ROWS. A hold is provisional: three people with
       checkout tabs open must never turn a real payment into a refund on a night
       nobody has actually bought. This also fixes the case where the payer's OWN
       replaced hold made the night look full to their own payment. */
    if (rows.filter((r) => r.paid).length >= SLOTS) { out = { ok: false, lost: true }; return false; }
    /* THE GIG ID MATTERS AS MUCH AS THE ARTIST. The city feed matches a featured
       row to an occurrence by eventId, so a revived row without one renders
       NOTHING — the artist would have paid $10 for a spot nobody can see. This
       branch runs whenever the hold has gone, which now includes the ordinary case
       of somebody re-tapping Promote (their earlier hold is replaced) and then
       paying the earlier tab. */
    rows.push({ aid: aid || '', eventId: String(eventId || '').slice(0, 40), sid, at: now, paid: true });
    out = { ok: true, revived: true };
    return true;
  });
  return out;
}

/** Give a spot back — an abandoned checkout, or a refunded one.
 *  `tomb: true` leaves a marker instead of nothing, so the other settle path
 *  cannot grant a spot for a payment that has just been sent back. The marker is
 *  pruned on the same clock as a hold. */
export const releaseSlot = (key, date, sid, { tomb = false, now = Date.now() } = {}) =>
  casDoc(key, empty, (d) => {
    const rows = (d.byDate || {})[date];
    if (!Array.isArray(rows) && !tomb) return false;
    const kept = (rows || []).filter((r) => r.sid !== sid);
    if (!tomb && kept.length === (rows || []).length) return false;
    if (tomb) kept.push({ aid: '', eventId: '', sid, at: now, paid: false, refunded: true });
    if (kept.length) d.byDate[date] = kept; else delete d.byDate[date];
    return true;
  }).catch(() => {});

/** Fill in the artist id on a revived row, once the session tells us whose it was. */
export const attachSlot = (key, date, sid, aid, eventId) =>
  casDoc(key, empty, (d) => {
    const r = ((d.byDate || {})[date] || []).find((x) => x.sid === sid);
    if (!r || r.aid) return false;
    r.aid = aid; r.eventId = String(eventId || '').slice(0, 40);
    return true;
  }).catch(() => {});

/** What is featured in this city, by date — paid rows only, in the order bought. */
export async function featuredFor(key, today = '', now = Date.now()) {
  const d = await readFeatured(key, today, now);
  const out = {};
  for (const [date, rows] of Object.entries(d.byDate || {})) {
    const paid = rows.filter((r) => r.paid && r.aid && holdsASpot(r)).slice(0, SLOTS);
    if (paid.length) out[date] = paid.map((r) => ({ aid: r.aid, eventId: r.eventId }));
  }
  return out;
}

/**
 * How many spots are left on each of these dates. For the Promote sheet.
 *
 * `forAid` excludes that artist's OWN unpaid hold, because `claimSlot` replaces it
 * rather than competing with it — without this the sheet greyed out a night the
 * server would have sold them, one minute after they backed out of checkout.
 */
export async function freeSlots(key, dates, today = '', now = Date.now(), forAid = '') {
  const d = await readFeatured(key, today, now);
  const out = {};
  for (const date of dates) {
    const rows = (d.byDate || {})[date] || [];
    const mineUnpaid = forAid ? rows.filter((r) => holdsASpot(r) && r.aid === forAid && !r.paid).length : 0;
    out[date] = Math.max(0, SLOTS - occupied(rows) + mineUnpaid);
  }
  return out;
}

/* ---------- the artist's own copy ---------- */
const emptyMine = () => ({ v: 1, list: [] });
export async function readMine(aid) {
  const { data } = await readDoc(MINE(aid), null);
  const d = { ...emptyMine(), ...(data || {}) };
  d.list = Array.isArray(d.list) ? d.list : [];
  return d;
}
export const noteMine = (aid, row) =>
  casDoc(MINE(aid), emptyMine, (d) => {
    d.list = Array.isArray(d.list) ? d.list : [];
    if (d.list.some((x) => x.sid === row.sid)) return false;
    d.list.push(row);
    /* Bounded, oldest first — a year of weekly promotions is 52 rows and this is
       a receipt list, not an archive. */
    if (d.list.length > 100) d.list = d.list.slice(-100);
    return true;
  });

/** Everything this artist has featured, cleaned of nights that have gone. */
export const upcomingMine = async (aid, today) =>
  (await readMine(aid)).list.filter((r) => r && r.date >= today).sort((a, b) => a.date.localeCompare(b.date));

/** Take an artist out of every city's table. Called when an account is deleted. */
export async function dropAllFor(aid) {
  const mine = await readMine(aid);
  const seen = new Set();
  for (const r of mine.list || []) {
    if (!r || !r.key || seen.has(r.key + r.date + r.sid)) continue;
    seen.add(r.key + r.date + r.sid);
    await releaseSlot(r.key, r.date, r.sid);
  }
  return { dropped: (mine.list || []).length };
}

/* ---------- settling a payment, from either direction ----------------------
   The Studio's return trip and the Stripe webhook both land here, and both may
   arrive first or twice. Everything below is idempotent: the slot is marked paid
   once, the artist's receipt is written once, and a second call finds both done.
   This is INVARIANT 5c's rule — a payment taken is a payment delivered — applied
   to a thing that is not a fan buying votes. */
export async function settleFeature(stripe, session, { today = '', now = Date.now() } = {}) {
  const md = (session && session.metadata) || {};
  if (md.kind !== 'feature') return { ok: false, error: 'not a feature payment' };
  if (session.payment_status !== 'paid') return { ok: false, error: 'not paid' };

  const key = String(md.key || ''), date = String(md.date || '').slice(0, 10);
  const aid = String(md.artist || ''), eventId = String(md.eventId || '');
  if (!key.startsWith('feat_') || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !aid)
    return { ok: false, error: 'that payment is missing its details' };

  /* THE HOLD IS FOUND BY THE ID WE MINTED, which Stripe carries back in the
     metadata. An earlier version claimed the hold under our id, then released it
     and re-claimed it under Stripe's session id once the session existed — which
     opened a window, however short, in which the spot somebody was about to pay for
     was free for anybody else to take. Carrying our own id through removes the
     window entirely: the hold is taken once and never moves. `session.id` remains
     the fallback for anything created before this change. */
  const hold = String(md.hold || '') || session.id;
  const r = await markPaid(key, date, hold, { aid, eventId, today, now });
  if (!r.ok && (r.lost || r.duplicate)) {
    /* Either the hold ran out AND the night filled while the payment was in flight,
       or this artist has already bought that night under a different handle (three
       tabs open — see markPaid). Both mean money taken for a spot that will not be
       given, so it goes back automatically, once, with the session id as the
       idempotency key so a webhook retry cannot refund twice. Telling somebody to
       email for a refund would be worse than the bug. */
    let refunded = false;
    try {
      const pi = typeof session.payment_intent === 'string'
        ? session.payment_intent : (session.payment_intent || {}).id;
      if (pi) {
        await stripe.refunds.create({ payment_intent: pi, reason: 'requested_by_customer' },
          { idempotencyKey: `myset-feat-refund-${session.id}`.slice(0, 200) });
        refunded = true;
      }
    } catch (e) { console.error('feature refund failed', session.id, e && e.message); }
    if (!refunded) {
      /* THE WORST CASE: money taken, no spot, and the refund itself failed. A log
         line nobody reads is not a record. This writes it into the artist's own
         Featured list as an OWED refund, so it is visible to them AND findable by
         Perry, and the Studio says so rather than leaving them to notice. */
      await noteMine(aid, {
        sid: hold, session: session.id, key, date, eventId,
        country: String(md.country || '').slice(0, 60), city: String(md.city || '').slice(0, 60),
        venue: String(md.venue || '').slice(0, 80),
        cents: Number(session.amount_total) || FEAT_PRICE,
        owed: true, at: now,
      }).catch((e2) => console.error('owed-refund record failed too', session.id, e2 && e2.message));
    }
    /* Give the hold back at once rather than letting it time out — this payment is
       not going to become a spot, and leaving it parked keeps a spot off the market
       somebody else could have had. A TOMBSTONE, not nothing, so the other settle
       path cannot grant the spot after the money has gone back. */
    await releaseSlot(key, date, hold, { tomb: true, now });
    return { ok: false, full: !!r.lost, duplicate: !!r.duplicate, refunded };
  }
  if (r.revived) await attachSlot(key, date, hold, aid, eventId);

  /* NOT best-effort, and the reason is deletion rather than the receipt. `feats_<aid>`
     is the only index that can tell `dropAllFor` which cities to visit — Blobs
     `list()` is banned (INVARIANT 1) — so a lost write leaves a paid row nothing can
     ever find. The row still expires with its own date, so the worst case is one
     blocked spot in one city for a few weeks rather than anything permanent; it is
     logged loudly so it is not invisible. */
  await noteMine(aid, {
    sid: hold, session: session.id, key, date, eventId,
    country: String(md.country || '').slice(0, 60), city: String(md.city || '').slice(0, 60),
    venue: String(md.venue || '').slice(0, 80),
    cents: Number(session.amount_total) || FEAT_PRICE,
    at: session.created ? session.created * 1000 : now,
  }).catch((e) => console.error('feature receipt not written', aid, hold, e && e.message));
  return { ok: true, already: !!r.already };
}
