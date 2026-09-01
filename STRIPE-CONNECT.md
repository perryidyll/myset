# Stripe Connect — what you need to do

Plain language, every step. Nothing here needs code knowledge.

---

## 1 · What we are trying to do, in one picture

**Right now:** a fan taps "Buy 5 votes". The money goes into **your** Stripe account.
That is fine, because you are the only artist.

**The moment a second artist joins**, their fans' money *also* goes into your account.
That is wrong. It is their money. You would have to pay them by hand, and you would
be holding cash that isn't yours — which is a legal problem, not just an awkward one.

**What we want:** the fan taps buy. The money goes **straight into that artist's own
Stripe account**. MySet takes a small slice on the way past (10% on the free plan).
Nobody has to move money by hand. Ever.

The tool for this is called **Stripe Connect**. Think of it like this:

> You are running a market. Each artist has their own stall. A customer pays at your
> till, but the money drops into the stall-holder's own cash box, and your till keeps
> a small commission automatically.

The technical name for that is a **destination charge** with an **application fee**.
You don't need to remember that — I do.

---

## 2 · THE ONE QUESTION THAT DECIDES EVERYTHING

**Do this first. Everything else depends on the answer.**

There is a real chance that Stripe does **not** allow the money-splitting we need for
accounts based in Thailand. I found a third-party source saying Thailand does not
support "destination charges and application fees" — which is exactly the feature we
need. **Stripe's own documentation does not confirm that**, so I will not tell you it
is true. But I will not tell you it is false either.

So ask Stripe. Copy and paste this to them:

> Hi — I run a platform (a web app where a live music audience pays to vote on songs).
> I want each performer to receive their audience's payments into their own Stripe
> account, with my platform taking a percentage automatically.
>
> 1. Is my platform account eligible for Connect **destination charges** with
>    `application_fee_amount`?
> 2. My platform account country is `______`. My performers will mostly be in
>    Thailand, and later other countries. Which of those combinations work?
> 3. If destination charges are not available to me, what is the supported
>    alternative — separate charges and transfers, or something else?

**Where to ask:** Stripe Dashboard → the **?** icon (top right) → **Contact support**.
Use chat or email. Keep their written answer.

**Also check right now:** which country is your Stripe account registered in? Dashboard
→ **Settings** → **Business settings** → it will say a country. Tell me what it says.
If your account is registered somewhere other than Thailand, the answer may be
completely different — and better.

**Do not skip this.** If the answer is "not available", then everything in section 5
is wasted effort, and we take a different road (section 8).

---

## 3 · What you already did — and what it did and did not do

You said you "completed the onboarding flow". That was a good move, but I need to be
straight with you about two things.

**First: I cannot check it.** I have no access to your Stripe account, and that is
deliberate — you have never given me your Stripe key and you should keep it that way.
So when I say "I can't confirm it's working", that is not me being lazy. I genuinely
cannot see it.

**How you can check it yourself, in 20 seconds:**

1. Go to <https://dashboard.stripe.com>
2. Look down the left-hand menu for the word **Connect**
3. If **Connect** is there, click it, then click **Accounts**
4. What do you see? Tell me:
   - Is there a list of accounts, and how many?
   - Or does it say something like "no accounts yet"?
   - Or is there no **Connect** menu item at all?

**Second, and this is the important part: MySet's code does not use Connect.**

I searched every server file for the pieces that would make it work
(`application_fee_amount`, `transfer_data`, `stripeAccount`, `on_behalf_of`,
`accounts.create`). **There are zero.** The 10% cut is written down in the plan
descriptions and shown to artists — but it is never actually charged, and never has
been.

So finishing the Stripe onboarding was **necessary but not sufficient**. It is like
having a bank account ready but no card reader plugged in. Until I write the code,
every artist's money still lands in your account.

**This is not something you did wrong.** It was always the next job.

---

## 4 · Two decisions only you can make

### Decision A — how much hand-holding do artists get?

When a new artist signs up, Stripe needs their details (name, bank account, ID) so it
can pay them legally. There are two ways to collect that.

|  | **Stripe does it (recommended)** | **You do it** |
|---|---|---|
| Who asks for the artist's bank details | Stripe, on their own pages | Your app, on your own pages |
| Who handles ID checks and tax forms | Stripe | You |
| Who they email when something is wrong | Stripe | You |
| Work for me to build | About a day | Weeks |
| Downside | Artist briefly sees Stripe's branding | You are responsible for a lot |

**My strong recommendation: let Stripe do it.** You are one person. You do not want to
be in the business of verifying strangers' identity documents. The branding downside
is tiny — musicians already know what Stripe is.

### Decision B — who pays the card fee?

Stripe charges roughly 3% + a small fixed fee on every payment. Someone absorbs that.

- **Option 1:** the artist absorbs it. They get (payment − Stripe's fee − your 10%).
  Simplest, and normal for marketplaces.
- **Option 2:** you absorb it. Your 10% becomes more like 7%. Kinder, and cheaper for
  the artist to say yes to.

On a **$3** vote pack the card fee is a big slice of a small payment. Worth thinking
about whether $3 is the right smallest pack at all — that may be a bigger lever than
the split. Your call; tell me which you want.

---

## 5 · The exact steps in Stripe

**Only do this after section 2 comes back positive.**

### Step 1 — turn Connect on

1. Go to <https://dashboard.stripe.com>
2. Left menu → **Connect**. (If it isn't there, use the search box at the top and type
   `Connect`.)
3. Click **Get started**.
4. It will ask what kind of platform you are. Choose the option about **paying out to
   other businesses or people** — a marketplace. It is **not** the option about
   collecting payments only for yourself.
5. Fill in the short form about your business. Be accurate; this is a real legal form.

### Step 2 — fill in your platform profile

Stripe asks how your platform works, so it knows what rules apply.

1. Connect → **Settings** → **Platform profile**
2. Answer honestly:
   - Your users are **service providers** (musicians performing)
   - Money flows **from a fan, to the musician, with your platform taking a fee**
   - Payments are **small and frequent**
3. Save.

### Step 3 — set your branding

This is what an artist sees while Stripe is asking for their bank details.

1. Connect → **Settings** → **Branding**
2. Upload the MySet icon (in the repo at `public/icons/icon-512.png`)
3. Set the accent colour to **`#FF375F`** (MySet's pink)
4. Set the business name to **MySet**
5. Save

### Step 4 — get me the one setting I need

1. Connect → **Settings**
2. Find the section about **account types** or **onboarding**
3. Screenshot that whole page and send it to me

I need to see which options your account actually offers, because it varies by country
and by account age. I would rather look than assume.

### Step 5 — do NOT send me any keys

You will see things called **API keys** and **secret keys** and possibly a **Connect
client ID**. **Do not paste any of them to me.** Not one.

When I need a value set, I will tell you the exact name, and you will set it yourself
in Netlify — the same way you did the Stripe key. I never see it. That is not a
formality; it is the rule that keeps your money safe from my mistakes.

---

## 6 · What I build after that

For your information. No action needed.

1. **A "Get paid" button** in the artist's Studio, in the Money tab. Tapping it sends
   them to Stripe's own pages to enter their bank details, then brings them back.
2. **Remember who they are.** Store the id Stripe gives back for that artist, next to
   their account. It is not secret, but it is theirs.
3. **Change the checkout** so the money is aimed at that artist's account and MySet's
   percentage is taken automatically.
4. **Change the webhook** so a payment is still delivered correctly when it belongs to
   a connected account.
5. **A safety gate — and this is the one I care most about.** Until an artist has
   finished their Stripe setup, their audience's **buy and tip buttons stay switched
   off**, with an honest message. That is much better than the current behaviour,
   where the buttons work and the money silently goes to you. (Verified findings
   C031, C054 and C067 are all this one problem.)
6. **Tests** for all of it, including the gate.

**I can build number 5 today, before Connect exists at all**, and I think we should.
It turns a money problem into a switched-off button. Say the word.

---

## 7 · How we test it without risking real money

Stripe has a complete pretend mode. Fake cards, fake bank accounts, fake payouts,
real behaviour.

1. In the Dashboard there is a **Test mode** switch (top right). Turn it on.
2. Everything you do there uses fake money. You cannot lose a penny.
3. I write the code and we run a full pretend payment: a fake fan buys a fake pack,
   and we watch it land in a fake artist's account with your fee taken out.
4. Only when that works do we touch real mode.

**We will not test this on a real gig night.** Not once.

---

## 8 · If Thailand turns out to be a blocker

Then we do not force it. Real options, roughly best first:

1. **Each artist connects their own Stripe account, and MySet never touches the
   money.** You bill the $10/month subscription separately. You lose the 10% cut on
   the free tier, but this is by far the simplest and safest, and it sidesteps the
   whole problem. Honestly, this may be the better product anyway.
2. **A platform account in a supported country.** Real companies do this. It needs an
   accountant and probably a company — do not do it on a hunch.
3. **Stay one-artist for now** and revisit when Stripe expands. Thailand has been
   getting more Stripe features over time, not fewer.
4. **A different payment provider** for the artist-payout part.

I am not a lawyer or an accountant, and this section touches both. Get real advice
before choosing 2.

---

## What I need back from you

1. Your Stripe account's registered **country** (Settings → Business settings)
2. Whether **Connect** appears in your left-hand menu, and what **Connect → Accounts**
   shows
3. Stripe support's written answer to the three questions in section 2
4. Your call on **Decision A** and **Decision B**
5. A screenshot of Connect → Settings

And tell me whether to build the safety gate (section 6, item 5) now. That one does
not depend on any of the above.
