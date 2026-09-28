# 2026-09-12 — Puzzle mapping: drift fix, then Phase 3 (Accounts & venues)

**Asked:** explain the two Draft steps on the Money tab; continue with Accounts & venues; and make it a standing rule that the Puzzle maps are updated in tandem with the master overview for anything that warrants it.

**Working tree at start:** clean — the other sessions had committed and pushed (`425fb0a`), including the `docs/processes/` files from the earlier mapping sessions.

## The standing rule

Recorded in the agent's memory (`always-update-puzzle-with-the-overview`) and in `docs/processes/CONVENTIONS.md § Keeping it true`: any session that changes behaviour, copy, a rule, a cited number, a decision or a surface updates the affected sheet and its Puzzle section **in the same session**, and every new decision record gets a changelog entry the same day. "Does Puzzle need updating?" is a mandatory handoff question. Not yet in `AGENTS.md` — that is Phase 10 of the plan, and `AGENTS.md` was being edited by another session today.

## Drift fixed first (the rule applied to `425fb0a`)

The commit renumbered decisions (ten shows → 0037, splash → 0038, between-shows countdown → 0039; 0035 is now the measured open line, 0036 the interactive map), changed sign-in to email + code, folded Merch into Profile, added the three-hour wrap-up and the *Next show* countdown, and demoted "a vote never comes back" from a hard rule to today's behaviour. In Puzzle: nine steps and three section notes updated (`f02`, `f14`, `f18`, `f20`, `a01`, `a04`, `m01`, `m07`, `l11` now *In progress*); changelog bodies for 0001, 0003, 0012 and the ten-shows entry corrected; 0035, 0038 and 0039 added and linked. The sheets carry the same edits.

## Phase 3 shipped

| Tab | Sections (Puzzle id) | Steps |
| --- | --- | --- |
| Artist lifecycle | Signing up and signing in (41978) · Sessions, roles and the team (41979) · Recovery and moving your address (41980) · Verification and the tick (41981) · Leaving, with thirty days to change your mind (41982) | 44 |
| Venue lifecycle | A venue's page, from claim to listing (41983) · Getting verified — three ways (41984) · Pitches (41985) | 28 |
| Onboarding | Onboarding a stranger (41986) — `Live` where the piece exists, `Draft` where it is missing or never walked by a stranger (GATE-002) | 12 |

Changelog: 0023, 0024, 0028 added (1612–1614) and linked. **31 of 39 decision records are now in Puzzle**; still unloaded: 0011, 0015, 0020, 0022, 0025, 0027, 0033, 0036 (all Community & media or UI — next phases).

## Found on the way

- **`VERIFYING-A-VENUE.md` is stale on the vouch count**: it says ten; `_verify.mjs` has `MIN_VOUCHES = 3` and the overview agrees with the code. The sheet and Puzzle cite the constant. Fixed later the same day at the founder's request: the page now cites the constant instead of a number (the constant moved in `190e2b4`, 2026-09-02).
- The "Lost everything?" recovery case (no inbox, no codes, no passkey) has no rehearsed founder procedure — same shape as the ledger's *nobody has tested a restore* risk. On the canvas as `Draft`.

## Verified

Read-back of *Getting verified* through `list_steps`: 9/9 steps, every branch labelled, statuses as written. Every refusal, role set and constant in the sheets was read from `auth.mjs`, `_session.mjs`, `_account.mjs`, `_verify.mjs`, `_pitch.mjs`, `venueauth.mjs`, `venueadmin.mjs`. Not run: the test suite (no code changed). Not checked: the canvas in a browser (the founder's step).

## Ledger rows

| ID | Work item | Status | Evidence |
| --- | --- | --- | --- |
| DOC-005 | Drift fix for `425fb0a` in Puzzle | done | nine steps, three section notes, seven changelog entries; sheets under `docs/processes/the-gig/` and `money/` |
| DOC-006 | Accounts & venues (Phase 3) | done — awaiting the founder's browser check | nine sheets; Puzzle sections 41978–41986, 84 steps; changelog 1612–1614 |
| DOC-007 | Engineering OS (Phase 4) | not_started | sources `AGENTS.md`, overview Parts 5–7, `tools/`, `test/run.sh`, the `shipping-discipline` skill |

## Next

Phase 4, Engineering OS — the session workflow, deploy, hooks, tests, overview regeneration, decision records — the tab a new agent or hire would learn the repo from. Then Reliability & security, then Community & media.

## Later the same day — the endpoint, and the two findings

The founder signed into Stripe in the app's browser and asked for the endpoint to be done. On the MySet event destination (`we_1UACXQKFtJidxE16IAYdxfYN`) `charge.updated` **and** `account.updated` were added — the second because it was not there, though `ACCOUNTS.md §5` and the money sheets had listed it as present. Seven events now; read back after saving. PER-001 done.

**Found while there:** the destination listens to events from *Your account* only, and the edit screen shows no control to change it. Every branch of `webhook.mjs` guarded by `event.account` — the exact fee split, the `account.updated` flip of a room's money buttons, a direct-charge checkout on an artist's connected account — will never fire until a second destination for *Connected accounts* exists, with its own signing secret and a `webhook.mjs` that tries both. Nothing is broken today because every live charge is on the platform account (`tools/prod.py`: the founder's page has no Connect account). Recorded as PER-008 and ACCOUNTS.md §5 (5); the code change is not made — it is the money path, needs a decision record, and ends with a secret only the founder can paste into Netlify.

**The two findings, taken care of:** `VERIFYING-A-VENUE.md` now cites `MIN_VOUCHES` instead of a number (it had said ten; the constant moved in `190e2b4` on 2026-09-02). And *"Lost everything?"* has a written founder procedure in `ACCOUNTS.md §6.4` — identity proved outside MySet, the `byEmail` row and the account's `rev` changed in one `blobs:set`, never during a show, diffed afterwards — with the honest note that only the read half was rehearsed (`netlify blobs:get myset artists`, which also showed the founder's own account has **no `byEmail` row**; PER-009 makes attaching one the first rehearsal). The proper fix, an owner-only `ownerEmailSet`, is §10 item 6. Puzzle updated in tandem: steps 369874 (Live, with the Connect caveat), 369968 (procedure in the note, still Draft until walked), 370001, and the webhook section note.
