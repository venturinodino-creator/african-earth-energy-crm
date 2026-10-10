/* What the province scope does to the pages that follow it.
 *
 * Checks the records each page is built from: that a province leaves only its own
 * off-takers, their deals, their people and their log entries; that a contact of a
 * municipality follows the municipality's province; that the shared pipeline
 * figures can be asked about a narrowed set without changing for the pages that do
 * not follow the scope; and that every page says whether it follows the switcher.
 * Runs the real functions from js/core.js and js/views-dashboard.js in a sandbox.
 *
 *   node tests/province-scope-pages.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const core = read('js/core.js');
const dash = read('js/views-dashboard.js');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
const same = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b));

function lift(src, re, what) {
  const m = re.exec(src);
  if (!m) throw new Error(what + ' not found');
  return m[0];
}
const fnOf = (src, name) => lift(src, new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'), name);
const oneLine = (src, name) => lift(src, new RegExp('function ' + name + '\\([^)]*\\) \\{[^\\n]*\\}'), name);

const CORE_PIECES = [
  lift(core, /const SA_PROVINCES = \[[\s\S]*?\];/, 'SA_PROVINCES'),
  lift(core, /const PROVINCE_ALIASES = \{[\s\S]*?\n\};/, 'PROVINCE_ALIASES'),
  fnOf(core, 'provinceFromText'), fnOf(core, 'provincesOf'), fnOf(core, 'provinceInScope'),
  oneLine(core, 'inScope'), fnOf(core, 'isMunicipalityId'),
  fnOf(core, 'provinceOfAccount'), oneLine(core, 'accountInScope'),
  oneLine(core, 'scopedOfftakers'), oneLine(core, 'scopedDeals'), oneLine(core, 'scopedContacts'),
  oneLine(core, 'scopedInteractions'), oneLine(core, 'scopedProjects'),
  lift(core, /const SCOPED_VIEWS = new Set\(\[[\s\S]*?\]\);/, 'SCOPED_VIEWS'),
  lift(core, /const UNSCOPED_VIEWS = new Set\(\[[\s\S]*?\]\);/, 'UNSCOPED_VIEWS'),
  fnOf(core, 'scopeNote'),
].join('\n');

const DASH_PIECES = [
  'const num = v => Number(v) || 0;',
  oneLine(dash, 'portfolioMw'), oneLine(dash, 'contractedMw'), oneLine(dash, 'isLiveDeal'),
  oneLine(dash, 'liveDeals'), oneLine(dash, 'pipelineMw'),
].join('\n');

/* A small book across three provinces, a municipality, and a company in two provinces. */
const BOOK = {
  offtakers: [
    { id: 'o_lim', name: 'Limpopo Mine', province: 'Limpopo' },
    { id: 'o_gp', name: 'Gauteng Smelter', province: 'Gauteng' },
    { id: 'o_two', name: 'Two Province Co', province: 'Mpumalanga / Limpopo' },
    { id: 'o_none', name: 'No Province Co', province: '' },
  ],
  deals: [
    { id: 'd1', offtakerId: 'o_lim', stage: 'proposal', mw: 30, projectId: 'p_lim' },
    { id: 'd2', offtakerId: 'o_gp', stage: 'closed', mw: 50, projectId: 'p_lim' },
    { id: 'd3', offtakerId: 'o_two', stage: 'negotiation', mw: 10, projectId: 'p_wc' },
    { id: 'd4', offtakerId: 'o_gp', stage: 'lost', mw: 99, projectId: 'p_wc' },
    { id: 'd5', offtakerId: 'ghost', stage: 'proposal', mw: 5, projectId: 'p_wc' },
  ],
  contacts: [
    { id: 'c1', offtakerId: 'o_lim' }, { id: 'c2', offtakerId: 'o_gp' },
    { id: 'c3', offtakerId: 'mun_LIM' }, { id: 'c4', offtakerId: 'mun_GP' },
    { id: 'c5', offtakerId: '' }, { id: 'c6', offtakerId: 'o_two' },
  ],
  interactions: [
    { id: 'i1', offtakerId: 'o_lim' }, { id: 'i2', offtakerId: 'o_gp' }, { id: 'i3', offtakerId: 'mun_LIM' },
  ],
  projects: [
    { id: 'p_lim', province: 'Limpopo', mw: 100, status: 'development' },
    { id: 'p_wc', province: 'Western Cape', mw: 60, status: 'development' },
    { id: 'p_early', province: 'Limpopo', mw: 40, status: 'pipeline' },
  ],
};
function sandbox(province) {
  const ctx = vm.createContext({
    console,
    MUNI_BY_ID: { mun_LIM: { id: 'mun_LIM', province: 'Limpopo' }, mun_GP: { id: 'mun_GP', province: 'Gauteng' } },
  });
  vm.runInContext(CORE_PIECES + '\n' + DASH_PIECES, ctx);
  ctx.state = JSON.parse(JSON.stringify(BOOK));
  ctx.state.province = province || '';
  ctx.state.archived = [];
  return ctx;
}
const ids = (ctx, expr) => Array.from(vm.runInContext(expr, ctx)).map(x => x.id);

console.log('\nWith no province nothing is narrowed');
test('every accessor hands back the whole set, not a copy', () => {
  const c = sandbox('');
  ['offtakers', 'deals', 'contacts', 'interactions', 'projects'].forEach(k => {
    const fn = 'scoped' + k[0].toUpperCase() + k.slice(1);
    assert.strictEqual(vm.runInContext(fn + '() === state.' + k, c), true, fn);
  });
});

console.log('\nWith a province');
test('off-takers: its own, plus any company that spans it', () =>
  same(ids(sandbox('Limpopo'), 'scopedOfftakers()'), ['o_lim', 'o_two']));
test('a company with no province is in no single province', () =>
  assert.ok(!ids(sandbox('Gauteng'), 'scopedOfftakers()').includes('o_none')));
test('deals follow the company they are open on', () =>
  same(ids(sandbox('Limpopo'), 'scopedDeals()'), ['d1', 'd3']));
test('a deal on a company that no longer exists is out of any province', () =>
  assert.ok(!ids(sandbox('Limpopo'), 'scopedDeals()').includes('d5')));
test('contacts follow their company, and a municipality contact follows the municipality', () =>
  same(ids(sandbox('Limpopo'), 'scopedContacts()'), ['c1', 'c3', 'c6']));
test('a contact filed under no company is in no single province', () =>
  assert.ok(!ids(sandbox('Gauteng'), 'scopedContacts()').includes('c5')));
test('log entries follow the account they are filed against', () =>
  same(ids(sandbox('Limpopo'), 'scopedInteractions()'), ['i1', 'i3']));
test('generation sites follow their own province', () =>
  same(ids(sandbox('Limpopo'), 'scopedProjects()'), ['p_lim', 'p_early']));
test('the same province in another spelling still matches', () => {
  const c = sandbox('KwaZulu-Natal');
  c.state.offtakers.push({ id: 'o_kzn', province: 'KZN' });
  assert.ok(ids(c, 'scopedOfftakers()').includes('o_kzn'));
});

console.log('\nThe pipeline figures can be asked about a narrowed set');
test('live deals leave out closed and lost, for any set given', () => {
  const c = sandbox('');
  same(ids(c, 'liveDeals()'), ['d1', 'd3', 'd5']);
  same(ids(c, "liveDeals(state.deals.filter(d => d.offtakerId === 'o_lim'))"), ['d1']);
});
test('pipeline MW and signed MW are the sum over the set given', () => {
  const c = sandbox('');
  assert.strictEqual(vm.runInContext('pipelineMw()', c), 45);
  assert.strictEqual(vm.runInContext('pipelineMw(scopedDeals())', c), 45);
  vm.runInContext("state.province = 'Limpopo'", c);
  assert.strictEqual(vm.runInContext('pipelineMw(scopedDeals())', c), 40);
  assert.strictEqual(vm.runInContext('contractedMw(scopedDeals())', c), 0);
  assert.strictEqual(vm.runInContext('contractedMw()', c), 50, 'unscoped pages still see every signed deal');
});
test('portfolio MW counts built and in-development sites, not early-stage, and can be asked about a subset', () => {
  const c = sandbox('');
  assert.strictEqual(vm.runInContext('portfolioMw()', c), 160);
  assert.strictEqual(vm.runInContext('portfolioMw(scopedProjects())', c), 160);
  vm.runInContext("state.province = 'Limpopo'", c);
  assert.strictEqual(vm.runInContext('portfolioMw(scopedProjects())', c), 100);
});

console.log('\nEvery page says whether it follows the switcher');
const note = (view, province) => vm.runInContext('scopeNote(' + JSON.stringify(view) + ', ' + JSON.stringify(province) + ')', sandbox(''));
const FOLLOW = ['dashboard', 'offtakers', 'contacts', 'municipalities', 'prospects', 'pipeline', 'activity', 'news', 'map'];
const IGNORE = ['projects', 'regions', 'sectors', 'analytics', 'agenthq', 'calculator', 'playbook'];
FOLLOW.forEach(v => test(v + ' names the province while one is chosen', () => assert.strictEqual(note(v, 'Limpopo'), 'Limpopo')));
IGNORE.forEach(v => test(v + ' says it shows all provinces while one is chosen', () => assert.strictEqual(note(v, 'Limpopo'), 'all provinces')));
test('with no province chosen no page adds anything', () => [].concat(FOLLOW, IGNORE).forEach(v => assert.strictEqual(note(v, ''), '')));
test('a record page is not labelled either way', () => ['detail', 'municipality', 'sector', 'project', 'org-map'].forEach(v => assert.strictEqual(note(v, 'Limpopo'), '')));

console.log('\nThe pages read the scoped sets');
const src = n => read('js/' + n + '.js');
test('the Dashboard counts scoped off-takers, deals, contacts and interactions', () => {
  const d = src('views-dashboard');
  ['scopedOfftakers()', 'scopedDeals()', 'scopedContacts()', 'scopedInteractions()', 'scopedProjects()'].forEach(s =>
    assert.ok(d.includes(s), 'views-dashboard.js should read ' + s));
  assert.ok(!/state\.contacts\b/.test(d), 'the Dashboard should not count state.contacts directly');
  assert.ok(!/state\.interactions\b/.test(d), 'the Dashboard should not list state.interactions directly');
});
test('Contacts reads scoped people and scoped companies', () => {
  const o = src('views-offtakers');
  const body = /function renderContacts\(\) \{[\s\S]*?\n\}/.exec(o)[0];
  assert.ok(body.includes('scopedContacts()'));
  assert.ok(!/state\.contacts\b/.test(body), 'renderContacts should not read state.contacts directly');
});
test('the Pipeline reads scoped deals', () => {
  const p = src('views-pipeline');
  assert.ok(p.includes('scopedDeals()'));
  assert.ok(!/liveDeals\(\)/.test(p), 'the Pipeline should ask liveDeals about the scoped set');
});
test('Activity and the Map read scoped sets', () => {
  const t = src('views-tools');
  const act = /function renderActivity\(\) \{[\s\S]*?\n\}/.exec(t)[0];
  assert.ok(act.includes('scopedInteractions()') && act.includes('scopedDeals()'));
  const map = /function initMap\(\) \{[\s\S]*?\n\}\n/.exec(t)[0];
  assert.ok(map.includes('scopedOfftakers()') && map.includes('scopedProjects()'));
});
test('changing the province drops a company filter that has fallen out of scope', () => {
  const body = /function onProvinceSwitch\([^)]*\) \{[\s\S]*?\n\}/.exec(core)[0];
  assert.ok(/contactOfftaker/.test(body));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
