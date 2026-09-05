# The books — how MySet tracks money, and what it deliberately does not

Written 2026-09-05, answering Perry: *"i meant getting a proper ACCOUNTING system in
place — tracking all the financials, for artists & venues, as well as for me and the
myset bank account (i guess stripe's dashboard is probably more than enough... but if
not, please do some deep thinking about the best way to structure one)."*

---

## The short answer

**Half right, and the half that is wrong is the expensive half.**

Stripe *is* enough to hold the transactions, and `INVARIANT 5d` already says it is
the source of truth for money. Building a second ledger that re-derives what a charge
was would be a machine for disagreeing with Stripe, and the day the two disagree is
the day neither can be trusted. So nothing built here re-derives anything.

What Stripe is **not** enough for is the two questions a business actually asks.

### 1. "What did I earn this month?"

Perry's money arrives in two unrelated places and Stripe never adds them up:

- **Subscriptions** are ordinary charges on the **platform** account.
- **Connect fees** are `application_fee` entries, which the dashboard's revenue
  charts do not total for you.
- And **half of each fee is given back** by the fee split (`_feesplit.mjs`) as an
  `application_fee_refund`.

Nowhere in Stripe is there one number that says what MySet made. There is now.

### 2. "What did I earn, for my tax return?"

An artist's money lives on **their** connected account, one direct charge at a time.
Stripe's own export is a transaction list, not a statement. A musician needs a year,
by month, gross and net, as a file they can hand to somebody. Venues had even less —
a list of orders and nothing else.

---

## What was built

A **reporting layer**, `netlify/functions/_ledger.mjs`. Not a ledger.

Every figure comes from Stripe's **balance transactions** — the one list Stripe
itself reconciles to the bank — and is only *bucketed*, never recomputed. If Stripe
says the fee was 47¢, this says 47¢, and there is no code path that can produce a
different number.

### Why balance transactions and not checkout sessions

`revenue.mjs` and `_history.mjs` both read checkout sessions, because they answer
*"did this specific person get what they paid for"*. Sessions are the wrong shape for
books: they do not know Stripe's fee, they do not know the application fee, they do
not include refunds, disputes or payouts, and **they do not exist at all for a
subscription renewal**. The balance transaction knows all of it, in the settlement
currency, and it is what an accountant would ask for.

### The same payment, read from both sides

A $10 vote pack on an artist's connected account produces **one** `charge` entry
whose `fee_details` hold *both* `stripe_fee` and `application_fee`:

```
artist's statement:   gross 1000 | stripe 59 | myset 20 | net 921
```

The platform account sees the same night completely differently — nothing at all for
the charge (it never touched Perry's balance), one `application_fee` entry, and, when
the split gives half of Stripe's fee back, an `application_fee_refund` for a negative
amount:

```
myset's books:        +20  (application_fee)
                      -15  (application_fee_refund — the split)
                      = 5  net platform revenue
```

Both are counted as platform revenue, so **the split nets off automatically** rather
than being a correction somebody has to remember.

### The trap, which is the same one `_feesplit.mjs` documents

`bt.fee` is *everything* deducted from an entry. On a direct charge that silently
includes MySet's own cut — so reporting it as "Stripe's fee" overstates Stripe and
hides us. The fee always comes from `fee_details`, and `test/books.mjs` pins it.

### One Stripe account, two businesses (2026-09-05)

Perry's own vote packs and tips were taken on the **platform** account, before
Connect existed — so the same balance holds his gig takings *and* every artist's
subscription. It is separable, and exactly: a payment MySet sold on his behalf is a
charge whose Checkout session was tagged `kind` ∈ {votes, tip, merch} and `artist`,
the same test `revenue.mjs` has always used.

`platformSplit()` does one pull of balance transactions with their source expanded
and buckets each into **his gigs** or **the company**. Three details that are not
optional:

- Every charge from now on also carries that label on
  `payment_intent_data.metadata`, so nothing has to join back through the sessions
  list. What must never be sent is `application_fee_amount: 0` — Stripe treats a
  zero fee differently from no fee.
- **The session window reaches four months further back than the transaction
  window.** A refund lands in the month it settles but the charge may be months
  older, and a refund object carries no `kind` of its own — without the wider window
  a refund of Perry's own gig money is booked as a loss against the company.
- The company's books live in their own document (`ledger_platform`), never in
  `ledger_<founder>`. That key is a CONNECTED account's statement, and the day Perry
  links a Stripe account of his own the two would have overwritten each other under
  two incompatible meanings.

### A payout is not an expense

Money moving to a bank account does not un-earn it. Payouts are reported on their own
line so the statement can also answer *"and how much of it actually reached the
bank"*. Getting this backwards would show an artist who had just been paid out as
having earned nothing.

---

## The monthly close (and why it is cheap)

A month that has ended cannot change in any way that matters — a dispute months later
is rare and lands in the month it *settles*, which is correct accounting. So a closed
month is computed once and cached for ever in `ledger_<owner>`; **only the current
month is ever recomputed.** A year's statement therefore costs one Stripe page rather
than twelve, and the cache is bounded to sixty months.

There is a "Check again" button that forces a full recompute, for the day somebody
genuinely doubts a figure.

---

## What each person sees

| Who | Where | What |
|---|---|---|
| **An artist** | Studio → Money → *Your earnings* | Twelve months: fans paid, fees, yours. Per month: payments, gross, Stripe's cut, MySet's cut, paid out. **Download as a spreadsheet.** |
| **A venue** | Venue Studio → Merch → *Your earnings* | The same, scoped to the venue's own Stripe account. Venues had nothing before. |
| **Perry only** | Studio → Money → *MySet's books* | A real P&L: came in, went out, kept. Per month, with a costs editor. **Download the books.** |

Owner-only on both surfaces, enforced on the server as well as hidden in the page
(`INVARIANT 15k`) — a statement is every figure about somebody's livelihood in one
payload, and a band mate on one of five Pro seats has no business with it.

---

## Costs: the part Stripe cannot know

A P&L with revenue in it and no costs is not a P&L, it is a number that makes you
feel good. Nothing can read Perry's Netlify bill, so costs are **recorded by hand** —
six kinds (hosting, email, domain, software, people, other), one document, founder
only, every figure carrying who typed it and when.

`profit = net − spend`. **`net` is already after Stripe's fee** — it is what actually
landed in the balance — so subtracting `stripeFee` again is the single easiest
mistake in the whole file, and `test/books.mjs` pins it explicitly.

---

## What is deliberately NOT here

- **Double-entry, journals, a chart of accounts.** Perry is one person. Building
  Xero in a blob store would be a large, slow, wrong answer.
- **Anything that writes to Stripe.** This code only ever reads.
- **A fan's device id or email.** `INVARIANT 0bu` holds here too. Fans are counted,
  never named — including in a statement.
- **Per-transaction rows.** Stripe already has a better transaction list than a
  spreadsheet, and `revenue.mjs` already shows the recent ones. The statement's job
  is the *shape of a year*, not a re-listing.

---

## The recommendation, plainly

**For now:** Stripe holds the transactions, MySet produces the statements, and Perry
types in four numbers a month. That is proportionate to a business with one employee.

**When there is revenue worth reconciling** — call it $5,000/month, or the first year
that needs a filed return — connect Stripe to a real accounting package (Xero or
QuickBooks; both have a first-party Stripe connector) and let it be the book of
record. MySet's statements stay useful because they are what artists and venues
download, which an accounting package will never do for you.

**Never:** try to make the blob store the book of record. The moment Stripe and MySet
can disagree about a number, both become worth arguing with.

---

## How to check any of it

```
node --import ./test/register.mjs test/books.mjs
```

43 assertions, including: the fee-details trap, the platform/connected scope
separation, a payout not being an expense, the monthly close only re-reading the
current month, and a band mate being refused.

*Related: `INVARIANTS.md` 5d (Stripe is the truth) · `STRIPE-CONNECT.md` ·
`ACCOUNTS.md` §8 (the exact fee split).*
