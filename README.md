# African Earth Energy — Offtaker CRM

A sales workspace for the African Earth Energy team: find, qualify and track the
commercial and industrial buyers for roughly 1 GW of South African solar-plus-storage
capacity in development.

Live site: <https://venturinodino-creator.github.io/african-earth-energy-crm/>
Company site: <https://www.aeeg.co.za/en>

---

## What it does

| Screen | What it is for |
| --- | --- |
| **Dashboard** | The morning view — today's call list, funnel by stage, sector mix, capacity allocation, recent activity |
| **Pipeline** | Drag-and-drop board of PPA opportunities across seven stages, with weighted contract value |
| **Offtakers** | The target list. Grid or table, filterable by sector, status and province, sortable by fit score |
| **Offtaker detail** | Everything needed before a call: load profile, supply authority, wheeling, nearest site, people, indicative saving, pre-filled templates |
| **Contacts** | People at each offtaker, with role in the decision. CSV import and export |
| **Activity** | Every logged call, email and meeting, plus target close dates |
| **Projects** | The AEE generation portfolio and how much of each site is already spoken for |
| **Map** | Offtaker load plotted against generation sites, sized by annual consumption |
| **Analytics** | Load by province and sector, fit distribution, where the pipeline value actually sits |
| **Savings calculator** | Model a wheeled PPA against the buyer's current tariff over the contract life |
| **Sectors** | 30 sectors with tier, PPA fit, load shape, deal structures, sales cycle and who to call. Each opens to its own page with qualifying questions and objections |
| **Prospects** | The 264-company prospecting list, filterable by sector, tier and status, with one-click promotion to an offtaker |
| **Playbook** | Ranked shortlists, market context, cold emails, discovery script, objection handling, qualification checklist |

## The fit score

Every offtaker gets a score out of 100 so the call list can be sorted by who is
most likely to sign. It weighs five things:

| Factor | Weight | Why it matters |
| --- | --- | --- |
| Annual consumption | 26 | Below ~10 GWh/yr the transaction cost rarely justifies itself |
| Load factor | 20 | A flat 24/7 load is far easier to serve with solar plus storage than a spiky one |
| Tariff headroom | 18 | The gap between what they pay now and the wheeled-solar midpoint is the whole pitch |
| Wheeling feasibility | 14 | A confirmed wheeling route removes the biggest single blocker |
| Sector PPA fit | 12 | The desk's own 1–5 rating for how readily that sector's load, connection and procurement suit a PPA |
| Distance to nearest site | 10 | Short wheeling paths mean lower use-of-system charges |

The maths is in [`js/core.js`](js/core.js) — `fitScore()`. Change the weights there
if the team's experience says something different.

## Access and security

The CRM is **not public**. Both pages — the app and the overview page — show
nothing but a sign-in card until Supabase confirms a session, and the data is
protected by Postgres Row Level Security rather than by anything in the
JavaScript. An unauthenticated visitor who opens the page, reads the source, or
calls the API directly gets an empty list and cannot write a single row.

Every table in the project is covered, including `mining_leads`, which carried
an `Allow public read access` policy from earlier work and is now behind the
same role gate.

One honest caveat: this is a static site, so the *markup* of the overview page
is readable in the page source whatever the gate does. That page is written to
contain nothing that is not already on aeeg.co.za. The wall that matters is on
the data, and that one is enforced by the database.

Three roles, stored in `public.profiles`:

| Role | Can do |
| --- | --- |
| `pending` | **Nothing.** New accounts start here — even a self-registered one sees no data |
| `viewer` | Read every record; export CSV. All editing controls are hidden |
| `admin` | Everything, including add / edit / delete and CSV import |

`pending` being the default is deliberate: access is granted explicitly, so
leaving public signups enabled in Supabase still exposes nothing.

### Usernames, not email addresses

The team signs in with a plain username. Supabase Auth has no username
provider — an account is always identified by an email address — so the login
form completes a bare username to a fixed domain:

```
dino            →  dino@aeeg.co.za
karen metcalf   →  karen.metcalf@aeeg.co.za
someone@x.com   →  someone@x.com          (anything with an @ passes through)
```

The domain is `AUTH_DOMAIN` in [`js/supabase.js`](js/supabase.js), mirrored in
`landing.html`. Change both together if it ever moves. Input is lower-cased and
spaces become dots, so capitalisation and stray spaces do not matter.

For a synthetic `@aeeg.co.za` address the address is only ever an identifier —
nothing is sent to it, and there is no self-service "forgot password": resetting
one means an admin setting a new password in the Supabase dashboard.

**The owner account is deliberately on a real address** (a reachable mailbox)
and signs in with it in full, so recovery for the one account that holds admin
over everything does not depend on the dashboard. Short usernames are for the
reps. The login box accepts either.

### First-time setup

1. **Create your account.** In the Supabase dashboard for the
   *Energy Lead Dashboard* project → **Authentication → Users → Add user →
   Create new user**. In the email field type the username in full address
   form — `dino@aeeg.co.za` for the username `dino` — set a password, and tick
   *Auto Confirm User*. Your team then only ever types `dino`.

   **The first account created becomes `admin` automatically** — the signup
   trigger grants it, so there is no second step and no password has to be
   shared with anyone. Every account after the first starts on `pending`,
   so this cannot be used later to escalate.

   If you ever need to check or force it:
   ```sql
   select email, role from public.profiles;
   update public.profiles set role = 'admin' where email = 'you@aeeg.co.za';
   ```
2. **Add your sales team** the same way, then grant each of them a role:
   ```sql
   update public.profiles set role = 'viewer' where email = 'rep@aeeg.co.za';
   ```
   Use `viewer` for reps who should not change the shared data, `admin` for
   those who should.
3. **Turn off public signups** (recommended, belt and braces):
   **Authentication → Sign In / Providers → Email → uncheck "Allow new users
   to sign up"**. Role-gating already blocks self-registered accounts from
   seeing anything; this stops them being created at all.

### Checking who has access

```sql
select email, role, created_at from public.profiles order by created_at;
```

## The sector taxonomy

29 non-mining sectors, 164 sub-sectors, 107 qualifying questions, 39 objections
with responses, 22 contact roles and the market context the desk works to — all
from `AEEG-offtaker-sectors.xlsx` v1.1.0, and all in
[`data/sectors.js`](data/sectors.js). It ships with the app because it is market
knowledge rather than pipeline.

The taxonomy is deliberately **non-mining**. AEE's mining prospects are tracked
as offtakers in their own right, so `MINING_SECTOR` keeps a 30th sector alongside
the 29 for them.

Two things it drives that are easy to miss:

- **Open any offtaker and you get that sector's qualifying questions and the
  objections you will hear**, with responses. That is the piece a rep has open
  during the call.
- **Tariff benchmarks feed the calculator's defaults.** Megaflex all-in is taken
  as R2.00–2.60 and wheeled solar as R1.15–1.45, so the opening comparison is
  R2.30 against R1.30 — a R1.00/kWh gap, about 43%. Earlier defaults were
  guesses that understated the saving.

## Prospects vs offtakers

| | Prospect | Offtaker |
| --- | --- | --- |
| What it is | A named company in a sector | An account being worked |
| Has load data | No | Yes, even if estimated |
| Fit scored | No | Yes |
| Where | `aee_prospects` | `aee_offtakers` |

A prospect carries a name, a sector and a note. It is not fit-scored, because
scoring a record with no load data would put 264 zeros at the top of the call
list. **Promote** moves it across once the load is known, and that is when it
starts being ranked.

## The numbers, and how much to trust them

- **Generation portfolio** — real, taken from <https://www.aeeg.co.za/en/projects>.
- **Offtaker load figures and tariffs** — *desk estimates*. They are there so the app
  is useful on day one, not because they are verified. Records carrying an
  `estimated load` chip should be confirmed with the customer before anything is quoted.
- **Contact names** — mostly role placeholders (`Procurement Lead`, `Energy Manager`).
  Replace them with real people as the team qualifies each account.
- **Deal values** — assume a 30% capacity factor on contracted MW. Indicative only.

Nothing in this repo should be sent to a customer as a quote.

## Running it

It is static HTML, CSS and JavaScript with no build step and no backend.

```bash
python -m http.server 8000
```

Then open <http://localhost:8000/landing.html>. Opening `index.html` straight from
the filesystem also works — the seed data is loaded as a plain script rather than
fetched, precisely so that it does.

## Data and storage

Offtakers, contacts, opportunities and the activity log live in Supabase, so the
whole team sees the same data on every device. Edits are written per record as
they happen.

- **Supabase project:** `Energy Lead Dashboard` (`pkzfazjtpswqjmnzzrgt`, eu-west-1)
- **Tables:** `aee_offtakers`, `aee_contacts`, `aee_deals`, `aee_interactions`,
  `aee_prospects`, plus `profiles` for roles. They are namespaced `aee_*` so they sit alongside
  the pre-existing `mining_leads` table without touching it.
- **The generation portfolio is not in the database.** It is AEE's own published
  project list, so it ships in `data/seed.js` and needs no sync.
- **Local cache:** the last successful read is kept in `localStorage` purely so a
  dropped connection shows the last known data instead of an empty app. It is
  never written back to the server.
- **Export offtakers / contacts / pipeline** produces CSV for sharing or backup.
- **Import contacts** reads a CSV with a header row and matches companies to
  existing offtakers by name; anything unmatched is filed as unassigned.

The URL and publishable key in `js/supabase.js` are meant to be public — they
identify the project and grant nothing on their own.

## Layout

```
index.html              app shell, sidebar, modals
landing.html            public-facing entry page
styles.css              design system
animations.css/.js      motion layer (decorative, honours prefers-reduced-motion)
data/seed.js            generation portfolio, pipeline stages, outreach templates
data/sectors.js         sector taxonomy, questions, objections, roles, market context
js/icons.js             inline SVG icon set
js/supabase.js          auth, row mapping, reads and writes
js/core.js              state, routing, helpers, fit score, auth gate, CSV
js/views-dashboard.js   dashboard + pipeline board
js/views-offtakers.js   offtaker list, detail page, contacts
js/views-sectors.js     sectors, one-sector page, prospects list
js/views-tools.js       projects, map, analytics, calculator, playbook, activity
js/forms.js             create / edit / delete
```

## Deploying

GitHub Pages serves `main` from the repository root, so pushing to `main` publishes.
There is no build step and no workflow to maintain — the site is the files in this repo.

- `index.html` is what the Pages URL serves: the CRM itself
- `landing.html` is the overview page, linked from the sidebar logo
