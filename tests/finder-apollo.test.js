/* Tests for the Apollo source's pure parts — no network, no key.
 *
 * The mapper is the boundary where a vendor's shape becomes the desk's
 * shape, and where everything personal is dropped. If it leaks a
 * personal number or dresses a locked email as a real one, the
 * reviewer cannot tell — so this is where the tests point.
 *
 *   node tests/finder-apollo.test.js
 */
'use strict';

const assert = require('assert');
const { titleToSeat, personToFind, findsToCsv, csvCell, parseArgs } = require('../scripts/finder-apollo.js');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

console.log('\ntitleToSeat — mirrors the ladder');
test('energy manager lands on energy', () => assert.strictEqual(titleToSeat('Group Energy Manager'), 'energy'));
test('CSO lands on sustain', () => assert.strictEqual(titleToSeat('Chief Sustainability Officer'), 'sustain'));
test('CFO lands on finance', () => assert.strictEqual(titleToSeat('Chief Financial Officer'), 'finance'));
test('MD lands on exec', () => assert.strictEqual(titleToSeat('Managing Director'), 'exec'));
test('COO lands on ops', () => assert.strictEqual(titleToSeat('Chief Operating Officer'), 'ops'));
test('engineering manager lands on eng', () => assert.strictEqual(titleToSeat('Engineering Manager'), 'eng'));
test('supply chain lands on proc', () => assert.strictEqual(titleToSeat('Head of Supply Chain'), 'proc'));
/* Same trap the app defends against: the buyer of energy is not the
   owner of the tariff. */
test('Category Manager: Energy is procurement, not energy', () =>
  assert.strictEqual(titleToSeat('Category Manager: Energy & Utilities'), 'proc'));
test('an unrelated title has no seat', () => assert.strictEqual(titleToSeat('Payroll Administrator'), null));
test('empty title has no seat', () => assert.strictEqual(titleToSeat(''), null));

console.log('\npersonToFind — the vendor boundary');
const apolloPerson = {
  id: 'abc123', first_name: 'Thandi', last_name: 'Nkomo',
  title: 'Group Energy Manager', email: 't.nkomo@bigmine.co.za', email_status: 'verified',
  linkedin_url: 'https://linkedin.com/in/tnkomo',
  organization: { name: 'Big Mine Ltd', phone: '+27 11 555 0100' },
};
test('a verified person maps completely', () => {
  const f = personToFind(apolloPerson, 'Big Mine Ltd');
  assert.strictEqual(f.first, 'Thandi');
  assert.strictEqual(f.seat, 'energy');
  assert.strictEqual(f.role, 'decision');
  assert.strictEqual(f.email, 't.nkomo@bigmine.co.za');
  assert.strictEqual(f.phone, '+27 11 555 0100');
  assert.ok(f.source.includes('abc123'));
  assert.strictEqual(f.confidence, 0.9);
});
test('an unrevealed email is blanked, not passed through', () => {
  const f = personToFind({ ...apolloPerson, email: 'email_not_unlocked@domain.com' }, 'Big Mine Ltd');
  assert.strictEqual(f.email, '', 'a placeholder domain must not reach the reviewer as an address');
});
test('email_status unavailable blanks the email', () => {
  const f = personToFind({ ...apolloPerson, email_status: 'unavailable' }, 'Big Mine Ltd');
  assert.strictEqual(f.email, '');
  assert.ok(f.confidence < 0.9);
});
test('unverified email is carried but marked down', () => {
  const f = personToFind({ ...apolloPerson, email_status: 'guessed' }, 'Big Mine Ltd');
  assert.strictEqual(f.confidence, 0.7);
  assert.ok(f.note.includes('guessed'));
});
test('the phone is the organisation switchboard, never a person field', () => {
  const f = personToFind({ ...apolloPerson, sanitized_phone: '+27 82 000 0000' }, 'Big Mine Ltd');
  assert.strictEqual(f.phone, '+27 11 555 0100', 'a top-level personal number must not be picked up');
});
test('no organisation phone means no phone at all', () => {
  const f = personToFind({ ...apolloPerson, organization: { name: 'Big Mine Ltd' } }, 'Big Mine Ltd');
  assert.strictEqual(f.phone, '');
});

console.log('\nCSV — matches the Import contacts screen');
test('header is the importer\'s exact vocabulary', () => {
  assert.ok(findsToCsv([]).startsWith('first,last,title,department,company,email,phone,linkedin,notes'));
});
test('commas and quotes survive round-tripping', () => {
  assert.strictEqual(csvCell('Smelting, Ferroalloys & "Metals"'), '"Smelting, Ferroalloys & ""Metals"""');
});
test('a find renders as one row with source in notes', () => {
  const csv = findsToCsv([personToFind(apolloPerson, 'Big Mine Ltd')]);
  const lines = csv.trim().split(/\r\n/);
  assert.strictEqual(lines.length, 2);
  assert.ok(lines[1].includes('apollo.io'), 'the reviewer must see where the row came from');
});

console.log('\nflags — the spending gates');
test('--reveal without --budget parses (pull caps by --max)', () =>
  assert.deepStrictEqual(parseArgs(['X', '--reveal']), { _: ['X'], reveal: true }));
test('a non-numeric --max is refused before any call is made', () => {
  let died = false;
  const realExit = process.exit, realLog = console.log;
  process.exit = () => { died = true; throw new Error('exited'); };
  console.log = () => {};
  try { parseArgs(['X', '--max', 'lots']); } catch (e) { /* expected */ }
  process.exit = realExit; console.log = realLog;
  assert.ok(died, 'should refuse --max lots');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
