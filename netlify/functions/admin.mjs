import { getShow, mutateShow, readFans, clearAllFanVotes, voteCounts,
         firstVotedAt, rankSongs, json, bad, requireArtist, slug, sha,
         normPacks, newShowId, carryFans, STARTER_SONGS } from './_lib.mjs';
import { archiveShow } from './_history.mjs';
import { mutateProfile, getProfile, shapeMedia, parseMedia } from './_profile.mjs';
import { lookup } from './_embeds.mjs';
import { readLyrics, saveLyrics, getLyrics } from './_lyrics.mjs';
import { readEvents, mutateEvents, normEvent, reindexCities, occurrencesFor, endTimeOf, MAX_EVENTS } from './_events.mjs';
import { stagePayload } from './stage.mjs';

/* The gig calendar. Events are their own document, so these short-circuit too.
   Every write reindexes the artist's cities, which is what keeps the public
   country/city feed correct without a job to run. */
async function handleEvents(aid, action, body) {
  if (action === 'eventList') {
    const events = await readEvents(aid);
    // Expanded here, never in the browser. One implementation of "when does this
    // repeat" — the same reason rankSongs exists (INVARIANT 12b).
    const from = /^\d{4}-\d{2}-\d{2}$/.test(body.from || '') ? body.from : null;
    const to = /^\d{4}-\d{2}-\d{2}$/.test(body.to || '') ? body.to : null;
    const occ = from && to ? occurrencesFor(events, from, to) : [];
    // cancelled nights are hidden from the public feed but the artist must see
    // them, so they are expanded separately and flagged
    const cancelled = [];
    for (const ev of events.list) {
      const hid = new Set(ev.hid || []);
      for (const d of ev.skip || []) {
        if (hid.has(d)) continue;                        // dismissed for good
        if (from && to && d >= from && d <= to)
          cancelled.push({ eventId: ev.id, date: d, time: ev.time, endTime: endTimeOf(ev),
                           venue: ev.venue, city: ev.city, country: ev.country,
                           repeating: !!ev.repeat, cancelled: true });
      }
    }
    return json({ ok: true, events: events.list,
                  occurrences: [...occ, ...cancelled].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)) });
  }

  if (action === 'eventSave') {
    const incoming = body.event || {};
    const id = String(incoming.id || '').slice(0, 24) ||
               'g' + Math.random().toString(36).slice(2, 10);   // outside the CAS
    let full = false;
    const ev = normEvent({ ...incoming, id });
    if (!ev.date) return bad('Pick a date');
    if (!ev.venue) return bad('Where is it?');
    await mutateEvents(aid, (d) => {
      const at = d.list.findIndex((x) => x.id === id);
      if (at >= 0) d.list[at] = { ...ev, skip: d.list[at].skip || [], hid: d.list[at].hid || [],
                                  createdAt: d.list[at].createdAt };
      else if (d.list.length >= MAX_EVENTS) { full = true; return false; }
      else d.list.push(ev);
      return true;
    });
    if (full) return bad('That is as many gigs as one calendar can hold');
    const events = await readEvents(aid);
    await reindexCities(aid, events);
    return json({ ok: true, id, events: events.list });
  }

  if (action === 'eventDelete') {
    await mutateEvents(aid, (d) => { d.list = d.list.filter((x) => x.id !== body.id); return true; });
    const events = await readEvents(aid);
    await reindexCities(aid, events);
    return json({ ok: true, events: events.list });
  }

  // dismiss a cancelled night from the list for good. The skip stays on the rule
  // (otherwise the night reappears); this only stops showing it.
  if (action === 'eventHide') {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') ? body.date : null;
    if (!date) return bad('bad date');
    let gone = false;
    await mutateEvents(aid, (d) => {
      const ev = d.list.find((x) => x.id === body.id);
      if (!ev) return false;
      if (!ev.repeat) { d.list = d.list.filter((x) => x.id !== body.id); gone = true; return true; }
      ev.skip = Array.isArray(ev.skip) ? ev.skip : [];
      ev.hid = Array.isArray(ev.hid) ? ev.hid : [];
      if (!ev.skip.includes(date)) ev.skip.push(date);
      if (!ev.hid.includes(date)) ev.hid.push(date);
      return true;
    });
    const events = await readEvents(aid);
    if (gone) await reindexCities(aid, events);
    return json({ ok: true, events: events.list });
  }

  // cancel or un-cancel a single night of a residency without touching the rule
  if (action === 'eventSkip') {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') ? body.date : null;
    if (!date) return bad('bad date');
    await mutateEvents(aid, (d) => {
      const ev = d.list.find((x) => x.id === body.id);
      if (!ev) return false;
      ev.skip = Array.isArray(ev.skip) ? ev.skip : [];
      ev.hid = Array.isArray(ev.hid) ? ev.hid : [];
      const at = ev.skip.indexOf(date);
      if (body.on === false) {
        if (at >= 0) ev.skip.splice(at, 1);
        ev.hid = ev.hid.filter((d) => d !== date);      // restoring un-hides too
      } else if (at < 0) ev.skip.push(date);
      return true;
    });
    const events = await readEvents(aid);
    return json({ ok: true, events: events.list });
  }
  return bad('unknown action', 400);
}
const EVENT_ACTIONS = new Set(['eventList', 'eventSave', 'eventDelete', 'eventSkip', 'eventHide']);

/* Lyrics live in their own flat docs, not on the show, so these short-circuit too. */
async function handleLyrics(aid, action, body, show) {
  const song = show.songs.find((x) => x.id === body.song);
  if (!song && action !== 'lyricsWarm') return bad('unknown song', 404);

  if (action === 'lyricsGet') {
    const d = await readLyrics(aid, body.song);
    return json({ ok: true, song: body.song, title: song.title, artist: song.artist || '',
                  plain: (d && d.plain) || '', credit: (d && d.credit) || '',
                  state: (d && d.state) || 'unfetched', owned: !!(d && d.owned) });
  }

  if (action === 'lyricsSet') {
    const plain = String(body.plain || '').replace(/\r/g, '').slice(0, 20000).trim();
    if (!plain) {                               // empty = take them down
      await saveLyrics(aid, body.song, { v: 1, songId: body.song, title: song.title,
        artist: song.artist || '', plain: '', synced: '', credit: '',
        state: 'blocked', fetchedAt: Date.now() });
      return json({ ok: true, cleared: true });
    }
    await saveLyrics(aid, body.song, {
      v: 1, songId: body.song, title: song.title, artist: song.artist || '',
      plain, synced: '', credit: String(body.credit || '').slice(0, 200),
      state: 'ok', owned: !!body.owned,
      source: body.owned ? 'artist' : 'lrclib', fetchedAt: Date.now(),
    });
    return json({ ok: true });
  }

  if (action === 'lyricsFetch') {              // pull this one from LRCLIB now
    await saveLyrics(aid, body.song, { v: 1, songId: body.song, state: 'unfetched', fetchedAt: 0 });
    const d = await getLyrics(aid, song);
    return json({ ok: true, found: !!(d && d.state === 'ok' && d.plain),
                  plain: (d && d.plain) || '', credit: (d && d.credit) || '' });
  }

  if (action === 'lyricsWarm') {               // whole setlist, once, before a gig
    const todo = show.songs.filter((x) => x.active !== false);
    let got = 0; const missing = [];
    for (const sg of todo) {
      const d = await getLyrics(aid, sg);
      if (d && d.state === 'ok' && d.plain) got++; else missing.push(sg.title);
      await new Promise((r) => setTimeout(r, 350));   // LRCLIB asks for spacing
    }
    return json({ ok: true, fetched: got, total: todo.length, missing: missing.slice(0, 40) });
  }
  return bad('unknown action', 400);
}
const LYRICS_ACTIONS = new Set(['lyricsGet', 'lyricsSet', 'lyricsFetch', 'lyricsWarm']);

/* Profile edits don't touch the show record at all, so they short-circuit before
   the show mutation below. */
async function handleProfile(aid, action, body) {
  if (action === 'profileSet') {
    await mutateProfile(aid, (p) => {
      for (const k of ['name', 'tagline', 'bio', 'photo', 'avatar'])
        if (typeof body[k] === 'string') p[k] = body[k];
      if (Array.isArray(body.photos)) p.photos = body.photos;
      if (body.links && typeof body.links === 'object')
        p.links = { ...p.links, ...body.links };
      return true;
    });
    return json({ ok: true, profile: await getProfile(aid) });
  }

  if (action === 'mediaAdd') {
    const m = parseMedia(body.url);
    if (!m) return bad('That isn’t a YouTube, Spotify or Apple Music link I can embed.', 400);
    const info = await lookup(m);
    if (!info.ok) return bad(info.why, 400);
    const mid = 'm' + Math.random().toString(36).slice(2, 9);   // outside the CAS
    let added = null;
    await mutateProfile(aid, (p) => {
      const dupe = p.media.some((x) =>
        x.provider === m.provider && x.id === m.id &&
        (x.i || null) === (m.i || null) && (x.list || null) === (m.list || null));
      if (dupe) return false;
      added = { mid, ...m, title: String(body.title || info.title || '').slice(0, 120),
                thumb: String(info.thumb || '').slice(0, 300) };
      p.media.push(added);
      return true;
    });
    if (!added) return bad('That one’s already on your page.', 409);
    return json({ ok: true, item: shapeMedia(added) });
  }

  if (action === 'mediaRemove') {
    await mutateProfile(aid, (p) => { p.media = p.media.filter((x) => x.mid !== body.mid); return true; });
    return json({ ok: true });
  }

  if (action === 'mediaMove') {
    await mutateProfile(aid, (p) => {
      const i = p.media.findIndex((x) => x.mid === body.mid);
      const j = i + (body.dir === 'up' ? -1 : 1);
      if (i < 0 || j < 0 || j >= p.media.length) return false;
      [p.media[i], p.media[j]] = [p.media[j], p.media[i]];
      return true;
    });
    return json({ ok: true });
  }
  return bad('unknown action', 400);
}
const PROFILE_ACTIONS = new Set(['profileSet', 'mediaAdd', 'mediaRemove', 'mediaMove']);

export default async (req) => {
  const me = await requireArtist(req);
  if (!me) return bad('unauthorized', 401);
  const aid = me.aid;
  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }
  const action = body.action;
  if (PROFILE_ACTIONS.has(action)) return handleProfile(aid, action, body);
  if (LYRICS_ACTIONS.has(action)) return handleLyrics(aid, action, body, await getShow(aid));
  if (EVENT_ACTIONS.has(action)) return handleEvents(aid, action, body);

  let err = null, resetVotes = false, wipe = false;

  // Anything that starts a song needs the tally BEFORE it is wiped.
  let counts = null, firstAt = null, votersNow = 0;
  if (action === 'play' || action === 'playTop') {
    const f = await readFans(aid);
    counts = voteCounts(f); firstAt = firstVotedAt(f);
    votersNow = Object.values(f).filter((x) => (x.v || []).length).length;
  }

  // A finished show must be snapshotted BEFORE anything wipes the tally —
  // clearAllFanVotes()/wipeFans() destroy the only copy.
  if (action === 'newShow' || (action === 'status' && body.status === 'ended')) {
    try {
      const [prev, fans] = await Promise.all([getShow(aid), readFans(aid)]);
      await archiveShow(aid, prev, fans);
    } catch { /* never block ending a show on the archive */ }
  }

  const freshId = action === 'newShow' ? newShowId() : null;   // outside the CAS
  const prevShow = action === 'newShow' ? await getShow(aid) : null;   // read before it resets

  await mutateShow(aid, (show) => {
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
      case 'freeCredits': {
        const n = parseInt(body.n, 10);
        show.freeCredits = Math.max(0, Math.min(999, Number.isFinite(n) ? n : 3));
        show.unlimited = false;               // picking a number turns unlimited off
        break;
      }
      case 'unlimited': show.unlimited = !!body.on; break;
      case 'unlimitedFan': {
        const id = String(body.fan || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
        if (!id) { err = ['no device id', 400]; return false; }
        const at = show.unlimitedFans.indexOf(id);
        if (body.on && at < 0) show.unlimitedFans.push(id);
        if (!body.on && at >= 0) show.unlimitedFans.splice(at, 1);
        break;
      }
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
        show.packs = normPacks({ small: body.small, big: body.big, max: body.max });
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
      case 'starterSetlist': {          // append the generic covers, never replace
        const have = new Set(show.songs.map((x) => x.id));
        for (const [t, a] of STARTER_SONGS) {
          const id = slug(t);
          if (!have.has(id)) show.songs.push({ id, title: t, artist: a, active: true });
        }
        break;
      }
      case 'clearSetlist': show.songs = []; break;
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
  // paid votes survive a reset — only a fan who gifted them loses them
  if (wipe) await carryFans(aid, prevShow || (await getShow(aid)));
  else if (resetVotes) await clearAllFanVotes(aid);

  // Hand the fresh state back with the write. Without this the Studio does a
  // second round trip for every tap, which is most of why buttons felt slow.
  let stage = null;
  try { stage = await stagePayload(aid); } catch { /* the write still succeeded */ }
  return json({ ok: true, stage });
};
