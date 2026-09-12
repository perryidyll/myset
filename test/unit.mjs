import { playable, votable, inPlay, rankSongs, newShowId } from '../netlify/functions/_lib.mjs';
import { shapeLists } from '../netlify/functions/_lists.mjs';
import { findUltimateGuitarLink, ultimateGuitarSearch } from '../netlify/functions/_chords.mjs';
import { addressFromMapUrl, resolveShortMapPlace } from '../netlify/functions/_maps.mjs';

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, '\n      got ', a, '\n      want', b); }
};

const S = (id, extra = {}) => ({ id, title: id, ...extra });
const base = (o = {}) => ({
  songs: [S('a'), S('b'), S('c'), S('d', { active: false })],
  played: [], nowPlaying: null, listId: '', listName: '', listSongs: [], ...o,
});

console.log('\nvotable(): the ONE definition of what the room can vote for');
{
  const sh = base();
  const v = votable(sh);
  eq('no setlist: every live song', sh.songs.filter(v).map(x => x.id), ['a','b','c']);
  eq('a hidden song is never votable', v(S('d', { active: false })), false);
}
{
  const sh = base({ listId: 'l1', listSongs: ['a','b'] });
  const v = votable(sh);
  eq('setlist narrows to its members', sh.songs.filter(v).map(x => x.id), ['a','b']);
}
{
  // c is outside the set but has been PLAYED — a replay vote must stay possible
  const sh = base({ listId: 'l1', listSongs: ['a','b'], played: ['c'] });
  const v = votable(sh);
  eq('a played song outside the set is still votable', sh.songs.filter(v).map(x => x.id), ['a','b','c']);
  eq('inPlay alone would have excluded it', inPlay(sh)('c'), false);
}
{
  // the fallback: a selected list with nothing in it
  const sh = base({ listId: 'l1', listSongs: [] });
  eq('empty set falls back to the library', playable(sh).songs.map(x => x.id), ['a','b','c']);
  eq('and says so', playable(sh).fellBack, true);
  eq('votable follows the fallback', sh.songs.filter(votable(sh)).map(x => x.id), ['a','b','c']);
}

console.log('\nplayTop pool: votable(), then its own replay narrowing');
const playTopPool = (sh, counts) => rankSongs(
  sh.songs.filter(votable(sh))
    .filter((s) => s.id !== sh.nowPlaying)
    .filter((s) => !sh.played.includes(s.id) || (counts[s.id] || 0) > 0)
    .filter((s) => (counts[s.id] || 0) > 0),
  counts, {}).map(x => x.id);
{
  const sh = base({ listId: 'l1', listSongs: ['a','b'], played: ['c'] });
  eq('THE BUG: a replay vote outside the set can win', playTopPool(sh, { c: 9, a: 1 }), ['c','a']);
  eq('with no replay votes, c stays out', playTopPool(sh, { a: 1 }), ['a']);
  eq('with no votes, nothing is called top voted', playTopPool(sh, {}), []);
  const old = rankSongs(playable(sh).songs
    .filter((s) => s.id !== sh.nowPlaying)
    .filter((s) => !sh.played.includes(s.id) || ({ c: 9, a: 1 }[s.id] || 0) > 0), { c: 9, a: 1 }, {}).map(x => x.id);
  eq('the old pool could not see it at all', old.includes('c'), false);
}
{
  const sh = base({ nowPlaying: 'a' });
  eq('never re-picks what is playing', playTopPool(sh, {}).includes('a'), false);
}

console.log('\nStudio client pools mirror the server flag');
{
  const sh = base({ listId: 'l1', listSongs: ['a','b'], played: ['c'] });
  const counts = { c: 9, a: 1 };
  const canVoteSrv = votable(sh);
  const songs = rankSongs(sh.songs.map(x => ({
    ...x, votes: counts[x.id] || 0,
    played: sh.played.includes(x.id), now: sh.nowPlaying === x.id,
    inSet: new Set(playable(sh).songs.map(s => s.id)).has(x.id),
    votable: canVoteSrv(x),
  })), counts, {});
  // the exact expressions from studio.html render()
  const canVote = x => x.active !== false && x.votable !== false;
  const startPool = songs.filter(x => !x.now && canVote(x) && (!x.played || x.votes > 0) && x.votes > 0);
  eq('client "Start top voted" == server playTop', startPool[0].id, playTopPool(sh, counts)[0]);
  const pool = songs.filter(x => !x.now && canVote(x) && (!x.played || x.votes > 0));
  eq('client queue holds votable songs plus a voted replay', pool.map(x => x.id), ['c','a','b']);
  eq('an out-of-set song is labelled', songs.find(x => x.id === 'c').inSet, false);
}
{
  /* A page loaded before this deploy gets a payload with no `votable` field. It
     must degrade to the OLD behaviour (whole library) rather than show an empty
     queue on stage. 'c' here is outside the set and unplayed, which is exactly the
     song the flag hides and its absence must not. */
  const sh = base({ listId: 'l1', listSongs: ['a','b'] });
  const canVoteSrv = votable(sh);
  const mk = (withFlag) => sh.songs.map(x => ({
    ...x, votes: 0, played: false, now: false,
    ...(withFlag ? { votable: canVoteSrv(x) } : {}),
  }));
  const canVote = x => x.active !== false && x.votable !== false;
  eq('with the flag, out-of-set is hidden', mk(true).filter(canVote).map(x => x.id), ['a','b']);
  eq('without it, the old behaviour', mk(false).filter(canVote).map(x => x.id), ['a','b','c']);
}

console.log('\nshapeLists: two numbers that mean two different things');
{
  const show = { songs: [S('a'), S('b'), S('c', { active: false })], listId: 'l1' };
  const d = { lists: [{ id: 'l1', name: 'Late set', songs: ['a','c','gone'], at: 1 }] };
  const [l] = shapeLists(d, show);
  eq('songs = still in the library (the picker ticks)', l.songs, ['a','c']);
  eq('count = in play, matching playable()', l.count, 1);
  const sh2 = { songs: show.songs, listId: 'l1', listSongs: ['a','c'], played: [] };
  eq('and it agrees with playable()', playable(sh2).songs.length, l.count);
  eq('active flag', l.active, true);
}

console.log('\nC002  a show id is unique per tap, not per minute');
{
  const t = Date.UTC(2026, 8, 1, 14, 30, 0);
  // THE BUG: minute granularity and nothing else, so two taps in the same minute
  // gave the second show the first's history row and money attribution.
  eq('two ids in the same minute differ', newShowId(t, 0.11) === newShowId(t, 0.87), false);
  eq('the readable prefix survives', newShowId(t, 0.11).startsWith('2026-09-01-1430-'), true);
  const many = new Set(Array.from({ length: 400 }, (_, i) => newShowId(t, i / 400)));
  eq('400 draws, 400 distinct ids', many.size, 400);
  eq('deterministic for a given draw', newShowId(t, 0.5), newShowId(t, 0.5));
}

console.log('\nUltimate Guitar direct-link resolver');
{
  const html = `&quot;song_name&quot;:&quot;Blackbird&quot;,&quot;artist_name&quot;:&quot;The Beatles&quot;,&quot;type&quot;:&quot;Chords&quot;,&quot;tab_url&quot;:&quot;https://tabs.ultimate-guitar.com/tab/the-beatles/blackbird-chords-168749&quot;`;
  eq('an exact title and artist resolve to the direct Chords page',
    findUltimateGuitarLink(`{&quot;id&quot;:1,${html}}`, 'Blackbird', 'Beatles'),
    'https://tabs.ultimate-guitar.com/tab/the-beatles/blackbird-chords-168749');
  eq('a different artist is never guessed',
    findUltimateGuitarLink(`{&quot;id&quot;:1,${html}}`, 'Blackbird', 'Sarah McLachlan'), null);
  eq('the fallback stays a filtered provider search',
    ultimateGuitarSearch('Blackbird', 'The Beatles').includes('search_type=title&value=Blackbird%20The%20Beatles'), true);
}

console.log('\nGoogle Maps short-link resolver');
{
  const full = 'https://maps.google.com?q=145,+The+Ugly+Duckling,+2+Taladkao+Rd,+Ko+Pha-ngan,+Thailand&ftid=place';
  eq('the exact address is read from a safe Google redirect', addressFromMapUrl(full),
    '145, The Ugly Duckling, 2 Taladkao Rd, Ko Pha-ngan, Thailand');
  const place = await resolveShortMapPlace({ mapUrl: 'https://maps.app.goo.gl/unit-test-ugly-duckling' },
    async () => new Response(null, { status: 302, headers: { location: full } }));
  eq('a short share link becomes a place the interactive map can geocode', place.address,
    '145, The Ugly Duckling, 2 Taladkao Rd, Ko Pha-ngan, Thailand');
  const checked = await resolveShortMapPlace({ address: 'Wrong Road, Amsterdam',
      mapUrl: 'https://maps.app.goo.gl/unit-test-address-check' },
    async () => new Response(null, { status: 302, headers: { location: full } }));
  eq('the exact Google place corrects a conflicting typed address', checked.address,
    '145, The Ugly Duckling, 2 Taladkao Rd, Ko Pha-ngan, Thailand');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
