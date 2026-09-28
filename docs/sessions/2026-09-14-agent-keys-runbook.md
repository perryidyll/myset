# 2026-09-14 — Agent keys: a Netlify token the agents can use but never read

**Asked:** a rated comparison of "human-outside-the-loop" secret management for AI agents, then "complete the entire 4-step plan" it proposed for MySet.

**What was found.** The plan's step 02 was to install Infisical's Agent Vault (an open-source credential proxy). Reading Claude Code's own sandbox docs showed the same mechanism is built in since 2.1.199 (the Mac runs 2.1.266): `sandbox.credentials.envVars` with `mode: mask` hands sandboxed commands a placeholder and the sandbox's TLS-terminating proxy injects the real value only for `injectHosts`; `mode: deny` on files blocks reads. Zero install, so it became the route for Claude Code sessions; Agent Vault is documented as the route for agents outside Claude Code (per-agent tokens, request log).

The credential that matters is the founder's Netlify login: every script in `tools/` uses the CLI's sign-in, and `tools/actuals.py` read the token straight out of `~/Library/Preferences/netlify/config.json` — the leak path.

**What changed.**
- `tools/actuals.py` — `token()` prefers `NETLIFY_AUTH_TOKEN` when set (inside a sandbox that is the placeholder), else the config file as before. Compiles. **Uncommitted.**
- `~/.claude/myset-agent-keys.json` (outside the repo) — the settings block: sandbox on, `allowUnsandboxedCommands: false`, `failIfUnavailable: true`, `network.tlsTerminate: {}`, allowed domains (api.netlify.com, myset.vip, *.netlify.app, github, npm, cdnjs, fonts), `NETLIFY_AUTH_TOKEN` masked → `api.netlify.com`, deny-read on the Netlify config, `~/.ssh`, `~/.config/gh`, `~/.docker/config.json`, `~/.netrc`, `~/.aws`, `~/.config/gcloud`, `~/.kube`, `~/.claude/settings.json`; Read-tool deny rules for the same plus `**/.env*`; `env`: `NODE_USE_ENV_PROXY=1`, `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1`.
- `~/.claude/merge-agent-keys.py` — asks for the token with `getpass`, backs up `settings.json`, deep-merges; `--rotate`, `--remove`. **Verified** on a copy of the real settings: merge then remove restores the original byte-for-byte; 12 allow rules kept, 10 deny rules added.
- Artifacts: the comparison (15 options, now including the built-in proxy at 8.4) and the runbook with the founder's four steps and what to expect at each.
- Ledger: PER-011.

**Not checked.** The live path — Netlify CLI through the TLS-terminating sandbox proxy — was not executed: the bundled CLI is not signed in on its own and signing in is the founder's. Step 3 of the runbook is that proof. `git push` via the Keychain helper inside the sandbox: not run. `actuals.py`'s raw `urllib` call through the proxy: not run.

**Left out on purpose.** GitHub/`gh` (Keychain today, HTTPS remote — a Basic-auth header base64-encodes the token, which plain substitution cannot see; left as is). Stripe, R2, Resend, Spotify, Sheets keys never leave Netlify; no local tool needs them.

**Push log:** nothing pushed.
