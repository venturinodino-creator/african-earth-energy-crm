/* The Change log's database side, read from supabase/schema.sql (ADR 0002).
 *
 * The suite has no database, so this reads the reference copy of the live schema and checks
 * the two things that must never slip: every table is either recorded by the change trigger or
 * named below as not (yet) recorded, so a new table cannot go untracked silently; and the change
 * table can be read by admins but written by nobody through the API. The migration itself is
 * verified on the live project inside a rolled-back transaction before it is applied.
 *
 *   node tests/change-log-schema.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8')
  .replace(/--[^\n]*/g, '');   // comments say things; statements do them

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

/* Tables the change trigger does not record, each with its reason. The spec's tracked tables
   still waiting on their ticket are listed here and leave the list as their ticket lands. */
const NOT_RECORDED = {
  aee_changes: 'the change table itself',
  mining_leads: 'legacy table, out of scope',
  aee_pm_projects: 'read-only copy of ProjectManager.com', aee_pm_tasks: 'read-only copy',
  aee_pm_people: 'read-only copy', aee_pm_tags: 'read-only copy', aee_pm_activity: 'read-only copy', aee_pm_sync: 'read-only copy',
  profiles: 'pending: role changes',
  aee_interactions: 'pending', aee_contact_runs: 'pending', aee_found_contacts: 'pending',
  aee_pm_task_edits: 'pending', aee_pm_notes: 'pending', aee_pm_history: 'pending',
};

const tables = [...sql.matchAll(/create table if not exists public\.(\w+)/g)].map(m => m[1]);
const recorded = t => new RegExp('create trigger ' + t + '_record_change\\s+after insert or update or delete on public\\.' + t +
  '\\s+for each row execute function public\\.record_change\\(\\)').test(sql);

console.log('\nRecording');
test('the schema has a change table', () => assert.ok(tables.includes('aee_changes')));
test('the change table holds when, author, agent, table, record, off-taker, kind, fields and a deleted copy', () => {
  const body = sql.match(/create table if not exists public\.aee_changes \(([\s\S]*?)\n\);/)[1];
  ['at', 'author_id', 'author_email', 'agent', 'table_name', 'record_id', 'offtaker_id', 'kind', 'fields', 'deleted_row']
    .forEach(c => assert.ok(new RegExp('^\\s*' + c + '\\s', 'm').test(body), c + ' is missing'));
});
test('every table is recorded, or named as not recorded with a reason', () => {
  const loose = tables.filter(t => !recorded(t) && !NOT_RECORDED[t]);
  assert.deepStrictEqual(loose, [], 'tables with no recording trigger: ' + loose.join(', '));
});
test('nothing named as not recorded is in fact recorded, so the list stays true', () => {
  const stale = Object.keys(NOT_RECORDED).filter(recorded);
  assert.deepStrictEqual(stale, [], 'recorded after all: ' + stale.join(', '));
});
test('next steps, notes and ticks are recorded', () => assert.ok(recorded('aee_stage_items')));
test('an agent is read from the request\'s X-Aee-Agent header, cleaned to letters, digits and dashes', () => {
  const fn = sql.match(/create or replace function public\.request_agent\(\)[\s\S]*?\$\$;/)[0];
  assert.ok(/current_setting\('request\.headers', true\)/.test(fn) && /'x-aee-agent'/.test(fn), 'reads the header PostgREST passes on');
  assert.ok(/regexp_replace/.test(fn) && /nullif/.test(fn), 'cleaned, and empty means none');
  assert.ok(/nullif\(current_setting\('request\.headers', true\), ''\)::json/.test(fn), 'an empty setting (no request) is no agent, not an error');
  assert.ok(/revoke all on function public\.request_agent\(\)\s+from public, anon, authenticated/.test(sql), 'only the database\'s own functions call it');
});
test('the change row records the agent beside the sign-in', () => {
  const fn = sql.match(/create or replace function public\.record_change\(\)[\s\S]*?\$\$;/)[0];
  assert.ok(/\(author_id, author_email, agent,/.test(fn) && /public\.request_agent\(\)/.test(fn), fn.slice(0, 0));
});
test('a byline stamped during an agent\'s request reads as the agent run as the person', () => {
  const fn = sql.match(/create or replace function public\.author_display_name\(\)[\s\S]*?\$\$;/)[0];
  assert.ok(/public\.request_agent\(\)/.test(fn) && /\(run as /.test(fn), 'agent (run as person)');
});
test('companies, contacts and opportunities are recorded', () =>
  ['aee_offtakers', 'aee_contacts', 'aee_deals'].forEach(t => assert.ok(recorded(t), t)));
test('a company carries who last changed it, stamped from the sign-in', () => {
  assert.ok(/alter table public\.aee_offtakers add column if not exists last_changed_by text/.test(sql), 'the column');
  assert.ok(/create trigger aee_offtakers_stamp_last_changed\s+before insert or update on public\.aee_offtakers/.test(sql), 'the trigger');
  const fn = sql.match(/create or replace function public\.stamp_last_changed\(\)[\s\S]*?\$\$;/)[0];
  assert.ok(/new\.last_changed_by\s*:=\s*public\.author_display_name\(\)/.test(fn), 'stamped from the sign-in');
  assert.ok(/new\.last_changed_by\s*:=\s*old\.last_changed_by/.test(fn), 'a save that changes nothing keeps the name it had');
  assert.ok(/alter table public\.aee_offtakers add column if not exists last_changed_at timestamptz/.test(sql), 'and when');
  assert.ok(/new\.last_changed_at\s*:=\s*now\(\)/.test(fn) && /new\.last_changed_at\s*:=\s*old\.last_changed_at/.test(fn), 'stamped and kept like the name');
});
test('who and when last changed are bookkeeping: they never show up as changed fields', () => {
  const fn = sql.match(/create or replace function public\.record_change\(\)[\s\S]*?\$\$;/)[0];
  const lists = [...fn.matchAll(/not in \(([^)]*)\)/g)].map(m => m[1]);
  assert.ok(lists.length >= 2 && lists.every(l => /'last_changed_by'/.test(l) && /'last_changed_at'/.test(l)), lists.join(' | '));
});
test('the trigger takes the author from the sign-in, not from the row', () => {
  const fn = sql.match(/create or replace function public\.record_change\(\)[\s\S]*?\$\$;/)[0];
  assert.ok(/security definer/.test(fn), 'it can write the table clients cannot');
  assert.ok(/auth\.uid\(\)/.test(fn), 'the author is the sign-in');
});
test('a next step or note gets its author from the sign-in on insert and keeps it after', () => {
  assert.ok(/create trigger aee_stage_items_stamp_author\s+before insert or update on public\.aee_stage_items/.test(sql));
  const fn = sql.match(/create or replace function public\.stamp_author\(\)[\s\S]*?\$\$;/)[0];
  assert.ok(/new\.author\s*:=\s*public\.author_display_name\(\)/.test(fn), 'stamped from the sign-in');
  assert.ok(/new\.author\s*:=\s*old\.author/.test(fn), 'an edit cannot change it');
});

console.log('\nAccess');
test('row level security is on for the change table', () =>
  assert.ok(/alter table public\.aee_changes\s+enable row level security/.test(sql)));
test('admins can read the change table', () =>
  assert.ok(/create policy aee_changes_read on public\.aee_changes\s+for select to authenticated using \(public\.is_crm_admin\(\)\)/.test(sql)));
test('no policy lets anyone insert, update or delete a change', () => {
  const policies = [...sql.matchAll(/create policy \w+ on public\.aee_changes\s+for (\w+)/g)].map(m => m[1]);
  assert.deepStrictEqual(policies, ['select']);
});
test('and the API roles hold no write grant on it', () =>
  assert.ok(/revoke insert, update, delete, truncate on public\.aee_changes from public, anon, authenticated/.test(sql)));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
