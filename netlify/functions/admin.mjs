import { getShow, mutateShow, readFans, clearAllFanVotes, wipeFans, voteCounts,
         firstVotedAt, rankSongs, json, bad, checkAdmin, slug, defaultShow, sha,
         normPacks, newShowId } from './_lib.mjs';
import { archiveShow } from './_history.mjs';

export default async (req) => {
  if (!(await checkAdmin(req))) return bad('unauthorized', 401);
  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }
  const action = body.action;
  let err = null, resetVotes = false, wipe = false;

  // Anything that starts a song needs the tally BEFORE it is wiped.
  let counts = null, firstAt = null, votersNow = 0;
  if (action === 'play' || action === 'playTop') {
    const f = await readFans();
    counts = voteCounts(f); firstAt = firstVotedAt(f);
    votersNow = Object.values(f).filter((x) => (x.v || []).length).length;
  }

  // A finished show must be snapshotted BEFORE anything wipes the tally —
  // clearAllFanVotes()/wipeFans() destroy the only copy.
  if (action === 'newShow' || (action === 'status' && body.status === 'ended')) {
    try {
      const [prev, fans] = await Promise.all([getShow(), readFans()]);
      await archiveShow(prev, fans);
    } catch { /* never block ending a show on the archive */ }
  }

  const freshId = action === 'newShow' ? newShowId() : null;   // outside the CAS

  await mutateShow((show) => {
    /* Records what a song won with, at the moment it is started. Without this the
       number is gone a millisecond later and no history is recoverable. */
    const logPlay = (id) => {
      const sg = show.songs.find((x) => x.id === id) || {};
      const c = counts || {};
      const byId = Object.fromEntries(show.songs.map((x) => [x.id, x]));
      // The WHOLE round, not just the winner — votes for the songs that lost are
      // wiped a millisecond later too, and they are the honest answer to
      // "what did the room actually want tonight".
      const round = Object.keys(c)
        .filter((k) => c[k] > 0)
        .map((k) => ({ songId: k, title: (byId[k] || {}).title || k,
                       artist: (byId[k] || {}).artist || '', votes: c[k] }))
        .sort((a, b) => b.votes - a.votes || a.title.localeCompare(b.title))
        .slice(0, 8);
      show.log.push({
        songId: id, title: sg.title || id, artist: sg.artist || '',
        votes: c[id] || 0, voters: votersNow,
        roundVotes: Object.values(c).reduce((a, b) => a + b, 0),
        round,
        replay: show.played.includes(id), at: Date.now(),
      });
      if (show.log.length > 200) show.log = show.log.slice(-200);
    };

    switch (action) {
      case 'play': {
        const id = body.song;
        if (!id) { err = ['no song', 400]; return false; }
        logPlay(id);                                          // before played[] moves
        if (show.nowPlaying && show.nowPlaying !== id && !show.played.includes(show.nowPlaying))
          show.played.push(show.nowPlaying);
        show.played = show.played.filter((p) => p !== id);   // replaying? take it back out
        show.nowPlaying = id || null;
        show.nowPlayingAt = Date.now();
        show.windowOpen = true; resetVotes = true;
        break;
      }
      case 'playTop': {
        const pool = rankSongs(
          show.songs
            .filter((s) => s.active !== false && s.id !== show.nowPlaying)
            .filter((s) => !show.played.includes(s.id) || (counts[s.id] || 0) > 0),
          counts, firstAt);
        if (!pool.length) { err = ['nothing left in the pool', 409]; return false; }
        logPlay(pool[0].id);                                  // before played[] moves
        if (show.nowPlaying && !show.played.includes(show.nowPlaying)) show.played.push(show.nowPlaying);
        show.played = show.played.filter((p) => p !== pool[0].id);
        show.nowPlaying = pool[0].id;
        show.nowPlayingAt = Date.now();
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
        const artist = String(body.artist || '').trim().slice(0, 60);
        let id = slug(title);
        if (show.songs.some((s) => s.id === id)) id += '-' + Math.random().toString(36).slice(2, 5);
        show.songs.push({ id, title, artist, active: true });
        break;
      }
      case 'editSong': {
        const sg = show.songs.find((x) => x.id === body.song);
        if (!sg) { err = ['unknown song', 404]; return false; }
        if (typeof body.title === 'string' && body.title.trim()) sg.title = body.title.trim().slice(0, 80);
        if (typeof body.artist === 'string') sg.artist = body.artist.trim().slice(0, 60);
        break;
      }
      case 'packs': {
        show.packs = normPacks({ small: body.small, big: body.big });
        break;
      }
      case 'replayCost':
        show.replayCost = Math.max(1, Math.min(20, parseInt(body.n, 10) || 5)); break;
      case 'removeSong': show.songs = show.songs.filter((s) => s.id !== body.song); break;
      case 'unplay': show.played = show.played.filter((id) => id !== body.song); break;
      case 'setCode': {
        const code = String(body.code || '');
        if (code.length < 4) { err = ['Pick at least 4 characters', 400]; return false; }
        show.codeHash = sha(code);          // stored hashed, never in plaintext
        break;
      }
      case 'resetVotes': resetVotes = true; break;
      case 'resetSetlist': show.songs = defaultShow().songs; break;
      case 'newShow':
        show.played = []; show.nowPlaying = null; show.nowPlayingAt = null;
        show.status = 'live'; show.windowOpen = true;
        show.log = [];
        show.showId = freshId;
        show.startedAt = Date.now();
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
