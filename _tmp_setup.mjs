process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({
  siteID: '8f5c9f01-e1f1-47e3-add1-8dde39efd1d3',
  token: (await import('node:fs')).readFileSync(process.argv[2],'utf8').trim(),
  apiURL: 'https://api.netlify.com',
})).toString('base64');
const V = await import('./netlify/functions/_venues.mjs');
const A = await import('./netlify/functions/_auth.mjs');
const VEMAIL='probe-venue@example.com', AEMAIL='probe-artist@example.com';

if (process.argv[3] === 'up') {
  const v = await V.createVenue({ email: VEMAIL, name: 'The Ugly Duckling Irish Pub',
                                  city: 'Koh Phangan', country: 'Thailand' });
  const vreg = await V.readVenues();
  console.log('VTOKEN=' + await V.signVenueToken(VEMAIL, vreg.rev));
  console.log('VSLUG=' + v.slug);

  const a = await A.createArtist({ email: AEMAIL, name: 'Probe Artist' });
  const areg = await A.readArtists();
  console.log('ATOKEN=' + await A.signToken(AEMAIL, areg.rev));
  console.log('ASLUG=' + a.slug);
} else {
  await V.mutateVenues((r) => {
    for (const [vid, x] of Object.entries(r.byId))
      if (x.name === 'The Ugly Duckling Irish Pub') { delete r.byId[vid]; delete r.bySlug[x.slug]; }
    delete r.byEmail[VEMAIL];
    return true;
  });
  await A.mutateArtists((r) => {
    for (const [aid, x] of Object.entries(r.byId))
      if (x.name === 'Probe Artist') { delete r.byId[aid]; delete r.bySlug[x.slug]; }
    delete r.byEmail[AEMAIL];
    return true;
  });
  const { store } = await import('./netlify/functions/_lib.mjs');
  for (const k of ['vprofile_theuglyducklingirishpub','ev_v_theuglyducklingirishpub',
                   'vpitch_theuglyducklingirishpub','vouch_theuglyducklingirishpub',
                   'apitch_probeartist','show_probeartist','profile_probeartist','ev_probeartist'])
    await store().delete(k).catch(()=>{});
  const vr = await V.readVenues(), ar = await A.readArtists();
  console.log('  cleaned. venues:', Object.keys(vr.byId).length, '| artists:', Object.keys(ar.byId).join(', '));
}
