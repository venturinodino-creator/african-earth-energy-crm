/* The list pages' layout: view tabs, a filter bar, one table card with a footer.
 *
 * Off-taker Prospects and Contacts. What a rep meets: tabs above the filters
 * (Priority list / Archive; All / Decision maker / ...), the table inside a
 * single card, and a footer that says how much of the list is on screen and
 * pages it. Filters, sorts, columns and row actions are the old ones; only
 * where they sit has moved. Runs the real views against a stub book, no browser.
 *
 *   node tests/list-layout.test.js
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
const read = f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = v => Number(v) || 0;

function env(over) {
  const out = { page: null, content: '' };
  const state = Object.assign({
    offArchive: false, offSearch: '', offSector: '', offStatus: '', offProvince: '', offSort: { field: 'fit', dir: 'desc' }, offView: 'table', offPage: 1,
    contactSearch: '', contactOfftaker: '', contactRole: '', contactSort: { field: 'last', dir: 'asc' }, contactView: 'table', contactPage: 1,
    offtakers: [], archived: [], archivedContacts: [], contacts: [], foundContacts: [], contactRuns: [],
  }, over);
  const ctx = vm.createContext({
    console, esc, num, fmtNum: v => String(Math.round(num(v))), icon: () => '', jsStr: v => esc(JSON.stringify(String(v == null ? '' : v))), safeHref: u => /^https?:/.test(u || '') ? u : '',
    initials: (a, b) => (a || '')[0] + (b || '')[0], avatarColor: () => '#555', sectorIcon: () => '', sectorBadge: s => '<span class="badge">' + s + '</span>', sectorName: s => s,
    sectorOptions: () => '', STATUS_LABEL: { prospect: 'Prospect' }, fitScore: () => 70, fitColor: () => '#000', nearestProject: () => null, distanceLabel: () => '', loadFactor: () => 0.5,
    contactsFor: id => state.contacts.filter(c => c.offtakerId === id), inPipeline: o => !!o.sfStage, sortBy: l => l.slice(), thClass: () => 'sortable', sortArrow: () => '',
    toggleSort() {}, viewToggle: k => '<div class="view-toggle" data-key="' + k + '"></div>', provinceChoices: () => ['Gauteng'], inProvince: () => true,
    isMunicipalityId: id => String(id).startsWith('mun_'), accountView: () => 'detail', finderAccountOf: id => state.offtakers.find(o => o.id === id) || {},
    SA_MUNICIPALITIES: [], loadFinderCache() {}, refreshFinderFromServer() {}, growBars() {}, PER_PAGE: 20,
    setPage: (t, s, a) => { out.page = { t, s, a }; }, setContent: h => { out.content = h; }, state,
  });
  vm.runInContext(read('layout.js') + '\n' + read('views-offtakers.js'), ctx);
  return { ctx, out, state, run: fn => { vm.runInContext(fn + '();', ctx); return { out, ctx, state }; } };
}

const lead = (id, name) => ({ id, name, short: name, sector: 'mining', city: 'City', province: 'Gauteng', description: '', annualGwh: 100, peakMw: 10, tariff: 1.2, status: 'prospect', sfStage: '' });
const people = n => Array.from({ length: n }, (_, i) => ({
  id: 'c' + i, offtakerId: 'o1', first: 'Pat' + i, last: 'Roe' + String(i).padStart(2, '0'), title: 'Manager', dept: '', email: 'p' + i + '@x.co.za', phone: '',
  role: ['decision', 'influencer', 'technical', 'gatekeeper'][i % 4], priority: 'medium',
}));

console.log('\nShared builders');
{
  const e = env();
  const call = (name, arg) => vm.runInContext(name + '(' + JSON.stringify(arg) + ')', e.ctx);
  test('view tabs mark the active one and carry the count', () => {
    const h = call('viewTabsHtml', [{ label: 'All', count: 5, active: true, on: 'a()' }, { label: 'Hot <b>', count: 2, active: false, on: 'b()' }]);
    assert.ok(/class="view-tab active"[^>]*onclick="a\(\)">All <span class="vt-n">5<\/span>/.test(h));
    assert.ok(h.includes('Hot &lt;b&gt;'), 'labels are escaped');
    assert.strictEqual((h.match(/aria-selected="true"/g) || []).length, 1);
  });
  test('the footer says how much is on screen, and how much the filters hide', () => {
    assert.ok(call('tableFooterHtml', { from: 1, to: 20, total: 45, all: 45, noun: 'contacts', page: 1, pages: 3, prev: 'p()', next: 'n()' }).includes('Showing 1–20 of 45 contacts'));
    const f = call('tableFooterHtml', { from: 1, to: 3, total: 3, all: 57, noun: 'leads', page: 1, pages: 1 });
    assert.ok(f.includes('filters hide 54 of 57'));
    assert.ok(!f.includes('class="pager"'), 'no pager for one page');
    assert.ok(call('tableFooterHtml', { from: 0, to: 0, total: 0, all: 0, noun: 'leads', page: 1, pages: 0 }).includes('Showing 0 leads'));
  });
  test('the pager disables Prev on the first page and Next on the last', () => {
    const first = call('tableFooterHtml', { from: 1, to: 20, total: 45, all: 45, noun: 'x', page: 1, pages: 3, prev: 'p()', next: 'n()' });
    assert.ok(/<button class="pg-btn" disabled onclick="p\(\)">/.test(first));
    const last = call('tableFooterHtml', { from: 41, to: 45, total: 45, all: 45, noun: 'x', page: 3, pages: 3, prev: 'p()', next: 'n()' });
    assert.ok(/<button class="pg-btn" disabled onclick="n\(\)">/.test(last));
  });
}

console.log('\nOff-taker Prospects');
{
  const book = { offtakers: [lead('a', 'Alpha'), lead('b', 'Beta'), lead('c', 'Gamma'), Object.assign(lead('d', 'Delta'), { sfStage: 'prospecting' })], archived: [lead('x', 'Old Co')] };
  test('Priority list and Archive are tabs above the filters, with counts', () => {
    const { out } = env(book).run('renderOfftakers');
    assert.ok(/view-tab active"[^>]*onclick="setOffArchive\(false\)">Priority list <span class="vt-n">3<\/span>/.test(out.content), 'priority tab');
    assert.ok(/onclick="setOffArchive\(true\)">Archive <span class="vt-n">1<\/span>/.test(out.content), 'archive tab');
    assert.ok(out.content.indexOf('view-tabs') < out.content.indexOf('class="toolbar"'), 'tabs come before the filter bar');
  });
  test('the page header holds the page\'s actions, not the tabs or the view switch', () => {
    const { out } = env(book).run('renderOfftakers');
    assert.ok(out.page.a.includes('Import CSV') && out.page.a.includes('Export') && out.page.a.includes('Add offtaker'));
    assert.ok(!out.page.a.includes('Priority list') && !out.page.a.includes('view-toggle'));
  });
  test('the grid/table switch sits in the filter bar', () => {
    const { out } = env(book).run('renderOfftakers');
    const bar = out.content.slice(out.content.indexOf('class="toolbar"'), out.content.indexOf('class="table-card"'));
    assert.ok(bar.includes('view-toggle'), 'switch is in the filter bar');
  });
  test('the table is one card with a footer counting the leads', () => {
    const { out } = env(book).run('renderOfftakers');
    assert.ok(out.content.includes('<div class="table-card">') && out.content.includes('class="table-foot"'));
    assert.ok(out.content.includes('Showing 1–3 of 3 leads'), out.content.match(/Showing[^<]*/));
  });
  test('a search that hides rows says so in the footer', () => {
    const e = env(Object.assign({ offSearch: 'alp' }, book));
    e.ctx.state.offtakers.forEach(o => { o.name = o.name; });
    const { out } = e.run('renderOfftakers');
    assert.ok(out.content.includes('Showing 1 of 1 leads') || out.content.includes('Showing 1 of 1 lead'), out.content.match(/Showing[^<]*/));
    assert.ok(out.content.includes('filters hide 2 of 3'));
  });
  test('the Archive tab is active in the archive, with its own footer', () => {
    const { out } = env(Object.assign({ offArchive: true }, book)).run('renderOfftakers');
    assert.ok(/view-tab active"[^>]*onclick="setOffArchive\(true\)">Archive/.test(out.content));
    assert.ok(out.content.includes('class="table-foot"') && /Showing 1 of 1 archived compan/.test(out.content), out.content.match(/Showing[^<]*/));
  });
}

console.log('\nContacts');
{
  const book = { offtakers: [lead('o1', 'Alpha')], contacts: people(45) };
  test('role tabs sit above the filters: All, then each role, with counts', () => {
    const { out } = env(book).run('renderContacts');
    const tabs = [...out.content.matchAll(/class="view-tab[^"]*"[^>]*>([^<]*)<span class="vt-n">(\d+)/g)].map(m => m[1].trim() + ' ' + m[2]);
    assert.deepStrictEqual(tabs, ['All 45', 'Decision maker 12', 'Influencer 11', 'Technical 11', 'Gatekeeper 11']);
    assert.ok(out.content.indexOf('view-tabs') < out.content.indexOf('class="toolbar"'));
  });
  test('the role tab is the role filter: the old role drop-down is gone', () => {
    const { out } = env(Object.assign({ contactRole: 'technical' }, book)).run('renderContacts');
    assert.ok(/view-tab active"[^>]*>Technical/.test(out.content), 'Technical tab is active');
    assert.ok(!out.content.includes('All roles'), 'role select removed');
    assert.ok(out.content.includes('Showing 1–11 of 11 contacts'), out.content.match(/Showing[^<]*/));
  });
  test('the footer pages the list and the old pager is gone', () => {
    const { out } = env(book).run('renderContacts');
    assert.ok(out.content.includes('Showing 1–20 of 45 contacts'), out.content.match(/Showing[^<]*/));
    assert.ok(out.content.includes('1 / 3') && out.content.includes('state.contactPage++;renderContacts()'));
    assert.ok(!out.content.includes('class="pagination"'));
  });
  test('the page header keeps Import, Export and Add contact', () => {
    const { out } = env(book).run('renderContacts');
    assert.ok(out.page.a.includes('Import CSV') && out.page.a.includes('Export') && out.page.a.includes('Add contact'));
    assert.ok(!out.page.a.includes('view-toggle'), 'the grid/table switch moved into the filter bar');
  });
  test('a grid view keeps the footer too', () => {
    const { out } = env(Object.assign({ contactView: 'grid' }, book)).run('renderContacts');
    assert.ok(out.content.includes('class="table-foot standalone"') && out.content.includes('Showing 1–20 of 45 contacts'));
    assert.ok(!out.content.includes('class="table-card"'), 'a grid is not inside a table card');
  });
}

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
