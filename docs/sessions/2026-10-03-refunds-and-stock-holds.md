# 2026-10-03 — Refunds and chargebacks are heard; limited merch is held while the buyer pays

An overnight builder for "MySet Audit Solutions 2", on branch `fix/refunds-and-stock`, stacked on week one's `fix/money-path` (#227). **Nothing is pushed.** Both decisions are `proposed`: **the founder's answers on his desk are pending**, and each was built to the recommended card.

**Asked:** two rows of the 2 October scale audit.
- "Refunds, disputes and chargebacks are invisible" → decision 0177, INVARIANT 0iq, ledger SCL-014.
  Build *Take back what is unspent*. Write the dollar cap and the payout delay as options; do not build them.
- "Limited merch can be oversold" → decision 0178, INVARIANT 0ir, ledger SCL-015.
  Build *Hold for 30 minutes, refund if still short*.

**Built — 0177 (the first commit):**
- **The route.** `webhook.mjs` sends `charge.refunded` and `charge.dispute.*` to `_refunds.mjs` `settleLoss`. Every other branch and the signature check are unchanged. A throw answers 500 (0138).
- **The record.** The payment's marker, its tip row and its order row carry `lost` (cents no longer held), `refunded` (Stripe's running total) and `dispute`.
- **The votes.** Unspent wallet votes are taken back: a pack, or song votes that went to the wallet under 0182, which the marker now records as `wallet`. Cast votes and free votes are never touched. A won chargeback gives the votes back to the wallet.
  - The take-back receipt is `rb[sid] = [want, took, seq]`. It rides through `carryFans` beside `gr`.
  - A refund never touches `gr`.
- **Gone before delivery.** A payment that went back in full before it was ever delivered is never delivered (`settledBy: 'loss'`). A won dispute lifts that and delivers it.
- **The money figures.** These now subtract `lost`: `moneyForShow` (which also takes the charge's own `amount_refunded`), `tipsTonight`, `tippersTonight` and the register's merch count.
- **The Studios.** In both Studios, a refunded order reads *Refunded — don’t hand it over* and has no button.
- **The artist** is told once per change, on `{ tab: 'money' }`, or `{ tab: 'merch' }` for an order.

**Built — 0178 (the second commit):**
- **The expiry.** Every merch checkout expires in about 31 minutes (`checkoutExpiry`).
- **The hold.** Opening checkout holds the quantity per item and per size in `mhold_<owner>` (`holdStock`). The hold is taken after every other refusal, and the phone is stored only as a hash.
- **Letting it go.** A hold past its checkout stops counting. `checkout.session.expired` lets it go at once.
- **Paying.** The paid claim takes the stock only if the count, less every *other* live hold, covers it.
  - If it does not, the order is closed and the payment is refunded in full on the account it was paid on (`settleShort`, key `myset-short-<sid>`, MySet's fee returned on a connected account).
  - A failed refund is noted owed and thrown, so the bell makes it.
- **Telling people.** The seats that fulfil orders hear *Sold out before a payment landed*. The buyer sees *Sold out — you’ve been refunded* on the shop page or the community page, and gets one email to the session's address, which is never stored.
- **Housekeeping.** `mhold_` is in `keysFor` and `keysForVenue`, and `tools/mock.mjs` gains `?short=1`.

**Verified:**

| Check | Result |
| --- | --- |
| `node --import ./test/register.mjs test/refunds.mjs` | 91 ✓, 0 ✗ |
| `node --import ./test/register.mjs test/stockholds.mjs` | 69 ✓, 0 ✗ |
| 0177 knock-outs (unspent cap, closed-dispute guard, tombstone, never-lower refund, `seq` guard, `rb` through `carryFans`, `tipsTonight`, `moneyForShow` ×2, webhook route) | each red, restored, `cmp`-checked |
| 0178 knock-outs (no hold, no expiry, holds count nothing, own hold counted, holds never expire, re-tap blocked, no short check, no owed retry, short marker delivered, short order open, expired event ignored, paid checkout keeps hold) | each red, restored, `cmp`-checked |
| Both Studios' order rows, rendered in a sandbox (refunded, part-refunded, disputed, short, ordinary) | the words and buttons as intended |
| The shop's sold-out return, headless Chrome, 375 px, light and dark, `tools/mock.mjs ?short=1` | reads; no sideways scroll |
| `sh test/run.sh` | exit 0 — 5,501 ✓ lines, 0 ✗, 74 suites; last lines `✓ and every one names who hears it` / `33 passed, 0 failed` |

**Not checked:**
- **Stripe:**
  - any real Stripe event of these kinds;
  - the webhook destinations (nothing is subscribed yet; see the steps below);
  - Stripe accepting `expires_at` at 31–32 minutes;
  - a real refund with `refund_application_fee`;
  - real dispute payloads for `prevented` and `charge_refunded`.
- **Telling people:** the buyer's email (mail is off in tests); a real phone hearing the alerts.
- **In a browser:** the community page's sold-out card; the venue shop.
- **Production data:** none read or written.

**What the founder must do for any of this to run:**
- Pick the two desk answers.
- Add these events to BOTH webhook destinations (*Your account* and *Connected accounts*):
  - `charge.refunded`
  - `charge.dispute.created`
  - `charge.dispute.closed`
  - `charge.dispute.funds_withdrawn`
  - `checkout.session.expired`

**Choices made where the founder did not say:**
- **Partial refunds.** A part refund takes back its share of the pack, rounded *up*.
- **A bank's question** (an inquiry, `warning_*`) takes nothing until it becomes a chargeback, because Stripe has withdrawn nothing.
- **A won chargeback** gives the votes back to the fan's wallet, never onto a board.
- **Refunded before delivery.** A payment gone in full before delivery is never delivered. A part refund before delivery delivers first, then takes its share.
- **Refunded orders.** A merch order refunded in full is closed. A part refund or a chargeback leaves it standing. Stock is not put back on a refund: the artist corrects the count.
- **What counts as short.** Only the count decides. An item marked *Sold out* by hand after the checkout opened is not refunded automatically.
- **The expiry** is the next whole minute plus 31 minutes, not exactly 30, so Stripe's floor is never missed.
- **Holds** run until five minutes after their checkout's expiry. A phone's re-tap on the same item and size replaces its own earlier hold.
- **A store failure.** A hold that cannot be written never refuses a sale; the refund at payment is the backstop.
- **On a connected account**, the short refund returns MySet's fee too. The artist still loses Stripe's own fee.
- **Telling the buyer.** The short buyer is emailed at the address on the Stripe session (used once, not stored).

**For another session:**
- **New blob key** `mhold_<owner>`. Its FAMILIES line for phase two (#218):
  `[/^mhold_/, 'skip', 'merch held while a buyer pays: half an hour of state, rebuilt by the next checkout (0178)']`
- **`revenue.mjs`** (owned elsewhere tonight) still lists a refunded payment at full price. The contract is in 0177: subtract `meta.paid[s.id].lost` from each payment and from the totals, and carry `lost`, `refunded` and `dispute` on the row.
- **The shop's read (`community.mjs`)** does not subtract held stock. The contract is in 0178: subtract `heldOn(...)` per counted item and size.
- **Other money readers** — `_evlog.mjs`, `_metrics.mjs`, the warehouse export and the venue tip list — still read rows at face value. The rows now carry `lost`.
- **The ledger.** SCL-014 and SCL-015 sit at the end of *Current requested batch*, because this branch has no P3-017 row to follow. Move them on rebase.
