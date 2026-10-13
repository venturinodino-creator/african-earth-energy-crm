/* ═══════════════════════════════════════════════════════════════════
   Pipeline
   One board, three readings of it. The page used to carry a second
   board of PPA opportunities beside the board of companies, on the
   same seven stages, each with its own stat row — two pipelines on one
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
  /* List is the pipeline's front page: one row per opportunity, the stage as
     a label, and a click opens the full opportunity (js/views-opportunity.js).
     The Board, with a column per stage, is the second reading. 'table' was
     the list's old key, and 'board' the old deal board's; both land on the
     reading that replaced them. */
  if (state.pipeView === 'table' || !['list', 'accounts', 'flow'].includes(state.pipeView)) {
    state.pipeView = 'list';
  }
  /* The pipeline follows the province scope: its accounts, and the opportunities open on them. */
  const open = liveDeals(scopedDeals());
  const working = pipelineAccounts();
  /* A ticked account belongs to what is showing now: another reading, the stalled filter or province drops it. */
  selectionSync('pipeline', JSON.stringify([state.pipeView, pipeFilterId(), state.pipeQuery || '', state.province]));
  _pipeInfo = new Map();
  setPage('Pipeline',
    working.length + ' account' + (working.length === 1 ? '' : 's') + ' being worked · ' +
    open.length + ' live opportunit' + (open.length === 1 ? 'y' : 'ies') + ' · ' +
    fmtNum(pipelineMw(scopedDeals())) + ' MW under discussion',
    exportButtonHtml('exportPipeline(scopedDeals())', scopedDeals().length) +
    '<button class="btn btn-primary btn-sm" data-admin-only onclick="openAddDeal()">' + icon('plus', 14) + ' New opportunity</button>');

  /* The three readings of the one pipeline are tabs, the way Priority list and
     Archive are on Off-taker Prospects. */
  const readingTab = (key, label) => ({ label, active: state.pipeView === key, on: "setViewMode('pipeView','" + key + "')" });
  const tabs = viewTabsHtml([readingTab('list', 'List'), readingTab('accounts', 'Board'), readingTab('flow', 'Flow')]);

  if (state.pipeView === 'flow') {
    setContent(tabs + pipelineStats() + flowHtml());
    growBars();
    return;
  }

  if (state.pipeView === 'list') {
    setContent(tabs + stageDriftCardHtml() + pipelineStats() + pipeFilterBarHtml() + selectionSlotHtml('pipeline') + accountTableHtml() +
      '<div class="fg-hint" style="margin-top:12px">One row per opportunity, like Salesforce\'s opportunity list. ' +
      'The small bar under each stage is the seven steps of the sales path. Click Opportunity, Stage, In stage or ' +
      'Open MW to sort, and click a name to open the full opportunity. Export selected downloads the opportunities ' +
      'open on the accounts you tick.</div>');
    selectionRefresh();
    return;
  }

  setContent(tabs + stageDriftCardHtml() + pipelineStats() + pipeFilterBarHtml() + accountBoardHtml() +
    '<div class="fg-hint" style="margin-top:12px">Drag a company between columns to move it along the sales ' +
    'process. Moving it writes the matching status on the record, brings its opportunities with it, and logs ' +
    'the change against the account. Values on a card assume a ' + Math.round(CAPACITY_FACTOR * 100) +
    '% capacity factor on the MW under discussion and are indicative only. ' +
    'A company appears here only once somebody has pressed <b>Work it</b> on it in Off-taker Prospects, ' +
    'and it leaves that list the moment it does — a record is a lead or an opportunity, never both. ' +
    'The bar on each card is the seven ladder seats: green engaging, gold replied, blue contacted, red gone ' +
    'cold or declined, dashed nobody on file. Click a card to open the full opportunity.</div>');
}

/* ═══ OUTREACH ON THE PIPELINE ═══════════════════════════════════
   What the board, the table and the account panel read about each
   account's people and touches. Worked out once per render (_pipeInfo is
   reset at the top of renderPipeline) because the filter counts, the cards
   and the panel all ask the same questions of the same account. The rules
   themselves are in js/outreach.js; the ladder is the org map's. */
let _pipeInfo = new Map();
function pipeInfo(o) {
  if (_pipeInfo.has(o.id)) return _pipeInfo.get(o.id);
  const today = todayISO();
  const logs = scopedInteractions().filter(i => i.offtakerId === o.id);
  const people = contactsFor(o.id);
  const chases = outreachFollowUps(logs, [o], people).sort((a, b) => a.date.localeCompare(b.date));
  const due = chases.filter(c => c.date <= today);
  const info = {
    logs, people, chases, due,
    duePeople: due.reduce((n, c) => n + Math.max(1, (c.people || []).length), 0),
    seats: seatCoverage(people, logs, today, AE_LADDER, aeSeatMatch),
    reach: reachSummary(people, logs, today),
    last: lastTouchEntry(logs),
    moved: recentForwardMove(logs, today, 7, stageMoveDirection),
  };
  _pipeInfo.set(o.id, info);
  return info;
}

/* The quick filters above the board and the table, the way a Salesforce
   list view is picked. "Stalled" is the one the Flow page's Stalled only
   button also sets. */
const PIPE_FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'chase', label: 'Chase due', test: o => pipeInfo(o).due.length > 0 },
  { id: 'nomeet', label: 'No meeting yet', test: o => sfStageFor(o) === 'outreach' },
  { id: 'stalled', label: 'Stalled', test: o => isStalled(o) },
  { id: 'moved', label: 'Moved this week', test: o => !!pipeInfo(o).moved },
  { id: 'late', label: 'Late stage', test: o => sfStageIndex(sfStageFor(o)) >= sfStageIndex('proposal') && sfStageFor(o) !== 'closed' },
];
function pipeFilterId() {
  if (state.pipeStalled === 'stalled') return 'stalled';
  return PIPE_FILTERS.some(f => f.id === state.pipeFilter) ? state.pipeFilter : 'all';
}
function setPipeFilter(id) { state.pipeFilter = id; state.pipeStalled = ''; renderPipeline(); }
function setPipeQuery(q) { state.pipeQuery = String(q || '').trim(); renderPipeline(); }
function pipeMatchesQuery(o) {
  const q = String(state.pipeQuery || '').toLowerCase();
  if (!q) return true;
  const hay = [o.name, o.short, o.city, sectorName(o.sector)].concat(
    contactsFor(o.id).map(c => c.first + ' ' + c.last + ' ' + (c.title || ''))).join(' ').toLowerCase();
  return hay.includes(q);
}
/* The accounts the board and the table draw: the pipeline, through the
   chosen quick filter and the search. */
function pipeShown(accounts) {
  const f = PIPE_FILTERS.find(x => x.id === pipeFilterId());
  return accounts.filter(o => f.test(o) && pipeMatchesQuery(o));
}
function pipeFilterBarHtml() {
  const accounts = pipelineAccounts();
  if (!accounts.length) return '';
  const on = pipeFilterId();
  return '<div class="pf-bar">' +
    PIPE_FILTERS.map(f => {
      const n = accounts.filter(o => f.test(o) && pipeMatchesQuery(o)).length;
      return '<button type="button" class="pf-chip' + (f.id === on ? ' on' : '') + '" aria-pressed="' + (f.id === on) + '" ' +
        'onclick="setPipeFilter(' + jsStr(f.id) + ')">' + esc(f.label) + ' <span class="pf-n">' + n + '</span></button>';
    }).join('') +
    '<label class="pf-search">' + icon('search', 13) +
      '<input type="search" id="pipe-search" aria-label="Search accounts or people" placeholder="Search accounts or people, then Enter" ' +
      'value="' + esc(state.pipeQuery || '') + '" onchange="setPipeQuery(this.value)"></label>' +
  '</div>';
}

/* Seven small bars, one per ladder seat, coloured by the strongest
   engagement among the people who fill it. */
function seatBarHtml(info) {
  return '<div class="pc-seats" title="' + esc(info.seats.map(s => s.label + ': ' +
      (s.state === 'gap' ? 'nobody on file' : ENGAGEMENT_LABEL[s.state])).join(' · ')) + '">' +
    info.seats.map(s => '<span class="pc-seat s-' + s.state + '"></span>').join('') + '</div>';
}
function reachText(info) {
  return info.reach.total
    ? info.reach.reached + ' of ' + info.reach.total + ' reached · ' + info.reach.engaging.length + ' engaging'
    : 'Nobody on file yet';
}
function lastTouchText(info) {
  if (!info.last) return 'Nothing logged yet';
  const c = outreachChannel(channelOfEntry(info.last));
  const out = outreachOutcome(info.last.outcome);
  return (c ? c.label : (info.last.type || 'Note')) + (out && out.id !== 'sent' ? ' · ' + out.label.toLowerCase() : '') +
    ' · ' + relTime(info.last.date);
}
/* "Chase Jan · today", "Chase 3 people · overdue", or the next one coming
   up. Red when something is due, amber when it is only on its way. */
function chasePillHtml(info) {
  if (!info.chases.length) return '';
  const today = todayISO();
  const list = info.due.length ? info.due : [info.chases[0]];
  const names = [];
  list.forEach(c => (c.people || []).forEach(id => {
    const p = info.people.find(x => x.id === id);
    if (p && !names.includes(p.first)) names.push(p.first);
  }));
  const first = list[0];
  const when = first.date < today ? 'overdue' : first.date === today ? 'today' : fuDate(first.date);
  const who = names.length > 2 ? names.length + ' people' : names.join(' & ') || 'follow-up';
  return '<span class="pc-chase' + (info.due.length ? ' due' : '') + '">Chase ' + esc(who) + ' · ' + esc(when) + '</span>';
}
function movedPillHtml(info) {
  if (!info.moved) return '';
  const m = /from (.+?) to /.exec(info.moved.summary || '');
  return '<span class="pc-moved">↑ ' + esc(m ? 'from ' + m[1] : 'moved') + '</span>';
}

/* Clicking an opportunity, on the list or the board, opens its full page. */
function openOpportunity(id) { nav('opportunity', { id }); }

/* One stat row for the one board: the companies and the money, side by
   side, rather than a row for each on separate tabs. */
function pipelineStats() {
  const accounts = pipelineAccounts();
  const open = accounts.filter(o => sfStageFor(o) !== 'closed');
  const won = accounts.filter(o => sfStageFor(o) === 'closed' && !sfIsClosedLost(o));
  const lost = accounts.filter(sfIsClosedLost);
  const live = liveDeals(scopedDeals());
  const weighted = live.reduce((s, d) => s + weightedValue(d), 0);
  const bench = scopedOfftakers().length - accounts.length;
  return '<div class="stats-grid">' +
    statTile('building', 'amber', 'Accounts in process', open.length,
      fmtNum(open.reduce((a, o) => a + num(o.annualGwh), 0)) + ' GWh a year between them') +
    statTile('pipeline', 'amber', 'Open opportunities', live.length, fmtNum(pipelineMw(scopedDeals())) + ' MW under discussion') +
    statTile('trending', 'blue', 'Weighted pipeline', fmtR(weighted), 'across contract life') +
    statTile('bolt', 'green', 'Signed', fmtNum(contractedMw(scopedDeals())) + ' MW',
      won.length + ' closed won' + (lost.length ? ' · ' + lost.length + ' lost' : '')) +
    statTile('clock', 'amber', 'Stalled', accounts.filter(isStalled).length,
      'sitting longer than the stage allows') +
    statTile('target', 'purple', 'Leads in Prospects', bench, 'researched, not being worked', "nav('offtakers')") +
    outreachStatTiles(accounts) +
  '</div>';
}

/* The outreach half of the KPI row: how much reaching out happened this
   week, what came back this month (decision D3: replies and meetings, each
   counted), and how many people are waiting on a follow-up today. */
function outreachStatTiles(accounts) {
  const today = todayISO();
  const ids = new Set(accounts.map(o => o.id));
  const logs = scopedInteractions().filter(i => ids.has(i.offtakerId) && i.type !== 'stage change');
  const dow = (new Date(today + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const monday = addDays(today, -dow);
  const week = logs.filter(i => i.date >= monday && i.date <= today && isOutreachTouch(i));
  const month = logs.filter(i => String(i.date).slice(0, 7) === today.slice(0, 7));
  const replies = month.filter(i => i.outcome === 'replied').length;
  const meetings = month.filter(i => i.outcome === 'meeting-booked' || i.outcome === 'held' || (isMeetingEntry(i) && !i.outcome)).length;
  const due = accounts.reduce((n, o) => n + pipeInfo(o).duePeople, 0);
  return statTile('mail', 'blue', 'Touches this week', week.length,
      'to ' + week.reduce((n, i) => n + (i.contactIds || []).length, 0) + ' people') +
    statTile('note', 'green', 'Results this month', replies + meetings,
      replies + ' repl' + (replies === 1 ? 'y' : 'ies') + ' · ' + meetings + ' meeting' + (meetings === 1 ? '' : 's')) +
    statTile('alert', due ? 'red' : 'amber', 'Chase due', due, 'people waiting on a follow-up', "setPipeFilter('chase')");
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
    '<div class="card span-all">' +
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

  /* One card grid: the stage flow across the full width, the two smaller
     readings of it side by side underneath. */
  return '<div class="card-grid">' + flowCard + stallCard + moveCard + '</div>';
}

/* ═══ THE TABLE ═════════════════════════════════════════════════
   The same companies as the board, in stage order and then by load —
   the reading a manager wants when the question is "what is actually
   in there". Each row carries what its opportunities add up to. */
function pipelineOrdered() {
  return pipelineAccounts().slice().sort((a, b) =>
    sfStageIndex(sfStageFor(a)) - sfStageIndex(sfStageFor(b)) || num(b.annualGwh) - num(a.annualGwh));
}

/* The table's sort: stage (then load), days in stage, or open MW, the
   three a manager reorders an inspection list by. Clicking the same
   header again turns it round. */
function setPipeSort(key) {
  state.pipeSortDir = state.pipeSort === key ? -(state.pipeSortDir || 1) : 1;
  state.pipeSort = key;
  renderPipeline();
}
function pipeSorted(list) {
  const key = ['name', 'stage', 'days', 'mw'].includes(state.pipeSort) ? state.pipeSort : 'stage';
  const dir = state.pipeSortDir === -1 ? -1 : 1;
  const days = o => { const d = stageDwell(o); return d ? d.days : -1; };
  const mw = o => dealsFor(o.id).filter(isLiveDeal).reduce((a, d) => a + num(d.mw), 0);
  return list.slice().sort((a, b) => dir * (
    key === 'name' ? String(a.short || a.name).localeCompare(String(b.short || b.name))
    : key === 'days' ? days(a) - days(b)
    : key === 'mw' ? mw(a) - mw(b)
    : sfStageIndex(sfStageFor(a)) - sfStageIndex(sfStageFor(b)) || num(b.annualGwh) - num(a.annualGwh)));
}
/* The sales path as seven small bars: green for the stages behind it, the
   accent for where it is, so a row shows its position without columns. */
function stageStepsHtml(o) {
  const at = sfStageIndex(sfStageFor(o));
  return '<span class="ol-steps" title="' + esc('Step ' + (at + 1) + ' of ' + SF_STAGES.length) + '">' +
    SF_STAGES.map((st, i) => '<span class="ol-step' + (i < at ? ' done' : i === at ? ' now' : '') + '"></span>').join('') + '</span>';
}

function sortHeadHtml(key, label, cls) {
  const on = (['name', 'stage', 'days', 'mw'].includes(state.pipeSort) ? state.pipeSort : 'stage') === key;
  const arrow = on ? (state.pipeSortDir === -1 ? ' ↓' : ' ↑') : '';
  return '<th' + (cls ? ' class="' + cls + '"' : '') + (on ? ' aria-sort="' + (state.pipeSortDir === -1 ? 'descending' : 'ascending') + '"' : '') + '>' +
    '<button type="button" class="th-sort" onclick="setPipeSort(' + jsStr(key) + ')">' + esc(label) + arrow + '</button></th>';
}

function accountTableHtml() {
  const all = pipelineAccounts();
  if (!all.length) return accountBoardHtml();
  const list = pipeSorted(pipeShown(all));
  const muted = t => '<span style="color:var(--muted)">' + t + '</span>';

  const foot = tableFooterHtml({
    from: list.length ? 1 : 0, to: list.length, total: list.length, all: all.length,
    noun: list.length === 1 ? 'account' : 'accounts', page: 1, pages: 1,
  });
  return tableCardHtml('<div class="table-wrap"><table><thead><tr>' +
    selectionHeadCellHtml('pipeline', list.map(o => o.id)) +
    sortHeadHtml('name', 'Opportunity') + sortHeadHtml('stage', 'Stage') + sortHeadHtml('days', 'In stage') +
    sortHeadHtml('mw', 'Open MW', 'num') + '<th class="num">Weighted</th><th>Close date</th>' +
    '<th>Stakeholders</th><th>Last touch</th><th>Next step</th><th>This week</th><th>Actions</th>' +
    '</tr></thead><tbody>' +
    list.map(o => {
      const deals = dealsFor(o.id);
      const open = deals.filter(isLiveDeal);
      const mw = open.reduce((a, d) => a + num(d.mw), 0);
      const weighted = open.reduce((a, d) => a + weightedValue(d), 0);
      const close = open.map(d => d.closeDate).filter(Boolean).sort()[0] || '';
      const info = pipeInfo(o);
      const flags = [movedPillHtml(info), isStalled(o) ? '<span class="chip chip-stalled">Stalled</span>' : ''].filter(Boolean).join(' ');
      return '<tr>' +
        selectionCellHtml('pipeline', o.id, o.short || o.name) +
        '<td style="min-width:200px"><div class="name-cell">' + avatarTileHtml(o.name) + '<div style="min-width:0">' +
          '<button type="button" class="link-btn" onclick="openOpportunity(' + jsStr(o.id) + ')">' + esc(o.short || o.name) + '</button>' +
          '<div class="pp-sub">' + esc(sectorName(o.sector)) + (o.city ? ' · ' + esc(o.city) : '') + '</div></div></div></td>' +
        '<td><div class="ol-stage">' + sfStageBadge(o) + stageStepsHtml(o) + '</div></td>' +
        '<td>' + (sfStageFor(o) === 'closed'
          ? '<span style="font-size:11px">' + esc(STATUS_LABEL[o.status] || o.status) + '</span>'
          : dwellChipHtml(o)) + '</td>' +
        '<td class="num">' + (open.length ? fmtNum(mw) : muted('—')) + '</td>' +
        '<td class="num" style="font-weight:800">' + (open.length ? fmtR(weighted) : muted('—')) + '</td>' +
        '<td style="white-space:nowrap">' + (close ? esc(fuDate(close)) : muted('—')) + '</td>' +
        '<td style="min-width:170px">' + seatBarHtml(info) + '<div class="pp-sub" style="margin-top:4px">' + esc(reachText(info)) + '</div></td>' +
        '<td style="min-width:150px">' + esc(lastTouchText(info)) + '</td>' +
        '<td style="min-width:160px">' + (info.chases.length ? chasePillHtml(info) : muted('—')) + '</td>' +
        '<td>' + (flags || muted('—')) + '</td>' +
        '<td style="white-space:nowrap">' + opportunityButtonsHtml(o, deals, true) + '</td>' +
      '</tr>';
    }).join('') + '</tbody></table></div>', foot);
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
        avatarTileHtml(d.rec.name || d.rec.short) +
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
  const shown = pipeShown(accounts);
  const filterBar = shown.length === accounts.length ? '' :
    '<div class="toolbar"><span class="result-count">' + shown.length + ' of ' + accounts.length +
      ' account' + (accounts.length === 1 ? '' : 's') + ' shown</span>' +
      '<button class="btn btn-outline btn-sm" onclick="state.pipeQuery=&#39;&#39;;setPipeFilter(&#39;all&#39;)">Show all</button></div>';
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

/* Clicking a card opens the full opportunity page (js/views-opportunity.js). The card carries what
   a rep scans the board for: the money, how long it has sat here, how far
   into the company the outreach has reached (the seat bar), the last
   touch, anybody to chase and whether it moved this week. */
function accountCardHtml(o) {
  const deals = dealsFor(o.id);
  const open = deals.filter(isLiveDeal);
  const signed = deals.filter(d => d.stage === 'closed');
  const mw = open.reduce((a, d) => a + num(d.mw), 0);
  const annual = open.reduce((a, d) => a + dealAnnualValue(d), 0);
  const fit = fitScore(o);
  const info = pipeInfo(o);
  const money = open.length
    ? fmtNum(mw) + ' MW open · ' + fmtR(annual) + '/yr'
    : signed.length
      ? fmtNum(signed.reduce((a, d) => a + num(d.mw), 0)) + ' MW signed'
      : 'no opportunity';
  return '<div class="pipeline-card" draggable="true" data-id="' + esc(o.id) + '"' +
    ' tabindex="0" role="button" ' +
    'aria-label="Open ' + esc(o.short || o.name) + '" ' +
    'ondragstart="sfDragStart(event)" ondragend="pipeDragEnd(event)" ' +
    'onclick="openOpportunity(' + jsStr(o.id) + ')" ' +
    'onkeydown="if(event.key===&#39;Enter&#39;){openOpportunity(' + jsStr(o.id) + ')}">' +
    '<div class="pc-name">' + avatarTileHtml(o.name || o.short) + esc(o.short || o.name) + opportunityButtonsHtml(o, deals) + '</div>' +
    '<div class="pc-sub">' + esc(sectorName(o.sector)) + (o.city ? ' · ' + esc(o.city) : '') + '</div>' +
    /* An account can be worked before anybody has established its load, so
       say so rather than showing a confident nought. */
    '<div class="pc-row"><span>' + (isUnworked(o) ? 'load not established' : fmtNum(o.annualGwh) + ' GWh/yr') + '</span>' +
      '<span class="pc-val">' + money + '</span></div>' +
    seatBarHtml(info) +
    '<div class="pc-row"><span>' + esc(reachText(info)) + '</span>' +
      /* A closed account cannot stall and its dwell says nothing useful;
         which way it closed does. */
      (sfStageFor(o) === 'closed'
        ? '<span style="font-size:10px">' + esc(STATUS_LABEL[o.status] || o.status) + '</span>'
        : dwellChipHtml(o)) + '</div>' +
    '<div class="pc-last">' + icon('clock', 11) + ' ' + esc(lastTouchText(info)) + '</div>' +
    ((info.chases.length || info.moved) ? '<div class="pc-pills">' + chasePillHtml(info) + movedPillHtml(info) + '</div>' : '') +
    '<div class="pc-row"><span style="font-size:9.5px;letter-spacing:.4px;text-transform:uppercase">' +
      (isUnworked(o) ? 'not scored' : 'fit ' + fit + '/100') +
      (open.length ? ' · ' + Math.round(open.reduce((a, d) => a + num(d.probability), 0) / open.length) + '% likely' : '') +
      '</span></div>' +
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
