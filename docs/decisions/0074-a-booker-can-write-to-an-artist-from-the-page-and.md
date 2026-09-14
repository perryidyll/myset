---
id: 0074
title: A booker can write to an artist from the page, and the artist answers from the Studio
date: 2026-09-14
status: decided
decided_by: perry
area: storage
reverses:
superseded_by:
invariants: [0fw]
commits: []
tests: [test/messages.mjs]
files: [netlify/functions/_messages.mjs, netlify/functions/messages.mjs, netlify/functions/admin.mjs, netlify/functions/_auth.mjs, netlify/functions/_account.mjs, public/artist.html, public/studio.js, public/studio.html]
---

## The question

The founder asked (2026-09-14) for a **Book** button on the artist page — "put a
'book' button to the far left … this means we're going to need to set up a
messaging system within the app" — with the shape spelled out: a new message lands
in a **Requests** folder with a notification to the artist and a bubble on a
**Messages** row in the Studio menu; answering it moves it to **General**;
**Business**, **Casual** and **Spam** folders it can be moved to; read/unread
filters; **Report** and **Block**. And the priorities: effectiveness, simplicity,
reliability, responsiveness.

What forced a decision rather than a build: every rule in this store says the
person on the other side of a public page is never named. The audience never signs
in (9g); phones are counted, never named (0bu); a request from the shop is a
sentence with no way back to the fan (0fp) — decision 0064 reserved a reply path
for "a new decision". A conversation needs a way back. This is that decision.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: a contact form with a memory** | The booker gives a name and an email on purpose; the thread lives under the artist (`inbox_<aid>` index + `msg_<aid>_<tid>`); the artist answers in the Studio; the booker's way back is a link with a token (`/<slug>#m=<tid>.<k>`), by email when mail is configured | A stranger's contact details are stored for the first time — the artist's own correspondence, exported and mirrored with the account | `_messages.mjs`, `messages.mjs`, eight `msg*` Studio actions, `sendMail`, a sheet on the page, a screen in the Studio | A booker's email leaking through a public read; abuse of a public write; a promise of notification the server cannot keep |
| B — device-id threads, no email | The booker is the anonymous device id; replies are read by polling from the same browser | Nothing new is stored about a person | The same store, no mail | A venue manager who wrote from a laptop never sees the reply on their phone; a cleared browser loses the conversation for ever — the founder's "reliability" fails on day one |
| C — email relay only | The form emails the artist; the artist replies from their mail app | No inbox, no folders | A mail template | None of the folders, filters, bubble, Report or Block the founder asked for; and mail is not configured in production today, so the button would lead to a shrug |
| D — do nothing | No Book button | — | — | The page keeps speaking only to the fan in the room (the playbook's gap C) |

**Do nothing** was on the table; the founder chose the button.

## What was chosen, and why

**A.** The booker is not the audience. A venue, a promoter, somebody planning a
party gives a name and an email so they can be answered — the way a contact form
works everywhere — and nothing about the room changes: the fan who votes is still
never named. The device id is kept only as a ten-character hash, only for limits
and blocking (0ae), and never leaves the server (0bu holds). The email lives in
the thread and the owner's reads only; the booker's own read at their link
carries the words and the artist's name, never the address or the phone.

**Nothing depends on a notification.** In production today mail may be unconfigured
(`emailReady()` false without `AUTH_FROM`) and push unkeyed (no VAPID), so the two
paths that always work are the Studio's badge (a quiet `msgCount` read — never on the
live poll, 9d8; never on a timer) and the booker's own link, shown with a Copy
button on the Sent screen and remembered in the booker's browser. Push (`notify`)
and mail (`sendMail`, a plain letter with a button — `sendNotice`'s security
footer would be the wrong sentence) are wired, time-boxed to 1.5 s, and light up
when the founder configures them.

**The door answers the same way to everyone it refuses** (9h): a blocked sender and
a filled honeypot get `{ok, id, k}` and nothing is stored; the same words twice from
one phone in a day get the conversation that already exists — a second tap or a
retry after a lost reply keeps one link. A limit the sender should hear — three new
conversations a day per phone, three per address (the phone's id is its own word,
so the address is a second axis) — is a sentence and a 429. Three links in one
message is a pitch, not a booking: it lands in Spam. Sixty a day per network and two
hundred a day per artist are soft ceilings inside the CAS (15k, 0dw), never on the
page. The index is written first — it holds the block list, the day's counts and
the recent ring, so every refusal is decided before a conversation exists under a
valid token — and the thread second; a thread write that fails takes its row back.

**Letters are budgeted, and never carry a stranger's words.** The artist gets at
most twenty a day (then the badge and push carry it), and only when a conversation
turns from read to unread; the booker gets one receipt per address per artist per
day, carrying the artist's name and the link and nothing anyone typed — a public
door must never become a way to post somebody else's text through MySet's sender.
An artist's reply is what verifies the address: it goes out whenever mail is on.
The send reply says whether mail is on at all (`mail`), so the page never promises
an email that cannot come.

**The token never rides in a URL.** The booker reads and replies by `POST` with the
id and the token in the body; a thrown request logs its address (0fb), never its
body. The page's `#m=` link is a fragment, which the browser keeps to itself.

**Report and Block** are the owner's (OWNER_ONLY); reading and answering is a
seat's everyday work (`community` capability — a band mate who tends the community
page tends the inbox; the sound engineer never sees it). Block keys on the email
hash and the device hash, never the network hash — a whole bar shares one (0ck).
Report flags the thread, files it under Spam, writes one line to MySet's own
hourly log with the id and nothing else (0fb), and tells the founding account the
way an artist is told of a message — a push and a letter with the artist's id and
the conversation's id, never the words; there is no moderation queue yet, and no
new global was added for one (0a).

**Owner actions ride `/api/admin`** so the seat gate applies to them; the public
actions ride a new `/api/messages`, `json()` only — a token-gated read is personal
and must never be edge-cached (9d6). Nothing new is fetched on the page's first paint.

**Storage, in computable keys.** The index is one small document per artist capped
at 300 rows; past that the oldest rows (answered before unanswered) are appended to
`inboxarch_<aid>` (the `_append.mjs` log) before they are trimmed (0fr), and their
conversations stay on disk. A conversation holds 200 messages; the 201st is refused
with a sentence, never dropped. `keysFor` names the inbox, the archive and every
conversation the two name; the export carries them; a deleted account leaves none.

Not plan-gated: nothing in the ladder names messaging, and the founder did not ask.

## What this makes harder

- MySet now holds a stranger's email and phone, per artist. The export carries
  them (it is the artist's correspondence), the R2 mirror copies them, and the
  R2 copy is not yet purged on account deletion (0069's open item) — the privacy
  page SECURITY.md:143 names should say so before the first real booking lands.
- Two channels instead of one: a booker who loses the link AND has no working
  mail has no way back. The Sent screen says so in one sentence and remembers
  the link in the browser; a "your conversations" list on the page shows them.
- A per-artist block list of hashes is only as good as the hashes: a determined
  sender changes email and clears the browser. It stops the ordinary case.
- An unanswered request is still spilled past 300; the Studio lists the index,
  not the archive — an artist who never answers 300 requests will not see the
  301st in the Studio (it is in the export). A "load older" is a later ask.

## What would reverse it

- The first complaint that a booker's details were seen by anyone but the
  artist: then the thread read moves behind a stronger secret and the email is
  encrypted at rest.
- A bounce or a complaint about the receipt letter (a stranger typing somebody
  else's address): then the receipt goes and the artist's reply is the first mail.
- Mail configured and then a deliverability problem: the link stays the way back.
- Abuse the ceilings do not hold (a script rotating device ids past sixty a day
  on many networks): then a proof-of-work or a turnstile on the send.
- The founder deciding Book is a paid-plan feature: the CAPABILITY row and the
  page's button gate on the plan, nothing else moves.
- Venues wanting the same: `keysForVenue`, the Venue Studio and `messages.mjs`'s
  `?v=` refusal are the three places.

## How it was verified

- `test/messages.mjs` — 91 ✓ / 0 ✗: a stranger's send, the id and token, the
  index row without hashes or token; the artist's letter and the booker's receipt
  with the link and none of the booker's words, and no second receipt to the same
  address that day; the same "sent" for a honeypot and a blocked sender with
  nothing stored, and the SAME id and token for a repeat; three a day per phone
  and three per address then a 429 while a second phone on the same network still
  gets through; three links → Spam and never unread on the badge; the booker's
  read by id + token, 404 on a wrong token, id, or length, 405 on a GET; the
  owner's reply moving Requests → General, the booker's mail carrying the link,
  the booker's reply setting unread and staying put; twenty-five new
  conversations in a day and at most twenty letters to the artist; Move,
  Mark unread, Report (Spam + flagged + one log line with no words or address),
  Block (Spam; a new phone with that email and that phone with a new email both
  swallowed; the booker's reply swallowed), Unblock; Report reaching the founding
  account's addresses with the ids and nothing else; crew refused the list and
  the count, a member reading and answering, only the owner blocking or
  reporting; the 201st message refused with the 200 intact; the 301st
  conversation spilling the oldest answered one to the archive with its document
  still on disk; `keysFor` naming inbox, archive and every conversation including
  the archived one; the export carrying them without a device hash; a deleted
  artist leaving none of it behind.
- The whole suite: exit 0, 0 ✗ (the count is in the ledger's row).
- NOT checked: a real email through Resend (mail is stubbed in the suite; the
  production sender may be unconfigured — PER-004), a real push (no VAPID in the
  suite), and a real phone's tap on the Sent screen's Copy button.
