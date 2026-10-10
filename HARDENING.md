# Hardening — the parts only Perry can do

Claude never sees or handles a secret (INVARIANT 11). Everything below is done in
a browser, by you, and takes about twenty minutes in total.

Ordered by value. Do 0 before the security pass's last slice is merged; then 1 and 2;
3 is worth an evening when you have one.

---

## 0 · The server's own secret (two minutes, before decisions 0112/0113 merge)

One variable, `MYSET_SECRET`, made on your own Mac and never shown anywhere. In Terminal:

    curl -fsSL https://raw.githubusercontent.com/perryidyll/myset/main/tools/serversecret.mjs | node --input-type=module

(or `node tools/serversecret.mjs` from a checkout; `--dry-run` looks first). It makes a
random value, keeps a copy in your login Keychain, and sets it in Netlify for
**Production, Deploy Previews and Branch deploys**, marked secret — never **Local
development**, where Netlify shows a value to anyone who can open the project, secret or
not. It reads it back, says *Done*, and never prints the value. It refuses if the
variable is already there. It needs the Netlify command line, logged in (`netlify
login`) — the one `tools/prod.py` and `tools/hqpass.mjs` use.

**If it is already set, there is nothing to run.** The Notion record says a session set
`MYSET_SECRET` on the founder's word on 2026-09-28 (Production, Deploy Previews and
Branch deploys, marked secret), with a Keychain copy under the account name `mysetvip`;
the tool then refuses, which is right — and on 2026-10-09 the deploy preview of PR #150
confirmed it by content: `seal: { secret: true, ring: 'absent' }` — and production said the same at 08:41 UTC, fifteen seconds after the merge (`e996865`). `/api/health` says by content whether a deploy
holds a secret (`seal.secret`) and whether the keyring opens under it (`seal.ring`:
`absent` before the first sealed write, then `ours`; `other` means the value is not the
one that wrapped the ring, and the watch tells the founder). The rotation below reads
the Keychain copy with whichever account name it was saved under.

By hand instead: https://app.netlify.com/projects/mysetvip/configuration/env → **Add a
variable** → **Add a single variable**; key `MYSET_SECRET`; tick **Contains secret
values**; the value from `openssl rand -hex 32 | pbcopy` in Production, Deploy Previews
and Branch deploys and nothing in Local development; **Create variable**. Paste the same
value into your password manager, then clear the clipboard: `pbcopy < /dev/null`.

**Keep the copy.** Netlify never shows a secret value again, and changing it later needs
the old one (below). Never paste it into a chat, a file or a commit (INVARIANT 11) — not
even one a session made for you.

The value takes effect on the next deploy — the merge of the pull request that carries
0112/0113 is that deploy. Nobody is signed out by it: tokens made before it keep
working for a month.

**Never remove `MYSET_SECRET` once it is set.** The records sealed under it would read
as missing until it came back. They are kept, never written over, and the room keeps
voting, but sign-in with a password, the booker inbox and HQ would fail closed. If it is
ever deleted by mistake, run the tool again: it puts the Keychain's copy back.

**`FINMODEL_CODE` is no longer needed.** Since decision 0130 the money model is open and
nothing calls its old door; the Show log stands behind the CRM's passcode, whose cookie
verifies under every signing key like HQ's. The door in `_passgate.mjs` stays hardened
for the day a passcode comes back; then `FINMODEL_CODE` is required on Netlify again.

### Changing it later (a rotation, or a leak)

Not during a show: every device signs in again once, by design — after a leak, the old
key must stop opening anything at once.

1. Keep the old value as `MYSET_SECRET_PREVIOUS`, in the Keychain and in Netlify:

       security add-generic-password -a myset.vip -s MYSET_SECRET_PREVIOUS -w "$(security find-generic-password -a myset.vip -s MYSET_SECRET -w)"
       security find-generic-password -a myset.vip -s MYSET_SECRET_PREVIOUS -w | pbcopy

   In Netlify add `MYSET_SECRET_PREVIOUS` with it: **Contains secret values**;
   Production, Deploy Previews and Branch deploys.
2. Make the new value, keep it, and set it:

       security add-generic-password -U -a myset.vip -s MYSET_SECRET -w "$(openssl rand -hex 32)"
       security find-generic-password -a myset.vip -s MYSET_SECRET -w | pbcopy

   In Netlify, `MYSET_SECRET` → **Options** → **Edit**: paste it into the same three
   contexts. Then `pbcopy < /dev/null`, and redeploy (Deploys → Trigger deploy → Deploy
   site).
3. Wait for the keyring to move. The mirror's twenty-minute bell opens it, and the
   first open wraps it under the new value. `python3 tools/prod.py` shows
   `sealed at rest ... keyring last wrapped <time>`: once that time is after the
   deploy, it has moved.
4. Delete `MYSET_SECRET_PREVIOUS` in Netlify and redeploy. A week later, with nothing
   gone missing, delete its Keychain copy:
   `security delete-generic-password -a myset.vip -s MYSET_SECRET_PREVIOUS`.

Nothing is stranded by step 4. Recovery codes, Studio codes and passwords are slow
salted hashes that depend on no key; every sealed record opens under the re-wrapped
keyring, and the keyring gives everything written from step 2 on a fresh data key.
If step 4 happens too early, sealed records read as missing — put
`MYSET_SECRET_PREVIOUS` back from the Keychain, redeploy, and wait for step 3.

If a copy of the store leaked together with the old value, records written before the
rotation stay readable to whoever holds both, until each is next written (which seals
it under the fresh key). Say so to the people affected; nothing in code can undo a
copy that already left.

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

The repo is **public** on a personal account (decision 0047 — the founder chose to keep
it so on 2026-09-12; this page used to say private). Branch protection has been on since
the same day (decision 0045): a ruleset rather than the classic rule sketched below — a
pull request with zero approvals, no force-push, no deletion, no bypass. The other steps
here still apply. None of them costs anything, and they are also what gives "trade
secret" any legal meaning later — you cannot claim you kept something secret if there
were no measures keeping it.
Note what public costs, too: no measure in code can keep the code from being
copied — only making the repository private can, one click and a few dollars a month
for the rulesets. **Pro first, then private** (GitHub Pro, about $4 a month): the account is
on GitHub Free, where a private repository's ruleset is not enforced, so private first
would switch off the lock on `main` (decision 0047's addendum, ledger PER-022).

**Two-factor** — <https://github.com/settings/security>. If it is not on, nothing
else on this list matters.

**Branch protection on `main`** — done 2026-09-12 as a ruleset (decision 0045). As first
proposed: Settings → Branches → Add rule → `main`:
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
- **A privacy policy and terms.** The privacy notice is at /privacy (decision 0118) and the
  terms of use at /terms (decision 0119), both since 2026-09-29, written from the code, not
  by a lawyer. A lawyer's read of either is still open.
  You take money and you store device identifiers.
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

**Since 2026-09-28** (decision 0110, slice A of the security pass): a pledge comes
only from Stripe; `__proto__` and `constructor` are refused as names; an event id is
never markup and a picture is an address; the mirror and the backup skip the ID
photo and the store-kept signing key; the error log keeps paths only; every reply
carries the full HSTS. **Still open:** the network limits on every anonymous write
(decision 0111, next), and the server's own secret with the records that hold a
person sealed at rest (0112/0113 — waiting on the three variables above).
