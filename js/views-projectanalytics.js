/* ═══════════════════════════════════════════════════════════════════
   Projects > Analytics: a dashboard for the whole portfolio and for tracking
   progress, in the style of a Salesforce report.

   Everything on it is clickable. A tile, a bar, a donut slice, a person, a
   month or a phase sets a filter; the filters show as chips you can remove, and
   the task list at the foot always shows exactly the tasks the filters leave.
   The same dashboard is a tab on each site's profile, locked to that project.

   The numbers come from js/pmanalytics-core.js; this file only draws them.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const PA_COLOR = {
  done: 'var(--c-green)', overdue: 'var(--danger)', soon: 'var(--c-amber)', later: 'var(--c-blue)', unscheduled: 'var(--muted)',
  inprogress: 'var(--c-blue)', notstarted: 'var(--muted)',
};
const PA_LABEL = {
  done: 'Done', overdue: 'Overdue', soon: 'Due in 14 days', later: 'Scheduled later', unscheduled: 'No date',
  inprogress: 'In progress', notstarted: 'Not started',
};
const PA_FILTER_NAME = { project: 'Project', who: 'Person', stage: 'Stage', health: 'Schedule', month: 'Finishing', phase: 'Phase', tag: 'Tag' };

function paFilters() { return state.paF || (state.paF = {}); }
function paRefresh() { if (state.view === 'project') renderProject(); else renderProjects(); }
function paSet(k, v) { const F = paFilters(); F[k] = F[k] === v ? '' : v; state.paAll = false; paRefresh(); }
function paClear() { const lock = state.paLock || ''; state.paF = lock ? { project: lock } : {}; state.paAll = false; paRefresh(); }
function paSetSelect(k, v) { paFilters()[k] = v; state.paAll = false; paRefresh(); }
function paShowAll() { state.paAll = true; paRefresh(); }

/* Opens a ProjectManager.com project: its site profile when it belongs to a site, else the plan. */
function paOpenProject(pid) {
  const p = state.pm.projects.find(x => x.id === pid); if (!p) return;
  const site = pmSiteIdFor(p) || pmSiteGuessFor(p);
  if (site) { state.projectTabFor = site; state.projectTab = 'plan'; nav('project', { id: site }); return; }
  state.pmProject = pid; state.pmF = null; state.pmTab = 'plan'; state.projectsMode = 'plans'; nav('projects');
}

const paCount = (n, one, many) => fmtNum(n) + ' ' + (n === 1 ? one : many);
const paOn = (k, v) => (paFilters()[k] === v ? ' on' : '');
const paClick = (k, v) => 'onclick="paSet(\'' + k + '\',\'' + String(v).replace(/'/g, "\\'") + '\')"';

function paChips() {
  const F = paFilters();
  const label = (k, v) => k === 'project' ? ((state.pm.projects.find(p => p.id === v) || {}).name || v)
    : k === 'who' ? ((state.pm.people.find(p => p.id === v) || {}).name || v)
    : k === 'phase' ? (v.split('|')[1] ? 'Phase ' + v.split('|')[1] : v)
    : (PA_LABEL[v] || v);
  const chips = Object.entries(F).filter(([k, v]) => v && !(k === 'project' && state.paLock))
    .map(([k, v]) => '<span class="pa-chip">' + esc(PA_FILTER_NAME[k] || k) + ': <b>' + esc(label(k, v)) + '</b>' +
      '<button title="Remove this filter" onclick="paSet(\'' + k + '\',\'' + String(v).replace(/'/g, "\\'") + '\')">&times;</button></span>');
  return chips.join('') + (chips.length ? '<button class="btn btn-ghost btn-xs" onclick="paClear()">Clear all</button>' : '');
}

function paBar(F) {
  const people = [...new Map(state.pm.tasks.flatMap(t => t.assignees || []).map(a => [a.id, a.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const opt = (v, l, cur) => '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(l) + '</option>';
  return '<div class="toolbar pa-bar">' +
    (state.paLock ? '' : '<select class="flt" onchange="paSetSelect(\'project\',this.value)">' + opt('', 'All projects', F.project || '') +
      state.pm.projects.filter(p => !p.isTemplate).map(p => opt(p.id, p.name, F.project || '')).join('') + '</select>') +
    '<select class="flt" onchange="paSetSelect(\'who\',this.value)">' + opt('', 'Everyone', F.who || '') + people.map(([id, n]) => opt(id, n, F.who || '')).join('') + '</select>' +
    paChips() + '<span class="result-count" style="margin-left:auto">as of ' + esc(pmShortDate(paNow())) + '</span></div>';
}

function paTile(label, value, sub, filterKey, filterVal, color) {
  return '<div class="pa-tile' + (filterKey ? ' click' + paOn(filterKey, filterVal) : '') + '" ' + (filterKey ? paClick(filterKey, filterVal) : '') + '>' +
    '<div class="pa-tile-l">' + esc(label) + '</div><div class="pa-tile-v"' + (color ? ' style="color:' + color + '"' : '') + '>' + value + '</div><div class="pa-tile-s">' + sub + '</div></div>';
}

function paStack(parts, key) {
  const live = parts.filter(p => p.n > 0);
  if (!live.length) return '<div class="pa-stack"><span class="pa-seg" style="flex:1;background:var(--bg3)"></span></div>';
  return '<div class="pa-stack">' + live.map(p => '<span class="pa-seg' + paOn(key, p.k) + '" style="flex:' + p.n + ';background:' + p.c + '" title="' + esc(p.l + ': ' + p.n) + '" ' + paClick(key, p.k) + '></span>').join('') + '</div>';
}
const paHealthParts = s => ['done', 'overdue', 'soon', 'later', 'unscheduled'].map(k => ({ k, n: s[k], c: PA_COLOR[k], l: PA_LABEL[k] }));
const paStageParts = s => ['done', 'inprogress', 'notstarted'].map(k => ({ k, n: s[k], c: PA_COLOR[k], l: PA_LABEL[k] }));

function paLegend(parts, key) {
  return '<div class="pa-legend">' + parts.map(p => '<span class="pa-leg' + paOn(key, p.k) + '" ' + paClick(key, p.k) + '><i style="background:' + p.c + '"></i>' + esc(p.l) + ' <b>' + fmtNum(p.n) + '</b></span>').join('') + '</div>';
}

function paDonut(s) {
  const total = Math.max(1, s.total); let acc = 0;
  const stops = ['done', 'inprogress', 'notstarted'].map(k => { const a = acc / total * 100; acc += s[k]; return PA_COLOR[k] + ' ' + a + '% ' + (acc / total * 100) + '%'; }).join(',');
  return '<div class="pa-donut" style="background:conic-gradient(' + stops + ')"><div><b>' + s.progress + '%</b><span>complete</span></div></div>';
}

/* Progress against plan: the S-curve, with today marked and where you actually are. */
function paSCurveHtml(curve, today) {
  if (!curve.points.length) return '<div class="fg-hint">No planned dates to chart.</div>';
  const W = 520, H = 190, L = 34, R = 10, Tp = 10, B = 24, iw = W - L - R, ih = H - Tp - B;
  const x = d => L + iw * (Date.parse(d) - Date.parse(curve.from)) / Math.max(1, Date.parse(curve.to) - Date.parse(curve.from));
  const y = p => Tp + ih * (1 - p / 100);
  const line = curve.points.map(p => x(p.date).toFixed(1) + ',' + y(p.planned).toFixed(1)).join(' ');
  const tx = Math.max(L, Math.min(W - R, x(today)));
  const grid = [0, 25, 50, 75, 100].map(g => '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(g) + '" y2="' + y(g) + '" stroke="var(--border)"/><text x="' + (L - 6) + '" y="' + (y(g) + 3) + '" text-anchor="end" font-size="9" fill="var(--muted)">' + g + '%</text>').join('');
  const idx = curve.index;
  const verdict = idx == null ? '' : idx >= 0.95 ? '<b style="color:var(--c-green)">on or ahead of plan</b>' : idx >= 0.75 ? '<b style="color:var(--c-amber)">slightly behind plan</b>' : '<b style="color:var(--danger)">behind plan</b>';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto">' + grid +
    '<polyline points="' + line + '" fill="none" stroke="var(--accent2)" stroke-width="2"/>' +
    '<line x1="' + tx + '" x2="' + tx + '" y1="' + Tp + '" y2="' + (H - B) + '" stroke="var(--muted)" stroke-dasharray="3 3"/><text x="' + tx + '" y="' + (H - 8) + '" text-anchor="middle" font-size="9" fill="var(--muted)">today</text>' +
    '<circle cx="' + tx + '" cy="' + y(curve.planned) + '" r="4.5" fill="var(--accent2)"/><circle cx="' + tx + '" cy="' + y(curve.actual) + '" r="4.5" fill="var(--c-green)"/>' +
    '<text x="' + L + '" y="' + (H - 8) + '" font-size="9" fill="var(--muted)">' + esc(pmShortDate(curve.from)) + '</text><text x="' + (W - R) + '" y="' + (H - 8) + '" text-anchor="end" font-size="9" fill="var(--muted)">' + esc(pmShortDate(curve.to)) + '</text></svg>' +
    '<div class="pa-legend"><span class="pa-leg"><i style="background:var(--accent2)"></i>Planned today <b>' + curve.planned + '%</b></span><span class="pa-leg"><i style="background:var(--c-green)"></i>Actual <b>' + curve.actual + '%</b></span>' +
    (idx == null ? '' : '<span class="pa-leg">Schedule index <b>' + idx.toFixed(2) + '</b> &middot; ' + verdict + '</span>') + '</div>';
}

/* The timeline: one bar per project (or per phase once a project is chosen), progress filled in. */
function paGanttHtml(rows, today, opts) {
  const span = paSpan(rows);
  if (!span) return '<div class="fg-hint">Nothing is scheduled.</div>';
  const ticks = span.ticks.map(t => '<span style="left:' + paPos(span, t + '-01') + '%">' + esc(pmShortDate(t + '-01').replace(/^\d+ /, '')) + '</span>').join('');
  const tl = paPos(span, today);
  return '<div class="pa-gantt"><div class="pa-g-head"><div class="pa-g-label"></div><div class="pa-g-track pa-g-ticks">' + ticks + '</div></div>' +
    rows.map(r => {
      const l = paPos(span, r.start || span.from), w = Math.max(0.8, paPos(span, r.finish || r.start || span.from) - l);
      return '<div class="pa-g-row' + (r.on ? ' on' : '') + '"><div class="pa-g-label" title="' + esc(r.name) + '">' +
        '<a onclick="' + r.click + '">' + esc(r.name) + '</a><small>' + r.progress + '% &middot; ' + paCount(r.total, 'task', 'tasks') + (r.overdue ? ' &middot; <span style="color:var(--danger)">' + r.overdue + ' late</span>' : '') + '</small></div>' +
        '<div class="pa-g-track"><span class="pa-g-today" style="left:' + tl + '%"></span>' +
        '<span class="pa-g-bar" style="left:' + l + '%;width:' + w + '%" title="' + esc(r.name + ': ' + pmShortDate(r.start) + ' to ' + pmShortDate(r.finish) + ', ' + r.progress + '% complete') + '" onclick="' + r.click + '">' +
        '<span class="pa-g-fill" style="width:' + r.progress + '%"></span></span></div></div>';
    }).join('') + '</div>';
}

function paHBars(rows, key, color) {
  const max = Math.max(1, ...rows.map(r => r.n));
  return rows.map(r => '<div class="pa-hb' + paOn(key, r.k) + '" ' + paClick(key, r.k) + '><span class="pa-hb-l" title="' + esc(r.l) + '">' + esc(r.l) + '</span>' +
    '<span class="pa-hb-t"><span style="width:' + (r.n / max * 100) + '%;background:' + (r.c || color) + '"></span></span><b>' + (r.v == null ? r.n : r.v) + '</b></div>').join('');
}

function paTaskTable(tasks, today, shown) {
  const pname = id => ((state.pm.projects.find(p => p.id === id) || {}).name || '').replace(/^AEEG\s*/, '');
  const rows = tasks.slice(0, shown).map(t => {
    const h = paHealth(t, today);
    return '<tr><td class="num" style="text-align:left;color:var(--muted)">' + esc(t.wbs) + '</td><td style="font-weight:600">' + esc(t.name) + '</td><td style="color:var(--muted2)">' + esc(pname(t.projectId)) + '</td>' +
      '<td><span class="badge" style="background:color-mix(in srgb,' + PA_COLOR[h] + ' 14%,transparent);color:' + PA_COLOR[h] + '">' + esc(PA_LABEL[h]) + '</span></td>' +
      '<td class="num">' + pmShortDate(t.plannedFinish) + '</td><td class="num" style="font-weight:700">' + paPct(t) + '%</td>' +
      '<td style="color:var(--muted2)">' + esc((t.assignees || []).map(a => a.name).join(', ')) + '</td>' +
      '<td>' + (pmCanEdit() ? '<button class="btn btn-ghost btn-xs" onclick="pmOpenTask(\'' + esc(t.id) + '\')">Edit</button>' : '') + '</td></tr>';
  }).join('');
  return '<div class="table-wrap" style="border:0;max-height:560px"><table><thead><tr><th>WBS</th><th>Task</th><th>Project</th><th>Schedule</th><th class="num">Finish</th><th class="num">Done</th><th>Who</th><th></th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px">No tasks match these filters.</td></tr>') + '</tbody></table></div>' +
    (tasks.length > shown ? '<div style="text-align:center;margin-top:8px"><button class="btn btn-outline btn-sm" onclick="paShowAll()">Show all ' + fmtNum(tasks.length) + ' tasks</button></div>' : '');
}

function paHtml(opts) {
  if (!state.pm) return '<div class="empty" style="padding:30px"><h3>Loading the project plans&hellip;</h3></div>';
  if (state.pm.error) return '<div class="empty" style="padding:30px"><h3>The project plans could not be loaded</h3><p>Reload the page, or check that your account has CRM access.</p></div>';
  state.paLock = (opts && opts.lockProject) || '';
  const F = paFilters(); if (state.paLock) F.project = state.paLock;
  const today = paNow();
  const all = state.pm.tasks.filter(paIsLeaf);
  const real = new Set(state.pm.projects.filter(p => !p.isTemplate).map(p => p.id));
  const inScope = all.filter(t => real.has(t.projectId));
  const ft = paFilter(inScope, F, today);                  // what the filters leave
  const s = paSummary(ft, today);
  const base = paFilter(inScope, { project: F.project, who: F.who, tag: F.tag }, today);   // tallies that are themselves filters ignore the other filters' picks
  const bs = paSummary(base, today);
  const curve = paSCurve(ft.length ? ft : base, today);
  /* the project list ignores the project filter, so you can switch from one to another */
  const projRows = paByProject(paFilter(inScope, { who: F.who, tag: F.tag }, today), state.pm.projects, today).filter(r => r.total > 0);
  const person = paByPerson(base, today);
  const months = paByMonth(base, today);
  const tags = paTags(base);
  const phases = F.project ? paByPhase(state.pm.tasks, F.project, today) : [];

  const gantt = F.project
    ? phases.map(p => { const kids = state.pm.tasks.filter(t => paIsLeaf(t) && paPhaseKey(t) === p.key); const ds = kids.flatMap(t => [paDay(t.plannedStart), paDay(t.plannedFinish)]).filter(Boolean).sort();
        return { name: p.wbs + ' ' + p.name, start: ds[0], finish: ds[ds.length - 1], progress: p.progress, total: p.total, overdue: p.overdue, on: F.phase === p.key, click: "paSet('phase','" + p.key + "')" }; })
    : projRows.map(r => ({ ...r, on: F.project === r.id, click: "paSet('project','" + r.id + "')" }));

  const hd = (t, sub) => '<div class="card-header"><div><div class="card-title">' + t + '</div>' + (sub ? '<div class="card-sub">' + sub + '</div>' : '') + '</div></div>';
  return paBar(F) +
    '<div class="pa-tiles">' +
      paTile('Tasks', fmtNum(s.total), F.stage || F.health || F.month || F.phase ? 'of ' + fmtNum(bs.total) + ' in scope' : paCount(real.size, 'project', 'projects')) +
      paTile('Complete', s.progress + '%', 'effort-weighted') +
      paTile('Done', fmtNum(s.done), s.total ? Math.round(s.done / s.total * 100) + '% of tasks' : '', 'stage', 'done', 'var(--c-green)') +
      paTile('Overdue', fmtNum(s.overdue), 'past planned finish', 'health', 'overdue', s.overdue ? 'var(--danger)' : '') +
      paTile('Due in 14 days', fmtNum(s.soon), 'coming up', 'health', 'soon', 'var(--c-amber)') +
      paTile('Planned effort', fmtNum(Math.round(s.hours)) + ' h', paCount(s.milestones, 'milestone', 'milestones')) +
    '</div>' +
    '<div class="pa-row">' +
      '<div class="card">' + hd('Progress against plan', 'planned % complete across the plan, against where you are') + paSCurveHtml(curve, today) + '</div>' +
      '<div class="card">' + hd('Where the work stands', 'click a slice to list those tasks') +
        '<div class="pa-two">' + paDonut(s) + '<div style="flex:1;min-width:0">' + paLegend(paStageParts(s), 'stage') + '<div style="height:10px"></div>' + paStack(paHealthParts(s), 'health') + paLegend(paHealthParts(s), 'health') + '</div></div></div>' +
    '</div>' +
    '<div class="card" style="margin-top:14px">' + hd(F.project ? 'Phases' : 'Timeline', F.project ? 'each phase from first start to last finish; filled = progress. Click one to filter.' : 'each project from first start to last finish; filled = progress. Click one to filter.') + paGanttHtml(gantt, today) + '</div>' +
    '<div class="pa-row" style="margin-top:14px">' +
      '<div class="card">' + hd('Projects', 'schedule health per project') +
        projRows.map(r => '<div class="pa-prow' + paOn('project', r.id) + '"><div class="pa-prow-h"><a ' + paClick('project', r.id) + '>' + esc(r.name.replace(/^AEEG\s*/, '')) + '</a><span>' + r.progress + '% <small>vs ' + r.planned + '% planned</small> <a class="ext-link" style="font-size:11px" onclick="paOpenProject(\'' + r.id + '\')">open</a></span></div>' + paStack(paHealthParts(r), 'health') + '</div>').join('') + '</div>' +
      '<div class="card">' + hd('Workload by person', 'open tasks held; red = overdue') +
        paHBars(person.slice(0, 10).map(r => ({ k: r.id, l: r.name, n: r.open, v: r.open + (r.overdue ? ' (' + r.overdue + ' late)' : ''), c: r.overdue ? 'var(--danger)' : 'var(--c-blue)' })), 'who') + '</div>' +
    '</div>' +
    '<div class="pa-row" style="margin-top:14px">' +
      '<div class="card">' + hd('Tasks finishing each month', 'green done, red late, blue still to do') +
        '<div class="pa-months">' + months.map(m => { const tot = m.done + m.open + m.overdue; const mx = Math.max(...months.map(x => x.done + x.open + x.overdue));
          return '<div class="pa-month' + paOn('month', m.month) + '" ' + paClick('month', m.month) + ' title="' + esc(m.month + ': ' + tot + ' tasks') + '"><span class="pa-mcol" style="height:' + Math.max(4, tot / mx * 100) + '%">' +
            '<i style="flex:' + m.overdue + ';background:var(--danger)"></i><i style="flex:' + m.open + ';background:var(--c-blue)"></i><i style="flex:' + m.done + ';background:var(--c-green)"></i></span><small>' + esc(m.month.slice(2).replace('-', '/')) + '</small></div>'; }).join('') + '</div></div>' +
      '<div class="card">' + hd('Risks, issues and knowledge', 'tagged tasks; click to filter') +
        (Object.keys(tags).length ? paHBars(Object.entries(tags).map(([k, n]) => ({ k, l: k, n, c: k === 'Risk' ? 'var(--danger)' : k === 'Issue' ? 'var(--c-amber)' : 'var(--c-blue)' })), 'tag') : '<div class="fg-hint">No tagged tasks.</div>') +
        '<div class="section-title" style="margin:14px 0 6px">Phase progress</div>' + (phases.length ? paHBars(phases.map(p => ({ k: p.key, l: p.wbs + ' ' + p.name, n: p.progress, v: p.progress + '%', c: 'var(--c-green)' })), 'phase') : '<div class="fg-hint">Pick a project to see its phases.</div>') + '</div>' +
    '</div>' +
    '<div class="pa-row" style="margin-top:14px">' +
      '<div class="card">' + hd('Most overdue', 'worst first') + (paOverdue(ft, today, 8).map(o => '<div class="mkt-row"><div style="min-width:0"><div style="font-weight:600">' + esc(o.t.wbs + ' ' + o.t.name) + '</div><div class="mkt-note">' + esc((o.t.assignees || []).map(a => a.name).join(', ') || 'unassigned') + '</div></div><div class="mkt-value" style="color:var(--danger)">' + o.late + ' d late</div></div>').join('') || '<div class="fg-hint">Nothing is overdue.</div>') + '</div>' +
      '<div class="card">' + hd('Due in the next 30 days', 'soonest first') + (paUpcoming(ft, today, 30, 8).map(t => '<div class="mkt-row"><div style="min-width:0"><div style="font-weight:600">' + esc(t.wbs + ' ' + t.name) + '</div><div class="mkt-note">' + esc((t.assignees || []).map(a => a.name).join(', ') || 'unassigned') + '</div></div><div class="mkt-value">' + pmShortDate(t.plannedFinish) + '</div></div>').join('') || '<div class="fg-hint">Nothing falls due in the next 30 days.</div>') + '</div>' +
    '</div>' +
    '<div class="card" style="margin-top:14px">' + hd('Tasks <span class="mkt-note">' + fmtNum(ft.length) + '</span>', 'exactly the tasks the filters above leave') +
      paTaskTable(ft.slice().sort((a, b) => paDay(a.plannedFinish).localeCompare(paDay(b.plannedFinish)) || String(a.wbs).localeCompare(String(b.wbs), undefined, { numeric: true })), today, state.paAll ? 5000 : 40) + '</div>';
}

/* The Analytics mode of the Projects page. */
function renderProjectAnalytics() {
  setPage('Project analytics', 'portfolio overview and progress, from the ProjectManager.com plans', projectsModeToggle());
  if (state.paLock) paFilters().project = '';      // coming back from a site's own dashboard: start from the whole portfolio
  state.paLock = '';
  setContent(paHtml());
}
