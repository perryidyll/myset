# Kept off the landing page — on purpose

Perry, 2026-09-06: *"still keep track of all these info but there is simply no need
or benefit to including it on the landing page."*

Everything below is **true and current**. It was removed from `public/about.html`
because it is clutter on a sales page, not because it is wrong. A person meets each
of these in the Studio at the moment it actually matters to them.

If you ever want a page that carries this, it is a **pricing page**, not the
landing page.

---

## 1. Plans, tiers and prices

| | Free | Plus | Pro |
|---|---|---|---|
| Price | $0 | $10/mo | $20/mo |
| Shows | 4 per UTC calendar month | unlimited | unlimited |
| Room size | 200 | 1,000 | 2,000 |
| Songs live to the room | 50 of 2,000 kept | unlimited | unlimited |
| Platform cut | 10% | 2% | 0% |
| Sign-ins | 1 | 1 | 5 |
| Own vote/pack pricing | — | ✓ | ✓ |
| Separate setlists | — | ✓ | ✓ |
| Merch | — | ✓ | ✓ |
| Delete a post for good | — | ✓ | ✓ |

Source of truth: `netlify/functions/_plan.mjs`. **Never repeat these numbers in
prose** — read them from `PLANS`, the way `test/limits.mjs` does.

Venues have their own ladder: Free, and **Pro at $20/month**, bought through the
same Stripe Checkout (`venueadmin.mjs:406-426`).

## 2. The four Pro features that are designed and not built

`promote`, `analytics`, `presskit`, `branding` — `_plan.mjs:130` `NOT_BUILT`.
The Studio greys these on **every** plan including Pro, so Perry (comped to Pro)
never opens a dead end. Deleting a name from that list is the *last* step of
building the feature.

The old landing page marked these "Soon" in hand-typed HTML with no link to
`NOT_BUILT`. That is one of the drifts the audit found, and removing the pricing
block removed it.

## 3. Money mechanics

- Direct charges on Stripe Connect: **the artist is the merchant of record**, so
  Stripe's card fee (~2.9% + 30¢) comes off the artist's side, on top of MySet's
  cut. The Studio says this before onboarding; the landing page must not.
- MySet's cut is an `application_fee_amount` and it applies to **tips as well as**
  vote sales and merch.
- Venue splits are a different mechanism entirely (`_connect.mjs:83`, `_venues.mjs:131`)
  and exist only for venues, never for artist plans.
- There is deliberately **no in-app refund button** — a fan refund is done in the
  artist's own Stripe dashboard.
- Payouts are daily, into the artist's own account, in one of 22 countries; the
  country cannot be changed after onboarding.

## 4. The verified tick

Paid plans only. Granted automatically when Stripe's identity check matches the
artist's **legal name and date of birth**, or by hand from the founder's review
queue. It disappears by itself the day a plan lapses. `_verify.mjs`.

## 5. Vote finality

`voteFinal` in `_flags.mjs` **defaults ON** — a confirmed vote cannot be taken
back. Off is a real, working alternative (a second tap refunds) and can be flipped
globally or per artist.

The page now shows this instead of stating it: `/about/confirm.webp` is the real
sheet, and the words *"Are you sure? Votes can't be changed!"* sit under its own
Confirm button, where the room actually meets them.

## 6. Feature gating the page no longer mentions

Creating a **new setlist** is Plus (`admin.mjs:735`, 402). Changing **vote rules
and pack prices** is Plus (`admin.mjs:1706`). **Deleting a post for good** is Plus
for artists, Pro for venues — hiding is free, instant and undoable on every plan.
A **second sign-in** is Pro (`auth.mjs:395`).

## 7. Things that are FREE and were never plan-gated, despite the Studio implying it

- **Shows that start and end themselves** from the gig calendar. `_auto.mjs` has
  no plan gate at all. The Studio's own plan cards list it under Plus/Pro — that
  is a bug in `studio.html:3531,3545`, not on the landing page.
- **Lyrics**, deliberately: anything the *room* experiences stays free, on every
  plan, forever (`_plan.mjs:6-16`).
- The **community page**, the **earnings statement**, and **room overflow never
  turning anyone away**.

## 8. Room overflow

Going over the plan's room size is a billing line, not a turnstile: the room polls
a little slower and the board shortens to the top 40. **No vote is ever refused.**
Worth saying on the page one day, in the Free card of a pricing page — not here.

---

## Also removed, and why

- **The interactive vote demo.** Perry's call. It taught three things the room does
  not do: that a second tap takes your vote back (`voteFinal` defaults on), that
  everyone gets 3 free votes (the default is 5), and that one tap is one vote
  (there is a quantity stepper).
- **The three "honest notes."** Two of them denied features that had shipped —
  the Plus/Pro checkout, and card payments for every artist. Deleting the pricing
  block deleted them.
- **The old five screenshots** (`vote.png`, `studio.png`, `ask.png`, `profile.jpg`,
  `fills.png`). Four of five predated the code they showed; `profile.jpg` still
  said "Audience" months after the app renamed it "Fans". They are **unreferenced
  but still on disk** (481 KB) — say the word and they go.
