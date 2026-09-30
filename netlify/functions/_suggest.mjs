import { readDoc, casDoc } from './_lib.mjs';

/* SUGGESTIONS AND FEEDBACK FROM A STUDIO (decision 0127). A venue asked for a way to
   tell MySet what it wants; there was none (the room's star rating is about a night,
   not the product). One global document, the newest 300 kept, read by the Sheet's
   Suggestions tab; the founder's phone hears each one as it lands. Nothing but what
   they typed and who sent it. */
const KEY = 'suggest';
export const SUGGEST_LEN = 1000, SUGGEST_KEPT = 300, SUGGEST_PER_DAY = 10;
const clean = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, n);

export async function readSuggestions() {
  const { data } = await readDoc(KEY, null);
  return (data && Array.isArray(data.list)) ? data.list : [];
}

/** `{ok:true}`, or `{ok:false, error, status}` for an empty note or the day's limit. */
export async function addSuggestion({ from, id, name, plan, text }, now = Date.now()) {
  const t = clean(text, SUGGEST_LEN);
  if (t.length < 3) return { ok: false, error: 'Write a few words first.', status: 400 };
  let over = false;
  await casDoc(KEY, () => ({ v: 1, list: [] }), (d) => {
    d.list ||= [];
    const today = d.list.filter((x) => x.id === id && now - x.at < 86400e3).length;
    if (today >= SUGGEST_PER_DAY) { over = true; return false; }
    d.list.push({ at: now, from: from === 'venue' ? 'venue' : 'artist', id: clean(id, 40), name: clean(name, 70), plan: clean(plan, 12), text: t });
    d.list = d.list.slice(-SUGGEST_KEPT);
    return true;
  });
  if (over) return { ok: false, error: 'That’s ten today — thank you! Send more tomorrow.', status: 429 };
  try {
    const { notify } = await import('./_push.mjs');
    const { DEFAULT_ARTIST } = await import('./_lib.mjs');
    await Promise.race([notify(DEFAULT_ARTIST, { title: `A suggestion from ${clean(name, 40) || 'a venue'}`, body: t.slice(0, 160), url: '/studio', tag: 'suggest' }, { owner: true }),
                        new Promise((r) => setTimeout(r, 1500))]);
  } catch { /* kept; the push is a courtesy */ }
  return { ok: true };
}
