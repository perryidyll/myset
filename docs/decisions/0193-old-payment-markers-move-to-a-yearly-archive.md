---
id: 0193
title: Old payment markers move to a yearly archive, and every claim check still finds them
date: 2026-10-03
status: decided
decided_by: claude
area: money
reverses:
superseded_by:
invariants: [1, 4, 5c, 7, 7b, 0ho, 0ia, 0ih]
commits: []
tests: [test/delivery.mjs]
files: [netlify/functions/_pay.mjs, netlify/functions/revenue.mjs, netlify/functions/autocron.mjs, netlify/functions/_metrics.mjs, netlify/functions/_warehouse.mjs, netlify/functions/_register.mjs, netlify/functions/_account.mjs, netlify/functions/_venueaccount.mjs, tools/metrics.mjs, tools/overview.mjs]
---

## The question

The 2026-10-02 scale audit (PAY-2) found that `meta_<aid>.paid` keeps one marker per
paid Checkout session for ever. Each one is about 255 bytes (the 66-character session
id plus kind, amount, granted, fan, at, song, show, delivered, deliveredAt). Every
payment rewrites the whole document twice (the claim, the delivered flip), and the
Studio's poll, the board and the delivery paths all read it whole. A bar act at a few
thousand payments a year reaches about a megabyte, and the slower write makes the
claim's compare-and-swap lose more often under load (PAY-1).

But the marker is also the thing that makes a payment redeem exactly once
(INVARIANT 7). After a show, the fan's own receipt (`gr`) is gone with their record
(`carryFans`, decision 0180), so for an old session the marker is the ONLY thing
between a late delivery attempt and a second pack (PAY-6). Removing markers is
therefore only safe if every claim check can still find them.

The founder's word (2026-10-03): keep fixing the audit's findings without waiting
for him.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Delivered markers older than `PAID_KEEP_DAYS` move to `paidarc_<aid>_<YYYY>`, written and read back before they leave meta. Every claim check reads the archive for a session older than `PAID_ARC_MARGIN_MS`. | One meta read per owner per day; one or two archive reads per old-session claim | A key family, the bell's daily pass, `archivePaid`, `archivedMarker`, `readPaidAll` | A future reader of `meta.paid` that asks "was this paid" and forgets the archive (0ih names it) |
| B | Delete delivered markers older than 130 days outright | Nothing | None | A sweep, a late webhook or the bell grants a pack a second time for any old session |
| C | One document per session, `pay_<aid>_<sid>`, written `onlyIfNew` (the audit's structural fix) | A migration of every live marker; a read per session for every reader that totals money | Many | The right end state; too big to land beside the open money PR |
| D — do nothing | — | — | — | The document grows without bound and every payment gets slower |

## What was chosen, and why

A. It removes the growth without opening a gap.

- **The order is the safety.** `archivePaid` picks delivered markers older than the
  cutoff, oldest first, at most `PAID_ARC_LIMIT` a call. It merges them into the year
  of their `at` and reads that document back; only a sid seen there byte for byte may
  leave meta, and the delete removes it only while it is still that same delivered
  marker. So a marker is in meta, in the archive or in both — never neither. A failed
  archive write moves nothing; a failed meta trim leaves the marker in both places
  and the next pass finishes it.
- **Undelivered markers never move.** A `delivered:false` marker is work still owed,
  and every delivery path looks for it in meta.
- **The claim check consults the archive, and only when it could matter.**
  `redeemSession` reads the archive only when the marker is not in meta and the
  session is older than the margin (120 days, ten inside the move, so clocks that
  disagree cannot open a gap). The claim a fan is waiting on is always younger, so
  it costs nothing extra. The years read are the session's `created` year and the
  next; the archive is keyed by the marker's `at`, which IS `created`, so both sides
  use one year rule. A failed archive read throws: no grant on a guess.
- **An old session in neither place is still owed.** Stripe retries for three days,
  the bell for three, but the Studio's sweep looks back 180 days, and a session paid
  long ago that was never claimed at all has had nothing delivered. It is granted,
  not refused; the archive lookup is the guard.
- **The Money tab** reads at most the two years its 180-day window spans, once per
  request, and none when every session is in meta or too young to have moved.
- **Lifetime readers** see both: `_metrics.mjs` takes the archives as an input
  (`tools/metrics.mjs` reads them), `_warehouse.mjs`'s packs count uses
  `readPaidAll`, and the register reads them only when it rebuilds a night older
  than the margin, so its `store` counts do not fall to nothing.
- **Where it runs:** its own step in `autocron.mjs`, after `heal`, with its own clock
  (`PAIDARC_BUDGET_MS`), a daily watermark (`paidarcAt`) and a cursor
  (`paidarcCursor`) in the schedule document — the same shape as the purge and the
  clip sweep. Not inside `heal`: heal's chunks write the schedule index once per
  chunk and walk artists only; this pass also walks venues and writes other
  documents, and folding it in would tie a payments write to the index's cursor.
  Never in front of the sweep (INVARIANT 0ho). Accounts on their way out (`del`) are
  skipped so a write cannot race their purge.
- **Keys are computable.** Every year from `PAID_FIRST_YEAR` (2026, MySet's first) to
  now — never `list()` (INVARIANT 1). The account's `createdAt` is not used as a lower
  bound: one read per year is cheap, and a back-filled `createdAt` would hide an
  archive. Deletion (`keysFor`, `keysForVenue`) names every such year, so the mirror
  copies the family (it is real money history) and a purge removes it.
  `tools/backup.py` lists the store and needed no change.

## What this makes harder

- The age is 130 days, not 90, so a dispute (Stripe allows 120 days) always finds its marker in meta where the refund and dispute handlers (0177) write. Raised before merging, when those handlers appeared.

- Anything that asks "was this session paid for and delivered" must ask both places
  (INVARIANT 0ih). A grep for `\.paid\[` is the check.
- A marker dated before 2026 never moves (no key could find it). None exist in
  production as far as the code knows; not checked against production data.
- Tips (`meta.tips`) and orders (`meta.orders`) still grow without bound. They are
  the next growth to move, per night or per month; this record does not touch them.

## What would reverse it

- One document per session (option C), which makes the archive unnecessary.

## How it was verified

`node --import ./test/register.mjs test/delivery.mjs` — new cases under "OLD MARKERS
MOVE TO THEIR YEAR": only delivered markers older than ninety days move; an
undelivered old marker, a recent one and a pre-2026 one stay; with every archive write
failing nothing leaves meta; with the meta trim failing the marker is in both places
and a replay answers `already`; a redeem of an archived session whose fan record is
gone answers `already`, grants nothing and asks Stripe nothing; an unreadable archive
throws rather than grants; an old session never claimed is granted; a fresh claim
never reads the archive; the Money tab calls an archived session redeemed and the
sweep skips it; `_metrics` counts an archived pack once; the key lists and the mirror
include the family; the bell's pass reaches the end and always moves at least one
chunk. The whole suite: `sh test/run.sh`, exit 0.

**Not checked:** against production data, and the bell's step on the live scheduler.
No production marker was inspected or moved.
