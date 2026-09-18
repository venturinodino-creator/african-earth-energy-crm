#!/usr/bin/env node
/* Fill blanks on aee_offtakers from a research CSV, and geocode.

   The offtaker list was built faster than it was researched: most rows
   arrived with a name, a sector and a one-line description, and nothing
   that places them on the map or lets an agent open their website. This
   reads a CSV a researcher (human or agent) produced and fills ONLY the
   fields that are empty — a value already on the record is never
   overwritten, because whoever typed it in the app knew something the
   researcher did not.

     node scripts/enrich-offtakers.js <file.csv> [--geocode] [--dry-run]

   CSV columns (header row; any order; extra columns are ignored):
     id           aee_offtakers.id — required
     website      https://…  (rejected unless it parses as a URL)
     city         town of the head office or the named site
     province     full name or abbreviation (WC, KZN, …)
     lat, lng     decimal degrees, optional — --geocode fills them if blank
     confidence   0–1; rows below 0.5 are skipped, blank means "not found"
     source_url   where city/province were read — kept in notes

   --geocode looks up rows that end with a city and province but no
   coordinates, through OpenStreetMap's Nominatim. That service asks for
   one request a second and an identifying User-Agent, so this is slow by
   design and stops on the first non-OK response rather than hammering.
   A geocode is a claim about a town, not a plant gate: it is written
   with load_basis untouched and a note saying it is the town centre.

   Credentials come from .env like every other script here. --dry-run
   prints the patches and writes nothing. */
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.dirname(__dirname);
const SUPA_URL = process.env.AEE_SUPABASE_URL || 'https://pkzfazjtpswqjmnzzrgt.supabase.co';
const SUPA_KEY = process.env.AEE_SUPABASE_KEY || 'sb_publishable_jqCjOPRXZEIKjgNDVsL3uw_ldx-I-tO';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'african-earth-energy-crm/1.0 (offtaker geocoding; contact via repository)';

const PROVINCES = {
  gauteng: 'Gauteng', gp: 'Gauteng',
  'western cape': 'Western Cape', wc: 'Western Cape',
  'kwazulu-natal': 'KwaZulu-Natal', 'kwazulu natal': 'KwaZulu-Natal', kzn: 'KwaZulu-Natal', natal: 'KwaZulu-Natal',
  'eastern cape': 'Eastern Cape', ec: 'Eastern Cape',
  'free state': 'Free State', fs: 'Free State',
  limpopo: 'Limpopo', lp: 'Limpopo',
  mpumalanga: 'Mpumalanga', mp: 'Mpumalanga',
  'north west': 'North West', 'north-west': 'North West', nw: 'North West',
  'northern cape': 'Northern Cape', nc: 'Northern Cape',
};

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

/* A small CSV reader that copes with quoted cells, doubled quotes and
   newlines inside quotes — the shapes a spreadsheet or an agent writes. */
function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const head = (rows.shift() || []).map(h => h.trim().toLowerCase());
  return rows.filter(r => r.some(x => x.trim())).map(r => {
    const o = {}; head.forEach((h, i) => { o[h] = (r[i] || '').trim(); }); return o;
  });
}

function normProvince(v) {
  const k = String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return PROVINCES[k] || (Object.values(PROVINCES).includes(v) ? v : '');
}
function normUrl(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  try { const u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); return u.origin + (u.pathname === '/' ? '' : u.pathname); }
  catch (e) { return ''; }
}
const blank = v => v == null || String(v).trim() === '';

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

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function geocode(city, province) {
  const q = encodeURIComponent(city + ', ' + province + ', South Africa');
  const res = await fetch(NOMINATIM + '?format=jsonv2&limit=1&countrycodes=za&q=' + q,
    { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!res.ok) throw new Error('Nominatim ' + res.status + ' — stopping rather than retrying');
  const hits = await res.json();
  if (!hits.length) return null;
  return { lat: Number(hits[0].lat), lng: Number(hits[0].lon), label: hits[0].display_name };
}

async function main() {
  loadDotEnv();
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  const DRY = args.includes('--dry-run');
  const GEO = args.includes('--geocode');
  if (!file) { console.error('Usage: node scripts/enrich-offtakers.js <file.csv> [--geocode] [--dry-run]'); process.exitCode = 1; return; }

  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  await signIn();
  const current = await rest('aee_offtakers?select=id,name,website,city,province,lat,lng,notes');
  const byId = Object.fromEntries(current.map(o => [o.id, o]));

  const tally = { rows: rows.length, unknownId: 0, lowConfidence: 0, patched: 0, website: 0, city: 0, province: 0, coords: 0, geocoded: 0, geocodeMiss: 0, nothing: 0 };
  for (const r of rows) {
    const o = byId[r.id];
    if (!o) { tally.unknownId++; continue; }
    if (!blank(r.confidence) && Number(r.confidence) < 0.5) { tally.lowConfidence++; continue; }

    const patch = {};
    const web = normUrl(r.website);
    if (blank(o.website) && web) { patch.website = web; tally.website++; }
    if (blank(o.city) && !blank(r.city)) { patch.city = r.city; tally.city++; }
    const prov = normProvince(r.province);
    if (blank(o.province) && prov) { patch.province = prov; tally.province++; }

    const city = patch.city || o.city, province = patch.province || o.province;
    if (o.lat == null) {
      if (!blank(r.lat) && !blank(r.lng) && isFinite(Number(r.lat)) && isFinite(Number(r.lng))) {
        patch.lat = Number(r.lat); patch.lng = Number(r.lng); tally.coords++;
      } else if (GEO && city && province) {
        await sleep(1100);
        const g = await geocode(city, province);
        if (g) { patch.lat = g.lat; patch.lng = g.lng; tally.geocoded++; patch._geo = g.label; }
        else tally.geocodeMiss++;
      }
    }

    if (!Object.keys(patch).length) { tally.nothing++; continue; }
    const notes = [];
    if (patch.city || patch.province) notes.push('Head office town/province from ' + (r.source_url || 'research') + '.');
    if (patch._geo) { notes.push('Coordinates are the town centre (OpenStreetMap: ' + patch._geo + '), not the plant gate.'); delete patch._geo; }
    if (notes.length) patch.notes = ((o.notes || '').trim() + ' ' + notes.join(' ')).trim();
    patch.updated_at = new Date().toISOString();

    tally.patched++;
    if (DRY) { console.log('[dry] ' + o.name + ' <- ' + JSON.stringify(patch)); continue; }
    await rest('aee_offtakers?id=eq.' + encodeURIComponent(o.id), { method: 'PATCH', body: JSON.stringify(patch) });
    console.log(o.name + ' <- ' + Object.keys(patch).filter(k => k !== 'updated_at' && k !== 'notes').join(','));
  }
  console.log(JSON.stringify(tally));
}

main().catch(e => { console.error(e.message); process.exitCode = 1; });
