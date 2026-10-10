# 2026-10-10 — the review of 0205, and a merge assigned to one session and made by another

**Asked:** the founder, once this session's 0198 documentation PR had landed — "merge #269 when its suite goes green". #269 was **another session's** one-line fix for the `casKeep` blank-version race; the fix and its decision have their own record in
`docs/sessions/2026-10-10-caskeep-blank-version.md` (decision 0205). This entry is the other half: what the review of that PR actually checked, and why the merge the founder assigned was made by a different session two minutes after it was assigned.

No code shipped from this session on 2026-10-10. Its own work — a deleted gig keeping its played nights priced — is recorded under 2026-10-09 and live as `694f56c`, with the documentation merged as `dbfa090` (#264) at 18:32:15 UTC.

## How someone else's race became this session's problem

#264 was documentation only: 0198's `commits:` field and a ledger row, not a line of server code. Its required check went red anyway — run `38029761623`, 06:09:24 UTC on `7f08169`, two assertions down in the data-foundations file:

```
✗ the first write of a document that did not exist keeps nothing
✗ and it is the profile as it was before the burst
```

Since 0197 made `suite` a required check, a race in a file this diff never touched was enough to hold a documentation merge. Traced at 06:19 UTC and sent straight to the session then merging #267, which had read the same red as a stale-base artifact and was about to re-stack around it:

- `casKeep` (`netlify/functions/_versions.mjs`) decides "this document never existed" by comparing serialised states. It computes `blank = JSON.stringify(fallback())` **once**, and `casDoc` (`_lib.mjs:377`) evaluates `fallback()` **again** for the missing-document read.
- `defaultProfile()` (`_profile.mjs:294`) carries `updatedAt: Date.now()`. When the two evaluations straddle a millisecond boundary, `before !== blank`, and a version of a profile that was never written is kept.
- The other three `casKeep` fallbacks are constant, so the profile was the only path exposed — and under CI load it fails at random on any PR, not only one that touches storage.

The fix was written here too, then thrown away: `caskeep-blank` already had the same one line in flight as #269, so this session reviewed theirs rather than opening a second PR, and **released decision 0209, INVARIANT 0jk and ledger row DAT-003** — claimed ten minutes before their branch was found, unused.

## What the review of #269 checked (head `301fe97`)

Sent to the board at 18:35 UTC, measured against their exact diff run locally, not read off the page:

- **Zero CI-skip markers in all five branch commits.** Under 0197 a marker anywhere in a branch commit means no `suite` run at all, so the required check can never go green and the PR can never merge. The marker belongs only in the squash subject.
- **The push-log hunk insert-only** — no other session's lines rewritten.
- **The server diff confined** to the one-line fallback change and its comment; nothing else in the storage family moved.
- **6,831 assertions passing**, three of them new.
- **One gap, with the code to close it:** their test pinned the contract through a synthetic drifting fallback but never walked the profile path, which is where the live harm was. A block driving the real `mutateProfile` with the clock moving on every call went over for whoever owned the PR — it fails 2 on the old body and passes on the new one. It landed on their branch as `9a6e275`, "The profile door itself is pinned against a moving clock (0205)", committed at 18:39:53 UTC — four minutes after the relay went out. 0205's own record credits that check to other sessions in the chain; the two timestamps are this session's side of it.

## The merge mix-up

| UTC | What happened |
| --- | --- |
| 18:32:15 | #264 merged as `dbfa090` — this session's own documentation PR |
| 18:35:12 | review of #269 and the released numbers sent to the board |
| 18:41:58 | this session tells the PR's own session that the founder has assigned it #269 to merge |
| 18:42:29 | and asks that session to say when the suite finishes, having no way to watch it |
| 18:43:47 | **#269 merged as `b9467b6`** — by that session, not this one |
| 18:43:56 | production built |
| 18:46:05 | `https://myset.vip/version.json` read back `b9467b6` — live, verified by content per 0196 |
| 18:49:49 | #270, 0205's documentation, merged as `e101cd0` |

**Why it happened.** A pull request binds to exactly one session's monitor. The binding for #269 was the other session's, so the session the founder named as merger was the one session that could not see the check it was told to wait for. It did the only thing left — asked the session that could — and that message, arriving as "this merge is mine", was followed by their merge a hundred and nine seconds later.

GitHub cannot tell the two apart: every session acts as the founder's own account, so `mergedBy` reads `perryidyll` on every MySet pull request. The order above comes from the cross-session messages and their timestamps.

**What it cost.** Nothing live: the right commit went live exactly once, and it was verified here by content rather than taken on a peer's word. What was lost is the thing the founder buys by naming a merger — one session holding the whole merge, watching the suite, and timing it against the live site. Two sessions each half-holding a merge is how a double deploy or an unwatched red happens on a night somebody is playing.

**The rule, now on the sessions board:** a session the founder names as merger must also hold that PR's binding. Hand over the binding or hand over the merge, in writing, before the suite goes green.

## Not checked

Whether any live profile already holds a blank version from before `b9467b6` — 0205's own open item, and not this session's to close.
