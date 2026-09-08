# AGENTS.md everywhere, the open line as a report, and everything on GitHub

2026-09-08, second pass. Perry's list, in his order.

---

## 1. The Gemini guardrails are gone; Chris's config is in

Removed: `MySet/GEMINI.md`, the iOhm landing site's `GEMINI.md`,
`Project Handoffs/USING-OTHER-AI-SAFELY.md`, and `MySet/tools/ai-handoff.sh` (which
existed only to bundle the first one).

In their place, `~/Docs/agent-config` — a fork of
[chrispalmo/agent-config](https://github.com/chrispalmo/agent-config), kept ~99% identical
with `upstream` wired up, pushed to `perryidyll/agent-config` (private). Four files
differ, plus one addition described below.

## 2. "Do I have to run interview and proofread by hand?"

Half yes, and the half that was no is now automatic.

Six of the eleven skills carry `disable-model-invocation` — `interview`, `reverse-brief`,
`pause-for-review`, `plaintext`, `github-init` — so a model cannot start them. That is
Chris's design and it is right: an interview that begins uninvited is an interruption.
The other five (`project-audit`, `project-bootstrap`, `status-ledger`, `ingest`,
`proofread`, `design-tool`) can be used on judgement.

Perry's actual question was *"or at least ask if i want to run them before moving
further"*, which is a mechanism, not an explanation. So the fork gained a fourth rule,
`offer-the-right-skill`: **offer them in one line at the moment they help, never as a
blocking question, never twice for the same piece of work.** It also makes two things
standing habits rather than offers — updating the status ledger at the end of a working
session, and running `project-audit` on arriving in an unfamiliar repo.

Kept in its own file so a merge from upstream never has to reason about it.

## 3. The four documents MySet did not have

`project-audit` scored MySet **64/100, Partial**, capped there by the rubric's hard gate
on a missing status ledger. It named two gaps and both are closed:

- **`AGENTS.md`** — the file Codex, Cursor and the Gemini CLI read automatically. This is
  what `GEMINI.md` was reaching for, done once for every vendor instead of one at a time.
- **`IMPLEMENTATION_STATUS.md`** — the genuinely missing one. MySet recorded decisions,
  invariants and history well and had **nowhere that said what was being worked on right
  now**.
- **`VISION.md`** — six explicit non-goals and, more useful, kill criteria.
- **`IMPLEMENTATION_PLAN.md`** — Phases 0–2 recorded as complete, Phase 3 live.

## 4. `docs/reports/open-line.html`

The markdown note became an eleven-section report in the room-ceiling house style. What is
new beyond the note:

**Hibernation, which the earlier note missed and which changes the arithmetic.** When
nothing has happened for a short while, Cloudflare evicts the object from memory **while
the phones stay connected** — the connections are held by Cloudflare's network and the
keep-alive pings are answered without waking anything. *"Billable Duration charges do not
accrue during hibernation."* So a quiet gig costs almost nothing. The catch: waking is a
fresh start with no memory, so anything that must survive has to be written down.

**The cost table, where the finding is the shape rather than the number:** 0.2¢ at 20
people, 1.7¢ at 200, and 1.9¢ at ten thousand. **From 200 upward it stops moving.** On
Netlify the bill tracks how many people came; on Cloudflare it tracks how long the gig
lasted.

**The limit that is not on any limits page:** a Durable Object lives in one data centre
and Cloudflare documents **no automatic failover**. So the open line can never be the only
way to see the board — which is the honest answer to the redundancy question, and the
fallback already exists.

**Chris's eight questions**, each with a recommendation. Two changed my view:

- **Microservices: MySet already has the isolation and got it free.** Every endpoint is
  its own function sharing no process. What *is* shared is the datastore, and splitting
  that trades an outage risk for a correctness risk — a vote needs the show record and the
  fan record in one breath. **Clips are the one component worth isolating**, and that was
  already on the list.
- **A massive gig barely touches other gigs on compute — but it burns credits from the
  same balance as every other site, and at zero credits Netlify pauses all of them.** A
  runaway MySet night could take iohm.io down with it. That is a portfolio risk and it was
  written down nowhere.

**And the urgent one.** *"Are you keeping error logs?"* No. **Netlify keeps function logs
for 24 hours** and Log Drains are Enterprise-only, so a bug reported the morning after a
gig is already unprovable. Sentry's free tier closes it for nothing, in ~40 lines with no
new dependency — the same choice already made for WebAuthn and the QR encoder. Decision
record `0013`.

**Build order:** error tracking → a cast rate limit → the shared-board split → clips on R2
→ the open line. The open line is last despite being the best end state, because items 3
and 4 are steps toward it and buy most of the same headroom without adding a platform.

## 5. Everything on GitHub

Ten private repos, each with a tailored `AGENTS.md`. New: `project-handoffs`, `iohm`,
`iohm-landing`, `idyll-mastery`, `clients`.

Two things had to be got right rather than bulk-uploaded:

- **iOhm is a container.** Two directories inside it are their own git repositories, and
  git stores a repo-inside-a-repo as a pointer — a clone would have found them empty and
  misleading. `iohm-landing` became its own repo (it is the live site, and worth having);
  the 1.3GB binaural audio stays on the SSD.
- **250MB of client photography** went in on the first pass — untouched camera originals
  from WeTransfer dumps that no page references. Excluded; the sites use optimised `.webp`
  and are unaffected. Clients went from 257MB of git to 44MB.

Deliberately left off: heavy media everywhere, RoofEngine (1.9GB of podcasts and photos,
no code), the Finder copy of the social output, **Wellmee — which belongs to the company,
not to Perry** — and the personal and legal folders, which were not touched.

## 6. Two things fixed on the way

- **Both reports were being served as mojibake.** Em dashes and cent signs rendered as
  `â€"` and `Â¢` because neither file declared a charset. Both do now.
- The master overview still listed `GEMINI.md` and `tools/ai-handoff.sh` in its document
  table after they were deleted.

## Verified

- `sh test/run.sh` — 1,716 assertions, 0 failures
- `node tools/overview.mjs --check` — clean
- `./scripts/test-install.sh` in agent-config — all 12 checks pass, with the new rule
- The report rendered in a real browser and read back; encoding confirmed fixed
- Every repo listed by `gh repo list` and confirmed private
- SSD mirrored and spot-checked: the four new MySet documents and the report all present
