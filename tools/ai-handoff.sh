#!/usr/bin/env bash
# ai-handoff.sh — safety wrapper for letting a non-Claude AI edit this repo.
#
#   ./tools/ai-handoff.sh start            mark a rollback point before any AI touches anything
#   ./tools/ai-handoff.sh bundle <scope>   build ONE paste-able file, secret-scanned
#   ./tools/ai-handoff.sh check            review what the AI actually changed
#   ./tools/ai-handoff.sh undo             throw away every AI change, back to the rollback point
#
# Scopes:  landing | landing+truth | home | fan | studio | css | list
#
# Nothing here commits, pushes or deploys. On purpose.

set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
OUT="$ROOT/tmp/ai-handoff"
TAGFILE="$ROOT/tmp/ai-handoff/.rollback"

red()  { printf '\033[31m%s\033[0m\n' "$*"; }
grn()  { printf '\033[32m%s\033[0m\n' "$*"; }
ylw()  { printf '\033[33m%s\033[0m\n' "$*"; }

scope_files() {
  case "${1:-}" in
    landing)        echo "public/about.html public/app.css" ;;
    landing+truth)  echo "public/about.html public/app.css docs/landing/APP-CATALOGUE.md docs/landing/DISCREPANCIES.md" ;;
    home)           echo "public/index.html public/app.css" ;;
    fan)            echo "public/vote.html public/app.css" ;;
    studio)         echo "public/studio.html public/app.css" ;;
    css)            echo "public/app.css" ;;
    *) return 1 ;;
  esac
}

# ---- secret scan -----------------------------------------------------------
# Runs over any file before it is allowed to leave this machine.
scan_secrets() {
  local target="$1" hits
  hits=$(grep -nEi \
    -e 'sk_(live|test)_[A-Za-z0-9]{10,}' \
    -e 'rk_(live|test)_[A-Za-z0-9]{10,}' \
    -e 'whsec_[A-Za-z0-9]{10,}' \
    -e 'AIza[0-9A-Za-z_-]{30,}' \
    -e 'gh[pousr]_[A-Za-z0-9]{20,}' \
    -e 'xox[baprs]-[A-Za-z0-9-]{10,}' \
    -e 'BEGIN [A-Z ]*PRIVATE KEY' \
    -e '(TOKEN|SECRET|PASSWORD|PASSCODE|API_KEY|PRIVATE_KEY|ADMIN_CODE)[A-Z_]*[[:space:]]*[:=][[:space:]]*.?[A-Za-z0-9/+_-]{16,}' \
    "$target" 2>/dev/null | head -20 || true)
  if [ -n "$hits" ]; then
    red "STOP — possible secret found. Do NOT paste or upload this file."
    echo "$hits" | cut -c1-160
    return 1
  fi
  return 0
}

case "${1:-help}" in

start)
  if [ -n "$(git status --porcelain)" ]; then
    ylw "Working tree is not clean. Uncommitted changes right now:"
    git status --short
    echo
    ylw "Commit or stash these FIRST, or the rollback point is meaningless."
    exit 1
  fi
  mkdir -p "$OUT"
  TAG="pre-ai-$(date +%Y%m%d-%H%M%S)"
  git tag "$TAG"
  echo "$TAG" > "$TAGFILE"
  grn "Rollback point set: $TAG  (commit $(git rev-parse --short HEAD))"
  echo "Whatever happens next, './tools/ai-handoff.sh undo' puts it all back."
  ;;

bundle)
  SCOPE="${2:-}"
  if [ "$SCOPE" = "list" ] || [ -z "$SCOPE" ]; then
    echo "Scopes:"
    for s in landing landing+truth home fan studio css; do
      printf '  %-14s ' "$s"
      # shellcheck disable=SC2046
      du -ck $(scope_files "$s") 2>/dev/null | tail -1 | awk '{print $1" KB"}'
    done
    exit 0
  fi
  FILES=$(scope_files "$SCOPE") || { red "Unknown scope: $SCOPE"; exit 1; }
  mkdir -p "$OUT"
  BUNDLE="$OUT/bundle-$SCOPE.txt"

  {
    cat GEMINI.md
    echo
    echo "================================================================"
    echo "THE FILES YOU MAY EDIT IN THIS TASK — nothing else exists for you."
    echo "================================================================"
    for f in $FILES; do
      [ -f "$f" ] || { red "missing: $f" >&2; exit 1; }
      echo
      echo "<file path=\"$f\">"
      cat "$f"
      echo "</file>"
    done
  } > "$BUNDLE"

  if ! scan_secrets "$BUNDLE"; then
    rm -f "$BUNDLE"
    exit 1
  fi
  KB=$(( $(wc -c < "$BUNDLE") / 1024 ))
  TOK=$(( $(wc -c < "$BUNDLE") / 4 ))
  grn "Bundle ready: $BUNDLE"
  echo "  ${KB} KB  ~${TOK} tokens  ($(echo "$FILES" | wc -w | tr -d ' ') files)"
  echo "  Secret scan: clean."
  ;;

check)
  echo "=== Files the AI changed ==="
  git status --short
  echo
  echo "=== Size of the change ==="
  git diff --stat
  echo
  ALLOWED='^public/(about|index|vote|studio|venue|venue-studio|artist|community|stage)\.html$|^public/app\.css$'
  BAD=$(git diff --name-only; git ls-files --others --exclude-standard)
  OFFENDERS=$(echo "$BAD" | grep -vE "$ALLOWED" | grep -v '^$' || true)
  if [ -n "$OFFENDERS" ]; then
    red "OUT OF BOUNDS — these were changed and should not have been:"
    echo "$OFFENDERS" | sed 's/^/    /'
    echo
    ylw "Look hard at these before you keep anything."
  else
    grn "In bounds: only page/style files were touched."
  fi
  echo
  echo "=== Secret scan of every changed file ==="
  CLEAN=1
  for f in $(git diff --name-only) $(git ls-files --others --exclude-standard); do
    [ -f "$f" ] || continue
    scan_secrets "$f" || CLEAN=0
  done
  [ "$CLEAN" = 1 ] && grn "No secrets in the changed files."
  echo
  echo "=== Suspicious additions (new network calls, new scripts, new storage) ==="
  SUS=$(git diff -U0 | grep -E '^\+' | grep -vE '^\+\+\+' | \
        grep -inE 'fetch\(|XMLHttpRequest|<script[^>]+src|import\(|eval\(|innerHTML *=|localStorage|document\.cookie|https?://' | \
        grep -viE 'https?://(myset\.vip|localhost|127\.0\.0\.1|www\.w3\.org)' \
        | head -25 || true)
  if [ -n "$SUS" ]; then
    ylw "Read every one of these lines yourself before keeping the change:"
    echo "$SUS" | cut -c1-170 | sed 's/^/    /'
  else
    grn "Nothing suspicious added."
  fi
  echo
  echo "=== Now look at it with your own eyes ==="
  echo "    python3 -m http.server 8899 --directory public"
  echo "    open http://localhost:8899/about.html"
  echo
  echo "Full diff:  git diff"
  ;;

undo)
  if [ ! -f "$TAGFILE" ]; then red "No rollback point. Run 'start' first next time."; exit 1; fi
  TAG=$(cat "$TAGFILE")
  ylw "This throws away EVERY uncommitted change and returns to $TAG."
  read -r -p "Type UNDO to confirm: " a
  [ "$a" = "UNDO" ] || { echo "Cancelled."; exit 1; }
  git reset --hard "$TAG"
  git clean -fd public
  grn "Back to $TAG. Nothing the AI did survives."
  ;;

*)
  sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
  ;;
esac
