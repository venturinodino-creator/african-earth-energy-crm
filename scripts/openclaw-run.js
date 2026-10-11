#!/usr/bin/env node
/* openclaw-run: run this repo's research agents as OpenClaw agents.

   The agents are the briefs already in .claude/agents (the offtaker, municipality, priority
   and listed-offtaker contact finders). `setup` registers each one with OpenClaw as an agent
   called aeeg-<name>, with a workspace of its own whose AGENTS.md is that brief. A run then
   asks the OpenClaw gateway to give that agent a task. The model researches; the brief's own
   commands (`node scripts/finder-agent.js ...`) run in this repository, and that script owns
   sign-in and every database write. Nothing an agent finds becomes a contact: it lands in the
   review queue for a person to accept.

     node scripts/openclaw-run.js list
     node scripts/openclaw-run.js setup    [--dry]
     node scripts/openclaw-run.js brief    <agent> (--run <id> | --task "<text>")
     node scripts/openclaw-run.js run      <agent> (--run <id> | --task "<text>") [--timeout 3600] [--dry]
     node scripts/openclaw-run.js dispatch [--max 3] [--timeout 3600] [--dry]

   list      the agents, the OpenClaw id and model each gets
   setup     create each agent's workspace and register it with OpenClaw. Safe to run again:
             it rewrites the workspace files from the briefs and leaves an existing agent alone.
   brief     the task an agent would be given; calls nothing
   run       one agent, one run (or one task), now, through the gateway
   dispatch  every run queued in the Contact finder, each to the right agent, oldest first.
             Nothing queued means nothing is started and nothing is spent.

   Run it from the checkout that holds .env (the finder script reads its sign-in from there), or
   pass --repo <dir>. The OpenClaw gateway must be running, as it is once OpenClaw is installed.
   Each run is its own OpenClaw session, so the OpenClaw dashboard shows one thread per run.

   Every command prints JSON and nothing else. Exit code 0 is success, 1 a failure, 2 a timeout. */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const REPO = path.dirname(__dirname);
const AGENT_DIR = path.join('.claude', 'agents');
const ID_PREFIX = 'aeeg-';

/* The models this install allows, by the names the Claude Code briefs use. */
const MODELS = {
  sonnet: 'anthropic/claude-sonnet-5-5',
  opus: 'anthropic/claude-opus-5-5',
  haiku: 'anthropic/claude-haiku-5-5',
};
const DEFAULT_MODEL = MODELS.sonnet;

/* ─── THE BRIEFS ─────────────────────────────────────────────────── */
function parseAgentFile(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(String(text));
  if (!m) throw new Error('agent file has no front matter');
  const meta = {};
  m[1].split(/\r?\n/).forEach(line => {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (kv) meta[kv[1]] = kv[2].trim();
  });
  return { name: meta.name, description: meta.description || '', tools: meta.tools || '', model: meta.model, body: m[2].trim() };
}

/* Every agent file in .claude/agents, by name. */
function loadAgents(repo) {
  const dir = path.join(repo, AGENT_DIR);
  const out = {};
  fs.readdirSync(dir).filter(f => f.endsWith('.md')).forEach(f => {
    const a = parseAgentFile(fs.readFileSync(path.join(dir, f), 'utf8'));
    out[a.name || path.basename(f, '.md')] = a;
  });
  return out;
}

function modelFor(m) {
  if (m && MODELS[m]) return MODELS[m];
  if (m && /^[a-z0-9-]+\/[A-Za-z0-9._-]+$/.test(m)) return m;
  return DEFAULT_MODEL;
}

/* ─── THE OPENCLAW AGENTS ────────────────────────────────────────── */
/* aeeg-<name>: the prefix keeps them together in OpenClaw and clear of its own `main`. */
function agentId(name) { return ID_PREFIX + name; }

/* Each agent keeps its own memory and notes in a folder of its own beside OpenClaw's, never
   in the repository: an agent's workspace gets files written into it as it works, and the
   repository's working tree is not the place for them. */
function workspaceFor(name) { return path.join(os.homedir(), '.openclaw', 'workspace-' + agentId(name)); }

/* `agents add` without --role works while the gateway is running (--role needs it stopped). */
function registerArgs(name, model) {
  return ['agents', 'add', agentId(name), '--workspace', workspaceFor(name), '--model', model, '--non-interactive', '--json'];
}

/* The files OpenClaw reads from an agent's workspace. AGENTS.md is the brief, wrapped in where
   the repository is and the rules that sit over it. The brief itself is the Claude Code file,
   unchanged: there is one copy of what each agent does, and `setup` regenerates this from it. */
function workspaceFiles(agent, repo) {
  const agents = [
    '# ' + agent.name,
    '',
    'Generated from `.claude/agents/' + agent.name + '.md` by `node scripts/openclaw-run.js setup`. Edit that file ' +
      'and run setup again: anything changed here is overwritten.',
    '',
    '## Where you work',
    '',
    'The African Earth Energy CRM repository is at `' + repo + '`. This folder is only for your own notes. ' +
      'Do the work in the repository: its root is your working directory for every command in the brief ' +
      '(`node scripts/finder-agent.js ...`), so set your exec tool\'s working directory to it, or start each ' +
      'command by changing into it.',
    '',
    'The brief below was written for Claude Code. Where it names a tool, use your own equivalent: Bash is your ' +
      'exec tool; Read, Grep and Glob are your file tools; WebSearch and WebFetch are your web search and web ' +
      'fetch tools.',
    '',
    '## Three rules, over anything below',
    '',
    '1. Never open, read, print or copy `.env` or any credential. `scripts/finder-agent.js` signs in for you.',
    '2. Do not write, edit or create any file in the repository, and do not commit or push. Your only writes ' +
      'are the finder script\'s own commands (claim, add, finish, fail).',
    '3. Nothing you find becomes a contact. It goes to the review queue for a person to accept.',
    '',
    '## Your brief',
    '',
    agent.body,
    '',
  ].join('\n');

  return {
    'AGENTS.md': agents,
    'SOUL.md': '# Soul\n\nA careful desk researcher. A claim is only as good as the page you read it from, so you would ' +
      'rather hand back nothing than a guess. You write down what the page says, not what it implies.\n',
    'IDENTITY.md': '# Identity\n\n- Name: ' + agentId(agent.name) + '\n- Brief: ' + agent.name + '\n' +
      '- Job: finds named people at African Earth Energy\'s target companies and municipalities, from official public sources\n',
    'USER.md': '# The desk\n\nYou work for the African Earth Energy sales desk. A person on the desk reviews every find in the ' +
      'CRM\'s Contact finder before it becomes a contact, so write each one as a claim they can check. You do not ' +
      'message anyone and you do not contact the people you find.\n',
  };
}

/* ─── WHO TAKES WHICH RUN ────────────────────────────────────────── */
/* A municipality run is the municipality agent's by definition. A run queued from the
   ladder gaps (scripts/finder-gaps.js queue) is the listed-offtaker agent's. Anything
   else is a sector, which the offtaker agent works. The deeper priority-list agent is
   asked for by name, never picked automatically: it is slow and wide on purpose. */
function pickAgent(run) {
  if (run.industry === 'municipal') return 'municipality-contact-finder';
  if (/^gap run/i.test(String(run.note || ''))) return 'listed-offtaker-contact-finder';
  return 'offtaker-contact-finder';
}

/* The queued runs, oldest first, each with its agent; `max` of them. */
function planDispatch(runs, max) {
  return runs.filter(r => r.status === 'queued')
    .sort((a, b) => String(a.created || '').localeCompare(String(b.created || '')))
    .slice(0, max)
    .map(r => ({ runId: r.id, agent: pickAgent(r) }));
}
function leftOver(runs, max) {
  return Math.max(0, runs.filter(r => r.status === 'queued').length - max);
}

/* ─── THE TASK, AND HOW IT IS SENT ───────────────────────────────── */
function taskFor(o) {
  if (o.task) return o.task;
  if (o.run) {
    return 'Work run ' + o.run + '. Claim it first, then research each target, add each find as you go, ' +
      'and finish the run with a one-line coverage note.';
  }
  throw new Error('give the agent something to do: --run <id> or --task "<text>"');
}

/* One OpenClaw session per run, named after it, so the dashboard shows one thread per run. */
function sessionKey(id, o, now) {
  const key = o.run ? String(o.run).toLowerCase().replace(/[^a-z0-9_-]/g, '') : 'task-' + (now || Date.now());
  return 'agent:' + id + ':' + key;
}

/* Through the gateway, which is already running under the user's own login. The embedded
   `agent exec` turn is not used: started from inside another Claude session it never returns,
   because the Claude process it launches inherits that session's environment. The prompt goes
   in a file, never on the command line. */
function gatewayArgs(o) {
  return ['agent', '--agent', o.agentId, '--session-key', o.sessionKey, '--message-file', o.messageFile,
    '--json', '--timeout', String(o.timeout)];
}

/* The gateway prints one JSON envelope: { runId, status, summary, result: { payloads, meta } }.
   A run is good only when its status is "ok". */
function readResult(stdout) {
  const s = String(stdout || '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  let j;
  try { j = JSON.parse(s.slice(a, b + 1)); } catch (e) { return { ok: false, answer: trim(s, 2000), error: 'OpenClaw printed no result' }; }
  const payloads = (j.result && Array.isArray(j.result.payloads)) ? j.result.payloads : [];
  const meta = (j.result && j.result.meta) || {};
  const ok = j.status === 'ok';
  return {
    ok,
    answer: trim(payloads.map(p => (p && p.text) || '').filter(Boolean).join('\n'), 6000),
    sessionId: meta.systemPromptReport && meta.systemPromptReport.sessionId,
    durationMs: meta.durationMs,
    error: ok ? undefined : String((j.error && (j.error.message || j.error)) || j.summary || 'status ' + j.status),
  };
}

function parseFlags(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true; else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

/* ─── RUNNING ────────────────────────────────────────────────────── */
function say(obj) { console.log(JSON.stringify(obj, null, 2)); }
function die(msg) { say({ ok: false, error: msg }); process.exitCode = 1; return null; }
function trim(s, n) { s = String(s || '').trim(); return s.length > n ? s.slice(0, n) + ' … [' + (s.length - n) + ' more characters]' : s; }

/* How to start OpenClaw without a shell. On Windows it installs as a .cmd shim that Node
   will not start directly, so the package's own entry file is run with this Node instead.
   OPENCLAW_MJS points at that file if it lives somewhere unusual. */
function openclawCommand() {
  const mjs = process.env.OPENCLAW_MJS ||
    (process.platform === 'win32' && process.env.APPDATA
      ? path.join(process.env.APPDATA, 'npm', 'node_modules', 'openclaw', 'openclaw.mjs') : '');
  if (mjs && fs.existsSync(mjs)) return { cmd: process.execPath, pre: [mjs], shell: false };
  return { cmd: 'openclaw', pre: [], shell: process.platform === 'win32' };
}

/* Stops a process and everything it started. child.kill() stops only the process itself, and
   OpenClaw is several; on Windows taskkill /T takes the tree. */
function killTree(child) {
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
    else child.kill('SIGKILL');
  } catch (e) { /* already gone */ }
}

/* Runs `openclaw` and resolves with what came back. The command line is slow to start (it opens
   OpenClaw's state), so the deadline is the run's own plus room for that. */
function openclaw(args, timeoutMs) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const oc = openclawCommand();
    const child = spawn(oc.cmd, oc.pre.concat(args), { shell: oc.shell, windowsHide: true });
    let stdout = '', stderr = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; killTree(child); }, timeoutMs);
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', e => { clearTimeout(timer); resolve({ code: 1, stdout, stderr: String(e.message), seconds: 0, timedOut }); });
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ code: timedOut ? 2 : code, stdout, stderr, seconds: Math.round((Date.now() - t0) / 1000), timedOut });
    });
  });
}

/* Create each agent's workspace and register it. An agent that already exists is left alone;
   its workspace files are still rewritten from the brief, which is how a changed brief reaches it. */
async function setupAgents(agents, repo, dry) {
  if (!fs.existsSync(path.join(repo, '.env'))) {
    throw new Error(repo + ' has no .env, so its agents could not sign in. Run setup from the checkout that has one, or pass --repo.');
  }
  const out = [];
  for (const name of Object.keys(agents).sort()) {
    const agent = agents[name];
    const model = modelFor(agent.model);
    const ws = workspaceFor(name);
    const row = { agent: name, id: agentId(name), model, workspace: ws };
    if (dry) { out.push(Object.assign(row, { dry: true, files: Object.keys(workspaceFiles(agent, repo)) })); continue; }
    fs.mkdirSync(ws, { recursive: true });
    const files = workspaceFiles(agent, repo);
    Object.keys(files).forEach(f => fs.writeFileSync(path.join(ws, f), files[f], 'utf8'));
    const r = await openclaw(registerArgs(name, model), 5 * 60 * 1000);
    const said = (r.stdout + ' ' + r.stderr);
    if (r.code === 0) row.registered = true;
    else if (/already (exists|registered)|exists/i.test(said)) { row.registered = true; row.note = 'already registered; workspace files refreshed'; }
    else { row.registered = false; row.error = trim(said, 800); process.exitCode = 1; }
    out.push(row);
  }
  return out;
}

/* One agent, one task, through the gateway. */
async function runAgent(agents, name, o, timeoutSec, dry, repo) {
  const agent = agents[name];
  if (!agent) throw new Error('no agent called ' + name + '. Known: ' + Object.keys(agents).sort().join(', '));
  const task = taskFor(o);
  const id = agentId(name);
  const key = sessionKey(id, o);
  if (dry) return { agent: name, id, model: modelFor(agent.model), session: key, dry: true, repo, task };

  const messageFile = path.join(os.tmpdir(), 'aeeg-openclaw-' + name + '-' + process.pid + '.md');
  fs.writeFileSync(messageFile, task + '\n', 'utf8');
  try {
    const r = await openclaw(gatewayArgs({ agentId: id, sessionKey: key, messageFile, timeout: timeoutSec }), (timeoutSec + 300) * 1000);
    const res = r.timedOut ? { ok: false, answer: '', error: 'timed out after ' + timeoutSec + ' seconds' } : readResult(r.stdout);
    const ok = r.code === 0 && res.ok;
    return {
      agent: name, id, model: modelFor(agent.model), session: key, ok, exitCode: r.code, timedOut: r.timedOut, seconds: r.seconds,
      answer: res.answer, sessionId: res.sessionId, error: ok ? undefined : (res.error || 'exit code ' + r.code),
      hint: !ok && /not found|unknown agent/i.test(res.error || '') ? 'Run `node scripts/openclaw-run.js setup` first.' : undefined,
      stderr: ok ? undefined : trim(r.stderr, 1200),
    };
  } finally {
    try { fs.unlinkSync(messageFile); } catch (e) { /* already gone */ }
  }
}

/* The queue, through the finder script, so there is one reader of it. */
function queuedRuns(repo) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(repo, 'scripts', 'finder-agent.js'), 'runs'], { cwd: repo });
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('close', () => {
      try { const j = JSON.parse(out); if (j.ok === false) reject(new Error(j.error || 'finder-agent runs failed')); else resolve(j.runs || []); }
      catch (e) { reject(new Error('could not read the queue: ' + trim(out || err, 400))); }
    });
  });
}

async function main() {
  const f = parseFlags(process.argv.slice(2));
  const cmd = f._[0];
  /* The checkout the agents work in: this one, unless told otherwise. A worktree has no .env,
     so --repo points them at the checkout that does. */
  const repo = typeof f.repo === 'string' ? path.resolve(f.repo) : REPO;
  if (!fs.existsSync(path.join(repo, AGENT_DIR))) return die(repo + ' is not this repository: it has no ' + AGENT_DIR);
  const agents = loadAgents(repo);
  const timeoutSec = Number(f.timeout) > 0 ? Number(f.timeout) : 3600;

  if (cmd === 'list') {
    return say({ ok: true, repo, agents: Object.values(agents).map(a => ({
      name: a.name, id: agentId(a.name), model: modelFor(a.model), workspace: workspaceFor(a.name), what: a.description.split('. ')[0] })) });
  }

  if (cmd === 'setup') {
    const rows = await setupAgents(agents, repo, !!f.dry);
    return say({ ok: rows.every(r => r.dry || r.registered), repo, agents: rows,
      next: 'Queue a run in the Contact finder, then: node scripts/openclaw-run.js dispatch' });
  }

  if (cmd === 'brief') {
    const agent = agents[f._[1]];
    if (!agent) return die('no agent called ' + f._[1] + '. Try: list');
    return console.log(workspaceFiles(agent, repo)['AGENTS.md'] + '\n=== TASK ===\n\n' + taskFor(f));
  }

  if (cmd === 'run') {
    if (!f._[1]) return die('which agent? Try: list');
    const r = await runAgent(agents, f._[1], f, timeoutSec, !!f.dry, repo);
    say({ ok: r.ok !== false, ...r });
    if (r.ok === false) process.exitCode = r.timedOut ? 2 : 1;
    return;
  }

  if (cmd === 'dispatch') {
    const max = Number(f.max) > 0 ? Number(f.max) : 3;
    const runs = await queuedRuns(repo);
    const plan = planDispatch(runs, max);
    if (!plan.length) return say({ ok: true, queued: 0, note: 'Nothing is queued in the Contact finder, so nothing was started.' });
    const results = [];
    for (const p of plan) {
      const r = await runAgent(agents, p.agent, { run: p.runId }, timeoutSec, !!f.dry, repo);
      results.push({ runId: p.runId, ...r });
      if (r.ok === false) process.exitCode = r.timedOut ? 2 : 1;
    }
    return say({ ok: results.every(r => r.ok !== false), queued: runs.length, started: results.length, left: leftOver(runs, max), results });
  }

  die('usage: node scripts/openclaw-run.js list | setup | brief | run | dispatch   (see the top of this file)');
}

if (require.main === module) main().catch(e => die(String(e.message || e)));
module.exports = {
  parseAgentFile, loadAgents, modelFor, agentId, workspaceFor, registerArgs, workspaceFiles,
  pickAgent, planDispatch, leftOver, taskFor, sessionKey, gatewayArgs, readResult, parseFlags,
};
