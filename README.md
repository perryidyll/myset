# MySet 🎚️

**Where the crowd decides what plays next.**

MySet is a web app where a live audience votes — in real time, from the floor — on which songs a
musician or band plays next, and in what order. It doubles as an artist hub for promotion, community,
and revenue (streaming/social links, music sales, merch, tour dates, ticketing, EPK, booking).

This repository is the **live product** running at **https://myset.vip** — static pages in `public/`
plus Netlify Functions in `netlify/functions/` backed by Netlify Blobs, taking real payments via Stripe.

> **Read [`INVARIANTS.md`](INVARIANTS.md) before changing anything.** Sign-in, roles, sessions, recovery, plans, billing, venue payouts, export and delete are designed in [`ACCOUNTS.md`](ACCOUNTS.md); every session's work is recorded under `docs/sessions/`. It records storage behaviour
> that will silently lose votes if you reintroduce it, plus the money and publishing rules.

## What it actually does

- **Live crowd voting** — one shared, real-time tally across every phone in the room. Songs rank by
  votes; ties go to whichever was voted for first. Top-voted song is what the artist plays next.
- **Vote credits** — a few free votes per person per round; starting a song refreshes everyone's.
- **Replay requests** — already-played songs stay votable at a higher cost (default 5 votes).
- **Payments (Stripe)** — buy extra votes, or tip the artist. Verified server-side before anything
  is granted; each checkout redeems exactly once.
- **Artist Studio** (`/studio.html`, passcode-protected) — run the show (start top-voted, start any
  song, pause voting, undo), manage the setlist (add / hide / remove / edit artist), and tune
  settings (free votes, replay cost, gig details).
- **Search** the setlist by song title or artist.

Not built yet: multi-artist accounts, auth, audio playback, merch/ticketing.

## Run locally

It's a single static file — just open it, or serve the folder:

```bash
python3 -m http.server 8940
# then visit http://localhost:8940
```

## Deploy

The Netlify project **mysetvip** builds `main` automatically, so **pushing is
deploying**:

```bash
cd ~/Docs/MySet && npm test && git push
```

Do **not** also run `netlify deploy --prod` — that produces a second, duplicate
production deploy for the same change (INVARIANT 9d3). `netlify deploy` with no
`--prod` gives a free draft URL and is still the right way to preview.

**The publish directory is `public/` and must stay that way** (see INVARIANT 10) — publishing the
repo root once exposed docs, backups and the design handoff on the live domain.

Required environment variables (Netlify, never in the repo):
`ADMIN_CODE` (Studio passcode) and `STRIPE_SECRET_KEY` (payments; the app degrades gracefully without it).

---

> Single-artist product today: no multi-artist accounts or auth, and no audio playback.

## The documents worth knowing about

| File | What it answers |
|---|---|
| `INVARIANTS.md` | Every rule the tests enforce, and why it exists |
| `ACCOUNTS.md` | Sessions, roles, recovery, leaving — and §9, passkeys and the login rundown |
| `ACCOUNTING.md` | How money is tracked, and what is deliberately not built |
| `SECURITY.md` | Where MySet stands, the threat model, and the road to a grown-up posture |
| `docs/reports/` | The server-cost audit (2026-09-05) — what one gig costs, and at what scale |
| `tools/loadsim.py` | Reproduce every figure in that report: `python3 tools/loadsim.py` |
| `credit-burn.sh` | What is actually eating Netlify credits this billing period |
