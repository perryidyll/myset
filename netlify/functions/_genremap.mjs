import { GENRE_IDS } from './_lib.mjs';

/* A curated genre map, so "Auto-tag my songs" has something honest to work from.

   WHERE IT CAME FROM: a research pass over the whole starter setlist —
   62 songs — checked against how Spotify, Apple Music and Wikipedia
   actually classify each one, then adversarially reviewed by three independent
   passes (two on genre accuracy, one gigging musician on the "singalong" tag) and
   the disagreements settled on the merits. 17 objections were raised and resolved.

   `singalong` is the only judgement call in here, and it is deliberate: it means a
   bar full of half-drunk strangers knows the chorus and will shout it. The
   reviewer who checked it pushed back on the ratio — 28 of 62 carry the
   tag, above the third it was aimed at — and argued, convincingly, that this is a
   property of a working bar setlist rather than of the tagging. It was left alone.

   `originals` is NEVER in this map. It is applied at tag time, when a song's
   artist matches the artist's own name, because only they know which songs are
   theirs.

   Nothing here is authoritative and nothing is irreversible: it fills a song's
   tags in ONLY when that song has none, and every tag stays editable by hand. */

/* title|artist, both normalised. */
const BY_SONG = new Map([
  ['2009|mac miller', ["hiphop", "rnb"]],   // 2009 — Mac Miller
  ['3 am|matchbox twenty', ["rock", "acoustic"]],   // 3 AM — Matchbox Twenty
  ['aint no rest for the wicked|cage the elephant', ["rock", "blues", "indie", "singalong"]],   // Ain't No Rest For The Wicked — Cage The Elephant
  ['aint no sunshine|bill withers', ["rnb", "blues", "acoustic"]],   // Ain't No Sunshine — Bill Withers
  ['all of me|john legend', ["rnb", "pop"]],   // All Of Me — John Legend
  ['amie|pure prairie league', ["country", "rock", "acoustic"]],   // Amie — Pure Prairie League
  ['banana pancakes|jack johnson', ["acoustic", "folk", "pop"]],   // Banana Pancakes — Jack Johnson
  ['bar song|shaboozey', ["country", "hiphop", "singalong"]],   // Bar Song (Tipsy) — Shaboozey
  ['best part|daniel caesar', ["rnb", "acoustic"]],   // Best Part — Daniel Caesar
  ['better together|jack johnson', ["acoustic", "folk", "pop"]],   // Better Together — Jack Johnson
  ['blackbird|the beatles', ["acoustic", "folk"]],   // Blackbird — The Beatles
  ['brown eyed girl|van morrison', ["rock", "pop", "acoustic", "singalong"]],   // Brown Eyed Girl — Van Morrison
  ['catch and release|matt simons', ["pop", "folk", "acoustic"]],   // Catch & Release — Matt Simons
  ['chicken fried|zac brown band', ["country", "acoustic", "singalong"]],   // Chicken Fried — Zac Brown Band
  ['circles|post malone', ["pop", "rock", "singalong"]],   // Circles — Post Malone
  ['come together|the beatles', ["rock", "blues"]],   // Come Together — The Beatles
  ['crazy little thing called love|queen', ["rock", "acoustic", "singalong"]],   // Crazy Little Thing Called Love — Queen
  ['do you remember|jack johnson', ["acoustic", "folk", "pop"]],   // Do You Remember — Jack Johnson
  ['drops of jupiter|train', ["pop", "rock", "singalong"]],   // Drops Of Jupiter — Train
  ['edge of desire|john mayer', ["rock", "acoustic"]],   // Edge Of Desire — John Mayer
  ['faith|george michael', ["pop", "rock", "acoustic", "singalong"]],   // Faith — George Michael
  ['fast car|tracy chapman', ["folk", "acoustic", "singalong"]],   // Fast Car — Tracy Chapman
  ['feel it still|portugal the man', ["indie", "pop"]],   // Feel It Still — Portugal. The Man
  ['fire and rain|james taylor', ["folk", "acoustic"]],   // Fire And Rain — James Taylor
  ['follow the sun|xavier rudd', ["folk", "acoustic"]],   // Follow The Sun — Xavier Rudd
  ['free fallin|tom petty', ["rock", "acoustic", "singalong"]],   // Free Fallin' — Tom Petty (John Mayer version)
  ['gravity|john mayer', ["blues", "rock"]],   // Gravity — John Mayer
  ['hallelujah|jeff buckley', ["acoustic", "folk"]],   // Hallelujah — Jeff Buckley
  ['have you ever seen the rain|creedence clearwater revival', ["rock", "acoustic", "singalong"]],   // Have You Ever Seen The Rain — Creedence Clearwater Revival
  ['hey jude|the beatles', ["rock", "pop", "singalong"]],   // Hey Jude — The Beatles
  ['hey soul sister|train', ["pop", "acoustic", "rock", "singalong"]],   // Hey Soul Sister — Train
  ['hey there delilah|plain white ts', ["pop", "acoustic", "singalong"]],   // Hey There Delilah — Plain White T's
  ['i will follow you into the dark|death cab for cutie', ["indie", "acoustic", "folk"]],   // I Will Follow You Into The Dark — Death Cab For Cutie
  ['im yours|jason mraz', ["pop", "acoustic", "reggae", "singalong"]],   // I'm Yours — Jason Mraz
  ['imagine|john lennon', ["pop", "rock", "acoustic"]],   // Imagine — John Lennon
  ['jack and diane|john mellencamp', ["rock", "acoustic", "singalong"]],   // Jack & Diane — John Mellencamp
  ['landslide|fleetwood mac', ["rock", "folk", "acoustic", "singalong"]],   // Landslide — Fleetwood Mac
  ['margaritaville|jimmy buffett', ["country", "acoustic", "singalong"]],   // Margaritaville — Jimmy Buffett
  ['peaceful easy feeling|eagles', ["country", "rock", "acoustic"]],   // Peaceful Easy Feeling — Eagles
  ['perfect|ed sheeran', ["pop", "acoustic"]],   // Perfect — Ed Sheeran
  ['santeria|sublime', ["reggae", "rock", "acoustic", "singalong"]],   // Santeria — Sublime
  ['shape of you|ed sheeran', ["pop", "acoustic"]],   // Shape Of You — Ed Sheeran
  ['simple man|lynyrd skynyrd', ["rock", "acoustic", "singalong"]],   // Simple Man — Lynyrd Skynyrd
  ['sitting on the dock of the bay|otis redding', ["rnb", "acoustic", "singalong"]],   // Sitting On The Dock Of The Bay — Otis Redding
  ['slow dancing in a burning room|john mayer', ["blues", "rock"]],   // Slow Dancing In A Burning Room — John Mayer
  ['something like olivia|john mayer', ["rock", "blues", "acoustic"]],   // Something Like Olivia — John Mayer
  ['stick season|noah kahan', ["folk", "indie", "acoustic", "singalong"]],   // Stick Season — Noah Kahan
  ['stop this train|john mayer', ["acoustic", "folk", "pop"]],   // Stop This Train — John Mayer
  ['summer of 69|bryan adams', ["rock", "singalong"]],   // Summer Of '69 — Bryan Adams
  ['sunday morning|maroon 5', ["pop", "rnb", "jazz", "acoustic"]],   // Sunday Morning — Maroon 5
  ['sweet home alabama|lynyrd skynyrd', ["rock", "country", "singalong"]],   // Sweet Home Alabama — Lynyrd Skynyrd
  ['taylor|jack johnson', ["acoustic", "folk", "rock"]],   // Taylor — Jack Johnson
  ['tennessee whiskey|chris stapleton', ["country", "rnb", "acoustic", "singalong"]],   // Tennessee Whiskey — Chris Stapleton
  ['the joker|steve miller band', ["rock", "blues", "singalong"]],   // The Joker — Steve Miller Band
  ['this love|maroon 5', ["pop", "rock", "funk"]],   // This Love — Maroon 5
  ['until i found you|stephen sanchez', ["pop", "acoustic"]],   // Until I Found You — Stephen Sanchez
  ['vienna|billy joel', ["pop", "rock"]],   // Vienna — Billy Joel
  ['wagon wheel|darius rucker', ["country", "acoustic", "singalong"]],   // Wagon Wheel — Darius Rucker
  ['what i got|sublime', ["reggae", "rock", "acoustic", "singalong"]],   // What I Got — Sublime
  ['who says|john mayer', ["acoustic", "folk", "pop"]],   // Who Says — John Mayer
  ['why georgia|john mayer', ["pop", "rock", "acoustic"]],   // Why Georgia — John Mayer
  ['wish you were here|pink floyd', ["rock", "acoustic"]],   // Wish You Were Here — Pink Floyd
]);

/* Fallback when a song is not in the map: what this ARTIST usually is. Coarse on
   purpose — a wrong-but-plausible genre is worse than a broad-but-true one. */
const BY_ARTIST = new Map([
  ['adele', ["pop", "rnb"]],
  ['al green', ["rnb"]],
  ['amy winehouse', ["rnb", "jazz"]],
  ['arctic monkeys', ["rock", "indie"]],
  ['bb king', ["blues"]],
  ['ben harper', ["blues", "folk", "acoustic"]],
  ['billie eilish', ["pop", "indie"]],
  ['blink 182', ["rock"]],
  ['bob marley', ["reggae"]],
  ['bob marley and the wailers', ["reggae"]],
  ['bruce springsteen', ["rock"]],
  ['bruno mars', ["pop", "rnb", "funk"]],
  ['buena vista social club', ["latin", "jazz"]],
  ['carlos santana', ["latin", "rock"]],
  ['cat stevens', ["folk", "acoustic"]],
  ['chris stapleton', ["country", "blues"]],
  ['coldplay', ["rock", "pop"]],
  ['creedence clearwater revival', ["rock", "blues"]],
  ['dolly parton', ["country"]],
  ['drake', ["hiphop", "rnb"]],
  ['dua lipa', ["pop"]],
  ['eagles', ["rock", "country"]],
  ['ed sheeran', ["pop", "acoustic"]],
  ['eminem', ["hiphop"]],
  ['eric clapton', ["blues", "rock"]],
  ['fleetwood mac', ["rock", "folk"]],
  ['frank sinatra', ["jazz", "pop"]],
  ['george ezra', ["pop", "folk"]],
  ['gipsy kings', ["latin"]],
  ['green day', ["rock"]],
  ['harry styles', ["pop", "rock"]],
  ['hozier', ["rock", "blues", "indie"]],
  ['jack johnson', ["acoustic", "folk", "pop"]],
  ['james bay', ["rock", "acoustic"]],
  ['james taylor', ["folk", "acoustic"]],
  ['jimmy buffett', ["country", "pop"]],
  ['john denver', ["country", "folk", "acoustic"]],
  ['john mayer', ["rock", "acoustic", "blues"]],
  ['johnny cash', ["country", "folk"]],
  ['kendrick lamar', ["hiphop"]],
  ['kings of leon', ["rock", "indie"]],
  ['led zeppelin', ["rock", "blues"]],
  ['luke combs', ["country"]],
  ['lynyrd skynyrd', ["rock", "country"]],
  ['maroon 5', ["pop", "rnb"]],
  ['marvin gaye', ["rnb"]],
  ['morgan wallen', ["country"]],
  ['mumford and sons', ["folk", "rock"]],
  ['nat king cole', ["jazz"]],
  ['neil young', ["rock", "folk"]],
  ['nirvana', ["rock", "indie"]],
  ['noah kahan', ["folk", "indie", "acoustic"]],
  ['norah jones', ["jazz", "folk"]],
  ['oasis', ["rock", "indie"]],
  ['otis redding', ["rnb"]],
  ['passenger', ["folk", "acoustic"]],
  ['pink floyd', ["rock"]],
  ['post malone', ["pop", "hiphop"]],
  ['queen', ["rock", "pop"]],
  ['radiohead', ["rock", "indie"]],
  ['ray charles', ["rnb", "blues"]],
  ['red hot chili peppers', ["rock", "funk"]],
  ['sam smith', ["pop", "rnb"]],
  ['simon and garfunkel', ["folk", "acoustic"]],
  ['stevie wonder', ["rnb", "funk"]],
  ['sublime', ["reggae", "rock"]],
  ['taylor swift', ["pop", "country"]],
  ['the beatles', ["rock", "pop"]],
  ['the black keys', ["rock", "blues"]],
  ['the killers', ["rock", "indie"]],
  ['the lumineers', ["folk", "indie"]],
  ['tom petty', ["rock"]],
  ['tom petty and the heartbreakers', ["rock"]],
  ['vance joy', ["indie", "acoustic", "pop"]],
  ['xavier rudd', ["folk", "acoustic", "reggae"]],
  ['zac brown band', ["country"]],
]);

export const normKey = (v) => String(v == null ? '' : v)
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[\u2019']/g, '')
  .replace(/\(.*?\)/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

/** Genres for one song. `owner` is the artist's own name, so their songs get
 *  `originals`. Returns [] when we genuinely have no idea — better than a guess. */
export function genresFor(title, artist, owner) {
  const t = normKey(title), a = normKey(artist), o = normKey(owner);
  const out = [];

  // their own song: only they can know this, so it is decided by the name, not a map
  if (o && a && (a === o || a.startsWith(o + ' ') || o.startsWith(a + ' '))) out.push('originals');

  const hit = BY_SONG.get(`${t}|${a}`)
    // same title, different credited artist (a cover, or "(John Mayer version)")
    || [...BY_SONG.entries()].find(([k]) => k.startsWith(t + '|'))?.[1]
    || BY_ARTIST.get(a);

  for (const g of hit || []) if (GENRE_IDS.has(g) && !out.includes(g)) out.push(g);
  return out.slice(0, 6);
}

export const MAP_SIZE = BY_SONG.size;
export const ARTIST_HINTS = BY_ARTIST.size;
