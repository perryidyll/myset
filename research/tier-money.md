# MySet packaging — the money-and-scale cut

## 1. The paid tier

**Residency — $10/mo**

> *For the musician who plays every week: no caps, every show on the record, and the numbers that tell you which nights are actually worth playing.*

Free tier is called **Open Mic**. Both names are true to the scene, and "are you on Residency?" survives being said out loud in a WhatsApp group.

---

## 2. Free vs paid

| | **Open Mic** — free forever | **Residency** — $10/mo |
|---|---|---|
| **Live crowd voting, unlimited shows** | Full. Unlimited voters, unlimited nights, free-vote settings, replay requests, pause/undo, the whole Studio | Same |
| **Tips — 100% yours** | Uncapped, straight to your Stripe. MySet takes 0% | Same, plus tip goals + on-stage tip notes |
| **Paid vote packs** | One pack, fixed at $3 / 3 votes. 100% yours | Three packs, **you set every price**, plus ⚡Boost and replay pricing |
| **Setlist size** | 50 songs | Unlimited |
| **Show history** | Last 3 shows in full detail. All-time totals stay visible forever — **nothing is ever deleted** | Every show, forever, in full |
| **Revenue analytics** | Tonight's total, and lifetime total | **Earnings by venue, by night of week, by song.** Trends, CSV export, reconcile sweep |
| **Gig calendar + city feed** | Next 3 gigs, listed publicly in the city feed like everyone else | Unlimited dates, **recurring weekly shows**, auto-posting |
| **Fan alerts** | — | Followers get a "playing tonight, here's the link" ping |
| **Artist profile** | Bio, 3 links, lyrics sing-along sheet | Unlimited links + YouTube / Spotify / Apple embeds |
| **Support** | Docs + community | Direct line, answered on gig nights |

Two things deliberately **not** capped: number of shows, and room size. Cap either and you've broken the fundamental. And the audience side is identical on both tiers — a free artist's room gets the same voting, the same lyrics, the same feed listing.

---

## 3. The one feature that does the work

**Earnings by venue.**

One screen: *Ugly Duckling — 11 shows, ฿4,180 in tips, ฿380/night average. Sunrise Bar — 6 shows, ฿890, ฿148/night.*

That is the only number in the product that changes a decision worth real money. A guy playing 6-7 nights a week is choosing between residencies on vibe and memory. This tells him which Tuesday to drop, which venue to ask for a raise, and what to say when he asks — *"I bring ฿400 a night off the floor here"* is a negotiating position. One better booking pays the subscription for three years.

It also beats the alternatives on honesty. The setlist cap makes people upgrade *resentfully*. History-unlock makes them upgrade *because they're stuck*. Venue earnings makes them upgrade because they want the answer. Only one of those survives a musician telling his friends about it.

And it's cheap for MySet to ship, because the hard part is already built: `show.log` snapshots the whole round before the tally is destroyed, `hist_index` holds the per-show archive, and money is already attributed by `metadata.show` rather than guessed by timestamp (INVARIANT 17d). What's missing is a `venue` field on the show and a group-by.

---

## 4. The upgrade moment

**Primary wall: the Money tab, after show #4.** He opens it the morning after a gig — the moment he actually cares about the money — and the older shows are greyed with a lock:

> **You've played 4 shows on MySet.**
> Every baht is still here — we don't delete anything, ever. But comparing nights is a Residency thing.
> *Which venue actually pays you?* → **See it — $10/mo**

Below it, a single blurred row he can almost read: `Ugly Duckling · 3 shows · ▓▓▓▓ avg/night`. Show him the shape of the answer, not the answer.

**Secondary wall: song #51.** *"Setlist's full at 50 — that's a proper working set. Residency lifts the cap. Or hide a song you're not playing this season."* Note the second option: he can always keep playing tonight without paying. A wall that can block a gig is not a wall, it's a bug.

**No wall ever appears during a live show.** Not on stage, not in the Live tab, not between 6pm and 2am. Selling to a man mid-set is how you lose him permanently.

---

## 5. Honest risks

**The vote-pack row is the one that will bite.** Telling an artist his crowd can only buy the $3 pack, while MySet takes 0% either way, reads as throttling his income to sell a $10 plan. It's the most defensible lever on paper (paid votes are MySet-native) and the ugliest one in a bar at 11pm. *If the test group flinches at one row, it'll be this one — the fallback is to give all three packs to Open Mic and keep only price control + Boost behind Residency.*

**The 50-song cap is fake scarcity and everyone knows it.** Storing 200 song titles costs nothing. A covers musician's library *is* his professional identity, and Perry's own set is already 66. On an island where every musician knows every other musician, "they make you delete songs" travels faster than any feature. 50 is chosen to not bite on night one and to bite in month three — but it is still the row that generates eye-rolls.

**$10 is cheap for him and thin for the business.** For a man clearing $50-150 a night it's a rounding error, which is good. But it also means the free tier is genuinely good enough to run a whole career on if you have a small set and don't care about numbers — expect single-digit conversion, not 30%. Thousands of musicians at 8% conversion is a nice side income, not a company.

**This packaging does not defend the P&L.** Songs, history and calendar are all near-zero-marginal-cost. The thing that actually costs money is every phone in the room polling — 20 people over two hours is ~24,000 function calls, which is exactly what exhausted the Netlify credits on 2026-08-31. A wildly popular free artist with 80-person rooms six nights a week is a pure loss and none of these caps touch it. Either the poll gets cheaper or a room-size trigger eventually has to exist, and it will be unpopular.

**The retention wall is one bad sentence away from feeling like hostage-taking.** The whole thing rests on *nothing is ever deleted* being literally true, including on downgrade. The moment someone loses a show, the packaging is dead.

**It's unbundleable.** He can see his tips in Stripe's own dashboard for free. What he can't see there is *per-venue* — which is precisely why that has to be the headline feature and why the `venue` field is non-optional.

**The test group can't test this.** Perry's friends will get Residency free forever, because he'll give it to them. The first honest pricing signal comes from a stranger, and he should plan for that rather than reading his mates' enthusiasm as validation.

---

## 6. What it takes to build

**The real blocker isn't the paywall — it's that MySet is a single-artist app.** One global `show` blob, one setlist, one `STRIPE_SECRET_KEY` pointing at Perry's account. Nothing can be billed until every artist has their own namespaced `show` / `hist_*` / `profile` keys and their own Stripe destination via **Connect Express** (also the only way "100% yours" stays true — today the money lands in Perry's account). That's the big lift, roughly 2-3 weeks, and it's required with or without pricing.

Once accounts exist, the packaging itself is small:

- **Entitlements — ~2 days.** A `plan` field on the artist record and a `requirePlan()` helper sitting next to `checkAdmin()` in `_lib.mjs`. Enforced server-side in `admin.mjs` (song #51), `history.mjs` (detail past show 3), `revenue.mjs` (analytics), `profile.mjs` (embeds). This has to follow INVARIANT 13's precedent — the credit check lives in `vote.mjs`, not the UI — or the caps are a `display:none` away from meaningless.
- **Billing — ~half a day.** Stripe Billing subscription + `customer.subscription.*` in the existing `webhook.mjs`. The replay-safe `redeemSession()` pattern is already there and already proven; extend it, don't parallel it (INVARIANT 5c).
- **Venue analytics — ~2 days.** Add `venue` to the show record, group `hist_index` + the `metadata.show`-attributed money by it. The expensive plumbing (round snapshots, bounded auto-paged money queries) is done.
- **CSV export — half a day.** Same data, different serializer.
- **Recurring gigs + city feed** — already in flight; the paid split is a flag on the calendar record.
- **Follower alerts — ~1 week, and the only genuinely new subsystem.** It needs a fan contact store, which is the first time MySet holds audience PII. That collides with INVARIANT 9g ("the audience never signs in") and needs its own design — opt-in per artist, no account, deletable.

**Two hard rules for whoever builds it:** downgrade is a *read gate*, never a delete — no code path may drop a `hist_*` doc. And iterate on draft deploys (0 credits) with a single production push at the end (INVARIANT 9d0); a pricing page is exactly the kind of change that tempts you into fifteen production deploys in an afternoon.

Call it **~3-4 weeks total**, of which only about a week is the packaging. The rest is the multi-artist foundation he needs anyway before a single friend can log in.