# Verifying a venue

A venue page can be claimed by anyone with an email address. That is deliberate —
asking for proof before a page exists means no pages exist. What matters is that
the page is **honest about what we know**, and that there is a path to knowing
more.

Every page is one of two things:

| State | What the page says | How you get there |
|---|---|---|
| Unverified listing | a grey `Unverified listing` chip, plus a line at the bottom offering the real owner a way to claim it | the default |
| Verified | a green `✓ Verified` chip | any one of the three ways below |

Nothing about the page is hidden while unverified. A bar that never verifies still
gets its listing, its shows, its menu and its QR code. The chip is the whole
difference.

---

## Way 1 — the website · BUILT

**Two checks, and both must pass.** Either one alone is not proof.

1. **The sign-in email is on the website's own domain.** `manager@uglyduckling.com`
   against `https://uglyduckling.com`. Free-mail domains (gmail, yahoo, icloud,
   proton, …) are rejected outright, so this can only ever be a real business
   domain.
2. **The website itself names the venue.** We fetch the homepage and look for the
   venue's name in the page text — the full normalised name, or a distinctive
   two-word prefix, so a site that says "The Ugly Duckling" verifies "The Ugly
   Duckling Irish Pub". The town is checked and reported too, but not required:
   plenty of sites never write it down.

Why both: anyone can buy a domain and an email on it, and the website is just a
URL somebody typed into a form. Together they mean you control the inbox **and**
the site.

Code: `domainMatches()` in `_venues.mjs`; `checkWebsite()` / `tryVerifyByWebsite()`
in `_verify.mjs`; action `verifyCheck` in `venueadmin.mjs`. Saving a website runs
the check on its own; there is also a button.

### Fetching a stranger's website safely

This is the only place MySet makes an outbound request to a URL somebody typed
in, which makes it the only place that can be pointed somewhere it shouldn't be.
All of the following, in `fetchPage()`:

* **https only** — no http, no other scheme
* the hostname is **resolved**, and refused if *any* address it answers with is
  loopback, private (`10/8`, `172.16/12`, `192.168/16`), link-local (`169.254/16`
  — the cloud metadata endpoint), CGNAT (`100.64/10`), multicast or reserved; and
  `::1`, `fc00::/7`, `fe80::/10`, plus v4-mapped equivalents
* `.local`, `.internal`, `.localhost`, `.home.arpa` refused by name
* redirects followed **manually**, at most 3 hops, **each hop re-checked**
* 8-second timeout, 512 KB read cap, `text/html` only
* a literal private IP is also refused at *storage* time (`privateHost()` in
  `_venues.mjs`), so it never gets rendered as a link either

Verified against 13 targets including `169.254.169.254` — all refused.

---

## Way 2 — the artists who play there · BUILT

**Ten** different artists who have a gig at the venue **in their own MySet
calendar** confirm it, from a button on the venue's public page. At ten, the tick
goes on by itself.

This is the one that works for a bar with no website — which, in a beach town, is
most of them. It is hard to fake because each vouch needs its own account with its
own gig history, and an artist with no gig listed there simply **cannot** vouch
(`artistPlaysAt()` checks their calendar server-side). Nobody can vouch twice.

`MIN_VOUCHES = 10` in `_verify.mjs`. **Worth revisiting:** ten is a lot for a bar
that only hosts four or five acts. It is one constant, and the studio shows
progress ("4 of 10 confirmed") so a venue can see how close it is.

Code: `addVouch()` / `readVouches()` / `artistPlaysAt()` in `_verify.mjs`; action
`vouch` in `admin.mjs`; the button in `venue.html`.

---

## Way 3 — Perry's own switch · BUILT

Artist Studio → Settings → **Venues** (owner-only) lists every venue with a
Verify / Un-verify button. For the first hundred venues this is genuinely the best
tool available: 30 seconds on Google or Instagram settles it, and it costs nothing
to build or run.

Code: `venueList` / `venueVerify` in `admin.mjs`, gated by `isPlatformOwner`.

---

## What the venue is shown

Not a yes/no — a **checklist**, at the top of the Page tab, saying what is missing
on every line:

```
Unverified listing
  Your page works completely either way — this only changes a grey chip to a
  green tick. There are two ways to get it, and you only need one.

WAY 1 — YOUR WEBSITE
  [ ] Your website is on your page      Add it under "Getting hold of you"
  [ ] You're signed in with an email    You're bar@gmail.com — needs to be
      at that domain                    anything@uglyduckling.com
  [ ] Your website names your venue     We read the page and couldn't find
                                        "The Ugly Duckling" on it
  [ Check my website now ]

WAY 2 — THE ARTISTS WHO PLAY HERE
  4 of 10 confirmed                     Perry Idyll, Sam Cole, …
  [ Send artists your page ]
```

---

## Still to build

**Phone call-back.** Send a code by SMS or voice to the number on the venue's *own
website or Google listing* — not one they type in. Whoever answers the bar's phone
is staff. Strong signal; needs Twilio and a per-message cost.

**Instagram / Facebook handshake.** Ask them to put a six-character code in their
bio or story for 24 hours. Another route for a venue with no website. Manual to
check today; automatable later.

---

## Google Business Profile — the honest answer

Perry asked whether we can just hook into Google My Business. It is the *right*
long-term answer and the wrong near-term one:

- It needs a Google Cloud project and an OAuth consent screen, and because
  Business Profile is sensitive scope, the app has to pass Google's verification
  review before anyone outside a test list can use it. That review takes weeks and
  wants a privacy policy, a demo video and a verified domain.
- The Business Profile API is *separately* **access-gated**: you fill in a form and
  wait for Google to approve your project. Approval is not guaranteed for a
  brand-new app with no users.
- And it only helps venues that already manage their own Google listing and are
  signed in as the manager. Plenty of small bars are listed on Google by *someone
  else*.

So: not now. Revisit when MySet has enough venues that Google approval is
plausible and worth the paperwork — and note that Ways 1 and 2 will already have
solved the problem for far less effort.
