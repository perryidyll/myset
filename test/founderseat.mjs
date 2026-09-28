/* THE FOUNDER'S TOOLS NEED THE FOUNDER'S OWNER SEAT — on Media Dash and in the Studio
   too (decision 0100, the two doors decision 0099 left for their own change).

   `isPlatformOwner(aid)` and `me.aid === DEFAULT_ARTIST` both ask WHICH PAGE, never
   WHO, and a band mate or the sound engineer signed in to the founding page is on
   that page too. 0099 closed the platform block in admin.mjs. Two more asked the
   same question:

     · MEDIA DASH. /api/mediadash let any seat on the founding page log a boost row
       on the public dashboard, overwrite the founder's (same boostId) or remove it.
       This is also the first test of that endpoint at all.
     · THE STUDIO. It drew the founder's cards on PLAN.owner, which is the page. A
       member or crew seat on the founding page saw the codes form, the venues, the
       sheet, the flags, the ID queue, MySet's books and the bug list, and the server
       refuses every one of them — so each card read the refusal as "None yet.", "No
       venues have signed up yet.", "Could not ask the server." or a spinner that
       never stops. PLAN.owner itself keeps its meaning: it is also the founding
       page's plan-lock bypass, which every seat on it is owed. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MEDIADASH_KEY = 'mediadash-push-key';
const { readFileSync } = await import('node:fs');

const dash = (await import('../netlify/functions/mediadash.mjs')).default;
const { createArtist, mutateArtists, readArtists, signToken, revOf } = await import('../netlify/functions/_auth.mjs');
const { newSid } = await import('../netlify/functions/_session.mjs');
const { DEFAULT_ARTIST, readDoc } = await import('../netlify/functions/_lib.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + ' \n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (body, headers = {}) => {
  const r = await dash(new Request('https://x/api/mediadash', body === undefined
    ? { headers } : { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const bearer = (token) => ({ authorization: 'Bearer ' + token });
const siteRows = async () => ((await readDoc('mediadash/boosts', null)).data || { rows: {} }).rows;

console.log('\nSETUP  the founding page with three seats, another artist, and one live post on the dashboard');
await createArtist({ email: 'rita@example.com', name: 'Rita Vance', slug: 'rita' });
await mutateArtists((a) => {
  a.byId[DEFAULT_ARTIST] ||= { slug: DEFAULT_ARTIST, name: 'Founder', createdAt: 1 };
  a.byEmail['founder@example.com'] = { artistId: DEFAULT_ARTIST, role: 'owner' };
  a.byEmail['founder-band@example.com'] = { artistId: DEFAULT_ARTIST, role: 'member' };
  a.byEmail['founder-sound@example.com'] = { artistId: DEFAULT_ARTIST, role: 'crew' };
  return true;
});
const reg = await readArtists();
const seat = (email) => signToken(email, revOf(reg, reg.byEmail[email].artistId), newSid());
const OWNER = await seat('founder@example.com'), MEMBER = await seat('founder-band@example.com'),
      CREW = await seat('founder-sound@example.com'), RITA = await seat('rita@example.com');
let r = await hit({ data: { posts: [{ id: 'reel1', name: 'First reel', format: 'reel' }], boosts: [] } },
  { 'x-mediadash-key': process.env.MEDIADASH_KEY });
ok('the Mac pushes the dashboard with its key', r.ok && r.data > 0, r);
eq('and anyone can read it', ((await hit()).posts || []).map((p) => p.id), ['reel1']);

console.log('\nTHE FOUNDER’S OWN SEAT LOGS A BOOST');
r = await hit({ boost: { id: 'reel1', boostId: 'b1', spend: 20, views: 900 } }, bearer(OWNER));
ok('the founder’s sign-in logs one', r.ok && r.boost && r.boost.boostId === 'b1', r);

console.log('\nA BAND MATE OR THE SOUND ENGINEER ON THE FOUNDING PAGE CANNOT');
for (const [who, T] of [['member', MEMBER], ['crew', CREW]]) {
  eq(`THE BUG: a ${who} seat cannot log a boost`,
     (await hit({ boost: { id: 'reel1', boostId: `${who}-row`, spend: 1 } }, bearer(T))).status, 401);
  eq(`THE BUG: or overwrite the founder’s row (same boostId)`,
     (await hit({ boost: { id: 'reel1', boostId: 'b1', spend: 999 } }, bearer(T))).status, 401);
  eq(`THE BUG: or remove it`,
     (await hit({ boost: { id: 'reel1', boostId: 'b1', removed: true } }, bearer(T))).status, 401);
}
const rows = await siteRows();
eq('the founder’s row is as it was logged',[rows.b1 && rows.b1.spend, !!(rows.b1 && rows.b1.removed)], [20, false]);
eq('and no other row landed', Object.keys(rows), ['b1']);

console.log('\nTHE OTHER DOORS ARE WHAT THEY WERE');
eq('another artist’s owner is refused, as always', (await hit({ boost: { id: 'reel1', spend: 5 } }, bearer(RITA))).status, 401);
eq('and so is nobody at all', (await hit({ boost: { id: 'reel1', spend: 5 } })).status, 401);
r = await hit({ boost: { id: 'reel1', boostId: 'b2', spend: 7 } }, { 'x-admin-code': process.env.ADMIN_CODE });
ok('the page’s own door, the admin code, still logs one', r.ok && r.boost && r.boost.boostId === 'b2', r);
r = await hit({ boost: { id: 'reel1', boostId: 'b2', removed: true } }, bearer(OWNER));
ok('and the founder’s seat can take one off', r.ok && r.boost && r.boost.removed === true, r);
eq('the public read carries the one left', ((await hit()).boosts || []).map((b) => b.boostId), ['b1']);

console.log('\nTHE STUDIO DRAWS THE FOUNDER’S TOOLS FOR THE FOUNDER’S OWNER SEAT ONLY');
const studio = readFileSync(new URL('../public/studio.js', import.meta.url), 'utf8');
ok('THE BUG: one question for it — the founding page AND the owner seat',
   /const founder=\(\)=>!!\(PLAN&&PLAN\.owner&&\(PLAN\.role\|\|'owner'\)==='owner'\);/.test(studio));
for (const card of ['flagCard', 'sheetCard', 'idQueueCard', 'bugCard', 'booksCard'])
  ok(`THE BUG: ${card} draws nothing for another seat`,
     new RegExp(`function ${card}\\(\\)\\{\\n  if\\(!founder\\(\\)\\) return '';`).test(studio));
ok('THE BUG: nor do the codes you hand out and the venues',
   /\$\{founder\(\)\?`\s*<div class="sec"><span class="kick">Codes you hand out/.test(studio));
ok('THE BUG: and opening the Studio asks for those two lists only then', /if\(founder\(\)&&\(!PROMOS\|\|!VENUES\)\)/.test(studio));
ok('THE BUG: and the Money tab reads MySet’s books only then', /if\(founder\(\)&&!BOOKS\) loadBooks\(force\);/.test(studio));
ok('PLAN.owner still means the founding page: its plan stays unlocked for every seat on it',
   /if\(PLAN\.owner\) return true;/.test(studio) && /const canHide=\(\)=>!!\(PLAN&&\(PLAN\.owner\|\|/.test(studio));

/* THE TRIPWIRE. Every action behind admin.mjs's founder gates, and every place the
   Studio sends one. A new founder tool must be drawn behind founder() and its
   function named here, or this fails and says where. */
{
  const admin = readFileSync(new URL('../netlify/functions/admin.mjs', import.meta.url), 'utf8');
  const block = (from) => { const i = admin.indexOf(from); return i < 0 ? '' : admin.slice(i, admin.indexOf('\n}\n', i)); };
  const names = (s) => [...s.matchAll(/action === '(\w+)'/g)].map((m) => m[1]);
  const FOUNDER_ACTIONS = new Set([...names(block('/* ---- owner only, from here ----')), ...names(block('if (!isFounder) return bad('))]);
  ok('the founder’s actions are read out of admin.mjs',
     ['bugList', 'flagSet', 'idApprove', 'promoCreate', 'sheetSync', 'venueVerify', 'books'].every((a) => FOUNDER_ACTIONS.has(a)), [...FOUNDER_ACTIONS]);
  // the founder cards' own loaders and buttons, each reached only from a card that opens on founder()
  const CARD_FNS = new Set(['loadFlags', 'flagFlip', 'loadSheet', 'sheetSync', 'loadIdQueue', 'idDecide', 'loadBugs',
    'createPromo', 'togglePromo', 'verifyVenue', 'loadBooks', 'booksCsv', 'saveCosts']);
  const INLINE = { loadPlan: ['promoList', 'venueList'] };   // behind if(founder()&&…), pinned above
  const decls = [...studio.matchAll(/^(?:async function|function|const|let) (\w+)/gm)].map((m) => ({ name: m[1], at: m.index }));
  const within = (i) => (decls.filter((d) => d.at < i).pop() || {}).name;
  const stray = [];
  for (const a of FOUNDER_ACTIONS)
    for (const m of studio.matchAll(new RegExp(`action:[^,{}]*'${a}'|\\bq\\('${a}'\\)`, 'g'))) {
      const fn = within(m.index);
      if (!CARD_FNS.has(fn) && !(INLINE[fn] || []).includes(a)) stray.push(`${a} from ${fn}()`);
    }
  eq('every founder action the Studio sends comes from a founder card’s own function', stray, []);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
