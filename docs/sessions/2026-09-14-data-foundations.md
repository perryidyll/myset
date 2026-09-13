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

**The rehearsal.** `MYSET_SITE_DIR=$HOME/Docs/MySet python3 tools/backup.py
--restore "$HOME/Docs/Project Handoffs/myset-backups/20260913T150747Z" --store
rehearsal-20260914` printed:

```
restoring 209 keys from …/myset-backups/20260913T150747Z into store `rehearsal-20260914`
  209 of 209 keys restored and read back equal, 287.0 MB, 580 s
```

— every key written with `blobs:set --input --force`, read back with
`blobs:get -O`, sha256 equal to the manifest, images and 70 MB clips included;
eight CLI processes at a time, most of the 580 s spent in the CLI's own start-up
per call. Then `--wipe rehearsal-20260914 --from …` → `deleted 209 of 209 keys`,
and `netlify blobs:list rehearsal-20260914` → *empty*. `--store myset` → refused,
exit 1. So a full restore of today's store from the laptop copy is a ten-minute
job that a person can run, and the script that runs it cannot be pointed at
production by accident. (First attempt, from the worktree: 0 of 209 — the CLI was
not in a linked folder; hence `MYSET_SITE_DIR`.)

**The first ring (PR #36 live as `51d7584`, 17:26Z).** `netlify logs --source
functions --function mirrorcron --since 30m` showed the 17:40Z ring ran twice —
`Duration: 12902 ms` and `11656 ms`, 1024 MB, and no `mirrorcron:` line: the
ten-second limit killed it and Netlify retried once. Cause: `keysFor` names the
`vid_` clip keys (four clips up to 70 MB) and the mirror pulled them through the
function to put them where they already are (clips live on R2 under the same
key). Fix, PR #37: `vid_` skipped; the deadline checked after every key; a
partial owner keeps the cursor and a `keyCursor` so the next ring resumes at the
key it reached; at least one key per worker per ring; budget 5.5 s. The suite now
drives a pass to completion at a budget of 0 ms and counts every key copied once.
**The 18:00Z ring (production `b6edb37` since 17:50Z):** the log showed one
invocation, 18:00:49–50Z, and `netlify blobs:get myset mirror` read
`{"order":["global","perry-idyll","v:idyllstudios"],"cursor":3,"keyCursor":0,
"passDoneAt":"2026-09-13T18:00:50.731Z","copied":0,"skipped":0,"failed":69}`.
Every PUT refused. **This is older than tonight:** the laptop backup's
`err_2026-09-11T18` document holds `{"where":"r2.put","msg":"r2 put 403"}`
from the first clip upload after the R2 deploy, and `curl -I
'https://myset.vip/api/vid?a=perry-idyll&c=k6qu6yfqi4v'` answers `200
video/mp4` (Blobs), not a 302 to R2 — for both live clips. So decision 0033's
"the first deploy is the measurement" was never read: every clip since
2026-09-11 fell back to Blobs, silently, as designed. Diagnosis with the real
module and the site's variables (loaded into a process, never printed): HEAD →
404 (signature accepted), PUT → 403, DELETE → 403 — the R2 API token can read
but not write. The fix is in Cloudflare (token permission *Object Read & Write*
on the bucket), the founder's; no deploy is needed afterwards. PR #38: the ring
names the first refusal (`err`) and a failed pass retries in an hour.

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
