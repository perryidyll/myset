/* VOTING DEFAULTS AND THE STORED-DOCUMENT TRAP.

   Every show stores freeCredits and packs. Changing defaultShow() therefore does
   nothing to an existing artist: their document keeps the former defaults and the
   public endpoint keeps serving them. This suite starts with raw legacy documents
   so the migration cannot pass merely because a fresh fixture got fresh defaults. */
const {
  DEFAULT_FREE_CREDITS, DEFAULT_PACKS, VOTE_DEFAULTS_VERSION,
  KEY, casDoc, defaultShow, getShow, mutateShow, readDoc,
} = await import('../netlify/functions/_lib.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const seed = (aid, values) => casDoc(KEY.show(aid), () => ({}), (show) => {
  Object.assign(show, { artist: 'Test Artist', songs: [], played: [], ...values });
  delete show.voteDefaultsVersion;
  return true;
});

console.log('\nFRESH ROOMS USE THE CURRENT DEFAULTS');
const fresh = defaultShow();
eq('one free vote (decision 0172)', fresh.freeCredits, 1);
eq('a song costs one vote', fresh.songCost, 1);
eq('3 for $5 and 15 for $20', fresh.packs, {
  small: { votes: 3, cents: 500 }, big: { votes: 15, cents: 2000 },
});
eq('and the defaults carry their schema version', fresh.voteDefaultsVersion, VOTE_DEFAULTS_VERSION);
eq('the exported values agree with the show',
   [DEFAULT_FREE_CREDITS, DEFAULT_PACKS()], [fresh.freeCredits, fresh.packs]);

console.log('\nAN EXISTING ROOM ON THE FORMER DEFAULTS MIGRATES ON READ');
await seed('legacy-defaults', {
  freeCredits: 5,
  packs: { small: { votes: 5, cents: 500 }, big: { votes: 15, cents: 1000 } },
});
const migrated = await getShow('legacy-defaults');
eq('five becomes one globally', migrated.freeCredits, 1);
eq('both former packs become the current defaults', migrated.packs, fresh.packs);
eq('the normalized room is marked current', migrated.voteDefaultsVersion, VOTE_DEFAULTS_VERSION);

console.log('\nA VERSION-2 ROOM STILL ON THREE MOVES TO ONE (decision 0172)');
await seed('v2-three', { freeCredits: 3 });
await casDoc(KEY.show('v2-three'), () => ({}), (show) => { show.voteDefaultsVersion = 2; return true; });
eq('three becomes one', (await getShow('v2-three')).freeCredits, 1);
await seed('v2-eight', { freeCredits: 8 });
await casDoc(KEY.show('v2-eight'), () => ({}), (show) => { show.voteDefaultsVersion = 2; return true; });
eq('a version-2 room on eight keeps eight', (await getShow('v2-eight')).freeCredits, 8);
await mutateShow('v2-three', (show) => { show.freeCredits = 3; return true; });
eq('choosing three after migration stays three', (await getShow('v2-three')).freeCredits, 3);

console.log('\nNON-DEFAULT ARTIST CHOICES SURVIVE');
await seed('legacy-custom', {
  freeCredits: 8,
  packs: { small: { votes: 4, cents: 600 }, big: { votes: 20, cents: 2500 } },
});
const custom = await getShow('legacy-custom');
eq('a custom free allowance is preserved', custom.freeCredits, 8);
eq('custom packs are preserved', custom.packs, {
  small: { votes: 4, cents: 600 }, big: { votes: 20, cents: 2500 },
});

console.log('\nA LATER PAID SETTING IS NOT MIGRATED A SECOND TIME');
await mutateShow('legacy-defaults', (show) => {
  show.freeCredits = 5;
  show.packs = { small: { votes: 5, cents: 500 }, big: { votes: 15, cents: 1000 } };
  return true;
});
const chosen = await getShow('legacy-defaults');
eq('choosing five after migration stays five', chosen.freeCredits, 5);
eq('choosing the former pack values after migration also sticks', chosen.packs, {
  small: { votes: 5, cents: 500 }, big: { votes: 15, cents: 1000 },
});
const stored = (await readDoc(KEY.show('legacy-defaults'), null)).data;
eq('the version was persisted with that choice', stored.voteDefaultsVersion, VOTE_DEFAULTS_VERSION);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
