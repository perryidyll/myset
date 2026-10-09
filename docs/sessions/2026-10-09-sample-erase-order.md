# 2026-10-09 — A sample page is erased leaves first (scale audit leftovers)

**Asked:** the founder, 2026-10-09: do every audit item that needs no answer from him. The morning's pass over the audit found the sample half of *delete leaves first, index last* not started.

**Built (branch `fix/sample-erase-order`, decision 0204, INVARIANT 0jg, ledger SCL-027):** `eraseData` uses 0173's `eraseKeys` (walked from the end, pictures first, the record last) and throws on the first failed delete or read, so no caller drops the register row over files left behind.

**Verified:** `test/sampleerase.mjs` 8 ✓ (Delete forever killed after each of 0…5 deletes); two knock-outs red; `test/samples.mjs` 131 ✓.

**Not done, and why:** the register fold's per-month rewrite (*the show register re-reads all history every 10 minutes*) is a larger change to the founder's dashboard feed, off the gig path, and safe at today's size; left for its own pass.
