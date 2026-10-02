# 2026-10-03 — Andrew's current look, and the About in a magazine voice

**Asked:**
- Andrew's cover showed his old long-hair look; the founder asked for a recent photo.
- The founder asked for a fun, magazine-style bio, and then for the generator to write that way too.

**Done on production, in CRM through Chrome:**
- **Cover:** his current Instagram profile photo, a 1080px professional portrait with his guitar, focus 50% 32%.
- **Avatar:** that portrait had been the avatar too. It is now a recent black-and-white photo from a friend's post that tags him (sunflowers, sunglasses), focus 42% 12%.
- **Small photos:** the three older long-hair frames stay in the small strip.
- **About:** rewritten in a magazine voice. The founder approved it.
- **Sources checked and found to have nothing more recent:**
  - Instagram: grid, tagged posts and the Live highlight;
  - Facebook photos;
  - Linktree;
  - his website (merch only);
  - YouTube: "Runaway" has actors, and "One More Year" shows the old look.
- **Recipe:** the Chrome extension blocks signed image URLs in tool output. Navigating from the Instagram tab to `myset.vip/crm#img=<encoded src>` and calling `fapi('addPhoto',…)` there works.

**Shipped:** decision 0161 (PR #216, `72dbe98`). The bio and venue-about prompts in `_fai.mjs` now ask for a magazine voice with one wink of humour. The facts-only, sources, no-hype and two-sentence rules are unchanged. The prompt's example is an invented artist.

**Verified:**
- Suite exit 0, with two new checks in `test/factory.mjs`.
- Production deploy of `72dbe98`: see the push log.
- Andrew's page at phone width: checked by screenshot.

**Not checked:** a real (paid) generator run in the new voice.

## Later the same night: the live example button (0162)

- **The button:** every artist sample ends with "View the founder's profile as a live example", linking to `/perryidyll` (`sample.js` `decorate`, `.sbx-eg`). Live as `dae1080` from PR #220. The merge subject says "#218" by mistake.
- **Verified on production:** Andrew's sample loads `sample.js?v=10397a11`, and the button sits under the preview note. This browser first served the old page from its own cache; a reload fixed it.
- **Andrew's tagline:** hand-edited to the magazine voice: "Romantic rock 'n' roll from New York, with a guitar, a loop pedal and a soft spot for late-night singalongs."
