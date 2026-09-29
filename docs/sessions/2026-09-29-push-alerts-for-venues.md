# 2026-09-29 — Push alerts for venues

**Asked:** the founder, after venue pitches became conversations (0123): "please add push notifications for venues too".

**Shipped:** decision 0124, live as `db35911` (PR #169).

- A venue's phones hear a new ask to play, each artist reply in a pitch conversation, and each venue merch order. Venue Studio → Settings → Alerts switches it on per phone.
- `_push.mjs` is reused under `push_v_<vid>`, the owner id venue sign-ins already use, so venue sign-outs and removed seats end a phone's alerts with no new code. `notify()` reads the venue registry for owner ids starting `v_`; every venue seat hears a `{ tab }` alert.
- venueadmin `pushKey` / `pushOn` / `pushOff` (CREW_OK). `pushKey` takes the phone's endpoint and answers `mine`, because one browser holds one subscription for both Studios.
- The Venue Studio reads `?tab=`, so an ask opens What's on and an order opens Merch.

**Verified:** `test/venuepush.mjs` 19 ✓; `sh test/run.sh` exit 0, 5,008 ✓; headless Chrome at 390 px against `tools/localhost.mjs` (card off → Turn on → Alerts are on, with a real Chrome subscription; `?tab=shows` lands); deploy preview and production by content (`venue-studio.js?v=9f565ed2` carries `toggleVPush`).

**Not checked:** a real phone, or a real alert arriving on one.

**Known edges (in 0124):** a phone running both Studios shares one subscription; the service worker focuses an open `/studio` window on any alert tap (sw.js untouched by rule).
