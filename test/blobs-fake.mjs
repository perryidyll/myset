/* An in-memory stand-in for @netlify/blobs, with the ONE thing the local
   `netlify dev` sandbox does not implement: etags. Without them casDoc's
   conditional write can never succeed after the first, and every second call
   returns "busy". This is test scaffolding only — nothing imports it in prod. */
import { createHash } from 'node:crypto';
import { appendFileSync } from 'node:fs';
const mem = new Map();                       // key -> { body: string|Buffer, etag, metadata }

/* EVERY KEY THE SUITE EVER WROTE. test/run.sh names a file in MYSET_KEYLOG; each
   test process appends the keys it wrote as it exits, and the last step of the run
   (test/keyfamilies.mjs) reads them all and asks one question of each: does the
   off-site copy take this kind of document, or does somebody say why not. A new
   kind of document nobody classified fails the suite — that is the point. */
const wrote = new Set();
if (process.env.MYSET_KEYLOG) process.on('exit', () => {
  try { if (wrote.size) appendFileSync(process.env.MYSET_KEYLOG, [...wrote].join('\n') + '\n'); } catch {}
});
const tag = (b) => '"' + createHash('sha1').update(b).digest('hex').slice(0, 16) + '"';

export const __reset = () => { mem.clear(); failRe = null; };
export const __dump = () => new Map(mem);

/* Make writes to matching keys report success-without-sticking — the acked-but-lost
   write INVARIANT 4 exists for, and the only way to test a recovery path that is
   supposed to survive one. Netlify Blobs really does this under concurrency. */
let failRe = null;
export const __failWrites = (re) => { failRe = re; };

/* An operation log, so a test can count what an endpoint actually costs instead of
   reasoning about it. Reads on the hot path are the thing this project keeps getting
   wrong, so they should be countable. */
let ops = null;
export const __opsStart = () => { ops = []; return ops; };
export const __opsStop = () => { const o = ops || []; ops = null; return o; };
const note = (kind, key) => { if (ops) ops.push(kind + ' ' + String(key)); };

/* Make every read take this long, so a test can interleave a write with a read
   that is already in flight — the shape of "a vote landed while the board was
   being rendered", which is invisible when reads answer in the same tick. */
let readDelay = 0, slowRe = null;
/* `re` narrows it to matching keys, so one caller can be held on its fan file after
   it has read the show at full speed — the cast that set off before Play. */
export const __slowReads = (ms, re = null) => { readDelay = Math.max(0, Number(ms) || 0); slowRe = re; };

/* Make reads of matching keys THROW, the way the real client does when the store
   errors or throttles — so a test can prove a failed read is treated as a failure
   and never as "this document is empty" (decision 0142). `hang: true` makes them
   never answer instead, which is what a throttled read looks like from outside. */
let failReadRe = null, failReadHang = false;
export const __failReads = (re, { hang = false } = {}) => { failReadRe = re; failReadHang = !!hang; };

/* A TRAFFIC JAM. `__slowReads` waits BEFORE the lookup, so a read and the write that
   follows it are still one atomic step and no test ever sees two writers race. With
   `__latency` on, a read takes time and a write is judged against the etag when it
   LANDS, after its own delay — how a real conditional PUT behaves, and the only way
   casDoc's retry loop and "busy" run under contention. (A read answers with what is
   there as it returns: the kind end of the truth, and the one the 2026-10-02 audit's
   numbers were measured with.)
   Times are base + per-megabyte, with jitter from `rand` (pass a seeded one and a run
   repeats exactly). `stats` counts what the store was asked to do. Used by
   tools/roomsim.mjs on a virtual clock; every other test leaves it off. */
let lat = null;
export const stats = { calls: 0, gets: 0, sets: 0, setFail: 0, bytesR: 0, bytesW: 0 };
export const __latency = (cfg) => {
  lat = cfg ? { r: 42, rPerMB: 20, w: 80, wPerMB: 40, jitter: 0.15, rand: Math.random, ...cfg } : null;
  Object.assign(stats, { calls: 0, gets: 0, sets: 0, setFail: 0, bytesR: 0, bytesW: 0 });
};
const pause = (base, perMB, bytes) =>
  new Promise((r) => setTimeout(r, Math.max(0, Math.round(base + perMB * bytes / 1e6 + (lat.rand() * 2 - 1) * lat.jitter * base))));

export function getStore() {
  return {
    async getWithMetadata(key, opts = {}) {
      stats.calls++;
      note('get', key);
      if (failReadRe && failReadRe.test(key)) {
        if (failReadHang) await new Promise(() => {});
        throw new Error('BlobsInternalError: Netlify Blobs has generated an internal error (500 status code)');
      }
      if (readDelay && (!slowRe || slowRe.test(key))) await new Promise((r) => setTimeout(r, readDelay));
      let e = mem.get(key);
      /* A CONDITIONAL READ (decision 0152): the caller names the etag it holds and, if it
         is still the document's, the store answers 304 — `data: null`, no body crosses —
         exactly as Netlify's client returns it. Noted as `304 <key>` beside the read. */
      const same = (x) => !!(x && opts.etag && opts.etag === x.etag);
      if (lat) { await pause(lat.r, lat.rPerMB, e && !same(e) ? e.body.length : 0); e = mem.get(key); stats.gets++; stats.bytesR += e && !same(e) ? e.body.length : 0; }
      if (!e) return null;
      if (same(e)) { note('304', key); return { data: null, etag: e.etag, metadata: e.metadata || {} }; }
      let data = e.body;
      if (opts.type === 'json') { try { data = JSON.parse(e.body); } catch { return null; } }
      else if (opts.type === 'arrayBuffer') data = Buffer.from(e.body);
      return { data, etag: e.etag, metadata: e.metadata || {} };
    },
    async get(key, opts = {}) {
      const r = await this.getWithMetadata(key, opts);
      return r ? r.data : null;
    },
    async set(key, body, opts = {}) {
      stats.calls++;
      note('set', key);
      if (failRe && failRe.test(key)) return { modified: false };   // acked, not stuck
      if (lat) { await pause(lat.w, lat.wPerMB, body.length); stats.sets++; }
      const cur = mem.get(key);
      if ((opts.onlyIfNew && cur) || (opts.onlyIfMatch && (!cur || cur.etag !== opts.onlyIfMatch))) {
        if (lat) stats.setFail++;
        return { modified: false };
      }
      const buf = typeof body === 'string' ? body : Buffer.from(body);
      if (lat) stats.bytesW += buf.length;
      mem.set(key, { body: buf, etag: tag(buf), metadata: opts.metadata || {} });
      wrote.add(String(key));
      return { modified: true };
    },
    async getMetadata(key) {
      note('meta', key);
      const e = mem.get(key);
      return e ? { etag: e.etag, metadata: e.metadata || {} } : null;
    },
    async delete(key) { note('del', key); mem.delete(key); },
    async list() { return { blobs: [...mem.keys()].map((key) => ({ key })) }; },
  };
}
