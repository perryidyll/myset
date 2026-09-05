import { casDoc, readDoc } from './_lib.mjs';

/* FEATURE FLAGS.

   The reason this exists: some changes are not a bug fix but a different opinion
   about how the product should behave, and the only honest way to choose between
   two opinions is to run both. Without a switch, trying the other one means an
   edit, a deploy, a gig, and an undo — and a production deploy is the expensive
   thing on this account (INVARIANT 9d0), so "just try it" costs real money and a
   real risk of being mid-undo when a show starts.

   Rules that keep flags from becoming their own mess:

   * A flag is a QUESTION WITH TWO REAL ANSWERS, both of which work. It is never a
     way to ship something half-finished — a flag that is off because the code
     behind it is broken is a lie with a switch on it.
   * Every flag is listed in FLAGS below with what it does and what "off" means.
     A flag not in that list does not exist, so a typo reads as false rather than
     silently enabling something.
   * Flags are read on the hot audience poll, so this is ONE small global document
     and it is never written during a show.
   * Every flag needs a REMOVAL PLAN, written in its own description. A flag that
     outlives the decision it was for is dead code with extra steps.

   Precedence: this artist's own setting, else the global setting, else the default. */

export const FLAGS = {
  voteFinal: {
    /* ON as of 2026-09-02, at Perry's decision. Shipped as the DEFAULT rather than
       written into the flags document, because the document lives in Blobs and the
       default lives in code — so what production does is reviewable in the diff
       instead of depending on somebody having run a one-off write. Turning it off
       again is `flagSet {flag:'voteFinal', on:false}`, globally or per artist. */
    default: true,
    what: 'Votes cannot be taken back once cast. OFF = a second tap removes them and refunds (the pre-2026-09-02 behaviour).',
    remove: 'If a gig proves the refund was better, flip the default back and delete the losing path. A flag that outlives its decision is dead code with extra steps.',
  },
  featuredShows: {
    /* Perry, 2026-09-05: "maybe you can build this as a feature flag that can
       easily be flipped on and off? it's just an idea i'd like to test out."
       ON as the default so it can actually be tested, and OFF is a real answer,
       not a half-built one: with it off the Promote button is not offered, the
       endpoint refuses (so nobody can be charged), and any spot ALREADY PAID FOR
       keeps its record and reappears the moment it is switched back on. Nobody
       loses money by the switch moving. */
    default: true,
    what: 'Artists can pay $10 to put a gig in a city\'s three Featured shows spots for that night. OFF = no Promote button, the endpoint refuses, and the Featured section is not rendered.',
    remove: 'After a month of it being live: if artists buy spots and cities look better for it, delete the flag and keep the feature. If nobody buys, delete the flag AND the feature — a paid feature nobody pays for is a menu item that makes the menu worse.',
  },
};

const KEY = 'flags';
const empty = () => ({ v: 1, global: {}, byArtist: {} });

/* CACHED IN MODULE SCOPE, and this is the difference between a feature and a tax.

   `/api/show` is polled by every phone in the room, and adding this document to it
   took the poll from 15 strong blob reads to 16 — the exact anti-pattern the audit
   found three times over (the `artists` registry on the same path). Netlify keeps a
   function instance warm between invocations, so a short TTL removes the read from
   almost every poll.

   Safe because of a rule this module already states: flags are NEVER written during
   a show. The cost of the cache is that flipping one takes up to TTL seconds to
   reach every warm instance, which is the right trade for a switch that gets used
   between gigs rather than during them. A write clears it locally at once. */
const TTL = 60e3;
let cached = null, cachedAt = 0;
export const __flushFlags = () => { cached = null; cachedAt = 0; };

export async function readFlags() {
  if (cached && Date.now() - cachedAt < TTL) return cached;
  const { data } = await readDoc(KEY, null);
  const f = { ...empty(), ...(data || {}) };
  f.global ||= {}; f.byArtist ||= {};
  cached = f; cachedAt = Date.now();
  return f;
}
export const mutateFlags = (fn) =>
  casDoc(KEY, empty, (f) => { f.global ||= {}; f.byArtist ||= {}; return fn(f); })
    .finally(__flushFlags);        // this instance sees its own write immediately

/** The value in force for one artist. Unknown names are always false. */
/* `FLAGS[name]` finds `toString`, `constructor` and friends on the prototype chain,
   so an undeclared name could look declared and be persisted into the document.
   Own-property only. */
export const isFlag = (name) => Object.prototype.hasOwnProperty.call(FLAGS, String(name));

export function flagValue(flags, name, aid) {
  if (!isFlag(name)) return false;
  const spec = FLAGS[name];
  const mine = (flags.byArtist || {})[aid] || {};
  if (typeof mine[name] === 'boolean') return mine[name];
  const g = (flags.global || {})[name];
  if (typeof g === 'boolean') return g;
  return spec.default;
}

/** Everything in force for one artist, ready to put in a payload. */
export function flagsFor(flags, aid) {
  const out = Object.create(null);
  for (const name of Object.keys(FLAGS)) out[name] = flagValue(flags, name, aid);
  return { ...out };
}

/** Convenience for a handler that needs one answer and has no flags doc yet. */
export async function flag(name, aid) {
  return flagValue(await readFlags(), name, aid);
}
