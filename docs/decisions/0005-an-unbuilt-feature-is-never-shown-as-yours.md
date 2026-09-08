---
id: 0005
title: A feature that does not exist is shown as "Coming soon" on every plan, including the one that supposedly has it
date: 2026-09-03
status: decided
decided_by: claude
area: plans
invariants: [0bx0]
commits: []
tests: [test/limits.mjs]
files: [netlify/functions/_plan.mjs, netlify/functions/_venues.mjs]
---

## The question

The plan ladder we sell names things that are not built: `promote`, `analytics`,
`presskit`, `branding` on the artist side; `tips` and `speakerVotes` on the venue side.
Perry is comped to Pro. Without something, he opens the Studio, sees four features
presented as his, and finds four dead ends — and so does the first person who ever pays.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen. A `NOT_BUILT` list, greyed as "Coming soon" everywhere** | One list, read by the Studio and by the tests | A list that could rot | `NOT_BUILT` / `VENUE_NOT_BUILT` | The list says built when it isn't, or unbuilt when it is |
| B — take them off the plan cards | Honest | We stop describing the product we are building toward | none | The Pro tier looks thin |
| C — build them | Ideal, eventually | Weeks, for features nobody has asked for yet | four features | Time spent on the wrong thing |
| D — do nothing | | Sells four dead ends to the first paying customer | | |

## What was chosen, and why

A. The list cannot rot in either direction: deleting a name from it is the **last** step
of building the feature, and `test/limits.mjs` asserts that anything **not** in the list
is genuinely enforced somewhere on the server. So a flag that is claimed and unenforced
fails the build, and a flag that is built and still listed shows as "coming" until
somebody removes it.

## What this makes harder

The plan cards describe a product that is partly aspirational, and that has to stay
visible in the copy — the landing-page audit on 2026-09-06 found 69 upheld
contradictions between the sales page and the app, six of them critical and all six in
the pricing block. This list is the mechanism that keeps the *Studio* honest; the
landing page needed its own pass.

## What would reverse it

The list emptying, when the four features exist.

## How it was verified

`test/limits.mjs`, which walks every plan flag and asserts enforcement or membership.
