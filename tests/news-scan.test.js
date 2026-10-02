/* Tests for the Daily AEEG News Scan's story-building rules.
 *
 * The scan turns Google News results into entries for the News page. What it
 * keeps, how it files a story and when it forgets one are decided by a few
 * pure functions in scripts/news-scan.js. These drive them with plain data,
 * so no network is touched.
 *
 *   node tests/news-scan.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const scan = require('../scripts/news-scan.js');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

const TODAY = '2026-10-02';
const ctx = { today: TODAY, companies: ['Sibanye-Stillwater', 'Gold Fields', 'Exxaro Resources'] };
const item = (title, over) => Object.assign({ title, link: 'https://news.google.com/rss/articles/CBMi' + title.length,
  pubDate: 'Thu, 01 Oct 2026 08:00:00 GMT', source: 'Mining Weekly', description: '' }, over);
const story = (n, over) => Object.assign({ id: 'auto-' + n, topic: 'renewable_energy', province: 'Multiple',
  date: '2026-09-30', title: 'Story ' + n, summary: '', whyItMatters: '', source: 'Mining Weekly',
  url: 'https://example.com/story-' + n, auto: true }, over);

console.log('\nparseFeed');
const FEED = '<rss><channel>' +
  '<item><title><![CDATA[Solar farm &amp; storage goes live - Mining Weekly]]></title>' +
  '<link>https://news.google.com/rss/articles/CBMiAAA</link><pubDate>Thu, 01 Oct 2026 08:00:00 GMT</pubDate>' +
  '<description>&lt;a href="x"&gt;Solar farm&lt;/a&gt;&amp;nbsp;&amp;nbsp;Mining Weekly</description>' +
  '<source url="https://www.miningweekly.com">Mining Weekly</source></item>' +
  '<item><title>No link here</title></item>' +
  '<item><link>https://news.google.com/rss/articles/CBMiBBB</link></item>' +
  '</channel></rss>';
test('reads title, link, date, publication and description, decoding entities', () => {
  const [a] = scan.parseFeed(FEED);
  assert.strictEqual(a.title, 'Solar farm & storage goes live - Mining Weekly');
  assert.strictEqual(a.link, 'https://news.google.com/rss/articles/CBMiAAA');
  assert.strictEqual(a.pubDate, 'Thu, 01 Oct 2026 08:00:00 GMT');
  assert.strictEqual(a.source, 'Mining Weekly');
});
test('an item missing its title or link is skipped, not fatal', () => assert.strictEqual(scan.parseFeed(FEED).length, 1));
test('an empty or garbled feed gives no items', () => {
  assert.deepStrictEqual(scan.parseFeed(''), []);
  assert.deepStrictEqual(scan.parseFeed('<html>blocked</html>'), []);
  assert.deepStrictEqual(scan.parseFeed(null), []);
});

console.log('\nclassify: topic');
test('a signed wheeling agreement is a New PPA Agreement', () =>
  assert.strictEqual(scan.classify(item('Sibanye-Stillwater signs wheeling agreement for solar power in South Africa'), ctx).topic, 'new_ppa'));
test('a renewed power purchase agreement is a Renewal', () =>
  assert.strictEqual(scan.classify(item('Gold Fields to renew power purchase agreement, South Africa'), ctx).topic, 'renewals'));
test('a general PPA story is PPA Contracts', () =>
  assert.strictEqual(scan.classify(item('Corporate PPAs now the main route to market in South Africa'), ctx).topic, 'ppa_contracts'));
test('a consortium story is Consortia', () =>
  assert.strictEqual(scan.classify(item('Consortium formed to build renewable energy for South African mines'), ctx).topic, 'consortia'));
test('a mine or smelter expansion is Mine Expansion', () =>
  assert.strictEqual(scan.classify(item('Exxaro approves mine expansion in Limpopo, South Africa'), ctx).topic, 'mine_expansion'));
test('a new solar farm is Renewable Energy', () =>
  assert.strictEqual(scan.classify(item('New 200 MW solar farm commissioned in South Africa'), ctx).topic, 'renewable_energy'));
test('a decarbonisation plan is Strategy', () =>
  assert.strictEqual(scan.classify(item('Harmony outlines decarbonisation strategy for South African mining operations'), ctx).topic, 'strategy'));
test('a story matching no topic is dropped', () =>
  assert.strictEqual(scan.classify(item('Celebrity chef opens restaurant in Cape Town, South Africa'), ctx), null));
test('household solar is not a Renewable Energy story for this desk', () =>
  assert.strictEqual(scan.classify(item('Eskom extends free rooftop solar registration, South Africa'), ctx), null));
test('a company that merely has "Solar" in its name is not a Renewable Energy story', () =>
  assert.strictEqual(scan.classify(item('How Solar Industries plans to grow its South Africa business'), ctx), null));
test('a utility-scale plant is a Renewable Energy story', () =>
  assert.strictEqual(scan.classify(item('SolarAfrica 114 MW SunCentral solar plant reaches commercial operation in South Africa'), ctx).topic, 'renewable_energy'));
test('solar for mines is a Renewable Energy story', () =>
  assert.strictEqual(scan.classify(item('Platinum mine adds solar power to its South African operations'), ctx).topic, 'renewable_energy'));
test('a Strategy story needs a mining or industrial angle', () => {
  assert.strictEqual(scan.classify(item('Energy security and water scarcity threaten South Africa\'s AI ambitions'), ctx), null);
  assert.strictEqual(scan.classify(item('Harmony outlines decarbonisation strategy for South African mines'), ctx).topic, 'strategy');
});
test('a story that is not about South Africa is dropped', () =>
  assert.strictEqual(scan.classify(item('Wind farm opens in Scotland'), ctx), null));
test('a story naming a priority company counts as South African', () =>
  assert.strictEqual(scan.classify(item('Sibanye-Stillwater signs wheeling agreement'), ctx).topic, 'new_ppa'));

console.log('\nclassify: province');
test('a place name files the story under its province', () =>
  assert.strictEqual(scan.classify(item('New 100 MW solar farm near Kathu, South Africa'), ctx).province, 'Northern Cape'));
test('a province name files the story under that province', () =>
  assert.strictEqual(scan.classify(item('Mine expansion approved in Mpumalanga, South Africa'), ctx).province, 'Mpumalanga'));
test('an unplaced story is filed as Multiple, not guessed', () =>
  assert.strictEqual(scan.classify(item('100 MW solar farm commissioned in South Africa'), ctx).province, 'Multiple'));
test('a story naming two provinces is Multiple', () =>
  assert.strictEqual(scan.classify(item('100 MW solar plants in Limpopo and Mpumalanga, South Africa'), ctx).province, 'Multiple'));

console.log('\nclassify: shape');
test('the publication suffix is removed from the headline', () => {
  const s = scan.classify(item('New 100 MW solar farm commissioned in South Africa - Mining Weekly'), ctx);
  assert.strictEqual(s.title, 'New 100 MW solar farm commissioned in South Africa');
  assert.strictEqual(s.source, 'Mining Weekly');
});
test('the date is the publication day, as YYYY-MM-DD', () =>
  assert.strictEqual(scan.classify(item('New 100 MW solar farm commissioned in South Africa'), ctx).date, '2026-10-01'));
test('a story with no date is dated today', () =>
  assert.strictEqual(scan.classify(item('New 100 MW solar farm commissioned in South Africa', { pubDate: '' }), ctx).date, TODAY));
test('a story older than 30 days is dropped', () =>
  assert.strictEqual(scan.classify(item('New 100 MW solar farm commissioned in South Africa', { pubDate: 'Mon, 01 Jun 2026 08:00:00 GMT' }), ctx), null));
test('a description that only repeats the headline and publication gives an empty summary', () => {
  const s = scan.classify(item('New 100 MW solar farm commissioned in South Africa', { description: 'New 100 MW solar farm commissioned in South Africa  Mining Weekly' }), ctx);
  assert.strictEqual(s.summary, '');
});
test('Google\'s double-encoded description (headline, &nbsp;, publication) gives an empty summary', () => {
  const feed = '<rss><channel><item><title>New solar farm of 114 MW commissioned in South Africa - Mining Weekly</title>' +
    '<link>https://news.google.com/rss/articles/CBMiZZZ</link><pubDate>Thu, 01 Oct 2026 08:00:00 GMT</pubDate>' +
    '<description>&lt;a href="https://news.google.com/x"&gt;New solar farm of 114 MW commissioned in South Africa&lt;/a&gt;' +
    '&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;Mining Weekly&lt;/font&gt;</description>' +
    '<source url="https://www.miningweekly.com">Mining Weekly</source></item></channel></rss>';
  const s = scan.classify(scan.parseFeed(feed)[0], ctx);
  assert.strictEqual(s.summary, '');
  assert.ok(!/nbsp|&/.test(s.title + s.summary));
});
test('a real description is kept as the summary', () => {
  const d = 'The 120 MW plant will supply two platinum mines under a ten-year wheeling arrangement, the company said on Thursday.';
  assert.strictEqual(scan.classify(item('New 100 MW solar farm commissioned in South Africa', { description: d }), ctx).summary, d);
});

console.log('\ntoStory');
test('builds a News page entry with an empty why-it-matters and the automatic flag', () => {
  const c = scan.classify(item('New 100 MW solar farm commissioned in South Africa'), ctx);
  const s = scan.toStory(c, 'https://www.miningweekly.com/article/solar-farm');
  assert.strictEqual(s.url, 'https://www.miningweekly.com/article/solar-farm');
  assert.strictEqual(s.whyItMatters, '');
  assert.strictEqual(s.auto, true);
  assert.ok(/^auto-/.test(s.id));
});
test('the same link always gives the same id', () => {
  const c = scan.classify(item('New 100 MW solar farm commissioned in South Africa'), ctx);
  assert.strictEqual(scan.toStory(c, 'https://a.com/x').id, scan.toStory(c, 'https://a.com/x?utm_source=feed').id);
});

console.log('\nnormalizeUrl');
test('ignores case, www, tracking parameters, fragments and a trailing slash', () =>
  assert.strictEqual(scan.normalizeUrl('HTTPS://www.Example.com/a/b/?utm_source=x&id=7#top'), 'https://example.com/a/b?id=7'));

console.log('\nmergeStories');
const merge = (existing, fresh, curated) => scan.mergeStories(existing, fresh, { today: TODAY, curated: curated || [] });
test('the same link found twice is kept once', () =>
  assert.strictEqual(merge([], [story(1), story(1, { id: 'auto-dup', url: 'https://www.example.com/story-1/?utm_source=a' })]).length, 1));
test('the same headline under different links is kept once', () =>
  assert.strictEqual(merge([], [story(1, { title: 'Big Solar Farm Goes Live!' }), story(2, { title: 'big solar farm goes live' })]).length, 1));
test('an existing story wins over a fresh duplicate', () =>
  assert.strictEqual(merge([story(1, { summary: 'old' })], [story(1, { summary: 'new' })])[0].summary, 'old'));
test('a story already in the curated list is skipped', () =>
  assert.deepStrictEqual(merge([], [story(1), story(2)], [{ url: 'https://example.com/story-1', title: 'Other' }]).map(s => s.id), ['auto-2']));
test('a curated story with the same headline also blocks it', () =>
  assert.strictEqual(merge([], [story(1, { title: 'Same Headline' })], [{ url: 'https://other.com/x', title: 'same headline' }]).length, 0));
test('stories older than 30 days are forgotten, 30 days old is kept', () => {
  const out = merge([story(1, { date: '2026-09-02' }), story(2, { date: '2026-09-01' })], []);
  assert.deepStrictEqual(out.map(s => s.id), ['auto-1']);
});
test('only the 150 newest are kept', () => {
  const many = [];
  for (let i = 0; i < 200; i++) many.push(story(i, { date: '2026-09-' + String(10 + (i % 20)).padStart(2, '0') }));
  const out = merge([], many);
  assert.strictEqual(out.length, 150);
  assert.ok(out.every((s, i) => i === 0 || out[i - 1].date >= s.date), 'newest first');
});
test('a story with no link is dropped', () => assert.strictEqual(merge([], [story(1, { url: '' })]).length, 0));
test('nothing fresh leaves the existing stories as they were', () => {
  const ex = [story(1), story(2)];
  assert.deepStrictEqual(merge(ex, []).map(s => s.id).sort(), ['auto-1', 'auto-2']);
});
test('merging does not change the lists it was given', () => {
  const ex = [story(1)], fresh = [story(2)];
  merge(ex, fresh);
  assert.strictEqual(ex.length, 1); assert.strictEqual(fresh.length, 1);
});

test('a story with no usable date is dropped rather than kept forever', () => {
  assert.strictEqual(merge([], [story(1, { date: undefined }), story(2, { date: 'soon' })]).length, 0);
});

console.log('\nfailing loudly, not silently');
test('a page that is not an RSS feed is an error (a block or consent page)', () => {
  assert.throws(() => scan.assertFeed('<html><body>Before you continue to Google</body></html>'), /not an RSS feed/);
  assert.throws(() => scan.assertFeed(''), /not an RSS feed/);
});
test('a real feed with no items is fine', () => assert.doesNotThrow(() => scan.assertFeed('<rss version="2.0"><channel><title>x</title></channel></rss>')));
test('links that were tried and none resolved means the decode is broken', () => assert.strictEqual(scan.resolutionBroken(12, 0, 0), true));
test('some resolved, some expired, or nothing tried is healthy', () => {
  assert.strictEqual(scan.resolutionBroken(12, 3, 0), false);
  assert.strictEqual(scan.resolutionBroken(12, 0, 12), false);
  assert.strictEqual(scan.resolutionBroken(0, 0, 0), false);
});
test('the saved stories file is read back as its list', () => {
  const text = "'use strict';\nconst NEWS_AUTO = " + JSON.stringify([story(1)]) + ';\n';
  assert.deepStrictEqual(scan.parseAutoFile(text).map(s => s.id), ['auto-1']);
});
test('a missing stories file is an empty list', () => assert.deepStrictEqual(scan.parseAutoFile(null), []));
test('a corrupt stories file is an error, never an empty list', () => {
  assert.throws(() => scan.parseAutoFile('<<<<<<< HEAD\nconst NEWS_AUTO = [\n'), /news-auto\.js/);
  assert.throws(() => scan.parseAutoFile("'use strict';\nconst NEWS_AUTO = 5;\n"), /news-auto\.js/);
});

console.log('\nsearches');
test('parseCompanies takes the name before the bar, skips comments and blanks, and drops repeats', () =>
  assert.deepStrictEqual(scan.parseCompanies('# note\n\nGold Fields | goldfields.com\nGold Fields | goldfields.com\nTharisa\n'), ['Gold Fields', 'Tharisa']));
test('one search per topic plus one per company, all scoped to South Africa', () => {
  const q = scan.queriesFor(['Gold Fields', 'Tharisa']);
  assert.strictEqual(q.length, 7 + 2);
  assert.ok(q.every(s => /South Africa/.test(s)));
  assert.ok(q.some(s => /Gold Fields/.test(s)) && q.some(s => /Tharisa/.test(s)));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
