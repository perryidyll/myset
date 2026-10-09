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

**Slice B live:** merged as `314c809` (PR #144) after main moved twice more under it;
Netlify's production deploy is ready on `8f9bde6`, which contains it, and every changed
endpoint loads on it. The limits are write paths and were not exercised on production.

**Slice C (decisions `0112`, `0113`):** cut fresh from `main` `8f9bde6` and rebuilt where
the review asked, not ported whole. Main had grown four new users of the store-kept
key since the original branch — HQ's Gmail token sealing, HQ's unlock cookie, the
Gmail sign-in state and the factory's key — and the original design would have moved
the key under all of them (the Gmail one would have disconnected the founder's mailbox
on the day of the switch). And the original keyed recovery codes, Studio codes and a
data key with the rotating secret, so removing the previous value after a rotation
would have stranded every code on paper and every sealed record not rewritten in time.
What changed: recovery and Studio codes are slow salted hashes that depend on no key;
records are sealed under data keys kept in one keyring the secret wraps, so a new
secret re-wraps one document; a rotation signs every device out once instead of
leaving a leaked key valid for a month; HQ's contacts and Gmail record are on the
sealed list; the mirror carries the keyring and opens it every twenty minutes, and
`prod.py` says when the previous value may go. The passcode door was ported onto the
box #149 had just rebuilt. The rotation test caught one trap on the way — removing the
previous value before the ring is re-wrapped reads sealed records as missing until it
is put back — which is why the mirror's bell and `prod.py`'s line exist. Pull request
open, not merged: it waits on `MYSET_SECRET` and `FINMODEL_CODE`.

**Not checked:** production itself until each merge; a signed-in band mate or crew seat
on production; whether `ADMIN_CODE` was ever rotated after it appeared in a committed
file on 2026-08-17 — only the founder can see that.

**The founder's own list, in order** (PER-017–PER-020): set `MYSET_SECRET` (a long
random value made on your own machine) for every deploy context; set `FINMODEL_CODE`
to a long one; rotate `ADMIN_CODE`; turn on 2FA everywhere; check that Netlify does
not build deploy previews for pull requests from strangers with the live variables;
consider making the repository private, because a public repository is the one thing
that cannot be secured by code.

## 2026-10-01 — slice C brought up to today's main, and the secret set in one command

**Asked:** "please get me as far along in this task as possible before i need to do the
actual copying and pasting" — the `MYSET_SECRET` step.

**What was wrong in the runbook.** Two things Netlify's own documentation says (Secrets
Controller page, read 2026-10-01): a value marked secret is never shown again, by the
UI, the CLI or the API; and a value in the Local development context is never hidden,
secret or not. HARDENING.md §0 said "Same value for all deploy contexts" (which takes in
Local development) and its rotation began "copy its current value" (which Netlify will
not show). Fixed: Production, Deploy Previews and Branch deploys only, and a copy kept
on the founder's Mac.

**What shipped on the branch.** `tools/serversecret.mjs`: one command on the founder's
Mac makes the value, keeps a copy in the login Keychain, sets it in the three contexts
marked secret (the same `netlify env:set … --secret --force --site` call
`tools/hqpass.mjs` proved on this site), reads it back masked, and never prints it. It
refuses a second run, and puts the Keychain's copy back if a run stopped half way or the
variable was deleted. `test/serversecret.mjs` (28 checks) runs it against a fake Netlify
and a fake Keychain; three mutations each fail it (a leaked error, a missing secret
flag, Local development).

**Main had moved forty-one commits.** Merged at `e56a4af`. Seven conflicts, all
resolved by keeping both sides. Two things in main's new code needed slice C's care:
the Show log's lock (`0130`) signed its cookie with the signing key and checked it
under that key alone, so the switch would have locked the founder out of it once — it
now checks every verify key, like HQ (`test/secret.mjs`, mutation-checked); and the
Studios' suggestions box (`0127`) holds names and free text, so `suggest` joined the
sealed list. `0130` also opened the money model, so `FINMODEL_CODE` no longer blocks the
merge (PER-018 cancelled); the hardened door stays in the code.

**Verified:** `sh test/run.sh` green on the merged branch, and again with `MYSET_SECRET`
set; live `myset.vip/moneymodel` answers the model with no passcode (`0130`, as
intended). **Not checked:** the tool against the real Netlify CLI and Keychain — that
run is the founder's; `DATA-MODEL.md` has no entity for `suggest` (main's `0127` did not
add one).

## 2026-10-09 — slice C on today's main again, a week-long session, a whole activity log

**Asked.** "What are the next big steps on encryption and security?" — then "do all of
this now". The list: bring PR #150 up to date, check Netlify's sensitive-variable
policy, drop `'unsafe-inline'` from the CSP, shorten sessions to a week with silent
renewal, keep an activity log that is append-only and off-platform. (The edge rate
limit on the list had already shipped as `0160` on 2026-10-02 — one item fewer.)

**Main had moved thirty-five commits** since `e56a4af` (the scale audit week, the
watch `0157`, the edge rules `0160`, the generator and sample work). Merged at
`e995d43`; five conflicts, one in code. `0142` had made `readDoc` throw a `StoreError`
on a read that fails or times out, where slice C had made it read a protected key as
bytes and open it. The merged `readDoc` does both: the timeout race wraps either read;
a protected document that cannot be opened still reads as missing with `sealed` set,
and `casDoc` still refuses to write over it. `ring()` in `_seal.mjs` now lets a
`StoreError` through instead of remembering the ring as unreadable for a minute — the
store not answering is 503 "busy", never a round of sealed records reading as missing.
`sh test/run.sh` exit 0 on the merged tree.

**Decision 0199 — a session lasts a week and renews itself in use.** `TOKEN_TTL` seven
days (the venue token reads the same constant). A token more than a day old is answered
with a fresh one for the same address, `rev` and `sid`: `renewToken` in `_auth.mjs`,
offered against the request in `requireArtist` (`offerRenewal`, a `WeakMap`), sent by
`guard()` as `x-myset-token` — only on a `no-store` reply, never on `jsonCached` or a
page, so a cache can never hand one phone's token to the next. Both Studios' `api()`
keep it (three lines each; stamps rewritten). Nobody is signed out by the change; a
device signed out stays signed out across a renewal. `test/sessionlife.mjs`, 34 checks;
with the `no-store` rule removed two fail, with a month again five fail.

**Decision 0200 — the activity log is complete.** `note()` appends to an `_append.mjs`
log in parts of two hundred (`appendLog` grew `size` and `upgrade` options; the default
spill is untouched), never trimmed; `readLog` reads the newest twenty-five newest first,
from the last part just after a spill; the parts are on both account key lists, so the
mirror copies them and a delete finds them; `log_` and its parts are a sealed family.
A log kept the old way is reversed and counted on its first new note. `test/activity.mjs`,
23 checks; with the part read removed two fail.

**The CSP step, measured and not taken.** A hash covers a `<script>` block and never a
button's `onclick=`; the pages wire about 480 of those, 350 of them built inside scripts
(`studio.js` 247, `venue-studio.js` 104, `vote.html` 45). `'unsafe-hashes'` cannot
carry a handler built at run time and Safari before 15.4 does not know the keyword, so
a half-step would kill the vote page's buttons for part of a room. Deferred with the
numbers (SEC-006, SECURITY.md Tier 1, an open-risk row): a pass of its own, every
handler to `addEventListener` with a real-browser CSP check per page.

**Is the secret already set?** The Notion task row (closed 2026-10-02 from the sessions
board) says a session set `MYSET_SECRET` on the founder's word on 2026-09-28 — Production,
Deploy Previews and Branch deploys, marked secret, a Keychain copy under the account
`mysetvip` — which the 2026-10-01 session did not know, and main's ledger still calls
PER-017 not started. A cloud session cannot read Netlify's variables without the risk of
printing one, so the answer is read BY CONTENT instead: `/api/health` now carries
`seal: { secret, ring }` from `ringState()` in `_seal.mjs` — read-only, never a key,
never makes the ring — and the watch (0157) treats a ring the secret cannot open as a
problem somebody is told about, because that is the one way a mismatched value would
show itself (new sign-ins failing). The preview of #150, once rebuilt, says whether the
deploy-preview context holds a secret; production says so the moment the merge lands.
`test/seal.mjs` "HOW THE RING STANDS", twelve checks.

**Netlify's sensitive-variable policy.** The docs say *Require approval* is the default
once sensitive variables are detected on a public repository's project, UI-only (no API
field) — so it stays the founder's ten-second glance (PER-020, the exact page linked).
The project reader shows the plan is `nf_team_pro`.

**Verified:** named above, per suite; `node tools/overview.mjs --tests` stamps the
whole run below. **Not checked:** a phone's Studio reading the renewal header (three
lines, `node --check` clean); the mirror carrying a log part to R2 on production; the
tool against the real Netlify CLI and Keychain — the founder's run.

**Still the founder's:** `ADMIN_CODE`; 2FA; the Site-policies glance. Decision numbers
were taken on this branch without the sessions board (a cloud session cannot read it) —
0172 and 0173 at first, which turned out to be taken; renumbered below.

### Later the same day — the preview answers, main moves, the founder says merge

**The secret was already there.** The rebuilt preview of #150 answered `/api/health`
with `seal: { secret: true, ring: 'absent' }`: the deploy-preview context holds a value
long enough to cut keys from, and nothing has been sealed yet (`ringState` is read-only,
so the preview wrote nothing). That is the 2026-09-28 Notion record confirmed by
content, and PER-017 closes on it; production answers for itself the moment the merge
lands. The founder's word followed: *merge it once the checks are green*.

**Main had moved under the branch.** Six merges landed while the branch was being
brought up to `e995d43` — the scale audit's second week, decisions 0145–0156 — and
GitHub runs a `pull_request` workflow only on a pull request it can build a merge
commit for, so the `suite` check never ran on the conflicting head; the push that
carries the merge is what makes it run. `origin/main` `3111e4c` merged a third time
(`f7a4ce2`): seven files in conflict, none on a line both sides changed for the same
reason. `_mirror.mjs` keeps main's dozen new global homes and the keyring, and
`FAMILIES` (0146) gets one line for `sealkeys` — a global, wrapped by `MYSET_SECRET`,
safe to copy — so `test/keyfamilies.mjs` knows the one new kind of document slice C
writes (the log parts already match the owner line for `log_`). `_venueaccount.mjs`
drops `log_<o>` from the static list, as this branch did, and takes main's
`vpitch_`/`push_`/`gigok_`. `tools/prod.py` prints main's off-site-copy line and then
the sealed-at-rest lines; the Studio stamps, the overview's numbers and the decisions
index are regenerated; the push log keeps both entries. Main's `_lib.mjs` (380 lines:
`liveFans`, `getShowKept`, the receipts, the network cap) touches nothing in `readDoc`,
`casDoc` or the renewal; `getShowKept` reads the show record directly, and the show is
not a sealed family. The mirror copies bytes (`arrayBuffer`), so a sealed record goes
to R2 as the ciphertext it is.

**New numbers.** Main carries INVARIANTS 0hs and 0ht for 0146 and 0145, and the open
pull requests carry decisions 0172 (#250) and 0173–0175 (#233) and invariants up to
0ja (#251). So the week-long session is decision `0199`, INVARIANT 0jb, and the
complete activity log is decision `0200`, INVARIANT 0jc — forty-seven mentions in the
files this branch wrote, by word boundary; the push log's earlier entry is left as the
record it is.

**Main moved again before the push.** Four more merges landed while the suite ran —
votes per song and one free vote by default (0172, #250, its docs #252), the background
jobs, the city index and the dated copies (0173–0175, #233), the probe tool's dependency
bump (#203) — so `origin/main` `401961a` merged a fourth time (`04e5163`). `keysFor` and
`keysForVenue` are main's now (the purge walks the list from the end, and `namers` are
the documents read to name others — 0173, INVARIANT 0im), with slice C's one change put
back on them: the activity log's head is read for its parts, pushed before them, and
collected as a namer, so a purge deletes the parts before the head. The suite's last
step had also named `fmgate` — the money-model door's wrong-passcode counter (0112) — as
a kind of document the mirror's table did not know; it is skipped now, like `hqlock` and
`showlock`, which is what it is: minutes of lockout state, never worth a copy.

**And once more.** `origin/main` `b2dbfec` — the audience finds an artist through two
small copies of the artist list (0176, #237) and payments harder to lose or double
(0180–0184, 0188, #227) — merged a fifth time (`eaf4318`). One line of code in conflict:
both sides added an import at the top of `_auth.mjs`, and both stay. Checked on purpose:
`verifyToken` still reads the artist list itself for `rev` and `dead` (0176 keeps the
sign-in facts off the small copies), and `aslug_` / `arow_` hold nothing a person would
call theirs, so they are not a sealed family.

**Verified, on the final head.** After each merge, the suites nearest it: `test/seal.mjs`
80, `test/sessionlife.mjs` 34, `test/activity.mjs` 23, `test/secret.mjs` 65,
`test/storefail.mjs` 36, `test/foundations.mjs` 103, `test/accounts.mjs` 235,
`test/contention.mjs` 34, `test/background.mjs` 31, `test/snapshots.mjs` 19,
`test/lookups.mjs` 75, `test/cost.mjs` 33 — all 0 failing. Then the whole suite through
`node tools/overview.mjs --tests` on `eaf4318`: 6,305 assertions, 0 failing, stamped in
`test/.last-run.json`. The run before it, on `04e5163`, had failed on its last step alone
— `test/keyfamilies.mjs` naming `fmgate` — which is what the one line in `FAMILIES`
answers. **Read before the merge, after this push:** the PR's `suite` check on the new
head, the rebuilt preview's `/api/health` by content, and its pages at phone width.

### Live — `e996865`, 2026-10-09 08:41 UTC

The `suite` check passed on `b3f9f86` (run 37905865762); the rebuilt preview answered
`/api/health` with `ok: true`, `seal: { secret: true, ring: 'absent' }` and served both
Studio scripts with the renewal header; its pages rendered at phone width in a headless
browser (the artists page, the Venue Studio's sign-in — this container's proxy, not the
site, broke a few of the browser's fetches, so the by-content reads are the record).
PR #150 was marked ready and squash-merged as `e996865`, keeping the number. Production,
read by content fifteen seconds later: `studio.html` serves `studio.js?v=c3a8e6af`,
`venue-studio.html` serves `venue-studio.js?v=70103e05`, both carry `x-myset-token`;
`/api/health` 200, `ok: true`, `seal: { secret: true, ring: 'absent' }`, `errorsLastHour:
0`. The keyring appears at the first protected write (a sign-in, a note, the mirror's
five-minute ring), and `seal.ring` reads `ours` from then on — which it did at 08:47:04Z:
`seal: { secret: true, ring: 'ours' }`, `ok: true`, `errorsLastHour: 0`. The keyring exists,
wrapped by the secret; sealing is live. **Not checked:** a sign-in on the new build — the
founder's next Studio open is the proof.

Paperwork: decisions 0112, 0113, 0199, 0200 carry the commit; SEC-003–SEC-005 live in
the ledger; Puzzle changelog 2474 and 2475 completed, 2973/2974 (titled 0172/0173)
replaced by 2983 and 2984 (0199/0200), steps t02/t04/t09/t10 re-noted; the founder's
dashboard in Notion now asks for `ADMIN_CODE` and 2FA instead of the secret. The branch
was restarted from `main` for this note. **Left for a hand with the suite:** 0176's
deferred line — `setCode` in `admin.mjs` reads the page's name through `artistById`, a
small copy since 0176, which wanted `readArtists()` there once #150 landed.
