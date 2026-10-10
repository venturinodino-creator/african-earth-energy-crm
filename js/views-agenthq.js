/* === AGENT HQ ========================================================
   Every research agent working for the CRM, and what each run is doing.

   Read entirely off the real queue (aee_contact_runs and the finds that
   hang off it), the same data the Contact finder and the dashboard card
   read. Nothing here is a schedule or a placeholder. A run is "running"
   only while the finder has claimed it and not finished it; a claim that
   has gone quiet is flagged as stalled rather than left looking busy.

   The page re-reads the queue every 20 seconds while it is on screen.
   ====================================================================== */

const AHQ_POLL_MS = 20000;
/* A claimed run that has not finished within this long is probably dead. */
const AHQ_STALL_MIN = 45;
let _ahqTimer = null;
let _ahqFetched = false;

/* The agent definitions in .claude/agents, in the order a reader looks. */
const AHQ_ROSTER = [
  { key: 'apollo', name: 'Apollo daily ingestion', icon: 'target', cls: 'amber',
    what: 'Reveals one work email per open ladder seat from Apollo each morning, within a credit budget' },
  { key: 'listed', name: 'Listed off-taker contact finder', icon: 'building', cls: 'amber',
    what: 'Works the ladder gaps at the off-takers on the Prospects page; never the Archive' },
  { key: 'priority', name: 'Priority contact finder', icon: 'target', cls: 'purple',
    what: 'Deep multi-angle research for the priority list; email required on every find' },
  { key: 'offtakers', name: 'Offtaker contact finder', icon: 'building', cls: 'green',
    what: 'The seven stakeholder-ladder seats at offtaker companies' },
  { key: 'municipal', name: 'Municipality contact finder', icon: 'pin', cls: 'blue',
    what: 'Manager, CFO, electricity, technical services and SCM at the main municipalities' },
];

function ahqAgo(iso) {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(m)) return '';
  if (m < 1) return 'just now';
  if (m < 60) return m + ' min ago';
  if (m < 1440) return Math.floor(m / 60) + ' h ago';
  return Math.floor(m / 1440) + ' d ago';
}

function ahqMinutesSince(iso) {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : (Date.now() - t) / 60000;
}

/* Which agent a run was aimed at, read off the ids it carries. */
function ahqAgentOf(run) {
  if (/^Apollo daily/.test(run.note || '')) return 'apollo';
  if (/^Gap run/.test(run.note || '')) return 'listed';
  const ids = run.offtakerIds || [];
  if (ids.some(id => String(id || '').startsWith('mun_'))) return 'municipal';
  const archived = id => (getOfftaker(id) || {}).archived;
  if (ids.length && ids.some(id => getOfftaker(id).id && !archived(id))) return 'priority';
  return 'offtakers';
}

function ahqStatus(run) {
  if (run.status === 'running') {
    const since = run.claimedAt || run.created;
    if (ahqMinutesSince(since) > AHQ_STALL_MIN) return { label: 'Stalled?', cls: 'b-high' };
    return { label: 'Running', cls: 'b-engaged' };
  }
  if (run.status === 'queued') return { label: 'Queued', cls: 'b-medium' };
  if (run.status === 'failed') return { label: 'Failed', cls: 'b-high' };
  if (run.status === 'done' || run.status === 'finished' || run.status === 'complete') return { label: 'Done', cls: 'b-prospect' };
  return { label: run.status || 'Unknown', cls: 'b-low' };
}

function ahqTargetName(id) {
  if (String(id || '').startsWith('mun_') && typeof SA_MUNICIPALITIES !== 'undefined') {
    const m = SA_MUNICIPALITIES.find(x => x.id === id);
    if (m) return m.name;
  }
  return getOfftaker(id).name || id;
}

function ahqTargetsHtml(run) {
  const names = (run.offtakerIds || []).map(ahqTargetName);
  if (!names.length) return '<span class="mkt-note">' + esc(run.industry || 'all') + '</span>';
  const shown = names.slice(0, 3).map(esc).join(', ');
  return shown + (names.length > 3 ? ' <span class="mkt-note">+' + (names.length - 3) + ' more</span>' : '');
}

function ahqRosterRowHtml(a, runs, finds) {
  const mine = runs.filter(r => ahqAgentOf(r) === a.key);
  const live = mine.filter(r => ahqStatus(r).label === 'Running');
  const stalled = mine.filter(r => ahqStatus(r).label === 'Stalled?');
  const queued = mine.filter(r => r.status === 'queued');
  const ids = new Set(mine.map(r => r.id));
  const mineFinds = finds.filter(f => ids.has(f.runId));
  const pending = mineFinds.filter(f => f.status === 'pending').length;
  let badge, cls;
  if (live.length) { badge = live.length + ' running'; cls = 'b-engaged'; }
  else if (stalled.length) { badge = stalled.length + ' stalled?'; cls = 'b-high'; }
  else if (queued.length) { badge = queued.length + ' queued'; cls = 'b-medium'; }
  else if (!mine.length) { badge = 'Never run'; cls = 'b-low'; }
  else { badge = 'Idle'; cls = 'b-prospect'; }
  const last = mine[0];
  return '<div class="person-row">' +
    '<div class="stat-icon-box ' + a.cls + '" style="width:32px;height:32px;border-radius:8px">' + icon(a.icon, 15) + '</div>' +
    '<div style="min-width:0;flex:1"><div class="person-name">' + esc(a.name) + '</div>' +
    '<div class="person-title">' + esc(a.what) + '</div>' +
    '<div class="person-title">' + mine.length + ' run' + (mine.length === 1 ? '' : 's') + ' &middot; ' +
      fmtNum(mineFinds.length) + ' found' + (pending ? ' &middot; <b>' + pending + ' to review</b>' : '') +
      (last ? ' &middot; last queued ' + esc(ahqAgo(last.created)) : '') + '</div></div>' +
    '<div class="person-actions"><span class="badge ' + cls + '">' + esc(badge) + '</span></div></div>';
}

function ahqRunRowHtml(run, finds) {
  const st = ahqStatus(run);
  const a = AHQ_ROSTER.find(x => x.key === ahqAgentOf(run));
  const mine = finds.filter(f => f.runId === run.id);
  const withEmail = mine.filter(f => f.email).length;
  const when = run.finishedAt ? 'finished ' + ahqAgo(run.finishedAt)
    : run.claimedAt ? 'started ' + ahqAgo(run.claimedAt)
    : 'queued ' + ahqAgo(run.created);
  return '<tr>' +
    '<td><span class="badge ' + st.cls + '">' + esc(st.label) + '</span></td>' +
    '<td style="font-weight:600">' + esc(a ? a.name : 'Contact finder') + '</td>' +
    '<td style="max-width:320px">' + ahqTargetsHtml(run) + '</td>' +
    '<td class="mkt-note">' + esc((run.roles || []).join(', ') || 'all seats') + '</td>' +
    '<td class="num" style="font-weight:700">' + (mine.length || num(run.found)) + '</td>' +
    '<td class="num">' + withEmail + '</td>' +
    '<td class="mkt-note">' + esc(when) + (run.note ? '<div title="' + esc(run.note) + '" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(run.note) + '</div>' : '') + '</td>' +
    '</tr>';
}

function renderAgentHQ() {
  if (!state.contactRuns) loadFinderCache();
  if (!_ahqFetched) { _ahqFetched = true; refreshFinderFromServer(false); }
  const runs = (state.contactRuns || []).slice().sort((x, y) => String(y.created).localeCompare(String(x.created)));
  const finds = state.foundContacts || [];
  const running = runs.filter(r => ahqStatus(r).label === 'Running').length;
  const stalled = runs.filter(r => ahqStatus(r).label === 'Stalled?').length;
  const queued = runs.filter(r => r.status === 'queued').length;
  const pending = finds.filter(f => f.status === 'pending').length;

  setPage('Agent HQ', 'Every research agent, what it is working on, and what it has found',
    '<button class="btn btn-ghost btn-sm" onclick="refreshFinderFromServer(true)">Refresh</button>');

  const active = runs.filter(r => ['Running', 'Stalled?', 'Queued'].includes(ahqStatus(r).label));
  const recent = runs.filter(r => !active.includes(r)).slice(0, 30);
  const table = list => '<div class="table-wrap" style="border:0"><table><thead><tr><th>Status</th><th>Agent</th><th>Working on</th><th>Seats</th>' +
    '<th class="num">Found</th><th class="num">With email</th><th>When</th></tr></thead><tbody>' +
    list.map(r => ahqRunRowHtml(r, finds)).join('') + '</tbody></table></div>';

  setContent(
    '<div class="stats-grid">' +
      statTile('check', 'green', 'Running now', String(running), stalled ? stalled + ' possibly stalled' : 'claimed and in progress') +
      statTile('pipeline', 'amber', 'Queued', String(queued), 'waiting to be picked up') +
      statTile('contacts', 'blue', 'People found', fmtNum(finds.length), 'across ' + runs.length + ' runs') +
      statTile('target', 'purple', 'To review', String(pending), 'nothing is added until accepted') +
    '</div>' +
    /* The run tables are seven columns wide, so each card takes the full width of the grid. */
    '<div class="card-grid">' +
    '<div class="card span-all"><div class="card-header"><div><div class="card-title">Agents</div>' +
      '<div class="card-sub">The research agents defined for this CRM</div></div></div>' +
      AHQ_ROSTER.map(a => ahqRosterRowHtml(a, runs, finds)).join('') + '</div>' +
    '<div class="card span-all"><div class="card-header"><div><div class="card-title">Working now</div>' +
      '<div class="card-sub">Running, stalled and waiting runs</div></div></div>' +
      (active.length ? table(active) : '<div class="fg-hint">No agent is running or queued. Queue a run from the Contact finder.</div>') + '</div>' +
    '<div class="card span-all"><div class="card-header"><div><div class="card-title">Recent runs</div>' +
      '<div class="card-sub">The last ' + recent.length + ' finished or failed</div></div></div>' +
      (recent.length ? table(recent) : '<div class="fg-hint">Nothing has finished yet.</div>') + '</div>' +
    '</div>' +
    '<div class="fg-hint" style="margin-top:10px">Updates every ' + (AHQ_POLL_MS / 1000) + ' seconds while this page is open. ' +
      'Agents run outside the browser; this page shows their rows in the queue. A run claimed more than ' + AHQ_STALL_MIN + ' minutes ago and not finished is marked stalled.</div>');

  clearTimeout(_ahqTimer);
  _ahqTimer = setTimeout(function tick() {
    if (state.view === 'agenthq') refreshFinderFromServer(false);
  }, AHQ_POLL_MS);
}

/* ─── THE CARD ON THE ACTIVITY PAGE ───────────────────────────────────
   The same agents and the same queue as Agent HQ, in brief, so the first thing
   on Activity is what is working for you right now. */
function ahqNewsRowHtml() {
  if (typeof NEWS_AUTO === 'undefined' || !NEWS_AUTO.length) return '';
  const last = NEWS_AUTO.reduce((m, n) => (String(n.date) > m ? String(n.date) : m), '');
  return '<div class="person-row" style="cursor:pointer" onclick="nav(\'news\')">' +
    '<div class="stat-icon-box blue" style="width:32px;height:32px;border-radius:8px">' + icon('note', 15) + '</div>' +
    '<div style="min-width:0;flex:1"><div class="person-name">Daily AEEG News Scan</div>' +
    '<div class="person-title">Collects stories for the News page once a day, outside the browser</div>' +
    '<div class="person-title">' + NEWS_AUTO.length + ' stories collected &middot; newest ' + esc(last) + '</div></div>' +
    '<div class="person-actions"><span class="badge b-prospect">Scheduled daily</span></div></div>';
}

function ahqActivityCardHtml() {
  if (!state.contactRuns) loadFinderCache();
  if (!_ahqFetched) { _ahqFetched = true; refreshFinderFromServer(false); }
  const runs = state.contactRuns || [];
  const finds = state.foundContacts || [];
  const active = runs.filter(r => ['Running', 'Stalled?', 'Queued'].includes(ahqStatus(r).label));
  const running = runs.filter(r => ahqStatus(r).label === 'Running').length;
  const stalled = runs.filter(r => ahqStatus(r).label === 'Stalled?').length;
  const queued = runs.filter(r => r.status === 'queued').length;
  const pending = finds.filter(f => f.status === 'pending').length;
  const activeRows = active.slice(0, 4).map(r => {
    const st = ahqStatus(r); const a = AHQ_ROSTER.find(x => x.key === ahqAgentOf(r));
    return '<div class="mkt-row"><div style="min-width:0"><div style="font-weight:600"><span class="badge ' + st.cls + '">' + esc(st.label) + '</span> ' + esc(a ? a.name : 'Contact finder') + '</div>' +
      '<div class="mkt-note">' + ahqTargetsHtml(r) + '</div></div>' +
      '<div class="mkt-value">' + (finds.filter(f => f.runId === r.id).length || num(r.found)) + ' found</div></div>';
  }).join('');
  clearTimeout(_ahqTimer);
  _ahqTimer = setTimeout(() => { if (state.view === 'activity') refreshFinderFromServer(false); }, AHQ_POLL_MS);
  return '<div class="card" style="margin-bottom:14px"><div class="card-header"><div><div class="card-title">Agents in this repo</div>' +
    '<div class="card-sub">' + (running ? '<b>' + running + ' running</b>' : 'none running') + (stalled ? ' &middot; ' + stalled + ' possibly stalled' : '') +
    ' &middot; ' + queued + ' queued' + (pending ? ' &middot; <b>' + pending + ' found ' + (pending === 1 ? 'person' : 'people') + ' to review</b>' : '') + '</div></div>' +
    '<button class="btn btn-ghost btn-xs" onclick="nav(\'agenthq\')">Agent HQ</button></div>' +
    (activeRows ? '<div style="margin-bottom:8px">' + activeRows + '</div>' : '') +
    AHQ_ROSTER.map(a => ahqRosterRowHtml(a, runs, finds)).join('') + ahqNewsRowHtml() + '</div>';
}
