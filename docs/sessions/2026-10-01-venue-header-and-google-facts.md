# 2026-10-01 — a venue page's header, and its Google facts

**Asked.** After the venue review batch, the founder asked for the venue page's header to look finished (a cover every time, the doors beside the square, the links under the tagline), then for Sand & Tan's sample to arrive with its hours, its menu and its Google rating already on it, with the rating dated "so it doesn't pretend to be live", and with no hand-typing.

**Shipped.** Decisions 0131 and 0134, one PR (#182), live as `db02acf` on the founder's "merge" (2026-10-01).

- 0131: venue.html header: the best wide photo becomes the cover when there is none; four doors (Menu among them) beside the 112-px square; links under the tagline. The generator looks for a menu link on the venue's own site.
- 0134: `humanHours` reads hours as a person writes them and hands them to `parseHours`; the venue profile carries `rating {stars,count,at}`; venue.html draws the rating pill ("as of Mon YYYY", linking to `links.google` or a Google search); CRM's Edit profile gains Details (hours, menu link, rating). A sample with no hours found is now shut every day instead of showing the 17:00–01:00 template.

**Call made in the build.** The server never reads Google (decision 0103 stands). An agent reads the public listing in the founder's own browser, on request, and saves through CRM. Google's split lunch and dinner hours are left out: the page shows one opening per day.

**Filled.** Sand & Tan from its Google Maps listing: daily 8 AM–10 PM, the anyflip menu link, 4.5 stars from 1,079 reviews, and the listing's Maps link as `links.google`. Saved through the `edit` action from the unlocked CRM; the response read every value back.

**Broke / caught.** The hours reader first missed "Sat, Sun 12pm…" and "Every day 08:00…" (a time must start with a digit now). The rating's ↗ wrapped at 375 px; it went, and the date sits on its own line on purpose. Decision 0132 was already taken by another session; this one became 0134.

**Verified.** Suite 5,105 ✓ after merging main at 02a8aae; localhost at 375 and 320 px; CRM Details on localhost; the #182 preview and production by content (`function ratingHtml` on `/venue.html`, `function detailsHtml` on `/crm`). **Not checked:** Sand & Tan's page itself (opens are counted); a Rebuild of Sand & Tan for the generator's cover and menu changes (not run, since a rebuild can replace words edited in CRM).
