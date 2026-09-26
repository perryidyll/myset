# 2026-09-26 — Stripe's own fee on every night

**Asked:** always show the exact Stripe fees, not the estimate.

**Done (EVS-005, a fourth amendment to decision 0095):**

- `_history.mjs`: `moneyForShow` asks for each payment's balance transaction with the
  session list. `feeOfSession()` takes every fee line except `application_fee` and converts a non-USD
  settlement at its own rate. The night files `money.fees {usd, charges, missing}`. If
  Stripe refuses the expansion, the takings are read without it. The index row gets
  `stripeFees`, which is exact or null.
- `_register.mjs`: `rowSig` includes `stripeFees`, and the rows carry it (merged nights
  summed). `recheckSome` asks each older counted night once for its fee
  (`work.feesAsked`), two a ring, only once the morning-after ask is behind it.
- `_showcosts.mjs` and `finance/shows.html`: the table uses the exact fee where it is
  filed and the estimate only where it isn't, marked ≈. Merch orders stay the estimate.
- **Fresh-context review before merge:** the reviewer found that the first backfill
  re-read each old night's whole money record and could rewrite it (Stripe down →
  "unknown"; a connected account read on the platform → a "known" $0). Fixed:
  `refreshShowFees` writes the fee alone and only when Stripe's takings match the
  night's to the cent. The fee lines now include tax on Stripe's fee (everything but
  `application_fee`). The asks sit inside a time box and run two a ring. Left as noted:
  merged nights can count one untagged payment's fee twice (rare, cents), and the Money
  tab's live read now carries the expansion.
- `test/stripefees.mjs`: new, 29 checks, added to `test/run.sh`.

**Live:** `5a25263` (PR #104), deploy ready 07:05 UTC. No fold ran until 08:27 (the register folds only on a mark or the six-hourly walk); from then two nights a ring. At 08:52: 6 of 12 exact, and 20 Sep's $35 night reads Stripe's own **$2.67**, where the estimate said $2.28 — the published-rate estimate runs about 17% low for these rooms.

**Not verified before the merge:** a real Stripe answer with the expansion. Tests run against the fake,
and this session never handles the founder's Stripe keys. Production is checked after
the merge by watching `shows.json` gain `stripeFees` as the register asks.
