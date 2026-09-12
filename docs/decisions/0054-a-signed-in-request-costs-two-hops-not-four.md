---
id: 0054
title: A signed-in request costs two hops, not four
date: 2026-09-12
status: decided
decided_by: perry-confirmed
area: performance
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/e2e.mjs, test/passkeys.mjs, test/accounts.mjs, test/structure.mjs]
files: [netlify/functions/_auth.mjs, netlify/functions/stage.mjs, public/studio.js]
---

## The question

With the Studio's page and script out of the way (0050, 0053), a fresh signed-in
open measured 0.94 s, and 0.83 s of it was `/api/stage` waiting for its first byte
— for a 15 KB answer. `planGet`, which reads two documents, took the same 0.82 s.
A common floor that size is not the reads; it is the number of times the function
waits on the blob store in a row. The chain was: read the auth secret → read the
artist registry (verify the token) → the stage batch → read the registry again for
the slug. Four sequential hops at 150–200 ms each from the function's region.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The secret is read once per warm instance; the registry is fetched in parallel with it; the slug lookup joins the stage batch; the Studio's boot screen no longer waits on the plan | none at runtime | a module-level memo | a rotated secret would be missed by a warm instance — but the secret is never rotated (sign-out-everywhere bumps `rev`, not the secret) |
| B | Move the functions to the blob store's region | a Netlify setting; the founder's call | none in code | fans far from that region get slower pages |
| C — do nothing | four hops per signed-in request | ~0.4 s on every Studio poll and every write's echo | none | none |

## What was chosen, and why

A. It is three small edits in the path every signed-in request already takes, and
it helps every authenticated call — stage, planGet, every admin write — not only
the Studio's open. B stays open as a separate, larger lever.

The fourth part is the founder's "step 4": the boot screen comes down on the stage
alone. `has()` now reads a plan that has NOT BEEN FETCHED as locked (INVARIANT 0ad
stays closed — a paid control is never live-and-402), and a plan that was fetched
and FAILED as allowed (bar wifi must not lock a paying artist out). In every
measured open the plan landed before the stage, so the visible change is nil; the
change is there so the boot never depends on it.

## What this makes harder

If the auth secret is ever rotated on purpose, every warm instance must be
recycled (a deploy does that) or it will keep verifying with the old one for its
lifetime. Say so next to any rotation.

## What would reverse it

A decision to rotate secrets on a schedule, or Netlify putting Blobs in the same
region as the function (then the hops stop costing and the memo stops mattering).

## How it was verified

`sh test/run.sh` — 40 files, 0 failed (the token suites mint and verify through the
memo; the stage suites read the slug from the batch). Production, signed in, after
the merge: the stopwatch's `stage` figure before and after is in the session note.
