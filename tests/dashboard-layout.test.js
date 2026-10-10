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

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = v => Number(v) || 0;

function run(book) {
  const out = { page: null, content: '' };
  const ctx = vm.createContext({
    console, setTimeout: () => 0, document: { querySelectorAll: () => [] },
    esc, num, fmtNum: v => String(Math.round(num(v))), fmtR: v => 'R' + Math.round(num(v)), icon: () => '', jsStr: v => JSON.stringify(String(v)),
    relTime: () => 'today', avatarColor: () => '#555', sectorName: s => s, STATUS_LABEL: { prospect: 'Prospect' },
    SF_STAGES: [{ id: 'prospecting', label: 'Prospecting', hint: '' }], PIPELINE_STAGES: [{ id: 'proposal', label: 'Proposal', hint: '' }],
    inPipeline: o => !!o.sfStage, pipelineAccounts: () => book.offtakers.filter(o => o.sfStage), sfStageFor: o => o.sfStage, isStalled: () => false,
    weightedValue: d => num(d.mw) * 1000, fitScore: () => 70, contactsFor: () => [], nearestProject: () => null, distanceLabel: () => '',
    getOfftaker: id => book.offtakers.find(o => o.id === id) || {}, openProject() {}, openOfftakersFiltered() {},
    loadFinderCache() {}, refreshFinderFromServer() {},
    setPage: (t, s, a) => { out.page = { t, s, a }; }, setContent: h => { out.content = h; },
    state: Object.assign({ contactRuns: [], foundContacts: [] }, book),
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'views-dashboard.js'), 'utf8') + '\nrenderDashboard();', ctx);
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

test('all six cards live in one card grid', () => {
  const grid = content.slice(content.indexOf('<div class="card-grid">'));
  ['Today\'s call list', 'Pipeline by stage', 'Agents working for you', 'Recent activity', 'Addressable load by sector', 'Capacity allocation']
    .forEach(t => assert.ok(grid.includes(t), 'card grid lacks ' + t));
  assert.strictEqual((content.match(/class="card-grid"/g) || []).length, 1, 'one grid, not several');
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
