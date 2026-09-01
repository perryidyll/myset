#!/usr/bin/env bash
# What's actually eating your Netlify credits this billing period.
#   ./credit-burn.sh
#
# Deploys are ~all of it: 15 credits each, vs 2 credits per 10,000 web requests.
#
# TWO THINGS THIS GETS RIGHT THAT THE FIRST VERSION DID NOT (found 2026-09-01):
#   1. Only PRODUCTION deploys cost credits. Drafts and deploy previews are free,
#      and the old version billed them at 15 each — inflating the number that
#      decides Personal-vs-Pro.
#   2. It pages. The old version asked for 200 deploys and silently stopped there,
#      so a busy period under-reported precisely when it mattered most.
# It also splits production deploys by TRIGGER, because mysetvip was being
# deployed twice for every change — once from the CLI and once by the GitHub
# build that the same push kicked off. See INVARIANT 9d3.
set -euo pipefail
export PATH="$HOME/.local/node/bin:$PATH"

ACC=$(netlify api listAccountsForUser --data '{}' 2>/dev/null \
  | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['slug'])")
INFO=$(netlify api getAccount --data "{\"account_id\":\"$ACC\"}" 2>/dev/null)
START=$(echo "$INFO" | python3 -c "import json,sys;print(json.load(sys.stdin)['current_billing_period_start'][:10])")
NEXT=$(echo "$INFO"  | python3 -c "import json,sys;print(json.load(sys.stdin)['next_billing_period_start'][:10])")
PLAN=$(echo "$INFO"  | python3 -c "import json,sys;print(json.load(sys.stdin)['plan_credits'])")

echo "Billing period: $START -> $NEXT   (plan grants $PLAN credits/month)"
echo

SITES=$(netlify api listSites --data '{}' 2>/dev/null \
  | python3 -c "
import json,sys
for s in json.load(sys.stdin): print(s['id']+'|'+s['name'])")

total=0; dupes=0
while IFS='|' read -r sid nm; do
  # page until a page starts before the billing period or comes back empty
  read -r prod git cli free <<<"$(
    page=1; P=0; G=0; C=0; F=0
    while [ "$page" -le 20 ]; do
      chunk=$(netlify api listSiteDeploys \
        --data "{\"site_id\":\"$sid\",\"per_page\":100,\"page\":$page}" 2>/dev/null || echo '[]')
      out=$(echo "$chunk" | python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except Exception: d=[]
p=g=c=f=0
oldest='9999'
for x in d:
    at=(x.get('created_at') or '')[:10]
    oldest=min(oldest,at) if at else oldest
    if x.get('state')!='ready' or at < '$START': continue
    if x.get('context')=='production':
        p+=1
        if x.get('commit_ref') and x.get('build_id'): g+=1
        else: c+=1
    else: f+=1
print(p,g,c,f,len(d),oldest)")
      set -- $out
      P=$((P+$1)); G=$((G+$2)); C=$((C+$3)); F=$((F+$4))
      [ "$5" -lt 100 ] && break
      [ "$6" \< "$START" ] && break
      page=$((page+1))
    done
    echo "$P $G $C $F"
  )"
  [ -z "${prod:-}" ] && prod=0 && git=0 && cli=0 && free=0
  printf "  %-26s %3s production = %5s credits   (git %s / cli %s)  + %s free\n" \
    "$nm" "$prod" "$((prod*15))" "$git" "$cli" "$free"
  total=$((total + prod*15))
  # a site deployed BOTH ways is paying twice for the same change
  if [ "$git" -gt 0 ] && [ "$cli" -gt 0 ]; then
    smaller=$git; [ "$cli" -lt "$git" ] && smaller=$cli
    dupes=$((dupes + smaller))
  fi
done <<< "$SITES"

echo "  ─────────────────────────────────────────────────────────────────────"
printf "  %-26s %26s credits\n" "TOTAL FROM DEPLOYS" "$total"
echo
python3 - "$total" "$PLAN" "$dupes" <<'PY'
import sys
t, plan, dup = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
print(f"  That is {t/plan*100:.0f}% of your monthly grant, on deploys alone.")
if dup:
    print(f"  {dup} of those look like DOUBLE deploys (CLI + the GitHub build the")
    print(f"  same push triggered) = ~{dup*15} credits of pure duplication. INVARIANT 9d3.")
print("  Break-even vs Pro ($20 for 3,000): ~2,100 credits/month.")
if t > 2100:
    print("  -> You are past it. Pro is now cheaper than Personal + packs.")
else:
    print(f"  -> Still {2100-t} credits/month below it. Stay on Personal + packs.")
PY
