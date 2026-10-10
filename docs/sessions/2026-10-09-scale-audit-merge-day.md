# 2026-10-09 — The scale audit lands: sixteen pull requests in one morning

**Asked.** The founder, on the audit's remaining list: "please do all of this now" — merge the
fifteen audit pull requests (phase two's stack and week one's overnight set), do the desk
items his word covered (the ntfy secret, the deploy hold, the required check, the referral
month), and note what only he can do (two-step sign-in, the deploy-retention setting).

**One merger for two sessions.** The two audit sessions had seven and eight open pull
requests, several stacked on each other and two chains crossing (#238 on #227, #239 on
#238, #240 on #239). Two sessions restacking against each other's merges would have cost a
restack per merge per session, so this session merged everything and the other restacked
only its two that conflicted with its own earlier work (#238, #240). Order, and what went
live (each checked by Netlify's published-deploy record, no show live at any merge — checked
by reading `show_<aid>.status` for every artist before each):

| PR | What | Live as | UTC |
|---|---|---|---|
| #218 | The suite runs a traffic jam; every kind of document has a second home (0145, 0146) | `a202836` | 07:36 |
| #219 | Play is one write (0147) | `7a27f36` | 07:43 |
| #226 | One tap, one song; the song list sent once; the personal poll (0150–0152) | `821a7bc` | 07:50 |
| #231 | Short receipts; a network cap on new phones; the head count (0148, 0149) | `b4ac330` | 07:56 |
| #232 | End stops the room first; one live mark; a refund owed; vibes, the tenth-show resume (0153–0156) | `3111e4c` | 08:03 |
| #233 | Background jobs keep up; the city index; dated off-site copies (0173–0175) | `20be08a` | 08:14 |
| #237 | A room finds its artist through two small copies (0176) | `2969e5c` | 08:20 |
| #227 | Payments harder to lose or double; plan billing stops leaking (0180–0184, 0188) | `b2dbfec` | 08:26 |
| #228 | The vote page asks less, paints first, warns in in-app browsers (0185) | `5bb659a` | 08:56 |
| #229 | Small leaks; first-night letter once; error log counts; the confirm rate rule (0186, 0187, 0191) | `f83b15d` | 08:59 |
| #236 | The payments file stops growing: a yearly archive (0193) | `e52d6f5` | 09:02 |
| #238 | Refunds and chargebacks are heard; merch is held while the buyer pays (0177, 0178) | `623f6ce` | 09:11 |
| #239 | Money net of refunds; the shop's stock net of checkouts (0194, 0195) | `28ff11b` | 09:15 |
| #235 | Every song stays votable in a big room: the list once, then tallies (0192) | `8f3298a` | 09:17 |
| #230 | Abuse ceilings: clips per network, five promo guesses an hour (0189, 0190) | `974353e` | 09:20 |
| #240 | The last face-value money readers are net of refunds (0179) | `970ddfe` | 09:30 |
| #262 | No deploy lands on a live room; the suite becomes a required check; the referral month said plainly (0196, 0197, 0207) | `80cc05a` | 09:46 |

Between them, other sessions merged #250 (0172), #252, #203 (the probe tool's undici),
#150 (security slice C: 0112, 0113, 0199, 0200) and #251 (0198) — each one forced another
restack of every open audit PR, and #150 brought real conflicts into five of them
(`_errlog.mjs`, `_watch.mjs`, `SECURITY.md`, two key lists, `tools/overview.mjs`). From
08:20 the other sessions held their merges until the train was through.

**How a merge went.** In a detached worktree per PR: `git rebase --onto origin/main
<old parent tip>` (a child's own commits only); conflicts in the generated files (overview,
decisions README, page stamps) taken from main and regenerated; appended lists
(INVARIANTS, the ledger, the push log, `test/run.sh`) kept both sides; real conflicts by
hand; push with `--force-with-lease`; the `suite` check green on that head; squash with the
PR number in the subject and no `[skip ci]` folded in from branch messages; the remote
branch deleted only after its children were retargeted to `main` (GitHub closes a PR whose
base branch is deleted — #219 was closed that way once and reopened by restoring the
branch for a minute). When a later restack changed only generated files and the suite had
been green on the same added and removed lines, the merge did not wait for a second run
(the house shortcut; five merges used it).

**Fixed on the way.** Three suites went red after restacks and were fixed in the branch:
#228's crowded-room head count (decision 0185 gives a presence stamp three goes, not
forty, so the 5,000-phone minute lands 4,294 on arrival and the rest at the next poll —
the assertion now asks for ≥ 80 %); #229's second-home test looked for the error log's one
key and the log is four shards now (the test follows the shard; `globalKeys` names every
shard; FAMILIES matches `err_<hour>(_\d)?`); #230's promo test signed up `dee@example.com`,
which 0184's section below it also needs (renamed). New blob kinds got their FAMILIES lines
at restack time, as 0146 requires: `cliplim_`, `promolim`, `paidarc_`, `mhold_`.

**For the founder's desk, on his word.** The GitHub secret `NTFY_TOPIC` is set (he
subscribes on his phone). Decision 0196 built and merged as #262: the deploy hold, `/version.json`, the watch's
release, the valve; a Netlify build hook whose address lives only in the secret
`NETLIFY_BUILD_HOOK`. #262's own production build was held — production had no `/api/live`
yet, so the hold could not ask and held, as written — and after a check that no show was
live the hook was fired once by hand; Netlify published `80cc05a` at 09:46:07 UTC. Decision
0197: the `suite` check made required on the main ruleset on 2026-10-10 and read back. Decision 0207: the Invite
card says the referral month is a month of Bar Star for a Hobbyist. Deploy retention: the
Netlify API refuses every value under 90 days on this plan (422), left for him to check in
the UI. Two-step sign-in: his.

**Verified by content on production** (09:0x UTC): `robots.txt` 200, the vote page carries
`ME_EVERY` / "Catching up…" (0185), `/api/health` 200, the home page's `about/share.jpg`;
after #262, `/version.json` names `80cc05a` in context production and `/api/live` answers
`{"live":0,"artists":8,"read":8,"unread":0,"sure":true}` (`cache-control: no-store` on the
preview); the Studio's `studio.js` carries 0207's sentence. **Not checked:** real Stripe, a real phone, a real rush, a real
held build during a real show, the watch's first real release.

**Numbers.** Decisions 0196, 0197, 0207 (0172 and 0199 were claimed and yielded to #250 and
#150); INVARIANT 0jj. Ledger SCL-024, SCL-025, PAY-002. Puzzle changelog 2989–3004 for
0180–0195 (completed); 0196, 0197 and 0207 were entered the next day. The ledger's SCL-001–007 were used twice
(week one in #234, phase two in #226/#231/#232); phase two renumbers its seven to
SCL-017–023 in its docs PR.

**Lessons.** A restack helper that resolves only generated files and keeps both sides of
appended lists carried fourteen restacks in under two hours; the post-commit hook's
`PENDING.md` must be reset before every `rebase --continue`; `zsh` does not word-split, so
helpers are `sh` scripts, never inline loops; a helper that takes `$PWD` instead of an
explicit worktree path pushed #231's content to #232's branch for a minute — explicit paths
only.

**The next morning (2026-10-10).** Two things found while closing out:

- **The build hook's id was in a public file.** The ledger row SCL-024 (committed in #262)
  named the hook, and the repository is public, so anyone could have started production
  builds with it. The hook was replaced (a new one, its address only in the GitHub secret;
  the old one deleted and answering 404) and the id removed from every document. A secret's
  value never goes into a ledger row, even one that looks like a harmless id.
- **The "every five minutes" watch is not.** GitHub ran `watch.yml`'s `*/5` schedule 35
  times between 2 and 10 October, three to seven hours apart. The outside check (0157) and
  the held-build release (0196) are therefore hours slow, not minutes; a held build is
  released at once with `gh workflow run watch.yml -f release=yes`. Recorded in 0196; a
  faster outside clock is a separate piece of work.
