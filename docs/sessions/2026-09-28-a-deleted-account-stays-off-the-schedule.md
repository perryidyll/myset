# 2026-09-28 — A deleted account stays off the schedule

**Asked (the founder):** a suspected bug, found read-only on `fcdafe5` while mapping the registry walks. Soft delete (INVARIANT 0dh) takes the calendar out of `gigsched` on day one, but the daily `heal()` walked every `byId` row with no `.del` check and re-indexed each from its calendar, so the same ring's `sweep()` → `autoTick()` → `startShow()` could start a deleted account's gig. Write a failing test first, fix at the narrowest point, run the suite, write the record. Then: "ship it, and add the sweepNotes guard too".

**Built (decision `0098`, ledger ACC-003), all in `netlify/functions/_auto.mjs`:**

- `heal()` skips a row marked for deletion. Skip, not un-index: an Undo that lands mid-heal must not lose a gig.
- `autoTick` asks `deletionOf` right before `startShow` — the check a tap on Start meets in admin.mjs — and answers `drop`.
  - `sweep` takes a dropped entry out instead of re-pointing it at the next gig.
  - One read per scheduled start, not per ring: the "already live" path never reaches it.
- `sweepNotes` drops a marked account's first-night letter rather than send it (dropped, not held).
- Tests: `test/autoshow.mjs` and `test/firstgig.mjs`, each a section called "AN ACCOUNT ON ITS WAY OUT".
- INVARIANT 0dh gained the sentence; the process sheets `the-gig/06` (s05, s11) and `the-gig/03` (a21) and their Puzzle steps say so; Puzzle changelog 2408.

**What broke on the way:** nothing. One trap avoided in the letter test: deleting an account sends its own notice to the same address, so the test counts only the first-night letter.

**Verified:**

- Failing first: autoshow `137 passed, 8 failed` (the heal re-added the account, the sweep started its show, `gigCount` 1; an entry already in the index was started and re-pointed); firstgig `41 passed, 1 failed` (`{"got":[1,1],"want":[0,0]}`, the letter sent).
- After: `145 passed, 0 failed` and `42 passed, 0 failed`. Each `_auto.mjs` piece knocked out alone turns 2, 4 and 1 assertions red.
- `sh test/run.sh` exit 0 on the final tree, 59 sections, no ✗.
- Production, read-only (`netlify blobs:get` of `artists` and `gigsched`): 6 accounts, none marked, no `delqueue` ever written — nobody was affected.

**Not checked:** a real deletion on production. Nobody has deleted an account, and a deploy preview shares production data, so it is no place to try one.

**Shipped:** live as `2243aed` (PR #114), merged 17:05:48 UTC on 27 Sep. Netlify's published production deploy is `2243aed`, `ready` at 17:06:16 UTC; the `autocron` bundle id moved from `4726ff1a2541` (on `a84da01`) to `9a0d7006f44c`.

## Later the same day: every other walk

**Asked (the founder):** check the other registry walks for the same `.del` gap; then, on the report, "ship it, and add the sheet column too".

**Found:** two gaps among every walk over either registry and every slug lookup outside `publicArtist` (the table is in decision `0098`'s amendment).

- The `/:slug` share card (`artistpage.mjs`) resolved the slug alone, so a pasted link to a deleted account kept its name and portrait. It now goes through `publicArtist`.
- The founder's Google Sheet listed a leaving account as a normal artist and its gigs as upcoming. A new last column, `Being deleted on`, carries the purge date on its Artists, Gigs and Venues rows; the account stays, because its nights happened.
- Left open on purpose: `/api/img` and `/api/vid` (a year on the edge regardless; the export and the Studio use the same addresses). Still open, cosmetic: a referrer's Settings lists a leaving referral by name until the purge.

**What broke on the way:** nothing in the code. A live check first fetched `myset.vip/perry-idyll` and got the plain card, which looked like a regression; the founder's page address is `perryidyll` (the id has the hyphen, the slug does not), and the real address shows his name and portrait.

**Verified:** share card `42 passed, 3 failed` → `45 passed, 0 failed`; sheet `199 passed, 7 failed` → `206 passed, 0 failed`, each of the three marks knocked out alone → `205 passed, 1 failed`; `sh test/run.sh` exit 0, 59 sections, no ✗, on the tree rebased onto `04e78db`.

**Shipped:** live as `1385b2b` (PR #120). Netlify's published production deploy `6ab9f454` is `1385b2b`, `ready` at 05:02 UTC on 28 Sep. By content: `myset.vip/perryidyll` and `myset.vip/thelastcigarettes` carry their names and pictures; an unknown address gets the untouched page. **Not checked live:** the sheet's column, which the 03:20 UTC sync writes; nobody on production is marked, so every cell will be blank.

## Then the invite list

**Asked (the founder):** "hide them from the invite list too".

**Built:** the `list` action in `auth.mjs` counts and names only referrals not marked for deletion; Undo puts them back. `test/accounts.mjs` "AN ACCOUNT ON ITS WAY OUT LEAVES THE INVITE LIST" failed first (`135 passed, 1 failed`: `{"got":[1,["Kid Aldo"]],"want":[0,[]]}`) and passes after; `sh test/run.sh` exit 0, 60 sections, no ✗.

**Shipped:** live as `ad9fc28` (PR #123), merged first by agreement on the sessions board; Netlify's published production deploy is `ad9fc28`, `ready` at 05:14 UTC. Two sessions editing `auth.mjs` and `test/accounts.mjs` were told to rebase.
