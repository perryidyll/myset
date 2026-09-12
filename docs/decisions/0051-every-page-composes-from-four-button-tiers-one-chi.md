---
id: 0051
title: Every page composes from four button tiers, one chip recipe and a written design system
date: 2026-09-12
status: decided
decided_by: claude
area: ui
reverses:
superseded_by:
invariants: [0f0, 0f1, 0f2, 0bx, 0by]
commits: [5b4a531]
tests: [test/limits.mjs, test/copy.mjs, test/darkroom.mjs, test/decline.mjs, test/structure.mjs, tools/uicheck.mjs, tools/sheetcheck.mjs]
files: [public/app.css, public/lock.css, docs/design-system.md, public/artist.html, public/community.html, public/venue.html, public/vote.html, public/studio.html, public/venue-studio.html, public/index.html, public/artists.html, public/about.html]
---

## The question

The second Airbnb-dive batch touched every page at once — a pinned pill on the artist page, a proof carousel, a dock state line and a review sheet on the vote page, a composer sheet and a proof rail on the community page, a listing layout on the venue page, bottom tabs and a first run in both Studios, icons on `/about`. Before it, `app.css` knew two buttons (the gradient pill and the plain surface pill) and no chip at all. Every next step, every "Show all", every "Not yet" and every small pill was invented on the page it sat on, and the survey that mapped the batch counted them: chips with a hairline and no shadow, chips with a shadow and no hairline, chips filled with the gradient, `.btn-ghost` (a visual no-op), `.go2`, `.filtertoggle`, `.am`, `.step`, and the two Studios' own `.chip` and `.big` families. Nine agents were about to add controls in parallel; without a shared recipe first, the batch would have added nine more variants.

There was also a paper problem. The only design document in the tree, `design-handoff/` (git-ignored), describes a product with zero border-radius, a four-tab fan app with a sign-in and a role switch, boost sheets and Apple Pay — none of which is MySet. Nothing said what *was* the system, so every agent read it out of the CSS and the pages, and no two read the same thing.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Four tiers in `app.css` (`.btn-pri` commit, `.btn-ink` next step, `.btn-grey` secondary, `.btn-text` tertiary) composed on the existing `.btn`; one `.chip` recipe (hairline + `--sh-1`, `.on` = accent ring never a fill); a `.fab` pill; the same tiers written a second time in `lock.css` for the Studios, which never load `app.css`; a bottom tab bar recipe in `lock.css`; and `docs/design-system.md` quoting every value from the file it lives in | ~90 lines of CSS twice; every rule now exists in two files that must be changed together; four pages carry a third, private copy (see below) | `.btn-ink`, `.btn-grey`, `.btn-text`, `.chip`, `.fab`, `.tabbar`, `.menurow`; one document | a recipe edited in one file and not the other — the exact failure the lock rules had in 2026-09-03; caught only by measuring computed styles in a browser |
| B | One stylesheet for every page, the Studios included | the Studios are self-contained pages with their own token blocks and a different `--maxw`; folding them in is a rewrite of two 4,000-line pages | none new, one fewer | a Studio regression in the middle of the batch, on the page the artist runs the show from |
| C | Tiers only, no document; let the CSS comments carry the reasons | nothing on paper about *when* each tier is used or what the handoff got wrong | none | the next agent reads `design-handoff/` first, because it is the only document with "design" in its name, and builds the four-tab fan app |
| D — do nothing | each page keeps inventing its own controls | nothing today | none | the ninth variant of a chip, and a fan page that looks like four products |

## What was chosen, and why

A. The tiers had to land *first* so the rest of the batch could consume them instead of inventing — the integration map (`gaps.md` I-27) put it upstream of I-05, I-16, I-17 and I-25 for that reason. Two files rather than one because the Studios' independence is older and deeper than this batch: they carry their own tokens, their own reset and a different column width, and `lock.css` already existed as the one file both Studios share (INVARIANT 0bx's lesson, written into `lock.css:11–15`). The chip's on-state is a ring rather than a fill because a filled chip reads as a button, and the vote page's genre bar had exactly that confusion. The document exists because the reasons for the tiers are not in the CSS — *when* to use `.btn-ink` rather than `.btn-pri` is a product rule, not a style rule — and because something had to say in plain words that `design-handoff/` is superseded.

**What happened in the middle, and what it changed.** While the batch was in the working tree, another session pushed `5b4a531` (16:29), which swept the four fan pages — `artist.html`, `vote.html`, `community.html`, `venue.html` — to production while `app.css` and `lock.css` stayed unpushed. For that interval the live artist pill was two lines of plain text under the footer, the community rail and the venue's "Sent — waiting to hear back" pill were bare text, and "Not yet" was a second filled pill under Confirm. The fix each reviewer asked for is now the rule: **a page never references a class that is not in the same commit as the stylesheet that defines it, and a page that must ship first carries a byte-identical copy of the recipe it uses.** The four copies are at `artist.html:132–148`, `community.html:127–141`, `venue.html:228–244`, `vote.html:381–385`, each with a comment saying why. This is a third place the recipe lives, and it is deliberate.

## What this makes harder

A change to any shared recipe is now a change in two files and up to four pages, and nothing but `grep` and a browser enforces that they agree — `test/limits.mjs` pins that the lock rules live in exactly one file, but no test diffs `app.css` against `lock.css` or against the page copies. The Studios' own `.chip.on` still fills with the gradient (`studio.html`, `venue-studio.html`) because `lock.css` loads after their inline styles and cannot take the on-state without also taking their sizes; moving them to the ring is two page edits that were not in this batch. The `design-handoff/` folder is git-ignored, so its superseding banner reaches nobody who clones the repository; the document has to say so itself. And every line number in `docs/design-system.md` is a promise that goes stale the moment a file is edited above it — the document's own rule is that a wrong reference is the document's fault, not the file's.

## What would reverse it

The Studios loading `app.css` (option B) — then `lock.css` shrinks back to the lock rules and the tab bar and the second copy of the tiers goes. A build step, which AGENTS.md forbids today, would let one source produce both files and the page copies. A fifth tier being needed more than twice would mean the four were wrong. A measured contrast or tap-target failure on a real phone for any tier in either theme. And if `tools/overview.mjs` ever learns to read CSS tokens, the token tables in the document should be generated from it rather than quoted.

## How it was verified

`sh test/run.sh` after the CSS landed: every suite `N passed, 0 failed`, final line `44 passed, 0 failed` (the tiers agent; no test changed). `test/limits.mjs` still finds `.lock>.lockin` in `lock.css` only and the `<link>` in both Studios. Each consuming page was then rendered in headless Chrome at 375×812, light and dark, by its own agent: the artist pill computed `position:fixed`, surface fill, 999px radius, no horizontal overflow, with the tier drawn from the page's own copy against the *live* `app.css` (which lacks the tiers); community chips measured `padding 9px 14px`, a `.5px` hairline, `--sh-1`, and `.on` = accent-soft ground + 1.5px accent inset ring in both themes; the venue's three page copies were diffed block-by-block against `app.css` (identical); the vote sheet's "Not yet" measured `background none`, `box-shadow none`, accent-ink text against origin/main's stylesheet; `.btn-text` in the Venue Studio measured `rgb(255,55,95)` light / `rgb(255,69,110)` dark after the `--accent` fallback (it was the dark pink on both grounds before). `node tools/uicheck.mjs` 113 ✓ / 0 ✗ and `node tools/sheetcheck.mjs` 12/12 on the final tree (the vote and Studio agents). The session note `docs/sessions/2026-09-12-airbnb-batch-two.md` has every command and line. NOT checked: any of it on a physical phone, or `color-mix` (used by `.btn-grey`) in a Safari older than the one on the founder's phone.
