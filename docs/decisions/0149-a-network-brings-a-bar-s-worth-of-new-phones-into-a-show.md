---
id: 0149
title: A network brings about a bar's worth of new phones into a show with free votes, and the room's head count is who is still here
date: 2026-10-03
status: proposed
decided_by: agent-recommended
area: scale
reverses:
superseded_by:
invariants: [0hw, 0af]
commits: []
tests: [test/netcap.mjs, test/contention.mjs, test/roomsize.mjs, test/cost.mjs]
files: [netlify/functions/_lib.mjs, netlify/functions/vote.mjs, netlify/functions/me.mjs, netlify/functions/show.mjs, tools/roomsim.mjs, tools/overview.mjs, test/netcap.mjs, test/contention.mjs, test/run.sh]
---

## The question

Two rows of the scale audit of 2 October 2026, one cause:

- **One script can decide a setlist.** Every new device id gets tonight's free votes, and the id is the phone's own to choose. Nothing counted by network. Fifty requests with fifty fresh ids outvote a fifty-phone room.
- **Fake devices bloat and slow a room.** Every fresh id that says "I'm here" (`/api/me?in=1`, a plain GET) writes a record that stays all night, and the head count that sets the polling rung and the board's length never forgets one. 3,001 pings from one laptop put a pub of fifty on twenty-second polls with a top-fifteen board.

The audit's fix for both: cap new devices per network per show, and count only recent presence. The founder has not chosen the cap's number; his desk offers 60, 200 or 500 and recommends 200. It is one constant, set to 200, in its own commit.

## The options

| Option | What it does | What it costs | Risk if it goes wrong |
|---|---|---|---|
| **A — chosen** | Count the network's admitted phones **inside the fan file the new phone lives in**, in the write that stamps it; admit while that is under a per-file quota worked out from the one number | No new document, no read, no write; the count is a loop over a file already in hand | The number is "about": a network's phones fall into the twelve files by chance, so the quota carries headroom (below) |
| B | A counter document per network bucket (`devnet_<artist>_<n>`), one compare-and-swap per new phone, failing open like decision 0111's limiters | One read and one write more for every new phone, on the arrival path the audit already flagged | A flood that jams the counter fails open and is let through — the case the cap exists for. Exact for a script that asks one at a time |
| C | A counter keyed by network and show (`devnet_<artist>_<show>_<net>`) | As B | A key per network per night that nothing can find again without `list()`: never deleted with the account (INVARIANT 1) |
| D | Server-signed device ids: an unsigned id gets no free votes | A new handshake on the page, which another session owns tonight | The structural answer; the audit's "later" |
| E — do nothing | | | A setlist anyone with a loop can choose |

## What was chosen, and why

A.

- **Where the count lives.** A phone's record already carries its network (`ipH`, decision 0111's `roomHash`, never the address) and the night it was stamped (`seenShow`). A phone's first write of the night — the voting page's "I'm here" (`markPresence`), or a first vote that arrives without one — counts the records in its own file stamped tonight from the same network, and is let in while that is under `NET_QUOTA`. The decision and the record are one compare-and-swap. There is no separate counter to jam, so a flood cannot slip past by contention: it only slows itself.
- **Let in means stamped.** An admitted phone is one whose `seenShow` is tonight; nothing new is stored for it. The head count, the history's phones and the network count all read the same stamp.
- **The network a phone was let in on is its network for the night.** `markPresence` used to write a phone's new network every time it changed (wifi to mobile data) — a shard write each time, which the audit flagged — and with a count per network that became a loop: let a file's worth in on one address, move them to another, and the first has room again. A stamp is now written again only when it falls due, and keeps its first network, the rule `vote.mjs` has always kept (`||=`).
- **Held out means "already spent its free votes".** The free allowance is stamped as spent on nothing (`holdOut`: `used` and `freeUsed` move by the same amount, marked `nf`). Every place that works out a fan's credits — `vote.mjs`, `buildMe`, `_requests.mjs`, the request check in `pay.mjs`, `paidUsed`, `unspentPaid`, the decline refund — then gives the right answer without a line of it changing: bought votes are spent as bought votes, counted as paid on the Studio's pill, and carried to the next show.
- **A held-out phone with nothing to keep leaves no record.** The page opens, the board is there, the Buy button works. Its record is written when it has something real — a pack, through `_pay.mjs`'s grant, as today; the next poll stamps the hold-out on it.
- **The page is told the truth.** `/api/me` works out the same verdict from the file it already read (`freeView`), so a phone held out is shown no free votes, and its tap on Buy is the one offered. A phone shown free votes can cast one (`test/netcap.mjs` checks the two agree, phone by phone). `public/vote.html` is unchanged: it already reads its free votes from this answer, and already turns a `no-credits` refusal into "Out of votes — grab more below".
- **The one number.** `NEW_DEVICES_PER_NETWORK = 200`, the founder's desk's recommendation. Set it to `Infinity` to switch the cap off.
- **The quota per file** is the smallest under which a network of exactly that many real phones, spread over the files by chance, loses on average under a tenth of a phone (`NET_QUOTA`, worked out from the binomial at load: 28 a file for 200). So a bar of two hundred on one wifi is let in whole, and a script from one network is held to the quota times the files (336 for 200) however fast it asks. The price of counting per file, said plainly: for the founder's other two choices the same rule gives 11 a file (132 from a script) for 60, and 59 a file (708) for 500.
- **What is not counted.** A request whose network cannot be named (0111's rule). The artist's own unlimited devices. Phones already stamped tonight before this deploys keep their free votes.
- **The head count is who is still here.** `countInRoom` counts phones stamped in the last `PRESENCE_WINDOW_MS`. A stamp is refreshed by the phone's own `/api/me` once it is older than that phone's due time, between ten and twenty minutes, spread by device so a room that arrived together does not come back together. **Why that window:** a phone on the page polls at least every twenty times the floor (`vote.html`'s terminal rung), with up to 20% jitter: 72 seconds in a pub, 8 minutes at the twenty-second floor. A stamp can be up to its due time plus one such poll old when it is refreshed, so the window is the latest due time plus the slowest poll, with room to spare. A phone in a pocket stops polling and drops out of the count; that is right for a dial whose job is load. A stamp written before this deploys has no time on it and counts as before.
- **The refresh is the price.** One write per phone about every quarter of an hour: about six a second spread over twelve files at 5,000 phones, against a write ceiling the audit put near seventy-five votes a second. Without it a room that arrived in the first half hour would count as empty by the second, and be told to poll every three seconds.

## What this makes harder

- The cap is approximate. A network of exactly 200 real phones loses about a tenth of a phone on average; one of 250 loses a few. A script gets about 1.7 times the number.
- A held-out phone that buys a pack and then makes a song request before its next poll could take the request's credits from the free allowance it was not given (`_requests.mjs` debits by the same formula, and the hold-out is stamped on the poll). It has paid money to get there. Closing it means calling `settleFree` in `_requests.mjs` too.
- If the artist raises the free votes mid-show, a held-out phone gets the difference, like every phone that had spent its free votes.
- One extra write per present phone every ten to twenty minutes.
- `markPresence` now decides who is let in, so anything new that stamps `seenShow` must go through `settleFree`.
- A big venue with one wifi and more than about two hundred phones on it: the phones past the quota in each file get no free votes. They can buy. The founder's number decides how often that happens.

## What would reverse it

- Server-signed device ids (option D): free votes could follow the signature and the network count could go.
- A venue that regularly fills one wifi past the number: raise it, never remove it (INVARIANT 0gx's rule).

## How it was verified

- `node --import ./test/register.mjs test/netcap.mjs`: 39 ✓, 0 ✗ — two hundred phones on one address all let in (these ids spread at most 28 to a file); a thousand fresh ids from one address: every page answered, 336 let in (exactly what the files hold), the rest shown no free votes and nothing to spend, and no record for any of them; for sixty phones sampled, what `/api/me` showed and what `/api/vote` did agree; four hundred ids that skip the page and vote meet the same cap; the stamp itself refuses to write a held-out phone with nothing to keep; a phone that moves network is not written again and frees no place; a held-out phone that buys three votes spends them as paid votes, the Studio's pill counts them, two carry to the next show, and the request check in `pay.mjs` sees the same two; mobile data, no named network and the artist's unlimited phone are let in; 3,001 pings from one address on a pub of fifty: counted 386, the 10-second rung and a 40-song board, not the slowest rung or 15; the head count's window, a stamp falling due, due times spread by device; the old `/api/show` shows a held-out phone no free votes either.
- `test/contention.mjs` gains a room: 5,000 fresh ids say "I'm here" from one address in a minute, under the simulator's latency. Every page answered (half in 87 ms, 99 in 100 in 785 ms); 336 let in, exactly the most one network can get, and 336 records in the files — none for the 4,664 held out.
- The simulator on the 0148 tree and on this one: 5,000 phones arriving from 250 addresses, all 5,000 let in, 99 in 100 in 2.13 → 2.17 s (the slowest single phone 6.1 → 8.2 s); 5,000 phones voting 1,500 times in 20 s, a fan file 139 → 149 KB (the stamp's time), 99 in 100 in 2.32 → 2.33 s; 10,000 phones at 150 a second, 279 → 298 KB a file, refused 56 → 63, within the 56 to 69 the same tree gives from run to run.
- Knock-outs, each red then restored: the count never says out (the script section fails, 1,000 of 1,000 let in); a held-out phone with nothing written anyway (the direct stamp check and *a refused vote wrote nothing* fail; the flood room leaves 363 records for 336 let in); the head count forgets nobody; `/api/me` shows the raw record (a held-out phone offered three free votes); the vote does not decide a phone (three failures: the page and the server disagree, a refused vote writes, a script that skips the page gets 400 of 400); a stamp never falls due; a phone that moves network is written with the new one (three failures, a place opens on the network it left).
- `sh test/run.sh` exited 0: 5,309 ✓, 0 ✗, in 3 min 36 s. No existing assertion changed.
- **Not checked:** a real room, a real bar's wifi, or carrier-grade NAT (many phones on mobile data sharing one address — within one show and one venue, rarely near the quota, but not measured); the refresh's write cost in the simulator (its rooms last minutes, the refresh is every quarter hour).
