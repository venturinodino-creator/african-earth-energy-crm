/* ═══════════════════════════════════════════════════════════════════
   News — mining-industry stories the desk reads before it dials.

   One feed, filtered by topic along the chip row and by province down the
   side. The Summary chip swaps the feed for an executive read of the same
   filtered set, so the two never disagree about what is in scope.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

function newsTopicOf(a) { return NEWS_TOPICS[a.topic] || { label: 'News', color: '#7a90a8' }; }

/* Everything matching the province and search filters. The topic chip is
   applied separately, so the summary can count across all topics while the
   feed shows one. */
function newsInScope() {
  const term = (state.newsSearch || '').toLowerCase();
  return NEWS_ARTICLES.filter(a => {
    if (state.newsProvince && a.province !== state.newsProvince) return false;
    if (term && !(a.title + ' ' + a.summary + ' ' + (a.whyItMatters || '') + ' ' + a.province)
      .toLowerCase().includes(term)) return false;
    return true;
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function filteredNews() {
  const list = newsInScope();
  if (!state.newsTopic || state.newsTopic === 'all' || state.newsTopic === 'summary') return list;
  return list.filter(a => a.topic === state.newsTopic);
}

function setNewsTopic(t) { state.newsTopic = t; renderNews(); }
function setNewsProvince(p) { state.newsProvince = p === state.newsProvince ? '' : p; renderNews(); }

function renderNews() {
  const scope = newsInScope();
  const sampleCount = NEWS_ARTICLES.filter(a => a.sample).length;

  setPage('News', NEWS_ARTICLES.length + ' stories across ' + Object.keys(NEWS_TOPICS).length +
    ' topics · mining, power and PPA activity by province',
    '<button class="btn btn-outline btn-sm" onclick="exportNews()">' + icon('download', 14) + ' Export</button>');

  /* Chip row: All Topics, then Summary, then one chip per topic —
     the order in the reference design. */
  const chip = (id, label) => '<button class="news-filter-btn' + (state.newsTopic === id ? ' active' : '') +
    '" onclick="setNewsTopic(\'' + id + '\')">' + esc(label) + '</button>';

  const summaryChip = '<button class="news-summary-btn' + (state.newsTopic === 'summary' ? ' active' : '') +
    '" onclick="setNewsTopic(\'summary\')" title="Executive read of the stories currently in scope">' +
    icon('note', 13) + ' Summary</button>';

  const chips = '<div class="news-filter-bar">' +
    chip('all', 'All Topics') + summaryChip +
    Object.entries(NEWS_TOPICS).map(([id, t]) => chip(id, t.label)).join('') +
    '</div>';

  const toolbar =
    '<div class="toolbar">' +
      '<div class="search-wrap"><span class="search-icon">' + icon('search', 14) + '</span>' +
      '<input placeholder="Search headline, summary or province..." value="' + esc(state.newsSearch || '') + '" ' +
      'oninput="state.newsSearch=this.value;renderNews()"></div>' +
      '<select class="flt" onchange="state.newsProvince=this.value;renderNews()">' +
        '<option value="">All provinces</option>' +
        NEWS_PROVINCES.map(p => '<option value="' + esc(p) + '"' +
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
      '<div class="news-sidebar">' + newsSidebarHtml(scope) + '</div></div>';

  setContent(banner + chips + toolbar + body);
  growBars();
}

function newsFeedHtml(list) {
  if (!list.length) {
    return '<div class="empty"><div class="ei">' + icon('search', 30) + '</div>' +
      '<h3>No stories match</h3><p>Loosen the topic, province or search filter to see more of the feed.</p></div>';
  }
  return list.map(newsCardHtml).join('');
}

/* The badge carries the province — this desk sells by geography, so where a
   story happened matters more than who it happened to. */
function newsCardHtml(a) {
  const t = newsTopicOf(a);
  const href = safeHref(a.url);
  return '<div class="news-card">' +
    '<div class="news-card-top">' +
      '<span class="news-province-badge">' + icon('pin', 11) + ' ' + esc(a.province) + '</span>' +
      '<span class="news-topic-tag" style="background:' + t.color + '22;color:' + t.color + ';border-color:' + t.color + '55">' +
        esc(t.label) + '</span>' +
      (a.sample ? '<span class="news-sample-tag">sample</span>' : '') +
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
    '</div>' +
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

  const provinces = NEWS_PROVINCES.filter(p => byProvince[p]).map(p =>
    '<div class="news-legend-row' + (state.newsProvince === p ? ' on' : '') + '" onclick="setNewsProvince(\'' + esc(p) + '\')">' +
      '<span style="flex:1">' + esc(p) + '</span>' +
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
    '<div class="cols-2">' +
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
  const head = ['date', 'topic', 'province', 'title', 'summary', 'why_it_matters', 'source', 'url', 'sample'];
  const rows = [head].concat(filteredNews().map(a => [
    a.date, newsTopicOf(a).label, a.province, a.title, a.summary,
    a.whyItMatters || '', a.source || '', a.url || '', a.sample ? 'yes' : 'no',
  ]));
  downloadCSV('aee-news-' + todayISO() + '.csv', rows);
  toast('Exported ' + (rows.length - 1) + ' stories');
}
