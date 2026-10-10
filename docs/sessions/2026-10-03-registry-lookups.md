# 2026-10-03 — The audience finds an artist through two small copies of the list

An overnight builder for the scale audit's phase two ("MySet Audit Solutions 2"), in worktree `scale-p2-reg` on branch `perf/registry-lookups`, at the top of the phase-two stack (#218 → #219 → #226 → #231 → #232 → #233, all on main). Nothing was pushed, merged or deployed; nothing touched production. The founder was asleep and has seen none of it: the record is `proposed`, `agent-recommended`.

## What was asked

The audit's row *"The whole artist list is read on every poll, vote and Studio call"*: the safe first step of *"one small file per slug, per artist and per email"*, numbered decision 0176, INVARIANT 0ip, ledger SCL-013.

1. Classify every reader of the registry: a single lookup or a walk. The table is in the record.
2. Give the single lookups small computable documents, written after the registry's write, read by the hot lookups, falling back to the registry when missing, stale or unreadable, healed by an existing bell (not `autocron`). Sign-in must never be denied or misrouted by a stale copy. Renames, deletions, sample pages and the purge must stay right.
3. A FAMILIES line for every new key kind.
4. Measure what a poll reads before and after, at 1,000 and 10,000 artists.

## What was built

- **`_lookup.mjs` (new).** `aslug_<slug>` → `{ aid, seq }` and `arow_<aid>` → `{ row, names, seq }`. The row copy leaves out `rev` and `dead`, and no copy holds an email address. The module holds the writer (`writeLookups`, `putLookup`), the readers (`publicSlug`, `rowOf`), the purge's names (`lookupKeys`) and the heal (`healLookups`).
- **`_auth.mjs`, small and additive** for PR #150's rebase; none of its hunks are touched. `mutateArtists` fingerprints the copies inside each attempt, moves `seq`, and writes the changed copies after the write lands. `artistById` reads the row copy. `__flushArtists` also forgets the kept answers. One getter is new, `publicCopyAt`.
- **`_lib.mjs` `publicArtist`.** It asks the copies first, then 0141's minute-old copy of the list for a yes, then the store for a no. A no is not asked twice when this request has just loaded the list.
- **`_account.mjs` `keysFor`** names the copies, so a purge deletes them as leaves.
- **`_mirror.mjs` FAMILIES:** `aslug_`, `arow_` and `alookheal` are `skip`. They are rebuilt from `artists`, which is copied; a copy restored beside a list from a different moment could disagree with it.
- **`citycron`** rings `healLookups` beside the city index's heal, each caught on its own.
- **`admin.mjs` `setCode`** was moved to the list and then put back. PR #150 changes the lines around it, so the one-line move waits for #150 (0176, *What this makes harder*). Done on 2026-10-09, after #150 merged, on #257.
- **`me.mjs`**: a comment that said a slug room reads the list on every poll now says what it reads.

## Not built, and why

- **The email copy, and sign-in reading copies.** A copy cannot prove it is current without reading the list, and a stale `rev` or `dead` would let a signed-out device back in (0dd). Everything that grants access, gates a seat, records consent or prices a payment stays on `readArtists()`. Writing email copies with no reader would be dead infrastructure. With #150, an email family would also have to be sealed.
- **`venue.mjs` and `events.mjs` by id.** They read the list once per page (0174). Moving them to the row copies is a small next step, but they decide what a leaving account shows, so they wait for a separate change.
- **The Studio's three list reads per action** (`verifyToken`, `deletionOf`, `planForArtist`): all access or money, and #150 is in that code.

## Verified

| Check | Result |
| --- | --- |
| `node --import ./test/register.mjs test/lookups.mjs` | 75 ✓, 0 ✗ |
| Twelve knock-outs (the record lists them), each restored | every one red |
| `test/cost.mjs` | 33 ✓; the board, the legacy poll and a slug room's vote touch no global document; counts unchanged (board 14, personal 2, vote 4, rename 10, Studio 21, Money tab 4) |
| `test/storefail.mjs` | 36 ✓ (a slug room answers from its copies with the list unreadable; 503 with both unreadable) |
| `test/background.mjs`, `accounts`, `samples`, `tenancy`, `e2e`, `foundations`, `studiocode`, `citycounts` | green |
| Synthetic list, cold address lookup | 356 KB → 292 bytes (1,000 artists); 3,630 KB → 296 bytes (10,000) |
| A list write's fingerprint | 1.3 ms at 1,000, 14.4 ms at 10,000 (twice a write) |
| `sh test/run.sh` | exit 0 |

## Not checked

- The real store's latency for two small reads against one large one.
- How often a real copy write is lost.
- The first heal pass against production (it writes every copy once).
- A real room.
- How long a Netlify instance stays warm.
- Nothing in `public/` changed.

## Found, not changed

- `cancelDeletion` gives a freed address back only when no row has that id, and the artist's own row usually does. So Undo after *Free up my address* never returns it.
- A purge leaves `oldSlug` entries pointing at the purged id, and the list resolves them to a room with nothing in it.

## Choices made where the founder did not say

- **The key shapes:** `aslug_<slug>` and `arow_<aid>`, and the heal's cursor `alookheal`.
- **A new `seq` on the list.** It is the version the brief asked copies to carry. `rev` could not be used: it signs devices out, and moving it would sign out every account without a `rev` of its own. It is one additive field; nothing else in the list changed.
- **A yes needs both copies to agree, and "leaving" is asked of the list.** A cold lookup costs two small reads, not one.
- **The row copy leaves out `rev` and `dead`.** So `artistById` no longer returns them; no caller read them.
- **The heal runs from `citycron`,** a pass at most every six hours (`HEAL_GAP_MS`), with a three-second budget run beside the city's.
- **0141's minute-old copy of the list stays,** as the second place to look, until the copies are proven. Its record expected it to go when the split landed; this is step one.
- **The three media doors (`img`, `vid`, `qr`) keep `artistBySlug`** and its exact answer.
- **FAMILIES `skip`** for all three new kinds.
