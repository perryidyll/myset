import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { casDoc, readDoc } from './_lib.mjs';
import { authSecret, mutateArtists, readArtists } from './_auth.mjs';

/* SESSIONS, THE ACTIVITY LOG, AND RECOVERY CODES.

   What was missing before this file existed, and why each one mattered:

     · SIGNING OUT DID NOT SIGN YOU OUT. `signOut()` in the Studio cleared
       localStorage and nothing else. The token is an HMAC with a thirty-day life,
       so a copy of it — off a shared phone, a browser profile, a backup — kept
       working for a month after the person believed they had left. The only
       server-side kill was "sign every device out", which is not a thing you offer
       somebody who just wants off one iPad.
     · THERE WAS NOTHING TO SHOW. No list of where you are signed in, and no record
       that anything happened. When a musician asks "did somebody else get into my
       page?", "we have no way to know" is not an answer a paid product gives.
     · THERE WAS NO WAY BACK IN. Sign-in is a code to your inbox. Lose the inbox and
       the account was gone, unless you happened to have set a studio code. The
       recovery key rescues Perry and nobody else.

   THE COST RULE THIS FILE OBEYS. Every authenticated request already reads the
   artist registry, and INVARIANT 0ci / test/cost.mjs hold a poll to ONE global
   document. So:
     · the thing checked on every request is a normally-ABSENT `dead` map on the
       registry row the verifier is already holding. An account that has never
       revoked a session costs zero extra bytes and zero extra reads.
     · the list a human looks at lives in its own cold document, read only when the
       sessions screen is opened.
     · "last used" is written at most once an hour, from the two settings actions
       the Studio already calls — never from the four-second Live poll. It is
       labelled "last opened Settings" for that reason: printing "last used two
       hours ago" from a number that only moves when somebody opens Settings would
       be a number that lies.

   Everything here is keyed by an OWNER string: an artist id, or `v_<venueId>`
   (INVARIANT 0cw), so a venue gets the same features from the same code. */

export const SESS = (owner) => `sess_${owner}`;
export const LOG  = (owner) => `log_${owner}`;
export const REC  = (owner) => `rec_${owner}`;
const isVenue = (o) => String(o || '').startsWith('v_');

const emptySess = () => ({ v: 1, list: [] });
const emptyLog  = () => ({ v: 1, list: [] });
const emptyRec  = () => ({ v: 1, madeAt: 0, codes: [] });

const MAX_SESSIONS = 20;
const MAX_DEAD = 12;
const MAX_LOG = 100;
const TOUCH_EVERY = 3600e3;

/** A session id. Not a secret — it rides inside an already-signed token — but
 *  random so two devices on one account can never collide. No `|`, because the
 *  token body is pipe-delimited. */
export const newSid = () => randomBytes(6).toString('base64url');

/* ---------- the row on the registry, which is the hot path ---------- */
async function mutateOwnerRow(owner, fn) {
  if (isVenue(owner)) {
    const { mutateVenues } = await import('./_venues.mjs');
    return mutateVenues((reg) => { const r = reg.byId[owner.slice(2)]; return r ? fn(r, reg) : false; });
  }
  return mutateArtists((reg) => { const r = reg.byId[owner]; return r ? fn(r, reg) : false; });
}

/* THE NEXT REVISION, and it must start from the registry-wide one. An account
   created before per-account revisions has no `rev` of its own and reads the
   global — so counting up from 1 could land ON the number every live token is
   already signed with, and "sign every device out" would sign nothing out. This
   is the same `?? reg.rev` fallback revOf() has, and for the same reason. */
const bumpFrom = (row, reg) => (row.rev ?? (reg && reg.rev) ?? 1) + 1;

/** Kill one session for good: the token stays validly signed, and the verifier
 *  refuses it. `dead[sid]` holds the moment the token would have expired anyway,
 *  so an entry that is past its time is already harmless and pruning is a filter
 *  on a number rather than bookkeeping. */
export async function killSessions(owner, sids, until) {
  if (!sids || !sids.length) return { ok: true, none: true };
  let overflowed = false;
  await mutateOwnerRow(owner, (row, reg) => {
    const now = Date.now();
    const dead = {};
    for (const [k, v] of Object.entries(row.dead || {})) if (Number(v) > now) dead[k] = v;
    for (const sid of sids) if (sid) dead[sid] = until || (now + 31 * 86400e3);
    /* MORE REVOCATION THAN WAS ASKED FOR IS THE SAFE WAY TO FAIL. Past the cap we
       bump the account's rev instead, which signs every device out. Dropping the
       oldest entry would quietly un-revoke a session somebody had revoked. */
    if (Object.keys(dead).length > MAX_DEAD) {
      row.rev = bumpFrom(row, reg);
      delete row.dead;
      overflowed = true;
      return true;
    }
    row.dead = dead;
    return true;
  });
  await casDoc(SESS(owner), emptySess, (d) => {
    const before = (d.list || []).length;
    d.list = (d.list || []).filter((s) => !sids.includes(s.sid));
    return d.list.length !== before;
  }).catch(() => {});
  return { ok: true, everywhere: overflowed };
}

/** Sign every device out, this one included. */
export async function killEverything(owner) {
  await mutateOwnerRow(owner, (row, reg) => { row.rev = bumpFrom(row, reg); delete row.dead; return true; });
  await casDoc(SESS(owner), emptySess, (d) => { if (!(d.list || []).length) return false; d.list = []; return true; }).catch(() => {});
  return { ok: true };
}

/* ---------- the list a person looks at ---------- */
/** A device CLASS, never the raw User-Agent. "iPhone · Safari" is what somebody
 *  recognises; a 140-character UA string is what a support ticket looks like. */
export function deviceLabel(ua, standalone) {
  const s = String(ua || '');
  const os = /iPhone/.test(s) ? 'iPhone' : /iPad/.test(s) ? 'iPad'
    : /Android/.test(s) ? 'Android' : /Macintosh|Mac OS X/.test(s) ? 'Mac'
    : /Windows/.test(s) ? 'Windows' : /Linux/.test(s) ? 'Linux' : '';
  const br = /CriOS|Chrome\//.test(s) ? 'Chrome' : /FxiOS|Firefox/.test(s) ? 'Firefox'
    : /Edg\//.test(s) ? 'Edge' : /Safari/.test(s) ? 'Safari' : '';
  const bits = [os, standalone ? 'installed app' : br].filter(Boolean);
  return bits.length ? bits.join(' · ') : 'A device we can’t identify';
}

export async function addSession(owner, { sid, email, label, tz, at }) {
  await casDoc(SESS(owner), emptySess, (d) => {
    d.list ||= [];
    d.list = d.list.filter((s) => s.sid !== sid);
    d.list.unshift({ sid, email: email || '', label: label || '', tz: tz || '', at: at || Date.now(), seen: at || Date.now() });
    /* Past the cap the OLDEST is evicted and properly killed. An eviction that only
       dropped the row would leave a session alive that the list says is gone. */
    if (d.list.length > MAX_SESSIONS) {
      d.evicted = (d.evicted || []).concat(d.list.slice(MAX_SESSIONS).map((s) => s.sid)).slice(-MAX_DEAD);
      d.list = d.list.slice(0, MAX_SESSIONS);
    }
    return true;
  }).catch(() => {});
  const { data } = await readDoc(SESS(owner), null);
  const evicted = (data && data.evicted) || [];
  if (evicted.length) {
    await killSessions(owner, evicted).catch(() => {});
    await casDoc(SESS(owner), emptySess, (d) => { if (!d.evicted) return false; delete d.evicted; return true; }).catch(() => {});
  }
}

/** At most one write an hour, and only from Studio boot. `casDoc` does not write
 *  at all when the mutator returns false, so the steady state is one read. */
export async function touchSession(owner, sid, now = Date.now()) {
  if (!sid) return;
  await casDoc(SESS(owner), emptySess, (d) => {
    const s = (d.list || []).find((x) => x.sid === sid);
    if (!s) return false;
    if (now - (s.seen || 0) < TOUCH_EVERY) return false;
    s.seen = now;
    return true;
  }).catch(() => {});
}

export async function readSessions(owner, mySid) {
  const { data } = await readDoc(SESS(owner), null);
  const list = ((data && data.list) || []).map((s) => ({
    sid: s.sid, email: s.email || '', label: s.label || 'A device we can’t identify',
    tz: s.tz || '', at: s.at || 0, seen: s.seen || s.at || 0, current: !!mySid && s.sid === mySid,
  }));
  /* A token minted before sessions existed carries no sid, so it cannot appear in
     the list and cannot be signed out one at a time. Saying so is better than a
     list that quietly omits the phone the person is holding. */
  return { list, legacy: !mySid };
}

/* ---------- the activity log ----------
   Bounded by construction, and written best-effort: a logging failure must never
   be the reason a musician cannot start a show. */
export function note(owner, e, by, meta) {
  return casDoc(LOG(owner), emptyLog, (d) => {
    d.list ||= [];
    d.list.unshift({ t: Date.now(), e: String(e).slice(0, 24), by: String(by || '').slice(0, 160),
                     ...(meta ? { m: String(meta).slice(0, 80) } : {}) });
    if (d.list.length > MAX_LOG) d.list.length = MAX_LOG;
    return true;
  }).catch(() => {});
}
export async function readLog(owner, n = 25) {
  const { data } = await readDoc(LOG(owner), null);
  return ((data && data.list) || []).slice(0, n);
}

/* ---------- recovery codes ----------
   The honest answer to "what if I lose my email". Eight one-time codes, hashed
   with the same site secret the six-digit codes use, shown once and never again.
   Crockford-ish alphabet: no 0/O, no 1/I/L, because these get written on the back
   of a setlist in a dark room. */
const ALPHA = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const oneCode = () => {
  const b = randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHA[b[i] % ALPHA.length];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
};
const hashCode = async (code) =>
  createHmac('sha256', await authSecret()).update(String(code).toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');
const same = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try { return timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
};

export async function makeRecovery(owner) {
  const codes = Array.from({ length: 8 }, oneCode);
  const hashes = [];
  for (const c of codes) hashes.push({ h: await hashCode(c), usedAt: 0 });
  await casDoc(REC(owner), emptyRec, (d) => { d.madeAt = Date.now(); d.codes = hashes; return true; });
  return codes;
}
export async function recoveryStatus(owner) {
  const { data } = await readDoc(REC(owner), null);
  const codes = (data && data.codes) || [];
  return { made: !!codes.length, madeAt: (data && data.madeAt) || 0,
           left: codes.filter((c) => !c.usedAt).length, of: codes.length };
}
/** Burn one code. Returns true only if it matched an unused one. */
export async function useRecovery(owner, given) {
  const want = await hashCode(given);
  let ok = false;
  await casDoc(REC(owner), emptyRec, (d) => {
    for (const c of d.codes || []) {
      if (c.usedAt || !same(c.h, want)) continue;
      c.usedAt = Date.now(); ok = true; return true;
    }
    return false;
  }).catch(() => {});
  return ok;
}

/* ---------- who may do what ----------
   `byEmail[email].role` already existed and carried a string; nothing read it in
   most places, so a member could delete the owner's sign-in address and rename
   the public page. This is the one table that says what a role means.

     owner   one per account: money, plan, payouts, access, the page address,
             recovery codes, export, deletion
     member  the page and the show: library, setlist, gigs, profile, community,
             requests, stats. Sees money totals; never moves money
     crew    tonight only: run the show, see the queue and the requests

   AN UNKNOWN ROLE FALLS BACK TO `crew`, the least it could be. Default-deny, so a
   role string this table has never heard of can never be an escalation. That also
   quietly retires `staff`, which venueauth wrote and nothing ever read. */
export const CAN = {
  owner: null,                                          // null means everything
  member: new Set(['show', 'library', 'gigs', 'profile', 'community', 'requests', 'stats', 'export', 'audit']),
  crew: new Set(['show', 'requests']),
};
export const can = (role, what) => {
  if (role === 'owner') return true;
  /* AN OWN-PROPERTY CHECK, NOT A TRUTHINESS ONE. `CAN['toString']` is an inherited
     Function: truthy, and with no `.has`, so `CAN[role] || CAN.crew` handed back
     the function and the next line threw. A role string arrives from stored data
     and could be anything. admin.mjs already learned this one on the flags map. */
  const set = Object.prototype.hasOwnProperty.call(CAN, role) ? CAN[role] : CAN.crew;
  return !!(set instanceof Set ? set : CAN.crew).has(what);
};

/** Every sid on this account that belongs to one sign-in address. */
export async function sidsFor(owner, email) {
  const { data } = await readDoc(SESS(owner), null);
  return ((data && data.list) || []).filter((s) => s.email === email).map((s) => s.sid);
}

export { readArtists };
