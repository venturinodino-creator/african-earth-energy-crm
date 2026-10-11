/* The quick-create drawer: + New opens one drawer for all four kinds of record.
 *
 * Checks what a rep would meet: the pills that switch between Off-taker, Contact,
 * Opportunity and Activity, that creating uses the drawer while editing keeps the centred
 * dialog, the duplicate warnings for an off-taker name and for a contact, and that
 * Create & open is offered where there is a record to open. Runs the real code from
 * js/quickcreate.js and js/forms.js in a sandbox, and reads index.html as text.
 *
 *   node tests/quickcreate.test.js
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

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const same = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b));

/* A stub document: elements are made on demand and remember their classes and text. */
function stubDom() {
  const els = {};
  const make = id => ({
    id, hidden: false, innerHTML: '', textContent: '', style: {}, value: '',
    classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); },
      toggle(c, on) { const w = on === undefined ? !this.set.has(c) : on; w ? this.set.add(c) : this.set.delete(c); return w; },
      contains(c) { return this.set.has(c); } },
  });
  return { els, document: { getElementById: id => els[id] || (els[id] = make(id)), querySelectorAll: () => [] } };
}

function sandbox() {
  const dom = stubDom();
  const calls = [];
  const state = {
    detailId: null, editOfftakerId: null, editContactId: null,
    offtakers: [], archived: [], contacts: [],
  };
  const ctx = vm.createContext({
    console, esc, document: dom.document, state,
    openAddOfftaker: () => calls.push('offtaker'), openAddContact: () => calls.push('contact'),
    openAddDeal: () => calls.push('deal'), openLogInteraction: () => calls.push('activity'),
    closeModal: id => { dom.document.getElementById(id).classList.remove('open'); calls.push('close:' + id); },
    nav: (v, x) => calls.push('nav:' + v + ':' + (x && x.id)),
    val: id => dom.document.getElementById(id).value, accountView: id => (String(id).startsWith('mun_') ? 'municipality' : 'detail'),
    isMunicipalityId: id => String(id).startsWith('mun_'),
  });
  vm.runInContext(read('js/quickcreate.js'), ctx);
  return { ctx, dom, calls, state };
}
const run = (s, code) => vm.runInContext(code, s.ctx);

console.log('\nThe pills');
test('there is one pill for each thing +New can create, in the +New menu\'s order', () => {
  const s = sandbox();
  same(JSON.parse(run(s, 'JSON.stringify(QC_KINDS.map(k => k.key))')), ['offtaker', 'contact', 'deal', 'activity']);
  same(JSON.parse(run(s, 'JSON.stringify(QC_KINDS.map(k => k.label))')), ['Off-taker', 'Contact', 'Opportunity', 'Activity']);
});
test('the pill row marks the one you are on and switches with quickCreate', () => {
  const h = run(sandbox(), "qcPillsHtml('contact')");
  const pills = [...h.matchAll(/<button class="qc-pill( active)?"[^>]*onclick="quickCreate\('(\w+)'\)"[^>]*>([^<]*)</g)];
  same(pills.map(m => m[2]), ['offtaker', 'contact', 'deal', 'activity']);
  same(pills.map(m => !!m[1]), [false, true, false, false]);
  assert.ok(/aria-selected="true"/.test(h));
});
test('choosing a pill closes every other form and opens that one', () => {
  const s = sandbox();
  run(s, "quickCreate('deal')");
  const closed = s.calls.filter(c => c.startsWith('close:'));
  assert.strictEqual(closed.length, 4, 'all four forms are closed first');
  assert.strictEqual(s.calls[s.calls.length - 1], 'deal');
});
test('an unknown kind does nothing', () => {
  const s = sandbox();
  run(s, "quickCreate('nonsense')");
  assert.strictEqual(s.calls.length, 0);
});

console.log('\nCreating is a drawer, editing is a dialog');
test('creating switches the form into the drawer, with the pills, the eyebrow and Create', () => {
  const s = sandbox();
  run(s, "qcMode('modal-offtaker', true)");
  assert.ok(s.dom.els['modal-offtaker'].classList.contains('drawer'));
  assert.strictEqual(s.dom.els['modal-offtaker-pills'] === undefined, false, 'the pills slot was filled');
  assert.ok(/qc-pill/.test(s.dom.els['modal-offtaker-pills'].innerHTML));
  assert.strictEqual(s.dom.els['mo-save'].textContent, 'Create');
  assert.strictEqual(s.dom.els['mo-save-open'].style.display, '');
});
test('editing puts the same form back to a centred dialog, with Save and no Create & open', () => {
  const s = sandbox();
  run(s, "qcMode('modal-offtaker', true); qcMode('modal-offtaker', false)");
  assert.ok(!s.dom.els['modal-offtaker'].classList.contains('drawer'));
  assert.strictEqual(s.dom.els['mo-save'].textContent, 'Save');
  assert.strictEqual(s.dom.els['mo-save-open'].style.display, 'none');
  assert.strictEqual(s.dom.els['modal-offtaker-pills'].innerHTML, '');
});
test('the opportunity and activity forms have no Create & open, because there is no page of their own to open', () => {
  const s = sandbox();
  run(s, "qcMode('modal-deal', true); qcMode('modal-interaction', true)");
  assert.strictEqual(s.dom.els['md-save'].textContent, 'Create');
  assert.strictEqual(s.dom.els['mi-save'].textContent, 'Create');
  assert.ok(!('md-save-open' in s.dom.els) || s.dom.els['md-save-open'].style.display !== '');
});
test('the openers use the drawer to add and the dialog to edit', () => {
  const forms = read('js/forms.js');
  const body = name => new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(forms)[0];
  [['openAddOfftaker', 'modal-offtaker'], ['openAddContact', 'modal-contact'], ['openAddDeal', 'modal-deal'], ['openLogInteraction', 'modal-interaction']]
    .forEach(([fn, id]) => assert.ok(body(fn).includes("qcMode('" + id + "', true)"), fn + ' should open the drawer'));
  [['openEditOfftaker', 'modal-offtaker'], ['openEditContact', 'modal-contact'], ['openEditDeal', 'modal-deal']]
    .forEach(([fn, id]) => assert.ok(body(fn).includes("qcMode('" + id + "', false)"), fn + ' should open the dialog'));
});

console.log('\nThe markup');
const modal = id => { const a = html.indexOf('id="' + id + '"'); const b = html.indexOf('<!-- ══', a); return html.slice(a, b < 0 ? undefined : b); };
['modal-offtaker', 'modal-contact', 'modal-deal', 'modal-interaction'].forEach(id => {
  test(id + ' has a slot for the pills and an eyebrow', () => {
    const m = modal(id);
    assert.ok(m.includes('id="' + id + '-pills"'), 'pills slot');
    assert.ok(/class="qc-eyebrow"/.test(m), 'eyebrow');
  });
});
test('only the off-taker and contact forms offer Create & open', () => {
  assert.ok(/id="mo-save-open"[^>]*onclick="saveOfftaker\(true\)"/.test(html));
  assert.ok(/id="mc-save-open"[^>]*onclick="saveContact\(true\)"/.test(html));
  assert.ok(!/id="md-save-open"/.test(html) && !/id="mi-save-open"/.test(html));
});
test('the off-taker and contact forms have a warning slot, filled as you type', () => {
  assert.ok(/id="mo-dupe"/.test(html) && /oninput="qcCheckOfftaker\(\)"/.test(modal('modal-offtaker')));
  assert.ok(/id="mc-dupe"/.test(html) && /qcCheckContact\(\)/.test(modal('modal-contact')));
});

console.log('\nThe off-taker duplicate warning');
const dupes = (name, records) => { const s = sandbox(); return JSON.parse(run(s, 'JSON.stringify(findOfftakerDupes(' + JSON.stringify(name) + ', ' + JSON.stringify(records) + '))')); };
const book = [
  { id: 'o1', name: 'Samancor Chrome — Middelburg', short: 'Samancor' },
  { id: 'o2', name: 'Sasol Limited', short: 'Sasol' },
  { id: 'o3', name: 'Exxaro Resources', short: 'Exxaro' },
  { id: 'a1', name: 'Old Mining Co', archived: true },
];
test('the same name, however it is typed, is an exact match', () => {
  assert.strictEqual(dupes('sasol limited', book).exact.id, 'o2');
  assert.strictEqual(dupes('  SASOL  Limited. ', book).exact.id, 'o2');
});
test('a name that contains, or is contained by, a name on file is a near match', () => {
  assert.deepStrictEqual(dupes('Samancor Chrome', book).near.map(r => r.id), ['o1']);
  assert.deepStrictEqual(dupes('Sasol Limited South Africa', book).near.map(r => r.id), ['o2']);
});
test('the short name counts too', () => assert.deepStrictEqual(dupes('Exxaro', book).near.map(r => r.id).concat(dupes('Exxaro', book).exact ? [dupes('Exxaro', book).exact.id] : []).sort(), ['o3']));
test('only whole words count: a short name inside a longer word is not a match', () => {
  const rb = [{ id: 'r1', name: 'African Rainbow Minerals', short: 'ARM' }, { id: 'r2', name: 'Rain', short: '' }];
  assert.deepStrictEqual(dupes('Rain', rb).near.map(r => r.id), [], 'Rain is not inside Rainbow');
  assert.strictEqual(dupes('Rain', rb).exact.id, 'r2', 'but it is the same name as Rain');
  assert.deepStrictEqual(dupes('African Rainbow Minerals', rb).near.map(r => r.id), [], 'Rainbow does not match Rain, and the same name is exact');
  assert.strictEqual(dupes('African Rainbow Minerals', rb).exact.id, 'r1');
  assert.deepStrictEqual(dupes('African Rainbow', rb).near.map(r => r.id), ['r1']);
});
test('a very short name is not matched against everything', () => {
  assert.deepStrictEqual(dupes('SA', book).near, []);
  assert.strictEqual(dupes('SA', book).exact, null);
});
test('a name that is nothing like any on file finds nothing', () => {
  const r = dupes('Totally New Smelter', book);
  assert.strictEqual(r.exact, null);
  assert.deepStrictEqual(r.near, []);
});
test('an archived company is found, and marked as archived', () => {
  const r = dupes('Old Mining Co', book);
  assert.strictEqual(r.exact.id, 'a1');
  assert.strictEqual(r.exact.archived, true);
});
test('at most three near matches are shown', () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ id: 'm' + i, name: 'Acme Mining Group ' + i }));
  assert.ok(dupes('Acme Mining Group', many).near.length <= 3);
});
test('an empty name warns about nothing', () => {
  const r = dupes('', book);
  assert.strictEqual(r.exact, null);
  assert.deepStrictEqual(r.near, []);
});

console.log('\nThe contact duplicate warning');
const cdupes = (c, contacts) => { const s = sandbox(); return JSON.parse(run(s, 'JSON.stringify(findContactDupes(' + JSON.stringify(c) + ', ' + JSON.stringify(contacts) + '))')); };
const people = [
  { id: 'c1', first: 'Thabo', last: 'Nkosi', offtakerId: 'o1', email: 'thabo@a.co.za' },
  { id: 'c2', first: 'Sipho', last: 'Dlamini', offtakerId: 'o2', email: 'sipho@b.co.za' },
];
test('the same person at the same company is a duplicate, whatever the case', () =>
  assert.strictEqual(cdupes({ first: 'THABO', last: 'nkosi', offtakerId: 'o1', email: '' }, people).sameCompany.id, 'c1'));
test('the same name at another company is not', () =>
  assert.strictEqual(cdupes({ first: 'Thabo', last: 'Nkosi', offtakerId: 'o2', email: '' }, people).sameCompany, null));
test('the same email is the same person, even under another name or company', () =>
  assert.strictEqual(cdupes({ first: 'T', last: 'N', offtakerId: 'o2', email: 'Thabo@A.co.za' }, people).sameEmail.id, 'c1'));
test('no email and no name finds nothing', () => {
  const r = cdupes({ first: '', last: '', offtakerId: 'o1', email: '' }, people);
  assert.strictEqual(r.sameCompany, null);
  assert.strictEqual(r.sameEmail, null);
});
test('the contact being edited is not a duplicate of itself', () =>
  assert.strictEqual(cdupes({ id: 'c1', first: 'Thabo', last: 'Nkosi', offtakerId: 'o1', email: 'thabo@a.co.za' }, people).sameCompany, null));

console.log('\nThe warning on the page');
test('an exact off-taker match says it will not be saved twice, with a link to the record', () => {
  const s = sandbox();
  s.state.offtakers = [{ id: 'o2', name: 'Sasol Limited', short: 'Sasol' }];
  s.dom.document.getElementById('mo-name').value = 'sasol limited';
  run(s, 'qcCheckOfftaker()');
  const b = s.dom.els['mo-dupe'];
  assert.strictEqual(b.hidden, false);
  assert.ok(/already on file/i.test(b.innerHTML) && /qcOpenRecord/.test(b.innerHTML), b.innerHTML);
});
test('a near match says possible duplicate, and never hides the form', () => {
  const s = sandbox();
  s.state.offtakers = [{ id: 'o1', name: 'Samancor Chrome — Middelburg', short: 'Samancor' }];
  s.dom.document.getElementById('mo-name').value = 'Samancor Chrome';
  run(s, 'qcCheckOfftaker()');
  assert.strictEqual(s.dom.els['mo-dupe'].hidden, false);
  assert.ok(/possible duplicate/i.test(s.dom.els['mo-dupe'].innerHTML));
});
test('no match hides the warning again', () => {
  const s = sandbox();
  s.state.offtakers = [{ id: 'o2', name: 'Sasol Limited' }];
  s.dom.document.getElementById('mo-name').value = 'Sasol Limited';
  run(s, 'qcCheckOfftaker()');
  s.dom.document.getElementById('mo-name').value = 'Something Else Entirely';
  run(s, 'qcCheckOfftaker()');
  assert.strictEqual(s.dom.els['mo-dupe'].hidden, true);
});
test('editing a record never warns that it duplicates itself', () => {
  const s = sandbox();
  s.state.offtakers = [{ id: 'o2', name: 'Sasol Limited' }];
  s.state.editOfftakerId = 'o2';
  s.dom.document.getElementById('mo-name').value = 'Sasol Limited';
  run(s, 'qcCheckOfftaker()');
  assert.strictEqual(s.dom.els['mo-dupe'].hidden, true);
});
test('a contact already on file for the company is flagged', () => {
  const s = sandbox();
  s.state.contacts = [{ id: 'c1', first: 'Thabo', last: 'Nkosi', offtakerId: 'o1', email: '' }];
  ['mc-first', 'mc-last', 'mc-offtaker', 'mc-email'].forEach(id => s.dom.document.getElementById(id));
  s.dom.els['mc-first'].value = 'Thabo'; s.dom.els['mc-last'].value = 'Nkosi'; s.dom.els['mc-offtaker'].value = 'o1';
  run(s, 'qcCheckContact()');
  assert.strictEqual(s.dom.els['mc-dupe'].hidden, false);
  assert.ok(/already on file/i.test(s.dom.els['mc-dupe'].innerHTML));
});

console.log('\nCreate & open');
test('creating an off-taker and opening it goes to its page; plain Create stays where you were', () => {
  const body = /function saveOfftaker\([^)]*\) \{[\s\S]*?\n\}/.exec(read('js/forms.js'))[0];
  assert.ok(/saveOfftaker\(andOpen\)/.test(body), 'takes the flag');
  assert.ok(/nav\('detail'/.test(body) && /andOpen/.test(body.slice(body.indexOf('closeModal'))), 'opens the record after saving');
});
test('creating a contact and opening it goes to its company\'s page, or stays if it has none', () => {
  const body = /function saveContact\([^)]*\) \{[\s\S]*?\n\}/.exec(read('js/forms.js'))[0];
  assert.ok(/saveContact\(andOpen\)/.test(body));
  assert.ok(/accountView\(/.test(body) && /andOpen/.test(body.slice(body.indexOf('closeModal'))));
});
test('the opportunity and activity savers are untouched by it', () => {
  assert.ok(/function saveDeal\(\)/.test(read('js/forms.js')) && /function saveInteraction\(\)/.test(read('js/forms.js')));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
