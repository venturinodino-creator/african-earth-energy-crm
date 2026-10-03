/* Tests for the gap report (scripts/finder-gaps.js): which ladder seats a
 * listed company has filled, and which companies the finder is sent to first.
 *
 * The seat rules are the app's own (js/views-orgmap.js), loaded as the report
 * loads them, so the report and the account page cannot disagree.
 *
 *   node tests/finder-gaps.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const { coverage, rankGaps, loadLadder } = require('../scripts/finder-gaps.js');

const ladder = loadLadder();
const p = (first, last, title, extra) => ({ first, last, title, dept: '', email: '', status: 'active', ...(extra || {}) });
const seatState = (cov, k) => cov.seats.find(s => s.seat === k).state;

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

test('a company with nobody on file has all seven seats empty', () => {
  const c = coverage(ladder, []);
  assert.strictEqual(c.seats.length, 7);
  assert.strictEqual(c.missing, 7);
  assert.strictEqual(c.noEmail, 0);
  assert.strictEqual(c.gap, 14);
});

test('a person fills a seat from their title; with an email the seat is covered, without it the seat is "no email"', () => {
  const withMail = coverage(ladder, [p('Leon', 'G', 'Chief Financial Officer', { email: 'leon@x.co.za' })]);
  assert.strictEqual(seatState(withMail, 'finance'), 'covered');
  const noMail = coverage(ladder, [p('Leon', 'G', 'Chief Financial Officer')]);
  assert.strictEqual(seatState(noMail, 'finance'), 'no email');
  assert.strictEqual(noMail.noEmail, 1);
  assert.strictEqual(noMail.missing, 6);
});

test('an empty seat counts twice as much as a seat that only lacks an email', () => {
  const a = coverage(ladder, [p('A', 'A', 'Chief Financial Officer')]);                 // 6 empty + 1 no email
  const b = coverage(ladder, [p('A', 'A', 'Chief Financial Officer', { email: 'a@x.za' })]); // 6 empty
  assert.strictEqual(a.gap, 13);
  assert.strictEqual(b.gap, 12);
});

test('a procurement title fills only the procurement seat, not energy', () => {
  const c = coverage(ladder, [p('B', 'B', 'Category Manager: Energy & Utilities', { email: 'b@x.za' })]);
  assert.strictEqual(seatState(c, 'proc'), 'covered');
  assert.strictEqual(seatState(c, 'energy'), 'empty');
});

test('someone who has left does not fill a seat', () => {
  const c = coverage(ladder, [p('C', 'C', 'Chief Financial Officer', { email: 'c@x.za', status: 'left' })]);
  assert.strictEqual(seatState(c, 'finance'), 'empty');
});

test('a person listed twice counts once', () => {
  const c = coverage(ladder, [p('D', 'D', 'Chief Financial Officer'), p('D', 'D', 'Chief Financial Officer', { email: 'd@x.za' })]);
  assert.strictEqual(c.people, 1);
  assert.strictEqual(seatState(c, 'finance'), 'covered', 'the copy with the email is the one kept');
});

test('companies are ranked by gap, then the thinnest file, then name', () => {
  const rows = [
    { name: 'Zed', gap: 10, people: 3 }, { name: 'Alpha', gap: 14, people: 2 }, { name: 'Beta', gap: 14, people: 0 }, { name: 'Gamma', gap: 14, people: 0 },
  ];
  assert.strictEqual(rankGaps(rows).map(r => r.name).join(','), 'Beta,Gamma,Alpha,Zed');
});

console.log('\n' + n + ' passed');
