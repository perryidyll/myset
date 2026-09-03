import { createSign } from 'node:crypto';

/* GOOGLE SHEETS — the only place MySet data leaves Netlify.

   Perry asked for a sheet holding everything: what the app needs, what marketing
   needs, and what tells us which songs a room actually wants. This is the client;
   `_warehouse.mjs` decides what goes in it.

   THREE RULES, and the first one is the important one:

   1. THE SHEET IS A COPY, NEVER THE SOURCE. Nothing in the app ever reads from
      it. Delete the whole spreadsheet and MySet keeps working exactly as it does
      now — which is why this can be a plain export with no locking, no schema
      migration and no consistency worry. It is also why a failed sync is a
      warning, never an error the artist sees.

   2. IT IS OFF UNTIL THREE ENV VARS EXIST, and off means a clean no-op with a
      reason, not a throw. Same shape as STRIPE_SECRET_KEY (INVARIANT 9): the app
      must work fully with this switched off, because for most of its life it was.

   3. THE PRIVATE KEY NEVER TOUCHES THE REPO OR A CHAT WINDOW (INVARIANT 11/11b).
      Perry pastes it into Netlify himself. Nothing here logs it, echoes it, or
      returns it — `status()` reports whether it parses, never what it is.

   The three vars, all set by Perry in Netlify:
     GSHEET_ID     the spreadsheet id out of its URL
     GSHEET_EMAIL  the service account's address (…iam.gserviceaccount.com)
     GSHEET_KEY    that account's private key, PEM. Escaped \n is fine.

   And the one manual step no code can do: SHARE THE SHEET WITH GSHEET_EMAIL as an
   Editor. A service account has no access to a document nobody invited it to, and
   the error Google returns for that is a flat 403 with no hint — so `sheetStatus`
   says it in those words rather than making somebody guess. */

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';

/* A newline inside a Netlify env var survives, but every paste path that goes
   through a shell or a JSON file turns it into a literal backslash-n. Accept
   both rather than making the difference somebody's afternoon. */
const normKey = (v) => String(v || '').replace(/\\n/g, '\n').trim();

export function sheetsConfig() {
  const id = String(process.env.GSHEET_ID || '').trim();
  const email = String(process.env.GSHEET_EMAIL || '').trim();
  const key = normKey(process.env.GSHEET_KEY);
  return { id, email, key };
}

/** Why the sheet is off, in words a person can act on — or null when it is on. */
export function sheetsOffReason() {
  const { id, email, key } = sheetsConfig();
  const missing = [];
  if (!id) missing.push('GSHEET_ID');
  if (!email) missing.push('GSHEET_EMAIL');
  if (!key) missing.push('GSHEET_KEY');
  if (missing.length) return `Not set up yet — add ${missing.join(', ')} in Netlify.`;
  if (!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(key))
    return 'GSHEET_KEY does not look like a private key — it should start with -----BEGIN PRIVATE KEY-----.';
  if (!/@/.test(email))
    return 'GSHEET_EMAIL does not look like an address.';
  return null;
}
export const sheetsOn = () => sheetsOffReason() === null;

/* ---------- auth ----------
   One token per warm container, reused until a minute before it expires. A sync
   makes a dozen API calls and there is no reason for a dozen token round trips. */
let TOKEN = null;

const b64url = (s) => Buffer.from(s).toString('base64url');

async function accessToken() {
  if (TOKEN && TOKEN.exp > Date.now() + 60000) return TOKEN.value;
  const { email, key } = sheetsConfig();
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600,
  }));
  let sig;
  try {
    sig = createSign('RSA-SHA256').update(`${head}.${claim}`).sign(key).toString('base64url');
  } catch {
    /* An unreadable key is a setup mistake, not an outage. Say which of the two
       it is — the message a raw crypto error gives is unusable. */
    throw new Error('GSHEET_KEY could not be read as a private key. Re-paste it, newlines and all.');
  }
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${head}.${claim}.${sig}`,
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) {
    const why = d.error_description || d.error || `HTTP ${r.status}`;
    throw new Error(`Google would not issue a token: ${why}`);
  }
  TOKEN = { value: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000 };
  return TOKEN.value;
}

async function api(path, init = {}) {
  const { id } = sheetsConfig();
  const token = await accessToken();
  const r = await fetch(`${API}/${encodeURIComponent(id)}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) },
  });
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!r.ok) {
    const msg = (body && body.error && body.error.message) || text.slice(0, 300) || `HTTP ${r.status}`;
    if (r.status === 403) {
      throw new Error(`Google said no (403). Share the sheet with ${sheetsConfig().email} as an Editor — a service account cannot open a document nobody invited it to. Google's words: ${msg}`);
    }
    if (r.status === 404) {
      throw new Error(`No sheet with that id (404). Check GSHEET_ID is the long code out of the spreadsheet's own URL.`);
    }
    throw new Error(msg);
  }
  return body;
}

/* ---------- the bits the warehouse uses ---------- */

/** Every tab that exists right now, by title. */
export async function tabTitles() {
  const d = await api('?fields=sheets.properties.title,properties.title');
  return {
    title: (d && d.properties && d.properties.title) || '',
    tabs: ((d && d.sheets) || []).map((s) => s.properties.title),
  };
}

/** Creates any of `wanted` that is missing. Returns the ones it made. */
export async function ensureTabs(wanted) {
  const { tabs } = await tabTitles();
  const have = new Set(tabs);
  const add = wanted.filter((t) => !have.has(t));
  if (!add.length) return [];
  await api(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: add.map((title) => ({
        addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } },
      })),
    }),
  });
  return add;
}

/* Ranges are quoted because a tab called "What's on" would otherwise be a syntax
   error, and Google's parser reports that as an unhelpful 400. */
const range = (tab, a1) => encodeURIComponent(`'${String(tab).replace(/'/g, "''")}'!${a1}`);

/** Wipes the tab and writes `rows` from A1. For tabs that are a snapshot of now. */
export async function writeTab(tab, rows) {
  await api(`/values/${range(tab, 'A:ZZ')}:clear`, { method: 'POST', body: '{}' });
  if (!rows.length) return 0;
  await api(`/values/${range(tab, 'A1')}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: rows.map(cells) }),
  });
  return rows.length - 1;
}

/** Adds `rows` under whatever is already there. For tabs that are a log. */
export async function appendTab(tab, rows, header) {
  if (!rows.length) return 0;
  const first = await api(`/values/${range(tab, 'A1:A1')}`);
  const empty = !((first && first.values) || []).length;
  const out = empty && header ? [header, ...rows] : rows;
  await api(`/values/${range(tab, 'A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({ values: out.map(cells) }),
  });
  return rows.length;
}

/** True only if the tab has nothing in A1 — so a written-once tab stays written once. */
export async function tabIsEmpty(tab) {
  const first = await api(`/values/${range(tab, 'A1:A1')}`);
  return !((first && first.values) || []).length;
}

/* Google's RAW mode still guesses at types, and a song called "1/2" or a name
   beginning with "=" or "+" are both real. Anything that would be read as a
   formula gets a leading apostrophe, which Sheets shows as plain text. */
const cells = (row) => row.map((v) => {
  if (v == null) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  const s = String(v);
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
});
