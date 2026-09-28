---
tab: Reliability & security
section: Backup and restore
puzzle_section_id: 41997
sources:
  - MYSET-MASTER-OVERVIEW.md §5.2 (one store, the key families), §5.2 rule 1
  - tools/backup.py (take, verify, prune, --if-stale), tools/prod.py (keys, get), netlify/functions/_account.mjs (exportArtist, keysFor, keysForVenue)
  - docs/decisions/0046; AGENTS.md § At session start; GIG-NIGHT.md § Before you leave the house
  - _lib.mjs 25–45 (a separate site is a separate store)
  - SECURITY.md Tier 1 ("A backup you have actually restored"), § The short version
  - IMPLEMENTATION_STATUS.md open risk "Nobody has tested a restore"
  - docs/decisions/0008
status: loaded
loaded: 2026-09-12 (create_process; read back through list_sections and list_steps)
verified: `python3 tools/backup.py` run 2026-09-12 against the live store (read-only) — see the session record for the output; restore not attempted
---

# Backup and restore

**Who:** the founder, with an agent. **Trigger:** today, then on a rhythm; and the day something is gone. **Outcome:** a copy of the one datastore that exists somewhere Netlify is not, and a restore that has been **rehearsed** — because *an untested backup is a rumour*. **Status (2026-09-12, later the same day): the copy half is built and has run once; the restore half is not.** `tools/backup.py` takes a verified copy on the rhythm decision 0046 sets; nobody has ever restored anything.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| b01 | Know what would be lost | document | AI Agent | Coding agent R · Founder I | Netlify | One store (`myset`), everything namespaced per artist or venue plus the handful of global documents — the registry `artists`, `venues`, `cityindex`, `acctindex`, `flags`, `idqueue`, `promos`, `authsecret`, `gigsched`, `vidqueue` (overview §5.2). Clip bytes live on Cloudflare R2, not here (→ *Community & media*). Losing `artists` alone means nobody can sign in; losing `authsecret` signs everybody out. `src: overview §5.2` |
| b02 | Walk every key, offline | task | AI Agent | Coding agent R | Netlify | `netlify blobs:list myset` (what `prod.py keys` and `backup.py` wrap) — **the one place `list()` is allowed**, because it is not live data and minutes of lag do not matter (decision 0008, INVARIANT 1). `backup.py` writes the list into the copy's `manifest.json` with a size and checksum per key. `src: tools/backup.py keys; decision 0008` |
| b03 | Take a full copy | task | AI Agent | Coding agent R · Founder I | Netlify | `python3 tools/backup.py` — `netlify blobs:get -O` per key from b02, eight at a time, into `~/Docs/Project Handoffs/myset-backups/<UTC stamp>/keys/`, owner-only permissions, plus `manifest.json`. Then **verify on the spot**: checksums match, every non-image document parses as JSON, every artist in the registry has a show document, every slug and email row points at a real artist, `authsecret` present — the checks a restore would need. Then prune by the rule (b06). The copy holds the ID-check photos and every sign-in address — the most sensitive file the founder holds; outside the repo (INVARIANT 10), inside the folder `mirror-to-ssd.sh` carries to the SSD. A copy is a **copy, never the source**. **Live: first run 2026-09-12.** `src: tools/backup.py; decision 0046; SECURITY.md Tier 1` |
| b04 | Restore into a fresh store | task | AI Agent | Coding agent R · Founder A | Netlify | **Draft — never tested.** A separate Netlify site is a separate blob store (`_lib.mjs`), so the rehearsal target is a throwaway site — creating it is the founder's call: `netlify blobs:set myset <key> --input <file>` per key from the copy's manifest, then `prod.py`'s report against it, then a sign-in and a vote on it. Deliberately not a flag on `backup.py`. **Never into production** except on the day it is gone — a `blobs:set` bypasses every etag and every invariant the functions enforce (§5.2 rule 4 is why writes are re-read). Ledger open risk *"Nobody has tested a restore"* — **active**. `src: _lib.mjs 25–45; ACCOUNTS.md §6.4 (the same blobs:set discipline)` |
| b05 | Restore one account | alias | Person | Founder R | Netlify | The small version already has a procedure: an artist's export (→ *Artist lifecycle → Leaving* q01, `exportArtist` over `keysFor(aid)`) is exactly the set of documents `deleteArtist` removes, so it is also the set a per-account restore would write back. Not rehearsed either. `src: _account.mjs exportArtist, keysFor` |
| b06 | The rhythm and the retention | document | Person | Founder A · Coding agent R | — | **Decided 2026-09-12 (decision 0046), delegated by the founder.** *When:* at the start of every working session if the newest copy is over a week old (`--if-stale`, AGENTS.md § At session start), and before every gig night (`GIG-NIGHT.md`). *Where:* the laptop folder above, mirrored to the SSD — a mirror, not a second retention. *How long:* ninety days; the first copy of each calendar month kept a year (`--prune`, run after every copy). Doubles as the first written data-retention rule. `src: decision 0046; tools/backup.py` |
| b07 | Rehearse the bad day | task | Person | Founder R · Coding agent R | Netlify | **Draft.** b03 is now real; b04 on a throwaway site, timed, written up as a session record with what broke, is the missing half. The first rehearsal is the one that finds the key family nobody listed. `src: SECURITY.md § The short version; ledger open risk "Nobody has tested a restore"` |

## Connections

b01 → b02 → b03 → b04; b05 aliases *Artist lifecycle → Leaving* q01; b06 → b03; b03 —rehearsal→ b07 → b04.
