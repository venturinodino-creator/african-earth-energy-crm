/* Two small things on every page's edge: the Analytics page's Export summary, and the search box's
 * "/" shortcut.
 *
 * Export summary must hold the same numbers the page shows, so the test runs the real page and reads
 * its four headline tiles, then reads the CSV the button would download. The shortcut must take a
 * "/" from anywhere that is not a field, and nothing else, so the test presses keys at the real
 * handler. Runs the real core.js and views in a vm; no browser needed.
 *
 *   node tests/analytics-search.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const makeSandbox = require('./core-sandbox');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* A document that remembers who listens for what, so a key press can be sent to the real handlers, and
   hands back the same stand-in element for the search box every time so what happens to it can be read. */
const noop = () => {};
const listeners = [];
const elements = {};
const stand = id => elements[id] || (elements[id] = {
  id, style: {}, value: '', focused: 0, blurred: 0, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  focus() { this.focused++; }, blur() { this.blurred++; }, addEventListener: noop, setAttribute: noop, querySelector: () => null,
  querySelectorAll: () => [], getAttribute: () => null, appendChild: noop, innerHTML: '', textContent: '', closest: () => null,
});
let overlayOpen = false;
const document = {
  getElementById: stand, createElement: () => stand('x'), querySelectorAll: () => [], body: stand('body'), documentElement: stand('html'),
  querySelector: sel => (sel === '.overlay.open' && overlayOpen ? stand('overlay') : null),
  addEventListener: (type, fn) => listeners.push([type, fn]),
};
const { ctx } = makeSandbox({ over: { document }, files: ['js/views-dashboard.js', 'js/views-tools.js'] });
vm.runInContext(`var __page = null, __html = '', __toasts = [], __downloads = [];
  setPage = (t, s, a) => { __page = { t, s, a }; }; setContent = h => { __html = h; };
  toast = (m, k) => { __toasts.push(m); }; downloadCSV = (name, rows) => { __downloads.push({ name, rows }); };
  analyticsPageGuideHtml = () => ''; growBars = () => {};`, ctx);
const ev = code => vm.runInContext(code, ctx);
const json = code => JSON.parse(JSON.stringify(ev(code)));

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

/* ─── ANALYTICS: EXPORT SUMMARY ───────────────────────────────── */
console.log('\nExport summary');
const BOOK = {
  offtakers: [
    { id: 'a', name: 'Alpha Mining', short: 'Alpha', sector: 'mining', annualGwh: 1234.56, tariff: 1.31, status: 'prospect', province: 'Gauteng', sfStage: '', estimated: false },
    { id: 'b', name: 'Beta Steel', short: 'Beta', sector: 'mining', annualGwh: 800.4, tariff: 1.52, status: 'engaged', province: 'Limpopo', sfStage: 'proposal', estimated: false },
    { id: 'c', name: 'Gamma Foods', short: 'Gamma', sector: 'mining', annualGwh: 77.7, tariff: 1.08, status: 'prospect', province: 'Gauteng', sfStage: '', estimated: false },
  ],
  deals: [
    { id: 'd1', offtakerId: 'a', stage: 'proposal', mw: 30, tariff: 1.3, tenor: 15, probability: 50, projectId: '' },
    { id: 'd2', offtakerId: 'b', stage: 'negotiation', mw: 12.5, tariff: 1.45, tenor: 10, probability: 70, projectId: '' },
  ],
};
function load(book) {
  ctx.__book = book;
  ev('state.offtakers = __book.offtakers; state.deals = __book.deals; state.contacts = []; state.interactions = []; state.projects = [];');
  ev('__page = null; __html = ""; __toasts = []; __downloads = []; renderAnalytics();');
}
const tile = label => {
  const html = ev('__html');
  const m = html.match(new RegExp('stat-label">' + label + '</div><div class="stat-value">([^<]*)</div><div class="stat-sub">([^<]*)<'));
  assert.ok(m, 'the page has a "' + label + '" tile');
  return { value: m[1], sub: m[2] };
};

test('the page offers Export summary', () => {
  load(BOOK);
  assert.ok(json('__page').a.includes('onclick="exportAnalyticsSummary()"') && json('__page').a.includes('Export summary'));
});
test('the CSV holds the page\'s four headline numbers, each as the page shows it', () => {
  load(BOOK);
  ev('exportAnalyticsSummary()');
  const d = json('__downloads')[0];
  assert.deepStrictEqual(d.rows[0], ['Measure', 'Value', 'Unit', 'Note']);
  const row = name => d.rows.find(r => r[0] === name);
  const gwh = tile('Addressable load'), tariff = tile('Weighted average tariff'), fit = tile('Average fit score'), pipe = tile('Weighted pipeline');
  assert.strictEqual(ev('fmtNum(' + row('Addressable load')[1] + ')') + ' GWh', gwh.value, 'load');
  assert.strictEqual('R' + row('Weighted average tariff')[1].toFixed(2), tariff.value, 'tariff');
  assert.strictEqual(row('Average fit score')[1] + '/100', fit.value, 'fit');
  assert.strictEqual(ev('fmtR(' + row('Weighted pipeline')[1] + ')'), pipe.value, 'pipeline');
  assert.ok(gwh.sub.includes('across tracked offtakers') && row('Addressable load')[3] === 'across 3 tracked off-takers');
  assert.strictEqual(row('Average fit score')[3], fit.sub.replace('offtakers', 'off-takers'), 'the fit note says what the page says');
});
test('each value is rounded as the page rounds it: whole GWh, whole rand, a fit out of 100, a tariff to the cent', () => {
  load(BOOK);
  ev('exportAnalyticsSummary()');
  const v = json('__downloads')[0].rows.slice(1).map(r => r[1]);
  assert.ok(Number.isInteger(v[0]) && Number.isInteger(v[2]) && Number.isInteger(v[3]), JSON.stringify(v));
  assert.strictEqual(Number(v[1].toFixed(2)), v[1], 'two decimals at most');
  assert.ok(v.every(x => typeof x === 'number'), 'numbers, so a spreadsheet can add them up');
});
test('the numbers are real ones, not zeros', () => {
  load(BOOK);
  const h = json('analyticsHeadlines(state.offtakers, state.deals)');
  assert.strictEqual(Math.round(h.gwh), 2113);
  assert.ok(h.tariff > 1.2 && h.tariff < 1.5);
  assert.ok(h.weighted > 0 && h.fit > 0 && h.companies === 3);
});
test('the file is named for the day, and a toast says it was made', () => {
  load(BOOK);
  ev('exportAnalyticsSummary()');
  assert.ok(/^aee-analytics-summary-\d{4}-\d{2}-\d{2}\.csv$/.test(json('__downloads')[0].name));
  assert.deepStrictEqual(json('__toasts'), ['Exported the analytics summary']);
});
test('the "Where the value is" table puts an avatar tile beside each company', () => {
  load(BOOK);
  const html = ev('__html');
  assert.strictEqual((html.match(/<td style="font-weight:700"><div class="name-cell"><span class="nm-tile"/g) || []).length, 2, 'one for each opportunity');
  assert.ok(/<span class="nm-tile"[^>]*>AM<\/span><span>Alpha<\/span>/.test(html), 'initials from the full name, label from the short one');
});
test('an empty book exports zeros, not NaN, and the page still draws', () => {
  load({ offtakers: [], deals: [] });
  ev('exportAnalyticsSummary()');
  const rows = json('__downloads')[0].rows;
  assert.deepStrictEqual(rows.slice(1).map(r => r[1]), [0, 0, 0, 0]);
  assert.ok(!/undefined|NaN/.test(JSON.stringify(rows) + ev('__html')));
});
test('a viewer can export the summary: it changes nothing', () => {
  load(BOOK);
  ev("state.role = 'viewer'");
  ev('exportAnalyticsSummary()');
  assert.strictEqual(json('__downloads').length, 1);
  assert.ok(!json('__page').a.includes('data-admin-only'), 'the button is not hidden from viewers');
});

/* ─── SEARCH: THE "/" SHORTCUT ────────────────────────────────── */
console.log('\nThe "/" shortcut');
const press = (key, target, mods) => {
  const e = Object.assign({ key, target, ctrlKey: false, metaKey: false, altKey: false, isComposing: false, prevented: false, preventDefault() { this.prevented = true; } }, mods);
  listeners.filter(l => l[0] === 'keydown').forEach(l => l[1](e));
  return e;
};
const search = () => stand('global-search-input');
const reset = () => { search().focused = 0; search().blurred = 0; search().value = ''; overlayOpen = false; stand('app-shell').style.display = ''; };

test('a "/" pressed outside any field focuses the search box, and is not typed into it', () => {
  reset();
  const e = press('/', { tagName: 'BODY' });
  assert.strictEqual(search().focused, 1);
  assert.strictEqual(e.prevented, true, 'the slash itself is swallowed');
  reset(); press('/', { tagName: 'DIV' }); press('/', { tagName: 'A' }); press('/', { tagName: 'BUTTON' });
  assert.strictEqual(search().focused, 3, 'from a page, a link or a button too');
});
test('a "/" typed in any field is left alone', () => {
  reset();
  ['INPUT', 'TEXTAREA', 'SELECT'].forEach(tagName => assert.strictEqual(press('/', { tagName }).prevented, false, tagName));
  assert.strictEqual(press('/', { tagName: 'DIV', isContentEditable: true }).prevented, false, 'an editable region');
  assert.strictEqual(search().focused, 0);
});
test('a tick box, radio or button takes no text, so "/" still reaches the search after a row is ticked', () => {
  reset();
  ['checkbox', 'radio', 'button', 'range', 'submit', 'color', 'file'].forEach(type => assert.strictEqual(press('/', { tagName: 'INPUT', type }).prevented, true, type));
  assert.strictEqual(search().focused, 7);
  reset();
  ['text', 'search', 'email', 'number', 'password', 'tel', 'url', 'TEXT', undefined].forEach(type =>
    assert.strictEqual(press('/', { tagName: 'INPUT', type }).prevented, false, 'a ' + type + ' field keeps its slash'));
  assert.strictEqual(search().focused, 0);
});
test('an open menu or the phone sidebar is closed first, so focus never lands behind it', () => {
  reset();
  ev('var __closed = 0, __sheet = []; closeMenus = () => { __closed++; }; toggleSidebar = v => { __sheet.push(v); };');
  press('/', { tagName: 'BODY' });
  assert.strictEqual(ev('__closed'), 1, 'the + New and account menus are closed');
  assert.deepStrictEqual(json('__sheet'), [false], 'and so is the sidebar sheet');
  assert.strictEqual(search().focused, 1);
  press('a', { tagName: 'BODY' }); press('/', { tagName: 'INPUT', type: 'text' });
  assert.strictEqual(ev('__closed'), 1, 'but another key, or a slash typed in a field, closes nothing');
});
test('a "/" with Ctrl, Cmd or Alt, or any other key, does nothing', () => {
  reset();
  press('/', { tagName: 'BODY' }, { ctrlKey: true }); press('/', { tagName: 'BODY' }, { metaKey: true }); press('/', { tagName: 'BODY' }, { altKey: true });
  ['a', '?', 'Enter', 'Escape', '7'].forEach(k => press(k, { tagName: 'BODY' }));
  assert.strictEqual(search().focused, 0);
});
test('a "/" while composing text, while a dialog or drawer is open, or before sign-in, is left alone', () => {
  reset();
  press('/', { tagName: 'BODY' }, { isComposing: true });
  overlayOpen = true; press('/', { tagName: 'BODY' }); overlayOpen = false;
  stand('app-shell').style.display = 'none'; press('/', { tagName: 'BODY' });
  assert.strictEqual(search().focused, 0);
  reset(); press('/', { tagName: 'BODY' });
  assert.strictEqual(search().focused, 1, 'and it works again once they are over');
});
ctx.__stand = stand;   // the real handler is run inside the vm, and is handed the search box's stand-in
test('Escape in the box clears it and lets go; any other key leaves it alone', () => {
  reset();
  search().value = 'sasol';
  ev("searchKey({ key: 'a', target: __stand('global-search-input') })");
  assert.strictEqual(search().value, 'sasol');
  assert.strictEqual(search().blurred, 0);
  ev("searchKey({ key: 'Escape', target: __stand('global-search-input') })");
  assert.strictEqual(search().value, '', 'cleared');
  assert.strictEqual(search().blurred, 1, 'and let go');
});

/* ─── THE MARKUP ──────────────────────────────────────────────── */
console.log('\nThe hint');
const html = read('index.html'), css = read('styles.css');
test('the search box shows "( / )", says the shortcut to a screen reader, and sends its keys to the handler', () => {
  assert.ok(html.includes('<span class="gs-hint" aria-hidden="true">( / )</span>'));
  assert.ok(/id="global-search-input"[^>]*aria-keyshortcuts="\/"/.test(html) && /id="global-search-input"[^>]*onkeydown="searchKey\(event\)"/.test(html));
  assert.ok(html.indexOf('id="global-search-input"') < html.indexOf('class="gs-hint"'), 'the hint follows the box, so CSS can hide it when the box is used');
});
test('the hint goes while the box has focus or text, and never shows on a touch screen', () => {
  assert.ok(/\.gs-input:focus~\.gs-hint,\.gs-input:not\(:placeholder-shown\)~\.gs-hint\{display:none\}/.test(css));
  assert.ok(/@media\(hover:none\)\{\.gs-hint\{display:none\}\}/.test(css));
  assert.ok(/\.gs-input\{[^}]*padding:9px 46px 9px 33px/.test(css), 'the text never runs under the hint');
  assert.ok(/\.gs-hint\{[^}]*color:var\(--muted2\)/.test(css), 'in the stronger of the two muted inks, which reads at 10.5px in both themes');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
