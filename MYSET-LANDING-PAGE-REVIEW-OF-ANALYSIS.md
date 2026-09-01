# Review of Atlas's MySet landing-page analyses

**Reviewing:** `MYSET-LANDING-PAGE-DEEP-ANALYSIS.md` and `MYSET-LANDING-PAGE-ESSENTIALS.md` (ChatGPT/Atlas, 2026-09-01)
**Method:** every checkable claim adjudicated against `public/about.html`, `public/app.css`, `public/studio.html`, the Netlify functions, `MYSET.md`, `INVARIANTS.md` and `HANDOFF-MySet.md`; page geometry, contrast and behaviour re-measured in real headless Chrome (not the browser pane, which suspends rAF and CSS transitions while hidden).
**Scale:** 137 discrete claims adjudicated, each with a skeptic pass that tried to refute the verdict. The skeptic overturned 29 verdicts — mostly *in Atlas's favour*.

The live `/about` is byte-identical to the local file (44,848 bytes), so local source is authoritative.

---

## Headline

**Atlas is an excellent page critic and an unreliable growth adviser, and the difference is caused by one fact: it read two files.** Its own methodology section says so — `public/about.html` and `public/app.css`. It never saw the codebase, `MYSET.md`, or the handoff. So it does not know that MySet has one artist, one gig, no billing, no Stripe Connect, and traffic the handoff calls "a rounding error."

Within that blindfold, its craft is genuinely good and its measurements are near-perfect. Outside it, roughly a third of the deliverable is the operating manual for a company with a growth team.

**Score: 122 CONFIRMED · 8 OVERSTATED · 5 WRONG · 2 not gradeable as fact.**

---

## Where Atlas is exactly right

Re-measured independently:

| Atlas claim | Measured | Verdict |
|---|---|---|
| ~1,766 words of body copy | **1,766** | exact |
| mobile ~18,344px | **18,354px** @375×812 | 10px out |
| desktop ~11,860px | **11,868px** @1440×900 | 8px out |
| demo buttons 38px, all named "Vote" | **76×38, all four "Vote"** | exact |
| nav link 36px / footer links 16px | **36.3px / 16px** | exact |
| `--faint` 3.79:1 dark, 2.36:1 light | **3.790 / 2.362** | exact |
| robots.txt & sitemap.xml return HTML | **both 200 `text/html`, 26,958 B = artist.html** | confirmed live |
| no canonical, no structured data, no analytics | **confirmed in source** | — |
| no CTAs inside the plan cards | **confirmed** | — |
| Pro's unshipped features are not visibly marked | **confirmed: all six are plain `<li>`; the only `li.no` on the page is Free's 10% line** | — |

Its three best diagnoses, all correct and all cheap to act on:

1. **The `/studio` handoff.** Six buttons promising "Get your page — free" land on `Artist Studio` / "Sign in to run your show." (`studio.html:763,777`). The repair line at `:781` only fixes confusion the page just manufactured, at the moment intent peaks. Atlas earned this by following the click — a pure on-page review would never have found it.
2. **Promise integrity.** From the page alone, with no code access, it worked out that the Pro card reads as shipped, that "the Pro extras marked above" is false because nothing is marked, and that payments are sold ~4,000 words before the gate is disclosed. All confirmed.
3. **"A headline that produces more curious signups but fewer first shows is worse."** The single most strategically correct sentence in the document, and the right north star for a product whose unit of value is a gig that actually ran.

---

## Where Atlas is wrong

### 1. The proof block is a data-integrity problem, and Atlas's fix makes it worse

This is the most important finding in this review.

`about.html:454-460` reads *"Every gig you play is counted. Not 'it was packed, honestly' — actual numbers, from the actual room, that you didn't type in yourself,"* above **34 people on average · 314 votes across three nights · 12 songs wanted and not played · 100% from the room**.

MySet has run **one** gig: 8 voters, 21 votes, The Ugly Duckling, 2026-08-30 (`MYSET.md:44`, `MYSET.md:785`). `HANDOFF-MySet.md:364`: *"History holds exactly one real show."*

Three things Atlas missed:

- **The page contradicts itself.** FAQ 2 (`about.html:636`) says *"eight people voted twenty-one times."* Both claims are on the same page, four sections apart.
- **The page's own screenshots contain both numbers.** `about/numbers.png` is a seeded venue ("The Lantern", artist "Sam Cole", "1 act · since 31 August", "34 avg/night") — and `HANDOFF-MySet.md:938-940` records how it was made: *"Against a throwaway artist and venue, both deleted afterwards."* So the numbers under the sentence swearing they weren't typed in were typed in, by the session that wrote the sentence. Meanwhile `about/profile.jpg` — one section earlier — is Perry's **real** page showing "1 Shows · 8 Audience · 21 Votes cast."
- **Atlas's prescription is to make it specific.** It proposes *"314 verified audience votes across three gigs,"* with artist, venue, period and methodology, moved above the fold. That converts a vague exaggeration into a named, sourced, falsifiable fifteen-fold overstatement — on a page whose entire competitive claim is that its numbers are real. And it is Atlas's flagship recommendation: *"If only one thing changes."*

**The correct first move is subtraction, not attribution.** Delete or relabel the four numbers. Then use 8 people and 21 votes honestly. Small and true beats big and invented, especially here.

### 2. Two of the nine screenshots are the wrong images — and Atlas listed this as a *strength*

Atlas praises "meaningful alt text on nine product images." The alts are meaningful. Two of them describe images that do not exist:

- **`about/qr.png`** — alt: *"A printable QR code captioned Scan to choose the next song."* The file is the Artist Studio **Settings tab**: "Free votes per person", "Cost to replay a played song", "Price of extra votes". No QR code anywhere. It is the sole illustration for beat 1, *"They scan, and they're in — Print it once."* The page's biggest selling point is illustrated by a pricing panel.
- **`about/feed.jpg`** — alt: *"The MySet homepage: what's on this week in Koh Phangan, with directions."* The file is the homepage **empty state**: "Choose your country / Start typing", "Pick a country first", a greyed-out Search button, zero listings. Its caption on the page reads *"And how a local finds you on a quiet Tuesday."* It shows a local finding nothing.

Atlas read the alt attributes and never opened the images. This is the best catch of the exercise and neither document contains it.

### 3. Its corrective availability matrix is wrong in both directions

Atlas proposes: `Pro press kit, multi-city, branding, band logins | Coming soon`.

- **Band logins ship.** `_plan.mjs:39` `seats: 5`, enforced at `auth.mjs:102-105`.
- **"Earnings by venue, night and song" does not**, and Atlas omits it. `_plan.mjs:24` `analytics: false, // earnings by venue / night / song` — read only by `admin.mjs:137` and a display string.

Correct split — **shipped:** "Everything in Plus", "Five sign-ins for your band". **Unshipped:** earnings analytics, press kit, branding, multi-city. Pasting Atlas's matrix would introduce a new inaccuracy into the block meant to fix inaccuracy.

### 4. "Start free, upgrade anytime" would be a new false promise

Atlas recommends adding it to Plus and Pro "if checkout is not part of first activation." There is no checkout at all. `MYSET.md:761`: *"Plans exist and are enforced; there is no billing to charge them."* `studio.html:1459` literally renders *"% off saved for when billing opens."*

Deeper: `MYSET.md:760` — *"Until [Connect] exists, a second artist's money lands in Perry's account and **the 10% cut does not exist**."* So Free's only stated cost is fictional and Plus's headline benefit is worth $0 to anyone who isn't Perry. Strip both honestly and Plus's entire case is "unlimited songs live at once", which the page never surfaces as a benefit.

The executable lever Atlas missed: `redeemPromo` (`_plan.mjs:96-117`) **works today** — a 100% code comps a plan outright, anything less banks a discount. An "ask for a code" CTA converts intent, starts a founder conversation, and seeds the ledger for when billing opens.

### 5. Smaller factual errors

- **"No real human faces on the sales page"** — false. `about/profile.jpg` contains a band photo and a portrait of Perry, both fully visible at render size. The point it was reaching for (faces are small, bezelled, not used as proof) is fair; the claim as written is not.
- **"6.6/10"** — the fifteen row scores sum to 98; 98/15 = **6.53**. Trivial, but it is an unsupported stated number in a document whose central complaint is unsupported stated numbers.
- **Venue section has three screenshots, not two** (`numbers.png`, `feed.jpg`, `fills.png`). The undercount understates Atlas's own argument: the venue block is 4,190px — **23% of the mobile page**, the largest single section on it.
- **The essentials doc silently drops a P0.** Deep-doc P0 #6 (privacy, terms, contact before collecting more emails) appears nowhere in the essentials. Grep for privacy/terms/contact/contrast/robots/sitemap/canonical returns zero matches. Every P2 is dropped too. Cutting polish is fine; dropping the item with legal weight without saying so makes the essentials unsafe as a standalone worklist.
- **My own correction:** in my first pass I said `--muted` fails contrast on the page background at 4.42:1. Recomputed three ways, it is **4.66:1 and passes**. Only `--muted` on `--bg-2` (4.27:1) fails — the proof block's stat labels and the demo's rank circles. The `--faint` failures Atlas found are real and worse (2.16–2.57:1).

### 6. The reveal-animation claim was a tooling artifact — but there's a real bug underneath

Atlas says sections "appear very dim" and full-page captures show "large black areas." After a full scroll in real Chrome, **0 of 20 reveal elements** remain hidden. That specific claim describes Atlas's own screenshotter.

But probing it surfaced two genuine defects Atlas never reached:

- **The page prints blank.** `.anim .up{opacity:0}` is only cleared by the IntersectionObserver on scroll, and there is no `@media print` block anywhere. Under print media, **20 of 20** blocks sit at opacity 0. A venue owner who hits Cmd+P gets the nav, the hero, one screenshot, and eight pages of white. Two-line fix.
- **One JS exception hides the whole page permanently.** The head script sets `.anim` (arming `opacity:0`) synchronously at `about.html:30`; the code that removes it sits ~50 lines lower in the same block, behind the demo. Injecting a single TypeError into the first `addEventListener` leaves 20/20 blocks invisible forever, however far you scroll, with all four stats reading "0". The source comment at `:236-239` claims the page "is simply VISIBLE" if the script never runs — true only for JS *fully* disabled, false for partial failure, which is the common mode.

---

## What both documents missed entirely

### `/about` is an orphan page

`grep -rn "/about" public/` returns **zero** matches outside `about.html` itself. Not `index.html`, not `vote.html`, not `artist.html`, not `venue.html`, not `studio.html`, not any manifest.

Every acquisition surface routes past it to a sign-in gate: `index.html:205-206, 262-263, 362-363`, `venue.html:388, 405`, `vote.html:352` — all to `/studio` or `/venues`. With robots.txt and sitemap.xml both serving `artist.html` and no canonical, search engines have no map to it either.

**Atlas wrote 1,625 lines optimising a page that receives no traffic.** Its P0 ("instrument the funnel") and all eight experiments presuppose a flow that does not exist.

*(Partly fixed this session — see below.)*

### The referral loop is severed at the front door

`qr.mjs:22` defines `invite: (slug) => 'https://myset.vip/signup?ref=' + slug`, surfaced to every artist in Studio under "Invite another musician" (`studio.html:1528-1533`). `netlify.toml:23-25` rewrites `/signup` → `studio.html`. So the highest-intent visitor MySet can produce — a musician personally recommended by another musician — arrives at "Sign in to run your show" and an email field. Zero words of pitch. `rewardReferrer` (`_plan.mjs:118-146`) even pays the referrer a free month, so the loop is wired end-to-end in the backend and cut at the front. Pointing `invite` at `/about?ref=` is the cheapest fix on this list.

### The page is written for the wrong reader

`vote.html:352` — *"Play live yourself? Get your own page →"* — sits on the phone of every person in the room during a gig, at peak product experience. That is the only surface touching musicians at volume. That reader has just voted and watched the queue move. `/about` then spends its first **974 words** re-teaching them that audiences vote from phones, plus a demo of the action they performed ninety seconds ago. What they need — what do I do at my gig Friday, what does it cost — starts at line 336; the price is at line 566.

### The recommended first action breaches the Free tier silently

`STARTER_SONGS` has **62** entries; Free allows **50** featured. `admin.mjs:1067-1078` adds songs 51–62 switched off, with no toast and no explanation. The FAQ sells that tap (`:658`) 74 lines after the Free card promises "50 songs live to the room at once" (`:584`). Two failures: a new artist's first action quietly does less than promised, and MySet discards the one upgrade trigger on the pricing block that is honest, automatic and functional today.

### "Tip Perry" is hard-coded for every artist

`about.html:387` promises *"a tip button with your name on it."* The button label uses the artist's name (`vote.html:379`), but the sheet does not: `vote.html:536` renders `<h3>Tip Perry</h3>` / "100% goes to Perry" for **every** artist, and the payments-off fallbacks at `:518` and `:534` say "grab Perry between songs." The page's own screenshot proves it: `about/buy.png` is a Sam Cole page whose tip sheet says "Tip Perry." A shipped multi-tenancy leak, not a copy error.

### "Switched on artist by artist… ask and you'll be next in the queue" describes a mechanism that doesn't exist

`_pay.mjs:26-27`: `canTakeMoney = (aid) => !!STRIPE_SECRET_KEY && isPlatformOwner(aid)`. There is no per-artist switch and no queue — enabling a second artist is a code change, and INVARIANT 0r forbids it before Connect. The honest note is the least accurate sentence in the block: it converts a hard architectural block into a waiting list.

### Accessibility Atlas didn't reach

- **Keyboard focus is destroyed on every demo vote.** `draw()` rebuilds `#dlist` via `innerHTML`, then again 380ms later. Measured: focus a Vote button, press Enter → `document.activeElement` is `<body>`, still `<body>` after 600ms. Next Space scrolls the page instead of voting; next Tab re-enters at row 1 while the rows have reordered underneath.
- **Zero `aria-live`, `role=status`, `role=alert` or `aria-pressed`** on the page. A VoiceOver user votes and hears nothing — not the count, not the reorder, not the relabel to "Voted".
- **The out-of-votes button is pixel-identical to an enabled one.** `disabled` is set, but there is no `.vb:disabled` rule; `app.css:96` scopes disabled styling to `.btn`, and `app.css:62` forces `cursor:pointer` on all buttons. Measured either side of the threshold: colour, background, shadow, opacity and cursor all identical. The demo's terminal state reads as a broken button.
- **The stats ship as literal `0`.** `<b data-to="34">0</b>`; real values exist only in `count()`. With JS off the proof block reads *"0 people in the room, on average / 0 votes cast across three nights…"* under "Stop telling venues you draw a crowd." The author applied a static fallback to `#dlist` and not to this.
- **The accessibility tree has two landmarks**, and the one called `banner` is the marketing hero, not the site header. No `<main>`, no `<footer>` element, 9/9 `<section>`s unnamed. This is why the missing skip link matters more than Atlas thought — the usual fallback is the landmark rotor, and the rotor is empty.
- **`#try` lands behind the sticky nav.** `scroll-padding-top: auto`, `scroll-margin-top: 0`, 67px sticky nav. Clicking "See how it feels" puts the section's own "Try it — right here" label at y=57 — underneath the nav, at every viewport.
- **Reduced motion is half-handled.** CSS is gated; the 1,100ms `count()` rAF and `navigator.vibrate(14)` are not.
- **`og:image` is a 640×1385 portrait** used with `summary_large_image`. Twitter/Facebook/iMessage crop to ~1.91:1, reducing the phone screenshot to a thin horizontal slice. No `og:url`, `og:type`, `og:site_name` or `og:image:alt` either.

---

## On the recommendations

Two independent reviewers (growth, copy) judged Atlas's advice against MySet's actual state. Combined: **15 adopt, 19 adopt-with-changes, 14 reject, 2 defer.**

**Reject the entire experiment roadmap (Tests 1–7).** Test 5 alone — first-audience-vote per visitor, realistically under 1%, detecting 0.5%→0.75% at 80% power — needs ~32,000 visitors. Measured traffic is "a rounding error" (`HANDOFF-MySet.md:465`, 47 Netlify credits in a month). There is no analytics and no A/B infrastructure. Tests 1–3 are defect repairs dressed as hypotheses: you do not split-test whether to stop being wrong. Test 6 changes nine things at once.

**Reject the 15-question scorecard funnel.** A qualification machine for a high-ticket sales-assisted offer, proposed for a free self-serve tool with a $10/mo ceiling. Atlas's own segmented CTAs give it away — "Book a 15-minute guided setup" needs a human, and Perry is one person who also plays the gigs. Atlas got the important half right ("don't put it in front of free signup") and then talked itself into building it anyway.

**Defer the compression/IA rewrite.** The observation is fair. Rewriting a page that reads well, to a structure derived from theory, with no traffic to validate it, is premature. Note the priority inversion: Atlas wants the 993px scene ("best prose on the page", its own words) cut in half while the 4,190px venue block stays.

**On the copy specifically:** harvest the diagnoses, discard about two-thirds of the prose. Atlas's own Part VII warns against generic SaaS language; its Part XI blueprint then writes "one shared decision", "behavioral proof", "future-gig signals", "your first measured gig". The page runs on contractions ("It's fine. It's always fine."); the blueprint has almost none ("It is not another screen."). Concrete examples it would delete: *"You look down, you see what forty people want, you play it"* → *"The strongest signal is already ranked"*; *"Two lads at the bar arguing about Fleetwood Mac"* → *"a live queue everyone can influence."* It is also internally inconsistent — Part VII says keep "Your next gig could be the first one they choose," §12 replaces it, Part XI replaces it again, differently.

---

## What to actually do, in order

1. **Fix the two wrong screenshots** (`qr.png`, `feed.jpg`) or pull them. Currently the QR promise is illustrated by a pricing panel and the discovery promise by an empty search box.
2. **Remove or relabel the four proof numbers.** They are contradicted by the same page's FAQ and by the product's real history. Replace with 8 people / 21 votes / one night, told honestly.
3. **Fix promise integrity:** mark the four unshipped Pro bullets, correct the payments note from "queue" to the truth, and stop selling a 10% cut that does not exist.
4. **Connect the page.** *(Started — see below.)* Point the referral `invite` link at `/about?ref=`; add `/about` to the nav on `studio.html` and `venue-studio.html`; serve a real `robots.txt` and `sitemap.xml` outside the catch-all.
5. **Fix the `/studio` handoff** — "Create or open your artist page" + "Continue with email". Atlas's wording is good here.
6. **Add the artist-control line near the hero.** The reassurance exists but sits at 96% page depth inside a collapsed `<details>`.
7. **Two-line print fix, demo focus/aria fix, `.vb:disabled` style, static stat fallback, `scroll-margin-top` on `#try`, a landscape `og:image`.**
8. **Privacy, terms, contact** before more email collection. The P0 the essentials dropped.
9. **Only then** consider length, structure and measurement — and measure activated artists, not clicks, exactly as Atlas says.

---

## Changes already made this session

`public/index.html`:

- **`/about` is no longer orphaned.** A footer link, *"How MySet works"*, on every homepage view; plus *"Not sure yet? See how MySet works →"* beneath the artist/venue CTAs in both empty states.
- **A persistent "Add to home screen" button** in the footer. The homepage already had a good install feature — a dismissible card, native `beforeinstallprompt` on Android, and an iPhone/Android tabbed instruction sheet — but once dismissed it was gone forever. The footer button is the way back; it is hidden only when already installed. The sheet now also offers a native "Install MySet" button when the browser provides one, and an `appinstalled` listener clears the affordances afterwards.

Verified in real headless Chrome at 320/390/1280, light and dark: no horizontal overflow, 44px touch targets, sheet opens and both OS tabs render correct steps, Escape closes, no console errors. New link colours are `--muted` (4.66:1) and `--accent-ink` (4.91:1) rather than the `--faint` token that fails across the site.
