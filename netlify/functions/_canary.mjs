/* PROVENANCE MARKERS — how we would prove somebody copied MySet.

   WHAT THIS IS NOT. It is not a defence. Nothing here stops a clone, and the
   product's whole concept fits in one sentence, so rebuilding it from the outside
   is legal and easy. This exists for one narrow job: turning "that looks like our
   app" into evidence a lawyer can use, cheaply, without asking anyone to change
   how they work.

   WHY THERE ARE NO FAKE RECORDS IN THE LIVE FEED. The classic version of this is a
   canary row — a plausible fake entry seeded into public data, which can only reach
   a competitor's product by being copied. We cannot do that here, and the reason is
   INVARIANT 0j: never invent gig data. A listed gig sends a real person to a real
   bar on a real night, and placeholder venues had to be deleted from this app once
   already before anybody saw them. A canary that can strand somebody at a bar that
   isn't having a gig is a worse outcome than an unprovable clone. So the markers
   below are all things that are TRUE — they mark our own real output rather than
   inventing anything.

   THREE KINDS, in ascending order of how much they prove:

   1. NATURAL fingerprints — distinctive choices that already existed, which a
      copy carries by accident. The strongest is our error prose: nobody
      independently writes "That one isn't on tonight's list" with a curly
      apostrophe. These cost nothing and are already deployed everywhere.
   2. PLANTED fingerprints — arbitrary constants with no function, placed where a
      wholesale copy takes them. Arbitrariness is the point: a shared token has no
      innocent explanation, which is exactly what makes it evidence.
   3. The PAYLOAD stamp below — narrower than it looks. It only catches somebody
      proxying or republishing our actual API responses, not somebody who wrote
      their own server. Kept because it is ~18 bytes and free.

   Every marker is listed in FINGERPRINTS.md with the command to search a suspect
   product for it. Do not change these values casually — a marker is only evidence
   if it was demonstrably in place before the copy. */

/** Arbitrary, meaningless, and stable since 2026-09-01. That is the whole design.
 *  If this string appears in another product there is no innocent reason for it. */
export const MARK = 'ms-k3f9qz';

/** Adds the stamp to a public payload. Public reads only — never on the artist's
 *  own authenticated views, which nobody outside can fetch anyway. */
export const stampPublic = (payload) => ({ ...payload, src: MARK });
