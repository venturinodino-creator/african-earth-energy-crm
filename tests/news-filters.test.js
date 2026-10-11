/* The News filters: sources, "only stories that name an off-taker", and Save / Dismiss.
 *
 * Checks the logic the page is built on: which company a story names (whole words only), the
 * sources a story can be filtered by, how Save and Dismiss move a story between tabs and undo,
 * what a dismissed story leaves behind (nothing, except the Dismissed tab), and that the marks
 * survive a reload and a blocked or corrupt browser store. Pure functions from js/views-news.js
 * run in a sandbox with a stub store. No browser.
 *
 *   node tests/news-filters.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
const same = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function sandbox(store, opts) {
  opts = opts || {};
  const ctx = vm.createContext({
    console, esc, JSON,
    STORE_PREFIX: 'aee_crm_',
    NEWS_TOPICS: { ppa_contracts: { label: 'PPA Contracts', color: '#111' }, renewable_energy: { label: 'Renewable Energy', color: '#222' } },
    localStorage: {
      getItem: k => { if (opts.broken) throw new Error('blocked'); return k in store ? store[k] : null; },
      setItem: (k, v) => { if (opts.broken) throw new Error('blocked'); store[k] = String(v); },
    },
    state: { newsProvince: '', newsSearch: '', newsSourcesOff: [], newsMatchedOnly: false },
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'views-news.js'), 'utf8'), ctx);
  return ctx;
}
const J = x => JSON.stringify(x);
const call = (ctx, expr) => JSON.parse(vm.runInContext('JSON.stringify(' + expr + ')', ctx));

const offtakers = [
  { id: 'o1', name: 'Sasol Limited', short: 'Sasol' },
  { id: 'o2', name: 'Sibanye-Stillwater', short: 'Sibanye' },
  { id: 'o3', name: 'Impala Platinum (Implats)', short: 'Implats' },
  { id: 'o4', name: 'Rain', short: '' },
  { id: 'o5', name: 'AB', short: '' },
];
const stories = [
  { id: 's1', title: 'Corporate PPAs outpace public procurement', summary: 'Sibanye-Stillwater, Rio Tinto and Sasol are named as buyers.', whyItMatters: '', source: 'Mining Weekly', province: 'Multiple', date: '2026-09-08', topic: 'ppa_contracts' },
  { id: 's2', title: 'Wind farm enters commercial operation', summary: 'The Ummbila Emoyeni complex near Bethal. Rainbow Energy is building the next phase.', whyItMatters: '', source: 'Energy Global', province: 'Mpumalanga', date: '2026-08-05', topic: 'renewable_energy' },
  { id: 's3', title: 'Impala Platinum signs a solar PPA', summary: '', whyItMatters: '', source: 'Mining Weekly', province: 'North West', date: '2026-07-01', topic: 'ppa_contracts' },
  { id: 's4', title: 'Nothing about anyone on file', summary: 'A general note.', whyItMatters: '', source: '', province: 'Gauteng', date: '2026-06-01', topic: 'renewable_energy' },
];

console.log('\nWhich company a story names');
const matched = s => call(sandbox({}), 'newsMatches(' + J(stories.find(x => x.id === s)) + ', ' + J(offtakers) + ').map(o => o.id)');
test('a company named in the title or the summary is matched', () => {
  same(matched('s1').sort(), ['o1', 'o2']);
  same(matched('s3'), ['o3'], 'by its name without the bracketed short form');
});
test('a short name inside a longer word is not a match: Rain is not Rainbow', () => same(matched('s2'), []));
test('a story naming nobody on file matches nothing', () => same(matched('s4'), []));
test('a name under four letters never matches, so a two-letter company cannot claim every story', () => {
  const s = { id: 'x', title: 'AB and CD announce a deal', summary: '' };
  same(call(sandbox({}), 'newsMatches(' + J(s) + ', ' + J(offtakers) + ')'), []);
});
test('case and punctuation do not matter', () => {
  const s = { id: 'x', title: 'SIBANYE—STILLWATER expands', summary: '' };
  same(call(sandbox({}), 'newsMatches(' + J(s) + ', ' + J(offtakers) + ').map(o => o.id)'), ['o2']);
});

console.log('\nThe sources');
test('each source is listed once, with how many stories it has, biggest first', () => {
  same(call(sandbox({}), 'newsSourcesOf(' + J(stories) + ')'), [
    { source: 'Mining Weekly', n: 2 }, { source: 'Energy Global', n: 1 }, { source: 'Other', n: 1 }]);
});
test('a story with no source is grouped under Other, never as undefined', () =>
  assert.ok(!/undefined/.test(J(call(sandbox({}), 'newsSourcesOf(' + J(stories) + ')')))));

console.log('\nFiltering');
const filt = (f) => call(sandbox({}), 'newsFilter(' + J(stories) + ', ' + J(Object.assign({ province: '', term: '', sourcesOff: [], matchedOnly: false, offtakers }, f)) + ').map(s => s.id)');
test('with no filters every story is in, newest first', () => same(filt({}), ['s1', 's2', 's3', 's4']));
test('unticking a source drops its stories, and Other is a source like the rest', () => {
  same(filt({ sourcesOff: ['Mining Weekly'] }), ['s2', 's4']);
  same(filt({ sourcesOff: ['Other'] }), ['s1', 's2', 's3']);
});
test('only stories that name an off-taker keeps just those', () => same(filt({ matchedOnly: true }), ['s1', 's3']));
test('the filters combine with province and search', () => {
  same(filt({ province: 'North West', matchedOnly: true }), ['s3']);
  same(filt({ term: 'wind', sourcesOff: ['Energy Global'] }), []);
  same(filt({ term: 'bethal' }), ['s2']);
});
test('everything unticked is an empty list, not an error', () => same(filt({ sourcesOff: ['Mining Weekly', 'Energy Global', 'Other'] }), []));

console.log('\nSave and Dismiss');
const mark = (m, id, action) => call(sandbox({}), 'applyNewsMark(' + J(m) + ', ' + J(id) + ', ' + J(action) + ')');
const none = { saved: [], dismissed: [] };
test('saving a story saves it; saving it again takes the save back', () => {
  const a = mark(none, 's1', 'save');
  same(a, { saved: ['s1'], dismissed: [] });
  same(mark(a, 's1', 'save'), none);
});
test('dismissing a story dismisses it, and restoring puts it back', () => {
  const a = mark(none, 's2', 'dismiss');
  same(a, { saved: [], dismissed: ['s2'] });
  same(mark(a, 's2', 'restore'), none);
});
test('a story is saved or dismissed, never both: each action clears the other', () => {
  const saved = mark(none, 's1', 'save');
  same(mark(saved, 's1', 'dismiss'), { saved: [], dismissed: ['s1'] });
  const dismissed = mark(none, 's1', 'dismiss');
  same(mark(dismissed, 's1', 'save'), { saved: ['s1'], dismissed: [] });
});
test('marks on other stories are left alone', () => {
  const a = mark(mark(none, 's1', 'save'), 's2', 'dismiss');
  same(a, { saved: ['s1'], dismissed: ['s2'] });
  same(mark(a, 's1', 'save'), { saved: [], dismissed: ['s2'] });
});
test('an unknown action changes nothing', () => same(mark({ saved: ['s1'], dismissed: [] }, 's1', 'explode'), { saved: ['s1'], dismissed: [] }));

console.log('\nThe tabs');
const tabs = (m, extra) => call(sandbox({}), 'newsTabSets(' + J(stories.map(s => ({ id: s.id }))) + ', ' + J(m) + ')');
test('a dismissed story leaves the feed and shows only under Dismissed', () => {
  const t = tabs({ saved: [], dismissed: ['s2'] });
  same(t.feed.map(s => s.id), ['s1', 's3', 's4']);
  same(t.dismissed.map(s => s.id), ['s2']);
});
test('a saved story stays in the feed and also shows under Saved', () => {
  const t = tabs({ saved: ['s3'], dismissed: [] });
  assert.ok(t.feed.some(s => s.id === 's3'));
  same(t.saved.map(s => s.id), ['s3']);
});
test('marks on stories that are no longer in the feed are ignored, so a count never lies', () => {
  const t = tabs({ saved: ['gone'], dismissed: ['also-gone'] });
  assert.strictEqual(t.saved.length, 0);
  assert.strictEqual(t.dismissed.length, 0);
  assert.strictEqual(t.feed.length, 4);
});

console.log('\nRemembered on this device');
test('marks are saved to the browser and read back after a reload', () => {
  const store = {};
  const a = sandbox(store);
  vm.runInContext("newsStoreMarks({ saved: ['s1'], dismissed: ['s2'] })", a);
  const b = sandbox(store);
  same(call(b, 'newsLoadMarks()'), { saved: ['s1'], dismissed: ['s2'] });
});
test('they live under their own keys, not under anything the CRM already keeps', () => {
  const store = {};
  vm.runInContext("newsStoreMarks({ saved: ['s1'], dismissed: [] })", sandbox(store));
  assert.ok(Object.keys(store).every(k => /^aee_crm_news_/.test(k)), Object.keys(store).join(','));
});
test('nothing stored means nothing marked', () => same(call(sandbox({}), 'newsLoadMarks()'), none));
test('a corrupt store is read as empty rather than breaking the page', () => {
  const store = { aee_crm_news_saved: '{not json', aee_crm_news_dismissed: '"a string"' };
  same(call(sandbox(store), 'newsLoadMarks()'), none);
});
test('a blocked store (private window) still lets the page work, for this visit', () => {
  const ctx = sandbox({}, { broken: true });
  same(call(ctx, 'newsLoadMarks()'), none);
  assert.doesNotThrow(() => vm.runInContext("newsStoreMarks({ saved: ['s1'], dismissed: [] })", ctx));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
