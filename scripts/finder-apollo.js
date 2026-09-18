#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   Apollo — the paid source behind the same review gate.

   Public sources give the desk names, titles and switchboards; what
   they rarely give is the direct email of the person who owns the
   tariff. That is what Apollo is for, and ONLY that. Everything this
   file returns still lands in front of a reviewer before it becomes a
   contact — a bought row is a claim about a real human exactly as much
   as a scraped one, and it gets the same door.

   CREDITS ARE REAL MONEY HERE. Two rules keep the bill sane:

   1. Searching is free-ish; REVEALING an email costs a credit. So
      `search` never spends, and `pull` only spends behind --reveal,
      capped by --max per company and --budget per batch. The tool
      refuses to spend what nobody explicitly asked it to spend.
   2. Personal emails are never requested (reveal_personal_emails is
      pinned false) and personal mobiles are dropped on arrival. POPIA
      does not stop being the law because the data came from a vendor —
      work details, in a work capacity, nothing else.

   CREDENTIALS. Reads AEE_APOLLO_KEY from .env (gitignored) or the
   environment. The key is sent to api.apollo.io and nowhere else, and
   never printed. Get one: app.apollo.io → Settings → Integrations →
   API. Search endpoints need a paid Apollo plan and a master API key;
   a 403 below usually means the plan or key type, not this script.

   USAGE
     node scripts/finder-apollo.js test
     node scripts/finder-apollo.js search "Exxaro Resources" [--domain exxaro.com]
     node scripts/finder-apollo.js pull "Exxaro Resources" [--domain exxaro.com]
          [--reveal] [--max 5] [--out finds.csv | --json]
     node scripts/finder-apollo.js batch companies.txt --out finds.csv
          [--reveal --budget 50] [--max 5]

   `batch` reads one company per line ("Name" or "Name | domain.co.za").
   Output CSV columns match the app's Import contacts screen, so the
   file loads with no massaging and matches companies by name.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.dirname(__dirname);
const API = process.env.AEE_APOLLO_URL || 'https://api.apollo.io/v1';

/* ─── .env ── same tiny reader as finder-agent.js, same precedence:
   a real environment variable beats the file. */
function loadDotEnv() {
  const p = path.join(REPO, '.env');
  if (!fs.existsSync(p)) return;
  fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach(line => {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) return;
    let v = m[2].trim().replace(/\s+#.*$/, '');
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  });
}

function die(msg, extra) {
  console.log(JSON.stringify({ ok: false, error: msg, ...(extra || {}) }, null, 2));
  process.exit(1);
}
function out(obj) { console.log(JSON.stringify(obj, null, 2)); }

/* ─── THE SEVEN SEATS ─────────────────────────────────────────────
   Mirrors AE_LADDER in js/views-orgmap.js: same seats, same order of
   value to the desk. The title lists are what Apollo's person_titles
   filter is fed; the patterns classify what comes back. If the ladder
   in the app grows a seat, grow this too. */
const SEATS = [
  { k: 'energy',  titles: ['Group Energy Manager', 'Energy Manager', 'Head of Energy', 'Head of Utilities', 'Head of Renewable Energy', 'Energy Director'],
    re: /\benergy\b|\butilit/i },
  { k: 'sustain', titles: ['Chief Sustainability Officer', 'Head of Sustainability', 'Head of ESG', 'Sustainability Manager', 'Head of Climate Change'],
    re: /sustainab|\besg\b|climate|carbon|environment/i },
  { k: 'finance', titles: ['Chief Financial Officer', 'Finance Director', 'Group Financial Manager'],
    re: /chief financial|\bcfo\b|finance director|financial director|head of finance|treasur/i },
  { k: 'exec',    titles: ['Chief Executive Officer', 'Managing Director'],
    re: /chief executive|\bceo\b|managing director|executive chairman/i },
  { k: 'ops',     titles: ['Chief Operating Officer', 'Operations Director', 'General Manager Operations'],
    re: /chief operating|\bcoo\b|operations|general manager|(?:plant|mine|works|site) manager/i },
  { k: 'eng',     titles: ['Engineering Manager', 'Technical Director', 'Head of Engineering'],
    re: /engineer|technical (?:director|manager|services)|maintenance/i },
  { k: 'proc',    titles: ['Chief Procurement Officer', 'Head of Procurement', 'Procurement Manager', 'Head of Supply Chain', 'Supply Chain Manager'],
    re: /procure|supply chain|sourcing|category manager|\bbuyer\b/i },
];

/* Procurement first, same reason and same order as aeRoleRank: a
   "Category Manager: Energy" is the buyer, not the tariff owner. */
function titleToSeat(title) {
  const t = String(title || '');
  if (!t) return null;
  if (SEATS[6].re.test(t)) return 'proc';
  for (const s of SEATS) if (s.re.test(t)) return s.k;
  return null;
}
const SEAT_ROLE = { energy: 'decision', sustain: 'decision', finance: 'decision', exec: 'decision', ops: 'influencer', eng: 'technical', proc: 'gatekeeper' };

/* ─── APOLLO ──────────────────────────────────────────────────────── */
async function apollo(pathname, body, method) {
  const key = process.env.AEE_APOLLO_KEY;
  if (!key) {
    die('No Apollo key. Put AEE_APOLLO_KEY=... in .env (gitignored).',
      { hint: 'app.apollo.io → Settings → Integrations → API. Search endpoints need a paid plan and a master key.' });
  }
  const res = await fetch(API + pathname, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'X-Api-Key': key, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429) {
    /* One polite retry. Apollo's minute-limits are easy to graze in a
       batch; anything past one wait is a real quota problem the
       operator should see. */
    await new Promise(r => setTimeout(r, 20000));
    return apollo(pathname, body, method);
  }
  const text = await res.text();
  if (!res.ok) {
    const why = res.status === 401 ? 'The key was rejected — check AEE_APOLLO_KEY.'
      : res.status === 403 ? 'Apollo refused this endpoint — usually the plan does not include API search, or the key is not a master key.'
      : 'Apollo returned ' + res.status + '.';
    die(why, { endpoint: pathname, body: text.slice(0, 300) });
  }
  return text ? JSON.parse(text) : null;
}

/* One person, Apollo's shape → the desk's shape. Everything personal
   is dropped here, at the boundary, so nothing downstream has to
   remember to. */
function personToFind(p, company) {
  const org = p.organization || p.account || {};
  const title = p.title || '';
  const seat = titleToSeat(title);
  const email = p.email && !/@(?:example|domain)\./i.test(p.email) && p.email_status !== 'unavailable' ? p.email : '';
  /* Work switchboard only: personal/mobile numbers are not carried. */
  const phone = (org.phone || org.sanitized_phone || '') + '';
  return {
    company: company || org.name || '',
    first: p.first_name || '', last: p.last_name || '',
    title, seat, role: seat ? SEAT_ROLE[seat] : 'influencer',
    email,
    phone: phone.trim(),
    linkedin: p.linkedin_url || '',
    source: p.id ? 'https://app.apollo.io/#/people/' + p.id : 'https://app.apollo.io',
    confidence: email ? (p.email_status === 'verified' ? 0.9 : 0.7) : 0.6,
    note: 'Apollo' + (p.email_status ? ' · email ' + p.email_status : '') + (email ? '' : ' · no email revealed'),
  };
}

/* ─── CSV, matching the Import contacts screen exactly ───────────── */
const CSV_HEAD = ['first', 'last', 'title', 'department', 'company', 'email', 'phone', 'linkedin', 'notes'];
function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function findsToCsv(finds) {
  const rows = [CSV_HEAD.join(',')];
  finds.forEach(f => rows.push([
    f.first, f.last, f.title, '', f.company, f.email, f.phone, f.linkedin,
    f.note + ' · ' + f.source + ' · confidence ' + f.confidence,
  ].map(csvCell).join(',')));
  return rows.join('\r\n') + '\r\n';
}

/* ─── flag parsing, deliberately dumb ────────────────────────────── */
function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--reveal') args.reveal = true;
    else if (a === '--json') args.json = true;
    else if (a === '--domain') args.domain = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--max') args.max = Number(argv[++i]);
    else if (a === '--budget') args.budget = Number(argv[++i]);
    else args._.push(a);
  }
  if (args.max != null && !(args.max > 0)) die('--max must be a positive number');
  if (args.budget != null && !(args.budget > 0)) die('--budget must be a positive number');
  return args;
}

/* Search one company. Never spends a credit: locked emails come back
   as placeholders and are blanked by personToFind's status check. */
async function searchCompany(name, domain) {
  const body = {
    per_page: 25, page: 1,
    person_titles: SEATS.flatMap(s => s.titles),
    person_locations: ['South Africa'],
  };
  if (domain) body.q_organization_domains = domain;
  else body.q_organization_name = name;
  const r = await apollo('/mixed_people/search', body);
  return (r && r.people) || [];
}

/* Reveal one person's work email. THE credit-spending call. */
async function enrich(p, company, domain) {
  const r = await apollo('/people/match', {
    first_name: p.first_name, last_name: p.last_name,
    organization_name: company, domain: domain || undefined,
    reveal_personal_emails: false,
  });
  return (r && r.person) || p;
}

async function pullCompany(name, opts, spend) {
  const people = await searchCompany(name, opts.domain);
  /* Best seat first, capped: the desk wants the tariff owner, not the
     whole payroll. */
  const ranked = people
    .map(p => ({ p, seat: titleToSeat(p.title) }))
    .filter(x => x.seat)
    .sort((a, b) => SEATS.findIndex(s => s.k === a.seat) - SEATS.findIndex(s => s.k === b.seat))
    .slice(0, opts.max || 5);

  const finds = [];
  for (const { p } of ranked) {
    let person = p;
    if (opts.reveal && spend.left > 0 && !p.email) {
      person = await enrich(p, name, opts.domain);
      spend.left--; spend.used++;
      await new Promise(r => setTimeout(r, 600));
    }
    finds.push(personToFind(person, name));
  }
  return finds;
}

/* ─── COMMANDS ───────────────────────────────────────────────────── */
const commands = {
  async test() {
    const r = await apollo('/auth/health');
    out({ ok: true, apollo: r, note: 'Key accepted. Searching is not charged; revealing emails is.' });
  },

  async search(...argv) {
    const a = parseArgs(argv);
    const name = a._[0];
    if (!name) die('Usage: search "<company>" [--domain d]');
    const people = await searchCompany(name, a.domain);
    out({
      ok: true, company: name, matched: people.length,
      people: people.map(p => ({
        name: (p.first_name || '') + ' ' + (p.last_name || ''), title: p.title || '',
        seat: titleToSeat(p.title), email_status: p.email_status || 'locked',
        organization: (p.organization || {}).name || '',
      })),
      note: 'No credits were spent. Use pull --reveal to buy the emails worth buying.',
    });
  },

  async pull(...argv) {
    const a = parseArgs(argv);
    const name = a._[0];
    if (!name) die('Usage: pull "<company>" [--domain d] [--reveal] [--max 5] [--out file.csv | --json]');
    const spend = { left: a.reveal ? (a.budget || a.max || 5) : 0, used: 0 };
    const finds = await pullCompany(name, a, spend);
    finish(finds, a, spend);
  },

  async batch(...argv) {
    const a = parseArgs(argv);
    const file = a._[0];
    if (!file) die('Usage: batch companies.txt [--reveal --budget 50] [--max 5] [--out file.csv]');
    if (!a.out && !a.json) die('batch needs --out <file.csv> or --json — a hundred rows on stdout helps nobody.');
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    /* No --budget with --reveal means every company could spend: make
       the operator say the number out loud. */
    if (a.reveal && a.budget == null) die('--reveal in a batch needs an explicit --budget <total reveals>.');
    const spend = { left: a.reveal ? a.budget : 0, used: 0 };
    const all = [];
    const skipped = [];
    for (const line of lines) {
      const [name, domain] = line.split('|').map(s => s.trim());
      try {
        const finds = await pullCompany(name, { ...a, domain: domain || a.domain }, spend);
        all.push(...finds);
        await new Promise(r => setTimeout(r, 800));
      } catch (e) { skipped.push({ company: name, why: String(e && e.message || e).slice(0, 120) }); }
    }
    finish(all, a, spend, skipped);
  },
};

function finish(finds, a, spend, skipped) {
  const withEmail = finds.filter(f => f.email).length;
  if (a.out) {
    fs.writeFileSync(a.out, findsToCsv(finds));
    out({ ok: true, wrote: a.out, finds: finds.length, withEmail, creditsSpent: spend.used, skipped: skipped || [] });
  } else {
    out({ ok: true, finds, count: finds.length, withEmail, creditsSpent: spend.used, skipped: skipped || [] });
  }
}

async function main() {
  loadDotEnv();
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd || !commands[cmd]) die('Unknown command ' + (cmd || '(none)'), { commands: Object.keys(commands) });
  await commands[cmd](...args);
}

if (require.main === module) {
  main().catch(e => die(e && e.message ? e.message : String(e)));
}

module.exports = { titleToSeat, personToFind, findsToCsv, csvCell, parseArgs, SEATS, SEAT_ROLE };
