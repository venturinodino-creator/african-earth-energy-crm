/* The Map: a side panel of filters and a legend, with the map taking the rest.
 *
 * Checks what a rep would meet: that the panel lists AEE sites and each sector group as a
 * checklist (several at once, not one at a time), how many of each there are, how many are
 * plotted, that unticking one removes exactly those markers, that Show all and Hide all work,
 * that the legend says what size and colour mean, and that the map follows the province scope.
 * Runs the real view in a sandbox; the Leaflet map itself is not started.
 *
 *   node tests/map-layout.test.js
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

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = v => Number(v) || 0;
const text = h => h.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const same = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b));

const GROUPS = { 'heavy-industry': 'Heavy industry', manufacturing: 'Manufacturing', commercial: 'Commercial', digital: 'Digital',
  logistics: 'Logistics', 'utilities-public': 'Utilities and public', primary: 'Primary', emerging: 'Emerging' };
const SECTOR_TO_GROUP = { mining: 'primary', steel: 'heavy-industry', cement: 'heavy-industry', retail: 'commercial' };

const offtakers = [
  { id: 'o1', name: 'Alpha', sector: 'mining', province: 'Limpopo', annualGwh: 900 },
  { id: 'o2', name: 'Beta', sector: 'steel', province: 'Gauteng', annualGwh: 400 },
  { id: 'o3', name: 'Gamma', sector: 'cement', province: 'Gauteng', annualGwh: 200 },
  { id: 'o4', name: 'Delta', sector: 'retail', province: 'Gauteng', annualGwh: 50 },
];
const projects = [
  { id: 'p1', name: 'Site One', status: 'development', mw: 100, lat: -26, lng: 28, town: 'T', province: 'Gauteng', cod: '2028' },
  { id: 'p2', name: 'Site Two', status: 'development', mw: 80, lat: -25, lng: 29, town: 'U', province: 'Limpopo', cod: '2029' },
  { id: 'p3', name: 'Early Site', status: 'pipeline', mw: 40, lat: -24, lng: 30, town: 'V', province: 'Limpopo', cod: '2031' },
];

function env(over) {
  const out = { page: null, content: '', timers: [] };
  const state = Object.assign({ mapHidden: [], offtakers, projects }, over);
  const ctx = vm.createContext({
    console, esc, num, icon: () => '', fmtNum: v => String(Math.round(num(v))), state,
    setPage: (t, s, a) => { out.page = { t, s, a }; }, setContent: h => { out.content = h; },
    setTimeout: (fn, ms) => { out.timers.push(ms); return 0; },
    SECTOR_GROUPS: GROUPS, sectorGroup: s => SECTOR_TO_GROUP[s] || 'utilities-public',
    scopedOfftakers: () => state.offtakers, scopedProjects: () => state.projects,
    offtakerCoords: () => [-26, 28], fitScore: () => 70, sectorName: s => s, document: { documentElement: { dataset: {} } },
  });
  vm.runInContext(read('js/views-map.js'), ctx);
  return { ctx, out, state, run: fn => { vm.runInContext(fn + '();', ctx); return out; } };
}
const render = over => env(over).run('renderMap');
const checkboxes = c => [...c.matchAll(/<input type="checkbox" class="map-check"([^>]*)>/g)].map(m => ({
  key: /onchange="toggleMapShow\('([^']+)'\)"/.exec(m[1])[1], checked: /\schecked\b/.test(m[1]) }));

console.log('\nThe side panel');
test('the page is a panel and a map side by side, panel first, with the map taking the rest', () => {
  const o = render();
  assert.ok(o.content.includes('class="map-layout"'));
  assert.ok(o.content.indexOf('class="map-panel') < o.content.indexOf('id="map-canvas"'));
  assert.strictEqual(o.page.t, 'Map');
});
test('Show lists AEE sites first, then each sector group, one box each, all ticked to begin with', () => {
  const o = render();
  const boxes = checkboxes(o.content);
  same(boxes.map(b => b.key), ['projects'].concat(Object.keys(GROUPS)));
  assert.ok(boxes.every(b => b.checked));
});
test('each line says how many it holds', () => {
  const t = text(render().content);
  assert.ok(/AEE sites\s*2/.test(t), 'two sites on the map, the early-stage one is not');
  assert.ok(/Heavy industry\s*2/.test(t) && /Primary\s*1/.test(t) && /Commercial\s*1/.test(t) && /Digital\s*0/.test(t));
});
test('the plotted count is the off-takers and sites on the map', () => {
  assert.ok(/6 plotted/.test(text(render().content)));
});
test('the panel title carries the colour of each group, so the checklist is also the key', () => {
  const o = render();
  assert.ok(/class="map-dot" style="background:#C0452B"/.test(o.content), 'heavy industry colour');
  assert.ok(/class="map-dot" style="background:var\(--accent\)"/.test(o.content), 'AEE sites colour');
});

console.log('\nUnticking');
test('hiding a group removes its off-takers from the plotted count and unticks its box', () => {
  const o = render({ mapHidden: ['heavy-industry'] });
  assert.strictEqual(checkboxes(o.content).find(b => b.key === 'heavy-industry').checked, false);
  assert.ok(/4 plotted/.test(text(o.content)));
});
test('hiding the AEE sites removes the sites, and the groups stay', () => {
  const o = render({ mapHidden: ['projects'] });
  assert.ok(/4 plotted/.test(text(o.content)));
  assert.strictEqual(checkboxes(o.content).find(b => b.key === 'primary').checked, true);
});
test('several can be hidden at once, which the old one-at-a-time chips could not do', () => {
  const o = render({ mapHidden: ['projects', 'primary', 'commercial'] });
  assert.ok(/2 plotted/.test(text(o.content)), text(o.content).match(/\d+ plotted/));
});
test('a hidden group still shows its count, so you can see what you are leaving out', () => {
  assert.ok(/Heavy industry\s*2/.test(text(render({ mapHidden: ['heavy-industry'] }).content)));
});
test('toggling flips one key and leaves the rest', () => {
  const e = env();
  vm.runInContext("toggleMapShow('primary')", e.ctx);
  same(Array.from(e.state.mapHidden), ['primary']);
  vm.runInContext("toggleMapShow('commercial'); toggleMapShow('primary')", e.ctx);
  same(Array.from(e.state.mapHidden), ['commercial']);
});
test('Show all and Hide all', () => {
  const e = env({ mapHidden: ['primary'] });
  vm.runInContext("setMapShow('none')", e.ctx);
  same(Array.from(e.state.mapHidden).sort(), ['projects'].concat(Object.keys(GROUPS)).sort());
  vm.runInContext("setMapShow('all')", e.ctx);
  same(Array.from(e.state.mapHidden), []);
});
test('with everything hidden the panel says nothing is plotted, and the map is still there', () => {
  const o = render({ mapHidden: ['projects'].concat(Object.keys(GROUPS)) });
  assert.ok(/0 plotted/.test(text(o.content)) && o.content.includes('id="map-canvas"'));
});

console.log('\nWhat is plotted');
const plot = (over) => { const e = env(over); return JSON.parse(vm.runInContext("JSON.stringify(mapPlot(state.offtakers, state.projects, state.mapHidden))", e.ctx)); };
test('everything is plotted when nothing is hidden, except early-stage sites', () => {
  const p = plot();
  same(p.offtakers.map(o => o.id), ['o1', 'o2', 'o3', 'o4']);
  same(p.sites.map(s => s.id), ['p1', 'p2']);
});
test('hiding a group drops exactly its off-takers', () => same(plot({ mapHidden: ['heavy-industry'] }).offtakers.map(o => o.id), ['o1', 'o4']));
test('hiding the sites drops the sites and no off-taker', () => {
  const p = plot({ mapHidden: ['projects'] });
  same(p.sites, []);
  assert.strictEqual(p.offtakers.length, 4);
});
test('the group counts are by sector group', () => {
  const e = env();
  const c = JSON.parse(vm.runInContext("JSON.stringify(mapGroupCounts(state.offtakers))", e.ctx));
  assert.strictEqual(c['heavy-industry'], 2);
  assert.strictEqual(c.primary, 1);
  assert.strictEqual(c.digital, 0);
});

console.log('\nThe legend');
test('says what the size and the colour of a circle mean, and where a company with no coordinates goes', () => {
  const t = text(render().content);
  assert.ok(/size/i.test(t) && /annual consumption/i.test(t));
  assert.ok(/centre of their province/i.test(t));
});

console.log('\nThe province scope');
test('the panel counts what the scope leaves, nothing more', () => {
  const o = render({ offtakers: offtakers.filter(o => o.province === 'Limpopo'), projects: projects.filter(p => p.province === 'Limpopo') });
  assert.ok(/2 plotted/.test(text(o.content)), text(o.content).match(/\d+ plotted/));
  assert.ok(/Heavy industry\s*0/.test(text(o.content)));
});

console.log('\nThe map still starts');
test('drawing the page schedules the map, and the old single-choice chips are gone', () => {
  const o = render();
  assert.ok(o.timers.length === 1);
  assert.ok(!o.content.includes('map-legend-item') && !o.content.includes('setMapFilter'));
});
test('an empty book does not break the page', () => {
  const o = render({ offtakers: [], projects: [] });
  assert.ok(/0 plotted/.test(text(o.content)) && !/undefined|NaN/.test(o.content));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
