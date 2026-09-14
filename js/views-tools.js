/* ═══════════════════════════════════════════════════════════════════
   Projects · Map · Analytics · Savings calculator · Playbook · Activity
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* ═══════════════════════════════════════════════════════════════
   PROJECTS — AEE's own generation portfolio, and what is left to sell
   ═══════════════════════════════════════════════════════════════ */
function renderProjects() {
  const live = state.projects.filter(p => p.status !== 'pipeline');
  const total = live.reduce((s, p) => s + num(p.mw), 0);
  const pipelineOnly = state.projects.filter(p => p.status === 'pipeline').reduce((s, p) => s + num(p.mw), 0);

  setPage('Generation portfolio', fmtNum(total) + ' MW in development plus ' + fmtNum(pipelineOnly) + ' MW early-stage', '');

  const cards = state.projects.map(p => {
    const committed = state.deals.filter(d => d.projectId === p.id && d.stage !== 'lost').reduce((s, d) => s + num(d.mw), 0);
    const signed = state.deals.filter(d => d.projectId === p.id && d.stage === 'signed').reduce((s, d) => s + num(d.mw), 0);
    const pct = Math.min(100, (committed / Math.max(1, p.mw)) * 100);
    const buyers = state.deals.filter(d => d.projectId === p.id).map(d => getOfftaker(d.offtakerId).short).filter(Boolean);
    return '<div class="ec" style="cursor:default">' +
      '<div class="ec-head">' +
        '<div class="ec-icon">' + icon('sun', 18) + '</div>' +
        '<div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">' +
          '<span class="badge b-solar">Solar PV</span><span class="badge b-bess">BESS</span>' +
        '</div>' +
      '</div>' +
      '<h3>' + esc(p.name) + '</h3>' +
      '<div class="meta">' + icon('pin', 13) + esc(p.town) + ', ' + esc(p.province) + ' · COD ' + esc(p.cod) + '</div>' +
      '<div class="ec-metrics">' +
        '<div class="ec-metric"><div class="ec-metric-v">' + fmtNum(p.mw) + '</div><div class="ec-metric-l">MW capacity</div></div>' +
        '<div class="ec-metric"><div class="ec-metric-v">' + fmtNum(Math.max(0, p.mw - committed)) + '</div><div class="ec-metric-l">MW unsold</div></div>' +
        '<div class="ec-metric"><div class="ec-metric-v">' + fmtNum(Math.round(num(p.mw) * 8760 * CAPACITY_FACTOR / 1000)) + '</div><div class="ec-metric-l">GWh / yr</div></div>' +
        '<div class="ec-metric"><div class="ec-metric-v">' + fmtNum(signed) + '</div><div class="ec-metric-l">MW signed</div></div>' +
      '</div>' +
      '<div class="fit-row"><span>Allocated</span><span style="color:' + (pct >= 90 ? 'var(--danger)' : pct >= 50 ? 'var(--accent2)' : 'var(--accent)') + '">' + Math.round(pct) + '%</span></div>' +
      '<div class="fit-bar"><span data-w="' + pct + '" style="background:' + (pct >= 90 ? 'var(--danger)' : pct >= 50 ? 'var(--accent2)' : 'var(--accent)') + '"></span></div>' +
      '<div style="font-size:11.5px;color:var(--muted2);line-height:1.55;margin-top:11px">' + esc(p.note) + '</div>' +
      (buyers.length ? '<div class="ec-footer"><span style="font-size:10.5px">In discussion: ' + esc(buyers.join(', ')) + '</span></div>' : '') +
    '</div>';
  }).join('');

  setContent(
    '<div class="stats-grid">' +
      statTile('sun', 'amber', 'Portfolio', fmtNum(total) + ' MW', live.length + ' named sites') +
      statTile('check', 'green', 'Contracted', fmtNum(contractedMw()) + ' MW', 'signed PPAs') +
      statTile('pipeline', 'blue', 'Under discussion', fmtNum(pipelineMw()) + ' MW', 'across the open pipeline') +
      statTile('target', 'purple', 'Still to sell', fmtNum(Math.max(0, total - contractedMw() - pipelineMw())) + ' MW', 'uncommitted capacity') +
    '</div>' +
    '<div class="ent-grid">' + cards + '</div>');
  growBars();
}

/* ═══════════════════════════════════════════════════════════════
   MAP — offtakers against generation sites
   ═══════════════════════════════════════════════════════════════ */
let _map = null, _mapLayers = [];

/* Matches the .b-grp-* badge palette in styles.css, so a group reads the
   same colour on the map as it does on a card. */
const GROUP_COLOR = {
  'heavy-industry': '#fca5a5', 'manufacturing': '#fbbf5c', 'commercial': '#c4b5fd',
  'digital': '#f9a8d4', 'logistics': '#7dd3fc', 'utilities-public': '#cbd5e1',
  'primary': '#86efac', 'emerging': '#5eead4',
};

function renderMap() {
  setPage('Map', 'Offtaker load against generation sites across South Africa', '');
  /* Filter by sector GROUP, not by sector — thirty chips would not fit,
     and the group is the cut a rep actually wants. */
  const legend =
    '<div class="map-legend">' +
      mapChip('all', 'Everything', 'var(--text2)') +
      mapChip('projects', 'AEE sites', 'var(--accent)') +
      Object.entries(SECTOR_GROUPS).map(([k, v]) =>
        mapChip(k, v, GROUP_COLOR[k] || '#cbd5e1')).join('') +
    '</div>';

  setContent(legend + '<div id="map-canvas" style="height:calc(100vh - 210px);min-height:440px"></div>' +
    '<div class="fg-hint" style="margin-top:10px">Circle size reflects annual consumption. Offtakers without exact coordinates are placed at the centre of their province.</div>');
  setTimeout(initMap, 60);
}

function mapChip(id, label, color) {
  return '<div class="map-legend-item ' + (state.mapFilter === id ? 'active' : '') + '" onclick="setMapFilter(\'' + id + '\')">' +
    '<span class="map-dot" style="background:' + color + '"></span>' + esc(label) + '</div>';
}
function setMapFilter(f) { state.mapFilter = f; renderMap(); }

function initMap() {
  const el = document.getElementById('map-canvas');
  if (!el || typeof L === 'undefined') return;
  if (_map) { _map.remove(); _map = null; }
  _map = L.map(el, { scrollWheelZoom: true }).setView([-28.8, 25.0], 5.4);
  /* Esri's dark canvas — keyless, and the same basemap the other regional
     CRMs use, so the maps read consistently side by side. Labels come as a
     separate reference layer drawn over the markers' basemap. */
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri', maxZoom: 16,
  }).addTo(_map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 16, pane: 'shadowPane',
  }).addTo(_map);

  const f = state.mapFilter;

  if (f === 'all' || f === 'projects') {
    state.projects.filter(p => p.status !== 'pipeline').forEach(p => {
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: '', iconSize: [26, 26], iconAnchor: [13, 13],
          html: '<div style="width:26px;height:26px;border-radius:7px;background:rgba(61,220,132,.92);' +
            'display:flex;align-items:center;justify-content:center;color:#04160c;box-shadow:0 0 12px rgba(61,220,132,.6)">' +
            icon('sun', 15) + '</div>',
        }),
      }).addTo(_map).bindPopup(
        '<b style="color:var(--accent)">' + esc(p.name) + '</b><br>' +
        fmtNum(p.mw) + ' MW · ' + esc(p.town) + ', ' + esc(p.province) + '<br>' +
        '<span style="color:#7a90a8">COD ' + esc(p.cod) + '</span>');
    });
  }

  if (f !== 'projects') {
    state.offtakers.filter(o => f === 'all' || sectorGroup(o.sector) === f).forEach(o => {
      const [lat, lng] = offtakerCoords(o);
      const r = Math.max(7, Math.min(26, Math.sqrt(num(o.annualGwh)) * 0.55));
      const color = GROUP_COLOR[sectorGroup(o.sector)] || '#cbd5e1';
      L.circleMarker([lat, lng], {
        radius: r, color, weight: 1.5, fillColor: color, fillOpacity: .28,
      }).addTo(_map).bindPopup(
        '<b>' + esc(o.name) + '</b><br>' +
        fmtNum(o.annualGwh) + ' GWh/yr · ' + fmtNum(o.peakMw) + ' MW peak<br>' +
        esc(sectorName(o.sector)) + '<br>R' + num(o.tariff).toFixed(2) + '/kWh · fit ' + fitScore(o) + '/100<br>' +
        '<span style="color:#3ddc84;cursor:pointer" onclick="nav(\'detail\',{id:\'' + o.id + '\'})">Open record &rarr;</span>');
    });
  }
}

/* ═══════════════════════════════════════════════════════════════
   ANALYTICS
   ═══════════════════════════════════════════════════════════════ */
function renderAnalytics() {
  setPage('Analytics', 'Where the addressable load and the pipeline value actually sit', '');

  const byProvince = {}, bySector = {}, byStatus = {};
  state.offtakers.forEach(o => {
    byProvince[o.province] = (byProvince[o.province] || 0) + num(o.annualGwh);
    bySector[o.sector] = (bySector[o.sector] || 0) + num(o.annualGwh);
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  });

  const totalGwh = state.offtakers.reduce((s, o) => s + num(o.annualGwh), 0);
  const avgTariff = state.offtakers.length
    ? state.offtakers.reduce((s, o) => s + num(o.tariff) * num(o.annualGwh), 0) / Math.max(1, totalGwh) : 0;
  const avgFit = state.offtakers.length
    ? Math.round(state.offtakers.reduce((s, o) => s + fitScore(o), 0) / state.offtakers.length) : 0;
  const weighted = state.deals.reduce((s, d) => s + weightedValue(d), 0);

  const barCard = (title, sub, obj, labelMap, color) => {
    const rows = Object.entries(obj).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...rows.map(r => r[1]));
    return '<div class="card"><div class="card-header"><div><div class="card-title">' + esc(title) + '</div>' +
      '<div class="card-sub">' + esc(sub) + '</div></div></div>' +
      rows.map(([k, v]) =>
        '<div class="bar-row"><div class="bar-label">' + esc((labelMap && labelMap[k]) || k) + '</div>' +
        '<div class="bar-track"><span class="bar-fill" data-w="' + ((v / max) * 100) + '" style="background:' + color + '"></span></div>' +
        '<div class="bar-num">' + fmtNum(v) + '</div></div>').join('') + '</div>';
  };

  /* Fit distribution — how healthy is the top of the funnel */
  const buckets = { '80–100': 0, '60–79': 0, '40–59': 0, '20–39': 0, '0–19': 0 };
  state.offtakers.forEach(o => {
    const f = fitScore(o);
    if (f >= 80) buckets['80–100']++; else if (f >= 60) buckets['60–79']++;
    else if (f >= 40) buckets['40–59']++; else if (f >= 20) buckets['20–39']++; else buckets['0–19']++;
  });

  /* Value concentration — the deals that actually matter */
  const topDeals = state.deals.slice().sort((a, b) => weightedValue(b) - weightedValue(a)).slice(0, 8);
  const topCard =
    '<div class="card"><div class="card-header"><div><div class="card-title">Where the value is</div>' +
    '<div class="card-sub">Top opportunities by probability-weighted contract value</div></div></div>' +
    '<div class="table-wrap" style="border:none;background:transparent"><table><thead><tr>' +
    '<th>Offtaker</th><th>Stage</th><th class="num">MW</th><th class="num">Weighted</th></tr></thead><tbody>' +
    (topDeals.length ? topDeals.map(d => {
      const st = PIPELINE_STAGES.find(s => s.id === d.stage) || {};
      return '<tr class="clickable" onclick="nav(\'detail\',{id:\'' + d.offtakerId + '\'})">' +
        '<td style="font-weight:700">' + esc(getOfftaker(d.offtakerId).short || '—') + '</td>' +
        '<td><span class="badge b-prospect">' + esc(st.label || d.stage) + '</span></td>' +
        '<td class="num">' + fmtNum(d.mw) + '</td>' +
        '<td class="num" style="color:var(--accent);font-weight:800">' + fmtR(weightedValue(d)) + '</td></tr>';
    }).join('') : '<tr><td colspan="4" style="color:var(--muted)">No opportunities yet</td></tr>') +
    '</tbody></table></div></div>';

  setContent(
    '<div class="stats-grid">' +
      statTile('bolt', 'green', 'Addressable load', fmtNum(totalGwh) + ' GWh', 'a year across tracked offtakers') +
      statTile('trending', 'amber', 'Weighted average tariff', 'R' + avgTariff.toFixed(2), 'consumption-weighted, per kWh') +
      statTile('target', 'blue', 'Average fit score', avgFit + '/100', buckets['80–100'] + ' offtakers score 80+') +
      statTile('chart', 'purple', 'Weighted pipeline', fmtR(weighted), 'across contract life') +
    '</div>' +
    '<div class="grid-2">' +
      barCard('Load by province', 'GWh a year', byProvince, null, 'var(--accent)') +
      barCard('Load by sector', 'GWh a year', bySector, SECTOR_LABEL_MAP, 'var(--accent2)') +
    '</div>' +
    '<div class="grid-2" style="margin-top:14px">' +
      barCard('Fit score distribution', 'Number of offtakers in each band', buckets, null, '#7dd3fc') +
      topCard +
    '</div>' +
    '<div class="card" style="margin-top:14px">' +
      '<div class="card-header"><div class="card-title">Funnel health</div></div>' +
      '<div class="split-bar">' +
        Object.entries(byStatus).map(([k, v]) => {
          const pct = (v / Math.max(1, state.offtakers.length)) * 100;
          const colors = { prospect: '#64748b', engaged: '#38bdf8', qualified: '#a78bfa', negotiating: '#f5a524', contracted: '#3ddc84', lost: '#ef4444' };
          return pct > 3 ? '<span style="width:' + pct + '%;background:' + (colors[k] || '#64748b') + '">' + v + '</span>' : '';
        }).join('') +
      '</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">' +
        Object.entries(byStatus).map(([k, v]) => '<span class="chip">' + esc(STATUS_LABEL[k] || k) + ' <i style="color:var(--muted)">' + v + '</i></span>').join('') +
      '</div>' +
      '<div class="fg-hint" style="margin-top:10px">A healthy funnel keeps prospects flowing into Engaged. If Prospect dominates, the problem is outreach volume, not conversion.</div>' +
    '</div>');
  growBars();
}

/* ═══════════════════════════════════════════════════════════════
   SAVINGS CALCULATOR — the number the rep quotes on the call
   ═══════════════════════════════════════════════════════════════ */
let _calcOfftakerId = '';

function openCalcFor(id) { _calcOfftakerId = id; nav('calculator'); }

function renderCalculator() {
  setPage('Savings calculator', 'Model a wheeled PPA against the offtaker\'s current supply cost', '');

  const o = _calcOfftakerId ? getOfftaker(_calcOfftakerId) : {};
  const v = {
    gwh: num(o.annualGwh) || 100,
    current: num(o.tariff) || DEFAULT_CURRENT_TARIFF,
    ppa: DEFAULT_PPA_TARIFF,
    coverage: 70,
    years: 20,
    eskomEsc: ESKOM_ESCALATION,
    ppaEsc: DEFAULT_ESCALATION,
  };

  const inputs =
    '<div class="card">' +
      '<div class="card-header"><div class="card-title">Inputs</div>' +
      (o.id ? '<button class="btn btn-ghost btn-xs" onclick="_calcOfftakerId=\'\';renderCalculator()">Clear</button>' : '') + '</div>' +
      '<div class="fgrid" style="grid-template-columns:1fr">' +
        '<div class="fg"><label>Offtaker</label><select id="calc-off" onchange="pickCalcOfftaker(this.value)">' +
          '<option value="">— enter figures manually —</option>' +
          state.offtakers.map(x => '<option value="' + esc(x.id) + '"' + (x.id === o.id ? ' selected' : '') + '>' + esc(x.short || x.name) + '</option>').join('') +
        '</select></div>' +
        calcInput('calc-gwh', 'Annual consumption (GWh)', v.gwh, '0.1') +
        calcInput('calc-coverage', 'Share covered by the PPA (%)', v.coverage, '1') +
        calcInput('calc-current', 'Current blended tariff (R/kWh)', v.current, '0.01') +
        calcInput('calc-ppa', 'Proposed PPA tariff (R/kWh)', v.ppa, '0.01') +
        calcInput('calc-years', 'Contract tenor (years)', v.years, '1') +
        calcInput('calc-eskom-esc', 'Assumed tariff escalation (%/yr)', v.eskomEsc, '0.5') +
        calcInput('calc-ppa-esc', 'PPA escalation (%/yr)', v.ppaEsc, '0.5') +
      '</div>' +
      '<div class="fg-hint" style="margin-top:12px">Escalation defaults reflect recent Eskom increases against a typical PPA indexation. Change them to match the customer\'s own planning assumption — it makes the conversation credible.</div>' +
    '</div>';

  setContent('<div class="calc-grid">' + inputs + '<div id="calc-results"></div></div>');
  ['calc-gwh', 'calc-coverage', 'calc-current', 'calc-ppa', 'calc-years', 'calc-eskom-esc', 'calc-ppa-esc']
    .forEach(id => document.getElementById(id).addEventListener('input', runCalc));
  runCalc();
}

function calcInput(id, label, value, step) {
  return '<div class="fg"><label>' + esc(label) + '</label>' +
    '<input id="' + id + '" type="number" step="' + step + '" value="' + esc(value) + '"></div>';
}

function pickCalcOfftaker(id) { _calcOfftakerId = id; renderCalculator(); }

function runCalc() {
  const g = id => num(document.getElementById(id).value);
  const m = savingsModel(g('calc-gwh'), g('calc-current'), g('calc-ppa'), g('calc-coverage'),
    g('calc-years'), g('calc-eskom-esc'), g('calc-ppa-esc'));
  const years = Math.max(1, Math.round(g('calc-years')));

  /* A compact year-by-year bar so the rep can point at the crossover. */
  const maxSaving = Math.max(1, ...m.series.map(s => s.saving));
  const chart = m.series.map(s =>
    '<div class="bar-row" style="grid-template-columns:38px 1fr 72px">' +
      '<div class="bar-label">Yr ' + s.year + '</div>' +
      '<div class="bar-track"><span class="bar-fill" data-w="' + ((s.saving / maxSaving) * 100) + '" ' +
      'style="background:linear-gradient(90deg,var(--accent),var(--accent2))"></span></div>' +
      '<div class="bar-num">' + fmtR(s.saving) + '</div></div>').join('');

  document.getElementById('calc-results').innerHTML =
    '<div class="calc-out">' +
      '<div class="calc-tile"><div class="calc-tile-v">' + fmtR(m.year1Saving) + '</div>' +
      '<div class="calc-tile-l">Year one saving</div>' +
      '<div class="calc-tile-s">' + fmtR(m.year1Current) + ' current vs ' + fmtR(m.year1Ppa) + ' on the PPA</div></div>' +
      '<div class="calc-tile amber"><div class="calc-tile-v">' + fmtR(m.totalSaving) + '</div>' +
      '<div class="calc-tile-l">' + years + '-year saving</div>' +
      '<div class="calc-tile-s">' + m.pctSaving.toFixed(1) + '% below the projected tariff path</div></div>' +
      '<div class="calc-tile blue"><div class="calc-tile-v">' + fmtNum(m.co2) + ' t</div>' +
      '<div class="calc-tile-l">CO₂e avoided a year</div>' +
      '<div class="calc-tile-s">' + fmtNum(m.co2 * years) + ' t over the contract</div></div>' +
      '<div class="calc-tile"><div class="calc-tile-v">' + fmtNum(m.kwh / 1e6) + ' GWh</div>' +
      '<div class="calc-tile-l">Volume contracted</div>' +
      '<div class="calc-tile-s">≈ ' + fmtNum(m.kwh / 1e6 * 1000 / (8760 * CAPACITY_FACTOR)) + ' MW of generation</div></div>' +
    '</div>' +
    '<div class="card" style="margin-top:14px">' +
      '<div class="card-header"><div><div class="card-title">Saving by year</div>' +
      '<div class="card-sub">The gap widens as the two escalation rates diverge — this is the slide that closes deals</div></div>' +
      '<button class="btn btn-outline btn-xs" onclick="copyCalcSummary()">' + icon('copy', 12) + ' Copy summary</button></div>' +
      chart +
    '</div>';
  growBars();
  window._calcModel = m;
}

function copyCalcSummary() {
  const m = window._calcModel;
  if (!m) return;
  const g = id => num(document.getElementById(id).value);
  const o = _calcOfftakerId ? getOfftaker(_calcOfftakerId) : null;
  const text =
    'Indicative PPA comparison' + (o && o.name ? ' — ' + o.name : '') + '\n' +
    '────────────────────────────────\n' +
    'Volume contracted:   ' + fmtNum(m.kwh / 1e6) + ' GWh a year (' + g('calc-coverage') + '% of load)\n' +
    'Current tariff:      R' + g('calc-current').toFixed(2) + '/kWh, escalating ' + g('calc-eskom-esc') + '%/yr\n' +
    'Proposed PPA:        R' + g('calc-ppa').toFixed(2) + '/kWh, escalating ' + g('calc-ppa-esc') + '%/yr\n' +
    'Tenor:               ' + Math.round(g('calc-years')) + ' years\n\n' +
    'Year one saving:     ' + fmtR(m.year1Saving) + '\n' +
    'Total saving:        ' + fmtR(m.totalSaving) + ' (' + m.pctSaving.toFixed(1) + '%)\n' +
    'CO2e avoided:        ' + fmtNum(m.co2) + ' t a year\n\n' +
    'Indicative only. Final tariff subject to half-hourly load modelling, grid connection cost and credit review.\n' +
    'African Earth Energy — Energy from the ground up';
  navigator.clipboard.writeText(text)
    .then(() => toast('Summary copied — paste it straight into an email'))
    .catch(() => toast('Could not copy to the clipboard', 'warn'));
}

/* ═══════════════════════════════════════════════════════════════
   PLAYBOOK
   ═══════════════════════════════════════════════════════════════ */
function renderPlaybook() {
  setPage('Sales playbook', 'Scripts, templates and qualification criteria for offtaker outreach', '');
  const tags = [...new Set(PLAYBOOK.map(p => p.tag))];
  const filter =
    '<div class="toolbar">' +
      '<select class="flt" onchange="state.pbFilter=this.value;renderPlaybook()">' +
        '<option value="">All material</option>' +
        tags.map(t => '<option value="' + esc(t) + '"' + (state.pbFilter === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('') +
      '</select>' +
      '<select class="flt" id="pb-offtaker" onchange="renderPlaybook()">' +
        '<option value="">Generic — no offtaker</option>' +
        state.offtakers.map(o => '<option value="' + esc(o.id) + '"' + (window._pbOfftaker === o.id ? ' selected' : '') + '>Fill in for ' + esc(o.short || o.name) + '</option>').join('') +
      '</select>' +
      '<span class="result-count">Pick an offtaker to fill the placeholders before copying</span>' +
    '</div>';

  const sel = document.getElementById('pb-offtaker');
  if (sel) window._pbOfftaker = sel.value;
  const offId = window._pbOfftaker || '';

  const list = PLAYBOOK.filter(p => !state.pbFilter || p.tag === state.pbFilter);
  const cards = list.map(p => {
    const body = offId ? fillTemplate(p.body, getOfftaker(offId)) : p.body;
    return '<div class="pb-card">' +
      '<div class="pb-head"><div class="pb-title">' + esc(p.title) + '</div><span class="pb-tag">' + esc(p.tag) + '</span></div>' +
      '<div class="pb-body">' + esc(body) + '</div>' +
      '<div class="pb-foot">' +
        '<button class="btn btn-outline btn-xs" onclick="copyTemplate(\'' + p.id + '\',\'' + offId + '\')">' + icon('copy', 12) + ' Copy</button>' +
      '</div>' +
    '</div>';
  }).join('');

  setContent(shortlistsHtml() + stakeholderLadderHtml() + marketContextHtml() +
    '<div class="section-title">Scripts &amp; templates</div>' + filter +
    '<div class="pb-grid">' + cards + '</div>');
  const s2 = document.getElementById('pb-offtaker');
  if (s2) s2.value = offId;
}

/* Where to point the desk first. Each shortlist links straight through
   to the sector, so a rep can go from "fastest paths" to the questions
   to ask in two clicks. */
function shortlistsHtml() {
  const ranked = SECTOR_SHORTLISTS.filter(s => s.sectors.length);
  const notes = SECTOR_SHORTLISTS.filter(s => !s.sectors.length);
  return '<div class="section-title">Where to point the desk</div>' +
    '<div class="grid-3">' + ranked.map(s =>
      '<div class="card">' +
        '<div class="card-header"><div><div class="card-title">' + esc(s.name) + '</div>' +
        '<div class="card-sub">' + esc(s.meaning) + '</div></div></div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:5px">' +
        s.sectors.map(name => {
          const sec = ALL_SECTORS.find(x => x.name === name);
          return sec
            ? '<span class="chip" style="cursor:pointer" onclick="nav(\'sector\',{id:\'' + sec.id + '\'})">' + esc(name) + '</span>'
            : '<span class="chip">' + esc(name) + '</span>';
        }).join('') + '</div>' +
      '</div>').join('') + '</div>' +
    (notes.length ? '<div class="card" style="margin-top:14px">' +
      notes.map(n => '<div style="margin-bottom:12px"><div class="card-title" style="margin-bottom:4px">' + esc(n.name) + '</div>' +
        '<div style="font-size:12px;color:var(--text2);line-height:1.6">' + esc(n.meaning) + '</div></div>').join('') +
      '</div>' : '');
}

/* Who to approach, in what order. Sector-agnostic — this is the shape of
   an industrial or mining energy sale wherever it happens. */
function stakeholderLadderHtml() {
  return '<div class="section-title">Who to approach, in what order</div>' +
    '<div class="grid-3">' + STAKEHOLDER_TIERS.map(t =>
      '<div class="card">' +
        '<div class="card-header"><div><div class="card-title">' + esc(t.label) + '</div>' +
        '<div class="card-sub">' + esc(t.hint) + '</div></div>' +
        '<span class="badge ' + (t.id === 'open' ? 'b-tier-1' : t.id === 'multithread' ? 'b-tier-2' : 'b-tier-3') + '">' +
        t.roles.length + '</span></div>' +
        t.roles.map(r =>
          '<div class="person-row">' +
            '<div class="av" style="width:24px;height:24px;font-size:9px;background:' + avatarColor(r.title) + '">' +
              esc((r.title[0] || '?').toUpperCase()) + '</div>' +
            '<div style="min-width:0;flex:1">' +
              '<div class="person-name">' + esc(r.title) + '</div>' +
              '<div class="person-title">' + esc(r.why) + '</div>' +
            '</div>' +
          '</div>').join('') +
      '</div>').join('') + '</div>';
}

function marketContextHtml() {
  return '<div class="section-title">Market context — as at ' + esc(MARKET.asAt) + '</div>' +
    '<div class="grid-3">' +
      '<div class="card">' +
        '<div class="card-header"><div><div class="card-title">Tariff benchmarks</div>' +
        '<div class="card-sub">ZAR per kWh, all-in</div></div></div>' +
        MARKET.tariffs.map(t =>
          '<div class="mkt-row"><div><div class="mkt-label">' + esc(t.label) + '</div>' +
          (t.note ? '<div class="mkt-note">' + esc(t.note) + '</div>' : '') + '</div>' +
          '<div class="mkt-value">R' + t.low.toFixed(2) + ' – ' + t.high.toFixed(2) + '</div></div>').join('') +
        '<div class="fg-hint" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">' +
        'Midpoint saving against Megaflex on wheeled solar: <b style="color:var(--accent)">R' +
        (MARKET_MEGAFLEX_MID - MARKET_SOLAR_MID).toFixed(2) + '/kWh</b>, about ' +
        Math.round(((MARKET_MEGAFLEX_MID - MARKET_SOLAR_MID) / MARKET_MEGAFLEX_MID) * 100) + '%.</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-header"><div class="card-title">Standard PPA terms</div></div>' +
        MARKET.ppaTerms.map(t =>
          '<div class="mkt-row"><div class="mkt-label">' + esc(t.label) + '</div>' +
          '<div class="mkt-value" style="font-weight:600;white-space:normal;text-align:right;max-width:58%">' +
          esc(t.value) + '</div></div>').join('') +
        '<div class="form-section-title" style="margin-top:14px">Watch items</div>' +
        '<ul class="check-list warn">' + MARKET.watchItems.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-header"><div><div class="card-title">Qualify or walk away</div>' +
        '<div class="card-sub">An account must clear all four</div></div></div>' +
        '<ul class="check-list">' + MARKET.qualifiers.map(q => '<li>' + esc(q) + '</li>').join('') + '</ul>' +
        '<div class="form-section-title" style="margin-top:16px">Disqualifiers — walk away</div>' +
        '<ul class="check-list danger">' + MARKET.disqualifiers.map(q => '<li>' + esc(q) + '</li>').join('') + '</ul>' +
      '</div>' +
    '</div>' +
    '<div class="card" style="margin-top:14px">' +
      '<div class="card-title" style="margin-bottom:6px">Opening question, any account</div>' +
      '<div style="font-size:14px;color:var(--text2);line-height:1.6;font-style:italic">&ldquo;' +
      esc(MARKET.openingQuestion) + '&rdquo;</div>' +
      '<div class="fg-hint" style="margin-top:10px">' + esc(MARKET.prioritisation) + '</div>' +
    '</div>';
}

/* ═══════════════════════════════════════════════════════════════
   ACTIVITY LOG
   ═══════════════════════════════════════════════════════════════ */
function renderActivity() {
  const logs = state.interactions.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const dueDeals = state.deals.filter(d => d.closeDate && d.stage !== 'signed')
    .sort((a, b) => (a.closeDate || '').localeCompare(b.closeDate || ''));

  setPage('Activity', logs.length + ' logged interactions',
    '<button class="btn btn-primary btn-sm" data-admin-only onclick="openLogInteraction()">' + icon('plus', 14) + ' Log activity</button>');

  const dueHtml = dueDeals.length
    ? '<div class="card"><div class="card-header"><div><div class="card-title">Target close dates</div>' +
      '<div class="card-sub">Opportunities with a date set, soonest first</div></div></div>' +
      dueDeals.slice(0, 10).map(d => {
        const overdue = d.closeDate <= todayISO();
        return '<div class="person-row" style="cursor:pointer" onclick="nav(\'detail\',{id:\'' + d.offtakerId + '\'})">' +
          '<div style="min-width:0;flex:1"><div class="person-name">' + esc(getOfftaker(d.offtakerId).short || '—') + ' · ' + fmtNum(d.mw) + ' MW</div>' +
          '<div class="person-title">' + esc((PIPELINE_STAGES.find(s => s.id === d.stage) || {}).label || d.stage) + '</div></div>' +
          '<span class="badge ' + (overdue ? 'b-high' : 'b-prospect') + '">' + esc(d.closeDate) + '</span></div>';
      }).join('') + '</div>'
    : '';

  const logHtml = '<div class="card"><div class="card-header"><div class="card-title">Interaction log</div></div>' +
    (logs.length ? logs.map(i =>
      '<div class="int-row"><div class="int-dot"></div><div class="int-body">' +
      '<div class="int-meta">' + esc(i.type) + ' · <span class="ext-link" style="cursor:pointer" onclick="nav(\'detail\',{id:\'' + i.offtakerId + '\'})">' +
      esc(getOfftaker(i.offtakerId).short || 'Unknown') + '</span> · ' + esc(i.date) + '</div>' +
      '<div class="int-text">' + esc(i.summary) + '</div></div>' +
      '<button class="btn btn-xs btn-ghost" data-admin-only onclick="deleteInteraction(\'' + i.id + '\')">' + icon('trash', 11) + '</button></div>').join('')
      : '<div class="empty"><div class="ei">' + icon('activity', 30) + '</div><h3>Nothing logged yet</h3>' +
        '<p>Every call, email and meeting logged here is context the next person picking up the account will need.</p></div>') +
    '</div>';

  setContent(dueHtml ? '<div class="cols-2">' + logHtml + dueHtml + '</div>' : logHtml);
}
