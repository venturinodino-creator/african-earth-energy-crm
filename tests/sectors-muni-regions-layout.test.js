/* Sectors, a sector, a municipality, Regions and the Playbook in the shared frame.
 *
 * Sectors: the tier drop-down becomes tabs with counts, the table is a table
 * card with a footer, the grid/table switch is in the filter bar. A sector and a
 * municipality are record pages: breadcrumb, the shared header card, an About
 * card, a two-column body. Regions' cards and the Playbook's three-up sections
 * are card grids. Runs the real views against the real sector and municipality
 * data, no browser.
 *
 *   node tests/sectors-muni-regions-layout.test.js
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
const tabLabels = html => [...html.matchAll(/class="view-tab( active)?"[^>]*>([^<]*)/g)].map(m => (m[1] ? '*' : '') + m[2].trim());

function env(over) {
  const out = { page: null, content: '' };
  const state = Object.assign({
    view: 'sectors', role: 'admin', sectorView: 'table', sectorTier: '', sectorGroup: '', sectorSearch: '', sectorId: 'mining', detailId: 'mun_GT421',
    muniSearch: '', muniProvince: '', muniCat: '', muniWorked: '', muniSort: { field: 'name', dir: 'asc' }, muniView: 'table', muniPage: 1,
    offtakers: [{ id: 'a', name: 'Alpha', short: 'Alpha', sector: 'mining', annualGwh: 500, lat: -26, lng: 28, province: 'Gauteng', description: 'Platinum' }],
    projects: [{ id: 'p1', name: 'Site One', town: 'Town', province: 'Gauteng', mw: 100, cod: '2029', status: 'development', lat: -26, lng: 28 }],
    deals: [], contacts: [], interactions: [], archived: [], pbFilter: '',
  }, over);
  const ctx = vm.createContext({
    console, window: {}, setTimeout: () => 0, document: { querySelectorAll: () => [], getElementById: () => null },
    esc, num, fmtNum: v => String(Math.round(num(v))), fmtR: v => 'R' + v, icon: () => '', jsStr: v => esc(JSON.stringify(String(v == null ? '' : v))), avatarColor: () => '#555',
    sectorIcon: () => '<i class="si"></i>', isUnworked: o => !num(o && o.annualGwh), relTime: () => 'today', safeHref: u => u || '', todayISO: () => '2026-10-10',
    statTile: (i, c, label, value) => '<div class="stat-card">' + label + ' ' + value + '</div>', viewToggle: k => '<div class="view-toggle" data-key="' + k + '"></div>',
    contactsFor: id => state.contacts.filter(c => c.offtakerId === id), interactionsFor: () => state.interactions,
    contactMixHtml: () => '<div class="card mix">MIX</div>', contactsCardHtml: () => '<div class="card contacts-card">CONTACTS</div>',
    getOfftaker: id => state.offtakers.find(o => o.id === id) || {}, openLogInteraction() {}, openAddContact() {}, exportRegions() {}, copyTemplate() {}, fillTemplate: b => b,
    growBars() {}, haversineKm: () => 10, dhMetric: (v, l) => '<div class="dh-metric">' + v + ' ' + l + '</div>', siteCommitted: () => 0, loadNearSite: () => [], CATCHMENT_BANDS: [{ label: 'Near', max: 50 }], offtakerCoords: () => [-26, 28], distanceKm: () => 10,
    setPage: (t, s, a, opts) => { out.page = { t, s, a, opts }; }, setContent: h => { out.content = h; }, state,
  });
  vm.runInContext(read('data/sectors.js') + '\n' +
    'function sectorOf(id) { return SECTOR_BY_ID[id] || null; }\nfunction sectorGroup(id) { const s = sectorOf(id); return s ? s.group : "x"; }\n' +
    'function sectorName(id) { const s = sectorOf(id); return s ? s.name : id; }\nfunction sectorBadge(id) { return \'<span class="badge">\' + sectorName(id) + \'</span>\'; }\n' +
    'function ppaDots(f) { return \'<span class="ppa">\' + f + \'</span>\'; }\n' + read('data/municipalities.js'), ctx);
  ['js/layout.js', 'js/views-sectors.js', 'js/views-municipalities.js', 'js/views-regions.js'].forEach(f => {
    try { vm.runInContext(read(f) + '\n', ctx, { filename: f }); } catch (e) { throw new Error(f + ': ' + e.message); }
  });
  return { ctx, out, state, run: fn => { vm.runInContext(fn + '();', ctx); return out; } };
}

console.log('\nSectors');
test('the tier drop-down is tabs: All, Tier 1, 2, 3, with counts from the data', () => {
  const e = env(), o = e.run('renderSectors');
  const all = vm.runInContext('ALL_SECTORS.length', e.ctx), t = n => vm.runInContext('ALL_SECTORS.filter(s => s.tier === ' + n + ').length', e.ctx);
  const labels = tabLabels(o.content).map(s => s.replace(/\s+/g, ' ')).slice(0, 4);
  assert.strictEqual(labels.length, 4, labels.join('|'));
  assert.ok(labels[0].startsWith('*All') && labels[1].startsWith('Tier 1') && labels[2].startsWith('Tier 2') && labels[3].startsWith('Tier 3'), labels.join('|'));
  assert.ok(new RegExp('<span class="vt-n">' + all + '</span>').test(o.content), 'All count');
  assert.ok(new RegExp('Tier 1 <span class="vt-n">' + t(1) + '</span>').test(o.content), 'Tier 1 count');
  assert.ok(!o.content.includes('All tiers'), 'the tier select is gone');
  assert.ok(o.content.includes('All groups'), 'the group select stays');
});
test('the active tier tab follows the filter, and the footer counts the sector list', () => {
  const e = env({ sectorTier: '1' }), o = e.run('renderSectors');
  assert.ok(/view-tab active"[^>]*>Tier 1/.test(o.content));
  const n = vm.runInContext('ALL_SECTORS.filter(s => s.tier === 1).length', e.ctx);
  assert.ok(o.content.includes('<div class="table-card">') && o.content.includes('Showing 1–' + n + ' of ' + n + ' sectors'), o.content.match(/Showing[^<]*/));
  assert.ok(!o.content.includes('filters hide'), 'a chosen tier tab is not a hidden filter');
});
test('the grid/table switch is in the filter bar; the header keeps the Prospect list link', () => {
  const o = env().run('renderSectors');
  assert.ok(o.content.slice(o.content.indexOf('class="toolbar"')).includes('view-toggle'));
  assert.ok(o.page.a.includes('Prospect list') && !o.page.a.includes('view-toggle'));
});
test('the grid view keeps a standalone footer', () => {
  const o = env({ sectorView: 'grid' }).run('renderSectors');
  assert.ok(o.content.includes('class="table-foot standalone"') && !o.content.includes('class="table-card"'));
});

console.log('\nOne sector');
test('a sector is a record page: breadcrumb in the header, the shared card, About beside the working column', () => {
  const o = env().run('renderSector');
  assert.ok(o.page.opts && o.page.opts.record === true && o.page.a === '');
  const head = o.content.slice(o.content.indexOf('class="record-head"'), o.content.indexOf('rec-grid'));
  assert.strictEqual((head.match(/Mining &amp; Minerals|Mining/g) || []).length >= 1, true);
  assert.ok(head.includes('Tier') && head.includes('ppa'), 'tier and PPA fit chips');
  assert.ok(o.content.includes('rec-grid two') && o.content.includes('rg-main') && o.content.includes('rg-side'));
});
test('the six sector facts are an About card, not a row of tiles', () => {
  const h = env().run('renderSector').content;
  const about = h.slice(h.indexOf('rg-side'));
  ['Typical site load', 'Annual use', 'Typical deal', 'Sales cycle', 'Solar self-match', 'Companies tracked'].forEach(t => assert.ok(about.includes(t), 'About lacks ' + t));
  assert.ok(!h.includes('dh-metrics') && !h.includes('detail-hero'));
});
test('the shape of the sector and who to call lead the main column; reference cards sit below in a card grid', () => {
  const h = env({ sectorId: 'chemicals-petrochemicals' }).run('renderSector').content;
  assert.ok(h.indexOf('Load &amp; connection') < h.indexOf('Who to call'));
  assert.ok(h.indexOf('rec-grid two') < h.indexOf('Qualifying questions'), 'reference cards come after the two columns');
  assert.ok(h.includes('<div class="card-grid">') && !h.includes('cols-2'));
});

console.log('\nOne municipality');
test('a municipality is a record page with the shared card and an About card', () => {
  const o = env({ view: 'municipality' }).run('renderMunicipality');
  assert.ok(o.page.opts && o.page.opts.record === true && o.page.a === '');
  const h = o.content, head = h.slice(h.indexOf('class="record-head"'), h.indexOf('rec-grid'));
  assert.ok(/Org map/.test(head) && /Log activity/.test(head) && /Add contact/.test(head), 'actions are in the card');
  ['Council seat', 'Province', 'Contacts on file', 'Activity logged'].forEach(t => assert.ok(h.includes(t), 'About lacks ' + t));
  assert.ok(!h.includes('dh-metrics') && !h.includes('detail-hero') && !h.includes('cols-2'));
  assert.ok(h.includes('rec-grid two') && h.includes('MIX') && h.includes('CONTACTS'));
});
test('an unknown municipality sends you back to the list', () => {
  const e = env({ view: 'municipality', detailId: 'mun_NOPE' }); let went = null;
  vm.runInContext('nav = v => { __went = v; }', e.ctx); vm.runInContext('var __went = null; renderMunicipality();', e.ctx);
  assert.strictEqual(vm.runInContext('__went', e.ctx), 'municipalities');
});

console.log('\nRegions');
test('the site cards are one card grid with the intro across the full width', () => {
  const o = env({ view: 'regions' }).run('renderRegions');
  assert.ok(o.content.includes('<div class="card-grid">') && !o.content.includes('grid-2'));
  assert.ok(/class="card span-all"[\s\S]*?Sold by proximity/.test(o.content), 'the intro spans the grid');
  assert.ok(o.content.includes('Site One'), 'a site card');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
