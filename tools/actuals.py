#!/usr/bin/env python3
"""Real numbers from real shows, in the shape finance/model.html expects.

    python3 tools/actuals.py                  # print the JSON to paste into the model
    python3 tools/actuals.py --write          # also save finance/actuals.json
    python3 tools/actuals.py --mark "before Sat gig"   # record one bandwidth reading (see below)
    python3 tools/actuals.py --mark "after Sat gig" --studio-min 140 --clip-views 0   # …how long the Studio Live tab was up, and whether anyone watched a posted clip
    python3 tools/actuals.py --marks          # list the readings on file
    tools/mark.sh before|start|after "venue" [Studio minutes]   # the founder's own way: no git, from any folder (see the script)

WHAT IT READS (all read-only, nothing in production is changed):
  · every artist's show history in the production store (the `hist_*` documents),
    via the Netlify CLI that is already signed in on this Mac — the same way
    tools/prod.py works;
  · production deploys across the WHOLE account from Netlify's API (all five sites
    share one credit grant, so the plan decision is account-wide);
  · the account's bandwidth counter, when you ask for a --mark.

WHAT IT PRODUCES — the fields the model's "Real shows" panel understands:
  shows              nights that actually happened (rules below)
  people             average phones per night  (the room count when the app kept
                     one; the peak voter count before that existed)
  hours              average length of a night, in hours
  roomFree/Plus/Pro  $ the room spent PER PERSON PER NIGHT (tips + packs ÷ phones),
                     by the artist's plan — the unit the dials use since model v2
  roomPerHead        the same across every plan, so one night of data is usable no
                     matter which plan the artist is on (Perry is comped Pro)
  deploys            production deploys per 30 days, account-wide, trailing 30 days
                     (NOT this billing period ÷ days elapsed: on the first evening
                     of a period that turned 3 deploys into 90 a month)
  interactions       votes + song requests per phone per night — the model's
                     `interactions` dial (writes per phone), measured
  votes, songs, setHours, recordHours, nets, peakVoters, gigsOnCalendar, gigsUsed
                     averages for the report; only people/hours/interactions/room/
                     deploys/pollsPerPhoneHour move a dial
  pollsPerPhoneHour  AUDIENCE ticks (board + personal call) per phone per hour — from Netlify's own
                     per-day request meter (a gig day minus an empty day; THE METER METHOD below), or
                     from the bandwidth marks that bracket a night when a quiet pair sits within 48 h
                     of the bracket (THE BANDWIDTH METHOD); `pollsSource` says which
  creditsPerShow     traffic credits one night adds over an empty day, by the same meters — requests,
                     compute and bandwidth; never a deploy (null until the per-day meters are on file)
  shipping           the deploys and their credits (30 days, this billing period, per day) —
                     THE SHIPPING BILL. Never divided by shows; never in a per-show figure
  traffic            the bandwidth counter this period, in bytes, GB and credits — the one
                     traffic meter the API exposes (requests and compute: dashboard only)
  asOf, source, note, nights, notCounted, marks

SINCE 25 SEP 2026 (decision 0095) THE SAME RULE RUNS ON THE SERVER: netlify/functions/_nightrule.mjs
judges every filed night for the register (myset.vip/moneymodel/shows), which feeds the money
model live; test/everyshow.mjs and tools/actuals-test.py pin the two to the same answers on
finance/fixtures/2026-09-11 and 2026-09-25. Two known differences, on purpose: this script
expands a calendar by weekday only (weekly/biweekly rules; no `until`, no monthly), where the
server uses the scheduler's own expansion — the same answer on every calendar so far; and
this script cannot see a night the artist hid from their Money tab (`hidden` on the index
row) — the register counts it too and shows it greyed, so the totals agree.

WHICH NIGHTS COUNT. The founder's rule (11 Sep): only a show that lines up with a gig he
PUBLISHED counts. A show started at a random time of day, or that ran for an inordinate
stretch, was him starting and ending a show by hand to test something. So a night
counts only if it started on the day of a gig on the artist's calendar (`ev_<artist>`,
the same document the scheduler reads), no earlier than 90 minutes before that gig's
start and no later than its scheduled end. A night on the calendar whose room never
used the app (one phone, no votes) is listed separately as `onCalendarUnused` and is
NOT averaged in — it is real, but it says nothing about a room that did use it.
A night's LENGTH is the record when the artist ended it inside the slot. When the
record overran the slot (since 4 Sep a show ends itself three hours after the gig's
scheduled end, so a 3-hour gig leaves a 6-hour record) it is the later of the slot and
the last song anyone started — a room still voting an hour past the slot was still a
room; an empty page left open was not. `setHours` (first song to last) and
`recordHours` are kept alongside for the report; neither is fed to a dial.
Two records inside one published slot (an accidental End then Start) are ONE night:
earliest start, latest end, phones = the larger count, votes and songs summed.
Published gigs that left no record at all (`silentNights`) are listed from the
calendar so nights-per-week is counted from what was published, not what was filed.
The archive rule (nothing happened is not a night) applies before any of that, and
four more, each learned from a real record in production:
  · nobody there (no phones, no votes)                         → not a night
  · one phone and no votes                                     → the founder testing
  · ten or more phones ALL on one network AND over in under 30 minutes → a load test
    from one machine (tools/loadsim.py); 31/44/26 "people" on 31 Aug were exactly this.
    A real beach-bar room shares the venue's wifi too, so the duration clause matters
  · shorter than 30 minutes                                    → a test or a demo
  · longer than 12 hours                                       → a show that failed
    to end itself (30 Aug → 4 Sep ran 107.9 h); its length is not a length
A night whose Stripe lookup failed (`money.source` = stripe-unreachable) still
counts for people and hours but NOT for room money — $0 there means "unknown",
not "nothing".

THE BANDWIDTH METHOD (how pollsPerPhoneHour gets measured, not typed):
Netlify does not show function calls per site or per night through the API, but it
does keep a byte-exact, account-wide bandwidth counter for the billing period
(GET /accounts/<id>/bandwidth). Every audience tick is 3,470 bytes on the wire since the split (2,530 before): the shared
board — about 200 B plus 36 B per song on it, gzipped: 2,175 for the 40-song room of 11 Sep,
3,040 for the founder's 79-song board on 25 Sep — and the 430-byte personal call (measured; the
same constants the model uses), so the bytes a night adds to that counter, minus what the
Studio tab, the page loads and the votes cost, is the poll count. So:
  · run `--mark "..."` three times: about two hours BEFORE the gig, JUST BEFORE it starts
    (those two are the quiet pair — the background of that very day) and AFTER it ends
    (the counter lags a couple of minutes; a mark records when it was last updated);
  · a quiet pair measures the background only for a bracket within 48 h of it, and only
    if the pair itself is under 6 h — see the two rules below;
  · the report then finds, for each counted night, the last mark before it started
    and the first mark after it ended (same billing period — the counter resets on
    the period start, 8 Sep this month) and solves for the polls.
ONE VIEW OF A POSTED VIDEO CLIP IS ~75 MB — about twenty thousand ticks' worth. If anybody
(including you) watched a clip on the profile between the two marks, pass
--clip-views N on the AFTER mark or the solve is off by that much; the 8–11 Sep reading
(335.7 MB in three days, two gigs) was mostly clips, not polls.
The Studio Live tab keeps ticking after the show ends and before it starts, so close it
(or leave Live) the moment the set ends and take the AFTER mark before it is reopened;
better, pass --studio-min with the minutes it was actually on screen. Without that the
solver assumes it was up 60% of the night (the model's default) and says so.
The byte constants live in BYTES below and finance/model-test.mjs checks that they
still match the model's defaults, so the two cannot drift apart silently.
THREE FENCES THE 25 SEP AUDIT ADDED, each learned from a number that was 8–18× wrong:
  · a quiet pair measures the background OF ITS OWN DAY. The account's idle traffic changed
    by 10× inside a fortnight (the mirror moving clips, then the warm-door pings), so a pair
    is applied only to a bracket within QUIET_PAIR_MAX_H (48 h) of it — today's quiet pair
    laid over the 14 Sep bracket reads 350–750 ticks per phone-hour depending on the
    background believed, when the meters say ~40 — and the pair itself (7.0 MB/h) held this audit's
    own store reads, so a pair must be taken with nothing else running;
  · a bracket must be a night, not a fortnight: longer than MAX_BRACKET_H (24 h) and it is
    withheld — the 15→25 Sep bracket held seven nights and one 488 MB day that was not polls;
    and a quiet pair must be short too (MAX_QUIET_PAIR_H, 6 h) — two marks a week apart with
    no show between them average every clip and backup of the week into the "background".
  The way to take the marks, then: one about two hours before the gig, one just before it
  starts (that pair is the quiet pair), one after it ends. Three marks, one night.

THE METER METHOD (what fills pollsPerPhoneHour and creditsPerShow when no bracket qualifies):
Netlify's Usage & billing page charts every meter it bills PER DAY — web requests, function
compute, bandwidth — and finance/credits.json keeps those days as read off the chart by hand
(`perDay.days[]`, with `webRequestCount`, `functionsCompute` (credits), `bandwidthMB`). A day is
EMPTY when no show record of any kind — counted, unused or a test — started on it and no
published slot fell on it; the background is the median of the empty days for requests and
compute and the QUIETEST empty day for bandwidth (a clip watched or a backup is a one-off, not
a nightly cost). A GIG DAY is a day with exactly one counted night and nothing else. The
night's requests over the background, less the Studio tick, the page loads, the votes and the
extra pages (the same shape the bandwidth method subtracts), halved (a tick is two requests
since the split) are the room's ticks; ÷ phone-hours is the rate. Days before
`perDay.cleanFrom` are ignored — until 15 Sep the account carried hand tests, load work and a
mirror moving clips. The Studio share (STUDIO_SHARE) is the one assumption in it: at a
three-phone night it is most of the requests, so small rooms read high — the rate is
phone-hour-weighted for that reason.
"""
import json, os, subprocess, sys, urllib.request
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

STORE = 'myset'
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
# the Netlify CLI reads the store through the folder that is `netlify link`ed — a git worktree
# is not, so from one set MYSET_SITE_DIR=~/Docs/MySet (the same convention as tools/metrics.mjs)
SITE = os.environ.get('MYSET_SITE_DIR') or ROOT
MARKS = os.path.join(ROOT, 'finance', 'marks.json')
# THE FOUNDER'S OWN MARKS. tools/mark.sh takes a mark from any folder with no git involved and writes it
# here (MYSET_MARKS_FILE points elsewhere for tests); read_marks() reads this file alongside the repo's,
# and --write folds anything new into finance/marks.json so the next commit carries it.
MARKS_OWN = os.environ.get('MYSET_MARKS_FILE') or os.path.expanduser('~/.myset-marks.json')
CREDITS = os.path.join(ROOT, 'finance', 'credits.json')   # Netlify's own per-category credit meters, read off the dashboard by hand (append-only)
ENV = {**os.environ, 'PATH': os.environ['HOME'] + '/.local/node/bin:' + os.environ.get('PATH', '')}

# bytes on the wire per call — MUST equal P0.pollBytes / writeBytes / studioBytes /
# viewBytes / pageBytes in finance/model.html (model-test.mjs enforces it)
# SINCE THE SPLIT (11 Sep 2026, decision 0034) every audience tick is TWO requests on the wire:
# the shared board (about 200 B + 36 B per song on it, gzipped: 3,040 for the founder's 79-song board on 25 Sep; 2,175
# for the 40-song room of 11 Sep) and the personal call (430 for a phone that voted, measured). 'poll' is the old one-call answer, kept only so a mark taken before the split can
# still be solved. finance/model-test.mjs checks these against the model page's defaults.
BYTES = {'board': 3040, 'me': 430, 'poll': 2530, 'write': 1200, 'studio': 4000, 'view': 3000, 'page': 48000, 'clip': 75000000}   # clip = one full view of a posted video (the three so far are 74–79 MB); board = the founder's 79-song board, gzipped, 25 Sep
TICK_BYTES = BYTES['board'] + BYTES['me']   # what one tick of the ladder moves since the split
# TWO BILLS, NEVER ONE NUMBER (INVARIANT 0fx). Netlify meters a production deploy (15 credits)
# separately from everything a room does (web requests, bandwidth, compute). This script reports
# them as two separate objects — `shipping` and `traffic` — and NOTHING per show, per phone or
# per hour in its output may ever contain a deploy. Three times a per-gig "server cost" carried
# the deploys and polling looked dear when shipping was. BYTES has no deploy entry on purpose.
CR_DEPLOY = 15          # credits per production deploy (previews, branch deploys and failed deploys are free)
CR_PER_GB = 20          # credits per GB of bandwidth
SPLIT_AT = '2026-09-11T11:17:00+00:00'      # when c3d0a4d (the split) went live; marks before this solve at the old poll size
STUDIO_POLLS_PER_HOUR = 3600 / 4        # the Studio's own tick, every 4 s while the tab is open
EXTRA_VIEWS_PER_PHONE = 0.5             # profile / community / city-feed pages, per phone (model default)
STUDIO_SHARE = 0.6                      # share of the night the Studio Live tab is on screen when nobody recorded it (= P0.studioShare)
PAGE_REQS = 6                           # requests to open the voting page — the page, its script, style, icon… (= P0.pageReqs)
QUIET_PAIR_MAX_H = 48                   # a quiet pair measures the background only for a bracket within this many hours of it
MAX_BRACKET_H = 24                      # a bracket longer than a day is not a night and is not solved
MAX_QUIET_PAIR_H = 6                    # two marks with nothing between them measure the background only if they are close together — a pair spanning days averages clips and backups in


def run(args):
    r = subprocess.run(args, capture_output=True, text=True, env=ENV, cwd=SITE)
    return r.stdout if r.returncode == 0 else ''


def blob(key):
    out = run(['netlify', 'blobs:get', STORE, key])
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return None


def keys():
    out = []
    for line in run(['netlify', 'blobs:list', STORE]).splitlines():
        if line.startswith('|') and '"' in line:
            out.append(line.split('|')[1].strip())
    return out


def token():
    """The CLI's own token, so the two raw endpoints the CLI has no verb for
    (bandwidth, and nothing else) can be read with the same sign-in."""
    for f in (os.path.expanduser('~/Library/Preferences/netlify/config.json'), os.path.expanduser('~/.config/netlify/config.json')):
        try:
            d = json.load(open(f))
            return list(d['users'].values())[0]['auth']['token']
        except Exception:
            continue
    return None


def api(path):
    t = token()
    if not t:
        return None
    req = urllib.request.Request('https://api.netlify.com/api/v1' + path, headers={'Authorization': 'Bearer ' + t})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode())
    except Exception:
        return None


def account():
    acc = run(['netlify', 'api', 'listAccountsForUser', '--data', '{}'])
    try:
        return json.loads(acc)[0]
    except Exception:
        return None


def plan_of(artists, aid):
    a = (artists.get('byId') or {}).get(aid)
    if not a:
        return 'unknown'                 # not "free": an artist the registry has never seen is not evidence about free artists
    p = a.get('plan') or 'free'
    until = a.get('planUntil')
    if p != 'free' and until and float(until) < datetime.now().timestamp() * 1000:
        return 'free'
    return p


SLOT_EARLY_MIN = 90                     # a show started this long before the gig's start is still that gig


def calendar(aid, cache={}):
    """The artist's published gigs, expanded to weekday slots in the gig's own zone."""
    if aid not in cache:
        ev = blob('ev_' + aid) or {}
        slots = []
        for e in ev.get('list') or []:
            try:
                d = datetime.strptime(e['date'], '%Y-%m-%d')
                h, m = map(int, (e.get('time') or '20:00').split(':'))
            except Exception:
                continue
            slots.append({'eventId': e.get('id'), 'venue': e.get('venue') or '', 'tz': e.get('tz') or 'UTC',
                          'date': e['date'], 'weekly': (e.get('repeat') or {}).get('freq') in ('weekly', 'biweekly'),
                          'startMin': h * 60 + m, 'durMin': int(e.get('durationMin') or 180),
                          'skip': set(e.get('skip') or [])})
        cache[aid] = slots
    return cache[aid]


def gig_for(aid, started_ms):
    """The published gig this show belongs to, or None. A show belongs to a gig when it
    started on the gig's day (in the gig's zone), no more than SLOT_EARLY_MIN before the
    gig's start and no later than its scheduled end."""
    best = None
    for sl in calendar(aid):
        try:
            local = datetime.fromtimestamp(started_ms / 1000, ZoneInfo(sl['tz']))
        except Exception:
            local = datetime.fromtimestamp(started_ms / 1000, timezone.utc)
        day = local.strftime('%Y-%m-%d')
        if day in sl['skip']:
            continue
        same_day = day == sl['date'] or (sl['weekly'] and day >= sl['date'] and local.weekday() == datetime.strptime(sl['date'], '%Y-%m-%d').weekday())
        if not same_day:
            continue
        delta = local.hour * 60 + local.minute - sl['startMin']
        if -SLOT_EARLY_MIN <= delta <= sl['durMin'] and (best is None or abs(delta) < abs(best['startedMinAfterSlot'])):
            best = {'eventId': sl['eventId'], 'venue': sl['venue'], 'slotHours': round(sl['durMin'] / 60, 2),
                    'startedMinAfterSlot': delta, 'localStart': local.strftime('%a %d %b %H:%M')}
    return best


def requests_by_show(aid, cache={}):
    """Fan song / vibe requests per show, from `req_<artist>` (a request is a write
    like a vote is, and the model counts writes per phone)."""
    if aid not in cache:
        by = {}
        for r in (blob('req_' + aid) or {}).get('list') or []:
            if r.get('showId'):
                by[r['showId']] = by.get(r['showId'], 0) + 1
        cache[aid] = by
    return cache[aid]


def shows():
    """One row per night that actually happened. The archive writes the counts
    under `stats` and the money under `money` (see _history.mjs)."""
    artists = blob('artists') or {}
    if not artists:
        # an empty registry is a failed read (the CLI not signed in, or this folder not linked — see SITE),
        # never a fact: writing it out would replace seven real nights with zero, silently
        print('the registry read as empty — is the Netlify CLI signed in, and is this folder `netlify link`ed (or MYSET_SITE_DIR set to the one that is)?', file=sys.stderr)
        sys.exit(1)
    rows, skipped, unused = [], [], []
    for k in keys():
        # hist_<artist>_<showId> is the per-artist record; hist_<showId> is a legacy
        # copy of the founder's early nights and would double-count them.
        parts = k.split('_')
        if not k.startswith('hist_') or len(parts) < 3 or k.startswith('histidx_') or k.startswith('histids_'):
            continue
        d = blob(k)
        if not isinstance(d, dict):
            continue
        aid = d.get('artistId') or parts[1]
        st = d.get('stats') or {}
        room = st.get('room')
        peak = st.get('peakVoters') or 0
        people = room if isinstance(room, (int, float)) and room > 0 else peak
        nets = st.get('nets')
        votes = st.get('totalVotes') or 0
        s0, e0 = d.get('startedAt'), d.get('endedAt')
        rec_hours = (e0 - s0) / 3600e3 if s0 and e0 and e0 > s0 else None
        played = [p.get('at') for p in d.get('played') or [] if p.get('at')]
        set_hours = (max(played) - min(played)) / 3600e3 if len(played) >= 2 else None
        m = d.get('money') or {}
        money_known = m.get('source') == 'stripe'
        tagged, untagged = float(m.get('gross') or 0), float(m.get('unattributed') or 0)
        gross = tagged + untagged   # a payment not tagged with the show is still the room's money
        gig = gig_for(aid, s0) if s0 and calendar(aid) else None
        has_cal = bool(calendar(aid))
        # the night's length: the record when the artist ended it inside the slot; when the
        # record overran (the 3 h auto-end grace, or a show left open) the later of the
        # published slot and the last thing anyone did — a room that was still voting an
        # hour past the slot was still a room, an empty page left open was not
        last_act = (max(played) - s0) / 3600e3 if played and s0 else None
        hours = min(rec_hours, max(gig['slotHours'], last_act or 0)) if rec_hours and gig else rec_hours
        why = None
        if not people and not votes:
            why = 'nobody there'
        elif not (s0 and e0):
            why = 'no start or end time on record'
        elif e0 <= s0:
            why = 'ended before it started — a broken record'
        elif has_cal and not gig:
            local = datetime.fromtimestamp(s0 / 1000, ZoneInfo(calendar(aid)[0]['tz']))
            why = f"not on the published calendar — started {local.strftime('%a %d %b %H:%M')} local, no gig within {SLOT_EARLY_MIN} min; a test or an accident"
        elif people <= 1 and not votes:
            why = 'one phone and no votes — ' + ('on the calendar, but the room never used the app' if gig else 'a test')
        elif nets == 1 and people >= 10 and rec_hours < 0.5:
            why = f'{people} phones all on one network and over in {round(rec_hours * 60)} minutes — a load test from one machine, not a room'
        elif rec_hours < 0.5:
            why = 'shorter than 30 minutes — a test or a demo'
        elif rec_hours > 12 and not gig:
            why = 'longer than 12 h — a show that failed to end itself; not a night'
        reqs = requests_by_show(aid).get(d.get('showId') or '', 0)
        row = dict(key=k, artist=aid, plan=plan_of(artists, aid), people=people, nets=nets, votes=votes, requests=reqs, lastActivityHours=round(last_act, 2) if last_act else None,
                   interactions=round((votes + reqs) / people, 2) if people else None,   # writes per phone: what the model's `interactions` dial means
                   songs=st.get('songsPlayed') or 0, peakVoters=peak,
                   hours=round(hours, 2) if hours else None, recordHours=round(rec_hours, 2) if rec_hours else None,
                   setHours=round(set_hours, 2) if set_hours else None,
                   gig=gig, gross=gross if money_known else None, tagged=tagged if money_known else None, untagged=untagged if money_known else None,
                   moneyKnown=money_known, moneySource=m.get('source'), startedAt=s0, endedAt=e0)
        if why and gig and people <= 1 and not votes:
            unused.append({**row, 'skipped': why})
        elif why:
            skipped.append({**row, 'skipped': why})
        else:
            rows.append(row)
    return merge_split_nights(rows), skipped, unused


def merge_split_nights(rows):
    """An accidental End then Start during a gig files two records for one slot; they are
    one night. Grouped by artist + gig + local date."""
    groups = {}
    for r in rows:
        g = r.get('gig')
        key = (r['artist'], g['eventId'], g['localStart'][:10]) if g else (r['artist'], r['key'])
        groups.setdefault(key, []).append(r)
    out = []
    for rs in groups.values():
        if len(rs) == 1:
            out.append(rs[0]); continue
        rs.sort(key=lambda r: r['startedAt'])
        a = dict(rs[0])
        a['mergedFrom'] = [r['key'] for r in rs]
        a['endedAt'] = max(r['endedAt'] for r in rs)
        a['people'] = max(r['people'] for r in rs)
        a['nets'] = max((r['nets'] or 0) for r in rs) or None
        a['votes'] = sum(r['votes'] for r in rs)
        a['requests'] = sum(r['requests'] for r in rs)
        a['songs'] = sum(r['songs'] for r in rs)
        a['peakVoters'] = max(r['peakVoters'] for r in rs)
        a['interactions'] = round((a['votes'] + a['requests']) / a['people'], 2) if a['people'] else None
        a['recordHours'] = round((a['endedAt'] - a['startedAt']) / 3600e3, 2)
        a['setHours'] = max((r['setHours'] or 0) for r in rs) or None
        last_act = max((r['lastActivityHours'] or 0) + (r['startedAt'] - a['startedAt']) / 3600e3 for r in rs)
        a['lastActivityHours'] = round(last_act, 2)
        a['hours'] = round(min(a['recordHours'], max(a['gig']['slotHours'], last_act)), 2)
        a['moneyKnown'] = all(r['moneyKnown'] for r in rs)
        # tagged money is summed; UNTAGGED money is a window figure (the archive says never to
        # sum it — the two records' windows overlap), so the merged night takes it once (0095)
        a['tagged'] = sum(r['tagged'] for r in rs) if a['moneyKnown'] else None
        a['untagged'] = max(r['untagged'] for r in rs) if a['moneyKnown'] else None
        a['gross'] = a['tagged'] + a['untagged'] if a['moneyKnown'] else None
        out.append(a)
    return out


def silent_nights(rows, unused, now_ms=None):
    """Published gigs between the first counted night and now that left no record at all:
    the show never started, or it ran and nobody came and nothing was filed."""
    now_ms = now_ms or datetime.now(timezone.utc).timestamp() * 1000
    seen = {(r['artist'], r['gig']['eventId'], r['gig']['localStart'][:10]) for r in rows + unused if r.get('gig')}
    out = []
    for aid in {r['artist'] for r in rows}:
        first = min(r['startedAt'] for r in rows if r['artist'] == aid)
        for sl in calendar(aid):
            tz = ZoneInfo(sl['tz'])
            d0 = datetime.strptime(sl['date'], '%Y-%m-%d').replace(tzinfo=tz)
            step = timedelta(days=7) if sl['weekly'] else None
            d = d0
            for _ in range(400):
                start = d.replace(hour=sl['startMin'] // 60, minute=sl['startMin'] % 60)
                end_ms = (start + timedelta(minutes=sl['durMin'])).timestamp() * 1000
                if end_ms > now_ms:
                    break
                if start.timestamp() * 1000 >= first and d.strftime('%Y-%m-%d') not in sl['skip'] \
                        and (aid, sl['eventId'], start.strftime('%a %d %b %H:%M')[:10]) not in seen:
                    out.append({'artist': aid, 'gig': sl['venue'], 'date': start.strftime('%a %d %b %H:%M'), 'eventId': sl['eventId'], 'at': int(start.timestamp() * 1000)})
                if not step:
                    break
                d += step
    return sorted(out, key=lambda x: x['at'])


def deploys():
    """Account-wide production deploys: trailing 30 days (the model's monthly rate)
    and this billing period (the credit check)."""
    acc = account()
    if not acc:
        return None, None, None
    start = (acc.get('current_billing_period_start') or '')[:10]
    since30 = (datetime.now(timezone.utc) - timedelta(days=30)).strftime('%Y-%m-%d')
    floor = min(start, since30) if start else since30
    sites = json.loads(run(['netlify', 'api', 'listSites', '--data', '{}']) or '[]')
    n30 = nper = 0
    for site in sites:
        page = 1
        while page <= 20:
            chunk = json.loads(run(['netlify', 'api', 'listSiteDeploys',
                                    '--data', json.dumps({'site_id': site['id'], 'per_page': 100, 'page': page})]) or '[]')
            if not chunk:
                break
            oldest = '9999'
            for x in chunk:
                at = (x.get('created_at') or '')[:10]
                oldest = min(oldest, at) if at else oldest
                if x.get('state') != 'ready' or x.get('context') != 'production':
                    continue
                if at >= since30:
                    n30 += 1
                if start and at >= start:
                    nper += 1
            if len(chunk) < 100 or oldest < floor:
                break
            page += 1
    return n30, nper, start


# ---------------------------------------------------------------- bandwidth marks

def read_marks():
    """The repo's marks and the founder's own file as one list, oldest first, no mark twice."""
    out = []
    for path in (MARKS, MARKS_OWN):
        try:
            out += json.load(open(path))
        except Exception:
            pass
    seen, uniq = set(), []
    for m in sorted(out, key=lambda m: m['at']):
        if m['at'] not in seen:
            seen.add(m['at']); uniq.append(m)
    return uniq


def mark(label):
    acc = account()
    bw = api(f"/accounts/{acc['id']}/bandwidth") if acc else None
    if not bw or bw.get('used') is None:
        print('could not read the bandwidth counter — is the Netlify CLI signed in?', file=sys.stderr)
        sys.exit(1)
    now = datetime.now(timezone.utc)
    upd = bw.get('last_updated_at')
    stale_min = None
    if upd:
        try:
            stale_min = (now - datetime.fromisoformat(upd.replace('Z', '+00:00'))).total_seconds() / 60
        except Exception:
            pass
    m = {'at': now.isoformat(timespec='seconds'), 'label': label, 'used': int(bw['used']),
         'lastUpdatedAt': upd, 'periodStart': bw.get('period_start_date'), 'periodEnd': bw.get('period_end_date')}
    if '--studio-min' in sys.argv:
        m['studioMin'] = float(sys.argv[sys.argv.index('--studio-min') + 1])   # minutes the Studio Live tab was on screen since the previous mark
    if '--clip-views' in sys.argv:
        m['clipViews'] = float(sys.argv[sys.argv.index('--clip-views') + 1])   # full views of a posted video since the previous mark (each is ~75 MB — about 21,600 ticks' worth)
    # the founder's script sets MYSET_MARKS_FILE and the mark lands in his own file, outside git; a session's mark lands in the repo's
    target = MARKS_OWN if os.environ.get('MYSET_MARKS_FILE') else MARKS
    try:
        mine = json.load(open(target))
    except Exception:
        mine = []
    mine.append(m)
    os.makedirs(os.path.dirname(target) or '.', exist_ok=True)
    with open(target, 'w') as f:
        f.write(json.dumps(mine, indent=1) + '\n')
    marks = read_marks()                      # both files together, for the numbering and the "since" line
    print(f"mark #{len(marks)}  {m['at']}  {m['used']:,} bytes used this period  — {label}" + ('' if target == MARKS else f"  (kept in {target})"))
    if stale_min is not None and stale_min > 30:
        print(f"  ⚠ the counter was last updated {stale_min:.0f} minutes ago; if this is the AFTER reading, take it again later", file=sys.stderr)
    if len(marks) >= 2:
        a, b = marks[-2], marks[-1]
        if a.get('periodStart') != b.get('periodStart'):
            print('  ⚠ the billing period rolled over since the previous mark — the counter reset; these two cannot be compared', file=sys.stderr)
        else:
            hrs = (datetime.fromisoformat(b['at']) - datetime.fromisoformat(a['at'])).total_seconds() / 3600
            print(f"  since mark #{len(marks) - 1}: {b['used'] - a['used']:,} bytes over {hrs:.1f} h")


def ts(s):
    return datetime.fromisoformat(s).timestamp() * 1000


def eff(m):
    """When the counter's number was true: Netlify's own last-updated stamp, else the mark's time."""
    return ts((m.get('lastUpdatedAt') or m['at']).replace('Z', '+00:00'))


def solve_polls(rows, marks, skipped=(), unused=(), silent=()):
    """For each bracket of marks around counted nights: the bytes between them, less the
    background the quiet pairs show, less everything on the wire that is not an audience
    poll, ÷ bytes per poll. Nights that share a bracket are solved together (one rate
    over their combined phone-hours). Returns (rate, per-night rows, background B/h,
    quiet-pair count)."""
    if len(marks) < 2:
        return None, [], None, 0
    marks = sorted(marks, key=lambda m: m['at'])
    # a test show, a one-phone night and a published slot nobody used all keep the Studio ticking, so they are busy windows too
    every = [r for r in list(rows) + list(skipped) + list(unused) if r.get('startedAt') and r.get('endedAt')] \
          + [{'startedAt': s['at'], 'endedAt': s['at'] + 4 * 3600e3} for s in silent or [] if s.get('at')]
    # every quiet pair on file, with WHEN it was taken: the background it measures belongs to its
    # own day (the account's idle traffic changed 10× inside a fortnight), so a pair is applied
    # only to a bracket within QUIET_PAIR_MAX_H of it
    quiet = []
    for a, b in zip(marks, marks[1:]):
        if a.get('periodStart') != b.get('periodStart') or b['used'] < a['used']:
            continue
        t0, t1 = eff(a), eff(b)
        busy = any(r['startedAt'] < t1 and r['endedAt'] > t0 for r in every)
        hrs = (t1 - t0) / 3600e3
        if not busy and 0.5 <= hrs <= MAX_QUIET_PAIR_H:
            quiet.append({'t0': t0, 't1': t1, 'bytes': b['used'] - a['used'], 'hours': hrs})
    quiet_n = len(quiet)
    bg = sum(q['bytes'] for q in quiet) / sum(q['hours'] for q in quiet) if quiet else 0.0   # over every pair, for the report

    def background_for(t0, t1):
        """B/h from the quiet pairs within QUIET_PAIR_MAX_H of the window [t0, t1] — None when there is none."""
        gap = QUIET_PAIR_MAX_H * 3600e3
        near = [q for q in quiet if q['t0'] <= t1 + gap and q['t1'] >= t0 - gap]
        hrs = sum(q['hours'] for q in near)
        return (sum(q['bytes'] for q in near) / hrs if hrs else None), len(near)
    groups = {}
    per_night = []
    for r in rows:
        before = [m for m in marks if eff(m) <= r['startedAt']]
        after = [m for m in marks if eff(m) >= r['endedAt']]
        if not before or not after:
            per_night.append({'key': r['key'], 'polls': None, 'why': 'no mark on both sides of this night (the counter must have caught up before the AFTER mark counts)'})
            continue
        groups.setdefault((marks.index(before[-1]), marks.index(after[0])), []).append(r)
    for (ia, ib), rs in groups.items():
        a, b = marks[ia], marks[ib]
        if a.get('periodStart') != b.get('periodStart') or b['used'] < a['used']:
            for r in rs: per_night.append({'key': r['key'], 'polls': None, 'why': 'the billing period rolled over between the two marks'})
            continue
        if a['at'] < SPLIT_AT <= b['at']:
            for r in rs: per_night.append({'key': r['key'], 'polls': None, 'why': 'the split (11 Sep 11:17 UTC) landed between the two marks, so a tick weighed 2,530 bytes for part of the window and 3,470 for the rest'})
            continue
        window_h = (eff(b) - eff(a)) / 3600e3
        delta = b['used'] - a['used']
        if window_h > MAX_BRACKET_H:
            for r in rs: per_night.append({'key': r['key'], 'polls': None, 'bytes': delta, 'windowHours': round(window_h, 2), 'sharedWith': [x['key'] for x in rs if x is not r] or None,
                                           'why': f'the bracket is {window_h:.0f} h long ({len(rs)} night(s) inside it) — longer than {MAX_BRACKET_H} h it is not a night, and a clip, a backup or another site can add more than every poll in it'})
            continue
        bg_here, near_n = background_for(eff(a), eff(b))
        if bg_here is None:
            for r in rs: per_night.append({'key': r['key'], 'polls': None, 'bytes': delta, 'windowHours': round(window_h, 2), 'sharedWith': [x['key'] for x in rs if x is not r] or None,
                                           'pollsIfNoBackground': round((delta - sum(x['people'] * BYTES['page'] + x['votes'] * BYTES['write'] for x in rs)) / (TICK_BYTES if a['at'] >= SPLIT_AT else BYTES['poll'])),
                                           'why': f'no quiet pair within {QUIET_PAIR_MAX_H} h of this bracket ({quiet_n} on file, none near enough) — the background of that day is unknown, so the bytes cannot be read as polls; take a pair two hours before the next gig'})
            continue
        studio_min = b.get('studioMin')
        studio_h = studio_min / 60 if studio_min is not None else sum(r['hours'] for r in rs) * STUDIO_SHARE
        studio_bytes = studio_h * STUDIO_POLLS_PER_HOUR * BYTES['studio']
        clip_bytes = (b.get('clipViews') or 0) * BYTES['clip']
        other = studio_bytes + clip_bytes + sum(r['people'] * BYTES['page'] + r['votes'] * BYTES['write'] + r['people'] * EXTRA_VIEWS_PER_PHONE * BYTES['view'] for r in rs)
        per_tick = TICK_BYTES if a['at'] >= SPLIT_AT else BYTES['poll']   # the split changed what a tick weighs
        polls = (delta - bg_here * window_h - other) / per_tick
        ph = sum(r['people'] * r['hours'] for r in rs)
        rate = polls / ph if polls > 0 and ph else None
        studio_share = studio_bytes / max(delta - bg_here * window_h, 1)
        for r in rs:
            per_night.append({'key': r['key'], 'bytes': delta, 'windowHours': round(window_h, 2), 'background': round(bg_here * window_h), 'quietPairsUsed': near_n,
                              'studioMinutes': round(studio_h * 60), 'studioAssumed': studio_min is None, 'studioShareOfBytes': round(studio_share, 2),
                              'clipViews': b.get('clipViews'), 'clipBytes': round(clip_bytes),
                              'polls': round(polls) if len(rs) == 1 else None, 'pollsShared': round(polls) if len(rs) > 1 else None,
                              'sharedWith': [x['key'] for x in rs if x is not r] or None,
                              'pollsPerPhoneHour': round(rate, 1) if rate else None,
                              'confidence': 'low — Studio-dominated' if studio_share > 0.4 else 'low — Studio minutes assumed' if studio_min is None else 'ok',
                              'marks': [a['label'], b['label']]})
    good = [n for n in per_night if n.get('pollsPerPhoneHour')]
    if not good:
        return None, per_night, bg, quiet_n
    ph = sum(next(r for r in rows if r['key'] == n['key'])['people'] * next(r for r in rows if r['key'] == n['key'])['hours'] for n in good)
    polls_total = sum((n['polls'] if n['polls'] is not None else n['pollsShared'] / len(n['sharedWith'] + [0])) for n in good)
    rate = polls_total / ph if ph else None
    return (round(rate, 1) if rate else None), per_night, bg, quiet_n


# ---------------------------------------------------------------- the meter method

def solve_meters(rows, unused, skipped, silent, reading):
    """Ticks per phone-hour and traffic credits per night from Netlify's OWN per-day meters
    (finance/credits.json readings[-1].perDay.days, copied off the Usage & billing chart by
    hand): a gig day minus an empty day. See THE METER METHOD at the top of the file.
    Returns None when the reading has no per-day counts; otherwise a dict with `rate`,
    `creditsPerShow`, `background`, `nights` (one row per gig day, or why a day was skipped),
    `emptyDays`, `gigDays`."""
    per_day = (reading or {}).get('perDay') or {}
    clean_from = per_day.get('cleanFrom') or ''
    table = {d['day']: d for d in per_day.get('days') or []
             if d.get('webRequestCount') is not None and d.get('functionsCompute') is not None and d.get('bandwidthMB') is not None and d['day'] >= clean_from}
    if not table:
        return None
    utc_day = lambda ms: datetime.fromtimestamp(ms / 1000, timezone.utc).strftime('%Y-%m-%d')
    by_day = {}
    for kind, rs in (('night', rows), ('unused', unused), ('test', skipped)):
        for r in rs:
            if r.get('startedAt'):
                by_day.setdefault(utc_day(r['startedAt']), []).append((kind, r))
    slot_days = {utc_day(s['at']) for s in silent or []}          # a published slot nobody used still had the Studio open
    read_day = ((reading or {}).get('readAt') or '')[:10]         # the day the chart was read is only part of a day
    empty = [d for d in sorted(table) if d not in by_day and d not in slot_days and d != read_day]
    out = {'readAt': (reading or {}).get('readAt'), 'cleanFrom': clean_from or None, 'studioShareAssumed': STUDIO_SHARE, 'emptyDays': empty, 'gigDays': [], 'nights': [],
           'what': "Netlify's own per-day meters (finance/credits.json): a gig day minus an empty day, requests ÷ 2 less the Studio tick, page loads, votes and extra pages = the room's ticks; the credits are traffic only — never a deploy (INVARIANT 0fx)"}
    if not empty:
        out.update(rate=None, creditsPerShow=None, background=None, why='no empty day in the table (a day with no record and no published slot) — the background cannot be read')
        return out
    med = lambda xs: (lambda s: s[len(s) // 2] if len(s) % 2 else (s[len(s) // 2 - 1] + s[len(s) // 2]) / 2)(sorted(xs))
    bg = {'requests': round(med([table[d]['webRequestCount'] for d in empty])), 'computeCredits': round(med([table[d]['functionsCompute'] for d in empty]), 3),
          'bandwidthMB': round(min(table[d]['bandwidthMB'] for d in empty), 1), 'days': empty}
    ticks_sum = ph_sum = 0.0; credits = []
    for day in sorted(table):
        recs = by_day.get(day)
        if not recs:
            continue
        kinds = [k for k, _ in recs]
        if kinds != ['night']:
            out['nights'].append({'day': day, 'why': 'not a clean gig day — records that day: ' + ', '.join(kinds)})
            continue
        r = recs[0][1]; t = table[day]
        d_req = t['webRequestCount'] - bg['requests']
        d_cmp = t['functionsCompute'] - bg['computeCredits']
        d_bw = t['bandwidthMB'] - bg['bandwidthMB']
        studio = r['hours'] * STUDIO_POLLS_PER_HOUR * STUDIO_SHARE
        other = studio + r['people'] * PAGE_REQS + r['votes'] + r['requests'] + r['people'] * EXTRA_VIEWS_PER_PHONE
        ticks = (d_req - other) / 2                                    # a tick is two requests since the split
        ph = r['people'] * r['hours']
        cr = d_req / 10000 * 2 + d_cmp + d_bw / 1000 * CR_PER_GB      # 2 credits per 10k requests, compute as billed, 20 per GB
        out['nights'].append({'key': r['key'], 'day': day, 'people': r['people'], 'hours': r['hours'],
                              'requestsOverBackground': round(d_req), 'computeCreditsOverBackground': round(d_cmp, 2), 'bandwidthMBOverBackground': round(d_bw, 1),
                              'studioRequestsAssumed': round(studio), 'ticks': round(ticks), 'ticksPerPhoneHour': round(ticks / ph, 1) if ph and ticks > 0 else None,
                              'creditsTraffic': round(cr, 2)})
        out['gigDays'].append(day)
        if ph and ticks > 0:
            ticks_sum += ticks; ph_sum += ph
        credits.append(cr)
    out.update(background=bg, rate=round(ticks_sum / ph_sum, 1) if ph_sum else None,
               creditsPerShow=round(sum(credits) / len(credits), 2) if credits else None)
    return out


# ---------------------------------------------------------------- the report

def per_head(rows):
    """$ per person per night, weighted by people, over nights whose money is known."""
    rs = [r for r in rows if r['moneyKnown'] and r['people']]
    heads = sum(r['people'] for r in rs)
    return round(sum(r['gross'] for r in rs) / heads, 3) if heads else None


def main():
    if '--mark' in sys.argv:
        i = sys.argv.index('--mark')
        mark(sys.argv[i + 1] if i + 1 < len(sys.argv) else datetime.now().strftime('%a %H:%M'))
        return
    if '--marks' in sys.argv:
        for n, m in enumerate(read_marks(), 1):
            print(f"#{n}  {m['at']}  {m['used']:>14,}  {m['label']}")
        return
    rows, skipped, unused = shows()
    silent = silent_nights(rows, unused)
    marks = read_marks()
    rate, per_night, bg, quiet_n = solve_polls(rows, marks, skipped, unused, silent)
    try:
        readings = json.load(open(CREDITS)).get('readings') or []
    except Exception:
        readings = []
    # the meter method: Netlify's own per-day counts, when a reading carries them
    meters = solve_meters(rows, unused, skipped, silent, readings[-1] if readings else None)
    if rate is not None:
        rate_src = f'the bandwidth marks — a night bracketed by two marks with a quiet pair within {QUIET_PAIR_MAX_H} h of it'
    elif meters and meters.get('rate') is not None:
        rate, rate_src = meters['rate'], f"Netlify's own request meter — {len(meters['gigDays'])} gig day(s) minus {len(meters['emptyDays'])} empty day(s), the Studio tab assumed on screen {round(STUDIO_SHARE * 100)}% of the night (finance/credits.json perDay)"
    else:
        rate_src = None
    n30, nper, pstart = deploys()
    acc = account()
    bw = (api(f"/accounts/{acc['id']}/bandwidth") if acc else None) or {}
    bw_used = int(bw.get('used') or 0)
    # the latest dashboard reading (finance/credits.json) — the only exact per-category split there is
    dash = None
    try:
        if readings:
            r = readings[-1]; b = r['breakdown']
            dash = {'readAt': r['readAt'], 'periodStart': r['period']['start'], 'deploys': b['productionDeploys']['count'], 'deployCredits': b['productionDeploys']['credits'],
                    'webRequests': b['webRequests']['count'], 'webRequestCredits': b['webRequests']['credits'], 'computeCredits': b['compute']['credits'],
                    'bandwidthCredits': b['bandwidth']['credits'], 'totalCredits': b['total'],
                    'trafficCredits': round(b['webRequests']['credits'] + b['compute']['credits'] + b['bandwidth']['credits'], 1),
                    'shippingShare': round(b['productionDeploys']['credits'] / b['total'], 3)}
    except Exception:
        dash = None
    avg = lambda xs: round(sum(xs) / len(xs), 2) if xs else None
    by = lambda plan: [r for r in rows if r['plan'] == plan]
    known = [r for r in rows if r['moneyKnown']]
    out = {
        'asOf': datetime.now().strftime('%Y-%m-%d'),
        'source': 'tools/actuals.py against production',
        'shows': len(rows),
        'people': avg([r['people'] for r in rows]),
        'hours': avg([r['hours'] for r in rows]),
        'recordHours': avg([r['recordHours'] for r in rows if r['recordHours']]),
        'setHours': avg([r['setHours'] for r in rows if r['setHours']]),
        'votes': avg([r['votes'] for r in rows]),
        'interactions': avg([r['interactions'] for r in rows if r['interactions'] is not None]),
        'songs': avg([r['songs'] for r in rows]),
        'nets': avg([r['nets'] for r in rows if r['nets'] is not None]),
        'peakVoters': avg([r['peakVoters'] for r in rows]),
        'gigsOnCalendar': len(rows) + len(unused) + len(silent),
        'gigsUsed': len(rows),
        'gigsSilent': len(silent),
        'roomFree': per_head(by('free')),
        'roomPlus': per_head(by('plus')),
        'roomPro': per_head(by('pro')),
        'roomPerHead': per_head(rows),
        'deploys': n30,
        'deploysThisPeriod': nper,
        'billingPeriodStart': pstart,
        # the two bills, kept apart (INVARIANT 0fx): the page reads `shipping` for the deploys dial's
        # caption and `traffic` for the bandwidth line; neither is ever divided by shows
        'shipping': {'what': 'production deploys × 15 credits — a cost of shipping code, never of a gig',
                     'deploys30': n30, 'credits30': (n30 or 0) * CR_DEPLOY,
                     'deploysThisPeriod': nper, 'creditsThisPeriod': (nper or 0) * CR_DEPLOY,
                     'perDayThisPeriod': round(nper / max((datetime.now(timezone.utc) - datetime.fromisoformat(pstart + 'T00:00:00-07:00')).total_seconds() / 86400, 0.5), 1) if nper is not None and pstart else None,
                     'dashboard': {'readAt': dash['readAt'], 'deploys': dash['deploys'], 'credits': dash['deployCredits'], 'shareOfAllCredits': dash['shippingShare']} if dash else None},
        'traffic': {'what': 'everything the rooms cause — bandwidth is the one meter the API exposes; web requests and compute are on Netlify’s Credit usage breakdown page only',
                    'bandwidthBytesThisPeriod': bw_used, 'bandwidthGBThisPeriod': round(bw_used / 1e9, 3), 'bandwidthCreditsThisPeriod': round(bw_used / 1e9 * CR_PER_GB, 1),
                    'bandwidthReadAt': bw.get('last_updated_at'),
                    'dashboard': {k: dash[k] for k in ('readAt', 'periodStart', 'webRequests', 'webRequestCredits', 'computeCredits', 'bandwidthCredits', 'trafficCredits', 'totalCredits')} if dash else None},
        'pollsPerPhoneHour': rate,
        'pollsSource': rate_src,
        # TRAFFIC ONLY (INVARIANT 0fx): what one night adds over an empty day on Netlify's requests, compute and bandwidth meters
        'creditsPerShow': meters.get('creditsPerShow') if meters else None,
        'meters': meters,
        'note': (f"{len(rows)} night(s) on the published calendar where the room used the app, across {len(set(r['artist'] for r in rows))} artist(s)"
                 + (f" ({len(unused)} more on the calendar where it went unused)" if unused else '') + '; '
                 f"{len(known)} with money known (per-person figures use only those"
                 + ('' if known else ' — none this time: card payments were down, so room money is unknown, not zero') + '). '
                 f"A night's hours are the record unless it overran the published slot (auto-end adds a 3 h grace), then the later of the slot and the last song started. "
                 f"Votes per night: {avg([r['votes'] for r in rows])}. "
                 + (f"Ticks per phone-hour: {rate} — {rate_src}. " if rate is not None else "No night can be read yet — no bracket with a quiet pair within 48 h and no per-day meters on file — so ticks per phone-hour is still the model's guess. ")
                 + (f"By the same meters a night adds about {meters['creditsPerShow']} credits of traffic over an empty day (empty day: {meters['background']['requests']:,} requests, {meters['background']['computeCredits']} credits of compute, {meters['background']['bandwidthMB']} MB; {len(meters['gigDays'])} gig day(s) since {meters['cleanFrom']}). "
                    if meters and meters.get('creditsPerShow') is not None else '')
                 + (f"{sum(1 for n in per_night if n.get('why'))} bracket(s) of bandwidth marks withheld — see pollsByNight for why; background over every quiet pair on file {bg / 1e6:.2f} MB/h from {quiet_n} pair(s). " if any(n.get('why') for n in per_night) else '')
                 + f"Deploys are account-wide (all five sites share the credit grant): {n30} in the last 30 days, {nper} this billing period = {(nper or 0) * CR_DEPLOY} credits — the SHIPPING bill, kept apart from the traffic bill and never spread over shows (INVARIANT 0fx). "
                 + f"Bandwidth this period: {bw_used / 1e9:.3f} GB = {bw_used / 1e9 * CR_PER_GB:.1f} credits for everything every room did."),
        'nights': [{k: v for k, v in r.items() if k not in ('startedAt', 'endedAt')} for r in sorted(rows, key=lambda r: r['endedAt'] or 0, reverse=True)],
        'onCalendarUnused': [{k: v for k, v in r.items() if k not in ('startedAt', 'endedAt')} for r in unused],
        'silentNights': silent,
        'notCounted': [{k: v for k, v in r.items() if k not in ('startedAt', 'endedAt')} for r in skipped],
        'pollsByNight': per_night,
        'marksOnFile': len(marks),
    }
    txt = json.dumps(out, indent=1)
    print(txt)
    if '--write' in sys.argv:
        os.makedirs(os.path.join(ROOT, 'finance'), exist_ok=True)
        with open(os.path.join(ROOT, 'finance', 'actuals.json'), 'w') as f:
            f.write(txt + '\n')
        print('\nwritten to finance/actuals.json', file=sys.stderr)
        # fold the founder's own marks into the repo's file, so the commit that carries this actuals.json carries them too
        try:
            own = json.load(open(MARKS_OWN))
        except Exception:
            own = []
        try:
            repo = json.load(open(MARKS))
        except Exception:
            repo = []
        have = {m['at'] for m in repo}
        new = [m for m in own if m['at'] not in have]
        if new:
            with open(MARKS, 'w') as f:
                f.write(json.dumps(sorted(repo + new, key=lambda m: m['at']), indent=1) + '\n')
            print(f"folded {len(new)} of the founder's own mark(s) into finance/marks.json", file=sys.stderr)


if __name__ == '__main__':
    main()
