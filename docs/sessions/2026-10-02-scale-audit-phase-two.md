# 2026-10-02 — Scale audit, phase two: the first two fixes

## What was asked

The founder: begin fixing everything in the second phase of the 2 October scale audit ("Remove the shared files"). Twelve items, in two groups:

- **Structure:** one small file per slug, artist and email; one file per payment and a trimmed payments history; Play as one write; trimmed vote receipts and more fan files for bigger rooms; a cap on new devices per network per show; fetch "me" on action and wake.
- **Proof:** a separate test site and the real write ceiling; the latency simulator in the test suite; a backup that covers every family and a rehearsed restore; disputes, refunds and a merch stock hold; "Open in your browser" before checkout; the song list sent once.

## The order, and why

Week one of the same audit is in flight in another session (cdfdf5), in `_lib.mjs`, `webhook.mjs`, `_pay.mjs`, `_auto.mjs` and `vote.html`. So this session started with the two items that touch none of those, and that the rest are proven with:

1. The latency simulator joins the suite (decision `0145`).
2. Backup covers every family, and the off-site copy is read back (decision `0146`).

Nothing was committed or pushed. Everything is in worktree `scale-p2`, branch `test/contention-sim`, off origin/main `f3d85f5`.

## What was built

### The suite runs a traffic jam (0145, INVARIANT 0ht, ledger P3-016)

- `tools/roomsim.mjs`: the audit's simulator, in the repo. The real `vote`, `me` and `admin` handlers on a virtual clock, seeded, one line of JSON out.
- `test/blobs-fake.mjs`: `__latency`. A read takes time; a conditional write waits its delay and is then judged against the etag. Off unless a test turns it on.
- `test/contention.mjs`: five rooms on every suite run. A pub; 5,000 phones at 75 votes a second; 5,000 arrivals in a minute; a stampede on a slow store; Play mid-rush.

### Every kind of document has a second home, or a reason (0146, INVARIANT 0hs, ledger DAT-002)

- `_mirror.mjs`: `FAMILIES`, one line a kind of key (an owner's, a global, or never copied and why). `skipped()` reads it. New globals, and keys named off an index document: CRM contacts, a taken-down sample's snapshot, media-dashboard thumbnails, a city's featured slots, the error log's last 48 hours. `payowed` is listed for week one's PR #205.
- `mirrorcron.mjs`: the walk reads `samplereg` as well as the two registries.
- `_account.mjs` / `_venueaccount.mjs`: `bugs_<aid>`, `vpitch_<vid>`, `push_v_<vid>`, `gigok_<vid>` join the key lists. They are now deleted with their account too.
- `tools/r2pull.mjs`, `tools/backup.py --from-r2`: the R2 copy read into the folder shape `--restore` reads.
- `tools/backup.py --coverage`: every key in a laptop copy against the mirror's manifests.
- `tools/backup.py --verify`: an account with no `show_` document is a note, not a failed copy; media-dashboard thumbnails are pictures.
- `test/keyfamilies.mjs`, the suite's last step: every key the whole suite wrote must match a line of `FAMILIES`.
- `tools/prod.py`: the line that said nothing is mirrored outside Netlify now says what is.

## What was verified

| Check | Result |
| --- | --- |
| `sh test/run.sh` | exit 0 |
| `node test/contention.mjs` | 22 ✓ / 0 ✗; the 5,000-phone room reproduces the audit's run (1,500 of 1,500 on the board) |
| Same seed twice | identical output, byte for byte |
| Knock-outs on `casDoc`: 3 tries; unconditional write | red (4 ✗; 6 ✗) |
| `test/foundations.mjs` | 103 ✓ / 0 ✗ |
| Knock-outs on the walk: samples, `bugs_`, CRM contacts, `hqlock`, the venue three | all red |
| `test/keyfamilies.mjs` on a full run | 984 keys, none unclassified; red on an unknown key |
| `backup.py --coverage`, laptop copy of 06:21 UTC | 258 keys with a second home, 68 without |
| The new walk, dry-run in memory over that copy | 310 cross |
| `backup.py --from-r2` (real bucket, read-only) | 258 of 258 keys, 25 s, "copy is whole"; 254 byte-identical to the laptop copy |
| `backup.py --restore <R2 pull> --store rehearsal-20261002` | 258 of 258 restored and read back equal, 687 s; store wiped after |

## Puzzle

- Section 41997 (*Backup and restore*): new steps 397282 (*The nightly copy on R2*, Live), 397283 (*Is everything in it?*, Testing) and 397284 (*Read the R2 copy back*, Testing); 370111 renamed *Restore into a separate store* and Live; 370114 In progress; arrows 445244–445246 plus two made with the steps.
- Steps 369865 (*Know the ceiling*) and 370041 (*Run the whole suite*): notes extended.
- Changelog 2691 (0145) and 2692 (0146), both in progress until the merge, each linked to its steps.
- After the merge: 397283 and 397284 to Live, both changelog entries to completed.

## What was not checked

- Nothing was load-tested on production. The simulator's times are a model (42 ms reads, 80 ms writes; ledger P3-005 is still open).
- The new kinds have not reached the real bucket: that needs the merge and one nightly pass. Then take a laptop copy and run `--coverage`.
- A restore into the production store. Never run, by design.

## What the production check found, for the founder

- **13 documents belong to no account:** `samcole` (three nights, one lyric sheet), `thelantern` (a venue profile and its pitches), and seven keys from before artists had ids, each with a migrated twin under `perry-idyll`. Nothing reads them. Delete or leave.
- **One chart of a song no longer in the library** (`zzz-test-song`). The general case is open: a chart or lyric sheet whose song has left the library is named by nothing, so it is neither copied nor deleted with the account.
- **The laptop copy of this morning carries the signing key.** It was taken with the shared checkout's old, untracked `tools/backup.py`, which lacks the skip list from decision 0110. Run the tool from a worktree on main, or reset the shared checkout.

## Choices made where the founder did not say

- The four forgotten per-owner documents were added to the key lists, which also makes deletion remove them.
- `crmgmail` is copied (it is ciphertext without the server's secret).
- Error hours: the mirror looks two days back. Older hours are in the laptop copies only.
- Dated snapshots on R2 were **not** built: it is a storage-cost and retention call.
- The restore rehearsal wrote to a separate store on the production site (`rehearsal-20261002`), as the 2026-09-14 rehearsal did, and wiped it.

## Next

- The founder's word to commit and open the pull request for these two.
- Then, on week one's merges: Play as one write; trimmed receipts; the song list sent once; "me" on action and wake; "Open in your browser" before checkout; per-payment files; disputes and refunds; the device cap; the registry split.
- Needs the founder first: a separate Netlify site for load tests (it draws credits); the device cap's number on shared bar wifi; what a refund or a dispute takes back; dated snapshots.
