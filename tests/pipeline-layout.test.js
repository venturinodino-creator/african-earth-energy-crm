/* The Pipeline page in the shared frame.
 *
 * Board, Flow and Table are tabs under the page header; the KPI row follows
 * them on all three; the table sits in a table card with a footer; the Flow
 * cards are one card grid with the stage flow across the full width. The
 * header carries Export and New opportunity only. Runs the real view against
 * a small stub book, no browser.
 *
 *   node tests/pipeline-layout.test.js
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
const read = f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = v => Number(v) || 0;

const STAGES = ['prospecting', 'needs', 'proposal', 'negotiation', 'closed'].map((id, i) => ({ id, label: id[0].toUpperCase() + id.slice(1), hint: '', budget: 30 }));
const acct = (id, stage) => ({ id, name: 'Acct ' + id, short: 'Acct ' + id, sector: 'mining', city: 'Town', province: 'Gauteng', annualGwh: 100, peakMw: 10, status: 'engaged', sfStage: stage });

function run(over) {
  const out = { page: null, content: '' };
  const state = Object.assign({
    pipeView: 'accounts', pipeStalled: '', role: 'admin',
    offtakers: [acct('a', 'prospecting'), acct('b', 'proposal'), acct('c', 'proposal'), Object.assign(acct('d', ''), { status: 'prospect' })],
    deals: [{ id: 'd1', offtakerId: 'b', projectId: 'p1', stage: 'proposal', mw: 30, probability: 50 }],
    projects: [{ id: 'p1', name: 'Site', town: 'Town', mw: 100, status: 'development' }], interactions: [], contacts: [],
  }, over);
  const ctx = vm.createContext({
    ...scopeStubs(state), ...outreachVocab(),
    /* The org map's ladder, cut to two seats, and its rule for who fills one. */
    AE_LADDER: [{ k: 'energy', label: 'Energy / utilities', re: /energy/i }, { k: 'finance', label: 'CFO / finance', re: /cfo|financ/i }],
    aeSeatMatch: (seat, c) => seat.re.test((c && c.title) || ''),
    todayISO: () => '2026-10-13', contactsFor: id => state.contacts.filter(c => c.offtakerId === id),
    logsForAccount: o => state.interactions.filter(i => i.offtakerId === o.id), stageProbability: () => 25,
    sfPathHtml: o => '<div class="sfpath">PATH ' + o.id + '</div>', dwellSentenceHtml: () => '',
    entryMetaText: i => i.type, openLogInteraction() {}, nav() {},
    console, setTimeout: () => 0, document: { getElementById: () => null, querySelectorAll: () => [] }, esc, num, fmtNum: v => String(Math.round(num(v))), fmtR: v => 'R' + Math.round(num(v)), icon: () => '',
    jsStr: v => esc(JSON.stringify(String(v == null ? '' : v))), sectorName: s => s, STATUS_LABEL: { engaged: 'Engaged', prospect: 'Prospect' }, avatarColor: () => '#555',
    viewToggle: k => '<div class="view-toggle" data-key="' + k + '"></div>',
    SF_STAGES: STAGES, PIPELINE_STAGES: STAGES, LEGACY_STAGE_LABELS: {}, CAPACITY_FACTOR: 0.3,
    inPipeline: o => !!o.sfStage, pipelineAccounts: () => state.offtakers.filter(o => o.sfStage), sfStageFor: o => o.sfStage, sfStageIndex: id => STAGES.findIndex(s => s.id === id),
    sfIsClosedLost: () => false, sfStageOf: id => STAGES.find(s => s.id === id), sfStageBadge: o => '<span class="badge">' + o.sfStage + '</span>', isStalled: () => false, stageDwell: () => null,
    dwellChipHtml: () => '', stageMismatches: () => [], dealsFor: id => state.deals.filter(d => d.offtakerId === id), isUnworked: () => false, weightedValue: d => num(d.mw) * 1000 * num(d.probability) / 100,
    dealAnnualValue: d => num(d.mw) * 1000, fitScore: () => 70, fitColor: () => '#000', accountView: () => 'detail', daysSince: () => 5, relTime: () => 'today', openEditDeal() {}, removeFromPipeline() {},
    exportPipeline() {}, openAddDeal() {}, loadFinderCache() {}, refreshFinderFromServer() {},
    setPage: (t, s, a) => { out.page = { t, s, a }; }, setContent: h => { out.content = h; }, state,
  });
  vm.runInContext(read('layout.js') + '\n' + read('selection.js') + '\n' + read('views-dashboard.js') + '\n' + read('followups.js') + '\n' +
    read('outreach.js') + '\n' + read('views-pipeline.js') + '\nrenderPipeline();', ctx);
  return out;
}

console.log('\nTabs');
test('Board, Flow and Table are tabs above the KPI row, the active one marked', () => {
  const o = run({});
  const tabs = [...o.content.matchAll(/class="view-tab( active)?"[^>]*onclick="([^"]*)">([^<]*)/g)].map(m => (m[1] ? '*' : '') + m[3].trim());
  assert.deepStrictEqual(tabs, ['*Board', 'Flow', 'Table']);
  assert.ok(o.content.includes("setViewMode(&quot;pipeView&quot;,&quot;flow&quot;)") || o.content.includes("setViewMode('pipeView','flow')"), 'Flow tab switches the reading');
  assert.ok(o.content.indexOf('view-tabs') < o.content.indexOf('stats-grid'), 'tabs come before the KPI row');
});
test('the tab follows the chosen reading', () => {
  assert.ok(/view-tab active"[^>]*>Flow/.test(run({ pipeView: 'flow' }).content));
  assert.ok(/view-tab active"[^>]*>Table/.test(run({ pipeView: 'table' }).content));
});
test('the page header keeps Export and New opportunity, and the old switch is gone', () => {
  const o = run({});
  assert.ok(o.page.a.includes('Export') && o.page.a.includes('New opportunity'));
  assert.ok(!o.page.a.includes('view-toggle'));
});
test('the header subtitle and numbers are the book\'s', () => {
  const o = run({});
  assert.strictEqual(o.page.t, 'Pipeline');
  assert.ok(o.page.s.includes('3 accounts being worked') && o.page.s.includes('1 live opportunity'), o.page.s);
});

console.log('\nBoard');
test('the board keeps its stage columns under the KPI row', () => {
  const o = run({});
  assert.strictEqual((o.content.match(/class="kcol"/g) || []).length, 5);
  assert.ok(o.content.indexOf('stats-grid') < o.content.indexOf('class="kanban"'));
  assert.strictEqual((o.content.match(/class="pipeline-card"/g) || []).length, 3);
});
test('each card carries the company\'s avatar tile beside its name', () => {
  const o = run({});
  assert.strictEqual((o.content.match(/<div class="pc-name"><span class="nm-tile"/g) || []).length, 3);
});

console.log('\nOutreach on the board');
/* Acct a has two people: Jan (energy) emailed on 6 Oct with a follow-up due today and no
   reply, Pat (CFO) who replied. Acct b has nobody. */
const outreachBook = {
  contacts: [{ id: 'c1', offtakerId: 'a', first: 'Jan', last: 'Doe', title: 'Head of Energy' },
    { id: 'c2', offtakerId: 'a', first: 'Pat', last: 'Roe', title: 'CFO' }],
  interactions: [
    { id: 'i1', offtakerId: 'a', date: '2026-10-06', type: 'email', channel: 'email', contactIds: ['c1'], touchNo: 1, outcome: 'sent', followUpOn: '2026-10-13', summary: 'Email', createdAt: '1' },
    { id: 'i2', offtakerId: 'a', date: '2026-10-07', type: 'email', channel: 'email', contactIds: ['c2'], outcome: 'replied', summary: 'Pat replied', createdAt: '2' },
  ],
};
test('quick filters sit above the board, each with its count, All chosen', () => {
  const o = run(outreachBook);
  const chips = [...o.content.matchAll(/class="pf-chip( on)?"[^>]*>([^<]*)<span class="pf-n">(\d+)/g)].map(m => (m[1] ? '*' : '') + m[2].trim() + ' ' + m[3]);
  assert.deepStrictEqual(chips, ['*All 3', 'Chase due 1', 'No meeting yet 0', 'Stalled 0', 'Moved this week 0']);
  assert.ok(o.content.indexOf('pf-bar') < o.content.indexOf('class="kanban"'));
});
test('Chase due narrows the board to the accounts owed a follow-up', () => {
  const o = run(Object.assign({ pipeFilter: 'chase' }, outreachBook));
  assert.strictEqual((o.content.match(/class="pipeline-card"/g) || []).length, 1);
  assert.ok(o.content.includes('1 of 3 accounts shown'));
});
test('a card shows the seat bar, who is reached, the last touch and who to chase', () => {
  const o = run(outreachBook);
  const card = o.content.slice(o.content.indexOf('data-id="a"'), o.content.indexOf('data-id="a"') + 3000);
  assert.ok(card.includes('pc-seat s-contacted') && card.includes('pc-seat s-replied'), 'energy contacted, finance replied');
  assert.ok(card.includes('2 of 2 reached · 0 engaging'));
  assert.ok(card.includes('Email · replied'), 'the last touch');
  assert.ok(card.includes('class="pc-chase due">Chase Jan · today'), card.match(/pc-chase[^<]*/));
});
test('the KPI row adds touches this week, results this month and chase due', () => {
  const o = run(outreachBook);
  ['Touches this week', 'Results this month', 'Chase due'].forEach(t => assert.ok(o.content.includes(t), t));
  assert.ok(/Results this month<\/div><div class="stat-value">1</.test(o.content), 'one reply');
});
test('clicking a card opens the account panel beside the board', () => {
  const o = run(outreachBook);
  assert.ok(o.content.includes('onclick="openPipePanel(&quot;a&quot;)"') || o.content.includes("openPipePanel("), 'cards open the panel');
  assert.ok(!o.content.includes('pp-panel'), 'closed until one is clicked');
  const p = run(Object.assign({ pipePanel: 'a' }, outreachBook)).content;
  assert.ok(p.includes('class="pp-panel"') && p.includes('PATH a'), 'the panel with the sales path');
  ['Chase', 'Stakeholders', 'Touches and moves', 'Open record', 'Log touch'].forEach(t => assert.ok(p.includes(t), t));
  assert.ok(p.includes('Jan Doe') && p.includes('Contacted') && p.includes('Pat Roe') && p.includes('Replied'));
});

console.log('\nTable');
test('the table carries the outreach columns and sorts by its headers', () => {
  const o = run(Object.assign({ pipeView: 'table' }, outreachBook));
  ['Stakeholders', 'Last touch', 'Next step', 'This week'].forEach(t => assert.ok(o.content.includes('<th>' + t + '</th>'), t));
  assert.ok(o.content.includes('setPipeSort(&quot;days&quot;)') || o.content.includes('setPipeSort('), 'sortable headers');
  const order = s => [...s.matchAll(/class="link-btn"[^>]*>([^<]*)/g)].map(m => m[1]);
  assert.deepStrictEqual(order(o.content), ['Acct a', 'Acct b', 'Acct c'], 'stage order by default');
  assert.deepStrictEqual(order(run(Object.assign({ pipeView: 'table', pipeSort: 'stage', pipeSortDir: -1 }, outreachBook)).content), ['Acct b', 'Acct c', 'Acct a'], 'turned round');
});
test('the table is one card with a footer counting the accounts', () => {
  const o = run({ pipeView: 'table' });
  assert.ok(o.content.includes('<div class="table-card">') && o.content.includes('Showing 1–3 of 3 accounts'), o.content.match(/Showing[^<]*/));
  assert.strictEqual((o.content.match(/<tbody>[\s\S]*?<\/tbody>/)[0].match(/<tr>/g) || []).length, 3);
});

test('the table has an avatar tile and a box on every account, a header box, and the bar slot above the card', () => {
  const o = run({ pipeView: 'table' });
  assert.strictEqual((o.content.match(/class="nm-tile"/g) || []).length, 3);
  assert.ok(o.content.includes('class="sel-head"') && (o.content.match(/class="sel-row"/g) || []).length === 3);
  assert.ok(o.content.indexOf('id="sel-bar"') > -1 && o.content.indexOf('id="sel-bar"') < o.content.indexOf('class="table-card"'));
});
test('the page Export names the opportunities it holds and exports exactly those in scope', () => {
  const o = run({});
  assert.ok(/Export <span class="btn-n">1<\/span>/.test(o.page.a), o.page.a);
  assert.ok(o.page.a.includes('exportPipeline(scopedDeals())'));
});

console.log('\nFlow');
test('the flow cards are one card grid, the stage flow across the full width', () => {
  const o = run({ pipeView: 'flow' });
  assert.ok(o.content.includes('<div class="card-grid">'));
  assert.ok(/class="card span-all"[\s\S]*?Stage flow/.test(o.content), 'stage flow spans the grid');
  ['Stage flow', 'Where it stops', 'Movement, last 90 days'].forEach(t => assert.ok(o.content.includes(t), 'missing ' + t));
  assert.ok(!o.content.includes('grid-2') && !o.content.includes('margin-top:14px'), 'no ad-hoc layout left');
});

console.log('\nEmpty pipeline');
test('with nothing being worked the tabs and the empty state still show', () => {
  const o = run({ offtakers: [acct('d', '')], deals: [] });
  assert.ok(o.content.includes('view-tabs') && o.content.includes('Nothing is being worked yet'));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
