#!/bin/sh
# The whole suite. Run it before every deploy.
#
# Both files run the REAL handlers against an in-memory blob store that
# implements etags (test/blobs-fake.mjs), injected by a module-resolution hook.
# Nothing touches production, and no dev server is needed.
#
# Why the fake store exists at all: `netlify dev --offline` runs Blobs in sandbox
# mode, which returns no etag. casDoc's conditional write then always uses
# `onlyIfNew`, so every write after the first fails and the second API call in any
# test returns "busy". The fake is the smallest thing that makes the real code
# behave the way production does.
set -e
cd "$(dirname "$0")/.."
echo "── syntax ──"
node --import ./test/register.mjs test/syntax.mjs
echo
echo "── structure ──"
node test/structure.mjs
echo
echo "── what the public reads ──"
node test/copy.mjs
echo
echo "── unit ──"
node test/unit.mjs
echo
echo "── end to end ──"
node --import ./test/register.mjs test/e2e.mjs
echo
echo "── cross-tenant isolation ──"
node --import ./test/register.mjs test/tenancy.mjs
echo
echo "── the paid-vote ledger ──"
node --import ./test/register.mjs test/credits.mjs
echo
echo "── web push (RFC 8291 vector) ──"
node --import ./test/register.mjs test/push.mjs
echo
echo "── the 2026-09-02 audit fixes ──"
node --import ./test/register.mjs test/audit-0902.mjs
echo
echo "── the studio-code door ──"
node --import ./test/register.mjs test/studiocode.mjs
echo
echo "── the verification tick ──"
node --import ./test/register.mjs test/verification.mjs
echo
echo "── the vote sheet and its flag ──"
node --import ./test/register.mjs test/voting-sheet.mjs
echo
echo "── vote finality and the cast id ──"
node --import ./test/register.mjs test/finality.mjs
echo
echo "── stripe connect, direct charges ──"
node --import ./test/register.mjs test/connect.mjs
echo
echo "── the feedback prompt ──"
node --import ./test/register.mjs test/feedback.mjs
echo
echo "── a payment taken is a payment delivered ──"
node --import ./test/register.mjs test/delivery.mjs
echo
echo "── what an endpoint costs ──"
node --import ./test/register.mjs test/cost.mjs
echo
echo "── the free plan's limits ──"
node --import ./test/register.mjs test/limits.mjs
echo
echo "── verifying an artist automatically ──"
node --import ./test/register.mjs test/autoverify.mjs
echo
echo "── the google sheet ──"
node --import ./test/register.mjs test/sheets.mjs
echo
echo "── shows that start and end themselves ──"
node --import ./test/register.mjs test/autoshow.mjs
echo
echo "── the community page and the shop ──"
node --import ./test/register.mjs test/community.mjs
echo
echo "── the account system ──"
node --import ./test/register.mjs test/accounts.mjs
echo
echo "── billing, the account, and a venue that takes money ──"
node --import ./test/register.mjs test/billing.mjs
