# 2026-09-05 (later) — featured shows, comment editing, and the sound coming back

Round five of Perry's list, same day as round four. Seven things.

---

## 1. "the first month is oct 2025 — make it the month they joined"

`lastMonths(n, now, since)` now takes a floor, read from the registry's `createdAt`
in `admin.mjs` and `venueadmin.mjs`. Twelve rows of zero before somebody existed is
not a statement, it is a page that looks like a bad year — and it costs real Stripe
pages to fetch a window in which nothing can have happened. INVARIANT 0dz.

## 2. "set up an external accounting system just for me"

Built, and better than external: **it turned out to be separable after all.**

This morning the founder's earnings card refused to show anything, because Perry's
vote packs and tips were taken on the PLATFORM account (before Connect existed) and
the same Stripe balance holds every artist's subscription. That refusal was honest
but not necessary. A payment MySet sold on his behalf is a charge whose Checkout
session was tagged `kind` ∈ {votes, tip, merch} and `artist` — the test
`revenue.mjs` has always used.

`platformSplit()` in `_ledger.mjs` does one pull of platform balance transactions
with `expand: ['data.source']`, plus one pull of that window's Checkout sessions,
and buckets every transaction into **his gigs** or **the company**. Both halves are
cached in the same document (`months` and `mine`).

And from now on nothing has to join back through the sessions list at all:
`pay.mjs` puts `kind` and `artist` on `payment_intent_data.metadata`, so every
future charge labels itself. (Never `application_fee_amount: 0` though — Stripe
treats a zero fee differently from no fee, and `test/connect.mjs` pins that.)

So Perry can now say, with a number from Stripe's own balance: *this is what I
earned as a gigging musician using my own app.* INVARIANT 0ea.

## 3. "change 'see what fans see' to the artist's profile"

Done, and made honest rather than ambiguous: on the **Live** tab it still goes to
the voting screen — the thing the room is holding right now — and everywhere else
it reads **"See your page"** and goes to the public profile. One button that goes
to two different places without saying so is worse than two labelled ones.

## 4. "there is no audio when i'm watching back the one i just uploaded"

**A real bug, and an ugly one.** The re-encoder took its audio track from
`video.captureStream()` — which produces a perfectly good audio track containing
**silence**, because the element was muted so it would autoplay. The clip played,
the waveform was flat, and nothing anywhere said so.

Fixed with Web Audio: a `MediaElementAudioSourceNode` taps the audio *before* the
speakers and is connected only to the recorder's destination, so the element stays
unmuted (which is what makes the signal exist) and nobody hears their own clip
blaring out of the phone while it encodes. If a browser refuses unmuted playback the
clip is still made — silent — and the person is **told**. INVARIANT 0eb.

## 5 & 6. Editing and deleting comments

- A fan may **edit** their own post for **24 hours** and **delete** it for ever.
  Ownership is compared inside the write against the stored device id; an id in a
  request body proves nothing. The window is enforced in the write, not by the page,
  so a five-star review cannot quietly become a one-star one months later under a
  reply the artist already wrote.
- An artist may **hide** any post on **any plan** — instantly, reversibly. Deleting
  for good is now **Plus and above**, refused by the server with a sentence that
  points at hiding, and greyed (not hidden) in the Studio per Perry's locked-feature
  rule. Added to the plan cards in `studio.html` and `about.html`.

That split is deliberate: every artist must be able to take something offensive off
their page the second they see it, and hiding does that. What a paid plan buys is
erasing it. INVARIANT 0dy.

## 7. "promote a gig" — featured shows

The big one. `_featured.mjs`, behind the `featuredShows` flag (default ON).

**$10 puts one gig at the top of that city's list for that night. Three spots a
night, first come first served, orange border, own heading.**

The hard part was never the payment, it was the race:

| Wrong way | What it costs |
|---|---|
| Charge first, claim after | somebody pays $10 for a spot that filled while Stripe was thinking, and MySet owes a refund it must remember to make |
| Claim first, never expire | anyone fills a city's night for free by opening checkout three times and walking away |

So: a **twenty-minute hold**, taken inside a compare-and-set, keyed by an id MySet
mints and carries **through Stripe's metadata and back**. Abandoning checkout costs
nothing and frees the spot by itself; nobody is ever charged for a spot they did not
get. A payment that lands after its hold died is honoured when there is room and
**refunded automatically** when there is not — once, keyed by the session id.

Three mistakes caught before shipping, all by reading the code again rather than by a
user:

1. The first version claimed under our id, then **released and re-claimed** under
   Stripe's session id — a window, however short, in which the spot somebody was
   about to pay for was free for anyone else. Carrying our own id through removes
   the window entirely.
2. "One spot per artist per night" blocked on **any** row, including the artist's
   own abandoned hold — so somebody who backed out of checkout was told they
   "already had a spot" they had not bought, for twenty minutes, with no way to
   retry. An unpaid hold is now replaced by its owner's next attempt; a paid one
   blocks.
3. **The worst one.** The garbage collector runs inside the same write, and it was
   given the *calling artist's local date*. A city table is shared — so an artist in
   Bangkok claiming a spot could have deleted a London artist's **paid** row for a
   night London had not reached yet. The delete floor is now two days behind UTC,
   which is past everywhere on earth. A local date is fine for deciding what to
   show and never for deciding what to remove.

Elsewhere: the city feed moves featured gigs out of the ordinary list (never both),
skips one whose gig has since been cancelled, and draws the heading only when there
is something in it — never an empty slot. `deleteArtist` gives the spots back.
INVARIANT 0dx.

---

## The adversarial review, and the eleven bugs it found

Featured shows takes money, so it got a 5-lens multi-agent review — concurrency,
authorisation, accounting, browser code, and invariant compliance — with every
finding then attacked by three skeptics told to default to "refuted". Twenty-six findings were raised and six survived all three skeptics; several more
were fixed on the way through. Every one is closed. The ones that mattered:

| | What it would have done |
|---|---|
| **A rival could stand in a paid spot** | The city feed matched a featured row on `eventId` alone. Event ids are chosen by the CLIENT and every gig's id is public in that very feed — so any artist in the city could put a gig with a rival's event id on their calendar and be drawn in the spot the rival paid $10 for. Now matched on the owner as well, and the internal owner id is stripped before the payload goes out. |
| **One artist could buy all three spots** | Replacing an artist's own unpaid hold (so backing out of checkout doesn't lock them out) meant three tabs a minute apart, then paying all three. The claim path cannot catch it — at any instant only one hold exists — so the check is where the money lands: the second and third are refused and refunded. |
| **A real payment refunded on a night nobody bought** | "Full" counted *holds*, not paid rows. Three people with checkout tabs open turned a genuine payment into a refund. Worse: the payer's own replaced hold made the night look full to their own payment. |
| **Refunded AND granted** | The Studio's return trip and the webhook both settle. If one refunded while the other granted, MySet paid the money back and gave the spot away. A refund now leaves a tombstone the other path refuses to grant against — and a tombstone never counts as one of the three. |
| **A failed refund vanished into a log line** | Money taken, no spot, refund itself failed, and nothing anywhere recorded it. It is now written into the artist's own Featured list as an owed refund, visible to them and findable by Perry. |
| **The flag disagreed with itself** | The selling side read a per-artist override; the city feed read the global. An artist with a personal override could be sold a spot no city would ever draw. Both read the global now — this flag is global by nature. |
| **A closed month could be cached wrong for ever** | A month with more than 1,200 balance transactions was truncated by paging and the partial cached as final. A truncated pull is now used but never written. |
| **Two meanings on one key** | `platformSplit` wrote MySet's company books into `ledger_<founder>` — the same key and field a CONNECTED account's statement uses. The day Perry links a Stripe account of his own, the two would have overwritten each other. The company's books now have their own document. |
| **The clip could play out loud in the bar** | If no AudioContext could be made, the element was left unmuted and the clip played through the phone's speaker during somebody else's set. Now muted when there is no graph — and the context is closed, which it never was. |
| **A hang before recording started never ended** | The stall backstop only settled the promise through `rec.onstop`, so a stall before the recorder started left the progress bar up for ever. |
| **Editing a post silently did nothing on bar wifi** | No try/catch: a dropped connection threw inside an onclick and the button did nothing at all — no toast, no clue. |
| **Deleting for good was free on the venue endpoint** | The identical action on the identical feed, one endpoint along, with no plan gate. Closed, and added to the venue plan cards. |
| **A hidden post kept serving its photos** | `/api/img` and `/api/vid` serve by URL and know nothing about a post being hidden — and checking would cost a blob read on the one path that exists to be edge-cached. So hiding left the media publicly fetchable, and the moment deleting became a paid feature that left a free artist with **no way at all** to take something offensive off their page. Hiding now deletes the bytes; the words stay and can be un-hidden; the Studio says so before the tap. |
| **A refunded payment could still be granted an hour later** | The tombstone that stops the second settle path was unpaid, so the twenty-minute hold clock swept it. The two paths can be an hour apart if somebody leaves the tab open. A tombstone now lives as long as the night. |

Plus one I found myself before the review returned, and the worst of the lot:
**the garbage collector pruned on the calling artist's local date** inside a shared
city table, so an artist in Bangkok could have deleted a London artist's PAID row
for a night London had not reached. The delete floor is now two days behind UTC.

## One more thing the review changed: the test double

The Stripe fake's `checkout.sessions.list` ignored the `created` window, so every
session was visible in every query. That is why no test could catch a lookup that
only reaches back one month — the exact shape of the refund bug above. The fake now
honours the window, which immediately failed four suites whose fixtures were dated
August 2025 and therefore outside `revenue.mjs`'s real 180-day window. Those
fixtures now carry a realistic timestamp, and the fake defaults `created` to now,
the way Stripe does.

**A test double that is more permissive than the real thing is a test that passes
for the wrong reason.**

## Tests

**28 suites, 1,456 assertions, 0 failed.** New: `test/featured.mjs` (65).
`test/clips.mjs` +17 (editing, self-delete, the plan gate), `test/books.mjs` +11
(the join-month floor, the founder split).

## Still Perry's to do

Unchanged from this morning: `charge.updated` on the Stripe webhook, stop the
double deploy and move to Netlify Pro, 2FA everywhere, and try the passkey.

---

## Same-day follow-up: the clip feature was broken, and it was my fault

Perry: *"the clip feature isn't working... the little progress bar didn't move and
after a while i got an error message."*

**The audio "fix" broke uploading.** An `AudioContext` created without a fresh tap
starts **suspended** on iOS and under Chrome's autoplay policy. Wiring a `<video>`
into a suspended context with `createMediaElementSource` takes the element's audio
away and hands it to a graph that is not running — and **the element then stops
advancing.** `play()` still resolves, `currentTime` stays at 0, the progress bar sits
at nothing, and the only sign is the stall backstop firing a minute later. And it
cannot be undone: `createMediaElementSource` may be called once per element, ever.

Three changes:

1. **The context is created, resumed and CHECKED before it goes near the video.**
   Only a context in state `running` is ever wired up. Anything else is closed and
   the element is muted — silent, but working.
2. **A three-second stall detector**, not just a total timeout. If the element is not
   advancing there is no point drawing for another minute.
3. **A retry from a fresh element with no audio**, which is the path that has always
   worked. The old element is spent, so the retry cannot reuse it. A clip always gets
   made; only the sound is ever in doubt, and the person is told when it is silent.

**The clip already posted is silent for ever.** Those bytes were recorded silent;
nothing can add sound to them afterwards. It has to be re-posted.

**Clips now say they are loading.** `preload="none"` means nothing is fetched until
somebody taps, so the first tap waits for a function to wake and read a couple of MB —
which looks exactly like a broken video. The boot splash's three bars now sit over the
clip until it can play. Two events that look like "done" are deliberately NOT wired to
hide them: `suspend` fires the instant a `preload="none"` video is touched and means
"not fetching right now" (wiring it hid the bars before a single frame of the
animation ran), and `stalled` means data has stopped arriving — exactly when somebody
most needs to see that MySet is still trying. A twenty-five second backstop steps out
of the way, because bars that never stop are worse than no bars.

**And they load faster.** 450kbps at a 400px short side instead of 600kbps at 480px —
about 1.7MB for thirty seconds instead of 2.25MB. Serving a clip also no longer asks
for a strongly-consistent read: a clip id is minted once and its bytes never change,
so there is nothing to be consistent about on the one path a person is sitting and
waiting on. The existence check inside `addPost` still asks for strong, because it
runs seconds after the upload and has to see a write that has only just landed.

INVARIANT 0eb1.
