/* ═══════════════════════════════════════════════════════════════════
   Pipeline
   One board, three readings of it. The page used to carry a second
   board of PPA opportunities beside the board of companies, on the
   same five stages, each with its own stat row — two pipelines on one
   tab, and the deal board showed three cards where the account board
   showed nineteen. The company is the unit of the sales process, so it
   is the card; its opportunities are numbers ON the card, and editing
   them is a button on it.

     Board     the companies being worked, on the sales path, carrying
               the MW and value of the opportunities open on each
     Flow      where those companies are, and where they stop
     Table     the same companies in stage order, one row each

   An opportunity's stage is its company's stage and the two are held
   together in core.js: dragging a company brings its opportunities
   with it, and saving an opportunity moves its company the same way.

   This is the other half of the book. Off-taker Prospects holds the
   leads — researched names nobody has picked up, carrying no stage. A
   record arrives here only when somebody presses "Work it" on it, and
   from that moment it is here and not there. inPipeline() in core.js is
   the line, and it is the same line both lists read.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

function renderPipeline() {
  /* 'board' was the deal board's key; a browser that stored it, or a
     link that still sends it, lands on the one board there is. */
  if (state.pipeView === 'board' || !['accounts', 'flow', 'table'].includes(state.pipeView)) {
    state.pipeView = 'accounts';
  }
  const open = liveDeals();
  const working = pipelineAccounts();
  setPage('Pipeline',
    working.length + ' account' + (working.length === 1 ? '' : 's') + ' being worked · ' +
    open.length + ' live opportunit' + (open.length === 1 ? 'y' : 'ies') + ' · ' +
    fmtNum(pipelineMw()) + ' MW under discussion',
    viewToggle('pipeView', [['accounts', 'Board'], ['flow', 'Flow'], ['table', 'Table']]) +
    '<button class="btn btn-outline btn-sm" onclick="exportPipeline()">' + icon('download', 14) + ' Export</button>' +
    '<button class="btn btn-primary btn-sm" data-admin-only onclick="openAddDeal()">' + icon('plus', 14) + ' New opportunity</button>');

  if (state.pipeView === 'flow') {
    setContent(pipelineStats() + flowHtml());
    growBars();
    return;
  }

  if (state.pipeView === 'table') {
    setContent(pipelineStats() + accountTableHtml() +
      '<div class="fg-hint" style="margin-top:12px">The table reads the whole pipeline in stage order, one row ' +
      'per company. Switch back to the board to move one between stages by dragging it.</div>');
    return;
  }

  setContent(stageDriftCardHtml() + pipelineStats() + accountBoardHtml() +
    '<div class="fg-hint" style="margin-top:12px">Drag a company between columns to move it along the sales ' +
    'process. Moving it writes the matching status on the record, brings its opportunities with it, and logs ' +
    'the change against the account. Values on a card assume a ' + Math.round(CAPACITY_FACTOR * 100) +
    '% capacity factor on the MW under discussion and are indicative only. ' +
    'A company appears here only once somebody has pressed <b>Work it</b> on it in Off-taker Prospects, ' +
    'and it leaves that list the moment it does — a record is a lead or an opportunity, never both.</div>');
}

/* One stat row for the one board: the companies and the money, side by
   side, rather than a row for each on separate tabs. */
function pipelineStats() {
  const accounts = pipelineAccounts();
  const open = accounts.filter(o => sfStageFor(o) !== 'closed');
  const won = accounts.filter(o => sfStageFor(o) === 'closed' && !sfIsClosedLost(o));
  const lost = accounts.filter(sfIsClosedLost);
  const live = liveDeals();
  const weighted = live.reduce((s, d) => s + weightedValue(d), 0);
  const bench = state.offtakers.length - accounts.length;
  return '<div class="stats-grid">' +
    statTile('building', 'amber', 'Accounts in process', open.length,
      fmtNum(open.reduce((a, o) => a + num(o.annualGwh), 0)) + ' GWh a year between them') +
    statTile('pipeline', 'amber', 'Open opportunities', live.length, fmtNum(pipelineMw()) + ' MW under discussion') +
    statTile('trending', 'blue', 'Weighted pipeline', fmtR(weighted), 'across contract life') +
    statTile('bolt', 'green', 'Signed', fmtNum(contractedMw()) + ' MW',
      won.length + ' closed won' + (lost.length ? ' · ' + lost.length + ' lost' : '')) +
    statTile('clock', 'amber', 'Stalled', accounts.filter(isStalled).length,
      'sitting longer than the stage allows') +
    statTile('target', 'purple', 'Leads in Prospects', bench, 'researched, not being worked', "nav('offtakers')") +
  '</div>';
}

/* ═══ FLOW ═══════════════════════════════════════════════════════
   The board shows position. This shows movement, in the order a sales
   manager asks about it: how much sits at each stage, where it stops,
   and whether anything has moved lately. */

/* How far an account has got. For anything still open that is simply where
   it stands. A closed account is the awkward case: it sits at Closed while
   having actually fallen out somewhere earlier, so it is left out of the
   carry-through entirely rather than being counted as having reached every
   stage on the way. Which stage it died at is not recorded anywhere. */
function reachedCounts(accounts) {
  const live = accounts.filter(o => sfStageFor(o) !== 'closed' || !sfIsClosedLost(o));
  return SF_STAGES.map((st, i) => live.filter(o => sfStageIndex(sfStageFor(o)) >= i).length);
}

function medianOf(values) {
  if (!values.length) return null;
  const s = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/* A stage move is logged as a sentence of our own making, so the direction
   is read back by matching the stage names it quotes. Anything that does
   not parse still counts as a move — it just gets no direction, which is
   better than inventing one.

   The move is the FIRST sentence; a knock-on ("the account moved with it")
   can follow it, so the destination is read up to the full stop rather
   than to the end of the string. Entries written under the older seven
   stages name stages that no longer exist, and LEGACY_STAGE_LABELS reads
   those onto the five so the history keeps its direction. */
function stageMoveDirection(summary) {
  const m = /from (.+?) to ([^.]+?)\s*(?:\.|$)/.exec(String(summary || ''));
  if (!m) return 0;
  const idx = label => {
    const t = String(label).trim().replace(/\s+(won|lost)$/i, '').toLowerCase();
    const hit = SF_STAGES.findIndex(s => s.label.toLowerCase() === t);
    return hit >= 0 ? hit : sfStageIndex(LEGACY_STAGE_LABELS[t] || '');
  };
  const a = idx(m[1]), b = idx(m[2]);
  if (a < 0 || b < 0) return 0;
  return b > a ? 1 : b < a ? -1 : 0;
}

function flowHtml() {
  const accounts = pipelineAccounts();
  if (!accounts.length) {
    return '<div class="empty"><div class="ei">' + icon('trending', 30) + '</div>' +
      '<h3>Nothing in the pipeline yet</h3>' +
      '<p>Open a lead in Off-taker Prospects and press <b>Work it</b>. Once it is here it gets the ' +
      'sales stages, and this page starts reading how it moves through them.</p>' +
      '<button class="btn btn-primary btn-sm" onclick="nav(\'offtakers\')">Browse the leads</button></div>';
  }

  const reached = reachedCounts(accounts);
  const maxReached = Math.max(1, ...reached);

  /* ── Stage flow: the funnel and the step-through between stages ── */
  const rows = SF_STAGES.map((st, i) => {
    const here = accounts.filter(o => sfStageFor(o) === st.id);
    const gwh = here.reduce((a, o) => a + num(o.annualGwh), 0);
    const bar =
      /* Opens the board, where this stage is a column. It used to open
         the company list narrowed to the stage; that list holds leads
         now, and a lead has no stage to be narrowed by. */
      '<div class="bar-row with-count clickable" title="' + esc(st.hint) +
        (gwh ? ' — ' + fmtNum(gwh) + ' GWh a year at this stage. ' : '. ') + 'Open the board" ' +
      'onclick="setViewMode(&#39;pipeView&#39;,&#39;accounts&#39;)">' +
      '<div class="bar-label">' + esc(st.label) + '</div>' +
      '<div class="bar-track"><span class="bar-fill" data-w="' + ((reached[i] / maxReached) * 100) + '" ' +
      'style="background:linear-gradient(90deg,var(--accent),var(--accent2))"></span></div>' +
      '<div class="bar-sub">' + (here.length || '') + '</div>' +
      '<div class="bar-num">' + reached[i] + '</div></div>';

    /* The carry-through to the next stage — the actual flow figure. */
    if (i === SF_STAGES.length - 1) return bar;
    const on = reached[i + 1];
    const pct = reached[i] ? Math.round((on / reached[i]) * 100) : 0;
    const note = !reached[i]
      ? 'nothing has reached this stage'
      : on + ' of ' + reached[i] + ' went on to ' + SF_STAGES[i + 1].label + ' · ' + pct + '%';
    return bar + '<div class="flow-step' + (reached[i] && pct < 50 ? ' drop' : '') + '">' +
      '<span></span><span>↓ ' + esc(note) + '</span></div>';
  }).join('');

  const closed = accounts.filter(o => sfStageFor(o) === 'closed');
  const won = closed.filter(o => !sfIsClosedLost(o)).length;
  const lost = closed.length - won;
  const flowCard =
    '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">Stage flow</div>' +
      '<div class="card-sub">How far accounts have got, and how many carried on to the next stage</div></div>' +
      '<button class="btn btn-ghost btn-xs" onclick="setViewMode(\'pipeView\',\'accounts\')">Open board</button></div>' +
      '<div class="funnel-head"><span>Accounts</span><span>here</span><span>reached</span></div>' +
      rows +
      '<div class="fg-hint" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">' +
      'Reached counts an account as having got to a stage if it stands at or past it today. ' +
      (lost
        ? lost + ' closed-lost account' + (lost === 1 ? ' is' : 's are') + ' left out of it — where a deal ' +
          'died is not recorded, so counting them would overstate every stage they never saw. '
        : '') +
      (closed.length ? won + ' won, ' + lost + ' lost.' : 'Nothing has closed yet.') +
      '</div>' +
    '</div>';

  /* ── Where it stops ───────────────────────────────────────────── */
  const stallRows = SF_STAGES.filter(st => st.id !== 'closed').map(st => {
    const here = accounts.filter(o => sfStageFor(o) === st.id);
    const days = here.map(o => (stageDwell(o) || {}).days).filter(d => Number.isFinite(d));
    const med = medianOf(days);
    const stuck = here.filter(isStalled).length;
    const budget = st.stallDays;
    const pct = med && budget ? Math.min(100, (med / budget) * 100) : 0;
    return '<div class="bar-row with-count" title="' +
      esc(st.label + ' is given ' + budget + ' days before silence starts to mean something') + '">' +
      '<div class="bar-label">' + esc(st.label) + '</div>' +
      '<div class="bar-track"><span class="bar-fill" data-w="' + pct + '" style="background:' +
      (pct >= 100 ? 'var(--danger)' : pct >= 70 ? 'var(--accent2)' : 'var(--accent)') + '"></span></div>' +
      '<div class="bar-sub' + (stuck ? ' warn' : '') + '">' + (stuck || '') + '</div>' +
      '<div class="bar-num">' + (med === null ? '—' : med + 'd') + '</div></div>';
  }).join('');

  const stallCard =
    '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">Where it stops</div>' +
      '<div class="card-sub">Median days sitting at each stage, against what that stage is given</div></div>' +
      '<button class="btn btn-ghost btn-xs" title="Show only the accounts sitting longer than their stage allows" onclick="state.pipeStalled=&#39;stalled&#39;;setViewMode(&#39;pipeView&#39;,&#39;accounts&#39;)">Stalled only</button></div>' +
      '<div class="funnel-head"><span>Stage</span><span>stalled</span><span>median</span></div>' +
      stallRows +
      '<div class="fg-hint" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">' +
      'Nothing records when an account entered its stage, so the number falls back to the last thing ' +
      'logged against it and then to when the row itself changed. Each account carries which of the ' +
      'three it used — hover the chip on its card. The budgets are not deadlines: a PPA runs a 9 to 18 ' +
      'month cycle, so they mark where silence starts to mean something.</div>' +
    '</div>';

  /* ── Movement ─────────────────────────────────────────────────── */
  const ids = new Set(accounts.map(o => o.id));
  const moves = state.interactions.filter(i =>
    i.type === 'stage change' && ids.has(i.offtakerId) && (daysSince(i.date) ?? 999) <= 90);
  const movedIds = new Set(moves.map(i => i.offtakerId));
  const forward = moves.filter(i => stageMoveDirection(i.summary) > 0).length;
  const back = moves.filter(i => stageMoveDirection(i.summary) < 0).length;
  const touched = accounts.filter(o => {
    const d = stageDwell(o);
    return d && d.basis !== 'record' && d.days <= 90;
  }).length;

  const moveCard =
    '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">Movement, last 90 days</div>' +
      '<div class="card-sub">Whether the pipeline is moving, or just sitting there looking full</div></div>' +
      '<button class="btn btn-ghost btn-xs" onclick="nav(\'activity\')">Full log</button></div>' +
      '<div class="stats-grid" style="margin:0">' +
        statTile('trending', 'green', 'Moved forward', forward, 'stage changes up the path') +
        statTile('alert', 'amber', 'Moved back', back, back ? 'reopened or re-qualified' : 'nothing went backwards') +
        statTile('building', 'blue', 'Accounts that moved', movedIds.size,
          'of ' + accounts.length + ' in the pipeline') +
        statTile('note', 'purple', 'Touched at all', touched, 'had something logged against them') +
      '</div>' +
      '<div class="fg-hint" style="margin-top:10px">' +
      (accounts.length - movedIds.size) + ' account' + (accounts.length - movedIds.size === 1 ? ' has' : 's have') +
      ' not changed stage in 90 days. That is normal for a long cycle and worrying for a short one — ' +
      'read it next to the stage budgets above.</div>' +
    '</div>';

  return flowCard + '<div class="grid-2" style="margin-top:14px">' + stallCard + moveCard + '</div>';
}

/* ═══ THE TABLE ═════════════════════════════════════════════════
   The same companies as the board, in stage order and then by load —
   the reading a manager wants when the question is "what is actually
   in there". Each row carries what its opportunities add up to. */
function pipelineOrdered() {
  return pipelineAccounts().slice().sort((a, b) =>
    sfStageIndex(sfStageFor(a)) - sfStageIndex(sfStageFor(b)) || num(b.annualGwh) - num(a.annualGwh));
}

function accountTableHtml() {
  const list = pipelineOrdered();
  if (!list.length) return accountBoardHtml();

  return '<div class="table-wrap"><table><thead><tr>' +
    '<th>Account</th><th>Sector</th><th>Stage</th><th class="num">GWh/yr</th>' +
    '<th class="num">Open MW</th><th class="num">Weighted</th><th class="num">Fit</th><th>In stage</th><th>Actions</th>' +
    '</tr></thead><tbody>' +
    list.map(o => {
      const deals = dealsFor(o.id);
      const open = deals.filter(isLiveDeal);
      const mw = open.reduce((a, d) => a + num(d.mw), 0);
      const weighted = open.reduce((a, d) => a + weightedValue(d), 0);
      return '<tr>' +
        '<td><span class="ext-link" style="cursor:pointer" onclick="nav(' + jsStr(accountView(o.id)) +
          ',{id:' + jsStr(o.id) + '})">' + esc(o.short || o.name) + '</span></td>' +
        '<td>' + esc(sectorName(o.sector)) + '</td>' +
        '<td>' + sfStageBadge(o) + '</td>' +
        '<td class="num">' + (isUnworked(o) ? '<span style="color:var(--muted)">—</span>' : fmtNum(o.annualGwh)) + '</td>' +
        '<td class="num">' + (open.length ? fmtNum(mw) : '<span style="color:var(--muted)">—</span>') + '</td>' +
        '<td class="num" style="font-weight:800">' + (open.length ? fmtR(weighted) : '<span style="color:var(--muted)">—</span>') + '</td>' +
        '<td class="num">' + (isUnworked(o) ? '<span style="color:var(--muted)">—</span>' : fitScore(o)) + '</td>' +
        '<td>' + (sfStageFor(o) === 'closed'
          ? '<span style="font-size:11px">' + esc(STATUS_LABEL[o.status] || o.status) + '</span>'
          : dwellChipHtml(o)) + '</td>' +
        '<td style="white-space:nowrap">' + opportunityButtonsHtml(o, deals, true) + '</td>' +
      '</tr>';
    }).join('') + '</tbody></table></div>';
}

/* ═══ THE BOARD ═════════════════════════════════════════════════ */
/* A company sitting at a different stage from its own opportunities.
   Nothing in the app can produce this any more, so when it shows up the
   data came from somewhere else and the board has been quietly lying
   about where an account is. Named rather than corrected: taking the
   move is a decision, and the button only ever offers the stage the
   opportunities already imply. */
function stageDriftCardHtml() {
  const drift = stageMismatches();
  if (!drift.length) return '';

  return '<div class="card" style="margin-bottom:14px;border-left:3px solid var(--warn)">' +
    '<div class="card-header"><div>' +
      '<div class="card-title">' + icon('alert', 13) + ' ' +
        (drift.length === 1 ? 'One account is' : drift.length + ' accounts are') +
        ' out of step with their opportunities</div>' +
      '<div class="card-sub">The sales path on the company page says one thing and its opportunities ' +
        'another. Nothing inside the CRM writes them apart, so this came in from an import or a ' +
        'direct edit. Moving an account here sets it to the stage its opportunities are already at.' +
      '</div></div></div>' +
    drift.map(d =>
      '<div class="person-row">' +
        '<div style="min-width:0;flex:1;cursor:pointer" onclick="nav(' + jsStr(accountView(d.rec.id)) +
          ',{id:' + jsStr(d.rec.id) + '})">' +
          '<div class="person-name">' + esc(d.rec.short || d.rec.name) + '</div>' +
          '<div class="person-title">Company page says <b>' +
            esc((sfStageOf(d.current) || {}).label || d.current) + '</b> · ' +
            'opportunities are at <b>' + esc((sfStageOf(d.fromDeals) || {}).label || d.fromDeals) + '</b>' +
            (d.behind ? '' : ' — the account is ahead of them') +
          '</div>' +
        '</div>' +
        '<button class="btn btn-xs btn-outline" data-admin-only ' +
          'title="Set the account to the stage its opportunities are at" ' +
          'onclick="reconcileAccountStage(' + jsStr(d.rec.id) + ')">Move to ' +
          esc((sfStageOf(d.fromDeals) || {}).label || d.fromDeals) + '</button>' +
      '</div>').join('') +
  '</div>';
}

function accountBoardHtml() {
  const accounts = pipelineAccounts();
  if (!accounts.length) {
    return '<div class="empty"><div class="ei">' + icon('target', 30) + '</div>' +
      '<h3>Nothing is being worked yet</h3>' +
      '<p>Off-taker Prospects is a list of leads — a name on it is not a sales process. ' +
      'Open one and press <b>Work it</b>: it moves out of Prospects, lands here as an ' +
      'opportunity and picks up the sales stages.</p>' +
      '<button class="btn btn-primary btn-sm" onclick="nav(\'offtakers\')">Browse the leads</button></div>';
  }
  /* Narrowing set by "Stalled only" on the Flow page. It is a filter on
     the board rather than a list of its own, so the stage columns stay
     put and the answer reads as "where the stuck ones are" rather than as
     a flat roll-call with no positions on it. */
  const shown = state.pipeStalled === 'stalled' ? accounts.filter(isStalled) : accounts;
  const filterBar = state.pipeStalled === 'stalled'
    ? '<div class="toolbar"><span class="result-count">Stalled only — ' + shown.length +
      ' of ' + accounts.length + ' account' + (accounts.length === 1 ? '' : 's') + '</span>' +
      '<button class="btn btn-outline btn-sm" onclick="state.pipeStalled=&#39;&#39;;renderPipeline()">' +
      'Show all</button></div>'
    : '';
  const cols = SF_STAGES.map(st => {
    const list = shown.filter(o => sfStageFor(o) === st.id)
      .sort((a, b) => fitScore(b) - fitScore(a));
    const gwh = list.reduce((a, o) => a + num(o.annualGwh), 0);
    const open = list.flatMap(o => dealsFor(o.id).filter(isLiveDeal));
    const mw = open.reduce((a, d) => a + num(d.mw), 0);
    const stuck = list.filter(isStalled).length;
    return '<div class="kcol" data-sfstage="' + st.id + '" ondragover="pipeDragOver(event)" ' +
      'ondragleave="pipeDragLeave(event)" ondrop="sfDrop(event)">' +
      '<div class="kcol-head"><div class="kcol-title" title="' + esc(st.hint) + '">' + esc(st.label) + '</div>' +
      '<div class="kcol-count">' + list.length + '</div></div>' +
      '<div class="kcol-value">' + fmtNum(gwh) + ' GWh a year' +
        (mw ? ' · ' + fmtNum(mw) + ' MW open' : '') +
        (stuck ? ' <span style="color:var(--warn)">· ' + stuck + ' stalled</span>' : '') + '</div>' +
      list.map(accountCardHtml).join('') +
      (list.length ? '' : '<div class="fg-hint" style="padding:12px 4px;text-align:center">Drop here</div>') +
    '</div>';
  }).join('');
  return filterBar + '<div class="kanban">' + cols + '</div>';
}

/* The small buttons on a card or row. Editing an opportunity's own
   numbers is the rarer job, so it is a button rather than the whole
   card; with more than one open the company page lists them. Taking
   a company off the board goes back to Off-taker Prospects.

   On a card the buttons are the hover-revealed pc-edit kind. A table
   row has no hover rule to reveal them, so there they are ordinary
   small buttons — otherwise the Actions column is simply blank. */
function opportunityButtonsHtml(o, deals, inTable) {
  const one = deals.length === 1 ? deals[0] : null;
  const cls = inTable ? 'btn btn-xs btn-outline' : 'pc-edit';
  return (one
    ? '<button class="' + cls + '" data-admin-only title="Edit this opportunity" ' +
      'onclick="event.stopPropagation();openEditDeal(&#39;' + one.id + '&#39;)">' + icon('edit', 11) + '</button>' +
      (inTable ? ' ' : '')
    : '') +
    '<button class="' + cls + (inTable ? '' : ' pc-remove') + '" data-admin-only ' +
      'title="Take ' + esc(o.short || o.name) + ' off the board and back to Off-taker Prospects" ' +
      'onclick="event.stopPropagation();removeFromPipeline(' + jsStr(o.id) + ')">' + icon('logout', 11) + '</button>';
}

/* Clicking a card opens the company, not a deal form. The question a
   rep has in front of the board is "where is this one and what do I do
   next", and that is answered on the profile — which is why the sales
   path is the first thing on it. */
function accountCardHtml(o) {
  const deals = dealsFor(o.id);
  const open = deals.filter(isLiveDeal);
  const signed = deals.filter(d => d.stage === 'closed');
  const mw = open.reduce((a, d) => a + num(d.mw), 0);
  const annual = open.reduce((a, d) => a + dealAnnualValue(d), 0);
  const fit = fitScore(o);
  const money = open.length
    ? fmtNum(mw) + ' MW open · ' + fmtR(annual) + '/yr'
    : signed.length
      ? fmtNum(signed.reduce((a, d) => a + num(d.mw), 0)) + ' MW signed'
      : 'no opportunity';
  return '<div class="pipeline-card" draggable="true" data-id="' + esc(o.id) + '" ' +
    'ondragstart="sfDragStart(event)" ondragend="pipeDragEnd(event)" ' +
    'onclick="nav(' + jsStr(accountView(o.id)) + ',{id:' + jsStr(o.id) + '})">' +
    '<div class="pc-name">' + esc(o.short || o.name) + opportunityButtonsHtml(o, deals) + '</div>' +
    '<div class="pc-sub">' + esc(sectorName(o.sector)) + (o.city ? ' · ' + esc(o.city) : '') + '</div>' +
    /* An account can be worked before anybody has established its load, so
       say so rather than showing a confident nought. */
    '<div class="pc-row"><span>' + (isUnworked(o) ? 'load not established' : fmtNum(o.annualGwh) + ' GWh/yr') + '</span>' +
      '<span class="pc-val">' + money + '</span></div>' +
    (isUnworked(o) ? '' :
      '<div class="fit-bar" style="margin-top:8px"><span style="background:' + fitColor(fit) + ';width:' + fit + '%"></span></div>') +
    '<div class="pc-row"><span style="font-size:9.5px;letter-spacing:.4px;text-transform:uppercase">' +
      (isUnworked(o) ? 'not scored' : 'fit ' + fit + '/100') +
      (open.length ? ' · ' + Math.round(open.reduce((a, d) => a + num(d.probability), 0) / open.length) + '% likely' : '') +
      '</span>' +
      /* A closed account cannot stall and its dwell says nothing useful;
         which way it closed does. */
      (sfStageFor(o) === 'closed'
        ? '<span style="font-size:10px">' + esc(STATUS_LABEL[o.status] || o.status) + '</span>'
        : dwellChipHtml(o)) + '</div>' +
  '</div>';
}

let _dragAccountId = null;
function sfDragStart(e) {
  /* Read-only users cannot move accounts; the server would refuse the
     write anyway, so stop it here rather than showing a card that snaps
     back. */
  if (state.role !== 'admin') { e.preventDefault(); return; }
  _dragAccountId = e.currentTarget.dataset.id;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', _dragAccountId); } catch (err) {}
}
function sfDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drop-target');
  const stage = e.currentTarget.dataset.sfstage;
  if (!_dragAccountId || !stage) return;
  setSfStage(_dragAccountId, stage);
}
function pipeDragEnd(e) { e.currentTarget.classList.remove('dragging'); }
function pipeDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drop-target'); }
function pipeDragLeave(e) { e.currentTarget.classList.remove('drop-target'); }
