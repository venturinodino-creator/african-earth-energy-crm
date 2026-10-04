#!/usr/bin/env node
/* apollo-daily: the daily Apollo ingestion.

   Every run it takes the listed off-takers (never the Archive) with the
   biggest ladder gaps, asks Apollo who holds the empty seats, reveals the
   work email of the best candidate for each seat, and files them in the
   CRM's review queue as pending finds. NOTHING becomes a contact until a
   person accepts it on the Contact finder page: this script only fills the
   queue, same gate as every other finder.

   Credits are real money, so it spends by rule, not by mood:
     --budget N        reveals per run (default 15). Searching is free.
     --companies N     companies worked per run (default 8).
     --cooldown DAYS   a company worked in the last DAYS days is skipped
                       (default 14), so a company Apollo has nobody for is
                       not paid for every night.
     --dry             search and plan, reveal nothing, write nothing.

   The run is recorded as an ordinary aee_contact_runs row whose note starts
   "Apollo daily", which is also how the cooldown finds it and how the Agent
   HQ page shows it.

   Credentials (environment or .env): AEE_APOLLO_KEY (a master key),
   AEE_EMAIL and AEE_PASSWORD (a CRM admin). Prints JSON and nothing else. */
'use strict';

const gaps = require('./finder-gaps');
const apollo = require('./finder-apollo');
const { checkFind } = require('./finder-agent');

const NOTE = 'Apollo daily';
const DAY = 86400000;

const norm = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
/* api_search hides surnames ("Do***"), so before a reveal two people are the
   same when the first names match and the surnames agree as far as they are
   shown. */
function sameName(onFile, first, last) {
  if (norm(onFile.first) !== norm(first)) return false;
  const a = norm(onFile.last), b = norm(last);
  return !b || a.startsWith(b) || b.startsWith(a);
}

/* The website to a bare domain Apollo can filter on. */
function domainOf(website) {
  const w = String(website || '').trim();
  if (!w) return '';
  try { return new URL(/^https?:\/\//i.test(w) ? w : 'https://' + w).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
}

/* Which Apollo people to spend a credit on for one company: at most one per
   gap seat, best seat first, never someone already on file with an email.
   Pure; `row` is a finder-gaps coverage row, `people` Apollo search results. */
function chooseCandidates(row, people) {
  const open = new Set(row.seats.filter(s => s.state !== 'covered').map(s => s.seat));
  const taken = new Set();
  const picks = [];
  for (const p of people) {
    const seat = apollo.titleToSeat(p.title);
    if (!seat || !open.has(seat) || taken.has(seat)) continue;
    const filedWithEmail = (row._contacts || []).some(c => String(c.email || '').trim() && sameName(c, p.first_name, p.last_name || p.last_name_obfuscated));
    if (filedWithEmail) continue;
    taken.add(seat);
    picks.push({ person: p, seat });
  }
  const order = apollo.SEATS.map(s => s.k);
  return picks.sort((a, b) => order.indexOf(a.seat) - order.indexOf(b.seat));
}

/* A revealed person to a find the review queue accepts, or null. */
function toFind(row, person, seat) {
  const f = apollo.personToFind(person, row.name);
  if (!f.email) return null;
  const find = {
    offtakerId: row.id, first: f.first, last: f.last, title: f.title, role: f.role, seat,
    email: f.email, phone: f.phone || undefined, source: f.source, confidence: f.confidence,
  };
  return checkFind(find).length ? null : find;
}

function parseFlags(argv) {
  const o = { budget: 15, companies: 8, cooldown: 14, dry: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') o.dry = true;
    else if (a === '--budget' || a === '--companies' || a === '--cooldown') o[a.slice(2)] = Number(argv[++i]);
    else throw new Error('Unknown option ' + a);
  }
  for (const k of ['budget', 'companies', 'cooldown']) if (!(o[k] >= 0)) throw new Error('--' + k + ' must be a number, 0 or more');
  return o;
}

async function recentlyWorked(days) {
  const since = new Date(Date.now() - days * DAY).toISOString();
  const runs = await gaps.rest('aee_contact_runs?note=like.' + encodeURIComponent(NOTE + '*') + '&updated_at=gte.' + encodeURIComponent(since) + '&select=offtaker_ids');
  return new Set((runs || []).flatMap(r => r.offtaker_ids || []));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const uid = p => p + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);

async function main() {
  const o = parseFlags(process.argv.slice(2));
  gaps.loadEnv(require('path').join(__dirname, '..', '.env'));
  if (!process.env.AEE_APOLLO_KEY) throw new Error('No AEE_APOLLO_KEY. Put the master key in .env or the environment.');

  const { rows } = await gaps.listedWithCoverage();
  const worked = await recentlyWorked(o.cooldown);
  const queue = gaps.rankGaps(rows).filter(r => r.gap > 0 && !worked.has(r.id)).slice(0, o.companies);
  if (!queue.length) return console.log(JSON.stringify({ ok: true, note: 'No listed company has a gap that was not worked in the last ' + o.cooldown + ' days.' }));

  /* Plan first (free), spend second. */
  let left = o.dry ? 0 : o.budget, spent = 0;
  const finds = [], report = [];
  for (const row of queue) {
    const domain = domainOf(row.website);
    let people = [];
    try { people = await apollo.searchCompany(row.name, domain); } catch (e) { report.push({ company: row.name, error: String(e.message || e).slice(0, 100) }); continue; }
    const picks = chooseCandidates(row, people);
    const entry = { company: row.name, gap: row.gap, candidates: picks.map(p => ({ seat: p.seat, title: p.person.title })), filed: 0 };
    for (const { person, seat } of picks) {
      if (left <= 0) break;
      const full = await apollo.enrich(person, row.name, domain);
      left--; spent++;
      await sleep(600);
      const f = toFind(row, { ...person, ...full }, seat);
      if (f && !(row._contacts || []).some(c => String(c.email || '').trim().toLowerCase() === f.email.toLowerCase())) { finds.push(f); entry.filed++; }
    }
    report.push(entry);
    await sleep(800);
  }

  let runId = null;
  if (!o.dry) {
    runId = uid('run');
    const now = new Date().toISOString();
    await gaps.rest('aee_contact_runs', { method: 'POST', body: JSON.stringify({
      id: runId, created: now.slice(0, 10), status: 'running', industry: 'all', roles: ['decision', 'influencer', 'technical', 'gatekeeper'],
      offtaker_ids: queue.map(r => r.id), found: 0, claimed_at: now, updated_at: now,
      note: NOTE + ': ' + queue.length + ' listed companies, ' + spent + ' emails revealed. Review on the Contact finder page.',
    }) });
    for (const f of finds) {
      await gaps.rest('aee_found_contacts', { method: 'POST', body: JSON.stringify({
        id: uid('fnd'), run_id: runId, offtaker_id: f.offtakerId, first: f.first, last: f.last, title: f.title, role: f.role,
        phone: f.phone || null, email: f.email, source: f.source, confidence: f.confidence, status: 'pending',
      }) });
    }
    await gaps.rest('aee_contact_runs?id=eq.' + runId, { method: 'PATCH', body: JSON.stringify({
      status: 'done', found: finds.length, finished_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }) });
  }
  console.log(JSON.stringify({ ok: true, dry: o.dry, runId, companies: queue.length, creditsSpent: spent, filed: finds.length, report }, null, 2));
}

if (require.main === module) main().catch(e => { if (e.message !== 'bail') { console.log(JSON.stringify({ ok: false, error: String(e.message || e) })); process.exitCode = 1; } });
module.exports = { chooseCandidates, toFind, sameName, domainOf, parseFlags };
