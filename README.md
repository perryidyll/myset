# MySet 🎚️

**Where the crowd decides what plays next.**

MySet is a web app where a live audience votes — in real time, from the floor — on which songs a
musician or band plays next, and in what order. It doubles as an artist hub for promotion, community,
and revenue (streaming/social links, music sales, merch, tour dates, ticketing, EPK, booking).

This repository contains a self-contained, single-file front-end **prototype** (`index.html`) — no build
step, no dependencies. Open it in any browser or drop it on any static host.

## Highlights

- **Live crowd voting** — ranked queue that reorders by votes, vote windows, "every Nth song is a
  crowd pick", vote credits (e.g. `10/10 left`), and a guaranteed-encore mode.
- **In-the-moment revenue** — a prominent **Boost a song** action and a **Tip the band** jar
  (revenue-share / 100%-to-artist), plus per-song boosts.
- **Engagement** — per-song emoji reactions and comments, plus a "Played tonight" list with a
  1–3 tier performance rating (👍🏼 / 🙌🏼🙌🏼 / 🤘🏼🤘🏼🤘🏼).
- **Multi-cam + livestream** — an in-app multi-camera placeholder player and an embedded
  YouTube/Twitch livestream so remote fans can watch and still vote / boost / tip.
- **Artist profile** — streaming, social, and music-purchase links (Bandcamp, iTunes, Amazon Music),
  merch, tour dates + ticketing, community feed, and a shareable EPK with booking requests.
- **Artist Studio** — manage the setlist pool, configure voting rules, and see insights.
- **Design** — minimal, premium, Apple-esque. Light/dark theme toggle; the live "venue" view stays in
  a dark, neon-ambient mode. State persists in `localStorage` and syncs across browser tabs (open two
  tabs to see the crowd ↔ stage sync live).

## Run locally

It's a single static file — just open it, or serve the folder:

```bash
python3 -m http.server 8940
# then visit http://localhost:8940
```

## Deploy

Any static host works. For **Netlify**, drag-and-drop this folder (or just `index.html`) onto
https://app.netlify.com/drop, or connect this repo — no build command, publish directory `/`.

---

> Prototype only: mock data, no backend/auth/payments/real audio yet.
