/* Wall-clock time in a named place, with no library.

   A gig is "Thursday 8pm at the Ugly Duckling" — that is a LOCAL wall clock in a
   named zone, not an instant. Store it that way and resolve to an instant on
   read, or every gig shifts by an hour when Thailand or the artist's laptop
   changes offset. */

/** How far ahead of UTC `tz` is at this instant, in ms. */
export function tzOffsetMs(utcMs, tz) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const p = {};
    for (const part of dtf.formatToParts(new Date(utcMs))) p[part.type] = part.value;
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day,
      p.hour === '24' ? 0 : +p.hour, +p.minute, +p.second);
    return asUTC - utcMs;
  } catch { return 0; }
}

export function validTz(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

/** "2026-09-05" + "20:00" in tz  ->  UTC ms.
 *  Iterated because the offset depends on the instant we are trying to find —
 *  two passes settle every real case including DST boundaries. */
export function wallClockToMs(date, time, tz) {
  const [Y, M, D] = String(date || '').split('-').map(Number);
  const [h, m] = String(time || '00:00').split(':').map(Number);
  if (!Y || !M || !D) return null;
  const naive = Date.UTC(Y, M - 1, D, h || 0, m || 0);
  let guess = naive;
  for (let i = 0; i < 3; i++) guess = naive - tzOffsetMs(guess, tz);
  return guess;
}

/** The local calendar date in tz for an instant — "2026-09-05". */
export function localDate(utcMs, tz) {
  const off = tzOffsetMs(utcMs, tz);
  return new Date(utcMs + off).toISOString().slice(0, 10);
}
export function localTime(utcMs, tz) {
  const off = tzOffsetMs(utcMs, tz);
  return new Date(utcMs + off).toISOString().slice(11, 16);
}

/* Plain date maths on YYYY-MM-DD, done in UTC so it can never drift. */
export const dateToUTC = (d) => {
  const [Y, M, D] = String(d).split('-').map(Number);
  return Date.UTC(Y, M - 1, D);
};
export const utcToDate = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d, n) => utcToDate(dateToUTC(d) + n * 86400000);
export const dayOfWeek = (d) => new Date(dateToUTC(d)).getUTCDay();   // 0=Sun
export function addMonths(d, n) {
  const [Y, M, D] = String(d).split('-').map(Number);
  const t = new Date(Date.UTC(Y, M - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return utcToDate(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(D, last)));
}
export const daysBetween = (a, b) => Math.round((dateToUTC(b) - dateToUTC(a)) / 86400000);
