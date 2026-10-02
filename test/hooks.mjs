/* Redirects `@netlify/blobs` and `stripe` to in-memory stand-ins, for tests only. */
const FAKE = new URL('./blobs-fake.mjs', import.meta.url).href;
const STRIPE = new URL('./stripe-fake.mjs', import.meta.url).href;
/** Where a redirected specifier goes, or null. Plain and synchronous, so the
 *  simulator can use it with in-thread hooks (tools/roomsim.mjs). */
export function redirect(spec) {
  if (spec === '@netlify/blobs') return FAKE;
  if (spec === 'stripe') return STRIPE;
  return null;
}
export async function resolve(spec, ctx, next) {
  const url = redirect(spec);
  return url ? { url, shortCircuit: true } : next(spec, ctx);
}
