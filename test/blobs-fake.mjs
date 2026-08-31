/* An in-memory stand-in for @netlify/blobs, with the ONE thing the local
   `netlify dev` sandbox does not implement: etags. Without them casDoc's
   conditional write can never succeed after the first, and every second call
   returns "busy". This is test scaffolding only — nothing imports it in prod. */
import { createHash } from 'node:crypto';
const mem = new Map();                       // key -> { body: string|Buffer, etag, metadata }
const tag = (b) => '"' + createHash('sha1').update(b).digest('hex').slice(0, 16) + '"';

export const __reset = () => mem.clear();
export const __dump = () => new Map(mem);

export function getStore() {
  return {
    async getWithMetadata(key, opts = {}) {
      const e = mem.get(key);
      if (!e) return null;
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
      const cur = mem.get(key);
      if (opts.onlyIfNew && cur) return { modified: false };
      if (opts.onlyIfMatch && (!cur || cur.etag !== opts.onlyIfMatch)) return { modified: false };
      const buf = typeof body === 'string' ? body : Buffer.from(body);
      mem.set(key, { body: buf, etag: tag(buf), metadata: opts.metadata || {} });
      return { modified: true };
    },
    async delete(key) { mem.delete(key); },
    async list() { return { blobs: [...mem.keys()].map((key) => ({ key })) }; },
  };
}
