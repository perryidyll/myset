import { readDoc, casDoc, DEFAULT_ARTIST } from './_lib.mjs';

/* THE BOOKS.

   Perry: "getting a proper ACCOUNTING system in place... tracking all the
   financials – for artists & venues, as well as for me and the myset bank
   account (i guess stripe's dashboard is probably more than enough...)"

   HALF RIGHT, AND THE HALF THAT IS WRONG IS THE EXPENSIVE HALF.

   Stripe IS enough to hold the transactions, and INVARIANT 5d already says it is
   the source of truth for money. Building a second ledger that re-derives what a
   charge was would be a machine for disagreeing with Stripe, and the day the two
   disagree is the day neither can be trusted. So nothing here re-derives anything.

   What Stripe is NOT enough for is the two questions an actual business asks:

     1. "What did I EARN this month?" — Perry's money arrives in two unrelated
        places. Subscriptions are ordinary charges on the PLATFORM account.
        Connect fees are `application_fee` entries, which the dashboard's revenue
        charts do not add up for you, and half of each one is given back by the
        fee split (_feesplit.mjs) as an `application_fee_refund`. Nowhere in
        Stripe is there one number that says what MySet made.
     2. "What did I earn, for my tax return?" — an artist's money lives on THEIR
        connected account, one direct charge at a time, and Stripe's own export is
        a transaction list, not a statement. A musician needs a year, by month,
        gross and net, as a file they can hand somebody.

   SO THIS IS A REPORTING LAYER, NOT A LEDGER. Every figure comes from Stripe's
   BALANCE TRANSACTIONS — the one list Stripe itself reconciles to the bank — and
   is only bucketed, never recomputed. If Stripe says the fee was 47¢, this says
   47¢, and there is no code path that can produce a different number.

   WHY BALANCE TRANSACTIONS AND NOT CHECKOUT SESSIONS. `revenue.mjs` and
   `_history.mjs` both read checkout sessions, because they are answering "did
   this specific person get what they paid for". Sessions are the wrong shape for
   books: they do not know Stripe's fee, they do not know the application fee,
   they do not include refunds, disputes, or a payout, and they do not exist at
   all for a subscription renewal. The balance transaction knows all of it, in the
   settlement currency, and it is what an accountant would ask for.

   THE MONTHLY CLOSE, which is also what makes this cheap. A month that has ended
   cannot change in any way that matters (a dispute months later is rare and shows
   up in the month it settles, which is correct accounting). So a closed month is
   computed once and cached for ever in `ledger_<owner>`; only the current month is
   ever recomputed. A year's statement therefore costs one Stripe page, not twelve.

   WHAT IS DELIBERATELY NOT HERE:
     · double-entry, journals, a chart of accounts. Perry is one person. The
       destination for real books is Stripe -> an accounting package, and the
       recommendation in ACCOUNTING.md says so plainly rather than pretending a
       blob store is Xero.
     · anything that writes to Stripe. This file only ever reads.
     · a fan's device id or email — INVARIANT 0bu holds here too. */

export const LEDGER = (owner) => `ledger_${owner}`;
/* THE COMPANY'S BOOKS ARE NOT AN ARTIST'S STATEMENT, so they do not share a
   document with one. `platformSplit` used to write into `ledger_<founder>` — the
   very key `statement()` uses for a CONNECTED account — which meant the day Perry
   linked a Stripe account of his own, his connected-account takings and MySet's
   company revenue would overwrite each other in the same `months` field, under two
   incompatible meanings. One key, one meaning. */
export const PLATFORM_LEDGER = 'ledger_platform';
export const COSTS = 'costs';
const MAX_PAGES = 12;                 // 1,200 balance transactions per refresh

export const monthKey = (ms) => new Date(ms).toISOString().slice(0, 7);
export const monthStart = (key) => Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, 1);
export const monthEnd = (key) => Date.UTC(+key.slice(0, 4), +key.slice(5, 7), 1);
/** The last `n` months, newest first — never reaching back past `since`.
 *
 *  WHY `since` MATTERS. Twelve months of a statement that begins before the artist
 *  existed is eleven rows of zero, and it made a page somebody joined last week
 *  look like a business that had a terrible year. It also costs real Stripe pages
 *  to fetch a window in which nothing can possibly have happened. */
export function lastMonths(n, now = Date.now(), since = 0) {
  const floor = since ? monthKey(since) : '';
  const out = [];
  const d = new Date(now);
  for (let i = 0; i < n; i++) {
    const k = monthKey(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    if (floor && k < floor) break;
    out.push(k);
  }
  return out;
}

const emptyMonth = () => ({
  currency: '', gross: 0, stripeFee: 0, platformFee: 0, net: 0,
  refunds: 0, disputes: 0, payouts: 0, other: 0, count: 0,
});

/* HOW A BALANCE TRANSACTION IS READ, and why each line is what it is.

   `amount` is always signed and always in the settlement currency. `fee` is what
   Stripe took off THIS entry, and `fee_details` says what each part of it was.

   On a CONNECTED account (an artist or venue taking a direct charge) one payment
   produces one `charge` entry whose fee_details hold BOTH `stripe_fee` and
   `application_fee` — Stripe's cut and MySet's cut, deducted together. So the
   artist's own statement gets all three numbers from one row and can never be
   out by the platform fee, which is exactly the mistake a hand-rolled ledger makes.

   On the PLATFORM account the same night appears completely differently: nothing
   at all for the charge (it never touched Perry's balance), one `application_fee`
   entry for what MySet earned, and — when _feesplit.mjs gives half of Stripe's fee
   back — an `application_fee_refund` for a negative amount. Both are counted as
   platform revenue, so the split is netted off automatically rather than being a
   correction somebody has to remember. */
export function foldTx(m, bt) {
  const t = bt.type || '';
  const amt = Number(bt.amount) || 0;
  const fee = Number(bt.fee) || 0;
  const net = Number(bt.net) || 0;
  m.currency ||= String(bt.currency || '').toUpperCase();
  const detail = (type) => (bt.fee_details || [])
    .filter((f) => f && f.type === type)
    .reduce((s, f) => s + (Number(f.amount) || 0), 0);

  if (t === 'charge' || t === 'payment') {
    m.gross += amt; m.net += net; m.count++;
    /* fee_details, never `bt.fee`. The same trap _feesplit.mjs documents: `fee` is
       everything deducted, so on a direct charge it silently includes MySet's own
       cut, and reporting it as "Stripe's fee" overstates Stripe and hides us. */
    const sf = detail('stripe_fee'), af = detail('application_fee');
    m.stripeFee += sf || (af ? fee - af : fee);
    m.platformFee += af;
  } else if (t === 'application_fee') {
    // the platform's side: this IS the revenue
    m.gross += amt; m.net += net; m.stripeFee += fee; m.count++;
  } else if (t === 'application_fee_refund') {
    // negative: the fee split giving half of Stripe's fee back to the venue
    m.gross += amt; m.net += net;
  } else if (t === 'refund' || t === 'payment_refund' || t === 'transfer_refund') {
    m.refunds += amt; m.net += net;
  } else if (t === 'adjustment' || t === 'dispute' || t === 'dispute_reversal') {
    m.disputes += amt; m.net += net;
  } else if (t === 'payout' || t === 'payout_cancel' || t === 'payout_failure') {
    /* Money leaving for a bank account is NOT an expense and must never be
       subtracted from earnings. It is reported on its own line so the statement
       can also answer "and how much of it actually reached the bank". */
    m.payouts += amt;
  } else {
    m.other += amt; m.net += net;
  }
  return m;
}

/** Every balance transaction in a window, paged, in whatever account `opts` names. */
async function pull(stripe, opts, gte, lte) {
  const out = [];
  let after = null, truncated = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await stripe.balanceTransactions.list({
      limit: 100, created: { gte: Math.floor(gte / 1000), lte: Math.floor(lte / 1000) },
      ...(after ? { starting_after: after } : {}),
    }, opts);
    const rows = r.data || [];
    out.push(...rows);
    if (!r.has_more || !rows.length) break;
    after = rows[rows.length - 1].id;
    if (page === MAX_PAGES - 1) truncated = true;
  }
  out.truncated = truncated;
  return out;
}

export async function readLedger(owner, key) {
  const { data } = await readDoc(key || LEDGER(owner), null);
  const d = { v: 1, months: {}, mine: {}, at: 0, ...(data || {}) };
  d.months = d.months && typeof d.months === 'object' ? d.months : {};
  d.mine = d.mine && typeof d.mine === 'object' ? d.mine : {};
  return d;
}

/**
 * A statement for one owner: the last `n` months, each fully broken down.
 *
 * `owner` is an artist id, or `v_<venueId>` for a venue, or DEFAULT_ARTIST with
 * `platform:true` for MySet's own books. Returns { months, currency, cached, at }.
 *
 * ONLY THE CURRENT MONTH IS EVER RECOMPUTED — see the monthly close, above. A
 * `force` refresh recomputes everything, which is the button for the day somebody
 * genuinely doubts a figure.
 */
export async function statement(owner, stripe, opts, { months = 12, now = Date.now(), force = false, since = 0 } = {}) {
  const want = lastMonths(months, now, since);
  const cache = await readLedger(owner);
  const thisMonth = monthKey(now);

  const missing = want.filter((k) => force || k === thisMonth || !cache.months[k]);
  if (stripe && missing.length) {
    /* One window covering everything missing, rather than one call per month:
       Stripe pages by count, not by month, so twelve narrow calls cost twelve
       round trips to answer what one wide one answers. */
    const gte = Math.min(...missing.map(monthStart));
    const lte = Math.min(now + 3600e3, Math.max(...missing.map(monthEnd)));
    let rows = [];
    try { rows = await pull(stripe, opts, gte, lte); }
    catch (e) { return { ...shape(cache, want), error: 'Stripe wouldn’t answer just now', at: cache.at }; }
    /* A pull that ran out of pages is USED but never CACHED — a closed month is
       never re-read, so remembering an understated one freezes it for ever. */
    const partial = !!rows.truncated;

    const fresh = {};
    for (const k of missing) fresh[k] = emptyMonth();
    for (const bt of rows) {
      const k = monthKey(Number(bt.created) * 1000);
      if (fresh[k]) foldTx(fresh[k], bt);
    }
    if (!partial) await casDoc(LEDGER(owner), () => ({ v: 1, months: {}, at: 0 }), (d) => {
      d.months ||= {};
      for (const [k, v] of Object.entries(fresh)) d.months[k] = v;
      /* Bounded: five years of months is 60 rows of nine numbers. A statement
         older than that is a question for the accountant, not for this app. */
      const keys = Object.keys(d.months).sort();
      if (keys.length > 60) for (const k of keys.slice(0, keys.length - 60)) delete d.months[k];
      d.at = now;
      return true;
    }).catch(() => {});
    for (const [k, v] of Object.entries(fresh)) cache.months[k] = v;
    cache.at = now;
  }
  return shape(cache, want);
}

function shape(cache, want) {
  const months = want.map((k) => ({ month: k, ...(cache.months[k] || emptyMonth()) })).reverse();
  const currency = (months.find((m) => m.currency) || {}).currency || 'USD';
  const total = months.reduce((a, m) => ({
    gross: a.gross + m.gross, stripeFee: a.stripeFee + m.stripeFee,
    platformFee: a.platformFee + m.platformFee, net: a.net + m.net,
    refunds: a.refunds + m.refunds, count: a.count + m.count,
  }), { gross: 0, stripeFee: 0, platformFee: 0, net: 0, refunds: 0, count: 0 });
  return { months, currency, total, at: cache.at || 0 };
}

/* ---------- ONE ACCOUNT, TWO BUSINESSES ------------------------------------
   Perry's own vote packs and tips were taken on the PLATFORM account, before
   Connect existed — so the same Stripe balance holds his gig takings AND every
   artist's subscription. An earnings card built on that balance reads other
   people's subscriptions back to him as his own income, which is why the first
   version refused to show one at all.

   It is separable, though, and exactly:

     · a payment MySet sold on his behalf is a `charge` whose Checkout session was
       tagged `kind` = votes / tip / merch and `artist` = him. `revenue.mjs` has
       always used that test; this reuses it rather than inventing a second one.
     · everything else on the platform — subscription charges, `application_fee`
       entries, and the `application_fee_refund` the fee split gives back — is
       MySet's own revenue.

   ONE pull answers both. The balance transactions come back with their source
   expanded, so a charge's own metadata is right there; for charges taken before
   `payment_intent_data.metadata` was set (which is all of Perry's history, and the
   numbers he actually wants to talk about) the Checkout sessions for the same
   window are pulled once and matched by payment intent. Both halves are cached in
   the same document — `months` for the company, `mine` for the artist. */
async function pullSessions(stripe, gte, lte) {
  const out = [];
  let after = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await stripe.checkout.sessions.list({
      limit: 100, created: { gte: Math.floor(gte / 1000), lte: Math.floor(lte / 1000) },
      ...(after ? { starting_after: after } : {}),
    });
    const rows = r.data || [];
    out.push(...rows);
    if (!r.has_more || !rows.length) break;
    after = rows[rows.length - 1].id;
  }
  return out;
}

const APP_KINDS = new Set(['votes', 'song_votes', 'request_hold', 'tip', 'merch']);
const piOf = (v) => (typeof v === 'string' ? v : (v && v.id) || '');

export async function platformSplit(aid, stripe, { months = 12, now = Date.now(), force = false, since = 0 } = {}) {
  const want = lastMonths(months, now, since);
  const cache = await readLedger(aid, PLATFORM_LEDGER);
  cache.mine = cache.mine && typeof cache.mine === 'object' ? cache.mine : {};
  const thisMonth = monthKey(now);
  const missing = want.filter((k) => force || k === thisMonth || !cache.months[k] || !cache.mine[k]);

  if (stripe && missing.length) {
    const gte = Math.min(...missing.map(monthStart));
    const lte = Math.min(now + 3600e3, Math.max(...missing.map(monthEnd)));
    let rows = [], sessions = [], truncated = false;
    try {
      [rows, sessions] = await Promise.all([
        (async () => {
          const out = [];
          let after = null;
          for (let page = 0; page < MAX_PAGES; page++) {
            const r = await stripe.balanceTransactions.list({
              limit: 100, created: { gte: Math.floor(gte / 1000), lte: Math.floor(lte / 1000) },
              expand: ['data.source'], ...(after ? { starting_after: after } : {}),
            });
            const d = r.data || [];
            out.push(...d);
            if (!r.has_more || !d.length) break;
            after = d[d.length - 1].id;
            /* RAN OUT OF PAGES. Caching what we have would freeze an understated
               month in place for ever, because a closed month is never re-read. */
            if (page === MAX_PAGES - 1) truncated = true;
          }
          return out;
        })(),
        /* THE SESSION WINDOW REACHES FURTHER BACK THAN THE TRANSACTIONS.
           A refund lands in the month it settles, but the CHARGE it refunds may be
           months older — and a refund's own object carries no `kind` or `artist`.
           So the payment intents we can recognise have to cover the older charges
           too, or a refund of the founder's own gig money is booked as a loss
           against the company. Four months back is well past Stripe's own dispute
           window and costs a page or two on a full refresh of one account. */
        pullSessions(stripe, gte - 120 * 86400e3, lte).catch(() => []),
      ]);
    } catch (e) {
      return { books: shape(cache, want), mine: shape({ months: cache.mine, at: cache.at }, want),
               error: 'Stripe wouldn’t answer just now' };
    }

    /* Which payment intents MySet sold on this artist's behalf. Untagged sessions
       predate the `artist` field and belong to the founder — the same convention
       confirm.mjs, webhook.mjs and revenue.mjs already use, so all four agree. */
    const ours = new Set();
    for (const s0 of sessions) {
      const md = s0.metadata || {};
      if (!APP_KINDS.has(md.kind)) continue;
      if ((md.artist || DEFAULT_ARTIST) !== aid) continue;
      const pi = piOf(s0.payment_intent);
      if (pi) ours.add(pi);
    }

    const freshBooks = {}, freshMine = {};
    for (const k of missing) { freshBooks[k] = emptyMonth(); freshMine[k] = emptyMonth(); }
    for (const bt of rows) {
      const k = monthKey(Number(bt.created) * 1000);
      if (!freshBooks[k]) continue;
      const src = bt.source && typeof bt.source === 'object' ? bt.source : null;
      const md = (src && src.metadata) || {};
      const tagged = APP_KINDS.has(md.kind) && (md.artist || DEFAULT_ARTIST) === aid;
      const byPi = !!(src && ours.has(piOf(src.payment_intent)));
      foldTx(tagged || byPi ? freshMine[k] : freshBooks[k], bt);
    }

    /* A truncated pull is returned but never written: better to recompute a slow
       month every time than to remember a wrong one for ever. */
    if (!truncated) await casDoc(PLATFORM_LEDGER, () => ({ v: 1, months: {}, mine: {}, at: 0 }), (d) => {
      d.months ||= {}; d.mine ||= {};
      for (const [k, v] of Object.entries(freshBooks)) d.months[k] = v;
      for (const [k, v] of Object.entries(freshMine)) d.mine[k] = v;
      for (const field of ['months', 'mine']) {
        const keys = Object.keys(d[field]).sort();
        if (keys.length > 60) for (const k of keys.slice(0, keys.length - 60)) delete d[field][k];
      }
      d.at = now;
      return true;
    }).catch(() => {});
    for (const [k, v] of Object.entries(freshBooks)) cache.months[k] = v;
    for (const [k, v] of Object.entries(freshMine)) cache.mine[k] = v;
    cache.at = now;
  }
  return { books: shape(cache, want), mine: shape({ months: cache.mine, at: cache.at }, want) };
}

/* ---------- what Stripe cannot know: what it costs to run ---------- */
/* Netlify, Resend, the domain. Recorded by hand because there is no honest way to
   read them — and a P&L with revenue in it and no costs is not a P&L, it is a
   number that makes you feel good. One document, founder-only, and every figure
   carries who typed it and when. */
export const emptyCosts = () => ({ v: 1, by: {}, at: 0 });
export async function readCosts() {
  const { data } = await readDoc(COSTS, null);
  const d = { ...emptyCosts(), ...(data || {}) };
  d.by = d.by && typeof d.by === 'object' ? d.by : {};
  return d;
}
export const COST_KINDS = ['hosting', 'email', 'domain', 'software', 'contractor', 'other'];
export async function setCost(month, kind, cents, note) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ''))) return { ok: false, error: 'Which month?' };
  if (!COST_KINDS.includes(kind)) return { ok: false, error: 'Unknown kind of cost' };
  const n = Math.max(0, Math.round(Number(cents) || 0));
  await casDoc(COSTS, emptyCosts, (d) => {
    d.by ||= {};
    const row = (d.by[month] ||= {});
    if (!n) delete row[kind];
    else row[kind] = { cents: n, note: String(note || '').slice(0, 80), at: Date.now() };
    if (!Object.keys(row).length) delete d.by[month];
    d.at = Date.now();
    return true;
  });
  return { ok: true };
}

/** MySet's own P&L: what Stripe paid in, minus what Perry typed in. */
export async function books(stripe, opts, { months = 12, now = Date.now(), force = false, since = 0 } = {}) {
  const [split, costs] = await Promise.all([
    platformSplit(DEFAULT_ARTIST, stripe, { months, now, force, since }),
    readCosts(),
  ]);
  const st = split.books;
  const rows = st.months.map((m) => {
    const c = costs.by[m.month] || {};
    const spend = Object.values(c).reduce((s, x) => s + (Number(x.cents) || 0), 0);
    /* `net` is already after Stripe's own fee — it is what actually landed in the
       balance — so subtracting stripeFee again here would double-count it. That is
       the single easiest mistake to make in this whole file. */
    return { ...m, costs: c, spend, profit: m.net - spend };
  });
  const total = rows.reduce((a, r) => ({
    gross: a.gross + r.gross, net: a.net + r.net, spend: a.spend + r.spend, profit: a.profit + r.profit,
  }), { gross: 0, net: 0, spend: 0, profit: 0 });
  return { ...st, months: rows, total: { ...st.total, ...total }, costsAt: costs.at };
}

/* ---------- the file somebody can hand to an accountant ---------- */
const cell = (v) => {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function toCsv(st, { who = '', kind = 'statement' } = {}) {
  const money = (c) => (Number(c) || 0) / 100;
  const head = kind === 'books'
    ? ['Month', 'Currency', 'Revenue', 'Stripe fees', 'Net received', 'Refunds', 'Costs', 'Profit', 'Transactions']
    : ['Month', 'Currency', 'Gross taken', 'Stripe fees', 'MySet fee', 'Net to you', 'Refunds', 'Paid out', 'Transactions'];
  const rows = st.months.map((m) => (kind === 'books'
    ? [m.month, m.currency || st.currency, money(m.gross), money(m.stripeFee), money(m.net), money(m.refunds), money(m.spend), money(m.profit), m.count]
    : [m.month, m.currency || st.currency, money(m.gross), money(m.stripeFee), money(m.platformFee), money(m.net), money(m.refunds), money(m.payouts), m.count]));
  return [
    `# MySet ${kind === 'books' ? 'books' : 'earnings statement'}${who ? ' — ' + who : ''}`,
    `# generated ${new Date().toISOString().slice(0, 10)} · every figure comes from Stripe's balance transactions`,
    `# amounts are in ${st.currency}, and "Net to you" is after both fees`,
    head.map(cell).join(','),
    ...rows.map((r) => r.map(cell).join(',')),
  ].join('\n') + '\n';
}
