---
tab: Money
section: Featured shows
puzzle_section_id: 41975
sources:
  - netlify/functions/_featured.mjs (FEAT_PRICE, SLOTS, HOLD_MS, claimSlot, markPaid, settleFeature, freeSlots, featuredFor, dropAllFor)
  - netlify/functions/admin.mjs (featureList, featureStart, featureFinish), webhook.mjs (kind feature), events.mjs (the city feed), _flags.mjs (featuredShows)
  - MYSET-MASTER-OVERVIEW.md §3.3 Gigs, §4.6
  - IMPLEMENTATION_STATUS.md P3-010 (bidding deferred)
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps)
verified: code read 2026-09-12 (_featured.mjs header, settleFeature refund path; admin.mjs FEATURE_ACTIONS)
---

# Featured shows

**Who:** an artist promoting one of their calendar gigs; the server racing other artists for three spots. **Trigger:** *Feature* on a gig in Studio → Gigs. **Outcome:** that gig sits at the top of its city's list for that night (orange border, own heading) — or the artist's money comes back automatically, once.

The founder's spec (2026-09-05): pay a flat price to place a gig in a city's featured section; three spots per day; first come first served. Price and slot count are constants in `_featured.mjs` (surfaced in §2.1). Fixed-price only — **bidding was deferred by the founder on 2026-09-10** (P3-010) until fixed-price inventory is regularly full.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| x01 | Is the flag on? | conditional | Automation | MySet server R · Artist I | Netlify | Behind the `featuredShows` feature flag (owner-only, never written during a show). Off → no button, the endpoint refuses (so nobody can be charged), the section is not drawn — and **anything already bought keeps its record** and reappears when it is switched back on. `src: overview §4.6; _flags.mjs` |
| x02 | Pick a gig and a night | form | Person | Artist R | Netlify | `featureList`: the artist's upcoming calendar gigs with which nights in their city still have a free spot (`freeSlots`). The sheet says before payment that **a cancelled gig's spot is spent** — the feed renders a featured row only while the occurrence exists. `src: admin.mjs featureList; _featured.mjs header` |
| x03 | Take a hold on the spot | database | Automation | MySet server R | Netlify | `claimSlot` inside a compare-and-set on `feat_<citykey>` (keyed by city, reachable from `cityindex` — no `list()`): the slot is claimed **before** checkout opens under an id MySet mints, and expires by itself after `HOLD_MS` unless the payment lands. *Charge first, claim after* would owe refunds; *claim first, never expire* would let anyone fill a city's night for free by opening checkout three times. "First come" is decided by the store, not by whose request reached which instance. `src: _featured.mjs claimSlot` |
| x04 | Open the checkout | payment | Automation | MySet server R | Stripe | `featureStart`: a **platform-account** charge (this is MySet's revenue, not a direct charge) with `metadata = {kind: 'feature', key, date, artist, eventId, hold}` — **our hold id travels through Stripe and back**, so the hold is taken once and never moves. An earlier version re-claimed under Stripe's session id and opened a window in which the spot was free for anyone. `src: admin.mjs featureStart; _featured.mjs settleFeature comment` |
| x05 | Pay | payment | Person | Artist R | Stripe | Stripe-hosted. Abandoning costs nothing; the hold lapses on its own and frees the spot. `src: _featured.mjs header` |
| x06 | Settle the spot | conditional | Automation | MySet server R · Stripe webhooks R | Stripe | `settleFeature` runs from the return (`featureFinish`) and from the webhook (its own path, not `redeemSession`). `markPaid(key, date, hold)`: the hold becomes a paid row on the shared city document and on `feats_<aid>` (the artist's own copy, so the Studio can list it and `deleteArtist` can clean up without walking every city). `src: _featured.mjs markPaid; webhook.mjs 103–113` |
| x07 | Hold lost or duplicate? | conditional | Automation | MySet server R · Artist I | Stripe | The payment landed after the hold died **and** the night filled (`lost`), or this artist already bought that night under another handle — three tabs open (`duplicate`). Either is money taken for a spot that will not be given → **refunded automatically, once**, with the session id as the idempotency key so a webhook retry cannot refund twice. *Telling somebody to email for a refund would be worse than the bug.* `src: _featured.mjs settleFeature` |
| x08 | Leave a tombstone | database | Automation | MySet server R | Netlify | A refunded row stays as a tombstone the other settle path refuses to grant against — otherwise the return trip could grant while the webhook refunds, and MySet has paid the money back **and** given the spot away. A tombstone is not a spot: it never counts toward the three. It lives as long as the night. `src: _featured.mjs 55–58, 160–166, 195–205` |
| x09 | Render the featured row | notification | Automation | MySet server R · Fan I | Netlify | The city feed draws featured rows first, orange, under their own heading — matched on **owner and `eventId`**, because event ids are chosen by the client and public in that very feed (a rival could otherwise stand in a paid spot); the internal owner id is stripped before the payload goes out. `src: overview §4.6; events.mjs` |
| x10 | Garbage-collect old nights | task | Automation | MySet server R | Netlify | Expired holds are dropped on read; paid rows are pruned with a delete floor **two days behind UTC** — an earlier version pruned on the calling artist's *local* date inside a *shared* city table, so an artist in Bangkok could delete a London artist's paid row for a night London had not reached. *A local date is fine for deciding what to show and never for deciding what to remove.* `src: overview §4.6; _featured.mjs readFeatured` |

## Connections

x01 —on→ x02 → x03 —claimed→ x04 → x05 → x06; x03 —no spot→ *refused before any charge*; x05 —abandoned→ *hold lapses*; x06 —ok→ x09; x06 —lost or duplicate→ x07 → x08; x09 → x10.
