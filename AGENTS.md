# Agent guide — MySet

Canonical shared instructions for any coding agent working in this repository.
Cursor, Codex, Gemini CLI and other AGENTS.md-compatible tools load this file
directly; Claude Code loads it through the `CLAUDE.md` import shim.

**MySet is live at https://myset.vip.** Real musicians run real gigs on it and real
audiences pay real money through it. There is no staging site.

---

## Read this before your first edit

**`main` IS production.** A push to `main` deploys to myset.vip in about a minute.
No staging, no review gate, no approval step. A bad commit is a live outage during
somebody's show.

**You never commit and you never push unless the user asks you to.** Produce changes
in the working tree and stop. If you are asked to push, run the tests first.

**Another session may be editing this repo.** Check `git status` before you start. If
there are changes you did not make, stop and say so rather than building on them.

---

## Startup checklist

1. **`IMPLEMENTATION_STATUS.md`** — current focus, next work item, blockers. Start here.
2. **`MYSET-MASTER-OVERVIEW.md`** — what MySet is, every rule of voting, the plan
   ladder, the architecture, and why each decision went the way it did. Its Part 0 is
   the long form of this file.
3. **`INVARIANTS.md`** — properties that must survive every change, most discovered by
   being broken. **Read the relevant section before touching money, storage or access.**
4. **`docs/decisions/`** — why a design is the way it is, and what would reverse it.
   Read the relevant record before arguing with a design.

## Documentation authority

| Question | Source of truth |
| --- | --- |
| What is being worked on right now? | `IMPLEMENTATION_STATUS.md` |
| What is MySet, and what are the rules? | `MYSET-MASTER-OVERVIEW.md` |
| What must never break? | `INVARIANTS.md` |
| Why was X decided? | `docs/decisions/` |
| What happened on a given day? | `docs/sessions/` |
| Sign-in, roles, recovery, leaving | `ACCOUNTS.md` |
| How money is tracked | `ACCOUNTING.md` |
| Threat model and posture | `SECURITY.md` |
| Any number (prices, caps, counts) | §2.1 of the master overview — **generated from the code** |

**Never type a number into a document that could be read out of the source.** If you
need one that is not in §2.1, add it to `tools/overview.mjs`.

## The rules that rank every trade-off

1. **Nothing may break the gig.** Every failure must degrade to *"the room can still
   vote"*. This is the ranking function for every decision in this codebase.
2. **The audience never signs in.** Anonymity is why it works in a bar. Any design that
   needs a fan to have an account is the wrong design.
3. **Never show the room a button that leads to a shrug.** If the server will refuse it,
   the page must not offer it — and if the page offers it, the server must allow it.
4. **Never claim what you have not run.** Say "verified" only about things you executed
   and can quote the output of. Everything else is "not checked". An honest gap beats a
   confident guess.
5. **A vote is spent when it is cast and never comes back.** See
   `docs/decisions/0001-a-vote-never-comes-back.md`. Do not propose a refund mechanic.
6. **Never use Netlify Blobs `list()` for live data.** Every key must be computable.
   INVARIANT 1.

## Where you may work

| Area | Path | Rule |
| --- | --- | --- |
| Pages | `public/*.html` | Hand-written, self-contained, no build step. What you see is what ships. |
| Shared styles | `public/app.css` | Careful — but note **neither Studio loads it**. |
| Studio styles | `public/lock.css` | Loaded by both Studios and nothing else. |
| Service worker | `public/sw.js` | **Do not touch.** A mistake serves stale pages to everyone. |
| Server | `netlify/functions/**` | Money, sign-in, sessions, roles, payouts, Stripe. Read `INVARIANTS.md` first and **write a decision record**. |
| Config | `netlify.toml`, `package.json` | Only with a stated reason. |

**Do not add dependencies.** No npm packages, no CDN scripts, no fonts, no analytics.
There are exactly two dependencies and it stays that way.

**Do not reformat, rename or "tidy up".** If the diff is bigger than the change you
described, something went wrong.

## Build and test

```bash
sh test/run.sh                     # the whole suite; no dev server, nothing touches production
node tools/overview.mjs            # regenerate the master overview's numbers
node tools/overview.mjs --tests    # run the suite and stamp the assertion count
node tools/sheetcheck.mjs          # bottom-sheet touch behaviour, real touch events
node tools/uicheck.mjs             # rendered layout in a real browser
python3 tools/prod.py              # read-only health report of the LIVE site
```

**`netlify dev` cannot run the write paths** — its storage sandbox returns no version
tag, so every write after the first fails as busy. Use the test suite.

**A green suite proves nothing about a page.** Look at it in a real browser at phone
width. Several defects a month are invisible to the tests and obvious on screen.

## Deploying

```bash
sh test/run.sh && git push
```

`git push` to `main` **is** the production deploy. **Never also run `netlify deploy
--prod`** — that bills a second deploy for the same change and races over what is live
(INVARIANT 9d3).

**Verify by CONTENT, never by status code.** A catch-all slug redirect answers 200 for
files that do not exist. Fetch the page and grep for the thing you changed.

## Session workflow

### At session start

Read `IMPLEMENTATION_STATUS.md` — current focus, next work item, blockers, deviations.
Do not redo `done` rows unless the evidence is invalid.

### Before ending a session

After work that changes execution state, evidence, decisions, risks or the next action:

| Where | What |
| --- | --- |
| `IMPLEMENTATION_STATUS.md` | Refresh the header, set statuses with **evidence** (paths, commands, commit SHAs), add decisions, record deviations, note new risks |
| `docs/decisions/` | A record for anything that could have gone another way — `./tools/decide.sh "what is now true"` |
| `docs/sessions/` | One file per working session: what was asked, what shipped, what broke, what was verified |
| `~/Docs/Project Handoffs/` | `HANDOFF-MySet.md` and `PORTFOLIO-MASTER-BRIEF.md` |
| The SSD | `~/Docs/Project\ Handoffs/mirror-to-ssd.sh` |

Prefer the **status-ledger** skill for the ledger, and **project-audit** to check this
repo still scores well.

Do not edit the status ledger after read-only questions or reviews that found nothing.

## Safety

- **Never commit a secret**, and never print one into a chat window. All secrets live in
  Netlify's environment. A Netlify variable marked secret returns a placeholder through
  the API, not the value — that is correct behaviour and has already caused one false
  diagnosis.
- **Only `public/` is published.** Publishing the repo root once exposed docs and
  backups on the live domain.
- **Never invent gig data.** A listed gig sends a real person to a real bar.
- **A deploy preview shares production data.** Use previews to look at pages, never to
  exercise a write path.
- The story about "two nights that shaped the product" is **false**. The first MySet gig
  had **no failures**. Do not cite either.
