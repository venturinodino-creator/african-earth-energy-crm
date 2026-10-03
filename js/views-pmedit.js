/* ═══════════════════════════════════════════════════════════════════
   Project plans: editing, notes and change history.

   The ProjectManager.com copy stays as it was taken. What people (and agents,
   through scripts/pm-agent.js) change is kept in three tables beside it:
   aee_pm_task_edits (a patch per task, or a whole task made here),
   aee_pm_notes and aee_pm_history. loadProjectPlans() reads them and
   pmApplyAll() lays them over the copy, so every screen on the Projects page
   sees the working version. The rules for what an edit may do live in
   js/pmedit-core.js; the database refuses writes from anyone but an admin.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const PM_NATURAL = (a, b) => String(a || '').localeCompare(String(b || ''), undefined, { numeric: true });

/* ─── LOAD / APPLY ────────────────────────────────────────────────── */
async function pmLoadEdits(pm) {
  pm.rawTasks = pm.tasks.slice();
  try {
    const [ed, no, hi] = await Promise.all([
      supaFetchAll('aee_pm_task_edits?select=*&order=task_id'),
      supaFetchAll('aee_pm_notes?select=*&order=created_at.desc,id'),
      supaFetchAll('aee_pm_history?select=*&order=at.desc,id'),
    ]);
    pm.edits = Object.fromEntries(ed.map(e => [e.task_id, e]));
    pm.notes = no;
    pm.history = hi;
  } catch (e) {
    console.warn('Project plan edits unavailable:', e);
    pm.edits = {}; pm.notes = []; pm.history = []; pm.editsUnavailable = true;
  }
  pmApplyAll(pm);
}

function pmApplyAll(pm) {
  const out = [];
  pm.rawTasks.forEach(t => {
    const e = pm.edits[t.id];
    if (e && e.is_deleted) return;
    out.push(e ? pmApplyEdit(t, e) : t);
  });
  Object.values(pm.edits).filter(e => e.is_new && !e.is_deleted)
    .forEach(e => out.push({ ...e.patch, id: e.task_id, projectId: e.project_id, _new: true, _edited: true }));
  out.sort((a, b) => PM_NATURAL(a.projectId, b.projectId) || PM_NATURAL(a.wbs, b.wbs));
  pm.tasks = out;
}

const pmCanEdit = () => state.role === 'admin';
const pmEditor = () => state.email || 'admin';
const pmTaskNotes = id => (state.pm.notes || []).filter(n => n.task_id === id);
const pmTaskById = id => state.pm.tasks.find(t => t.id === id);
function pmTaskLabel(id) { const t = pmTaskById(id) || state.pm.rawTasks.find(x => x.id === id); return t ? t.name : ''; }
function pmProjectLabel(id) { const p = state.pm.projects.find(x => x.id === id); return p ? p.name : ''; }
function pmWhen(iso) { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }

/* ─── WRITES ──────────────────────────────────────────────────────── */
async function pmWrite(table, rows, conflict) {
  return supaFetch(table + '?on_conflict=' + conflict, { method: 'POST', body: JSON.stringify(rows) });
}
function pmHistoryRow(task, field, oldV, newV) {
  return { id: uid('hst'), task_id: task.id, project_id: task.projectId, field,
    old_value: oldV == null ? null : String(oldV), new_value: newV == null ? null : String(newV), by: pmEditor(), kind: 'user' };
}

/* ─── THE TASK FORM ───────────────────────────────────────────────── */
function pmModalEl() {
  let el = document.getElementById('modal-pmtask');
  if (!el) { el = document.createElement('div'); el.className = 'overlay'; el.id = 'modal-pmtask'; document.body.appendChild(el); }
  return el;
}
function pmCloseTask() { const el = document.getElementById('modal-pmtask'); if (el) el.classList.remove('open'); state.pmEditing = null; }

function pmPeople() {
  const m = new Map();
  (state.pm.people || []).forEach(p => { const prev = m.get(p.name); if (!prev || (prev.is_active === false && p.is_active !== false)) m.set(p.name, p); });
  return [...m.values()].sort((a, b) => String(a.name).localeCompare(b.name));
}

function pmOpenTask(id) {
  if (!pmCanEdit()) return;
  const isNew = id === 'new';
  const t = isNew
    ? { id: '', projectId: state.pmProject, name: '', status: 'To Do', progress: 0, tags: [], assignees: [], fieldValues: [], description: '' }
    : pmTaskById(id);
  if (!t) return;
  state.pmEditing = isNew ? { isNew: true, projectId: t.projectId } : { id: t.id };
  const sel = new Set((t.assignees || []).map(a => a.id));
  const tagNames = [...new Set([...(state.pm.tags || []).map(g => g.name), ...(t.tags || [])])].filter(Boolean);
  const phases = state.pm.tasks.filter(x => x.projectId === t.projectId && x.isSummary);
  const hrs = t.plannedEffortMin ? Math.round(t.plannedEffortMin / 6) / 10 : '';
  const field = (label, inner, cls) => '<div class="fg ' + (cls || '') + '"><label>' + label + '</label>' + inner + '</div>';
  const orig = t._edited && !t._new ? t._orig || {} : {};

  const el = pmModalEl();
  el.innerHTML = '<div class="modal" style="max-width:760px"><div class="mh"><h3>' + (isNew ? 'New task' : 'Edit task ' + esc(t.wbs || '')) +
    '</h3><button class="modal-close" onclick="pmCloseTask()">&times;</button></div><div class="mc"><div class="fgrid">' +
    field('Task name *', '<input id="pe-name" value="' + esc(t.name) + '">', 'full') +
    (isNew ? field('Under phase', '<select id="pe-parent"><option value="">(top level)</option>' +
      phases.map(p => '<option value="' + esc(p.id) + '">' + esc(p.wbs + ' ' + p.name) + '</option>').join('') + '</select>', 'full') : '') +
    field('Status', '<select id="pe-status">' + PM_STATUSES.map(s => '<option' + (t.status === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>') +
    field('% complete', '<input id="pe-progress" type="number" min="0" max="100" value="' + esc(String(t.progress == null ? 0 : t.progress)) + '">') +
    field('Planned start', '<input id="pe-start" type="date" value="' + esc(pmDay(t.plannedStart)) + '">') +
    field('Planned finish', '<input id="pe-finish" type="date" value="' + esc(pmDay(t.plannedFinish)) + '">') +
    field('Effort (hours)', '<input id="pe-effort" type="number" min="0" step="0.5" value="' + esc(String(hrs)) + '">') +
    field('Milestone', '<select id="pe-milestone"><option value="">No</option><option value="1"' + (t.isMilestone ? ' selected' : '') + '>Yes</option></select>') +
    field('Assigned to', '<div style="display:flex;flex-wrap:wrap;gap:6px 14px">' + pmPeople().map(p =>
      '<label style="font-size:12px;text-transform:none;letter-spacing:0;font-weight:500;display:flex;gap:5px;align-items:center"><input type="checkbox" class="pe-who" value="' + esc(p.id) + '"' +
      (sel.has(p.id) ? ' checked' : '') + '> ' + esc(p.name) + '</label>').join('') + '</div>', 'full') +
    field('Tags', '<div style="display:flex;flex-wrap:wrap;gap:6px 14px">' + tagNames.map(g =>
      '<label style="font-size:12px;text-transform:none;letter-spacing:0;font-weight:500;display:flex;gap:5px;align-items:center"><input type="checkbox" class="pe-tag" value="' + esc(g) + '"' +
      ((t.tags || []).includes(g) ? ' checked' : '') + '> ' + esc(g) + '</label>').join('') + '</div>', 'full') +
    field('Description', '<textarea id="pe-desc">' + esc(t.description || '') + '</textarea>', 'full') +
    (t.fieldValues || []).map((f, i) => field(esc(f.name), '<input class="pe-fv" data-i="' + i + '" value="' + esc(f.value) + '">', 'full')).join('') +
    '</div>' +
    (Object.keys(orig).length ? '<div class="fg-hint" style="margin-top:10px">Changed from ProjectManager.com: ' +
      Object.keys(orig).map(k => esc(PM_FIELD_LABEL[k] || k) + ' was <b>' + esc(pmDescribe(k, orig[k])) + '</b>').join('; ') + '.</div>' : '') +
    (isNew ? '' : pmNotesBlockHtml(t.id)) +
    (isNew ? '' : pmHistoryBlockHtml(t.id)) +
    '</div><div class="mf">' +
    (isNew ? '' : '<button class="btn btn-outline" style="margin-right:auto;color:var(--danger)" onclick="pmDeleteTask()">Delete task</button>') +
    (t._edited && !t._new ? '<button class="btn btn-outline" onclick="pmRevertTask()">Revert to ProjectManager.com</button>' : '') +
    '<button class="btn btn-outline" onclick="pmCloseTask()">Cancel</button>' +
    '<button class="btn btn-primary" onclick="pmSaveTask()">Save</button></div></div>';
  el.classList.add('open');
}

function pmNotesBlockHtml(taskId) {
  const ns = pmTaskNotes(taskId);
  return '<div class="section-title" style="margin:16px 0 6px">Notes <span class="mkt-note">' + ns.length + '</span></div>' +
    '<div id="pe-notes">' + pmNotesListHtml(ns) + '</div>' +
    '<div style="display:flex;gap:8px;margin-top:8px"><textarea id="pe-note" placeholder="Add a note..." style="flex:1;min-height:52px"></textarea>' +
    '<button class="btn btn-outline" style="align-self:flex-end" onclick="pmAddNote()">Add note</button></div>';
}
function pmNotesListHtml(ns) {
  if (!ns.length) return '<div class="fg-hint">No notes yet.</div>';
  return ns.map(n => '<div class="mkt-row" style="align-items:flex-start"><div style="min-width:0"><div style="white-space:pre-wrap">' + esc(n.body) + '</div>' +
    '<div class="mkt-note">' + esc(n.author) + ' &middot; ' + esc(pmWhen(n.created_at)) + '</div></div>' +
    '<span class="badge ' + (n.author_kind === 'agent' ? 'b-engaged' : 'b-low') + '">' + (n.author_kind === 'agent' ? 'Agent' : 'Person') + '</span></div>').join('');
}
function pmHistoryBlockHtml(taskId) {
  const hs = (state.pm.history || []).filter(h => h.task_id === taskId).slice(0, 12);
  if (!hs.length) return '';
  return '<div class="section-title" style="margin:16px 0 6px">Changes</div>' + hs.map(h => '<div class="mkt-row"><div style="min-width:0">' + pmChangeText(h) +
    '<div class="mkt-note">' + esc(h.by) + (h.kind === 'agent' ? ' (agent)' : '') + ' &middot; ' + esc(pmWhen(h.at)) + '</div></div></div>').join('');
}
function pmChangeText(h) {
  const label = esc(PM_FIELD_LABEL[h.field] || h.field);
  if (h.field.startsWith('_')) return label + ' <b>' + esc(h.new_value || h.field.slice(1)) + '</b>';
  return label + ': <span style="color:var(--muted)">' + esc(h.old_value || '(empty)') + '</span> &rarr; <b>' + esc(h.new_value || '(empty)') + '</b>';
}

/* ─── SAVE / DELETE / REVERT ──────────────────────────────────────── */
function pmReadForm(base) {
  const v = id => (document.getElementById(id) || {}).value;
  const people = pmPeople();
  const who = [...document.querySelectorAll('.pe-who:checked')].map(c => c.value);
  const keep = new Map((base.assignees || []).map(a => [a.id, a]));
  const raw = {
    name: v('pe-name'), status: v('pe-status'), progress: v('pe-progress'),
    plannedStart: v('pe-start'), plannedFinish: v('pe-finish'),
    plannedEffortMin: v('pe-effort') === '' ? null : Math.round(Number(v('pe-effort')) * 60),
    isMilestone: v('pe-milestone') === '1', description: v('pe-desc'),
    tags: [...document.querySelectorAll('.pe-tag:checked')].map(c => c.value),
    assignees: who.map(id => keep.get(id) || (() => { const p = people.find(x => x.id === id) || {}; return { id, name: p.name, initials: String(p.name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }; })()),
  };
  if ((base.fieldValues || []).length) {
    raw.fieldValues = base.fieldValues.map((f, i) => {
      const box = document.querySelector('.pe-fv[data-i="' + i + '"]');
      return box ? { ...f, value: box.value } : f;
    });
  }
  return raw;
}

async function pmSaveTask() {
  const ed = state.pmEditing; if (!ed || !pmCanEdit()) return;
  try {
    if (ed.isNew) return await pmSaveNew(ed);
    const base = pmTaskById(ed.id);
    const raw = pmReadForm(base);
    const changed = {};
    pmDiff(base, raw).forEach(c => { changed[c.field] = c.new; });
    const { patch, problems } = pmCleanPatch(base, changed);
    if (problems.length) return toast(problems[0], 'warn');
    const changes = pmDiff(base, patch);
    if (!changes.length) { toast('Nothing changed'); return pmCloseTask(); }

    const original = state.pm.rawTasks.find(t => t.id === ed.id) || base;
    const prev = state.pm.edits[ed.id];
    const merged = { ...(prev && !prev.is_new ? prev.patch : {}), ...patch };
    Object.keys(merged).forEach(k => { if (prev && prev.is_new) return; if (pmSame(original[k], merged[k])) delete merged[k]; });
    const row = { task_id: ed.id, project_id: base.projectId, patch: prev && prev.is_new ? { ...prev.patch, ...patch } : merged,
      is_new: !!(prev && prev.is_new), is_deleted: false, updated_at: new Date().toISOString(), updated_by: pmEditor() };
    const hist = changes.map(c => pmHistoryRow(base, c.field, pmDescribe(c.field, c.old), pmDescribe(c.field, c.new)));
    if (!Object.keys(row.patch).length && !row.is_new) {
      await supaFetch('aee_pm_task_edits?task_id=eq.' + encodeURIComponent(ed.id), { method: 'DELETE' });
      delete state.pm.edits[ed.id];
    } else {
      await pmWrite('aee_pm_task_edits', row, 'task_id');
      state.pm.edits[ed.id] = row;
    }
    await pmWrite('aee_pm_history', hist, 'id');
    state.pm.history = hist.map(h => ({ ...h, at: new Date().toISOString() })).concat(state.pm.history);
    pmApplyAll(state.pm); pmCloseTask(); pmRefresh(); toast('Task saved');
  } catch (e) { console.warn(e); toast('Could not save that task: ' + String(e.message || e).slice(0, 120), 'warn'); }
}

async function pmSaveNew(ed) {
  const raw = pmReadForm({ assignees: [], fieldValues: [] });
  const { patch, problems } = pmCleanPatch({ status: 'To Do', progress: 0 }, raw);
  if (problems.length) return toast(problems[0], 'warn');
  const parentId = (document.getElementById('pe-parent') || {}).value;
  const parent = parentId ? pmTaskById(parentId) : null;
  const sibs = state.pm.tasks.filter(t => t.projectId === ed.projectId && (parent ? t.wbs && t.wbs.startsWith(parent.wbs + '.') && t.level === (parent.level || 1) + 1 : (t.level || 1) === 1));
  const wbs = parent ? parent.wbs + '.' + (sibs.length + 1) : String(sibs.length + 1);
  const id = uid('crm');
  const full = { ...patch, wbs, level: parent ? (parent.level || 1) + 1 : 1, isSummary: false, fieldValues: [], index: 9999 };
  const task = { id, projectId: ed.projectId };
  const row = { task_id: id, project_id: ed.projectId, patch: full, is_new: true, is_deleted: false, updated_at: new Date().toISOString(), updated_by: pmEditor() };
  await pmWrite('aee_pm_task_edits', row, 'task_id');
  const h = pmHistoryRow({ ...task }, '_created', null, 'created: ' + patch.name);
  await pmWrite('aee_pm_history', [h], 'id');
  state.pm.edits[id] = row; state.pm.history.unshift({ ...h, at: new Date().toISOString() });
  pmApplyAll(state.pm); pmCloseTask(); pmRefresh(); toast('Task added');
}

async function pmDeleteTask() {
  const ed = state.pmEditing; if (!ed || ed.isNew || !pmCanEdit()) return;
  const t = pmTaskById(ed.id);
  if (!confirm('Delete "' + t.name + '"? It is hidden here; ProjectManager.com is not changed. Revert is not offered for a deleted task, so say if you need it back.')) return;
  try {
    const prev = state.pm.edits[ed.id];
    if (prev && prev.is_new) { await supaFetch('aee_pm_task_edits?task_id=eq.' + encodeURIComponent(ed.id), { method: 'DELETE' }); delete state.pm.edits[ed.id]; }
    else {
      const row = { task_id: ed.id, project_id: t.projectId, patch: (prev && prev.patch) || {}, is_new: false, is_deleted: true, updated_at: new Date().toISOString(), updated_by: pmEditor() };
      await pmWrite('aee_pm_task_edits', row, 'task_id'); state.pm.edits[ed.id] = row;
    }
    const h = pmHistoryRow(t, '_deleted', null, 'deleted: ' + t.name);
    await pmWrite('aee_pm_history', [h], 'id'); state.pm.history.unshift({ ...h, at: new Date().toISOString() });
    pmApplyAll(state.pm); pmCloseTask(); pmRefresh(); toast('Task deleted');
  } catch (e) { toast('Could not delete that task', 'warn'); }
}

async function pmRevertTask() {
  const ed = state.pmEditing; if (!ed || ed.isNew || !pmCanEdit()) return;
  const t = pmTaskById(ed.id);
  try {
    await supaFetch('aee_pm_task_edits?task_id=eq.' + encodeURIComponent(ed.id), { method: 'DELETE' });
    delete state.pm.edits[ed.id];
    const h = pmHistoryRow(t, '_reverted', null, 'reverted to ProjectManager.com');
    await pmWrite('aee_pm_history', [h], 'id'); state.pm.history.unshift({ ...h, at: new Date().toISOString() });
    pmApplyAll(state.pm); pmCloseTask(); pmRefresh(); toast('Reverted to ProjectManager.com');
  } catch (e) { toast('Could not revert that task', 'warn'); }
}

/* ─── NOTES ───────────────────────────────────────────────────────── */
async function pmAddNote(projectId) {
  if (!pmCanEdit()) return;
  const taskId = projectId ? null : (state.pmEditing || {}).id;
  const box = document.getElementById(projectId ? 'pn-body' : 'pe-note');
  const body = (box && box.value || '').trim();
  if (!body) return toast('Write the note first', 'warn');
  const pid = projectId || (pmTaskById(taskId) || {}).projectId;
  const row = { id: uid('note'), task_id: taskId, project_id: pid, body, author: pmEditor(), author_kind: 'user', created_at: new Date().toISOString() };
  try {
    await pmWrite('aee_pm_notes', [row], 'id');
    state.pm.notes.unshift(row);
    if (projectId) { box.value = ''; pmRefresh(); }
    else { document.getElementById('pe-notes').innerHTML = pmNotesListHtml(pmTaskNotes(taskId)); box.value = ''; }
    toast('Note added');
  } catch (e) { toast('Could not save that note', 'warn'); }
}

/* ─── NOTES & CHANGES TAB ─────────────────────────────────────────── */
function pmNotesTabHtml() {
  const pm = state.pm;
  const notes = (pm.notes || []).slice(0, 200);
  const hist = (pm.history || []).slice(0, 200);
  const where = n => n.task_id ? esc(pmTaskLabel(n.task_id) || 'a task') + ' <span class="mkt-note">' + esc(pmProjectLabel(n.project_id)) + '</span>' : esc(pmProjectLabel(n.project_id) || 'a project');
  const add = pmCanEdit()
    ? '<div class="card" style="margin-bottom:14px"><div class="card-header"><div class="card-title">Add a project note</div></div>' +
      '<div style="display:flex;gap:8px;align-items:flex-end"><select class="flt" id="pn-project">' +
      pm.projects.filter(p => !p.isTemplate).map(p => '<option value="' + esc(p.id) + '"' + (p.id === state.pmProject ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('') + '</select>' +
      '<textarea id="pn-body" placeholder="Update, decision, risk..." style="flex:1;min-height:48px"></textarea>' +
      '<button class="btn btn-primary" onclick="pmAddNote(document.getElementById(\'pn-project\').value)">Add</button></div></div>'
    : '';
  const noteRows = notes.map(n => '<div class="mkt-row" style="align-items:flex-start"><div style="min-width:0"><div class="mkt-note">' + where(n) + '</div>' +
    '<div style="white-space:pre-wrap">' + esc(n.body) + '</div><div class="mkt-note">' + esc(n.author) + ' &middot; ' + esc(pmWhen(n.created_at)) + '</div></div>' +
    '<span class="badge ' + (n.author_kind === 'agent' ? 'b-engaged' : 'b-low') + '">' + (n.author_kind === 'agent' ? 'Agent' : 'Person') + '</span></div>').join('');
  const histRows = hist.map(h => '<div class="mkt-row"><div style="min-width:0"><div class="mkt-note">' + esc(pmTaskLabel(h.task_id) || 'a task') + '</div>' + pmChangeText(h) +
    '<div class="mkt-note">' + esc(h.by) + (h.kind === 'agent' ? ' (agent)' : '') + ' &middot; ' + esc(pmWhen(h.at)) + '</div></div></div>').join('');
  return add + '<div class="grid-2"><div class="card"><div class="card-header"><div><div class="card-title">Notes</div><div class="card-sub">' + (pm.notes || []).length +
    ' from people and agents, newest first</div></div></div>' + (noteRows || '<div class="fg-hint">No notes yet. Open a task in the Plan tab to add one; agents add theirs with scripts/pm-agent.js.</div>') + '</div>' +
    '<div class="card"><div class="card-header"><div><div class="card-title">Changes</div><div class="card-sub">' + (pm.history || []).length +
    ' edits made here, against the ProjectManager.com copy</div></div></div>' + (histRows || '<div class="fg-hint">Nothing has been changed yet.</div>') + '</div></div>';
}
