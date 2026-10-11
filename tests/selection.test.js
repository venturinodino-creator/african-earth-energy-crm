/* Row selection, avatars and the export of exactly the rows asked for.
 *
 * Checks what a rep would meet: that ticking rows shows a bar with the count, that the
 * header box selects the page and nothing else, that the selection is dropped the moment
 * the page, a tab, a filter, the search or the page number changes, that Export selected
 * produces the page's own columns for the chosen rows only, and that the avatar beside a
 * name carries the right initials. Runs the real code from js/layout.js, js/selection.js,
 * js/core.js and js/views-municipalities.js in a sandbox, so no browser is needed.
 *
 *   node tests/selection.test.js
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
const fnOf = (src, name) => {
  const m = new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src);
  if (!m) throw new Error(name + ' not found');
  return m[0];
};

/* One sandbox with the layout builders, the selection module and the export row builders. */
function sandbox() {
  const downloads = [], toasts = [];
  const refreshed = { n: 0 };
  const elements = {};
  const ctx = vm.createContext({
    console, esc, JSON, icon: () => '',
    avatarColor: seed => '#A04A2A',
    toast: m => toasts.push(m), todayISO: () => '2026-10-11',
    downloadCSV: (file, rows) => downloads.push({ file, rows }),
    document: {
      getElementById: id => elements[id] || null,
      querySelectorAll: () => [],
    },
    state: {
      offtakers: [
        { id: 'o1', name: 'Alpha Mining', short: 'Alpha', sector: 'mining', province: 'Limpopo', city: 'Polokwane', website: '', annualGwh: 900, peakMw: 100, tariff: 1.3, supply: 'eskom', wheeling: 'yes', nmd: 120, status: 'prospect', priority: 'high', description: 'Big' },
        { id: 'o2', name: 'Beta Steel', short: 'Beta', sector: 'steel', province: 'Gauteng', city: 'Vereeniging', website: '', annualGwh: 400, peakMw: 50, tariff: 1.4, supply: 'municipal', wheeling: 'likely', nmd: 60, status: 'engaged', priority: 'medium', description: '' },
        { id: 'o3', name: 'Gamma Cement', short: 'Gamma', sector: 'cement', province: 'Gauteng', city: 'Pretoria', website: '', annualGwh: 200, peakMw: 20, tariff: 1.5, supply: 'eskom', wheeling: 'no', nmd: 25, status: 'prospect', priority: 'low', description: '' },
      ],
      contacts: [
        { id: 'c1', first: 'Thabo', last: 'Nkosi', title: 'CFO', dept: 'Finance', offtakerId: 'o1', email: 't@a.co.za', phone: '1', linkedin: '', role: 'decision', priority: 'high', status: 'active', notes: '' },
        { id: 'c2', first: 'Sipho', last: 'Dlamini', title: 'Buyer', dept: '', offtakerId: 'o2', email: 's@b.co.za', phone: '2', linkedin: '', role: 'gatekeeper', priority: 'low', status: 'active', notes: 'n' },
      ],
      deals: [
        { id: 'd1', name: 'Alpha PPA', offtakerId: 'o1', projectId: 'p1', stage: 'proposal', mw: 30, tariff: 1.2, tenor: 10, probability: 50, closeDate: '2026-12-01', notes: '' },
        { id: 'd2', name: 'Beta PPA', offtakerId: 'o2', projectId: 'p1', stage: 'negotiation', mw: 10, tariff: 1.1, tenor: 8, probability: 70, closeDate: '', notes: '' },
      ],
      interactions: [{ id: 'i1', offtakerId: 'o1' }],
    },
    SA_MUNICIPALITIES: [
      { id: 'mun_A', code: 'A', name: 'Alpha Metro', cat: 'A', province: 'Gauteng', seat: 'Alpha', districtName: '' },
      { id: 'mun_B', code: 'B', name: 'Beta Local', cat: 'B', province: 'Limpopo', seat: 'Beta', districtName: 'Beta District' },
    ],
    MUNI_CATEGORY_LONG: { A: 'Metropolitan', B: 'Local', C: 'District' },
    WHEELING_LABEL: { yes: 'Confirmed', likely: 'Likely', no: 'Not feasible' },
    STATUS_LABEL: { prospect: 'Prospect', engaged: 'Engaged' },
    PIPELINE_STAGES: [{ id: 'proposal', label: 'Proposal' }, { id: 'negotiation', label: 'Negotiation' }],
    sectorName: s => s.toUpperCase(),
    nearestProject: o => ({ project: { name: 'Site ' + o.id }, km: 12 }),
    fitScore: o => 70,
    getOfftaker: id => ctx.state.offtakers.find(o => o.id === id) || {},
    getAccount: id => ctx.state.offtakers.find(o => o.id === id) || {},
    provinceOfAccount: id => (ctx.state.offtakers.find(o => o.id === id) || {}).province || '',
    getProject: id => ({ name: 'Site One' }),
    dealAccount: d => ({ name: ctx.getOfftaker(d.offtakerId).name, kind: 'offtaker' }),
    dealAnnualValue: d => d.mw * 1000, dealLifetimeValue: d => d.mw * 10000, weightedValue: d => d.mw * 500,
    contactsFor: id => ctx.state.contacts.filter(c => c.offtakerId === id),
    interactionsFor: id => ctx.state.interactions.filter(i => i.offtakerId === id),
    pipelineAccounts: () => ctx.state.offtakers,
    isLiveDeal: () => true,
    __elements: elements,
  });
  vm.runInContext(read('js/layout.js') + '\n' + read('js/selection.js'), ctx);
  vm.runInContext([fnOf(read('js/core.js'), 'offtakerCsvRows'), fnOf(read('js/core.js'), 'contactCsvRows'), fnOf(read('js/core.js'), 'pipelineCsvRows')].join('\n'), ctx);
  vm.runInContext(fnOf(read('js/views-municipalities.js'), 'muniCsvRows'), ctx);
  ctx.__downloads = downloads; ctx.__toasts = toasts;
  return ctx;
}
const run = (ctx, code) => vm.runInContext(code, ctx);
/* Arrays built inside the sandbox have its prototype, which deepStrictEqual rejects. */
const same = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
const arr = (ctx, code) => JSON.parse(run(ctx, 'JSON.stringify(' + code + ')'));

console.log('\nInitials in the avatar');
const initialsOf = name => run(sandbox(), 'nameInitials(' + JSON.stringify(name) + ')');
test('a company takes the first letters of its first two words', () => {
  assert.strictEqual(initialsOf('Samancor Chrome — Middelburg'), 'SC');
  assert.strictEqual(initialsOf('Anglo American'), 'AA');
});
test('a bracketed short name is not counted as a word', () => {
  assert.strictEqual(initialsOf('African Rainbow Minerals (ARM)'), 'AR');
  assert.strictEqual(initialsOf('Impala Platinum (Implats)'), 'IP');
});
test('small joining words are skipped', () => {
  assert.strictEqual(initialsOf('City of Cape Town Metro'), 'CC');
  assert.strictEqual(initialsOf('The Eskom Group'), 'EG');
  assert.strictEqual(initialsOf('Q & A Holdings'), 'QA');
});
test('a one-word name takes its first two letters', () => assert.strictEqual(initialsOf('Sasol'), 'SA'));
test('a person is first and last', () => assert.strictEqual(initialsOf('Thabo Nkosi'), 'TN'));
test('an empty name still draws something', () => assert.strictEqual(initialsOf(''), '?'));
test('the tile shows the initials and is tinted from the name', () => {
  const h = run(sandbox(), "avatarTileHtml('Sasol')");
  assert.ok(/class="nm-tile"/.test(h) && h.includes('>SA<'), h);
  assert.ok(/#A04A2A/i.test(h), 'tinted from the name');
});
test('a name carrying markup never reaches the page as markup', () => {
  const h = run(sandbox(), "avatarTileHtml('<img src=x onerror=alert(1)> Co')");
  assert.ok(!/<img/i.test(h), h);
});

console.log('\nTicking rows');
test('nothing is selected to begin with, and no bar is drawn', () => {
  const c = sandbox();
  run(c, "selectionSync('offtakers', 'a')");
  assert.strictEqual(run(c, 'selectionCount()'), 0);
  assert.strictEqual(run(c, "selectionBarHtml('offtakers')"), '');
});
test('ticking a row selects it; ticking again clears it', () => {
  const c = sandbox();
  run(c, "selectionSync('offtakers', 'a'); selectionToggle('offtakers', 'o1', true)");
  assert.strictEqual(run(c, "selectionHas('o1')"), true);
  run(c, "selectionToggle('offtakers', 'o1', false)");
  assert.strictEqual(run(c, "selectionHas('o1')"), false);
});
test('the bar says how many, and offers Export selected and Clear', () => {
  const c = sandbox();
  run(c, "selectionSync('offtakers', 'a'); selectionToggle('offtakers', 'o1', true); selectionToggle('offtakers', 'o2', true)");
  const bar = run(c, "selectionBarHtml('offtakers')");
  assert.ok(/<b>2<\/b> selected/.test(bar), bar);
  assert.ok(/onclick="selectionExport\(\)"[\s\S]*?Export selected/.test(bar), 'Export selected missing');
  assert.ok(/onclick="selectionClear\(\)"[\s\S]*?Clear/.test(bar), 'Clear missing');
  assert.ok(!/delete|archive|status/i.test(bar.replace(/class="[^"]*"/g, '')), 'no bulk delete or edit offered');
});
test('the row box is checked when the row is selected, and clicking it does not open the row', () => {
  const c = sandbox();
  run(c, "selectionSync('offtakers', 'a'); selectionToggle('offtakers', 'o2', true)");
  const on = run(c, "selectionCellHtml('offtakers', 'o2', 'Beta')");
  const off = run(c, "selectionCellHtml('offtakers', 'o1', 'Alpha')");
  const isChecked = h => /<input[^>]*\schecked\s/.test(h);
  assert.ok(isChecked(on) && !isChecked(off));
  assert.ok(/event\.stopPropagation\(\)/.test(on), 'a click on the box must not navigate');
  assert.ok(/aria-label="Select Beta"/.test(on));
});

console.log('\nThe header box');
test('it selects exactly the rows on the page, and clears exactly them', () => {
  const c = sandbox();
  run(c, "selectionSync('offtakers', 'a'); selectionToggle('offtakers', 'elsewhere', true)");
  run(c, "selectionTogglePage('offtakers', ['o1','o2','o3'], true)");
  assert.deepStrictEqual(arr(c, 'Array.from(SELECTION.ids).sort()'), ['elsewhere', 'o1', 'o2', 'o3']);
  run(c, "selectionTogglePage('offtakers', ['o1','o2','o3'], false)");
  assert.deepStrictEqual(arr(c, 'Array.from(SELECTION.ids)'), ['elsewhere']);
});
test('it reads none, some or all of the page', () => {
  const c = sandbox();
  run(c, "selectionSync('offtakers', 'a')");
  assert.strictEqual(run(c, "selectionPageState(['o1','o2'])"), 'none');
  run(c, "selectionToggle('offtakers', 'o1', true)");
  assert.strictEqual(run(c, "selectionPageState(['o1','o2'])"), 'some');
  run(c, "selectionToggle('offtakers', 'o2', true)");
  assert.strictEqual(run(c, "selectionPageState(['o1','o2'])"), 'all');
  assert.strictEqual(run(c, 'selectionPageState([])'), 'none', 'an empty page is never "all"');
});
test('the header cell is a box that is checked only when every row is', () => {
  const c = sandbox();
  run(c, "selectionSync('offtakers', 'a'); selectionTogglePage('offtakers', ['o1','o2'], true)");
  const isChecked = h => /<input[^>]*\schecked\s/.test(h);
  assert.ok(isChecked(run(c, "selectionHeadCellHtml('offtakers', ['o1','o2'])")));
  assert.ok(!isChecked(run(c, "selectionHeadCellHtml('offtakers', ['o1','o2','o3'])")));
});

console.log('\nThe boxes on the page follow the selection');
/* A tiny page: three row boxes, a header box and the bar slot, as the DOM would hold them. */
function pageSandbox() {
  const c = sandbox();
  const rowBoxes = ['o1', 'o2', 'o3'].map(id => ({ dataset: { id }, checked: false }));
  const head = { checked: false, indeterminate: false };
  const slot = { innerHTML: '' };
  c.document.getElementById = id => (id === 'sel-bar' ? slot : null);
  c.document.querySelectorAll = sel => (sel === 'input.sel-row' ? rowBoxes : sel === 'input.sel-head' ? [head] : []);
  return { c, rowBoxes, head, slot };
}
test('the header box ticks every row box on the page, and unticking it clears them', () => {
  const { c, rowBoxes, head, slot } = pageSandbox();
  run(c, "selectionSync('offtakers', 'a'); selectionTogglePage('offtakers', ['o1','o2','o3'], true)");
  assert.deepStrictEqual(rowBoxes.map(b => b.checked), [true, true, true]);
  assert.strictEqual(head.checked, true);
  assert.ok(/<b>3<\/b> selected/.test(slot.innerHTML));
  run(c, "selectionTogglePage('offtakers', ['o1','o2','o3'], false)");
  assert.deepStrictEqual(rowBoxes.map(b => b.checked), [false, false, false]);
  assert.strictEqual(slot.innerHTML, '');
});
test('ticking some rows leaves the header box half-ticked, not ticked', () => {
  const { c, head } = pageSandbox();
  run(c, "selectionSync('offtakers', 'a'); selectionToggle('offtakers', 'o2', true)");
  assert.strictEqual(head.checked, false);
  assert.strictEqual(head.indeterminate, true);
});
test('Clear unticks every box, whatever the boxes said before', () => {
  const { c, rowBoxes, head } = pageSandbox();
  run(c, "selectionSync('offtakers', 'a'); selectionTogglePage('offtakers', ['o1','o2','o3'], true); selectionClear()");
  assert.deepStrictEqual(rowBoxes.map(b => b.checked), [false, false, false]);
  assert.strictEqual(head.checked, false);
  assert.strictEqual(head.indeterminate, false);
});
test('a box ticked by hand that the selection does not hold is put right, so the screen never lies', () => {
  const { c, rowBoxes } = pageSandbox();
  run(c, "selectionSync('offtakers', 'a')");
  rowBoxes[1].checked = true;
  run(c, 'selectionRefresh()');
  assert.strictEqual(rowBoxes[1].checked, false);
});

console.log('\nWhen the selection is dropped');
test('changing the list drops it', () => {
  const c = sandbox();
  run(c, "selectionSync('offtakers', 'a'); selectionToggle('offtakers', 'o1', true); selectionSync('contacts', 'a')");
  assert.strictEqual(run(c, 'selectionCount()'), 0);
});
test('changing what is showing (tab, filter, search or page number) drops it', () => {
  const c = sandbox();
  ['tab=archive', 'sector=mining', 'q=alp', 'page=2'].forEach(sig => {
    run(c, "selectionSync('offtakers', 'base'); selectionToggle('offtakers', 'o1', true)");
    assert.strictEqual(run(c, 'selectionCount()'), 1);
    run(c, "selectionSync('offtakers', " + JSON.stringify(sig) + ')');
    assert.strictEqual(run(c, 'selectionCount()'), 0, sig);
  });
});
test('re-drawing the same page keeps it, so ticking a row does not lose the others', () => {
  const c = sandbox();
  run(c, "selectionSync('offtakers', 'same'); selectionToggle('offtakers', 'o1', true); selectionSync('offtakers', 'same')");
  assert.strictEqual(run(c, 'selectionCount()'), 1);
});
test('Clear empties it', () => {
  const c = sandbox();
  run(c, "selectionSync('offtakers', 'a'); selectionTogglePage('offtakers', ['o1','o2'], true); selectionClear()");
  assert.strictEqual(run(c, 'selectionCount()'), 0);
});
test('a box ticked for one list is ignored if the list has changed under it', () => {
  const c = sandbox();
  run(c, "selectionSync('offtakers', 'a'); selectionToggle('offtakers', 'o1', true)");
  run(c, "selectionToggle('contacts', 'c1', true)");
  assert.deepStrictEqual(arr(c, 'Array.from(SELECTION.ids)'), ['c1'], 'ticking on another list starts that list afresh');
});

console.log('\nThe export rows');
test('off-taker rows keep the page export columns', () => {
  const rows = arr(sandbox(), 'offtakerCsvRows(state.offtakers.slice(0, 1))');
  assert.strictEqual(rows.length, 2);
  assert.deepStrictEqual(rows[0].slice(0, 6), ['id', 'name', 'short', 'sector', 'province', 'city']);
  assert.strictEqual(rows[0].length, rows[1].length);
  assert.strictEqual(rows[1][1], 'Alpha Mining');
  assert.strictEqual(rows[1][3], 'MINING');
  assert.strictEqual(rows[1][11], 'Confirmed');
});
test('contact rows carry the company, and an empty list is just the header', () => {
  const c = sandbox();
  const rows = arr(c, 'contactCsvRows(state.contacts)');
  assert.deepStrictEqual(rows[0].slice(0, 5), ['first', 'last', 'title', 'department', 'offtaker']);
  assert.strictEqual(rows[1][4], 'Alpha Mining');
  assert.strictEqual(arr(c, 'contactCsvRows([])').length, 1);
});
test('municipality rows are the reference columns plus what the team holds', () => {
  const rows = arr(sandbox(), 'muniCsvRows(SA_MUNICIPALITIES)');
  assert.deepStrictEqual(rows[0], ['code', 'name', 'category', 'province', 'seat', 'district', 'contacts', 'activity']);
  assert.deepStrictEqual(rows[1], ['A', 'Alpha Metro', 'Metropolitan', 'Gauteng', 'Alpha', '', 0, 0]);
});
test('opportunity rows carry the stage by name and the account', () => {
  const rows = arr(sandbox(), 'pipelineCsvRows(state.deals)');
  assert.strictEqual(rows[0][0], 'opportunity');
  assert.strictEqual(rows[1][1], 'Alpha Mining');
  assert.strictEqual(rows[1][5], 'Proposal');
});

console.log('\nExport selected');
test('it downloads only the chosen off-takers, with the page columns', () => {
  const c = sandbox();
  run(c, "selectionSync('offtakers', 'a'); selectionToggle('offtakers', 'o1', true); selectionToggle('offtakers', 'o3', true); selectionExport()");
  assert.strictEqual(c.__downloads.length, 1);
  assert.ok(/^aee-offtakers-selected-2026-10-11\.csv$/.test(c.__downloads[0].file), c.__downloads[0].file);
  const names = c.__downloads[0].rows.slice(1).map(r => r[1]);
  same(names, ['Alpha Mining', 'Gamma Cement']);
  assert.strictEqual(JSON.stringify(c.__downloads[0].rows[0]), JSON.stringify(arr(c, 'offtakerCsvRows([])[0]')));
  assert.ok(c.__toasts.some(t => /2/.test(t)));
});
test('it downloads only the chosen contacts', () => {
  const c = sandbox();
  run(c, "selectionSync('contacts', 'a'); selectionToggle('contacts', 'c2', true); selectionExport()");
  same(c.__downloads[0].rows.slice(1).map(r => r[1]), ['Dlamini']);
});
test('it downloads only the chosen municipalities', () => {
  const c = sandbox();
  run(c, "selectionSync('municipalities', 'a'); selectionToggle('municipalities', 'mun_B', true); selectionExport()");
  same(c.__downloads[0].rows.slice(1).map(r => r[1]), ['Beta Local']);
});
test('selected accounts export the opportunities open on them, and say so when there are none', () => {
  const c = sandbox();
  run(c, "selectionSync('pipeline', 'a'); selectionToggle('pipeline', 'o2', true); selectionExport()");
  same(c.__downloads[0].rows.slice(1).map(r => r[0]), ['Beta PPA']);
  const d = sandbox();
  run(d, "selectionSync('pipeline', 'a'); selectionToggle('pipeline', 'o3', true); selectionExport()");
  assert.strictEqual(d.__downloads.length, 0, 'no empty file is downloaded');
  assert.ok(d.__toasts.some(t => /no opportunit/i.test(t)));
});
test('with nothing selected it downloads nothing', () => {
  const c = sandbox();
  run(c, "selectionSync('offtakers', 'a'); selectionExport()");
  assert.strictEqual(c.__downloads.length, 0);
});

console.log('\nThe page Export says how many rows it holds');
test('the button carries the count and the call', () => {
  const h = run(sandbox(), "exportButtonHtml('exportContacts(contactsFiltered().list)', 12)");
  assert.ok(/onclick="exportContacts\(contactsFiltered\(\)\.list\)"/.test(h), h);
  assert.ok(/Export/.test(h) && /<span class="btn-n">12<\/span>/.test(h), h);
});

console.log('\nLeaving the page');
test('leaving a page drops its selection, so coming back to a list finds nothing ticked', () => {
  const { ctx } = require('./core-sandbox')({ files: ['js/selection.js'] });
  const exec = code => vm.runInContext(code, ctx);
  exec("render = () => {}; selectionRefresh = () => {}; selectionSync('contacts', 'sig'); selectionToggle('contacts', 'c1', true); selectionToggle('contacts', 'c2', true);");
  assert.strictEqual(exec('selectionCount()'), 2);
  exec("nav('dashboard')");
  assert.strictEqual(exec('selectionCount()'), 0, 'dropped by going to another page');
  exec("nav('contacts'); selectionSync('contacts', 'sig')");
  assert.strictEqual(exec('selectionCount()'), 0, 'and still empty on the way back to the same list with the same filters');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
