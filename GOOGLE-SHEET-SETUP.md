# Your Google Sheet — how to switch it on

Written for Perry. Fifteen minutes, once, and then it fills itself in every night.

Everything is already built. What is left is the part no code can do for you:
making a Google robot account and letting it write to your spreadsheet.

**Nothing here is urgent and nothing breaks while it is switched off.** Until the
three settings exist, the Studio simply says "Not connected yet" and MySet carries
on exactly as it does now.

---

## What you end up with

One spreadsheet, eleven tabs (the sync styles them itself — header rows bold white on
the brand pink-orange and frozen, row titles bold on a pale tint, columns sized):

| Tab | What's in it |
|---|---|
| **Guide** | Written for you, in plain words. What every other tab holds. |
| **Artists** | Everyone who signed up. Plan, join date, who sent them, where they came from, whether they can take money, how many nights they've played. |
| **Shows** | One row per finished gig. Venue, city, people in the room, votes, top song, what it took. |
| **Songs** | Every song in everyone's library, how often it was played, how many votes it has ever pulled. |
| **Requests** | Songs the room asked for that weren't on the list. The best answer to "what should I learn next". |
| **Ratings** | What the audience thought of MySet — stars and their own words. |
| **Gigs** | The calendar. Every gig booked, past and future, and where in the world. |
| **Venues** | Bars that signed up, their plan, whether they're verified. |
| **Growth** | One row every time it syncs. The running totals — this is the tab to chart. |
| **Signals** | The marketing read, one row per artist: where they came from, how often they play, how big the rooms are, whether the room pays, how fast they got to a first show, whether they are still active — and a *Segment* derived from those numbers (residency / regular / occasional / not yet played / gone quiet). |
| **Features** | What each artist actually uses — one column per feature, as a count or a yes, and a score out of 24. Sort a column to see which features are used and by whom. |

**Shows, Requests and Ratings only ever get added to.** Nothing rewrites a row you
have already charted. **Artists, Songs, Gigs and Venues** are wiped and rewritten
each time, because they are a picture of right now.

---

## Step 1 — make the spreadsheet

1. Go to [sheets.new](https://sheets.new). Call it something like **MySet data**.
2. Look at the address bar. It reads
   `docs.google.com/spreadsheets/d/`**`1AbC…long…XyZ`**`/edit`.
   That long middle bit is the **sheet id**. Copy it somewhere.

Leave the tabs alone — MySet creates all eleven itself the first time it runs. (On
2026-09-14 the founder's Drive already received **MySet data** with every tab filled
from a read-only copy of the store — the sync will find those tabs, rewrite the
snapshots and add only the nights it does not already hold.)

---

## Step 2 — make the robot account

This is a "service account": a Google login that belongs to a program rather than
a person. It is the only way for MySet to write to a sheet without you staying
signed in somewhere.

1. Go to [console.cloud.google.com](https://console.cloud.google.com/).
2. Top left, next to the Google Cloud logo, make a **new project**. Call it
   **MySet**. Wait for it to finish, then make sure it is the one selected.
3. Search the top bar for **Google Sheets API** → open it → **Enable**.
   *(This is per-project. If you skip it, everything else works and every write
   fails with "Sheets API has not been used in project…".)*
4. Search for **Service Accounts** → **Create service account**.
   - Name: `myset-sheets`
   - Skip the two optional "grant access" steps → **Done**.
5. You now see it in a list, with an address like
   `myset-sheets@myset-123456.iam.gserviceaccount.com`. **Copy that address.**
6. Click it → **Keys** tab → **Add key** → **Create new key** → **JSON** →
   **Create**. A `.json` file downloads.

**That file is a password.** Do not email it, do not paste it into a chat with me,
do not put it in the MySet folder. Open it, take the two things you need, then
delete it.

---

## Step 3 — share the sheet with the robot

**This is the step everybody forgets, and Google's error for it is useless.**

Open your spreadsheet → **Share** → paste that
`…iam.gserviceaccount.com` address → set it to **Editor** → **Send**.
It will warn you that the address isn't a Google account. Share anyway.

Without this, MySet gets a flat "403 permission denied" no matter what else is
right. The Studio spells this out if it happens, so you'll know.

---

## Step 4 — put three settings into Netlify

Netlify → **mysetvip** → **Site configuration** → **Environment variables**.
Add three, all scoped to **All contexts**:

| Name | Value |
|---|---|
| `GSHEET_ID` | the long id from step 1 |
| `GSHEET_EMAIL` | the `…iam.gserviceaccount.com` address |
| `GSHEET_KEY` | the `private_key` value out of the JSON file |

For `GSHEET_KEY`: open the downloaded JSON in a text editor. Find
`"private_key": "-----BEGIN PRIVATE KEY-----\nMIIE…"`. Copy **everything between
the quotes** — including the `-----BEGIN`/`-----END` lines and the `\n` bits.
Paste that whole string in as the value. Leave the `\n`s exactly as they are;
MySet handles both forms.

Tick **Contains secret value** on `GSHEET_KEY`. Netlify then hides it from
everyone, me included — which is correct, and is why I cannot check it for you.

Now **delete the downloaded JSON file**, including from your Trash.

An environment variable only takes effect on the next build, so push any commit
(or hit **Trigger deploy** in Netlify) once you've saved all three.

---

## Step 5 — check it, and fill it

Studio → **Settings** → **Your Google Sheet**.

- **"Not connected yet"** and a list of names → one of the three settings is
  missing, or the site hasn't rebuilt since you added them.
- **"Set up, but Google said no"** → it tells you which of the two it is.
  A 403 is step 3. A 404 is a wrong `GSHEET_ID`.
- **"Connected"** → tap **Update the sheet now**. First run takes a few seconds
  and creates all nine tabs.

After that it runs itself at **03:20 UTC every night**. The button is there for
when you want it sooner.

---

## Worth knowing

**It is a copy, never the source.** Nothing in MySet ever reads this sheet. Edit
it, chart it, delete a tab, delete the whole spreadsheet — the app does not
notice and no real data is lost. Make a new one and press the button.

**Money in the Shows tab is what that night took**, saved when the show ended.
Stripe is still the real ledger for anything that has to balance. A blank means
Stripe was switched off that night, not that the night earned nothing — the
"Money source" column says which.

**No audience member is identified.** Phones are counted, never named. There is
no device id anywhere in the file, by design.

**Artists' email addresses are in it.** They are your users on your platform, in
your private spreadsheet — which is normal, and worth knowing before you share
the link with anybody.

**It is bounded on purpose.** One sync reads up to 400 artists and up to 40 new
nights each. Over that, it does what it can and the Growth tab's last column says
so — then the next run picks up the rest. It will never half-finish quietly.

**A failed sync loses nothing.** The "how far did I get" marks only move after a
write succeeds, so a run that dies halfway re-sends the same rows next time.

**It will never fill up on you.** Google stops a spreadsheet at ten million cells.
Every sync measures the one in use — the Studio's Sheet card shows the percentage
and links it. At **60%** you get one email saying so. At **80%** the nightly sync
makes a new spreadsheet itself (named after the old one, with the date it took
over), shares it with the same addresses as an editor, emails you the link and
carries on there the same night: the log tabs (Shows, Requests, Ratings)
continue in the new sheet from that night, the snapshot tabs are rewritten there
in full, and the old sheet is left exactly as it was — still yours, still linked
from the Studio card. Nothing is moved or deleted. You never have to change
`GSHEET_ID`: it is only where the chain starts. If you would rather the new
sheets go to other addresses, set `GSHEET_SHARE` in Netlify (comma-separated);
otherwise they go to the owner addresses on the founder's account. (The robot
needs no extra permission for this — it creates the new file itself, and the
only Drive access it asks for is to files it created.)

## When something changes in the app

The tab layout lives in `TABS` and `HEAD` in `netlify/functions/_warehouse.mjs`.
Adding a column means adding it to `HEAD` **and** to the row builder in the same
file — and then, once, deleting that tab in the sheet so it gets rebuilt with the
new header. Log tabs (Shows, Requests, Ratings) keep whatever header they were
created with, which is deliberate: a column that silently shifts is worse than a
tab you re-made on purpose.
