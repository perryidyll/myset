---
id: 0119
title: MySet publishes terms of use at /terms, written from the code
date: 2026-09-29
status: decided
decided_by: perry
area: trust
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/structure.mjs]
files: [public/terms.html, netlify.toml, public/index.html, public/about.html, public/privacy.html, public/studio.js, public/venue-studio.js, public/sample.js]
---

## The question

The privacy notice went live on 2026-09-29 (decision 0118). MySet still had no terms of use: nothing said who the seller is when a fan pays, what is final, what an artist answers for, or what law applies. No sign-up screen asked anyone to agree to anything. `HARDENING.md` listed terms as open.

The founder asked: "yes, write the terms page too".

## The options

| Option | What it does | What it costs | Risk if it goes wrong |
|---|---|---|---|
| **A — chosen** | Plain-language terms at `/terms`, written from an inventory of the money, account and content paths. Linked from the home, About and privacy footers. A one-line "you agree" under each create-a-page button | One static page, kept true by hand | A line goes stale when the code changes. The page's header comment says so, and names this record |
| B | A template from a generator | Nothing to write | It describes a marketplace MySet isn't: MySet as the seller, refunds MySet can't make, moderation tools that don't exist |
| C | Wait for a lawyer | Money and time | Artists keep selling on MySet with no agreement at all |

## What was chosen, and why

A. The page's factual sentences are claims about the code, checked on 2026-09-29.

**What the page says:**
- **Who the seller is.** Tips, vote packs, paid votes, request offers and merch are direct charges on the artist's or venue's own Stripe account (`pay.mjs`, `_connect.mjs`). They are the merchant of record, and MySet's fee is an application fee. The one exception is the founder's own artist page, which charges on the platform, and the page says so.
- **Votes are final** (`vote.html`). They come back only when a request is declined or a song is passed on (`_lib.mjs`). Unspent bought votes carry over, tied to the phone.
- **A request offer is a card hold.** It is captured only when the song is played and finished, and released on decline or at show end (`_requests.mjs`).
- **Refunds.** There is no refund path in the app for tips, votes or merch. Refunds are the seller's, done in their Stripe dashboard, which is what the Studio already tells artists. MySet passes on a fan's request if the artist can't be reached.
- **Plans.** Billed monthly through Stripe. An upgrade is immediate and prorated. A cancellation keeps the paid month, with no part-month refund. A downgrade never deletes anything, and merch leaves the page. Deleting the account cancels the plan at once (`_billing.mjs`, `pay.mjs`).
- **Content.** Content stays its maker's, with a licence to MySet to host it and show it. The page sets content rules. Artists on a paid plan can hide posts; venues can hide posts on any plan (`admin.mjs`, `venueadmin.mjs`). Lyrics are shown as unofficial, from LRCLIB (INVARIANT 9f).
- **Sample pages.** Only the subject may claim one, and a claim makes it a free account.
- **Leaving.** Deletion comes with 30 days to undo (`DELETE_GRACE_MS`).
- **Stripe.** The Connected Account Agreement paragraph is the wording Stripe requires of a Connect platform.

**What it deliberately leaves out:**
- **No prices or percentages.** They live in `_plan.mjs` and `_venues.mjs`, and the Studio shows them before anyone pays. A number typed here would go stale.
- **No card-statement wording.** The ledger and the dashboard disagree on it.
- **No DMCA safe-harbour claim.** No designated agent is registered, so copyright complaints go to hello@myset.vip.

**Promises and rights, not code:**
- **Promises.** A price change is announced in the Studio before it applies. An account is told why before it is closed, where reasonable.
- **Rights.** MySet may remove content and suspend or close accounts. It has no in-app tool for either yet; that would be done by hand.
- **Age.** 13 or older to use MySet, and contract age to sell. No code checks age.
- **Law.** Tennessee law and Tennessee courts.

**Agreement.** A line under "Create my page" in both Studios and under "Claim my page" on a sample page says that creating a page means agreeing to the terms and the privacy notice. There is no checkbox, so nothing new blocks sign-up. Accounts made before today are told nothing yet. The page's Changes section promises a Studio notice for changes that matter, and today's is the first version.

## What this makes harder

- **A second place to update.** A change to who the seller is, how refunds, holds, plans or cancellation work, or what deletion does must now change `public/terms.html` in the same pull request.
- **Contradictions found while writing it.** The inventory turned up places where pages and docs disagree with the code. They are not fixed here:
  - the Studio's request switch says fans "pay in votes, not money";
  - About says everyone is paid out daily, but Hobbyist is weekly;
  - the overview says any plan can hide posts;
  - the free plan's show count is written three ways;
  - `VERIFYING-A-VENUE.md` says any one of three checks, but the code needs all three;
  - the merch process sheet says "no stock counts" and "Postage".

## What would reverse it

A lawyer's terms replacing these. The inventory in this record is the checklist for whether they are true of MySet.

## How it was verified

- **The inventory.** It was read out of the server code with file and line citations.
- **The suite.** It passed, 4,627 tests, including test/structure.mjs's check that every top-level route is a reserved slug. `terms` has been reserved in both slug lists from the start.
- **The page on `tools/localhost.mjs`.** At 375 px there is no sideways scroll. `/terms` serves the page, and the home footer links `/about /privacy /terms`.
