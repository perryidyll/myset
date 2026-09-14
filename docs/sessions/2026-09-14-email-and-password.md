# 2026-09-14 — Email + password, the standard door (ACC-001, decision 0070)

**Asked.** After the accounts report (the artifact *MySet Artist Accounts*), the
founder: build path A "but do B too — the fully standard shape where the email
address is the username", plus his own spec, typed before reading it: a way to
get a new code by entering the account's email; once the account exists, the
option in Settings to create a password that replaces the code; the sign-in
screen — email field with the password beneath, a thin pink-orange border, a big
pink-orange *Welcome back*, a bright pink-orange filled *Sign in*; below it in
pink-orange *New here? Join the MySet family* with a pink-orange-bordered
*Create account*; the Studio code as small underlined grey text at the foot that
opens a pop-up. And a standing rule: whenever he says "orange" he means the brand
pink-orange (`--accent-2`, `#FF5650`) — noted in memory, globally.

**Built** in a worktree off `origin/main` `44f3a21` (branch `auth/password-door`):

- `netlify/functions/_cred.mjs` — scrypt from `node:crypto` (salted, N=2¹⁴ r=8
  p=1, ~40 ms), `cred_<owner>_<hash of email>` one per sign-in address,
  constant-time compare, a missing record scrypted against a fixed salt so the
  cost is the same; `weakPassword` (8–128, not the email, not one character
  repeated, not the twenty everybody tries); a per-address, per-realm lockout
  (`lock_pw_<hash>`, five wrong, fifteen minutes).
- `auth.mjs` — `passwordSignIn` (public; one sentence, one status for every
  failure; mints the session through the same `open()`), `passwordSet` (any role,
  own address; `current` or a fresh `code`; signs the address's other devices
  out), `passwordClear`; `list` carries `pw` per email. `venueauth.mjs` the same
  in realm `v`, owner `v_<vid>`. `_account.mjs` / `_venueaccount.mjs`: `credKey`
  in the delete list, never in the export.
- `studio.js` — the gate rewritten: `start` (the welcome-back box), `join`,
  `forgot`, `code`, `name`, `recover`; `openStudioCode()` → `#pop` (the same
  shape as the *End current song?* window); `passwordSignIn()`; `PW_PROMPT` —
  after a code sign-in with no password on the address, `loadTeam` opens the
  password sheet once, skippable. Settings → *Signing in* → *Password · set /
  not set · Create / Change*; `openPasswordSheet()` with current-password or
  *Forgot it? Email me a code instead* (`pwForgotCode` → code field), new
  password twice, `savePassword()`. `venue-studio.js` mirrors all of it (no
  passkey, no recovery codes there; the foot link is *Artist Studio →*).
- `studio.html` / `venue-studio.html` — `.signbox` (inset 1.5 px `--accent-2`
  ring), `.gate h2` 34 px `--accent-2` centred, `.big.fill` / `.big.ring` /
  `.big.keep`, `.signlinks`, `.join`, `.foot` (muted, underlined), `#pop`; the
  gate's `.inp:focus` ring in `--accent-2` too. `tools/stamp.mjs` run.

**Verified.** `sh test/run.sh` exit 0, 48 files, **3,047 ✓ / 0 ✗** — new
`test/password.mjs` 50 ✓ (the ledger's verification row lists what each holds);
`MYSET_PUBLIC=<wt>/public node tools/uicheck.mjs` 239 ✓ / 0 ✗; `sheetcheck`
39 ✓; headless Chrome at 390 px, both themes: `Welcome back` computes to
`rgb(255, 86, 80)`, the box's inset ring the same, *Sign in* fill the same,
*Create account* text the same, the foot link `rgb(110, 110, 115)` underlined;
the window opens on the foot link and reads *Studio code · The code set in
Settings for this page · Unlock · Back*; `join` and `forgot` screens; the venue
screen. Shots `b13-signin-light.png`, `b13-signin-dark.png`,
`b13-studiocode.png`, `b13-join.png`, `b13-forgot.png`, `b13-venue-signin.png`
(scratchpad). Not checked: a real inbox end to end — the founder's own account
still has no email row (run sheet 5 / 12).

**Decided on the way.** The Studio code is left as it was (per page, SHA-256,
checked on every request) — hashing it slowly would cost every Studio poll; it
is a door for the founder and for a phone with no email, and it now lives in
the window. "Replaces that code" means: with a password set, sign-in needs no
inbox; the code is not removed — it is *Forgot your password?* and it is how an
account is made. No breach-list lookup on the sign-in path.

**Docs.** Decision 0070; INVARIANT 0fu (end of *Artist sign-in*); ACCOUNTS.md
§9f revised + §11; overview §5.5; ledger ACC-001, header, next work item,
verification and decision logs; Puzzle changelog 1661; the accounts artifact marked
built; memory: "orange" = pink-orange.
