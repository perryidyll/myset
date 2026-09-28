/* EACH SEAT, EACH TAB — what the Studio draws for a band mate or crew seat
   (decision 0105).

   The server holds the line (test/accounts.mjs, "EACH SEAT, EACH TAB"); this file
   holds the page to it. AGENTS.md rule 3: if the server will refuse it, the page must
   not offer it. Before 0105 the Studio drew every control for every seat, and a band
   mate met a refusal read as an empty state ("Nothing to add up yet"), a toast, or a
   spinner that never stopped — the earnings card, "Got a code?", Add an email, the
   Studio code, the page address, delete, sign out everywhere.

   How the page does it, and what is pinned here:
     · lvl(tab) reads planGet's `access` (0 hidden, 1 view, 2 edit). A tab at 0 leaves
       the tab bar and the Menu, and is never landed on; its reads are never sent.
     · A control that changes a tab carries data-ed="<tab>" ("owner" for the owner's
       own), one that only shows a tab carries data-see="<tab>", and seatPass() takes
       out whatever this seat cannot do — after every paint and every sheet. On a tab
       at view, every field shows and none can be typed into.
     · A sample's Studio (0101) draws as the owner's: its writes open the claim sheet.
     · Every owner-only action the Studio sends comes from one of the functions named
       below, each reached only through an owner gate pinned here — a new sender of an
       owner-only action fails this file until somebody gates it. */
const { readFileSync } = await import('node:fs');
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const studio = read('public/studio.js');
const session = read('netlify/functions/_session.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + ' \n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const count = (re) => (studio.match(re) || []).length;

console.log('\nTHE PAGE READS THE SAME TABLE THE SERVER DOES');
const areasAt = session.indexOf('export const AREAS = [');
const AREAS = [...session.slice(areasAt, session.indexOf('];', areasAt)).matchAll(/'(\w+)'/g)].map((m) => m[1]);
ok('the tabs are read out of _session.mjs', AREAS.length === 9 && AREAS.includes('money') && AREAS.includes('plans'), AREAS);
const eds = [...new Set([...studio.matchAll(/data-ed="(\w+)"/g)].map((m) => m[1]))];
const sees = [...new Set([...studio.matchAll(/data-see="(\w+)"/g)].map((m) => m[1]))];
eq('every data-ed names a tab or the owner', eds.filter((x) => x !== 'owner' && !AREAS.includes(x)), []);
eq('every data-see names a tab', sees.filter((x) => !AREAS.includes(x)), []);
ok('lvl() is planGet\'s access, the plan not in yet draws the least, a failed one the most',
   /if\(PLAN===null\) return a==='setlist'\?1:0;\n  if\(!PLAN\.ok\|\|!PLAN\.access\|\|/.test(studio));
ok('a sample\'s Studio draws the owner\'s page (0101)', /function lvl\(a\)\{[\s\S]{0,260}if\(SAMPLE\) return 2;/.test(studio) &&
   /const ownerSeat=\(\)=>!!SAMPLE\|\|/.test(studio));
ok('the pass runs after every paint and every sheet',
   /\$\{tabBar\(\)\}`;\n  seatPass\(\$\('#app'\),TABAREA\[TAB\]\);/.test(studio) && /\$\{h\}`;\n  seatPass\(sh\);/.test(studio));
ok('the view-only note sits over the tab', /\$\{cardTrouble\(s\)\}\$\{viewNote\(TABAREA\[TAB\]\)\}\$\{body\}/.test(studio));

console.log('\nA HIDDEN TAB IS NOT A PLACE');
ok('the tab bar draws only what this seat can see', /\.filter\(\(\[t\]\)=>!TABAREA\[t\]\|\|see\(TABAREA\[t\]\)\)/.test(studio));
for (const t of ['profile', 'merch', 'diary', 'plans'])
  ok(`the Menu's ${t} row`, new RegExp(`class="menurow" data-see="${t}"`).test(studio));
ok('the inbox row follows the Messages tab', /const msgAllowed=\(\)=>see\('messages'\);/.test(studio));
ok('a hidden tab is never landed on', /TAB=t;if\(PRACTICE&&t!=='live'\)practiceEnd\(true\);\n  if\(shut\(TABAREA\[t\]\)\)TAB=t='live';/.test(studio) &&
   /if\(shut\(TABAREA\[TAB\]\)\)\{ TAB='live';/.test(studio));
for (const [fn, tab] of [['loadGigs', 'gigs'], ['loadRev', 'money'], ['loadHist', 'money'], ['loadFeature', 'gigs'], ['loadPitches', 'gigs'],
                         ['loadMerch', 'merch'], ['loadOrders', 'merch'], ['loadWishes', 'merch'], ['loadDiary', 'diary'], ['loadComm', 'profile']])
  ok(`${fn} never asks for a ${tab} read the plan has refused`, new RegExp(`async function ${fn}\\(force\\)\\{(?:[^\\n]*\\n){0,2}[^\\n]*if\\(shut\\('${tab}'\\)\\)return;`).test(studio));
ok('the Live tab shows no money to a seat without the Money tab', count(/\$\{D\.money===false\?/g) === 3);

console.log('\nEVERY EDIT CARRIES ITS TAB  (a data-act that only ever changes something)');
for (const [act, tab] of [['edit', 'setlist'], ['del', 'setlist'], ['wdone', 'setlist'], ['wdel', 'setlist'], ['luse', 'setlist'], ['lpick', 'setlist'],
                          ['lrename', 'setlist'], ['ldel', 'setlist'], ['ltoggle', 'setlist'], ['gigedit', 'gigs'], ['gigskip', 'gigs'], ['gighide', 'gigs'],
                          ['mup', 'profile'], ['mdn', 'profile'], ['mrm', 'profile'], ['tourpick', 'profile'], ['tourclear', 'profile'], ['tourlink', 'profile'],
                          ['msgmove', 'messages'], ['msgunread', 'messages']]) {
  const all = count(new RegExp(`data-act="${act}"`, 'g')), marked = count(new RegExp(`data-ed="${tab}" data-act="${act}"`, 'g'));
  ok(`data-act="${act}" ×${all}, every one data-ed="${tab}"`, all > 0 && all === marked, { all, marked });
}
ok('a calendar day opens a new gig only for a seat that can add one', /\$\{edit\('gigs'\)\?`data-act="calday" data-id="\$\{c\.date\}"`:''\}/.test(studio));
ok('a night\'s name renames only with Money edit', /const histName=\(id,title\)=>!edit\('money'\)\?/.test(studio));
ok('the photo slot\'s ✕ carries the tab of the slot', /class="rm" data-ed="\$\{area\}" data-act="photoclear"/.test(studio));
for (const [what, re] of [
  ['Add a song and Import', /<div class="wrap" style="padding-top:18px" data-ed="setlist">\n      <div class="setlist-tools">/],
  ['Auto-tag', /<button data-ed="setlist" onclick="confirmAutoTag\(\)">/],
  ['Clear setlist', /<div class="wrap" style="padding-top:18px;padding-bottom:8px" data-ed="setlist">\n      <button class="big alt"[^\n]*\n[^\n]*clearSetlist/],
  ['Add a gig', /data-ed="gigs">\n        <button class="big bigplay" onclick="openGig\(\)">/],
  ['Save profile, both', /data-ed="profile"><button class="big mid" onclick="saveProfile\(\)">Save profile/g],
  ['a fan post\'s Reply, Pin and Hide', /padding-top:6px" data-ed="profile">\n        <button class="act" onclick="replyPost\(/],
  ['an item\'s ↑ ↓ Edit ✕', /flex:1 1 100%" data-ed="merch">\n        <button class="act" onclick="merchMoveItem\(/],
  ['+ Add an item', /data-ed="merch"><button class="big alt" onclick="openMerch\(''\)">/],
  ['an order\'s Done', /data-ed="merch" onclick="orderDone\(/],
  ['a shop request\'s Done', /data-ed="merch" onclick="wishDone\(/],
  ['a diary page\'s ↑ ↓ Edit ✕', /flex:1 1 100%" data-ed="diary">\n        <button class="act" onclick="diaryMoveItem\(/],
  ['+ Write a page', /data-ed="diary"><button class="big alt" onclick="openDiaryPage\(''\)">/],
  ['the reply box and Send', /<div class="field" data-ed="messages"><label>Your reply/],
  ['Re-check the money in Stripe', /data-ed="money"><button class="big alt" data-act="recon"/],
  ['Deliver them now', /data-ed="money" onclick="recover\(\)"/],
  ['Look for missing shows, Name these from my calendar', /data-ed="money">\n          <button class="big alt" onclick="healHist\(\)">/],
  ['the room\'s settings block: gone at hidden, shown and not pressable at view', /<div data-see="settings" data-area="settings">\n    \$\{viewNote\('settings'\)\}/]])
  ok(what, Array.isArray(studio.match(re)) && (what !== 'Save profile, both' || count(re) === 2));

console.log('\nTHE OWNER\'S, WHATEVER A SEAT IS GIVEN (0dc)');
for (const [what, re] of [
  ['the earnings card', /function earningsCard\(\)\{[\s\S]{0,200}if\(!ownerSeat\(\)\) return '';/],
  ['and its ledger is never asked for', /async function loadLedger\(force\)\{\n  if\(notOwner\(\)\)return;/],
  ['Got a code?', /<div class="field" data-ed="owner"><label>Got a code\?<\/label>/],
  ['the page address', /<div class="field" data-ed="owner"><label>myset\.vip\/<\/label>/],
  ['who can sign in, sharing with venues', /<div data-ed="owner">\n    <div class="sec"><span class="kick">Who can sign in/],
  ['what venues can see', /<div data-ed="owner">\n    <div class="sec"><span class="kick">What venues can see/],
  ['Face ID', /\$\{PKSUPPORTED\?`<div class="row" data-ed="owner">/],
  ['the Studio code', /<div class="row" data-ed="owner"><div class="m"><div class="t">Studio code/],
  ['recovery codes', /<div class="row" data-ed="owner"><div class="m"><div class="t">Recovery codes/],
  ['changing the sign-in address', /<button class="act" data-ed="owner" onclick="openEmailChange\(\)">/],
  ['download my data', /<div class="row" data-ed="owner"><div class="m"><div class="t">Download my data/],
  ['sign out everywhere', /<p class="muted" data-ed="owner"[^>]*>\n        <a href="#" onclick="event\.preventDefault\(\);signOutEverywhere\(\)"/],
  ['delete my account', /<div class="list" data-ed="owner" style="margin-top:14px">\n      <div class="row"><div class="m"><div class="t">Delete my account/],
  ['the payout account', /data-ed="owner" onclick="payStart\(\)"/],
  ['the Stripe dashboard', /data-ed="owner" onclick="payDash\(\)"/],
  ['featuring a gig', /data-ed="owner" onclick="openPromote\(/],
  ['the plans sheet\'s buttons', /if\(!ownerSeat\(\)\) return '';\n    if\(RANK\[k\]>RANK\[cur\]\)/],
  ['a locked feature\'s Upgrade', /const up=!soon&&ownerSeat\(\);/],
  ['undoing a deletion', /\$\{ownerSeat\(\)\?`<button class="big" style="margin-top:12px" onclick="undelete\(\)">/],
  ['the ID check', /if\(!ownerSeat\(\)&&t\.state!=='verified'\) return '';/],
  ['the first run', /if\(!ownerSeat\(\)\)return false;   \/\/ the first run/],
  ['the checklist\'s Stripe row', /ownerSeat\(\)\?"setTab\('money'\)":''/]])
  ok(what, re.test(studio));

/* THE TRIPWIRE. Read OWNER_ONLY out of admin.mjs and auth.mjs; find every place the
   Studio sends one of those actions; the function it sits in must be one of these,
   each reached only through a gate pinned above (or a founder card, test/founderseat.mjs,
   or a return trip from Stripe the owner started). */
{
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  const listIn = (src, open, close) => { const i = src.indexOf(open); return i < 0 ? [] : [...strip(src.slice(i, src.indexOf(close, i))).matchAll(/'(\w+)'/g)].map((m) => m[1]); };
  const OWNER_ONLY = new Set([...listIn(read('netlify/functions/admin.mjs'), 'const OWNER_ONLY = new Set([', ']);'),
                              ...listIn(read('netlify/functions/auth.mjs'), 'const OWNER_ONLY = [', '];')]);
  ok('the owner-only actions are read out of admin.mjs and auth.mjs',
     ['ledger', 'promoRedeem', 'setCode', 'accountDelete', 'add', 'accessSet', 'passkeyStart'].every((a) => OWNER_ONLY.has(a)), [...OWNER_ONLY]);
  const GATED = new Set([
    'startCheckout', 'changePlan', 'retentionOffer', 'keepPlan', 'openPortal', 'openInvoices', 'handleSubReturn',   // the plans sheet, the plan box
    'redeemPromo', 'exportAccount', 'deleteAccountNow', 'undelete', 'freePageAddress', 'payStart', 'payDash', 'idPick',
    'setShare', 'saveCode', 'loadLedger', 'downloadLedger', 'payPromote', 'finishPromote', 'msgBlock', 'msgReport',
    'addTeam', 'removeTeam', 'revokeAll', 'saveSlug', 'makeRecovery', 'emailChangeStart', 'emailChangeFinish',
    'seatRole', 'seatLevel', 'addPasskey', 'loadPasskeys', 'dropPasskey',
    'loadBooks', 'booksCsv', 'saveCosts']);   // the founder's own cards (0100)
  const decls = [...studio.matchAll(/^(?:async function|function|const|let) (\w+)/gm)].map((m) => ({ name: m[1], at: m.index }));
  const within = (i) => (decls.filter((d) => d.at < i).pop() || {}).name;
  const stray = [];
  for (const a of OWNER_ONLY)
    for (const m of studio.matchAll(new RegExp(`action:[^,{}]*'${a}'|\\bq\\('${a}'\\)`, 'g')))
      if (!GATED.has(within(m.index))) stray.push(`${a} from ${within(m.index)}()`);
  eq('every owner-only action the Studio sends comes from a function behind an owner gate', stray, []);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
