#!/usr/bin/env node
/* Apollo, pointed at people we already hold.

   finder-apollo.js asks Apollo "who do you have at this company?" —
   the right question when a company has nobody on file. This asks the
   other one: "we have this named person at this company; what is their
   work email?" It exists because the public-source runs filled the
   mining book with 400 named executives and site managers and almost
   none of them with an address — the mines publish names and
   switchboards, not inboxes.

     node scripts/apollo-enrich-contacts.js [--sectors mining,…]
          [--budget N] [--limit N] [--ids id1,id2] [--dry-run]

   For each contact with no email, a real first and last name, an
   active status and a company that is not parked, it calls Apollo's
   people/match with the name, the company name and the company's
   website domain. THAT CALL SPENDS A CREDIT whenever Apollo returns an
   email, so:

     --budget N   stop after N matches have been attempted (default 25,
                  so a typo cannot spend the account; raise it on purpose)
     --limit N    consider only the first N candidates (ordered by
                  company, so a company's people are done together)
     --ids …      only these contact ids
     --dry-run    list the candidates and spend nothing

   What is written: the contact's email, only if it was blank, only if
   Apollo's returned person has the same surname (a match on a common
   first name at a big company is not the same person), only if the
   address is not a placeholder and its status is not "unavailable",
   and never a personal address — reveal_personal_emails is pinned
   false, and mobiles are not carried. The note records that the
   address came from Apollo and with what status, so a rep knows how
   much to trust it. Every attempt is logged to a CSV in the OS temp
   directory whether or not it found anything, because the credits are
   gone either way and the operator should be able to see what they
   bought. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.dirname(__dirname);
const SUPA_URL = process.env.AEE_SUPABASE_URL || 'https://pkzfazjtpswqjmnzzrgt.supabase.co';
const SUPA_KEY = process.env.AEE_SUPABASE_KEY || 'sb_publishable_jqCjOPRXZEIKjgNDVsL3uw_ldx-I-tO';
const API = process.env.AEE_APOLLO_URL || 'https://api.apollo.io/v1';
const MINING = ['mining', 'mineral-beneficiation', 'smelting-ferroalloys'];

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

async function apollo(pathname, body) {
  const key = process.env.AEE_APOLLO_KEY;
  if (!key) throw new Error('No Apollo key. Put AEE_APOLLO_KEY=... in .env (gitignored).');
  const res = await fetch(API + pathname, {
    method: 'POST',
    headers: { 'X-Api-Key': key, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    body: JSON.stringify(body),
  });
  if (res.status === 429) { await sleep(20000); return apollo(pathname, body); }
  const text = await res.text();
  if (!res.ok) throw new Error('Apollo ' + res.status + ' on ' + pathname + ': ' + text.slice(0, 200));
  return text ? JSON.parse(text) : null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const key = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
const domainOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const csv = v => { const s = String(v == null ? '' : v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

/* A name Apollo can look up: two real words, not initials, not one of
   the placeholder "Procurement Lead" rows the seed data carries. */
function realName(c) {
  const f = String(c.first || '').trim(), l = String(c.last || '').trim();
  if (f.length < 3 || l.length < 2) return false;
  if (/^[A-Z]\.?( [A-Z]\.?)*$/.test(f)) return false;
  if (/^(plant|sustainability|procurement|energy|utilities|renewable|renewables|electrical|cennergi|team|lead|manager|group|site)$/i.test(f)) return false;
  return true;
}

async function main() {
  loadDotEnv();
  const args = process.argv.slice(2);
  const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
  const DRY = args.includes('--dry-run');
  const budget = Number(opt('--budget', 25));
  const limit = Number(opt('--limit', 0));
  const sectors = String(opt('--sectors', MINING.join(','))).split(',').map(s => s.trim()).filter(Boolean);
  const onlyIds = opt('--ids', '') ? String(opt('--ids', '')).split(',').map(s => s.trim()) : null;
  if (!(budget > 0)) { console.error('--budget must be a positive number'); process.exitCode = 1; return; }

  await signIn();
  const offs = await rest('aee_offtakers?select=id,name,website,status&sector=in.(' + sectors.join(',') + ')');
  const byId = Object.fromEntries(offs.map(o => [o.id, o]));
  const contacts = await rest('aee_contacts?select=id,offtaker_id,first,last,title,email,notes,status&or=(email.is.null,email.eq.)');
  let cands = contacts
    .filter(c => byId[c.offtaker_id] && byId[c.offtaker_id].status !== 'parked' && (c.status || 'active') === 'active' && realName(c))
    .filter(c => !onlyIds || onlyIds.includes(c.id))
    .sort((a, b) => a.offtaker_id.localeCompare(b.offtaker_id) || String(a.last).localeCompare(String(b.last)));
  if (limit > 0) cands = cands.slice(0, limit);

  console.log('candidates: ' + cands.length + (DRY ? ' (dry run, nothing spent)' : ' · budget ' + budget + ' matches'));
  if (DRY) { for (const c of cands) console.log('  ' + c.first + ' ' + c.last + ' — ' + (c.title || '') + ' @ ' + byId[c.offtaker_id].name + ' (' + (domainOf(byId[c.offtaker_id].website) || 'no domain') + ')'); return; }

  const log = path.join(os.tmpdir(), 'aee-apollo-enrich-' + new Date().toISOString().slice(0, 10) + '.csv');
  if (!fs.existsSync(log)) fs.writeFileSync(log, 'when,contact_id,first,last,company,domain,result,email_status,email\n');
  const tally = { attempted: 0, found: 0, verified: 0, unverified: 0, noEmail: 0, wrongPerson: 0, errors: 0 };

  for (const c of cands) {
    if (tally.attempted >= budget) break;
    const o = byId[c.offtaker_id];
    const domain = domainOf(o.website);
    tally.attempted++;
    let result = '', status = '', email = '';
    try {
      const r = await apollo('/people/match', {
        first_name: c.first, last_name: c.last,
        organization_name: o.name.split(/\s[—–-]\s|\s\(/)[0].trim(),
        domain: domain || undefined,
        reveal_personal_emails: false,
      });
      const p = (r && r.person) || null;
      if (!p) { result = 'no match'; tally.noEmail++; }
      else if (key(p.last_name) !== key(c.last)) { result = 'different person (' + (p.first_name || '') + ' ' + (p.last_name || '') + ')'; tally.wrongPerson++; }
      else {
        status = p.email_status || '';
        const e = p.email && !/@(?:example|domain)\./i.test(p.email) && status !== 'unavailable' && !/email_not_unlocked/i.test(p.email) ? p.email : '';
        if (!e) { result = 'matched, no email'; tally.noEmail++; }
        else {
          email = e; result = 'email'; tally.found++;
          if (status === 'verified') tally.verified++; else tally.unverified++;
          const note = ((c.notes || '').trim() + ' Email from Apollo (' + (status || 'status unknown') + ') ' + new Date().toISOString().slice(0, 10) + '.').trim();
          await rest('aee_contacts?id=eq.' + encodeURIComponent(c.id), { method: 'PATCH', body: JSON.stringify({ email: e, notes: note, updated_at: new Date().toISOString() }) });
        }
      }
    } catch (err) { result = 'error: ' + err.message.slice(0, 80); tally.errors++; }
    fs.appendFileSync(log, [new Date().toISOString(), c.id, c.first, c.last, o.name, domain, result, status, email].map(csv).join(',') + '\n');
    console.log((email ? 'EMAIL  ' : '       ') + c.first + ' ' + c.last + ' @ ' + o.name + ' — ' + result + (email ? ' ' + email + ' [' + status + ']' : ''));
    await sleep(600);
  }
  console.log(JSON.stringify(tally) + ' · log ' + log);
}

main().catch(e => { console.error(e.message); process.exitCode = 1; });
