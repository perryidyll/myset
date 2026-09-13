---
tab: Money
section: Past shows and the money model
puzzle_section_id: 41977
sources:
  - netlify/functions/_history.mjs (archiveShow, moneyForShow, reconcileShow, healHistory, placeShows), _lifecycle.mjs endShow, admin.mjs (played/ended/declined history reads; sheetSync)
  - netlify/functions/moneymodel.mjs; finance/README.md, finance/model.html, finance/actuals.json, finance/marks.json
  - tools/actuals.py, tools/actuals-test.py, tools/loadsim.py
  - MYSET-MASTER-OVERVIEW.md §3.3 Money, §3.8, §5.7
  - docs/decisions/0031, 0032, 0057
  - docs/sessions/2026-09-05-money-model.md
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps)
verified: code read 2026-09-12 (_history.mjs moneyForShow window; actuals.py header; finance/README.md)
---

# Past shows and the money model

**Who:** the artist looking at what a night made; the founder feeding real nights into the projections. **Trigger:** a show ends (archive); Studio → Money → Past shows; `tools/actuals.py` after a gig week. **Outcome:** every night filed with its songs, votes, leftover wants and money — and a money model whose dials are real numbers, with tests kept out.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| h01 | Archive the night | database | Automation | MySet server R · Artist I | Netlify | `archiveShow` at `endShow` and before a fresh start — **before anything wipes the tally** (INVARIANT 17c). `hist_<aid>_<showId>` plus the index `histidx_`/`histids_` (no `list()`). A night with no song, no vote and no phone is not archived. Nine ways a night could vanish were closed 2026-09-05 (→ *The gig → Shows that start and end themselves*). `src: _history.mjs archiveShow; overview §5.7` |
| h02 | Attach the night's money | database | Automation | MySet server R | Stripe | `moneyForShow(aid, showId, from, to)`: Stripe sessions tagged with this show, inside the night's window (start − 5 min to end + 1 h; **a day is the widest a single night can honestly be** — asking for "everything since the epoch" once listed ten pages of the whole account as one night's untagged money). Buckets votes / tips / unattributed. From 2 to 11 Sep every night read `stripe-unreachable` because an empty options object was passed to stripe-node — decision 0032, INVARIANT 0fc. `src: _history.mjs moneyForShow; decision 0032` |
| h03 | Read the past show | notification | Automation | MySet server R · Artist I | Netlify | Studio → Money → Past shows: the songs played and the votes each won, what the room wanted and never got (`leftover`), the split between vote packs and tips, the room's ratings. One vote counted once. **Bar Star and up since 2026-09-13 (decision 0060, "data reports")**: every night is still filed on every plan; a free plan sees the running night and *N nights filed and waiting* over a See plans button, and the server answers its rows empty and a night's detail 402. `src: overview §3.3 Money, §1.16; history.mjs` |
| h04 | Name these from my calendar | task | Person | Artist R · MySet server R | Netlify | `placeShows`: `show.venue` was one field typed in Settings and every filed night copied it — five nights named after one pub. Behind a button, it renames a filed night **only when a gig on the calendar lines up with it**, and says so. Going forward, a fresh start takes venue and city from the running gig. Still on the founder's own list (PER-005). `src: overview §3.8; _history.mjs placeShows` |
| h05 | Look for missing shows | task | Person | Artist R · MySet server R | Netlify | `healHistory`: rebuilds the artist's index from every id it can name — the answer to the index cap that stranded row 101 and the rows built from the wrong snapshot. Also run daily by the cron in batches. `src: _history.mjs healHistory; overview §5.7` |
| h06 | Reconcile one night | task | Person | Artist R | Stripe | `reconcileShow` re-reads a filed night's money from Stripe (the sweep, per night). `src: _history.mjs reconcileShow` |
| h07 | Sync the voting sheet | task | Automation | Scheduled jobs R · Artist I | Google Sheets | `sheetcron.mjs` writes past shows and votes into the artist's Google Sheet; `sheetSync`/`sheetStatus` from Settings. Same never-throw discipline as the show cron. `src: GOOGLE-SHEET-SETUP.md; INVARIANTS.md § The Google Sheet` |
| h08 | Pull real nights for the model | research | Person | Founder R | — | `python3 tools/actuals.py --write` (read-only, via the signed-in Netlify CLI): every archived night, kept **only if it lines up with a gig on the artist's published calendar** — started between 90 minutes before the slot and its end; two records inside one slot are one night; length is the slot unless the auto-end grace let it overrun. The first gig week otherwise read as 13 nights at 6.7 phones and 4.6 hours: three-quarters tests. Published gigs with no record are listed, so nights-per-week counts what was published. `src: tools/actuals.py; decision 0031` |
| h09 | Mark bandwidth before and after | task | Person | Founder R | Netlify | `tools/actuals.py --mark` records Netlify bandwidth readings into `finance/marks.json`; the script solves polls per phone-hour out of consecutive marks. `src: finance/README.md` |
| h10 | Update the money model | task | Person | Founder R | Netlify | Paste `actuals.json` into the dashboard's *Real shows* panel (`/moneymodel`, behind a passcode, served by `moneymodel.mjs` from `finance/` outside the published folder — INVARIANT 0ec). Inputs are labelled **measured / published / simulated / guessed**, and the page says which. Every projection is a projection: one paid gig to date. `src: finance/README.md; ledger metrics` |
| h11 | Test the night rules offline | task | AI Agent | Coding agent R | — | `python3 tools/actuals-test.py` against `finance/fixtures/2026-09-11/` (a read-only snapshot, nothing secret) and the bandwidth solver on synthetic marks; `node finance/model-test.mjs` for the engine. `src: finance/README.md` |
| h12 | Name a night by hand | task | Person | Artist R · MySet server R | Netlify | Studio → Money → Past shows: tap the night's name (or the name at the top of an opened night) and type what it was called — the ask of 2026-09-12 for a show started by hand, which `placeShows` can never name because no gig lines up with it. `POST /api/history {action:'rename', show, title}` → `renameShow`: the detail document gets `title` + `titleByHand:true`, then the index row gets `title`; a richer re-archive keeps both (INVARIANT 0fm); 100 characters, whitespace folded; owner-only by key, so another artist's showId is a 404. Unchanged, blank and cancelled prompts send nothing; the past-shows search finds a night by its typed name. Decision 0057. `src: _history.mjs renameShow; history.mjs; studio.js renameNight; test/histname.mjs` |

## Connections

h01 → h02 → h03; h03 → h04 / h05 / h06 / h12 (artist tools); h01 → h07 (nightly); h01 → h08 → h10; h09 → h08; h08 → h11.
