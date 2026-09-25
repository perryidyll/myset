#!/usr/bin/env python3
"""Offline tests for tools/actuals.py — the night rules against a real snapshot of
production (finance/fixtures/2026-09-11: every archived night of the first gig week,
the calendar, the fan requests; nothing secret), and the bandwidth solver against
synthetic marks. Run: python3 tools/actuals-test.py"""
import copy, importlib.util, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, '..', 'finance', 'fixtures', '2026-09-11')
spec = importlib.util.spec_from_file_location('actuals', os.path.join(HERE, 'actuals.py'))
A = importlib.util.module_from_spec(spec); spec.loader.exec_module(A)

def blob(key):
    try:
        return json.load(open(os.path.join(FIX, key + '.json')))
    except Exception:
        return None
A.blob = blob
A.keys = lambda: [l.strip() for l in open(os.path.join(FIX, 'keys.txt')) if l.strip()]
fails = 0
def ok(name, cond, detail=''):
    global fails
    print(('  ✓ ' if cond else '  ✗ ') + name + ('' if cond else '   ' + str(detail)))
    if not cond: fails += 1

print('NIGHT RULES on the 11 Sep snapshot')
rows, skipped, unused = A.shows()
sid = lambda r: r['key'].split('_', 2)[2]
ok('five nights on the published calendar count (30 Aug, 6/7/8/9 Sep)',
   {sid(r) for r in rows} == {'2026-08-30-1210', '2026-09-06-1130-gzbi', '2026-09-07-1330-nc5m', '2026-09-08-1153-qkrd', '2026-09-09-1130-l6ru'}, {sid(r) for r in rows})
ok('the 4 Sep Seaflower night is on the calendar but unused (one phone, no votes)', {sid(r) for r in unused} == {'2026-09-04-1150-svmm'}, unused)
ok('fourteen records are tests, accidents or load tests', len(skipped) == 14, len(skipped))
ok('every test started at a random hour is named as such', all('not on the published calendar' in r['skipped'] for r in skipped if r['artist'] == 'perry-idyll' and r['people'] and sid(r) != '2026-08-30-1855'), [r['skipped'] for r in skipped])
h = {sid(r): r['hours'] for r in rows}
ok('a night ended inside its slot keeps its record length (Sun 2.53, Mon 2.81)', h['2026-09-06-1130-gzbi'] == 2.53 and h['2026-09-07-1330-nc5m'] == 2.81, h)
ok('a record that overran the slot is the later of the slot and the last song (Tue 2.09 of a 4.23 h record)', h['2026-09-08-1153-qkrd'] == 2.09, h)
ok('a room still voting past the slot is still a room (Wed 4.07 of a 6.0 h record, 3 h slot)', h['2026-09-09-1130-l6ru'] == 4.07, h)
ok('samcole (no calendar, not in the registry) falls back to the old rules with plan unknown', all(r['plan'] == 'unknown' for r in skipped if r['artist'] == 'samcole'))
ok('interactions = votes + requests per phone (Mon: 27 + 4 over 14 phones)', next(r for r in rows if sid(r) == '2026-09-07-1330-nc5m')['interactions'] == round(31 / 14, 2))
ok('room money comes only from nights Stripe answered ($0.375, one night)', A.per_head(rows) == 0.375 and sum(r['moneyKnown'] for r in rows) == 1)
avg = lambda k: round(sum(r[k] for r in rows) / len(rows), 3)
ok('averages: 11.0 phones, 2.738 h, 2.348 interactions', avg('people') == 11.0 and avg('hours') == 2.738 and avg('interactions') == 2.348, (avg('people'), avg('hours'), avg('interactions')))

print('SILENT NIGHTS from the calendar')
sil = A.silent_nights(rows, unused, now_ms=1789117564399)          # 11 Sep 09:06 UTC
dates = [x['date'][:10] for x in sil]
ok('the four gig nights swallowed by the 107.9 h record and Thu 10 Sep are listed, in order', dates == ['Mon 31 Aug', 'Tue 01 Sep', 'Wed 02 Sep', 'Thu 03 Sep', 'Thu 10 Sep'], dates)
ok('a gig that has not happened yet is not silent', not any(d.startswith('Fri 11 Sep') for d in dates))

print('SPLIT NIGHTS merge')
mon = next(r for r in rows if sid(r) == '2026-09-07-1330-nc5m')
twin = copy.deepcopy(mon); twin['key'] += '-twin'; twin['startedAt'] = mon['endedAt'] + 60000; twin['endedAt'] = twin['startedAt'] + 1800e3
twin.update(votes=5, requests=0, songs=2, people=9, peakVoters=2, lastActivityHours=0.4, setHours=0.3)
m = next(r for r in A.merge_split_nights([r for r in rows if r is not mon] + [mon, twin]) if r.get('mergedFrom'))
ok('two records in one slot become one night: votes and songs summed, phones the larger, hours from the earliest start', m['votes'] == 32 and m['songs'] == 17 and m['people'] == 14 and m['hours'] == 3.23, m)

print('THE BANDWIDTH SOLVER on synthetic marks')
night = dict(key='n1', artist='a', people=10, votes=20, hours=2.0, startedAt=2_000_000_000_000, endedAt=2_000_000_000_000 + 7_200_000)
bg = 5_000_000                                                       # 5 MB/h from the other sites
polls = 3000
studio_bytes = 2.0 * 0.6 * A.STUDIO_POLLS_PER_HOUR * A.BYTES['studio']
other = studio_bytes + 10 * A.BYTES['page'] + 20 * A.BYTES['write'] + 10 * A.EXTRA_VIEWS_PER_PHONE * A.BYTES['view']
t0 = night['startedAt'] - 3_600_000; t1 = night['endedAt'] + 3_600_000
iso = lambda ms: A.datetime.fromtimestamp(ms / 1000, A.timezone.utc).isoformat()
marks = [dict(at=iso(t0 - 7_200_000), used=100_000_000, periodStart='p', label='quiet a'), dict(at=iso(t0), used=100_000_000 + 2 * bg, periodStart='p', label='before'),   # a quiet pair: 2 h of background
         dict(at=iso(t1), used=int(100_000_000 + 2 * bg + 4 * bg + other + polls * A.TICK_BYTES + 2 * A.BYTES['clip']), periodStart='p', clipViews=2, label='after')]   # the night (a tick is board + personal since the split), plus two clip views
rate, per, bgs, qn = A.solve_polls([night], marks)
ok('background recovered from the quiet pair (5 MB/h)', round(bgs) == bg, bgs)
ok('polls recovered exactly when the two clip views are on the AFTER mark', per[0]['polls'] == polls, per)
ok('rate = polls ÷ phone-hours', rate == round(polls / 20, 1), rate)
marks[2]['clipViews'] = 0
rate2, per2, _, _ = A.solve_polls([night], marks)
ok('without the clip count the same night reads as ~43,000 extra ticks (two 75 MB clips ÷ 3,470 B) — the trap the flag exists for', per2[0]['polls'] - polls > 2 * A.BYTES['clip'] / A.TICK_BYTES * 0.95, per2[0]['polls'])
print('THE TWO RULES ON THE SOLVER (25 Sep, decision 0089): a quiet pair from another week is refused; a fortnight is not a night')
after = dict(at=iso(t1), used=int(100_000_000 + 2 * bg + 4 * bg + other + polls * A.TICK_BYTES + 2 * A.BYTES['clip']), periodStart='p', clipViews=2, label='after')
far = [dict(at=iso(t0 - 20 * 86_400_000), used=90_000_000, periodStart='p', label='quiet a, three weeks before'), dict(at=iso(t0 - 20 * 86_400_000 + 7_200_000), used=90_000_000 + 2 * bg, periodStart='p', label='quiet b'),
       dict(at=iso(t0), used=100_000_000 + 2 * bg, periodStart='p', label='before'), after]
rate_f, per_f, bg_f, qn_f = A.solve_polls([night], far)
ok('a quiet pair 20 days away is on file but NOT applied: the bracket is withheld and says why', rate_f is None and qn_f == 1 and per_f[0]['polls'] is None and 'no quiet pair within 48 h' in per_f[0]['why'], per_f)
ok('…and the withheld row still shows what the bytes would read as with no background, so the trap is visible', per_f[0]['pollsIfNoBackground'] > polls, per_f[0].get('pollsIfNoBackground'))
long_night = dict(night, endedAt=night['startedAt'] + 30 * 3_600_000)   # a record that ran 30 h
rate_l, per_l, _, _ = A.solve_polls([long_night], [marks[0], marks[1], dict(after, at=iso(long_night['endedAt'] + 3_600_000))])
ok('a bracket longer than 24 h is not a night: withheld, with the length in the reason', rate_l is None and per_l[0]['polls'] is None and 'longer than 24 h' in per_l[0]['why'], per_l)
ok('the pair right before the night (two hours, adjacent) is still applied — three marks, one night', A.solve_polls([night], marks)[1][0]['quietPairsUsed'] == 1)
one_phone = dict(key='u1', artist='a', people=1, votes=0, hours=2.0, startedAt=t0 - 7_000_000, endedAt=t0 - 200_000)   # a one-phone night inside the quiet pair's window
_, per_u, bg_u, qn_u = A.solve_polls([night], marks, (), [one_phone])
ok('a one-phone night (the Studio ticking, nobody voting) inside the pair makes it busy, not quiet — no pair, bracket withheld', qn_u == 0 and per_u[0]['polls'] is None, (qn_u, per_u[0].get('why')))
slot = [dict(at=t0 - 7_000_000, gig='x', date='Sat', eventId='e', artist='a')]                                          # a published slot nobody used, same window
_, per_s, _, qn_s = A.solve_polls([night], marks, (), (), slot)
ok('…and so does a published slot where nobody came', qn_s == 0 and per_s[0]['polls'] is None, qn_s)
wide = [dict(at=iso(t0 - 478 * 3_600_000), used=90_000_000, periodStart='p', label='a week+ before'), dict(at=iso(t0), used=100_000_000 + 2 * bg, periodStart='p', label='before'), after]
_, per_w, _, qn_w = A.solve_polls([night], wide)
ok('two marks 478 h apart with no show between them are NOT a quiet pair (MAX_QUIET_PAIR_H = 6): the bracket is withheld', qn_w == 0 and per_w[0]['polls'] is None and 'no quiet pair' in per_w[0]['why'], (qn_w, per_w[0].get('why')))

print('THE METER METHOD on a synthetic week (Netlify\'s per-day counts in finance/credits.json)')
ms = lambda t: int(A.datetime.fromisoformat(t).timestamp() * 1000)
r_gig = dict(key='g1', artist='a', people=9, hours=3.0, votes=20, requests=1, startedAt=ms('2026-09-20T11:30:00+00:00'), endedAt=ms('2026-09-20T14:30:00+00:00'))
r_small = dict(key='g2', artist='a', people=3, hours=2.0, votes=7, requests=0, startedAt=ms('2026-09-17T12:00:00+00:00'), endedAt=ms('2026-09-17T14:00:00+00:00'))
r_test = dict(key='t1', artist='a', people=2, votes=3, startedAt=ms('2026-09-18T05:00:00+00:00'), endedAt=ms('2026-09-18T06:00:00+00:00'))
day = lambda d, req, cmp_, mb: dict(day=d, webRequestCount=req, functionsCompute=cmp_, bandwidthMB=mb)
reading = dict(readAt='2026-09-25T02:58:00+00:00', perDay=dict(cleanFrom='2026-09-16', days=[
    day('2026-09-15', 1000, 0.1, 1.0),                                                       # before cleanFrom: ignored, empty or not
    day('2026-09-17', 5600, 3.1, 36.9), day('2026-09-18', 5800, 3.1, 50.9), day('2026-09-19', 3200, 1.7, 13.7),
    day('2026-09-20', 6600, 3.5, 60.7), day('2026-09-21', 3400, 1.9, 300.0), day('2026-09-24', 3700, 2.2, 488.1), day('2026-09-25', 400, 0.0, 5.0)]))
silent = [dict(at=ms('2026-09-24T12:00:00+00:00'), gig='x', date='Thu 24 Sep 19:00', eventId='e', artist='a')]
m = A.solve_meters([r_gig, r_small], [], [r_test], silent, reading)
ok('empty days = no record and no published slot, after cleanFrom, not the day the chart was read (19 and 21 Sep)', m['emptyDays'] == ['2026-09-19', '2026-09-21'], m['emptyDays'])
ok('background: the median empty day for requests and compute, the QUIETEST for bandwidth (3,300 · 1.8 · 13.7 MB — the 300 MB day is a one-off, not a nightly cost)', m['background']['requests'] == 3300 and m['background']['computeCredits'] == 1.8 and m['background']['bandwidthMB'] == 13.7, m['background'])
g = next(n for n in m['nights'] if n.get('key') == 'g1'); g2 = next(n for n in m['nights'] if n.get('key') == 'g2')
ok('the 9-phone night: 3,300 requests over the background − 1,620 Studio − 54 page loads − 21 votes − 4.5 extra pages, halved = 800 ticks, 29.6 a phone-hour', g['ticks'] == 800 and g['ticksPerPhoneHour'] == 29.6, g)
ok('…and 3.3 credits of traffic (0.66 requests + 1.7 compute + 0.94 bandwidth) — no deploy anywhere in it', g['creditsTraffic'] == 3.3, g)
ok('a day with a test record on it is not a gig day, and the row says so', any('not a clean gig day' in (n.get('why') or '') for n in m['nights']), m['nights'])
ok('the rate is phone-hour weighted over the gig days; creditsPerShow is their mean', m['rate'] == round((800.25 + 596.75) / 33, 1) and m['gigDays'] == ['2026-09-17', '2026-09-20'] and m['creditsPerShow'] == round((g['creditsTraffic'] + g2['creditsTraffic']) / 2, 2), (m['rate'], m['gigDays'], m['creditsPerShow']))
ok('no per-day counts on file → the method stands aside (None), it does not guess', A.solve_meters([r_gig], [], [], [], dict(readAt='x', perDay=dict(days=[dict(day='2026-09-20', webRequests=1.3)]))) is None)
print(f'\n{fails} FAILED' if fails else '\nall passed'); sys.exit(1 if fails else 0)
