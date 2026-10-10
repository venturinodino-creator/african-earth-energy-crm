/* Municipalities and the Contact finder in the shared list frame.
 *
 * Municipalities: category tabs (All / Main / Metros / Districts / Locals)
 * above the filter bar, a table card whose footer counts and pages the list,
 * and the KPI row kept. Contact finder: the run set-up and the recent runs as
 * two cards, the review queue as a table card, and every header action leads
 * to a real page (the old "Prospect companies" button led nowhere).
 * Runs the real views against the real municipality data, no browser.
 *
 *   node tests/muni-finder-layout.test.js
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
const core = read('js/core.js');
const routerKeys = new Set([...(/function render\(\) \{\s*const views = \{([\s\S]*?)\n  \};/.exec(core)[1]).matchAll(/^\s*'?([a-z-]+)'?\s*:/gm)].map(m => m[1]));

function env(files, over) {
  const out = { page: null, content: '' };
  const state = Object.assign({
    muniSearch: '', muniProvince: '', muniCat: '', muniWorked: '', muniSort: { field: 'name', dir: 'asc' }, muniView: 'table', muniPage: 1,
    contacts: [], interactions: [], offtakers: [], foundContacts: [], contactRuns: [], role: 'admin',
    cfTarget: 'mining', cfRoles: ['decision'], cfProvince: '', cfShowAllRuns: false,
  }, over);
  const ctx = vm.createContext({
    console, esc, num, fmtNum: v => String(Math.round(num(v))), icon: () => '', jsStr: v => esc(JSON.stringify(String(v == null ? '' : v))), safeHref: u => /^https?:/.test(u || '') ? u : '',
    initials: (a, b) => (a || '')[0] + (b || '')[0], avatarColor: () => '#555', sortBy: l => l.slice(), thClass: () => 'sortable', sortArrow: () => '', toggleSort() {},
    viewToggle: k => '<div class="view-toggle" data-key="' + k + '"></div>', contactsFor: id => state.contacts.filter(c => c.offtakerId === id), interactionsFor: () => [],
    statTile: (i, c, label, value) => '<div class="stat-card">' + label + ' ' + value + '</div>', PER_PAGE: 20, setTimeout: () => 0,
    isMunicipalityId: id => String(id).startsWith('mun_'), sectorGroup: () => 'x', sectorName: s => s, loadFinderCache() {}, refreshFinderFromServer() {}, saveFinderState() {},
    ROLE_LABEL: { decision: 'Decision maker', influencer: 'Influencer', technical: 'Technical', gatekeeper: 'Gatekeeper' },
    setPage: (t, s, a) => { out.page = { t, s, a }; }, setContent: h => { out.content = h; }, state,
  });
  files.forEach(f => vm.runInContext(read(f) + '\n', ctx, { filename: f }));
  return { ctx, out, state, run: fn => { vm.runInContext(fn + '();', ctx); return { out, ctx, state }; } };
}
const MUNI = ['data/municipalities.js', 'js/layout.js', 'js/views-municipalities.js'];

console.log('\nMunicipalities');
{
  const probe = env(MUNI);
  const all = vm.runInContext('SA_MUNICIPALITIES.length', probe.ctx);
  const count = expr => vm.runInContext('SA_MUNICIPALITIES.filter(m => ' + expr + ').length', probe.ctx);
  test('category tabs sit above the filters, with counts from the data', () => {
    const { out } = env(MUNI).run('renderMunicipalities');
    const tabs = [...out.content.matchAll(/class="view-tab[^"]*"[^>]*>([^<]*)<span class="vt-n">(\d+)/g)].map(m => m[1].trim() + ' ' + m[2]);
    assert.deepStrictEqual(tabs, ['All ' + all, 'Main ' + count('m.main'), 'Metros ' + count("m.cat === 'A'"), 'Districts ' + count("m.cat === 'C'"), 'Locals ' + count("m.cat === 'B'")]);
    assert.ok(out.content.indexOf('view-tabs') < out.content.indexOf('class="toolbar"'));
  });
  test('the category tab is the category filter: the drop-down is gone, the other two stay', () => {
    const { out } = env(MUNI, { muniCat: 'A' }).run('renderMunicipalities');
    assert.ok(/view-tab active"[^>]*>Metros/.test(out.content), 'Metros tab is active');
    assert.ok(!out.content.includes('All categories'), 'category select removed');
    assert.ok(out.content.includes('All provinces') && out.content.includes('Worked or not'));
    assert.ok(out.content.includes('Showing 1–' + count("m.cat === 'A'") + ' of ' + count("m.cat === 'A'") + ' municipalities'), out.content.match(/Showing[^<]*/));
    assert.ok(!out.content.includes('filters hide'), 'a chosen tab is not a hidden filter');
    const searched = env(MUNI, { muniCat: 'A', muniProvince: 'Gauteng' }).run('renderMunicipalities').out.content;
    assert.ok(searched.includes('filters hide'), 'the province filter still counts as hiding rows');
  });
  test('the footer pages the whole list inside one table card', () => {
    const { out } = env(MUNI).run('renderMunicipalities');
    assert.ok(out.content.includes('<div class="table-card">'));
    assert.ok(out.content.includes('Showing 1–20 of ' + all + ' municipalities'), out.content.match(/Showing[^<]*/));
    assert.ok(out.content.includes('state.muniPage++;renderMunicipalities()'));
    assert.ok(!out.content.includes('class="pagination"'));
  });
  test('the five KPI tiles are kept', () => {
    const { out } = env(MUNI).run('renderMunicipalities');
    assert.strictEqual((out.content.match(/class="stat-card"/g) || []).length, 5);
    assert.ok(out.content.indexOf('stats-grid') < out.content.indexOf('view-tabs'));
  });
  test('the page header keeps Import and Export; the grid/table switch moved to the filter bar', () => {
    const { out } = env(MUNI).run('renderMunicipalities');
    assert.ok(out.page.a.includes('Import contacts') && out.page.a.includes('Export') && !out.page.a.includes('view-toggle'));
    assert.ok(out.content.slice(out.content.indexOf('class="toolbar"')).includes('view-toggle'));
  });
  test('a grid view keeps a footer and is not wrapped in a table card', () => {
    const { out } = env(MUNI, { muniView: 'grid' }).run('renderMunicipalities');
    assert.ok(out.content.includes('class="table-foot standalone"') && !out.content.includes('class="table-card"'));
  });
  test('searching for nothing says so and keeps the tabs', () => {
    const { out } = env(MUNI, { muniSearch: 'zzzzzz' }).run('renderMunicipalities');
    assert.ok(out.content.includes('No municipalities match') && out.content.includes('view-tabs'));
  });
}

console.log('\nContact finder');
{
  const FINDER = ['data/municipalities.js', 'js/layout.js', 'js/views-offtakers.js', 'js/views-municipalities.js', 'js/views-contactfinder.js'];
  const pendingFind = (i) => ({ id: 'f' + i, offtakerId: 'o1', first: 'Pat' + i, last: 'Roe', title: 'Manager', role: 'decision', email: 'p' + i + '@x.co.za', status: 'pending', source: 'https://x.co.za' });
  const book = { offtakers: [{ id: 'o1', name: 'Alpha', short: 'Alpha', sector: 'mining', province: 'Gauteng', status: 'prospect', sfStage: '' }] };
  const mk = (over) => {
    const e = env(FINDER, Object.assign({}, book, over));
    vm.runInContext('state.inPipelineStub = 1;', e.ctx);
    return e;
  };
  const defs = { inPipeline: 'o => !!o.sfStage', sectorIcon: '() => ""', sectorBadge: 's => s', sectorOptions: '() => ""', provinceChoices: '() => []', inProvince: '() => true', fitScore: '() => 70',
    finderAccountOf: "id => state.offtakers.find(o => o.id === id) || {}", STATUS_LABEL: '{ prospect: "Prospect" }', industryLabel: 's => s', todayISO: '() => "2026-10-10"', uid: 'p => p + "_1"', toast() {},
    provincesOf: 's => String(s || "").split("/").map(x => x.trim()).filter(Boolean)', muniOf: 'id => SA_MUNICIPALITIES.find(m => m.id === id)', pushContactRun() {}, removeRow() {} };
  const run = (over) => {
    const e = mk(over);
    Object.entries(defs).forEach(([k, v]) => { if (typeof v === 'string') vm.runInContext('var ' + k + ' = ' + v + ';', e.ctx); });
    return e.run('renderContactFinder');
  };
  test('every header action leads to a real page; the dead Prospect companies link is fixed', () => {
    const { out } = run({ foundContacts: [pendingFind(1)] });
    const targets = [...out.page.a.matchAll(/nav\('([a-z-]+)'/g)].map(m => m[1]);
    assert.ok(targets.length >= 1, 'no nav links found');
    targets.forEach(t => assert.ok(routerKeys.has(t), t + ' is not a page'));
    assert.ok(!out.page.a.includes('prospect-companies'));
    assert.ok(out.page.a.includes("nav('offtakers')") && out.page.a.includes('Off-taker Prospects'));
  });
  test('the run set-up and the recent runs are two cards in one grid', () => {
    const { out } = run({ foundContacts: [pendingFind(1)], contactRuns: [{ id: 'r1', status: 'done', industry: 'mining', offtakerIds: ['o1'], roles: ['decision'], found: 3, created: '2026-10-01' }] });
    assert.ok(out.content.includes('<div class="card-grid">'));
    assert.ok(out.content.includes('Next run') && out.content.includes('Recent runs'));
    assert.ok(out.content.includes('Next scrape target') && out.content.includes('Roles to find'));
  });
  test('the review queue is a table card with a footer', () => {
    const { out } = run({ foundContacts: [pendingFind(1), pendingFind(2)] });
    assert.ok(out.content.includes('<div class="table-card">'));
    assert.ok(out.content.includes('Showing 1–2 of 2 awaiting review'), out.content.match(/Showing[^<]*/));
    assert.ok(out.content.indexOf('card-grid') < out.content.indexOf('table-card'), 'set-up first, queue below');
  });
  test('with nothing pending the page still shows the set-up and the empty state', () => {
    const { out } = run({});
    assert.ok(out.content.includes('Next run') && out.content.includes('Nothing awaiting review') && !out.content.includes('table-card'));
  });
  test('with no runs yet the runs card says so', () => {
    const { out } = run({});
    assert.ok(/Recent runs[\s\S]*No runs yet/.test(out.content));
  });
}

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
