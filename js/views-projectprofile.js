/* ═══════════════════════════════════════════════════════════════════
   Project profile - one generation site on a page of its own.

   Clicking a site anywhere (the portfolio table or cards, the dashboard bars,
   a site name in the project plans) lands here. It puts together what the CRM
   knows about the site: the capacity and how much of it is sold, who is in
   discussion, how delivery is going in ProjectManager.com, what is due next,
   the notes people and agents have left, and which prospects are nearby.

   Nothing on it is stored here; it reads the same state as the pages it
   links to, so it is always in step with them.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* The ProjectManager.com project for a site. A name match is certain; the
   guesses (Mapela is probably the 300 MW Limpopo site) are offered, never
   assumed. */
function projectPmFor(siteId) {
  if (!state.pm || state.pm.error) return null;
  const real = state.pm.projects.filter(x => !x.isTemplate);
  const sure = real.find(x => pmSiteIdFor(x) === siteId);
  if (sure) return { p: sure, sure: true };
  const maybe = real.find(x => pmSiteGuessFor(x) === siteId);
  return maybe ? { p: maybe, sure: false } : null;
}

/* The Delivery card's button: the plan itself is a tab on this page. */
function projectOpenPlan() { state.projectTab = 'plan'; renderProject(); }
function projectSetTab(k) { state.projectTab = k; renderProject(); }

/* The next things due on a plan: open leaf tasks, soonest finish first. */
function projectUpNext(tasks, n) {
  return tasks.filter(t => pmIsLeaf(t) && num(t.progress) < 100 && t.plannedFinish)
    .sort((a, b) => String(a.plannedFinish).localeCompare(String(b.plannedFinish))).slice(0, n);
}

function projectDeliveryHtml(site) {
  const m = projectPmFor(site.id);
  if (!m) {
    return '<div class="card"><div class="card-header"><div class="card-title">Delivery</div></div>' +
      '<div class="fg-hint">No ProjectManager.com plan is linked to this site yet.</div></div>';
  }
  const p = m.p;
  const ts = pmProjectTasks(p.id);
  const leaf = ts.filter(pmIsLeaf);
  const done = leaf.filter(t => num(t.progress) >= 100).length;
  const late = leaf.filter(pmIsLate);
  const next = projectUpNext(ts, 5);
  const pct = num(p.progress);
  return '<div class="card"><div class="card-header"><div><div class="card-title">Delivery</div>' +
    '<div class="card-sub">' + esc(p.name) + ' &middot; ProjectManager.com' + (m.sure ? '' : ' &middot; <b>probable match, not confirmed</b>') + '</div></div>' +
    '<button class="btn btn-ghost btn-xs" onclick="projectOpenPlan(\'' + esc(p.id) + '\')">Open the plan</button></div>' +
    '<div class="fit-row"><span>Project progress</span><span>' + pct + '%</span></div>' +
    '<div class="fit-bar"><span data-w="' + pct + '" style="background:var(--accent2)"></span></div>' +
    '<div class="dh-metrics" style="margin:12px 0">' +
      '<div class="dh-metric"><div class="dh-metric-v">' + done + ' / ' + leaf.length + '</div><div class="dh-metric-l">tasks done</div></div>' +
      '<div class="dh-metric"><div class="dh-metric-v"' + (late.length ? ' style="color:var(--danger)"' : '') + '>' + late.length + '</div><div class="dh-metric-l">past finish, not 100%</div></div>' +
      '<div class="dh-metric"><div class="dh-metric-v">' + pmShortDate(p.plannedStart) + ' &ndash; ' + pmShortDate(p.plannedFinish) + '</div><div class="dh-metric-l">planned</div></div>' +
      '<div class="dh-metric"><div class="dh-metric-v">' + esc(p.manager || '—') + '</div><div class="dh-metric-l">manager &middot; ' + esc(p.status || '') + '</div></div>' +
    '</div>' +
    '<div class="section-title" style="margin:6px 0">Due next</div>' +
    (next.length ? next.map(t => '<div class="mkt-row"><div style="min-width:0"><div style="font-weight:600">' + esc(t.wbs) + ' ' + esc(t.name) + '</div>' +
      '<div class="mkt-note">' + esc((t.assignees || []).map(a => a.name).join(', ') || 'unassigned') + '</div></div>' +
      '<div class="mkt-value"' + (pmIsLate(t) ? ' style="color:var(--danger)"' : '') + '>' + pmShortDate(t.plannedFinish) + '</div></div>').join('')
      : '<div class="fg-hint">Nothing outstanding.</div>') + '</div>';
}

function projectBuyersHtml(site) {
  const deals = state.deals.filter(d => d.projectId === site.id).sort((a, b) => num(b.mw) - num(a.mw));
  const stage = id => ((typeof PIPELINE_STAGES !== 'undefined' && PIPELINE_STAGES.find(s => s.id === id)) || {}).label || id;
  return '<div class="card"><div class="card-header"><div><div class="card-title">Buyers</div>' +
    '<div class="card-sub">' + deals.length + ' deal' + (deals.length === 1 ? '' : 's') + ' on this site</div></div>' +
    '<button class="btn btn-ghost btn-xs" onclick="nav(\'pipeline\')">Pipeline</button></div>' +
    (deals.length ? deals.map(d => {
      const o = getOfftaker(d.offtakerId);
      return '<div class="mkt-row" style="cursor:pointer" onclick="nav(\'detail\',{id:\'' + esc(d.offtakerId) + '\'})"><div style="min-width:0">' +
        '<div style="font-weight:700">' + esc(o.name || d.name || 'Unknown') + '</div>' +
        '<div class="mkt-note">' + esc(stage(d.stage)) + (d.closeDate ? ' &middot; close ' + esc(d.closeDate) : '') + '</div></div>' +
        '<div class="mkt-value">' + fmtNum(d.mw) + ' MW</div></div>';
    }).join('') : '<div class="fg-hint">No one is in discussion for this site yet.</div>') + '</div>';
}

/* Prospects in the same province, biggest load first: who to call next. */
function projectNearbyHtml(site) {
  const near = state.offtakers.filter(o => inProvince(o, site.province) && num(o.peakMw) > 0)
    .sort((a, b) => num(b.peakMw) - num(a.peakMw)).slice(0, 6);
  return '<div class="card"><div class="card-header"><div><div class="card-title">Prospects in ' + esc(site.province) + '</div>' +
    '<div class="card-sub">largest peak load first</div></div></div>' +
    (near.length ? near.map(o => '<div class="mkt-row" style="cursor:pointer" onclick="nav(\'detail\',{id:\'' + esc(o.id) + '\'})"><div style="min-width:0">' +
      '<div style="font-weight:700">' + esc(o.name) + '</div><div class="mkt-note">' + esc(o.city || o.province) + '</div></div>' +
      '<div class="mkt-value">' + fmtNum(o.peakMw) + ' MW</div></div>').join('')
      : '<div class="fg-hint">No prospects with a recorded load in this province.</div>') + '</div>';
}

function projectNotesHtml(site) {
  const m = projectPmFor(site.id);
  if (!m || !state.pm.notes) return '';
  const pmId = m.p.id;
  const notes = state.pm.notes.filter(n => n.project_id === pmId).slice(0, 6);
  const name = id => { const t = state.pm.tasks.find(x => x.id === id); return t ? t.name : ''; };
  return '<div class="card" style="margin-top:14px"><div class="card-header"><div><div class="card-title">Notes</div>' +
    '<div class="card-sub">from people and agents, on the project and its tasks</div></div></div>' +
    (notes.length ? notes.map(n => '<div class="mkt-row" style="align-items:flex-start"><div style="min-width:0">' +
      (n.task_id ? '<div class="mkt-note">' + esc(name(n.task_id)) + '</div>' : '') +
      '<div style="white-space:pre-wrap">' + esc(n.body) + '</div>' +
      '<div class="mkt-note">' + esc(n.author) + ' &middot; ' + esc(pmWhen(n.created_at)) + '</div></div>' +
      '<span class="badge ' + (n.author_kind === 'agent' ? 'b-engaged' : 'b-low') + '">' + (n.author_kind === 'agent' ? 'Agent' : 'Person') + '</span></div>').join('')
      : '<div class="fg-hint">No notes yet.</div>') +
    (pmCanEdit() ? '<div style="display:flex;gap:8px;margin-top:10px"><textarea id="pn-body" placeholder="Add a project note..." style="flex:1;min-height:48px"></textarea>' +
      '<button class="btn btn-primary" style="align-self:flex-end" onclick="projectAddNote(\'' + esc(pmId) + '\')">Add</button></div>' : '') + '</div>';
}
async function projectAddNote(pmId) { await pmAddNote(pmId); if (state.view === 'project') renderProject(); }

/* The site's complete ProjectManager.com plan, on the profile: the same Plan
   table as on the Projects page (filters, Edit, + New task), fixed to this
   site's project. Edits made here are the same edits, kept in the same place. */
function projectPlanHtml(site) {
  const m = projectPmFor(site.id);
  if (!m) return '<div class="card"><div class="card-header"><div class="card-title">Project plan</div></div>' +
    '<div class="fg-hint">No ProjectManager.com plan is linked to this site yet.</div></div>';
  return '<div class="card"><div class="card-header"><div><div class="card-title">Project plan</div>' +
    '<div class="card-sub">' + esc(m.p.name) + ' &middot; ProjectManager.com copy' + (m.sure ? '' : ' &middot; <b>probable match, not confirmed</b>') + '</div></div></div>' +
    pmPlanTabHtml(m.p.id) + '</div>';
}

/* The same dashboard as Projects > Analytics, locked to this site's project. */
function projectAnalyticsHtml(site, m) {
  if (!m) return '<div class="card"><div class="card-header"><div class="card-title">Analytics</div></div><div class="fg-hint">No ProjectManager.com plan is linked to this site yet, so there is nothing to analyse.</div></div>';
  return paHtml({ lockProject: m.p.id });
}

/* The delivery analytics sit at the head of the Overview, under the guide card;
   the commercial picture and the rest follow. A site with no plan has none. */
function projectOverviewHtml(site, m) {
  return (m ? '<div class="section-title" style="margin:2px 0 6px">Delivery analytics</div>' + projectAnalyticsHtml(site, m) +
      '<div class="section-title" style="margin:22px 0 10px">The site and its buyers</div>' : '') +
    projectSiteHtml(site);
}

function projectSiteHtml(site) {
  const committed = projectCommitted(site), signed = projectSigned(site);
  const pct = Math.min(100, committed / Math.max(1, num(site.mw)) * 100);
  const gwh = Math.round(num(site.mw) * 8760 * CAPACITY_FACTOR / 1000);
  return '<div class="stats-grid">' +
      statTile('sun', 'amber', 'Capacity', fmtNum(site.mw) + ' MW', 'Solar PV + BESS') +
      statTile('pipeline', 'blue', 'Annual energy', fmtNum(gwh) + ' GWh', 'at the portfolio capacity factor') +
      statTile('check', 'green', 'Signed', fmtNum(signed) + ' MW', fmtNum(committed) + ' MW committed in all') +
      statTile('target', 'purple', 'Still to sell', fmtNum(Math.max(0, num(site.mw) - committed)) + ' MW', Math.round(pct) + '% allocated') +
    '</div>' +
    '<div class="card" style="margin-bottom:14px"><div class="card-header"><div class="card-title">The site</div></div>' +
      '<div class="fit-row"><span>Allocated</span><span style="color:' + allocationColor(pct) + '">' + Math.round(pct) + '%</span></div>' +
      '<div class="fit-bar"><span data-w="' + pct + '" style="background:' + allocationColor(pct) + '"></span></div>' +
      '<div style="font-size:12.5px;color:var(--muted2);line-height:1.6;margin-top:10px">' + esc(site.note) + '</div>' +
      '<div class="mkt-note" style="margin-top:8px">' + esc(site.town) + ', ' + esc(site.province) + ' &middot; ' +
        (site.lat != null ? site.lat + ', ' + site.lng + ' &middot; ' : '') + 'status ' + esc(site.status || 'development') + '</div></div>' +
    '<div class="grid-2">' + projectDeliveryHtml(site) + projectBuyersHtml(site) + '</div>' +
    '<div style="margin-top:14px">' + projectNearbyHtml(site) + '</div>' + projectNotesHtml(site);
}

/* ─── THE GUIDE CARD ──────────────────────────────────────────────────
   A plain-language card at the top of a site's page: what the page is, what
   the numbers on it are right now, and what the current tab shows and how to
   read it. It follows the tab you are on, can be hidden, and remembers that. */
const PROJECT_GUIDE = {
  overview: site => [
    ['Capacity and annual energy', 'The site\u2019s size in megawatts, and what it would generate in a year at the portfolio\u2019s ' + Math.round(CAPACITY_FACTOR * 100) + '% capacity factor.'],
    ['Signed and still to sell', 'Signed is power under an executed PPA. Still to sell is what is left after signed deals and the deals being negotiated.'],
    ['Delivery', 'How the build is going in ProjectManager.com: percent complete, tasks finished, tasks past their planned finish, the next five due, and the project manager.'],
    ['Buyers', 'The deals on this site with the buyer, stage and MW. Click one to open the company.'],
    ['Prospects in ' + site.province, 'Companies on your list in the same province, largest load first: the natural next calls.'],
    ['Notes', 'What your team and the agents have noted on the project and its tasks.'],
  ],
  overviewAnalytics: () => [
    ['Everything is clickable', 'A tile, a slice, a bar, a person, a month or a phase filters the task list at the bottom. The chips show what is applied; the \u00d7 on a chip removes it.'],
    ['Progress against plan', 'The line is how much should be done by each date if every task ran evenly from its start to its finish; the green dot is where the site actually is. The schedule index is actual divided by planned: 1.00 is on plan, below 0.75 is behind.'],
    ['Schedule health', 'Overdue means past the planned finish and not 100%. Due in 14 days, Scheduled later and No date make up the rest; finished tasks are Done.'],
    ['Timeline', 'Each bar runs from a phase\u2019s first start to its last finish; the filled part is progress and the red line is today.'],
    ['Complete %', 'Weighted by effort, so a long task counts for more than a short one.'],
  ],
  plan: () => [
    ['At a glance', 'The strip at the top gives progress against plan, what is overdue and what is due soon. Click a tile or a phase to list just those tasks; the chips show what is applied.'],
    ['Start here', 'The most overdue tasks and the next ones due, each with an Edit button, so you can begin working the plan straight away.'],
    ['The complete plan', 'Every phase and task for this site from ProjectManager.com: status, planned dates, percent done, effort, who and tags.'],
    ['Changing it', (pmCanEdit() ? 'Edit changes a task and + New task adds one. ' : 'Only admins can change tasks. ') +
      'Changes are saved here with a history; the ProjectManager.com copy underneath is not touched, and changed rows are tagged \u201cedited\u201d.'],
    ['Filtering', 'Search, status, person and tag narrow the list; \u201cpast finish, not 100%\u201d shows only what is late.'],
    ['Status and percent can disagree', 'They are shown as ProjectManager.com holds them, so a task can read \u201cTo Do\u201d at 95%.'],
  ],
};

function projectGuideHtml(site, tab, m) {
  if (projectGuideHidden()) return guideCardHtml('', [], [], '');
  const committed = projectCommitted(site), signed = projectSigned(site);
  const commercial = fmtNum(signed) + ' MW signed, ' + fmtNum(Math.max(0, committed - signed)) + ' MW in discussion and ' + fmtNum(Math.max(0, num(site.mw) - committed)) + ' MW still to sell.';
  let delivery;
  if (m) {
    const leaf = pmProjectTasks(m.p.id).filter(pmIsLeaf), today = paNow();
    const s = paSummary(leaf, today), planned = paPlannedPct(leaf, today);
    delivery = 'On the delivery side, ' + s.progress + '% of the work is done against ' + planned + '% planned; ' + fmtNum(s.overdue) + (s.overdue === 1 ? ' task is' : ' tasks are') + ' past ' + (s.overdue === 1 ? 'its' : 'their') + ' finish date and ' + fmtNum(s.soon) + ' fall' + (s.soon === 1 ? 's' : '') + ' due in the next 14 days.';
  } else {
    delivery = 'No delivery plan is linked to this site yet, so only the commercial picture is shown.';
  }
  const asOf = state.pm && state.pm.sync && state.pm.sync.as_of ? state.pm.sync.as_of : '';
  /* the Overview explains its analytics first, then the commercial cards; a site with no plan has no delivery cards or notes to explain */
  const raw = tab === 'plan' ? PROJECT_GUIDE.plan(site) : (m ? PROJECT_GUIDE.overviewAnalytics() : []).concat(PROJECT_GUIDE.overview(site));
  const items = raw.filter(([k]) => m || !['Delivery', 'Notes'].includes(k));
  return guideCardHtml((tab === 'plan' ? 'The Project plan tab' : 'The Overview tab') + ' of ' + site.name,
    ['This is the page for <b>' + esc(site.name) + '</b>, a ' + fmtNum(site.mw) + ' MW solar and battery site at ' + esc(site.town) + ', ' + esc(site.province) +
      ', planned to reach commercial operation in ' + esc(site.cod) + '. It puts the two sides of the site together: the <b>commercial</b> side (how much is sold, and to whom) and the <b>delivery</b> side (how the build is progressing).',
     '<b>Right now:</b> ' + esc(commercial) + ' ' + esc(delivery)],
    items,
    'Where it comes from: the site\u2019s facts are AEE\u2019s portfolio; the deals are your pipeline' + (m ? '; the plan is the ProjectManager.com copy' + (asOf ? ' taken ' + esc(asOf) : '') +
      ', with any edits made here layered on top' : '') + '.' + (m && !m.sure ? ' <b>This plan is a probable match for the site, not a confirmed one.</b>' : ''));
}

function renderProject() {
  const site = state.projects.find(p => p.id === state.projectId);
  if (!site) { nav('projects'); return; }
  /* each site opens on its overview; the tab is remembered only while you stay on that site */
  if (state.projectTabFor !== site.id) { state.projectTabFor = site.id; state.projectTab = 'overview'; state.paF = {}; state.paAll = false; }
  const tab = state.projectTab === 'plan' ? 'plan' : 'overview';
  const m = projectPmFor(site.id);
  const tabs = [['overview', 'Overview'], ['plan', 'Project plan' + (m ? ' (' + pmProjectTasks(m.p.id).filter(pmIsLeaf).length + ' tasks)' : '')]];
  setPage(site.name, site.town + ', ' + site.province + ' \u00b7 COD ' + site.cod, '');
  setContent(
    projectGuideHtml(site, tab, m) +
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap">' +
      '<button class="btn btn-ghost btn-sm" onclick="nav(\'projects\')">&larr; All projects</button>' +
      '<div class="view-toggle">' + tabs.map(([k, l]) => '<button class="vt-btn ' + (tab === k ? 'active' : '') + '" onclick="projectSetTab(\'' + k + '\')">' + esc(l) + '</button>').join('') + '</div></div>' +
    (tab === 'plan' ? projectPlanHtml(site) : projectOverviewHtml(site, m)));
  growBars();
}
