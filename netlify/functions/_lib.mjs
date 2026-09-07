import { getStore } from '@netlify/blobs';
import { createHash, timingSafeEqual } from 'node:crypto';

/* ONE STORE PER DEPLOY CONTEXT.

   A Netlify deploy preview shares the PRODUCTION blob store by default. That was
   verified from outside, three ways: curl on a real preview URL returned
   byte-identical live data (the venue, the 65 songs, the now-playing song); the
   Stripe key was identical across contexts; and driving admin.mjs from a preview
   host had addSong / play / newShow all ACCEPTED, after which production showed a
   test song and a wiped vote tally. 44 such deploys already existed — they were
   safe only because they were exercised read-only.

   Every blob access in the app goes through this one function, which is the only
   reason this is a one-line fix rather than an audit of forty call sites.

   Belt and braces, not just this: the Stripe keys are unset for the deploy-preview
   and branch-deploy contexts, so a preview cannot charge a real card either
   (INVARIANT 9 — the app works fully with payments off).

   AND IT CANNOT BE FIXED HERE. Measured on a real draft deploy 2026-09-01: NONE of
   Netlify's deploy-context variables exist at function runtime. A diagnostic on
   /api/show reported CONTEXT, DEPLOY_ID, DEPLOY_PRIME_URL, BRANCH, HEAD, NETLIFY,
   NETLIFY_LOCAL and NETLIFY_DEV all null; only URL (identical on both) and SITE_NAME
   are present. A `getStore(CONTEXT === 'production' ? … )` scheme therefore does
   nothing at all, and the first version of this fix was exactly that — dead code
   that read like protection, which is worse than none.

   WHAT IS ACTUALLY IN PLACE. The money half is closed and verified from outside:
   STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are unset for the deploy-preview and
   branch-deploy contexts, so a preview reports paymentsEnabled:false and cannot
   charge a card (INVARIANT 9). Confirmed by curl on a draft: payments off, while
   production stayed live.

   WHAT IS STILL TRUE. A preview READS AND WRITES PRODUCTION DATA. Use previews to
   look at pages, never to exercise a write path. The real sandbox is `npm test` —
   the real handlers against an in-memory store, no Netlify involved, which cannot
   touch production at all. For a writable staging environment the honest answer is
   a SEPARATE NETLIFY SITE, because a separate site is a separate blob store; doing
   it in code would mean threading Netlify's v2 `context` argument (or the request
   Host) down into every store() caller, which is the kind of half-finished refactor
   this project has been bitten by before. */
export const STORE_NAME = 'myset';
export const store = () => getStore(STORE_NAME);

/* ---------- starter setlist offered to a new artist ---------- */
export const STARTER_SONGS = [
  // A starter pack of well-known covers, offered to a brand-new artist so their
  // first gig isn't a blank page. Nobody's own songs belong in here.
  ['The Joker','Steve Miller Band'],
  ['Jack & Diane','John Mellencamp'],
  ['Faith','George Michael'],
  ['Crazy Little Thing Called Love','Queen'],
  ['Shape Of You','Ed Sheeran'],
  ['Amie','Pure Prairie League'],
  ['Hey Jude','The Beatles'],
  ['Vienna','Billy Joel'],
  ['Best Part','Daniel Caesar'],
  ['Peaceful Easy Feeling','Eagles'],
  ['Brown Eyed Girl','Van Morrison'],
  ['Chicken Fried','Zac Brown Band'],
  ['Wagon Wheel','Darius Rucker'],
  ['Margaritaville','Jimmy Buffett'],
  ['Bar Song (Tipsy)','Shaboozey'],
  ['What I Got','Sublime'],
  ['Santeria','Sublime'],
  ['This Love','Maroon 5'],
  ['Sunday Morning','Maroon 5'],
  ['Better Together','Jack Johnson'],
  ['Banana Pancakes','Jack Johnson'],
  ["I'm Yours",'Jason Mraz'],
  ['Hey Soul Sister','Train'],
  ['Drops Of Jupiter','Train'],
  ['Perfect','Ed Sheeran'],
  ['All Of Me','John Legend'],
  ['Circles','Post Malone'],
  ['Wish You Were Here','Pink Floyd'],
  ['Sitting On The Dock Of The Bay','Otis Redding'],
  ['Feel It Still','Portugal. The Man'],
  ["Ain't No Rest For The Wicked",'Cage The Elephant'],
  ['Come Together','The Beatles'],
  ['Sweet Home Alabama','Lynyrd Skynyrd'],
  ['Tennessee Whiskey','Chris Stapleton'],
  ["Summer Of '69",'Bryan Adams'],
  ['2009','Mac Miller'],
  ['Something Like Olivia','John Mayer'],
  ["Ain't No Sunshine",'Bill Withers'],
  ['Stick Season','Noah Kahan'],
  ['Do You Remember','Jack Johnson'],
  ['Taylor','Jack Johnson'],
  ['Fast Car','Tracy Chapman'],
  ['3 AM','Matchbox Twenty'],
  ['Landslide','Fleetwood Mac'],
  ['Hey There Delilah',"Plain White T's"],
  ['Fire And Rain','James Taylor'],
  ['Hallelujah','Jeff Buckley'],
  ['Have You Ever Seen The Rain','Creedence Clearwater Revival'],
  ['Gravity','John Mayer'],
  ['Why Georgia','John Mayer'],
  ['Slow Dancing In A Burning Room','John Mayer'],
  ['Who Says','John Mayer'],
  ['Stop This Train','John Mayer'],
  ['Edge Of Desire','John Mayer'],
  ["Free Fallin'",'Tom Petty (John Mayer version)'],
  ['I Will Follow You Into The Dark','Death Cab For Cutie'],
  ['Catch & Release','Matt Simons'],
  ['Simple Man','Lynyrd Skynyrd'],
  ['Imagine','John Lennon'],
  ['Until I Found You','Stephen Sanchez'],
  ['Blackbird','The Beatles'],
  ['Follow The Sun','Xavier Rudd'],
];

/* Stamped on every new record. Nothing is multi-artist yet, but a field costs
   nothing now and is the difference between a rename and a rewrite later. */
export const ARTIST_ID = 'perry-idyll';
/** The founding artist. Used when no slug is given and by the legacy studio code. */
export const DEFAULT_ARTIST = 'perry-idyll';

/* Must be generated OUTSIDE a CAS callback — a retry would otherwise produce a
   different id on each attempt.

   The suffix is not decoration. This used to be a UTC stamp to the MINUTE and
   nothing else, so two 'New show' taps inside the same minute produced the SAME
   id — the second show inherited the first's history row and money attribution.
   Two different artists starting a show in the same minute collided too, which is
   half of why moneyForShow now also filters on metadata.artist. Readable prefix,
   unique tail. */
/** UTC year-month, the bucket the free gig cap counts in. Resets on the 1st.
 *  Briefly an ISO week on 2026-09-03; changed straight back. */
export const gigMonthOf = (now = Date.now()) => new Date(now).toISOString().slice(0, 7);

export function newShowId(now = Date.now(), rand = Math.random()) {
  const d = new Date(now), p = (n) => String(n).padStart(2, '0');
  const tail = Math.floor(rand * 1679616).toString(36).padStart(4, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
         `-${p(d.getUTCHours())}${p(d.getUTCMinutes())}-${tail}`;
}

export const slug = (t) =>
  t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/* THE song id. `slug()` keeps only [a-z0-9], so a title with no Latin letters or
   digits — Thai, Japanese, Cyrillic, an emoji — slugged to the EMPTY STRING. The
   song went into the library with id '', which no vote can ever name: the room
   could not see it and the artist could not understand why. In a bar on Koh
   Phangan that is not an edge case. Falls back to a hash of the title so the id
   is still stable and still derived from the song.

   ONE definition, used by every place that mints a song id — addSong, importSongs,
   askAccept, starterSetlist — so they cannot disagree about what a song is called. */
export const songId = (title, artist = '') =>
  slug(String(title)) || 's' + sha(`${title}|${artist}`).slice(0, 8);

/* The identity used to spot a duplicate on import. Same problem as songId: two
   different Thai titles both slugged to '|' and the second was silently dropped
   as a dupe of the first. */
export const songSig = (title, artist = '') =>
  `${slug(String(title)) || String(title).trim().toLowerCase()}|${slug(String(artist || ''))}`;

/* Deliberately blank. A second artist signing up must never inherit the first
   artist's name, venue or setlist — `getShow` fills the name in from the
   registry, and the Studio offers the starter pack as an explicit choice. */
export function defaultShow() {
  return {
    artist: '',
    venue: '',
    city: '',
    showTime: '',
    // 'pre' until the artist actually taps Start the show. Defaulting to 'live'
    // meant every page claimed a gig was happening the moment an account existed.
    status: 'pre',               // pre | live | ended
    windowOpen: true,
    nowPlaying: null,
    played: [],
    freeCredits: 5,
    unlimited: false,        // everyone votes without limit
    unlimitedFans: [],       // specific devices that do — the artist's own, for testing
    replayCost: 5,
    /* Asking for something that isn't on the list. Off by default — an artist
       who can't play requests should never be asked for them. */
    requests:  { on: false, cost: 3 },
    birthdays: { on: false, cost: 3 },
    packs: DEFAULT_PACKS(),
    tags: [],                    // the artist's own genres, on top of the built-ins
    /* Which setlist is in play. '' means the whole library. `listSongs` is a
       PROJECTION of that list's ids, kept here so /api/show never has to read a
       second document on the poll — see the note in _lists.mjs. Only
       applyList() writes it, and normShow re-filters it below. */
    listId: '', listName: '', listSongs: [],
    /* Shows started this calendar month, for the free plan's gig cap. Stored
       rather than counted from history because a show in progress is not in
       history yet, and the cap has to include tonight. */
    gigMonth: '', gigCount: 0,
    songs: [],
    showId: null,
    artistId: ARTIST_ID,
    startedAt: null,
    nowPlayingAt: null,
    log: [],          // one entry per song started — see LOG note below
    updatedAt: Date.now(),
  };
}

/* ---------- genres ----------
   Fifteen that cover almost everything a working act plays, plus room for
   fifteen of their own. `singalong` is in the built-in list on purpose: for this
   product it is more useful than half the real genres. */
export const GENRES = [
  ['originals',  'Originals'],
  ['rock',       'Rock'],
  ['pop',        'Pop'],
  ['acoustic',   'Acoustic'],
  ['country',    'Country'],
  ['folk',       'Folk'],
  ['indie',      'Indie'],
  ['rnb',        'R&B / Soul'],
  ['blues',      'Blues'],
  ['reggae',     'Reggae'],
  ['funk',       'Funk / Disco'],
  ['hiphop',     'Hip-hop'],
  ['jazz',       'Jazz'],
  ['latin',      'Latin'],
  ['singalong',  'Sing-along'],
  /* Tempo, not genre — but the filter row doesn't care, and "something upbeat"
     is how a real room actually asks. */
  ['slow',       'Slow'],
  ['midtempo',   'Mid-tempo'],
  ['upbeat',     'Upbeat'],
];
export const GENRE_IDS = new Set(GENRES.map(([id]) => id));
export const MAX_OWN_TAGS = 15;      // how many they can invent
export const MAX_TAG_LABEL = 20;     // characters, so a chip stays a chip
export const MAX_SONG_TAGS = 6;      // per song, so the row stays readable

/** A custom tag id can never collide with a built-in one: it is prefixed. */
export const tagId = (label) =>
  'c-' + String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 22);

export const cleanTagLabel = (v) =>
  String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, MAX_TAG_LABEL);

const bareId = (label) =>
  String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/* A built-in already called that, however they spell it. Otherwise "Rock" as a
   custom tag sits next to the built-in "Rock" and the filter row has two
   identical chips that mean different things. */
const BUILTIN_LABELS = new Set(GENRES.flatMap(([id, label]) => [id, bareId(label)]));

/** Their own tags, cleaned and de-duplicated. Built-ins are code, not data. */
export function normOwnTags(list) {
  const out = [], seen = new Set();
  for (const t of Array.isArray(list) ? list : []) {
    const label = cleanTagLabel(t && t.label);
    if (!label) continue;
    if (BUILTIN_LABELS.has(bareId(label))) continue;      // already a built-in
    const id = tagId(label);
    if (!id || id === 'c-' || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label });
    if (out.length >= MAX_OWN_TAGS) break;
  }
  return out;
}
/** Label for any tag id, built-in or their own. */
export const tagLabels = (own) => Object.fromEntries(
  [...GENRES, ...(own || []).map((t) => [t.id, t.label])]);

/** The key a song is played in. Chips produce "G" / "Gm"; the field also takes
 *  whatever the artist actually writes on their own charts ("Capo 2", "Drop D"). */
export const cleanKey = (v) =>
  String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 14);

/* What the audience can buy. Editable from the Studio; pay.mjs reads these and
   never trusts a price from the client. */
/* Two tiers, not three. The $3 pack was brutally exposed to Stripe's fixed
   per-transaction fee (~13% gone on a $3 charge); $5 as the floor keeps the fee
   under 6%. normPacks drops a stored legacy 'max' on read. */
export const PACK_KEYS = ['small', 'big'];
export const DEFAULT_PACKS = () => ({
  small: { votes: 5,  cents: 500 },
  big:   { votes: 15, cents: 1000 },
});
/** The two ask-for-something switches. Cost is in VOTES, not money. */
export function normAsk(a, dflt = 3) {
  const v = a || {};
  return {
    on: !!v.on,
    cost: Math.max(1, Math.min(99, parseInt(v.cost, 10) || dflt)),
  };
}

export function normPacks(p) {
  const d = DEFAULT_PACKS(), out = {};
  for (const k of PACK_KEYS) {
    const v = (p && p[k]) || {};
    out[k] = {
      votes: Math.max(1, Math.min(100, parseInt(v.votes, 10) || d[k].votes)),
      cents: Math.max(100, Math.min(50000, parseInt(v.cents, 10) || d[k].cents)),
    };
  }
  return out;
}

/* LOG note — this is load-bearing.
   `consumePlayedVotes()` runs when a song is started and takes that song's votes
   off the board, which DESTROYS the tally it won with. If it is not captured in
   the same handler, it is gone forever and no show history can ever be
   reconstructed. */

/* ============================================================
   STORAGE
     show        -> config (artist writes; rare)
     f0..f{N-1}  -> sharded fan records {fanId:{v:[],extra:n}}
     meta        -> tips[] + paid{} (writes only on payment)

   Reads use strong consistency (never list(), which lags minutes).
   Writes use compare-and-swap. Fan records are SHARDED so a burst
   of voters spreads across many documents instead of contending
   on one, which is what makes concurrent voting lossless.
   ============================================================ */
/* Every record that belongs to an artist is namespaced by their id. Nothing
   about a show, a setlist, a fan's votes or a payment is global any more —
   that is what makes a second artist possible without a rewrite. */
export const KEY = {
  show:    (a) => `show_${a}`,
  fan:     (a, n) => `f${n}_${a}`,
  meta:    (a) => `meta_${a}`,
  profile: (a) => `profile_${a}`,
  histIdx: (a) => `histidx_${a}`,
  hist:    (a, showId) => `hist_${a}_${showId}`,
  lyrics:  (a, songId) => `lyr_${a}_${songId}`,
  reqs:    (a) => `req_${a}`,
  /* The artist's own chart — words, chords, capo notes, whatever they paste.
     Its own document because a full chart is kilobytes and `show` is on the hot
     read path that every phone in the room polls. */
  chart:   (a, songId) => `chart_${a}_${songId}`,
};
/** Artist ids are used inside blob keys, so they must stay boring. */
export const cleanArtistId = (v) =>
  String(v || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);

export const SHARDS = 12;
const shardKey = (a, n) => KEY.fan(a, n);
export function shardOf(fanId) {
  let h = 5381;
  for (let i = 0; i < fanId.length; i++) h = ((h * 33) ^ fanId.charCodeAt(i)) >>> 0;
  return h % SHARDS;
}

export async function readDoc(key, fallback) {
  try {
    const r = await store().getWithMetadata(key, { type: 'json', consistency: 'strong' });
    if (r && r.data) return { data: r.data, etag: r.etag || null };
  } catch {}
  return { data: fallback, etag: null };
}

/** CAS write loop on a single document.
 *  fn(data) mutates; return false to abort.
 *  `verify(data)` (optional) is re-read AFTER the write — if it fails we retry,
 *  which protects against a conditional write that reports success but does not
 *  stick under heavy concurrency. */
export async function casDoc(key, fallback, fn, verify = null, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const { data, etag } = await readDoc(key, fallback());
    const out = fn(data);
    if (out === false) return { aborted: true, data };
    let w;
    try {
      w = await store().set(key, JSON.stringify(data), etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
    } catch { w = { modified: false }; }

    if (!w || w.modified !== false) {
      if (!verify) return { ok: true, data, result: out };
      const check = await readDoc(key, fallback());
      if (verify(check.data)) return { ok: true, data: check.data, result: out };
    }
    await new Promise((r) => setTimeout(r, Math.min(200, 15 + i * 10) + Math.random() * 70));
  }
  throw new Error('busy');
}

/* ---------- show config ---------- */
function normShow(s) {
  const d = defaultShow();
  const show = { ...d, ...(s || {}) };
  if (!Array.isArray(show.songs)) show.songs = [];
  if (!Array.isArray(show.played)) show.played = [];
  if (typeof show.freeCredits !== 'number') show.freeCredits = 5;
  if (typeof show.replayCost !== 'number') show.replayCost = 5;
  if (!Array.isArray(show.log)) show.log = [];
  show.unlimited = !!show.unlimited;
  show.unlimitedFans = (Array.isArray(show.unlimitedFans) ? show.unlimitedFans : []).slice(0, 20);
  show.packs = normPacks(show.packs);
  show.tags = normOwnTags(show.tags);
  show.listId = String(show.listId || '').replace(/[^a-z0-9]/gi, '').slice(0, 12);
  show.listName = String(show.listName || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  show.listSongs = Array.isArray(show.listSongs) ? show.listSongs : [];
  /* The cap was weekly for a few hours on 2026-09-03. A record stamped with a
     `gigWeek` cannot be honestly translated into a month — there is no way to know
     which month those shows fell in from a week label that can straddle two — so it
     is dropped and the artist starts the month clean. Erring generous is the right
     side for somebody who did nothing wrong. */
  if (show.gigWeek !== undefined) { delete show.gigWeek; show.gigMonth = ''; show.gigCount = 0; }
  show.gigMonth = String(show.gigMonth || '').slice(0, 7);
  show.gigCount = Math.max(0, parseInt(show.gigCount, 10) || 0);
  /* Songs carry a key and genre tags. Tags are filtered against what actually
     exists, so deleting a custom tag cleans itself up on the next read. */
  const ids = new Set(show.songs.map((x) => x && x.id));
  show.listSongs = [...new Set(show.listSongs.filter((x) => ids.has(x)))];
  if (!show.listId) { show.listName = ''; show.listSongs = []; }
  const known = new Set([...GENRE_IDS, ...show.tags.map((t) => t.id)]);
  show.songs = show.songs.map((sg) => ({
    ...sg,
    key: cleanKey(sg.key),
    tags: [...new Set((Array.isArray(sg.tags) ? sg.tags : []).filter((t) => known.has(t)))]
      .slice(0, MAX_SONG_TAGS),
  }));
  show.requests = normAsk(show.requests);
  show.birthdays = normAsk(show.birthdays);
  show.artistId ||= ARTIST_ID;
  // derived from stored data, so a CAS retry produces the identical value
  if (!show.showId) show.showId = 'show-' + (show.updatedAt || 0);
  if (!show.startedAt) show.startedAt = show.updatedAt || Date.now();
  return show;
}
export async function getShow(aid) {
  const { data } = await readDoc(KEY.show(aid), null);
  const show = normShow(data);
  show.artistId = aid;
  if (!show.artist) {                      // the name lives in the registry
    const { artistById } = await import('./_auth.mjs');
    const a = await artistById(aid);
    show.artist = (a && a.name) || '';
  }
  return show;
}
/* INVARIANT 4 says a conditional write can report success without sticking under
   concurrency, which is why every FAN write goes through a read-back verify. The
   SHOW write never did — so an acked-but-lost write meant the artist's tap silently
   did nothing while the Studio was handed a payload saying it had worked. `updatedAt`
   is already stamped on every successful mutation, so it doubles as the receipt. */
export const mutateShow = (aid, fn) => {
  let stamp = null;
  return casDoc(KEY.show(aid), defaultShow, (s) => {
    const show = normShow(s);
    show.artistId = aid;
    Object.keys(s || {}).forEach((k) => delete s[k]);
    Object.assign(s, show);
    const r = fn(s);
    if (r !== false) { s.updatedAt = Date.now(); stamp = s.updatedAt; }
    return r;
  },
  // stamp stays null when fn aborted, and casDoc never writes in that case
  (d) => stamp === null || !!(d && d.updatedAt === stamp));
};

/* ---------- fan shards ---------- */
export const mutateFan = (aid, fanId, fn, verifyFan = null) =>
  casDoc(
    shardKey(aid, shardOf(fanId)),
    () => ({}),
    (bag) => {
      const me = (bag[fanId] ||= { v: [], extra: 0, ts: {} });
      me.v ||= []; me.extra ||= 0; me.ts ||= {}; me.spent ||= 0;
      return fn(me, bag);
    },
    verifyFan ? (bag) => verifyFan((bag && bag[fanId]) || { v: [], extra: 0 }) : null
  );

/** All fan records, merged from every shard (parallel strong reads). */
export async function readFans(aid) {
  const parts = await Promise.all(
    Array.from({ length: SHARDS }, (_, n) => readDoc(shardKey(aid, n), {}))
  );
  const fans = {};
  for (const p of parts) Object.assign(fans, p.data || {});
  return fans;
}
/* ---------- the paid-vote ledger ----------

   A VOTE IS SPENT THE MOMENT IT IS CAST, AND IT NEVER COMES BACK. Perry, 2026-09-07:
   "the votes do NOT go back to the audience members whose song(s) were not chosen —
   they stay attached to the song you voted for, and that song stays in the queue
   until it is played or the show is over. If they paid for votes and their song
   doesn't get played, they lose the money and the votes. That's the whole game. But
   they don't really lose, because they're tipping the artist, and that's the point."

   Everything below used to work the other way, and the mechanism was one line:
   `clearAllFanVotes` wiped every fan's votes each time a song started, so the board
   reset to zero every round and free credits appeared to refresh. That is gone. A
   night is now ONE round.

   WHICH MEANS SPEND CANNOT BE DERIVED FROM `v` ANY MORE. It used to be: `v` held
   every vote a fan still had, so counting it gave what they had spent. Now a song
   that gets PLAYED takes its votes out of `v` — and if spend were still derived, the
   fan's credits would silently come back at the exact moment the rule says they must
   not. So spend is stored, and it only ever goes up:

     used      every credit this fan has spent tonight
     freeUsed  how much of that came out of the free allowance
     paid      = used - freeUsed, derived, and never re-priced by a later change

   `freeUsed` is stamped as it is spent rather than worked out afterwards, because
   the artist can change `show.freeCredits` mid-show: computing the free portion
   against the number that happens to be there at the end would re-price votes that
   were already cast, and debit a fan's pack for credits they took from the free
   allowance. That was a real bug on the old round-reset path.

   FREE CREDITS ARE STILL SPENT FIRST — that part is unchanged.

   This exists because for a long time it did not. `extra` was read as part of
   `total = freeCredits + extra` in four places and decremented in exactly ONE
   place in the whole codebase (gift.mjs), so a purchased pack never ran out:
   measured, an 18-vote pack yielded 252 credits across 13 rounds and survived
   `newShow` untouched, which made it a permanent boost at every future gig.
   The same missing ledger also destroyed packs in the other direction — a fan
   fully spent at the reset instant had `unspentPaid` return 0 and `carryFans`
   delete their record. Both directions are this one function's fault. */
/* `fanId` is not optional in spirit: without it an UNLIMITED round debits the
   buyer's pack for votes the server handed out free. vote.mjs skips the credit
   check when isUnlimited, so creditsUsed keeps counting the casts while nothing
   was ever owed — measured, a 12-credit pack vanished in one round. Both callers
   have the fan id in hand (it is the shard bag's key), so both pass it. */
export const paidUsed = (fan, show, fanId) => {
  if (isUnlimited(fanId, show)) return 0;
  const used = creditsUsed(fan, show);
  /* The stamped free portion when there is one; otherwise the old derivation, for
     a record written before this existed. */
  return Math.max(0, used - (typeof fan.freeUsed === 'number'
    ? fan.freeUsed : Math.min(show.freeCredits || 0, used)));
};

/* THE SONG THAT JUST STARTED HAS COLLECTED ITS VOTES, so they come off the board.
   They are not refunded and they are not returned: `used` does not move, which is
   the whole rule. The votes for every OTHER song stay exactly where their fans put
   them, and stay in the running until they are played or the night ends.

   This replaced `clearAllFanVotes`, which wiped every fan's votes on every song at
   the start of each song and settled the paid ledger there. That function needed
   the pre-play show to price the round with, threw without it, and was the reason
   free credits appeared to refresh — none of which has anything to answer any more,
   because a night is one round. See the ledger header above. */
export const consumePlayedVotes = (aid, songId) => dropSongVotes(aid, songId);

/* "Clear the votes" in the Studio — the board goes back to zero for every song at
   once. NOBODY IS REFUNDED: a vote is spent when it is cast, and the artist
   reaching for this button does not change that. It is the only remaining way to
   empty the board by hand, and the Studio says what it does. */
export async function wipeBoard(aid) {
  await Promise.all(
    Array.from({ length: SHARDS }, (_, n) =>
      casDoc(shardKey(aid, n), () => ({}), (bag) => {
        let touched = false;
        for (const id of Object.keys(bag)) {
          if (!(bag[id].v || []).length) continue;
          bag[id].v = []; bag[id].ts = {};
          touched = true;
        }
        return touched;
      }, null).catch(() => {})
    )
  );
}

/* Votes someone PAID for shouldn't evaporate because the artist tapped
   "New show". Unspent paid votes carry into the next show unless the fan chose
   to gift them. Everything else — free credits, picks, timestamps — resets.

   Now that `extra` is a real balance, the only thing still owing at the end of a
   show is whatever this last, unsettled round used. In-flight votes are charged
   against FREE credits first, exactly as they are every other round, so holding a
   vote when the artist ends the show costs the fan nothing — it used to cost them
   the paid portion, which was the one and only way voting could lose you money. */
export function unspentPaid(fan, show, fanId) {
  const extra = fan.extra || 0;
  if (extra <= 0) return 0;
  return Math.max(0, extra - paidUsed(fan, show, fanId));
}
export async function carryFans(aid, show) {
  await Promise.all(
    Array.from({ length: SHARDS }, (_, n) =>
      casDoc(shardKey(aid, n), () => ({}), (bag) => {
        for (const id of Object.keys(bag)) {
          /* A fan who chose "let the artist keep it" pledged, rather than being
             debited on the spot — see gift.mjs. THIS is the real end of the show, so
             this is where the pledge is honoured. A restart in between quietly
             cancels it, which is the point. */
          const pledged = Math.max(0, bag[id].pledged || 0);
          const carry = Math.max(0, unspentPaid(bag[id], show, id) - pledged);
          const gifted = (bag[id].gifted || 0) + (pledged ? Math.min(pledged, unspentPaid(bag[id], show, id)) : 0);
          // `gr` rides along: it is what makes a paid grant idempotent (_pay.mjs)
          if (carry > 0) bag[id] = { v: [], ts: {}, extra: carry, gifted, gr: (bag[id].gr || []).slice(-20) };
          else delete bag[id];          // nothing owed — don't keep the record
        }
        return true;
      }, null).catch(() => {})
    )
  );
}

/* Deleting a song from the library used to strand every credit held on it:
   `creditsUsed` counted each id in `fan.v` whether or not the song still existed,
   and vote.mjs answered 404 before it reached the un-vote toggle — so the fan could
   not get the credit back. Now that spend is STORED rather than counted out of `v`,
   removing a song cannot strand anything: it takes the votes off the board and the
   fan's ledger does not move, which is the same answer the rule gives everywhere
   else. A vote is spent when it is cast.

   `releaseUnvotable` used to live here and did the opposite — it handed a fan back
   every credit held on a song the room could no longer choose. Deleted 2026-09-07
   with the rest of the give-it-back machinery. */

export async function dropSongVotes(aid, songId) {
  if (!songId) return;
  await Promise.all(
    Array.from({ length: SHARDS }, (_, n) =>
      casDoc(shardKey(aid, n), () => ({}), (bag) => {
        let touched = false;
        for (const id of Object.keys(bag)) {
          const v = bag[id].v || [];
          /* EVERY occurrence, not the first. This was indexOf + splice, written when
             one fan could hold at most one vote per song. Now that a fan casts
             several at once (INVARIANT 15i), removing one entry left the rest
             pointing at a song that no longer exists: the tally was right but the
             fan stayed charged for votes on nothing, with no way to get them back
             once finality is on. */
          const kept = v.filter((x) => x !== songId);
          if (kept.length === v.length) continue;
          bag[id].v = kept;
          if (bag[id].ts) delete bag[id].ts[songId];
          touched = true;
        }
        return touched;                  // no write when this shard held none
      }, null).catch(() => {})
    )
  );
}

export async function wipeFans(aid) {
  await Promise.all(
    Array.from({ length: SHARDS }, (_, n) =>
      store().set(shardKey(aid, n), '{}').catch(() => {})
    )
  );
}

/* ---------- meta (tips / payment markers) ---------- */
export const emptyMeta = () => ({ tips: [], paid: {}, gifts: [], orders: [], fees: {} });
export async function readMeta(aid) {
  const { data } = await readDoc(KEY.meta(aid), null);
  const m = data || emptyMeta();
  m.tips ||= []; m.paid ||= {}; m.gifts ||= []; m.orders ||= []; m.fees ||= {};
  return m;
}
export const mutateMeta = (aid, fn) =>
  casDoc(KEY.meta(aid), emptyMeta, (m) => { m.tips ||= []; m.paid ||= {}; m.gifts ||= []; m.orders ||= []; m.fees ||= {}; return fn(m); });

/* ---------- derived ---------- */
/* ---------- which songs are in play tonight ----------
   A setlist narrows the library; `active !== false` hides a song for good. Both
   apply, and the setlist is the narrower of the two.

   FALLBACK, and it is deliberate: if the chosen setlist resolves to nothing the
   room can vote for, the whole library is used instead. An empty voting page is a
   broken gig (INVARIANT 16), and a silent empty list is exactly the kind of thing
   that gets noticed on stage at 10pm. The Studio is told, so it can say so. */
export function playable(show) {
  const live = (show.songs || []).filter((s) => s.active !== false);
  if (!show.listId) return { songs: live, fellBack: false };
  /* A setlist that is SELECTED but resolves to nothing — emptied, or every song in
     it hidden — still counts as a fallback. Reporting it as "no list" hid the
     problem from the Studio, which is the one place it needs to be visible. */
  const inList = new Set(show.listSongs || []);
  const narrowed = live.filter((s) => inList.has(s.id));
  return narrowed.length ? { songs: narrowed, fellBack: false }
                         : { songs: live, fellBack: true };
}
/** Just the predicate, for callers that already have their own list. */
export function inPlay(show) {
  const { songs } = playable(show);
  const ok = new Set(songs.map((s) => s.id));
  return (id) => ok.has(id);
}

/* ---------- what the ROOM can vote for ----------
   In play tonight, OR already played — a "play it again" is always fair, and a
   song the room heard at 9pm stays in the payload for exactly that reason.

   This is the ONE definition. `vote.mjs` enforces it, `playTop` picks out of it,
   and the Studio renders a `votable` flag straight off it, so the button on stage
   can never name a song the room could not have chosen. Callers may NARROW it
   further — playTop also requires a played song to be holding replay votes — but
   none of them may widen it. */
export function votable(show) {
  const ok = inPlay(show);
  const heard = new Set(show.played || []);
  return (s) => s.active !== false && (ok(s.id) || heard.has(s.id));
}

/** Does this device vote without limit? Either the whole room is unlimited, or
 *  this specific device was granted it from the Studio (the artist's own phone,
 *  so he can test without eating the audience's credits). */
export const isUnlimited = (fanId, show) =>
  !!show.unlimited || (show.unlimitedFans || []).includes(fanId);

/** A vote on an already-played song costs more (a "play it again" request). */
export const costOf = (songId, show) =>
  show.played.includes(songId) ? (show.replayCost || 5) : 1;
/** What `used` would have been under the old derive-from-`v` rule. Only ever
 *  reached by a fan record written before 2026-09-07 — a phone that was already
 *  holding votes when this deployed. Their spend is read out of `v` once, and from
 *  their next cast it is stored like everyone else's. */
const derivedSpend = (fan, show) =>
  (fan.v || []).reduce((sum, id) => sum + costOf(id, show), 0);

/** Credits a fan has spent tonight. Stored, monotonic, and NOT recoverable by a
 *  song being played or removed. `spent` is everything that isn't a vote on a
 *  listed song — a song request, a birthday shout — because those have no song id. */
export const creditsUsed = (fan, show) =>
  (typeof fan.used === 'number' ? fan.used : derivedSpend(fan, show)) + (fan.spent || 0);

/** Charge a fan for `need` credits, free allowance first. The one place `used` and
 *  `freeUsed` move, so the two can never drift apart. */
export function chargeFan(fan, show, need) {
  if (typeof fan.used !== 'number') fan.used = derivedSpend(fan, show);
  if (typeof fan.freeUsed !== 'number') fan.freeUsed = Math.min(show.freeCredits || 0, fan.used + (fan.spent || 0));
  const freeLeft = Math.max(0, (show.freeCredits || 0) - fan.freeUsed);
  fan.freeUsed += Math.min(need, freeLeft);
  fan.used += need;
}

/* ---------- who was in the room ----------
   The honest count of people at a gig is not "devices that voted" — plenty of
   people join, watch the queue move and never tap. So a device stamps itself
   once per show when it opens the voting page.

   HEADLINE = distinct PHONES, not distinct networks. Counting networks was the
   first attempt and it is wrong in exactly the room this app is for: forty
   people at a beach bar on the venue's wifi come out as 1. A phone is much
   closer to a person than a network is — the worst it does is count someone
   twice if they clear their storage mid-gig.

   The network hash is kept alongside it, because it is the only defence against
   one phone rotating its id to inflate the number, and because "40 phones on 3
   networks" is a useful thing for an artist to be able to see.

   The address itself is never stored. It is hashed with the artist id mixed in,
   so the stored value is useless anywhere else and a table built for one
   artist's gigs tells you nothing about another's. */
export const clientIp = (req) =>
  req.headers.get('x-nf-client-connection-ip') ||
  (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
  req.headers.get('client-ip') || '';

export const roomHash = (aid, ip) =>
  ip ? sha(`myset-room|${aid}|${ip}`).slice(0, 16) : '';

export function roomCounts(fans) {
  const nets = new Set();
  let phones = 0;
  for (const f of Object.values(fans || {})) {
    if (!f) continue;
    // present = it stamped itself on the voting page, or it clearly took part
    // (records from before presence existed still count as the person they were)
    const here = !!f.seenShow || (f.v || []).length > 0 || f.extra > 0 || f.spent > 0;
    if (!here) continue;
    phones++;
    if (f.ipH) nets.add(f.ipH);
  }
  return { phones, nets: nets.size };
}
export const uniqueRoom = (fans) => roomCounts(fans).phones;

/** One write per device per show. Called only from the voting page, only while a
 *  show is live, and skipped entirely once the stamp is already there. */
export async function markPresence(aid, fanId, show, req) {
  if (!fanId || !show || show.status !== 'live') return;
  const ipH = roomHash(aid, clientIp(req));
  try {
    await mutateFan(aid, fanId, (me) => {
      if (me.seenShow === show.showId && me.ipH === ipH) return false;   // already counted
      me.ipH = ipH; me.seenShow = show.showId;
      return true;
    });
  } catch { /* a missed head-count must never break the voting page */ }
}

/** Earliest moment each song received a vote — used to break ties fairly. */
export function firstVotedAt(fans) {
  const first = {};
  for (const id of Object.keys(fans)) {
    const ts = fans[id].ts || {};
    for (const s of fans[id].v || []) {
      const t = Number(ts[s]) || Number.MAX_SAFE_INTEGER;   // unstamped (legacy) sorts last
      if (first[s] === undefined || t < first[s]) first[s] = t;
    }
  }
  return first;
}

/** THE ordering rule for "what plays next". Used by show, stage and playTop so
 *  the audience can never be shown a winner the Studio won't start. */
export function rankSongs(list, counts, first) {
  const F = (id) => first[id] || Number.MAX_SAFE_INTEGER;
  return [...list].sort((a, b) =>
    (counts[b.id] || 0) - (counts[a.id] || 0) ||
    F(a.id) - F(b.id) ||
    a.title.localeCompare(b.title));
}

/** How many phones are in the room for THIS show.

    Presence is stamped by markPresence as `seenShow`, so this is a count of the
    stamps that match tonight — a fan carried over from last night does not count.
    It costs nothing extra: every caller already holds the merged bag.

    Deliberately NOT a stored counter. A counter means a compare-and-swap write on
    one document per arrival, and arrivals are exactly the moment a room is busiest
    — 10,000 people through one CAS door is the queue that breaks. Counting a bag
    that has already been read is free. */
export function countInRoom(fans, show) {
  if (!show || !show.showId) return 0;
  let n = 0;
  for (const id of Object.keys(fans)) if (fans[id].seenShow === show.showId) n++;
  return n;
}

/* THE TWO DIALS A BIG ROOM TURNS BY ITSELF.

   Both are pure functions of the head count, so every phone in a room gets the
   same answer, no state is stored, and nothing has to be decided by a human at
   11pm. They are what makes the audience caps SOFT: a room over its plan's number
   is not refused, it is slowed and shortened, and the artist hears about it after
   the encore rather than during it.

   The rungs are set from measured cost. Every poll re-reads the whole audience bag,
   so internal read traffic is (people / interval) x (bag size) — it grows with the
   SQUARE of the room. Holding that roughly flat as the room grows is the entire job:

     people   bag    interval   busy room    on the old fixed 3s ladder
        200   30 KB     3s         1.3 MB/s        2 MB/s
      1,000  152 KB     5s        12.3 MB/s       51 MB/s
      2,000  305 KB    10s        30.3 MB/s      203 MB/s
     10,000  1.5 MB    20s       463.1 MB/s    5,077 MB/s

   The right-hand column is the reason the dial exists. The left-hand one is measured
   with the ladder AS IT NOW BEHAVES — since a vote by a stranger stopped resetting
   every phone in a big room (see stageSig in public/vote.html), the upper rungs are
   reachable for the first time and the whole curve dropped by roughly an order of
   magnitude. tools/loadsim.py walks the same ladder and prices the same night at
   $4.29 for 10,000 people, down from $36.40.

   That is why the tiers stop at 2,000 and not lower: 30 MB/s in a busy room is
   comfortably inside what MySet is known to serve. It is also why they do not stop
   HIGHER — 463 MB/s at 10,000 is still far past it. The dial and the ladder together
   bought an order of magnitude; the shape is still quadratic, and only the shared
   board fixes the shape.

   THIS IS A HOLDING MEASURE, NOT THE FIX. The real fix is to stop re-reading the
   whole audience for every poll — one shared snapshot rendered per change and
   served from cache, which turns read cost from O(people) into O(votes). Until
   that lands, these rungs are what keeps a big night standing up. */
export function pollFloorFor(heads) {
  const n = Number(heads) || 0;
  if (n <= 200) return 3000;        // unchanged: what every gig has always felt like
  if (n <= 1000) return 5000;
  if (n <= 3000) return 10000;
  return 20000;
}

/** How many songs the board carries. null means all of them.

    YouTube's chat defaults to "Top chat" for the same reason: past a certain size
    the full list is neither affordable nor useful. The page LABELS it — a fan who
    cannot find their song must never be left wondering whether the vote counted,
    which in a voting app is a trust failure rather than a cosmetic one. */
export function boardLimitFor(heads) {
  const n = Number(heads) || 0;
  if (n <= 200) return null;
  if (n <= 1000) return 40;
  if (n <= 3000) return 25;
  return 15;
}

export function voteCounts(fans) {
  const counts = {};
  for (const id of Object.keys(fans))
    for (const s of fans[id].v || []) counts[s] = (counts[s] || 0) + 1;
  return counts;
}

/* ---------- http ---------- */
export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
export const bad = (msg, status = 400) => json({ ok: false, error: msg }, status);

export const sha = (v) => createHash('sha256').update(String(v)).digest('hex');
const sameHash = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try { return timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
};

/* Two ways in, both fail closed (INVARIANT 15c):
     ADMIN_CODE env  — the recovery key, only Perry and Netlify know it
     show.codeHash   — a code he set himself from the Studio, stored hashed
   The second exists because on 2026-08-30 he could not get into his own Studio
   during a gig: the only code lived in an env var he had no copy of. */
/** Who is making this request, and which artist do they own?
 *  Returns { aid, email, role } or null. Every admin endpoint uses this — an
 *  artist can only ever reach their own records because the id comes from the
 *  session, never from the request body. */
/* ---------- the studio-code door ----------

   A passcode is HALF a credential. The other half is the artist's page name, and
   the pair behaves exactly like a username and a password.

   This used to check only `getShow(DEFAULT_ARTIST).codeHash`, so `setCode` wrote a
   hash into the CALLING artist's own show record and nothing ever read it again:
   every artist except the founder got a cheerful "that's your code from now on"
   for a code that could never let them in, and when a session token expired
   mid-gig their only door was email. That is INVARIANT 15d — the artist must be
   able to get into his own Studio without a terminal — reintroduced for everyone
   but Perry.

   WHY NOT A GLOBAL sha(code) -> artistId INDEX, which is the obvious fix: two
   artists who pick the same passcode collide, and refusing the second ("that code
   is taken") is an ORACLE that confirms a working passcode exists. It would also
   put a hot global blob on every Studio login, which is the scaling mistake this
   audit found three other instances of.

   The slug is public, so it grants nothing on its own — the SECRET still decides.
   It only says which lock to try. This is the one place an artist id is taken from
   the request rather than the session (INVARIANT 0b), and it is safe for exactly
   that reason; the id is then used only after the secret has matched. */
const LOCK_TRIES = 10;              // failures allowed
const LOCK_WINDOW = 15 * 60e3;      // ...within this long
const LOCK_FOR = 15 * 60e3;         // ...then refuse for this long

/** True when this artist's code door is currently shut. */
export async function codeLocked(aid) {
  const { data } = await readDoc(`lock_${aid}`, null);
  return !!(data && data.until && data.until > Date.now());
}
export async function noteCodeFailure(aid) {
  await casDoc(`lock_${aid}`, () => ({}), (d) => {
    const now = Date.now();
    d.fails = (d.fails || []).filter((t) => now - t < LOCK_WINDOW);
    d.fails.push(now);
    if (d.fails.length >= LOCK_TRIES) { d.until = now + LOCK_FOR; d.fails = []; }
    return true;
  }).catch(() => {});
}
export const clearCodeFailures = (aid) =>
  casDoc(`lock_${aid}`, () => ({}), (d) => { d.fails = []; d.until = 0; return true; })
    .catch(() => {});

/** The shortest a self-set studio code may be. Four characters with no lockout is
 *  a ten-thousand-guess space, and the audit found no lockout anywhere. */
export const MIN_CODE = 8;
/** Codes nobody may set, however much they want to. */
export const weakCode = (code, slug) => {
  const c = String(code || '').toLowerCase();
  return c.length < MIN_CODE
    || /^(.)\1+$/.test(c)
    || ['password', '12345678', '123456789', 'qwertyui', 'letmein1', 'myset123']
         .includes(c)
    || (slug && c === String(slug).toLowerCase());
};

export async function requireArtist(req) {
  const auth = req.headers.get('authorization') || '';
  if (auth.startsWith('Bearer ')) {
    const { verifyToken } = await import('./_auth.mjs');
    const me = await verifyToken(auth.slice(7));
    // `sid` says WHICH device, so "sign out" can mean this one and not all of them
    if (me) return { aid: me.artistId, email: me.email, role: me.role || 'owner', sid: me.sid || null };
  }

  const url = new URL(req.url);
  const given = req.headers.get('x-admin-code') || url.searchParams.get('code') || '';
  if (!given) return null;

  /* The recovery key. Only Perry and Netlify know it, it is not any artist's own
     code, and it is checked first so a lockout can never shut the founder out of
     his own platform. */
  const master = process.env.ADMIN_CODE;
  if (master && sameHash(sha(given), sha(master)))
    return { aid: DEFAULT_ARTIST, email: null, role: 'owner', by: 'recovery-key' };

  /* Which lock are we trying? A named page, or the founding artist when no name is
     given — which is what every existing link and bookmark does. */
  const wanted = req.headers.get('x-admin-artist') || url.searchParams.get('a') || '';
  let aid = DEFAULT_ARTIST;
  if (wanted) {
    const { artistBySlug } = await import('./_auth.mjs');
    aid = await artistBySlug(wanted);
    /* An unknown page name must look exactly like a wrong code, or this becomes a
       way to enumerate which artists exist (INVARIANT 9h, applied to this door). */
    if (!aid) return null;
  }

  if (await codeLocked(aid)) return null;      // same silence as a wrong code
  const show = await getShow(aid);
  if (show.codeHash && sameHash(sha(given), show.codeHash)) {
    await clearCodeFailures(aid);
    return { aid, email: null, role: 'owner', by: 'studio-code' };
  }
  await noteCodeFailure(aid);
  return null;
}

/** Which artist is a PUBLIC request about? From ?a=<slug>. */
/* ONE LINE TURNS A PAGE OFF. An account asked for deletion goes dark on the day
   it is asked, and is only actually erased thirty days later — so this has to
   answer "no such artist" the whole time. Every public endpoint already does
   `if (!aid) return bad('unknown artist', 404)`, so refusing here 404s the show,
   the profile, voting, paying, the community page, requests, lyrics and the rest
   at once. The Studio does NOT go through here, because the owner still has to be
   able to change their mind. */
export async function publicArtist(req) {
  const slug = new URL(req.url).searchParams.get('a') || '';
  /* The founding page cannot be deleted, so the bare address needs no lookup at
     all — and must not grow one: this runs on every phone in the room, and
     test/cost.mjs holds an audience poll to ONE global document. The slug path
     resolves and checks the deletion mark from the SAME single read that
     artistBySlug would have done on its own. */
  if (!slug) return DEFAULT_ARTIST;
  const { readArtists, cleanSlug } = await import('./_auth.mjs');
  const reg = await readArtists();
  const want = cleanSlug(slug);
  const aid = reg.bySlug[want] || ((reg.oldSlug || {})[want] || {}).aid || null;
  if (!aid) return null;
  if ((reg.byId[aid] || {}).del) return null;
  return aid;
}
/** Is this account on its way out? The Studio needs to know; the public does not. */
export async function deletionOf(aid) {
  const { readArtists } = await import('./_auth.mjs');
  const row = (await readArtists()).byId[aid] || {};
  return row.del || null;
}
export const cleanFanId = (v) =>
  typeof v === 'string' ? v.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) : '';
