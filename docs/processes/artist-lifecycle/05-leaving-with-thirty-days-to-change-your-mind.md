---
tab: Artist lifecycle
section: Leaving, with thirty days to change your mind
puzzle_section_id: 41982
sources:
  - netlify/functions/_account.mjs (exportArtist, keysFor, startDeletion, cancelDeletion, freeSlug, DELETE_GRACE_MS, DELQ), admin.mjs (accountExport, accountDelete, accountUndelete, accountFreeSlug), _billing.mjs cancelForDeletion, autocron.mjs (the purge), _auth.mjs publicArtist
  - ACCOUNTS.md §2, §6.6
  - MYSET-MASTER-OVERVIEW.md §2.7
  - INVARIANTS.md 0bu
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps)
verified: code read 2026-09-12 (_account.mjs startDeletion/cancelDeletion/freeSlug; the 423 rule in ACCOUNTS.md)
---

# Leaving, with thirty days to change your mind

**Who:** the account owner. **Trigger:** Settings → Your account → *Download my data* / *Delete my account*. **Outcome:** everything MySet holds as one file; and a deletion that locks the account **down** on day one, never locks the owner **out**, and purges after the grace period in `_account.mjs` — during which **not one document moves**.

The founder's words: *"a 2-step double confirmation they have to click twice before their account is deleted (but still keep all the data stored somewhere)."* The founder's own account cannot be deleted from the app.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| q01 | Download my data | document | Person | Artist R · MySet server R | Netlify | `accountExport` → `exportArtist`: every document `keysFor(aid)` names (show, fans, meta, history, events, lists, profile, posts, billing, ledger, passkeys…) as one JSON file — **never a fan's device id** (INVARIANT 0bu; stripped from tips and orders before they leave). Owner and member may export. `src: _account.mjs exportArtist; ACCOUNTS.md §4` |
| q02 | Delete my account — two screens | form | Person | Artist R | Netlify | Owner only (403 otherwise). Two confirmations, and the word `DELETE` typed (`confirm: 'DELETE'` in the body). `src: admin.mjs accountDelete; ACCOUNTS.md §4` |
| q03 | Lock the account down | database | Automation | MySet server R · Artist I · Fan I | Netlify | `startDeletion`: the registry row is marked `del = {at, by, purgeAt, slugFreed:false}`; `publicArtist` refuses it, so **every public endpoint 404s for free** — the page, the voting screen and the community page go dark. Any running show is filed; the calendar comes out of the city and schedule indexes. **Sessions are not killed and `rev` is not bumped** — the owner must be able to get back in to undo. `src: _account.mjs startDeletion; ACCOUNTS.md §6.6` |
| q04 | Stop billing the same day | payment | Automation | MySet server R | Stripe | `cancelForDeletion` cancels the subscription immediately — never keep charging somebody who has left. → *Money → Plans and billing* p14. `src: _billing.mjs cancelForDeletion` |
| q05 | Answer 423 to everything else | conditional | Automation | MySet server R · Artist I | Netlify | Every Studio action except undo, export, the plan and the portal answers **423** with the sentence that tells them the way back. Soft delete locks the account down; it must never lock the owner out. `src: ACCOUNTS.md §6.6` |
| q06 | Hold the page name | conditional | Automation | MySet server R | Netlify | The slug is **held for the whole window** — page names are printed on QR codes stuck to bar tables; freeing it would let a stranger take it and land a room on somebody else's setlist, and Undo would be a promise the system could not keep. The banner offers `accountFreeSlug` → `freeSlug` as a deliberate act, not a surprise. `src: _account.mjs freeSlug; ACCOUNTS.md §6.6` |
| q07 | Change your mind | task | Person | Artist R · MySet server R | Netlify | `accountUndelete` → `cancelDeletion`: the mark comes off; if the slug was deliberately freed and nobody took it, it is re-attached (`slugLost` says if it was). Billing is not restored automatically — the owner subscribes again. `src: _account.mjs cancelDeletion` |
| q08 | Purge after the grace period | database | Automation | Scheduled jobs R | Netlify | `autocron` purges **one account per ring** on an hourly watermark, **after** the show sweep so it can never delay a gig starting. `deleteArtist` removes every document `keysFor` names; the registry rows (`byId`, `bySlug`, `byEmail`) go **last**, so a token presented mid-delete finds nothing to act on; the `delqueue` entry is removed last of all, so a crash halfway simply retries — purge is re-runnable by construction. `src: _account.mjs; autocron.mjs; ACCOUNTS.md §4, §6.6` |
| q09 | Venues leave the same way | alias | Person | Venue manager R | Netlify | Keyed `v_<vid>` on `keysForVenue()`: export, two-screen delete, lockdown, undo, purge. Until this pass a venue could sign up, take money and pay for Pro, and had no way to take its data or leave. `src: ACCOUNTS.md §6.6` |

## Connections

q01; q02 → q03 → q04 → q05; q03 → q06; q05 —undo→ q07; q06 —free it→ *slug released*; q03 → q08 (after the grace period, unless undone); q09 aliases q01–q08.
