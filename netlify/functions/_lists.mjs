import { casDoc, readDoc, store } from './_lib.mjs';

/* SETLISTS — named subsets of the one song library.

   The library (`show.songs`) stays the single source of truth for what a song IS.
   A setlist only ever holds song IDS, like a playlist. So renaming a song, or
   changing its key, changes it everywhere at once and nothing can drift.

   Two documents, both Studio-only:
     lists_<aid>   the setlists themselves
     learn_<aid>   songs the artist wants to learn — NOT in the library, so the
                   room can never vote for something that isn't playable yet

   THE ONE PIECE OF DUPLICATION, stated out loud: the ACTIVE list's song ids are
   also projected onto the show record (`show.listSongs`). That is deliberate.
   `/api/show` is polled by every phone in the room, and making it read a second
   document on every poll to find out which songs are in play would cost more than
   the projection does.

   There are exactly TWO writers, and they are not symmetrical — which is the part
   that matters:
     applyList()  the only writer that can ADD an id to the projection.
     normShow()   on every read, drops ids that are no longer in the library.
   So a stale id cannot survive a read, but a MISSING id is unrecoverable until
   applyList runs again. If you add another way for a song id to appear in the
   library, call `refreshActive()` after it — admin.mjs does this by comparing the
   id set across the mutation rather than keeping a list of actions to remember. */

export const MAX_LISTS = 20;
export const MAX_NAME = 40;
export const MAX_LEARN = 120;

const LK = (aid) => `lists_${aid}`;
const NK = (aid) => `learn_${aid}`;

const clean = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const newId = (p) => p + Math.random().toString(36).slice(2, 9);

export const emptyLists = () => ({ v: 1, lists: [] });
export const emptyLearn = () => ({ v: 1, list: [] });

function normLists(d) {
  d.lists = (Array.isArray(d.lists) ? d.lists : []).map((l) => ({
    id: String((l && l.id) || '').replace(/[^a-z0-9]/gi, '').slice(0, 12) || newId('l'),
    name: clean(l && l.name, MAX_NAME) || 'Untitled set',
    songs: [...new Set((Array.isArray(l && l.songs) ? l.songs : [])
      .filter((s) => typeof s === 'string').map((s) => s.slice(0, 60)))].slice(0, 500),
    at: Number(l && l.at) || Date.now(),
  })).slice(0, MAX_LISTS);
  return d;
}

export async function readLists(aid) {
  const { data } = await readDoc(LK(aid), null);
  return normLists(data || emptyLists());
}
export const mutateLists = (aid, fn) =>
  casDoc(LK(aid), emptyLists, (d) => { normLists(d); return fn(d); });

export async function readLearn(aid) {
  const { data } = await readDoc(NK(aid), null);
  const d = data || emptyLearn();
  d.list = (Array.isArray(d.list) ? d.list : []).map((x) => ({
    id: String((x && x.id) || '').replace(/[^a-z0-9]/gi, '').slice(0, 12) || newId('w'),
    title: clean(x && x.title, 80),
    artist: clean(x && x.artist, 60),
    note: clean(x && x.note, 140),
    at: Number(x && x.at) || Date.now(),
  })).filter((x) => x.title).slice(0, MAX_LEARN);
  return d;
}
export const mutateLearn = (aid, fn) =>
  casDoc(NK(aid), emptyLearn, (d) => { d.list = Array.isArray(d.list) ? d.list : []; return fn(d); });

/* ---------- the projection ----------
   The ONLY writer of show.listId / listName / listSongs. Call it after anything
   that could change which songs are in the active list. */
export async function applyList(aid, listId) {
  const { mutateShow, getShow } = await import('./_lib.mjs');
  /* '' and 'all' both mean "no setlist, the whole library". They are the same thing
     HERE and deliberately different on a GIG, where '' means "no opinion, leave
     whatever is picked" and 'all' means "clear it". See admin.mjs autoList. */
  const wanted = String(listId || '');
  const d = await readLists(aid);
  const list = wanted && wanted !== 'all' ? d.lists.find((l) => l.id === wanted) : null;

  await mutateShow(aid, (sh) => {
    if (!list) { sh.listId = ''; sh.listName = ''; sh.listSongs = []; return true; }
    const have = new Set(sh.songs.map((x) => x.id));
    sh.listId = list.id;
    sh.listName = list.name;
    sh.listSongs = list.songs.filter((s) => have.has(s));
    return true;
  });
  const sh = await getShow(aid);
  return { listId: sh.listId, listName: sh.listName, count: (sh.listSongs || []).length };
}

/** Re-project whatever is currently selected. Used after a library change. */
export async function refreshActive(aid) {
  const { getShow } = await import('./_lib.mjs');
  const sh = await getShow(aid);
  if (!sh.listId) return null;
  return applyList(aid, sh.listId);
}

/** What the Studio shows for each list. The two numbers mean different things and
 *  both are needed:
 *    songs  every id still IN THE LIBRARY — these are the ticks in the picker, so a
 *           switched-off song has to stay in here or saving the picker would quietly
 *           drop it from the list.
 *    count  how many are IN PLAY — the same test playable() applies, so the Setlist
 *           tab's "8 of your 40 songs are in play" can't contradict what the room
 *           actually sees. */
export function shapeLists(d, show) {
  const have = new Set((show.songs || []).map((x) => x.id));
  const live = new Set((show.songs || []).filter((x) => x.active !== false).map((x) => x.id));
  return d.lists
    .map((l) => ({
      id: l.id, name: l.name,
      songs: l.songs.filter((s) => have.has(s)),
      count: l.songs.filter((s) => live.has(s)).length,
      active: show.listId === l.id,
      at: l.at,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
