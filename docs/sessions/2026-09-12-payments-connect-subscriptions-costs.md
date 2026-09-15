# 2026-09-12 — Payments: is Connect working, are subscriptions working, what does MySet cost

**What was asked.** A session "dedicated to MySet payments", in three parts: is
**Stripe Connect for artists** working (the artist's incentive is more tips, so this
ranks first), does the flow Codex wrote up in Puzzle match the code, and would anything
be tweaked; are **subscriptions** working, and what is their flow; and **every cost**
MySet has today — subscriptions and fees for every service, including whatever Google
billing the Maps feature needed. Then, as the answers came back: rename the two Stripe
products; explain the $2-a-month Connect fee; explain and fix the Customer Portal;
watch the payout fees and set a reminder; fix a Puzzle step that still said 2.5%; get
the founder to the right Stripe page for the connected-accounts destination; and, once
the secret was in Netlify, ship the code and merge.

## What was found

**Connect** (`_connect.mjs`, `admin.mjs` `pay*` actions, `studio.js` `loadPay`/`payStart`):
built, unit-tested, and **never exercised by a real artist** — zero connected accounts
in the live dashboard. Direct charges on Express accounts; the artist is the merchant of
record and MySet takes `application_fee_amount` at 25% / 10% / 2% (Hobbyist / Bar Star /
Rock Star, ids `free`/`plus`/`pro`); daily payouts set at account creation (decision
0044). Codex's Puzzle flow matched the code except one step (367264, *Fan initiates
payment*) that still cited the 2.5% of superseded decision 0017 — corrected to cite the
plan ladder.

**The structural gap.** A Stripe event destination is scoped to *Your account* **or**
*Connected accounts*, fixed at creation, and each destination signs with its own secret.
MySet's one destination (`we_1UACXQKFtJidxE16IAYdxfYN`, seven events) is *Your account*
only, and `webhook.mjs` knew one secret. So `account.updated` (payments switching on
after onboarding), `charge.updated` on an artist's account (the exact fee for the venue
split) and a fan's `checkout.session.completed` on an artist's account could never have
arrived. Nothing was lost — nobody but the founder has an account, and every live charge
is on the platform account — but the first artist to onboard would have hit it.

**Subscriptions** (`_billing.mjs`): built and tested, never used live. Products and
prices are created on first use by lookup key (`myset_plus_monthly`, `myset_pro_monthly`,
`myset_venue_pro_monthly`); Checkout in subscription mode; the Customer Portal for card
changes and invoices; sync by webhook + the return trip + a six-hour re-sync. The live
catalogue holds **no MySet product at all** (four Idyll Mastery products only), so the
asked-for rename (PER-011) had nothing to rename — the first checkout creates them as
"MySet Bar Star" / "MySet Rock Star", the names `cd8cbc7` already put in the code.
`billingPortal.sessions.create` needs a **saved live-mode default configuration**;
there was none, so *Manage billing* would have errored with no fallback.

**Costs today.** Netlify Personal $9/mo (1,000 credits; the last three weeks used
~1,700, 99% of it deploys — PER-002); Porkbun domain ~$5/yr; Resend free (3,000/mo);
Cloudflare R2 free to 10 GB; Google Maps no subscription but the project needs a billing
account with a card (10,000 free calls per SKU per month for Maps JavaScript, Static
Maps and Geocoding — whether billing is attached is the run sheet's item 14); GitHub
free; Stripe $0/mo. Stripe's per-use fees: cards 2.9% + 30¢ (+1.5% international), $15
per dispute, Billing 0.7% on subscriptions, and — the one the founder asked about —
**Express platform fees billed to MySet**: $2 per connected account in any month that
account receives a payout, plus 0.25% + 25¢ per payout. With daily payouts a gigging
artist can cost ~$5/month in payout fees, more than MySet's 2% on a Rock Star's tips.
Kept daily on purpose (decision 0044); a standing reminder to revisit is in the
founder's Todoist (due 2026-10-24) and in the agent's memory.

## What shipped

- **Decision 0058** — the webhook verifies against two signing secrets. `webhook.mjs`
  exports `webhookSecrets()` (platform first, then `STRIPE_CONNECT_WEBHOOK_SECRET`,
  trimmed, empties dropped) and `constructSigned()` (tries each; an event matching
  neither is null → `400 bad signature`). With only the platform secret set the
  behaviour is byte-for-byte the old behaviour. `test/twosecrets.mjs` (9 ✓) runs
  **without** the fake, against the real `stripe` library's signature code, because
  the fake's `constructEventAsync` ignores the secret and would have proved nothing.
  PR #19 → `7859b75`; production deploy `ready` 15:27 UTC; an unsigned POST to
  `https://myset.vip/api/webhook` answers `400 {"ok":false,"error":"no signature"}`.
- **By the founder, in the dashboards:** the *Connected accounts* destination (same
  URL, `account.updated`, `charge.updated`, `checkout.session.completed`,
  `checkout.session.async_payment_succeeded`) and `STRIPE_CONNECT_WEBHOOK_SECRET` in
  Netlify's production context — PER-008 done. The Customer Portal saved in live mode
  from the in-app browser with his go-ahead: invoices on, card updates on, cancel at end
  of period, plan switching off (the Studio owns plan changes) — PER-012 done.
- Ledger: PER-008 done, PER-011 cancelled, PER-012 done; ACCOUNTS.md §5; overview §6.3
  now lists every production variable (eleven set, read with
  `netlify env:list --context production`). Puzzle: step 367264 corrected; steps
  370264 / 370098 / 370266 → Live, 369876 (*Verify the signature*) reworded for two
  secrets, 370273 (`AUTH_FROM`) → Testing; changelog 1643 for 0058.
- Found on the way: **`AUTH_FROM` is set** (`MySet <hello@myset.vip>`) and the domain
  carries Resend's DKIM and SPF records — PER-004's "absent" was stale.
- Also found: HARDENING §1's advice that a restricted Stripe key needs only *Checkout
  Sessions: write* predates Connect and Billing — the functions now call 25 distinct
  endpoints. Noted on PER-007 and on the run sheet's item 3 so the founder does not
  create a key that breaks the first artist's onboarding.

## Verified / not checked

**Verified:** `sh test/run.sh` green with the new suite; `node test/twosecrets.mjs`
9/9; the production deploy of `7859b75` reached `ready`; the live endpoint's `400 no
signature` on an unsigned POST; the destination scope, events and Netlify variable
names read back; the Customer Portal page showing a saved live configuration;
`netlify env:get AUTH_FROM --context production`; `dig` for `resend._domainkey` and
`send.myset.vip`. **Not checked:** a real connected-account delivery (needs the first
artist to onboard — Workbench → Webhooks → the new destination → Event deliveries);
*Manage billing* opening a portal for a real subscriber (there are none); a sign-in
code arriving from `hello@myset.vip` on a phone; Resend's *Verified* tick; the Maps
billing account; whether `STRIPE_SECRET_KEY` is a restricted key.

## How it was built

In a scratchpad worktree off `origin/main` — the shared checkout carried other
sessions' uncommitted work throughout. Stripe was driven in the in-app browser
(Claude-in-Chrome was not connected); the permission classifier stopped the agent
part-way through the destination form, so the founder finished it from written steps
and copied the secret himself — no secret value passed through the chat. The
`docs/processes/` sheets that mirror the Puzzle steps flipped above (admin-and-finance
02 s05, 03 the `AUTH_FROM` row, reliability-and-security *Secrets and keys* j07,
money/02) are still uncommitted files of the Puzzle-mapping session and were left for
it; the Puzzle steps themselves are updated.
