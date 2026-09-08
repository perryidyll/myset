# Card payments are down, and the key is why

2026-09-08. Perry: *"please fix the stripe payment link, it's down for some reason."*

**It is not the code. The `STRIPE_SECRET_KEY` stored in Netlify is invalid, and Stripe
is rejecting it.** Nothing in this repository needs changing.

---

## What was checked, in order

| Check | Result |
| --- | --- |
| `myset.vip` and `/vote.html` | 200 — the site is up |
| `/api/pay` with an empty body | `400 missing fan` — the function runs |
| `/api/show?artist=perry` | `paymentsEnabled: true`, a show **live** since 2026-09-07 18:07 |
| Stripe account, read through the connected MCP | **healthy** — the account answers, sessions list fine |
| Connected accounts on the platform | **none**, which is correct: Perry's own money is taken on the platform account because it predates Connect |
| **`/api/pay` with a real request** | **`502 — Invalid API Key provided: ****HAsL`** |

Both paths fail identically — buying votes and tipping. So it is not a pack, a price, a
plan or a show; it is the credential.

## Why the button still appeared

`canTakeMoney()` in `_pay.mjs` is:

```js
!!process.env.STRIPE_SECRET_KEY && (isPlatformOwner(aid) || show.pay.ready)
```

**It checks that a key EXISTS, never that it WORKS.** A key that is present but dead
passes, so `paymentsEnabled` came back `true`, the room was shown *More votes* and *Tip
Perry*, and the failure only appeared on the tap.

That is the one thing here worth building later: a payments health check that runs off
the hot path (`P3-008`). It cannot go in `canTakeMoney` — that is read on the audience
poll, and a Stripe call there would put a network round-trip on the path every phone in
the room hits every few seconds.

## What the fan actually saw

Nothing ugly, and this part worked as designed. `public/vote.html` line 1041:

> *"Card payments aren't working right now — grab Perry between songs"*

The raw Stripe message never reaches a fan's screen. No leak, no confusing shrug beyond
the button having been offered at all.

## What the account looks like

Stripe itself is fine. Read through the connected account:

- One live checkout session actually **paid** on 2026-08-30 13:35 UTC — Helena Cari,
  Barcelona, $3.00 for five votes, `payment_status: paid`, `status: complete`. **That is
  a second real paying customer**, and it is not recorded anywhere in the project notes.
- The most recent session of any kind is 2026-08-30 17:29 UTC. **Nothing has been created
  since**, which is consistent with the key having gone bad at some point in the nine days
  since the gig.
- Checkout pages currently show **"Idyll Mastery"** as the business name, with that
  brand's logo and yellow button — a fan buying MySet votes sees a different brand. Not
  the outage, but worth fixing in Stripe's branding settings.

## The fix — Perry's hands only

I did not and will not touch the key. Rolling it and pasting it are both his.

1. Stripe Dashboard → **Developers → API keys** (live mode)
2. **Roll** the secret key, or create a new one, and copy it
3. Netlify → `mysetvip` → **Site configuration → Environment variables**
4. Edit **`STRIPE_SECRET_KEY`**, paste the new value, save
5. **Redeploy** — a running function keeps the old value until it restarts
6. Re-check with the same request that found this

## Why a live key goes bad

Most likely, in order: it was rolled in Stripe and Netlify never got the new one; it was
pasted with a truncation or a stray character; or **Stripe auto-revoked it** because it
was detected in a public place. The last one is worth ruling out — if a key leaked, the
rest of `SECURITY.md`'s ranked threat model applies, and `PER-003` (2FA on all four
accounts) stops being a nice-to-have.

## Recorded

- `IMPLEMENTATION_STATUS.md` — current focus, `PER-007`, `P3-008`, and two new risks
- No code changed. No tests changed. No deploy.
