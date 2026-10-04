/* Tests for the daily Apollo ingestion (scripts/apollo-daily.js): who it
 * spends a credit on, and what it is willing to put in the review queue.
 * Nothing here touches Apollo or the database.
 *
 *   node tests/apollo-daily.test.js
 */
'use strict';

const assert = require('assert');
const { chooseCandidates, toFind, sameName, domainOf, parseFlags } = require('../scripts/apollo-daily.js');
const { coverage, loadLadder } = require('../scripts/finder-gaps.js');

const ladder = loadLadder();
const c = (first, last, title, email) => ({ first, last, title, dept: '', email: email || '', status: 'active' });
const rowFor = contacts => ({ id: 'off_1', name: 'Acme Mining', _contacts: contacts, ...coverage(ladder, contacts) });
const ap = (first, last, title, extra) => ({ id: 'ap_' + first, first_name: first, last_name: last, title, ...(extra || {}) });

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

test('one candidate per open seat, best seat first', () => {
  const picks = chooseCandidates(rowFor([]), [
    ap('Sam', 'Roe', 'Procurement Manager'), ap('Ann', 'Lee', 'Head of Energy'), ap('Bo', 'Fox', 'Energy Manager'),
  ]);
  assert.deepStrictEqual(picks.map(p => p.person.first_name), ['Ann', 'Sam']);
  assert.deepStrictEqual(picks.map(p => p.seat), ['energy', 'proc']);
});

test('a seat already covered by someone with an email is left alone', () => {
  const row = rowFor([c('Ann', 'Lee', 'Head of Energy', 'ann@acme.co.za')]);
  const picks = chooseCandidates(row, [ap('Zed', 'Kay', 'Energy Manager'), ap('Sam', 'Roe', 'Chief Financial Officer')]);
  assert.deepStrictEqual(picks.map(p => p.seat), ['finance']);
});

test('a named person with no email is still worth a reveal, a person with one is not', () => {
  const row = rowFor([c('Ann', 'Lee', 'Head of Energy')]);
  assert.strictEqual(chooseCandidates(row, [ap('Ann', 'Le***', 'Head of Energy')]).length, 1);
  const done = rowFor([c('Ann', 'Lee', 'Head of Energy', 'ann@acme.co.za')]);
  assert.strictEqual(chooseCandidates(done, [ap('Ann', 'Lee', 'Head of Energy')]).length, 0);
});

test('people with no ladder seat are never revealed', () => {
  assert.strictEqual(chooseCandidates(rowFor([]), [ap('Pat', 'Day', 'Receptionist')]).length, 0);
});

test('surnames Apollo hides still match on the letters shown', () => {
  assert.ok(sameName({ first: 'Ann', last: 'Lee' }, 'ann', 'Le***'.replace(/\*/g, '')));
  assert.ok(!sameName({ first: 'Ann', last: 'Lee' }, 'Ann', 'Moyo'));
  assert.ok(!sameName({ first: 'Ann', last: 'Lee' }, 'Anna', 'Lee'));
});

test('a revealed person becomes a find the queue accepts', () => {
  const f = toFind(rowFor([]), ap('Ann', 'Lee', 'Head of Energy', { email: 'ann.lee@acme.co.za', email_status: 'verified' }), 'energy');
  assert.strictEqual(f.offtakerId, 'off_1');
  assert.strictEqual(f.email, 'ann.lee@acme.co.za');
  assert.strictEqual(f.confidence, 0.9);
  assert.ok(/^https:\/\/app\.apollo\.io/.test(f.source));
});

test('no email, a generic inbox, or an unavailable address is dropped', () => {
  const row = rowFor([]);
  assert.strictEqual(toFind(row, ap('Ann', 'Lee', 'Head of Energy'), 'energy'), null);
  assert.strictEqual(toFind(row, ap('Ann', 'Lee', 'Head of Energy', { email: 'info@acme.co.za' }), 'energy'), null);
  assert.strictEqual(toFind(row, ap('Ann', 'Lee', 'Head of Energy', { email: 'ann@acme.co.za', email_status: 'unavailable' }), 'energy'), null);
});

test('websites reduce to a bare domain', () => {
  assert.strictEqual(domainOf('https://www.exxaro.com/about'), 'exxaro.com');
  assert.strictEqual(domainOf('sibanyestillwater.com'), 'sibanyestillwater.com');
  assert.strictEqual(domainOf(''), '');
});

test('flags have safe defaults and reject nonsense', () => {
  assert.deepStrictEqual(parseFlags([]), { budget: 15, companies: 8, cooldown: 14, dry: false });
  assert.strictEqual(parseFlags(['--budget', '3', '--dry']).dry, true);
  assert.throws(() => parseFlags(['--budget', '-1']));
  assert.throws(() => parseFlags(['--spend', '5']));
});

console.log(n + ' passed');
