# Implementation plan — MySet

**Related:** `VISION.md` (scope filter) · `IMPLEMENTATION_STATUS.md` (current truth) ·
`docs/decisions/` (why) · `INVARIANTS.md` (what must not break)

This document is the roadmap. **Execution state lives in `IMPLEMENTATION_STATUS.md`** —
if the two disagree, the status ledger is right.

Phases 0–2 are complete and are recorded here so a fresh reader can see the shape of what
was built and in what order. The live work is Phase 3.

---

## Phase 0 — One artist, one room *(complete)*

**Goal:** a real audience votes at a real gig.

| ID | Deliverable | Exit criteria |
| --- | --- | --- |
| P0-001 | Voting page, no sign-in | A stranger scans a code and votes within ten seconds |
| P0-002 | Artist Studio, runnable on stage one-handed | A show starts, songs play, the show ends |
| P0-003 | Lossless concurrent voting | 80 simultaneous voters, zero lost votes |
| P0-004 | Payments through Stripe | A vote pack is bought and delivered |

**Exit evidence:** The Ugly Duckling, Koh Phangan, 2026-08-30 — 8 voters, 21 votes, one
$3 purchase, nothing went wrong.

---

## Phase 1 — A product, not a tool *(complete)*

**Goal:** everything around the gig that makes it worth $10 a month.

| ID | Deliverable | Exit criteria |
| --- | --- | --- |
| P1-001 | Artist public page, gig calendar, city feed | An artist's page stands on its own |
| P1-002 | Venue side and the artist↔venue marketplace | A venue lists nights and receives pitches |
| P1-003 | Community pages with photos and clips | A fan posts about a night without signing in |
| P1-004 | Plan ladder, enforced server-side | Free / Plus / Pro differ where the server refuses |
| P1-005 | Stripe Connect, direct charges | Money lands in the artist's own account |

---

## Phase 2 — An account somebody can own *(complete)*

**Goal:** a second artist could sign up without Perry in the room.

| ID | Deliverable | Exit criteria |
| --- | --- | --- |
| P2-001 | Sessions, roles, recovery codes, sign out everywhere | A member cannot take the account |
| P2-002 | Self-serve billing, upgrade, downgrade, leave | A plan changes without a human |
| P2-003 | Books and statements from Stripe's own ledger | An artist can file a tax return from it |
| P2-004 | Export and a 30-day undoable delete | An account can leave with its data |
| P2-005 | Verification that mostly needs no human | A tick is granted from Stripe's own KYC |

---

## Phase 3 — Scale preparation *(current)*

**Goal:** the app stops breaking before the bill does, and a bug can be diagnosed after
the night it happened.

| ID | Deliverable | Exit criteria |
| --- | --- | --- |
| P3-004 | **Error tracking that outlives the night** | A reported bug can be found without reproducing it |
| P3-007 | **A rate limit on casting** | A script cannot burn reads indefinitely |
| P3-001 | **The shared-board split** | The audience poll stops re-reading the whole room |
| P3-005 | A measured write ceiling | The fan-shard wall is known, not derived from a read |
| P3-003 | Clip bytes onto Cloudflare R2 | Serving a clip costs nothing |
| P3-002 | An open line to the room | The board reaches every phone the instant it changes |
| P3-006 | `AGENTS.md` + a ledger on every project | Any model can pick up any project cold |

**Ordering is deliberate and is argued in `docs/reports/open-line.html`.** The open line
is last of the engineering items even though it is the best end state, because it adds a
platform and the four before it buy most of the same headroom without one.

**Gate:** do not raise the plans' room sizes until P3-001 lands. The caps are set by what
the app can serve, not by what the margin could afford.

---

## Phase 4 — The second artist *(not started)*

**Goal:** somebody who is not Perry earns money through MySet.

| ID | Deliverable | Exit criteria |
| --- | --- | --- |
| P4-001 | Onboarding a stranger can complete alone | Sign-up → Connect → first gig, no help |
| P4-002 | Sign-in mail from a myset.vip address | `AUTH_FROM` set, domain verified |
| P4-003 | The four unbuilt Pro features, or their removal | `NOT_BUILT` is empty, or the rows are gone |
| P4-004 | Push alerts actually sending | VAPID keys set |

---

## Dependencies

- P3-002 (open line) depends on P3-001 (shared board) and on the Cloudflare account that
  P3-003 opens.
- Raising `PLANS.*.audience` depends on P3-001.
- P4-001 depends on P4-002 — a stranger will not trust a sign-in mail from a shared
  address.

## Out of scope for this plan

- Native apps. Audio playback. A social graph. Ticket sales.
- Multi-region deployment — one region is correct until there is a reason it is not.
- Anything that requires the audience to sign in, ever.
