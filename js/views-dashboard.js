/* ═══════════════════════════════════════════════════════════════════
   Dashboard + Pipeline
   The dashboard answers one question for a sales rep opening the app in
   the morning: who do I call today, and why.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

function portfolioMw() { return state.projects.filter(p => p.status !== 'pipeline').reduce((s, p) => s + num(p.mw), 0); }
function contractedMw() { return state.deals.filter(d => d.stage === 'signed').reduce((s, d) => s + num(d.mw), 0); }
function pipelineMw() { return state.deals.filter(d => d.stage !== 'signed').reduce((s, d) => s + num(d.mw), 0); }

function renderDashboard() {
  setPage('Dashboard', 'Offtaker pipeline for African Earth Energy',
    '<button class="btn btn-outline btn-sm" onclick="nav(\'calculator\')">' + icon('calc', 14) + ' Savings calculator</button>' +
    '<button class="btn btn-primary btn-sm" data-admin-only onclick="openAddOfftaker()">' + icon('plus', 14) + ' Add offtaker</button>');

  const offtakers = state.offtakers;
  const openDeals = state.deals.filter(d => d.stage !== 'signed');
  const weighted = openDeals.reduce((s, d) => s + weightedValue(d), 0);
  const available = portfolioMw() - contractedMw();
  const hot = offtakers.map(o => ({ o, f: fitScore(o) })).sort((a, b) => b.f - a.f);

  /* ── Stat row ───────────────────────────────────────────────── */
  const stats = [
    { icon: 'building', cls: 'green', label: 'Offtakers tracked', value: offtakers.length,
      sub: offtakers.filter(o => o.status === 'prospect').length + ' still untouched', go: "nav('offtakers')" },
    { icon: 'pipeline', cls: 'amber', label: 'Open pipeline', value: fmtNum(pipelineMw()) + ' MW',
      sub: openDeals.length + ' live opportunities', go: "nav('pipeline')" },
    { icon: 'trending', cls: 'blue', label: 'Weighted value', value: fmtR(weighted),
      sub: 'probability-adjusted, contract life', go: "nav('pipeline')" },
    { icon: 'sun', cls: 'purple', label: 'Capacity to sell', value: fmtNum(available) + ' MW',
      sub: 'of ' + fmtNum(portfolioMw()) + ' MW in development', go: "nav('projects')" },
    { icon: 'contacts', cls: 'green', label: 'Contacts', value: state.contacts.length,
      sub: state.contacts.filter(c => !c.email).length + ' missing an email', go: "nav('contacts')" },
  ];
  const statsHtml = '<div class="stats-grid">' + stats.map(s =>
    '<div class="stat-card" onclick="' + s.go + '">' +
      '<div class="stat-icon-box ' + s.cls + '">' + icon(s.icon, 18) + '</div>' +
      '<div class="stat-text"><div class="stat-label">' + s.label + '</div>' +
      '<div class="stat-value">' + s.value + '</div>' +
      '<div class="stat-sub">' + esc(s.sub) + '</div></div></div>').join('') + '</div>';

  /* ── Today's call list ──────────────────────────────────────── */
  const callList = hot.filter(x => x.o.status !== 'contracted' && x.o.status !== 'lost').slice(0, 7);
  const callHtml =
    '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">Today\'s call list</div>' +
      '<div class="card-sub">Ranked by fit score — load size, shape, tariff headroom, wheeling and distance to a site</div></div>' +
      '<button class="btn btn-ghost btn-xs" onclick="nav(\'offtakers\')">See all</button></div>' +
      (callList.length ? callList.map(({ o, f }) => {
        const np = nearestProject(o);
        const c = contactsFor(o.id).sort((a, b) => (a.role === 'decision' ? -1 : 1))[0];
        return '<div class="person-row" style="cursor:pointer" onclick="nav(\'detail\',{id:\'' + o.id + '\'})">' +
          '<div class="av" style="background:' + avatarColor(o.name) + '">' + f + '</div>' +
          '<div style="min-width:0;flex:1">' +
            '<div class="person-name">' + esc(o.short || o.name) + '</div>' +
            '<div class="person-title">' + fmtNum(o.annualGwh) + ' GWh/yr · R' + num(o.tariff).toFixed(2) + '/kWh · ' +
            (np ? esc(np.project.town) + ' ' + np.km + ' km' : 'no nearby site') +
            (c ? ' · ' + esc(c.title) : '') + '</div>' +
          '</div>' +
          '<div class="person-actions"><span class="badge b-' + o.status + '">' + (STATUS_LABEL[o.status] || o.status) + '</span></div>' +
        '</div>';
      }).join('') : '<div class="empty"><h3>Nothing queued</h3><p>Add an offtaker to start building a call list.</p></div>') +
    '</div>';

  /* ── Stage funnel ───────────────────────────────────────────── */
  const byStage = PIPELINE_STAGES.map(s => {
    const list = state.deals.filter(d => d.stage === s.id);
    return { ...s, count: list.length, mw: list.reduce((a, d) => a + num(d.mw), 0) };
  });
  const maxMw = Math.max(1, ...byStage.map(s => s.mw));
  const funnelHtml =
    '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">Pipeline by stage</div>' +
      '<div class="card-sub">Contracted capacity moving through the funnel</div></div>' +
      '<button class="btn btn-ghost btn-xs" onclick="nav(\'pipeline\')">Open board</button></div>' +
      byStage.map(s =>
        '<div class="bar-row"><div class="bar-label" title="' + esc(s.hint) + '">' + esc(s.label) + '</div>' +
        '<div class="bar-track"><span class="bar-fill" data-w="' + ((s.mw / maxMw) * 100) + '" ' +
        'style="background:linear-gradient(90deg,var(--accent),var(--accent2))"></span></div>' +
        '<div class="bar-num">' + fmtNum(s.mw) + '</div></div>').join('') +
      '<div class="fg-hint" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">MW under discussion at each stage. ' +
      fmtNum(contractedMw()) + ' MW signed to date.</div>' +
    '</div>';

  /* ── Sector mix ─────────────────────────────────────────────── */
  const sectors = {};
  offtakers.forEach(o => { sectors[o.sector] = (sectors[o.sector] || 0) + num(o.annualGwh); });
  const sectorRows = Object.entries(sectors).sort((a, b) => b[1] - a[1]);
  const sectorMax = Math.max(1, ...sectorRows.map(r => r[1]));
  const sectorHtml =
    '<div class="card">' +
      '<div class="card-header"><div class="card-title">Addressable load by sector</div></div>' +
      sectorRows.map(([k, v]) =>
        '<div class="bar-row"><div class="bar-label">' + esc(SECTOR_LABEL[k] || k) + '</div>' +
        '<div class="bar-track"><span class="bar-fill" data-w="' + ((v / sectorMax) * 100) + '" style="background:var(--accent2)"></span></div>' +
        '<div class="bar-num">' + fmtNum(v) + '</div></div>').join('') +
      '<div class="fg-hint" style="margin-top:8px">GWh a year across tracked offtakers.</div>' +
    '</div>';

  /* ── Capacity allocation per project ────────────────────────── */
  const projRows = state.projects.filter(p => p.status !== 'pipeline').map(p => {
    const committed = state.deals.filter(d => d.projectId === p.id && d.stage !== 'lost').reduce((s, d) => s + num(d.mw), 0);
    return { p, committed, pct: Math.min(100, (committed / Math.max(1, p.mw)) * 100) };
  }).sort((a, b) => b.pct - a.pct);
  const projHtml =
    '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">Capacity allocation</div>' +
      '<div class="card-sub">How much of each site is spoken for</div></div>' +
      '<button class="btn btn-ghost btn-xs" onclick="nav(\'projects\')">Projects</button></div>' +
      projRows.map(({ p, committed, pct }) =>
        '<div class="bar-row"><div class="bar-label" title="' + esc(p.name) + '">' + esc(p.town) + '</div>' +
        '<div class="bar-track"><span class="bar-fill" data-w="' + pct + '" style="background:' +
        (pct >= 90 ? 'var(--danger)' : pct >= 50 ? 'var(--accent2)' : 'var(--accent)') + '"></span></div>' +
        '<div class="bar-num">' + Math.round(pct) + '%</div></div>').join('') +
      '<div class="fg-hint" style="margin-top:8px">Committed MW across all live opportunities against site capacity. Over 100% means the site is oversubscribed — good problem, but worth triaging.</div>' +
    '</div>';

  /* ── Recent activity ────────────────────────────────────────── */
  const recent = state.interactions.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 6);
  const actHtml =
    '<div class="card">' +
      '<div class="card-header"><div class="card-title">Recent activity</div>' +
      '<button class="btn btn-ghost btn-xs" onclick="nav(\'activity\')">Full log</button></div>' +
      (recent.length ? recent.map(i =>
        '<div class="int-row"><div class="int-dot"></div><div class="int-body">' +
        '<div class="int-meta">' + esc(i.type) + ' · ' + esc(getOfftaker(i.offtakerId).short || 'Unknown') + ' · ' + relTime(i.date) + '</div>' +
        '<div class="int-text">' + esc(i.summary) + '</div></div></div>').join('')
        : '<div class="empty" style="padding:28px 10px"><h3>No activity logged yet</h3><p>Log a call or meeting from any offtaker page and it shows up here.</p></div>') +
    '</div>';

  setContent(statsHtml +
    '<div class="cols-2">' + callHtml + funnelHtml + '</div>' +
    '<div class="grid-3" style="margin-top:14px">' + sectorHtml + projHtml + actHtml + '</div>');
  growBars();
}

function growBars() {
  setTimeout(() => {
    document.querySelectorAll('.bar-fill[data-w]').forEach(el => { el.style.width = el.dataset.w + '%'; });
    document.querySelectorAll('.fit-bar span[data-w]').forEach(el => { el.style.width = el.dataset.w + '%'; });
  }, 40);
}

/* ═══════════════════════════════════════════════════════════════
   PIPELINE — drag-and-drop kanban of PPA opportunities
   ═══════════════════════════════════════════════════════════════ */
function renderPipeline() {
  const open = state.deals.filter(d => d.stage !== 'signed');
  setPage('Pipeline', open.length + ' live opportunities · ' + fmtNum(pipelineMw()) + ' MW under discussion',
    '<button class="btn btn-outline btn-sm" onclick="exportPipeline()">' + icon('download', 14) + ' Export</button>' +
    '<button class="btn btn-primary btn-sm" data-admin-only onclick="openAddDeal()">' + icon('plus', 14) + ' New opportunity</button>');

  const totalWeighted = state.deals.reduce((s, d) => s + weightedValue(d), 0);
  const summary =
    '<div class="stats-grid">' +
      statTile('pipeline', 'amber', 'Open opportunities', open.length, fmtNum(pipelineMw()) + ' MW') +
      statTile('trending', 'blue', 'Weighted pipeline', fmtR(totalWeighted), 'across contract life') +
      statTile('bolt', 'green', 'Signed', fmtNum(contractedMw()) + ' MW',
        state.deals.filter(d => d.stage === 'signed').length + ' executed PPAs') +
      statTile('clock', 'purple', 'Average tenor',
        state.deals.length ? Math.round(state.deals.reduce((s, d) => s + num(d.tenor), 0) / state.deals.length) + ' yrs' : '—',
        'weighted by opportunity count') +
    '</div>';

  const cols = PIPELINE_STAGES.map(s => {
    const list = state.deals.filter(d => d.stage === s.id);
    const mw = list.reduce((a, d) => a + num(d.mw), 0);
    const val = list.reduce((a, d) => a + weightedValue(d), 0);
    return '<div class="kcol" data-stage="' + s.id + '" ondragover="pipeDragOver(event)" ondragleave="pipeDragLeave(event)" ondrop="pipeDrop(event)">' +
      '<div class="kcol-head"><div class="kcol-title" title="' + esc(s.hint) + '">' + esc(s.label) + '</div>' +
      '<div class="kcol-count">' + list.length + '</div></div>' +
      '<div class="kcol-value">' + fmtNum(mw) + ' MW · ' + fmtR(val) + '</div>' +
      list.map(dealCardHtml).join('') +
      (list.length ? '' : '<div class="fg-hint" style="padding:12px 4px;text-align:center">Drop here</div>') +
    '</div>';
  }).join('');

  setContent(summary + '<div class="kanban">' + cols + '</div>' +
    '<div class="fg-hint" style="margin-top:12px">Drag a card between columns to move the deal. Values assume a ' +
    Math.round(CAPACITY_FACTOR * 100) + '% capacity factor on contracted MW and are indicative only.</div>');
}

function statTile(ic, cls, label, value, sub, go) {
  return '<div class="stat-card"' + (go ? ' onclick="' + go + '"' : ' style="cursor:default"') + '>' +
    '<div class="stat-icon-box ' + cls + '">' + icon(ic, 18) + '</div>' +
    '<div class="stat-text"><div class="stat-label">' + esc(label) + '</div>' +
    '<div class="stat-value">' + value + '</div><div class="stat-sub">' + esc(sub || '') + '</div></div></div>';
}

function dealCardHtml(d) {
  const o = getOfftaker(d.offtakerId);
  const p = getProject(d.projectId);
  return '<div class="pipeline-card" draggable="true" data-id="' + d.id + '" ondragstart="pipeDragStart(event)" ondragend="pipeDragEnd(event)" onclick="openEditDeal(\'' + d.id + '\')">' +
    '<div class="pc-name">' + esc(o.short || o.name || 'Unknown offtaker') + '</div>' +
    '<div class="pc-sub">' + esc(p.town || p.name || 'No site assigned') + ' · ' + num(d.tenor) + ' yr · R' + num(d.tariff).toFixed(2) + '/kWh</div>' +
    '<div class="pc-row"><span>' + fmtNum(d.mw) + ' MW</span><span class="pc-val">' + fmtR(dealAnnualValue(d)) + '/yr</span></div>' +
    '<div class="fit-bar" style="margin-top:8px"><span data-w="' + num(d.probability) + '" style="background:var(--accent);width:' + num(d.probability) + '%"></span></div>' +
    '<div class="pc-row"><span style="font-size:9.5px;letter-spacing:.4px;text-transform:uppercase">' + num(d.probability) + '% likely</span>' +
    (d.closeDate ? '<span style="font-size:10px">' + esc(d.closeDate) + '</span>' : '') + '</div>' +
  '</div>';
}

let _dragDealId = null;
function pipeDragStart(e) {
  /* Read-only users cannot move deals; the server would refuse the write
     anyway, so stop it here rather than showing a card that snaps back. */
  if (state.role !== 'admin') { e.preventDefault(); return; }
  _dragDealId = e.currentTarget.dataset.id;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', _dragDealId); } catch (err) {}
}
function pipeDragEnd(e) { e.currentTarget.classList.remove('dragging'); }
function pipeDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drop-target'); }
function pipeDragLeave(e) { e.currentTarget.classList.remove('drop-target'); }
function pipeDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drop-target');
  const stage = e.currentTarget.dataset.stage;
  const d = state.deals.find(x => x.id === _dragDealId);
  if (!d || d.stage === stage) return;
  const from = PIPELINE_STAGES.find(s => s.id === d.stage);
  d.stage = stage;
  /* Keep probability roughly in step with the stage so the weighted number
     stays honest without the rep having to remember to update it. */
  const defaults = { identified: 10, contacted: 20, qualified: 35, proposal: 45, diligence: 60, negotiation: 75, signed: 100 };
  d.probability = defaults[stage] ?? d.probability;
  const o = getOfftaker(d.offtakerId);
  const entry = {
    id: uid('int'), offtakerId: d.offtakerId, date: todayISO(), type: 'stage change',
    summary: (o.short || 'Deal') + ' moved from ' + (from ? from.label : d.stage) + ' to ' +
      (PIPELINE_STAGES.find(s => s.id === stage) || {}).label,
  };
  state.interactions.push(entry);
  pushDeal(d);
  pushInteraction(entry);
  save();
  renderPipeline();
  toast('Moved to ' + (PIPELINE_STAGES.find(s => s.id === stage) || {}).label);
}
