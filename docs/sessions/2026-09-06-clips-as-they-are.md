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
