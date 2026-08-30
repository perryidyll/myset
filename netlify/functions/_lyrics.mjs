import { casDoc, readDoc, KEY } from './_lib.mjs';

/* Lyrics come from LRCLIB — free, keyless, no AI, ~0.4s — and are then cached in
   Blobs forever, so a whole bar tapping "Lyrics" the moment a song starts never
   becomes forty simultaneous calls to a free community API.

   This MUST run server-side: LRCLIB asks clients to identify themselves, and a
   browser is forbidden from setting User-Agent. Their documented workaround is
   the two headers below. */
const LKEY = KEY.lyrics;                           // flat key — INVARIANT 2
const HEADERS = {
  'Lrclib-Client': 'MySet/1.0 (https://myset.vip)',
  'X-User-Agent': 'MySet/1.0 (https://myset.vip)',
};
const MISS_TTL = 30 * 24 * 3600e3;                 // re-check a miss after a month

export async function readLyrics(aid, songId) {
  const { data } = await readDoc(LKEY(aid, songId), null);
  return data;
}

export async function saveLyrics(aid, songId, doc) {
  await casDoc(LKEY(aid, songId), () => ({}), (d) => {
    Object.keys(d).forEach((k) => delete d[k]);
    Object.assign(d, doc);
    return true;
  }).catch(() => {});
  return doc;
}

async function lrclib(path) {
  const r = await fetch(`https://lrclib.net${path}`, { headers: HEADERS });
  if (r.status === 429) {                          // honour Retry-After or risk a ban
    const wait = Math.min(3000, (parseInt(r.headers.get('retry-after'), 10) || 2) * 1000);
    await new Promise((res) => setTimeout(res, wait));
    return null;
  }
  if (!r.ok) return null;
  try { return await r.json(); } catch { return null; }
}

/** Fetch from LRCLIB. Falls back to /api/search when the exact match 404s. */
export async function fetchLyrics(title, artist) {
  const q = (o) => new URLSearchParams(o).toString();
  let d = await lrclib(`/api/get?${q({ track_name: title, artist_name: artist || '' })}`);
  if (!d) {
    const list = await lrclib(`/api/search?${q({ track_name: title, artist_name: artist || '' })}`);
    if (Array.isArray(list) && list.length) d = list.find((x) => x.plainLyrics) || list[0];
  }
  if (!d || (!d.plainLyrics && !d.syncedLyrics)) return null;
  return {
    plain: String(d.plainLyrics || '').trim(),
    synced: String(d.syncedLyrics || '').trim(),
    credit: [d.artistName, d.albumName].filter(Boolean).join(' · '),
    lrclibId: d.id || null,
    source: 'lrclib',
  };
}

/** Cache-first. Never lets a lyrics failure surface as anything but "not found". */
export async function getLyrics(aid, song) {
  const cached = await readLyrics(aid, song.id);
  if (cached) {
    if (cached.state === 'blocked') return { state: 'blocked' };
    if (cached.state === 'ok') return cached;
    if (cached.state === 'none' && Date.now() - (cached.fetchedAt || 0) < MISS_TTL) return cached;
  }
  let got = null;
  try { got = await fetchLyrics(song.title, song.artist); } catch { /* stay quiet */ }
  const doc = got
    ? { v: 1, songId: song.id, title: song.title, artist: song.artist || '',
        ...got, state: 'ok', owned: false, fetchedAt: Date.now() }
    : { v: 1, songId: song.id, title: song.title, artist: song.artist || '',
        plain: '', synced: '', credit: '', state: 'none', fetchedAt: Date.now() };
  await saveLyrics(aid, song.id, doc);
  return doc;
}
