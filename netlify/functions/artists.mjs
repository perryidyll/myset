import { json } from './_lib.mjs';
import { readArtists } from './_auth.mjs';
import { getProfile } from './_profile.mjs';
import { readEvents, occurrencesFor } from './_events.mjs';
import { addDays, utcToDate } from './_time.mjs';
import { readHistIndex } from './_history.mjs';
import { readPosts } from './_community.mjs';

/* Public artist directory. Only fields already intended for public profiles and
   calendars leave this endpoint; account emails, roles and billing never do. */
export default async () => {
  const registry = await readArtists();
  const entries = Object.entries(registry.byId || {}).filter(([, artist]) => artist && !artist.del && artist.slug);
  const now = Date.now();
  const today = utcToDate(now);
  const to30 = addDays(today, 30);
  const toYear = addDays(today, 365);
  const artists = [];

  /* Small batches avoid turning a growing directory into a burst against Blobs. */
  for (let i = 0; i < entries.length; i += 12) {
    const batch = await Promise.all(entries.slice(i, i + 12).map(async ([artistId, artist]) => {
      const [profile, events, history, posts] = await Promise.all([
        getProfile(artistId), readEvents(artistId), readHistIndex(artistId), readPosts(artistId),
      ]);
      const gigs = occurrencesFor(events, today, toYear).filter((gig) => gig.endsAt > now);
      const shows30 = occurrencesFor(events, today, to30).filter((gig) => gig.endsAt > now);
      const locationMap = new Map();
      for (const gig of gigs) {
        if (!gig.country || !gig.city) continue;
        locationMap.set(`${gig.country}\u001f${gig.city}`, { country: gig.country, city: gig.city });
      }
      const musicReleased = !!(
        (profile.links && (profile.links.spotify || profile.links.applemusic || profile.links.ytmusic)) ||
        (profile.management && profile.managementUrl)
      );
      const ratings = (posts.list || []).filter((post) => post && !post.hidden && Number(post.stars) >= 1 && Number(post.stars) <= 5);
      const rating = ratings.length
        ? Math.round((ratings.reduce((sum, post) => sum + Number(post.stars), 0) / ratings.length) * 10) / 10
        : null;
      const next = gigs[0] || null;
      return {
        slug: artist.slug,
        name: profile.name || artist.name || 'Artist',
        tagline: profile.tagline || '',
        avatar: profile.avatar || profile.photo || '',
        management: profile.management || '',
        style: profile.style || '',
        signed: !!profile.management && !/^(independent|unsigned|self[- ]managed)$/i.test(profile.management.trim()),
        musicReleased,
        showsNext30Days: shows30.length,
        totalShows: (history.shows || []).length,
        rating,
        ratingCount: ratings.length,
        locations: [...locationMap.values()],
        nextShow: next ? {
          date: next.date, time: next.time, venue: next.venue || '',
          city: next.city || '', country: next.country || '', startsAt: next.startsAt,
        } : null,
      };
    }));
    artists.push(...batch);
  }

  artists.sort((a, b) => a.name.localeCompare(b.name));
  return json({ ok: true, artists });
};
