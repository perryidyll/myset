/* THE OFF-SITE COPY, BROUGHT HOME — decision 0146.

   `mirrorcron` copies every document to the R2 bucket under `backup/<key>` once a
   day (decision 0069). Until 2026-10-02 nothing could read that copy back: the one
   rehearsed restore (tools/backup.py --restore) starts from a folder on the
   founder's laptop, and the R2 copy was a backup nobody had ever opened.

   This reads it into exactly that folder shape — `keys/<key>` and a `manifest.json`
   with a size and a checksum per key — so the restore that was already rehearsed
   is the restore, whichever copy it starts from:

     python3 tools/backup.py --from-r2          # runs this, then checks the copy
     python3 tools/backup.py --restore DIR --store rehearsal-YYYYMMDD

   It lists the bucket. That is the one thing the functions may never do with live
   data (INVARIANT 1), and it is right here for the reason it is right in
   backup.py: on the day this is needed the store that names the keys is the thing
   that is gone. Read-only — two verbs, GET and GET.

   Run through backup.py, which hands over the four R2_ variables from Netlify
   without printing them. By hand: R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID and
   R2_SECRET_ACCESS_KEY in the environment, then `node tools/r2pull.mjs <folder>`.

   `--date YYYY-MM-DD` reads that day's DATED copies instead (decision 0175,
   `snap/<day>/<key>`): the version of each document the mirror copied that day,
   because it had changed. Not a whole store — the documents that changed that
   day, as they were — which is what a bad deploy's day-after needs. */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sigv4, uriEncode, EMPTY_SHA, r2Get, r2Enabled } from '../netlify/functions/_r2.mjs';

const PREFIX = 'backup/';
const stampNow = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const unxml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const fname = (key) => key.replace(/\//g, '%2F');          // the same name backup.py gives a key on disk

/** One page of the bucket's listing under `prefix`. */
async function page(token, prefix = PREFIX) {
  const env = process.env;
  const host = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const query = { 'list-type': '2', prefix, ...(token ? { 'continuation-token': token } : {}) };
  const stamp = stampNow();
  const headers = { 'x-amz-content-sha256': EMPTY_SHA, 'x-amz-date': stamp };
  const path = `/${env.R2_BUCKET}`;
  const { signature, scope, signedHeaders } = sigv4({ method: 'GET', host, path, query, headers, payloadHash: EMPTY_SHA,
                                                      key: env.R2_ACCESS_KEY_ID, secret: env.R2_SECRET_ACCESS_KEY, stamp });
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${env.R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const qs = Object.keys(query).sort().map((k) => `${uriEncode(k)}=${uriEncode(query[k])}`).join('&');
  const r = await fetch(`https://${host}${path}?${qs}`, { headers, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`r2 list ${r.status}`);
  const xml = await r.text();
  const keys = [...xml.matchAll(/<Contents>[\s\S]*?<Key>([\s\S]*?)<\/Key>[\s\S]*?<\/Contents>/g)].map((m) => unxml(m[1]));
  const more = /<IsTruncated>true<\/IsTruncated>/.test(xml);
  const next = (/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml) || [])[1];
  return { keys, next: more && next ? unxml(next) : null };
}

/** Every object under `backup/` — or, given `day`, under `snap/<day>/` — written
 *  to `out` in backup.py's folder shape. Returns the manifest. */
export async function pull(out, { day = null } = {}) {
  const prefix = day ? `snap/${day}/` : PREFIX;
  const taken = new Date().toISOString();
  mkdirSync(join(out, 'keys'), { recursive: true, mode: 0o700 });
  const all = [];
  for (let token = null, first = true; first || token; first = false) {
    const p = await page(token, prefix);
    all.push(...p.keys);
    token = p.next;
  }
  const keys = all.filter((k) => k.startsWith(prefix) && k.length > prefix.length).map((k) => k.slice(prefix.length)).sort();
  const rows = [], failed = [];
  let i = 0;
  const worker = async () => {
    while (i < keys.length) {
      const k = keys[i++];
      try {
        const got = await r2Get(prefix + k);
        if (!got) { failed.push(k); continue; }
        writeFileSync(join(out, 'keys', fname(k)), got.bytes, { mode: 0o600 });
        rows.push({ key: k, bytes: got.bytes.length, sha256: createHash('sha256').update(got.bytes).digest('hex'), type: got.type });
      } catch { failed.push(k); }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  rows.sort((a, b) => (a.key < b.key ? -1 : 1));
  const manifest = { v: 1, store: 'r2:' + prefix, taken, keys: keys.length, copied: rows.length, failed, rows };
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = process.argv[2];
  const at = process.argv.indexOf('--date');
  const day = at > 0 ? process.argv[at + 1] : null;
  if (!out || (at > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(day || ''))) { console.error('usage: node tools/r2pull.mjs <folder> [--date YYYY-MM-DD]'); process.exit(2); }
  if (!r2Enabled()) { console.error('the four R2_ variables are not set — run this through tools/backup.py --from-r2'); process.exit(2); }
  const m = await pull(out, { day });
  console.log(`pulled ${m.copied} of ${m.keys} keys, ${(m.rows.reduce((n, r) => n + r.bytes, 0) / 1e6).toFixed(1)} MB, from R2 → ${out}`);
  if (m.failed.length) console.log('FAILED to read:', m.failed.join(', '));
  process.exit(m.failed.length ? 1 : 0);
}
