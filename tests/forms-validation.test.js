/* Tests for what the Add / Edit forms accept (js/forms.js): a contact, a
 * company and an opportunity are checked before they are saved, so a bad email,
 * a second copy of the same person or company, or a 0 MW deal is stopped with a
 * message instead of going into the book.
 *
 *   node tests/forms-validation.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const noop = () => {};
function makeEnv() {
  const fields = {};
  const field = id => fields[id] || (fields[id] = { id, value: '', innerHTML: '', textContent: '', classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, style: {} });
  const calls = { toasts: [], pushed: [], saves: 0 };
  const ctx = vm.createContext({
    console, setTimeout: noop, clearTimeout: noop, setInterval: noop,
    document: { getElementById: field, createElement: () => field('x'), querySelector: () => field('x'), querySelectorAll: () => [], addEventListener: noop, body: field('body'), documentElement: field('html') },
    window: { addEventListener: noop, matchMedia: () => ({ matches: false }), location: { search: '', pathname: '/' }, localStorage: { getItem: () => null, setItem: noop } },
    localStorage: { getItem: () => null, setItem: noop }, location: { search: '', pathname: '/' }, history: { state: null, pushState: noop }, addEventListener: noop,
    navigator: { userAgent: 'node' }, matchMedia: () => ({ matches: false }), Intl, URLSearchParams, URL, fetch: async () => ({ ok: false }), CSS: { escape: s => s },
  });
  for (const f of ['data/sectors.js', 'data/seed.js', 'data/municipalities.js', 'js/icons.js', 'js/supabase.js', 'js/core.js', 'js/forms.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8') + '\n', ctx, { filename: f });
  }
  /* Everything that would touch the browser or the database is replaced after loading. */
  ctx.toast = (m, k) => calls.toasts.push([m, k || '']);
  ctx.save = () => { calls.saves++; };
  ctx.render = noop; ctx.closeModal = noop; ctx.openModal = noop;
  ctx.pushContact = c => calls.pushed.push(['contact', c]);
  ctx.pushOfftaker = o => calls.pushed.push(['offtaker', o]);
  ctx.pushDeal = d => calls.pushed.push(['deal', d]);
  ctx.applyAccountStageFromDeals = () => '';
  vm.runInContext('state.contacts = []; state.offtakers = []; state.archived = []; state.deals = []; state.editContactId = null; state.editOfftakerId = null; state.editDealId = null;', ctx);
  const set = o => Object.entries(o).forEach(([k, v]) => { field(k).value = v; });
  return { ctx, calls, set, run: code => vm.runInContext(code, ctx) };
}
const lastToast = e => (e.calls.toasts[e.calls.toasts.length - 1] || [''])[0];

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

test('a contact with a good email is saved', () => {
  const e = makeEnv(); e.set({ 'mc-first': 'Thabo', 'mc-last': 'Nkosi', 'mc-offtaker': 'o1', 'mc-email': 'thabo.nkosi@acme.co.za' });
  e.run('saveContact()');
  assert.strictEqual(e.run('state.contacts.length'), 1);
  assert.strictEqual(e.calls.pushed.length, 1);
});

test('a contact with something that is not an email is refused', () => {
  const e = makeEnv();
  for (const bad of ['n/a', 'thabo@', '@acme.co.za', 'thabo acme.co.za', 'thabo@acme']) {
    e.set({ 'mc-first': 'Thabo', 'mc-last': 'Nkosi', 'mc-offtaker': 'o1', 'mc-email': bad });
    e.run('saveContact()');
  }
  assert.strictEqual(e.run('state.contacts.length'), 0, 'none was saved');
  assert.ok(/does not look like an email/.test(lastToast(e)));
});

test('a contact with no email at all is still allowed', () => {
  const e = makeEnv(); e.set({ 'mc-first': 'Thabo', 'mc-last': 'Nkosi', 'mc-offtaker': 'o1', 'mc-email': '' });
  e.run('saveContact()');
  assert.strictEqual(e.run('state.contacts.length'), 1);
});

test('the same person cannot be added twice to one company, however it is capitalised', () => {
  const e = makeEnv();
  e.set({ 'mc-first': 'Thabo', 'mc-last': 'Nkosi', 'mc-offtaker': 'o1' }); e.run('saveContact()');
  e.set({ 'mc-first': 'THABO', 'mc-last': "n'kosi", 'mc-offtaker': 'o1' }); e.run('saveContact()');
  assert.strictEqual(e.run('state.contacts.length'), 1);
  assert.ok(/already on file/.test(lastToast(e)));
});

test('the same name at a different company is a different person', () => {
  const e = makeEnv();
  e.set({ 'mc-first': 'Thabo', 'mc-last': 'Nkosi', 'mc-offtaker': 'o1' }); e.run('saveContact()');
  e.set({ 'mc-first': 'Thabo', 'mc-last': 'Nkosi', 'mc-offtaker': 'o2' }); e.run('saveContact()');
  assert.strictEqual(e.run('state.contacts.length'), 2);
});

test('editing a contact that has vanished does not write into the list', () => {
  const e = makeEnv(); e.run("state.editContactId = 'gone'");
  e.set({ 'mc-first': 'Thabo', 'mc-last': 'Nkosi', 'mc-offtaker': 'o1' }); e.run('saveContact()');
  assert.strictEqual(e.run('state.contacts.length'), 0);
  assert.strictEqual(e.run('Object.keys(state.contacts).length'), 0, 'no stray -1 entry');
  assert.ok(/no longer in the list/.test(lastToast(e)));
});

test('editing a contact changes it and does not trip the duplicate check against itself', () => {
  const e = makeEnv();
  e.set({ 'mc-first': 'Thabo', 'mc-last': 'Nkosi', 'mc-offtaker': 'o1', 'mc-jobtitle': 'CFO' }); e.run('saveContact()');
  const id = e.run('state.contacts[0].id'); e.run("state.editContactId = '" + id + "'");
  e.set({ 'mc-jobtitle': 'Chief Financial Officer' }); e.run('saveContact()');
  assert.strictEqual(e.run('state.contacts.length'), 1);
  assert.strictEqual(e.run('state.contacts[0].title'), 'Chief Financial Officer');
});

test('a company already on the list, or in the Archive, is not added a second time', () => {
  const e = makeEnv();
  e.run("state.offtakers = [{ id: 'a', name: 'Sibanye-Stillwater' }]; state.archived = [{ id: 'b', name: 'Old Mine (Pty) Ltd', archived: true }];");
  e.set({ 'mo-name': 'sibanye stillwater' }); e.run('saveOfftaker()');
  assert.ok(/already on the list/.test(lastToast(e)));
  e.set({ 'mo-name': 'Old Mine (Pty) Ltd' }); e.run('saveOfftaker()');
  assert.ok(/already in the Archive/.test(lastToast(e)));
  assert.strictEqual(e.run('state.offtakers.length'), 1, 'nothing added');
});

test('a new company is saved, and a bare website gets https://', () => {
  const e = makeEnv();
  e.set({ 'mo-name': 'Fresh Mining', 'mo-website': 'freshmining.co.za', 'mo-gwh': '1 200', 'mo-peak': '3,5' });
  e.run('saveOfftaker()');
  assert.strictEqual(e.run('state.offtakers.length'), 1);
  assert.strictEqual(e.run('state.offtakers[0].website'), 'https://freshmining.co.za');
  assert.strictEqual(e.run('state.offtakers[0].annualGwh'), 1200, 'a typed 1 200 is 1200, not 0');
  assert.strictEqual(e.run('state.offtakers[0].peakMw'), 3.5);
});

test('editing a company keeps its own name without calling itself a duplicate', () => {
  const e = makeEnv();
  e.run("state.offtakers = [{ id: 'a', name: 'Sibanye-Stillwater', website: 'https://x.co.za' }]; state.editOfftakerId = 'a';");
  e.set({ 'mo-name': 'Sibanye-Stillwater', 'mo-website': 'https://x.co.za' }); e.run('saveOfftaker()');
  assert.strictEqual(e.run('state.offtakers.length'), 1);
  assert.ok(!e.calls.toasts.some(t => t[1] === 'warn'));
});

test('an opportunity needs MW, and a probability between 0 and 100', () => {
  const e = makeEnv();
  e.run("state.offtakers = [{ id: 'a', name: 'Sasol', short: 'Sasol' }];");
  e.ctx.parseAccountKey = () => ({ offtakerId: 'a' });
  e.set({ 'md-offtaker': 'a', 'md-mw': '0', 'md-tariff': '1.05', 'md-probability': '50' }); e.run('saveDeal()');
  assert.ok(/more than 0/.test(lastToast(e)));
  e.set({ 'md-mw': '-20' }); e.run('saveDeal()');
  e.set({ 'md-mw': '20', 'md-probability': '150' }); e.run('saveDeal()');
  assert.ok(/0 to 100/.test(lastToast(e)));
  assert.strictEqual(e.run('state.deals.length'), 0);
  e.set({ 'md-mw': '20', 'md-probability': '50' }); e.run('saveDeal()');
  assert.strictEqual(e.run('state.deals.length'), 1);
});

console.log('\n' + n + ' passed');
