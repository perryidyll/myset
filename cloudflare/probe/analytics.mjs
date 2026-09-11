#!/usr/bin/env node
/* Reads the Durable Objects analytics for the probe from Cloudflare's GraphQL API.
   The OAuth token is read from wrangler's own config and used in a header; it is
   never printed. Prints only sums for the window. */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
const cfg = readFileSync(`${homedir()}/Library/Preferences/.wrangler/config/default.toml`, 'utf8');
const token = /oauth_token\s*=\s*"([^"]+)"/.exec(cfg)?.[1];
if (!token) { console.error('no wrangler token found'); process.exit(1); }
const acct = '7a48fa04262dcda3055ebc7ba845985b';
const since = process.argv[2] || new Date(Date.now() - 3 * 3600e3).toISOString();
const until = new Date().toISOString();
const q = `query($acct:String!,$since:Time!,$until:Time!){ viewer { accounts(filter:{accountTag:$acct}) {
  inv: durableObjectsInvocationsAdaptiveGroups(limit:20, filter:{datetime_geq:$since, datetime_leq:$until}) {
    sum { requests errors responseBodySize } }
  per: durableObjectsPeriodicGroups(limit:20, filter:{datetime_geq:$since, datetime_leq:$until}) {
    sum { activeTime cpuTime storageReadUnits storageWriteUnits
      inboundWebsocketMsgCount outboundWebsocketMsgCount subrequests exceededMemoryErrors fatalInternalErrors } max { activeWebsocketConnections } }
} } }`;
const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify({ query: q, variables: { acct, since, until } }) });
const j = await r.json();
if (j.errors) { console.log(JSON.stringify(j.errors, null, 1)); process.exit(1); }
console.log(`window ${since} → ${until}`);
console.log(JSON.stringify(j.data.viewer.accounts[0], null, 1));
