---
id: 0096
title: MySet collects tax only on what MySet sells
date: 2026-09-27
status: decided
decided_by: perry
area: money
reverses:
superseded_by:
invariants: []
commits: []
tests: [billing]
files: [netlify/functions/_billing.mjs, test/billing.mjs]
---

## The question

Stripe began flagging MySet for tax. Its Tax tab shows four locations the money
has touched — Tennessee (the head office), California, Thailand, Germany and
Spain — with Germany and Spain marked *threshold exceeded* after two and one
transactions. That is not a real threshold being crossed: for a business outside
the EU selling a digital service to an EU consumer, the threshold is zero, so the
first sale trips it. Eighteen checkout sessions have gone through with tax turned
off and none with it on, and the account's fallback product category was still
*Digital products → Media → Digital video content*, inherited from the old
course products on the same Stripe account.

Underneath the flag sits the question that actually matters on a Connect
platform: **whose sale is it?** MySet takes money on two completely different
footings — plan subscriptions, which MySet sells to an artist, and tips, paid
votes and merch, which the artist sells to a fan and MySet merely carries. Tax
follows the seller. Getting that line wrong in either direction is expensive:
draw it too narrowly and MySet under-collects on its own revenue; draw it too
widely and MySet becomes the deemed seller for every artist on the platform.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Tax lives on MySet's own sales only. Correct the product category to SaaS, collect an optional tax number on plan checkouts, register in Tennessee, and stay out of the EU by making EU plan sales business-to-business | One Stripe setting, one field at checkout, one state registration | A `tax_id_collection` block on the subscription session | An EU artist with no VAT number is still a consumer sale MySet has not registered for — a known, bounded exposure |
| B | Turn on Stripe automatic tax everywhere and register wherever Stripe flags | Non-Union OSS registration, quarterly EU filings, probably an agent; ~0.5% per calculated transaction | A filing calendar MySet does not have | Months of cost and paperwork against three EU transactions |
| C | Flip Connect to marketplace-facilitator liability, so MySet accounts for tax on the artists' sales too | Enormous — MySet becomes the deemed seller for every gig | Tax on every tip and vote, in every country an artist lives in | Catastrophic; MySet would owe tax on money that was never its own |
| D — do nothing | Leave the category wrong, collect nothing, ignore the flags | Nothing today | None | The exposure compounds silently, and the wrong category quietly poisons every future calculation |

## What was chosen, and why

**A.** The Connect setting was already on *"only liable for tax on sales made by
your business"*, which is the correct posture and the one thing in this area that
was right; the decision is to keep it there deliberately rather than by accident,
and to write down why C is never on the table.

The EU part is the interesting half. MySet's EU-facing revenue is not fans buying
things — it is artists paying for a plan, and an artist charging money for gigs is
a business. A business that supplies its VAT number is reverse-charged: the VAT
becomes its own to account for and there is nothing for MySet to collect or remit.
So the fix is not a registration, it is a field. Collecting the number *now*,
before MySet is registered anywhere, is what keeps that door open: on the day a
registration is added, those artists are already marked as businesses and nothing
has to be reclaimed from anyone retrospectively.

The field is **optional on purpose**. Most artists on a plan are individuals with
no VAT number, and a required tax field is a hobbyist stopped at the till — which
is the ranking rule (*nothing may break the gig*) applied to the money path.

Tennessee is a separate matter, and less urgent than it first looked. The head
office is in Johnson City, so the connection to the state is not in question and
Tennessee does tax remotely-accessed software — but a sales tax is owed on sales
**sourced to Tennessee**, and Stripe's location list has no Tennessee row at all:
the four places money has come from are Germany, Spain, California and Thailand.
So there is nothing to collect there **today**. Registering early is defensible —
it is free and it means not scrambling on the first Tennessee customer — but it
starts a filing obligation, and a return is due every period afterwards whether or
not a dollar was taken. Which way to go is a question for an accountant, together
with Tennessee's separate business tax and its $100,000 per-jurisdiction
threshold.

## What this makes harder

- An EU artist who is genuinely a consumer — a hobbyist paying for a plan out of
  their own pocket — is a sale MySet is not registered for. That exposure is
  accepted knowingly, not overlooked. It is small while EU artists are few and it
  grows with them.
- Plan prices are set in USD and exclusive of tax. Once a registration exists,
  Stripe adds tax **on top** for US buyers, so a $10 plan becomes $10.70-ish in
  Tennessee. Whether EU prices should flip to tax-inclusive is a separate call and
  is not made here.
- The category `txcd_10103001` (SaaS, business use) is now set both as the account
  fallback and explicitly on the Bar Star product. Any new *product* created in
  code inherits the fallback — which is right for plans and wrong for anything
  that is not a plan. A future non-plan product must set its own category.

## What would reverse it

- EU plan revenue becomes large enough that the consumer slice is worth a
  Non-Union OSS registration (one member state covers all 27) — revisit when EU
  artists on paid plans reach a number worth filing for.
- MySet starts selling anything to fans on its own account rather than the
  artist's. The seller changes, and so does all of this.
- A tax authority disagrees about who the seller is on a tip or a paid vote. That
  is the assumption the whole record rests on.

## How it was verified

- `sh test/run.sh` — whole suite, exit 0, no ✗. `test/billing.mjs` 119 passed, 0
  failed, including four new assertions: the plan checkout asks for a tax number,
  never insists on one, lets Checkout update the customer's name and address, and
  **a fan's checkout asks for no tax number at all**.
- Read back in the Stripe dashboard: preset product category now
  *Digital products → Software → Software as a service (SaaS) – business use*
  (`txcd_10103001`), and the *MySet Bar Star* product carries the same code
  explicitly rather than by inheritance. Connect → Sales tax collection confirmed
  still on *"only liable for tax on sales made by your business"*.
- **Not checked:** no real EU artist has yet reached the VAT field, so the
  reverse-charge path has never run against live Stripe. No registration exists in
  any jurisdiction as of this record, so Stripe calculates and collects nothing
  anywhere — the field stores a number and waits.
- **Not advice.** The registration question was mapped, not settled. Tennessee and
  the EU exposure should be put to an accountant.
