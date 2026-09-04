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

5b. **Stripe's `success_url` must point at a page that calls `/api/confirm`.**
   Two do: `/vote.html` (votes and tips) and `/community.html` (merch). Each
   redeems on the return trip with its own copy of the pending/retry logic — copied
   on purpose, so the voting page's payment-return path is never touched by shop
   work. Pointing a session anywhere else takes the money and grants nothing — that
   shipped once and was caught in review, not by a user.

5c. **A payment must have more than one path to delivery.** The return trip
   through `/vote.html` is not enough — in a bar a buyer locks the screen and
   pockets the phone the moment Stripe says "paid", so a browser that never comes
   back must still mean votes delivered. (An earlier note here blamed a real
   undelivered $3 purchase on 2026-08-30; Perry confirmed on 2026-09-04 that the
   purchase was delivered and played. This is hardening, not an incident.)
   Three independent paths grant it, all funnelling through `redeemSession()`
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
   reconcile sweep all scope identically — getting this wrong takes money and delivers
   nothing, with a brand-new cause. On a
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

0o. **A show goes live in three ways, and the room is told which.** The artist taps
   "Start the show" or "New show" — or a gig on their calendar reaches its start
   time (`_auto.mjs`, Perry's decision 2026-09-04, replacing the older rule that only
   a tap could do it). `status` still defaults to `pre`, so a page never claims a
   gig is on because a calendar entry exists: the schedule STARTS the show, through
   the same `startShow` a tap uses, and stamps `startedBy: 'schedule'`. A show ends
   by a tap, or by itself three hours after the gig's scheduled end — never while a
   song started in the last 45 minutes (16). The occurrence key is stamped on the
   show, so one gig starts once, and a night the artist ended stays ended.

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

9d9. **The free tier is capped by GIGS, because gigs are what cost money.** Four a
   month (UTC), read from `PLANS.free.gigs` — enforced in ONE place, `startShow` in
   `_lifecycle.mjs`, which every start path calls: "Start the show", "New show" and
   the schedule. Refused BEFORE the mutation with the same words, counted INSIDE the
   CAS (0bi), never mid-show (16). A scheduled start that is refused is remembered on
   the index entry so it is not retried every two minutes; the Studio's own warning
   at two shows left is unchanged. Nothing the ROOM experiences is capped (0w).

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

17c. **Archive before you wipe.** `archiveShow()` runs before anything destroys the
   tally — in `startShow(fresh)` and `endShow()`, the only two places a night ends,
   whoever called them (a tap or the schedule). It is idempotent. And a night where
   nothing happened is not a night: a show that never went live, or had no song
   started, no vote cast and no phone present, is NOT archived — a scheduled start
   the artist never turned up to would otherwise be a row of zeros and "Shows: 1"
   on their public page.

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

## The Google Sheet

0bp. **The sheet is a COPY and nothing in MySet ever reads it.** Delete the whole
    spreadsheet and the app does not notice. That is what makes it a plain export
    with no locking, no schema migration and no consistency worry — and it is why
    a failed sync is a warning rather than an error an artist ever sees. The
    moment anything starts reading it, all of that is gone.

0bq. **Off until three env vars exist, and off is a CLEAN NO-OP WITH A REASON** —
    the same shape as `STRIPE_SECRET_KEY` (INVARIANT 9). `sheetsOffReason()`
    returns a sentence naming what is missing, never a throw, because "not set up
    yet" is the normal state and must not read as a failure in a log.

0br. **`GSHEET_KEY` never appears in a repo file, a log, a response or a chat
    window** (11/11b). `sheetStatus` reports whether the key *parses*, never what
    it is. `GSHEET_EMAIL` deliberately IS returned — it has to be pasted into
    Google's own share dialog, and hiding it is what makes the setup fail.

0bs. **THE WATERMARKS MOVE ONLY AFTER A SUCCESSFUL WRITE, AND PER TAB.** The sync
    remembers per-artist how far it got (`showsUntil` / `reqsUntil` / `fbUntil`)
    and each field is committed immediately after *its own* tab's append lands.
    A run that dies halfway re-sends only what that tab was carrying: **a
    duplicate row is a nuisance, a missing row is a hole nobody notices.**

    They all committed together at the end for the first few hours, which meant a
    failure on the LAST append re-sent every earlier tab next time — one night
    appearing twice in Shows because a *rating* failed to write. A test now fails
    only the Ratings append and asserts the Shows row does not come back.

0bs2. **THE SONGS TALLY IS AN ACCUMULATOR, AND IT IS KEYED BY SHOW.** Songs is a
    snapshot tab: cleared and rewritten every run. Its play and vote counts were
    first built from the shows that were NEW since last time — so the morning
    after a gig it read "played 1, votes 12" and the next sync rewrote the same
    rows as **"played 0, votes 0"**, every night, under a column headed "Votes all
    time". It cannot be recomputed either: the tally a song won is destroyed when
    the next song starts (17b), so an archived show is the only record there will
    ever be.

    So `songstats_<aid>` stores **each show's own contribution**, not a running
    total. Keyed by showId because of 17c's case: an artist who ends by accident,
    plays eight more and ends again re-archives the same showId with a later
    `endedAt` — which a timestamp-keyed accumulator counted twice. A re-archive
    replaces its entry, and the answer is right however many times a night is
    exported. Bounded to the same 100 shows `_history.mjs` itself keeps.

0bt. **A sync makes no Stripe call and never runs on a hot path.** Each night's
    money is read from the show's own archived record, so a sync cannot be slowed
    or broken by Stripe, and Stripe stays the ledger (5d). `archiveShow` was
    deliberately left untouched — ending a show is the most sacred path in the app
    (16), and a sheet is not worth a risk to it. The sync is a button and a nightly
    cron, both outside the gig.

0bu. **No `list()`, and no audience device id.** The artist and venue registries
    name every account, and each artist's own history index names every show, so
    the whole store is walkable without the call INVARIANT 1 forbids. And phones
    are counted, never named (9g) — there is no device id anywhere in the export,
    which is the point of the audience never signing in.

0bv. **Anything formula-shaped is escaped.** A song called `=1+1` and an artist
    called `+Plus Band` are both real, and Sheets executes both. Cells starting
    `= + - @` get a leading apostrophe. Google's "RAW" input option still guesses
    at types; it is not an escape hatch.

0bw. **A CAP DEFERS, IT NEVER DROPS — and it says so.** One sync reads 400
    artists and 40 new nights each, and the Growth row's last column reports when
    a cap bit. Two things had to be fixed before that sentence was true:

    · **Take the OLDEST unsynced nights, not the newest.** The history index is
      newest-first, so `.slice(0, 40)` took the newest forty and then set the
      watermark to the newest of *those* — every older unsynced night was
      instantly behind the mark and gone for good, while the code, the result
      note and this very invariant all promised "the rest come next sync". A
      review reproduced it with 45 nights: five lost permanently.
    · **Stop taking artists; never trim rows at the end.** A `trim()` cut every
      tab to 5,000 rows *after* the watermarks had been computed, so the dropped
      rows were behind the mark and nothing reported it. The budget now decides
      which artists a run covers: an artist has all their rows and their mark
      moves, or has none and it does not.

    A silent truncation is how a spreadsheet starts lying.

0bw2. **ONE SYNC AT A TIME.** The 03:20 cron and Perry tapping "Sync now" a second
    later would both walk the store and both append — the same night twice in a
    tab the Guide calls safe to chart. `runningSince` in the sync doc is the lock,
    stale after five minutes so a run that dies cannot wedge it shut. The Studio's
    own busy flag is client-side and cannot help. Note that two calls in the same
    process do **not** reproduce this: with an in-memory store the first finishes
    in about a millisecond and releases the lock. The test holds the lock directly
    instead — racing a scheduler is not a test.

0bw3. **A SWALLOWED PER-ARTIST ERROR MUST BE LOUD.** `syncSheet` catches per
    artist so one unreadable account cannot cost the other 399 their rows — and
    that catch turned a plain `ReferenceError` in my own code into "some columns
    are empty", which took a debugger to find. The reason now goes in the row
    (full width — a short row silently shifts every column after it), in `broke[]`
    on the result, and in the log.

## Locked features, and the two traps under them

0bx0. **THE PLAN CARDS ARE THE ONE PLACE THIS MATTERS MOST.** They are where
    somebody decides to spend $20, and they were the last place still selling the
    four unbuilt Pro features as if they were included — 0by applied everywhere
    except the page it exists for. `soonTag()` marks them.

0bx1. **LOCK ONLY WHAT THE SERVER ACTUALLY REFUSES, and only WHERE it refuses.**
    Three near-misses, all found by review:
    · `unlimited` has no plan gate at all — "everyone votes as much as they like"
      is running your show, not pricing it — and wrapping the whole free-votes
      block in one `lock('pricing')` quietly took a working control off every free
      artist. Greying something that works is the same class of lie as showing
      something that doesn't.
    · `askSet` is gated only on a COST change, so the on/off toggle stays live and
      only the cost chips are greyed.
    · `seats` is 1 on free AND Plus, so the first seat is free everywhere; the
      control greys at the cap, not before it.

0bx2. **A LOCK THAT DOES NOT KNOW THE PLAN YET IS AN OPEN DOOR.** `has()` treats
    an unknown plan as allowed, so there is no grey flash on load — which meant
    the FIRST render of Settings or Setlist showed every locked control fully live
    and tappable, and the server answered 402. 0ad narrowed to a window is not
    0ad closed. `planGet` is now fetched on every first load, not only on the
    Settings tab, and any tab repaints when it lands.

0bx. **A locked feature is SHOWN, greyed out — never hidden, and never live-then-
    refused.** Perry's call, 2026-09-03. It also fixed a real shrug: the Studio's
    pricing controls were fully tappable on free and the server refused them with a
    402, which is exactly what 0ad exists to prevent. `pointer-events: none` on the
    greyed content is the lock; the opacity is only how it looks, and a lock that is
    only opacity is not a lock.

0by. **DESIGNED-BUT-NOT-BUILT IS GREYED FOR EVERYONE, INCLUDING PRO.** `promote`,
    `analytics`, `presskit` and `branding` are in the plan table and nowhere else
    in the code; `reviews`, `tips` and `speakerVotes` likewise on the venue side.
    They are named in `NOT_BUILT` (`_plan.mjs`) and `VENUE_NOT_BUILT`
    (`_venues.mjs`), which both Studios read so those rows say "Coming soon"
    regardless of plan. **Perry is comped to Pro** — without those lists he would
    open his own Studio, see four features presented as his, and find four dead
    ends, and so would the first artist who ever pays. Deleting a name is the LAST
    step of building the feature. `test/limits.mjs` asserts that anything *not* in
    the list is genuinely enforced somewhere, so it cannot rot in either direction.

0bz. **A shared set of valid NAMES is not a limit on anybody, and there are TWO
    photo caps.** `SLOTS` in `_img.mjs` listed `p0..p2`, which was accidentally
    doing double duty as the artist's cap. Widening it to `p0..p11` for venue Pro
    removed a guard nobody had written down — and then a review found the mirror
    image on the other side. Both halves are the same mistake:

    · An **artist** could suddenly store nine images `normProfile` trimmed away on
      every read: bytes in Blobs, referenced by nothing.
    · A **venue on Pro** could upload photos 4 to 12, be told "Photo added", and
      have them discarded by `normVenue`'s `.slice(0, 3)` on the very next read.
      Worse than a 402, because it looked like it worked.

    So the two caps live where the answer is known, and both are now written down:
    **how many a record may HOLD** is a storage question — `MAX_PHOTOS` in
    `_profile.mjs`, the highest of `VENUE_PLANS` in `normVenue`. **Who may WRITE
    the fourth** is a permission question — `admin.mjs` for an artist, the venue's
    plan in `venueadmin.mjs`. An earlier comment in `_img.mjs` named only the
    second and called it "the cap that matters", which is how the first was missed.

0bz2. **PHOTO SLOTS ARE ADDRESSES, so the blanks have to stay.** Both
    normalisers ran `.filter(Boolean)`, which COMPACTED the array — so a venue
    with p0 and p2 filled stored `["/zero","/two"]` and the Studio then drew p2's
    picture in slot **p1**. Clearing one photo appeared to move another. Only
    *trailing* blanks are dropped, so the array still stays short when it can.

0ca. **A numeric limit is not a yes/no.** `photos` is 3 or 12 and `featured` is 50
    or unlimited, so `limits[flag] === true` was false for both and a Pro venue saw
    a dash beside twelve photo slots it fully had. "Has it" means "has as much as
    the top plan gives". Unlimited arrives as `null`, because `shapeLimits` maps
    `Infinity` to `null` so it survives JSON.

0cb. **CSS FOR A PAGE HAS TO BE IN A FILE THAT PAGE ACTUALLY LOADS.** The
    locked-feature rules were first written into `app.css`. It looked obviously
    right and did nothing whatsoever: **neither Studio links `app.css`** — they are
    self-contained pages with their own inline styles — and the Studios are the only
    two pages with a lock. It was believed until computed styles were measured in a
    real browser. `public/lock.css` is now linked by both, and the test checks the
    `<link>` in both pages rather than the existence of the rules somewhere.
    A `grep -l app.css public/*.html` hit does not mean a page loads it; a comment
    mentioning the filename matches too. That is exactly how this was missed.

0cc. **Both Studios are unconditionally dark.** Neither has a
    `prefers-color-scheme` block anywhere. A veil that lightened itself for a light
    system theme washed out a page that was still black. There is no light mode
    here to serve.

## Refreshing

0cd. **AN INSTALLED APP HAS NO RELOAD, so it has to be given one.** No address
    bar, no reload button, and on iOS no swipe-down gesture — a page showing
    something stale had no way out except force-quitting. `public/pull.js` is ONE
    implementation for all seven pages; `vote.html`'s own copy was deleted rather
    than left beside it (12b).

0ce. **A pull cannot rescue broken JavaScript**, which is the exact case somebody
    most wants a reload. So it is not the only escape: `sw.js` serves navigations
    network-first, and Settings has a plain reload plus `hardReset()`, which drops
    every cache and sends the `myset-unregister` message `sw.js` has listened for
    since it shipped and never had a button for. Neither touches songs, votes,
    money or the sign-in token — a fix that signs somebody out mid-gig is not a fix.

0cf. **The browser's own gesture is deliberately NOT suppressed.**
    `overscroll-behavior-y: contain` would stop Chrome's native pull-to-refresh
    double-firing with ours — and would also mean no refresh gesture at all if
    `pull.js` failed to load. A tidier animation is not worth losing the fallback.
    `pull.js` is therefore loaded **blocking, not deferred**: every page calls
    `MySetPull()` from an inline script, and a deferred script runs after all of
    those, so `defer` made the function undefined at the moment it was called and
    the gesture silently never armed.

## Keys

0cg. **A JWK scalar is the FULL coordinate size, always.** `createECDH(...)
    .getPrivateKey()` returns the minimal big-endian encoding, so a P-256 key whose
    top byte is zero comes back 31 bytes — about one in 256 — and RFC 7518 6.2.2.1
    requires `d` to be 32. Node may accept it, mangle it, or throw depending on
    version, and the only symptom would be push quietly not working for whoever
    generated that key. `pad32` is applied where a key is made AND where one made
    elsewhere is read back. The test that caught it passed a hundred times and
    failed once; it now generates 600 keys so the flake is deterministic.

0ch. **A source label is REJECTED when it is wrong, never mangled into shape.**
    `cleanSource` stripped the punctuation out of whatever arrived, so a pasted URL
    became a 40-character run of host-plus-path-plus-query with the slashes gone —
    not a label, and still carrying the trail the function's own comment promised
    not to keep. Anything URL-shaped now returns empty.

0cj. **Netlify blocks HTTP invocation of a scheduled function — measured, 403.**
    `POST /.netlify/functions/sheetcron` against production on 2026-09-03 returned
    403, not a sync. That is the answer, but it is Netlify's implementation detail,
    so `sheetcron.mjs` keeps its own `MIN_GAP` rate limit as belt and braces. The
    guard that matters is that neither of them can break the schedule: enforcing
    the scheduler's `next_run` marker WOULD, silently, the day Netlify changed its
    shape — so that marker is logged and never required.

    Note also that `curl -o /dev/null -w %{http_code}` is useless for checking
    whether a file deployed here: the `/:slug` redirect answers 200 with
    `artist.html` for any missing path, so a missing `/pull.js` looked present.
    **Check the CONTENT after a deploy, never the status code.**

0ci. **The globals list in `test/cost.mjs` has to be kept current.** It is the
    guard 9d13 built to catch a second global document landing on the poll, and it
    did not include `sheetsync` on the day that shipped. Off every hot path, so no
    ceiling moved — but the check that would have TOLD us was silent, which is the
    only thing a guard is for.

## The community page, the shop, and shows that start themselves (2026-09-04)

0ck. **The community page is free on every plan, and the room writes it.** Posting,
    rating, photos, video links, likes and reports need no sign-in (9g) and cost
    nothing (0w). A post carries the device id and nothing else, and the device id
    never leaves the server: the public shape and the owner's shape both strip it
    (0bu). Limits are enforced inside the CAS, never only in the page (15k): three
    posts a day per phone, one per show per phone, a per-network ceiling wide
    enough that a whole bar on one wifi never hits it.

0cl. **Video is a link, never an upload.** A function body tops out around 6MB and a
    phone video does not. YouTube embeds through the profile's exact-host parser
    (9b); Instagram and TikTok are shown as links, because framing them would need
    the CSP widened and MySet never fetches a stranger's URL (0al). Anything else is
    refused with the three names.

0cm. **Merch is priced from the record, never the request.** `kind: 'merch'` in
    `pay.mjs` reads the item off the profile; a fake price in the body changes
    nothing. A pickup item asks Stripe for no address; a posted one does. The
    charge is a direct charge with the plan's cut, like a tip (0r0). Redeeming it
    writes an ORDER inside the same claim, so a session can never be claimed
    without one — the order is the delivery, `delivered: true`. **No buyer name,
    email or address is stored**: `orderDetail` fetches them from Stripe when the
    artist opens an order, reading both shipping shapes, and keeps nothing.

0cn. **Merch is a Plus feature for artists and Pro for venues; removing is never
    gated.** `merchAllowed(aid, limits)` is the one rule (founder included, as with
    pricing); `merchSave` and `merchPhoto` refuse with "Merch on your page is a Plus
    feature — anything you already added stays." A lapsed plan HIDES the rail on
    the page and keeps the items (0s). A venue item must carry a link — a venue has
    no payout account, so buying through MySet would put its money in the wrong
    balance (0r, 0x). `reviews` left `VENUE_NOT_BUILT` the day the feed shipped and
    is true on both venue rows: what the room reads cannot be Pro-only.

0co. **A merch picture's slot is the item's own id; a post's photos are
    `<postId>_<n>`.** Two more slot families in `_img.mjs`, by pattern, so a picture
    can never outlive its record by name; deleting the record deletes the bytes.
    `idcheck` matches neither, so the ID photo stays unservable (0bk).

0cp. **The schedule reads one document to learn who is due.** `gigsched` is a global
    index rewritten by every calendar write (the `cityindex` pattern, 0i) and
    re-pointed by the sweep after it acts; it is in `test/cost.mjs`'s globals list
    (0ci). A ring with nothing due is one read. The sweep is bounded per run and
    defers the rest (0bw); it never `list()`s (1); the audience poll is untouched —
    nothing flips on a fan's GET, ever (0af, 0bt). One run at a time, MIN_GAP,
    logged marker, never thrown — the `sheetcron` discipline (0cj, 0bw2).

0cq. **"Fans" counts phones that were in the room.** The artist page's `Fans` is the
    sum over archived shows of phones present (or peak voters for older nights).
    Nothing anywhere says "follow"; there is no follower count (0bh, 9g).

## Plans that are paid for, venues that are paid, and accounts that can leave (2026-09-04, pass two)

0cr. **Stripe is the source of truth for a paid plan; the registry is a mirror.**
    `billing_<owner>` holds pointers (customer, subscription, price key, period end),
    never amounts. The plan on the registry row is written only by
    `syncSubscription`, `finishCheckout`, a comp, or a webhook — and every reader
    (`planForArtist`, `venuePlanOf`) is unchanged, which is why nothing else had to
    move. `ACCOUNTS.md` §2.

0cs. **Two ways to learn the truth, neither trusted alone.** Webhooks update the
    plan; the return trip (`planFinish`) reads the Checkout session *from Stripe by
    id* and checks `metadata.owner`; `maybeSync` re-reads the subscription at most
    every six hours. `?sub=done` in a URL changes nothing by itself. A dropped
    webhook costs at most six hours, never a plan.

0ct. **Leaving a paid plan never takes back a paid month.** Downgrade to free is
    `cancel_at_period_end`; paid → paid is a price swap with proration. The plan on
    the row keeps a three-day grace after the period end for a late renewal.

0cu. **The retention offer is once, ever, and Stripe bills it.** 50% off one month
    is a coupon applied to the live subscription (`myset_stay_50`), recorded as
    offered and as used on the billing doc, and refused server-side the second time.
    The app never "remembers to charge less" itself.

0cv. **Prices by lookup key, never by `price_…` id.** `myset_plus_monthly`,
    `myset_pro_monthly`, `myset_venue_pro_monthly`, created on first use from the
    `PLANS` / `VENUE_PLANS` amounts. A price changed in the Stripe dashboard moves
    with its lookup key.

0cw. **One owner string, two kinds.** Billing and Connect take an artist id or
    `v_<venueId>`; `isVenueOwner()` is the only place the difference is decided.
    Venue Connect is the artist flow keyed differently, not a fork (0r, 0x still
    hold: a fan's money goes to a real account or nowhere).

0cx. **The fee split is arithmetic on the application fee, and it floors at zero.**
    For a plan row with `splitFee`, `feeCents = max(0, floor(amount × cut) −
    round(stripeEstimate / 2))`, `stripeEstimate = round(amount × 0.029 + 30)`.
    Venues split, artists do not. It is an estimate at checkout and the Studio
    says so; an exact split would be a post-charge transfer (`ACCOUNTS.md` §3).

0cy. **Every per-artist key is enumerated in one place.** `keysFor(aid)` in
    `_account.mjs` is the list; delete walks it, never `list()` (1). A new
    per-artist document or image slot must be added there, and `test/billing.mjs`
    fails if any key still carries a deleted artist's id.

0cz. **Export never names a fan; delete never touches the founder.** Device ids are
    stripped from tips and orders before export (0bu). `accountDelete` needs the
    word `DELETE`, refuses members (403) and refuses `DEFAULT_ARTIST`. The registry
    rows go last, so a token presented mid-delete finds nothing left to act on.

0da. **The plan sheet lists every tier in full.** Never "everything in Plus"; the
    fee line reads "Transaction fee: N%" in orange; the testimonials array is the
    architecture (empty it and the section disappears; placeholders are labelled).
    Top right of both Studios: `Upgrade ↗` on free, a green tag with the plan's
    name and the same arrow when paid. Settings holds one big green button.

---

## An account somebody can actually own (2026-09-05, pass three)

0db. **A role is checked, not just stored.** `byEmail[email].role` has always been
    written and, outside four hand-written checks, was never read — so a member on
    a five-seat Pro page could delete the owner's sign-in address or rename the
    public page every printed QR code points at, with one POST each. The venue side
    had the identical hole. `can(role, capability)` in `_session.mjs` is the one
    table; `admin.mjs` and `venueadmin.mjs` each gate once, by name. An UNKNOWN role
    falls back to `crew`, the least it could be — and the lookup is an own-property
    check, because `CAN['toString']` is a truthy inherited Function with no `.has`.

0dc. **Money and the account are the owner's.** Checkout, plan changes, the
    retention offer, the Stripe portal, invoices, payout onboarding, export and
    deletion are owner-only on both sides. `planGet` stays open to every role —
    a member needs the limits or every locked control renders live on first paint
    (0bx2) — and the renewal date, the portal flag and the card's state are
    stripped from that payload for anyone but the owner.

0dd. **Signing out signs you out.** A token carries a session id (`email|exp|rev|sid`,
    popped from the END so nothing inside an address can shift the fields — and
    `normEmail` strips `|`). Revocation is a normally-ABSENT `dead` map on the
    registry row the verifier already holds: zero extra reads, zero extra writes,
    and no growth for an account that never revokes. Past twelve entries it bumps
    `rev` instead — more revocation than was asked for is the safe way to fail.
    Before this, "Sign out" cleared localStorage and the token stayed valid for the
    rest of its thirty days.

0de. **The session list is cold and it never lies.** `sess_<owner>` is read only
    when the sessions screen opens. It holds a device CLASS ("iPhone · Safari"),
    never a raw User-Agent and never an IP. "Last opened Settings" is written at
    most once an hour, from actions the Studio already calls — it is labelled that
    way because a "last used" built from that number would be false.

0df. **There is a way back in.** Eight one-time recovery codes, hashed with the
    site secret, shown once. The door takes the PUBLIC page name plus a code, reuses
    the existing `lock_<aid>` lockout, and answers a wrong code, an unknown page and
    a locked-out page identically (9h). Using one bumps `rev`, then mints a fresh
    session for the device that used it, and emails every address on the account.

0dg. **Changing your sign-in address needs BOTH inboxes.** A code to the new one
    proves nothing on its own — the attacker owns it. The old address is also mailed
    a notice at REQUEST time, so an owner hears about a stolen session while there
    is still something they can do. The swap and the session kill are ONE
    `mutateArtists`; only the moved address's devices die, so a bandmate running the
    screen at 11pm is left signed in. One change per 24 hours.

0dh. **Delete keeps everything for thirty days, and the data never moves.** Two
    screens plus the typed word. Day one: the page goes dark (`publicArtist` and
    `venueBySlug` refuse a marked row, which 404s every public endpoint at once),
    billing is cancelled, the calendar is un-indexed. Sessions are NOT killed and
    `rev` is NOT bumped — soft delete locks the account DOWN, never the owner OUT.
    Everything but undo, export, the plan and the portal answers 423. The purge is
    one account per cron ring, hourly watermark, after the show sweep; the
    `delqueue` entry is removed LAST, so purge is re-runnable by construction.

0di. **A held slug, and an old slug that keeps answering.** A page name is printed
    on QR codes stuck to bar tables. Deleting holds it for the whole window (freeing
    it would make Undo a promise the system cannot keep, and would land a room full
    of people on a stranger's setlist); renaming keeps the old one resolving through
    `oldSlug`. Neither is claimable while it is there — `pickSlug` and `setSlug`
    both refuse a name already in `bySlug`.

0dj. **Last night's show must not swallow tonight.** `autoTick`'s start branch
    answered a flat "already live", so once a show failed to end itself every
    following gig did nothing and five nights were appended to one. A live show that
    began before tonight's window is not tonight's show: end it, file it, carry on.
    And a deferred end is TRIED AGAIN — `sweep` used to re-point the entry at the
    next gig, so tonight was never due again — with a six-hour backstop, because a
    `nowPlayingAt` that stale means somebody walked away from the tablet.

0dk. **An index row never goes down, and a night on disk is findable.** The detail
    write already refused a poorer snapshot; the index write did not, so a night
    ended twice kept thirteen songs on the detail page and a row that said five.
    Every field is now a max against what is there. `histids_<owner>` is
    append-only and is what export and delete enumerate, because the index is capped
    at 400. `healHistory` rebuilds rows from ids named in the index, in
    `histids_`, in `histpend_` (an index write that failed) and in the pre-multi-
    tenancy flat keys — and it obeys the same "a night where nothing happened is
    not a night" rule the archive does, so the two can never disagree.

0dl. **Money must never be able to lose a night.** `moneyForShow`'s Stripe setup sat
    OUTSIDE its own try, so a payments hiccup threw past `archiveShow` into an empty
    catch and the whole gig was never archived and never logged. It is inside now,
    the caller catches too, and a show with no `startedAt` is not priced at all
    rather than asking Stripe for everything since the epoch.

0dm. **The card that didn't go through is said out loud, once, and never on stage.**
    `billingStatus` carries `pastDue` and `graceUntil`, so the banner costs no extra
    call. It is suppressed over a live show except in Settings (16). `unpaid` counts
    as subscribed for the already-subscribed refusal — without it a failing card
    could produce TWO live subscriptions — and does not count as paid.

0dn. **Coming back from the Stripe portal re-reads Stripe.** `maybeSync` waits six
    hours; somebody who has just fixed their card must not still be told it failed.
    The portal returns with `?billing=back` and the Studio calls `planSync`.

0do. **The exact fee split pays the venue and never bills them.** `charge.updated`
    (not `succeeded` — with async capture the balance transaction is null there);
    the balance transaction read WITH the connected account in scope and the
    application fee WITHOUT it; Stripe's own fee from `fee_details[stripe_fee]`,
    never `bt.fee`, which on a direct charge also contains ours; converted with the
    balance transaction's own rate or recorded as unconvertible, never guessed;
    settled with `applicationFees.createRefund`, never `transfers.create`, which
    Stripe refuses cross-border and MySet's venues are Thai. Claimed is not
    delivered (7b), keyed by charge id in `meta_<owner>.fees`, with a Stripe
    idempotency key over the same id.

0dp. **Nothing in MySet is white while it loads.** Every page paints black from its
    first frame, both Studios carry the same three-bar splash, and an internal link
    paints it before the browser starts tearing the document down. The pull-to-
    refresh gesture stands down while a sheet is open — both handlers used to fire,
    so dragging a sheet closed also reloaded the page behind it. A sheet's
    `closeSheet` must clear the inline transform its own drag left, or the sheet
    sticks halfway and the ✕ looks dead.
