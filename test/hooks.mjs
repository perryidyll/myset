/* Redirects `@netlify/blobs` to the in-memory stand-in, for tests only. */
const FAKE = new URL('./blobs-fake.mjs', import.meta.url).href;
export async function resolve(spec, ctx, next) {
  if (spec === '@netlify/blobs') return { url: FAKE, shortCircuit: true };
  return next(spec, ctx);
}
