/* Tests for the shared helpers in js/core.js: reading numbers the way people
 * write them, reading CSV files the way South African Excel saves them, and
 * matching companies that span several provinces.
 *
 *   node tests/core-utils.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const noop = () => {};
const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, addEventListener: noop, appendChild: noop, setAttribute: noop, querySelector: () => null, querySelectorAll: () => [], getAttribute: () => null, innerHTML: '', innerText: '', textContent: '', value: '' });
const ctx = vm.createContext({
  console, setTimeout: noop, clearTimeout: noop, setInterval: noop,
  document: { getElementById: () => el(), createElement: () => el(), querySelector: () => el(), querySelectorAll: () => [], addEventListener: noop, body: el(), documentElement: el() },
  window: { addEventListener: noop, matchMedia: () => ({ matches: false }), location: { search: '', pathname: '/' }, localStorage: { getItem: () => null, setItem: noop } },
  localStorage: { getItem: () => null, setItem: noop }, location: { search: '', pathname: '/' }, history: { state: null, pushState: noop }, addEventListener: noop,
  navigator: { userAgent: 'node' }, matchMedia: () => ({ matches: false }), Intl, URLSearchParams, URL, fetch: async () => ({ ok: false }), CSS: { escape: s => s },
});
for (const f of ['data/sectors.js', 'data/seed.js', 'data/municipalities.js', 'js/icons.js', 'js/supabase.js', 'js/core.js', 'js/followups.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8') + '\n', ctx, { filename: f });
}
const run = code => JSON.parse(JSON.stringify(vm.runInContext(code, ctx)));

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

test('a number is read however it is written: spaces, decimal comma, thousands comma', () => {
  assert.strictEqual(run('num("1 200")'), 1200);
  assert.strictEqual(run('num("1\\u00a0200")'), 1200, 'a non-breaking space, as Excel writes');
  assert.strictEqual(run('num("3,5")'), 3.5);
  assert.strictEqual(run('num("1 200,5")'), 1200.5);
  assert.strictEqual(run('num("1,200")'), 1200, 'three digits after a comma are thousands');
  assert.strictEqual(run('num("1,234,567.89")'), 1234567.89);
  assert.strictEqual(run('num("1.234,56")'), 1234.56);
  assert.strictEqual(run('num("-4,5")'), -4.5);
  assert.strictEqual(run('num("12.5")'), 12.5);
});

test('what is not a number is still 0, or the fallback given', () => {
  assert.strictEqual(run('num("abc")'), 0);
  assert.strictEqual(run('num("49 MW")'), 0);
  assert.strictEqual(run('num("")'), 0);
  assert.strictEqual(run('num(null)'), 0);
  assert.strictEqual(run('num(undefined)'), 0);
  assert.strictEqual(run('num(NaN, 7)'), 7);
  assert.strictEqual(run('num(42)'), 42);
});

test('rand amounts print with the sign first', () => {
  assert.strictEqual(run('fmtR(-1500000)'), '-R1.5m');
  assert.strictEqual(run('fmtR(2500000)'), 'R2.5m');
  assert.strictEqual(run('fmtR(0)'), 'R0');
});

test('a CSV is read whichever separator it uses', () => {
  assert.strictEqual(JSON.stringify(run('parseCSV("name,city\\nAcme,CT\\n")')), '[["name","city"],["Acme","CT"]]');
  assert.strictEqual(JSON.stringify(run('parseCSV("name;city;gwh\\nAcme;Cape Town;1 200,5\\n")')), '[["name","city","gwh"],["Acme","Cape Town","1 200,5"]]');
  assert.strictEqual(JSON.stringify(run('parseCSV("name\\tcity\\nAcme\\tCT\\n")')), '[["name","city"],["Acme","CT"]]');
});

test('a byte-order mark does not stick to the first header', () => {
  assert.strictEqual(run('parseCSV("\\uFEFFname,city\\r\\nAcme,CT\\r\\n")')[0][0], 'name');
});

test('quotes, escaped quotes, line breaks inside a cell and blank lines survive', () => {
  assert.strictEqual(JSON.stringify(run('parseCSV("name,city\\n\\"Acme, Ltd\\",CT\\n")')[1]), '["Acme, Ltd","CT"]');
  assert.strictEqual(run('parseCSV("n,notes\\nA,\\"say \\"\\"hi\\"\\"\\"\\n")')[1][1], 'say "hi"');
  assert.strictEqual(run('parseCSV("n,notes\\nA,\\"l1\\nl2\\"\\n")')[1][1], 'l1\nl2');
  assert.strictEqual(run('parseCSV("name,city\\n\\nAcme,CT\\n\\n\\n")').length, 2);
});

test('a semicolon inside quotes does not make a comma file semicolon-separated', () => {
  assert.strictEqual(JSON.stringify(run('parseCSV("name,notes\\nAcme,\\"a;b;c\\"\\n")')[1]), '["Acme","a;b;c"]');
});

test('a company in two provinces is found under either; abbreviations are understood', () => {
  assert.strictEqual(JSON.stringify(run('provincesOf("Mpumalanga / KZN")')), '["Mpumalanga","KwaZulu-Natal"]');
  assert.strictEqual(run('inProvince({ province: "Mpumalanga / Limpopo" }, "Limpopo")'), true);
  assert.strictEqual(run('inProvince({ province: "Mpumalanga / Limpopo" }, "Gauteng")'), false);
  assert.strictEqual(run('inProvince({ province: "Gauteng" }, "Gauteng")'), true);
  assert.strictEqual(run('inProvince({}, "Gauteng")'), false);
});

test('the province choices are single provinces, not every combination', () => {
  const choices = run('provinceChoices([{ province: "Free State / Gauteng" }, { province: "Gauteng" }, { province: "Gauteng / Limpopo" }, { province: "" }])');
  assert.strictEqual(JSON.stringify(choices), '["Free State","Gauteng","Limpopo"]');
});

test('the log is newest first: by day, then by when each entry was made; one just made leads', () => {
  const order = run(`[
    { id: 'a', date: '2026-10-15', createdAt: '2026-10-15T13:22:46Z' },
    { id: 'b', date: '2026-10-13', createdAt: '2026-10-13T19:20:01Z' },
    { id: 'c', date: '2026-10-15', createdAt: '2026-10-15T15:51:32Z' },
    { id: 'd', date: '2026-10-15', createdAt: '' },
    { id: 'e', date: '2026-10-15', createdAt: '2026-10-15T13:43:50Z' },
  ].sort(newestFirst).map(i => i.id)`);
  assert.deepStrictEqual(order, ['d', 'c', 'e', 'a', 'b']);
});
test('an entry reads its day and the time it was made; a back-dated one only its day', () => {
  const at = run(`entryWhen({ date: '2026-10-15', createdAt: new Date(2026, 9, 15, 17, 51).toISOString() })`);
  assert.strictEqual(at, '15 Oct 2026 · 17:51');
  assert.strictEqual(run(`entryWhen({ date: '2026-10-03', createdAt: new Date(2026, 9, 15, 17, 51).toISOString() })`), '3 Oct 2026', 'logged on the 15th for the 3rd: no time');
  assert.strictEqual(run(`entryWhen({ date: '2026-10-08', createdAt: '' })`), '8 Oct 2026');
});

console.log('\n' + n + ' passed');
