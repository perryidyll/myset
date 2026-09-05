#!/usr/bin/env python3
"""Real numbers from real shows, in the shape finance/model.html expects.

    python3 tools/actuals.py                  # print the JSON to paste into the model
    python3 tools/actuals.py --write          # also save finance/actuals.json
    python3 tools/actuals.py --mark "before Sat gig"   # record one bandwidth reading (see below)
    python3 tools/actuals.py --mark "after Sat gig" --studio-min 140   # …and how long the Studio Live tab was up
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
  pollsPerPhoneHour  AUDIENCE polls per phone per hour, solved from the bandwidth
                     marks that bracket a night (null until two marks bracket one)
  creditsPerShow     null — Netlify does not expose per-show credits
  asOf, source, note, nights, notCounted, marks

WHICH NIGHTS COUNT. The archive rule (nothing happened is not a night) applies here
too, and four more, each learned from a real record in production:
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
The Studio Live tab keeps ticking after the show ends and before it starts, so close it
(or leave Live) the moment the set ends and take the AFTER mark before it is reopened;
better, pass --studio-min with the minutes it was actually on screen. Without that the
solver assumes it was up 60% of the night (the model's default) and says so.
The byte constants live in BYTES below and finance/model-test.mjs checks that they
still match the model's defaults, so the two cannot drift apart silently.
"""
import json, os, subprocess, sys, urllib.request
from datetime import datetime, timezone, timedelta

STORE = 'myset'
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MARKS = os.path.join(ROOT, 'finance', 'marks.json')
ENV = {**os.environ, 'PATH': os.environ['HOME'] + '/.local/node/bin:' + os.environ.get('PATH', '')}

# bytes on the wire per call — MUST equal P0.pollBytes / writeBytes / studioBytes /
# viewBytes / pageBytes in finance/model.html (model-test.mjs enforces it)
BYTES = {'poll': 2530, 'write': 1200, 'studio': 4000, 'view': 3000, 'page': 48000}
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


def shows():
    """One row per night that actually happened. The archive writes the counts
    under `stats` and the money under `money` (see _history.mjs)."""
    artists = blob('artists') or {}
    rows, skipped = [], []
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
        hours = (e0 - s0) / 3600e3 if s0 and e0 and e0 > s0 else None
        m = d.get('money') or {}
        money_known = m.get('source') == 'stripe'
        gross = float(m.get('gross') or 0) + float(m.get('unattributed') or 0)   # a payment not tagged with the show is still the room's money
        why = None
        if not people and not votes:
            why = 'nobody there'
        elif not (s0 and e0):
            why = 'no start or end time on record'
        elif e0 <= s0:
            why = 'ended before it started — a broken record'
        elif people <= 1 and not votes:
            why = 'one phone and no votes — a test'
        elif nets == 1 and people >= 10 and hours < 0.5:
            why = f'{people} phones all on one network and over in {round(hours * 60)} minutes — a load test from one machine, not a room'
        elif hours < 0.5:
            why = 'shorter than 30 minutes — a test or a demo'
        elif hours > 12:
            why = 'longer than 12 h — a show that failed to end itself; not a night'
        row = dict(key=k, artist=aid, plan=plan_of(artists, aid), people=people, nets=nets, votes=votes,
                   hours=round(hours, 2) if hours else None, gross=gross if money_known else None,
                   moneyKnown=money_known, startedAt=s0, endedAt=e0)
        if why:
            skipped.append({**row, 'skipped': why})
        else:
            rows.append(row)
    return rows, skipped


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
        other = studio_bytes + sum(r['people'] * BYTES['page'] + r['votes'] * BYTES['write'] + r['people'] * EXTRA_VIEWS_PER_PHONE * BYTES['view'] for r in rs)
        polls = (delta - bg * window_h - other) / BYTES['poll']
        ph = sum(r['people'] * r['hours'] for r in rs)
        rate = polls / ph if polls > 0 and ph else None
        studio_share = studio_bytes / max(delta - bg * window_h, 1)
        for r in rs:
            per_night.append({'key': r['key'], 'bytes': delta, 'windowHours': round(window_h, 2), 'background': round(bg * window_h),
                              'studioMinutes': round(studio_h * 60), 'studioAssumed': studio_min is None, 'studioShareOfBytes': round(studio_share, 2),
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
    rows, skipped = shows()
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
        'note': (f"{len(rows)} night(s) that really happened, across {len(set(r['artist'] for r in rows))} artist(s); "
                 f"{len(known)} with money known (per-person figures use only those). "
                 f"Votes per night: {avg([r['votes'] for r in rows])}. "
                 + (f"Polls measured from bandwidth marks on {sum(1 for n in per_night if n.get('pollsPerPhoneHour'))} night(s), background {bg / 1e6:.2f} MB/h from {quiet_n} quiet pair(s). "
                    if rate else (f"A night is bracketed by marks but NO quiet pair measures the other sites' background, so the {locals().get('provisional')} polls/phone-hour it gives is withheld — take two marks an hour apart on a quiet day. "
                    if locals().get('provisional') else "No night is bracketed by two bandwidth marks yet, so polls per phone-hour is still the model's guess. "))
                 + f"Deploys are account-wide (all five sites share the credit grant): {n30} in the last 30 days, {nper} this billing period."),
        'nights': [{k: v for k, v in r.items() if k not in ('startedAt', 'endedAt')} for r in sorted(rows, key=lambda r: r['endedAt'] or 0, reverse=True)],
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
