# MySet — Invariants

Properties that must survive every change. Most were discovered by being broken.
If you are about to violate one, stop and say so rather than working around it.

## Storage (the hard-won ones)

1. **Never use Netlify Blobs `list()` for live data.** It is eventually consistent
   and has been measured lagging by *minutes*. Vote counts read via `list()` showed
   0 while the writes had already landed. All live reads use
   `getWithMetadata(key, { consistency: 'strong' })`.

2. **`list({ prefix })` returns nothing if the prefix cuts inside a nested `a/b/`
   path.** Keys that need prefix listing must be flat.

3. **Conditional writes require `@netlify/blobs` v10+.** v8 accepted
   `onlyIfMatch` and silently ignored it — writes clobbered each other and votes
   were lost. Do not downgrade.

4. **Compare-and-swap alone is not sufficient.** Even on v10, a conditional write
   can report success without sticking under concurrency. Every fan-record write
   goes through `casDoc(..., verify)` which **re-reads after writing** and retries
   if the change is not there. Removing that read-back verification reintroduces
   lost votes.

5. **Fan records are sharded across 12 documents** (`f0..f11`) so a burst of voters
   does not contend on one key. Reads merge all shards in parallel.

   > Regression test for 1–5: fire N simultaneous votes from N distinct fans and
   > assert the tally equals N exactly. Last verified: **80/80, zero loss.**

## Money

5b. **Stripe's `success_url` must point at the page that calls `/api/confirm`.**
   It is `/vote.html`. Pointing it anywhere else takes the money and grants
   nothing — that shipped once and was caught in review, not by a user.

5c. **A payment must have more than one path to delivery.** The return trip
   through `/vote.html` is not enough — on 2026-08-30 a real $3 purchase was
   charged and never granted because the buyer's browser never came back.
   Three independent paths now grant it, all funnelling through `redeemSession()`
   in `_pay.mjs` so none can drift: the return page, the Stripe **webhook**, and
   the artist's **reconcile sweep** in the Money tab. All three are replay-safe.

5d. **Only sessions this app created are MySet revenue.** Perry's Stripe account
   holds unrelated charges. `/api/revenue` filters on `metadata.kind` being
   `votes` or `tip`; without that filter his dashboard showed $133 of other
   people's business and offered to "redeem" it.

6. **Never grant anything from a client claim.** `/api/confirm` retrieves the
   Checkout Session from Stripe server-side and requires
   `payment_status === 'paid'` before granting votes or recording a tip.

7. **Each Checkout Session redeems exactly once.** A marker in `meta.paid` makes
   confirm replay-safe; a refresh must not grant twice.

8. **Never show a raw payment-gateway error to the audience.** Payment failures
   render a friendly fallback. A live room must never see "Invalid API Key".

9. **The app must work fully with payments switched off.** If `STRIPE_SECRET_KEY`
   is absent, voting still works and the paid buttons degrade gracefully.

7b. **CLAIMED IS NOT DELIVERED.** `redeemSession` claims the Stripe session before
   granting, so a double-tap and a webhook racing the return page cannot grant
   twice. For a long time the claim was the ONLY marker — so a grant that failed
   after it left the money taken, the votes ungranted, and all three recovery paths
   answering `already`. That is the 2026-08-30 failure with a different cause.

   The claim now carries `delivered:false` until the grant lands, `revenue.mjs`
   counts an undelivered marker as OUTSTANDING so the sweep retries it, and the
   grant itself is idempotent per (fan, session) via `me.gr` on the fan record —
   because without that, the retry that fixes losing votes would start minting them.
   `carryFans` preserves `gr` for the same reason. A marker with no `delivered` field
   predates this and is treated as delivered, because those really were.

7c. **A country is asked for, never guessed.** An Express account's country is
   IMMUTABLE, and Stripe assigns the PLATFORM's when none is given — so an artist on
   Koh Phangan would silently get a US account and could never be paid out.
   `payStart` refuses with 428 until it has one, validated against
   `PAYOUT_COUNTRIES`: slicing a country NAME to two letters turns Thailand into TH
   by luck and Germany into GE, which is not a country.

0bo. **A near-miss is a question, never a small yes.** The artist tick can be granted
   automatically, and it takes FIVE things: paid plan + card payments live + STRIPE's
   own identity check passed on the person + the artist's stated LEGAL name matching
   the name Stripe verified + the stated date of birth matching Stripe's to the day.
   The name match must be `exact` or `strong` (the same names, or one plus a middle
   name). `weak` — a shared surname, a shared first name — goes to a human with the
   comparison recorded. "Sam Idyll" must never be waved through as "Perry Idyll".

   **Match the LEGAL name, never the page name.** Perry's own page says Idyll and his
   passport says Murdaugh; the owner estimates half of artists will be in the same
   position. Matching the display name would have failed for most real users and
   quietly queued them all behind a human, which is exactly the outcome the automatic
   path exists to avoid. So the upload form asks for the name on the document and
   says out loud that a stage name is normal, and `_verify.mjs` reads `row.legalName`
   — never `row.name`. If you ever find code comparing the display name here, that is
   the bug.

   **The date of birth is compared and then thrown away.** It is asked for because a
   name alone is weak — two Bo Trans exist — and a birth date is a second independent
   fact Stripe has already verified. Only the boolean verdict (`dobMatch`) is stored
   on the queue row. The date itself must never be written to any document, and a
   test asserts the row's JSON does not contain it. Adding a "keep it for the audit
   trail" field turns a throwaway check into personal data we are then responsible
   for; don't.

   **Nothing reads the photo.** No text is extracted and no face is compared. The
   automatic path leans on Stripe's KYC, which is a real identity check by a
   regulated company, and the photo stays a thing a person looks at. Say this plainly
   wherever the feature is described; a badge that claims more than it checks is
   worse than no badge.

   **Name matching traps already hit, both by a test:** an apostrophe split O'Brien
   and left a stray "o" that looked like a particle, so the same person on two
   documents came out as a mismatch; and surname particles were stripped
   unconditionally, which destroyed "Di Park", "Al Green", "Van Morrison" and "Le
   Nguyen" — all real names beginning with a word that is elsewhere a particle. A
   particle is only a particle in the middle of a name.

   The automatic path is held to every rule the human one is, including that a
   decision destroys the ID photo (INVARIANT 0bk).

0bm. **Approving the tick RE-CHECKS, and a rejection can revoke it.** `idApprove`
   used to verify any artist id outright — no ID on file, no plan, no Connect — so a
   mistap approved somebody who had done none of it. It now re-runs
   `artistVerifyChecks` and refuses with the reason. `idReject` un-verifies, because
   a mistake that cannot be undone is a page wearing a tick it should not have. An
   unknown target is a 404, not a cheerful ok. The ID delete is VERIFIED and its
   failure reported rather than swallowed.

0bn. **The tick goes when the plan goes.** A venue dropped to free loses `verified`
   on the write AND `shapeVenue` refuses to report one for an unpaid page — belt and
   braces, because the second half cannot be missed by a code path that forgot. A
   purchased trust signal that outlives the purchase is worse than none.

## Profile & embeds

9b. **A pasted URL is a parse input, never a record and never an iframe src.**
    `_embeds.mjs` extracts an id, re-validates it against a strict pattern, and
    rebuilds the URL from a literal template. Host checks are exact `Set` lookups:
    `includes('youtube.com')` matches `evil.com/?x=youtube.com`, and both
    `youtube.com@evil.tld` and `open.spotify.com.evil.tld` defeat naive matching.
    Stored media is re-validated on read too, and `frame-src` in `netlify.toml`
    is the third layer. Never accept pasted `<iframe>` markup.

9c. **Embed attributes that look cosmetic are not.**
    `referrerpolicy="strict-origin-when-cross-origin"` on YouTube — `no-referrer`
    causes playback error 153. `encrypted-media` in `allow` or DRM fails silently.
    `allow-storage-access-by-user-activation` in Apple's sandbox or every
    subscriber is stuck on 30-second previews. Spotify and Apple heights are
    discrete widget states — never wrap them in an aspect-ratio box.

## Lyrics

9e. **Never call LRCLIB from the browser.** It asks clients to identify themselves
    and browsers are forbidden from setting `User-Agent`; the documented
    workaround (`Lrclib-Client` / `X-User-Agent`) only works server-side. Fetch
    once through the function, then serve from the Blobs cache — a room tapping
    "Lyrics" at the same moment must never become 40 calls to a free community API.

9f. **Label them "Unofficial lyrics".** The source is an unlicensed
    community-contributed corpus, not a licensed feed. Current song only, no
    library, no search, no copy (`user-select:none`), songwriter credit shown, and
    a one-tap removal per song in the Studio. Lyrics the artist typed himself are
    labelled "provided by the artist" — never "community-contributed".

## Multi-tenancy

0a. **Nothing in the store is global except the registry.** Every show, setlist,
    fan record, payment, history doc, profile and lyric is keyed by artist id via
    `KEY.*` in `_lib.mjs`. The one global document is `artists`, which maps
    id -> slug -> email. Do not add a new singleton.

0b. **The artist id comes from the session, never from the request.** Admin
    endpoints resolve it with `requireArtist(req)`; public ones with
    `publicArtist(req)` from `?a=<slug>`. An artist passing someone else's id in
    a body must never reach their data — so no handler reads an id from `body`.

0c. **A new artist starts blank.** `defaultShow()` has no name, no venue and no
    songs. It once returned Perry's name, his venue and all 66 of his songs, so
    the second artist ever created appeared to BE him. The starter pack of covers
    is an explicit opt-in button, and nobody's own compositions belong in it.

0d. **Slugs are public URLs**: cleaned to `[a-z0-9-]`, min 3 chars, checked
    against a reserved list (`api`, `studio`, `vote`, `signup`, …) so an artist
    can never claim a route.

## QR codes

0u. **A QR that looks plausible but does not scan is worse than none** — these get
    printed and stuck on tables. `_qr.mjs` is verified by DECODING, not by eye:
    every URL the app generates is rendered and read back with an independent
    decoder at 4, 6, 8, 12 and 20 px per module. My first version scanned as
    nothing at all (the 15 format bits were written in reverse), and my first mask
    penalty picked unreadable masks. On the fuzz set it now decodes 206/214 versus
    a reference implementation's 205/214 on the same pipeline.

0v. **`/api/qr` builds the URL, the caller only picks a kind.** A general
    "encode this text" endpoint would make the site a free generator of QR codes
    pointing anywhere, which is the shape of a phishing tool.

## Plans and money

0w. **Anything the ROOM experiences stays free.** Lyrics were briefly gated to
    Plus and put back deliberately: an audience that gets a sing-along at one
    artist's gig and not the next learns that MySet is unreliable, which costs
    more than a subscription is worth. Gate the artist's *back office* — never the
    audience's night.


0r0. **DIRECT CHARGES, and the fee is the plan's fee.** 0r below is now
   implemented (`_connect.mjs`). The charge is created ON the artist's connected
   account, so the money is legally theirs and MySet takes an
   `application_fee_amount` off the top: **10% free, 2% Plus, 0% Pro** — Perry's
   ladder, defined once in `PLANS[*].cut` so the pricing page cannot drift from what
   is charged. Zero is OMITTED rather than sent as a fee of nothing.

   Direct rather than destination charges on purpose: destination charges would make
   MySet the merchant of record for every gig, holding the funds and answering the
   chargeback for a night it did not play.

   **Say who pays Stripe.** A direct charge puts Stripe's own ~2.9% + 30c on the
   ARTIST. On a $5 pack a Plus artist pays roughly 45c to Stripe and 10c to MySet, so
   "2% to MySet" is not "you keep 98%". The Studio card says this before they
   onboard; an artist must never learn it from a payout.

   **A session created on a connected account can only be RETRIEVED with that account
   in scope.** `stripeFor(aid)` exists so the return page, the webhook and the
   reconcile sweep all scope identically — getting this wrong reproduces the
   2026-08-30 "paid customer got nothing" failure with a brand-new cause. On a
   Connect webhook, `event.account` is the only clue, and `acctindex` maps it back to
   an artist.

0r. **The 10% free-tier cut needs Stripe Connect and does not exist yet.** Today
    every artist's audience pays into the ONE `STRIPE_SECRET_KEY` — Perry's. That
    is fine while he is the only artist and wrong the moment anyone else signs up.
    `PLANS[].cut` is defined and surfaced, but no fee is taken until each artist
    has their own connected account and charges carry `application_fee_amount`.
    **Do not onboard a second paying artist before Connect.**

0s0. **The plan limits FEATURED songs, not the library.** Anyone may keep up to
    2000; a plan caps how many are live to the audience at once. Over the cap, a
    new song still saves — it just arrives switched off, and says so.

0s. **A cap never deletes anything.** The free 50-song ceiling blocks adding a
    51st; it does not touch a setlist that is already larger.

0t. **Only the founding artist can mint promo codes** (`isPlatformOwner`). A 100%
    code comps the plan outright; anything less is recorded as `discountPct` for
    a future checkout, because there is no billing to halve yet.

## Photos

0m. **Photos are shrunk on the phone, and the bytes are checked on the server.**
    A camera file is 3-5MB and none of that survives being drawn 130px wide.
    `_img.mjs` reads the actual file signature — an HTML file relabelled as a
    JPEG is refused — and SVG is not accepted at all, because it can carry script.

0n. **`/api/img` URLs carry a `?v=` stamp** that changes on every upload, so the
    response can be cached for a year and still update instantly.

## Live state

0o. **A show is not live until the artist taps "Start the show".** `status`
    defaults to `'pre'`, not `'live'` — the old default meant every page claimed
    a gig was happening the moment an account existed. Red "Live now" and "Join
    live" appear only for `status === 'live'`; otherwise the page shows an
    outlined countdown to the next gig in the calendar.

0p. **"Open / Paused" is the VOTING window, not the show.** It is labelled
    "Voting" in the Studio header because it read as a show control.

0q. **Times shown to the public come from the calendar, not `show.showTime`.**
    That field is a legacy placeholder and said 8:00 PM while the real gig was
    at 8:30.

## Responsiveness

0k. **A write blocks the screen and ignores a second tap.** Tapping "Add it" four
    times because nothing appeared to happen created four gigs. `act()` and every
    gig write take a `WRITING` lock, and `api()` raises a full-screen busy state
    after 140ms (fast calls never flash it).

0l. **A write returns the fresh state with it.** `/api/admin` includes the
    `stagePayload`, so the Studio does one round trip per tap, not two. That
    second fetch was most of the perceived lag.

## Gigs and the city feed

0e. **Gigs are rules, not instances.** A weekly residency is one record. Expansion
    happens **server-side only** (`_events.mjs`), and the Studio calendar asks the
    server for occurrences rather than expanding them itself — the same
    one-implementation rule as `rankSongs` (12b).

0f. **A gig is a wall clock in a named place**, stored as `date` + `time` + IANA
    `tz`, resolved to an instant on read by `_time.mjs`. Never store the instant:
    a residency would shift by an hour at every DST change.

0g. **Monthly recurrence is measured from the original date**, not from the
    previous occurrence. Stepping month-to-month makes "the 31st" clamp to the
    28th in February and stay there for good.

0h. **A set that runs past midnight belongs to the night it started** and is
    still "on" at 1am. `endsAt` decides what is live, not the calendar day —
    this is the one thing todo.today gets wrong and the one we cannot.

0i. **The city index is written when gigs change, never read with `list()`.**
    `reindexCities` removes the artist from every city then re-adds the ones they
    actually have gigs in, so deleting a gig cleans up after itself.

0j. **Never invent gig data.** A listed gig sends a real person to a real bar on
    a real night. Placeholder venues were once loaded to test the feed and had to
    be deleted before they could be seen.

## Artist sign-in

9g. **The audience never signs in.** Anonymous is why the app works in a bar.
    Auth exists only for the Studio.

9h. **Every unauthenticated auth response must be identical** whether or not the
    address is on the artist list, or the endpoint becomes a way to discover who
    has an account. This broke once already: "email isn't switched on" is a
    property of the SITE, so it has to be checked *before* the allowlist, not
    after. Wrong code and unknown email both return the same 401 text.

9i. **Codes and tokens.** Six digits, 10-minute expiry, burned on use, max 5
    guesses, max 5 sends per address per hour, compared in constant time and
    stored only as an HMAC. Sessions are signed with a secret generated once into
    Blobs — never in the repo, and one less thing to configure. Bumping
    `artists.rev` signs every device out at once.

## Cost

9d0. **Production deploys are the expensive thing, not traffic.** A production
    deploy costs 15 Netlify credits; 10,000 web requests cost 2. On 2026-08-31 I
    burned ~240 credits in one afternoon on production deploys and blamed the
    polling, which had cost about 5. **Iterate on `netlify deploy` (draft URL,
    0 credits) and deploy to production once, at the end.**
    The count in that first diagnosis was itself wrong — see 9d3. It said 16; the
    real number was more than twice that, because half the deploys were triggered
    by `git push` and nobody was counting them.

9d3. **`git push` IS the production deploy. Never also deploy from the CLI.**
    `mysetvip` is connected to `github.com/perryidyll/myset` and builds `main`
    automatically. For weeks it was ALSO being deployed with
    `netlify deploy --build --prod`, so every shipped change bought two production
    deploys at 15 credits each. Measured on 2026-09-01 for the 2026-08-08 period:
    **77 production deploys on mysetvip — 40 from git, 37 from the CLI — ~555
    credits of pure duplication**, a third of the whole account's burn.
    It also multiplies per commit: two pushes for one change is two builds, so
    push code and docs together.
    Consequences to keep: production is verified from OUTSIDE after the build
    lands (INVARIANT 17), not from a staged tree; `npm test` runs before the push,
    not after; and `netlify deploy` with no `--prod` is still the free way to look
    at something. An env-var change needs a rebuild to take effect —
    `git commit --allow-empty` and push, or trigger it from the Netlify UI.

9d4. **Only production deploys cost credits — and `credit-burn.sh` used to bill
    the free ones.** It counted every `state == 'ready'` deploy at 15 credits,
    drafts and deploy previews included, and asked for a single page of 200. On
    2026-09-01 that made it report ~2,550 credits against a true 1,680, which
    would have pushed Perry onto Pro on a false number — and 9d2 says upgrading at
    the wrong moment forfeits the month's unused credits. It now filters on
    `context == 'production'`, pages properly, and shows the git/CLI split so a
    regression of 9d3 is visible in the one place anybody looks.

9d1. **Never downgrade to the Free plan.** Purchased credit packs survive
    indefinitely *"as long as you remain on a paid plan"* — dropping to Free
    forfeits them. Perry has real money sitting in packs.

9d2. **Upgrading wipes unused monthly credits immediately.** If we ever move
    Personal -> Pro, do it at the END of a billing cycle, not the start.

9d11. **THE ONLY REAL GIG WAS 8 VOTERS AND 21 VOTES.** 2026-08-30, The Ugly
    Duckling, Koh Phangan. That is the entire observational base for every capacity
    and cost number this project has produced. Two separateresearch passes have since
    quoted "40 phones" as measured — it is not: that 40 is a SYNTHETIC security
    probe with fabricated fan ids from the audit, and it landed in a doc where the
    next reader took it for a room.
    So every model in 9d5/9d7/9d8 is sized for a room three to five times larger
    than anything ever observed, and the true numbers are almost certainly LOWER,
    not higher. Do not quote a capacity figure without saying which of these it
    rests on. One instrumented gig with a full room settles it.

9d12. **SSE may be a DOWNGRADE for MySet, and the reason is counter-intuitive.**
    `vote.html`'s `tick()` returns before fetching while `document.hidden`, so a
    phone in a pocket costs literally NOTHING under polling. An SSE stream holds a
    socket open for exactly that idle time — and on iOS, WebKit closes persistent
    connections when Safari is backgrounded, so it churns reconnects instead.
    MySet's audience keeps its phones in pockets most of a gig, which is the one
    traffic shape where polling beats push. Measured limits, for when it IS worth
    it: ~20.8 KB per idle connection through Node's `http`, but only ~2.8 KB
    through raw `net` — a 7x lever, because the cost is the per-socket HTTP object
    graph, not buffers. Fly's default `soft_limit` of 20 breaks at connection 21,
    and its ~2,048-connections-per-edge-per-app cap bites long before memory does.

9d7. **READ THE BILL. 99% of it is deploys, not traffic.** Read off the Netlify
    dashboard (Team -> Usage & billing -> Account usage insights) for the
    2026-08-08 period, because four separate models had guessed instead:

    | | measured | credits |
    |---|---|---|
    | Production deploys | 112 (all 4 sites) | **1,680** |
    | Function compute | **0.53 GB-Hrs** | 5.3 |
    | Web requests | **27K** | 5.4 |
    | Bandwidth | **331 MB** | 6.6 |
    | | | **1,697 — dashboard says 1.7K** |

    That reconciliation is tight enough to confirm all four unit prices AND the
    deploy count at once. **All metered traffic together is 1.0% of the bill.**
    So the expensive thing really is deploys (9d0 was right, 9d3 more so), and the
    polling panic was about a projection, not an invoice.

    **71ms is a LOWER BOUND, never a per-function figure.** It is 1,908 function-
    seconds spread across ALL 27,000 requests including near-zero-compute static hits,
    and a gig is ~99% function calls where the account-month was mostly static and
    crawlers. Using it as the cost of an `/api/show` call understates it: at a more
    realistic 110ms the same measured month implies ~17,300 function calls, which is
    entirely consistent. Two models have already made this mistake.

    Two derived facts worth keeping. **Billed duration is ~71ms per web request**
    (0.53 GB-Hrs / 27K, at the 1024MB default) — so 9d5's 155ms probe was ~2x high,
    my original 200ms guess ~3x high, and the 424ms TTFB model ~6x high. And at a
    genuinely busy artist (590k requests/month) the metered cost is **~263 credits =
    $2.63/artist/month, 74% margin at $10**, falling to **~$1.20 and 88%** with the
    two fixes shipped 2026-09-01. Nowhere near the 27% that the TTFB model implied.

    The number that is still MODELLED, not measured, is 590,000 requests/artist/month.
    27K for the whole team in a month is roughly one gig's worth, so the per-gig shape
    looks right — but nobody has yet read the usage page after a real busy month.

9d5. **Never re-derive the cost from response times.** This has now been got wrong three times, twice by me.
    The brief assumed 200ms at 128MB and reported 187 credits/artist/month (~81%
    margin). An audit lens measured TTFB, subtracted a static-file baseline, and
    reported a "263ms fixed per-invocation floor" and 726-847 credits (27-52% margin).
    Both were wrong, in opposite directions, because **Netlify bills handler wall
    clock, not time-to-first-byte** — the 285-350ms TTFB delta over a static file is
    network and routing to the function region and is not billed at all.
    Measured 2026-09-01 by deploying a probe to this account, n=10 per mode:
    **noop handler 0ms · one strong blob read 42ms · 13 parallel reads 64ms · a whole
    /api/show poll ~155ms.** There is no fixed floor. Actual JavaScript CPU is ~3ms —
    the function is ~98% waiting, billed at 1GB-hour rates because **Functions default
    to 1024MB and memory config is Pro-only**.
    True cost: ~401 credits/artist/month at 5 gigs/week = **$4.01** at this account's
    verified marginal price of **$0.01/credit** (`plan_auto_topup_per_unit_cost`, read
    from the account API — not the Pro pack rate, which flatters every figure by a
    third). **53% margin at $10/month, not 81%.**
    Consequence worth keeping: at ~401 credits/artist, **two** artists at 5 gigs/week
    already outspend a whole billing period's production deploys. Deploy discipline
    (9d3) still matters, but it stops being the dominant line almost immediately.

9d6. **Durable caching and Edge Functions are mutually exclusive, and caching wins.**
    Netlify, verbatim: *"The durable cache is currently only compatible with Netlify
    Function responses. The durable directive has no effect on responses from Netlify
    Edge Functions."* The two land within $0.21/artist/month of each other, so take the
    one that keeps the Node runtime, `_lib.mjs`, the whole test suite and has no 50ms
    CPU cliff. Edge is the fallback, and both need the same `/api/show` payload split,
    so that work is not wasted either way.
    **And `Netlify-Vary` is silently ignored when a function is reached through the
    `/api/* -> /.netlify/functions/:splat` rewrite** — measured: three requests
    differing only in `fan=` all missed via `/api/`, but hit on the direct path. The
    fix is to sidestep it: make the cacheable URL carry only `?a=<slug>` so every
    phone requests an identical URL and no Vary is needed.

9d8. **The artist's own Studio polls harder than the whole room, and 9d never
    covered it.** `studio.html` runs a FIXED 4-second `setInterval` with no backoff and
    no signature check, gated only on the tab being visible and on the Live tab. A
    phone propped on a mic stand is visible for most of the night, so that is ~2,160
    calls a gig from ONE device — modelled at **~19-21% of a gig's metered credits**,
    equal to about 3.5 fan phones in calls and 8 in compute. `/api/stage` is also the
    heaviest endpoint in the app: ~17 blob reads plus a serial `artistById` import
    after the `Promise.all`.
    9d says "do not reintroduce a fixed fast interval" and was written about the
    audience. **It applies to the Studio too.** Any change here trades against
    INVARIANT 0k/0l — the Studio has to feel instant on stage — so the fix is a
    backoff that only engages when nothing has changed, never a slower fixed tick.

9d9. **The free tier is capped by GIGS, because gigs are what cost money.** Four
    shows a calendar month; Plus and Pro unlimited. Every phone in the room polls
    for the whole gig, so the bill tracks gigs PLAYED, not artists signed up — a
    feature-based limit would punish the wrong people and save nothing. Enforced at
    the two places a gig starts (`newShow`, and `status` -> live from not-live),
    refused BEFORE the mutation and never mid-show (INVARIANT 16), counted per UTC
    month on the show record because a show in progress is not in history yet.
    The Studio warns at two shows left: a cap discovered on stage at 10pm is a bug,
    not a business model. And nothing the ROOM experiences is ever capped (0w).

9d10. **A tap is not a change.** `wakeUp()` used to reset the poll ladder to its
    fastest rung on every `pointerdown` — which fires on every scroll — so 66% of
    all polls were pinned fast by people looking at their phones rather than by
    anything happening. It now separates a FULL wake (screen-on, a vote, a
    purchase) from a NUDGE (a tap, which only lifts a phone out of the slowest
    rung). Simulated over the real loop: 1,003 -> 580 polls per phone per gig, 42%.
    The ladder itself was never the lever — measured, 3/6/12 and 3/6 were
    identical — so do not "fix" this by widening rungs again.

9d. **Every phone in the room polls.** At 3s, a two-hour gig with twenty people
    is ~24,000 function calls — enough to exhaust a month's free tier in a few
    shows, which is exactly what happened on 2026-08-31. `vote.html` backs off
    to 6s then 12s when nothing changes and snaps back on any change or tap.
    Do not reintroduce a fixed fast interval.

9d13. **COUNT THE READS. `test/cost.mjs` is the ceiling, and it is a test.** Reads on
   the audience poll are the mistake this project keeps making: the audit found the
   global `artists` registry on that path three separate times, and then the
   feature-flag work quietly put a SECOND global document there, taking the poll
   from 15 strong reads to 16 — noticed only because somebody went looking. Nothing
   was counting, so nothing could notice.

   `blobs-fake.mjs` now logs operations (`__opsStart`/`__opsStop`) and `test/cost.mjs`
   asserts ceilings: 15 reads per audience poll, ONE global document, 5 per vote, 22
   per Studio poll. They are ceilings, not targets. Raising one is a decision to make
   on purpose and say why in the commit, not something to discover on a bill.

   Two things that fell out of it and are now rules:
   * **`_flags.mjs` is cached in module scope for 60s.** Safe because flags are never
     written during a show; the cost is that a flip takes up to a minute to reach
     every warm instance, which is the right trade for a switch used between gigs.
   * **`releaseUnvotable` only sweeps when the playable set actually SHRANK.** It
     reads all twelve fan shards, and it was running on every list action — a rename
     cost 12 strong reads it could never need. The check compares the playable id set
     across the change: MEASURED, not an allow-list of action names, because this
     codebase has already had exactly that promise forgotten twice.

## Secrets & publishing

10. **Only `./public` is published.** `publish = "."` once meant docs, backups and
    the design handoff were all downloadable from the live domain. Netlify's
    secrets scanner caught it; do not widen the publish directory.

11b. **No secret value ever appears in a CHAT WINDOW either, and that includes one
    I generated myself.** On 2026-09-02 I generated a VAPID keypair and printed both
    halves to the terminal to be helpful. The private key was in the transcript
    before I finished the sentence. Generating a secret is not the same as being
    allowed to handle one — `./vapid-keys.sh` exists so Perry runs it himself and
    the value never crosses the boundary. The rule is the same as for
    `STRIPE_SECRET_KEY`: name the variable, never the value.

11. **No secret value ever appears in a repo file.** The stage passcode lives only
    in the Netlify `ADMIN_CODE` env var. Writing it into a doc broke the build —
    correctly.

12. **`STRIPE_SECRET_KEY` is server-side only**, never referenced from anything in
    `public/`.

## Ordering

12b. **One ordering rule, one implementation.** `rankSongs()` in `_lib.mjs` is the
    only definition of "what plays next" (votes desc -> earliest vote -> title).
    `show.mjs`, `stage.mjs` and `admin.mjs`'s `playTop` all call it. They drifted
    once and the audience was shown a winner the Studio would not start.

12c. **Never interpolate a song title or artist into an `onclick`.** `esc()` is an
    HTML escaper; the parser decodes it back before the JS is compiled, which both
    broke every song with an apostrophe and opened an injection hole. Use
    `data-` attributes and a delegated listener.

## History

17b. **The vote tally is destroyed every time a song starts.** `clearAllFanVotes()`
    runs on `play`/`playTop`, so the number a song won with exists for about a
    millisecond. `admin.mjs` snapshots **the whole round** — winner, everyone
    else, the voter count — into `show.log` inside the same handler. Remove that
    and show history becomes permanently unrecoverable, not merely wrong.

17c. **Archive before you wipe.** `archiveShow()` must run before `wipeFans()` or
    `clearAllFanVotes()`, in every path that ends a show (`newShow`,
    `status:'ended'`). It is idempotent — re-archiving only refreshes the money.

17d. **Money is attributed by `metadata.show`, never by timestamp.** Sessions
    created before show tracking have no tag; they are reported as
    `unattributed` and labelled as such. Guessing which show a payment belonged
    to would put a fabricated number on his dashboard.

## Show behaviour

13. **A fan can never spend more credits than they have.** Enforced server-side in
    `vote.mjs`, not in the UI. Replay votes cost `show.replayCost` (default 5) and
    the check is weighted accordingly.

14. **Starting a song refreshes everyone's votes** (`clearAllFanVotes`), so each
    round is a fresh contest.
    **Free credits refresh. PAID ones do not** — see 13b.

13b. **A bought pack is a stock, and free credits are spent first.** `extra` was
    read as part of `total = freeCredits + extra` in four places and decremented in
    exactly ONE place in the whole codebase (`gift.mjs`), so a purchased pack never
    ran out. Measured: an 18-vote pack yielded **252 credits across 13 rounds** and
    survived `newShow` untouched, making one $11 purchase a permanent advantage at
    every future gig that artist played. Three lenses found it independently and
    three verifiers reproduced it.
    The paid portion of a round is `creditsUsed - freeCredits`, derived not stored,
    and it is settled **once, at the round reset**, inside `clearAllFanVotes`.
    Debiting at the moment of the cast is wrong twice over: `creditsUsed` already
    counts the vote while `total` would shrink (double-charging), and it breaks
    INVARIANT 15, because un-voting would then burn a paid vote.
    `clearAllFanVotes` therefore **requires the pre-play show** to price the round:
    `play` takes the winning song back out of `played[]` before the reset runs, so
    pricing against the post-play show charges a just-won replay 1 instead of
    `replayCost`. It throws if that snapshot is missing rather than silently
    under-debiting.

15. **A cast is idempotent BY CAST ID, not by state.** This used to read "voting is
    idempotent per (fan, song)" — a second tap toggled off and refunded — and that
    sentence hid the fact that the toggle *was* the idempotency mechanism: a lost
    response found the vote already there and removed it, so a retry could never
    double-charge. Under `voteFinal` there is no toggle, so every cast now carries
    an id minted at the press of Confirm, and `vote.mjs` remembers the outcome
    against it on the fan record (last 20, cleared with the round). A replay is
    answered from memory and writes nothing. INVARIANT 15h says it plainly: do not
    remove the toggle without this in place.

    **Un-voting is never gated by whether the song is still on offer** — only casting
    is. The setlist guard was once added ahead of the toggle, which left a fan's
    credit spent on a song they could no longer un-vote.

    **What finality does and does not promise.** With the flag on, a fan cannot undo
    their own vote, and the page must offer no affordance suggesting otherwise —
    the row is disabled and the queue tick is a `<span>`, not a button. It is NOT a
    promise that the song will still exist: when the ARTIST deletes or hides it, the
    votes go and the capacity comes back, because the alternative is an artist
    pocketing a room's credits. `dropSongVotes` therefore removes EVERY occurrence
    of the id, not the first — it predated multi-vote and removing one entry left a
    fan charged for votes on a song that no longer existed, unrecoverable once
    finality is on.

13c. **An unlimited round is free, so it must debit nobody's pack.** `vote.mjs`
   skips the credit check entirely while `isUnlimited(fan, show)`, so nothing is
   ever owed for those votes — but `creditsUsed` still counts them. `paidUsed`
   therefore takes the **fan id** and returns 0 for an unlimited device; without
   it, `clearAllFanVotes` settles the round by debiting `extra` for votes the
   server gave away, and a measured 12-credit pack vanished in ONE round. Both
   callers have the id in hand: it is the shard bag's key. `unspentPaid` passes it
   through for the same reason.

13d. **`null` is not zero, and JavaScript disagrees.** The server sends
   `credits.remaining: null` when a device votes without limit. `null < 1` is
   **true**, so a client rule of `c.remaining < cost` disabled every Vote button in
   the room while the pill showed ∞ — the one feature meant for a paid private
   party broke voting for everyone. Any affordability test on the audience page
   must short-circuit on `c.unlimited` FIRST. The ask-card rule always did; the
   vote-button rule did not, which is how it survived.

## Live-show safety

15b. **Voting paused means no changes at all** — a fan must not be able to remove
    an existing vote either, because they could not re-cast it.

15c. **`checkAdmin` fails closed.** If `ADMIN_CODE` is unset, deny. Never fall back
    to a default that lives in the repo.

15d. **The artist must be able to get into his own Studio without a terminal.**
   The passcode used to live only in the Netlify `ADMIN_CODE` env var, so during
   his first real gig he could not open his own dashboard and never started a
   single song. He can now set his own code in Settings (stored **hashed** in
   `show.codeHash`); `ADMIN_CODE` remains the recovery key so he cannot lock
   himself out. Never make env-var-only the sole way in.

15g. **A feature flag is a question with two REAL answers.** `_flags.mjs` exists so
   a change that is an opinion rather than a fix can be tried both ways without an
   edit-deploy-undo cycle — and on this account a production deploy is the expensive
   thing (INVARIANT 9d0), so "just try it" otherwise costs money and risks being
   mid-undo when a show starts. Rules: a flag is never a way to ship something
   half-finished (a flag that is off because the code behind it is broken is a lie
   with a switch on it); every flag is declared in `FLAGS` with what it does, what
   off means, and its REMOVAL PLAN; an undeclared name always reads false, so a typo
   cannot enable anything; and the document is never written during a show, because
   it is read on the hot audience poll.

15h. **The un-vote toggle is what makes voting idempotent — do not remove it without
   replacing that.** `vote.mjs` has no request id, so a lost response today finds the
   vote already cast and removes it: annoying, self-correcting, never a double
   charge. Under `voteFinal` the same lost response casts AGAIN, on bar wifi, at
   replay prices. Finality therefore cannot ship before a per-confirmation cast id
   does. `PLAN-vote-finality.md` has the sequence; step 1 is not optional.

15i. **A vote is one entry in `fan.v`, and the same id may appear many times.** The
   audience sheet casts several votes at once, and multiplicity lives in that array
   rather than a new field, because `voteCounts` and `creditsUsed` both work by
   counting entries. Anything that reasons about "did this fan vote for X" must count
   occurrences, not test membership — `show.mjs` sends `mineCount` alongside `mine`
   for exactly that reason. The quantity is bounded by affordability and hard-capped
   at 50 so a hand-made request cannot make a million-element array.

15e. **A studio code is half a credential; the page name is the other half.** The
   code door used to check only `getShow(DEFAULT_ARTIST).codeHash`, while `setCode`
   wrote into the CALLING artist's record — so every artist but the founder got a
   confirmation for a code that could never work, and an expired token mid-gig left
   them with no door at all. That is 15d for everyone except Perry.

   `requireArtist` now resolves the artist from `?a=<slug>` / `x-admin-artist` and
   checks THAT artist's hash. This is the one place an artist id comes from the
   request rather than the session (INVARIANT 0b), and it is safe for a specific
   reason: the slug is public and grants nothing alone — it only says which lock to
   try — and the id is used only after the secret has matched. No slug still means
   the founding artist, so every existing link keeps working, and `ADMIN_CODE` is
   checked first so a lockout can never shut the founder out of his own platform.

   **Do not replace this with a global `sha(code) -> artistId` index.** Two artists
   who choose the same passcode collide, and refusing the second one ("that code is
   taken") is an oracle that confirms a working passcode exists.

15f. **The code door locks, and the lock is not an oracle.** Ten failures in fifteen
   minutes shuts one artist's code door for fifteen minutes (`lock_<aid>`). A locked
   door, a wrong code, and an unknown page name all return the SAME response —
   otherwise the lock becomes a way to discover which codes and which artists are
   real (INVARIANT 9h's rule, applied to this door). Codes are at least
   `MIN_CODE` = 8 characters, and `weakCode()` also refuses a repeated character, a
   short deny-list, and the artist's own page name — which is the half of the
   credential anyone can already read.

15j. **Votes are FINAL, and the release has to be automatic.** `voteFinal` defaults
   ON as of 2026-09-02. The un-vote toggle was quietly the escape hatch for a
   stranded credit: hide a song or narrow the setlist, and a fan holding a vote on
   it could tap it off and get their credit back. With no toggle that credit is
   stranded for the rest of the round, so `releaseUnvotable()` gives it back the
   moment the playable set SHRINKS — which is a stronger promise than the old one,
   because the fan need not notice or still be looking at their phone.

   It is called from BOTH dispatch paths: the `mutateShow` switch (toggleSong) and
   `handleLists` (listSongs / listUse / listToggle / listDelete), which
   short-circuits before that block. One helper, two call sites, so neither can be
   the one that forgets.

   **A bare body on a song the fan already holds is REFUSED, not treated as more
   votes.** An old cached page means "un-vote"; charging somebody who meant to take
   a vote back is the worse of the two mistakes. Adding more needs an explicit
   `op:'cast'`.

15k. **Asking for feedback must never cost the gig.** The "Enjoying MySet?" prompt
   waits for an HOUR of use accumulated only while the page is VISIBLE — a phone
   face-down in a pocket for a whole set has not been using MySet — and then asks at
   most once a week, never again once answered. It never opens over another sheet
   and never mid-vote. Both limits are enforced on the SERVER too
   (`_feedback.mjs`), because a localStorage rule is a suggestion. And it is not
   write-only: the artist reads it in the Studio, with the notes and never a device
   id.

16. **Nothing in the app may break the gig.** Every failure path degrades to "the
    setlist is still readable". No error state should block the page from rendering.

17e. **A JS parse check is not a structure check.** `studio.html` is one big
    `render()` with four `if(TAB===…)` blocks. A bad edit deleted two of them and
    the file still parsed cleanly, because what was left was still valid
    JavaScript. After any edit to it, assert every tab block and every top-level
    function is present exactly once — the check is in the commit history.

17. **Verify from outside after deploying.** Check the live `myset.vip` URLs and the
    API, not the local files.

## Venues

0x. **A venue is a different account, not a role on an artist.** Separate registry
    (`venues`), separate token tag (`v|…`), separate one-time-code realm. A bar has
    opening hours and a menu and never runs a show; it must never be able to reach
    an artist's setlist, votes, history or money. Making it a second registry makes
    that structural instead of a permission check somebody forgets to write.
    Verified: a venue token gets 401 from `/api/admin`, and the studio code gets
    401 from `/api/venueadmin`.

0y. **Nothing links a gig to a venue. The NAME does, inside the venue's own city.**
    Artists type the venue by hand and type it differently every time ("The Ugly
    Duckling", "Ugly Duckling Irish Pub ☘️🍻"), so `sameVenue()` compares
    normalised words and accepts a containment match only when the shorter name is
    **distinctive** — two words, or eight characters. Without that rule a venue
    could register itself as "Beach" and claim every Beach Bar in town. An exact
    match always counts, however short. Consequence worth keeping: a venue signing
    up today already has its whole diary, with no backfill and no job to run.

0z. **A page that isn't verified says so, and loses nothing else.** Asking for proof
    before a page exists means no pages exist. Every venue page works fully; the
    only difference is a grey `Unverified listing` chip instead of a green
    `✓ Verified` one. See `VERIFYING-A-VENUE.md` — email-domain match and Perry's
    own switch are built; artist vouching is the next one and the one that scales.

0aa. **A venue's photos live under an owner key an artist can never hold.** Artist
    ids and slugs are stripped to `[a-z0-9-]`, so the underscore in `v_<venueId>`
    is unforgeable in either direction. `/api/img` branches on that pattern before
    it does anything else.

## Requests, and the room

0ab. **Never charge money for a request.** Song requests and birthday shout-outs
    cost VOTES. Charging cash to be played next is a different product with
    different problems, and it breaks 0w (anything the room experiences stays
    free).

0ac. **Take the votes first, then write the request; refund if the write fails.**
    The other order hands out free requests whenever the store is busy. Declining a
    request refunds exactly once and clamps at zero, so a decline after the credits
    have already refreshed cannot mint votes. Verified: a second decline returns
    409 and the balance does not move.

0ad. **A button the artist hasn't switched on is never shown.** Requests and
    birthdays default OFF. A request the artist can't play is worse than no request
    at all, and the audience must never tap something that leads to a shrug.

0ae. **Count PHONES in the room, not networks.** The first version counted distinct
    IP hashes, which is wrong in exactly the room this app is for: forty people at
    a beach bar on the venue wifi came out as 1. A phone is much closer to a person
    than a network is; the worst it does is count someone twice if they clear their
    storage mid-gig. The network hash is kept alongside it as the defence against
    one phone rotating its id, and is stored per show (`nets`).

0af. **Presence is stamped once per device per show, only from the voting page.**
    `/api/show` is polled by every phone in the room, so it must not write on the
    poll. The stamp needs `in=1`, which only `vote.html` sends — a profile view or
    the artist's own preview would otherwise inflate the head-count with people who
    were never there. The IP is never stored, only a hash with the artist id mixed
    in.

## Addresses

0ag. **There is no one link that opens in whichever map app a phone uses.** `geo:`
    is the closest thing on paper and iOS Safari ignores it. So the server builds
    BOTH an Apple and a Google URL from the stored address/coordinates, and the
    page picks by platform. Nothing is guessed in the browser and no third party is
    contacted to resolve a short link.

0ah. **A bare venue name is not a location.** "The Ugly Duckling" on its own could
    send somebody to Amsterdam, so `mapLinks()` returns null unless there are
    coordinates, an address, or a name WITH a city — and the city and country always
    go into the query. No Directions button is better than a wrong one.

## Venues, part two

0ai. **Only a signed-in ARTIST can ask a venue for a spot.** An open contact form
    is a spam funnel, and it throws away the only thing that makes an enquiry
    through MySet better than an email: the venue gets a link to a real page with
    real numbers on it. Nobody's email address is exchanged in either direction —
    the venue marks a pitch "keen", the artist sees that in their own studio, and
    they take it from there through the links on each other's pages. Verified: no
    `@` anywhere in the venue's pitch payload.

0aj. **A venue never sees an artist's money.** The room numbers (people, votes,
    songs, by night and by act) are the single biggest reason a bar signs up, and
    what an artist took in tips and vote sales is nobody's business but theirs. It
    is not in `venueStats()` at all, not even as a total. And it is still the
    artist's data, so `shareStats` (default on) turns the whole thing off from
    their own Settings. Verified: switching it off drops the venue's view to zero
    nights and reports one hidden act.

0ak. **Domain match alone is not proof of a venue.** Anyone can buy a domain and an
    email on it, and the website is just a URL somebody typed into a form. So
    verification needs BOTH: the sign-in email on the website's domain, AND the
    fetched page actually naming the venue. Free-mail domains are refused outright.
    Ten artists who each have a gig there in their own calendar is the other route,
    and the one that works for a bar with no website.

0al. **`_verify.mjs`'s fetch is the only place MySet requests a URL a stranger
    typed in, and it is guarded like it.** https only; the hostname resolved and
    refused if ANY address it answers with is loopback / private / link-local
    (169.254 — the metadata endpoint) / CGNAT / reserved; `.local` and `.internal`
    refused by name; redirects followed manually, 3 hops max, EACH hop re-checked;
    8s timeout; 512KB cap; html only. A literal private IP is refused at storage
    time too, so it can never be rendered as a link either. Verified against 13
    targets. Never relax any of these to make a check "work" for one venue.

0am. **A venue's own events go through the same engine as artists' gigs.** One
    record for "every Tuesday", expanded on read, landing on the venue page and in
    the local feed beside the music, tagged so a reader can tell them apart. The
    place comes from the venue's profile, never from the request — and changing the
    venue's city rewrites its events, or they keep pointing at the old town and
    quietly vanish from both feeds.

0an. **`.go` belongs to app.css.** It is the checkout button — a full-width
    gradient slab. It has now been reached for by accident TWICE in this project
    (the feed chevron, then the tonight card's Directions pill). Before naming any
    class on a page that links app.css, check it isn't already taken; the audit is
    a one-liner in the commit history.

0ao. **`display:block` on a bare tag selector inside a card breaks bold words
    mid-sentence.** `.note b{display:block}` was meant for the note's heading and
    also hit every `<b>` in its body, so "you only need **one**." rendered on three
    lines. Scope heading styles to the direct child (`.note>b`).

0bj. **The tick is premium, and still not for sale.** Paying opens the door to being
   CHECKED; it never buys the badge. `/api/venueauth checkDomain` used to grant
   `verified` on an email-domain match alone — buy a domain, put an email on it,
   claim a bar you have never visited — which is exactly what INVARIANT 0ak says is
   not proof. It now only REPORTS, and `tryVerifyByWebsite` is the only thing that
   can set the flag: paid plan AND email on the site's domain AND the site naming
   the venue AND `MIN_VOUCHES` (three) artists who have a gig listed there.

0bk. **An ID photo is never public and never kept.** An artist proves identity with a
   photo of an ID, so it is written to an image slot `img.mjs` refuses to serve —
   that function tests `SLOTS` before it looks at anything, and `ID_SLOT` is
   deliberately absent from it — and it is DELETED the moment the owner decides,
   approved or rejected. Only the decision is kept. Holding a stranger's government
   ID after the decision it was collected for is a liability nobody asked for, and
   the refusal to upload happens BEFORE the photo is taken when a check cannot pass.

0bl. **One gate for every money button, and Stripe answers it.** `connectReady(aid)`
   in `_pay.mjs` reads what Stripe reports about that account, never a local "they
   finished onboarding" flag. It returns false for everyone until Connect is built,
   which is the correct answer rather than a placeholder: without it a second
   artist's money lands in the founder's balance (INVARIANT 0r). Tips, packs and any
   future charge read this one function, so INVARIANT 0ad holds — the room is never
   shown a button that leads to a shrug.

## Setlists

0ap. **`playable(show)` is the ONE definition of which songs are in play.** A
    setlist narrows the library; `active !== false` hides a song for good; both
    apply. Every path goes through it — the audience payload, the vote guard,
    `playTop`, and the Studio's own view — because the moment two of them disagree
    the room is looking at a song the artist cannot start.

0aq. **A chosen setlist that resolves to nothing falls back to the whole library,
    and says so.** An empty voting page is a broken gig (INVARIANT 16), and a
    silently empty setlist is exactly the thing that gets discovered on stage at
    10pm. `playable()` reports `fellBack`, and the Studio shows a strip. This was
    wrong once: the first version returned `fellBack: false` for a selected-but-
    empty list, which hid the problem from the only place it needed to be visible.

0ar. **The projection of the active setlist onto the show record is the one piece of
    deliberate duplication in the store, and it is fenced.** `show.listSongs`
    exists so `/api/show` — polled by every phone in the room — never reads a
    second document. `applyList()` is the only writer; `normShow()` re-filters it
    against the library on every read so a stale id cannot survive; and every
    library mutation re-projects. **If you add another way to change a setlist or
    the library, call `applyList`/`refreshActive` after it.**

0as. **Songs the artist wants to LEARN are not in the library.** They live in
    `learn_<aid>`, because the room must never be able to vote for something that
    is not playable yet. "Learned it" moves the row across in one action — doing it
    in two leaves a duplicate when the second half fails.

0at. **A song's KEY and the artist's CHART never reach the audience.** The key is a
    performance note and the chart is their working document. Both are stripped
    from the public payload — verified, not assumed — and the chart lives in its own
    blob so it is never even loaded on the hot path.

0au. **Auto-tagging only ever fills a song that has NO genres.** It can therefore
    never undo a choice made by hand, and running it twice is a no-op. `originals`
    is never in the reference map; it is applied when a song's artist matches the
    artist's own name, because only they know which songs are theirs.

0av. **A custom genre can never duplicate a built-in, however it is spelled.** Two
    chips reading "Rock" that mean different things is worse than no custom genres.

0aw0. **A song id is never empty, whatever alphabet the title is in.** `slug()`
   keeps only `[a-z0-9]`, so a title with no Latin letters or digits — Thai,
   Japanese, Cyrillic, an emoji — slugged to the EMPTY STRING, and the song entered
   the library with id `''`. No vote can name that: the room could not see it and
   the artist could not see why. In a bar on Koh Phangan this is the normal case,
   not the edge. `songId(title, artist)` in `_lib.mjs` is the ONE definition, used
   by every mint site (addSong, importSongs, askAccept, starterSetlist), and falls
   back to a hash of the title so the id stays stable and still derived from the
   song. `songSig()` is its partner for import de-duplication — the old key
   `slug(title)|slug(artist)` made every Thai title a duplicate of every other, so
   a CSV of them imported exactly one row.

## The service worker

0aw. **NOTHING under `/api` is ever cached.** A cached vote is a lost vote and a
    cached payment is a support ticket. Verified in a real browser, not assumed:
    after loading the app and calling the API, the only thing in the cache was
    `/app.css`.

0ax. **Navigations are network-first, and nothing is precached.** The newest version
    of a page always wins, so a bad deploy is fixed by the next deploy rather than
    by asking somebody in a bar to clear their browser. Precaching a shell is what
    makes a service worker ship a stale app; there is no install-time cache to get
    out of step. Old caches are deleted on activate, and a page can post
    `myset-unregister` to make the worker stand down entirely.

0ay. **A manifest per surface.** `start_url` is the whole point of installing: an
    artist who puts the Studio on their home screen wants the Studio, not the city
    feed.

## Layout

0az. **`flex:1` on a row of tabs makes the spacing look wrong, not right.** Equal
    cell widths mean a short label floats in a wide cell while a long one is
    squeezed, so the gaps *between the words* — which is what the eye reads — come
    out uneven. Size tabs to their content with equal padding instead. Measured:
    identical gaps at 320/375/390/430.

0ba. **Never pre-fill a "new record" form from the previous record.** The gig sheet
    copied venue, city, address and map link from the last gig as a convenience;
    half-right details silently attached themselves to the wrong gig while Perry was
    entering a night's worth.

0bb. **A sticky bar's offset is measured, not guessed.** `.tabs` stuck at a
    hard-coded `top:66px` under a header that is really 88px tall, so the blurred
    header sat over the top quarter of the app's main navigation on every scroll.
    `fitTabs()` measures the header and sets `--headh`; the header's height is
    content-driven and grows with the phone's text-size setting, so no constant can
    be right for everyone.

## Setlists, part two — what the review found

0bc. **`votable(show)` is the ONE answer to "can the room choose this right now".**
    In tonight's set, or already played (a replay is always fair). `vote.mjs`
    enforces it, `playTop` picks out of it, `show.mjs` filters the public payload
    through it, and `stage.mjs` hands the Studio the same flag so its queue cannot
    drift. Callers may narrow it further — `playTop` also wants replay votes on a
    played song — but **none of them may widen it, and none of them may recompute
    it.** Every bug in this family was two places disagreeing: `playTop` moved to
    `playable()` and stopped seeing replay votes, so the room's top-voted song
    could not win; the Studio kept the old whole-library predicate, so the button
    on stage named a song `playTop` would not start.

0bd. **Everything in `/api/show` must be votable.** If the payload lists it, tapping
    it must work. A hidden-but-played song used to sit there answering "that one
    isn't on tonight's list".

0be. **Accepting a request must make it votable, or refuse.** `askAccept` added the
    song to the library only; with a setlist active the room could never vote for
    it, while the fan who paid three credits was told "On the list — go vote for
    it". It now joins tonight's set. If the plan's featured cap would land it
    switched off instead, the accept is REFUSED — the request stays pending, so the
    fan's credits are still attached to something the artist can honour or decline.

0bf. **The projection refresh is measured, not an allow-list.** `refreshActive` used
    to run for a hard-coded list of actions, with a comment asking the next person
    to remember to add to it — and two handlers added in the same change did not.
    `admin.mjs` now compares the set of song ids across the mutation. A fact cannot
    be forgotten; a promise can.

0bg. **A gig's `listId` has three states and they are not interchangeable.**
    `''` = no opinion, leave the artist's pick alone. `'all'` = play the whole
    library tonight. `<id>` = that set. A truthiness test collapsed the first two,
    so "All songs" on a gig silently did nothing; and `eventSave` sanitising unknown
    ids blanked `'all'` because it is not a list id. A gig pointing at a set the
    artist has since deleted leaves their pick alone and says so — silently
    blanking it is worse than doing nothing.

0bh. **A count shown next to a name must mean what the name says.** `shapeLists`
    returns two numbers on purpose: `songs` is library membership (the picker's
    ticks, so a hidden song keeps its tick instead of being dropped on save) and
    `count` is how many are in play (the same test `playable()` applies). They were
    the same number, so "8 of your 40 songs are in play" counted songs the room
    could not see.

0bi. **Accumulators live INSIDE the CAS callback.** `casDoc` re-runs it on a write
    conflict; `tagAuto`'s counters were declared outside and reported double what
    they did.
