---
id: 0093
title: The community page reads a shared copy and wears its own marks
date: 2026-09-25
status: decided
decided_by: perry
area: scale
reverses:
superseded_by:
invariants: [0gg]
commits: [ebdce9e]
tests: [test/community.mjs, test/fandoor.mjs]
files: [netlify/functions/community.mjs, netlify/functions/_community.mjs, netlify/functions/fan.mjs, public/community.html, tools/mock.mjs]
---

## The question

The community page asked one question with the phone's own id on it — "everything about
this artist, and which posts are mine and liked" — so every phone asked a different URL,
nothing could be kept at the edge, and every open paid the whole read: the registry twice,
the profile, the show, the diary, the history index, the posts and the likes, 0.55–0.73 s
with `fwd=bypass` in 0088's measurements. The vote page had the same shape once and was
split in 0034 into a shared board and a tiny personal call. 0088 listed the same split
for the community read as option D and left it to the founder; he chose it.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Two reads side by side. The SHARED one carries nothing personal — every phone asks the identical URL, the edge keeps one copy for 30 s and serves it stale 30 more — and the PERSONAL one answers only which posts are this phone's (and still editable), which it liked, and whether it may post. The page paints from the first and wears the second when it lands; the old whole reply stays up for pages a phone kept | a second request per open; the marks can land a beat after the list (♡ → ♥); a poster's own copy must outrank an older shared copy | one small handler, `wear()` on the page, an `at` stamp | something personal slipping into the shared read and reaching the edge — the test refuses `mine`/`editable`/`liked`/`canPost` there |
| B | Owner first, posts second — two shared reads | the header paints a beat before the feed; the feed still waits for its own read | two cached endpoints | nothing is faster than A for the feed, which is what the page is |
| C | Purge the edge copy on every write (Netlify's cache tags) | a call to Netlify's purge API from every post and like; not testable here | a purge token and a call site | a purge that fails leaves a poster looking at a copy without their post |
| D — do nothing | | every open pays the whole read, uncached | none | none |

## What was chosen, and why

A, because the founder said so and because 0034 already proved the shape on the page
that matters most. The shared read is the old reply with the marks off: `canPost` true
for everyone, `mine`/`editable`/`liked` false on every post, made without looking at any
token — an artist's own token must change nothing in it, or the artist's copy would reach
the edge and every fan would lose the composer. The personal call reads the registry to
resolve the slug, then the posts and the likes, and nothing else — never the profile,
the show or the diary the shared read pays for; it says no-store twice.

Two things keep the split honest on the phone. First, a poster's own copy outranks an
older shared copy: every reply that carries the list says when it was made (`at`), the
page keeps the newest list it has seen — with its stamp, so the next pull keeps it too —
and so a post just made does not vanish on a pull while the edge still holds the copy from
before it. (The first cut kept the list but not its stamp, which protected exactly one
pull; the line-by-line review caught it.) Second, the marks the phone
already knows are worn on the shared read the moment it lands — from the copy it last
saw — so a returning fan's hearts do not blink off and on while the personal call is on
its way; the personal call then corrects them, and the page redraws only if a mark
changed.

The old whole reply (`?fan=` with no `me=1`) stays, personal and never cached, for a
page a phone kept from before this and for the suite.

## What this makes harder

A fan's marks can land a beat after the list on a first visit — only visible to a fan
who has liked or posted on a phone with no kept copy, which is nearly nobody. An artist
opening their own page sees the composer for the beat before the personal call says
they may not post; the server refuses the post either way, and the kept copy fixes it on
the next open. Another fan's new post reaches this phone within a minute, not at once.
`shapePosts` now runs with no fan for the shared read, so anything added to a post's
shape must be asked: is this the same for every phone? If not, it belongs in the
personal call.

## What would reverse it

A post that must be seen by the whole room within seconds of being made — a live
request board, say — would want a shorter window or a purge on write (option C). Or
Netlify pricing the durable cache so that a 30 s copy costs more than the read it saves.

## How it was verified

`node --import ./test/register.mjs test/community.mjs` — 285 assertions, 0 failed,
including the new block: the shared read is kept at the edge (`public, durable,
s-maxage=30`), says when it was made, carries no mark on any post and `canPost` true;
the artist's own token changes nothing in it; the personal call answers `mine`,
`editable`, `liked`, `canPost` for the phone that posted and liked, empty for another
phone, `canPost` false for the artist on their own page, 404 for an unknown page, never
cached, at most 4 reads and no writes; the old whole reply still answers with the marks
on and is never cached. `test/fandoor.mjs`: the page starts the shared read with no
device named and makes the personal call from the head and from `load()`. The app's
browser on `tools/mock.mjs`: the community page fires both reads from the head, paints
the feed from the shared one; the shop page asks the shared read alone. NOT checked:
production, a real phone; the ♡ → ♥ beat on a phone with no kept copy.
