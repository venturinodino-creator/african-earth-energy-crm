/* Agent HQ, Activity, News and Analytics in the shared frame.
 *
 * Agent HQ: the KPI row, then its cards in one grid with Recent runs across the
 * full width. Activity: Timeline / Table are tabs, the log is a card (a table
 * card with a footer in table view), beside the target close dates. News: the
 * topic chips become view tabs with counts. Analytics: the four charts and
 * tables are one card grid with Funnel health across the full width. Runs the
 * real views against a small stub book, no browser.
 *
 *   node tests/misc-pages-layout.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const scopeStubs = require('./scope-stubs');
const outreachVocab = require('./outreach-vocab');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = v => Number(v) || 0;
const ago = m => new Date(Date.now() - m * 60000).toISOString();

function env(over) {
  const out = { page: null, content: '' };
  const state = Object.assign({
    role: 'admin', view: 'agenthq', activityView: 'timeline', newsTopic: 'all', newsProvince: '', newsSearch: '',
    offtakers: [{ id: 'a', name: 'Alpha', short: 'Alpha', sector: 'mining', province: 'Gauteng', annualGwh: 500, tariff: 1.2, status: 'prospect', sfStage: '' }],
    deals: [{ id: 'd1', offtakerId: 'a', projectId: 'p1', stage: 'proposal', mw: 30, probability: 50, closeDate: '2026-12-01' }],
    interactions: [{ id: 'i1', offtakerId: 'a', type: 'call', date: '2026-10-01', summary: 'Spoke to the CFO' }, { id: 'i2', offtakerId: 'a', type: 'email', date: '2026-09-20', summary: 'Sent the deck' }],
    contacts: [], projects: [], archived: [],
    contactRuns: [{ id: 'r1', status: 'running', created: ago(10), claimedAt: ago(8), offtakerIds: ['a'], roles: ['decision'], found: 2, note: 'Gap run: 1 company' },
      { id: 'r2', status: 'done', created: ago(5000), finishedAt: ago(4900), offtakerIds: ['a'], roles: ['decision'], found: 3 }],
    foundContacts: [{ id: 'f1', runId: 'r1', status: 'pending', email: 'x@a.co.za' }],
  }, over);
  const ctx = vm.createContext({
    ...scopeStubs(state), ...outreachVocab(),
    console, window: {}, setTimeout: () => 0, clearTimeout() {}, document: { querySelectorAll: () => [], getElementById: () => null },
    STORE_PREFIX: 'aee_crm_', JSON, toast() {}, localStorage: { getItem: () => null, setItem() {} },
    esc, num, fmtNum: v => String(Math.round(num(v))), fmtR: v => 'R' + Math.round(num(v)), icon: () => '', jsStr: v => esc(JSON.stringify(String(v == null ? '' : v))),
    safeHref: u => /^https?:/.test(u || '') ? u : '', todayISO: () => '2026-10-10', relTime: () => 'today', avatarColor: () => '#555', sectorName: s => s,
    getOfftaker: id => state.offtakers.find(o => o.id === id) || {}, fitScore: () => 70, weightedValue: d => num(d.mw) * 1000, STATUS_LABEL: { prospect: 'Prospect' },
    SECTOR_LABEL_MAP: { mining: 'Mining' }, PIPELINE_STAGES: [{ id: 'proposal', label: 'Proposal' }], statTile: (i, c, label, value) => '<div class="stat-card">' + label + ' ' + value + '</div>',
    viewToggle: k => '<div class="view-toggle" data-key="' + k + '"></div>', growBars() {}, loadFinderCache() {}, refreshFinderFromServer() {}, analyticsPageGuideHtml: () => '<div class="guide">GUIDE</div>',
    pmProjectFor: () => null, interactionsFor: () => [], exportNews() {}, openLogInteraction() {}, deleteInteraction() {},
    accountOptions: () => '<option value="a">Alpha</option>', accountView: () => 'detail',
    setPage: (t, s, a) => { out.page = { t, s, a }; }, setContent: h => { out.content = h; }, state,
    SA_PROVINCES: ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'],
    NEWS_AUTO: [{ id: 'n1', topic: 'renewable_energy', province: 'Multiple', date: '2026-10-09', title: 'Eskom launches', summary: '', url: 'https://x.co.za', auto: true }],
  });
  const files = ['js/layout.js', 'data/news.js', 'js/views-agenthq.js', 'js/views-news.js', 'js/views-tools.js', 'js/followups.js', 'js/outreach.js', 'js/views-activity.js'];
  files.forEach(f => { try { vm.runInContext(read(f) + '\n', ctx, { filename: f }); } catch (e) { throw new Error(f + ': ' + e.message); } });
  return { ctx, out, state, run: fn => { vm.runInContext(fn + '();', ctx); return out; } };
}
const tabLabels = html => [...html.matchAll(/class="view-tab( active)?"[^>]*>([^<]*)/g)].map(m => (m[1] ? '*' : '') + m[2].trim());

console.log('\nAgent HQ');
test('the KPI row comes first, then the cards in one grid with Recent runs across the full width', () => {
  const o = env().run('renderAgentHQ');
  assert.strictEqual((o.content.match(/class="stat-card"/g) || []).length, 4);
  assert.ok(o.content.indexOf('stats-grid') < o.content.indexOf('card-grid'));
  ['Agents', 'Working now', 'Recent runs'].forEach(t => assert.ok(o.content.includes(t), 'missing ' + t));
  assert.ok(/class="card span-all"[\s\S]*?Recent runs/.test(o.content), 'Recent runs spans the grid');
  assert.ok(!o.content.includes('margin-top:14px'), 'no ad-hoc spacing left');
});
test('Refresh stays in the page header and the footnote stays', () => {
  const o = env().run('renderAgentHQ');
  assert.ok(o.page.a.includes('Refresh'));
  assert.ok(o.content.includes('Updates every'));
});

console.log('\nActivity');
/* Today is 2026-10-10 in this sandbox. Five accounts, each with one thing due on a different day. */
const dueBook = {
  offtakers: ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({ id, name: 'Co ' + id.toUpperCase() + ' Ltd', short: 'Co ' + id.toUpperCase(), sector: 'mining', province: 'Gauteng', annualGwh: 100, tariff: 1.2, status: 'prospect', sfStage: '',
    revisitDate: id === 'e' ? '2026-10-12' : '' })),
  deals: [
    { id: 'd1', offtakerId: 'a', name: 'Co A PPA', stage: 'proposal', mw: 30, closeDate: '2026-10-08' },
    { id: 'd2', offtakerId: 'b', name: 'Co B PPA', stage: 'proposal', mw: 10, closeDate: '2026-10-10' },
    { id: 'd3', offtakerId: 'c', name: 'Co C PPA', stage: 'proposal', mw: 5, closeDate: '2027-01-15' },
  ],
};
const act = over => env(Object.assign({ view: 'activity' }, dueBook, over)).run('renderActivity');
test('Follow-ups, All activity and Calendar are tabs, Follow-ups first; the header keeps only Log activity', () => {
  const o = act({});
  assert.deepStrictEqual(tabLabels(o.content), ['*Follow-ups', 'All activity', 'Calendar']);
  assert.ok(o.page.a.includes('Log activity') && !o.page.a.includes('view-toggle'));
});
test('the tab counts are the follow-ups due and the interactions logged', () => {
  const o = act({});
  assert.ok(/Follow-ups <span class="vt-n">4<\/span>/.test(o.content), o.content.match(/Follow-ups[^<]*<span[^>]*>\d+/));
  assert.ok(/All activity <span class="vt-n">2<\/span>/.test(o.content));
});
test('follow-ups are grouped overdue, today, next 7 days and later, each row naming its account', () => {
  const o = act({});
  const heads = [...o.content.matchAll(/class="fu-head fu-(\w+)">([^<]*)</g)].map(m => m[2].trim());
  assert.deepStrictEqual(heads, ['Overdue', 'Today', 'Next 7 days', 'Later']);
  ['Co A', 'Co B', 'Co C', 'Co E'].forEach(n => assert.ok(o.content.includes(n), n));
  assert.ok(/class="fu-kind">Close</.test(o.content) && /class="fu-kind">Parked</.test(o.content));
  assert.ok(/onclick="nav\('detail',\{id:&quot;a&quot;\}\)"|onclick="nav\('detail',\{id:"a"\}\)"/.test(o.content) || o.content.includes("nav('detail'"), 'rows open the account');
});
test('a group with nothing in it is not drawn', () => {
  const o = act({ deals: [dueBook.deals[0]], offtakers: dueBook.offtakers.map(x => Object.assign({}, x, { revisitDate: '' })) });
  assert.deepStrictEqual([...o.content.matchAll(/class="fu-head fu-(\w+)">/g)].map(m => m[1]), ['overdue']);
});
test('the month calendar and the Log activity form sit beside the list', () => {
  const o = act({});
  const side = o.content.slice(o.content.indexOf('class="act-side"'));
  assert.ok(side.includes('class="cal"') && side.includes('id="act-offtaker"') && side.includes('saveInlineInteraction()'));
  assert.ok(o.content.indexOf('class="act-main"') < o.content.indexOf('class="act-side"'));
});
test('the form is admin-only, and has the drawer\'s fields', () => {
  const side = act({}).content.slice(act({}).content.indexOf('class="act-side"'));
  assert.ok(/data-admin-only[^>]*><div class="card-header"><div class="card-title">Log activity/.test(side));
  ['act-date', 'act-channel', 'act-outcome', 'act-people', 'act-followup', 'act-summary'].forEach(id => assert.ok(side.includes('id="' + id + '"'), id));
  ['Email', 'LinkedIn message', 'Call', 'Online meeting', 'In-person meeting', 'Site visit', 'Proposal sent', 'Note'].forEach(t => assert.ok(side.includes('>' + t + '<'), t));
  ['Replied', 'Meeting booked', 'Meeting held'].forEach(t => assert.ok(side.includes('>' + t + '<'), t));
});
test('All activity keeps the timeline, with the log card, and a Timeline / Table switch', () => {
  const o = act({ activityTab: 'all' });
  assert.ok(/view-tab active"[^>]*>All activity/.test(o.content));
  assert.ok(o.content.includes('Interaction log') && o.content.includes('Spoke to the CFO'));
  assert.ok(o.content.includes('view-toggle') && o.content.includes('data-key="activityView"'));
});
test('All activity as a table is a table card with a footer, as before', () => {
  const o = act({ activityTab: 'all', activityView: 'table' });
  assert.ok(o.content.includes('<div class="table-card">') && o.content.includes('Showing 1–2 of 2 interactions'), o.content.match(/Showing[^<]*/));
});
test('the Calendar tab draws the month, the days with something on are marked, and the side has only the form', () => {
  const o = act({ activityTab: 'calendar', actMonth: '2026-10' });
  assert.ok(o.content.includes('October 2026') && o.content.includes('cal-big'));
  assert.ok(/class="cal-day has"[^>]*onclick="pickActDay\('2026-10-08'\)"/.test(o.content), 'the 8th has a follow-up');
  assert.ok(/class="cal-day has"[^>]*onclick="pickActDay\('2026-10-01'\)"/.test(o.content), 'the 1st has a logged call');
  assert.ok(!/class="cal-day today[^"]*"[^>]*pickActDay\('2026-10-11'\)/.test(o.content));
  const side = o.content.slice(o.content.indexOf('class="act-side"'));
  assert.ok(!side.includes('class="cal"') && side.includes('act-offtaker'));
});
test('today is marked on the calendar', () => {
  assert.ok(/class="cal-day today[^"]*"[^>]*onclick="pickActDay\('2026-10-10'\)"/.test(act({ actMonth: '2026-10' }).content));
});
test('a chosen day narrows the page to it, says so, and offers the way back', () => {
  const o = act({ activityTab: 'all', actDay: '2026-10-01' });
  assert.ok(o.content.includes('Show all') && o.content.includes('1 Oct 2026'));
  assert.ok(o.content.includes('Spoke to the CFO') && !o.content.includes('Sent the deck'));
  const f = act({ actDay: '2026-10-08' });
  assert.ok(f.content.includes('Co A') && !f.content.includes('Co C'));
});
test('a day with nothing on says so, on every tab', () => {
  assert.ok(/Nothing is due on 5 Oct 2026/.test(act({ actDay: '2026-10-05' }).content));
  assert.ok(/Nothing logged on 5 Oct 2026/.test(act({ activityTab: 'all', actDay: '2026-10-05' }).content));
  assert.ok(/Nothing is on 5 Oct 2026/.test(act({ activityTab: 'calendar', actDay: '2026-10-05' }).content));
});
test('with nothing due and nothing logged the tabs and the empty states still show', () => {
  const o = act({ interactions: [], deals: [], offtakers: dueBook.offtakers.map(x => Object.assign({}, x, { revisitDate: '' })) });
  assert.ok(o.content.includes('view-tabs') && o.content.includes('Nothing is due'));
  assert.ok(act({ activityTab: 'all', interactions: [] }).content.includes('Nothing logged yet'));
});
test('the Agents card stays, below the list', () => {
  const o = act({});
  assert.ok(o.content.indexOf('class="act-layout"') < o.content.indexOf('Agents in this repo'));
});
test('a bad tab or month falls back, so the page always draws', () => {
  assert.ok(/view-tab active"[^>]*>Follow-ups/.test(act({ activityTab: 'nonsense' }).content));
  assert.ok(act({ activityTab: 'calendar', actMonth: 'garbage' }).content.includes('October 2026'));
});
test('no undefined or NaN anywhere on any tab', () => {
  ['followups', 'all', 'calendar'].forEach(t => assert.ok(!/undefined|NaN|\[object/.test(act({ activityTab: t }).content), t));
});

console.log('\nNews');
test('the topic chips are view tabs with counts: All Topics, Summary, then each topic', () => {
  const o = env({ view: 'news' }).run('renderNews');
  const labels = tabLabels(o.content);
  assert.strictEqual(labels[0], '*All Topics');
  assert.strictEqual(labels[1], 'Summary');
  assert.ok(labels.length > 3, labels.join(','));
  assert.ok(!o.content.includes('news-filter-btn') && !o.content.includes('news-summary-btn'), 'the old chips are gone');
  assert.ok(o.content.indexOf('view-tabs') < o.content.indexOf('class="toolbar"'));
});
test('choosing a topic marks its tab, and Summary still renders', () => {
  const t = env({ view: 'news', newsTopic: 'renewable_energy' }).run('renderNews');
  assert.ok(/view-tab active"[^>]*onclick="setNewsTopic\(&quot;renewable_energy|view-tab active"[^>]*onclick="setNewsTopic\('renewable_energy/.test(t.content), 'the topic tab is active');
  const s = env({ view: 'news', newsTopic: 'summary' }).run('renderNews');
  assert.ok(/view-tab active"[^>]*>Summary/.test(s.content) && !/undefined|NaN/.test(s.content));
});

/* Two real stories (the curated feed in data/news.js, loaded for this sandbox) plus the auto one above. */
const newsAll = e => JSON.parse(vm.runInContext('JSON.stringify(allNews().map(a => a.id))', e.ctx));
const newsEnv = over => env(Object.assign({ view: 'news' }, over));
test('the Saved and Dismissed tabs follow the topics, each with a count', () => {
  const o = newsEnv({}).run('renderNews');
  const labels = tabLabels(o.content);
  assert.deepStrictEqual(labels.slice(-2), ['Saved', 'Dismissed']);
  assert.ok(/Saved <span class="vt-n">0<\/span>/.test(o.content) && /Dismissed <span class="vt-n">0<\/span>/.test(o.content));
});
test('a Filters card sits beside the stories: a box per source, the matched switch, and where Save is kept', () => {
  const o = newsEnv({}).run('renderNews');
  const side = o.content.slice(o.content.indexOf('class="news-sidebar"'));
  assert.ok(side.indexOf('<h4>Filters</h4>') > -1 && side.indexOf('<h4>Filters</h4>') < side.indexOf('<h4>Topics</h4>'), 'Filters comes first in the sidebar');
  assert.ok(/class="news-check"><input type="checkbox" checked onchange="toggleNewsSource\(/.test(side), 'a source box, ticked');
  assert.ok(/onchange="toggleNewsMatched\(\)"/.test(side) && side.includes('Only stories that name an off-taker'));
  assert.ok(/kept in this browser/i.test(side));
});
test('unticking a source removes its stories and unticks its box', () => {
  const e = newsEnv({});
  const before = e.run('renderNews').content.match(/class="news-card[" ]/g).length;
  const src = JSON.parse(vm.runInContext('JSON.stringify(newsSourcesOf(allNews())[0].source)', e.ctx));
  const o = newsEnv({ newsSourcesOff: [src] }).run('renderNews');
  assert.ok((o.content.match(/class="news-card[" ]/g) || []).length < before);
  assert.ok(/class="news-check"><input type="checkbox" onchange="toggleNewsSource\(/.test(o.content), 'an unticked box');
});
test('each story has Save and Dismiss; a saved one says Saved and appears under the Saved tab', () => {
  const e = newsEnv({});
  const id = newsAll(e)[0];
  const o = newsEnv({ newsMarks: { saved: [id], dismissed: [] } }).run('renderNews');
  assert.ok(/Dismiss<\/button>/.test(o.content) && /onclick="saveNews\(/.test(o.content));
  assert.ok(/btn-xs btn-outline on"[^>]*>Saved</.test(o.content), 'the saved one reads Saved');
  assert.ok(/Saved <span class="vt-n">1<\/span>/.test(o.content));
  const tab = newsEnv({ newsTopic: 'saved', newsMarks: { saved: [id], dismissed: [] } }).run('renderNews');
  assert.strictEqual((tab.content.match(/class="news-card[" ]/g) || []).length, 1);
});
test('a dismissed story leaves the feed and the counts, and shows under Dismissed with Restore', () => {
  const e = newsEnv({});
  const id = newsAll(e)[0];
  const all = newsEnv({}).run('renderNews').content.match(/class="news-card[" ]/g).length;
  const o = newsEnv({ newsMarks: { saved: [], dismissed: [id] } }).run('renderNews');
  assert.strictEqual((o.content.match(/class="news-card[" ]/g) || []).length, all - 1);
  assert.ok(/Dismissed <span class="vt-n">1<\/span>/.test(o.content));
  const tab = newsEnv({ newsTopic: 'dismissed', newsMarks: { saved: [], dismissed: [id] } }).run('renderNews');
  assert.strictEqual((tab.content.match(/class="news-card[" ]/g) || []).length, 1);
  assert.ok(/onclick="restoreNews\(/.test(tab.content) && !/onclick="dismissNews\(/.test(tab.content));
});
test('the empty Saved and Dismissed tabs say what they are for', () => {
  assert.ok(/Nothing saved yet/.test(newsEnv({ newsTopic: 'saved' }).run('renderNews').content));
  assert.ok(/Nothing dismissed/.test(newsEnv({ newsTopic: 'dismissed' }).run('renderNews').content));
});
test('a story that names an off-taker on file says so, with a link to it', () => {
  const o = newsEnv({ offtakers: [{ id: 'a', name: 'Eskom Holdings', short: 'Eskom', sector: 'mining', province: 'Gauteng' }] }).run('renderNews');
  assert.ok(/class="news-matched">Names: <span class="news-chip" onclick="nav\('detail',\{id:&quot;a&quot;\}\)">Eskom</.test(o.content), o.content.match(/news-matched[^<]*<[^>]*>[^<]*/));
});
test('only stories that name an off-taker keeps just those', () => {
  const book = [{ id: 'a', name: 'Eskom Holdings', short: 'Eskom', sector: 'mining', province: 'Gauteng' }];
  const all = newsEnv({ offtakers: book }).run('renderNews').content.match(/class="news-card[" ]/g).length;
  const only = newsEnv({ offtakers: book, newsMatchedOnly: true }).run('renderNews').content.match(/class="news-card[" ]/g);
  assert.ok(only && only.length < all && only.length >= 1, 'only ' + (only && only.length) + ' of ' + all);
  assert.ok(/class="news-check news-matched"><input type="checkbox" checked/.test(newsEnv({ offtakers: book, newsMatchedOnly: true }).run('renderNews').content));
});

console.log('\nAnalytics');
test('the four charts and tables are one card grid; Funnel health spans it', () => {
  const o = env({ view: 'analytics' }).run('renderAnalytics');
  assert.ok(o.content.includes('<div class="card-grid">') && !o.content.includes('grid-2'));
  ['Load by province', 'Load by sector', 'Fit score distribution', 'Where the value is'].forEach(t => assert.ok(o.content.includes(t), 'missing ' + t));
  assert.ok(/class="card span-all"[\s\S]*?Funnel health/.test(o.content), 'Funnel health spans the grid');
  assert.ok(!o.content.includes('margin-top:14px'), 'no ad-hoc spacing left');
});
test('the guide card and the four KPI tiles are kept, in that order', () => {
  const o = env({ view: 'analytics' }).run('renderAnalytics');
  assert.strictEqual((o.content.match(/class="stat-card"/g) || []).length, 4);
  assert.ok(o.content.indexOf('GUIDE') < o.content.indexOf('stats-grid'));
});

console.log('\nPlaybook');
test('the three-up sections are card grids, with no old grid-3 left', () => {
  const e = env({ view: 'playbook', pbFilter: '' });
  vm.runInContext(read('data/seed.js') + '\n' + read('data/sectors.js') + '\nthis.__pb = typeof PLAYBOOK !== "undefined";', e.ctx);
  const o = e.run('renderPlaybook');
  assert.ok((o.content.match(/class="card-grid three"/g) || []).length === 3, 'three card grids: shortlists, ladder, market context');
  assert.ok(!o.content.includes('grid-3'));
  assert.ok(o.content.includes('Scripts &amp; templates'));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
