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
