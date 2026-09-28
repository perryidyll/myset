---
tab: Reliability & security
section: When something breaks on the night
puzzle_section_id: 41993
sources:
  - netlify/functions/_errlog.mjs (logErr, guard, saveBug, readBugs, hourKey, KEEP_PER_HOUR, BUG_HOURS, KEEP_BUGS, BUG_EVERY), bug.mjs, admin.mjs (bugList), _lib.mjs (paymentsEnabled)
  - public/vote.html ("Something wrong?"), public/studio.html (If something looks wrong), public/pull.js, public/sw.js
  - INVARIANTS.md 9, 0aw, 0ax, 0fb
  - MYSET-MASTER-OVERVIEW.md §1.11, §1.12 (the two protections), §5.8 (pull to refresh, installable)
  - docs/decisions/0013 (superseded), 0029
  - IMPLEMENTATION_STATUS.md GATE-004, P3-004, open risk "Nobody is alerted when something breaks"
status: loaded
loaded: 2026-09-12 (create_process; read back through list_sections and list_steps)
verified: code read 2026-09-12 (_errlog.mjs constants and guard; bug.mjs; studio.html "If something looks wrong")
---

# When something breaks on the night

**Who:** the server, a fan in the room, the artist on stage; the founder the morning after. **Trigger:** a request throws, or a page misbehaves on somebody's phone. **Outcome:** the room can still vote (rule 1 — every failure degrades to that); what broke is written somewhere that outlives Netlify's 24-hour log; a fan can say so in one sentence without signing in; and the artist can read both sides of it in the Studio. **What does not happen: nobody is paged.**

The ranking rule for this whole tab: nothing may break the gig. The shape of every safeguard here is *catch it, note it, answer something honest, keep going*.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| i01 | Catch the uncaught throw | conditional | Automation | MySet server R | Netlify | Every public handler is wrapped in `guard(where, h)`: a throw becomes a 500 with one sentence — *"Something went wrong on our side — it has been noted"* — never a stack trace to a phone. `test/errlog.mjs` proves every public handler is wrapped. `src: _errlog.mjs guard; decision 0029` |
| i02 | Write it into the hour's document | database | Automation | MySet server R | Netlify | `logErr`: one document per hour under a computable key (`err_<ISO hour>`, so no `list()` — INVARIANT 1), capped at `KEEP_PER_HOUR` rows, each a cut-short message and stack plus a route and a fan id — never a body, never an email. Logging must never throw and never slow the failing request: a few CAS tries, then give up silently; the `console.error` line still reaches Netlify's own 24-hour log. **The store being down is the one failure this cannot record.** `src: _errlog.mjs logErr, hourKey; INVARIANT 0fb` |
| i03 | Keep the room voting | conditional | Automation | MySet server R · Fan I | Netlify | The degradation ladder, in order: payments off → the app works fully with no buy button (INVARIANT 9); a Stripe return that never comes back → `/api/confirm`, the webhook and the reconcile sweep are three independent paths to the same grant (→ *Money → Stripe events arriving*); a shard write that reports success without sticking → re-read and retry (§5.2 rule 4); a burst of voters → 12 fan shards; a script → the cast token bucket (→ *The gig → The room under load*). Nothing on this list needs a person awake. `src: overview §1.11, §5.2; INVARIANT 9` |
| i04 | "Something wrong?" from the audience | form | Person | Fan R · MySet server R | Netlify | The link on the voting page. Public and anonymous like `/api/vote`: a device id, one sentence, and the last things the page itself saw fail. An empty report is refused (*"Say what went wrong first"*); the same device is thanked but not stored twice inside `BUG_EVERY`; a rejected report never looks like a failure to the fan — they were helping. `src: bug.mjs; vote.html` |
| i05 | Attach the server's last hours | database | Automation | MySet server R | Netlify | `saveBug` stores the fan's note under `bugs_<aid>` (capped at `KEEP_BUGS`) together with the last `BUG_HOURS` hourly error documents — so the report carries what the phone saw **and** what the server saw in the window before it. The error log is global per hour, not per artist: on a busy night a report includes other rooms' errors. Acceptable at today's scale; the first thing to change if it stops being. `src: _errlog.mjs saveBug; decision 0029 § What this makes harder` |
| i06 | Read the reports in the Studio | notification | Automation | MySet server R · Artist I · Founder I | Netlify | Studio → Money → the reports, under the money (`bugList`: it routes through `PLAN_ACTIONS` but sits behind the founder gate, so only the founding page's owner seat reads it — decision 0099; since decision 0100 the Studio draws the card for that seat only, so no other artist sees a card that could never fill). GATE-004 — *a bug reported by a fan can be traced without reproducing it* — is **done** on this step. `src: admin.mjs bugList; ledger GATE-004, P3-004` |
| i07 | The two hammers under Settings | task | Person | Artist R | Netlify | Studio → Settings → **If something looks wrong**: *Reload the Studio* and *Clear what's stored on this phone* (`hardReset`, throws away the offline copy, keeps the sign-in). Pull-to-refresh is the first hammer on every page (`pull.js`) — but it is JavaScript, so it cannot rescue a page whose JavaScript is broken; that is what the two buttons are for. `src: studio.html "If something looks wrong"; overview §5.8` |
| i08 | The service worker stands down | conditional | Automation | MySet server R · Fan I | Netlify | `sw.js` never caches anything under `/api` (a cached vote is a lost vote — INVARIANT 0aw), never precaches, and navigations are network-first — so a bad deploy is fixed by the next deploy, not by asking somebody in a bar to clear a browser (0ax). A page can post `myset-unregister` to make the worker quit entirely. **Agents do not touch `sw.js`** (AGENTS.md § Where you may work). `src: public/sw.js; INVARIANTS.md § The service worker` |
| i09 | Page somebody | notification | Automation | MySet server R · Founder I | — | **Draft — not built.** Errors are kept, nobody is told. A silent failure runs until a person looks, which on 2026-09-08 was a fan tapping a dead buy button. Sentry's free tier over raw HTTPS (decision 0013's design, now the *next* step after 0029) or a Netlify alert on a 5xx spike is the half that is missing. Ledger open risk *"Nobody is alerted when something breaks"*. `src: SECURITY.md Tier 1; decision 0029 § What this makes harder` |

## Connections

i01 —throws→ i02 → i03; i03 —the room→ i04 → i05 → i06; i06 —the morning after→ *Watching production* u01; i07 and i08 hang off i03 (the phone's side); i02 —Draft→ i09.
