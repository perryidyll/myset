# 2026-09-06 — The landing page against the app it sells

**Two parts.** Part 1 is a read-only audit of `public/about.html` (and
`public/index.html`) against the whole codebase, plus the design for a system that
stops the two drifting apart again. **Part 2, at the foot of this file, is the
rewrite that followed** — `public/about.html` was replaced and five new images
added under `public/about/`. Nothing was committed or pushed; `main` is production.

Report artifact: <https://claude.ai/code/artifact/5b592a1b-3a78-4103-afa0-6571622cc62b>
(carries a per-finding approve / adjust / leave-it decision that persists — those
decisions can be read back in a later session and applied.)

Backing detail, all generated this session, in `docs/landing/`:

| File | What it is |
|---|---|
| `LANDING-CATALOGUE.md` | 568 atomic claims, ten sections, with line numbers and falsifiers |
| `APP-CATALOGUE.md` | 791 features across twelve surfaces, with plan/flag gates and build state |
| `DISCREPANCIES.md` | the 69 upheld findings, each with evidence, the sceptic's reasoning, and a fix |
| `GAPS.md` | 64 things the app does that the page never mentions, five lenses |
| `CRITIC.md` | what the audit itself missed, plus six findings the critic made on its own |
| `audit-2026-09-06-raw.json` | the full structured output (2.3 MB) |

---

## 1. Method

Two workflows.

**Workflow 1 — catalogue and cross-examine.** 257 agents, 4,569 tool calls, ~25M tokens.

- 12 agents each read one app surface and returned a feature inventory: what it does,
  `file:line`, audience, plan gate, flag gate, build state, and whether it looks newer
  than the landing page's last edit (`9e9fde4`, 2026-09-05).
- 10 agents read the landing page in slices and extracted every atomic claim — including
  implied ones (a screenshot placed under a sentence claims the sentence describes that
  screen; alt text is a claim; an uncaveated bullet claims it needs no caveat).
- Each section's claims then went to a verifier that had to settle them against code.
- **Every alleged discrepancy then went to a separate sceptic instructed to refute it**,
  defaulting to "refuted" when it could not confirm the problem in code it had read itself.
- A completeness critic audited the finished audit.

**Result: 219 alleged → 150 refuted (68%) → 69 upheld** (6 critical, 37 major, 24 minor,
2 cosmetic). The refutation rate is the point: without that pass this report would have
been three times longer and substantially wrong.

**Workflow 2 — the drift system.** Four independent architectures, three judges scoring on
three different criteria. The synthesis agent hit a weekly usage limit and the synthesis
was done in the main loop instead.

---

## 2. The six critical findings — all in the pricing block

| Line | The page says | The code does |
|---|---|---|
| 658 | "Plus and Pro can't be bought yet." | `_billing.mjs:121-161` — Stripe Checkout, subscription mode. Wired to `studio.html:3565`. `STRIPE_SECRET_KEY` is set in production. |
| 658 | "There's no checkout" | Checkout, proration, retention coupon, customer portal, invoices, webhooks — `_billing.mjs`, plus the venue equivalent at `venueadmin.mjs:409-450`. |
| 606 | "Setlists, chord charts, keys and genres" *(Free column)* | `_plan.mjs:67` `setlists: false`; `admin.mjs:735-736` returns 402 "Separate setlists are a Plus feature". `studio.html:3524` already sells it under Plus. `test/limits.mjs:37` already asserts it. |
| 657 | "Everything that doesn't involve a card works the moment you sign up." | Five things in the same section are plan-gated and refused server-side: setlists, vote rules (`admin.mjs:1706`), delete-a-post (`admin.mjs:1288`), a second sign-in (`auth.mjs:395`), unlimited live songs (`admin.mjs:1852`). |
| 593 | "none of it ever costs the room a penny" | `vote.html:919-940` — vote packs and tips with real prices, posting to `pay.mjs`. The same section says "Price your own vote packs" eleven lines later. |
| 601 | "About a gig a week… you never pay us anything" | `_plan.mjs:33` `gigs: 4` per **UTC calendar month** (`_lib.mjs:131`). A weekly player averages 4.33 and is blocked in any month with five of that weekday. Also `_featured.mjs:40` charges $10, default-on and not plan-gated. |

**Direction matters.** Notes 2 and 3 are stale in the *expensive* direction — the page
denies two shipped, saleable features. Stripe Connect Express works for any artist on any
plan (`_connect.mjs:130-190`, `_pay.mjs:52-54`); the page says payments run on the founder's
gigs only.

---

## 3. The screenshots

Four of five predate the code they depict, and this class is structurally invisible to
`test/copy.mjs`, which reads HTML text.

- **`profile.jpg`** (2026-09-02) — shows a stat tile labelled **"Audience"**. Renamed to
  **"Fans"** on 2026-09-04 (`artist.html:411`), and `test/copy.mjs` *bans* the old word from
  every public page — but a word inside a JPEG is not text. It also shows "2 Shows / 23 Votes
  cast" eight lines below the page's own "one real gig… eight people and twenty-one votes",
  and predates the Community button in the stats grid. (Those numbers are lifetime totals, not the
  first gig's — but nothing on the page says so.)
- **`vote.png`** (2026-08-31) — miscropped: vote counts, the credit pill and the "+" buttons
  are past the right frame edge. Its alt text describes a "7" that is not in the picture.
  **This file is also `og:image`**, so it is what every shared link shows.
- **`ask.png`** — a 3/3 credit pill (default is `freeCredits: 5`, `_lib.mjs:176`) and a
  retired "$3" pack price.
- **`studio.png`** — the old Open/Paused segmented control, since replaced by the `votebox`.

---

## 4. What the critic found that 256 agents missed

The structural one: **`grep -rn 'about\.html' test/` returns zero hits.** The repo owns a
purpose-built copy guard and points it at `studio.html`, `venue-studio.html`, `lock.css`,
`app.css` and `admin.mjs` — everything except the page that sells the product.

Also its own six findings, including two the audit had cleared:

- `studio.html:3531,3545` sells "shows that start and end themselves" as Plus/Pro.
  `_auto.mjs` has **no plan gate at all** — every free artist already has it.
- `about.html:377` "Print it once. It's good forever." A retired slug **is** claimable:
  `auth.mjs:451-453` writes `oldSlug`, but the comment claiming it is protected is wrong.
  On the venue side there is no `oldSlug` mechanism at all (`venueauth.mjs:148`).
- `about.html:628` "Merch on your page" — `grep -ci merch public/artist.html` returns 0.
  Merch renders on the *community* page. The Studio's own card gets this right.
- `about.html:683` "nobody's out of pocket" — a fan who bought a vote pack and whose request
  is declined after the next song starts permanently loses a purchased vote.
- `public/mp4trim.js` (516 lines) is in no surface of the app index.
- `test/structure.mjs` guards six Studio tabs; there are seven. The unguarded one is Merch,
  which `about.html` sells.

---

## 5. The correction plan — five waves

1. **Stop the page arguing with the checkout.** All six criticals; `about.html` only, no code.
2. **Re-shoot all five screenshots** and fix the alt text. Also fix **honest note 1**, which
   still says MySet "has run one real gig" — the live API and `PORTFOLIO-MASTER-BRIEF.md`'s
   facts table both say **two** (2 shows · 25 votes · 11 people lifetime). The proof block's
   first-gig figures (8 people, 21 votes) stay as they are; they are true and they are the
   better argument. What has to change is the note, and the picture that shows lifetime
   totals beside them without saying so.
3. **Make the demo widget true** — `left = 3` → 5; remove the take-back path (`voteFinal`
   defaults on, `_flags.mjs:32`); add the quantity stepper.
4. **Add what shipped.** Split beat 5 (artist page / community page + clips-with-sound); add a
   beat for auto-start; room overflow never turns anyone away; venue Pro.
5. **Make about / studio / index agree** — including the Studio's own two errors above.

---

## 6. Soundcheck — the drift system

Four designs, three judges, no design won twice.

| Design | Survives | Catches | Actionable | Fatal flaw |
|---|---|---|---|---|
| Promise Ledger | **8** | 7 | 7 | Ends at a red X; only sees what was tagged |
| STAMP | 5 | **9** | 6 | Bulk-rewrites hand-authored copy |
| Nightwatch | 7 | 7 | **9** | A diff can never see a stale screenshot |
| Claims Ledger | 4 | 8 | 8 | Writing a sentence becomes an obligation to write a ledger entry |

**The synthesis: three layers, each winning its own round.**

**Layer 1 — the guard.** `test/promises.mjs`, in `run.sh`, ~250 ms, $0. Nothing is matched as
a sentence: each claim carries one token naming the code fact beneath it
(`data-plan="free.setlists"`, `data-num="free.gigs free.audience"`,
`data-until="_billing.mjs:startCheckout"`). Gates read `_plan.mjs` and take polarity from the
column. Numbers are *extracted* (digits and number-words) and checked for presence, so a
rewrite passes and a moved number fails. Denials are inverted — true only while the symbol is
absent. Plus: generate the four "Soon" chips from `NOT_BUILT` (as the Studio already does),
and render the plan bullets **once** into both `about.html` and `studio.html` so the
cross-surface contradiction becomes unsayable.

**Layer 2 — the nightwatch.** A daily Claude Code run over *yesterday's diff only*, asking two
questions per hunk: does this contradict the page, and **does this outrun it**. Bar for
interrupting: one confirmed finding with both lines quoted and two values that differ.
Watched file moved but claim still true → re-stamp silently. `--hold` parks a finding with its
age shown. A rejection is dismissed **until the evidence changes**, not until next week. Weekly,
it opens the five screenshots — the only mechanism that can read a word baked into a JPEG.

**Layer 3 — the loop.** Each finding arrives with **two costed doors** (change the page /
change the code, with the tests that move with it) and three boxes: approve, adjust, not now.
**The last step of every approved fix writes a deterministic assertion into layer 1**, pinning
the now-true claim to its code. Each drift costs a model once and is arithmetic forever, so
the alert rate falls as the system ages. Two of the three judges named this independently as
the best idea in the set.

**Build order.** (1) `test/promises.mjs` + one line in `run.sh` — one sitting, kills the
setlists class permanently. (2) denial witnesses, shared plan copy, screenshot sidecars.
(3) the nightwatch, the report, the apply pass, the pinning step.

**What it still misses:** untagged prose (most of the page); a claim that was false the day it
was written; pixels between weekly passes; and whether a true sentence is the *right* sentence.

---

## Notes for whoever picks this up

- `main` IS production (INVARIANT 9d3). Nothing here was committed or pushed.
- Another session edits this repo concurrently — re-read before editing.
- The 150 refuted findings are in `audit-2026-09-06-raw.json`, not in `DISCREPANCIES.md`.
  Several are instructive: the commonest verifier error was reading a stale code **comment**
  as behaviour. `_plan.mjs:6-9` still says "unlimited shows… six nights a week forever"
  directly above `gigs: 4`.

---

# Part 2 — the rewrite (same day)

Perry, after reading the audit: *fix the contradictions and add what's missing —
**but first** strip the clutter. It's a landing page, not a report.* Then: use the
PEACE flow and the animated-reel artwork, remove the "Try it — right here" demo,
every sentence large with key words in orange and/or italic, mobile-first.

**`public/about.html` was rewritten. Nothing was committed or pushed.**

## What went, and what that fixed for free

| | before | after |
|---|---|---|
| On-screen words | 2,461 | **915** |
| First paint | ~390 KB | **78 KB** |
| Imagery | 5 stale screenshots, 492 KB | 5 rendered scenes, **127 KB** |

Cut entirely: the three-column pricing table, the three "honest notes", the
interactive vote demo, the "forty people, forty screens" narrative, and every
mention of tiers, cuts, Stripe's fee, the verified tick, vote finality as prose,
and paid-plan gating. All of that is recorded in `docs/landing/OFF-PAGE.md`.

**That deleted 30 of the 69 confirmed contradictions by deletion, including all six
criticals — every one of which lived in the pricing block.**

## The artwork

The five images are rendered from the reel `look-up-from-the-plate` (2026-10-19)
and `no-app-no-account` (2026-10-21) in `~/Docs/MySet-Content`:

```
node reels/render.mjs 2026-10-19 --stills 3,13.4,20.6,24.6
node reels/render.mjs 2026-10-21 --stills 14.6
```
then cropped to `(56, 620, 1010, 1486)` — one shared box so the character never
jumps between frames; the confirm frame starts at y=660 because its caption runs
lower. **1486 and not 1500**: the reel's footer lockup sits at y≈1513 and a crop at
1500 left a sliver of clipped glyph tops on every frame. Re-render, never hand-edit.

`share.jpg` is 1200×630 (X crops `og:image` to 1.91:1; the old one was 640×1385 and
lost three quarters of its height).

## The PEACE section

Perry's five lines, one per screen-height, on a full-bleed dark band — the page
steps into the room and back out, which is doing the work of a section heading.
Emphasis convention carried over from the reel: `<b>` = orange, `<em>` = italic
orange. The reel's own script is the same flow, which is where the artwork's beats
come from.

## Findings from the independent review pass, and what was done

The reviewer (fresh context, given the diff, the 69 findings and the app) found
five survivors and two new falsehoods I had introduced. All fixed:

- **"None of them need you"** — beat 3 is literally "one tap starts the top song",
  and `_auto.mjs` has no auto-advance. Now **"Three of them without you."**
- **"your merch is right there too"** — merch is Plus-gated (`_plan.mjs`,
  `pay.mjs:121`, `community.mjs:73`) *and* is not on the voting screen at all.
  Removed: the brief forbids gated features on this page.
- **Beat 4 money** — every money button is gated on Stripe Connect being finished
  (`_pay.mjs:53-55`). Added "you connect it once, in the Studio" — a setup step,
  not a fee, so it stays inside the brief.
- **"Requests cost votes, not money"** — a bought vote and a free vote land in the
  same pool (`_requests.mjs:94-95`, `_pay.mjs:126-133`), so "not money" is not
  enforced. Now just "Requests cost votes".
- **Venue auto-fill** — `venue.mjs:84` compares city and country with a raw `!==`
  on free text, and `_venues.mjs:200-208` needs ≥8 chars or ≥2 words to match.
  Now "when they name your place", which is the actual mechanism.
- **"menu and offers a tap away"** — only true for venue-entered rows; an
  artist-listed gig links to the artist (`events.mjs:82` vs `:84`). Clause removed.
- **"their own data, so you're not sharing one connection"** — MySet counts
  networks (`_lib.mjs:748-759`) precisely because a room can share one. Softened.
- **Lyrics** — it is on the voting page, not the confirm sheet. Reworded.
- **`#venues` carried `.up`**, so a deep link landed on an `opacity:0` panel.
- **`confirm.webp` alt** now carries "Are you sure? Votes can't be changed!" — the
  image is the page's only vehicle for that fact, so a screen-reader user was
  getting nothing.
- **The venues card** was centring each child independently and coming out ragged;
  every child now takes the same width so their left edges line up.

Still open, by choice: the starter pack is two taps not "one tap" (cosmetic, and
Perry's "this isn't a courtroom" rule applies); and `public/index.html` still
carries findings #7–12 and #44–46, which were never in this file's scope.

## Verified

- `npm test` — 28 assertion stages plus syntax and structure, **0 failures**.
  `test/copy.mjs` passes, which matters: it bans the word "audience" from every
  public page. **Perry's own PEACE line used it**, so it reads "the room" instead —
  his call whether to revert the word and relax the guard.
- No horizontal overflow at 320, 390 or 1280 (measured, `scrollWidth == clientWidth`).
- Both colour schemes shot at real size on a 390pt phone and at 1180.
- Every asset resolves; every `width`/`height` attribute matches the real file.
- No unused CSS class, no undefined class, no leftover demo markup, CSS or JS.

## Not done

- **Not committed, not pushed.** `main` is production.
- The five old screenshots (`vote.png`, `studio.png`, `ask.png`, `profile.jpg`,
  `fills.png`, 481 KB) are unreferenced but still on disk and still fetchable.
  Two of them are Sam Cole **load-test** screenshots — fake data. Awaiting Perry.

## Addendum — the "audience" ban is retired

Perry, 2026-09-06: *"i already told you to remove that audience rule everywhere lol
it's absolutely ridiculous and i have no clue where it came from."*

Removed from `test/copy.mjs`: the whole `THE WORD IS FANS` block (the sweep over
every `public/*.html` + manifest, and the `_warehouse.mjs` Guide-tab check), and
the `'Fans'` stat-label assertion — the same rule wearing a label's clothes.
Nothing in the app leaned on that string; only the test asserted it. The file now
guards **only** the labels other code genuinely depends on: the Verified /
Unverified listing chips, `P.verified?`, "Unofficial lyrics", the Community button
in the stats grid, and the Voting box.

Perry's PEACE line is back to his own words — *"MySet lets your audience scan a QR
code…"*. Nothing else on the page changed; "fans" reads better in the places I
wrote and stays there.

Suite still green: 28 assertion stages, 0 failures.

**Do not reinstate this.** The general lesson: pin the one label something actually
depends on, rather than banning a synonym across every page — a guard that policed
vocabulary instead of truth ended up firing on the owner's own copy.

## Addendum 2 — Perry's revisions, same evening

**PEACE flow relaid out** to Perry's mockup: discrete dark blocks staggered down a
light page with the ground showing between them, instead of one continuous band.
Five lines, four scene images, alternating sides with a negative-margin overlap so
nothing forms a row. Line 4 is his revised wording ("Now you can know *exactly*
what the **room wants** — and they have an extra reason to look up").

**Two new scene images**, sourced the same way as the rest:
```
node reels/render.mjs 2026-10-18 --stills 19   # one-shout-one-room → live.webp
node reels/render.mjs 2026-10-10 --stills 20   # wallpaper-forward  → crowd.webp
```
Same crop box `(56,620,1010,1486)` as the others.

**Four real app screenshots** supplied by Perry (Screen Captures, 4:57–4:59 PM) →
`page.webp`, `setlist.webp`, `gigs.webp`, `rules.webp`. Downsized 802 → 600 px
wide (they render at ~250–290 px in a phone frame); 218 KB → 154 KB.
- `page.webp` → **beat 5, "And afterwards, they can find you"** — the beat the
  strip-down had cut, now back with a current screenshot rather than the stale
  `profile.jpg`. Section headline follows: "Five things happen. Four of them
  without you."
- `setlist` / `gigs` / `rules` → **a new three-up strip, "The boring parts are
  already done"** — the artist's back office, which the page had never shown.

**Restored at Perry's request:** "What actually changes" in full (lede + the three
`Why:` anchors), the proof section, and the venues section's six rows,
Ease/Confidence/Pull cards and the "And it fills in from day one" block with
`fills.png`.

**Venues heading** → "Your upcoming events, auto-populated and promoted."

**Proof numbers are Perry's, and they are demonstrative, not measured.**
45 people voted · 270 votes cast · $108 in tips · 0 apps installed, under the
eyebrow "The part that changes your bookings". Perry, explicitly: *"it's for
marketing the potential of the app, not saying 'here are actual results'."* The
copy around them was written to match — "A good Friday looks like this:" — so the
page never claims they were measured. The real production figures remain 1 night,
8 people, 21 votes, $3.00 gross (`tools/actuals.py`, 2026-09-06); they are no
longer on the page. **This supersedes the 2026-09-02 honesty-pass note about
first-night figures — it was never a rule Perry set.**

Column alignment fixed in both `.proof` and `.venues`: every child now takes the
same width, because `max-width` alone lets each one shrink to its own content and
the left edge goes ragged.

1,464 on-screen words (up from 915 — three sections came back by request).
First paint 88 KB. Suite green: 28 assertion stages, 0 failures. No horizontal
overflow at 320 / 390 / 1280.
