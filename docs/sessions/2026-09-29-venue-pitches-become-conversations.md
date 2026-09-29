# 2026-09-29 — Venue pitches become conversations in Messages (decision 0123)

**Asked:** after the tip-deck pass, the founder said yes to moving "ask a venue for a spot" into Messages, "the simplest way you think makes the most sense", and to ship it.

**Built:**
- A pitch opens a conversation in the artist's own inbox (`msg_<aid>_<tid>`, folder `venues`, kind `pitch`). The artist's words are its first line.
- The pitch row carries `tid`, and `vunread` for "the artist answered".
- **Venue Studio:** each pitch row has a Reply button that opens the conversation in a sheet (`pitchThread`, `pitchReply`). Keen and ✕ each drop one line into it.
- **Artist Studio:**
  - Messages has a Venues folder, and each venue thread has a "Their page" link and a status chip. Block is hidden there and refused by the server.
  - The Gigs tab's "Venues you've asked" rows open the thread.
  - `?tab=messages&f=venues` lands in the Venues folder.
- **Venue page:** the card links to the conversation, and "Change my message" is gone.
- **Messages tip deck:** a third card about the Venues folder.
- A pitch from before 0123 gets its conversation the first time the venue answers.

**Found while looking:**
- The venue's sheet was titled with the venue's own name. It now uses the pitch's artist name, and there is a test for it.
- The venue's pitch row was cramped with Page + Reply + Keen + ✕. The artist's name is now the page link.
- "Write back to The" became the whole name, for venues and for bands.

**Verified:**
- `test/pitchmsgs.mjs`: 27 ✓.
- `sh test/run.sh` exit 0, 4,989 ✓.
- Headless Chrome at 390 px against `tools/localhost.mjs`:
  - the Venues folder and the thread;
  - the Gigs button landing on the thread;
  - the Venue Studio row and its sheet.
- Not checked on a real phone. Venues get no push or email about replies, since they have no push yet.
