/* Agent HQ, Activity, News and Analytics in the shared frame.
 *
 * Agent HQ: the KPI row, then its cards in one grid with Recent runs across the
 * full width. Activity: Timeline / Table are tabs, the log is a card (a table
 * card with a footer in table view), beside the target close dates. News: the
 * topic chips become view tabs with counts. Analytics: the four charts and
 * tables are one card grid with Funnel health across the full width. Runs the
 * real views against a small stub book, no browser.
 *
 *   node tests/misc-pages-layout.test.js
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
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = v => Number(v) || 0;
const ago = m => new Date(Date.now() - m * 60000).toISOString();

function env(over) {
  const out = { page: null, content: '' };
  const state = Object.assign({
    role: 'admin', view: 'agenthq', activityView: 'timeline', newsTopic: 'all', newsProvince: '', newsSearch: '',
    offtakers: [{ id: 'a', name: 'Alpha', short: 'Alpha', sector: 'mining', province: 'Gauteng', annualGwh: 500, tariff: 1.2, status: 'prospect', sfStage: '' }],
    deals: [{ id: 'd1', offtakerId: 'a', projectId: 'p1', stage: 'proposal', mw: 30, probability: 50, closeDate: '2026-12-01' }],
    interactions: [{ id: 'i1', offtakerId: 'a', type: 'call', date: '2026-10-01', summary: 'Spoke to the CFO' }, { id: 'i2', offtakerId: 'a', type: 'email', date: '2026-09-20', summary: 'Sent the deck' }],
    contacts: [], projects: [], archived: [],
    contactRuns: [{ id: 'r1', status: 'running', created: ago(10), claimedAt: ago(8), offtakerIds: ['a'], roles: ['decision'], found: 2, note: 'Gap run: 1 company' },
      { id: 'r2', status: 'done', created: ago(5000), finishedAt: ago(4900), offtakerIds: ['a'], roles: ['decision'], found: 3 }],
    foundContacts: [{ id: 'f1', runId: 'r1', status: 'pending', email: 'x@a.co.za' }],
  }, over);
  const ctx = vm.createContext({
    console, window: {}, setTimeout: () => 0, clearTimeout() {}, document: { querySelectorAll: () => [], getElementById: () => null },
    esc, num, fmtNum: v => String(Math.round(num(v))), fmtR: v => 'R' + Math.round(num(v)), icon: () => '', jsStr: v => esc(JSON.stringify(String(v == null ? '' : v))),
    safeHref: u => /^https?:/.test(u || '') ? u : '', todayISO: () => '2026-10-10', relTime: () => 'today', avatarColor: () => '#555', sectorName: s => s,
    getOfftaker: id => state.offtakers.find(o => o.id === id) || {}, fitScore: () => 70, weightedValue: d => num(d.mw) * 1000, STATUS_LABEL: { prospect: 'Prospect' },
    SECTOR_LABEL_MAP: { mining: 'Mining' }, PIPELINE_STAGES: [{ id: 'proposal', label: 'Proposal' }], statTile: (i, c, label, value) => '<div class="stat-card">' + label + ' ' + value + '</div>',
    viewToggle: k => '<div class="view-toggle" data-key="' + k + '"></div>', growBars() {}, loadFinderCache() {}, refreshFinderFromServer() {}, analyticsPageGuideHtml: () => '<div class="guide">GUIDE</div>',
    pmProjectFor: () => null, interactionsFor: () => [], exportNews() {}, openLogInteraction() {}, deleteInteraction() {},
    setPage: (t, s, a) => { out.page = { t, s, a }; }, setContent: h => { out.content = h; }, state,
    NEWS_AUTO: [{ id: 'n1', topic: 'renewable_energy', province: 'Multiple', date: '2026-10-09', title: 'Eskom launches', summary: '', url: 'https://x.co.za', auto: true }],
  });
  const files = ['js/layout.js', 'data/news.js', 'js/views-agenthq.js', 'js/views-news.js', 'js/views-tools.js'];
  files.forEach(f => { try { vm.runInContext(read(f) + '\n', ctx, { filename: f }); } catch (e) { throw new Error(f + ': ' + e.message); } });
  return { ctx, out, state, run: fn => { vm.runInContext(fn + '();', ctx); return out; } };
}
const tabLabels = html => [...html.matchAll(/class="view-tab( active)?"[^>]*>([^<]*)/g)].map(m => (m[1] ? '*' : '') + m[2].trim());

console.log('\nAgent HQ');
test('the KPI row comes first, then the cards in one grid with Recent runs across the full width', () => {
  const o = env().run('renderAgentHQ');
  assert.strictEqual((o.content.match(/class="stat-card"/g) || []).length, 4);
  assert.ok(o.content.indexOf('stats-grid') < o.content.indexOf('card-grid'));
  ['Agents', 'Working now', 'Recent runs'].forEach(t => assert.ok(o.content.includes(t), 'missing ' + t));
  assert.ok(/class="card span-all"[\s\S]*?Recent runs/.test(o.content), 'Recent runs spans the grid');
  assert.ok(!o.content.includes('margin-top:14px'), 'no ad-hoc spacing left');
});
test('Refresh stays in the page header and the footnote stays', () => {
  const o = env().run('renderAgentHQ');
  assert.ok(o.page.a.includes('Refresh'));
  assert.ok(o.content.includes('Updates every'));
});

console.log('\nActivity');
test('Timeline and Table are tabs; the header keeps only Log activity', () => {
  const o = env().run('renderActivity');
  assert.deepStrictEqual(tabLabels(o.content), ['*Timeline', 'Table']);
  assert.ok(o.page.a.includes('Log activity') && !o.page.a.includes('view-toggle'));
});
test('the timeline is the log card beside the target close dates, in one grid', () => {
  const o = env().run('renderActivity');
  assert.ok(o.content.includes('<div class="card-grid">') && !o.content.includes('cols-2'));
  assert.ok(o.content.includes('Interaction log') && o.content.includes('Target close dates'));
});
test('the table view is a table card with a footer, and the close dates follow', () => {
  const o = env({ activityView: 'table' }).run('renderActivity');
  assert.ok(/view-tab active"[^>]*>Table/.test(o.content));
  assert.ok(o.content.includes('<div class="table-card">') && o.content.includes('Showing 1–2 of 2 interactions'), o.content.match(/Showing[^<]*/));
  assert.ok(o.content.indexOf('table-card') < o.content.indexOf('Target close dates'));
});
test('with nothing logged the tabs and the empty state still show', () => {
  const o = env({ interactions: [] }).run('renderActivity');
  assert.ok(o.content.includes('view-tabs') && o.content.includes('Nothing logged yet'));
});

console.log('\nNews');
test('the topic chips are view tabs with counts: All Topics, Summary, then each topic', () => {
  const o = env({ view: 'news' }).run('renderNews');
  const labels = tabLabels(o.content);
  assert.strictEqual(labels[0], '*All Topics');
  assert.strictEqual(labels[1], 'Summary');
  assert.ok(labels.length > 3, labels.join(','));
  assert.ok(!o.content.includes('news-filter-btn') && !o.content.includes('news-summary-btn'), 'the old chips are gone');
  assert.ok(o.content.indexOf('view-tabs') < o.content.indexOf('class="toolbar"'));
});
test('choosing a topic marks its tab, and Summary still renders', () => {
  const t = env({ view: 'news', newsTopic: 'renewable_energy' }).run('renderNews');
  assert.ok(/view-tab active"[^>]*onclick="setNewsTopic\(&quot;renewable_energy|view-tab active"[^>]*onclick="setNewsTopic\('renewable_energy/.test(t.content), 'the topic tab is active');
  const s = env({ view: 'news', newsTopic: 'summary' }).run('renderNews');
  assert.ok(/view-tab active"[^>]*>Summary/.test(s.content) && !/undefined|NaN/.test(s.content));
});

console.log('\nAnalytics');
test('the four charts and tables are one card grid; Funnel health spans it', () => {
  const o = env({ view: 'analytics' }).run('renderAnalytics');
  assert.ok(o.content.includes('<div class="card-grid">') && !o.content.includes('grid-2'));
  ['Load by province', 'Load by sector', 'Fit score distribution', 'Where the value is'].forEach(t => assert.ok(o.content.includes(t), 'missing ' + t));
  assert.ok(/class="card span-all"[\s\S]*?Funnel health/.test(o.content), 'Funnel health spans the grid');
  assert.ok(!o.content.includes('margin-top:14px'), 'no ad-hoc spacing left');
});
test('the guide card and the four KPI tiles are kept, in that order', () => {
  const o = env({ view: 'analytics' }).run('renderAnalytics');
  assert.strictEqual((o.content.match(/class="stat-card"/g) || []).length, 4);
  assert.ok(o.content.indexOf('GUIDE') < o.content.indexOf('stats-grid'));
});

console.log('\nPlaybook');
test('the three-up sections are card grids, with no old grid-3 left', () => {
  const e = env({ view: 'playbook', pbFilter: '' });
  vm.runInContext(read('data/seed.js') + '\n' + read('data/sectors.js') + '\nthis.__pb = typeof PLAYBOOK !== "undefined";', e.ctx);
  const o = e.run('renderPlaybook');
  assert.ok((o.content.match(/class="card-grid three"/g) || []).length === 3, 'three card grids: shortlists, ladder, market context');
  assert.ok(!o.content.includes('grid-3'));
  assert.ok(o.content.includes('Scripts &amp; templates'));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
