/* THE SAMPLE FACTORY'S CLAUDE CALLS (decision 0101). Four questions, each with one
   JSON answer:
     discover      which profiles online are THIS act's own      smart model + web search
     extractFacts  what the sources say, each fact with its source   fast model
     judgePhotos   which pictures show the act, and how well     smart model, vision
     writeCopy     a tagline, a style, a short bio, one true hook    smart model

   JSON BY PROMPT, CHECKED HERE (the predecessor's pattern). The system prompt asks for
   one JSON object; the reply is parsed (a ```json fence is tolerated) and checked by
   a small hand-written schema function. A reply that fails gets ONE repair try that
   sends the checker's complaint back; a second failure is a clear error, never a
   half-read answer. It runs the same on whichever models the environment names.

   NOTHING INVENTED. Every prompt says so, and the code does not take the model's word
   for it: a fact must cite a source it was given, a bio sentence must cite a fact, a
   number in a sentence must appear in the facts it cites, and a line that fails is
   DROPPED, not repaired. A shorter true page beats a fuller guessed one.

   COST. Every call's tokens and web searches are recorded in `ctx.usage` and priced
   from PRICES — an ESTIMATE from list prices, for the founder's console, never a bill.
   Raw fetch, no SDK: there are two dependencies and it stays that way. */

const API = 'https://api.anthropic.com/v1/messages';
const CALL_MS = 180e3;                       // a smart call that searches and thinks can take a minute or two
export const SEARCH_TOOL = 'web_search_20250305';
export const SEARCH_TOOL_NEXT = 'web_search_20260209';   // tried once if the API refuses the first
const envOf = (ctx) => (ctx && ctx.env) || process.env;
export const modelFast = (ctx) => envOf(ctx).FACTORY_MODEL_FAST || 'claude-haiku-4-5-20251001';
export const modelSmart = (ctx) => envOf(ctx).FACTORY_MODEL_SMART || 'claude-sonnet-5';

/* US$ per million tokens, list prices as of 2026-09. AN ESTIMATE: it ignores caching
   discounts and any negotiated rate, and an unknown model is priced as the dearest. */
export const PRICES = {
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-sonnet-5': { in: 2, out: 10 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-opus-5': { in: 5, out: 25 },
};
export const SEARCH_USD = 0.01;              // web search: $10 per thousand
const priceOf = (m) => PRICES[Object.keys(PRICES).find((k) => String(m || '').startsWith(k))] || { in: 5, out: 25 };
export function estimateCost(usage = []) {
  let usd = 0, tin = 0, tout = 0, searches = 0;
  for (const u of usage || []) {
    const p = priceOf(u.model);
    usd += ((u.in || 0) * p.in + (u.out || 0) * p.out) / 1e6 + (u.searches || 0) * SEARCH_USD;
    tin += u.in || 0; tout += u.out || 0; searches += u.searches || 0;
  }
  return { usd: Math.round(usd * 10000) / 10000, in: tin, out: tout, searches, calls: (usage || []).length, estimate: true };
}

const tagged = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);
const clean = (v, n = 200) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const in01 = (v) => typeof v === 'number' && v >= 0 && v <= 1;

async function post(body, ctx) {
  const key = envOf(ctx).ANTHROPIC_API_KEY;
  if (!key) throw tagged('no-key', 'ANTHROPIC_API_KEY is not set');
  let last = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    let r;
    try {
      r = await ctx.fetch(API, { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(CALL_MS),
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' } });
    } catch (e) {
      // a call that ran three minutes will not be quicker the second time: fifteen minutes is the whole budget
      if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw tagged('timeout', `Claude did not answer in ${CALL_MS / 1000}s`);
      last = tagged('network', `Claude unreachable: ${clean(e && e.message, 80)}`); await ctx.sleep(2000 * (attempt + 1)); continue;
    }
    if (r.ok) return r.json();
    const detail = await r.text().catch(() => '');
    let why = clean(detail, 200); try { why = clean(JSON.parse(detail).error.message, 200); } catch {}
    if (r.status === 429 || r.status >= 500) {              // rate limit, overloaded (529), a server wobble
      last = tagged('busy', `Claude ${r.status}: ${why}`);
      await ctx.sleep(Math.min(30, Number(r.headers.get('retry-after')) || 0) * 1000 || 3000 * (attempt + 1));
      continue;
    }
    throw tagged(r.status === 401 || r.status === 403 ? 'auth' : 'bad-request', `Claude ${r.status}: ${why}`, { status: r.status, detail: why });
  }
  throw last;
}

/* The answer is the text AFTER the last search result: before it, the model is only
   thinking out loud about what to look up. */
function answerText(content) {
  let cut = -1;
  content.forEach((b, i) => { if (b && /tool_result$/.test(b.type || '')) cut = i; });
  const text = (list) => list.filter((b) => b && b.type === 'text').map((b) => b.text || '').join('');
  const after = text(content.slice(cut + 1));
  return after.trim() ? after : text(content);
}
async function converse({ call, model, system, messages, maxTokens, tools, ctx }) {
  let tl = tools, swapped = false, msgs = messages, content = [];
  for (let turn = 0; turn < 5; turn++) {
    const body = { model, max_tokens: maxTokens, system, messages: msgs };
    if (tl) body.tools = tl;
    let res;
    try { res = await post(body, ctx); }
    catch (e) {
      // one newer search tool, once, if this model or account refuses the first
      if (tl && !swapped && e.code === 'bad-request' && /web_search|tool/i.test(e.detail || '')) {
        swapped = true; tl = tl.map((t) => (t.type === SEARCH_TOOL ? { ...t, type: SEARCH_TOOL_NEXT } : t)); continue;
      }
      throw e;
    }
    const u = res.usage || {};
    ctx.usage.push({ call, model, in: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0),
                     out: u.output_tokens || 0, searches: (u.server_tool_use && u.server_tool_use.web_search_requests) || 0 });
    content = content.concat(res.content || []);
    if (res.stop_reason === 'refusal') throw tagged('refused', `${call}: Claude declined to answer`);
    // a long server-side search loop pauses; sending the turn back resumes it
    if (res.stop_reason === 'pause_turn') { msgs = [...msgs, { role: 'assistant', content: res.content }]; continue; }
    return { text: answerText(content), stop: res.stop_reason };
  }
  return { text: answerText(content), stop: 'pause_turn' };
}

/** The last top-level JSON object in a reply that parses; a code fence is fine. */
export function pickJSON(text) {
  let t = String(text || '').trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (fence) t = fence[1].trim();
  try { const v = JSON.parse(t); if (isObj(v)) return v; } catch {}
  let best = null;
  for (let i = t.indexOf('{'); i !== -1; i = t.indexOf('{', i + 1)) {
    let depth = 0, str = false, esc = false, end = -1;
    for (let j = i; j < t.length && end < 0; j++) {
      const c = t[j];
      if (str) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') str = false; }
      else if (c === '"') str = true; else if (c === '{') depth++; else if (c === '}' && --depth === 0) end = j;
    }
    if (end < 0) continue;
    try { const v = JSON.parse(t.slice(i, end + 1)); if (isObj(v)) { best = v; i = end; } } catch {}
  }
  return best;
}
const judge = (text, check) => {
  const o = pickJSON(text);
  if (!o) return { ok: false, why: 'the reply was not one JSON object' };
  const c = check(o);
  return c.ok ? c : { ok: false, why: c.why.slice(0, 8).join('; ') };
};
/** One question, one checked JSON answer, one repair at most. */
export async function askJSON({ call, model, system, content, check, maxTokens = 8000, tools = null, ctx }) {
  const first = [{ role: 'user', content }];
  let r = await converse({ call, model, system, messages: first, maxTokens, tools, ctx });
  let v = judge(r.text, check);
  if (v.ok) return v.value;
  const repair = [...first, { role: 'assistant', content: clean(r.text, 8000) || '(no answer)' },
    { role: 'user', content: `That did not pass the check: ${v.why}. Reply with ONLY the corrected JSON object: no prose, no code fence.` }];
  // cut off at max_tokens? more room — within what one non-streamed call can safely ask for
  r = await converse({ call: `${call}:repair`, model, system, messages: repair, maxTokens: r.stop === 'max_tokens' ? Math.min(maxTokens * 2, 16000) : maxTokens, tools: null, ctx });
  v = judge(r.text, check);
  if (v.ok) return v.value;
  throw tagged('bad-json', `${call}: no valid answer after one repair (${v.why})`);
}

/* ---------- discover ---------- */
const DISCOVER_SYSTEM = `MYSET FACTORY · DISCOVER

You find the OFFICIAL online profiles of ONE live-music act (a solo artist, a duo or a band) or ONE venue, for MySet, a live-music app. A private sample page will be built from what you return and shown to that act, so a wrong link is far worse than a missing one.

Use web_search (a few searches at most), then answer with ONE JSON object and nothing else:
{"name":"","links":{"instagram":"","youtube":"","website":"","spotify":"","applemusic":"","soundcloud":"","bandcamp":"","facebook":"","tiktok":"","google":""},"identity":{"confidence":0.0,"anchors":[{"type":"handle","value":""}],"notes":""},"city":"","country":"","actType":"band"}

Rules:
- A link goes in ONLY when the page clearly belongs to THIS act: the name matches AND at least one more thing agrees: a handle from the seed, the city, or a link to it from a profile already confirmed (their website linking to their Instagram, their Instagram bio linking to their YouTube).
- Never: fan pages, tribute acts, namesakes elsewhere, a venue's or festival's page about them, aggregators (last.fm, setlist.fm, Songkick, Bandsintown, AllMusic, Discogs, Wikipedia mirrors), link shorteners, search pages, or one post or video where a profile is asked for.
- Profile addresses only: instagram.com/<handle>, youtube.com/@<handle> or /channel/<id>, open.spotify.com/artist/<id>, music.apple.com/.../artist/.../<id>, soundcloud.com/<name>, <name>.bandcamp.com, facebook.com/<page>, tiktok.com/@<handle>. "website" is their own site (a linktr.ee page if that is all they have). "google" is a venue's Google Maps place link; leave it empty for an act.
- anchors: the SEED facts the identity rests on, each {"type":"handle"|"website"|"youtube"|"city"|"link","value":"..."}, e.g. {"type":"handle","value":"@thetidelines"}. The name alone is never an anchor.
- confidence 0..1: 0.9 or more only when two independent signals agree; about 0.5 when plausible but unconfirmed; under 0.3 when nothing reliable turned up. When unsure, leave links empty. Never guess.
- name: how the act writes its own name. city, country: where they are based, only if a page says so, else "". actType: solo, duo, band, or venue.`;

const LINK_KEYS = ['instagram', 'youtube', 'website', 'spotify', 'applemusic', 'soundcloud', 'bandcamp', 'facebook', 'tiktok', 'google'];
function checkDiscover(o) {
  const why = [];
  if (!isObj(o.links)) why.push('"links" must be an object of profile addresses');
  if (!isObj(o.identity)) why.push('"identity" must be an object');
  else {
    if (!in01(o.identity.confidence)) why.push('identity.confidence must be a number from 0 to 1');
    if (!Array.isArray(o.identity.anchors)) why.push('identity.anchors must be an array');
  }
  if (why.length) return { ok: false, why };
  const links = {};
  for (const k of LINK_KEYS) if (typeof o.links[k] === 'string' && /^https?:\/\/\S+$/i.test(o.links[k].trim())) links[k] = o.links[k].trim().slice(0, 400);
  const anchors = o.identity.anchors.map((a) => (typeof a === 'string' ? { type: 'link', value: clean(a) } : isObj(a) ? { type: clean(a.type, 20).toLowerCase(), value: clean(a.value) } : null))
    .filter((a) => a && a.value).slice(0, 12);
  return { ok: true, value: { name: clean(o.name, 80), links, identity: { confidence: o.identity.confidence, anchors, notes: clean(o.identity.notes, 400) },
    city: clean(o.city, 60), country: clean(o.country, 60), actType: ['solo', 'duo', 'band', 'venue'].includes(o.actType) ? o.actType : '' } };
}
/** `seed`: the parsed seed (+ kind); `gathered`: what the seed's own links already said. */
export async function discover(seed, gathered, ctx) {
  const view = { kind: seed.kind === 'venue' ? 'venue' : 'act', name: seed.name, city: seed.city, country: seed.country,
    links: Object.fromEntries(Object.entries(seed.links || {}).filter(([, v]) => v)), handles: seed.handles, youtubeChannelId: seed.ytId || undefined };
  const content = `SEED (from the founder):\n${JSON.stringify(view)}\n\nALREADY READ BY MYSET, from the seed's own links:\n${JSON.stringify(gathered || {}).slice(0, 8000)}\n\nFind the official profiles of this ${view.kind}.`;
  return askJSON({ call: 'discover', model: modelSmart(ctx), system: DISCOVER_SYSTEM, content, check: checkDiscover, maxTokens: 16000,
                   tools: [{ type: SEARCH_TOOL, name: 'web_search', max_uses: 5 }], ctx });
}

/* ---------- facts ---------- */
export const ARTIST_FACTS = ['name', 'act_type', 'member', 'instrument', 'genre', 'based_in', 'origin', 'formed', 'release', 'original_song', 'cover_song', 'venue', 'residency', 'festival', 'collab', 'award', 'press', 'language', 'other'];
export const VENUE_FACTS = ['name', 'venue_type', 'address', 'city', 'country', 'phone', 'hours', 'music_nights', 'amenity', 'food', 'drinks', 'capacity', 'opened', 'other'];
const FACTS_SYSTEM = `MYSET FACTORY · FACTS

You extract facts about ONE live-music act (or ONE venue) from numbered sources, for a short sample page on MySet. Answer with ONE JSON object and nothing else:
{"facts":[{"k":"genre","v":"Indie folk","src":[1]}]}

k is one of:
for an act: ${ARTIST_FACTS.join(', ')}
for a venue: ${VENUE_FACTS.join(', ')}

Hard rules:
- NEVER invent, infer or embellish. A short true list is right; a longer guessed one is a failure.
- src lists the numbers of the sources that SAY it. A fact no source states is not a fact: leave it out.
- No number (a year, a count, followers, views) unless a source states it.
- Only this act or venue. If a source mixes in someone else, keep only what is plainly about this one.
- Public, professional facts only: nothing private (personal phone numbers or email, home addresses, family, health).
- A video title is a source: "Wonderwall (Oasis cover) - live at Sunset Bar" supports cover_song "Wonderwall (Oasis)" and venue "Sunset Bar".
- The founder's note says where the founder came across them: a place they play, not necessarily where they live.
- v is short plain words, under 160 characters. At most 60 facts.`;
function checkFacts(o) {
  if (!Array.isArray(o.facts)) return { ok: false, why: ['"facts" must be an array of {"k","v","src"}'] };
  const bad = o.facts.map((f, i) => (!isObj(f) || typeof f.v !== 'string' || !Array.isArray(f.src) ? i : -1)).filter((i) => i >= 0);
  return bad.length ? { ok: false, why: [`facts ${bad.slice(0, 5).join(', ')} are not {"k":"...","v":"...","src":[numbers]}`] } : { ok: true, value: o.facts };
}
/** `texts`: [{kind, url, title, text}], numbered by position. Returns [{k, v, src}], every src valid. */
export async function extractFacts(texts, ctx, { kind = 'artist', name = '' } = {}) {
  if (!texts || !texts.length) return [];
  const content = `${kind === 'venue' ? 'VENUE' : 'ACT'}: ${name || '(no name given)'}\n\n`
    + texts.map((t, i) => `[${i}] ${t.kind} · ${t.url || 'no address'}${t.title ? ' · ' + t.title : ''}\n${String(t.text || '').slice(0, 14000)}`).join('\n\n———\n\n');
  const list = await askJSON({ call: 'facts', model: modelFast(ctx), system: FACTS_SYSTEM, content: content.slice(0, 90000), check: checkFacts, maxTokens: 8000, ctx });
  const kinds = new Set(kind === 'venue' ? VENUE_FACTS : ARTIST_FACTS), seen = new Set(), out = [];
  for (const f of list) {
    const src = [...new Set(f.src.map((x) => parseInt(x, 10)).filter((x) => Number.isInteger(x) && x >= 0 && x < texts.length))];
    const v = clean(f.v, 200);
    if (!v || !src.length) continue;                        // a fact no source states is not a fact
    const k = kinds.has(f.k) ? f.k : 'other', key = `${k}|${v.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key); out.push({ k, v, src });
    if (out.length >= 60) break;
  }
  return out;
}

/* ---------- photos ---------- */
const PHOTO_KINDS = ['performing', 'portrait', 'group', 'venue-inside', 'venue-outside', 'artwork', 'logo', 'text-heavy', 'other'];
const PHOTOS_SYSTEM = `MYSET FACTORY · PHOTOS

You judge candidate pictures for ONE live-music act's (or venue's) sample page on MySet. Each image comes after a line naming its id. Judge EVERY image and answer with ONE JSON object and nothing else:
{"photos":[{"id":"y1","isAct":true,"people":2,"kind":"performing","quality":0.8,"textOverlay":0.1,"focus":"48% 32%","coverOk":true,"avatarOk":false,"dup":"","why":"both members on stage, sharp, warm light"}]}

- isAct: it shows THIS act (the artist, the band); for a venue, the venue itself. Not a crowd, another act, a poster or a line-up.
- people: how many people are clearly visible.
- kind: ${PHOTO_KINDS.join(', ')}.
- quality 0..1: sharp, well lit, well framed; would a stranger think it looks professional? Blurry, dark, tiny or smeared by compression is low.
- textOverlay 0..1: how much of it is covered by titles, captions, watermarks or logos (0 none, 1 all text).
- focus "x% y%": the point to keep when the picture is cropped. A person: between the eyes. A group: the middle of the faces. Otherwise the subject.
- coverOk: works as a wide header across a page: landscape, the act clearly shown, little or no text.
- avatarOk: works cropped to a square around focus: a face, or the act clearly.
- dup: the id of an EARLIER image here that is essentially the same shot, else "".
- why: at most twelve words.
Be strict. A video thumbnail with a title across it has textOverlay 0.5 or more and is not coverOk.`;
const focusOf = (f) => { const m = /^(\d{1,3})% (\d{1,3})%$/.exec(String(f || '').trim()); return m ? `${Math.min(100, +m[1])}% ${Math.min(100, +m[2])}%` : '50% 40%'; };
function checkPhotos(o, ids) {
  if (!Array.isArray(o.photos)) return { ok: false, why: ['"photos" must be an array with one entry per image'] };
  const why = [], got = new Map();
  for (const p of o.photos) {
    const id = isObj(p) ? String(p.id) : '?';
    if (!ids.includes(id)) { why.push(`there is no image ${id}`); continue; }
    if (!PHOTO_KINDS.includes(p.kind)) why.push(`${id}: kind must be one of ${PHOTO_KINDS.join(', ')}`);
    for (const f of ['quality', 'textOverlay']) if (!in01(p[f])) why.push(`${id}: ${f} must be a number from 0 to 1`);
    for (const f of ['isAct', 'coverOk', 'avatarOk']) if (typeof p[f] !== 'boolean') why.push(`${id}: ${f} must be true or false`);
    if (!/^\d{1,3}% \d{1,3}%$/.test(String(p.focus || '').trim())) why.push(`${id}: focus must look like "50% 30%"`);
    got.set(id, p);
  }
  for (const id of ids) if (!got.has(id)) why.push(`image ${id} was not judged`);
  if (why.length) return { ok: false, why };
  return { ok: true, value: ids.map((id) => { const p = got.get(id); return { id, isAct: p.isAct, people: Math.max(0, Math.min(50, parseInt(p.people, 10) || 0)),
    kind: p.kind, quality: p.quality, textOverlay: p.textOverlay, focus: focusOf(p.focus), coverOk: p.coverOk, avatarOk: p.avatarOk,
    dup: ids.includes(String(p.dup || '')) && String(p.dup) !== id ? String(p.dup) : '', why: String(p.why || '').split(/\s+/).slice(0, 12).join(' ').slice(0, 100) }; }) };
}
/* The picks. The founder's rule: a YouTube thumbnail is tried FIRST and used only when
   it is genuinely good; the website's pictures next; photos the founder added last.
   Nothing that is not the act, nothing with text across it, never the same shot twice
   (one frame per video, and whatever the judge marked a duplicate). */
const FROM_RANK = { youtube: 0, website: 1, instagram: 2, founder: 2 };
export function pickPhotos(judged, { kind = 'artist' } = {}) {
  const J = (judged || []).filter((j) => j && j.isAct && !j.dup && j.textOverlay < 0.3);
  const rank = (a, b) => (FROM_RANK[a.from] ?? 3) - (FROM_RANK[b.from] ?? 3) || b.quality - a.quality;
  const cover = J.filter((j) => j.coverOk && j.quality >= 0.7 && j.width >= 1000 && j.width >= j.height * 1.2).sort(rank)[0] || null;
  let avatar = null;
  if (kind !== 'venue') {                                   // a venue page has no portrait
    const ok = J.filter((j) => j !== cover && j.avatarOk && j.quality >= 0.6 && j.people >= 1 && Math.min(j.width, j.height) >= 400
      && ['portrait', 'performing', 'group'].includes(j.kind)).sort(rank);
    const other = ok.find((j) => !cover || j.group !== cover.group), same = ok.find((j) => cover && j.group === cover.group);
    avatar = other && (!same || other.quality >= same.quality - 0.15) ? other : same || other || null;
  }
  const used = new Set([cover, avatar].filter(Boolean).map((j) => j.group)), extras = [], kinds = new Set();
  const pool = J.filter((j) => j !== cover && j !== avatar && j.quality >= 0.6 && Math.min(j.width, j.height) >= 400).sort(rank);
  for (const varied of [true, false]) for (const j of pool) {
    if (extras.length >= 3 || extras.includes(j) || used.has(j.group) || (varied && kinds.has(j.kind))) continue;
    extras.push(j); used.add(j.group); kinds.add(j.kind);
  }
  return { cover, avatar, extras };
}
/** `cands`: [{id, from, group, bytes, type, width, height, src, note}]. Ten a call.
 *  Returns { judged: cands with the verdict merged in, picks }. */
export async function judgePhotos(cands, ctx, { kind = 'artist', name = '' } = {}) {
  const judged = [];
  for (let i = 0; i < (cands || []).length; i += 10) {
    const batch = cands.slice(i, i + 10), ids = batch.map((c) => c.id);
    const content = [{ type: 'text', text: `${kind === 'venue' ? 'Venue' : 'Act'}: ${name || '(no name)'}. ${batch.length} image(s) follow; judge every one.` }];
    for (const c of batch) {
      content.push({ type: 'text', text: `Image id=${c.id} · from ${c.from} · ${c.width}x${c.height}${c.note ? ' · ' + c.note : ''}` });
      content.push({ type: 'image', source: { type: 'base64', media_type: c.type, data: Buffer.from(c.bytes).toString('base64') } });
    }
    const got = await askJSON({ call: 'photos', model: modelSmart(ctx), system: PHOTOS_SYSTEM, content, check: (o) => checkPhotos(o, ids), maxTokens: 8000, ctx });
    for (const v of got) judged.push({ ...batch.find((c) => c.id === v.id), ...v });
  }
  return { judged, picks: pickPhotos(judged, { kind }) };
}

/* ---------- copy ---------- */
const NO_HYPE = 'No hype: never electrifying, unforgettable, mesmerising, legendary, world-class, iconic, epic, incredible, amazing, captivating, breathtaking, stunning, magical.';
const COPY_SYSTEM = `MYSET FACTORY · COPY

You write the short copy for ONE live-music act's sample page on MySet, from the numbered FACTS only. Plain, specific, warm and true: the lines a friend who has seen them play would write.
Answer with ONE JSON object and nothing else:
{"tagline":{"text":"","src":[]},"style":{"text":"","src":[]},"bio":[{"s":"","src":[]}],"hook":{"text":"","src":[]}}

- src: the numbers of the FACTS each line rests on. Every line needs at least one.
- tagline: at most 120 characters. What they play and where, concretely.
- style: at most 60 characters, two or three short genre or format words joined by " · ", like "Acoustic covers · indie folk".
- bio: two to four sentences, at most 700 characters in all, third person, warm and concrete.
- hook: ONE sentence the founder could open a direct message with, true and specific to them, like a named cover they posted or a venue they play. "" if the facts hold nothing specific.
- Only what the facts say: no invented venues, releases, awards, members, years, numbers or quotes. If the facts are thin, write less.
- ${NO_HYPE}`;
const VENUE_COPY_SYSTEM = `MYSET FACTORY · COPY

You write the short copy for ONE venue's sample page on MySet, from the numbered FACTS only. Plain, specific, warm and true.
Answer with ONE JSON object and nothing else:
{"tagline":{"text":"","src":[]},"about":[{"s":"","src":[]}],"hook":{"text":"","src":[]}}

- src: the numbers of the FACTS each line rests on. Every line needs at least one.
- tagline: at most 120 characters: what kind of place, where, and what goes on there.
- about: two to five sentences, at most 900 characters in all, warm and concrete: the place, the music, what to expect.
- hook: ONE sentence the founder could open a message with, true and specific (a music night they run, something they are known for). "" if nothing specific.
- Only what the facts say: no invented events, prices, awards, dates, numbers or quotes. If the facts are thin, write less.
- ${NO_HYPE}`;
const HYPE = /\b(electrifying|unforgettable|mesmeri[sz]ing|legendary|world[- ]class|iconic|epic|incredible|amazing|captivating|breathtaking|sensational|spellbinding|stunning|phenomenal|magical|jaw[- ]dropping|must[- ]see|one[- ]of[- ]a[- ]kind)\b/i;
const FIRST_PERSON = /\b(I|I['’](m|ve|d|ll)|my|we|we['’](re|ve)|our)\b/i;
function checkCopy(o, venue) {
  const why = [], line = (x, n) => { if (!isObj(x) || typeof x.text !== 'string' || !Array.isArray(x.src)) why.push(`"${n}" must be {"text":"...","src":[numbers]}`); };
  line(o.tagline, 'tagline'); line(o.hook, 'hook'); if (!venue) line(o.style, 'style');
  const key = venue ? 'about' : 'bio', body = o[key];
  if (!Array.isArray(body) || body.some((s) => !isObj(s) || typeof s.s !== 'string' || !Array.isArray(s.src))) why.push(`"${key}" must be an array of {"s":"sentence","src":[numbers]}`);
  if (why.length) return { ok: false, why };
  const all = [o.tagline.text, o.hook.text, venue ? '' : o.style.text, ...body.map((s) => s.s)];
  const hype = [...new Set(all.map((t) => (HYPE.exec(t) || [])[0]).filter(Boolean).map((h) => h.toLowerCase()))];
  if (hype.length) why.push(`no hype words: remove "${hype.join('", "')}"`);
  if (!venue && body.some((s) => FIRST_PERSON.test(s.s))) why.push('the bio is third person: no "I", "we", "my" or "our"');
  if (o.tagline.text.length > 120) why.push(`the tagline is ${o.tagline.text.length} characters; 120 at most`);
  return why.length ? { ok: false, why } : { ok: true, value: o };
}
/* Every number a line states must be in the facts it cites — "12,000 views", "since
   2015" and "a hundred gigs" are exactly the invented specifics that make a stranger's
   page read false. */
export const numbersOk = (text, pool) => (String(text).match(/\d+(?:[.,:]\d+)*/g) || []).every((n) => String(pool).replace(/,/g, '').includes(n.replace(/,/g, '')));
const cutWords = (t, n) => (t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, '').replace(/[\s,;:·–—-]+$/, ''));
/** Drop what is unsourced, trim to the page's limits. Exported for the tests. */
export function tidyCopy(o, facts, venue) {
  const n = facts.length;
  const fIdx = (src) => [...new Set((src || []).map((x) => parseInt(x, 10)).filter((x) => Number.isInteger(x) && x >= 0 && x < n))];
  const srcOf = (f) => [...new Set(f.flatMap((i) => facts[i].src))].sort((a, b) => a - b);
  const grounded = (t, f) => f.length > 0 && numbersOk(t, f.map((i) => facts[i].v).join(' ')) && !HYPE.test(t);
  const sentences = [];
  for (const s of (venue ? o.about : o.bio) || []) {
    const t = clean(s && s.s, 1000), f = fIdx(s && s.src);
    // never cut a sentence short: one too long for a short bio is dropped whole
    if (t && t.length <= 400 && grounded(t, f)) sentences.push({ s: /[.!?…]["”’)]?$/.test(t) ? t : `${t}.`, f, src: srcOf(f) });
  }
  const cap = venue ? 900 : 700, most = venue ? 5 : 4, kept = [];
  for (const s of sentences) { if (kept.length >= most || [...kept, s].map((x) => x.s).join(' ').length > cap) break; kept.push(s); }
  const one = (x, max) => { const t = clean(x && x.text, 400), f = fIdx(x && x.src); return t && grounded(t, f) ? { text: cutWords(t, max), f, src: srcOf(f) } : { text: '', f: [], src: [] }; };
  const out = { tagline: one(o.tagline, 120), hook: one(o.hook, 240), sentences: kept, text: kept.map((x) => x.s).join(' ') };
  if (!venue) {
    const st = one(o.style, 200), parts = st.text.split(/\s+·\s+/).filter(Boolean), keep = [];
    for (const p of parts) if ([...keep, p].join(' · ').length <= 60) keep.push(p); else break;
    out.style = { ...st, text: keep.join(' · ') };
  }
  return out;
}
/** `facts` [{k, v, src}], `sources` [{url, kind, title}]. Returns { tagline, style?, hook,
 *  sentences:[{s, f, src}], text } — `f` the fact numbers a line rests on, `src` the
 *  sources those facts came from. */
export async function writeCopy(facts, sources, kind, ctx, { name = '' } = {}) {
  const venue = kind === 'venue';
  if (!facts || !facts.length) return tidyCopy({ tagline: {}, hook: {}, style: {}, bio: [], about: [] }, [], venue);
  const content = `${venue ? 'VENUE' : 'ACT'}: ${name || '(no name)'}\n\nFACTS (cite these numbers in src):\n${facts.map((f, i) => `[${i}] ${f.k}: ${f.v}`).join('\n')}`
    + `\n\nWHERE THE FACTS CAME FROM (for your information only):\n${(sources || []).map((s, i) => `(${i}) ${s.kind} · ${s.title || s.url || ''}`).join('\n')}`;
  const o = await askJSON({ call: 'copy', model: modelSmart(ctx), system: venue ? VENUE_COPY_SYSTEM : COPY_SYSTEM, content,
                            check: (x) => checkCopy(x, venue), maxTokens: 16000, ctx });
  return tidyCopy(o, facts, venue);
}
