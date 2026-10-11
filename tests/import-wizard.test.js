/* The Import wizard as a person meets it: four steps on a page, a column-mapping screen, a
 * review that says what will and will not go in, and nothing written until Import is pressed.
 *
 * Runs the real js/views-import.js and js/import-rules.js beside the real core.js, with the
 * page, toast, navigation and server writes replaced by recorders, so no browser is needed.
 * Also reads index.html, core.js and the views as text to check the old dialog is gone and
 * every Import button opens the wizard.
 *
 *   node tests/import-wizard.test.js
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
const { ctx } = makeSandbox({ files: ['js/import-rules.js', 'js/views-import.js'] });
vm.runInContext(read('js/views-contactfinder.js').match(/const FIND_EMAIL_RE[^\n]*\nfunction findHasEmail[^\n]*/)[0], ctx);
vm.runInContext(`var __html = '', __page = null, __navs = [], __toasts = [], __saves = 0, __pushed = [], __failOn = null;
  setPage = (t, s, a) => { __page = { t, s, a }; }; setContent = h => { __html = h; };
  nav = v => { __navs.push(v); }; toast = (m, k) => { __toasts.push([m, k || '']); }; save = () => { __saves++; };
  pushContact = async r => { if (__failOn && __failOn(r)) throw new Error('refused'); __pushed.push(r); };
  pushOfftaker = async r => { __pushed.push(r); }; updateNavBadges = () => {};`, ctx);
/* Recorders for what a browser would do: where focus went, how often the page was drawn, the saving line
   (updated in place), files offered for download, and a FileReader the test finishes by hand. */
vm.runInContext(`var __status = { textContent: '', warn: false, classList: { toggle(c, on) { __status.warn = !!on; } } },
  __focus = [], __renders = 0, __downloads = [], __reader = null, __fields = {};
  var __getEl = document.getElementById;
  document.getElementById = id => id === 'imp-status' ? __status : (id.indexOf('imp-map-') === 0 ? (__fields[id] = __fields[id] || { focus() { __focus.push(id); } }) : __getEl(id));
  document.querySelector = sel => ({ focus() { __focus.push(sel); } });
  var __setContent = setContent; setContent = h => { __renders++; __setContent(h); };
  downloadCSV = (name, rows) => { __downloads.push({ name, rows }); };
  class FileReader { readAsText(f) { this.file = f; __reader = this; } }`, ctx);

let pass = 0, fail = 0;
const queue = [];
function test(name, fn) { queue.push([name, fn]); }
const ev = code => vm.runInContext(code, ctx);
const json = code => JSON.parse(JSON.stringify(ev(code)));
const html = () => ev('__html');
const text = () => html().replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const lines = (...ls) => ls.join('\n') + '\n';
const count = (s, re) => (s.match(re) || []).length;

const BOOK_OFFTAKERS = [
  { id: 'o1', name: 'Sasol Limited', short: 'Sasol', sector: 'mining', status: 'prospect' },
  { id: 'o2', name: 'Harmony Gold Mining', short: 'Harmony', sector: 'mining', status: 'prospect' },
];
const BOOK_CONTACTS = [{ id: 'c1', offtakerId: 'o1', first: 'Existing', last: 'Person', email: 'existing@sasol.com' }];

/* A clean book, a clean recorder and a wizard that has not been opened. */
function fresh(role) {
  ctx.__off = BOOK_OFFTAKERS; ctx.__con = BOOK_CONTACTS;
  ev(`state.role = ${JSON.stringify(role || 'admin')}; state.imp = null; state.view = 'import';
    state.offtakers.length = 0; state.contacts.length = 0;
    __off.forEach(o => state.offtakers.push(Object.assign({}, o))); __con.forEach(c => state.contacts.push(Object.assign({}, c)));
    __html = ''; __page = null; __navs = []; __toasts = []; __saves = 0; __pushed = []; __failOn = null;
    __status.textContent = ''; __status.warn = false; __focus = []; __renders = 0; __downloads = []; __reader = null;`);
}
const open = (kind, csvText, name) => { fresh(); ev(`openImport(${JSON.stringify(kind)})`); ev('renderImport()'); if (csvText != null) ev(`importLoadText(${JSON.stringify(csvText)}, ${JSON.stringify(name || 'people.csv')})`); };
const step = () => ev('state.imp.step');

const CONTACTS_CSV = lines(
  'First Name,Surname,Title,Company,Email Address,Mobile,Province,Favourite colour',
  'Thandi,Mokoena,CFO,Sasol,thandi@sasol.com,082 111,Gauteng,blue',                  // line 2: goes in
  'Pieter,Botha,Engineer,Harmony Gold,,,,red',                                         // line 3: no email
  'Lerato,Dlamini,Manager,Emalahleni,lerato@emalahleni.gov.za,,,green',                // line 4: two municipalities fit
  'Sipho,Khumalo,MM,Emalahleni,sipho@emalahleni.gov.za,,Mpumalanga,',                  // line 5: goes in, a municipality
  'Existing,Person,Buyer,Sasol,existing@sasol.com,,,',                                 // line 6: already in the CRM
  'Ayanda,Ngcobo,Analyst,Unknown Co,ayanda@unknown.co.za,,,',                          // line 7: goes in, unassigned
);
const OFFTAKERS_CSV = lines(
  'Name,Sector,Province,GWh',
  'Cape Smelters,Mining & Minerals (Producer),WC,"1 200,5"',                           // goes in
  'Bay Foods,zzz,Atlantis,',                                                           // goes in: bad sector, bad province, no load
  'Sasol Limited,mining,Gauteng,10',                                                   // already in the CRM
);

/* ─── ENTRY AND ACCESS ────────────────────────────────────────── */
console.log('\nOpening the wizard');
test('Import CSV opens the wizard on a fresh step one, for the kind asked for', () => {
  fresh(); ev("openImport('offtakers')");
  assert.deepStrictEqual(json('__navs'), ['import']);
  assert.strictEqual(ev('state.imp.kind'), 'offtakers');
  assert.strictEqual(step(), 1);
  fresh(); ev("openImport('anything else')");
  assert.strictEqual(ev('state.imp.kind'), 'contacts', 'an unknown kind is contacts');
});
test('each time it is opened it starts clean, so a file chosen earlier is never carried over', () => {
  open('contacts', CONTACTS_CSV);
  assert.strictEqual(step(), 2);
  ev("openImport('contacts')");
  assert.strictEqual(step(), 1);
  assert.strictEqual(ev('state.imp.table'), null);
});
test('a viewer cannot open it, and the page says why if they get there by address', () => {
  fresh('viewer'); ev("openImport('contacts')");
  assert.deepStrictEqual(json('__navs'), []);
  assert.ok(json('__toasts')[0][0].includes('Read-only'));
  assert.strictEqual(ev('state.imp'), null);
  ev('renderImport()');
  assert.ok(text().includes('Importing is for admins'));
  assert.ok(!html().includes('type="file"'), 'no file chooser for a viewer');
});
test('a viewer cannot import even with a file in hand', () => {
  open('contacts', CONTACTS_CSV); ev('importContinue()');
  ev("state.role = 'viewer'"); ev('runImportNow()');
  assert.strictEqual(ev('state.contacts.length'), 1);
  assert.strictEqual(ev('__saves'), 0);
});
test('every Import button, sidebar link and Settings row opens the wizard, and only for admins', () => {
  const sidebar = read('index.html');
  ["openImport('contacts')", "openImport('offtakers')"].forEach(c => assert.ok(new RegExp('data-admin-only onclick="' + c.replace(/[()]/g, '\\$&') + '"').test(sidebar), 'sidebar ' + c));
  const offs = read('js/views-offtakers.js'), munis = read('js/views-municipalities.js'), sets = read('js/views-settings.js');
  assert.strictEqual(count(offs, /data-admin-only onclick="openImport\(\\'(offtakers|contacts)\\'\)"/g), 2, 'off-taker and contact lists');
  assert.ok(/data-admin-only onclick="openImport\(\\'contacts\\'\)"/.test(munis), 'municipalities');
  assert.ok(sets.includes("openImport('contacts')") && sets.includes("openImport('offtakers')") && /data-admin-only onclick="' \+ call/.test(sets), 'settings');
});

/* ─── THE OLD DIALOG IS GONE ──────────────────────────────────── */
console.log('\nThe old dialog');
test('its markup is gone from index.html and its code from core.js', () => {
  const index = read('index.html'), core = read('js/core.js');
  ['modal-import', 'imp-file', 'imp-preview', 'imp-go', 'previewImport', 'runImport('].forEach(s => assert.ok(!index.includes(s), 'index.html still has ' + s));
  ['_importRows', '_importKind', 'IMPORT_HINT', 'previewImport', 'previewContactImport', 'previewOfftakerImport', 'runImport', 'runOfftakerImport', 'importMsg', 'modal-import']
    .forEach(s => assert.ok(!core.includes(s), 'core.js still has ' + s));
});
test('the wizard and its rules are loaded after core.js, and the router has the page', () => {
  const index = read('index.html');
  const at = f => index.indexOf('<script src="' + f + '">');
  assert.ok(at('js/core.js') > 0 && at('js/import-rules.js') > at('js/core.js') && at('js/views-import.js') > at('js/import-rules.js'));
  assert.ok(/import: renderImport,/.test(read('js/core.js')));
});
test('the breadcrumb leads back to the list the file would fill', () => {
  open('contacts');
  assert.deepStrictEqual(json("crumbsFor('import').map(c => c.label)"), ['Contacts', 'Import CSV']);
  open('offtakers');
  assert.deepStrictEqual(json("crumbsFor('import').map(c => c.label)"), ['Off-taker Prospects', 'Import CSV']);
});

/* ─── STEP 1: UPLOAD ──────────────────────────────────────────── */
console.log('\nStep 1: Upload');
test('four numbered steps, the first current', () => {
  open('contacts');
  const h = html();
  assert.strictEqual(count(h, /<li class="wiz-step/g), 4);
  ['Upload', 'Map columns', 'Review', 'Import'].forEach(l => assert.ok(h.includes('<span class="wiz-l">' + l + '</span>'), l));
  assert.ok(/<li class="wiz-step cur" aria-current="step"><span class="wiz-btn"><span class="wiz-n">1<\/span><span class="wiz-l">Upload/.test(h));
  assert.strictEqual(count(h, /wiz-step todo/g), 3);
});
test('it takes a file, offers the choice of kind and shows the columns it recognises', () => {
  open('contacts');
  const t = text();
  assert.ok(html().includes('type="file"') && html().includes('accept=".csv,text/csv"'));
  assert.ok(t.includes('Contacts') && t.includes('Off-takers'));
  ['First name', 'Last name', 'Work email', 'surname', 'e-mail', 'given name'].forEach(s => assert.ok(t.includes(s), 'recognised: ' + s));
  assert.ok(t.includes('A work email is required'), 'the email rule is stated');
  open('offtakers');
  const o = text();
  ['Company name', 'Annual GWh', 'gwh/yr', 'Sector', 'Province'].forEach(s => assert.ok(o.includes(s), 'recognised: ' + s));
  assert.ok(o.includes('Province accepts abbreviations'));
});
test('switching kind starts the file over for the other kind', () => {
  open('contacts');
  ev("setImportKind('offtakers')");
  assert.strictEqual(ev('state.imp.kind'), 'offtakers');
  assert.ok(text().includes('Company name'));
  assert.ok(html().includes('class="view-tab active"') && /view-tab active"[^>]*>Off-takers/.test(html()));
});
test('a file with a header and no rows stays on step one and says so', () => {
  open('contacts', 'First,Last,Email\n');
  assert.strictEqual(step(), 1);
  assert.ok(text().includes('That file has no data rows.'));
  open('contacts', '');
  assert.strictEqual(step(), 1);
  assert.ok(text().includes('That file has no data rows.'));
});

/* ─── STEP 2: MAP COLUMNS ─────────────────────────────────────── */
console.log('\nStep 2: Map columns');
test('a file moves to step two, with its name and size', () => {
  open('contacts', CONTACTS_CSV, 'people.csv');
  assert.strictEqual(step(), 2);
  assert.ok(text().includes('people.csv · 6 rows · 8 columns'), text().slice(0, 400));
  assert.ok(/<li class="wiz-step done"><button class="wiz-btn" onclick="goImportStep\(1\)"/.test(html()), 'step one is done, and a way back');
  assert.ok(/<li class="wiz-step cur" aria-current="step"><span class="wiz-btn"><span class="wiz-n">2/.test(html()));
});
test('every column is listed with its first values, the field it was matched to, and Matched or Skip', () => {
  open('contacts', CONTACTS_CSV);
  const h = html();
  assert.strictEqual(count(h, /<div class="imp-row(?: skip)?">/g), 8, 'one row per column');
  ['First Name', 'Surname', 'Title', 'Company', 'Email Address', 'Mobile', 'Province', 'Favourite colour'].forEach(c => assert.ok(h.includes('<b>' + c + '</b>'), c));
  assert.ok(h.includes('Thandi<i>·</i>Pieter<i>·</i>Lerato'), 'three samples joined');
  assert.ok(/<option value="first" selected>First name/.test(h) && /<option value="last" selected>Last name/.test(h) && /<option value="email" selected>Work email/.test(h));
  assert.strictEqual(count(h, /badge b-contracted">Matched/g), 7);
  assert.strictEqual(count(h, /badge b-low">Skip/g), 1, 'the column nobody recognised is skipped');
  assert.ok(/imp-row skip"><div class="imp-col"><b>Favourite colour/.test(h));
  assert.ok(text().includes('7 matched'));
});
test('the fields no column feeds are listed', () => {
  open('contacts', CONTACTS_CSV);
  assert.ok(text().includes('No column for: Department, LinkedIn, Notes.'), text().slice(-500));
});
test('a column can be re-pointed, and the field leaves the column that had it', () => {
  open('contacts', CONTACTS_CSV);
  ev("setImportMap(7, 'notes')");
  assert.ok(/<option value="notes" selected>Notes/.test(html()));
  assert.strictEqual(count(html(), /badge b-low">Skip/g), 0);
  ev("setImportMap(7, 'email')");
  assert.deepStrictEqual(json('state.imp.mapping.filter(Boolean).length'), 7, 'email moved to column 8');
  assert.strictEqual(count(html(), /badge b-low">Skip/g), 1, 'the old email column is now skipped');
  const old = html().match(/<select id="imp-map-4"[^>]*>(?:(?!<\/select>).)*<\/select>/)[0];
  assert.ok(!/ selected>/.test(old), 'the old email column has no field chosen');
  assert.ok(/<select id="imp-map-7"[^>]*>(?:(?!<\/select>).)*<option value="email" selected>/.test(html()), 'the new one does');
});
test('"Don\'t import" skips a column', () => {
  open('contacts', CONTACTS_CSV);
  ev("setImportMap(2, '')");
  assert.strictEqual(count(html(), /badge b-low">Skip/g), 2);
  assert.ok(text().includes('6 matched'));
});
test('a file whose name columns are not recognised cannot continue until one is matched', () => {
  open('contacts', lines('Forename,Mail', 'Ann,ann@x.co.za'));
  assert.ok(text().includes('No column is matched to First name or Last name'));
  assert.ok(/<button class="btn btn-primary btn-sm" onclick="importContinue\(\)" disabled>Continue/.test(html()));
  ev('importContinue()');
  assert.strictEqual(step(), 2, 'Continue does nothing while blocked');
  ev("setImportMap(0, 'first')");
  assert.ok(!/importContinue\(\)" disabled/.test(html()));
  ev('importContinue()');
  assert.strictEqual(step(), 3);
});
test('a contacts file in the off-taker wizard is stopped, and can be sent the right way with one click', () => {
  open('offtakers', CONTACTS_CSV);
  assert.ok(text().includes('This looks like a contacts file'));
  assert.ok(html().includes("importUseKind('contacts')") && text().includes('Import it as contacts'));
  assert.ok(/importContinue\(\)" disabled/.test(html()));
  ev("importUseKind('contacts')");
  assert.strictEqual(ev('state.imp.kind'), 'contacts');
  assert.strictEqual(step(), 2);
  assert.ok(!text().includes('This looks like a contacts file'));
  assert.ok(!/importContinue\(\)" disabled/.test(html()));
});
test('what the file says is shown as text, never as markup', () => {
  open('contacts', lines('First,Email,<img src=x onerror=alert(1)>', 'Ann,a@x.co.za,<b>bold</b>'));
  assert.ok(!html().includes('<img src=x'), 'header escaped');
  assert.ok(html().includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html().includes('&lt;b&gt;bold&lt;/b&gt;'));
});
test('names and companies from the file are escaped on Review and on the result too', async () => {
  open('contacts', lines('First,Last,Company,Email', '<b>Ann</b>,Lee,<i>Co</i>,a@x.co.za', '<u>Bo</u>,Chen,<i>Co</i>,')); ev('importContinue()');
  const h = html();
  assert.ok(h.includes('&lt;b&gt;Ann&lt;/b&gt; Lee') && h.includes('&lt;i&gt;Co&lt;/i&gt;'), 'going sample');
  assert.ok(h.includes('&lt;u&gt;Bo&lt;/u&gt; Chen'), 'held row');
  assert.ok(!h.includes('<u>Bo') && !h.includes('<i>Co') && !h.includes('<b>Ann'), 'nothing from the file is live markup');
  open('offtakers', lines('Name,Sector,Province', '<s>Acme</s>,mining,Gauteng')); ev('importContinue()');
  assert.ok(html().includes('&lt;s&gt;Acme&lt;/s&gt;') && !html().includes('<s>Acme'));
});
test('a column with no header or no values still draws', () => {
  open('contacts', lines('First,,Email', 'Ann,,a@x.co.za'));
  assert.ok(html().includes('(no header)') && html().includes('no values'));
});

/* ─── STEP 3: REVIEW ──────────────────────────────────────────── */
console.log('\nStep 3: Review');
test('Review says how many will go in, how many are held back, and why', () => {
  open('contacts', CONTACTS_CSV); ev('importContinue()');
  assert.strictEqual(step(), 3);
  const t = text();
  assert.ok(/3 will be imported/.test(t) && /3 held back/.test(t) && /6 rows read/.test(t), t.slice(0, 300));
  assert.ok(t.includes('1 matched to an off-taker, 1 to a municipality; 1 will be filed as unassigned'));
  ['No work email 1', 'Municipality unclear 1', 'Already on file 1'].forEach(s => assert.ok(t.includes(s), s));
  assert.ok(/ 3 Pieter Botha Harmony Gold No work email\. Add the address/.test(t), 'line number, person, company and reason');
  assert.ok(/ 4 Lerato Dlamini Emalahleni 2 municipalities fit \(.*MP312.*EC136|EC136.*MP312/.test(t), 'candidates named');
  assert.ok(/ 6 Existing Person Sasol Already in the CRM/.test(t));
});
test('Review lists the rows that will go in, with where each is filed', () => {
  open('contacts', CONTACTS_CSV); ev('importContinue()');
  const h = html();
  assert.ok(h.includes('Will be imported'));
  assert.ok(/<td>Thandi Mokoena<\/td><td>CFO<\/td><td>Sasol<\/td><td>thandi@sasol.com<\/td><td><span class="badge b-contracted">Sasol<\/span>/.test(h));
  assert.ok(/<td>Sipho Khumalo<\/td>[\s\S]*?<span class="badge b-prospect">Emalahleni<\/span> <span class="wiz-sub">municipality · MP312/.test(h));
  assert.ok(/<td>Ayanda Ngcobo<\/td>[\s\S]*?<span class="badge b-low">unassigned/.test(h));
});
test('the Import button says how many, and Back, Cancel and the step bar all lead out', () => {
  open('contacts', CONTACTS_CSV); ev('importContinue()');
  assert.ok(/onclick="runImportNow\(\)">Import 3 contacts</.test(html()));
  assert.ok(html().includes('onclick="goImportStep(2)">Back') && html().includes('onclick="cancelImport()">Cancel'));
  assert.ok(html().includes('onclick="goImportStep(1)"') && html().includes('onclick="goImportStep(2)" title="Go back to Map columns"'));
});
test('changing a mapping changes the Review counts', () => {
  open('contacts', CONTACTS_CSV); ev('importContinue()');
  assert.ok(/3 will be imported/.test(text()));
  ev('goImportStep(2)');
  ev("setImportMap(4, '')");                       // skip the email column
  ev('importContinue()');
  const t = text();
  assert.ok(/0 will be imported/.test(t) && /6 held back/.test(t), t.slice(0, 200));
  assert.ok(/runImportNow\(\)" disabled>Import 0 contacts/.test(html()), 'nothing to import, so the button is off');
  assert.ok(t.includes('Nothing in this file can be imported.'));
  ev('goImportStep(2)'); ev("setImportMap(4, 'email')"); ev('importContinue()');
  assert.ok(/3 will be imported/.test(text()), 'matching it again brings them back');
});
test('a long list of held rows shows the first 25 and counts the rest', () => {
  const rows = Array.from({ length: 30 }, (_, i) => 'P' + i + ',Q' + i + ',').join('\n');
  open('contacts', 'First,Last,Email\n' + rows + '\n'); ev('importContinue()');
  assert.ok(text().includes('and 5 more'));
  assert.strictEqual(count(html(), /<td class="wiz-why">/g), 25);
});
test('a row with no name is not counted, and Review says it was ignored', () => {
  open('contacts', lines('First,Last,Email', ',,x@y.co.za', 'Ann,Lee,a@x.co.za')); ev('importContinue()');
  assert.ok(text().includes('1 row has no name and is ignored.'));
  assert.ok(/ 2 rows read/.test(text()), 'rows read is every data row, the same number Map columns gave');
  assert.ok(/ 1 will be imported/.test(text()) && /0 held back/.test(text()), 'and the ignored row is neither imported nor held');
});
test('the off-takers review warns about what would land in the wrong place', () => {
  open('offtakers', OFFTAKERS_CSV); ev('importContinue()');
  const t = text();
  assert.ok(/2 will be imported/.test(t) && /1 held back/.test(t) && /3 rows read/.test(t));
  assert.ok(t.includes('1 carries no load figure yet, so it sits at the bottom of the list'), 'no-load note, singular');
  open('offtakers', lines('Name,GWh', 'A Co,', 'B Co,', 'C Co,5')); ev('importContinue()');
  assert.ok(text().includes('2 carry no load figures yet, so they sit at the bottom of the list'), 'no-load note, plural');
  open('offtakers', OFFTAKERS_CSV); ev('importContinue()');
  assert.ok(t.includes('had no sector that could be matched (e.g. “zzz”)') && t.includes('filed under Mining & Minerals'));
  assert.ok(t.includes('had a province that could not be matched (e.g. “Atlantis”)') && t.includes('wrong place on the map'));
  assert.ok(/Sasol Limited Already in the CRM: same name or short name/.test(t));
  assert.ok(/Cape Smelters/.test(t) && /Western Cape/.test(t) && /1200\.5/.test(t));
});
test('steps can only be walked back, never skipped forward', () => {
  open('contacts', CONTACTS_CSV);
  ev('goImportStep(3)'); assert.strictEqual(step(), 2, 'no jumping to Review');
  ev('goImportStep(4)'); assert.strictEqual(step(), 2, 'never to Import');
  ev('importContinue()'); ev('goImportStep(2)'); assert.strictEqual(step(), 2);
  ev('goImportStep(1)'); assert.strictEqual(step(), 1);
  assert.strictEqual(ev('state.imp.table.length'), 7, 'going back keeps the file');
  ev('goImportStep(0)'); assert.strictEqual(step(), 1);
});

/* ─── NOTHING IS WRITTEN UNTIL IMPORT ─────────────────────────── */
console.log('\nLeaving costs nothing');
test('steps one to three write nothing', () => {
  open('contacts', CONTACTS_CSV); ev("setImportMap(7, 'notes')"); ev('importContinue()'); ev('goImportStep(2)'); ev('importContinue()');
  assert.strictEqual(ev('state.contacts.length'), 1);
  assert.strictEqual(ev('__saves'), 0);
  assert.deepStrictEqual(json('__pushed'), []);
  open('offtakers', OFFTAKERS_CSV); ev('importContinue()');
  assert.strictEqual(ev('state.offtakers.length'), 2);
  assert.deepStrictEqual(json('__pushed'), []);
});
test('cancelling at any step imports nothing and returns to the list', () => {
  [1, 2, 3].forEach(s => {
    open('contacts', s === 1 ? null : CONTACTS_CSV);
    if (s === 3) ev('importContinue()');
    assert.strictEqual(step(), s);
    ev('cancelImport()');
    assert.strictEqual(ev('state.contacts.length'), 1, 'step ' + s);
    assert.strictEqual(ev('state.imp'), null);
    assert.deepStrictEqual(json('__navs').slice(-1), ['contacts']);
    assert.strictEqual(ev('__saves'), 0);
  });
  open('offtakers', OFFTAKERS_CSV); ev('cancelImport()');
  assert.deepStrictEqual(json('__navs').slice(-1), ['offtakers']);
  assert.strictEqual(ev('state.offtakers.length'), 2);
});

/* ─── STEP 4: IMPORT ──────────────────────────────────────────── */
console.log('\nStep 4: Import');
test('contacts: Import stores what Review promised, sends each to the server, and shows the result', async () => {
  open('contacts', CONTACTS_CSV); ev('importContinue()');
  ev('__renders = 0');
  await ev('runImportNow()');
  assert.strictEqual(step(), 4);
  const added = json('state.contacts.slice(1)');
  assert.deepStrictEqual(added.map(c => c.first + ' ' + c.last), ['Thandi Mokoena', 'Sipho Khumalo', 'Ayanda Ngcobo']);
  assert.deepStrictEqual(added.map(c => c.offtakerId), ['o1', 'mun_MP312', '']);
  added.forEach(c => assert.ok(/^c_/.test(c.id) && c.role === 'influencer' && c.priority === 'medium' && c.status === 'active'));
  assert.deepStrictEqual(json('__pushed').map(c => c.email), ['thandi@sasol.com', 'sipho@emalahleni.gov.za', 'ayanda@unknown.co.za'], 'one at a time, in file order');
  assert.strictEqual(ev('__saves'), 1);
  const t = text();
  assert.ok(t.includes('Imported 3 new contacts'), t);
  assert.ok(t.includes('3 held back') && t.includes('1 · no work email') && t.includes('1 · municipality unclear') && t.includes('1 · already on file'));
  assert.ok(t.includes('Saving to the server'), 'the page is drawn once, while the server is still being written to');
  assert.ok(ev('__status.textContent').includes('Finished saving'), 'and the saving line is updated where it stands');
  assert.ok(html().includes('id="imp-status" role="status"'), 'a live region, so a screen reader hears it change');
  assert.strictEqual(ev('__renders'), 1, 'the page is not drawn again when the saving finishes, so focus is not lost');
  assert.ok(html().includes("nav('contacts')") && t.includes('View contacts') && t.includes('Import another file'));
  assert.ok(json('__toasts')[0][0].startsWith('Imported 3 new contacts · 3 held back'));
  assert.strictEqual(count(html(), /wiz-step done/g), 3, 'steps one to three are done');
  assert.ok(!html().includes('goImportStep('), 'no way back into a finished import');
});
test('off-takers: Import stores the records, a sector nothing matched goes under Mining, and each is sent to the server', async () => {
  open('offtakers', OFFTAKERS_CSV); ev('importContinue()');
  await ev('runImportNow()');
  const added = json('state.offtakers.slice(2)');
  assert.deepStrictEqual(added.map(o => [o.name, o.sector, o.province, o.annualGwh, o.estimated]),
    [['Cape Smelters', 'mining', 'Western Cape', 1200.5, true], ['Bay Foods', 'mining', 'Atlantis', 0, false]]);
  added.forEach(o => assert.ok(/^o_/.test(o.id)));
  assert.strictEqual(json('__pushed').length, 2);
  assert.ok(text().includes('Imported 2 new off-takers') && text().includes('1 · already on file') && text().includes('View off-takers'));
});
test('importing twice is not possible: the second press does nothing', async () => {
  open('contacts', CONTACTS_CSV); ev('importContinue()');
  await ev('runImportNow()'); await ev('runImportNow()');
  assert.strictEqual(ev('state.contacts.length'), 4);
  assert.strictEqual(json('__pushed').length, 3);
});
test('a record added after Review is not added again: the rows are judged once more at Import', async () => {
  open('contacts', CONTACTS_CSV); ev('importContinue()');
  ev("state.contacts.push({ id: 'cx', offtakerId: 'o1', first: 'Thandi', last: 'Mokoena', email: 'thandi@sasol.com' })");
  await ev('runImportNow()');
  assert.ok(text().includes('Imported 2 new contacts'));
  assert.strictEqual(ev("state.contacts.filter(c => c.email === 'thandi@sasol.com').length"), 1);
});
test('one record reads as singular', async () => {
  open('contacts', lines('First,Last,Email', 'Ann,Lee,a@x.co.za')); ev('importContinue()');
  assert.ok(html().includes('Import 1 contact<'));
  await ev('runImportNow()');
  assert.ok(text().includes('Imported 1 new contact') && !text().includes('1 new contacts'));
});
test('a file with nothing importable cannot be imported', async () => {
  open('contacts', lines('First,Last,Email', 'Ann,Lee,')); ev('importContinue()');
  await ev('runImportNow()');
  assert.strictEqual(step(), 3);
  assert.strictEqual(ev('state.contacts.length'), 1);
});
test('a record the server refuses is counted, kept locally, and reported', async () => {
  open('contacts', CONTACTS_CSV); ev('importContinue()');
  ev("__failOn = r => r.first === 'Sipho'");
  await ev('runImportNow()');
  assert.strictEqual(ev('state.contacts.length'), 4, 'still stored in this browser');
  assert.ok(json('__toasts').some(([m, k]) => /1 of 3 saved locally only/.test(m) && k === 'warn'));
  assert.ok(ev('__status.textContent').includes('1 of 3 are saved in this browser only'));
  assert.strictEqual(ev('__status.warn'), true, 'and the line is marked as a warning');
});
test('Import another file starts a fresh wizard for the same kind', async () => {
  open('offtakers', OFFTAKERS_CSV); ev('importContinue()'); await ev('runImportNow()');
  ev('importMore()');
  assert.deepStrictEqual(json('__navs').slice(-1), ['import']);
  assert.strictEqual(ev('state.imp.kind'), 'offtakers');
  assert.strictEqual(step(), 1);
});

/* ─── FROM THE INDEPENDENT REVIEW ─────────────────────────────── */
console.log('\nFrom the independent review');
test('back on Upload with a file already read, the page says so and offers to carry on with the mapping as left', () => {
  open('contacts', CONTACTS_CSV); ev("setImportMap(7, 'notes')");
  ev('goImportStep(1)');
  assert.ok(text().includes('people.csv · 6 rows · 8 columns already read'));
  assert.ok(html().includes('onclick="importResume()">Continue with this file') && text().includes('Choose a different file'));
  ev('importResume()');
  assert.strictEqual(step(), 2);
  assert.strictEqual(ev('state.imp.mapping[7]'), 'notes', 'the hand-made match is still there');
  open('contacts');
  assert.ok(!html().includes('importResume'), 'and with no file read there is nothing to carry on with');
});
test('with a file already read, choosing the other kind reads the same file again for it', () => {
  open('contacts', lines('Name,Sector', 'Cape Smelters,mining'));
  ev('goImportStep(1)');
  ev("setImportKind('offtakers')");
  assert.strictEqual(ev('state.imp.kind'), 'offtakers');
  assert.strictEqual(step(), 2);
  assert.strictEqual(ev('state.imp.table.length'), 2, 'the file was kept');
  assert.ok(!/importContinue\(\)" disabled/.test(html()), 'and read as off-takers it has its company name');
});
test('a file that is not a CSV is refused with a reason before it is read', () => {
  open('contacts');
  ev("importReadFile({ name: 'targets.xlsx', type: 'application/vnd.ms-excel' })");
  assert.ok(text().includes('does not look like a CSV file'));
  assert.strictEqual(ev('__reader'), null, 'it was never read');
  assert.strictEqual(step(), 1);
});
test('a slow read that finishes after the person has left is dropped, and one that finishes in time loads', () => {
  open('contacts');
  ev("importReadFile({ name: 'a.csv', type: 'text/csv' })");
  ev("cancelImport(); state.view = 'dashboard'");
  const before = html();
  ev('__reader.result = ' + JSON.stringify(CONTACTS_CSV) + '; __reader.onload()');
  assert.strictEqual(html(), before, 'nothing was drawn over the page the person is on');
  assert.strictEqual(ev('state.imp'), null);
  open('contacts');
  ev("importReadFile({ name: 'a.csv', type: 'text/csv' })");
  ev("state.view = 'dashboard'");
  const elsewhere = html();
  ev('__reader.result = ' + JSON.stringify(CONTACTS_CSV) + '; __reader.onload()');
  assert.strictEqual(html(), elsewhere, 'nor over another page when the person simply went there by the sidebar');
  assert.strictEqual(step(), 1);
  open('contacts');
  ev("importReadFile({ name: 'a.csv', type: 'text/csv' })");
  ev('__reader.result = ' + JSON.stringify(CONTACTS_CSV) + '; __reader.onload()');
  assert.strictEqual(step(), 2);
});
test('each step takes focus on its title, which says which step it is', () => {
  open('contacts');
  assert.ok(/id="imp-step-title" tabindex="-1"><span class="wiz-sr">Step 1 of 4: <\/span>Choose a file/.test(html()));
  ev('__focus = []'); ev('importLoadText(' + JSON.stringify(CONTACTS_CSV) + ", 'p.csv')");
  assert.deepStrictEqual(json('__focus'), ['#imp-step-title']);
  assert.ok(html().includes('Step 2 of 4: </span>Match your columns'));
  ev('__focus = []'); ev('importContinue()');
  assert.deepStrictEqual(json('__focus'), ['#imp-step-title']);
  assert.ok(html().includes('Step 3 of 4: </span>Review'));
  ev('__focus = []'); ev('goImportStep(2)');
  assert.deepStrictEqual(json('__focus'), ['#imp-step-title']);
  ev('__focus = []'); ev('importContinue()'); ev('__focus = []');
  return ev('runImportNow()').then(() => {
    assert.deepStrictEqual(json('__focus'), ['#imp-step-title'], 'and so does the result');
    assert.ok(html().includes('Step 4 of 4: </span>Import'));
  });
});
test('choosing a kind keeps focus on the tab, and re-pointing a column keeps it on that column', () => {
  open('contacts'); ev('__focus = []'); ev("setImportKind('offtakers')");
  assert.deepStrictEqual(json('__focus'), ['.wiz .view-tab.active']);
  open('contacts', CONTACTS_CSV); ev('__focus = []'); ev("setImportMap(7, 'notes')");
  assert.deepStrictEqual(json('__focus'), ['imp-map-7']);
});
test('each select is named for its column, so a screen reader knows which one it is on', () => {
  open('contacts', CONTACTS_CSV);
  assert.ok(html().includes('aria-label="CRM field for First Name"') && html().includes('aria-label="CRM field for Favourite colour"'));
  open('contacts', lines('First,,Email', 'Ann,,a@x.co.za'));
  assert.ok(html().includes('aria-label="CRM field for column 2"'));
});
test('a contacts file with no email column matched is warned about on Map columns, not left for Review to explain row by row', () => {
  open('contacts', lines('First Name,Last Name,Work Email,Company', 'Ann,Lee,ann@lee.co,Sasol', 'Bo,Ray,bo@ray.co,Harmony'));
  assert.ok(text().includes('No column is matched to Work email, so every row would be held back'));
  const warn = html().match(/<div class="wiz-warn"[^>]*>(?:(?!<\/div><\/div>)[\s\S])*?No column is matched to Work email/)[0];
  assert.ok(!warn.includes('role="alert"'), 'a warning, not an alert');
  assert.ok(!/importContinue\(\)" disabled/.test(html()), 'it can still go on');
  ev('importContinue()');
  assert.ok(text().includes('No column is matched to Work email. Go back to Map columns and choose it.'));
  assert.ok(!text().includes('Add the address to the file'), 'the addresses are in the file; the match is what is missing');
  ev('goImportStep(2)'); ev("setImportMap(2, 'email')");
  assert.ok(!text().includes('every row would be held back'));
  ev('importContinue()');
  assert.ok(/ 2 will be imported/.test(text()));
});
test('the wrong-file stop is lifted when the person matches a company column by hand', () => {
  open('offtakers', lines('First Name,Last Name,Organisation Name,Sector', 'Ann,Lee,Cape Smelters,mining'));
  assert.ok(text().includes('This looks like a contacts file') && /importContinue\(\)" disabled/.test(html()));
  assert.ok(text().includes('match the column that holds the company to Company name'), 'and the message says how');
  ev("setImportMap(2, 'name')");
  assert.ok(!text().includes('This looks like a contacts file'));
  assert.ok(!/importContinue\(\)" disabled/.test(html()));
  ev('importContinue()');
  assert.strictEqual(step(), 3);
  assert.ok(text().includes('Cape Smelters'));
});
test('the held rows can be downloaded to fix and import again, each with its line and why', () => {
  open('contacts', CONTACTS_CSV, 'people-2026-10.csv'); ev('importContinue()');
  assert.ok(html().includes('onclick="downloadHeldRows()"') && text().includes('Download held rows (CSV)'));
  ev('downloadHeldRows()');
  const d = json('__downloads')[0];
  assert.strictEqual(d.name, 'held-people-2026-10.csv');
  assert.deepStrictEqual(d.rows[0].slice(-3), ['Held because', 'Details', 'Line']);
  assert.deepStrictEqual(d.rows.slice(1).map(r => [r[0], r[r.length - 3], r[r.length - 1]]),
    [['Pieter', 'No work email', 3], ['Lerato', 'Municipality unclear', 4], ['Existing', 'Already on file', 6]]);
  assert.strictEqual(d.rows[1][1], 'Botha', 'the cells are the file\'s own');
  assert.ok(json('__toasts').slice(-1)[0][0].includes('Downloaded 3 held rows'));
  open('contacts', lines('First,Last,Email', 'Ann,Lee,a@x.co.za')); ev('importContinue()');
  assert.ok(!html().includes('downloadHeldRows'), 'nothing held, nothing to download');
  ev('downloadHeldRows()');
  assert.deepStrictEqual(json('__downloads'), []);
  open('contacts', CONTACTS_CSV); ev('importContinue()'); ev("state.role = 'viewer'"); ev('downloadHeldRows()');
  assert.deepStrictEqual(json('__downloads'), [], 'and a viewer cannot');
});
test('line numbers are the file\'s own, even with a blank line and a cell that runs over two lines', () => {
  open('contacts', 'First,Last,Email\nA,One,a@x.co.za\n\nB,Two,\nC,"Three\ncontinues",c@x.co.za\nD,Four,\n'); ev('importContinue()');
  const held = [...html().matchAll(/<td class="num">(\d+)<\/td><td>([^<]+)/g)].map(m => [m[2], Number(m[1])]);
  assert.deepStrictEqual(held, [['B Two', 4], ['D Four', 7]]);
});
test('one row and one column are not plural', () => {
  open('contacts', lines('First', 'Ann'));
  assert.ok(text().includes('people.csv · 1 row · 1 column'));
});
test('every id in a batch is new, even when the id generator repeats itself', async () => {
  open('contacts', lines('First,Last,Email', 'A,One,a@x.co.za', 'B,Two,b@x.co.za', 'C,Three,c@x.co.za')); ev('importContinue()');
  ev("var __n = 0, __realUid = uid; uid = p => ['c1', 'c1', 'x', 'x', 'y'][__n++] || ('z' + __n);");
  await ev('runImportNow()');
  ev('uid = __realUid');
  assert.deepStrictEqual(json('state.contacts.map(c => c.id)'), ['c1', 'x', 'y', 'z6'], 'none meets the book\'s c1, and none meets another in the batch');
});

/* ─── EVERY STEP, BOTH KINDS ──────────────────────────────────── */
console.log('\nAcross every step');
test('no step of either wizard says undefined, NaN or [object]', async () => {
  const seen = [];
  for (const [kind, csv] of [['contacts', CONTACTS_CSV], ['offtakers', OFFTAKERS_CSV]]) {
    open(kind); seen.push(html());
    ev(`importLoadText(${JSON.stringify(csv)}, 'f.csv')`); seen.push(html());
    ev('importContinue()'); seen.push(html());
    await ev('runImportNow()'); seen.push(html());
  }
  seen.forEach((h, i) => assert.ok(!/undefined|NaN|\[object/.test(h), 'screen ' + i));
  open('contacts'); ev('renderImport()');
  ev("state.role = 'viewer'"); ev('renderImport()'); assert.ok(!/undefined|NaN|\[object/.test(html()));
});
test('the page header names the kind and keeps to one calm line', () => {
  open('contacts');
  assert.strictEqual(json('__page').t, 'Import contacts');
  assert.ok(json('__page').s.length > 10 && json('__page').a === '');
  open('offtakers');
  assert.strictEqual(json('__page').t, 'Import off-takers');
});

/* ─── LOOK ────────────────────────────────────────────────────── */
console.log('\nStyling');
const css = read('styles.css');
const block = css.slice(css.indexOf('/* ─── IMPORT WIZARD'), css.indexOf('/* ─── QUICK-CREATE DRAWER'));
test('the wizard styles use the theme tokens only, so dark mode follows without a rule of its own', () => {
  assert.ok(block.length > 2000, 'the wizard block was found');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'no hard-coded colours: ' + (block.match(/#[0-9a-fA-F]{3,8}\b/) || [''])[0]);
  assert.ok(!/prefers-color-scheme/.test(block));
});
test('no class the wizard styles is also styled by another page: the Map page once overrode .map-row', () => {
  const rest = css.replace(block, '');
  const shared = new Set(['cur', 'done', 'todo', 'skip', 'warn', 'btn']);  // modifiers and a descendant, not owners of a rule
  const owned = [...new Set(block.match(/\.[a-z][\w-]*/g).map(c => c.slice(1)))].filter(c => !shared.has(c));
  assert.ok(owned.length > 30, 'the classes were found');
  owned.forEach(c => assert.ok(!new RegExp('\\.' + c + '(?![\\w-])').test(rest), '.' + c + ' is styled elsewhere in styles.css'));
});
test('the selects keep a visible focus ring, the current step is never squeezed on a phone, and toasts are announced', () => {
  assert.ok(/\.imp-field select:focus-visible\{outline:2px solid var\(--accent\)/.test(block));
  assert.ok(!/\.imp-field select:focus\{[^}]*outline:none/.test(block), 'no rule removes the ring');
  assert.ok(/@media\(max-width:560px\)\{[^@]*\.wiz-step\.cur\{flex:0 0 auto\}/.test(block.replace(/\n\s*/g, '')), 'the current step sizes to its content');
  assert.ok(/\.wiz-sr\{position:absolute/.test(block));
  assert.ok(read('index.html').includes('<div id="toast" role="status" aria-live="polite">'));
});
test('on a phone the step bar keeps only the current label, and the mapping table stacks', () => {
  assert.ok(/@media\(max-width:560px\)\{[^}]*\.wiz-step:not\(\.cur\) \.wiz-l\{display:none\}/.test(block.replace(/\n\s*/g, '')), 'labels');
  assert.ok(/@media\(max-width:700px\)\{[^@]*\.imp-head\{display:none\}[^@]*grid-template-areas/.test(block.replace(/\n\s*/g, '')), 'mapping rows stack');
  assert.ok(/\.imp-row\{display:grid;grid-template-columns:minmax\(120px/.test(block), 'desktop columns');
});

(async () => {
  for (const [name, fn] of queue) {
    try { await fn(); pass++; console.log('  ok   ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})();
