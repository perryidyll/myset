---
id: 0108
title: MySet HQ is the founder's outreach desk — a form that builds a page, a CRM table whose stages are read off the pages, and one place for every conversation
date: 2026-09-28
status: decided
decided_by: perry
area: growth
reverses:
superseded_by:
invariants: [0gr, 0hk]
commits: [0075a30]
tests: [test/hq.mjs, test/factory.mjs, test/samples.mjs]
files: [public/crm.html, netlify/functions/hq.mjs, netlify/functions/_hqlock.mjs, tools/hqpass.mjs, netlify/functions/_crm.mjs, netlify/functions/factory.mjs, netlify/functions/factory-background.mjs, netlify/functions/_sample.mjs, netlify/functions/_auth.mjs, netlify.toml, tools/localhost.mjs]
---

## The question

The founder, 2026-09-28, the day the sample factory (0101–0103) went live: "please build a dashboard (tony stark meets steve jobs aesthetic) for managing all of this like i did for wellmee". He asked for:

- a profile creation section with a field for every link, and a toggle switch between artist and venue;
- after Generate, "a little loading bar with a loading animation, then a 'view sample profile' button";
- a table of every artist and venue with a profile, clearly labelled, showing up to 20 rows before it scrolls, with an Edit profile button on each that adjusts links, photos and bios;
- "let's make it a mini-crm": tags that sort by profile generated or not, shared or not, and where the outreach went (IG, TikTok, email and so on), "as comprehensive and effective as possible without becoming overly cumbersome";
- a messages center where every conversation is tracked and, ideally, sent from.

The console at `/factory` already built pages from pasted lines, reviewed them and drafted the messages. It knew pages, not people: nothing about a lead with no page yet, a conversation, a tag or a follow-up date.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | A new page, `/crm`, and a CRM beside the samples: one contact per act or venue (`crm_<cid>`, indexed in `crm`), joined to its page by `owner`. The contact's stage is derived from the page's own records on every read. HQ queues builds through the factory's own queue, and page actions stay on `/api/factory` | Two new documents per contact at most, plus one index | `_crm.mjs`, `hq.mjs`, `public/crm.html`, hooks in `_sample.mjs` and the worker | A hook fails and a contact points at a page that went. Every hook is best-effort and the stage is re-derived on every read, so the worst case is a stale owner that shows as a lead |
| B | Grow `/factory` and hang tags and messages on the sample rows | No new documents | Fields on `samplereg` | Everything on a sample disappears when the page comes down after 30 days, or is erased on a cancel. A lead without a page has nowhere to live |
| C | An outside CRM (HubSpot, Notion) with a sync | A subscription, and a second copy of every contact | An integration and its keys | Two sources of truth, and the stage in the CRM drifts from the page |
| D — do nothing | Keep the console | — | — | The founder runs outreach from memory and three apps |

## What was chosen, and why

A. A person outlives their page: a sample comes down after thirty days, can be revived under a new owner id, or can be cancelled and rebuilt. So the contact is its own document, and it is joined to the page rather than living inside it. Where a contact stands is never stored. It is read from `samplereg`, its `claimed` rows, `samplearc`, the artist and venue registries, and `factoryq`, so the table cannot disagree with the page (INVARIANT 0gr).

**Every change to a page tells the CRM**, from the code that made the change:

- Delete forever erases the contact and its conversation. That holds from HQ and from the old console, because `optOut` does it. The promise "we'll delete this preview forever" covers what we wrote down about them too.
- Cancel page, and the 180-day erase of a kept copy, turn the contact back into a lead.
- A rebuild or a revive that lands under a new owner id moves the contact to it.

**The page.** `public/crm.html` is one hand-written file on the Studio's system fonts, with no dependencies. It is dark: glass panels, hairlines, monospace telemetry and one pink-orange glow. It has:

- the New profile form with the Artist ↔ Venue switch;
- the build card, with an arc-reactor ring, a bar that creeps between the worker's real stage updates, and View sample profile when the page is done;
- the Pipeline table, which shows 20 rows before it scrolls, is sortable, and has filter chips;
- the Messages center;
- a drawer for each contact, with four tabs: Overview, Page, Messages and Review;
- Settings, and a ⌘K palette.

**Tags come in two kinds.**

- *Automatic tags* are read off the row, so there is nothing to maintain: Artist or Venue; Generated, Not generated or Needs review; Shared or not, and by which channel; Opened; Replied; Waiting for reply; Follow-up due; Expiring soon (five days or fewer); Claimed; Archived; Starred; Unread.
- *Custom tags* are free text: up to twelve per contact, 24 characters each, deduplicated regardless of case.

The follow-up falls due four days after the first message goes out, unless the founder set a date. A reply clears it, because "Needs your reply" says more than a date does.

**What else the contacts get.**

- Duplicates are caught by Instagram, TikTok or YouTube handle, email, phone, or name and place (`byKey`).
- Pages the old console built before HQ are adopted into the table.
- A contact deleted on purpose stays deleted (`crm.skip`).

**The factory changed in four places, and its console keeps working** (test/hq.mjs "THE OLD CONSOLE STILL WORKS"):

- `queueJobs`, `markSent` and `sampleDetail` are now shared helpers.
- `edit` also takes links (canonicalised, with the refused ones named in `dropped`), the place, and an artist's videos (add, hero, remove).
- A rebuild keeps the seed's own fields, not only its line.
- The worker links a finished job to its contact and adds the handles the factory found.

**The door.** The founder's second word the same day: "make the url www.myset.vip/crm and put a legit passcode lock on it". HQ answers at `/crm`; `/hq` never shipped. It sits behind two locks:

1. the founding page's owner seat, the same gate as the console (decision 0099);
2. then the passcode (`_hqlock.mjs`, INVARIANT 0hk).

A signed-in phone left on a bar is not enough, and a guessed passcode is not either. That matters because HQ sends mail as the founder and can erase a contact forever.

| Door | Why it was or was not chosen |
|---|---|
| **The owner seat and a passcode — chosen** | Two locks, both checked on the server. Only the owner seat can try a passcode at all, so a stranger cannot guess |
| The passcode alone | A short passcode is guessable, and HQ sends mail as the founder. A guess must not be enough |
| The money model's door (`_passgate.mjs`) | A courtesy lock, by its own comment: a code with a fallback written into this public repository, and a proof with no expiry |
| Netlify's site password | Paid, and it locks the whole site or nothing. Every fan page would ask for it |

How the passcode is kept:

- **The hash.** Only a salted scrypt hash is kept, in Netlify's `HQ_PASSCODE` for the production context, marked secret. `tools/hqpass.mjs` asks for a passcode without echoing it and sets the hash. The repository is public, so a hash in it could be cracked at leisure. A tripwire in the tests fails if any hash is written into it.
- **Unset or malformed, HQ stays shut.** So a deploy preview, which reads and writes production data, can never be opened.
- **The proof of a right passcode** is `hqk`: an HttpOnly, SameSite=Strict cookie limited to `/api/hq` and good for `UNLOCK_HOURS` (12). Its signature, under the site's auth secret, covers the account, the expiry and a fingerprint of the stored hash. A copy opens nothing for another account. A new passcode locks every open HQ.
- **Wrong tries.** `LOCK_TRIES` (5) wrong in a row shut the door for `LOCK_MINUTES` (15), even to the right passcode, and push to the founder's phone.
- **The Gmail return** comes back from Google with no cookie. It proves itself with its signed state, which only an unlocked Connect hands out.

## What this makes harder

- **Two more documents per contact.** The index is read in full on every HQ summary: about 300 bytes a contact, so ten thousand contacts is about 3 MB. Shard it by month before then.
- **Every door that removes or moves a page must tell the CRM.** That is `tellCrm` in `_sample.mjs` today. A new door that forgets it leaves a stale owner, which the next derive shows as a lead.
- **HQ answers at `/crm`**, and `crm` is now a reserved page name. Nobody held it on 2026-09-28.
- **A passcode to keep.** A forgotten one is replaced, not recovered: `node tools/hqpass.mjs` needs the Netlify sign-in, then a deploy. Lock in the header clears one browser's cookie. To shut every browser at once, set a new passcode.

## What would reverse it

- The founder moving outreach into a real CRM product, which is option C.
- The index outgrowing one document, which calls for sharding, not a reversal.

## How it was verified

`test/hq.mjs` pins each rule, end to end on the in-memory store with a pretend worker and a fake Google. Its passcode section checks every refusal: a stranger's try, another account's cookie, a changed expiry or signature, a stale unlock, lockout, a new passcode, and none set. Two mutations were caught by it, the gate removed and the lockout removed. Its run on 2026-09-28 was 144 passed, 0 failed. The whole suite, on the branch rebased on `d5e53fb`, stamped 4,825 assertions and 0 failing (`node tools/overview.mjs --tests`). `test/factory.mjs` (146) and `test/samples.mjs` (119) pass unchanged against the refactored factory. The page was walked on `tools/localhost.mjs`, where `/dev/hq` fills a demo pipeline and a pretend build walks the eight stages, at 1440, 1024 and 390 px; see the session note for what was seen. Live as `0075a30` (PR #137): `/crm` serves the page behind both locks, and `/api/hq` refuses a stranger, whether it asks for the summary or tries a passcode. Not checked live: a right passcode, which is the founder's to type.
