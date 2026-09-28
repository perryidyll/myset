# 2026-09-28 — Push alerts per seat

**Asked (the founder):** "start the push alerts per seat batch": the batch decision 0105 named as next. The triage for 0105 had found three things:

- a crew seat's `pushOn` answered 200, and the next merch order reached the sound engineer's phone;
- eight more crew subscriptions pushed the owner's phone out of the page's eight-device cap;
- nothing gated alerts by seat at all.

**Built** (branch `feat/push-per-seat`, off origin/main `5aca670`):

- **Decision `0114`, INVARIANT 0ha: an alert reaches only the seats that can see what it is about, and a sign-out ends that phone's alerts.**
  - **`_push.mjs`.** A device row carries the `email` and `sid` that switched it on. The cap is eight per address.
  - **Who hears it.** `notify(aid, msg, to)` takes `{ tab }`, `{ owner: true }`, `{ all: true }` or `{ endpoint }`. A device hears only while its address is still a seat here and `can(role, '<tab>_view', access)` allows it. An address that is no longer a seat is dropped at the next alert. A device with no address (the Studio code, the recovery key, anything switched on before this change) is the owner's.
  - **Default-deny.** An alert with no audience reaches nobody. If the registry cannot be read, it reaches nobody, never everybody.
  - **`dropDevices(owner, sids)`**, called by `killSessions` and `killEverything`. Every sign-out already goes through one of the two, and they already clean the session list, the device's other record.
  - **`devicesOf(aid, email)`** answers `pushKey`, `pushOn` and `pushOff` with this seat's count, not the page's.
  - **Where each alert goes:**
    - an order (`_ordernote.mjs`) to `{ tab: 'merch' }`;
    - a message (`_messages.mjs` tellArtist) to `{ tab: 'messages' }`;
    - the requests (`_requests.mjs`) to `{ all: true }`;
    - a reported conversation and the sample factory (`_messages.mjs` tellPlatform, `_sample.mjs`) to `{ owner: true }`;
    - *Alerts are on* (`admin.mjs` pushOn) to `{ endpoint }`, only the phone just switched on.
- **The Studio.**
  - `signOut()` drops the browser's own push subscription and forgets `PUSHKEY`.
  - The alerts line says what this seat will hear (`pushWhat()`): *someone requests a song*, then *writes to you* if the seat can see Messages, then *buys your merch* if it can see Merch.
  - `tools/stamp.mjs` run.
- **`tools/mock.mjs`.** `pushKey` answers with a throwaway public key, so Settings draws the alerts row.
- **Tests.** `test/pushseats.mjs` (new, in `run.sh`), with a tripwire that fails if any `notify(` call in `netlify/functions/` names no audience.
- **Docs.**
  - `INVARIANTS.md` 0ha, `ACCOUNTS.md` §6.3a, and the master overview (the roles paragraph, the push paragraph, the §8 gap).
  - Ledger ACC-008, ACC-006's next action and PER-004.
  - The process sheets: artist-lifecycle/02 (new t13, connections from t04, t05, t07 and t11), onboarding/01 o10, admin-and-finance/03 d06, reliability-and-security/03 j08, marketing-and-growth/02 f06, and DATA-MODEL `push_<aid>`.

**Also closed:** the sheets and the overview said `VAPID_*` were unset, while the ledger's PER-004 said an agent set them on 2026-09-15. The passwords session had flagged it as "wrong on both sides (check the fact first)". `netlify env:list --context production` lists `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY` and `VAPID_SUBJECT`; the values were not printed. The docs now say the keys are set, and that no real push has been checked.

**Choices made on the way:**

- **How to end a signed-out phone's alerts.** A session's dead mark (`row.dead[sid]`) lapses when the token would have expired anyway, and the device row does not. So checking the mark at send time could not do it: a signed-out phone would start hearing the page again a few weeks later. The device is dropped where the session is killed instead.
- **Devices with no address.** The 2026-09-25 production backup held no `push_` document and no seat but owners. Reading an address-less device as the owner's therefore re-routes nothing. It is also the right reading for the Studio-code door, which only the owner holds, so the rule is not a migration shim.
- **The request alerts are unchanged.** They still carry "$N offered" to every seat. The Live queue already shows every seat the pledges, because accepting one is part of running the show.

**Verified:**

- **Failing first.** `test/pushseats.mjs` against the unfixed code: 15 ✓ / 18 ✗. After: 33 ✓ / 0 ✗.
- **Knock-outs**, each red, all three files restored and checked with `shasum -c`:

  | Knock-out | Failed |
  | --- | --- |
  | tab gate off | 3 |
  | cap per page | 6 |
  | `killSessions` keeps the alerts | 4 |
  | `killEverything` keeps them | 1 |
  | no audience means everyone | 1 |
  | an ex-seat still hears | 5 |
  | setup ping to every seat | 1 |
  | `pushOn` forgets the seat | 13 |

- **Neighbours**, all 0 ✗: `test/push.mjs` 31, `test/ordernote.mjs` 26, `test/messages.mjs` 91, `test/accounts.mjs` 236, `test/samples.mjs` 119.
- **The suite.** `sh test/run.sh` exit 0, 4,520 ✓.
- **In the app's browser, on `tools/mock.mjs`.** The alerts row is drawn in a crew seat's Settings. `pushWhat()`:
  - crew: *someone requests a song*;
  - a band mate: all three;
  - a band mate with Messages and Merch hidden: *someone requests a song*;
  - the owner: all three.
- **Not checked:**
  - The rendered on/off wording, because the mock runs no service worker, so the switch stops at "Couldn't start alerts here". At phone width the emulation reads as an iPad and shows the install step.
  - The browser subscription dropped on sign-out.
  - A real push to a real phone.
  - A live alert through the new code.

**Shipped:** on the founder's word, after a cross-session re-check at 07:35 UTC. Main had not moved since `5aca670`; two branches that are not merged yet needed a fix, and both sessions were told: HQ's new `notify` call in `hq.mjs` names no audience, and the security branch had added a `pushOn` gate and taken INVARIANT 0ha. PR #131 was squash-merged at 07:39 UTC as `811c9a7`. The preview drew `/studio` at 375 px. **Live:** `https://myset.vip/studio` serves `studio.js?v=ef099c29`, and that file holds `function pushWhat`.
