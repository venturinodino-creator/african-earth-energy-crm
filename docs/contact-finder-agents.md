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
| `scripts/openclaw-run.js` | Runs any of these agents through OpenClaw, one run or the whole queue |

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

**1. Queue the run** in the app — Contact finder, pick a target from the
*Next scrape target* selector and the roles you want, then *Find contacts
now*. The selector opens on **Mining**. It lists only targets that still
have people missing, each with how many accounts need people (no
contact on file, and not parked), and always keeps Mining and whatever
you have selected. Pick **Main municipalities** to send the municipality
agent after the 20 main municipalities; any other entry is a sector and
goes to the offtaker agent. The province filter lists only provinces in
the selected target, and is cleared when you change target. The scope
line ("n offtakers in scope") shows what the run would cover before you
queue it. A run is written as `queued`; nothing is searching yet.

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
discard drops it. **Accept all** takes every pending row in one press
and files each contact under its municipality or company. A row that
arrived without an email is flagged *No email* but still goes in; the
*Add email & accept* button on the row lets a reviewer type the address
first, or it can be added on the contact later.

## Running the agents with OpenClaw

The same four agents can be run by [OpenClaw](https://docs.openclaw.ai) instead of
Claude Code. `scripts/openclaw-run.js setup` registers each one with OpenClaw as an
agent called `aeeg-<name>` (`aeeg-offtaker-contact-finder`, `aeeg-municipality-contact-finder`,
`aeeg-listed-offtaker-contact-finder`, `aeeg-priority-contact-finder`), with a workspace of
its own (`~/.openclaw/workspace-aeeg-<name>`). That workspace's `AGENTS.md` is the brief
from `.claude/agents` (there is one copy of what each agent does) under a short preamble:
where the repository is, how Claude Code's tool names map onto OpenClaw's, and the three
rules: never open `.env`, never write a file or commit, and nothing found becomes a contact.
The agents then show in OpenClaw like any other, and each run is its own session there.

```
node scripts/openclaw-run.js setup                         once: create the workspaces and register the agents (--dry to preview)
node scripts/openclaw-run.js list                          the agents, their OpenClaw ids and models
node scripts/openclaw-run.js dispatch                      every queued run, oldest first, each to the right agent
node scripts/openclaw-run.js run offtaker-contact-finder --run run_xxx
node scripts/openclaw-run.js run priority-contact-finder --task "Fill the seats at Sasol"
node scripts/openclaw-run.js brief municipality-contact-finder --run run_xxx    the brief and task, without running anything
```

`dispatch` reads the queue with `finder-agent.js runs` and routes each run: a municipality
run to `municipality-contact-finder`, a run queued by `finder-gaps.js queue` to
`listed-offtaker-contact-finder`, anything else to `offtaker-contact-finder`.
`priority-contact-finder` is slow and wide on purpose, so it is only ever asked for by
name. With nothing queued, nothing is started and nothing is spent. Add `--dry` to see
the plan, `--max 3` to cap how many runs one dispatch takes, `--timeout 3600` to set
the deadline per run.

Things to know:

- **Run it from the checkout that holds `.env`** (or pass `--repo <dir>`); the finder
  script reads its sign-in from there, and `setup` refuses a checkout that has none.
- **It needs OpenClaw installed** (`npm i -g openclaw`) with its gateway running (it is,
  once OpenClaw is set up) and signed in to a Claude model. `setup` is the only thing
  that changes OpenClaw's configuration: it adds the four agents and leaves everything
  else alone. Run it again after editing a brief in `.claude/agents`; it rewrites the
  workspace files and leaves an agent that is already registered as it is.
- **Runs go through the gateway**, not OpenClaw's embedded `agent exec`, which stalls when
  it is started from inside another Claude session (the Claude process it launches
  inherits that session's environment).
- **OpenClaw's command line is slow to start** (a minute or two here), so a run costs
  that on top of the research. The research itself is the model's time.
- **Exit codes:** 0 done, 1 failed, 2 timed out. The JSON it prints carries the
  agent's answer, the OpenClaw session key and session id.
- To run it on a schedule, run `dispatch` from the scheduler of your choice. It is
  cheap when the queue is empty.

## What a good find looks like

Required: `offtakerId` (from `targets`), `first`, `last`, `title`,
`role`, `source`, and **a work email** — the validator refuses a find
without one (standing rule, restated 2026-10-02: every contact must have
an email address). Include a `phone` too whenever one is published, but
it never stands in for the email. A named person with no findable email
is not written; the agent lists them in its report so the email can be
sourced another way. An
email must look like an address and must not be a shared inbox
(`info@`, `cosec@`, a privacy office) — the table is about named
people, so find the individual's own address or skip them. Keep
reading (contact page, annual report, press-release signature) or turn
to the Apollo source below; never guess an address from a pattern.
`title` is recorded exactly as published, because the stakeholder
ladder reads the seat off the title — tidying it is how a Municipal
Manager stops being the CEO seat.

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

### The daily ingestion

`scripts/apollo-daily.js` runs the Apollo source on a schedule, with no
list to maintain. Each run it takes the listed off-takers (never the
Archive) with the biggest ladder gaps, searches Apollo for the empty
seats, reveals one work email per open seat, and files the results as
pending finds in a run whose note starts "Apollo daily". A person still
accepts or rejects each one on the Contact finder page.

```
node scripts/apollo-daily.js --dry            plan only: searches, no credits, writes nothing
node scripts/apollo-daily.js                  15 reveals, 8 companies, 14-day cooldown
node scripts/apollo-daily.js --budget 5 --companies 3 --cooldown 30
```

`.github/workflows/apollo-daily.yml` runs it every day at 05:00 UTC (07:00
in South Africa) and on demand from the Actions tab (with a dry-run
switch). It needs three repository secrets: `AEE_APOLLO_KEY` (a master
key), `AEE_EMAIL` and `AEE_PASSWORD` (a CRM admin). The cooldown means a
company Apollo has nobody for is not paid for every night.

## The listed off-takers

`listed-offtaker-contact-finder` keeps the companies on the Off-taker Prospects
page staffed (the priority list and the ones being worked, never the Archive).
It works from gaps rather than a blank page:

```
node scripts/finder-gaps.js gaps              the listed companies, biggest gap first
node scripts/finder-gaps.js company <id>      one company: its seven seats, who is on file
node scripts/finder-gaps.js queue             queue a run for the biggest gaps
```

A seat is a gap when nobody fills it, or when whoever does has no email. The
seat rules are the app's own (`js/views-orgmap.js`), so this report and the
account page agree. An empty seat counts twice as much as a seat with a name
but no address. The agent reads `company <id>` before searching, so it looks
only for what is missing and never writes down someone already on file. Its
finds still land in the review queue; nothing becomes a contact until accepted.

## Notes

- **Never match a municipality by name.** Emalahleni exists twice:
  `mun_MP312` is Witbank, `mun_EC136` is Lady Frere. Use the ids
  `targets` returns.
- Municipal senior posts turn over with council terms and acting
  appointments are common. Dates on IDPs and annual reports matter.
- Empty ladder seats are a finding, not a failure. The account page
  shows *0 of 7 seats covered* precisely so a gap is visible — an agent
  should report which seats it could not fill rather than pad the count.
