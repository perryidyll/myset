---
tab: Venue lifecycle
section: Getting verified (three ways)
puzzle_section_id: 41984
sources:
  - netlify/functions/_verify.mjs (MIN_VOUCHES, checkWebsite, tryVerifyByWebsite, fetchPage, addVouch, readVouches, artistPlaysAt, checksOnly, recheck, venuePaid), _venues.mjs (domainMatches, privateHost), venueadmin.mjs (verifyCheck, verifyPreview), admin.mjs (vouch; venueList, venueVerify)
  - VERIFYING-A-VENUE.md (its stale "ten" corrected 2026-09-12 — the page now cites MIN_VOUCHES)
  - MYSET-MASTER-OVERVIEW.md §5.6
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps)
verified: code read 2026-09-12 (_verify.mjs MIN_VOUCHES, checks object, venuePaid gate)
---

# Getting verified (three ways)

**Who:** a venue on a paid plan; artists who play there; the founder as the manual switch. **Trigger:** the checklist at the top of the Page tab. **Outcome:** the grey *Unverified listing* chip becomes a green **✓ Verified** tick — by the venue's own website, by the artists who play there, or by the founder's hand. **Paying opens the door; it never buys the tick.**

The venue sees a checklist, not a yes/no, saying what is missing on every line: *Your page works completely either way — this only changes a grey chip to a green tick. There are two ways to get it, and you only need one.*

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| y01 | Is the venue on a paid plan? | conditional | Automation | MySet server R · Venue manager I | Netlify | `venuePaid(reg.byId[vid])` — the tick is a premium feature (the venue ladder in §2.1). Not paid → the checklist says so and nothing else is tried. `src: _verify.mjs checksOnly; overview §5.6` |
| y02 | Way 1 — is the sign-in email on the website's domain? | conditional | Automation | MySet server R | Netlify | `domainMatches(email, website)`: `manager@uglyduckling.com` against `https://uglyduckling.com`. **Free-mail domains are rejected outright** (gmail, yahoo, icloud, proton…), so this can only ever be a real business domain. `src: _venues.mjs domainMatches; VERIFYING-A-VENUE.md Way 1` |
| y03 | Way 1 — does the website name the venue? | conditional | Automation | MySet server R | Netlify | `checkWebsite` fetches the homepage and looks for the venue's name in the page text — the full normalised name or a distinctive two-word prefix (*The Ugly Duckling* verifies *The Ugly Duckling Irish Pub*). The town is checked and reported but not required. **Both checks must pass** — a domain and an inbox can be bought; the website is just a URL somebody typed; together they mean you control the inbox *and* the site. Runs on saving a website and from *Check my website now* (`verifyCheck`). `src: _verify.mjs checkWebsite, tryVerifyByWebsite` |
| y04 | Fetch a stranger's website safely | task | Automation | MySet server R | Netlify | `fetchPage` — the only place MySet makes an outbound request to a URL somebody typed, so the only place that can be pointed somewhere it shouldn't: https only; the hostname **resolved** and refused if any address is loopback, private, link-local (the cloud metadata endpoint), CGNAT, multicast or reserved, v6 equivalents included; `.local` / `.internal` / `.localhost` / `.home.arpa` refused by name; redirects followed **manually**, at most 3 hops, **each re-checked**; 8-second timeout, 512 KB cap, `text/html` only. Verified against 13 targets including `169.254.169.254` — all refused. `src: _verify.mjs fetchPage; VERIFYING-A-VENUE.md` |
| y05 | Way 2 — an artist vouches | conditional | Person | Artist R · MySet server R | Netlify | The *vouch* button on the venue's public page, **signed-in artists only**. `artistPlaysAt(aid, venue)` checks the artist's **own calendar** server-side for a gig at this venue (matched by name within the city) — an artist with no gig listed there simply cannot vouch; nobody can vouch twice. Hard to fake because each vouch needs its own account with its own gig history. The one that works for a bar with no website — in a beach town, most of them. `src: admin.mjs vouch; _verify.mjs addVouch, artistPlaysAt` |
| y06 | Way 2 — enough vouches? | conditional | Automation | MySet server R · Venue manager I | Netlify | `count >= MIN_VOUCHES` → the tick goes on by itself. The Studio shows progress (*N of M confirmed*, with names) and a *Send artists your page* button. The constant is one number in `_verify.mjs` — worth revisiting against how many acts a bar actually hosts. (`VERIFYING-A-VENUE.md` used to say ten; corrected 2026-09-12 to cite the constant.) `src: _verify.mjs MIN_VOUCHES, addVouch` |
| y07 | Way 3 — the founder's switch | task | Person | Founder R · Venue manager I | Netlify | Artist Studio → Settings → **Venues** (owner-only, `isPlatformOwner`): every venue with a Verify / Un-verify button (`venueList`, `venueVerify`). For the first hundred venues this is genuinely the best tool: thirty seconds on Google or Instagram settles it, and it costs nothing to build or run. `src: admin.mjs venueList, venueVerify; VERIFYING-A-VENUE.md Way 3` |
| y08 | Show the tick | notification | Automation | MySet server R · Fan I | Netlify | The green chip on `/v/<slug>`; `recheck` re-runs the checks when the plan or website changes, so a lapsed plan drops the *effective* tick without deleting the vouches. `src: _verify.mjs recheck` |
| y09 | Still to build | research | Person | Founder R | — | **Not built:** a phone call-back to the number on the venue's own website or Google listing (needs Twilio, per-message cost); an Instagram/Facebook handshake (a code in the bio for 24 hours — manual to check today). Google Business Profile is not an option MySet can read. `src: VERIFYING-A-VENUE.md § Still to build` |

## Connections

y01 —paid→ y02 → y03 → y04; y03 —both pass→ y08; y01 —paid→ y05 → y06; y06 —enough→ y08; y07 → y08; y01 —not paid→ *checklist stops*; y09 is the standing note.
