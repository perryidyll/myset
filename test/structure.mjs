/* Structure check. Both studio pages are one big render() of `if(TAB===…)` blocks,
   and a bad edit once deleted two of them while leaving valid JavaScript behind —
   so `node --check` passed and two tabs rendered blank.

   Note the `\{\n`: `if(TAB==='gigs'){` also appears in load() as a lazy-load
   trigger, on one line. Matching the brace-then-newline counts only the render
   blocks. A case-sensitive innerText check has bitten this before too — CSS
   `text-transform` means the DOM text is not what the source says. */
import { readFileSync } from 'node:fs';
let fail = 0;
const check = (file, needles) => {
  const s = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
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
console.log(fail ? `\n${fail} structure check(s) FAILED` : '\nstructure OK');
process.exit(fail ? 1 : 0);
