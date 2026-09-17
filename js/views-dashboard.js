/* ═══════════════════════════════════════════════════════════════════
   Dashboard
   One question for a sales rep opening the app in the morning: who do I
   call today, and why. The pipeline itself lives in views-pipeline.js.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

function portfolioMw() { return state.projects.filter(p => p.status !== 'pipeline').reduce((s, p) => s + num(p.mw), 0); }
function contractedMw() { return state.deals.filter(d => d.stage === 'signed').reduce((s, d) => s + num(d.mw), 0); }

/* A deal is live until it is signed or lost. 'lost' has no column on the
   board, so without excluding it here a closed opportunity would keep
   inflating the open pipeline for ever. */
function isLiveDeal(d) { return d.stage !== 'signed' && d.stage !== 'lost'; }
function liveDeals() { return state.deals.filter(isLiveDeal); }
function lostDeals() { return state.deals.filter(d => d.stage === 'lost'); }
function pipelineMw() { return liveDeals().reduce((s, d) => s + num(d.mw), 0); }

function renderDashboard() {
  setPage('Dashboard', 'Offtaker pipeline for African Earth Energy',
    '<button class="btn btn-outline btn-sm" onclick="nav(\'calculator\')">' + icon('calc', 14) + ' Savings calculator</button>' +
    '<button class="btn btn-primary btn-sm" data-admin-only onclick="openAddOfftaker()">' + icon('plus', 14) + ' Add offtaker</button>');

  const offtakers = state.offtakers;
  const openDeals = liveDeals();
  const weighted = openDeals.reduce((s, d) => s + weightedValue(d), 0);
  const available = portfolioMw() - contractedMw();
  const hot = offtakers.map(o => ({ o, f: fitScore(o) })).sort((a, b) => b.f - a.f);

  /* ── Stat row ───────────────────────────────────────────────── */
  const stats = [
    { icon: 'building', cls: 'green', label: 'Companies tracked', value: offtakers.length,
      sub: offtakers.filter(o => !inPipeline(o)).length + ' not being worked yet', go: "nav('offtakers')" },
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
            (np ? esc(np.project.town) + ' ' + distanceLabel(np) : 'no nearby site') +
            (c ? ' · ' + esc(c.title) : '') + '</div>' +
          '</div>' +
          '<div class="person-actions"><span class="badge b-' + o.status + '">' + (STATUS_LABEL[o.status] || o.status) + '</span></div>' +
        '</div>';
      }).join('') : '<div class="empty"><h3>Nothing queued</h3><p>Add an offtaker to start building a call list.</p></div>') +
    '</div>';

  /* ── Stage funnel ───────────────────────────────────────────── */
  /* Two funnels, because the pipeline has two shapes and reading either one
     alone misleads. Accounts answer "how many companies are we in a process
     with"; MW answers "how much of the portfolio is spoken for". A single
     300 MW deal makes the MW funnel look healthy while the account funnel
     shows the truth, and counting accounts alone hides that one of them is
     worth ten of the others. */
  const working = pipelineAccounts();
  const byAccountStage = SF_STAGES.map(st => {
    const list = working.filter(o => sfStageFor(o) === st.id);
    return { ...st, count: list.length, stalled: list.filter(isStalled).length };
  });
  const maxAccounts = Math.max(1, ...byAccountStage.map(x => x.count));
  const stalledCount = byAccountStage.reduce((a, x) => a + x.stalled, 0);

  const byStage = PIPELINE_STAGES.map(s => {
    const list = state.deals.filter(d => d.stage === s.id);
    return { ...s, count: list.length, mw: list.reduce((a, d) => a + num(d.mw), 0) };
  });
  const maxMw = Math.max(1, ...byStage.map(s => s.mw));
  const funnelHtml =
    '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">Pipeline by stage</div>' +
      '<div class="card-sub">' + working.length + ' account' + (working.length === 1 ? '' : 's') + ' being worked, capacity through the deal stages</div></div>' +
      '<button class="btn btn-ghost btn-xs" onclick="nav(\'pipeline\')">Open board</button></div>' +

      '<div class="funnel-head"><span>Accounts</span><span>stalled</span><span>total</span></div>' +
      byAccountStage.map(st =>
        /* Clicking a stage opens the list already narrowed to it, which is
           the next thing anybody wants after reading the number. */
        '<div class="bar-row with-count clickable" title="' + esc(st.hint) + '" ' +
        'onclick="state.offStage=' + jsStr(st.id) + ';state.offStalled=\'\';state.offPage=1;nav(\'offtakers\')">' +
        '<div class="bar-label">' + esc(st.label) + '</div>' +
        '<div class="bar-track"><span class="bar-fill" data-w="' + ((st.count / maxAccounts) * 100) + '" ' +
        'style="background:linear-gradient(90deg,var(--accent),var(--accent2))"></span></div>' +
        '<div class="bar-sub' + (st.stalled ? ' warn' : '') + '">' + (st.stalled || '') + '</div>' +
        '<div class="bar-num">' + st.count + '</div></div>').join('') +

      '<div class="funnel-head" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">' +
        '<span>Opportunities</span><span>deals</span><span>MW</span></div>' +
      byStage.map(s =>
        '<div class="bar-row with-count"><div class="bar-label" title="' + esc(s.hint) + '">' + esc(s.label) + '</div>' +
        '<div class="bar-track"><span class="bar-fill" data-w="' + ((s.mw / maxMw) * 100) + '" ' +
        'style="background:linear-gradient(90deg,var(--accent),var(--accent2))"></span></div>' +
        '<div class="bar-sub">' + (s.count || '') + '</div>' +
        '<div class="bar-num">' + fmtNum(s.mw) + '</div></div>').join('') +

      '<div class="fg-hint" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">' +
      stalledCount + ' account' + (stalledCount === 1 ? ' has' : 's have') +
      ' sat longer than the stage allows. ' + fmtNum(contractedMw()) + ' MW signed to date. ' +
      'The other ' + (state.offtakers.length - working.length) + ' companies are research, not pipeline.</div>' +
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
        '<div class="bar-row"><div class="bar-label">' + esc(sectorName(k)) + '</div>' +
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

function statTile(ic, cls, label, value, sub, go) {
  return '<div class="stat-card"' + (go ? ' onclick="' + go + '"' : ' style="cursor:default"') + '>' +
    '<div class="stat-icon-box ' + cls + '">' + icon(ic, 18) + '</div>' +
    '<div class="stat-text"><div class="stat-label">' + esc(label) + '</div>' +
    '<div class="stat-value">' + value + '</div><div class="stat-sub">' + esc(sub || '') + '</div></div></div>';
}
