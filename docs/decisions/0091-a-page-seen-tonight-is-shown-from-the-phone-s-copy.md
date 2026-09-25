---
id: 0091
title: A page seen tonight is shown from the phone's copy and refreshed behind it
date: 2026-09-25
status: decided
decided_by: perry
area: performance
reverses:
superseded_by:
invariants: [0ax, 0ce]
commits: []
tests: [test/sw.mjs]
files: [public/sw.js, test/sw.mjs, test/run.sh, netlify.toml, INVARIANTS.md, AGENTS.md, public/pull.js, FINGERPRINTS.md, tools/mock.mjs]
---

## The question

The first-open speed pass (0088) measured every page's HTML at 0.42–1.36 s to first
byte on production, an edge lottery of per-node copies, and the service worker asked
the network for every navigation (0ax as it stood: network-first, so a bad deploy is
fixed by the next deploy and never by a settings screen). The browser's own cache
covers a page for a minute (0048; Chrome adds up to ten minutes of its own
stale-while-revalidate, Safari does not), and after that minute the HTML wait was the
one cost a returning phone paid on every open — artist page to vote page to community
page and back, each a blank second on bar wifi. 0088 listed serving
navigations stale-while-revalidate as option C and left it to the founder, because
`sw.js` is do-not-touch and the rule it would change was written to protect a room
from a stale app. The founder chose it: "let's do the service worker
stale-while-revalidate next."

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | A page this phone fetched in the last six hours is shown at once from its copy and re-fetched behind; older or unseen pages wait for the network, the copy only when there is no signal | a deploy during a gig reaches a phone that already opened the page on the open after next, not the next | one constant (`FRESH`), one header stamped on the way into the cache, a test that runs the real worker | a bad deploy stays on a phone one open longer, for at most six hours |
| B | Stale-while-revalidate always, no age | a fan back after a month sees a month-old page first; "a deploy lands on the open after next" is true forever, with no bound | none | a bad deploy stays on a rarely-opened phone until its second open, whenever that is |
| C | Keep network-first, add navigation preload so the worker's own start-up overlaps the fetch | tens of milliseconds at most; the HTML wait itself stays | a preload flag on activate | none |
| D | A, plus the worker tells the page when a newer copy arrived and the page reloads if idle | code in nine pages to decide "idle"; a reload during a vote is exactly the thing 0ce forbids | a message channel, a per-page idle rule | a fan's tap lands on a page that just reloaded under it |
| E — do nothing | | every open of every page waits for the edge lottery | none | none |

## What was chosen, and why

A, because the founder said so, and because six hours keeps a sentence true that the
old rule cared about: a deploy is on a phone by the open after next during a gig and by
the next open the next day, and no fan is ever asked to clear a browser. A gig night is
under six hours, so within a night every page after the first is instant; the next day
the network goes first again, so a phone that comes back in a week does not see a
week-old page. The copy is keyed by path, because the query never changes the HTML
(`?paid=`, `?tab=`, the return links); a redirect or an error page is never stored,
because a stored redirect cannot be handed to a later navigation and an error must never
become the copy a phone falls back on.

Three rules ride with it, two of them found by the fresh-context review of the first
cut. **A deliberate reload asks the network first**: a pull (`pull.js`) and the
Studio's *Reload* button call `location.reload()`, and the browser marks that request
`no-cache` (a hard reload, `reload`); those go network-first even with a copy from
tonight, so the reload stays the escape 0ce promises — without this the pull, the
only hatch a fan has, would have landed on the copy. **A page that says `no-store` or
`private` is never stored**: the money model is a passcode-gated function page
answering `private, no-store`, and a stored copy would have been shown for six hours
without its gate, including after the passcode was entered correctly (the form) and
after signing out (the model). **A hash-stamped file (`?v=…`, served immutable) is
never re-asked once held** — load-bearing, not tidiness: a stored page names the stamp
it shipped with, and the old rule's background re-fetch of that name would have been
answered with the *current* file (Netlify ignores the query), pairing an old page with a
new script for every open of the rest of the night. Every cache call is guarded, so a
refused or broken cache store answers the page from the network rather than failing
it; the six hours count from the last open, not the first; and the refresh of a static
file is held open with `waitUntil` so the worker is not put to sleep before it lands.

## What this makes harder

A deploy is no longer "on every phone at its next navigation". A phone that opened a
page in the last six hours shows that copy once more; the fix for a bad deploy is still
the next deploy, one open later. The escape hatch is unchanged: a page can post
`myset-unregister`, and the Studio's *Clear what's stored on this phone* does. There is
one edge: if a phone has lost both the worker's and the browser's copy of an old stamped
script but still holds the old page, Netlify serves the current script under the old
name for that one open — the page and the script could disagree for a single open, and
the refresh behind it heals it. That case needs two caches evicted and a deploy in
between; it was not reproduced.

## What would reverse it

A bad deploy seen during a show that needed the six hours to pass rather than the next
open. Or Netlify's HTML first byte falling under ~150 ms from where MySet's rooms are,
which would make the copy worth less than the rule it bends.

## How it was verified

`node test/sw.mjs` — 33 assertions, 0 failed: the real `public/sw.js` run inside a fake
browser (a cache store, a fetch that the test controls, the fetch/install/activate
handlers called directly). Nothing under `/api` is answered by the worker, not as a
navigation and not with a static extension; a POST and a cross-origin request pass
through; nothing is stored at install; an unseen page comes from the network and is
stored by path with its arrival time; a page seen tonight is shown from the copy and
re-fetched behind with the refresh held open; the open after next has the newest; a copy
five hours old is still tonight, six hours and a week are not; a `no-cache` or `reload`
request goes to the network with a copy from tonight, a `force-cache` one (back/forward)
takes the copy; no signal serves the copy at any age, then the front door, then the *No
connection* page; a redirect, a 500, a `no-store` page and a `private` page are answered
but never stored; a throwing `caches.match` or `caches.open` still answers from the
network; a seen static file is instant and refreshed behind; a stamped file is never
re-asked; activate deletes every other cache. **Mutation-checked**: with the `/api`
guard deleted 5 fail; without the age check, the reload rule, the no-store rule or the
stamped rule 2 each; without the redirect guard or the `waitUntil` 1; with the cache
lookup unguarded the run crashes. The first cut's `/api` assertion was vacuous (found by
the review); it is not any more.
`node tools/overview.mjs --tests` — 3,535 assertions, 0 failed, with the new file in it.
In the app's browser against `tools/mock.mjs` (the worker registered by hand, since
pages only register on https; the mock's pages now say `no-cache` rather than
`no-store`, because the worker refuses `no-store` and production's pages are `public,
max-age=60` — checked with read-only GETs of `/`, `/studio`, `/venues`, an artist page,
its vote page, `/about` and `/moneymodel`, the last the only `private, no-store`): the
artist page's first open 101,281 bytes over the network and the copy stored under its
path with `x-myset-stored`; the second open, with a different query, 0 bytes transferred
and the page whole (title, `fan.js` present); a `location.reload()` — navigation type
`reload` — 101,281 bytes again, so Chrome does mark a reload `no-cache` and the worker
does go to the network for it; the open after that 0 bytes again; the vote page 117,484
bytes then 0, the board rendered both times; the cache held pages and static files
only, no `/api` entry; no console errors; `myset-unregister` dropped the worker and
reloaded the page; the first cut's check, before the review, had shown the same
first/second shape. A fresh-context review of the first cut found the
money-model page stored without its gate, the reload landing on the copy, an unguarded
cache lookup, the vacuous `/api` assertion and seven stale sentences (`pull.js`, six
pages' registration comment, `FINGERPRINTS.md`, `netlify.toml`'s claim that HTML is
`must-revalidate` — it has been a minute fresh since 0048); all fixed in this tree.
NOT checked: production — the worker is not live; a real phone on bar wifi; whether
Safari marks a `location.reload()` navigation `no-cache` or `reload` (Chrome does — both
go network-first; verify once on an iPhone when it ships).
