---
tab: Artist lifecycle
section: Sessions, roles and the team
puzzle_section_id: 41979
sources:
  - netlify/functions/_session.mjs (CAN, sessions, revocation, the activity log), auth.mjs (sessions, sessionRevoke, signOut, signOutOthers, add, remove, roleSet, revokeAll, setSlug, activity)
  - ACCOUNTS.md §6.1–6.3, §6.7
  - MYSET-MASTER-OVERVIEW.md §5.5 Roles, Sessions
  - INVARIANTS.md 0ci (one global read per poll), 0bu
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps)
verified: code read 2026-09-12 (_session.mjs CAN table; auth.mjs guarded actions)
---

# Sessions, roles and the team

**Who:** the account owner managing seats; any signed-in person managing their own devices. **Trigger:** Settings → Signing in / team members. **Outcome:** a band mate can run a show and never take the account; one phone can be signed out without signing out the band; and there is a record of what happened.

Two of the holes this closed were ways to lose an account: a member could delete the owner's address or rename the public page every printed QR code points at; and sign-out cleared the browser and told the server nothing, so a copied token worked for a month.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| t01 | Resolve the role on every request | conditional | Automation | MySet server R | Netlify | `byEmail[email].role` → `CAN` in `_session.mjs`, the one table that says what a role means. **owner** = everything (money, plan, payouts, access, the page address, recovery codes, export, deletion). **member** = the page and the show: library, setlist, gigs, profile, community, requests, stats, export, audit. **crew** = tonight only: run the show, see the queue and requests. **An unknown role falls back to `crew`** — default-deny, so a string the table has never heard of can never be an escalation; the lookup is an own-property check because `CAN['toString']` is an inherited Function. Venues: owner / manager / crew. `src: _session.mjs CAN; ACCOUNTS.md §6.3` |
| t02 | Check revocation for free | conditional | Automation | MySet server R | Netlify | Revocation lives on the **registry row the verifier is already holding**: `byId[aid].dead = {sid: expiry}`. An account that has never revoked has no `dead` key, so the one document every poll reads does not grow. Past twelve entries it bumps `rev` instead (signs everyone out, the rare case). **Zero extra reads, zero extra writes, on every authenticated request** — INVARIANT 0ci holds. `src: _session.mjs; ACCOUNTS.md §6.2` |
| t03 | See where you are signed in | notification | Automation | MySet server R · Artist I | Netlify | `sessions`: the cold document `sess_<owner>`, read only when the screen opens — device class, when it signed in, *Last opened Settings* (written at most once an hour from the two Settings actions the Studio already calls; labelled that way because *last used* from a number that only moves in Settings would lie). `src: auth.mjs sessions; ACCOUNTS.md §6.2` |
| t04 | Sign out this device | task | Person | Artist R · MySet server R | Netlify | `signOut`: the session id goes into `dead` with its token's expiry — the copy on a borrowed phone stops working now, not in a month. `sessionRevoke` does the same for any one listed session. `src: auth.mjs signOut, sessionRevoke` |
| t05 | Sign out everywhere | task | Person | Artist R · MySet server R | Netlify | `signOutOthers` / `revokeAll` (owner): bump `rev`, every token minted before this instant dies. Also what using a recovery code does. `src: auth.mjs; ACCOUNTS.md §6.4` |
| t06 | Add a team member | form | Person | Artist R · Artist team member I | Netlify | `add {email, role}` — **owner only** (403 otherwise; the venue side had the identical hole plus a `staff` role nothing read, retired into `crew`). Seats per plan are in §2.1. The new address signs in through the ordinary code door; the registry links it to this page with the given role. `src: auth.mjs add; ACCOUNTS.md §6.1` |
| t07 | Change a role or remove a seat | task | Person | Artist R · Artist team member I | Netlify | `roleSet` / `remove` — owner only. Removing a seat kills its sessions. The owner cannot remove themselves this way (that is *Leaving*). `src: auth.mjs roleSet, remove` |
| t08 | Rename the public page | task | Person | Artist R | Netlify | `setSlug` — **owner only**, because the slug is printed on QR codes stuck to bar tables; `cleanSlug` refuses reserved names (`v…`). `accountFreeSlug` is the deliberate release during a soft delete. `src: auth.mjs setSlug; ACCOUNTS.md §6.1, §6.6` |
| t09 | Write the activity log | database | Automation | MySet server R | Netlify | `log_<owner>`, capped at 100 entries, **best-effort with `.catch(() => {})`** — a logging failure must never be the reason a musician cannot start a show. Sign-ins, code sends, seats added and removed, roles changed, the Studio code set, recovery codes made and used, the address moved, deletion started and cancelled. Never an IP, never a fan id, never an amount. `src: _session.mjs; ACCOUNTS.md §6.7` |
| t10 | Read the activity log | notification | Automation | MySet server R · Artist I | Netlify | `activity` — needs the `audit` capability (owner and member). *"Did somebody else get into my page?"* now has an answer. `src: auth.mjs activity` |

## Connections

t01 → t02 (every request); t03 → t04; t03 → t05; t06 → t07; t06 → t09; t07 → t09; t04 → t09; t08 → t09; t09 → t10.
