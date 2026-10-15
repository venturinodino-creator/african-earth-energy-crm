/* ═══════════════════════════════════════════════════════════════════
   Change log
   Who did what in the CRM, for admins. Every change the database records
   in aee_changes (who made it, from the sign-in; see
   docs/adr/0002-database-stamps-the-author.md) and every sign-in.

     top     a row per person for the period, summing their sign-ins,
             touches logged, next steps added, notes added and other
             changes; agents on rows of their own, never in a person's
     below   every change, newest first, filtered by person, company
             and kind of change, each opening its account

   The functions that read change rows (changeAuthor, changeCategory,
   describeChange, changeSummary, filterChanges) take plain rows and are
   the ones the History card and later tickets reuse.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const CL_PERIODS = [['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['range', 'Date range']];
const CL_KINDS = [['created', 'Created'], ['edited', 'Edited'], ['deleted', 'Deleted'], ['signed-in', 'Signed in'], ['role-changed', 'Role changed']];
const CL_PAGE_SIZE = 100;
const CL_FRESH_MS = 30000;   // a period fetched longer ago than this is fetched again when the page is drawn

/* ─── reading change rows ──────────────────────────────────────── */

/* The local calendar day of a timestamp, so a change at 01:00 in Johannesburg is that day. */
function clLocalDay(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function clTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
/* Today on the same local clock clLocalDay reads. todayISO() is the UTC date, which is
   still yesterday for the first two hours of a South African day. */
function clToday() { return clLocalDay(new Date()); }

/* Who a change belongs to. An agent's change is the agent run as the person, a
   change with no sign-in behind it is "not recorded", never a person's. */
function changeAuthor(c) {
  const name = c.author_email ? toDisplayName(c.author_email) : 'not recorded';
  if (c.agent) return { key: 'agent:' + c.agent + '|' + (c.author_email || ''), label: c.agent + ' (run as ' + name + ')', agent: true };
  if (!c.author_email) return { key: 'none', label: 'not recorded', agent: false, unknown: true };
  return { key: 'person:' + c.author_email, label: name, agent: false };
}

/* What a stage item is: from the change itself, then from the item still on file. */
function clStageKind(c) {
  const fromRow = (c.fields && c.fields.kind && c.fields.kind.new) || (c.deleted_row && c.deleted_row.kind);
  if (fromRow) return fromRow;
  const item = (state.stageItems || []).find(i => i.id === c.record_id);
  return item ? item.kind : '';
}

/* Which column of the summary a change counts in. */
function changeCategory(c) {
  if (c.kind === 'signed-in') return 'signIns';
  if (c.kind === 'created' && c.table_name === 'aee_interactions') return 'touches';
  if (c.kind === 'created' && c.table_name === 'aee_stage_items') {
    const k = clStageKind(c);
    if (k === 'step') return 'steps';
    if (k === 'note' || k === 'account-note') return 'notes';
  }
  return 'edits';
}

const CL_THING = {
  aee_interactions: 'a touch', aee_offtakers: 'a company', aee_contacts: 'a contact', aee_deals: 'an opportunity',
  aee_found_contacts: 'a find', aee_contact_runs: 'a finder run', aee_pm_task_edits: 'a project-plan task',
  aee_pm_notes: 'a project-plan note', aee_pm_history: 'a project-plan change', profiles: 'an account',
};
const CL_STAGE_THING = { step: 'a next step', note: 'a stage note', 'account-note': 'an account note', check: 'a checklist item' };

function clThing(c) {
  if (c.table_name === 'aee_stage_items') return CL_STAGE_THING[clStageKind(c)] || 'a next step or note';
  return CL_THING[c.table_name] || 'a record';
}

/* The words worth quoting from a row: a next step's or note's text, a touch's summary, a name. */
function clGist(row) {
  if (!row) return '';
  const v = row.body || row.summary || [row.first, row.last].filter(Boolean).join(' ') || row.name || '';
  const s = String(v).trim();
  return s.length > 70 ? s.slice(0, 69) + '…' : s;
}
const clNewRow = c => Object.fromEntries(Object.entries(c.fields || {}).map(([k, v]) => [k, v && v.new]));

/* Columns as a person names them. Anything not listed reads as its column name in words. */
const CL_FIELD = {
  name: 'Name', short: 'Short name', sector: 'Sector', province: 'Province', city: 'City', website: 'Website',
  annual_gwh: 'Annual load', annual_gwh_low: 'Annual load (low)', annual_gwh_high: 'Annual load (high)', peak_mw: 'Peak demand',
  peak_mw_est: 'Peak demand (estimate)', tariff: 'Tariff', nmd: 'Notified max demand', supply: 'Supply', wheeling: 'Wheeling',
  status: 'Status', priority: 'Priority', description: 'Description', revisit_date: 'Revisit date', blurb: 'Overview',
  notes: 'Notes', phone: 'Phone', email: 'Email', address: 'Address', near_site: 'Nearest site', estimated: 'Estimated load',
  contact_source: 'Contact source', load_basis: 'Load basis', load_method: 'Load method', lat: 'Latitude', lng: 'Longitude',
  first: 'First name', last: 'Last name', title: 'Title', dept: 'Department', linkedin: 'LinkedIn', role: 'Role',
  offtaker_id: 'Company', mw: 'MW', tenor: 'Tenor', stage: 'Stage', sf_stage: 'Stage', probability: 'Probability',
  close_date: 'Close date', project_id: 'Site', body: 'Text', due_date: 'Due date', done_at: 'Done', kind: 'Kind',
  type: 'Type', summary: 'Summary', date: 'Date', archived: 'Archived',
};
const clLabel = k => CL_FIELD[k] || (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' ');
function clVal(v, max) {
  if (v === null || v === undefined || v === '') return '—';
  /* A timestamp reads as the day and time on the local clock, not as ISO text. */
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return fuDate(clLocalDay(v)) + ' ' + clTime(v);
  const s = typeof v === 'object' ? JSON.stringify(v) : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v);
  return s.length > (max || 40) ? s.slice(0, (max || 40) - 1) + '…' : s;
}
/* A stage id as the board names it, from the app's stage list when it is loaded. */
function clStage(id) {
  const all = typeof SF_STAGES !== 'undefined' ? SF_STAGES : [];
  const s = all.find(x => x.id === id);
  return s ? s.label : clVal(id);
}

/* What an edit changed, as words: a stage move or an archive first, then each other field
   as "Label old → new", the first three and a count of the rest. */
function clEdit(c, thing) {
  const f = Object.assign({}, c.fields || {});
  const subject = c.table_name === 'aee_offtakers' ? 'the company' : thing;
  const stageKey = c.table_name === 'aee_offtakers' ? 'sf_stage' : c.table_name === 'aee_deals' ? 'stage' : null;
  const lead = [];
  if (stageKey && f[stageKey]) { lead.push('moved ' + subject + ' from ' + clStage(f[stageKey].old) + ' to ' + clStage(f[stageKey].new)); delete f[stageKey]; }
  if (c.table_name === 'aee_offtakers' && f.archived) { lead.push((f.archived.new ? 'archived ' : 'restored ') + 'the company'); delete f.archived; }
  /* Done is a tick, not a time someone typed: a checklist item is ticked or unticked, a next step marked done or reopened. */
  if (c.table_name === 'aee_stage_items' && f.done_at) {
    const tick = clStageKind(c) === 'check';
    lead.push(f.done_at.new ? (tick ? 'ticked ' + thing : 'marked ' + thing + ' done') : (tick ? 'unticked ' : 'reopened ') + thing);
    delete f.done_at;
  }
  const keys = Object.keys(f);
  const each = keys.slice(0, 3).map(k => clLabel(k) + ' ' + clVal(f[k] && f[k].old) + ' → ' + clVal(f[k] && f[k].new)).join(', ') +
    (keys.length > 3 ? ' and ' + (keys.length - 3) + ' more' : '');
  if (!lead.length) return 'edited ' + subject + (each ? ': ' + each : '');
  return lead.join(' and ') + (each ? '; ' + each : '');
}

/* One change as a sentence, without its author or company. */
function describeChange(c) {
  if (c.kind === 'signed-in') return 'signed in';
  if (c.kind === 'role-changed') return 'changed a role';
  const thing = clThing(c);
  if (c.kind === 'deleted') { const g = clGist(c.deleted_row); return 'deleted ' + thing + (g ? ' “' + g + '”' : ''); }
  if (c.kind === 'edited') return clEdit(c, thing);
  const isTick = c.table_name === 'aee_stage_items' && clStageKind(c) === 'check';
  const verb = c.table_name === 'aee_interactions' ? 'logged ' : isTick ? 'ticked ' : 'added ';
  const g = isTick ? '' : clGist(clNewRow(c));   // a tick's body is only the item's position number
  return verb + thing + (g ? ' “' + g + '”' : '');
}

/* What a deletion removed, behind a disclosure: every filled-in field, labelled, without
   ids and bookkeeping, so it can be read and re-entered by hand. */
const CL_HIDDEN = new Set(['id', 'offtaker_id', 'prospect_id', 'run_id', 'created_at', 'updated_at', 'synced_at', 'last_changed_by', 'last_changed_at']);
function deletedCopyHtml(c) {
  if (c.kind !== 'deleted' || !c.deleted_row) return '';
  const rows = Object.entries(c.deleted_row).filter(([k, v]) => !CL_HIDDEN.has(k) && v !== null && v !== '' && !(Array.isArray(v) && !v.length));
  if (!rows.length) return '';
  return '<details class="cl-copy"><summary>What was deleted</summary><dl>' +
    rows.map(([k, v]) => '<dt>' + esc(clLabel(k)) + '</dt><dd>' + esc(clVal(v, 400)) + '</dd>').join('') + '</dl></details>';
}

/* A row per person, then per agent, busiest first; "not recorded" after the people. */
function changeSummary(changes) {
  const rows = new Map();
  for (const c of changes) {
    const a = changeAuthor(c);
    if (!rows.has(a.key)) rows.set(a.key, { key: a.key, label: a.label, agent: a.agent, unknown: !!a.unknown, signIns: 0, touches: 0, steps: 0, notes: 0, edits: 0, total: 0 });
    const r = rows.get(a.key);
    r[changeCategory(c)]++;
    r.total++;
  }
  const rank = r => (r.agent ? 2 : r.unknown ? 1 : 0);
  return [...rows.values()].sort((x, y) => rank(x) - rank(y) || y.total - x.total || x.label.localeCompare(y.label));
}

/* The period's changes narrowed by the filters (person key, company id, kind). */
function filterChanges(changes, f) {
  f = f || {};
  return changes.filter(c =>
    (!f.person || changeAuthor(c).key === f.person) &&
    (!f.company || c.offtaker_id === f.company) &&
    (!f.kind || c.kind === f.kind));
}

/* ─── the period ───────────────────────────────────────────────── */
function changeLogPeriod() {
  const today = clToday();
  const key = CL_PERIODS.some(([k]) => k === state.changeLogPeriod) ? state.changeLogPeriod : '7d';
  if (key === 'today') return { key, since: today, until: today, today };
  if (key === '30d') return { key, since: addDays(today, -29), until: today, today };
  if (key === 'range') {
    const r = state.changeLogRange || {};
    const since = /^\d{4}-\d{2}-\d{2}$/.test(r.from || '') ? r.from : addDays(today, -6);
    const until = /^\d{4}-\d{2}-\d{2}$/.test(r.to || '') && r.to >= since ? r.to : today;
    return { key, since, until, today };
  }
  return { key: '7d', since: addDays(today, -6), until: today, today };
}

/* Fetch the period from local midnight of its first day, and up to local midnight after
   its last day when that is in the past. The rows already on screen stay there while a
   period is fetched again, so a refresh never blanks the page. */
async function loadChangeLog(p) {
  const key = p.since + '|' + p.until;
  const prev = state.changeLog && state.changeLog.key === key ? state.changeLog : null;
  state.changeLog = { key, since: p.since, until: p.until, rows: prev ? prev.rows : null, loadedAt: prev ? prev.loadedAt : 0, loading: true };
  const from = new Date(p.since + 'T00:00:00').toISOString();
  const to = p.until < p.today ? '&at=lt.' + encodeURIComponent(new Date(addDays(p.until, 1) + 'T00:00:00').toISOString()) : '';
  let next;
  try {
    const rows = await supaFetchAll('aee_changes?select=*&at=gte.' + encodeURIComponent(from) + to + '&order=at.desc,id.desc');
    next = { key, since: p.since, until: p.until, rows: rows || [], loadedAt: Date.now() };
  } catch (e) {
    next = { key, since: p.since, until: p.until, rows: prev ? prev.rows : [], loadedAt: Date.now(), error: String(e && e.message || e) };
  }
  if (state.changeLog && state.changeLog.key === key) state.changeLog = next;   // a newer period may have been chosen meanwhile
  if (state.view === 'changelog') renderChangeLog();
}

function setChangeLogPeriod(key) { state.changeLogPeriod = key; state.changeLogPage = 1; renderChangeLog(); }
function setChangeLogRange(which, value) {
  state.changeLogRange = Object.assign({}, state.changeLogRange, { [which]: value });
  state.changeLogPeriod = 'range';
  state.changeLogPage = 1;
  renderChangeLog();
}
function setChangeLogFilter(which, value) {
  state.changeLogFilter = Object.assign({}, state.changeLogFilter, { [which]: value });
  state.changeLogPage = 1;
  renderChangeLog();
}
function setChangeLogPage(n) { state.changeLogPage = n; renderChangeLog(); }
function openChangeRecord(id) {
  const o = state.offtakers.find(x => x.id === id);
  if (o && inPipeline(o)) nav('opportunity', { id }); else nav(accountView(id), { id });
}

/* ─── the History card (opportunity page) ──────────────────────── */
/* One account's changes: the off-taker and everything filed against it (people, opportunities,
   touches, next steps, notes). Fetched only while the card is open, again when stale. Anyone
   with CRM access may read an account's changes; sign-ins and role changes have no account and
   stay admins'. */
const CL_HISTORY_CAP = 50;
async function loadAccountHistory(id) {
  const prev = state.accountHistory && state.accountHistory.id === id ? state.accountHistory : null;
  state.accountHistory = { id, rows: prev ? prev.rows : null, loadedAt: prev ? prev.loadedAt : 0, loading: true };
  let next;
  try {
    const rows = await supaFetchAll('aee_changes?select=*&offtaker_id=eq.' + encodeURIComponent(id) + '&order=at.desc,id.desc');
    next = { id, rows: rows || [], loadedAt: Date.now() };
  } catch (e) {
    next = { id, rows: prev ? prev.rows : [], loadedAt: Date.now(), error: String(e && e.message || e) };
  }
  if (state.accountHistory && state.accountHistory.id === id) state.accountHistory = next;
  if (state.view === 'opportunity' && state.detailId === id) render();
}
function openChangeLogFor(id) {
  state.changeLogFilter = { company: id };
  state.changeLogPeriod = '30d';
  state.changeLogPage = 1;
  nav('changelog');
}
function accountHistoryCardHtml(o) {
  const key = 'opp:changes';
  let body = '';
  if (!isFolded(key)) {
    const h = state.accountHistory && state.accountHistory.id === o.id ? state.accountHistory : null;
    if (!h || (!h.loading && Date.now() - (h.loadedAt || 0) > CL_FRESH_MS)) loadAccountHistory(o.id);
    const now = state.accountHistory && state.accountHistory.id === o.id ? state.accountHistory : null;
    const rows = now && now.rows;
    body = !rows ? '<div class="pp-sub">Loading the history…</div>'
      : !rows.length ? '<div class="pp-sub">No changes recorded for this account yet. Changes are recorded from 15 Oct 2026 on.</div>'
      : rows.slice(0, CL_HISTORY_CAP).map(c =>
          '<div class="hist-row"><span class="hist-when">' + esc(fuDate(clLocalDay(c.at))) + ' ' + esc(clTime(c.at)) + '</span> ' +
          '<b>' + esc(changeAuthor(c).label) + '</b> ' + esc(describeChange(c)) + deletedCopyHtml(c) + '</div>').join('') +
        (rows.length > CL_HISTORY_CAP || state.role === 'admin'
          ? '<div class="hist-foot"><button class="btn btn-ghost btn-xs" data-admin-only onclick="openChangeLogFor(' + jsStr(o.id) + ')">' +
            (rows.length > CL_HISTORY_CAP ? 'See all ' + rows.length + ' in the Change log' : 'Open in the Change log') + '</button></div>'
          : '');
    if (now && now.error) body = '<div class="pp-sub">Could not load the history: ' + esc(now.error) + '</div>' + body;
  }
  return '<div class="card"><div class="card-header"><div>' + foldTitle(key, 'History', 'card-title') +
    '<div class="card-sub">Every change to this account and what is filed against it: who, when and what</div></div></div>' +
    foldBody(key, body) + '</div>';
}

/* ─── the page ─────────────────────────────────────────────────── */
function clCompanyName(id) {
  const o = state.offtakers.concat(state.archived || []).find(x => x.id === id);
  return o ? (o.short || o.name) : id;
}

function renderChangeLog() {
  if (state.role !== 'admin') {
    setPage('Change log', 'For admins', '');
    setContent('<div class="empty"><div class="ei">' + icon('lock', 30) + '</div><h3>The Change log is for admins</h3>' +
      '<p>It records what each person did in the CRM, so only admins can open it.</p></div>');
    return;
  }
  const p = changeLogPeriod();
  const cl = state.changeLog;
  const current = cl && cl.key === p.since + '|' + p.until;
  if (!current || (!cl.loading && Date.now() - (cl.loadedAt || 0) > CL_FRESH_MS)) loadChangeLog(p);
  const loading = !state.changeLog || !state.changeLog.rows;
  const inPeriod = loading ? [] : state.changeLog.rows
    .filter(c => { const d = clLocalDay(c.at); return d >= p.since && d <= p.until; })
    .map((c, i) => ({ c, i }))
    .sort((a, b) => String(b.c.at).localeCompare(String(a.c.at)) || a.i - b.i)
    .map(x => x.c);
  const f = state.changeLogFilter || {};
  const shown = filterChanges(inPeriod, f);

  const label = (CL_PERIODS.find(([k]) => k === p.key) || [])[1];
  setPage('Change log',
    (loading ? 'Loading…' : shown.length + ' change' + (shown.length === 1 ? '' : 's')) + ' · ' + label +
    (p.key === 'range' ? ' (' + fuDate(p.since) + ' – ' + fuDate(p.until) + ')' : ''), '');

  const tabs = viewTabsHtml(CL_PERIODS.map(([k, l]) => ({ label: l, active: p.key === k, on: 'setChangeLogPeriod(' + jsStr(k) + ')' })));
  const authors = changeSummary(inPeriod);
  const companies = [...new Set(inPeriod.map(c => c.offtaker_id).filter(Boolean))]
    .map(id => [id, clCompanyName(id)]).sort((a, b) => a[1].localeCompare(b[1]));
  /* A chosen person or company that has nothing in this period stays in its list, chosen,
     so a filter that empties the page is never invisible. */
  if (f.person && !authors.some(a => a.key === f.person)) {
    const m = /^person:(.*)$/.exec(f.person);
    authors.push({ key: f.person, label: m ? toDisplayName(m[1]) : f.person === 'none' ? 'not recorded' : f.person.replace(/^agent:([^|]*)\|.*$/, '$1') });
  }
  if (f.company && !companies.some(([id]) => id === f.company)) companies.push([f.company, clCompanyName(f.company)]);
  const opt = (v, l, sel) => '<option value="' + esc(v) + '"' + (sel === v ? ' selected' : '') + '>' + esc(l) + '</option>';
  const toolbar = '<div class="toolbar">' +
    (p.key === 'range'
      ? '<input type="date" class="flt" aria-label="From" value="' + esc(p.since) + '" onchange="setChangeLogRange(\'from\',this.value)">' +
        '<input type="date" class="flt" aria-label="To" value="' + esc(p.until) + '" onchange="setChangeLogRange(\'to\',this.value)">'
      : '') +
    '<select class="flt" aria-label="Person" onchange="setChangeLogFilter(\'person\',this.value)">' + opt('', 'Everyone', f.person || '') +
      authors.map(a => opt(a.key, a.label, f.person)).join('') + '</select>' +
    '<select class="flt" aria-label="Company" onchange="setChangeLogFilter(\'company\',this.value)">' + opt('', 'All companies', f.company || '') +
      companies.map(([id, n]) => opt(id, n, f.company)).join('') + '</select>' +
    '<select class="flt" aria-label="Kind of change" onchange="setChangeLogFilter(\'kind\',this.value)">' + opt('', 'Every kind', f.kind || '') +
      CL_KINDS.map(([k, l]) => opt(k, l, f.kind)).join('') + '</select>' +
    '<span class="result-count">' + (loading ? '' : shown.length + ' result' + (shown.length === 1 ? '' : 's')) + '</span>' +
  '</div>';

  if (loading) {
    setContent(tabs + toolbar + '<div class="empty"><div class="ei">' + icon('clock', 30) + '</div><h3>Loading the changes…</h3></div>');
    return;
  }
  const err = state.changeLog.error
    ? '<div class="fg-hint" style="margin-bottom:12px">Could not load the Change log: ' + esc(state.changeLog.error) + '</div>' : '';
  if (!shown.length) {
    setContent(tabs + toolbar + err + '<div class="empty"><div class="ei">' + icon('activity', 30) + '</div>' +
      '<h3>Nothing was changed in this period</h3><p>' + (inPeriod.length ? 'Loosen the filters to see more.' : 'Pick a longer period.') + '</p></div>');
    return;
  }

  const sumRows = changeSummary(shown);
  const num = n => '<td class="num">' + n + '</td>';
  const summary = '<div class="card cl-summary" style="margin-bottom:14px"><div class="card-header"><div><div class="card-title">Who did what</div>' +
      '<div class="card-sub">' + esc(label) + '. Agents are counted on their own rows, never as the person they ran as.</div></div></div>' +
    '<div class="table-wrap"><table><thead><tr><th>Who</th><th class="num">Sign-ins</th><th class="num">Touches</th>' +
      '<th class="num">Next steps</th><th class="num">Notes</th><th class="num">Other changes</th><th class="num">Total</th></tr></thead><tbody>' +
    sumRows.map(r => '<tr class="cl-sum' + (r.agent ? ' cl-agent' : '') + '"><td>' + esc(r.label) + '</td>' +
      num(r.signIns) + num(r.touches) + num(r.steps) + num(r.notes) + num(r.edits) + num(r.total) + '</tr>').join('') +
    '</tbody></table></div></div>';

  const pages = Math.max(1, Math.ceil(shown.length / CL_PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(state.changeLogPage) || 1), pages);
  const start = (page - 1) * CL_PAGE_SIZE;
  const list = shown.slice(start, start + CL_PAGE_SIZE);
  const rowHtml = c => {
    const a = changeAuthor(c);
    const company = c.offtaker_id
      ? '<span class="ext-link" role="link" tabindex="0" onclick="openChangeRecord(' + jsStr(c.offtaker_id) + ')">' + esc(clCompanyName(c.offtaker_id)) + '</span>'
      : '<span class="pp-sub">—</span>';
    return '<tr class="cl-row"><td class="cl-when">' + esc(fuDate(clLocalDay(c.at))) + ' <span class="pp-sub">' + esc(clTime(c.at)) + '</span></td>' +
      '<td>' + esc(a.label) + '</td><td class="cl-what">' + esc(describeChange(c)) + deletedCopyHtml(c) + '</td><td>' + company + '</td></tr>';
  };
  const table = '<div class="table-wrap"><table class="cl-list"><thead><tr><th>When</th><th>Who</th><th>What</th><th>Company</th></tr></thead><tbody>' +
    list.map(rowHtml).join('') + '</tbody></table></div>';
  const foot = tableFooterHtml({ from: start + 1, to: start + list.length, total: shown.length, all: inPeriod.length, noun: 'changes',
    page, pages, prev: 'setChangeLogPage(' + (page - 1) + ')', next: 'setChangeLogPage(' + (page + 1) + ')' });

  setContent(tabs + toolbar + err + summary + tableCardHtml(table, foot));
}
