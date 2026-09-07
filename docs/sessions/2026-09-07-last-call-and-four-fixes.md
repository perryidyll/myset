# Last call, a dark room, and two buttons
2026-09-07 (third pass)

Four things from Perry. Two are one-liners; two are not.

---

## 1. Last call — a ten-second countdown

**Studio → Live tab**, under the voting switch: an orange-ringed **Last call** button,
only offered while a show is actually running. Tapping it counts down on the button
itself so he can see it going and cannot fire a second one over the top of the first.

**Every phone in the room** gets a full-width gradient box at the top of the screen
with a big number ticking to zero.

Three decisions worth writing down:

**It sends time LEFT, not the moment it ends.** `show.countdownAt` is a server
timestamp, but the payload carries `countdownIn` in milliseconds. A phone whose clock
is four minutes fast would read an end time as long past and show nothing at all.

**A later poll can never shorten a running countdown.** Polls land at unpredictable
moments; a box that jumps backwards reads as broken.

**It is a nudge, not a lock.** Voting stays open when it hits zero. There is already a
switch for closing voting, and a button that silently did two things is the harder one
to explain on stage.

**Honest limit:** the audience polls every few seconds, so somebody may open on "7"
rather than "10" — and in a big room, where the poll interval is deliberately longer,
some phones will not see it at all. That is the cost of not holding a socket open per
person. A countdown is a nudge; it does not have to reach everyone to do its job.

## 2. Between shows, the room goes dark

A fan opening the page with no show running was being shown the **last one**: its
votes, its running order, its "Playing now", and the songs it had already played
missing from the list. All true of a night that is over, all wrong for the person
holding the phone.

They now see the **setlist, whole and quiet** — every song back in the list, no votes
on it, nothing claiming to be playing, and every song priced at 1 rather than at last
night's replay cost.

**Nothing is deleted to do this.** It is display, and only display: the show record is
untouched, so "Resume it instead" still finds the night exactly as the artist left it.
The Studio reads a different endpoint, so the artist always sees the truth. The test
checks the record afterwards, because that is the half that could quietly ruin a gig.

## 3. The tip button is always there

The whole dock used to disappear the moment a show ended — the exact minute somebody
decides the night was worth something. It never hides now. Between shows it is the tip
alone, across the full width, because there are no votes left to buy.

And it is now the **first thing under the name on the community page** too. Somebody
who came back to say the night was good should not have to scroll past a shop to do
something about it. Artist pages only — tipping a venue is not a thing.

That needed one change in the money path: a tip started from the community page has to
come **back** there rather than dumping the payer on the voting page. The page sends
`from:'community'`, which selects between two paths the *server* builds. It is never
used as a URL — a caller-supplied redirect is an open redirect however innocent the
caller looks.

## 4. Two small ones

**"More votes" wears an orange ring.** It sits next to the solid gradient of Tip; a
second solid fill would have made the pair read as two equal demands.

**Listen & follow moved to the top of the profile page,** in the order Instagram →
Spotify → Apple Music → YouTube Music → Website. It used to sit under the bio and every
upcoming gig, which is a long way to scroll for the one thing somebody who just watched
a set wants to do. The YouTube **videos** stay at the bottom, as asked. The Studio's
link fields were reordered to match, so what an artist fills in top to bottom is what a
fan reads left to right.

---

## Verification

- `sh test/run.sh` — green, 1,716 assertions
- **`test/darkroom.mjs`** (new, 37) — the countdown and the dark room against the real
  handlers, including the two things that must NOT happen: the countdown must not close
  voting, and going dark must not touch the show record
- **`tools/uicheck.mjs`** (new, 20) — the half no handler test can see, in a real
  browser at a 390px iPhone viewport: the box pinned to the top without reflowing the
  page, the dock surviving the end of a show, the ring on one button and not the other,
  and the link order as rendered
