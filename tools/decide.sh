#!/usr/bin/env bash
# decide.sh — start a new decision record.
#
#   ./tools/decide.sh "a vote never comes back"
#   ./tools/decide.sh "clips move to R2" media proposed
#
# Picks the next number, makes the file from the template, fills in the date and
# title, and prints the path. It does not commit anything.

set -euo pipefail
cd "$(dirname "$0")/.."

TITLE="${1:-}"
AREA="${2:-general}"
STATUS="${3:-decided}"
WHO="${4:-}"

if [ -z "$TITLE" ]; then
  echo "usage: ./tools/decide.sh \"what is now true\" [area] [status] [decided_by]"
  echo
  echo "areas:      voting plans money storage auth media scale ops ui docs general"
  echo "status:     proposed | decided | superseded | reversed"
  echo "decided_by: perry | claude | perry-confirmed   (left blank to fill in yourself)"
  exit 1
fi

DIR="docs/decisions"
LAST=$(ls "$DIR" 2>/dev/null | grep -E '^[0-9]{4}-' | sed 's/-.*//' | sort -n | tail -1 || true)
NEXT=$(printf '%04d' $(( 10#${LAST:-0} + 1 )))
SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' | cut -c1-50 | sed -E 's/-+$//')
FILE="$DIR/$NEXT-$SLUG.md"

if [ -e "$FILE" ]; then echo "already exists: $FILE"; exit 1; fi

sed -e "s/^id: 0000/id: $NEXT/" \
    -e "s/^title: .*/title: $TITLE/" \
    -e "s/^date: YYYY-MM-DD/date: $(date +%Y-%m-%d)/" \
    -e "s/^area: voting/area: $AREA/" \
    -e "s/^status: decided/status: $STATUS/" \
    -e "s/^decided_by: perry/decided_by: $WHO/" \
    "$DIR/TEMPLATE.md" > "$FILE"

echo "$FILE"
echo
echo "Fill it in, then run:  node tools/overview.mjs"
