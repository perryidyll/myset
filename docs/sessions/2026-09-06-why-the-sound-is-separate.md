# "Why is the sound treated as something separate at all?"

2026-09-06. Perry, after a clip finally uploaded but came back silent:

> *"i know i'm completely ignorant on this but i'm a little confused why the sound is
> being treated as something separate to be added at all..?"*

It is the right question, it is not an ignorant one, and the answer is the reason this
feature has failed three times in a row.

---

## The answer

**MySet does not send the video. It re-films it.**

A 30-second clip off an iPhone is around 50MB. A Netlify function body tops out near
6MB and MySet's own ceiling is 3MB, there is no server to transcode on, and no
in-browser transcoder that does not mean shipping several megabytes of WebAssembly to
every fan who opens a community page. So the phone does the work with the encoder it
already has: `MediaRecorder` records a `MediaStream`, and the stream's video track
comes from `canvas.captureStream()` — the file is played onto an invisible canvas and
the canvas is filmed.

**A canvas is pixels. A film of a canvas has no sound.**

So the audio cannot ride along; it has to be fetched separately and added to the
stream as its own track. That separation is not a design decision anybody made — it
is what "shrink it by re-filming it" forces. And it is why every failure so far has
been a *sound* failure while the picture arrived perfectly.

The alternatives were weighed and none of them removes the split:

- **Send the original.** 50MB against a 3MB ceiling. No.
- **Trim without re-encoding.** Cuts duration, not bitrate. A 30-second phone clip is
  still ~50MB.
- **WebCodecs + an MP4 muxer.** Encodes both tracks properly — and still encodes them
  as two tracks. It also means ~100KB of new dependency and a large amount of new
  code on a path that has already broken three times.

So the fix is never "stop separating them". It is to make getting the sound reliable,
and to make every claim about it measured rather than hoped.

---

## What was wrong this time

`decodeAudioData` is specified for **audio** files. Handed a whole MP4 with a video
track in it, Chrome digs the soundtrack out and **Safari routinely refuses**. That
arrives on an iPhone as exactly what Perry saw: the picture is fine, the clip uploads,
and the message says it came out silent.

There was only one route to the sound, and on his phone it was the one that fails.

## What shipped

**A second route.** `elementSound(v)` taps the playing element with a
`MediaElementAudioSourceNode` — the route the very first version used, which failed
then for a reason that no longer exists: the context it needed was asleep and could
not be woken because the tap was already spent. The tap now wakes the context before
the file picker opens, so the one thing this route requires is the one thing that is
now guaranteed.

It needs the element **unmuted** (a muted element feeds silence into the node — the
original bug), so `reencode` leaves it unmuted on that path and only that path.
Nothing is heard out loud either way: the node takes the audio before the speakers and
is wired only to the recorder.

**And it listens to itself.** An `AnalyserNode` rides along for the whole recording,
so at the end the app reports what it actually heard. Route one gets the same
treatment up front — `hasSignal()` scans the decoded buffer, because "the file has an
audio track" and "the file has sound in it" are different facts and confusing them is
the entire history of this feature.

**Seven honest reasons instead of one vague one.** The message now names which:
the phone would not wake its sound up · the video is too long to keep its sound ·
we could not get at the sound in that file · the video has no sound in it · there was
no sound in that video · your phone would not play it with the sound on · it had to be
made a second time.

**A wider unlock.** iPhones are inconsistent about which event in a tap counts, so
`pointerdown`, `touchstart`, `touchend` and `click` on the button all arm the sound,
plus a one-shot net on the first touch anywhere on the page.

**A refusal is not a failure.** A phone declining to play an unmuted clip now rejects
as `noplay`, which drops the sound and retries rather than giving up on the clip.

## Checks

`node tools/clipcheck.mjs` — 27 assertions in a real browser. Two are new and they are
the ones that matter:

- **Safari's failure, simulated.** `soundFor` is stubbed to refuse, exactly as Safari
  does, and the finished clip is decoded and measured: `THE ELEMENT ROUTE CARRIED THE
  SOUND — rms 0.4187`.
- **A video with genuinely no sound** still becomes a clip, and is told why it is
  silent rather than having it blamed on the phone.

*`INVARIANTS.md` 0eq, 0er.*
