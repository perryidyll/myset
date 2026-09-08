#!/usr/bin/env bash
# Install the MySet git hooks. Run once per clone.
#
#   ./tools/hooks/install.sh          install
#   ./tools/hooks/install.sh --check  say whether they are installed and current
#   ./tools/hooks/install.sh --remove take them off again
#
# Git hooks live in .git/hooks/, which is NOT versioned — so the copies in this
# folder are the source of truth and this script copies them across. If a hook in
# .git/hooks/ ever differs from the one here, the one here wins.

set -euo pipefail
cd "$(dirname "$0")/../.."
SRC="tools/hooks"
DST="$(git rev-parse --git-path hooks)"
HOOKS="pre-commit post-commit"

case "${1:-install}" in
  --check)
    ok=1
    for h in $HOOKS; do
      if [ ! -x "$DST/$h" ]; then echo "missing:  $h"; ok=0
      elif ! cmp -s "$SRC/$h" "$DST/$h"; then echo "outdated: $h"; ok=0
      else echo "current:  $h"; fi
    done
    [ "$ok" = 1 ] || { echo; echo "run: ./tools/hooks/install.sh"; exit 1; }
    ;;
  --remove)
    for h in $HOOKS; do rm -f "$DST/$h"; done
    echo "Hooks removed. The overview will now only update when you run it yourself."
    ;;
  *)
    mkdir -p "$DST"
    for h in $HOOKS; do
      if [ -e "$DST/$h" ] && ! cmp -s "$SRC/$h" "$DST/$h"; then
        cp "$DST/$h" "$DST/$h.backup-$(date +%Y%m%d-%H%M%S)"
        echo "kept your old $h as $h.backup-*"
      fi
      cp "$SRC/$h" "$DST/$h"
      chmod +x "$DST/$h"
    done
    echo "Installed: $HOOKS"
    echo
    echo "From now on, every commit refreshes MYSET-MASTER-OVERVIEW.md from the code,"
    echo "and any server change with no decision record is listed in"
    echo "docs/decisions/PENDING.md so it can be written up later."
    ;;
esac
