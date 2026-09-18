/* Tests for the contact finder agent's validator.
 *
 * checkFind is the only thing standing between a hallucinated person and
 * a row that reaches a reviewer looking exactly as tidy as a real one.
 * The reviewer cannot tell a guessed email from a read one, so these
 * cases are the guard rail rather than a formality.
 *
 *   node tests/finder-agent.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const { checkFind, municipalities, toAuthEmail } = require('../scripts/finder-agent.js');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
/* Asserts the find is refused, and that the refusal SAYS WHY — an error
   that does not name the problem sends the agent guessing. */
function refuses(find, because) {
  const problems = checkFind(find);
  assert.ok(problems.length, 'expected a refusal, got none');
  assert.ok(problems.some(p => p.toLowerCase().includes(because.toLowerCase())),
    'refused, but for the wrong reason: ' + JSON.stringify(problems));
}

const good = {
  offtakerId: 'off_1', first: 'Thabo', last: 'Mokoena',
  title: 'Group Energy Manager', role: 'decision',
  email: 't.mokoena@example.co.za', phone: '+27 11 555 0100',
  source: 'https://example.co.za/about/leadership', confidence: 0.9,
};

console.log('\ncheckFind — accepts a well-formed find');
test('a complete find passes', () => assert.deepStrictEqual(checkFind(good), []));
test('email alone is enough', () => assert.deepStrictEqual(checkFind({ ...good, phone: undefined }), []));
test('phone alone is enough', () => assert.deepStrictEqual(checkFind({ ...good, email: undefined }), []));
test('confidence may be omitted', () => assert.deepStrictEqual(checkFind({ ...good, confidence: undefined }), []));
test('a municipality id passes', () =>
  assert.deepStrictEqual(checkFind({ ...good, offtakerId: 'mun_LIM353', title: 'Municipal Manager' }), []));

console.log('\ncheckFind — refuses what a reviewer could not catch');
test('no offtakerId', () => refuses({ ...good, offtakerId: '' }, 'offtakerId'));
test('no surname', () => refuses({ ...good, last: '' }, 'first and last'));
test('no title', () => refuses({ ...good, title: '' }, 'title'));
test('no source', () => refuses({ ...good, source: '' }, 'source'));
test('source that is not a URL', () => refuses({ ...good, source: 'their website' }, 'URL'));
test('neither email nor phone', () =>
  refuses({ ...good, email: undefined, phone: undefined }, 'cannot be contacted'));
test('an email that is not an address', () => refuses({ ...good, email: 'not-an-address' }, 'address'));
test('a generic inbox', () => refuses({ ...good, email: 'info@example.co.za' }, 'generic inbox'));
test('another generic inbox', () => refuses({ ...good, email: 'enquiries@example.co.za' }, 'generic inbox'));
test('a role outside the four', () => refuses({ ...good, role: 'boss' }, 'role must be one of'));
test('a seat outside the seven', () => refuses({ ...good, seat: 'legal' }, 'seat must be one of'));
test('confidence above 1', () => refuses({ ...good, confidence: 5 }, 'between 0 and 1'));
test('confidence that is a guess', () => refuses({ ...good, confidence: 0.3 }, 'better source'));
test('not an object at all', () => refuses('Thabo Mokoena', 'JSON object'));

console.log('\nthe target list');
test('all 257 municipalities load', () => assert.strictEqual(municipalities().length, 257));
test('20 are main', () => assert.strictEqual(municipalities().filter(m => m.main).length, 20));
test('ids are namespaced, so they cannot collide with an offtaker', () =>
  assert.ok(municipalities().every(m => m.id.startsWith('mun_'))));
/* The name trap the municipality agent is warned about, asserted here so
   it stays true: two different places share the name Emalahleni. */
test('Emalahleni is two different municipalities', () => {
  const both = municipalities().filter(m => m.name === 'Emalahleni');
  assert.strictEqual(both.length, 2);
  assert.deepStrictEqual(both.map(m => m.id).sort(), ['mun_EC136', 'mun_MP312']);
  assert.strictEqual(both.find(m => m.id === 'mun_MP312').main, true);
  assert.strictEqual(both.find(m => m.id === 'mun_EC136').main, false);
});

console.log('\nsign-in address');
test('a plain username is completed', () => assert.strictEqual(toAuthEmail('dino'), 'dino@aeeg.co.za'));
test('a full address is left alone', () =>
  assert.strictEqual(toAuthEmail('Someone@Example.com'), 'someone@example.com'));

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
