# 2026-09-15 — The Live tab counted last night's tip as tonight's; and where the founder's money goes

## What the user asked

1. During the Ugly Duckling show the Studio's Live tab said **$30** in tips; the Money tab
   afterwards says $20 for the night and $30 in all. He read it as Sunday's $10 "not cleared".
2. "Please don't run payments I receive on my account through Stripe Connect … wire them
   straight to my normal account so there's no transaction fees on my own money."

## 1 · The bug, and the fix

The Money tab was right: two $10 card tips on 14 Sep, one on 13 Sep. The Live tab was wrong.
`stage.mjs` summed `meta.tips` — the account's whole tip history — and the Live tab showed
that under "Tips", where it reads as tonight's. The vote page (`tipsTonight`) and the
paid-vote pill (`tippersTonight`) already used the show's `startedAt` as the night boundary;
the Studio did not. So a night after a $10 Sunday showed $30 for $20, and the founder counted
a tip that was not there.

Fix: `stage.mjs` now sends `tips.total` / `tips.count` for tonight (since `startedAt`; 0 before a
show has started), `tips.recent` filtered to tonight, and the account's figure alongside as
`tips.allTime` / `tips.allTimeCount`, named. `test/decline.mjs` pins it (Cal's last-week $20
is in `allTime`, not in tonight's 7). The whole suite: 49 files, all green.

**So the tips on 14 Sep were $20, not $30** — the archive, the event log, the Money tab and
the model's `actuals.json` already said so; nothing there changes. The session note for the
night and the handoff said "the founder counts $30" — corrected here: the $30 was the Live
tab's history total, not a third tip.

## 2 · The founder's money — already straight to his own account

No change needed, and it is pinned by a test. In `pay.mjs` a checkout is created ON a
connected account (with MySet's application fee) only when `readConnect(aid)` finds one;
the founder (`isPlatformOwner`, `DEFAULT_ARTIST`) has no `connect_perry-idyll` document in
production (checked, read-only), so his sessions are created directly on the platform
account — his own Stripe — with **no Connect, no application fee, no fee split**
(`meta.fees` for him is `{}`); `test/connect.mjs` lines ~200–204 assert exactly that ("on
the platform account, as before"; no `application_fee_amount`). Decision 0007's "every
charge on the artist's own account" is, for him, the platform account itself.

What remains is Stripe's own card fee (2.9% + 30¢ per charge, ≈ $1.18 on last night's two
tips). That is what Stripe charges anyone for taking a card and is not a Connect or MySet
fee; MySet takes nothing from him. Recorded in memory so it is not re-asked.

## Verification

- `node --import ./test/register.mjs test/decline.mjs`: 43 pass, including the three new
  assertions; `sh test/run.sh`: 49 files, 0 failures (run from the PR worktree with a real
  `node_modules` — note: `~/Docs/MySet/node_modules` is a symlink pointing at itself since
  commit 7a62844 (#10), which is why `node tools/overview.mjs` and the unhooked tests fail
  in the main worktree; a real install exists in
  `.claude/worktrees/compassionate-chatterjee-41ecbe/node_modules`).
- Production read-only: `connect_perry-idyll` does not exist; `meta_perry-idyll.fees` is `{}`;
  the three tips on file are 13 Sep $10, 14 Sep $10, 14 Sep $10.
