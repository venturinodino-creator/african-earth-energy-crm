#!/usr/bin/env node
/* finder-gaps: where the listed off-takers are missing people, and a way to
   send the contact finder after exactly those gaps.

   "Listed" means the companies on the Off-taker Prospects page: everything
   that is not in the Archive. The archive is never looked at.

   For each listed company it reads the contacts on file and works out, with
   the same seat rules the account page and the org map use
   (js/views-orgmap.js), which of the seven stakeholder-ladder seats are
   filled and whether the person filling each one has an email. A seat is a
   gap when nobody fills it, or when whoever does has no email.

     node scripts/finder-gaps.js gaps    [--limit 20] [--min-gap 1]
     node scripts/finder-gaps.js company <offtakerId>
     node scripts/finder-gaps.js queue   [--max-companies 15] [--min-gap 2]

   gaps     the listed companies, biggest gap first
   company  one company: who is on file, what seat each person fills, what is
            missing. This is what a finder agent reads before it searches, so
            it does not write down someone already there.
   queue    puts a run in the finder's queue for the companies with the
            biggest gaps. It does not search; the listed-offtaker-contact-finder
            agent works it (claim, add, finish via scripts/finder-agent.js).

   Credentials: AEE_EMAIL and AEE_PASSWORD from the environment or a .env
   file (--env <path>). Queueing needs an admin login; the reads need only
   CRM access. Every command prints JSON and nothing else. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.dirname(__dirname);
const SUPA_URL = process.env.AEE_SUPABASE_URL || 'https://pkzfazjtpswqjmnzzrgt.supabase.co';
const SUPA_KEY = process.env.AEE_SUPABASE_KEY || 'sb_publishable_jqCjOPRXZEIKjgNDVsL3uw_ldx-I-tO';

/* The ladder and the seat rules: the app's own, loaded as plain script, so
   this report and the account page can never disagree about who fills a seat. */
function loadLadder() {
  const sandbox = vm.createContext({
    window: {}, console, state: {},
    esc: s => String(s == null ? '' : s), jsStr: v => JSON.stringify(String(v == null ? '' : v)), icon: () => '',
  });
  const src = fs.readFileSync(path.join(REPO, 'js', 'views-orgmap.js'), 'utf8');
  return vm.runInContext(src + '\n;({ AE_LADDER, aeSeatMatch, aePeople })', sandbox);
}

const hasEmail = c => !!String(c.email || '').trim();

/* One company's ladder: for each seat, who fills it and whether they have an email. */
function coverage(ladder, contacts) {
  const people = ladder.aePeople(contacts.filter(c => (c.status || 'active') === 'active'));
  const seats = ladder.AE_LADDER.map(seat => {
    const who = people.filter(c => ladder.aeSeatMatch(seat, c));
    const withEmail = who.filter(hasEmail);
    return { seat: seat.k, label: seat.label, filledBy: who.length, withEmail: withEmail.length,
      state: !who.length ? 'empty' : withEmail.length ? 'covered' : 'no email' };
  });
  const missing = seats.filter(s => s.state === 'empty').length;
  const noEmail = seats.filter(s => s.state === 'no email').length;
  return {
    seats, missing, noEmail,
    gap: missing * 2 + noEmail,       // an empty seat is worth twice a seat with a name but no address
    people: people.length, peopleWithEmail: people.filter(hasEmail).length,
  };
}

/* Companies ordered by how much is missing; ties go to the thinnest file. */
function rankGaps(rows) {
  return rows.slice().sort((a, b) => b.gap - a.gap || a.people - b.people || String(a.name).localeCompare(String(b.name)));
}

let token = null;
function die(msg) { console.log(JSON.stringify({ ok: false, error: msg }, null, 2)); process.exitCode = 1; throw new Error('bail'); }
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_]\w*)\s*=\s*(.*)$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
async function signIn() {
  if (token) return token;
  const raw = String(process.env.AEE_EMAIL || '').trim();
  const email = raw.includes('@') ? raw.toLowerCase() : raw.toLowerCase().replace(/\s+/g, '.') + '@aeeg.co.za';
  if (!raw || !process.env.AEE_PASSWORD) die('No credentials. Set AEE_EMAIL and AEE_PASSWORD in .env or the environment.');
  const res = await fetch(SUPA_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: process.env.AEE_PASSWORD }),
  });
  if (!res.ok) die('Sign-in failed (' + res.status + '). Check AEE_EMAIL and AEE_PASSWORD.');
  token = (await res.json()).access_token;
  return token;
}
async function rest(p, opts = {}) {
  const t = await signIn();
  const res = await fetch(SUPA_URL + '/rest/v1/' + p, {
    ...opts,
    headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) die('Supabase ' + res.status + ' on ' + p.split('?')[0] + ': ' + text.slice(0, 200));
  return text ? JSON.parse(text) : null;
}
async function restAll(p) {
  const rows = [];
  for (let o = 0; ; o += 1000) {
    const pg = await rest(p + '&limit=1000&offset=' + o);
    if (!pg || !pg.length) break;
    rows.push(...pg);
    if (pg.length < 1000) break;
  }
  return rows;
}
function parseArgs(argv) {
  const flags = {}; const rest = [];
  for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) { flags[argv[i].slice(2)] = argv[i + 1]; i++; } else rest.push(argv[i]); }
  return { flags, rest };
}
const out = o => console.log(JSON.stringify(o, null, 2));

/* The listed companies with their ladders. */
async function listedWithCoverage() {
  const ladder = loadLadder();
  const [offs, contacts] = await Promise.all([
    restAll('aee_offtakers?select=id,name,short,sector,province,website,status&archived=eq.false&order=name'),
    restAll('aee_contacts?select=id,offtaker_id,first,last,title,dept,email,phone,role,priority,status,notes&order=offtaker_id,last,id'),
  ]);
  const by = {};
  contacts.forEach(c => { (by[c.offtaker_id] = by[c.offtaker_id] || []).push(c); });
  const rows = offs.map(o => ({ id: o.id, name: o.name, sector: o.sector, province: o.province || '', website: o.website || '', status: o.status, ...coverage(ladder, by[o.id] || []), _contacts: by[o.id] || [] }));
  return { ladder, rows };
}

const commands = {
  async gaps(args, flags) {
    const { rows } = await listedWithCoverage();
    const min = Number(flags['min-gap'] || 1), limit = Number(flags.limit || 20);
    const ranked = rankGaps(rows).filter(r => r.gap >= min);
    out({
      ok: true, listedCompanies: rows.length, withAGap: ranked.length,
      seatsEmpty: rows.reduce((s, r) => s + r.missing, 0), seatsNoEmail: rows.reduce((s, r) => s + r.noEmail, 0),
      companies: ranked.slice(0, limit).map(r => ({
        id: r.id, name: r.name, sector: r.sector, website: r.website, people: r.people, peopleWithEmail: r.peopleWithEmail,
        gap: r.gap, emptySeats: r.seats.filter(s => s.state === 'empty').map(s => s.label),
        seatsWithNoEmail: r.seats.filter(s => s.state === 'no email').map(s => s.label),
      })),
    });
  },

  async company(args) {
    const id = args[0];
    if (!id) die('Usage: company <offtakerId>');
    const { ladder, rows } = await listedWithCoverage();
    const r = rows.find(x => x.id === id);
    if (!r) die('No listed company with id ' + id + ' (archived companies are not worked)');
    const people = ladder.aePeople(r._contacts.filter(c => (c.status || 'active') === 'active'));
    out({
      ok: true, id: r.id, name: r.name, website: r.website, sector: r.sector,
      seats: r.seats.map(s => ({ seat: s.label, state: s.state })),
      onFile: people.map(c => ({
        name: (c.first + ' ' + c.last).trim(), title: c.title || '', dept: c.dept || '', hasEmail: hasEmail(c),
        fills: ladder.AE_LADDER.filter(seat => ladder.aeSeatMatch(seat, c)).map(s => s.label),
      })),
    });
  },

  async queue(args, flags) {
    const { rows } = await listedWithCoverage();
    const min = Number(flags['min-gap'] || 2), max = Number(flags['max-companies'] || 15);
    const pick = rankGaps(rows).filter(r => r.gap >= min).slice(0, max);
    if (!pick.length) return out({ ok: true, queued: false, note: 'No listed company has a gap of ' + min + ' or more.' });
    const id = 'run_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    const row = {
      id, created: new Date().toISOString().slice(0, 10), status: 'queued', industry: 'all',
      roles: ['decision', 'influencer', 'technical', 'gatekeeper'], offtaker_ids: pick.map(r => r.id), found: 0,
      note: 'Gap run: ' + pick.length + ' listed companies, biggest ladder gaps first. Fill empty seats and add emails to seats with a name but no address.',
      updated_at: new Date().toISOString(),
    };
    const [made] = await rest('aee_contact_runs', { method: 'POST', body: JSON.stringify(row) });
    out({ ok: true, queued: true, runId: made.id, companies: pick.map(r => ({ id: r.id, name: r.name, gap: r.gap })) });
  },
};

async function main() {
  const { flags, rest: args } = parseArgs(process.argv.slice(2));
  loadEnv(path.resolve(flags.env || path.join(REPO, '.env')));
  const cmd = args.shift();
  if (!commands[cmd]) die('Usage: gaps | company <id> | queue. See the header of scripts/finder-gaps.js.');
  await commands[cmd](args, flags);
}
if (require.main === module) main().catch(e => { if (e.message !== 'bail') { out({ ok: false, error: String(e.message || e) }); process.exitCode = 1; } });
module.exports = { coverage, rankGaps, loadLadder, listedWithCoverage, rest, loadEnv };
