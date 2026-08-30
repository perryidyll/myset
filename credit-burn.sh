#!/usr/bin/env bash
# What's actually eating your Netlify credits this billing period.
# Deploys are ~all of it: 15 credits each, vs 2 credits per 10,000 web requests.
#   ./credit-burn.sh
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
total=0
while IFS='|' read -r sid nm; do
  n=$(netlify api listSiteDeploys --data "{\"site_id\":\"$sid\",\"per_page\":200}" 2>/dev/null \
    | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(len([x for x in d if x.get('state')=='ready' and (x.get('created_at') or '')[:10] >= '$START']))" 2>/dev/null || echo 0)
  [ -z "$n" ] && n=0
  printf "  %-26s %3s production deploys = %5s credits\n" "$nm" "$n" "$((n*15))"
  total=$((total + n*15))
done < <(netlify api listSites --data '{}' 2>/dev/null \
  | python3 -c "
import json,sys
for s in json.load(sys.stdin): print(s['id']+'|'+s['name'])")

echo "  ─────────────────────────────────────────────────────────"
printf "  %-26s %22s credits\n" "TOTAL FROM DEPLOYS" "$total"
echo
python3 - "$total" "$PLAN" <<'PY'
import sys
t, plan = int(sys.argv[1]), int(sys.argv[2])
print(f"  That is {t/plan*100:.0f}% of your monthly grant, on deploys alone.")
print(f"  Break-even vs Pro ($20 for 3,000): ~2,100 credits/month.")
if t > 2100:
    print("  -> You are past it. Pro is now cheaper than Personal + packs.")
else:
    print(f"  -> Still {2100-t} credits/month below it. Stay on Personal + packs.")
PY
