/* Tests for the Contact finder's target and scope logic.
 *
 * The screen offers a selector of targets (a sector, or the main
 * municipalities). What it offers, how many accounts a run would cover
 * and what a queued run records are all decided by a few pure functions
 * in js/views-contactfinder.js; this loads that file into a sandbox and
 * drives them with plain data, no browser needed.
 *
 *   node tests/finder-targets.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
/* Arrays built inside the sandbox have the sandbox's prototype, which
   deepStrictEqual rejects; compare by value instead. */
const same = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = vm.createContext({
  SECTOR_GROUPS: { 'heavy-industry': 'Heavy industry' },
  SECTOR_LABEL: { mining: 'Mining & Minerals (Producer)', cement: 'Cement, lime & aggregates' },
  muniIsMain: m => !!(m && m.main),
  console,
});
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'views-contactfinder.js'), 'utf8');
const f = vm.runInContext(src + `
;({ finderTargetOptions, finderScopeAccounts, finderProvinces, finderRunRecord,
    industryLabel, FINDER_DEFAULT_TARGET, FINDER_MUNI })`, sandbox);

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

/* A small book. Mining has one gap, cement has none, steel is parked-only,
   chemicals has a gap in a different province. */
const offtakers = [
  { id: 'o_min1', sector: 'mining', province: 'Gauteng', status: 'prospect' },
  { id: 'o_min2', sector: 'mining', province: 'Limpopo', status: 'prospect' },
  { id: 'o_cem1', sector: 'cement', province: 'Gauteng', status: 'prospect' },
  { id: 'o_stl1', sector: 'steel', province: 'Gauteng', status: 'parked' },
  { id: 'o_chm1', sector: 'chemicals', province: 'KwaZulu-Natal', status: 'prospect' },
  { id: 'o_chm2', sector: 'chemicals', province: 'KwaZulu-Natal', status: 'contracted' },
];
const withContacts = new Set(['o_min2', 'o_cem1', 'o_chm2']);
const munis = [
  { id: 'mun_JHB', province: 'Gauteng', main: true },
  { id: 'mun_NMA', province: 'Eastern Cape', main: true },
];
const labelOf = k => ({ chemicals: 'Chemicals', steel: 'Steel', cement: 'Cement' }[k] || k);

const opts = (selected) => f.finderTargetOptions(offtakers, withContacts, munis, labelOf, selected);
const keys = (selected) => opts(selected).map(o => o.key);

console.log('\nfinderTargetOptions');
test('Mining is the default target', () => assert.strictEqual(f.FINDER_DEFAULT_TARGET, 'mining'));
test('Mining is offered first', () => assert.strictEqual(keys('mining')[0], 'mining'));
test('Mining stays when it has no gaps', () => {
  const all = new Set(['o_min1', 'o_min2']);
  const k = f.finderTargetOptions(offtakers, all, munis, labelOf, 'mining').map(o => o.key);
  assert.ok(k.includes('mining'));
});
test('a sector with a gap is offered with its count', () => {
  const chem = opts('mining').find(o => o.key === 'chemicals');
  assert.ok(chem, 'chemicals missing');
  assert.strictEqual(chem.needs, 1);
});
test('a sector with no gaps is hidden', () => assert.ok(!keys('mining').includes('cement')));
test('a parked account with no contact does not count', () => assert.ok(!keys('mining').includes('steel')));
test('rejected and lost accounts with no contact do not count', () => {
  const book = offtakers.concat([
    { id: 'o_pap1', sector: 'paper', province: 'Gauteng', status: 'rejected' },
    { id: 'o_pap2', sector: 'paper', province: 'Gauteng', status: 'lost' },
  ]);
  const k = f.finderTargetOptions(book, withContacts, munis, labelOf, 'mining').map(o => o.key);
  assert.ok(!k.includes('paper'));
});
test('the selected target stays listed with no gaps', () => assert.ok(keys('cement').includes('cement')));
test('the municipality target is offered', () => assert.ok(keys('mining').includes(f.FINDER_MUNI)));
test('the municipality target is hidden when no main municipality exists', () => {
  const k = f.finderTargetOptions(offtakers, withContacts, [], labelOf, 'mining').map(o => o.key);
  assert.ok(!k.includes(f.FINDER_MUNI));
});
test('an option carries a readable label', () => {
  assert.strictEqual(opts('mining').find(o => o.key === 'chemicals').label, 'Chemicals');
  assert.strictEqual(opts('mining').find(o => o.key === f.FINDER_MUNI).label, 'Main municipalities');
});

console.log('\nfinderScopeAccounts');
const ids = (target, province) =>
  f.finderScopeAccounts(target, offtakers, munis, province).map(a => a.id);
test('a sector scope is that sector only', () => same(ids('mining', ''), ['o_min1', 'o_min2']));
test('a sector never includes another sector', () => assert.ok(!ids('chemicals', '').some(i => i.startsWith('o_min'))));
test('province narrows a sector', () => same(ids('mining', 'Limpopo'), ['o_min2']));
test('the municipality scope is exactly the main municipalities', () =>
  same(ids(f.FINDER_MUNI, ''), ['mun_JHB', 'mun_NMA']));
test('province narrows municipalities', () =>
  same(ids(f.FINDER_MUNI, 'Gauteng'), ['mun_JHB']));
test('a non-main municipality is never in scope', () => {
  const all = munis.concat([{ id: 'mun_X', province: 'Gauteng', main: false }]);
  const got = f.finderScopeAccounts(f.FINDER_MUNI, offtakers, all, '').map(a => a.id);
  assert.ok(!got.includes('mun_X'));
});

console.log('\nfinderProvinces');
test('provinces follow the selected sector', () =>
  same(f.finderProvinces('mining', offtakers, munis), ['Gauteng', 'Limpopo']));
test('provinces follow the municipality target', () =>
  same(f.finderProvinces(f.FINDER_MUNI, offtakers, munis), ['Eastern Cape', 'Gauteng']));

console.log('\nfinderRunRecord');
test('a sector run records the sector as its industry', () => {
  const run = f.finderRunRecord('chemicals', [{ id: 'o_chm1' }], ['decision'], 'run_1', '2026-10-02');
  assert.strictEqual(run.industry, 'chemicals');
  same(run.offtakerIds, ['o_chm1']);
  assert.strictEqual(run.status, 'queued');
  assert.strictEqual(run.found, 0);
});
test('a municipality run carries only mun_ ids and reads as municipal', () => {
  const scope = f.finderScopeAccounts(f.FINDER_MUNI, offtakers, munis, '');
  const run = f.finderRunRecord(f.FINDER_MUNI, scope, ['decision'], 'run_2', '2026-10-02');
  assert.strictEqual(run.industry, 'municipal');
  assert.ok(run.offtakerIds.length && run.offtakerIds.every(i => i.startsWith('mun_')));
});
test('the run copies its roles rather than sharing the array', () => {
  const roles = ['decision'];
  const run = f.finderRunRecord('mining', [{ id: 'o_min1' }], roles, 'run_3', '2026-10-02');
  roles.push('technical');
  same(run.roles, ['decision']);
});

console.log('\nindustryLabel');
test('mining reads as Mining', () => assert.strictEqual(f.industryLabel('mining'), 'Mining'));
test('municipal reads as Main municipalities', () => assert.strictEqual(f.industryLabel('municipal'), 'Main municipalities'));
test('a sector id reads as its readable name', () => assert.strictEqual(f.industryLabel('cement'), 'Cement, lime & aggregates'));
test('an old sector-group key still reads', () => assert.strictEqual(f.industryLabel('heavy-industry'), 'Heavy industry'));
test('an unknown key falls back to the key', () => assert.strictEqual(f.industryLabel('zzz'), 'zzz'));
test('all reads as All industries', () => assert.strictEqual(f.industryLabel('all'), 'All industries'));

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
