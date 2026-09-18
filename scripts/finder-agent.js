#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   The contact finder's hands.

   js/views-contactfinder.js describes an agent that claims a queued
   run, appends what it finds, and marks the run done. This is the half
   of that agent which touches the database. The other half — deciding
   who the right person is and reading their details off a page — is a
   language model, and it drives this file through the commands below.

   The split is the point. Research is judgement and belongs to a model;
   signing in, shaping a row and writing it is plumbing that must be
   exactly right every time, so it lives in code that can be read and
   tested. The model never sees a password, never builds a query and
   cannot write a column this file does not write.

   WHAT IT WILL NOT DO. Nothing here writes aee_contacts. Every find
   lands in aee_found_contacts as `pending`, which is a claim about a
   real person, not a contact. A human accepts it in the Contact finder
   and that is what creates the contact — see the note above the table
   in supabase/schema.sql.

   CREDENTIALS. Writes are gated by row-level security on an admin
   profile, so this needs a real CRM login. It reads:

     AEE_EMAIL     admin username or full address
     AEE_PASSWORD  that account's password

   from the environment or a .env file beside this repo. .env is
   gitignored and must stay that way. Nothing is logged that would put
   either value in a terminal transcript.

   USAGE
     node scripts/finder-agent.js runs                 queued work, as JSON
     node scripts/finder-agent.js targets <runId>      accounts in a run
     node scripts/finder-agent.js claim   <runId>      queued  -> running
     node scripts/finder-agent.js add     <runId> '<json>'     one find
     node scripts/finder-agent.js finish  <runId> [note]       -> done
     node scripts/finder-agent.js fail    <runId> <note>       -> failed

   Every command prints JSON on stdout and nothing else, so the model
   reading it never has to parse prose.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.dirname(__dirname);

/* The project's own public identifiers. These grant nothing on their
   own — see the header of js/supabase.js. Overridable so a fork or a
   staging project does not need this file edited. */
const SUPA_URL = process.env.AEE_SUPABASE_URL || 'https://pkzfazjtpswqjmnzzrgt.supabase.co';
const SUPA_KEY = process.env.AEE_SUPABASE_KEY || 'sb_publishable_jqCjOPRXZEIKjgNDVsL3uw_ldx-I-tO';
const AUTH_DOMAIN = 'aeeg.co.za';

/* The four values aee_found_contacts.role accepts, and the seven seats
   AE_LADDER draws. Kept here as data so an unknown value is refused at
   the door rather than written and puzzled over later. */
const ROLES = ['decision', 'influencer', 'technical', 'gatekeeper'];
const SEATS = ['energy', 'sustain', 'finance', 'exec', 'ops', 'eng', 'proc'];

function out(obj) { console.log(JSON.stringify(obj, null, 2)); }

/* Thrown by die() once the failure has been printed. Carries no message
   anybody reads — it exists so the top level can tell "already
   reported, stop here" apart from a genuine crash. */
class Bail extends Error {}

/* End the command with a reported failure.

   This used to call process.exit(1), which is the bug that made every
   failure exit 127. fetch keeps undici sockets open, and on Windows
   exiting while libuv is still closing those handles trips an assertion
   in async.c: the process aborts, stderr gets a C-level assertion line,
   and the exit code die() was trying to set is replaced by the abort's
   own. A caller checking for 1 saw 127, which conventionally means the
   command was not found at all.

   Setting process.exitCode instead states the intent and lets Node
   finish its own teardown, which it does in less time than the abort
   took. The throw is what stops the command — process.exit() used to do
   that part, and several call sites here run on past die() if it
   returns. */
function die(msg, extra) {
  out({ ok: false, error: msg, ...(extra || {}) });
  process.exitCode = 1;
  throw new Bail(msg);
}

/* ─── .env ─────────────────────────────────────────────────────────
   A deliberately small reader: KEY=value, # comments, optional quotes.
   Values already in the environment win, so a shell export overrides
   the file rather than the other way round. */
function loadDotEnv() {
  const p = path.join(REPO, '.env');
  if (!fs.existsSync(p)) return;
  fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach(line => {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) return;
    let v = m[2].trim().replace(/\s+#.*$/, '');
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  });
}

function toAuthEmail(input) {
  const v = String(input || '').trim();
  if (!v) return '';
  return v.includes('@') ? v.toLowerCase() : v.toLowerCase().replace(/\s+/g, '.') + '@' + AUTH_DOMAIN;
}

/* ─── SUPABASE ─────────────────────────────────────────────────────
   Sign in once, then send the access token on every request so the
   database evaluates writes as that admin rather than as `anon`. */
let token = null;

async function signIn() {
  if (token) return token;
  const email = toAuthEmail(process.env.AEE_EMAIL);
  const password = process.env.AEE_PASSWORD;
  if (!email || !password) {
    die('No credentials. Set AEE_EMAIL and AEE_PASSWORD in .env or the environment.',
      { hint: 'cp .env.example .env, then fill it in. .env is gitignored — never commit it.' });
  }
  const res = await fetch(SUPA_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    /* The response body can echo the address back; the password is
       never in it, and is never printed here either way. */
    die('Sign-in failed (' + res.status + '). Check AEE_EMAIL and AEE_PASSWORD.');
  }
  token = (await res.json()).access_token;
  return token;
}

async function rest(pathAndQuery, opts = {}) {
  const t = await signIn();
  const res = await fetch(SUPA_URL + '/rest/v1/' + pathAndQuery, {
    ...opts,
    headers: {
      apikey: SUPA_KEY,
      Authorization: 'Bearer ' + t,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) die('Supabase ' + res.status + ' on ' + pathAndQuery, { body: text.slice(0, 400) });
  return text ? JSON.parse(text) : null;
}

/* ─── THE TARGET LISTS ─────────────────────────────────────────────
   Offtakers come from the database. Municipalities are reference data
   that never changes from inside the app, so they are read straight
   out of data/municipalities.js — the same file the browser loads,
   evaluated in a sandbox rather than duplicated here, because a second
   copy of 257 records is a second copy to drift. */
let _munis = null;
function municipalities() {
  if (_munis) return _munis;
  const src = fs.readFileSync(path.join(REPO, 'data', 'municipalities.js'), 'utf8');
  const sandbox = { console, window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src + '\n;globalThis.__out = JSON.stringify(SA_MUNICIPALITIES);', sandbox);
  /* Back through JSON deliberately. Objects built inside a vm context
     carry that context's prototypes, so an array from in there is not
     an Array out here as far as anything comparing prototypes is
     concerned. Parsing the string rebuilds them in this realm, and the
     sandbox stays an implementation detail instead of leaking. */
  _munis = JSON.parse(sandbox.__out);
  return _munis;
}

async function offtakers() {
  return rest('aee_offtakers?select=id,name,short,sector,province,city,website');
}

/* What the model needs to start researching one account: who it is,
   where it is, and the page to read first. */
async function targetsFor(run) {
  const ids = run.offtaker_ids || [];
  const munis = municipalities().filter(m => ids.includes(m.id));
  const offs = ids.some(id => !String(id).startsWith('mun_'))
    ? (await offtakers()).filter(o => ids.includes(o.id))
    : [];
  return [
    ...offs.map(o => ({
      id: o.id, kind: 'offtaker', name: o.name, short: o.short || o.name,
      province: o.province || '', city: o.city || '', website: o.website || '',
    })),
    ...munis.map(m => ({
      id: m.id, kind: 'municipality', name: m.name + ' Municipality', short: m.name,
      province: m.province || '', city: m.seat || '', website: '',
      code: m.code, category: m.cat,
    })),
  ];
}

async function getRun(id) {
  const rows = await rest('aee_contact_runs?id=eq.' + encodeURIComponent(id) + '&select=*');
  if (!rows || !rows.length) die('No run with id ' + id);
  return rows[0];
}

function uid(p) {
  return p + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

/* Everything that can be judged about a find without asking the server.
   Pure, so it can be tested without a login — which matters, because
   this is the only thing standing between a hallucinated person and a
   row a reviewer sees laid out as neatly as a real one. */
function checkFind(f) {
  const problems = [];
  if (!f || typeof f !== 'object') return ['a find must be a JSON object'];
  if (!f.offtakerId) problems.push('offtakerId is required');
  if (!f.first || !f.last) problems.push('first and last are both required');
  if (!f.title) problems.push('title is required — the ladder reads the seat off it');
  if (!f.role) problems.push('role is required');
  else if (!ROLES.includes(f.role)) problems.push('role must be one of ' + ROLES.join(', '));
  if (f.seat && !SEATS.includes(f.seat)) problems.push('seat must be one of ' + SEATS.join(', '));
  if (!f.source) problems.push('source is required — the page you read it from');
  else if (!/^https?:\/\//i.test(String(f.source))) problems.push('source must be a URL you actually read');
  /* A work email is required, not merely one of two options. The desk
     writes before it phones, and a row with only a switchboard number
     is a contact nobody follows up — so it is not written. Phone stays
     optional. Keep reading (contact page, annual report, press release
     signature) or use the Apollo source; never guess a pattern. */
  if (!f.email) problems.push('email is required — a person with no work email is not written; find it on an official page or via the Apollo source, and never guess a pattern');
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) problems.push('email does not look like an address');
  /* A shared inbox belongs to no named person, and this table is about
     named people. The reviewer cannot tell from the row, so it is
     refused here. */
  if (f.email && /^(?:info|admin|enquir\w*|contact|sales|reception|office|help|support)@/i.test(f.email)) {
    problems.push('that is a generic inbox, not a person — find the individual or skip them');
  }
  const conf = f.confidence == null ? null : Number(f.confidence);
  if (conf !== null && !(conf >= 0 && conf <= 1)) problems.push('confidence must be a number between 0 and 1');
  if (conf !== null && conf < 0.5) problems.push('confidence below 0.5 is not worth a reviewer\'s time — find a better source');
  return problems;
}

/* ─── COMMANDS ─────────────────────────────────────────────────── */
const commands = {
  async runs() {
    const rows = await rest('aee_contact_runs?status=eq.queued&select=*&order=created.asc');
    out({ ok: true, queued: rows.length, runs: rows });
  },

  async targets(id) {
    if (!id) die('Usage: targets <runId>');
    const run = await getRun(id);
    const targets = await targetsFor(run);
    out({
      ok: true, runId: run.id, status: run.status,
      roles: run.roles || [], industry: run.industry || 'all',
      count: targets.length, targets,
    });
  },

  async claim(id) {
    if (!id) die('Usage: claim <runId>');
    const run = await getRun(id);
    if (run.status !== 'queued') die('Run ' + id + ' is ' + run.status + ', not queued — nothing to claim.');
    const rows = await rest('aee_contact_runs?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH',
      body: JSON.stringify({ status: 'running', claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
    });
    out({ ok: true, claimed: rows[0] });
  },

  /* One find, as JSON. Validated hard: a bad row here becomes a name a
     rep dials, and the reviewer sees a tidy table either way — so the
     check has to happen before the write, not by eye afterwards.

     Shape is checked before signing in, so a malformed row costs a
     round trip to nobody and the agent gets its correction instantly.
     Only the "is this id in this run" question needs the run itself. */
  async add(id, json) {
    if (!id || !json) die('Usage: add <runId> \'{"offtakerId":...}\'');
    let f;
    try { f = JSON.parse(json); } catch (e) { die('That is not valid JSON: ' + e.message); }

    const problems = checkFind(f);
    if (problems.length) die('This find was not written.', { problems });

    const run = await getRun(id);
    const ids = run.offtaker_ids || [];
    if (ids.length && !ids.includes(f.offtakerId)) {
      die('This find was not written.',
        { problems: ['offtakerId ' + f.offtakerId + ' is not one of the targets in run ' + run.id] });
    }
    const conf = f.confidence == null ? null : Number(f.confidence);

    const row = {
      id: uid('fnd'), run_id: run.id, offtaker_id: f.offtakerId,
      first: String(f.first).trim(), last: String(f.last).trim(),
      title: String(f.title).trim(),
      role: f.role, phone: f.phone || null, email: f.email || null,
      source: String(f.source).trim(), confidence: conf, status: 'pending',
    };
    const rows = await rest('aee_found_contacts', { method: 'POST', body: JSON.stringify(row) });
    /* found is a running count so the strip on the finder page is right
       while the run is still going, not only once it ends. */
    const n = await rest('aee_found_contacts?run_id=eq.' + encodeURIComponent(run.id) + '&select=id');
    await rest('aee_contact_runs?id=eq.' + encodeURIComponent(run.id), {
      method: 'PATCH', body: JSON.stringify({ found: n.length, updated_at: new Date().toISOString() }),
    });
    out({ ok: true, wrote: rows[0], foundSoFar: n.length });
  },

  async finish(id, ...note) {
    if (!id) die('Usage: finish <runId> [note]');
    const run = await getRun(id);
    const n = await rest('aee_found_contacts?run_id=eq.' + encodeURIComponent(run.id) + '&select=id');
    const rows = await rest('aee_contact_runs?id=eq.' + encodeURIComponent(run.id), {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'done', found: n.length, note: note.join(' ') || null,
        finished_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }),
    });
    out({ ok: true, finished: rows[0] });
  },

  /* A run that found nothing is done, not failed. `failed` is for a run
     that could not be carried out — so the note is required, because a
     failure nobody can read is a run someone re-queues blindly. */
  async fail(id, ...note) {
    if (!id || !note.length) die('Usage: fail <runId> <why> — the reason is required');
    const rows = await rest('aee_contact_runs?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'failed', note: note.join(' '),
        finished_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }),
    });
    out({ ok: true, failed: rows[0] });
  },
};

async function main() {
  loadDotEnv();
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd || !commands[cmd]) {
    die('Unknown command ' + (cmd || '(none)'), { commands: Object.keys(commands) });
  }
  await commands[cmd](...args);
}

/* Only run when invoked directly, so the validator above can be
   required and tested. */
if (require.main === module) {
  main().catch(e => {
    /* die() has already printed and set the code; re-reporting here
       would print the failure twice. Anything else is a real crash and
       gets the same JSON shape as every other error, because the model
       reading stdout never has to parse prose. */
    if (e instanceof Bail) return;
    out({ ok: false, error: e && e.message ? e.message : String(e) });
    process.exitCode = 1;
  });
}

module.exports = { checkFind, municipalities, toAuthEmail, ROLES, SEATS };
