/* ═══════════════════════════════════════════════════════════════════
   Project analytics: the numbers behind the dashboard, with no page in them.

   Everything the Analytics view draws is worked out here from the project plan
   tasks (the ProjectManager.com copy with the team's edits laid over it), so a
   figure on a tile, the bar it belongs to and the list you land on when you
   click it are always the same set of tasks.

   Tasks are the plan's leaf rows; phase rows (isSummary) only group them.
   "Today" is passed in everywhere so the rules can be tested on fixed dates.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const PA_SOON_DAYS = 14;

const paDay = s => String(s || '').slice(0, 10);
const paIsLeaf = t => !t.isSummary;
const paDaysBetween = (a, b) => Math.round((Date.parse(paDay(b)) - Date.parse(paDay(a))) / 86400000);
const paNow = () => new Date().toISOString().slice(0, 10);
const paPct = t => Math.max(0, Math.min(100, Number(t.progress) || 0));

/* Where a task stands against the calendar. */
function paHealth(t, today) {
  if (paPct(t) >= 100) return 'done';
  const f = paDay(t.plannedFinish);
  if (!f) return 'unscheduled';
  if (f < today) return 'overdue';
  if (paDaysBetween(today, f) <= PA_SOON_DAYS) return 'soon';
  return 'later';
}
/* Where it stands in its own life. */
function paStage(t) { const p = paPct(t); return p >= 100 ? 'done' : p > 0 ? 'inprogress' : 'notstarted'; }

/* Phase = the top-level group a task sits under ("4" for 4.13), keyed with its project. */
function paPhaseKey(t) { return t.projectId + '|' + String(t.wbs || '').split('.')[0]; }

/* Tasks narrowed by the filters the page holds. An empty filter matches everything. */
function paFilter(tasks, F, today) {
  F = F || {};
  return tasks.filter(t => {
    if (!paIsLeaf(t)) return false;
    if (F.project && t.projectId !== F.project) return false;
    if (F.who && !(t.assignees || []).some(a => a.id === F.who)) return false;
    if (F.stage && paStage(t) !== F.stage) return false;
    if (F.health && paHealth(t, today) !== F.health) return false;
    if (F.month && paDay(t.plannedFinish).slice(0, 7) !== F.month) return false;
    if (F.phase && paPhaseKey(t) !== F.phase) return false;
    if (F.tag && !(t.tags || []).includes(F.tag)) return false;
    return true;
  });
}

/* Effort is the fairest weight for "how far along": a two-hour task and a
   three-week study do not count the same. Tasks with no effort recorded carry
   no weight; if none has any, every task counts equally. */
function paWeights(tasks) {
  const w = tasks.map(t => Math.max(0, Number(t.plannedEffortMin) || 0));
  return w.some(x => x > 0) ? w : tasks.map(() => 1);
}
function paWeighted(tasks, fn) {
  const w = paWeights(tasks); const total = w.reduce((s, x) => s + x, 0);
  if (!total) return 0;
  return tasks.reduce((s, t, i) => s + fn(t) * w[i], 0) / total;
}

function paSummary(tasks, today) {
  const s = { total: tasks.length, done: 0, inprogress: 0, notstarted: 0, overdue: 0, soon: 0, later: 0, unscheduled: 0, hours: 0, milestones: 0 };
  tasks.forEach(t => {
    s[paStage(t)]++;                                   // done / inprogress / notstarted
    const h = paHealth(t, today);
    if (h !== 'done') s[h]++;                          // overdue / soon / later / unscheduled; "done" is already counted above
    s.hours += (Number(t.plannedEffortMin) || 0) / 60;
    if (t.isMilestone) s.milestones++;
  });
  s.progress = Math.round(paWeighted(tasks, paPct));
  s.hours = Math.round(s.hours * 10) / 10;
  return s;
}

/* Time-phased plan: how much of a task should be done by a date, straight-line
   between its planned start and finish. */
function paPlannedFraction(t, date) {
  const s = paDay(t.plannedStart), f = paDay(t.plannedFinish);
  if (!f) return 0;
  if (date >= f) return 1;
  if (!s || date <= s) return 0;
  return paDaysBetween(s, date) / Math.max(1, paDaysBetween(s, f));
}
function paPlannedPct(tasks, date) { return Math.round(paWeighted(tasks, t => paPlannedFraction(t, date) * 100)); }
function paActualPct(tasks) { return Math.round(paWeighted(tasks, paPct)); }

/* The S-curve: planned % complete across the plan, month by month. */
function paSCurve(tasks, today) {
  const dates = tasks.flatMap(t => [paDay(t.plannedStart), paDay(t.plannedFinish)]).filter(Boolean).sort();
  if (!dates.length) return { points: [], planned: 0, actual: 0, index: null, from: '', to: '' };
  const from = dates[0], to = dates[dates.length - 1];
  const span = Math.max(1, paDaysBetween(from, to));
  const steps = Math.min(36, Math.max(6, Math.round(span / 30)));
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const d = new Date(Date.parse(from) + (span * i / steps) * 86400000).toISOString().slice(0, 10);
    points.push({ date: d, planned: paPlannedPct(tasks, d) });
  }
  const planned = paPlannedPct(tasks, today), actual = paActualPct(tasks);
  return { points, planned, actual, index: planned > 0 ? Math.round(actual / planned * 100) / 100 : null, from, to };
}

/* One row per project: the same summary plus its date span. */
function paByProject(tasks, projects, today) {
  return projects.filter(p => !p.isTemplate).map(p => {
    const mine = tasks.filter(t => t.projectId === p.id && paIsLeaf(t));
    const dates = mine.flatMap(t => [paDay(t.plannedStart), paDay(t.plannedFinish)]).filter(Boolean).sort();
    return { id: p.id, name: p.name, manager: p.manager || '', ...paSummary(mine, today),
      start: dates[0] || paDay(p.plannedStart), finish: dates[dates.length - 1] || paDay(p.plannedFinish),
      planned: paPlannedPct(mine, today) };
  });
}

/* Tasks finishing each month, split into done and still open. */
function paByMonth(tasks, today) {
  const m = {};
  tasks.forEach(t => {
    const k = paDay(t.plannedFinish).slice(0, 7); if (!k) return;
    const row = m[k] || (m[k] = { month: k, done: 0, open: 0, overdue: 0 });
    if (paPct(t) >= 100) row.done++; else if (paDay(t.plannedFinish) < today) row.overdue++; else row.open++;
  });
  return Object.values(m).sort((a, b) => a.month.localeCompare(b.month));
}

/* Workload per person: what they hold, what is late, the hours allocated. */
function paByPerson(tasks, today) {
  const m = {};
  tasks.forEach(t => {
    const as = t.assignees || [];
    as.forEach(a => {
      const row = m[a.id] || (m[a.id] = { id: a.id, name: a.name, total: 0, done: 0, open: 0, overdue: 0, soon: 0, hours: 0 });
      const h = (Number(a.allocatedEffort) || (Number(t.plannedEffortMin) || 0) / Math.max(1, as.length)) / 60;
      row.total++; row.hours += h;
      const hl = paHealth(t, today);
      if (hl === 'done') row.done++; else { row.open++; if (hl === 'overdue') row.overdue++; if (hl === 'soon') row.soon++; }
    });
  });
  return Object.values(m).map(r => ({ ...r, hours: Math.round(r.hours) })).sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
}

/* Progress by phase for the plan(s) in view. */
function paByPhase(allTasks, projectId, today) {
  const phases = allTasks.filter(t => t.projectId === projectId && t.isSummary && Number(t.level || 1) === 1);
  return phases.map(ph => {
    const key = paPhaseKey(ph);
    const kids = allTasks.filter(t => paIsLeaf(t) && paPhaseKey(t) === key);
    return { key, wbs: ph.wbs, name: ph.name, ...paSummary(kids, today) };
  }).filter(p => p.total > 0).sort((a, b) => String(a.wbs).localeCompare(String(b.wbs), undefined, { numeric: true }));
}

function paOverdue(tasks, today, limit) {
  return tasks.filter(t => paHealth(t, today) === 'overdue')
    .map(t => ({ t, late: paDaysBetween(paDay(t.plannedFinish), today) }))
    .sort((a, b) => b.late - a.late).slice(0, limit || 10);
}
function paUpcoming(tasks, today, days, limit) {
  return tasks.filter(t => { const h = paHealth(t, today); return (h === 'soon' || h === 'later') && paDaysBetween(today, paDay(t.plannedFinish)) <= (days || 30); })
    .sort((a, b) => paDay(a.plannedFinish).localeCompare(paDay(b.plannedFinish))).slice(0, limit || 10);
}
function paTags(tasks) { const m = {}; tasks.forEach(t => (t.tags || []).forEach(g => { m[g] = (m[g] || 0) + 1; })); return m; }

/* The calendar a Gantt needs: first and last day, and a tick per month. */
function paSpan(rows) {
  const ds = rows.flatMap(r => [r.start, r.finish]).filter(Boolean).sort();
  if (!ds.length) return null;
  const from = ds[0].slice(0, 7) + '-01';
  const last = new Date(Date.parse(ds[ds.length - 1]));
  const to = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  const ticks = [];
  for (let d = new Date(Date.parse(from)); d.toISOString().slice(0, 10) <= to; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) ticks.push(d.toISOString().slice(0, 7));
  return { from, to, days: Math.max(1, paDaysBetween(from, to) + 1), ticks };
}
function paPos(span, date) { return Math.max(0, Math.min(100, paDaysBetween(span.from, date) / span.days * 100)); }
