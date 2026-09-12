---
tab: Money
section: The books and the monthly close
puzzle_section_id: 41976
sources:
  - netlify/functions/_ledger.mjs (statement, platformSplit, books, foldTx, LEDGER, PLATFORM_LEDGER, COSTS), admin.mjs (ledger, ledgerCsv, books, bookCost)
  - ACCOUNTING.md (read in full)
  - MYSET-MASTER-OVERVIEW.md §4.5
  - INVARIANTS.md 5d (Stripe is the truth), 15k (owner-only statements), 0bu
  - test/books.mjs
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps)
verified: code read 2026-09-12 (admin.mjs ledger/books branches; _ledger.mjs statement caching)
---

# The books and the monthly close

**Who:** the artist or venue reading their earnings; the founder reading MySet's P&L. **Trigger:** Studio → Money → *Your earnings* / *MySet's books* (venues: Venue Studio → Merch → *Your earnings*). **Outcome:** a statement — twelve months, gross / fees / net, downloadable — produced from **Stripe's balance transactions**, never recomputed.

The founder's question (2026-09-05): *do I need a proper accounting system?* The answer built: **Stripe holds the transactions; MySet produces the statements; the founder types in a few cost numbers a month.** A second ledger that re-derives what a charge was is a machine for disagreeing with Stripe. `_ledger.mjs` is a reporting layer, not a ledger; it only ever reads.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| k01 | Is the caller the owner? | conditional | Automation | MySet server R | Netlify | Statements are owner-only **on the server** (INVARIANT 15k), not merely hidden — a statement is every figure about somebody's livelihood in one payload, and a band mate on a Pro seat has no business with it. `src: ACCOUNTING.md § What each person sees` |
| k02 | Pull balance transactions | database | Automation | MySet server R | Stripe | The one list Stripe reconciles to the bank. Sessions are the wrong shape for books: no Stripe fee, no application fee, no refunds, disputes or payouts, and none at all for a subscription renewal. Scoped to the owner's **connected** account (`stripeFor`); the platform's books use the bare client — never `stripeFor(founder)`, which would report an artist's takings as the company's if he ever connected an account. `src: ACCOUNTING.md; admin.mjs books comment` |
| k03 | Bucket, never recompute | task | Automation | MySet server R | Netlify | `foldTx` puts each entry in gross / Stripe's fee / MySet's fee / refunds / payouts / net. If Stripe says the fee was 47¢, this says 47¢. **Stripe's fee comes from `fee_details`, never `bt.fee`** — on a direct charge `bt.fee` also contains MySet's cut. **A payout is not an expense**: money moving to a bank does not un-earn it; payouts get their own line so the statement can also answer *how much reached the bank*. Both pinned by `test/books.mjs`. `src: _ledger.mjs foldTx; ACCOUNTING.md` |
| k04 | Close finished months once | database | Automation | MySet server R | Netlify | A month that has ended cannot change in any way that matters (a later dispute lands in the month it *settles*). Closed months are computed once and cached for ever in `ledger_<owner>`; **only the current month is ever recomputed**, so a year costs one Stripe page. Cache bounded to sixty months. A pull that ran out of pages is used but never cached. *Check again* forces a full recompute. `src: _ledger.mjs statement 187–225` |
| k05 | Start from the month they joined | task | Automation | MySet server R | Netlify | Never further back than `createdAt` — twelve rows of zero before an account existed is not a statement, it is a page that looks like a bad year. The company's books are **not** clamped this way: MySet's revenue is older than any artist record. `src: admin.mjs ledger, books` |
| k06 | Separate the founder's gigs from the company | conditional | Automation | MySet server R · Founder I | Stripe | The founder's vote packs and tips were taken on the **platform** account before Connect existed, beside every artist's subscription. `platformSplit()` buckets each balance transaction into *his gigs* or *the company* by the `kind` and `artist` tags `pay.mjs` writes on every payment intent — by tag, never by timestamp. The session window reaches four months further back than the transaction window, because a refund carries no `kind` and may settle months after its charge. His half lives in `ledger_<founder>`; the company's in `ledger_platform` — never the same key, which would collide the day he connects an account of his own. `src: ACCOUNTING.md § One Stripe account, two businesses; _ledger.mjs platformSplit` |
| k07 | Read the same night from both sides | notification | Automation | MySet server R · Artist I · Founder I | Netlify | Artist: one `charge` with both fees in `fee_details`. Platform: nothing for the charge, one `application_fee`, and an `application_fee_refund` where the split gave half back — both platform revenue, so the split nets off automatically. → *How a payment divides* d09. `src: ACCOUNTING.md` |
| k08 | Type in the costs | form | Person | Founder R | Netlify | Nothing can read the Netlify bill, so costs are recorded by hand: six kinds (hosting, email, domain, software, people, other), one document (`costs`), founder only, every figure carrying who typed it and when. `profit = net − spend`, and **net is already after Stripe's fee** — subtracting `stripeFee` again is the single easiest mistake in the file, pinned by a test. `src: admin.mjs bookCost; ACCOUNTING.md § Costs` |
| k09 | Download the statement | document | Person | Artist R | Netlify | `ledgerCsv` → `myset-earnings-<id>.csv`: per month payments, gross, Stripe's cut, MySet's cut, paid out — a file a musician can hand to somebody for a tax return. Venues: the same, scoped to their account. Founder: `myset-books.csv`, a real P&L (came in, went out, kept). `no-store`. `src: admin.mjs ledgerCsv, books csv` |
| k10 | Reconcile a night's money | task | Person | Artist R · MySet server R | Stripe | Studio → Money → every payment plus the **reconcile** sweep (`revenue.mjs` GET lists what Stripe actually charged, flags anything ungranted; POST redeems it — the third delivery path). Paged and date-bounded, scoped to the artist's own account: an unscoped `list()` once made the Money tab read $0.00 with real money in Stripe. `src: revenue.mjs; INVARIANT 5c` |
| k11 | Move to a real package when it is worth it | research | Person | Founder R | — | **Not built, by design.** No double-entry, no journals, no chart of accounts, no per-transaction rows, nothing that writes to Stripe, no fan ids in a statement (INVARIANT 0bu). When there is revenue worth reconciling (the threshold and reasoning are in ACCOUNTING.md) connect Stripe to Xero or QuickBooks and let it be the book of record; MySet's statements stay what artists and venues download. **Never** make the blob store the book of record. `src: ACCOUNTING.md § The recommendation` |

## Connections

k01 —owner→ k02 → k03 → k04 → k05; k02 —founder, platform→ k06 → k03; k03 → k07; k08 → k09 (founder's P&L); k05 → k09; k10 is a sibling on the Money tab; k11 is the standing decision.

## How to check any of it

```bash
node --import ./test/register.mjs test/books.mjs
```

The fee-details trap, platform/connected scope separation, a payout not being an expense, the monthly close only re-reading the current month, and a band mate being refused. `src: ACCOUNTING.md`
