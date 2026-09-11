#!/usr/bin/env python3
"""What one gig actually costs on Netlify — and where the reads stop it working.

    python3 tools/loadsim.py                 # the standard 3-hour bar set, 20 phones
    python3 tools/loadsim.py --fans 200 --hours 4
    python3 tools/loadsim.py --shows 1000    # what a month at scale costs
    python3 tools/loadsim.py --legacy        # the page as it polled BEFORE the split
    python3 tools/loadsim.py --ceiling       # walk room sizes and find where reads outrun the store

SINCE 2026-09-11 EVERY TICK IS TWO REQUESTS (P3-001, the shared-board split). The
board is /api/board — the same bytes for every phone, no fan id, served from the
edge for the length of the polling interval, so it is RENDERED about once per
interval for the whole room and every other request for it is a cache hit with no
compute and no reads behind it. What is personal is /api/me — small, never cached,
one shard read instead of twelve. The ladder itself is unchanged; the page fires
both calls on every tick it would have fired one.

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
    poll payload on the wire   2,530 bytes   curl against production 2026-09-05 (the old /api/show)
    poll billed duration         155 ms      measured inside a live function
                                             (_lib.mjs / show.mjs comments)
    function memory              1 GB        Netlify default
    one strong blob read          42 ms      measured 2026-09-01; 13 in parallel, 64 ms

DERIVED FOR THE SPLIT (measured pieces, arithmetic on top — say so when quoting):
    board payload              0.86 x the old poll   measured ratio on a 40-song room in
                                                     test/blobs-fake (7,314 vs 8,529 bytes)
    personal payload             430 bytes           measured, same room, one vote held
    board render duration        155 ms              the same reads the old poll did
    personal call duration        50 ms              ESTIMATED: two parallel strong reads
                                                     (42 ms) plus overhead. NOT measured
                                                     in production yet — see P3-001 notes
    show record                6,287 bytes           measured, 40 songs
    one fan's record         101 + ~240 per cast     MEASURED 2026-09-11 on the real write
                                                     path: 101 bytes present-only, 412 after
                                                     one cast, 864 after three, 2,010 after
                                                     eight. The cast receipts kept for
                                                     idempotency (INVARIANT 15h, up to 20)
                                                     are most of it. The room-ceiling report
                                                     assumed 152 — right for a phone that
                                                     watched, wrong for one that voted

WHERE IT ACTUALLY BREAKS. Cost was survivable at every room size even before the
split; READS were not. The store has to move (people / interval) x (bytes read per
poll) to answer the room, and before the split every poll re-read the whole
audience bag, so that grew with the SQUARE of the room. The room-ceiling report
(docs/reports/room-ceiling.html) drew the line at ~50 MB/s sustained, the busiest
band MySet is known to serve, and put the honest ceiling at ~2,500 people. The
`--ceiling` walk below reproduces that column at the report's own record size, and
then does the same sum twice more — for the split, where a poll reads one shard (a
twelfth of the bag) and the whole bag is read once per interval for the room rather
than once per phone; and at the record size the vote path actually writes today,
which is where the honest number lives. The bag grows with how much the room VOTES,
not only with how many people are in it.
"""
import argparse, random

# ---- credit rates -----------------------------------------------------------
CR_REQ_PER_10K   = 2.0
CR_BW_PER_GB     = 20.0
CR_COMPUTE_GBHR  = 10.0
CR_DEPLOY        = 15.0
USD_PER_CREDIT   = {'personal': 0.0100, 'pro': 0.006667}

# ---- measured inputs --------------------------------------------------------
POLL_BYTES   = 2530          # the old one-call poll, on the wire
POLL_MS      = 155           # ...and what it billed; a board RENDER costs the same
FN_MEM_GB    = 1.0
# ---- the split (see the docstring for which of these is measured) ------------
BOARD_BYTES  = int(POLL_BYTES * 0.86)   # the board is the old poll minus the personal fields
ME_BYTES     = 430
ME_MS        = 50            # ESTIMATED, not measured — two parallel 42 ms reads + overhead
SHOW_DOC     = 6287          # bytes the store moves for the show record
REPORT_FAN   = 152           # bytes per fan record the room-ceiling report assumed
REC_BASE     = 101           # measured: a phone that only watched
REC_PER_CAST = 240           # measured: what each cast adds (a fit to 412/864/2010 at 1/3/8)
SHARDS       = 12            # a personal poll reads ONE of these
KNOWN_OK_MBS = 50.0          # the band MySet is known to serve; where the ceiling is drawn
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


def one_phone(hours, rng, look_share, votes, activity_per_min, floor=3.0, times=None):
    """Walk the real ladder for one person for the whole gig.

    look_share       fraction of the gig their screen is on and MySet is in front
    activity_per_min how often ANYTHING changes in the room (a vote from anyone,
                     a song change) — this is what resets QUIET to 0 for everybody
    times            if given, every poll's moment is appended, so the gig can count
                     how many of them found the board's edge copy already expired
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
        if times is not None: times.append(t)
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

def board_renders(times, ttl):
    """How often the board is actually RENDERED: the first request after the edge
    copy expires goes to the function, everything inside the interval is a hit.
    With stale-while-revalidate that is one render per interval while anybody is
    polling at all, which for any room bigger than a table is every interval."""
    times.sort()
    renders, last = 0, -1e9
    for t in times:
        if t >= last + ttl:
            renders += 1; last = t
    return renders

def record_bytes(votes_each):
    """One fan's record, as the vote path writes it — every vote a separate cast,
    which is the heaviest honest reading of `votes_each`."""
    return REC_BASE + REC_PER_CAST * votes_each

def gig(fans=20, hours=3.0, look_share=0.22, votes_each=2.5, seed=7, split=True, fan_bytes=None):
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
    polls, times = 0, []
    for _ in range(fans):
        p, _ = one_phone(hours, rng, look_share, votes_each, activity_per_min, floor, times)
        polls += p
    votes = int(round(fans * votes_each))
    secs  = hours * 3600
    bag   = fans * (fan_bytes if fan_bytes else record_bytes(votes_each))
    if split:
        # two requests a tick: the board (a hit unless the edge copy has expired,
        # then one render for the whole room) and the small personal call
        renders = board_renders(times, floor)
        reqs  = 2 * polls + votes + fans * PAGE_REQS
        byts  = polls * (BOARD_BYTES + ME_BYTES) + votes * VOTE_BYTES + fans * PAGE_BYTES
        fn_ms = renders * POLL_MS + polls * ME_MS + votes * VOTE_MS
        # what the store moves: one shard + the show record per personal poll, the
        # whole bag + the show record per render
        read_b = polls * (SHOW_DOC + bag / SHARDS) + renders * (bag + SHOW_DOC)
    else:
        renders = polls                              # every poll re-read the whole room
        reqs  = polls + votes + fans * PAGE_REQS
        byts  = polls * POLL_BYTES + votes * VOTE_BYTES + fans * PAGE_BYTES
        fn_ms = polls * POLL_MS + votes * VOTE_MS
        read_b = polls * bag                          # the ceiling report's own sum
    return dict(polls=polls, renders=renders, votes=votes, reqs=reqs, bytes=byts, fn_ms=fn_ms,
                credits=credits(reqs, byts, fn_ms), fans=fans, hours=hours,
                read_mbs=read_b / secs / 1e6, split=split)

def show(g, label):
    c = g['credits']
    print(f"  {label}")
    print(f"    {g['fans']} phones x {g['hours']:g}h -> {g['polls']:,} polls "
          f"({g['polls']/g['fans']:.0f} each, one every {g['hours']*3600/max(g['polls']/g['fans'],1):.0f}s of gig)")
    if g['split']:
        print(f"    {g['renders']:,} board renders for the whole room — "
              f"{100*(1-g['renders']/max(g['polls'],1)):.0f}% of board requests were edge hits")
    print(f"    {g['reqs']:,} web requests | {g['bytes']/1e6:.1f} MB | "
          f"{g['fn_ms']/1000/60:.1f} function-minutes | store moves {g['read_mbs']:.2f} MB/s")
    print(f"    = {c:.3f} credits  = ${c*USD_PER_CREDIT['personal']:.4f} (Personal) "
          f"/ ${c*USD_PER_CREDIT['pro']:.4f} (Pro)")
    print()

def ceiling_walk(hours=3.0):
    """The room-ceiling report's column, before and after the split: the busiest
    case (every screen on, very busy room, eight votes a head) and what the store
    has to move per second to answer it. The honest ceiling is where that crosses
    KNOWN_OK_MBS — at the record size the vote path writes, not the one the report
    assumed."""
    sizes = [200, 500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 10000]
    heavy = record_bytes(8)
    for label, fan_bytes in [("at the report's assumed record: 152 bytes a fan — reproduces docs/reports/room-ceiling.html", REPORT_FAN),
                             (f"at today's measured record: {heavy:,} bytes for a fan who cast eight times — the honest line", heavy)]:
        print(f"THE ROOM CEILING  (busiest case: every screen on, very busy room)")
        print(f"  {label}")
        print()
        print(f"  {'people':>7}  {'bag':>8}  {'before: reads':>14}  {'after: reads':>13}  {'before $':>9}  {'after $':>8}")
        first_over = {'before': None, 'after': None}
        for n in sizes:
            b = gig(n, hours, look_share=1.0, votes_each=8, split=False, fan_bytes=fan_bytes)
            a = gig(n, hours, look_share=1.0, votes_each=8, split=True, fan_bytes=fan_bytes)
            flag_b = ' !' if b['read_mbs'] > KNOWN_OK_MBS else '  '
            flag_a = ' !' if a['read_mbs'] > KNOWN_OK_MBS else '  '
            if b['read_mbs'] > KNOWN_OK_MBS and first_over['before'] is None: first_over['before'] = n
            if a['read_mbs'] > KNOWN_OK_MBS and first_over['after'] is None: first_over['after'] = n
            print(f"  {n:>7,}  {n*fan_bytes/1e6:>6.1f}MB  {b['read_mbs']:>10.1f} MB/s{flag_b}"
                  f"  {a['read_mbs']:>9.1f} MB/s{flag_a}  ${b['credits']*USD_PER_CREDIT['pro']:>8.2f}  ${a['credits']*USD_PER_CREDIT['pro']:>7.2f}")
        print()
        print(f"  '!' = past the {KNOWN_OK_MBS:.0f} MB/s the store is known to serve.")
        for k, v in first_over.items():
            print(f"  {k}: first size over the line is {v:,}" if v else f"  {k}: never over the line up to {sizes[-1]:,}")
        print()
    print("  The per-phone cost is still O(people) — a personal poll reads one shard, and the shard")
    print("  holds a twelfth of the room — so the shape is still a curve; it is a twelfth as steep.")
    print("  And the bag grows with VOTES as well as people: the cast receipts kept on a record for")
    print("  idempotency are most of its weight. Trimming them is the cheapest next lever (P3-013);")
    print("  a per-fan document, or the open line, is what makes the curve flat.")
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
    # Netlify, as billed since the split (or before it, with --legacy)
    out['Netlify (today)'] = g['credits'] * USD_PER_CREDIT['pro']
    # Cloudflare Workers + KV: requests $0.30/M, CPU $0.02/M ms, KV reads $0.50/M,
    # egress free
    kv = (g['renders'] * READS_PER_POLL + g['polls'] * 2) if g['split'] else g['polls'] * READS_PER_POLL
    out['Cloudflare Workers + KV'] = (g['reqs'] / 1e6 * 0.30
                                      + g['polls'] * CPU_MS_PER_POLL / 1e6 * 0.02
                                      + kv / 1e6 * 0.50)
    # Cloudflare Durable Objects: the show lives in memory, so the reads stop
    # existing. $0.15/M requests + duration
    out['Cloudflare Durable Objects'] = (g['reqs'] / 1e6 * 0.15
                                         + g['polls'] * CPU_MS_PER_POLL / 1e6 * 0.02)
    # The other shape of the same gig on the same platform, for comparison: the
    # one-call poll the page made before 2026-09-11, or the split if --legacy
    other = gig(g['fans'], g['hours'], split=not g['split'])
    out['Netlify, ' + ('before the split' if g['split'] else 'with the split')] = other['credits'] * USD_PER_CREDIT['pro']
    return out

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--fans', type=int, default=20)
    ap.add_argument('--hours', type=float, default=3.0)
    ap.add_argument('--shows', type=int, default=0)
    ap.add_argument('--legacy', action='store_true', help='the one-call poll, as the page was before the split')
    ap.add_argument('--ceiling', action='store_true', help='walk room sizes and find where the reads outrun the store')
    a = ap.parse_args()
    split = not a.legacy

    print(__doc__.split('MEASURED INPUTS')[0].split('\n\n')[0])
    print()
    if a.ceiling:
        ceiling_walk(a.hours)
        raise SystemExit(0)
    print("ONE GIG" + ("" if split else "  (--legacy: the one-call poll, before the split)"))
    print()
    base = gig(a.fans, a.hours, split=split)
    show(base, f"as the ladder actually behaves ({a.fans} phones, {a.hours:g} hours)")
    show(gig(a.fans, a.hours, look_share=0.60, split=split), "if everyone stares at it (60% screen-on)")
    show(gig(a.fans, a.hours, look_share=1.00, votes_each=8, split=split),
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
    if base['split']:
        print(f"  {base['renders']*READS_PER_POLL + base['polls']*2:,} blob reads per gig — {READS_PER_POLL} per board render, 2 per personal poll (test/cost.mjs).")
    else:
        print(f"  {base['polls']*READS_PER_POLL:,} blob reads per gig — {READS_PER_POLL} per poll (test/cost.mjs).")
    print("  That, not the logo on the invoice, is what a bill at scale is made of.")
