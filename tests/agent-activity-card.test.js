/* Tests for the "Agents in this repo" card at the top of the Activity page
 * (js/views-agenthq.js).
 *
 *   node tests/agent-activity-card.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ago = m => new Date(Date.now() - m * 60000).toISOString();

function env(runs, finds, news) {
  const ctx = {
    console, esc, num: v => Number(v) || 0, fmtNum: v => String(v), icon: () => '',
    clearTimeout, setTimeout: () => 0, loadFinderCache() {}, refreshFinderFromServer() {},
    getOfftaker: id => ({ a: { id: 'a', name: 'Kalagadi Manganese' }, b: { id: 'b', name: 'Old Co', archived: true } }[id] || {}),
    SA_MUNICIPALITIES: [], state: { view: 'activity', contactRuns: runs, foundContacts: finds },
  };
  if (news) ctx.NEWS_AUTO = news;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'views-agenthq.js'), 'utf8'), ctx);
  return ctx;
}
const card = ctx => vm.runInContext('ahqActivityCardHtml()', ctx);

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

test('with nothing running it says so and still lists every agent', () => {
  const h = card(env([], []));
  assert.ok(h.includes('Agents in this repo') && h.includes('none running') && h.includes('0 queued'));
  ['Listed off-taker contact finder', 'Priority contact finder', 'Offtaker contact finder', 'Municipality contact finder'].forEach(a => assert.ok(h.includes(a), a));
  assert.ok(h.includes('Never run'), 'an agent that has never run says so');
});

test('a running run shows as running with its target and finds so far', () => {
  const runs = [{ id: 'r1', status: 'running', created: ago(10), claimedAt: ago(8), offtakerIds: ['a'], roles: [], note: 'Gap run: 1 listed company', found: 0 }];
  const finds = [{ id: 'f1', runId: 'r1', status: 'pending', email: 'x@y.za' }, { id: 'f2', runId: 'r1', status: 'pending', email: 'z@y.za' }];
  const h = card(env(runs, finds));
  assert.ok(h.includes('<b>1 running</b>'));
  assert.ok(h.includes('Kalagadi Manganese') && h.includes('2 found'));
  assert.ok(h.includes('<b>2 found people to review</b>'));
  assert.ok(h.includes('Listed off-taker contact finder'));
});

test('a gap run is attributed to the listed-offtaker agent; other runs to theirs', () => {
  const ctx = env([], []);
  const of = run => vm.runInContext('ahqAgentOf(' + JSON.stringify(run) + ')', ctx);
  assert.strictEqual(of({ note: 'Gap run: 15 listed companies', offtakerIds: ['a'] }), 'listed');
  assert.strictEqual(of({ note: 'Apollo daily: 8 listed companies, 12 emails revealed.', offtakerIds: ['a'] }), 'apollo');
  assert.strictEqual(of({ note: '', offtakerIds: ['mun_X'] }), 'municipal');
  assert.strictEqual(of({ note: '', offtakerIds: ['a'] }), 'priority');
});

test('a queued run shows as queued; a run claimed hours ago is flagged as possibly stalled', () => {
  const queued = card(env([{ id: 'r2', status: 'queued', created: ago(5), offtakerIds: ['a'], roles: [], note: '' }], []));
  assert.ok(queued.includes('1 queued') && queued.includes('Queued'));
  const stalled = card(env([{ id: 'r3', status: 'running', created: ago(900), claimedAt: ago(800), offtakerIds: ['a'], roles: [] }], []));
  assert.ok(stalled.includes('1 possibly stalled') && stalled.includes('Stalled?'));
});

test('the News scan is listed with its newest story, and omitted when there are no stories', () => {
  const withNews = card(env([], [], [{ date: '2026-10-01' }, { date: '2026-10-02' }]));
  assert.ok(withNews.includes('Daily AEEG News Scan') && withNews.includes('2 stories collected') && withNews.includes('newest 2026-10-02'));
  assert.ok(!card(env([], [])).includes('Daily AEEG News Scan'));
});

test('the card links to Agent HQ', () => {
  assert.ok(card(env([], [])).includes("nav('agenthq')"));
});

console.log('\n' + n + ' passed');
