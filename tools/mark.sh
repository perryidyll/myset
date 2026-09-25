#!/bin/sh
# mark.sh — one bandwidth mark for the money model, from any folder, no git needed.
#
#   ~/Docs/MySet/tools/mark.sh before "Seaflower"        about two hours before the gig
#   ~/Docs/MySet/tools/mark.sh start  "Seaflower"        just before it starts
#   ~/Docs/MySet/tools/mark.sh after  "Seaflower" 40     right after it ends — 40 = minutes the
#                                                        Studio's Live tab was on screen (leave it off if unsure)
#
# Three marks make a night (decision 0089): the first two are the quiet pair — the background of
# that very day — and the third closes the bracket. Nothing else should be touching the site
# between the marks: no Claude session working on MySet, no tests, no page probes. A phone in
# a pocket is fine. Each mark reads Netlify's account-wide bandwidth counter (a few bytes) and
# writes it to ~/.myset-marks.json — outside git, so nothing here can collide with anybody's
# checkout; the tracker (tools/actuals.py) reads that file alongside finance/marks.json and
# folds it in the next time it writes. The tracker itself is taken fresh from origin/main each
# time, so this works from an old checkout too.
set -e
KIND="$1"; LABEL="${2:-gig}"; MIN="$3"
REPO="$HOME/Docs/MySet"
[ -d "$REPO/.git" ] || { echo "mark.sh: no MySet checkout at $REPO" >&2; exit 2; }
git -C "$REPO" fetch -q origin 2>/dev/null || true
DIR="$(mktemp -d)"; TRK="$DIR/actuals.py"
git -C "$REPO" show origin/main:tools/actuals.py > "$TRK"
export MYSET_SITE_DIR="$REPO" MYSET_MARKS_FILE="${MYSET_MARKS_FILE:-$HOME/.myset-marks.json}" PATH="$HOME/.local/node/bin:$PATH"
STAMP="$(TZ=Asia/Bangkok date '+%a %d %b %H:%M') Bangkok"
case "$KIND" in
  before) python3 "$TRK" --mark "before — $LABEL — $STAMP, about two hours out" ;;
  start)  python3 "$TRK" --mark "start — $LABEL — $STAMP, just before the gig" ;;
  after)  if [ -n "$MIN" ]; then python3 "$TRK" --mark "after — $LABEL — $STAMP" --studio-min "$MIN" --clip-views 0
          else python3 "$TRK" --mark "after — $LABEL — $STAMP" --clip-views 0; fi ;;
  *) echo 'usage: mark.sh before|start|after "venue" [minutes the Studio Live tab was on screen]' >&2; exit 2 ;;
esac
rm -rf "$DIR"
