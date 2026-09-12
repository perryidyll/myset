---
id: 0046
title: The datastore is copied weekly and before every gig, verified, and kept for ninety days
date: 2026-09-12
status: decided
decided_by: perry-confirmed
area: ops
reverses:
superseded_by:
invariants: []
commits: []
tests: []
files: [tools/backup.py, AGENTS.md, GIG-NIGHT.md]
---

## The question

Netlify Blobs is MySet's only datastore, and until 2026-09-12 there was **no copy of it anywhere** — not a snapshot, not an export. `SECURITY.md` had listed *"a backup you have actually restored"* as Tier 1 and the ledger carried *"Nobody has tested a restore"*; mapping the Reliability & security tab showed the truer statement: there was nothing to restore from. The founder delegated the rhythm on 2026-09-12 (*"the backup rhythm using your best judgement"*). Three things had to be settled: how often, where, and how long a copy lives.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: a read-only copy at session start if the newest is over a week old, and before every gig night; verified on the spot; kept 90 days, first-of-month kept a year** | `tools/backup.py` reads every key through the Netlify CLI into a dated folder outside the repo, checksums it, checks every JSON document parses and the registry agrees with the documents, prunes by the rule | A few minutes of CLI reads, no writes; a folder that holds sign-in addresses and ID photos | One script; one line in the session-start checklist; one line in `GIG-NIGHT.md` | A week with no session and no gig has no copy; a copy that is whole today may not restore cleanly — restore is still unrehearsed |
| B — a scheduled job on the laptop (launchd) | Copies on a clock | Nothing | A scheduler on a machine that sleeps and travels | Silently stops when the laptop is shut; nobody notices |
| C — a scheduled Netlify function that writes a copy somewhere else | Copies from the cloud on a clock | A second store or bucket, credentials for it in the environment, function invocations | A new destination to keep alive, the copy now reachable from the same credentials as the source | The copy shares the failure it is meant to survive |
| D — rely on Netlify | Nothing | Nothing | — | Netlify keeps Blobs durable, not versioned; a bad write (a restore by hand, a purge bug) is permanent the moment it lands |
| E — do nothing | — | — | — | Data loss discovered during recovery |

## What was chosen, and why

**A.** It ties the copy to the two moments that matter — before work that could break something, and before a night that could — and it runs itself for as long as sessions happen, which is daily. Read-only is the property that lets it run unattended: it is the same owner-level read `tools/prod.py` already uses, and it cannot touch the site. Verification on the spot is what turns a folder into a backup: every JSON document parses, every artist in the registry has a show document, every slug and email row points at a real artist, `authsecret` is present. The retention rule is small enough to remember and long enough to cover a purge discovered late (an account's 30-day deletion window plus a month).

Where: `~/Docs/Project Handoffs/myset-backups/`, owner-only permissions — outside the repo so it can never be committed or published (INVARIANT 10), and inside the folder `mirror-to-ssd.sh` already carries to the SSD, so the SSD copy costs nothing new. The SSD is a mirror, not a second retention: pruned copies leave it too.

## What this makes harder

The copy is the most sensitive file the founder holds — it contains what the app deliberately keeps unservable (the ID-check photos) and every sign-in address. It lives on the laptop and the SSD and nowhere else; losing both loses the backup with the machine. **Restore is still unrehearsed** (ledger, Reliability & security b04): writing back is `netlify blobs:set` per key against a linked site, bypassing every etag the functions rely on, and must be practised against a throwaway site before it is trusted — creating that site is the founder's call.

## What would reverse it

A second operator (then a scheduled copy nobody has to remember becomes worth its moving parts); a store too large for a few minutes of CLI reads (then a real export path); or a real restore showing the copy is not enough.

## How it was verified

`python3 tools/backup.py --dry-run` → 206 keys. The first full copy was taken the same afternoon; its output is in `docs/sessions/2026-09-12-founder-decisions-payouts-branch-backup.md` (the run, the verify report and the size). **Not checked:** a restore — see above.
