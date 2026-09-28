---
title: The MySet Map — executive report on the ten-phase Puzzle mapping
date: 2026-09-12
artifact: https://claude.ai/code/artifact/5aae8c83-7ed7-4d18-b4f3-7bfc8046de73
---

Executive report · 12 September 2026 · puzzleapp.io workspace 13099
# The MySet Map — every process, on one canvas

Ten phases, one day. Every process MySet runs — in the room, in the money, in the accounts, in the engineering practice, in the business — is now a sheet in the repository and a section on the Puzzle canvas, with the reasons behind each decision beside it. This is what was built, what is noteworthy about it, and what is still unconfirmed.

- **9** workflow tabs, all loaded
- **52** sections (51 sheets + Stripe Connect)
- **549** steps, every one with RACI
- **427** Live — built and running on myset.vip
- **121** Draft — intended, not yet built or run
- **49 / 49** decision records with a changelog entry
- **48** entities · 156 attributes · 163 links to steps

## The one rule

**The repository is the truth; Puzzle is a projection.** Every section on the canvas is loaded from a sheet under `docs/processes/<tab>/` and read back through the API before the sheet is stamped `loaded`. When the two disagree, the sheet is right and the fix is a reload. Nothing in Puzzle carries a number that `tools/overview.mjs` generates — a step says *"the free-vote allowance (overview §2.1)"*, never the figure.

Status means what it says. `Live` is built and running on myset.vip, confirmed in the code or the ledger's evidence. `Draft` is intended and not yet built, or a procedure not yet run. Nothing was marked Live from a document alone.

## Where it stands

The ten-phase plan is complete, including the data model that had slipped between the plan's numbering and the ledger's. From here there are no more phases: the map keeps itself true through one rule now written into `AGENTS.md`, the ledger's handoff checklist and `tools/decide.sh` — *any session that changes a process updates its sheet and its Puzzle section in the same session, and every new decision record gets a changelog entry the same day.*

**Verified today.** Every sheet's row count equals its section's step count (51 of 51). Every step read back on four tabs has a section, a type, a status, an executor and a role; the other six were linked in-session with counts matched at load. All 49 decision records have an entry. The changelog and entity counts were read back after the last write.

**Not yet confirmed.** The canvas itself in a browser — an agent cannot sign in to Puzzle, so no section has been looked at as a drawing. Every sheet is therefore `loaded`, not `verified`; that pass is the founder's and is the gate on `verified`.

*PHASE 0* — 
## Prepare
`done`

The plan (`PUZZLE-MAPPING-PLAN.md`, ten phases with a root-document triage), the rulebook (`CONVENTIONS.md`), and the workspace skeleton: ten workflow tabs named after MySet's domains, four teams (Founder, Agents, Automations, The room), eleven roles so RACI on a step is honest (Fan, Artist, Venue manager and Artist team member are real roles marked *external*), and the tools MySet actually runs on — Netlify, Stripe, Cloudflare R2, GitHub, Resend, Claude Code. The workspace is on Puzzle's Optimizer plan; the free plan's object cap blocked the first write.

**Noteworthy.** The first attempt found MySet's own documentation had drifted: the decision records were renumbered mid-day by another session, so every citation checks `docs/decisions/` before naming a number.

*PHASE 1 · TAB 39034* — 
## The gig
`7 sections · 106 steps · all Live`

| Section | Steps | What it maps |
| --- | --- | --- |
| The fan's night | 20 | Scan → vote → buy → request → last call → the show ends → the dark room. No account, ever. |
| Casting a vote (server path) | 15 | Every check between a tap and a counted vote: validate, resolve, window, replay, affordability, the rate-limit token, charge, verify the write stuck, answer. |
| The artist's night (Studio → Live) | 21 | Start or resume, the gig cap, the setlist, songs on and off the board, decline and refund, last call, end, "was that an accident?" |
| Buying votes and tipping | 13 | The Checkout session and the three delivery paths — the buyer returns, the webhook, the reconcile sweep — replay-safe. |
| Requests and shout-outs | 14 | Song, birthday, mood; the card offer authorised now and captured only when the song is finished. |
| Shows that start and end themselves | 12 | The cron, the one index, the lock, the grace period, the idle end that never cuts a song. |
| The room under load | 11 | Head count, pace, the shared board and the personal call, the throttle, the ceiling, the open line (in progress). |

**Noteworthy.** This is the densest tab and the one where the code disagrees least with the documents. The ranking rule of the whole codebase — *nothing may break the gig; every failure degrades to "the room can still vote"* — is written on the sections' notes and is the reason so many conditionals have one drawn branch: a refusal ends the path.

**Changed today.** Three steps were updated for the one-warm-door merge (decision 0049): the phone now asks `/api/fan?what=board` and `?what=me`; the old addresses still answer.

*PHASE 2 · TAB 39037* — 
## Money
`7 sections + Stripe Connect · 92 steps · 1 Draft`

| Section | Steps | What it maps |
| --- | --- | --- |
| How a payment divides | 9 | The fee ladder by plan, the platform-owner exemption, the venue row's exact split on `charge.updated`. |
| Stripe events arriving | 11 | Signature over raw bytes, route by type, the fee split, the account mirror, the purchase redeemed, 200. |
| Plans and billing | 14 | Checkout to start, the Customer Portal to change, the webhook keeping the registry honest, the failed card, the retention offer, cancel for deletion. |
| Merch orders | 10 | Items on the profile, direct charges, the order record, fulfilment, the venue's version. |
| Featured shows | 10 | A hold inside a compare-and-set before checkout; expires by itself; the tombstone. |
| The books and the monthly close | 11 | Balance transactions bucketed, never recomputed; the founder's gigs separated from the company; costs typed by hand; the statement. |
| Past shows and the money model | 11 | The archive, the money attached later, naming nights from the calendar, the actuals and bandwidth marks for the model. |
| Stripe Connect Onboarding & Payments | 16 | Pre-existing section, kept and corrected (the fee step cites the ladder instead of a copied percentage; payouts daily, decision 0044). |

**Noteworthy.** Stripe is the source of truth for money and the code only ever reads it; the one Draft step is the deliberate refusal to build double-entry in a blob store — a real package when revenue is worth reconciling.

*PHASE 3 · TABS 39035 · 39036 · 39043* — 
## Accounts & venues
`9 sections · 81 steps` `7 Draft`

| Section | Steps | What it maps |
| --- | --- | --- |
| Signing up and signing in | 9 | Email code, passkey, Studio code, recovery code — all landing in one session. |
| Sessions, roles and the team | 10 | The role resolved on every request, revocation for free, sign out here or everywhere, seats, the activity log. |
| Recovery and moving your address | 7 | Recovery codes, moving the inbox with both codes, and the one Draft: "lost everything" is a rehearsal still owed. |
| Verification and the tick | 7 | ID upload compared against Stripe's KYC; on the spot or queued for the founder. |
| Leaving, with thirty days to change your mind | 9 | Export, the two-screen delete, lockdown, billing stopped the same day, the page name held, the purge. |
| A venue's page, from claim to listing | 11 | A second registry on purpose — a bar never runs a show and never reaches an artist's money. |
| Getting verified (three ways) | 9 | The website's domain and name, three artists vouching, the founder's switch; one "still to build". |
| Pitches — "want to perform here?" | 7 | A signed-in artist to a venue's inbox; keen or nope; no address ever exposed. |
| Onboarding a stranger | 12 | Sign-up → Connect → first gig with no help — mapped as intended; five steps Draft because nobody but the founder has done it (GATE-002). |

**Noteworthy.** Onboarding is the honest gap in the whole map: the product is built, and the unaided path has never been walked by a stranger. Its gate is `AUTH_FROM` — no public sign-in mail can be sent until the founder sets it.

*PHASE 4 · TAB 39039* — 
## Engineering operating system
`6 sections · 52 steps · all Live`

| Section | Steps | What it maps |
| --- | --- | --- |
| Starting a session | 9 | Folder and branch, `git status` — is anyone else here?, the push log, the ledger, the reading order, the hooks, the working mode, the stale-copy backup (added today). |
| Making a change | 9 | Rank it — can this break the gig?; which area; do the page and the server agree; no dependencies, no tidy-up; need a number?; the safety list. |
| Testing and looking | 9 | The suite, the real browser at phone width, the two standing notes (a test double must not be kinder than the real thing; `netlify dev` cannot run the write paths). |
| Committing and deploying | 7 | Rewritten today for the pull-request flow: branch → push log → push → PR → squash-merge *is* the deploy. Never `netlify deploy --prod`. |
| Keeping the documents true | 10 | Decision records, superseding never deleting, the ledger with evidence, the session file, **the Puzzle map in tandem**, prose is a human job. |
| Ending a session | 8 | Did anything change → ledger → decisions → session file → *does Puzzle need updating?* → handoffs → report honestly → stop with the tree as it is. |

**Noteworthy.** This tab is where a new agent or hire learns how the repository is worked. Decision 0045 (main protected, PR-only) landed during the mapping and this tab was the first to be updated in tandem — and the other session's next three deploys went through pull requests, which is the first live evidence the rule holds.

*PHASE 5 · TAB 39040* — 
## Reliability & security
`6 sections · 50 steps` `15 Draft`

| Section | Steps | What it maps |
| --- | --- | --- |
| When something breaks on the night | 9 | The uncaught throw, keep the room voting, "something wrong?" from the fan, the reports in the Studio, the two hammers under Settings, the service worker standing down; *page somebody* is Draft — no alerting exists. |
| Watching production | 8 | Read-only health, verify by content never by status code, what a night costs, the credit burn, the function log while it exists; the payments health check is Draft. |
| Secrets and keys | 9 | Where every secret lives, the masked-variable trap, previews that cannot charge, paste, rotate; Draft: the restricted key (unrecorded), the Connect webhook secret, the push keys, the ten-minutes-after-a-leak runbook. |
| The founder's own accounts | 7 | 2FA (Draft — the #1 threat), main protected (done today), scanning, access review, IP assignment, pinned dependencies, the name. |
| Backup and restore | 7 | Written today: `tools/backup.py`, a full verified copy, the rhythm (session start if stale, before every gig), retention; the restore into a fresh store and the rehearsal are Draft. |
| The doors and the threat model | 10 | The front end is public, the doors answer identically, one artist kept out of another's data, refuse the script not the room, hold nothing worth stealing, rank the threats and spend in that order. |

**Noteworthy.** Mapping this tab found that MySet had *no backup of any kind* — the tool, the rhythm and decision 0046 came out of the same afternoon, and the first copy of the live store was taken and verified whole. The fifteen Drafts are the founder's own list, not code.

*PHASE 6 · TAB 39038* — 
## Community & media
`5 sections · 45 steps` `3 Draft`

| Section | Steps | What it maps |
| --- | --- | --- |
| Saying something about a night | 9 | A fan posts about a real archived night, refused or accepted inside the write, likes, reports, take it back. |
| A clip, as it was filmed | 12 | Trim don't shrink, chunked upload, the bytes on R2, the feed without a byte fetched, play by a signed link, the Range, the sweep; Draft: measure it on a real phone. |
| Moderating the page | 8 | Reply, pin, hide (instant, on every plan, strips media on the way in), delete for good (paid), the report count; Draft: a platform-level takedown. |
| Photos on a page | 8 | Slots are addresses not a list; refused if too big or not a picture; never serve the ID photo; cached a year. |
| Lyrics and chords on stage | 8 | LRCLIB fetched once and cached for ever, misses for a month; the artist's own chart; find somebody else's honestly; aligned chords are Draft (decision 0022's open end). |

**Noteworthy.** "Where a night happened" turned out to already live on the Money tab, so it is a `go_to`, not a duplicate section; and the code strips a hidden post's media on the way in — a fact no document had recorded.

*PHASE 7 · TAB 39041* — 
## Marketing & growth
`7 sections · 81 steps` `76 Draft — on purpose`

| Section | Steps | What it maps |
| --- | --- | --- |
| The cold start — outbound and the scenes | 10 | Artists → gigs → footage → content, never the other way; the lead list, ten DMs a day, Scene Zero as a lab not a signal, the phase gates, Scene One by criteria, the Crowd-Controlled Weekend. |
| Recruiting the Founding 50 | 12 | The offer, concierge import, the setup call and dry run, QR cards, the Room Report made by hand, the reaction and testimonial, the badge, the rung log. |
| The gig-to-content pipeline | 11 | Name the question and the prediction before doors, the three hooks first, the shot list, the multiplier, naming, the batch, the fallback ladder. |
| The weekly rhythm and the two-post loop | 13 | Bucket × funnel job, weighted by stage; Monday's vote manufactures Wednesday's reveal; Thursday is sacred; the comment section as a MySet screen. |
| What a post must be | 11 | Channel by role, cut for the platform, a live signal in every frame, hooks from a family, dramatise the objection, fixed franchises, collab posts, the owned list, two accounts with a face. |
| The automation engine | 12 | Ingest → analyse → generate → **the human gate** → produce → publish → measure → learn; the database, the hook bank, the watchlist; what must never be automated. |
| Measuring, reviewing and killing | 12 | Activated gigs a week; like against like; attribution; the weekly, monthly and quarterly rituals; kill rules; the evidence ladder — the two Live steps that bind today. |

**Noteworthy.** This is the first time the 1,348-line strategy exists as procedure. Draft here is a truthful word: the programme has not started, so a step goes Live the week it is actually being done. The strategy assumes several things the product does not have — a practice mode, gig-day reminders, a Room Report share card, a founding-artist badge — each marked so nobody reads a procedure and expects a button.

**Corrected today.** The registry already records a signup *source label* and a *referring artist's slug* at first touch; only the free-text question and franchise UTM discipline are missing.

*PHASE 8 · TAB 39042* — 
## Admin & finance
`4 sections · 42 steps` `19 Draft`

| Section | Steps | What it maps |
| --- | --- | --- |
| The Netlify account | 10 | What the account holds, the bill in credits (deploys are the cost), never pay twice, Personal or Pro (a decision owed), the CLI, the DNS, the registrar, the deploy list. |
| The Stripe dashboard | 10 | One account is two businesses, the event destinations, the restricted key, the Customer Portal in live mode, payouts daily, refunds, disputes, tax — the last three written as Draft because none has happened. |
| Mail, maps and the name | 9 | Resend and `AUTH_FROM`, the mail quota, the Maps key (restricted) and its billing, push keys, the trademark, a privacy policy, the money model's passcode. |
| The money model and the founder's rhythm | 13 | The model, which numbers are measured, published, simulated or guessed; actuals and marks; the monthly close; and the rhythm — session start, before a gig, weekly, monthly. |

**Noteworthy.** Deliberately thin: the code side of every money item is on the Money tab and every secret on Reliability, so this tab is the account-holder's view and aliases wherever a home already exists. It is the tab with the founder's own hands in it.

*PHASE 8b · TOOLS CANVAS* — 
## The data model
`48 entities · 156 attributes · 163 links`

One entity per storage family, attached to the tool where the bytes live: 44 Netlify Blobs key families (from `show_` and the twelve fan shards to `gigsched` and `authsecret`), the clip object on Cloudflare R2, and the three Stripe objects MySet reads — the Checkout Session, the Express account, the Subscription. Attributes are the fields the owning function reads and writes, with their meaning; the first attribute of every entity is linked to the steps that touch the document, so a step's data is one click away on the canvas. Shapes were read from the code, not from the documents.

**Noteworthy.** The overview's storage list omits eight families the code enumerates for export and delete (`sess_`, `log_`, `rec_`, `pkeys_`, `ledidx_`, `feats_`, `bugs_`, `err_`). They are on the canvas; the overview should gain them.

*PHASE 9 · CHANGELOG* — 
## History
`49 of 49 decisions`

Every decision record in `docs/decisions/` is a changelog entry in Puzzle — the options weighed, what each would have cost, what would reverse it — linked to the steps it governs, dated to the day it was decided. Superseded decisions stay, with the header saying so. Three non-decision entries record the overview's generated numbers, the tandem rule itself, and the security pass of 5 September. Two entries today are for decisions another session took while this one ran, which is the tandem rule working across sessions.

*PHASE 10* — 
## Keeping it true
`in force`

The rule is in three places any session will meet: `AGENTS.md` § Before ending a session (*Does Puzzle need updating?*), the ledger's handoff checklist (step 5), and `tools/decide.sh`, which now prints the reminder the moment a record is created. Engineering OS's *Ending a session* carries it as a step. A quarterly read-back of every section against its sheet is the remaining habit, written into the conventions.

## The audit

**Lines up.** 51 sheets ↔ 51 sections, row counts equal (533 steps; the pre-existing Connect section makes 549). Every step on The gig, Money, Artist lifecycle and Onboarding read back with a section, a type, a status, an executor and at least one role; the six tabs loaded in this session had their role links counted at load. 134 conditionals read back with their arrows. Eight "conditionals" that were rules stated as a question were retyped to plain steps, in sheet and canvas.

**Choices, not defects.** By convention a refusal ends a path instead of being drawn as a step, so about forty conditionals show one branch on the canvas — the other is a 402 or a refusal named in the notes. Standing-rule steps (the notes, the "never" rules) have no arrows on purpose. Both are reversible if the canvas reads badly in a browser.

## Still open, or subject to change

- **The founder's browser pass over every tab.** The one thing an agent cannot do. Until it happens no sheet is `verified`, and section layouts that read fine through the API may still need a nudge.
- **121 Draft steps.** 76 are the marketing programme (starts when it starts); 19 admin items owed the founder's hands; 15 reliability items — 2FA on the four accounts, the restricted-key check, the Connect webhook secret, push keys, the restore rehearsal, alerting; 5 in onboarding a stranger; 3 in community; 1 each in money, recovery and venue verification.
- **The founder's own list** (ledger PER-002 … PER-010): Connect destination and secret, Customer Portal live mode, 2FA, `AUTH_FROM`, Maps billing, the money model's passcode now the repo is public, the registrar as a fifth account.
- **Two naming gaps.** The workspace has no content-agent role — the analyst panel sits on *Coding agent*. The code's "founding artist" (the platform owner's account) collides with the strategy's "founding-artist badge".
- **Documents behind the code.** Overview §5.2's storage list is short eight families; §3.7's community copy predates night-picking from the calendar. Both live in another session's tree today.
- **Subject to change by design.** The one-warm-door merge changed three steps today; the Personal-or-Pro decision, the Scene One choice and the marketing stage weighting are all conditionals waiting on evidence.

## What the mapping found along the way

- MySet had no backup of any kind; the first verified copy of the live store was taken during Phase 5 and the rhythm is now decision 0046.
- The repository was public while the hardening guide said private; the founder chose to keep it public (decision 0047) — which is why the money model's passcode fallback in the source now matters.
- The Stripe event destination listened to *Your account* only; every connected-account event was silent behind fallbacks.
- Hiding a community post strips its media on the way in; nothing had said so.
- The registry already carries first-touch attribution for a signup.
- The Puzzle API takes an entry's title from the first Markdown heading; a heading on its own line makes an *Untitled* entry.

Every one of these is in the ledger, a session note or a decision record. Nothing here was committed or pushed by the mapping sessions; the working tree holds the work.
