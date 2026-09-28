---
tab: Community & media
section: A clip, as it was filmed
puzzle_section_id: 42000
sources:
  - netlify/functions/clipup.mjs (begin / chunk / end), _video.mjs (MAX_VIDEO_BYTES, MAX_SECONDS, CHUNK_BYTES, PENDING_TTL, newClipId, checkVideo, putClip, notePending, sweepQueue), vid.mjs (the 302, Range), _r2.mjs (SigV4, presign, CACHE_SECS, LINK_SECS), autocron.mjs (the clip sweep)
  - public/community.html (the trimmer)
  - MYSET-MASTER-OVERVIEW.md §3.7 Clips; §2.1 (the clip limit)
  - INVARIANTS.md 0ev, 1
  - docs/decisions/0011, 0033
  - IMPLEMENTATION_STATUS.md P3-003; open risks "A 75MB clip may not reach R2 inside the function's budget", "Clip playback through the 302 on a real iPhone"
status: loaded
loaded: 2026-09-12 (create_process; read back through list_sections)
verified: code read 2026-09-12 (clipup.mjs three steps; _video.mjs constants; vid.mjs header; autocron clip sweep). The two open risks are the ledger's words — unmeasured on a device
---

# A clip, as it was filmed

**Who:** a fan with thirty seconds of the room on their phone. **Trigger:** *Add a clip* in the composer. **Outcome:** the clip plays on the community page for anyone, exactly as filmed — picture and sound bit-identical — and its bytes cost MySet nothing to serve. **Clips are the most expensive thing in MySet by a wide margin** (decision 0011's warning), which is why every step here is about bytes.

The history that shaped it: three releases shipped clips with a perfect picture and **no sound**, because shrinking a video in a browser means re-filming it onto a canvas, and a canvas has no sound. The founder called it — *"just let the video be uploaded normally"* — and the fix was mostly a deletion (decision 0011).

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| k01 | Choose a clip on the phone | task | Person | Fan R | Netlify | The file as the camera wrote it. Nothing on the phone re-encodes it — that is the whole decision. `src: decision 0011` |
| k02 | Over the limit? Trim, don't shrink | conditional | Person | Fan R | Netlify | Over `MAX_VIDEO_BYTES` or `MAX_SECONDS` opens a **trim screen shaped like iOS's own**, with **the size, live and exact** — nobody can guess megabytes from seconds, and finding out after a two-minute upload is the worst possible moment. The trimmer rewrites the MP4 **index** (choose the samples in the window, copy their bytes untouched, write a new index) rather than re-encoding, so picture and sound come out bit-identical. `src: community.html § THE TRIMMER; decision 0011` |
| k03 | Begin the upload | task | Automation | MySet server R · Fan I | Netlify | `POST /api/clipup?begin=1 {fan, size, type}` → `{clip, parts, chunk}`. The clip id is minted **before any byte arrives** and noted in `vidpend_<owner>`, so an abandoned upload is already known to the sweep and every key stays computable (INVARIANT 1). The daily post limit is checked here too — this is the expensive door; a device that will never post must not upload as often as it likes. `src: clipup.mjs begin; _video.mjs newClipId, notePending` |
| k04 | Send the pieces, raw | task | Automation | MySet server R · Fan I | Netlify | `POST ?clip=…&i=n` with **raw bytes** — never base64, which alone removes a third — in `CHUNK_BYTES` pieces so no single request approaches Netlify's ~6MB function-body limit; each piece retries three times on bar Wi-Fi. Nothing is validated piece by piece, on purpose: magic bytes and duration only mean something on the whole file. `src: clipup.mjs chunk; _video.mjs CHUNK_BYTES` |
| k05 | Finish: check the whole file once | conditional | Automation | MySet server R · Fan I | Netlify | `POST ?clip=…&end=1 {poster}` → the pieces are joined, `checkVideo` reads the magic bytes and duration, anything over `MAX_VIDEO_BYTES` or `MAX_SECONDS` is refused **by bytes, not by trust**; the poster frame (grabbed on the phone, optional — a clip with no poster still plays, it shows a dark box until tapped) is stored as an image. `src: clipup.mjs end; _video.mjs checkVideo, joinChunks` |
| k06 | Put the bytes where sending them is free | database | Automation | MySet server R | Cloudflare R2 | `putClip` → **R2 first** (`myset-clips`, private bucket, SigV4 signed by hand in `_r2.mjs` — no third dependency), Blobs when R2 is off or cannot be reached. Netlify bills about $0.134/GB to send bytes to a phone and a cache HIT is billed like anything else, so the year-long edge cache saved compute, never bytes: one 75MB clip watched a hundred times cost more than ten whole gigs (INVARIANT 0ev). R2 has no egress charge. `src: _video.mjs putClip; _r2.mjs; decision 0033` |
| k07 | Name the clip in the post | task | Automation | MySet server R | Netlify | The post carries only the clip id (`CLIP_ID`); `addPost` clears the pending note. → *Saying something about a night* w05. `src: _community.mjs addPost; _video.mjs clearPending` |
| k08 | Play it: a link, not the bytes | conditional | Automation | MySet server R · Fan I | Cloudflare R2 | `/api/vid` answers a **302 to a presigned GET** on the bucket, signed from the top of the hour so every request in that hour gets the same link — cached for `CACHE_SECS` at the edge and in the browser — and the link outlives the cache by `LINK_SECS` so a cached redirect can never hand out a dead link (a test pins it). Clips from before R2 are served from Blobs exactly as before: the id is minted once and never reused, so the bytes are safe to cache for a year. Netlify never carries the video. `src: vid.mjs; _r2.mjs r2PresignGet; decision 0033` |
| k09 | Answer the Range | conditional | Automation | MySet server R · Fan I | Cloudflare R2 | iOS Safari asks for `bytes=0-1` first and refuses to play on a 200. On the Blobs path the bytes are in memory so a range is a slice; on the R2 path the browser carries its Range through the redirect and R2 answers the 206 — the suite proves the far side does. Without this the feature simply does not work on most of the phones in a bar. `src: vid.mjs § RANGE; _video.mjs § RANGE REQUESTS ARE NOT OPTIONAL` |
| k10 | Render the feed without fetching a byte | conditional | Automation | MySet server R · Fan I | Netlify | Every clip has a poster, so the feed renders with `preload="none"` and a clip is fetched only when somebody taps play. `src: _video.mjs header` |
| k11 | Sweep the orphans | database | Automation | Scheduled jobs R | Netlify | `autocron` → `sweepQueue`: a clip uploaded and never posted is dropped after `PENDING_TTL` — and **the sweep reads the feed first**, so a posted clip is never taken away. One per ring, after the show sweep, so it can never delay a gig starting. `src: autocron.mjs; _video.mjs sweepQueue, PENDING_TTL` |
| k12 | Measure it on a real phone | research | Person | Founder R · Coding agent C | — | **Draft — two things the suite cannot prove.** Whether a clip at the limit reaches R2 inside the function's time budget (the PUT gives up at 8 s; the fallback is Blobs or *"try again"*; S3 multipart from the piece path is the fallback design), and whether playback through the 302 works on a real iPhone in a bar (the suite proves the Range survives to the far side of the link; not on a device). Both are ledger open risks marked **unmeasured**; the first real large upload after deploy is the measurement. `src: IMPLEMENTATION_STATUS.md § Open risks; docs/sessions/2026-09-11-clips-to-r2.md` |

## Connections

k01 → k02; k02 —fits→ k03; k02 —trimmed→ k03; k03 → k04 → k05; k05 —refused→ *the reason, in plain words*; k05 —ok→ k06 → k07; k07 → k10 —tap play→ k08 → k09; k03 —never posted→ k11; k08 —Draft→ k12.
