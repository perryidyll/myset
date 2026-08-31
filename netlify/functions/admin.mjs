import { getShow, mutateShow, readFans, clearAllFanVotes, voteCounts,
         firstVotedAt, rankSongs, json, bad, requireArtist, slug, sha,
         normPacks, normAsk, newShowId, carryFans, STARTER_SONGS,
         GENRES, GENRE_IDS, cleanKey, cleanTagLabel, tagId, normOwnTags,
         MAX_OWN_TAGS, MAX_SONG_TAGS, playable } from './_lib.mjs';
import { readLists, mutateLists, readLearn, mutateLearn, applyList, refreshActive,
         shapeLists, MAX_LISTS, MAX_NAME, MAX_LEARN } from './_lists.mjs';
import { readChart, saveChart, chartFlags, MAX_CHART } from './_chart.mjs';
import { genresFor, MAP_SIZE } from './_genremap.mjs';
import { readRequests, shapeRequests, resolveRequest, attachSong } from './_requests.mjs';
import { readArtists, mutateArtists } from './_auth.mjs';
import { sendPitch, shapeForArtist, readPitches } from './_pitch.mjs';
import { addVouch, readVouches, artistPlaysAt, MIN_VOUCHES } from './_verify.mjs';
import { archiveShow } from './_history.mjs';
import { mutateProfile, getProfile, shapeMedia, parseMedia } from './_profile.mjs';
import { lookup } from './_embeds.mjs';
import { readLyrics, saveLyrics, getLyrics } from './_lyrics.mjs';
import { readEvents, mutateEvents, normEvent, reindexCities, occurrencesFor, endTimeOf,
         nextOccurrence, MAX_EVENTS } from './_events.mjs';
import { stagePayload } from './stage.mjs';
import { decodeDataUrl, putImage, dropImage, SLOTS } from './_img.mjs';
import { PLANS, PLAN_KEYS, planForArtist, isPlatformOwner, redeemPromo,
         readPromos, mutatePromos, cleanCode, MAX_LIBRARY } from './_plan.mjs';

/* Plans, entitlements and the codes Perry hands out. */
async function handlePlan(aid, action, body) {
  const { plan, limits, artist } = await planForArtist(aid);

  if (action === 'planGet') {
    return json({ ok: true, plan, limits: shapeLimits(limits),
                  shareStats: !artist || artist.shareStats !== false,
                  until: (artist && artist.planUntil) || null,
                  comped: !!(artist && artist.compedBy),
                  discountPct: (artist && artist.discountPct) || 0,
                  plans: Object.fromEntries(PLAN_KEYS.map((k) => [k, shapeLimits(PLANS[k])])),
                  owner: isPlatformOwner(aid) });
  }

  if (action === 'promoRedeem') return json(await redeemPromo(aid, body.code));

  /* A venue seeing how many people turned up to a show IN THEIR OWN ROOM is the
     single biggest reason a venue signs up — and it is still the artist's data.
     Default on, because the ecosystem needs it; their switch, because it's
     theirs. Money is never in that payload at all. */
  if (action === 'shareStats') {
    await mutateArtists((r) => {
      const a = r.byId[aid];
      if (!a) return false;
      a.shareStats = body.on !== false;
      return true;
    });
    const r = await readArtists();
    return json({ ok: true, shareStats: (r.byId[aid] || {}).shareStats !== false });
  }

  /* ---- owner only, from here ---- */
  if (!isPlatformOwner(aid)) return bad('unauthorized', 401);

  if (action === 'promoList') {
    const d = await readPromos();
    return json({ ok: true, codes: Object.entries(d.codes).map(([code, c]) => ({
      code, plan: c.plan, pct: c.pct, months: c.months,
      maxUses: c.maxUses || 0, used: (c.usedBy || []).length, revoked: !!c.revoked })) });
  }

  if (action === 'promoCreate') {
    const code = cleanCode(body.code);
    if (code.length < 4) return bad('A code needs at least 4 characters');
    const pct = Math.max(1, Math.min(100, parseInt(body.pct, 10) || 100));
    const planKey = PLAN_KEYS.includes(body.plan) ? body.plan : 'pro';
    const months = Math.max(1, Math.min(60, parseInt(body.months, 10) || 12));
    const maxUses = Math.max(0, Math.min(9999, parseInt(body.maxUses, 10) || 0));
    let taken = false;
    await mutatePromos((d) => {
      if (d.codes[code]) { taken = true; return false; }
      d.codes[code] = { plan: planKey, pct, months, maxUses, usedBy: [], createdAt: Date.now() };
      return true;
    });
    if (taken) return bad('That code already exists');
    const d = await readPromos();
    return json({ ok: true, codes: Object.entries(d.codes).map(([c, v]) => ({
      code: c, plan: v.plan, pct: v.pct, months: v.months,
      maxUses: v.maxUses || 0, used: (v.usedBy || []).length, revoked: !!v.revoked })) });
  }

  /* Verifying a venue is a judgement call, so it is Perry's alone. Any venue can
     get itself verified instantly by proving it owns its website's domain; this
     is for everyone else — see VERIFYING-A-VENUE.md. */
  if (action === 'venueList' || action === 'venueVerify') {
    const { readVenues, mutateVenues } = await import('./_venues.mjs');
    if (action === 'venueVerify') {
      const vid = String(body.venue || '').slice(0, 40);
      await mutateVenues((r) => {
        const v = r.byId[vid];
        if (!v) return false;
        v.verified = !v.verified;
        v.verifiedVia = v.verified ? 'owner' : null;
        v.verifiedAt = v.verified ? Date.now() : null;
        return true;
      });
    }
    const r = await readVenues();
    return json({ ok: true, venues: Object.entries(r.byId).map(([vid, v]) => ({
      venueId: vid, slug: v.slug, name: v.name, city: v.city, country: v.country,
      verified: !!v.verified, via: v.verifiedVia || null, createdAt: v.createdAt || 0,
    })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) });
  }

  if (action === 'promoRevoke') {
    const code = cleanCode(body.code);
    await mutatePromos((d) => { if (d.codes[code]) d.codes[code].revoked = !d.codes[code].revoked; return true; });
    const d = await readPromos();
    return json({ ok: true, codes: Object.entries(d.codes).map(([c, v]) => ({
      code: c, plan: v.plan, pct: v.pct, months: v.months,
      maxUses: v.maxUses || 0, used: (v.usedBy || []).length, revoked: !!v.revoked })) });
  }
  return bad('unknown action', 400);
}
const shapeLimits = (l) => ({
  label: l.label, price: l.price,
  featured: l.featured === Infinity ? null : l.featured,
  library: MAX_LIBRARY,
  cut: l.cut, seats: l.seats,
  promote: l.promote, analytics: l.analytics, presskit: l.presskit, branding: l.branding,
});
const PLAN_ACTIONS = new Set(['planGet', 'promoRedeem', 'promoList', 'promoCreate', 'promoRevoke',
                              'venueList', 'venueVerify', 'shareStats']);

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
                           address: ev.address || '',
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
    // a setlist that no longer exists must not stick to a gig
    if (ev.listId) {
      const known = new Set((await readLists(aid)).lists.map((l) => l.id));
      if (!known.has(ev.listId)) ev.listId = '';
    }
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

/* An artist asking a venue for a spot, and an artist confirming they play at one.
   Both need an artist session — that IS the feature. A venue gets a link to a
   real page with real numbers on it instead of a bio and a promise, and a vouch
   means somebody with their own account and their own gig history. */
async function handleVenueSide(aid, action, body) {
  const { venueBySlug, venueById, getVenueProfile, shapeVenue } = await import('./_venues.mjs');
  const reg = await readArtists();
  const me = reg.byId[aid] || {};

  if (action === 'pitchList')
    return json({ ok: true, pitches: await shapeForArtist(aid) });

  const slug = String(body.venue || '').slice(0, 40);
  if (!slug) return bad('which venue?', 400);
  const vid = await venueBySlug(slug);
  if (!vid) return bad('unknown venue', 404);
  const venue = shapeVenue(await getVenueProfile(vid), await venueById(vid));

  if (action === 'pitchStatus') {
    const [d, vouches, canVouch] = await Promise.all([
      readPitches(vid), readVouches(vid), artistPlaysAt(aid, venue)]);
    const mine = (d.list || []).find((x) => x.aid === aid);
    return json({ ok: true,
      sent: !!mine, status: mine ? mine.status : null, message: mine ? mine.message : '',
      canVouch, vouched: !!(vouches.by || {})[aid],
      vouches: Object.keys(vouches.by || {}).length, need: MIN_VOUCHES,
      venue: { name: venue.name, slug: venue.slug, verified: venue.verified } });
  }

  if (action === 'pitchSend') {
    const r = await sendPitch({ vid, venueName: venue.name, venueSlug: venue.slug, aid,
                                artist: { slug: me.slug || '', name: me.name || '' },
                                message: body.message });
    if (!r.ok) return bad(r.error);
    return json({ ok: true, already: r.already, updated: r.updated,
                  pitches: await shapeForArtist(aid) });
  }

  if (action === 'vouch') {
    const r = await addVouch(vid, aid, { slug: me.slug || '', name: me.name || '' }, venue);
    if (!r.ok) return bad(r.error);
    return json({ ok: true, ...r });
  }
  return bad('unknown action', 400);
}
const VENUE_SIDE = new Set(['pitchList', 'pitchStatus', 'pitchSend', 'vouch']);

/* Everything the song sheet needs, in one round trip: the song, its chart, its
   audience lyrics, and the whole tag vocabulary. Charts live in their own
   documents so this never touches the show record. */
async function handleSong(aid, action, body, show) {
  const vocab = () => ({
    builtin: GENRES.map(([id, label]) => ({ id, label })),
    own: show.tags, maxOwn: MAX_OWN_TAGS, maxPerSong: MAX_SONG_TAGS,
  });

  if (action === 'songGet') {
    const song = show.songs.find((x) => x.id === body.song);
    if (!song) return bad('unknown song', 404);
    const [chart, lyr] = await Promise.all([
      readChart(aid, song.id), readLyrics(aid, song.id),
    ]);
    return json({ ok: true, song: {
      id: song.id, title: song.title, artist: song.artist || '',
      key: song.key || '', tags: song.tags || [], active: song.active !== false,
    }, chart, lyrics: {
      plain: (lyr && lyr.plain) || '', credit: (lyr && lyr.credit) || '',
      state: (lyr && lyr.state) || 'unfetched', owned: !!(lyr && lyr.owned),
    }, tags: vocab() });
  }

  if (action === 'chartSet') {
    const song = show.songs.find((x) => x.id === body.song);
    if (!song) return bad('unknown song', 404);
    await saveChart(aid, song.id, body.chart);
    return json({ ok: true, chart: await readChart(aid, song.id) });
  }

  if (action === 'chartFlags')
    return json({ ok: true, flags: await chartFlags(aid, show.songs.map((x) => x.id)) });

  if (action === 'tagList')
    return json({ ok: true, tags: vocab(), untagged: show.songs.filter((x) => !(x.tags || []).length).length });

  /* Fill in the genres, from a curated map of how streaming services actually
     classify these songs. Only ever fills a song that has NONE — an artist's own
     choice is never overwritten, so running it twice is safe and running it after
     hand-tagging leaves the hand-tagging alone. */
  if (action === 'tagAuto') {
    const { artistById } = await import('./_auth.mjs');
    const me = await artistById(aid);
    const owner = (me && me.name) || '';
    let filled = 0, kept = 0, unknown = [];
    await mutateShow(aid, (sh) => {
      const known = new Set([...GENRE_IDS, ...sh.tags.map((t) => t.id)]);
      for (const sg of sh.songs) {
        if ((sg.tags || []).length) { kept++; continue; }
        const g = genresFor(sg.title, sg.artist, owner).filter((x) => known.has(x));
        if (!g.length) { unknown.push(sg.title); continue; }
        sg.tags = g.slice(0, MAX_SONG_TAGS);
        filled++;
      }
      return filled > 0;
    });
    await refreshActive(aid).catch(() => {});
    return json({ ok: true, filled, kept, unknown: unknown.slice(0, 40),
                  unknownCount: unknown.length, mapSize: MAP_SIZE,
                  stage: await stagePayload(aid) });
  }

  if (action === 'tagAdd') {
    const label = cleanTagLabel(body.label);
    if (!label) return bad('Give it a name');
    let why = null;
    await mutateShow(aid, (sh) => {
      const next = normOwnTags([...(sh.tags || []), { label }]);
      if (next.length === (sh.tags || []).length) {
        why = (sh.tags || []).length >= MAX_OWN_TAGS
          ? `That's ${MAX_OWN_TAGS} of your own genres — plenty. Rename one instead.`
          : 'You’ve already got that one (or it’s one of the built-in genres).';
        return false;
      }
      sh.tags = next;
      return true;
    });
    if (why) return bad(why);
    const fresh = await getShow(aid);
    return json({ ok: true, tags: { builtin: GENRES.map(([id, label]) => ({ id, label })),
      own: fresh.tags, maxOwn: MAX_OWN_TAGS, maxPerSong: MAX_SONG_TAGS } });
  }

  if (action === 'tagRemove') {
    const id = String(body.id || '');
    if (!id.startsWith('c-')) return bad('The built-in genres stay put');
    await mutateShow(aid, (sh) => {
      sh.tags = (sh.tags || []).filter((t) => t.id !== id);
      // and off every song, so nothing points at a tag that no longer exists
      sh.songs = sh.songs.map((x) => ({ ...x, tags: (x.tags || []).filter((t) => t !== id) }));
      return true;
    });
    const fresh = await getShow(aid);
    return json({ ok: true, tags: { builtin: GENRES.map(([id2, label]) => ({ id: id2, label })),
      own: fresh.tags, maxOwn: MAX_OWN_TAGS, maxPerSong: MAX_SONG_TAGS } });
  }
  return bad('unknown action', 400);
}
const SONG_ACTIONS = new Set(['songGet', 'chartSet', 'chartFlags', 'tagList', 'tagAdd',
                              'tagRemove', 'tagAuto']);

/* SETLISTS and the to-learn list. Both live in their own documents, so none of
   this touches the record the room polls — except `listUse`, which has to write
   the projection (see the note in _lists.mjs). */
async function handleLists(aid, action, body) {
  const show = await getShow(aid);
  const send = async (extra = {}) => {
    const [d, sh] = [await readLists(aid), await getShow(aid)];
    return json({ ok: true, lists: shapeLists(d, sh),
                  listId: sh.listId, listName: sh.listName, ...extra });
  };

  if (action === 'listAll') return send();

  if (action === 'listNew') {
    const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
    if (!name) return bad('Give the set a name');
    const id = 'l' + Math.random().toString(36).slice(2, 9);      // outside the CAS
    let full = false;
    await mutateLists(aid, (d) => {
      if (d.lists.length >= MAX_LISTS) { full = true; return false; }
      d.lists.push({ id, name, songs: Array.isArray(body.songs) ? body.songs : [], at: Date.now() });
      return true;
    });
    if (full) return bad(`${MAX_LISTS} setlists is plenty — rename one instead.`);
    return send({ id });
  }

  if (action === 'listRename') {
    const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
    if (!name) return bad('It needs a name');
    await mutateLists(aid, (d) => {
      const l = d.lists.find((x) => x.id === body.id);
      if (!l) return false;
      l.name = name;
      return true;
    });
    await refreshActive(aid);                 // the name is projected too
    return send();
  }

  if (action === 'listDelete') {
    await mutateLists(aid, (d) => { d.lists = d.lists.filter((x) => x.id !== body.id); return true; });
    // if the one in play just went, fall back to the whole library
    if (show.listId === body.id) await applyList(aid, '');
    return send();
  }

  if (action === 'listSongs') {          // set the whole membership at once
    const want = [...new Set((Array.isArray(body.songs) ? body.songs : [])
      .filter((x) => typeof x === 'string'))];
    const have = new Set(show.songs.map((x) => x.id));
    const songs = want.filter((x) => have.has(x));
    await mutateLists(aid, (d) => {
      const l = d.lists.find((x) => x.id === body.id);
      if (!l) return false;
      l.songs = songs;
      return true;
    });
    if (show.listId === body.id) await applyList(aid, body.id);
    return send();
  }

  if (action === 'listToggle') {         // one song in or out
    let now = null;
    await mutateLists(aid, (d) => {
      const l = d.lists.find((x) => x.id === body.id);
      if (!l) return false;
      const at = l.songs.indexOf(body.song);
      if (at >= 0) { l.songs.splice(at, 1); now = false; } else { l.songs.push(body.song); now = true; }
      return true;
    });
    if (now === null) return bad('unknown setlist', 404);
    if (show.listId === body.id) await applyList(aid, body.id);
    return send({ inList: now });
  }

  if (action === 'listUse') {
    const r = await applyList(aid, body.id || '');
    return send({ used: r });
  }

  /* ---------- songs to learn ---------- */
  if (action === 'learnList') return json({ ok: true, learn: (await readLearn(aid)).list });

  if (action === 'learnAdd') {
    const title = String(body.title || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!title) return bad('What song?');
    const id = 'w' + Math.random().toString(36).slice(2, 9);
    let full = false;
    await mutateLearn(aid, (d) => {
      if (d.list.length >= MAX_LEARN) { full = true; return false; }
      d.list.push({ id, title, artist: String(body.artist || '').trim().slice(0, 60),
                    note: String(body.note || '').trim().slice(0, 140), at: Date.now() });
      return true;
    });
    if (full) return bad('That is a long list already — learn a few first.');
    return json({ ok: true, learn: (await readLearn(aid)).list });
  }

  if (action === 'learnRemove') {
    await mutateLearn(aid, (d) => { d.list = d.list.filter((x) => x.id !== body.id); return true; });
    return json({ ok: true, learn: (await readLearn(aid)).list });
  }

  /* Learned it. Moves the row into the real library and drops it from the list —
     one action, because doing it in two leaves a duplicate if the second fails. */
  if (action === 'learnDone') {
    const d0 = await readLearn(aid);
    const row = d0.list.find((x) => x.id === body.id);
    if (!row) return bad('unknown song', 404);
    const cap = (await planForArtist(aid)).limits.featured;
    const featureCap = cap === Infinity ? null : cap;
    const { artistById } = await import('./_auth.mjs');
    const ownerName = ((await artistById(aid)) || {}).name || '';
    let sid = null, note = null;
    await mutateShow(aid, (sh) => {
      if (sh.songs.length >= MAX_LIBRARY) return false;
      let id = slug(row.title);
      if (sh.songs.some((x) => x.id === id)) id += '-' + Math.random().toString(36).slice(2, 5);
      const live = sh.songs.filter((x) => x.active !== false).length;
      const on = featureCap === null || live < featureCap;
      if (!on) note = `Added, but switched off — your plan features ${featureCap} at a time.`;
      // it arrives with genres already on, same as auto-tag would give it
      const known = new Set([...GENRE_IDS, ...sh.tags.map((t) => t.id)]);
      const tags = genresFor(row.title, row.artist, ownerName)
        .filter((x) => known.has(x)).slice(0, MAX_SONG_TAGS);
      sh.songs.push({ id, title: row.title, artist: row.artist || '', active: on, key: '', tags });
      sid = id;
      return true;
    });
    if (!sid) return bad(`That's ${MAX_LIBRARY} songs — more than any setlist needs.`, 402);
    await mutateLearn(aid, (d) => { d.list = d.list.filter((x) => x.id !== body.id); return true; });
    return json({ ok: true, songId: sid, note,
                  learn: (await readLearn(aid)).list, stage: await stagePayload(aid) });
  }
  return bad('unknown action', 400);
}
const LIST_ACTIONS = new Set(['listAll', 'listNew', 'listRename', 'listDelete', 'listSongs',
  'listToggle', 'listUse', 'learnList', 'learnAdd', 'learnRemove', 'learnDone']);

/* Requests live in their own document, so accepting or declining one never
   rewrites the show — except for `askAccept`, which has to add a song. */
async function handleAsks(aid, action, body) {
  const show = await getShow(aid);

  if (action === 'askList')
    return json({ ok: true, asks: shapeRequests(await readRequests(aid), show) });

  const id = String(body.id || '').slice(0, 24);
  if (!id) return bad('which request?', 400);

  if (action === 'askDone' || action === 'askDecline') {
    const row = await resolveRequest(aid, id, action === 'askDone' ? 'played' : 'declined', show);
    if (!row) return bad('That one has already been dealt with', 409);
    return json({ ok: true, refunded: action === 'askDecline' ? row.cost : 0,
                  asks: shapeRequests(await readRequests(aid), show), stage: await stagePayload(aid) });
  }

  if (action === 'askAccept') {
    const d = await readRequests(aid);
    const row = (d.list || []).find((x) => x.id === id);
    if (!row) return bad('unknown request', 404);
    if (row.kind !== 'song') return bad('Nothing to add for that one', 400);

    const cap = (await planForArtist(aid)).limits.featured;
    const featureCap = cap === Infinity ? null : cap;
    let songId = null, full = false;
    await mutateShow(aid, (sh) => {
      if (sh.songs.length >= MAX_LIBRARY) { full = true; return false; }
      let sid = slug(row.title);
      if (sh.songs.some((x) => x.id === sid)) {
        const had = sh.songs.find((x) => x.id === sid);
        songId = had.id;
        if (had.active === false) had.active = true;         // it was hidden — bring it back
        return true;
      }
      const live = sh.songs.filter((x) => x.active !== false).length;
      const on = featureCap === null || live < featureCap;
      sh.songs.push({ id: sid, title: row.title, artist: row.artist || '', active: on,
                      requested: true });
      songId = sid;
      return true;
    });
    if (full) return bad(`That's ${MAX_LIBRARY} songs — more than any setlist needs.`, 402);
    await attachSong(aid, id, songId);
    return json({ ok: true, songId, asks: shapeRequests(await readRequests(aid), show),
                  stage: await stagePayload(aid) });
  }
  return bad('unknown action', 400);
}
const ASK_ACTIONS = new Set(['askList', 'askAccept', 'askDone', 'askDecline']);

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

  /* A photo straight off the phone. The browser has already shrunk it; this
     checks the bytes really are an image and stores them against the artist. */
  if (action === 'photoUpload') {
    const slot = String(body.slot || '');
    if (!SLOTS.has(slot)) return bad('unknown photo slot');
    const dec = decodeDataUrl(body.data);
    if (dec.error) return bad(dec.error);
    const url = await putImage(aid, slot, dec.bytes, dec.type);
    await mutateProfile(aid, (p) => {
      if (slot === 'cover') p.photo = url;
      else if (slot === 'avatar') p.avatar = url;
      else {
        const i = Number(slot.slice(1));
        p.photos = Array.isArray(p.photos) ? p.photos : [];
        while (p.photos.length <= i) p.photos.push('');
        p.photos[i] = url;
      }
      return true;
    });
    return json({ ok: true, url, profile: await getProfile(aid) });
  }

  if (action === 'photoClear') {
    const slot = String(body.slot || '');
    if (!SLOTS.has(slot)) return bad('unknown photo slot');
    await dropImage(aid, slot);
    await mutateProfile(aid, (p) => {
      if (slot === 'cover') p.photo = '';
      else if (slot === 'avatar') p.avatar = '';
      else {
        const i = Number(slot.slice(1));
        if (Array.isArray(p.photos) && p.photos[i]) p.photos[i] = '';
      }
      return true;
    });
    return json({ ok: true, profile: await getProfile(aid) });
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
const PROFILE_ACTIONS = new Set(['profileSet', 'mediaAdd', 'mediaRemove', 'mediaMove',
                                 'photoUpload', 'photoClear']);

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
  if (LIST_ACTIONS.has(action)) return handleLists(aid, action, body);
  if (SONG_ACTIONS.has(action)) return handleSong(aid, action, body, await getShow(aid));
  if (VENUE_SIDE.has(action)) return handleVenueSide(aid, action, body);
  if (ASK_ACTIONS.has(action)) return handleAsks(aid, action, body);
  if (EVENT_ACTIONS.has(action)) return handleEvents(aid, action, body);
  if (PLAN_ACTIONS.has(action)) return handlePlan(aid, action, body);

  let err = null, resetVotes = false, wipe = false, note = null;

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

  /* Two different ceilings, and the distinction matters: you can KEEP up to
     MAX_LIBRARY songs on any plan; the plan only limits how many are live to the
     audience at once. Going over just means the extras arrive switched off. */
  let featureCap = null;
  if (['addSong', 'starterSetlist', 'toggleSong'].includes(action)) {
    const f = (await planForArtist(aid)).limits.featured;
    featureCap = f === Infinity ? null : f;
  }

  /* Going live picks up the setlist the artist chose for tonight's gig, if they
     chose one. Resolved BEFORE the mutation, because it needs the calendar, and
     applied after, because applyList writes the show record itself. */
  let autoList = null;
  if (action === 'status' && body.status === 'live') {
    try {
      const occ = nextOccurrence(await readEvents(aid), Date.now());
      // only a gig that is on now or within the next few hours — not next Tuesday's
      if (occ && occ.listId && occ.startsAt - Date.now() < 6 * 3600e3) autoList = occ.listId;
    } catch { /* never block starting a show on the calendar */ }
  }
  let newSongId = null;                       // so the sheet can keep editing it
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
        // the same pool the audience is looking at, or the two screens disagree
        const pool = rankSongs(
          playable(show).songs
            .filter((s) => s.id !== show.nowPlaying)
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
        const sg = show.songs.find((x) => x.id === body.song);
        if (!sg) break;
        const turningOn = sg.active === false;
        if (turningOn && featureCap !== null) {
          const liveNow = show.songs.filter((x) => x.active !== false).length;
          if (liveNow >= featureCap) {
            err = [`Your plan features ${featureCap} songs at a time. Switch one off first, or upgrade.`, 402];
            return false;
          }
        }
        sg.active = turningOn;
        break;
      }
      case 'addSong': {
        const title = String(body.title || '').trim().slice(0, 80);
        if (!title) { err = ['no title', 400]; return false; }
        // over the featured limit? it still gets added, just switched off
        const liveNow = show.songs.filter((x) => x.active !== false).length;
        const startsOff = featureCap !== null && liveNow >= featureCap;
        if (show.songs.length >= MAX_LIBRARY) {
          err = [`That's ${MAX_LIBRARY} songs — more than any setlist needs.`, 402]; return false;
        }
        const artist = String(body.artist || '').trim().slice(0, 60);
        let id = slug(title);
        if (show.songs.some((s) => s.id === id)) id += '-' + Math.random().toString(36).slice(2, 5);
        const known = new Set([...GENRE_IDS, ...show.tags.map((t) => t.id)]);
        show.songs.push({ id, title, artist, active: !startsOff,
          key: cleanKey(body.key),
          tags: [...new Set((Array.isArray(body.tags) ? body.tags : []).filter((t) => known.has(t)))]
            .slice(0, MAX_SONG_TAGS) });
        newSongId = id;
        if (startsOff) note = `Added, but switched off — your plan features ${featureCap} at a time.`;
        break;
      }
      case 'editSong': {
        const sg = show.songs.find((x) => x.id === body.song);
        if (!sg) { err = ['unknown song', 404]; return false; }
        if (typeof body.title === 'string' && body.title.trim()) sg.title = body.title.trim().slice(0, 80);
        if (typeof body.artist === 'string') sg.artist = body.artist.trim().slice(0, 60);
        if (typeof body.key === 'string') sg.key = cleanKey(body.key);
        if (Array.isArray(body.tags)) {
          const known = new Set([...GENRE_IDS, ...show.tags.map((t) => t.id)]);
          sg.tags = [...new Set(body.tags.filter((t) => known.has(t)))].slice(0, MAX_SONG_TAGS);
        }
        break;
      }
      case 'packs': {
        show.packs = normPacks({ small: body.small, big: body.big, max: body.max });
        break;
      }
      case 'askSet': {
        const which = body.kind === 'birthday' ? 'birthdays' : 'requests';
        const cur = show[which];
        show[which] = normAsk({
          on: body.on === undefined ? cur.on : !!body.on,
          cost: body.cost === undefined ? cur.cost : body.cost,
        });
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
        let live = show.songs.filter((x) => x.active !== false).length;
        for (const [t, a] of STARTER_SONGS) {
          if (show.songs.length >= MAX_LIBRARY) break;
          const id = slug(t);
          if (have.has(id)) continue;
          const on = featureCap === null || live < featureCap;
          show.songs.push({ id, title: t, artist: a, active: on });
          if (on) live++;
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
  /* Anything that changed the library could have changed what is in the active
     setlist, so the projection is refreshed. This is the "migrate every call site"
     rule: if you add another way to add or remove a song, it belongs in this list. */
  if (['addSong', 'removeSong', 'editSong', 'starterSetlist', 'clearSetlist',
       'toggleSong'].includes(action)) await refreshActive(aid).catch(() => {});

  if (autoList) {
    try {
      const r = await applyList(aid, autoList);
      if (r.listName) note = `Playing your “${r.listName}” tonight — ${r.count} songs.`;
    } catch { /* the show is live either way */ }
  }
  // paid votes survive a reset — only a fan who gifted them loses them
  if (wipe) await carryFans(aid, prevShow || (await getShow(aid)));
  else if (resetVotes) await clearAllFanVotes(aid);

  // Hand the fresh state back with the write. Without this the Studio does a
  // second round trip for every tap, which is most of why buttons felt slow.
  let stage = null;
  try { stage = await stagePayload(aid); } catch { /* the write still succeeded */ }
  return json({ ok: true, stage, note, songId: newSongId });
};
