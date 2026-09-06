# MySet — Landing Page Discrepancies

219 alleged · 150 killed by an adversarial skeptic · **69 upheld**.

| # | Sev | Where | Line | Status | The claim |
|---|---|---|---|---|---|
| 1 | critical | Pricing & honest notes | 593 | FALSE as written — the finding survives, but  | none of it ever costs the room a penny |
| 2 | critical | Pricing & honest notes | 601 | MISLEADING — moderate. Not FALSE/critical. Le | About a gig a week, run properly, and you never pay us anything. |
| 3 | critical | Pricing & honest notes | 606 | FALSE — confirmed, and the problem is wider t | Setlists, chord charts, keys and genres |
| 4 | critical | Pricing & honest notes | 657 | FALSE — confirmed, severity high (not quite " | Everything that doesn't involve a card works the moment you sign up. |
| 5 | critical | Pricing & honest notes | 658 | FALSE — confirmed, severity critical, and the | Plus and Pro can't be bought yet. |
| 6 | critical | Pricing & honest notes | 658 | FALSE — confirmed, and slightly narrower in s | There's no checkout |
| 7 | major | index.html (what’s-on home) | 307 | CONFIRMED but re-graded: not "FALSE / major"  | No gigs listed yet |
| 8 | major | index.html (what’s-on home) | 358 | FALSE — severity major (upgrade: the same def | <span>${x.n} gig${x.n===1?'':'s'}</span> |
| 9 | major | index.html (what’s-on home) | 408 | SURVIVES on mechanism, but the label is wrong | ${d.artists} artist${…} play${…} here — nothing in the next seven days. |
| 10 | major | index.html (what’s-on home) | 409 | CONFIRMED — status FALSE stands, severity mod | No one has listed a gig here yet. |
| 11 | major | index.html (what’s-on home) | 485 | UPHELD, but reclassified: not FALSE — UNDISCL | Featured shows |
| 12 | major | index.html (what’s-on home) | 490 | OVERSTATED, severity minor (down from major;  | That’s everything in ${city} for the next seven days. |
| 13 | major | Head, nav & hero | 302 | STALE — confirmed, but on one pillar not thre | <img src="/about/vote.png" width="640" height="1385" fetchpriority="high" …> |
| 14 | major | Head, nav & hero | 302 | STALE — minor (not "FALSE / major"). A real d | [the screenshot shows] "More votes — From $3" |
| 15 | major | Head, nav & hero | 302 | FALSE — major. Upheld, and wider than the acc | [the screenshot itself, as rendered] every card runs past the right edge of the frame; no vote counts and no ' |
| 16 | major | Head, nav & hero | 303 | FALSE — confirmed, but severity MINOR, not ma | alt="The voting page: Hey Jude playing now, and Wish You Were Here winning the vote with 7" |
| 17 | major | Scene & demo | 333 | OVERSTATED — confirmed, severity moderate (no | This is the real thing, running on this page. |
| 18 | major | Scene & demo | 334 | STALE, severity minor (downgraded from major) | That's exactly what forty people do at once. |
| 19 | major | Scene & demo | 337 | STALE — confirmed, but severity minor-to-mode | 3 votes left |
| 20 | major | Scene & demo | 740 | STALE — confirmed, but severity minor, not ma | let rows = SEED.map((s) => ({ ...s })), mine = new Set(), left = 3, bump = null; |
| 21 | major | Scene & demo | 752 | STALE, major | ${mine.has(s.id) ? 'Voted' : 'Vote'} |
| 22 | major | The night 1-2 | 365 | FALSE, severity MODERATE (downgraded from maj | None of them need you. |
| 23 | major | The night 1-2 | 366 | MISLEADING, severity minor (not FALSE/major) | Everything below runs itself while you're on stage. |
| 24 | major | The night 3-5 | 398 | IMPRECISE — severity minor-to-moderate, not O | never money |
| 25 | major | The night 3-5 | 415 | STALE — confirmed, severity major, and the sc | One caveat, up front: card payments are the part still being built. |
| 26 | major | The night 3-5 | 415 | STALE — severity major, and wider than the ac | [the caveat is set at font-size:15px in var(--muted), four lines below an unqualified claim] |
| 27 | major | The night 3-5 | 416 | STALE — severity major, and wider than the ac | They run on the founder's own gigs today |
| 28 | major | The night 3-5 | 417 | STALE — confirmed, severity major, and the fi | switch on for everyone once the payouts plumbing is finished |
| 29 | major | The night 3-5 | 417 | WRONG — not merely stale. Severity major, and | the note under the plans says exactly where that stands |
| 30 | major | What changes & proof | 470 | IMPRECISE (minor) — not FALSE/major. True for | Why: every night is recorded |
| 31 | major | For venues | 518 | OVERSTATED — confirmed, severity major (and s | Any gig at your place shows up on your page by itself |
| 32 | major | For venues | 528 | PARTLY OVERSTATED — severity minor. "Your bar | Your bar is in it |
| 33 | major | For venues | 529 | MISLEADING (partly true) — severity minor-to- | one tap away |
| 34 | major | For venues | 570 | OVERSTATED — severity minor (downgraded from  | So the moment your page exists, every gig any artist has already listed at your place is on it. |
| 35 | major | Pricing & honest notes | 590 | OVERSTATED — confirmed, and worse than the ac | What it costs |
| 36 | major | Pricing & honest notes | 591 | WRONG, but MINOR (headline over-reach only) — | Everything the room sees is free. Always. |
| 37 | major | Pricing & honest notes | 630 | OVERSTATED — confirmed, and WIDER than the ac | tips, vote sales and merch stay yours |
| 38 | major | Pricing & honest notes | 651 | OVERSTATED — confirmed, but for two of the fo | Three honest notes, because a page like this ought to say where the edges are. |
| 39 | major | Pricing & honest notes | 655 | STALE — major, upheld and WIDER than the accu | while the payouts plumbing gets built |
| 40 | major | FAQ, close, footer | 693 | CONFIRMED — FALSE as stated, severity major.  | Can people see my whole setlist? Is that a problem? [entire answer, 693-698, carries no plan caveat] |
| 41 | major | FAQ, close, footer | 695 | FALSE — severity major (upgrade: the same fal | For one night only, build a setlist instead — name it, put the songs you want in it |
| 42 | major | Demo script | 752 | FALSE — confirmed, but severity should be mod | ${!mine.has(s.id) && left <= 0 ? 'disabled' : ''} |
| 43 | major | Demo script | 768 | CONFIRMED FALSE — the page's demo contradicts | if (mine.has(id)) { mine.delete(id); row.n--; left++; } |
| 44 | minor | index.html (what’s-on home) | 41 | CONFIRMED OVERCLAIM (minor) — not ambiguous.  | Sits ON TOP of a page that has already rendered, so it can never delay anything. |
| 45 | minor | index.html (what’s-on home) | 481 | FALSE — confirmed, but conditional: the heade | <span>${day.count} gig${day.count===1?'':'s'}</span> |
| 46 | minor | index.html (what’s-on home) | 597 | FALSE — confirmed, and wider than reported. T | It has to be Safari on an iPhone — Chrome on iOS can’t add to the home screen. |
| 47 | minor | Head, nav & hero | 24 | CONFIRMED - OVERSTATED, severity minor on /ab | <meta name="twitter:card" content="summary_large_image" /> |
| 48 | minor | Head, nav & hero | 268 | OVERSTATED — but in the opposite direction fr | @media (prefers-reduced-motion:reduce){ .anim .up{…} *{animation-duration:.01ms!important} } |
| 49 | minor | Head, nav & hero | 305 | Caption copy: SUPPORTED, leave the words alon | What the room sees. |
| 50 | minor | Scene & demo | 332 | PARTIALLY REFUTED — the line cited (about.htm | Tap a song. |
| 51 | minor | Scene & demo | 745 | FALSE — confirmed, severity minor (borderline | const sorted = [...rows].sort((x, y) => y.n - x.n \|\| x.t.localeCompare(y.t)); |
| 52 | minor | The night 1-2 | 389 | STALE, severity minor (upheld, and marginally | [the studio.png screenshot placed beside beat 2's copy] |
| 53 | minor | The night 3-5 | 429 | OVERSTATED, minor — confirmed, and slightly w | and every gig you've got coming |
| 54 | minor | The night 3-5 | 433 | STALE — confirmed, and one change wider than  | <img src="/about/profile.jpg" width="780" height="1500" loading="lazy"> |
| 55 | minor | What changes & proof | 442 | STALE — confirmed, and slightly wider than st | [no screenshot in 442-504] |
| 56 | minor | Pricing & honest notes | 594 | OVERSTATED (confirmed, minor) — but on three  | What you pay for is your own back office. |
| 57 | minor | Pricing & honest notes | 602 | CONFIRMED — status OVERSTATED, severity minor | [the Free card's <ul> lists nine items and no sign-in/seat limit] |
| 58 | minor | Pricing & honest notes | 603 | CONFIRMED as a copy inconsistency, not a fals | up to 200 people in the room at each |
| 59 | minor | FAQ, close, footer | 667 | SURVIVES — and understated. The kicker at abo | Straight answers |
| 60 | minor | FAQ, close, footer | 697 | FALSE (not AMBIGUOUS), severity moderate — up | You can keep twenty of them |
| 61 | minor | Demo script | 740 | FALSE — confirmed, severity minor (cosmetic-f | let rows = SEED.map((s) => ({ ...s })), mine = new Set(), left = 3, bump = null; |
| 62 | minor | Demo script | 740 | FALSE — confirmed, severity raised from minor | mine = new Set() |
| 63 | minor | Demo script | 752 | NOT FALSE — the page states nothing untrue an | disabled |
| 64 | minor | Demo script | 760 | CONFIRMED — ambiguous wording, minor severity | — whenever the next request is taken. |
| 65 | minor | Demo script | 763 | CONFIRMED — and UPGRADE from minor to moderat | document.getElementById('dlist').addEventListener('click', ...)  [the entire handler, 763-774] |
| 66 | minor | Demo script | 794 | CONFIRMED — status OVERSTATED is the right ve | function count(el) { const to = Number(el.dataset.to) \|\| 0 ... el.textContent = Math.round(to * eased) + suf |
| 67 | minor | Demo script | 794 | OVERSTATED — confirmed, and wider in scope th | [the count() rAF loop, 794-804] |
| 68 | cosmetic | Head, nav & hero | 25 | CONFIRMED as re-scoped — about.html needs no  | <link rel="icon" href="data:image/svg+xml,…three rounded bars on a #FF375F→#FF6B45 gradient…" /> |
| 69 | cosmetic | FAQ, close, footer | 702 | CONFIRMED but trivial — a literal-precision n | you can add in one tap |

---

## 1. [CRITICAL] Pricing & honest notes · line 593

> none of it ever costs the room a penny

**Verdict:** FALSE as written — the finding survives, but at severity MAJOR, not critical, and half the accuser's evidence should be thrown out and replaced with a stronger path they missed.

**Evidence.** public/about.html:592-593 (the sentence) · public/about.html:758 (the page's OWN demo already tells the reader "in the room you could buy a few more") · public/about.html:627 ("Price your own vote packs") · netlify/functions/admin.mjs:1832-1835 (`Math.max(0, Math.min(999, ...))` — freeCredits CAN be set to 0) · public/studio.html:3026-3028 (`saveFreeCredits` rejects only n<0, so 0 saves) · netlify/functions/vote.mjs:119-121 (`total = show.freeCredits + (me.extra||0)`; over total → 402 no-credits) · netlify/functions/_requests.mjs:93-99 (same gate on song requests/shout-outs) · netlify/functions/pay.mjs:195-215 (`application_fee_amount` comes out of the artist's take, nothing is added to the fan's price)

**Skeptic (high).** I read the files. The finding survives, but not for the reasons given.

WHAT SURVIVES. The word "ever" is an absolute and the code breaks it. Two ways:
(1) Ordinary path — a fan who spends their free credits (default 5, _lib.mjs:390) hits 402 no-credits (vote.mjs:119-121) and the only in-app way past it is the pack sheet at vote.html:919-931 → pay.mjs → a real USD Stripe Checkout. Voting past your allowance costs money.
(2) The path the accuser MISSED, and it is worse than what they found. `freeCredits` is artist-settable and clamps to a floor of ZERO (admin.mjs:1833). The Studio's custom field only rejects n<0 (studio.html:3027), so 0 saves cleanly. At 0 free credits with unlimited off, vote.mjs:120-121 rejects every single vote and _requests.mjs:94-96 rejects every request and shout-out. Taking part at all then requires buying a pack. That is a live, code-level configuration in which participation literally costs money — a far sharper refutation of "none of it EVER costs the room a penny" than "an optional upsell exists." (Gated to Plus/Pro by canPrice at admin.mjs:1707/1831 — a free-plan artist stays at 5 — but Plus/Pro is most of the paying base.)

WHAT I THROW OUT OF THE ACCUSATION.
- The tip sheet (vote.html:933-940) is not evidence. A voluntary tip is not a cost of taking part, and the page never claims tips don't exist — it brags about them at about.html:489 ("100% of it from the room"). Citing tips inflates the finding and would get the whole thing dismissed by anyone who checks.
- "Critical" is too high. Critical implies concealment. The page discloses the pack economy TWICE in its own body: the interactive demo at :758 literally reads "Out of votes — in the room you could buy a few more," and the Plus plan sells "Price your own vote packs" at :627. A reader is not deceived about the existence of paid votes. This is a sentence that overreaches past what the rest of its own page says — a self-contradiction and an overclaim, which is major, not critical.
- The accuser's framing "the same section contradicts itself eleven lines later" is correct but it is a symptom, not the defect. The defect is the single word "ever."

WHAT DEFENDS THE PAGE, and how far it goes. The sentence is more carefully scoped than a hostile read allows: its subject is a feature list ("The voting, the lyrics, the requests, your page, your gig listings"), the heading is "Everything the room sees is free. Always.", and the closer is "What you pay for is your own back office." Read as "no feature is paywalled away from the audience and MySet never bills the audience," it is TRUE — pay.mjs:195-215 puts the platform cut in `application_fee_amount`, deducted from the artist, with nothing added on top of what the fan sees. That defense carries the heading and it carries the last sentence. It does not carry "none of it ever costs the room a penny," because "the voting" is item one in that list and the voting demonstrably can cost money. One word too strong, in a section that is otherwise honest.

The accuser was also right to pre-empt the replay-cost red herring: _lib.mjs:712-713 `costOf` charges 5 VOTES, not cents, so about.html:626 is clean.

**Fix.** Replace with: "Not free-for-now. The voting, the lyrics, the requests, your page, your gig listings — all of it, on every plan, and we never charge the room a penny for any of it. What you pay for is your own back office."

That is provable in code (pay.mjs:195-215: the platform fee is taken out of the artist's cut, never added to the fan's price) and it stops fighting the page's own demo line at :758 and the "Price your own vote packs" bullet at :627.

Do NOT use the accuser's proposed "and nobody ever has to pay to take part." That is also false: a Plus/Pro artist can set free votes to 0 (admin.mjs:1832-1835, studio.html:3026-3028), after which every vote and every request 402s until a pack is bought (vote.mjs:119-121, _requests.mjs:93-99). It swaps one absolute the code can break for another.

If Perry wants the participation promise, make it the true one the page already says twice (:354, :761): "everyone in the room gets free votes, and every new song hands them back."

## 2. [CRITICAL] Pricing & honest notes · line 601

> About a gig a week, run properly, and you never pay us anything.

**Verdict:** MISLEADING — moderate. Not FALSE/critical. Leg (a) is real but soft; leg (b)'s 10% half is refuted; leg (b)'s $10 half is real and is WIDER than stated; and while checking it I found a strictly worse false statement 57 lines below.

**Evidence.** public/about.html:601 (the sentence), :603 ("4 shows a month" bullet), :611 (the 10% line), :653-657 (honest note 2), :658-660 (honest note 3 — the worse finding); netlify/functions/_plan.mjs:33 `gigs: 4`; netlify/functions/_lib.mjs:131 `gigMonthOf`; netlify/functions/_lifecycle.mjs:133-134 (the 402 refusal), :36-37 (CAP_REFUSAL); netlify/functions/_pay.mjs:33-38 `connectReady` (false for every non-founder); netlify/functions/_featured.mjs:40 `FEAT_PRICE = 1000`; netlify/functions/_flags.mjs:46-47 (featuredShows default true); netlify/functions/admin.mjs:1452-1497 (featureStart — no plan gate, no Connect gate); public/studio.html:1366 (shipped "Promote a gig" button); netlify/functions/_billing.mjs:120-157 `startCheckout` mode 'subscription'; netlify/functions/admin.mjs:78-84 `planCheckout`; public/studio.html:3565, 3579-3583 (unconditional "Upgrade to Plus/Pro" button)

**Skeptic (high).** I checked all three mechanisms in code rather than in comments — worth noting that the header comment at _plan.mjs:6-9 still says "unlimited shows… a free artist can run six nights a week forever", which is stale; the accuser correctly ignored it and read the constant.

LEG (a) — CONFIRMED as a mechanism, OVERSTATED as a finding. _plan.mjs:33 is `gigs: 4`, bucketed by `gigMonthOf` = `toISOString().slice(0,7)` (_lib.mjs:131), UTC calendar month, and _lifecycle.mjs:133-134 hard-refuses the 5th start inside the CAS with a 402 and "That's your 4 free shows this month. Upgrade to keep playing." A fixed-weekday player is refused in the ~4 months a year that contain five of that weekday. BUT: the page is more careful than the accuser noticed. The word is "About", it is a persona line ("who this plan is for"), and the exact limit is stated in plain digits on the very next line — about.html:603 "4 shows a month — up to 200 people in the room at each". No reader is misinformed about the number. What actually fails is the second clause, not the first: at "about a gig a week" you WILL be refused several months a year and told to upgrade, so "you never pay us anything" is the part the code contradicts. That is a soft-sell overreach sitting on top of a correct disclosure, not a critical falsehood.

LEG (b), the 10% — REFUTED. The accuser calls about.html:611 a "contradiction ten lines down". It is a disclosure, not a contradiction: it is in the same card, rendered in the excluded/negative style (`class="no"`), and about.html:653-657 says outright that "the 10% above currently applies to nobody". I verified that against code, and it is TRUE: `connectReady` (_pay.mjs:33-38) returns false for every account except the platform owner, because Connect is not built — so no non-founder artist can take a card payment, and therefore no free artist can be charged a cut of anything today. Calling a disclosed, currently-inoperative line item a critical falsehood inverts the page's most honest passage.

LEG (b), the $10 Featured spot — CONFIRMED, and WIDER than the accusation. I confirmed the whole chain: FEAT_PRICE = 1000 (_featured.mjs:40), the flag defaults ON (_flags.mjs:46-47), and admin.mjs featureStart (1452-1497) checks only the flag and `STRIPE_SECRET_KEY` — no plan gate and, crucially, no Connect gate, because this charge runs on MySet's OWN Stripe account. So it works today even though artist payouts do not. The UI is shipped (studio.html:1366 "Promote a gig"). The accuser understated it: about.html mentions Featured shows NOWHERE — grep for "featur" and "promote" across the file returns zero. It is an undisclosed paid product, not merely a contradiction of one sentence.

WORSE PROBLEM FOUND WHILE CHECKING — about.html:658-660: "Plus and Pro can't be bought yet. There's no checkout, so nobody is being charged for anything." That is false. Subscription checkout is fully built (_billing.mjs:120-157, `mode: 'subscription'`), wired to `planCheckout` (admin.mjs:78-84), and studio.html:3565 renders an unconditional "Upgrade to Plus" / "Upgrade to Pro" button for any free artist, which calls it (3579-3583). Combined with the $10 Featured checkout, "nobody is being charged for anything" is wrong twice over — and it is in the section the page uses to establish its credibility. This is the critical item on this page, not line 601.

**Fix.** For line 601, the accuser's fix is close but loses the sales work the line was doing and still leaves Featured undisclosed. Better: "Four shows a month, run properly, and there's no subscription to pay." — "four a month" matches _plan.mjs:33 exactly, "no subscription" is true (PLANS.free.price = 0) and does not have to be walked back by the 10% line beneath it or by a $10 Featured spot. Drop "about a gig a week" entirely: it is the clause the cap actually breaks.

Two paired fixes matter more than this line: (1) about.html:658-660 must stop saying "there's no checkout, so nobody is being charged for anything" — Plus/Pro checkout and the $10 Featured checkout are both live; (2) the pricing section should name Featured shows at all, e.g. one line under the Free card: "Optional: $10 to put one gig at the top of a city's night — three spots, first come, first served." Right now it is the only way a free artist can hand MySet money, and the page never mentions it.

## 3. [CRITICAL] Pricing & honest notes · line 606

> Setlists, chord charts, keys and genres

**Verdict:** FALSE — confirmed, and the problem is wider than the accuser found (severity stays critical)

**Evidence.** public/about.html:606 (Free plan card bullet), public/about.html:693-698 (FAQ, unqualified); netlify/functions/_plan.mjs:67 free `setlists: false`, :90 plus true, :108 pro true; netlify/functions/admin.mjs:731-736 the `listNew` gate returning 402; netlify/functions/_lists.mjs:39 `emptyLists = () => ({ v: 1, lists: [] })` and :29 `MAX_LISTS = 20`; public/studio.html:3512 vs 3524/3538

**Skeptic (high).** I tried to break this three ways and could not.

1) Is there another code path that makes the Free bullet true? No. I read the gate at admin.mjs:731-736 in full. Its own comment says only creating a new setlist is gated — "Everything else about setlists keeps working on free — an artist who downgrades can still use, rename and edit the sets they already have." That sounds like a rescue for the page, but it is not: it only helps someone who ALREADY has setlists, i.e. a downgraded paid artist. A new free artist starts from `emptyLists = () => ({ v: 1, lists: [] })` (_lists.mjs:39) — zero lists — and nothing seeds one. So `listNew` is the only door into having a setlist, and it is shut on free. `listRename`, `listDelete`, `listSongs`, `listToggle`, `listUse` (admin.mjs:750-800) are all ungated, but every one of them takes a `body.id` of a list that must already exist. For a free signup the feature is unreachable, not partially available.

2) Is the accuser reading a doc or comment as behaviour? No — the gate is executable code, and I confirmed `planForArtist` (_plan.mjs:146-151) resolves the real registry plan rather than defaulting to a paid one. The only bypass is `isPlatformOwner`, which is Perry himself (_plan.mjs:154), so it cannot rescue the claim for customers.

3) Is the page's sentence more careful than it looks? No, it is less careful. It is a bare bullet inside the Free card's `<ul>` (lines 600-609), with the free-only exclusion in that same list marked `class="no"` at line 608 — so the page has a visual convention for "not included" and did not use it here. Reading "Setlists" as loose shorthand for "the song library" is not available either, because the same page uses "setlist" in its precise product sense at 693-698.

WHERE IT IS WORSE THAN STATED — two things the accuser missed:

(a) The Plus card in about.html (lines 613-635) never mentions setlists at all. I grepped every occurrence of "setlist" in the file: 398, 606, 682, 690, 693-698. So the page does not merely misfile the feature; it deletes it from the paid tier entirely. The Studio's own sheet sells "Separate setlists, one active per night, applied from your calendar" on Plus (studio.html:3524) and Pro (3538). The landing page gives that selling point away for free and gives Plus nothing in return — a conversion loss on top of the false promise.

(b) The FAQ at 693-698 is a second, worse instance the accusation does not cover. It reads: "build a setlist instead — name it, put the songs you want in it... You can keep twenty of them and attach one to a gig in your calendar, so it loads itself when you start the show." That is unqualified how-to prose in a general FAQ, where a reader has no plan card nearby to give any cue that money is involved, and it walks them straight into the 402. (The "twenty" is at least accurate — MAX_LISTS = 20, _lists.mjs:29.) A free artist following that answer literally hits "Separate setlists are a Plus feature" on the very first step.

So: the accusation survives, the one-line fix is right but incomplete, and fixing only line 606 leaves the FAQ still lying and Plus still stripped of a feature it sells.

**Fix.** Three edits, not one.

1) public/about.html:606 — take the Studio's own wording so the two surfaces match:
   `<li>The song sheet — chord charts, keys and genres</li>`
   (studio.html:3512 already says "The song sheet: chord charts, keys and genres" on Free.)

2) public/about.html — add the feature back to the Plus card (after the "Unlimited songs live at once" bullet, ~line 626), mirroring studio.html:3524:
   `<li><b>Separate setlists</b> — one active per night, applied from your calendar</li>`
   Pro inherits it via "Everything in Plus", so Pro needs no edit.

3) public/about.html:693-698 — qualify the FAQ so it stops teaching a free artist to walk into a 402. Change "build a <b>setlist</b> instead" to "build a <b>setlist</b> instead (that one's on Plus)", keeping the rest. The free half of that answer — hiding a song, which stays hidden across future shows — is genuinely free and should stay stated first, exactly as it is now.

Worth a follow-up check by whoever applies this: about.html's Free card also lacks the "One sign-in" line the Studio sheet carries, and its Plus card lacks "the verification tick" and "shows that start and end themselves". I did not audit those against code, so treat them as a lead, not a finding.

## 4. [CRITICAL] Pricing & honest notes · line 657

> Everything that doesn't involve a card works the moment you sign up.

**Verdict:** FALSE — confirmed, severity high (not quite "critical"), and the underlying problem is WIDER than the accuser stated

**Evidence.** public/about.html:657 (the sentence); public/about.html:597-612 (the Free card, same section); netlify/functions/_auth.mjs:134 (a new signup is created with plan:'free' — no comp, no bypass); netlify/functions/admin.mjs:735-736 (listNew refused 402 on free); netlify/functions/admin.mjs:1704-1706 + 1288-1291 (freeCredits/packs/replayCost/askSet gated on limits.pricing; postDelete refused 402); netlify/functions/admin.mjs:1852-1856 (toggleSong refused 402 over limits.featured=50); netlify/functions/auth.mjs:392-398 (a second sign-in refused 402, limits.seats=1); netlify/functions/_plan.mjs:64-78 (free: setlists/pricing/merch/moderate all false, featured 50, seats 1); netlify/functions/_flags.mjs:28-50 (only two flags exist — voteFinal, featuredShows — neither disables plan enforcement); WIDER: public/about.html:606 vs netlify/functions/_lists.mjs:39 + admin.mjs:743 (the only push is inside the gated listNew, so a Free artist can never hold a single setlist), and public/about.html:693-698 (the FAQ promises named setlists with no plan caveat)

**Skeptic (high).** I tried hard to break this finding and could not.

THE DEFENCE I TESTED FIRST, AND WHY IT FAILS. The best available refutation is contextual: line 657 sits at the end of note 2, whose subject is the card outage, so the sentence could be read narrowly as "the missing payments plumbing doesn't hold anything else up." That reading dies on the words "the moment you sign up." That clause is about the signup state, not about the card outage, and _auth.mjs:134 creates every new artist with plan:'free' — no comp, no trial, no grace period. I then looked for the strongest possible refutation, a runtime kill-switch on plan enforcement: _flags.mjs declares exactly two flags (voteFinal, featuredShows), neither touches plans, and flagValue returns false for any undeclared name. There is no code path that makes the sentence true.

THE FIVE GATES ARE REAL, NOT COMMENTS OR DOCS. I read each one in the handler, not in a doc: listNew 402 at admin.mjs:735-736; the pricing quartet (freeCredits/packs/replayCost/askSet) gated by limits.pricing at 1704-1706; postDelete 402 at 1288-1291 via moderateAllowed; toggleSong 402 against featured=50 at 1852-1856; the second sign-in 402 at auth.mjs:392-398. All five are server-side refusals, all five are listed on the Plus or Pro card inside the same section (lines 620-641), and none of them involves a card.

WHERE THE ACCUSER OVERREACHED — two of the eight items should be struck. (a) The verification tick does not belong in this finding. It is not listed in the pricing section at all; the only "verify" text on the page is line 577, which is inside the VENUES section (505-585) and says "Free. Your page works whether you verify it or not" — a true statement about a venue page still working unverified. The artist tick the accuser cites (studio.html:1174-1195, community.mjs:70) is never sold on this page, so it cannot make this sentence false. (b) The four unbuilt flags are already disclosed, in the very next sentence: they carry a "Soon" chip at lines 641-645 and note 3 says outright that they are "on the way, not shipped." Charging them against note 2 double-counts a disclosure the page already makes honestly. So the count is five, not ten.

WHERE THE ACCUSER UNDERREACHED, WHICH MATTERS MORE. Chasing the setlist gate turned up a bigger problem than the sentence under audit. _lists.mjs:39 starts every artist at lists: [], and admin.mjs:743 — inside the gated listNew — is the only line in the repo that ever pushes one. A Free artist therefore cannot obtain a setlist by any route. Yet line 606 sells "Setlists" as a FREE plan bullet, and the FAQ at 693-698 explains how to build one with no plan caveat at all. The comment at admin.mjs:731-734 rationalises the gate as protecting a downgraded artist's existing sets, which is true and humane, but it quietly conceals that a new free artist has none to protect. That is a false Free-plan bullet, which is a harder claim than a soft reassurance in the honesty block.

ON SEVERITY. I would say high rather than critical. The pricing cards immediately above are accurate about the ladder, and a reader going top-down sees "Plus $10/month — unlimited songs live at once, set your own vote rules, delete a post for good" before reaching line 657. Nobody is charged money on the strength of this sentence. But it is a plainly false statement sitting inside a block whose entire promise is "here is where the edges are," and combined with note 3 it points a reader at the specific wrong conclusion that the paid tier is open until billing ships. A false line in the honesty section costs more trust than the same line elsewhere, which is why I would not soften it below high.

**Fix.** Replace line 657 with: "Everything on the Free plan that doesn't involve a card works the moment you sign up — the Plus and Pro extras stay locked until there's a checkout."

The accuser's fix is correct but incomplete: it repairs note 2 and leaves note 3 to do the damage. Note 3 ("Plus and Pro can't be bought yet. There's no checkout, so nobody is being charged") invites exactly the wrong inference — that the paid tier is simply switched on for everyone until billing lands. The added clause closes that loop in the same breath.

Two further fixes the accusation missed, which are arguably worse than the sentence audited:
1. public/about.html:606 — the FREE card advertises "Setlists, chord charts, keys and genres". Creating a setlist is refused on free (admin.mjs:735), and admin.mjs:743 is the only code anywhere that creates one, so a Free artist can never possess a single setlist. The Free card is promising a feature Free is refused. Suggest: "Chord charts, keys and genres" on the Free card, and move setlists to the Plus card explicitly.
2. public/about.html:693-698 — the FAQ ("build a setlist instead — name it... You can keep twenty of them") describes creating setlists as available to anyone, with no plan caveat. Needs the same Plus marker.

## 5. [CRITICAL] Pricing & honest notes · line 658

> Plus and Pro can't be bought yet.

**Verdict:** FALSE — confirmed, severity critical, and the surrounding block is worse than the accuser reported

**Evidence.** public/about.html:658 (live — confirmed by `curl -s https://myset.vip/about`, the sentence is served in production); netlify/functions/_billing.mjs:65 (stripeClient), :123 (the only gate), :139-158 (subscription-mode Checkout Session, success_url /studio?sub=done); netlify/functions/admin.mjs:79-84 (planCheckout endpoint); public/studio.html:3565 + :3579-3583 (Upgrade button → planCheckout → location.href = d.url); netlify/functions/webhook.mjs:73-75 (checkout.session.completed, mode subscription → handleBillingEvent); netlify/functions/_flags.mjs:27-51 (only two flags exist, neither is billing); netlify/functions/_plan.mjs:130 (NOT_BUILT = promote, analytics, presskit, branding — billing is not in it); netlify env:list --json --context production (STRIPE_SECRET_KEY present, masked); `netlify blobs:get myset artists` (exactly 1 artist: perry-idyll, plan=pro, comped, billing unset); netlify/functions/venueadmin.mjs:418 (venue Pro checkout, same machinery); netlify/functions/_connect.mjs:134-160 + pay.mjs:51,161-168 (Connect Express onboarding built, not plan-gated)

**Skeptic (high).** I tried to save the page and could not. I looked for every escape route and none exists.

No other code path makes the sentence true. `startCheckout` (_billing.mjs:121-160) has exactly three ways to fail: no Stripe key (:123), an unknown plan tier (:125), an unknown owner (:128), plus an already-subscribed guard (:137). Nothing else. There is no billing kill switch anywhere in the repo — I grepped for BILLING_OPEN / checkoutOpen / CHECKOUT_DISABLED and found nothing, and _flags.mjs declares only `voteFinal` and `featuredShows`. Billing is not in NOT_BUILT.

The accuser is not reading a comment as behaviour. I read the executable lines, not the header block. The header's 2026-09-04 date is corroborated independently by git: commit 6fae274 "Plans you can pay for, venues that get paid, accounts that can leave" is dated 2026-09-04.

The page's wording is not more careful than it looks — it is less careful. "There's no checkout" is a flat statement about a mechanism, and studio.html:3579 POSTs `planCheckout` and navigates to a real Stripe Checkout URL. Both clauses of the sentence are false.

I confirmed the sentence is stale rather than deliberate: git -S dates it to 565bb21, 2026-09-02, the honesty pass. Billing shipped two days later, and about.html has since been edited twice (421d5ac, 9e9fde4, both 2026-09-05) without this line being revisited.

I verified the Stripe key is really set — I ran `netlify env:list --json --context production` myself and STRIPE_SECRET_KEY comes back present (masked, as prod.py's header explains secrets always do). I could not read its prefix to prove live vs test mode; that is the one thing I cannot personally confirm. It does not rescue the page either way: a test key would mean cards are not really charged, but the page's claim is "there's no checkout", and the checkout exists and opens regardless.

I also verified the accuser's factual premise for the fix, which they only asserted: `netlify blobs:get myset artists` returns exactly one account, perry-idyll, plan=pro, compedBy set, `billing` unset. So "only the founder has an account, comped" is true and now evidenced, and no MySet subscription price/product exists in the live Stripe account I can see.

WIDER THAN STATED, two ways:
1. Venues can buy too. venueadmin.mjs:418 runs the same `startCheckout` for venue Pro ($20, TIERS.venue, _billing.mjs:51). The sentence "nobody is being charged for anything" covers that too, and it is equally false.
2. The note directly above it, note 2 at about.html:654-657, is stale in the same way and nobody flagged it. It says "no other artist can take money through MySet." Stripe Connect Express onboarding is fully built and not plan-gated (_connect.mjs:141-160), the Studio offers it (studio.html:1449-1473), and pay.mjs:51 and :161-168 route charges directly to any artist whose account has chargesEnabled. The only reason no other artist takes money is that no other artist exists. That is a different sentence with a different fix, and it should be raised as its own finding.

One part of the flagged sentence IS true and must survive the edit: the four Pro items marked Soon map exactly onto NOT_BUILT at _plan.mjs:130 — analytics, presskit, branding, promote. Do not rewrite that clause.

My only quarrel with the proposed fix is that it writes an unverifiable-at-the-time claim into a panel titled "honest notes" — the exact failure the honesty pass was correcting. I have now verified it, so it can stand, but I would phrase it so it stays true as soon as the second artist signs up.

**Fix.** Replace note 3 (about.html:658) with:

"<b>3 · Nobody has paid us yet.</b> Checkout is live — Plus and Pro are $10 and $20 a month, handled by Stripe from inside the Studio — but MySet has one account on it so far, the founder's, and that one isn't paying. The four Pro extras marked <em>Soon</em> are on the way, not shipped; everything else listed above is built and running today."

Why this over the accuser's version: it drops "at the prices above" (the prices are three inches up the page), it says where the checkout is so the sentence is checkable, and "MySet has one account on it so far" stays honest the day artist number two signs up, whereas "only the founder has an account" becomes a new false claim the moment that happens.

SEPARATE FINDING, same panel — note 2 at about.html:654-657 is stale too and needs its own fix. Suggested:

"<b>2 · Only the founder has taken money through it so far.</b> Payouts run on Stripe and any artist can connect their own account from the Studio — it just hasn't happened yet, because there aren't any other artists yet. Which also means the 10% above currently applies to nobody. Everything that doesn't involve a card works the moment you sign up."

## 6. [CRITICAL] Pricing & honest notes · line 658

> There's no checkout

**Verdict:** FALSE — confirmed, and slightly narrower in scope than the accuser framed it (note 2 on the same page is still true; only note 3 is wrong)

**Evidence.** public/about.html:658 (the claim) vs. public/studio.html:2536 (an "Upgrade" button rendered for every free artist in the Studio header, no flag), public/studio.html:2352 (a second entry, "Upgrade your plan"), public/studio.html:3559 openPlans → :3564 startCheckout → :3579-3583 POST {action:'planCheckout'} → netlify/functions/admin.mjs:79-84 → netlify/functions/_billing.mjs:121-161 stripe.checkout.sessions.create({mode:'subscription'}). Gate check: netlify/functions/admin.mjs:1578-1590 restricts planCheckout to role 'owner' only — there is no allowlist, no beta gate, and no entry in netlify/functions/_flags.mjs FLAGS (:27-50 declares only voteFinal and featuredShows). The only kill switch is STRIPE_SECRET_KEY (netlify/functions/_billing.mjs:65), and it IS set in production: live GET https://myset.vip/api/show?slug=perry returns paymentsEnabled:true, which per netlify/functions/_pay.mjs:52-55 canTakeMoney requires process.env.STRIPE_SECRET_KEY to be present. Staleness is provable from git: _billing.mjs landed 2026-09-05 01:21 (commit 6fae274 "Plans you can pay for…"), about.html was last touched 2026-09-05 21:59 (commit 9e9fde4) and the note was not updated.

**Skeptic (high).** I went looking for four escape hatches and found none.

(1) Another code path making it true: no. I checked _flags.mjs — the entire flag registry is two flags, voteFinal and featuredShows, and unknown names read as false (:87), so billing is not flag-gated. I checked the dispatch in admin.mjs: planCheckout is in PLAN_ACTIONS (:425) and OWNER_ONLY (:1578), which restricts it to the account owner — but every artist IS the owner of their own account, so that is not a gate on buying, only on band members buying.

(2) Reading a comment as behaviour: no. The header comment in _billing.mjs (:7-42) describes billing as newly built, and the executable code underneath matches it line for line — ensurePrice creates the product and price on first use (:86-99), startCheckout builds a real subscription-mode session (:145-158), finishCheckout syncs it back into the registry (:203-217).

(3) An unimplied condition: I tested the strongest one available — that STRIPE_SECRET_KEY might be unset, which would make startCheckout return 'payments-not-configured' and arguably make "there's no checkout" true in practice. I refuted my own defence with a live production request: /api/show returns paymentsEnabled:true, and that field can only be true when the key is present (_pay.mjs:52-55). So the key is set and checkout would open.

(4) More careful wording than noticed: I read the sentence closely. It is three claims — "can't be bought", "there's no checkout", "nobody is being charged". The first two are flatly false. The third is presented as a consequence of the second, so it inherits the falsehood even if, as a matter of fact, no one has subscribed yet.

Where the accuser was imprecise: they wrote as if the whole "honest notes" block were wrong. It is not. Note 2, about fan-to-artist card payments, is still accurate because Stripe Connect genuinely is not built (INVARIANT 0r, enforced at _pay.mjs:34-38). Only note 3 is stale. Their proposed fix — delete the clause — would also delete the accurate statement about the four Pro extras, so I have proposed a rewrite instead. The git dates also give the finding a clean provenance the accuser did not cite: billing shipped, then about.html was edited later that same day and the note was simply missed.

**Fix.** Do NOT just delete the clause — that throws away the true half of the note. Two corrections to the accuser's fix:

1. Note 3 must be rewritten, not deleted. Replace public/about.html:658-660 with something like: "**3 · The four Pro extras marked *Soon* are on the way, not shipped.** Everything else listed above is built and running today. Plus and Pro are live — you subscribe in the Studio, Stripe handles the card, and you can cancel any time; a paid month is always yours to the end." That last clause matches the app's own copy at public/studio.html:3577 and the proration/downgrade behaviour in netlify/functions/_billing.mjs:229-255.

2. Do NOT touch note 2 while fixing note 3, and do not merge them. Note 2 ("Card payments aren't on yet… no other artist can take money through MySet") is STILL TRUE and independently verified: netlify/functions/_pay.mjs:34-38 connectReady returns false for every account except the platform owner because Connect is not built, and canTakeMoney (:52-55) gates every money button on it. The two notes describe opposite directions of money — artist pays MySet (live) vs. fan pays artist (not live) — and the fix must keep them apart or it will introduce a new false statement.

Severity note: I would keep "critical". This is not just stale copy. The sentence tells a prospective customer, in the page's own "honest notes" section, that they cannot be charged — while a live Stripe subscription is two taps away from the Studio header for any signed-in owner. A page that under-claims its own billing is a worse failure mode than one that over-claims a feature.

## 7. [MAJOR] index.html (what’s-on home) · line 307

> No gigs listed yet

**Verdict:** CONFIRMED but re-graded: not "FALSE / major" but "CONDITIONALLY FALSE / moderate" — the sentence is accurate on the empty-index path (which really exists) and false only when the request failed. The defect is that one branch serves both states.

**Evidence.** public/index.html:303 (empty catch), :305 (the three-way branch), :306 (field disabled), :307-308 ("No gigs listed yet" + "MySet is brand new"), :326 (the #go listener a naive retry would double-bind), :404 (the same page's correct failure copy), :604 (boot() called once, never again), :36 and :612 (pull.js loaded and MySetPull() run — a reload retry does exist); netlify/functions/events.mjs:19-37 (places branch, single `return json({ok:true,...})` at :36); netlify/functions/_lib.mjs:891 (`bad()` is the only ok:false producer, unused by that branch); netlify/functions/_events.mjs:165-170 (missing index doc yields countries:[] with ok:true — the legitimate empty path).

**Skeptic (high).** I tried to break this finding and could not break its core, but two of its sub-claims are overstated and its proposed fix is wrong in one place.

WHAT I CONFIRMED MYSELF
1. The branch is exactly as quoted. public/index.html:303 swallows every fetch/parse failure into an empty catch, leaving PLACES null; :305 tests `!PLACES||!PLACES.ok||!PLACES.countries.length`; :306 disables the country field; :307 prints "No gigs listed yet" and, worse than the accuser noted, the paragraph under it asserts "MySet is brand new" — an unconditional claim about the business, printed on a network hiccup.
2. The places branch of the API genuinely cannot return ok:false. netlify/functions/events.mjs:19-37 has a single exit, `return json({ ok: true, src: MARK, countries })` at :36. `bad()` (netlify/functions/_lib.mjs:891) is the only producer of ok:false and the places branch never calls it. So `!PLACES.ok` at :305 is dead against a healthy function; only an unhandled throw (blob read failure, or a timeout inside countUpcoming's N-blob-reads loop, events.mjs:117-128) reaches the client, and it arrives as a non-JSON Netlify error page, which throws in `r.json()` and lands in the same empty catch. The accuser read this correctly.
3. There is no in-page retry. boot() is called exactly once (index.html:604) and nothing re-runs it — no online, pageshow, visibilitychange or interval listener exists in the file.
4. The page's own author already knows the right pattern and applied it 100 lines later: index.html:404 renders "Couldn't load that / Try again in a moment" for a failed city search, and there `!d.ok` is live because that path really can return bad(). So this is an inconsistency inside one file, not a missing idea.

WHERE THE ACCUSER OVERSTATES
a. "The only realistic way to reach this copy is the catch at :303." Not so. netlify/functions/_events.mjs:165-170 returns `{v:1,countries:{}}` when the index doc is missing, which yields ok:true with countries:[] — a real, designed, currently-unused path on which the sentence is perfectly true. And the failure side is WIDER than stated: a fan simply offline or on a dead bar wifi hits the same catch, which at a live gig is more likely than a cold function.
b. "No retry anywhere on screen" is too strong. public/pull.js is loaded blocking at index.html:36 and MySetPull() runs at :612, giving every page a pull-to-refresh that does a real reload — plus the browser's own reload, and boot() re-runs on load. The visitor is not stranded; there is just no visible affordance and no explanation.

So the correct charge is narrower and cleaner than "the page states something false": the sentence is true on the path it was written for, and the bug is that one branch conflates "we asked and there is nothing" with "we could not ask". That is a conflation defect, and I would land it moderate rather than major, because it self-heals on reload and the three CTAs beneath it still work.

WHY THE PROPOSED FIX IS PARTLY WRONG
It says to leave the country field enabled on failure. Do not. With PLACES null the combo has no options at all (:317-325 read PLACES.countries), so an enabled field would open an empty list and swallow typing — a worse lie than a disabled one. And "Pull down to try again" is desktop-blind and, per pull.js's own header comment, cannot help a page whose JS is broken.

ONE MORE TRAP THE FIX MUST NOT WALK INTO: a retry button that simply calls boot() again will re-run :326, binding a second click listener to #go, so a later Search fires search() twice. An in-place retry has to be idempotent or it has to reload.

**Fix.** Split the branch three ways, fix the server so ok:false stops being dead code, and give a retry that cannot double-bind.

CLIENT (public/index.html:303-312):

  let failed=false;
  try{ PLACES=await fetch(`${API}/events?places=1`,{cache:'no-store'}).then(r=>r.json()); }
  catch(e){ failed=true; }
  if(!PLACES||!PLACES.ok) failed=true;
  const cs=$('#country');
  if(failed){
    cs.placeholder='Couldn’t load'; cs.disabled=true;      // keep it disabled: there is nothing to pick from
    $('#out').innerHTML=`<div class="blank"><b>Couldn’t load what’s on</b>
      <p>That’s us, not you. Your connection may have dropped.</p></div>
      <button class="btn btn-pri btn-block" id="retry" type="button">Try again</button>
      <a class="learnmore" href="/about">While you’re here — see how MySet works →</a>`;
    $('#retry').addEventListener('click',()=>location.reload());
    return;
  }
  if(!PLACES.countries.length){ ...the existing "No gigs listed yet" block, unchanged... }

Three points that matter and that the original fix misses:
- location.reload() rather than boot(), because boot() is not idempotent (:326 would bind a second click handler to #go).
- The field stays disabled, because the combo has no data to offer; the placeholder plus the button carry the meaning instead.
- Keep the /about link so the failure screen still has somewhere to go, but drop the two "add my gigs" CTAs — asking a visitor to sign up on a screen that just failed is the wrong moment.

SERVER (netlify/functions/events.mjs:19-37): wrap the places branch so a blob failure returns JSON the client can read, instead of an HTML 500 that throws inside r.json():

  if (url.searchParams.get('places')) {
    try { ...existing body... return json({ ok:true, src:MARK, countries }); }
    catch (e) { return bad('places unavailable', 503); }
  }

That makes the `!PLACES.ok` test at :305 mean something for the first time, and separates "our store is down" from "your phone dropped the connection" in the function logs.

OPTIONAL, and I think worth it: the same conflation is the reason index.html:404 exists in isolation. Once both failure screens exist, use the identical wording on both ("Couldn’t load … Try again") so the page has one voice for one condition.

## 8. [MAJOR] index.html (what’s-on home) · line 358

> <span>${x.n} gig${x.n===1?'':'s'}</span>

**Verdict:** FALSE — severity major (upgrade: the same defect also corrupts the COUNTRY rows in the same dropdown, by double-counting)

**Evidence.** public/index.html:358 (the label); netlify/functions/events.mjs:178-189 (countUpcoming — no place filter, ids.slice(0,40) at :181); netlify/functions/events.mjs:25 (city rows), :33 (country row = sum of city counts), :32 and :35 (the wrong numbers also order the list); netlify/functions/events.mjs:78 (the feed DOES filter by city/country) and :147 (feed `total: rows.length`); netlify/functions/_events.mjs:178-186 + :196-201 (reindexCities indexes one owner into EVERY city they have gigs in — so the multi-city owner is real, not hypothetical)

**Skeptic (high).** I tried to refute this and could not. Every load-bearing claim checks out in code I read myself.

The count path: events.mjs:25 calls countUpcoming(ids) with only the id list — the country and city are in scope at that point and simply are not passed. Inside (events.mjs:178-189) it expands every occurrence in the 7-day window for each owner and filters on `o.endsAt > now` and nothing else. There is no city or country test anywhere in the function.

The contrast is real and it is in the same file: the actual city feed drops foreign occurrences at events.mjs:78 (`if (o.city !== city || o.country !== country) continue;`) and reports `total: rows.length` at :147. So the picker and the feed answer the same question two different ways.

The multi-city owner is not hypothetical. _events.mjs:178-186 builds `places` as a Set of every distinct country+city the owner has gigs in, and :196-201 pushes the owner's id into each of those city arrays. An act playing Bangkok and Chiang Mai is genuinely in both lists, and today contributes their Bangkok gigs to Chiang Mai's number and vice versa.

I checked the escape hatches and none of them open:
 - Another code path? No. The picker's numbers come only from `/events?places=1` (index.html:303); nothing else supplies x.n.
 - Comment-vs-behaviour? The comment at events.mjs:177 says "How many gigs these artists have in the window", which is an honest description of the code — it is the PAGE that adds the place claim, not the comment.
 - More carefully worded than noticed? No, and this is where the finding is understated. Line 358 is a SHARED renderer used by both comboboxes (index.html:315 country, :324 city). The row renders `<b>Bangkok</b><span>7 gigs</span>` — name of a place, then a count, with nothing hedging it. It reads as "7 gigs in Bangkok" and there is no wording to hide behind.

Where I think the accuser undersold it: the country row at events.mjs:33 is `list.reduce((s,c)=>s+c.gigs,0)`, a sum of the already-unfiltered city counts. That double-counts a multi-city act's whole diary once per city they are indexed in. So Thailand can show a number larger than the sum of what any user could ever find by visiting its cities. That is a bigger, more visible lie than the per-city one, and the accuser did not mention it.

Two smaller things worth recording. The window itself is fine — countUpcoming uses the same WINDOW_DAYS=7 and the same per-owner-tz `from` as the feed, so only the place dimension diverges. And the slice(0,40) cap errs the other way, undercounting a city with more than 40 indexed owners; since both sorts (:32, :35) rank by these numbers, a wrong count also puts the wrong city and the wrong country at the top of the list.

The "today it agrees by accident" caveat is also correct and worth keeping — one city, one artist, so the bug is invisible in production right now and will surface the first time an act lists gigs in two places.

**Fix.** Fix the count, not the label — and fix it in one place so both dropdown rows become correct.

1. Give countUpcoming the place it is counting for (events.mjs:178-189):

   async function countUpcoming(ids, country, city, cache) { ... 
     n += occurrencesFor(events, addDays(from,-1), addDays(from, WINDOW_DAYS))
            .filter(o => o.endsAt > now && o.city === city && o.country === country).length; }

   and call it as `countUpcoming(ids, country, city, cache)` at events.mjs:25. This is the accuser's fix and it is right — it makes the city number mean the same thing as the feed's own `total` at :147, which already filters at :78.

2. Do NOT stop there. events.mjs:33 builds the country row as `list.reduce((s,c)=>s+c.gigs,0)`. Today that is doubly broken: an act indexed in Bangkok and Chiang Mai has its ENTIRE gig count added twice into Thailand's number, and gigs outside Thailand are in both halves of that sum. Once step 1 lands, the sum repairs itself for free — every occurrence lands in exactly one city bucket (the city on the occurrence), and reindexCities (_events.mjs:196-201) guarantees the owner is indexed in that city — so leave :33 as a sum, but only after the filter exists. Shipping the label change alone would leave the country number wrong with no way to read it.

3. The ids.slice(0,40) cap (events.mjs:181) is a separate, opposite error — a silent undercount once a city has 41 indexed owners, and it silently mis-ranks the picker via the sorts at :32/:35. Two cheap improvements: (a) memoise readEvents by owner id in a Map passed through the whole ?places=1 loop — an act indexed in three cities is currently read three times, so the cache buys back most of the cost the cap was protecting; (b) with that cache, raise the cap and, if it is still hit, return a `capped:true` flag and render "40+ gigs" rather than a confidently wrong number.

The label rewrite to "${x.n} this week" is an acceptable stopgap for the city row ONLY. It does not rescue the country row, and it discards the one thing the number is for — telling someone whether it is worth going to that city tonight.

## 9. [MAJOR] index.html (what’s-on home) · line 408

> ${d.artists} artist${…} play${…} here — nothing in the next seven days.

**Verdict:** SURVIVES on mechanism, but the label is wrong: not FALSE/major — IMPRECISE / STALE-COUNT, severity minor-to-moderate. The sentence is true in the common case and wrong only in a stale-index tail case, and it sits in an empty-state on a secondary page, not in a headline claim.

**Evidence.** public/index.html:408 (the sentence); netlify/functions/events.mjs:148 (`artists: ids.filter((x) => !isVenueOwner(x)).length`) and :147 (`total: rows.length`); netlify/functions/_events.mjs:182 (`if (e.repeat) { places.add(placeKey(e.country, e.city)); continue; }` — no `until` check) vs :185 (the 7-day tail for one-offs); netlify/functions/_events.mjs:94 and :113 (`stop`/`limit` — expand DOES honour repeat.until, which is what creates the mismatch); public/studio.html:1720 + :1743 ("Stop repeating on (optional)" → `repeat:{freq,until:v('gUntil')||null}`, so an expired residency is a state a real artist can create); netlify/functions/venue-studio... public/venue-studio.html:1665 (`repeat:{freq,until:null}` — venue events can never expire, same index, counted as `venues:` at events.mjs:149).

**Skeptic (high).** I tried to refute this and could not. The mechanism is real and I confirmed each link personally.

What holds: `expand()` honours `repeat.until` (_events.mjs:94, :113), so a residency with an end date in the past yields zero occurrences and `total` (events.mjs:147) is 0 — the empty branch fires. But `reindexCities` (_events.mjs:182) adds the city for ANY repeating event with no `until` check at all, so that artist stays in the city index and is still counted at events.mjs:148. And this is not hypothetical: studio.html:1720 is a real "Stop repeating on (optional)" date field, written straight into `repeat.until` at :1743. Traced the arithmetic both ways (weekly jump-ahead and the monthly `d > limit` break) — both produce zero pushes with a past `until`. So `artists >= 1` with `total === 0` and nobody actually playing there is reachable.

Where the accusation overreaches, and why I downgrade it:

1. Its own headline example is wrong. "A residency that ended two years ago keeps them listed forever" only produces THIS sentence if the artist set an end date. If they simply stopped showing up and never touched the record, `expand` keeps generating occurrences forever, `total > 0`, and the empty state never renders — the page instead advertises phantom gigs. That is a different and worse bug that this finding does not actually cover.

2. It describes the number as "the size of the city index's membership list, not a count of anyone who plays there now." That is unfair to the code. The index is rebuilt from live event records on every save; for the overwhelming majority it is exactly "artists with a current event naming this city." The dominant reason this branch renders at all is an artist with a monthly or biweekly residency whose date falls outside this particular week — and for them "3 artists play here" is straightforwardly true and is the most useful thing on the screen. Over-count is the tail, not the norm.

3. The 7-day one-off tail at :185, which the finding lists as a defect, is close to honest. Saying an act "plays here" when they played in that town four days ago is not a lie; it is a deliberate, commented grace window.

4. Severity "major" does not fit the surface. This is public/index.html — the brief's secondary page — inside an empty state a stranger only reaches after picking a country and city and finding nothing on. The load-bearing half of the sentence ("nothing in the next seven days") is always correct; the disputed half is a count offered as context. Compare it to a pricing or capability claim in the hero of about.html and it is plainly not the same weight.

One way it is WIDER than stated: the same stale ids also produce `venues:` at events.mjs:149 and the picker's per-city `artists`/`venues` at events.mjs:29-30, and venue-studio.html:1665 hard-codes `until:null`, so a venue owner cannot expire a recurring event even in principle. index.html only renders the picker's `gigs` today (:315, :324), so nothing else surfaces on-page right now — but the payload is wrong for anything that consumes it next. That is the argument for fixing _events.mjs:182 rather than deleting the sentence.

**Fix.** Fix the count at its source instead of deleting it from the page — the same stale list also feeds `venues:` (events.mjs:149) and the picker's per-city `artists`/`venues` (events.mjs:29-30), so removing the sentence hides one symptom and leaves the data wrong. In `_events.mjs:182`, give repeating events the same trailing-7-day rule the one-off branch already has:

  if (e.repeat) {
    const end = e.repeat.until;
    if (!end || wallClockToMs(end, e.time, e.tz) > Date.now() - 7 * 86400000)
      places.add(placeKey(e.country, e.city));
    continue;
  }

That is four lines, uses a helper already imported in the file, and makes the index mean what its own docstring at :177 claims ("exactly the places they now have gigs, and nowhere else"). Note the index still only rewrites on the owner's next save (admin.mjs:489/:496/:517, venueadmin.mjs:136/:146/:233, _account.mjs:124/:147/:197), so an expired residency clears on that artist's next event save, not instantly. If Perry wants a sentence that is true even with a stale index, hedge the tense rather than dropping the number — "3 artists list gigs here — nothing in the next seven days." — which keeps the useful signal for a stranger. Do NOT ship the accuser's "Acts have played here before"; that is false in the dominant case, where the artist has a monthly residency and simply has no date inside this particular week.

## 10. [MAJOR] index.html (what’s-on home) · line 409

> No one has listed a gig here yet.

**Verdict:** CONFIRMED — status FALSE stands, severity moderate rather than major; the accusation's mechanism is right but its illustration (live quiz nights being hidden) is wrong, since anything inside the seven-day window makes total &gt; 0 and this branch unreachable. The true failing cases are a venue-only city whose listings are all further out than seven days, or all finished within the last seven days.

**Evidence.** public/index.html:408-409 (branch on d.artists only); public/index.html:358 (the same page calls a venue's event a "gig"); netlify/functions/events.mjs:148-149 (artists and venues sent as separate counts); netlify/functions/events.mjs:8,77,79 (seven-day window, finished events dropped); netlify/functions/events.mjs:178-189 (countUpcoming counts venue owners too); netlify/functions/_events.mjs:163 (isVenueOwner = v_ prefix); netlify/functions/_events.mjs:178-186 (an owner stays indexed for a repeat, or for 7 days after a one-off); netlify/functions/venueadmin.mjs:136,146,233 (venues are written into the city index as v_&lt;vid&gt;)

**Skeptic (high).** I tried to break this finding four ways and it survived all four.

1) Is the empty branch even reachable with venues in the index? Yes. `venueadmin.mjs:136,146,233` calls `reindexCities(evOwner(vid), events)` with a `v_<vid>` owner, and `_events.mjs:163` defines `isVenueOwner` on exactly that prefix. So a city key in `cityindex` can hold only `v_` ids. `events.mjs:148-149` then returns `artists: 0, venues: >0`, and `index.html:408` tests `d.artists` alone, so the visitor is shown "No one has listed a gig here yet." (`index.html:409`).

2) Is the statement rescued by the fact that the empty branch only fires when `!d.total`? No — this is where I expected to refute it and could not. `reindexCities` (`_events.mjs:178-186`) keeps an owner in a city if the event repeats, OR if the one-off is later than `Date.now() - 7 days`. The feed window (`events.mjs:8,77`) is only yesterday..+7 days and drops anything already ended (`events.mjs:79`). So two ordinary cases give venues>0 with total=0: a venue whose only listing is a one-off more than seven days out (the full-moon party three weeks away — indexed, invisible, and the page says nobody ever listed anything), and a venue whose one-off ran two nights ago (still indexed for seven days). The accuser's phrasing implies live quiz nights are being hidden — that specific case is wrong, because a recurring quiz night inside the window makes `total > 0` and this branch unreachable. The bug is real; the accuser's illustration of it is not.

3) Is "gig" a narrower word than the accuser noticed — i.e. does the page mean "artist gig", making the sentence technically true when only a venue has listed? No, and the page itself refutes that. The city picker at `index.html:358` renders `${x.n} gig${...}`, and that count comes from `countUpcoming` (`events.mjs:178-189`) which walks every id in the city including `v_` venue owners. The same page counts a venue's event as a "gig" one screen earlier, so it cannot fall back on "gig means artist" one screen later.

4) Is it unreachable in practice? No. `events.mjs:26-28` deliberately keeps a zero-count city listed in the picker "so the emptiness is visible before they commit", and `index.html:335` auto-runs `search()` for a remembered city on load. The empty state is designed to be seen.

WIDER THAN STATED — the accuser stopped one case short. The other side of the same ternary is also untrue, in two ways. When artists>0 AND venues>0, the page renders only "N artists play here" and silently erases the venues from the sentence. And "play here" over-claims: `artists` counts who is in the city index, and `_events.mjs:185` keeps someone there for seven days after their last gig ended, so an artist whose only booking finished six days ago is reported in the present tense as playing here. "listed here" is the claim the data actually supports.

The proposed fix is directionally right but throws away information the current line gets right: it collapses "3 artists play here" into a bare "Nothing listed here in the next seven days", losing the one signal that tells a visitor the city is alive rather than empty. My version keeps the counts, names venues alongside artists, and drops the false present tense.

Severity: I would downgrade major to moderate. It is a false sentence on the public home page, so it is real, but it is copy in an empty state — no money, no data, no access — and it needs a city whose entire registered population is venues with everything outside a seven-day window.

**Fix.** Keep the counts, name both kinds of lister, and stop claiming the present tense. Replace index.html:408-409 with:

  <p>${(d.artists||d.venues)
    ? `${[d.artists&&`${d.artists} artist${d.artists===1?'':'s'}`,
         d.venues&&`${d.venues} venue${d.venues===1?'':'s'}`].filter(Boolean).join(' and ')
      } listed here — nothing in the next seven days.`
    : 'No one has listed anything here yet.'}</p>

This reads "1 venue listed here — nothing in the next seven days." for the venue-only city the accuser found, "2 artists and 1 venue listed here — nothing in the next seven days." for the mixed city the accuser missed, and falls to the never-listed line only when the city index really is empty. "listed here" replaces "play here" because _events.mjs:185 keeps someone in the index for a week after their last gig ended, so "play here" is not something the count can support. Note the accuser's version drops the artist count entirely, which loses the only signal that an empty week is a quiet week rather than a dead city.

## 11. [MAJOR] index.html (what’s-on home) · line 485

> Featured shows

**Verdict:** UPHELD, but reclassified: not FALSE — UNDISCLOSED PAID PLACEMENT (misleading by omission). Severity major, and wider than stated: it also makes about.html:594 inaccurate on the primary landing page.

**Evidence.** public/index.html:485 (only visible string, "Featured shows"); public/index.html:117-124 (orange border styling, no label); public/about.html:591-594 ("Everything the room sees is free. Always." / "What you pay for is your own back office."); netlify/functions/_featured.mjs:41-42 (FEAT_PRICE 1000, SLOTS 3); netlify/functions/_flags.mjs:46 (featuredShows default true); netlify/functions/admin.mjs:1404-1478 (handleFeature, no venue-owner exclusion); netlify/functions/admin.mjs:1489 (metadata kind 'feature'); netlify/functions/events.mjs:110-135 (feed hoists paid rows, splices them out of the organic list); netlify/functions/webhook.mjs:96 (settleFeature); public/studio.html:1403 (artist-facing copy already says it plainly); netlify/functions/_billing.mjs:45 (isVenueOwner, never called in handleFeature)

**Skeptic (high).** I read every file in the chain and could not refute it. The sale is real and live: _featured.mjs:41 FEAT_PRICE = 1000 with SLOTS = 3 (:42); admin.mjs:1451 featureStart takes a hold (:1470) and opens a real Stripe checkout; webhook.mjs:96 settles it; _flags.mjs:46 has featuredShows default: true and its own text says "Artists can pay $10 to put a gig in a city's three Featured shows spots". events.mjs:110-135 reads the paid table and MOVES the bought gig out of d.gigs into d.featured (splice at :130-131). The only visitor-visible string is index.html:485 `<div class="feathead">Featured shows</div>`; my own grep of index.html for featur|promote|paid|sponsor|advert returns nothing else visible (all other hits are source comments at :115, :125, :459, :482-484). My own grep -c on about.html confirms featured=0 and promote=0. There is no terms or privacy page in public/ to carry the disclosure elsewhere. No second code path, no row badge, no tooltip. TWO CORRECTIONS. (1) Softer: the status label FALSE is a category error — "Featured shows" asserts nothing falsifiable; this is misleading by omission, not a false statement. The accuser also skipped two genuine mitigations: the paid rows are segregated into their own section with their own heading and an orange border (index.html:117-124) rather than sprinkled through the organic list, and the heading renders only when a spot has actually been sold (:485 is conditional). (2) Worse, and missed: about.html:593-594 says "What you pay for is your own back office", directly under the heading "Everything the room sees is free. Always." (:591). A $10 featured spot is not back office — it is a paid change to what the public list shows, sold a la carte outside the plans. That IS a falsifiable sentence the code contradicts, and it sits on /about, the primary audited surface. Also unstated: events.mjs:130-131 removes the bought gig from its chronological position, so payment reorders the listing rather than only decorating it. Finally, the proposed wording is slightly wrong: handleFeature (admin.mjs:1404-1478) has no venue-owner exclusion — isVenueOwner (_billing.mjs:45) is never consulted there — so a venue's own event can take a spot and renders as "At the venue", not as an act. "paid by the act" would be inaccurate in that case.

**Fix.** Three edits, not one. (1) index.html:485: "Featured shows" -> "Featured shows · paid placement" — same .feathead styling, and correct for venue-bought spots too, which the proposed "paid by the act" would misdescribe since handleFeature never excludes venue owners. (2) Add one line of fine print under the featured list: "Acts pay $10 to put a show at the top of their city's list for one night. Three spots a night, first come first served. Nothing else about this list is for sale." The last clause is what actually restores trust — it tells the visitor the rest of the ordering is not for sale. (3) The edit that matters most, on the primary audited surface: about.html:594 "What you pay for is your own back office." -> "What you pay for is your own back office — plus, if you want it, $10 to feature one night at the top of your city's list." The artist-facing copy at studio.html:1403 is already plain-spoken; the public page should match it.

## 12. [MAJOR] index.html (what’s-on home) · line 490

> That’s everything in ${city} for the next seven days.

**Verdict:** OVERSTATED, severity minor (down from major; one of the three stated gaps is invalid)

**Evidence.** public/index.html:490 (the sentence); public/index.html:307,408 (the page's own honest wording); netlify/functions/_events.mjs:181 (blank city/country dropped from the index); netlify/functions/admin.mjs:469-470 and public/studio.html:1744-1745 (city/country never required, so a blank-city gig is creatable); netlify/functions/events.mjs:41-50 (artist diary has no city filter, so that gig is still public); netlify/functions/events.mjs:78 (exact string equality on city); netlify/functions/_events.mjs:56-57 and netlify/functions/_maps.mjs:64-73 (no case folding or canonicalisation of city); netlify/functions/events.mjs:8,75 (span is today..today+7 — wider than the seven days claimed, so leg 1 is refuted)

**Skeptic (high).** I tried to kill this one and could not, but one of its three legs is wrong and the severity is inflated.

LEG 1 — WRONG, and it inverts the direction of the error. events.mjs:8 sets WINDOW_DAYS=7 and events.mjs:75 expands `occurrencesFor(events, addDays(from,-1), addDays(from,7))`, so the feed carries today-1 (still-running only, filtered by `o.endsAt <= now` at events.mjs:79) through today+7 — eight forward calendar dates. That means the feed shows MORE than seven days, not fewer. "That's everything for the next seven days" is a completeness claim about a window; a window that is one day WIDER than claimed cannot make the claim false. This is over-delivery, not overstatement. The accuser counted the span correctly and then drew the opposite conclusion from it. Drop this leg entirely.

LEG 2 — HOLDS, and I confirmed it end to end myself. _events.mjs:181 `if (!e.country || !e.city) continue;` skips the event when building the city index. And a blank-city gig is fully creatable: studio.html:1744-1745 validates only venue and date client-side, and admin.mjs:469-470 validates only date and venue server-side (`if (!ev.date) return bad('Pick a date'); if (!ev.venue) return bad('Where is it?')`) — nothing anywhere requires city or country. That gig still renders on the artist's own page, because the artist-diary branch (events.mjs:41-50, `?a=<slug>`) applies no city/country filter at all. So a real gig can exist on myset.vip/<slug> and be structurally invisible to the city feed that says it shows "everything".

LEG 3 — HOLDS. events.mjs:78 `if (o.city !== city || o.country !== country) continue;` is exact string equality, and the stored value is only trimmed and whitespace-collapsed, never case-folded or canonicalised (_events.mjs:56-57, `str(e.city,60)`); normPlace (_maps.mjs:64-73) touches address/mapUrl/lat/lng and never the city. studio.html:1696 is a free-text `<input id="gCity" maxlength="60">` with no autocomplete against existing cities. So "Koh Phangan", "koh phangan" and "Ko Pha Ngan" are three separate index keys and three separate feeds. Partial mitigation the accuser didn't credit: the picker (index.html:322-325) lists every index key with its gig count, so a fan can at least SEE the second spelling — but the endcard still says "everything in Koh Phangan" while the other spelling's gigs sit elsewhere.

THE LEG NOBODY ARGUED, and it's the big one. Both legs 2 and 3 are edge cases next to the plain fact that the index is built exclusively from MySet account holders' own entries — reindexCities is only ever called off an artist or venue write (admin.mjs:489/496/517, venueadmin.mjs:136/146/233, _account.mjs, _venueaccount.mjs). There is no ingestion of anyone else's listings. So on a night when four bars in town have music and one of them has a MySet artist, the page tells the fan "That's everything in Koh Phangan." That single fact justifies the fix on its own, and it is far more likely to bite a real user than a blank city field.

The page's own vocabulary already knows this. index.html:307 says "No gigs listed yet" and index.html:408 says "No one has listed a gig here yet." The one line that drops "listed" is the one under audit — which makes this a slip, not a position.

SEVERITY, though, is overcooked at major. Nothing turns on it: no money, no access, no claim about what the product can do. It is a soft superlative in an end-of-list flourish, on a page that already uses the honest word twice a few lines up. Minor.

Also confirming the accuser's one concession is right: the feed loop at events.mjs:68-86 iterates `for (const id of ids)` with no slice, so there is genuinely no cap. (The 40-id cap at events.mjs:166 `ids.slice(0, 40)` is in countUpcoming, which only feeds the picker's counts — worth a separate look, since a city with more than 40 listers shows an understated number in the dropdown, but it is not this line.)

**Fix.** Name the source of truth rather than just softening the verb. "Listed" alone leaves open "listed where?" — the honest answer is "on MySet", and that is also what makes the sentence survive both the blank-city drop and the spelling split.

Preferred: `That’s everything on MySet in ${city} for the next seven days.`
Shorter alternative if that reads long: `That’s every gig listed in ${city} for the next seven days.`

Either matches the voice already used at index.html:307 and :408. Do NOT touch WINDOW_DAYS or the "seven days" wording — the feed already covers eight forward days, so the copy is conservative there and changing it would only widen a promise that currently costs nothing.

Separately, and outside this line: the exact-string city matching is a data-quality bug, not a copy bug. No wording fix makes "Koh Phangan" and "Ko Pha Ngan" one city. The real repair is a canonical key on write (case-fold, strip punctuation and spaces) with the artist's spelling kept for display — worth filing on its own, at higher severity than this sentence.

## 13. [MAJOR] Head, nav & hero · line 302

> <img src="/about/vote.png" width="640" height="1385" fetchpriority="high" …>

**Verdict:** STALE — confirmed, but on one pillar not three; and the picture has a second, more certain defect the accusation missed: it is MISCROPPED. Severity stays major and the blast radius is wider than stated (the same file is the page's og:image share card).

**Evidence.** public/vote.html:597 (unconditional `<a class="whoami" …><h1>${esc(d.artist)}</h1><span>↗</span></a>`); public/vote.html:124-127 (.whoami CSS — no display:none, and vote.html contains ZERO @media blocks, so the ↗ can never be suppressed); public/vote.html:548-550 (genreBar returns '' when `tags.length<2`); public/vote.html:640 (qvb button) with public/vote.html:70-81 (.qrow is flex; .cnt then .qvb are the LAST children = right edge); public/about/vote.png (read directly — right edge chopped: "Birthday shout" cut mid-word, "Tip Sam" card cut, "Top 3 by votes" reduced to a bare "T", and the vote-count column absent entirely); public/about/studio.png (same 640×1385, correctly framed with margins both sides — so the crop is a defect in vote.png, not the capture pipeline); public/about.html:23 (og:image = this same cropped file) with public/about.html:24 (twitter:card=summary_large_image); public/about.html:102-106 (.phone shows the hero image whole at max-width:300px — no CSS crop, so the chop is baked into the asset)

**Skeptic (high).** I tried to knock this down and could only knock down two thirds of it.

WHAT HOLDS — pillar 1, the ↗ arrow. This one is airtight and I confirmed it independently. public/vote.html:597 renders the artist name as a link with `<span>↗</span></a>` on every single render — no flag, no condition. I checked for an escape hatch and there is none: .whoami span (line 126) has no display:none, and vote.html contains no @media blocks at all, so nothing hides it at any width. The name sits top-left, fully inside the visible area of the capture, and the screenshot shows "Sam Cole" bare. `git show d6ca102:public/vote.html | grep -c whoami` = 0, HEAD = 5. Stale, confirmed.

WHAT DOES NOT HOLD — pillars 2 and 3 are asserted absences the image cannot support.

Pillar 2, the "+" button. The accuser says "the screenshot's queue rows have no button." They cannot know that. .qrow is a flex row (line 70) and the qvb button is its LAST child, after .cnt (lines 79-81) — i.e. hard against the right edge. And the right edge of this PNG is cut off. The vote counts are missing for exactly the same reason, which the accuser never noticed even while quoting alt text that promises a "7". The button probably would appear in a correct capture (`open` is true — the strip says "Voting open" — and queue.length is 3), but "probably would" is not the same as "the screenshot proves it's missing."

Pillar 3, the genre chips. Doubly unprovable. genreBar returns an empty string whenever the show has fewer than two genre tags (lines 548-550), so its absence is not evidence of staleness even in a fresh capture. And it renders below the search box and the sort bar — neither of which is in frame; the image stops at the paywall bar. You cannot cite the absence of something that is below the bottom edge.

WHAT IS ACTUALLY WORSE. The image is chopped on the right. I read the PNG directly: "Birthday shout" is severed mid-glyph at x=640, the "Tip Sam / Say thanks" card is sliced, "Top 3 by votes" survives as a lone "T", and the entire vote-count column is gone. I checked studio.png as a control — same 640×1385, properly framed with margins on both sides — so this is a defect in vote.png specifically, not the capture setup. And .phone (about.html:102-106) displays the hero whole at max-width:300px, so nothing in CSS is doing this; the chop is baked into the file.

Two consequences the finding never reaches. First, the alt text is now false about its own picture: it promises "Wish You Were Here winning the vote with 7" and there is no 7 in the image — a sighted user and a screen-reader user are told different things. Second, about.html:23 sets this same cropped file as og:image with twitter:card=summary_large_image (line 24), so every link preview of the landing page slices a ~1.91:1 band out of a portrait screenshot that is already missing its right edge. The hero is not the only place this file is doing damage.

One small correction to the arithmetic: 20 commits have touched public/vote.html since the capture, not 18. Immaterial to the verdict.

So: not refuted. The status is right, the severity is right, the remedy is right — but the case as written rests two-thirds on absences a cropped image cannot demonstrate, and misses the crop that is the plainest defect in the file.

**Fix.** Still no copy change, and still a re-capture — but fix the crop first, because that is the certain defect, and widen the scope past the hero.

1. Re-capture full-width, not just fresh. The brief "390 CSS px on a DPR-3 phone" would fix staleness and leave the real bug in place if the capture is cropped again. The capture must include the entire viewport width so the vote counts and the "+" button at the right edge of every .qrow are in frame. Match studio.png, which is the same 640×1385 and correctly framed — whatever produced that is the process to reuse. Acceptance test on the new file: the number 7 is visible next to "Wish You Were Here", and the right-hand card in the bottom bar reads "Tip Sam / Say thanks" complete.

2. Seed the demo state so the capture is honest about the current UI. Voting open (so the qvb buttons render), and — only if you want the genre chips in the shot — at least two genre tags, since genreBar suppresses itself below two (vote.html:548-550). Do not treat missing chips as a bug if the demo show has one genre or none; that is correct behaviour.

3. Re-check the alt text against the new image rather than assuming it carries over. Today it names a "7" the picture does not contain. If the re-capture puts the count back in frame the existing alt becomes true again; if not, the alt has to change. Either way it needs a look, and the current finding does not mention it.

4. Give og:image its own asset (about.html:23). A cropped portrait phone shot under twitter:card=summary_large_image gets sliced to a ~1.91:1 band, so the share card for the whole landing page is currently a horizontal sliver of a broken screenshot. A purpose-made landscape card is the fix; at minimum, point og:image at something that is not clipped.

Sequencing note for whoever batches this with claims 42, 48, 50 and 52: the single re-capture does cover them, but only if step 1 is enforced. A fresh-but-still-cropped file would close five findings on paper and fix none of them.

## 14. [MAJOR] Head, nav & hero · line 302

> [the screenshot shows] "More votes — From $3"

**Verdict:** STALE — minor (not "FALSE / major"). A real defect survives, but both of the accuser's stated reasons are wrong or badly overstated.

**Evidence.** public/about/vote.png (image read directly — the dock button reads "More votes / From $3"); public/about.html:302-305 (the HTML itself contains no "$3" and no price claim at all); netlify/functions/_lib.mjs:281-284 (current defaults small 5/$5, big 15/$10); netlify/functions/_lib.mjs:298 (normPacks clamps cents to 100..50000 — $1 floor, NOT $5); public/studio.html:2271 (price input min="1" max="500" step="0.5" dollars — $3 is directly settable); git 0b357b5 (2026-09-02) vs its parent, where DEFAULT_PACKS was small 3 votes/$3, big 9/$7, max 18/$11 — and `ls -la public/about/` dates vote.png 2026-08-31 19:38, i.e. captured under the old defaults; public/vote.html:708 (the "More votes" button renders for EVERY room; only the sub-label switches between 'From '+money(...) and 'Ask '+artistFirst()); netlify/functions/_pay.mjs:52-54 (canTakeMoney); netlify/functions/show.mjs:173; public/about.html:415-418 and :654-657 (the page discloses the payments limitation twice, in its own voice)

**Skeptic (high).** I read the PNG, not just the markup. The screenshot does show "More votes / From $3" — that part is real, and it is stale: vote.png was captured 2026-08-31, and commit 0b357b5 (2026-09-02) replaced the old three-tier defaults (3 votes/$3, 9/$7, 18/$11) with the two-tier 5/$5 and 15/$10. A free artist today runs on defaults (pricing is Plus-gated at admin.mjs:1706-1707), and vote.html:708 computes Math.min over the pack cents, so their room reads "From $5". So the hero advertises a number a day-one artist will not see. That much stands.

But the accusation's headline reason is false. "$3 is not a MySet price and the code says so" — the code says the opposite. normPacks clamps cents to 100..50000 (_lib.mjs:298), and the Studio price field is min="1" max="500" step="0.5" in dollars (studio.html:2271). $3 is a perfectly legal, settable pack price for any Plus artist or the owner. The accuser read the design comment at :277-279 as a rule; it is a note explaining why the third *tier* (the legacy 'max' key) was dropped and the default floor raised, not a prohibition. That is exactly the "comment read as behaviour" trap.

Part (b) is materially overstated. The "More votes" button is NOT founder-only — vote.html:708 renders it for every room whenever the fan is not on unlimited; only its sub-label differs ("From $5" vs "Ask Sam"). Same for "Tip Sam" at :709, which renders always and explains itself in the sheet at :934. So the hero is not "a founder-only screen"; it is the screen every room gets, carrying one founder-only sub-label. And the accuser cites about.html:654-657 as evidence against the page when that passage IS the page disclosing the limitation — it does so twice, at :415-418 ("card payments are the part still being built. They run on the founder's own gigs today") and again in honest note 2. The page never claims the shot is a free artist's first night; the caption at :305 is about the interaction ("That's the whole thing they have to do"), which is true in either payment state.

Also worth correcting: there is no false sentence on the page. Nothing in about.html mentions $3, pack prices, or "Sam" — the only assertion is a ~26px sub-label inside a hero JPEG-scale image. That is a real claim (a picture is a claim) but it is not a major copy failure, and the "40px under 'No card'" framing conflates two different people's money: "No card" at :298 is about the artist's signup, "$3" is what a fan pays.

The accuser's proposed caption fix would introduce a NEW false claim: "The prices are whatever the artist sets" is not true for the free tier, where pricing is locked to the defaults (admin.mjs:1706-1709, PRICE_LOCKED). Do not ship that line.

One thing that IS wider than stated: the staleness is a class, not an instance. Every /about/*.png (vote, ask, fills, studio) was captured 2026-08-31, before the 2026-09-02 defaults change. I checked studio.png and ask.png — they show request/birthday costs of 3 votes, which normAsk still defaults to (_lib.mjs:283-289), so those two are still accurate. vote.png is the only stale one today, but the whole set should be re-shot whenever defaults move.

**Fix.** Re-capture public/about/vote.png against the shipped defaults so the dock reads "More votes — From $5". One image swap, no copy change, and it matches exactly what a free artist's room renders (vote.html:708 → Math.min(500, 1000) with DEFAULT_PACKS).

Do NOT take the accuser's alternative of capturing it with payments off so it reads "Ask Sam" — that would put the hero in direct contradiction with beat 4 at about.html:410-418, which is titled "Money happens without you asking" and shows the tip/pack flow as a feature, and it would sell a weaker product than the one that ships. The page already carries the payments caveat twice in words; it does not need the hero to carry it too.

If the shot genuinely cannot be re-taken, the cheap lever is the alt text at :303, which today says nothing about money — extend it rather than rewriting the caption at :305, and if a caption note is added it must be "Prices shown are the defaults" (true for free artists) and NOT "whatever the artist sets" (false below Plus).

Separately: add a check to whatever ships /about that re-shoots the screenshot set whenever DEFAULT_PACKS or normAsk defaults change in _lib.mjs. This one slipped because a defaults commit landed two days after the captures and nobody re-took them.

## 15. [MAJOR] Head, nav & hero · line 302

> [the screenshot itself, as rendered] every card runs past the right edge of the frame; no vote counts and no '+' vote buttons are visible

**Verdict:** FALSE — major. Upheld, and wider than the accuser stated. I could not find any defense; the crop is baked into the raster, not applied by CSS, and the repo contains its own proof of the intended framing.

**Evidence.** public/about/vote.png (640×1385, opened and viewed directly); public/about.html:301-303 (the img and its alt); public/about.html:102-106 (.phone CSS); public/vote.html:602 (credit pill), :633 (`<div class="cnt"><b class="mono">${s.votes}</b>`), :634-641 (the `qvb` "+" button, gated only on `open`, no flag); contrast public/about/ask.png (same screen, correctly framed) and public/about/studio.png (correctly framed); git: all four PNGs committed d03c033 2026-08-31, `class="qvb"` introduced 190e2b4 2026-09-02.

**Skeptic (high).** I tried to break this finding four ways and it survived all of them.

1. Is the crop a CSS artifact rather than a bad capture? No. public/about.html:105 is `.phone img{display:block;width:100%;height:auto}` — the image is scaled to fit the 300px box, never clipped horizontally. The only crop rule, :106 `.phone.tall img{object-fit:cover;object-position:top}`, is vertical-only and does not even apply here: line 301 is `class="phone"`, not `phone tall`. The cut is baked into the 640px raster.

2. Is the crop deliberate — a stylistic "bleed" off a device frame? No, and the repo proves it. public/about/ask.png is a capture of the same vote page from the same session and it is correctly framed: it shows "Top 3 by votes", the `3/3` credit pill, and "7 votes / 5 votes / 4 votes" down the right rail — exactly the pixels vote.png loses. A deliberate bleed would not be abandoned for the very next screenshot of the same screen. studio.png is also correctly framed. vote.png is the odd one out.

3. Is the page's sentence more carefully worded than the accuser noticed? The opposite — the alt text makes it worse, and the accuser missed this. about.html:303 reads `alt="The voting page: Hey Jude playing now, and Wish You Were Here winning the vote with 7"`. The number 7 is not in the image; the vote-count column is entirely off-frame. So a screen-reader user is told a vote count that no sighted visitor can see. That is a second, independent defect at the same two lines, and it is also evidence of intent: whoever wrote the alt was describing the correctly-framed shot they thought they had captured.

4. Is the problem wider? Yes, in a way the proposed fix does not cover. The "+" vote button the accuser cites (vote.html:640-641) was added in commit 190e2b4 on 2026-09-02. All four screenshots were committed in d03c033 on 2026-08-31 — two days earlier. So ask.png, even though it is correctly framed, is also stale: it shows open voting ("Voting open", `3/3` pill) with vote counts but no "+" on any Up-next row, which today's code renders unconditionally whenever voting is open (the only flag nearby, `voteFinal` at :632, changes wording, not the button). Re-capturing vote.png alone leaves ask.png misrepresenting the current UI.

One correction of detail: the accuser writes "every card runs past the right edge" as if it were a page-wide problem. It is specific to vote.png. studio.png and ask.png frame correctly. That narrows the crop defect to one file while the staleness defect widens to two.

The severity call is right and if anything conservative: this is the hero image, the page's single picture of its one claim, above the fold, with fetchpriority="high".

**Fix.** Re-capture, then fix the two things the original fix would leave broken.

1. Re-capture /:slug/vote with the browser viewport at 390 CSS px so nothing is off-frame, exported at 2x or 3x. Do the same for ask.png in the same pass — it is correctly framed but predates the "+" button by two days, so it misrepresents today's vote page just as badly.

2. Update the hardcoded dimensions. about.html:302 carries `width="640" height="1385"`. Because .phone img sets height:auto (:105), those attributes are what the browser uses to reserve space via aspect-ratio. A re-capture that is wider in content will have a different ratio, so leaving 640×1385 in place trades the crop for a layout shift on the hero. Update the attributes in the same commit as the new PNG, for every image whose dimensions change.

3. Rewrite the alt at :303 to describe what the new capture actually shows, and keep the vote count in it only if the count is now genuinely visible. Right now the alt promises a "7" the image does not contain.

4. Worth confirming while the capture rig is up: studio.png (:390) and fills.png (:580) are also from the 2026-08-31 batch. studio.png framing is fine and the studio UI is unaffected by the qvb change, but if anything else moved in the four days since, re-shooting all four costs one extra minute and retires the whole staleness class rather than one instance of it.

## 16. [MAJOR] Head, nav & hero · line 303

> alt="The voting page: Hey Jude playing now, and Wish You Were Here winning the vote with 7"

**Verdict:** FALSE — confirmed, but severity MINOR, not major. And the accuser has diagnosed the wrong defect: the alt text is right and the image is broken.

**Evidence.** public/about.html:303 (the alt), public/about/vote.png (opened and cropped at 640x1385 — queue rows clipped at the right frame edge, no count column), public/about/ask.png shown at public/about.html:403 (same queue, "Wish You Were Here / Pink Floyd / Winning — plays next" with a clearly rendered "7 votes"), public/about/studio.png at public/about.html:389 ("Start top voted — Wish You Were Here (7)"), public/about.html:106 (.phone.tall max-height:600px crops that line away), public/about.html:23 (og:image = vote.png), public/vote.html:633 (.cnt markup), netlify.toml:4 (publish = "public", no build step)

**Skeptic (high).** I tried to refute this and could not refute the central fact. I opened public/about/vote.png myself: it is 640x1385, the "PLAYING NOW / Hey Jude / The Beatles" card is there, "Wish You Were Here / Pink Floyd" is at position 1 under "Winning — plays next", and the image is genuinely clipped at the right — the card's left rounded corners are present and its right ones are not. I cropped the right band (x 380-640, y 560-1000) and it is empty: no count column, no "+" vote buttons, and "Top 3 by votes" truncated to a bare "T". The markup at public/vote.html:633 puts .cnt after the .m block, so the number does sit off-frame. There is no srcset, no CSS crop on this one (it is .phone, not .phone.tall, so public/about.html:105 renders it whole), and netlify.toml:4 publishes public/ as-is. So there is no other code path. The accusation holds.

But three things are wrong with it, and one of them inverts the fix.

1. The "7" is not fabricated. I found it. public/about/ask.png — used on the very same page at public/about.html:403 — is a correctly framed capture of this exact screen, and it shows "Wish You Were Here / Pink Floyd / Winning — plays next" with a large "7" and "votes" at the right-hand end, above Landslide 5 and Tennessee Whiskey 4. public/about/studio.png (public/about.html:389) independently corroborates it: "Start top voted — Wish You Were Here (7)". The number is true, internally consistent mock data, and visible to sighted users elsewhere on the same page. This is not a fabricated-proof-stat problem, which is what "major" implies on this particular page.

2. A supporting claim is factually wrong. The accuser says "no digit at all beyond the 1/2/3 position badges". vote.png shows "3 votes" under "Request a song", a partial "3 votes" under "Birthday shout", and "From $3" in the bottom bar. Minor, but it is offered as evidence and it does not hold.

3. The real defect is the image, and the proposed fix cements it. vote.png is a broken capture. It is the hero at fetchpriority="high" and it is also the og:image (public/about.html:23), so it is the picture in every social share and link preview of myset.vip/about. The whole vote-count column and every "+" vote button are off-frame — the two elements that make the screenshot legible as a voting page at all. The caption directly beneath it (public/about.html:305) reads "What the room sees. That's the whole thing they have to do", and the thing they have to do is not in the picture. Rewriting the alt text to stop mentioning the 7 makes the page describe the broken crop as if it were intended, and leaves the hero and og:image broken forever.

Worth flagging as a second, separate finding: the only place the "7" is ever visible in the artist screenshot is cropped off by public/about.html:106 (.phone.tall{max-height:600px;object-fit:cover;object-position:top}) — at a 300px box that scales 640x1385 to 300x649 and clips to 600, removing roughly the bottom 105 source pixels, which is exactly where "Start top voted — Wish You Were Here (7)" sits.

So: the finding survives as a fact, downgraded to minor as an alt-text issue, and it should be re-filed against the asset.

**Fix.** Do not weaken the alt text. Replace the image.

Primary fix: re-capture public/about/vote.png at the framing already proven to work — public/about/ask.png is the same screen captured correctly, with the count column and the "+" buttons inside the frame. Once vote.png shows the queue in full, the existing alt at public/about.html:303 becomes true as written, the hero stops being a clipped screenshot, the og:image at public/about.html:23 stops shipping a broken picture into every link preview, and the caption at public/about.html:305 ("the whole thing they have to do") is finally supported by pixels that include the button they tap.

Then tighten the alt for the artists and the song credits, which the current one omits:
alt="The voting page on a phone: Hey Jude by The Beatles playing now, and Wish You Were Here by Pink Floyd winning the vote with 7, marked 'Winning — plays next'"

Fallback only if the image cannot be re-captured: use the accuser's alt, which is accurate for the broken crop — but log the asset as the open defect, because an accurate description of a clipped hero is still a clipped hero and still the og:image.

Separately: public/about.html:106 crops the bottom ~105 source pixels off every .phone.tall image, which is what hides "Start top voted — Wish You Were Here (7)" in studio.png. Worth checking that no other .tall screenshot has its alt-described content in that dead band.

## 17. [MAJOR] Scene & demo · line 333

> This is the real thing, running on this page.

**Verdict:** OVERSTATED — confirmed, severity moderate (not major on the "no API call" axis, but a genuine product-truth contradiction that a two-part fix should close)

**Evidence.** public/about.html:333 (the claim); public/about.html:734-740, :764-775 (local-only widget, zero fetch calls anywhere in the file); public/about.html:768 (un-vote refunds a credit); netlify/functions/_flags.mjs:32 (voteFinal default: true); netlify/functions/vote.mjs:107 (production refuses take-back with 409); public/vote.html:448 (real fans are told votes can't be taken back)

**Skeptic (high).** I tried to break this finding and could not. I did shift what it is actually about.

WHAT I VERIFIED MYSELF

1. The widget is entirely local. `grep -n "api/\|fetch(" public/about.html` returns NOTHING — there is no network call of any kind on the page. Data is four hard-coded objects (public/about.html:734-739), state is three local variables (`rows`, `mine`, `left = 3`, :740), and the whole interaction is one click handler (:764-775). Accuser's line cites check out.

2. The real path is netlify/functions/vote.mjs, and none of it is reachable from about.html: cast ids (:27-33), the 402 no-credits refusal (:120), the 409 window-closed (:80), the read-back retry (:135). Confirmed.

WHERE THE ACCUSER IS PARTLY WRONG (the mitigation)

"None of the product behind it" over-weights the wrong axis. A marketing demo being self-contained is normal and not by itself dishonest — there is no live gig for it to join, and the sentence a reader sees ("Vote and watch the queue move. That's exactly what forty people do at once") describes an INTERACTION, not a server connection. Nobody finishes that paragraph believing they cast a vote in someone's real show. On the "it doesn't call /api" axis alone this would be minor, not major.

WHERE IT IS WORSE THAN STATED (and this is the real defect)

The accuser cited about.html:768 only as evidence the widget is local. They missed that it contradicts the shipped product.

  about.html:768 — `if (mine.has(id)) { mine.delete(id); row.n--; left++; }`
  Tap a voted song again: the vote comes off AND the credit comes back.

Production refuses exactly that:
  netlify/functions/_flags.mjs:32 — `voteFinal` `default: true` ("ON as of 2026-09-02, at Perry's decision")
  netlify/functions/vote.mjs:107 — `if (final) { err = ['Those votes are cast — they stay with the song', 409]; return false; }`
  public/vote.html:448 — what a real fan is told: "Once you confirm, that's final — votes can't be taken back."

So the page says "This is the real thing" over a widget that teaches the one behaviour the product deliberately removed four days before this audit. The sentence at :333 is what makes that load-bearing — it invites the reader to treat what they just did as product truth. That is the harm, and it is a behavioural contradiction, not merely an architectural one.

NON-MATERIAL divergences I checked and am NOT counting: `left = 3` vs the default `freeCredits: 5` (_lib.mjs:176) — artist-settable (admin.mjs:1830-1835) and the page's copy only ever says "a few free votes", so no claim is broken. Tie-break: demo sorts count-then-title (:745), real sorts count-then-first-vote-timestamp-then-title (_lib.mjs:795-797) — invisible to a reader. And "Starting a song gives everybody theirs back" (:333 block, :756) is TRUE: `play`/`playTop` set `resetVotes` and call `clearAllFanVotes` (admin.mjs:1782, :1808, :2001).

The comment at :731-733 is not behaviour and I did not treat it as such — but it is telling that the author's own private wording is the accurate one.

**Fix.** Two parts — the accuser's wording fix alone leaves the widget teaching a refund the product refuses.

1. public/about.html:768 — make the demo match shipped behaviour. Replace the toggle-and-refund branch with a no-op (or a brief "that's final" nudge), so a second tap does nothing:
   `if (mine.has(id)) return;`
   Keep the "Voted" pill. This costs one line and removes the only actual falsehood.

2. public/about.html:333 — then the sentence only needs narrowing, not gutting:
   "Not a video — the vote board itself, running right here. Vote and watch the queue move. That's exactly what forty people do at once."
   (If part 1 is skipped, fall back to the accuser's wording: "This is a working model of the vote board, running on this page." — weaker, but at least it stops asserting the divergent behaviour is real.)

Also worth a second look while in there: the static no-JS fallback at :338-352 shows a four-song board with no vote buttons, which is fine, but its counts (5/4/2/1) must stay in step with SEED at :734-739 or the two states disagree.

## 18. [MAJOR] Scene & demo · line 334

> That's exactly what forty people do at once.

**Verdict:** STALE, severity minor (downgraded from major). Two of the four grounds hold, one is flatly wrong, and one was mis-analysed — but the core drift is real, so the finding survives.

**Evidence.** public/about.html:332-334 (headline "Tap a song." + the lede), :354, :740 (left = 3), :745 (demo sort), :767-768 (second tap refunds); public/vote.html:411-422 (openVote opens a sheet), :477-479 (Confirm), :503-506 (confirmVote mints a cast id); netlify/functions/vote.mjs:28 (cast id), :105 ("Those votes are cast — they stay with the song", 409); netlify/functions/_flags.mjs:27-37 (voteFinal default: true); netlify/functions/_lib.mjs:176 (freeCredits: 5), :390, :712 (costOf), :792-798 (rankSongs ties on first-vote stamp, then title); public/studio.html:2241 (freeCredits chips are 1, 2, 3, 5, 10 — 3 is a real setting)

**Skeptic (high).** I opened every file cited and checked each of the four grounds independently.

HOLDS (1) — the gesture. In the room a tap does not cast. public/vote.html:411-422 openVote builds a sheet with a quantity stepper; :477-479 is the Confirm button; :503-506 confirmVote closes the sheet, mints a cast id and only then calls vote(). The demo on about.html casts on the first tap (:763-770). The page's own headline is literally "Tap a song." (about.html:331), so the mismatch sits directly under the strongest form of the claim. Real.

HOLDS (2) — finality. _flags.mjs:27-37 ships voteFinal with default: true, and the comment says the default is deliberately in code rather than in the Blobs document so production behaviour is reviewable in the diff. vote.mjs:105 refuses the take-back with a 409. The demo's second tap silently un-votes and hands the credit back (about.html:767-768). Under a lede that says "This is the real thing", a demonstrated behaviour is a claim. Real.

REFUTED (3) — the allowance. The accuser reads the demo's `left = 3` against `freeCredits: 5` as a discrepancy. It is not. freeCredits is per-show and artist-set: admin.mjs:1830-1835 writes it, and studio.html:2241 offers 1, 2, 3, 5, 10 as one-tap presets — 3 is an ordinary real-show value, not a stale one. The page never states a number in prose either: about.html:354 and :761 both say "a few free votes", and :625 says the artist sets how many. 5 is a default, not a fact about every room. This ground should be dropped entirely.

MIS-ANALYSED, and actually WORSE than stated (4) — the tiebreak. The accuser files this as a minor pricing/ordering nuance. It is the demo's headline output. The demo sorts by count then title (about.html:745). Seed counts are 5/4/2/1, so a reader's very first tap on Landslide makes it 5-5 with Wish You Were Here; "Landslide" wins on localeCompare, jumps to position 1, takes the lead styling, and the footer declares "Landslide is winning, so that's what plays next" (:759). In the room rankSongs (_lib.mjs:792-798) breaks that tie on first-vote timestamp, so Wish You Were Here — stamped earlier — holds the top spot and the challenger does not leapfrog. So in three taps the demo shows the opposite winner from the one the app would show, on the one question a vote board exists to answer. That is the widest part of this finding and it is not fixable with copy.

NOT DISCREPANCIES — the 402 "no-credits" and 409 "Voting is closed right now" paths. A demo that does not exercise an error state is not making a false statement about it. Drop these.

So: the sentence is genuinely overclaiming — "the real thing" and "exactly" are both doing more work than the code supports on gesture and finality — but the accusation's evidence is half wrong, and its severity of major overstates a marketing adverb on a toy demo where nothing turns on money, access or safety. Minor, and stale rather than false: git show d03c033 confirms the toggle and freeCredits 3 were accurate the day it was written.

**Fix.** Two parts, and the copy alone is not enough.

COPY (about.html:333-334) — shorter than the proposed fix, and it drops "the real thing" and "exactly" rather than explaining them away:

  "This is the vote board, working, on this page. Tap and watch the queue move. In the room it's the same with one extra step — a sheet asks how many votes to put on the song, and once you confirm they stay there."

That covers the gesture and finality in one clause each. Do NOT add anything about free-vote counts (the "a few" wording is already correct and the number is artist-set) and do not add error states.

CODE (the part copy cannot fix): the demo still contradicts the app in two places a reader can trigger.
  1. about.html:767 — remove the second-tap refund branch (`if (mine.has(id)) { ... left++ }`) and make an already-voted row inert, or the page keeps demonstrating a take-back that vote.mjs:105 refuses.
  2. about.html:745 — change the tiebreak from `x.t.localeCompare(y.t)` to a stable seed order so an incumbent holds a tie, matching rankSongs (_lib.mjs:792-798). One line, and it stops the demo naming the wrong winner on the reader's first tap.

If only one thing ships, ship #2 — a wrong winner is a worse lie than a missing sheet.

## 19. [MAJOR] Scene & demo · line 337

> 3 votes left

**Verdict:** STALE — confirmed, but severity minor-to-moderate, not major. The number is wrong; the sentence around it is not.

**Evidence.** public/about.html:337 ("3 votes left" static) and public/about.html:740 (let ... left = 3) vs netlify/functions/_lib.mjs:176 (freeCredits: 5 in defaultShow) and _lib.mjs:390 (non-number coerced to 5). Gate verified myself: netlify/functions/admin.mjs:1706 sets canPrice from planForArtist(aid).limits.pricing, admin.mjs:1830-1831 refuses the freeCredits action when !canPrice, and netlify/functions/_plan.mjs:66 sets pricing: false on free (true only at :90 plus / :108 pro). History verified: d03c033 added public/about.html and at that commit _lib.mjs:106/:234 read 3; 0b357b5 flipped both to 5.

**Skeptic (high).** I tried to break this and could not. Every leg of it holds when read directly.

The number really is stale. defaultShow ships freeCredits: 5 (_lib.mjs:176) and normShow coerces anything non-numeric back to 5 (_lib.mjs:390). A free artist cannot move it: admin.mjs:1706 computes canPrice from limits.pricing, admin.mjs:1830-1831 bails with a 402 when that is false, and _plan.mjs:66 has pricing: false on free. So five is what a new room actually starts at, and the page's widget says three.

Three defences I tested and had to drop:

1. "The demo is a fan mid-round who already spent two." No. left = 3 is the initial state at about.html:740 with `mine` empty and the seed counts untouched (about.html:735-738), and the static fallback at :337 shows the same 3 with no votes cast. It reads as the starting allowance both times.

2. "The demo never claims fidelity." It does, explicitly — about.html:332, "This is the real thing, running on this page."

3. "Some other path makes 3 true." I grepped every freeCredits reference in netlify/functions and public. Nothing writes 3; the only writer is admin.mjs:1830-1835, whose own fallback when the posted value is unparseable is 5.

What I would soften: the accuser calls this major, and I do not think it earns that. The prose is more careful than the accusation credits. The only words on the page are "Everyone in the room gets a few free votes" (about.html:354 and :761) — no number is promised, and no plan, price or purchase decision turns on 3 vs 5. The error is also conservative: it understates how generous the product is. And the demo was never a replica anyway — the real page says "You have N votes right now" (public/vote.html:443), not "N votes left", so the chip at :337 is already a stylisation.

What I would harden, and what the proposed fix misses: the accuser did not overreach elsewhere, and I checked. about.html:404's alt text "three votes each" for a request or a birthday shout-out is CORRECT — _lib.mjs ships requests: { on: false, cost: 3 } and birthdays: { on: false, cost: 3 } right below the freeCredits line. And the two shipped screenshots that could have carried a stale counter do not: public/about/vote.png is cropped before the credits chip and shows "Request a song · 3 votes" (correct), and public/about/studio.png shows no free-vote number. So this is exactly one number in one widget, not a pattern.

But the proposed one-line fix has a bug of its own, which is the real thing to add here — see betterFix.

**Fix.** Do not just change 3 to 5. The demo seeds only four songs (about.html:735-738) and the click handler is a one-vote-per-song toggle (about.html:766-770), so a reader can spend at most four credits. Starting at 5 makes `left` unable to reach 0, which silently kills three things that are currently reachable: the "No votes left" counter state (about.html:755), the disabled Vote buttons (about.html:752), and — the one that matters commercially — the out-of-credits footer copy at about.html:757-758, "Out of votes — in the room you could buy a few more, or wait: the next song refreshes everyone." That is the page's only demonstration of the paid-vote upsell, and the proposed fix would turn it into dead code without saying so.

So the correct change is three edits, not two:
1. about.html:740 — left = 3 → left = 5.
2. about.html:337 — the static no-JS counter "3 votes left" → "5 votes left".
3. Add a fifth (and ideally sixth) song to SEED at about.html:735-738, and mirror it in the static no-JS list at about.html:339-352 so the two agree. Six rows keeps the exhaustion path reachable with a credit to spare, which is how a real room behaves.

Cheaper alternative if nobody wants to touch the song list: drop the hard number from the chip entirely and let the demo stay a demo — render "Votes left: N" seeded from a single DEMO_CREDITS = 5 constant used by both :337 and :740, so the two can never drift again. That single-constant point is worth doing either way; the drift happened precisely because the number lives in two places.

Finally, whoever makes this edit should add a note next to _lib.mjs:176 that public/about.html mirrors this default, because the same drift will happen the next time the number moves.

## 20. [MAJOR] Scene & demo · line 740

> let rows = SEED.map((s) => ({ ...s })), mine = new Set(), left = 3, bump = null;

**Verdict:** STALE — confirmed, but severity minor, not major. And the proposed fix is defective as written: applied verbatim it breaks the demo's own out-of-votes ending.

**Evidence.** public/about.html:337 ("3 votes left") and :740 (left = 3); netlify/functions/_lib.mjs:176 (freeCredits: 5) and :390 (same coercion); netlify/functions/admin.mjs:1706 (canPrice gate covers 'freeCredits') and :1830-1836 (the setter, refused when !canPrice); netlify/functions/_plan.mjs:69 (free: pricing: false); public/studio.html:2241 (chips 1,2,3,5,10 wrapped in lock('pricing')); git show d03c033:netlify/functions/_lib.mjs:106 (freeCredits: 3) and git show 0b357b5 -- netlify/functions/_lib.mjs (3 -> 5, 2026-09-02). Counter-evidence I also checked: public/about.html:354 and :761 say only "a few free votes" (true of 5); admin.mjs:1839 case 'unlimited' sits OUTSIDE the canPrice list, so a free artist CAN remove the limit entirely.

**Skeptic (high).** I could not refute the factual core, and I tried three ways.

The number really is stale. _lib.mjs:176 and :390 both say 5. A free artist cannot move it: admin.mjs:1706 puts 'freeCredits' behind canPrice, _plan.mjs:69 sets pricing:false on free, and studio.html:2241 wraps the chips in lock('pricing'). The history claim holds exactly as stated — d03c033 had freeCredits: 3, and 0b357b5 flipped it to 5 on 2026-09-02, three days after about.html was written against it.

I also could not dismiss it as set dressing. The page demonstrably does mirror real defaults in its numbers: the alt text at :404 says "three votes each" for requests and birthdays, and _lib.mjs:182-183 sets both costs to 3. So the 3 in the widget was tracking the product, not decorating it.

But "major" is too strong, for three reasons the accuser did not weigh.

First, no prose on the page is falsified. The only sentences about the allowance — :354 and the live version at :761 — say "Everyone in the room gets a few free votes." That is true of five. The page never tells the reader a number in words. The lede at :333 says "This is the real thing, running on this page", and the sentence after it defines what "the real thing" is pointing at: "Vote and watch the queue move." It is a claim about the interaction, and that claim is honest — the queue really does reorder. The invented songs and the invented starting counts of 5/4/2/1 sit under the same sentence and nobody would call those discrepancies.

Second, 3 is a legal room. studio.html:2241 offers 1, 2, 3, 5, 10 as chips and a free-text field up to 999, so a Plus or Pro artist can genuinely run a room on three votes. The page is showing a configuration the product supports, not one it forbids.

Third, the accuser's own premise is a little too tidy. "Five is what every free room gets" is not quite right: admin.mjs:1839 handles 'unlimited' outside the canPrice list, and studio.html:2249-2251 exposes that switch to everyone with the note "Free on every plan — it is your show, not a price." So a free artist can hand the room unlimited votes. There is no single universal number to be wrong about.

Net: a real drift worth fixing, of the same weight as a screenshot showing an old default — worth correcting, not worth calling the page misleading. And the fix needs the fifth song or it costs more than it repairs.

**Fix.** Change both, but add a fifth song at the same time, or you delete a state the page needs.

public/about.html:740 -> `let rows = SEED.map((s) => ({ ...s })), mine = new Set(), left = 5, bump = null;`
public/about.html:337 -> `<span id="dcount">5 votes left</span>`
SEED (public/about.html:734-739) gains a fifth row, e.g. `{ id: 'e', t: 'Hallelujah', by: 'Jeff Buckley', n: 1 },` and a matching fifth `.drow` in the no-JS fallback list at :341-352.

Why the fifth song is not optional: `mine` is a Set and the click handler at :769-773 spends at most one credit per song, so four songs can never cost more than four credits. Set `left = 5` against four rows and `left` bottoms out at 1. That makes three things unreachable — the `disabled` button at :751, the "No votes left" counter at :755, and the footer line at :758 that is the only place on the page where the reader is shown that running out is when you can buy more. Today, at `left = 3`, a reader hits that wall on their third tap and reads the monetisation line. The fix as proposed silently removes the page's own demonstration of how MySet makes money.

## 21. [MAJOR] Scene & demo · line 752

> ${mine.has(s.id) ? 'Voted' : 'Vote'}

**Verdict:** STALE, major

**Evidence.** public/about.html:768 (`if (mine.has(id)) { mine.delete(id); row.n--; left++; }`); public/about.html:331-333 ("This is the real thing, running on this page… That's exactly what forty people do at once."); netlify/functions/_flags.mjs:28-36 (voteFinal default: true); netlify/functions/vote.mjs:101-104 (clearing path → 409 'Those votes are cast — they stay with the song' when final); public/vote.html:632 ("tap to add more" under voteFinal); public/vote.html:717-722 (dis is affordability-only: `!open||(!c.unlimited&&c.remaining<cost&&!(s.mine&&!fin))`, label `Voted ×n`); public/vote.html:421-423 (openUnvote is skipped entirely when finNow; a held song re-opens the cast sheet)

**Skeptic (high).** I tried to break this three ways and could not.

1. Is there another code path making the refund true? Only one: voteFinal is a flag with a real "off" answer (_flags.mjs:36, per-artist override read at vote.mjs:45). But the default lives in code and is `true`, shipped deliberately so "what production does is reviewable in the diff" (_flags.mjs:29-33). Default-on is what a room sees. That is a weak mitigation, not a refutation.

2. Is the accuser reading a doc or comment as behaviour? No. Every citation is executable code I read: the demo's handler at about.html:768 really does `row.n--; left++`, and vote.mjs really returns the 409 before any mutation when `final`.

3. Is the page more carefully worded than noticed? The opposite. The cited line 752 is actually CORRECT on its own — the product's own fan row renders exactly `Vote` / `Voted` / `Voted ×n` (vote.html:722). The defect is entirely at 768. And about.html:331-333 asserts fidelity out loud — "This is the real thing, running on this page… exactly what forty people do at once" — so the demo is not offered as an illustration the reader should discount. That raises, not lowers, the severity. The page's prose never separately claims votes can be taken back (grep found nothing at 355 or elsewhere), so the damage is confined to the interaction — but the interaction is the page's headline proof.

Where the accuser IS wrong is the fix. "Add the button state 'disabled' once voted" would make the demo diverge from the product in a NEW direction. Under voteFinal the product deliberately keeps a voted song tappable: vote.html:632 labels it "tap to add more", the button's only disable condition is affordability (:719-720), and the comment at :718-719 states the rule — "Voting is never a dead end: under finality a held song can still be added to, it just cannot be taken back." openVote (:421-423) skips the un-vote sheet under finality and re-opens the cast sheet so the fan can stack more credits on the same song. Disabling would also kill the demo's most-repeated gesture, which is the one thing the section is for.

**Fix.** Make the second tap ADD, not refund — which is what the room actually does and keeps the demo tappable.

In the handler at about.html:768, replace the refund branch so both branches spend a vote:
  if (left <= 0) return;
  if (!mine.has(id)) mine.add(id);
  row.n++; left--; row.mineN = (row.mineN || 0) + 1;

At 751-752, mirror the product's real label and its real disable rule (affordability only, never "already voted"):
  <button class="vb ${mine.has(s.id) ? 'on' : ''}" data-id="${s.id}" ${left <= 0 ? 'disabled' : ''}>${mine.has(s.id) ? (s.mineN > 1 ? 'Voted ×' + s.mineN : 'Voted') : 'Vote'}</button>

Then let the footer carry the rule instead of the button. In the `mine.size` branch at 761, append: "Votes stay with the song once they're in — <b>starting a song gives everybody theirs back</b>." That keeps the true refresh mechanic (the round reset is real) while removing the false take-back, and it states finality at the moment the reader has just cast, which is where the product states it too (vote.html:448).

Do NOT change the seed footnote at 355 to a finality line as proposed — it is the pre-interaction state, and its current sentence about free votes returning at each song is accurate.

## 22. [MAJOR] The night 1-2 · line 365

> None of them need you.

**Verdict:** FALSE, severity MODERATE (downgraded from major) — the overclaim is real, but it is one beat not two, the page corrects itself two lines later, and the proposed fix is incomplete because it leaves line 366 standing.

**Evidence.** public/about.html:365 (H2) and :366 (the lede "Everything below runs itself while you're on stage"); public/about.html beat 2 body "One tap starts the top song and hands everybody fresh votes"; public/about.html demo footer (~line 354) "Starting a song gives everybody theirs back"; public/studio.html:1923 (act('playTop')) and :1931 (act('play',{song})); netlify/functions/admin.mjs case 'play' with show.nowPlaying/resetVotes at :1782 and case 'playTop' resetVotes at :1808; netlify/functions/_auto.mjs:5 (imports only startShow, endShow) and :133 (autoStart); netlify/functions/admin.mjs:951 ASK_ACTIONS; netlify/functions/_lib.mjs:182 requests:{on:false,cost:3}; public/studio.html:2276 "Both are off until you switch them on"; netlify/functions/_flags.mjs FLAGS (voteFinal, featuredShows only); netlify/functions/_plan.mjs:130 NOT_BUILT

**Skeptic (high).** I tried to refute this and could not. The code facts check out under my own reading: play and playTop are reachable only as artist taps (studio.html:1923, 1931 -> admin.mjs 'play'/'playTop', resetVotes at :1782/:1808), _auto.mjs imports exactly startShow and endShow (:5) and only ever starts or ends a show, there is no auto-advance flag (_flags.mjs declares only voteFinal and featuredShows), and no autoAccept/autoPlay/autoAdvance exists anywhere in functions or public (I grepped). Critically, the page contradicts its own H2 in the same section: beat 2's body says "One tap starts the top song and hands everybody fresh votes." So "None of them need you" is not defensible as written.

But the accusation is over-graded and wrong in three places.

1. It is ONE beat by default, not two. The accuser says "two of the five beats require the artist repeatedly, all night." Requests ship OFF: _lib.mjs:182 sets requests:{on:false,cost:3}, and studio.html:2276 tells the artist "Both are off until you switch them on" — which is exactly what about.html beat 3 already discloses ("they only exist if you switch them on"). Beat 3 asks nothing of an artist who never opted in. So by default exactly one of the five beats needs the artist.

2. Severity is moderate, not major. The page names the tap three times inside the same stretch of copy: the demo footer ("Starting a song gives everybody theirs back"), the section lede at 366 ("You start the show and play"), and beat 2 itself. Nobody finishes this section believing songs advance themselves. That makes it a headline overclaim the page immediately walks back — a copy-consistency defect — not a false capability claim that leaves a reader misinformed about what they are buying.

3. The proposed fix is broken and would make the page worse. It replaces only the H2 at 365 and leaves line 366 untouched: "Everything below runs itself while you're on stage." That is the SAME claim in more mechanical words ("runs itself"), and it is the stronger of the two. Swapping 365 to "Your part is one tap between songs" while 366 still says everything runs itself puts a flat contradiction one line under the new headline. 365 and 366 have to move together — the accuser did not notice the lede at all.

One smaller correction: "The only automation in the whole app is show START and show END" is too sweeping. autocron.mjs also heals the index, purges, and sweeps clips (:58-81); decline refunds votes automatically (admin.mjs:877-885); a play resets the room's votes automatically (:1782). None of these advance a song, so the load-bearing part of the accusation stands — but the wording as filed is not accurate.

**Fix.** Fix 365 AND 366 together, keeping Perry's contrast (no maths in the gap, no jar, no chasing) rather than flattening it:

  line 365: <h2>Five things happen. Your&nbsp;part is one tap.</h2>
  line 366: <p class="lede">You start the show and play. Between songs you tap the top-voted song — the rest runs itself while you're on stage.</p>

This is literally true against the code: one tap per gap (admin.mjs 'play'/'playTop', which is also what refreshes the room's votes at :1782/:1808), beats 1, 4 and 5 need nothing, and beat 3 only exists if the artist switched requests on (_lib.mjs:182). It also stops the H2 fighting beat 2's own "One tap starts the top song," and it keeps the tap framed as the artist's moment of control instead of as a chore.

If Perry wants the punchier headline, "Five things happen. Four of them without you." is also true by default and keeps the rhythm — but the lede at 366 still has to lose "Everything below runs itself."

## 23. [MAJOR] The night 1-2 · line 366

> Everything below runs itself while you're on stage.

**Verdict:** MISLEADING, severity minor (not FALSE/major)

**Evidence.** public/about.html:365-366 (the h2 + lede), 386-387 (beat 2's own "One tap starts the top song"), 399 ("they only exist if you switch them on"), 415-418 (the payments caveat); netlify/functions/admin.mjs:1771-1799 (only 'play'/'playTop' move the song; grep for autoplay/autoAdvance/autopilot across netlify/functions/*.mjs and public/studio.html returns nothing); netlify/functions/_lib.mjs:181-182 (requests/birthdays default off); netlify/functions/_pay.mjs:34-38, 53-55 (Connect gate); public/studio.html:1923-1924 (the button is labelled "Start top voted", not "Play"); netlify/functions/admin.mjs:880-884 (the decline refund is NOT unconditional).

**Skeptic (high).** One of the three legs holds; the other two do not test the sentence they are aimed at.

LEG (a) HOLDS, and I confirmed it independently rather than taking the cite. admin.mjs:1771-1799 is the only place show.nowPlaying moves, under actions 'play' and 'playTop', both artist-initiated. I grepped netlify/functions/*.mjs and public/studio.html for autoplay/auto_play/autoAdvance/auto-advance/autopilot and got zero hits — there is no second code path that advances a song on its own. I also checked the charitable reading, that "you start the show and play" might be naming the tap: it is not. The Studio's own label for the tap is "Start top voted" / "▶ Start" (studio.html:1923-1924), while "Start the show" (studio.html:1895) is a separate button that only flips status pre→live. So the lede names one artist action and the product needs two. Beat 2 admits the second one plainly two paragraphs later — "One tap starts the top song" (about.html:386) — which is what makes this an internal contradiction rather than a lie to the reader.

LEG (b) DOES NOT HOLD. The default is real (_lib.mjs:181-182, confirmed, and show.mjs:140-141 gates the fan card on it), but flipping a toggle in Settings is a pre-show setup act, not on-stage work, so it does not falsify "runs itself while you're on stage". More to the point, the same beat says it out loud at about.html:399 — "they only exist if you switch them on". A reader cannot be misled by a fact the paragraph volunteers. The accuser's second cite, studio.html:2276, is Studio marketing copy, not a gate — using it as evidence of app behaviour is reading copy as code.

LEG (c) DOES NOT HOLD against this sentence. The _pay.mjs gates are exactly as described (34-38, 53-55), but they are an availability problem, not a "does it run itself" problem — when payments are on, the fan buys or tips with zero artist involvement, which is what the beat claims. And about.html:415-418 discloses the gate in the same beat, in the same voice, unprompted. Citing a page's own inline caveat as proof the page is dishonest inverts the test.

So the accusation is right about the mechanism and wrong about the scale: it triples the count by folding in two disclosed facts, and the residue is a lede that overstates for two paragraphs before its own body copy corrects it. That is a copy-tightness defect, minor.

Where the accuser under-read: L365, the h2 "Five things happen. None of them need you", is the flatter falsehood — it admits no exception at all, where the lede at least carves out "you start the show and play". The fix must touch both lines or the contradiction survives. And the accuser missed a genuinely undisclosed carve-out one beat over (see betterFix).

**Fix.** Fix the heading and the lede together — the heading is the more false of the two and the accuser left it standing. Replace about.html:365-366:

  h2:   "Five things happen. One tap is your whole job."
  lede: "You start the show and play. Between songs, one tap starts the winner — everything else below happens on its own."

Do NOT bolt beat 3's toggle or beat 4's Connect caveat into this lede. Both are already disclosed in their own beats (L399 "they only exist if you switch them on"; L415-418 "card payments are the part still being built"), and the accuser's fix leaves the contradicting h2 at L365 in place while making the sell-line heavier than it needs to be.

Separately, and NOT part of this finding: beat 3's "Say no and their votes come straight back, automatically" (about.html:400-401) is not unconditionally true. admin.mjs:880-884 refunds nothing when the declined request came from an earlier show, on purpose ("those credits have already refreshed, so refunding would mint votes"). That is a real, undisclosed carve-out and a better finding than two of the three legs the accuser raised.

## 24. [MAJOR] The night 3-5 · line 398

> never money

**Verdict:** IMPRECISE — severity minor-to-moderate, not OVERSTATED/major. The factual half ("Requests cost votes") is true; the conclusion ("nobody's buying their way onto your setlist") is also true and enforced by artist-only approval; only the word "so" is unearned, because it credits the wrong mechanism and the page discloses vote-buying 13 lines later anyway.

**Evidence.** public/about.html:398 (the claim) and public/about.html:411 (the same page disclosing vote purchases); netlify/functions/_requests.mjs:94-95 (single pool: freeCredits + me.extra) with netlify/functions/_lib.mjs:718 (creditsUsed folds fan.spent in); netlify/functions/_pay.mjs:126-133 (purchase lands in me.extra, untagged); netlify/functions/pay.mjs:84 ('votes' kind); netlify/functions/_lib.mjs:281-284 ($5/5 votes) vs _lib.mjs:286 (3-vote default request cost); netlify/functions/admin.mjs:878 + netlify/functions/_requests.mjs:156,181 (only the authenticated artist can accept a request or attach it to a song — no auto-accept exists); netlify/functions/_pay.mjs:52-54 and public/vote.html:917 (no Stripe Connect, no vote-buying at all)

**Skeptic (high).** I tried to break this one and could not. Every link in the accuser's chain is real and I read each file myself:

1. The buy button exists and is one tap from the vote screen — public/vote.html:708 renders "More votes" in the dock, openBuy() at public/vote.html:917-931 offers the artist's packs, default $5 / 5 votes and $10 / 15 votes (netlify/functions/_lib.mjs:281-284).
2. Money becomes credits with no provenance mark — netlify/functions/pay.mjs:84 builds the 'votes' Checkout Session, and netlify/functions/_pay.mjs:126-133 grants it as `me.extra = (me.extra || 0) + granted`. There is no flag anywhere saying a credit was bought.
3. The request budget is that same single pool — netlify/functions/_requests.mjs:94-95: `const total = show.freeCredits + (me.extra || 0); if (creditsUsed(me, show) + cost > total) { short = true; ... }`, and netlify/functions/_lib.mjs:718 confirms `creditsUsed` mixes song votes and `fan.spent` (which is exactly what requests debit) into one number.
4. Default request cost is 3 votes (normAsk's `dflt = 3`, netlify/functions/_lib.mjs:286), so the cheapest $5 pack more than covers a request.

So the money → votes → request path is genuine. I could not find any gate, tag, or separate ledger that would make the page's "never money" true in effect.

BUT the accuser's status label is wrong on two counts, and that is where the finding is weaker than stated.

(a) The conclusion the sentence draws is actually TRUE, and enforced. Nothing reaches the setlist without the artist. resolveRequest is exported from _requests.mjs:156 and called from exactly one place — netlify/functions/admin.mjs:878, the artist-authenticated admin endpoint (`requireArtist`, admin.mjs:2) — and attachSong (_requests.mjs:181) is likewise admin-only. There is no auto-accept anywhere in the functions or in studio.html; I grepped for it and got zero hits. So "nobody's buying their way onto your setlist" is literally accurate: a fan with $5 buys a submission, not a slot. What is broken is the connective "so" — the page gives the wrong reason for a true claim. That is a non-sequitur, not a false promise.

(b) The page does not hide the mechanism. Fifteen lines later, public/about.html:411 says outright "Out of votes and desperate for one more song? They can buy a few." The app tells fans the same thing (public/vote.html:758). A reader cannot finish this page believing money never turns into votes — the two beats sit in the same scroll.

One further narrowing the accuser missed: this only bites for artists who have finished Stripe Connect. netlify/functions/_pay.mjs:52-54 gates every payment on `canTakeMoney` = STRIPE_SECRET_KEY AND (platform owner OR show.pay.ready), and vote.html's openBuy short-circuits on `ST.paymentsEnabled`. For an artist who has not connected Stripe, money genuinely cannot become votes and the sentence is true as written.

Net: the finding survives, but as an IMPRECISE causal clause, not a MAJOR overstatement. The promise the artist actually cares about — you control your setlist — is kept by the code. Fix the "so", keep the claim.

The accuser's proposed fix is broadly right; mine is tighter and keeps the "switch them on" clause that theirs quietly rewrites.

**Fix.** Change only the false-cause clause and keep the sentence's shape and the switch-it-on promise:

"A song you haven't got listed. A happy birthday for Maya at table four. Requests cost <em>votes</em>, and you say yes or no to every one — so nothing lands on your setlist without you. They only exist if you switch them on."

Why this beats the accuser's version: it keeps "Requests cost votes" (verified true — _requests.mjs:94, cost is denominated in votes and no Stripe call touches request.mjs), swaps the unearned "never money, so..." for the reason that is actually enforced in code (artist-only resolveRequest, admin.mjs:878), and preserves "they only exist if you switch them on", which the accuser's replacement drops. It also stays in Perry's voice — one clause changed, no defensive explaining, and it does not argue with the very next beat of his own page, which sells vote packs.

## 25. [MAJOR] The night 3-5 · line 415

> One caveat, up front: card payments are the part still being built.

**Verdict:** STALE — confirmed, severity major, and the scope is WIDER than the accuser stated: three separate paragraphs on the page are false, not one.

**Evidence.** public/about.html:415-418 and :654-657 and :658-660 (the two other stale claims); netlify/functions/_pay.mjs:52-54 (canTakeMoney = platform owner OR show.pay.ready) and :44-50 (connectReady reads the real connect doc); netlify/functions/_connect.mjs:249-289 (syncFromStripe + mirrorToShow, the one writer of show.pay); netlify/functions/pay.mjs:160-174 (direct charge on the artist's own account with application_fee_amount); netlify/functions/admin.mjs:1105-1130 (payStart / payDashboard, offered to any signed-in artist, no plan or flag gate); public/studio.html:1551-1576 (the "Set up card payments" card, drawn for everyone except the platform owner); netlify/functions/_billing.mjs:121-163 (startCheckout, mode:'subscription') + netlify/functions/admin.mjs:78-82 + public/studio.html:3580 (planCheckout wired to the button)

**Skeptic (high).** I tried to save the page and could not. Four defences were available and all four fail.

1. "Another code path makes it true." No. The money gate is one function: _pay.mjs:52-54. It returns true for `isPlatformOwner(aid)` OR for any artist whose show record carries `pay.ready`. That mirror has exactly one writer, _connect.mjs:271-289, fed from Stripe's own `charges_enabled` at :249-267. So a second artist who finishes onboarding takes money. pay.mjs:160-174 then creates the charge ON their connected account with MySet's fee off the top. There is no founder-only branch anywhere.

2. "The onboarding is hidden behind a flag or a paid plan." No. _flags.mjs declares exactly two flags, voteFinal and featuredShows — neither touches payouts. admin.mjs:1105-1130 serves payStart to any signed-in artist with no plan check, and studio.html:1554 draws the card for everyone EXCEPT the platform owner (`if(p.platformOwner) return ''`) — the precise opposite of "it only runs on the founder's gigs".

3. "The accuser read a comment as behaviour." This one is the interesting trap, and it cuts the other way. _pay.mjs:4-27 still carries a long comment saying Connect "is not built" and telling you to grep for `application_fee_amount` and find nothing. That comment is the stale thing; the code under it at :44-54 does the real check, and `application_fee_amount` is right there in pay.mjs:166 and :215. Anyone defending the page from that comment would be doing exactly what I was asked to watch for.

4. "The sentence is more carefully worded than it looks." It is worded MORE strongly than the accuser quoted. Line 656 says outright "no other artist can take money through MySet" and "the 10% above currently applies to nobody". Both are flatly false — the 10% free-tier cut is charged as a real Stripe application fee (_connect.mjs cutOf + feeCents, applied at pay.mjs:174).

WIDER THAN STATED, and this is the part the accuser missed. Line 415 ends "the note under the plans says exactly where that stands", pointing at honest-note 2 (:654-657) — which is the same false claim in stronger words. And honest-note 3 (:658-660) says "Plus and Pro can't be bought yet. There's no checkout, so nobody is being charged for anything." That is false too: _billing.mjs:121-163 creates a real `mode:'subscription'` Checkout Session, admin.mjs:78-82 serves it, studio.html:3580 has the button, and there is a billing portal, invoices, plan changes and a retention coupon behind it. So fixing line 415 alone leaves the page contradicting itself two screens later and still under-selling the product in the same dangerous direction.

One accuracy note on the proposed fix: it is true on every point I checked (Stripe-hosted onboarding, MySet never sees bank details, buttons stay off until Stripe says charges_enabled). What it omits is the thing _connect.mjs:31-35 insists must never be hidden — with direct charges Stripe's own ~2.9% + 30c comes off the ARTIST, so "2% to MySet" is not "you keep 98%". The landing page can leave that to the Studio, but the honest-notes block must stop claiming the cut applies to nobody.

**Fix.** Fix all three places, or the page contradicts itself.

1) Replace the grey paragraph at about.html:415-418 with:
"One thing to set up: to take card money you connect a payout account once. Stripe hosts it, it takes a few minutes, and MySet never sees your bank details. Until that's done the tip and vote buttons stay switched off in your room, so nothing can land in the wrong account."
(Drop the trailing cross-reference to "the note under the plans" — there is no longer a caveat down there for it to point at.)

2) Replace honest-note 2 at about.html:654-657 with a note that is still honest but true:
"2 · Money runs through your own account, not ours. You connect a payout account with Stripe once, and from then on your fans' tips and vote packs land in your balance, with MySet's cut taken off the top as a visible fee. Stripe's own card fee (about 2.9% + 30c) comes off your side too, so 2% to MySet isn't the same as keeping 98% — the Studio says the same thing before you switch it on."

3) Replace honest-note 3 at about.html:658-660: Plus and Pro CAN be bought — there is a real subscription checkout, a billing portal and invoices. Keep only the part that is still true: the four Pro extras marked Soon (promote, analytics, presskit, branding) are designed and not built, which _plan.mjs's NOT_BUILT block confirms.

Separately, and not a page fix: netlify/functions/_pay.mjs:4-27 still tells the next reader that Connect does not exist and to grep for proof. That comment is what would make a future audit repeat this mistake. Worth flagging to whoever owns the repo.

## 26. [MAJOR] The night 3-5 · line 415

> [the caveat is set at font-size:15px in var(--muted), four lines below an unqualified claim]

**Verdict:** STALE — severity major, and wider than the accusation states: the same false claim appears twice more on the page in full-size body copy

**Evidence.** public/about.html:415-418 (grey caveat), public/about.html:654-657 and :658-660 (the "honest notes"); netlify/functions/_connect.mjs:130-190 (ensureAccount + onboardingLink — Express onboarding for any owner), _connect.mjs:56 (connectUsable), _connect.mjs:78-86 (feeCents applies the plan cut); netlify/functions/admin.mjs:1105-1123 (action payStart — no owner and no plan gate) and admin.mjs:79-84 (action planCheckout → _billing.startCheckout); netlify/functions/_pay.mjs:52-54 (canTakeMoney = key && (owner || show.pay.ready)); netlify/functions/show.mjs:173 (paymentsEnabled); public/studio.html:1551-1577 (the "Set up card payments / Start with Stripe" card, shown to everyone EXCEPT the founder) and studio.html:3580 (planCheckout call site); netlify/functions/_plan.mjs:64 (free cut: 0.10) and _plan.mjs:130 (NOT_BUILT = promote, analytics, presskit, branding — payments are not in it)

**Skeptic (high).** I tried to save the page and could not. I checked every escape route.

1. Is there a code path that makes the page's sentence true? No. Stripe Connect direct charges are fully built and shipped (commit 6fc0e33, 2026-09-02; extended by 6fae274, 2026-09-04). Any signed-in artist — not the founder, who is explicitly excluded at studio.html:1554 because he predates Connect — sees "Set up card payments · Start with Stripe" in the Studio Money tab (studio.html:1560-1577), which POSTs action payStart (admin.mjs:1105-1123). That handler has no isPlatformOwner check, no plan check, no feature-flag check: it creates an Express account (_connect.mjs:130-160) and returns a Stripe-hosted onboarding link (_connect.mjs:165-180). When Stripe reports chargesEnabled, connectUsable is true, show.pay.ready is mirrored, canTakeMoney returns true (_pay.mjs:52-54), show.mjs:173 sends paymentsEnabled:true, and vote.html renders live Buy-votes and Tip buttons that check out on the artist's own connected account (pay.mjs:173, :209). So the payouts plumbing is finished, and it is finished for everyone, not for the founder.

2. Is the accuser reading a comment as behaviour? This is the one real trap on this file, and it cuts the other way. The 28-line header comment at _pay.mjs:4-31 still says in plain English that Connect is not built, that grepping for application_fee_amount and accounts.create "will find nothing", and that connectReady "returns false for everyone today". All of that is false — the grep returns _connect.mjs:142, :170 and pay.mjs:64, :209. The stale comment is the likely ancestor of the stale page copy, but the code beneath it contradicts it, and the code is the truth. Nothing in the comment rescues the page.

3. Is the page more carefully worded than noticed? No — it is less careful. "They run on the founder's own gigs today" is a specific factual assertion about who can be paid, and it is wrong. The cross-reference in the caveat ("the note under the plans says exactly where that stands") is intact, so the page is internally consistent, but consistently wrong.

4. Could this be an unmerged branch or a page that predates the change? No. about.html has been edited three separate times AFTER Connect shipped (81f5b44, 421d5ac, 9e9fde4 — all 2026-09-05) and both paragraphs were left untouched. This is genuine drift, not a race.

Where I go further than the accusation: it treats this as one stale grey paragraph. It is three stale statements, and the two worse ones are in full-size body copy, not in the palest type.
  • about.html:654-657, honest note 2, at full size: "Card payments aren't on yet… Until that's finished no other artist can take money through MySet, which also means the 10% above currently applies to nobody." Both halves are false. The 10% free-tier cut is live: PLANS.free.cut is 0.10 (_plan.mjs:64) and feeCents turns it into a real application_fee_amount on every direct charge (_connect.mjs:78-86, pay.mjs:209). This is worse than an out-of-date feature note — it tells a prospective free artist that MySet takes nothing from their tips today, when MySet takes a tenth of them.
  • about.html:658-660, honest note 3: "Plus and Pro can't be bought yet. There's no checkout, so nobody is being charged for anything." There is a checkout: admin.mjs:79-84 action planCheckout calls _billing.startCheckout, wired to a button at studio.html:3580, with a Stripe billing portal, plan changes, retention and invoices alongside it.
So the honesty section — the part of the page whose whole job is to be trustworthy — now contains the page's three least accurate sentences.

One thing the accusation gets right that is worth keeping: the typography verdict is inverted, and the proposed remedy (restyle) would have been the wrong move even when the finding was fresh. You do not fix a false sentence by changing its font size.

**Fix.** Do not restyle anything, and do not fix only line 415. Three edits, in this order of importance:

1. about.html:654-657 — replace honest note 2 outright. It is the load-bearing lie and it is in full-size copy. Something like: "2 · Card payments need a one-time setup. Stripe handles the checks and holds your bank details, not MySet; until you've finished it your room's tip and vote buttons stay off, so nothing can land in the wrong account. Once it's done, MySet's cut is 10% on free, 2% on Plus, 0% on Pro — and Stripe's own card fee (about 2.9% + 30c) comes off your side, so 2% is not the same as keeping 98%." That last clause is not optional: it is the exact point _connect.mjs:31-35 says the copy has to make so an artist doesn't discover it from a payout.

2. about.html:658-660 — honest note 3 is also false. Plus and Pro have a real Stripe subscription checkout. Either delete the note or replace it with what is genuinely still unbuilt, which is the NOT_BUILT list at _plan.mjs:130: promote, analytics, presskit, branding.

3. about.html:415-418 — delete the grey caveat entirely rather than replacing it. Once note 2 is honest, this paragraph has nothing left to say: the two sentences above it at :411-412 are true, and the paragraph's only remaining job was to point at a note that will now say the right thing. A one-time bank setup is not a caveat that belongs mid-story in the "Money happens without you asking" beat — it is a signup detail, and the plans section is where it lives. If a pointer is wanted at all, one clause on line 414 does it: "…the exact moment they want to use it — after a one-time Stripe setup, which the plans section explains."

Then check the rest of the page for the same drift: this copy predates three separate shipped money features, so the pricing table's own cut figures should be re-read against _plan.mjs:64, :87, :97 before anyone signs off.

## 27. [MAJOR] The night 3-5 · line 416

> They run on the founder's own gigs today

**Verdict:** STALE — severity major, and wider than the accuser scoped it (the same false claim appears twice more, one of them stronger, plus a material omission about who pays Stripe's fee)

**Evidence.** /Users/perryidyll/Docs/MySet/public/about.html:416 (the audited line) and :654-657, :658-660 (the same claim, stated harder); /Users/perryidyll/Docs/MySet/netlify/functions/_pay.mjs:52-54 (canTakeMoney = owner OR show.pay.ready); /Users/perryidyll/Docs/MySet/netlify/functions/_connect.mjs:271-289 (mirrorToShow writes show.pay.ready = connectUsable for ANY owner), :12-41 (direct charges, "closes INVARIANT 0r"), :107-115 (stripeFor: opts.stripeAccount absent only for the founder), :331-340 equivalent connectStatus platformOwner note; /Users/perryidyll/Docs/MySet/netlify/functions/admin.mjs:1093-1102 (payStatus), :1105-1122 (payStart → ensureAccount + onboardingLink, any artist), :1578-1591 (payStart is gated to the ACCOUNT owner role, not isPlatformOwner); /Users/perryidyll/Docs/MySet/public/studio.html:1551-1578 (the Getting-paid card, hidden ONLY for platformOwner) and :2168 (it renders in the money tab for every artist); /Users/perryidyll/Docs/MySet/netlify/functions/pay.mjs:155-183 (direct charge on conn.acct, fail-closed, then feeCents applies the plan cut); /Users/perryidyll/Docs/MySet/netlify/functions/_plan.mjs:64,87,97 (cut 0.10 / 0.02 / 0); /Users/perryidyll/Docs/MySet/netlify/functions/_plan.mjs:130 NOT_BUILT = ['promote','analytics','presskit','branding'] — payments are NOT in it; /Users/perryidyll/Docs/MySet/netlify/functions/_billing.mjs:120-152 and admin.mjs:79 'planCheckout' (subscription checkout exists, so honest note 3 is stale too)

**Skeptic (high).** I tried hard to save this sentence and could not.

1. I looked for a second path that makes it true. There isn't one. Stripe Connect is fully built and reachable end to end: the Studio draws a "Set up card payments" card for every artist except the founder (studio.html:1553 `if(p.platformOwner) return ''`, rendered at :2168), payStart creates a real Express account and returns Stripe's hosted onboarding link (admin.mjs:1105-1122), the webhook and syncFromStripe write chargesEnabled and mirror it onto the show record (_connect.mjs:249-289), canTakeMoney then answers true for that artist on the hot poll (_pay.mjs:52-54), and pay.mjs:155-172 creates the checkout ON that artist's account and fails closed if the mirror and the connect doc disagree. Nothing there is behind a feature flag — _flags.mjs declares only voteFinal and featuredShows, and _plan.mjs:130 NOT_BUILT lists promote/analytics/presskit/branding, not payments.

2. I checked whether the accuser was reading a comment as behaviour. It is the opposite: the long comment at the top of _pay.mjs:4-31 still says "Stripe Connect ... is not built" and "Returns false for everyone today", and that comment is what is stale — the code five lines below it (:52-54) and _connect.mjs contradict it. If anything, an agent reading only the comment would have concluded the page was RIGHT. The founder branch is a legacy carve-out for an account that predates Connect and charges on the platform account (_connect.mjs:107-115), not the only way to be paid, exactly as the accuser says.

3. I checked whether payStart is founder-only. It is not. admin.mjs:1578-1591 gates it on `me.role !== 'owner'` — the account's own owner seat, the same gate as accountDelete — not isPlatformOwner. Any artist who signed up can onboard.

4. I checked whether the sentence is more carefully worded than it looks. "They run on the founder's own gigs today" could just about be read as a statement of current fact (maybe nobody has onboarded yet), but it is welded to two claims that are plainly false in code: "card payments are the part still being built" and "switch on for everyone once the payouts plumbing is finished." The plumbing is finished and shipped (commit 6fae274, 2026-09-04, "Plans you can pay for, venues that get paid"); about.html was last touched 2026-09-05 and still says it isn't.

The real problem is wider than the finding states. about.html:654-657 repeats it as one of three "honest notes," in stronger and more damaging terms: "Until that's finished no other artist can take money through MySet, which also means the 10% above currently applies to nobody." Both halves are false — an onboarded artist takes money on their own account, and the 10% is charged as a real Stripe application fee on every free-plan charge (pay.mjs:180-183 with _plan.mjs:64). A page whose stated purpose is honesty is under-charging its own product in public and telling artists a fee is theoretical when the code bills it. Note 3 at :658-660 ("Plus and Pro can't be bought yet ... nobody is being charged for anything") is stale in the same way — _billing.mjs:120-152 creates subscription Checkout Sessions and admin.mjs:79 exposes planCheckout.

And one omission the accuser did not reach: about.html never contains the word "Stripe" anywhere. It quotes 10% / 2% / 0% with no mention that under direct charges Stripe's own ~2.9% + 30c comes out of the ARTIST's side. _connect.mjs:31-35 says in as many words that the copy "has to say so rather than let an artist discover it from a payout," and the Studio does say it (studio.html:1567, connectStatus.stripeFeeNote). The landing page does not. That is the same class of harm as the stale clause — an artist reads "2%" and a $5 pack lands as ~$4.45 — and it will still be there after the stale clause is deleted.

**Fix.** Deleting the clause at :416 is right but not sufficient — it fixes one of three places and leaves the worst one standing.

1. about.html:414-418 — drop the caveat paragraph entirely, as night-3-5-23 proposes. Beat 4 is about the moment money happens in the room; a plumbing status note never belonged there. If a line is wanted, make it true and short: "Card payments switch on for you once Stripe has checked your details — Stripe handles that, and MySet never sees your bank details."

2. about.html:654-657 — honest note 2 must be rewritten, not left. Replace with the fee truth, which is a better note anyway: "Card payments run on your own Stripe account, so the money is legally yours. Stripe checks your details before they switch on. MySet's cut (10% free, 2% Plus, 0% Pro) comes off the top as a visible platform fee, and Stripe's own card fee — about 2.9% + 30c — comes out of your side too, because the payment is yours."

3. about.html:658-660 — honest note 3 needs re-verifying against _billing.mjs before it ships; "there's no checkout, so nobody is being charged" is contradicted by admin.mjs:79 / _billing.mjs:146. That is out of this finding's scope but it is in the same paragraph block and will be shipped in the same edit, so it should be checked in the same pass rather than left as the only remaining false line under a heading that says "honest."

4. Separately, and not a copy edit: the comment block at _pay.mjs:4-31 still tells the next reader that Connect is not built and that connectReady "returns false for everyone today." That comment is what makes this class of error repeatable. Worth a note to whoever owns the repo, though I have changed nothing.

## 28. [MAJOR] The night 3-5 · line 417

> switch on for everyone once the payouts plumbing is finished

**Verdict:** STALE — confirmed, severity major, and the fix must be widened to about.html:654-657 (the same claim, stated harder) as well as :417. about.html:658-660 is a separate stale claim (billing checkout is built) that should be filed on its own.

**Evidence.** netlify/functions/_pay.mjs:52-54 (canTakeMoney: any artist with show.pay.ready); netlify/functions/_connect.mjs:141-151 (Express account + daily payout schedule), :57, :78-85, :250-292; netlify/functions/pay.mjs:160-181 (direct charge on the artist's account + application fee); netlify/functions/admin.mjs:1105-1131, :1540, :1581 (payStart open to every account owner); public/studio.html:1554-1577, :1600-1608 (the Studio card everyone but the founder sees); public/about.html:416-418 and :654-657 (the stale claims); stale comment that does NOT govern behaviour: netlify/functions/_pay.mjs:4-35

**Skeptic (high).** I tried to defend the sentence and could not. I looked for (a) a plan gate on money, (b) a founder-only gate on Connect onboarding, (c) a kill flag, (d) a comment-vs-code mix-up by the accuser, (e) an unbuilt payout leg. None exists.

WHAT THE CODE ACTUALLY DOES, end to end, for a non-founder artist:
1. Any account OWNER (not just the founder) can start onboarding. `payStart` is listed in PROFILE_ACTIONS (netlify/functions/admin.mjs:1540) and in OWNER_ONLY (admin.mjs:1581) — owner-gated, never plan-gated and never founder-gated. The Studio draws the card for everyone EXCEPT the founder (public/studio.html:1554 `if(p.platformOwner) return ''` — the founder is the one excluded, because his account predates Connect), with a real country picker and a "Start with Stripe" button (studio.html:1560-1577, 1600-1608).
2. `ensureAccount` creates a real Express account with card_payments + transfers requested and `settings.payouts.schedule.interval = 'daily'` (netlify/functions/_connect.mjs:141-151). `onboardingLink` (:165) and `dashboardLink` (:183) are both wired to live endpoints (admin.mjs:1105-1131).
3. `syncFromStripe` mirrors chargesEnabled/payoutsEnabled onto the show record (_connect.mjs:250-268, mirrorToShow :270-292).
4. `canTakeMoney(aid, show)` is `STRIPE_SECRET_KEY && (isPlatformOwner(aid) || show.pay.ready)` (netlify/functions/_pay.mjs:52-54). So the room's tip and vote-pack buttons come on for ANY artist whose Stripe account is live — show.mjs:173, stage.mjs:82, community.mjs:75 all read it.
5. `pay.mjs:160-181` then creates the Checkout Session ON that artist's account (`stripeAccount: conn.acct`) with `application_fee_amount` from `feeCents` (_connect.mjs:78-85). Money is the artist's; MySet's cut comes off the top.

The accuser is NOT reading a comment as behaviour — if anything the comments would have supported the page. The header block of _pay.mjs (lines 4-35) still says "Stripe Connect ... is not built — grep the tree for application_fee_amount, transfer_data, stripeAccount ... and you will find nothing" and "Returns false for everyone today". That comment is now false: every one of those strings is in the tree. The accuser correctly ignored it and read the executable lines below it.

THE FINDING IS WIDER THAN FILED. Line 417 is the softest of three statements of the same dead fact, and the accuser only flagged the soft one:
- about.html:654-657, "Three honest notes" #2: "Card payments aren't on yet ... Until that's finished no other artist can take money through MySet, which also means the 10% above currently applies to nobody." Both halves are now false in code — any onboarded artist can take money (_pay.mjs:52-54), and the 10% IS charged, as an application fee, on every free-plan direct charge (_plan.mjs:63 cut 0.10 → _connect.mjs:78-85 → pay.mjs:181). This is the version a reader will quote back, and it is a stronger claim than the one that was filed.
- Adjacent, and a separate finding worth spawning: about.html:658-660 note #3, "Plus and Pro can't be bought yet. There's no checkout, so nobody is being charged for anything" — netlify/functions/_billing.mjs:120-160 creates a subscription-mode Checkout Session, reachable from the Studio (public/studio.html:3580 → admin.mjs:79 `planCheckout`). Also stale.

Both files are committed on `main`, which is production: _connect.mjs landed in 6fae274 (2026-09-04), and about.html was last touched a day LATER in 9e9fde4 (2026-09-05) without the caveat being updated — so this is copy that outlived its own repo, not an uncommitted branch.

One thing the accuser overstates slightly, and the fix should carry it: payments are not "on for everyone" automatically. Each artist must connect Stripe and pass its checks first (connectUsable = acct && chargesEnabled, _connect.mjs:57), and pay.mjs:168 fails closed with 503 until then. So the honest replacement is "you switch it on yourself", not "it is on". Severity: agree major.

**Fix.** Do not just delete the caveat — the true mechanism is a selling point, and it carries a fee disclosure the artist must hear from MySet first (_connect.mjs:71-76, 313-317).

about.html:415-418 (the beat-4 caveat) → "Card money is yours, not ours. You connect your own Stripe account in the Studio, Stripe checks who you are, and payouts land in your bank daily. Stripe's own card fee (about 2.9% + 30 cents) comes off your side, because the payment is legally yours — MySet's cut comes off the top."

about.html:654-657 (honest note 2) → replace the whole note with what is actually still rough: "Card payments need a Stripe account of your own. It takes a few minutes in the Studio and Stripe does the checking. Until Stripe says yes, the tip and vote-pack buttons stay off in your room, so nothing can land in the wrong account. MySet's share is 10% on Free, 2% on Plus, nothing on Pro."

And file separately: about.html:658-660 says there is no checkout for Plus and Pro; _billing.mjs:120-160 plus studio.html:3580 say there is.

## 29. [MAJOR] The night 3-5 · line 417

> the note under the plans says exactly where that stands

**Verdict:** WRONG — not merely stale. Severity major, and wider than reported: the audited sentence at about.html:414-417 is itself a false factual claim, not just an honest pointer to a stale note.

**Evidence.** public/about.html:414-417 (the caveat), public/about.html:654-659 (notes 2 and 3); refuted by netlify/functions/pay.mjs:160-168 (direct charge allowed for any artist with connectUsable; 503 only when not connected), netlify/functions/pay.mjs:181 and :209 (feeCents -> application_fee_amount), netlify/functions/_plan.mjs:63 (PLANS.free.cut = 0.10), netlify/functions/_connect.mjs:134-180 (ensureAccount + onboardingLink, full Express onboarding), netlify/functions/admin.mjs:1104-1122 (payStart, no plan gate or allowlist), public/studio.html:1574 ("Start with Stripe"), netlify/functions/_billing.mjs:121-160 (startCheckout, real subscription Checkout Session), netlify/functions/admin.mjs:79-85 (planCheckout action), public/studio.html:3565 and :3580 ("Upgrade to Plus/Pro" -> planCheckout -> location.href). No feature flag gates any of it: netlify/functions/_flags.mjs:27-50 declares only voteFinal and featuredShows. Git: Connect shipped 6fc0e33 (2026-09-02), billing shipped 6fae274 (2026-09-04); public/about.html was edited afterwards in 67f1d36 (09-04), 81f5b44, 421d5ac and 9e9fde4 (all 09-05) without the money claims being corrected. Contributing cause: netlify/functions/_pay.mjs:30-32 still comments "Returns false for everyone today because Connect is not built yet" above connectReady, which no longer behaves that way.

**Skeptic (high).** I read the gates myself rather than trusting the accusation. Every capability claim in the note is refuted in code. pay.mjs:160-168 refuses a charge only when the artist has NOT connected; any artist who completes Stripe Express onboarding (admin.mjs payStart at :1104-1122, reachable from the plain "Start with Stripe" button at studio.html:1574, with no plan gate, allowlist or feature flag) charges directly on their own account, and pay.mjs:181/:209 then applies PLANS.free.cut = 0.10 as a real application_fee_amount. Likewise _billing.mjs:121-160 is a complete subscription Checkout, wired to a live "Upgrade to Plus/Pro" button at studio.html:3565/:3580.

I looked hard for a rescue and found none. There is no flag gating either path (_flags.mjs:27-50 declares only voteFinal and featuredShows). startCheckout's only gates are STRIPE_SECRET_KEY and an existing subscription. The accuser was not reading a comment as behaviour — they cited executing code — although a stale comment at _pay.mjs:30-32 ("Returns false for everyone today because Connect is not built yet") sits directly above the gate and is very likely how the page's copy drifted.

Two corrections to the finding, one in each direction.

TOO GENEROUS: the finding says the cross-reference "is honest ... but both are stale together." It is not honest. The two sentences before the cross-reference make the same false claim in the page's own voice — "card payments are the part still being built. They run on the founder's own gigs today and switch on for everyone once the payouts plumbing is finished" (about.html:414-416). The plumbing is finished. So the proposed fix, which rewrites notes 2 and 3 and leaves 414-417 untouched, would leave the audited line still false. Any fix must rewrite the caveat too.

TOO STRONG: "the 10% above currently applies to nobody" is a claim about the world (has any free artist actually onboarded?), not about the code. The repo proves the fee CAN and WILL apply on any connected free artist's charge; it cannot prove it currently does. That single clause is unprovable from code alone. The two adjacent claims — "no other artist can take money" and "There's no checkout" — are capability claims and are flatly refuted.

AGGRAVATING: this is not passive drift. about.html was edited four times (09-04 and three times on 09-05) after both features shipped, and the money claims survived every pass. A public marketing page is currently understating a shipped product and misstating how money moves.

VERIFIED IN THE FIX'S FAVOUR: the four "Soon" chips at about.html:653-656 do match NOT_BUILT at _plan.mjs:130 exactly (promote, analytics, presskit, branding), so keeping that sentence is correct.

**Fix.** Three edits, not two — the proposed fix misses the line actually under audit.

1) THE CAVEAT, about.html:414-417 (replace the whole grey paragraph):
"One caveat, up front: taking card payments needs a one-time setup. You connect a payout account with Stripe — a few minutes, hosted by them, and we never see your bank details. Until that's done nobody in your room is asked for money. Everything that doesn't involve a card works the moment you sign up."
Drop the "the note under the plans says exactly where that stands" pointer entirely. Once the caveat states the real condition, the cross-reference has nothing left to do, and a pointer is exactly the construction that let two copies of this fact drift apart in the first place.

2) NOTE 2, about.html:654-657:
"<b>2 · Card payments need a one-time setup.</b> You connect a payout account with Stripe — a few minutes, hosted by them, and we never see your bank details. Once it's done, tips and vote packs go straight to your own account and our cut comes off the top. Stripe's own card fee (about 2.9% + 30c) comes off your side too, because the payment is legally yours — so 2% to MySet is not the same as keeping 98%."
The added Stripe-fee sentence is not padding. _connect.mjs:31-35 says in terms that an artist must hear this from MySet rather than discover it from a payout, and connectStatus already ships that exact wording to the Studio (_connect.mjs:317-319). The plans table on this page sells "2% cut ... stay yours" (about.html:630), which is the precise sentence _connect.mjs warns about. A fix that corrects one money claim while leaving that one standing is half a fix.

3) NOTE 3, about.html:658-659 — the accuser's version is right, keep it:
"<b>3 · Plus and Pro are new.</b> You can subscribe from the Studio. The four Pro extras marked <em>Soon</em> are on the way, not shipped; everything else above is built and running today."

Two housekeeping items that belong in the same pass:
- Delete or rewrite the stale comment at _pay.mjs:30-32. It is the sentence the landing page paraphrases, and while it stands the copy will drift back.
- Note 1 still claims "It has run one real gig" (about.html:652-653). Not checkable from code, but it is adjacent, it is in the same honesty block, and it should be confirmed against reality before this block is shipped again rather than being the one claim nobody re-read.

## 30. [MAJOR] What changes & proof · line 470

> Why: every night is recorded

**Verdict:** IMPRECISE (minor) — not FALSE/major. True for every night an artist actually runs; the only real gap is the free plan's four-shows-a-month cap, which the same page states at about.html:603.

**Evidence.** public/about.html:470 (the claim); public/about.html:603 and 657-659 (the page's own disclosure, and "no checkout" so the cap has no purchasable exit); netlify/functions/_plan.mjs:33 (free gigs: 4), :82, :96 (Infinity on paid), :154 (founder bypass), :182 (promo comp); netlify/functions/_lifecycle.mjs:36, :40-43, :134 (the 402 refusal); netlify/functions/_history.mjs:120 (nothing-to-file guard), :138 (songsPlayed = played.length), :191, :298-306, :375-378 (why studio.html:2084 is legacy-only); public/studio.html:2084

**Skeptic (high).** The finding survives, but only on one of its three legs, and it is overstated as "FALSE / major".

WHAT I CONFIRMED MYSELF (leg 1 — the only real one). netlify/functions/_plan.mjs:33 sets free `gigs: 4`. netlify/functions/_lifecycle.mjs:40-43 (`gigCapFor`) returns that cap for anyone who is not `isPlatformOwner`, and _lifecycle.mjs:134 refuses inside the CAS: `if (gigCap !== null && used >= gigCap) { err = [CAP_REFUSAL(gigCap), 402]; return false; }`, with the wording at _lifecycle.mjs:36-37. Nothing in _flags.mjs gates this off. So a free artist's fifth night in a UTC month cannot be started, and a night that never starts is never archived (archiveShow bails on `!show.startedAt`, _history.mjs:120). The accusation is in fact WIDER than stated: about.html:657-659 says Plus and Pro "can't be bought yet — there's no checkout", and _plan.mjs:82/96 are the only rows with `gigs: Infinity`, so today the only ways past four are being the founder (_plan.mjs:154) or a 100% promo code the founder mints (_plan.mjs:182+). For every ordinary artist alive right now, "every night" is capped at four a month with no purchasable exit.

WHAT I REFUTE (legs 2 and 3).
Leg 2 is not a counterexample. _history.mjs:120 refuses only a night with no start time, or with no song played, no leftover vote, no phone in the room and nothing now-playing — i.e. literally nobody there and nothing done. The card's promise is "how many people were there, what they wanted, what they paid". A night with zero of all three has no proof to file. The code's own comment calls it "a night where nothing happened is not a night", and healHistory (_history.mjs:317-318) keeps the two rules in agreement. Citing this as a failure of "recorded" is lawyering a case the page never opened.
Leg 3 is wrong on the mechanism and the evidence. I traced every writer of `stats.songsPlayed`: _history.mjs:138 sets it to `played.length` where `played` is `(show.log||[]).map(...)`, and readHistShow (_history.mjs:375-378) returns the raw detail document with no merge — the index row's `up()` max at _history.mjs:191 never touches the detail. So the branch at public/studio.html:2084 CANNOT be produced by today's archive path; `played: []` forces `songsPlayed: 0`, which renders the other string ("No songs were started from the Studio during this show."). The accuser's cited production shape (played: [] with songsPlayed: 10) is only reachable for a legacy document copied in from the pre-multi-tenancy flat `hist_<showId>` keys by healHistory (_history.mjs:298-306) — a data artifact of one old night, not app behaviour, and exactly the "doc/production anecdote read as code" trap. Even in that case the night IS recorded — people, votes, money — only the titles are missing, which is not what the card claims.

NET. One genuine gap, and it is a plan-cap gap the same page discloses 133 lines further down ("4 shows a month — up to 200 people in the room at each", about.html:603). That makes it an internal inconsistency in the copy, worth a five-word qualifier — not a major falsehood. Downgrade to IMPRECISE / minor.

**Fix.** Keep Perry's rhythm and close only the real gap, one word longer than the original: "Why: every night you run it is recorded, and it's yours to show." (The accuser's "every night you run through the Studio is filed" swaps warm copy for back-office jargon — "filed" is a filing cabinet, and "run through the Studio" is internal vocabulary a musician reading the page has not met yet.) If the four-a-month cap is to be surfaced at all, it belongs in the pricing card that already carries it, not in a benefit anchor — do not stack the caveat here.

## 31. [MAJOR] For venues · line 518

> Any gig at your place shows up on your page by itself

**Verdict:** OVERSTATED — confirmed, severity major (and slightly wider than the accuser stated)

**Evidence.** /Users/perryidyll/Docs/MySet/netlify/functions/venue.mjs:71, :73, :84, :85; /Users/perryidyll/Docs/MySet/netlify/functions/_venues.mjs:200-208; /Users/perryidyll/Docs/MySet/netlify/functions/_verify.mjs:237; /Users/perryidyll/Docs/MySet/netlify/functions/_events.mjs:163, :181; /Users/perryidyll/Docs/MySet/public/studio.html:1696-1698, :1744-1745; /Users/perryidyll/Docs/MySet/public/venue-studio.html:400, :434, :1105, :1192, :1756; /Users/perryidyll/Docs/MySet/public/about.html:518

**Skeptic (high).** I tried to refute this and could not. Every limb checks out in code I read myself, and the product's OWN in-app copy contradicts the landing page — the strongest single piece of evidence against "Any".

WHAT I CONFIRMED

1. Case/spelling sensitivity on the place is real. venue.mjs:84 is a raw `o.city !== venue.city || o.country !== venue.country`. Nothing normalises casing on either side: the artist's city/country are plain free-text inputs (studio.html:1696-1698 — no datalist, no select) and normEvent only collapses whitespace and truncates. The venue's own city is free text too (venue-studio.html:1108), only `clean()`ed in createVenue (_venues.mjs:82, :96). So "koh phangan" really never matches "Koh Phangan". This is not a style quibble — the SAME repo compares the same field case-insensitively one file over: _verify.mjs:237 uses `venueKey(e.city) === venueKey(venue.city)`. venue.mjs:84 is the odd one out.

2. The sameVenue containment gate is real and read correctly. _venues.mjs:205 `const distinctive = s.length >= 8 || s.split(' ').length >= 2;` — "The Anchor" keys to "anchor" (6 chars, one word, leading "the" stripped at :198), not distinctive, so :206 returns false against an artist's "Anchor Bar". Note the comment at :196 says "at least five characters" while the code requires 8 — the comment is stale; the accuser cited the code, not the comment.

3. MAX_ARTISTS is real (venue.mjs:18, :73) — and WIDER than stated. The city index holds VENUE owners in the same array as `v_<venueId>` (_events.mjs:163, written by venueadmin.mjs:136/146). venue.mjs:73 slices to the first 60 ids BEFORE anything filters those out, and :78 then calls artistById on them, which reads the artists registry (_auth.mjs:84-87), returns null, and :79 `continue`s. Every venue in the city that lists its own quiz night burns one of the 60 slots that could have carried an artist gig.

4. Blank city/country means never indexed: _events.mjs:181 `if (!e.country || !e.city) continue;`, and the artist form enforces only venue and date (studio.html:1744-1745 — the accuser's :1740-1741 pointed at the object literal, a one-line citation slip, not a substantive error). There is a matching hole on the venue side the accuser missed: venue.mjs:71 returns an empty list outright if the VENUE has no city, country or name, and venue signup requires only the name (venue-studio.html:434 — city and country are optional at claim). A venue that skips its city gets zero artist gigs forever.

5. HORIZON 60 (venue.mjs:17) and the 200-row cap (venue.mjs:40, :97) are real. Against "a weekly residency appears for the whole run", an open-ended residency only ever renders 60 days out — a minor stretch, not the main problem.

WHY I COULD NOT REFUTE IT

I looked for another path that would make "Any" true — a venue directory the artist picks from, a claim/link step, a venue-side "attach this gig" tool. There is none: sameVenue is used in exactly three places (venue.mjs:85, _vstats.mjs:45, _verify.mjs:236) and none is a fallback for the page listing. Name-plus-place text matching is the only mechanism.

Decisively, MySet's own Venue Studio says the opposite of the landing page, four times: "City and country are how artists' gigs find their way onto your page — put them exactly as they'd write them" (venue-studio.html:400); "City and country have to match how artists write them, or their gigs won't find your page" (:1105); the empty state "No gigs point here yet. Two things to check: your name, and your city and country — they have to match what the artists type" (:1192); and "Tell them to put the venue name as X and the city as Y, and it lands here automatically" (:1756). The app is honest about the constraint. about.html:518 is the only surface that drops it — and it adds "you never type a word of it" on top.

The one thing that softens severity: the truth is disclosed the moment a venue signs in, so nobody is misled for long. But the caveat lives behind a login and the promise lives on the page people decide on, so major stands.

**Fix.** Keep the promise, name the one condition, and use the Studio's own words so marketing and product agree:

<b>The music fills itself in</b>
Artists keep their own calendars. Write your venue name, city and country the way musicians write them, and their gigs land on your page by themselves — a weekly residency shows every night of the run, and you never type a word of it.

Why this beats the accuser's version: it says WHAT to match (name, city AND country — their "town" drops country, which is half of the failing comparison at venue.mjs:84); it puts the burden where the Studio already puts it, echoing venue-studio.html:400; and "every night of the run" is true inside the 60-day window while "for the whole run" is not.

Two code fixes would let the original "Any" sentence stand almost as written, both one-liners:
- venue.mjs:84 — compare with venueKey() on both sides, exactly as _verify.mjs:237 already does. Kills the case-sensitivity limb outright.
- venue.mjs:73 — filter out `isVenueOwner` ids before the .slice(0, MAX_ARTISTS), so venue-owned rows stop eating the 60-artist budget.

## 32. [MAJOR] For venues · line 528

> Your bar is in it

**Verdict:** PARTLY OVERSTATED — severity minor. "Your bar is in it, with directions" is true unconditionally (artist gig rows carry the venue name, address and a working directions button). Only "your menu and your offers one tap away" is conditional: it becomes true as soon as the venue saves one of its own events, which the previous bullet already instructs. Needs a clause, not a rewrite.

**Evidence.** netlify/functions/_events.mjs:178-203 (reindexCities indexes only the owner's own events); netlify/functions/venueadmin.mjs:136,146 (the only calls that index v_<vid> with places); netlify/functions/venueadmin.mjs:233 (guarded — no-ops when the venue has no events); netlify/functions/_venues.mjs:74-105 (createVenue indexes nothing); netlify/functions/events.mjs:78 (city/country string match), :82 (venue-owned row gets href /v/<slug>), :83-84 (gig row carries no venue slug); public/index.html:468 (row links to the artist), :473-474 (venue name + address), :477 + dirBtn (directions button); netlify/functions/_events.mjs:108 and _maps.mjs:89-111 (map links built from name+city+country, no address needed); netlify.toml:52 (/venues is the Venue Studio, not a directory); public/about.html:530-532 (the bullet), :521-523 (the preceding bullet that establishes the venue enters its own nights), :515-518 (bullet 1, "you never type a word of it" — the real source of the tension)

**Skeptic (high).** The structural claim holds but the accusation is overstated on two counts, and its lead evidence is irrelevant.

CONFIRMED: reindexCities (_events.mjs:178-203) indexes an owner only from that owner's own saved events. The only calls that can put a `v_<vid>` id into the city index with real places are venueadmin.mjs:136 (eventSave) and :146 (eventDelete); venueadmin.mjs:233 only rewrites places for a venue that ALREADY has events (guarded by `if ((ev.list||[]).length)`), and _venueaccount.mjs:67/105 index the empty list (delete) while :121-122 re-indexes from the venue's own saved events (undo-delete). createVenue (_venues.mjs:74-105) indexes nothing. There is no public venue directory: /venues routes to venue-studio.html (netlify.toml:52) and no function serves a venue list — venue.mjs only serves one venue page. Gig rows in the city feed carry no venue slug (events.mjs:83-84; only the kind:'event' row at :82 gets href `/v/<slug>`), and index.html:468 points the whole row at the artist. So for a bar that has saved none of its own events, the "menu and offers one tap away" half of the sentence is false.

WHERE THE ACCUSER IS WRONG: (1) They claim the bar's name appears "only as untappable text (index.html:474)." The same row also renders the address (index.html:474) and a real directions button (index.html:477, dirBtn), and _events.mjs:108 builds those links with mapLinks, which returns Apple/Google links from venue name + city + country even with no street address (_maps.mjs:95). So "Your bar is in it, with directions" is TRUE in every state, including for a bar that has never signed up. Only the menu/offers clause fails. (2) Their lead evidence — "no verification or payment gate, _verify.mjs not imported in events.mjs" — argues in the page's favour and carries none of the weight; it looks like leftover template text.

SEVERITY: the bullet immediately above this one ("Everything else, entered once ... on your page and in the local what's-on feed") already tells the venue to enter its own nights, so in context this bullet is the payoff for a venue that uses the studio, where it is fully true. The genuine defect is the tension with the FIRST bullet ("The music fills itself in ... you never type a word of it"): a music-only bar that adds no quiz nights is never a tappable listing, and that is exactly the bar the section's headline ("written by everyone else") is selling to. That is a one-clause honesty fix, not a major overstatement — no money, access or room behaviour is misrepresented.

**Fix.** Keep the payoff, state the trigger, and stop claiming a tap that does not exist:

"People searching 'what's on tonight' find you — Pick a country and a city and MySet shows the week. Every gig at your place is in it, with your address and directions. Add one night of your own and your bar becomes a listing people can tap — menu and offers included."

This is true in both states, unlike the accuser's version, which gives away the unconditional half ("with directions" applies even to bars that never signed up) and buries the fact that the fix is one quiz night away. If Perry wants the shorter line, the minimum honest edit is to move "your menu and your offers one tap away" into the previous bullet, which already describes the venue entering its own events.

## 33. [MAJOR] For venues · line 529

> one tap away

**Verdict:** MISLEADING (partly true) — severity minor-to-moderate, not FALSE/major. True for venue-entered event rows (events.mjs:82 -> /v/:slug, and venue.html:400-420 renders offers and menu inline on that page, so it is genuinely one tap). False for artist-listed gig rows, where the row goes to the artist (index.html:465, events.mjs:84) and the artist page carries no venue link at all (no "/v/" occurs anywhere in public/artist.html) — so menu and offers are unreachable, not merely further away.

**Evidence.** public/about.html:529 (the claim); public/index.html:465 (row href), :472 (venue as plain text), :477 and :507-511 (dirBtn, conditional on g.maps); netlify/functions/events.mjs:82 (/v/:slug for venue events), :84 (/:slug for gigs), :158 (maps comes from the artist's event record); public/artist.html:423-433 and :445-449 (venue as text + directions only, no /v/ link in the file); public/venue.html:352-354 (optional external Menu chip), :400-406 (Offers rendered inline), :408-420 (Menu rendered inline); netlify.toml:60-66 (/v/:slug -> venue.html)

**Skeptic (high).** The core mechanical gap is real and I confirmed every link of it myself — but the accusation overstates it in two places, and its severity and proposed fix are both wrong.

WHAT I CONFIRMED (the finding survives in part):
1. The feed row's destination is server-supplied. public/index.html:465 `const href=g.href||(ev?'/':'/'+g.slug)`. The ONLY two places in the entire server that set `href` are netlify/functions/events.mjs:82 (venue-entered event -> `/v/<venue slug>`) and events.mjs:84 (artist gig -> `/<artist slug>`). I grepped `href:` across all of netlify/functions/ — those two lines plus two unrelated media/link helpers (_profile.mjs:146, _community.mjs:89-101) are all that exist. So there is no third code path.
2. `grep -n "/v/" public/index.html` returns NOTHING. The city feed contains zero links to any venue page. The venue name in a row is plain text (index.html:472, `<div class="where">`), inside a row whose only whole-row link is the artist.
3. `grep -n "/v/" public/artist.html` returns NOTHING either. The artist page shows the venue as a name plus an optional directions button (artist.html:423-433 for the next gig, :445-449 in the Upcoming-shows rows) and never links to the venue's MySet page.
So for an artist-listed gig — which is the case the bullet directly above this one (about.html:521-524, "The music fills itself in") promises will be the normal way a bar appears — the bar's menu and offers are not one tap away; they are not reachable by tapping at all. Only directions are one tap (index.html:477, dirBtn at :507-511).

WHERE THE ACCUSER IS WRONG:
4. The tap arithmetic for the venue-entered event row is simply incorrect. The accuser says "tap the row (1), then the Menu chip (2), and offers need a scroll". Not so: on public/venue.html the Offers section (:400-406) and the Menu section (:408-420, note, sectioned items and prices) are rendered inline on the page itself. They are content, not destinations. The "Menu" chip at venue.html:352-354 is optional and only appears when `v.menu.url` exists — it opens an external menu PDF/site in a new tab; it is not the route to the menu. So from a venue-entered event row it IS literally one tap: tap the row, land on a page carrying directions, menu and offers. That half of the accusation is refuted.
5. Therefore the sentence is not FALSE. It is true for one real, shipped path (venue-entered events) and false for the other (artist gigs). "Misleading/overreaching" is the honest status; "FALSE / major" overstates it.

ONE THING THE ACCUSER MISSED that slightly widens it: the directions button on a gig row is fed by `maps` on the artist's own event record (events.mjs:158, `maps: o.maps || null`), not by the venue's saved address — so on an artist gig row even the directions half is only as good as what the artist typed, and vanishes entirely when `g.maps` is falsy (index.html:477 is conditional).

Separately worth raising as a product item, not a copy item: no gig row and no artist page anywhere links to a venue's MySet page, so a venue page is orphaned from exactly the music the page above promises will fill it in. Adding a `venueSlug` to the gig shape in events.mjs:83-84 and linking the venue name would make the original sentence true as written.

**Fix.** Keep the true half and name the real condition, rather than deleting the benefit:

"Pick a country and a city and MySet shows the week. Your bar is in it, with directions one tap away — and every night you list yourself opens your page: your menu, your offers, your hours."

Why this beats the proposed fix: the accuser's version ("your menu and offers on your page, behind the code on your tables") throws away a path the code actually delivers and folds the promise into the QR bullet two lines below (about.html:543), which then says the same thing twice. Mine is literally true on both halves — venue-entered rows do link to /v/:slug (events.mjs:82) and that page does carry menu, offers and hours as inline sections (venue.html:400-425) — and it quietly gives the venue a reason to enter their own nights, which is the behaviour the next bullet is already selling.

If the team would rather keep the sentence as originally written, the code fix is small: carry the venue slug on gig rows too (events.mjs:83-84 already has the venue record in hand) and make the venue name in index.html:472 a link to /v/:slug. Then "one tap away" is true for every row in the feed.

## 34. [MAJOR] For venues · line 570

> So the moment your page exists, every gig any artist has already listed at your place is on it.

**Verdict:** OVERSTATED — severity minor (downgraded from major). A real gap exists, but two of the four grounds cited do not hold, one is misdescribed, and the one that genuinely bites is different (and sharper) than the accuser found.

**Evidence.** public/about.html:569-575 (the sentence AND the sentence after it) · netlify/functions/venue.mjs:17,40,70-97 · netlify/functions/_venues.mjs:196,200-208 · netlify/functions/_events.mjs:177-204 (reindexCities) · netlify/functions/_maps.mjs:21 (clean) · public/studio.html:1695-1698 (free-text city/country inputs)

**Skeptic (high).** CONFIRMED, and the accuser is right about it: the join is read-time (venue.mjs:70-97, called only from the one fetch at venue.html:290) — no cron, no backfill. autocron.mjs does sweep/heal only. "The moment" is true.

GROUND 1 REFUTED — "past gigs never appear." The page does not claim them. Read the very next sentence, about.html:573-574: "a venue can finish signing up and find its next month of live music already listed." "Already listed" modifies the listing, not the gig date, and the surface is a what's-on tab (the image alt at about.html:580 says so). Nobody reads a what's-on as an archive. Also note reindexCities (_events.mjs:183-185) drops an artist from a city once their one-off finished 7 days ago, so past coverage isn't merely filtered — it doesn't exist as a product concept anywhere.

GROUND 2 REFUTED — "stops at 60 days ahead." HORIZON=60 (venue.mjs:17) is MORE than the page's own stated scope of "next month." The code exceeds the promise. This is not an overstatement.

GROUND 4 MISDESCRIBED — sameVenue does NOT refuse short single-word names. _venues.mjs:203 returns true on exact normalised equality at any length; only the containment branch requires the shorter key to be ≥8 chars or ≥2 words (line 205). So a venue called "Sonic" still matches an artist who typed "Sonic" or "The Sonic"; it misses "Sonic Bar." Real, but narrower than stated. (Watch out: the comment at _venues.mjs:196 says "at least five characters" while line 205 says 8 — stale comment; do not cite it as behaviour.)

GROUND 3 CONFIRMED AND WORSE THAN STATED. MAX_ARTISTS=60 (venue.mjs:18,73) takes the first 60 ids in the city array. reindexCities (_events.mjs:189-201) strips the artist from every city and re-pushes them, on every calendar save. So the array is ordered least-recently-edited first, and .slice(0,60) drops the MOST recently active artists first. In a city past 60 indexed artists, the artist who added a gig at your venue this morning is the one most likely to be invisible — which hits the page's "the moment" claim head-on, not just its "every."

NEW GROUND, stronger than the accuser's "exact string." venue.mjs:84 compares city and country with !== against two free-text fields that are never case-folded: clean() (_maps.mjs:21) and str() (_events.mjs:28) only collapse whitespace and trim, and both the gig form (studio.html:1696-1698) and venue signup (_venues.mjs:82) are plain inputs with no picker, datalist or autocomplete. "koh phangan" ≠ "Koh Phangan"; "UK" ≠ "United Kingdom." That is an everyday miss, not an edge case.

The 200 cap (venue.mjs:40) is real but the response returns truncated:true, and 200 upcoming rows is not a case any venue will hit.

NET: the marketing core — it's there when your page exists, no import, nothing for the artist to re-enter — is true in code. Only the absolute quantifiers "every"/"any" are unsupported. That is a word-level fix, not a claim that misleads about the mechanism. Minor.

**Fix.** The accuser's fix keeps the problem: "every one still to come" is still a universal, and it is still false under the 60-artist cap and the case-sensitive city match. Drop the quantifier instead of qualifying it.

"So the moment your page exists, the gigs artists have already listed at your place are on it — no waiting, no import, nothing for them to re-enter."

The definite article carries the same punch without promising completeness, and "nothing for them to re-enter" is the real benefit and is literally true (it echoes the code's own comment at venue.mjs:11-15).

Separately, and worth more than the copy edit: the least-recently-edited ordering behind venue.mjs:73 is a genuine product bug — a venue's newest gigs are the first to fall off in a busy city. Sorting the city index by most-recently-active before the slice would make the sentence closer to true than any rewording will.

## 35. [MAJOR] Pricing & honest notes · line 590

> What it costs

**Verdict:** OVERSTATED — confirmed, and worse than the accuser stated. It is not only an omission from the pricing section; the section's own "honest note 3" at about.html:658-660 makes the absolute claim "There's no checkout, so nobody is being charged for anything", which the featured-shows path directly contradicts. Severity: major (stands).

**Evidence.** netlify/functions/_featured.mjs:40 (FEAT_PRICE = 1000); netlify/functions/_flags.mjs:38-49 (featuredShows default: true) + _flags.mjs:89-97 (flagValue falls through to spec.default when no doc); production `flags` blob read via tools/prod.py returns null, so the default true is what production uses; netlify/functions/admin.mjs:1452-1500 (featureStart: only gates are the flag, STRIPE_SECRET_KEY presence, a future gig with a city, and owner role — no plan check; `new Stripe(key0)` with no stripeAccount = platform account, unit_amount F.FEAT_PRICE); admin.mjs:1590-1591 (owner-only, not plan-gated); `netlify env:list --context production --json` shows STRIPE_SECRET_KEY present (masked ****HAsL); public/studio.html:1357-1409 (featureCard + openPromote + payPromote), studio.html:2044 (featureCard drawn in the Gigs tab with no plan condition), studio.html:933 and 1615 (loadFeature fires on the Gigs tab); netlify/functions/events.mjs:110-135 (city feed renders the paid rows, so the spot is real); public/about.html:590-662 (no mention) and public/about.html:658-660 (the contradicting sentence).

**Skeptic (high).** I tried to refute this and could not. I looked for four escapes and found none.

(a) A code path that makes the page true: there is none. handleFeature (admin.mjs:1404-1520) is the only door, and I read every gate in it — the featuredShows flag, STRIPE_SECRET_KEY, a future gig with a city, and owner-vs-band-member role. There is no plan check anywhere in the function, and `promote: false` in _plan.mjs:74/91 plus NOT_BUILT at _plan.mjs:130 is a *different* feature ("list gigs in cities you don't normally play"), which is exactly the Pro "Soon" bullet already on the page. So the accuser is not confusing the two.

(b) Comment-vs-behaviour: I read the executable lines, not the prose. FEAT_PRICE=1000 is used at admin.mjs:1483 as `unit_amount` on a real `stripe.checkout.sessions.create`.

(c) Flag off in production: this was my best hope. The flag defaults true in code, and a global override lives in the `flags` blob — so I read production. `python3 tools/prod.py get flags` returns null: the document does not exist, so flagValue (_flags.mjs:94-96) falls through to `default: true`. Featured shows are ON in production.

(d) Stripe key absent: my second-best hope. `netlify env:list --json` in the default (dev) context returns empty strings, which looks like an unset key. Against the production context the key is present and masked. So featureStart will not 503.

(e) Unreachable UI: no. The card renders in the Gigs tab (studio.html:2044) with no plan condition, and loadFeature is fired both on tab switch (1615) and on refresh (933).

Timeline check: featured shows landed 2026-09-05 (commit 81f5b44), and about.html was last edited the same day (9e9fde4) — so the page was touched after the feature existed and still says nothing.

Where I disagree with the accuser is scope, not verdict: this is not a quiet omission. A section headed "What it costs" ends with "There's no checkout, so nobody is being charged for anything" while the Studio's Gigs tab shows a Promote button that opens a live $10 platform charge to a Free artist. That sentence has to change, not just gain a neighbour.

**Fix.** Two edits, not one — the accuser's fix adds the missing line but leaves the sentence that contradicts it standing three paragraphs below.

1) After the three plan cards, before the honest notes:
"<b>One thing you can buy without a plan.</b> $10 puts one of your gigs at the top of its city's list for that night, with an orange border. Three spots a night, first come, first served — and if the night fills up before your payment lands, the $10 comes straight back."
(Every clause verified: _featured.mjs:41 SLOTS=3, per city per date; events.mjs:110-135 renders it; _featured.mjs:289-345 auto-refunds a lost or duplicate spot.)

2) Fix honest note 3 at about.html:658-660. Replace "There's no checkout, so nobody is being charged for anything." with "The only thing that takes a card in the Studio today is the $10 featured spot above."

Drop the accuser's closing sentence "Nothing else is ever charged." It is an unverifiable absolute and it is probably false: the plans already take a 10% / 2% / 0% cut of money through the app, and — separately — netlify/functions/_billing.mjs:121-158 `startCheckout` is fully wired (it mints its own prices via `ensurePrice`, needs only STRIPE_SECRET_KEY, which is set in production) and is reachable at admin.mjs:79-85 via `planCheckout`, which suggests the "Plus and Pro can't be bought yet / there's no checkout" half of note 3 may itself be stale. That deserves its own audit item; do not paper over it with a new absolute.

## 36. [MAJOR] Pricing & honest notes · line 591

> Everything the room sees is free. Always.

**Verdict:** WRONG, but MINOR (headline over-reach only) — not AMBIGUOUS/major. The kernel survives; three of the accusation's four supporting citations do not, and its proposed fix is falsifiable by code the accuser missed.

**Evidence.** public/about.html:591-594 (headline + lede); public/vote.html:708-709 (Tip button always rendered; price shown only when d.paymentsEnabled), 917-918 and 933-934 (both sheets short-circuit to "Card payments aren't on tonight" when ST.paymentsEnabled is false), 944-952 (checkout); netlify/functions/_pay.mjs:52-54 (canTakeMoney → false for every artist but the platform owner today) and 33-38 (connectReady); netlify/functions/pay.mjs:80; netlify/functions/admin.mjs:1699-1707 (pricing gate is back-office only) and 1830-1837 (freeCredits clamps to Math.max(0, …) — ZERO is allowed); public/studio.html:2244 (min="0") and 3025-3028 (client accepts 0); netlify/functions/vote.mjs:118-121 (freeCredits 0 + no pack ⇒ every vote refused 402 'no-credits'); netlify/functions/_lib.mjs:176,390 (default freeCredits 5); netlify/functions/_plan.mjs:130 (NOT_BUILT includes 'branding'); public/about.html:610, 627, 644, 654 (the page's own disclosures).

**Skeptic (high).** I read the code myself and the kernel of the accusation holds: public/vote.html:709 renders a "Tip <artist> · Say thanks" button in every room unconditionally, :708 renders "More votes" with a real price whenever d.paymentsEnabled, and both run through :944-952 → netlify/functions/pay.mjs:80 into a genuine Stripe Checkout Session. So "Everything the room sees is free. Always." is literally over-broad, and the lede's "none of it ever costs the room a penny" (about.html:593) reads wider than what the code guarantees. That much I could not refute.

But the finding is materially weaker than "AMBIGUOUS / major", on four counts.

1. The price is invisible for every artist alive today. _pay.mjs:52-54 canTakeMoney returns true only for isPlatformOwner or show.pay.ready, and _pay.mjs:33-38 connectReady is false for everyone but the founder because Connect is not built. With paymentsEnabled false, vote.html:708 shows "Ask <artist>" and no figure, and vote.html:918/934 turn both sheets into "Card payments aren't on tonight". So the accusation's "the room is shown money buttons with a price" is true only on the founder's own gigs.

2. The page already discloses fan-facing money, in the same section, without being asked: about.html:627 sells "Price your own vote packs" as a Plus feature, :628-629 sells setting "what it costs the room to replay", and :654-657 states plainly that tips and vote packs exist and currently run only on the founder's gigs. A reader of this section cannot come away believing no money ever moves on a fan's phone. That is a scope-sloppy heading over honest body copy, not a false claim about the product.

3. Three of the four "room-facing plan gates" cited do not support the charge at all. _plan.mjs:20 free.featured:50 is not a cost to the room and is disclosed verbatim at about.html:610 ("50 live to the room at once"). _plan.mjs:66 free.pricing:false locks the DEFAULTS, and the defaults are free (_lib.mjs:176/390 freeCredits 5; replayCost is priced in votes, admin.mjs:1946-1951 clamps 1..20) — admin.mjs:1699-1704 says in code that this gates the artist's back office and the room's night is identical. _plan.mjs:77 branding is in NOT_BUILT (_plan.mjs:130), so it gates nothing that exists, and about.html:644 already marks it "Soon".

4. The real problem is one the accuser missed, and their fix would enshrine it. admin.mjs:1832 clamps freeCredits with Math.max(0, …) and studio.html:2244/3026 accept 0, so a Plus/Pro artist can set the free-vote allowance to zero — after which vote.mjs:118-121 refuses every single vote with 402 'no-credits' until the fan buys a pack. That makes "Nobody ever pays to take part. Always." demonstrably false in a reachable configuration, which is worse than the sentence it replaces. The proposed fix should not ship.

**Fix.** Do not use "Nobody ever pays to take part. Always." — vote.mjs:118-121 plus admin.mjs:1832 refute it (freeCredits can be set to 0). Make the promise about who is charging, which is the thing MySet actually controls:

Headline (about.html:591): "We never charge your audience. Always."

Lede (about.html:592-594): "The voting, the lyrics, the requests, your page, your gig listings — all of it, on every plan, and MySet never bills your fans a penny for any of it. The only money that moves on a fan's phone is a tip or extra votes they choose to buy, and that goes to you. What you pay for is your own back office."

This is true under every code path I read: it survives the Tip and vote-pack buttons (vote.html:708-709), it survives an artist setting free votes to zero (admin.mjs:1830-1837), it keeps the real selling point ("the artist pays, not the room"), and it costs one sentence. Severity should be logged as minor / copy-scope, not major.

## 37. [MAJOR] Pricing & honest notes · line 630

> tips, vote sales and merch stay yours

**Verdict:** OVERSTATED — confirmed, and WIDER than the accuser stated. Severity: major. The omission is not limited to line 630; it affects all three plan cards. The worst offender is Pro at public/about.html:640, "No cut at all — 0% on everything through the app", which invites an artist to read "0%" as "I keep 100%" when they still pay Stripe's card fee. Free at :611 ("10% of money taken through the app") has the same gap, and :628 ("paid straight to you") reinforces it. public/about.html contains the string "Stripe" exactly zero times (verified by grep over the whole file) — including in the three "honest notes" at :651-660, which admit card payments aren't live but never mention the card fee.

**Evidence.** netlify/functions/_connect.mjs:74 `stripeFeeEstimate = (amountCents) => Math.round(amountCents * 0.029 + 30)`; netlify/functions/_connect.mjs:78-85 `feeCents` — MySet's cut is an application_fee only, and the `splitFee` reducer at :83 is never reached for artists because no artist plan row sets it (netlify/functions/_plan.mjs:64, 87, 97 define cut 0.10/0.02/0 with no splitFee; only VENUE_PLANS set splitFee, netlify/functions/_venues.mjs:131-132). netlify/functions/pay.mjs:160-176 creates the Checkout session with `stripeAccount: conn.acct` (a direct charge) and fails closed with 503 for anyone who is not on Connect and not the platform owner, so every non-founder artist's charge is a direct charge; pay.mjs:181 and :209 attach `application_fee_amount` on top. Under direct charges the connected account bears Stripe's processing fee. Page text: public/about.html:611, 628, 630, 640. Studio does disclose it: public/studio.html:1540-1541 and :3263 ("Stripe takes its fee from your side").

**Skeptic (high).** I tried to refute this four ways and could not.

1. Is there another code path making the page true? No. I looked for the one that would: `splitFee` at _connect.mjs:83, which subtracts half of Stripe's estimated fee from MySet's cut. If artist plans set it, MySet would be absorbing half the card fee and "stay yours" would be closer to honest. They don't — _plan.mjs:64/87/97 define the artist rows with `cut` only; `splitFee: true` appears solely on the two venue rows at _venues.mjs:131-132. So for artists, MySet's fee and Stripe's fee are strictly additive.

2. Is the accuser reading a comment as behaviour? This was the strongest refutation available, since the quoted passage at _connect.mjs:31-35 is a prose comment. But the behaviour is in executable code, not the comment: pay.mjs:174 passes `stripeAccount: conn.acct` into `checkout.sessions.create`, which is what makes it a direct charge, and pay.mjs:181/209 add `application_fee_amount` separately. Direct charge = connected account pays Stripe's fee. The comment describes the code accurately.

3. Is the accuser applying a condition the page never implied? No — the page's own bullet is doing the implying. "stay yours" is not a hedge; it is an affirmative claim about what reaches the artist, sitting immediately after a percentage.

4. Is the sentence more carefully worded than noticed? The opposite. "2% cut instead of 10%" is precise about MySet and silent about everything else, which is exactly the shape that misleads.

The one real mitigation: the page's own honest note at :655-657 says card payments aren't on for anyone but the founder yet, so no artist is being paid out under a wrong expectation today. But pay.mjs:169-170 fails closed only until an artist completes Connect onboarding — the moment one does, this is live — and the plan cards are the purchase-decision surface regardless. That lowers present harm, not the severity of the copy. Severity stays major.

Where I'd correct the accuser: they framed this as a single-bullet defect at :630. It is a section-wide defect. Pro's "No cut at all — 0% on everything through the app" (:640) is more misleading than the Plus line, because 0% invites "I keep everything" with no counterweight anywhere on the page, and their proposed fix would have left it untouched.

**Fix.** Don't patch only the Plus bullet — a per-bullet patch leaves Pro's "0% on everything" reading as "you keep 100%". Fix it once, below the three plan cards, so it covers every tier:

Keep :630 as "<b>2% cut</b> instead of 10% on tips, vote sales and merch." (drop "stay yours", which is the phrase doing the overclaiming), then add one line under the plan grid:

"Whichever plan you're on, Stripe takes its own card fee before the money reaches you — about 2.9% plus 30c, the same as it would anywhere else. On a $5 vote pack that's roughly 45c. MySet's cut sits on top: about 50c on Free, 10c on Plus, nothing on Pro."

Arithmetic checked against the code: 500c pack → stripeFeeEstimate = round(500*0.029+30) = 45c; feeCents = floor(500*0.10)=50c free, floor(500*0.02)=10c plus, 0 pro. Plus artist nets $4.45, which matches the accuser's figure.

Two wording cautions, both from the code's own honest notes: say "about" and never a hard number — _connect.mjs:69-73 states the true fee is only known after the charge on the balance transaction and differs by country and card, and PAYOUT_COUNTRIES (_connect.mjs:96-97) spans 22 countries where 2.9%+30c is a US figure. And do not write "MySet takes 2%, Stripe takes 2.9%" as if they were the same kind of thing — MySet's is a percentage of the pack, Stripe's has a flat 30c that dominates on small packs (on a $2 pack Stripe takes ~36c, 18%).

## 38. [MAJOR] Pricing & honest notes · line 651

> Three honest notes, because a page like this ought to say where the edges are.

**Verdict:** OVERSTATED — confirmed, but for two of the four reasons given, not four; and the strongest part is a contradiction, not an omission. Severity: major (upheld, on different grounds).

**Evidence.** public/about.html:651,659,630,640,641 · netlify/functions/_connect.mjs:31-35 + pay.mjs:64,70,173,209 (direct charge: stripeAccount + application_fee_amount) + _connect.mjs:83 & _venues.mjs:131-132 (splitFee exists ONLY for venues, never for artist PLANS) · _featured.mjs:40 (FEAT_PRICE=1000) + _flags.mjs:38-49 (default:true) + admin.mjs:1452-1497 (featureStart — no plan gate anywhere) + public/studio.html:1366 (Promote button, no plan gate) · _plan.mjs:65,89,107 (seats 1/1/5) + auth.mjs:395 · _lib.mjs:131 + _plan.mjs:21

**Skeptic (high).** I tried to refute this and could only refute half of it.

SURVIVES (1) — Stripe's fee falls on the artist. This is real behaviour, not a comment read as behaviour. pay.mjs creates the session with `stripeAccount: conn.acct` (line 70, 173) and `application_fee_amount` (64, 209) — a direct charge, so Stripe's ~2.9%+30c comes off the connected account. I checked whether any code path softens it: `splitFee` (which subtracts half of Stripe's estimated fee from MySet's cut, _connect.mjs:83) is set ONLY in VENUE_PLANS (_venues.mjs:131-132). No artist row in PLANS has it. So an artist bears the whole card fee, and about.html:640's "No cut at all — 0% on everything through the app" is the sentence most likely to be misread as "you keep 100%". _connect.mjs:31-35 doesn't create the problem; it predicts it.

SURVIVES, AND IS WORSE THAN STATED (2) — the $10 Featured charge. FEAT_PRICE=1000 (_featured.mjs:40), flag default ON in code (_flags.mjs:38-49), and featureStart (admin.mjs:1452-1497) has NO plan gate — I looked for one specifically. studio.html:1366 draws "Promote a gig · $10" for every signed-in artist on every plan. That is a live Stripe Checkout on the platform account. The accuser files this as an undisclosed caveat; it is stronger than that. about.html:659 says "There's no checkout, so nobody is being charged for anything." That sentence is false as written, not merely incomplete. Note 2 survives untouched (Featured is the artist paying MySet, not taking money), but note 3 does not.

REFUTED (3) — seats. The page never implies more than one seat on Free or Plus. It names "Five sign-ins for your band" only in the Pro column (about.html:641), which is the ordinary way to signal that lower tiers have fewer, and auth.mjs:395's own error text ("Your plan allows one sign-in. Pro allows five.") agrees with the page. This is the accuser applying a condition the page never set.

REFUTED (4) — the gig cap window. The page says "4 shows a month". gigMonthOf (_lib.mjs:131) counts a calendar month, and _plan.mjs:21 says so in as many words. A calendar month IS what "a month" means; the accuser has imagined a rolling-four-weeks reading the page never offered. UTC vs the artist's local timezone shifts the reset by at most a few hours once a month — not a material caveat.

So the finding stands, but "at least three further material caveats" should be two, and the fix has to repair note 3 rather than only append a note 4.

**Fix.** Two edits, because appending a fourth note leaves a false sentence in place.

A) Fix note 3 (about.html:658-660). Replace "There's no checkout, so nobody is being charged for anything." with:
"There's no subscription checkout yet, so nobody is paying a monthly fee. The one thing you can pay for today is a Featured spot — $10 puts one of your gigs at the top of a city's list for that night, three spots a night, first come first served. It's optional and it's the same price on every plan."

B) Change the opener (about.html:651) to "A few honest notes," and add:
"<b>5 · Stripe takes its own card fee.</b> When a fan buys votes, tips you or buys merch, the money is charged on your own Stripe account — so Stripe's fee, about 2.9% and 30c, comes off your side before ours does. That means 2% to us isn't the same as keeping 98%, and Pro's 0% isn't the same as keeping everything. On a $5 vote pack a Plus artist pays roughly 45c to Stripe and 10c to us."

(Numbered 5 if the Featured point becomes its own note 4 instead of folding into note 3 — either shape works, but the "nobody is being charged for anything" clause must go.)

C) Optional, cheap: at about.html:640 change "No cut at all — 0% on everything through the app" to "No cut at all — we take 0%; Stripe's card fee still applies". One clause, and it removes the "keep 100%" reading at the exact place an artist forms it.

## 39. [MAJOR] Pricing & honest notes · line 655

> while the payouts plumbing gets built

**Verdict:** STALE — major, upheld and WIDER than the accuser stated. Two lines carry the claim, not one, and the same paragraph contains a second, harder mechanism error ("the 10% above currently applies to nobody") that would surprise an artist at their first payout.

**Evidence.** public/about.html:655 (note 2) and public/about.html:415-417 (beat 4 — the SAME claim, missed by the accuser: "card payments are the part still being built ... switch on for everyone once the payouts plumbing is finished"). Refuting evidence I read myself, end to end: netlify/functions/_connect.mjs:130-160 (ensureAccount creates a real Express account with card_payments + transfers requested and a daily payout schedule), :163-179 (onboardingLink), :246-268 (syncFromStripe mirrors charges_enabled/payouts_enabled), :270-290 (mirrorToShow writes show.pay.ready) — the payout side specifically, which is what the sentence names. Reachable with no gate: netlify/functions/admin.mjs:1092-1102 (payStatus), :1104-1122 (payStart — no plan check, no owner check, no feature flag; only a country validation), :1124-1130 (payDashboard). Rendered to every non-founder artist: public/studio.html:1552-1578 — payCard() returns '' ONLY for p.platformOwner (:1554) and otherwise draws "Set up card payments" / "Start with Stripe". The fan-facing charge path is live for such an artist: netlify/functions/pay.mjs:161-174 (direct = connectUsable(conn); stripeAccount put in scope) and :180 (const fee = direct ? feeCents(amountCents(line), plan) : 0). The webhook closes the loop: netlify/functions/webhook.mjs:33-38 (charge.updated -> settleSplit) and :46-48 (account.updated -> artistForAccount -> mirror). PLANS.free.cut = 0.10 at netlify/functions/_plan.mjs:64, applied by feeCents at _connect.mjs:78-85. The repo's own hard rules agree: INVARIANTS.md:217-222 — "0r0. DIRECT CHARGES ... 0r below is now implemented (_connect.mjs)" — explicitly supersedes the old 0r at INVARIANTS.md:241 that the stale copy is built on. Dates: Connect shipped in commit 6fc0e33 on 2026-09-02; about.html was last edited in 9e9fde4 on 2026-09-05, three days AFTER, so the note was carried forward unrevised, not written before the feature. I checked every plausible rescue and found none: no NOT_BUILT entry covers payouts (_plan.mjs:130 lists only promote/analytics/presskit/branding), and no feature flag gates it (_flags.mjs FLAGS holds only voteFinal and featuredShows).

**Skeptic (high).** I tried hard to refute this and could not. Four separate rescue routes all failed. (1) "The accuser is reading a comment as behaviour." That cuts the OTHER way here. The stale header the accuser flagged in _pay.mjs:4-32 — "Connect ... is not built", "grep the tree for application_fee_amount, transfer_data, stripeAccount, on_behalf_of or accounts.create and you will find nothing" — is itself falsified by the code: accounts.create is at _connect.mjs:141, stripeAccount at _connect.mjs:113 and pay.mjs:160/174, application_fee_amount at pay.mjs:154 and :180. And the comment's own function contradicts it at _pay.mjs:33-37, which reads connect_<aid>.chargesEnabled and returns TRUE for an onboarded artist. The page is built on that dead comment and on the superseded INVARIANT 0r, not on the code. (2) "Another code path makes the page true." There is none. I looked for a plan gate, an owner-only gate, a feature flag and a NOT_BUILT entry on payStart; all absent. Any signed-in artist can open the Studio today, pick a country from the 22-country allow-list, and be handed a live Stripe onboarding link. (3) "The sentence is more carefully worded than the accuser noticed." It is worded WORSE. "while the payouts plumbing gets built" is present-progressive — a thing still under construction — and the next clause states a consequence as a hard fact: "Until that's finished no other artist can take money through MySet." Nothing in the code enforces that, and pay.mjs:161-174 is the exact opposite: it fails closed only when Connect is NOT usable, which is a gate on the artist's own onboarding, not on MySet finishing anything. (4) "The condition the page never implied." The page names payouts specifically, and payouts are the most complete part — Stripe hosts the KYC and the daily payout schedule is set at account creation (_connect.mjs:152). The one point that keeps this at major rather than critical is that the OUTCOME may currently be true by accident: the accuser reports zero connect_* documents in the production store, which I did not personally verify (I did not query prod, and I was told to treat this repo as read-only). But even granting it, the page states a false CAUSE for a temporarily-true effect, and the cause is what a prospective artist acts on. Where it is worse than the accusation says: (a) the identical claim appears a second time at about.html:415-417, inside the "Money happens without you asking" beat — fixing only line 655 leaves the page contradicting itself; (b) the sentence "which also means the 10% above currently applies to nobody" is a live mechanism error, not just stale framing. feeCents runs on a free-plan artist's first direct charge and takes 10% as an application_fee_amount (pay.mjs:180, _plan.mjs:64). An artist who reads this page, signs up, connects Stripe and plays a gig is charged the 10% the page told them applied to nobody — and, per _connect.mjs:74-77 and :312-317, Stripe's own ~2.9% + 30c lands on their side on top. The Studio says this honestly (studio.html:1567); the landing page does not. That is the direction of error that costs trust, and it is the one worth fixing first. The accuser's proposed wording, "while payouts get switched on for everyone else", is an improvement but still wrong in mechanism: it implies MySet does the switching on some rollout schedule. The artist does it themselves, unprompted, today.

**Fix.** Fix both places, and fix the 10% sentence with them — the mechanism is "you connect your own Stripe account", not "we finish building it".

about.html:653-657, replacing the whole of note 2:
"2 · Card payments work — but so far only the founder has switched them on. Money runs through your own Stripe account, which you connect in the Studio; Stripe checks your details, and until it's happy your room is simply never asked for money, so nothing can land in the wrong place. Once it is, the 10% above comes off what fans spend — and Stripe's own card fee, about 2.9% + 30¢, comes off your side too, because the payment is legally yours."

about.html:415-417, replacing the caveat paragraph in beat 4:
"One thing up front: before your room can tip or buy votes you connect your own Stripe account in the Studio — a few minutes, and MySet never sees a bank detail. Until you do, those buttons stay off in your room. The note under the plans says what it costs."

Two things to check while making the edit, both outside this finding but adjacent to it: note 3 at about.html:658-660 says "Plus and Pro can't be bought yet. There's no checkout" — netlify/functions/_billing.mjs exists with checkout, and commit 6fae274 (2026-09-04) is titled "Plans you can pay for", so that note is likely stale by the same three days and for the same reason. And netlify/functions/_pay.mjs:4-32 should have its header rewritten; it is the source this page was written from, and it will mislead the next reader exactly as it misled this one.

## 40. [MAJOR] FAQ, close, footer · line 693

> Can people see my whole setlist? Is that a problem? [entire answer, 693-698, carries no plan caveat]

**Verdict:** CONFIRMED — FALSE as stated, severity major. But the defect is availability, not mechanism, and the worse instance is the Free-column bullet at about.html:606, not the FAQ answer itself.

**Evidence.** netlify/functions/_plan.mjs:67 (`setlists: false` on free); netlify/functions/admin.mjs:730-736 (the ONLY creation path, `listNew`, returns 402 for any non-owner without `limits.setlists === true`); netlify/functions/_lists.mjs:39 (`emptyLists()` → `lists: []`, so a new free artist starts with none) and _lists.mjs:29 (`MAX_LISTS = 20`); public/about.html:606 (Free column: "Setlists, chord charts, keys and genres"); public/about.html:615-632 (Plus column — setlists appear NOWHERE in it); public/about.html:693-698 (the FAQ answer); public/studio.html:616 (`lock('setlists', …)`) with lock() at public/studio.html:1304-1316; public/studio.html:3705 (dunning copy: "you couldn't make new setlists"); netlify/functions/admin.mjs:1848-1859 (hiding a song has no plan gate — the answer's first half is true and free); netlify/functions/_lifecycle.mjs:80-94 (attaching a set to a calendar gig is real).

**Skeptic (high).** I could not refute it. I checked for every escape hatch and found none.

WHAT SURVIVES. `listNew` at admin.mjs:730-736 is the only code path in the repo that pushes into `d.lists` (grep across netlify/functions and public: one push, admin.mjs:743, one caller, studio.html:625). It refuses with 402 unless the artist is the platform owner or on a plan with `setlists === true`, i.e. Plus or Pro (_plan.mjs:90,108). A new free artist starts with `lists: []` (_lists.mjs:39) and nothing seeds one — the starter pack at _lib.mjs:46 fills the LIBRARY, not a named set. So admin.mjs:731-734's comfort ("everything you already have keeps working") is empty for every real free signup: they have nothing. The FAQ's remedy is unreachable for every artist who can sign up today.

I checked three specific escapes. (1) Feature flags: _flags.mjs declares only `voteFinal` and `featuredShows`; nothing there touches plan enforcement. (2) The founder bypass `isPlatformOwner` is Perry alone. (3) `redeemPromo` in _plan.mjs CAN put someone on Plus with no checkout — so the accuser's "a plan that cannot be bought" is right, but "cannot be reached" would have been wrong. A comp code is not something a landing-page reader has.

WHERE THE ACCUSATION IS TOO STRONG. It calls the "entire answer" false. It isn't. The first half — "Any song can be hidden, and it stays hidden across every future show until you bring it back" — is true and free: toggleSong at admin.mjs:1848-1859 caps only turning a song ON (the 50-song free ceiling, which the page discloses at :607), never off. The setlist details are accurate too for anyone who has the feature: twenty of them (_lists.mjs:29) and per-gig attach (_lifecycle.mjs:80-94). Nothing here is a mechanism error. It is purely a missing plan marker on one sentence.

WHERE IT IS TOO WEAK, AND THIS IS THE REAL FINDING. The accuser treats about.html:606 as a compounding detail. It is the more serious defect and should be its own claim. The FAQ merely omits a marker; line 606 makes an affirmative false statement — "Setlists" listed as a Free feature, in the pricing table, the one place a reader goes to check. And the Plus column at 615-632 does not mention setlists at all, so there is no counterweight anywhere on the page: a reader has literally no route to discover this is paid. The product contradicts the page twice from inside (studio.html:616 veils the button as a "Plus feature" via lock() at 1304-1316; studio.html:3705's dunning copy says free means "you couldn't make new setlists"). Note also the page uses "setlist" loosely at :398, :682 and :690 to mean "the songs you play" — so :606 could just about be defended as the loose sense, except that :696 immediately teaches the reader the feature sense ("name it, put the songs you want in it"), which kills that defence.

WHY MAJOR AND NOT CRITICAL. The Studio veils the button before the tap rather than after, so nobody is charged, stranded mid-gig, or told "no" in front of a room. The harm is a broken promise discovered in the back office.

Two citation corrections: the Free bullet is about.html:606 (not :605), and the Studio veil is public/studio.html:616 (not 613-617).

**Fix.** The accuser's fix deletes "Setlists" from the Free column but never adds it anywhere else — which leaves a paid feature that the pricing table never mentions, and the FAQ's "setlist" with nothing to anchor to. Fix all three places instead.

1. about.html:606 — "Chord charts, keys and genres" (drop "Setlists"; the loose sense is already carried by :607's "Keep 2,000 songs — 50 live to the room at once").

2. about.html Plus column (615-632) — add a bullet so the feature exists somewhere in the table: "<li><b>Setlists</b> — named sets for a beach gig, a late set, an Irish pub; keep twenty and attach one to a gig in your calendar</li>". This is the step the original fix omits.

3. about.html:693-698 — lead with the free path and mark the paid one:

"They see what you choose to show. Any song can be hidden, and it stays hidden across every future show until you bring it back — that's on every plan, and it's what most artists use. If you want a genuinely different set per night, <b>setlists</b> are a Plus feature: name one, put the songs you want in it, and the room sees just those. Keep twenty, and attach one to a gig in your calendar so it loads itself when you start the show. (Plus isn't on sale yet — see the third honest note above.)"

That last parenthesis is what makes the page honest rather than merely accurate: honest note 3 at :658-660 already says Plus can't be bought, and pointing at it turns a marker into a real disclosure. If Perry would rather not put a paywall inside a reassurance answer, the minimum viable version is fixes 1 and 2 plus four words at :695 — "build a <b>setlist</b> (Plus) instead".

## 41. [MAJOR] FAQ, close, footer · line 695

> For one night only, build a setlist instead — name it, put the songs you want in it

**Verdict:** FALSE — severity major (upgrade: the same false claim appears twice on the page, and the second instance is more explicit than the one under audit)

**Evidence.** public/about.html:693-698 (the FAQ sentence); public/about.html:606 (the FREE plan card bullet "Setlists, chord charts, keys and genres"); netlify/functions/admin.mjs:730-736 (listNew 402 gate); netlify/functions/_plan.mjs:67 (free: setlists: false), :137-150 (planOf/planForArtist default 'free'), :154 (isPlatformOwner === DEFAULT_ARTIST only); netlify/functions/_lists.mjs:39 (emptyLists() => { v:1, lists: [] } — a new artist starts with ZERO setlists), :29 (MAX_LISTS = 20); public/studio.html:613-617 (lock('setlists', '+ New setlist')), :1304-1316 (lock() renders a veil and a "Plus feature" pill when the flag is off); netlify/functions/admin.mjs:398 (the flag is shipped to the Studio precisely so it can veil the button)

**Skeptic (high).** I tried hard to find a path that makes the sentence true and there is none.

1. No second code path. `setlists` appears in exactly five places in netlify/functions (admin.mjs:398, :731, :735, :736 and _plan.mjs:67/90/108). The only creator of a setlist is `listNew` in admin.mjs, and it is gated at :735 by `isPlatformOwner(aid) || planForArtist(aid).limits.setlists === true`. _plan.mjs:67 sets `setlists: false` on free, :144 `limitsFor` falls back to PLANS.free, and :137-143 `planOf` returns 'free' for any artist with no plan or an expired comped period. There is no runtime flag for it in _flags.mjs. Nothing in the repo can turn it on for a free artist.

2. The "everything you already have keeps working" escape hatch is empty for a new artist. This was the one thing that could have rescued the page — if signup seeded a default setlist, the artist could reach it via the ungated `listRename` + `listSongs` and satisfy "name it, put the songs you want in it" without ever calling `listNew`. It does not. _lists.mjs:39 defines `emptyLists()` as `{ v: 1, lists: [] }`, and `readLists` (:52-55) returns that empty doc when no `lists_<aid>` document exists. A free artist has zero setlists and no way to obtain one. So the only ungated setlist verbs — rename, edit membership, use, delete — have nothing to operate on.

3. I am not reading a comment as behaviour. The comment at admin.mjs:731-734 and the one at studio.html:614-616 both describe the gate, but the gate itself is executable code on the line below each of them, and the Studio's `lock()` at :1304-1316 really does replace the button with a non-functional veil that opens the plan cards. Both the comment and the code say the same thing.

4. The page is not more carefully worded than the accuser noticed — it is less careful. The sentence at :695-697 is in the imperative ("build a setlist instead — name it, put the songs you want in it"), on a page whose two CTAs are "Get your page — free" (:709 area) and whose pricing section is headed "Everything the room sees is free. Always." Nothing in the FAQ or near it says "Plus".

WHERE THE REAL PROBLEM IS WIDER THAN THE ACCUSATION. The accuser only found the FAQ. The pricing table states it outright: about.html:606 puts "Setlists, chord charts, keys and genres" in the FREE column's feature list, and the Plus card (:615-634) never mentions setlists at all. So the page's own comparison table tells the reader the exact opposite of admin.mjs:735 — it sells a Plus-only feature as a free one, and then omits it from the thing you would pay for. That is a worse instance than the FAQ sentence, and the proposed fix does not touch it. Fixing only line 695 would leave the page still claiming setlists are free, forty lines higher up, in the place a buyer actually reads.

Two smaller notes, both confirming rather than softening: "You can keep twenty of them" (:697) matches MAX_LISTS = 20 at _lists.mjs:29, so the number is real but unreachable on free; and honest-note #3 at :658-660 ("everything else listed above is built and running today") is itself strained by the free card's setlists bullet, because the thing listed above is not available on the plan it is listed under.

Verdict: not refuted, confirmed, and it needs two edits rather than one.

**Fix.** Two edits, not one — the accuser's fix leaves the more explicit falsehood in place.

EDIT 1 — public/about.html:606, the FREE plan card. Drop setlists from the free bullet:
  <li>Chord charts, keys and genres</li>

EDIT 2 — public/about.html, the PLUS plan card (after the "Unlimited songs live at once" bullet), so the feature is sold where it actually lives:
  <li><b>Named setlists</b> — a different set of songs for a beach set, a late set, an Irish pub; the sets you build keep working if you ever drop back to free</li>

EDIT 3 — public/about.html:694-698, the FAQ answer. Shorter than the proposed fix, keeps the reassurance first and puts the caveat last where it belongs:
  They see what you choose to show. Any song can be hidden, and it stays hidden across every future show until you bring it back — that's free, on every plan, with no limit on how many. Named setlists do the same job a night at a time: pick one and the room sees just those songs, and you can attach a set to a gig in your calendar so it loads itself when you start. Building a new set is part of Plus, which can't be bought yet — so for now, hiding is the way.

Why this wording rather than the accuser's: it never uses the imperative for something the reader cannot do; it keeps the true, free, genuinely good half (hiding) as the answer to the question actually asked; it keeps the gig-calendar attach, which is real; and it says "part of Plus" rather than repeating the whole no-checkout explanation, which the page already gives in full at :658-660.

Verified free and ungated, so the new wording is safe: hiding runs through `toggleSong`, whose only plan check (admin.mjs:1694-1697) is a `featured` cap applied when a song is turned ON, never when it is hidden — so hiding really is unlimited on free.

## 42. [MAJOR] Demo script · line 752

> ${!mine.has(s.id) && left <= 0 ? 'disabled' : ''}

**Verdict:** FALSE — confirmed, but severity should be moderate, not major, because it is the same single defect as the un-vote branch (demo-24) seen from a second line, and the proposed fix is incomplete.

**Evidence.** public/about.html:752 (the disabled expression), public/about.html:768-769 (the refund branch it exists to enable), public/about.html:333 ("This is the real thing, running on this page… exactly what forty people do at once" — the visible fidelity claim, not just the code comment at :731); netlify/functions/_flags.mjs:34 (voteFinal default: true), :71-78 (readFlags merges into empty()), :89-97 (flagValue falls through to spec.default); netlify/functions/admin.mjs:175 (isPlatformOwner gate — only Perry can flip it, so no artist has quietly turned it off); netlify/functions/show.mjs:21,174 (flags shipped in the poll payload); public/vote.html:717,720 (dis=!open||(!c.unlimited&&c.remaining<cost&&!(s.mine&&!fin))); public/vote.html:632,721 ("tap to add more" / "Voted ×n"); INVARIANTS.md:630-632. I re-ran `python3 tools/prod.py get flags` myself: it returns `null`, so the flags document genuinely does not exist in the production Blob store and voteFinal is ON by default.

**Skeptic (high).** I tried to break this and could not. Every escape route closes.

Could another code path make the page true? No. The only ways voteFinal could be OFF in production are a global or per-artist entry in the flags document, and that document does not exist — I reproduced the `null` read myself rather than trusting the accuser. flagValue then falls through byArtist and global to spec.default, which is `true`. Flipping it is owner-only (admin.mjs:175 gates flagSet behind isPlatformOwner), so no artist could have turned it off for their own room. In vote.html:720 with fin true, `!(s.mine && !fin)` is always true, so `dis` reduces to `remaining < cost` and every button in the room — including the ones already showing "Voted" — locks at zero credits.

Is the accuser reading a comment as behaviour? No, and this is where I expected to win. The comment at about.html:731 ("The real interaction, not a video") is invisible to a visitor and would be weak evidence on its own. But the visible body copy at :333 says "This is the real thing, running on this page… That's exactly what forty people do at once." The page makes the fidelity claim out loud, in the reader's own words. And INVARIANTS.md:630-632 states the rule the demo breaks — under finality "the page must offer no affordance suggesting otherwise."

Is the page more carefully worded than the accuser noticed? No. It is worded more strongly than the accuser used.

Where the accusation IS weaker than stated, on two counts:

1. Double-counting. Line 752 is not an independent defect; it exists to keep the "Voted" button clickable so the refund branch at :768 can run. The two lines are one mistake — the demo models the pre-2026-09-02 refund product. Filing :752 as its own MAJOR alongside demo-24 counts the same defect twice. Standing alone with :768 already removed, :752 would render an enabled button that does nothing — still a forbidden affordance under INVARIANT 13b, but a minor one. I'd rate the combined defect major and this line moderate.

2. The fix is under-specified, and applying it as written leaves a new bug. Changing :752 to `left <= 0` matches the room's disabled state, but it does not match the room's *enabled* state. Under finality the room still lets a fan pile more votes onto a song they already hold — vote.html:632 literally says "tap to add more", and :721 renders "Voted ×n". The demo has no such concept. Worse: if :768 is deleted with nothing in its place, a tap on an already-voted song falls into the else branch at :769, where `mine.add(id)` is a no-op on a Set but `row.n++` and `left--` still fire — the count climbs while the label stays "Voted", which is a fresh falsehood rather than a fixed one.

The real problem is therefore slightly wider than stated: the demo is wrong about reversibility AND silent about stacking.

**Fix.** Fix the two lines together, and model what the room actually does — replace the `mine` Set with a per-song count so the demo can both lock at zero and stack above zero.

State: `let mineN = Object.create(null);` in place of `mine = new Set()`.

Button (:752), matching vote.html:720 with fin true — affordability is the only reason to disable:
`<button class="vb ${mineN[s.id] ? 'on' : ''}" data-id="${s.id}" ${left <= 0 ? 'disabled' : ''}>${mineN[s.id] ? (mineN[s.id] > 1 ? 'Voted ×' + mineN[s.id] : 'Voted') : 'Vote'}</button>`

Handler (:768-769), replacing both branches — no un-vote, no refund, adding is allowed:
`if (left <= 0) return; mineN[id] = (mineN[id] || 0) + 1; row.n++; left--;`

Then the footer's `mine.size` at :759 becomes `Object.keys(mineN).length`, and `mine.has(...)` elsewhere becomes `mineN[...]`.

Net effect: at zero credits every button greys out exactly as the room does; above zero a second tap on a held song reads "Voted ×2" exactly as vote.html:721 renders it; and nothing on the page teaches a visitor that a vote can be taken back. If that is judged too much surface for a marketing demo, the minimum honest version is the accuser's `left <= 0` plus deleting the refund branch plus an explicit early return for already-voted songs (`if (mineN[id]) return;`) — otherwise the count drifts. Do not ship the `left <= 0` change alone.

## 43. [MAJOR] Demo script · line 768

> if (mine.has(id)) { mine.delete(id); row.n--; left++; }

**Verdict:** CONFIRMED FALSE — the page's demo contradicts production; severity major stands and the divergence is wider than stated (production adds votes on that tap, it does not merely refuse)

**Evidence.** public/about.html:768 (and the fidelity claim at public/about.html:335); netlify/functions/_flags.mjs:28-34, :71-78, :89-97; netlify/functions/vote.mjs:45, :105-107, :124; public/vote.html:421-422, :448, :491-493, :632; live check `python3 tools/prod.py get flags` -> null

**Skeptic (high).** I could not refute it; I confirmed it end to end in code I read myself, and it is slightly worse than stated.

1) The page's demo really does un-vote and refund. public/about.html:768 — `if (mine.has(id)) { mine.delete(id); row.n--; left++; }` — a second tap on a voted song decrements the song's count and hands the credit back (visible as "No votes left" -> "1 vote left" via the counter at :754-755).

2) Production does not allow that. netlify/functions/_flags.mjs:28-34 declares voteFinal with `default: true` and states plainly that OFF is "the pre-2026-09-02 behaviour". readFlags (_flags.mjs:71-78) spreads `data || {}` over empty(), and flagValue (:89-97) returns `spec.default` when neither byArtist nor global carries a boolean. I ran `python3 tools/prod.py get flags` myself and it printed `null` — there is no flags document in the live Blob store, so nothing overrides the default and voteFinal is ON in production. vote.mjs:45 computes `final`, and :105-107 refuses the clear branch outright: `if (final) { err = ['Those votes are cast — they stay with the song', 409]; return false; }`.

3) The fan-facing app agrees. public/vote.html:421-422 routes a tap on a held song to the CAST sheet under finality (openUnvote is only taken when `!finNow`); :448 tells the fan "Once you confirm, that's final — votes can't be taken back"; and if openUnvote is reached at all, :491-493 renders only "These are cast — they stay with the song" with a Close button.

Two defences I tested and rejected:
- "It's a stylised demo, not a claim." Closed off by the page's own copy: public/about.html:335 says "This is the real thing, running on this page. Vote and watch the queue move. That's exactly what forty people do at once." The page asserts fidelity, so the demo is a claim.
- "Maybe some other path takes votes back." I grepped every 'clear' site (public/vote.html:411,486,507,516; netlify/functions/vote.mjs:40,105) — the only un-vote path is the one finality refuses. Credit return in production happens by round refresh when a song starts, not by untapping, which is a different mechanism from what the demo shows.

Where the accuser under-stated it: production does not merely refuse the second tap, it does the OPPOSITE of the demo. Under finality, tapping a song you already hold opens the vote sheet to add MORE votes (public/vote.html:416-422 comment and code; server honours it with `want = mine + n`, vote.mjs:124, and vote.html:632 labels it "tap to add more"). So the demo teaches the exact inverse of the live gesture, on the page's single most-tapped control. Severity major is right, if anything generous.

The proposed fix (`if (mine.has(id)) return;`) is honest but makes the page's centrepiece control dead on second tap — which is also not what the app does.

**Fix.** Make the demo mirror the live gesture instead of dead-ending it. Replace public/about.html:768 with a second tap that ADDS a vote while credits remain, which is what production does:

  if (mine.has(id)) { if (left <= 0) return; row.n++; left--; }
  else { if (left <= 0) return; mine.add(id); row.n++; left--; }

(these collapse to `if (left <= 0) return; mine.add(id); row.n++; left--;`)

Then let the button show the held count so the second tap is legible rather than mysterious — at :752, render `Voted` for one and `Voted · N` for more (track counts in a Map, or read `rows` for the fan's own tally), and drop `!mine.has(s.id) &&` from the disabled condition so a held song greys out at zero credits like every other row.

And say it in the copy rather than leaving it to be discovered — extend the footnote at :761 (and the no-script fallback at :354-355, which must match):

  'Everyone in the room gets a few free votes, and they stay with the song you put them on — tap again to add another. <b>Starting a song gives everybody theirs back</b> — so every gap is a fresh contest.'

This keeps the demo alive on a second tap, matches vote.html:421-422 and vote.mjs:124, and states the finality rule in the fan's own words from vote.html:448 without adding a sentence the app does not back.

## 44. [MINOR] index.html (what’s-on home) · line 41

> Sits ON TOP of a page that has already rendered, so it can never delay anything.

**Verdict:** CONFIRMED OVERCLAIM (minor) — not ambiguous. The render half is true and verified; the absolute "can never delay anything" is false in two ways, one of which the accuser missed: the overlay is opaque for 1.65s AND, lacking pointer-events:none, it swallows every tap for that same 1.65s.

**Evidence.** public/index.html:41 (the claim); public/index.html:43 (position:fixed;inset:0;z-index:90;background:var(--bg) — and NO pointer-events:none); public/index.html:44 (animation:introOut .5s var(--ease) 1.15s both); public/index.html:55 (@keyframes introOut{to{opacity:0;visibility:hidden}} — visibility only drops at the end); public/index.html:56 (prefers-reduced-motion escape hatch, true); public/index.html:234 (the #intro markup, aria-hidden="true"); public/index.html:293 and :296 (sessionStorage 'myset.seen' removal + 2200ms backstop); public/app.css:36 (--ease is a plain cubic-bezier, adds no time); public/app.css — no #intro rule exists anywhere, so nothing overrides pointer-events; public/sw.js:18 ("NOTHING is precached at install", corroborating the home-08 cross-reference about /pull.js at public/index.html:36, 5,996 bytes on disk).

**Skeptic (high).** I tried to refute this and could not. The mechanical half of the sentence is correct and I confirm it: index.html:43 sets #intro to position:fixed;inset:0, so it is out of flow, adds no layout work to the content, and does not block that content's paint. If the comment had stopped at "delays no layout and no paint" it would be accurate.

But the word "anything" is absolute, and two things are in fact delayed. First, the visual one the accuser named: index.html:44 is `animation:introOut .5s var(--ease) 1.15s both` against `@keyframes introOut{to{opacity:0;visibility:hidden}}` at :55, over an opaque `background:var(--bg)` covering the full viewport. app.css:36 shows --ease is a plain cubic-bezier, adding no time. So the content is hidden from the visitor for the full 1.15s and only clear at 1.65s. Confirmed.

Second, and the accuser understated this: #intro has NO `pointer-events:none`. It is not set at index.html:43, and app.css contains no `#intro` rule whatsoever (grep for "intro" in app.css returns nothing but unrelated .bg/.confetti lines). `visibility:hidden` only lands at the END of the introOut keyframe, so for the entire 1.65s the overlay is a live hit-target sitting at z-index:90 over the whole page. Every tap or click a visitor makes in the first 1.65 seconds is eaten by an invisible-purpose overlay and does nothing. That is not just "the visitor waits" — the page is genuinely unresponsive, which is the strongest possible counterexample to "can never delay anything."

I checked for exculpating paths and found none that rescue the sentence. index.html:293 does remove the intro when sessionStorage 'myset.seen' is set, and :56 disables it under prefers-reduced-motion — but those are the comment's OTHER two sentences ("shown once per session", "not at all if motion is unwelcome"), both of which are true, and neither helps the first-visit-in-a-session default case the sentence is about. The :296 setTimeout(…,2200) removal is a backstop that fires after the animation, so it does not shorten anything. There is no other #intro rule anywhere.

Nor is the accuser reading a doc as code or a comment as behaviour: they cited the CSS rule itself, and their line numbers (:43, :44, :36, :34) are all exactly right. Their cross-reference also checks out — sw.js:18 states "NOTHING is precached at install", so /pull.js (5,996 bytes, loaded render-blocking at index.html:36) really is uncached on a first visit, which makes the :34 comment's "4KB … blocking costs nothing measurable" a second, separate overclaim (home-08).

The one fair mitigation for the page: this is a CSS source comment written in engineering register, where "delay" most naturally means "delay the render pipeline" — and in that narrow sense it is true. That is why this is minor and not a lie. But the comment is doing the job of justifying a decision, and the justification it gives ("can never delay anything") is precisely the thing a future reader would rely on when deciding not to shorten the animation. An overclaim that discourages the right fix is worth correcting.

So: not refuted, and slightly worse than stated. I would raise the accuser's status from AMBIGUOUS to a confirmed overclaim, severity minor.

**Fix.** Replace the comment with one that separates the two costs, since the second is the one a future reader would otherwise not know about:

/* ── the opener ──
   position:fixed, so it is out of flow: no layout and no paint of the page
   behind it waits on this. What it does cost is 1.65s of the visitor —
   fully opaque until 1.15s, faded out by 1.65s — and with no pointer-events:none
   it is a live hit-target for that whole window, so a tap in the first 1.65s
   lands on the overlay and does nothing. That is the entire price of it.
   Keep it short. Shown once per session, and not at all if motion is unwelcome. */

Two notes on the fix itself. (1) Do NOT "solve" this by adding pointer-events:none to #intro at index.html:43 — that would let taps through to controls the visitor cannot see, which is worse than a dead tap. If the tap-blocking is judged unacceptable, the correct change is to cut the 1.15s delay at :44, not to make an opaque overlay transparent to input. (2) The accuser's proposed wording ("it does hold the view for about 1.6 seconds, which is the whole cost of it") is good but is itself now slightly untrue as an absolute — holding the view is NOT the whole cost, the input block is the other half. My wording fixes an overclaim without introducing a smaller one.

## 45. [MINOR] index.html (what’s-on home) · line 481

> <span>${day.count} gig${day.count===1?'':'s'}</span>

**Verdict:** FALSE — confirmed, but conditional: the header is only wrong while a search query is active. Severity minor (cosmetic self-contradiction on the secondary page, index.html, not the /about landing page).

**Evidence.** /Users/perryidyll/Docs/MySet/public/index.html:445-448 (filter), :449 (correct filtered total), :481 (prints unfiltered day.count); /Users/perryidyll/Docs/MySet/netlify/functions/events.mjs:138 (d.count = d.gigs.length + ((d.featured||[]).length), computed server-side before any client filtering)

**Skeptic (high).** I read the code rather than the claim, and every link in the chain is there.

events.mjs:138 stamps `d.count = d.gigs.length + ((d.featured || []).length)` on the server, after featured rows are moved but before anything reaches the browser. There is no second, filtered count in the payload — `grep -n count netlify/functions/events.mjs` shows :138 is the only place `d.count` is written.

index.html:445-448 builds `shown` with an object spread: `days.map(day=>({...day, featured:(day.featured||[]).filter(...), gigs:day.gigs.filter(...)}))`. The spread carries `count` across verbatim and only `gigs`/`featured` are replaced, so `day.count` on the filtered object is still the server's pre-filter number.

index.html:481 then prints `${day.count} gig${day.count===1?'':'s'}` — the only use of `day.count` in the whole file (grep confirms one hit). So a day holding six gigs, searched down to one matching row, renders a header saying "6 gigs" over a single row.

I looked for the escape hatches a skeptic should look for and found none:
- No other code path. `renderFeed` is called at :423 with '' and from the search input's `oninput` at :452, so the search branch is live user behaviour, not dead code.
- Not a doc misread. The accuser cited executable lines, not comments; the comments at :419-421 and :482-484 are unrelated.
- The sentence is not carefully worded in a way that saves it. "6 gigs" is an unqualified statement about the day, sitting directly above the filtered list.
- Nothing recomputes it downstream. `count` appears nowhere else in index.html, and no other public page has this pattern (`gigMatches`/`renderFeed`/`dayhead` are index.html-only).

One thing makes it marginally WORSE than stated: the page contradicts itself on the same screen. The endcard at :449/:497 correctly prints `${total} match…` from the filtered arrays, so a user searching one act on a busy night sees "6 gigs" in the day header and "1 match" in the footer at once. It is a visible inconsistency, not merely a stale number.

Two things make it no worse than minor: the wrong number only appears while a query is in the box (with `words` empty the filters are no-ops and the header is exactly right), and this is public/index.html — the what's-on home — not public/about.html, the landing page under audit.

I did not independently verify the accuser's mitigating claim that the busiest production day currently holds one gig; that would need live blob access, and the defect stands on the code either way.

**Fix.** Drop the ternary and derive the number from what is actually rendered, so it can never drift again. Replace the map head at index.html:480-481 with a block body:

  $('#out').innerHTML=box+shown.map(day=>{
    const n=day.gigs.length+(day.featured||[]).length;
    return `
    <div class="dayhead"><b>${esc(day.label)} <em>– ${dayMonth(day.date)}</em></b><span>${n} gig${n===1?'':'s'}</span></div>
    ...same body...`;}).join('')

Why this beats the proposed `words.length ? ... : day.count`: in `shown`, `day.gigs`/`day.featured` are ALWAYS the post-filter arrays (:445-447), and with `words` empty `gigMatches` returns true for every row (:110), so the computed `n` already equals `day.count` in the no-search case — the branch is dead weight. The proposed patch also only fixes the number, not the `gig/gigs` pluralisation on the same line, which reads off `day.count` too; a single `n` fixes both. And a derived-from-rendered count stays correct if any further client-side filtering is ever added (a city or "on now" filter, say), whereas the `words.length` branch silently breaks again.

## 46. [MINOR] index.html (what’s-on home) · line 597

> It has to be Safari on an iPhone — Chrome on iOS can’t add to the home screen.

**Verdict:** FALSE — confirmed, and wider than reported. The sentence is rendered copy shown to every iPhone user agent (Chrome included, since detection is `/iPad|iPhone|iPod/` only), no code path makes it true, and the identical false claim appears a second time in the Artist Studio.

**Evidence.** public/index.html:597 (the claim), public/index.html:563 (Safari-specific step 1 that must change with it), public/index.html:516 and 560 (UA detection routes Chrome-on-iPhone to the iOS branch), public/index.html:514-515 (INSTALLED detection is browser-agnostic, so nothing depends on Safari), public/studio.html:3244 (the duplicate claim), public/studio.html:3232 (its Safari-specific step), public/studio.html:3152 and 3196 (the real, correct iOS install gate the copy sits under), netlify/functions/_session.mjs:121 (the codebase already recognises CriOS server-side)

**Skeptic (high).** I tried to break this finding and could not. Four angles, all failed to save the page:

1. IS THERE A CODE PATH THAT MAKES IT TRUE? No. I read the whole install feature. The only Safari-related logic is UA sniffing: `public/index.html:516` sets `IOSISH = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1)`, and `public/index.html:560` sets `OS = ANDROIDISH && !IOSISH ? 'android' : 'ios'`. Chrome for iOS ships a UA containing "iPhone", so a Chrome-on-iPhone visitor lands on the iOS branch and is shown line 597 verbatim. There is no browser detection anywhere in the install code — nothing distinguishes Safari from Chrome, so nothing anywhere in the app depends on Safari being the browser that did the adding. The repo actually knows CriOS exists, but only server-side for device labelling (`netlify/functions/_session.mjs:121`).

2. IS THE ACCUSER READING A COMMENT OR A DOC AS BEHAVIOUR? No. This is literal rendered copy, injected into the install sheet's `<p class="sheetfoot">` by `drawA2HSSheet()` (`public/index.html:596-598`). Every iPhone visitor who opens the sheet reads it.

3. IS THE SENTENCE MORE CAREFULLY WORDED THAN NOTICED? No — it is the opposite. "It has to be Safari" is the hardest possible framing; there is no hedge, no "easiest", no "we've only tested". The accuser's characterisation of it as a stated hard requirement is exact.

4. IS THE WORLD-FACT WRONG? I could not device-test, so I weighed it carefully. Chrome for iOS has carried Add to Home Screen in its own share menu since iOS 16.4 (March 2023), when Apple opened Home Screen web app creation to third-party browsers; Edge and Firefox on iOS have the same. That is a three-year-old, well-established platform change, not a marginal or disputed one. The only population for whom line 597 is true is iPhones still on iOS 16.3 or older. And because the resulting web app is WebKit-backed either way, `INSTALLED` (`public/index.html:514-515`, via `display-mode: standalone` / `navigator.standalone`) resolves true for a Chrome-added install exactly as for a Safari-added one — so there is no functional harm hiding behind the wrong sentence, only misdirection.

WHERE THE FINDING IS UNDERSTATED — the problem is WIDER than reported. The same false sentence exists a second time, in the Studio: `public/studio.html:3244` — "It has to be <b>Safari</b> — Chrome on iPhone can't add to the home screen." That one sits inside `openStudioInstall()`, the sheet an artist is sent to when push alerts are blocked (`public/studio.html:3196`, the `ios-not-installed` state). The gate itself is honest and correct — `pushState()` at `public/studio.html:3152` blocks on `PUSH_IOS && !PUSH_INSTALLED`, which is a real iOS rule — but the instructions under it tell a Chrome-using artist to go and install a different browser before they can receive song-request alerts. Fixing only index.html leaves the higher-stakes copy wrong.

WHERE THE PROPOSED FIX IS TOO SMALL. Rewriting only the footnote leaves step 1 contradicting it: `public/index.html:563` still reads "Tap <b>Share</b> at the bottom of Safari", and `public/studio.html:3232` reads "Tap <b>Share</b> in Safari". A Chrome user told in the footnote that their browser works, then told in step 1 to use Safari's bottom bar, is worse off than before — Chrome on iOS puts share behind the address-bar/⋯ menu, not a Safari bottom bar. The step text has to move with the footnote, in both files.

So: not refuted. Status FALSE stands, severity minor on the landing page, and I'd raise it to minor-to-moderate for the Studio copy since it stands between a paying artist and a working feature.

**Fix.** Fix both files, and move the step text with the footnote — not the footnote alone.

public/index.html:563 — make step 1 browser-neutral:
  ['Tap <b>Share</b> — the bottom bar in Safari, the <b>⋯</b> menu in Chrome', 'the square with an arrow coming out of it'],

public/index.html:597 — replace the footnote:
  ? 'Easiest in <b>Safari</b> — but Chrome, Edge and Firefox on iPhone can all do it too, same <b>Add to Home Screen</b> in their own share menu.'

public/studio.html:3232 — same treatment:
  ['Tap <b>Share</b>','the bottom bar in Safari, the ⋯ menu in Chrome'],

public/studio.html:3244 — replace the footnote:
  ? 'Easiest in <b>Safari</b> — Chrome, Edge and Firefox on iPhone can do it too, same <b>Add to Home Screen</b> in their share menu.'

Why this is better than the proposed fix: (a) it covers the second occurrence, which the finding missed and which gates push alerts for artists; (b) it removes the step-1 contradiction, so a Chrome user is not told "your browser works" and then handed Safari's UI; (c) it keeps Safari as the recommended path — which is honest, since Safari's share sheet is where the option is most discoverable — instead of flattening the two to equal.

Optional, only if Perry wants to be exact rather than brief: the claim is still true on iOS 16.3 and older. That is a vanishingly small share three years on, and I would NOT add a version caveat to a six-second install sheet — it costs more clarity than it buys accuracy.

## 47. [MINOR] Head, nav & hero · line 24

> <meta name="twitter:card" content="summary_large_image" />

**Verdict:** CONFIRMED - OVERSTATED, severity minor on /about alone. The tag promises a large-image card that the only supplied image cannot fill, so X centre-crops to about 24% of its height. But the finding should be re-scoped: the more consequential instance is public/artist.html:23, where og:image is a relative path and so probably yields no share image at all, plus index.html and vote.html having no share image or card tag.

**Evidence.** public/about.html:21-24 (og:title/og:description/og:image/twitter:card, no twitter:image); public/about/vote.png = 640x1385 via sips, centred 1.91:1 crop keeps y=525-860, opened and inspected; netlify.toml:3-5 (no build command, publish="public") and netlify.toml:47-49 (/about is a static 200 rewrite); netlify.toml:125-128 (noindex scoped to /stage.html only); public/artist.html:23 (relative og:image "/img/band.jpg"); public/index.html:22-23 and public/venue.html:21-22 (no og:image); public/vote.html:12-29 (no og tags); public/img/band.jpg = 1600x898

**Skeptic (high).** I could not refute this. I re-checked every load-bearing fact myself rather than trusting the accuser.

WHAT I CONFIRMED PERSONALLY
1. The head is exactly as described. public/about.html:12-29 contains only: og:title (21), og:description (22), og:image = https://myset.vip/about/vote.png (23), twitter:card = summary_large_image (24). No twitter:image, no og:url, no og:type.
2. Nothing rewrites it. netlify.toml has NO build command (publish = "public", functions only), so about.html ships byte-for-byte; /about is a plain 200 rewrite to /about.html (netlify.toml:47-49). I grepped every .html and .js in public/ for `meta[property=`, `querySelector('meta`, and og/twitter writes — zero hits. There is no other code path that supplies a card image.
3. The image really is that tall. `sips` on public/about/vote.png returns 640 x 1385, ratio 0.462:1.
4. I did the crop rather than imagining it. I made a centred 640x335 cut (1.91:1) and opened it. The accuser's band is right: it holds the bottom sliver of "Voting open", the "UP NEXT" header, row 1 "Wish You Were Here / Pink Floyd / Winning - plays next" and the top of row 2 "Landslide". The "Sam Cole / Live - The Lantern" header, the whole PLAYING NOW / Hey Jude gradient card and the Lyrics button are all outside it. 335/1385 = 24% of the height kept.
5. Not blocked from crawlers - there is no robots.txt, and the only X-Robots-Tag noindex in netlify.toml:125-128 is scoped to /stage.html.

WHERE THE ACCUSATION IS WEAKER THAN STATED (two corrections)
A. "It will not show the product" is too strong. The band that survives the crop is the ranked vote queue with a numbered #1 and the words "Winning - plays next". That is arguably the single clearest frame of the product in the whole file. What the crop actually costs is identity and context - the artist name and the PLAYING NOW card - not the product idea. Rewrite the finding as "the card loses the brand and the now-playing frame", not "shows nothing".
B. Half the cited evidence is inert. Missing twitter:title and twitter:description cause no defect at all - X falls back to og:title/og:description, which are both present. og:url and og:type are likewise inferred by every major crawler from the request URL. So two of the three tags in the proposed fix (og:url, og:type) fix nothing visible; only twitter:image (or a re-cut og:image) changes what renders. Listing four "missing" tags makes the defect look four times bigger than the one tag that matters.

WHERE IT IS WIDER THAN STATED (the part the accuser missed)
about.html is the ONLY page on the site with a working absolute og:image, and the only page with a twitter:card at all. Meanwhile:
- public/artist.html:23 sets og:image="/img/band.jpg" - a RELATIVE path. Open Graph requires an absolute URL; crawlers do not reliably resolve it, so artist pages - the URLs fans actually paste into a group chat - most likely share with no image. That is a straight bug, not a taste call, and it is on a higher-traffic surface than /about.
- public/index.html:22-23 has og:title and og:description and no og:image and no twitter:card.
- public/venue.html:21-22 the same.
- public/vote.html (lines 12-29) has no og tags whatsoever, and it is the single most-shared URL in the product.

BETTER FIX THAN PROPOSED
Cut one 1200x630 card (headline over the phone shot) at /about/card.png, and add exactly one tag beside the existing ones: <meta name="twitter:image" content="https://myset.vip/about/card.png" />. Skip og:url and og:type - they buy nothing. Then, in the same pass and worth more than the /about card: make artist.html:23 absolute (https://myset.vip/img/band.jpg) and give index.html and vote.html an absolute og:image plus twitter:card. Stopgap that needs no design work: public/img/band.jpg is already 1600x898 (1.78:1), close enough to card ratio to use today on index and artist while a proper card is cut. One caution on reusing vote.png as a card source - it is itself a right-clipped screenshot ("Tip Sam", "Birthday shout" and body text run off the right edge), so the card needs a fresh capture, not a crop of this file.

**Fix.** Add ONE tag to about.html beside the existing ones - <meta name="twitter:image" content="https://myset.vip/about/card.png" /> - pointing at a freshly captured 1200x630 card (headline over the phone shot; do not crop vote.png, it is already clipped on the right edge). Drop og:url and og:type from the proposal: every major crawler infers both, so they fix nothing. Then fix the bigger instances in the same pass: make public/artist.html:23 an absolute URL (https://myset.vip/img/band.jpg) since relative og:image is not resolved by crawlers, and give public/index.html and public/vote.html an absolute og:image plus twitter:card - vote.html is the most-shared URL in the product and currently has no share metadata at all. public/img/band.jpg (1600x898, 1.78:1) is a usable stopgap card image for index and artist until a designed card exists.

## 48. [MINOR] Head, nav & hero · line 268

> @media (prefers-reduced-motion:reduce){ .anim .up{…} *{animation-duration:.01ms!important} }

**Verdict:** OVERSTATED — but in the opposite direction from the accusation. The CSS limb is refuted outright (public/app.css:190-192 already clamps transition-duration, animation-iteration-count and scroll-behavior globally, and about.html:29 loads it). The finding narrows to one real defect: the JS count-up ignores prefers-reduced-motion. Severity minor, three numbers, 1.1 s.

**Evidence.** public/app.css:190-192 (the global clamp, loaded by public/about.html:29) refutes limb (a). public/about.html:794-804 (count(), 1100 ms rAF, unguarded) and public/about.html:788 (the IntersectionObserver that calls it) confirm limb (b). public/about.html:486-489 shows only three of the four counters visibly move.

**Skeptic (high).** Half the accusation collapses; the other half survives and I confirmed it personally.

REFUTED — limb (a), "the rule clamps animation-duration but not transition-duration, so every CSS transition still runs at full length". That is false. about.html is not self-contained: public/about.html:29 loads `<link rel="stylesheet" href="/app.css">`, and public/app.css:190-192 already carries the full global clamp:
  @media (prefers-reduced-motion:reduce){
    *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;
      transition-duration:.01ms!important;scroll-behavior:auto!important}
  }
I verified the block is top-level, not nested (brace count before line 190 is 87 open / 87 close) and that it is well-formed. `transition-duration:.01ms!important` on `*,*::before,*::after` beats every non-important declaration regardless of specificity, so all four transitions the accuser cited are already dead under reduced motion: .pill :59, .big :93, .vb :143, and summary::after :245. `scroll-behavior:auto!important` is covered too. The accuser's own method produced the error — `grep -n 'matchMedia|prefers-reduced' public/about.html` returns one hit precisely because it never looked at the linked stylesheet. Grepping the whole directory returns public/app.css:190 and public/pull.js:41 as well.

A second, smaller correction: three of the transitions the accuser did NOT cite (.drow :126, .drow .pos :130, .drow .n b :137) never fire at all, reduced motion or not — draw() at about.html:743-756 replaces `list.innerHTML` wholesale on every vote, so the rows are destroyed and recreated rather than moved, and a freshly inserted element has no before-change style to transition from. The demo's "motion" is an instant re-render.

Third: the inline `*{animation-duration:.01ms!important}` at about.html:270 is pure redundancy. It duplicates app.css:190, and about.html defines zero @keyframes of its own and uses none of app.css's animated classes (.rise/.stagger/.ping/spinner/skeleton — grep for those class names in about.html returns nothing). So the accuser proposed adding a property to a rule that is already inert.

SURVIVES — limb (b), the JavaScript counter. This one is real and no CSS can reach it. public/about.html:794-804, count() runs a fixed 1100 ms requestAnimationFrame ease-out with no guard, and the IntersectionObserver at :788 calls it on every [data-to] node. I checked every stylesheet and script the page loads: the only reduced-motion handling anywhere is CSS (app.css:190, pull.js:41), and no script sets a body class the counter consults. So a visitor who asked their OS for reduced motion still watches numbers spin for 1.1 s.

Scope is smaller than stated, though: there are four [data-to] nodes (about.html:486-489) but one is `data-to="0"`, which counts 0→0 and never visibly moves. Three numbers spin, not four. Severity minor stands — and it is a safe fix, because the final values (8, 21, 0, 100%) are already in the HTML as static text, so the guard only prevents JS from overwriting correct markup with an animation.

**Fix.** Drop the CSS edit entirely — it changes nothing (app.css:190-192 already does it) and it would add a fourth copy of a clamp that is already duplicated between app.css and about.html:270. If anything, delete the redundant `*{animation-duration:.01ms!important}` at about.html:270 and leave `.anim .up{opacity:1;transform:none;transition:none}` at :269, which is the one line in that block doing work app.css cannot do.

Apply one guard, inside count() at public/about.html:794, so it covers the single choke point:

  function count(el) {
    if (matchMedia('(prefers-reduced-motion:reduce)').matches) {
      el.textContent = el.dataset.to + (el.dataset.suffix || '');
      return;
    }
    ...

Use `el.dataset.to` rather than the accuser's local `to`. `to` is `Number(el.dataset.to) || 0`, so a non-numeric or missing data-to would silently render "0"; reading dataset.to directly makes the reduced-motion branch produce byte-identical output to the existing no-IntersectionObserver fallback at about.html:781, which is already `n.dataset.to + (n.dataset.suffix || '')`. Two paths that must agree should be written the same way.

Comment worth keeping, adjusted to what is actually true here: the CSS clamp in app.css catches every transition and keyframe on the page — it cannot catch a number that JavaScript redraws 60 times a second, and a number moving for a second is motion whatever the stylesheet says.

## 49. [MINOR] Head, nav & hero · line 305

> What the room sees.

**Verdict:** Caption copy: SUPPORTED, leave the words alone. Asset: BROKEN, severity moderate (not minor) — public/about/vote.png is truncated ~20% on the right, losing the vote counts. Alt text at about.html:303: UNSUPPORTED — it asserts a "7" that is cropped out of the image.

**Evidence.** public/about.html:305 (full caption, no "in full"); public/about.html:303 (alt text asserting "winning the vote with 7"); public/about.html:301 (plain .phone, not .phone.tall); public/about.html:105 (width:100%;height:auto — no CSS crop); public/about.html:106 (.phone.tall is the only object-fit:cover rule, unused here); public/about/vote.png (640x1385, truncated); public/about/ask.png and public/about/studio.png (same app, same scale, uncropped 32px right gutters — the control); public/vote.html:287-289 (fanId, no pre-screen); public/vote.html:772 (name field exists only for birthday shout-outs)

**Skeptic (high).** PARTIALLY REFUTED. The picture defect is real and I confirmed it in the pixels myself — but the accusation attacks the wrong artifact, quotes a phrase that is not on the page, gets one specific wrong, and rates the severity too low.

WHAT SURVIVES (confirmed independently): public/about/vote.png is truncated on the right. I read the PNG. The "PLAYING NOW" card, the "Voting open" pill, the "Birthday shout-out" button and "Tip Sam" all run off the right edge, and the "Top 3 by votes" label is sliced after its first letter. This is not a render artifact — about.html:105 is `.phone img{display:block;width:100%;height:auto;border-radius:32px}` with no object-fit, and the hero is a plain `<div class="phone">` (about.html:301), NOT `.phone.tall`, which is the only rule that crops (about.html:106). The loss is baked into the asset.

THE CROP IS BIGGER THAN THE ACCUSER SAYS. about/ask.png and about/studio.png are the same app captured at the same 640px width with identical content scale (the "Wish You Were Here" title starts at x=131 in both ask.png and vote.png; the "1" badge sits at x=84 in both) — and both siblings have clean 32px right gutters with everything intact. So vote.png is the outlier: same scale, wider source viewport, truncated rather than downscaled. Reading landmarks across the pair (in ask.png "Top 3 by votes" ends at x=583; in vote.png it BEGINS at x=632), the true frame is roughly 820px wide. About a fifth of the screen is missing, not a sliver.

WHERE THE ACCUSER IS WRONG:

1. "in full" is not on the page. The full caption at about.html:305 is "What the room sees. That's the whole thing they have to do." The accuser is judging the copy against a completeness phrase the copy never uses; I grepped and "in full" appears nowhere in the caption. "What the room sees" is a deictic label for the screenshot — this is the fan's screen, as opposed to the artist's — not an assertion that every pixel of it is present. Status OVERSTATED against the caption text does not hold.

2. The vote BUTTON is not cropped off the right. It lives in the "VOTE FOR THESE" section, which ask.png shows at y≈1240 with a "Vote" pill. vote.png simply stops above that section — it is below the bottom of the shot, not lost to the right crop. What the crop actually costs is the vote COUNTS ("7 votes / 5 votes / 4 votes", all clearly present in ask.png), the votes-left chip ("3/3" in ask.png's header), and the right halves of the Playing Now card, Birthday shout-out and Tip Sam.

3. Severity is not minor. This is the above-the-fold hero image, and the one element the crop destroys is the vote tally — the single thing the entire page is selling ("The room picks the next song"). Worse, cards visibly running off the edge INSIDE a drawn phone frame do not read as a cropped photo; they read as a broken app.

WHAT THE ACCUSER MISSED (a real, separate discrepancy, and a cleaner one): about.html:303 alt="The voting page: Hey Jude playing now, and Wish You Were Here winning the vote with 7". The "7" is cropped out of the image. The accessible description asserts a number the picture does not contain. Per Perry's own doctrine that pictures are claims too, the alt text is the unsupported claim here — not the caption. That is where the "asserts what it does not show" finding actually belongs.

The second sentence checks out on its own terms: fanId() (vote.html:287-289) mints a local id with no prompt, and the only name field in the flow is for a birthday shout-out (vote.html:772), not for voting.

**Fix.** Fix the picture, not the sentence. Re-capture vote.png at the same viewport that produced ask.png and studio.png — those two prove the correct capture width, and it already matches the declared width="640" height="1385" at about.html:302. Then correct the alt text if the re-shot still does not show the tally.

REJECT the proposed fallback caption "Part of what the room sees." It patches a broken asset in the copy layer, spends a clause apologizing for the product's own hero image, and breaks the show-don't-tell discipline — you never argue with your own screenshot. If the shot genuinely cannot be re-taken, crop vote.png down to the intact left portion so nothing visibly runs off the edge (a tight phone shot reads as deliberate; a bleeding one reads as a bug), or reuse the queue view from ask.png, which already shows the same three songs WITH their vote counts. Either way the caption stands as written.

Additionally, since the number in the alt text is not visible in the current asset, either restore it by re-capturing or drop "with 7" from about.html:303 in the same pass — otherwise a screen-reader user is told a fact sighted users cannot see.

## 50. [MINOR] Scene & demo · line 332

> Tap a song.

**Verdict:** PARTIALLY REFUTED — the line cited (about.html:332 "Tap a song.") is correct as written and needs no change. The genuine discrepancy is one line down, at about.html:333-334, and it is wider than reported: severity moderate, not minor.

**Evidence.** public/about.html:332 (the accused line — sound); public/about.html:333-334 (the actual false claim); public/about.html:763-769 (demo casts on one tap AND refunds on a second); public/vote.html:726 and :640 (both call openVote); public/vote.html:412-423, :434-483, :505-510 (sheet → stepper → Confirm); public/vote.html:421-422 and :447 (finality: no take-backs); netlify/functions/_flags.mjs:28-35 (voteFinal default true); netlify/functions/vote.mjs:13-16, :18-34

**Skeptic (high).** I confirmed every code fact the accuser cites, and one they missed. But the finding is MIS-ANCHORED, and the real defect is wider than "minor".

WHAT I VERIFIED MYSELF
- public/about.html:763-769 — the demo handler fires on `.vb[data-id]`; :769 is the cast branch (`mine.add(id); row.n++; left--`), :768 is the un-vote branch. One tap, no confirmation.
- public/vote.html:726 — every row's Vote button is `onclick="openVote('${s.id}')"`. :640 (the compact/quick list) calls the same function. There is no other call site: `grep -n "vote("` in vote.html returns only :509 (inside confirmVote) and the :512 definition. So there is NO code path in the product where a tap casts.
- public/vote.html:412-423 openVote → :434-483 drawVoteSheet renders a −/+ quantity stepper and a `Confirm` button → :505-510 confirmVote is what calls vote(). Two-step, always.
- netlify/functions/vote.mjs:13-16 and :18-34 corroborate from the server ("The sheet in vote.html asks"; one press of Confirm = one cast id).
- `git show d03c033:public/vote.html` line 340 does read `onclick="vote('${s.id}')"`. The one-tap era was real.

WHERE THE ACCUSER IS WRONG
Line 332 is not a defect. It is an `<h2>` sitting directly under the kicker "Try it — right here" (:331) and directly above the demo widget (:336). It is an imperative addressed to the reader about the widget on this page, and it is true of that widget. It is also still true of the product: the gesture there does begin by tapping a song (vote.html:726). Nothing on line 332 says "one tap", "and that's it", or "done" — and the page's actual "one tap" phrases (:386, :455) are about the ARTIST's play control, not the fan's vote. A sentence that is true cannot be "stale"; stale means it was true and became false, and this one never described the cast mechanism.

WHERE THE PROBLEM ACTUALLY IS — AND IT IS WORSE
The equivalence claim is on the next two lines, :333-334: "This is the real thing, running on this page… That's exactly what forty people do at once." That is the sentence that asserts demo = product, and it fails on TWO axes, not one:
 (a) the cast is two-step in the room (the accuser's finding);
 (b) the accuser missed this one — the demo lets you tap "Voted" and get your vote and your credit back (about.html:768: `mine.delete(id); row.n--; left++`). In production that is forbidden. netlify/functions/_flags.mjs:28-35 sets `voteFinal.default: true` ("ON as of 2026-09-02, at Perry's decision"), and vote.html:421-422 shows that with finality on, openVote does NOT route to openUnvote — a second tap opens the sheet to ADD more votes, and vote.html:447 tells the fan "Once you confirm, that's final — votes can't be taken back."

So the demo teaches a fan two things the room will refuse: that voting is instant, and that it is reversible. (b) is the one that would actually annoy someone, which is why I'd call this moderate, not minor.

The accuser's proposed fix also edits the wrong line and only patches (a).

**Fix.** Leave line 332 alone — "Tap a song." is the instruction for the widget and it is true.

Replace the lede at 333-334, which currently over-claims with "the real thing" and "exactly", and cover BOTH gaps:

  <p class="lede">This is the demo, live on this page — vote and watch the queue move.
    In the room it's the same idea with one extra step: tapping a song opens a sheet
    where you say how many votes to put on it, and confirm. Once you confirm, they
    stay on that song.</p>

That drops "exactly", keeps the invitation intact, and states the two things the widget can't show (the confirm step, and finality) in Perry's plain register.

Optional second half, if the goal is fidelity rather than a caveat: also delete the un-vote branch at about.html:768 so tapping "Voted" no longer hands the credit back. Keep the demo one-tap — the comment at :729-732 is right that a one-tap try is why it earns its place above the screenshots — but stop it teaching a reversal the product forbids. If :768 is removed, the third sentence above can shorten to "Once you vote, it stays on that song."

## 51. [MINOR] Scene & demo · line 745

> const sorted = [...rows].sort((x, y) => y.n - x.n || x.t.localeCompare(y.t));

**Verdict:** FALSE — confirmed, severity minor (borderline moderate: the divergence is reachable in one tap, at the #1 position, and the demo's own caption asserts the wrong winner)

**Evidence.** public/about.html:745 (count→title sort) vs netlify/functions/_lib.mjs:792-798 (rankSongs: count → first-vote → title); stamps netlify/functions/vote.mjs:123, collected netlify/functions/_lib.mjs:778-788; consumers netlify/functions/show.mjs:78, netlify/functions/stage.mjs:72, netlify/functions/admin.mjs:1796; no client-side rescue — public/vote.html:558-563 returns the server order unchanged for the default sort set at public/vote.html:541; rule predates the page: git show d03c033:netlify/functions/_lib.mjs:434-441; fidelity claim in copy at public/about.html:333-334; wrong-winner caption at public/about.html:759; seed 5/4/2/1 with 3 votes at public/about.html:735-740

**Skeptic (high).** I looked for every escape route and none exists. (1) No other code path makes count-then-title true: rankSongs is the only ordering rule for "what plays next", and all three consumers (show, stage, playTop) call it. The fan page does not re-sort — public/vote.html:558-563 carries a comment saying the default 'votes' mode "keeps the server's ranking (votes desc -> voted-first -> title)" and its applySort returns the list untouched, so the client honours the server key. Its alphabetical modes are opt-in browse orders behind a sort bar the demo does not have. (2) The accuser is not reading a comment as behaviour — the comparator itself at _lib.mjs:794-797 is the three-key sort; the vote.mjs:123 comment merely labels a real `me.ts[song] ||= Date.now()` write, and firstVotedAt at _lib.mjs:778-788 really reduces those stamps to a per-song minimum. (3) The page does not disclaim the demo — it does the reverse: "This is the real thing, running on this page. Vote and watch the queue move. That's exactly what forty people do at once" (about.html:333-334), which raises the fidelity bar rather than lowering it. (4) The sentence is not more carefully worded than noticed; it is executable code, and the caption it drives states a conclusion ("<b>X</b> is winning, so that's what plays next", about.html:759) that is exactly rankSongs' claim. (5) It predates nothing — d03c033, the commit that added about.html, already contains the identical three-key sort. The problem is marginally WIDER than stated: with the seed 5/4/2/1 and three credits, the single most obvious first interaction (tap the runner-up to tie the leader) makes the challenger take the lead alphabetically and prints the wrong winner in prose, so the demo teaches the inverse of the real rule at the one position that matters. It is still cosmetic in dollar terms, so minor stands. The proposed fix, however, is wrong: '(x.at || Infinity)' sends every unstamped seeded row to the BACK of a tie, while a just-tapped song gets a finite Date.now() and sorts to the FRONT — so tapping Landslide still dethrones Wish You Were Here, and Fast Car still jumps Tennessee Whiskey. The seeded rows already carry votes and therefore need stamps EARLIER than any tap, not later.

**Fix.** Give the seeded rows monotonically increasing stamps that sit BEFORE any tap, then stamp a tap with a later value, and sort on the same three keys as rankSongs. In the SEED array (about.html:735-740) add `at:` in board order — a:1, b:2, c:3, d:4 — representing "already voted for, in that order". Add a demo clock: `let clock = 100;` (any value above the seeds). In the click handler (about.html:766-770), on the cast branch only, stamp the first arrival: `else { if (left <= 0) return; mine.add(id); row.n++; left--; row.at = row.at || ++clock; }` — `||` on purpose, mirroring vote.mjs:123's `||=` so a seeded song keeps its original stamp and un-voting never re-dates it. Then line 745 becomes: `const sorted = [...rows].sort((x, y) => y.n - x.n || (x.at || Infinity) - (y.at || Infinity) || x.t.localeCompare(y.t));`. Result: tapping Landslide ties 5-5 and Wish You Were Here KEEPS the lead (at 1 < 2), tapping Fast Car ties 2-2 and Tennessee Whiskey stays above it (3 < 4) — both matching rankSongs, and the "X is winning" caption now names the song the Studio would actually start. No visible copy changes, and the static no-JS fallback markup (about.html:340-352) already lists the songs in this order so it stays correct too. Optional one-line polish, not required: the demo's third key uses plain localeCompare, which matches the server's `a.title.localeCompare(b.title)` at _lib.mjs:797 exactly — do NOT copy vote.html's sensitivity:'base' collator here, that is a browse-sort nicety and would drift from the server.

## 52. [MINOR] The night 1-2 · line 389

> [the studio.png screenshot placed beside beat 2's copy]

**Verdict:** STALE, severity minor (upheld, and marginally sharper than stated)

**Evidence.** public/about.html:389 (img src="/about/studio.png" width="640" height="1385"); the image itself at public/about/studio.png (read visually: 6 tabs, header-right Voting Open/Paused toggle, plain "Sam Cole", Now-playing card with no chart button); public/studio.html:2539-2547 (7 tabs, Merch at 2545), :2531-2533 (whoami ↗ link, gated on s.slug), :2535-2537 (Upgrade/plantag button, gated on PLAN&&PLAN.ok), :1869-1876 (full-width .votebox below the tab bar with "Fans can vote right now" / "Paused — nobody can vote until you re-open"), :1885-1888 ("Key of X" line gated on now.key, "☰ My chart" button unconditional when a song is playing), :1881-1883 (the three stat tiles Votes now / Voting · in room / Tips still rendered in the same order); git log --oneline -- public/about/studio.png returns only d03c033, and git show d03c033:public/studio.html:1126-1142 renders exactly the six-tab bar and header toggle seen in the picture; 30 commits have touched public/studio.html since d03c033; public/about.html:628 sells "Merch on your page"

**Skeptic (high).** I tried to break this one and could not. I opened the PNG and looked at it, read today's studio.html at every line cited, and diffed against the commit the file was added in.

All five points are true as written:
1. The picture has six tabs. studio.html:2539-2547 renders seven; Merch sits between Profile and Settings at line 2545, unconditionally. d03c033's studio.html:1137-1142 renders exactly the six in the picture.
2. The picture has the Voting Open/Paused toggle in the header top-right — that is d03c033's markup at :1126-1133. Today that toggle lives in a full-width .votebox below the tab bar (:1869-1876) with the "Fans can vote right now" / "Paused — nobody can vote until you re-open" line.
3. The header's right slot now carries an Upgrade or plan-tag button (:2535-2537).
4. The artist name is now a link with a ↗ (:2531-2533).
5. The Now-playing card carries "☰ My chart" and can carry "Key of X" (:1885-1888).

Two small softenings, neither of which rescues the image: the Upgrade/plantag button is conditional on PLAN&&PLAN.ok, and the ↗ link on s.slug — so points 3 and 4 read "in a normal signed-in studio" rather than "always". The accuser worded point 5 carefully already ("can show").

The accuser is also right that nothing in the picture is a false claim: the three figures the alt text names are still rendered in the same three tiles (:1881-1883), the requests panel header and "✕ refunds their votes" are unchanged (:2634-2635), and "End the show" / "Start top voted" are still there (:1917-1924). So minor is the right severity.

I checked whether the problem is wider. It is not: the sibling shot public/about/vote.png is also from d03c033, but every element in it — the Lyrics button, "Voting open", "Up next", "Not on the list?", "More votes", "Tip Sam" — is still rendered in today's vote.html (:614-626, :708-709, :741). That one is fine. So this is a single stale asset, not a pattern.

One thing that makes it a hair sharper than stated: about.html:628 sells "Merch on your page" as a Pro feature, and the screenshot four hundred lines above it shows a Studio with no Merch tab. The page is quietly contradicting its own feature list, not just showing an old build.

I did not modify anything in the repo.

**Fix.** Keep the accuser's fix — retake the Live tab — but add four things it misses, or the retake will create a new defect:

1. MATCH THE ASPECT RATIO OR UPDATE THE ATTRIBUTES. about.html:389 hardcodes width="640" height="1385" (ratio 0.462). Today's Live tab is taller above the fold than d03c033's: a seven-button tab bar plus the new full-width .votebox panel sit where the old header toggle used to be. A same-height crop will lose the bottom of the requests panel; a taller crop at 640px wide will be squashed unless the width/height attributes on line 389 are changed to the real pixel size. Whichever way it goes, line 389's attributes must be edited to the shot's actual dimensions.

2. SHOOT IT WITH VOTING OPEN. The votebox line is state-dependent (studio.html:1870-1871). With voting paused the panel reads "Paused — nobody can vote until you re-open", which flatly contradicts beat 2's copy about a live room. It must be shot in the Open state.

3. SHOOT IT WITH A SONG PLAYING AND NO NETS. The "☰ My chart" button only exists when there's a now-playing song (:1888). And the middle tile's label can now append "· N nets" (:1882) — shoot with nets off, or the alt text needs a fourth figure.

4. UPDATE THE ALT TEXT TO WHATEVER THE NEW NUMBERS ARE. Line 390's alt says "21 votes, 21 of 26 in the room, three requests waiting". Those three strings are coupled to the picture; if the retake's demo data differs by even one number the alt text becomes a fresh mismatch that no screenshot audit will catch, because alt text is invisible. Easiest path: reproduce the same demo state (21 votes, 21/26, 3 requests waiting) so line 390 needs no edit at all.

Optional, and worth raising with Perry separately: since about.html:628 sells Merch as a Pro feature, the retake showing the Merch tab is a small free win — the picture would then corroborate the feature list instead of quietly contradicting it.

## 53. [MINOR] The night 3-5 · line 429

> and every gig you've got coming

**Verdict:** OVERSTATED, minor — confirmed, and slightly wider than the accuser described

**Evidence.** public/about.html:429 ("your links and every gig you've got coming"); public/artist.html:359 (fetch `/events?a=...&days=90`); netlify/functions/events.mjs:44 (`Math.max(1, Math.min(120, ... || 60))` — a hard 120-day ceiling no client can exceed); netlify/functions/events.mjs:46-49 (`occurrencesFor(...).filter(o => o.endsAt > Date.now()).slice(0, 60)`); public/artist.html:439 (`const gigs=(G&&G.ok?G.gigs:[]).slice(0,24)`); public/artist.html:453-456 + 502-506 (first 3 rendered, rest behind a working "See N more" toggle); netlify/functions/admin.mjs:466-489 (eventSave — no plan check anywhere on the path); netlify/functions/_events.mjs:15 (`MAX_EVENTS = 200`, and lines 1-12 confirm these are recurrence RULES, not instances); netlify/functions/_plan.mjs:33 + _lifecycle.mjs:40-43 (the free plan's `gigs: 4` gates live SHOWS started, via gigCapFor, not calendar entries)

**Skeptic (high).** I tried to refute this four ways and could not.

1. Another code path? No. I grepped every fetch of the events API in public/*.html. Only three exist: artist.html:359 (days=90), and index.html:303/402 (the city picker and the town feed). There is no second, unbounded gig list on the artist page and no "all dates" view. The artist page's own render is the only place a fan sees the diary.

2. Reading a comment or a doc as behaviour? No. Every number I quote is executing code, not prose. I read the actual clamp in events.mjs:44, the actual .slice(0,60) at :49, and the actual .slice(0,24) at artist.html:439.

3. A condition the page never implied? No — "every" is the page's own word, and it sits in a list of things it claims the page holds in full ("your music, your links and every gig"). The other two items in that list genuinely are complete, which makes the third read as complete too.

4. More carefully worded than noticed? No. There is no hedge anywhere in the sentence or its paragraph.

The accuser is right on the two things that most often go wrong in this kind of finding, and I confirmed both independently. There is no publishing step and there is no plan gate: admin.mjs's eventSave (463-490) never calls planForArtist, and the free plan's `gigs: 4` is spent by gigCapFor at _lifecycle.mjs:40-43, which governs starting a live show, not listing a date. The 200 in _events.mjs:15 is a cap on RULES, so a weekly residency costs one slot forever — it is not a bound on gigs shown.

Where I'd correct the accuser, in both directions:

WORSE than stated: they missed events.mjs:44's hard `Math.min(120, ...)`. Even if artist.html asked for a year, the server would refuse — the four-month horizon is baked into the API, not just the client's query string. And their softening example picks the friendliest case. A weekly residency is thirteen nights in 90 days, well inside every cap, true. But a three-nights-a-week working act — the exact person this page is selling to — has roughly 39 occurrences in that window, so the 24-row slice at artist.html:439 silently drops about fifteen of them with no "and more" affordance. The display cap bites before the horizon does for a busy act, which is the reverse of the impression their write-up leaves.

SOFTER than stated: "showing three" reads worse than it is. I traced the toggle handler at artist.html:502-506 and it genuinely reveals the remaining rows, so all 24 are reachable in one click. Nothing is hidden except what the slice already discarded.

So: minor is the right severity — this is a horizon, not a lie about the feature — but the claim is untrue in the letter for a working act, which is not a hypothetical user here.

On the proposed fix, I'd do better. "the next three months of gigs" trades one inaccuracy for another: 90 is a constant in a client file, so the copy goes stale the moment someone edits artist.html:359, and it is not even the binding constraint for the busy act (24 rows is). Naming a number in marketing copy that lives in a JS template literal is a maintenance trap. The honest mechanism claim — gigs land on the page automatically, off the same calendar the Studio writes, on every plan, with no publishing step — survives untouched. Only the totality word is doing the overclaiming. Deleting one word fixes it, keeps Perry's rhythm and cadence, and commits to no number that can rot.

**Fix.** Delete one word rather than rewriting the sentence: "Your page holds your music, your links and the gigs you've got coming." Dropping "every" removes the totality claim while keeping the sentence's rhythm and the true mechanism (automatic, off the Studio calendar, no plan gate, no publishing step). It also names no number, so it cannot go stale when someone changes days=90 at public/artist.html:359 or the 24-row slice at :439 — which the proposed "the next three months of gigs" would. If a horizon must be stated for honesty's sake, put it on the app side instead: give the "See N more" toggle at public/artist.html:453-456 a trailing line when G.gigs.length is capped, rather than teaching the landing page a constant it cannot see.

## 54. [MINOR] The night 3-5 · line 433

> <img src="/about/profile.jpg" width="780" height="1500" loading="lazy">

**Verdict:** STALE — confirmed, and one change wider than reported (three visible drifts, not two). Severity minor is correct: no sentence of copy is falsified, only the picture.

**Evidence.** public/about.html:433-434 (the img + its alt); the image itself, /Users/perryidyll/Docs/MySet/public/about/profile.jpg — I rendered it and read the pixels: brandbar shows only "MySet ↗" with nothing to its right, and the stats grid is five tiles reading "Aug 2026 Joined / 2 Shows / 10 Audience / 23 Votes cast / 66 Songs". Current code: public/artist.html:411 renders 'Fans'; public/artist.html:414 renders the sixth Community cell; public/artist.html:241-247 renders an unconditional top-right hamburger <details class="menu"> in the same brandbar (CSS at :98-110, JS at :271-275 only rewrites hrefs/labels from localStorage — nothing hides it, and _flags.mjs has no menu flag). Screenshot committed d4d1a99 (2026-09-02), where git show d4d1a99:public/artist.html:344 still said 'Audience'; changed by 67f1d36 (2026-09-04).

**Skeptic (high).** I tried to refute this four ways and could not.

Another code path? No. The Community cell (artist.html:414) and the "Fans" label (artist.html:411) are emitted unconditionally inside the pstats template — the .filter(([v])=>v) only drops stat tiles with empty values, and the Community cell sits outside that map entirely, so it renders for every artist. The menu at :241 is static markup with no flag; _flags.mjs has no entry for it.

Doc read as code? No. I did not rely on the 67f1d36 commit message (though it does say "The 'Audience' stat is now 'Fans'" and "A Community button sits in the stats grid's sixth cell"). I read the current template lines and diffed against git show d4d1a99:public/artist.html:344, which still said 'Audience' at the time the picture was taken.

More carefully worded than the accuser noticed? Partly — and that is the one place the accusation overreaches. The alt text is carefully worded and is NOT stale; the proposed "update the alt text to match" is unnecessary. The surrounding prose is also careful and remains true. But the accusation's core claim is about the pixels, and I confirmed the pixels by eye: "10 Audience" is plainly on screen, and the grid has five tiles with an empty sixth slot where Community now goes.

Condition the page never implied? No — the page presents the image as a picture of the artist's public page, so it implicitly claims that is what the page looks like.

Worse than stated? Yes: the missing top-right menu is a third drift the accuser did not catch, and it sits in the same frame, at the very top.

**Fix.** Two corrections to the proposed fix.

1) WIDEN IT. The screenshot is three changes behind, not two. Besides "Audience"→"Fans" and the missing sixth Community tile, the whole top-right menu button added in 67f1d36 (public/artist.html:241) is absent from the shot — the brandbar in the picture ends at "MySet ↗". A re-shoot must be taken from the current page, not patched for the two named items.

2) DROP THE ALT-TEXT HALF. The alt at public/about.html:434 reads "An artist's public MySet page: band photo, bio, a live countdown to the next gig, show and vote counts, and tonight's venue with directions". It never says "Audience" and never names the renamed tile — "show and vote counts" is still literally true (Shows 2, Votes cast 23). Nothing in it is wrong today, so "update the alt text to match" is a fix for a defect that does not exist. If anything is added after the re-shoot it is optional descriptive polish (a Community link), not a correction.

Also worth recording as a mitigation on severity: the word "Audience" appears nowhere in public/about.html, and the prose beside the image (public/about.html:426-431) claims only music, links, upcoming gigs and the what's-on feed. No written claim on the landing page is falsified by the stale pixels — this is cosmetic drift in an illustration, which is why minor is the right severity even though it is now a three-item miss.

Suggested check to run at the same time: the other four screenshots (public/about/vote.png:302, studio.png:389, ask.png:403, fills.png:580) are all dated 2026-08-31, older still, and 67f1d36 also touched the Voting box and studio surfaces — they are more likely stale than this one, not less.

## 55. [MINOR] What changes & proof · line 442

> [no screenshot in 442-504]

**Verdict:** STALE — confirmed, and slightly wider than stated. Re-anchor the finding to public/about.html:433 (the image), not line 442. Severity minor, but bumped to minor+ because the same screenshot also predates the Community tile that about.html itself sells at lines 609 and 628.

**Evidence.** public/about/profile.jpg (I opened and viewed it — the stat grid in the picture reads "Aug 2026 Joined / 2 Shows / 10 Audience / 23 Votes cast / 66 Songs"); public/artist.html:410-411 now renders 'Joined','Shows','Fans','Votes cast','Songs'; public/artist.html:414 adds a sixth "Community" tile the picture does not contain; git show 67f1d36 -- public/artist.html lines 182-183 (-'Audience' / +'Fans', 2026-09-04 18:46); git log -- public/about/profile.jpg last touched d4d1a99 on 2026-09-02; the image is referenced at public/about.html:433 with alt text on :434.

**Skeptic (high).** I tried to break this and could not.

What I did: I opened the actual JPEG rather than reasoning from file dates. The picture plainly displays the word "Audience" under the number 10. The live code at public/artist.html:411 renders "Fans". So the mismatch is directly observable in the shipped asset, not inferred — the accuser's argument was weaker than the truth available, because they reasoned only from mtime plus a diff. I also confirmed the rename is real behaviour and not a comment or a doc: it is inside the template literal that builds .pstats, committed as 67f1d36 on 2026-09-04, well after the image's last commit d4d1a99 on 2026-09-02.

The three escapes I looked for, and why none worked:
- Another code path making the old label true: none. The stats array is a single unconditional literal at public/artist.html:410-411; the only filtering is .filter(([v])=>v), which drops empty values, never relabels one. There is no A/B or flag branch, and no reference to "Audience" left anywhere in public/artist.html.
- The page being carefully worded so the image does not matter: the opposite. The alt text at :434 describes the image as "An artist's public MySet page", which presents it as the product, so the picture is a claim.
- The image being stale but invisible: no. The grid is in the visible upper half of the shot.

Two corrections to the accusation, one in its favour and one against:
- Against: it is mis-anchored. Line 442 sits inside the "Ease / Excitement / Freedom" cards (about.html:441-472), which genuinely contain no image, and the accuser said so. They then reported a defect at :433. That is a real defect, but it is not a finding about the sentence under audit, and filing it at 442 will send whoever fixes it to the wrong place.
- In its favour: the staleness is wider than "one word". The same commit added a Community CTA tile at public/artist.html:414 that the screenshot cannot contain, and about.html sells the community page twice (lines 609, 628). So the picture understates the product as well as mislabelling it. The accuser's own fix ("retake the photo") happens to cure both, but their framing ("only the picture is out of date, not the words") undersells why it matters.

The alt-text half of their claim I confirmed as correct: "show and vote counts" still matches Shows and Votes cast. No copy change needed.

**Fix.** Retake public/about/profile.jpg from the current artist page, and fix two things the original finding missed while you are in there:

1. Capture the whole stat grid including the new "Community" tile (public/artist.html:414), not just the five numbers. about.html:609 sells "A community page — fans rate the night, post photos, and you reply" and :628 sells "Merch on your page ... from your community page" — the one screenshot of an artist page currently shows no route to that surface at all.

2. Crop or re-scroll the shot. The existing 780x1500 image is roughly 40% empty black below the "Directions" button, while the copy directly beside it (about.html:428-431) promises "Your page holds your music, your links and every gig you've got coming." The picture shows none of that. A shot that reaches the links/upcoming-gigs block makes the paragraph true instead of merely unrefuted.

If the aspect ratio changes, update the width/height attributes on public/about.html:433 to match, or the img will lay out at the wrong box (this repo's own pages rely on width/height + height:auto).

No copy change: the alt text at about.html:434 ("show and vote counts") is still accurate against the live grid.

## 56. [MINOR] Pricing & honest notes · line 594

> What you pay for is your own back office.

**Verdict:** OVERSTATED (confirmed, minor) — but on three items, not five. Real: merch on the fan-facing community page, the verified tick on the public page, and the 50-song live-to-the-room cap. Drop `branding` (NOT_BUILT, and the page already marks it "Soon") and drop `pricing` (it gates only the artist's ability to change defaults that are identical and free on every plan).

**Evidence.** netlify/functions/community.mjs:71 and :73; public/community.html:266 and :270-271; netlify/functions/_plan.mjs:20, :68, :90, :108, :130, :158; netlify/functions/admin.mjs:1695, :1707; netlify/functions/_lib.mjs:176, :179, :713, :852-858, :866-872; netlify/functions/_lifecycle.mjs:35-38, :53; public/about.html:594, :604, :627, :644, :659-661

**Skeptic (high).** The finding SURVIVES, but only on three of the five things the accuser cited, and two of its citations are wrong. I read every gate myself.

WHAT IS REAL (I confirmed these in code, not comments):

1. Merch — genuinely audience-facing and Plus-gated. netlify/functions/_plan.mjs:68 `merch: false` on free, :90 `merch: true` on plus, :108 on pro; the gate is netlify/functions/_plan.mjs:158 `merchAllowed = (aid, limits) => isPlatformOwner(aid) || !!(limits && limits.merch === true)`, applied to the fan-facing payload at netlify/functions/community.mjs:73 `merch: merchAllowed(aid, limits) ? p.merch.filter((m) => m.on) : []`. The rail is drawn at public/community.html:270-271 (NOT :222-223 as the accuser wrote — those are `<script>` tags). Also enforced at the till, netlify/functions/pay.mjs:121.

2. The verified tick — netlify/functions/community.mjs:71 `verified: !!(who && who.verified) && plan !== 'free'`, rendered on the public page at public/community.html:266 as a `✓ Verified` badge. This is the sharpest item and the accuser buried it as an afterthought. It is a public trust marker that switches OFF when a plan lapses, and about.html never mentions verification at all (0 occurrences of "verified" in the file). If anything this piece is UNDERSTATED.

3. `featured: 50` — _plan.mjs:20, really enforced at netlify/functions/admin.mjs:1695 and :833/:925, and it does bound how many songs the room can choose from. Real, though the page itself discloses it on the Free card ("Keep 2,000 songs — 50 live to the room at once").

WHAT IS WRONG IN THE ACCUSATION:

4. `branding` is not evidence of anything. It is in NOT_BUILT (_plan.mjs:130 `export const NOT_BUILT = ['promote','analytics','presskit','branding']`) and there is no code behind it anywhere — grep finds no consumer. The accuser quoted the source comment "your colours and logo on the audience pages" and reported it as behaviour, which is exactly the trap. The page also already marks it honestly: public/about.html:644 lists "Your colours and logo on the fan pages" with a `Soon` chip, and the honest-notes block at :659-661 says the four Pro extras marked Soon are not shipped.

5. `pricing` is the definition of a back-office control, so it argues against the accuser. netlify/functions/admin.mjs:1707 gates only the ARTIST's ability to change `freeCredits`/`packs`/`replayCost`/`askSet`. The defaults are identical on every plan and are free: _lib.mjs:176 `freeCredits: 5`, :179 `replayCost: 5` (five VOTES, not money — see _lib.mjs:713). A free artist's room gets the same five free votes as anyone's. Nothing in the vote path reads the plan.

I also checked a thing the accuser did not raise, which could have looked like a wider problem and is not: the `audience` cap (200/1000/2000) does NOT change the room's night. Degradation is driven purely by head count, not by plan — _lib.mjs:852-858 `pollFloorFor(heads)` and :866-872 `boardLimitFor(heads)` take only `heads`. The stamped `roomCap` (_lifecycle.mjs:53, show.mjs:169) only sets an `over` flag for the artist; _lifecycle.mjs:35-38 states the door is never closed and no vote is refused, and the code matches. So a free artist with 900 people in the room gets the identical experience a Pro artist would.

NET: the headline above the sentence — "Everything the room sees is free. Always." — is TRUE and is the load-bearing claim. The trailing clause "What you pay for is your own back office" is a loose summary that three real, built things contradict: merch, the verified tick, and the 50-song board cap. Two of those three are itemised in plain English on the plan cards three inches below the sentence, so the reader is not deceived about facts; the verified tick is the only one nowhere disclosed. Overstated summary, minor — the accuser's status stands, their evidence needs pruning.

ONE WARNING ON THEIR PROPOSED FIX: "a bigger night" would introduce a NEW inaccuracy. Paying does not make the night bigger — _lib.mjs:852-872 proves the room behaves identically at any head count on any plan, and _lifecycle.mjs:35-38 proves nobody is turned away on free. Do not ship that wording.

**Fix.** Do not use "a bigger night" — it is not true (room behaviour is head-count driven, identical on every plan). Keep the room/artist contrast the paragraph is actually making, and stop asserting an exhaustive category. Replace line 594's clause with: "What you pay for is your side of it, not theirs." If a more concrete line is wanted: "What you pay for is your own back office — and a couple of things on your own page." Separately, and more useful than the wording change: the `✓ Verified` badge (community.mjs:71 → community.html:266) is a public trust marker that is off on Free and is not mentioned anywhere on about.html. Either list it on the Plus card or stop plan-gating it; a badge that silently vanishes when a subscription lapses is the one item here a reader could not have found out from the page.

## 57. [MINOR] Pricing & honest notes · line 602

> [the Free card's <ul> lists nine items and no sign-in/seat limit]

**Verdict:** CONFIRMED — status OVERSTATED, severity minor (omission of a real, enforced limit). I could not refute it; the gate is live, unbypassed, and the same product copy in the Studio names it in both the Free and Plus columns while about.html names it nowhere below Pro. The gap is slightly WIDER than filed (it spans the Free card and the Plus card), though the proposed Free bullet does cure Plus by inheritance.

**Evidence.** netlify/functions/_plan.mjs:65 (free `seats: 1`), :89 (plus `seats: 1`), :107 (pro `seats: 5`); enforced at netlify/functions/auth.mjs:391-398 — `const { limits } = await planForArtist(me.aid)` … `if (!mine.some(([e]) => e === email) && mine.length >= limits.seats) return bad(limits.seats === 1 ? 'Your plan allows one sign-in. Pro allows five.' : …, 402)`; no founder bypass on seats (netlify/functions/_plan.mjs:155-162 gives `isPlatformOwner` bypasses to merch and moderate only, and planForArtist:145-151 has no seat override); Studio Free column public/studio.html:3518 `['One sign-in','']` and Plus column public/studio.html:3532 `['One sign-in','']`; INVARIANTS.md:1167 "`seats` is 1 on free AND Plus"; the page — public/about.html:602-611 (Free `<ul>`, nine items, no seat/sign-in line), :617-635 (Plus card, "Everything in Free" + upgrades, no seat line), :641 `<li>Five sign-ins for your band</li>` (Pro only, and accurate). grep of public/about.html for band/team/seat/sign-in returns only line 641 and an unrelated alt text at :434, so line 641 is the page's only mention of sign-ins anywhere.

**Skeptic (high).** I tried four ways to refute this and all four failed.

(1) Is there another code path making Free's silence true — i.e. can a free artist get a second sign-in? No. auth.mjs:391-398 reads `limits.seats` from planForArtist and refuses the add with a 402 when the existing row count for that artistId meets the cap. The count `mine` is every `byEmail` row pointing at the artist, owner included, so on Free the owner's own address consumes the single seat and no second address can ever be added. Crew and member roles do not sidestep it — the role is chosen after the cap check, not before. There is no `isPlatformOwner` bypass on seats the way there is on merch and moderate (_plan.mjs:155-162), so even the founder is bound by it.

(2) Is the accuser reading a doc or a comment as behaviour? No — the accusation cites _plan.mjs:65 and auth.mjs, and I read the enforcement statement itself, not the comment above it. MYSET.md:381 and INVARIANTS.md:1167 agree with the code, but the code stands on its own.

(3) Is the page's sentence more carefully worded than the accuser noticed? This is the strongest refutation available and it still does not carry. The Free card makes no claim of unlimited sign-ins; it simply never mentions them. And a reader can infer *something* from "Five sign-ins for your band" sitting under Pro — the card is cumulative ("Everything in Free", "Everything in Plus"), so a feature named at Pro is conventionally absent below. But that inference gives a direction, not a number: the reader cannot tell whether Free is one, two or four. The page's own house style is what convicts it. Every other ceiling on the Free card is stated with its number in the same breath — "4 shows a month — up to 200 people in the room at each", "Keep 2,000 songs — 50 live to the room at once". A card that is that precise about four limits and silent about the fifth reads as "there is no fifth limit". That is overstatement by omission, which is the status filed.

(4) Is the accuser applying a condition the page never implied? No, and the strongest evidence is internal to MySet: the Studio's plan sheet — the same product copy, for the same reader, one step further into the funnel — prints "One sign-in" in the Free column at studio.html:3518. Whoever wrote that card judged the limit worth naming to an artist. The marketing page does not name it. Same fact, two surfaces, one discloses and one does not.

Severity minor is correct and I would not raise it. Nothing false is asserted, no money changes hands on a misunderstanding (there is no checkout at all yet — about.html's third honest note says so), and the disappointment lands at the moment an artist tries to add a bandmate and gets a clear, honest 402 that names the real ceiling. It is a disclosure gap on a pricing card, not a lie.

Where I improve on the accuser: the omission is wider than the Free card. Plus is also `seats: 1` (_plan.mjs:89) and its card is equally silent, and the Studio names "One sign-in" in the Plus column too (studio.html:3532). Their single Free bullet does technically fix Plus through "Everything in Free", but relying on an inheritance chain for the one limit a paying band is most likely to assume they bought is thin. Two bullets, mirroring what the Studio already does, is the better fix.

I also found a bigger problem two lines above the proposed insertion point, which I have detailed in betterFix: about.html:606 sells setlists as a Free feature while admin.mjs:735-736 refuses to create one below Plus. That is a false claim on a pricing card, not an omission, and it deserves its own finding at a higher severity than this one.

**Fix.** Two changes rather than one, and word the Free bullet like its siblings (thing — what it means), matching the Studio's own vocabulary:

1. public/about.html, Free `<ul>`, after line 610 ("Keep 2,000 songs — 50 live to the room at once"), before the `class="no"` fee line:
   `<li>One sign-in — you run the page from your own address</li>`

2. public/about.html, Plus `<ul>` (after "Unlimited songs live at once", ~line 626):
   `<li>One sign-in — band sign-ins are Pro</li>`

Why the second bullet is worth having even though "Everything in Free" technically carries the limit down: Plus is the paid card, and a five-piece band paying $10 has the strongest reason to assume the money bought them access. Plus is `seats: 1` (_plan.mjs:89) exactly like Free, and today the page's only sign-in sentence sits under Pro, so both lower cards read as undefined. The Studio does not rely on inheritance here — it prints "One sign-in" in the Free column AND the Plus column (studio.html:3518, 3532) — so this brings the marketing page to parity with the surface an artist actually sees after signing up.

SEPARATE AND WORSE, ON THE SAME LIST — flagging because it is one line above the fix and is a false claim rather than an omission: public/about.html:606 puts "Setlists, chord charts, keys and genres" in the FREE column, but `setlists: false` on free (_plan.mjs:67) and creating one is refused with a 402 at admin.mjs:735-736 ("Separate setlists are a Plus feature"). The Studio splits this correctly — Free gets "The song sheet: chord charts, keys and genres" (studio.html:3512) and Plus adds "Separate setlists" (studio.html:3524). Recommend the Free bullet become "The song sheet — chord charts, keys and genres" and that "Separate setlists" be confirmed present on the Plus card. That one should be filed at a higher severity than this seats finding.

## 58. [MINOR] Pricing & honest notes · line 603

> up to 200 people in the room at each

**Verdict:** CONFIRMED as a copy inconsistency, not a false number — severity minor. The number itself is right and more meaningful than the accuser allows; what is wrong is that the Free card states a consequence-free ceiling next to a hard-enforced one, while a sibling card explains the softness.

**Evidence.** public/about.html:603 (Free bullet) vs public/about.html:622-623 (Plus bullet, softness explained) and public/about.html:639 (Pro bullet, softness NOT explained) · netlify/functions/_plan.mjs:63 `audience: 200` · netlify/functions/_lifecycle.mjs:53-57 roomCapFor, :147 `show.roomCap = roomCap` · netlify/functions/show.mjs:32-43 (comment) and :44, :168 `room: { cap, in, over }` — the only two places roomCap is ever used · netlify/functions/_lifecycle.mjs:134 `if (gigCap !== null && used >= gigCap) { err = [CAP_REFUSAL(gigCap), 402]; ... }` — the OTHER half of the same sentence IS a hard door · netlify/functions/_lib.mjs:852-857 pollFloorFor and :866-872 boardLimitFor — both keyed on `heads` only, never on roomCap · public/vote.html:323 (nextPollMs) and :586, :666 (board) — the client reads the ladder outputs and never reads `room.cap` or `room.over`

**Skeptic (high).** I read the gates rather than the comments. There is no turnstile: roomCap is written once at startShow (_lifecycle.mjs:147) and appears in exactly two later places — show.mjs:44 reading it back and show.mjs:168 reporting `room: { cap, in, over }`. A repo-wide grep for `roomCap` returns those lines and nothing else. Nothing refuses a join, a vote or a poll on it. So there is no alternate code path that makes "up to 200" a door.

But the accuser gets two things wrong and misses a third.

Wrong 1 — the causal link. They write that over the cap "the night just slows and the board shortens", citing pollFloorFor/boardLimitFor. Those functions take `heads` and only `heads` (_lib.mjs:853, 867). A Free room of 400 degrades identically to a Pro room of 400. The plan's number does not cause the slowdown, does not trigger it, and is not even shown to anyone: no page in public/ reads `room.cap` or `room.over` — vote.html consumes `nextPollMs` (:323) and `board` (:586, :666), which are computed from the head count. So the cap has zero runtime effect anywhere, which is stronger than "not a door".

Wrong 2 — they undersell the number. "It is not a door, it is a billing line" makes 200 sound arbitrary. It isn't: 200 is exactly the top of the first rung in both ladders — pollFloorFor(200) = 3000ms, the normal refresh, and boardLimitFor(200) = null, the whole board. So "up to 200 people in the room" truthfully names the size at which the night behaves exactly as designed. That is a real, code-backed meaning for the sentence, and it is why I would not soften the number itself.

Missed — the reason the misreading happens. The accuser blames the contrast with the Plus card. That is half of it. The sharper cause is inside the sentence: "4 shows a month" and "up to 200 people" are joined by one em dash in one bullet, and the first half IS a hard door — _lifecycle.mjs:134 refuses the fifth show with a 402 and a scripted refusal string. A reader parses both halves the same way because they are written the same way, one of them correctly. And the gap is two cards wide, not one: Pro at :639 omits the softness too.

So the page's statement is not false, and it is more carefully grounded than the accusation implies — but the finding holds as an inconsistency, and the bigger unstated thing on that line is the hard show cap, not the soft room cap.

**Fix.** Keep the exact number and mirror the Plus card's own wording, so the two cards read as one voice: "4 shows a month — rooms up to 200, and if more turn up the night still runs; it just refreshes a little slower". Do NOT take the accuser's "rooms of about 200" — 200 is exact and load-bearing (it is the first rung of the ladder), and "about" throws away a true, precise number for nothing. Second, the same bullet needs the opposite treatment on its first half: "4 shows a month" IS hard-refused at show five (_lifecycle.mjs:134, HTTP 402, "That's your 4 free shows this month"), and the card never says so — an artist finds out when the Start button refuses in front of a room. Third, apply the same softening clause to the Pro card at about.html:639, which has the identical gap.

## 59. [MINOR] FAQ, close, footer · line 667

> Straight answers

**Verdict:** SURVIVES — and understated. The kicker at about.html:667 is fine as written and should stay. The claim underneath it is real, but the severity should go minor → major and the primary locus moves from the FAQ to the pricing card: about.html:606 states setlists as a free feature with no marker, contradicted by _plan.mjs:67 and admin.mjs:735-736. The FAQ answer (695-698) is the third symptom, not the root. The secondary starter-pack claim is REFUTED (no issue).

**Evidence.** public/about.html:606 (free card claims "Setlists" — the primary defect); public/about.html:619-631 (Plus card omits setlists entirely, so nothing corrects it); public/about.html:695-698 (FAQ teaches the gated action); netlify/functions/_plan.mjs:67 (`setlists: false` on free); netlify/functions/admin.mjs:730,735-736 (the only creation path, 402 gate); netlify/functions/_plan.mjs:154 (owner-only bypass); netlify/functions/_lists.mjs:29,39 (MAX_LISTS = 20; new artists start with zero); public/studio.html:614-617 (Studio greys the button, comment: "The server refuses this on free"); public/studio.html:3512 vs 3524/3538 (Studio's own free row says "The song sheet", Plus/Pro rows say "Separate setlists"); public/studio.html:3705 (downgrade: "you couldn't make new setlists"). For the refuted secondary: netlify/functions/admin.mjs:1694-1697,1972-1983 (starter pack adds ~60, activates up to the cap) and public/about.html:608 (the 50-live ceiling is already disclosed).

**Skeptic (high).** I tried to break this finding and could not. It survives, and it is bigger than the accuser said.

WHAT I VERIFIED MYSELF

1. The gate is real and there is exactly one creation path. netlify/functions/admin.mjs:730 `if (action === 'listNew')`, then admin.mjs:735-736: `if (!isPlatformOwner(aid) && (await planForArtist(aid)).limits.setlists !== true) return bad('Separate setlists are a Plus feature — everything you already have keeps working.', 402)`. netlify/functions/_plan.mjs:67 sets `setlists: false` on free; _plan.mjs:154 `isPlatformOwner = (aid) => aid === DEFAULT_ARTIST` — Perry only, not a general path. I grepped for every writer that can add a set: `grep -rn "lists.push\|listNew"` returns admin.mjs:743 (inside the gated `listNew` branch) and public/studio.html:625 (the client calling it). There is no second route. `emptyLists()` at _lists.mjs:39 returns `{ v: 1, lists: [] }`, so nobody is seeded with one either. A brand-new free artist can create zero named setlists.

2. The app itself is honest — which makes the landing page the outlier. studio.html:616 wraps the "+ New setlist" button in `lock('setlists', …, 'Sets you already have keep working.')`, with a comment at 614-615 saying plainly "The server refuses this on free." The Studio's own plan table lists 'Separate setlists', one active per night, applied from your calendar' under Plus (studio.html:3524) and Pro (3538) — and NOT under Free. The downgrade warning at studio.html:3705 says "you couldn't make new setlists". admin.mjs:398 ships `setlists: !!l.setlists` to the client "so the Studio can say so BEFORE the server refuses."

3. THE FINDING IS WORSE AND WIDER THAN STATED. The accuser found the third of three problems and called it minor. The primary defect is in the pricing card, not the FAQ:
   - about.html:606, in the FREE plan card, unchipped: "Setlists, chord charts, keys and genres". Compare the Studio's equivalent free row, studio.html:3512: "The song sheet: chord charts, keys and genres". The landing page swapped the honest phrase "The song sheet" for the word "Setlists" — turning a truthful item into a direct free-plan feature claim that _plan.mjs:67 contradicts. That is a stronger, plainer contradiction than the FAQ's.
   - about.html:619-631, the Plus card, never mentions setlists at all. So the Plus column cannot correct the Free column, and a reader has no way to learn from the pricing section that separate setlists are paid. The Studio's Plus list does carry it (3524); the landing page dropped it.
   - about.html:695-698, the FAQ, then teaches the reader to do the one gated thing: "build a setlist instead — name it, put the songs you want in it". That is `listNew` exactly. Everything else in that sentence checks out: "keep twenty of them" matches MAX_LISTS = 20 (_lists.mjs:29), and gig-attach is real (studio.html:1721-1730).

REFUTATION ANGLES I TESTED AND REJECTED
   - "Setlist" is overloaded in the Studio (the Setlist tab is the song library, studio.html:1969 "Your setlist — X of Y featured"), so about.html:606 could arguably mean the library. I don't accept it as a defence: the Studio's own free row calls that same thing "The song sheet", and about.html:606 sits next to a separate line (608) already covering the library ("Keep 2,000 songs — 50 live to the room at once"). And the FAQ at 695-698 is unambiguous regardless — naming it and keeping twenty is the gated feature.
   - Downgrade grace doesn't rescue it: rename/delete/edit/use are all ungated (admin.mjs:751-780), so an artist who once paid keeps working. That is precisely why the code's own message says "everything you already have keeps working" — it is a grace clause for lapsed payers, not availability for a new free artist.
   - Owner bypass covers one account.

THE SECONDARY CLAIM (starter pack) DOES NOT SURVIVE. I read the handler: admin.mjs:1972-1983 appends the ~60 starter covers to the library and sets `active` only while `live < featureCap` (featureCap from _plan.mjs `featured`, resolved at admin.mjs:1694-1697). So all sixty are added, fifty go live, and the rest sit inactive — which is literally "add in one tap and edit down". And the page does disclose the ceiling, in the free card at about.html:608: "Keep 2,000 songs — 50 live to the room at once". Asking the FAQ to repeat a limit the pricing card two sections up states in plain numbers is applying a condition the page never implied. Drop that one to NOT AN ISSUE.

ON THE KICKER ITSELF. "Straight answers" at about.html:667 is a section header, not a claim about a feature. The accuser's own proposed fix (leave the kicker, fix what's underneath) is the right shape — I'd keep it. But the defect underneath should not be filed as minor.

**Fix.** Keep the kicker "Straight answers" (about.html:667) exactly as it is. Fix three places, in this order of importance:

1. about.html:606 — restore the Studio's own honest wording. Replace
     <li>Setlists, chord charts, keys and genres</li>
   with
     <li>Your song sheet — chord charts, keys and genres</li>
   (matches studio.html:3512, and stops the free card claiming a Plus feature.)

2. about.html — add the missing Plus item, so the ladder reads correctly. After line 624 ("Unlimited songs live at once") insert
     <li><b>Separate setlists</b> — one per night, applied automatically from your calendar</li>
   (matches studio.html:3524 and admin.mjs:735-736.)

3. about.html:695-698 — mark the FAQ answer, using the page's existing chip convention. Rewrite the second half as:
     "For one night only, build a separate <b>setlist</b> <span class="chip">Plus</span> — name it, put the songs you want in it, and the room sees just those. You can keep twenty of them and attach one to a gig in your calendar, so it loads itself when you start the show."
   Keep "twenty" and the calendar attach — both verified true (_lists.mjs:29; studio.html:1721-1730). Note the existing chips on the Pro card (about.html:642-645) say "Soon", meaning not built; this one IS built, just paid, so the chip text must be "Plus", not "Soon" — using "Soon" here would swap one false statement for another.

Do NOT touch the starter-pack answer (700-702). It is accurate and the ceiling is already stated at about.html:608.

## 60. [MINOR] FAQ, close, footer · line 697

> You can keep twenty of them

**Verdict:** FALSE (not AMBIGUOUS), severity moderate — upgraded. The accusation is right about the gate but points at the wrong sentence and misses the root cause, which is the pricing table itself.

**Evidence.** public/about.html:606 (Free plan card lists "Setlists"); public/about.html:615-631 (Plus card, no setlists bullet); public/about.html:696-698 (the FAQ sentence); netlify/functions/_plan.mjs:67 (free.setlists: false); netlify/functions/admin.mjs:735-736 (server refuses listNew with 402 unless limits.setlists === true or isPlatformOwner); public/studio.html:616 (client lock('setlists') on "+ New setlist"); public/studio.html:3512 vs 3524 (the Studio's own free card says "The song sheet: chord charts, keys and genres" with NO setlists, and its Plus card DOES say "Separate setlists"); netlify/functions/_lists.mjs:29 and :49 (MAX_LISTS = 20, plan-independent).

**Skeptic (high).** I tried to refute this three ways and could not.

1. Is there another code path that makes it true? No. `listNew` is the only creator of a list (grep for `lists.push` returns exactly netlify/functions/admin.mjs:743), and it is gated at admin.mjs:735-736 on `planForArtist(aid).limits.setlists !== true`, with free.setlists = false at _plan.mjs:67. The only bypass is `isPlatformOwner(aid)` — which is Perry, so he would never see the refusal himself. No runtime flag touches it; test/limits.mjs:82,166 asserts the refusal.

2. Is the accuser reading a comment or a doc as behaviour? No. admin.mjs:731-734 is a comment, but the executable line beneath it (735) does the refusal, and the Studio independently hides the button behind `lock('setlists')` at studio.html:616. Two enforcement points, both real code.

3. Is the accuser applying a condition the page never implied? This was my best line of attack, and it fails in the opposite direction. The page does not merely leave "you" unqualified — it affirmatively tells the reader setlists are free. about.html:606 puts "Setlists, chord charts, keys and genres" in the **Free** plan card, and the Plus card (615-631) does not mention setlists at all. Compare the Studio's own plan copy, which is correct: studio.html:3512 free = "The song sheet: chord charts, keys and genres" (no setlists), studio.html:3524 plus = "Separate setlists, one active per night, applied from your calendar". Someone editing about.html spliced the word "Setlists" onto the free song-sheet bullet and dropped it from Plus. So the FAQ's unqualified "you" is downstream of a pricing table that states a paid feature is free.

4. Is the page more carefully worded than noticed? Partly — and here the accuser is slightly wrong. The verb is "keep", and keeping twenty IS true on free: listRename, listDelete, listSongs, listToggle and listUse (admin.mjs:751-802) carry no plan check at all, so a downgraded artist keeps and uses up to 20 lists. The false verb is in the clause *before* it — "build a setlist instead — name it, put the songs you want in it" (about.html:696) — because building is the one gated action. The accuser's proposed "Plus artists can keep twenty of them" therefore fixes the one half of the sentence that was already true and leaves the false half standing.

Net: not refuted, but the finding should be restated. The defect is a plan-card misstatement (a $10/mo feature listed as free, and missing from the plan that actually grants it), with the FAQ sentence as a symptom. That is worse than "minor / ambiguous" — it is the kind of claim that reads as a bait-and-switch when a free artist taps "+ New setlist" and gets a 402.

**Fix.** Fix the source, not just the FAQ line. Three edits:

1. about.html:606 — drop the word "Setlists" so the Free card matches studio.html:3512:
   `<li>The song sheet — chord charts, keys and genres</li>`

2. about.html Plus card (after line 622, "Unlimited songs live at once") — add the bullet the Studio already has at studio.html:3524:
   `<li><b>Separate setlists</b> — one active per night, applied from your calendar</li>`

3. about.html:695-698 — name the gate once, in the clause that is actually false ("build"), and leave "keep twenty" alone, because keeping twenty is true on every plan:
   "They see what you choose to show. Any song can be hidden, and it stays hidden across every future show until you bring it back. For one night only, build a **setlist** instead — name it, put the songs you want in it, and the room sees just those. Making new sets is a Plus feature; you can have twenty, and attach one to a gig in your calendar so it loads itself when you start the show."

If the claim-33 rewrite already replaces this whole FAQ answer, edits 1 and 2 still have to happen independently — they are in the pricing table, not the FAQ, and they are the reason the page reads as free.

## 61. [MINOR] Demo script · line 740

> let rows = SEED.map((s) => ({ ...s })), mine = new Set(), left = 3, bump = null;

**Verdict:** FALSE — confirmed, severity minor (cosmetic-factual, not a broken promise)

**Evidence.** public/about.html:740 (`left = 3`), :337 (static `3 votes left`), :754-755 (counter render); netlify/functions/_lib.mjs:176 (`freeCredits: 5` in defaultShow), :390 (normShow re-asserts 5), :430 + :446 (every show read AND write passes through normShow, so 5 is the floor unless explicitly overwritten); netlify/functions/_plan.mjs:66 (`pricing: false` on the free plan); netlify/functions/admin.mjs:1704-1707 (canPrice gate on the `freeCredits` action) and :1830-1836 (`case 'freeCredits'` → `if (!canPrice) { err = PRICE_LOCKED; ... }`)

**Skeptic (high).** I tried to break this and could not. Every escape hatch I checked closes:

1. Another code path making 3 true? No. `freeCredits` is written in exactly one place — admin.mjs:1830-1836 — and read in five (vote.mjs:119, show.mjs:58, _requests.mjs:94, stage.mjs:43, _lib.mjs:501). Every show document is loaded through `normShow()` (_lib.mjs:430) and re-normalised on write (_lib.mjs:446-447), both of which spread `defaultShow()` first, so an unset field is 5, not 0 or 3. There is no signup path that seeds a different number.

2. Doc-read-as-code? No. The accuser's load-bearing facts are all in executable code, not comments or MYSET.md. I did not need the `tools/prod.py` result and did not rely on it.

3. Condition the page never implied? No — the opposite. The page's own Plus column at about.html:625 lists "Set your own vote rules — how many free votes each person gets" as a PAID feature, which matches _plan.mjs:66 exactly. So the page itself tells the reader a free artist runs on the defaults; the demo then shows a default that isn't the default. The demo is also framed with a strong fidelity claim at :332-334 ("This is the real thing, running on this page… That's exactly what forty people do at once"), so it isn't hedged enough to escape.

4. More carefully worded than noticed? Partly, and this matters for the fix. The footnote at :354/:761 says "a few free votes" — that hedge is CORRECT and must stay, because a Plus artist can set anything from 0 to 999 (admin.mjs:1832). The accuser's closing suggestion that the footnote "no longer has to hide behind 'a few'" would make the page newly wrong for every Plus room. Do not take that half of the fix.

5. Wider than stated? Two things the accuser missed. (a) Their fix silently kills a feature demo: SEED has only four songs (about.html:734-739) and the demo allows one vote per song (`mine` is a Set, toggled at :768-769), so with `left = 5` the `left <= 0` state becomes unreachable — the "No votes left" counter (:755) and the "in the room you could buy a few more… the next song refreshes everyone" footnote (:758) become dead code. That footnote is the page's only demonstration of vote packs and the per-song refresh. (b) Separately, the real room lets a fan stack several votes on ONE song (vote.html:425-428, `voteMax` = remaining/cost, capped 20); the demo caps at one. That's a defensible landing-page simplification, not a second finding, but it's the reason the demo runs out of road at four taps.

Net: the finding stands as stated, severity minor. It is a demo that hands out the wrong number, not a false promise — nothing a reader is sold on changes.

**Fix.** Take the accuser's two edits but not their third, and add one line so nothing is lost:

1. about.html:740 → `left = 5` (matches _lib.mjs:176).
2. about.html:337 → `<span id="dcount">5 votes left</span>` (the no-JS fallback; the comment at :338-339 says this markup exists precisely so a reader with no script still sees the truth).
3. ADD a fifth song to SEED at :734-739, e.g. `{ id: 'e', t: 'Dreams', by: 'Fleetwood Mac', n: 1 }`, and a matching fifth static `.drow` after :352. Without this, five credits over four songs means the demo can never reach zero, and the "No votes left" / "you could buy a few more… the next song refreshes everyone" branch at :755 and :758 never renders again — the page would lose its only live demonstration of vote packs and the per-song refresh.
4. DO NOT change the footnote at :354/:761. "Everyone in the room gets a few free votes" is deliberately un-numbered because a Plus artist can set 0-999 (admin.mjs:1832). Hard-coding "five" there would trade one small inaccuracy for a bigger one.

## 62. [MINOR] Demo script · line 740

> mine = new Set()

**Verdict:** FALSE — confirmed, severity raised from minor to moderate, and widened: the demo misstates TWO vote rules, not one (no vote stacking, and a refundable un-vote that production denies by default)

**Evidence.** public/about.html:740 (mine = new Set()), :768-769 (toggle-off refunds), :333 ("This is the real thing, running on this page"), :757-761 (three-branch dfoot); netlify/functions/vote.mjs:16, :112, :122-124; public/vote.html:410, :425-429, :422, :632, :726; netlify/functions/_flags.mjs:27-49 (voteFinal default true, no flag gates n)

**Skeptic (high).** I tried to break this finding and could not. Every link in the chain is real code I read myself, not a comment or a doc.

MULTI-VOTE IS REAL AND UNGATED. netlify/functions/vote.mjs:16 clamps n to 1..50; :122 does `for (let i = 0; i < n; i++) me.v.push(song)` and :124 sets `want = mine + n` — an absolute count that the read-back verifier at :133 checks. That is behaviour, not a comment. The client side is shipped too: public/vote.html:410 `let VQ=1` is the sheet's quantity, :425-429 `voteMax()` returns up to 20 (20 flat when unlimited, else floor(remaining/cost) capped at 20), :430-434 `vq(d)` is the stepper. Nothing flag-gates any of it — netlify/functions/_flags.mjs:27-49 declares exactly two flags, voteFinal and featuredShows, and neither touches n. So the accuser is not reading a comment as behaviour.

THE PAGE'S DEMO CAN ONLY EVER HOLD ONE. public/about.html:740 `mine = new Set()`, :751-752 renders a single "Voted" state, :769 `mine.add(id); row.n++; left--` — one vote, full stop.

MY OWN COUNTER-ARGUMENT FAILED. I looked for the "it's only a demo" defence and the page removes it: about.html:333 says "This is the real thing, running on this page" and "That's exactly what forty people do at once." The page explicitly claims fidelity, so a fidelity gap is on the page's own terms.

IT IS WORSE THAN STATED — a second discrepancy in the same nine lines. about.html:768: `if (mine.has(id)) { mine.delete(id); row.n--; left++; }` — a second tap in the demo takes the vote back AND refunds the credit. In production that is false by default. _flags.mjs:31 sets voteFinal `default: true`; vote.mjs:112 then returns "Those votes are cast — they stay with the song"; vote.html:422 only routes to openUnvote when `!finNow`, and vote.html:632 tells the fan "tap to add more" under finality instead of "tap to change". So the demo actively teaches a refundable toggle that the room refuses, on top of teaching one-vote-per-song. That is a taught falsehood, not merely an omission — and it is the more misleading of the two, because a reader who taps twice watches the count go DOWN.

Severity should be moderate, not minor: two rules of the core mechanic, under an explicit "this is the real thing" claim, in the interaction the page itself calls the reason it sits above every screenshot (about.html:730-733).

ONE WEAKNESS IN THE PROPOSED FIX. Line 761 is not "the footnote" — it is the third branch of a three-way ternary (:757-761) that renders only while `mine.size === 0`. Adding the sentence there means it disappears the instant the reader votes, which is the exact moment they form their mental model. The static fallback at :354-355 would also still be wrong.

**Fix.** Fix the demo, don't annotate it. The page claims "This is the real thing" (about.html:333), so make the nine lines behave:

1. Replace the Set with a count map — `mine = {}` keyed by id — and on tap do `mine[id] = (mine[id]||0)+1; row.n++; left--` while `left > 0`. Label the button "Voted ×N" when N>1, matching public/vote.html:726 exactly.
2. Delete the un-vote branch at :768. With voteFinal defaulting true (_flags.mjs:31), tapping again in the room adds a vote; it never removes one. Removing this branch fixes the second discrepancy and the stacking one in the same edit — a tap on a held song simply stacks.
3. Change the `mine.size` test at :759 to `Object.keys(mine).length` (or a running total) so the footer branches still fire.

If touching the demo's logic is out of scope, then put the line in ALL FOUR places, not just :761 — the static fallback at :354-355 and all three JS branches at :757-761 — because the accuser's single-branch fix vanishes the moment the reader votes. Suggested wording, covering both rules in one sentence: "In the room you can pile several votes onto one song — and once you confirm, they stay there."

## 63. [MINOR] Demo script · line 752

> disabled

**Verdict:** NOT FALSE — the page states nothing untrue and the mechanism works as written. Reclassify as a cosmetic demo-fidelity nit, severity trivial (accuracy of the demo vs the real app), not a truth failure of severity minor.

**Evidence.** public/about.html:752 (the disabled attribute), public/about.html:140-145 (.vb rules, no :disabled), public/about.html:754-758 (header + footer both announce the spent state), public/about.html:29 (only one linked stylesheet), public/app.css:62 (global button cursor:pointer), public/app.css:96 and :151 (the only two :disabled rules), public/vote.html:190 (.vb:disabled{opacity:.4} — the real app already has it)

**Skeptic (high).** I tried to refute this and could not refute the mechanical fact, but the accusation is mis-classified and its worst line is overstated. What I confirmed myself:

THE CSS GAP IS REAL. `public/about.html` links exactly one stylesheet (`/app.css`, about.html:29) and carries one inline `<style>`. Grepping `:disabled` across both returns only `app.css:96 .btn:disabled{opacity:.45;cursor:not-allowed;transform:none!important}` and `app.css:151 .go:disabled{opacity:.55}`. The demo pill's rules are about.html:140-145 (`.vb`, `.vb:active`, `.vb.on`) — no `:disabled` variant. `app.css:62` sets `button{...cursor:pointer}` globally, so the locked pill keeps a pointer cursor. The accuser's measurements hold.

BUT "status FALSE" IS THE WRONG CATEGORY. Nothing on the page asserts anything untrue. The `disabled` attribute at about.html:752 is honest: the button really is disabled, and the click handler independently guards it (`if (left <= 0) return;`, about.html:769). This is a missing style rule, not a false claim. On a truth audit of a marketing page, that is a cosmetic finding, not a FALSE one. Severity trivial, not minor.

"THE READER SEES A BROKEN PAGE" IS OVERSTATED. The same `draw()` call that emits `disabled` also rewrites two adjacent lines of plain English: the card header flips to "No votes left" (about.html:337, set at :754-755) and the footer flips to "Out of votes — in the room you could buy a few more, or wait: the next song refreshes everyone" (about.html:756-758). And the seed is 4 songs with 3 votes (about.html:740), so at most ONE pill is ever in the locked state, sitting beside three gradient "Voted" pills. The reader is not staring at a wall of identical live-looking buttons. "Byte-for-byte the same as a live Vote button" is also only true at rest — `.vb:active{transform:scale(.9)}` (about.html:144) does not apply to a disabled button, so it doesn't press either.

WHERE THE ACCUSER MISSED THE STRONGER, SHARPER POINT: the real product page already solves this. `public/vote.html:190` has `.vb:disabled{opacity:.4}`, alongside the same `.vb`, `.vb:active`, `.vb.on` rules (vote.html:182-191). The about-page demo is a copy of the real voting UI that dropped exactly one line. So the accurate framing is not "the page is broken" but "the demo is one rule less faithful than the app it demonstrates" — a fan in a real room sees the spent button dim; a reader of the demo does not. That is the argument worth making, and it also dictates the fix.

**Fix.** Do not invent a new value. Port the product's own rule verbatim so the demo matches the room it depicts. Add beside about.html:145: `.vb:disabled{opacity:.4}` — identical to public/vote.html:190. Drop the accuser's `cursor:default` and `transform:none`: `transform:none` is redundant because `:active` never applies to a disabled button anyway, and `cursor` is a free choice the real app declines to make, so adding it here would make the demo diverge from the app in the opposite direction. One line, exact parity with vote.html. If anyone later wants a cursor change, it belongs in vote.html first and should be mirrored, not introduced on the marketing page.

## 64. [MINOR] Demo script · line 760

> — whenever the next request is taken.

**Verdict:** CONFIRMED — ambiguous wording, minor severity. Not refuted. The defect is wider than stated: "taking a request" is not the trigger for playing the top-voted song under EITHER reading, because accepting a request only adds the song to the setlist for voting (public/studio.html:2646), it never starts one (netlify/functions/admin.mjs:1771-1806).

**Evidence.** public/about.html:760 (the sentence); public/about.html:758 and :761 (the two sibling strings that use the correct vocabulary); public/about.html:354-355 (static default, same correct vocabulary); public/about.html:398 and :680-681 (where the page defines "request" as the off-by-default feature); netlify/functions/_lib.mjs:181-183 (requests:{on:false,cost:3}); netlify/functions/_requests.mjs:90-99 (requests cost votes); netlify/functions/admin.mjs:1771-1783 and :1784-1806 (the real trigger: the artist taps play/playTop, which sets nowPlaying and resetVotes); public/studio.html:2646 (accepting a request only adds the song for voting)

**Skeptic (high).** I tried to break this finding and could not. Every code fact the accuser cited is real, and the underlying problem is bigger than they described.

WHAT I CONFIRMED MYSELF

1. "Request" is a defined product term on this page, and it is off by default.
netlify/functions/_lib.mjs:181-183 sets `requests: { on: false, cost: 3 }` with the comment "Off by default — an artist who can't play requests should never be asked for them." Charging happens in netlify/functions/_requests.mjs:90-99 (`me.spent = (me.spent||0) + cost`, 402 "no-credits" when short). The page teaches that same meaning in body copy at about.html:396-401 ("they only exist if you switch them on") and about.html:680-683 ("Requests are off until you turn them on").

2. Every other prose use of "request" on the page means that feature.
Only six non-code hits exist: about.html:390 and :404 (image alt text), :398, :592, :680, :681 — all the ask-for-a-song feature. Line 760 is the sole outlier.

3. There is no code path that makes line 760 true. This is the part the accuser understated.
The winning song plays next when the ARTIST taps play, in netlify/functions/admin.mjs:1771-1783 (`case 'play'`) and :1784-1806 (`case 'playTop'` — ranks the pool, sets `show.nowPlaying = pool[0].id`, `resetVotes = true`). Nothing in that path touches requests. And accepting a request does NOT start a song: askAccept only adds it to the setlist, which the Studio itself announces as "Added — the room can vote for it now" (public/studio.html:2646). So even with requests switched ON, "the next request is taken" is not the event that starts the top-voted song. The sentence names a mechanism that does not exist under either reading of the word.

4. The sentence is internally inconsistent with its own two siblings, eight lines apart.
about.html:758 "the next song refreshes everyone", about.html:761 "Starting a song gives everybody theirs back", and the static default at about.html:354-355 all use "song" / "starting a song". Only about.html:760 reaches for "request". That reads as a slip, not careful wording — there is no charitable reading in which the author meant the defined term.

ONE CORRECTION TO THE ACCUSER

Their harm story runs the wrong way round. The demo section is at about.html:336-357, which is BEFORE beat 3 (:396) and the FAQ (:680). So a linear reader does not "just read that" and then hit line 760 — line 760 fires first. Worse, it fires on the reader's very first tap (the `mine.size` branch shows as soon as one vote is cast with votes remaining), which makes it the first time the word "request" appears in visible body copy on the page, teaching the wrong meaning before the page defines the right one. Same collision, opposite direction, and if anything a stronger reason to fix it.

WHY IT IS STILL "MINOR"

The page never states that voting requires requests; the false idea is an inference a reader could draw, not a claim the copy makes. So AMBIGUOUS/minor is the right severity. But it should be recorded as confirmed, not left open.

**Fix.** Use: "— whenever the next song starts."

Full line 760 becomes:
`<b>${esc(sorted[0].t)}</b> is winning, so that's what plays next — whenever the next song starts.`

Why this beats the proposed "— as soon as this song's finished.":
1. The proposed fix asserts a song is currently playing. Nothing is playing in the demo — it is a bare "Up next" list of four seeded songs (about.html:336-353, SEED at :385-390 of the script). "This song" has no referent on screen.
2. It implies an automatic hand-off when a song ends. There isn't one. admin.mjs 'play'/'playTop' only fire when the artist taps; a song ending triggers nothing. That would swap an ambiguity for a new false mechanism.
3. "whenever the next song starts" reuses the exact vocabulary of the two strings either side of it (:758 "the next song refreshes everyone", :761 "Starting a song gives everybody theirs back"), so the demo footer finally reads as one voice, and it keeps the original's honest vagueness about WHEN — which is correct, because that is entirely the artist's choice.

## 65. [MINOR] Demo script · line 763

> document.getElementById('dlist').addEventListener('click', ...)  [the entire handler, 763-774]

**Verdict:** CONFIRMED — and UPGRADE from minor to moderate. The falsifier is right on its one narrow point (the "~25 s" number) and wrong on the verdict. Correcting the latency arithmetic does not rescue the sentence, because latency was the weakest of three mismatches and I found a fourth that is flatly a false statement about shipped behaviour.

**Evidence.** public/about.html:333-334 (the claim) · public/about.html:734 SEED + zero `fetch(` anywhere in the file (the demo is fully local) · public/about.html:751-752, 768 (second tap un-votes and refunds the credit) · netlify/functions/_flags.mjs:28-35 `voteFinal: { default: true }` — production DOES NOT allow taking a vote back · public/vote.html:421-422 `const finNow=!!(ST.flags&&ST.flags.voteFinal); if(s.mine&&!finNow) return openUnvote(s);` — with the flag on, a second tap adds more instead · public/vote.html:632 "tap to add more" · public/vote.html:445 "Once you confirm, that's final — votes can't be taken back" · public/vote.html:640, 726 → openVote → drawVoteSheet → :479 Confirm button; only :506-510 confirmVote() casts · public/vote.html:517-522 optimistic update before the POST at :528-529 · public/vote.html:534 "Couldn't reach the room — try again" · netlify/functions/_lib.mjs:852-858 pollFloorFor n<=200 → 3000 · public/vote.html:1072-1075 signature() = stageSig()+'|'+d.totalVotes · public/vote.html:1120 `const sig = FLOOR > 3000 ? stageSig() : signature();` · public/vote.html:1099-1105 rungs 3s/10s/25s/60s · public/vote.html:1094 ±20% jitter

**Skeptic (high).** I tried to refute this and could not. Taking the falsifier's points one at a time.

WHERE THE FALSIFIER IS RIGHT. Its poll arithmetic checks out exactly. _lib.mjs:852-858 returns 3000 ms for any room up to 200 phones. vote.html:1120 picks signature() (not stageSig) whenever FLOOR is 3000, and signature() at :1072-1075 appends d.totalVotes — so any vote by anyone changes the signature, QUIET resets to 0, and the phone sits on the 3 s rung with ±20% jitter (:1094). In the forty-person pub the copy describes, other people's votes land in about 2.4–3.6 s, not 25 s. 25 s is the sixth-consecutive-unchanged-poll rung, which a lively room never reaches. It is also right that the fan's own tap is instant: vote.html:517-522 moves the count and the credit before the POST at :528. One small correction to the falsifier's own wording — a vote does not drop a phone "straight back" to 3 s; a phone already on the 25 s rung only learns of it on its next poll, up to 25 s later. That only matters in a room that was already silent, which is not the room in the copy.

WHY THAT DOES NOT SAVE THE PAGE. The falsifier fixed the least important of the mismatches, and its proposed rewrite keeps the load-bearing words "This is the real thing, running on this page." Those words are false in three verified ways, and the third is not a matter of degree.

1. It is not the real thing. about.html:734 is a hardcoded SEED array and the file contains no fetch() at all. The handler at :763-774 mutates three local variables. Nothing here is the product.

2. One tap is not how a vote is cast. In the app the Vote button calls openVote() (vote.html:640, 726), which opens a bottom sheet with a quantity stepper, five rules and a Confirm button (:479). Nothing is cast until confirmVote() (:506-510). The demo teaches a one-tap product. The shipped product is two taps with a modal in between.

3. THE ONE NEITHER AGENT CAUGHT, and the reason I am upgrading this. The demo lets you take a vote back: about.html:768, `if (mine.has(id)) { mine.delete(id); row.n--; left++; }`, with the button rendering as a live "Voted" toggle at :751-752. Production does the opposite. _flags.mjs:28-35 sets `voteFinal` default: true, shipped as the code default on purpose so production behaviour is visible in the diff. With it on, vote.html:421-422 never reaches openUnvote — a second tap opens the sheet to add MORE votes (:632 "tap to add more"), and the sheet itself says "Once you confirm, that's final — votes can't be taken back" (:445). So the demo does not merely simplify the product; on the single most consequential rule in a voting app it demonstrates the opposite of what the product does, directly under a sentence promising this is the real thing. A fan who learns "I can undo" from the landing page and then cannot undo at the gig is the trust failure the codebase's own comments keep warning about.

Also missing, as the falsifier noted: the "Couldn't reach the room" failure state (vote.html:534) and the fact that other people's votes arrive on a poll.

So: not refuted. Severity minor is too kind — a demo that contradicts the finality rule is a product-truth error, not a latency nitpick.

**Fix.** Two changes, and the second matters more than the copy.

1. STOP CLAIMING IT IS THE PRODUCT. Replace about.html:333-334 with:
"A working piece of the fan's screen, right here on this page. Tap a song and watch the queue move. In the room forty phones do this at once, and everyone's board catches up in a few seconds."
That drops "the real thing", keeps the demo's actual value, and states the true cadence (2.4–3.6 s at the 3 s floor for a room this size, _lib.mjs:854 + vote.html:1120), so it survives the copy audit on its own.

2. MAKE THE DEMO OBEY voteFinal. This is the real fix. At about.html:768, delete the un-vote branch so a second tap does not refund. Match the shipped rule instead: render the voted row's button as inert/"Voted" and have the footer say votes stay on the song until the next song starts. Minimal edit — change the branch at :768 to a no-op (`if (mine.has(id)) return;`) and drop the clickable-toggle affordance at :751-752 so it reads as a state, not a switch. Then the demo teaches the rule the app actually enforces (_flags.mjs:32, vote.html:421-422, 445).

Optional third, only if it can be done without clutter: since the demo now casts on one tap while the app needs Confirm, add one line to the footer copy at :761 — "In the room there's a Confirm step, so nobody votes by accident." That closes the last gap honestly without building a fake modal into a landing page.

Do NOT keep the falsifier's phrasing "This is the real thing, running on this page" — that clause is the finding.

## 66. [MINOR] Demo script · line 794

> function count(el) { const to = Number(el.dataset.to) || 0 ... el.textContent = Math.round(to * eased) + suffix; }

**Verdict:** CONFIRMED — status OVERSTATED is the right verdict, severity minor (cosmetic/framing, no false claim at rest). Sustained with two corrections to the accuser's reasoning and one escalation: the 0 tile is visible-but-inert rather than "invisible", the quoted heading sits two paragraphs away and is about the reader's gigs rather than these four tiles, and the 100% tile is worse than described because count() renders false intermediate percentages ("37% of it from the room, not from you") during the scroll animation.

**Evidence.** public/about.html:486-489 (the four tiles; `data-to` appears nowhere else in the file), public/about.html:480-481 (the lede the accuser quotes), public/about.html:482 (the tiles' actual lead-in), public/about.html:490 ("That's a small number and a true one" — singular), public/about.html:794-804 with the write at :800 (`el.textContent = Math.round(to * eased) + suffix`), public/about.html:781 (no-IntersectionObserver fallback writes final values), netlify/functions/_history.mjs:106 (peakVoters), netlify/functions/admin.mjs:1756 (`voters: votersNow`), netlify/functions/history.mjs:18-21 (only heal/reconcile — no artist-writable stats), and live production blob hist_perry-idyll_2026-08-30-1210 read via tools/prod.py: stats {songsPlayed: 10, totalVotes: 21, peakVoters: 8}, plus hist_perry-idyll_2026-08-30-1855 (all zeros) and -1928 (6 votes / 1 voter) confirming 1210 is the gig.

**Skeptic (high).** I tried to knock this down and could not. I verified it independently at the source rather than trusting the accuser.

WHAT I CONFIRMED MYSELF

1. The two real numbers are real. I read the live production blob read-only (`python3 tools/prod.py get hist_perry-idyll_2026-08-30-1210`). It returns venue "The Ugly Duckling Irish Pub", city "Koh Phangan, Thailand", startedAt 2026-08-30 12:10 UTC (19:10 Thai), endedAt 14:21 UTC, and stats `{songsPlayed: 10, totalVotes: 21, peakVoters: 8, topSong: Catch & Release}`. about.html:486-487 says 8 and 21. Exact match. Same numbers appear in MYSET.md:68 and HANDOFF-MySet.md:389.

2. I checked it is the right night, which the accuser did not. Production holds three perry-idyll shows on 2026-08-30: 1210 (the gig, 2h11m, 21 votes / 8 voters), 1855 (3 minutes, all zeros), 1928 (starts 02:28 Thai and runs until 2026-09-04 — Perry testing afterwards, 6 votes / 1 voter). The 1210 record is unambiguously the gig, so the page cites the correct record and does not silently merge the test sessions in.

3. "8 people voted" is conservative, and more so than the accuser realised. peakVoters is `Math.max(nowVoters, ...played.map(p => p.voters))` (_history.mjs:106), and `voters: votersNow` is the count of distinct fan records holding at least one vote at the instant a song starts (admin.mjs:1756). In THIS record `played` is empty, so peakVoters collapsed to nowVoters — distinct devices with unconsumed votes. It cannot overstate.

4. "…that you didn't type in yourself" (about.html:480-481) is structurally true, which is the accuser's strongest unused defence of the page. history.mjs accepts only `heal` and `reconcile` (lines 18-21); there is no artist-facing path anywhere in netlify/functions that writes a show's stats. The counts genuinely cannot be typed.

WHERE THE ACCUSER IS WRONG, BUT NOT FATALLY

- "animates from 0 to 0, which is invisible" is imprecise. count() (about.html:794-804) writes `Math.round(to * eased) + suffix` on every frame (line 800), so the 0 tile renders a visible "0" throughout — it simply does not move. And the final values are already in the HTML, so a no-JS or no-IntersectionObserver reader sees 8/21/0/100% regardless (line 781). The tile is inert, not blank.
- The quoted heading is two paragraphs above the tiles and is about the READER's future gigs ("Every gig you play is counted…", :480). The tiles' actual lead-in is "Here is MySet's own first night, and we're not going to dress it up" (:482), and the sentence under them says "That's a small number and a true one" — singular, pointing at 8/21. The page is more carefully worded than the accuser allows.

WHY IT STILL SURVIVES

`data-to` appears on exactly four elements in the whole file (486, 487, 488, 489). The count-up animation is a device reserved for this one row, so it does function as a visual signal of instrumentation, and two of the four things it decorates were never counted.

AND ONE THING THAT IS WORSE THAN STATED, which I confirmed in the code

Because line 800 writes `Math.round(to * eased) + '%'` on every frame, the 100% tile does not just look instrumented — it renders a sequence of false sentences. For roughly a second on scroll it literally reads "37% of it from the room, not from you", then "68%…", before landing on 100%. The 8 and 21 tiles counting through wrong intermediate values is harmless (a smaller count is just an animation). A provenance percentage counting through intermediate values states, on screen, that some of it did come from you. That is the real reason that tile must leave the counting row, and it is stronger than "it is a figure of speech".

Severity stays minor/cosmetic — nothing on the page is false at rest — and the accuser's status downgrade is correct.

**Fix.** The accuser's fix (drop to two tiles, move the rest to prose) works but throws away the row's visual weight and leaves an odd two-up grid. Better: fill all four slots with things the system actually measured, and move the rhetoric into the sentence that already follows.

1. Keep `<b data-to="8">` people voted and `<b data-to="21">` votes cast.
2. Replace the "0 apps" tile with the room's own top pick from the same record — `stats.topSong` = "Catch & Release", 2 votes. Render it as a name, not a counter (no `data-to`), so it does not animate.
3. Replace the "100%" tile with the show's duration, which is derivable from the same record and is unarguably measured: startedAt 12:10 UTC → endedAt 14:21 UTC = 2 hours 11 minutes. `<b data-to="131">` with a "min" suffix, or "2h 11m" as static text.
4. Put the two dropped facts into the paragraph already sitting under the row (:490-493), in the page's existing first-person voice: "Nobody downloaded anything, and not one of those numbers came from me."

Do NOT use `songsPlayed: 10` as a fourth tile even though it is in the record — that record's `played` array is empty while `songsPlayed` says 10 (the value survives from an earlier archive via the `up()` merge at _history.mjs:193). The number would be defensible but not reproducible from the round log, which is exactly the kind of thing this section must not have. Duration and topSong are both directly present and self-consistent.

Minimum viable version if the four-tile grid is not worth reworking: leave 8 and 21 counting, and strip `data-to`/`data-suffix` from lines 488-489 so those two render as static text inside the same grid. That alone kills the false intermediate percentages, which is the only part of this with any teeth.

## 67. [MINOR] Demo script · line 794

> [the count() rAF loop, 794-804]

**Verdict:** OVERSTATED — confirmed, and wider in scope than reported. The page's reduced-motion support is partial: it correctly suppresses the scroll reveal (about.html:269) but nothing else. The `*{animation-duration:.01ms!important}` companion at :270 is dead code (no @keyframes or animation property exists anywhere in the file), so the count-up rAF loop at :794-804, the .bump scale transition at :137-138, and five further CSS transitions (:59, :93, :126, :130, :143-144, :245) all run at full duration under prefers-reduced-motion:reduce. Severity minor: nothing is hidden, broken, or unreachable — this is an accessibility-polish gap, not a functional defect.

**Evidence.** public/about.html:268-270 (media query; :270 is a no-op — no @keyframes or `animation:` exists in the file), public/about.html:794-804 (unguarded rAF count loop), public/about.html:137-138 (.n.bump is a transition, untouched by an animation-duration override), public/about.html:770-772 (bump set/cleared unconditionally), public/about.html:486-489 (the four data-to targets 8/21/0/100%), public/about.html:788 (IntersectionObserver drives count on scroll only); `grep -n "matchMedia\|prefers-reduced" public/about.html` -> single hit at :268, proving no JS gate exists

**Skeptic (high).** I tried to break this finding and could not. Everything the accuser claims is present in the file, and one thing is worse than they said.

1) There is no reduced-motion handling in JavaScript at all. `grep -n "reduced-motion\|matchMedia\|prefers-reduced" public/about.html` returns exactly ONE hit: line 268, the CSS media query. Nothing in the script block ever consults the user's setting, so there is no alternate code path that could make the page's reduced-motion support complete.

2) count() (about.html:794-804) is an unguarded requestAnimationFrame loop that rewrites `el.textContent` over a hard-coded `dur = 1100`. It is driven by the IntersectionObserver at :788, which fires purely on scroll position. Nothing gates it. The accuser's headless observation (numbers ticking 3,7,0,33% up to 8/21/0/100%) matches the code exactly — those four targets are the `data-to` values at about.html:486-489.

3) The row bump is a CSS *transition*, not an animation: `.drow .n b{...transition:transform .34s var(--spring)}` at :137, with `.drow .n.bump b{transform:scale(1.35)}` at :138, applied by `bump = id` at :770 and cleared 380ms later at :772. The reduced-motion block at :269-270 overrides `animation-duration` only, so it cannot touch a transition. Correct as stated.

4) WORSE THAN STATED — the accuser undersold it. `*{animation-duration:.01ms!important}` at :270 is not merely too narrow, it is completely dead code: there is no `@keyframes` rule and no `animation:` property anywhere in the 827-line file (only hits for "animation" are the prose comment at :265, the override at :270, and `requestAnimationFrame` at :801/:803). So that line suppresses literally nothing today. The reduced-motion block's entire real effect is the one line at :269 neutralising the `.anim .up` reveal.

That means the survivors are not just the two JS effects. Every CSS transition on the page runs at full duration under reduced motion, because only `animation-duration` was overridden: :59 and :93 (nav mark / pill transform), :126 (`.drow .pos` transform .55s spring), :130 (row background/colour), :137 (the vote count scale), :143-144 (`.vb` transform + `.vb:active{transform:scale(.9)}`), :245 (FAQ chevron rotate). Seven transition declarations, not one.

Minor extra: `navigator.vibrate(14)` at :773 also fires unconditionally. Debatable scope, not worth blocking on.

I also checked the sibling pages for a shared helper that might cover about.html — there is none. index.html:56, artist.html:140 and artist.html:229 each hand-roll their own narrow reduced-motion rule; the only `matchMedia` calls in public/ are `display-mode: standalone` checks (index.html:514, studio.html:3137). No shared mechanism exists.

Severity: I agree with "minor". The page is fully readable and fully usable with reduced motion on; nothing is hidden, nothing is unreachable (the reveal correctly fails open, per the comment at :262-265 and the no-IntersectionObserver fallback at :779-783). This is a polish/accessibility-intent gap, not a broken page.

BETTER FIX than the one proposed. The accuser's two-line JS patch is directionally right but leaves the seven CSS transitions running and caches the setting at load, which is fragile because count() may not run until the reader scrolls far down the page. Do both halves:

CSS — replace :269-270 with a real blanket override (this is the part the accuser missed entirely):
```
@media (prefers-reduced-motion:reduce){
  .anim .up{opacity:1;transform:none;transition:none}
  *,*::before,*::after{
    animation-duration:.01ms!important;animation-iteration-count:1!important;
    transition-duration:.01ms!important;scroll-behavior:auto!important}
}
```

JS — still needed, and here is why the CSS alone is not enough: killing `transition-duration` on `.n.bump b` does not remove the motion, it makes the count SNAP to scale(1.35) and snap back 380ms later, which is arguably worse than the eased version. The class itself has to be suppressed. Read the query live rather than caching a boolean:
```
const STILL = matchMedia('(prefers-reduced-motion: reduce)');
```
in count() (:794), first line: `if (STILL.matches) { el.textContent = to + suffix; return; }`
at :770-772, replace `bump = id; draw(); setTimeout(...)` with:
```
if (STILL.matches) { draw(); }
else { bump = id; draw(); setTimeout(() => { bump = null; draw(); }, 380); }
```
That also drops a pointless second draw() 380ms later in the still case.

Note the early return in count() is belt-and-braces: the markup at :486-489 already contains the final values as text, so nothing would be blank without it — but setting it explicitly keeps `data-to` as the single source of truth if the two ever drift.

**Fix.** Two halves — the accuser's JS patch is necessary but not sufficient.

CSS, replacing about.html:269-270:
@media (prefers-reduced-motion:reduce){
  .anim .up{opacity:1;transform:none;transition:none}
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
}
This is what the existing :270 line was clearly meant to be; as written it overrides only animation-duration and the file contains no animations, so it does nothing. Adding transition-duration covers the seven live transitions at :59, :93, :126, :130, :137, :143-144 and :245.

JS, still required (the CSS alone would make .bump SNAP to scale(1.35) and snap back, which is worse than the eased version — the class itself must be suppressed). Read the query live instead of caching a boolean at load, since count() only runs when the reader scrolls that far:
  const STILL = matchMedia('(prefers-reduced-motion: reduce)');
in count() at :795, first line:
  if (STILL.matches) { el.textContent = to + suffix; return; }
at :770-772:
  if (STILL.matches) { draw(); }
  else { bump = id; draw(); setTimeout(() => { bump = null; draw(); }, 380); }
The else-branch guard also removes a pointless second draw() in the still case.

## 68. [COSMETIC] Head, nav & hero · line 25

> <link rel="icon" href="data:image/svg+xml,…three rounded bars on a #FF375F→#FF6B45 gradient…" />

**Verdict:** CONFIRMED as re-scoped — about.html needs no change (status on the original finding was indeed OVERSTATED against this page), and the real defect in studio.html:20 / venue-studio.html:20 is real, wider than stated (a third file, stage.html, and an internal self-contradiction inside each Studio file), and demonstrably leftover rather than intentional. Severity remains cosmetic / low.

**Evidence.** public/about.html:25 (house mark, identical to public/index.html:25, public/artist.html:25, public/vote.html:23, public/venue.html:24, public/community.html:10) · public/studio.html:20 and public/venue-studio.html:20 (the wrong mark) · public/studio.html:23 and public/venue-studio.html:23 (apple-touch-icon already the gradient PNG) · public/manifest-studio.webmanifest and public/manifest-venue.webmanifest (icons array = /icons/icon-512.png only) · public/icons/icon-512.png (opened; is the gradient rounded mark) · backups/index_MVP-2.0_modernist_2026-08-17.html:14 and :22 (the abandoned #ec3013 zero-radius direction the Studio favicon descends from) · public/stage.html:8 (no favicon, dead #ec3013 link colour) · public/about.html:278 (nav glyph — same mark, the accuser's proportional objection does not hold)

**Skeptic (high).** I tried to knock this down and could not. Every load-bearing fact checks out in code I read myself, and two things the accuser did not establish make the case stronger.

WHAT I CONFIRMED
1. Six pages carry a byte-identical favicon string: about.html:25, index.html:25, artist.html:25, vote.html:23, venue.html:24, community.html:10. I md5'd the extracted lines — five hash identically to about.html's; community.html differs only by `">` vs `" />` line terminator, same SVG. So about.html is not an outlier; it is the house mark.
2. studio.html:20 and venue-studio.html:20 are byte-identical to each other and different from all six: flat `#201e1d` plate (no rx), square-cornered `#ec3013` bars at x=24/44/64, h=34/52/22. Confirmed exactly as alleged.
3. I opened public/icons/icon-512.png myself. It is the gradient rounded mark — pill-ended bars, FF375F→FF6B45, rounded plate. The accuser's "it matches the favicon" is right.

TWO THINGS THE ACCUSER MISSED — both strengthen the finding
4. The mismatch is INSIDE each Studio file, not merely against about.html. studio.html:23 and venue-studio.html:23 both set `<link rel="apple-touch-icon" href="/icons/icon-512.png">`, and manifest-studio.webmanifest / manifest-venue.webmanifest list icon-512.png + icon-maskable-512.png as their ONLY icons. So the Studio's home-screen and installed-app icon is already the gradient mark while its browser tab shows the dark one. This kills the best available defense — "the Studio is a separate dark-chrome PWA with its own identity" — because if that were the intent, the manifests would carry their own icons. They don't.
5. Provenance: backups/index_MVP-2.0_modernist_2026-08-17.html:14 carries the same bar geometry (x=24/44/64, h=34/52/22, zero rx) on an `#ec3013` plate, and that file's own header at line 22 reads "Flat · zero-radius · one accent (#ec3013)". The Studio favicon is residue from an abandoned 2026-08-17 "modernist" direction, inverted once during the dark-chrome pass (plate → #201e1d, bars → #ec3013) and never re-marked. It is leftover, not a decision.

ONE CORRECTION AGAINST THE ACCUSER — in their own favor
Their nav-SVG sub-argument is a non-finding. They compared favicon bar heights as a fraction of the 100-unit viewBox (.32/.48/.22) against nav bar heights as a fraction of the 24-unit viewBox (.458/.667/.333) and concluded the two are "not the same beyond a scale factor". That is apples to oranges: the 100×100 favicon box includes the plate's padding, the 24×24 nav glyph is the bar group alone with no plate. Compared bar-to-bar, they are the same mark: tallest-relative heights .667/.458 (favicon) vs .6875/.5 (nav), and rx/width is exactly 0.5 — a full pill — in both. about.html is internally consistent to within a few percent, i.e. cleaner than the accuser argued.

WIDER THAN STATED
public/stage.html is a third file carrying the dead accent: it has no `rel="icon"` at all (the only one of the nine pages without one, and there is no public/favicon.ico to fall back to), and line 8 styles its link `color:#ec3013`. It is a 9-line instant redirect to /studio.html so the stakes are near zero, but it is the same residue.

Severity: cosmetic, and it stays cosmetic — nothing functional depends on it. But "cosmetic" understates it slightly for a brand whose entire tab-strip presence during a live gig is that mark, on precisely the two pages the artist keeps open all night.

**Fix.** Same edit, better rationale and one more file.

1. studio.html:20 and venue-studio.html:20 — replace the favicon data-URI with the exact string from about.html:25 (copy it verbatim so all eight pages hash identically). Justify it not as "match the house style" but as removing a contradiction inside each of those two files: line 23 of each already serves /icons/icon-512.png as the apple-touch-icon, and each file's own manifest lists that same PNG as its only icon. Today the tab shows a dead red-orange square while the home screen shows the gradient rounded mark — same page, two identities.

2. Do NOT keep the dark plate for dark-chrome legibility. That argument is already settled against by the manifests: the gradient plate is what those pages hand to iOS and to the installed app, so there is no legibility case for a special dark tab variant.

3. public/stage.html — while in the area: it is the only page with no rel="icon" and there is no public/favicon.ico to fall back to, and line 8 hardcodes color:#ec3013, the abandoned accent. Add the same favicon line and change the link colour to #FF375F. Optional, near-zero stakes (the page redirects instantly), but it is the last of the residue.

4. Root-cause note for whoever picks this up: the mark now lives as an inline data-URI duplicated across eight files. That is why two drifted. If it is ever touched again, the durable fix is one favicon file (public/icons/mark.svg) referenced by every page, not eight copies of a string — but that is a separate change and not required to close this.

5. Verification after the edit, not before: `grep -h 'rel="icon"' public/*.html | md5` should return a single hash across all nine pages, and `grep -rn 'ec3013' public/` should return nothing.

## 69. [COSMETIC] FAQ, close, footer · line 702

> you can add in one tap

**Verdict:** CONFIRMED but trivial — a literal-precision nit, not an overstatement of what the product does. Severity cosmetic, and the weakest class of finding: the mechanism the sentence describes (no typing, one button, ~57 songs appended in a single pass, nothing existing touched) is completely true. Only the tap count is off by the confirmation dialog. Under Perry's own "this isn't a courtroom" rule — never rewrite his framing when the mechanism under it is true — this is flag-once, his call, not a must-fix.

**Evidence.** public/about.html:702 ("covers you can add in one tap and edit down"); public/studio.html:1954 — the ONLY starter-pack control in the whole app, `onclick="if(confirm('Add around 60 well-known covers to your setlist? Nothing you already have is touched.'))act('starterSetlist')"`; public/studio.html:946-957 `act()` posts once and re-renders, no further prompt; netlify/functions/admin.mjs:1972-1983 appends in one pass and returns; netlify/functions/_lib.mjs:47 STARTER_SONGS = 57 entries, so "around sixty" is accurate; netlify/functions/_plan.mjs:133 MAX_LIBRARY = 2000, so nothing is truncated.

**Skeptic (high).** I opened both files rather than trusting the accusation. The confirm() wrapper is real and unconditional (public/studio.html:1954), it is the only starter-pack control in the app, and nothing follows the OK — admin.mjs:1972-1983 writes the songs in one pass. So a person genuinely taps twice: the button, then OK. The accuser is not reading a comment as behaviour and not applying a condition the page never implied; the page's sentence is not more carefully hedged than they noticed ("in one tap" is a bare numeric claim).

But the finding is as small as a finding gets, and I want to be clear about that rather than let it be scored alongside real problems. The sentence's job is to answer "how long does setting up take?" — its claim is that you do not type sixty songs, you press a button. That claim is exactly true. A native OS confirmation is a safety net, not effort or data entry, and the page makes no promise about dialogs. Nobody buys, skips, or misjudges MySet because of it.

So: not refuted, but the proposed fix is worse than the problem. "A couple of taps" is the kind of edit Perry vetoed on 2026-09-06 — it defends against a charge nobody made and drains the line. "In one go" is accurate, keeps the rhythm, and does not re-break if the confirm is ever replaced by a styled modal (which would still be two taps).

The genuinely more useful output of this check is the pair of app-side issues above — particularly the seven silently-deactivated songs on the free plan, which is a real user-facing gap that the single-song path already handles and this path does not.

**Fix.** Do NOT use "in a couple of taps" — it counts taps out loud, reads as an apology, and makes the sentence worse than the fact it fixes. If it changes at all: "…and there's a starter pack of around sixty well-known covers you can add in one go and edit down." Same cadence, same punch, and it survives the confirm dialog (and any future styled modal) instead of breaking again the moment the button changes.

I checked every escape hatch and none saves "one tap": there is no second starter-pack path (grep for starterSetlist across public/ and netlify/ returns exactly one caller), no onboarding auto-seed (DEFAULT_ARTIST at _lib.mjs:118 is a slug, not a song template), and no plan gate that would make it more taps either (admin.mjs:1694 only computes the feature cap for this action).

Two things I found that are WIDER than the accusation, both in the app rather than the landing page, so out of this audit's scope but worth logging:
1. public/studio.html:1967 — the empty-state row tells a brand-new artist to "tap Add the starter pack at the bottom". The button is labelled "+ Starter pack" and sits at the TOP of the setlist tab (line 1954). Wrong label, wrong place, and it is shown to exactly the person who has never seen the screen before.
2. netlify/functions/admin.mjs:1972-1983 — the free plan features 50 songs (_plan.mjs featured: 50) and the pack is 57, so a free artist gets 50 live and 7 silently switched off. The single-song path sets an explanatory note for this (admin.mjs:844, "Added, but switched off — your plan features N at a time"); the starter-pack path sets none. The artist is never told why seven songs arrived dark. That is a real gap, and unlike the tap count it can actually confuse someone.
