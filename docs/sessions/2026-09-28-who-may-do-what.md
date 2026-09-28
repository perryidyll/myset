# 2026-09-28 — Who may do what: two holes closed

**Asked (the founder):** two gaps in `admin.mjs`. (1) The founder's platform tools were gated by the account (`isPlatformOwner(aid)`), not the role, so a member or crew seat signed in to the founding page could use them. (2) Six `CAPABILITY` keys named no handler, so crew could rewrite setlists, charts, lyrics and tags. Write failing tests first, fix narrowly, run the suite, write the record. Then: "ship it".

**Built (decision `0099`, INVARIANT 0gj, 0t amended, ledger ACC-004):**

- `admin.mjs`: the platform block (flags, ID queue, promo codes, a venue's plan and tick, the sheet, the bug list) needs `isPlatformOwner(aid)` **and** `me.role === 'owner'`. The code door and the recovery key are owner, so the founder keeps every tool.
- `CAPABILITY`: seven rows named actions no handler takes — the six in the brief plus `eventUnskip`. They now name the real ones, plus `clearSetlist`, `learnDone`, `lyricsFetch`, `postPin` and `eventHide`. Crew could empty the library in one request before this.
- Left open on purpose: `chordsLink` (read-only) and `lyricsWarm` (never overwrites).
- `test/structure.mjs` refuses a `CAPABILITY`/`OWNER_ONLY` name no handler branches on, and a capability no role has. `test/accounts.mjs` holds both halves.
- Process sheets and their Puzzle steps: artist-lifecycle/02 t01, artist-lifecycle/04 e06, venue-lifecycle/02 y07, reliability-and-security/01 i06 (whose note had claimed every artist reads their own reports — `bugList` was always behind the founder gate). Puzzle changelog 2430.

**What broke on the way:** origin took decision 0098 and ledger ACC-003 mid-session (the deleted-account fix), so this batch was rebased and renumbered 0099 / ACC-004. The ship commit's ledger row still said "not committed"; this follow-up corrects it.

**Verified:**

- Failing first: structure ✗ on the seven phantom names; accounts `85 passed, 46 failed` (crew `clearSetlist` 200, library emptied; member `flagSet` 200; two promo codes minted by non-owner seats).
- After: structure OK (63 `CAPABILITY`, 29 `OWNER_ONLY` names); accounts `131 passed, 0 failed`. Misspelling a value, a key or an `OWNER_ONLY` name each turns structure red.
- Whole suite: 3,870 assertions, 0 failing, on `45a8d07` and again on `588f03c` just before the PR.
- Production: Netlify's published deploy is `04e78db`, `ready` at 04:55:45 UTC; the `admin` bundle moved from `cc33ccebafc3` (on `2243aed`) to `f4ab39a5a52d`.

**Not checked:** a member or crew seat on production. The live registry was not read, and a deploy preview shares production data, so no signed-in write was tried there.

**Shipped:** live as `04e78db` (PR #117). Still open, in other branches: the Studio's founder cards and `mediadash.mjs` (decision 0100, `fix/founder-tools-owner-seat`), and crew signing the owner out through `auth.mjs` `signOutOthers`/`sessionRevoke` (`fix/seat-signout-scope`).
