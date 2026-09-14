---
tab: Artist lifecycle
section: Booking messages (the Book button → the inbox)
puzzle_section_id: 42087
puzzle_steps: b01 370856 · b02 370857 · b03 370858 · b04 370859 · b05 370860 · b06 370861 · b07 370862 · b08 370863 · b09 370864 · b10 370865 (all `Live` since `a69154f`, PR #51) · changelog 1665
sources:
  - netlify/functions/_messages.mjs, messages.mjs (the inbox and the public door)
  - netlify/functions/admin.mjs (MSG_ACTIONS, CAPABILITY, OWNER_ONLY)
  - netlify/functions/_auth.mjs (sendMail), _push.mjs (notify)
  - public/artist.html (openBook / openThread), public/studio.js (the Messages tab)
  - docs/decisions/0074
  - INVARIANTS.md 0fw, 9g, 0bu, 0fp, 9h, 15k, 0dw, 0fb, 0ck, 0fr, 0cy
status: loaded
loaded: 2026-09-14 (create_process 42087; the ids above from its reply)
verified: code read 2026-09-14 (sendThread's order inside the CAS; test/messages.mjs)
---

# Booking messages (the Book button → the inbox)

**Who:** a booker — a venue, a promoter, somebody planning a party (role *Fan*, external, but **not the audience**: they give a name and an email on purpose) — and the artist (role *Artist*). **Trigger:** the **Book** button under the numbers on the artist's page, or `myset.vip/<slug>#book`. **Outcome:** a conversation the artist answers from the Studio and the booker reads at their own link; filed in folders; a sender the artist never wants to hear from again, blocked.

Nothing here waits on mail or push. Both are wired and best-effort; the Studio's badge and the booker's link are the paths that always work (decision 0074).

| id | step | type | executor | role (RACI) | tool | notes |
|---|---|---|---|---|---|---|
| b01 | Write to the artist | form | Person | Fan R | Netlify | The Book sheet: what it is about (Booking · Collab · Press · Other), a name, an email, phone / venue / date if they like, the message (10–1,000 characters), a hidden honeypot. `POST /api/messages?a=<slug> {action:'send', fan, …}` with the vote page's anonymous id. Refusals are sentences on the sheet, never an alert. `src: public/artist.html openBook(); _messages.mjs sendThread` |
| b02 | The door decides, inside the index | conditional | Automation | MySet server R | Netlify | One CAS on `inbox_<aid>` decides everything before a conversation exists: a blocked sender, a filled honeypot → the same `{ok, id, k}` and nothing stored (9h); the same words from the same phone today → the conversation that already exists; three a day per phone, three per address → a sentence and a 429; sixty per network, two hundred per artist, three links in one message → filed under **Spam**. Then the thread `msg_<aid>_<tid>` is written once, with a 32-hex token; a thread write that fails takes its row back. `src: _messages.mjs sendThread; INVARIANT 0fw` |
| b03 | The artist is told | notification | Automation | MySet server R · Artist I | Netlify | A push to every device that turned alerts on (`notify`, tag `msg-<tid>` so it replaces rather than stacks) and, within the day's budget of twenty, a letter to the owner's addresses (`sendMail`, no security footer, a button to `/studio?tab=messages`); the Studio's Menu row and Menu tab show the unread count on the next quiet `msgCount` read. Never for Spam. `src: _messages.mjs tellArtist; public/studio.js msgPeek` |
| b04 | The booker gets the way back | notification | Automation | MySet server R · Fan I | Netlify | The Sent screen shows `https://myset.vip/<slug>#m=<tid>.<k>` with *Copy*; the phone remembers it (`myset.msgs`) and lists *Your conversations with <First>* next time; a receipt letter goes once per address per artist per day, carrying the artist's name and the link and no typed words — when mail is on, which the send reply says (`mail`). `src: public/artist.html; _messages.mjs tellBooker` |
| b05 | Read it in the Studio | task | Person | Artist R | Netlify | Menu → **Messages**: folder chips (Requests · General · Business · Casual · Spam) with counts, All · Unread · Read, the list (name, kind, preview, time, an unread dot). Opening a conversation marks it read (`msgThread`). A band mate on a seat may read and answer (`community`); the sound engineer never sees the row. `src: public/studio.js (TAB 'messages'); admin.mjs CAPABILITY` |
| b06 | Answer | form | Person | Artist R · Fan I | Netlify | *Your reply* + Send (`msgReply`): the conversation moves **Requests → General**, is read, and the booker is told — the answer waits at their link and goes out by email when mail is on. The 201st message in one conversation is refused with a sentence, never dropped. `src: _messages.mjs ownerReply` |
| b07 | The booker writes back | form | Person | Fan R · Artist I | Netlify | At the link: the conversation as bubbles, a reply box (`POST {action:'reply', t, k, text}`; the token only ever in a body, never a URL — 0fb). The conversation turns unread and stays in its folder; a row that had spilled to the archive comes back to the index; the artist is told once per read→unread. Thirty a day per conversation. `src: public/artist.html openThread(); _messages.mjs bookerReply` |
| b08 | File it | task | Person | Artist R | Netlify | *Move to…* Business / Casual / General / Requests / Spam; *Mark unread*. The index keeps 300 rows; past that the oldest (filed before unanswered) spill to `inboxarch_<aid>` before the trim (0fr) and stay on disk under their own keys. `src: _messages.mjs moveThread / setUnread / spillInbox` |
| b09 | Report or block | conditional | Person | Artist R (owner only) | Netlify | **Report**: flagged, filed under Spam, one line in MySet's hourly log with the id, and the founding account told (a push and a letter with the ids, never the words). **Block**: the sender's email hash and the inbox's own salted device hash on the artist's block list — never the network (a whole bar, 0ck); their next message and their replies are swallowed with the same "Sent"; *Unblock* takes it back. Both ask first in the Studio's own window; both are the owner's (a seat sees Move and Mark unread). `src: _messages.mjs reportThread / blockSender; admin.mjs OWNER_ONLY` |
| b10 | Export, mirror, delete | database | Automation | MySet server R | Netlify | `keysFor` names the inbox, its archive and every conversation the two name; the account export carries them (the artist's own correspondence, no device hash); the nightly mirror copies them; a deleted account leaves none. `src: _account.mjs keysFor / exportArtist; _messages.mjs messageKeys` |

## Connections

b01 → b02; b02 —stored in Requests→ b03; b02 → b04; b03 → b05; b05 → b06; b06 → b07 (at the link); b07 → b03 (once per read→unread); b05 → b08; b05 → b09; b08 and b09 → b05; b10 stands alone (every write, every night, on leaving).

## What is deliberately absent

- No inbox for a venue page: `/api/messages` refuses `?v=`; the venue's inbound flow is the pitch (decision 0074 names the three places if that changes).
- No moderation queue: a report reaches the founding account's Studio and addresses, and that is all there is today.
- No conversation older than the index in the Studio: a spilled row is in the archive and the export; a *load older* is a later ask.
- No plan gate: nothing in the ladder names messaging; the founder did not ask.
