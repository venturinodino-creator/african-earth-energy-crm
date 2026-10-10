/* The off-taker Record page: a header card, then three columns.
 *
 * What a rep meets: the company's name, chips and every action in one header
 * card (the page header above it shrinks to a breadcrumb); then About with the
 * load facts and fit score | the sales stage, overview and contact list |
 * who is here (the seniority, reachability and stakeholder-ladder panel). A
 * lead shows Work it and no sales stage; an account in the pipeline shows the
 * sales stage and New opportunity. Org map takes the same header card. Runs
 * the real views against a stub book, no browser.
 *
 *   node tests/record-layout.test.js
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

const base = o => Object.assign({ id: 'a', name: 'Alpha Mining', short: 'Alpha', sector: 'mining', city: 'Sandton', province: 'Gauteng', website: 'https://alpha.co.za', description: 'Platinum miner.',
  annualGwh: 900, peakMw: 120, tariff: 1.3, status: 'prospect', priority: 'high', sfStage: '', blurb: 'First para.\n\nSecond para.', notes: 'Call after budget.', estimated: false, revisitDate: '' }, o);

function run(fnName, o, over) {
  const out = { page: null, content: '' };
  const state = Object.assign({ detailId: o.id, offtakers: [o], contacts: [{ id: 'c1', offtakerId: o.id, first: 'Pat', last: 'Roe', title: 'CEO', email: 'p@a.co.za', role: 'decision' }] }, over);
  const ctx = vm.createContext({
    console, window: {}, esc, num, fmtNum: v => String(Math.round(num(v))), icon: () => '', jsStr: v => esc(JSON.stringify(String(v == null ? '' : v))), safeHref: u => /^https?:/.test(u || '') ? u : '',
    getOfftaker: id => state.offtakers.find(x => x.id === id) || {}, fitScore: () => 72, fitColor: () => '#080', nearestProject: () => ({ km: 150, approx: false, project: { town: 'Middelburg' } }),
    distanceLabel: np => np ? np.km + ' km' : '—', contactsFor: id => state.contacts.filter(c => c.offtakerId === id), inPipeline: x => !!x.sfStage, sectorName: s => s,
    sectorIcon: () => '<svg class="si"></svg>', sectorBadge: s => '<span class="badge">' + s + '</span>', STATUS_LABEL: { prospect: 'Prospect', qualified: 'Qualified' },
    isUnworked: () => false, loadBandText: () => '40–90', loadFactor: () => 0.55, todayISO: () => '2026-10-10', initials: (a, b) => a[0] + b[0], avatarColor: () => '#555',
    sfPathCardHtml: () => '<div class="card sfpath">SFPATH</div>', contactMixHtml: () => '<div class="card mix">MIX</div>', contactsCardHtml: () => '<div class="card contacts-card">CONTACTS</div>',
    openEditOfftaker() {}, addToPipeline() {}, openAddDeal() {}, openAddContact() {}, openLogInteraction() {}, aeOrgRank: () => 1, aeIsExec: () => false, aeRoleRank: () => 1, AE_TIERS: [],
    setPage: (t, s, a, opts) => { out.page = { t, s, a, opts }; }, setContent: h => { out.content = h; }, state,
  });
  vm.runInContext(read('layout.js') + '\n' + read('views-offtakers.js') + '\n' + read('views-orgmap.js'), ctx);
  /* views-orgmap.js defines the real panels; the Record page only places them, so
     put the stand-ins back before rendering. The org map test keeps its real chart. */
  if (fnName === 'renderDetail') {
    vm.runInContext('contactMixHtml = () => \'<div class="card mix">MIX</div>\'; contactsCardHtml = () => \'<div class="card contacts-card">CONTACTS</div>\';', ctx);
  }
  vm.runInContext(fnName + '();', ctx);
  return out;
}
const lead = () => run('renderDetail', base({}));
const worked = () => run('renderDetail', base({ sfStage: 'proposal', status: 'qualified' }));

console.log('\nHeader card');
test('the page header shrinks to a breadcrumb: the title is not repeated and the actions moved', () => {
  const o = lead();
  assert.ok(o.page.opts && o.page.opts.record === true, 'setPage is told this is a record page');
  assert.strictEqual(o.page.a, '', 'no actions in the page header');
});
test('the card carries the name once, the chips and the description', () => {
  const o = lead();
  const head = o.content.slice(o.content.indexOf('class="record-head"'), o.content.indexOf('class="rec-grid"'));
  assert.strictEqual((head.match(/Alpha Mining/g) || []).length, 1);
  ['badge', 'Prospect', 'high priority', 'Website', 'Platinum miner.'].forEach(s => assert.ok(head.includes(s), 'head lacks ' + s));
});
test('every action is in the card: Org map, Log activity, Add contact, Edit', () => {
  const head = lead().content.slice(lead().content.indexOf('class="record-head"'), lead().content.indexOf('class="rec-grid"'));
  ['Org map', 'Log activity', 'Add contact', 'Edit'].forEach(s => assert.ok(head.includes(s), 'head lacks ' + s));
});
test('a lead offers Work it; an account in the pipeline offers New opportunity', () => {
  const l = lead().content, w = worked().content;
  assert.ok(l.includes('Work it') && !l.includes('New opportunity'));
  assert.ok(w.includes('New opportunity') && !w.includes('Work it'));
});

console.log('\nThree columns');
test('about, main and side, in that order', () => {
  const h = lead().content;
  const a = h.indexOf('rg-about'), m = h.indexOf('rg-main'), s = h.indexOf('rg-side');
  assert.ok(a > 0 && m > a && s > m, [a, m, s].join(','));
});
test('About holds the load facts and the fit score', () => {
  const h = lead().content, about = h.slice(h.indexOf('rg-about'), h.indexOf('rg-main'));
  ['GWh a year', 'Peak demand', 'Load factor', 'Current tariff', 'Fit score', '72/100', 'Nearest site', 'Middelburg', 'Sector', 'Location', 'Sandton'].forEach(s => assert.ok(about.includes(s), 'About lacks ' + s));
});
test('Main holds the overview and the contact list; Side holds who is here', () => {
  const h = lead().content, main = h.slice(h.indexOf('rg-main'), h.indexOf('rg-side')), side = h.slice(h.indexOf('rg-side'));
  assert.ok(main.includes('Company overview') && main.includes('First para.') && main.includes('Call after budget.') && main.includes('CONTACTS'));
  assert.ok(side.includes('MIX') && !main.includes('MIX'));
});
test('the sales stage leads Main for an account in the pipeline, and a lead has none', () => {
  const w = worked().content, l = lead().content;
  const wm = w.slice(w.indexOf('rg-main'), w.indexOf('rg-side'));
  assert.ok(wm.indexOf('SFPATH') >= 0 && wm.indexOf('SFPATH') < wm.indexOf('Company overview'));
  assert.ok(!l.includes('SFPATH'));
});
test('the old hero and metric tiles are gone', () => {
  const h = worked().content;
  assert.ok(!h.includes('detail-hero') && !h.includes('dh-metrics') && !h.includes('dh-metric'));
});
test('a record with no overview text simply has no overview card', () => {
  const o = run('renderDetail', base({ blurb: '', notes: '', phone: '', email: '' }));
  assert.ok(!o.content.includes('Company overview'));
});
test('an unsized company says its load is not established instead of a zero', () => {
  const o = run('renderDetail', base({ annualGwh: 0 }), {});
  assert.ok(!/undefined|NaN/.test(o.content));
});

console.log('\nOrg map');
test('the org map opens with the same header card, and Back to the account lives in it', () => {
  const o = run('renderOrgMap', base({}));
  assert.ok(o.content.includes('class="record-head"'));
  assert.ok(o.page.opts && o.page.opts.record === true);
  const head = o.content.slice(o.content.indexOf('class="record-head"'));
  assert.ok(head.includes('Back to the account') && head.includes('Add contact'));
  assert.ok(o.content.includes('orgmap-tree'), 'the chart itself is unchanged');
});
test('an org map with nobody on it still has the header card and the empty state', () => {
  const o = run('renderOrgMap', base({}), { contacts: [] });
  assert.ok(o.content.includes('class="record-head"') && o.content.includes('No contacts yet at Alpha'));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
