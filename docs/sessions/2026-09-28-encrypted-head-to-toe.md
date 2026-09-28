# 2026-09-28 — "Encrypted head to toe": the security pass, in three slices

**Asked (the founder):** *"i want myset encrypted head to toe … do whatever you need to
do to make some have to put in some serious hacker work to steal it … consider this a
top priority and don't stop until it's done (but make sure it doesn't interfere with
the site's performance/speed/etc.) … please assemble your dream team cyber defense
agency and make myset as secure as possible."* Later the same day: *"please merge"*,
and a relayed note from a local session: *"slice A first"*.

**How it was run:** seven read-only audits in parallel, each on one surface — transport
and headers, sign-in and sessions, data at rest and cryptography, every path money
touches, the pages and input handling, the anonymous endpoints and the scheduled
functions, the repository and its history. Every finding was verified in the code
(most by running the real handlers on the in-memory store) before anything changed.
The pass was first built as one 72-file branch off `45a8d07`. By the time the founder
said merge, `main` had moved eight pull requests (#114–#130): the branch conflicted in
fifteen files, three of its fixes had been made another way by #128, `0099` and
`0100`, and its decision and INVARIANT numbers were taken. The cross-session review
(`docs/sessions/2026-09-28-cross-session-review.md`) asked for it in three slices,
with `0110`–`0113` and `0gt`+ reserved. So the branch was rebuilt on `main`, slice by
slice, dropping what was already live.

**The three slices:**

- **A — code only (decision `0110`, INVARIANTS 0gt–0gw).** No new variable, no new
  limit. A pledge comes only from Stripe; `__proto__`, `constructor` and `prototype`
  are refused as names and every registry lookup is an own-property lookup; an event
  id is never markup and a picture is an address; `$'` in a band name stays a
  character; `emailChangeStart` no longer says whether an address has an account;
  `setCode` finally refuses the page's own name; the mirror and the backup skip the
  ID photo and the store-kept signing key, `dropImage` deletes the R2 copy, `prod.py`
  refuses to print a key or a photo, the error log keeps paths only, `confirm` echoes
  no device id; the full HSTS on every reply, `nosniff` on every served file, a policy
  on the QR SVG; eight-second deadlines on mail and lyrics; a real fan's address, the
  founder's own and five device ids out of committed files; Dependabot.
- **B — the limits (decision `0111`).** Every anonymous write counts the network as
  well as the device — sign-in codes, RSVPs, ratings, bug reports, checkout — inside
  the document already being written, silent where the door must not be an oracle,
  never a refusal when the limiter cannot be written. Re-sized before it ships: the
  checkout numbers on the original branch would have shown one bar's shared wifi *Too
  many tries* at the buy moment.
- **C — the server's own secret (decisions `0112`, `0113`).** `MYSET_SECRET` cut into
  the signing key and the sealing key with HKDF, the store-kept key verifying for a
  month and signing nothing, `MYSET_SECRET_PREVIOUS` as the rotation; the founder's
  passcode a real door (`FINMODEL_CODE` required, a MAC cookie, a doubling lockout);
  the Studio code an HMAC; the records that hold a person sealed at rest
  (AES-256-GCM) — never the show, a shard, the registry or a profile. Waits on the
  founder setting the variables, and on a rotation runbook that cannot strand a
  recovery code or a Studio code hashed under a dropped key.

**Dropped, because `main` already does it another way:** a seat signing the owner's
devices out (`0104`), `/api/revenue` and `/api/history` open to every seat and crew
reaching the room's settings (`0105`), the founder's tools on a member seat (`0099`,
`0100`). The original branch's `library`/`gigs` capability rows and its `CAN` edit went
with them. The `venue`/`city`/`showTime` actions are the Live tab's *name the night*
and stay in no capability row on purpose (decision `0105`: running the show is
nobody's to lose).

**What broke on the way:** the first build of the sealing shipped without its import
line for one test run (the merch photo upload answered 500); a checkout limit set too
tight for the community suite's one-phone shopping spree; an overhead assertion that
said thirty-eight where the header, the IV and the tag make thirty-seven; and, on the
rebuild, the shared checkout's `node_modules` link pointing at a Mac path — installed
from the lockfile into the session's own folder and linked, the tree untouched.

**Verified (slice A):** `sh test/run.sh` on the rebuilt branch, exit 0, 4,540 ✓ / 0 ✗ (after merging main at `d5e53fb`, which took `askList` away — the pledge test reads the Studio poll instead)
(the count stamped by `node tools/overview.mjs --tests`); the holes ran red first on
the original branch where a test could reach them (the forged pledge minting paid
votes, `__proto__` reaching the prototype, the oracle, the ID photo on R2), and the
same assertions hold on today's `main`. The one listed artist's public profile was
read from production (read-only) and every picture address passes `imgUrl`, so
nothing goes blank on deploy. Nothing was written to production.

**Slice A live:** merged as `539c2a4` (PR #136) after main moved four more times
under it. Verified by content on myset.vip once the deploy landed: the full HSTS
directive and `nosniff` on `/api/show`, the policy and `nosniff` on `/api/qr`, the
artist page's share card intact.

**Slice B (decision `0111`):** cut fresh from `main` `f1e1dbe` and ported from the
original branch, then re-sized before anything shipped. Checkout's network burst went
from sixty to more than a bar holds phones, and a test now runs that night (two
hundred phones on one address, each tapping Buy twice, none refused). The sign-in,
RSVP, rating and bug numbers were widened the same way, and the RSVP and rating
retry caps went back to the default, because the network cap already starves a
script and the cut would have been paid by real fans. Found on the port: the
original branch never put the checkout limiter's document on the delete lists, so
deleting an account would have left it behind. It is on both now.

**Not checked:** production itself until each merge; a signed-in band mate or crew seat
on production; whether `ADMIN_CODE` was ever rotated after it appeared in a committed
file on 2026-08-17 — only the founder can see that.

**The founder's own list, in order** (PER-017–PER-020): set `MYSET_SECRET` (a long
random value made on your own machine) for every deploy context; set `FINMODEL_CODE`
to a long one; rotate `ADMIN_CODE`; turn on 2FA everywhere; check that Netlify does
not build deploy previews for pull requests from strangers with the live variables;
consider making the repository private, because a public repository is the one thing
that cannot be secured by code.
