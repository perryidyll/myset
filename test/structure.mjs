/* Structure check. Both studio pages are one big render() of `if(TAB===…)` blocks,
   and a bad edit once deleted two of them while leaving valid JavaScript behind —
   so `node --check` passed and two tabs rendered blank.

   Note the `\{\n`: `if(TAB==='gigs'){` also appears in load() as a lazy-load
   trigger, on one line. Matching the brace-then-newline counts only the render
   blocks. A case-sensitive innerText check has bitten this before too — CSS
   `text-transform` means the DOM text is not what the source says. */
import { readFileSync } from 'node:fs';
import { src } from './_src.mjs';
import { PAIRS, stampOf, stampRe } from '../tools/stamp.mjs';
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
/* /studio.js, /venue-studio.js, /biz.js and /studio-money.js are served immutable
   for a year, addressed by their own hash. A stale stamp means a phone keeps
   running last week's Studio under this week's shell. The pairs come from
   tools/stamp.mjs itself, in its order, so the test and the tool cannot drift. */
{
  for (const [page, js] of PAIRS) {
    const want = stampOf(readFileSync(new URL('../public/' + js, import.meta.url), 'utf8'));
    const html = readFileSync(new URL('../' + page, import.meta.url), 'utf8');
    const have = (html.match(stampRe(js)) || ['', ''])[0].slice(-8);
    const okStamp = have === want;
    console.log(`  ${okStamp ? '✓' : '✗'} ${js} stamp in ${page} ${okStamp ? 'matches' : `is ${have || 'missing'}, file is ${want} — run: node tools/stamp.mjs`}`);
    if (!okStamp) fail++;
    if (!page.endsWith('.html')) continue;
    const inline = (html.match(/<script>/g) || []).length;
    const okInline = inline <= 3;
    console.log(`  ${okInline ? '✓' : '✗'} ${page} keeps only its small inline scripts (${inline})`);
    if (!okInline) fail++;
  }
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
