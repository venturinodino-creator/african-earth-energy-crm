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
/* What goes before an entry's summary wherever the log is drawn: the channel, touch number,
   people and outcome for an outreach entry, the plain type for anything older, then who logged
   it, which the database stamps (ADR 0002). An entry from before that says so. */
function entryMetaText(i) { return entryHeadline(i, state.contacts) + ' · ' + (i.author ? 'by ' + i.author : 'not recorded'); }

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
  const items = followUps(scopedDeals(), scopedOfftakers(), actStageLabel)
    .concat(outreachFollowUps(scopedInteractions(), scopedOfftakers(), scopedContacts()))
    .concat(stepFollowUps(state.stageItems, scopedOfftakers(), actStageLabel));
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
  outreachFormSync('act', 'init');
}

/* ─── FOLLOW-UPS ──────────────────────────────────────────────── */
function followUpRowHtml(i) {
  /* A next step lives on the opportunity page, so that is where it opens. */
  const view = i.kind === 'step' ? 'opportunity' : accountView(i.accountId);
  return '<div class="fu-row" onclick="nav(\'' + view + '\',{id:' + jsStr(i.accountId) + '})">' +
    '<span class="fu-kind">' + (i.kind === 'deal' ? 'Close' : i.kind === 'outreach' ? 'Chase' : i.kind === 'step' ? 'Step' : 'Parked') + '</span>' +
    '<div class="fu-text"><div class="fu-title">' + esc(i.title) + '</div>' +
      '<div class="fu-sub"><span class="ext-link">' + esc(i.account) + '</span> · ' + esc(i.detail) + '</div></div>' +
    '<span class="fu-date">' + esc(fuDate(i.date)) + '</span></div>';
}

function followUpsHtml(items, today, day) {
  const groups = groupFollowUps(items, today).filter(g => g.items.length);
  if (!groups.length) {
    return '<div class="card"><div class="empty"><div class="ei">' + icon('clock', 30) + '</div>' +
      '<h3>' + (day ? 'Nothing is due on ' + esc(fuDate(day)) : 'Nothing is due') + '</h3>' +
      '<p>Follow-ups come from an opportunity\'s target close date, an off-taker\'s revisit date and any outreach touch ' +
      'still waiting on a reply. Set one and it appears here.</p></div></div>';
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
      '<div class="int-meta">' + esc(entryMetaText(i)) + ' · <span class="ext-link" style="cursor:pointer" onclick="nav(\'detail\',{id:\'' + i.offtakerId + '\'})">' +
      esc(getOfftaker(i.offtakerId).short || 'Unknown') + '</span> · ' + esc(i.date) + '</div>' +
      '<div class="int-text">' + esc(i.summary) + '</div></div>' +
      '<button class="btn btn-xs btn-ghost" data-admin-only onclick="deleteInteraction(\'' + i.id + '\')">' + icon('trash', 11) + '</button></div>').join('') +
    '</div>';
}

/* The log read as a register rather than a timeline: newest first either way, but the table
   puts date and type in fixed columns for scanning. */
function interactionTableHtml(logs) {
  return '<div class="table-wrap" style="border:none;background:transparent"><table><thead><tr>' +
    '<th>Date</th><th>Activity</th><th>Offtaker</th><th>Summary</th><th></th>' +
    '</tr></thead><tbody>' +
    logs.map(i => {
      const o = getOfftaker(i.offtakerId);
      return '<tr>' +
        '<td style="white-space:nowrap">' + esc(i.date) + '</td>' +
        '<td>' + esc(entryMetaText(i)) + '</td>' +
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
        dayLogs.map(i => '<div class="int-row"><div class="int-dot"></div><div class="int-body"><div class="int-meta">' + esc(entryMetaText(i)) + ' · ' +
          esc(getOfftaker(i.offtakerId).short || 'Unknown') + '</div><div class="int-text">' + esc(i.summary) + '</div></div></div>').join('') : '') +
      (!dayDue.length && !dayLogs.length ? '<div class="fg-hint" style="padding:10px 2px 0">Nothing is on ' + esc(fuDate(day)) + '.</div>' : '');
  return '<div class="card cal-big">' + monthGridHtml(month, marks, day, today) + '</div>' + (list ? '<div class="card">' + list + '</div>' : '');
}

/* ─── THE OUTREACH FIELDS ─────────────────────────────────────────
   How, who, what came of it and when to chase: the part of the log form
   both the Log activity window ('mi', in index.html, opened from js/forms.js)
   and the form on this page ('act') share, built once here so the two
   cannot drift apart. The
   rules behind the defaults are in js/outreach.js. */
function outreachFieldsHtml(p) {
  const opts = (list, sel) => list.map(x => '<option value="' + esc(x.id) + '"' + (x.id === sel ? ' selected' : '') + '>' + esc(x.label) + '</option>').join('');
  return '<div class="fg"><label for="' + p + '-channel">How</label><select id="' + p + '-channel" onchange="outreachFormSync(\'' + p + '\',\'channel\')">' + opts(OUTREACH_CHANNELS, 'email') + '</select></div>' +
    '<div class="fg"><label for="' + p + '-outcome">What came of it</label><select id="' + p + '-outcome" onchange="outreachFormSync(\'' + p + '\',\'outcome\')">' +
      '<option value="">—</option>' + opts(OUTREACH_OUTCOMES, 'sent') + '</select></div>' +
    '<div class="fg full"><label>Who <span class="ow-touch" id="' + p + '-touch"></span></label><div class="ow-people" id="' + p + '-people"></div>' +
      '<details class="ow-new" id="' + p + '-newbox" ontoggle="outreachFormSync(\'' + p + '\',\'people\')"><summary>Someone not on file yet</summary>' +
        '<div class="fgrid ow-new-grid">' +
          '<div class="fg"><label for="' + p + '-nfirst">First name</label><input id="' + p + '-nfirst" oninput="outreachFormSync(\'' + p + '\',\'people\')"></div>' +
          '<div class="fg"><label for="' + p + '-nlast">Last name</label><input id="' + p + '-nlast" oninput="outreachFormSync(\'' + p + '\',\'people\')"></div>' +
          '<div class="fg"><label for="' + p + '-ntitle">Job title</label><input id="' + p + '-ntitle" placeholder="Head of Energy"></div>' +
          '<div class="fg"><label for="' + p + '-nemail">Email</label><input id="' + p + '-nemail" type="email"></div>' +
          '<div class="fg full"><label for="' + p + '-nlinkedin">LinkedIn</label><input id="' + p + '-nlinkedin" placeholder="https://www.linkedin.com/in/…"></div>' +
        '</div><div class="fg-hint">Saved as a contact at this company when you log, so they appear on Contacts and the org map.</div></details></div>' +
    '<div class="fg"><label for="' + p + '-followup">Follow up on</label><input id="' + p + '-followup" type="date" oninput="this.dataset.touched=\'1\'">' +
      '<div class="fg-hint" id="' + p + '-followup-hint"></div></div>';
}

/* The people ticked, plus the one being added, if a name has been typed. */
function outreachPicked(p) {
  return Array.from(document.querySelectorAll('#' + p + '-people input[type=checkbox]:checked')).map(x => x.value);
}
function outreachNewPerson(p) {
  const box = document.getElementById(p + '-newbox');
  if (!box || !box.open) return null;
  const first = val(p + '-nfirst'), last = val(p + '-nlast');
  if (!first && !last) return null;
  return { first, last, title: val(p + '-ntitle'), email: val(p + '-nemail'), linkedin: val(p + '-nlinkedin') };
}

/* Keep the fields in step with each other. `what` is the field that just
   changed: a new account redraws the people, a new channel resets the
   outcome to the usual one, and every change recomputes the touch number
   and (unless it has been typed over) the follow-up date. */
function outreachFormSync(p, what) {
  const peopleEl = document.getElementById(p + '-people');
  if (!peopleEl) return;
  const account = val(p + '-offtaker');
  const channel = val(p + '-channel');
  if (what === 'init' || what === 'account') {
    const people = contactsFor(account).slice().sort((a, b) => (a.last + a.first).localeCompare(b.last + b.first));
    const today = todayISO();
    peopleEl.innerHTML = !account ? '<div class="fg-hint">Pick an account to see who is on file there.</div>'
      : !people.length ? '<div class="fg-hint">Nobody on file at this company yet. Add the person below.</div>'
      : people.map(c => {
          const eng = contactEngagement(c.id, state.interactions, today);
          return '<label class="ow-person"><input type="checkbox" value="' + esc(c.id) + '" onchange="outreachFormSync(\'' + p + '\',\'people\')">' +
            '<span class="ow-name">' + esc((c.first + ' ' + c.last).trim() || 'Unnamed') + '</span>' +
            '<span class="ow-title">' + esc(c.title || '') + '</span>' +
            '<span class="ow-eng ow-' + eng + '">' + esc(ENGAGEMENT_LABEL[eng]) + '</span></label>';
        }).join('');
  }
  if (what === 'init' || what === 'channel') setVal(p + '-outcome', defaultOutcome(channel));
  const c = outreachChannel(channel) || {};
  const picked = outreachPicked(p);
  const fresh = outreachNewPerson(p);
  const touch = document.getElementById(p + '-touch');
  if (touch) {
    touch.textContent = c.outreach && (picked.length || fresh)
      ? '· this is touch ' + nextTouchNumber(picked, state.interactions) + ' of ' + OUTREACH_MAX_TOUCHES
      : '';
  }
  const fu = document.getElementById(p + '-followup');
  if (fu && !fu.dataset.touched) fu.value = defaultFollowUp(val(p + '-date') || todayISO(), channel, val(p + '-outcome'));
  const hint = document.getElementById(p + '-followup-hint');
  if (hint) hint.textContent = c.outreach ? 'Clears itself when you log the next touch or their reply.' : '';
  const label = document.getElementById(p + '-summary-label');
  if (label) label.textContent = c.outreach ? 'What happened (optional)' : 'What happened *';
}

function outreachFormValues(p) {
  return {
    offtakerId: val(p + '-offtaker'), date: val(p + '-date'), summary: val(p + '-summary'),
    channel: val(p + '-channel'), outcome: val(p + '-outcome'), followUpOn: val(p + '-followup'),
    contactIds: outreachPicked(p), newPerson: outreachNewPerson(p),
  };
}

/* ─── THE FORM ────────────────────────────────────────────────── */
/* The same fields as the Log activity drawer, written the same way (logInteraction). */
function logFormHtml(today) {
  return '<div class="card" data-admin-only><div class="card-header"><div class="card-title">Log activity</div></div>' +
    '<div class="fgrid act-form">' +
      '<div class="fg full"><label for="act-offtaker">Account *</label><select id="act-offtaker" onchange="outreachFormSync(\'act\',\'account\')">' + accountOptions('') + '</select></div>' +
      '<div class="fg"><label for="act-date">Date</label><input type="date" id="act-date" value="' + esc(today) + '" onchange="outreachFormSync(\'act\',\'date\')"></div>' +
      '<div class="ow-wrap">' + outreachFieldsHtml('act') + '</div>' +
      '<div class="fg full"><label id="act-summary-label" for="act-summary">What happened (optional)</label><textarea id="act-summary" placeholder="Spoke to the energy manager. They will share half-hourly data next week."></textarea></div>' +
    '</div><div class="act-save"><button class="btn btn-primary" onclick="saveInlineInteraction()">Save</button></div></div>';
}

function saveInlineInteraction() {
  const done = logInteraction(outreachFormValues('act'));
  if (done) renderActivity();
}
