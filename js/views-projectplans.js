/* ═══════════════════════════════════════════════════════════════════
   Project plans - the ProjectManager.com copy, browsable on the Projects page.

   The data is the AEEG ProjectManager.com workspace (projects, tasks, team,
   tags, activity), copied into the aee_pm_* tables by
   scripts/load-projectmanager.js. It lives in Supabase and not in a static
   file: files under data/ are served to anyone on the public web by GitHub
   Pages, and a project plan with staff names is not for that. Here it is read
   after sign-in, under the same access rule as the contacts.

   It is a dated copy, not a live feed. Status and percent complete are shown
   as ProjectManager.com holds them and do not always agree; the page says so
   rather than reconcile them.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* Which site on this page a ProjectManager.com project belongs to. Only the
   name matches are trusted; the guesses are shown as "maybe" and never used
   to join anything. */
const PM_SITE_LINKS = [
  { re: /middelburg/i, siteId: 'middelburg' },
  { re: /oudtshoorn/i, siteId: 'oudtshoorn' },
  { re: /riverlands/i, siteId: 'riverlands' },
];
const PM_SITE_GUESSES = [
  { re: /mapela/i, siteId: 'limpopo300' },
  { re: /sable hills/i, siteId: 'lephalale' },
  { re: /stanford/i, siteId: 'overberg' },
];

const PM_ACTIVITY_LABEL = {
  TaskProgressChanged: 'Progress changed', TaskCompleted: 'Completed',
  TaskDueChanged: 'Finish date changed', TaskStartChanged: 'Start date changed',
};

/* ─── LOAD ────────────────────────────────────────────────────────── */
async function loadProjectPlans() {
  try {
    const [pr, tk, pe, tg, ac, sy] = await Promise.all([
      supaFetchAll('aee_pm_projects?select=raw&order=name'),
      supaFetchAll('aee_pm_tasks?select=raw&order=project_id,id'),
      supaFetchAll('aee_pm_people?select=*&order=name'),
      supaFetchAll('aee_pm_tags?select=*&order=name'),
      supaFetchAll('aee_pm_activity?select=*&order=at.desc,id'),
      supaFetch('aee_pm_sync?select=*'),
    ]);
    const natural = (a, b) => String(a || '').localeCompare(String(b || ''), undefined, { numeric: true });
    state.pm = {
      projects: pr.map(r => r.raw).filter(Boolean),
      tasks: tk.map(r => r.raw).filter(Boolean).sort((a, b) => natural(a.projectId, b.projectId) || natural(a.wbs, b.wbs)),
      people: pe, tags: tg, activity: ac, sync: (sy && sy[0]) || {},
    };
  } catch (e) {
    console.warn('Project plans unavailable:', e);
    state.pm = { error: true };
  }
}

/* ─── HELPERS ─────────────────────────────────────────────────────── */
function pmShortDate(iso) {
  if (!iso) return '—';
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
  return isNaN(d) ? esc(iso) : d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: '2-digit' });
}
function pmToday() { return new Date().toISOString().slice(0, 10); }
function pmIsLeaf(t) { return !t.isSummary; }
function pmIsLate(t) { return pmIsLeaf(t) && t.plannedFinish && String(t.plannedFinish).slice(0, 10) < pmToday() && num(t.progress) < 100; }
function pmProjectTasks(pid) { return state.pm.tasks.filter(t => t.projectId === pid); }
function pmMw(p) { const m = /(\d+)\s*MW/i.exec(p.name || ''); return m ? Number(m[1]) : null; }
function pmSiteIdFor(p) { const l = PM_SITE_LINKS.find(x => x.re.test(p.name || '')); return l ? l.siteId : null; }
function pmSiteGuessFor(p) { const l = PM_SITE_GUESSES.find(x => x.re.test(p.name || '')); return l ? l.siteId : null; }
function pmSiteName(id) { const s = state.projects.find(x => x.id === id); return s ? s.name : ''; }
function pmPersonName(id) { const p = (state.pm.people || []).find(x => x.id === id); return p ? p.name : ''; }
function pmField(t, name) { const f = (t.fieldValues || []).find(x => x.name === name); return f ? f.value : ''; }

/* The progress of the ProjectManager.com project behind a site, for the site card. */
function pmProjectFor(siteId) {
  if (!state.pm || state.pm.error) return null;
  const p = state.pm.projects.find(x => pmSiteIdFor(x) === siteId && !x.isTemplate);
  return p ? { progress: num(p.progress) } : null;
}

/* ─── SECTION ─────────────────────────────────────────────────────── */
function pmSectionHtml() {
  const pm = state.pm;
  const tabs = [['overview', 'Overview'], ['plan', 'Plan'], ['team', 'Team'], ['activity', 'Activity']];
  state.pmTab = state.pmTab || 'overview';
  let body;
  if (!pm) body = '<div class="empty" style="padding:30px"><h3>Loading the project plans&hellip;</h3></div>';
  else if (pm.error) {
    body = '<div class="empty" style="padding:30px"><h3>The project plans could not be loaded</h3>' +
      '<p>They are read from the database after sign-in. Reload the page, or check that your account has CRM access.</p></div>';
  } else {
    body = state.pmTab === 'plan' ? pmPlanTabHtml()
      : state.pmTab === 'team' ? pmTeamTabHtml()
      : state.pmTab === 'activity' ? pmActivityTabHtml()
      : pmOverviewHtml();
  }
  const asOf = pm && pm.sync && pm.sync.as_of ? pm.sync.as_of : '';
  return '<div id="pm-section" class="card" style="margin-top:18px">' +
    '<div class="card-header"><div><div class="card-title">Project plans</div>' +
    '<div class="card-sub">ProjectManager.com copy' + (asOf ? ' &middot; taken ' + esc(asOf) : '') + '</div></div>' +
    '<div class="view-toggle">' + tabs.map(([k, label]) =>
      '<button class="vt-btn ' + (state.pmTab === k ? 'active' : '') + '" onclick="pmSetTab(\'' + k + '\')">' + label + '</button>').join('') +
    '</div></div>' + body +
    '<div class="fg-hint" style="margin-top:12px">A dated copy, not a live feed. Status and % are shown as ProjectManager.com holds them and ' +
    'do not always agree (for example 5 tasks per project are marked Done while the project sits at 0%). ' +
    'Cost and budget are not included: the account used to copy it has no permission for them.</div></div>';
}

function pmRefresh() {
  const el = document.getElementById('pm-section');
  if (el) { el.outerHTML = pmSectionHtml(); growBars(); }
}
function pmSetTab(k) { state.pmTab = k; pmRefresh(); }
function pmOpen(pid) { state.pmProject = pid; state.pmF = null; state.pmTab = 'plan'; pmRefresh(); }

/* ─── OVERVIEW ────────────────────────────────────────────────────── */
function pmOverviewHtml() {
  const real = state.pm.projects.filter(p => !p.isTemplate);
  const tmpl = state.pm.projects.filter(p => p.isTemplate);
  const all = state.pm.tasks;
  const leaf = all.filter(pmIsLeaf);
  const late = leaf.filter(pmIsLate).length;
  const row = p => {
    const ts = pmProjectTasks(p.id).filter(pmIsLeaf);
    const full = ts.filter(t => num(t.progress) >= 100).length;
    const doneStatus = ts.filter(t => t.status === 'Done').length;
    const sid = pmSiteIdFor(p), guess = !sid && !p.isTemplate ? pmSiteGuessFor(p) : null;
    const site = sid ? '<span class="ext-link" style="cursor:pointer" onclick="openProject(' + jsStr(sid) + ')">' + esc(pmSiteName(sid)) + '</span>'
      : guess ? '<span style="color:var(--muted)" title="Not linked - an unconfirmed guess">maybe ' + esc(pmSiteName(guess)) + '</span>'
      : '<span style="color:var(--muted)">—</span>';
    return '<tr class="clickable" onclick="pmOpen(' + jsStr(p.id) + ')"><td style="font-weight:700">' + esc(p.name) + '</td>' +
      '<td class="num">' + (pmMw(p) || '—') + '</td>' +
      '<td style="min-width:110px"><div class="fit-bar" style="margin:0"><span data-w="' + num(p.progress) + '" style="background:var(--accent)"></span></div></td>' +
      '<td class="num" style="font-weight:800">' + num(p.progress) + '%</td>' +
      '<td class="num">' + ts.length + '</td><td class="num">' + full + '</td><td class="num">' + doneStatus + '</td>' +
      '<td class="num">' + pmShortDate(p.plannedStart) + ' &ndash; ' + pmShortDate(p.plannedFinish) + '</td>' +
      '<td>' + esc(p.manager || '—') + '</td><td class="num">' + (p.members || []).length + '</td>' +
      '<td onclick="event.stopPropagation()">' + site + '</td></tr>';
  };
  return '<div class="stats-grid" style="margin-bottom:12px">' +
      statTile('pipeline', 'blue', 'Projects', String(real.length), tmpl.length + ' templates not counted') +
      statTile('check', 'green', 'Tasks', fmtNum(leaf.length), 'working tasks across the sites') +
      statTile('alert', 'amber', 'Past finish, not 100%', fmtNum(late), 'as of today') +
      statTile('contacts', 'purple', 'People', String((state.pm.people || []).filter(p => p.is_active !== false).length), 'active in ProjectManager.com') +
    '</div>' +
    '<div class="table-wrap" style="border:0"><table><thead><tr><th>Project</th><th class="num">MW</th><th colspan="2">Progress</th>' +
    '<th class="num">Tasks</th><th class="num">At 100%</th><th class="num">Marked Done</th><th class="num">Planned</th><th>Manager</th>' +
    '<th class="num">Members</th><th>Site in the app</th></tr></thead><tbody>' +
    real.map(row).join('') +
    (tmpl.length ? '<tr><td colspan="11" style="background:var(--bg3);color:var(--muted);font-size:11px;font-weight:700">TEMPLATES</td></tr>' + tmpl.map(row).join('') : '') +
    '</tbody></table></div><div class="fg-hint" style="margin-top:8px">Click a project to open its plan.</div>';
}

/* ─── PLAN ────────────────────────────────────────────────────────── */
function pmFilters() { return state.pmF || (state.pmF = { q: '', status: '', who: '', tag: '', late: false, noPhases: false }); }

function pmPlanTabHtml() {
  const projects = state.pm.projects;
  if (!state.pmProject || !projects.some(p => p.id === state.pmProject)) {
    const pick = projects.filter(p => !p.isTemplate).sort((a, b) => num(b.progress) - num(a.progress))[0] || projects[0];
    state.pmProject = pick && pick.id;
  }
  const p = projects.find(x => x.id === state.pmProject) || {};
  const ts = pmProjectTasks(p.id);
  const F = pmFilters();
  const people = [...new Map(ts.flatMap(t => t.assignees || []).map(a => [a.id, a.name])).entries()];
  const tags = [...new Set(ts.flatMap(t => t.tags || []))].sort();
  const opt = (v, l, cur) => '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(l) + '</option>';
  return '<div class="dh-metrics" style="margin:0 0 12px">' +
      '<div class="dh-metric"><div class="dh-metric-v">' + num(p.progress) + '%</div><div class="dh-metric-l">Project progress</div></div>' +
      '<div class="dh-metric"><div class="dh-metric-v">' + pmShortDate(p.plannedStart) + ' &ndash; ' + pmShortDate(p.plannedFinish) + '</div><div class="dh-metric-l">Planned</div></div>' +
      '<div class="dh-metric"><div class="dh-metric-v">' + esc(p.manager || '—') + '</div><div class="dh-metric-l">Manager &middot; ' + (p.members || []).length + ' members</div></div>' +
      '<div class="dh-metric"><div class="dh-metric-v">' + esc(p.status || '—') + '</div><div class="dh-metric-l">Status &middot; ' + esc(p.priority || 'no') + ' priority</div></div>' +
    '</div>' +
    '<div class="toolbar">' +
      '<select class="flt" onchange="pmSetProject(this.value)">' + projects.map(x => opt(x.id, x.name, p.id)).join('') + '</select>' +
      '<div class="search-wrap"><span class="search-icon">' + icon('search', 14) + '</span>' +
        '<input placeholder="Search tasks, tags, dataroom notes..." value="' + esc(F.q) + '" oninput="pmFilter(\'q\',this.value)"></div>' +
      '<select class="flt" onchange="pmFilter(\'status\',this.value)">' + opt('', 'All statuses', F.status) + ['To Do', 'Doing', 'Done'].map(s => opt(s, s, F.status)).join('') + '</select>' +
      '<select class="flt" onchange="pmFilter(\'who\',this.value)">' + opt('', 'Anyone', F.who) + people.map(([id, n]) => opt(id, n, F.who)).join('') + '</select>' +
      (tags.length ? '<select class="flt" onchange="pmFilter(\'tag\',this.value)">' + opt('', 'Any tag', F.tag) + tags.map(g => opt(g, g, F.tag)).join('') + '</select>' : '') +
      '<label class="result-count" style="cursor:pointer"><input type="checkbox" ' + (F.late ? 'checked ' : '') + 'onchange="pmFilter(\'late\',this.checked)"> past finish, not 100%</label>' +
      '<label class="result-count" style="cursor:pointer"><input type="checkbox" ' + (F.noPhases ? 'checked ' : '') + 'onchange="pmFilter(\'noPhases\',this.checked)"> hide phase rows</label>' +
    '</div><div id="pm-plan-results">' + pmPlanResultsHtml() + '</div>';
}

function pmSetProject(pid) { state.pmProject = pid; state.pmF = null; pmRefresh(); }
function pmFilter(k, v) { pmFilters()[k] = v; const el = document.getElementById('pm-plan-results'); if (el) el.innerHTML = pmPlanResultsHtml(); }

function pmPlanResultsHtml() {
  const F = pmFilters();
  const ts = pmProjectTasks(state.pmProject);
  const q = F.q.trim().toLowerCase();
  const filtering = !!(q || F.status || F.who || F.tag || F.late);
  const matches = t => {
    if (F.noPhases && t.isSummary) return false;
    if (filtering && t.isSummary) return false;      // a phase row is a heading, not a match
    if (F.status && t.status !== F.status) return false;
    if (F.who && !(t.assignees || []).some(a => a.id === F.who)) return false;
    if (F.tag && !(t.tags || []).includes(F.tag)) return false;
    if (F.late && !pmIsLate(t)) return false;
    if (q) {
      const hay = [t.wbs, t.name, t.description, (t.tags || []).join(' '), (t.assignees || []).map(a => a.name).join(' '),
        (t.fieldValues || []).map(f => f.value).join(' ')].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };
  const shown = ts.filter(matches);
  const fieldNames = [...new Set(ts.flatMap(t => (t.fieldValues || []).map(f => f.name)))].slice(0, 3);
  const statusBadge = s => '<span class="badge ' + (s === 'Done' ? 'b-contracted' : s === 'Doing' ? 'b-engaged' : 'b-prospect') + '">' + esc(s || '—') + '</span>';
  const body = shown.map(t => {
    const late = pmIsLate(t);
    return '<tr' + (t.isSummary ? ' style="background:var(--bg3)"' : '') + '>' +
      '<td class="num" style="text-align:left;color:var(--muted)">' + esc(t.wbs) + '</td>' +
      '<td style="padding-left:' + (14 + (Math.max(1, num(t.level)) - 1) * 18) + 'px;font-weight:' + (t.isSummary ? 800 : 500) + '">' + esc(t.name) +
        (t.isMilestone ? ' <span class="badge b-solar">milestone</span>' : '') + '</td>' +
      '<td>' + statusBadge(t.status) + '</td>' +
      '<td class="num">' + pmShortDate(t.plannedStart) + '</td>' +
      '<td class="num"' + (late ? ' style="color:var(--danger);font-weight:700" title="Past its planned finish and not 100% complete"' : '') + '>' + pmShortDate(t.plannedFinish) + '</td>' +
      '<td class="num" style="font-weight:700">' + num(t.progress) + '%</td>' +
      '<td class="num">' + (t.plannedEffortMin ? fmtNum(Math.round(t.plannedEffortMin / 60 * 10) / 10) + ' h' : '—') + '</td>' +
      '<td style="color:var(--muted2)">' + esc((t.assignees || []).map(a => a.name).join(', ')) + '</td>' +
      '<td>' + (t.tags || []).map(g => '<span class="badge ' + (g === 'Risk' ? 'b-high' : g === 'Issue' ? 'b-medium' : 'b-low') + '">' + esc(g) + '</span>').join(' ') + '</td>' +
      fieldNames.map(n => { const v = pmField(t, n); return '<td style="max-width:240px;color:var(--muted2)" title="' + esc(v) + '">' + esc(v.length > 70 ? v.slice(0, 68) + '…' : v) + '</td>'; }).join('') +
      '</tr>';
  }).join('');
  return '<div class="result-count" style="margin:2px 0 8px">' + shown.filter(pmIsLeaf).length + ' of ' + ts.filter(pmIsLeaf).length +
      ' tasks' + (filtering ? ' match' : '') + '</div>' +
    '<div class="table-wrap" style="border:0;max-height:620px"><table><thead><tr><th>WBS</th><th>Task</th><th>Status</th>' +
    '<th class="num">Start</th><th class="num">Finish</th><th class="num">Done</th><th class="num">Effort</th><th>Who</th><th>Tags</th>' +
    fieldNames.map(n => '<th>' + esc(n) + '</th>').join('') + '</tr></thead><tbody>' +
    (body || '<tr><td colspan="' + (9 + fieldNames.length) + '" style="text-align:center;color:var(--muted);padding:26px">Nothing matches those filters.</td></tr>') +
    '</tbody></table></div>';
}

/* ─── TEAM ────────────────────────────────────────────────────────── */
function pmTeamTabHtml() {
  const leaf = state.pm.tasks.filter(pmIsLeaf);
  const people = state.pm.people || [];
  const rows = people.map(p => {
    const mine = leaf.filter(t => (t.assignees || []).some(a => a.id === p.id));
    const effort = mine.reduce((s, t) => s + num(t.plannedEffortMin), 0) / 60;
    const projectsN = new Set(mine.map(t => t.projectId)).size;
    return '<tr><td style="font-weight:700">' + esc(p.name) + (p.is_active === false ? ' <span class="badge b-low">inactive</span>' : '') + '</td>' +
      '<td>' + esc(p.role || '—') + '</td>' +
      '<td>' + (p.email ? '<a class="ext-link" href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a>' : '—') + '</td>' +
      '<td class="num">' + projectsN + '</td><td class="num">' + mine.length + '</td>' +
      '<td class="num">' + mine.filter(pmIsLate).length + '</td><td class="num">' + fmtNum(Math.round(effort)) + ' h</td></tr>';
  }).join('');
  return '<div class="table-wrap" style="border:0"><table><thead><tr><th>Person</th><th>Role</th><th>Email</th>' +
    '<th class="num">Projects</th><th class="num">Tasks assigned</th><th class="num">Past finish, not 100%</th><th class="num">Planned effort</th></tr></thead><tbody>' +
    rows + '</tbody></table></div>' +
    '<div class="fg-hint" style="margin-top:8px">Counts come from the task assignments in the copy; effort is the planned effort on those tasks, not logged time.</div>';
}

/* ─── ACTIVITY ────────────────────────────────────────────────────── */
function pmActivityTabHtml() {
  const act = state.pm.activity || [];
  const total = state.pm.sync && state.pm.sync.notes && state.pm.sync.notes.activityTotal;
  const taskById = new Map(state.pm.tasks.map(t => [t.id, t]));
  const projById = new Map(state.pm.projects.map(p => [p.id, p]));
  const rows = act.map(a => {
    const t = taskById.get(a.task_id) || {}, p = projById.get(a.project_id) || {};
    return '<tr><td class="num" style="text-align:left;white-space:nowrap">' + pmShortDate(a.at) + '</td>' +
      '<td>' + esc(PM_ACTIVITY_LABEL[a.type] || a.type || '') + '</td>' +
      '<td>' + esc(a.message || '') + '</td>' +
      '<td style="font-weight:600">' + esc(t.name || '') + '</td>' +
      '<td style="color:var(--muted2)">' + esc(p.name || '') + '</td>' +
      '<td style="color:var(--muted2)">' + esc(pmPersonName(a.sender_id) || '') + '</td></tr>';
  }).join('');
  return '<div class="table-wrap" style="border:0;max-height:620px"><table><thead><tr><th>When</th><th>What</th><th>Detail</th><th>Task</th><th>Project</th><th>By</th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:26px">No activity recorded.</td></tr>') + '</tbody></table></div>' +
    '<div class="fg-hint" style="margin-top:8px">The latest ' + act.length + (total ? ' of ' + total : '') +
    ' changes. ProjectManager.com only returns the most recent 100, so earlier history is not in this copy.</div>';
}
