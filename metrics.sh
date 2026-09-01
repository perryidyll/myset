#!/usr/bin/env bash
# Pull everything MySet knows about itself into CSVs, for the tracking workbook.
#
#   MYSET_ADMIN_CODE='...' ./metrics.sh
#
# The code is read from the environment and never stored here — INVARIANT 11.
# Read-only: every call is a GET. Output lands in ./metrics/ (gitignored).
set -u
BASE="${MYSET_BASE:-https://myset.vip}"
CODE="${MYSET_ADMIN_CODE:-}"
OUT="metrics"; mkdir -p "$OUT"

if [ -z "$CODE" ]; then
  echo "No MYSET_ADMIN_CODE set — pulling the PUBLIC data only."
  echo "For the gig log and the money, run:  MYSET_ADMIN_CODE='your studio code' ./metrics.sh"
  echo
fi

api () { curl -sL --max-time 25 "$BASE/api/$1"; }
auth () { [ -n "$CODE" ] && curl -sL --max-time 25 "$BASE/api/$1${1#*\?}" \
            -H "x-admin-code: $CODE" || echo '{}'; }

# ---- public: the live catalogue -------------------------------------------
api "show" > "$OUT/_show.json"
python3 - "$OUT" <<'PY'
import json,sys,csv,os
out=sys.argv[1]
d=json.load(open(f"{out}/_show.json"))
rows=[]
for s in (d.get('songs') or [])+(d.get('played') or []):
    rows.append([s.get('id'),s.get('title'),s.get('artist'),
                 ';'.join(s.get('tags') or []),s.get('votes',0),s.get('cost',1)])
with open(f"{out}/catalogue.csv","w",newline='') as f:
    w=csv.writer(f); w.writerow(['song_id','title','artist','genres','votes_now','cost']); w.writerows(rows)
print(f"  catalogue.csv        {len(rows)} songs")
PY

# ---- artist-only: the gig log and the demand signal ------------------------
if [ -n "$CODE" ]; then
  curl -sL --max-time 25 "$BASE/api/history" -H "x-admin-code: $CODE" > "$OUT/_hist.json"
  python3 - "$OUT" "$BASE" "$CODE" <<'PY'
import json,sys,csv,urllib.request
out,base,code=sys.argv[1],sys.argv[2],sys.argv[3]
try: h=json.load(open(f"{out}/_hist.json"))
except Exception: h={}
if not h.get('ok'):
    print("  (history: unauthorized — check MYSET_ADMIN_CODE)"); raise SystemExit
shows=h.get('shows') or []
def get(u):
    r=urllib.request.Request(u,headers={'x-admin-code':code})
    return json.load(urllib.request.urlopen(r,timeout=25))
gigs=[];played=[];wanted=[]
for s in shows:
    sid=s.get('showId')
    try: d=get(f"{base}/api/history?show={sid}").get('show') or {}
    except Exception: d={}
    st=d.get('stats') or {}; mo=d.get('money') or {}
    gigs.append([sid,d.get('venue',''),d.get('city',''),
        (d.get('startedAt') or ''),(d.get('endedAt') or ''),
        st.get('room',''),st.get('peakVoters',''),st.get('totalVotes',''),
        st.get('songsPlayed',''),(st.get('topSong') or {}).get('title',''),
        mo.get('gross',''),mo.get('tips',''),mo.get('votes','')])
    for p in d.get('played') or []:
        played.append([sid,p.get('songId'),p.get('title'),p.get('artist'),
                       p.get('votes',0),p.get('voters',0),p.get('replay',False)])
    for r in d.get('requested') or []:
        wanted.append([sid,r.get('songId'),r.get('title'),r.get('artist'),r.get('votes',0)])
def dump(name,head,rows):
    with open(f"{out}/{name}","w",newline='') as f:
        w=csv.writer(f); w.writerow(head); w.writerows(rows)
    print(f"  {name:<20} {len(rows)} rows")
dump('gigs.csv',['show_id','venue','city','started','ended','phones_in_room','peak_voters',
                 'total_votes','songs_played','top_song','gross_usd','tips_usd','vote_sales_usd'],gigs)
dump('songs-played.csv',['show_id','song_id','title','artist','votes_won','voters','was_replay'],played)
dump('songs-wanted.csv',['show_id','song_id','title','artist','votes_never_played'],wanted)
PY
fi

# ---- infrastructure --------------------------------------------------------
export PATH="$HOME/.local/node/bin:$PATH"
# NB: to a file first. A heredoc IS stdin, so piping into `python3 - <<'PY'`
# makes the script read itself instead of the JSON. Cost an empty infra.csv once.
netlify api listSites --data '{}' 2>/dev/null > "$OUT/_sites.json"
python3 - "$OUT" <<'PY'
import json,sys,csv,subprocess,os
out=sys.argv[1]
try: sites=json.load(open(f"{out}/_sites.json"))
except Exception: sites=[]
rows=[]
env=dict(os.environ); env['PATH']=os.path.expanduser('~/.local/node/bin')+':'+env.get('PATH','')
for s in sites:
    try:
        d=subprocess.run(['netlify','api','listSiteDeploys','--data',
              json.dumps({'site_id':s['id'],'per_page':100})],capture_output=True,text=True,env=env,timeout=60)
        ds=json.loads(d.stdout)
    except Exception: ds=[]
    prod=[x for x in ds if x.get('context')=='production' and x.get('state')=='ready']
    git=len([x for x in prod if x.get('commit_ref') and x.get('build_id')])
    rows.append([s.get('name'),s.get('url'),(s.get('build_settings') or {}).get('repo_path') or '',
                 len(prod),git,len(prod)-git,len(prod)*15])
with open(f"{out}/infra.csv","w",newline='') as f:
    w=csv.writer(f); w.writerow(['site','url','github_repo','production_deploys','via_git','via_cli','credits'])
    w.writerows(rows)
print(f"  infra.csv            {len(rows)} sites")
PY
rm -f "$OUT"/_*.json
echo
echo "Done. CSVs in ./$OUT/ — import each into its tab in the MySet Metrics sheet."
