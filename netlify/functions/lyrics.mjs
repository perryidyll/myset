import { getShow, json, bad } from './_lib.mjs';
import { getLyrics } from './_lyrics.mjs';

/* Public, but deliberately narrow: one song at a time, and only a song that is
   actually in tonight's setlist. No browsing, no search, no library — that is
   both the licensing posture and, in a bar, the better product. */
export default async (req) => {
  const id = (new URL(req.url).searchParams.get('song') || '').slice(0, 60);
  if (!id) return bad('missing song');

  const show = await getShow();
  const song = show.songs.find((s) => s.id === id);
  if (!song) return bad('unknown song', 404);

  const d = await getLyrics(song);
  if (!d || d.state !== 'ok' || !d.plain)
    return json({ ok: true, found: false, title: song.title, artist: song.artist || '' });

  return json({
    ok: true, found: true,
    songId: song.id, title: song.title, artist: song.artist || '',
    plain: d.plain, credit: d.credit || '',
    owned: !!d.owned,                       // the artist's own words, typed in by him
    source: d.source || 'lrclib',
  });
};
