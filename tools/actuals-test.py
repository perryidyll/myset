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
         dict(at=iso(t1), used=int(100_000_000 + 2 * bg + 4 * bg + other + polls * A.BYTES['poll'] + 2 * A.BYTES['clip']), periodStart='p', clipViews=2, label='after')]   # the night, plus two clip views
rate, per, bgs, qn = A.solve_polls([night], marks)
ok('background recovered from the quiet pair (5 MB/h)', round(bgs) == bg, bgs)
ok('polls recovered exactly when the two clip views are on the AFTER mark', per[0]['polls'] == polls, per)
ok('rate = polls ÷ phone-hours', rate == round(polls / 20, 1), rate)
marks[2]['clipViews'] = 0
rate2, per2, _, _ = A.solve_polls([night], marks)
ok('without the clip count the same night reads as ~59,000 extra polls — the trap the flag exists for', per2[0]['polls'] - polls > 59_000, per2[0]['polls'])
print(f'\n{fails} FAILED' if fails else '\nall passed'); sys.exit(1 if fails else 0)
