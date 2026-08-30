# MySet — Artist Gig Calendar: Design

Grounded in the real codebase (`~/Docs/MySet`): Netlify Blobs KV via `readDoc`/`casDoc` in `/Users/perryidyll/Docs/MySet/netlify/functions/_lib.mjs`, single-artist `ARTIST_ID`, `studio.html` as one `render()` with `if(TAB===…)` blocks and `openSheet()` bottom sheets. Two existing invariants constrain this hard: **never `list()` for live data**, and **flat keys only**. Everything below assumes fixed, known keys.

---

## 1. The recurrence model

**Store one document, key `gigs`, containing a flat `items[]` where every entry — one-off or residency — has the same shape. `repeat: null` means one-off.** One code path for the renderer.

```json
{
  "v": 1,
  "tz": "Asia/Bangkok",
  "venues": {
    "duckling": { "name": "The Ugly Duckling Irish Pub", "city": "Koh Phangan, Thailand",
                  "tz": "Asia/Bangkok", "time": "20:00", "dur": 180, "pay": 2500,
                  "ccy": "THB", "closed": false, "lastUsed": 1756600000000, "uses": 41 }
  },
  "items": [
    {
      "id": "g_k3m9x2",
      "venue": "duckling",
      "title": "",
      "start": "2026-09-03",
      "time": "20:00",
      "dur": 180,
      "tz": "Asia/Bangkok",
      "repeat": {
        "freq": "week",
        "every": 1,
        "days": [4],
        "by": "weekday",
        "nth": 1,
        "until": null,
        "count": null
      },
      "ex": {},
      "pay": 2500, "ccy": "THB", "notes": "load in 7pm",
      "createdAt": 0, "updatedAt": 0
    }
  ],
  "updatedAt": 0
}
```

Field decisions, each load-bearing:

- **`start` + `time` are LOCAL wall-clock, plus an IANA `tz`. Never a UTC instant, never a numeric offset.** A weekly gig is "8pm local, forever", not "13:00Z forever". This one choice is the entire DST fix (§7.1).
- **`freq: "week" | "month" | "year"`** and `every` (1 = weekly, 2 = fortnightly). `days` is an array of ISO weekdays (1=Mon…7=Sun) so "Tue + Thu" is one rule.
- **Hard constraint: when `every > 1`, `days` must contain exactly one entry.** Multi-day fortnightly is ambiguous (RFC 5545 resolves it via week-start arithmetic that nobody predicts correctly). Enforce in the normaliser. Anyone who truly wants it makes two rules.
- **Monthly defaults to by-weekday** (`by:"weekday"`, `nth:1` → "first Friday"), because that is how residencies are booked. `by:"date"` (day-of-month taken from `start`) is the toggle, not the default.
- **Yearly** takes month+day from `start`. One rule for the annual festival.
- Keep `count` in the schema for `.ics` import only. Never author it (§6).

**Why a rule expanded on read, not materialised instances:**

1. **There is no cron.** Materialised instances need something to keep extending the horizon. With nothing to run it you would extend lazily on read anyway — at which point the rule is already the source of truth and the instances are a cache you now have to invalidate. Pure cost, no benefit.
2. **Atomicity.** "Change all of them" is one `casDoc` write. Materialised, it is 52 conditional writes through a store where invariant #4 already establishes that CAS alone isn't sufficient and every write needs read-back verification — 52 chances to fail halfway and leave a half-moved residency.
3. **Growth.** 6–7 gigs/week materialised is ~350 objects/year in a document you re-read and re-write on every single edit. As rules it is ~8 objects/year.
4. **"From now on" is genuinely open-ended.** There is no honest date to materialise to.
5. Free `.ics` export: the structured fields emit RRULE directly.

**What it costs — five real prices:**

1. **You cannot query cheaply.** "Next gig", "this month", "does this day have anything" all require expansion. Mitigate: `expand(from, to)` is pure, bounded (a month is ≤31 days × a handful of rules), hard-capped at 400 occurrences, and memoised in a JS `Map` keyed `${ym}|${gigs.updatedAt}`.
2. **An occurrence has no identity until you invent one.** Mint a deterministic id: `` `${rule.id}#${localDate}` `` → `g_k3m9x2#2026-10-15`. This is the join key for exceptions, for `showId`, for money attribution. **Derive it from the local date, never from a timestamp.**
3. **Retroactive rewriting of history.** Change the rule's time to 21:00 and every past occurrence retroactively claims it started at 21:00. Fix: pin the past (§2, `st:"done"`), and make "all" mean "all future" (§5).
4. **Rule changes orphan exceptions.** Move a residency Thursday→Friday and every exception keyed to a Thursday date is dangling. Handle it explicitly: re-key what can be re-keyed, drop the rest, and *say so* — "2 changes to this residency won't carry over."
5. **DST and skip semantics need tests**, where materialised instances just are what they are. Accept it and write the fixtures (§7.1).

---

## 2. Exceptions

**Nested on the rule as an object keyed by the local date the rule *would* generate — the slot, never the result.**

```json
"ex": {
  "2026-10-15": { "st": "off" },
  "2026-10-22": { "st": "moved", "date": "2026-10-23", "time": "21:30" },
  "2026-10-29": { "st": "edit", "time": "19:00", "venue": "duckling-garden", "notes": "acoustic" },
  "2026-11-05": { "st": "done", "showId": "2026-11-05-2003", "time": "20:00",
                  "venue": "duckling", "pay": 3000 }
}
```

Four states:

- **`off`** — cancelled. Expansion skips it as a gig but still emits it as a ghost, so the month grid can render a hollow bar. Keeping it is what prevents double-booking that night and makes "undo cancel" a single key delete.
- **`moved`** — carries `date` and/or `time`. The occurrence renders on the new date but **keeps `occId = g_x#2026-10-22`**. This is the whole reason the key is the slot: move it twice and you accumulate no orphans, and "put it back" is one delete.
- **`edit`** — same date, shallow-merged override of `time, dur, venue, city, notes, pay, title`.
- **`done`** — written automatically when that occurrence starts a live show, freezing what actually happened. Never hand-authored. This is what stops rule edits from rewriting history, and it's the hook that ties the calendar to `show.log` and to money attribution by `metadata.show` (invariant 17d).

Nested rather than a top-level exceptions list because: rule + exceptions land in **one CAS write**; deleting a series can't strand orphans; and expansion needs O(1) `ex[dateStr]` lookups per day, not a scan.

Two expansion consequences of `moved`: the target date can land outside the window, so the month expander must generate rule-dates over `[from−7d, to+7d]` and then filter on the *effective* date; and a moved gig may collide with a real one — allow it, the day cell just shows 2.

A one-off added on a residency night is **a separate item**, not an exception. Don't overload.

---

## 3. The mobile UI — minimum taps

Between sets, one hand, dark room. Entry: a `+` FAB bottom-right on the Calendar tab.

### (a) One-off — 3 taps

One bottom sheet. No wizard.

```
▁▁▁
New gig
[ Fri 5 Sep ▾ ]                 ← the day you tapped, else next free day
[ 8:00 PM  ▾ ]                  ← this venue's usual time
Venue
( Ugly Duckling )( Amsterdam Bar )( Sramanora )( + new )
Repeat  [ Doesn't repeat ▾ ]
⌄ more  (pay · notes · duration)
[          Save gig          ]
```

Tap `+` → tap venue chip → tap **Save**. Date and time are already right most of the time. If the date is wrong, tapping the date chip opens an **inline 14-day horizontal strip** (today +13, tap one) rather than a native picker — one tap instead of a scroll-wheel; "pick another date…" falls back to `<input type=date>`.

**Defaults ranked by taps saved:**

1. **Venue chips ordered by recency × frequency.** He plays four rooms; the first chip is right ~70% of the time. City, tz, duration and pay ride along from the venue record.
2. **Time follows the venue, not a global default.** Tap the Duckling → 20:00; tap the beach bar → 17:00. A global default is wrong half the time.
3. **Date defaults to the tapped cell**, or from the FAB, the next day with nothing on it.
4. **Pay / notes / duration hidden behind "more".** He will never fill them between sets.
5. **Repeat defaults to "Doesn't repeat."** A wrongly-created series costs far more to clean up than a missing one.

### (b) "Every Thursday at this bar from now on" — 5 taps

The critical decision: **the user never assembles a rule from freq/interval/weekday controls. They pick a finished English sentence, generated from the date they already chose.**

```
Repeat
( Doesn't repeat )
( Every Thursday )                    ← preselected
( Every 2 weeks on Thursday )
( First Thursday of the month )
( On the 5th of every month )
( Every year on 5 Sep )
( Custom… )
```

Tap `+` → venue chip → `Repeat` → "Every Thursday" → **Save**. Five taps, zero typing. This also makes the whole by-weekday-vs-by-date question vanish: both are offered as sentences and he picks the true one.

**Route B, which he will actually use more:** on an existing gig's detail sheet, **"Repeat this…"** opens the same sentence list. Real residencies begin as "I got a Thursday at the Duckling" and only become a residency three weeks later. Promoting a one-off in place keeps its `id`, so nothing already attached to it breaks.

**No end-date field on the create sheet at all** (§6).

---

## 4. The month calendar at 375px

**Grid math:** 375 − 24 padding = 351 / 7 = **50.1px per column**. Zero gutters — draw separators as inset 1px lines, never gaps, or you lose width you don't have. Row height **56px**, and the *whole cell* is the tap target (50×56 clears 44×44).

**Inside a cell:**
- Date number, top-left, 13px.
- Beneath it, up to **two 4px-tall rounded venue bars**, cell-width−8, coloured by a stable hash of the venue id into a fixed 8-colour palette. **Bars, not dots** — a bar carries venue identity at 4px and a dot doesn't, and a residency becomes a **vertical stripe down the Thursday column**. That stripe is the point: he sees at a glance that the residency is intact and exactly where the hole is.
- 3+ gigs: two bars plus `+2` at 10px, bottom-right.
- Cancelled: a **hollow** bar — 1px border, no fill. Present, visibly not happening.
- Today: filled circle behind the number. Selected: 1.5px ring on the cell.
- **No text titles in cells.** 50px buys about five characters, which is worse than nothing.

**Flipping months:** horizontal swipe *and* `‹ September 2026 ›` chevrons. Swipe alone is undiscoverable; chevrons alone are slow. Render current ±1 into a translated track. **Lock the axis on first move** (`|dx| > |dy|` decides, then commit) or vertical scroll dies.

**Tapping a day does not navigate.** It selects, and the panel permanently below the grid becomes that day's agenda — full rows: time · venue · city, plus a state chip for cancelled/moved. Default selection is today. The grid stays visible, so tapping around days is fast and reversible, and the agenda holds the venue names and times the 50px cells physically cannot.

**Adding on a specific day — three routes:**
1. The agenda's last row is always a ghost row: **`+ Add gig on Thu 15 Oct`**. Highest-intent, one tap, date pre-filled.
2. **Long-press a cell** (400ms) → new-gig sheet on that date. Zero discovery cost because #1 exists.
3. **FAB** for "a gig, day not decided" → defaults to next free day.

Add a `Month | List` toggle. List answers "what's on this week" and is what he'll live in; Month is for spotting holes and double-bookings. Same expansion feeds both.

---

## 5. Editing a series

- **Ask on Save, never on open.** Answering the scope question before knowing what you're about to change is where people get burned.
- **Ask only when it matters.** Not for one-offs; not when nothing that varies per-occurrence changed.
- **Two options, not three.** Drop "This and following" — it is the option people misread, and it's redundant (see below).

```
▁▁▁
Change every Thursday, or just this one?

[  Just Thu 15 Oct  ]                    ← primary, first
   the rest of the residency stays at 8:00 PM

[  Every Thursday from now on  ]
   changes 11 future gigs · past gigs keep 8:00 PM

[  Cancel  ]
```

What makes it un-confusing:

- **The safe option is first and is the primary button.** "Just this one" writes one exception key and is trivially undone.
- **Every option carries a consequence subline with a real count**, computed by expanding forward to `until` or +12 months. The number is what makes it concrete.
- **"All" always means all *future*.** Implementation: set `until` on the old rule to yesterday, create a new rule from today with the new values, carry forward only exceptions dated today or later. So "all from now on" *is* "this and following" — which is precisely why the third option is unnecessary, and why the "past gigs keep 8:00 PM" line is true rather than reassuring fiction.
- **Never the words event, series, instance, recurrence.** Say "this Thursday", "every Thursday", "the residency". The header names his actual pattern.
- **Delete uses the identical sheet**: "Cancel just this one" / "Stop the whole residency", same sublines.

---

## 6. Ending a series

**Recommendation: open-ended by default, ended later by a "Stop repeating" action that writes `until`.**

Not an end-date at creation: he doesn't know it. Residencies end when management changes or the season turns. Asking at creation is asking a question with no true answer, and every tap in that flow is expensive (§3) — this one buys nothing.

Not a count: nobody thinks "18 more Thursdays". Count also interacts badly with exceptions (RFC says a cancelled week consumes one; users assume it doesn't) and its meaning shifts under any re-anchoring edit. Accept `count` on `.ics` import, normalise it to `until` by expanding once, never author it.

On the series sheet: **"End this residency…"**

```
When was the last one?
( After Thu 15 Oct — this one )
( After Thu 22 Oct — next week )
( Pick a date… )
( It already ended — remove future gigs from today )
```

All four write `until`. **Nothing is deleted** — past gigs and the money hanging off those `showId`s stay intact (invariant 17d would otherwise be stranded).

The honest cost of open-ended: an abandoned residency generates gigs forever. Mitigation without a cron — on load, if a series has ≥3 consecutive past occurrences that never started a show, the Calendar tab shows one quiet line: *"Still playing Thursdays at the Duckling? [Yes] [It ended]"*, where "It ended" sets `until` to the last occurrence that did have a show. **The user's next visit is the cron.**

---

## 7. Traps

**1. DST.** Local wall-clock + IANA tz, converted to UTC only at display/export. The gig stays at 20:00 across the transition — which is what the bar means. Library-free mechanics: do all date arithmetic on **plain Y/M/D parts via a UTC-noon proxy `Date`** (DST-immune), and format through `Intl.DateTimeFormat` in the target zone. The classic killer is `d.setDate(d.getDate()+7)` on a local Date — across spring-forward it lands on 19:00 or 21:00. Never advance days by adding hours. Two zone-level edges: a 00:30 gig on spring-forward night may name a **time that doesn't exist** (roll to the next real minute, flag it in the agenda), and on fall-back a time that **occurs twice** (take the first). Bangkok has no DST, so this will never surface in his own testing — write the fixtures against `America/New_York` and `Europe/London`.

**2. The 00:30 gig.** **It belongs to the day it was booked as, not the day the clock says.** Allow `time` up to `"27:59"`: a Thursday-night 00:30 gig is stored as `time:"24:30"` on Thursday. This keeps the occurrence date unambiguous, keeps `occId` stable, keeps the Thursday column stripe unbroken, and makes "tonight's gig" still resolve at 1am. Render it as **"12:30 AM (Fri)"**. In the create sheet, entering 00:00–03:59 offers a one-tap toggle — *"this is Thursday night"* — defaulted on when he entered from a Thursday cell. Related: the Live tab's notion of "today" must use a **4am boundary**, not midnight, or the app tells him he has no gig tonight while he is standing on stage at 00:15.

**3. The venue closes.** Two separate actions; never conflate them. The **series ends** (`until` = last gig played) — do not delete, the shows and money hang off it. Separately the **venue record gets `closed:true`**: it drops out of the create-sheet chips so he can't re-book it, but still renders in past gigs and history. Any *future* occurrence at a closed venue gets a warning chip in the agenda — **silently removing gigs from someone's calendar is unforgivable**. If the residency merely relocates (same night, new bar), that's "all from now on" on the venue field, which under §5 becomes end-old-rule + new-rule — so history correctly keeps the old venue's name on the old dates.

**4. Travelling.** **The gig's tz is the venue's tz, always** — never the phone's, never his home zone. Picking a venue chip sets it; there is nothing to ask. For a brand-new venue, default to `Intl.DateTimeFormat().resolvedOptions().timeZone` (correct when he's adding a gig where he's standing) and surface it as one small editable line — *"Times in Asia/Bangkok"* — so a wrong guess is visible and one tap from fixed. Critically: **render every gig in its own venue's zone, labelled — never normalise the calendar to one zone.** "8:00 PM · Ugly Duckling" must read 8:00 PM whether he's in Thailand or a Berlin airport. Only two things convert to the phone's zone: the "next gig in 4h 20m" countdown and any reminder. Show the zone on a row **only when it differs** from the phone's current zone — otherwise noise 95% of the time, lifesaver the other 5%.

**5. `nth:5` and the 31st.** The fifth Friday exists in ~4 months a year; the 31st in 7. **Skip, never clamp.** Clamping to the 28th/last invents a gig the bar never booked, and inventing gigs is this feature's worst possible failure. Surface it once at creation: "the 31st of every month" shows *"skips Feb, Apr, Jun, Sep, Nov"*, with "last day of the month" offered as the adjacent sentence — which is usually what he meant. Same rule for Feb 29 yearly.

---

## Storage & wiring (fits the existing store)

- **One document, key `gigs`**, beside `show` and `profile`. `readDoc('gigs', …)` (strong), `casDoc('gigs', defaultGigs, fn, verify)` — a rule edit and its exception edits must land together.
- **Never `list()`** — a fixed key means you never need to (invariants 1 and 2).
- **`venues` lives *inside* `gigs`**, not as a second document: venue writes always accompany gig writes, and one CAS beats two that can half-fail.
- **Normalise on read *and* write**, exactly as `normProfile` does: drop rules that can't produce an occurrence, clamp `every` to 1–12, `nth` to `-1|1..5`, `days` to unique 1–7, `time` to `/^([01]?\d|2[0-7]):[0-5]\d$/`, and validate `tz` by attempting `Intl.DateTimeFormat(undefined,{timeZone:tz})` in a try/catch with fallback to the doc tz. **Never trust the stored record on read** — the precedent is invariant 9b.
- **Size:** keep 24 months of exceptions live; on any write, opportunistically sweep older `ex` keys into `gigs-archive-YYYY` (another known key — still no `list()`). No cron needed.
- **Public read:** `artist.html` gets upcoming gigs from the *same* expansion run **server-side** in the function, +90 days, returned as flat occurrences — so the public page never receives the rule set, `pay`, or `notes`.
- **Studio:** a `Calendar` tab between Live and Setlist, one more `if(TAB==='calendar')` block in `/Users/perryidyll/Docs/MySet/public/studio.html` — and per invariant 17e, add it to the tab-presence assertion, because a bad edit can delete a whole block and still parse.
- **The bridge:** starting a show stamps `ex[date] = {st:'done', showId, …}`, so the calendar, `show.log` history and money attribution agree without any duplicated state.