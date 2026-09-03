/* VERIFYING AN ARTIST WITHOUT WAKING A HUMAN.

   The tick is granted automatically when four things are true: a paid plan, card
   payments live, STRIPE's own identity check passed on the person, and the name the
   artist gave MySet matching the name Stripe verified.

   The cases worth testing are the ones that must NOT pass. A shared surname is not a
   match. A pending Stripe check is not a passed one. A business account has no
   person to match. Every one of those is a question for Perry, not a small yes.

   And the honest limit, asserted here so nobody later mistakes what this does:
   NOTHING READS THE PHOTO. The automatic path leans on Stripe's identity check, not
   on the picture. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake_for_local_tests_only';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake_for_local_tests_only';

const admin = (await import('../netlify/functions/admin.mjs')).default;
const hookFn = (await import('../netlify/functions/webhook.mjs')).default;
const { nameMatch, nameTokens } = await import('../netlify/functions/_names.mjs');
const { tryAutoVerify, ID_SLOT, readIdQueue } = await import('../netlify/functions/_verify.mjs');
const { getImage } = await import('../netlify/functions/_img.mjs');
const { __stripe } = await import('./stripe-fake.mjs');
const { createArtist, signToken, readArtists, revOf, mutateArtists } =
  await import('../netlify/functions/_auth.mjs');
const { readFileSync } = await import('node:fs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body, token, extra) => {
  const headers = { 'content-type': 'application/json', ...(extra || {}) };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const SIG = { 'stripe-signature': 't=1,v1=x' };
const PNG = 'data:image/png;base64,iVBORw0KGgo=';
/* A stage name is the NORMAL case, not the exception — Perry's own page says Idyll
   while his passport says otherwise — so the fixtures use a different legal name
   from the account name everywhere, and the account name is never what is matched. */
const DOB = '1985-04-12';
const upload = (token, legalName, dob = DOB) =>
  hit(admin, 'https://x/api/admin', { action: 'idUpload', data: PNG, legalName, dob }, token);

console.log('\nTHE NAME RULES  the near-misses are the point');
eq('the same name', nameMatch('Perry Idyll', 'PERRY IDYLL'), 'exact');
eq('accents', nameMatch('Pérry Idyll', 'Perry Idyll'), 'exact');
eq('reversed with a comma', nameMatch('Perry Idyll', 'Idyll, Perry'), 'exact');
eq('a middle name', nameMatch('Perry Idyll', 'Perry John Idyll'), 'strong');
eq('a middle initial', nameMatch('Perry J. Idyll', 'Perry Idyll'), 'exact');
eq('a suffix', nameMatch('Perry Idyll Jr', 'Perry Idyll'), 'exact');
eq("an apostrophe", nameMatch("Sean O'Brien", 'Sean OBrien'), 'exact');
eq('a split prefix', nameMatch('Angus McDonald', 'Angus Mc Donald'), 'exact');
eq('THE ONE THAT MATTERS: a shared surname is NOT a match',
   nameMatch('Perry Idyll', 'Sam Idyll'), 'weak');
eq('nor a shared first name', nameMatch('Perry Idyll', 'Perry Smith'), 'weak');
eq('a different person', nameMatch('Perry Idyll', 'Wanwipa Suksawat'), 'none');
eq('one name is not enough to judge', nameMatch('Perry', 'Perry'), 'none');
eq('nor is an empty one', nameMatch('', 'Perry Idyll'), 'none');
eq('and a name inside another is not a match', nameMatch('Ann Lee', 'Joanne Leeson'), 'none');
eq('particles are dropped mid-name', nameTokens('Jan van der Berg'), ['jan', 'berg']);
/* ...but NOT when they are somebody's actual first name. The first version stripped
   these and left one token, which matched nobody — Di Park, Al Green, Van Morrison
   and Le Nguyen are all real names that begin with a word that is elsewhere a
   surname particle. */
for (const n of ['Di Park', 'Al Green', 'Van Morrison', 'Le Nguyen'])
  eq(`"${n}" survives`, nameMatch(n, n), 'exact');
eq('and still tells two Parks apart', nameMatch('Di Park', 'Sam Park'), 'weak');

/* ── a full artist, walked forward one condition at a time ─────────────── */
const mk = async (email, slug, name) => {
  const a = await createArtist({ email, name, slug });
  const reg = await readArtists();
  return { ...a, token: await signToken(email, revOf(reg, a.artistId)) };
};
const onboard = async (t, aid, { legal, status, business, dob }) => {
  await hit(admin, 'https://x/api/admin', { action: 'payStart', country: 'US' }, t);
  const acct = [...__stripe.accounts.keys()].find((k) =>
    __stripe.accounts.get(k).metadata.myset_artist === aid);
  const a = __stripe.accounts.get(acct);
  a.charges_enabled = true; a.payouts_enabled = true; a.details_submitted = true;
  if (business) { a.individual = null; a.business_profile = { name: business }; }
  else {
    const [f, ...r] = String(legal || '').split(' ');
    const [dy, mo, yr] = (dob || DOB).split('-').reverse();
    a.individual = { first_name: f || '', last_name: r.join(' '),
                     dob: { day: +dy, month: +mo, year: +yr },
                     verification: { status: status || 'unverified' } };
  }
  await hit(hookFn, 'https://x/api/webhook',
    { type: 'account.updated', account: acct, data: { object: a } }, null, SIG);
  return acct;
};

console.log('\nEVERY CONDITION IS REQUIRED, AND IT SAYS WHICH ONE IS MISSING');
const ana = await mk('ana@example.com', 'ana-reyes', 'Ana Reyes');
const A = (action, extra = {}) => hit(admin, 'https://x/api/admin', { action, ...extra }, ana.token);
let r = await tryAutoVerify(ana.artistId);
eq('a free artist: no', r.verified, false);
ok('and it names the reason', /paid plan/.test(r.why || ''), r.why);
await mutateArtists((x) => { x.byId[ana.artistId].plan = 'pro'; return true; });
r = await tryAutoVerify(ana.artistId);
ok('now it is the payments', /card payments/.test(r.why || ''), r.why);
await onboard(ana.token, ana.artistId, { legal: 'Ana Reyes', status: 'pending' });
r = await tryAutoVerify(ana.artistId);
ok('now it is the missing ID', /no ID on file/.test(r.why || ''), r.why);
const up = await upload(ana.token, 'Ana Reyes');
ok('the ID uploads', up.ok, up);
eq('but Stripe has not finished checking her', up.autoVerified, false);
ok('and it says exactly that', /not finished checking/.test(up.autoWhy || ''), up.autoWhy);
let reg = await readArtists();
eq('so she is NOT verified', !!reg.byId[ana.artistId].verified, false);

console.log('\nWHEN STRIPE FINISHES, THE TICK ARRIVES ON ITS OWN');
const acct = [...__stripe.accounts.keys()].find((k) =>
  __stripe.accounts.get(k).metadata.myset_artist === ana.artistId);
const acctObj = __stripe.accounts.get(acct);
acctObj.individual.verification.status = 'verified';
await hit(hookFn, 'https://x/api/webhook',
  { type: 'account.updated', account: acct, data: { object: acctObj } }, null, SIG);
reg = await readArtists();
eq('THE POINT: verified without anybody being asked', !!reg.byId[ana.artistId].verified, true);
eq('and recorded as automatic', reg.byId[ana.artistId].verifiedVia, 'auto');
eq('THE PRIVACY RULE HOLDS: the photo is gone',
   await getImage(ana.artistId, ID_SLOT), null);
const q = await readIdQueue();
eq('the queue row says it was automatic', q.by[ana.artistId].auto, true);
ok('the owner queue is clear', !(await hit(admin, 'https://x/api/admin?code=devlocal',
   { action: 'idQueue' })).queue.some((x) => x.artistId === ana.artistId));

console.log('\nA CLOSE NAME IS A QUESTION, NOT A YES');
const bo = await mk('bo@example.com', 'bo-tran', 'Bo Tran');
await mutateArtists((x) => { x.byId[bo.artistId].plan = 'plus'; return true; });
await onboard(bo.token, bo.artistId, { legal: 'Sam Tran', status: 'verified' });
await upload(bo.token, 'Bo Tran');
r = await tryAutoVerify(bo.artistId);
eq('a shared surname does not pass', r.verified, false);
ok('and says the names are close but not the same', /close but not the same/.test(r.why || ''), r.why);
reg = await readArtists();
eq('he is not verified', !!reg.byId[bo.artistId].verified, false);
const qb = await readIdQueue();
eq('the comparison is recorded for the human', qb.by[bo.artistId].match, 'weak');
eq('and his ID is still there for Perry to look at',
   !!(await getImage(bo.artistId, ID_SLOT)), true);
const queue = await hit(admin, 'https://x/api/admin?code=devlocal', { action: 'idQueue' });
ok('so he IS in the owner queue', queue.queue.some((x) => x.artistId === bo.artistId), queue.queue);

console.log('\nA BUSINESS ACCOUNT HAS NO PERSON TO MATCH');
const cy = await mk('cy@example.com', 'cy-lo', 'Cy Lo');
await mutateArtists((x) => { x.byId[cy.artistId].plan = 'pro'; return true; });
await onboard(cy.token, cy.artistId, { business: 'Cy Lo Music Ltd' });
await upload(cy.token, 'Cy Lo');
r = await tryAutoVerify(cy.artistId);
eq('it does not guess', r.verified, false);
ok('and says why', /business/.test(r.why || ''), r.why);

console.log('\nA STRAIGHT MATCH GOES THROUGH ON UPLOAD');
const di = await mk('di@example.com', 'di-park', 'Di Park');
await mutateArtists((x) => { x.byId[di.artistId].plan = 'pro'; return true; });
await onboard(di.token, di.artistId, { legal: 'Di Park', status: 'verified' });
const up2 = await upload(di.token, 'di park');
eq('verified the moment the ID arrived', up2.autoVerified, true);
reg = await readArtists();
eq('and it stuck', !!reg.byId[di.artistId].verified, true);
eq('photo destroyed', await getImage(di.artistId, ID_SLOT), null);

console.log('\nA STAGE NAME IS THE NORMAL CASE, NOT A PROBLEM');
/* The whole reason this uses the LEGAL name: Perry's page says Idyll and his
   passport says something else. Matching the display name would have failed for
   most real artists and quietly queued them all. */
const ez = await mk('ez@example.com', 'ez-idyll', 'Ez Idyll');   // stage name
await mutateArtists((x) => { x.byId[ez.artistId].plan = 'pro'; return true; });
await onboard(ez.token, ez.artistId, { legal: 'Ez Murdaugh', status: 'verified' });
const upEz = await upload(ez.token, 'Ez Murdaugh');              // the LEGAL name
eq('verified on a legal name that differs from the stage name', upEz.autoVerified, true);
reg = await readArtists();
eq('and the page keeps the stage name', reg.byId[ez.artistId].name, 'Ez Idyll');

console.log('\nBOTH FACTS ARE REQUIRED, AND NEITHER IS STORED');
const fi = await mk('fi@example.com', 'fi-lane', 'Fi Lane');
await mutateArtists((x) => { x.byId[fi.artistId].plan = 'pro'; return true; });
await onboard(fi.token, fi.artistId, { legal: 'Fi Lane', status: 'verified' });
const wrongDob = await upload(fi.token, 'Fi Lane', '1990-01-01');
eq('a right name with a wrong date does NOT pass', wrongDob.autoVerified, false);
ok('and says which one failed', /date of birth/.test(wrongDob.autoWhy || ''), wrongDob.autoWhy);
const qf = await readIdQueue();
eq('THE PRIVACY RULE: only the verdict is kept, never the date', qf.by[fi.artistId].dobMatch, false);
ok('no date of birth is stored anywhere on the row',
   !JSON.stringify(qf.by[fi.artistId]).includes('1990'), qf.by[fi.artistId]);
ok('and a missing name or date is refused outright',
   (await hit(admin, 'https://x/api/admin', { action: 'idUpload', data: PNG, legalName: 'Fi' }, fi.token)).status === 400);
ok('...as is an impossible date',
   (await upload(fi.token, 'Fi Lane', '1985-02-31')).status === 400);

console.log('\nAND THE HONEST LIMIT IS WRITTEN DOWN');
const src = readFileSync(new URL('../netlify/functions/_verify.mjs', import.meta.url), 'utf8');
ok('the code says out loud that nothing reads the photo',
   /nothing here reads\s*\n?\s*the photo|NOTHING READS THE PHOTO/i.test(src));
ok('and that any doubt goes to a human', /ANY doubt goes to a human/.test(src));

delete process.env.STRIPE_SECRET_KEY;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
