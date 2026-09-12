import { json } from './_lib.mjs';
import { readArtists } from './_auth.mjs';
import { getProfile } from './_profile.mjs';
import { readEvents, occurrencesFor } from './_events.mjs';
import { addDays, localDate } from './_time.mjs';
import { readHistIndex } from './_history.mjs';
import { readPosts } from './_community.mjs';
import { planOf } from './_plan.mjs';
import { mapLinks, resolveShortMapPlace } from './_maps.mjs';

/* Public artist directory. Only fields already intended for public profiles and
   calendars leave this endpoint; account emails, roles and billing never do. */
export default async (req) => {
  const wantsMaps = !!(req && new URL(req.url).searchParams.get('maps'));
  const registry = await readArtists();
  /* Find artists is a trust surface, not the complete account registry. The same
     effective verification rule as the public badge applies: the review flag and
     a current paid plan. Filtering before profile/calendar reads also means an
     unverified account cannot leak into either cards or the map event list. */
  const entries = Object.entries(registry.byId || {}).filter(([, artist]) =>
    artist && !artist.del && artist.slug && artist.verified && planOf(artist) !== 'free');
  const now = Date.now();
  const artists = [];

  /* Small batches avoid turning a growing directory into a burst against Blobs. */
  for (let i = 0; i < entries.length; i += 12) {
    const batch = await Promise.all(entries.slice(i, i + 12).map(async ([artistId, artist]) => {
      const [profile, events, history, posts] = await Promise.all([
        getProfile(artistId), readEvents(artistId), readHistIndex(artistId), readPosts(artistId),
      ]);
      const tz = ((events.list || []).find((event) => event.tz) || {}).tz || 'UTC';
      const today = localDate(now, tz);
      const gigs = occurrencesFor(events, today, addDays(today, 365)).filter((gig) => gig.endsAt > now);
      /* Today plus the following 29 local calendar days is exactly 30 dates.
         occurrencesFor is inclusive at both ends. */
      const shows30 = occurrencesFor(events, today, addDays(today, 29)).filter((gig) => gig.endsAt > now);
      const mapReady30 = wantsMaps ? await Promise.all(shows30.map(async (gig) => {
        const place = await resolveShortMapPlace({
          address: gig.address, mapUrl: gig.mapUrl,
          lat: gig.maps && gig.maps.lat, lng: gig.maps && gig.maps.lng,
        });
        if (!place.address || place.address === gig.address) return gig;
        return { ...gig, address: place.address,
          maps: mapLinks({ ...place, city: gig.city, country: gig.country }, gig.venue) };
      })) : shows30;
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
        signed: !!(profile.management && profile.managementUrl)
          && !/^(independent|unsigned|self[- ]managed)$/i.test(profile.management.trim()),
        musicReleased,
        showsNext30Days: shows30.length,
        totalShows: (history.shows || []).length,
        rating,
        ratingCount: ratings.length,
        locations: [...locationMap.values()],
        eventsNext30Days: mapReady30.map((gig) => ({
          eventId: gig.eventId, date: gig.date, time: gig.time, tz: gig.tz, startsAt: gig.startsAt,
          venue: gig.venue || '', city: gig.city || '', country: gig.country || '',
          address: gig.address || '', maps: gig.maps || null,
        })),
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
