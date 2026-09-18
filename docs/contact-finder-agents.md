# The contact finder's agents

Two agents fill the Contact finder: one for offtaker companies, one for
the main municipalities. They research named people from official public
sources and write them to a review queue. **Nothing they find becomes a
contact on its own** — a person accepts each row in the Contact finder,
and accepting is what writes the `aee_contacts` record.

That gate is the whole design, and it is stated in
`supabase/schema.sql`: a scraped person is a claim about a real human
until someone checks it.

## Who does what

| Piece | Job |
|---|---|
| Contact finder screen | Queue a run; review, accept or discard what comes back |
| `.claude/agents/offtaker-contact-finder.md` | Research at companies — the seven ladder seats |
| `.claude/agents/municipality-contact-finder.md` | Research at the 20 main municipalities |
| `scripts/finder-agent.js` | Sign-in and every database write |

Research is judgement, so it belongs to a model. Signing in and shaping
a row must be exactly right every time, so it lives in code. The model
never sees a password, never builds a query, and cannot write a column
the script does not write.

## One-time setup

```bash
cp .env.example .env
```

Fill in `AEE_EMAIL` and `AEE_PASSWORD` — a CRM login with the **admin**
role. Row-level security blocks writes from anyone else, so a viewer
account signs in fine and then fails at the first write.

`.env` is gitignored. Keep it that way; never paste credentials into a
prompt, an issue or a commit.

Node 18 or newer. No dependencies to install.

## Running a batch

**1. Queue the run** in the app — Contact finder, pick a target chip and
the roles you want, then *Find contacts now*. The industry chips scope
to offtakers; the **Main municipalities** chip at the end of the row
scopes to the 20 main municipalities. The run is written as `queued`;
nothing is searching yet.

**2. Check it landed:**

```bash
node scripts/finder-agent.js runs
```

**3. Point the matching agent at it.** In Claude Code:

> Use the offtaker-contact-finder agent to work run `run_xxx`.

or, for a municipality run:

> Use the municipality-contact-finder agent to work run `run_xxx`.

The agent claims the run, researches each target, writes finds as it
goes, and marks the run done with a coverage note.

**4. Review** in the Contact finder. Each row shows the source it was
read from — open it before accepting. Accept writes the contact;
discard drops it. **Accept all** takes every pending row that has an
email in one press. A row that arrived without one is held back with an
*Add email & accept* button — type the address and it goes in.

## What a good find looks like

Required: `offtakerId` (from `targets`), `first`, `last`, `title`,
`role`, `source`, and a **work email**. Phone is optional. A person
with no email is not written — the desk writes before it phones, so a
row with only a switchboard number is a contact nobody follows up. Keep
reading (contact page, annual report, press-release signature) or turn
to the Apollo source below; never guess an address from a pattern. `title` is
recorded exactly as published, because the stakeholder ladder reads the
seat off the title — tidying it is how a Municipal Manager stops being
the CEO seat.

`role` is one of `decision`, `influencer`, `technical`, `gatekeeper` —
the four values `aee_found_contacts.role` accepts.

Confidence is a claim about evidence, not enthusiasm: 0.9+ for the
organisation's own site or annual report, 0.5–0.6 for a credible third
party, and below 0.5 does not get written.

## Sourcing limits

Official and public sources only: the organisation's own site, annual
and integrated reports, IDPs, MFMA and Treasury documents, tender
notices, regulator filings, named quotes in trade press.

Not allowed: scraping LinkedIn, purchased or leaked data, and guessing
an address from a pattern seen elsewhere. If it is not readable on the
page in `source`, it does not get written.

This is personal information about identifiable people, and POPIA
applies — including to public officials. Work contact details in a work
capacity, nothing more. No personal mobile numbers, no home details.

## Commands

```
runs                      queued runs, as JSON
targets <runId>           the accounts in a run, with province and website
claim   <runId>           queued -> running
add     <runId> '<json>'  write one find (validated; refuses bad rows)
finish  <runId> [note]    -> done, with the final count
fail    <runId> <why>     -> failed; the reason is required
```

Every command prints JSON and nothing else.

A run that honestly found nobody is `finish` with a note saying so.
`fail` is for a run that could not be carried out — and the reason is
required, because a failure nobody can read is a run someone re-queues
blindly.

## The Apollo source

`scripts/finder-apollo.js` is the paid source, for the thing public
research rarely yields: the direct work email of the person who owns
the tariff. It sits behind the same gate as everything else — its
output is a CSV for the Import contacts screen (or JSON), reviewed by
a person before anything becomes a contact.

Setup: put `AEE_APOLLO_KEY=...` in `.env` (from app.apollo.io →
Settings → Integrations → API; search endpoints need a paid plan and a
master key).

```
test                                   key check, spends nothing
search "<company>" [--domain d]        who Apollo has, spends nothing
pull "<company>" [--reveal] [--max 5]  fetch, optionally buy emails
batch data/mining-companies.txt --out finds.csv --reveal --budget 50
```

Credits are real money, so the spending rules are mechanical rather
than good intentions: `search` never spends; `pull` spends only behind
`--reveal`, capped per company by `--max`; `batch --reveal` refuses to
run without an explicit `--budget` for total reveals. Personal emails
are never requested and personal mobiles are dropped at the boundary —
POPIA applies to bought data exactly as it does to scraped data.

`data/mining-companies.txt` is the desk's mining and smelting batch
list, ready to run.

## Notes

- **Never match a municipality by name.** Emalahleni exists twice:
  `mun_MP312` is Witbank, `mun_EC136` is Lady Frere. Use the ids
  `targets` returns.
- Municipal senior posts turn over with council terms and acting
  appointments are common. Dates on IDPs and annual reports matter.
- Empty ladder seats are a finding, not a failure. The account page
  shows *0 of 7 seats covered* precisely so a gap is visible — an agent
  should report which seats it could not fill rather than pad the count.
