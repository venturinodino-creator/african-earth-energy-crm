/* ═══════════════════════════════════════════════════════════════════
   Sectors · Prospects
   The sector taxonomy the desk works to, and the long prospecting list
   that feeds the offtaker pipeline.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* ═══════════════════════════════════════════════════════════════
   SECTORS — 29 non-mining sectors plus mining, each with the load
   shape, deal structures and contacts that suit it.
   ═══════════════════════════════════════════════════════════════ */
function renderSectors() {
  const tierCounts = { 1: 0, 2: 0, 3: 0 };
  ALL_SECTORS.forEach(s => { tierCounts[s.tier] = (tierCounts[s.tier] || 0) + 1; });

  setPage('Sectors', ALL_SECTORS.length + ' sectors · ' + SUB_SECTORS.length + ' sub-sectors · market as at ' + MARKET.asAt,
    viewToggle('sectorView') +
    '<button class="btn btn-outline btn-sm" onclick="nav(\'prospects\')">' + icon('target', 14) + ' Prospect list</button>');

  const list = ALL_SECTORS
    .filter(s => !state.sectorTier || String(s.tier) === String(state.sectorTier))
    .filter(s => !state.sectorGroup || s.group === state.sectorGroup)
    .filter(s => !state.sectorSearch ||
      (s.name + ' ' + s.why + ' ' + s.subSectors.join(' ')).toLowerCase().includes(state.sectorSearch.toLowerCase()))
    .sort((a, b) => a.tier - b.tier || b.ppaFit - a.ppaFit || a.name.localeCompare(b.name));

  const toolbar =
    '<div class="toolbar">' +
      '<div class="search-wrap"><span class="search-icon">' + icon('search', 14) + '</span>' +
      '<input placeholder="Search sector or sub-sector..." value="' + esc(state.sectorSearch) + '" ' +
      'oninput="state.sectorSearch=this.value;renderSectors()"></div>' +
      '<select class="flt" onchange="state.sectorTier=this.value;renderSectors()">' +
        '<option value="">All tiers</option>' +
        [1, 2, 3].map(t => '<option value="' + t + '"' + (String(state.sectorTier) === String(t) ? ' selected' : '') + '>' +
          'Tier ' + t + ' (' + tierCounts[t] + ')</option>').join('') +
      '</select>' +
      '<select class="flt" onchange="state.sectorGroup=this.value;renderSectors()">' +
        '<option value="">All groups</option>' +
        Object.entries(SECTOR_GROUPS).map(([k, v]) =>
          '<option value="' + k + '"' + (state.sectorGroup === k ? ' selected' : '') + '>' + esc(v) + '</option>').join('') +
      '</select>' +
      '<span class="result-count">' + list.length + ' sector' + (list.length === 1 ? '' : 's') + '</span>' +
    '</div>';

  const stats =
    '<div class="stats-grid">' +
      statTile('target', 'green', 'Tier 1 — prospect now', tierCounts[1], 'shortest path to a signature') +
      statTile('pipeline', 'amber', 'Tier 2 — real pipeline', tierCounts[2], 'longer cycle, still worth resourcing') +
      statTile('list', 'blue', 'Tier 3 — opportunistic', tierCounts[3], 'inbound or bundled only') +
      statTile('building', 'purple', 'Companies', state.offtakers.length, 'across every sector') +
    '</div>';

  if (!list.length) {
    setContent(stats + toolbar + '<div class="empty"><div class="ei">' + icon('search', 30) + '</div>' +
      '<h3>No sectors match</h3><p>Loosen the tier or group filter to see more of the taxonomy.</p></div>');
    return;
  }

  setContent(stats + toolbar + (state.sectorView === 'table'
    ? sectorTableHtml(list)
    : '<div class="ent-grid">' + list.map(sectorCardHtml).join('') + '</div>'));
}

function sectorCardHtml(s) {
  const promoted = state.offtakers.filter(o => o.sector === s.id).length;
  return '<div class="sector-card" onclick="nav(\'sector\',{id:\'' + s.id + '\'})">' +
      '<div class="ec-head">' +
        '<div style="min-width:0">' +
          '<h3>' + esc(s.name) + '</h3>' +
          '<div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-top:4px">' +
            '<span class="badge b-tier-' + s.tier + '">Tier ' + s.tier + '</span>' +
            '<span class="badge b-grp-' + s.group + '">' + esc(SECTOR_GROUPS[s.group] || s.group) + '</span>' +
          '</div>' +
        '</div>' +
        '<div style="text-align:right;flex-shrink:0">' + ppaDots(s.ppaFit) +
        '<div style="font-size:8.5px;color:var(--muted);font-weight:700;letter-spacing:.4px;text-transform:uppercase;margin-top:3px">PPA fit</div></div>' +
      '</div>' +
      '<div class="sector-facts">' +
        '<div class="sector-fact"><div class="sector-fact-v">' + esc(s.loadMw) + ' MW</div><div class="sector-fact-l">Typical load</div></div>' +
        '<div class="sector-fact"><div class="sector-fact-v">' + esc(s.dealMw) + ' MW</div><div class="sector-fact-l">Typical deal</div></div>' +
        '<div class="sector-fact"><div class="sector-fact-v">' + esc(s.cycleMonths) + ' mo</div><div class="sector-fact-l">Sales cycle</div></div>' +
        '<div class="sector-fact"><div class="sector-fact-v">' + esc(s.solarMatch) + '</div><div class="sector-fact-l">Solar match</div></div>' +
      '</div>' +
      '<div class="sector-why">' + esc(s.profile) + '</div>' +
      '<div class="ec-footer">' +
        '<span>' + promoted + ' named prospect' + (promoted === 1 ? '' : 's') + '</span>' +
        '<span>' + (SECTOR_QUESTIONS[s.id] || []).length + ' questions · ' + (SECTOR_OBJECTIONS[s.id] || []).length + ' objections</span>' +
      '</div>' +
    '</div>';
}

/* The same taxonomy read as a ranking sheet: tier order first, which is the
   order the desk works the market in. */
function sectorTableHtml(list) {
  return '<div class="table-wrap"><table><thead><tr>' +
    '<th>Sector</th><th>Tier</th><th>Group</th><th>PPA fit</th>' +
    '<th>Typical load</th><th>Typical deal</th><th>Sales cycle</th><th>Solar match</th>' +
    '<th class="num">Prospects</th><th class="num">Offtakers</th>' +
    '</tr></thead><tbody>' +
    list.map(s => {
      const promoted = state.offtakers.filter(o => o.sector === s.id).length;
      const tracked = state.offtakers.filter(o => o.sector === s.id).length;
      return '<tr class="clickable" onclick="nav(\'sector\',{id:\'' + s.id + '\'})">' +
        '<td><div class="name-cell"><span style="opacity:.6;display:flex">' + sectorIcon(s.id, 15) + '</span>' +
          '<div><div style="font-weight:700">' + esc(s.name) + '</div>' +
          '<div style="font-size:10.5px;color:var(--muted)">' + esc(s.profile) + '</div></div></div></td>' +
        '<td><span class="badge b-tier-' + s.tier + '">Tier ' + s.tier + '</span></td>' +
        '<td><span class="badge b-grp-' + s.group + '">' + esc(SECTOR_GROUPS[s.group] || s.group) + '</span></td>' +
        '<td>' + ppaDots(s.ppaFit) + '</td>' +
        '<td>' + esc(s.loadMw) + ' MW</td>' +
        '<td>' + esc(s.dealMw) + ' MW</td>' +
        '<td>' + esc(s.cycleMonths) + ' mo</td>' +
        '<td>' + esc(s.solarMatch) + '</td>' +
        '<td class="num">' + promoted + '</td>' +
        '<td class="num">' + tracked + '</td>' +
      '</tr>';
    }).join('') + '</tbody></table></div>';
}

/* ─── ONE SECTOR ──────────────────────────────────────────────── */
function renderSector() {
  const s = sectorOf(state.sectorId);
  if (!s) { nav('sectors'); return; }

  const questions = SECTOR_QUESTIONS[s.id] || [];
  const objections = SECTOR_OBJECTIONS[s.id] || [];
  const offtakers = state.offtakers.filter(o => o.sector === s.id);
  const subs = SUB_SECTORS.filter(x => x.sectorId === s.id);

  setPage(s.name, 'Tier ' + s.tier + ' · ' + (SECTOR_GROUPS[s.group] || s.group) + ' · PPA fit ' + s.ppaFit + '/5',
    '<button class="btn btn-outline btn-sm" onclick="nav(\'sectors\')">All sectors</button>');

  const hero =
    '<div class="detail-hero">' +
      '<div class="dh-top">' +
        '<div class="dh-icon">' + sectorIcon(s.id, 24) + '</div>' +
        '<div style="flex:1;min-width:240px">' +
          '<div class="dh-title">' + esc(s.name) + '</div>' +
          '<div class="dh-sub">' +
            '<span class="badge b-tier-' + s.tier + '">Tier ' + s.tier + '</span>' +
            '<span class="badge b-grp-' + s.group + '">' + esc(SECTOR_GROUPS[s.group] || s.group) + '</span>' +
            ppaDots(s.ppaFit) +
          '</div>' +
          '<p style="font-size:12.5px;color:var(--muted2);line-height:1.6;margin-top:10px;max-width:74ch">' + esc(s.why) + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="dh-metrics">' +
        dhMetric(esc(s.loadMw) + ' MW', 'Typical site load') +
        dhMetric(esc(s.annualGwh) + ' GWh', 'Annual use') +
        dhMetric(esc(s.dealMw) + ' MW', 'Typical deal', true) +
        dhMetric(esc(s.cycleMonths) + ' mo', 'Sales cycle') +
        dhMetric(esc(s.solarMatch), 'Solar self-match') +
        dhMetric(prospects.length, 'Named prospects', true) +
      '</div>' +
    '</div>';

  const shape =
    '<div class="card">' +
      '<div class="card-header"><div class="card-title">Load &amp; connection</div></div>' +
      '<dl class="kv">' +
        '<dt>Load profile</dt><dd>' + esc(s.profile) + '</dd>' +
        '<dt>Solar self-match</dt><dd>' + esc(s.solarMatch) + '</dd>' +
        '<dt>Grid connection</dt><dd>' + esc(s.grid) + '</dd>' +
      '</dl>' +
      '<div class="form-section-title" style="margin-top:16px">Deal structures that work</div>' +
      '<ul class="check-list">' + s.structures.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
      '<div class="form-section-title" style="margin-top:16px">Buying triggers</div>' +
      '<ul class="check-list warn">' + s.triggers.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
    '</div>';

  const who =
    '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">Who to call</div>' +
      '<div class="card-sub">Ordered as they appear in the workbook</div></div></div>' +
      s.roles.map(title => {
        const role = CONTACT_ROLES.find(r => r.title === title);
        return '<div class="person-row">' +
          '<div class="av" style="width:24px;height:24px;font-size:9px;background:' + avatarColor(title) + '">' +
            esc((title[0] || '?').toUpperCase()) + '</div>' +
          '<div style="min-width:0;flex:1"><div class="person-name">' + esc(title) + '</div>' +
          '<div class="person-title">' + esc(STAKEHOLDER_WHY[title] || (role ? role.part.replace('-', ' ') : '')) + '</div></div>' +
        '</div>';
      }).join('') +
      (subs.length ? '<div class="form-section-title" style="margin-top:16px">Sub-sectors</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:5px">' +
        subs.map(x => '<span class="chip">' + esc(x.name) + '</span>').join('') + '</div>' : '') +
    '</div>';

  const qCard = questionsCardHtml(s.id, 'Ask these on the first call');
  const oCard = objectionsCardHtml(s.id);

  const worked = offtakers.filter(o => !isUnworked(o)).length;
  const listCard =
    '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">Companies (' + offtakers.length + ')</div>' +
      '<div class="card-sub">' + worked + ' with an established load</div></div>' +
      '<button class="btn btn-ghost btn-xs" onclick="state.offSector=\'' + s.id + '\';nav(\'offtakers\')">Open list</button></div>' +
      (offtakers.length
        ? offtakers.slice(0, 12).map(o => companyRowHtml(o)).join('') +
          (offtakers.length > 12 ? '<div class="fg-hint" style="margin-top:9px">and ' + (offtakers.length - 12) + ' more</div>' : '')
        : '<div class="fg-hint">No companies in this sector yet.</div>') +
    '</div>';

  /* Questions and objections are reference material — read once, then
     kept open on the call — so they sit at the bottom of the page,
     below the shape of the sector and the companies in it. */
  const reference = (qCard || oCard)
    ? '<div class="cols-2" style="margin-top:14px">' + qCard + oCard + '</div>'
    : '';

  setContent(hero +
    '<div class="cols-2">' +
      '<div style="display:flex;flex-direction:column;gap:14px">' + shape + who + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:14px">' + listCard + '</div>' +
    '</div>' + reference);
}

/* Shared with the offtaker detail page, so a rep sees the same
   sector guidance whether they came in via the account or the sector. */
function questionsCardHtml(sectorId, sub) {
  const questions = SECTOR_QUESTIONS[sectorId] || [];
  if (!questions.length) return '';
  return '<div class="card">' +
    '<div class="card-header"><div><div class="card-title">Qualifying questions (' + questions.length + ')</div>' +
    '<div class="card-sub">' + esc(sub || sectorName(sectorId)) + '</div></div>' +
    '<button class="btn btn-outline btn-xs" onclick="copyQuestions(\'' + sectorId + '\')">' + icon('copy', 12) + ' Copy</button></div>' +
    questions.map((q, i) =>
      '<div class="qa-item"><div class="qa-num">' + (i + 1) + '</div>' +
      '<div class="qa-text">' + esc(q) + '</div></div>').join('') +
  '</div>';
}

function objectionsCardHtml(sectorId) {
  const objections = SECTOR_OBJECTIONS[sectorId] || [];
  if (!objections.length) return '';
  return '<div class="card">' +
    '<div class="card-header"><div><div class="card-title">Objections you will hear (' + objections.length + ')</div>' +
    '<div class="card-sub">And what tends to work</div></div></div>' +
    objections.map(o =>
      '<div class="obj-item">' +
      '<div class="obj-q">' + icon('alert', 13) + '<span>' + esc(o.objection) + '</span></div>' +
      '<div class="obj-a">' + esc(o.response) + '</div></div>').join('') +
  '</div>';
}

function copyQuestions(sectorId) {
  const questions = SECTOR_QUESTIONS[sectorId] || [];
  const text = sectorName(sectorId) + ' — qualifying questions\n' +
    '─'.repeat(40) + '\n' +
    questions.map((q, i) => (i + 1) + '. ' + q).join('\n') +
    '\n\nOpening question, any account:\n' + MARKET.openingQuestion;
  navigator.clipboard.writeText(text)
    .then(() => toast('Questions copied'))
    .catch(() => toast('Could not copy to the clipboard', 'warn'));
}

/* One row per company, for the sector page. Says whether anyone has
   established a load yet, which is the only thing that now separates a
   fresh name from an account already being worked. */
function companyRowHtml(o) {
  return '<div class="person-row clickable" onclick="nav(\'detail\',{id:\'' + esc(o.id) + '\'})">' +
    '<div style="min-width:0;flex:1">' +
      '<div class="person-name">' + esc(o.short || o.name) + '</div>' +
      (o.description ? '<div class="person-title">' + esc(o.description) + '</div>' : '') +
    '</div>' +
    (isUnworked(o)
      ? '<span class="badge b-prospect">No load yet</span>'
      : '<span class="badge b-medium">' + fmtNum(o.annualGwh) + ' GWh/yr</span>') +
  '</div>';
}
