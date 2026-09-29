---
id: 0118
title: MySet publishes a privacy notice at /privacy, written from the code
date: 2026-09-29
status: decided
decided_by: perry
area: trust
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/structure.mjs]
files: [public/privacy.html, netlify.toml, public/index.html, public/about.html]
---

## The question

HQ's Gmail connection (decision 0109) runs on a Google Cloud app. On 2026-09-29 the founder's Gmail was connected, with the app still in Testing. In Testing, Google ends the connection every seven days. Publishing the app needs a homepage and a privacy-policy address on the consent screen, and myset.vip had no privacy page. `HARDENING.md` had listed one as a to-do since the start.

The founder asked: "yes, write the privacy page and whatever else needs to be done please".

## The options

| Option | What it does | What it costs | Risk if it goes wrong |
|---|---|---|---|
| **A — chosen** | A plain-language notice at `/privacy`, written from a file-by-file inventory of what the server stores. Linked from the home and About footers | One static page, kept true by hand | A line goes stale when the code changes. The page's header comment says so, and names this record |
| B | A generated policy from a template service | Nothing to write | Claims MySet doesn't make, such as cookies and analytics, or misses ones it does, such as sample pages and Gmail |
| C | Stay in Testing | Nothing | The founder reconnects Gmail every week, and the site still has no privacy notice |

## What was chosen, and why

A. Every sentence on the page is a claim about the code, checked against it on 2026-09-29.

**What the page says:**
- **The audience:** a random device id; the network address stored only as a hash; when votes are wiped; Stripe for tips and merch, including that the artist sees the payer's email and note; RSVPs, ratings, posts, bug reports and booking messages; location compared on the phone only; no cookies.
- **Artists and venues:** the account; sign-in methods; device kind only, no IP; Stripe Connect. The verified tick never stores the date of birth, and the legal name and ID photo are deleted when the check is decided.
- **Sample pages:** the sources, including that Instagram, Facebook and TikTok are never fetched; 30 + 180 days; removal on request, keeping only a hashed fingerprint.
- **Outreach contact records.**
- **Gmail:** what HQ reads and keeps, with Google's Limited Use statement word for word.
- **The companies that handle data.**
- **Retention.**
- **Rights:** export, deletion with 30 days to undo, and email for anything else, backups included.
- **Children under 13.**

**What it names:** the operator is given as Idyll Enterprises, Johnson City, Tennessee, from PER-015/PER-016. The contact is hello@myset.vip, a real Porkbun mailbox.

**Backups, said as they are:** a deletion does not reach into the laptop backups (0046) or the R2 mirror (0069), which copies and never deletes. The page says so, and promises erasure from backups on request. It does not claim erasure happens automatically.

`privacy` has been a reserved slug from the start, in both the artist and the venue lists. The route sits above the `/:slug` catch-all like `/crm`. The page is self-contained: no app.css, no fan.js.

## What this makes harder

- **Every data change now has a second place to update.** A new stored field, a new processor or a new retention period must change `public/privacy.html` in the same pull request.
- **Backup erasure is manual.** A request to be erased from backups means finding the person in the laptop backups and the R2 `backup/` copies by hand.
- **The operator line is a trade name, not a legal entity.** If MySet incorporates, the "Who we are" section changes.

## What would reverse it

A lawyer's policy replacing it. The inventory in this record is still the checklist for whether that policy is true.

## How it was verified

The data inventory was read out of the server code with file and line citations. Four lines that went further than the code were cut or reworded before shipping: the limit counters "not in backups" (the laptop backup copies every key), preferences that "never leave the device", the sample page being "private", and the security@ address, which has no confirmed mailbox.

The page was viewed on `tools/localhost.mjs` at 375 px and desktop, light and dark: no sideways scroll, the contents bar follows the reader, no console errors.

The suite passed, 4,627 tests, including test/structure.mjs's check that every top-level route is a reserved slug.
