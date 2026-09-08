---
id: 0011
title: A clip is uploaded exactly as it was filmed; nothing on the phone re-encodes it
date: 2026-09-06
status: decided
decided_by: perry
area: media
reverses: 
invariants: [0es, 0et, 0eu, 0ev, 0ew, 0ex, 0ey, 0ez]
commits: [f80f71d, b2f00b9]
tests: [test/clips.mjs, test/trim.mjs]
files: [netlify/functions/clipup.mjs, netlify/functions/_video.mjs, netlify/functions/vid.mjs, public/community.html, public/mp4trim.js]
---

## The question

Three attempts at clips on community posts all shipped silent video. Perry:

> *"please start from scratch on this. just let the video be uploaded normally for now
> – how can we store it so that it loads quickly and is also as cost efficient as
> possible? this process you're trying to do clearly isn't working"*

And earlier, the question that explains it: *"why is the sound being treated as
something separate to be added at all..?"*

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| A — keep re-encoding on the phone | Small files | **A canvas has no sound.** Shrinking in a browser means filming the video onto a canvas, so audio must be fetched separately and mixed back — which is why every failure was a *sound* failure while the picture arrived perfectly | an audio graph, an unlocker, a prober, a stall detector, an analyser | It failed three times in a row |
| **B — chosen. Send the original, in pieces, untouched** | The sound cannot go missing because nothing takes it out | Bigger files, and bandwidth is the one thing that can move the Netlify bill | a 3-step chunked upload endpoint | A big clip watched a lot costs real money |
| C — WebCodecs + an MP4 muxer | Encodes both tracks properly | Still two tracks; ~100KB of new dependency on a path that has already broken three times | a muxer | More of the same failure surface |
| D — a server to transcode on | The normal answer | There is no server; this is functions-only | a whole platform | Weeks |

## What was chosen, and why

B, and **the fix was mostly a deletion**: about 600 lines went — the canvas re-encoder,
two routes to the soundtrack, a codec prober, a format blacklist, an audio-context
unlocker, a signal analyser and a stall detector. `public/community.html` went from
1,151 lines to 705.

Two changes make a real file fit: **raw bytes instead of base64** (removes 33% before
anything else) and **in pieces**, so no single request approaches the 6MB function-body
limit. The clip id is minted before any byte arrives, so an abandoned upload is already
known to the two-hour sweep — and its manifest records how many pieces exist, so every
key is computable and `list()` stays banned (decision 0008).

**And a trimmer, not a shrinker.** An MP4 is an index plus a bag of samples, so trimming
is a library problem, not a video problem: choose the samples inside the window, copy
those bytes untouched, write a new index. **The picture and the sound come out
bit-identical, because nothing decodes them.**

## What this makes harder

**Clips are now the most expensive thing in MySet by a wide margin.** Netlify bills
about $0.134/GB and a cache HIT is billed like any other request, so the immutable cache
saves compute, never bytes. One 75MB clip watched 100 times costs more than **thirty
entire three-hour gigs** (2.7¢ each). The size limit is the only lever that touches that
line, which is why the trim screen shows **the size, live and exact** while somebody
chooses — nobody can guess megabytes from seconds, and finding out after a two-minute
upload is the worst possible moment.

Three things in the trimmer that are each a bug if missed: the start snaps back to a
keyframe; samples are written in original file order (grouping by track still plays and
stalls while streaming); and only one picture and one sound track are kept — Perry's own
file has **six**, including three timed-metadata tracks, one of which can hold a single
sample spanning the whole video and dragged an early build's output back to full length.

## What would reverse it

**Cloudflare R2: $0.015/GB-month to store and $0 to serve.** A thousand 75MB clips is
75GB ≈ $1.13/month, served a million times for nothing. It needs Perry's own Cloudflare
account. **The trigger to build it: clips passing about 100GB of traffic a month (~$13)
— at which point the migration pays for itself in the first month.** MySet's side is
small: `putClip` and `getClip` are the only two places that touch clip bytes.

## How it was verified

`test/clips.mjs` (86 assertions) including pieces out of order, a missing piece refused
and recoverable, reassembled junk still refused, and **the bytes coming back
byte-for-byte identical**. `test/trim.mjs` (26) checks a trim **at the byte** — the
fixture's sample *n* is a run of the byte *n*, so following the new index into the new
file proves both that the right samples were chosen and that the offsets point where the
bytes are. `tools/clipcheck.mjs` runs it in a real browser: **the pieces are the file,
byte for byte** and **the sound is still in it** (rms 0.4227). And Perry's own 63.9MB
`.MOV` went through the trim screen, to production, and back — 46.5MB byte-identical,
19.14s, sound rms 0.199, and a real frame rendered out of it by macOS AVFoundation.
