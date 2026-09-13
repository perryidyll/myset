import { casDoc, readDoc, sha } from './_lib.mjs';

/* WHAT FANS ASK THE SHOP FOR — "Make a request" on the shop page (the founder,
   2026-09-13). A fan who wants something that is not on the table — a hoodie in
   XL, a tote, the poster from last night — says so in a sentence, and the sentence
   lands in the owner's Studio under the Merch store. That is the whole feature: a
   demand signal, in the fan's own words, before anything is printed.

   What a request is NOT: a message thread, an order, or a promise. It carries no
   way to reach the fan back (the audience never signs in, 9g; a device id is all a
   request holds and it never leaves the server, 0bu). The owner reads it, makes
   the thing or does not, and marks it done. A request the owner has acted on is
   kept and dimmed rather than deleted, so a "did anyone ask for this?" a month on
   still has its answer.

   Limits are enforced HERE, inside the CAS, never only on the page (15k): three a
   day per device and a soft per-network ceiling, the community feed's shape. The
   list keeps the newest hundred; older ones fall off the bottom.

   Keys are per owner — `wishes_<aid>` / `wishes_v_<vid>` — and nothing here is
   global (0a). */

const KEY = (owner) => `wishes_${owner}`;
export const MAX_WISHES = 100;           // kept per owner; the oldest fall off
export const MAX_WISH = 200;             // characters in the request itself
export const MAX_WISH_NAME = 30;
export const WISH_DAY = 24 * 3600e3;
export const WISHES_PER_DEVICE_PER_DAY = 3;
export const WISHES_PER_NETWORK_PER_DAY = 100;

const empty = () => ({ v: 1, list: [], recent: [], n: 0 });
const h10 = (v) => sha(String(v || '')).slice(0, 10);
const clean = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
export const newWishId = () => 'w' + Math.random().toString(36).slice(2, 10).padEnd(8, '0').slice(0, 8);

export async function readWishes(owner) {
  const { data } = await readDoc(KEY(owner), null);
  const d = { ...empty(), ...(data || {}) };
  d.list = Array.isArray(d.list) ? d.list : [];
  d.recent = Array.isArray(d.recent) ? d.recent : [];
  return d;
}

/** Add a request. Returns { ok, error, id }. `item` is the id of an item on the
 *  table when the fan asked from inside a product sheet (a size, a colour), else ''. */
export async function addWish(owner, { fan, ip, name, text, item }) {
  if (!fan) return { ok: false, error: 'no device' };
  const body = clean(text, MAX_WISH);
  if (body.length < 2) return { ok: false, error: 'Say what you’d like — a word or two is enough.' };
  const id = newWishId(), now = Date.now();
  const f = h10(fan), net = h10(owner + '|' + (ip || ''));
  let refused = null;
  await casDoc(KEY(owner), empty, (d) => {
    d.list = Array.isArray(d.list) ? d.list : [];
    d.recent = (Array.isArray(d.recent) ? d.recent : []).filter((r) => r && now - r.at < WISH_DAY);
    if (d.recent.filter((r) => r.f === f).length >= WISHES_PER_DEVICE_PER_DAY) { refused = 'That’s three requests today from this phone — come back tomorrow.'; return false; }
    if (d.recent.filter((r) => r.n === net).length >= WISHES_PER_NETWORK_PER_DAY) { refused = 'This network has asked for a lot today. Try again tomorrow.'; return false; }
    d.recent.push({ f, n: net, at: now });
    if (d.recent.length > 300) d.recent = d.recent.slice(-300);
    d.list.push({ id, f, name: clean(name, MAX_WISH_NAME), text: body, item: /^m[a-z0-9]{6}$/.test(String(item || '')) ? String(item) : '', at: now, done: false });
    d.n = (d.n || 0) + 1;
    if (d.list.length > MAX_WISHES) d.list = d.list.slice(-MAX_WISHES);
    return true;
  });
  return refused ? { ok: false, error: refused } : { ok: true, id };
}

/** The owner marks one done (made it, or won't) — or takes that back. */
export async function setWishDone(owner, id, done) {
  let err = null;
  await casDoc(KEY(owner), empty, (d) => {
    const w = (d.list || []).find((x) => x && x.id === id);
    if (!w) { err = 'That request is gone.'; return false; }
    w.done = done !== false;
    if (w.done) w.doneAt = Date.now(); else delete w.doneAt;
    return true;
  });
  return err ? { ok: false, error: err } : { ok: true };
}

/** What the owner's Studio gets: newest first, open ones before done ones, never the
 *  device hash. `itemTitle` is looked up from the merch list the caller already holds. */
export function shapeWishes(d, merch = []) {
  const title = (id) => { const m = (merch || []).find((x) => x && x.id === id); return m ? String(m.title || '') : ''; };
  return (d.list || []).filter(Boolean).slice().reverse()
    .sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1))
    .map((w) => ({ id: w.id, name: w.name || '', text: w.text || '', item: w.item || '', itemTitle: w.item ? title(w.item) : '', at: w.at || 0, done: !!w.done, doneAt: w.doneAt || 0 }));
}
