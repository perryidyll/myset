# 2026-09-05 — the account system, the missing shows, and a page that is never white

*One session. Everything below is on `main` and live at myset.vip. 23 test suites, 1,233 assertions, all green.*

---

## What Perry asked for

His message, in his order:

1. Plan pop-up: text 2–3px larger; bold the main feature and leave the description unbolded; "every one" → "each"; testimonial heading → "what myset members have to say"; dragging the pop-up down also drags and refreshes the page behind it.
2. The Settings plan button is "obnoxiously green" — make it the same aesthetic as the tag at the top right; drop "You're on ___"; put the renewal date under the button in white; and *"i don't see the small link to the stripe page for cards, invoices and receipts beneath my button"* — check that everything a normal account has is on the founder's page too.
3. A logout button at the bottom of Settings just above delete, plus sign-out-everywhere; and a 2-step double confirmation before deletion, **but still keep all the data stored somewhere**.
4. Past shows missing from the Money tab.
5. Change-my-email, the exact fee split, in-app invoices, passkeys (only if not complicated) — and *"do we have a 'forgot password?' button and process in place? what about for 'change my password'?"* — venue team members, and a "your card didn't go through" banner.
6. Is auto-start on/off in Settings?
7. *"what about getting a proper account system in place? … it needs to be comprehensive, secure, and robust."*

Mid-turn, two more: the venue Studio's plan pop-up sticks halfway when dragged and its ✕ does nothing; and a white page flashes for a second or two before the black loading screen when tapping the artist or venue name.

---

## How it was worked

A seventeen-agent workflow: eight specialists reading the real code (auth security, an account-system design against the small-SaaS reference class, passkey feasibility, the missing shows, the exact fee split, invoices and dunning, venue members, and a Settings parity audit), eight skeptics tearing into each design against the codebase, then a chief engineer reconciling all of it into one build plan.

It earned its keep three times over. It found the member-can-take-the-account hole, it found a `TypeError` in code written earlier in the same session (`CAN['toString']` is a truthy inherited Function with no `.has`), and it correctly refuted the first diagnosis of the missing shows.

---

## Perry's actual missing shows — the real cause

The first diagnosis was a stranded legacy key. The skeptic pass proved that show (`2026-08-30-1855`) is a 151-second night with no song, no vote and nobody in the room, which today's archive would refuse to file anyway.

The real cause is in the production data. `2026-08-30-1928` has `startedAt` on 30 August at 19:28 and `endedAt` on **4 September**. Perry has six weekly recurring gigs, one for almost every night of the week. So five nights at five venues were appended to one show, and the Money tab showed one row for the lot — correctly, because that is genuinely what was recorded.

Two lines caused it:

- `autoTick`'s start branch answered a flat `already live`. Once a show failed to end itself, every following gig hit that line and did nothing.
- `sweep` re-pointed the artist's entry at their NEXT gig after a "still playing" deferral, so tonight was never due again and the show stayed live for ever.

Both are fixed. A live show that began before tonight's window is now ended, filed, and tonight starts fresh; a deferred end keeps its slot and tries again, with a six-hour backstop because a `nowPlayingAt` that stale means somebody walked away from the tablet.

**Nothing was lost by the archive.** Those nights were never separate, and no code can separate them now — the per-round tallies are destroyed when a new show starts. From here, every night stands alone.

### Nine more ways a night could vanish, all closed

| | What it did |
|---|---|
| `moneyForShow`'s Stripe setup sat outside its own `try` | A payments hiccup threw past `archiveShow` into an empty catch: the whole gig never archived, never logged |
| The index write built its row from the NEW snapshot, even when the detail kept the richer one | A night ended twice kept 13 songs on the detail page and a row that said 5 |
| Both writes ended in `.catch(() => {})` | A failed index write left a perfect night with nothing pointing at it. Now logged, parked in `histpend_`, and healed |
| The `status === 'pre'` guard | 'pre' is still settable, and once set made every later archive of that night return `null` for ever. Now `!show.startedAt`, which is the fact the guard actually wants |
| The index cap of 100 | Row 101 lost its row while its detail stayed on disk — invisible in the Studio AND missed by export and delete. Now 400, plus an append-only `histids_` that export and delete read instead |
| `history.mjs` hid the row unless status was exactly `ended` | Tapping "Resume it instead" made an archived night disappear |
| `moneyForShow` with no `startedAt` | Asked Stripe for everything since the epoch, ten pages, and reported the whole account's untagged money as this night's |
| `unattributed` was only on the detail document | The list printed `$0` for a night that took $3 |
| The browser's `HIST` cache was never invalidated | End a show, come back to Money, and the night was missing — indistinguishable from real data loss |

Plus a heal (`healHistory`) that rebuilds an artist's index from every id it can NAME — the index, `histids_`, `histpend_`, and the pre-multi-tenancy flat keys — with a "Look for missing shows" button in the Money tab. It obeys the same "a night where nothing happened is not a night" rule the archive does, so the two can never disagree.

---

## The account system

Full detail is in `ACCOUNTS.md` §6. The five holes it closed:

- **A member could take the account.** `add`/`remove`/`revokeAll`/`setSlug` checked "are you signed in" and nothing else, though the role has always been available. One POST deleted the owner's sign-in address; another renamed the public page every printed QR code points at. The venue side was identical, with a `staff` role nothing read.
- **Sign out did not sign you out.** It cleared localStorage. The token stayed valid for the rest of its thirty days.
- **No recovery.** Lose the inbox and the account was unrecoverable.
- **No way to change your address.** The documented workaround needed Pro seats and ran through the unguarded pair above.
- **Delete was instant and final.**

Built: session ids in the token with a zero-cost deny-list on the row the verifier already holds; a cold session list with real sign-out per device; three roles with default-deny; eight one-time recovery codes and a sign-in door for them; two-inbox email change with a notice to the old address at request time; a 100-entry activity log; and a thirty-day soft delete where **not one document moves** — the row is marked, the page 404s, billing stops the same day, and one tap undoes it. Venues get all of it, including the export and deletion they never had.

**"Forgot password"** is answered in the app rather than assumed: MySet has no password, and Settings now says so in a row that is always visible, beside the studio code and the recovery codes. The studio code's own bug went with it — the client asked for 4 characters and the server has always refused under 8.

---

## The rest of the list

- **Plan sheet** — 2–3px up throughout, `[bold thing, plain description]` pairs, "at each", the new testimonial heading, and both Studios matched.
- **Settings plan button** — the same soft green as the tag at the top right, the date beneath it in white, and a line that is never blank: a comped or free account has no Stripe customer and therefore no portal link, which is exactly why Perry could not find it.
- **Pull-to-refresh** — both handlers were firing. The gesture now stands down while any sheet is open.
- **The venue sheet** — its `closeSheet` never cleared the inline transform the drag left, so the sheet stuck and the ✕ looked dead. And `attachDrag` bound a fresh pair of listeners on every open, so stale closures raced the live one. One set for the life of the page now, delegated, with the ✕ excluded from the drag.
- **Never white** — every internal link paints the three-bar splash before navigating, internal links stay inside the installed app instead of throwing the user into Safari, and the Venue Studio finally has the boot screen it never had.
- **Invoices**, and a three-state "your card didn't go through" banner that costs no extra call. Two bugs with it: `unpaid` was missing from the already-subscribed refusal, so a failing card could produce two live subscriptions; and the portal returned with no marker, so somebody who had just paid kept being told they hadn't.
- **The exact fee split** (`_feesplit.mjs`) — the real number off the balance transaction, settled with a fee refund. It only bites above about $29; below that MySet's fee is already zero and there is nothing to split. Written down, not hidden.
- **Auto-start** was already in Settings under "Starting by itself". Confirmed, not rebuilt.

**Passkeys are not built.** They are buildable without any dependency, but the real win is speed rather than security, and they cannot be verified without a physical device. `ACCOUNTS.md` §9 has the reasoning and the design.

---

## What Perry has to do in Stripe (once)

1. Webhook events on the existing endpoint: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
2. Customer Portal → save the default configuration **in live mode**.
3. **New:** add `charge.updated` to the same endpoint. Without it the fee estimate stands and nothing breaks; with it, MySet's share is corrected to the cent.

Still his, from before: `AUTH_FROM` and the Resend domain, and the Instagram token.

---

## Verified how

- 23 suites, 1,233 assertions, all passing. New suite `test/accounts.mjs` (70 assertions) covers sessions, roles, recovery, email change and soft delete on both sides; `test/autoshow.mjs` gained the swallowed-night and heal cases; `test/billing.mjs` gained the exact fee split, including both account-scope traps.
- Every new screen rendered in headless Chrome at phone size and read back: the plan sheet, the Settings plan button, the signing-in block, the account block, the sessions sheet, both delete steps, the card banner, the leaving banner, the recovery door, and the Venue Studio's equivalents. The venue sheet's stuck-transform bug was reproduced and then proved fixed by asserting the inline transform is empty after `closeSheet`.
- Production data read directly with `tools/prod.py` to establish the real cause of the missing shows before changing anything.
