# Hardening — the parts only Perry can do

Claude never sees or handles a secret (INVARIANT 11). Everything below is done in
a browser, by you, and takes about twenty minutes in total.

Ordered by value. Do 1 and 2; 3 is worth an evening when you have one.

---

## 1 · Restricted Stripe key (10 minutes, highest value)

Today `STRIPE_SECRET_KEY` is a **full** secret key. If it ever leaked — a log, a
misconfigured deploy, a compromised laptop — whoever has it can refund your money
to their own card, read every customer you have, and create charges.

**MySet does not need any of that.** Verified by grepping every function: the app
makes exactly three Stripe calls, and all three are Checkout Sessions.

```
stripe.checkout.sessions.create      creating the payment page
stripe.checkout.sessions.retrieve    /api/confirm, redeeming one purchase
stripe.checkout.sessions.list        the Money tab's reconcile sweep
```

Signature verification (`stripe.webhooks.constructEventAsync`) is local maths and
needs no API permission at all.

So the restricted key needs **one** permission.

1. <https://dashboard.stripe.com/apikeys> → **Create restricted key**
2. Name it `myset-production`
3. Set **everything** to `None`, then set **Checkout Sessions** to **Write**
   (Write includes read — you need `list` and `retrieve` as well as `create`)
4. Create, copy the `rk_live_…` key
5. Netlify → **mysetvip** → Site configuration → Environment variables →
   `STRIPE_SECRET_KEY` → replace the value → **Save**
6. Redeploy so it takes effect (INVARIANT 9d3 — pushing is deploying):
   ```
   git commit --allow-empty -m "Redeploy: restricted Stripe key" && git push
   ```
7. Test a real £1 purchase on myset.vip, confirm the votes land, then **revoke
   the old `sk_live_…` key** in the Stripe dashboard.

Do not skip step 7. A rotated key that is still live is not rotated.

**Do not** use the "Authorizing an AI agent" key type. You want
**"Powering an integration you built"** — this is your own server, not an agent.

---

## 2 · GitHub hardening (10 minutes)

The repo is private on a personal account with no protections. None of this costs
anything, and it is also what gives "trade secret" any legal meaning later — you
cannot claim you kept something secret if there were no measures keeping it.

**Two-factor** — <https://github.com/settings/security>. If it is not on, nothing
else on this list matters.

**Branch protection on `main`** — Settings → Branches → Add rule → `main`:
- Require a pull request before merging
- Do not allow bypassing (include administrators)

Note the consequence, since it changes how we ship: with `main` protected, work
goes on a branch and merges through a PR. That is also what unlocks per-PR preview
deploys — which is the sandbox you asked about.

**Secret scanning + push protection** — Settings → Code security. Push protection
blocks a commit containing a key *before* it reaches GitHub. Netlify's scanner has
already caught one secret in this repo; this catches it a step earlier.

**Review your access** — Settings → Applications. Revoke anything you do not
recognise. Same for Settings → Developer settings → Personal access tokens.

**If anyone ever touches this code**, an IP-assignment agreement signed *before*
they write a line. Without one they may legally own what they wrote. It is the
most commonly skipped step and the most expensive one to fix afterwards.

---

## 3 · Worth doing, not urgent

- **Rotate anything ever pasted anywhere.** `ADMIN_CODE`, and the Stripe key as
  part of step 1. You can change the Studio passcode from Settings inside the
  Studio itself (INVARIANT 15d) — no terminal needed.
- **Trademark "MySet".** Plausibly the highest-leverage anti-copycat move that
  exists, since features are copyable and a name is not. Talk to someone who does
  this for a living; Thailand-plus-international is not a DIY situation.
- **A privacy policy and terms.** You take money and you store device identifiers.
  A ToS that prohibits scraping also gives you a contract claim, which is faster
  and cheaper than an IP suit.

---

## What is already done — don't pay twice for it

| | Where |
|---|---|
| Webhook signatures verified over raw bytes | `webhook.mjs` |
| Prices set server-side; the client names a pack, never an amount | `pay.mjs` |
| Tips clamped $1–$500 server-side | `pay.mjs` |
| Idempotency key on session creation | `pay.mjs` |
| Redemption replay-safe, three independent paths | `_pay.mjs`, INVARIANT 5c/7 |
| Zero card data — Stripe Checkout only | lightest PCI scope there is |
| No business logic in the client | INVARIANT 12b / 0bc, enforced by tests |
| Cross-tenant isolation | `test/tenancy.mjs`, 46 assertions, mutation-tested |
| Auth: 6-digit codes, HMAC-stored, 10-min expiry, 5 guesses, constant-time | `_auth.mjs`, INVARIANT 9i |
| Two direct dependencies, total | `package.json` |

**Still open and genuinely important:** there is no rate limiting on any endpoint.
That is the same defence as vote manipulation, and it is being designed now rather
than guessed at.
