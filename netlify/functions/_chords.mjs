/* Ultimate Guitar does not publish a supported chord-sheet API. This resolver
   reads only its search-result metadata long enough to find the direct Chords
   URL. It never downloads, parses, stores or republishes a chart. A strict
   title + artist match is safer than opening a plausible but wrong song on
   stage; when there is no exact match, the caller keeps the normal search. */
const CACHE_MS = 6 * 3600e3;
const cache = new Map();

const clean = (s) => String(s || '')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ').trim();
const artistKey = (s) => clean(s).replace(/^the /, '');

export function ultimateGuitarSearch(title, artist) {
  const value = [title, artist].filter(Boolean).join(' ');
  return `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(value)}`;
}

const unescapeHtml = (s) => String(s || '')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const jsonText = (s) => {
  try { return JSON.parse(`"${s}"`); } catch { return s; }
};

export function findUltimateGuitarLink(html, title, artist) {
  const page = unescapeHtml(html);
  const wantedTitle = clean(title), wantedArtist = artistKey(artist);
  const found = [];
  const links = /"tab_url":"(https:\/\/tabs\.ultimate-guitar\.com\/tab\/[^"?]+-chords-\d+)"/g;
  let m;
  while ((m = links.exec(page))) {
    const start = Math.max(0, page.lastIndexOf('{"id":', m.index));
    const row = page.slice(start, m.index);
    const song = row.match(/"song_name":"((?:\\.|[^"\\])*)"/);
    const by = row.match(/"artist_name":"((?:\\.|[^"\\])*)"/);
    if (!song || !by) continue;
    const songName = jsonText(song[1]), artistName = jsonText(by[1]);
    if (clean(songName) !== wantedTitle || artistKey(artistName) !== wantedArtist) continue;
    found.push(m[1].replace(/\\\//g, '/'));
  }
  return found[0] || null;                 // UG already ranks its strongest version first
}

export async function resolveUltimateGuitar(title, artist) {
  const search = ultimateGuitarSearch(title, artist);
  const key = `${clean(title)}|${artistKey(artist)}`;
  const prior = cache.get(key);
  if (prior && Date.now() - prior.at < CACHE_MS) return prior.value;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  let direct = null;
  try {
    const r = await fetch(search, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MySet/1.0 (https://myset.vip)', Accept: 'text/html' },
    });
    const size = Number(r.headers.get('content-length') || 0);
    if (r.ok && (!size || size <= 750000)) {
      const html = await r.text();
      if (html.length <= 750000) direct = findUltimateGuitarLink(html, title, artist);
    }
  } catch { /* the Studio will offer the ordinary search instead */ }
  finally { clearTimeout(timer); }

  const value = { url: direct || search, direct: !!direct };
  cache.set(key, { at: Date.now(), value });
  return value;
}
