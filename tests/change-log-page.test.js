/* The Change log page (js/views-changelog.js): who did what, for admins.
 *
 * Runs the real page against sample change rows (the shape of aee_changes) and a small
 * book, no browser and no database, and checks what an admin reads: a row per person
 * (and per agent) for the period, the list of changes newest first, the filters, the
 * one-line descriptions, "not recorded" for changes nobody was signed in for, and that
 * a viewer gets nothing.
 *
 *   node tests/change-log-page.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Midday times, so the local day is the same day in any time zone the suite runs in. */
const at = (day, hh) => day + 'T' + String(hh || 12).padStart(2, '0') + ':00:00+00:00';
let seq = 0;
const ch = (o) => Object.assign({ id: ++seq, at: at('2026-10-14'), author_id: 'u-thabo', author_email: 'thabo@aeeg.co.za', agent: null,
  table_name: 'aee_stage_items', record_id: 'r' + seq, offtaker_id: 'f', kind: 'created', fields: null, deleted_row: null }, o);

const ROWS = [
  ch({ at: at('2026-10-15', 11), fields: { kind: { old: null, new: 'step' }, body: { old: null, new: 'Send the tariff' } } }),
  ch({ at: at('2026-10-15', 10), fields: { kind: { old: null, new: 'account-note' }, body: { old: null, new: 'Target 30% by 2030' } } }),
  ch({ at: at('2026-10-14'), table_name: 'aee_interactions', fields: { type: { old: null, new: 'email' }, summary: { old: null, new: 'First email' } } }),
  ch({ at: at('2026-10-14'), kind: 'edited', fields: { body: { old: 'Send tariff', new: 'Send the tariff' } } }),
  ch({ at: at('2026-10-13'), author_id: 'u-lebo', author_email: 'lebo@aeeg.co.za', kind: 'signed-in', table_name: 'profiles', record_id: 'u-lebo', offtaker_id: null }),
  ch({ at: at('2026-10-13'), author_id: 'u-lebo', author_email: 'lebo@aeeg.co.za', kind: 'deleted', offtaker_id: 'g',
    deleted_row: { id: 'r-old', kind: 'note', body: 'Old note', offtaker_id: 'g' } }),
  ch({ at: at('2026-10-12'), agent: 'apollo-daily', table_name: 'aee_found_contacts', offtaker_id: 'g', fields: { first: { old: null, new: 'Jan' } } }),
  ch({ at: at('2026-10-12'), author_id: null, author_email: null, table_name: 'aee_contacts', offtaker_id: 'g', fields: { first: { old: null, new: 'Pat' } } }),
  ch({ at: at('2026-09-20'), fields: { kind: { old: null, new: 'step' }, body: { old: null, new: 'An old step' } } }),
];

/* A fixed clock: 13:00 UTC on 15 Oct, which is 15 Oct on the local clock of any zone from UTC-12 to UTC+10. */
const NOW = Date.parse('2026-10-15T13:00:00Z');
class FixedDate extends Date {
  constructor(...a) { super(...(a.length ? a : [NOW])); }
  static now() { return NOW; }
}
/* A period's rows as the page keeps them once fetched, fetched just now. */
const loaded = (rows, since, until, ageMs) => ({ key: since + '|' + until, since, until, rows: rows.slice(), loadedAt: NOW - (ageMs || 0) });

function run(over, after) {
  const out = { page: null, content: '', fetched: [], navs: [] };
  const state = Object.assign({
    view: 'changelog', role: 'admin', province: '',
    offtakers: [{ id: 'f', name: 'Ferro Smelter Ltd', short: 'Ferro', sfStage: 'online-meeting' }, { id: 'g', name: 'Gold Co', short: 'Gold Co', sfStage: '' }],
    archived: [], changeLog: loaded(ROWS, '2026-10-09', '2026-10-15'),
  }, over);
  const ctx = vm.createContext({
    console, state, esc, jsStr: v => esc(JSON.stringify(String(v == null ? '' : v))), icon: () => '',
    toDisplayName: e => String(e).replace(/@aeeg\.co\.za$/, ''),
    /* UTC's date, a day behind on purpose: the page must count days on the local clock, not this. */
    todayISO: () => '2026-10-14',
    inPipeline: o => !!o.sfStage, accountView: () => 'detail', nav: (v, x) => out.navs.push([v, x && x.id]),
    supaFetchAll: async q => { out.fetched.push(q); return []; }, render() {},
    setPage: (t, s, a) => { out.page = { t, s, a }; }, setContent: h => { out.content = h; },
    Date: FixedDate, setTimeout: () => 0,
  });
  vm.runInContext(read('js/layout.js') + '\n' + read('js/followups.js') + '\n' + read('js/views-changelog.js') + '\nrenderChangeLog();', ctx);
  if (after) after(ctx);
  return out;
}
const rowsOf = h => [...h.matchAll(/<tr class="cl-row"[\s\S]*?<\/tr>/g)].map(m => m[0]);
const summaryOf = h => [...h.matchAll(/<tr class="cl-sum[^"]*"[\s\S]*?<\/tr>/g)].map(m => m[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

console.log('\nWho');
test('a viewer gets no Change log and nothing is fetched', () => {
  const o = run({ role: 'viewer', changeLog: null });
  assert.ok(!/cl-row|cl-sum/.test(o.content));
  assert.ok(/admins/i.test(o.content), 'says it is for admins');
  assert.strictEqual(o.fetched.length, 0);
});
test('the period defaults to the last 7 days, today included', () => {
  const o = run({});
  assert.ok(/Last 7 days/.test(o.content));
  assert.strictEqual(rowsOf(o.content).length, 8, 'the 20 Sep step is outside the period');
});
test('one summary row per person, busiest first, counting each kind of change', () => {
  const s = summaryOf(run({}).content);
  assert.ok(/^thabo 0 1 1 1 1 4$/.test(s[0]), s[0]);   // sign-ins, touches, next steps, notes, other edits, total
  assert.ok(/^lebo 1 0 0 0 1 2$/.test(s[1]), s[1]);
});
test('changes nobody was signed in for count under "not recorded", never under a person', () => {
  const s = summaryOf(run({}).content);
  assert.ok(s.some(r => /^not recorded 0 0 0 0 1 1$/.test(r)), s.join(' | '));
});
test('an agent has its own row, run as the person, and is not in their counts', () => {
  const h = run({}).content;
  const s = summaryOf(h);
  assert.ok(s.some(r => /^apollo-daily \(run as thabo\) 0 0 0 0 1 1$/.test(r)), s.join(' | '));
  assert.ok(/class="cl-sum cl-agent"/.test(h), 'marked as an agent row');
  assert.ok(h.indexOf('apollo-daily (run as thabo)') > h.indexOf('>lebo<'), 'agents come after people');
});
test('changing the period recounts and fetches that period', () => {
  const o = run({}, ctx => vm.runInContext('setChangeLogPeriod("today")', ctx));
  assert.deepStrictEqual(o.fetched.length, 1);
  assert.ok(/at=gte\.2026-10-1[45]/.test(o.fetched[0]) && /order=at\.desc/.test(o.fetched[0]), o.fetched[0]);
  const today = run({ changeLogPeriod: 'today', changeLog: loaded(ROWS, '2026-10-15', '2026-10-15') }).content;
  assert.strictEqual(rowsOf(today).length, 2);
  assert.ok(/^thabo 0 0 1 1 0 2$/.test(summaryOf(today)[0]), summaryOf(today)[0]);
});

console.log('\nWhat');
test('the list is newest first, with who, when, what and the company', () => {
  const r = rowsOf(run({}).content);
  assert.ok(/Send the tariff/.test(r[0]) && /15 Oct 2026/.test(r[0]) && /thabo/.test(r[0]) && /Ferro/.test(r[0]), r[0]);
  assert.ok(/signed in/.test(r[4]) && /lebo/.test(r[4]));
});
test('each change reads as a plain sentence', () => {
  const h = run({}).content;
  ['added a next step', 'added an account note', 'logged a touch', 'edited a next step or note', 'signed in', 'deleted a stage note', 'added a find', 'added a contact']
    .forEach(t => assert.ok(h.includes(t), t));
  assert.ok(/body/.test(rowsOf(h)[3]), 'an edit names the fields it changed');
  assert.ok(/Old note/.test(h), 'a deletion shows what was deleted');
});
test('an edited item still on file is named for what it is', () => {
  const h = run({ stageItems: [{ id: 'r4', kind: 'step' }] }).content;
  assert.ok(h.includes('edited a next step') && !h.includes('edited a next step or note'));
});
test('a row with a company opens that company; a sign-in has none', () => {
  const r = rowsOf(run({}).content);
  assert.ok(/nav\(&quot;opportunity&quot;,\{id:&quot;f&quot;\}\)|nav\('opportunity'/.test(r[0]) || /openChangeRecord\(&quot;f&quot;\)/.test(r[0]), r[0]);
  assert.ok(!/openChangeRecord/.test(r[4]), 'a sign-in links nowhere');
});

console.log('\nFilters');
test('filter by person narrows the list and the summary together', () => {
  const h = run({ changeLogFilter: { person: 'person:lebo@aeeg.co.za' } }).content;
  assert.strictEqual(rowsOf(h).length, 2);
  assert.deepStrictEqual(summaryOf(h).length, 1);
});
test('filter by company', () => {
  const h = run({ changeLogFilter: { company: 'g' } }).content;
  assert.strictEqual(rowsOf(h).length, 3);
  assert.ok(rowsOf(h).every(r => /Gold Co/.test(r)));
});
test('filter by kind of change', () => {
  assert.strictEqual(rowsOf(run({ changeLogFilter: { kind: 'deleted' } }).content).length, 1);
  assert.strictEqual(rowsOf(run({ changeLogFilter: { kind: 'signed-in' } }).content).length, 1);
});
test('the filters offer the people, agents and companies in the period', () => {
  const h = run({}).content;
  ['thabo', 'lebo', 'apollo-daily (run as thabo)', 'not recorded', 'Ferro', 'Gold Co'].forEach(t => assert.ok(h.includes('>' + t + '</option>'), t));
});
test('an empty period says so', () => {
  const h = run({ changeLog: loaded([], '2026-10-09', '2026-10-15') }).content;
  assert.ok(/Nothing was changed/.test(h));
  assert.ok(!/cl-row/.test(h));
});
test('while the period loads, the page says so and fetches once', () => {
  const o = run({ changeLog: null });
  assert.ok(/Loading/.test(o.content));
  assert.strictEqual(o.fetched.length, 1);
});

console.log('\nFreshness, paging and edge cases');
test('"today" is the local day, not the UTC date todayISO gives', () => {
  const o = run({ changeLogPeriod: 'today', changeLog: null });
  assert.ok(/at=gte\.2026-10-1[45]T/.test(o.fetched[0]) && !/at=gte\.2026-10-13T/.test(o.fetched[0]), o.fetched[0]);
  const h = run({ changeLogPeriod: 'today', changeLog: loaded(ROWS, '2026-10-15', '2026-10-15') }).content;
  assert.ok(/Send the tariff/.test(h), 'a change made today shows under Today');
});
test('a period loaded just now is not fetched again; one loaded a minute ago is', () => {
  assert.strictEqual(run({}).fetched.length, 0);
  const stale = run({ changeLog: loaded(ROWS, '2026-10-09', '2026-10-15', 60000) });
  assert.strictEqual(stale.fetched.length, 1);
  assert.strictEqual(rowsOf(stale.content).length, 8, 'the rows already on screen stay while it refreshes');
});
test('a past date range is fetched with an end, not up to today', () => {
  const o = run({ changeLogPeriod: 'range', changeLogRange: { from: '2026-03-01', to: '2026-03-07' }, changeLog: null });
  assert.ok(/at=gte\.2026-0[23]-/.test(o.fetched[0]) && /at=lt\.2026-03-0[78]T/.test(o.fetched[0]), o.fetched[0]);
});
test('a filter whose person or company is not in the period still shows as chosen', () => {
  const h = run({ changeLogFilter: { person: 'person:nobody@aeeg.co.za', company: 'zz' } }).content;
  assert.ok(/<option value="person:nobody@aeeg.co.za" selected>nobody<\/option>/.test(h), 'the person stays visible in the select');
  assert.ok(/<option value="zz" selected>zz<\/option>/.test(h), 'and so does the company');
  assert.ok(/Nothing was changed/.test(h) && /Loosen the filters/.test(h));
});
test('a long period pages through its changes, 100 at a time', () => {
  const many = Array.from({ length: 250 }, (_, i) => ch({ at: at('2026-10-14', 12), kind: 'edited', fields: { body: { old: 'a', new: 'b' + i } } }));
  const first = run({ changeLog: loaded(many, '2026-10-09', '2026-10-15') }).content;
  assert.strictEqual(rowsOf(first).length, 100);
  assert.ok(/Showing 1–100 of 250/.test(first) && /setChangeLogPage\(2\)/.test(first), 'footer and next page');
  const second = run({ changeLog: loaded(many, '2026-10-09', '2026-10-15'), changeLogPage: 3 }).content;
  assert.strictEqual(rowsOf(second).length, 50);
  assert.ok(/Showing 201–250 of 250/.test(second));
});
test('a ticked checklist item reads without its position number', () => {
  const tick = ch({ at: at('2026-10-15', 12), fields: { kind: { old: null, new: 'check' }, body: { old: null, new: '2' } } });
  const h = run({ changeLog: loaded([tick], '2026-10-09', '2026-10-15') }).content;
  assert.ok(h.includes('ticked a checklist item') && !h.includes('“2”'));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
