/* Agents declare themselves (Change log 6/9, ADR 0002). Every script that writes to the CRM
 * sends its job name in the X-Aee-Agent header on every request, so the change trigger records
 * the change as that agent, run as the person whose sign-in it used, and never counts it as
 * that person's own work.
 *
 *   node tests/change-log-agents.test.js
 *
 * fetch is stubbed; nothing touches the database. No framework and no dependencies.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SCRIPTS = path.join(__dirname, '..', 'scripts');
let pass = 0, fail = 0;
const results = [];
const test = (name, fn) => results.push([name, fn]);

const { agentName } = require('../scripts/agent-name.js');

console.log('\nThe name');
test('a script started directly is named after its file', () => {
  assert.strictEqual(agentName(path.join(SCRIPTS, 'accept-finds.js'), path.join(SCRIPTS, 'apollo-daily.js')), 'apollo-daily');
});
test('a script loaded by something outside scripts/ (a test) uses its own file name', () => {
  assert.strictEqual(agentName(path.join(SCRIPTS, 'finder-gaps.js'), path.join(__dirname, 'x.test.js')), 'finder-gaps');
});
test('AEE_AGENT overrides it, reduced to letters, digits and dashes', () => {
  const was = process.env.AEE_AGENT;
  process.env.AEE_AGENT = ' OpenClaw Finder!! ';
  try { assert.strictEqual(agentName(path.join(SCRIPTS, 'finder-agent.js')), 'openclaw-finder'); }
  finally { if (was === undefined) delete process.env.AEE_AGENT; else process.env.AEE_AGENT = was; }
});

console.log('\nEvery script that writes');
test('every script that calls the CRM\'s API names itself as an agent on its requests', () => {
  const offenders = fs.readdirSync(SCRIPTS).filter(f => f.endsWith('.js') && f !== 'agent-name.js').filter(f => {
    const src = fs.readFileSync(path.join(SCRIPTS, f), 'utf8');
    if (!/\/rest\/v1\//.test(src)) return false;
    return !(/require\(['"]\.\/agent-name(\.js)?['"]\)/.test(src) && /'X-Aee-Agent'\s*:/.test(src));
  });
  assert.deepStrictEqual(offenders, [], 'not naming themselves: ' + offenders.join(', '));
});

console.log('\nOn the wire (fetch stubbed)');
test('accept-finds sends its name on every page it reads', async () => {
  const seen = [];
  global.fetch = async (url, opts) => { seen.push(opts && opts.headers); return { ok: true, status: 200, text: async () => '[]' }; };
  const { restAll } = require('../scripts/accept-finds.js');
  await restAll('aee_contacts?select=id&order=id.asc');
  assert.ok(seen.length >= 1 && seen.every(h => h && h['X-Aee-Agent'] === 'accept-finds'), JSON.stringify(seen));
});
test('finder-gaps\' shared helper (Apollo daily writes through it) sends a name too', async () => {
  const seen = [];
  process.env.AEE_EMAIL = process.env.AEE_EMAIL || 'test'; process.env.AEE_PASSWORD = process.env.AEE_PASSWORD || 'test';
  global.fetch = async (url, opts) => {
    if (/auth\/v1\/token/.test(url)) return { ok: true, status: 200, json: async () => ({ access_token: 't' }) };
    seen.push(opts && opts.headers);
    return { ok: true, status: 200, text: async () => '[]' };
  };
  const gaps = require('../scripts/finder-gaps.js');
  await gaps.rest('aee_contact_runs?select=id', { method: 'POST', body: '{}' });
  assert.ok(seen.length === 1 && seen[0]['X-Aee-Agent'] === 'finder-gaps', JSON.stringify(seen));
});

(async () => {
  for (const [name, fn] of results) {
    try { await fn(); pass++; console.log('  ok   ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  process.exitCode = fail ? 1 : 0;
})();
