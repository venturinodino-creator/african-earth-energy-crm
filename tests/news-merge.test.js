/* Tests for the News page's merge of curated and automatic stories.
 *
 * The page shows the hand-curated stories (data/news.js) beside the ones the
 * Daily AEEG News Scan saves (data/news-auto.js, tagged "Auto"). Which list a
 * story comes from, who wins a clash, and what the feed, filters and Export
 * see are decided in js/views-news.js; this loads that file into a sandbox
 * and drives it with plain data, no browser needed.
 *
 *   node tests/news-merge.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'views-news.js'), 'utf8');

/* A fresh page with the given lists. `auto` of undefined means data/news-auto.js did not load at all. */
function page(curated, auto) {
  const calls = { csv: null };
  const sandbox = {
    NEWS_TOPICS: { ppa_contracts: { label: 'PPA Contracts', color: '#a78bfa' }, renewable_energy: { label: 'Renewable Energy', color: '#3ddc84' } },
    NEWS_PROVINCES: ['Gauteng', 'Mpumalanga', 'Multiple'],
    NEWS_ARTICLES: curated,
    state: { newsSearch: '', newsProvince: '', newsTopic: 'all' },
    esc: s => String(s == null ? '' : s),
    icon: () => '', safeHref: u => u || '',
    downloadCSV: (name, rows) => { calls.csv = rows; }, toast: () => {}, todayISO: () => '2026-10-02',
    URL,   // a browser has it; the sandbox does not
    console,
  };
  if (auto !== undefined) sandbox.NEWS_AUTO = auto;
  const ctx = vm.createContext(sandbox);
  const api = vm.runInContext(src + '\n;({ allNews, mergeNews, newsInScope, newsCardHtml, exportNews })', ctx);
  return { api, state: sandbox.state, calls };
}

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
const ids = list => Array.from(list).map(a => a.id);

const cur = (n, over) => Object.assign({ id: 'cur-' + n, topic: 'ppa_contracts', province: 'Multiple', date: '2026-09-0' + n,
  title: 'Curated ' + n, summary: 'Curated summary ' + n, whyItMatters: 'Because ' + n, source: 'Mining Weekly', url: 'https://example.com/c' + n }, over);
const auto = (n, over) => Object.assign({ id: 'auto-' + n, topic: 'renewable_energy', province: 'Gauteng', date: '2026-10-0' + n,
  title: 'Auto ' + n, summary: '', whyItMatters: '', source: 'Engineering News', url: 'https://example.org/a' + n, auto: true }, over);

console.log('\nallNews');
test('lists the curated and the automatic stories together', () =>
  assert.deepStrictEqual(ids(page([cur(1), cur(2)], [auto(1)]).api.allNews()).sort(), ['auto-1', 'cur-1', 'cur-2']));
test('with no automatic stories it is exactly the curated list', () => {
  assert.deepStrictEqual(ids(page([cur(1), cur(2)], []).api.allNews()), ['cur-1', 'cur-2']);
});
test('with data/news-auto.js missing altogether it is exactly the curated list', () =>
  assert.deepStrictEqual(ids(page([cur(1), cur(2)], undefined).api.allNews()), ['cur-1', 'cur-2']));
test('a curated story wins over an automatic one with the same link', () => {
  const out = page([cur(1, { url: 'https://example.org/story' })], [auto(1, { url: 'https://example.org/story' })]).api.allNews();
  assert.deepStrictEqual(ids(out), ['cur-1']);
});
test('the same link is recognised through www, case, tracking parameters and a trailing slash', () => {
  const out = page([cur(1, { url: 'https://example.org/story' })], [auto(1, { url: 'HTTPS://www.Example.org/story/?utm_source=feed#top' })]).api.allNews();
  assert.deepStrictEqual(ids(out), ['cur-1']);
});
test('two different links are both kept', () =>
  assert.strictEqual(page([cur(1)], [auto(1)]).api.allNews().length, 2));
test('merging does not change the lists it was given', () => {
  const c = [cur(1)], a = [auto(1)];
  page(c, a).api.mergeNews(c, a);
  assert.strictEqual(c.length, 1); assert.strictEqual(a.length, 1);
  assert.strictEqual(c[0].auto, undefined);
});

console.log('\nfeed and filters');
test('the feed is newest first across both lists', () =>
  assert.deepStrictEqual(ids(page([cur(1), cur(2)], [auto(1)]).api.newsInScope()), ['auto-1', 'cur-2', 'cur-1']));
test('the province filter includes automatic stories', () => {
  const p = page([cur(1)], [auto(1), auto(2, { province: 'Mpumalanga' })]);
  p.state.newsProvince = 'Mpumalanga';
  assert.deepStrictEqual(ids(p.api.newsInScope()), ['auto-2']);
});
test('search finds automatic stories by headline', () => {
  const p = page([cur(1)], [auto(1, { title: 'Virtual wheeling milestone' })]);
  p.state.newsSearch = 'wheeling';
  assert.deepStrictEqual(ids(p.api.newsInScope()), ['auto-1']);
});

console.log('\nthe Auto tag');
test('an automatic story card carries the Auto tag', () =>
  assert.ok(/news-auto-tag[^>]*>\s*Auto\s*</.test(page([], [auto(1)]).api.newsCardHtml(auto(1)))));
test('a curated story card does not', () =>
  assert.ok(!/news-auto-tag/.test(page([cur(1)], []).api.newsCardHtml(cur(1)))));
test('an automatic story with no summary or why-it-matters shows neither line, only the headline and link', () => {
  const html = page([], [auto(1)]).api.newsCardHtml(auto(1));
  assert.ok(html.includes('Auto 1') && html.includes('https://example.org/a1'));
  assert.ok(!/news-why/.test(html));
});

console.log('\nexport');
test('Export includes automatic stories and an auto column', () => {
  const p = page([cur(1)], [auto(1)]);
  p.api.exportNews();
  const rows = p.calls.csv;
  assert.strictEqual(rows.length, 3);
  const col = rows[0].indexOf('auto');
  assert.ok(col >= 0, 'header has an auto column');
  const byTitle = Object.fromEntries(rows.slice(1).map(r => [r[rows[0].indexOf('title')], r[col]]));
  assert.strictEqual(byTitle['Auto 1'], 'yes');
  assert.strictEqual(byTitle['Curated 1'], 'no');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
