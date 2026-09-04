# 2026-09-05 — clips, the books, passkeys, the cost audit and a security pass

Round four. Perry's list, in his words, and what each turned into.

---

## 1. "can we include the option to add videos to posts in the communities?"

**Built.** Thirty-second clips, re-encoded on the phone, capped at 3MB.

- `netlify/functions/_video.mjs` — decode, validate by BYTES not by label
  (`ftyp` / EBML magic), MP4 duration read out of the `mvhd` box, store, sweep.
- `netlify/functions/vid.mjs` — serves clips with **HTTP Range support**. iOS Safari
  asks for `bytes=0-1` first and refuses a 200; without this the feature does not
  work on most phones in a bar. Suffix ranges, 416 past the end, immutable
  year-long durable edge cache.
- `_community.mjs` — a post carries a clip id; the server checks the bytes exist
  before accepting it; deleting the post deletes the clip and its poster.
- `community.mjs` — `action:'clip'` uploads on its own, BEFORE the post, because a
  6MB function body minus three 900KB photos leaves about four watchable seconds.
  The daily post limit is enforced at the upload door too, or a device that will
  never post could upload 3MB as often as it liked.
- `public/community.html` — canvas + MediaRecorder re-encode to 480p at ~600kbps
  with a progress bar (encoding is real time and cannot be hurried), a poster frame
  grabbed at a third of the way in, `preload="none"` so the feed costs nothing
  until somebody taps.
- Orphans: `vidpend_<owner>` + a `vidqueue` global the cron drains one owner a ring.
  **The sweep reads the feed first** — clearing is best-effort, and deleting on age
  alone would take a video off a real post two hours after somebody put it there.

`test/clips.mjs` — 44 assertions. INVARIANTS 0dq–0ds.

**The one honest warning:** video is the only thing in MySet that can move the
Netlify bill on its own. A 3MB clip watched 100,000 times is 300GB ≈ $40. The three
mitigations (phone-side re-encode, byte cap, poster + `preload="none"`) are why it
is bounded, and it is called out in the cost report.

## 2. "i meant getting a proper ACCOUNTING system in place"

**Built.** `netlify/functions/_ledger.mjs` + `ACCOUNTING.md`.

The deep thinking, short version: **Stripe holds the transactions; MySet produces the
statements.** A second ledger that re-derives what a charge was is a machine for
disagreeing with Stripe. So every figure comes from Stripe's **balance
transactions** — the list Stripe reconciles to the bank — and is only bucketed.

- **Artists** and **venues** get a twelve-month statement and a CSV for their tax.
- **Perry** gets a real P&L: revenue read from Stripe, costs typed in by hand (six
  kinds), profit = net − spend.
- The **monthly close** makes it cheap: a finished month is computed once and cached
  in `ledger_<owner>`; only the current month is ever re-read.
- Two traps pinned: Stripe's fee comes from `fee_details`, never `bt.fee` (which on
  a direct charge contains ours too); and a **payout is not an expense**.
- Owner-only on the server, and the founder's books use the PLATFORM account —
  `stripeFor(aid)` would have reported an artist's takings as the company's revenue.

`test/books.mjs` — 43 assertions. INVARIANTS 0dt–0du.

## 3. "what about getting a proper account system in place... implement the best option only for me"

**Passkeys, built, with no npm dependency.** `netlify/functions/_passkey.mjs`.

First the premise correction, written up in ACCOUNTS.md §9a: sign-in is **not** a
link and **not** browser-memory. It is a six-digit code checked on the server,
exchanged for an HMAC-signed revocable token. What it is, is one factor — an inbox —
and slow to use on stage.

The four options weighed in §9b. Passwords are strictly worse (the reset flow is an
email code either way, plus a liability). An identity provider is $2,000–5,000/mo at
10,000 artists to replace something that works. Passkeys win.

WebAuthn verification is SHA-256, a signature check, base64url and enough CBOR to
read two maps — all of which Node does. A dependency in the sign-in path is a
dependency that can be taken over.

**`test/passkeys.mjs` acts as a real authenticator** — generates a P-256 key pair,
builds real authenticator data, CBOR-encodes a real attestation object, signs with
the real algorithm — and defeats each of the five checks on purpose. That answers the
objection that stopped this shipping yesterday ("cannot be verified without a
device"). 30 assertions, including the subtle one: a synced iCloud passkey reports a
counter of zero for ever, so refusing on "not greater" would lock out exactly the
devices this exists for.

Rolled out to Perry first by construction: the Face ID button on the gate only
appears once that browser has signed in at least once, because a passkey belongs to a
page and the sign-in screen does not yet know which page you are. INVARIANT 0dv.

## 4. "a deep dive audit of how much load is put on the netlify server"

**Done, measured, and published as an artifact.**

- `tools/loadsim.py` — runs the REAL polling ladder from `public/vote.html` against a
  behaviour model. Multiplying 20 phones by 3600s over 3s gives 72,000 polls and is
  wrong by 12×.
- Measured inputs: payload **2,530 bytes** on the wire (`curl` against production),
  **155ms** billed (measured inside a live function), **15 blob reads per poll**
  (`test/cost.mjs`, and it fails the build above 15).
- Netlify has moved to **credits**: 2/10,000 requests, 20/GB, 10/GB-hour, 15/deploy.

**The answer: one 3-hour gig with 20 people costs 2.8¢.** At 10,000 artists that is
$5,597/mo against $100,000/mo of revenue — **5.6%, and the ratio does not move with
scale**, because both sides scale with the same thing.

**The finding Perry did not ask for and needs most:** deploys are 29× the cost of
gigs. 104 production deploys of `mysetvip` last month = 1,560 credits; every gig he
played = 84. The account burned 2,475 credits against a 1,000 grant, and ~570 of
those are the same change shipped twice (CLI + the GitHub build the same push
triggers — INVARIANT 9d3).

**And the counterintuitive one:** moving to Cloudflare Workers + KV would be
**1.7× worse**, because KV bills $0.50/million reads and MySet does 90,450 reads per
gig. The platform is not the cost driver; fifteen reads per poll is.

Report: https://claude.ai/code/artifact/11ac87fe-57f6-439f-9459-99836b76e7f5

## 5. "i'd also really really like to make sure the code of this app is as secure as possible"

**`SECURITY.md`** — the full answer. Concrete changes shipped today:

| | |
|---|---|
| A real CSP | was `frame-src` only, so an injected `<script src="//elsewhere">` would have run. Now `default-src 'self'` with a named allow-list, verified on all seven pages in a real browser: zero violations |
| `X-Content-Type-Options: nosniff` | a stored upload that sniffs as HTML was servable as HTML from our own origin |
| HSTS `includeSubDomains; preload` | bar wifi is exactly the network where this matters |
| `Permissions-Policy` | camera, microphone, location, payment, USB all denied |
| `Cross-Origin-Opener-Policy` | a page we open cannot reach back through `window.opener` |
| `npm audit` | one moderate (`qs`, via Stripe) → **zero** |
| `/.well-known/security.txt` | the difference between a finder emailing you and a finder posting it |

The honest weakness, written down rather than glossed: `script-src` still needs
`'unsafe-inline'`, so the CSP does not stop an injected inline script — it stops that
script loading or sending anything, since `connect-src` is `'self'`. Hashes are Tier 1
in SECURITY.md.

**The threat model, ranked:** #1 by a wide margin is Perry's own Google / GitHub /
Netlify / Stripe accounts being phished — none of which involves a line of MySet's
code. Hardware or passkey 2FA on all four is twenty minutes and is the highest-value
item in the document.

**The gap to a $100M SaaS is not code.** It is: nobody has tested a restore, nobody
is alerted when something breaks, there is no written plan for a bad day, and the
founder's own accounts are the softest target. INVARIANT 0dw.

---

## Tests

**28 suites, 1,350 assertions, 0 failed.** New: `test/clips.mjs` (44),
`test/books.mjs` (43), `test/passkeys.mjs` (30).

## Files

New: `_video.mjs` `vid.mjs` `_ledger.mjs` `_passkey.mjs` · `test/clips.mjs`
`test/books.mjs` `test/passkeys.mjs` · `tools/loadsim.py` · `SECURITY.md`
`ACCOUNTING.md` · `public/.well-known/security.txt`

Changed: `_community.mjs` `community.mjs` `_img.mjs` `_account.mjs`
`_venueaccount.mjs` `admin.mjs` `venueadmin.mjs` `auth.mjs` `autocron.mjs` ·
`public/community.html` `public/studio.html` `public/venue-studio.html` ·
`netlify.toml` `test/stripe-fake.mjs` `test/cost.mjs` `test/run.sh` ·
`ACCOUNTS.md` `INVARIANTS.md`

## Still Perry's to do

1. **Stripe webhook:** add `charge.updated` (from yesterday — still outstanding).
2. **Netlify:** stop the double deploy, and move to Pro ($20/3,000 beats $9 + top-ups
   at 2,475 credits/month).
3. **2FA** on Google, GitHub, Netlify and Stripe. Twenty minutes, highest value in
   SECURITY.md.
4. **Try the passkey.** Sign out, sign back in with Face ID, and tell me whether it
   is actually faster on stage.
