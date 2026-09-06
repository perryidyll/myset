/* TRIMMING AN MP4 WITHOUT RE-ENCODING IT.
 *
 * WHY THIS EXISTS AND WHY IT IS NOT A RE-ENCODER. MySet used to shrink clips by
 * playing them onto a canvas and recording the canvas. A canvas has no sound, so the
 * audio had to be found and mixed back separately, and that failed three releases
 * running. The rule that came out of it (INVARIANT 0es) is that nothing in the
 * browser re-encodes a clip. So this does not.
 *
 * An MP4 is an index plus a bag of samples. `moov` says where every sample lives and
 * when it plays; `mdat` is the bytes. Trimming is therefore a LIBRARY problem, not a
 * video problem: choose the samples inside the window, copy those bytes untouched,
 * and write a new index that points at their new positions. The video samples and
 * the audio samples come out exactly as they went in — same codec, same quality,
 * same sound — because nothing decodes or re-encodes anything.
 *
 * WHAT IT WILL NOT DO, and says so rather than producing a broken file:
 *   · fragmented MP4 (moof/mfra — what MediaRecorder writes). Different shape.
 *   · WebM/Matroska. Different container entirely.
 *   · a file with no moov, or a moov it cannot parse.
 *
 * MEMORY. The whole file is never read. Box headers are found by slicing a few
 * bytes at a time, only `moov` is read in full (tens of KB), and the trim reads only
 * the byte ranges it actually needs. A 500MB source costs about as much memory as
 * the clip that comes out of it.
 *
 * TWO DETAILS THAT ARE NOT OPTIONAL:
 *   · Video must start on a KEYFRAME. A cut anywhere else gives a player samples
 *     that reference a frame it does not have, which is the smeared-garbage opening
 *     everybody has seen. The start is always snapped back to the nearest sync
 *     sample, and `snapStart` reports where it really landed so the UI can show it.
 *   · Samples are written in ORIGINAL FILE ORDER, which preserves the interleaving
 *     the camera chose. Writing all the video then all the audio would still be a
 *     valid file and would still play, but it would stall on a slow connection.
 *
 * The output also puts `moov` BEFORE `mdat`, which the source usually does not.
 * That is "faststart": a player can begin without first fetching the end of the
 * file. It costs nothing here because the index is being rewritten anyway.
 */
(function () {
  'use strict';

  const CONTAINER = ['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'udta'];
  const te = new TextEncoder();

  const u32 = (v, o, n) => v.setUint32(o, n);
  const type4 = (dv, off) => String.fromCharCode(
    dv.getUint8(off), dv.getUint8(off + 1), dv.getUint8(off + 2), dv.getUint8(off + 3));

  /** Walk the top-level boxes by reading only their headers. */
  async function topBoxes(file) {
    const out = [];
    let off = 0;
    while (off + 8 <= file.size) {
      const head = new DataView(await file.slice(off, Math.min(off + 16, file.size)).arrayBuffer());
      if (head.byteLength < 8) break;
      let size = head.getUint32(0), hdr = 8;
      const t = type4(head, 4);
      if (size === 1) {
        if (head.byteLength < 16) break;
        size = Number(head.getBigUint64(8)); hdr = 16;
      } else if (size === 0) {
        size = file.size - off;                 // "to end of file"
      }
      if (size < hdr || off + size > file.size) break;
      out.push({ type: t, start: off, size, hdr });
      off += size;
    }
    return out;
  }

  /** Children of a container box already held in memory. */
  function children(dv, start, end) {
    const out = [];
    let off = start;
    while (off + 8 <= end) {
      let size = dv.getUint32(off), hdr = 8;
      const t = type4(dv, off + 4);
      if (size === 1) { size = Number(dv.getBigUint64(off + 8)); hdr = 16; }
      if (size < hdr || off + size > end) break;
      out.push({ type: t, start: off, size, hdr, body: off + hdr, end: off + size });
      off += size;
    }
    return out;
  }
  const find = (list, t) => list.find((b) => b.type === t) || null;
  const kids = (dv, b) => children(dv, b.body, b.end);

  /* ---------- reading one track's sample table ---------- */

  function parseTrak(dv, trak) {
    const tk = kids(dv, trak);
    const tkhd = find(tk, 'tkhd');
    const mdia = find(tk, 'mdia');
    if (!tkhd || !mdia) return null;
    const md = kids(dv, mdia);
    const mdhd = find(md, 'mdhd');
    const hdlr = find(md, 'hdlr');
    const minf = find(md, 'minf');
    if (!mdhd || !minf) return null;
    const mi = kids(dv, minf);
    const stbl = find(mi, 'stbl');
    if (!stbl) return null;
    const st = kids(dv, stbl);

    const mv = mdhd.body;
    const mdhdVer = dv.getUint8(mv);
    const timescale = mdhdVer === 1 ? dv.getUint32(mv + 20) : dv.getUint32(mv + 12);
    const kind = hdlr ? type4(dv, hdlr.body + 8) : '';
    /* PICTURES AND SOUND ONLY. An iPhone .MOV carries several extra tracks — timed
       metadata for orientation and motion, and more besides; the file Perry sent has
       EIGHT. They are useless in a clip, and one of them broke the trim outright: a
       metadata track can hold a single sample spanning the entire video, so it was
       always "inside" the window and dragged the finished clip's duration back to
       the full length of the original. Dropped, not fixed. */
    if (kind !== 'vide' && kind !== 'soun') return { skip: true };

    const stts = find(st, 'stts'), stsz = find(st, 'stsz'), stsc = find(st, 'stsc');
    const stco = find(st, 'stco'), co64 = find(st, 'co64');
    const stss = find(st, 'stss'), ctts = find(st, 'ctts'), stsd = find(st, 'stsd');
    if (!stts || !stsz || !stsc || (!stco && !co64) || !stsd) return null;

    // --- sizes ---
    const szBase = stsz.body + 4;
    const uniform = dv.getUint32(szBase);
    const count = dv.getUint32(szBase + 4);
    const sizes = new Uint32Array(count);
    if (uniform) sizes.fill(uniform);
    else for (let i = 0; i < count; i++) sizes[i] = dv.getUint32(szBase + 8 + i * 4);

    // --- decode times ---
    const dts = new Float64Array(count);
    const dur = new Uint32Array(count);
    {
      const n = dv.getUint32(stts.body + 4);
      let s = 0, t = 0;
      for (let i = 0; i < n && s < count; i++) {
        const c = dv.getUint32(stts.body + 8 + i * 8);
        const d = dv.getUint32(stts.body + 12 + i * 8);
        for (let j = 0; j < c && s < count; j++) { dts[s] = t; dur[s] = d; t += d; s++; }
      }
    }

    // --- composition offsets, when the encoder used B-frames ---
    let cts = null;
    if (ctts) {
      cts = new Int32Array(count);
      const ver = dv.getUint8(ctts.body);
      const n = dv.getUint32(ctts.body + 4);
      let s = 0;
      for (let i = 0; i < n && s < count; i++) {
        const c = dv.getUint32(ctts.body + 8 + i * 8);
        const o = ver === 1 ? dv.getInt32(ctts.body + 12 + i * 8) : dv.getUint32(ctts.body + 12 + i * 8);
        for (let j = 0; j < c && s < count; j++) cts[s++] = o;
      }
    }

    // --- chunk offsets, then sample offsets via the chunk map ---
    const chunkOff = [];
    if (stco) {
      const n = dv.getUint32(stco.body + 4);
      for (let i = 0; i < n; i++) chunkOff.push(dv.getUint32(stco.body + 8 + i * 4));
    } else {
      const n = dv.getUint32(co64.body + 4);
      for (let i = 0; i < n; i++) chunkOff.push(Number(dv.getBigUint64(co64.body + 8 + i * 8)));
    }
    const runs = [];
    {
      const n = dv.getUint32(stsc.body + 4);
      for (let i = 0; i < n; i++)
        runs.push({ first: dv.getUint32(stsc.body + 8 + i * 12), per: dv.getUint32(stsc.body + 12 + i * 12) });
    }
    const offs = new Float64Array(count);
    {
      let s = 0;
      for (let c = 0; c < chunkOff.length && s < count; c++) {
        let per = 0;
        for (let r = runs.length - 1; r >= 0; r--) if (runs[r].first <= c + 1) { per = runs[r].per; break; }
        let at = chunkOff[c];
        for (let k = 0; k < per && s < count; k++) { offs[s] = at; at += sizes[s]; s++; }
      }
      if (s < count) return null;                 // the map did not cover every sample
    }

    // --- keyframes. No stss means every sample is one (audio, and all-I video). ---
    let sync = null;
    if (stss) {
      sync = new Uint8Array(count);
      const n = dv.getUint32(stss.body + 4);
      for (let i = 0; i < n; i++) {
        const s = dv.getUint32(stss.body + 8 + i * 4) - 1;
        if (s >= 0 && s < count) sync[s] = 1;
      }
    }

    return { kind, timescale, count, sizes, dts, dur, cts, offs, sync,
             tkhd, mdhd, mdia, minf, stbl, stsd, hasCtts: !!ctts, hasStss: !!stss,
             mdhdVer, tkhdVer: dv.getUint8(tkhd.body) };
  }

  /* ---------- writing boxes ---------- */

  function box(type, parts) {
    let n = 8;
    for (const p of parts) n += p.length;
    const out = new Uint8Array(n);
    new DataView(out.buffer).setUint32(0, n);
    out.set(te.encode(type), 4);
    let at = 8;
    for (const p of parts) { out.set(p, at); at += p.length; }
    return out;
  }
  function u32arr(nums) {
    const out = new Uint8Array(nums.length * 4);
    const dv = new DataView(out.buffer);
    for (let i = 0; i < nums.length; i++) dv.setUint32(i * 4, nums[i]);
    return out;
  }
  const full = (v, flags) => new Uint8Array([v, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255]);
  const copy = (buf, from, to) => new Uint8Array(buf.slice(from, to));

  /* ---------- the public shape ---------- */

  async function open(file) {
    let boxes;
    try { boxes = await topBoxes(file); } catch (e) { return { ok: false, why: 'unreadable' }; }
    if (boxes.some((b) => b.type === 'moof' || b.type === 'sidx'))
      return { ok: false, why: 'fragmented' };
    const ftypBox = find(boxes, 'ftyp');
    const moovBox = find(boxes, 'moov');
    if (!ftypBox || !moovBox) return { ok: false, why: 'not-mp4' };
    if (moovBox.size > 40 * 1024 * 1024) return { ok: false, why: 'huge-index' };

    const ftyp = new Uint8Array(await file.slice(ftypBox.start, ftypBox.start + ftypBox.size).arrayBuffer());
    const moovBuf = await file.slice(moovBox.start, moovBox.start + moovBox.size).arrayBuffer();
    const dv = new DataView(moovBuf);
    const top = children(dv, 8, moovBuf.byteLength);
    const mvhd = find(top, 'mvhd');
    if (!mvhd) return { ok: false, why: 'not-mp4' };
    const mvhdVer = dv.getUint8(mvhd.body);
    const movieTs = mvhdVer === 1 ? dv.getUint32(mvhd.body + 20) : dv.getUint32(mvhd.body + 12);

    const traks = [];
    for (const t of top) {
      if (t.type !== 'trak') continue;
      const p = parseTrak(dv, t);
      if (p && p.skip) continue;
      if (!p) return { ok: false, why: 'odd-index' };
      /* ONE PICTURE TRACK AND ONE SOUND TRACK. An iPhone .MOV can carry a second
         audio track (a different microphone, or the spatial mix) — the file Perry
         sent has two. Players pick one and ignore the other, so carrying both spends
         bytes on something nobody will ever hear, and an unusual pairing is one more
         thing for a player to get wrong. */
      if (traks.some((x) => x.kind === p.kind)) continue;
      p.raw = t;
      traks.push(p);
    }
    if (!traks.some((t) => t.kind === 'vide')) return { ok: false, why: 'no-video' };

    const duration = Math.max(...traks.map((t) => {
      const last = t.count ? (t.dts[t.count - 1] + t.dur[t.count - 1]) : 0;
      return last / t.timescale;
    }));
    const video = traks.find((t) => t.kind === 'vide') || null;

    /** Which samples of a track fall inside [a, b) seconds. */
    function pick(t, a, b) {
      const lo = a * t.timescale, hi = b * t.timescale;
      let first = -1, last = -1;
      for (let i = 0; i < t.count; i++) {
        const s = t.dts[i], e = t.dts[i] + t.dur[i];
        if (e <= lo) continue;
        if (s >= hi) break;
        if (first < 0) first = i;
        last = i;
      }
      return first < 0 ? null : { first, last };
    }

    /** The keyframe a cut at `a` would really begin on. */
    function snapStart(a) {
      if (!video || !video.sync) return a;
      const want = a * video.timescale;
      let best = 0;
      for (let i = 0; i < video.count; i++) {
        if (!video.sync[i]) continue;
        if (video.dts[i] <= want) best = video.dts[i]; else break;
      }
      return best / video.timescale;
    }

    /** Exactly how many bytes the finished clip will be.

        NOT AN ESTIMATE, and it matters that it is not: this number goes in front of
        somebody on the trim screen before they commit to an upload, and "roughly"
        is how you end up watching a two-minute upload fail. The sample sizes are in
        hand and the index is measured the same way the writer will build it — the
        run-length tables are counted rather than assumed, which is where an earlier
        version drifted by adding 8 bytes per SAMPLE for a table that in practice
        collapses to one entry for the whole track. */
    function indexBytes(t, r) {
      const n = r.last - r.first + 1;
      let sttsRuns = 0, cttsRuns = 0, syncs = 0, lastD = null, lastC = null;
      for (let i = r.first; i <= r.last; i++) {
        if (t.dur[i] !== lastD) { sttsRuns++; lastD = t.dur[i]; }
        if (t.cts && t.cts[i] !== lastC) { cttsRuns++; lastC = t.cts[i]; }
        if (t.sync && t.sync[i]) syncs++;
      }
      const stbl = 8 + t.stsd.size
        + (16 + 8 * sttsRuns)
        + (t.cts ? 16 + 8 * cttsRuns : 0)
        + (t.hasStss ? 16 + 4 * syncs : 0)
        + 28                       // stsc, always one entry: one sample per chunk
        + (20 + 4 * n)             // stsz
        + (16 + 4 * n);            // stco
      let other = 0;
      for (const c of kids(dv, t.minf)) if (c.type !== 'stbl') other += c.size;
      const minf = 8 + other + stbl;
      let mOther = 0;
      for (const c of kids(dv, t.mdia)) if (c.type !== 'minf') mOther += c.size;
      const mdia = 8 + mOther + minf;
      let tOther = 0;
      // `edts` is dropped by the writer, so it is not counted here either
      for (const c of kids(dv, t.raw)) if (c.type !== 'mdia' && c.type !== 'edts') tOther += c.size;
      return 8 + tOther + mdia;
    }

    function bytesFor(a, b) {
      const from = snapStart(a);
      let media = 0, moov = 8 + mvhd.size;
      for (const t of traks) {
        const r = pick(t, from, b);
        if (!r) continue;
        for (let i = r.first; i <= r.last; i++) media += t.sizes[i];
        moov += indexBytes(t, r);
      }
      return ftyp.length + moov + 8 + media;      // + the mdat header
    }

    async function trim(a, b) {
      const from = snapStart(a);
      const chosen = [];
      const perTrack = [];
      for (const t of traks) {
        const r = pick(t, from, b);
        perTrack.push(r);
        if (!r) continue;
        for (let i = r.first; i <= r.last; i++)
          chosen.push({ t, i, off: t.offs[i], size: t.sizes[i] });
      }
      if (!chosen.length) throw new Error('nothing in that selection');

      /* ORIGINAL FILE ORDER. This is what preserves the interleaving the camera
         chose; grouping by track would still play but would stall while streaming. */
      chosen.sort((x, y) => x.off - y.off);

      /* Where each sample will sit in the new mdat. The index has to be written
         before the bytes are read, because moov comes first in the output. */
      const newOff = new Map();
      let at = 0;
      for (const s of chosen) { newOff.set(s.t.kind + ':' + s.i, at); at += s.size; }
      const mdatBytes = at;

      /* Build every track's new stbl, with mdat-relative offsets for now. */
      const trakOut = [];
      let maxDur = 0;
      for (let ti = 0; ti < traks.length; ti++) {
        const t = traks[ti], r = perTrack[ti];
        if (!r) continue;
        const n = r.last - r.first + 1;
        const base = t.dts[r.first];
        const sizes = [], offsets = [], syncs = [];
        const sttsPairs = [], cttsPairs = [];
        for (let i = r.first; i <= r.last; i++) {
          sizes.push(t.sizes[i]);
          offsets.push(newOff.get(t.kind + ':' + i));
          if (t.sync && t.sync[i]) syncs.push(i - r.first + 1);
          const d = t.dur[i];
          const lastS = sttsPairs[sttsPairs.length - 1];
          if (lastS && lastS[1] === d) lastS[0]++; else sttsPairs.push([1, d]);
          if (t.cts) {
            const o = t.cts[i];
            const lastC = cttsPairs[cttsPairs.length - 1];
            if (lastC && lastC[1] === o) lastC[0]++; else cttsPairs.push([1, o]);
          }
        }
        const mediaDur = (t.dts[r.last] + t.dur[r.last]) - base;
        maxDur = Math.max(maxDur, mediaDur / t.timescale);

        const stblParts = [copy(moovBuf, t.stsd.start, t.stsd.end)];
        stblParts.push(box('stts', [full(0, 0), u32arr([sttsPairs.length]),
          u32arr(sttsPairs.flat())]));
        if (t.cts) stblParts.push(box('ctts', [full(0, 0), u32arr([cttsPairs.length]),
          u32arr(cttsPairs.flatMap(([c, o]) => [c, o >>> 0]))]));
        if (t.hasStss) stblParts.push(box('stss', [full(0, 0), u32arr([syncs.length]), u32arr(syncs)]));
        /* ONE SAMPLE PER CHUNK. It makes stco bigger — four bytes a sample — and it
           makes the mapping impossible to get wrong, which on this path is worth
           far more than the few kilobytes. */
        stblParts.push(box('stsc', [full(0, 0), u32arr([1]), u32arr([1, 1, 1])]));
        stblParts.push(box('stsz', [full(0, 0), u32arr([0, n]), u32arr(sizes)]));
        stblParts.push(box('stco', [full(0, 0), u32arr([n]), u32arr(offsets)]));
        const stbl = box('stbl', stblParts);

        /* minf keeps everything it had except the sample table. */
        const minfParts = [];
        for (const c of kids(dv, t.minf)) {
          if (c.type === 'stbl') minfParts.push(stbl);
          else minfParts.push(copy(moovBuf, c.start, c.end));
        }
        const minf = box('minf', minfParts);

        const mdhdRaw = copy(moovBuf, t.mdhd.start, t.mdhd.end);
        {
          const d = new DataView(mdhdRaw.buffer);
          if (t.mdhdVer === 1) d.setBigUint64(8 + 4 + 8 + 8 + 4, BigInt(Math.round(mediaDur)));
          else d.setUint32(8 + 4 + 4 + 4 + 4, Math.round(mediaDur));
        }
        const mdiaParts = [];
        for (const c of kids(dv, find(kids(dv, t.raw), 'mdia'))) {
          if (c.type === 'minf') mdiaParts.push(minf);
          else if (c.type === 'mdhd') mdiaParts.push(mdhdRaw);
          else mdiaParts.push(copy(moovBuf, c.start, c.end));
        }
        const mdia = box('mdia', mdiaParts);

        const movieDur = Math.round((mediaDur / t.timescale) * movieTs);
        const tkhdRaw = copy(moovBuf, t.tkhd.start, t.tkhd.end);
        {
          const d = new DataView(tkhdRaw.buffer);
          if (t.tkhdVer === 1) d.setBigUint64(8 + 4 + 8 + 8 + 4 + 4, BigInt(movieDur));
          else d.setUint32(8 + 4 + 4 + 4 + 4 + 4, movieDur);
        }
        const trakParts = [];
        for (const c of kids(dv, t.raw)) {
          /* `edts` is DROPPED. An edit list describes a timeline this file no longer
             has, and a wrong one is worse than none: it can hold a player at black
             for the length of the part that was cut away. */
          if (c.type === 'edts') continue;
          if (c.type === 'mdia') trakParts.push(mdia);
          else if (c.type === 'tkhd') trakParts.push(tkhdRaw);
          else trakParts.push(copy(moovBuf, c.start, c.end));
        }
        trakOut.push(box('trak', trakParts));
      }

      const mvhdRaw = copy(moovBuf, mvhd.start, mvhd.end);
      {
        const d = new DataView(mvhdRaw.buffer);
        const md = Math.round(maxDur * movieTs);
        if (mvhdVer === 1) d.setBigUint64(8 + 4 + 8 + 8 + 4, BigInt(md));
        else d.setUint32(8 + 4 + 4 + 4 + 4, md);
      }
      /* Only the tracks that were kept go into the new moov, so the metadata tracks
         are gone from the output entirely rather than being carried along broken. */
      const moovParts = [mvhdRaw, ...trakOut];
      let moov = box('moov', moovParts);

      /* THE OFFSETS, NOW THAT THE INDEX'S OWN SIZE IS KNOWN. Every stco entry was
         written mdat-relative; shifting them all by the header length is the last
         step and it cannot change the size of anything, because the entry count is
         already fixed. */
      const mdatStart = ftyp.length + moov.length + 8;
      shiftStco(moov, mdatStart);

      /* Read only the bytes that are being kept, in runs, so a contiguous stretch
         of the original is one read rather than one per sample. */
      const parts = [ftyp, moov, mdatHeader(mdatBytes)];
      let runStart = -1, runEnd = -1;
      for (const s of chosen) {
        if (runStart < 0) { runStart = s.off; runEnd = s.off + s.size; continue; }
        if (s.off === runEnd) { runEnd += s.size; continue; }
        parts.push(file.slice(runStart, runEnd));
        runStart = s.off; runEnd = s.off + s.size;
      }
      if (runStart >= 0) parts.push(file.slice(runStart, runEnd));

      return new Blob(parts, { type: 'video/mp4' });
    }

    function mdatHeader(n) {
      const h = new Uint8Array(8);
      new DataView(h.buffer).setUint32(0, n + 8);
      h.set(te.encode('mdat'), 4);
      return h;
    }

    /** Walk the freshly built moov and add `delta` to every stco entry. */
    function shiftStco(moovBytes, delta) {
      const d = new DataView(moovBytes.buffer, moovBytes.byteOffset, moovBytes.byteLength);
      (function walk(start, end) {
        let off = start;
        while (off + 8 <= end) {
          const size = d.getUint32(off);
          const t = type4(d, off + 4);
          if (size < 8 || off + size > end) return;
          if (t === 'stco') {
            const n = d.getUint32(off + 12);
            for (let i = 0; i < n; i++) {
              const at = off + 16 + i * 4;
              d.setUint32(at, d.getUint32(at) + delta);
            }
          } else if (CONTAINER.indexOf(t) >= 0) {
            walk(off + 8, off + size);
          }
          off += size;
        }
      })(8, moovBytes.length);
    }

    return { ok: true, duration, tracks: traks.length, hasAudio: traks.some((t) => t.kind === 'soun'),
             snapStart, bytesFor, trim };
  }

  const MySetTrim = { open };
  if (typeof window !== 'undefined') window.MySetTrim = MySetTrim;
  if (typeof module !== 'undefined' && module.exports) module.exports = MySetTrim;
})();
