/* Tests for the daily Apollo ingestion (scripts/apollo-daily.js): who it
 * spends a credit on, and what it is willing to put in the review queue.
 * Nothing here touches Apollo or the database.
 *
 *   node tests/apollo-daily.test.js
 */
'use strict';

const assert = require('assert');
const { chooseCandidates, toFind, sameName, domainOf, parseFlags, harvest } = require('../scripts/apollo-daily.js');
const { coverage, loadLadder } = require('../scripts/finder-gaps.js');
const { isOutOfCredits, OutOfCredits, Bail } = require('../scripts/finder-apollo.js');

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

test('running out of credits is told apart from a plan or validation refusal', () => {
  assert.ok(isOutOfCredits(422, '{"error":"You are out of credits!"}'));
  assert.ok(isOutOfCredits(422, 'Insufficient credits to complete this request'));
  assert.ok(isOutOfCredits(402, ''));
  assert.ok(!isOutOfCredits(403, '{"error":"The api/v1/mixed_people/api_search API is not included in your Free plan"}'));
  assert.ok(!isOutOfCredits(422, '{"error":"Validation failed"}'));
});

/* ─── harvest: the spending loop, against fake Apollo calls ───────── */
const ann = ap('Ann', 'Lee', 'Head of Energy');
const sam = ap('Sam', 'Roe', 'Procurement Manager');
const revealed = p => ({ ...p, email: p.first_name.toLowerCase() + '@acme.co.za', email_status: 'verified' });
const company = id => ({ ...rowFor([]), id, name: 'Company ' + id });
const fakes = (opts) => ({
  budget: opts.budget,
  search: async () => [ann, sam],
  enrich: opts.enrich,
  pause: async () => {},
});

const asyncTests = [];
const atest = (name, fn) => asyncTests.push([name, fn]);

atest('credits running out stops spending but keeps what was already paid for', async () => {
  let calls = 0;
  const r = await harvest([company('a'), company('b'), company('c')], fakes({
    budget: 15,
    enrich: async p => { calls++; if (calls > 2) throw new OutOfCredits('out'); return revealed(p); },
  }));
  assert.strictEqual(r.exhausted, true);
  assert.strictEqual(r.spent, 2);
  assert.deepStrictEqual(r.finds.map(f => f.offtakerId + ':' + f.first), ['a:Ann', 'a:Sam']);
  assert.strictEqual(calls, 3, 'no reveal is attempted after Apollo says the credits are gone');
});

atest('only companies whose candidates were all tried go on cooldown', async () => {
  let calls = 0;
  const r = await harvest([company('a'), company('b'), company('c')], fakes({
    budget: 15,
    enrich: async p => { calls++; if (calls > 3) throw new OutOfCredits('out'); return revealed(p); },
  }));
  assert.deepStrictEqual(r.worked, ['a'], 'b was cut off half way and c never reached: both wait for the next run');
});

atest('the per-run budget leaves unfinished companies off cooldown too', async () => {
  const r = await harvest([company('a'), company('b')], fakes({ budget: 3, enrich: async p => revealed(p) }));
  assert.strictEqual(r.exhausted, false);
  assert.strictEqual(r.spent, 3);
  assert.deepStrictEqual(r.worked, ['a']);
});

atest('a company Apollo has nobody for is worked, so it is not searched every night', async () => {
  const r = await harvest([company('a')], { budget: 5, search: async () => [], enrich: async () => { throw new Error('never'); }, pause: async () => {} });
  assert.deepStrictEqual(r.worked, ['a']);
  assert.strictEqual(r.spent, 0);
});

atest('a dry run (no budget) still searches every company and reveals nobody', async () => {
  let searched = 0;
  const r = await harvest([company('a'), company('b')], { budget: 0, search: async () => { searched++; return [ann]; }, enrich: async () => { throw new Error('never'); }, pause: async () => {} });
  assert.strictEqual(searched, 2);
  assert.strictEqual(r.spent, 0);
  assert.deepStrictEqual(r.report.map(e => e.candidates.length), [1, 1]);
});

atest('a key or plan refusal still stops the whole run', async () => {
  await assert.rejects(harvest([company('a')], { budget: 5, search: async () => { throw new Bail('plan'); }, enrich: async () => null, pause: async () => {} }), Bail);
});

(async () => {
  for (const [name, fn] of asyncTests) { await fn(); n++; console.log('ok - ' + name); }
  console.log(n + ' passed');
})().catch(e => { console.error(e); process.exitCode = 1; });
