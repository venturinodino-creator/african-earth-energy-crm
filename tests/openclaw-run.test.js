/* Tests for the OpenClaw runner (scripts/openclaw-run.js): the agents registered with OpenClaw,
 * the files each is given, which agent a queued run goes to, and the exact commands that would
 * be run. Nothing here starts OpenClaw or a model, or touches the database.
 *
 *   node tests/openclaw-run.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const R = require('../scripts/openclaw-run.js');

const REPO = path.join(__dirname, '..');
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

console.log('\nThe briefs');
const agents = R.loadAgents(REPO);
const NAMES = ['listed-offtaker-contact-finder', 'municipality-contact-finder', 'offtaker-contact-finder', 'priority-contact-finder'];

test('every finder agent in .claude/agents is available, under its own name', () => {
  assert.deepStrictEqual(Object.keys(agents).sort(), NAMES);
  NAMES.forEach(name => assert.strictEqual(agents[name].name, name));
});
test('a brief is the body of the file, without its front matter', () => {
  NAMES.forEach(name => {
    const b = agents[name].body;
    assert.ok(b.length > 500, name + ' brief looks empty');
    assert.ok(!/^---/.test(b) && !/^name:/m.test(b.slice(0, 200)), name + ' still carries front matter');
    assert.ok(/finder-agent\.js/.test(b), name + ' should call the finder script');
  });
});
test('front matter is read: description, tools and model', () => {
  const a = R.parseAgentFile('---\nname: demo\ndescription: Does a thing. Use when asked.\ntools: Bash, Read\nmodel: opus\n---\nBody line one.\n\nBody two.\n');
  assert.strictEqual(a.name, 'demo');
  assert.strictEqual(a.description, 'Does a thing. Use when asked.');
  assert.strictEqual(a.model, 'opus');
  assert.strictEqual(a.body, 'Body line one.\n\nBody two.');
});
test('a file with no front matter is refused rather than guessed at', () => {
  assert.throws(() => R.parseAgentFile('Just some text'), /front matter/);
});

console.log('\nThe model');
test('the Claude Code model names map to the OpenClaw model ids the install allows', () => {
  assert.strictEqual(R.modelFor('sonnet'), 'anthropic/claude-sonnet-5-5');
  assert.strictEqual(R.modelFor('opus'), 'anthropic/claude-opus-5-5');
  assert.strictEqual(R.modelFor('haiku'), 'anthropic/claude-haiku-5-5');
});
test('an unknown or missing model falls back to sonnet, and a full id is kept as given', () => {
  assert.strictEqual(R.modelFor(undefined), 'anthropic/claude-sonnet-5-5');
  assert.strictEqual(R.modelFor('mystery'), 'anthropic/claude-sonnet-5-5');
  assert.strictEqual(R.modelFor('anthropic/claude-opus-4-8'), 'anthropic/claude-opus-4-8');
});

console.log('\nThe OpenClaw agents');
test('each finder is an OpenClaw agent called aeeg-<name>, so they sort together and never clash with main', () => {
  assert.strictEqual(R.agentId('offtaker-contact-finder'), 'aeeg-offtaker-contact-finder');
  NAMES.forEach(name => assert.ok(/^aeeg-[a-z-]+$/.test(R.agentId(name))));
});
test('each has its own workspace beside the OpenClaw folders, never inside the repository', () => {
  NAMES.forEach(name => {
    const w = R.workspaceFor(name);
    assert.ok(w.startsWith(path.join(os.homedir(), '.openclaw')), w);
    assert.ok(!w.startsWith(REPO), 'a workspace in the repo would put memory files in the working tree');
  });
  assert.strictEqual(new Set(NAMES.map(R.workspaceFor)).size, NAMES.length, 'no two share a folder');
});
test('registering is a non-interactive add with the workspace and the model', () => {
  const a = R.registerArgs('offtaker-contact-finder', 'anthropic/claude-sonnet-5-5');
  assert.deepStrictEqual(a.slice(0, 3), ['agents', 'add', 'aeeg-offtaker-contact-finder']);
  assert.strictEqual(a[a.indexOf('--workspace') + 1], R.workspaceFor('offtaker-contact-finder'));
  assert.strictEqual(a[a.indexOf('--model') + 1], 'anthropic/claude-sonnet-5-5');
  assert.ok(a.includes('--non-interactive') && a.includes('--json'));
  assert.ok(!a.includes('--role'), '--role needs the gateway stopped');
});

console.log('\nWhat an agent is given');
const files = R.workspaceFiles(agents['offtaker-contact-finder'], REPO);
test('its workspace holds the four files OpenClaw reads, and nothing else is needed', () =>
  assert.deepStrictEqual(Object.keys(files).sort(), ['AGENTS.md', 'IDENTITY.md', 'SOUL.md', 'USER.md']));
test('AGENTS.md carries the brief, unchanged, and says it is generated from the repo file', () => {
  const a = files['AGENTS.md'];
  assert.ok(a.includes(agents['offtaker-contact-finder'].body.slice(0, 300)));
  assert.ok(a.includes(agents['offtaker-contact-finder'].body.slice(-200)));
  assert.ok(/generated/i.test(a) && a.includes('.claude/agents/offtaker-contact-finder.md') && /overwritten|setup again/i.test(a));
});
test('it says where the repository is and that every command runs from there', () => {
  const a = files['AGENTS.md'];
  assert.ok(a.includes(REPO));
  assert.ok(/working directory/i.test(a) && /finder-agent\.js/.test(a));
});
test('it maps Claude Code\'s tool names onto OpenClaw\'s', () => {
  const a = files['AGENTS.md'];
  assert.ok(/written for Claude Code/i.test(a) && /WebSearch/.test(a) && /WebFetch/.test(a));
});
test('it forbids what an agent must never do: read .env, write files, commit', () => {
  const a = files['AGENTS.md'];
  assert.ok(/never (open|read|print)[^.]*\.env/i.test(a), 'no .env');
  assert.ok(/not (write|edit|create)[^.]*(file|repository)/i.test(a), 'no file writes');
  assert.ok(/commit|push/i.test(a));
  assert.ok(/nothing[^.]*becomes a contact/i.test(a));
});
test('the other files say who the agent is and who it works for, with no credential in any of them', () => {
  assert.ok(/offtaker-contact-finder/.test(files['IDENTITY.md']));
  assert.ok(/review/i.test(files['USER.md']));
  Object.values(files).forEach(t => assert.ok(!/password|AEE_PASSWORD|sb_secret|api[_-]?key\s*[:=]/i.test(t.replace(/Never[^.]*credential[^.]*\./gi, '')), 'no secret'));
});
test('the workspace is built from the same brief for every agent', () => {
  NAMES.forEach(name => {
    const f = R.workspaceFiles(agents[name], REPO)['AGENTS.md'];
    assert.ok(f.includes(agents[name].body.slice(0, 200)), name);
  });
});

console.log('\nWhich agent takes a queued run');
test('a municipality run goes to the municipality agent', () =>
  assert.strictEqual(R.pickAgent({ industry: 'municipal', note: '' }), 'municipality-contact-finder'));
test('a sector run goes to the offtaker agent', () => {
  assert.strictEqual(R.pickAgent({ industry: 'mining', note: '' }), 'offtaker-contact-finder');
  assert.strictEqual(R.pickAgent({ industry: 'chemicals-petrochemicals' }), 'offtaker-contact-finder');
});
test('a run queued from the ladder gaps goes to the listed-offtaker agent', () =>
  assert.strictEqual(R.pickAgent({ industry: 'all', note: 'Gap run: 12 listed companies, biggest ladder gaps first.' }), 'listed-offtaker-contact-finder'));
test('municipal wins over a gap note, because the municipality agent owns that target', () =>
  assert.strictEqual(R.pickAgent({ industry: 'municipal', note: 'Gap run: 3' }), 'municipality-contact-finder'));

console.log('\nWhat a dispatch would do');
const runs = [
  { id: 'run_a', status: 'queued', industry: 'mining', note: '', created: '2026-10-01' },
  { id: 'run_b', status: 'running', industry: 'mining', note: '', created: '2026-10-02' },
  { id: 'run_d', status: 'queued', industry: 'all', note: 'Gap run: 4', created: '2026-10-04' },
  { id: 'run_c', status: 'queued', industry: 'municipal', note: '', created: '2026-10-03' },
];
test('only queued runs are taken, oldest first, each with its agent', () =>
  assert.deepStrictEqual(R.planDispatch(runs, 10), [
    { runId: 'run_a', agent: 'offtaker-contact-finder' },
    { runId: 'run_c', agent: 'municipality-contact-finder' },
    { runId: 'run_d', agent: 'listed-offtaker-contact-finder' }]));
test('a limit caps how many are taken, and the ones left over are counted, not dropped silently', () => {
  assert.strictEqual(R.planDispatch(runs, 2).length, 2);
  assert.strictEqual(R.leftOver(runs, 2), 1);
});
test('an empty queue is an empty plan', () => assert.deepStrictEqual(R.planDispatch([], 5), []));

console.log('\nThe task');
test('a run id becomes the standard task, and a custom task is used as given', () => {
  assert.ok(/run_9/.test(R.taskFor({ run: 'run_9' })) && /claim/i.test(R.taskFor({ run: 'run_9' })));
  assert.strictEqual(R.taskFor({ task: 'Report the three biggest gaps.' }), 'Report the three biggest gaps.');
  assert.throws(() => R.taskFor({}), /--run|--task/);
});
test('each run is its own session, named after the run, so the OpenClaw dashboard shows one thread per run', () => {
  assert.strictEqual(R.sessionKey('aeeg-offtaker-contact-finder', { run: 'run_9Ab-x' }), 'agent:aeeg-offtaker-contact-finder:run_9ab-x');
  assert.ok(/^agent:aeeg-x:task-\d+$/.test(R.sessionKey('aeeg-x', { task: 'anything at all!' }, 1791677000000)));
});

console.log('\nThe commands');
test('a run goes through the gateway to the named agent, in its own session, from a message file', () => {
  const a = R.gatewayArgs({ agentId: 'aeeg-offtaker-contact-finder', sessionKey: 'agent:aeeg-offtaker-contact-finder:run_1', messageFile: 'm.md', timeout: 1800 });
  assert.strictEqual(a[0], 'agent');
  const at = flag => a[a.indexOf(flag) + 1];
  assert.strictEqual(at('--agent'), 'aeeg-offtaker-contact-finder');
  assert.strictEqual(at('--session-key'), 'agent:aeeg-offtaker-contact-finder:run_1');
  assert.strictEqual(at('--message-file'), 'm.md');
  assert.strictEqual(at('--timeout'), '1800');
  assert.ok(a.includes('--json'));
});
test('it does not use the embedded exec turn, which stalls when started from inside another Claude session', () => {
  const a = R.gatewayArgs({ agentId: 'x', sessionKey: 'k', messageFile: 'm.md', timeout: 60 });
  assert.ok(!a.includes('exec') && !a.includes('--local'));
});
test('the prompt is never put on the command line, so it cannot be mangled by the shell', () =>
  assert.ok(!R.gatewayArgs({ agentId: 'x', sessionKey: 'k', messageFile: 'm.md', timeout: 60 }).some(a => /Work run/.test(a))));

console.log('\nThe result');
test('a finished turn gives its answer, its duration and its session', () => {
  const r = R.readResult(JSON.stringify({ runId: 'r-1', status: 'ok', summary: 'completed', result: {
    payloads: [{ text: 'Nothing is queued.', mediaUrl: null }], meta: { durationMs: 40980, systemPromptReport: { sessionId: 's-1' } } } }));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.answer, 'Nothing is queued.');
  assert.strictEqual(r.sessionId, 's-1');
  assert.strictEqual(r.durationMs, 40980);
});
test('several payloads are joined, and a trailing log line before the JSON is ignored', () => {
  const r = R.readResult('[info] connected\n' + JSON.stringify({ status: 'ok', result: { payloads: [{ text: 'one' }, { text: 'two' }] } }));
  assert.strictEqual(r.answer, 'one\ntwo');
});
test('any status other than ok is a failed run, with the reason when there is one', () => {
  const r = R.readResult(JSON.stringify({ runId: 'r-2', status: 'error', summary: 'agent not found', error: { message: 'unknown agent aeeg-x' } }));
  assert.strictEqual(r.ok, false);
  assert.ok(/unknown agent/.test(r.error));
});
test('output that is not a result is a failed run, and says so', () => {
  const r = R.readResult('Error: gateway closed');
  assert.strictEqual(r.ok, false);
  assert.ok(/no result/i.test(r.error));
});

console.log('\nFlags');
test('flags and words are told apart', () => {
  const f = R.parseFlags(['run', 'offtaker-contact-finder', '--run', 'run_1', '--timeout', '900', '--dry']);
  assert.deepStrictEqual(f._, ['run', 'offtaker-contact-finder']);
  assert.strictEqual(f.run, 'run_1');
  assert.strictEqual(f.timeout, '900');
  assert.strictEqual(f.dry, true);
});

console.log('\n' + n + ' passed');
