---
tab: Marketing & growth
section: The cold start — outbound and the scenes
puzzle_section_id: 42004
sources:
  - MySet_Master_Marketing_Strategy_v3.md §10.1 (the sequencing correction), §10.2 (the outbound motion), §10.3 (Scene Zero), §10.4 (Scene One and the Crowd-Controlled Weekend), §10.5 (the ninety-day phase map), §5.5 (the venue offer, held), §16 (risk register)
  - docs/processes/PUZZLE-MAPPING-PLAN.md row 8 — "business processes exist as strategy, not as procedure"
  - IMPLEMENTATION_STATUS.md DOC-010
status: loaded
loaded: 2026-09-12 (create_process; read back through list_sections — names, types, statuses, connections match)
verified: not yet — the founder's browser check of the tab is outstanding; the strategy is the source, not the code, so there is no code read to cite
---

# The cold start — outbound and the scenes

**Who:** the founder, alone. **Trigger:** there are no artists yet, so there are no gigs, so there is no footage, so there is no proof content — the loop has to be started by hand at the artist end. **Outcome:** a lead list, a daily DM cadence, ten Scene Zero artists running real gigs, one Scene One market chosen by criteria, and the Crowd-Controlled Weekend at the end of the first quarter. *Weeks one to four are an outbound recruitment sprint with a content layer, not a content launch with an outbound layer.*

Everything here is **Draft**: the strategy is written, the programme has not started (Appendix C "before day one" is unchecked). A step goes `Live` the week it is actually being done.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| m01 | Start at the artist end | task | Person | Founder R | — | The order is fixed: **artists → gigs → footage + data → content → more artists.** A content calendar first is the wrong first move because the calendar depends on gigs that do not exist. Outbound is priority one; content is the layer on top. `src: strategy §10.1, §16 (no artists recruited = critical)` |
| m02 | Build the lead list | research | Person | Founder R | — | Named artists with handles and venues, sourced free and in public: Instagram location tags for bars in the target scene; the gigging-musician hashtags and their local variants; venue accounts, then the artists they tag; Facebook Groups for gigging and function musicians (participate, never link-drop); local "live music tonight" listings; and physically — walk in, watch a set, talk between sets. Anti-ICP (strategy §4.2) is excluded at this step, not later. Target size is in §10.5 Phase 0. `src: strategy §10.2 lead sourcing, §4.2, §6.1 Facebook Groups` |
| m03 | Send the DM, written to be answered | chat | Person | Founder R · Artist I | — | Ten personalised DMs a day, five days a week. Each one references an actual post ("saw your set at [venue] — the [song] clip"), leads with the offer not the product, and removes the effort explicitly: *"I'll import your whole songlist myself so you don't have to do anything. Want me to set yours up for this weekend?"* Specific, never templated. The full text is the DM in §10.2. **Never automated** — replies to real artists are the relationship (§9.7). `src: strategy §10.2 the DM and cadence, §9.7` |
| m04 | Did they answer? | conditional | Person | Founder R | — | A conversation is the unit that is counted (§10.2 target ladder: conversations → signups → first gigs → repeat gigs). *yes* → the Founding 50 offer, next section. *no* → the next lead; a silent lead is not chased more than once. Log the outcome in the `artists` table either way (Automation engine a09). `src: strategy §10.2 target, §9.3 artists` |
| m05 | Walk into venues — Scene Zero | task | Person | Founder R · Venue manager I | — | The founder is physically in a dense live-music market: high venue density, many working cover performers, transient English-speaking crowds, low gatekeeping, short distances. Walking into venues is faster than any funnel. **Use it as a proof and footage laboratory**: film real gigs quickly and repeatedly, test the onboarding flow in person, recruit the first ten to fifteen Founding artists, build the whole visual asset library. `src: strategy §10.3` |
| m06 | Do not read Scene Zero as a market signal | task | Person | Founder R | — | The same properties that make it a good lab make it a bad signal: transient audience, different venue economics. **Never** use Scene Zero to conclude the product works everywhere, to validate pricing, to draw venue-economics conclusions, or as the Live Music Index dataset. Scene One (m08) is what validates. `src: strategy §10.3 table, §16 (results do not transfer)` |
| m07 | Check the phase gate | conditional | Person | Founder R | — | The ninety days run in four phases, each with a success gate — Preflight (accounts, franchises defined, watchlist, Founding 50 page, concierge import process written, lead list, ten assets banked, nothing published), Ignition, Proof, Amplify. The gates are in §10.5; they are **targets to steer by, not promises**, and are re-set after two weeks of real conversion data. *gate met* → next phase. *not met* → stay, and look at the artist pipeline before touching content. `src: strategy §10.5, Appendix C` |
| m08 | Choose Scene One by criteria, not affinity | task | Person | Founder R | — | One Western market, scored on: density of cover and function gigs, an existing online gigging-musician community, English, a venue culture where the performer chooses the set, reachability by DM, eventual venue-side potential (weights in §10.4). Candidates are listed there. **Pick one. Do not pick three.** `src: strategy §10.4` |
| m09 | Run the Crowd-Controlled Weekend | task | Person | Founder R · Artist C · Venue manager C | — | The Scene One lightning strike: five artists, five venues, one weekend, every room voting, everything filmed to the shot list (Gig-to-content pipeline p05), published for a month afterwards. It is growth, content, PR, product research and sales at once, and the moment category creation becomes visible from outside. It belongs at the **end of the first quarter** (about day seventy-five to ninety), not in a later phase. Needs density — which is why Scene One is chosen first. `src: strategy §10.4, §7.7 #11 CROWD CONTROL` |
| m10 | Hold the venue offer | delay | Person | Founder R · Venue manager I | — | *"Give us one Friday. We will put five MySet artists in five venues in one weekend and publish everything."* Written now, **not used** until Scene One exists — venue content is not built before then. The venue side of the product (claiming, verifying, pitches) is already live: → *Venue lifecycle*. `src: strategy §5.5, §6.1 LinkedIn "later"` |

## Connections

m01 → m02 → m03 → m04; m04 —yes→ *Recruiting the Founding 50* f01 (go_to); m04 —no→ m02; m01 → m05 → m06; m05 → m07; m07 —gate met→ m08 → m09; m07 —not met→ m02; m09 → m10.
