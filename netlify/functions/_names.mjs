/* COMPARING A PERSON'S NAME TO ANOTHER SPELLING OF THE SAME PERSON'S NAME.

   Used to decide whether the name an artist gave MySet is the same as the name on
   the bank account Stripe verified. That decision can grant a public trust badge,
   so the interesting cases are not the matches — they are the near-misses, and the
   rule for those is: a near-miss is NOT a match, it is a question for a human.

   What has to be tolerated, because all of these are the same person:
     · case and accents          Perry Idyll / PERRY IDYLL / Pérry Idyll
     · punctuation               O'Brien / OBrien / O Brien
     · middle names and initials Perry Idyll / Perry John Idyll / Perry J. Idyll
     · order                     Perry Idyll / Idyll, Perry
     · suffixes                  Perry Idyll Jr / Perry Idyll

   What must NOT be tolerated, because these are not:
     · a shared surname only     Perry Idyll / Sam Idyll
     · a shared first name only  Perry Idyll / Perry Smith
     · one name inside another   Ann Lee / Joanne Leeson
     · an empty or one-word name on either side — too little to be sure of anything

   Nothing here is clever, and that is deliberate: a fuzzy-distance score would let
   "Sam Idyll" pass as "Pam Idyll" at some threshold nobody chose on purpose. */

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'jnr', 'snr']);
/* Particles that stand APART from a surname and are dropped, because whether
   somebody writes them varies by document: "van der Berg" / "Vanderberg" / "Berg". */
const PARTICLES = new Set(['de', 'del', 'della', 'der', 'den', 'di', 'da', 'do', 'dos',
  'du', 'la', 'le', 'van', 'von', 'bin', 'binti', 'ibn', 'al', 'el']);
/* ...and prefixes that BELONG to the surname and must be joined to it instead.
   Dropping these treated O'Brien as "Brien" and McDonald as "Donald", so
   "Sean O'Brien" and "Sean OBrien" — the same person, two documents — came out as
   a weak match and went to a human for no reason. */
const JOINERS = new Set(['mc', 'mac', 'o', 'st']);

/** A name reduced to its comparable parts: lowercase, unaccented, no punctuation. */
export function nameTokens(raw) {
  const flat = String(raw || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // strip accents
    .toLowerCase()
    /* Apostrophes CLOSE UP rather than becoming a space: O'Brien is one name, and
       splitting it invented a stray "o" that then looked like a particle. */
    .replace(/['’ʼ]/g, '')
    .replace(/[^a-z\s]/g, ' ')                          // other punctuation, digits, commas
    .replace(/\s+/g, ' ')
    .trim();
  if (!flat) return [];
  const raw2 = flat.split(' ');
  // join a surname prefix to what follows it: "mc donald" is "mcdonald"
  const joined = [];
  for (let i = 0; i < raw2.length; i++) {
    if (JOINERS.has(raw2[i]) && raw2[i + 1]) { joined.push(raw2[i] + raw2[i + 1]); i++; }
    else joined.push(raw2[i]);
  }
  const kept = joined.filter((t) => t.length > 1 && !SUFFIXES.has(t));

  /* Particles are only dropped when they sit BETWEEN names, which is the only place
     they are actually particles. "Di", "Le", "Al" and "Van" are also perfectly
     ordinary first names — Di Park, Le Nguyen, Al Green, Van Morrison — and the
     first version stripped them, leaving one token and matching nobody at all. So:
     never the first token, and never if it would leave less than two names to
     compare, because a shorter name is not a safer one here. */
  const trimmed = kept.filter((t, i) => i === 0 || !PARTICLES.has(t));
  return trimmed.length >= 2 ? trimmed : kept;
}

/** How confident are we that these are the same person?
 *  'exact'  — the same set of names, in any order
 *  'strong' — one is the other plus extra given names (a middle name, an initial)
 *  'weak'   — they overlap but not enough to be sure
 *  'none'   — no meaningful overlap, or not enough name to judge
 *  Only 'exact' and 'strong' should ever grant anything without a human. */
export function nameMatch(a, b) {
  const A = nameTokens(a), B = nameTokens(b);
  /* One word is not a name to match on. "Perry" matching "Perry" would hand the
     badge to every other Perry, so too little information is 'none', never 'weak'. */
  if (A.length < 2 || B.length < 2) return 'none';

  const setA = new Set(A), setB = new Set(B);
  const shared = [...setA].filter((t) => setB.has(t));
  if (!shared.length) return 'none';

  const sameSet = setA.size === setB.size && shared.length === setA.size;
  if (sameSet) return 'exact';

  /* A subset means every name on the shorter version appears on the longer one —
     "Perry Idyll" inside "Perry John Idyll". It still needs TWO shared names, so a
     shared surname alone can never reach this. */
  const subset = shared.length === Math.min(setA.size, setB.size);
  if (subset && shared.length >= 2) return 'strong';

  return 'weak';
}

/** The one place that decides whether a match may act on its own. */
export const nameMatchIsStrong = (m) => m === 'exact' || m === 'strong';

/** A name for a human to read in the review queue, without shouting. */
export const tidyName = (raw) =>
  String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 80);
