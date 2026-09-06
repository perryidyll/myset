# MySet — What the app does that the landing page never says

Five lenses, run independently against the 791-feature app catalogue.

## A working gigging musician who read myset.vip/about, signed up, and then got the keys to the whole app — ranking every gap by whether knowing it would have changed the decision to sign up (or to pay).

**Structural verdict.** The page's shape is still right. What has broken is that the app moved and the page's honesty block did not — and it moved in the direction that costs signups.

1. The "Three honest notes" block is now the single biggest liability on the page. Two of the three are false, and both falsely claim a thing does NOT exist when it does: card payments (live for every artist via Stripe Connect, _connect.mjs:131-180) and buying Plus or Pro (live via Stripe Checkout, _billing.mjs:120-161). Beat 4 defers to that block from the middle of the page — "the note under the plans says exactly where that stands" — so a stale note is poisoning the strongest section too. Rewrite it as two notes: (1) MySet is early, one real gig, still built in public — keep that one exactly as it is, it earns trust; (2) the four Pro extras marked Soon are not built. Then move a new, truer third piece of honesty into pricing: Stripe's own card fee comes off the artist's side. The block should shrink, not grow — but the sentence it loses must be replaced by a harder one, or the page loses the quality that makes it work.

2. One section is missing entirely, and it is the strongest argument the app has. Everything that runs without the artist — the calendar starting and ending the show, the setlist loading itself, votes coming back when a song is dropped, the night filing itself into history, the city feed rewriting itself — is invisible here. The section already titled "Five things happen. None of them need you." is the natural home: add a sixth beat about the calendar running the night and the title stops being a claim and becomes a demonstration. Before writing it, resolve the drift: the code puts no plan gate on auto-shows (_auto.mjs:133) but the Studio's plan cards list them under Plus and Pro only (studio.html:3531, 3545). Two surfaces already disagree; a third must not join in.

3. The pricing table has quietly become the least accurate section on the page, in four separate ways: setlists listed as free when creating one is Plus (admin.mjs:730-737); the Free room number reading as a locked door when it is not; "2% cut — stays yours" implying 98% when Stripe's fee sits on top; and the verified tick, which the Studio sells under Plus, missing altogether. Plus currently has no single reason to exist that a stranger can see from outside. The tick is that reason, and it is sitting unused.

4. Nothing on the page is for the artist after the gig. Beat 5 covers being findable and then the page moves on. The community page — stars, photos, thirty-second clips with sound, one reply of your own, hide-anything-free — is one bullet in a price list. Extend beat 5 rather than adding a section; it is already the after-the-gig beat and it is the thinnest of the five.

5. The venues section reads as a free product with no price. It is not: Venue Pro is $20 a month, buyable today, and the cut on venue merch is 10% or 2%. Either give the pricing grid a fourth card or give the venues section its own short price paragraph. Right now a publican finishes signup and then finds a tier.

6. Two things must be kept OFF the page despite being in the code: Spotify playlist import (needs SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET, unset in production, endpoint 503s) and push alerts to the artist's phone (needs VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY, unset). Both read like excellent copy and both would be untrue today.

7. One correction inside the page's own JavaScript, not just its prose: the live demo lets a reader take a vote back (about.html:768), which is the OFF behaviour of the voteFinal flag. The default has been ON since 2026-09-02. The demo is the most-used part of this page and it is currently teaching the wrong lesson about how the room behaves.

8. Length is not the problem people will think it is. Four of the must-adds are edits to sentences that already exist, and two of them delete text. The page can absorb the sixth beat and the community-page paragraph and still come out shorter than it is now if the honest block loses its two dead notes.

| Priority | Feature | State | Where it belongs |
|---|---|---|---|
| must-add | Card payments work for every artist now — the page says the opposite | BUILT AND LIVE for any artist on any plan, including Free. Stripe Connect Express onboarding, direct charges, daily payouts, MySet | Beat 4 ("Money happens without you asking") — delete the caveat paragraph and replace it with the real mechanism. Then rewrite hon |
| must-add | Plus and Pro can actually be bought — there is a working checkout | BUILT AND LIVE. Stripe Checkout in subscription mode, upgrades and downgrades with proration, Stripe's own portal for cards and in | Honest note 3 — delete it. Add one line at the foot of the pricing grid. |
| must-add | Stripe's own card fee comes out of your side, not MySet's | BUILT. Direct charges make the artist the merchant of record, so Stripe's processing fee is charged to the artist. The Studio says | Pricing — as the replacement honest note, or directly under the fee bullet in each plan card. |
| must-add | Your gig calendar starts and ends the show for you | BUILT. One caveat to resolve before it goes on the page: there is NO plan gate in the code — _auto.mjs:133 checks only show.autoSt | A sixth beat in "The night" — the section is already titled "None of them need you", and this is the beat that makes the title tru |
| must-add | Making a new named setlist is a Plus feature | BUILT and Plus-gated for CREATION only. Using, renaming, editing membership, deleting and attaching one to a gig all stay free, an | Two edits: the Free plan bullet, and the "Can people see my whole setlist?" FAQ answer. |
| must-add | Nobody is ever turned away when the room goes over your plan's number | BUILT. Going over is a billing line, not a turnstile: the room polls a little slower and the board shortens to the top 40. No vote | The Free plan card. |
| must-add | A vote is final once it's confirmed — and the page's own demo says otherwise | FLAG-GATED, default ON. Off is a real working alternative (a second tap refunds), and it can be flipped globally or per artist — s | The demo footer, plus the demo's own tap handler. |
| must-add | The community page is a real thing — stars, photos and thirty-second clips with sound | BUILT and free on every plan, for artists and venues. Fans post with no account. Permanently deleting a post is Plus; hiding is fr | Beat 5 ("And afterwards, they can find you") — extend it. It is already the after-the-gig beat and it is currently the thinnest of |
| should-add | You can take everything with you, and leaving is undoable for thirty days | BUILT. Owner role only. Deleting takes two screens and typing DELETE; the page goes dark that day and the subscription is cancelle | A new FAQ item. |
| should-add | There is no password — a code, or Face ID, or eight printed recovery codes | BUILT. Passkeys and recovery codes are owner-role only. Sign-in by emailed code needs RESEND_API_KEY, which IS set in production.  | The close section, one line under the three steps. |
| should-add | You can paste or import your whole song list instead of typing it | BUILT for CSV and pasted text — splits on the first comma, tab, dash or spaced hyphen, and skips a header row. Spotify playlist im | The "How long does setting up actually take?" FAQ. |
| should-add | The green verified tick | BUILT, Plus and Pro only. The tick disappears by itself the moment a plan lapses. The Studio's own plan cards sell it under Plus a | The Plus card, and one line in the proof section beside the venue pitch. |
| should-add | $10 puts your gig at the top of a city's listing for that night | FLAG-GATED behind featuredShows, default ON, read globally. No plan gate — a free artist can buy a spot. Owner role only. If the f | Beat 5, after the what's-on feed sentence. Keep it away from the Pro card so the two do not blur. |
| should-add | Rename your page and the printed QR codes still work | BUILT. Owner role only. The old address is held for you and nobody else can claim it. | Beat 1, straight after "Print it once. It's good forever." |
| should-add | Venues have a paid plan too, and the pricing section never says so | BUILT. Venue Pro is self-serve and buyable, same as the artist tiers. Two venue features — a tip jar for the staff, and voting for | Either a fourth card in the pricing grid, or a two-line price paragraph inside the venues section. |
| should-add | You decide whether venues see your numbers | BUILT, free, on by default. | The proof section, right after the venue pitch paragraph. |
| should-add | Merch is a real shop, not a link | BUILT. Plus and Pro for artists; Pro for venues. Needs Stripe Connect set up. Items already added stay saved if a plan lapses — th | The Plus card bullet, expanded — or a short line in beat 4. |
| should-add | A twelve-month earnings statement you can hand to an accountant | BUILT. Owner role only. Returns nothing until the artist has a Stripe account, and never reaches back before the day the account w | The Freedom card in the transformation section, as its anchor line. |
| optional | It installs on your phone like an app — for you, not for them | BUILT on every page. The fan side installs too, but is deliberately never pushed to do it. | Beat 2 ("You stop guessing"), one line. |
| optional | Pull the lyrics for the whole set before you leave the house | BUILT, free on every plan, deliberately. | Beat 5, one sentence. |
| optional | A separate list for songs you don't play yet | BUILT, free on every plan. Deliberately kept out of the library so the room can never vote for something unplayable. | The proof section, alongside the history claim. |
| optional | Votes somebody paid for carry over to your next show | BUILT. | Beat 4, one sentence. |
| optional | "People in the room" means phones that opened the voting page | BUILT. The Studio and the Venue Studio both say this under the figure; the landing page does not. | The proof section, one line under the stat grid. |
| optional | Alerts on your phone when a request comes in — HOLD, not live | NOT LIVE in production. The code is built, but it needs VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY as environment variables, and produ | Beat 3 — but only once the keys are set. Hold it until then. |

### Card payments work for every artist now — the page says the opposite

*BUILT AND LIVE for any artist on any plan, including Free. Stripe Connect Express onboarding, direct charges, daily payouts, MySet never sees bank details. STRIPE_SECRET_KEY is set in production. The page's honest note 2 (about.html:654-657) and the caveat inside beat 4 (about.html:415-418) both say this does not exist yet — they are stale.*

**Why it matters.** This is the single most expensive sentence on the page. A musician reads beat 4 — "money happens without you asking" — and then reads the page immediately taking it back. The entire tipping and vote-pack argument self-destructs, and the 10% / 2% / 0% ladder in the pricing table is declared to apply to nobody. Somebody deciding whether MySet is worth twenty minutes of setup is being told the money half is imaginary. It isn't. It works today, on the free plan, in twenty-two countries.

**Where.** Beat 4 ("Money happens without you asking") — delete the caveat paragraph and replace it with the real mechanism. Then rewrite honest note 2 out of existence.

**Draft copy.** Beat 4, replacing about.html:415-418 — "The money is yours, not ours. You connect a Stripe account once — Stripe does the checks, MySet never sees your bank details — and from then on tips and vote packs land in your own account, paid out daily. Takes about five minutes, and you can do it on the free plan."

### Plus and Pro can actually be bought — there is a working checkout

*BUILT AND LIVE. Stripe Checkout in subscription mode, upgrades and downgrades with proration, Stripe's own portal for cards and invoices, webhooks plus a six-hourly re-sync. Owner role only. The page's honest note 3 (about.html:658-660) says "There's no checkout, so nobody is being charged for anything" — stale.*

**Why it matters.** A musician playing three nights a week hits the four-shows-a-month cap in the second week. The page tells them the only way past it does not exist. So they either stop, or they conclude MySet is a toy. Both are wrong, and both are the page's fault.

**Where.** Honest note 3 — delete it. Add one line at the foot of the pricing grid.

**Draft copy.** Under the three plan cards — "You can change plan any time from Settings. Upgrades take effect straight away; going back to Free waits until the month you've already paid for runs out. Cards, invoices and receipts are handled by Stripe, not by us."

### Stripe's own card fee comes out of your side, not MySet's

*BUILT. Direct charges make the artist the merchant of record, so Stripe's processing fee is charged to the artist. The Studio says this before an artist onboards. The landing page says "2% cut instead of 10% — tips, vote sales and merch stay yours" (about.html:630), which reads as 98%.*

**Why it matters.** On a $5 vote pack a Plus artist pays roughly 45¢ to Stripe and 10¢ to MySet. If somebody learns that from a payout rather than from this page, they will believe they were lied to about the headline number — and they will be half right. The Studio already refuses to let an artist find out the hard way; the page should not be the one place that does.

**Where.** Pricing — as the replacement honest note, or directly under the fee bullet in each plan card.

**Draft copy.** In the honest block, replacing the old note 2 — "What the cut actually means. The payment is yours, so Stripe's own card fee — about 2.9% plus 30¢ — comes out of your side, the same as it would anywhere else. MySet's cut is on top of that: 10% on Free, 2% on Plus, nothing on Pro. On a $5 vote pack that's about 45¢ to Stripe and 10¢ to us if you're on Plus. We'd rather you heard it here than worked it out from a payout."

### Your gig calendar starts and ends the show for you

*BUILT. One caveat to resolve before it goes on the page: there is NO plan gate in the code — _auto.mjs:133 checks only show.autoStart — but the Studio's own plan cards list "Shows that start and end themselves" under Plus and Pro and not under Free (public/studio.html:3531, 3545). Two surfaces disagree. Whatever the answer, the page must match it.*

**Why it matters.** The thing a working musician actually fears about a tool like this is having to remember it while loading in, tuning up and talking to the bar. "Put your gigs in once and it runs itself" removes the one real objection — that MySet is another thing to operate on stage. It is also the strongest reason to keep a calendar up to date, which is what feeds the venue pages and the city feed.

**Where.** A sixth beat in "The night" — the section is already titled "None of them need you", and this is the beat that makes the title true.

**Draft copy.** "6 — It starts without you. Put your gigs in your calendar once. When Thursday 8pm comes round, the show starts itself and the room can vote before you've finished tuning. Three hours after your finish time it files the night and closes itself — and it won't do that mid-song. You can switch the starting half off if you'd rather do it by hand. The ending half stays, because that's the bit everybody forgets."

### Making a new named setlist is a Plus feature

*BUILT and Plus-gated for CREATION only. Using, renaming, editing membership, deleting and attaching one to a gig all stay free, and a downgrade never deletes a set. The page says the opposite twice: the Free card lists "Setlists, chord charts, keys and genres" (about.html:606) and the FAQ answer at about.html:693-698 walks a free reader straight into the locked button.*

**Why it matters.** This is the page promising something the app refuses. The FAQ answer is a good answer — build a set for one night, attach it to a gig — and a free artist will follow it, hit a 402, and conclude the page lies. Hiding songs IS free and does most of the same job, which is the honest free-plan answer.

**Where.** Two edits: the Free plan bullet, and the "Can people see my whole setlist?" FAQ answer.

**Draft copy.** FAQ, revised — "They see what you choose to show. Any song can be hidden, and it stays hidden across every future show until you bring it back — that's free, and it covers most nights. If you want named sets instead — a beach set, a late set, an Irish pub set — that's on Plus. You can keep twenty of them, attach one to a gig in your calendar, and it loads itself when the show starts. Sets you've already made keep working if you go back to Free." | Free card bullet, revised: "Chord charts, keys and genres — and hide any song from the room"

### Nobody is ever turned away when the room goes over your plan's number

*BUILT. Going over is a billing line, not a turnstile: the room polls a little slower and the board shortens to the top 40. No vote is ever refused. The room size is fixed when the show starts, so an upgrade mid-set does not change the room underneath you.*

**Why it matters.** The page explains this for Plus ("if more turn up the night still runs", about.html:622-623) and not for Free, where the bullet reads "4 shows a month — up to 200 people in the room at each". A pub player whose Friday sometimes hits 250 reads that as a locked door on their best night, and either pays before they need to or walks away. The whole design decision here is that the door never locks — say it where the free reader is standing.

**Where.** The Free plan card.

**Draft copy.** Free card, revised bullet — "4 shows a month, up to 200 phones in the room — and if more turn up, nobody is locked out. The board just refreshes a little slower."

### A vote is final once it's confirmed — and the page's own demo says otherwise

*FLAG-GATED, default ON. Off is a real working alternative (a second tap refunds), and it can be flipped globally or per artist — so the page should describe the default without promising it can never change. Fans can always ADD more votes to a song they already backed.*

**Why it matters.** It changes what the room does. Final votes mean people stack votes on the song they really want instead of shopping around, and it means an artist never has a winner evaporate in the last ten seconds before they tap Start. A musician who has played with the demo will expect the other thing and be surprised on stage — and the demo is the most-used part of this page.

**Where.** The demo footer, plus the demo's own tap handler.

**Draft copy.** Demo footer, after a vote is cast — "Votes stay where you put them. You can add more to a song, but you can't take them back. That's on purpose: it stops the queue churning in the last ten seconds before you start a song." (And the demo's tap handler at about.html:768 should stop refunding on a second tap, so the page behaves the way the room does.)

### The community page is a real thing — stars, photos and thirty-second clips with sound

*BUILT and free on every plan, for artists and venues. Fans post with no account. Permanently deleting a post is Plus; hiding is free, instant and undoable — but hiding also deletes that post's photos and clip for good.*

**Why it matters.** The page mentions this once, as a bullet inside a pricing card (about.html:609). It is the only thing a musician gets back after the gig that isn't a number — a wall of photos and short videos of their own room, from the night, with the sound. That is what they will screenshot and post. And "you can take anything down the second you see it, on any plan" is the answer to the obvious worry.

**Where.** Beat 5 ("And afterwards, they can find you") — extend it. It is already the after-the-gig beat and it is currently the thinnest of the five.

**Draft copy.** Added to beat 5 — "There's a page for the night itself, too. People rate it out of five, say something, and post their photos — or a thirty-second clip of the room, with its sound, straight off their phone. You get one reply per post, you can pin your favourite, and you can hide anything you don't want up there instantly, on any plan, and put it back if you change your mind."

## The punter in the bar — what actually happens on a fan's phone, from scanning the code to the morning after. Compared public/about.html line by line against public/vote.html, public/community.html, public/artist.html and the server handlers that gate them (vote.mjs, show.mjs, _flags.mjs, _requests.mjs, _community.mjs, _video.mjs, _pay.mjs, _connect.mjs, _auto.mjs, qr.mjs).

**Structural verdict.** The shape is mostly right. Three things about it have gone wrong, in descending order of cost.

1. The demo is now the weakest thing on the page, and it is the load-bearing thing. Section 3 says "This is the real thing, running on this page" — and it isn't any more. It runs a one-tap toggle with take-backs, which is exactly the behaviour the app switched off on 2 September. It also shows 3 free votes where the app ships 5, and no replay row. Everything downstream of it inherits the wrong mental model, including the reader's. Rebuilding it with the stepper, finality and one already-played row fixes four gaps at once with almost no added words, which is the only kind of edit a page this long can afford. This is the single highest-value change on the list.

2. Beat 5 is doing two jobs and dropping one of them. "And afterwards, they can find you" currently carries the lyrics button, the profile page, the links, the gigs and the city feed — and the community page, the whole surface where the room writes back with photos and clips, appears nowhere in the narrative at all. It should split: Beat 5 keeps the profile (find you), a new Beat 6 takes the community page (say something). The page already has a "solo" full-width beat style for a beat with no screenshot, so it costs no new CSS. This is the only place I'd add a section rather than a paragraph.

3. The honest-notes box has inverted. It was the page's credibility device; two of its three notes are now stale in the artist's favour — card payments work per-artist once Stripe onboarding is done, and Plus/Pro checkout is built and live. Left as-is the page talks a musician out of the product on the one point that decides it. The box should stay, with its three-note shape, rewritten. The remaining true note is note 1 (MySet is early, one real gig), which is worth keeping exactly as it is.

Nothing needs killing. Section 6 (proof, the eight people and twenty-one votes) and Section 7 (venues) are unchanged by any of this and are the strongest writing on the page.

One thing outside the copy that the fan lens keeps hitting: public/vote.html and public/community.html carry no Open Graph tags at all (about.html:21-24 is the only page with a full set). A fan who pastes "come vote" into a WhatsApp group gets a bare link with no title, no picture and no artist name. And public/artist.html:21-23 previews every artist on the platform as a stock photo called "MySet" with the description "Live music. You pick what gets played." For a product whose whole distribution story is "print it once and they share it", that's a hole under the page's own promise — not a landing-page edit, but the landing page is making a claim the app doesn't currently support.

| Priority | Feature | State | Where it belongs |
|---|---|---|---|
| must-add | Votes are final once confirmed — and the page's own demo teaches the opposite | built, flag-gated (voteFinal), default ON — this is what every room gets today. The take-back path still exists behind the flag bu | Section 3, the live demo (public/about.html:329-357). The demo code itself has to change — copy alone can't fix a widget that does |
| must-add | One tap is not one vote — the room can put several votes on one song at once | built, free, every plan | Section 3, the demo (the stepper should be in it), and one line in Beat 1 or the demo footer. |
| must-add | The community page — fans post about the night, with photos and a real video clip, still with no account | built, free on every plan for posting, replying, pinning and hiding. Permanently deleting a post is Plus (netlify/functions/_plan. | Beat 5 should split in two. Beat 5 keeps the profile page; a new Beat 6 is this. It is the strongest afterwards story on the page  |
| must-add | Card payments are live for any artist who connects a Stripe account — the page still says they aren't | built. Per-artist: the tip and buy-votes buttons only appear to the room once that artist has finished Stripe's onboarding (public | Beat 4's caveat paragraph (public/about.html:415-418) and honest note 2 (public/about.html:654-657). |
| must-add | A song you've already played stays votable, at a higher price | built, free on every plan at the default of 5. Changing the number is Plus (netlify/functions/admin.mjs:1946-1952). | Section 3, in the demo (one "Already played · 5 votes" row would show it without a word of copy), or a line in Beat 2. |
| must-add | A fan can see what happened to their request, without asking you | built, free. The request buttons only render when the artist has switched requests on (netlify/functions/_lib.mjs:182-183, off by  | Beat 3 (public/about.html:393-405), as the second paragraph. |
| should-add | Votes they paid for don't expire at closing time — and they choose what happens to the leftovers | built, free. The gift is a pledge honoured only at the real end of a show, so an End tapped by mistake quietly makes the fan whole | Beat 4 (public/about.html:407-420). |
| should-add | The code on the table goes to your page, not the voting screen — and the show can start itself | built. Auto-start is on every plan in code — the only gate is the artist's own switch (netlify/functions/_auto.mjs:133). Note: the | Beat 1 (public/about.html:370-379), which is currently only four lines and can carry it. |
| should-add | The room can search, sort and filter your setlist | built, free | The FAQ — a new question next to "Can people see my whole setlist?", or folded into that answer. |
| should-add | Nobody is ever turned away for the room being too big — and the room is told why the list got shorter | built, free. The number itself is per plan — 200 / 1,000 / 2,000 — stamped on the show when it starts (netlify/functions/_lifecycl | The wifi FAQ answer (public/about.html:684-688), which is the closest thing on the page to a reliability section. |
| should-add | Unlimited votes for the whole room — free on every plan, deliberately | built, free on every plan — it sits deliberately outside the Plus pricing lock. Nobody can buy votes while it's on. | The pricing section, under the "Everything the room sees is free. Always." lede — or as an FAQ. |
| should-add | A dropped connection never costs a fan a vote or a payment | built, free | The wifi FAQ answer. |
| optional | A fan's votes live in that browser, on that phone | built. It's the direct consequence of "no account", which the page is rightly proud of. | The "do my fans have to download anything?" FAQ, as the last sentence. |
| optional | Lyrics say honestly where they came from | built, free on every plan, deliberately (netlify/functions/_plan.mjs:11-15) | Beat 5 (public/about.html:426-428). |

### Votes are final once confirmed — and the page's own demo teaches the opposite

*built, flag-gated (voteFinal), default ON — this is what every room gets today. The take-back path still exists behind the flag but is unreachable in production (public/vote.html:484-496).*

**Why it matters.** This is the only place on the page where a musician gets to feel the product, and it teaches a mechanic the app removed. They will play with it, tell their audience on the first night that they can change their mind, and the first fan who tries gets refused. It also hides the reason finality exists: without it, a table can stack a song, watch it win, and pull out before it plays.

**Where.** Section 3, the live demo (public/about.html:329-357). The demo code itself has to change — copy alone can't fix a widget that does the wrong thing. Then one line in the demo footer.

**Draft copy.** Demo footer, replacing the current line: "Once you confirm, that's it — a vote stays with the song. You can always put more on it. You just can't take one back, which is what stops a table stacking a song, watching it win, and pulling out."

Also: the demo's counter says "3 votes left". The app ships 5 (netlify/functions/_lib.mjs:176). Make it 5.

### One tap is not one vote — the room can put several votes on one song at once

*built, free, every plan*

**Why it matters.** It changes what a vote means. A table of four who all want the same song can put twelve on it in one go and move the board that far in one jump, rather than four taps that look like four different people. The page's demo shows a plain Vote/Voted toggle, so a musician reads MySet as one-person-one-vote and can't picture the actual dynamic in a room.

**Where.** Section 3, the demo (the stepper should be in it), and one line in Beat 1 or the demo footer.

**Draft copy.** "Tapping a song doesn't just add one. A slider opens — put one vote on it, or put five. So a table of four who've all decided on the same song can land twelve at once, and you can see the difference between a room that quite likes something and a room that really wants it."

### The community page — fans post about the night, with photos and a real video clip, still with no account

*built, free on every plan for posting, replying, pinning and hiding. Permanently deleting a post is Plus (netlify/functions/_plan.mjs:69, 159-161). Hiding also deletes that post's photos and clip for good (netlify/functions/_community.mjs:264-272).*

**Why it matters.** It is a whole second surface the room touches, and the landing page mentions it once, as a bullet inside a pricing column. A musician deciding between MySet and nothing is deciding partly on "what do I have the morning after" — and the answer is a page of the room's own photos, clips with the actual sound of you playing, and star ratings tied to that specific night. None of that is on the page.

**Where.** Beat 5 should split in two. Beat 5 keeps the profile page; a new Beat 6 is this. It is the strongest afterwards story on the page and it currently isn't told.

**Draft copy.** "6 — And they can say something afterwards\n\nWhen the last song's done, the voting screen turns into a link. It goes to your community page — myset.vip/yourname/community — with that night already selected.\n\nThey rate the night out of five, write a bit, add a few photos, and post a clip up to thirty seconds straight off their camera roll. Nothing on their phone re-encodes it, so it arrives with the actual sound of you playing. Still no account. Still nothing to install.\n\nYou reply once to any post, pin the one you want at the top, and hide anything you don't — instantly, and you can put it back. Hiding is free on every plan, because you shouldn't have to pay to take something off your own page."

Fine print worth keeping honest: "Hiding takes the words off the page and deletes that post's photos and clip for good. Un-hiding brings the words back, not the pictures."

### Card payments are live for any artist who connects a Stripe account — the page still says they aren't

*built. Per-artist: the tip and buy-votes buttons only appear to the room once that artist has finished Stripe's onboarding (public/vote.html:708, 918, 934). Before that the room sees "Card payments aren't on tonight — grab Sam between songs." Not flag-gated. STRIPE_SECRET_KEY is set in production.*

**Why it matters.** Beat 4 promises the room can tip and buy votes, then two paragraphs later the page tells the musician that none of it works for them. That is the single biggest reason someone reads this page and decides to wait. It is no longer true, and the page is now under-selling its own product on the one point that decides whether MySet is worth setting up.

**Where.** Beat 4's caveat paragraph (public/about.html:415-418) and honest note 2 (public/about.html:654-657).

**Draft copy.** Replace the Beat 4 caveat with: "You set the money up once, in your Studio. You connect a Stripe account, Stripe does the ID checks, and it pays into your bank daily. Until that's finished the tip and vote buttons simply don't appear to the room — a button that leads to a shrug is worse than no button."

Replace honest note 2 with: "2 · The money runs through your own Stripe account, not ours. That means you're the one being paid, we never hold it, and we never see your bank details. It also means you have to finish Stripe's setup before the room sees a tip button. Stripe takes its usual card fee out of your side; our cut on top is 10% on Free, 2% on Plus, nothing on Pro."

Honest note 3 also needs replacing — planCheckout is built and live (netlify/functions/admin.mjs:79-85, netlify/functions/_billing.mjs:120-161). Suggested: "3 · The four Pro extras marked Soon are on the way, not shipped. Everything else listed above is built and running today."

### A song you've already played stays votable, at a higher price

*built, free on every plan at the default of 5. Changing the number is Plus (netlify/functions/admin.mjs:1946-1952).*

**Why it matters.** "Play it again!" is the most common thing shouted at a bar gig, and MySet turns it into a decision the room pays for out of its own votes instead of a shout you have to field. The page never mentions that a played song stays on the list at all — a musician reading it assumes the setlist only shrinks through the night.

**Where.** Section 3, in the demo (one "Already played · 5 votes" row would show it without a word of copy), or a line in Beat 2.

**Draft copy.** "Nothing drops off the list when you play it. It just gets dearer — five votes to hear it again instead of one, and the room sees the price on the row. So 'play it again!' stops being a shout you have to field and becomes something a table decides to spend on."

### A fan can see what happened to their request, without asking you

*built, free. The request buttons only render when the artist has switched requests on (netlify/functions/_lib.mjs:182-183, off by default).*

**Why it matters.** Beat 3 says declining refunds their votes automatically so you're never the bad guy. It stops one step short of the thing that actually spares you: the fan is told, on their own screen, without coming over. Waiting on Sam → On the list — go vote for it → Played → Not tonight, votes refunded. Without that line a musician still pictures someone at the front of the stage asking whether you got it.

**Where.** Beat 3 (public/about.html:393-405), as the second paragraph.

**Draft copy.** "And they can see where it got to without coming over. Under the button it says Waiting on Sam, then On the list — go vote for it, then Played, or Not tonight — votes refunded. Nobody has to catch your eye mid-song to find out."

## A venue owner reading the "For venues" section (public/about.html:504-585) against the whole venue side of the app: public/venue.html, public/venue-studio.html (six tabs — Page, What's on, Numbers, Menu, Merch, Settings), and netlify/functions/{venue,venueadmin,venueauth,_venues,_vstats,_pitch,_verify,_venueaccount}.mjs. The section was written when a venue page was a listing that filled itself in. It is now a six-tab back office with a paid tier, a fan-facing community feed, a shop and a payout account — and the page has never heard of any of that.

**Structural verdict.** The shape no longer fits. The section is built as one idea — *it fills itself in* — expressed as six benefit rows, three feeling cards, and a closing beat that re-explains the name matching. That was the right shape when a venue page was a listing. The venue side is now six tabs, a paid tier, a fan-facing feed, a shop and a payout account, and none of the last four have a home in the current structure.

Three structural moves, in order of value:

1. **Split the six rows into two lists: what fills itself in, and what you fill in.** Right now rows 1-3 and 5 are automatic and rows 4 and 6 are not, and the mix is why "your menu and your offers" can appear twice without the reader ever learning they are things you type. Two short lists under one heading keep the length identical and make the product legible.

2. **The community page needs to be its own beat, not a bullet.** It is the only surface where fans touch a venue, it is the section's best proof of "one less weekly job" (photos from the night, posted by the people in them), and it carries the one thing a bar owner will worry about — moderation. A bullet cannot carry the reassurance that hiding is instant, undoable and free on every plan. Put it between the checklist and the Ease/Confidence/Pull cards.

3. **Venue pricing has to exist somewhere.** The pricing section (about.html:586-700) is three artist plans and nothing else, while the venue block ends on "Claim your venue — free" with no hint that $20/month exists. Either add a small two-line Free/Pro block inside the venue section, or give the venues a fourth card in the pricing grid. The former is better: it keeps the venue argument in one place and keeps the artist pricing grid at three columns.

Two things to fix in the app before the page can carry the new copy, both internal contradictions rather than landing-page problems:

- **Venue Pro says two different things.** venueadmin.mjs:414-419 opens a real Stripe Checkout and public/venue-studio.html:816-833 offers the button, but the verification checklist at public/venue-studio.html:1458 still reads "Not self-serve yet: message us and we'll switch it on for your page." Whichever is true has to be true in both places before the landing page names a route to Pro.

- **The venue public page tells artists the wrong thing about vouching.** public/venue.html:487 renders "${need} artists who play here does it — **no website needed**", and falls back to `need=10` when the payload is missing (public/venue.html:485). The real rule is three artists (_verify.mjs:30) *and* a website that passes two checks *and* a paid plan — all five, ANDed at _verify.mjs:204-206. So an artist is currently told they can hand a bar its green tick on their own, and they can't.

One thing the section gets right and should keep untouched: "Free. Your page works whether you verify it or not." Everything proposed above sits around that sentence rather than replacing it — it is the line that makes the five-step tick safe to describe.

| Priority | Feature | State | Where it belongs |
|---|---|---|---|
| must-add | Venue Pro exists — $20/month — and it is what the green tick costs | Built, and the checkout is wired — BUT the app contradicts itself: the verification checklist's step 1 still tells venues "Not sel | For venues — a short plan line immediately after the six benefit rows, before the "Ease / Confidence / Pull" cards. Or a fourth co |
| must-add | What the green tick actually takes — five things, and all five are needed | Built and enforced. Note the honest limit the Studio already states: a name that exists only inside an image or is drawn by JavaSc | For venues — a short block under the CTA, replacing or extending the one-line "Free. Your page works whether you verify it or not. |
| must-add | The page you fill in — photos, hours, contact, what you've got, menu and offers | All built and free except the extra nine photo slots (Pro, shown greyed with the cap enforced at venueadmin.mjs:344-346). | For venues — a new row in the existing six-row checklist, or better, a second short list headed "and the bits you fill in" so the  |
| must-add | Your community page — fans rate the night, post photos and a 30-second clip, and you moderate it | Built and free on every plan — reading, replying, pinning and hiding. Permanently deleting a post is Pro for venues (venueadmin.mj | For venues — its own row in the checklist, or a short beat of its own between the checklist and the three cards. |
| must-add | The what's-on feed row goes to the ACT, not to your page — and there is no public list of venues | Built as described — this is a factual overclaim in the current copy, not a missing feature. The venue's name, address and a worki | For venues — replace the third checklist row, "People searching 'what's on tonight' find you". |
| should-add | Your numbers only cover acts who ran the night through MySet — and any act can switch their figures off | Built. The Studio is honest about it in two places; the landing page is silent. | For venues — a trailing sentence on the existing "You learn who fills the room" row. |
| should-add | Nothing tells a venue an artist has asked to play | Built as a pull, not a push. Deliberate on the privacy side — neither party gets the other's email (_pitch.mjs:12-15) — but there  | For venues — a trailing clause on the existing "Acts come to you, with receipts" row. |
| should-add | Who can sign in, and how the account works — five addresses, a six-digit code, no password | Partial, and this is the honesty constraint. The Settings field says "Add a manager or barman" (public/venue-studio.html:1337) but | For venues — a new short row in the checklist, or a line in the FAQ. |
| should-add | Merch and getting paid — a shop on your community page, orders, and a statement for the bookkeeper | Built and Pro-only for venues. Careful with the fee: the free row carries a 10% cut but a free venue cannot sell anything through  | For venues — inside the new plan block, as the Pro detail. |
| should-add | If your page comes up empty, it is the name — and the Studio shows you the spelling each act used | Built. The Studio handles the failure well; the landing page presents only the success case. | For venues — appended to the existing "And it fills in from day one" block, where the mechanism is already explained. |
| optional | Take your data, or leave — export as one file, delete with thirty days to change your mind | Built. Owner-only for the delete; export is available to managers too. | For venues — a line under the CTA, beside "Free. Your page works whether you verify it or not." |
| optional | Two codes to print, not one | Built and free. | For venues — the existing "One code on the tables" row. |

### Venue Pro exists — $20/month — and it is what the green tick costs

*Built, and the checkout is wired — BUT the app contradicts itself: the verification checklist's step 1 still tells venues "Not self-serve yet: message us and we'll switch it on for your page" (public/venue-studio.html:1458), while the plans sheet offers a working Stripe Checkout button. Resolve that inside the app before the landing page names a way to buy it. Two Pro lines are designed and NOT built — tips for your staff, and votes for what plays between the sets (netlify/functions/_venues.mjs:140 VENUE_NOT_BUILT); they are greyed "Coming soon" even for a paying venue.*

**Why it matters.** The section's only price signal is "Claim your venue — free" and "Free. Your page works whether you verify it or not." A bar reads that as: this is a free listing, forever, end of story. It then discovers in the Studio that the green tick, the shop, twelve photos and permanent post deletion all sit behind $20 a month. Finding a paywall you were not told about is the thing that makes a small business distrust a tool — and it is entirely avoidable, because $20 for a bar is nothing and the free tier is genuinely generous.

**Where.** For venues — a short plan line immediately after the six benefit rows, before the "Ease / Confidence / Pull" cards. Or a fourth column in the existing pricing section, which is currently artist-only.

**Draft copy.** **Free is the page. Pro is $20 a month.**

Free gets you all of the above: the page, the listings, the community page, your numbers, three photos, and acts pitching to play. Pro adds twelve photos, a shop on your community page, deleting a fan's post for good, and the green tick.

Drop back to Free and nothing is deleted — the extra photos and the shop just stop showing until you come back.

### What the green tick actually takes — five things, and all five are needed

*Built and enforced. Note the honest limit the Studio already states: a name that exists only inside an image or is drawn by JavaScript will not be found (public/venue-studio.html:1477-1479). The by-hand route for a venue with no website is real (admin.mjs:363-375) but is a message to Perry, not a button.*

**Why it matters.** "Your page works whether you verify it or not" makes the tick sound like paperwork you'll get round to. It isn't. A bar whose only web presence is a Facebook page cannot pass three of the five checks — no website, no email on that domain, no site text naming it — no matter how long it waits. That bar should know before it claims the page that its route to a tick is three artists plus a conversation, not a form.

**Where.** For venues — a short block under the CTA, replacing or extending the one-line "Free. Your page works whether you verify it or not."

**Draft copy.** **The green tick takes five things, and it needs all five.**

MySet Pro. Your website on your page. The address that claimed the page on that website's own domain. Your venue's name in the words on your website — not just in the logo. And three artists who have a gig at your place confirming it from your page.

Any one on its own is just a claim. Together they mean somebody who controls the domain also runs the place, and the acts who play there know it.

No website at all? Get three acts to confirm you and message us — we check those by hand.

Everything else on your page works exactly the same either way. The tick only turns a grey chip green.

### The page you fill in — photos, hours, contact, what you've got, menu and offers

*All built and free except the extra nine photo slots (Pro, shown greyed with the cap enforced at venueadmin.mjs:344-346).*

**Why it matters.** The section describes a listing that writes itself, and mentions "your menu and your offers" twice as if they arrive by magic. A bar reads it as a calendar widget and doesn't understand it is being offered a real page — with hours, directions, a call button and a menu — that can replace the half-finished website it keeps meaning to fix. And 'House PA / backline' is the single line an act scans a venue page for; a bar that ticks it gets pitched more.

**Where.** For venues — a new row in the existing six-row checklist, or better, a second short list headed "and the bits you fill in" so the section separates what fills itself from what you write once.

**Draft copy.** **And the parts you write once**

A cover photo and three more (twelve on Pro). Your hours, including the nights that end after midnight. Address, phone, WhatsApp, your website and your socials, and a Directions button that opens in whichever map app the person is holding.

Tick what you've got, from a dance floor to step-free access — *House PA / backline* is the first thing an act looks for. Link your full menu and add a few things worth ordering. Up to six offers: happy hour, two-for-one, a free shot for anyone who votes.

### Your community page — fans rate the night, post photos and a 30-second clip, and you moderate it

*Built and free on every plan — reading, replying, pinning and hiding. Permanently deleting a post is Pro for venues (venueadmin.mjs:545-549). Hiding is instant and undoable for the words, but the photos and the clip do not come back.*

**Why it matters.** This is the only place fans touch a venue directly, it is the section's best answer to "one less weekly job" — photos from the night, posted by the people in them — and the landing page does not mention it exists. It is also the thing a bar owner will be most nervous about, and the reassurance is strong and true: you can take anything down instantly, free, on any plan.

**Where.** For venues — its own row in the checklist, or a short beat of its own between the checklist and the three cards.

**Draft copy.** **Your regulars post the night for you**

Every venue gets myset.vip/v/yourbar/community. People rate the night out of five, say something, add photos and a thirty-second clip from where they were standing.

You reply once per post and pin the one you'd want a stranger to read first.

Nothing is checked before it goes up — so anything you don't want there, you hide in one tap, on any plan, and put back just as easily. Hiding takes the photos down with it. Deleting a post for good comes with Pro.

### The what's-on feed row goes to the ACT, not to your page — and there is no public list of venues

*Built as described — this is a factual overclaim in the current copy, not a missing feature. The venue's name, address and a working Directions button ARE on every row (public/index.html:471-474); only the tap goes elsewhere.*

**Why it matters.** The current line — "Your bar is in it, with directions, your menu and your offers one tap away" — is the section's discovery promise, and for artist-listed gigs it is not true. A bar that claims a page expecting new customers to land on its menu will find its traffic went to the band. The honest version is still a good pitch, and it gives the bar a reason to add its own events: those are the rows that actually open its page.

**Where.** For venues — replace the third checklist row, "People searching 'what's on tonight' find you".

**Draft copy.** **People searching "what's on tonight" see your name**

Pick a country and a city and MySet shows the week. Every gig at your place is on that list with your name, your address and a Directions button.

Tap a band's line and it opens the band. Tap one of your own nights — the quiz, the DJ, the football — and it opens *your* page, where the menu and the offers are. Which is a decent reason to put them in.

## Sceptical finance-minded reader — every money statement on public/about.html checked against _plan.mjs, _billing.mjs, _connect.mjs, _pay.mjs, _feesplit.mjs and _venues.mjs. The headline: the page's two biggest money disclaimers are both now false. Billing shipped (real Stripe Checkout subscriptions) and Connect shipped (real Express payout accounts, direct charges, application fees). The page is telling every visitor that the paid product cannot be bought and that no artist can take money — while the Studio has working buttons for both. Everything else below is downstream of that.

**Structural verdict.** The page's shape has drifted out from under it in one specific place, and is missing a section in another.

1 · The honest-notes block is now the weakest part of the page, not the strongest. It was written when nothing could be bought and nobody could be paid, and it is doing the opposite of its job — two of its three notes are advertising limitations that no longer exist (_billing.mjs, _connect.mjs). Do not just soften them: notes 2 and 3 need replacing with what is actually true, and the block should keep three notes so it still reads as candour rather than as a retreat. Suggested new set: (1) MySet is early, one real gig — unchanged and still the right thing to lead with; (2) getting paid takes one setup step, and here is the irreversible bit; (3) you can buy Plus and Pro today, and the four Pro extras marked Soon are still Soon.

2 · Beat 4 needs to split. "Money happens without you asking" is currently doing two jobs — the fan-facing magic (tip button, buy votes) and an apology for payments not working. With the apology gone there is room for the half the page has never had: how the money gets to you. Same beat, two paragraphs: what the room sees, then what you set up once and what lands in your bank. That is where daily payouts, "the money is yours not ours", and the permanent country choice go.

3 · The fee facts do not fit in checkmark bullets and should stop trying to. Three separate things are true — MySet's cut (10/2/0), Stripe's own fee on the artist's side, and what the cut covers (tips included) — and a bullet that says "2% cut instead of 10% — stays yours" cannot carry any of them honestly. Add one small block under the plan grid, before the honest notes, headed something like "About the fee". It replaces one misleading bullet with three true sentences and it is the single highest-value structural change on the page.

4 · The venues section has no money in it at all, which is a whole missing half rather than a missing line. It currently reads as a free product with no ceiling, when in fact the green tick — the thing venues care about most — is $20 a month, and there is a cut on anything a venue sells. It does not need a fourth plan card (that would unbalance the section and bury the free-first pitch); it needs one short paragraph at the end, after "Claim your venue — free".

5 · One thing to leave alone: the Pro card's four "Soon" bullets are correctly marked, correctly disclosed in the markup rather than in CSS content, and still accurate against NOT_BUILT (_plan.mjs:130). Resist adding the built-but-flag-gated featured spots into that list — a $10 one-off purchase and an unbuilt Pro feature must not look like the same thing.

6 · A drift risk worth naming to Perry rather than fixing in copy: every number on this page — 4 shows, 200/1000/2000, 2000 songs, 50 live, 10/2/0% — is typed by hand here, and typed by hand again in studio.html's TIER_COPY (3509-3552), and defined for real in _plan.mjs:17-111. Three copies, one source of truth. The page is already showing what happens when one of them stops being updated.

| Priority | Feature | State | Where it belongs |
|---|---|---|---|
| must-add | Plus and Pro can actually be bought — Stripe Checkout subscriptions are live | built. Owner-role only within an account (admin.mjs:1578). Needs STRIPE_SECRET_KEY, which production has. | The honest-notes block — rewrite note 3 outright. The plan cards themselves need no change; they already describe what is sold. |
| must-add | Any artist can take card money now — Stripe Connect Express payout accounts are built | built. Owner-role only (admin.mjs:1578). Not live for an individual artist until they finish Stripe's own checks — until then thei | Beat 4 ("Money happens without you asking") — replace the caveat paragraph with a real how-you-get-paid paragraph. And rewrite hon |
| must-add | Stripe's own card fee, about 2.9% + 30¢, comes out of the artist's side — on top of MySet's cut | built. Applies to every artist on a direct charge, on every plan including Pro. | Pricing section, as a short line under the three plan cards (not inside a checkmark bullet — it is a different kind of fact from a |
| must-add | MySet's cut is taken on tips, not just on vote sales and merch | built. 10% free / 2% Plus / 0% Pro, taken as an application fee on the tip itself. | Same fee line under the plan cards — name what the cut covers. Also worth telling Perry that the FAN-side sheet at vote.html:934 s |
| must-add | The green verified tick needs a paid plan, working card payments and a photo ID — and it disappears the day a plan lapse | built. Paid plans only. Either granted automatically from Stripe's identity check, or by hand from the founder's review queue. | A bullet in the Plus card (Pro inherits it via "Everything in Plus"), with the lapse fact in the same bullet rather than hidden. |
| must-add | What a venue pays — Pro is $20 a month, and MySet takes 10% (or 2% on Pro) of what a venue sells through the app | built. Venue Pro is bought through the same Stripe Checkout (venueadmin.mjs:406-426). Two venue Pro features — staff tips and vote | End of the venues section, as a short paragraph under "Claim your venue — free" — not a fourth plan card. The page's shape should  |
| should-add | A real earnings statement, free on every plan — twelve months from Stripe's own numbers, with a CSV for the bookkeeper | built, on every plan including Free. Owner-role only within an account (admin.mjs:1585), and it returns nothing until the artist h | A bullet in the Free plan card, beside "Show history and your real numbers". |
| should-add | Featured shows — $10 puts one gig at the top of a city's night | flag-gated on `featuredShows`, which defaults TRUE and is read globally (_flags.mjs:38-49). No plan gate at all — a Free artist ca | A short paragraph after the plan cards, or a line in the proof section next to the city feed. Keep it clearly separate from the Pr |
| should-add | How and when the money reaches you — daily payouts, your own account, and a country you can never change | built. 22 countries today; the list is widened by hand when somebody needs one. | Beat 4, immediately after the new how-you-get-paid paragraph. Also a FAQ entry. |
| should-add | A failed card doesn't cliff-edge you, and leaving a paid plan never costs you the month you've paid for | built. | Pricing section, in the same small print as the fee explainer. |
| should-add | There is no refund button inside MySet — a fan refund is done in the artist's own Stripe dashboard | built as described — i.e. deliberately absent, with a working link into Stripe. | FAQ. |
| should-add | Votes a fan paid for are never lost — they carry to your next show, or the fan can hand them to you as a tip | built. The pack prices are the defaults; changing them is a Plus feature (admin.mjs:1699-1709). | Beat 4, one sentence added to the first paragraph. |
| optional | Invite another musician and you get a free month when they go paid | built. Triggers when the person you referred goes paid or is fully comped. | Pricing section, at the very bottom, after the fee explainer. |
| optional | MySet's cut on a venue's sale is reduced by half of Stripe's card fee — but an artist's is not | built for venues only. In practice it means a free venue's effective cut is well below 10% on anything under about $29 — often zer | Nowhere on the page as its own item. It belongs inside the venue price paragraph as the half-sentence already drafted above, and o |
| optional | Free shows are counted per UTC calendar month, and the room size is fixed at the moment you start the show | built. | FAQ, or the small print under the plan cards. Do not spend a bullet on it. |

### Plus and Pro can actually be bought — Stripe Checkout subscriptions are live

*built. Owner-role only within an account (admin.mjs:1578). Needs STRIPE_SECRET_KEY, which production has.*

**Why it matters.** Honest note 3 says "Plus and Pro can't be bought yet. There's no checkout, so nobody is being charged for anything." That is now flatly untrue. A musician who wants unlimited shows, a 1,000-person room or a 2% cut reads that line and closes the tab, because the page tells them the thing they want is unavailable. It is the single most expensive sentence on the page.

**Where.** The honest-notes block — rewrite note 3 outright. The plan cards themselves need no change; they already describe what is sold.

**Draft copy.** 3 · You can buy Plus and Pro today. Stripe handles the card. Change plan or leave any time — a month you have paid for always runs to the end of that month, and there is never a refund to chase because nothing is cut off early. The four Pro extras marked Soon are on the way, not shipped; everything else listed above is built and running today.

### Any artist can take card money now — Stripe Connect Express payout accounts are built

*built. Owner-role only (admin.mjs:1578). Not live for an individual artist until they finish Stripe's own checks — until then their room shows no money buttons at all (_pay.mjs:52-54).*

**Why it matters.** Beat 4's caveat paragraph and honest note 2 both say card payments run only on the founder's own gigs and that no other artist can take money. That is the difference between "a nice toy" and "a thing that pays me", and it is the reason a working musician either signs up tonight or doesn't. The page is talking anyone who cares about income out of the product.

**Where.** Beat 4 ("Money happens without you asking") — replace the caveat paragraph with a real how-you-get-paid paragraph. And rewrite honest note 2.

**Draft copy.** Beat 4, replacing the caveat: "Before any of that shows up in your room you set up getting paid, once. You pick the country your bank account is in, Stripe asks you its own questions, and the money lands in your own account — daily, not whenever we get round to it. MySet never sees your bank details. Until it's finished, the tip and buy-votes buttons simply aren't there, so nothing can land in the wrong place."  Honest note 2: "2 · Getting paid takes one setup step. Your fans pay you, not us — the charge is on your own Stripe account, so before your room shows a tip button you go through Stripe's checks once. It takes a few minutes and one of the questions (which country your bank is in) can never be changed afterwards, so do it sitting down."

### Stripe's own card fee, about 2.9% + 30¢, comes out of the artist's side — on top of MySet's cut

*built. Applies to every artist on a direct charge, on every plan including Pro.*

**Why it matters.** The page's Plus bullet says "2% cut instead of 10% — tips, vote sales and merch stay yours" and Pro says "No cut at all — 0% on everything". A Pro artist reads that as "I keep 100%". Then a $5 vote pack lands as about $4.55 and they think they were lied to. The Studio is already honest about this at the moment of onboarding; the page that got them there is not. This is the classic first-payout betrayal, and it is entirely avoidable.

**Where.** Pricing section, as a short line under the three plan cards (not inside a checkmark bullet — it is a different kind of fact from a feature).

**Draft copy.** Under the plan grid: "About the fee. Your fans pay you directly, which is why the money is legally yours and not ours to hold. It also means Stripe's own card fee — roughly 2.9% plus 30¢ a payment — comes off your side, the same as it would anywhere else you took a card. MySet's cut is on top of that: 10% on Free, 2% on Plus, nothing on Pro. On a $5 vote pack that's about 45¢ to Stripe, and 50¢, 10¢ or nothing to us."

### MySet's cut is taken on tips, not just on vote sales and merch

*built. 10% free / 2% Plus / 0% Pro, taken as an application fee on the tip itself.*

**Why it matters.** A tip feels different from a transaction, and every artist assumes a tip is untouched — the page's beat 4 ("a tip button with your name on it") and the Plus bullet ("tips… stay yours") both encourage that. On Free a $10 tip is about $8.41 by the time it lands. Saying it up front costs one sentence; discovering it from a payout costs the account.

**Where.** Same fee line under the plan cards — name what the cut covers. Also worth telling Perry that the FAN-side sheet at vote.html:934 says "100% goes to" and needs a separate fix in the app; the landing page must not repeat that claim.

**Draft copy.** Appended to the fee line: "The cut covers everything the room pays through the app — tips included, not just vote packs and merch. On Pro there is no cut on any of it."

### The green verified tick needs a paid plan, working card payments and a photo ID — and it disappears the day a plan lapses

*built. Paid plans only. Either granted automatically from Stripe's identity check, or by hand from the founder's review queue.*

**Why it matters.** The tick is on your public page, next to your name, where a venue booker sees it. It is one of the clearest reasons to pay $10 instead of nothing — and the page's plan cards do not mention it once, while the Studio sells it on both paid tiers. A musician choosing between Free and Plus is missing a real input to that decision. The lapse behaviour matters too: it is not a badge you keep.

**Where.** A bullet in the Plus card (Pro inherits it via "Everything in Plus"), with the lapse fact in the same bullet rather than hidden.

**Draft copy.** Plus card bullet: "The verified tick — a green ✓ beside your name on your public page, once we've checked it's really you. It needs a paid plan and card payments switched on, and it comes off again if the plan stops."

### What a venue pays — Pro is $20 a month, and MySet takes 10% (or 2% on Pro) of what a venue sells through the app

*built. Venue Pro is bought through the same Stripe Checkout (venueadmin.mjs:406-426). Two venue Pro features — staff tips and votes for what plays between sets — are designed and NOT built (_venues.mjs:140 VENUE_NOT_BUILT) and are shown as "Coming soon" even to a paying venue.*

**Why it matters.** The venue section of the page says "Claim your venue — free" and "Free. Your page works whether you verify it or not" and stops there. There is no price anywhere for a venue. A venue owner who signs up on that basis and then finds the green tick, the extra photos and the shop are $20 a month has been surprised by a bill they were never shown. It also undersells: some venues would pay $20 for the tick without blinking, and nothing on this page invites them to.

**Where.** End of the venues section, as a short paragraph under "Claim your venue — free" — not a fourth plan card. The page's shape should keep the venue pitch free-first.

**Draft copy.** "Free is a real page: your what's-on, your menu, your offers, your hours, three photos, the community page, the enquiries from acts. Pro is $20 a month and adds the green verified tick, twelve photos, a small shop on your community page, and taking a post down for good rather than just hiding it. If you sell anything through the app, MySet takes 10% of it, or 2% on Pro — and on a venue sale we halve Stripe's own card fee with you."

## Information architecture — does the PAGE'S SHAPE still fit the product

**Structural verdict.** THE SHAPE NO LONGER FITS, IN ONE SENTENCE: the page tells a one-act story ("the room votes") and MySet is now a three-act product — the room votes, the night runs itself, and the money is legally yours and lands in your own bank. Act one is told beautifully. Act two is completely absent. Act three is on the page as an apology for something that already shipped.

1) THE PROMISE IS MADE AND NEVER PAID. Section 4 is headed "Five things happen. None of them need you." That is precisely the promise of `_auto.mjs` — a gig on your calendar starts its own show and ends it three hours after the scheduled finish, never mid-song, never overruling you. That machinery is nowhere in the five beats. The page's own headline is describing a feature it does not mention. This is the single biggest structural hole: a NEW beat is needed, and it should be beat 2 (before "You stop guessing"), because it is the thing that happens before you even pick up the guitar.

2) BEAT 4 IS UPSIDE DOWN. "Money happens without you asking" is written as a promise with a caveat stapled to the end ("card payments are the part still being built"). In the code, payouts are the most finished thing in the app: Stripe Connect Express onboarding is live for any artist (`netlify/functions/_connect.mjs:131-180`, `admin.mjs:1105-1123`), charges are DIRECT so the artist is the merchant of record and the money lands in their own balance on daily payouts (`_connect.mjs:12-40`, `:151`), MySet's share is an explicit application fee, and there is a twelve-month earnings statement with a CSV (`_ledger.mjs:186-236`, `:418-438`). A caveat has to become a section — and it has to carry the one fact the page has never said, which is that Stripe's own ~2.9% + 30c comes off the ARTIST's side, so "2% cut" is not "you keep 98%" (`_connect.mjs:30-35`, `:314-319`). Concealing that until a musician's first payout is the exact thing this page's voice exists to avoid.

3) THE PRICING SECTION'S CLOSING BLOCK IS TWO-THIRDS OBSOLETE, AND ITS OBSOLESCENCE IS LOAD-BEARING. Honest note 2 ("Card payments aren't on yet") and note 3 ("Plus and Pro can't be bought yet") are both false now — `_billing.mjs:120-161` is a working Stripe Checkout in subscription mode for artists AND venues, with proration on upgrade, cancel-at-period-end on downgrade, the Customer Portal, invoices, and three days of grace on a failed card. Structurally this is not a copy edit: three notes shrink to ONE (note 1, "MySet is early — one real gig", which stays and stays first), and the space they vacate is where a short "how paying works" line belongs. Right now the page's most credible-sounding block is the block most likely to be caught out.

4) THE VENUE BLOCK IS IN THE WRONG PLACE AND MISSING ITS ONE DECIDING FACT. Section 7 runs ~80 lines and sits BETWEEN the artist's proof section and the artist's pricing — so an artist reader is handed to a different audience and handed back, with the pricing they came for pushed most of a screen further down. And the block never says what a venue pays. Venues now have a real two-tier ladder with self-serve checkout (`_venues.mjs:130-133`, `venueadmin.mjs:414-425`): Free, and Pro at $20/month for the green tick, twelve photos, merch and a 2% fee instead of 10%. A venue can read the whole section and not learn there is a paid tier. Two fixes, in order of preference: (a) move the venue block AFTER artist pricing and add a two-line price row inside it; or (b) cut it to a four-line teaser plus a link and give venues their own page. Either way it stops interrupting the artist's decision.

5) POST-GIG HAS NO REPRESENTATION AT ALL. The community page (`/:slug/community`) takes star ratings, up to three photos and a 30-second video clip with its sound (`_video.mjs:73`, `clipup.mjs`), the artist replies once, pins, and hides anything instantly and free. It appears on this page exactly once — as a bullet inside the Free plan card. It is the only part of the product with a public URL that the marketing page never shows. Its natural home is beat 5, which is already titled "And afterwards, they can find you" and currently talks only about links and gigs.

6) THE FAQ IS ANSWERING 2026-08's OBJECTIONS. Four of the seven still earn their place. The three highest-friction questions a working musician now asks are missing: "do I have to type my whole setlist in?" (import from CSV, a paste, or a Spotify playlist — `admin.mjs:1888-1913`, `:1606-1632`), "how do I actually get paid?" (Connect), and "what happens if I lose my phone at 1am?" (passkey, eight recovery codes, a device list you can sign out one at a time — `_passkey.mjs`, `_session.mjs:190-234`). "I play originals" is the weakest of the seven and is the one to drop if length is a problem.

7) ONE ROW OF THE PRICING TABLE READS AS A TURNSTILE AND ISN'T ONE. The Plus card carefully explains that going over 1,000 doesn't break the night. The Free card says "up to 200 people in the room at each" with no such note — so the plan most people will read is the one that looks like it locks the door at 200. It doesn't: `vote.mjs:81-92` is an explicit, commented NON-check. The reassurance is on the wrong card.

WHAT TO CUT TO PAY FOR THIS. The page is long and I am proposing additions. Three places to take the length back: the venue block (points 4), two of the three honest notes (point 3), and the "I play originals" FAQ (point 6). Net, the page should get slightly shorter and gain a whole act.

| Priority | Feature | State | Where it belongs |
|---|---|---|---|
| must-add | Shows that start and end themselves from your gig calendar | built, free on every plan (the Studio's plan cards list it under Plus/Pro, but there is no plan gate in the code — the gig cap is  | A new beat 2 in section 4, before "You stop guessing" — and the existing headline "Five things happen. None of them need you" beco |
| must-add | Stripe Connect — you take card payments into your own account, and the money is legally yours | built and reachable for any artist on any plan, owner role only, needs STRIPE_SECRET_KEY on the server | Beat 4 in section 4 — replacing the "one caveat, up front" paragraph rather than sitting beside it |
| must-add | Stripe's own card fee comes off the artist's side, so "2% cut" is not "you keep 98%" | built — it is a consequence of direct charges, and the Studio already says it out loud in the Get-paid card | The pricing section — one line under the plan cards, above the honest note |
| must-add | Plus and Pro can be bought — and cancelled — from the Studio | built and live, owner role only; needs STRIPE_SECRET_KEY. Same machinery for venue Pro | The pricing section — replacing honest notes 2 and 3 entirely |
| must-add | Import your setlist — a CSV, a pasted list, or a Spotify playlist | built. The Spotify half is env-gated — without SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET on the server it answers "Spotify import  | The "How long does setting up actually take?" FAQ answer — as a second sentence, not a new section |
| must-add | Going over your room size never locks anybody out | built. Note: the code comment says "the artist is told afterwards" and that telling is NOT implemented anywhere — so the copy must | The Free plan card, on the same line as the 200 — a phrase, not a paragraph |
| must-add | What a venue actually pays — Free, and Pro at $20 a month | built, self-serve. The tick additionally needs a real verification pass (_verify.mjs:280-303) | Inside the venue section, immediately under the six-tick list — two lines, not a plan table |
| should-add | The community page — fans rate the night, post photos, and post a 30-second clip with the sound | built, free on every plan. Hiding a post is free and undoable; permanently deleting one is Plus for artists (_plan.mjs:69-72) | Beat 5, which is already called "And afterwards, they can find you" and currently only talks about links and gigs |
| should-add | There is no password — a code, a passkey, recovery codes, and a list of every device you're signed in on | built. Passkeys and recovery codes are owner-only (auth.mjs:211). Venues have sessions and sign-out but NOT passkeys or recovery c | A new FAQ item, placed after "How long does setting up actually take?" |
| should-add | Your earnings — twelve months, and a CSV for whoever does your tax | built, owner role only, returns enabled:false until the artist has a Stripe account | The Freedom card in section 5, as one added sentence — or beat 4 alongside the payouts copy |
| should-add | The green verified tick | built, and requires a PAID plan — the tick is AND-ed with the plan on every public read, so it disappears if a plan lapses | The Plus plan card, as a bullet; the mechanics belong in an FAQ if anywhere |
| should-add | Refunds are done in your own Stripe dashboard, not in MySet | built (as an absence — there is deliberately no in-app refund button for fan payments) | Beat 4, as the last line — or an FAQ if beat 4 gets long |
| should-add | Your own chord chart, per song, private, readable mid-song | built, free on every plan | Beat 2 ("You stop guessing"), which already describes the live screen the artist is looking at |
| optional | Your phone buzzes when somebody asks for something | built, but env-gated — without VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY on the server the panel says "Not switched on yet" and no butt | Beat 3, one sentence — only if the VAPID keys are confirmed set in production |
| optional | $10 to put a gig at the top of your city's listing for a night | flag-gated — `featuredShows`, default ON (_flags.mjs:38-49), but it is an experiment with a stated removal plan ("if nobody buys,  | Beat 5, in the sentence about the city what's-on feed — or held back entirely until the flag decision is made |
| optional | The country your money goes to is set once and can never be changed | built | An FAQ answer about getting paid, if one is added; otherwise leave it in the Studio where it already is |
| optional | Leave and take everything with you — thirty days to change your mind, and your page address is held | built, owner only | The close section, under the three steps — or the pricing honest note |

### Shows that start and end themselves from your gig calendar

*built, free on every plan (the Studio's plan cards list it under Plus/Pro, but there is no plan gate in the code — the gig cap is the only thing that can refuse a start)*

**Why it matters.** It is the answer to the quiet worry every gigging musician has about a tool like this: one more thing to remember while loading in, and one more thing to forget while packing down. A forgotten End is what makes a night's history and money wrong. The scheduler removes both, never starts a show twice, never ends one mid-song, and never overrules a night you started or ended by hand.

**Where.** A new beat 2 in section 4, before "You stop guessing" — and the existing headline "Five things happen. None of them need you" becomes true for the first time

**Draft copy.** <h3>The night starts without you</h3>
<p class="body">Put the gig in your calendar once. At the start time the show goes live on its own, with the right setlist already loaded — you don't have to find your phone between loading in and the first song.</p>
<p class="body">And it ends itself three hours after the time you said you'd finish. It won't cut you off mid-song, and if you'd rather do it all by hand there's a switch for that in Settings.</p>

### Stripe Connect — you take card payments into your own account, and the money is legally yours

*built and reachable for any artist on any plan, owner role only, needs STRIPE_SECRET_KEY on the server*

**Why it matters.** The page currently tells a musician that card payments run only on the founder's gigs and that nobody else can take money yet. That is now backwards, and it is the reason someone would decide MySet isn't ready for them. In the code, tips and vote packs go straight into the artist's own Stripe balance on daily payouts, MySet is not the merchant of record and does not hold the funds, and MySet never sees a bank detail.

**Where.** Beat 4 in section 4 — replacing the "one caveat, up front" paragraph rather than sitting beside it

**Draft copy.** <p class="body">The money is yours before it is anyone else's. Stripe asks you the bank questions once, and after that a tip goes into your own account, on your own daily payout — not into ours, and not into a pot we pay out later. MySet never sees your bank details, and we're not holding your money at any point.</p>

### Stripe's own card fee comes off the artist's side, so "2% cut" is not "you keep 98%"

*built — it is a consequence of direct charges, and the Studio already says it out loud in the Get-paid card*

**Why it matters.** The pricing table's biggest single number is "2% cut instead of 10%", and a musician reading it will do the arithmetic on a $5 vote pack and get the wrong answer by about 45 cents. The Studio is honest about this before onboarding; the landing page is not. Finding it out from a payout instead of from the page is exactly the kind of small betrayal that makes someone stop trusting everything else on it.

**Where.** The pricing section — one line under the plan cards, above the honest note

**Draft copy.** <p class="body" style="margin-top:18px;font-size:15px;color:var(--muted)">One number to be straight about: because the money goes into your account and not ours, Stripe's own card fee (roughly 2.9% and 30c) comes off your side, not ours. So on a $5 vote pack, Stripe takes about 45c and MySet takes 10c on Plus. Our cut is the small half.</p>

### Plus and Pro can be bought — and cancelled — from the Studio

*built and live, owner role only; needs STRIPE_SECRET_KEY. Same machinery for venue Pro*

**Why it matters.** Honest note 3 tells a reader there is no checkout and nobody is being charged. There is, and they can be. Beyond being wrong, it removes the thing that makes a price real: a musician deciding whether to trust a $10/month tool wants to know they can leave. The code's answer is a good one — leaving Free is never a refund and never a cliff, you keep the month you already paid for.

**Where.** The pricing section — replacing honest notes 2 and 3 entirely

**Draft copy.** <p style="margin-top:11px"><b>2 · How paying works.</b> Plus and Pro are a card on file, charged monthly. Leave whenever you like — you keep the month you've already paid for and then drop back to Free. Nothing gets deleted when you do; the extras just switch off. Your card, your invoices and your receipts all live in Stripe's own billing page, one tap from Settings.</p>

### Import your setlist — a CSV, a pasted list, or a Spotify playlist

*built. The Spotify half is env-gated — without SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET on the server it answers "Spotify import isn't switched on yet" (admin.mjs:1608), so it must not be drafted as a live promise*

**Why it matters.** "Two minutes to a working page" is the page's setup claim, and the FAQ's honest answer is that songs take "as long as typing them". For a covers musician with two hundred songs in a Google Sheet, that is the whole objection — and it is already solved. Nobody signs up to retype their working setlist.

**Where.** The "How long does setting up actually take?" FAQ answer — as a second sentence, not a new section

**Draft copy.** Add to the existing FAQ answer: "If your songs are already in a spreadsheet or a note on your phone, paste the whole lot in at once — it shows you what it found before it saves anything, and it skips any you've already got."

### Going over your room size never locks anybody out

*built. Note: the code comment says "the artist is told afterwards" and that telling is NOT implemented anywhere — so the copy must not promise it*

**Why it matters.** The Plus card already reassures on this. The Free card — the one nearly every reader is actually pricing — says "up to 200 people in the room at each" with nothing after it, so the number reads as a door that shuts. It isn't: nobody is refused a vote, the board just slows down and shows the top of the list. A pub musician who thinks a busy Saturday will break the app will not try it on a busy Saturday.

**Where.** The Free plan card, on the same line as the 200 — a phrase, not a paragraph

**Draft copy.** <li>4 shows a month — up to 200 people in the room at each. If more turn up nobody's turned away; the board just slows down a little.</li>

### What a venue actually pays — Free, and Pro at $20 a month

*built, self-serve. The tick additionally needs a real verification pass (_verify.mjs:280-303)*

**Why it matters.** A publican can read all eighty lines of the venue section and still not know whether this costs them anything. That is the one question they have. The section says "Claim your venue — free" and "Free. Your page works whether you verify it or not" — which is true and also silently implies there is no paid tier, so the first time a venue meets the $20 it will be a surprise rather than an offer.

**Where.** Inside the venue section, immediately under the six-tick list — two lines, not a plan table

**Draft copy.** <p class="body" style="margin-top:20px">It's free, and free is a real page — your listings, your what's-on, the community page, and acts asking you for a spot. <b>Pro is $20 a month</b> if you want the green verified tick, twelve photos instead of three, and a shop on your page. That's the whole menu.</p>
