# 2026-09-30 — A tapped alert lands in its own app

**Asked:** after push alerts for venues went live (decision 0124), the founder asked to fix where a tap lands, and gave the word on `sw.js`.

**The fault:** `sw.js`'s notificationclick focused any open `/studio` window, whatever the alert was for. On a phone with both Studios open, a venue alert brought up the artist Studio; HQ (`/crm`) and factory (`/factory`) alerts did the same.

**Changed (decision 0125):** the worker now focuses an open window whose first path segment matches the alert's address, and otherwise opens the address. The cache rules, the cache name and the fetch handler are untouched. INVARIANT 0ha gains one sentence.

**Verified:** `test/sw.mjs` +6 checks against the real worker (three fail on the old one); `sh test/run.sh` exit 0.

**Not checked:** a real phone. An app that is already open is focused on the tab it was showing, not the alert's tab (unchanged for artists; the record says what would change it).
