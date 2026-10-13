/* The Dashboard's layout: one KPI row, then every card in one even grid.
 *
 * What a rep meets: the five headline numbers in a single row, and below them
 * the six cards (call list, pipeline by stage, agents, recent activity,
 * addressable load by sector, capacity allocation) in one two-column grid, with
 * the page header carrying one link to Analytics instead of two buttons that
 * + New and the sidebar already offer. Runs renderDashboard against a small
 * stub book, so no browser is needed.
 *
 *   node tests/dashboard-layout.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const scopeStubs = require('./scope-stubs');
const outreachVocab = require('./outreach-vocab');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = v => Number(v) || 0;

function run(book) {
  const out = { page: null, content: '' };
  const state = Object.assign({ contactRuns: [], foundContacts: [] }, book);
  const ctx = vm.createContext({
    ...scopeStubs(state), ...outreachVocab(),
    console, setTimeout: () => 0, document: { querySelectorAll: () => [] },
    esc, num, fmtNum: v => String(Math.round(num(v))), fmtR: v => 'R' + Math.round(num(v)), icon: () => '', jsStr: v => JSON.stringify(String(v)),
    relTime: () => 'today', avatarColor: () => '#555', sectorName: s => s, STATUS_LABEL: { prospect: 'Prospect' },
    SF_STAGES: [{ id: 'prospecting', label: 'Prospecting', hint: '' }], PIPELINE_STAGES: [{ id: 'proposal', label: 'Proposal', hint: '' }],
    inPipeline: o => !!o.sfStage, pipelineAccounts: () => book.offtakers.filter(o => o.sfStage), sfStageFor: o => o.sfStage, isStalled: () => false,
    weightedValue: d => num(d.mw) * 1000, fitScore: () => 70, contactsFor: () => [], nearestProject: () => null, distanceLabel: () => '',
    getOfftaker: id => book.offtakers.find(o => o.id === id) || {}, openProject() {}, openOfftakersFiltered() {},
    loadFinderCache() {}, refreshFinderFromServer() {},
    todayISO: () => '2026-10-10', accountView: () => 'detail', avatarTileHtml: n => '<span class="nm-tile">' + esc(n.slice(0, 2).toUpperCase()) + '</span>',
    setPage: (t, s, a) => { out.page = { t, s, a }; }, setContent: h => { out.content = h; },
    state,
  });
  /* followups.js, outreach.js and views-activity.js are the shared follow-up logic and its row, which the Dashboard reuses. */
  ['views-dashboard', 'followups', 'outreach', 'views-activity'].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx));
  vm.runInContext('renderDashboard();', ctx);
  return out;
}

const book = {
  offtakers: [
    { id: 'a', name: 'Alpha Mining', short: 'Alpha', sector: 'mining', annualGwh: 900, tariff: 1.3, status: 'prospect', sfStage: 'prospecting' },
    { id: 'b', name: 'Beta Steel', short: 'Beta', sector: 'steel', annualGwh: 400, tariff: 1.4, status: 'prospect', sfStage: '' },
  ],
  deals: [{ id: 'd1', offtakerId: 'a', projectId: 'p1', stage: 'proposal', mw: 30 }],
  projects: [{ id: 'p1', name: 'Site One', town: 'Town', mw: 100, status: 'development' }],
  contacts: [{ id: 'c1', offtakerId: 'a', email: 'x@a.co.za' }, { id: 'c2', offtakerId: 'b', email: '' }],
  interactions: [{ id: 'i1', offtakerId: 'a', type: 'call', date: '2026-10-01', summary: 'Spoke' }],
};
const { page, content } = run(book);

test('the five headline numbers sit in one KPI row', () => {
  const row = content.slice(0, content.indexOf('<div class="card-grid">'));
  assert.ok(row.includes('<div class="stats-grid">'), 'no KPI row before the card grid');
  ['Companies tracked', 'Open pipeline', 'Weighted value', 'Capacity to sell', 'Contacts'].forEach(l => assert.ok(row.includes(l), 'missing KPI ' + l));
  assert.strictEqual((row.match(/class="stat-card"/g) || []).length, 5, 'expected exactly five KPI tiles');
  assert.ok(content.indexOf('stats-grid') < content.indexOf('card-grid'), 'the KPI row comes first');
});

test('all eight cards live in one card grid, the six that were there and the two new ones', () => {
  const grid = content.slice(content.indexOf('<div class="card-grid">'));
  ['Today\'s call list', 'Needs attention', 'Pipeline by stage', 'Coming up', 'Agents working for you', 'Recent activity', 'Addressable load by sector', 'Capacity allocation']
    .forEach(t => assert.ok(grid.includes(t), 'card grid lacks ' + t));
  assert.strictEqual((content.match(/class="card-grid"/g) || []).length, 1, 'one grid, not several');
});

test('Needs attention pairs with the call list, and Coming up with the pipeline', () => {
  const at = t => content.indexOf(t);
  assert.ok(at("Today's call list") < at('Needs attention') && at('Needs attention') < at('Pipeline by stage'));
  assert.ok(at('Pipeline by stage') < at('Coming up') && at('Coming up') < at('Agents working for you'));
});

/* Today is 2026-10-10. Alpha has an opportunity past its close date and one due in three days; Beta is a lead scoring 70 with nobody on file;
   Gamma was parked until the 1st; Delta has a revisit date next month. That makes three signals: Delta is not late. */
const attBook = {
  offtakers: [
    { id: 'a', name: 'Alpha Mining', short: 'Alpha', sector: 'mining', annualGwh: 900, tariff: 1.3, status: 'prospect', sfStage: 'prospecting' },
    { id: 'b', name: 'Beta Steel', short: 'Beta', sector: 'steel', annualGwh: 400, tariff: 1.4, status: 'prospect', sfStage: '' },
    { id: 'g', name: 'Gamma Cement', short: 'Gamma', sector: 'cement', annualGwh: 200, tariff: 1.4, status: 'prospect', sfStage: 'prospecting', revisitDate: '2026-10-01' },
    { id: 'd', name: 'Delta Foods', short: 'Delta', sector: 'food', annualGwh: 100, tariff: 1.4, status: 'prospect', sfStage: 'prospecting', revisitDate: '2026-11-15' },
  ],
  deals: [
    { id: 'p1', offtakerId: 'a', projectId: 'p1', stage: 'proposal', mw: 30, closeDate: '2026-10-07', name: 'Alpha late' },
    { id: 'p2', offtakerId: 'a', projectId: 'p1', stage: 'proposal', mw: 10, closeDate: '2026-10-13', name: 'Alpha soon' },
  ],
  projects: book.projects, contacts: [], interactions: [],
};
test('Needs attention lists each signal with an avatar, the account, the reason and a badge', () => {
  const c = run(attBook).content;
  const card = c.slice(c.indexOf('Needs attention'), c.indexOf('Pipeline by stage'));
  assert.ok(/3 signals/.test(card), String(card.match(/\d+ signals?/)));
  ['Target close 7 Oct 2026, 3 days ago', 'Revisit date 1 Oct 2026 has passed', 'Scores 70 and nobody is on file'].forEach(r => assert.ok(card.includes(r), r));
  ['Close date', 'Revisit', 'No contact'].forEach(b => assert.ok(card.includes('>' + b + '<'), b));
  assert.ok((card.match(/class="nm-tile"/g) || []).length >= 3, 'an avatar on each row');
  assert.ok(/onclick="nav\('detail',\{id:"a"\}\)"/.test(card), 'a row opens its account');
});
test('Needs attention says so when nothing is slipping', () => {
  const c = run(Object.assign({}, attBook, { deals: [], offtakers: attBook.offtakers.map(o => Object.assign({}, o, { revisitDate: '', sfStage: 'prospecting' })) })).content;
  assert.ok(c.includes('Nothing is slipping') && /0 signals/.test(c));
});
test('Coming up lists the next follow-ups from today, soonest first, and nothing overdue', () => {
  const c = run(attBook).content;
  const card = c.slice(c.indexOf('Coming up'), c.indexOf('Agents working for you'));
  assert.ok(card.includes('Alpha soon') && card.includes('15 Nov 2026') && card.includes('13 Oct 2026'));
  assert.ok(!card.includes('Alpha late'), 'an overdue opportunity is Needs attention\'s');
  assert.ok(card.indexOf('13 Oct 2026') < card.indexOf('15 Nov 2026'), 'soonest first');
  assert.ok(card.includes("nav('activity')") && card.includes('All follow-ups'));
});
test('Coming up says so when nothing is due ahead', () => {
  const c = run(Object.assign({}, attBook, { deals: [], offtakers: attBook.offtakers.map(o => Object.assign({}, o, { revisitDate: '' })) })).content;
  assert.ok(c.includes('Nothing is coming up'));
});
test('more than six signals show six and count the rest', () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ id: 'z' + i, name: 'Lead ' + i, short: 'Lead ' + i, sector: 'mining', annualGwh: 10, tariff: 1, status: 'prospect', sfStage: '' }));
  const c = run(Object.assign({}, attBook, { deals: [], offtakers: many })).content;
  const card = c.slice(c.indexOf('Needs attention'), c.indexOf('Pipeline by stage'));
  assert.ok(/9 signals/.test(card) && /And 3 more/.test(card));
  assert.strictEqual((card.match(/class="person-row"/g) || []).length, 6);
});
test('both cards read the province scope, so they match the lists', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'views-dashboard.js'), 'utf8');
  assert.ok(/attentionSignals\(\{\s*deals, offtakers,/.test(src), 'signals are built from the scoped deals and off-takers');
  assert.ok(/followUps\(deals, offtakers,/.test(src), 'follow-ups likewise');
});

test('the old ad-hoc arrangements are gone', () => {
  ['cols-2', 'grid-3', 'margin-top:14px'].forEach(c => assert.ok(!content.includes(c), 'leftover layout: ' + c));
});

test('the numbers on the KPIs are the book\'s', () => {
  assert.ok(/Companies tracked<\/div><div class="stat-value">2</.test(content), 'companies tracked');
  assert.ok(/Open pipeline<\/div><div class="stat-value">30 MW</.test(content), 'open pipeline');
  assert.ok(/Contacts<\/div><div class="stat-value">2</.test(content), 'contacts');
  assert.ok(content.includes('1 missing an email'));
});

test('the page header has the title, a subtitle and one Analytics link', () => {
  assert.strictEqual(page.t, 'Dashboard');
  assert.ok(page.s && page.s.length > 10);
  assert.ok(page.a.includes("nav('analytics')"), 'Open analytics link');
  assert.ok(!/Add offtaker|Savings calculator/.test(page.a), 'those two live in + New and the sidebar');
});

test('no page text says undefined or NaN', () => {
  assert.ok(!/undefined|NaN|\[object/.test(content + page.a));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
