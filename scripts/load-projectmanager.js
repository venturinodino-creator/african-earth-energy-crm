#!/usr/bin/env node
/* Load a ProjectManager.com export into Supabase.

     node scripts/load-projectmanager.js <export.json> [--dry-run] [--env <path-to-.env>]

   The export is a JSON file with projects, tasks, people, tags and activity,
   taken read-only from the AEEG ProjectManager.com workspace while signed in
   (see the notes block inside the file for what it could not include). This
   writes it to the aee_pm_* tables, which only signed-in CRM users can read and
   only admins can write - the same rule as the contacts and pipeline. The
   Projects page reads them from there. They are deliberately NOT static files:
   anything under data/ is served to the public by GitHub Pages.

   Signs in as the admin in .env (AEE_EMAIL / AEE_PASSWORD); neither value is
   printed. Idempotent: rows are upserted by id, so re-running with a fresh
   export refreshes the copy. Rows that disappeared from ProjectManager.com are
   NOT deleted - say so if you need that and it can be added.

   --dry-run reads the file and prints what would be written; it does not sign in. */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.dirname(__dirname);
const SUPA_URL = process.env.AEE_SUPABASE_URL || 'https://pkzfazjtpswqjmnzzrgt.supabase.co';
const SUPA_KEY = process.env.AEE_SUPABASE_KEY || 'sb_publishable_jqCjOPRXZEIKjgNDVsL3uw_ldx-I-tO';
const AUTH_DOMAIN = 'aeeg.co.za';

const args = process.argv.slice(2);
const flag = n => args.includes(n);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const file = args.find(a => !a.startsWith('--') && a !== opt('--env'));
const DRY = flag('--dry-run');

function fail(msg) { console.error(JSON.stringify({ ok: false, error: msg })); process.exit(1); }

function loadDotEnv(p) {
  if (!fs.existsSync(p)) return;
  fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach(line => {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) return;
    let v = m[2].trim().replace(/\s+#.*$/, '');
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  });
}

const d = v => (v ? String(v).slice(0, 10) : null);          // date column from an ISO timestamp
const t = v => (v || null);

/* Each table: its name and how an export row becomes a database row. */
const MAP = {
  /* aee_pm_projects and aee_pm_tasks were already in the database (empty, laid
     out for a sync) before this loader existed. They are used as they are: the
     common fields go in their columns and the COMPLETE record - every field the
     export has - goes in `raw`, which is what the Projects page reads. */
  aee_pm_projects: (data) => data.projects.map(p => ({
    id: p.id, name: p.name, description: t(p.description), short_code: t(p.code), status: t(p.status),
    start_date: d(p.start), end_date: d(p.end), planned_start: d(p.plannedStart), planned_finish: d(p.plannedFinish),
    priority: t(p.priority), manager: t(p.manager), members: p.members || [],
    percent_complete: p.progress == null ? null : p.progress, raw: p, synced_at: new Date().toISOString(),
  })),
  aee_pm_tasks: (data) => data.tasks.map(x => ({
    id: x.id, project_id: x.projectId, name: x.name, wbs: t(x.wbs), status: t(x.status),
    start_date: d(x.plannedStart), finish_date: d(x.plannedFinish),
    percent_complete: x.progress == null ? null : x.progress, is_milestone: !!x.isMilestone,
    assignees: x.assignees || [], raw: x, synced_at: new Date().toISOString(),
  })),
  aee_pm_people: (data) => data.people.map(r => ({
    id: r.id, name: t(r.name), initials: t(r.initials), email: t(r.email), role: t(r.role), country: t(r.country),
    teams: r.teams || null, skills: r.skills || null, is_active: r.isActive, default_planned_hours: r.defaultPlannedHours == null ? null : r.defaultPlannedHours,
    working_days: r.workingDays || null,
  })),
  aee_pm_tags: (data) => data.tags.map(g => ({ id: g.id, name: t(g.name), color: t(g.color) })),
  aee_pm_activity: (data) => data.activity.map(a => ({
    id: a.id, sender_id: t(a.senderId), type: t(a.type), at: t(a.at), subject: t(a.subject), message: t(a.message),
    task_id: t(a.taskId), project_id: t(a.projectId),
  })),
  aee_pm_sync: (data) => [{ id: 1, as_of: d(data.asOf), source: t(data.source), notes: data.notes || {} }],
};

/* people can list the same person twice (Zea September, one inactive); the id is what is unique */
function dedupeById(rows) { const m = new Map(); rows.forEach(r => m.set(r.id, r)); return [...m.values()]; }

async function signIn() {
  const raw = String(process.env.AEE_EMAIL || '').trim();
  const email = raw.includes('@') ? raw.toLowerCase() : raw.toLowerCase().replace(/\s+/g, '.') + '@' + AUTH_DOMAIN;
  const password = process.env.AEE_PASSWORD;
  if (!raw || !password) fail('No credentials. Set AEE_EMAIL and AEE_PASSWORD in .env (or pass --env <path>).');
  const res = await fetch(SUPA_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) fail('Sign-in failed (' + res.status + '). Check AEE_EMAIL and AEE_PASSWORD.');
  return (await res.json()).access_token;
}

async function upsert(token, table, rows) {
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const res = await fetch(SUPA_URL + '/rest/v1/' + table + '?on_conflict=id', {
      method: 'POST',
      headers: {
        apikey: SUPA_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) fail(table + ': write failed (' + res.status + ') ' + (await res.text()).slice(0, 300));
  }
}

(async () => {
  if (!file) fail('Usage: node scripts/load-projectmanager.js <export.json> [--dry-run] [--env <path>]');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const k of ['projects', 'tasks', 'people', 'tags', 'activity']) {
    if (!Array.isArray(data[k])) fail('The export has no "' + k + '" list.');
  }
  const plan = Object.entries(MAP).map(([table, fn]) => [table, dedupeById(fn(data))]);
  plan.forEach(([table, rows]) => console.log((DRY ? '[dry] ' : '') + table.padEnd(18), rows.length, 'rows'));
  if (DRY) return;

  loadDotEnv(opt('--env') || path.join(REPO, '.env'));
  const token = await signIn();
  for (const [table, rows] of plan) await upsert(token, table, rows);
  console.log(JSON.stringify({ ok: true, asOf: data.asOf, wrote: Object.fromEntries(plan.map(([n, r]) => [n, r.length])) }));
})().catch(e => fail(e && e.message ? e.message : String(e)));
