# 2026-09-28 — The sheets and Puzzle say passwords exist and the sender is set

**Asked (the founder, the follow-up queued by PR #116):** make the process sheets and their Puzzle projection (workspace 13099) true about two things: passwords exist (decision 0070, ACCOUNTS.md §11, INVARIANT 0fu, and decision 0073, a password from a Studio-code session), and the sign-in sender is set (ledger PER-004, done since 2026-09-10: `AUTH_FROM` = `MySet <hello@myset.vip>`). Sheet first, then reload, then read back. Then read every section in the workspace back, diff it against its sheet, and list any other drift rather than fixing it blind.

**Changed (docs only, `[skip ci]`):**

- `artist-lifecycle/01` (section 41978): g01 describes the screen since 0070 (*Welcome back*, Email over Password, *Sign in*, *Forgot your password?*, *Create account*, the grey Studio-code link at the foot); a new step g10 *Sign in with a password*. The "Claim a sample page" row (step 389231) is left out on purpose: it waits for `feat/sample-profiles`.
- `artist-lifecycle/03` (41980): the Settings rows read *Password · set / not set* with *Create* / *Change*; a new step v08 *Set a password*, including 0073's branch for a Studio-code session.
- `the-gig/03` a01; `admin-and-finance/03` d01 (now `Live`) and d02 (brought up to Puzzle, which was already `Live`); `onboarding/01` o02 and the closing gate list (P4-002 done); `venue-lifecycle/01` n01 (the venue door has a password too); `reliability-and-security/03` j01 (it said everything but four secrets was unset; it now cites overview §6.3 instead of copying the count).
- Prose outside the sheets: ACCOUNTS.md §1 (the Sign-in and Studio-code rows) and §6.4; MYSET-MASTER-OVERVIEW.md §3.3 (Settings), §5.5, and the §8 known-gaps bullet on sign-in mail. Nothing that `tools/overview.mjs` generates was touched.
- Puzzle: steps 389481 (g10) and 389482 (v08) created; connections 435531 (g01 → g10) and 435532 (g10 → g05) created, 414126 (g01 → g02) labelled *Create account · Forgot*; `update_workflow` on steps 369943, 369796, 370272 (to `Live`), 370273, 370013, 369985, 370092 and on sections 41978, 41980, 41986, 41995, 42013. Changelog 1661 (0070) linked to g01, g02, g07, g08, g10, v08, a01, n01 and o02; 1664 (0073) linked to v08 and to h07 *Sync the voting sheet* (step 369938); both given the founder as owner.

**Verified:**

- Every reload read back through `list_steps` or `list_sections`, matching its sheet.
- Code read: `studio.js` `gate()`, `passwordSignIn()`, the *Signing in* rows, `openPasswordSheet` / `openPasswordFromCode`; `auth.mjs` `passwordSignIn`, `passwordSet`, `passwordClear` and `OWNER_ONLY`; `_cred.mjs` (`weakPassword`, `LOCK_TRIES` / `LOCK_FOR`); `venueauth.mjs` and `venue-studio.js`.
- `dig @8.8.8.8`: a DKIM TXT record at `resend._domainkey.myset.vip`, and SPF plus MX on `send.myset.vip`. The local resolver answered nothing.
- `sh test/run.sh` on the final commit, on top of `f364e51`: exit 0, 3,920 ✓, 0 ✗ (syntax OK, structure OK); again after the rebase on `c940a6e`: exit 0, 4,310 ✓, 0 ✗; again after the rebase on `20bd95e` (PR #127): exit 0, 4,310 ✓, 0 ✗; `node tools/overview.mjs --check`: current each time.

**Found in the read-back, not fixed:** see below. Four items first flagged as "Puzzle ahead" (t01, e06, y07, i06, on decisions 0099 and 0100) were only this branch's older base; after the rebase onto `b4d9ff5` the sheets match Puzzle. Two more closed while this branch waited: 41966 a02 (the first-gig card, the Tonight strip, the Example rows, the tip burst, Paid votes) and venue n12 *Change the page link* (step 389502, arrows 435550 and 435551) were reloaded by the sample-pages docs (PR #127); read back 2026-09-28.

**Wrong on both sides (check the fact first):**

- The push keys: o10 (41986), d06 (42013), j08 (41995), f06 (42005) and the overview's §8 bullet say `VAPID_*` is unset. The ledger's PER-004 row says an agent set them in production on 2026-09-15; no real push has been checked since.

**Wrong in Puzzle; the sheet is right (a reload fixes it):**

- Wrong ids: 42087 b02 and its section description, and 41964 f23, cite INVARIANT 0fv (it is 0fw); 41967 b05 cites decision 0063 (it is 0064); 41964 f22 says "the diary" where the sheet has the rename, "the gig list".
- 42869 The artist diary: no role and no tool on any step; d04 is named differently; the section notes lack "What is deliberately absent".
- 42087: the section notes are empty.
- 41997: the section description says nothing is built, though its step b03 is `Live`.
- 41969's section notes cite neither 0dh nor 0098; 41967's dead-key row stops at "nothing yet".
- 41973 p15 cites decision 0078 (it is 0080) and is still `Testing`, though it shipped in PR #66; p16 has no role or tool, and still says Tennessee is "the first registration owed", which decision 0096's correction of 2026-09-27 withdrew. 41974's section notes cite decision 0063 (it is 0064) and still call the steps `Testing` on an unpushed branch; all have been `Live` since PR #33.
- The Money sheets are well ahead of Puzzle in two sections: 41977 lacks four steps (h13–h16, decision 0095's register), h09's decision 0089 and h03/h04's links to 0065; 42066's section notes lack decision 0086 (Total profit and My cut), and b02, b03, b06 lack 0082, 0084 and 0086. 41973 p05 and p08 lack the tax-number and 0065 sentences.

**Wrong in the sheet; Puzzle is right:** `the-gig/03` a04 and `money/03`'s intro cite decision 0036 for the gig cap; the cap is 0037. `money/08`'s front matter names the section "(pay, band, …)" where its own body and Puzzle say "splits".

**Puzzle is ahead; the sheet catches up first, then a reload:**

- 42012 s03, s04, s05 and 41995 j06, j07: `Live` in Puzzle (PER-008 and decision 0058, the restricted key of 2026-09-15, the live Customer Portal of PER-012); Draft or "unrecorded" in the sheets.
- 41964 f03, f06, f14, f18, f20, f21 and 41970 l03, l04: decision 0049's one warm door, the sheet's touch traps, vote finality as "today's behaviour, not a hard rule", the next-show countdown, RSVP details.
- 41970 l11: In progress in Puzzle (decision 0035 and the socket probe); "not built" in the sheet.
- 41966's section notes: six tabs, and the same finality hedge.
- 41996 y03, y04, y05, y07 and 41997 b05 are Draft in Puzzle and unmarked in the sheets; 42087 b03 adds "never on the live poll".
- 41971 d08 and 41972's closing list: `charge.updated` is on the endpoint and PER-001 is done (PER-008 is the open item); the sheets still say "not yet". 41972 w01: two webhook secrets tried in turn (decision 0058); the sheet has one. 41976 k11 is Draft in Puzzle, unmarked in the sheet.

**Roles, tools and arrows (structural):**

- Where a sheet gives a step a second role (MySet server R, Fan I, Artist I), Puzzle usually has only the first: 41978 g04, g06, g07, g08; 41980 v01, v02, v04, v05, v06; 41983 n01, n02, n04; 41966 a07, a08, a11, a12, a15, a19; 41979 t04, t05; 41981 e02; 41982 q01, q03, q07; 41984 y05, y08; 41968 r05; 41986 o02, o03; 41973 p16 has no role at all.
- Roles that disagree: 42087 b03, b04, b06, b07 (both parties Responsible in Puzzle); 41996 y02 (founder and agent swapped); 41997 b03, b06; 41990 d05 (Coding agent missing, tools differ); 41966 a07, a08, a10 (Artist team member in Puzzle only).
- Arrows: cross-section go_to links the sheets write are not drawn (seven in Marketing, 41964 f22 → f21, 42013 d02 → Onboarding), nor are the "stop" branches (41987 s02, 41988 c02, 41990 d01, d04). Puzzle has arrows the sheets lack: 41969 s06 → s07 and s08 → s10, 41980 v02 → v07, 42005 f12's two labelled edges, 41976 k09 → k11. 42066's four cross-section links are not drawn. A few labels differ.

**Changelog:**

- Untitled: 1647 (0065), 1648 (0064), 1835 (0085), and 2408 (0098), which lost its title today when PR #121 re-bodied it (the heading has to sit on the body's first line).
- 1712 is titled 0078; its record is 0080 (0078 is 1670).
- No entry at all: decisions 0050, 0062, 0063, 0076, 0077, 0089, 0095.
- No linked steps: 1617, 1619, 1647, 1653–1656, 1662, 1663, 1670 (0078), 1678 (0079), 1719 (0081), 2312, 2313, 2317, 2319, 2320, 2321. 47 of the 101 entries have no owner.

**Found on the way, outside Puzzle:**

- `main`'s AGENTS.md has neither the Puzzle hand-off row nor the pull-request deploy flow (decision 0045): it still says "a push to `main` deploys" and `sh test/run.sh && git push`. Those lines, CONVENTIONS.md's standing-rule paragraph and `tools/decide.sh`'s "Does Puzzle need updating?" exist only as uncommitted edits in the shared checkout.
- After *Forgot your password?*, an address that already has a password is not offered the change sheet (`loadTeam` prompts only when there is none), so changing it takes a second emailed code.
- Two code comments still say passwordless: `studio.js` above Settings → Signing in, and `auth.mjs` above `emailChangeStart`.
- Sections with no sheet on `main`: 41595 (Stripe Connect Onboarding & Payments); 44328 and 44329 ride on `feat/sample-profiles`.
- money/07 h07, now linked to decision 0073, does not mention the sheet's hand-over.
- Minor: 41978 g07's last sentence and 41980 v07's wording differ slightly from Puzzle.

**Not checked:** a password sign-in on production; Resend's dashboard (d01's `Live` rests on the delivered code and the DNS records); a real push.
