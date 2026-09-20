#!/usr/bin/env node
/* Write addresses a researcher read off a page into the contacts that
   lack one.

     node scripts/apply-found-emails.js <result.csv>… [--dry-run]

   CSV columns (header row): contact_id, email, source_url, confidence,
   notes. Each row is one person the researcher found an address for.
   The address is written only when the contact's email is blank, only
   when it looks like an address, only when it is not an office inbox
   (info@, cosec@, ir@ …), and only when the row carries the page it
   was read from — the note records that page, so a rep can see where
   the address came from. Rows with confidence below 0.5 are skipped.
   Reads AEE_EMAIL / AEE_PASSWORD from .env. */
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.dirname(__dirname);
const SUPA_URL = process.env.AEE_SUPABASE_URL || 'https://pkzfazjtpswqjmnzzrgt.supabase.co';
const SUPA_KEY = process.env.AEE_SUPABASE_KEY || 'sb_publishable_jqCjOPRXZEIKjgNDVsL3uw_ldx-I-tO';

const SHARED_INBOX = new RegExp('^(?:' + [
  'info', 'admin', 'enquir\\w*', 'inquir\\w*', 'contact\\w*', 'sales', 'reception', 'office', 'help', 'support',
  'cosec', 'companysec\\w*', 'company\\.?secretar\\w*', 'secretar\\w*', 'ir', 'investor\\w*',
  'privacy', '\\w*privacy\\w*', 'popia', 'paia', 'informationofficer', 'legal', 'compliance', 'governance',
  'media', 'press', 'comms', 'communications', 'marketing', 'pr',
  'procurement', 'tenders?', 'vendors?', 'suppliers?', 'supplychain',
  'hr', 'careers', 'jobs', 'recruit\\w*', 'payroll',
  'accounts', 'finance', 'billing', 'creditors', 'debtors',
  'whistle\\w*', 'ethics', 'tipoffs?', 'hotline', 'fraud', 'speakup',
  'webmaster', 'noreply', 'no-reply', 'donotreply', 'newsletter', 'news', 'feedback', 'complaints?',
  'shareholders?', 'sens', 'sustainability', 'esg', 'csi', 'sed',
].join('|') + ')(?:[._-]?(?:office|admin|team|desk|za|sa|group|department|dept|\\d+))*@', 'i');

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

async function main() {
  loadDotEnv();
  const args = process.argv.slice(2);
  const DRY = args.includes('--dry-run');
  const files = args.filter(a => !a.startsWith('--'));
  if (!files.length) { console.error('Usage: node scripts/apply-found-emails.js <result.csv>… [--dry-run]'); process.exitCode = 1; return; }

  await signIn();
  const contacts = await rest('aee_contacts?select=id,first,last,email,notes');
  const byId = Object.fromEntries(contacts.map(c => [c.id, c]));
  const tally = { rows: 0, unknownId: 0, alreadyHas: 0, badShape: 0, officeInbox: 0, noSource: 0, lowConfidence: 0, written: 0 };
  const seen = new Set();
  for (const f of files) {
    for (const r of parseCsv(fs.readFileSync(f, 'utf8'))) {
      tally.rows++;
      const c = byId[r.contact_id];
      const email = String(r.email || '').trim().toLowerCase();
      if (!c) { tally.unknownId++; continue; }
      if (seen.has(c.id)) continue;
      if (c.email) { tally.alreadyHas++; continue; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { tally.badShape++; continue; }
      if (SHARED_INBOX.test(email)) { tally.officeInbox++; continue; }
      if (!/^https?:\/\//i.test(r.source_url || '')) { tally.noSource++; continue; }
      if (r.confidence && Number(r.confidence) < 0.5) { tally.lowConfidence++; continue; }
      seen.add(c.id);
      tally.written++;
      const note = ((c.notes || '').trim() + ' Email read from ' + r.source_url + ' on ' + new Date().toISOString().slice(0, 10) + (r.notes ? ' (' + r.notes + ')' : '') + '.').trim();
      console.log((DRY ? '[dry] ' : '') + c.first + ' ' + c.last + ' <- ' + email);
      if (!DRY) await rest('aee_contacts?id=eq.' + encodeURIComponent(c.id), { method: 'PATCH', body: JSON.stringify({ email, notes: note, updated_at: new Date().toISOString() }) });
    }
  }
  console.log(JSON.stringify(tally));
}

main().catch(e => { console.error(e.message); process.exitCode = 1; });
