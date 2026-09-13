# 2026-09-14 — The data foundations (DAT-001, decisions 0066–0069)

**Asked.** The founder, after reading the storage report (2026-09-13, the artifact
*MySet Data Foundations*): "please build all 6 foundations now (and anything else
that needs to be done to fix those 3 real gaps) and then ship it live". The six:
an event log per show; versions before overwrites; a second home for the archive;
rehearse the restore; write down that ids are never reused; make "a capped list
needs a complete sibling" the rule. The three gaps: vote events never written,
no versions, one vendor with an untested restore.

**Built**, in a worktree off `origin/main` `406f3f4` (branch `data/foundations`),
Efficient Mode, one full gate:

1. **`_append.mjs`** — the one append-only chunked log under everything: a head
   document that spills its first CHUNK (2,000; 20 in the suite) entries to a
   write-once part `<key>_p<n>` and moves on; every key computable from the head;
   race-safe (appends only push to the end, so two spills write identical bytes to
   the same write-once key and the second head advance aborts); `extra` state on
   the head that is replaced, not appended.
2. **The event log (0066, INVARIANT 0fq).** A third field on every vote row —
   `[cost, paid, when]` — in `chargeVotes` and `grantPaidSongVotes`. `harvest()`
   in `_lib.mjs`; `dropSongVotes`, `refundSongVotes` and `wipeBoard` return what
   they removed. `admin.mjs` captures `showId`, the play entry and the record as
   read inside the CAS callback and, after it, files `vote`+`play` (with the
   harvested rows), `refund`, `drop` or `reset` through `_evlog.mjs`; every call is
   caught so a log that cannot be written never stops a song. `archiveShow` calls
   `closeLog` — the standing votes (from the fans it was handed), the money events
   from `meta_` in the night's window, the end — into the head's replaced state,
   so an accidental End + eight songs + End files every vote once.
   `/api/history?log=<showId>` for the owner (behind `reports`, like the detail).
   The export carries `nights`. `d` = `sha256(showId | device)`[0:12].
3. **Versions (0067, 0fr).** `_versions.mjs`: `casKeep` wraps `casDoc`, captures
   the document as read, and if the write changed it and it was not the fallback,
   `keepVersion` → `ver_<key>_<ts>` (onlyIfNew) + `vers_<key>` (append log). Gap
   30 s (`MYSET_VER_GAP_MS` for the suite). `mutateProfile`, `mutateLists`,
   `mutateEvents` go through it; `admin.mjs` keeps the show record when
   `libChanged`. Export: bytes for profile/setlists/gigs, timestamps for the
   library.
4. **Archives for the capped lists (0068, 0fr, 0fs).** `spillPosts` /
   `spillFeedback`: append the overflow to `postsarch_<owner>` / `fbarch_<aid>`,
   then trim; called only when the write made the list full (a post is still 8
   reads — `test/community.mjs`). Readers dedup. `keysFor` / `keysForVenue` add
   the archives, the archived posts' photo and clip keys, every night's event log
   keys, and the version keys of the four documents. INVARIANT 0fs: ids never
   reused.
5. **The second home (0069, 0ft).** `_mirror.mjs` + `mirrorcron.mjs`
   (`*/20 * * * *`): registries → `keysFor`/`keysForVenue` → `getMetadata` etag per
   key → `r2Put('backup/<key>')` only for changed keys; manifest `mirror_<owner>`;
   state `mirror` with a cursor and a 20-hour pass gap; budget 7 s
   (`MYSET_MIRROR_BUDGET_MS`); at least one owner per ring. Skips `sess_`, `lock_`,
   `authc_`, `authsecret`, `f<n>_`. `test/blobs-fake.mjs` gained `getMetadata`.
   R2 is on in production (the four `R2_*` variables are set — names checked, never
   values).
6. **The restore (0069).** `tools/backup.py` — committed for the first time (it had
   lived untracked in the shared checkout since 0046; the copy here is that file
   plus): `--restore DIR --store NAME` (refuses `myset`), `--wipe NAME --from DIR`,
   `MYSET_SITE_DIR` (a worktree is not `netlify link`ed — the first run failed all
   209 puts with "not in a folder linked to a project" before this existed; the
   tool now prints the first failure's reason), and a probe that a binary key
   round-trips byte-for-byte through `blobs:set --input` / `blobs:get -O`
   (`img_perry-idyll_avatar`, 85,398 bytes, sha256 equal).

**The rehearsal.** REHEARSAL_PLACEHOLDER

**Verified.** `sh test/run.sh` → exit 0, 46 files, **2,932 ✓ / 0 ✗** — new
`test/foundations.mjs` 60 ✓ (what each assertion holds is in the ledger's
verification log); `test/cost.mjs` a vote 5 reads / 2 writes, unchanged;
`node tools/overview.mjs` current. Not run: `uicheck` / `sheetcheck` — no page
changed. Not checked: a real night's log in production (the founder's next gig
is the measurement), the first `mirrorcron` ring (the function log after the
deploy).

**Found on the way.** The production store holds ~100 stray keys from
pre-tenancy experiments and load tests (`f0`–`f11` unsuffixed, `show`, `meta`,
`state`, `hist_index`, `cas/t`, `cas2`, `debug/probe`, 31 `v/1~crowd…`, 50
`vote~1~…`, a few bare `lyr_`/`hist_`) — harmless, and `backup.py --verify`
already names them as stray. `show.log` is capped at 200 entries (a marathon
night would lose plays from the Studio's list — the event log now keeps them).
INVARIANT 17b still describes the pre-2026-09-07 wipe; left alone, not mine.

**Open.** A hard account delete does not reach the R2 copy (`backup/<key>`
stays; a backup's job, but a deletion-on-request has to reach it — one
`r2Delete` loop over `keysFor` in `deleteArtist`, with a record). No
restore-a-version button. `docs/processes/DATA-MODEL.md` (the other session's
uncommitted tree) should gain the new families. AGENTS.md's session-start
backup line is also in that tree.

**Docs.** Decisions 0066–0069; INVARIANTS 0fq–0ft; overview §5.2 (families,
rules 6–9); ledger DAT-001, header, next work item, verification log, decision
log; SECURITY.md's restore row and closing paragraph; Puzzle changelog entries
1653–1656; the handoff.
