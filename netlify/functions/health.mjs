import { guard } from './_errlog.mjs';
import { json, readDoc } from './_lib.mjs';
import { look, WATCH, BELL_STALE_MS, OWED_STALE_MS, ERRS_PER_HOUR } from './_watch.mjs';
import { configured } from './_secret.mjs';

/* IS MYSET WELL? — for a machine that is not MySet to ask (decision 0157).

   The watch (_watch.mjs) runs on Netlify, so it cannot report Netlify being down or
   its own schedule having stopped. This is the address an outside check reads
   (.github/workflows/watch.yml): never cached, a handful of small reads, counts and
   ages only — no names, no amounts, nothing a stranger learns anything from.

   200 with `ok: true` means every answer is inside its limit. 503 means one is not,
   or the store did not answer (guard). `watchAgeSec` is how long since the inside
   watch last ran, which is how the outside check sees a stopped schedule.

   `seal` says whether the server holds its own secret and how the keyring stands
   against it (ringState, _seal.mjs — read-only, never a key): a deploy preview and
   production can each be read by content after decision 0112/0113 lands, and a secret
   that cannot open the ring is a problem the watch tells the founder about. */
const WATCH_STALE_MS = 30 * 60e3;
const sec = (ms) => (ms === null ? null : Math.round(ms / 1000));

const main = async () => {
  const now = Date.now();
  const seen = await look(now);
  const lastAt = Number((((await readDoc(WATCH, null)).data) || {}).lastAt) || 0;
  const watchAgeMs = lastAt ? now - lastAt : null;
  const why = seen.problems.map((p) => p.kind);
  if (watchAgeMs !== null && watchAgeMs > WATCH_STALE_MS) why.push('watch');
  return json({
    ok: !why.length, why, at: now,
    bellAgeSec: sec(seen.bellAgeMs), owed: seen.owed, owedOldestSec: sec(seen.owedOldestMs),
    errorsLastHour: seen.errors, watchAgeSec: sec(watchAgeMs),
    seal: { secret: configured(), ring: seen.seal },
    limits: { bellSec: BELL_STALE_MS / 1000, owedSec: OWED_STALE_MS / 1000, errorsPerHour: ERRS_PER_HOUR, watchSec: WATCH_STALE_MS / 1000 },
  }, why.length ? 503 : 200);
};
export default guard('health', main);
