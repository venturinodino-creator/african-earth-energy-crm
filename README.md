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
| **Playbook** | Cold emails, discovery script, objection handling, qualification checklist |

## The fit score

Every offtaker gets a score out of 100 so the call list can be sorted by who is
most likely to sign. It weighs five things:

| Factor | Weight | Why it matters |
| --- | --- | --- |
| Annual consumption | 30 | Below ~20 GWh/yr the transaction cost rarely justifies itself |
| Load factor | 22 | A flat 24/7 load is far easier to serve with solar plus storage than a spiky one |
| Tariff headroom | 20 | The gap between what they pay now and a target PPA tariff is the whole pitch |
| Wheeling feasibility | 16 | A confirmed wheeling route removes the biggest single blocker |
| Distance to nearest site | 12 | Short wheeling paths mean lower use-of-system charges |

The maths is in [`js/core.js`](js/core.js) — `fitScore()`. Change the weights there
if the team's experience says something different.

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

Everything is kept in the browser's `localStorage` under the `aee_crm_` prefix.
That means:

- each person has their own working copy, and nothing is shared automatically
- clearing site data wipes it — export before doing that
- **Export offtakers / contacts / pipeline** produces CSV for sharing or backup
- **Import contacts** reads a CSV with a header row and matches companies to
  existing offtakers by name; anything unmatched is filed as unassigned
- **Reset data** in the sidebar restores the seeded starting set

If the team outgrows per-browser storage, the natural next step is a shared backend
(the netherlands-crm repo uses Supabase for this) — `load()` and `save()` in
`js/core.js` are the only two functions that would need to change.

## Layout

```
index.html              app shell, sidebar, modals
landing.html            public-facing entry page
styles.css              design system
animations.css/.js      motion layer (decorative, honours prefers-reduced-motion)
data/seed.js            projects, offtakers, contacts, playbook
js/icons.js             inline SVG icon set
js/core.js              state, storage, routing, helpers, fit score, CSV
js/views-dashboard.js   dashboard + pipeline board
js/views-offtakers.js   offtaker list, detail page, contacts
js/views-tools.js       projects, map, analytics, calculator, playbook, activity
js/forms.js             create / edit / delete
```

## Deploying

GitHub Pages serves `main` from the repository root, so pushing to `main` publishes.
There is no build step and no workflow to maintain — the site is the files in this repo.

- `index.html` is what the Pages URL serves: the CRM itself
- `landing.html` is the overview page, linked from the sidebar logo
