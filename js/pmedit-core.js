/* ═══════════════════════════════════════════════════════════════════
   Project plan edits: the rules, with no page and no database in them.

   The ProjectManager.com copy (aee_pm_tasks) is never changed. An edit is a
   small patch stored beside it (aee_pm_task_edits); the page lays the patch
   over the original, and the original is kept so a change can always be shown
   against what ProjectManager.com held.

   This file is loaded by the browser and by scripts/pm-agent.js, so a person
   editing in the page and an agent editing from a script obey the same rules.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const PM_STATUSES = ['To Do', 'Doing', 'Done'];
/* Fields an edit may touch. Anything else in a patch is dropped. */
const PM_EDIT_FIELDS = ['name', 'status', 'progress', 'plannedStart', 'plannedFinish', 'plannedEffortMin',
  'description', 'tags', 'assignees', 'fieldValues', 'isMilestone'];

const pmIsDate = s => /^\d{4}-\d{2}-\d{2}/.test(String(s || ''));
const pmDay = s => String(s || '').slice(0, 10);
/* Nothing, an empty string, an empty list and false all mean "not set": a form
   that hands back '' for a field the task never had has not changed it. */
const pmBlank = v => v == null || v === '' || v === false || (Array.isArray(v) && !v.length);
const pmSame = (a, b) => (pmBlank(a) && pmBlank(b)) || JSON.stringify(a == null ? null : a) === JSON.stringify(b == null ? null : b);

/* Checks a patch against the task it is for and returns the patch the database
   should store plus anything wrong with it. Status and progress move together:
   100% is Done, Done is 100%, and any progress on a To Do task starts it. */
function pmCleanPatch(task, patch) {
  const problems = [];
  const out = {};
  const p = patch || {};
  for (const k of PM_EDIT_FIELDS) if (k in p) out[k] = p[k];

  if ('name' in out) {
    out.name = String(out.name == null ? '' : out.name).trim();
    if (!out.name) problems.push('a task needs a name');
  }
  if ('status' in out && !PM_STATUSES.includes(out.status)) problems.push('status must be one of ' + PM_STATUSES.join(', '));
  if ('progress' in out) {
    const n = Number(out.progress);
    if (!Number.isFinite(n)) problems.push('progress must be a number from 0 to 100');
    else out.progress = Math.max(0, Math.min(100, Math.round(n)));
  }
  for (const k of ['plannedStart', 'plannedFinish']) {
    if (k in out && out[k] !== '' && out[k] != null && !pmIsDate(out[k])) problems.push(k + ' must be a date like 2026-10-31');
    if (k in out && out[k] === '') out[k] = null;
  }
  if ('plannedEffortMin' in out) {
    const m = Number(out.plannedEffortMin);
    if (out.plannedEffortMin === '' || out.plannedEffortMin == null) out.plannedEffortMin = null;
    else if (!Number.isFinite(m) || m < 0) problems.push('effort must be zero or more hours');
    else out.plannedEffortMin = Math.round(m);
  }
  if ('tags' in out) out.tags = [...new Set((out.tags || []).map(String).filter(Boolean))];
  if ('isMilestone' in out) out.isMilestone = !!out.isMilestone;

  const base = task || {};
  const start = pmDay('plannedStart' in out ? out.plannedStart : base.plannedStart);
  const finish = pmDay('plannedFinish' in out ? out.plannedFinish : base.plannedFinish);
  if (start && finish && finish < start) problems.push('the finish date is before the start date');

  /* status and progress agree */
  const status = 'status' in out ? out.status : base.status;
  const progress = 'progress' in out ? out.progress : base.progress;
  if ('progress' in out && !('status' in out)) {
    if (out.progress >= 100) out.status = 'Done';
    else if (out.progress > 0 && (status === 'To Do' || status === 'Done')) out.status = 'Doing';
    else if (out.progress === 0 && status === 'Done') out.status = 'To Do';
  } else if ('status' in out && !('progress' in out)) {
    if (out.status === 'Done') out.progress = 100;
    else if (out.status === 'To Do') out.progress = 0;
    else if (out.status === 'Doing' && (Number(progress) || 0) >= 100) out.progress = 99;
    else if (out.status === 'Doing' && !(Number(progress) > 0)) out.progress = 1;
  }
  return { patch: out, problems };
}

/* What actually changed: only fields whose value differs from the task now. */
function pmDiff(task, patch) {
  const changes = [];
  for (const k of Object.keys(patch || {})) {
    if (!pmSame((task || {})[k], patch[k])) changes.push({ field: k, old: (task || {})[k], new: patch[k] });
  }
  return changes;
}

/* The task as the page shows it: the original with the patch laid over it.
   The original values of the patched fields are kept in _orig. */
function pmApplyEdit(task, edit) {
  if (!edit || !edit.patch || !Object.keys(edit.patch).length) return task;
  const orig = {};
  for (const k of Object.keys(edit.patch)) orig[k] = task[k];
  return { ...task, ...edit.patch, _edited: true, _orig: orig };
}

/* A readable one-liner for a history row. */
function pmDescribe(field, v) {
  if (v == null || v === '') return '(empty)';
  if (field === 'assignees') return (v || []).map(a => a.name).join(', ') || '(nobody)';
  if (field === 'tags') return (v || []).join(', ') || '(none)';
  if (field === 'fieldValues') return (v || []).map(f => f.name + ': ' + f.value).join(' | ');
  if (field === 'plannedEffortMin') return Math.round(Number(v) / 60 * 10) / 10 + ' h';
  if (field === 'progress') return v + '%';
  if (field === 'plannedStart' || field === 'plannedFinish') return pmDay(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/* The label shown against a field in a change list. */
const PM_FIELD_LABEL = {
  name: 'Name', status: 'Status', progress: 'Done', plannedStart: 'Start', plannedFinish: 'Finish',
  plannedEffortMin: 'Effort', description: 'Description', tags: 'Tags', assignees: 'Assigned to',
  fieldValues: 'Details', isMilestone: 'Milestone', _created: 'Task', _deleted: 'Task', _reverted: 'Task',
};
