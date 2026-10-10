/* THE PAGES' OWN SCRIPT POLICY (SEC-006, decision 0209).

   A page runs its own inline <script> blocks — each named by its SHA-256 — and same-origin
   files, and nothing else: no onclick=, no injected <script>, no javascript: link. That is
   the line an injected tag cannot cross even where escaping failed. Its actions are wired by
   public/on.js (data-on-*), never by an attribute that holds code.

   One reading of "which inline scripts does this page run" serves every caller:
     · tools/stamp.mjs writes the policy into every page in public/ — a <meta> ahead of any
       script, so the bytes and their policy travel together through the CDN and the service
       worker's cache, and a stale page never meets a newer policy;
     · the founder's function-served pages (_passgate.mjs's door, the Show log's lock, the
       money model) send it as their header, worked out from the page they are about to send;
     · test/structure.mjs refuses a page whose policy no longer matches its scripts.

   netlify.toml's site-wide header keeps 'unsafe-inline' (so does artistpage.mjs's copy of it):
   a browser enforces every policy it is given, so each page's meta is what binds, and the
   header's word is only the floor for a response that carries no meta. */
import { createHash } from 'node:crypto';

/* The bodies of the inline scripts a browser would run: every <script> without a src whose type
   is absent or a JavaScript type. A data block (application/ld+json) is never run, so it needs no
   hash. The body is the text exactly as written — the browser hashes the same characters. */
export function inlineScripts(html) {
  const out = [];
  for (const m of String(html).matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1] || '';
    if (/\ssrc\s*=/i.test(attrs)) continue;
    const type = (attrs.match(/\stype\s*=\s*["']?([^"'\s>]+)/i) || [])[1];
    if (type && !/^(text\/javascript|application\/javascript|module)$/i.test(type)) continue;
    out.push(m[2]);
  }
  return out;
}

export const hashOf = (text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

/* script-src for a page: itself, its inline blocks by hash, and any extra hash or host it names.
   'unsafe-inline' rides only beside a hash, for a browser too old to know hashes: every browser
   that knows them ignores it when a hash is present (CSP Level 2). A page with no inline block
   gets neither. */
export function scriptSrc(html, extra = []) {
  const hashes = [...new Set([...inlineScripts(html).map(hashOf), ...extra.filter((x) => x.startsWith("'sha256-"))])];
  const hosts = extra.filter((x) => !x.startsWith("'sha256-"));
  return ["'self'", ...(hashes.length ? ["'unsafe-inline'", ...hashes] : []), ...hosts].join(' ');
}
