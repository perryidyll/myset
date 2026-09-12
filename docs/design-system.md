# MySet design system

What every page is made of, and why it is made that way. The stylesheets are the truth — `public/app.css` for the public pages, `public/lock.css` for the two Studios — and this page explains them. Every value quoted here is **copied** from a file, with the line it was copied from; nothing is typed from memory (AGENTS.md: never type a number a document could read out of the source). When a line moves, fix the reference here in the same change.

The folder `design-handoff/` (git-ignored) describes a different product in a different visual language. It is superseded by this page; § 13 lists what it got wrong.

---

## 0. Where the rules physically live

| File | Who loads it | What it carries |
| --- | --- | --- |
| `public/app.css` | `index`, `artists`, `about`, `artist`, `community`, `venue`, `vote` | tokens, reset, the four button tiers, chips, cards, header, credits pill, sheets, toast, the `.fab` pill, empty state, motion |
| `public/lock.css` | `studio.html` and `venue-studio.html` — **and nothing else** | lock states, the same four tiers (complete on their own), the chip hairline, the bottom tab bar, the Menu sheet rows |
| `studio.html:43–63`, `venue-studio.html:29–49` | themselves | each Studio's own token blocks (dark by default, `:root[data-theme=light]` on top) |

**Neither Studio loads `app.css`.** That is the single most expensive fact in this system: the lock rules were once written into `app.css`, looked right in the diff, and reached neither Studio (lock.css:11–15; `test/limits.mjs:130–135`). So every shared recipe exists twice — once in `app.css`, once in `lock.css` with a `var(--x, fallback)` for the tokens a Studio does not define — and the two must be changed together.

**Four pages also carry a private copy of a recipe they use.** On 2026-09-12 the pages went to production in `5b4a531` ahead of the `app.css` that defines `.btn-ink`, `.btn-grey`, `.btn-text` and `.chip`, so for a while a venue's "Sent — waiting to hear back" pill and the community rail were bare text on the live site. The lesson is written into each page: a page never waits on a shared-CSS deploy to draw its own controls.

| Page | Local copy | Of |
| --- | --- | --- |
| `artist.html:132–148` | `.btn-ink`, `.fab`, `.fab .state`, `.fab .act` | `app.css:131–132`, `224–232` |
| `community.html:127–141` | `.chip`, `.chip:active`, `.chip.on` | `app.css:143–150` |
| `venue.html:228–244` | `.btn-grey`, `.chip`, `.chip:active`, `.chip.on` | `app.css:133–134`, `143–150` |
| `vote.html:381–385` | `.sticky-act .btn-text` (the four declarations) | `app.css:135` |

They are byte-identical to the shared block on purpose. When one changes, all of them change; a page copy is a pure delete the day it is no longer needed, and nothing moves.

**Tests that pin the system** (run by `sh test/run.sh` unless noted): `test/limits.mjs:127–142` (lock rules live in `lock.css` only, both Studios link it); `test/copy.mjs:57`, `65`, `69` (`:root[data-theme=light]` in `app.css`, every page loads `/theme.js` and paints light first); `test/copy.mjs:119` (the Live tab is `#FF375F`); `test/darkroom.mjs:146` (the dock's buy button ring, verbatim); `test/decline.mjs:85–88` (the vote page's orange field ring); `test/structure.mjs:27–37`, `54–57` (no measured sticky offset in either Studio, one `tabBar()` each); `tools/uicheck.mjs` (a real browser at phone width; not in `run.sh`); `tools/sheetcheck.mjs` (0f0–0f2 under real touch events; not in `run.sh`).

---

## 1. Tokens

Copied from `public/app.css`. The light set is `:root` (lines 5–39); the phone's dark setting is the `@media (prefers-color-scheme:dark)` block (40–51); a manual choice is `:root[data-theme=light]` (54–62) and `:root[data-theme=dark]` (63–71), which restate the full sets so a choice beats the phone. **A new token goes into all three blocks** (and into the light block if it differs), or it silently reads as the light value in one theme.

Surfaces and ink (light, `app.css:10–19`):

```
--bg:#F5F5F7;  --bg-2:#EBEBEF;  --surface:#FFFFFF;  --surface-2:#FFFFFF;
--ink:#1D1D1F;  --ink-2:#3A3A3C;  --muted:#6E6E73;  --faint:#A1A1A6;
--hair:rgba(0,0,0,.07);  --hair-2:rgba(0,0,0,.12);
```

The same in the dark (`app.css:42–45`):

```
--bg:#000000; --bg-2:#0A0A0C;
--surface:#1C1C1E; --surface-2:#2C2C2E;
--ink:#F5F5F7; --ink-2:#DDDDE0; --muted:#98989D; --faint:#68686D;
--hair:rgba(255,255,255,.09); --hair-2:rgba(255,255,255,.16);
```

The one warm accent (`app.css:21–26`; dark overrides at `46`):

```
--accent:#FF375F;
--accent-2:#FF7A45;
--accent-ink:#D6003C;
--accent-soft:rgba(255,55,95,.10);
--grad:linear-gradient(135deg,#FF375F 0%,#FF6B45 100%);
--grad-warm:linear-gradient(135deg,#FF375F 0%,#FF9F45 100%);
```

```
--accent:#FF456E; --accent-ink:#FF8AA5; --accent-soft:rgba(255,69,110,.16);
```

`--accent` is the fill, `--accent-ink` is the accent as *text* (dark enough on a light ground, light enough on a dark one), `--accent-soft` is the accent as a *ground*, and `--accent-2` is the orange used for rings and emphasis lines ("goes straight to the artist"). Accent-coloured *words* are `--accent-ink`, not `--accent`: the fill does not have the contrast to be read as text on a light ground (the `lock.css:72–76` comment records the measurement that taught this).

Radii, depth, motion, layout, type (`app.css:28–38`):

```
--r-xs:10px; --r-sm:14px; --r:18px; --r-lg:24px; --r-xl:30px; --pill:999px;

--sh-1:0 1px 2px rgba(0,0,0,.04),0 3px 10px rgba(0,0,0,.05);
--sh-2:0 2px 6px rgba(0,0,0,.05),0 10px 28px rgba(0,0,0,.09);
--sh-3:0 6px 18px rgba(0,0,0,.08),0 22px 55px rgba(0,0,0,.14);
--sh-accent:0 6px 20px rgba(255,55,95,.32);

--spring:cubic-bezier(.34,1.4,.64,1);
--ease:cubic-bezier(.4,0,.2,1);
--maxw:560px;
--f:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Helvetica Neue",Inter,system-ui,sans-serif;
```

Dark shadows are heavier (`app.css:47–49`) because a shadow on black has to be black. `--sh-1` is a thing that *rests* (a card, a chip, a plain button); `--sh-2` is a thing that *floats* (the `.fab` pill, a hovered button); `--sh-3` is a thing that *covers* (a sheet, a toast). `--sh-accent` belongs to the commit button and nothing else.

**The Studios have their own token blocks** (`studio.html:43–63`, `venue-studio.html:29–49`) with the same names and values but a shorter list: no `--r-xs`, `--r-xl`, `--sh-3`, `--sh-accent`, `--grad-warm`, `--bg-2`; and the Venue Studio has no `--accent-ink` at all. That is why every rule in `lock.css` reads `var(--x, fallback)`, and why `.btn-text` there falls back to `--accent` rather than a literal pink (`lock.css:72–76`, `87`) — the literal was one theme's pink on both grounds.

Fixed colours that are *not* tokens, and why: `#FF375F` on the Studio's Live tab (`studio.html:105–107`, pinned by `test/copy.mjs:119` — it is red in both themes on purpose); `#000` on the dark tab bar (`lock.css:113–117`, § 7); the six clay icons (§ 12), which carry their own gradient so they render the same in both themes; `#fff` on any gradient fill.

The provenance marker `--ms-k` (`app.css:6–9`) is not a token. Leave it alone.

---

## 2. Theme

Light is the first-visit default (decision `0027`); `theme.js` applies the stored choice on load, on `pageshow`, on `storage` and on `visibilitychange`, and every page links it (`test/copy.mjs:65`, `69`). The switch is `.themebtn` (`app.css:84–87`). A page must paint light before its stylesheet arrives — the `#intro` / `#boot` placeholders carry `#F5F5F7` and a `[data-theme=dark]` black inline (`test/copy.mjs:70–76`).

Everything must work at 375px wide in **both** themes. The checks that catch a theme miss are computed-style reads in a real browser (`tools/uicheck.mjs`), not the diff: several defects a month are invisible in the source and obvious on screen.

---

## 3. Type, radius, depth

- One family, the system stack in `--f`. **No web fonts** (AGENTS.md: no fonts, no CDN). `public/vendor/model-fonts.css` exists for the money model page only and is not a precedent.
- Body 16px / 1.45, letter-spacing `-.011em` (`app.css:75–80`); headings 700, `-.028em`, line-height 1.08 (`app.css:91`); `.kick` is the small grey label (`app.css:98`).
- Cards are `--r` with `--sh-1`; the larger card is `--r-lg` with `--sh-2` (`app.css:153–154`). Buttons and chips are `--pill`. Sheets are `--r-xl` on the top corners only (`app.css:179`).
- `button` is reset to nothing (`app.css:82–83`), so **every tier sets its own padding and background**. A button with no class is invisible chrome — that is what a page gets when it references a class its stylesheet does not carry (§ 0).
- `:focus-visible` is a 2.5px accent outline (`app.css:90`) on the public pages only.

---

## 4. Buttons — four tiers, not two

Before 2026-09-12 a page had "gradient" and "plain surface", so every next step, every "Show all" and every "Not yet" was invented locally and no two matched. Now there are four, and a control that is not one of them needs a reason written next to it.

Public pages compose with the base (`app.css:110–121`):

```
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;
  font-size:16px;font-weight:600;letter-spacing:-.01em;padding:15px 22px;border-radius:var(--pill);
  background:var(--surface);color:var(--ink);box-shadow:var(--sh-1);
  transition:transform .22s var(--spring),box-shadow .22s var(--ease),background .18s var(--ease)}
.btn:hover{box-shadow:var(--sh-2)}
.btn:active{transform:scale(.965)}
.btn-pri{background:var(--grad);color:#fff;box-shadow:var(--sh-accent)}
.btn-pri:hover{box-shadow:0 8px 26px rgba(255,55,95,.42)}
.btn-ghost{background:var(--surface);color:var(--ink)}
.btn-block{width:100%}
.btn:disabled{opacity:.45;cursor:not-allowed;transform:none!important}
.btn-sm{padding:10px 16px;font-size:14px}
```

and the three tiers added beside it (`app.css:131–136`):

```
.btn-ink{background:var(--ink);color:var(--bg);box-shadow:var(--sh-1)}
.btn-ink:hover{box-shadow:var(--sh-2)}
.btn-grey{background:color-mix(in srgb,var(--ink) 9%,var(--surface));color:var(--ink);box-shadow:none}
.btn-grey:hover{box-shadow:none}
.btn-text{background:none;color:var(--accent-ink);box-shadow:none;padding:12px 14px}
.btn-text:hover{box-shadow:none;background:var(--accent-soft)}
```

| Tier | Class | What it is for | Shipping examples |
| --- | --- | --- | --- |
| **Commit** | `btn btn-pri` | The one thing the screen exists for. Gradient, accent glow. At most one per screen. | "TAP TO VOTE THE SETLIST" while live (`artist.html:672`); Confirm in the vote sheet (`.go`, the sheet's own commit, `app.css:200–204`); "Say something" dock (`community.html`); the pitch's Send |
| **Ink** | `btn btn-ink` | The next step when nothing is being committed — a neutral primary. Ink on paper; in the dark the tokens flip so it stays the darkest thing on the page, inverted. | the artist pill's countdown before a gig, and "Community" when nothing is listed (`artist.html:132–148`, the page's own copy of the tier) |
| **Grey** | `btn btn-grey` | Secondary. Sits back: a 9% ink tint over the surface, no shadow. | "Show all N" amenities (`venue.html:536`); "View next week's events" (`index.html`); "Quick tips for earning more" (`studio.html`) |
| **Text** | `btn btn-text` | Tertiary — words only, accent ink. The way out that is not a choice. | "Not yet" under Confirm (`vote.html:729`); "Skip for now" / "Later" in the Studio's first run |

Rules that come with the tiers:

- **Disabled is greyed, never hidden** (`opacity:.45; cursor:not-allowed`). A control that will be refused must not be offered (AGENTS rule 3, INVARIANT 0ad); a control that exists but is not ready is shown, greyed, with the reason beside it.
- `.btn-ghost` (`app.css:118`) is a visual no-op kept for old markup. Do not add it to new pages; the base `.btn` already is the plain surface pill.
- `.btn-sm` shrinks any tier (`10px 16px`, 14px) for a control that sits inside a card.
- `.btn-grey` uses `color-mix`, which three pages already relied on; `--bg-2` was tried and is near-invisible on the black ground.
- The **Studios have no `.btn` base**, so each tier in `lock.css:77–88` is complete on its own (display, font, padding, radius, transition, `:active`, `:disabled`) and is used as `class="btn-pri btn-block"` — no `btn` prefix. The Studio's older recipes (`.big`, `.big.alt`, `.act`, `studio.html:169–174`, `250`) are still there; new Studio controls use the tiers.
- Every pressable thing scales on `:active` (`.965` for buttons, `.94` for chips) and nothing else moves — the press is felt without the layout shifting.

---

## 5. Chips

One recipe for every small pressable pill (`app.css:143–150`):

```
.chip{display:inline-flex;align-items:center;justify-content:center;gap:6px;
  padding:9px 14px;border-radius:var(--pill);font-size:14px;font-weight:600;letter-spacing:-.01em;
  background:var(--surface);color:var(--ink-2);white-space:nowrap;
  border:.5px solid var(--hair-2);box-shadow:var(--sh-1);
  transition:transform .22s var(--spring),box-shadow .22s var(--ease),background .18s var(--ease)}
.chip:active{transform:scale(.94)}
.chip.on{color:var(--accent-ink);background:var(--accent-soft);border-color:transparent;
  box-shadow:0 0 0 1.5px var(--accent) inset,var(--sh-1)}
```

- **A hairline AND a soft shadow.** The lock veil's pill (`lock.css:48–53`) found that combination first; pages used to pick one or the other and no two looked alike.
- **`.on` is an accent ring on a soft ground, never a fill.** A filled chip reads as a button. The vote page's genre chips lost their gradient fill for this reason.
- Chips are for filters, toggles and states — "All", "2 clips", a night, "Upcoming", "They're keen". A chip that *does* something is a `.btn-sm`.
- In the Studios `lock.css:95–96` adds only the hairline: each Studio sizes its own `.chip` (`studio.html:521–525`, `venue-studio.html:199–203`) and, for now, still fills `.chip.on` with the gradient because `lock.css` loads after those rules and cannot override them without overriding the sizes too. The pitch reply chip (`studio.html:224–226`) already wears the ring. Moving the Studio's other `.chip.on` states to the ring is a page edit, not a `lock.css` one.
- Where the recipe is consumed: the artists directory toggles (`chip filtertoggle`), the front door's header links (`chip signin`, restated in accent ink there), the community proof rail and composer labels, the venue's reply pill, the vote page's genre and sort bars (as inset shadows so no layout shifts; `vote.html:201–217`).

---

## 6. The `.fab` pill

A floating block pinned to the bottom of the phone: what is true right now, and the one thing to tap (`app.css:224–232`):

```
.fab{position:fixed;left:50%;bottom:0;transform:translateX(-50%);z-index:50;
  width:calc(100% - 24px);max-width:calc(var(--maxw) - 24px);
  margin-bottom:calc(12px + env(safe-area-inset-bottom));
  display:flex;align-items:center;gap:12px;padding:10px 10px 10px 18px;
  background:var(--surface);border:.5px solid var(--hair-2);border-radius:var(--pill);
  box-shadow:var(--sh-2)}
.fab .state{flex:1 1 auto;min-width:0;font-size:13px;font-weight:500;color:var(--muted);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fab .act{flex:0 0 auto}
```

- The state slot may never push the button off: it shrinks and ellipsises first (`min-width:0` is what allows that in a flex row).
- **A page that shows it pads its own bottom** and lifts its toast above it — the artist page does both (`artist.html:45`, `162`). The toast is z 70, the pill z 50, sheets 60/61: a sheet covers the pill, and a toast that was not lifted covered most of it for three seconds.
- The artist page's variant stacks the two halves as a centred column (the founder's call, `artist.html:154–171`): one state line ("Next: Thu 6:30pm · Seaflower Bungalows", "Live now · 23 voting", "No shows listed") over one action, in a `--r-lg` block. While live the action is `btn-pri` with the `emberGlow` pulse; before a gig it is `btn-ink` with the countdown; with nothing listed it is `btn-ink` "Community". `#joinBtn` stays inside `#app` and reads "TAP TO VOTE THE SETLIST" when live (`tools/uicheck.mjs`, `test/copy.mjs`).

---

## 7. The bottom tab bar

One recipe for both Studios (`lock.css:113–133`; the reasons at `98–112`):

```
.tabbar{position:fixed;left:0;right:0;bottom:0;z-index:55;display:flex;justify-content:center;
  height:calc(52px + env(safe-area-inset-bottom));padding:0 0 env(safe-area-inset-bottom);
  background:#000;border-top:.5px solid var(--hair,rgba(255,255,255,.09));
  box-shadow:0 -6px 24px rgba(0,0,0,.28)}
:root[data-theme=light] .tabbar{background:var(--surface,#fff);box-shadow:0 -4px 18px rgba(0,0,0,.08)}
```

- **Fixed, where a thumb already is.** Each Studio used to carry a sticky pill under its header whose height had to be measured (`fitTabs` / `--headh`); a fixed bar has no header to clear. `test/structure.mjs:27–37`, `54–57` now assert those are gone and that each Studio has exactly one `tabBar()` (`studio.html:2961`, `venue-studio.html:1431`).
- **Black in the dark, not surface grey**: on a black page a grey bar merged with the cards above it. A clean surface in the light, with a lighter shadow.
- z-index 55: above each Studio's header and page, under its sheet backdrop (60), so a sheet still dims it.
- The selected tab wears a **ring**, not a fill: a pill drawn by `button::before` behind icon and label, inset from the button so five tabs still read at 375px, with the hit area the full fifth of the bar (`lock.css:119–133`). The Live tab keeps its red in both themes (`studio.html:105–107`).
- Each Studio's body reserves the bar's height at the bottom and lifts its toast to `64px + env(safe-area-inset-bottom)` (`studio.html:638`, `venue-studio.html:337`).
- Five tabs each: Live · Setlist · Gigs · Money · Menu (Artist), Page · What's on · Numbers · Merch · Menu (Venue). Menu opens a sheet of `.menurow`s (`lock.css:137–148`): Profile / Settings / Your plan / Sign out, or Food & drink / Settings / Your plan / Sign out. The tab remembered in `localStorage` (`myset.tab`, default `setlist`) is unchanged (`test/copy.mjs`).

The fan pages have **no tab bar** — see § 13.

---

## 8. Sheets — INVARIANTS 0f0, 0f1, 0f2

The base (`app.css:174–185`): a `.bg` scrim at z 60, the `.sheet` fixed at the bottom, `max-width:var(--maxw)`, `--r-xl` top corners, `--sh-3`, z 61, sliding in on `--spring` over `.42s`, `max-height:90vh`, scrolling inside itself, padded for the home indicator. `.grab` is the 38×5 handle. `h3` is 24px; `.lede` the grey line under.

Three rules were each learned from a fan's thumb, and `tools/sheetcheck.mjs` holds them under real touch events:

- **0f0 — the transform always carries `translateX(-50%)`.** The sheet is centred by transform, not geometry; any code that writes `style.transform` and drops that term moves the sheet half its width to the right. The drag handler keeps it in a constant (`SHIFT`, `vote.html:1365`).
- **0f1 — nothing that scrolls on its own is a place to start dragging from.** The handle is the grab zone, the title and the lede (`HANDLE='.grabzone,h3,.lede'`, `vote.html:1366`); a drag never starts inside `.lyr` (`SCROLLER`, `1370`) or on a control (`CONTROL`, `1360`). The grab zone is at least 56px tall (`vote.html:332`) — a real thumb target. A drag of more than 70px, or a fast flick, closes; anything less springs back (`vote.html:1387`).
- **0f2 — a sheet freezes the page behind it.** `body.sheeting` is `position:fixed` at the offset the page was at, restored on close (`vote.html:342`, `1327–1348`; `community.html:159`, `336–358`; `venue.html:200`, `713–725`). Without it iOS scrolls the page under the sheet, which is indistinguishable from having grabbed the wrong thing.

Also:

- One `.go` per sheet (`app.css:200–204`) — the sheet's commit, full width, gradient. The way out under it is `btn-text` "Not yet", never a second filled pill: two pills read as two choices.
- The vote sheet's "Review and continue" card shows the song and the wallet before Confirm; the title wraps rather than truncates (a review that hides what it reviews is not one). The Choose → Pay → Done bar appears only when a pack is being bought *for a song*, and Done is reached by resuming the sheet after the Stripe return.
- A sheet must not orphan a form: the community composer is one element that is *moved* into the sheet and parked back out before any other sheet replaces the content, so a typed draft survives (`community.html`).

---

## 9. Lock states

Copied from `lock.css:37–62`; the reasons at `1–36`:

```
.lock{position:relative;isolation:isolate}
.lock>.lockin{opacity:.32;filter:saturate(.2);pointer-events:none;user-select:none}
.lockveil{position:absolute;inset:0;z-index:2;display:grid;place-items:center;
  border-radius:var(--r-sm,14px);
  background:linear-gradient(180deg,rgba(0,0,0,.34),rgba(0,0,0,.62));
  cursor:pointer;border:0;width:100%;padding:0;margin:0;
  font:inherit;color:inherit;text-align:center}
.lock.soon>.lockveil{cursor:default}
```

- **Two states, and the difference is honesty.** `.lock` is built and a higher plan turns it on — tappable, it opens the plans. `.lock.soon` is designed and not built (`NOT_BUILT` in `_plan.mjs`, `VENUE_NOT_BUILT` in `_venues.mjs`) — greyed on every plan including Pro, and not tappable, because there is nothing behind it to open (INVARIANTS 0bx, 0by).
- **`pointer-events` is the lock; the opacity is only how it looks.** A lock that is only opacity is not a lock. `test/limits.mjs:128` reads that declaration out of the file.
- **The veil is always dark**, in both themes: a veil that lightened itself washed out the greyed content behind it, and a dark scrim over a light card still reads as "not yet" without a word.
- The caption is the chip-shaped pill `.lockveil b` (`lock.css:48–53`) — "Coming soon" or "<Plan> feature" (`studio.html:1496`). **The reason goes under the lock, not inside it** (`.lockwhy`, `lock.css:57–62`): inside, a one-row lock clipped it to "Coming soo".
- The markup comes from `lock(flag, html, why)` (`studio.html:1493`, `venue-studio.html:735`). Never write a lock by hand.

---

## 10. Motion

The whole system moves on two curves: `--spring` for things that arrive or are pressed, `--ease` for things that fade or slide. Transforms and opacity only — motion never changes a layout metric, so nothing under a finger jumps.

- **Entrance.** `.rise` is `.5s` on `--ease` (`app.css:248–249`); `.stagger>*` arrives in `.45s`, each child 30ms after the last (`250–255`). Do not re-render a page to change one thing — a full `render()` replays every entrance while the person is mid-page. Reveal in place (the venue's "Show all" drops a class; the vote page repaints the dock state line alone).
- **FLIP re-rank on the vote page** (`vote.html:954–975`). `flipFirst()` records every `.qrow`/`.prow` rect before the innerHTML swap; `flipPlay()` inverts each moved row with an inline `translate`, forces one reflow, then plays `transform 240ms cubic-bezier(.2,.7,.2,1)` back to rest and clears the inline transition after 260ms. It returns `null` — no animation — under a finger (`FINGER`, `950–953`), while a sheet is open or the page is frozen, and under `prefers-reduced-motion`.
- **The proof carousel on the artist page** (`artist.html:179–195`, `418–440`). `scroll-snap-type:x mandatory`, `scroll-padding-left:18px` so a snapped card sits where the first one already does. `startProof()` turns it every 3.5s by `scrollTo({behavior:'smooth'})` to the card after the one nearest the left edge, loops to the first after the last, pauses on `touchstart` (or a mouse entering) and resumes 6s after the finger lifts, does nothing while `document.hidden`, quits when its element is replaced, and never starts under `prefers-reduced-motion`.
- **`emberGlow`** is the one pulsing call to action per page: the artist pill while live (`artist.html:163–164`), the vote dock's button (`vote.html:280`), the tip bar (`community.html:88`). One per page; two glows compete.
- **The credits pill** bumps by `scale(1.14)` when a vote lands and wears the accent ring when low (`app.css:166–171`). The live `.dot` pings (`app.css:101–107`).
- **Reduced motion.** `app.css:260–263` is the kill switch for every public page — every animation and transition collapses to `.01ms`. The Venue Studio has the same (`venue-studio.html:348`); each page also guards its own loops by hand (`artist.html:171`, `vote.html:284`, `community.html:96`, the equaliser bars on every loading screen). Anything driven by JavaScript timers (the carousel, FLIP) must check `matchMedia('(prefers-reduced-motion:reduce)')` itself — CSS cannot stop a `setInterval`.

---

## 11. Copy voice

There is no separate copy guide; the rules are AGENTS.md's ranking rules, VISION.md's philosophy, and the wording the tests read out of the shipped files. Written down:

1. **Short, plain, second person.** Sentence case, contractions, concrete nouns. "Nothing on the list yet — X is still putting tonight's songs in." (`vote.html:1084`). Unit words spelled out and pluralised in code (`show${n===1?'':'s'}`).
2. **No exclamation marks** — except the one promise, which is exact and tested: "Once you confirm, it's final! Votes **can't be changed** once cast and ***don't come back***." and "Are you sure? Votes can't be changed!" (`vote.html:710`, `715`; overview § 1.10; `test/votesstay.mjs`, `test/finality.mjs`). The words are the promise; change them nowhere.
3. **The room is never told to sign in, install, or create anything.** Fans have no account (AGENTS rule 2). A design that needs one is the wrong design.
4. **Never show the room a button that leads to a shrug** (AGENTS rule 3, INVARIANT 0ad). If the server will refuse it, the page does not offer it; if the page offers it, the server allows it. When card tips are off, the tip bar says so *before* the tap: "Card tips aren't on yet — say hi at the show" (`community.html:464`).
5. **Say what still works.** A failure names the way on: "Couldn't load this page just now. Pull down to retry." (`artist.html:509`, `venue.html:427`); "Couldn't load next week. Try again in a moment." (`index.html:606`). Never blame the person.
6. **Say the why in the sub line.** "Nothing says “live” to fans until you tap this — or until a gig on your calendar reaches its start time." (`studio.html:2265`).
7. **State, not instruction, on the dock.** "Voting open", "Voting paused — votes stay", "Last call · N", "Doors open soon", "Show's over — say thanks", "Between shows" (`vote.html:1178–1180`).
8. **Claim only what the server can vouch for.** A proof card says "Takes requests", not "Takes requests tonight", because the switch is a standing setting; the rating says "MySet rated N/5 · By the room at this artist’s shows, N ratings", because the stars rate MySet, not the artist (decision `0043`).
9. **Locked reads as locked**: "Coming soon" for the unbuilt, "<Plan> feature" for the built, the reason in one line underneath (§ 9). Never "upgrade to unlock".
10. **A cap defers, it never drops — and it says so** (INVARIANT 0bw).
11. **Never the founder's name** in a file, and never a number that the code could have supplied (AGENTS.md).

---

## 12. Icons

- **Line icons everywhere in chrome**: 24-viewBox, `fill:none; stroke:currentColor; stroke-width:2` (1.9 in the tab bar, 2.3 when selected), round caps. Inline SVG, no icon files, nothing under `public/icons/` but the two app icons.
- **The brand mark**: three rounded bars, white on a `--grad` rounded square, one path shared by every page.
- **Six "clay" icons** — mic, ticket, tip, qr, venue, star — 64-viewBox, a `--grad` body with a vertical shade, a radial white sheen and a soft `#FF375F` ground, each about a kilobyte, ids prefixed `clay-<name>-` so two on one page cannot collide. They sit where a picture earns its place: the three cards under "It's not really about the votes" and the three under the venue section on `/about` (at 40px, in place of the emoji that were there), the Studio's Today checklist rows (24px), the venue pitch card's avatar fallback. They carry their own colours and so render the same in both themes. The proof strip on the artist page deliberately has none: the words are the card.
- The Studio's favicon (`studio.html:37`) still carries the handoff's colours (`#201e1d` / `#ec3013`) where every other page uses the `--grad` pair. It is the last trace of § 13 in the product and is a one-line change whenever the Studio is next touched.

---

## 13. What `design-handoff/` got wrong

`design-handoff/README.md` (454 lines, git-ignored, never referenced by any document) specifies "direction 1a — The Queue" in the Modernist system. It was superseded before it was implemented; the product that shipped is the one described above. Its claims, against what is live:

| The handoff says | What is true |
| --- | --- |
| "Zero border-radius anywhere. No rounded cards, no pill buttons." (README:49) | Every card is `--r`, every button and chip is `--pill` (`app.css:28`) |
| One accent `#ec3013`, ink `#201e1d`, ground `#f3f2f2`, Archivo (README:53, 355–360; `design-system/modernist-readme.md`) | `--accent:#FF375F` with a warm gradient, `--ink:#1D1D1F`, `--bg:#F5F5F7`, the system font stack; a dark theme (`app.css:10–38`, `40–51`) |
| "Flat: no shadows on in-app surfaces except sheets" (README:55) | Three depth levels plus an accent glow (`app.css:30–33`), on cards, chips and buttons |
| Grayscale photography (README:57) | Colour stills throughout `/about` |
| Fans have four tabs — Live · Discover · Feed · You — a persistent mini-player, and a Fan ⇄ Artist role switch (README:18–19, 65–93) | **The audience never signs in** (AGENTS rule 2). There is no fan tab bar, no mini-player and no role switch. A fan is on `/` (gigs near you), `/artists`, `/<slug>`, `/<slug>/vote`, `/<slug>/community` or `/venue/<slug>`; the artist signs in to `/studio`, a different page. The only tab bar in the product is the Studios' (§ 7) |
| "You" tab: credits history, badges, streaks, receipts, memberships, tickets (README:77–78) | None of it exists; there is no fan account to hang it on |
| Artist profile tabs Links · Music · Merch · Tour · Community · EPK; Buy ticket / Join membership (README:72–73) | One scrolling page; no tickets, no memberships; the press kit is in `NOT_BUILT` and shows as "Coming soon" (INVARIANT 0by) |
| Credit chip "7/10" (README:121) | `.credits` reads `${freeRemaining}/${freeTotal} votes` — "3/3 votes" on a fresh phone (`test/copy.mjs:35`, `tools/uicheck.mjs`) |
| VOTED ✓, BOOST, "out of credits rows drop to 55% opacity", a Boost sheet at "$2/+3 votes, $5/+8 jump queue… charged to Apple Pay" (README:150–156, 257–283) | Votes are cast, final, and priced by the artist's own packs through Stripe on the artist's account (decisions `0001`, `0007`, `0014`); there is no "boost" and nothing jumps a queue |
| "The artist hasn't opened the vote pool yet" (README:171) | "Nothing on the list yet — X is still putting tonight's songs in." |
| Votes queue locally offline and replay (README:173) | A cast is idempotent by its own id (INVARIANT 15h); there is no offline queue |
| "+ ADD SONG … OPEN VOTING FOR TONIGHT" (README:240, 253) | "Start the show" and the Open / Paused voting toggle on the Live tab |
| "The visual language is fixed" (README:47) | It was replaced. `app.css:1–4` names the system that shipped: soft depth, spring motion, SF-family type, one warm accent |

The folder is kept because it is history, not because any of it is instruction. If something in it and something in this page disagree, this page wins, and the code wins over this page.

---

## 14. Keeping this true

- A shared recipe changes in **`app.css` and `lock.css` together**, and in every page that carries a private copy (§ 0). `grep` the selector across `public/` before editing it.
- A new token goes into **all three** blocks of `app.css` and, if a Studio needs it, into both Studio blocks — or it gets a `var(--x, fallback)` in `lock.css`.
- A page never references a class that is not in the same commit as the stylesheet that defines it (§ 0). If it must ship first, it carries a copy.
- Before saying a page is done: `sh test/run.sh`, then `node tools/uicheck.mjs` and, for anything with a sheet, `node tools/sheetcheck.mjs` — and look at it at 375px in both themes. **A green suite proves nothing about a page.**
- Every number on this page was copied from a file at the line given. If a line no longer says what this page quotes, the page is wrong, not the file.
