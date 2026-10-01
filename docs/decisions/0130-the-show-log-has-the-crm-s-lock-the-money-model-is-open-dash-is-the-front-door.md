---
id: 0130
title: The Show log has the CRM's lock, the money model is open, and /dash is the front door to all four dashboards
date: 2026-09-30
status: decided
decided_by: perry
area: auth
reverses:
superseded_by:
invariants: []
commits: [3cbf332]
tests: [test/everyshow.mjs]
files: [netlify/functions/_showlock.mjs, netlify/functions/_hqlock.mjs, netlify/functions/moneymodel.mjs, finance/shows.html, public/dash.html, netlify.toml, netlify/functions/_auth.mjs]
---

## The question

The money model and the Show log (the register, /moneymodel/shows) stood behind one
courtesy code whose fallback is written into this public repository. The founder,
2026-09-30: remove the passcode on the money model ("there's nothing there that needs
security"), keep one on the Show log ("that definitely needs one"), built "the exact same
way and style" as the CRM's; and make one page for all the dashboards at /dash, with no
passcode.

## What was chosen, and why

- **/moneymodel and /moneymodel/live.json are open.** The model reads the feed with no
  cookie; /dash reads it too.
- **Every /moneymodel/shows address is behind the CRM's door** (`_showlock.mjs`): the same
  passcode (HQ_PASSCODE, scrypt, checked on the server), its own count of wrong tries
  (`showlock`: five in a row shut it for fifteen minutes and tell the founder's phone,
  without locking the CRM), and its own cookie `slk` (HttpOnly, SameSite=Strict, twelve
  hours, signed with the auth secret and bound to the passcode, Path=/moneymodel because a
  cookie path of /moneymodel/shows would not reach /moneymodel/shows.json). No passcode set
  (a deploy preview) means shut. There is no Studio sign-in behind it, unlike the CRM: the
  Show log sends nothing and erases nothing.
- **The lock screen is the CRM's**, lifted whole and served by the server in place of the
  page. A Lock button on the Show log clears the cookie.
- **/dash** (`public/dash.html`) is open: four windows in the founder's order — Show log,
  Media Dash, CRM, money model. The only numbers on it come from the two public feeds; the
  drawings are drawings. `dash` is a reserved slug.

The passcode the founder already uses daily is the CRM's, so the Show log asks for it
rather than for a second code he would have to set from a terminal. The old courtesy
code's fallback is public, so it could not be the lock that "definitely" protects the
nights and the money.

## What this makes harder

`_passgate.mjs` now only lends its headers; its `gate()` is unused. A new CRM passcode
locks every open Show log as well as every open CRM.

## How it was verified

test/everyshow.mjs, THE DOOR: every Show log address refuses without the cookie; the model
is open; the CRM passcode sets `slk`; five wrong tries shut it while the CRM's own door
stays open; Lock clears the cookie; no passcode set means shut. Locally (tools/localhost.mjs)
in headless Chrome: a wrong try shakes and counts down, the right one opens the Show log,
/moneymodel opens with no passcode, and /dash renders in both themes and at phone width.

**Renumbered 0127 → 0130 on 2026-10-01:** this record merged as 0127 in PR #178 while the sessions board had 0126–0129 held for the venue batch (PR #177, merged after it). Only the number moved.
