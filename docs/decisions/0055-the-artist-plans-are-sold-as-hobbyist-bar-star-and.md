---
id: 0055
title: The artist plans are sold as Hobbyist, Bar Star and Rock Star
date: 2026-09-12
status: decided
decided_by: perry
area: plans
reverses:
superseded_by:
invariants: []
commits: []
tests: [copy.mjs, limits.mjs, community.mjs, tenancy.mjs, verification.mjs, billing.mjs]
files: [netlify/functions/_plan.mjs, netlify/functions/_billing.mjs, netlify/functions/admin.mjs, netlify/functions/auth.mjs, public/studio.html, tools/overview.mjs]
---

## The question

The founder renamed the artist ladder on 2026-09-12: what was sold as Free / Plus / Pro is now sold as **Hobbyist / Bar Star / Rock Star**, with a maxed-out **Super Star** named as the rung above Rock Star for later. The names are the product — "Bar Star" tells a pub player what the $10 plan is for in a way "Plus" never did. What had to be decided is how far the rename goes: the plan is a word in the Studio, a refusal string on the server, a label in the generated overview, a Stripe product on the Checkout page, and an id in every stored artist record, every Stripe lookup key, `RANK`, and every `PLAN.plan === 'pro'` comparison in the codebase and the tests. Two other things share a word with the old names and must not move: the per-person vote allowance is still "free votes", and the venue ladder is still Free / Pro (`_venues.mjs`, `venue-studio.html`) — venues were not renamed.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Change only what a person reads: `label` in `PLANS`, the Studio's plan cards, the server's refusal strings, the Stripe product display names, the overview's column headings. The ids `free` / `plus` / `pro` stay everywhere | Two vocabularies in the code — `pro` in a comparison, "Rock Star" in the string next to it | none | a string that names the old plan is missed and a refusal says "Plus" to someone who bought "Bar Star" |
| B | Rename the ids too: `hobbyist` / `barstar` / `rockstar` in storage, lookup keys, RANK, every comparison | A migration of every artist record on the live store, new Stripe prices under new lookup keys with the old ones retired, and every id comparison in the code and the tests rewritten | a migration, a second set of Stripe prices | a record that misses the migration reads as an unknown plan and falls to free mid-gig; a subscriber whose price carries the old lookup key is synced to the wrong tier |
| C — do nothing | Keep Free / Plus / Pro | — | — | the founder's rename stays unmet |

## What was chosen, and why

A, because the founder said so and because the ids are load-bearing in four places that a rename would have to touch at once: the `plan` field on every artist record in the store, the Stripe `lookup_key` on each price (`myset_plus_monthly`, `myset_pro_monthly` — the key `planFromPriceKey` walks to turn a subscription back into a tier), the `RANK` order that decides what is an upgrade and what is a downgrade, and every `plan === 'free'` gate in the server and the tests. An id is a name nobody reads; changing it buys nothing a person can see and puts a live datastore through a migration for a word. So `PLANS.free.label` is `'Hobbyist'`, `PLANS.plus.label` is `'Bar Star'`, `PLANS.pro.label` is `'Rock Star'`, and the keys next to them do not move — a three-line comment above `PLANS` now says exactly that.

What a person reads, and where it now comes from:

- **The Studio plan cards** — `TIER_COPY` in `public/studio.html` (its own copy, changed in the same batch).
- **A refusal from the server** — `admin.mjs`: separate setlists, merch, deleting a post for good and setting your own prices are "a Bar Star feature"; the tick "is on the Bar Star and Rock Star plans". `auth.mjs`: "Your plan allows one sign-in. Rock Star allows five."
- **The generated overview** — `tools/overview.mjs` renders the artist ladder's column headings from `p.free.label` / `p.plus.label` / `p.pro.label` and the "coming soon on every plan including …" line from `p.pro.label`, so the document follows `_plan.mjs` and there is no literal to forget.
- **Stripe Checkout** — the product display names in `TIERS` are now `MySet Bar Star` and `MySet Rock Star` (`MySet Pro for venues` stays). **Read the caveat.**

**The Stripe caveat, from the code.** `ensurePrice` in `_billing.mjs` finds a price by `stripe.prices.list({ lookup_keys: [t.key] })` and only when nothing comes back does it `stripe.products.create({ name: t.name })`. A product is therefore created once, on the first checkout for that tier, and never renamed by the app. So for any tier whose price already exists in the live Stripe account (every tier that has had one checkout started since billing opened on 2026-09-04), the product is still called `MySet Plus` or `MySet Pro` and keeps saying so on the Checkout page, the Customer Portal and every invoice until somebody renames it **in the Stripe dashboard** (Products → the product → its name; the lookup key and price do not change). That is the founder's to-do — whether either product exists yet was not checked from here, only read from the code — and the app must not start doing it either: a rename on every cold start is a Stripe write on the money path for a display string. The venue product is unchanged and needs nothing.

Not renamed on purpose: "free votes" (a fan's per-night allowance, nothing to do with the plan), "free shows this month" in the cap refusal (the shows are free; that is the point of the sentence), and the venue ladder.

## What this makes harder

Reading the code now means holding two words for one plan: `pro` in the gate and "Rock Star" in the string beside it. A test that asserts an id (`r.plan === 'plus'`) and a test that asserts a label (`/Bar Star feature/`) sit in the same file and look alike; the rule is that a label assertion follows the label and an id assertion never moves. The `RANK` order (free < plus < pro) no longer reads as an order from the labels alone — "Hobbyist < Bar Star < Rock Star" is a story, not an alphabet — so an upgrade/downgrade decision has to be read from `RANK`, not guessed from the name. And "Super Star" is now a promised word: when it arrives it needs a fourth id (`RANK`, `TIERS`, a lookup key, a Stripe product) and it must not be added before the thing it sells exists — the same rule `NOT_BUILT` enforces for features.

## What would reverse it

The founder choosing other words — the change is five strings and two labels, and this record is the list of where they live. A move to rename the ids too would need a migration the live store has never had; the reversal condition for *that* is a second product (the venue ladder, a Super Star tier) whose ids collide with these, which is not on the horizon.

## How it was verified

`node --import ./test/register.mjs test/syntax.mjs` — `syntax OK`. `node test/structure.mjs` — `structure OK`. `node --import ./test/register.mjs test/billing.mjs` — `88 passed, 0 failed` (a Plus checkout still finds its price by `TIERS.artist.plus.key`, a second artist reuses it, Plus → Pro and Pro → Free still move by id). `node --import ./test/register.mjs test/limits.mjs` — `84 passed, 0 failed` (the setlist refusal now matches `/Bar Star feature/i`; `admin.mjs` names merch as a Bar Star feature). `test/community.mjs` `152 passed`, `test/tenancy.mjs` `80 passed`, `test/verification.mjs` `62 passed` — each with one label assertion moved to the new word, none with an id assertion touched. `node test/copy.mjs` — `41 passed, 1 failed` while the Studio still said `pro:{name:'Pro'`: line 78 now pins `pro:{name:'Rock Star'`, and it was the only red line until the Studio's own rename (a separate change in the same batch) landed, after which `42 passed, 0 failed`. Then `sh test/run.sh` end to end: exit 0, every suite `0 failed`. `node tools/overview.mjs --check` reports the overview stale, and rendering it produced the headings `| | Hobbyist | Bar Star | Rock Star |` — the regenerated file was not kept here, since the batch regenerates it once at the end. **Not checked:** the live Stripe account's product names — read from the code, not from the dashboard.
