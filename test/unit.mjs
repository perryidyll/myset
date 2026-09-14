import { playable, votable, inPlay, rankSongs, newShowId } from '../netlify/functions/_lib.mjs';
import { shapeLists } from '../netlify/functions/_lists.mjs';
import { findUltimateGuitarLink, ultimateGuitarSearch } from '../netlify/functions/_chords.mjs';
import { addressFromMapUrl, resolveShortMapPlace } from '../netlify/functions/_maps.mjs';
import { normMerch, normVariants, MAX_VARIANTS, VARIANT_LEN, MAX_POST, MAX_MERCH_IMGS, MAX_STOCK, merchSoldOut, variantSoldOut, moveMerch, takeStock, merchSlots, freeMerchSlot } from '../netlify/functions/_profile.mjs';

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

console.log('\nnormMerch(): the whitelist a shop item is — sizes, sold out, postage');
{
  const one = (extra) => normMerch([{ id: 'mabc123', title: 'Tee', ...extra }])[0];
  eq('an item without the new fields reads as none of them', [one({}).variants, one({}).out, one({}).post], [[], false, 0]);
  eq('sizes are labels with a sold-out flag, in the order given', one({ variants: [{ label: 'S' }, { label: 'M', out: true }] }).variants,
    [{ label: 'S', out: false, stock: null }, { label: 'M', out: true, stock: null }]);
  eq('de-duplicated without regard to case, trimmed, blanks dropped',
    one({ variants: [{ label: ' L ' }, { label: 'l' }, { label: '' }, { label: '   ' }, null, 7, { label: 'XL' }] }).variants.map((v) => v.label), ['L', 'XL']);
  eq('the first spelling wins a duplicate', one({ variants: [{ label: 'Large' }, { label: 'LARGE', out: true }] }).variants, [{ label: 'Large', out: false, stock: null }]);
  eq('a bare string is a label', one({ variants: ['S', 'M'] }).variants, [{ label: 'S', out: false, stock: null }, { label: 'M', out: false, stock: null }]);
  eq(`at most ${MAX_VARIANTS}`, one({ variants: Array.from({ length: 20 }, (_, i) => ({ label: 'v' + i })) }).variants.length, MAX_VARIANTS);
  eq(`each label ${VARIANT_LEN} characters`, one({ variants: [{ label: 'x'.repeat(80) }] }).variants[0].label.length, VARIANT_LEN);
  eq('inner whitespace folds to one space', one({ variants: [{ label: 'One   size\tfits' }] }).variants[0].label, 'One size fits');
  eq('`out` only when it is exactly true', [one({ out: true }).out, one({ out: 'yes' }).out, one({ out: 1 }).out, one({ out: undefined }).out], [true, false, false, false]);
  eq('a size is out only when exactly true too', one({ variants: [{ label: 'S', out: 'yes' }] }).variants[0].out, false);
  eq('postage is whole cents, never below zero', [one({ post: 600 }).post, one({ post: '600' }).post, one({ post: -5 }).post, one({ post: 'free' }).post, one({ post: 6.99 }).post], [600, 600, 0, 0, 6]);
  eq(`and never above ${MAX_POST}`, one({ post: 999999 }).post, MAX_POST);
  eq('normVariants alone takes anything and returns a list', [normVariants(null), normVariants('S'), normVariants([{ label: 'S' }])], [[], [], [{ label: 'S', out: false, stock: null }]]);
  eq('the old fields still normalise as they did', normMerch([{ id: 'mabc123', title: ' Tee ', cents: '2500', ship: 'ship', on: false, link: 'javascript:x' }])[0],
    { id: 'mabc123', title: 'Tee', blurb: '', cents: 2500, img: '', imgs: [], stock: null, link: '', ship: 'ship', on: false, at: 0, variants: [], out: false, post: 0 });
  /* THE PICTURES AND THE COUNT (2026-09-14): imgs is the swipe order, img is always imgs[0], an older
     item's one picture becomes its list; stock is null (not counting) unless a number was set. */
  const own = (k) => `/api/img?a=x&s=${k}&v=1`;
  eq('an older item’s one picture is its list', one({ img: own('mabc123') }).imgs, [own('mabc123')]);
  eq('img is always the first of imgs', one({ imgs: [own('mabc123_2'), own('mabc123')] }).img, own('mabc123_2'));
  eq('a picture that is not ours is dropped', one({ imgs: ['https://evil.example/x.jpg', own('mabc123_1')] }).imgs, [own('mabc123_1')]);
  eq('one entry per slot', one({ imgs: [own('mabc123'), '/api/img?a=x&s=mabc123&v=2'] }).imgs.length, 1);
  eq(`at most ${MAX_MERCH_IMGS} pictures`, one({ imgs: ['mabc123', 'mabc123_1', 'mabc123_2', 'mabc123_3', 'mabc123_4', 'mabc123_5', 'mabc123_6'].map(own) }).imgs.length, MAX_MERCH_IMGS);
  eq('stock: null when not counting, a whole number otherwise', [one({}).stock, one({ stock: '' }).stock, one({ stock: 12 }).stock, one({ stock: '3' }).stock, one({ stock: -4 }).stock, one({ stock: 'lots' }).stock, one({ stock: 99999 }).stock], [null, null, 12, 3, 0, null, MAX_STOCK]);
  eq('sold out is the flag or a count at zero', [merchSoldOut(one({ out: true })), merchSoldOut(one({ stock: 0 })), merchSoldOut(one({ stock: 1 })), merchSoldOut(one({}))], [true, true, false, false]);
  const list = [one({ id: 'maaaaa1' }), one({ id: 'maaaaa2' }), one({ id: 'maaaaa3' })];
  eq('moveMerch swaps neighbours', [moveMerch(list, 'maaaaa3', 'up'), list.map((m) => m.id)], [true, ['maaaaa1', 'maaaaa3', 'maaaaa2']]);
  eq('and refuses to move past an end', [moveMerch(list, 'maaaaa1', 'up'), moveMerch(list, 'maaaaa2', 'down'), moveMerch(list, 'nope', 'up')], [false, false, false]);
  const counted = [one({ id: 'maaaaa1', stock: 3 }), one({ id: 'maaaaa2' })];
  eq('takeStock comes down by the quantity, never below zero, and leaves an uncounted item alone',
    [takeStock(counted, 'maaaaa1', 2), counted[0].stock, takeStock(counted, 'maaaaa1', 5), counted[0].stock, takeStock(counted, 'maaaaa2', 1), counted[1].stock], [true, 1, true, 0, false, null]);
  /* PER-SIZE COUNTS (2026-09-14, later): blank = as many as you like while the size is in stock; a
     size at 0 is sold out; an item is sold out when every size is; the order's size takes the hit. */
  eq('a size keeps a count, blank meaning none', one({ variants: [{ label: 'S', stock: 4 }, { label: 'M', stock: '' }, { label: 'L', stock: -1 }] }).variants.map((v) => v.stock), [4, null, 0]);
  eq('a size at zero is sold out; every size at zero is the item sold out', [variantSoldOut({ label: 'S', out: false, stock: 0 }), merchSoldOut(one({ variants: [{ label: 'S', stock: 0 }, { label: 'M', out: true }] })), merchSoldOut(one({ variants: [{ label: 'S', stock: 0 }, { label: 'M' }] }))], [true, true, false]);
  const sized = [one({ id: 'maaaaa1', stock: 9, variants: [{ label: 'S', stock: 2 }, { label: 'M' }] })];
  eq('takeStock with a size takes the size’s count and leaves the item’s', [takeStock(sized, 'maaaaa1', 1, 's'), sized[0].variants[0].stock, sized[0].stock], [true, 1, 9]);
  eq('a size that is not counting falls back to the item’s count', [takeStock(sized, 'maaaaa1', 2, 'M'), sized[0].stock, sized[0].variants[1].stock], [true, 7, null]);
  eq('merchSlots is the bare id then _1.._4', merchSlots('mabc123'), ['mabc123', 'mabc123_1', 'mabc123_2', 'mabc123_3', 'mabc123_4']);
  eq('freeMerchSlot is the first slot no picture uses', [freeMerchSlot(one({ id: 'mabc123' })), freeMerchSlot(one({ id: 'mabc123', imgs: [own('mabc123'), own('mabc123_2')] })), freeMerchSlot(one({ id: 'mabc123', imgs: ['mabc123', 'mabc123_1', 'mabc123_2', 'mabc123_3', 'mabc123_4'].map(own) }))], ['mabc123', 'mabc123_1', '']);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
