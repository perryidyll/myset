---
tab: Marketing & growth
section: The gig-to-content pipeline
puzzle_section_id: 42006
sources:
  - MySet_Master_Marketing_Strategy_v3.md §8.1 (design the payoff before you shoot), §8.2 (the shot list), §8.3 (the multiplier), §8.4 (batch production), §8.5 (asset taxonomy), §15.3 (the fallback ladder), §16 (never film a first-timer without a rehearsal)
  - docs/processes/community-and-media/02-a-clip-as-it-was-filmed.md (a fan's clip is a different thing — a post, not an asset)
status: loaded
loaded: 2026-09-12 (create_process; read back through list_sections — names, types, statuses, connections match)
verified: not yet — the founder's browser check of the tab is outstanding; the strategy is the source, not the code, so there is no code read to cite
---

# The gig-to-content pipeline

**Who:** the founder and whoever holds the second phone; the artist on stage. **Trigger:** a Founding 50 artist's gig is going to be filmed. **Outcome:** one gig produces a fortnight of material across every funnel job — ten to fourteen publishable assets, named so the automation engine can find them — instead of one mediocre Reel found by hunting through footage afterwards. *If you cannot name the question and the prediction beforehand, you are documenting, not experimenting.*

All **Draft** — no gig has been filmed to this list yet.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| p01 | Name the question and the prediction | video | Person | Founder R · Artist R | — | Before doors, written down: the one question this gig answers (*"will the crowd pick the songs I expect?"*), and the artist's prediction of the top three to five **recorded on camera** in the empty room (shot 1). This is ARTIST vs AUDIENCE part one and the Journey opener. `src: strategy §8.1 items 1–2, §8.2 #1` |
| p02 | Write the three hooks first | document | Person | Founder R | — | The titles of the three cuts are written before a frame is shot, each from a hook family (Content rules n04). The brief for the night comes from the automation engine (a03) when it is running; by hand until then. `src: strategy §8.1 item 3, §7.5` |
| p03 | Assign the moment | task | Person | Founder R · Artist team member R | — | The one moment that, if it happens, is the whole video — a lead change, the room singing, a request refused — and a named person whose only job is to catch it. `src: strategy §8.1 item 4` |
| p04 | Rehearsed? | conditional | Person | Founder R · Artist C | — | **Never film a first-time artist's gig without a dry run** (Founding 50 f04). A live failure caught on camera damages trust with a real artist; *nothing may break the gig* applies to the filming as much as to the software. *no* → do not film tonight; run the show unfilmed. `src: strategy §16 risk 4` |
| p05 | Shoot the shot list | video | Person | Artist team member R · Founder R | — | Sixteen moments, printed and handed to the second phone: pre-gig prediction; setlist build and QR placement sped up; empty venue wide; doors with real audio; **the first scan — a stranger's hands and phone, the single most important Convert shot**; votes arriving (unbroken Studio capture); the lead change; the artist seeing the winner; the song being played with the crowd singing; an unexpected request and the reaction; **a failure — the most trustworthy content owned**; the crowd singing, phone held high; end-of-night vote data; the sixty-second unedited reaction; fan vox pops; the venue manager. Twelve of sixteen is realistic and enough. `src: strategy §8.2` |
| p06 | Capture the Studio screen | video | Person | Founder R | Netlify | Shots 6, 7 and 13 are screen recordings of the Studio's Live tab and the past show — the scoreboard motif. Recorded on the founder's phone signed in as a team member (→ *Artist lifecycle → Sessions, roles and the team* t06), never on the artist's stage phone. `src: strategy §8.2 #6, #7, #13` |
| p07 | Cut the multiplier | task | Person | Founder R | — | From one covered gig: prediction video, reveal video, one or two singalong clips, the scan-to-vote demo, the Room Report card with voiceover, the artist reaction, the vox-pop cutdown, the failure or funny moment, a Stories set, a "what we learned" carousel, and half a YouTube long-form. **Ten to fourteen assets per filmed gig**; two filmed gigs a month covers about half of a seven-a-week cadence with proof content. Editing is the first thing to delegate (§15.2). `src: strategy §8.3, §15.2` |
| p08 | Name every asset | database | Person | Founder R | — | `YYYY-MM-DD_[BUCKET]_[JOB]_[FRANCHISE]_[SLUG]_[VERSION]` — bucket YPTS / RTR / CROWDLAB / CHAOS / LIBRARY, job ATTRACT / NURTURE / EXPERT / JOURNEY / CONVERT, a fixed franchise code or NONE, a kebab-case slug, a version with platform variants (v2-tt, v2-ig). Every file and every row in the `assets` table. Without this the engine's measure and learn stages cannot join anything. `src: strategy §8.5, §9.3 assets` |
| p09 | Studio batch, every second Monday | video | Person | Founder R | — | Three hours, one setup, eight to ten Attract and Expert pieces shot back to back. The other half of the cadence, the half that needs no gig. Ten assets are banked **before day one** (Cold start m07, Preflight). `src: strategy §8.4, §10.5 Phase 0` |
| p10 | Edit and schedule, every Sunday | task | Person | Founder R | — | Two to three hours: the week ahead scheduled, comments queued, hooks logged to the bank (Automation engine a08). Roughly eight to eleven hours a fortnight in total for seven a week; daily improvisation is not achievable. `src: strategy §8.4` |
| p11 | Week collapsing? | conditional | Person | Founder R | — | Minimum viable cadence: **three posts** — one Attract, one Position, one Story-only day. *Never zero. Never a burst of seven to catch up.* Degrade in this order and no other: drop Chaos Agent (Sunday), drop one Attract (Wednesday), drop LIBRARY to monthly. **Never drop** Thursday Convert, Saturday Journey, outbound DMs, Founding 50 onboarding — *the last group is the business; the rest is marketing.* `src: strategy §8.4, §15.3` |

## Connections

p01 → p02 → p03 → p04; p04 —rehearsed→ p05 → p06 → p07 → p08 → p10; p04 —not rehearsed→ *run the show unfilmed*; p09 → p08; p10 → p11; p11 —collapsing→ p09 (next batch); p08 → *The weekly rhythm* r01 (go_to).
