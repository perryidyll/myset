# 2026-10-09 — The Studio's clocks (scale audit leftovers)

**Asked:** the founder, 2026-10-09: keep going until the audit chain is merged, and do every item that needs no answer from him. A read-only pass over the audit's sixty findings that morning found the Studio half of *No request on any page has a timeout* not started, and the overlap half of *The Studio slows down exactly when the room is biggest* not started.

**Built (branch `fix/studio-clocks`, decision 0201, INVARIANT 0jd, ledger SCL-028):** `api()` races every call against a clock and aborts the request at it (GET 10 s, POST 20 s, first stage read 30 s, photo 60 s); the artist's own tap that gets no answer says it may still go through and reads the stage; seven calls that cannot use `api()` go through `clocked()`; the Live tab's four-second poll skips a lap while its last read is out. `tools/mock.mjs` gained `?slow=<ms>`.

**Verified:** `node test/studioclock.mjs` 30 ✓; knock-outs of the poll flag, the tap message and the abort each red, then restored. The browser pane against the mock at `slow=12000` and `slow=25000` (numbers in the decision record). The pane is hidden while the agent drives it, so `document.hidden` was overridden in the page for the poll check.

**Not checked:** a phone; a real slow store. The stage summary (the audit's other half) is not built.

**Numbers:** decision 0200 was claimed for this at 09:00 UTC, but security slice C (#150) merged at 08:40 UTC holding 0199/0200 and INVARIANTS 0jb/0jc, so this is 0201/0jd; the board says so.
