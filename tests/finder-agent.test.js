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
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { checkFind, municipalities, toAuthEmail } = require('../scripts/finder-agent.js');

const AGENT = path.join(__dirname, '..', 'scripts', 'finder-agent.js');
function runAgent(...args) {
  return spawnSync(process.execPath, [AGENT, ...args], { encoding: 'utf8' });
}

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
test('phone may be omitted', () => assert.deepStrictEqual(checkFind({ ...good, phone: undefined }), []));
test('confidence may be omitted', () => assert.deepStrictEqual(checkFind({ ...good, confidence: undefined }), []));
test('a municipality id passes', () =>
  assert.deepStrictEqual(checkFind({ ...good, offtakerId: 'mun_LIM353', title: 'Municipal Manager' }), []));

console.log('\ncheckFind — refuses what a reviewer could not catch');
test('no offtakerId', () => refuses({ ...good, offtakerId: '' }, 'offtakerId'));
test('no surname', () => refuses({ ...good, last: '' }, 'first and last'));
test('no title', () => refuses({ ...good, title: '' }, 'title'));
test('no source', () => refuses({ ...good, source: '' }, 'source'));
test('source that is not a URL', () => refuses({ ...good, source: 'their website' }, 'URL'));
test('phone alone is not enough — email is required', () =>
  refuses({ ...good, email: undefined }, 'email is required'));
test('neither email nor phone', () =>
  refuses({ ...good, email: undefined, phone: undefined }, 'email is required'));
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

/* The command line, spawned for real.

   Everything above imports pure functions, so none of it could see that
   every failure after a request used to exit with a Windows abort code
   instead of 1. die() called process.exit() while undici still had
   sockets closing, libuv asserted in async.c, and the process aborted.

   THESE TESTS DO NOT REPRODUCE THAT, and that is worth knowing before
   trusting them as a guard. The abort needs the TLS path. Measured
   against the unfixed script:

     local HTTP stub        exit 1,          stderr empty
     real HTTPS Supabase    exit 3221226505, stderr the assertion

   So an offline test cannot trip it, and one that claimed to would be
   worse than none. Reproducing it means pointing the unfixed script at
   a real https:// endpoint that refuses the sign-in.

   What these DO lock down is the contract every such failure has to
   meet, which is the part that actually broke: exit 1, the reason as
   JSON on stdout, nothing on stderr, reported exactly once. A future
   change that reaches for process.exit() again fails the stderr and
   exit-code assertions the moment it runs anywhere with TLS, and fails
   the "exactly once" assertion here immediately if the throw and the
   top-level catch ever both report. */
function startStub() {
  /* A separate process, deliberately: the tests below drive the agent
     with spawnSync, which blocks this process's event loop until the
     child exits. A server running here could never answer the request,
     and the two would wait on each other until something timed out. */
  const child = spawn(process.execPath, [path.join(__dirname, 'stub-auth-server.js')],
    { stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((resolve, reject) => {
    let buf = '';
    child.stdout.on('data', d => {
      buf += d;
      const nl = buf.indexOf('\n');
      if (nl < 0) return;
      const { port } = JSON.parse(buf.slice(0, nl));
      resolve({ url: 'http://127.0.0.1:' + port, close: () => child.kill() });
    });
    child.on('error', reject);
    child.on('exit', c => reject(new Error('stub server exited early (' + c + ')')));
  });
}

function runAgainstStub(stub, ...args) {
  return spawnSync(process.execPath, [AGENT, ...args], {
    encoding: 'utf8',
    env: { ...process.env,
      AEE_SUPABASE_URL: stub.url,
      AEE_EMAIL: 'stub@example.invalid',
      AEE_PASSWORD: 'not-a-real-password' },
  });
}

(async () => {
  const stub = await startStub();

  console.log('\nthe command line, once a request has been made');
  test('a failed sign-in exits 1', () => {
    /* Against the stub this passed before the fix too — see the note
       above. It is here as the contract, not as the reproduction. */
    assert.strictEqual(runAgainstStub(stub, 'runs').status, 1);
  });
  test('nothing is written to stderr', () => {
    /* The assertion arrived here as a C-level line no JSON reader could
       parse. A quiet stderr is the signal that the process ended rather
       than aborted, and it is the assertion that would catch a
       returning process.exit() on any machine that uses TLS. */
    assert.strictEqual(runAgainstStub(stub, 'runs').stderr, '');
  });
  test('the reason is on stdout as JSON', () => {
    const r = JSON.parse(runAgainstStub(stub, 'runs').stdout);
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /Sign-in failed \(400\)/);
  });
  test('the failure is reported exactly once', () => {
    /* die() throws now, so the command stops. If the top level treated
       that throw as a fresh crash it would print a second object. */
    const out = runAgainstStub(stub, 'runs').stdout.trim();
    assert.strictEqual(out.split(/\}\s*\{/).length, 1);
  });

  console.log('\nthe command line, before any request');
  test('a usage error exits 1 and says why', () => {
    const r = spawnSync(process.execPath, [AGENT, 'targets'], { encoding: 'utf8' });
    assert.strictEqual(r.status, 1);
    assert.match(JSON.parse(r.stdout).error, /Usage: targets/);
  });
  test('an unknown command lists the real ones', () => {
    const r = spawnSync(process.execPath, [AGENT, 'no-such-command'], { encoding: 'utf8' });
    assert.ok(JSON.parse(r.stdout).commands.includes('runs'));
  });

  stub.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})();

