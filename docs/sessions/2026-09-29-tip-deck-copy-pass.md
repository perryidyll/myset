# 2026-09-29 — The tip decks, the founder's copy pass

**Asked:** from the founder's phone screenshots: payouts "every Monday", no Spotify playlist on the Setlist card, two new Money cards (Total/My cut; the all-in hourly rate) and "View" on the last one, the Gigs arrows turning the wrong way, the ? button glowing, the Gigs "ask venues" card replaced by one about recurring pay. He also asked how asking a venue for a spot works (answered in chat; see below).

**Shipped:** live as `0a90d08` (PR #165; #163 closed unmerged when its branch was deleted after a merge conflict, a mistake, nothing lost). `public/tips.js`: `{payday}` filled by `studio.js tipVars()` from the plan, because the payout schedule is per plan (`_connect.mjs payoutScheduleFor`: Hobbyist weekly on Monday, paid plans daily), so "every Monday" alone would be false for Bar Star and Rock Star. Money has five slides (test/tipdecks allows five there only). The Spotify-playlist promise is also gone from about.html and the setlist empty state: import is CSV/paste only. The repeat glyph turns counter-clockwise; the clock glyph's hands are white (they were the disc's own gradient, invisible). `lock.css .tipsbtn` breathes a soft ring (`tipsglow`), off with Reduce Motion.

**Verified:** full suite green after the rebase on 0122; headless Chrome at 390 wide on tools/mock.mjs (Money words for Bar Star and for free, spin direction by the rotation matrix, the ? animation name); preview 165 and myset.vip served the new tips.js and studio.js stamps (14:01 UTC).

**Open:** asking a venue for a spot (`_pitch.mjs`) is its own channel: the artist sends one message from the venue page, the venue marks it keen / not this time, and the artist sees only that status on the Gigs tab. No replies, no thread, no link to Messages. The founder wants it in Messages; awaiting his go.

**Learned:** after a failed `gh pr merge`, do not delete the branch: it closes the PR for good.
