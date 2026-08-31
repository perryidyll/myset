# Verifying a venue

A venue page can be claimed by anyone with an email address. That is deliberate —
asking for proof before a page exists means no pages exist. What matters is that
the page is **honest about what we know**, and that there is a path to knowing
more.

Today every page is one of two things:

| State | What the page says | How you get there |
|---|---|---|
| Unverified listing | a grey `Unverified listing` chip, plus a line at the bottom offering the real owner a way to claim it | the default |
| Verified | a green `✓ Verified` chip | email-domain match, or Perry says so |

Nothing about the page is hidden while unverified. A bar that never verifies still
gets its listing, its shows and its QR code. The chip is the whole difference.

## What's built

**1. Email-domain match — instant, free, no integration.**
If the person who claimed the page signs in as `manager@uglyduckling.com` and the
page's website is `https://uglyduckling.com`, they are verified the moment they
tap the button in Settings. Free-mail domains (gmail, yahoo, icloud, proton…) are
rejected outright, so this can only ever be a real business domain.

Code: `domainMatches()` in `_venues.mjs`, action `checkDomain` in `venueauth.mjs`.

**2. Perry's own switch.**
Artist Studio → Settings → **Venues** (owner-only) lists every venue with a
Verify / Un-verify button. For the first hundred venues this is genuinely the
best tool available: 30 seconds on Google or Instagram settles it, and it costs
nothing to build or run.

Code: `venueList` / `venueVerify` in `admin.mjs`, gated by `isPlatformOwner`.

## What to build next, in the order I'd do it

**3. Artist vouching — the one that scales without Perry.**
A venue is verified once *N* artists who have gigs listed there confirm "yes, I
play here" from their own Studio. It uses the network MySet already has, costs
nothing, needs no third party, and is hard to fake without accomplices who each
have their own account and their own gig history. This is the right answer for
launch and it is a day's work: one blob doc of vouches, a prompt in the artist's
Gigs tab, a counter on the venue page ("confirmed by 3 artists who play here").

**4. Phone call-back.**
Send a code by SMS or voice to the number on the venue's *own website or Google
listing* — not one they type in. Whoever answers the bar's phone is staff. Strong
signal; needs Twilio and a per-message cost.

**5. Instagram / Facebook handshake.**
Ask them to put a six-character code in their bio or story for 24 hours. Works
for exactly the venues that have no website, which in a beach town is most of
them. Currently manual to check; automatable later.

## Google Business Profile — the honest answer

Perry asked whether we can just hook into Google My Business. It is the *right*
long-term answer and the wrong near-term one:

- It needs a Google Cloud project and an OAuth consent screen, and because
  Business Profile data is sensitive scope, the app has to go through Google's
  verification review before anyone outside a test list can use it. That review
  is weeks, and it wants a privacy policy, a demo video and a verified domain.
- The Business Profile API itself is **access-gated**: you fill in a form and
  wait for Google to approve your project. Approval is not guaranteed for a
  brand-new app with no users.
- And it only helps venues that already manage their Google listing and are
  signed in as the manager. Plenty of small bars are listed on Google by
  *someone else*.

So: not now. Revisit when MySet has enough venues that Google approval is
plausible and worth the paperwork — and note that (3) will already have solved
the problem by then for far less effort.
