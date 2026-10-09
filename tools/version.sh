#!/bin/sh
# WHAT PRODUCTION RUNS, SAID BY PRODUCTION (decision 0196). Netlify's build runs this
# ([build] command in netlify.toml) and writes public/version.json with the commit it
# is building, so https://myset.vip/version.json says which commit of main is live.
# Functions cannot know this at runtime (COMMIT_REF exists only during the build), and
# the outside watch needs it to see that a held build is owed. Also the honest way
# for a session to check "is my merge live" by content. Never fails the build.
out="${1:-public/version.json}"
printf '{"commit":"%s","branch":"%s","context":"%s","builtAt":"%s"}\n' \
  "${COMMIT_REF:-}" "${BRANCH:-}" "${CONTEXT:-}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$out" || true
cat "$out" 2>/dev/null || true
exit 0
