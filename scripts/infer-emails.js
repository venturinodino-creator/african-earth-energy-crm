#!/usr/bin/env node
/* Infer a work email from the company's known address format.

   The desk research fills the book with named people and no
   addresses, because South African mines publish names and
   switchboards, not inboxes. What they cannot hide is their address
   FORMAT: once one person at exxaro.com is known to be
   first.last@exxaro.com, the rest almost certainly are too. This
   takes every address already held on a domain (contacts, finds, and
   evidence CSVs a researcher produced), works out the format, and
   proposes the same format for the others at that company.

     node scripts/infer-emails.js [--evidence file.csv]… [--sectors mining,…]
          [--run <runId>] [--out review.csv] [--min-samples 1]
          [--fill-email] [--dry-run]

   AN INFERRED ADDRESS IS A GUESS. Port 25 is blocked where this runs,
   so it cannot be checked against the mail server. By default the
   guess goes into the contact's NOTES as "Likely address (inferred,
   unverified)", and the email column — which the desk reads as "an
   address somebody saw on a page" — stays blank. --fill-email writes
   it to the column too, for an operator who has decided, in so many
   words, that a likely address beats an empty field. Either way it
   never overwrites an existing address. Two samples that agree are
   "likely"; one sample is "possible"; a domain whose samples disagree
   is skipped.

   FOR REVIEW. --out writes a CSV of every person considered, with the
   proposed address, how strong the evidence is, which published
   address it was worked out from, and, for the ones it could not do,
   why not. --out never writes to the database: it is the list a person
   reads before deciding anything. --run limits it to the companies of
   one finder run (the "names to enrich" list is that run's people with
   no email).

   Evidence CSVs take either column set: person_name,example_email, or
   company,first,last,email (the second also tells the script which
   company a domain belongs to, for companies with no website on file).

   Mail domains that differ from the website are mapped below — Northam
   writes to norplats.co.za, Kumba and De Beers to angloamerican.com. */
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.dirname(__dirname);
const SUPA_URL = process.env.AEE_SUPABASE_URL || 'https://pkzfazjtpswqjmnzzrgt.supabase.co';
const SUPA_KEY = process.env.AEE_SUPABASE_KEY || 'sb_publishable_jqCjOPRXZEIKjgNDVsL3uw_ldx-I-tO';
const MINING = ['mining', 'mineral-beneficiation', 'smelting-ferroalloys'];

/* website domain -> the domain people's mail actually lives on */
const MAIL_DOMAIN = {
  'northam.co.za': 'norplats.co.za',
  'angloamericankumba.com': 'angloamerican.com',
  'debeersgroup.com': 'debeersgroup.com',
  'angloamericanplatinum.com': 'valterraplatinum.com',
};

const FORMATS = {
  'first.last': (f, l) => f + '.' + l,
  'firstlast': (f, l) => f + l,
  'flast': (f, l) => f[0] + l,
  'f.last': (f, l) => f[0] + '.' + l,
  'first_last': (f, l) => f + '_' + l,
  'first': (f, l) => f,
  'firstl': (f, l) => f + l[0],
  'first.l': (f, l) => f + '.' + l[0],
  'lastf': (f, l) => l + f[0],
  'last.first': (f, l) => l + '.' + f,
  'lastfirst': (f, l) => l + f,
  'last': (f, l) => l,
};
/* Local parts that are an office, not a person, and so say nothing
   about the format. */
const GENERIC = /^(info|admin|enquir|contact|sales|reception|office|help|support|cosec|company|secretar|ir|investor|privacy|popia|paia|legal|compliance|media|press|comms|marketing|procurement|tenders?|vendors?|hr|careers|jobs|whistle|ethics|tipoff|hotline|fraud|webmaster|noreply|no-reply|news|shareholder|sens|sustainab|esg|csi|cm|mm|mayor|city|municipal|metro|munman|infrastructure|managers|executivemayor|mmreception|proxy|web|queries|gold|responsible|general|sponsor)/i;

/* A "name" that is a role or a team, not a person: the book holds a few of
   these as placeholders ("Procurement Lead", "Cennergi Team"). Writing
   procurement.lead@ for one of them would be nonsense. */
const ROLE_NAME = /\b(team|lead|programme|program|engineering|procurement|department|office|desk|group|unit|division|services|operations|sustainability|energy|manager|officer|head|director)\b/i;

/* How an inferred address is marked in a contact's notes: this script writes
   "Likely address (inferred, ...", the earlier loads wrote "... is INFERRED from". */
const INFERRED_TAG = /Likely address \(inferred|\bINFERRED\b/;

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
const domainOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const mailDomainFor = o => { const d = domainOf(o.website); return MAIL_DOMAIN[d] || d; };
const isRoleName = (first, last) => ROLE_NAME.test(String(first || '') + ' ' + String(last || ''));
/* "Valterra Platinum — Mogalakwena" and "Valterra Platinum" are the same group. */
const companyKey = s => norm(String(s || '').replace(/\(.*?\)/g, '').split(/\s[—–-]\s/)[0]);

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
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const head = (rows.shift() || []).map(h => h.trim().toLowerCase());
  return rows.filter(r => r.some(x => x.trim())).map(r => { const o = {}; head.forEach((h, i) => { o[h] = (r[i] || '').trim(); }); return o; });
}
const csvCell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';

let token = null;
async function signIn() {
  const raw = String(process.env.AEE_EMAIL || '').trim().toLowerCase();
  const email = raw.includes('@') ? raw : raw.replace(/\s+/g, '.') + '@aeeg.co.za';
  const res = await fetch(SUPA_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: process.env.AEE_PASSWORD }),
  });
  if (!res.ok) throw new Error('Sign-in failed (' + res.status + '). Check AEE_EMAIL and AEE_PASSWORD.');
  token = (await res.json()).access_token;
}
async function rest(q, opts = {}) {
  const res = await fetch(SUPA_URL + '/rest/v1/' + q, {
    ...opts,
    headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json',
      Prefer: 'return=representation', ...(opts.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error('Supabase ' + res.status + ' on ' + q + ': ' + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}

/* Which format a known address follows for its owner; null if none or
   if the owner's name is unknown (evidence rows carry a name string). */
function classify(local, first, last) {
  const f = norm(first), l = norm(last);
  if (!f || !l) return null;
  for (const [k, fn] of Object.entries(FORMATS)) if (local === fn(f, l)) return k;
  return null;
}
function classifyByShape(local) {
  if (/^[a-z]{2,}\.[a-z]{2,}$/.test(local)) return 'first.last';
  if (/^[a-z]\.[a-z]{2,}$/.test(local)) return 'f.last';
  if (/^[a-z]{2,}_[a-z]{2,}$/.test(local)) return 'first_last';
  return null;
}

async function main() {
  loadDotEnv();
  const args = process.argv.slice(2);
  const val = flag => (args.includes(flag) ? args[args.indexOf(flag) + 1] : null);
  const OUT = val('--out');
  const DRY = args.includes('--dry-run') || !!OUT;   // a review file never writes to the database
  const FILL = args.includes('--fill-email');
  const minSamples = Number(val('--min-samples') || 1);
  const sectors = val('--sectors') ? val('--sectors').split(',') : MINING;
  const RUN = val('--run');
  const evidenceFiles = args.map((a, i) => (a === '--evidence' ? args[i + 1] : null)).filter(Boolean);

  await signIn();
  const offs = await rest('aee_offtakers?select=id,name,website,status,sector&archived=eq.false');
  const byId = Object.fromEntries(offs.map(o => [o.id, o]));
  const known = [
    ...(await rest('aee_contacts?select=first,last,email&email=not.is.null')),
    ...(await rest('aee_found_contacts?select=first,last,email&email=not.is.null')),
  ];

  /* domain -> format -> set of example addresses; company -> mail domain */
  const ev = {};
  const evCompany = {};
  const add = (dom, fmt, ex) => { if (!dom || !fmt) return; (ev[dom] = ev[dom] || {}); (ev[dom][fmt] = ev[dom][fmt] || new Set()).add(ex); };
  for (const k of known) {
    const [local, dom] = String(k.email).toLowerCase().split('@');
    if (!dom || GENERIC.test(local)) continue;
    add(dom, classify(local, k.first, k.last), local + '@' + dom);
  }
  for (const f of evidenceFiles) {
    for (const r of parseCsv(fs.readFileSync(f, 'utf8'))) {
      const [local, dom] = String(r.example_email || r.email || '').toLowerCase().split('@');
      if (!dom || GENERIC.test(local)) continue;
      const name = r.person_name || [r.first, r.last].filter(Boolean).join(' ');
      const parts = String(name).trim().split(/\s+/);
      const fmt = parts.length >= 2 ? classify(local, parts[0], parts[parts.length - 1]) : null;
      add(dom, fmt || classifyByShape(local), local + '@' + dom);
      if (r.company) evCompany[companyKey(r.company)] = dom;
    }
  }
  const formatFor = dom => {
    const fmts = ev[dom]; if (!fmts) return null;
    const ranked = Object.entries(fmts).sort((a, b) => b[1].size - a[1].size);
    const [fmt, set] = ranked[0];
    const conflicting = ranked.length > 1 && ranked[1][1].size >= set.size;
    return { fmt, samples: set.size, conflicting, examples: [...set].slice(0, 2) };
  };
  /* The mail domain: from the website when there is one, else from an evidence
     row for the same company. */
  const domainFor = o => mailDomainFor(o) || evCompany[companyKey(o.name)] || '';

  let inScope;
  if (RUN) {
    const [run] = await rest('aee_contact_runs?id=eq.' + encodeURIComponent(RUN) + '&select=offtaker_ids');
    if (!run) throw new Error('No run ' + RUN);
    inScope = new Set(run.offtaker_ids || []);
  } else {
    inScope = new Set(offs.filter(o => sectors.includes(o.sector) && o.status !== 'parked').map(o => o.id));
  }
  /* "No email" is decided here, not in the query: a blank can be null, '' or
     stray whitespace, and the query only matches the first two. */
  const everyone = [];
  for (let o = 0; ; o += 1000) {
    const page = await rest('aee_contacts?select=id,offtaker_id,first,last,title,email,notes,status&order=offtaker_id,last,id&limit=1000&offset=' + o);
    everyone.push(...page);
    if (page.length < 1000) break;
  }
  const contacts = everyone.filter(c => inScope.has(c.offtaker_id) && !String(c.email || '').trim() && (c.status || 'active') === 'active');

  const tally = { candidates: contacts.length, noDomain: 0, noEvidence: 0, conflicting: 0, thin: 0, badName: 0, roleName: 0, written: 0, likely: 0, possible: 0 };
  const review = [];
  const skip = (c, o, key, reason) => { tally[key]++; review.push({ company: o ? o.name : c.offtaker_id, c, email: '', strength: '', fmt: '', basis: '', reason }); };
  for (const c of contacts) {
    const o = byId[c.offtaker_id];
    if (!o) continue;
    if (isRoleName(c.first, c.last)) { skip(c, o, 'roleName', 'not a person: the name is a role or team'); continue; }
    const dom = domainFor(o);
    if (!dom) { skip(c, o, 'noDomain', 'no mail domain: no website on file and no published address for this company'); continue; }
    const f = formatFor(dom);
    if (!f) { skip(c, o, 'noEvidence', 'no published address at ' + dom + ' to show the format'); continue; }
    if (f.conflicting) { skip(c, o, 'conflicting', 'published addresses at ' + dom + ' follow different formats'); continue; }
    if (f.samples < minSamples) { skip(c, o, 'thin', 'too few published addresses at ' + dom); continue; }
    const first = norm(String(c.first).split(/\s+/)[0]), last = norm(String(c.last).split(/\s+/).pop());
    if (first.length < 2 || last.length < 2) { skip(c, o, 'badName', 'name too short to build an address'); continue; }
    const email = FORMATS[f.fmt](first, last) + '@' + dom;
    const strength = f.samples >= 2 ? 'likely' : 'possible';
    if (INFERRED_TAG.test(c.notes || '')) { tally.alreadyNoted = (tally.alreadyNoted || 0) + 1; if (!OUT) continue; }
    tally.written++; tally[strength]++;
    review.push({ company: o.name, c, email, strength, fmt: f.fmt + '@' + dom, basis: f.examples.join('; '), reason: '' });
    const tag = 'Likely address (inferred, unverified, ' + strength + '): ' + email + ' — ' + f.fmt + '@' + dom + ' from ' + f.samples + ' known address' + (f.samples === 1 ? '' : 'es') + ' (e.g. ' + f.examples[0] + ').';
    const patch = { notes: ((c.notes || '').trim() + ' ' + tag).trim(), updated_at: new Date().toISOString() };
    /* The email column is for addresses somebody read off a page; a
       guess goes in the notes, where a rep can see it is a guess. The
       column is filled only when the operator says so, in so many words. */
    if (FILL) patch.email = email;
    if (!OUT) console.log((DRY ? '[dry] ' : '') + strength.padEnd(8) + c.first + ' ' + c.last + ' @ ' + o.name + ' -> ' + email + (FILL ? '' : ' (notes only)'));
    if (!DRY) await rest('aee_contacts?id=eq.' + encodeURIComponent(c.id), { method: 'PATCH', body: JSON.stringify(patch) });
  }

  if (OUT) {
    const order = { likely: 0, possible: 1, '': 2 };
    review.sort((a, b) => order[a.strength] - order[b.strength] || a.company.localeCompare(b.company) || String(a.c.last).localeCompare(String(b.c.last)));
    const head = 'company,first,last,title,proposed_email,strength,format,worked_out_from,review,reason_not_proposed';
    const lines = review.map(r => [r.company, r.c.first, r.c.last, r.c.title, r.email, r.strength, r.fmt, r.basis,
      r.email ? 'needs review' : '', r.reason].map(csvCell).join(','));
    const file = path.resolve(REPO, OUT);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '﻿' + [head, ...lines].join('\n') + '\n', 'utf8');
    tally.file = path.relative(REPO, file);
  }
  /* The format list: one row per mail domain, with the format the published
     addresses agree on, how many there are, and what depends on it. This is
     the thing to check by eye: if a format here is wrong, every address
     built from it is wrong. */
  const FORMATS_OUT = val('--formats-out');
  if (FORMATS_OUT) {
    const rows = [];
    const doms = new Set([...Object.keys(ev)]);
    for (const dom of doms) {
      const fmts = ev[dom];
      const ranked = Object.entries(fmts).sort((a, b) => b[1].size - a[1].size);
      const f = formatFor(dom);
      const cos = offs.filter(o => inScope.has(o.id) && domainFor(o) === dom).map(o => o.name);
      const mine = review.filter(r => r.fmt.endsWith('@' + dom));
      const blank = contacts.filter(c => { const o = byId[c.offtaker_id]; return o && domainFor(o) === dom; }).length;
      // addresses of people already on file at this domain that carry an inferred note
      const filled = everyone.filter(c => { const o = byId[c.offtaker_id]; return o && inScope.has(c.offtaker_id) && domainFor(o) === dom && INFERRED_TAG.test(c.notes || '') && String(c.email || '').trim(); }).length;
      rows.push({
        dom, fmt: f.fmt, strength: f.conflicting ? 'CONFLICT' : f.samples >= 2 ? 'likely' : 'possible', samples: f.samples,
        others: ranked.slice(1).map(([k, s]) => k + ' (' + s.size + ')').join('; '),
        examples: [...ranked[0][1]].slice(0, 4).join('; '),
        companies: [...new Set(cos)].slice(0, 6).join('; ') + (cos.length > 6 ? ' +' + (cos.length - 6) + ' more' : ''),
        filled, proposed: mine.length, blank,
      });
    }
    /* Only the domains this run's companies write to; the CRM holds addresses
       from every sector and the rest are not what is being reviewed. */
    for (let i = rows.length - 1; i >= 0; i--) if (!rows[i].companies && !rows[i].filled && !rows[i].proposed) rows.splice(i, 1);
    rows.sort((a, b) => (b.filled + b.proposed) - (a.filled + a.proposed) || a.dom.localeCompare(b.dom));
    const head = 'mail_domain,format,strength,published_addresses_agreeing,other_formats_seen,published_examples,companies_on_this_domain,people_already_given_an_inferred_address,people_proposed_now,people_still_without_email,review';
    const lines = rows.map(r => [r.dom, r.fmt + '@' + r.dom, r.strength, r.samples, r.others, r.examples, r.companies, r.filled, r.proposed, r.blank, 'needs review'].map(csvCell).join(','));
    const file = path.resolve(REPO, FORMATS_OUT);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '﻿' + [head, ...lines].join('\n') + '\n', 'utf8');
    tally.formatsFile = path.relative(REPO, file);
    tally.formats = rows.length;
  }
  console.log(JSON.stringify(tally));
}

if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { norm, isRoleName, companyKey, classify, classifyByShape, parseCsv, FORMATS, GENERIC };
