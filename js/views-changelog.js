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

/* One change as a sentence, without its author or company. */
function describeChange(c) {
  if (c.kind === 'signed-in') return 'signed in';
  if (c.kind === 'role-changed') return 'changed a role';
  const thing = clThing(c);
  if (c.kind === 'deleted') { const g = clGist(c.deleted_row); return 'deleted ' + thing + (g ? ' “' + g + '”' : ''); }
  if (c.kind === 'edited') {
    const fields = Object.keys(c.fields || {});
    return 'edited ' + thing + (fields.length ? ': ' + fields.join(', ') : '');
  }
  const isTick = c.table_name === 'aee_stage_items' && clStageKind(c) === 'check';
  const verb = c.table_name === 'aee_interactions' ? 'logged ' : isTick ? 'ticked ' : 'added ';
  const g = isTick ? '' : clGist(clNewRow(c));   // a tick's body is only the item's position number
  return verb + thing + (g ? ' “' + g + '”' : '');
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
      '<td>' + esc(a.label) + '</td><td class="cl-what">' + esc(describeChange(c)) + '</td><td>' + company + '</td></tr>';
  };
  const table = '<div class="table-wrap"><table class="cl-list"><thead><tr><th>When</th><th>Who</th><th>What</th><th>Company</th></tr></thead><tbody>' +
    list.map(rowHtml).join('') + '</tbody></table></div>';
  const foot = tableFooterHtml({ from: start + 1, to: start + list.length, total: shown.length, all: inPeriod.length, noun: 'changes',
    page, pages, prev: 'setChangeLogPage(' + (page - 1) + ')', next: 'setChangeLogPage(' + (page + 1) + ')' });

  setContent(tabs + toolbar + err + summary + tableCardHtml(table, foot));
}
