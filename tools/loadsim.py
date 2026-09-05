#!/usr/bin/env python3
"""What one gig actually costs on Netlify.

    python3 tools/loadsim.py                 # the standard 3-hour bar set, 20 phones
    python3 tools/loadsim.py --fans 200 --hours 4
    python3 tools/loadsim.py --shows 1000    # what a month at scale costs

WHY A SIMULATOR AND NOT ARITHMETIC. The audience page does NOT poll on a fixed
interval. public/vote.html walks a ladder — 3s while something is moving, 10s,
then 25s once the room goes quiet — and it stops entirely while the screen is
off. Multiplying 20 phones by 3600 seconds over 3 seconds gives 72,000 polls and
is wrong by more than an order of magnitude. The only honest way to get the
number is to run the ladder the page actually runs, against a model of what a
person in a bar actually does with their phone.

THE LADDER, COPIED FROM public/vote.html (keep these in step):
    FLOOR   = pollFloorFor(heads) -- the SERVER sends it, the page obeys it:
              3000ms up to 200 people, 5000 to 1,000, 10000 to 3,000, else 20000
    base    = FLOOR if QUIET < 2 else FLOOR*10/3 if QUIET < 6
              else FLOOR*25/3 if QUIET < 20 else FLOOR*20   (the terminal rung)
    wait    = base * (0.8 + random()*0.4)                   (+/-20% jitter)
    tick(): if document.hidden -> no request, just reschedule
            else -> request; QUIET++ if the signature is unchanged, else QUIET=0
    visibilitychange (screen on) -> wakeUp(full=True)  -> QUIET = 0
    pointerdown (any tap/scroll) -> wakeUp(full=False) -> QUIET = 2 only if QUIET >= 6

WHICH SIGNATURE RESETS THE LADDER, WHICH IS THE WHOLE COST CURVE:
    In a small room (FLOOR == 3000) it is `signature()` -- the tally included, so a
    vote by ANYONE resets EVERY phone. That is the product, and at eight people it
    costs nothing.
    In a bigger room it is `stageSig()` -- the artist's actions and this phone's own
    credits only. The board still redraws; it stops accelerating the room. Without
    this the upper rungs are unreachable in any busy room and the ladder is a fixed
    3-second poll wearing a ladder's clothes.

CREDIT RATES — Netlify credit-based pricing, read 2026-09-05:
    web requests      2 credits / 10,000
    web bandwidth    20 credits / GB
    functions compute 10 credits / GB-hour
    production deploy 15 credits each
    Personal $9/mo = 1,000 credits, top-ups 500 for $5 ($0.0100/credit)
    Pro      $20/mo = 3,000 credits, top-ups 1,500 for $10 ($0.0067/credit)

MEASURED INPUTS (not guessed):
    poll payload on the wire   2,530 bytes   curl against production 2026-09-05
    poll billed duration         155 ms      measured inside a live function
                                             (_lib.mjs / show.mjs comments)
    function memory              1 GB        Netlify default
"""
import argparse, random

# ---- credit rates -----------------------------------------------------------
CR_REQ_PER_10K   = 2.0
CR_BW_PER_GB     = 20.0
CR_COMPUTE_GBHR  = 10.0
CR_DEPLOY        = 15.0
USD_PER_CREDIT   = {'personal': 0.0100, 'pro': 0.006667}

# ---- measured inputs --------------------------------------------------------
POLL_BYTES   = 2530
POLL_MS      = 155
FN_MEM_GB    = 1.0
# the one-off cost of arriving: HTML + css + js + sw, gzipped, all from the CDN
# (web requests + bandwidth, NO function compute), then one profile-ish call
PAGE_REQS    = 6
PAGE_BYTES   = 48_000
# a cast: POST /api/vote (a write, so longer) plus the poll it triggers
VOTE_MS      = 260
VOTE_BYTES   = 1200

def credits(reqs, byte_count, fn_ms):
    return (reqs / 10_000 * CR_REQ_PER_10K
            + byte_count / 1e9 * CR_BW_PER_GB
            + fn_ms / 1000 / 3600 * FN_MEM_GB * CR_COMPUTE_GBHR)

def poll_floor(heads):
    """Mirrors pollFloorFor in netlify/functions/_lib.mjs. Keep in step."""
    if heads <= 200:  return 3.0
    if heads <= 1000: return 5.0
    if heads <= 3000: return 10.0
    return 20.0


def one_phone(hours, rng, look_share, votes, activity_per_min, floor=3.0):
    """Walk the real ladder for one person for the whole gig.

    look_share       fraction of the gig their screen is on and MySet is in front
    activity_per_min how often ANYTHING changes in the room (a vote from anyone,
                     a song change) — this is what resets QUIET to 0 for everybody
    """
    total_s = int(hours * 3600)
    t, quiet, polls = 0.0, 0, 0
    looking = False
    next_flip = rng.expovariate(1 / 25.0)          # glances average ~25s
    while t < total_s:
        base = (floor if quiet < 2
                else floor * 10 / 3 if quiet < 6
                else floor * 25 / 3 if quiet < 20
                else floor * 20)
        wait = base * (0.8 + rng.random() * 0.4)          # jitter, as the page does
        t += wait
        # screen on/off flips independently of the timer
        while next_flip < t:
            looking = not looking
            # a glance is ~25s, the gap between glances is set by look_share
            mean = 25.0 if looking else 25.0 * (1 - look_share) / max(look_share, 1e-6)
            next_flip += rng.expovariate(1 / max(mean, 1.0))
            if looking:
                quiet = 0                           # visibilitychange -> wakeUp(full)
        if not looking:
            continue                                # document.hidden -> no request
        polls += 1
        # did anything in the room change since the last poll? if so QUIET resets
        p_change = 1 - pow(2.718281828, -activity_per_min / 60.0 * wait)
        if rng.random() < p_change:
            quiet = 0
        else:
            quiet += 1
        # a tap or a scroll while looking: only lifts the deep-sleep rung
        if rng.random() < 0.12 and quiet >= 6:
            quiet = 2
    return polls, votes

def gig(fans=20, hours=3.0, look_share=0.22, votes_each=2.5, seed=7):
    rng = random.Random(seed)
    floor = poll_floor(fans)
    if floor <= 3.0:
        # SMALL ROOM: every cast by anyone changes the signature for everyone. This
        # is the product working, and at these sizes it costs a fraction of a cent.
        activity_per_min = fans * votes_each / (hours * 60)
    else:
        # BIG ROOM: only the artist's actions and this phone's OWN casts reset the
        # ladder (stageSig). A song change every four minutes, plus this one fan's
        # votes spread over the night. Everyone else's votes redraw the board
        # without waking anybody.
        activity_per_min = 0.25 + votes_each / (hours * 60)
    polls = 0
    for _ in range(fans):
        p, _ = one_phone(hours, rng, look_share, votes_each, activity_per_min, floor)
        polls += p
    votes = int(round(fans * votes_each))
    reqs  = polls + votes + fans * PAGE_REQS
    byts  = polls * POLL_BYTES + votes * VOTE_BYTES + fans * PAGE_BYTES
    fn_ms = polls * POLL_MS + votes * VOTE_MS
    return dict(polls=polls, votes=votes, reqs=reqs, bytes=byts, fn_ms=fn_ms,
                credits=credits(reqs, byts, fn_ms), fans=fans, hours=hours)

def show(g, label):
    c = g['credits']
    print(f"  {label}")
    print(f"    {g['fans']} phones x {g['hours']:g}h -> {g['polls']:,} polls "
          f"({g['polls']/g['fans']:.0f} each, one every {g['hours']*3600/max(g['polls']/g['fans'],1):.0f}s of gig)")
    print(f"    {g['reqs']:,} web requests | {g['bytes']/1e6:.1f} MB | "
          f"{g['fn_ms']/1000/60:.1f} function-minutes")
    print(f"    = {c:.3f} credits  = ${c*USD_PER_CREDIT['personal']:.4f} (Personal) "
          f"/ ${c*USD_PER_CREDIT['pro']:.4f} (Pro)")
    print()

# ---- what the same gig would cost somewhere else -----------------------------
# Rates read 2026-09-05. The point of this table is NOT to shop for a host: it is
# to show that the platform is not the cost driver. FIFTEEN BLOB READS PER POLL is
# (test/cost.mjs pins the number). On Netlify they are folded into the 155ms of
# billed compute; on Cloudflare KV they are an itemised $0.50/million and become
# the single biggest line. The only architecture that makes them disappear is one
# that keeps the show in memory — a Durable Object, or a cache in front of the poll.
READS_PER_POLL = 15          # test/cost.mjs, ceiling 15
CPU_MS_PER_POLL = 10         # CPU only, not the wall time spent waiting on I/O

def elsewhere(g):
    out = {}
    # Netlify, as billed today
    out['Netlify (today)'] = g['credits'] * USD_PER_CREDIT['pro']
    # Cloudflare Workers + KV: requests $0.30/M, CPU $0.02/M ms, KV reads $0.50/M,
    # egress free
    kv = g['polls'] * READS_PER_POLL
    out['Cloudflare Workers + KV'] = (g['reqs'] / 1e6 * 0.30
                                      + g['polls'] * CPU_MS_PER_POLL / 1e6 * 0.02
                                      + kv / 1e6 * 0.50)
    # Cloudflare Durable Objects: the show lives in memory, so the reads stop
    # existing. $0.15/M requests + duration
    out['Cloudflare Durable Objects'] = (g['reqs'] / 1e6 * 0.15
                                         + g['polls'] * CPU_MS_PER_POLL / 1e6 * 0.02)
    # Netlify with the poll split + a 3s edge cache: same platform, a third of the
    # compute and a tenth of the reads (PERFORMANCE-PLAN.md #10 and #11)
    out['Netlify, poll fixed'] = credits(g['reqs'], g['bytes'] * 0.4, g['fn_ms'] * 0.35) * USD_PER_CREDIT['pro']
    return out

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--fans', type=int, default=20)
    ap.add_argument('--hours', type=float, default=3.0)
    ap.add_argument('--shows', type=int, default=0)
    a = ap.parse_args()

    print(__doc__.split('MEASURED INPUTS')[0].split('\n\n')[0])
    print()
    print("ONE GIG")
    print()
    base = gig(a.fans, a.hours)
    show(base, f"as the ladder actually behaves ({a.fans} phones, {a.hours:g} hours)")
    show(gig(a.fans, a.hours, look_share=0.60), "if everyone stares at it (60% screen-on)")
    show(gig(a.fans, a.hours, look_share=1.00, votes_each=8),
         "absolute worst case: every screen on the whole gig, very busy room")

    print("WHAT A MONTH LOOKS LIKE")
    print()
    dep = 104  # measured production deploys for mysetvip, Aug 8 - Sep 5
    for shows_per_month, who in [(20, "Perry alone, ~5 gigs a week"),
                                 (200, "10 artists"),
                                 (2000, "100 artists"),
                                 (20000, "1,000 artists"),
                                 (200000, "10,000 artists — the $10/mo SaaS")]:
        c = base['credits'] * shows_per_month
        print(f"  {who:<34} {shows_per_month:>7,} gigs = {c:>9,.0f} credits"
              f"  = ${c*USD_PER_CREDIT['pro']:>9,.2f}/mo of gig traffic")
    print()
    print(f"  For scale: {dep} production deploys in the last billing period "
          f"= {dep*CR_DEPLOY:,.0f} credits.")
    print(f"  That is {dep*CR_DEPLOY/base['credits']:,.0f} gigs' worth of audience traffic, "
          f"spent on shipping code.")
    print()
    print("THE SAME GIG SOMEWHERE ELSE  (and why the host is not the point)")
    print()
    for k, v in elsewhere(base).items():
        print(f"  {k:<30} ${v:.4f} per gig   ${v*200000:>10,.0f}/mo at 10,000 artists")
    print()
    print(f"  {base['polls']*READS_PER_POLL:,} blob reads per gig — {READS_PER_POLL} per poll (test/cost.mjs).")
    print("  That, not the logo on the invoice, is what a bill at scale is made of.")
