/* A TRAFFIC JAM, ON EVERY SUITE RUN.

   Every other file here calls the handlers one at a time against a store that
   answers in the same tick, so a write never meets another write: casDoc's retry
   loop barely runs and "busy" never does. The 2 October 2026 scale audit found that
   was the largest thing the suite could not see — the biggest real room so far is
   18 phones — and built a simulator to look. It lives in tools/roomsim.mjs now, and
   this file runs a few rooms through it.

   Each room is its own process (the virtual clock and the store are process-wide)
   and a seeded run repeats exactly, so a number that moves here moved because the
   code did. Exactly from Node 24 on: on Node 20 and 22 the module loader's first
   use of a dynamically imported module takes a varying number of event-loop turns,
   which moves a little work from one virtual millisecond to the next. There the
   same seed gives the same outcome (every answer, every vote landed or lost), not
   the same timings, and that is what is compared.

   WHAT IS ASSERTED IS THE SHAPE, NOT THE SPEED. The store's real write time has
   never been measured (ledger P3-005); the simulator assumes 42 ms reads and 80 ms
   writes. So: a vote the fan was told landed is on the board; a vote that could not
   land was REFUSED, never dropped; nobody waits past the function limit in a room
   the product says it can hold. The times are printed for the reader and bounded
   only loosely. */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SIM = fileURLToPath(new URL('../tools/roomsim.mjs', import.meta.url));
const room = (opts) => {
  const r = spawnSync(process.execPath, ['--no-deprecation', SIM, JSON.stringify(opts)], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const line = String(r.stdout || '').split('\n').filter((l) => l.startsWith('{')).pop();
  try {
    const d = JSON.parse(line);
    const { wallSec, ...night } = d;          // how long this Mac took is not part of the night
    return { raw: JSON.stringify(night), ...d };
  } catch { return { error: 'no result', stderr: String(r.stderr || '').slice(-400) }; }
};

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const said = (d, code) => (d.vote && d.vote.status[code]) || 0;
const times = (s) => `half in ${s.p50} ms, 99 in 100 in ${s.p99} ms, slowest ${s.max} ms`;

console.log('\nA PUB: 200 PHONES, 90 VOTES IN TEN SECONDS');
const pub = room({ P: 200, burst: 90, burstSec: 10 });
ok('the room ran', !pub.error && pub.unfinished === 0 && !pub.err, pub);
ok('every vote was answered yes', said(pub, 200) === 90, pub.vote);
ok('and every one is on the board', pub.votesLanded === 90 && pub.votesLost === 0, pub);
ok('with nobody kept waiting', pub.vote.p99 < 2000, pub.vote);
console.log('    ' + times(pub.vote));
const EXACT = Number(process.versions.node.split('.')[0]) >= 24;
const outcome = (d) => JSON.stringify([d.vote && d.vote.status, d.votesLanded, d.votesLost, d.unfinished]);
const again = room({ P: 200, burst: 90, burstSec: 10 });
if (EXACT) ok('the same seed gives the same night, to the byte', again.raw === pub.raw);
else ok(`the same seed gives the same outcome (to the byte from Node 24; this is ${process.version})`, outcome(again) === outcome(pub), [outcome(again), outcome(pub)]);
ok('and another seed gives another', room({ P: 200, burst: 90, burstSec: 10, seed: 7 }).raw !== pub.raw);

console.log('\nA BIG ROOM: 5,000 PHONES, 75 VOTES A SECOND FOR 20 SECONDS');
const big = room({ P: 5000, burst: 1500, burstSec: 20 });
ok('the room ran', !big.error && big.unfinished === 0 && !big.err, big);
ok('writers really did collide — the retry loop ran', big.store.setFail > 100, big.store);
ok('every vote was answered yes', said(big, 200) === 1500, big.vote);
ok('and every one is on the board', big.votesLanded === 1500 && big.votesLost === 0, big);
ok('nobody waited past the function limit', big.vote.overTimeout === 0, big.vote);
console.log('    ' + times(big.vote) + `; each fan file is about ${big.shardKB} KB`);

console.log('\nTHE NIGHT THE SHORT RECEIPTS DEPLOY: 5,000 PHONES, A RUSH, THEN EVERY RETRY (0148)');
/* The room as it stands the moment decision 0148 deploys: every voter's receipts in
   the old long shape. A rush rewrites every file; then two hundred phones whose first
   answer was lost ask again with the same cast id. */
const deploy = room({ P: 5000, burst: 1500, burstSec: 20, oldReceipts: true, replays: 200 });
ok('the room ran', !deploy.error && deploy.unfinished === 0 && !deploy.err, deploy);
ok('every vote was answered yes, and is on the board', said(deploy, 200) === 1500 && deploy.votesLanded === 1500, deploy.vote);
ok('every file was written, and no long receipt is left in one', deploy.receipts && deploy.receipts.long === 0 && deploy.receipts.short > 0, deploy.receipts);
ok('no record keeps more receipts than it may', deploy.receipts.maxPerFan <= 20, deploy.receipts);
ok('every retry was answered from memory', deploy.replays && deploy.replays.asked === 200 && deploy.replays.fromMemory === 200, deploy.replays);
ok('and not one was cast twice', deploy.replays && deploy.replays.castTwice === 0, deploy.replays);
console.log(`    ${deploy.receipts.short} short receipts in the files; ` + times(deploy.vote));

console.log('\nTHE DOORS OPEN: 5,000 PHONES ARRIVE IN A MINUTE');
const doors = room({ P: 0, arrive: 5000, arriveSec: 60 });
ok('the room ran', !doors.error && doors.unfinished === 0 && !doors.err, doors);
ok('every phone got its page', doors.me.status[200] === 5000, doors.me);
ok('and every one was counted in the room', doors.presenceLanded === 5000, doors);
ok('nobody waited past the function limit', doors.me.overTimeout === 0, doors.me);
console.log('    ' + times(doors.me));

console.log('\nA SCRIPT ON ONE NETWORK: 5,000 FRESH IDS SAY "I\'M HERE" IN A MINUTE (0149)');
/* The count of phones a network may bring in lives in the fan file the phone lives
   in, decided in the write that stamps it — so a flood cannot get past it by jamming
   a counter, and a phone held out leaves nothing behind. */
const flood = room({ P: 0, arrive: 5000, arriveSec: 60, oneNet: true });
ok('the room ran', !flood.error && flood.unfinished === 0 && !flood.err, flood);
ok('every request got its page', flood.me.status[200] === 5000, flood.me);
ok('no more phones let in than one network may bring', flood.presenceLanded > 0 && flood.presenceLanded <= flood.netMax, flood);
ok('and the files hold no record for a phone held out', flood.newRecords === flood.presenceLanded, flood);
ok('nobody waited past the function limit', flood.me.overTimeout === 0, flood.me);
console.log(`    ${flood.presenceLanded} of 5,000 let in; ` + times(flood.me));

console.log('\nA STAMPEDE ON A SLOW STORE: 800 VOTES IN ONE SECOND, 400 MS WRITES');
const jam = room({ P: 800, votedShare: 0, burst: 800, burstSec: 1, w: 400 });
ok('the room ran', !jam.error && jam.unfinished === 0 && !jam.err, jam);
ok('some votes could not land — this is the room past its ceiling', said(jam, 503) > 0, jam.vote);
ok('each one was REFUSED, so the phone knows to ask again', said(jam, 200) + said(jam, 503) === 800, jam.vote);
ok('and not one was dropped after a yes', jam.votesLost === 0 && jam.votesLanded === said(jam, 200), jam);
console.log(`    ${said(jam, 503)} of 800 refused; ` + times(jam.vote));

console.log('\nPLAY, IN THE MIDDLE OF A RUSH');
const rush = room({ P: 5000, burst: 1000, burstSec: 20, play: true, oneSong: true });
ok('the room ran', !rush.error && rush.unfinished === 0 && !rush.err, rush);
ok('Play answered', rush.play && rush.play.code === 200, rush.play);
ok('every vote got an answer: yes, or "that one is playing"', said(rush, 200) + said(rush, 409) === 1000, rush.vote);
/* Decision 0147: a vote that read the show before Play and landed after it is
   collected by Play's own write. Before it, the audit counted 1 to 13 of these a
   Play at this size, each left on the song that had just started. The rows may
   still be in the files; the board reads them through liveFans and ignores them. */
ok('no vote is left on the song that just started (0147)', rush.strandedOnPlayedSong === 0, rush);
console.log(`    ${rush.rowsLeftInFiles} late row(s) still in the files, none counted`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
