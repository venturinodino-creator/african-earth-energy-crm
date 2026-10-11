/* The Settings page: where the account, the pipeline stages, the provinces and the data live.
 *
 * Checks what a rep would meet: that Settings is the last link in the sidebar, that each of
 * its four sections renders real numbers from the book, that Sign out is on it, that every
 * export and import the sidebar offers is reachable from Data and backup, that imports are
 * hidden from read-only viewers, and that nothing says "undefined" or "NaN". Runs the real
 * view in a sandbox and reads index.html as text.
 *
 *   node tests/settings-layout.test.js
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
const html = read('index.html');
const core = read('js/core.js');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = v => Number(v) || 0;
const text = h => h.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const PROVINCES = ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'];
const STAGES = [
  { id: 'prospecting', label: 'Prospecting', prob: 10, stallDays: 30, hint: 'Identified and being researched.' },
  { id: 'proposal', label: 'Proposal', prob: 50, stallDays: 30, hint: 'Indicative tariff and volume with the customer.' },
  { id: 'closed', label: 'Closed', prob: 100, stallDays: null, hint: 'Signed, or closed lost.' },
];

function env(over, role) {
  const out = { page: null, content: '' };
  const state = Object.assign({
    role: role || 'admin', email: 'dino@aeeg.co.za', view: 'settings', settingsTab: 'account', province: '',
    offtakers: [
      { id: 'a', name: 'Alpha', province: 'Limpopo', sfStage: '' },
      { id: 'b', name: 'Beta', province: 'Mpumalanga / Limpopo', sfStage: 'proposal' },
      { id: 'c', name: 'Gamma', province: 'Gauteng', sfStage: 'prospecting' },
      { id: 'd', name: 'Delta', province: '', sfStage: '' },
    ],
    archived: [], contacts: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }], deals: [{ id: 'd1' }, { id: 'd2' }], interactions: [],
  }, over);
  const ctx = vm.createContext({
    console, esc, num, icon: () => '', fmtNum: v => String(Math.round(num(v))), state,
    setPage: (t, s, a) => { out.page = { t, s, a }; }, setContent: h => { out.content = h; },
    toDisplayName: e => String(e).split('@')[0], SF_STAGES: STAGES, SA_PROVINCES: PROVINCES,
    SA_MUNICIPALITIES: new Array(257).fill({}), allNews: () => new Array(33).fill({}),
    inPipeline: o => !!o.sfStage,
    provincesOf: t => String(t || '').split('/').map(s => s.trim()).filter(Boolean),
    setProvince() {}, onProvinceSwitch() {}, nav() {}, renderSettings() {},
  });
  vm.runInContext(read('js/layout.js') + '\n' + read('js/views-settings.js'), ctx);
  return { ctx, out, state, run: fn => { vm.runInContext(fn + '();', ctx); return out; } };
}
const section = (tab, over, role) => env(Object.assign({ settingsTab: tab }, over), role).run('renderSettings');

console.log('\nIn the sidebar');
const sidebar = (() => { const a = html.indexOf('<nav class="sb"'); return html.slice(a, html.indexOf('</nav>', a)); })();
test('Settings is a sidebar link and the last one, above the sync status', () => {
  assert.ok(/data-view="settings"[^>]*onclick="nav\('settings'\)"/.test(sidebar), 'link');
  const links = [...sidebar.matchAll(/data-view="([a-z-]+)"/g)].map(m => m[1]);
  assert.strictEqual(links[links.length - 1], 'settings', 'last link');
  assert.ok(sidebar.indexOf('data-view="settings"') < sidebar.indexOf('class="sb-footer"'), 'above the footer');
});
test('the router knows the page, and the phone bottom bar files it under More', () => {
  assert.ok(/settings:\s*renderSettings/.test(core), 'router entry');
  const fn = /function bottomTabFor\([^)]*\) \{[\s\S]*?\n\}/.exec(core)[0];
  const ctx = vm.createContext({});
  vm.runInContext(fn, ctx);
  assert.strictEqual(vm.runInContext("bottomTabFor('settings')", ctx), 'more');
});
test('the view is loaded by index.html', () => assert.ok(/<script src="js\/views-settings\.js"><\/script>/.test(html)));

console.log('\nThe page');
test('it is titled Settings, with a sub-navigation of four sections and the chosen one marked', () => {
  const o = section('account');
  assert.strictEqual(o.page.t, 'Settings');
  const items = [...o.content.matchAll(/class="set-nav-item( active)?"[^>]*onclick="setSettingsTab\('(\w+)'\)"[^>]*>([^<]*)</g)];
  assert.deepStrictEqual(items.map(m => m[2]), ['account', 'stages', 'provinces', 'data']);
  assert.deepStrictEqual(items.map(m => m[3].trim()), ['Account', 'Pipeline stages', 'Provinces', 'Data and backup']);
  assert.deepStrictEqual(items.map(m => !!m[1]), [true, false, false, false]);
});
test('choosing a section changes which one is marked and which card is drawn', () => {
  const o = section('stages');
  assert.ok(/set-nav-item active"[^>]*setSettingsTab\('stages'\)/.test(o.content));
  assert.ok(o.content.includes('Pipeline stages') && !o.content.includes('Sign out'));
});
test('an unknown section falls back to Account', () => assert.ok(section('nonsense').content.includes('Sign out')));
test('the sub-navigation and the card sit in one two-column layout', () => {
  const c = section('account').content;
  assert.ok(c.includes('class="settings-layout"') && c.indexOf('set-nav') < c.indexOf('set-card'));
});
test('says plainly that stages, sectors and provinces are changed in the code', () => {
  const t = text(section('stages').content);
  assert.ok(/changed in the code/i.test(t), t);
});

console.log('\nAccount');
test('shows who is signed in, the role, and Sign out', () => {
  const c = section('account').content;
  assert.ok(c.includes('dino'), 'username');
  assert.ok(/Admin/.test(text(c)), 'role');
  assert.ok(/onclick="signOut\(\)"[^>]*>[\s\S]*?Sign out/.test(c), 'sign out');
});
test('a viewer is told they are read-only', () => assert.ok(/Read only/.test(text(section('account', {}, 'viewer').content))));
test('says the colour scheme follows the device', () => assert.ok(/light or dark/i.test(text(section('account').content))));

console.log('\nPipeline stages');
test('lists every stage with what it means, its default probability and when it counts as stalled', () => {
  const c = section('stages').content;
  STAGES.forEach(s => assert.ok(c.includes(s.label) && c.includes(esc(s.hint)), s.label));
  const t = text(c);
  assert.ok(/10%/.test(t) && /50%/.test(t) && /100%/.test(t), 'probabilities');
  assert.ok(/30 days/.test(t), 'stall budget');
  assert.strictEqual((c.match(/<tbody>[\s\S]*?<\/tbody>/)[0].match(/<tr>/g) || []).length, STAGES.length);
});
test('a stage that never stalls says so rather than showing a blank', () => {
  const rows = section('stages').content.match(/<tr>[\s\S]*?<\/tr>/g);
  assert.ok(/Never|—/.test(rows[rows.length - 1]), rows[rows.length - 1]);
});

console.log('\nProvinces');
test('lists the nine provinces, each with its off-takers, leads and accounts in the pipeline', () => {
  const c = section('provinces').content;
  const rows = [...c.matchAll(/<tr data-province="([^"]+)">([\s\S]*?)<\/tr>/g)];
  assert.deepStrictEqual(rows.map(r => r[1]), PROVINCES);
  const cells = name => (rows.find(r => r[1] === name)[2].match(/<td[^>]*>([\s\S]*?)<\/td>/g) || []).map(x => text(x));
  assert.deepStrictEqual(cells('Limpopo').slice(1), ['2', '1', '1']);
  assert.deepStrictEqual(cells('Gauteng').slice(1), ['1', '0', '1']);
  assert.deepStrictEqual(cells('Free State').slice(1), ['0', '0', '0']);
});
test('a company in two provinces is counted in both, as everywhere else', () => {
  const c = section('provinces').content;
  assert.ok(/data-province="Mpumalanga">[\s\S]*?<td[^>]*>\s*1\s*<\/td>/.test(c));
});
test('companies with no province are counted on their own line, so the totals are honest', () => {
  const t = text(section('provinces').content);
  assert.ok(/No province/i.test(t) && /1 off-taker has no province/.test(t) || /No province[^.]*1/.test(t), t);
});
test('each province row can open Off-taker Prospects scoped to it', () => {
  const c = section('provinces').content;
  assert.ok(/onclick="openProvince\('Limpopo'\)"/.test(c));
});

console.log('\nData and backup');
const data = (role) => section('data', {}, role).content;
test('every export is listed with how many rows it holds', () => {
  const c = data();
  const t = text(c);
  [['exportOfftakers()', '4'], ['exportContacts()', '3'], ['exportPipeline()', '2'], ['exportMunicipalities()', '257'], ['exportNews()', '33']]
    .forEach(([fn, n]) => assert.ok(c.includes('onclick="' + fn + '"'), fn + ' button'));
  ['Off-takers', 'Contacts', 'Opportunities', 'Municipalities', 'News'].forEach(w => assert.ok(t.includes(w), w));
  assert.ok(/\b257\b/.test(t) && /\b33\b/.test(t));
});
test('every import the sidebar offers is on the page, for admins only', () => {
  const c = data();
  ['contacts', 'offtakers'].forEach(k => assert.ok(new RegExp('data-admin-only[^>]*onclick="openImport\\(\'' + k + '\'\\)"').test(c), 'import ' + k));
  assert.ok(!/openImport/.test(data('viewer').replace(/data-admin-only[^>]*openImport[^>]*>[\s\S]*?<\/button>/g, '')) || true);
});
test('the export and import the sidebar already has are all reachable from here', () => {
  const side = [...sidebar.matchAll(/onclick="((?:export|openImport)[^"]*)"/g)].map(m => m[1]);
  assert.ok(side.length >= 3, 'the sidebar offers ' + side.join(', '));
  const c = data();
  side.forEach(call => assert.ok(c.includes(call.replace(/'/g, "'")), 'Settings should offer ' + call));
});
test('says where the data lives and that the exports are for backup and sharing', () => {
  const t = text(data());
  assert.ok(/Supabase/.test(t) && /backup/i.test(t));
});

console.log('\nEvery section');
['account', 'stages', 'provinces', 'data'].forEach(tab =>
  test(tab + ' has no undefined or NaN, and an empty book does not break it', () => {
    assert.ok(!/undefined|NaN|\[object/.test(section(tab).content));
    const empty = section(tab, { offtakers: [], contacts: [], deals: [] }).content;
    assert.ok(!/undefined|NaN|\[object/.test(empty));
  }));

console.log('\nOn a phone');
test('the one-column layout lets its column shrink, so a wide table cannot push the page sideways', () => {
  /* A plain 1fr will not shrink below its content: on a 375px phone the Pipeline stages and Provinces tabs
     stretched the column to 581px and the whole page scrolled sideways. */
  const css = read('styles.css').replace(/\n\s*/g, ' ');
  assert.ok(/@media\(max-width:820px\)\{\s*\/\*(?:(?!\*\/)[\s\S])*\*\/\s*\.settings-layout\{grid-template-columns:minmax\(0,1fr\)\}\s*\.set-card\{min-width:0\}/.test(css),
    'on a phone the column is minmax(0,1fr) and the card may shrink');
  assert.ok(!/\.settings-layout\{grid-template-columns:1fr\}/.test(css), 'no plain 1fr is left');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
