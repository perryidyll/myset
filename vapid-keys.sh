#!/usr/bin/env bash
# Generate the two keys Web Push needs, and print them for YOU to paste into
# Netlify. Run it yourself:
#
#   ./vapid-keys.sh
#
# The private key must never be pasted into a chat window, committed, or sent to
# anyone — including me. If it ever appears somewhere it shouldn't, generate a new
# pair and replace both env vars; the only cost is that everyone re-subscribes.
set -euo pipefail
cd "$(dirname "$0")"
node -e "
import('./netlify/functions/_push.mjs').then(m => {
  const k = m.generateVapidKeys();
  console.log('');
  console.log('Set these three in Netlify -> Site configuration -> Environment variables,');
  console.log('for the PRODUCTION context only:');
  console.log('');
  console.log('  VAPID_PUBLIC_KEY   ' + k.publicKey);
  console.log('  VAPID_PRIVATE_KEY  ' + k.privateKey);
  console.log('  VAPID_SUBJECT      mailto:hello@myset.vip');
  console.log('');
  console.log('The public key is safe to share — it is sent to every browser.');
  console.log('The private key is not. Close this terminal when you are done.');
  console.log('');
});
"
