#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   pm-agent: how an agent reads and writes the CRM's project plans.

   The Projects page shows the ProjectManager.com copy with the team's edits
   laid over it. An agent does the same things a person can there, through
   this script, and every write is labelled with the agent's name (--as) so
   the Notes & changes tab shows who did it.

     node scripts/pm-agent.js projects
     node scripts/pm-agent.js tasks   [--project <id|name>] [--q <text>] [--limit 60]
     node scripts/pm-agent.js notes   [<taskId>]
     node scripts/pm-agent.js note    <taskId|project:<projectId>> "<text>" --as "<agent name>"
     node scripts/pm-agent.js update  <taskId> '<json>' --as "<agent name>"

   update takes any of: name, status (To Do | Doing | Done), progress (0-100),
   plannedStart, plannedFinish (YYYY-MM-DD), effortHours, description, tags
   (array), assigneeNames (array of people's names). The rules are the page's
   own (js/pmedit-core.js): 100% is Done, Done is 100%, dates must be in order.

   Credentials: AEE_EMAIL and AEE_PASSWORD from the environment or a .env
   file (--env <path> to point at one). Row-level security lets only an admin
   login write. Every command prints JSON and nothing else.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.dirname(__dirname);
const SUPA_URL = process.env.AEE_SUPABASE_URL || 'https://pkzfazjtpswqjmnzzrgt.supabase.co';
const SUPA_KEY = process.env.AEE_SUPABASE_KEY || 'sb_publishable_jqCjOPRXZEIKjgNDVsL3uw_ldx-I-tO';

/* The same rules the page uses: one source, loaded as plain script. */
const core = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(REPO, 'js', 'pmedit-core.js'), 'utf8') +
  '\nthis.api = { PM_STATUSES, pmCleanPatch, pmDiff, pmApplyEdit, pmDescribe, pmSame };', core);
const { pmCleanPatch, pmDiff, pmApplyEdit, pmDescribe, pmSame } = core.api;

const out = o => console.log(JSON.stringify(o, null, 2));
class Bail extends Error {}
function die(msg, extra) { out({ ok: false, error: msg, ...(extra || {}) }); process.exitCode = 1; throw new Bail(msg); }
const uid = p => p + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);

function parseArgs(argv) {
  const flags = {}; const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { flags[argv[i].slice(2)] = argv[i + 1]; i++; } else rest.push(argv[i]);
  }
  return { flags, rest };
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_]\w*)\s*=\s*(.*)$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

let token = null;
async function signIn() {
  if (token) return token;
  const raw = String(process.env.AEE_EMAIL || '').trim();
  const email = raw.includes('@') ? raw.toLowerCase() : raw.toLowerCase().replace(/\s+/g, '.') + '@aeeg.co.za';
  if (!raw || !process.env.AEE_PASSWORD) die('No credentials. Set AEE_EMAIL and AEE_PASSWORD in .env or the environment.');
  const res = await fetch(SUPA_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: process.env.AEE_PASSWORD }),
  });
  if (!res.ok) die('Sign-in failed (' + res.status + '). Check AEE_EMAIL and AEE_PASSWORD.');
  token = (await res.json()).access_token;
  return token;
}
async function rest(p, opts = {}) {
  const t = await signIn();
  const res = await fetch(SUPA_URL + '/rest/v1/' + p, {
    ...opts,
    headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation', ...(opts.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) die('Supabase ' + res.status + ' on ' + p.split('?')[0], { body: text.slice(0, 300) });
  return text ? JSON.parse(text) : null;
}
async function restAll(p) {
  const rows = [];
  for (let o = 0; ; o += 1000) {
    const pg = await rest(p + '&limit=1000&offset=' + o);
    if (!pg || !pg.length) break;
    rows.push(...pg);
    if (pg.length < 1000) break;
  }
  return rows;
}

/* The working tasks: the copy with the edits laid over, deleted ones gone. */
async function workingTasks() {
  const [raw, edits] = await Promise.all([
    restAll('aee_pm_tasks?select=raw&order=project_id,id'),
    restAll('aee_pm_task_edits?select=*&order=task_id'),
  ]);
  const byId = Object.fromEntries(edits.map(e => [e.task_id, e]));
  const tasks = [];
  raw.map(r => r.raw).filter(Boolean).forEach(t => {
    const e = byId[t.id];
    if (e && e.is_deleted) return;
    tasks.push(e ? pmApplyEdit(t, e) : t);
  });
  edits.filter(e => e.is_new && !e.is_deleted).forEach(e => tasks.push({ ...e.patch, id: e.task_id, projectId: e.project_id, _new: true, _edited: true }));
  return { tasks, originals: Object.fromEntries(raw.map(r => r.raw).filter(Boolean).map(t => [t.id, t])), edits: byId };
}

const compact = t => ({ id: t.id, projectId: t.projectId, wbs: t.wbs, name: t.name, status: t.status, progress: t.progress,
  plannedStart: String(t.plannedStart || '').slice(0, 10), plannedFinish: String(t.plannedFinish || '').slice(0, 10),
  assignees: (t.assignees || []).map(a => a.name), tags: t.tags || [], edited: !!t._edited, summary: !!t.isSummary });

const commands = {
  async projects() {
    const rows = await restAll('aee_pm_projects?select=raw&order=name');
    out({ ok: true, projects: rows.map(r => r.raw).filter(Boolean).map(p => ({ id: p.id, name: p.name, status: p.status, progress: p.progress })) });
  },

  async tasks(args, flags) {
    const { tasks } = await workingTasks();
    let projects = null;
    if (flags.project) {
      projects = (await restAll('aee_pm_projects?select=raw')).map(r => r.raw).filter(Boolean);
      const want = String(flags.project).toLowerCase();
      const hit = projects.filter(p => p.id === flags.project || String(p.name).toLowerCase().includes(want));
      if (!hit.length) die('No project matches "' + flags.project + '". Run: projects');
      const ids = new Set(hit.map(p => p.id));
      var inProject = t => ids.has(t.projectId);
    }
    const q = String(flags.q || '').toLowerCase();
    const list = tasks.filter(t => (!inProject || inProject(t)) && (!q || [t.name, t.wbs, t.description].join(' ').toLowerCase().includes(q)));
    const limit = Number(flags.limit) || 60;
    out({ ok: true, total: list.length, shown: Math.min(limit, list.length), tasks: list.slice(0, limit).map(compact) });
  },

  async notes(args) {
    const q = args[0] ? '&task_id=eq.' + encodeURIComponent(args[0]) : '';
    const rows = await restAll('aee_pm_notes?select=*&order=created_at.desc' + q);
    out({ ok: true, count: rows.length, notes: rows });
  },

  async note(args, flags) {
    const [target, text] = args;
    if (!target || !text) die('Usage: note <taskId|project:<projectId>> "<text>" --as "<agent name>"');
    if (!flags.as) die('--as "<agent name>" is required, so the note says who wrote it');
    let taskId = null, projectId;
    if (target.startsWith('project:')) projectId = target.slice(8);
    else {
      const { tasks } = await workingTasks();
      const t = tasks.find(x => x.id === target);
      if (!t) die('No task with id ' + target);
      taskId = t.id; projectId = t.projectId;
    }
    const row = { id: uid('note'), task_id: taskId, project_id: projectId, body: String(text).trim(), author: flags.as, author_kind: 'agent' };
    if (!row.body) die('The note is empty');
    const rows = await rest('aee_pm_notes', { method: 'POST', body: JSON.stringify([row]) });
    out({ ok: true, wrote: rows[0] });
  },

  async update(args, flags) {
    const [taskId, json] = args;
    if (!taskId || !json) die('Usage: update <taskId> \'<json>\' --as "<agent name>"');
    if (!flags.as) die('--as "<agent name>" is required, so the change says who made it');
    let input; try { input = JSON.parse(json); } catch (e) { die('That is not valid JSON: ' + e.message); }
    const { tasks, originals, edits } = await workingTasks();
    const base = tasks.find(t => t.id === taskId);
    if (!base) die('No task with id ' + taskId);

    const raw = { ...input };
    if ('effortHours' in raw) { raw.plannedEffortMin = raw.effortHours === null ? null : Math.round(Number(raw.effortHours) * 60); delete raw.effortHours; }
    if ('assigneeNames' in raw) {
      const people = await restAll('aee_pm_people?select=*');
      const keep = new Map((base.assignees || []).map(a => [a.name, a]));
      raw.assignees = (raw.assigneeNames || []).map(n => {
        if (keep.has(n)) return keep.get(n);
        const p = people.find(x => String(x.name).toLowerCase() === String(n).toLowerCase());
        if (!p) die('No person called "' + n + '" in the project team', { people: [...new Set(people.map(x => x.name))] });
        return { id: p.id, name: p.name, initials: String(p.name).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() };
      });
      delete raw.assigneeNames;
    }
    const changed = {}; pmDiff(base, raw).forEach(c => { changed[c.field] = c.new; });
    const { patch, problems } = pmCleanPatch(base, changed);
    if (problems.length) die('This change was not written.', { problems });
    const changes = pmDiff(base, patch);
    if (!changes.length) return out({ ok: true, unchanged: true, task: compact(base) });

    const prev = edits[taskId];
    const orig = originals[taskId] || base;
    let newPatch;
    if (prev && prev.is_new) newPatch = { ...prev.patch, ...patch };
    else { newPatch = { ...(prev ? prev.patch : {}), ...patch }; Object.keys(newPatch).forEach(k => { if (pmSame(orig[k], newPatch[k])) delete newPatch[k]; }); }
    const isNew = !!(prev && prev.is_new);
    const now = new Date().toISOString();
    if (!Object.keys(newPatch).length && !isNew) await rest('aee_pm_task_edits?task_id=eq.' + encodeURIComponent(taskId), { method: 'DELETE' });
    else await rest('aee_pm_task_edits?on_conflict=task_id', { method: 'POST', body: JSON.stringify([{ task_id: taskId, project_id: base.projectId, patch: newPatch, is_new: isNew, is_deleted: false, updated_at: now, updated_by: flags.as }]) });
    const hist = changes.map(c => ({ id: uid('hst'), task_id: taskId, project_id: base.projectId, field: c.field,
      old_value: pmDescribe(c.field, c.old), new_value: pmDescribe(c.field, c.new), by: flags.as, kind: 'agent' }));
    await rest('aee_pm_history?on_conflict=id', { method: 'POST', body: JSON.stringify(hist) });
    out({ ok: true, changed: changes.map(c => c.field + ': ' + pmDescribe(c.field, c.old) + ' -> ' + pmDescribe(c.field, c.new)), task: compact({ ...base, ...patch }) });
  },
};

async function main() {
  const { flags, rest: args } = parseArgs(process.argv.slice(2));
  loadEnv(path.resolve(flags.env || path.join(REPO, '.env')));
  const cmd = args.shift();
  if (!commands[cmd]) die('Usage: projects | tasks | notes | note | update. See the header of scripts/pm-agent.js.');
  await commands[cmd](args, flags);
}
main().catch(e => { if (!(e instanceof Bail)) { out({ ok: false, error: String(e && e.message || e) }); process.exitCode = 1; } });
