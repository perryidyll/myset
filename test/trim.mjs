/* TRIMMING AN MP4 WITHOUT RE-ENCODING IT  (public/mp4trim.js)

   This is the riskiest code in the clip path, because a mistake here does not throw
   — it produces a file that looks fine and will not play. So the fixture is built
   with SAMPLES THAT IDENTIFY THEMSELVES: sample n is a run of the byte n. A trim can
   then be checked at the byte level rather than by squinting at a duration.

   Pins, in order:
     · a file it cannot handle is refused with a reason, never trimmed badly
     · the start always lands on a keyframe, because cutting anywhere else opens
       on smeared garbage
     · the samples that come out are exactly the ones the window asked for
     · the new index points at where the bytes actually ARE in the new file
     · durations are rewritten, and the output re-opens as a valid file
     · bytesFor is accurate enough to put in front of a person before they commit
     · metadata tracks are dropped, and only one audio track survives */

const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const MySetTrim = require('../public/mp4trim.js');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, got === want, { got, want });

/* ---------- a minimal but genuinely valid classic MP4 ---------- */
const A = (s) => Buffer.from(s, 'latin1');
function box(type, ...parts) {
  const body = Buffer.concat(parts);
  const h = Buffer.alloc(8);
  h.writeUInt32BE(body.length + 8, 0); h.write(type, 4, 'latin1');
  return Buffer.concat([h, body]);
}
const u32 = (...n) => { const b = Buffer.alloc(n.length * 4); n.forEach((v, i) => b.writeUInt32BE(v >>> 0, i * 4)); return b; };
const full = (v, f) => Buffer.from([v, (f >> 16) & 255, (f >> 8) & 255, f & 255]);

/**
 * `tracks` — [{ kind, timescale, count, dur, size, syncEvery }]
 * Sample i of a track is `size` bytes all equal to (i & 255), so any slice of the
 * output can be traced straight back to the sample it came from.
 */
function buildMp4(tracks) {
  // lay the samples out interleaved, the way a camera writes them
  const all = [];
  const maxCount = Math.max(...tracks.map((t) => t.count));
  for (let i = 0; i < maxCount; i++)
    for (let ti = 0; ti < tracks.length; ti++)
      if (i < tracks[ti].count) all.push({ ti, i });

  const mdatBody = Buffer.concat(all.map(({ ti, i }) => Buffer.alloc(tracks[ti].size, i & 255)));
  const ftyp = box('ftyp', A('isom'), u32(512), A('isomiso2mp41'));
  // moov comes after mdat here, exactly as an iPhone writes it
  const mdatStart = ftyp.length + 8;
  const offsets = tracks.map(() => []);
  {
    let at = mdatStart;
    for (const { ti, i } of all) { offsets[ti][i] = at; at += tracks[ti].size; }
  }

  const traks = tracks.map((t, ti) => {
    const tkhd = box('tkhd', full(0, 3), u32(0, 0, ti + 1, 0, t.count * t.dur), Buffer.alloc(60));
    const mdhd = box('mdhd', full(0, 0), u32(0, 0, t.timescale, t.count * t.dur), Buffer.alloc(4));
    const hdlr = box('hdlr', full(0, 0), u32(0), A(t.kind), Buffer.alloc(12), A('x\0'));
    const stsd = box('stsd', full(0, 0), u32(1), box(t.kind === 'vide' ? 'avc1' : 'mp4a', Buffer.alloc(30)));
    const stts = box('stts', full(0, 0), u32(1), u32(t.count, t.dur));
    const stsz = box('stsz', full(0, 0), u32(0, t.count), u32(...new Array(t.count).fill(t.size)));
    const stsc = box('stsc', full(0, 0), u32(1), u32(1, 1, 1));
    const stco = box('stco', full(0, 0), u32(t.count), u32(...offsets[ti]));
    const parts = [stsd, stts];
    if (t.syncEvery) {
      const syncs = [];
      for (let i = 0; i < t.count; i += t.syncEvery) syncs.push(i + 1);
      parts.push(box('stss', full(0, 0), u32(syncs.length), u32(...syncs)));
    }
    parts.push(stsc, stsz, stco);
    const stbl = box('stbl', ...parts);
    const minf = box('minf', box(t.kind === 'vide' ? 'vmhd' : 'smhd', Buffer.alloc(8)),
      box('dinf', box('dref', full(0, 0), u32(1), box('url ', full(0, 1)))), stbl);
    return box('trak', tkhd, box('edts', box('elst', full(0, 0), u32(1), u32(t.count * t.dur, 0, 0x10000))),
      box('mdia', mdhd, hdlr, minf));
  });
  const mvhd = box('mvhd', full(0, 0), u32(0, 0, 1000, Math.round(tracks[0].count * tracks[0].dur / tracks[0].timescale * 1000)), Buffer.alloc(80));
  const moov = box('moov', mvhd, ...traks);
  const mdat = box('mdat', mdatBody);
  return { buf: Buffer.concat([ftyp, mdat, moov]), offsets };
}

const asFile = (buf, type = 'video/mp4') => new File([buf], 'x.mp4', { type });

console.log('\nWHAT IT REFUSES, AND WHY IT SAYS SO');
{
  const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(400, 5)]);
  eq('a WebM is not an MP4', (await MySetTrim.open(asFile(webm))).why, 'not-mp4');
  eq('random bytes are refused', (await MySetTrim.open(asFile(Buffer.alloc(900, 3)))).why, 'not-mp4');
  const frag = Buffer.concat([box('ftyp', A('isom'), u32(0)), box('moof', Buffer.alloc(20)), box('mdat', Buffer.alloc(50))]);
  ok('a fragmented MP4 is refused BY NAME, not trimmed wrongly',
    (await MySetTrim.open(asFile(frag))).why === 'fragmented');
  const audioOnly = buildMp4([{ kind: 'soun', timescale: 1000, count: 20, dur: 50, size: 100 }]);
  eq('an MP4 with no picture track is refused', (await MySetTrim.open(asFile(audioOnly.buf))).why, 'no-video');
}

console.log('\nA REAL TRIM, CHECKED AT THE BYTE');
/* 30 video samples of 1000 bytes, one keyframe every 10; 60 audio samples. Ten
   seconds of video at three frames a second, which keeps the arithmetic legible. */
const V = { kind: 'vide', timescale: 300, count: 30, dur: 100, size: 1000, syncEvery: 10 };
const S = { kind: 'soun', timescale: 600, count: 60, dur: 100, size: 200 };
const { buf } = buildMp4([V, S]);
const src = await MySetTrim.open(asFile(buf));
ok('it opens', src.ok, src.why);
eq('and reads the length out of the container', Math.round(src.duration), 10);
eq('two tracks', src.tracks, 2);
ok('and it can see the sound', src.hasAudio);

console.log('\nTHE START ALWAYS LANDS ON A KEYFRAME');
/* Keyframes are samples 0, 10 and 20 — at 0s, 3.33s and 6.67s. */
eq('asking for 0 gives 0', src.snapStart(0), 0);
ok('asking for 4.5s falls back to 3.33s', Math.abs(src.snapStart(4.5) - 10 / 3) < 0.01, src.snapStart(4.5));
ok('asking for 3.4s falls back to 3.33s too', Math.abs(src.snapStart(3.4) - 10 / 3) < 0.01, src.snapStart(3.4));
ok('never forward, only back', src.snapStart(9.9) <= 9.9);

console.log('\nTHE BYTES THAT COME OUT ARE THE BYTES THAT WENT IN');
{
  /* 3.4s → 6.0s. The start snaps to sample 10 (3.33s); the window ends before
     sample 18 (6.0s), so video samples 10..17 are expected. */
  const blob = await src.trim(3.4, 6.0);
  const out = Buffer.from(await blob.arrayBuffer());
  const t2 = await MySetTrim.open(asFile(out));
  ok('the result re-opens as a valid MP4', t2.ok, t2.why);
  eq('two tracks still', t2.tracks, 2);
  ok('the length is what was asked for', Math.abs(t2.duration - (6.0 - 10 / 3)) < 0.05, t2.duration);

  /* THE DECISIVE ONE. Every sample is a run of its own index, so reading the new
     index and following it into the new file proves the offsets are right AND that
     the right samples were chosen. Nothing here trusts the writer's own bookkeeping. */
  const dv = new DataView(out.buffer, out.byteOffset, out.length);
  const t4 = (o) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
  const found = [];
  (function walk(s, e) {
    let o = s;
    while (o + 8 <= e) {
      const sz = dv.getUint32(o), ty = t4(o + 4);
      if (sz < 8 || o + sz > e) return;
      if (ty === 'stco') {
        const n = dv.getUint32(o + 12);
        const offs = [];
        for (let i = 0; i < n; i++) offs.push(dv.getUint32(o + 16 + i * 4));
        found.push(offs);
      } else if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(ty)) walk(o + 8, o + sz);
      o += sz;
    }
  })(0, out.length);

  ok('there is an index for each track', found.length === 2, found.length);
  const vOffs = found[0];
  eq('eight video samples were kept', vOffs.length, 8);
  const firstBytes = vOffs.map((off) => out[off]);
  ok('and they are samples 10 to 17, in order',
    JSON.stringify(firstBytes) === JSON.stringify([10, 11, 12, 13, 14, 15, 16, 17]), firstBytes);
  ok('every offset lands inside the file', vOffs.every((o) => o > 0 && o < out.length));
  ok('the whole of each sample is there, not just its first byte',
    vOffs.every((o) => out.subarray(o, o + 1000).every((b) => b === out[o])));
}

console.log('\nTHE SIZE SHOWN TO A PERSON IS THE SIZE THEY GET');
{
  /* The trim screen puts this number in front of somebody BEFORE they wait for an
     upload, so being roughly right is not good enough. */
  for (const [a, b] of [[0, 4], [2, 7], [3.4, 6.0], [0, 10]]) {
    const guess = src.bytesFor(a, b);
    const real = (await src.trim(a, b)).size;
    /* EXACT, not close. The writer and this number are computed the same way, so
       any drift at all means one of them has changed and the other has not. */
    ok(`bytesFor(${a},${b}) is exactly right`, guess === real, { guess, real, off: guess - real });
  }
}

console.log('\nTRACKS THAT DO NOT BELONG IN A CLIP');
{
  /* An iPhone .MOV carries timed-metadata tracks and sometimes a second audio
     track; the file Perry sent had six traks in total. A metadata track can hold
     ONE sample spanning the whole video, which is what dragged an early build's
     output back to the full original length. */
  const { buf: many } = buildMp4([
    V, S,
    { kind: 'soun', timescale: 600, count: 60, dur: 100, size: 200 },
    { kind: 'meta', timescale: 600, count: 1, dur: 6000, size: 40 },
  ]);
  const t = await MySetTrim.open(asFile(many));
  eq('only the picture and the first sound track survive', t.tracks, 2);
  const out = Buffer.from(await (await t.trim(0, 3)).arrayBuffer());
  const t2 = await MySetTrim.open(asFile(out));
  ok('and a metadata track cannot stretch the result back to full length',
    t2.duration < 3.2, t2.duration);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
