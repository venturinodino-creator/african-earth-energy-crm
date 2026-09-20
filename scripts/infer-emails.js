#!/usr/bin/env node
/* Infer a work email from the company's known address format.

   The desk research fills the book with named people and no
   addresses, because South African mines publish names and
   switchboards, not inboxes. What they cannot hide is their address
   FORMAT: once one person at exxaro.com is known to be
   first.last@exxaro.com, the rest almost certainly are too. This
   takes every address already held on a domain (contacts, finds, and
   an evidence CSV a researcher produced), works out the format, and
   writes the same format for the others at that company.

     node scripts/infer-emails.js [--evidence file.csv]… [--sectors mining,…]
          [--min-samples 1] [--fill-email] [--dry-run]

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

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
const domainOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const mailDomainFor = o => { const d = domainOf(o.website); return MAIL_DOMAIN[d] || d; };

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
  const DRY = args.includes('--dry-run');
  const FILL = args.includes('--fill-email');
  const minSamples = Number((args[args.indexOf('--min-samples') + 1] || 1));
  const sectors = args.includes('--sectors') ? args[args.indexOf('--sectors') + 1].split(',') : MINING;
  const evidenceFiles = args.map((a, i) => (a === '--evidence' ? args[i + 1] : null)).filter(Boolean);

  await signIn();
  const offs = await rest('aee_offtakers?select=id,name,website,status,sector');
  const byId = Object.fromEntries(offs.map(o => [o.id, o]));
  const known = [
    ...(await rest('aee_contacts?select=first,last,email&email=not.is.null')),
    ...(await rest('aee_found_contacts?select=first,last,email&email=not.is.null')),
  ];

  /* domain -> format -> set of example addresses */
  const ev = {};
  const add = (dom, fmt, ex) => { if (!dom || !fmt) return; (ev[dom] = ev[dom] || {}); (ev[dom][fmt] = ev[dom][fmt] || new Set()).add(ex); };
  for (const k of known) {
    const [local, dom] = String(k.email).toLowerCase().split('@');
    if (!dom || GENERIC.test(local)) continue;
    add(dom, classify(local, k.first, k.last), local + '@' + dom);
  }
  for (const f of evidenceFiles) {
    for (const r of parseCsv(fs.readFileSync(f, 'utf8'))) {
      const [local, dom] = String(r.example_email || '').toLowerCase().split('@');
      if (!dom || GENERIC.test(local)) continue;
      const parts = String(r.person_name || '').trim().split(/\s+/);
      const fmt = parts.length >= 2 ? classify(local, parts[0], parts[parts.length - 1]) : null;
      add(dom, fmt || classifyByShape(local), local + '@' + dom);
    }
  }
  const formatFor = dom => {
    const fmts = ev[dom]; if (!fmts) return null;
    const ranked = Object.entries(fmts).sort((a, b) => b[1].size - a[1].size);
    const [fmt, set] = ranked[0];
    const conflicting = ranked.length > 1 && ranked[1][1].size >= set.size;
    return { fmt, samples: set.size, conflicting, examples: [...set].slice(0, 2) };
  };

  const inScope = new Set(offs.filter(o => sectors.includes(o.sector) && o.status !== 'parked').map(o => o.id));
  const contacts = (await rest('aee_contacts?select=id,offtaker_id,first,last,title,email,notes,status&or=(email.is.null,email.eq.)'))
    .filter(c => inScope.has(c.offtaker_id) && (c.status || 'active') === 'active');

  const tally = { candidates: contacts.length, noDomain: 0, noEvidence: 0, conflicting: 0, thin: 0, badName: 0, written: 0, likely: 0, possible: 0 };
  for (const c of contacts) {
    const o = byId[c.offtaker_id];
    const dom = mailDomainFor(o);
    if (!dom) { tally.noDomain++; continue; }
    const f = formatFor(dom);
    if (!f) { tally.noEvidence++; continue; }
    if (f.conflicting) { tally.conflicting++; continue; }
    if (f.samples < minSamples) { tally.thin++; continue; }
    const first = norm(String(c.first).split(/\s+/)[0]), last = norm(String(c.last).split(/\s+/).pop());
    if (first.length < 2 || last.length < 2) { tally.badName++; continue; }
    const email = FORMATS[f.fmt](first, last) + '@' + dom;
    const strength = f.samples >= 2 ? 'likely' : 'possible';
    tally.written++; tally[strength]++;
    if (/Likely address \(inferred/.test(c.notes || '')) { tally.written--; tally[strength]--; tally.alreadyNoted = (tally.alreadyNoted || 0) + 1; continue; }
    const tag = 'Likely address (inferred, unverified, ' + strength + '): ' + email + ' — ' + f.fmt + '@' + dom + ' from ' + f.samples + ' known address' + (f.samples === 1 ? '' : 'es') + ' (e.g. ' + f.examples[0] + ').';
    const patch = { notes: ((c.notes || '').trim() + ' ' + tag).trim(), updated_at: new Date().toISOString() };
    /* The email column is for addresses somebody read off a page; a
       guess goes in the notes, where a rep can see it is a guess. The
       column is filled only when the operator says so, in so many words. */
    if (FILL) patch.email = email;
    console.log((DRY ? '[dry] ' : '') + strength.padEnd(8) + c.first + ' ' + c.last + ' @ ' + o.name + ' -> ' + email + (FILL ? '' : ' (notes only)'));
    if (!DRY) await rest('aee_contacts?id=eq.' + encodeURIComponent(c.id), { method: 'PATCH', body: JSON.stringify(patch) });
  }
  console.log(JSON.stringify(tally));
}

main().catch(e => { console.error(e.message); process.exitCode = 1; });
