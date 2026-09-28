# 2026-09-28 — Each seat, each tab, and sign-out that reaches only your own devices

**Asked (the founder):** a crew or member seat could call `signOutOthers` and sign every other device out, the owner's included, and `sessionRevoke` killed any session id it was named. Fix both sides (artist and venue) with failing tests first, and write a decision record. Triage three more crew gaps found outside `admin.mjs`'s `CAPABILITY` table: `revenue.mjs`, `history.mjs`, and `pushOn`.

Asked which direction for the sign-out fix, the founder chose **own devices only**. Asked what to do with the triage, the founder widened it: add revenue and history, *"but make it so that the owner has the ability to give viewability of the money tab to each individual band/crew, as well as an additional option to allow them to edit it – same for all the tabs"*. Later the founder shared another session's suggested task (the Studio drawing owner-only controls for member seats) and said *"i think we're taking care of it here"* — so that is folded in.

**Built** (branch `fix/seat-signout-scope`, off origin/main `45a8d07`, carried onto `d2eca9d`, `ad9fc28`, `c940a6e` and `20bd95e` as a patch):

- **Decision `0104`, INVARIANT 0gp — sign-out reaches only your own devices.**
  - `readSessions(owner, sid, onlyEmail)` in `_session.mjs`.
  - In `auth.mjs` and `venueauth.mjs`, for anyone but the owner, `sessions` lists the seat's own devices, `sessionRevoke` refuses a session id outside them (403), and `signOutOthers` means its own other devices.
- **Decision `0105`, INVARIANT 0gq — each seat, each tab.**
  - **The model.** `_session.mjs` has `AREAS` (nine tabs), `PRESET` (member, crew, and sample — look-only), `levelOf`/`accessOf`/`reachOf`, and `can(role, 'tab_view'|'tab_edit', access)`. `byEmail[email].access` holds only what the owner changed.
  - **The token.** `verifyToken` and `requireArtist` carry `access` off the row they already hold.
  - **admin.mjs.** `CAPABILITY` is re-keyed by tab and level, including the private reads (orders, the inbox, the calendar, the diary, posts) and the room's settings. `planGet` returns `access`.
  - **auth.mjs.** `accessSet` (owner only; refuses what a tab cannot take). `roleSet` resets the tabs. `list` shows a seat its own row, and the owner each seat's access plus the tabs' bounds.
  - **Money doors.** `revenue.mjs` and `history.mjs` ask Money view or edit. `stage.mjs` strips tonight's money for a seat without Money, through every caller of `stagePayload`.
- **The Studio.**
  - **Helpers.** `lvl`/`see`/`edit`/`ownerSeat`/`shut`/`notOwner`, and `seatPass()` after every paint and sheet (`data-ed`, `data-see`, `data-area`).
  - **Tabs and loaders.** The tab bar and the Menu follow the seat's tabs, and a hidden tab is never landed on. Every loader skips a read the plan has refused.
  - **Edit controls.** Marked on every tab.
  - **Owner-only controls.** Drawn for the owner alone: earnings, *Got a code?*, the page address, who can sign in, sharing with venues, Face ID, the Studio code, recovery, the address change, export, delete, sign out everywhere, the ID check, undo delete, payouts and featuring a gig. Also the first run, the plans sheet's buttons, and a locked feature's *Upgrade*.
  - **Money on the Live tab.** Hidden for a seat without it.
  - **The owner's Access sheet.** Presets on top, then *Hidden / View / Edit* per tab, drawn from the server's `tabs`.
  - **View-only look.** A scoped rule in `studio.html` so disabled controls read as disabled. `tools/stamp.mjs` run.
- **Tests.**
  - `test/accounts.mjs`: the 0104 checks on both sides, and the "EACH SEAT, EACH TAB" section.
  - `test/seatstudio.mjs` (new, in `run.sh`): the page's gates, plus a tripwire that fails when an owner-only action is sent from a function outside the gated set.
  - `test/structure.mjs`: accepts `<tab>_view|_edit`.
- **tools/mock.mjs.** The two seats beside the owner, `?access=`, the owner's grid, money stripped from the Live poll, and refusals mirrored and logged.
- **No dead names (the founder's rule at ship: no redundancy, no zombie code).** `CAN` keeps only `audit`: `show`, `requests` and `export` were names nothing read (`accountExport` is `OWNER_ONLY`'s, checked first). `tools/mock.mjs` imports the presets from `_session.mjs` instead of keeping a copy.
- **Docs.** `ACCOUNTS.md` §6.2 and §6.3a, the master overview's roles and sessions, `INVARIANTS.md` 0gp and 0gq, ledger ACC-006, and the process sheet `artist-lifecycle/02` (t01, t03–t05, t07; new t11 and t12).

**The triage, run before any fix against the in-memory store:**

- A crew seat's `GET /api/revenue` answered 200 with the buyer's email, the item and the note.
- Its `POST /api/history` renamed a night and hid it from the owner's book.
- Its `pushOn` answered 200, and a new order alert reached its phone. Eight more subscriptions evicted the owner's phone from the eight-device cap.

Revenue and history are closed by 0105. **Push alerts per seat are the next batch** (ACC-006's next action).

**What broke on the way:**

- Three pinned patterns: `copy.mjs`'s `setTab` opening, its setlist label, and `tipdecks.mjs`'s practice-round line and claim button. I kept the pinned text instead of loosening the tests.
- A block-scoped `const me` in `handleSong` would have shadowed the seat handed to `stagePayload`. I renamed the new parameter `seat` before it could bite.
- The first Access sheet squeezed each description into a one-word column. The control now sits under the name.

**Verified:**

- **0104.**
  - Failing first: 81 ✓ / 14 ✗; the owner's token went 200 → 401 after a crew `signOutOthers`.
  - After: 95 ✓.
  - Five knock-outs, each red: 8, 6, 1, 2 and 2 failed.
- **0105 server.** Six knock-outs, each red: 3, 3, 9, 1, 1 and 2 failed. Every file was restored and checked with `shasum -c`.
- **test/seatstudio.mjs.** 89 ✓. Three mutations each failed it: *Got a code?* ungated, a new ungated `setCode` sender, and a song delete without `data-ed`.
- **The suite.** `sh test/run.sh` exited 0, with 4,487 ✓ in 64 sections, again after the rebase onto `20bd95e` and the dead-name pass.
- **In a browser at 375 px, on `tools/mock.mjs`:**
  - the owner's list and Access sheet: a tap saved, and the list line followed;
  - crew: Live, Setlist and Menu only, no dollar figure anywhere, a view-only Setlist, and Settings down to their own sign-in;
  - a band mate's Money: read-only, with no earnings card;
  - a band mate's Settings: none of the owner's controls;
  - Settings and Profile at view: disabled under one note;
  - a seat's plans sheet: no button to press;
  - a sample's Studio: all five tabs, drawn as before;
  - the mock logged no call refused to a seat.

**Not checked:** production (nothing committed or deployed); a real phone; the venue side's per-seat tabs (not built — venues keep owner / manager / crew); Puzzle (it follows once this is live, as the last docs PRs did).

**Found at the end:** the unmerged cloud branch `origin/claude/myset-encryption-security-460mph` (a 72-file security pass off `45a8d07`) fixes the sign-out, revenue and history holes another way — revenue and history owner-only, and the room's settings on `library`/`gigs` capabilities that 0105 retires. It leaves `pushOn` alone. The founder asked here for per-seat Money instead. Its decisions 0099/0100 also collide with main's. The board, the ledger (ACC-006) and Notion say so, and that session has been told. Whichever branch merges second reconciles.

**Shipped:** the founder said ship, this branch first and the security branch after it, reconciled so nothing is built twice. The pull request is opened from `20bd95e`; the live check and Puzzle follow in the docs PR.
