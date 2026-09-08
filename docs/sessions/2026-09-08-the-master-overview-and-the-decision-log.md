# The master overview, and a decision log that keeps itself

2026-09-08. Perry's ask, in his words:

> *"please analyze the 'MYSET.md' file in great detail and making sure it is FULLY up to
> date on ALL the latest developments we've made (change the name to
> MYSET-MASTER-OVERVIEW.md) … make sure it is structured for other top level AI's (codex,
> gemini, grok) to be able to immediately understand absolutely every fundamental aspect
> of the project – from the code, to the history of the developments and why each decision
> was made … (side-quest: please implement a system that AUTOMATICALLY updates this file
> when new changes are made) … start with ALL the rules of voting, and all the differences
> in the free/paid membership tiers."*

---

## 1. How stale it actually was

`MYSET.md` was written 2026-09-03 and last verified 2026-09-04. Four working days and
thirty commits later it was wrong in ways that mattered, not just incomplete:

| It said | The truth |
|---|---|
| Free votes come back when the next song starts; votes come back if the artist drops a song | **Neither.** A vote never comes back (2026-09-07) |
| `voteFinal` is a feature flag and it is on | The flag was **deleted** on 2026-09-07 |
| `resetVotes` in the Studio action list | Replaced by `playedNow` / `clearBoard` |
| Clips are capped at 3MB, re-encoded on the phone | **75MB**, uploaded untouched, with a trim screen |
| "1,233 assertions" / "854 assertions" / "1,059 assertions" | **Three different numbers in three sections of one document.** The real figure was 1,716 |

Missing entirely: the account system, sessions and roles, passkeys, the books, featured
shows, room caps and the polling throttle, the money model, the landing-page audit, the
countdown, the dark room, the QR logo, the venue-naming fix, and the open-line report.

## 2. What the new document does differently

`MYSET-MASTER-OVERVIEW.md` (renamed with `git mv`, so the history follows it) is written
for a capable model arriving cold — Codex, Gemini, Grok, or the next Claude session.

- **It opens with how to work here**, not with what the product is: `main` is production,
  nothing may break the gig, the audience never signs in, never claim what you have not
  run, and numbers come from the code.
- **Part 1 is the rules of voting**, in full, because that is what Perry asked to lead
  with and because it is the part everything else serves. It covers the one rule, the
  ledger, the whole cast path in order, what ends a vote's life, a complete *"do I get it
  back?"* table, what the fan is told word for word, concurrency, big rooms, the dark
  room, last call, and what the artist can do to the board — plus a list of the seven
  things deleted on 2026-09-07, so a model reading a stale comment somewhere knows it is
  stale.
- **Part 2 is free versus paid**, with a table of what each plan flag gates and **where on
  the server it is refused**.
- **Part 7 is new**: how the document stays true.

## 3. The system that keeps it true

Two halves, because they fail differently.

### The numbers regenerate themselves

Documents rarely go stale in their prose — somebody rewrites that when the product
changes. They go stale in their **numbers**. And a wrong number is worse than no number,
because a reader who checks one and finds it right trusts the next fifty.

So §2.1 is generated. `tools/overview.mjs` **imports `_plan.mjs`, `_venues.mjs`,
`_lib.mjs`, `_flags.mjs` and `_video.mjs`** and renders their real values: the plan
ladder, the venue ladder, every voting default, the polling rungs computed by calling
`pollFloorFor()` and `boardLimitFor()`, the endpoint list, the shard count, the clip
limit, the invariant count, the test count. **The plan table is not a copy of `PLANS` —
it is `PLANS`, rendered.**

```
node tools/overview.mjs            regenerate the block and the decision index
node tools/overview.mjs --check    exit 1 if either is stale
node tools/overview.mjs --json     every fact as data
node tools/overview.mjs --tests    run the suite and stamp the assertion count
```

Two details that make it honest rather than decorative:

- **A flag named in `NOT_BUILT` reads "coming soon" in every column**, including the plan
  that nominally has it — which is exactly what the Studio renders. A table that disagrees
  with the product is selling a dead end.
- **An unlabelled plan flag still appears**, using its code name. A flag added to
  `_plan.mjs` and not added to the label map shows up ugly and obvious rather than
  silently vanishing from the document.

### Every decision gets a record

`docs/decisions/`, one file each, with front-matter a machine can read (id, title, date,
status, who decided, area, the invariants it created, the commits, the tests that would
fail if somebody undid it). `./tools/decide.sh "what is now true"` scaffolds the next one;
`docs/decisions/README.md` is generated from the front-matter.

Six sections, and the second is the one most decision logs skip:

1. **The question** — and what forced it
2. **The options** — every one genuinely on the table, in a table with *what it costs*,
   *what new moving parts it introduces*, and *what the risk is if it goes wrong*. **"Do
   nothing" is in the table every time.** A comparison that omits it is a justification,
   not a decision.
3. **What was chosen, and why** — *"Perry said so"* is a legitimate and common reason here,
   and writing it down tells a future reader not to argue with it
4. **What this makes harder** — every decision closes something off; name it while it is
   still obvious
5. **What would reverse it** — a decision with no reversal condition is one nobody can
   safely revisit
6. **How it was verified** — what was run and what it printed, and what was *not* checked

### It runs on every commit

`tools/hooks/install.sh` installs two hooks:

- **pre-commit** regenerates the block and the index and stages them.
- **post-commit** writes any commit that touched `netlify/functions/` without a decision
  record into `docs/decisions/PENDING.md`.

**Neither ever blocks a commit.** `main` is production and this repo gets edited between
sets; a hook that refuses a commit at 11pm because a document is out of date is a hook
somebody disables with `--no-verify` and never re-enables. It fixes what it can, says what
it cannot, and gets out of the way.

## 4. The twelve seeded records

The system is complete going forward. Backwards, the twelve decisions that most shape the
code today were written up properly:

| | |
|---|---|
| 0001 | A vote never comes back |
| 0002 | Free votes are an allowance for the night, not for each song |
| 0003 | The free tier is capped by gigs played, not by features |
| 0004 | A locked feature is shown greyed, never hidden |
| 0005 | An unbuilt feature reads "Coming soon" on every plan, including the one that has it |
| 0006 | A room over its plan's size slows down; nobody is ever refused |
| 0007 | Every charge is created on the artist's own Stripe account |
| 0008 | Every stored key must be computable, because `list()` is banned |
| 0009 | Between shows the room goes dark, and nothing is deleted to do it |
| 0010 | The countdown is a nudge, not a lock |
| 0011 | A clip is uploaded exactly as it was filmed |
| 0012 | An open line to the room is the right end state and not the next thing built |

Everything older than that still lives in `INVARIANTS.md` (243 properties, most with the
story of how they were found) and `docs/sessions/`. **The decision folder is complete from
2026-09-08 forward**, and the document says so rather than implying more coverage than it
has.

## 5. Two stale references found on the way

- `netlify/functions/_plan.mjs` named `MYSET.md` as a place the gig cap must be kept in
  step. It now says the plan table is *generated* from that object, which is a stronger
  guarantee than a reminder.
- `public/studio.html` told Perry the Google Sheet walk-through was in `MYSET.md`. **It
  was never there** — it is `GOOGLE-SHEET-SETUP.md`. That is a small piece of visible copy
  pointing at the wrong file, fixed.

## 6. What was asked for and not done

**Chris's agent-config (project bootstrap).** Perry asked for it to be used. It is not on
this machine — searched `~/Docs`, `~/.claude`, `~/Downloads`, and every `.md`, `.json` and
`.txt` under `~/Docs` for "agent-config", "agent config" and "project bootstrap": nothing.
So this was built to the shape Perry described in his own message rather than to Chris's
template. **If he sends it, the decision-record template and the front-matter fields are
the two things to align** — both are one file each to change.

**puzzleapp.io via MCP.** Not connected yet, and no MCP server for it is available in this
session. The front-matter and `--json` output exist so a later export is a mapping job
rather than a re-write.

## 7. Verified

- `sh test/run.sh` — **1,716 assertions, 0 failures**, and the count is now stamped into
  `test/.last-run.json` by the generator rather than remembered.
- `node tools/overview.mjs --check` — clean.
- `./tools/hooks/install.sh --check` — both hooks current.
- `./tools/decide.sh` scaffolded a throwaway record and it was deleted again. Its slug
  came out with spaces in it the first time: BSD `sed` has no `\+` in a basic regex, so
  the whole substitution silently did nothing. Fixed with `-E`.
