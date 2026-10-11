/* ═══════════════════════════════════════════════════════════════════
   News — mining-industry stories the desk reads before it dials.

   One feed, filtered by topic along the chip row and by province down the
   side. The Summary chip swaps the feed for an executive read of the same
   filtered set, so the two never disagree about what is in scope.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

function newsTopicOf(a) { return NEWS_TOPICS[a.topic] || { label: 'News', color: 'var(--muted)' }; }

/* The same link, whatever the tracking parameters, www, case or trailing slash. */
function newsLinkKey(u) {
  try {
    const x = new URL(String(u));
    [...x.searchParams.keys()].forEach(k => { if (/^(utm_|fbclid$|gclid$|mc_|ref$)/i.test(k)) x.searchParams.delete(k); });
    const q = x.searchParams.toString();
    return x.hostname.toLowerCase().replace(/^www\./, '') + x.pathname.replace(/\/+$/, '') + (q ? '?' + q : '');
  } catch (e) { return String(u || ''); }
}

/* The desk's curated stories (data/news.js) beside the ones the Daily AEEG News Scan saves
   (data/news-auto.js, tagged Auto). When both cover the same link, the curated one wins.
   Neither list is changed. */
function mergeNews(curated, auto) {
  const have = new Set(curated.map(a => newsLinkKey(a.url)));
  return curated.concat((auto || []).filter(a => a && a.url && !have.has(newsLinkKey(a.url))));
}

/* Every story the page shows. data/news-auto.js may not have loaded; the page then reads as it always did. */
function allNews() {
  return mergeNews(NEWS_ARTICLES, typeof NEWS_AUTO === 'undefined' ? [] : NEWS_AUTO);
}

/* ─── WHICH COMPANY A STORY NAMES ─────────────────────────────── */
/* A story has no link to the CRM's companies, so "matched" means it names one on file, as
   whole words (so "Rain" is not found inside "Rainbow"). A company is looked for by its short
   name, its full name, and its name without brackets or a Ltd. Anything under four letters is
   never looked for: it would be found in almost every story. */
function newsWords(s) { return ' ' + String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' '; }
function newsNameForms(o) {
  const bare = String(o.name || '').replace(/\([^)]*\)/g, ' ').replace(/\b(pty|ltd|limited|holdings)\b/gi, ' ');
  return [o.short, o.name, bare].map(newsWords).filter(w => w.trim().length >= 4);
}
function newsMatches(a, offtakers) {
  const text = newsWords(a.title + ' ' + (a.summary || '') + ' ' + (a.whyItMatters || ''));
  return offtakers.filter(o => newsNameForms(o).some(w => text.includes(w)));
}

/* ─── SOURCES ─────────────────────────────────────────────────── */
/* Each publisher once, with how many stories it has, biggest first. A story with no source
   is under "Other", so every story can be ticked or unticked by something. */
function newsSourceOf(a) { return a.source || 'Other'; }
function newsSourcesOf(stories) {
  const n = {};
  stories.forEach(a => { const s = newsSourceOf(a); n[s] = (n[s] || 0) + 1; });
  return Object.entries(n).map(([source, count]) => ({ source, n: count })).sort((a, b) => b.n - a.n || a.source.localeCompare(b.source));
}

/* ─── FILTERING ───────────────────────────────────────────────── */
/* Every story the filters leave, newest first: province, search, the sources still ticked,
   and optionally only those that name a company on file. */
function newsFilter(stories, f) {
  const term = String(f.term || '').toLowerCase();
  const off = f.sourcesOff || [];
  return stories.filter(a => {
    if (f.province && a.province !== f.province) return false;
    if (term && !(a.title + ' ' + a.summary + ' ' + (a.whyItMatters || '') + ' ' + a.province).toLowerCase().includes(term)) return false;
    if (off.includes(newsSourceOf(a))) return false;
    if (f.matchedOnly && !newsMatches(a, f.offtakers || []).length) return false;
    return true;
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

/* ─── SAVE AND DISMISS ────────────────────────────────────────── */
/* Kept in this browser only, under their own keys, and labelled that way on the page. A story is
   saved or dismissed, never both. The marks are held in memory for the visit as well, so a
   browser that blocks storage (a private window) still works until the page is closed. */
function newsKey(which) { return STORE_PREFIX + 'news_' + which; }
function newsReadList(key) {
  try { const v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; }
  catch (e) { return []; }
}
function newsLoadMarks() {
  if (!state.newsMarks) state.newsMarks = { saved: newsReadList(newsKey('saved')), dismissed: newsReadList(newsKey('dismissed')) };
  return state.newsMarks;
}
function newsStoreMarks(m) {
  state.newsMarks = m;
  try { localStorage.setItem(newsKey('saved'), JSON.stringify(m.saved)); localStorage.setItem(newsKey('dismissed'), JSON.stringify(m.dismissed)); }
  catch (e) { /* kept for this visit only */ }
}
/* save toggles, dismiss and restore set; each clears the other mark. */
function applyNewsMark(m, id, action) {
  const without = list => list.filter(x => x !== id);
  if (action === 'save') return m.saved.includes(id) ? { saved: without(m.saved), dismissed: m.dismissed } : { saved: m.saved.concat(id), dismissed: without(m.dismissed) };
  if (action === 'dismiss') return { saved: without(m.saved), dismissed: without(m.dismissed).concat(id) };
  if (action === 'restore') return { saved: m.saved, dismissed: without(m.dismissed) };
  return m;
}
/* The feed is everything not dismissed; Saved and Dismissed are the stories carrying those marks.
   A mark on a story that is not in the list (a filter, or a story since removed) is ignored, so
   a tab's count is always the number of stories on it. */
function newsTabSets(stories, m) {
  const s = new Set(m.saved), d = new Set(m.dismissed);
  return { feed: stories.filter(a => !d.has(a.id)), saved: stories.filter(a => s.has(a.id) && !d.has(a.id)), dismissed: stories.filter(a => d.has(a.id)) };
}

function newsMark(id, action) {
  newsStoreMarks(applyNewsMark(newsLoadMarks(), id, action));
  toast(action === 'save' ? (newsLoadMarks().saved.includes(id) ? 'Story saved on this device' : 'Save removed')
    : action === 'dismiss' ? 'Story dismissed. It is under Dismissed if you want it back' : 'Story restored');
  renderNews();
}
function saveNews(id) { newsMark(id, 'save'); }
function dismissNews(id) { newsMark(id, 'dismiss'); }
function restoreNews(id) { newsMark(id, 'restore'); }

function toggleNewsSource(name) {
  const off = state.newsSourcesOff || [];
  state.newsSourcesOff = off.includes(name) ? off.filter(x => x !== name) : off.concat(name);
  renderNews();
}
function toggleNewsMatched() { state.newsMatchedOnly = !state.newsMatchedOnly; renderNews(); }

/* What the filters leave, as the three sets the tabs read. Every tab narrows by the same
   province, search, sources and match switch; only the marks differ. */
function newsSets() {
  const base = newsFilter(allNews(), {
    province: state.newsProvince, term: state.newsSearch, sourcesOff: state.newsSourcesOff,
    matchedOnly: state.newsMatchedOnly, offtakers: state.offtakers,
  });
  return newsTabSets(base, newsLoadMarks());
}

/* The stories in scope for the topic counts, the Summary and the sidebar: the feed, without
   anything dismissed. The topic chip is applied separately, so the summary can count across
   all topics while the feed shows one. */
function newsInScope() { return newsSets().feed; }

function filteredNews() {
  const sets = newsSets();
  if (state.newsTopic === 'saved') return sets.saved;
  if (state.newsTopic === 'dismissed') return sets.dismissed;
  if (!state.newsTopic || state.newsTopic === 'all' || state.newsTopic === 'summary') return sets.feed;
  return sets.feed.filter(a => a.topic === state.newsTopic);
}

function setNewsTopic(t) { state.newsTopic = t; renderNews(); }
function setNewsProvince(p) { state.newsProvince = p === state.newsProvince ? '' : p; renderNews(); }

function renderNews() {
  const sets = newsSets();
  const scope = sets.feed;
  const news = allNews();
  const sampleCount = news.filter(a => a.sample).length;

  setPage('News', news.length + ' stories across ' + Object.keys(NEWS_TOPICS).length +
    ' topics · mining, power and PPA activity by province',
    '<button class="btn btn-outline btn-sm" onclick="exportNews()">' + icon('download', 14) + ' Export</button>');

  /* Tab row: All Topics, then Summary, then one tab per topic. Each topic
     counts the stories the search and the province filter leave in scope. */
  const topic = state.newsTopic || 'all';
  const topicTab = (id, label, count) => ({ label, count, active: topic === id, on: "setNewsTopic('" + id + "')" });
  const chips = viewTabsHtml(
    [topicTab('all', 'All Topics', scope.length), topicTab('summary', 'Summary')].concat(
      Object.entries(NEWS_TOPICS).map(([id, t]) => topicTab(id, t.label, scope.filter(a => a.topic === id).length)),
      [topicTab('saved', 'Saved', sets.saved.length), topicTab('dismissed', 'Dismissed', sets.dismissed.length)]));

  const toolbar =
    '<div class="toolbar">' +
      '<div class="search-wrap"><span class="search-icon">' + icon('search', 14) + '</span>' +
      '<input placeholder="Search headline, summary or province..." value="' + esc(state.newsSearch || '') + '" ' +
      'oninput="state.newsSearch=this.value;renderNews()"></div>' +
      '<select class="flt" onchange="state.newsProvince=this.value;renderNews()">' +
        '<option value="">All provinces</option>' +
        SA_PROVINCES.map(p => '<option value="' + esc(p) + '"' +
          (state.newsProvince === p ? ' selected' : '') + '>' + esc(p) + '</option>').join('') +
      '</select>' +
      '<span class="result-count">' + scope.length + ' in scope</span>' +
    '</div>';

  const banner = sampleCount
    ? '<div class="news-sample-banner">' + icon('alert', 14) +
      '<span><strong>Sample feed.</strong> These ' + sampleCount + ' stories are placeholders written to show the ' +
      'page working — they describe no real event, name no company and carry no link. Replace ' +
      '<code>data/news.js</code> once a real source is wired in.</span></div>'
    : '';

  const body = state.newsTopic === 'summary'
    ? newsSummaryHtml(scope)
    : '<div class="news-layout"><div class="news-feed">' + newsFeedHtml(filteredNews()) + '</div>' +
      '<div class="news-sidebar">' + newsFiltersHtml() + newsSidebarHtml(scope) + '</div></div>';

  setContent(banner + chips + toolbar + body);
  growBars();
}

function newsFeedHtml(list) {
  if (!list.length) {
    const t = state.newsTopic;
    return '<div class="empty"><div class="ei">' + icon('search', 30) + '</div>' +
      '<h3>' + (t === 'saved' ? 'Nothing saved yet' : t === 'dismissed' ? 'Nothing dismissed' : 'No stories match') + '</h3><p>' +
      (t === 'saved' ? 'Press Save on a story to keep it here. Saved stories are kept in this browser.'
        : t === 'dismissed' ? 'Dismissed stories leave the feed and wait here, in case you want one back.'
        : 'Loosen the topic, province, source or search filter to see more of the feed.') + '</p></div>';
  }
  const marks = newsLoadMarks();
  return list.map(a => newsCardHtml(a, marks)).join('');
}

/* The Filters card: which publishers to read, and whether to keep only stories that name a company
   on file. Save and Dismiss are kept in this browser, and the card says so. */
function newsFiltersHtml() {
  const off = state.newsSourcesOff || [];
  const sources = newsSourcesOf(allNews());
  return '<div class="news-side-card"><h4>Filters</h4>' +
    '<div class="news-filter-label">Sources</div>' +
    sources.map(s =>
      '<label class="news-check"><input type="checkbox"' + (off.includes(s.source) ? '' : ' checked') +
      ' onchange="toggleNewsSource(' + esc(JSON.stringify(s.source)) + ')"><span>' + esc(s.source) + '</span>' +
      '<span class="news-legend-n">' + s.n + '</span></label>').join('') +
    '<label class="news-check news-matched"><input type="checkbox"' + (state.newsMatchedOnly ? ' checked' : '') +
      ' onchange="toggleNewsMatched()"><span>Only stories that name an off-taker</span></label>' +
    '<div class="fg-hint" style="margin-top:8px">Save and Dismiss are kept in this browser, so a colleague does not see yours.</div>' +
  '</div>';
}

/* The badge carries the province — this desk sells by geography, so where a
   story happened matters more than who it happened to. */
function newsCardHtml(a, marks) {
  const t = newsTopicOf(a);
  const href = safeHref(a.url);
  const m = marks || { saved: [], dismissed: [] };
  const isSaved = m.saved.includes(a.id), isDismissed = m.dismissed.includes(a.id);
  const named = newsMatches(a, state.offtakers || []);
  return '<div class="news-card' + (isSaved ? ' saved' : '') + (isDismissed ? ' dismissed' : '') + '">' +
    '<div class="news-card-top">' +
      '<span class="news-province-badge">' + icon('pin', 11) + ' ' + esc(a.province) + '</span>' +
      '<span class="news-topic-tag" style="background:' + t.color + '22;color:' + t.color + ';border-color:' + t.color + '55">' +
        esc(t.label) + '</span>' +
      (a.sample ? '<span class="news-sample-tag">sample</span>' : '') +
      (a.auto ? '<span class="news-auto-tag" title="Found by the Daily AEEG News Scan, not curated by the desk">Auto</span>' : '') +
      '<span class="news-date">' + esc(a.date) + '</span>' +
    '</div>' +
    '<h3>' + esc(a.title) + '</h3>' +
    (a.summary ? '<p>' + esc(a.summary) + '</p>' : '') +
    (a.whyItMatters ? '<p class="news-why">Why it matters: ' + esc(a.whyItMatters) + '</p>' : '') +
    '<div class="news-card-footer">' +
      (href
        ? '<a href="' + esc(href) + '" target="_blank" rel="noopener">Read full article →</a>'
        : '<span class="news-nolink">No source link on this entry</span>') +
      (a.source ? '<span class="news-source">· ' + esc(a.source) + '</span>' : '') +
      '<span class="news-actions">' +
        (isDismissed
          ? '<button class="btn btn-xs btn-outline" onclick="restoreNews(' + esc(JSON.stringify(a.id)) + ')">Restore</button>'
          : '<button class="btn btn-xs btn-outline' + (isSaved ? ' on' : '') + '" onclick="saveNews(' + esc(JSON.stringify(a.id)) + ')">' + (isSaved ? 'Saved' : 'Save') + '</button>' +
            '<button class="btn btn-xs btn-outline" onclick="dismissNews(' + esc(JSON.stringify(a.id)) + ')">Dismiss</button>') +
      '</span>' +
    '</div>' +
    (named.length
      ? '<div class="news-matched">Names: ' + named.slice(0, 4).map(o => '<span class="news-chip" onclick="nav(\'detail\',{id:' + esc(JSON.stringify(o.id)) + '})">' + esc(o.short || o.name) + '</span>').join('') + '</div>'
      : '') +
  '</div>';
}

function newsSidebarHtml(scope) {
  const byTopic = countBy(scope, a => a.topic);
  const byProvince = countBy(scope, a => a.province);

  const topics = Object.entries(NEWS_TOPICS).map(([id, t]) =>
    '<div class="news-legend-row" onclick="setNewsTopic(\'' + id + '\')">' +
      '<span class="news-dot" style="background:' + t.color + '"></span>' +
      '<span style="flex:1">' + esc(t.label) + '</span>' +
      '<span class="news-legend-n">' + (byTopic[id] || 0) + '</span>' +
    '</div>').join('');

  /* "Multiple" tags the national stories. It is not one of the nine provinces, so it
     is counted here but cannot be picked: choosing a province leaves national stories out. */
  const provinces = NEWS_PROVINCES.filter(p => byProvince[p]).map(p => SA_PROVINCES.includes(p)
    ? '<div class="news-legend-row' + (state.newsProvince === p ? ' on' : '') + '" onclick="setNewsProvince(\'' + esc(p) + '\')">' +
        '<span style="flex:1">' + esc(p) + '</span>' +
        '<span class="news-legend-n">' + byProvince[p] + '</span>' +
      '</div>'
    : '<div class="news-legend-row" style="cursor:default">' +
        '<span style="flex:1">' + esc(p) + ' (national)</span>' +
        '<span class="news-legend-n">' + byProvince[p] + '</span>' +
      '</div>').join('');

  return '<div class="news-side-card"><h4>Topics</h4>' + topics + '</div>' +
    '<div class="news-side-card"><h4>Provinces</h4>' + (provinces ||
      '<div style="font-size:12px;color:var(--muted)">Nothing in scope</div>') + '</div>';
}

/* ═══════════════════════════════════════════════════════════════
   SUMMARY — the same stories, read as a briefing rather than a feed
   ═══════════════════════════════════════════════════════════════ */
function newsSummaryHtml(scope) {
  if (!scope.length) {
    return '<div class="empty"><div class="ei">' + icon('note', 30) + '</div>' +
      '<h3>Nothing to summarise</h3><p>Clear the province or search filter to bring stories back into scope.</p></div>';
  }

  const byTopic = countBy(scope, a => a.topic);
  const byProvince = countBy(scope, a => a.province);
  const topTopic = Object.entries(byTopic).sort((a, b) => b[1] - a[1])[0];
  const topProvince = Object.entries(byProvince).sort((a, b) => b[1] - a[1])[0];
  const dealFlow = scope.filter(a => a.topic === 'new_ppa' || a.topic === 'renewals').length;
  const scopeLabel = (state.newsProvince || 'every province') + (state.newsSearch ? ' · matching your search' : '');

  const stats =
    '<div class="stats-grid">' +
      statTile('note', 'blue', 'Stories in scope', scope.length, esc(scopeLabel)) +
      statTile('target', 'green', 'Deal-flow signals', dealFlow, 'new agreements and renewals') +
      statTile('grid', 'amber', 'Busiest topic', topTopic ? NEWS_TOPICS[topTopic[0]].label : '—',
        topTopic ? topTopic[1] + ' of ' + scope.length + ' stories' : '') +
      statTile('pin', 'purple', 'Busiest province', topProvince ? topProvince[0] : '—',
        topProvince ? topProvince[1] + ' stor' + (topProvince[1] === 1 ? 'y' : 'ies') : '') +
    '</div>';

  const bars = (counts, labelFor, colorFor) => {
    const max = Math.max(...Object.values(counts), 1);
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) =>
      '<div class="news-bar-row">' +
        '<div class="news-bar-label">' + esc(labelFor(k)) + '</div>' +
        '<div class="fit-bar"><span data-w="' + Math.round(n / max * 100) + '" ' +
          'style="background:' + colorFor(k) + '"></span></div>' +
        '<div class="news-bar-n">' + n + '</div>' +
      '</div>').join('');
  };

  const breakdown =
    '<div class="card-grid">' +
      '<div class="card"><div class="card-header"><div><div class="card-title">By topic</div>' +
        '<div class="card-sub">What the market is talking about</div></div></div>' +
        bars(byTopic, k => NEWS_TOPICS[k] ? NEWS_TOPICS[k].label : k, k => (NEWS_TOPICS[k] || {}).color || 'var(--muted)') +
      '</div>' +
      '<div class="card"><div class="card-header"><div><div class="card-title">By province</div>' +
        '<div class="card-sub">Where it is happening</div></div></div>' +
        bars(byProvince, k => k, () => 'var(--accent)') +
      '</div>' +
    '</div>';

  /* Stories grouped under their topic, busiest topic first — the body of
     the briefing, so a reader can go from the counts straight to the lines. */
  const groups = Object.entries(byTopic).sort((a, b) => b[1] - a[1]).map(([topicId, n]) => {
    const t = NEWS_TOPICS[topicId] || { label: topicId, color: 'var(--muted)' };
    const rows = scope.filter(a => a.topic === topicId).map(a =>
      '<div class="news-sum-row">' +
        '<div class="news-sum-date">' + esc(a.date) + '</div>' +
        '<div style="min-width:0;flex:1">' +
          '<div class="news-sum-title">' + esc(a.title) + '</div>' +
          (a.whyItMatters ? '<div class="news-sum-why">' + esc(a.whyItMatters) + '</div>' : '') +
        '</div>' +
        '<span class="news-province-badge">' + esc(a.province) + '</span>' +
      '</div>').join('');
    return '<div class="card">' +
      '<div class="card-header"><div class="card-title">' +
        '<span class="news-dot" style="background:' + t.color + '"></span> ' + esc(t.label) + '</div>' +
        '<span class="badge b-prospect">' + n + '</span></div>' + rows + '</div>';
  }).join('');

  return stats + breakdown + groups;
}

function countBy(list, keyFn) {
  const out = {};
  list.forEach(x => { const k = keyFn(x); if (k) out[k] = (out[k] || 0) + 1; });
  return out;
}

function exportNews() {
  const head = ['date', 'topic', 'province', 'title', 'summary', 'why_it_matters', 'source', 'url', 'sample', 'auto'];
  const rows = [head].concat(filteredNews().map(a => [
    a.date, newsTopicOf(a).label, a.province, a.title, a.summary,
    a.whyItMatters || '', a.source || '', a.url || '', a.sample ? 'yes' : 'no', a.auto ? 'yes' : 'no',
  ]));
  downloadCSV('aee-news-' + todayISO() + '.csv', rows);
  toast('Exported ' + (rows.length - 1) + ' stories');
}
