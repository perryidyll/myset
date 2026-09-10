# Decision records

Every engineering decision that changed how MySet behaves, with the options that were
weighed, what each one would have cost, and what would reverse it.

**This file is generated.** `node tools/overview.mjs` rebuilds it from the front-matter
of each record. Edit the records, never this page.

To start a new one: `./tools/decide.sh "a short title"`

| # | Decision | Date | Area | Status | Decided by |
|---|---|---|---|---|---|
| [0001](0001-a-vote-never-comes-back.md) | A vote never comes back | 2026-09-07 | voting | superseded | perry |
| [0002](0002-free-votes-are-an-allowance-for-the-night.md) | Free votes are an allowance for the night, not for each song | 2026-09-07 | voting | decided | claude |
| [0003](0003-the-free-tier-is-capped-by-gigs-not-features.md) | The free tier is capped by gigs played, not by features | 2026-09-03 | plans | decided | perry |
| [0004](0004-locked-features-are-shown-greyed-not-hidden.md) | A feature you have not paid for is shown, greyed out — never hidden | 2026-09-03 | plans | decided | perry |
| [0005](0005-an-unbuilt-feature-is-never-shown-as-yours.md) | A feature that does not exist is shown as "Coming soon" on every plan, including the one that supposedly has it | 2026-09-03 | plans | decided | claude |
| [0006](0006-a-full-room-is-never-refused.md) | A room that is over its plan's size slows down; nobody is ever refused | 2026-09-05 | scale | decided | claude |
| [0007](0007-money-is-charged-on-the-artists-own-stripe-account.md) | Every charge is created on the artist's own Stripe account, not on MySet's | 2026-09-02 | money | decided | claude |
| [0008](0008-never-list-blobs-for-live-data.md) | Every stored key must be computable, because list() is banned | 2026-08 | storage | decided | claude |
| [0009](0009-between-shows-the-room-goes-dark.md) | With no show running, a fan sees the setlist quiet — not last night's board | 2026-09-07 | ui | decided | perry |
| [0010](0010-last-call-is-a-nudge-not-a-lock.md) | The ten-second countdown nudges the room; it does not close voting | 2026-09-07 | ui | decided | claude |
| [0011](0011-clips-go-up-as-they-are.md) | A clip is uploaded exactly as it was filmed; nothing on the phone re-encodes it | 2026-09-06 | media | decided | perry |
| [0012](0012-an-open-line-to-the-room-is-not-next.md) | An open line to the room is the right end state, and not the next thing built | 2026-09-07 | scale | decided | claude |
| [0013](0013-errors-are-reported-to-a-service-that-outlives-the.md) | Errors are reported to a service that outlives the night | 2026-09-08 | ops | proposed | claude |
| [0014](0014-three-free-votes-and-two-new-default-packs.md) | Every room on the former voting defaults moves to three free votes and the two new packs | 2026-09-08 | voting | decided | user |
| [0015](0015-one-live-profile-cta-and-no-duplicate-show-controls-in-settings.md) | The artist profile has one live voting call to action, and show controls are not duplicated in Settings | 2026-09-09 | ui | decided | user |
| [0016](0016-an-artist-declined-unplayed-song-returns-its-votes.md) | An artist-declined unplayed song returns its votes | 2026-09-09 | voting | decided | user |
| [0017](0017-artist-transaction-fees-are-25-10-and-2-5-percent.md) | Artist transaction fees are 25%, 10%, and 2.5%, with the platform-owner account exempt | 2026-09-09 | money | decided | user |
| [0018](0018-song-request-offers-are-authorized-now-and-capture.md) | song request offers are authorized now and captured only after the song finishes | 2026-09-09 | money | decided | user |
| [0019](0019-mood-votes-are-free-requests-and-artists-cannot-po.md) | Mood votes are free requests that let the artist choose the song | 2026-09-10 | voting | decided | perry |
| [0020](0020-artists-cannot-publish-public-posts-on-their-own-a.md) | Artists cannot publish public posts on their own artist page except the founding account | 2026-09-10 | auth | decided | perry |
| [0021](0021-live-shows-end-after-three-hours-without-artist-or.md) | Live shows end after three hours without artist or audience voting activity and are filed with a dated title | 2026-09-10 | ops | decided | perry |
| [0022](0022-automatic-chords-require-a-licensed-feed-or-record.md) | Automatic chords require a licensed feed or recording-derived analysis | 2026-09-10 | media | decided | user-confirmed |

## By area

**auth** — [0020](0020-artists-cannot-publish-public-posts-on-their-own-a.md)

**media** — [0011](0011-clips-go-up-as-they-are.md) · [0022](0022-automatic-chords-require-a-licensed-feed-or-record.md)

**money** — [0007](0007-money-is-charged-on-the-artists-own-stripe-account.md) · [0017](0017-artist-transaction-fees-are-25-10-and-2-5-percent.md) · [0018](0018-song-request-offers-are-authorized-now-and-capture.md)

**ops** — [0013](0013-errors-are-reported-to-a-service-that-outlives-the.md) · [0021](0021-live-shows-end-after-three-hours-without-artist-or.md)

**plans** — [0003](0003-the-free-tier-is-capped-by-gigs-not-features.md) · [0004](0004-locked-features-are-shown-greyed-not-hidden.md) · [0005](0005-an-unbuilt-feature-is-never-shown-as-yours.md)

**scale** — [0006](0006-a-full-room-is-never-refused.md) · [0012](0012-an-open-line-to-the-room-is-not-next.md)

**storage** — [0008](0008-never-list-blobs-for-live-data.md)

**ui** — [0009](0009-between-shows-the-room-goes-dark.md) · [0010](0010-last-call-is-a-nudge-not-a-lock.md) · [0015](0015-one-live-profile-cta-and-no-duplicate-show-controls-in-settings.md)

**voting** — [0001](0001-a-vote-never-comes-back.md) · [0002](0002-free-votes-are-an-allowance-for-the-night.md) · [0014](0014-three-free-votes-and-two-new-default-packs.md) · [0016](0016-an-artist-declined-unplayed-song-returns-its-votes.md) · [0019](0019-mood-votes-are-free-requests-and-artists-cannot-po.md)

## What counts as a decision

A decision record is owed whenever a change **could reasonably have gone another way**
and somebody would later ask why it went this way. Not every commit: a typo fix, a copy
tweak, a test added for existing behaviour are all just work.

Owed:
- anything that changes what a person can do, is charged, or is told
- anything that adds a moving part (a new document, a new vendor, a new background job)
- anything that closes off a future option
- any number somebody could argue with (a price, a cap, a timeout, a cut)
- reversing an earlier decision — which supersedes rather than deletes it

Not owed: refactors that change no behaviour, copy corrections, new tests for old rules.

## Anything not written up

`PENDING.md` collects commits that touched the server and shipped without a record.
The git hook writes it. It is a backlog, not an accusation — but a decision that never
gets written down is one nobody can revisit.
