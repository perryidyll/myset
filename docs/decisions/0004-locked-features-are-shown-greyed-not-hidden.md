---
id: 0004
title: A feature you have not paid for is shown, greyed out — never hidden
date: 2026-09-03
status: decided
decided_by: perry
area: plans
invariants: [0ad, 0bx0, 0bx1, 0bx2]
commits: []
tests: [test/limits.mjs]
files: [public/lock.css, public/studio.html, public/venue-studio.html, netlify/functions/_plan.mjs]
---

## The question

When an artist on Free opens a control that only Plus can use, what should they see?

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen. Show it, greyed, named** | *"Plus feature"*, tappable veil that scrolls to the plan cards | Two lock states to maintain, and a rule about which | `lock.css`, `has()`/`needsPlan()`/`lock()` in both Studios | Greying something the server actually allows — a lie in the other direction |
| B — hide it | Cleanest screen | An artist never learns what paying buys | none | No upgrade path in the product itself |
| C — leave it tappable and let the server refuse | What was actually happening | A 402 with no explanation — the exact shrug INVARIANT 0ad exists to prevent | none | The artist thinks it is broken |

## What was chosen, and why

A, Perry's call. An artist on free should be able to see what paying gets them. It also
fixed a real shrug: the Studio's pricing controls were fully tappable on free and the
server refused them.

**Two states, and the difference is honesty.** `.lock` means built, and a higher plan
turns it on — it names the cheapest plan that has it. `.lock.soon` means designed and
not built: greyed on **every** plan including Pro, not tappable, reads *"Coming soon"*
(see decision 0005).

`pointer-events: none` on the greyed content is the lock; opacity is only how it looks.
A lock that is only opacity is not a lock, and there is a test for it.

## What this makes harder

Three near-misses an independent review caught in the first pass, all now invariants:

- The **plan cards** — the page where somebody decides to spend $20 — were the last
  place still selling four unbuilt Pro features as included.
- `unlimited` has **no plan gate at all** ("everyone votes as much as they like" is
  running your show, not pricing it), and one `lock('pricing')` around the whole
  free-votes block quietly took a working control off every free artist. **Greying
  something that works is the same class of lie as showing something that doesn't.**
- `has()` treats an unknown plan as allowed so there is no grey flash — which meant the
  first render of Settings showed every locked control live and tappable until the plan
  arrived. `planGet` is now fetched on first load, not only on the Settings tab.

And **a numeric limit is not a yes/no**: `photos` is 3 or 12, `featured` is 50 or
unlimited, so `limits[flag] === true` was false for both and a Pro venue saw a dash
beside twelve photo slots it fully had.

## What would reverse it

Nothing foreseeable. It is a taste decision Perry made and it has held.

## How it was verified

Computed styles read in a real browser — which is how the first version was caught
doing nothing at all: the CSS was written into `app.css`, and neither Studio loads
`app.css`.
