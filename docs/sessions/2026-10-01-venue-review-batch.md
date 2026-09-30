# 2026-09-30 → 10-01 — the founder's review of the first auto-generated venue page

**Asked.** After generating a page for Sand & Tan (a venue the founder plays every Sunday), the founder reviewed it and the Venue Studio and asked for eleven changes: the next three shows with the rest behind *See more*; links that drift like an artist page's; photos leading the page like an artist profile, the generator filling every slot, five photos on Free; "because" off tip card 2; venues approve or deny the shows artists list at their place, a recurring show approved once and clearly as recurring; hiding and deleting posts Pro-only; the venue fee 25% Free / 5% Pro; the Pro card as "Everything in Free, plus"; staff tips visible and real (the Pro card said "coming soon, included"); a Suggestions & feedback button; no sample testimonials. Also: the CRM showed Sand & Tan twice.

**Shipped.** Decisions 0126–0129, one PR (#177, which carried #175), live as `9fde2c7` on the founder's "merge and ship it" (2026-10-01).

- 0126: the twin was a CRM poll adopting the factory's page before the factory linked its contact; registry rows now carry the contact's id, and `dropTwins` erases an untouched twin on the next CRM load.
- 0127: venue plan table (photos 5/12, fee .25/.05, tips on both plans, moderation Pro), staff tips through `pay.mjs ?v=` with `kind:'tip'`, the Studio's tips section, suggestions (`_suggest.mjs`, Sheet tab 13).
- 0128: `gigok_<vid>` answers per artist calendar rule; a recurring rule needs `recurring:true`; a denied show leaves the venue's page only; a new listing pushes the venue's phones.
- 0129: venue.html photos-first cluster, lightbox, next three + See more, drifting links; the generator fills p0–p4.

**Call made in the build.** Staff tips on both plans, so the 25% Free fee applies to something real; flagged to the founder before merging, merged on the founder's word.

**Broke / caught.** Merging main into the branch conflicted only in the push log. After merging, the dash record from #178 was found numbered 0127 too (it did not claim on the sessions board); it moved to 0130.

**Verified.** Suite 5,076 ✓ / 0 ✗ on the merged tree; walked at 375 px on `tools/localhost.mjs`; production by content (`/venue.html`, `/venue-studio.js`). **Not checked:** a real card tip on production; Sand & Tan regenerated with five photos (needs Rebuild in CRM); push alerts on a real phone.
