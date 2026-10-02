/* Tests for the stakeholder ladder: which contacts fill which seat.
 *
 * The ladder on an account's page, and the org map, read the same contacts.
 * The org map lists everyone by department; the ladder used to credit a seat
 * only when the job title matched a pattern, so people the org map shows (a
 * "Chief Operations Officer" in Operations, an "Executive Director: Finance" in
 * Finance) left seats reading "No one on file". These cases are real titles
 * from the contact files, and pin down what fills a seat and what must not.
 *
 *   node tests/ladder-seats.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = vm.createContext({
  window: {}, console,
  esc: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
  jsStr: v => JSON.stringify(String(v == null ? '' : v)),
  icon: () => '',
  state: { detailId: 'o1' },
});
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'views-orgmap.js'), 'utf8');
const f = vm.runInContext(src + '\n;({ AE_LADDER, aeSeatMatch, aePeople, contactMixHtml })', sandbox);

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

const person = (title, dept, over) => Object.assign({ first: 'Test', last: String(title).slice(0, 8), title, dept: dept || '' }, over);
const seatsOf = c => Array.from(f.AE_LADDER).filter(s => f.aeSeatMatch(s, c)).map(s => s.k).sort();
const fills = (title, dept, ...seats) => assert.deepStrictEqual(seatsOf(person(title, dept)), seats.sort(),
  '"' + title + '" in "' + (dept || '') + '" should fill ' + (seats.join('+') || 'no seat'));

console.log('\nthe title alone (as before)');
test('a Group Energy Manager fills Energy / utilities', () => fills('Group Energy Manager', '', 'energy'));
test('a CFO fills CFO / finance', () => fills('Chief Financial Officer', '', 'finance'));
test('"Chief Finance Officer" (Finance, not Financial) fills CFO / finance too', () => fills('Chief Finance Officer', '', 'finance'));
test('a CEO fills CEO / MD', () => fills('Chief Executive Officer', '', 'exec'));
test('a Chief Operating Officer fills Operations / site', () => fills('Chief Operating Officer', '', 'ops'));
test('a buyer who runs the RFP fills Procurement only, not Energy', () =>
  fills('Category Manager: Energy & Utilities', 'Energy', 'proc'));

console.log('\nreal titles the ladder used to miss: the title is wider than the old pattern');
test('"Chief Operations Officer" (with an s) fills Operations / site', () => fills('Chief Operations Officer', 'Operations', 'ops'));
test('"Chief Technical Officer" fills Engineering', () => fills('Chief Technical Officer', 'Engineering', 'eng'));
test('"Head of Projects" fills Engineering', () => fills('Head of Projects', 'Engineering', 'eng'));
test('"Executive Vice President: People and Sustainability" fills Sustainability / ESG', () =>
  fills('Executive Vice President: People and Sustainability', 'Sustainability', 'sustain'));
test('"Chairperson" fills CEO / MD, like "Chairman"', () => fills('Chairperson', 'Board', 'exec'));

console.log('\nthe department fills a seat when the title is a senior role');
test('a Director in Finance fills CFO / finance', () => fills('Executive Director: Finance', 'Finance', 'finance'));
test('a Director in Operations fills Operations / site', () => fills('Surface Mining Director', 'Operations', 'ops'));
test('a Manager in the Energy department fills Energy / utilities', () => fills('Manager', 'Energy', 'energy'));
test('a Head in Sustainability fills Sustainability / ESG', () => fills('Head', 'Sustainability', 'sustain'));
test('a Manager in Engineering fills Engineering', () => fills('Plant Superintendent', 'Engineering', 'eng'));
test('a Procurement Manager in Supply chain fills Procurement', () => fills('Manager', 'Supply chain', 'proc'));
test('a buyer in the Energy department still fills Procurement only', () => fills('Category Manager', 'Energy', 'proc'));

console.log('\nand must not over-claim');
test('a junior title in a seat department fills nothing', () => {
  fills('Financial Accountant', 'Finance');
  fills('Energy Analyst', 'Energy');
  fills('Admin Clerk', 'Operations');
});
test('departments with no seat fill nothing, however senior', () => {
  fills('Sales Manager', 'Sales');
  fills('Head of Communications', 'Communications');
  fills('Legal, Governance, Risk and Compliance Executive', 'Legal / Governance');
});
test('a bare Director in the Executive department is not assumed to be the CEO', () => fills('Director', 'Executive'));
test('a safety head is not the sustainability seat just because the department says Environment', () =>
  fills('Executive Head SHE', 'Safety, Health and Environment'));
test('a person with no title and no department fills nothing', () => fills('', ''));

console.log('\nthe panel on the account page');
const o = { id: 'o1', name: 'Test Mining', short: 'Test' };
const panel = contacts => f.contactMixHtml(o, contacts, { noList: true });
test('the seats-covered count includes people placed by department', () => {
  const html = panel([person('Chief Operations Officer', 'Operations', { last: 'Ops' }),
    person('Executive Director: Finance', 'Finance', { last: 'Fin' })]);
  assert.ok(/2 of 7 seats covered/.test(html), 'expected 2 of 7 seats covered');
  assert.ok(!/No one on file<\/span><span class="ia-prod-x">Cost-per-tonne/.test(html), 'operations seat should not read empty');
});
test('a seat shows who holds it', () => {
  const html = panel([person('Chief Operations Officer', 'Operations', { first: 'Pat', last: 'Mokoena' })]);
  assert.ok(html.includes('Pat Mokoena'));
});
test('people who fill no seat are counted and pointed to the org map, not hidden', () => {
  const html = panel([person('Group Energy Manager', '', { last: 'Energy' }), person('Sales Manager', 'Sales', { last: 'Sales' }),
    person('Head of Communications', 'Communications', { last: 'Comms' })]);
  assert.ok(/2 other people fill no seat/.test(html), 'expected a line about the 2 unplaced people');
  assert.ok(/org-map/.test(html));
});
test('when everyone fills a seat there is no such line', () =>
  assert.ok(!/fill no seat|fills no seat/.test(panel([person('Group Energy Manager', '', { last: 'Energy' })]))));
test('an account with nobody on file shows no such line and every seat empty', () => {
  const html = panel([]);
  assert.ok(/0 of 7 seats covered/.test(html));
  assert.ok(!/fill no seat|fills no seat/.test(html));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
