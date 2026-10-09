#!/bin/sh
# NO DEPLOY LANDS ON A LIVE ROOM (decision 0196).
#
# Netlify runs this before every build it starts from a git push ([build] ignore in
# netlify.toml). Exit 0 means "do not build now" and Netlify cancels the build; exit 1
# means build. Only production is ever held: deploy previews and branch deploys always
# build, because looking at them changes nothing on myset.vip.
#
# A held build is not lost. The outside watch (.github/workflows/watch.yml, every five
# minutes) sees that production is behind main and no show is live, and starts a build
# through the site's build hook, which Netlify runs without asking here again.
#
# Can't ask, or not sure: hold. A room mid-show is worth more than a deploy a few
# minutes sooner. The release valve for a real emergency during a show is the Netlify
# variable HOLD_DEPLOYS=off (netlify env:set HOLD_DEPLOYS off), or the watch's
# "release now" button (workflow_dispatch with release=yes).
[ "${CONTEXT:-}" = "production" ] || { echo "hold: $CONTEXT build, never held"; exit 1; }
[ "${HOLD_DEPLOYS:-on}" != "off" ] || { echo "hold: HOLD_DEPLOYS is off; building"; exit 1; }
ans=$(curl -sS -m 20 -w '\n%{http_code}' 'https://myset.vip/api/live' 2>/dev/null) \
  || { echo "hold: could not ask myset.vip who is live; holding (the watch releases this build)"; exit 0; }
code=$(printf '%s\n' "$ans" | tail -n 1)
body=$(printf '%s\n' "$ans" | sed '$d')
[ "$code" = "200" ] || { echo "hold: /api/live answered $code; holding"; exit 0; }
live=$(printf '%s' "$body" | sed -n 's/.*"live":\([0-9][0-9]*\).*/\1/p')
case "$body" in *'"sure":true'*) sure=yes;; *) sure=no;; esac
if [ "$live" = "0" ] && [ "$sure" = "yes" ]; then echo "hold: no show is live; building"; exit 1; fi
echo "hold: live=${live:-?} sure=$sure — this build waits until the room empties"
exit 0
