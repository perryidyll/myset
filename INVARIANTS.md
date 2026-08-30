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
    burned ~240 credits in one afternoon on 16 production deploys and blamed the
    polling, which had cost about 5. **Iterate on `netlify deploy` (draft URL,
    0 credits) and deploy to production once, at the end.**

9d. **Every phone in the room polls.** At 3s, a two-hour gig with twenty people
    is ~24,000 function calls — enough to exhaust a month's free tier in a few
    shows, which is exactly what happened on 2026-08-31. `vote.html` backs off
    to 6s then 12s when nothing changes and snaps back on any change or tap.
    Do not reintroduce a fixed fast interval.

## Secrets & publishing

10. **Only `./public` is published.** `publish = "."` once meant docs, backups and
    the design handoff were all downloadable from the live domain. Netlify's
    secrets scanner caught it; do not widen the publish directory.

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

15. **Voting is idempotent per (fan, song).** Voting twice toggles off and refunds
    the credit; it must never double-count.

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

16. **Nothing in the app may break the gig.** Every failure path degrades to "the
    setlist is still readable". No error state should block the page from rendering.

17e. **A JS parse check is not a structure check.** `studio.html` is one big
    `render()` with four `if(TAB===…)` blocks. A bad edit deleted two of them and
    the file still parsed cleanly, because what was left was still valid
    JavaScript. After any edit to it, assert every tab block and every top-level
    function is present exactly once — the check is in the commit history.

17. **Verify from outside after deploying.** Check the live `myset.vip` URLs and the
    API, not the local files.
