# ACCOUNTS.md — the account system

*Written 2026-09-04, rewritten 2026-09-05. What an account IS on MySet, what it can do, who may do what with it, how it is paid for, how it is recovered, and how it leaves. Read this before touching sign-in, roles, sessions, plans, billing or deletion. The rules that must never break are in `INVARIANTS.md` (0cr–0dp).*

---

## 1. What was already here (and is kept)

MySet already had the bones of a real account system before this pass. None of it changed shape; this document is the first place it is described end to end.

| Piece | Where | How it works |
|---|---|---|
| **Identity** | `_auth.mjs` | An *artist* (`artistId`, a slug, a name) owns a page. A *venue* (`venueId`) owns a venue page. Both live in one registry document each (`artists`, `venues`) keyed three ways: by id, by slug, by email. |
| **Sign-in** | `auth.mjs`, `venueauth.mjs` | You type an email, we send a six-digit code (Resend), you type it back. A signed token (HMAC, `signToken`) is stored in the browser. Passwordless when this was written; since 2026-09-14 a password sits under the email, one per sign-in address, and the code is how an account is made and the whole of "forgot" (decision 0070, §11). |
| **Session revocation** | `_auth.mjs` (`revOf`) | Every token carries the account's *revision*. Removing an email, or any change that must sign everyone out, bumps the revision and every old token dies at once. There is no session list to clean up because there is nothing to list — the revision is the list. |
| **Members** | `auth.mjs` `list/add/remove` | An artist page can have up to 5 sign-in addresses on Rock Star (1 otherwise). Owner vs member roles; members cannot touch money, plans or deletion. |
| **The founder's recovery key** | `_lib.mjs` `ownerOf` | `ADMIN_CODE` is checked first so a lock-out can never shut Perry out of his own platform. It never lives *only* in an env var (INVARIANT — see `HARDENING.md`). |
| **Per-page Studio code** | `show.codeHash` | The older door: a code per page, hashed, with lock-out after repeated failures (`codeLocked`, `noteCodeFailure`). Still works for the founder's own page. **Since 2026-09-14 it opens in a small window from "Sign in with a Studio code instead" at the foot of the sign-in screen**, which is email + password (§11); from 2026-09-12 it had sat behind a small "Studio code" link on a screen of email + "Email me a code" + a box for a code already received. |
| **Plans** | `_plan.mjs`, `_venues.mjs` | Hobbyist / Bar Star ($10) / Rock Star ($20) for artists (ids `free` / `plus` / `pro`, decision 0055); Free / Pro ($20) for venues. `planForArtist` reads the registry row; a plan with a `planUntil` in the past falls back to free. Comps (`billing:'comp'`) were the only way to be on a paid plan. |
| **Referrals and promo codes** | `_plan.mjs` | A referral rewards the referrer when the referred pays; a promo code sets a `discountPct` on the row. |
| **Verification** | `_verify.mjs` | ID check queue for the tick; auto-verify from a Stripe Connect identity for artists. |
| **Getting paid (artists)** | `_connect.mjs` | Stripe Connect Express, direct charges on the artist's account, MySet's fee as `application_fee_amount`. |

What was missing, and is what this pass built: **paying for a plan**, **leaving a plan**, **venues getting paid**, **taking your data with you**, and **deleting yourself**.

---

## 2. Design choices (why it is built this way)

The reference class was "small SaaS with a free tier and one or two paid tiers": Linktree, Bandcamp's artist side, Substack, Carrd. Three things they all do, and MySet now does:

1. **Stripe holds the card, we hold a pointer.** MySet never stores card data, never computes a renewal date itself, and never decides whether an invoice was paid. Stripe Billing is the source of truth; we mirror the *plan* onto the registry row so every existing `planForArtist` call keeps working unchanged. One `billing_<owner>` document per owner holds `{customerId, subId, priceKey, status, currentPeriodEnd, cancelAtPeriodEnd, retention, lastSyncAt}` — pointers, not money.

2. **Two ways to learn the truth, and neither is trusted alone.** Stripe tells us about a subscription by **webhook** (`customer.subscription.updated/deleted`, `invoice.payment_failed`, `checkout.session.completed`). Webhooks can be late or dropped, so there is a **belt**: coming back from Checkout calls `planFinish` (which reads the session from Stripe by id, never trusting the URL), and `maybeSync` re-reads the subscription from Stripe at most every 6 hours whenever the plan is read. A dropped webhook costs a user at most six hours, never a plan.

3. **Downgrades are gentle and honest.** Leaving a paid plan sets `cancel_at_period_end` — the month that was paid for stays paid for. Moving between paid plans updates the price on the live subscription with proration. The retention offer (50% off one month, coupon `myset_stay_50`) is applied **on the live subscription in Stripe**, so Stripe bills it — we never "remember to charge less" ourselves. It is offered once per account, ever (`billing.retention.usedAt`), and the offer itself is recorded (`offeredAt`) so the numbers are honest later.

4. **Prices by lookup key, created on first use.** `myset_plus_monthly`, `myset_pro_monthly`, `myset_venue_pro_monthly`. If Perry changes a price in the Stripe dashboard the lookup key moves with it; the code never hard-codes a `price_…` id. The dollar amounts in `PLANS` / `VENUE_PLANS` are used only to *create* the price the first time.

5. **One owner type, two kinds.** Every billing and Connect function takes an `owner` string: an artist id, or `v_<venueId>` for a venue. `isVenueOwner()` is the only place that distinction is made. This is why venue Connect was a small change and not a fork.

6. **Export before delete.** A user who can delete themselves must first be able to take everything with them. Export is a single JSON file with everything MySet holds about the account — and *never* a fan's device id (fans are counted, never named: INVARIANT 0bu).

7. **Delete is enumerated, not searched.** Blobs `list()` is banned (INVARIANT 1). `keysFor(aid)` is the one list of every key the app writes for an artist — show, meta, profile, requests, events, lists, learn, push, connect, feedback, lock, pitches, songstats, posts, likes, billing, the 12 fan shards, every archived show, lyrics and chart per song, and every image slot (cover, avatar, p0–p2, idcheck, each merch item, each post photo). **Adding a new per-artist key means adding it there** — the header of `_account.mjs` says so, and a test asserts the list covers what a fixture artist writes.

---

## 3. What was built (2026-09-04)

### Plans and billing — `_billing.mjs`
- `startCheckout({owner, plan, email, name, origin, back})` — Stripe Checkout in `subscription` mode, customer created once per owner, promo `discountPct` becomes a coupon `myset_promo_<pct>`. Refuses if already subscribed (change the plan instead).
- `finishCheckout(owner, csId)` — on return; checks the session's `metadata.owner` matches; rewards the referrer.
- `syncSubscription(owner, subId)` — active / trialing / past_due → paid plan with `planUntil = period end + 3 days` grace; anything else → free (unless comped).
- `changePlan(owner, plan)` — free → `cancel_at_period_end`; paid ↔ paid → price swap with `create_prorations`.
- `applyRetention(owner)` — the one-time 50% month; `noteRetentionOffered(owner)`.
- `portalLink(owner, origin, back)` — Stripe Customer Portal for card / invoices / receipts.
- `cancelForDeletion(owner)` — cancels immediately, used only by delete.
- `billingStatus(owner)` — what the Studio shows: `{subscribed, status, plan, renewsAt, cancelAtPeriodEnd, retentionUsed, portal}`.
- `handleBillingEvent(event)` — the webhook side.

### The Studios
- **Top right:** `Upgrade ↗` (orange outline) on free; a green tag with the plan's name and the same `↗` when paid. Both open the plan sheet.
- **The plan sheet:** every tier in an orange-bordered box, name and price bold white on an orange banner, a *numbered* list of everything in that tier (never "everything in Bar Star"), the transaction fee in orange and called exactly that, a testimonials carousel at the bottom (placeholders until real ones are submitted — the array is the architecture; empty it and the section disappears).
- **Settings → Your plan:** one big green button — "Upgrade your plan" on Hobbyist/Bar Star, "Rock Star membership" on Rock Star — plus a small "Card, invoices and receipts ↗" link to the portal when there is a subscription.
- **Leaving Rock Star:** "Are you sure you want to lose your Rock Star membership benefits?" (No in orange, Yes greyed) → "We're sad to see you go… keep your plan for 50% off for 1 more month?" → `planRetain` or `planChange`.
- **Back from Stripe:** `?sub=done&cs=…` → `planFinish` → toast; `?sub=cancelled` → "No change made". `?connect=done` → re-read Connect status.
- **Your account:** sign-in address and how many sign-ins the page has; **Download my data**; **Delete my account** (type DELETE).

### Venues getting paid — `_connect.mjs`, `venueadmin.mjs`, `pay.mjs`
- Same Stripe Connect Express flow as artists, keyed `v_<venueId>`; the Venue Studio's Merch tab has the "Getting paid" card (country, start/finish with Stripe, dashboard link) and an Orders list once payments are on.
- Merch checkout on a venue page is a **direct charge on the venue's account**; the buyer lands back on the venue's community page.
- An item needs a link only while card payments are *not* on.

### The fee split (Perry's rule, 2026-09-04)
MySet's transaction fee comes off the top as `application_fee_amount`. Stripe's own card fee (about 2.9% + 30¢) is charged to the connected account on a direct charge — i.e. to the venue. Perry wants that fee **shared evenly**, so for any plan row with `splitFee: true` (both venue plans) the application fee is reduced by half of Stripe's estimated fee:

```
fee = max(0, floor(amount × cut) − round((amount × 0.029 + 30) / 2))
```

| Example | Plan | Cut | Stripe est. | MySet keeps |
|---|---|---|---|---|
| $50 merch, venue on Free | 10% | 500¢ | 175¢ | **412¢** |
| $50 merch, venue on Pro | 2% | 100¢ | 175¢ | **12¢** |
| $12 cap, venue on Pro | 2% | 24¢ | 65¢ | **0¢** (floored) |
| $50 vote pack, artist on Bar Star | 10% | 500¢ | — | **500¢** (artists are not split) |

Two honest limits, both written into the Studio copy:
- It is an **estimate at checkout**. Stripe's real fee depends on card type and country. An *exact* split would need a post-charge `transfers.create` from the platform back to the venue after `charge.succeeded` reports the real `balance_transaction.fee`. That is the next step if the estimate ever matters at scale; today the amounts are cents.
- On small items at 2% the half-fee exceeds the cut and MySet's fee floors at **zero** — MySet then absorbs nothing beyond forgoing its cut, because a negative application fee is not a thing. That is the deal Perry chose; it is documented, not hidden.

---

## 4. Security properties

- **No card data, ever.** Checkout and the portal are Stripe-hosted pages.
- **Never trust the return URL.** `planFinish` reads the session from Stripe by id and checks `metadata.owner`; `?sub=done` alone changes nothing.
- **Webhook signature** is verified against `STRIPE_WEBHOOK_SECRET` (the *Your account* destination) or `STRIPE_CONNECT_WEBHOOK_SECRET` (the *Connected accounts* destination — Stripe signs each destination with its own secret, decision `0058`); events for an unknown owner are ignored, not guessed at.
- **Members cannot bill or delete.** `accountDelete`, `planCheckout`, `planChange`, `planRetain`, `planPortal` refuse non-owners (403).
- **Delete needs the word.** `confirm: 'DELETE'` in the body; the Studio makes you type it. The founder cannot be deleted from the app.
- **Retention is once, ever**, enforced server-side — the client can ask twice, the server answers once.
- **Fan privacy survives export.** Device ids are stripped from tips and orders before they leave.
- **Sessions die with the account.** Registry rows (byId, bySlug, byEmail) are removed last, after the data, so a token presented mid-delete finds nothing to act on.

---

## 5. What Perry has to do in Stripe (once)

1. **Webhook events** — on the existing endpoint add: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `checkout.session.completed` (already present for payments; it now also handles subscription mode).
2. **Customer Portal** — Settings → Billing → Customer portal → save the default configuration **in live mode** (the API refuses to open a portal session until a configuration exists).
3. **`charge.updated`** on the same endpoint — this is what makes the exact fee split (§8) run. Without it the estimate stands and nothing breaks; with it, MySet's share is corrected to the cent. **Done 2026-09-12**, with `account.updated`, which the list above had assumed was already there and was not.
4. Nothing else: prices, coupons and products are created by the app on first use.

---

---

## 6. The account system (2026-09-05)

Everything in §5 of the old version of this document — the "what is next" list — is now built, apart from passkeys. What follows is the shape of it, and the five holes it closed.

### 6.1 The holes, said plainly

Two of these were not gaps. They were ways to lose an account.

| | What was true | What it cost |
|---|---|---|
| **A member could take the account** | `add` / `remove` / `revokeAll` / `setSlug` in `auth.mjs` checked "are you signed in" and nothing else, though `verifyToken` has always returned the role | A band mate on a five-seat Pro page could delete the OWNER's sign-in address, or rename the public page that every printed QR code points at. One POST each. The venue side had the identical hole, plus a `staff` role that nothing read |
| **Sign out did not sign you out** | It cleared `localStorage` and told the server nothing | The token is an HMAC with a thirty-day life. A copy off a borrowed phone kept working for a month after the person believed they had left |
| **No recovery** | Two doors: a code to an address in `byEmail`, and the per-page studio code, which most artists never set. `ADMIN_CODE` resolves to the founder alone | Lose the inbox and the account was unrecoverable by anything the app offered |
| **No way to change your address** | The documented workaround was add-then-remove, which needs Pro seats *and* ran through the unguarded pair above | On Free and Plus there was literally no way to do it |
| **Delete was instant and final** | One sheet, one typed word, everything erased inside one request | No undo, and nothing kept |

### 6.2 Sessions, and why they cost nothing

A token now carries a **session id**: `email|exp|rev|sid`, parsed by popping the fixed fields off the END so nothing an address could contain can shift them (`normEmail` also strips `|` now — `a|b@x.com` used to be a valid address to this code). A three-field body is a token minted before this and still works.

Revocation lives on the **registry row the verifier is already holding**: `byId[aid].dead = { sid: whenThatTokenExpires }`. Two things fall out for free — an entry whose time has passed guards a token that has expired anyway, and pruning is a filter on a number. An account that has never revoked anything has no `dead` key at all, so the one document every poll reads does not grow for them. **Zero extra reads, zero extra writes, on every authenticated request.** Past twelve entries it bumps `rev` instead, which signs everything out: more revocation than was asked for is the safe way to fail.

The list a person looks at is a cold document, `sess_<owner>`, read only when the sessions screen opens. It holds a device CLASS ("iPhone · Safari"), never the raw User-Agent, and never an IP. "Last opened Settings" is written at most once an hour from the two settings actions the Studio already calls — it is labelled that way because printing "last used two hours ago" from a number that only moves when somebody opens Settings would be a number that lies.

**A session lasts a week and renews itself in use** (decision 0199, 2026-10-09). The token used to be good for thirty days from the moment it was minted. Now it lives seven days, and on any authenticated request where it is more than a day old the server answers with a fresh token for the same device — same address, same `rev`, same session id — in one response header, `x-myset-token`, which the Studio's `api()` keeps. A device that opens the Studio inside the week never notices; one left alone for a week signs in again. The renewal is an HMAC and a comparison, once a day per device: no read, no write, nothing on the poll. It rides only on a reply marked `no-store` — never on a shared, cached one. A device that was signed out stays signed out: the dead entry outlives every token it could have had. A token minted before this keeps its own expiry and renews the first time it is used a day in.

**Only the owner sees, and signs out, every device** (decision 0104). For any other seat the list, *Sign out* on a row, and *Sign out my other devices* reach only the devices signed in with that seat's own address. A session id outside that list is refused. Before this a crew phone's *Sign out my other devices* signed the artist's Studio out mid-gig. The venue side is the same.

### 6.3 Roles

`byEmail[email].role` always existed and carried a string. `_session.mjs` is now the one table that says what it means.

| | Can |
|---|---|
| **owner** | Everything. Money, plan, payouts, access, the page address, recovery codes, export, deletion |
| **member** | The page and the show: edits every tab but Money and Plans, which it sees (§6.3a), and reads the activity log |
| **crew** | Tonight only: run the show, see the Setlist, the queue and the requests |

A fourth, **`sample`**, belongs to no email at all (decision 0101): it is whoever holds the key in a sample page's link, looking at the Studio of the page the factory built for them. It is an empty set in `CAN`, and `admin.mjs` / `venueadmin.mjs` answer it from `SAMPLE_OK`, a short allowlist of reads; every other action answers `claim: true` and the Studio opens the claim sheet (§12).

**An unknown role falls back to `crew`, the least it could be.** Default-deny, so a role string this table has never heard of can never be an escalation — and `CAN['toString']` is an inherited Function, truthy with no `.has`, which is why the lookup is an own-property check and not a truthiness one.

Venues get the same three, named owner / manager / crew, and the orphan `staff` retires into `crew`.

### 6.3a Each seat, each tab (decision 0105)

Since 2026-09-28 the two roles are **starting points**. The owner opens *Settings → Who can sign in → Access* on a band mate or crew seat and sets each Studio tab to **Hidden**, **View** or **Edit**. The tabs are Setlist, Gigs, Money, Merch, Diary, Messages, Profile, Settings and Plans.

| Preset | Setlist | Gigs | Money | Merch | Diary | Messages | Profile | Settings | Plans |
|---|---|---|---|---|---|---|---|---|---|
| **Band mate** (`member`) | Edit | Edit | View | Edit | Edit | Edit | Edit | Edit | View |
| **Crew** (`crew`) | View | Hidden | Hidden | Hidden | Hidden | Hidden | Hidden | Hidden | Hidden |

- **Presets.** The presets are the reach each role already had, so no seat changes when this ships. Picking *Band mate* or *Crew* on the sheet puts every tab back to that preset.
- **What the registry stores.** It keeps only the tabs the owner changed (`byEmail[email].access`), so a seat nobody touched costs nothing on the document every request reads.
- **Floors and ceilings.** The Setlist is never hidden, because the stage needs it. Plans is never more than View. Running the show and the song requests belong to every seat, whatever its tabs say.
- **Owner-only, whatever a seat is given:** the plan and billing, payouts, the books and the business dashboard, who can sign in, the page address, the Studio code, recovery codes, Face ID, export, and deleting the account.
- **The server holds the line, the page follows it.** Each Studio action names its tab and whether it reads or changes it, and the server refuses the rest. A seat without Money gets no money on the Live tab either — not tonight's tips, their notes, or the vote buys. The Studio draws a hidden tab nowhere. A tab at View shows everything and changes nothing, under one "View only" note.
- **Alerts follow the tabs** (decision 0114). Every seat can switch alerts on for its own phone (*Settings → Alerts on your phone*). A seat's phone hears a merch order only if the seat can see Merch, and a message only if it can see Messages. Every seat hears the requests (songs, moods, birthday shout-outs). The owner alone hears the founder's alerts. Each address keeps up to eight phones, so no seat pushes another's out. Signing a phone out, removing a seat, or signing out everywhere ends those phones' alerts.

A venue keeps its fixed owner / manager / crew for now.

### 6.4 Recovery, and what "forgot password" means here

Since 2026-09-14 each sign-in address can have a password (§11, decision 0070), and "forgot password" means six-digit codes to that address: one signs you in, and another stands in for the old password when you choose a new one (Settings → *Password* → *Change*). Settings shows the rows under *Signing in* whether or not they are set up — all four on the owner's seat; any other seat gets only its own *Password* row (decision 0105, §6.3a):

> **Password** · set / not set. *Create* / *Change* — the current password, or a code emailed to you.
> **Face ID or fingerprint** · 1 device / not set up (on a phone that supports it).
> **Studio code** · on / not set. A code for this page, so you can get in from any phone even when email is slow.
> **Recovery codes** · 6 of 8 unused / not set up yet.

(Until 2026-09-14 the first row read *You don't have one. MySet emails you a fresh six-digit code every time.*)

**Recovery codes** are eight one-time codes in a Crockford-ish alphabet (no 0/O, no 1/I/L, because these get written on the back of a setlist in a dark room), hashed with the same site secret the six-digit codes use, shown once and never again. The door is `recoverySignIn { slug, code }`: the page name is public so it grants nothing on its own, it only says which lock to try. A wrong code, an unknown page and a locked-out page answer identically, so this cannot be used to find out who has an account. Using one bumps `rev` — a recovery code means something went wrong, so everything else goes out — then this device gets a fresh session, and everyone on the account is emailed.

The **studio code** was the other bug: the client asked for 4 characters and the server has always refused under 8, so somebody who did exactly what the box told them got an error. One number now, and the "the original code from Netlify keeps working as a backup" line is shown only to the founder, for whom it is true.

#### When everything is gone — the founder's procedure (written 2026-09-12)

No inbox, no password, no recovery codes, no Studio code, no passkey. The app offers nothing further, by design: a "contact us to get back in" door is an enumeration oracle and a social-engineering target. What exists instead is one human, the registry, and this page. Three steps, in this order, and **never while that artist's show is running** (`python3 tools/prod.py` says).

1. **Prove it is them, outside MySet.** Two of these, not one: a message from the Instagram or website linked on their own public page (they set those links from inside the Studio); the email on their Stripe Connect account matching what they claim — read it in the Stripe dashboard under Connect, never ask them for it; a venue on their calendar confirming that is the act they booked. If two cannot be had, stop. A wrong answer hands a page with a Stripe account behind it to a stranger, and nothing below can be undone by the real owner.
2. **Attach the new address, by hand.** This machine's Netlify CLI is signed in as the site owner. `netlify blobs:get myset artists > artists.json`; in `byEmail`, remove the row for the lost address if there is one and add `"<new address, lower-cased>": { "artistId": "<their aid>", "role": "owner" }`; in `byId[<aid>]` set `rev` one higher than it is (or one higher than the registry's top-level `rev` when the row has none — `bumpFrom` in `_session.mjs`), so every session on the account, including whoever holds the lost phone, is signed out. `netlify blobs:set myset artists --input artists.json`. That write **bypasses the etag** every server mutation uses (`casDoc`, `onlyIfMatch`): anything the app wrote to the registry between the get and the set is lost, which is why it happens in one sitting, with no show running, and is followed by a second `blobs:get` and a diff. Then delete `artists.json` — it holds every sign-in address on the platform. This is the same two edits `emailChangeFinish` makes in one `mutateArtists`, done by a person.
3. **Get them in, and get them set up.** They sign in with the new address (email and a code); the first thing they do is Settings → *Signing in* → a password, recovery codes and a Studio code. The activity log will not show any of this, so it goes in that day's `docs/sessions/` file.

**Rehearsed:** the read half, 2026-09-12 — `blobs:get myset artists` returned the registry with the shape described (`v`, `rev`, `byId`, `bySlug`, `byEmail`). The write half has not been run. On 2026-09-12 the founder's own account had **no `byEmail` row at all** (the founder signed in with the Studio code and `ADMIN_CODE`), so attaching one was to be the rehearsal; the 2026-09-25 backup shows owner rows on it, so a rehearsal now means adding a spare address to that account and taking it off again, on a quiet afternoon. The right fix is §10 item 6.

### 6.5 Moving your sign-in address

Two proofs, never one. `emailChangeStart` sends a code to the NEW address and a code to the OLD one, and mails the old address a notice **at request time** — if a stolen session is trying to walk off with the account, the owner hears about it while there is still something they can do. `emailChangeFinish` takes both; the second may be a recovery code instead, which is the answer for "I can't get into the old inbox any more". The swap and the session kill happen in ONE `mutateArtists`, so there is never an instant where the address has moved and the old sessions are still alive. Only the moved address's devices die: a bandmate on their own address on a five-seat page is left alone, because this might be happening at 11pm while they are running the screen. One change per 24 hours.

### 6.6 Leaving, with thirty days to change your mind

Perry's words: *"a 2-step double confirmation they have to click twice before their account is deleted (but still keep all the data stored somewhere)."*

**The data does not move. Not one document.** Copying forty-odd blobs into an archive namespace is forty writes that can half-fail, and a half-archived account is the precise opposite of what a grace period is for. Instead the row is marked, `publicArtist` refuses it, and every public endpoint 404s for free.

On day one: the page, the voting screen and the community page go dark; billing is cancelled immediately (never keep charging somebody who has left); any running show is filed; the calendar comes out of the city and schedule indexes. **Sessions are not killed and `rev` is not bumped** — the owner has to be able to get back in to undo. Soft delete locks the account DOWN; it must never lock the owner OUT. Every action except undo, export, the plan and the portal answers 423 with the sentence that tells them the way back.

**The slug is held for the whole window.** MySet page names are printed on QR codes stuck to bar tables. Freeing it would let a stranger take it, and every one of those codes would land a room full of people on somebody else's setlist — and Undo would be a promise the system could not keep. There is a link in the banner to free it deliberately, which is a decision rather than a surprise.

Thirty days later `autocron` purges one account per ring, on an hourly watermark. It runs before the show sweep, so the purge is time-boxed (`PURGE_BUDGET_MS`) and carries on next ring from the key it reached, which the queue keeps (`cur`). It deletes the key list from the end — what an index names before the index — so a run killed anywhere leaves nothing that cannot be found again (INVARIANT 0im, decision 0173). Once it has begun, Undo is refused: it would bring back half an account. The queue entry (`delqueue`) is removed LAST, so a crash halfway simply retries — purge is re-runnable by construction. `deleteArtist` itself is unchanged: it stopped being what the button does and became what the calendar does.

Venues get all of this too, keyed `v_<vid>`, on a new `keysForVenue()` — until this pass a venue could sign up, put a page up, take money and pay for Pro, and had no way to take its data or to leave.

### 6.7 The activity log

`log_<owner>`, written best-effort with `.catch(() => {})`: **a logging failure must never be the reason a musician cannot start a show.** Sign-ins, code sends, seats added and removed, roles changed, the studio code set, recovery codes made and used, the address moved, deletion started and cancelled. Never an IP, never a fan id (INVARIANT 0bu), never an amount.

**Complete since decision 0200** (2026-10-09). It was the newest hundred entries and the hundred-and-first fell off. It is now an append-only log in the shape every other record has (`_append.mjs`, decision 0068): a head of at most two hundred entries, oldest first, spilled into write-once parts `log_<owner>_p<n>` that are never rewritten and never trimmed. The screen still shows the newest twenty-five, newest first. The head and its parts are sealed at rest (`0113`), on the export-and-delete key list, and copied to R2 nightly by the mirror — which never deletes a copy, so the record outlives the account. A log kept the old way is carried over, in order, on its first new note.

---

## 7. Invoices, and the card that didn't go through

`invoices.list` on demand — never on a page load, because it is a network call to Stripe and the answer changes once a month. Rows show the amount, the status, the date and a link to Stripe's own hosted invoice.

The **dunning banner** costs no extra call at all: `billingStatus` already ships on every Studio boot and now carries `pastDue` and `graceUntil`. Three states, in Perry's voice, none of them shaming: while there is grace left, on the last day (naming every real consequence, built from the plan table so it cannot drift), and after it has run out. It is suppressed over a live show except in Settings — a bar about a card at 11pm on stage is the wrong pixel at the wrong moment, and three days of grace mean it can wait until the set is over (INVARIANT 16).

Two bugs went with it. `unpaid` was missing from the already-subscribed refusal in `startCheckout`, so an artist whose card kept failing could run Checkout again and end up with **two live subscriptions** billed side by side. And the portal returned with no marker, so somebody who had just fixed their card kept being told it had failed for up to six hours; the return URL now carries `?billing=back` and the Studio re-reads Stripe on the spot.

---

## 8. The exact fee split (`_feesplit.mjs`)

At checkout Stripe's card fee can only be ESTIMATED, because the real number depends on the card and the country and does not exist yet. `feeCents` subtracts half the estimate. This is the correction, and **it runs one way only: it pays the venue and never bills them.** If the real fee lands lower than the estimate, MySet has under-charged itself and eats the difference rather than clawing cents back from a bar.

Five things that are easy to get backwards, all load-bearing:

1. The event is **`charge.updated`**, not `charge.succeeded`. With Stripe's default async capture, `balance_transaction` and `application_fee` are both null on succeeded.
2. The balance transaction is the **connected account's** and must be read with that account in scope. The application fee is the **platform's** and must be read without it.
3. Stripe's fee is `fee_details[type === 'stripe_fee']`, **never `bt.fee`** — on a direct charge `bt.fee` also contains MySet's own application fee, so halving it would hand the venue a share of our own cut.
4. **Currency.** The charge is in USD; a Thai venue settles in THB, so the fee comes back in THB and is converted with the balance transaction's own exchange rate before it is halved. No rate, no guess: it records `unconvertible` and stops.
5. The mechanism is **`applicationFees.createRefund`, not `transfers.create`.** A platform-to-Thailand transfer is a cross-border transfer Stripe refuses outright, and MySet's first venues are Thai. A fee refund reverses money that arrived from this very charge, needs no platform balance, reconciles in Stripe's own reports, and Stripe itself enforces the never-below-zero rule.

Exactly-once is two layers: a claim in `meta_<owner>.fees` keyed by charge id (claimed is not delivered — INVARIANT 7b), and a Stripe idempotency key derived from the charge id.

**How small the numbers are, said plainly.** Venue merch is a Pro feature, so every venue sale runs the 2% row, and half of Stripe's fee exceeds 2% of anything under about $29. Below that MySet's fee is already zero at checkout, there is nothing to refund, and the correction records `nothing` and stops. It is built so the arithmetic is right when the baskets get bigger, not because it moves money today.

The honest sentence for the Studio and for anyone reading this:

> MySet pays half of Stripe's card fee, up to the whole of MySet's own fee. On small items that means MySet takes nothing and the venue still carries the rest of Stripe's fee.

On a $12 cap on Pro, MySet's fee is 24¢ and Stripe's is about 65¢: MySet gives up all 24¢ and the venue carries about 41¢. That is not an even split and is never called one.

---

## 9. Passkeys — built, and the answer to "what would a real account system take"

### 9a. What was actually asked

Perry, 2026-09-05: *"the email they get to create an artist or venue page is just a
link right? hm... how much extra load will creating an actual account system add? it
can't remain a browser-memory based system only forever... give me a concise run down
on exactly what that would take, what the path would look like, the pros and cons,
and when you'd recommend starting that process. when you do your research, please
implement the best option only for me."*

The first thing to correct is the premise, because it changes the answer.

**It is not a link, and it is not browser-memory.** Signing in emails a **six-digit
code**, which is checked on the server, times out in ten minutes, locks out after
repeated failures, and is exchanged for an **HMAC-signed token** carrying an account
id, an expiry, a revocation counter and a session id. The server can kill any single
session or all of them. That is not a magic link and it is not localStorage
pretending to be auth — the browser only *stores* the token, the way it would store
a cookie. The nearest thing in the industry is Slack's email sign-in or Notion's
login code, and both are used by companies far past $100M.

So the honest framing is not "we have no account system". It is: **the account system
is one factor — an inbox — and it is slow to use on stage.**

### 9b. The four options, and the pros and cons

| Option | What it adds | Cost to build | Cost to the person | Verdict |
|---|---|---|---|---|
| **Passwords** | A second thing to steal. Requires hashing, a reset flow, a breach-list check, and a "forgot" path that is *itself* an email code — so it lands you back where you started, plus a liability | ~2 days | Something to forget | **No.** It is strictly worse than what exists. The reset flow proves it: the email code is the real credential either way. |
| **Passkeys** | Face ID / Touch ID / Windows Hello. Phishing-proof by construction — the browser refuses to sign for the wrong domain | ~1 day | Nothing. One look | **Yes — built.** |
| **Social sign-in** (Google/Apple) | One tap, familiar | ~1 day per provider, plus OAuth callbacks and account-linking edge cases | Hands your customer list to a third party, and breaks for anyone who signed up with a different address | **Later, maybe.** Apple's is worth it when there is an iOS app. |
| **A full identity provider** (Auth0, Clerk, WorkOS) | SSO, SAML, MFA, an admin console | ~2 days to integrate, then $0.02–$0.05 per active user per month, for ever | A redirect to somebody else's domain | **No, not yet.** At 10,000 artists that is $2,000–5,000/mo to replace something that works, and it makes sign-in depend on a third party being up during a gig. Revisit only when a venue *group* demands SAML. |

### 9c. What was built, and how much load it added

Passkeys, in `netlify/functions/_passkey.mjs`, **with no npm dependency**. WebAuthn
verification is four things Node already does: SHA-256, an ECDSA or RSA signature
check, base64url, and enough CBOR to read two maps. The libraries are convenience,
not capability, and a dependency in the sign-in path is a dependency that can be
taken over.

The load it added, precisely:

- **271 lines** of server code, one new blob key (`pkeys_<owner>`, already reserved
  in `keysFor` since 2026-09-04, so export and deletion already covered it).
- **Zero cost on any hot path.** Nothing here runs during a gig; the audience never
  signs in at all (`INVARIANT 9g`), so `test/cost.mjs` is untouched.
- **Two new doors**, both rate-limited by the same rules the existing ones use, and
  both answering identically for an unknown page so neither becomes a way to
  enumerate accounts (`INVARIANT 9h`).
- **No new failure mode for anybody who does not use it.** The code sign-in, the
  studio code and the recovery codes are all unchanged. A passkey is *added to* an
  account, never a way to create one — the first proof of identity is still an inbox,
  because that is also what gets you back in when the phone is lost.

### 9d. The five checks, and why each is in the test

WebAuthn is only worth having if all five hold. `test/passkeys.mjs` generates a real
P-256 key pair, builds real authenticator data, CBOR-encodes a real attestation
object and signs with the real algorithm — then **defeats each check on purpose** to
prove it fires. That is what makes it verifiable without a physical device, which is
the objection that stopped this shipping on 2026-09-04.

1. **Ceremony type** — a registration replayed as a sign-in is refused.
2. **Challenge** — ours, under five minutes old, and **spent once**. Spent even when
   the answer was *wrong*, or an attacker gets unlimited attempts at a live nonce.
3. **Origin** — exactly ours. This is the anti-phishing property; without it a
   passkey is no better than a password.
4. **rpIdHash** — the authenticator's own view of the domain must agree.
5. **Signature** — over `authData || SHA-256(clientDataJSON)`, no exceptions.

Plus the counter rule, which is subtler than it looks: a signature counter going
*backwards* means a cloned key and is refused — but iCloud and Google passkeys report
**zero for ever**, so refusing on "not greater" would lock out exactly the devices
this feature exists for. Both cases are pinned.

**Deliberately not verified: attestation.** Passkeys are created with
`attestation: "none"` because MySet does not care which brand of authenticator a
musician owns, only that the same one comes back. Checking a vendor certificate chain
would add real complexity to reject nothing we want to reject.

### 9e. Rolled out to Perry first, on purpose

The Settings row appears for anybody whose browser supports it, and the **Face ID
button on the sign-in screen only appears once that browser has signed in at least
once** — it needs to know *which page* before it can ask the phone, exactly like the
recovery door. In practice that means Perry sees it now, on his own account, and
nobody signing up for the first time is shown a door they cannot open.

Only the **owner** may add one, and a passkey opens the owner's session — so a band
mate on one of five Rock Star seats cannot register a thumbprint and take the account.

### 9f. When to do the rest

- **Now:** use it. Sign out, sign back in with Face ID, and see whether it is
  actually faster on stage than a code. That is the only test that matters.
- **Before the beta:** turn on the Settings row for everyone (it already is — the
  gate is browser support, not a flag) and add the same thing to the Venue Studio,
  which shares none of this code yet.
- **When somebody asks:** Sign in with Apple, once there is an iOS app to hang it on.
- **When a venue group demands SAML:** and not one day before, look at WorkOS.
- ~~**Never:** passwords.~~ Revised 2026-09-14 by the founder — §11.

---

## 11. Email + password — the standard door (2026-09-14, decision 0070)

The founder asked for "the fully standard shape": the email address as the
username, a password under it, a sign-in screen that looks like every other one.
Built, in both Studios, without giving up what §9b was protecting:

| | |
|---|---|
| **Per person** | One record per sign-in address, `cred_<owner>_<hash of email>`, never per page. Each of a Rock Star's five keeps their own and their own role. |
| **Hashed like a password** | scrypt from `node:crypto` (no dependency), a 16-byte salt per record, N=2¹⁴ r=8 p=1 — ~40 ms, paid once at sign-in. Compared in constant time. `_cred.mjs`. |
| **Swapped for a session** | A correct password mints the same 30-day token every other door mints (`open()`); the password never travels again, and the session can be listed, signed out and revoked like the rest. |
| **One answer for every failure** | No account, no password set, wrong password, locked out — the same sentence, the same status, the same scrypt cost. Five wrong on one address and it waits fifteen minutes; the lock is per address (and per realm), so a guess at a band mate's password never locks the owner's door. |
| **Set, change, forget** | Settings → *Password · Create / Change* — the current one to change it, **or a fresh six-digit code to the same address** (the "forgot" path). A change signs that address's other devices out. `passwordClear` needs the current one. After a code sign-in with no password on the address, the Studio offers one, once, skippable. |
| **What it may not be** | Under 8 or over 128 characters, the email itself, one character repeated, or one of a short list everybody tries first. No breach-list call — that is an outbound request on the sign-in path. |
| **What stays** | The six-digit code is still how an account is made and the whole of recovery. The passkey is still the fast, phishing-proof door. The Studio code — per page, SHA-256, sent on every request, the founder's own door — now lives in a small window off the foot of the sign-in screen; hashing it slowly would cost every Studio poll, since it is checked on each. |
| **Delete and export** | `keysFor` / `keysForVenue` name the records; a hash is not data an artist takes with them, so the export never carries it. |
| **From the Studio code** | A code session has no address, so Settings → *Password* lists the account's owner/manager addresses instead: pick one, *Email me a code*, type the code and the new password. The server (`passwordSet` with `email` + `code`) accepts only an address that is on this account and not a member/crew row, and only with a code that address received. Same in the Venue Studio. (The first cut sent a code session away to "sign in with your email first" — a door to a door; the founder hit it on 2026-09-14.) |

The screen: a pink-orange-ringed box, *Welcome back*, Email over Password, a
filled pink-orange *Sign in*, *Forgot your password?*; below it *New here? Join
the MySet family* and a ringed *Create account*; at the foot, small grey
underlined *Sign in with a Studio code instead*. "Create account" and "Forgot"
both send a code; after it a new account picks its name and is offered a
password. `test/password.mjs` holds all of it.

## 12. Sample pages and the claim (2026-09-28, decision 0101)

The factory builds a page for an artist or a venue who never asked for one, and sends
it as `myset.vip/<slug>#sample-profile` (`/v/<slug>#sample-profile` for a venue; a name
somebody already has gets a word after it, `-music` or `-live`, never a number). Until
it is claimed:

| | |
|---|---|
| **Not on the list** | The account's data lives under its own keys like any account's, but it is registered in `samplereg`, not in `artists` / `venues` — so no public door, directory, sheet or metric can find it, and the registry every phone reads never grows by one. |
| **The label, not a key** | `#sample-profile` is the same on every page — the founder's call on 2026-09-28, because twelve random characters read as spam. So it is NOT a secret: the address alone opens the page and the address alone can claim it. The guard is the founder's push on every claim and the fourteen-day undo. The bare address, without the label, is the ordinary "no such page". A wrong label answers like an unknown page. |
| **Looking, not touching** | The Studio opens on the label under the role `sample` (§6.3): its tabs draw, a save opens the claim sheet. Only `admin.mjs`, `stage.mjs` and `venueadmin.mjs` accept it; every other door answers 401. |
| **The claim** | The door every account uses — email, six-digit code, `verify`'s ticket — then `claimSample` (`auth.mjs` / `venueauth.mjs`) with the address and a password, in one sheet. One registry write adds the row on the free plan (Hobbyist, `src: 'sample'`) and the email as owner; the password is set; a session opens; the first-run picks up at the songs. An inbox that already has a page is told so and the founder is asked to merge. The founder can undo a claim for fourteen days (`undoClaim`), from the console's *Claimed* list. |
| **Saying no** | Nothing to tap: every message and the page's own note say "Don't want it? Let us know and we'll delete this preview forever – no harm, no foul!", and the founder's **Delete forever** on the console erases the page (or the copy kept after it came down) at once and keeps the act's identifiers as hashes so the factory never builds them again. The public sample door erases nothing — it has no secret to check. |
| **The clock** | Thirty days to claim, then the page comes down: a private snapshot is kept one hundred and eighty days for a second campaign (`reviveSample`: the same link while the address is free, and thirty more days), then erased. The page's own note says so. |

`test/samples.mjs` holds all of it.

---

## 10. What is next (not built, in order of value)

1. **Passkeys in the Venue Studio** — the artist side is built (§9); the venue side shares none of that code yet.
2. **Owner transfer** — the person who signed up leaves the band. Ten lines: a code to the owner's own inbox, and one `mutateArtists` that swaps two roles.
3. **A studio-code reset from the sign-in screen** — the change flow exists inside Settings; the "I'm locked out" version needs the same two-code shape as an email change.
4. **The Studio's own view of the fee split** — the corrections are recorded per charge in `meta_<owner>.fees`; the Orders list does not show them yet.
5. **`transfers.create` for the over-the-floor case** — only needed if MySet ever decides to pay a venue MORE than its whole fee, which is out of scope by design.
6. **An owner-only `ownerEmailSet { slug, newEmail }` in `admin.mjs`** — the "lost everything" procedure in §6.4 done by the app instead of by hand: one `mutateArtists` that swaps the `byEmail` row and bumps the account's `rev`, in the block that takes the founding page's owner seat (`isPlatformOwner` and role `owner`, decision 0099), logged. Twenty lines, and it retires the only production write this document asks a person to make with `blobs:set`.
