/* Follow-ups and the calendar: what is due, when, and which days of a month have something on.
 *
 * A follow-up is a date the CRM already holds: an open opportunity's target close date, or an
 * off-taker's revisit date. Nothing is entered twice and nothing new is stored. These tests
 * check the grouping around today (overdue, today, the next seven days, later), the month grid a
 * calendar draws, and the marks on its days. Pure functions from js/followups.js, no browser.
 *
 *   node tests/followups.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
const same = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b));

const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'followups.js'), 'utf8'), ctx);
const call = (expr) => JSON.parse(vm.runInContext('JSON.stringify(' + expr + ')', ctx));

const stageLabel = 'id => ({ proposal: "Proposal", negotiation: "Negotiation" }[id] || id)';
const offtakers = [
  { id: 'o1', name: 'Alpha Mining (Pty) Ltd', short: 'Alpha', revisitDate: '2026-10-12' },
  { id: 'o2', name: 'Beta Steel', short: '', revisitDate: '' },
  { id: 'o3', name: 'Gamma Cement', short: 'Gamma', revisitDate: '2026-09-30' },
];
const deals = [
  { id: 'd1', offtakerId: 'o1', name: 'Alpha — 30 MW PPA', stage: 'proposal', mw: 30, closeDate: '2026-10-08' },
  { id: 'd2', offtakerId: 'o2', name: 'Beta — 10 MW PPA', stage: 'negotiation', mw: 10, closeDate: '2026-10-10' },
  { id: 'd3', offtakerId: 'o1', name: 'Alpha — closed', stage: 'closed', mw: 5, closeDate: '2026-10-09' },
  { id: 'd4', offtakerId: 'o3', name: 'Gamma — lost', stage: 'lost', mw: 5, closeDate: '2026-10-09' },
  { id: 'd5', offtakerId: 'o3', name: '', stage: 'proposal', mw: 20, closeDate: '' },
  { id: 'd6', offtakerId: 'o3', name: 'Gamma — later', stage: 'proposal', mw: 15, closeDate: '2026-12-01' },
];
const J = x => JSON.stringify(x);
const items = call('followUps(' + J(deals) + ', ' + J(offtakers) + ', ' + stageLabel + ')');

console.log('\nWhat is a follow-up');
test('an open opportunity with a target close date is one', () => {
  const d = items.filter(i => i.kind === 'deal').map(i => i.id);
  same(d.sort(), ['d1', 'd2', 'd6']);
});
test('a closed or lost opportunity is not, and one with no date is not', () => {
  const ids = items.filter(i => i.kind === 'deal').map(i => i.id);
  ['d3', 'd4', 'd5'].forEach(id => assert.ok(!ids.includes(id), id));
});
test('an off-taker with a revisit date is one', () => {
  same(items.filter(i => i.kind === 'revisit').map(i => i.accountId).sort(), ['o1', 'o3']);
});
test('each carries the account, a title, a detail and the date, and links to the account', () => {
  const d1 = items.find(i => i.id === 'd1');
  assert.strictEqual(d1.accountId, 'o1');
  assert.strictEqual(d1.account, 'Alpha');
  assert.strictEqual(d1.date, '2026-10-08');
  assert.ok(/30 MW/.test(d1.detail) && /Proposal/.test(d1.detail), d1.detail);
  const r = items.find(i => i.kind === 'revisit' && i.accountId === 'o1');
  assert.ok(/Revisit/.test(r.title));
});
test('an account with no short name is called by its name', () => {
  const x = call('followUps([{ id: "dx", offtakerId: "o2", name: "Beta — 10 MW PPA", stage: "proposal", mw: 10, closeDate: "2026-10-11" }], ' + J(offtakers) + ', ' + stageLabel + ')');
  assert.strictEqual(x[0].account, 'Beta Steel');
});
test('a deal on an account that is not in the list is left out rather than shown with no name', () => {
  const x = call('followUps([{ id: "dy", offtakerId: "ghost", name: "?", stage: "proposal", mw: 1, closeDate: "2026-10-11" }], ' + J(offtakers) + ', ' + stageLabel + ')');
  same(x.filter(i => i.kind === 'deal'), []);
});

console.log('\nGrouped around today');
const groups = call('groupFollowUps(followUps(' + J(deals) + ', ' + J(offtakers) + ', ' + stageLabel + '), "2026-10-10")');
const idsOf = key => groups.find(g => g.key === key).items.map(i => i.id || i.accountId);
test('there are four groups, in order, with their labels', () => {
  same(groups.map(g => g.key), ['overdue', 'today', 'next7', 'later']);
  same(groups.map(g => g.label), ['Overdue', 'Today', 'Next 7 days', 'Later']);
});
test('before today is overdue, oldest first', () => same(idsOf('overdue'), ['o3', 'd1']));
test('today is today', () => same(idsOf('today'), ['d2']));
test('tomorrow up to seven days on is the next 7 days', () => same(idsOf('next7'), ['o1']));
test('after that is later', () => same(idsOf('later'), ['d6']));
test('the seventh day out is still the next 7 days, the eighth is later', () => {
  const g = call('groupFollowUps([{ id: "a", date: "2026-10-17" }, { id: "b", date: "2026-10-18" }], "2026-10-10")');
  same(g.find(x => x.key === 'next7').items.map(i => i.id), ['a']);
  same(g.find(x => x.key === 'later').items.map(i => i.id), ['b']);
});
test('across a month end', () => {
  const g = call('groupFollowUps([{ id: "a", date: "2026-11-02" }], "2026-10-30")');
  same(g.find(x => x.key === 'next7').items.map(i => i.id), ['a']);
});
test('nothing is a list of four empty groups', () => same(call('groupFollowUps([], "2026-10-10")').map(g => g.items.length), [0, 0, 0, 0]));

console.log('\nDates');
test('adding days crosses months and years', () => {
  assert.strictEqual(call('addDays("2026-10-30", 3)'), '2026-11-02');
  assert.strictEqual(call('addDays("2026-12-30", 3)'), '2027-01-02');
  assert.strictEqual(call('addDays("2026-03-01", -1)'), '2026-02-28');
});
test('a date reads the way a person says it', () => {
  assert.strictEqual(call('fuDate("2026-10-08")'), '8 Oct 2026');
  assert.strictEqual(call('fuDate("")'), '');
});

console.log('\nThe month grid');
const grid = call('monthGrid("2026-10")');
test('it is titled with the month and year', () => assert.strictEqual(grid.label, 'October 2026'));
test('weeks start on Monday and every week has seven days', () => {
  assert.ok(grid.weeks.length >= 4 && grid.weeks.length <= 6);
  grid.weeks.forEach(w => assert.strictEqual(w.length, 7));
  assert.strictEqual(grid.weeks[0][0].date, '2026-09-28', '1 October 2026 is a Thursday, so the first row starts Monday 28 September');
});
test('days outside the month are marked, days inside are not', () => {
  assert.strictEqual(grid.weeks[0][0].inMonth, false);
  assert.strictEqual(grid.weeks[0][3].date, '2026-10-01');
  assert.strictEqual(grid.weeks[0][3].inMonth, true);
});
test('the days run on without a gap or a repeat', () => {
  const all = grid.weeks.flat().map(d => d.date);
  assert.strictEqual(new Set(all).size, all.length);
  for (let i = 1; i < all.length; i++) assert.strictEqual(call('addDays("' + all[i - 1] + '", 1)'), all[i]);
});
test('a month that starts on a Monday has no leading days, and February in a leap year has 29', () => {
  assert.strictEqual(call('monthGrid("2026-06")').weeks[0][0].date, '2026-06-01');
  const feb = call('monthGrid("2028-02")').weeks.flat().filter(d => d.inMonth);
  assert.strictEqual(feb.length, 29);
});
test('months step forward and back across a year', () => {
  assert.strictEqual(call('shiftMonth("2026-12", 1)'), '2027-01');
  assert.strictEqual(call('shiftMonth("2026-01", -1)'), '2025-12');
  assert.strictEqual(call('shiftMonth("2026-10", 0)'), '2026-10');
});
test('a bad month falls back to the one given as the default', () => {
  assert.strictEqual(call('cleanMonth("garbage", "2026-10")'), '2026-10');
  assert.strictEqual(call('cleanMonth("2026-07", "2026-10")'), '2026-07');
  assert.strictEqual(call('cleanMonth("2026-13", "2026-10")'), '2026-10');
});

console.log('\nThe marks on the days');
const marks = call('calendarMarks(' + J([{ date: '2026-10-08' }, { date: '2026-10-08' }, { date: '2026-10-02' }, { date: '' }]) + ', followUps(' + J(deals) + ', ' + J(offtakers) + ', ' + stageLabel + '))');
test('a day with logged activity says how many', () => {
  assert.strictEqual(marks['2026-10-08'].activity, 2);
  assert.strictEqual(marks['2026-10-02'].activity, 1);
});
test('a day with follow-ups due says how many', () => {
  assert.strictEqual(marks['2026-10-08'].due, 1);
  assert.strictEqual(marks['2026-10-10'].due, 1);
});
test('a day with neither has no mark at all, and an interaction with no date is ignored', () => {
  assert.strictEqual(marks['2026-10-20'], undefined);
  assert.strictEqual(marks[''], undefined);
});

console.log('\nNeeds attention');
/* Today is 2026-10-10. Accounts: a1 has a deal past its close date, a2 a deal due today, a3 a revisit date that has passed,
   a4 one due today, a5 one in the future, a6/a7 are leads scoring 80 and 72 with nobody on file, a8 a lead with a contact,
   a9 is in the pipeline, a10 is contracted, a11 scores 60. */
const accounts = [
  { id: 'a1', name: 'One Mining', short: 'One' }, { id: 'a2', name: 'Two Steel', short: 'Two' },
  { id: 'a3', name: 'Three Cement', short: 'Three', revisitDate: '2026-09-01' }, { id: 'a4', name: 'Four Chem', short: 'Four', revisitDate: '2026-10-10' },
  { id: 'a5', name: 'Five Glass', short: 'Five', revisitDate: '2026-11-01' },
  { id: 'a6', name: 'Six Smelting', short: 'Six', fit: 80 }, { id: 'a7', name: 'Seven Foods', short: 'Seven', fit: 72 },
  { id: 'a8', name: 'Eight Paper', short: 'Eight', fit: 90 }, { id: 'a9', name: 'Nine Ports', short: 'Nine', fit: 95, working: true },
  { id: 'a10', name: 'Ten Cars', short: 'Ten', fit: 99, status: 'contracted' }, { id: 'a11', name: 'Eleven Tyres', short: 'Eleven', fit: 60 },
];
const attDeals = [
  { id: 'x1', offtakerId: 'a1', name: 'One PPA', stage: 'proposal', mw: 10, closeDate: '2026-10-07' },
  { id: 'x2', offtakerId: 'a2', name: 'Two PPA', stage: 'proposal', mw: 10, closeDate: '2026-10-10' },
  { id: 'x3', offtakerId: 'a1', name: 'One old', stage: 'closed', mw: 10, closeDate: '2026-01-01' },
  { id: 'x4', offtakerId: 'a2', name: 'Two lost', stage: 'lost', mw: 10, closeDate: '2026-01-01' },
];
const signals = (over) => call('attentionSignals(Object.assign({ deals: ' + J(attDeals) + ', offtakers: ' + J(accounts) +
  ', today: "2026-10-10", contactCount: id => ({ a8: 2 }[id] || 0), fit: o => o.fit || 0, working: o => !!o.working }, ' + J(over || {}) + '))');
const kinds = s => s.map(x => x.kind + ':' + x.accountId);
test('an open opportunity past its target close date is a signal; one due today is not yet', () => {
  const s = signals();
  assert.ok(kinds(s).includes('overdue-deal:a1'));
  assert.ok(!kinds(s).includes('overdue-deal:a2'));
});
test('a closed or lost opportunity is never a signal, however old', () => {
  assert.ok(!signals().some(x => x.kind === 'overdue-deal' && x.accountId === 'a1' && /2026-01/.test(x.date)));
  assert.strictEqual(signals().filter(x => x.kind === 'overdue-deal').length, 1);
});
test('the reason says how long ago, in the singular and the plural', () => {
  assert.ok(/Target close 7 Oct 2026, 3 days ago/.test(signals().find(x => x.kind === 'overdue-deal').reason));
  const one = signals({ deals: [{ id: 'x9', offtakerId: 'a1', name: 'p', stage: 'proposal', mw: 1, closeDate: '2026-10-09' }] }).find(x => x.kind === 'overdue-deal');
  assert.ok(/1 day ago/.test(one.reason) && !/1 days/.test(one.reason), one.reason);
});
test('a revisit date that has passed, or is today, is a signal; a future one is not', () => {
  const s = kinds(signals());
  assert.ok(s.includes('revisit-due:a3') && s.includes('revisit-due:a4'));
  assert.ok(!s.includes('revisit-due:a5'));
});
test('the reason for a revisit says passed, or today', () => {
  const s = signals().filter(x => x.kind === 'revisit-due');
  assert.ok(/has passed/.test(s.find(x => x.accountId === 'a3').reason));
  assert.ok(/is today/.test(s.find(x => x.accountId === 'a4').reason));
});
test('a lead scoring 70 or more with nobody on file is a signal', () => {
  const s = kinds(signals());
  assert.ok(s.includes('no-contact:a6') && s.includes('no-contact:a7'));
});
test('not one with a contact, not one already in the pipeline, not a contracted one, not one under 70', () => {
  const s = kinds(signals());
  ['a8', 'a9', 'a10', 'a11'].forEach(id => assert.ok(!s.includes('no-contact:' + id), id));
});
test('a lead scoring exactly 70 counts, 69 does not', () => {
  const s = signals({ offtakers: [{ id: 'b1', name: 'B One', fit: 70 }, { id: 'b2', name: 'B Two', fit: 69 }], deals: [] });
  same(kinds(s), ['no-contact:b1']);
});
test('they come in order: overdue opportunities, then revisits, then leads, each most pressing first', () => {
  same(kinds(signals()), ['overdue-deal:a1', 'revisit-due:a3', 'revisit-due:a4', 'no-contact:a6', 'no-contact:a7']);
});
test('each carries the account, the badge and the reason, and never an undefined', () => {
  signals().forEach(x => {
    assert.ok(x.account && x.badge && x.reason && x.accountId, J(x));
    assert.ok(!/undefined|NaN/.test(J(x)));
  });
  same(signals().map(x => x.badge), ['Close date', 'Revisit', 'Revisit', 'No contact', 'No contact']);
});
test('nothing at all is no signals', () => same(signals({ deals: [], offtakers: [] }), []));

console.log('\nComing up');
const upcoming = (items, today, n) => call('comingUp(' + J(items) + ', "' + today + '", ' + n + ')');
test('it is what is due from today on, soonest first, and nothing overdue', () => {
  const rows = [{ key: 'a', date: '2026-10-05' }, { key: 'b', date: '2026-10-12' }, { key: 'c', date: '2026-10-10' }, { key: 'd', date: '2026-12-01' }];
  same(upcoming(rows, '2026-10-10', 10).map(i => i.key), ['c', 'b', 'd']);
});
test('it is capped, and says how many more there are', () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({ key: 'k' + i, date: '2026-11-0' + (i + 1) }));
  const u = upcoming(rows, '2026-10-10', 5);
  assert.strictEqual(u.length, 5);
  assert.strictEqual(call('comingUpMore(' + J(rows) + ', "2026-10-10", 5)'), 3);
});
test('it matches the follow-ups the Activity page groups as today, next 7 days and later', () => {
  const all = call('followUps(' + J(deals) + ', ' + J(offtakers) + ', ' + stageLabel + ')');
  const groups = call('groupFollowUps(' + J(all) + ', "2026-10-10")');
  const fromGroups = [].concat(...['today', 'next7', 'later'].map(k => groups.find(g => g.key === k).items)).map(i => i.key);
  same(upcoming(all, '2026-10-10', 100).map(i => i.key), fromGroups);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
