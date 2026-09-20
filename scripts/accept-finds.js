#!/usr/bin/env node
/* Accept pending finds from the terminal — the Contact finder's
   "Accept all", for an operator who has just run the agents and wants
   the queue ingested without opening the app.

     node scripts/accept-finds.js --run <runId>[,<runId>…] [--dry-run]
     node scripts/accept-finds.js --all [--dry-run]

   Does what js/views-contactfinder.js does on Accept, and nothing more:
     - a find for someone already on the same account (same first and
       last name) fills that contact's blank title, email and phone and
       notes the confirmation, rather than creating a second person;
     - anyone else becomes a new aee_contacts row, role and priority
       derived the same way the app derives them;
     - the find is marked approved either way; discarded finds and finds
       on other runs are never touched.
   A find with neither email nor phone is left pending, because the app
   would have too. Reads AEE_EMAIL / AEE_PASSWORD from .env. */
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.dirname(__dirname);
const SUPA_URL = process.env.AEE_SUPABASE_URL || 'https://pkzfazjtpswqjmnzzrgt.supabase.co';
const SUPA_KEY = process.env.AEE_SUPABASE_KEY || 'sb_publishable_jqCjOPRXZEIKjgNDVsL3uw_ldx-I-tO';

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

const key = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const uid = p => p + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);

/* Mirrors foundToContact() in js/views-contactfinder.js. */
function contactFrom(f) {
  return {
    id: uid('con'), offtaker_id: f.offtaker_id,
    first: f.first, last: f.last, title: f.title || '', dept: '',
    email: f.email || '', phone: f.phone || '', linkedin: '',
    role: f.role || 'influencer', priority: f.role === 'decision' ? 'high' : 'medium',
    status: 'active',
    notes: 'Found by the contact finder' + (f.source ? ' — ' + f.source : '') + '.',
    updated_at: new Date().toISOString(),
  };
}

async function main() {
  loadDotEnv();
  const args = process.argv.slice(2);
  const DRY = args.includes('--dry-run');
  const ALL = args.includes('--all');
  const runArg = args[args.indexOf('--run') + 1];
  const runIds = args.includes('--run') && runArg ? runArg.split(',').map(s => s.trim()).filter(Boolean) : [];
  if (!ALL && !runIds.length) {
    console.error('Usage: node scripts/accept-finds.js --run <runId>[,<runId>…] [--dry-run]  |  --all [--dry-run]');
    process.exitCode = 1; return;
  }

  await signIn();
  const q = 'aee_found_contacts?status=eq.pending&select=*' + (ALL ? '' : '&run_id=in.(' + runIds.map(encodeURIComponent).join(',') + ')');
  const finds = await rest(q);
  const contacts = await rest('aee_contacts?select=id,offtaker_id,first,last,title,email,phone,notes');
  const onFile = (f) => contacts.find(c => c.offtaker_id === f.offtaker_id && key(c.first) === key(f.first) && key(c.last) === key(f.last)) || null;

  const tally = { pending: finds.length, held: 0, created: 0, reused: 0 };
  for (const f of finds) {
    if (!f.email && !f.phone) { tally.held++; continue; }
    const existing = onFile(f);
    if (existing) {
      const patch = {};
      if (!existing.email && f.email) patch.email = f.email;
      if (!existing.phone && f.phone) patch.phone = f.phone;
      if (!existing.title && f.title) patch.title = f.title;
      patch.notes = ((existing.notes || '').trim() + ' Confirmed by the contact finder' + (f.source ? ' — ' + f.source : '') + '.').trim();
      patch.updated_at = new Date().toISOString();
      tally.reused++;
      console.log((DRY ? '[dry] ' : '') + 'on file: ' + f.first + ' ' + f.last + ' @ ' + f.offtaker_id + ' <- ' + Object.keys(patch).filter(k => k !== 'notes' && k !== 'updated_at').join(',') || 'notes');
      if (!DRY) {
        await rest('aee_contacts?id=eq.' + encodeURIComponent(existing.id), { method: 'PATCH', body: JSON.stringify(patch) });
        Object.assign(existing, patch);
      }
    } else {
      const c = contactFrom(f);
      tally.created++;
      console.log((DRY ? '[dry] ' : '') + 'new:     ' + f.first + ' ' + f.last + ' — ' + (f.title || '') + ' @ ' + f.offtaker_id + (f.email ? ' — ' + f.email : f.phone ? ' — ' + f.phone : ''));
      if (!DRY) { await rest('aee_contacts', { method: 'POST', body: JSON.stringify(c) }); contacts.push(c); }
    }
    if (!DRY) await rest('aee_found_contacts?id=eq.' + encodeURIComponent(f.id), { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) });
  }
  console.log(JSON.stringify(tally));
}

main().catch(e => { console.error(e.message); process.exitCode = 1; });
