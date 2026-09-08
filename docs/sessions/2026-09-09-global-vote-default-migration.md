# Global vote-default migration

The user reported that the first internal preview still gave the audience five free
votes. A read-only request against that draft confirmed the existing stored show still
contained 5 free votes, 5/$5 and 15/$10.

## Root cause and fix

Every show persists `freeCredits` and `packs`, so changing `defaultShow()` only affected
new records. `normShow()` now applies a versioned migration to unversioned documents:
exact former defaults become 3 free votes, 3/$5 and 15/$20. Non-default artist choices
survive. The next normal write persists version 2, after which any paid choice—including
five—is treated as deliberate and remains unchanged.

The free-spend ledger already stamps `freeUsed` at cast time. Lowering the allowance
therefore changes remaining free capacity without retroactively consuming a bought pack.
The Settings copy was also corrected: free votes are an allowance for the night, not for
each song.

## Evidence

- `test/defaults.mjs` starts with raw legacy documents and verifies migration, custom
  value preservation, and that post-migration choices stick.
- `test/tenancy.mjs` verifies a free artist is refused while a paid artist can choose a
  different allowance and the room receives it.
- `test/credits.mjs` verifies an allowance change cannot raid bought votes.
- Full suite: 1,735 assertions, 0 failures.
- Draft `6aa041448e6b1e3af49326be`: the existing stored room returned 3/3 free votes,
  3/$5 and 15/$20 from `/api/show`; corrected Settings copy was present.

Nothing was committed, pushed, or deployed to production.
