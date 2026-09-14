/* CURRENT SHOW STATS — the snapshot  (_metrics.mjs, tools/metrics.mjs, decision 0071)

   What the living stats page is built from, and the rule that decides which
   nights count: a night is real when it started on a published gig, no earlier
   than ninety minutes before the slot and before the slot ended, and something
   happened in it. Everything else is a test — listed, never dropped. The snapshot
   never carries an email or a device id. */
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
const { occurrences, placeNight, artistPart, buildSnapshot, EARLY_MS } = await import('../netlify/functions/_metrics.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + ' \n      ' + JSON.stringify(detail)); } };
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });

const H = 3600e3;
const rules = [{ id: 'gsun', venue: 'Sand & Tan', date: '2026-08-30', time: '18:30', tz: 'Asia/Bangkok', repeat: { freq: 'weekly' }, durationMin: 180 }];
const slot = (date) => Date.parse(`${date}T18:30:00+07:00`);

console.log('\nWHICH NIGHTS COUNT');
const occs = occurrences(rules, slot('2026-08-30') - 10 * 86400e3, slot('2026-09-13') + 86400e3);
ok('the weekly rule expands to every Sunday in the span', occs.length >= 3 && occs.every((o) => o.eventId === 'gsun'), occs.length);
const night = (startedAt, extra = {}) => ({ showId: 's' + startedAt, startedAt, endedAt: startedAt + 2.5 * H, songsPlayed: 6, totalVotes: 20, peakVoters: 4, room: 7, nets: 5, gross: 0, ...extra });
ok('a show started 7 minutes before the slot is that gig', placeNight(night(slot('2026-09-06') - 7 * 60e3), occs) && placeNight(night(slot('2026-09-06') - 7 * 60e3), occs).date === '2026-09-06');
ok('89 minutes early is still that gig', !!placeNight(night(slot('2026-09-06') - EARLY_MS + 60e3), occs));
ok('91 minutes early is not', !placeNight(night(slot('2026-09-06') - EARLY_MS - 60e3), occs));
ok('inside the slot, an hour in, is the gig', !!placeNight(night(slot('2026-09-06') + H), occs));
ok('after the slot ended is not', !placeNight(night(slot('2026-09-06') + 3 * H + 60e3), occs));
ok('a Thursday afternoon is nobody\'s gig', !placeNight(night(Date.parse('2026-09-10T14:30:00+07:00')), occs));

console.log('\nAN ARTIST\'S PART');
const idx = { shows: [
  night(slot('2026-09-06') - 5 * 60e3, { venue: 'Sand & Tan', top: { title: 'All Of Me', votes: 3 } }),
  night(Date.parse('2026-09-10T14:30:00+07:00'), { room: 3, totalVotes: 3, songsPlayed: 3 }),
  night(slot('2026-09-13') - 60e3, { room: 0, totalVotes: 0, songsPlayed: 0, peakVoters: 0 }),   // on the gig, nothing happened
] };
const meta = { tips: [{ fan: 'DEVICE', amount: 10, at: slot('2026-09-13') + H }], paid: { cs_1: { kind: 'votes', amount: 3, granted: 5, fan: 'DEVICE', at: slot('2026-09-06') + H }, cs_2: { kind: 'tip', amount: 5, fan: 'DEVICE', at: 1 } } };
const posts = { list: [{ id: 'p1', fan: 'DEVICE', at: slot('2026-09-06') + 2 * H, stars: 5 }] };
const rsvp = { occ: { 'gsun|2026-09-13': { n: 1, fans: { abc: slot('2026-09-12') } } } };
const part = artistPart('kai', { idx, meta, posts, rsvp, ev: { list: rules } });
eq('three nights: one real, one test, one on the gig where nothing happened', part.nights.map((n) => n.real), [true, false, false]);
eq('the real night names its gig', part.nights[0].gig && part.nights[0].gig.venue, 'Sand & Tan');
eq('hours are read from the record', part.nights[0].hours, 2.5);
eq('money: the tip and the pack, never the fan; a tip in paid is not counted twice', part.money.map((m) => [m.kind, m.amount]), [['tip', 10], ['pack', 3]]);
ok('nothing in the part names a device', !JSON.stringify(part).includes('DEVICE'));
eq('posts and rsvps are timestamps only', [part.posts.length, part.rsvps.length], [1, 1]);
ok('gig occurrences for the calendar view', part.gigs.length >= 3);

console.log('\nTHE SNAPSHOT');
const snap = buildSnapshot({ registry: { byId: { kai: { slug: 'kai', name: 'Kai', plan: 'pro', createdAt: 1, verified: true } }, byEmail: { 'kai@example.com': { artistId: 'kai', role: 'owner' } } },
  venues: { byId: { v1: { slug: 'bar', name: 'The Bar', createdAt: 2 } } }, parts: { kai: { idx, meta, posts, rsvp, ev: { list: rules } } }, now: 123 });
eq('artists and venues, by count and plan, never by email', [snap.artists.length, snap.artists[0].plan, snap.venues.length, JSON.stringify(snap).includes('example.com')], [1, 'pro', 1, false]);
eq('stamped', snap.generatedAt, 123);
eq('nights in time order', snap.nights.map((n) => n.real), [true, false, false]);

console.log('\nTHE TOOL, FROM A BACKUP FOLDER');
const dir = mkdtempSync(path.join(os.tmpdir(), 'mx-')); mkdirSync(path.join(dir, 'keys'));
writeFileSync(path.join(dir, 'keys', 'artists'), JSON.stringify({ byId: { kai: { slug: 'kai', name: 'Kai', plan: 'free', createdAt: 1 } } }));
writeFileSync(path.join(dir, 'keys', 'venues'), '{"byId":{}}');
for (const [k, v] of [['histidx_kai', idx], ['meta_kai', meta], ['posts_kai', posts], ['rsvp_kai', rsvp], ['ev_kai', { list: rules }]]) writeFileSync(path.join(dir, 'keys', k), JSON.stringify(v));
const out = path.join(dir, 'page.html');
execFileSync('node', ['tools/metrics.mjs', '--from', dir, '--html', out, '--out', path.join(dir, 'snap.json')], { stdio: ['ignore', 'pipe', 'pipe'] });
const html = readFileSync(out, 'utf8');
ok('the page carries the snapshot in place of the marker', !html.includes('__SNAPSHOT__') && html.includes('"nights":[') && html.includes('Current Show Stats'));
ok('the template itself still has the marker', readFileSync('finance/metrics.html', 'utf8').includes('__SNAPSHOT__'));
eq('and the JSON file matches', JSON.parse(readFileSync(path.join(dir, 'snap.json'), 'utf8')).nights.length, 3);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
