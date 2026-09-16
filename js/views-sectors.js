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
      statTile('building', 'purple', 'Named prospects', state.prospects.length, 'across every sector') +
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
  const promoted = state.prospects.filter(p => p.sectorId === s.id).length;
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
      const promoted = state.prospects.filter(p => p.sectorId === s.id).length;
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
  const prospects = state.prospects.filter(p => p.sectorId === s.id);
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

  const listCard =
    '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">Named companies (' + prospects.length + ')</div>' +
      '<div class="card-sub">' + offtakers.length + ' already being worked as offtakers</div></div>' +
      '<button class="btn btn-ghost btn-xs" onclick="state.prospectSector=\'' + s.id + '\';nav(\'prospects\')">Open list</button></div>' +
      (prospects.length ? prospects.slice(0, 12).map(p => prospectRowHtml(p)).join('') +
        (prospects.length > 12 ? '<div class="fg-hint" style="margin-top:9px">and ' + (prospects.length - 12) + ' more</div>' : '')
        : '<div class="fg-hint">No named companies in this sector yet.</div>') +
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

/* ═══════════════════════════════════════════════════════════════
   PROSPECTS — the long list. A prospect carries a name and a sector
   but no load data, so it is not ranked; it is worked through and
   promoted into an offtaker once the load is known.
   ═══════════════════════════════════════════════════════════════ */
const PROSPECT_STATUS = {
  new: 'Not started', researching: 'Researching', promoted: 'Promoted',
  parked: 'Parked', rejected: 'Not a fit',
};

function renderProspects() {
  const term = state.prospectSearch.toLowerCase();
  let list = state.prospects.filter(p => {
    if (term && !(p.name + ' ' + p.note + ' ' + sectorName(p.sectorId)).toLowerCase().includes(term)) return false;
    if (state.prospectSector && p.sectorId !== state.prospectSector) return false;
    if (state.prospectTier && String(sectorTier(p.sectorId)) !== String(state.prospectTier)) return false;
    if (state.prospectStatus && p.status !== state.prospectStatus) return false;
    if (state.prospectStage && sfStageFor(p) !== state.prospectStage) return false;
    return true;
  });
  list = list.sort((a, b) =>
    sectorTier(a.sectorId) - sectorTier(b.sectorId) ||
    (sectorOf(b.sectorId)?.ppaFit || 0) - (sectorOf(a.sectorId)?.ppaFit || 0) ||
    a.name.localeCompare(b.name));

  const open = state.prospects.filter(p => p.status === 'new').length;
  setPage('Prospects', state.prospects.length + ' named companies · ' + open + ' not yet started',
    viewToggle('prospectView') +
    '<button class="btn btn-outline btn-sm" onclick="exportProspects()">' + icon('download', 14) + ' Export</button>' +
    '<button class="btn btn-outline btn-sm" onclick="nav(\'sectors\')">' + icon('grid', 14) + ' Sectors</button>' +
    '<button class="btn btn-primary btn-sm" data-admin-only onclick="openAddProspect()">' +
      icon('plus', 14) + ' Add lead</button>');

  const counts = {};
  state.prospects.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });

  const stats =
    '<div class="stats-grid">' +
      statTile('target', 'green', 'Not started', counts.new || 0, 'still to be worked') +
      statTile('search', 'amber', 'Researching', counts.researching || 0, 'load data being gathered') +
      statTile('check', 'blue', 'Promoted', counts.promoted || 0, 'now tracked as offtakers') +
      statTile('list', 'purple', 'Tier 1 companies',
        state.prospects.filter(p => sectorTier(p.sectorId) === 1).length, 'in prospect-now sectors') +
    '</div>';

  const toolbar =
    '<div class="toolbar">' +
      '<div class="search-wrap"><span class="search-icon">' + icon('search', 14) + '</span>' +
      '<input placeholder="Search company or note..." value="' + esc(state.prospectSearch) + '" ' +
      'oninput="state.prospectSearch=this.value;state.prospectPage=1;renderProspects()"></div>' +
      '<select class="flt" onchange="state.prospectSector=this.value;state.prospectPage=1;renderProspects()">' +
        '<option value="">All sectors</option>' + sectorOptions(state.prospectSector) + '</select>' +
      '<select class="flt" onchange="state.prospectTier=this.value;state.prospectPage=1;renderProspects()">' +
        '<option value="">All tiers</option>' +
        [1, 2, 3].map(t => '<option value="' + t + '"' + (String(state.prospectTier) === String(t) ? ' selected' : '') +
          '>Tier ' + t + '</option>').join('') + '</select>' +
      '<select class="flt" onchange="state.prospectStatus=this.value;state.prospectPage=1;renderProspects()">' +
        '<option value="">Any status</option>' +
        Object.entries(PROSPECT_STATUS).map(([k, v]) =>
          '<option value="' + k + '"' + (state.prospectStatus === k ? ' selected' : '') + '>' + esc(v) + '</option>').join('') +
      '</select>' +
      '<select class="flt" onchange="state.prospectStage=this.value;state.prospectPage=1;renderProspects()">' +
        '<option value="">Any sales stage</option>' +
        SF_STAGES.map(st => '<option value="' + st.id + '"' +
          (state.prospectStage === st.id ? ' selected' : '') + '>' + esc(st.label) + '</option>').join('') +
      '</select>' +
      '<span class="result-count">' + list.length + ' result' + (list.length === 1 ? '' : 's') + '</span>' +
    '</div>';

  if (!list.length) {
    setContent(stats + toolbar + '<div class="empty"><div class="ei">' + icon('search', 30) + '</div>' +
      '<h3>No prospects match</h3><p>Loosen the filters to see more of the list.</p></div>');
    return;
  }

  const pages = Math.ceil(list.length / PER_PAGE);
  state.prospectPage = Math.min(Math.max(1, state.prospectPage), pages);
  const page = list.slice((state.prospectPage - 1) * PER_PAGE, state.prospectPage * PER_PAGE);

  const body = state.prospectView === 'grid'
    ? '<div class="ent-grid">' + page.map(prospectCardHtml).join('') + '</div>'
    : prospectTableHtml(page);

  setContent(stats + toolbar + body +
    (pages > 1 ? '<div class="pagination">' +
      '<button class="pg-btn" ' + (state.prospectPage === 1 ? 'disabled' : '') + ' onclick="state.prospectPage--;renderProspects()">Previous</button>' +
      '<span class="pg-info">Page ' + state.prospectPage + ' of ' + pages + '</span>' +
      '<button class="pg-btn" ' + (state.prospectPage === pages ? 'disabled' : '') + ' onclick="state.prospectPage++;renderProspects()">Next</button>' +
    '</div>' : '') +
    '<div class="fg-hint" style="margin-top:12px">Prospects carry a name and a sector but no load data, so they are not ' +
    'fit-scored. Convert one to an offtaker once you know roughly what it consumes — that is when it starts being ranked.</div>');
}

function prospectCardHtml(p) {
  const s = sectorOf(p.sectorId);
  const promotedTo = p.promotedTo ? getOfftaker(p.promotedTo) : null;
  return '<div class="ec clickable" onclick="nav(\'prospect\',{id:\'' + esc(p.id) + '\'})">' +
    '<div class="ec-head">' +
      '<div class="ec-icon">' + sectorIcon(p.sectorId, 18) + '</div>' +
      '<span class="badge ' + (p.status === 'promoted' ? 'b-contracted' : p.status === 'new' ? 'b-prospect' : 'b-medium') + '">' +
        esc(PROSPECT_STATUS[p.status] || p.status) + '</span>' +
      sfStageBadge(p) +
    '</div>' +
    '<h3>' + esc(p.name) + '</h3>' +
    (p.note ? '<div class="short">' + esc(p.note) + '</div>' : '') +
    /* The switchboard and who to ask for. contactLineHtml lives in
       views-regions.js and is shared so a prospect reads the same way
       here as it does in a site catchment. */
    contactLineHtml(p) +
    /* The overview, source and approach notes all live on the profile
       now — the card stays a scanning summary and says whether there is
       anything written to open. */
    '<div style="font-size:10.5px;color:var(--muted);margin-top:6px">' +
      (p.blurb ? icon('note', 11) + ' Overview written' : 'No overview yet') + '</div>' +
    '<div class="meta" style="margin-top:6px">' + icon('grid', 13) +
      '<span class="ext-link" style="cursor:pointer" onclick="event.stopPropagation();nav(\'sector\',{id:\'' + esc(p.sectorId) + '\'})">' +
      esc(sectorName(p.sectorId)) + '</span></div>' +
    '<div class="fit-row"><span>Tier ' + sectorTier(p.sectorId) + '</span>' + ppaDots(s ? s.ppaFit : 0) + '</div>' +
    '<div class="ec-footer">' +
      '<span>' + esc(SECTOR_GROUPS[sectorGroup(p.sectorId)] || '—') + '</span>' +
      '<div style="display:flex;gap:4px">' +
        (promotedTo && promotedTo.id
          ? '<button class="btn btn-xs btn-outline" onclick="event.stopPropagation();nav(\'detail\',{id:\'' + promotedTo.id + '\'})">Open offtaker</button>'
          : '<button class="btn btn-xs btn-primary" data-admin-only onclick="event.stopPropagation();promoteProspect(\'' + p.id + '\')">' +
            icon('plus', 11) + ' Convert</button>') +
      '</div>' +
    '</div>' +
  '</div>';
}

function prospectTableHtml(page) {
  return '<div class="table-wrap"><table><thead><tr>' +
      '<th>Company</th><th>Sector</th><th>Tier</th><th>PPA fit</th><th>Sales stage</th><th>Status</th><th>Actions</th>' +
    '</tr></thead><tbody>' +
    page.map(p => {
      const s = sectorOf(p.sectorId);
      const promotedTo = p.promotedTo ? getOfftaker(p.promotedTo) : null;
      return '<tr class="clickable" onclick="nav(\'prospect\',{id:\'' + esc(p.id) + '\'})">' +
        '<td><div style="font-weight:700">' + esc(p.name) + '</div>' +
          (p.note ? '<div style="font-size:10.5px;color:var(--muted)">' + esc(p.note) + '</div>' : '') +
          /* Table is the default view, so the number has to be here and
             not only on the card — this is the list a rep works down. */
          (p.phone ? '<div style="font-size:10.5px;margin-top:2px">' +
            '<a href="tel:' + esc(p.phone.replace(/\s/g, '')) + '" class="ext-link" onclick="event.stopPropagation()">' +
            esc(p.phone) + '</a></div>' : '') + '</td>' +
        '<td><span class="ext-link" style="cursor:pointer" onclick="event.stopPropagation();nav(\'sector\',{id:\'' + esc(p.sectorId) + '\'})">' +
          esc(sectorName(p.sectorId)) + '</span></td>' +
        '<td><span class="badge b-tier-' + sectorTier(p.sectorId) + '">' + sectorTier(p.sectorId) + '</span></td>' +
        '<td>' + ppaDots(s ? s.ppaFit : 0) + '</td>' +
        '<td>' + sfStageBadge(p) + '</td>' +
        '<td><span class="badge ' + (p.status === 'promoted' ? 'b-contracted' : p.status === 'new' ? 'b-prospect' : 'b-medium') + '">' +
          esc(PROSPECT_STATUS[p.status] || p.status) + '</span></td>' +
        '<td style="white-space:nowrap">' +
          (promotedTo && promotedTo.id
            ? '<button class="btn btn-xs btn-outline" onclick="event.stopPropagation();nav(\'detail\',{id:\'' + promotedTo.id + '\'})">Open offtaker</button>'
            : '<button class="btn btn-xs btn-primary" data-admin-only onclick="event.stopPropagation();promoteProspect(\'' + p.id + '\')">' +
              icon('plus', 11) + ' Convert</button>') +
        '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

function prospectRowHtml(p) {
  return '<div class="person-row clickable" onclick="nav(\'prospect\',{id:\'' + esc(p.id) + '\'})">' +
    '<div style="min-width:0;flex:1">' +
      '<div class="person-name">' + esc(p.name) + '</div>' +
      (p.note ? '<div class="person-title">' + esc(p.note) + '</div>' : '') +
    '</div>' +
    '<span class="badge ' + (p.status === 'promoted' ? 'b-contracted' : 'b-prospect') + '">' +
      esc(PROSPECT_STATUS[p.status] || p.status) + '</span>' +
  '</div>';
}

/* Promote a prospect into a working offtaker. Everything the taxonomy
   knows carries across; the load figures are left blank because they are
   exactly what the rep has to go and find out. */
async function promoteProspect(id) {
  const p = state.prospects.find(x => x.id === id);
  if (!p) return;
  if (state.role !== 'admin') { toast('Read-only access — ask an admin to convert this', 'warn'); return; }

  const s = sectorOf(p.sectorId);
  /* Where the lead had got to in the sales process comes with it — a lead
     already at Proposal is not a fresh prospect, and having to re-set the
     stage by hand is how a board quietly stops matching reality. */
  const stage = sfStageFor(p);
  const offtaker = {
    id: 'off-' + p.id.replace(/^p-/, '').slice(0, 48),
    name: p.name, short: p.name.split(/[—(,/]/)[0].trim().slice(0, 40),
    sector: p.sectorId, province: p.province || '', city: p.town || '', website: p.website || '',
    /* The load band stays behind: it is an estimate with a basis, and the
       offtaker record's figures are the established ones a quote is built
       on. Finding them is the job the promotion creates. */
    annualGwh: 0, peakMw: 0, tariff: MARKET_MEGAFLEX_MID, nmd: 0,
    supply: 'eskom', wheeling: 'unknown',
    sfStage: stage,
    status: (sfStageOf(stage) || {}).status || 'prospect',
    priority: s && s.tier === 1 ? 'high' : s && s.tier === 2 ? 'medium' : 'low',
    description: p.note ? p.note + ' — promoted from the ' + sectorName(p.sectorId) + ' prospect list.' : '',
    estimated: true,
  };
  state.offtakers.push(offtaker);
  p.status = 'promoted';
  p.promotedTo = offtaker.id;

  /* Opportunities and logged calls belong to the company, not to the row
     that happened to hold it, so they follow it across. */
  const moved = dealsForProspect(p.id);
  moved.forEach(d => { d.offtakerId = offtaker.id; d.prospectId = ''; });
  const movedLogs = interactionsForProspect(p.id);
  movedLogs.forEach(i => { i.offtakerId = offtaker.id; i.prospectId = ''; });

  /* Move the screen before syncing. Local state is already correct, and
     awaiting four round-trips first meant the user clicked Convert and
     watched nothing happen for seconds — longer, or for ever, when the
     network is slow or down. guardWrite still surfaces a failed write. */
  save();
  toast('Converted — add the load figures to start ranking it');
  nav('detail', { id: offtaker.id });

  await pushOfftaker(offtaker);
  await pushProspect(p);
  await Promise.all(moved.map(d => pushDeal(d)));
  await Promise.all(movedLogs.map(i => pushInteraction(i)));
}

function exportProspects() {
  const head = ['company', 'sector', 'tier', 'group', 'ppa_fit', 'sales_stage', 'status', 'note', 'promoted_to'];
  const rows = [head].concat(state.prospects.map(p => {
    const s = sectorOf(p.sectorId);
    return [p.name, sectorName(p.sectorId), sectorTier(p.sectorId),
      SECTOR_GROUPS[sectorGroup(p.sectorId)] || '', s ? s.ppaFit : '',
      sfStageLabel(p), PROSPECT_STATUS[p.status] || p.status, p.note, p.promotedTo || ''];
  }));
  downloadCSV('aee-prospects-' + todayISO() + '.csv', rows);
  toast('Exported ' + state.prospects.length + ' prospects');
}
