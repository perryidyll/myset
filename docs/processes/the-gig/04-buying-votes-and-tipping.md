---
tab: The gig
section: Buying votes and tipping
puzzle_section_id: 41967
sources:
  - netlify/functions/pay.mjs (kinds votes, song_votes, tip; attempt idempotency; canTakeMoney)
  - netlify/functions/_pay.mjs — redeemSession (claim ≠ delivered)
  - netlify/functions/confirm.mjs, webhook.mjs (delivery paths 1 and 2)
  - MYSET-MASTER-OVERVIEW.md §1.8, §4.1–4.3
  - INVARIANTS.md § Money (7 and its sub-rules)
  - docs/decisions/0007, 0014, 0017, 0026, 0032
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps with roles, tools, connections)
verified: code read 2026-09-12 (pay.mjs kinds and clamps; _pay.mjs claim/delivered)
---

# Buying votes and tipping

**Who:** a fan (external) with a card. **Trigger:** the *More votes* or *Tip* button, or the empty-wallet sheet. **Outcome:** a Stripe Checkout on the **artist's own** account, verified server-side, credits granted exactly once — or a tip recorded. Money never moves through MySet's account (decision 0007); MySet takes an application fee (the ladder is in overview §2.1; decisions 0017, 0026).

The existing Puzzle section *Stripe Connect Onboarding & Payments* already holds the artist's side (Express onboarding → `charges_enabled` → direct charge). This section is the fan's side of the same night and links to it.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| b01 | Can this artist take cards? | conditional | Automation | MySet server R · Fan I | Stripe | `canTakeMoney(aid, show)`: the platform key exists **and** the artist's Connect account has Stripe's own `charges_enabled`. *Started is not ready.* **no** → the dock's card buttons are hidden entirely (never a button that leads to a shrug); tips and packs are simply absent. **yes** → b02. Known gap: a key that exists but is dead still shows the buttons (P3-008, ledger risk *"Nothing detects a dead Stripe key"*). `src: _pay.mjs canTakeMoney; overview §4.2; rule 4` |
| b02 | Choose a pack or a tip | task | Person | Fan R | — | **Packs**: whichever the artist set (defaults in overview §2.1; clamped server-side to the range in §2.1). **Tip**: any whole-dollar amount within the server's range, with an optional note (≤120 chars). **Paid replay votes** (`song_votes`) buy votes attached straight to one song. `src: pay.mjs` |
| b03 | Mint the attempt id | task | Automation | MySet server R | Netlify | The page mints `attempt` **per tap**; the server hashes `myset-pay|aid|fan|kind|attempt` into a Stripe idempotency key, so a retry of the same tap reuses the same Checkout session instead of opening two. An older cached page with no attempt gets no key — never a made-up one — and the Stripe options object is passed **only when non-empty** (decision 0032; the `/api/pay` 502 of 2026-09-08). `src: pay.mjs lines ~196–225` |
| b04 | Price the line server-side | database | Automation | MySet server R | Netlify | `POST /api/pay {kind, pack|amount, attempt, fan}`: the price is **whatever the artist set — never what the client claims**. Unknown pack → 400. Tip outside range → 400 with the sentence. Metadata carries `{fan, kind, votes, pack, show, artist}` — the tag by which money is later attributed (**by tag, never by timestamp**: an early version reported $133 of somebody else's business as MySet revenue). `src: pay.mjs; overview §4.3` |
| b05 | Create the Checkout session | payment | Automation | MySet server R · Stripe webhooks I | Stripe | Direct charge on the artist's account (`stripeAccount: conn.acct`), `application_fee_amount` from the plan's ladder. Success URL **must** be a page that calls `/api/confirm` (`vote.html`, or `community.html` for merch). Live check 2026-09-08: `cs_live_` session returned after the key swap. `src: pay.mjs; decision 0007; ledger PER-007` |
| b06 | Pay on Stripe's page | payment | Person | Fan R | Stripe | Stripe-hosted Checkout. MySet never sees a card number. `src: overview §4.2` |
| b07 | Deliver, path 1 — the buyer returns | payment | Automation | MySet server R · Fan I | Netlify | The success URL lands on the voting page, which calls `/api/confirm` with the session id → `redeemSession`. `src: confirm.mjs; overview §4.3 (1)` |
| b08 | Deliver, path 2 — the webhook | payment | Automation | Stripe webhooks R · MySet server R | Stripe | `checkout.session.completed` → `webhook.mjs` → the same `redeemSession`. Independent of the buyer's phone; a retry racing the return page is fine because the redeem is replay-safe. Billing checkouts (plans) and Featured shows take their own paths here, not the vote redeem. `src: webhook.mjs; overview §4.3 (2)` |
| b09 | Deliver, path 3 — the reconcile sweep | payment | Person | Artist R · MySet server R | Netlify | Studio → Money → **reconcile**: walks the artist's Stripe sessions and redeems any that are claimed-but-undelivered or never seen. The safety net when the buyer never returns and the webhook never arrives. `src: admin.mjs; overview §3.3 Money, §4.3 (3)` |
| b10 | Claim the session | database | Automation | MySet server R | Netlify | Inside `redeemSession`: the session id is written into `meta.paid[sid]` **before** anything is granted, so a double-tap or a webhook race cannot grant twice. The marker records `{kind, amount, granted, fan, at}` and is **undelivered** until the votes land. `src: _pay.mjs; INVARIANT 7` |
| b11 | Grant the credits | database | Automation | MySet server R · Fan I | Netlify | `votes` → `me.extra += granted` on the fan record, re-read after writing. `song_votes` → `grantPaidSongVotes` puts them straight on the song. `tip` → recorded in `meta.tips` with the note; nothing to grant. **Only now** is the marker flipped to delivered; if that flip is lost the money stays *owed* rather than silently settled, and the sweep (b09) picks it up. The grant is per buyer per purchase, so a retry can never hand out the pack twice. `src: _pay.mjs; overview §4.3` |
| b12 | See the new balance | notification | Automation | MySet server R · Fan I | Netlify | The credits pill rises. Bought votes are a **stock**: they never refresh, free credits are always spent first, and unspent ones **carry to the next show** unless gifted at the end (→ *The fan's night* f19). `src: overview §1.8` |
| b13 | Record the money for the books | go_to | Automation | MySet server R | Stripe | → *Money → The books*: Stripe's balance transactions are the ledger of record; `charge.updated` is not yet on the webhook (PER-001), so MySet's fee share is an estimate until it is. `src: ACCOUNTING.md; ledger PER-001` |

## Connections

b01 —yes→ b02 → b03 → b04 → b05 → b06; b06 → b07 and b08 (whichever first); b07 → b10; b08 → b10; b09 → b10; b10 —new claim→ b11; b10 —already delivered→ b12 (no-op); b11 → b12; b11 → b13. b01 —no→ *no card buttons on the page*.

## What can go wrong, and what it degrades to

| Failure | The room sees | What catches it |
| --- | --- | --- |
| Dead Stripe key (2026-09-08) | Buy button that fails on tap | Nothing yet — P3-008. The key was replaced and checkout verified live |
| Buyer closes the tab after paying | Nothing until they return | The webhook (b08), then the sweep (b09) |
| Webhook down and buyer gone | Money taken, votes ungranted | The marker stays undelivered; the artist's reconcile (b09) |
| Double-tap on Buy | One session | The per-tap attempt id (b03) |
| Any of it | **Voting still works** — payments are an add-on to a free vote path | Rule 1 |
