/* Tests for the pure parts of scripts/infer-emails.js: the checks that keep a
 * placeholder from getting an address, the company matching, and the two
 * evidence CSV layouts.
 *
 *   node tests/infer-emails.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const { norm, isRoleName, companyKey, classify, classifyByShape, parseCsv, FORMATS } = require('../scripts/infer-emails.js');

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

test('a role or team is not a person, a real name is', () => {
  assert.strictEqual(isRoleName('Procurement', 'Lead'), true);
  assert.strictEqual(isRoleName('Cennergi', 'Team'), true);
  assert.strictEqual(isRoleName('Plant', 'Engineering'), true);
  assert.strictEqual(isRoleName('Renewables', 'Programme'), true);
  assert.strictEqual(isRoleName('Thabo', 'Nkosi'), false);
  assert.strictEqual(isRoleName('Anda', 'Mwanda'), false);
});

test('a site and its group share a company key', () => {
  assert.strictEqual(companyKey('Valterra Platinum — Mogalakwena'), companyKey('Valterra Platinum'));
  assert.strictEqual(companyKey('Kumba Iron Ore (Anglo American)'), companyKey('Kumba Iron Ore'));
  assert.notStrictEqual(companyKey('Impala Platinum'), companyKey('Valterra Platinum'));
});

test('names are reduced to letters before an address is built', () => {
  assert.strictEqual(norm('Niël'), 'niel');
  assert.strictEqual(norm("O'Malley"), 'omalley');
  assert.strictEqual(FORMATS['first.last'](norm('Niël'), norm('van Aswegen')), 'niel.vanaswegen');
});

test('a published address is matched to a format by the owner\'s name', () => {
  assert.strictEqual(classify('ilja'.slice(0, 1) + 'graulich', 'Ilja', 'Graulich'), 'flast');
  assert.strictEqual(classify('johan.theron', 'Johan', 'Theron'), 'first.last');
  assert.strictEqual(classify('ditabe', 'Ditabe', 'Chocho'), 'first');
  assert.strictEqual(classify('xyz', 'Ditabe', 'Chocho'), null);
});

test('with no name to go on, the shape decides', () => {
  assert.strictEqual(classifyByShape('chika.edeh'), 'first.last');
  assert.strictEqual(classifyByShape('c.edeh'), 'f.last');
  assert.strictEqual(classifyByShape('info'), null);
});

test('both evidence layouts parse, with a BOM and quoted commas', () => {
  const a = parseCsv('person_name,example_email\n"Johan Theron",johan.theron@implats.co.za\n');
  assert.strictEqual(a[0].person_name, 'Johan Theron');
  const b = parseCsv('﻿company,first,last,email,evidence_note\nImpala Platinum,Emma,Townshend,emma.townshend@implats.co.za,"In a contact block, printed"\n');
  assert.strictEqual(b[0].company, 'Impala Platinum');
  assert.strictEqual(b[0].email, 'emma.townshend@implats.co.za');
  assert.strictEqual(b[0].evidence_note, 'In a contact block, printed');
});

console.log('\n' + n + ' passed');
