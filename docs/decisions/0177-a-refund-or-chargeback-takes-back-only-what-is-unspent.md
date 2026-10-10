---
id: 0177
title: A refund or a chargeback comes off what MySet counts, and takes back only the votes the fan has not spent
date: 2026-10-03
status: proposed
decided_by: agent-recommended
area: money
reverses:
superseded_by:
invariants: [0iq, 0ia, 0hm]
commits: [623f6ce]
tests: [test/refunds.mjs]
files: [netlify/functions/_refunds.mjs, netlify/functions/webhook.mjs, netlify/functions/_pay.mjs, netlify/functions/_lib.mjs, netlify/functions/_history.mjs, netlify/functions/_register.mjs, public/studio.js, public/venue-studio.js, test/stripe-fake.mjs]
---

**The founder has not answered.** His desk offers three answers for "refunds, disputes and chargebacks": *Take back what is unspent* (recommended), *Take back everything*, *Record it only*. This builds the recommended one, overnight, without his word. It is `proposed` until he picks; the other two are written out below so either can replace it.

## The question

The scale audit of 2 October 2026 (row "Refunds, disputes and chargebacks are invisible"): no handler existed for a refund or a dispute. A Checkout Session stays `paid` for ever, so after a refund or a chargeback:

- the fan kept every vote the pack bought;
- the night's money (`moneyForShow`), tonight's tips on the board (`tipsTonight`) and the tipper priority in the queue (`tippersTonight`) still counted the dollars;
- a merch order refunded from the Stripe dashboard still sat in the Studio with its pickup code and a *Handed over* button;
- nobody was told.

Tips go up to $500 and paid plans pay out daily (decision 0044), so the first stolen card lands its loss on the platform. The audit's fix: handle dispute and refund events; add a dollar cap per artist per hour and a payout delay for new accounts.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: take back what is unspent** | Mark the payment and its row; take back the fan's unspent wallet votes; give them back if the bank decides for the artist; tell the artist once | One session lookup on Stripe, one show read, three small writes per event | `_refunds.mjs`; `lost` on markers and rows; `rb` receipts on fan records | A reader that sums money and does not subtract `lost` over-counts (the ones that matter are fixed and tested; `revenue.mjs` is not, see below) |
| B — take back everything | A, plus pull the fan's cast paid votes off the board | A's costs, plus a board write | Rewriting cast votes and their rows in the night's event log | Vote finality (decision 0001, "a vote is spent when it is cast") is broken for the first time: the board jumps mid-song; a vote already collected by a song that played cannot be taken back anyway |
| C — record it only | Mark the payment and the night's money; take no votes | Smallest | `lost` on markers and rows | A stolen card keeps every unspent vote it bought |
| D — do nothing | — | — | — | The audit's finding stands: losses invisible, money over-counted, refunded orders handed over |

The audit's other two fixes are **not built** — they are the founder's call, written here as options:

| Option | What it would do | What it needs | The trade |
|---|---|---|---|
| E — a dollar cap per artist per hour | `pay.mjs` refuses a checkout once an artist's card takings in the last hour pass a figure | A counter per owner beside `paylim_<owner>` (decision 0111's shape), summed at checkout, and a figure the founder picks | Bounds what one stolen card can push through one artist in an hour; a real big night could meet it, so the figure must sit above the best real night |
| F — a payout delay for new accounts | New Express accounts pay out on a delay (Stripe's `settings.payouts.schedule.delay_days`) until they have history | One field at account creation (`_connect.mjs`, owned by another session tonight) and a rule for when it lifts | A chargeback found inside the delay comes out of a balance that is still there; the cost is the "near-instant reward loop" decision 0044 chose daily payouts for |

## What was chosen, and why

A, because it is the founder's recommended answer and because it changes nothing that was already true about a vote: a cast vote stays where the fan put it, a free vote is never touched, and only money MySet no longer holds is taken off its figures.

- **What went back is recorded where the money is recorded.** The payment's marker (`meta.paid[sid]`) gets `refunded` (Stripe's running total), `dispute` (`{ id, status, cents }`) and `lost` — the cents no longer held: the refunds, plus a chargeback that is open or lost. A won chargeback, a bank's question (`warning_*`, which withdraws nothing), `prevented` and `charge_refunded` hold nothing. The tip row and the order row carry the same `lost`, so every reader of a row needs nothing else. New tip rows carry their session id; an older row is matched by fan, time and amount.
- **Only the wallet gives votes back, and only what is unspent.** A pack, or paid song votes that went to the wallet because the room could no longer give them (0182 — the marker now says `wallet: true`). The share is the payment's share that went back, rounded up — money returned is a vote returned, never half of one left behind — and never more than `unspentPaid` (the pack less the paid votes already cast). Song votes that went straight onto a song are cast votes: the money is marked, nothing moves.
- **A won chargeback gives back what it took**, to the wallet, never onto a board: the bank said the payment stands, so the fan paid for them. A lost one keeps them taken.
- **A payment gone in full before it was ever delivered is never delivered.** Its marker is written settled with nothing granted (`settledBy: 'loss'`), so the return page, the bell and the Studio's sweep all answer "already" — no votes for money that is gone, no merch order to hand over, no stock taken. If a won chargeback later says the money stands after all, the marker is lifted and the payment delivered. A part refund before delivery delivers first and then takes its share.
- **A refunded order is closed.** Refunded in full: `refunded`, `status: 'done'`, off the *to do* count, and both Studios show *Refunded — don’t hand it over* with no hand-over button. A part refund or a chargeback leaves the order standing and says so on the row.
- **The receipts.** `gr` is never touched by a refund — it must keep refusing a second grant (0ia). The take-back has its own receipt on the fan record, `rb[sid] = [want, took, seq]`, written in the same write as `extra`, carried by `carryFans` beside `gr`, newest forty kept.
- **Stripe's retries and races.** Every figure folded in is Stripe's running total, so an event delivered twice changes nothing and an older event arriving late lowers nothing. A decided dispute is never re-opened by a late *created*. `seq` on the marker goes up each time what is owed changes, and a fan step older than the one the receipt (or the marker's mirror, `back`) holds moves nothing — two events landing in the wrong order cannot undo the newer one.
- **2xx only when it is durable.** Nothing in the path catches and falls through: a throw reaches `guard()`, which answers 500, and Stripe sends the event again (0138, INVARIANT 0hm). The signature check and every other branch of the webhook are untouched.
- **The account.** The session is found by the payment intent on the account the event happened on (`event.account`), the same scope rule as 0183.
- **The artist hears it once** per change (`told` on the marker): the seats that see Money (`{ tab: 'money' }`), or the seats that fulfil orders for merch (`{ tab: 'merch' }`; every venue seat). Time-boxed 1.5 s and never thrown. Nothing about the buyer is in it (0bu).
- **The night's money.** `moneyForShow` takes off the larger of the charge's own `amount_refunded` (on the expansion it already asks for the fee — Stripe's figure, INVARIANT 5d, even when no event ever arrived) and the marker's `lost` (which also knows a chargeback). A payment gone in full is not counted at all; its Stripe fee still is, because it was still paid. The block gains `lost: { amount, count }`.
- **The books** (`_ledger.mjs`) needed nothing: they read balance transactions, which already carry refunds and dispute adjustments (ACCOUNTING.md).

**Stripe events to add to BOTH webhook destinations** (*Your account* and *Connected accounts*), without which none of this runs: `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`, `charge.dispute.funds_withdrawn` (the last is how a bank's question turning into a chargeback arrives). `charge.dispute.updated` and `charge.dispute.funds_reinstated` are handled if added and needed by nothing.

## What this makes harder

- **`revenue.mjs` (the Money tab's payment list) is not changed** — another session owns it tonight. It still lists a refunded payment at its full price and counts it in `totals`. The contract it needs: for each paid session `s`, read `meta.paid[s.id].lost` (cents, absent = 0) — `amount` becomes `(s.amount_total − lost) / 100`, the totals sum that, and the row carries `lost`, `refunded` and `dispute` (the status string) so the Studio can say *Refunded* or *Disputed*. `meta` is already read there.
- Every reader that sums money from the payments document must subtract `lost`. Fixed and tested: `moneyForShow`, `tipsTonight`, `tippersTonight`, the register's merch count. Still read at face value: the night's event log (`_evlog.mjs` `moneyEvents`), current show stats (`_metrics.mjs`), the warehouse export, the venue Studio's tip list. The rows carry `lost` for when they are next touched.
- `votes.paid` on a night still counts a part-refunded pack's votes in full.
- Stripe's $15 dispute fee is not in the night's money; the books carry it.
- A fan record deleted at a show start loses its `rb`; the marker's mirror (`back`) is what a later step falls back on.

## What would reverse it

- The founder picks **Record it only**: drop step 3 of `settleLoss` (the fan step). Everything else stays.
- The founder picks **Take back everything**: a larger change to vote finality; its own decision, not an edit of this one.
- One document per payment with its own state (0180's option C) would hold `lost`, the dispute and the take-back in one place instead of the marker plus a receipt.

## How it was verified

- `node --import ./test/register.mjs test/refunds.mjs`: 91 ✓, 0 ✗ — the rules on one payment; a full refund takes back exactly the six unspent of a ten-vote pack with seven cast (three free), the cast votes and `used`/`freeUsed` untouched, the grant receipt kept, a second delivery and a later redeem changing nothing; a part refund rounds up and an older event lowers nothing; a chargeback takes, a win gives back to the wallet, a late *created* re-opens nothing, a loss keeps them taken; a bank's question takes nothing until it becomes a chargeback; ballot song votes stay and wallet song votes come back; gone in full before delivery is never delivered (votes or merch), and a won dispute delivers it; tonight's tips, the tipper set and the night's money (including a refund only the charge knew of); a refunded order closed and off the count, a part-refunded one standing; a subscription refund, a released hold and an unknown payment left alone; a write failure answering 500 and the retry landing once; the receipt riding through `carryFans`; a connected account's event found on that account, the artist's phone hearing it once per change; the alert's words.
- Knock-outs, each red then restored: no unspent cap (7 ✗); no closed-dispute guard (4 ✗); no tombstone (2 ✗); refunds lowered by an older event (4 ✗); no seq guard on the fan (1 ✗); `carryFans` dropping `rb` (✗); `tipsTonight` ignoring `lost` (1 ✗); `moneyForShow` ignoring what went back (4 ✗) or the charge's own refund (1 ✗); the webhook not routing the events (✗).
- `sh test/run.sh`: exit 0 (see the session note for the tail).

**Not checked:** a real Stripe event of any of these kinds, in test or live mode; the webhook destinations' subscriptions (nothing is subscribed yet); Stripe's real dispute payload for `prevented` and `charge_refunded`; a released request hold really arriving as `charge.refunded` with `captured: false`; a real phone hearing the alert; the Studio's order row in a real browser.
