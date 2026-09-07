/* A QR encoder, byte mode, error-correction level M, versions 1-10.

   Written rather than imported because the whole app has no build step and no
   dependencies beyond stripe and @netlify/blobs. Verified module-for-module
   against a reference implementation (segno) across ASCII, URLs and lengths
   spanning every version below — a QR that looks plausible but does not scan
   would be worse than none, since these get printed and stuck on tables. */

/* ---------- Galois field arithmetic for Reed-Solomon ---------- */
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

function rsGenerator(n) {
  let poly = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= mul(poly[j], 1);
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}
function rsRemainder(data, ecLen) {
  const gen = rsGenerator(ecLen);
  const res = new Array(ecLen).fill(0);
  for (const b of data) {
    const factor = b ^ res[0];
    res.shift(); res.push(0);
    for (let i = 0; i < ecLen; i++) res[i] ^= mul(gen[i + 1], factor);
  }
  return res;
}

/* ---------- version tables for level M ----------
   [total codewords, ec codewords per block, group1 blocks, group2 blocks] */
const M_TABLE = {
  1:  [26,   10, 1, 0],
  2:  [44,   16, 1, 0],
  3:  [70,   26, 1, 0],
  4:  [100,  18, 2, 0],
  5:  [134,  24, 2, 0],
  6:  [172,  16, 4, 0],
  7:  [196,  18, 4, 0],
  8:  [242,  22, 2, 2],
  9:  [292,  22, 3, 2],
  10: [346,  26, 4, 1],
};
const ALIGN = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};
const VERSION_BITS = {
  7: 0x07c94, 8: 0x085bc, 9: 0x09a99, 10: 0x0a4d3,
};

const size = (v) => v * 4 + 17;
const totalDataCodewords = (v) => {
  const [total, ecPer, g1, g2] = M_TABLE[v];
  return total - ecPer * (g1 + g2);
};

/** Smallest version at level M that fits `len` bytes. */
function pickVersion(len) {
  for (let v = 1; v <= 10; v++) {
    const cciBits = v < 10 ? 8 : 16;
    const need = 4 + cciBits + len * 8;
    if (need <= totalDataCodewords(v) * 8) return v;
  }
  return null;
}

/* ---------- bit stream ---------- */
class Bits {
  constructor() { this.arr = []; }
  push(val, n) { for (let i = n - 1; i >= 0; i--) this.arr.push((val >>> i) & 1); }
  get length() { return this.arr.length; }
}

function encodeData(bytes, version) {
  const cap = totalDataCodewords(version) * 8;
  const bits = new Bits();
  bits.push(0b0100, 4);                          // byte mode
  bits.push(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) bits.push(b, 8);
  // terminator, then pad to a byte boundary, then alternate pad bytes
  bits.push(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.arr.push(0);
  const words = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits.arr[i + j];
    words.push(b);
  }
  const need = totalDataCodewords(version);
  const PAD = [0xec, 0x11];
  for (let i = 0; words.length < need; i++) words.push(PAD[i % 2]);
  return words;
}

/** Split into blocks, add ECC, interleave — the order the matrix wants. */
function interleave(words, version) {
  const [total, ecPer, g1, g2] = M_TABLE[version];
  const blocks = g1 + g2;
  const dataTotal = totalDataCodewords(version);
  const shortLen = Math.floor(dataTotal / blocks);
  const dataBlocks = [], ecBlocks = [];
  let at = 0;
  for (let i = 0; i < blocks; i++) {
    const len = shortLen + (i >= g1 ? 1 : 0);
    const d = words.slice(at, at + len); at += len;
    dataBlocks.push(d);
    ecBlocks.push(rsRemainder(d, ecPer));
  }
  const out = [];
  const maxData = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++)
    for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecPer; i++)
    for (const b of ecBlocks) out.push(b[i]);
  return out;
}

/* ---------- matrix ---------- */
function blankMatrix(version) {
  const n = size(version);
  const m = Array.from({ length: n }, () => new Array(n).fill(null));
  const put = (r, c, v) => { if (r >= 0 && r < n && c >= 0 && c < n) m[r][c] = v; };

  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      if (r0 + r < 0 || r0 + r >= n || c0 + c < 0 || c0 + c >= n) continue;
      const inRing = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                     (c >= 0 && c <= 6 && (r === 0 || r === 6));
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      put(r0 + r, c0 + c, inRing || inCore ? 1 : 0);
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);

  for (let i = 8; i < n - 8; i++) {           // timing patterns
    const v = i % 2 === 0 ? 1 : 0;
    put(6, i, v); put(i, 6, v);
  }

  const centres = ALIGN[version];
  for (const r of centres) for (const c of centres) {
    if ((r <= 8 && c <= 8) || (r <= 8 && c >= n - 9) || (r >= n - 9 && c <= 8)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const ring = Math.max(Math.abs(dr), Math.abs(dc));
      put(r + dr, c + dc, ring === 1 ? 0 : 1);
    }
  }

  put(n - 8, 8, 1);                            // the always-dark module

  // reserve format areas
  for (let i = 0; i <= 8; i++) { if (m[8][i] === null) put(8, i, 0); if (m[i][8] === null) put(i, 8, 0); }
  for (let i = 0; i < 8; i++) { put(8, n - 1 - i, 0); put(n - 1 - i, 8, 0); }
  if (version >= 7) {
    for (let i = 0; i < 18; i++) { put(Math.floor(i / 3), n - 11 + (i % 3), 0);
                                   put(n - 11 + (i % 3), Math.floor(i / 3), 0); }
  }
  return m;
}

function placeData(m, words, version) {
  const n = size(version);
  const bits = [];
  for (const w of words) for (let i = 7; i >= 0; i--) bits.push((w >> i) & 1);
  let idx = 0, up = true;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;                       // skip the vertical timing column
    for (let k = 0; k < n; k++) {
      const row = up ? n - 1 - k : k;
      for (const c of [col, col - 1]) {
        if (m[row][c] !== null) continue;
        m[row][c] = idx < bits.length ? bits[idx] : 0;
        idx++;
      }
    }
    up = !up;
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** Which modules are function patterns (never masked). */
function reservedMask(version) {
  const n = size(version);
  const res = Array.from({ length: n }, () => new Array(n).fill(false));
  const mark = (r, c) => { if (r >= 0 && r < n && c >= 0 && c < n) res[r][c] = true; };
  const finder = (r0, c0) => { for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) mark(r0 + r, c0 + c); };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let i = 0; i < n; i++) { mark(6, i); mark(i, 6); }
  for (const r of ALIGN[version]) for (const c of ALIGN[version]) {
    if ((r <= 8 && c <= 8) || (r <= 8 && c >= n - 9) || (r >= n - 9 && c <= 8)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) mark(r + dr, c + dc);
  }
  for (let i = 0; i <= 8; i++) { mark(8, i); mark(i, 8); }
  for (let i = 0; i < 8; i++) { mark(8, n - 1 - i); mark(n - 1 - i, 8); }
  if (version >= 7) for (let i = 0; i < 18; i++) {
    mark(Math.floor(i / 3), n - 11 + (i % 3)); mark(n - 11 + (i % 3), Math.floor(i / 3));
  }
  return res;
}

/* Mask penalty, per the spec's four rules.

   My first attempt matched a reference implementation's chosen mask only 31% of
   the time, and occasionally landed on one a scanner could not read. Rule 3 was
   the main culprit: it is not a fixed 11-module template, it is the 1:1:3:1:1
   ratio at ANY scale with a four-wide light margin, which needs a run history. */
const N1 = 3, N2 = 3, N3 = 40, N4 = 10;

function addHistory(runLen, hist, size) {
  if (hist[0] === 0) runLen += size;            // the light border before the first run
  hist.copyWithin(1, 0, hist.length - 1);
  hist[0] = runLen;
}
function countPatterns(hist) {
  const n = hist[1];
  const core = n > 0 && hist[2] === n && hist[3] === n * 3 && hist[4] === n && hist[5] === n;
  return (core && hist[0] >= n * 4 && hist[6] >= n ? 1 : 0)
       + (core && hist[6] >= n * 4 && hist[0] >= n ? 1 : 0);
}
function terminateAndCount(runColor, runLen, hist, size) {
  if (runColor) { addHistory(runLen, hist, size); runLen = 0; }
  runLen += size;                                // the light border after the last run
  addHistory(runLen, hist, size);
  return countPatterns(hist);
}

function penalty(m) {
  const n = m.length;
  let score = 0;

  // rules 1 and 3, by row then by column
  for (const byRow of [true, false]) {
    for (let a = 0; a < n; a++) {
      let runColor = 0, runLen = 0;
      const hist = new Int32Array(7);
      for (let b = 0; b < n; b++) {
        const v = byRow ? m[a][b] : m[b][a];
        if (v === runColor) {
          runLen++;
          if (runLen === 5) score += N1; else if (runLen > 5) score++;
        } else {
          addHistory(runLen, hist, n);
          if (!runColor) score += countPatterns(hist) * N3;
          runColor = v; runLen = 1;
        }
      }
      score += terminateAndCount(runColor, runLen, hist, n) * N3;
    }
  }

  // rule 2: 2x2 blocks of one colour
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
    const v = m[r][c];
    if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += N2;
  }

  // rule 4: how far the dark/light balance strays from even
  let dark = 0;
  for (const row of m) for (const v of row) dark += v;
  const total = n * n;
  const k = Math.floor((Math.abs(dark * 20 - total * 10) + total - 1) / total) - 1;
  score += k * N4;
  return score;
}

const FORMAT_BITS = (ecBits, mask) => {
  let data = (ecBits << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = ((rem << 1) ^ ((rem >> 9) * 0x537)) & 0x3ff;
  return ((data << 10) | rem) ^ 0x5412;
};

function applyFormat(m, version, mask) {
  const n = m.length;
  const bits = FORMAT_BITS(0b00, mask);        // 00 = level M
  /* The 15 format bits go out MOST significant first. Reading them LSB-first
     placed the whole word backwards — the finders and data were fine, so the
     codes looked plausible and scanned as nothing at all. */
  const get = (i) => (bits >> (14 - i)) & 1;
  for (let i = 0; i <= 5; i++) m[8][i] = get(i);
  m[8][7] = get(6); m[8][8] = get(7); m[7][8] = get(8);
  for (let i = 9; i <= 14; i++) m[14 - i][8] = get(i);
  /* THE SECOND COPY IS 7 + 8, NOT 8 + 7. Bits 0-6 run up the left edge from the
     bottom; bit 7 begins the run along the top right. The module between them —
     (n-8, 8) — is the "dark module", which is always black and is not a format
     bit at all. Writing bit 7 there instead cost the code its dark module and
     shifted the whole right-hand run by one: the top-left copy was still correct,
     so most readers fell back to it and the codes scanned anyway, which is how
     this survived a module-for-module review. One URL in a forty-length sweep did
     not scan at all. */
  for (let i = 0; i <= 6; i++) m[n - 1 - i][8] = get(i);
  m[n - 8][8] = 1;
  for (let i = 7; i <= 14; i++) m[8][n - 15 + i] = get(i);
  if (version >= 7) {
    const vb = VERSION_BITS[version];
    for (let i = 0; i < 18; i++) {
      const b = (vb >> i) & 1;
      m[Math.floor(i / 3)][n - 11 + (i % 3)] = b;
      m[n - 11 + (i % 3)][Math.floor(i / 3)] = b;
    }
  }
}

/** The finished module grid for `text`, or null if it will not fit. */
export function qrMatrix(text, forceMask = null) {
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  const version = pickVersion(bytes.length);
  if (!version) return null;

  const words = interleave(encodeData(bytes, version), version);
  const reserved = reservedMask(version);

  let best = null, bestScore = Infinity;
  const masks = forceMask === null ? [0,1,2,3,4,5,6,7] : [forceMask];
  for (const mask of masks) {
    const m = blankMatrix(version);
    placeData(m, words, version);
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m.length; c++)
      if (!reserved[r][c] && MASKS[mask](r, c)) m[r][c] ^= 1;
    applyFormat(m, version, mask);
    const s = penalty(m);
    if (s < bestScore) { bestScore = s; best = m; }
  }
  return best;
}

/* THE MYSET MARK, IN THE MIDDLE.

   A QR code at level M can lose about 15% of its modules and still read, because
   Reed-Solomon rebuilds what is missing — that is the whole point of the error
   correction, and it is why a logo in the middle is normal rather than a trick.
   The badge here covers a square 17% of the code’s width, which is under 3% of the
   modules: comfortably inside the budget, with the rest of it left for the real
   world (a crease in the paper, a thumb, bad light on a bar table).

   The modules under the badge are CLEARED rather than drawn over. A scanner that
   sees clean white behind the mark finds nothing ambiguous there; leaving black
   modules half-covered gives it edges that belong to neither the code nor the
   logo. */
const LOGO_FRACTION = 0.17;

/** The square of modules the badge sits on: [first, count], centred and odd. */
function logoBox(n) {
  let count = Math.round(n * LOGO_FRACTION);
  if (count % 2 !== n % 2) count++;          // keep it centred on whole modules
  return [(n - count) / 2, count];
}

/** The badge itself, in module units, drawn at `scale` with the code's quiet zone. */
function logoSvg(first, count, quiet, scale) {
  const x = (first + quiet) * scale, w = count * scale;
  const pad = w * 0.085;                     // white breathing room around the tile
  const tx = x + pad, tw = w - pad * 2;
  const bar = (bx, by, bh) =>
    `<rect x="${(tx + tw * bx).toFixed(2)}" y="${(tx + tw * by).toFixed(2)}" `
    + `width="${(tw * 0.11).toFixed(2)}" height="${(tw * bh).toFixed(2)}" `
    + `rx="${(tw * 0.055).toFixed(2)}" fill="#fff"/>`;
  return `<rect x="${x}" y="${x}" width="${w}" height="${w}" rx="${(w * 0.22).toFixed(2)}" fill="#FFFFFF"/>`
    + `<rect x="${tx.toFixed(2)}" y="${tx.toFixed(2)}" width="${tw.toFixed(2)}" height="${tw.toFixed(2)}" `
    + `rx="${(tw * 0.24).toFixed(2)}" fill="url(#msg)"/>`
    + bar(0.26, 0.42, 0.32) + bar(0.44, 0.26, 0.48) + bar(0.62, 0.52, 0.22);
}

/** A standalone SVG. `quiet` is the mandatory 4-module light border.
    `logo:false` gives the plain code back, for anywhere the mark would be too
    small to read — below about 120px across it is a smudge, not a logo. */
export function qrSvg(text, { scale = 8, quiet = 4, dark = '#000000', light = '#FFFFFF', logo = true } = {}) {
  const m = qrMatrix(text);
  if (!m) return null;
  const n = m.length, dim = (n + quiet * 2) * scale;
  const [first, count] = logoBox(n);
  const last = first + count - 1;
  const under = (r, c) => logo && r >= first && r <= last && c >= first && c <= last;
  let path = '';
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!m[r][c] || under(r, c)) { c++; continue; }
      let w = 1;
      while (c + w < n && m[r][c + w] && !under(r, c + w)) w++;
      path += `M${(c + quiet) * scale} ${(r + quiet) * scale}h${w * scale}v${scale}h-${w * scale}z`;
      c += w;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" aria-label="QR code">`
    + (logo ? `<defs><linearGradient id="msg" x1="0" y1="0" x2="1" y2="1">`
            + `<stop offset="0" stop-color="#FF375F"/><stop offset="1" stop-color="#FF6B45"/>`
            + `</linearGradient></defs>` : '')
    + `<rect width="${dim}" height="${dim}" fill="${light}"/>`
    + `<path d="${path}" fill="${dark}"/>`
    + (logo ? logoSvg(first, count, quiet, scale) : '') + `</svg>`;
}
