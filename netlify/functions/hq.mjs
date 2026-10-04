import { guard } from './_errlog.mjs';
import { json, bad, requireArtist, readDoc, DEFAULT_ARTIST } from './_lib.mjs';
import { isPlatformOwner } from './_plan.mjs';
import * as C from './_crm.mjs';
import { readSampleReg, readArchive, readStats, readFactoryCfg, linkFor, optOut, suppress } from './_sample.mjs';
import { QKEY } from './_factory.mjs';
import * as L from './_hqlock.mjs';

/* MYSET CRM, server side (decision 0108) — myset.vip/crm, the founder's outreach desk:
   make a page from a form, keep every act and venue in one table with the tags that
   sort it, and every conversation with them in one place.

   The founder's alone, behind two locks: the factory console's gate (the founding
   page's OWNER seat, decision 0099), then a passcode (_hqlock.mjs, INVARIANT 0hk). CRM
   reads every contact, every message and every sample, sends mail as the founder, and
   can erase all of it.

   WHAT LIVES WHERE. Contacts and conversations are _crm.mjs's. Pages are still the
   factory's: CRM queues builds through factory.mjs's queueJobs/startJobs, and the page
   actions (edit, photos, approve, rebuild, cancel, revive, undo a claim) stay on
   /api/factory, so there is one door for each thing a page can do.

   HOW A MESSAGE GOES OUT (decision 0109). Email goes through the founder's OWN Gmail
   (_gmail.mjs), never MySet's mail sender: that one carries sign-in codes, and cold
   mail through it could cost every artist their way in. Instagram and TikTok allow no
   app to send the first message to somebody who has not written first, so those are
   sent from the phone — CRM copies the words and opens the chat — and logged here.
   Every outgoing message marks the page Sent the same way the console's button does
   (factory.mjs markSent), so the funnel counts it once, whichever door it came in by. */

export const MAIL_PER_DAY = 60;   // emails CRM sends in a UTC day: a person's pace, which keeps a Gmail account in good standing
const SYNC_GAP_UI = 45e3;         // the open page asks at most this often
const SYNC_GAP_RING = 4 * 60e3;   // the ten-minute ring skips when the page just did it
const clean = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const cut = (s, n) => { const t = String(s || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const SITE = () => process.env.URL || 'https://myset.vip';
const dmOf = (ch) => (ch === 'email' ? 'email' : ch === 'inperson' ? 'inperson' : 'dm');

async function gmailMod() { try { return await import('./_gmail.mjs'); } catch { return null; } }
async function gmailStatus() {
  const G = await gmailMod();
  if (!G) return { ready: false, connected: false, email: '', lastSync: 0, err: '' };
  try { return await G.status(); } catch { return { ready: G.configured ? G.configured() : false, connected: false, email: '', lastSync: 0, err: 'unreadable' }; }
}

/** Everything a contact's stage is read from, in one round of reads. */
async function world() {
  const [crm, reg, arc, qd, artists, venues] = await Promise.all([
    C.readCrm(), readSampleReg(), readArchive(), readDoc(QKEY, null),
    import('./_auth.mjs').then((m) => m.readArtists()).catch(() => ({ byId: {} })),
    import('./_venues.mjs').then((m) => m.readVenues()).catch(() => ({ byId: {} })),
  ]);
  const q = qd.data || { jobs: [] };
  return { crm, reg, arc, q, jobs: q.jobs || [], artists, venues };
}
const rowFor = (w, cid) => (w.crm.byId[cid] ? C.deriveRows({ ...w, crm: { byId: { [cid]: w.crm.byId[cid] } } })[0] : null);
async function freshRow(cid) { return rowFor(await world(), cid); }

async function markSentFor(owner, ch) {
  try { const { markSent } = await import('./factory.mjs'); await markSent(owner, dmOf(ch)); } catch (e) { console.error('hq: markSent failed', e && e.message); }
}
async function pushReply(doc, text) {
  try {
    const { notify } = await import('./_push.mjs');
    await notify(DEFAULT_ARTIST, { title: `💬 ${doc.name || 'Someone'} replied`, body: cut(String(text || '').replace(/\s+/g, ' '), 120), url: '/crm', tag: 'hq-reply' }, { owner: true });
  } catch {}
}
async function pushShut(until) {
  try {
    const { notify } = await import('./_push.mjs');
    await notify(DEFAULT_ARTIST, { title: '🔒 CRM is locked', body: `${L.LOCK_TRIES} wrong passcodes in a row, so it stays shut for ${L.LOCK_MINUTES} minutes. If that wasn’t you, sign out your other devices in Settings.`, url: '/crm', tag: 'hq-lock' }, { owner: true });
  } catch {}
}
/** One of the day's emails, or false when the day's allowance is spent. */
async function takeMailSlot(now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10);
  let ok = false;
  await C.mutateCrm((c) => {
    ok = false;
    const m = c.mail && c.mail.day === day ? c.mail : { day, n: 0 };
    if (m.n >= MAIL_PER_DAY) return false;
    c.mail = { day, n: m.n + 1 }; ok = true; return true;
  }).catch(() => {});
  return ok;
}

/* ---------- Gmail into the conversations ----------
   Only mail to or from a contact's address is read, asked for by address (twenty to a
   query), so a busy inbox costs nothing. A message is added once (its Gmail id), in
   or out by who sent it — so a reply the founder typed in the Gmail app joins the
   thread too. A reply from them raises the unread count and pushes to the founder's
   phone. Stops at `budgetMs` and leaves the rest for the next ring, which starts from
   the same point: the watermark moves only when a ring read everything it found. */
export async function syncGmail({ now = Date.now(), budgetMs = 7000, minGapMs = 0 } = {}) {
  const G = await gmailMod();
  if (!G) return { ok: false, error: 'no-gmail-module' };
  const st = await G.status();
  if (!st.connected) return { ok: false, skipped: 'not-connected' };
  if (minGapMs && st.lastSync && now - st.lastSync < minGapMs) return { ok: true, added: 0, fresh: true };
  const t0 = Date.now();
  try {
    const crm = await C.readCrm();
    const emails = Object.keys(crm.byKey).filter((k) => k.startsWith('em:')).map((k) => k.slice(3));
    const threads = new Map();
    for (const [cid, r] of Object.entries(crm.byId)) for (const t of r.gt || []) threads.set(t, cid);
    if (!emails.length) { await G.markSync({ lastSync: now, err: '' }); return { ok: true, added: 0 }; }
    const since = Math.floor(Math.max(st.lastSync ? st.lastSync - 3600e3 : now - 2 * 86400e3, now - 14 * 86400e3) / 1000);
    const { data: gdoc } = await readDoc(G.GMAIL_DOC, null);
    const seen = new Set((gdoc && gdoc.seen) || []);
    const ids = [];
    for (let i = 0; i < emails.length; i += 20) {
      const chunk = emails.slice(i, i + 20);
      const q = `after:${since} {${chunk.map((e) => `from:${e} to:${e}`).join(' ')}}`;
      for (const x of await G.listIds(q, { max: 30 })) if (!seen.has(x.id) && !ids.includes(x.id)) ids.push(x.id);
      if (Date.now() - t0 > budgetMs / 2) break;
    }
    let added = 0;
    const done = [];
    for (const id of ids) {
      if (Date.now() - t0 > budgetMs) break;
      const m = await G.getMessage(id);
      done.push(id);
      const mine = (m.from && m.from.email) === st.email;
      const others = mine ? [...(m.to || []), ...(m.cc || [])] : [m.from && m.from.email];
      const cid = others.map((e) => crm.byKey['em:' + String(e || '').toLowerCase()]).find(Boolean) || threads.get(m.threadId);
      if (!cid) continue;
      const r = await C.addMessage(cid, { ch: 'email', dir: mine ? 'out' : 'in', via: 'gmail', t: m.date, text: m.text || m.snippet || '', subject: m.subject,
        from: m.from && m.from.email, to: (m.to || []).join(', '), gid: m.id, thread: m.threadId, msgId: m.msgId, refs: m.references }, { now, unread: !mine });
      if (!r.ok || r.dup) continue;
      added++;
      if (!mine) await pushReply(r.doc, m.text || m.snippet);
      else if (r.doc.owner) await markSentFor(r.doc.owner, 'email');
    }
    const all = done.length === ids.length;
    await G.markSync({ ...(all ? { lastSync: now } : {}), err: '', seen: done });
    return { ok: true, added, more: !all };
  } catch (e) {
    const code = (e && e.code) || 'failed';
    try { await G.markSync({ err: code === 'revoked' ? 'revoked' : cut((e && e.message) || code, 120) }); } catch {}
    return { ok: false, error: code };
  }
}

/** Their email history, pulled when the founder opens the conversation. */
async function pullThread(d, now = Date.now()) {
  const G = await gmailMod();
  if (!G || !d.email) return 0;
  const st = await G.status();
  if (!st.connected) return 0;
  const have = new Set((d.msgs || []).map((m) => m.gid).filter(Boolean));
  let n = 0;
  for (const x of await G.listIds(`from:${d.email} OR to:${d.email}`, { max: 20 })) {
    if (have.has(x.id)) continue;
    const m = await G.getMessage(x.id);
    const mine = (m.from && m.from.email) === st.email;
    const r = await C.addMessage(d.cid, { ch: 'email', dir: mine ? 'out' : 'in', via: 'gmail', t: m.date, text: m.text || m.snippet || '', subject: m.subject,
      from: m.from && m.from.email, to: (m.to || []).join(', '), gid: m.id, thread: m.threadId, msgId: m.msgId, refs: m.references }, { now });
    if (r.ok && !r.dup) n++;
  }
  return n;
}

const main = async (req) => {
  const url = new URL(req.url);

  /* Google sends the browser back here after the consent screen — a GET that carries
     no sign-in, so it proves itself with the signed `state` the founder's own
     `gmail connect` handed out (_gmail.mjs checkState), and ten minutes is its life. */
  if (req.method === 'GET' && /\/gmail\/?$/.test(url.pathname)) {
    const back = (q) => new Response(null, { status: 302, headers: { location: `/crm?${q}`, 'cache-control': 'no-store' } });
    const err = url.searchParams.get('error') || '';
    if (err) return back(`gmail=error&why=${encodeURIComponent(err.slice(0, 60))}`);
    const G = await gmailMod();
    if (!G) return back('gmail=error&why=unavailable');
    try {
      const r = await G.connect({ code: url.searchParams.get('code') || '', state: url.searchParams.get('state') || '', site: SITE() });
      return back(r && r.ok ? 'gmail=connected' : `gmail=error&why=${encodeURIComponent((r && r.error) || 'failed')}`);
    } catch (e) {
      // Google's own words when it said no (they say what to do); the code otherwise
      const why = e && e.code === 'google' ? e.message : (e && (e.code || e.message)) || 'failed';
      return back(`gmail=error&why=${encodeURIComponent(String(why).slice(0, 240))}`);
    }
  }

  const me = await requireArtist(req);
  if (!me) return bad('unauthorized', 401);
  if (!isPlatformOwner(me.aid) || (me.role || 'owner') !== 'owner') return bad('unauthorized', 401);
  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }
  const action = body.action;
  const origin = url.origin;

  /* THE SECOND LOCK (_hqlock.mjs). Only the owner seat reaches this line, so only the
     owner seat can try a passcode. `unlock` and `lock` are the only actions a locked
     CRM answers; everything below needs the cookie a right passcode set. */
  const secure = url.protocol === 'https:';
  if (action === 'unlock') {
    if (!L.ready()) return json({ ok: false, error: 'locked', ready: false, until: 0 }, 401);
    const r = await L.tryPasscode(body.code);
    if (r.ok) {
      const { exp, header } = await L.unlockCookie(me.aid, { secure });
      const res = json({ ok: true, until: exp });
      res.headers.append('set-cookie', header);
      return res;
    }
    if (r.shut) await pushShut(r.until);
    return r.until ? json({ ok: false, error: 'locked-out', until: r.until }, 429) : json({ ok: false, error: 'wrong', left: r.left }, 401);
  }
  if (action === 'lock') {
    const res = json({ ok: true });
    res.headers.append('set-cookie', L.clearCookie(secure));
    return res;
  }
  if (!(await L.unlocked(req, me.aid))) {
    const ready = L.ready();
    return json({ ok: false, error: 'locked', ready, until: ready ? await L.shutUntil() : 0 }, 401);
  }

  if (action === 'summary') {
    let w = await world();
    /* three repairs, all rare: a finished build whose contact never heard (the worker's
       link failed), pages the old console built before CRM, which get a contact, and a
       second contact that a poll once made for a page mid-build (dropTwins) */
    let touched = false;
    for (const j of w.jobs) if (j.cid && j.st === 'done' && j.owner && w.crm.byId[j.cid] && !w.crm.byId[j.cid].owner) { await C.linkOwner(j.cid, j.owner); touched = true; }
    if (await C.adoptOrphans(w.reg, w.crm, { limit: 10, jobs: w.jobs })) touched = true;
    if (await C.dropTwins(touched ? await C.readCrm() : w.crm)) touched = true;
    if (touched) w = { ...w, crm: await C.readCrm() };
    const [stats, cfg, gmail, lib] = await Promise.all([readStats(), readFactoryCfg(), gmailStatus(), C.readLib()]);
    const month = new Date().toISOString().slice(0, 7), day = new Date().toISOString().slice(0, 10);
    return json({ ok: true, now: Date.now(), cfg,
      keys: { anthropic: !!process.env.ANTHROPIC_API_KEY, youtube: !!process.env.YOUTUBE_API_KEY },
      gmail, today: { started: w.q.day === day ? (w.q.started || 0) : 0, cap: Number(cfg.perDay) || 40 },
      month: { key: month, ...(stats[month] || {}) },
      queue: w.jobs.slice(-50).reverse().map((j) => ({ id: j.id, kind: j.kind, label: j.label || '', st: j.st, stage: j.stage || '', pct: j.pct || 0,
        err: j.err || '', cid: j.cid || '', owner: j.owner || '', at: j.at, upd: j.upd })),
      contacts: C.deriveRows(w).sort((a, b) => (b.upd || 0) - (a.upd || 0)),
      tags: C.tagCounts(w.crm), lib });
  }

  /* The message library (decision 0117): the page sends it whole; null puts the defaults back. */
  if (action === 'savelib') return json({ ok: true, lib: await C.saveLib(body.lib === null ? null : (body.lib || {})) });

  /* A PHOTO UPLOADED IN THE FORM (decision 0166). The phone has already made it small
     (crm.html shrink); it is kept under a name nobody can guess, exactly as a sample's
     own pictures are (SAMPLE_NS), and handed back as an address — so it travels in the
     contact's photo links like any other, and the factory fetches it and judges it
     first. One photo a request: ten in one body would pass a function's limit. */
  if (action === 'stagePhoto') {
    const { decodeDataUrl, putImage, newSampleNs } = await import('./_img.mjs');
    const d = decodeDataUrl(body.data);
    if (d.error) return bad(d.error);
    const path = await putImage(newSampleNs(), 'p0', d.bytes, d.type);
    return json({ ok: true, url: origin + path });
  }

  if (action === 'generate' || action === 'save') {
    let cid = C.validCid(body.cid) ? body.cid : '';
    let kind = body.kind === 'venue' ? 'venue' : 'artist';
    const was = cid ? await C.readContact(cid) : null;
    if (cid && !was) return bad('That contact has gone.');
    if (was) kind = was.kind;
    const { out: f, dropped } = C.normFields(kind, body.fields || {}, { partial: !!was });
    if (was) {
      const { note, ...fields } = f;
      await C.mutateContact(cid, (d) => { C.applyFields(d, fields); if (note) d.notes.push({ t: Date.now(), text: note }); d.upd = Date.now(); return true; });
    } else {
      if (!f.name && !Object.values(f.links || {}).some(Boolean)) return bad('Give them a name, or at least one link.');
      const r = await C.createContact(kind, f);
      if (!r.ok) return json({ ok: false, error: r.error, cid: r.cid || '' });
      cid = r.cid;
    }
    if (action === 'save') return json({ ok: true, cid, dropped, row: await freshRow(cid) });

    const d = await C.readContact(cid);
    const reg = await readSampleReg();
    if (d.owner && reg.byId[d.owner]) return json({ ok: false, error: 'This one already has a page — use Rebuild in Edit profile.', cid });
    const seed = C.seedFrom(d.kind, d);
    if (d.kind === 'artist' && body.songs !== false) seed.songs = true;   // twenty suggested songs, unless unticked (0167)
    if (!seed.name && !Object.keys(seed.links).length) return bad('Give them a name, or at least one link.');
    const { queueJobs, startJobs } = await import('./factory.mjs');
    const { added, skipped } = await queueJobs(d.kind, [{ seed, label: d.name || seed.line, cid }]);
    const jobId = added.length ? added[0].id : ((skipped[0] || {}).id || '');
    await C.mutateContact(cid, (x) => { x.jobId = jobId; x.events.push({ t: Date.now(), e: 'generate', m: jobId }); x.upd = Date.now(); return true; });
    const started = added.length ? await startJobs(1, origin) : 0;
    return json({ ok: true, cid, dropped, job: { id: jobId, st: started ? 'running' : 'queued', stage: '', pct: 0 } });
  }

  if (action === 'job') {
    const { data: q } = await readDoc(QKEY, null);
    const jobs = (q && q.jobs) || [];
    const j = jobs.find((x) => x.id === String(body.id || ''));
    if (!j) return bad('No such build — it may have finished over a week ago.');
    const [cfg, reg] = await Promise.all([readFactoryCfg(), readSampleReg()]);
    let link = '', preview = '', review = false;
    if (j.st === 'done' && j.owner) {
      if (j.cid) { const crm = await C.readCrm(); if (crm.byId[j.cid] && !crm.byId[j.cid].owner) await C.linkOwner(j.cid, j.owner); }
      const live = reg.byId[j.owner];
      if (live) { const lk = await linkFor(j.owner, live); link = lk.link; preview = lk.link.replace('?', '?pv=1&'); review = live.st === 'review' || !!live.rv; }
    }
    const day = new Date().toISOString().slice(0, 10);
    return json({ ok: true, link, preview, review,
      job: { id: j.id, st: j.st, stage: j.stage || '', pct: j.pct || 0, err: j.err || '', owner: j.owner || '', cid: j.cid || '', kind: j.kind, label: j.label || '',
        ahead: j.st === 'queued' ? jobs.filter((x) => x.st === 'queued' && (x.at || 0) < (j.at || 0)).length : 0,
        capped: j.st === 'queued' && q.day === day && (q.started || 0) >= (Number(cfg.perDay) || 40) } });
  }

  if (action === 'gmail') {
    const G = await gmailMod();
    if (!G) return bad('Gmail isn’t available on this server.');
    if (body.op === 'connect') {
      if (!G.configured()) return bad('Gmail isn’t set up on the server yet: the Google client ID and secret go into Netlify first.');
      const { url: to } = await G.authUrl({ site: SITE() });
      return json({ ok: true, url: to });
    }
    if (body.op === 'disconnect') { await G.disconnect({}); return json({ ok: true }); }
    if (body.op === 'sync') return json(await syncGmail({ minGapMs: SYNC_GAP_UI }));
    return bad('Which Gmail action?');
  }

  /* ---- one contact ---- */
  const cid = String(body.cid || '');
  if (!C.validCid(cid)) return bad('Which contact?');
  const d = await C.readContact(cid);
  if (!d) return bad('That contact has gone.', 404);

  if (action === 'contact') {
    const w = await world();
    const row = rowFor(w, cid);
    let page = null, drafts = null;
    if (d.owner) {
      const live = w.reg.byId[d.owner];
      if (live) {
        const { sampleDetail } = await import('./factory.mjs');
        const det = await sampleDetail(d.owner, live);
        page = { state: row.stage, link: det.link, preview: det.preview, profile: det.profile, record: det.record, row: det.row };
        drafts = det.msgs;
      } else if (row && row.stage === 'claimed') page = { state: 'claimed', link: row.link, undo: !!(w.reg.claimed || {})[d.owner] };
      else if (row && row.stage === 'archived') page = { state: 'archived', until: (w.arc[d.owner] || {}).until || 0 };
    }
    const { v, ...contact } = d;
    return json({ ok: true, row, contact, page, drafts });
  }

  if (action === 'update') {
    const { out: f, dropped } = C.normFields(d.kind, body.fields || {}, { partial: true });
    delete f.note;
    await C.mutateContact(cid, (x) => { C.applyFields(x, f); x.upd = Date.now(); return true; });
    return json({ ok: true, dropped, row: await freshRow(cid) });
  }

  if (action === 'note') {
    const text = String(body.text || '').replace(/\r/g, '').trim().slice(0, 2000);
    if (!text) return bad('Write the note first.');
    const r = await C.mutateContact(cid, (x) => { x.notes.push({ t: Date.now(), text }); return true; });
    return json({ ok: true, notes: ((r.doc && r.doc.notes) || []).slice().reverse() });
  }

  if (action === 'log') {
    const ch = C.CHANNELS.includes(body.ch) ? body.ch : '';
    if (!ch) return bad('Which way did it go?');
    const r = await C.addMessage(cid, { ch, dir: body.dir === 'in' ? 'in' : 'out', text: body.text, subject: body.subject, pre: body.pre, soft: !!body.soft });
    if (!r.ok) return bad(r.error || 'That didn’t save.');
    if (ch !== 'note' && r.msg.dir === 'out' && r.doc.owner) await markSentFor(r.doc.owner, ch);
    return json({ ok: true, msg: r.msg, row: await freshRow(cid) });
  }

  if (action === 'send') {
    if (!d.email) return bad('There’s no email address for them yet — add one in Overview.');
    const G = await gmailMod();
    const st = G ? await G.status() : { connected: false };
    if (!st.connected) return bad('gmail-not-connected');
    const text = String(body.text || '').replace(/\r/g, '').trim();
    if (!text) return bad('Write the email first.');
    const last = [...(d.msgs || [])].reverse().find((m) => m.ch === 'email' && (m.thread || m.msgId));
    const subject = clean(body.subject, 200) || (last && last.subject ? (/^re:/i.test(last.subject) ? last.subject : `Re: ${last.subject}`) : '');
    if (!subject) return bad('Give it a subject.');
    if (!(await takeMailSlot())) return bad(`That’s ${MAIL_PER_DAY} emails today. The rest can go tomorrow — it keeps the Gmail account in good standing.`);
    const refs = last ? [last.refs, last.msgId].filter(Boolean).join(' ').slice(-1800) : '';
    let sent;
    try {
      // the name the drafts are signed with is the name on the envelope too (Settings)
      const cfg = await readFactoryCfg();
      sent = await G.sendMail({ to: d.email, subject, text, fromName: String(cfg.signoff || '').trim() || 'MySet', threadId: last && last.thread ? last.thread : undefined,
        inReplyTo: last && last.msgId ? last.msgId : undefined, references: refs || undefined });
    } catch (e) { return bad(e && e.code === 'revoked' ? 'Gmail was disconnected — connect it again in Settings.' : `Gmail didn’t take it: ${cut((e && e.message) || 'failed', 120)}`); }
    const r = await C.addMessage(cid, { ch: 'email', dir: 'out', via: 'gmail', text, subject, to: d.email, from: st.email,
      gid: sent.id, thread: sent.threadId, msgId: sent.msgId, refs, pre: body.pre, soft: !!body.soft });
    if (d.owner) await markSentFor(d.owner, 'email');
    return json({ ok: true, msg: r.msg, row: await freshRow(cid) });
  }

  if (action === 'thread') {
    let pulled = 0, error = '';
    try { pulled = await pullThread(d); } catch (e) { error = (e && e.code) || 'failed'; }
    await C.mutateContact(cid, (x) => { if (!x.unread) return false; x.unread = 0; return true; });
    const now = await C.readContact(cid);
    return json({ ok: true, pulled, error, msgs: (now && now.msgs) || [], row: await freshRow(cid) });
  }

  if (action === 'seen') {
    await C.mutateContact(cid, (x) => { if (!x.unread) return false; x.unread = 0; return true; });
    return json({ ok: true });
  }

  if (action === 'remove') {
    if (body.mode === 'forever') {
      /* They asked. The page (live, or the copy kept after it came down) goes the way
         the console's Delete forever sends it — erased and suppressed — and whatever
         identifies them is suppressed even when there never was a page, so the factory
         never builds them again. A page they CLAIMED is theirs: it is not touched here. */
      if (d.owner) {
        const [reg, arc] = await Promise.all([readSampleReg(), readArchive()]);
        if (reg.byId[d.owner] || arc[d.owner]) await optOut(d.owner);
      }
      try { const { suppressIds } = await import('./_factory.mjs'); await suppress(suppressIds(C.seedForSuppression(d.kind, d))); } catch {}
      await C.eraseContact(cid);
      return json({ ok: true });
    }
    // the CRM entry only: a live page stays, and the table does not adopt it back
    if (d.owner) await C.mutateCrm((c) => { c.skip ||= {}; c.skip[d.owner] = Date.now(); return true; });
    await C.eraseContact(cid);
    return json({ ok: true });
  }

  return bad('unknown action');
};
export default guard('hq', main);
