/* The province scope: one province filter for the whole app, set from the top bar.
 *
 * Checks what a rep would meet: which records a province leaves in, that a company
 * in two provinces is in either, that the choice is remembered and survives a bad
 * stored value, that the four old per-page province filters are the same setting as
 * the top-bar switcher, and that the switcher is in the top bar for everyone.
 * Runs the real functions from js/core.js in a sandbox, so no browser is needed.
 *
 *   node tests/province-scope.test.js
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
const html = read('index.html');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

/* Lift one declaration out of core.js by name. */
function lift(re, what) {
  const m = re.exec(core);
  if (!m) throw new Error(what + ' not found in core.js');
  return m[0];
}
const PIECES = [
  lift(/const STORE_PREFIX = [^;]*;/, 'STORE_PREFIX'),
  lift(/const SA_PROVINCES = \[[\s\S]*?\];/, 'SA_PROVINCES'),
  lift(/const PROVINCE_ALIASES = \{[\s\S]*?\n\};/, 'PROVINCE_ALIASES'),
  lift(/function provinceFromText\([^)]*\) \{[\s\S]*?\n\}/, 'provinceFromText'),
  lift(/function provincesOf\([^)]*\) \{[\s\S]*?\n\}/, 'provincesOf'),
  lift(/function provinceInScope\([^)]*\) \{[\s\S]*?\n\}/, 'provinceInScope'),
  lift(/function storedProvince\([^)]*\) \{[\s\S]*?\n\}/, 'storedProvince'),
  lift(/function setProvince\([^)]*\) \{[\s\S]*?\n\}/, 'setProvince'),
  lift(/function linkProvinceFilters\([^)]*\) \{[\s\S]*?\n\}/, 'linkProvinceFilters'),
  lift(/function provinceSwitchHtml\([^)]*\) \{[\s\S]*?\n\}/, 'provinceSwitchHtml'),
  lift(/function syncProvinceSwitch\([^)]*\) \{[\s\S]*?\n\}/, 'syncProvinceSwitch'),
].join('\n');

/* A fresh sandbox with a working (or broken) localStorage. */
function sandbox(store, opts) {
  opts = opts || {};
  const saved = {};
  const ctx = vm.createContext({
    console,
    localStorage: {
      getItem: k => { if (opts.broken) throw new Error('blocked'); return k in store ? store[k] : null; },
      setItem: (k, v) => { if (opts.broken) throw new Error('blocked'); store[k] = String(v); saved[k] = String(v); },
    },
    document: { getElementById: () => null },
  });
  vm.runInContext(PIECES + '\nvar state = { province: storedProvince() }; linkProvinceFilters(state);', ctx);
  ctx.__saved = saved;
  return ctx;
}
const run = (ctx, code) => vm.runInContext(code, ctx);

console.log('\nWhich records a province leaves in');
test('no province: everything is in, whatever its province says', () => {
  const c = sandbox({});
  assert.strictEqual(run(c, "provinceInScope('', 'Gauteng')"), true);
  assert.strictEqual(run(c, "provinceInScope('', '')"), true);
  assert.strictEqual(run(c, "provinceInScope('', undefined)"), true);
});
test('a province keeps its own records and drops the others', () => {
  const c = sandbox({});
  assert.strictEqual(run(c, "provinceInScope('Limpopo', 'Limpopo')"), true);
  assert.strictEqual(run(c, "provinceInScope('Limpopo', 'Gauteng')"), false);
});
test('a company in two provinces is in either', () => {
  const c = sandbox({});
  assert.strictEqual(run(c, "provinceInScope('Limpopo', 'Mpumalanga / Limpopo')"), true);
  assert.strictEqual(run(c, "provinceInScope('Mpumalanga', 'Mpumalanga / Limpopo')"), true);
  assert.strictEqual(run(c, "provinceInScope('Gauteng', 'Mpumalanga / Limpopo')"), false);
});
test('the spellings people type still land in the right province', () => {
  const c = sandbox({});
  assert.strictEqual(run(c, "provinceInScope('KwaZulu-Natal', 'KZN')"), true);
  assert.strictEqual(run(c, "provinceInScope('Western Cape', 'wc')"), true);
});
test('a record with no province is not in any single province', () => {
  const c = sandbox({});
  assert.strictEqual(run(c, "provinceInScope('Gauteng', '')"), false);
  assert.strictEqual(run(c, "provinceInScope('Gauteng', null)"), false);
});

console.log('\nThe nine provinces');
test('the switcher offers exactly the nine provinces, once each', () => {
  const c = sandbox({});
  const list = JSON.parse(run(c, 'JSON.stringify(SA_PROVINCES)'));
  assert.strictEqual(list.length, 9);
  assert.strictEqual(new Set(list).size, 9);
  ['Gauteng', 'Limpopo', 'Mpumalanga', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape', 'Northern Cape', 'North West', 'Free State']
    .forEach(p => assert.ok(list.includes(p), p + ' missing'));
});
test('every province the municipality data uses is one of them', () => {
  const c = vm.createContext({});
  vm.runInContext(read('data/municipalities.js') + ';this.P = MUNI_PROVINCES;', c);
  const mine = sandbox({});
  const list = JSON.parse(run(mine, 'JSON.stringify(SA_PROVINCES)'));
  Array.from(c.P).forEach(p => assert.ok(list.includes(p), p + ' is not in SA_PROVINCES'));
});

console.log('\nRemembering the choice');
test('starts on All provinces when nothing was stored', () => {
  assert.strictEqual(run(sandbox({}), 'state.province'), '');
});
test('starts on the stored province', () => {
  assert.strictEqual(run(sandbox({ aee_crm_province: 'Limpopo' }), 'state.province'), 'Limpopo');
});
test('a stored value that is not a province falls back to All provinces', () => {
  assert.strictEqual(run(sandbox({ aee_crm_province: 'Atlantis' }), 'state.province'), '');
});
test('blocked storage does not break the page; it starts on All provinces', () => {
  const c = sandbox({}, { broken: true });
  assert.strictEqual(run(c, 'state.province'), '');
  assert.doesNotThrow(() => run(c, "setProvince('Gauteng')"));
  assert.strictEqual(run(c, 'state.province'), 'Gauteng');
});
test('choosing a province saves it; choosing All saves that too', () => {
  const store = {};
  const c = sandbox(store);
  run(c, "setProvince('Gauteng')");
  assert.strictEqual(store.aee_crm_province, 'Gauteng');
  run(c, "setProvince('')");
  assert.strictEqual(store.aee_crm_province, '');
});
test('setProvince says whether anything changed', () => {
  const c = sandbox({});
  assert.strictEqual(run(c, "setProvince('Limpopo')"), true);
  assert.strictEqual(run(c, "setProvince('Limpopo')"), false);
  assert.strictEqual(run(c, "setProvince('')"), true);
});
test('a value that is not a province is treated as All provinces', () => {
  const c = sandbox({ aee_crm_province: 'Limpopo' });
  run(c, "setProvince('Mpumalanga / Limpopo')");
  assert.strictEqual(run(c, 'state.province'), '');
});

console.log('\nOne filter, not five');
['offProvince', 'muniProvince', 'newsProvince', 'cfProvince'].forEach(k => {
  test(k + ' is the same setting as the top-bar switcher', () => {
    const c = sandbox({});
    run(c, "state." + k + " = 'Gauteng'");
    assert.strictEqual(run(c, 'state.province'), 'Gauteng');
    run(c, "setProvince('Limpopo')");
    assert.strictEqual(run(c, 'state.' + k), 'Limpopo');
  });
});
test('clearing any one of the old filters clears them all', () => {
  const c = sandbox({});
  run(c, "setProvince('Gauteng')");
  run(c, "state.newsProvince = ''");
  ['province', 'offProvince', 'muniProvince', 'cfProvince'].forEach(k => assert.strictEqual(run(c, 'state.' + k), ''));
});
test('the old filters are not declared as separate fields any more', () => {
  const literal = /let state = \{[\s\S]*?\n\};/.exec(core)[0];
  ['offProvince', 'muniProvince', 'newsProvince', 'cfProvince'].forEach(k =>
    assert.ok(!new RegExp('\\b' + k + '\\s*:').test(literal), k + ' is still its own field in the state literal'));
  assert.ok(/\bprovince:\s*storedProvince\(\)/.test(literal), 'state.province should start from the stored choice');
});

console.log('\nThe switcher in the top bar');
const topbar = (() => { const a = html.indexOf('<div class="topbar"'); const b = html.indexOf('<header class="page-head"', a); return html.slice(a, b); })();
test('it is in the top bar, outside the admin-only + New menu, so viewers have it too', () => {
  assert.ok(/id="province-switch"/.test(topbar), 'no #province-switch in the top bar');
  const newWrap = /<div class="menu-wrap" id="new-menu-wrap"[^>]*>/.exec(topbar)[0];
  assert.ok(/data-admin-only/.test(newWrap), 'sanity: + New is admin-only');
  const sw = /<[a-z]+[^>]*id="province-switch"[^>]*>/.exec(topbar)[0];
  assert.ok(!/data-admin-only/.test(sw), 'the switcher must not be admin-only');
});
test('it sits before + New, so the account stays last', () => {
  assert.ok(topbar.indexOf('id="province-switch"') < topbar.indexOf('id="new-btn"'));
  assert.ok(topbar.indexOf('id="new-btn"') < topbar.indexOf('id="user-badge"'));
});
test('it says All provinces first, then the nine, and marks the chosen one', () => {
  const c = sandbox({});
  const markup = run(c, "provinceSwitchHtml('Limpopo')");
  const opts = [...markup.matchAll(/<option value="([^"]*)"([^>]*)>([^<]*)<\/option>/g)];
  assert.strictEqual(opts.length, 10);
  assert.strictEqual(opts[0][1], '');
  assert.strictEqual(opts[0][3], 'All provinces');
  const chosen = opts.filter(o => /selected/.test(o[2]));
  assert.strictEqual(chosen.length, 1);
  assert.strictEqual(chosen[0][1], 'Limpopo');
});
test('choosing a province runs the page-aware handler, not a bare setter', () => {
  assert.ok(/id="province-switch"[^>]*onchange="onProvinceSwitch\(this\.value\)"/.test(topbar));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
