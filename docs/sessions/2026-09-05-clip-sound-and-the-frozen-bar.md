# The clip that froze at 3% — and why it had no sound in the first place

2026-09-05. Perry, on his iPhone, twice: first *"there was still no sound"*, then
*"the progress bar didn't move and after a while I got an error message"*, then —
after the fix I shipped for that — *"it's getting stuck on this page and isn't even
timing out anymore"*, with a screenshot of the bar sitting at 3% under the words
**"Shrinking on your phone — about 27 seconds"**.

Three complaints, one root cause each, and the third one was mine.

---

## 1. The frozen bar: a promise that waits for a tap that already happened

```js
async function reencode(v, seconds, onPct, onAudio, wantAudio){
  const au = wantAudio ? await audioFor(v) : null;   // <- here
  return new Promise((res,rej)=>{ ... every timeout in the file lives in here ... });
}
```

`audioFor` did `await ac.resume()`.

A phone will only let a page start making sound during a tap. An `AudioContext`
built at any other moment is born `suspended`, and the documented way to wake it is
`resume()`. On iPhone Safari, when the browser wants a fresher tap, **that promise
never settles.** It does not fail. It does not time out. It waits for a tap — and
the tap that could have satisfied it was the one that opened the file picker, which
closed before the file came back.

And it sat one line *above* the promise that held every backstop in the function.
So the bar drew 3%, said "about 27 seconds", and stopped for ever. The screenshot is
exactly that: the label set, the bar at 3%, nothing after it.

This is why the second fix was worse than the first. The first version at least
produced an error eventually; my "fix" moved the hang earlier, to a place with no
clock over it at all.

**What changed.** The context is now woken inside the tap on "Add a clip" —
`unlockAudio`, wired to that label's `pointerdown` and `click`, which is a real tap
and always works. Afterwards its state is only ever *read* (`audioReady()`), never
awaited. It is kept for the life of the page, because closing it would throw away
the one tap that could have woken it. And `withDeadline` now sits over the whole
job as well as the parts, because the freeze happened precisely where no clock had
been written.

---

## 2. The missing sound: three ways to get it, two of which cannot work on a phone

| | why it fails |
|---|---|
| `video.captureStream()` | captures what the element **outputs**. The element must be muted or a phone will not play it. Muted output is silence — so the clip had an audio track with nothing in it, and nothing said so. |
| `MediaElementAudioSourceNode` | taps the audio before the speakers, so the element can stay unmuted. But an **unmuted** video will not start playing on a phone without a tap at that exact moment — and the node permanently commits the element, so a failed attempt cannot even be retried. |
| **decode the soundtrack out of the file** | what it does now. |

`soundFor(file)` reads the file's bytes and `decodeAudioData`s them on the already-
running context. The video element is then **muted from birth** and only ever
supplies pictures — and a muted video is allowed to play everywhere, without a tap,
which is the entire reason a clip gets made at all. Nothing is ever played out loud:
the sound goes to the recorder, never to the speaker, so nobody's clip blares out of
their pocket in a bar during somebody else's set.

Two details that are not optional:

- The decoded buffer hands out **one player per attempt** (`take()`). An
  `AudioBufferSourceNode` can only be started once, so a retry would otherwise get a
  spent one and come out silent — losing the very thing decoding bought.
- A decoded minute is about 23MB, and decoding cannot be asked for part of a file.
  A source longer than `SOUND_MAX_SECS` (150s) is left silent **on purpose**, with a
  sentence saying why. A length that reads back as `Infinity` — which is what every
  `MediaRecorder`-made file and most Android screen recorders report — is *not*
  treated as too long; file size stands in for it. Getting that backwards would take
  the sound off exactly the clips people record on their phones.

---

## 3. The one nobody was looking for: the browser lies about what it can record

Found by the browser harness, not by reasoning:

```
video/mp4;codecs=avc1.42E01E,mp4a.40.2 : isTypeSupported → true
                                         real recording  → EncodingError after 273ms
```

That string was **first** in `CLIP_TYPES`, so it was what MySet always asked for.

It only fails when there is genuine sound to encode:

```
avc1 · video · buffer-audio · 3000ms : ERROR EncodingError after 273ms
avc1 · video · NO audio     · 3000ms : ok 29140b
avc1 · video · empty-audio  · 3000ms : ok 11358b
avc1 · fill  · buffer-audio · 3000ms : ERROR EncodingError after 241ms
```

Which is why it went unnoticed for as long as every clip was silent, and broke the
moment they were not. **Fixing the sound is what exposed it.**

Three defences, because one was not enough:

1. Plain `video/mp4` is asked for first; the spelled-out codec string is last, for
   anything that will only accept a full string.
2. `probeMime` **actually records** before a format is used — at the real frame size,
   with a real tone playing. My first version of this probe used a 32-pixel canvas
   and an empty audio channel for 250ms; it passed everything, including the format
   that fails, and was worse than no check at all.
3. A format that fails mid-clip is struck off (`blameMime`) and never offered again —
   to the retry or to the next clip. Without that the retry re-picks the format that
   just failed and fails identically.

And the retry now **keeps the sound**: only a stalled element drops it.

---

## Two smaller things that were making it look broken

- **`draw()` never checked whether it had already stopped.** When the recorder
  failed, the promise settled but the loop kept painting until the video happened to
  end — burning the phone and driving the *same* progress bar as the retry that had
  already started. The bar jumped backwards and forwards between two encodes at once.
- **The upload used `fetch`, which cannot report progress.** The bar sat at 78% for
  the whole upload, which looks exactly like the thing that was actually broken. It
  is `XMLHttpRequest` now, so it moves 78 → 98% as the bytes go, and a dead
  connection ends in a sentence after three minutes instead of silence.

---

## How it is checked

`test/` runs in node, and node has no `MediaRecorder`, no canvas `captureStream` and
no `AudioContext` — so the entire reason clips broke twice was **invisible to the
suite**. That is the real lesson of this session.

`tools/clipcheck.mjs` drives `public/community.html` in headless Chrome, builds a
source video with a 440Hz tone in it, runs the real code, and then decodes the clip
that comes out to measure its RMS. Twenty checks, about forty seconds:

```
node tools/clipcheck.mjs
```

```
  ✓ the tap wakes the sound up — state=running
  ✓ a length of Infinity is not treated as too long — duration=Infinity
  ✓ THE CLIP HAS SOUND IN IT — rms 0.4242, 3.9s
  ✓ asking for sound returns at once instead of hanging — 0ms
  ✓ nothing ever awaited resume()
  ✓ a broken format still ends in a clip
  ✓ and it tried a DIFFERENT format second — video/mp4 then video/webm;codecs=vp8,opus
  ✓ THE RECOVERED CLIP HAS SOUND IN IT — rms 0.4232
```

It is not part of `sh test/run.sh` because it needs Chrome and puppeteer-core, which
live outside this repo. Run it by hand after touching anything in the CLIPS section.

*Recorded as `INVARIANTS.md` 0eg (never await `resume()`), 0eh (`isTypeSupported`
is a belief, and a codec check fed silence proves nothing) and 0ei (a clip's sound
comes out of the file, never out of the element).*
