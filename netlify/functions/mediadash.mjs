import { json, bad, readDoc, casDoc, store, requireArtist, DEFAULT_ARTIST } from './_lib.mjs';
import { guard } from './_errlog.mjs';

/* /api/mediadash — the Instagram dashboard's numbers, at myset.vip/mediadash (decision 0092).

   The numbers are NOT pulled here. The content engine on the founder's Mac pulls them from
   Instagram four times a day (it already holds the token and the plan: post names, formats,
   music, the queue) and PUSHES one JSON here with `x-mediadash-key`. This function stores
   it, serves it, and keeps the boosts the founder logs from the page itself. Three keys, all
   computable, never listed (INVARIANT 1):
     mediadash/data          the whole dashboard, as the Mac last pushed it
     mediadash/boosts        boosts logged from the page, keyed by boostId (latest row wins)
     mediadash/thumb/<id>    a small JPEG per live post, pushed once, served with a day's cache

   Reads are public: the page shows what @myset.vip's own Instagram already shows anyone.
   Writes are two doors: the push key (the Mac) and the founder's own sign-in or recovery
   code (a boost from the page) — never another artist's token. */

const K = { data: 'mediadash/data', boosts: 'mediadash/boosts', thumb: (id) => `mediadash/thumb/${id}` };
const ID = /^[A-Za-z0-9][\w.-]{0,140}$/;
const cleanId = (v) => (ID.test(String(v || '')) ? String(v) : null);
const BOOST_FIELDS = ['spend', 'days', 'views', 'reach', 'interactions', 'profile_visits', 'follows', 'link_clicks', 'likes', 'comments', 'saves', 'shares'];
const MAX_DATA = 4 * 1024 * 1024;        // the pushed JSON — a year of pulls is well under this
const MAX_THUMB = 120 * 1024;            // one small JPEG
const emptyBoosts = () => ({ v: 1, rows: {} });

const sameKey = (given, want) => {
  if (!given || !want || given.length !== want.length) return false;
  let d = 0;
  for (let i = 0; i < given.length; i++) d |= given.charCodeAt(i) ^ want.charCodeAt(i);
  return d === 0;
};
const isPusher = (req) => sameKey(req.headers.get('x-mediadash-key') || '', process.env.MEDIADASH_KEY || '');
const isFounder = async (req) => { const me = await requireArtist(req); return !!(me && me.aid === DEFAULT_ARTIST); };

/** One boost row from the page: the founder's numbers off Instagram's boost sheet. */
function boostRow(o, posts) {
  const id = cleanId(o.id);
  if (!id || !posts.some((p) => p.id === id)) throw new Error('not a live post');
  if (o.removed) { const boostId = cleanId(o.boostId); if (!boostId) throw new Error('boostId missing'); return { kind: 'boost', boostId, id, at: new Date().toISOString(), removed: true }; }
  const row = { kind: 'boost', boostId: cleanId(o.boostId) || `${id}#${Date.now().toString(36)}`, id, at: new Date().toISOString(),
    start: /^\d{4}-\d{2}-\d{2}$/.test(String(o.start || '')) ? o.start : new Date().toISOString().slice(0, 10),
    currency: 'USD', note: String(o.note || '').slice(0, 300), source: 'site' };
  for (const k of BOOST_FIELDS) { const v = o[k]; row[k] = v === '' || v == null ? null : Number(v); if (row[k] != null && !Number.isFinite(row[k])) throw new Error(`${k} is not a number`); }
  if (row.spend == null) throw new Error('spend is required');
  return row;
}

const main = async (req) => {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const thumb = url.searchParams.get('thumb');
    if (thumb) {
      const id = cleanId(thumb);
      if (!id) return bad('bad id', 404);
      let buf = null;
      try { buf = await store().get(K.thumb(id), { type: 'arrayBuffer' }); } catch {}
      if (!buf) return bad('no thumb', 404);
      return new Response(buf, { status: 200, headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=86400' } });
    }
    const [{ data }, { data: b }] = await Promise.all([readDoc(K.data, null), readDoc(K.boosts, emptyBoosts())]);
    if (!data) return json({ ok: true, empty: true, posts: [], boosts: [], days: [], account: [], upcoming: [], pulls: 0 }, 200);
    const site = Object.values(b.rows || {}).filter((r) => !r.removed);
    const seen = new Set(site.map((r) => r.boostId));
    const boosts = [...(data.boosts || []).filter((r) => !seen.has(r.boostId)), ...site].sort((x, y) => String(x.start || x.at).localeCompare(String(y.start || y.at)));
    const posts = (data.posts || []).map((p) => ({ ...p, boosts: boosts.filter((r) => r.id === p.id) }));
    return new Response(JSON.stringify({ ...data, posts, boosts, siteBoosts: Object.values(b.rows || {}) }),
      { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }

  if (req.method !== 'POST') return bad('GET or POST', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }

  if (isPusher(req)) {
    const out = { ok: true };
    if (body.data && typeof body.data === 'object') {
      const s = JSON.stringify({ ...body.data, pushedAt: new Date().toISOString() });
      if (s.length > MAX_DATA) return bad('data too large', 413);
      await store().set(K.data, s);
      out.data = s.length;
    }
    if (body.thumbs && typeof body.thumbs === 'object') {
      out.thumbs = [];
      for (const [id0, b64] of Object.entries(body.thumbs)) {
        const id = cleanId(id0);
        if (!id || typeof b64 !== 'string') continue;
        const buf = Buffer.from(b64, 'base64');
        if (!buf.length || buf.length > MAX_THUMB) continue;
        await store().set(K.thumb(id), buf);
        out.thumbs.push(id);
      }
    }
    return json(out);
  }

  if (!(await isFounder(req))) return bad('not allowed', 401);
  if (!body.boost || typeof body.boost !== 'object') return bad('nothing to save');
  const { data } = await readDoc(K.data, null);
  let row;
  try { row = boostRow(body.boost, (data && data.posts) || []); } catch (e) { return bad(e.message); }
  await casDoc(K.boosts, emptyBoosts, (d) => { d.rows = d.rows || {}; d.rows[row.boostId] = row; });
  return json({ ok: true, boost: row });
};
export default guard('mediadash', main);
