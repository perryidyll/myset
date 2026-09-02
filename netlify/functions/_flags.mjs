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
};

const KEY = 'flags';
const empty = () => ({ v: 1, global: {}, byArtist: {} });

export async function readFlags() {
  const { data } = await readDoc(KEY, null);
  const f = { ...empty(), ...(data || {}) };
  f.global ||= {}; f.byArtist ||= {};
  return f;
}
export const mutateFlags = (fn) =>
  casDoc(KEY, empty, (f) => { f.global ||= {}; f.byArtist ||= {}; return fn(f); });

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
