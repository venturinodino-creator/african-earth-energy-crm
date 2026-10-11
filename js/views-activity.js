/* ═══════════════════════════════════════════════════════════════════
   Activity
   Three readings of what is happening on the book, and a form to add to it:

     Follow-ups    what is due: an open opportunity's target close date, an off-taker's
                   revisit date. Grouped overdue, today, the next seven days, later.
     All activity  everything logged, as a timeline or a table.
     Calendar      the month at a glance, with the days that have something on marked.

   A month calendar and an inline Log activity form sit beside the list. Nothing is stored that
   was not stored before: a follow-up is a date the CRM already holds (see js/followups.js), so
   completing one happens where it already did. The page follows the province scope.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const ACT_TABS = [['followups', 'Follow-ups'], ['all', 'All activity'], ['calendar', 'Calendar']];
const INTERACTION_TYPES = [['call', 'Call'], ['email', 'Email'], ['meeting', 'Meeting'],
  ['site visit', 'Site visit'], ['proposal', 'Proposal sent'], ['note', 'Note']];

function setActivityTab(t) { state.activityTab = t; renderActivity(); }
function actMonth() { return cleanMonth(state.actMonth, todayISO().slice(0, 7)); }
function shiftActMonth(n) { state.actMonth = shiftMonth(actMonth(), n); renderActivity(); }
function pickActDay(d) {
  state.actDay = state.actDay === d ? '' : d;
  if (state.actDay) state.actMonth = d.slice(0, 7);
  renderActivity();
}
function clearActDay() { state.actDay = ''; renderActivity(); }
function actStageLabel(id) { return (PIPELINE_STAGES.find(s => s.id === id) || {}).label || id; }

function renderActivity() {
  const today = todayISO();
  const tab = ACT_TABS.some(([k]) => k === state.activityTab) ? state.activityTab : 'followups';
  const month = actMonth();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(state.actDay || '') ? state.actDay : '';

  /* The log and the follow-ups are those of the accounts in the province scope. */
  const everything = scopedInteractions().slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const items = followUps(scopedDeals(), scopedOfftakers(), actStageLabel);
  const marks = calendarMarks(everything, items);
  const logs = day ? everything.filter(i => i.date === day) : everything;
  const due = day ? items.filter(i => i.date === day) : items;

  setPage('Activity',
    items.length + ' follow-up' + (items.length === 1 ? '' : 's') + ' · ' + everything.length + ' logged interaction' + (everything.length === 1 ? '' : 's'),
    '<button class="btn btn-primary btn-sm" data-admin-only onclick="openLogInteraction()">' + icon('plus', 14) + ' Log activity</button>');

  const tabs = viewTabsHtml(ACT_TABS.map(([k, label]) => ({
    label, count: k === 'followups' ? items.length : k === 'all' ? everything.length : null,
    active: tab === k, on: "setActivityTab('" + k + "')",
  })));
  const dayChip = day
    ? '<div class="act-day"><span>Showing <b>' + esc(fuDate(day)) + '</b> only</span>' +
      '<button class="btn btn-ghost btn-xs" onclick="clearActDay()">Show all</button></div>'
    : '';

  const main = tab === 'all' ? allActivityHtml(logs, day)
    : tab === 'calendar' ? calendarTabHtml(month, marks, day, everything, items, today)
    : followUpsHtml(due, today, day);
  const side = (tab === 'calendar' ? '' :
    '<div class="card"><div class="card-header"><div class="card-title">Calendar</div></div>' + monthGridHtml(month, marks, day, today) + '</div>') +
    logFormHtml(today);

  setContent(tabs + dayChip + '<div class="act-layout"><div class="act-main">' + main + '</div><div class="act-side">' + side + '</div></div>' +
    ahqActivityCardHtml());
}

/* ─── FOLLOW-UPS ──────────────────────────────────────────────── */
function followUpRowHtml(i) {
  return '<div class="fu-row" onclick="nav(\'' + accountView(i.accountId) + '\',{id:' + jsStr(i.accountId) + '})">' +
    '<span class="fu-kind">' + (i.kind === 'deal' ? 'Close' : 'Parked') + '</span>' +
    '<div class="fu-text"><div class="fu-title">' + esc(i.title) + '</div>' +
      '<div class="fu-sub"><span class="ext-link">' + esc(i.account) + '</span> · ' + esc(i.detail) + '</div></div>' +
    '<span class="fu-date">' + esc(fuDate(i.date)) + '</span></div>';
}

function followUpsHtml(items, today, day) {
  const groups = groupFollowUps(items, today).filter(g => g.items.length);
  if (!groups.length) {
    return '<div class="card"><div class="empty"><div class="ei">' + icon('clock', 30) + '</div>' +
      '<h3>' + (day ? 'Nothing is due on ' + esc(fuDate(day)) : 'Nothing is due') + '</h3>' +
      '<p>Follow-ups come from an opportunity\'s target close date and an off-taker\'s revisit date. ' +
      'Set one on the record and it appears here.</p></div></div>';
  }
  return '<div class="card">' + groups.map(g =>
    '<div class="fu-group"><div class="fu-head fu-' + g.key + '">' + esc(g.label) + ' <span class="fu-n">' + g.items.length + '</span></div>' +
    g.items.map(followUpRowHtml).join('') + '</div>').join('') + '</div>';
}

/* ─── ALL ACTIVITY ────────────────────────────────────────────── */
function allActivityHtml(logs, day) {
  const reading = state.activityView === 'table' ? 'table' : 'timeline';
  const toolbar = '<div class="toolbar">' + viewToggle('activityView', [['timeline', 'Timeline'], ['table', 'Table']]) +
    '<span class="result-count">' + logs.length + ' entr' + (logs.length === 1 ? 'y' : 'ies') + '</span></div>';
  if (!logs.length) {
    return toolbar + '<div class="card"><div class="empty"><div class="ei">' + icon('activity', 30) + '</div><h3>' +
      (day ? 'Nothing logged on ' + esc(fuDate(day)) : 'Nothing logged yet') + '</h3>' +
      '<p>Every call, email and meeting logged here is context the next person picking up the account will need.</p></div></div>';
  }
  if (reading === 'table') {
    const foot = tableFooterHtml({ from: 1, to: logs.length, total: logs.length, all: logs.length, noun: logs.length === 1 ? 'interaction' : 'interactions', page: 1, pages: 1 });
    return toolbar + tableCardHtml(interactionTableHtml(logs), foot);
  }
  return toolbar + '<div class="card"><div class="card-header"><div class="card-title">Interaction log</div></div>' +
    logs.map(i =>
      '<div class="int-row"><div class="int-dot"></div><div class="int-body">' +
      '<div class="int-meta">' + esc(i.type) + ' · <span class="ext-link" style="cursor:pointer" onclick="nav(\'detail\',{id:\'' + i.offtakerId + '\'})">' +
      esc(getOfftaker(i.offtakerId).short || 'Unknown') + '</span> · ' + esc(i.date) + '</div>' +
      '<div class="int-text">' + esc(i.summary) + '</div></div>' +
      '<button class="btn btn-xs btn-ghost" data-admin-only onclick="deleteInteraction(\'' + i.id + '\')">' + icon('trash', 11) + '</button></div>').join('') +
    '</div>';
}

/* The log read as a register rather than a timeline: newest first either way, but the table
   puts date and type in fixed columns for scanning. */
function interactionTableHtml(logs) {
  return '<div class="table-wrap" style="border:none;background:transparent"><table><thead><tr>' +
    '<th>Date</th><th>Type</th><th>Offtaker</th><th>Summary</th><th></th>' +
    '</tr></thead><tbody>' +
    logs.map(i => {
      const o = getOfftaker(i.offtakerId);
      return '<tr>' +
        '<td style="white-space:nowrap">' + esc(i.date) + '</td>' +
        '<td>' + esc(i.type) + '</td>' +
        '<td>' + (o.id
          ? '<span class="ext-link" style="cursor:pointer" onclick="nav(\'detail\',{id:\'' + o.id + '\'})">' + esc(o.short || o.name) + '</span>'
          : '<span style="color:var(--muted)">Unknown</span>') + '</td>' +
        '<td>' + esc(i.summary) + '</td>' +
        '<td style="white-space:nowrap">' +
          '<button class="btn btn-xs btn-ghost" data-admin-only onclick="deleteInteraction(\'' + i.id + '\')">' + icon('trash', 11) + '</button>' +
        '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

/* ─── CALENDAR ────────────────────────────────────────────────── */
/* One month, Monday first. A day with logged activity or a follow-up due carries a mark, and
   clicking a day narrows the page to it. */
function monthGridHtml(month, marks, day, today) {
  const g = monthGrid(month);
  const prev = shiftMonth(month, -1), next = shiftMonth(month, 1);
  return '<div class="cal"><div class="cal-head">' +
    '<button class="cal-nav" onclick="shiftActMonth(-1)" aria-label="Previous month">&lsaquo;</button>' +
    '<b class="cal-title">' + esc(g.label) + '</b>' +
    '<button class="cal-nav" onclick="shiftActMonth(1)" aria-label="Next month">&rsaquo;</button></div>' +
    '<div class="cal-dow">' + ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => '<span>' + d + '</span>').join('') + '</div>' +
    '<div class="cal-grid">' + g.weeks.flat().map(d => {
      const m = marks[d.date];
      const tip = m ? [m.activity ? m.activity + ' logged' : '', m.due ? m.due + ' due' : ''].filter(Boolean).join(' · ') : '';
      return '<button class="cal-day' + (d.inMonth ? '' : ' out') + (d.date === today ? ' today' : '') + (d.date === day ? ' on' : '') +
        (m ? ' has' : '') + '" onclick="pickActDay(\'' + d.date + '\')"' + (tip ? ' title="' + esc(tip) + '"' : '') + '>' + d.day +
        (m ? '<span class="cal-marks">' + (m.activity ? '<i class="cal-dot a"></i>' : '') + (m.due ? '<i class="cal-dot d"></i>' : '') + '</span>' : '') + '</button>';
    }).join('') + '</div></div>';
}

function calendarTabHtml(month, marks, day, logs, items, today) {
  const dayLogs = day ? logs.filter(i => i.date === day) : [];
  const dayDue = day ? items.filter(i => i.date === day) : [];
  const list = !day
    ? '<div class="fg-hint" style="padding:10px 2px 0">Pick a day to see what is on it. A dot marks logged activity, a gold dot a follow-up due.</div>'
    : (dayDue.length ? '<div class="fu-head">Due ' + esc(fuDate(day)) + ' <span class="fu-n">' + dayDue.length + '</span></div>' + dayDue.map(followUpRowHtml).join('') : '') +
      (dayLogs.length ? '<div class="fu-head">Logged ' + esc(fuDate(day)) + ' <span class="fu-n">' + dayLogs.length + '</span></div>' +
        dayLogs.map(i => '<div class="int-row"><div class="int-dot"></div><div class="int-body"><div class="int-meta">' + esc(i.type) + ' · ' +
          esc(getOfftaker(i.offtakerId).short || 'Unknown') + '</div><div class="int-text">' + esc(i.summary) + '</div></div></div>').join('') : '') +
      (!dayDue.length && !dayLogs.length ? '<div class="fg-hint" style="padding:10px 2px 0">Nothing is on ' + esc(fuDate(day)) + '.</div>' : '');
  return '<div class="card cal-big">' + monthGridHtml(month, marks, day, today) + '</div>' + (list ? '<div class="card">' + list + '</div>' : '');
}

/* ─── THE FORM ────────────────────────────────────────────────── */
/* The same fields as the Log activity drawer, written the same way (logInteraction). */
function logFormHtml(today) {
  return '<div class="card" data-admin-only><div class="card-header"><div class="card-title">Log activity</div></div>' +
    '<div class="fgrid act-form">' +
      '<div class="fg full"><label>Account *</label><select id="act-offtaker">' + accountOptions('') + '</select></div>' +
      '<div class="fg"><label>Date</label><input type="date" id="act-date" value="' + esc(today) + '"></div>' +
      '<div class="fg"><label>Type</label><select id="act-type">' +
        INTERACTION_TYPES.map(([v, l]) => '<option value="' + esc(v) + '">' + esc(l) + '</option>').join('') + '</select></div>' +
      '<div class="fg full"><label>What happened *</label><textarea id="act-summary" placeholder="Spoke to the energy manager. They will share half-hourly data next week."></textarea></div>' +
    '</div><div class="act-save"><button class="btn btn-primary" onclick="saveInlineInteraction()">Save</button></div></div>';
}

function saveInlineInteraction() {
  const done = logInteraction({ offtakerId: val('act-offtaker'), date: val('act-date'), type: val('act-type'), summary: val('act-summary') });
  if (done) renderActivity();
}
