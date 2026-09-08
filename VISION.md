# Vision — MySet

## Problem

A live audience has no say in what they hear. The musician guesses; the room takes what
it is given. Every mechanism that exists for changing that — shouting a request, a paper
list, catching the artist between songs — works for one loud person and nobody else.

At the same time a working musician has no way to turn a good night into anything that
lasts. The applause ends and there is no address, no tip jar, no list of what that room
actually wanted.

## Goal

**A live audience, in a bar, votes from their phones on which song the musician plays
next.** The musician sees the running tally on stage and plays the winner.

Everything else exists to make that sentence true in a real room: with bad wifi, with
people who will not install an app, with a performer who has one hand free between songs.

The business goal is a **$10/month product for thousands of musicians** — recurring
income that does not depend on Perry playing gigs.

## Non-goals

- **The audience will never have accounts.** Anonymity is why it works in a bar. Any
  design that needs a fan to sign in is the wrong design.
- **MySet does not play audio.** It decides what gets played; the musician plays it.
- **MySet is not the merchant of record.** Money is taken on the artist's own Stripe
  account. MySet provides infrastructure and takes a fee; it does not sell the night.
- **Not a social network.** There is no follow, no feed of artists, no DMs. The community
  page is about a night that happened, not about staying in touch.
- **Not a ticketing platform.** Gigs are listed; tickets link out.
- **No native app.** The whole product hinges on a stranger scanning a code and voting
  ten seconds later.

## Success criteria

| ID | Criterion | Target |
| --- | --- | --- |
| SC-001 | A second artist runs a paid gig end to end without Perry | 1 artist |
| SC-002 | Server cost as a share of revenue | under 10% (measured: 5.6%) |
| SC-003 | A room can be served without the app degrading | 2,000 people |
| SC-004 | Paying artists | 100, then 1,000 |
| SC-005 | A gig runs with no intervention from anyone but the artist | every gig |

## Kill criteria

Stop, or change shape, if:

- **Artists will not pay.** If a hundred artists use it free and none convert, the
  product is a feature of somebody's night out, not a business.
- **The room does not vote.** If audiences scan and do not participate, no amount of
  artist tooling saves it.
- **Cost per gig stops scaling with revenue.** The 5.6% ratio holding is what makes the
  $10 price work at all.
- **It cannot be run by one person.** If keeping it alive needs a team before it can pay
  for one, the shape is wrong.

## Audience

- **The room** — never signs in, never installs, votes within seconds of arriving.
- **The artist** — a working musician, running the show from their own phone, on stage,
  in low light, between songs, often one-handed.
- **The venue** — a bar or restaurant that books live music and wants to be found.

## Philosophy

1. **Nothing may break the gig.** Every failure degrades to *"the room can still vote"*.
   This is the ranking function for every trade-off in the product.
2. **Never show the room a button that leads to a shrug.**
3. **Anything the ROOM experiences stays free on every plan.** An audience that gets a
   sing-along at one gig and not the next learns MySet is unreliable, which costs more
   than a subscription is worth.
4. **Show locked features, never hide them.** An artist should be able to see what paying
   would get them — and greying something that actually works is the same class of lie as
   showing something that does not.
5. **Never claim what has not been run.** An honest gap beats a confident guess.
6. **Does this hold at a thousand artists, or only at one?** That question has already
   killed several ideas and reshaped others.
