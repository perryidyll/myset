import { getShow, mutateShow, readFans, clearAllFanVotes, wipeFans, voteCounts,
         json, bad, checkAdmin, slug, defaultShow } from './_lib.mjs';

export default async (req) => {
  if (!checkAdmin(req)) return bad('unauthorized', 401);
  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }
  const action = body.action;
  let err = null, resetVotes = false, wipe = false;

  // actions that need vote counts must read fans first
  let counts = null;
  if (action === 'playTop') counts = voteCounts(await readFans());

  await mutateShow((show) => {
    switch (action) {
      case 'play': {
        const id = body.song;
        if (show.nowPlaying && show.nowPlaying !== id && !show.played.includes(show.nowPlaying))
          show.played.push(show.nowPlaying);
        show.nowPlaying = id || null;
        show.windowOpen = true; resetVotes = true;
        break;
      }
      case 'playTop': {
        const pool = show.songs
          .filter((s) => s.active !== false && s.id !== show.nowPlaying && !show.played.includes(s.id))
          .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
        if (!pool.length) { err = ['nothing left in the pool', 409]; return false; }
        if (show.nowPlaying && !show.played.includes(show.nowPlaying)) show.played.push(show.nowPlaying);
        show.nowPlaying = pool[0].id;
        show.windowOpen = true; resetVotes = true;
        break;
      }
      case 'window': show.windowOpen = !!body.open; break;
      case 'status':
        show.status = ['pre','live','ended'].includes(body.status) ? body.status : show.status; break;
      case 'venue': show.venue = String(body.venue || '').slice(0, 80); break;
      case 'city': show.city = String(body.city || '').slice(0, 80); break;
      case 'showTime': show.showTime = String(body.showTime || '').slice(0, 40); break;
      case 'freeCredits':
        show.freeCredits = Math.max(0, Math.min(50, parseInt(body.n, 10) || 3)); break;
      case 'toggleSong': {
        const s = show.songs.find((x) => x.id === body.song);
        if (s) s.active = s.active === false;
        break;
      }
      case 'addSong': {
        const title = String(body.title || '').trim().slice(0, 80);
        if (!title) { err = ['no title', 400]; return false; }
        let id = slug(title);
        if (show.songs.some((s) => s.id === id)) id += '-' + Math.random().toString(36).slice(2, 5);
        show.songs.push({ id, title, active: true });
        break;
      }
      case 'removeSong': show.songs = show.songs.filter((s) => s.id !== body.song); break;
      case 'unplay': show.played = show.played.filter((id) => id !== body.song); break;
      case 'resetVotes': resetVotes = true; break;
      case 'resetSetlist': show.songs = defaultShow().songs; break;
      case 'newShow':
        show.played = []; show.nowPlaying = null;
        show.status = 'live'; show.windowOpen = true;
        wipe = true;
        break;
      default: err = ['unknown action', 400]; return false;
    }
    return true;
  });

  if (err) return bad(err[0], err[1]);
  if (wipe) await wipeFans();
  else if (resetVotes) await clearAllFanVotes();
  return json({ ok: true });
};
