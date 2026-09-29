/* TIP DECKS (decision 0102) — a short carousel on every Studio tab: one sentence a
   slide, a small moving picture, arrows, dots, a swipe. The first time an account opens
   a tab it plays that tab's deck once; the ? in the header plays it again whenever.
   The practice round and a sample page use the same component for their own decks.

   One file, shared by both Studios and the sample page, loaded with its own ?v= stamp
   (tools/stamp.mjs). It brings its own styles, drawn from the page's own colour tokens
   (with fallbacks), so it looks at home in the Studio and on the artist page alike, and
   it touches nothing outside its own `.tdk` tree.

   RULES THE WORDS KEEP. One sentence a slide, four slides at most for a tab (five on
   Money, on the founder's word, 2026-09-29). A feature
   that costs money says which plan, so a free account is never shown a door it cannot
   open (INVARIANT 0bx). No slide promises what the product does not do.

   Nothing here can throw into the page: every entry point is wrapped, and a phone with
   no localStorage simply sees a deck again. */
(function () {
  'use strict';
  if (window.Tips) return;

  /* ---------- the pictures ----------
     Each is a 64×64 drawing in the brand's two colours; the motion is CSS, and runs
     only on the slide that is showing (and not at all for a phone that asked for less
     motion). */
  const G = {
    vote: '<g class="g-vote"><rect x="12" y="30" width="10" height="22" rx="5"/><rect x="27" y="16" width="10" height="36" rx="5"/><rect x="42" y="38" width="10" height="14" rx="5"/></g><text class="g-plus" x="32" y="12" text-anchor="middle">+1</text>',
    play: '<circle class="g-ring" cx="32" cy="32" r="22"/><path class="g-tri" d="M27 21l17 11-17 11z"/>',
    coin: '<g class="g-coin"><circle cx="32" cy="26" r="13"/><text x="32" y="31" text-anchor="middle" class="g-cur">$</text></g><rect class="g-jar" x="17" y="40" width="30" height="14" rx="5"/><g class="g-spark"><path d="M50 16l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/></g>',
    check: '<circle class="g-disc" cx="32" cy="32" r="22"/><path class="g-tick" d="M21 33l7 7 15-16"/>',
    calendar: '<rect class="g-cal" x="12" y="16" width="40" height="36" rx="7"/><path class="g-calbar" d="M12 26h40M22 12v8M42 12v8"/><circle class="g-dot" cx="40" cy="40" r="5"/>',
    repeat: '<g class="g-spin"><path class="g-arc" d="M46 26a16 16 0 0 0-27-5M18 38a16 16 0 0 0 27 5"/><path class="g-head" d="M17 13v9h9M47 51v-9h-9"/></g>',
    card: '<g class="g-slide"><rect class="g-cardb" x="10" y="18" width="44" height="28" rx="6"/><path class="g-cardl" d="M10 27h44M17 38h10"/></g>',
    chart: '<path class="g-axis" d="M12 14v38h40"/><path class="g-line" d="M16 44l10-10 8 6 14-16"/><circle class="g-end" cx="48" cy="24" r="3.5"/>',
    list: '<g class="g-rows"><rect x="12" y="15" width="40" height="7" rx="3.5"/><rect x="12" y="28" width="32" height="7" rx="3.5"/><rect x="12" y="41" width="24" height="7" rx="3.5"/></g>',
    paste: '<rect class="g-clip" x="16" y="12" width="32" height="42" rx="6"/><rect class="g-clipt" x="25" y="8" width="14" height="8" rx="3"/><g class="g-rows"><rect x="22" y="24" width="20" height="4" rx="2"/><rect x="22" y="32" width="16" height="4" rx="2"/><rect x="22" y="40" width="18" height="4" rx="2"/></g>',
    lyrics: '<g class="g-bounce"><path class="g-note" d="M26 44V18l20-5v26"/><circle cx="21" cy="44" r="6"/><circle cx="41" cy="39" r="6"/></g>',
    camera: '<rect class="g-cam" x="10" y="20" width="44" height="30" rx="7"/><path class="g-camt" d="M24 20l3-6h10l3 6"/><circle class="g-lens" cx="32" cy="35" r="8"/><circle class="g-flash" cx="47" cy="27" r="2.5"/>',
    star: '<path class="g-star" d="M32 10l6.5 13.4 14.7 2.1-10.6 10.4 2.5 14.6L32 43.6 18.9 50.5l2.5-14.6L10.8 25.5l14.7-2.1z"/>',
    bag: '<g class="g-bob"><path class="g-bagb" d="M14 24h36l-3 28H17z"/><path class="g-bagh" d="M24 24v-4a8 8 0 0 1 16 0v4"/></g>',
    bell: '<g class="g-ring2"><path class="g-bellb" d="M20 42V30a12 12 0 0 1 24 0v12l4 4H16z"/><circle cx="32" cy="52" r="4"/></g>',
    book: '<path class="g-bookl" d="M32 18c-5-4-11-5-19-5v34c8 0 14 1 19 5"/><path class="g-bookr" d="M32 18c5-4 11-5 19-5v34c-8 0-14 1-19 5z"/>',
    chat: '<path class="g-bub" d="M12 18a6 6 0 0 1 6-6h28a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H28l-10 8v-8h0a6 6 0 0 1-6-6z"/><g class="g-type"><circle cx="24" cy="27" r="3"/><circle cx="32" cy="27" r="3"/><circle cx="40" cy="27" r="3"/></g>',
    tick: '<path class="g-badge" d="M32 8l6 5 8-1 2 8 7 4-3 7 3 7-7 4-2 8-8-1-6 5-6-5-8 1-2-8-7-4 3-7-3-7 7-4 2-8 8 1z"/><path class="g-tick" d="M24 32l6 6 11-12"/>',
    people: '<circle class="g-p1" cx="23" cy="24" r="7"/><path class="g-p1" d="M11 50a12 12 0 0 1 24 0"/><circle class="g-p2" cx="42" cy="22" r="7"/><path class="g-p2" d="M30 48a12 12 0 0 1 24 0"/>',
    key: '<g class="g-turn"><circle class="g-keyh" cx="22" cy="32" r="10"/><path class="g-keys" d="M32 32h22M46 32v8M52 32v6"/></g>',
    mic: '<g class="g-bob"><rect class="g-micb" x="24" y="8" width="16" height="28" rx="8"/><path class="g-mics" d="M16 30a16 16 0 0 0 32 0M32 46v8M24 54h16"/></g>',
    pin: '<g class="g-drop"><path class="g-pinb" d="M32 54s15-13 15-26a15 15 0 0 0-30 0c0 13 15 26 15 26z"/><circle class="g-pind" cx="32" cy="28" r="5"/></g><ellipse class="g-shadow" cx="32" cy="57" rx="8" ry="2"/>',
    menu: '<path class="g-glass" d="M18 12h16l-2 16a6 6 0 0 1-12 0zM26 34v14M20 50h12"/><path class="g-fork" d="M42 12v40M38 12v10a4 4 0 0 0 8 0V12"/>',
    sparkle: '<path class="g-s1" d="M24 14l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/><path class="g-s2" d="M44 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path class="g-s3" d="M40 10l1.5 3.5L45 15l-3.5 1.5L40 20l-1.5-3.5L35 15l3.5-1.5z"/>',
    stop: '<circle class="g-disc" cx="32" cy="32" r="22"/><rect class="g-sq" x="23" y="23" width="18" height="18" rx="3"/>',
    qr: '<g class="g-qr"><rect x="12" y="12" width="14" height="14" rx="2"/><rect x="38" y="12" width="14" height="14" rx="2"/><rect x="12" y="38" width="14" height="14" rx="2"/><rect x="38" y="38" width="5" height="5"/><rect x="47" y="38" width="5" height="5"/><rect x="38" y="47" width="5" height="5"/><rect x="47" y="47" width="5" height="5"/></g>',
    folder: '<path class="g-fold" d="M10 20a4 4 0 0 1 4-4h12l4 5h20a4 4 0 0 1 4 4v23a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z"/><path class="g-foldt" d="M10 28h44"/>',
    clock: '<circle class="g-disc" cx="32" cy="32" r="22"/><path class="g-hand" d="M32 32V18"/><path class="g-hand2" d="M32 32h10"/>',
  };
  const art = (k) => `<svg class="tdk-g" viewBox="0 0 64 64" aria-hidden="true">${G[k] || G.sparkle}</svg>`;

  /* ---------- the words ----------
     `{first}`, `{days}` and `{sources}` are filled in from `vars` when a deck opens;
     `{payday}` is the Studio's (studio.js tipVars): the plan's own payout schedule,
     which is weekly on Monday for Hobbyist and daily on the paid plans (_connect.mjs). */
  const D = {
    /* the Artist Studio, one per tab */
    live: { t: 'Live', s: [
      ['mic', 'This is your stage, where the room votes from their phones once the show starts.'],
      ['vote', 'The most-voted song climbs to the top, so tap ▶ Start and play it.'],
      ['coin', 'Tips and bought votes land here as they happen, and {payday}.'],
      ['check', 'Tap End the show when you’re done, and the night files itself.']] },
    setlist: { t: 'Setlist', s: [
      ['list', 'Your songs are the menu the room votes from, and one tap switches each on or off.'],
      ['paste', 'Paste a list or drop in a CSV, or simply add songs by hand and customize each one’s lyrics, chords and more.'],
      ['lyrics', 'Open any song for its key, your own chart and the lyrics on stage.'],
      ['folder', 'Group songs into setlists: a beach set, a late set, the one for the Irish pub.']] },
    gigs: { t: 'Gigs', s: [
      ['calendar', 'Add a gig once, and it shows on your page and in the city’s gig finder.'],
      ['clock', 'At start time voting opens by itself, so you just walk on stage.'],
      ['repeat', 'Set a weekly night to repeat and your calendar fills itself.'],
      ['chart', 'On Bar Star, recurring shows keep the same pay and time invested unless changed, and fill the Money tab by themselves.']] },
    money: { t: 'Money', s: [
      ['card', 'Connect Stripe once, and tips and vote packs go straight to your bank ({payday}).'],
      ['chart', 'Every night is filed for you: the songs, the votes, the money.'],
      ['people', 'Toggle between your band’s total earnings and your individual cut (a Bar Star feature).'],
      ['clock', 'View your hourly rate not just by stage time but with breaks, set‑up/break‑down and travel too.'],
      ['coin', 'View your earnings month by month, with a spreadsheet ready for tax time.']] },
    profile: { t: 'Profile', s: [
      ['star', 'This is your public page, the one fans see after the set.'],
      ['camera', 'Photos, a short bio, your links and your best videos, all in one place.'],
      ['chat', 'Fans leave notes and star ratings on your community page, and you can reply.']] },
    merch: { t: 'Merch', s: [
      ['bag', 'Sell shirts, CDs and stickers from your own shop page (a Bar Star feature).'],
      ['card', 'Add a photo and a price, switch it on, and fans pay by card.'],
      ['bell', 'Every order pings your phone and waits here until it’s done.']] },
    diary: { t: 'Diary', s: [
      ['book', 'Write a few pages about you: the story, the gear, the road.'],
      ['camera', 'Give each page a cover photo, and fans find your diary from your page.']] },
    messages: { t: 'Messages', s: [
      ['chat', 'Venues and fans who want to book you land here, not in your DMs.'],
      ['pin', 'Ask a venue for a spot from its page, then talk it through here in the Venues folder.'],
      ['check', 'Reply from here and keep every booking in one place.']] },
    settings: { t: 'Settings', s: [
      ['vote', 'Choose how many free votes each fan gets, and on Bar Star set your own prices.'],
      ['tick', 'Earn the green ✓ Verified tick fans trust (on the paid plans).'],
      ['people', 'On Rock Star, up to five of you can sign in and run the screen.'],
      ['key', 'Sign in your way: an email code, a password or Face ID.']] },

    /* the Venue Studio */
    'v-page': { t: 'Your page', s: [
      ['star', 'This is your venue in one link: photos, hours, amenities and directions.'],
      ['pin', 'Guests tap Directions and land at your door.'],
      ['camera', 'Great photos of the room with a crowd in it sell the night.']] },
    'v-shows': { t: 'What’s on', s: [
      ['calendar', 'List a night once, and it shows on your page and in the city’s gig finder.'],
      ['mic', 'Artists who play here list their gigs too, so your calendar fills itself.'],
      ['repeat', 'Set quiz night or open mic to repeat, and it lists itself every week.']] },
    'v-numbers': { t: 'Numbers', s: [
      ['chart', 'See how many people were in the room on your live-music nights.'],
      ['vote', 'Votes and requests show you what your crowd wants to hear.']] },
    'v-merch': { t: 'Merch', s: [
      ['bag', 'Sell caps and tees from your page (a Pro feature).'],
      ['bell', 'Guests pay by card, and every order pings your phone.']] },
    'v-menu': { t: 'Food & drink', s: [
      ['menu', 'Put your menu and tonight’s offers where every guest can see them.'],
      ['sparkle', 'Add happy hour as an offer and it shows on your page.']] },
    'v-settings': { t: 'Settings', s: [
      ['tick', 'On Pro, earn the ✓ tick with your website and three artists who’ve played here.'],
      ['people', 'Add your team so the bar staff can keep what’s on up to date.'],
      ['key', 'Sign in your way: an email code, a password or Face ID.']] },

    /* a brand-new account, once the first-run steps are done (studio.js frDone) */
    'studio-intro': { t: 'Your Studio', s: [
      ['star', 'Welcome to your Studio, the backstage of your page.'],
      ['vote', 'Every tab explains itself the first time you open it, and the question mark plays it again.'],
      ['play', 'Before your first gig, try a practice round with pretend fans and real buttons.']] },

    /* the practice round (studio.js) */
    'pr-start': { t: 'Practice round', s: [
      ['mic', 'Welcome to a practice round: the fans are pretend, the buttons are real, and nothing is saved.'],
      ['vote', 'Watch the room vote as songs climb the list.'],
      ['play', 'When a song is on top, tap ▶ Start and play it.']] },
    'pr-song': { t: 'Start a song', s: [
      ['play', 'Your top song is ready, so tap ▶ Start and every phone in the room sees it’s on.'],
      ['lyrics', 'The lyrics and your chord chart are one tap away while you play.']] },
    'pr-money': { t: 'That was money', s: [
      ['coin', 'That was a tip, sent from a fan’s phone straight to your bank.'],
      ['vote', 'Fans can also buy votes to push their song up, and that money is yours too.']] },
    'pr-endsong': { t: 'Next song', s: [
      ['stop', 'When the song’s done, tap End current song and the next favourite climbs.']] },
    'pr-end': { t: 'That’s a set', s: [
      ['check', 'Tap End the show, and the night files itself: the songs, the votes, the money.']] },

    /* a sample page (sample.js), and a sample's Studio */
    welcome: { t: 'Your MySet page', s: [
      ['sparkle', 'Hey {first}, we built you a MySet page from your public {sources}.'],
      ['key', 'It’s private: only your link opens it, and search engines can’t see it.'],
      ['play', 'Tap View your Studio to see how a gig runs, and try a practice round.'],
      ['check', 'Claiming it is free and takes a minute, and you have {days} to do it.']] },
    'v-welcome': { t: 'Your MySet page', s: [
      ['sparkle', 'Hi {first} team, we built your venue a MySet page from your public {sources}.'],
      ['key', 'It’s private: only your link opens it, and search engines can’t see it.'],
      ['calendar', 'Tap View your Studio to see how your page and your live nights are run.'],
      ['check', 'Claiming it is free and takes a minute, and you have {days} to do it.']] },
    'sample-studio': { t: 'Your Studio', s: [
      ['star', 'This is your Studio, the backstage of your page.'],
      ['vote', 'Look around, because every tab explains itself the first time you open it.'],
      ['play', 'On the Live tab, try a practice round with pretend fans and real buttons.'],
      ['key', 'It’s look-only until you claim it with Claim profile, top right.']] },
    'v-sample-studio': { t: 'Your Venue Studio', s: [
      ['star', 'This is your Venue Studio, the backstage of your page.'],
      ['vote', 'Look around, because every tab explains itself the first time you open it.'],
      ['key', 'It’s look-only until you claim it with Claim profile, top right.']] },
  };

  /* ---------- the styles ---------- */
  const CSS = `
.tdk{position:fixed;inset:0;z-index:85;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.52);
  -webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .26s ease}
.tdk.on{opacity:1}
.tdk-card{position:relative;width:100%;max-width:380px;min-width:0;border-radius:28px;overflow:hidden;
  background:var(--surface,#fff);color:var(--ink,#1D1D1F);box-shadow:0 30px 80px -20px rgba(0,0,0,.55);
  transform:translateY(18px) scale(.96);transition:transform .42s cubic-bezier(.34,1.4,.64,1);
  font-family:var(--f,-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",system-ui,sans-serif)}
.tdk.on .tdk-card{transform:none}
.tdk-top{display:flex;align-items:center;justify-content:space-between;padding:16px 16px 0 20px}
.tdk-k{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--accent-2,#FF5650)}
.tdk-k span{color:var(--muted,#6E6E73);font-weight:700;letter-spacing:.04em;margin-left:6px}
.tdk-x{width:32px;height:32px;border-radius:50%;border:0;background:var(--surface-2,#EBEBEF);color:var(--muted,#6E6E73);
  font-size:13px;display:grid;place-items:center;cursor:pointer}
.tdk-view{overflow:hidden;touch-action:pan-y;width:100%}
.tdk-track{display:flex;transition:transform .44s cubic-bezier(.22,.9,.3,1)}
.tdk-slide{flex:0 0 100%;padding:10px 26px 4px;text-align:center}
.tdk-art{width:128px;height:128px;margin:6px auto 14px;border-radius:36px;display:grid;place-items:center;
  background:radial-gradient(120% 100% at 30% 20%,rgba(255,86,80,.22),rgba(255,55,95,.08) 60%,transparent)}
.tdk-g{width:76px;height:76px;overflow:visible}
.tdk-g *{fill:url(#tdkgrad);stroke:none}
.tdk-g .g-ring,.tdk-g .g-arc,.tdk-g .g-head,.tdk-g .g-axis,.tdk-g .g-line,.tdk-g .g-tick,.tdk-g .g-calbar,.tdk-g .g-cardl,
.tdk-g .g-mics,.tdk-g .g-keys,.tdk-g .g-bagh,.tdk-g .g-hand,.tdk-g .g-hand2,.tdk-g .g-foldt,.tdk-g .g-bookl,.tdk-g .g-bookr,
.tdk-g .g-camt,.tdk-g .g-glass,.tdk-g .g-fork,.tdk-g .g-note{fill:none;stroke:url(#tdkgrad);stroke-width:4.5;stroke-linecap:round;stroke-linejoin:round}
.tdk-g .g-disc,.tdk-g .g-cal,.tdk-g .g-clip,.tdk-g .g-cam,.tdk-g .g-bub,.tdk-g .g-cardb,.tdk-g .g-jar,.tdk-g .g-bellb,.tdk-g .g-badge,.tdk-g .g-fold,.tdk-g .g-pinb,.tdk-g .g-micb,.tdk-g .g-keyh,.tdk-g .g-bagb{fill:url(#tdkgrad)}
.tdk-g .g-tick,.tdk-g .g-cur,.tdk-g .g-lens,.tdk-g .g-type circle,.tdk-g .g-pind,.tdk-g .g-sq,.tdk-g .g-flash{fill:#fff;stroke:#fff}
.tdk-g .g-tick{fill:none;stroke-width:5}
.tdk-g .g-hand,.tdk-g .g-hand2{stroke:#fff}   /* the clock's hands, white on its disc (they were the disc's own colour) */
.tdk-g .g-cur{font:800 16px/1 system-ui,sans-serif}
.tdk-g .g-plus{font:800 11px/1 system-ui,sans-serif;fill:var(--accent-2,#FF5650)}
.tdk-g .g-shadow{fill:rgba(0,0,0,.14)}
.tdk-g .g-p2{opacity:.55}
.tdk-line{font-size:19px;line-height:1.36;font-weight:650;letter-spacing:-.018em;margin:0 0 6px;min-height:78px;
  display:flex;align-items:center;justify-content:center;text-wrap:balance}
.tdk-nav{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px 18px}
.tdk-prev{width:46px;height:46px;border-radius:50%;border:0;cursor:pointer;background:var(--surface-2,#EBEBEF);
  color:var(--ink,#1D1D1F);font-size:18px;display:grid;place-items:center;transition:opacity .2s,transform .2s}
.tdk-prev[disabled]{opacity:0;pointer-events:none}
.tdk-prev:active,.tdk-next:active{transform:scale(.93)}
.tdk-dots{display:flex;gap:7px;justify-content:center;flex:1;min-width:0}
.tdk-dots i{width:7px;height:7px;border-radius:99px;background:var(--hair-2,rgba(0,0,0,.16));transition:width .3s,background .3s}
.tdk-dots i.on{width:22px;background:var(--accent-2,#FF5650)}
.tdk-card:focus{outline:none}
.tdk-next:focus-visible,.tdk-prev:focus-visible,.tdk-x:focus-visible{outline:2.5px solid var(--accent-2,#FF5650);outline-offset:3px}
.tdk-next{min-width:108px;height:46px;padding:0 20px;white-space:nowrap;flex:0 0 auto;border-radius:999px;border:0;cursor:pointer;color:#fff;font-weight:700;font-size:15.5px;
  background:linear-gradient(135deg,#FF375F,#FF6B45);box-shadow:0 6px 18px rgba(255,55,95,.32);transition:transform .2s}
.tdk-skip{display:block;margin:-8px auto 14px;border:0;background:none;color:var(--muted,#6E6E73);font-size:13px;font-weight:600;cursor:pointer}
@keyframes tdk-rise{0%{transform:translateY(10px);opacity:.35}100%{transform:none;opacity:1}}
@keyframes tdk-bar1{0%,100%{transform:scaleY(.55)}50%{transform:scaleY(1)}}
@keyframes tdk-float{0%{opacity:0;transform:translateY(6px)}30%{opacity:1}100%{opacity:0;transform:translateY(-10px)}}
@keyframes tdk-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.14);opacity:.55}}
@keyframes tdk-pop{0%{transform:scale(0)}70%{transform:scale(1.25)}100%{transform:scale(1)}}
@keyframes tdk-draw{from{stroke-dashoffset:60}to{stroke-dashoffset:0}}
@keyframes tdk-spin{to{transform:rotate(360deg)}}
@keyframes tdk-drop{0%{transform:translateY(-16px)}60%{transform:translateY(3px)}100%{transform:none}}
@keyframes tdk-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes tdk-slidex{0%,100%{transform:translateX(-4px)}50%{transform:translateX(4px)}}
@keyframes tdk-ring{0%,100%{transform:rotate(0)}20%{transform:rotate(14deg)}40%{transform:rotate(-12deg)}60%{transform:rotate(8deg)}80%{transform:rotate(-4deg)}}
@keyframes tdk-twinkle{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.7)}}
@keyframes tdk-turn{0%,100%{transform:rotate(0)}50%{transform:rotate(-18deg)}}
.tdk-g *{transform-box:fill-box;transform-origin:center}
.tdk-slide.on .g-vote rect{transform-origin:bottom;animation:tdk-bar1 1.3s ease-in-out infinite}
.tdk-slide.on .g-vote rect:nth-child(2){animation-delay:-.4s}.tdk-slide.on .g-vote rect:nth-child(3){animation-delay:-.8s}
.tdk-slide.on .g-plus{animation:tdk-float 1.6s ease-out infinite}
.tdk-slide.on .g-ring{animation:tdk-pulse 1.6s ease-in-out infinite}
.tdk-slide.on .g-coin{animation:tdk-drop .9s cubic-bezier(.3,1.4,.6,1) both,tdk-bob 2s .9s ease-in-out infinite}
.tdk-slide.on .g-spark,.tdk-slide.on .g-s1,.tdk-slide.on .g-s2,.tdk-slide.on .g-s3,.tdk-slide.on .g-star{animation:tdk-twinkle 1.4s ease-in-out infinite}
.tdk-slide.on .g-s2{animation-delay:-.5s}.tdk-slide.on .g-s3{animation-delay:-.9s}
.tdk-slide.on .g-tick{stroke-dasharray:60;animation:tdk-draw .7s .15s ease-out both}
.tdk-slide.on .g-dot{animation:tdk-pop .6s .2s cubic-bezier(.3,1.5,.6,1) both}
.tdk-slide.on .g-spin{animation:tdk-spin 3.2s linear infinite reverse}   /* counter-clockwise, the way the arrows point */
.tdk-slide.on .g-slide{animation:tdk-slidex 1.8s ease-in-out infinite}
.tdk-slide.on .g-line{stroke-dasharray:60;animation:tdk-draw 1s ease-out both}
.tdk-slide.on .g-end{animation:tdk-pop .5s .8s both}
.tdk-slide.on .g-rows rect{animation:tdk-rise .5s ease-out both}
.tdk-slide.on .g-rows rect:nth-child(2){animation-delay:.12s}.tdk-slide.on .g-rows rect:nth-child(3){animation-delay:.24s}
.tdk-slide.on .g-bounce,.tdk-slide.on .g-bob{animation:tdk-bob 1.4s ease-in-out infinite}
.tdk-slide.on .g-flash{animation:tdk-twinkle .9s ease-in-out infinite}
.tdk-slide.on .g-ring2{transform-origin:top;animation:tdk-ring 1.6s ease-in-out infinite}
.tdk-slide.on .g-type circle{animation:tdk-bob .9s ease-in-out infinite}
.tdk-slide.on .g-type circle:nth-child(2){animation-delay:.15s}.tdk-slide.on .g-type circle:nth-child(3){animation-delay:.3s}
.tdk-slide.on .g-badge{animation:tdk-pop .6s cubic-bezier(.3,1.5,.6,1) both}
.tdk-slide.on .g-p1{animation:tdk-rise .5s both}.tdk-slide.on .g-p2{animation:tdk-rise .5s .15s both}
.tdk-slide.on .g-turn{animation:tdk-turn 1.8s ease-in-out infinite}
.tdk-slide.on .g-drop{animation:tdk-drop .8s cubic-bezier(.3,1.4,.6,1) both}
.tdk-slide.on .g-hand{animation:tdk-spin 4s linear infinite;transform-origin:32px 32px;transform-box:view-box}
.tdk-slide.on .g-qr rect{animation:tdk-pop .4s both}
.tdk-slide.on .g-qr rect:nth-child(n+4){animation-delay:.25s}
.tdk-slide.on .g-sq{animation:tdk-pulse 1.4s ease-in-out infinite}
.tdk-slide.on .g-bookr{transform-origin:left;animation:tdk-turn 2s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.tdk,.tdk-card,.tdk-track{transition:none}.tdk-slide.on *{animation:none!important}}
`;
  let styled = false;
  function style() {
    if (styled) return; styled = true;
    const s = document.createElement('style'); s.id = 'tdk-css'; s.textContent = CSS; document.head.appendChild(s);
    /* the one gradient every picture paints with */
    const d = document.createElement('div');
    d.setAttribute('aria-hidden', 'true');
    d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML = '<svg width="0" height="0"><defs><linearGradient id="tdkgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF375F"/><stop offset="1" stop-color="#FF7A45"/></linearGradient></defs></svg>';
    document.body.appendChild(d);
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const fill = (t, v) => String(t).replace(/\{(\w+)\}/g, (_, k) => (v && v[k] != null ? v[k] : ''));
  const key = (scope, id) => `myset.tips.${scope || 'x'}.${id}`;
  const seen = (id, scope) => { try { return !!localStorage.getItem(key(scope, id)); } catch (e) { return false; } };
  const mark = (id, scope) => { try { localStorage.setItem(key(scope, id), String(Date.now())); } catch (e) {} };

  let OPEN = null;
  /** Play a deck. Resolves when it is closed (true if they reached the end). */
  function open(id, opts = {}) {
    try {
      const deck = typeof id === 'object' ? id : D[id];
      if (!deck || !deck.s || !deck.s.length) return Promise.resolve(false);
      style();
      if (OPEN) OPEN.close(false);
      const vars = opts.vars || {};
      const n = deck.s.length;
      const last = opts.cta && opts.cta.label ? opts.cta.label : (n > 1 ? 'Got it' : 'Got it');
      const el = document.createElement('div');
      el.className = 'tdk';
      el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', fill(deck.t, vars));
      el.setAttribute('data-nopull', '');
      el.innerHTML = `<div class="tdk-card">
        <div class="tdk-top"><div class="tdk-k">${esc(fill(deck.t, vars))}<span class="tdk-pos"></span></div>
          <button class="tdk-x" type="button" aria-label="Close">✕</button></div>
        <div class="tdk-view" data-hscroll><div class="tdk-track">${deck.s.map(([g, line], i) => `
          <div class="tdk-slide" aria-hidden="${i ? 'true' : 'false'}"><div class="tdk-art">${art(g)}</div>
            <p class="tdk-line">${esc(fill(line, vars))}</p></div>`).join('')}</div></div>
        <div class="tdk-nav"><button class="tdk-prev" type="button" aria-label="Back">←</button>
          <div class="tdk-dots" aria-hidden="true">${deck.s.map(() => '<i></i>').join('')}</div>
          <button class="tdk-next" type="button">Next →</button></div>
        ${opts.skip === false || n < 3 ? '' : '<button class="tdk-skip" type="button">Skip</button>'}</div>`;
      document.body.appendChild(el);
      const track = el.querySelector('.tdk-track'), slides = [...el.querySelectorAll('.tdk-slide')];
      const dots = [...el.querySelectorAll('.tdk-dots i')], prev = el.querySelector('.tdk-prev'), next = el.querySelector('.tdk-next');
      const pos = el.querySelector('.tdk-pos');
      let at = 0, done = false, resolve;
      const p = new Promise((r) => { resolve = r; });
      const go = (i) => {
        at = Math.max(0, Math.min(n - 1, i));
        track.style.transform = `translateX(${-100 * at}%)`;
        slides.forEach((s, j) => { s.classList.toggle('on', j === at); s.setAttribute('aria-hidden', j === at ? 'false' : 'true'); });
        dots.forEach((d, j) => d.classList.toggle('on', j === at));
        prev.disabled = at === 0;
        next.textContent = at === n - 1 ? last : 'Next →';
        if (pos) pos.textContent = n > 1 ? `${at + 1} of ${n}` : '';
      };
      const close = (finished) => {
        if (done) return; done = true;
        el.classList.remove('on');
        document.removeEventListener('keydown', onKey, true);
        setTimeout(() => el.remove(), 260);
        OPEN = null;
        try { if (opts.onDone) opts.onDone(!!finished); } catch (e) {}
        resolve(!!finished);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); close(false); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); if (at < n - 1) go(at + 1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); go(at - 1); }
      };
      next.addEventListener('click', () => {
        if (at < n - 1) return go(at + 1);
        close(true);
        if (opts.cta && typeof opts.cta.go === 'function') setTimeout(() => { try { opts.cta.go(); } catch (e) {} }, 220);
      });
      prev.addEventListener('click', () => go(at - 1));
      el.querySelector('.tdk-x').addEventListener('click', () => close(false));
      const sk = el.querySelector('.tdk-skip'); if (sk) sk.addEventListener('click', () => close(false));
      el.addEventListener('click', (e) => { if (e.target === el) close(false); });
      document.addEventListener('keydown', onKey, true);
      /* a sideways swipe moves a slide; an up-down one is left alone */
      let x0 = null, y0 = 0;
      const view = el.querySelector('.tdk-view');
      view.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
      view.addEventListener('touchend', (e) => {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(at + (dx < 0 ? 1 : -1));
      }, { passive: true });
      go(0);
      /* focus goes to the card, not the button: a screen reader announces the deck, and
         a phone does not paint a focus ring on a button nobody touched */
      const card = el.querySelector('.tdk-card'); card.setAttribute('tabindex', '-1');
      requestAnimationFrame(() => { el.classList.add('on'); try { card.focus({ preventScroll: true }); } catch (e) {} });
      OPEN = { close };
      return p;
    } catch (e) { return Promise.resolve(false); }
  }

  /** A deck that plays once per scope (an account, a sample) on this phone. */
  function first(id, opts = {}) {
    if (seen(id, opts.scope)) return Promise.resolve(false);
    mark(id, opts.scope);
    return open(id, opts);
  }

  window.Tips = { decks: D, open, first, seen, mark, isOpen: () => !!OPEN, close: () => { if (OPEN) OPEN.close(false); } };
})();
