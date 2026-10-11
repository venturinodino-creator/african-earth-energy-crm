/* The rules behind the Import wizard: which column is which field, what a person's re-mapping
 * does, and what each row of a contacts or off-takers file would become.
 *
 * Runs js/import-rules.js beside the real core.js, so the alias tables, the province, sector
 * and municipality matching under test are the app's own. Nothing here touches a page.
 *
 *   node tests/import-rules.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const makeSandbox = require('./core-sandbox');

const { ctx, run } = makeSandbox({ files: ['js/import-rules.js'] });
/* The email gate is the Contact finder's own test of "is this a work email". */
const finder = fs.readFileSync(path.join(__dirname, '..', 'js', 'views-contactfinder.js'), 'utf8');
vm.runInContext(finder.match(/const FIND_EMAIL_RE[^\n]*\nfunction findHasEmail[^\n]*/)[0], ctx);

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
/* Call a function in the sandbox with these arguments; what comes back is plain JSON. */
function call(fn, ...args) {
  args.forEach((a, i) => { ctx['__a' + i] = a; });
  return run(fn + '(' + args.map((_, i) => '__a' + i).join(',') + ')');
}
const csv = text => call('parseCSV', text);
const lines = (...ls) => ls.join('\n') + '\n';

const BOOK = {
  offtakers: [
    { id: 'o1', name: 'Sasol Limited', short: 'Sasol' },
    { id: 'o2', name: 'Harmony Gold Mining', short: 'Harmony' },
    { id: 'o3', name: 'South African Breweries', short: 'SAB' },
  ],
  contacts: [
    { id: 'c1', offtakerId: 'o1', first: 'Existing', last: 'Person', email: 'existing@sasol.com' },
    { id: 'c2', offtakerId: 'o2', first: 'Pieter', last: 'Botha', email: '' },
  ],
};

/* ─── HEADER RECOGNITION ──────────────────────────────────────── */
console.log('\nHeader recognition');
test('contact headers are recognised however they are cased and spaced', () => {
  assert.deepStrictEqual(call('importAutoMap', 'contacts', ['First Name', ' SURNAME ', 'Job Title', 'Dept', 'Organisation', 'E-mail', 'Cell', 'LinkedIn URL', 'Comment', 'Region']),
    ['first', 'last', 'title', 'dept', 'company', 'email', 'phone', 'linkedin', 'notes', 'province']);
});
test('off-taker headers are recognised, every field', () => {
  assert.deepStrictEqual(call('importAutoMap', 'offtakers', ['Company', 'Short Name', 'Industry', 'Province', 'Town', 'Website', 'Annual GWh', 'Peak MW', 'Tariff', 'NMD', 'Supply Authority', 'Wheeling', 'Status', 'Priority', 'Description']),
    ['name', 'short', 'sector', 'province', 'city', 'website', 'gwh', 'peak', 'tariff', 'nmd', 'supply', 'wheeling', 'status', 'priority', 'description']);
});
test('a header nobody knows is skipped, and so is a blank one', () => {
  assert.deepStrictEqual(call('importAutoMap', 'contacts', ['first', 'Favourite colour', '', 'email']), ['first', '', '', 'email']);
});
test('the names are tried in order, so "email" beats "email address" wherever the columns sit', () => {
  assert.deepStrictEqual(call('importAutoMap', 'contacts', ['Email Address', 'First', 'Email']), ['', 'first', 'email']);
});
test('two columns with the same header: the first is used, the second skipped', () => {
  assert.deepStrictEqual(call('importAutoMap', 'contacts', ['first', 'email', 'email']), ['first', 'email', '']);
});
test('no header name belongs to two fields of one kind', () => {
  assert.deepStrictEqual(run('["contacts","offtakers"].map(k=>{const seen={},dup=[];IMPORT_KINDS[k].fields.forEach(f=>f.aliases.forEach(a=>{if(seen[a])dup.push(a);seen[a]=1}));return dup})'), [[], []]);
});
test('a semicolon file from South African Excel is read like a comma file', () => {
  const t = csv(lines('First Name;Surname;Email', 'Thandi;Mokoena;t@sasol.com'));
  assert.deepStrictEqual(call('importAutoMap', 'contacts', t[0]), ['first', 'last', 'email']);
  assert.strictEqual(t[1][2], 't@sasol.com');
});

/* ─── MANUAL RE-MAPPING ───────────────────────────────────────── */
console.log('\nRe-mapping a column');
test('pointing a column at a field matches it', () => {
  assert.deepStrictEqual(call('importRemap', 'contacts', ['first', '', 'email'], 1, 'last'), ['first', 'last', 'email']);
});
test('the field leaves the column that had it, because a field is fed by one column', () => {
  assert.deepStrictEqual(call('importRemap', 'contacts', ['first', 'last', 'email', ''], 3, 'email'), ['first', 'last', '', 'email']);
});
test('choosing "Don\'t import" skips the column', () => {
  assert.deepStrictEqual(call('importRemap', 'contacts', ['first', 'last', 'email'], 2, ''), ['first', 'last', '']);
});
test('re-pointing a matched column replaces its old field', () => {
  assert.deepStrictEqual(call('importRemap', 'contacts', ['first', 'last', 'email'], 0, 'last'), ['last', '', 'email']);
});
test('a field of the other kind, or an unknown one, skips the column rather than storing nonsense', () => {
  assert.deepStrictEqual(call('importRemap', 'contacts', ['first', 'last'], 1, 'gwh'), ['first', '']);
  assert.deepStrictEqual(call('importRemap', 'contacts', ['first', 'last'], 1, 'nope'), ['first', '']);
});
test('a column that is not in the file changes nothing, and the mapping given is never altered', () => {
  const m = ['first', 'last'];
  assert.deepStrictEqual(call('importRemap', 'contacts', m, 7, 'email'), ['first', 'last']);
  call('importRemap', 'contacts', m, 0, 'email');
  assert.deepStrictEqual(m, ['first', 'last']);
});

/* ─── SAMPLES AND WRONG-FILE CHECKS ───────────────────────────── */
console.log('\nSamples and problems');
test('a column shows its first three filled values, skipping the blanks', () => {
  const t = csv(lines('name,city', 'A,', 'B,Cape Town', 'C,Durban', 'D,Paarl', 'E,Gqeberha'));
  assert.deepStrictEqual(call('importSamples', t, 1, 3), ['Cape Town', 'Durban', 'Paarl']);
  assert.deepStrictEqual(call('importSamples', t, 0, 3), ['A', 'B', 'C']);
});
test('a column with nothing in it has no samples', () => {
  assert.deepStrictEqual(call('importSamples', csv(lines('a,b', '1,', '2,')), 1, 3), []);
});
test('a contacts file fed to the off-taker importer is stopped, however its columns are matched', () => {
  const heads = ['First Name', 'Last Name', 'Company', 'Email'];
  const p = call('importProblem', 'offtakers', heads, call('importAutoMap', 'offtakers', heads));
  assert.strictEqual(p.code, 'contacts-file');
  assert.ok(/contacts file/.test(p.text));
});
test('an off-takers file with a name column is fine, even if it also has a first and last column', () => {
  const heads = ['Name', 'First', 'Last'];
  assert.strictEqual(call('importProblem', 'offtakers', heads, call('importAutoMap', 'offtakers', heads)), null);
});
test('an off-takers file with no company column says which column is missing', () => {
  const heads = ['Customer', 'City'];
  assert.strictEqual(call('importProblem', 'offtakers', heads, call('importAutoMap', 'offtakers', heads)).code, 'no-name');
  assert.strictEqual(call('importProblem', 'offtakers', heads, ['name', 'city']), null, 'once matched by hand it is fine');
});
test('a contacts file needs a first or last name column, and a re-map can supply it', () => {
  const heads = ['Forename', 'Surname Initial', 'Email'];
  const auto = call('importAutoMap', 'contacts', heads);
  assert.strictEqual(call('importProblem', 'contacts', heads, auto).code, 'no-person');
  assert.strictEqual(call('importProblem', 'contacts', heads, call('importRemap', 'contacts', auto, 0, 'first')), null);
});
test('a contacts file with only a last name column is accepted', () => {
  const heads = ['Surname', 'Email'];
  assert.strictEqual(call('importProblem', 'contacts', heads, call('importAutoMap', 'contacts', heads)), null);
});

/* ─── CONTACT ROWS ────────────────────────────────────────────── */
console.log('\nContact rows');
const contactFile = csv(lines(
  'First Name,Surname,Title,Company,Email Address,Mobile,Province',
  'Thandi,Mokoena,CFO,Sasol,thandi@sasol.com,082 111,Gauteng',                // line 2: matched to Sasol
  'Pieter,Botha,Engineer,Harmony Gold,,,',                                    // line 3: no email
  'Lerato,Dlamini,Manager,Emalahleni,lerato@emalahleni.gov.za,,',             // line 4: two municipalities fit
  'Sipho,Khumalo,MM,Emalahleni,sipho@emalahleni.gov.za,,Mpumalanga',          // line 5: province settles it
  'Nomsa,Zulu,Head,MP312,nomsa@mp312.gov.za,,',                               // line 6: a code
  'Ayanda,Ngcobo,Analyst,Unknown Co,ayanda@unknown.co.za,,',                  // line 7: nobody matches, kept unassigned
  'Thandi,Mokoena,CFO,Sasol,thandi@sasol.com,,',                              // line 8: repeats line 2
  'Existing,Person,Buyer,Sasol,EXISTING@sasol.com,,',                         // line 9: already in the CRM, by email
  'Pieter,Botha,Engineer,Harmony,pieter@harmony.co.za,,',                     // line 10: already in the CRM, by name and company
  ',,,Sasol,nobody@sasol.com,,',                                              // no name: not a row at all
  'Bad,Email,Clerk,Sasol,not-an-email,,',                                     // line 12: not a work email
  'Zodwa,Mthembu,Buyer,SAB,zodwa@sab.co.za,,'                                 // line 13: only the short name finds this company
));
const contactMap = call('importAutoMap', 'contacts', contactFile[0]);
const contactPlan = call('importPlan', 'contacts', contactFile, contactMap, BOOK);
const byLine = n => contactPlan.rows.find(r => r.line === n);

test('a row is matched to an off-taker by name, and the draft carries what the file said', () => {
  const r = byLine(2);
  assert.strictEqual(r.status, 'import');
  assert.deepStrictEqual({ first: r.draft.first, last: r.draft.last, title: r.draft.title, email: r.draft.email, phone: r.draft.phone, offtakerId: r.draft.offtakerId },
    { first: 'Thandi', last: 'Mokoena', title: 'CFO', email: 'thandi@sasol.com', phone: '082 111', offtakerId: 'o1' });
});
test('a company is matched on its short name too, even when the full name does not contain it', () => {
  assert.strictEqual(byLine(13).status, 'import');
  assert.strictEqual(byLine(13).draft.offtakerId, 'o3');
});
test('an off-taker match wins over a municipality of the same name', () => {
  const book = { offtakers: [{ id: 'o9', name: 'Polokwane Smelter', short: 'Polokwane' }], contacts: [] };
  const t = csv(lines('first,last,company,email', 'Ann,Lee,Polokwane,a@x.co.za'));
  assert.strictEqual(call('importPlan', 'contacts', t, ['first', 'last', 'company', 'email'], book).rows[0].draft.offtakerId, 'o9');
  assert.strictEqual(call('importPlan', 'contacts', t, ['first', 'last', 'company', 'email'], { offtakers: [], contacts: [] }).rows[0].draft.offtakerId, 'mun_LIM353');
});
test('the email gate: a row without a work email is held back, with the reason', () => {
  assert.strictEqual(byLine(3).status, 'skip');
  assert.strictEqual(byLine(3).reason, 'no-email');
  assert.ok(/work email/i.test(byLine(3).detail));
  assert.strictEqual(byLine(12).reason, 'no-email', 'something that is not an address counts as none');
});
test('a municipality name that fits two is held back with both candidates, not guessed', () => {
  const r = byLine(4);
  assert.strictEqual(r.status, 'skip');
  assert.strictEqual(r.reason, 'ambiguous');
  assert.ok(/2 municipalities/.test(r.detail) && /MP312/.test(r.detail) && /EC136/.test(r.detail), r.detail);
  assert.ok(/province/i.test(r.detail));
});
test('the province column settles a municipality name, and so does a code', () => {
  assert.strictEqual(byLine(5).status, 'import');
  assert.strictEqual(byLine(5).draft.offtakerId, 'mun_MP312');
  assert.strictEqual(byLine(6).draft.offtakerId, 'mun_MP312');
});
test('a company nobody matches is still imported, unassigned, to be linked later', () => {
  assert.strictEqual(byLine(7).status, 'import');
  assert.strictEqual(byLine(7).draft.offtakerId, '');
});
test('a person already in the CRM is held back: same email in any case, or same name at the same company', () => {
  assert.strictEqual(byLine(9).reason, 'duplicate');
  assert.ok(/Already in the CRM/.test(byLine(9).detail));
  assert.strictEqual(byLine(10).reason, 'duplicate');
});
test('a row that repeats an earlier row in the file is held back, and says so', () => {
  assert.strictEqual(byLine(8).reason, 'duplicate');
  assert.ok(/earlier row/.test(byLine(8).detail));
});
test('a row with no first or last name is not a row: it is counted as ignored, not held back', () => {
  assert.strictEqual(contactPlan.counts.ignored, 1);
  assert.strictEqual(contactPlan.rows.length, 11);
});
test('the counts say what Review says', () => {
  const c = contactPlan.counts;
  assert.strictEqual(c.total, 11);
  assert.strictEqual(c.importing, 5);
  assert.deepStrictEqual(c.held, { 'no-email': 2, ambiguous: 1, duplicate: 3 });
  assert.strictEqual(c.toOfftaker, 2);
  assert.strictEqual(c.toMunicipality, 2);
  assert.strictEqual(c.unassigned, 1);
});
test('a row with no email does not count as an earlier row: the same person with an email later is imported', () => {
  const t = csv(lines('first,last,email', 'Ann,Lee,', 'Ann,Lee,ann@x.co.za'));
  const plan = call('importPlan', 'contacts', t, ['first', 'last', 'email'], { offtakers: [], contacts: [] });
  assert.deepStrictEqual(plan.rows.map(r => r.status), ['skip', 'import']);
});
test('the same name at different companies is two people', () => {
  const t = csv(lines('first,last,company,email', 'Ann,Lee,Sasol,a1@x.co.za', 'Ann,Lee,Harmony,a2@x.co.za'));
  const plan = call('importPlan', 'contacts', t, ['first', 'last', 'company', 'email'], BOOK);
  assert.deepStrictEqual(plan.rows.map(r => r.status), ['import', 'import']);
});
test('the record stored is the old importer\'s: an influencer, medium priority, active', () => {
  const rec = call('importContactRecord', byLine(2).draft);
  assert.deepStrictEqual(rec, { offtakerId: 'o1', first: 'Thandi', last: 'Mokoena', title: 'CFO', dept: '', email: 'thandi@sasol.com', phone: '082 111', linkedin: '', role: 'influencer', priority: 'medium', status: 'active', notes: '' });
});

/* ─── WHAT A RE-MAP CHANGES ───────────────────────────────────── */
console.log('\nA re-map changes the plan');
const oddFile = csv(lines('Given,Family,Mail,Employer', 'Ann,Lee,ann@sasol.com,Sasol', 'Bo,Chen,bo@harmony.co.za,Harmony', 'Cy,Dube,cy@elsewhere.co.za,Elsewhere'));
test('a file whose columns are not recognised imports nothing until they are matched', () => {
  const auto = call('importAutoMap', 'contacts', oddFile[0]);
  assert.deepStrictEqual(auto, ['', '', '', '']);
  assert.strictEqual(call('importProblem', 'contacts', oddFile[0], auto).code, 'no-person');
});
test('matching the name columns lets it through, but without an email column every row is held back', () => {
  let m = call('importRemap', 'contacts', call('importAutoMap', 'contacts', oddFile[0]), 0, 'first');
  m = call('importRemap', 'contacts', m, 1, 'last');
  const plan = call('importPlan', 'contacts', oddFile, m, BOOK);
  assert.strictEqual(plan.counts.importing, 0);
  assert.strictEqual(plan.counts.held['no-email'], 3);
});
test('matching the email column brings the rows in; matching the company column changes where they go', () => {
  let m = call('importRemap', 'contacts', ['', '', '', ''], 0, 'first');
  m = call('importRemap', 'contacts', m, 1, 'last');
  m = call('importRemap', 'contacts', m, 2, 'email');
  let plan = call('importPlan', 'contacts', oddFile, m, BOOK);
  assert.strictEqual(plan.counts.importing, 3);
  assert.strictEqual(plan.counts.unassigned, 3, 'no company column, so nobody is filed anywhere');
  m = call('importRemap', 'contacts', m, 3, 'company');
  plan = call('importPlan', 'contacts', oddFile, m, BOOK);
  assert.strictEqual(plan.counts.toOfftaker, 2);
  assert.strictEqual(plan.counts.unassigned, 1);
});
test('skipping the email column holds every row back', () => {
  const m = call('importRemap', 'contacts', contactMap, contactMap.indexOf('email'), '');
  const plan = call('importPlan', 'contacts', contactFile, m, BOOK);
  assert.strictEqual(plan.counts.importing, 0);
  assert.strictEqual(plan.counts.held['no-email'], plan.counts.total);
});
test('skipping the company column files everyone as unassigned', () => {
  const m = call('importRemap', 'contacts', contactMap, contactMap.indexOf('company'), '');
  const plan = call('importPlan', 'contacts', contactFile, m, BOOK);
  assert.strictEqual(plan.counts.toOfftaker + plan.counts.toMunicipality, 0);
});

/* ─── OFF-TAKER ROWS ──────────────────────────────────────────── */
console.log('\nOff-taker rows');
const otFile = csv(lines(
  'Name,Short Name,Sector,Province,City,GWh,Tariff,Status,Priority,Supply,Wheeling',
  'Cape Smelters,,Mining & Minerals (Producer),WC,Saldanha,"1 200,5",1.45,engaged,high,eskom,yes',   // line 2
  'Bay Foods,Bay,chemicals-petrochemicals,Kwazulu Natal,Durban,,,,,,',                              // line 3: no load
  'Odd Works,,Nonsense sector,Atlantis,Nowhere,40,,,,,',                                            // line 4: bad sector, bad province
  'Sasol Limited,,mining,Gauteng,,10,,,,,',                                                         // line 5: in the CRM by name
  'Another Name,Harmony,mining,Gauteng,,10,,,,,',                                                   // line 6: in the CRM by short name
  'Cape Smelters,,mining,WC,,5,,,,,',                                                               // line 7: repeats line 2
  ',,mining,Gauteng,,1,,,,,',                                                                       // no name: not a row
  'Plain Co,,mining,Gauteng,,3,,wild,urgent,gas,maybe'                                              // line 9: values nothing recognises
));
const otMap = call('importAutoMap', 'offtakers', otFile[0]);
const otPlan = call('importPlan', 'offtakers', otFile, otMap, BOOK);
const ot = n => otPlan.rows.find(r => r.line === n);

test('a sector is read from its id or its full name, a province from an abbreviation or a spelling', () => {
  assert.strictEqual(ot(2).draft.sector, 'mining');
  assert.strictEqual(ot(3).draft.sector, 'chemicals-petrochemicals');
  assert.strictEqual(ot(2).draft.province, 'Western Cape');
  assert.strictEqual(ot(3).draft.province, 'KwaZulu-Natal');
});
test('numbers are read the way South African Excel writes them', () => {
  assert.strictEqual(ot(2).draft.annualGwh, 1200.5);
  assert.strictEqual(ot(2).draft.tariff, 1.45);
});
test('a short name defaults to the name, and the enums are kept when they are valid', () => {
  assert.strictEqual(ot(2).draft.short, 'Cape Smelters');
  assert.deepStrictEqual({ s: ot(2).draft.status, p: ot(2).draft.priority, su: ot(2).draft.supply, w: ot(2).draft.wheeling }, { s: 'engaged', p: 'high', su: 'eskom', w: 'yes' });
});
test('values the app cannot render fall back to the safe default', () => {
  assert.deepStrictEqual({ s: ot(9).draft.status, p: ot(9).draft.priority, su: ot(9).draft.supply, w: ot(9).draft.wheeling }, { s: 'prospect', p: 'medium', su: 'eskom', w: 'unknown' });
});
test('no load figure means no estimate was made, and the record does not claim one', () => {
  assert.strictEqual(ot(3).draft.annualGwh, 0);
  assert.strictEqual(ot(3).draft.estimated, false);
  assert.strictEqual(ot(2).draft.estimated, true);
  assert.strictEqual(otPlan.counts.noLoad, 1);
});
test('a company already in the CRM is held back, by name or by short name', () => {
  assert.strictEqual(ot(5).reason, 'duplicate');
  assert.ok(/Already in the CRM/.test(ot(5).detail));
  assert.strictEqual(ot(6).reason, 'duplicate');
});
test('a company repeated inside the file is held back, and says so', () => {
  assert.strictEqual(ot(7).reason, 'duplicate');
  assert.ok(/earlier row/.test(ot(7).detail));
  assert.strictEqual(ot(2).status, 'import', 'the first of them still goes in');
});
test('a row with no name is not a row', () => {
  assert.strictEqual(otPlan.counts.ignored, 1);
  assert.strictEqual(otPlan.rows.length, 7);
});
test('a sector nothing matched is counted with an example, and filed under Mining when stored', () => {
  assert.strictEqual(otPlan.counts.noSector, 1);
  assert.strictEqual(otPlan.counts.noSectorExample, 'Nonsense sector');
  assert.strictEqual(call('importOfftakerRecord', ot(4).draft).sector, 'mining');
});
test('a province nothing matched is counted with an example, because it would leave the record off the map', () => {
  assert.strictEqual(otPlan.counts.badProvince, 1);
  assert.strictEqual(otPlan.counts.badProvinceExample, 'Atlantis');
});
test('the counts say what Review says', () => {
  const c = otPlan.counts;
  assert.strictEqual(c.total, 7);
  assert.strictEqual(c.importing, 4);
  assert.deepStrictEqual(c.held, { duplicate: 3 });
});
test('the record stored has every field the old importer wrote', () => {
  assert.deepStrictEqual(call('importOfftakerRecord', ot(2).draft), {
    name: 'Cape Smelters', short: 'Cape Smelters', sector: 'mining', province: 'Western Cape', city: 'Saldanha', website: '',
    annualGwh: 1200.5, peakMw: 0, tariff: 1.45, nmd: 0, supply: 'eskom', wheeling: 'yes', status: 'engaged', priority: 'high',
    description: '', estimated: true,
  });
});
test('re-mapping the sector column changes what is filed where', () => {
  const m = call('importRemap', 'offtakers', otMap, otMap.indexOf('sector'), '');
  const plan = call('importPlan', 'offtakers', otFile, m, BOOK);
  assert.strictEqual(plan.counts.noSector, plan.counts.importing, 'with no sector column nothing has one');
});

/* ─── FROM THE INDEPENDENT REVIEW ─────────────────────────────── */
console.log('\nFrom the independent review');
ctx.__lines = 'First,Last,Email\nA,One,a@x.co.za\n\nB,Two,\nC,"Three\ncontinues",c@x.co.za\nD,Four,\n';
const NOBODY = { offtakers: [], contacts: [] };

test('the reader records the line each row starts on, through blank lines and cells that run over two', () => {
  assert.deepStrictEqual(run('parseCSV(__lines).lines'), [1, 2, 4, 5, 7]);
  assert.deepStrictEqual(run('parseCSV("\\uFEFFa,b\\r\\n1,2\\r\\n\\r\\n3,4\\r\\n").lines'), [1, 2, 4], 'CRLF and a BOM');
  assert.deepStrictEqual(run('parseCSV("\\n\\nname,city\\nAcme,CT\\n").lines'), [3, 4], 'blank lines above the header too');
});
test('the rows a person is told to fix carry the file\'s own line numbers', () => {
  const rows = run('importPlan("contacts", parseCSV(__lines), ["first","last","email"], { offtakers: [], contacts: [] }).rows.map(r => [r.draft.first, r.line, r.at])');
  assert.deepStrictEqual(rows, [['A', 2, 1], ['B', 4, 2], ['C', 5, 3], ['D', 7, 4]]);
});
test('a table that did not record its lines falls back to the row\'s place', () => {
  const rows = call('importPlan', 'contacts', csv(lines('first,last,email', 'A,One,a@x.co.za', 'B,Two,')), ['first', 'last', 'email'], NOBODY).rows.map(r => r.line);
  assert.deepStrictEqual(rows, [2, 3]);
});
test('rows read is every data row, the nameless ones included', () => {
  assert.strictEqual(contactPlan.counts.read, 12);
  assert.strictEqual(contactPlan.counts.read, contactPlan.counts.total + contactPlan.counts.ignored);
  assert.strictEqual(otPlan.counts.read, otPlan.counts.total + otPlan.counts.ignored);
});
test('a contacts file with no email column matched gets a warning, and a reason that points back at Map columns', () => {
  const heads = ['First Name', 'Last Name', 'Work Email'];
  const auto = call('importAutoMap', 'contacts', heads);
  assert.strictEqual(call('importWarning', 'contacts', heads, auto).code, 'no-email-column');
  assert.strictEqual(call('importWarning', 'contacts', heads, call('importRemap', 'contacts', auto, 2, 'email')), null, 'matched by hand, no warning');
  assert.strictEqual(call('importWarning', 'offtakers', ['Name'], ['name']), null, 'off-takers have no email gate');
  const t = csv(lines('First Name,Last Name,Work Email', 'Ann,Lee,ann@lee.co'));
  const row = call('importPlan', 'contacts', t, auto, NOBODY).rows[0];
  assert.strictEqual(row.reason, 'no-email');
  assert.ok(/No column is matched to Work email/.test(row.detail) && !/Add the address/.test(row.detail), row.detail);
});
test('the wrong-file stop is lifted when the company column is matched by hand, and not before', () => {
  const heads = ['First Name', 'Last Name', 'Organisation Name', 'Sector'];
  const auto = call('importAutoMap', 'offtakers', heads);
  const p = call('importProblem', 'offtakers', heads, auto);
  assert.strictEqual(p.code, 'contacts-file');
  assert.ok(/match the column that holds the company to Company name/.test(p.text), 'the message says what to do');
  assert.strictEqual(call('importProblem', 'offtakers', heads, call('importRemap', 'offtakers', auto, 2, 'name')), null);
  const withCompany = ['First Name', 'Last Name', 'Company'];
  assert.strictEqual(call('importProblem', 'offtakers', withCompany, call('importAutoMap', 'offtakers', withCompany)).code, 'contacts-file',
    'a company column the importer found for itself does not lift it: that is the contacts file the guard exists for');
});
test('the held rows come back as a file to fix: the file\'s own cells, then why, then the line', () => {
  /* A plan is built inside the sandbox: the table's `lines` do not survive being turned into plain JSON. */
  const held = run('(() => { const t = parseCSV(__lines); const p = importPlan("contacts", t, ["first","last","email"], { offtakers: [], contacts: [] }); return importHeldCsv(t, p); })()');
  assert.deepStrictEqual(held, [
    ['First', 'Last', 'Email', 'Held because', 'Details', 'Line'],
    ['B', 'Two', '', 'No work email', 'No work email. Add the address to the file and import again.', 4],
    ['D', 'Four', '', 'No work email', 'No work email. Add the address to the file and import again.', 7],
  ]);
  assert.deepStrictEqual(run('importHeldCsv(parseCSV("name\\nAcme\\n"), importPlan("offtakers", parseCSV("name\\nAcme\\n"), ["name"], { offtakers: [], contacts: [] }))'),
    [['name', 'Held because', 'Details', 'Line']], 'nothing held: just the header');
});

/* The duplicate checks are indexed so a big file against a big book is not a scan per row. The index must say
   exactly what the scan said, so each edge of the old comparison is pinned. */
console.log('\nIndexed duplicate checks');
const dupePlan = (book, rows) => call('importPlan', 'contacts', csv(lines('first,last,company,email', ...rows)), ['first', 'last', 'company', 'email'], book);
test('an email matches whatever its case, and a book contact with no email is not matched on it', () => {
  const book = { offtakers: [], contacts: [{ first: 'X', last: 'Y', offtakerId: '', email: 'ANN@X.CO.ZA' }, { first: 'P', last: 'Q', offtakerId: '', email: null }] };
  assert.deepStrictEqual(dupePlan(book, ['Ann,Lee,,ann@x.co.za']).rows.map(r => r.reason), ['duplicate']);
  assert.deepStrictEqual(dupePlan(book, ['Zed,Zee,,zed@x.co.za']).rows.map(r => r.reason), ['']);
});
test('a name at a company matches only the same company, and "no company" is a company of its own', () => {
  const book = { offtakers: [{ id: 'o1', name: 'Sasol Limited', short: 'Sasol' }], contacts: [
    { first: 'Ann', last: 'Lee', offtakerId: 'o1', email: '' }, { first: 'Bo', last: 'Ray', offtakerId: '', email: '' }] };
  assert.deepStrictEqual(dupePlan(book, ['ann,LEE,Sasol,a@x.co.za', 'Ann,Lee,,a2@x.co.za', 'Bo,Ray,,b@x.co.za', 'Bo,Ray,Sasol,b2@x.co.za']).rows.map(r => r.reason),
    ['duplicate', '', 'duplicate', '']);
});
test('a book contact whose company is not text never equals a row\'s, as the old strict comparison said', () => {
  const book = { offtakers: [], contacts: [{ first: 'Ann', last: 'Lee', email: '' }, { first: 'Bo', last: 'Ray', offtakerId: null, email: '' }] };
  assert.deepStrictEqual(dupePlan(book, ['Ann,Lee,,a@x.co.za', 'Bo,Ray,,b@x.co.za']).rows.map(r => r.reason), ['', '']);
});
test('a book contact with no first name matches a row with none', () => {
  const book = { offtakers: [], contacts: [{ last: 'Lee', offtakerId: '', email: '' }] };
  assert.deepStrictEqual(dupePlan(book, [',Lee,,a@x.co.za']).rows.map(r => r.reason), ['duplicate']);
});
test('rows later in the file are checked against the ones taken earlier, by email or by name, and the reason says so', () => {
  const r = dupePlan(NOBODY, ['Ann,Lee,,a@x.co.za', 'Ann,Lee,,other@x.co.za', 'Bo,Chen,,A@X.CO.ZA', 'Cy,Dube,,c@x.co.za']).rows;
  assert.deepStrictEqual(r.map(x => x.reason), ['', 'duplicate', 'duplicate', '']);
  assert.ok(/earlier row/.test(r[1].detail) && /earlier row/.test(r[2].detail));
});
test('a company text is looked up once, but the same text with another province is settled again', () => {
  const t = csv(lines('first,last,company,province,email', 'A,One,Emalahleni,,a@x.co.za', 'B,Two,Emalahleni,Mpumalanga,b@x.co.za', 'C,Three,Emalahleni,,c@x.co.za', 'D,Four,Emalahleni,Eastern Cape,d@x.co.za'));
  const rows = call('importPlan', 'contacts', t, ['first', 'last', 'company', 'province', 'email'], NOBODY).rows;
  assert.deepStrictEqual(rows.map(r => r.reason || r.draft.offtakerId), ['ambiguous', 'mun_MP312', 'ambiguous', 'mun_EC136']);
});
test('an off-taker with no short name matches nothing on short name, and a short name matches on its own', () => {
  const book = { offtakers: [{ name: 'A Co' }, { name: 'Some Long Name', short: 'SLN' }], contacts: [] };
  const t = csv(lines('name,short', 'B Co,', 'Fresh Name,sln', 'Fresh Two,'));
  assert.deepStrictEqual(call('importPlan', 'offtakers', t, ['name', 'short'], book).rows.map(r => r.reason), ['', 'duplicate', '']);
});
test('a big file against a big book is planned in moments, not a scan of the book per row', () => {
  const offtakers = Array.from({ length: 2000 }, (_, i) => ({ id: 'o' + i, name: 'Company ' + i + ' Holdings', short: 'C' + i }));
  const contacts = Array.from({ length: 5000 }, (_, i) => ({ id: 'c' + i, offtakerId: 'o' + (i % 2000), first: 'First' + i, last: 'Last' + i, email: 'person' + i + '@book.co.za' }));
  const rows = Array.from({ length: 5000 }, (_, i) => ['New' + i, 'Person' + i, i % 3 ? 'Company ' + (i % 2000) + ' Holdings' : 'Emalahleni', 'new' + i + '@file.co.za']);
  rows[10] = ['First7', 'Last7', 'Company 7 Holdings', 'x@y.co.za'];              // the same name at the same company as a book contact
  rows[11] = ['New11', 'Person11', 'Company 11 Holdings', 'person11@book.co.za'];   // the same email as a book contact
  ctx.__perf = { table: [['first', 'last', 'company', 'email']].concat(rows), mapping: ['first', 'last', 'company', 'email'], book: { offtakers, contacts } };
  const t0 = Date.now();
  const counts = run('importPlan("contacts", __perf.table, __perf.mapping, __perf.book).counts');
  const ms = Date.now() - t0;
  assert.strictEqual(counts.total, 5000);
  assert.strictEqual(counts.held.duplicate, 2);
  assert.ok(counts.held.ambiguous > 1000, 'the Emalahleni rows are held back');
  assert.ok(ms < 4000, 'planning 5,000 rows against 5,000 contacts took ' + ms + ' ms; scanning the book per row took ~25 s');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
