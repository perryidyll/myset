#!/usr/bin/env python3
"""Real numbers from real shows, in the shape finance/model.html expects.

    python3 tools/actuals.py                  # print the JSON to paste into the model
    python3 tools/actuals.py --write          # also save finance/actuals.json
    python3 tools/actuals.py --mark "before Sat gig"   # record one bandwidth reading (see below)
    python3 tools/actuals.py --mark "after Sat gig" --studio-min 140 --clip-views 0   # …how long the Studio Live tab was up, and whether anyone watched a posted clip
    python3 tools/actuals.py --marks          # list the readings on file

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
  pollsPerPhoneHour  AUDIENCE polls per phone per hour, solved from the bandwidth
                     marks that bracket a night (null until two marks bracket one)
  creditsPerShow     null — Netlify does not expose per-show credits
  asOf, source, note, nights, notCounted, marks

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
(GET /accounts/<id>/bandwidth). Every audience poll is 2,530 bytes on the wire
(measured; the same constant the model uses), so the bytes a night adds to that
counter, minus what the Studio tab, the page loads and the votes cost, is the
poll count. So:
  · run `--mark "..."` the evening BEFORE a gig and again the morning AFTER it (the
    counter lags a couple of minutes; a mark records when it was last updated);
  · run `--mark` twice on a quiet day, an hour or more apart, with no show between:
    that pair measures the background the other four sites add per hour, which is
    subtracted from every show window;
  · the report then finds, for each counted night, the last mark before it started
    and the first mark after it ended (same billing period — the counter resets on
    the period start, 8 Sep this month) and solves for the polls.
ONE VIEW OF A POSTED VIDEO CLIP IS ~75 MB — thirty thousand polls' worth. If anybody
(including you) watched a clip on the profile between the two marks, pass
--clip-views N on the AFTER mark or the solve is off by that much; the 8–11 Sep reading
(335.7 MB in three days, two gigs) was mostly clips, not polls.
The Studio Live tab keeps ticking after the show ends and before it starts, so close it
(or leave Live) the moment the set ends and take the AFTER mark before it is reopened;
better, pass --studio-min with the minutes it was actually on screen. Without that the
solver assumes it was up 60% of the night (the model's default) and says so.
The byte constants live in BYTES below and finance/model-test.mjs checks that they
still match the model's defaults, so the two cannot drift apart silently.
"""
import json, os, subprocess, sys, urllib.request
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

STORE = 'myset'
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MARKS = os.path.join(ROOT, 'finance', 'marks.json')
ENV = {**os.environ, 'PATH': os.environ['HOME'] + '/.local/node/bin:' + os.environ.get('PATH', '')}

# bytes on the wire per call — MUST equal P0.pollBytes / writeBytes / studioBytes /
# viewBytes / pageBytes in finance/model.html (model-test.mjs enforces it)
BYTES = {'poll': 2530, 'write': 1200, 'studio': 4000, 'view': 3000, 'page': 48000, 'clip': 75000000}   # clip = one full view of a posted video (the three so far are 74–79 MB)
STUDIO_POLLS_PER_HOUR = 3600 / 4        # the Studio's own tick, every 4 s while the tab is open
EXTRA_VIEWS_PER_PHONE = 0.5             # profile / community / city-feed pages, per phone (model default)
STUDIO_SHARE = 0.6                      # share of the night the Studio Live tab is on screen when nobody recorded it (= P0.studioShare)


def run(args):
    r = subprocess.run(args, capture_output=True, text=True, env=ENV, cwd=ROOT)
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
        gross = float(m.get('gross') or 0) + float(m.get('unattributed') or 0)   # a payment not tagged with the show is still the room's money
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
                   gig=gig, gross=gross if money_known else None,
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
        a['gross'] = sum(r['gross'] for r in rs) if a['moneyKnown'] else None
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
    try:
        return json.load(open(MARKS))
    except Exception:
        return []


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
        m['clipViews'] = float(sys.argv[sys.argv.index('--clip-views') + 1])   # full views of a posted video since the previous mark (each is ~75 MB — 30,000 polls' worth)
    marks = read_marks()
    marks.append(m)
    os.makedirs(os.path.dirname(MARKS), exist_ok=True)
    with open(MARKS, 'w') as f:
        f.write(json.dumps(marks, indent=1) + '\n')
    print(f"mark #{len(marks)}  {m['at']}  {m['used']:,} bytes used this period  — {label}")
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


def solve_polls(rows, marks, skipped=()):
    """For each bracket of marks around counted nights: the bytes between them, less the
    background the quiet pairs show, less everything on the wire that is not an audience
    poll, ÷ bytes per poll. Nights that share a bracket are solved together (one rate
    over their combined phone-hours). Returns (rate, per-night rows, background B/h,
    quiet-pair count)."""
    if len(marks) < 2:
        return None, [], None, 0
    marks = sorted(marks, key=lambda m: m['at'])
    every = list(rows) + [r for r in skipped if r.get('startedAt') and r.get('endedAt')]   # a test show still moves the counter
    quiet_bytes = quiet_hours = 0.0; quiet_n = 0
    for a, b in zip(marks, marks[1:]):
        if a.get('periodStart') != b.get('periodStart') or b['used'] < a['used']:
            continue
        t0, t1 = eff(a), eff(b)
        busy = any(r['startedAt'] < t1 and r['endedAt'] > t0 for r in every)
        hrs = (t1 - t0) / 3600e3
        if not busy and hrs >= 0.5:
            quiet_bytes += b['used'] - a['used']; quiet_hours += hrs; quiet_n += 1
    bg = quiet_bytes / quiet_hours if quiet_hours else 0.0
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
        window_h = (eff(b) - eff(a)) / 3600e3
        delta = b['used'] - a['used']
        studio_min = b.get('studioMin')
        studio_h = studio_min / 60 if studio_min is not None else sum(r['hours'] for r in rs) * STUDIO_SHARE
        studio_bytes = studio_h * STUDIO_POLLS_PER_HOUR * BYTES['studio']
        clip_bytes = (b.get('clipViews') or 0) * BYTES['clip']
        other = studio_bytes + clip_bytes + sum(r['people'] * BYTES['page'] + r['votes'] * BYTES['write'] + r['people'] * EXTRA_VIEWS_PER_PHONE * BYTES['view'] for r in rs)
        polls = (delta - bg * window_h - other) / BYTES['poll']
        ph = sum(r['people'] * r['hours'] for r in rs)
        rate = polls / ph if polls > 0 and ph else None
        studio_share = studio_bytes / max(delta - bg * window_h, 1)
        for r in rs:
            per_night.append({'key': r['key'], 'bytes': delta, 'windowHours': round(window_h, 2), 'background': round(bg * window_h),
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
    rate, per_night, bg, quiet_n = solve_polls(rows, marks, skipped)
    if rate is not None and not quiet_n:
        provisional, rate = rate, None      # without a quiet pair the background is unknown and the number would be high
    n30, nper, pstart = deploys()
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
        'pollsPerPhoneHour': rate,
        'pollsProvisional': locals().get('provisional'),
        'creditsPerShow': None,
        'note': (f"{len(rows)} night(s) on the published calendar where the room used the app, across {len(set(r['artist'] for r in rows))} artist(s)"
                 + (f" ({len(unused)} more on the calendar where it went unused)" if unused else '') + '; '
                 f"{len(known)} with money known (per-person figures use only those"
                 + ('' if known else ' — none this time: card payments were down, so room money is unknown, not zero') + '). '
                 f"A night's hours are the record unless it overran the published slot (auto-end adds a 3 h grace), then the later of the slot and the last song started. "
                 f"Votes per night: {avg([r['votes'] for r in rows])}. "
                 + (f"Polls measured from bandwidth marks on {sum(1 for n in per_night if n.get('pollsPerPhoneHour'))} night(s), background {bg / 1e6:.2f} MB/h from {quiet_n} quiet pair(s). "
                    if rate else (f"A night is bracketed by marks but NO quiet pair measures the other sites' background, so the {locals().get('provisional')} polls/phone-hour it gives is withheld — take two marks an hour apart on a quiet day. "
                    if locals().get('provisional') else "No night is bracketed by two bandwidth marks yet, so polls per phone-hour is still the model's guess. "))
                 + f"Deploys are account-wide (all five sites share the credit grant): {n30} in the last 30 days, {nper} this billing period."),
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


if __name__ == '__main__':
    main()
