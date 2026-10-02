---
id: 0189
title: An anonymous clip has one door, and each network a ceiling
date: 2026-10-03
status: decided
decided_by: claude
area: media
reverses:
superseded_by:
invariants: [1, 0ii]
commits: []
tests: [test/clips.mjs]
files: [netlify/functions/community.mjs, netlify/functions/clipup.mjs, netlify/functions/_video.mjs, netlify/functions/_account.mjs, netlify/functions/_venueaccount.mjs, tools/backup.py]
---

## The question

A fan uploads a clip without signing in (rule 2). The 2026-10-02 scale audit (SEC-5)
found three ways a script could use that to grow storage without bound:

- **The old door.** The `clip` action in `community.mjs` took a whole clip as base64
  in the JSON body, about 4.4 MB a call. It had no network ceiling. Its daily check
  counted *posts*, not uploads, on a device id the caller chooses. No page in
  `public/` sent it any more: the community page has used `/api/clipup` since clips
  went up in pieces.
- **Orphans.** `notePending` capped the pending list at 60 by dropping the oldest
  entries, and left their clips in the store. `list()` is banned (INVARIANT 1), so
  nothing could ever find those clips again.
- **The chunked door.** `clipup` `begin` allowed 40 pending clips per page, 75 MB
  each, and the only other check was the per-device count on a client-chosen id. A
  script could hold all 40 slots, and the real room could not upload.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Remove the old action. A trimmed pending entry deletes its clip unless a post names it. A token bucket per network on `begin` | One small document per owner | `cliplim_<owner>`, `clipBeginAllowed` | A crowded bar's wifi is refused a clip; sized so it is not |
| B | Keep the old action behind the same ceiling as `begin` | A second door to keep in step | The same bucket on two paths | Two paths drift; no page needs the second one |
| C | Count each network's *pending* clips instead of a rate | A network id on every pending entry | A field on the pending list | More code on the list the sweep reads |
| D — do nothing | — | Storage and R2 bytes grow with any script | None | A page's 40 slots held shut during a gig |

## What was chosen, and why

A. The old action had no sender, so the repo's rule (no dead doors, decision 0115)
says remove it rather than guard it.

- **One door.** `community.mjs` no longer takes `clip`. `decodeVideoDataUrl`, used
  only by it, is gone. `checkVideo` is the one test of a clip's bytes.
- **A trimmed entry takes its clip with it.** `notePending` collects the ids it
  trims and drops each one by its computed keys (`dropClip`), unless the feed names
  it. `clearPending` is best-effort, so a posted clip can still be on the list. If
  the feed cannot be read, nothing is dropped: an orphan is better than a video taken
  off a real post. The trim path calls `dropClip` with `renote: false`. Otherwise an
  R2 refusal would note the clip again, which would trim the next one, round the list
  for as long as R2 refused.
- **A network ceiling on `begin`.** `clipBeginAllowed` keeps one token bucket per
  network (`roomHash(owner, clientIp(req))`) in `cliplim_<owner>`, the same shape as
  `payAllowed` (decision 0111): 15 in a row (`CLIP_NET_BURST`), then 6 an hour
  (`CLIP_NET_PER_HOUR`). It runs after the per-device and pending checks, so only a
  begin that would otherwise go ahead spends a token. A refused begin writes nothing.
  A limiter that cannot be written lets the upload through (five tries, then let
  go), as the checkout limiter does.
- **The sizing.** A clip is a post about to happen, and each phone gets three posts a
  day. A bar's wifi is one address for every phone on it. Fifteen in a row covers the
  room filming the encore at once. After that one every ten minutes is still more
  than a room posts. A clip waits two hours (`PENDING_TTL`) for its post, so one
  network hammering `begin` holds at most 15 + 6 × 2 = 27 of the 40 slots. That
  leaves at least 13 for everyone else. **Inferred, not measured:** there is no
  figure for clips per night on production. The per-page 40 is still the
  hard ceiling for the whole room.

## What this makes harder

- A phone kept from before clips went up in pieces would still send the old action
  and now gets "unknown action". The current page has not sent it since the chunked
  path shipped.
- `cliplim_<owner>` is a new key family. It is in `keysFor` (`_account.mjs`), the
  venue delete list (`_venueaccount.mjs`) and `tools/backup.py`'s skip list. It
  still has to be added to `SKIP` in `_mirror.mjs`
  (`…|paylim_|cliplim_|promolim|…`); that file was being changed by another
  session and was not touched here.
- A trimmed clip whose R2 delete fails is logged and left on R2.

## What would reverse it

A real night where one network starts more than fifteen clips at once and is
refused. Then raise the burst, or move to counting each network's pending clips
(option C), which frees a slot as soon as a fan posts.

## How it was verified

`node --import ./test/register.mjs test/clips.mjs`, section "THE CEILINGS ON
ANONYMOUS UPLOADS". Every case failed before the change:

- a real clip sent to the old action is refused as "unknown action" and stores nothing;
- fifteen begins from one address go through, the sixteenth is 429 and names the
  network, holds no pending slot, and another address is untouched;
- a script calling `begin` every minute for two hours on one network gets 26 begins,
  under 40;
- with 60 entries pending, noting one more deletes the oldest unposted clip's bytes;
  a posted clip trimmed off keeps its bytes; the clip being noted is never trimmed.

The existing clip tests now upload through `/api/clipup`.

The whole suite: `sh test/run.sh`, exit 0.

**Not checked:** any of this on production. The sizing has not been tried against a
real crowded room.
