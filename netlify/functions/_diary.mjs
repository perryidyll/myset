import { readDoc, KEY, getShow, json, bad } from './_lib.mjs';
import { casKeep } from './_versions.mjs';
import { planForArtist, diaryCap } from './_plan.mjs';
import { decodeDataUrl, putImage, dropImage } from './_img.mjs';

/* ARTIST DIARIES (decision 0085) — the artist's own stories, on their own page.

   A diary is a short list of PAGES. Each page is a written story: how a song came
   to be, what a night was like, a moment worth keeping — tied to one song from
   the library, or to nothing at all. They live at `/<slug>/diary`, and the artist
   page wears a Diary door only when there is at least one page to read (the
   third rule: never a button to a shrug).

   One document per artist — `diary_<aid>` — holding the whole list, read once by
   the public page and once by the Studio. Never on the audience poll. Every plan
   has the feature; what the plan buys is HOW MANY pages the diary holds — 3 on
   Hobbyist, 10 on Bar Star, 40 on Rock Star (`diary` in PLANS, read through
   diaryCap). Enforced against GROWTH, never size (INVARIANT 0s): a diary written
   on Rock Star keeps every page after a downgrade and only the next add is
   refused. Editing an existing page is never gated.

   A page names its song by id and nothing else: title and artist are resolved
   from the library on every read, so a rename in the library shows up here and a
   song that was removed simply leaves the page standing on its own. The lyrics
   the public page can open beside a story are the same `/api/lyrics` read the
   vote page makes — nothing new is served, and nothing is served for a song that
   is not in the library. No audio, no embeds in v1. */

export const DIARY_ID = /^d[a-z0-9]{6}$/;
export const MAX_TITLE = 80;
export const MAX_WHEN = 40;          // "Summer 2019", "The night we met", a date — their words
export const MAX_BODY = 4000;        // about 700 words; a story, not a book
const mintId = () => 'd' + Math.random().toString(36).slice(2, 8).padEnd(6, '0').slice(0, 6);

const empty = () => ({ v: 1, pages: [] });
const clean = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
/* The body keeps its paragraphs (blank lines) and nothing else: no tabs, no runs
   of spaces, never more than one empty line between paragraphs. */
const cleanBody = (v) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ')
  .replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_BODY);

export function normPage(p) {
  if (!p || typeof p !== 'object') return null;
  const row = {
    id: String(p.id || ''),
    title: clean(p.title, MAX_TITLE),
    when: clean(p.when, MAX_WHEN),
    body: cleanBody(p.body),
    songId: String(p.songId || '').slice(0, 60),
    /* The cover: a served picture of ours or nothing — never a URL typed in. */
    img: /^\/api\/img\?/.test(String(p.img || '')) ? String(p.img).slice(0, 120) : '',
    on: p.on !== false,
    at: Number(p.at) || 0,
    updatedAt: Number(p.updatedAt) || 0,
  };
  return DIARY_ID.test(row.id) && row.title && row.body ? row : null;
}
const norm = (d) => {
  const out = empty();
  out.pages = (Array.isArray(d && d.pages) ? d.pages : []).map(normPage).filter(Boolean);
  return out;
};

export async function readDiary(aid) {
  const { data } = await readDoc(KEY.diary(aid), null);
  return norm(data);
}
/* casKeep: the diary as it was is kept as a version before every change (0067) —
   a story is the one thing on MySet that cannot be re-derived from anywhere. */
export const mutateDiary = (aid, fn) =>
  casKeep(KEY.diary(aid), empty, (d) => {
    const nd = norm(d);
    Object.keys(d || {}).forEach((k) => delete d[k]);
    Object.assign(d, nd);
    const r = fn(d);
    if (r === false) return false;
    const after = norm(d);
    Object.keys(d).forEach((k) => delete d[k]);
    Object.assign(d, after);
    return r;
  });

/* Move a page one place in the list; returns false when it cannot move. */
export function movePage(list, id, dir) {
  const i = (list || []).findIndex((p) => p && p.id === id); if (i < 0) return false;
  const j = dir === 'up' ? i - 1 : i + 1; if (j < 0 || j >= list.length) return false;
  [list[i], list[j]] = [list[j], list[i]]; return true;
}

/* What a reader gets: the song resolved from the library, the ids kept, nothing
   about the plan. `songs` is show.songs. */
export function shapePages(pages, songs, { all = false } = {}) {
  const byId = new Map((songs || []).filter((s) => s && s.id).map((s) => [s.id, s]));
  return (pages || []).filter((p) => all || p.on).map((p) => {
    const s = p.songId ? byId.get(p.songId) : null;
    return {
      id: p.id, title: p.title, when: p.when, body: p.body, img: p.img, on: p.on, at: p.at, updatedAt: p.updatedAt,
      songId: p.songId,
      song: s ? { id: s.id, title: String(s.title || ''), artist: String(s.artist || '') } : null,
    };
  });
}

/* How many pages this diary holds on its plan. One answer for the Studio's
   "n of N", the refusal and the plan card. */
export async function capFor(aid) {
  const { limits } = await planForArtist(aid);
  return diaryCap(limits);
}
export const FULL = (cap, label) =>
  `That's ${cap} pages — the most a diary holds on ${label}. Edit one of those, or make room.`;

/* ---------- the Studio's side (admin.mjs) ---------- */
export const DIARY_ACTIONS = new Set(['diaryList', 'diarySave', 'diaryRemove', 'diaryMove', 'diaryPhoto', 'diaryPhotoClear']);
export async function handleDiary(aid, action, body) {
  const show = await getShow(aid);
  const list = async () => shapePages((await readDiary(aid)).pages, show.songs, { all: true });
  const payload = async (extra = {}) => {
    const { plan, limits } = await planForArtist(aid);
    return json({ ok: true, pages: await list(), cap: diaryCap(limits), plan, label: limits.label,
                  maxTitle: MAX_TITLE, maxWhen: MAX_WHEN, maxBody: MAX_BODY, ...extra });
  };

  if (action === 'diaryList') return payload();

  if (action === 'diarySave') {
    const incoming = body.page || {};
    const editing = DIARY_ID.test(String(incoming.id || ''));
    const id = editing ? String(incoming.id) : mintId();               // outside the CAS
    /* The song must be one of theirs, by id — never a title typed in, so the page
       can never name a song the library does not hold (0fs: ids, not names). */
    const songId = incoming.songId === undefined ? undefined : String(incoming.songId || '').slice(0, 60);
    if (songId && !show.songs.some((s) => s && s.id === songId)) return bad('That song isn’t in your library');
    const { limits } = await planForArtist(aid);
    const cap = diaryCap(limits);
    let full = false, why = null;
    await mutateDiary(aid, (d) => {
      const at = d.pages.findIndex((p) => p.id === id);
      const prev = at >= 0 ? d.pages[at] : null;
      const now = Date.now();
      // the cover is the record's, never the request's: diaryPhoto / diaryPhotoClear are its only writers
      const row = normPage({ ...(prev || {}), ...incoming, id, songId: songId === undefined ? ((prev && prev.songId) || '') : songId,
                             img: (prev && prev.img) || '', at: (prev && prev.at) || now, updatedAt: now });
      if (!row) { why = !clean(incoming.title, MAX_TITLE) ? 'Give the page a title' : 'Write the story first'; return false; }
      if (at >= 0) { d.pages[at] = row; return true; }
      /* THE CAP, INSIDE THE CAS: two taps at once cannot both squeeze past it. It
         counts every page kept, shown or hidden, exactly as the library counts
         every song — and a diary already over the line (a downgrade) keeps every
         page it has; only this next one is refused. */
      if (d.pages.length >= cap) { full = true; return false; }
      d.pages.unshift(row);                                              // the newest story on top, until they move it
      return true;
    });
    if (why) return bad(why);
    if (full) return bad(FULL(cap, limits.label), 402);
    return payload({ id });
  }
  /* REMOVING IS NEVER GATED — a cap never deletes and a lapsed artist must still be
     able to take a page down (0s). */
  if (action === 'diaryRemove') {
    const id = String(body.id || '');
    await mutateDiary(aid, (d) => { d.pages = d.pages.filter((p) => p.id !== id); return true; });
    if (DIARY_ID.test(id)) await dropImage(aid, id);                     // the cover goes with the page
    return payload();
  }
  /* THE COVER: one picture per page, the page id as its slot. The bytes go up first
     and are dropped again if the page turns out not to exist — never a picture
     nothing points at (INVARIANT 1 has no list() to find it with). Never gated by
     the cap: a cover on a page they already have adds no page. */
  if (action === 'diaryPhoto') {
    const id = String(body.id || '');
    if (!DIARY_ID.test(id)) return bad('unknown page', 404);
    if (!(await readDiary(aid)).pages.some((p) => p.id === id)) return bad('unknown page', 404);
    const dec = decodeDataUrl(body.data);
    if (dec.error) return bad(dec.error);
    const url = await putImage(aid, id, dec.bytes, dec.type);
    let found = false;
    await mutateDiary(aid, (d) => { const p = d.pages.find((x) => x.id === id); if (!p) return false; p.img = url; found = true; return true; });
    if (!found) { await dropImage(aid, id); return bad('unknown page', 404); }
    return payload({ url });
  }
  if (action === 'diaryPhotoClear') {
    const id = String(body.id || '');
    if (!DIARY_ID.test(id)) return bad('unknown page', 404);
    await dropImage(aid, id);
    await mutateDiary(aid, (d) => { const p = d.pages.find((x) => x.id === id); if (!p) return false; p.img = ''; return true; });
    return payload();
  }
  if (action === 'diaryMove') {
    const id = String(body.id || ''), dir = body.dir === 'up' ? 'up' : 'down';
    let moved = false;
    await mutateDiary(aid, (d) => { moved = movePage(d.pages, id, dir); return moved; });
    return payload({ moved });
  }
  return bad('unknown action', 400);
}
