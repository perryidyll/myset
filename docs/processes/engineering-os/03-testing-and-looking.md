---
tab: Engineering OS
section: Testing and looking
puzzle_section_id: 41989
sources:
  - test/run.sh (the suite, in order), test/blobs-fake.mjs, test/stripe-fake.mjs, test/register.mjs
  - tools/sheetcheck.mjs, tools/uicheck.mjs, tools/clipcheck.mjs, tools/prod.py, tools/loadsim.py
  - AGENTS.md § Build and test (no install step in a worktree: decision 0116)
  - MYSET-MASTER-OVERVIEW.md §6.1 (draft previews), §6.4 (Testing), §6.5, Part 8 (previews share production data)
status: loaded
loaded: 2026-09-12 (create_process; read back through list_sections — step counts and connections match)
verified: sources read 2026-09-12; `python3 tools/prod.py` run read-only 2026-09-12
---

# Testing and looking

**Who:** the coding agent; the founder for the phone in hand. **Trigger:** a change ready in the tree. **Outcome:** the suite green, the count stamped, the page looked at in a real browser at phone width, and a draft URL for anything visual — with nothing written to production along the way.

**A green suite proves nothing about a page.** Several defects a month are invisible to the tests and obvious on screen.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| t01 | Run the whole suite | task | AI Agent | Coding agent R | Claude Code | `sh test/run.sh` — every file in `test/`, in the order the script names them, from syntax to the account system. The suites run the **real handlers** against an in-memory store that implements the same etag behaviour as production (`test/blobs-fake.mjs`, injected by `test/register.mjs`); Stripe is a fake that **records the options of every call**, which is how a direct charge is proved direct. No dev server; nothing touches production. Two steps are about the store itself: `test/contention.mjs` runs five rooms through `tools/roomsim.mjs` with latency on, so writers really collide (decision 0145); and the last step, `test/keyfamilies.mjs`, reads every key the whole run wrote and fails on a kind of document `_mirror.mjs` `FAMILIES` does not classify (decision 0146). The assertion count is in §2.1. **No install step in a worktree:** `node_modules` is never tracked, and Node finds the shared checkout's by looking in every parent folder; a checkout anywhere else runs `npm ci` once. `src: test/run.sh; overview §6.4; AGENTS.md § Build and test; decisions 0116, 0145, 0146` |
| t02 | `netlify dev` cannot run the write paths | conditional | AI Agent | Coding agent R | Netlify | Its storage sandbox returns no version tag, so `casDoc` falls back to `onlyIfNew` and every write after the first fails as busy. Use the suite, not the dev server. `src: AGENTS.md § Build and test; test/run.sh header` |
| t03 | A test double must not be kinder than the real thing | conditional | AI Agent | Coding agent R | Claude Code | The Stripe fake's `checkout.sessions.list` once ignored the `created` window, so every session was visible in every query — and no test could catch a lookup that only reached back one month. A double more permissive than production is a test that passes for the wrong reason. `src: overview §6.4` |
| t04 | Stamp the count | task | AI Agent | Coding agent R | Claude Code | `node tools/overview.mjs --tests` runs the suite and writes the assertion count into the overview's generated block. `src: overview §6.4, §7.1` |
| t05 | The three things no node test can see | task | AI Agent | Coding agent R | Claude Code | `node tools/sheetcheck.mjs` — bottom-sheet touch behaviour with **real TouchEvents** at a 390px iPhone viewport. `node tools/uicheck.mjs` — rendered layout: the last-call box pinned without reflow, the dock surviving the end of a show, the ring on one button and not the other, link order as rendered. `node tools/clipcheck.mjs` — that uploaded pieces are the file byte for byte, sound included. `src: overview §6.4` |
| t06 | Look at it in a real browser, at phone width | task | Person | Founder R · Coding agent R | Claude Code | The app's browser pane or a phone. Rule 5 applies to what is on screen too: say *verified* only for what you looked at, and screenshot it. `src: AGENTS.md § Build and test; overview §6.5` |
| t07 | A draft preview, for looking only | task | AI Agent | Coding agent R · Founder I | Netlify | `netlify deploy` with **no** `--prod` gives a free draft URL. **A preview shares production data** — the money half is closed (Stripe keys are unset in preview contexts) but it can still write real data. Use it to look at pages, never to exercise a write path. Verify the draft by content, the same as a deploy. `src: overview §6.1, Part 8; AGENTS.md § Safety` |
| t08 | Read the live site's health | task | AI Agent | Coding agent R | Netlify | `python3 tools/prod.py` — a plain-language, read-only report through `netlify blobs:get`: who is on the platform, their plan and tick, whether they are getting paid, what is stored by kind. It is **not** a way to act as an artist; the admin door needs a session or `ADMIN_CODE`, which the API returns masked. A write against production is the founder's, or a `blobs:set` said out loud first. `src: tools/prod.py header` |
| t09 | Reproduce a cost figure | task | AI Agent | Coding agent R | Claude Code | `python3 tools/loadsim.py` reproduces every cost figure in the overview; `test/cost.mjs` asserts what an endpoint costs. A number that cannot be reproduced is not a number. `src: overview Part 0 § How to check anything; test/run.sh` |

## Connections

t01 —red→ *back to Making a change*; t01 —green→ t04 → t05 → t06 → t07 → *Committing and deploying*; t02 and t03 are standing notes on t01; t06 —visual change→ t07; t08 and t09 on demand.
