import { casDoc, readDoc, sha } from './_lib.mjs';
import { parseYouTube, embedSrc } from './_embeds.mjs';
import { decodeDataUrl, putImage, dropImage, POST_SLOT } from './_img.mjs';
import { getClip, dropClip, clearPending, CLIP_ID } from './_video.mjs';

/* THE COMMUNITY PAGE — what fans say about a night, and the shop above it.

   One page per artist and per venue (`/<slug>/community`, `/v/<slug>/community`).
   Fans post without signing in (9g): a device id, the same one the voting page
   uses, is all a post carries — and it never leaves the server (0bu). What a post
   holds: up to 500 characters, a star rating, which show they were at (a real
   archived night, picked from the artist's own history — never guessed, 17d),
   up to three photos, ONE 30-SECOND CLIP, and a video LINK.

   The clip and the link are two different things and both are kept. A link is
   free, works on any phone and needs no upload; a clip is a moment from the room
   that was never going to be on YouTube. The clip is uploaded on its own, BEFORE
   the post (a function body tops out around 6MB and three photos already spend
   most of it — see _video.mjs), so a post carries only its id. YouTube links
   embed through the same exact-host parser the profile uses (9b); Instagram and
   TikTok links are shown as links.

   What keeps it a room and not a wall:
     · limits are enforced HERE, inside the CAS, never only in the page (15k):
       three posts a day per device, one per show per device, and a soft
       per-network ceiling wide enough that a whole bar on one wifi never hits it
     · the owner can hide, delete, pin and reply — one reply per post, in their
       own words — and fans can report; a report is a count, not a takedown
     · likes are one per device, kept as hashes in a SEPARATE document so the feed
       document stays small and a burst of hearts does not fight the composer
     · a hidden post is invisible to the public and visible to the owner, so a
       decision can be undone
     · everything the room reads is free on every plan (0w)

   Keys are per owner — `posts_<aid>` / `posts_v_<vid>` — and nothing here is
   global (0a). The audience poll is not touched. */

const KEY = (owner) => `posts_${owner}`;
const LKEY = (owner) => `likes_${owner}`;
export const MAX_POSTS = 200;          // the feed keeps this many; older ones fall off
export const MAX_TEXT = 500;
export const MAX_NAME = 30;
export const MAX_PHOTOS = 3;
export const MAX_REPLY = 500;
export const DAY = 24 * 3600e3;
export const PER_DEVICE_PER_DAY = 3;
export const PER_NETWORK_PER_DAY = 150;
export const MAX_LIKERS = 500;          // hashes kept per post for idempotency
/* HOW LONG SOMEBODY MAY EDIT WHAT THEY WROTE. Perry's number. Long enough to fix a
   typo or a name the morning after; short enough that a five-star review cannot
   quietly become a one-star one months later, under a reply the artist already
   wrote. Deleting has no window — taking your own words back is always allowed. */
export const EDIT_WINDOW = 24 * 3600e3;

const empty = () => ({ v: 1, list: [], recent: [], n: 0 });
const emptyLikes = () => ({ v: 1, by: {} });
const h10 = (v) => sha(String(v || '')).slice(0, 10);
const clean = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);

export async function readPosts(owner) {
  const { data } = await readDoc(KEY(owner), null);
  const d = { ...empty(), ...(data || {}) };
  d.list = Array.isArray(d.list) ? d.list : [];
  d.recent = Array.isArray(d.recent) ? d.recent : [];
  return d;
}
export async function readLikes(owner) {
  const { data } = await readDoc(LKEY(owner), null);
  const d = { ...emptyLikes(), ...(data || {}) };
  d.by = d.by && typeof d.by === 'object' ? d.by : {};
  return d;
}

/* A video is a parsed record, never the pasted string (9b). Only three providers,
   by exact host; anything else is refused with a reason the page can show. */
const IG_HOSTS = new Set(['instagram.com', 'www.instagram.com']);
const TT_HOSTS = new Set(['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com', 'm.tiktok.com']);
export function parseVideo(raw) {
  const v = String(raw || '').trim();
  if (!v) return null;
  const yt = parseYouTube(v);
  if (yt) return { provider: 'youtube', id: yt.id };
  let u;
  try { u = new URL(v); } catch { return { error: 'That doesn’t look like a link.' }; }
  if (u.protocol !== 'https:') return { error: 'That link needs to start with https.' };
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (IG_HOSTS.has(host) || TT_HOSTS.has(host)) {
    u.hash = ''; u.search = '';
    return { provider: IG_HOSTS.has(host) ? 'instagram' : 'tiktok', href: u.toString().slice(0, 300) };
  }
  return { error: 'Videos can be a YouTube, Instagram or TikTok link.' };
}
/* What the page gets for a video: an embed src for YouTube (rebuilt from a literal
   template on every read, like the profile's media), a plain link for the rest. */
export function shapeVideo(vd) {
  if (!vd || !vd.provider) return null;
  if (vd.provider === 'youtube') {
    const src = embedSrc({ provider: 'youtube', type: 'video', id: vd.id });
    return src ? { provider: 'youtube', src, href: `https://www.youtube.com/watch?v=${encodeURIComponent(vd.id)}` } : null;
  }
  return { provider: vd.provider, href: vd.href };
}

export const newPostId = () => 'c' + Math.random().toString(36).slice(2, 10).padEnd(8, '0').slice(0, 8);

/* What the page gets for an uploaded clip: the two URLs, built from a literal
   template on every read rather than stored, so a stored record can never become
   a link to somewhere else. `poster` is a normal photo slot, so it is already
   cached for a year by /api/img. */
export const shapeClip = (owner, clip) => (CLIP_ID.test(String(clip || '')) ? {
  src: `/api/vid?a=${encodeURIComponent(owner)}&c=${clip}`,
  poster: `/api/img?a=${encodeURIComponent(owner)}&s=${clip}`,
} : null);

/**
 * Add a post. `photos` are data URLs, already shrunk on the phone; they are written
 * before the CAS (their names come from the post id, minted outside it) and dropped
 * again if the post is refused. Returns { ok, error, id }.
 */
export async function addPost(owner, { fan, ip, name, text, stars, show, showLabel, photos, video, clip }) {
  if (!fan) return { ok: false, error: 'no device' };
  const body = String(text || '').replace(/\r/g, '').trim().slice(0, MAX_TEXT);
  const n = stars == null || stars === '' ? null : Math.round(Number(stars));
  if (n !== null && (!Number.isFinite(n) || n < 1 || n > 5)) return { ok: false, error: 'Stars are 1 to 5.' };
  const clipId = CLIP_ID.test(String(clip || '')) ? String(clip) : '';
  if (clip && !clipId) return { ok: false, error: 'That clip didn’t finish uploading. Try again.' };
  if (!body && n === null && !(photos || []).length && !video && !clipId)
    return { ok: false, error: 'Say something, rate it, or add a photo.' };
  let vid = null;
  if (video) { vid = parseVideo(video); if (vid && vid.error) return { ok: false, error: vid.error }; }
  /* THE CLIP HAS TO REALLY BE THERE. A post is allowed to name a clip id, so
     without this check a hand-made request could hang a player on every phone
     that opens the page, pointed at nothing. Cheap: one read, and only when a
     clip was named. */
  if (clipId && !(await getClip(owner, clipId)))
    return { ok: false, error: 'That clip didn’t finish uploading. Try again.' };

  const id = newPostId();
  const urls = [];
  const list = (Array.isArray(photos) ? photos : []).slice(0, MAX_PHOTOS);
  for (let i = 0; i < list.length; i++) {
    const dec = decodeDataUrl(list[i]);
    if (dec.error) { for (const [k] of urls.entries()) await dropImage(owner, `${id}_${k}`); return { ok: false, error: dec.error }; }
    urls.push(await putImage(owner, `${id}_${i}`, dec.bytes, dec.type));
  }

  const now = Date.now();
  const f = h10(fan), net = h10(owner + '|' + (ip || ''));
  let refused = null;
  await casDoc(KEY(owner), empty, (d) => {
    d.list = Array.isArray(d.list) ? d.list : [];
    d.recent = (Array.isArray(d.recent) ? d.recent : []).filter((r) => r && now - r.at < DAY);
    const mine = d.recent.filter((r) => r.f === f);
    if (mine.length >= PER_DEVICE_PER_DAY) { refused = 'That’s three posts today from this phone — come back tomorrow.'; return false; }
    if (show && d.list.some((p) => p && p.fan === fan && p.show === show)) { refused = 'You’ve already posted about that night — one per show.'; return false; }
    if (d.recent.filter((r) => r.n === net).length >= PER_NETWORK_PER_DAY) { refused = 'This network has posted a lot today. Try again tomorrow.'; return false; }
    d.recent.push({ f, n: net, at: now });
    if (d.recent.length > 400) d.recent = d.recent.slice(-400);
    d.list.push({ id, fan, name: clean(name, MAX_NAME), text: body, stars: n,
                  show: String(show || '').slice(0, 40), showLabel: clean(showLabel, 60),
                  photos: urls, video: vid, clip: clipId || null, at: now, likes: 0, reply: null,
                  hidden: false, pinned: false, reports: 0, rep: [] });
    d.n = (d.n || 0) + 1;
    if (d.list.length > MAX_POSTS) d.list = d.list.slice(-MAX_POSTS);
    return true;
  });
  if (refused) { for (let i = 0; i < urls.length; i++) await dropImage(owner, `${id}_${i}`); return { ok: false, error: refused }; }
  /* The clip now belongs to a post, so it is no longer an orphan waiting to be
     swept. Best-effort on purpose: if this write is lost the sweep deletes a clip
     that IS posted, which would be wrong — so sweepPending checks the feed too. */
  if (clipId) await clearPending(owner, clipId);
  return { ok: true, id };
}

/** Change what you wrote, for 24 hours. Only your own post, and only the words and
 *  the stars — photos and the clip are left alone, because re-uploading them is a
 *  different job and an edit that silently dropped them would be a trap. */
export async function editPost(owner, fan, id, { text, stars }) {
  if (!fan || !id) return { ok: false, error: 'no device' };
  const body = String(text || '').replace(/\r/g, '').trim().slice(0, MAX_TEXT);
  const n = stars == null || stars === '' ? null : Math.round(Number(stars));
  if (n !== null && (!Number.isFinite(n) || n < 1 || n > 5)) return { ok: false, error: 'Stars are 1 to 5.' };
  let err = null;
  await casDoc(KEY(owner), empty, (d) => {
    const p = (d.list || []).find((x) => x && x.id === id);
    if (!p) { err = 'That post is gone.'; return false; }
    /* The device is compared INSIDE the write, against the stored value — the id
       arrives from a phone and proves nothing on its own. Same rule as a like. */
    if (p.fan !== fan) { err = 'That isn’t your post.'; return false; }
    if (Date.now() - (p.at || 0) > EDIT_WINDOW) { err = 'Posts can be changed for a day. After that you can delete it.'; return false; }
    if (!body && n === null && !(p.photos || []).length && !p.clip && !p.video) {
      err = 'Say something, or rate it.'; return false;
    }
    p.text = body; p.stars = n; p.editedAt = Date.now();
    return true;
  });
  return err ? { ok: false, error: err } : { ok: true };
}

/** Take your own post back. No window — your words are yours. */
export async function removeOwnPost(owner, fan, id) {
  if (!fan || !id) return { ok: false, error: 'no device' };
  let err = null, photos = [], clip = '';
  await casDoc(KEY(owner), empty, (d) => {
    const p = (d.list || []).find((x) => x && x.id === id);
    if (!p) { err = 'That post is gone.'; return false; }
    if (p.fan !== fan) { err = 'That isn’t your post.'; return false; }
    photos = p.photos || []; clip = p.clip || '';
    d.list = d.list.filter((x) => x !== p);
    return true;
  });
  if (err) return { ok: false, error: err };
  for (let i = 0; i < photos.length; i++) await dropImage(owner, `${id}_${i}`);
  if (clip) await dropClip(owner, clip);
  await casDoc(LKEY(owner), emptyLikes, (d) => { if (!d.by || !d.by[id]) return false; delete d.by[id]; return true; }).catch(() => {});
  return { ok: true };
}

/** One heart per device per post, idempotent by hash. Returns { ok, likes, liked }. */
export async function likePost(owner, fan, id, on = true) {
  if (!fan || !id) return { ok: false, error: 'no device' };
  const f = h10(fan);
  let changed = false, exists = false;
  await casDoc(LKEY(owner), emptyLikes, (d) => {
    d.by = d.by && typeof d.by === 'object' ? d.by : {};
    const set = (d.by[id] ||= {});
    const has = !!set[f];
    if (on && !has) { if (Object.keys(set).length < MAX_LIKERS) set[f] = 1; changed = true; }
    if (!on && has) { delete set[f]; changed = true; }
    return changed;
  });
  let likes = 0;
  await casDoc(KEY(owner), empty, (d) => {
    const p = (d.list || []).find((x) => x && x.id === id);
    if (!p) return false;
    exists = true;
    if (changed) p.likes = Math.max(0, (p.likes || 0) + (on ? 1 : -1));
    likes = p.likes || 0;
    return changed;
  });
  if (!exists) return { ok: false, error: 'That post is gone.' };
  return { ok: true, likes, liked: on };
}

/** A report is a count the owner sees, never a takedown. One per device. */
export async function reportPost(owner, fan, id) {
  if (!fan || !id) return { ok: false, error: 'no device' };
  const f = h10(fan);
  let exists = false;
  await casDoc(KEY(owner), empty, (d) => {
    const p = (d.list || []).find((x) => x && x.id === id);
    if (!p) return false;
    exists = true;
    p.rep = Array.isArray(p.rep) ? p.rep : [];
    if (p.rep.includes(f)) return false;
    p.rep.push(f); if (p.rep.length > 50) p.rep = p.rep.slice(-50);
    p.reports = (p.reports || 0) + 1;
    return true;
  });
  return exists ? { ok: true } : { ok: false, error: 'That post is gone.' };
}

/* ---------- the owner's side ---------- */
export async function moderate(owner, { action, id, text, on }) {
  if (!id) return { ok: false, error: 'which post?' };
  let found = false, photos = [], clip = '';
  if (action === 'postDelete') {
    await casDoc(KEY(owner), empty, (d) => {
      const p = (d.list || []).find((x) => x && x.id === id);
      if (!p) return false;
      found = true; photos = p.photos || []; clip = p.clip || '';
      d.list = d.list.filter((x) => x !== p);
      return true;
    });
    if (found) {
      for (let i = 0; i < photos.length; i++) await dropImage(owner, `${id}_${i}`);
      if (clip) await dropClip(owner, clip);
      await casDoc(LKEY(owner), emptyLikes, (d) => { if (!d.by || !d.by[id]) return false; delete d.by[id]; return true; }).catch(() => {});
    }
    return found ? { ok: true } : { ok: false, error: 'That post is gone.' };
  }
  await casDoc(KEY(owner), empty, (d) => {
    const p = (d.list || []).find((x) => x && x.id === id);
    if (!p) return false;
    found = true;
    if (action === 'postHide') p.hidden = on !== false;
    else if (action === 'postPin') p.pinned = on !== false;
    else if (action === 'postReply') {
      const t = String(text || '').replace(/\r/g, '').trim().slice(0, MAX_REPLY);
      p.reply = t ? { text: t, at: Date.now() } : null;
    } else return false;
    return true;
  });
  return found ? { ok: true } : { ok: false, error: 'That post is gone.' };
}

/* ---------- what the page gets ---------- */
/** Public shape: never a device id, never a hidden post; pinned first, newest first. */
export function shapePosts(d, likes, fan, owner) {
  const f = fan ? h10(fan) : null;
  return d.list
    .filter((p) => p && !p.hidden)
    .sort((a, b) => (b.pinned - a.pinned) || (b.at - a.at))
    .map((p) => ({
      id: p.id, name: p.name || '', text: p.text || '', stars: p.stars || null,
      show: p.show || '', showLabel: p.showLabel || '',
      photos: p.photos || [], video: shapeVideo(p.video), clip: shapeClip(owner, p.clip),
      at: p.at, likes: p.likes || 0, reply: p.reply || null, pinned: !!p.pinned,
      edited: !!p.editedAt,
      mine: !!(fan && p.fan === fan),
      /* Whether the EDIT button is drawn. editPost checks the same window inside
         its own write, so this is what the page shows, never what it is allowed
         to do (15k). */
      editable: !!(fan && p.fan === fan && Date.now() - (p.at || 0) <= EDIT_WINDOW),
      liked: !!(f && likes && likes.by && likes.by[p.id] && likes.by[p.id][f]),
    }));
}
/** The owner's shape: hidden posts too, and how many reports — still no device id. */
export function shapeForOwner(d, owner) {
  return d.list
    .slice()
    .sort((a, b) => (b.pinned - a.pinned) || (b.at - a.at))
    .map((p) => ({
      id: p.id, name: p.name || '', text: p.text || '', stars: p.stars || null,
      show: p.show || '', showLabel: p.showLabel || '',
      photos: p.photos || [], video: shapeVideo(p.video), clip: shapeClip(owner, p.clip),
      at: p.at, likes: p.likes || 0, reply: p.reply || null, edited: !!p.editedAt,
      pinned: !!p.pinned, hidden: !!p.hidden, reports: p.reports || 0,
    }));
}
export { POST_SLOT };
