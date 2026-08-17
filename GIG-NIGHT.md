# MySet — Gig Night Cheat Sheet

## The two links

| | Link | Who |
|---|---|---|
| **Audience — homepage** | **myset.vip** | Your page: photo, gig, big VOTE button |
| **Audience — voting** | **myset.vip/vote.html** | Now playing · Up next · Vote |
| **Your studio** | **myset.vip/studio.html** | Just you. Code: see below |

Tell the room: *"Go to **myset.vip** and vote for what I play next."*
(Say it as "my set dot vip". Consider a QR code on the tip jar / table tents.)

---

## Running the show

Open **myset.vip/studio.html** on your phone, enter your show code once (it remembers).
Three tabs: **Live** (run the show) · **Setlist** (add/hide/remove songs) · **Settings**
(free votes per person, gig details, pause voting, end show).

> **Your show code is never written down in this project.** It lives only in Netlify
> under the `ADMIN_CODE` environment variable. To see or change it:
> Netlify → project **mysetvip** → Site configuration → Environment variables → `ADMIN_CODE`.

- **▶ START TOP VOTED** — the big red button. Plays whatever is winning, moves the
  current song to "Played", and **refreshes everyone's votes** for the next round.
- **▶ Start** on any row — override and start that specific song instead.
- **OPEN / PAUSE** — pause voting during a song, open it between songs. (Leaving it
  open the whole time is fine too.)
- **Add a song** — type a title, tap Add. Appears for the audience instantly.
- **Undo** — puts a played song back in the pool.
- **↺ New show** — wipes votes, purchased votes and the played list. **Run this before
  you start tonight** (already done once).
- **■ End show** — audience sees "That's a wrap".

Each fan gets **3 free votes per round**. They can un-vote to move a vote.
Votes reset every time you start a new song, so people stay engaged all night.

---

## Payments (Stripe)

**Voting works with or without this.** Until you add your key, the "More votes" and
"Tip Perry" buttons politely say payments aren't on.

To switch them on, add your Stripe **secret key** yourself — I never see it:

**Option A — one command (from `~/Docs/MySet`):**
```bash
export PATH="$HOME/.local/node/bin:$PATH" && netlify env:set STRIPE_SECRET_KEY "PASTE_YOUR_KEY" --context production --secret && netlify deploy --build --prod
```

**Option B — in the browser:**
1. Get the key at <https://dashboard.stripe.com/apikeys> ("Secret key", starts `sk_live_…`).
2. Netlify → project **mysetvip** → Site configuration → Environment variables →
   Add `STRIPE_SECRET_KEY`.
3. Trigger a redeploy.

Then the buttons go live:
- **Extra votes** — $3 → 5 votes, $7 → 15 votes (credited automatically on return)
- **Tips** — $5 / $10 / $20 / custom, with an optional note you'll see on stage

Money lands in your Stripe account. Payment is verified server-side before any votes
are granted, and each checkout can only be redeemed once.

> Test it with **one real $3 purchase on your own phone** before the doors open.
> Use `sk_test_…` first if you want a dry run (test cards won't move real money).

---

## If something goes wrong

- **Nobody's votes are showing** — check OPEN is selected on stage control.
- **A phone looks stuck** — pull to refresh. The page re-polls every 3s on its own.
- **Someone used all their votes** — they refresh when you start the next song.
- **Total meltdown** — the show still works as a normal setlist; just play on. Nothing
  in the app can break your gig.

---

## What's under the hood

- Static page + Netlify Functions, state in Netlify Blobs. No database to babysit.
- Votes are sharded per-fan with compare-and-swap **and read-back verification** —
  load-tested at **80 simultaneous voters with zero lost votes**.
- Everyone polls every 3 seconds, so the room sees the same tally within ~3s.
