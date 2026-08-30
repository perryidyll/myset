# MySet "What's On Near Me" — design spec

Grounded in the live codebase (`~/Docs/MySet/netlify/functions/_lib.mjs`, `INVARIANTS.md`). Uses the existing flat-underscore key convention, `readDoc()` (strong get) and `casDoc()` (CAS + read-back verify). **No `list()` anywhere on any path — read or write.** Invariants 1 and 2 are satisfied by construction, not by discipline.

---

## 1. The city index

### The one idea

**One source of truth per artist. Every index is a derived cache, rebuilt from named keys, never scanned.** The thing that makes rebuilding possible without `list()` is a per-city *artist roster*: it converts "recompute this city" from a scan into a bounded fan-out of known keys.

### Keys (flat, underscore — invariant 2)

| Key | Role | Written when |
|---|---|---|
| `gigs_{artistId}` | **Source of truth.** All of one artist's future gigs. | Artist adds / edits / moves / cancels a gig. |
| `croster_{cc}_{slug}` | Set of artistIds who have *ever* had a gig in this city. Append-only. | First time an artist posts in that city. Never pruned. |
| `city_{cc}_{slug}` | **Derived city feed.** 14 nights of denormalised cards. The single strong get the audience makes. | Rebuilt on every mutation touching that city, and by the sweep. |
| `places` | **Derived global manifest.** Countries → cities. Powers both dropdowns. | Same publish transaction; debounced at scale. |
| `soon` | **Derived global next-up.** 20 soonest gigs worldwide. | Same transaction. |
| `dirty` | Repair queue: `{cityKey: firstDirtiedAt}`. | Written *first*, cleared last. |

Every audience read is `readDoc('places')` + `readDoc('city_th_koh-phangan')` — two strong gets of keys whose names are computable from the URL. Nothing else.

### Shapes

**`gigs_{artistId}`** — authoritative, small even for a busy artist:

```json
{ "schema":"gigs/1", "artistId":"perry-idyll", "seq": 41, "updatedAt": 1756600000000,
  "gigs":[
    { "gigId":"g_01J8Q…", "rev":3, "status":"scheduled",
      "startsAt":"2026-08-31T20:00:00+07:00", "endsAt":"2026-08-31T23:00:00+07:00",
      "tz":"Asia/Bangkok", "cc":"th", "citySlug":"koh-phangan",
      "venue":{"name":"Ugly Duckling Irish Pub","area":"Baan Tai","lat":9.703,"lon":100.036,"mapUrl":"…"},
      "title":null, "priceLabel":"Free entry", "ticketUrl":null, "voteUrl":"/?a=perry-idyll" } ] }
```

**`city_{cc}_{slug}`** — the read path. Denormalised, because there are no joins:

```json
{ "schema":"cityfeed/2",
  "city":{"cc":"th","slug":"koh-phangan","name":"Koh Phangan","region":"Surat Thani",
          "tz":"Asia/Bangkok","lat":9.733,"lon":100.016},
  "builtAt": 1756600000000,
  "sources": { "perry-idyll": 41 },
  "nightBoundaryHour": 5,
  "windowNights": 14,
  "partitioned": false,
  "nights": {
    "2026-08-31": { "gigs":[ { "gigId":"g_01J8Q…","artistId":"perry-idyll",
        "artist":"Perry Idyll","photo":"/img/band.jpg",
        "startsAt":"…","endsAt":"…","status":"scheduled",
        "venue":"Ugly Duckling Irish Pub","area":"Baan Tai","mapUrl":"…",
        "priceLabel":"Free entry","ticketUrl":null,"voteUrl":"/?a=perry-idyll" } ],
      "truncated": false, "total": 1 }
  } }
```

Two fields earn their keep disproportionately:

- **`sources`** is a fence. A rebuild is only written if, for every artist, its observed `seq` is `>=` the `seq` already recorded. This kills the classic out-of-order-rebuild race where a slow job overwrites a newer feed with older data. Retrofitting this after it corrupts a city is miserable — put it in on day one.
- **`windowNights: 14`** while the UI shows 7. The client slices `[tonight … tonight+6]` locally, so **day rollover requires zero writes**. A city nobody touches for a week still renders correctly at 4am Tuesday.

**`places`** — the picker's only input:

```json
{ "schema":"places/1", "builtAt": 1756600000000,
  "countries":[ { "cc":"th","name":"Thailand","cities":[
    { "slug":"koh-phangan","name":"Koh Phangan","region":"Surat Thani","tz":"Asia/Bangkok",
      "lat":9.733,"lon":100.016,
      "nextGigAt":"2026-08-31T20:00:00+07:00",
      "lastGigEndsAt":"2026-09-05T02:00:00+07:00",
      "upcoming7": 6 } ] } ] }
```

`upcoming7` is a **display hint only** — it decays as days pass with no writer. `nextGigAt` and `lastGigEndsAt` are absolute timestamps and never decay, so the client filters the dropdowns on *those*. This is what lets a manifest written on Monday still be correct on Friday with no cron running.

### The publish transaction (exact order)

Runs in `POST /api/gig`, using existing `casDoc` with read-back verify (invariants 3–4):

0. Read `gigs_{artistId}` → compute `affected = cities(old) ∪ cities(new)`. **The union is what makes *move* and *delete* correct** — the city being left must be repaired too, and it is the step everyone forgets.
1. `casDoc('dirty')` → add every key in `affected`. **Before** anything else, so a crash mid-fanout leaves durable work behind.
2. `casDoc('gigs_{artistId}')` → apply the mutation, `seq++`. This is the commit point; from here everything is recoverable.
3. For each affected city: `casDoc('croster_{cc}_{slug}')` add artistId (idempotent), then **rebuild** `city_{cc}_{slug}` from scratch — parallel `readDoc` of every artist in the roster, merge, bucket by night, sort, cap. Reject the write if any `sources[a]` would go backwards.
4. Rebuild `places` and `soon` from the touched cities' new `nextGigAt` values.
5. `casDoc('dirty')` → remove the keys that succeeded.

**Rebuild, never patch.** Patching a shared blob means one bug is permanent; rebuilding means every subsequent write heals prior corruption, including corruption you never noticed. At one artist a rebuild is one extra `readDoc`. Switch to patch-plus-nightly-rebuild only when a city's roster exceeds ~25 active artists.

**The sweep**: a scheduled function every 5 minutes reads the single key `dirty`, rebuilds anything in it, and clears it. Once daily it also walks `places` and rebuilds every city regardless — that daily pass is the backstop that means no bug in the incremental path can survive 24 hours. Both are list-free.

---

## 2. The picker

**The audience never types a place name.** Both controls are `<select>` populated from `places`. This is the highest-leverage invariant in the whole feature: free text produces "Koh Phangan", "Ko Pha Ngan" and "koh phan-ngan" as three cities within a month, and there is no search index to reconcile them with. Artists don't get free text either — gig creation resolves against a curated place list, with "request a city" going to a human. Place identity is never derived from user text.

Filter rules, applied client-side against `places`:
- Show a city only if `lastGigEndsAt > now` **and** `nextGigAt < now + 7d`.
- Show a country only if it has ≥1 qualifying city.
- Sort countries alphabetically; sort cities by `nextGigAt` ascending, not alphabetically — the city with something on tonight goes first.

### First visit, today, with one city

**Auto-resolve and render.** If there is exactly one qualifying country, select it. If that country has exactly one qualifying city, select it and render the feed immediately. A "choose your country" gate with one option in it is a UI that makes a working product look like a stub.

The structure stays — both selects visible and populated, "Show gigs" button present as the form's submit and the Enter target — but nothing is gated behind pressing it. Above the feed, a resolved-context line: **"Koh Phangan, Thailand · next 7 days · times in GMT+7"**.

When there is genuinely nothing chosen (multi-country future, or a user who cleared the selection), the page is still not blank: below the picker, render **"On tonight elsewhere"** from the `soon` blob. Zero input, zero `list()`, real content, and it doubles as your OG preview and your empty-state fallback.

Returning visitors: `localStorage['myset.place'] = "th/koh-phangan"` → land straight on the feed with a quiet "Not in Koh Phangan? Change" link. Only the genuinely-first visit ever sees a cold picker.

URLs are canonical and shareable: `/on/th/koh-phangan`. Never put the selection only in state.

### Geolocation

**Do not prompt. Not now, arguably not ever on load.**

Two tiers:

1. **IP hint (ship now, free).** Netlify's `context.geo` gives country and approximate city with no permission prompt, no dialog, no latency. Use it to *pre-highlight* — "Near you: Koh Phangan" as a suggested chip — never to auto-navigate. Koh Phangan's audience is majority travellers on foreign SIMs and VPNs; IP geo will confidently place them in Singapore or London. A hint you can ignore survives being wrong; a redirect doesn't.
2. **Precise geolocation behind an explicit "Use my location" button.** That button is the *only* thing that calls `navigator.geolocation`. Nearest city is then a client-side haversine against the `lat`/`lon` already sitting in `places` — no server, no reverse-geocoding service, no cost. Snap to the nearest city within 100 km; beyond that say "Nothing within 100 km — browse by country."

**Verdict: not worth it now, cheap to earn later.** Firing a browser permission prompt on first paint is the highest-bounce moment in the product, and with one city it buys literally nothing. But put `lat`/`lon` and `tz` on every city record from today — that costs eight bytes and makes the capability a two-hour job when you have 40 cities. Ship the button when city count > ~20 or countries > 1.

---

## 3. The empty state

The empty state should be **rare by construction** — a city with nothing in 7 days isn't in the dropdown. It's reached by deep link (`/on/th/koh-phangan` shared in a WhatsApp group), by a cancellation after the link was shared, or by an artist leaving the island. Those URLs must render sensibly forever.

Same page furniture as a populated feed — same header, same resolved-context line, same freshness stamp. Empty is not a different page.

**Show, in this order:**

1. **The plain, specific truth.** "Nothing listed in Koh Phangan for the next 7 days." Specificity is what reads as *working*; generic copy reads as *broken*.
2. **The next real gig, if there is one.** "Next up here: Thursday 18 September, Ugly Duckling Irish Pub." This is `nextGigAt` earning its place in the manifest, and it is the single line that flips the page from dead to alive. It requires no extra fetch.
3. **Other cities in this country with something on**, as chips with their next date. Zero of these today — which is exactly why (4) exists.
4. **"On elsewhere this week"** — three cards from `soon`. There is always something to look at.
5. **One action:** "Email me when something's on in Koh Phangan" → writes `sub_{sha1(email).slice(0,16)}` (a per-subscriber key, so no `list()` and no contention). A dead end becomes a demand signal that tells you which city to recruit an artist in.
6. **Freshness stamp:** "Updated 2 minutes ago" from `builtAt`. Disproportionately reassuring — it proves the pipe is live rather than the page being stale.
7. Small, last: "Play here? List your gigs on MySet."

**Explicitly do not:**

- No fake, demo, greyed-out or "example" events. Ever. One screenshot of a fabricated gig ends the product's credibility, and it *will* be screenshotted.
- No "Coming soon" with nothing behind it. If you have a date, show the date. If you don't, say nothing is listed. Implying a future you can't name is the fastest way to teach people the feed lies.
- No sad-robot illustration, no "Oops!", no exclamation marks. Understatement reads as competence.
- No auto-redirect to another city. Offer, never move them.
- Don't suppress the city from the URL space to dodge the state.

---

## 4. Date grouping

**All time reasoning happens in the city's timezone, never the viewer's.** Someone in Berlin planning a Koh Phangan trip must see "Tonight" meaning tonight *there*. State it once under the header — "times in Koh Phangan (GMT+7)" — and never again.

**The night boundary is 05:00 city-local.** A set starting 01:00 Sunday belongs to **Saturday night**. Bucketing by UTC date, or by midnight local, splits every late set away from the night it belongs to, which on a party island is most of them.

```js
nightOf(ts, tz) = localCivilDate(ts - 5h, tz)
```

Store the constant as `nightBoundaryHour: 5` **in the feed document**, not in client code, so it's tunable per deploy without shipping a release.

The window is nights `nightOf(now)` through `nightOf(now) + 6`, inclusive.

**Rail labels:**

| Offset | Label |
|---|---|
| 0, before 16:00 local | **Today** |
| 0, from 16:00 local | **Tonight** |
| 1 | **Tomorrow** |
| 2–6 | **Wednesday 3 Sep** — weekday *and* date |

"Tonight" at 11am reads wrong above a 2pm gig; the 16:00 switch fixes it with one comparison. Never "In 3 days" — people plan by weekday. Always include the date alongside the weekday: it costs nothing and makes a screenshot self-contained.

**Never render empty rails.** A day with nothing on simply isn't drawn. Seven headers with five "nothing on" underneath is precisely how six real gigs look like a broken app. One exception: if rail 0 is empty but later rails aren't, show a single quiet line — *"Nothing on tonight. Next up Wednesday."* — then the rails. "What's on tonight" is the question the product exists to answer; answer it explicitly even when the answer is no.

Show a per-day count only when a day has more than three.

**In-progress gigs.** Keep them, pinned to the top of the Tonight rail, with a pulsing dot and **"On now · until 23:00"**. Walking in mid-set at 9pm is the single most common real use of this page; dropping a gig at its start time is the worst possible behaviour.

Sort within a night: **on now → upcoming by start time → finished**. Finished gigs collapse behind a thin `Earlier tonight (2)` disclosure and vanish entirely at the 05:00 rollover. Show "Ends 23:00", not a live countdown — countdowns need a ticking timer, cause churn, and (invariant 9d) nudge you toward polling.

**Cancellations are shown, not hidden.** `status:"cancelled"` renders struck-through with a "Cancelled" tag for anything within 48 hours, then disappears. Silently vanishing a gig someone planned their evening around is worse than the cancellation.

**Clock skew:** trust the client clock, but compare it against the response `Date` header and prefer the server's if it differs by more than 10 minutes. A phone with a wrong timezone otherwise sees "Tonight" a day out.

---

## 5. Scaling 1 → thousands

### Build now (none of this gets thrown away)

- **The key namespace, with a version in the name** (`cityfeed/2`, `places/1`). Renaming keys later is the genuinely expensive migration; everything else is a rebuild.
- **Artist doc as sole source of truth; every index derived and rebuildable.** This is the entire scaling story. If any index is ever the only copy of a fact, you have lost.
- **`croster_*`** — the list()-free rebuild handle. Trivial today, structurally necessary later.
- **`dirty` + a sweep function**, even though the sweep currently has nothing to do because rebuilds run inline. Going async later becomes a one-line change instead of a re-architecture.
- **`sources` fencing stamps.** Cheap now, unfixable-after-the-fact later.
- **Canonical place ids, `tz`, `lat`, `lon` on every city** from the first record.
- **URL shapes** `/on/{cc}/{slug}` and `/g/{gigId}`. This is your share and SEO surface; it must never move.
- **`truncated` and `total` per night, and a hard cap of 50 cards per night**, enforced today when nothing will ever hit it. A client that already handles `truncated: true` needs no rewrite the night a city has 400 gigs.
- **`partitioned: false`** reserved in the schema, so the eventual day-bucket variant (`night_{cc}_{slug}_{date}`) is an additive field and not a client rewrite.
- **Denormalised card fields.** There are no joins and never will be; accept the duplication and let rebuild be the freshness mechanism.
- **Edge caching**, not polling. Serve the feed with `Netlify-CDN-Cache-Control: public, max-age=60, stale-while-revalidate=600`, purge on rebuild, revalidate on window focus. This page must never adopt an interval (invariant 9d) — a discover page that polls at 3s is a credit fire.

### Defer explicitly, with the trigger that un-defers it

| Deferred | Ship it when |
|---|---|
| Artist / venue text search | >1 country, or people start asking "where is X playing" |
| Genre / price / venue filters | median city-night > 12 gigs. With six gigs, filters are insulting |
| Map view | a city with >20 gigs a night |
| Pagination inside a night | p95 night size > 50 (the `truncated` flag is already the hook) |
| Day-bucket partitioning | city feed > 250 KB gzipped |
| Async rebuild (drain `dirty` out of band) | rebuild fan-out > 25 artist docs, or write p95 > 500 ms |
| Per-city write sharding | >5 writes/min to one city |
| Precise geolocation button | >20 cities |
| Follows, notifications beyond the one email capture | after the first city with two artists |

**Do not build at all:** audience accounts (invariant 9g — anonymous is why this works in a bar), infinite scroll, client-side cross-city aggregation, or any recommendation ranking. "Sorted by time" is correct and will stay correct at ten thousand gigs.

---

## 6. The animated logo opener

### The stance

**It is a transition, not a gate.** No full-screen curtain, no "enter" button, no overlay that owns the first 1.5 seconds. The existing three-rounded-bar equaliser mark starts large and centred, then travels up into its header slot while the picker and feed rise in beneath it. Total budget: **900 ms hard cap.**

Three rules make it safe:

1. **The end state is the default state.** The CSS is written so that with no JS, no animation support, or the class removed mid-flight, the page renders exactly as it does *after* the intro. The intro is purely additive — a class *added* by a tiny inline script. This is what structurally guarantees the animation can never delay content: there is nothing to wait for.
2. **Data fetch starts before the animation does**, on the first line of `<head>`. The animation and the network race, and the animation is the slow one. If data is late the skeleton shows through; neither ever waits for the other.
3. **`/` only.** Any deep link (`/on/th/koh-phangan`, `/g/…`) skips the intro entirely. A shared link lands on content.

### Frequency

`localStorage['myset.intro']` holds a timestamp; replay only if it's older than **12 hours**. Someone opening the app three times on a Saturday night sees it once; someone back next weekend gets the brand moment again. Also skipped when `navigator.connection?.saveData` is true.

Any `pointerdown`, `keydown` or scroll during the intro cancels it instantly and snaps to the end state — which is free, because the end state *is* the default. Never trap a user inside a brand moment.

### Gate script (inline, in `<head>`, before the stylesheet)

```html
<script>
try{
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches,
      last   = +(localStorage.getItem('myset.intro')||0),
      home   = location.pathname === '/' || location.pathname === '/index.html';
  if(!reduce && home && !navigator.connection?.saveData && Date.now()-last > 432e5){
    document.documentElement.classList.add('intro');
    localStorage.setItem('myset.intro', Date.now());
  }
}catch(e){}
</script>
```

### CSS

```css
:root{ --ease:cubic-bezier(.2,.8,.2,1) }

/* Default = post-intro. Nothing hidden, nothing display:none. */
.mark i svg rect{ transform-origin:50% 100% }

html.intro .mark{ animation:mark-settle 620ms var(--ease) both; pointer-events:none }
html.intro .mark i svg rect{
  animation:bar-rise 500ms var(--ease) both;
  animation-delay:calc(var(--i) * 70ms);         /* style="--i:0|1|2" per rect */
}
html.intro main{ animation:rise 380ms var(--ease) 300ms both }

@keyframes bar-rise  { from{ transform:scaleY(.06); opacity:.3 } to{ transform:none; opacity:1 } }
@keyframes mark-settle{ from{ transform:translateY(30vh) scale(2.4) } to{ transform:none } }
@keyframes rise      { from{ opacity:0; transform:translateY(10px) } to{ opacity:1; transform:none } }

@media (prefers-reduced-motion: reduce){
  html.intro .mark, html.intro .mark i svg rect, html.intro main{ animation:none !important }
}
```

```js
const stop = () => document.documentElement.classList.remove('intro');
addEventListener('pointerdown', stop, {once:true, passive:true});
addEventListener('keydown',     stop, {once:true});
```

### Technique notes that matter

- **`transform: scaleY` with `transform-origin: bottom`, never `height`.** Compositor-only, no layout thrash, 60fps on a five-year-old Android in a bar.
- **`animation-fill-mode: both`** so bars sit at their start state during the stagger delay — without it you get a one-frame flash of full-height bars, which is the single most common way this effect looks cheap.
- **`animation-delay: calc(var(--i) * 70ms)`** with `--i` set inline per `<rect>`. Three declarations, not three selectors.
- **`pointer-events:none` on the travelling mark** so a tap during the intro reaches the control underneath it.
- **Belt and braces on reduced motion**: the `@media` block *and* the JS check. Reduced-motion users get the finished page instantly — no fade, no substitute animation.
- **Accessibility**: `role="img"` + `<title>MySet</title>` on the SVG, `aria-hidden` on the decorative rects, nothing `display:none` or `visibility:hidden` (screen readers and crawlers see the complete DOM at frame one), focus never moved, and the country `<select>` tabbable from the first frame — a Tab press cancels the intro.
- **No library, no Lottie, no video.** ~700 bytes of CSS and ~300 of JS. The wordmark stays SVG paths, not a webfont, so the logo can never FOIT.

**One honest cost:** `main`'s 300 ms delay pushes LCP to roughly 700–800 ms on `/`. That's acceptable, and deep links (which is where inbound traffic lands) have no intro at all and clean vitals. If Core Web Vitals on `/` ever become a real number you care about, drop `main`'s delay to `0` and animate only the mark — the effect survives it.