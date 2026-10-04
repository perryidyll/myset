# 2026-10-04 — Generator uploads, suggested songs, and a cover every time

**Asked:**
- Upload photos in CRM's Generate form, for artists and venues.
- Fill a sample artist's songs with 20 suggestions behind a ticked-by-default box.
- Then, after Jay's page came out without a cover: make sure that never happens again.
- Put popular Thai songs at the top of his list.
- Open a sample in a new tab, not a pop-up.

**Shipped:**
- 0166 and 0167, live as `b086a33` (#241).
- 0168 (this branch):
  - `coverChoices` falls back to the best sharp shot of the act;
  - the cover review always picks one;
  - with no genre in the facts, the songs lead with the place's country;
  - `openTab` in CRM and the old factory screen;
  - "your public public pages" is fixed.
- Decision records 0163–0167 got their commits.

**Why Jay had no cover:** an artist's cover had to be 1000 px wide and 1.2 times wider than tall. His five uploads were square or tall phone photos, so none passed. The cover review was skipped too, because it had nothing to compare.

**Verified:** `test/factory.mjs` replays Jay's five judged photos and gets a cover (the beach shot), a portrait and two small photos. Full suite.

**Not checked:** a real paid build's song picks, beyond Jay's rebuild.
