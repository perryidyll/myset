# 2026-09-12 — Product Dev 2: the tab bar, RSVP, the plan names, and the strip that turns

**What was asked.** One founder message, thirteen items: give the Artist Studio's
bottom bar a face lift ("black on dark mode with a subtle futuristic sheen, an orange
border around the selected tab, make it feel 3D"); double-check that Gigs, Money and
Profile load; the Profile row's subtext; move *What the room said* from Money to
Profile under the merch; rename the plans (Hobbyist / Bar Star / Rock Star, a Super
Star rung later); drop the ratings card from the artist page's strip and make it a
slow continuous scroll that still swipes, with top voted and played songs in it; an
orange ring and orange heading on the pinned next-show card and a red ring on its
countdown; an **RSVP** button under the time and date of every show card on the
front door and the artist page, with the count beneath, grey-with-orange-ring →
orange-filled; addresses off every event card; two equal-padding fixes (the two
chips under the front door's finder; the genre chips over the Setlist tab's list);
and *All songs* as a real choice for the "Setlist chosen" step, retitled "Select
setlist", subtext on its own line.

**How it was built.** In a clean worktree off `origin/main` (`aa6dce7`), because the
shared checkout carried other sessions' uncommitted hunks and one of them `git add
-A`s. Five implementers on disjoint files (Studio; artist page; front door; the RSVP
server side; the plan rename server side), each followed by three refuting
reviewers (correctness and the shrug rule; design system and diff hygiene;
invariants and security) and a fix pass, then one cross-area seam check. What the
reviewers caught and the fix passes repaired, all confirmed before fixing:

- an RSVP document that would have outlived a deleted account (INVARIANT 0cy) —
  `rsvp_<id>` added to `keysFor` and `keysForVenue`;
- no date horizon on the write, so a weekly residency could accept 420 nights —
  `HORIZON_DAYS = 120`, shared with the diary's cap so the two cannot drift;
- a marquee whose seam was unreachable with two cards on a 560px page — the ghost
  set is topped up per frame;
- a redraw while an RSVP request was in flight painting the detached old button —
  the button carries its key and the reply repaints by key;
- `stopPropagation` on the front door's RSVP tap, which would have killed the city
  picker's click-outside — dropped, `preventDefault` kept (the row link is a sibling);
- the install card's 18px margin breaking the founder's equal gap on a first visit;
- two invented founder quotations in comments — replaced with attribution, no quotes;
- a decision-number collision with a record another session pushed mid-build
  (twice: `0053`, then `0054`) — ours are `0055` (plans) and `0056` (RSVP).

**What shipped.** Decisions `0055` and `0056`; INVARIANT 0fl; `netlify/functions/_rsvp.mjs`,
`rsvp.mjs`, `events.mjs` (every row carries `rsvp`), `_account.mjs`, `_venueaccount.mjs`,
`_plan.mjs`, `_billing.mjs`, `admin.mjs`, `auth.mjs`; `public/lock.css` (the bar),
`studio.html` + `studio.js` (the batch was built against the inline script and ported
to the file PR #15 created, hunk by hunk, then restamped), `artist.html`, `index.html`;
`test/rsvp.mjs` in `test/run.sh`; `docs/design-system.md` § 6, § 7, § 8;
`docs/processes/the-gig/01` step f21; ACCOUNTS.md; `docs/processes/money/03`; the
overview and decisions index regenerated.

**Verified, and how.** `sh test/run.sh` → `44 passed, 0 failed` (the new *who says
they are coming* section all ✓). `tools/uicheck.mjs` 113 ✓ and `tools/sheetcheck.mjs`
12 ✓, both pointed at the worktree's `public/`. Headless-Chrome harnesses in the
session scratchpad at 390px in both themes: Studio (42 ✓ — Gigs, Money, Profile, Live
and Setlist all paint from fixture data without a `pageerror`; *What the room said*
on Profile and not on Money; the gaps heading→chips and chips→list both 12.0px; a
78-character list name wraps with the tick still on the row), artist page (44 ✓ +
11 ✓ — no rating card, the song cards, the strip advancing and wrapping untouched, a
tap flipping `aria-pressed` and the count, a refused tap reverting with a toast),
front door (33 ✓ — gaps 12/12 with and without the install card, the button above
the row link, the pressed state surviving typing in the search box). Screenshots
were looked at, not only asserted.

**Not checked.** The signed-in Studio on myset.vip itself — Claude-in-Chrome was not
reachable this session, so the three tabs were proved in the harness with fixture
data, not on the founder's account. Safari's rendering of the bar's sheen and
drop-shadow filters (standard CSS; headless Chrome only). The live Stripe products
still say "MySet Plus" / "MySet Pro" until renamed in the dashboard (PER-011).

**Left for a human.** `studio.js` still says "limited to 4/month on the free plan"
inside the founder's own letter in the plans sheet — pre-existing, lowercase prose,
and the number already disagreed with `PLANS.free.gigs` (10); not touched. The
Puzzle side (changelog entries for 0055 and 0056, step f21 in section 41964) is the
tandem follow-up once the merge is in.
