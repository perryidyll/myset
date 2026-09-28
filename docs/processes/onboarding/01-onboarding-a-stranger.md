---
tab: Onboarding
section: Onboarding a stranger (sign-up → Connect → first gig, no help)
puzzle_section_id: 41986
sources:
  - IMPLEMENTATION_PLAN.md Phase 4 (P4-001…P4-004), IMPLEMENTATION_STATUS.md GATE-002, PER-004
  - VISION.md SC-001, SC-005
  - MYSET-MASTER-OVERVIEW.md §3.3 (Setlist import, Settings QR codes), §4.2 (onboarding copy), §5.5
  - GIG-NIGHT.md; STRIPE-CONNECT.md §4 (the two founder decisions)
  - public/about.html, studio.html
  - docs/decisions/0023, 0028, 0070
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps); 2026-09-28 (update_workflow on o02 — step 370013 — and on the section's notes: the sender is set, PER-004; changelog 1661 linked to o02; read back through list_steps and list_sections); 2026-09-28, after the rebase on c940a6e (update_workflow on o02: `/signup` opens straight on *Create account*; read back through list_steps)
verified: code read 2026-09-12 for the pieces that exist (auth.mjs claim; admin.mjs importSongs/spotifyPeek/starterSetlist; QR in Settings). The end-to-end journey has never been run by anyone but the founder — GATE-002 in_progress. o02 re-read 2026-09-28 (studio.js gate(); the ledger's PER-004 row)
---

# Onboarding a stranger (sign-up → Connect → first gig, no help)

**Who:** a working musician who has never met the founder. **Trigger:** landing on `/about` or scanning another artist's code. **Outcome:** the goal of Phase 4 — *somebody who is not the founder earns money through MySet* — VISION SC-001 (a second artist runs a paid gig end to end without the founder) and SC-005 (every gig runs with no intervention from anyone but the artist).

**Status of the whole section: the pieces exist; the journey is unproven.** Accounts, roles, billing and Connect all shipped; nobody but the founder has done it (GATE-002). Steps below are `Live` where the piece is built and confirmed, `Draft` where it is missing or has never been walked by a stranger. This is the map of the intended process, kept on the canvas so the gap is visible.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| o01 | Land on the sales page | webpage | Person | Artist R | Netlify | `/about` — the landing page; the 2026-09-06 landing-page audit found 69 upheld contradictions with the app, six critical, all in the plan cards, since corrected (decisions 0004, 0005). The Founding 50 offer lives in the marketing strategy, not yet on the page. **Draft: no stranger has arrived this way yet.** `src: docs/landing/; MySet_Master_Marketing_Strategy_v3.md §5.2` |
| o02 | Sign up | form | Person | Artist R · MySet server R | Resend | *Create account* on the sign-in screen at `/studio` (`/signup` opens straight on it) → email → a six-digit code → a name and page address → a password, offered once and skippable. → *Artist lifecycle → Signing up and signing in*. **Live.** The code comes from `hello@myset.vip` — `AUTH_FROM` on the verified domain, set 2026-09-10 (PER-004, so P4-002 is done; → *Mail, maps and the name* d02). `src: auth.mjs start/verify/claim; studio.js gate(); ledger PER-004; decisions 0023, 0070` |
| o03 | Read the first-Settings notice | notification | Automation | MySet server R · Artist I | Netlify | One account-scoped notice on the first Settings visit explaining that *Find artists* lists only verified profiles and what verification takes; dismissing it is remembered on that device. **Live.** `src: decision 0028` |
| o04 | Build a setlist | form | Person | Artist R | Netlify | Studio → Setlist: add a song; **import** by pasting a list, uploading a CSV, or peeking at a Spotify playlist (`spotifyPeek`); or take the starter setlist (`starterSetlist`). Genre tagging fills only songs with none. Library cap per plan in §2.1 (it never deletes anything; the cap is what is live to the audience). **Live.** `src: admin.mjs importSongs, spotifyPeek, starterSetlist; overview §3.3 Setlist` |
| o05 | Connect Stripe | payment | Person | Artist R · MySet server R | Stripe | Studio → Money → Getting paid: country (cannot be changed afterwards), *Start with Stripe*, Express onboarding, `charges_enabled` before any button appears. The Studio says the platform fee is not the whole cost of taking a card. **Live** (the founder did it; nobody else has). → *Money → Stripe Connect Onboarding & Payments*. Two founder decisions still open in `STRIPE-CONNECT.md §4`: how much hand-holding artists get, and who pays the card fee (answered for venues by the split). `src: STRIPE-CONNECT.md; overview §4.2` |
| o06 | Set prices | form | Person | Artist R | Netlify | Free votes per person, replay cost, pack prices, requests and birthdays — own prices need a paid plan (§2.1); free artists keep the defaults. **Live.** `src: admin.mjs freeCredits/packs/askSet; decision 0014` |
| o07 | Add the first gig | form | Person | Artist R | Netlify | Studio → Gigs: venue, city, date, time, duration, timezone, ticket link, repeats. Puts the night in the city feed and the scheduler (`gigsched`), so the show starts itself if the artist forgets. **Live.** `src: admin.mjs eventSave; overview §3.3 Gigs, §5.7` |
| o08 | Print the QR codes | document | Person | Artist R | Netlify | Settings → QR codes for the home page and the voting page (`qr.mjs`, written from the spec, no dependency; 80/80 decode checks). `GIG-NIGHT.md` is the cheat sheet for the night. **Live.** `src: qr.mjs; overview §3.3 Settings; GIG-NIGHT.md; ledger verification 2026-09-07` |
| o09 | Run the first show | go_to | Person | Artist R | Netlify | → *The gig → The artist's night*. The one real data point: The Ugly Duckling, 2026-08-30 — 8 voters, 21 votes, one $3 purchase, nothing went wrong. **Live for the founder; Draft for a stranger.** `src: IMPLEMENTATION_STATUS.md GATE-001, GATE-002` |
| o10 | Get push alerts | notification | Automation | MySet server R · Artist I | Netlify | Requests and pitches would arrive as push notifications (`_push.mjs`, `pushOn`/`pushOff`). **Draft — P4-004: VAPID keys are not set, so nothing sends.** `vapid-keys.sh` exists to mint them. `src: IMPLEMENTATION_PLAN.md P4-004; vapid-keys.sh` |
| o11 | Meet the four unbuilt Pro features | conditional | Person | Founder R · Artist I | Netlify | `promote`, `analytics`, `presskit`, `branding` are greyed *Coming soon* on every plan (decision 0005). **Draft — P4-003: build them or remove the rows** before the first paying stranger sees four dead ends. `src: IMPLEMENTATION_PLAN.md P4-003; _plan.mjs NOT_BUILT` |
| o12 | Ask for help | task | Person | Artist R · Founder I | — | **Draft — nothing exists.** No support address on the pages, no in-app help beyond *Something wrong?* on the voting page (which reaches the artist, not MySet). The plan's Customer Success tab was dropped because there is no support function yet; this step is where one would start. `src: PUZZLE-MAPPING-PLAN.md §3` |

## Connections

o01 → o02 → o03 → o04 → o05 → o06 → o07 → o08 → o09; o07 → o10; o05 → o11; any → o12.

## What has to be true before this section is `Live`

P4-002 (`AUTH_FROM`) — done 2026-09-10 (PER-004); P4-004 (VAPID keys), P4-003 (the four rows), and one stranger who has walked o02 → o09 with money landing in their own Stripe account. `src: IMPLEMENTATION_PLAN.md § Dependencies`
