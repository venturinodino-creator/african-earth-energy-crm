#!/usr/bin/env node
/* One-off: fold bare group-level offtaker records into the site records
   that carry the real data. Run on 2026-09-19 after two contact imports
   had created a second "Exxaro Resources" beside "Exxaro Resources —
   Grootegeluk" and the like, so contacts landed on whichever copy an
   agent matched first.

   For each [drop, keep] pair:
     - contacts, deals, finds and interactions on `drop` move to `keep`
     - contact-run target lists swap `drop` for `keep`
     - fields `keep` has empty are filled from `drop`; notes are appended;
       a further-along pipeline status wins
     - `drop` is written to the backup file, then deleted

   Reads AEE_EMAIL / AEE_PASSWORD from .env like finder-agent.js. Pass
   --dry-run to print what would happen and change nothing.

     node scripts/merge-duplicate-offtakers.js [--dry-run]
*/
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.dirname(__dirname);
const SUPA_URL = process.env.AEE_SUPABASE_URL || 'https://pkzfazjtpswqjmnzzrgt.supabase.co';
const SUPA_KEY = process.env.AEE_SUPABASE_KEY || 'sb_publishable_jqCjOPRXZEIKjgNDVsL3uw_ldx-I-tO';
const DRY = process.argv.includes('--dry-run');

/* [drop, keep] — the survivor is the record with site data (MW, coordinates,
   website, pipeline status); the dropped one is the bare group entry. */
const MERGES = [
  ['o_mu3247y0_nnlwd', 'arcelormittal'],
  ['o_mu3247y0_01uey', 'exxaro'],
  ['o_mu3247y0_c7dkr', 'glencore-merafe'],
  ['o_mu3247y0_s250s', 'northam'],
  ['o_mu3247y0_z1ev4', 'p-ppc'],
  ['o_mu3247y0_7rhtj', 'sibanye'],
  ['o_mu3247xx_ubqzx', 'implats'],
  ['o_mu3247y0_vqbr8', 'o_mu3247y0_czuqz'],
  ['o_mu3247y0_szbg5', 'o_mu3247y0_9z9ta'],
  ['p-coca-cola-beverages-south-africa', 'p-ccbsa-polokwane'],
  ['p-tsogo-sun', 'p-tsogo-caledon-casino'],
  ['o_mu3247y0_th4w2', 'p-tronox-mineral-sands'],
  ['o_mu3247xz_080en', 'p-silicon-smelters-ferroglobe'],
  ['o_mu3247y0_p2qss', 'p-palabora-copper'],
];
const STATUS_ORDER = ['prospect', 'engaged', 'qualified', 'negotiating', 'contracted'];
const FILL_FIELDS = ['website', 'province', 'city', 'description', 'blurb', 'phone', 'email', 'address',
  'contact_source', 'tariff', 'nmd', 'supply', 'wheeling', 'priority', 'revisit_date', 'near_site'];
const REF_TABLES = ['aee_contacts', 'aee_deals', 'aee_found_contacts', 'aee_interactions'];

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
async function rest(pathAndQuery, opts = {}) {
  const res = await fetch(SUPA_URL + '/rest/v1/' + pathAndQuery, {
    ...opts,
    headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json',
      Prefer: 'return=representation', ...(opts.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error('Supabase ' + res.status + ' on ' + pathAndQuery + ': ' + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}
const get = q => rest(q);
const patch = (tbl, q, body) => DRY ? Promise.resolve([]) : rest(tbl + '?' + q, { method: 'PATCH', body: JSON.stringify(body) });
const del = (tbl, q) => DRY ? Promise.resolve([]) : rest(tbl + '?' + q, { method: 'DELETE' });

async function main() {
  loadDotEnv();
  await signIn();
  /* The backup holds company records, so it goes to the OS temp directory
     rather than the repo, where it could be committed by accident. */
  const backup = path.join(require('os').tmpdir(), 'aee-removed-offtakers-' + new Date().toISOString().slice(0, 10) + '.jsonl');
  if (!DRY) fs.writeFileSync(backup, '');

  for (const [dropId, keepId] of MERGES) {
    const [D] = await get('aee_offtakers?id=eq.' + dropId + '&select=*');
    const [K] = await get('aee_offtakers?id=eq.' + keepId + '&select=*');
    if (!D || !K) { console.log('skip — missing:', dropId, keepId); continue; }
    if (!DRY) fs.appendFileSync(backup, JSON.stringify(D) + '\n');

    const moved = {};
    for (const tbl of REF_TABLES) {
      const rows = await get(tbl + '?offtaker_id=eq.' + dropId + '&select=id');
      moved[tbl] = rows.length;
      if (rows.length) await patch(tbl, 'offtaker_id=eq.' + dropId, { offtaker_id: keepId });
    }
    const runs = await get('aee_contact_runs?offtaker_ids=cs.{"' + dropId + '"}&select=id,offtaker_ids');
    for (const run of runs) {
      await patch('aee_contact_runs', 'id=eq.' + run.id,
        { offtaker_ids: [...new Set(run.offtaker_ids.map(x => (x === dropId ? keepId : x)))] });
    }

    const fill = {};
    for (const f of FILL_FIELDS) if ((K[f] == null || K[f] === '') && D[f] != null && D[f] !== '') fill[f] = D[f];
    if (D.notes && D.notes.trim()) fill.notes = ((K.notes || '').trim() + ' ' + D.notes.trim()).trim();
    if (STATUS_ORDER.indexOf(D.status) > STATUS_ORDER.indexOf(K.status)) {
      fill.status = D.status;
      if (D.sf_stage) fill.sf_stage = D.sf_stage;
    }
    if (Object.keys(fill).length) await patch('aee_offtakers', 'id=eq.' + keepId, { ...fill, updated_at: new Date().toISOString() });
    await del('aee_offtakers', 'id=eq.' + dropId);

    console.log((DRY ? '[dry] ' : '') + D.name + '  ->  ' + K.name +
      '  | moved c/d/f/i ' + REF_TABLES.map(t => moved[t]).join('/') + ' runs ' + runs.length +
      ' | filled ' + (Object.keys(fill).join(',') || '-'));
  }

  const ids = new Set((await get('aee_offtakers?select=id')).map(o => o.id));
  let orphans = 0;
  for (const tbl of REF_TABLES) {
    const rows = await get(tbl + '?select=id,offtaker_id');
    orphans += rows.filter(x => x.offtaker_id && !x.offtaker_id.startsWith('mun_') && !ids.has(x.offtaker_id)).length;
  }
  console.log('offtakers now ' + ids.size + ' | records pointing at a missing company: ' + orphans +
    (DRY ? '' : ' | backup: ' + backup));
}

main().catch(e => { console.error(e.message); process.exitCode = 1; });
