#!/bin/sh
# pushlog.sh — tell every other session what this push did, in three lines.
#
#   ./tools/pushlog.sh "tl;dr for a person" ["what another session must know"]
#
# Prepends an entry to docs/PUSH-LOG.md and commits it, so the entry travels in the
# same push as the work. The pre-push hook refuses a push whose commits do not
# touch the log, so this is the last step before `git push`, every time. Run it
# from any worktree; it names the worktree and branch so readers know who spoke.
#
# The first line is for the founder and for the next session's first minute: what
# changed for a PERSON. The second is for other sessions: a new helper, a changed
# URL, a header every function now carries, an invariant, a thing NOT to redo.
set -e
[ -n "$1" ] || { echo "usage: tools/pushlog.sh \"tl;dr\" [\"note for other sessions\"]" >&2; exit 2; }
cd "$(git rev-parse --show-toplevel)"
LOG=docs/PUSH-LOG.md
[ -f "$LOG" ] || { echo "no $LOG here" >&2; exit 2; }
HASH=$(git rev-parse --short HEAD)
WHEN=$(date '+%Y-%m-%d %H:%M')
WHO=$(basename "$(git rev-parse --show-toplevel)")@$(git rev-parse --abbrev-ref HEAD)
FILES=$(git diff --name-only "origin/main..HEAD" 2>/dev/null | wc -l | tr -d ' ')
ENTRY="### $WHEN — $HASH — $WHO ($FILES files since origin/main)
**tl;dr:** $1
${2:+**Other sessions:** $2
}"
# keep the header, put the new entry first
awk -v e="$ENTRY" 'BEGIN{done=0} /^### /&&!done{print e; done=1} {print} END{if(!done)print e}' "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
git add "$LOG"
git commit -q -m "Push log: $1"
echo "logged as $(git rev-parse --short HEAD) — now: git push"
