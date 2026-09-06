# Clips, uploaded as they are — and what that costs

2026-09-06, after the third silent clip:

> *"please start from scratch on this. just let the video be uploaded normally for
> now – how can we store it so that it loads quickly and is also as cost efficient as
> possible? this process you're trying to do clearly isn't working"*

He was right, and the fix is mostly a deletion.

---

## Why it kept failing

A clip travelled as base64 inside a JSON body. Netlify's function body tops out near
6MB and base64 costs 33%, so the ceiling was 3MB — and **3MB meant every clip had to
be shrunk on the phone first**. The only way to shrink video in a browser is to play
it onto a canvas and record the canvas, and **a canvas has no sound**. So the audio
had to be found somewhere else and mixed back in, which is where it kept failing:

1. First clips were silent — the element was muted so it would autoplay, and muted
   output is silence.
2. Then the upload froze at 3% — an `AudioContext.resume()` on iPhone Safari that
   never settles.
3. Then still silent — `decodeAudioData` refusing a whole MP4, which Safari does.

Every one of those is a *sound* bug caused by a *size* constraint. Removing the size
constraint removes all of them at once.

## What was deleted

About 600 lines: the canvas re-encoder, two separate routes to the soundtrack, a
codec prober, a format blacklist, an audio-context unlocker, a signal analyser and a
stall detector. `public/community.html` went from 1,151 lines to 705.

**Nothing on the phone touches the video now.** The sound cannot go missing because
nothing ever takes it out.

## What replaced it

Two changes make a real file fit:

- **Raw bytes, not base64** — removes 33% before anything else.
- **In pieces** — no single request approaches the 6MB body limit.

`netlify/functions/clipup.mjs`, three steps with the middle one repeating:

```
POST ?begin=1        {fan, size, type}   -> {clip, parts, chunk}
POST ?clip=..&i=n    <raw bytes>         -> {ok}
POST ?clip=..&end=1  {poster}            -> {clip, seconds, bytes}
```

`MAX_VIDEO_BYTES` 3MB → **25MB**. Duration stays 30s, but nothing trims any more, so
a longer clip is refused with its actual length rather than silently cut.

Three details worth keeping:

- **Validation runs once, on the whole file.** Half an MP4 is not a small MP4 —
  magic bytes and duration are properties of the complete file. `checkVideo` is now
  the single place both the chunked path and the legacy data-URL path agree.
- **Nothing can be orphaned.** The clip id is minted at `begin` and noted as pending
  before any byte arrives, so an abandoned upload is already known to the existing
  two-hour sweep. Its manifest records how many pieces exist, so every key can be
  computed — `list()` stays banned.
- **Each piece retries three times** with a backoff. A dropped connection on a bar's
  wifi should cost one piece, not the whole upload.

## "How can we store it so it loads quickly and is cost efficient?"

**Loading quickly is already done**, and `vid.mjs` was the one part of this feature
that was always right:

- **Range requests / 206.** No iPhone plays anything without them, and they are also
  what makes a non-faststart MP4 work — the player fetches the tail to find the index,
  then streams from the front. An iPhone MP4 often has its index at the end.
- **`netlify-cdn-cache-control: public, durable, max-age=31536000, immutable`.** A
  clip's bytes never change, so it is fetched from origin once and served from the
  edge for ever after.
- **A poster frame**, grabbed on the phone and served from the normal image slot with
  the same year-long cache. `preload="none"` on the player means the video itself is
  not fetched until somebody taps — so a feed of ten clips costs ten small JPEGs.

**Cost efficiency is where the honest answer is uncomfortable.** Netlify bills about
**$0.134/GB** of bandwidth, and — established by the scale research on 2026-09-05 —
**a cache HIT is billed like any other request.** The immutable cache saves compute,
never bytes. So:

| clip size | 30 views | 100 views | 1,000 views |
|---|---|---|---|
| 3 MB | $0.01 | $0.04 | $0.39 |
| **25 MB** | **$0.10** | **$0.33** | **$3.27** |

For scale: a whole 3-hour gig with 20 phones voting costs **2.7¢**. One 25MB clip
watched 100 times costs more than **ten entire gigs**. Clips are now the most
expensive thing in MySet by a wide margin, and the size limit is the only lever that
touches that line.

### The move that actually fixes it, when it is worth doing

**Object storage with no egress charge.** Cloudflare R2 is $0.015/GB-month to store
and **$0 to serve**. A thousand 25MB clips is 25GB = **$0.38 a month**, served a
million times for nothing. The same traffic on Netlify would be four figures.

What it needs: a Cloudflare account, an R2 bucket, an API token and a public bucket
hostname — Perry's own setup, the same as Resend and Instagram. MySet's side is
small, because the shape is already right: `putClip` and `getClip` are the only two
places that touch clip bytes, and `vid.mjs` would become a redirect to the bucket
rather than a reader.

**Not built, and deliberately.** It is a second platform to operate for a feature
with one clip on it. The trigger is simple and should be watched: **when clips pass
about 100GB of traffic a month (~$13), the migration pays for itself in the first
month.** Until then this is a note, not a task.

## Checks

- `test/clips.mjs` — 86 assertions including the new chunked path: pieces out of
  order, a missing piece refused and recoverable, reassembled junk still refused,
  orphan cleanup, and **the bytes coming back byte-for-byte identical**.
- `node tools/clipcheck.mjs` — 15 in a real browser, rewritten and much smaller than
  it was. The two that matter: **THE PIECES ARE THE FILE, BYTE FOR BYTE** and
  **AND THE SOUND IS STILL IN IT** (rms 0.4227 out the far end).

*`INVARIANTS.md` 0es–0ev.*

---

## Later the same day — the trimmer

Perry sent the file he could not upload: `IMG_7426.MOV`, 27.5 seconds, **63.9MB**. An
iPhone shooting 1080p HEVC put **2.3MB into every second**, so the 25MB limit bought
him ten seconds. He asked for a trim screen shaped like the one iOS shows.

### The only way to build it that does not reopen the silent-clip bug

An MP4 is an **index plus a bag of samples**. `moov` says where every sample lives and
when it plays; `mdat` is the bytes. So trimming is a library problem, not a video
problem: choose the samples inside the window, copy those bytes untouched, write a new
index pointing at their new positions. **The picture and the sound come out
bit-identical, because nothing decodes them.**

`public/mp4trim.js` — no dependencies, and the whole file is never read: box headers
are found a few bytes at a time, only `moov` is read in full, and the trim reads only
the ranges it keeps. A 500MB source costs about as much memory as the clip it makes.

Three things that are each a bug if missed:

- **The start snaps back to a keyframe.** Cutting anywhere else hands the decoder
  samples that reference a frame it does not have — the smeared opening everyone has
  seen. `snapStart` reports where it really landed so the screen can be honest.
- **Samples are written in original file order**, preserving the camera's
  interleaving. Grouping by track would still play, and would stall while streaming.
- **One picture track and one sound track, nothing else.** Perry's file has **six
  traks**: video, two audio (the second is Apple's spatial mix), and three timed
  metadata. A metadata track can hold a single sample spanning the whole video, which
  is what dragged an early build's output back to the full original length.

The output also puts `moov` **before** `mdat` — faststart, free here because the index
is being rewritten anyway, and the source almost never has it.

### The screen

Shaped like the one iOS shows, because that is the one people know. One addition:
**the size, live and exact.** Nobody can guess megabytes from seconds, and finding out
after a two-minute upload is the worst possible moment. It opens on a window that
already fits rather than handing somebody an invalid state to puzzle out; over the
limit the frame and the figure go red and *Use this* is disabled.

`MAX_VIDEO_BYTES` went **25MB → 50MB**. At 25 his video gave 10 seconds; at 50 it gives
19.1. The number being visible while somebody chooses is what makes a higher ceiling
honest rather than reckless. The cost stands as written above: 50MB × 100 views is
$0.65, against 2.7¢ for a whole three-hour gig. **R2 is still the answer if clips take
off**, and it is what would make a bigger number free instead of expensive.

### Tested on the actual file, all the way to production

| step | result |
|---|---|
| trim screen opens, pre-set | 19.1 seconds · 46.6MB of 50MB |
| uploaded to **production** | 12 pieces, 23.1 seconds |
| server read the length | 19.1367s, out of the container |
| served back | 46.5MB, **byte-identical** |
| plays | 19.14s, sound rms 0.199 |
| decoded by macOS AVFoundation | a frame of the gig, from the file production served |

That last row is the one that matters most: `qlmanage` renders a real frame out of the
finished clip, and AVFoundation is the same stack an iPhone uses.

`test/trim.mjs` — 26 assertions, in `sh test/run.sh`. The fixture's sample *n* is a run
of the byte *n*, so a trim is checked **at the byte**: following the new index into the
new file proves both that the right samples were chosen and that the offsets point
where the bytes actually are. `bytesFor` is asserted **exact**, and is byte-exact
against the real 64MB `.MOV` across three different windows.

*`INVARIANTS.md` 0ew–0ez.*
