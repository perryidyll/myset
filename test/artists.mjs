/* ARTIST DIRECTORY — only public profile/calendar fields, with truthful filters. */
const directory = (await import('../netlify/functions/artists.mjs')).default;
const { createArtist, mutateArtists } = await import('../netlify/functions/_auth.mjs');
const { mutateProfile } = await import('../netlify/functions/_profile.mjs');
const { mutateEvents } = await import('../netlify/functions/_events.mjs');

let pass=0,fail=0;
const ok=(name,cond,detail)=>{if(cond){pass++;console.log('  ✓',name)}else{fail++;console.log('  ✗',name,detail||'')}};
const soon=new Date(Date.now()+20*86400000).toISOString().slice(0,10);
const a=await createArtist({email:'directory-a@example.com',name:'Calendar Band',slug:'calendar-band'});
const b=await createArtist({email:'directory-b@example.com',name:'Record Artist',slug:'record-artist'});
const gone=await createArtist({email:'directory-gone@example.com',name:'Gone Artist',slug:'gone-artist'});
await mutateProfile(a.artistId,p=>{p.name='Calendar Band';p.tagline='Every Thursday';return true});
await mutateProfile(b.artistId,p=>{p.name='Record Artist';p.links.spotify='https://open.spotify.com/artist/example';return true});
await mutateEvents(a.artistId,d=>{d.list.push({id:'gig1',date:soon,time:'20:00',durationMin:180,tz:'UTC',venue:'The Room',city:'Bangkok',country:'Thailand',skip:[],hid:[],createdAt:Date.now()});return true});
await mutateArtists(reg=>{reg.byId[gone.artistId].del={at:Date.now(),purgeAt:Date.now()+86400000};return true});

const response=await directory(new Request('https://myset.vip/api/artists'));
const data=await response.json();
ok('the directory responds',data.ok===true);
ok('deleted accounts are omitted',!data.artists.some(x=>x.slug==='gone-artist'));
const calendar=data.artists.find(x=>x.slug==='calendar-band');
const music=data.artists.find(x=>x.slug==='record-artist');
ok('an upcoming calendar supplies the city and country filters',calendar&&calendar.upcomingShows===1&&calendar.locations.some(x=>x.city==='Bangkok'&&x.country==='Thailand'),calendar);
ok('a streaming link marks music released',music&&music.musicReleased===true,music);
ok('private registry fields never leave',!JSON.stringify(data).includes('directory-a@example.com'));
ok('directory responses are never cached',response.headers.get('cache-control')==='no-store');
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
