# Agent guide — MySet

Canonical shared instructions for any coding agent working in this repository.
Cursor, Codex, Gemini CLI and other AGENTS.md-compatible tools load this file
directly; Claude Code loads it through the `CLAUDE.md` import shim.

**MySet is live at https://myset.vip.** Real musicians run real gigs on it and real
audiences pay real money through it. There is no staging site.

---

## Read this before your first edit

**`main` IS production.** Anything that lands on `main` deploys to myset.vip in about
a minute. Since 2026-09-12 nothing lands on `main` except through a pull request
(decision 0045): a direct push is refused by GitHub, every PR gets a free deploy preview
to look at first, and merging is the deploy. No staging, no reviewer — the PR is a
pause, not a gate. A bad merge is a live outage during somebody's show.

**You never commit and you never push unless the user asks you to.** Produce changes
in the working tree and stop. If you are asked to push, run the tests first.

**Another session may be editing this repo.** Check `git status` before you start. If
there are changes you did not make, stop and say so rather than building on them.

**Work in a worktree cut from `origin/main`,** never in the shared checkout at
`~/Docs/MySet`: it is far behind `main`, it holds other sessions' leftovers, and a
session started there reads a stale copy of this file. Stage files by name — never
`git add -A`.

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
5. **Never use Netlify Blobs `list()` for live data.** Every key must be computable.
   INVARIANT 1.

## Where you may work

| Area | Path | Rule |
| --- | --- | --- |
| Pages | `public/*.html` | Hand-written, self-contained, no build step. What you see is what ships. |
| Shared fan script | `public/fan.js` | The sheet, the toast, the share sheet, the date words, the strips — one copy for every fan page (decision 0087, INVARIANT 0gc). A page never redeclares a name it declares; run `node tools/stamp.mjs` after ANY edit. |
| Shared styles | `public/app.css` | Careful — it rides **inline in all nine fan pages** (decision 0094): after ANY edit run `node tools/stamp.mjs`, or the structure test refuses the stale copies. **Neither Studio loads it.** |
| Studio styles | `public/lock.css` | Loaded by both Studios and nothing else. |
| Studio scripts | `public/studio.js`, `public/venue-studio.js` | Each Studio's whole script, addressed by its own hash (decisions 0053, 0054). **After ANY edit run `node tools/stamp.mjs`** — it rewrites the `?v=` in the page; `test/structure.mjs` fails otherwise. |
| Service worker | `public/sw.js` | **Do not touch** without the founder's word and a decision record (0091 was one). A mistake serves stale pages to everyone; `test/sw.mjs` runs the real worker. |
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
node tools/roomsim.mjs '{"P":5000,"burst":1500,"burstSec":20}'   # a big room on a virtual clock (a model: see its header)
node tools/mock.mjs                # look at every page against a fake API on localhost:8787 — touches nothing live
python3 tools/prod.py              # read-only health report of the LIVE site
python3 tools/backup.py --coverage # is every document in the store also in the off-site copy?
python3 tools/backup.py --from-r2  # read the off-site copy back, into the folder --restore reads
node --import ./test/register.mjs tools/localhost.mjs   # the whole site on localhost:8950 with the REAL functions on an in-memory store (writes work); open /dev
```

**No install step in a worktree.** `node_modules` is never tracked (decision 0116). A worktree under `~/Docs/MySet/.claude/worktrees/` uses the shared checkout's, because Node looks for packages in every parent folder; a checkout anywhere else runs `npm ci` once (the two locked dependencies, nothing new). Never delete `~/Docs/MySet/node_modules`: every worktree reads it.

**`netlify dev` cannot run the write paths** — its storage sandbox returns no version
tag, so every write after the first fails as busy. Use the test suite, or
`tools/localhost.mjs` — the real functions through the suite's module hook, so the
store is in memory with working etags, Stripe is the fake, and nothing touches
production; it seeds a Bar Star artist and `/dev` signs the browser in.

**After any change to `casDoc`, the fan files or the vote path**, run `tools/roomsim.mjs` by hand at the sizes that matter as well: the suite's `test/contention.mjs` holds the shape (nothing lost, nothing dropped), not every size (INVARIANT 0ht).

**A new kind of document needs one line in `FAMILIES`** (`netlify/functions/_mirror.mjs`): who copies it off-site, or why nobody does. The suite's last step fails on a key no line matches (INVARIANT 0hs).

**A green suite proves nothing about a page.** Look at it in a real browser at phone
width. Several defects a month are invisible to the tests and obvious on screen.

## Deploying

`main` is protected (decision 0045): direct pushes are refused, force-pushes and deletion
are blocked, and the only way in is a pull request — with zero required approvals, so the
person shipping merges their own. Merging **is** the production deploy.

```bash
sh test/run.sh
git switch -c <area>/<what-changed>          # in a worktree off origin/main
git add <each file you changed>               # by name, never -A — and only when asked
git commit
./tools/pushlog.sh "what changed" "note"      # the push log entry rides on the branch
git push -u origin HEAD
gh pr create --fill                           # Netlify posts a deploy preview; the suite runs as a check
gh pr checks <n> --watch                      # wait for `suite` to pass
gh pr merge <n> --squash --subject "… (#<n>)" # this is the deploy; keep the PR number
git push origin --delete <area>/<what-changed>
```

`gh pr merge --delete-branch` fails from a worktree while `main` is checked out in the
shared checkout, and leaves the branch on GitHub — delete it yourself, as above.

Look at the deploy preview before merging — it is the "real browser at phone width"
check, on the exact bytes that will ship. A preview cannot charge a card (the Stripe
secrets are unset outside production) but it **reads and writes production data**.

**Every pull request runs the suite** (decision 0144): `.github/workflows/tests.yml`
runs `sh test/run.sh` on GitHub's machine and reports it as the check named `suite`.
It takes about six minutes. Wait for it to go green before merging; a red one is a broken build, not a formality.
Running it yourself first is still the fast way to find out.

Doc-only work puts `[skip ci]` in the **merge subject**, never in a branch commit:
`gh pr merge <n> --squash --subject "… [skip ci] (#<n>)"`. The marker in the merge is
what stops Netlify billing a production build. The same marker in a branch's last
commit stops the `suite` check from running at all, and a check that never runs
blocks the merge. A `[skip ci]` merge builds nothing, so it never carries a change
that needs a fresh production build. The other direction still holds: a squash folds
every branch commit message into the merge, so a code change must not have the marker
anywhere in its branch's messages.

**Never also run `netlify deploy --prod`** — that bills a second deploy for the same
change and races over what is live (INVARIANT 9d3).

**Verify by CONTENT, never by status code.** A catch-all slug redirect answers 200 for
files that do not exist. Fetch the page and grep for the thing you changed.

## Session workflow

### Default working mode

Use the repository's **Efficient Mode** workflow by default for ordinary MySet batches:
sequential targeted inspection, surgical edits, focused checks, one full gate, and one
preview. Switch to a deep investigation only when the user asks or the risk demands it.

### At session start

**First, read the top of `docs/PUSH-LOG.md`** — what the other sessions pushed, in three lines each. Then
read `IMPLEMENTATION_STATUS.md` — current focus, next work item, blockers, deviations.
Do not redo `done` rows unless the evidence is invalid.

On this Mac, also read the live sessions board, `~/Docs/Project Handoffs/MYSET-SESSIONS-BOARD.md`
(outside the repo on purpose): who is working where, which numbers are claimed but not
yet on `main`, and the merge order. Claim a decision or INVARIANT number there before
you use it — `./tools/decide.sh` only sees what is already on your branch.

Then `python3 tools/backup.py --if-stale` — a read-only copy of the live datastore if the
newest one is over a week old (decision 0046). A few minutes, touches nothing on the
site; it is the only backup MySet has.

### Before every push

Run `./tools/pushlog.sh "what changed, for a person" "what another session must know"` as the
last step, then push. The pre-push hook refuses a push whose commits do not touch the log.

### Before ending a session

After work that changes execution state, evidence, decisions, risks or the next action:

| Where | What |
| --- | --- |
| `IMPLEMENTATION_STATUS.md` | Refresh the header, set statuses with **evidence** (paths, commands, commit SHAs), add decisions, record deviations, note new risks |
| `docs/decisions/` | A record for anything that could have gone another way — `./tools/decide.sh "what is now true"` |
| `docs/sessions/` | One file per working session: what was asked, what shipped, what broke, what was verified |
| `docs/processes/` + Puzzle | **Does Puzzle need updating?** — a mandatory handoff question. Anything that changed a process, a rule, a cited number, a decision or a surface updates its sheet under `docs/processes/<tab>/` and its Puzzle section in the same session; a new decision record gets a changelog entry the same day (`docs/processes/CONVENTIONS.md` § Keeping it true) |
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
