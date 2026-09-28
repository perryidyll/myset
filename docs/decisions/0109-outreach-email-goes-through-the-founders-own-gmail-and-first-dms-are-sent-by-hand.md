---
id: 0109
title: HQ's email goes out through the founder's own Gmail and replies are read back into the conversation; a first Instagram or TikTok message is sent by hand, one tap from HQ, and logged
date: 2026-09-28
status: decided
decided_by: claude
area: growth
reverses:
superseded_by:
invariants: [0gs]
commits: []
tests: [test/gmail.mjs, test/hq.mjs]
files: [netlify/functions/_gmail.mjs, netlify/functions/hq.mjs, netlify/functions/hqcron.mjs, public/hq.html]
---

## The question

The founder asked for a messages center: "ideally the ig dm's and emails [are] populated here directly (and for other platforms like tiktok, can we set up the same api system there like we did for ig..?) – and ideally the messages can all be sent from this center as well and disbanded through the platforms' api's". Until now the factory drafted the words, and the founder sent them by hand and pressed Mark sent. Its comment explains why: MySet's own mail sender (Resend) carries every artist's sign-in codes, and cold mail through it could cost them their way in.

What the platforms allow, checked 2026-09-28:

- **Instagram.** The messaging API lets an app answer somebody only after they have written to the account, and only for 24 hours (7 days with the human-agent tag). There is no way to send the first message. It needs `instagram_business_manage_messages` and a webhook; for the founder's own account, Standard Access is enough.
- **TikTok.** Its Business Messaging API, for approved business accounts only, has the same rule with a 48-hour window.
- **Email** has no such rule, but where it is sent from decides whose reputation it spends.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | **Email:** through the founder's own Gmail. HQ connects with OAuth, holds the refresh token sealed (AES-256-GCM, a key derived from the auth secret), sends at most 60 a day, and reads replies back every ten minutes (`hqcron.mjs`) and whenever a thread opens. A reply pushes to the founder's phone. **Instagram, TikTok, WhatsApp, SMS and Messenger:** HQ copies the words and opens the chat in one tap (`ig.me/m/<handle>`, the TikTok profile, `wa.me/<number>?text=…`, `sms:`, `m.me/<page>`). Nothing is logged until the founder answers "Sent it? Log as sent". Their replies are logged by pasting | Two Netlify variables (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`), one Google consent, one scheduled function | `_gmail.mjs`, `hqcron.mjs`, `/api/hq/gmail` (the OAuth return) | A revoked token: HQ says so and the Connect button comes back. Nothing else stops working |
| B | Send email through Resend from a new subdomain | No OAuth | A second sending domain | Cold mail on the account that carries sign-in codes. Resend's policy forbids unsolicited mail, and one complaint streak could suspend sign-in for everyone |
| C | Send the first DMs through the platforms' APIs | — | — | Not possible. Both platforms refuse a first message from an app, and working around that breaks their terms and gets the account restricted |
| D | A third-party inbox (Zendesk, SleekFlow) | A subscription a month | A vendor with the founder's inboxes | Same platform rules; money for what A does free |

## What was chosen, and why

A. Email is the one channel that can be fully two-way today. The founder's own Gmail is the honest sender: it is a person writing to a person, the replies land where the founder already reads mail, and a complaint costs the founder's inbox, not every artist's sign-in (INVARIANT 0gs).

**The threading.**

- A reply sent from HQ carries `In-Reply-To` and `References` and joins the Gmail thread.
- A reply the founder types in the Gmail app is read back into HQ as outgoing.
- Only mail to or from a contact's address is read, asked for by address twenty to a query, so a busy inbox costs nothing.

**Why sixty a day.** Gmail's own limit is about 500 a day for a personal account. Sixty is a founder's pace, and it keeps a new sending pattern clear of the spam heuristics.

**First DMs.** The platforms leave one honest design: the phone sends it, HQ does the rest. The rest is choosing the channel the contact can be reached on, filling the words from the page's own drafts, copying them, opening the right chat, logging what was sent, and marking the page Shared.

**Later, not now:**

- *Instagram replies.* When the Meta app behind the Media Dash gets `instagram_business_manage_messages` and a webhook, Instagram replies can arrive here and be answered within 24 hours. The message log already records the channel and the direction, so that is an addition, not a rebuild.
- *TikTok.* It needs an application to its Business Messaging API.

**The consent screen.** Google's consent screen must be published, not left "Testing": in Testing, refresh tokens expire after 7 days. Unverified is fine for the founder's own account (Google shows its "unverified app" page once).

## What this makes harder

- **A Google Cloud OAuth client to keep.** If Google revokes it, or the founder changes the account's password with "sign out everywhere", HQ shows "Gmail was disconnected" and the founder connects again.
- **What HQ stores.** The founder's mail with a contact is copied into that contact's HQ conversation: the text, quotes stripped, at most 4,000 characters a message. Delete forever erases it with the contact.

## What would reverse it

- A MySet mailbox (Google Workspace on myset.vip). That is the same code with a different account connected.
- Meta or TikTok opening first contact to apps. That will not happen for cold outreach.

## How it was verified

`test/gmail.mjs` covers:

- the signed state;
- the sealed tokens, with no raw token in the stored document;
- refresh, and revocation;
- the MIME a send builds: CRLF line endings, UTF-8 subjects, bodies that decode back byte for byte, and no header injection;
- threading;
- reading several real message shapes and stripping quoted replies.

`test/hq.mjs` covers the logging, the Sent marking, the follow-up and the tripwire that keeps the mail sender out of HQ.

Not checked: a real Google consent and a real send. They need the two Netlify variables and the founder's Connect.
