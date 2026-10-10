---
id: 0209
title: No page runs code it does not carry — each page names its inline scripts by hash, and its buttons name their actions, never their code
date: 2026-10-10
status: decided
decided_by: perry-confirmed
area: ops
reverses:
superseded_by:
invariants: [0jk]
commits: []
tests: [test/csp.mjs, test/structure.mjs, test/copy.mjs, test/darkroom.mjs, test/password.mjs, test/seatstudio.mjs, test/tipdecks.mjs]
files: [public/on.js, netlify/functions/_csp.mjs, tools/stamp.mjs, public/*.html, public/studio.js, public/venue-studio.js, public/fan.js, public/studio-money.js, public/leave.js, netlify/functions/_passgate.mjs, netlify/functions/moneymodel.mjs, netlify/functions/_showsdash.mjs, netlify.toml]
---

## The question

The site's Content-Security-Policy said `script-src 'self' 'unsafe-inline'`: no script could
load from anywhere else and nothing could be sent anywhere else, but an inline `<script>` that
got into a page — through an escaping slip in any of the hundreds of places a page draws what
somebody typed — would run. The policy could not say more, because the pages ran on inline
code: 487 `on*=` handlers (`onclick=` 453 of them; 360 built inside scripts — `studio.js` 251,
`venue-studio.js` 104 — the rest in the pages), and a CSP hash covers a `<script>` block, never
an attribute. SEC-006 measured that on 2026-10-09 and deferred it as "a pass of its own, after
the secret is live". The secret went live with slice C (`e996865`), and on 2026-10-10 the
founder said *go ahead with the sec-006* and *don't ask me for any more permissions, just go
until the job is done*.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: actions by name, scripts by hash, the policy in each page** | Every `on*=` becomes `data-on-<event>="name"` (or `ON.click('name', …args)` in a script); one listener per page (`public/on.js`, inlined like `app.css`) runs it; each page's `<meta>` names its own inline blocks by SHA-256 | 487 call sites rewritten once; `tools/stamp.mjs` keeps the hashes; ~1.5 KB inline per page | `on.js`, `_csp.mjs`, a registration line per script | A button whose action is not registered does nothing — so the suite refuses an unregistered name, and the error is reported, not silent |
| B — `'unsafe-hashes'` and a hash per handler | Keep the attributes, hash each handler's text | Handlers built at run time (`onclick="f('${id}')"`) have a different text per row — they cannot be hashed at all | A hash list per page that changes with the data | Safari before 15.4 knows hashes but not `'unsafe-hashes'`: every handler dead for those phones — the vote page's buttons for part of a room (rule 1) |
| C — move every inline block into its own file | `script-src 'self'` with no hashes | One more request per page before it can run; the head's theme bootstrap would wait on the network | Twenty more files, and a stamp per file | A slower first paint on a bar's wifi — the founder asked that nothing cost speed |
| D — nonces | A fresh random per response, in the header and every block | Pages are static files from the CDN and the service worker: nothing writes a fresh nonce into them | An edge function on every page | Every page behind one more piece that must answer |
| E — do nothing | `'unsafe-inline'` stays | Nothing | None | An escaping slip anywhere is a script running in a fan's or an artist's browser |

## What was chosen, and why

**A.** It keeps every page one request and lets the policy say exactly what each page runs.

- **The action, not the code, rides in the markup.** `data-on-click="closeSheet"`,
  `data-on-click='["setTab","money"]'`, or a sequence `'[["prevent"],["gate",null,"forgot"]]'`
  — built in scripts as `${ON.click('setTab', tab)}`, which escapes the JSON. The arguments are
  the values themselves, so the old latent quoting bugs are gone with the attributes: an id
  with a `'` in it used to break its own `onclick='…'`.
- **`on.js` binds the listener on the element itself**, the first time an event of its kind
  passes on its way down (a capture listener on `document`), so it fires exactly where the
  `onclick=` fired: after a capturing listener that stops the event (the Studio's swipe tray
  swallows a tap that way), before the ancestors', and on the target alone for focus, blur,
  load and error. Delegation at `document` would have run actions after every listener on the
  way up and changed which ones a `stopPropagation()` blocks.
- **A page registers what its markup may name** — `ON.add({ closeSheet, setTab, … })` at the
  top of each script. They are function declarations, so they exist before that line runs;
  the three that are not (`frSet`, and the media dash's two `window.*` functions) go through a
  wrapper. `this` is the element, as it was; the event is `ON.event`; what an action returns is
  ignored, as it was when an `onclick=` called a function without `return` — an old
  `…;return false` became the step `prevent`, and the venue page's `return jump(id)` became
  `jumpTo`, which prevents only when `jump` says so.
- **The policy rides in each page**, as a `<meta>` right after the charset, written by
  `tools/stamp.mjs` from `netlify/functions/_csp.mjs`: `script-src 'self' 'unsafe-inline'
  'sha256-…'… https://maps.googleapis.com https://maps.gstatic.com`. `'unsafe-inline'` is
  there only for a browser too old to know hashes — every browser that knows them ignores it
  beside a hash (CSP Level 2) — and a page with no inline block would get neither. In the page,
  not the header, because the bytes and their policy then travel together through the CDN and
  the service worker's cache: a stale page never meets a newer policy, and the site header
  (`netlify.toml`, and `artistpage.mjs`'s copy) keeps `'unsafe-inline'` as the floor — a
  browser enforces every policy it is given, so the page's is what binds.
- **The founder's function-served pages** — the passcode door, the Show log's lock, the money
  model and the Show log — send the same policy as their header, worked out from the page they
  send (`cspFor(html)`); the door's Show/Hide moved from an `onclick=` into a hashed script.
- **leave.js's speculation rules** are written out as a string, so the policy can name them by
  hash on the nine pages that load it.

## What this makes harder

- **A new button names an action and registers it.** An `onclick=` is now refused twice: by the
  browser (it runs nothing) and by `test/csp.mjs`. AGENTS.md says so where pages are described.
- **Any edit to an inline `<script>` or to `on.js` needs `node tools/stamp.mjs`** — the same
  habit `app.css` and the `?v=` stamps already ask for; the suite refuses a stale page.
- **Code that runs from a string is out** — `eval`, `new Function`, a string to `setTimeout`,
  a `javascript:` link (there were none; the test keeps it so).
- **A third-party script or an injected snippet** (Netlify's snippet injection, an analytics
  tag) would be blocked unless its host or hash is added — on purpose: the site loads none.

## What would reverse it

A browser the room uses that cannot run the pages under the policy — measured, not assumed —
or a feature that genuinely needs inline code it cannot carry by hash. Then the policy loosens
for that page only; the actions stay as they are.

## How it was verified

- **The conversion:** a one-off codemod (TypeScript's parser over every script; not committed)
  rewrote the 386 handlers that were a plain call with literal or render-time arguments; the
  other 101 were written by hand (custom actions where the old body set a variable, read
  `this`/`event`, or decided). Every script still parses (`node --check`); no registered
  function reads `this` (so binding the element changes nothing for them); every action every
  page can fire is registered on that page.
- **`test/csp.mjs`** (116): no handler, `setAttribute('on…')`, `javascript:` or string eval in
  `public/`; every page's policy and `on.js` copy are current; every action registered, every
  shorthand registration a function declaration; `on.js` on a hand-made DOM (own element,
  once, in order, `prevent`/`stop`, a throwing or unknown action reported); the four
  function-served pages name their own blocks. Each guard was broken on purpose and went red.
- **A real browser:** every page under `tools/localhost.mjs` with the policy enforced — no
  violation, no script error, no unregistered action (`/` … `/venues`, 21 addresses); then a
  differential tap-everything run against `main` (both from the same seed, the same taps in the
  same order, compared after each). Results are in the session record.
- **The Google map, before the deploy:** the new pages and scripts served to one Chromium in
  place of production's, with `/api` and Google's map answered by the real site (reads only):
  `/artists` and `/` — the map loads (`google.maps`, tiles drawn), no violation, no error.
- **Not checked here:** a real iPhone.
