**todo.today is live, real, and unusually well-designed.** Everything below is from the rendered mobile PWA (375×812), its DOM/CSS, and its public REST feed `GET https://todo.today/api/todo-today/v1/events?channel={city}&event_date={today|tomorrow|YYYY-MM-DD}`. No fallback to RA/DICE was needed. Observed at 02:15 Mon 31 Aug 2026, Asia/Bangkok, cities: Koh Phangan (106 events today), Phuket (2), Ubud, Bangkok. Scale: 12 cities across Thailand/Indonesia/India, 273+ events "today", ~2,200 creators (their About page claim, unverified).

---

## 1. Event card anatomy

There are **five distinct card types**, not one. That is the single most important thing to steal.

**A. List card** (the workhorse — 90% of the feed). Left: 88px square thumbnail with a heart/save button overlaid bottom-left. Right column, in strict top-to-bottom order:

| Slot | Example | Weight |
|---|---|---|
| Datetime meta + recurrence badge | `Today · 6:00 AM – 6:45 AM` ⟳`Multi-Dates` | small, grey, **first** |
| Title (`h3`) | `5:55am Meditation, Movement & Sound Healing w/ Govinda` | **biggest, boldest, 2-line clamp** |
| Creator (person icon) | `Hexagon 🕉️` | small grey |
| Venue (pin icon) | `HEXAGON` | small grey |
| Price + join-method pill | `Donation · Booking Advised` | outlined chip, bottom |
| Optional label badge above datetime | `NEW & TRENDING` | coloured, all-caps |
| Chevron `›` right edge | | affordance only |

Raw fields per event from the API: `id, name, short_name, creator_name, slug, image, link, share_link, display_date, retreat_date_label, start_time, end_time, duration, venue, area, venue_type, google_map, label{text,color,font_color}, join_label, price_label, ticket_type, join_method, status, liked, category_id, type_id, recurring_label, recurring_tooltip`.

**Time is above the title, not below it.** In a "what's on tonight" feed the user scans time first, and the design commits to that.

**Deliberately omitted from the card:** category (there is a `category_id` but no genre chip on the card), description, attendee/going count, distance, ticket-availability, end-time on hero cards, any social proof. The card is 6 lines and stops.

**B. Hero card** (`Today's Top Picks`, horizontal scroll, ~330px tall): full-bleed image, dark gradient, coloured label badge top-left, heart top-right, then title / `Today · 9:00 AM` (**start only, no end**) / pin + venue. **No price.** Six of these, all also repeated in their daypart sections (verified: 6/6 duplicated).

**C. Daily Specials card** (standing venue offerings): price+join chip first, then title, then `9:00 AM - 12:00 PM`, then venue. **No "Today ·" prefix** — deliberately de-dated because it's an always-on offering.

**D. Retreat card**: `RETREAT` badge (`#4800ff`), `Sep 1 – 4 · 4 days`, title, area. Full form in API: `Oct 19 · 11:00 AM – Nov 22 · 7:00 PM · 35 days`.

**E. Happening-now card** (in source, not observable at 02:15): pulsing red 8px dot on the section header, red `Live` pill on the card, and `until 9:00 PM` instead of a start time.

Two nice touches: titles get `w/ {host}` appended **in the feed only** — the detail page title is bare `Tai Chi - Qi Gong Class`. And every instance has a short share link (`todo.today/0tpe8` → the dated instance URL).

---

## 2. Date grouping

**Two-level grouping: day, then daypart — and dayparts are named, not clock ranges.**

Day bar (sticky, top-left, largest type on screen): **`Today`** with secondary `Aug 31 · 106 events` and a chevron. Tapping opens a 7-row listbox, each row `{label} / {sub_label} / {count}`:

```
Today      Mon, Aug 31   106
Tomorrow   Tue, Sep 1     82
Wednesday  Wed, Sep 2     71
Thursday   Thu, Sep 3     78
Friday     Fri, Sep 4     76
Saturday   Sat, Sep 5     49
Sunday     Sun, Sep 6     46
```

**Exactly 7 days. Today / Tomorrow / then bare weekday names — never "Next Wednesday", never a calendar grid.** Every row carries a count, so you can see a dead day before committing to it.

Within a day, sections in order (section keys verified in the API):

`today_highlight` ⭐ Today's Top Picks → `up_next` ⚡ → `daypart_299` 🥱 Early Morning → `daypart_17` ☕ Morning Vibes → `daypart_384` 😎 Noon & Chill → `daypart_385` 🌤️ Afternoon Groove → `daypart_29` 🌅 Sunset Moments → `daypart_383` 🌇 Evening Energy → `daypart_46` 🌃 Nightlife Highlights → `experiences` 🔁 Daily Specials → `retreats` 🏕️ Upcoming Retreats → `channels_to_follow` 📡

Dayparts are a **curator-assigned taxonomy term (`type_id`), not derived from the clock** — observed ranges overlap (Nightlife Highlights spans 5:30 PM–9:00 PM start times while Sunset Moments spans 5:00–6:00 PM). A 2 PM beach party sits in "Afternoon Groove" even though it runs to 11 PM. Each section pages at 10 with `Load more (18 more)`.

**How "today" decays as it progresses** — this is the clever bit:
- `up_next` holds the **next 4 chronologically upcoming events and removes them from their daypart sections** (verified: 0/4 overlap; highlights by contrast are 6/6 duplicated). At 02:15 it held 6:00 / 7:00 / 7:30 / 7:45 AM, and "Early Morning" was consequently absent from today while present on Sep 5.
- `happening_now` appears above Up Next with the pulsing dot, cards showing `Live` + `until {end}`.
- Past dayparts drop out entirely rather than greying out. On the detail page, past/cancelled events get `.tt-single-notice--past` (muted grey notice) and the datetime is rendered **line-through**.

End of feed is a real designed card, not whitespace:
> **That's everything for Today** / Tomorrow has 82 events waiting / **[ Continue to Tomorrow → ]**

On day 7: **"Planning further ahead?"** / "Sunday, Sep 6 is the horizon of the daily feed" / **[Browse Events]** → `/search/`.

**Hard midnight boundary, and it costs them.** An 8 PM–2 AM party is filed under its start date (`Today · 8:00 PM – 2:00 AM`). At 02:15 on Aug 31 there was no `happening_now` section at all, despite parties on the island genuinely running — because the feed is keyed to the *selected date's* events only, and last night's belong to Aug 30. For a gig app this is the exact failure mode you cannot ship.

---

## 3. Location selection

**City lives in the URL path** (`/koh-phangan/`, `/ubud/`, `/phuket/`) and the page title is per-city (`Koh Phangan Events, Workshops, Parties & Things To Do | Todo.Today`).

- **No browser geolocation at all** — I grepped every first-party bundle for `navigator.geolocation` / `getCurrentPosition`: zero hits.
- **First visit is resolved server-side by IP at the Cloudflare edge.** `GET https://todo.today/` from my Thai-IP browser returns an HTTP redirect (opaqueredirect, `cf-ray: …-BKK`) straight to `/koh-phangan/`. The same URL fetched from a US IP returns a country/city **directory** instead ("273+ Events Today", countries → cities with counts). So: known region → dropped straight into the city with zero friction; unknown region → pick from a list. No modal, no permission prompt, no empty state.
- **No city cookie or localStorage entry** (only `_ga`). The path *is* the state.

Picker UI: the header city name `Koh Phangan, Thailand ⌄` and a slider icon both open a **"Preferences"** sheet with a single tab, **Location** (a second "Vibes" tab is commented out in the HTML — unshipped). Countries are collapsible headers: `Thailand — 7 locations · 178 events today`. Each city row is `🏝️ Koh Phangan — 106 today — Check In →` with a radio. **The live count sits next to every city before you choose it** — you never travel to a dead city by accident. No search box, no "near me", no distance, no multi-city.

**Thin city (Phuket, 2 events) — verified live, and the degradation is excellent:**
- Category chip row **shrinks to only the categories that actually have events today**: `All · 🤝 Social · 🌃 Parties` (Koh Phangan shows 15). Filters adapt to inventory.
- Every empty section is **omitted entirely** — no Top Picks, no Morning Vibes, no Daily Specials, no Retreats. Just `Up Next` (1) and `🌇 Evening Energy` (1).
- Missing images render as a light-grey block with a faint logo watermark; the heart button stays.
- Ends with `That's everything for Today / Tomorrow has 2 events waiting / Continue to Tomorrow`.

**Truly empty day** (couldn't force one — no 0-count day existed in any city's 7-day window; copy verified in source): title `No events for {Day}`, sub `{NextDay} has 3 events waiting` or `{NextDay} has no events`, button `Continue to {NextDay} →`. Ultimate fallback `No events found.` **There is no dead end anywhere in the product** — every empty state hands you the next populated day.

---

## 4. Time display

- Local 12-hour with meridiem: `9:00 AM`, `6:30 PM`. Ranges use an en-dash: `Today · 6:30 PM – 9:15 PM`. Midnight is worded: `Today · 5:30 PM – Midnight`.
- Always prefixed with the day word — `Today · 9:00 AM`, `Tomorrow · 9:00 AM` — so a card is unambiguous when it appears in "You May Also Like" or on a creator page.
- **No timezone is ever shown or offered.** Everything is venue-local, implied by the city. Correct for a single-city feed; a trap the moment you have touring artists.
- **No doors-vs-set-time distinction.** One `start_time`, one `end_time`. `join_label` (`Drop-in`, `Walk-in`, `RSVP Required`, `Booking Advised`, `Online Tickets`) carries the entry semantics instead.
- `duration` exists in the API (`45m`, `1h30`, `2h45`, `9h`) but is **not rendered** anywhere I found.
- **No relative labels.** Nothing says "starts in 2 hours" or "in 20 min". The only now-aware string in the entire codebase is `until {end_time}` on a Live card. Recency is expressed *structurally* — by the `Up Next` section and the pulsing dot — not typographically. Given how fast relative labels go stale on a cached PWA, I read this as a deliberate and correct call.
- Recurrence tooltips use human date phrasing: `Every monday & wednesday · Until 30 Sep 2026`, `Multiple specific dates · Until 1 Sep 2026`, `Repeats every day · Until 8 Sep 2026`.

---

## 5. Filtering

Three tiers, and the prominence ordering is the lesson.

**Tier 1 — always visible, zero taps: category chips.** A horizontally-scrolling emoji chip rail pinned under the day bar, `All` active by default: 🧘 Wellness · 💃 Dance · 🏋️ Sports · 🔮 Conscious · 🎨 Arts · 🤝 Social · 🎶 Music · 🍽️ Food · 🎉 Special Events · ❤️ Relationships · 👨‍👩‍👧‍👦 Kids · 📚 Learning · ✨ Other · 🌃 Parties · 💼 Business. Single-select. Chips use `short_name` (`Dance`, not `Dance & Movement`). **Only categories with events on the selected day are rendered.**

**Tier 2 — one tap behind the funnel icon: `Filter Events` sheet.** Exactly two groups, both multi-select chips:
- **Price** — `Free` / `Donation` / `Paid` (API `ticket_type` also has `free, paid, donation, min_order, not_available`)
- **Area** — the 11 neighbourhoods of the island: Srithanu, Thong Sala, Chaloklum, Haad Yao, Baan Tai, Coconut Lane, Haad Salad, Haad Chao Phao, Hin Kong, Wok Tum, Maduea Wan

Sheet has `Clear all` in the header (hidden until a filter is set) and a sticky `Apply Filters`. Active count surfaces on the day bar.

**Tier 3 — separate page: `/search/`.** One input, `Search events, channels, places, tags...`, plus `Browse categories`. City-scoped.

**Notably absent: no time-of-day filter, no venue filter, no "free tonight" shortcut, no sort control.** Time-of-day is handled by section headers instead of a filter — you scroll to "Sunset Moments" rather than filtering to 5–7 PM. That is a genuinely good substitution and it's why the filter sheet can stay two fields deep.

---

## 6. Recurring events

**Materialised as separate dated instances, presented as a series.** This is the model MySet should copy outright.

- Every instance is a first-class row with **its own permanent URL**: `/koh-phangan/2026/08/31/tai-chi-qi-gong-class`, `…/2026/09/01/…`. Great for SEO, sharing, and per-night state.
- In the feed each instance shows **only itself** — one row, one date. The series is signalled by a small ⟳ badge next to the datetime with three labels only: **`Daily`**, **`Weekly`**, **`Multi-Dates`**. The full pattern is in `data-tooltip`: `Every monday, wednesday & friday · Until 30 Sep 2026`.
- **No collapsing, no "+4 more dates" expander in the list.** A weekly class simply does not appear on days it doesn't run.
- On the **detail page** the series is stated as a line under the date: `Monday, Aug 31 at 9:00 AM - 10:30 AM` / `Every Mon, Tue, Wed, Thu, Fri, Sat +29`, with an `All Events +29` link on the host block.
- Hexagon's creator page: `1,113 events` lifetime, `Upcoming 19 events` — instances, chronological, `Load more (14 more)` in pages of 5.
- Standing offerings that recur but aren't really "events" (massage slots, private sessions, jewellery workshops) are split into a **separate `Daily Specials` section** and stripped of their date prefix. Smart taxonomy: a thing available every day is not a thing happening tonight.

---

## 7. Artist side (partial — gated)

`Stream`, `Submit`, `My Events`, `You` in the bottom tab bar **all redirect to `/join/` when logged out**, so I could not verify the artist gig calendar. **Unverified.** What is observable:

- Auth offers **WhatsApp, Email, Google, Facebook** (WhatsApp first — right call for this audience), then `Confirm it's you` OTP → `Finish signing up` (first/last name, country, email) → **`Your Vibes` preference step, with `Skip for now`**.
- `Create an event` → `/my-events/?event_form=1`; `Manage your events` → `/my-events/`.
- The **public** artist surface is the **Creator Channel** at `/c/{slug}/`: cover gradient, avatar, name, `22 followers`, `1,113 events`, `+ Follow`, a 3-line bio (`📍 @hexagonphangan / 🌿 vegan cafe and meditation center / 🕰️ open from 12:30 - 21:00`), then **`Upcoming` + count** as one flat chronological list of the same list cards, then `You may also like — Discover more creators and venues`. Page title is city-scoped: *"Hexagon 🕉️ Events in Koh Phangan"*.
- **The artist-facing page is a flat upcoming list, not a calendar.** No month grid, no week view, no past events, no analytics visible publicly.

---

## 7. What makes it feel good

**Copy these five:**

1. **Named dayparts instead of a time filter.** ☕ Morning Vibes / 😎 Noon & Chill / 🌤️ Afternoon Groove / 🌅 Sunset Moments / 🌇 Evening Energy / 🌃 Nightlife Highlights. It turns a 106-row list into six browsable moods, removes an entire filter control, and gives the feed a voice. For MySet: `Doors Open` / `Prime Time` / `Late Set` / `After Hours`. Make it a curator-assigned field like they did, not a clock derivation — a headliner at 11 PM is "Prime Time", not "Late".

2. **`Up Next` that *moves* events rather than duplicating them.** The next 4 upcoming events are lifted out of their daypart sections entirely (verified 0/4 overlap) while `Top Picks` duplicates (6/6). So the top of the feed is always live and never makes you scroll past things you've missed, and there's no double-reading. The feed self-heals through the day with no user action.

3. **Counts on every navigational affordance.** `Tomorrow 82` in the day picker, `Koh Phangan 106 today` next to each city, `Load more (18 more)`, `Tomorrow has 82 events waiting`. You never tap into an empty room. This is cheap to build and it is most of why the thing feels alive.

4. **Time above title, and a card that stops at six lines.** Datetime → title → host → venue → price/entry chip → done. No description, no going-count, no distance, no category. For MySet: `Tonight · 9:00 PM` / **Artist** / venue / `£12 · Tickets`.

5. **Every empty state is a doorway.** `That's everything for Today → Continue to Tomorrow`, `No events for Thursday → Friday has 5 events waiting`, and at the 7-day edge `Planning further ahead? Sunday, Sep 6 is the horizon of the daily feed → Browse Events`. Zero dead ends in the entire product. Plus: category chips render only for categories that have events *that day*, so filters can never produce a null result.

**Do NOT copy these three:**

1. **The hard-midnight day boundary.** At 02:15 the feed showed "Today, Aug 31" starting at 6:00 AM, with no `happening_now` section, while island nightlife was in full swing — last night's events belong to Aug 30 and have vanished. For a gig app this is fatal. **Roll the day over at ~5 AM local**, and make `happening_now` query a time window (`start ≤ now ≤ end`) across the date boundary rather than filtering to a single calendar date.

2. **No timezone model and no relative time.** Fine for one island; broken for a touring artist and for anyone browsing another city before they fly. Store UTC + venue IANA zone from day one and render venue-local with an explicit tz badge whenever the viewer's zone differs. (Their *avoidance of relative labels* is right and worth keeping — "starts in 2h" goes stale in a cached PWA. Signal urgency structurally, via the Live dot and Up Next.)

3. **Everything artist-side behind a wall, and the two-name identity problem.** `Stream`, `Submit`, `My Events`, `You` all bounce to `/join/` — an artist cannot see what posting gets them before signing up. Publish the creator channel as the logged-out shop window. Separately, their `creator_name` and `venue` are independent free-text fields that collide constantly (creator `Hexagon 🕉️`, venue `HEXAGON`; creator `Martial Arts Academy`, venue `Martial Arts Academy`), so cards render the same string twice with two different icons. MySet has the same shape — artist vs. venue — so make them one linked entity model and suppress the duplicate line when they resolve to the same place.

**One more worth a look:** the `/c/{slug}/` short share links (`todo.today/0tpe8` resolving to the full dated instance URL) and the per-instance dated permalink scheme `/{city}/{yyyy}/{mm}/{dd}/{slug}`. That single URL decision is what lets a recurring weekly night be shared, indexed, and stated per-occurrence without a series/instance disambiguation UI anywhere in the product.