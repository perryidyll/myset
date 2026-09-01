#!/usr/bin/env bash
# Does another product carry MySet's fingerprints?
#   ./fingerprint-check.sh https://suspect-app.example.com
#
# Fetches what the site serves and looks for markers that a copy carries but an
# independent build never would. A hit is not a verdict — the point is to turn a
# feeling into something specific enough to put in front of a lawyer.
# Every marker is explained in FINGERPRINTS.md.
set -u
BASE="${1:-}"
[ -z "$BASE" ] && { echo "usage: ./fingerprint-check.sh https://suspect.example.com"; exit 2; }
BASE="${BASE%/}"

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
UA='Mozilla/5.0 (compatible; MySet-provenance-check)'

echo "Fetching $BASE ..."
for p in "/" "/app.css" "/sw.js" "/vote.html" "/studio.html" "/manifest.webmanifest" "/api/show"; do
  curl -sL --max-time 20 -A "$UA" "$BASE$p" -o "$TMP/$(echo "$p" | tr '/' '_')" 2>/dev/null
done

# Our most distinctive prose lives in API ERROR replies, which nothing serves
# until you ask for something impossible. Without these probes the check reports
# a clean bill of health for a site that is carrying our exact wording — the
# false negative that matters most. Read-only: a bogus song id changes nothing.
for body in '{"fan":"provenance-probe","song":"__no_such_song__"}' \
            '{"fan":"provenance-probe","song":""}' \
            '{"fan":"","song":"x"}'; do
  curl -sL --max-time 20 -A "$UA" -X POST -H 'content-type: application/json' \
       -d "$body" "$BASE/api/vote" >> "$TMP/_probe" 2>/dev/null
  echo >> "$TMP/_probe"
done
curl -sL --max-time 20 -A "$UA" "$BASE/api/show?a=__no_such_artist__" >> "$TMP/_probe" 2>/dev/null

BLOB=$(cat "$TMP"/* 2>/dev/null)
echo "  ${#BLOB} bytes fetched (pages, assets, API, and error probes)"
echo

hits=0; total=0
look () { # label | pattern | weight
  total=$((total+1))
  if printf '%s' "$BLOB" | grep -qiF -- "$2"; then
    hits=$((hits+1)); printf "  \033[31m● HIT \033[0m %-34s %s\n" "$1" "$3"
  else
    printf "    ---  %-34s\n" "$1"
  fi
}

echo "PLANTED — arbitrary constants with no function (strongest)"
look "css var --ms-k"          '--ms-k:ms-k3f9qz'   "conclusive: no reason to exist"
look "api payload stamp"       'ms-k3f9qz'          "conclusive: our literal marker"

echo
echo "NATURAL — distinctive prose, always reachable from outside"
look "show-ended reply"        "The show has ended"       "moderate"
look "unknown-artist reply"    "unknown artist"           "weak: common wording"
look "unofficial lyrics label" "Unofficial lyrics"        "strong"

echo
echo "NATURAL — only reachable DURING A LIVE SHOW (run this again mid-gig)"
# vote.mjs refuses on status first, so these three are unreachable while the
# artist's show is ended. Measured 2026-09-01: probing an ended show returns
# "The show has ended" and never gets as far as the song check. A clean result
# here means nothing unless the suspect had a show running when you ran it.
look "vote refusal string"     "isn’t on tonight’s list"  "very strong (curly apostrophe)"
look "playing-now refusal"     "is playing right now"     "strong"
look "closed-voting string"    "Voting is closed right now" "strong"

echo
echo "SOURCE-ONLY — never served publicly; needs discovery or a leak"
look "fallback set wording"    "that’s what this gig says" "very strong, if you can see their code"

echo
echo "STRUCTURAL — our schema and storage choices"
look "fan id storage key"      "myset.fan"          "strong"
look "admin token key"         "myset.token"        "strong"
look "sw cache name"           "myset-runtime-v"    "strong"
look "12-way shard naming"     '"f0"'               "weak on its own"
look "singalong as a genre"    "singalong"          "moderate: a judgement call, not a real genre"
look "replay cost default"     "replayCost"         "moderate"

echo
echo "─────────────────────────────────────────────────────────────"
printf "  %d of %d markers present\n" "$hits" "$total"
if [ "$hits" -eq 0 ]; then
  echo "  No markers. Looks like an independent build — which is legal, and the"
  echo "  answer is to out-ship them, not to sue them."
elif [ "$hits" -le 2 ]; then
  echo "  Weak. Could be coincidence or a shared library. Not worth acting on alone."
else
  echo "  Strong. Save the fetched bytes and the date, then talk to a lawyer before"
  echo "  contacting them — a takedown you send yourself can weaken the claim."
fi
