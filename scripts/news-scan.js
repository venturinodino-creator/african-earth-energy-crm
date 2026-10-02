#!/usr/bin/env node
/* Daily AEEG News Scan.
 *
 * Finds fresh mining, power and PPA stories for the News page and saves them
 * to data/news-auto.js, a file only this script writes. The hand-curated
 * data/news.js is read (to avoid repeating a story) and never changed.
 *
 *   node scripts/news-scan.js
 *
 * Runs daily from .github/workflows/news-scan.yml. No dependencies, no
 * secrets, no model: a story is kept or dropped by keyword rules, and its
 * "why it matters" line is left empty because that is the desk's own read.
 *
 * Stage 1 searches Google News RSS (one search per News topic and one per
 * company on data/mining-companies.txt). Stage 2 files each story under a
 * topic and province. Stage 3 resolves Google's redirect link to the
 * publisher's own link; a story without one is dropped, because the News
 * page requires a working source link.
 *
 * The functions below the CONFIG block are pure and are what
 * tests/news-scan.test.js drives; main() is the thin network wrapper.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const AUTO_FILE = path.join(ROOT, 'data', 'news-auto.js');
const STATE_FILE = path.join(ROOT, 'data', 'news-auto-state.json');
const CURATED_FILE = path.join(ROOT, 'data', 'news.js');
const COMPANIES_FILE = path.join(ROOT, 'data', 'mining-companies.txt');

/* ── CONFIG: the rules live here ───────────────────────────────────── */
const WINDOW_DAYS = 30;        // an automatic story is forgotten after this long
const CAP = 150;               // and the list never holds more than this many
const MAX_RESOLVE_PER_RUN = 60;// links resolved per run; the rest wait for tomorrow
const REQUEST_DELAY_MS = 350;
const SEARCH_WINDOW = 'when:7d';

/* The first topic whose pattern matches wins, so the specific ones come first.
   The ids are the News page's own (NEWS_TOPICS in data/news.js). The two broad topics, Renewable Energy and
   Strategy, also need a commercial or mining angle (third item), or every rooftop-solar and energy-essay story
   would get in. */
const TOPIC_RULES = [
  ['new_ppa',          /\b(sign(s|ed)?|secure[sd]?|conclude[sd]?|ink(s|ed)?|award(s|ed)?|enter(s|ed)? into)\b.{0,60}\b(ppa|power purchase|wheeling|offtake|off-take|energy supply agreement)/i],
  ['renewals',         /\brenew(s|ed|al|als)?\b.{0,50}\b(ppa|power purchase|power agreement|energy agreement|offtake|contract)|\b(ppa|power purchase|power agreement|offtake)\b.{0,50}\b(renew(s|ed|al|als)?|extend(s|ed)?|extension)\b/i],
  ['ppa_contracts',    /\b(ppa|ppas|power purchase|wheeling|offtake|off-take|offtaker|energy supply agreement)\b/i],
  ['consortia',        /\b(consortium|consortia|joint venture|joint-venture|partnership|partners with)\b/i],
  ['mine_expansion',   /\b(mine|mines|mining|smelter|smelters|concentrator)\b.{0,60}\b(expan\w*|new mine|extension|restart|reopen\w*|capex|capital investment|commission\w*)|\b(expan\w*|reopen\w*|restart\w*)\b.{0,60}\b(mine|mines|mining|smelter|smelters)\b/i],
  ['renewable_energy', /\b(solar|wind farm|wind power|wind energy|photovoltaic|pv plant|battery storage|bess|renewable|renewables)\b/i,
                       /\b(\d[\d.,]*\s?(mw|gw|mwp|mwh|gwh)|mines?|mining|smelters?|industrial|commercial|corporate|utility[- ]scale|wheeling|ppa|ppas|offtake|ipp)\b/i],
  ['strategy',         /\b(decarboni[sz]\w*|net[- ]zero|energy transition|energy strategy|carbon[- ]neutral|energy security)\b/i,
                       /\b(mines?|mining|smelters?|industrial|heavy industry|corporate|manufactur\w*)\b/i],
];

/* Province names and the places that give a story away. */
const PROVINCES = {
  'Mpumalanga':    /\b(mpumalanga|witbank|emalahleni|secunda|middelburg|bethal|highveld|mbombela|nelspruit)\b/i,
  'Northern Cape': /\b(northern cape|kathu|kuruman|upington|sishen|postmasburg|namaqualand|kimberley|springbok|hotazel)\b/i,
  'Limpopo':       /\b(limpopo|polokwane|mokopane|phalaborwa|musina|lephalale|thabazimbi)\b/i,
  'North West':    /\b(north[- ]west province|north west province|rustenburg|brits|klerksdorp|mahikeng|potchefstroom|marikana)\b/i,
  'Gauteng':       /\b(gauteng|johannesburg|pretoria|tshwane|ekurhuleni|sandton|germiston)\b/i,
  'KwaZulu-Natal': /\b(kwazulu|kzn|durban|richards bay|ladysmith)\b/i,
  'Eastern Cape':  /\b(eastern cape|gqeberha|port elizabeth|east london|coega|mthatha)\b/i,
  'Western Cape':  /\b(western cape|cape town|saldanha|stellenbosch)\b/i,
  'Free State':    /\b(free state|bloemfontein|welkom|sasolburg|kroonstad)\b/i,
};
const SOUTH_AFRICA = /\b(south africa\w*|eskom|nersa|transnet|johannesburg)\b/i;

/* One search per News topic. Each company on the priority list gets its own below. */
const TOPIC_SEARCHES = [
  '"South Africa" "power purchase agreement" OR PPA OR wheeling',
  '"South Africa" solar OR wind OR "battery storage" mining OR industrial',
  '"South Africa" mine expansion OR "new mine" OR smelter investment',
  '"South Africa" renewable energy consortium OR "joint venture" mining',
  '"South Africa" PPA renewal OR renewed OR extended power agreement',
  '"South Africa" mining decarbonisation OR "energy transition" strategy',
  '"South Africa" signs OR secures PPA OR "wheeling agreement"',
];

/* ── pure functions ────────────────────────────────────────────────── */

function decodeEntities(s) {
  return String(s == null ? '' : s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&hellip;/g, '…')
    .replace(/&lsquo;/g, '‘').replace(/&rsquo;/g, '’').replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/g, '&');
}
function unwrap(s) {
  const m = String(s == null ? '' : s).match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return decodeEntities(m ? m[1] : s).trim();
}
const squash = s => String(s || '').replace(/\s+/g, ' ').trim();
/* Google double-encodes its descriptions (markup arrives as text, with &nbsp; inside), so entities are
   decoded again after the tags are stripped. */
const plain = s => squash(decodeEntities(String(s || '').replace(/<[^>]*>/g, ' ')));

/* RSS 2.0 items by regex: Google News RSS is regular enough that a parser is not worth a dependency. */
function parseFeed(xml) {
  if (typeof xml !== 'string') return [];
  const tag = (block, name) => unwrap((block.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>')) || [])[1]);
  const items = [];
  for (const block of xml.match(/<item>[\s\S]*?<\/item>/g) || []) {
    const it = { title: tag(block, 'title'), link: tag(block, 'link'), pubDate: tag(block, 'pubDate'),
      source: tag(block, 'source'), description: tag(block, 'description') };
    if (it.title && it.link) items.push(it);
  }
  return items;
}

/* A block, consent or captcha page is HTML, not a feed. Without this it parses to zero items and the run
   would look healthy while quietly finding nothing. */
function assertFeed(xml) {
  if (typeof xml !== 'string' || !/<rss[\s>]/.test(xml)) throw new Error('not an RSS feed (blocked or changed by Google?)');
}

/* Links were attempted and not one resolved or was retired: Google's decode endpoint has changed. */
function resolutionBroken(tried, resolved, expired) { return tried > 0 && resolved === 0 && expired === 0; }

/* The saved stories file as a list. Only a missing file means "no stories yet"; a file that cannot be read
   back is an error, so a bad merge or hand edit can never be replaced by an empty list. */
function parseAutoFile(text) {
  if (text == null) return [];
  let list;
  try { list = vm.runInNewContext(text + '\n;NEWS_AUTO'); } catch (e) { throw new Error('data/news-auto.js cannot be read: ' + e.message); }
  if (!Array.isArray(list)) throw new Error('data/news-auto.js does not hold a list of stories');
  return Array.from(list);   // an ordinary array: the sandbox's own Array has a different prototype
}

function daysBetween(a, b) { return Math.floor((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 864e5); }
function isoDay(pubDate, today) {
  const t = Date.parse(pubDate);
  return isNaN(t) ? today : new Date(t).toISOString().slice(0, 10);
}
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

function topicOf(text) {
  for (const [id, re, needs] of TOPIC_RULES) if (re.test(text) && (!needs || needs.test(text))) return id;
  return null;
}
function provinceOf(text) {
  const hits = Object.keys(PROVINCES).filter(p => PROVINCES[p].test(text));
  return hits.length === 1 ? hits[0] : 'Multiple';
}

/* One search result in, a filed story (without its publisher link yet) out, or null to drop it. */
function classify(it, ctx) {
  const source = squash(it.source);
  let title = squash(it.title);
  if (source && title.toLowerCase().endsWith(' - ' + source.toLowerCase())) title = title.slice(0, -(source.length + 3)).trim();
  const desc = plain(it.description);
  const text = title + ' ' + desc;

  const isSA = SOUTH_AFRICA.test(text) || Object.values(PROVINCES).some(re => re.test(text)) ||
    (ctx.companies || []).some(c => c && text.toLowerCase().includes(c.toLowerCase()));
  if (!isSA) return null;
  const topic = topicOf(text);
  if (!topic) return null;
  const date = isoDay(it.pubDate, ctx.today);
  if (daysBetween(ctx.today, date) > WINDOW_DAYS) return null;

  /* Google's description is usually the headline and publication again; only a real sentence is a summary. */
  let summary = desc;
  if (source) summary = summary.replace(new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i'), '').trim();
  if (norm(summary) === norm(title) || summary.length < 40) summary = '';
  if (summary.length > 300) summary = summary.slice(0, 297).replace(/\s+\S*$/, '') + '…';

  return { topic, province: provinceOf(text), date, title, summary, source };
}

function normalizeUrl(u) {
  try {
    const x = new URL(String(u));
    x.hash = '';
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|mc_|ref$)/i.test(k)) x.searchParams.delete(k);
    const host = x.hostname.toLowerCase().replace(/^www\./, '');
    const search = x.searchParams.toString();
    return x.protocol.toLowerCase() + '//' + host + x.pathname.replace(/\/+$/, '') + (search ? '?' + search : '');
  } catch (e) { return String(u || ''); }
}

function toStory(c, url) {
  const key = normalizeUrl(url);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  return { id: 'auto-' + Math.abs(h).toString(36), topic: c.topic, province: c.province, date: c.date,
    title: c.title, summary: c.summary, whyItMatters: '', source: c.source, url, auto: true };
}

/* Existing automatic stories + fresh ones -> the list to save. Existing win ties; nothing is mutated. */
function mergeStories(existing, fresh, opts) {
  const curatedUrls = new Set((opts.curated || []).map(a => normalizeUrl(a.url)));
  const curatedTitles = new Set((opts.curated || []).map(a => norm(a.title)));
  const seenUrls = new Set(), seenTitles = new Set(), out = [];
  for (const s of [...existing, ...fresh]) {
    if (!s || !s.url || isNaN(Date.parse(s.date))) continue;   // no link or no usable date: not a story we can keep honestly
    const u = normalizeUrl(s.url), t = norm(s.title);
    if (curatedUrls.has(u) || curatedTitles.has(t) || seenUrls.has(u) || seenTitles.has(t)) continue;
    if (daysBetween(opts.today, s.date) > WINDOW_DAYS) continue;
    seenUrls.add(u); seenTitles.add(t); out.push(s);
  }
  out.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  return out.slice(0, CAP);
}

function parseCompanies(text) {
  const names = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const name = t.split('|')[0].trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

function queriesFor(companies) {
  return [...TOPIC_SEARCHES, ...companies.map(c => '"' + c + '" "South Africa" (energy OR solar OR power OR PPA OR expansion)')]
    .map(q => q + ' ' + SEARCH_WINDOW);
}

/* ── network wrapper ───────────────────────────────────────────────── */

const sleep = ms => new Promise(r => setTimeout(r, ms));
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

async function fetchTimed(url, options) {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 20000);
  try { return await fetch(url, Object.assign({}, options, { signal: ctrl.signal })); }
  finally { clearTimeout(timer); }
}

async function search(query) {
  const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=en-ZA&gl=ZA&ceid=ZA:en';
  const res = await fetchTimed(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AEE-CRM-NewsBot/1.0)' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const xml = await res.text();
  assertFeed(xml);
  return parseFeed(xml);
}

/* Google hands out its own redirect links. The way across is its decode endpoint: the article page carries a
   signature and timestamp that authorise one batchexecute call returning the publisher's address (the same
   technique the Netherlands CRM's news scan uses). Returns { url }, { expired: true } or {}. */
async function resolvePublisherUrl(googleUrl) {
  const id = (String(googleUrl).match(/news\.google\.com\/(?:rss\/)?articles\/([^?/]+)/) || [])[1];
  if (!id) return {};
  try {
    const page = await fetchTimed('https://news.google.com/rss/articles/' + id, { headers: { 'User-Agent': BROWSER_UA } });
    if (page.status === 400 || page.status === 404) return { expired: true };
    if (!page.ok) return {};
    const html = await page.text();
    const sg = html.match(/data-n-a-sg="([^"]+)"/), ts = html.match(/data-n-a-ts="([^"]+)"/);
    if (!sg || !ts) return {};
    const inner = JSON.stringify(['garturlreq',
      [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1],
        'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], id, Number(ts[1]), sg[1]]);
    const res = await fetchTimed('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
      method: 'POST',
      headers: { 'User-Agent': BROWSER_UA, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ 'f.req': JSON.stringify([[['Fbv4je', inner, null, 'generic']]]) }),
    });
    if (!res.ok) return {};
    for (const line of (await res.text()).split('\n')) {
      if (!line.includes('garturlres')) continue;
      let outer; try { outer = JSON.parse(line); } catch (e) { continue; }
      for (const part of outer) {
        try { const u = JSON.parse(part[2])[1]; if (typeof u === 'string' && /^https?:\/\//.test(u)) return { url: u }; } catch (e) { /* keep looking */ }
      }
    }
    return {};
  } catch (e) { return {}; }
}

function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; } }
function readAutoStories() {
  return parseAutoFile(fs.existsSync(AUTO_FILE) ? fs.readFileSync(AUTO_FILE, 'utf8') : null);
}
function readCurated() {
  return vm.runInNewContext(fs.readFileSync(CURATED_FILE, 'utf8') + '\n;NEWS_ARTICLES');
}

function renderAutoFile(list) {
  return '/* Automatic stories for the News page: written by scripts/news-scan.js (the Daily AEEG News Scan),\n' +
    '   never by hand. Curated stories live in data/news.js and are not touched by the scan. */\n' +
    "'use strict';\n\nconst NEWS_AUTO = " + JSON.stringify(list, null, 2) + ';\n';
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const companies = parseCompanies(fs.readFileSync(COMPANIES_FILE, 'utf8'));
  const curated = readCurated();
  const existing = readAutoStories();
  const state = readJson(STATE_FILE, { seen: {} });
  const seen = state.seen || {};

  const queries = queriesFor(companies);
  const candidates = new Map();           // link -> classified story
  let okSearches = 0;
  for (let i = 0; i < queries.length; i++) {
    try {
      for (const it of await search(queries[i])) {
        if (seen[it.link] || candidates.has(it.link)) continue;
        const c = classify(it, { today, companies });
        if (c) candidates.set(it.link, c);
      }
      okSearches++;
    } catch (e) { console.warn('  ! search failed (' + e.message + '): ' + queries[i].slice(0, 70)); }
    if (i < queries.length - 1) await sleep(REQUEST_DELAY_MS);
  }
  console.log(`[news-scan] ${okSearches}/${queries.length} searches ok, ${candidates.size} new candidate stories`);
  if (!okSearches) { console.error('[news-scan] every search failed; leaving the existing files untouched'); process.exit(1); }

  const fresh = [];
  let tried = 0, resolved = 0, expired = 0;
  for (const [link, c] of candidates) {
    if (tried >= MAX_RESOLVE_PER_RUN) break;   // the rest are not marked seen, so tomorrow picks them up
    tried++;
    const r = await resolvePublisherUrl(link);
    if (r.url) { fresh.push(toStory(c, r.url.slice(0, 500))); seen[link] = today; resolved++; }
    else if (r.expired) { seen[link] = today; expired++; }
    await sleep(REQUEST_DELAY_MS);
  }
  console.log(`[news-scan] resolved ${resolved}/${tried} publisher links` + (expired ? `, ${expired} retired by Google` : ''));
  if (resolutionBroken(tried, resolved, expired)) {
    console.error('[news-scan] none of the links could be resolved; Google\'s decode endpoint has probably changed. Failing so this is seen.');
    process.exit(1);
  }

  const list = mergeStories(existing, fresh, { today, curated });
  for (const k of Object.keys(seen)) if (daysBetween(today, seen[k]) > WINDOW_DAYS) delete seen[k];

  const out = renderAutoFile(list);
  if (!fs.existsSync(AUTO_FILE) || fs.readFileSync(AUTO_FILE, 'utf8') !== out) fs.writeFileSync(AUTO_FILE, out);
  fs.writeFileSync(STATE_FILE, JSON.stringify({ seen }, null, 1) + '\n');
  console.log(`[news-scan] ${list.length} automatic stories saved (${fresh.length} new)`);
}

module.exports = { assertFeed, resolutionBroken, parseAutoFile, parseFeed, classify, toStory, normalizeUrl, mergeStories, parseCompanies, queriesFor };

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
