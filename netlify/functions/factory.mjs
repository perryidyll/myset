import { guard } from './_errlog.mjs';
import { json, bad, requireArtist, casDoc, readDoc } from './_lib.mjs';
import { isPlatformOwner } from './_plan.mjs';
import { readSampleReg, mutateSampleReg, readArchive, readStats, linkFor, SAMPLE, isVenueOwner, bump, noteSample,
         removeSample, reviveSample, undoClaim, UNDO_MS, createSample, optOut, readFactoryCfg as readCfg, mutateFactoryCfg,
         defaultFactoryCfg as defaultCfg } from './_sample.mjs';

/* THE SAMPLE FACTORY'S CONSOLE, server side (decision 0101) — myset.vip/factory.

   The founder's alone: the founding page's OWNER seat, the same gate the platform
   tools behind it use (decision 0099). A band mate signed in to the founding page is
   on that page too, and this reads every sample and can build and erase them.

   It never builds anything itself — a build is minutes of fetching and Claude, far
   past a request's life. It writes jobs to `factoryq` and nudges the background
   worker (factory-background.mjs), which the five-minute ring (factorycron.mjs) also
   drains. Everything else here is small reads and writes on the sample documents.

   THE MESSAGES. The three first-contact drafts and the follow-up are written here,
   from one set of words, so the console and anything else that shows them agree.
   Every one says what the page is, where it came from (Thailand's PDPA and the GDPR
   ask for the source at first contact), that only the link opens it, that claiming
   is free, that there are thirty days to claim it before it comes down, and that a
   word from them deletes it forever: nobody taps anything to say no (the founder's
   call, 2026-09-28). The founder sends them by hand: MySet's own mail sender carries
   sign-in codes, and cold mail through it could cost every artist their way in. */

const Q = 'factoryq';
const emptyQ = () => ({ v: 1, jobs: [], day: '', started: 0 });

const SRCWORD = { youtube: 'YouTube', website: 'website', instagram: 'Instagram', spotify: 'Spotify', apple: 'Apple Music',
  musicbrainz: 'MusicBrainz', facebook: 'Facebook', tiktok: 'TikTok', soundcloud: 'SoundCloud', osm: 'OpenStreetMap', google: 'Google Maps' };
const listWords = (a) => (a.length <= 1 ? (a[0] || '') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
function sourceWords(rec) {
  const seen = [];
  for (const s of (rec && rec.sources) || []) { const w = SRCWORD[s && s.kind]; if (w && !seen.includes(w)) seen.push(w); }
  return listWords(seen.slice(0, 3)) || 'public pages';
}

/* THE DRAFTS. Short on purpose: a DM is read on a phone between sets. The hook is the
   factory's one true, specific line about them, or nothing — never a compliment it
   could not source. */
export function messagesFor(row, rec, link, cfg) {
  const venue = row.k === 'v';
  /* "Hey Tide Lines", not "Hey The Tide Lines": a band is greeted the way people say it */
  const first = String((rec && rec.first) || row.name || 'there').replace(/^the\s+/i, '');
  const hook = String((rec && rec.msgs && rec.msgs.hook) || '').trim();
  const from = sourceWords(rec);
  const sign = String(cfg.signoff || 'The MySet team').trim();
  const days = Math.max(1, Math.ceil(((row.exp || Date.now()) - Date.now()) / 86400e3));
  const window = days >= 29 ? '30 days' : `${days} day${days === 1 ? '' : 's'}`;
  const addr = String(cfg.address || '').trim();

  if (venue) {
    const dm = `Hi ${row.name} team! ${hook || 'I play live music around town and wanted to show you something.'}

I run MySet: the crowd votes on the next song from their phones and tips the artist on the spot. I built ${row.name} a page to show you what it looks like: your photos, hours, directions, and the live nights on your calendar.

${link}

It isn't published anywhere (only this link opens it) and it's made from your public ${from}. It's free to claim, and you can change anything. You've got ${window} to claim it before it comes down.

Don't want it? Let us know and we'll delete this preview forever – no harm, no foul!

${sign}`;
    const body = `Hi ${row.name} team,

${hook ? hook + '\n\n' : ''}I run MySet, a free app for live-music nights: the room votes on the next song from their phones and tips the artist on the spot, and every show is listed on the venue's own page.

I built you a preview page to show what yours could look like: your photos, opening hours, directions and live nights, all from your public ${from}:

${link}

It isn't published: only this link opens it, and search engines can't see it. If you like it, tap Claim profile. It's free, takes a minute, and you can change anything. You have ${window} to claim it before it comes down.

Don't want it? Let us know and we'll delete this preview forever – no harm, no foul!

${sign}
MySet · myset.vip

You're getting this because your venue's details are public online. Reply "stop" and we won't contact you again.${addr ? '\n' + addr : ''}`;
    const inperson = `"Hi, is the manager or owner around? I play here sometimes. I run MySet: the crowd votes on the next song from their phones and tips the band, and your live nights get their own page. I've already built one for ${row.name}. Want to see it?" [show it on your phone]
"It isn't published anywhere, and I'll message you the link. Claiming it is free, and it stays up for ${window}. Don't want it? Just tell me and I'll delete it forever, no harm, no foul."

Then send the DM so they have the link.`;
    const followup = `Hi ${row.name} team, a while back I built you a MySet page. I've brought it back for another 30 days in case the timing's better now:

${link}

Same deal: it's free to claim, and if you don't want it, let us know and we'll delete it forever. No harm, no foul!

${sign}`;
    return { dm, email: { subject: `A MySet page for ${row.name}`, body }, inperson, followup, needsAddress: !addr };
  }

  const dm = `Hey ${first}! ${hook || 'I came across your music and wanted to show you something.'}

I run MySet: the crowd votes on your next song from their phones and tips you right there. I built you a page to show you what yours would look like:

${link}

It isn't published anywhere (only this link opens it) and it's made from your public ${from}. It's free to claim, and you can change anything. You've got ${window} to claim it before it comes down.

Don't want it? Let us know and we'll delete this preview forever – no harm, no foul!

${sign}`;
  const body = `Hi ${first},

${hook ? hook + '\n\n' : ''}I run MySet, a free app for live music: the room votes on your next song from their phones and tips you on the spot, straight to your bank.

I built you a preview page to show what yours could look like: your photos, a short bio, your links and your best videos, all from your public ${from}:

${link}

It isn't published: only this link opens it, and search engines can't see it. If you like it, tap Claim profile. It's free, takes a minute, and you can change anything. You have ${window} to claim it before it comes down.

Don't want it? Let us know and we'll delete this preview forever – no harm, no foul!

${sign}
MySet · myset.vip

You're getting this because your music is public online. Reply "stop" and we won't contact you again.${addr ? '\n' + addr : ''}`;
  const inperson = `"Loved your set! I run MySet: the crowd votes on your next song from their phones and tips you right there. I've already built you a page. Want to see it?" [show it on your phone]
"It isn't published anywhere, and I'll DM you the link. Claiming it is free, and it stays up for ${window}. Don't want it? Just tell me and I'll delete it forever, no harm, no foul."

Then send the DM so they have the link.`;
  const followup = `Hey ${first}, a while back I built you a MySet page. I've brought it back for another 30 days in case the timing's better now:

${link}

Same deal: it's free to claim, and if you don't want it, let us know and we'll delete it forever. No harm, no foul!

${sign}`;
  return { dm, email: { subject: `${first}, I built you a MySet page`, body }, inperson, followup, needsAddress: !addr };
}

/* Nudge the worker for up to `n` queued jobs, within the day's cap. The cron does the
   same every five minutes; this is the "Build" button not waiting for it. */
export async function startJobs(n = 3, origin = '') {
  const cfg = await readCfg();
  const day = new Date().toISOString().slice(0, 10);
  let picked = [];
  await casDoc(Q, emptyQ, (q) => {
    q.jobs ||= [];
    if (q.day !== day) { q.day = day; q.started = 0; }
    const room = Math.max(0, Math.min(n, (Number(cfg.perDay) || 40) - (q.started || 0)));
    picked = q.jobs.filter((j) => j.st === 'queued').slice(0, room).map((j) => j.id);
    if (!picked.length) return false;
    for (const j of q.jobs) if (picked.includes(j.id)) { j.st = 'running'; j.stage = 'seed'; j.pct = 2; j.upd = Date.now(); }
    q.started = (q.started || 0) + picked.length;
    return true;
  });
  if (!picked.length) return 0;
  const { createHmac } = await import('node:crypto');
  const { authSecret } = await import('./_auth.mjs');
  const key = createHmac('sha256', await authSecret()).update('factory').digest('base64url');
  const site = origin || process.env.URL || 'https://myset.vip';
  await Promise.all(picked.map((id) => fetch(`${site}/.netlify/functions/factory-background`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-factory-key': key },
    body: JSON.stringify({ id }), signal: AbortSignal.timeout(5000),
  }).catch(() => null)));
  return picked.length;
}

const clean = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const newId = () => 'j' + Math.random().toString(36).slice(2, 10);
/* One shape for a live page everywhere the console reads one — the list, the detail, a
   reply to Mark sent — so a card never has to guess which spelling it was handed. */
const liveRow = (owner, r) => ({ owner, kind: r.k === 'v' ? 'venue' : 'artist', slug: r.slug, name: r.name,
  st: r.st, at: r.at, exp: r.exp, sent: r.sent || 0, ch: r.ch || '', op: r.op || 0, n: r.n || 0, cp: r.cp || 1,
  q: r.q || 0, rv: !!r.rv, cover: r.cv || '', city: r.city || '' });

const main = async (req) => {
  const me = await requireArtist(req);
  if (!me) return bad('unauthorized', 401);
  if (!isPlatformOwner(me.aid) || (me.role || 'owner') !== 'owner') return bad('unauthorized', 401);
  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }
  const action = body.action;
  const origin = new URL(req.url).origin;

  if (action === 'summary') {
    const [reg, arc, stats, cfg, q] = await Promise.all([readSampleReg(), readArchive(), readStats(), readCfg(), readDoc(Q, null)]);
    const month = new Date().toISOString().slice(0, 7);
    return json({ ok: true, cfg,
      keys: { anthropic: !!process.env.ANTHROPIC_API_KEY, youtube: !!process.env.YOUTUBE_API_KEY },
      stats: { month, ...(stats[month] || {}) },
      queue: (((q.data || {}).jobs) || []).slice(-100).reverse().map((j) => ({ id: j.id, kind: j.kind, label: j.label || '',
        st: j.st, stage: j.stage || '', pct: j.pct || 0, err: j.err || '', owner: j.owner || '', at: j.at, upd: j.upd })),
      live: Object.entries(reg.byId).map(([owner, r]) => liveRow(owner, r)).sort((a, b) => b.at - a.at),
      claimed: Object.entries(reg.claimed || {}).map(([owner, c]) => ({ owner, kind: isVenueOwner(owner) ? 'venue' : 'artist', slug: c.slug,
        name: c.name, at: c.at, until: Number(c.at) + UNDO_MS })).filter((c) => c.until > Date.now()).sort((a, b) => b.at - a.at),
      archived: Object.entries(arc).map(([owner, a]) => ({ owner, kind: a.k === 'v' ? 'venue' : 'artist', slug: a.slug, name: a.name,
        arc: a.arc, until: a.until, cp: a.cp || 1, why: a.why || 'expired' })).sort((a, b) => b.arc - a.arc) });
  }

  if (action === 'queue') {
    const kind = body.kind === 'venue' ? 'venue' : 'artist';
    const lines = (Array.isArray(body.lines) ? body.lines : String(body.lines || '').split('\n'))
      .map((l) => clean(l, 400)).filter(Boolean).slice(0, 200);
    if (!lines.length) return bad('Nothing to build — one per line.');
    const now = Date.now();
    let added = 0; const skipped = [];
    await casDoc(Q, emptyQ, (q) => {
      q.jobs ||= [];
      /* finished rows older than a week go, so the document stays small */
      q.jobs = q.jobs.filter((j) => ['queued', 'running'].includes(j.st) || now - (j.upd || j.at || 0) < 7 * 86400e3);
      added = 0; skipped.length = 0;
      for (const line of lines) {
        if (q.jobs.some((j) => j.seed && j.seed.line === line && ['queued', 'running'].includes(j.st))) { skipped.push({ line, why: 'already queued' }); continue; }
        q.jobs.push({ id: newId(), kind, seed: { line }, label: line.slice(0, 80), st: 'queued', stage: '', pct: 0, at: now, upd: now, tries: 0 });
        added++;
      }
      return added > 0;
    });
    const started = added ? await startJobs(3, origin) : 0;
    return json({ ok: true, added, skipped, started });
  }

  if (action === 'run') return json({ ok: true, started: await startJobs(3, origin) });

  if (action === 'retry') {
    let hit = false;
    await casDoc(Q, emptyQ, (q) => { const j = (q.jobs || []).find((x) => x.id === body.id); if (!j || j.st === 'running') return false;
      j.st = 'queued'; j.err = ''; j.tries = 0; j.pct = 0; j.stage = ''; j.upd = Date.now(); hit = true; return true; });
    if (!hit) return bad('No such job.');
    return json({ ok: true, started: await startJobs(1, origin) });
  }

  if (action === 'settings') {
    const cfg = await readCfg();
    await mutateFactoryCfg((c) => {
      if (typeof body.auto === 'boolean') c.auto = body.auto;
      if (body.perDay != null) c.perDay = Math.max(1, Math.min(500, parseInt(body.perDay, 10) || cfg.perDay));
      if (body.signoff != null) c.signoff = clean(body.signoff, 80) || 'The MySet team';
      if (body.address != null) c.address = clean(body.address, 200);
      return true;
    });
    return json({ ok: true, cfg: await readCfg() });
  }

  if (action === 'create') {
    /* A page made by hand: the founder (or an agent session working through the
       founder's own browser) supplies the payload, photos as data: URLs. */
    const p = body.payload || {};
    const photos = {};
    for (const [slot, ph] of Object.entries(p.photos || {})) if (ph && ph.dataUrl) photos[slot] = { dataUrl: ph.dataUrl, focus: ph.focus || '', from: ph.from || 'founder' };
    const r = await createSample({ ...p, photos, by: 'founder' });
    return json(r.ok ? r : { ok: false, error: r.error });
  }

  /* ---- one sample ---- */
  const owner = String(body.owner || '').slice(0, 60);
  if (!owner) return bad('which page?');
  const reg = await readSampleReg();
  const row = reg.byId[owner] || null;

  if (action === 'revive') {
    const r = await reviveSample(owner);
    return json(r.ok ? { ok: true, owner: r.owner, link: r.link } : { ok: false, error: r.error });
  }
  /* They said no (a "stop" reply, or in person): gone, live or archived, and never built again. */
  if (action === 'optout') {
    const r = await optOut(owner);
    return json(r.ok ? { ok: true } : { ok: false, error: 'Already gone.' });
  }
  if (action === 'undoClaim') {
    const r = await undoClaim(owner);
    return json(r.ok ? { ok: true, emails: r.emails } : { ok: false, error: r.error });
  }
  if (!row) return bad('That page has gone — claimed, removed or taken down.', 404);

  if (action === 'detail') {
    const [{ data: rec }, cfg, lk] = await Promise.all([readDoc(SAMPLE(owner), null), readCfg(), linkFor(owner, row)]);
    let profile;
    if (isVenueOwner(owner)) {
      const { getVenueProfile } = await import('./_venues.mjs');
      const p = await getVenueProfile(owner.slice(2));
      profile = { name: p.name, tagline: p.tagline, bio: p.about, links: p.links, photo: p.photo, photos: p.photos, city: p.city, address: p.address, media: [] };
    } else {
      const { getProfile, shapeMedia } = await import('./_profile.mjs');
      const p = await getProfile(owner);
      profile = { name: p.name, first: p.first, tagline: p.tagline, style: p.style, bio: p.bio, links: p.links, photo: p.photo, avatar: p.avatar,
                  photos: p.photos, focus: p.focus, media: p.media.map(shapeMedia).filter(Boolean).map((m) => ({ title: m.title, provider: m.provider, thumb: m.thumb })) };
    }
    /* `preview`: the same link with ?pv=1, which the founder opens — the page and its Studio
       then count nothing and push nothing, so a look from the console is never mistaken
       for the act's own first open */
    return json({ ok: true, row: liveRow(owner, row), link: lk.link, preview: lk.link.replace('#', '?pv=1#'), key: lk.key, profile,
      record: rec ? { sources: rec.sources || [], facts: rec.facts || null, provenance: rec.provenance || null, photos: rec.photos || [],
                      quality: rec.quality || null, events: rec.events || [], seed: rec.seed || null, usage: rec.usage || null } : null,
      msgs: messagesFor(row, rec, lk.link, cfg) });
  }

  if (action === 'approve') {
    await mutateSampleReg((r) => { const x = r.byId[owner]; if (!x) return false; x.rv = false; if (x.st === 'review') x.st = 'ready'; return true; });
    await noteSample(owner, 'approved');
    return json({ ok: true });
  }

  if (action === 'sent') {
    const ch = ['dm', 'email', 'inperson'].includes(body.ch) ? body.ch : 'dm';
    let first = false, out = null;
    await mutateSampleReg((r) => { const x = r.byId[owner]; if (!x) return false;
      if (!x.sent) { x.sent = Date.now(); first = true; }
      x.ch = x.ch && !x.ch.split(',').includes(ch) ? `${x.ch},${ch}` : (x.ch || ch);
      if (x.st === 'ready' || x.st === 'review') x.st = 'sent';
      out = liveRow(owner, x); return true; });
    await noteSample(owner, 'sent', ch);
    if (first) await bump('sent');
    return json({ ok: true, row: out });
  }

  if (action === 'edit') {
    const f = body.fields || {};
    if (isVenueOwner(owner)) {
      const { mutateVenueProfile } = await import('./_venues.mjs');
      await mutateVenueProfile(owner.slice(2), (p) => {
        if (f.name != null) p.name = clean(f.name, 70);
        if (f.tagline != null) p.tagline = clean(f.tagline, 120);
        if (f.bio != null) p.about = String(f.bio).replace(/\r/g, '').slice(0, 900);
        return true;
      });
    } else {
      const { mutateProfile } = await import('./_profile.mjs');
      await mutateProfile(owner, (p) => {
        if (f.name != null) { p.first = clean(f.name, 60); p.last = ''; p.name = clean(f.name, 60); }
        if (f.tagline != null) p.tagline = clean(f.tagline, 120);
        if (f.style != null) p.style = clean(f.style, 60);
        if (f.bio != null) p.bio = String(f.bio).replace(/\r/g, '').slice(0, 700);
        return true;
      });
      if (f.name != null) { const { mutateShow } = await import('./_lib.mjs'); await mutateShow(owner, (s) => { s.artist = clean(f.name, 60); return true; }).catch(() => {}); }
    }
    if (f.name != null) await mutateSampleReg((r) => { if (!r.byId[owner]) return false; r.byId[owner].name = clean(f.name, 70); return true; });
    await noteSample(owner, 'edited', Object.keys(f).join(','));
    return json({ ok: true });
  }

  if (action === 'addPhoto') {
    /* A photo by address — an Instagram post's image the founder copied, a press
       shot — fetched here, checked the way an upload is (the bytes, not the label),
       and stored under the sample's own name. Never a page the server scrapes: the
       address has to point at the picture itself. */
    const slot = ['cover', 'avatar', 'p0', 'p1', 'p2'].includes(body.slot) ? body.slot : null;
    if (!slot) return bad('Which slot?');
    if (isVenueOwner(owner) && slot === 'avatar') return bad('A venue page has no portrait.');
    let bytes = null, type = null;
    if (body.data) {
      const { decodeDataUrl } = await import('./_img.mjs');
      const d = decodeDataUrl(body.data); if (d.error) return bad(d.error);
      bytes = d.bytes; type = d.type;
    } else {
      const url = String(body.url || '');
      if (!/^https:\/\/\S+$/i.test(url)) return bad('That needs to be an https:// link to the picture itself.');
      try {
        const { fetchImage } = await import('./_fsrc.mjs');
        const got = await fetchImage(url, { maxBytes: 900 * 1024 });
        if (!got || got.error || !got.bytes) return bad((got && got.error) || 'Couldn’t fetch a JPEG, PNG or WebP under 900 KB from that link.');
        bytes = got.bytes; type = got.type;
      } catch { return bad('Couldn’t fetch that picture.'); }
    }
    const { putImage } = await import('./_img.mjs');
    const src = await putImage(row.ns, slot, Buffer.from(bytes), type);
    const focus = /^(100|\d{1,2})% (100|\d{1,2})%$/.test(String(body.focus || '')) ? body.focus : '';
    const from = /cdninstagram|fbcdn/.test(String(body.url || '')) ? 'instagram' : 'founder';
    if (isVenueOwner(owner)) {
      const { mutateVenueProfile } = await import('./_venues.mjs');
      await mutateVenueProfile(owner.slice(2), (p) => {
        if (slot === 'cover') p.photo = src;
        else { const i = Number(slot.slice(1)); p.photos = Array.isArray(p.photos) ? p.photos : []; while (p.photos.length <= i) p.photos.push(''); p.photos[i] = src; }
        return true;
      });
    } else {
      const { mutateProfile } = await import('./_profile.mjs');
      await mutateProfile(owner, (p) => {
        if (slot === 'cover') { p.photo = src; p.focus = { ...p.focus, cover: focus }; }
        else if (slot === 'avatar') { p.avatar = src; p.focus = { ...p.focus, avatar: focus }; }
        else { const i = Number(slot.slice(1)); p.photos = Array.isArray(p.photos) ? p.photos : []; while (p.photos.length <= i) p.photos.push(''); p.photos[i] = src; }
        return true;
      });
    }
    await casDoc(SAMPLE(owner), () => ({ v: 1, owner }), (d) => {
      d.photos = (d.photos || []).filter((x) => x.slot !== slot);
      d.photos.push({ slot, from, src: null, score: null, why: 'added by the founder', focus, url: src });
      return true;
    }).catch(() => {});
    if (slot === 'cover' || (slot === 'avatar' && !row.cv))
      await mutateSampleReg((r) => { if (!r.byId[owner]) return false; r.byId[owner].cv = src; return true; });
    await noteSample(owner, 'photo', `${slot} from ${from}`);
    return json({ ok: true, src });
  }

  if (action === 'rebuild') {
    const { data: rec } = await readDoc(SAMPLE(owner), null);
    const line = rec && rec.seed && (rec.seed.line || rec.seed.raw);
    if (!line) return bad('This page wasn’t built from a line the factory can read again.');
    const now = Date.now();
    await casDoc(Q, emptyQ, (q) => { q.jobs ||= []; q.jobs.push({ id: newId(), kind: row.k === 'v' ? 'venue' : 'artist', seed: { line },
      label: `Rebuild · ${row.name}`.slice(0, 80), replace: owner, st: 'queued', stage: '', pct: 0, at: now, upd: now, tries: 0 }); return true; });
    return json({ ok: true, started: await startJobs(1, origin) });
  }

  if (action === 'cancel') {
    const r = await removeSample(owner, { by: 'founder' });
    return json(r.ok ? { ok: true } : { ok: false, error: 'Already gone.' });
  }

  return bad('unknown action');
};
export default guard('factory', main);
