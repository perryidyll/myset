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
echo "── trimming an mp4 without re-encoding it ──"
node test/trim.mjs
echo
echo "── the service worker's rules ──"
node test/sw.mjs
echo
echo "── the printed QR codes ──"
node test/qr.mjs
echo
echo "── how big a room can get ──"
node --import ./test/register.mjs test/roomsize.mjs
echo
echo "── cross-tenant isolation ──"
node --import ./test/register.mjs test/tenancy.mjs
echo
echo "── voting defaults and legacy rooms ──"
node --import ./test/register.mjs test/defaults.mjs
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
echo "── sample profiles: the private page, the look-only Studio, the claim, the clock (0101) ──"
node --import ./test/register.mjs test/samples.mjs
echo
echo "── the tip decks, the practice round and the sample page's words (0101, 0102) ──"
node test/tipdecks.mjs
echo
echo "── the sample factory: sources, Claude, the gate, the worker and the ring (0103) ──"
node --import ./test/register.mjs test/factory.mjs
echo
echo "── MySet CRM: the contacts, their stage, outreach logged, Delete forever, Edit profile (0108) ──"
node --import ./test/register.mjs test/hq.mjs
echo
echo "── CRM's Gmail: the OAuth door, the sealed tokens, a sent email, a reply read back (0109) ──"
node --import ./test/register.mjs test/gmail.mjs
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
echo "── a vote stays on its song ──"
node --import ./test/register.mjs test/votesstay.mjs
echo
echo "── vote finality and the cast id ──"
node --import ./test/register.mjs test/finality.mjs
echo
echo "── paid-vote attribution and artist decline/refund ──"
node --import ./test/register.mjs test/decline.mjs
echo
echo "── stripe connect, direct charges ──"
node --import ./test/register.mjs test/connect.mjs
echo
echo "── the webhook's two signing secrets (real stripe library) ──"
node test/twosecrets.mjs
echo
echo "── paid replay votes and held request payments ──"
node --import ./test/register.mjs test/request-payments.mjs
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
echo "── the shared-board split ──"
node --import ./test/register.mjs test/split.mjs
echo
echo "── the one warm door ──"
node --import ./test/register.mjs test/fandoor.mjs
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
echo "── where a night happened ──"
node --import ./test/register.mjs test/place.mjs
echo
echo "── naming a night by hand ──"
node --import ./test/register.mjs test/histname.mjs
echo
echo "── a tip after the show is still that night's money ──"
node --import ./test/register.mjs test/latetips.mjs
echo
echo "── the first gig: the sign, the count, the morning-after note ──"
node --import ./test/register.mjs test/firstgig.mjs
echo
echo "── a dark room, and the last call ──"
node --import ./test/register.mjs test/darkroom.mjs
echo
echo "── the community page and the shop ──"
node --import ./test/register.mjs test/community.mjs
echo
echo "── clips on a community post ──"
node --import ./test/register.mjs test/clips.mjs
echo
echo "── the account system ──"
node --import ./test/register.mjs test/accounts.mjs
echo
echo "── sign-in email delivery ──"
node --import ./test/register.mjs test/email.mjs
echo
echo "── featured shows ──"
node --import ./test/register.mjs test/featured.mjs
echo
echo "── who says they are coming ──"
node --import ./test/register.mjs test/rsvp.mjs
echo
echo "── the artist directory ──"
node --import ./test/register.mjs test/artists.mjs
echo
echo "── passkeys ──"
node --import ./test/register.mjs test/passkeys.mjs
echo
echo "── the books ──"
node --import ./test/register.mjs test/books.mjs
echo
echo "── the artist's book ──"
node --import ./test/register.mjs test/biz.mjs
echo
echo "── the dashboard's maths ──"
node test/bizmath.mjs
echo
echo "── billing, the account, and a venue that takes money ──"
node --import ./test/register.mjs test/billing.mjs
echo
echo "── the rate limit on casting, and what broke kept past the night ──"
node --import ./test/register.mjs test/errlog.mjs
echo
echo "── the data foundations: the event log, versions, archives, the second home ──"
node --import ./test/register.mjs test/foundations.mjs
echo
echo "── email + password, the standard door ──"
node --import ./test/register.mjs test/password.mjs
echo
echo "── current show stats: the snapshot ──"
node --import ./test/register.mjs test/metrics.mjs
echo
echo "── every show on the platform: the register, the dashboard, the live feed ──"
node --import ./test/register.mjs test/everyshow.mjs
echo
echo "── Stripe's own fee on every night (EVS-005) ──"
node --import ./test/register.mjs test/stripefees.mjs
echo
echo "── the Book button, the inbox and the tour poster ──"
node --import ./test/register.mjs test/messages.mjs
echo
echo "── a venue you asked is a conversation (0123) ──"
node --import ./test/register.mjs test/pitchmsgs.mjs
echo
echo "── a venue's phone hears it (0124) ──"
node --import ./test/register.mjs test/venuepush.mjs
echo
echo "── the artist diary ──"
node --import ./test/register.mjs test/diaries.mjs
echo
echo "── a merch order tells its owner; the Studio says what is waiting (0097) ──"
node --import ./test/register.mjs test/ordernote.mjs
echo
echo "── the artist on their own share card (0097) ──"
node --import ./test/register.mjs test/sharecard.mjs
echo
echo "── the founder's tools need the founder's owner seat: Media Dash and the Studio (0100) ──"
node --import ./test/register.mjs test/founderseat.mjs
echo
echo "── each seat, each tab: what the Studio draws for a band mate or crew seat (0105) ──"
node test/seatstudio.mjs
echo
echo "── push alerts per seat: who hears what, and a sign-out ends them (0114) ──"
node --import ./test/register.mjs test/pushseats.mjs
