process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({
  siteID: '8f5c9f01-e1f1-47e3-add1-8dde39efd1d3',
  token: (await import('node:fs')).readFileSync(process.argv[2],'utf8').trim(),
  apiURL: 'https://api.netlify.com',
})).toString('base64');
const V = await import('./netlify/functions/_venues.mjs');
const EMAIL = 'signup-probe@example.com';

if (process.argv[3] === 'up') {
  const made = await V.createVenue({ email: EMAIL, name: 'The Ugly Duckling Irish Pub',
                                     city: 'Koh Phangan', country: 'Thailand' });
  console.log('  createVenue      ->', JSON.stringify(made));
  const again = await V.createVenue({ email: EMAIL, name: 'Trying twice' });
  console.log('  same email twice ->', JSON.stringify(again));
  const reg = await V.readVenues();
  const tok = await V.signVenueToken(EMAIL, reg.rev);
  const back = await V.verifyVenueToken(tok);
  console.log('  token round trip ->', back ? `${back.venueId} / ${back.email} / ${back.role}` : 'FAILED');
  console.log('  tampered token   ->', await V.verifyVenueToken(tok.slice(0,-2)+'xy') ? 'ACCEPTED (BAD)' : 'rejected');
  const { verifyToken } = await import('./netlify/functions/_auth.mjs');
  console.log('  as an ARTIST tok ->', await verifyToken(tok) ? 'ACCEPTED (BAD)' : 'rejected');
  console.log('TOKEN=' + tok);
} else {
  await V.mutateVenues((r) => {
    for (const [vid, v] of Object.entries(r.byId)) if (v.slug==='uglyducklingirishpub'||v.name==='The Ugly Duckling Irish Pub') {
      delete r.byId[vid]; delete r.bySlug[v.slug];
    }
    for (const e of Object.keys(r.byEmail)) if (e===EMAIL) delete r.byEmail[e];
    return true;
  });
  const reg = await V.readVenues();
  console.log('  cleaned. venues left:', Object.keys(reg.byId).length);
}
