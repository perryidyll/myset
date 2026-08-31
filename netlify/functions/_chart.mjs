import { casDoc, readDoc, KEY } from './_lib.mjs';

/* The artist's own chart for a song: words, chords, capo notes, a reminder that
   the second verse is different — whatever they paste.

   This is NOT the audience's lyrics. Those come from LRCLIB, are labelled
   "Unofficial lyrics", and are shown to the room. A chart is private to the
   artist, is never in any public payload, and is never fetched from anywhere —
   they type or paste it themselves, exactly how they like it.

   Its own document, because a full chart runs to kilobytes and `show` is the hot
   read path that every phone in the room polls. */

export const MAX_CHART = 20000;

export async function readChart(aid, songId) {
  const { data } = await readDoc(KEY.chart(aid, songId), null);
  return (data && typeof data.text === 'string') ? data.text : '';
}

export function saveChart(aid, songId, text) {
  const t = String(text == null ? '' : text).replace(/\r/g, '').slice(0, MAX_CHART);
  return casDoc(KEY.chart(aid, songId), () => ({ v: 1, text: '' }), (d) => {
    d.v = 1; d.text = t; d.at = Date.now();
    return true;
  });
}

/** Which of these songs have a chart, so the Studio can show a marker without
 *  loading any of them. One read per song, so it is called on demand only. */
export async function chartFlags(aid, songIds) {
  const out = {};
  await Promise.all((songIds || []).slice(0, 200).map(async (id) => {
    out[id] = (await readChart(aid, id)).length > 0;
  }));
  return out;
}
