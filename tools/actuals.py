#!/usr/bin/env python3
"""Real numbers from real shows, in the shape finance/model.html expects.

    python3 tools/actuals.py            # print the JSON to paste into the model
    python3 tools/actuals.py --write    # also save finance/actuals.json

WHAT IT READS (all read-only, nothing is changed):
  · every artist's show history in the production store (the `hist_*` documents),
    via the Netlify CLI that is already signed in on this Mac — the same way
    tools/prod.py works;
  · this billing period's production deploys from Netlify's API (the same count
    credit-burn.sh makes), turned into a per-month rate.

WHAT IT PRODUCES — the fields the model's "Real shows" panel understands:
  shows              nights that actually had people in them
  people             average phones per night  (the room count when the app kept
                     one; the peak voter count before that existed)
  hours              average length of a night, in hours
  roomFree           average $ the room spent per night (tips + packs), for the
                     artists on the free plan
  roomPlus           the same for Plus artists (null until one exists)
  deploys            production deploys per 30 days, this billing period
  pollsPerPhoneHour  null — Netlify does not expose function invocations per
                     site through the CLI; read it from the dashboard
                     (Site → Functions → show) and type it in by hand if you
                     want the screen-on dial calibrated
  creditsPerShow     null — same reason
  asOf, source, note

A NIGHT IS COUNTED ONLY IF SOMEBODY WAS THERE: the archive rule (nothing happened
is not a night) applies here too, otherwise a two-minute test show would drag the
average room size to zero. A show that ran for more than 12 hours is a show that
failed to end itself (that happened, 30 Aug → 4 Sep) and its length is not used.
"""
import json, os, subprocess, sys
from datetime import datetime, timezone

STORE = 'myset'
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ENV = {**os.environ, 'PATH': os.environ['HOME'] + '/.local/node/bin:' + os.environ.get('PATH', '')}


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


def plan_of(artists, aid):
    a = (artists.get('byId') or {}).get(aid) or {}
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
        votes = st.get('totalVotes') or 0
        s0, e0 = d.get('startedAt'), d.get('endedAt')
        hours = (e0 - s0) / 3600e3 if s0 and e0 and e0 > s0 else None
        m = d.get('money') or {}
        gross = float(m.get('gross') or 0) + float(m.get('unattributed') or 0)   # a payment not tagged with the show is still the room's money
        why = None
        if not people and not votes:
            why = 'nobody there'
        elif hours is None or hours < 0.5:
            why = 'shorter than 30 minutes — a test or a demo'
        elif hours > 12:
            why = 'longer than 12 h — a show that failed to end itself; not a night'
        row = dict(key=k, artist=aid, plan=plan_of(artists, aid), people=people, votes=votes,
                   hours=round(hours, 2) if hours else None, gross=gross, endedAt=e0)
        if why:
            skipped.append({**row, 'skipped': why})
        else:
            rows.append(row)
    return rows, skipped


def deploys_per_month():
    acc = run(['netlify', 'api', 'listAccountsForUser', '--data', '{}'])
    try:
        slug = json.loads(acc)[0]['slug']
        info = json.loads(run(['netlify', 'api', 'getAccount', '--data', json.dumps({'account_id': slug})]))
        start = info['current_billing_period_start'][:10]
    except Exception:
        return None
    sites = json.loads(run(['netlify', 'api', 'listSites', '--data', '{}']) or '[]')
    site = next((s for s in sites if s.get('name') == 'mysetvip'), None)
    if not site:
        return None
    n, page = 0, 1
    while page <= 20:
        chunk = json.loads(run(['netlify', 'api', 'listSiteDeploys',
                                '--data', json.dumps({'site_id': site['id'], 'per_page': 100, 'page': page})]) or '[]')
        if not chunk:
            break
        oldest = '9999'
        for x in chunk:
            at = (x.get('created_at') or '')[:10]
            oldest = min(oldest, at) if at else oldest
            if x.get('state') == 'ready' and x.get('context') == 'production' and at >= start:
                n += 1
        if len(chunk) < 100 or oldest < start:
            break
        page += 1
    days = max(1, (datetime.now(timezone.utc) - datetime.fromisoformat(start).replace(tzinfo=timezone.utc)).days)
    return round(n / days * 30)


def main():
    rows, skipped = shows()
    avg = lambda xs: round(sum(xs) / len(xs), 2) if xs else None
    free = [r for r in rows if r['plan'] == 'free']
    plus = [r for r in rows if r['plan'] == 'plus']
    out = {
        'asOf': datetime.now().strftime('%Y-%m-%d'),
        'source': 'tools/actuals.py against production',
        'shows': len(rows),
        'people': avg([r['people'] for r in rows]),
        'hours': avg([r['hours'] for r in rows if r['hours']]),
        'roomFree': avg([r['gross'] for r in free]) if free else None,
        'roomPlus': avg([r['gross'] for r in plus]) if plus else None,
        'deploys': deploys_per_month(),
        'pollsPerPhoneHour': None,
        'creditsPerShow': None,
        'note': f"{len(rows)} night(s) with people in them, across {len(set(r['artist'] for r in rows))} artist(s). "
                f"Votes per night: {avg([r['votes'] for r in rows])}. Founder's own gigs are included; "
                f"the founder is comped Pro so his room money sits under whichever plan the registry says.",
        'nights': [{k: v for k, v in r.items() if k != 'endedAt'} for r in sorted(rows, key=lambda r: r['endedAt'] or 0, reverse=True)],
        'notCounted': [{k: v for k, v in r.items() if k != 'endedAt'} for r in skipped],
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
