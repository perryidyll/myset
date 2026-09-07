# What an open line to the room would look like
2026-09-07 · answering Perry's question after the last-call countdown

The countdown made the limit visible: phones only find out things when they next
check in, so a ten-second box reaches somebody who happens to poll inside those ten
seconds. His question was what it would take to hold a line open instead.

Short answer: **on the right platform it is roughly 200× cheaper than what we do
now, and it is the thing that actually removes the scaling problem — but it is not
the next thing to build.**

---

## 1. Netlify cannot do it, and that is not a configuration problem

A Netlify Function is request-in, response-out, and then it ends. There is no
process left alive to hold a socket. This is true of every serverless platform, not
a Netlify shortcoming — Netlify's own writing on realtime points you at a third
party for exactly this reason.

So an open line means a **second platform**, alongside Netlify. Two credible shapes:

- **Cloudflare Durable Objects** — one small always-addressable object per live
  room, holding every phone's socket. Needs Perry's own Cloudflare account, the same
  blocker as the R2 plan for clip storage.
- **A hosted realtime service** (Ably, Pusher, PubNub) — you publish, they fan out.
  No infrastructure, a monthly bill.

## 2. What would actually change in the code

**The write path barely moves.** A vote still POSTs to the Netlify function: it needs
Blobs, the ledger, Stripe. What is added is one line at the end — after the write
lands, tell the room "here is the new board".

**The read path is where everything changes.** Today every phone asks "what is the
board?" every few seconds, and the server computes the answer *once per phone, per
poll*. That is the whole scaling problem, and it is why 10,000 phones is 13 million
blob reads a night. With an open line, the board is computed **once per change** and
delivered to everyone. Server work stops being *people × time* and becomes *events*.

**Three rules that are not optional:**

1. **The line is a hint; the API is the truth.** Every message carries a version
   number. A phone that sees a gap re-fetches once through the ordinary endpoint.
   Without this, one dropped message means a phone quietly showing a wrong board for
   the rest of the night — worse than polling, not better.
2. **Polling has to stay.** Corporate wifi, captive portals, old browsers,
   backgrounded tabs. The open line is an *addition*, not a replacement, and the
   fallback has to be tested as carefully as the main path.
3. **Reconnection storms.** Ten thousand phones coming back after a wifi blip
   reconnect at the same instant. Same jitter-and-backoff lesson the polling ladder
   already learned.

## 3. The money, on real published rates

MySet's own measured baseline: **2.7¢** for a 3-hour gig with 20 people, **$4.29**
for one with 10,000 (after the signature split; it was $36.40 before).

### Cloudflare Durable Objects

Billed on three things, and the third is the surprise:

| | rate | a 3-hour gig, 10,000 people |
|---|---|---|
| compute time | $12.50 per million GB-s, 400,000 GB-s free/month | 10,800s × 0.128 GB = 1,382 GB-s = **$0.017** |
| requests in | $0.15 per million, 1M free/month; **websocket messages in count 20:1** | 10,000 connects + 50,000 votes ÷ 20 = 12,500 → **$0.002** |
| messages out | **free** | **$0** |

**About 2¢ a gig — and inside the monthly free allowances, $0.** The included
400,000 GB-s is roughly 289 three-hour gigs a month with the room object awake the
whole time, before a bill starts.

The number that matters is not how small it is. It is that **compute time is charged
per ROOM, not per person**. A 20-person gig and a 10,000-person gig cost the same
1,382 GB-s, because it is one object either way. The cost stops caring how many
people showed up.

**The real ceiling** is a soft limit of about **1,000 requests per second per
object**. Outgoing messages are not requests, so broadcasting is unconstrained; it is
*arrivals* that bite. Ten thousand people opening the page in the same ten seconds is
1,000 connections a second — exactly at the limit. A stadium room therefore has to be
split across a handful of objects, which is a known pattern but is real work.

### A hosted service (Ably, at published per-minute rates)

| | rate | a 3-hour gig, 10,000 people |
|---|---|---|
| connections | $1 per million connection-minutes | 10,000 × 180 = 1.8M = **$1.80** |
| messages | $2.50 per million **consumed** | ~1,080 board updates × 10,000 = 10.8M = **$27** |

**About $29 a gig — six times worse than what we do today.**

That is the finding worth keeping: **hosted realtime services charge for delivery.**
MySet is broadcast-shaped — one board, many watchers — so every extra person
multiplies the message bill. Cloudflare charges nothing for outgoing, so the same
shape costs nothing. For this product the two platforms are a thousand times apart,
and it is not because one is a better company.

(Ably also sells a monthly-active-user model that may price differently, and its free
tier would cover small gigs outright. The per-minute numbers above are the ones that
scale.)

## 4. What it would not fix

Every vote still does its blob reads and writes on the way in. The open line removes
the *polling* cost, which is the quadratic one; it does not make a vote cheaper.

## 5. Recommendation

**Not next.** The shared-board split already scoped (one cacheable board with no
`fan=` plus a tiny per-fan endpoint, ~5 days) takes the same problem down without a
second vendor, a second deploy pipeline, or a fallback path to maintain. The open
line is maybe 1.5–2 weeks on top of that and adds a platform to the stack.

**The order:** shared board first. Then, if a booked show is genuinely over a few
thousand people, the open line — on Cloudflare, not on a hosted service.

**The trigger is unchanged:** a booked show over 2,000 people, with a date and a
deposit.

## Sources

- Netlify Functions and websockets — https://www.netlify.com/blog/web-sockets-in-a-serverless-world/
- Cloudflare Durable Objects pricing — https://developers.cloudflare.com/durable-objects/platform/pricing/
- Cloudflare Durable Objects limits — https://developers.cloudflare.com/durable-objects/platform/limits
- Ably pricing — https://ably.com/docs/platform/pricing
