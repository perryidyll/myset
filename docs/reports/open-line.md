# What an open line to the room would look like

**The full report is [`open-line.html`](open-line.html)** — open it in a browser. This
file is the one-screen version so a reader in a terminal is not left with nothing.

Written 2026-09-07 after the last-call countdown made the limit visible; rewritten and
greatly extended 2026-09-08 with the Cloudflare mechanics, the scaling questions Chris
raised, and error tracking.

---

**Netlify cannot hold a socket at all.** A function is request-in, response-out, and then
it ends. An open line means a second platform.

**Cloudflare Durable Objects: about 1.9¢ for a 3-hour 10,000-person gig**, against $4.29
today — and $0 inside the monthly free allowance. Two facts do the work:

- **Duration is billed per ROOM, not per person**, so from about 200 people upward the
  cost stops moving. A 200-person gig and a 10,000-person gig both cost about 1.8¢.
- **Outgoing messages are free**, and MySet is one board watched by everybody.
- **Hibernation** means a quiet gig pays almost nothing: the phones stay connected while
  the program itself is evicted, and nothing accrues while it sleeps.

**A hosted realtime service (Ably) is about $29 a gig — six times worse than today**,
because they charge per message *delivered*.

**The real ceiling is ~1,000 requests per second per object** — arrivals, not broadcasts.
And a Durable Object lives in **one** data centre with no documented automatic failover,
so **the open line cannot be the only way to see the board**. Polling stays as the floor.

**Error logs are the urgent gap.** Netlify keeps function logs for **24 hours**, and Log
Drains are Enterprise-only — so a bug reported the morning after a gig is already
unprovable. Sentry's free tier (5,000 errors/month, 30-day retention) closes it, and it
can be done in ~40 lines with no new dependency.

## The order

1. **Error tracking** — ~1 day, no new dependency, free
2. **A rate limit on casting** — ~half a day, closes a denial-of-wallet hole
3. **The shared-board split** — ~5 days, no new vendor, gates the plan room sizes
4. **Clips onto Cloudflare R2** — ~2 days, opens the Cloudflare account
5. **The open line** — 1.5–2 weeks. Trigger unchanged: **a booked show over 2,000 people,
   with a date and a deposit**

Decision record: [`../decisions/0012-an-open-line-to-the-room-is-not-next.md`](../decisions/0012-an-open-line-to-the-room-is-not-next.md).
