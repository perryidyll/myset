import { guard } from './_errlog.mjs';
import { json, bad, requireArtist, casDoc, readDoc, store } from './_lib.mjs';
import { isPlatformOwner } from './_plan.mjs';
import { readSampleReg, mutateSampleReg, readArchive, readStats, linkFor, SAMPLE, isVenueOwner, bump, noteSample,
         removeSample, reviveSample, undoClaim, UNDO_MS, createSample, optOut, readFactoryCfg as readCfg, mutateFactoryCfg,
         defaultFactoryCfg as defaultCfg, ROLES, rolesOf, writeRoles } from './_sample.mjs';

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
/* The links a page itself carries (normProfile / normVenue), which Edit profile writes. */
const ARTIST_PAGE_LINKS = ['instagram', 'tiktok', 'youtube', 'spotify', 'applemusic', 'ytmusic', 'soundcloud', 'bandcamp', 'facebook', 'website', 'gofundme'];
const VENUE_PAGE_LINKS = ['website', 'instagram', 'facebook', 'google'];
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

/* THE QUEUE'S ONE WRITER for new jobs: the console's lines and CRM's form (decision
   0108) both come through here, so the week's pruning and the "already queued" rule
   are one rule. `items`: [{ seed: { line, …fields }, label?, cid?, replace? }]. A job
   whose seed line is already waiting or running is not queued twice — its id comes
   back in `skipped`, so a double tap follows the build that is already going. */
export async function queueJobs(kind, items) {
  const k = kind === 'venue' ? 'venue' : 'artist';
  const now = Date.now(), added = [], skipped = [];
  await casDoc(Q, emptyQ, (q) => {
    q.jobs ||= [];
    /* finished rows older than a week go, so the document stays small */
    q.jobs = q.jobs.filter((j) => ['queued', 'running'].includes(j.st) || now - (j.upd || j.at || 0) < 7 * 86400e3);
    added.length = 0; skipped.length = 0;
    for (const it of items) {
      const line = String((it.seed && it.seed.line) || '');
      const dup = q.jobs.find((j) => j.seed && j.seed.line === line && ['queued', 'running'].includes(j.st));
      if (dup) { skipped.push({ line, why: 'already queued', id: dup.id }); continue; }
      const id = newId();
      q.jobs.push({ id, kind: k, seed: it.seed, label: clean(it.label || line, 80), st: 'queued', stage: '', pct: 0, at: now, upd: now, tries: 0,
        ...(it.cid ? { cid: String(it.cid) } : {}), ...(it.replace ? { replace: String(it.replace), keep: !!it.keep } : {}) });
      added.push({ id, line });
    }
    return added.length > 0;
  });
  return { added, skipped };
}

/* SENT, one rule for every door that says a message went out — the console's Mark
   sent and CRM's log and Gmail send (decision 0108): the first send stamps `sent` and
   counts once in the month's funnel; every channel is remembered; a page that was
   Ready (or still waiting for a look) becomes Sent. `ch`: dm, email or inperson. */
export async function markSent(owner, ch) {
  const c = ['dm', 'email', 'inperson'].includes(ch) ? ch : 'dm';
  let first = false, out = null;
  await mutateSampleReg((r) => { const x = r.byId[owner]; if (!x) return false;
    first = false;
    if (!x.sent) { x.sent = Date.now(); first = true; }
    x.ch = x.ch && !x.ch.split(',').includes(c) ? `${x.ch},${c}` : (x.ch || c);
    if (x.st === 'ready' || x.st === 'review') x.st = 'sent';
    out = liveRow(owner, x); return true; });
  if (out) await noteSample(owner, 'sent', c);
  if (first) await bump('sent');
  return out;
}

/** Everything the console and CRM show about one live sample: its row, its link and the
 *  quiet preview address, the page as it is, how it was made, and the drafts. */
export async function sampleDetail(owner, row) {
  const [{ data: rec }, cfg, lk] = await Promise.all([readDoc(SAMPLE(owner), null), readCfg(), linkFor(owner, row)]);
  let profile;
  if (isVenueOwner(owner)) {
    const { getVenueProfile } = await import('./_venues.mjs');
    const p = await getVenueProfile(owner.slice(2));
    profile = { name: p.name, tagline: p.tagline, bio: p.about, links: p.links, photo: p.photo, photos: p.photos, city: p.city, country: p.country, address: p.address, media: [],
                hours: p.hours, menuUrl: (p.menu || {}).url || '', rating: p.rating, roles: rolesOf('venue', p) };
  } else {
    const { getProfile, shapeMedia } = await import('./_profile.mjs');
    const p = await getProfile(owner);
    profile = { name: p.name, first: p.first, tagline: p.tagline, style: p.style, bio: p.bio, links: p.links, photo: p.photo, avatar: p.avatar, city: row.city || '',
                photos: p.photos, roles: rolesOf('artist', p), focus: p.focus, media: p.media.map(shapeMedia).filter(Boolean).map((m) => ({ mid: m.mid, title: m.title, provider: m.provider, thumb: m.thumb, hero: m.hero })) };
  }
  /* `preview`: the same link with ?pv=1, which the founder opens — the page and its Studio
     then count nothing and push nothing, so a look from the console is never mistaken
     for the act's own first open */
  return { row: liveRow(owner, row), link: lk.link, preview: lk.link.replace('#', '?pv=1#'), key: lk.key, profile,
    record: rec ? { sources: rec.sources || [], facts: rec.facts || null, provenance: rec.provenance || null, photos: rec.photos || [],
                    quality: rec.quality || null, events: rec.events || [], seed: rec.seed || null, usage: rec.usage || null } : null,
    msgs: messagesFor(row, rec, lk.link, cfg) };
}
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
    const { added, skipped } = await queueJobs(kind, lines.map((line) => ({ seed: { line }, label: line.slice(0, 80) })));
    const started = added.length ? await startJobs(3, origin) : 0;
    return json({ ok: true, added: added.length, skipped: skipped.map(({ line, why }) => ({ line, why })), started });
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

  if (action === 'detail') return json({ ok: true, ...(await sampleDetail(owner, row)) });

  if (action === 'approve') {
    await mutateSampleReg((r) => { const x = r.byId[owner]; if (!x) return false; x.rv = false; if (x.st === 'review') x.st = 'ready'; return true; });
    await noteSample(owner, 'approved');
    return json({ ok: true });
  }

  if (action === 'sent') {
    const ch = ['dm', 'email', 'inperson'].includes(body.ch) ? body.ch : 'dm';
    return json({ ok: true, row: await markSent(owner, ch) });
  }

  if (action === 'edit') {
    /* The page's words, its links, its place and (an artist's) videos — CRM's Edit
       profile (decision 0108) and the console's Review. Links go through the same
       canonical reader the factory's seeds do, then through the profile's own
       allowlist on the way in (normProfile / normVenue), so a sample can hold no link
       an artist could not have pasted themselves; `dropped` names the ones refused. */
    const f = body.fields || {};
    const given = f.links && typeof f.links === 'object' ? f.links : null;
    const { canonLink } = await import('./_crm.mjs');
    const pageLink = (k, v) => { const raw = String(v == null ? '' : v).trim().slice(0, 400); return raw ? (canonLink(k, raw) || raw) : ''; };
    let dropped = [];
    if (isVenueOwner(owner)) {
      /* Details (0132): hours as a person types them, the menu link, the Google rating. */
      let hours = null;
      if (f.hours != null && String(f.hours).trim()) {
        const { humanHours } = await import('./_factory.mjs');
        hours = humanHours(f.hours);
        if (!hours) return bad('Couldn’t read those hours — try “Daily 8am-10pm” or “Mon-Fri 5pm-1am; Sun closed”.');
      }
      if (f.menuUrl != null && String(f.menuUrl).trim() && !/^https:\/\/\S+$/i.test(String(f.menuUrl).trim())) return bad('The menu link needs to start with https://');
      const { mutateVenueProfile, getVenueProfile } = await import('./_venues.mjs');
      await mutateVenueProfile(owner.slice(2), (p) => {
        if (f.hours != null) p.hours = hours || Object.fromEntries(Object.keys(p.hours || {}).map((d) => [d, { ...p.hours[d], closed: true }]));
        if (f.menuUrl != null) p.menu = { ...(p.menu || {}), url: String(f.menuUrl).trim().slice(0, 300) };
        if (f.rating !== undefined) p.rating = f.rating && Number(f.rating.stars) ? { stars: f.rating.stars, count: f.rating.count, at: Date.now() } : null;
        if (f.name != null) p.name = clean(f.name, 70);
        if (f.tagline != null) p.tagline = clean(f.tagline, 120);
        if (f.bio != null) p.about = String(f.bio).replace(/\r/g, '').slice(0, 900);
        if (f.city != null) p.city = clean(f.city, 60);
        if (f.country != null) p.country = clean(f.country, 60);
        if (given) { p.links ||= {}; for (const k of VENUE_PAGE_LINKS) if (given[k] != null) p.links[k] = pageLink(k, given[k]); }
        return true;
      });
      if (given) { const p = await getVenueProfile(owner.slice(2)); dropped = VENUE_PAGE_LINKS.filter((k) => given[k] != null && String(given[k]).trim() && !(p.links || {})[k]); }
    } else {
      const { mutateProfile, getProfile, parseMedia } = await import('./_profile.mjs');
      let add = null;
      if (f.media && f.media.add) {
        const m = parseMedia(String(f.media.add).trim());
        if (!m) return bad('That link isn’t a video or a track the page can play (YouTube, Spotify or Apple Music).');
        const { lookup } = await import('./_embeds.mjs');
        const info = await lookup(m).catch(() => ({ ok: false }));
        if (!info || !info.ok) return bad((info && info.why) || 'Couldn’t read that link — is it public?');
        add = { mid: 'm' + Math.random().toString(36).slice(2, 9), ...m, title: clean(info.title, 120), thumb: String(info.thumb || '').slice(0, 300), hero: false };
      }
      await mutateProfile(owner, (p) => {
        if (f.name != null) { p.first = clean(f.name, 60); p.last = ''; p.name = clean(f.name, 60); }
        if (f.tagline != null) p.tagline = clean(f.tagline, 120);
        if (f.style != null) p.style = clean(f.style, 60);
        if (f.bio != null) p.bio = String(f.bio).replace(/\r/g, '').slice(0, 700);
        if (given) { p.links ||= {}; for (const k of ARTIST_PAGE_LINKS) if (given[k] != null) p.links[k] = pageLink(k, given[k]); }
        p.media = Array.isArray(p.media) ? p.media : [];
        if (add && !p.media.some((x) => x.provider === add.provider && x.id === add.id && (x.list || null) === (add.list || null))) p.media.push(add);
        if (f.media && f.media.remove) p.media = p.media.filter((m) => m.mid !== f.media.remove);
        if (f.media && f.media.hero) p.media.forEach((m) => { m.hero = m.mid === f.media.hero; });
        return true;
      });
      if (f.name != null) { const { mutateShow } = await import('./_lib.mjs'); await mutateShow(owner, (s) => { s.artist = clean(f.name, 60); return true; }).catch(() => {}); }
      if (given) { const p = await getProfile(owner); dropped = ARTIST_PAGE_LINKS.filter((k) => given[k] != null && String(given[k]).trim() && !(p.links || {})[k]); }
    }
    if (f.name != null || f.city != null) await mutateSampleReg((r) => { const x = r.byId[owner]; if (!x) return false;
      if (f.name != null) x.name = clean(f.name, 70); if (f.city != null) x.city = clean(f.city, 60); return true; });
    await noteSample(owner, 'edited', Object.keys(f).join(','));
    const now = (await readSampleReg()).byId[owner] || row;
    return json({ ok: true, dropped, ...(await sampleDetail(owner, now)) });
  }

  if (action === 'addPhoto') {
    /* A photo by address — an Instagram post's image the founder copied, a press
       shot — fetched here, checked the way an upload is (the bytes, not the label),
       and stored under the sample's own name. Never a page the server scrapes: the
       address has to point at the picture itself. A picture the factory already
       stored for this page (a candidate in the chooser) is placed, not fetched. */
    const kind = isVenueOwner(owner) ? 'venue' : 'artist', at = ROLES[kind].indexOf(body.slot);
    if (at < 0) return bad(kind === 'venue' ? 'A venue page has a cover and five photos.' : 'An artist page has a cover, a portrait and three small photos.');
    const slot = body.slot;
    const readP = async () => (kind === 'venue' ? (await import('./_venues.mjs')).getVenueProfile(owner.slice(2)) : (await import('./_profile.mjs')).getProfile(owner));
    const { data: rec0 } = await readDoc(SAMPLE(owner), null);
    const mine = String(body.url || ''), now0 = rolesOf(kind, await readP());
    let src = (now0.includes(mine) || ((rec0 && rec0.photos) || []).some((x) => x && x.url === mine)) && /^\/api\/img\?a=s[a-z0-9]{10}&/.test(mine) ? mine : '';
    let bytes = null, type = null;
    if (src) { /* already stored */ }
    else if (body.data) {
      const { decodeDataUrl } = await import('./_img.mjs');
      const d = decodeDataUrl(body.data); if (d.error) return bad(d.error);
      bytes = d.bytes; type = d.type;
    } else {
      const url = mine;
      if (!/^https:\/\/\S+$/i.test(url)) return bad('That needs to be an https:// link to the picture itself.');
      try {
        const { fetchImage } = await import('./_fsrc.mjs');
        const got = await fetchImage(url, { maxBytes: 900 * 1024 });
        if (!got || got.error || !got.bytes) return bad((got && got.error) || 'Couldn’t fetch a JPEG, PNG or WebP under 900 KB from that link.');
        bytes = got.bytes; type = got.type;
      } catch { return bad('Couldn’t fetch that picture.'); }
    }
    /* Stored under a name no other photo on the page uses (0136): once photos can
       move between places, the name `p4` may hold the cover, and writing over it
       would change a picture the page shows somewhere else. */
    const { putImage, SLOTS, sampleImgKeys } = await import('./_img.mjs');
    if (!src) {
      const held = [...now0, ...((rec0 && rec0.photos) || []).map((x) => x && x.url)].filter(Boolean);
      const used = new Set(held.map((u) => (/[?&]a=([a-z0-9]+)&s=([a-z0-9_]+)/.exec(u) || []).slice(1).join('/')));
      const name = [...SLOTS].find((n) => !used.has(`${row.ns}/${n}`));
      src = await putImage(row.ns, name, Buffer.from(bytes), type);
    }
    const focus = /^(100|\d{1,2})% (100|\d{1,2})%$/.test(String(body.focus || '')) ? body.focus : '';
    const from = /cdninstagram|fbcdn/.test(mine) ? 'instagram' : 'founder';
    let gone = '', roles = null;
    const place = (p) => {
      const r = rolesOf(kind, p), j = r.indexOf(src);
      gone = r[at];
      if (j >= 0 && j !== at) { r[j] = r[at]; gone = ''; }   // already on the page elsewhere: the two trade places
      r[at] = src; writeRoles(kind, p, r); roles = r;
      if (kind === 'artist' && (slot === 'cover' || slot === 'avatar')) p.focus = { ...p.focus, [slot]: focus };
      return true;
    };
    if (kind === 'venue') await (await import('./_venues.mjs')).mutateVenueProfile(owner.slice(2), place);
    else await (await import('./_profile.mjs')).mutateProfile(owner, place);
    // the picture it replaced, if nothing else on the page shows it and the chooser does not offer it
    const offered = ((rec0 && rec0.photos) || []).some((x) => x && x.url === gone);
    if (gone && gone !== src && !roles.includes(gone) && !offered) for (const k of sampleImgKeys([gone])) { try { await store().delete(k); } catch {} }
    await casDoc(SAMPLE(owner), () => ({ v: 1, owner }), (d) => {
      d.photos = (d.photos || []).map((x) => ({ ...x, slot: ROLES[kind][roles.indexOf(x.url)] || '' }));
      if (!d.photos.some((x) => x.url === src)) d.photos.push({ slot, from, src: null, score: null, why: 'added by the founder', focus, url: src });
      return true;
    }).catch(() => {});
    const cv = roles[0] || (kind === 'artist' ? roles[1] : '') || '';
    await mutateSampleReg((r) => { if (!r.byId[owner]) return false; r.byId[owner].cv = cv; return true; });
    await noteSample(owner, 'photo', `${slot} from ${from}`);
    return json({ ok: true, src });
  }

  if (action === 'arrange') {
    /* The photos moved between places (0136): `order` is every place's photo, in the
       order of ROLES — the same pictures the page holds now, nothing added or lost. */
    const kind = isVenueOwner(owner) ? 'venue' : 'artist', n = ROLES[kind].length;
    const want = Array.isArray(body.order) ? body.order.map((u) => String(u || '')) : [];
    if (want.length !== n) return bad('Which order?');
    let stale = false, roles = null;
    const apply = (p) => {
      const now = rolesOf(kind, p), same = (a) => a.filter(Boolean).sort().join('\n');
      if (same(now.slice(0, n)) !== same(want)) { stale = true; return false; }
      roles = [...want, ...now.slice(n)]; writeRoles(kind, p, roles);
      return true;
    };
    if (kind === 'venue') await (await import('./_venues.mjs')).mutateVenueProfile(owner.slice(2), apply);
    else await (await import('./_profile.mjs')).mutateProfile(owner, apply);
    if (stale) return bad('The photos changed while you were moving them — have another look.');
    await casDoc(SAMPLE(owner), () => ({ v: 1, owner }), (d) => {
      d.photos = (d.photos || []).map((x) => ({ ...x, slot: ROLES[kind][roles.indexOf(x.url)] || '' }));
      return true;
    }).catch(() => {});
    const cv = roles[0] || (kind === 'artist' ? roles[1] : '') || '';
    await mutateSampleReg((r) => { if (!r.byId[owner]) return false; r.byId[owner].cv = cv; return true; });
    await noteSample(owner, 'photo', 'moved');
    return json({ ok: true, roles: roles.slice(0, n) });
  }

  if (action === 'notes') {
    /* NOTES FOR THE GENERATOR (0136): what the founder wants said, left out or led
       with. Kept on the page's seed, so every rebuild reads them; never on the page. */
    const notes = String(body.notes || '').replace(/\r/g, '').trim().slice(0, 600);
    let built = false;
    await casDoc(SAMPLE(owner), () => ({ v: 1, owner }), (d) => { built = !!(d.seed && (d.seed.line || d.seed.raw)); if (!built) return false; d.seed = { ...d.seed, notes }; return true; });
    if (!built) return bad('This page was made by hand, so there is no build for notes to steer.');
    await noteSample(owner, 'notes', notes ? `${notes.length} characters` : 'cleared');
    return json({ ok: true, notes });
  }

  if (action === 'rebuild') {
    const { data: rec } = await readDoc(SAMPLE(owner), null);
    const sd = (rec && rec.seed) || {};
    const line = sd.line || sd.raw;
    if (!line) return bad('This page wasn’t built from a line the factory can read again.');
    /* the seed's own fields ride along (a page CRM built from its form has them), so a
       rebuild reads what the first build read, not only the line's rendering of it */
    const seed = { line, ...(sd.name ? { name: sd.name } : {}), ...(sd.city ? { city: sd.city } : {}), ...(sd.country ? { country: sd.country } : {}),
      ...(sd.links ? { links: sd.links } : {}), ...(Array.isArray(sd.photos) && sd.photos.length ? { photos: sd.photos } : {}),
      ...(sd.notes ? { notes: sd.notes } : {}) };
    // keep (0136): the photos and a venue's details stay unless the founder asked for fresh ones
    const { added, skipped } = await queueJobs(row.k === 'v' ? 'venue' : 'artist', [{ seed, label: `Rebuild · ${row.name}`, replace: owner, keep: body.keep !== false }]);
    if (!added.length && skipped.length) return json({ ok: true, started: 0, already: true });
    return json({ ok: true, started: await startJobs(1, origin) });
  }

  if (action === 'cancel') {
    const r = await removeSample(owner, { by: 'founder' });
    return json(r.ok ? { ok: true } : { ok: false, error: 'Already gone.' });
  }

  return bad('unknown action');
};
export default guard('factory', main);
