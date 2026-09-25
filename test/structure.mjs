/* Structure check. Both studio pages are one big render() of `if(TAB===…)` blocks,
   and a bad edit once deleted two of them while leaving valid JavaScript behind —
   so `node --check` passed and two tabs rendered blank.

   Note the `\{\n`: `if(TAB==='gigs'){` also appears in load() as a lazy-load
   trigger, on one line. Matching the brace-then-newline counts only the render
   blocks. A case-sensitive innerText check has bitten this before too — CSS
   `text-transform` means the DOM text is not what the source says. */
import { readFileSync, readdirSync } from 'node:fs';
import { src } from './_src.mjs';
import { PAIRS, FANPAGES, stampOf, stampRe } from '../tools/stamp.mjs';
let fail = 0;
const check = (file, needles) => {
  const s = src(new URL('../' + file, import.meta.url));
  for (const [label, pat, want = 1] of needles) {
    const n = (s.match(pat) || []).length;
    if (n !== want) { fail++; console.log(`  ✗ ${file}: ${label} appears ${n}×, expected ${want}`); }
    else console.log(`  ✓ ${file}: ${label}`);
  }
};
check('public/studio.html', [
  ["render: tab 'live'",     /if\(TAB==='live'\)\{\n/g],
  ["render: tab 'setlist'",  /if\(TAB==='setlist'\)\{\n/g],
  ["render: tab 'gigs'",     /if\(TAB==='gigs'\)\{\n/g],
  ["render: tab 'money'",    /if\(TAB==='money'\)\{\n/g],
  ["render: tab 'profile'",  /if\(TAB==='profile'\)\{\n/g],
  ["render: tab 'merch'",    /if\(TAB==='merch'\)\{\n/g],      // the Merch store is its own screen again (2026-09-13)
  ["render: tab 'settings'", /if\(TAB==='settings'\)\{\n/g],
  ['function render',   /\nfunction render\(\)\{/g],
  // the Studio's tabs moved to a fixed bottom bar on 2026-09-12: no sticky offset to measure, so fitTabs is gone
  ['function fitTabs',  /\nfunction fitTabs\(\)\{/g, 0],
  ['function tabBar',   /\nfunction tabBar\(\)\{/g],
  ['function setPick',  /\nfunction setPick\(\)\{/g],
  ['const setName',     /\nconst setName=/g],
  // the flags the server produces must have a consumer — a producer with no
  // consumer is how the Studio's queue drifted from playTop in the first place
  ['consumes votable',        /x\.votable!==false/g],
  ['consumes inSet (rows)',   /x\.inSet===false\?'Not in this set'/g],
  ['consumes inSet (toast)',  /sg\.inSet===false/g],
  ['sticky offset measured',  /top:var\(--headh/g, 0],   // see the fitTabs row: the bar is fixed at the bottom now
  /* C001: a dropped poll must not gate the artist out mid-gig (INVARIANT 16).
     Both halves are needed — the flag without the guard, or the guard without the
     flag, silently restores the old behaviour. */
  ['offline flag set in api()',      /offline:true/g],
  ['offline guard in load()',        /if\(!d\.ok&&d\.offline&&D\) return;/g],
  /* C017/C041: after an end, starting again must be an explicit choice between a new
     show and resuming — the server cannot tell a deliberate end from a fat finger. */
  ['start-a-new-show choice',        /Start a new show/g],
  ['resume-it-instead escape',       /Resume it instead/g],
  ['gig setlist select',      /id="gList"/g],
  ['gig "All songs" option',  /value="all"/g],
]);
/* A prose row must not be a flex container — see the .row.muted note in the CSS. */
check('public/studio.html', [['prose rows opt out of flex', /\.row\.muted\{display:block\}/g]]);
check('public/venue-studio.html', [
  ['prose rows opt out of flex', /\.row\.muted\{display:block\}/g],
  // the Venue Studio's tabs moved to the same fixed bottom bar on 2026-09-12: nothing to measure, so fitTabs and --headh are gone
  ['function fitTabs',       /\nfunction fitTabs\(\)\{/g, 0],
  ['function tabBar',        /\nfunction tabBar\(\)\{/g],
  ['sticky offset measured', /top:var\(--headh/g, 0],
]);
/* /studio.js, /venue-studio.js, /biz.js, /studio-money.js and /fan.js are served
   immutable for a year, addressed by their own hash. A stale stamp means a phone
   keeps running last week's script under this week's page. The pairs come from
   tools/stamp.mjs itself, in its order, so the test and the tool cannot drift. The
   inline-script count is the Studios' check only: a fan page keeps its own script
   inline on purpose and loads fan.js beside it. */
{
  for (const [page, js] of PAIRS) {
    const want = stampOf(readFileSync(new URL('../public/' + js, import.meta.url), 'utf8'));
    const html = readFileSync(new URL('../' + page, import.meta.url), 'utf8');
    const have = (html.match(stampRe(js)) || ['', ''])[0].slice(-8);
    const okStamp = have === want;
    console.log(`  ${okStamp ? '✓' : '✗'} ${js} stamp in ${page} ${okStamp ? 'matches' : `is ${have || 'missing'}, file is ${want} — run: node tools/stamp.mjs`}`);
    if (!okStamp) fail++;
    if (!page.endsWith('.html') || js === 'fan.js') continue;
    const inline = (html.match(/<script>/g) || []).length;
    const okInline = inline <= 3;
    console.log(`  ${okInline ? '✓' : '✗'} ${page} keeps only its small inline scripts (${inline})`);
    if (!okInline) fail++;
  }
}
/* THE FAN PAGES' SHARED SCRIPT (decision 0087). Every top-level name in fan.js is a
   global the page's own script reads by bare name, so a page that declares one of
   them again throws at load (`const` twice in the global lexical scope) and paints
   nothing — the vote page included. So: no fan page redeclares a fan.js name; every
   fan page loads fan.js exactly once, before its own script; and every page with a
   sheet is a fan page (the shared openSheet is the only one). The copies the file
   replaced are gone by the same check — a migration that leaves the old copy beside
   the new one is the half-finished refactor this repo keeps meeting. */
{
  const fan = readFileSync(new URL('../public/fan.js', import.meta.url), 'utf8');
  const names = (s) => new Set([...s.matchAll(/^(?:async\s+)?(?:let|const|var|function|class)\s+([\w$]+)/gm)].map((m) => m[1]));
  const shared = names(fan);
  /* fan.js keeps one declaration per line so this regex sees every name; a comma list
     (`let a=0, b=0`) would hide the second one from the guard (the review of 0087). */
  const listed = (fan.match(/^(?:let|const|var)\s+[^;\n]*,\s*[A-Za-z_$][\w$]*\s*=(?!>)/gm) || []).length;
  console.log(`  ${shared.size >= 45 && !listed ? '✓' : '✗'} fan.js declares the shared names one per line (${shared.size}${listed ? `, ${listed} comma list(s)` : ''})`);
  if (shared.size < 45 || listed) fail++;
  /* On a page the name may hide anywhere: first or later in a declaration list, as var,
     as a function — any of those at the global scope throws before the page's first line. */
  const declares = (js, n) => new RegExp(`(?:^|[;,{}\\s])(?:let|const|var)\\s+(?:[^;\\n]*?,\\s*)?${n.replace(/\$/g, '\\$')}\\s*(?:=(?!>)|[;,\\n])|(?:^|[^\\w$.])(?:async\\s+)?function\\s+${n.replace(/\$/g, '\\$')}\\s*\\(|(?:^|[^\\w$.])class\\s+${n.replace(/\$/g, '\\$')}\\b`, 'm').test(js);
  for (const page of FANPAGES) {
    const html = readFileSync(new URL('../' + page, import.meta.url), 'utf8');
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
    const both = [...shared].filter((n) => declares(inline, n));
    console.log(`  ${both.length ? '✗' : '✓'} ${page} redeclares none of fan.js's names${both.length ? ' — ' + both.join(', ') : ''}`);
    if (both.length) fail++;
    const tags = (html.match(/<script src="\/fan\.js\?v=[0-9a-f]{8}"><\/script>/g) || []).length;
    const at = html.indexOf('<script src="/fan.js?v=');
    const own = html.indexOf('<script>\n', at);   // the page's own script, the first plain <script> after the tag
    const okTag = tags === 1 && at >= 0 && own > at;
    console.log(`  ${okTag ? '✓' : '✗'} ${page} loads fan.js once, before its own script`);
    if (!okTag) fail++;
  }
  for (const f of readdirSync(new URL('../public', import.meta.url)).filter((x) => x.endsWith('.html'))) {
    const html = readFileSync(new URL('../public/' + f, import.meta.url), 'utf8');
    if (!/id="sheet"/.test(html)) continue;
    const isFan = FANPAGES.includes('public/' + f), studio = /studio\.html$/.test(f);
    const ok = isFan || studio;
    console.log(`  ${ok ? '✓' : '✗'} ${f} has a sheet and ${studio ? 'is a Studio' : 'loads fan.js'}`);
    if (!ok) fail++;
  }
}
/* THE FIRST OPEN (decision 0088). Three things the speed pass measured and fixed have
   to stay fixed. (1) A picture is fetched once: a layered `background-image:
   url(small), url(original)` is not a fallback — a browser downloads every layer,
   and the artist page's thumbnails were pulling ~400 KB of originals nobody saw
   (INVARIANT 0gd). (2) Nothing blocks the head: no <script src> without `defer`
   before </head> on a fan page — pull.js in the head held every first paint for
   its own round trip. (3) The vote page paints its colours before app.css has
   arrived: its <style id="tokens"> is the top of app.css, byte for byte, and
   app.css itself is preloaded rather than render-blocking. */
{
  for (const page of FANPAGES) {
    const html = readFileSync(new URL('../' + page, import.meta.url), 'utf8');
    const layered = (html.match(/\),\s*url\(/g) || []).length;
    console.log(`  ${layered ? '✗' : '✓'} ${page} never stacks two pictures in one background${layered ? ` (${layered})` : ''}`);
    if (layered) fail++;
    const head = html.slice(0, html.indexOf('</head>'));
    const blocking = (head.match(/<script src="[^"]*"(?![^>]*\bdefer\b)[^>]*>/g) || []);
    console.log(`  ${blocking.length ? '✗' : '✓'} ${page} loads no blocking script in its head${blocking.length ? ' — ' + blocking.join(' ') : ''}`);
    if (blocking.length) fail++;
  }
  const css = readFileSync(new URL('../public/app.css', import.meta.url), 'utf8');
  const tokens = css.slice(css.indexOf(':root{'), css.indexOf('*,*::before,*::after{box-sizing:border-box}')).trimEnd();
  const vote = readFileSync(new URL('../public/vote.html', import.meta.url), 'utf8');
  const inline = (vote.match(/<style id="tokens">\n([\s\S]*?)\n<\/style>/) || ['', ''])[1];
  const sameTokens = tokens.length > 500 && inline === tokens;
  console.log(`  ${sameTokens ? '✓' : '✗'} vote.html's inline tokens are the top of app.css, byte for byte${sameTokens ? '' : ' — copy app.css from :root{ to the box-sizing line into <style id="tokens">'}`);
  if (!sameTokens) fail++;
  const async = /<link rel="preload" href="\/app\.css" as="style" onload=/.test(vote) && !/<link rel="stylesheet" href="\/app\.css">(?![\s\S]*<\/noscript>)/.test(vote.replace(/<noscript>[\s\S]*?<\/noscript>/g, ''));
  console.log(`  ${async ? '✓' : '✗'} vote.html preloads app.css instead of blocking on it`);
  if (!async) fail++;
}
/* THE DASHBOARD MODULE (decision 0065). It reads studio.js's globals by bare name
   from inside one IIFE, so a top-level name declared in both would throw at load
   (`let` twice in the global lexical scope) and take the whole Studio down. And
   has('band') is a trap: has() compares a number against the top plan and answers
   false on Bar Star, so the caps are read off PLAN.limits directly. */
{
  const money = readFileSync(new URL('../public/studio-money.js', import.meta.url), 'utf8');
  const studio = readFileSync(new URL('../public/studio.js', import.meta.url), 'utf8');
  const names = (s) => new Set([...s.matchAll(/^(?:async\s+)?(?:let|const|function|class)\s+([\w$]+)/gm)].map((m) => m[1]));
  const both = [...names(money)].filter((n) => names(studio).has(n));
  console.log(`  ${both.length ? '✗' : '✓'} studio-money.js redeclares none of studio.js's top-level names${both.length ? ' — ' + both.join(', ') : ''}`);
  if (both.length) fail++;
  const iife = /^\(\(\) => \{\n/m.test(money) && /\n\}\)\(\);\n?$/.test(money);
  console.log(`  ${iife ? '✓' : '✗'} studio-money.js is one IIFE`);
  if (!iife) fail++;
  const trap = /has\('(band|costs)'/.test(studio) || /has\('(band|costs)'/.test(money);
  console.log(`  ${trap ? '✗' : '✓'} the Studio never asks has('band') or has('costs')`);
  if (trap) fail++;
  const exposes = /window\.Money=\{tab,openBiz,reset,forget,stale/.test(money);
  console.log(`  ${exposes ? '✓' : '✗'} studio-money.js exposes window.Money = {tab, openBiz, reset, forget, stale, …}`);
  if (!exposes) fail++;
  /* The module keeps its own copy of the book (the review of 0065, C2/C4/C7): the
     sign-out and the door back in (start) must forget it, and every calendar write
     — saveGig2, delGig, skipGig, hideGig — must mark it stale, or the next paint
     shows the previous account's shows, or a calendar the server no longer has. */
  const forgets = (studio.match(/if\(window\.Money\)Money\.forget\(\)/g) || []).length;
  console.log(`  ${forgets >= 2 ? '✓' : '✗'} studio.js forgets the book on sign-out and on every door back in (${forgets} of 2)`);
  if (forgets < 2) fail++;
  const stales = (studio.match(/if\(window\.Money\)Money\.stale\(\)/g) || []).length;
  console.log(`  ${stales === 4 ? '✓' : '✗'} the four calendar writes mark the book stale (${stales} of 4)`);
  if (stales !== 4) fail++;
}
/* THE EDGE GLOW IS ONE RECIPE. The orange pulse on the right edge of a scrolling
   window is the Studio's box-shadow keyframes, and the audience's vote page carries
   a copy (it never waits on the Studio's CSS). The founder asked on 2026-09-12 for
   the two to match; a filter: drop-shadow variant on the vote page had drifted
   from it and painted differently on a phone. Byte for byte, or this fails. */
{
  const block = (file) => {
    const s = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    return (s.match(/\n@keyframes edgeGlow\{\n[\s\S]*?\n\}/) || [''])[0];
  };
  const a = block('public/studio.html'), b = block('public/vote.html');
  const same = a.length > 0 && a === b;
  console.log(`  ${same ? '✓' : '✗'} @keyframes edgeGlow is byte-identical in studio.html and vote.html${same ? '' : ' — copy the Studio\'s block over'}`);
  if (!same) fail++;
}
console.log(fail ? `\n${fail} structure check(s) FAILED` : '\nstructure OK');
process.exit(fail ? 1 : 0);
