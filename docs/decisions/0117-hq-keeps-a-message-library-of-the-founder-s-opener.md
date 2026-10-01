---
id: 0117
title: HQ keeps a message library of the founder's openers, and counts which get answered
date: 2026-09-28
status: decided
decided_by: perry
area: growth
reverses:
superseded_by:
invariants: []
commits: [84dda56]
tests: [test/hq.mjs]
files: [public/crm.html, netlify/functions/_crm.mjs, netlify/functions/hq.mjs, tools/localhost.mjs]
---

## The question

The founder, 2026-09-28, with eight outreach openers written for him elsewhere, one per kind of act (bar singers, coffee-shop singers, cruise-ship soloists, wedding singers and bands, jazz lounge musicians, cover bands, buskers, venues): "please add them into a preset messages library that i can select within the crm to send to different artists/venues". His notes also said to test one change hard: end on "I can send you the link if you want to see what yours looks like?" instead of each opener's own closing question.

HQ's composer (decision 0108) offered only what the factory drafted from a live sample page: the first message, the follow-up and the in-person script. A contact with no page got no template at all.

## The options

| Option | What it does | What it costs | Risk if it goes wrong |
|---|---|---|---|
| **A — chosen** | A library in its own document (`crmlib`), edited in HQ. The composer lists its openers beside the page's drafts. Each message remembers the opener and ending it came from, and the page reads reply rates off the table rows | One small document; two optional fields on a message; one on a row | A save fails and the edit is lost. It says *Saved* only when the server said so |
| B | The eight openers written into the page | Nothing on the server | No edits without a deploy, and nothing to count with |
| C | Openers kept in the factory's settings (`factorycfg`) | No new document | It mixes the founder's words with the factory's knobs, and the old console would carry them too |

## What was chosen, and why

A, because the founder asked for a library, and a library he cannot edit or measure is a paste buffer.

**The library.**
- One document, `crmlib`. It holds the openers (key, name, Artists or Venues, body, closing question, the tag words that pick it), the softer ending, and how the ending is chosen. Until the first save it is the eight openers as the founder gave them.
- It is opened from the book beside the template picker, from Settings, or with ⌘K *Message library*.
- Edits save themselves 0.7 s after the last keystroke. Adding, removing and the ending setting save at once. *Put the originals back* restores the eight.
- The page sends the whole library each time. The server keeps only known fields: keys are unique and safe, names and questions are trimmed, a body is at most 1,500 characters, and there are at most 30 openers. An empty list stays empty, because the founder cleared it.

**In the composer.**
- The picker groups *From their page* (when there is one) and *Your presets* (the ones for that kind of contact).
- `[Name]` becomes the name the factory split out for a solo act (`record.first`), or the act's name without a leading "The". `[Venue]` and `[City]` fill in the same way.
- A contact with no sent message, tagged with an opener's word (a *wedding band* tag, and so on), opens on that opener.
- An opener sent by email gets the sign-off, the "Reply stop" line and the postal address, like the factory's email. With no address set, it warns just as the factory's draft does.
- A `[placeholder]` still in the text disables Send and names it.
- An opener offers a page, so a contact with none yet gets the line "No page for them yet — build it before they say yes." It does not block sending: a lead can get its page after it says yes.

**The ending test.**
- Each opener ends on its own question, or on the softer one. The composer shows the two as *Theirs* and *Softer*, and switching swaps the last sentence even after an edit.
- By default (*Split evenly*), each new contact gets the ending that has gone out less, so the test runs without anything to remember. *Always theirs* and *Always softer* stop it.

**The counting.**
- An outgoing message sent, copied or logged from an opener keeps `pre` (the key) and `soft`. A note or an incoming message never does.
- The contact's row carries the first opener that went to them and when (`pre: {k, t, s}`). The library counts a contact once, for that opener, and a reply counts if one came after it.
- Each opener and each ending shows *replied / sent* with a bar. Once two or more have three sends each, the leader turns green. The counts are read off the rows the table already loads, so they cost no extra read.

## What this makes harder

- **A reply is credited to the first opener only.** A contact who ignores the bar opener and answers the follow-up still counts as a reply to the bar opener. That is what "which opener opens a conversation" means; it is not a per-message score.
- **Rows written before today have no `pre`.** They count toward nothing until something rewrites them. Nothing sent before today came from an opener.
- **The openers are in the public repository**, as defaults. They are outreach copy that goes to strangers anyway. The founder's edits live only in the store.

## What would reverse it

- Outreach moving to a real CRM product, as in decision 0108's option C.
- The founder wanting a score per message rather than per first contact. That would read the messages themselves, which the index does not carry.

## How it was verified

`test/hq.mjs` *THE MESSAGE LIBRARY* (14 checks):
- the eight defaults and the soft ending;
- a save tidies and refuses what it should;
- an empty list stays empty, and null restores the eight;
- a locked HQ cannot save;
- a message sent from an opener keeps it and its ending, and a note never does;
- the row carries the first opener, and a later one does not take the credit;
- a bad key is dropped;
- the page wires all of it.

Two mutations were caught: letting a note or a reply keep an opener, and letting a `[placeholder]` send.

The whole suite passed: 4,627 passed, 0 failed.

The page was walked on `tools/localhost.mjs` with the demo pipeline, which now sends a few messages from openers, at desktop width in both themes and at 375 px:
- a *wedding band* lead opened on the wedding opener, with its name filled in;
- Theirs and Softer swap the ending, also after an edit;
- a leftover `[Name]` disabled Send;
- logging sent from an opener stored `pre` on the message and the row;
- the library's edits saved;
- the bars grow in, and the leading ending turned green.

Live as `84dda56` (PR #151): `/crm` on myset.vip carries the library, and `/api/hq` still answers 401 to a stranger, `savelib` included. Not checked live: the library behind the passcode, which is the founder's to open.
