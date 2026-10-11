/* ═══════════════════════════════════════════════════════════════════
   Follow-ups and the calendar. Pure functions, no DOM.

   A follow-up is a date the CRM already holds: an open opportunity's target close date, or an
   off-taker's revisit date. Nothing is entered a second time and nothing new is stored, so
   completing one is done where it already is (closing the opportunity, clearing the revisit
   date). This file works out what is due and when, the month grid a calendar draws, and which
   days have something on. The Activity page and the Dashboard both read it, so the two never
   disagree about what is due.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const FU_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* "2026-10-08" as a person says it: "8 Oct 2026". Anything that is not a date is blank. */
function fuDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? Number(m[3]) + ' ' + FU_MONTHS[Number(m[2]) - 1].slice(0, 3) + ' ' + m[1] : '';
}

/* Whole days on a calendar date, not on a clock: noon UTC, so daylight saving can never move one. */
function addDays(iso, n) {
  const d = new Date(String(iso) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* Everything with a date to act on. `stageLabel` turns a stage id into its name. A deal on an
   account that is not in the list is left out: a row with no name could not be acted on. */
function followUps(deals, offtakers, stageLabel) {
  const byId = {};
  offtakers.forEach(o => { byId[o.id] = o; });
  const nameOf = o => o.short || o.name;
  const out = [];
  deals.forEach(d => {
    if (!d.closeDate || d.stage === 'closed' || d.stage === 'lost') return;
    const o = byId[d.offtakerId];
    if (!o) return;
    out.push({
      kind: 'deal', id: d.id, key: 'deal-' + d.id, accountId: o.id, account: nameOf(o), date: d.closeDate,
      title: d.name || 'Opportunity', detail: Math.round(Number(d.mw) || 0) + ' MW · ' + stageLabel(d.stage),
    });
  });
  offtakers.forEach(o => {
    if (!o.revisitDate) return;
    out.push({
      kind: 'revisit', key: 'revisit-' + o.id, accountId: o.id, account: nameOf(o), date: o.revisitDate,
      title: 'Revisit ' + nameOf(o), detail: 'Parked until this date',
    });
  });
  return out;
}

/* Overdue, today, the next seven days, later: always all four, in that order, soonest first
   inside each. The page draws the ones that are not empty. */
function groupFollowUps(items, today) {
  const week = addDays(today, 7);
  const groups = [
    { key: 'overdue', label: 'Overdue', items: [] },
    { key: 'today', label: 'Today', items: [] },
    { key: 'next7', label: 'Next 7 days', items: [] },
    { key: 'later', label: 'Later', items: [] },
  ];
  items.filter(i => i.date).slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(i => {
    const g = i.date < today ? 0 : i.date === today ? 1 : i.date <= week ? 2 : 3;
    groups[g].items.push(i);
  });
  return groups;
}

/* ─── WHAT NEEDS ATTENTION ────────────────────────────────────── */
/* Whole days from one calendar date to a later one. */
function daysBetween(from, to) {
  return Math.round((new Date(String(to) + 'T12:00:00Z') - new Date(String(from) + 'T12:00:00Z')) / 86400000);
}

/* Three things slipping, the Dashboard's Needs attention:
     - an open opportunity past its target close date (due today is not late yet);
     - a parked account whose revisit date has come or gone;
     - a lead scoring 70 or more that nobody has a contact at.
   Most pressing first inside each kind, in that order. `contactCount`, `fit` and `working` are the
   app's own readings of an account, passed in so this stays pure; "working" is in the pipeline. */
function attentionSignals(o) {
  const byId = {};
  o.offtakers.forEach(a => { byId[a.id] = a; });
  const nameOf = a => a.short || a.name;
  const overdue = [], revisit = [], lead = [];
  o.deals.forEach(d => {
    if (!d.closeDate || d.stage === 'closed' || d.stage === 'lost' || d.closeDate >= o.today) return;
    const a = byId[d.offtakerId];
    if (!a) return;
    const n = daysBetween(d.closeDate, o.today);
    overdue.push({ kind: 'overdue-deal', key: 'deal-' + d.id, accountId: a.id, account: nameOf(a), date: d.closeDate, badge: 'Close date',
      reason: 'Target close ' + fuDate(d.closeDate) + ', ' + n + ' day' + (n === 1 ? '' : 's') + ' ago' });
  });
  o.offtakers.forEach(a => {
    if (a.revisitDate && a.revisitDate <= o.today) {
      revisit.push({ kind: 'revisit-due', key: 'revisit-' + a.id, accountId: a.id, account: nameOf(a), date: a.revisitDate, badge: 'Revisit',
        reason: 'Revisit date ' + fuDate(a.revisitDate) + (a.revisitDate === o.today ? ' is today' : ' has passed') });
    }
    const f = o.fit(a);
    if (!o.working(a) && f >= 70 && a.status !== 'contracted' && a.status !== 'lost' && !o.contactCount(a.id)) {
      lead.push({ kind: 'no-contact', key: 'lead-' + a.id, accountId: a.id, account: nameOf(a), fit: f, badge: 'No contact',
        reason: 'Scores ' + f + ' and nobody is on file' });
    }
  });
  overdue.sort((x, y) => x.date.localeCompare(y.date));
  revisit.sort((x, y) => x.date.localeCompare(y.date));
  lead.sort((x, y) => y.fit - x.fit || x.account.localeCompare(y.account));
  return overdue.concat(revisit, lead);
}

/* The next follow-ups from today on, soonest first: what the Activity page groups as today, the
   next seven days and later. Nothing overdue; that is Needs attention's. */
function comingUp(items, today, n) {
  return items.filter(i => i.date && i.date >= today).slice().sort((a, b) => a.date.localeCompare(b.date)).slice(0, n);
}
function comingUpMore(items, today, n) {
  return Math.max(0, items.filter(i => i.date && i.date >= today).length - n);
}

/* ─── THE CALENDAR ────────────────────────────────────────────── */
/* A month is "YYYY-MM". Anything else is replaced by the default, so a stale or mistyped value
   can never leave the page with no month to show. */
function cleanMonth(ym, fallback) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(ym || '')) ? ym : fallback; }

function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return Math.floor(t / 12) + '-' + String((t % 12) + 1).padStart(2, '0');
}

/* The weeks a month calendar draws, Monday first. Days that belong to the month either side
   fill the first and last rows and are marked inMonth: false. */
function monthGrid(ym) {
  const [y, m] = ym.split('-').map(Number);
  const first = y + '-' + String(m).padStart(2, '0') + '-01';
  const lead = (new Date(first + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const rows = Math.ceil((lead + days) / 7);
  const start = addDays(first, -lead);
  const weeks = [];
  for (let w = 0; w < rows; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      week.push({ date, day: Number(date.slice(8)), inMonth: date.slice(0, 7) === ym });
    }
    weeks.push(week);
  }
  return { label: FU_MONTHS[m - 1] + ' ' + y, weeks };
}

/* { 'YYYY-MM-DD': { activity, due } } for every day that has a logged interaction or a
   follow-up. A day with neither is absent, and an interaction with no date is ignored. */
function calendarMarks(interactions, items) {
  const marks = {};
  const at = d => marks[d] || (marks[d] = { activity: 0, due: 0 });
  interactions.forEach(i => { if (i.date) at(i.date).activity++; });
  items.forEach(i => { if (i.date) at(i.date).due++; });
  return marks;
}
