/* ═══════════════════════════════════════════════════════════════════
   Core — state, persistence, helpers, routing, modals.
   Data lives in localStorage so each sales user keeps their own working
   copy; export/import CSV is how the team shares it.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const STORE_PREFIX = 'aee_crm_';
const SEED_VERSION = 'v1';
const PER_PAGE = 20;

let state = {
  offtakers: [],
  contacts: [],
  deals: [],
  interactions: [],
  prospects: [],
  projects: [],

  role: null,   // 'admin' | 'viewer' | 'pending' | null (signed out)
  email: null,

  view: 'dashboard',
  detailId: null,
  editOfftakerId: null,
  editContactId: null,
  editDealId: null,
  editProspectId: null,
  deleteTarget: null,

  /* Each list keeps its own grid/table preference, remembered per browser. */
  offView: storedView('offView', 'grid'),
  contactView: storedView('contactView', 'table'),
  sectorView: storedView('sectorView', 'grid'),
  prospectView: storedView('prospectView', 'table'),
  projectView: storedView('projectView', 'grid'),
  activityView: storedView('activityView', 'timeline'),
  pipeView: storedView('pipeView', 'board'),

  offSearch: '', offSector: '', offStatus: '', offProvince: '',
  offSort: { field: 'fit', dir: 'desc' },
  offPage: 1,

  contactSearch: '', contactOfftaker: '', contactRole: '',
  contactSort: { field: 'last', dir: 'asc' },
  contactPage: 1,

  sectorId: null,
  sectorSearch: '', sectorTier: '', sectorGroup: '',

  prospectSearch: '', prospectSector: '', prospectTier: '', prospectStatus: '', prospectStage: '',
  prospectPage: 1,

  newsTopic: 'all', newsProvince: '', newsSearch: '',

  mapFilter: 'all',
  pbFilter: '',
};

/* ─── GRID / TABLE TOGGLE ─────────────────────────────────────────
   Every list view offers the same two readings of the same records: cards
   for scanning and comparing, a table for ranking and bulk reading. The
   choice is per list and persists, because a rep who works the pipeline in
   a table rarely wants cards back tomorrow. */
function storedView(key, fallback) {
  /* offView predates this helper and was stored under its own key. */
  const legacy = key === 'offView' ? 'off_view' : null;
  try {
    return localStorage.getItem(STORE_PREFIX + key) ||
      (legacy ? localStorage.getItem(STORE_PREFIX + legacy) : null) || fallback;
  } catch (e) { return fallback; }
}

/* `options` defaults to grid/table; the pipeline passes board/table. */
function viewToggle(key, options) {
  return '<div class="view-toggle">' +
    (options || [['grid', 'Grid'], ['table', 'Table']]).map(([v, label]) =>
      '<button class="vt-btn ' + (state[key] === v ? 'active' : '') + '" ' +
      'onclick="setViewMode(\'' + key + '\',\'' + v + '\')">' + label + '</button>').join('') +
    '</div>';
}

function setViewMode(key, v) {
  if (state[key] === v) return;
  state[key] = v;
  try { localStorage.setItem(STORE_PREFIX + key, v); } catch (e) {}
  render();
}

/* ─── HELPERS ─────────────────────────────────────────────────── */
function uid(p) { return (p || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
/* Only http(s) links are ever emitted, so a pasted javascript: URL is inert. */
function safeHref(url) { const u = String(url || '').trim(); return /^https?:\/\//i.test(u) ? u : ''; }
function jsStr(v) { return esc(JSON.stringify(String(v == null ? '' : v))); }
function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : (d === undefined ? 0 : d); }
function fmtNum(n, dp) { return num(n).toLocaleString('en-ZA', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp === undefined ? 0 : dp }); }
function fmtR(n) {
  const v = num(n);
  if (Math.abs(v) >= 1e9) return 'R' + (v / 1e9).toFixed(2) + 'bn';
  if (Math.abs(v) >= 1e6) return 'R' + (v / 1e6).toFixed(1) + 'm';
  if (Math.abs(v) >= 1e3) return 'R' + (v / 1e3).toFixed(0) + 'k';
  return 'R' + v.toFixed(0);
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function relTime(iso) {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (Number.isNaN(d)) return '';
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return d + ' days ago';
  if (d < 365) return Math.round(d / 30) + ' months ago';
  return Math.round(d / 365) + ' years ago';
}
function initials(a, b) { return ((a || '')[0] || '') + ((b || '')[0] || ''); }
function avatarColor(seed) {
  const colors = ['#3ddc84', '#f5a524', '#38bdf8', '#a78bfa', '#ec4899', '#22c55e', '#fb923c', '#60a5fa'];
  let h = 0; for (const ch of String(seed || '')) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return colors[Math.abs(h) % colors.length];
}

/* ─── SECTOR HELPERS ──────────────────────────────────────────── */
function sectorOf(id) { return SECTOR_BY_ID[id] || null; }
function sectorName(id) { const s = sectorOf(id); return s ? s.name : (id || '—'); }
function sectorGroup(id) { const s = sectorOf(id); return s ? s.group : 'utilities-public'; }
function sectorTier(id) { const s = sectorOf(id); return s ? s.tier : 3; }
/* Plain id -> name map, for the chart helpers that take a label lookup. */
const SECTOR_LABEL_MAP = SECTOR_LABEL;
function sectorBadge(id) {
  return '<span class="badge b-grp-' + sectorGroup(id) + '">' + esc(sectorName(id)) + '</span>';
}
/* PPA fit rendered as five dots — quicker to read across a list than a number. */
function ppaDots(fit) {
  let h = '<span class="ppa-dots" title="PPA fit ' + num(fit) + ' of 5">';
  for (let i = 1; i <= 5; i++) h += '<span class="ppa-dot' + (i <= num(fit) ? ' on' : '') + '"></span>';
  return h + '</span>';
}
/* Sector <option> list, grouped, for every sector picker in the app. */
function sectorOptions(selected) {
  const byGroup = {};
  ALL_SECTORS.forEach(s => { (byGroup[s.group] = byGroup[s.group] || []).push(s); });
  return Object.keys(SECTOR_GROUPS).filter(g => byGroup[g]).map(g =>
    '<optgroup label="' + esc(SECTOR_GROUPS[g]) + '">' +
    byGroup[g].sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name)).map(s =>
      '<option value="' + esc(s.id) + '"' + (s.id === selected ? ' selected' : '') + '>' +
      esc(s.name) + '</option>').join('') + '</optgroup>').join('');
}

function getOfftaker(id) { return state.offtakers.find(o => o.id === id) || {}; }
/* Returns undefined rather than {} — the router uses it as an existence
   check before routing to a prospect profile. */
function getProspect(id) { return state.prospects.find(p => p.id === id); }
function getProject(id) { return state.projects.find(p => p.id === id) || {}; }
function contactsFor(id) { return state.contacts.filter(c => c.offtakerId === id); }
function dealsFor(id) { return state.deals.filter(d => d.offtakerId === id); }
function interactionsFor(id) { return state.interactions.filter(i => i.offtakerId === id).sort((a, b) => (b.date || '').localeCompare(a.date || '')); }

/* Distance between two lat/lng points, km. Used to match offtakers to the
   nearest generation site — a short wheeling path is a real commercial
   advantage, so proximity feeds the fit score. */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}
function offtakerCoords(o) {
  if (num(o.lat) && num(o.lng)) return [o.lat, o.lng];
  return PROVINCE_COORDS[o.province] || PROVINCE_COORDS['Multiple'];
}
/* Nearest generation site, and whether that distance is worth trusting.

   An offtaker with no coordinates of its own falls back to the centre of
   its province, and several of those centres ARE the town an AEE site
   sits in — Limpopo's centroid is Polokwane, Mpumalanga's is Middelburg.
   Reported plainly, that reads as "0 km", which looks like the mine is
   on top of the solar farm. So a distance derived from a province rather
   than from real coordinates comes back flagged, and every place that
   prints it says so. The number is still useful for rough ordering; it
   just must not be dressed up as a survey. */
function nearestProject(o) {
  const approx = !(num(o.lat) && num(o.lng));
  const [lat, lng] = offtakerCoords(o);
  let best = null, bestKm = Infinity;
  for (const p of state.projects) {
    if (p.status === 'pipeline') continue;
    const km = haversineKm(lat, lng, p.lat, p.lng);
    if (km < bestKm) { bestKm = km; best = p; }
  }
  return best ? { project: best, km: bestKm, approx } : null;
}
/* "412 km" when the location is pinned, "~412 km" when it was inferred
   from the province. One helper so every screen says it the same way. */
function distanceLabel(np) {
  if (!np) return '—';
  return (np.approx ? '~' : '') + np.km + ' km';
}
const APPROX_DISTANCE_NOTE =
  'Measured from the centre of the province — this offtaker has no site coordinates recorded yet, so treat the distance as indicative.';

/* Fit score, 0–100. A single number the sales team can sort by so the
   call list starts with the offtakers most likely to sign. Six factors:
   size of load, how flat it is, tariff headroom, wheeling feasibility,
   distance to a generation site, and how well the sector as a whole
   suits a PPA (the desk's own 1–5 rating from the sector workbook). */
function fitScore(o) {
  const gwh = num(o.annualGwh);
  const sizeScore = Math.min(26, (gwh / 1000) * 26);                       // 1 TWh+ maxes out

  const peak = num(o.peakMw);
  const lf = peak > 0 ? Math.min(1, (gwh * 1000) / (peak * 8760)) : 0;     // load factor
  const shapeScore = lf * 20;                                              // flat load suits solar+BESS

  /* Headroom against the wheeled-solar midpoint, which is what AEE can
     actually offer — not an aspirational number. */
  const tariffScore = Math.max(0, Math.min(18, (num(o.tariff) - MARKET_SOLAR_MID) * 18));

  const wheelScore = { yes: 14, likely: 10, unknown: 4, no: 0 }[o.wheeling] ?? 4;

  const np = nearestProject(o);
  const distScore = np ? Math.max(0, 10 - (np.km / 72)) : 0;               // 0 km = 10, 720 km+ = 0

  const sector = SECTOR_BY_ID[o.sector];
  const sectorScore = sector ? (num(sector.ppaFit) / 5) * 12 : 6;          // unknown sector sits mid-range

  return Math.round(Math.max(0, Math.min(100,
    sizeScore + shapeScore + tariffScore + wheelScore + distScore + sectorScore)));
}
function loadFactor(o) {
  const peak = num(o.peakMw);
  if (!peak) return 0;
  return Math.min(1, (num(o.annualGwh) * 1000) / (peak * 8760));
}
function fitColor(score) {
  if (score >= 70) return 'var(--accent)';
  if (score >= 50) return 'var(--accent2)';
  if (score >= 30) return '#7dd3fc';
  return 'var(--muted)';
}

/* Indicative annual spend and the saving against an AEE PPA tariff.
   Deliberately simple and transparent — the sales team has to be able to
   explain every number on a call. */
/* Starting assumptions, taken from the desk's own market benchmarks in
   data/sectors.js rather than invented, so a default quote reflects the
   real market. Both are midpoints of a published band. */
const DEFAULT_PPA_TARIFF = MARKET_SOLAR_MID;     // R1.30/kWh wheeled solar
const DEFAULT_CURRENT_TARIFF = MARKET_MEGAFLEX_MID; // R2.30/kWh Megaflex all-in
const DEFAULT_ESCALATION = 5.0;    // % a year, CPI-linked PPA indexation
const ESKOM_ESCALATION = 11.0;     // % a year, recent trend
const GRID_EMISSION_FACTOR = 0.95; // tCO2e per MWh, SA grid

function savingsModel(annualGwh, currentTariff, ppaTariff, coveragePct, years, eskomEsc, ppaEsc) {
  const kwh = num(annualGwh) * 1e6 * (num(coveragePct, 100) / 100);
  const y = Math.max(1, Math.round(num(years, 20)));
  const eEsc = num(eskomEsc, ESKOM_ESCALATION) / 100;
  const pEsc = num(ppaEsc, DEFAULT_ESCALATION) / 100;
  let totalCurrent = 0, totalPpa = 0;
  const series = [];
  for (let i = 0; i < y; i++) {
    const c = kwh * num(currentTariff) * Math.pow(1 + eEsc, i);
    const p = kwh * num(ppaTariff) * Math.pow(1 + pEsc, i);
    totalCurrent += c; totalPpa += p;
    series.push({ year: i + 1, current: c, ppa: p, saving: c - p });
  }
  return {
    kwh,
    year1Current: series[0].current,
    year1Ppa: series[0].ppa,
    year1Saving: series[0].saving,
    totalCurrent, totalPpa,
    totalSaving: totalCurrent - totalPpa,
    pctSaving: totalCurrent > 0 ? ((totalCurrent - totalPpa) / totalCurrent) * 100 : 0,
    co2: (kwh / 1000) * GRID_EMISSION_FACTOR,  // tCO2e a year
    series,
  };
}

/* ─── PERSISTENCE ─────────────────────────────────────────────── */
function lsGet(key, fallback) {
  try { const raw = localStorage.getItem(STORE_PREFIX + key); return raw ? JSON.parse(raw) : fallback; }
  catch (e) { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value)); }
  catch (e) { console.warn('Could not save', key, e); }
}

/* Pull every record the signed-in user is allowed to see. The generation
   portfolio is not in the database — it is AEE's own published project
   list, so it ships with the app and needs no sync. */
async function load() {
  state.projects = JSON.parse(JSON.stringify(AEE_PROJECTS));
  try {
    const [offtakers, contacts, deals, interactions, prospects] = await Promise.all([
      supaFetch('aee_offtakers?select=*&order=name'),
      supaFetch('aee_contacts?select=*&order=last'),
      supaFetch('aee_deals?select=*&order=mw.desc'),
      supaFetch('aee_interactions?select=*&order=date.desc'),
      supaFetch('aee_prospects?select=*&order=name'),
    ]);
    state.offtakers = (offtakers || []).map(rowToOfftaker);
    state.contacts = (contacts || []).map(rowToContact);
    state.deals = (deals || []).map(rowToDeal);
    state.interactions = (interactions || []).map(rowToInteraction);
    state.prospects = (prospects || []).map(rowToProspect);
    cacheLocally();
  } catch (e) {
    console.warn('Could not reach Supabase, falling back to the local cache:', e);
    const cache = lsGet('cache', null);
    if (cache) {
      state.offtakers = cache.offtakers || [];
      state.contacts = cache.contacts || [];
      state.deals = cache.deals || [];
      state.interactions = cache.interactions || [];
      state.prospects = cache.prospects || [];
      toast('Working from a cached copy — changes will not be saved', 'warn');
    } else {
      state.offtakers = []; state.contacts = []; state.deals = []; state.interactions = []; state.prospects = [];
      toast('Could not load the CRM data', 'danger');
    }
  }
}

/* A read-only snapshot so a dropped connection shows the last known data
   instead of an empty app. Never written back to the server. */
function cacheLocally() {
  lsSet('cache', {
    offtakers: state.offtakers, contacts: state.contacts,
    deals: state.deals, interactions: state.interactions, prospects: state.prospects,
    at: new Date().toISOString(),
  });
}

/* Kept as the local-cache refresh. Server writes happen per record via the
   push* helpers in js/supabase.js, called from the form handlers. */
function save() { cacheLocally(); }

/* Annual contract value of a deal, R. MW × load hours × tariff, using an
   assumed 30% capacity factor for the generation side. */
const CAPACITY_FACTOR = 0.30;
function dealAnnualValue(d) {
  return num(d.mw) * 1000 * 8760 * CAPACITY_FACTOR * num(d.tariff);
}
function dealLifetimeValue(d) {
  return dealAnnualValue(d) * num(d.tenor, 20);
}
function weightedValue(d) {
  return dealLifetimeValue(d) * (num(d.probability) / 100);
}

/* ─── SALESFORCE SALES PATH ───────────────────────────────────────
   One stage per ACCOUNT — an offtaker, or a prospect that is being worked
   before it has been promoted. Deals keep their own, finer PPA stages on
   the pipeline board; this is the process question a manager asks about
   the company itself. */
function sfStageOf(id) { return SF_STAGES.find(s => s.id === id) || null; }
function sfStageIndex(id) { return SF_STAGES.findIndex(s => s.id === id); }

/* The stage on the record, or the one implied by the status it already
   carries, so nothing has to be back-filled before the board is useful. */
function sfStageFor(rec) {
  if (!rec) return 'prospecting';
  if (rec.sfStage && sfStageOf(rec.sfStage)) return rec.sfStage;
  return STATUS_TO_SF_STAGE[rec.status] || 'prospecting';
}
function sfStageLabel(rec) { return (sfStageOf(sfStageFor(rec)) || {}).label || '—'; }

/* Closed splits in two and only the status records which way it went. */
function sfIsClosedLost(rec) { return sfStageFor(rec) === 'closed' && rec.status === 'lost'; }
function sfStageBadge(rec) {
  const stage = sfStageFor(rec);
  const cls = stage === 'closed' ? (sfIsClosedLost(rec) ? 'b-lost' : 'b-contracted')
    : stage === 'negotiation' ? 'b-negotiating'
    : stage === 'proposal' ? 'b-qualified'
    : stage === 'needs-analysis' ? 'b-engaged' : 'b-prospect';
  const label = stage === 'closed'
    ? (sfIsClosedLost(rec) ? 'Closed lost' : 'Closed won')
    : (sfStageOf(stage) || {}).label;
  return '<span class="badge ' + cls + '">' + esc(label || stage) + '</span>';
}

/* The path itself. Salesforce draws it as chevrons across the top of a
   record and it is the one control a rep uses every day, so it sits on the
   page rather than behind an edit form: one click moves the account. */
function sfPathHtml(kind, rec) {
  const current = sfStageFor(rec);
  const at = sfStageIndex(current);
  const lost = sfIsClosedLost(rec);
  return '<div class="sfpath">' + SF_STAGES.map((st, i) => {
    const label = st.id === 'closed' && i === at ? (lost ? 'Closed lost' : 'Closed won') : st.label;
    const cls = i < at ? ' done' : i === at ? (lost ? ' current lost' : ' current') : '';
    return '<button class="sfp-step' + cls + '" title="' + esc(st.hint) + '" ' +
      'onclick="setSfStage(' + jsStr(kind) + ',' + jsStr(rec.id) + ',' + jsStr(st.id) + ')">' +
      esc(label) + '</button>';
  }).join('') + '</div>';
}

/* The card the path sits in, with the stage's own one-line definition
   underneath so nobody has to guess what "Needs Analysis" means here. */
function sfPathCardHtml(kind, rec) {
  const st = sfStageOf(sfStageFor(rec)) || {};
  return '<div class="card">' +
    '<div class="card-header"><div><div class="card-title">Sales stage</div>' +
    '<div class="card-sub">' + esc(st.hint || '') + '</div></div>' + sfStageBadge(rec) + '</div>' +
    sfPathHtml(kind, rec) +
  '</div>';
}

/* ─── OPPORTUNITY OWNERSHIP ───────────────────────────────────────
   A deal hangs off an offtaker, or off a prospect while the load is still
   unknown. Everything that renders a deal asks here rather than reaching
   for offtakerId directly, so a prospect's opportunity is never shown as
   belonging to an unknown company. */
function dealsForProspect(id) { return state.deals.filter(d => d.prospectId === id); }
function interactionsForProspect(id) {
  return state.interactions.filter(i => i.prospectId === id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function dealAccount(d) {
  if (d && d.offtakerId) {
    const o = getOfftaker(d.offtakerId);
    if (o.id) return { id: o.id, name: o.short || o.name, view: 'detail', kind: 'offtaker' };
  }
  if (d && d.prospectId) {
    const p = getProspect(d.prospectId);
    if (p) return { id: p.id, name: p.name, view: 'prospect', kind: 'prospect' };
  }
  return { id: '', name: 'Unknown account', view: '', kind: 'none' };
}

/* ─── ROUTING ─────────────────────────────────────────────────── */
const ID_SCOPED_VIEWS = new Set(['detail', 'sector', 'org-map', 'prospect']);

function navUrlFor(view, id) {
  const p = new URLSearchParams(location.search);
  p.delete('view'); p.delete('id');
  if (view && view !== 'dashboard') p.set('view', view);
  if (ID_SCOPED_VIEWS.has(view) && id) p.set('id', id);
  const q = p.toString();
  return location.pathname + (q ? '?' + q : '');
}

function nav(view, extra, fromHistory) {
  extra = extra || {};
  state.view = view;
  if (extra.id) { if (view === 'sector') state.sectorId = extra.id; else state.detailId = extra.id; }
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const target = document.querySelector('[data-view="' + view + '"]');
  if (target) target.classList.add('active');
  document.querySelector('.sb').classList.remove('open');

  if (!fromHistory) {
    const id = ID_SCOPED_VIEWS.has(view) ? (extra.id || state.detailId) : null;
    const prev = history.state;
    if (!prev || prev.view !== view || prev.id !== id) {
      try { history.pushState({ view, id }, '', navUrlFor(view, id)); } catch (e) {}
    }
  }
  window.scrollTo({ top: 0 });
  render();
}

addEventListener('popstate', e => {
  let view, id;
  if (e.state && e.state.view) { view = e.state.view; id = e.state.id; }
  else {
    const p = new URLSearchParams(location.search);
    view = p.get('view') || 'dashboard';
    id = p.get('id');
  }
  if ((view === 'detail' || view === 'org-map') && !(id && getOfftaker(id).id)) { view = 'offtakers'; id = null; }
  if (view === 'sector' && !(id && sectorOf(id))) { view = 'sectors'; id = null; }
  if (view === 'prospect' && !(id && getProspect(id))) { view = 'prospects'; id = null; }
  if (id) { if (view === 'sector') state.sectorId = id; else state.detailId = id; }
  nav(view, id ? { id } : {}, true);
});

function renderBackToMain() {
  const host = document.getElementById('back-to-main');
  if (!host) return;
  host.innerHTML = state.view === 'dashboard'
    ? ''
    : '<div class="back-btn" onclick="nav(\'dashboard\')">&larr; Back to Dashboard</div>';
}

function render() {
  const views = {
    dashboard: renderDashboard,
    pipeline: renderPipeline,
    offtakers: renderOfftakers,
    detail: renderDetail,
    'org-map': renderOrgMap,
    sectors: renderSectors,
    sector: renderSector,
    prospects: renderProspects,
    prospect: renderProspect,
    regions: renderRegions,
    contacts: renderContacts,
    projects: renderProjects,
    map: renderMap,
    analytics: renderAnalytics,
    calculator: renderCalculator,
    playbook: renderPlaybook,
    activity: renderActivity,
    news: renderNews,
  };
  (views[state.view] || renderDashboard)();
  renderBackToMain();
  updateNavBadges();
  applyRoleUI();
}

/* Hides everything marked data-admin-only from viewers. This is a courtesy
   so read-only users are not shown buttons that will fail — the actual
   enforcement is the Row Level Security policies in the database. */
function applyRoleUI() {
  const isAdmin = state.role === 'admin';
  document.querySelectorAll('[data-admin-only]').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
}

function setPage(title, sub, actions) {
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-sub').textContent = sub || '';
  document.getElementById('topbar-actions').innerHTML = actions || '';
}
function setContent(html) { document.getElementById('content').innerHTML = html; }

function updateNavBadges() {
  const hot = state.offtakers.filter(o => fitScore(o) >= 70 && o.status === 'prospect').length;
  const el = document.getElementById('nav-offtakers-badge');
  if (el) { el.textContent = hot; el.style.display = hot ? '' : 'none'; }
  const pEl = document.getElementById('nav-prospects-badge');
  const tier1New = state.prospects.filter(p => p.status === 'new' && sectorTier(p.sectorId) === 1).length;
  if (pEl) { pEl.textContent = tier1New; pEl.style.display = tier1New ? '' : 'none'; }
  const dueEl = document.getElementById('nav-activity-badge');
  const due = state.deals.filter(d => d.closeDate && d.closeDate <= todayISO() && d.stage !== 'signed').length;
  if (dueEl) { dueEl.textContent = due; dueEl.style.display = due ? '' : 'none'; }
}

/* ─── SORTING ─────────────────────────────────────────────────── */
function toggleSort(sortState, field, rerender) {
  if (sortState.field === field) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
  else { sortState.field = field; sortState.dir = 'asc'; }
  rerender();
}
function sortArrow(field, s) { return s.field === field ? (s.dir === 'asc' ? ' ▲' : ' ▼') : ''; }
function thClass(field, s) { return 'sortable' + (s.field === field ? ' sorted' : ''); }
function sortBy(list, s, getVal) {
  const dir = s.dir === 'asc' ? 1 : -1;
  return list.slice().sort((a, b) => {
    const va = getVal(a, s.field), vb = getVal(b, s.field);
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
    return String(va).localeCompare(String(vb), 'en') * dir;
  });
}

/* ─── MODAL / TOAST ───────────────────────────────────────────── */
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open'));
});
document.addEventListener('click', e => {
  if (e.target.classList && e.target.classList.contains('overlay')) e.target.classList.remove('open');
});

let _toastTimer = null;
function toast(msg, kind) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show' + (kind ? ' ' + kind : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = ''; }, 3200);
}

/* ─── GLOBAL SEARCH ───────────────────────────────────────────── */
function globalSearch(q) {
  const box = document.getElementById('global-search-results');
  const term = String(q || '').trim().toLowerCase();
  if (term.length < 2) { box.classList.remove('open'); box.innerHTML = ''; return; }

  const rows = [];
  state.offtakers.forEach(o => {
    if ((o.name + ' ' + o.short + ' ' + o.city + ' ' + o.province).toLowerCase().includes(term))
      rows.push({ t: o.name, s: sectorName(o.sector) + ' · ' + o.city, go: "nav('detail',{id:'" + o.id + "'})" });
  });
  state.contacts.forEach(c => {
    const full = (c.first + ' ' + c.last + ' ' + c.title).toLowerCase();
    if (full.includes(term))
      rows.push({ t: c.first + ' ' + c.last, s: c.title + ' · ' + (getOfftaker(c.offtakerId).short || ''), go: "nav('detail',{id:'" + c.offtakerId + "'})" });
  });
  state.projects.forEach(p => {
    if (p.name.toLowerCase().includes(term))
      rows.push({ t: p.name, s: p.mw + ' MW · ' + p.province, go: "nav('projects')" });
  });
  state.prospects.forEach(p => {
    if (p.name.toLowerCase().includes(term))
      rows.push({ t: p.name, s: 'Prospect · ' + sectorName(p.sectorId),
        go: "nav('prospect',{id:" + jsStr(p.id) + "})" });
  });
  ALL_SECTORS.forEach(s => {
    if (s.name.toLowerCase().includes(term))
      rows.push({ t: s.name, s: 'Sector · tier ' + s.tier + ' · PPA fit ' + s.ppaFit + '/5', go: "nav('sector',{id:'" + s.id + "'})" });
  });

  if (!rows.length) {
    box.innerHTML = '<div class="gs-row"><div><div class="gs-row-t">No matches</div><div class="gs-row-s">Try a company, person or project name</div></div></div>';
  } else {
    box.innerHTML = rows.slice(0, 12).map(r =>
      '<div class="gs-row" onclick="closeSearch();' + r.go + '"><div><div class="gs-row-t">' + esc(r.t) + '</div><div class="gs-row-s">' + esc(r.s) + '</div></div></div>'
    ).join('');
  }
  box.classList.add('open');
}
function closeSearch() {
  document.getElementById('global-search-results').classList.remove('open');
  document.getElementById('global-search-input').value = '';
}
document.addEventListener('click', e => {
  if (!e.target.closest('.gs-wrap')) document.getElementById('global-search-results')?.classList.remove('open');
});

/* ─── CSV EXPORT / IMPORT ─────────────────────────────────────── */
function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportOfftakers() {
  const head = ['id', 'name', 'short', 'sector', 'province', 'city', 'website', 'annual_gwh', 'peak_mw',
    'current_tariff_r_kwh', 'supply', 'wheeling', 'nmd_mva', 'status', 'priority', 'fit_score',
    'nearest_project', 'distance_km', 'contacts', 'description'];
  const rows = [head].concat(state.offtakers.map(o => {
    const np = nearestProject(o);
    return [o.id, o.name, o.short, sectorName(o.sector), o.province, o.city, o.website,
      o.annualGwh, o.peakMw, o.tariff, o.supply, WHEELING_LABEL[o.wheeling] || o.wheeling, o.nmd,
      STATUS_LABEL[o.status] || o.status, o.priority, fitScore(o),
      np ? np.project.name : '', np ? np.km : '', contactsFor(o.id).length, o.description];
  }));
  downloadCSV('aee-offtakers-' + todayISO() + '.csv', rows);
  toast('Exported ' + state.offtakers.length + ' offtakers');
}

function exportContacts() {
  const head = ['first', 'last', 'title', 'department', 'offtaker', 'sector', 'province', 'email', 'phone', 'linkedin', 'role', 'priority', 'status', 'notes'];
  const rows = [head].concat(state.contacts.map(c => {
    const o = getOfftaker(c.offtakerId);
    return [c.first, c.last, c.title, c.dept, o.name || '', sectorName(o.sector), o.province || '',
      c.email, c.phone, c.linkedin, c.role, c.priority, c.status, c.notes];
  }));
  downloadCSV('aee-contacts-' + todayISO() + '.csv', rows);
  toast('Exported ' + state.contacts.length + ' contacts');
}

function exportPipeline() {
  const head = ['opportunity', 'account', 'account_type', 'project', 'mw', 'stage', 'tariff_r_kwh', 'tenor_years',
    'probability_pct', 'annual_value_r', 'lifetime_value_r', 'weighted_value_r', 'close_date', 'notes'];
  const rows = [head].concat(state.deals.map(d => {
    const stage = PIPELINE_STAGES.find(s => s.id === d.stage);
    const acc = dealAccount(d);
    return [d.name, acc.name, acc.kind, getProject(d.projectId).name || '', d.mw,
      stage ? stage.label : d.stage, d.tariff, d.tenor, d.probability,
      Math.round(dealAnnualValue(d)), Math.round(dealLifetimeValue(d)), Math.round(weightedValue(d)),
      d.closeDate, d.notes];
  }));
  downloadCSV('aee-pipeline-' + todayISO() + '.csv', rows);
  toast('Exported ' + state.deals.length + ' opportunities');
}

/* Import contacts from CSV. Header row is matched loosely so a list
   exported from LinkedIn, Apollo or a spreadsheet mostly just works. */
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim()));
}

/* ─── CSV IMPORT ──────────────────────────────────────────────────
   One importer, two shapes. A file with a first/last name column is a
   contact list; one with a company name and no person on it is an
   offtaker list. Which one it is gets decided from the header row
   rather than asked, because the answer is never ambiguous and asking
   would only be a chance to pick wrong.

   Offtaker rows carry no load figures most of the time — a target
   list is usually just names and places, and the GWh comes later,
   from the customer. That is fine: a record with no load is honest
   about it and sorts to the bottom until someone fills it in. What it
   must NOT do is wear the "estimated load" badge, which promises a
   desk estimate that nobody made. */
let _importRows = [];
let _importKind = 'contacts';

const IMPORT_HINT_CONTACTS =
  'Choose a CSV with a header row.<br>Recognised columns: ' +
  '<b style="color:var(--text2)">first, last</b>, title, department, company, email, phone, linkedin, notes.';

const IMPORT_HINT_OFFTAKERS =
  'Choose a CSV with a header row.<br>Recognised columns: ' +
  '<b style="color:var(--text2)">name</b>, short, sector, province, city, website, gwh, peak mw, tariff, ' +
  'nmd, supply, wheeling, status, priority, description.<br><br>' +
  'Sector accepts either the id (<i>mining</i>) or the full name (<i>Mining &amp; Minerals (Producer)</i>). ' +
  'Province accepts abbreviations — WC, KZN, Limpopo — and is what places the record on the map.';

/* Opened from a specific button, so the kind is known up front rather
   than guessed from the columns. The guess survives only as a check that
   the file matches the button that was pressed. */
function openImport(kind) {
  _importRows = [];
  _importKind = kind === 'offtakers' ? 'offtakers' : 'contacts';
  document.getElementById('imp-title').textContent =
    _importKind === 'offtakers' ? 'Import offtakers from CSV' : 'Import contacts from CSV';
  document.getElementById('imp-file').value = '';
  document.getElementById('imp-preview').innerHTML = '<div class="fg-hint">' +
    (_importKind === 'offtakers' ? IMPORT_HINT_OFFTAKERS : IMPORT_HINT_CONTACTS) + '</div>';
  document.getElementById('imp-go').disabled = true;
  openModal('modal-import');
}

/* The nine provinces, plus the abbreviations and spellings people
   actually type. Getting this right is what puts an imported offtaker
   on the map and into the province filter: coordinates fall back to the
   province centroid, so "WC" or "Kwazulu Natal" left as raw text would
   strand the record with no location at all. */
const PROVINCE_ALIASES = {
  'gauteng': 'Gauteng', 'gp': 'Gauteng', 'gt': 'Gauteng',
  'limpopo': 'Limpopo', 'lp': 'Limpopo', 'northern province': 'Limpopo',
  'mpumalanga': 'Mpumalanga', 'mp': 'Mpumalanga',
  'north west': 'North West', 'north-west': 'North West', 'northwest': 'North West', 'nw': 'North West',
  'free state': 'Free State', 'freestate': 'Free State', 'fs': 'Free State',
  'kwazulu-natal': 'KwaZulu-Natal', 'kwazulu natal': 'KwaZulu-Natal', 'kwazulunatal': 'KwaZulu-Natal',
  'kzn': 'KwaZulu-Natal', 'kn': 'KwaZulu-Natal', 'natal': 'KwaZulu-Natal',
  'eastern cape': 'Eastern Cape', 'easterncape': 'Eastern Cape', 'ec': 'Eastern Cape',
  'western cape': 'Western Cape', 'westerncape': 'Western Cape', 'wc': 'Western Cape',
  'northern cape': 'Northern Cape', 'northerncape': 'Northern Cape', 'nc': 'Northern Cape',
};
function provinceFromText(text) {
  const v = String(text || '').trim();
  if (!v) return '';
  return PROVINCE_ALIASES[v.toLowerCase().replace(/\s+/g, ' ')] || v;
}

/* Accepts a sector by id ("mining") or by the name shown in the app
   ("Mining & Minerals (Producer)"), so a list can be written either
   way round without anyone having to look the ids up. */
function sectorIdFromText(text) {
  const v = String(text || '').trim();
  if (!v) return '';
  if (SECTOR_BY_ID[v]) return v;

  /* Sector names carry commas, ampersands, slashes and brackets, and a
     hand-made CSV will differ from the canonical spelling by exactly one
     of those. Comparing on letters and digits alone means
     "Smelting Ferroalloys & Primary Metals" still finds
     "Smelting, Ferroalloys & Primary Metals". */
  const key = t => String(t || '').toLowerCase()
    .replace(/&/g, ' and ')            // "Food & Beverage" and "Food and Beverage" must agree
    .replace(/[^a-z0-9]+/g, ' ').trim();
  const want = key(v);
  if (!want) return '';

  const exact = ALL_SECTORS.find(s => key(s.name) === want || key(s.id) === want);
  if (exact) return exact.id;

  /* A sub-sector is a perfectly reasonable thing to write in a sector
     column — "Ferrochrome" should land under Smelting. */
  const sub = SUB_SECTORS.find(x => key(x.name) === want);
  if (sub && SECTOR_BY_ID[sub.sectorId]) return sub.sectorId;

  /* Last resort: one containing the other, longest match wins so
     "Retail" does not beat "Retail Chains (Multi-Site)". */
  const loose = ALL_SECTORS
    .filter(s => { const k = key(s.name); return k.includes(want) || want.includes(k); })
    .sort((a, b) => key(b.name).length - key(a.name).length)[0];
  return loose ? loose.id : '';
}
/* Free text to one of the stored enum values, falling back to the
   safe default rather than writing a value nothing can render. */
function enumFromText(text, allowed, fallback) {
  const v = String(text || '').trim().toLowerCase();
  return allowed.includes(v) ? v : fallback;
}

function previewImport(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCSV(String(reader.result));
    if (rows.length < 2) { importMsg('That file has no data rows.'); return; }
    const head = rows[0].map(h => h.trim().toLowerCase());
    const find = (...names) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };

    const firstIdx = find('first', 'first name', 'firstname', 'given name');
    const lastIdx = find('last', 'last name', 'lastname', 'surname', 'family name');
    const looksLikeContacts = firstIdx >= 0 || lastIdx >= 0;

    /* The button decides what this is. But a contacts file dropped into
       the offtaker importer would silently create companies named after
       people, so say so rather than quietly doing the wrong thing. */
    if (_importKind === 'offtakers' && looksLikeContacts && find('name') < 0) {
      importMsg('This looks like a <b>contacts</b> file \u2014 it has name columns but no company ' +
        '<b>name</b> column. Close this and use Import contacts instead.<br><br>' + IMPORT_HINT_OFFTAKERS, true);
      return;
    }
    if (_importKind === 'contacts' && !looksLikeContacts) {
      importMsg('This does not look like a <b>contacts</b> file \u2014 no first or last name column. ' +
        'If it is a list of companies, close this and use Import offtakers instead.<br><br>' +
        IMPORT_HINT_CONTACTS, true);
      return;
    }

    if (_importKind === 'offtakers') previewOfftakerImport(rows, head, find);
    else previewContactImport(rows, find, firstIdx, lastIdx);
  };
  reader.readAsText(file);
}

function importMsg(html, warn) {
  document.getElementById('imp-preview').innerHTML =
    '<div class="fg-hint"' + (warn ? ' style="color:var(--warn)"' : '') + '>' + html + '</div>';
  document.getElementById('imp-go').disabled = true;
}

function previewContactImport(rows, find, firstIdx, lastIdx) {
  const idx = {
    title: find('title', 'job title', 'position', 'role'),
    dept: find('department', 'dept', 'division'),
    company: find('company', 'organisation', 'organization', 'offtaker', 'account'),
    email: find('email', 'email address', 'e-mail'),
    phone: find('phone', 'mobile', 'telephone', 'cell'),
    linkedin: find('linkedin', 'linkedin url', 'profile'),
    notes: find('notes', 'note', 'comment'),
  };
  _importRows = rows.slice(1).map(r => {
    const v = i => (i >= 0 ? String(r[i] || '').trim() : '');
    const companyName = v(idx.company);
    const match = state.offtakers.find(o =>
      companyName && (o.name.toLowerCase().includes(companyName.toLowerCase()) ||
        (o.short || '').toLowerCase() === companyName.toLowerCase()));
    return {
      first: v(firstIdx), last: v(lastIdx), title: v(idx.title), dept: v(idx.dept),
      email: v(idx.email), phone: v(idx.phone), linkedin: v(idx.linkedin), notes: v(idx.notes),
      companyName, offtakerId: match ? match.id : '',
    };
  }).filter(c => c.first || c.last);

  const matched = _importRows.filter(r => r.offtakerId).length;
  document.getElementById('imp-preview').innerHTML =
    '<div class="fg-hint"><b style="color:var(--text2)">' + _importRows.length + ' contacts</b> found. ' +
    matched + ' matched to an existing offtaker; ' + (_importRows.length - matched) +
    ' will be filed as unassigned and can be linked later.</div>' +
    '<div class="table-wrap" style="margin-top:10px;max-height:220px"><table><thead><tr><th>Name</th><th>Title</th><th>Company</th><th>Matched</th></tr></thead><tbody>' +
    _importRows.slice(0, 8).map(r => '<tr><td>' + esc(r.first + ' ' + r.last) + '</td><td>' + esc(r.title) +
      '</td><td>' + esc(r.companyName) + '</td><td>' + (r.offtakerId
        ? '<span class="badge b-contracted">' + esc(getOfftaker(r.offtakerId).short || '') + '</span>'
        : '<span class="badge b-low">unassigned</span>') + '</td></tr>').join('') +
    '</tbody></table></div>';
  document.getElementById('imp-go').disabled = false;
}

function previewOfftakerImport(rows, head, find) {
  const idx = {
    name: find('name', 'company', 'offtaker', 'organisation', 'organization', 'account'),
    short: find('short', 'short name', 'shortname'),
    sector: find('sector', 'industry'),
    province: find('province', 'region'),
    city: find('city', 'town', 'location'),
    website: find('website', 'url', 'web'),
    gwh: find('gwh', 'annual gwh', 'annualgwh', 'gwh/yr', 'annual use'),
    peak: find('peak mw', 'peakmw', 'peak', 'peak demand'),
    tariff: find('tariff', 'r/kwh', 'current tariff'),
    nmd: find('nmd', 'notified max demand', 'mva'),
    supply: find('supply', 'supply authority'),
    wheeling: find('wheeling'),
    status: find('status'),
    priority: find('priority'),
    description: find('description', 'notes', 'note'),
  };
  if (idx.name < 0) {
    importMsg('No company name column found. Add a <b>name</b> column and try again.<br><br>' + IMPORT_HINT, true);
    return;
  }

  const seen = new Set();
  _importRows = rows.slice(1).map(r => {
    const v = i => (i >= 0 ? String(r[i] || '').trim() : '');
    const name = v(idx.name);
    if (!name) return null;
    const gwh = num(v(idx.gwh));
    return {
      name,
      short: v(idx.short) || name,
      sector: sectorIdFromText(v(idx.sector)),
      sectorRaw: v(idx.sector),
      province: provinceFromText(v(idx.province)),
      provinceRaw: v(idx.province),
      city: v(idx.city),
      website: v(idx.website),
      annualGwh: gwh, peakMw: num(v(idx.peak)), tariff: num(v(idx.tariff)), nmd: num(v(idx.nmd)),
      supply: enumFromText(v(idx.supply), ['eskom', 'municipal', 'mixed'], 'eskom'),
      wheeling: enumFromText(v(idx.wheeling), ['yes', 'likely', 'unknown', 'no'], 'unknown'),
      status: enumFromText(v(idx.status), Object.keys(STATUS_LABEL), 'prospect'),
      priority: enumFromText(v(idx.priority), ['high', 'medium', 'low'], 'medium'),
      description: v(idx.description),
      /* No load figure means no estimate was made. Saying "estimated"
         here would claim a number that does not exist. */
      estimated: gwh > 0,
      dup: false,
    };
  }).filter(Boolean);

  /* Two kinds of duplicate: already in the CRM, and repeated inside
     the file itself. Both are skipped on import and both are counted
     here, so the number in the preview is what will actually land. */
  _importRows.forEach(o => {
    const key = o.name.toLowerCase();
    const existing = state.offtakers.some(x =>
      x.name.toLowerCase() === key || (x.short || '').toLowerCase() === o.short.toLowerCase());
    o.dup = existing || seen.has(key);
    seen.add(key);
  });

  const fresh = _importRows.filter(o => !o.dup);
  const noSector = fresh.filter(o => !o.sector);
  const noLoad = fresh.filter(o => !o.annualGwh).length;
  /* A province that did not resolve to one of the nine leaves the record
     without coordinates, so it never shows on the map or under Regions. */
  const badProvince = fresh.filter(o => o.provinceRaw && !PROVINCE_COORDS[o.province]);

  document.getElementById('imp-preview').innerHTML =
    '<div class="fg-hint"><b style="color:var(--text2)">' + fresh.length + ' offtakers</b> will be added' +
    (_importRows.length - fresh.length ? ', ' + (_importRows.length - fresh.length) + ' skipped as duplicates' : '') + '. ' +
    (noLoad ? noLoad + ' carry no load figures yet — they will sit at the bottom of the list until someone adds them.' : '') +
    '</div>' +
    (noSector.length ? '<div class="fg-hint" style="color:var(--warn);margin-top:8px">' + noSector.length +
      ' row' + (noSector.length === 1 ? '' : 's') + ' had no sector I could match' +
      (noSector[0].sectorRaw ? ' (e.g. &ldquo;' + esc(noSector[0].sectorRaw) + '&rdquo;)' : '') +
      ' — those will be filed under Mining &amp; Minerals. Fix the sector column to place them properly.</div>' : '') +
    (badProvince.length ? '<div class="fg-hint" style="color:var(--warn);margin-top:8px">' + badProvince.length +
      ' row' + (badProvince.length === 1 ? '' : 's') + ' had a province I could not match (e.g. &ldquo;' +
      esc(badProvince[0].provinceRaw) + '&rdquo;) \u2014 those fall back to the centre of the country, so ' +
      'they will sit in the wrong place on the map and against the wrong site under Regions. ' +
      'Worth fixing the province column before importing.</div>' : '') +
    '<div class="table-wrap" style="margin-top:10px;max-height:220px"><table><thead><tr>' +
    '<th>Company</th><th>Sector</th><th>Province</th><th class="num">GWh/yr</th><th></th></tr></thead><tbody>' +
    _importRows.slice(0, 10).map(o => '<tr><td>' + esc(o.name) + '</td>' +
      '<td>' + (o.sector ? sectorBadge(o.sector) : '<span class="badge b-low">unmatched</span>') + '</td>' +
      '<td>' + esc(o.province || '—') + '</td>' +
      '<td class="num">' + (o.annualGwh || '—') + '</td>' +
      '<td>' + (o.dup ? '<span class="badge b-lost">duplicate</span>' : '') + '</td></tr>').join('') +
    '</tbody></table></div>';
  document.getElementById('imp-go').disabled = fresh.length === 0;
}

function runImport() {
  if (_importKind === 'offtakers') return runOfftakerImport();
  let added = 0;
  _importRows.forEach(r => {
    const dup = state.contacts.some(c =>
      (r.email && c.email && c.email.toLowerCase() === r.email.toLowerCase()) ||
      (c.first.toLowerCase() === r.first.toLowerCase() && c.last.toLowerCase() === r.last.toLowerCase() && c.offtakerId === r.offtakerId));
    if (dup) return;
    state.contacts.push({
      id: uid('c'), offtakerId: r.offtakerId, first: r.first, last: r.last, title: r.title,
      dept: r.dept, email: r.email, phone: r.phone, linkedin: r.linkedin,
      role: 'influencer', priority: 'medium', status: 'active', notes: r.notes,
    });
    added++;
  });
  save();
  closeModal('modal-import');
  toast('Imported ' + added + ' new contact' + (added === 1 ? '' : 's'));
  nav('contacts');
}

function runOfftakerImport() {
  let added = 0;
  _importRows.forEach(r => {
    if (r.dup) return;
    const rec = {
      id: uid('o'), name: r.name, short: r.short,
      sector: r.sector || 'mining', province: r.province, city: r.city, website: r.website,
      annualGwh: r.annualGwh, peakMw: r.peakMw, tariff: r.tariff, nmd: r.nmd,
      supply: r.supply, wheeling: r.wheeling, status: r.status, priority: r.priority,
      description: r.description, estimated: r.estimated,
    };
    state.offtakers.push(rec);
    pushOfftaker(rec);
    added++;
  });
  save();
  closeModal('modal-import');
  toast('Imported ' + added + ' new offtaker' + (added === 1 ? '' : 's'));
  nav('offtakers');
}

/* ─── BOOT / AUTH GATE ────────────────────────────────────────────
   Nothing renders until Supabase confirms a session and the profile
   carries a role. A signed-out visitor gets the sign-in screen; a
   signed-in account still on 'pending' is told to ask for access. */
function showGate(html) {
  document.getElementById('app-shell').style.display = 'none';
  const gate = document.getElementById('auth-gate');
  gate.innerHTML = html;
  gate.style.display = 'flex';
}
function hideGate() {
  document.getElementById('auth-gate').style.display = 'none';
  document.getElementById('app-shell').style.display = '';
}

function signInScreenHtml(message) {
  return '<div class="gate-card">' +
    '<div class="gate-mark">' + icon('bolt', 22) + '</div>' +
    '<h1>African Earth Energy</h1>' +
    '<p class="gate-sub">Offtaker CRM — internal. Sign in with the username and password you were given.</p>' +
    '<form class="gate-form" onsubmit="event.preventDefault();doSignIn()">' +
      '<input id="gate-email" type="text" placeholder="Username or email" autocomplete="username" autocapitalize="none" spellcheck="false" required>' +
      '<input id="gate-password" type="password" placeholder="Password" autocomplete="current-password" required>' +
      '<button class="btn btn-primary" id="gate-btn" type="submit">Sign in</button>' +
    '</form>' +
    '<div class="gate-msg" id="gate-msg">' + (message ? esc(message) : '') + '</div>' +
  '</div>';
}

function pendingScreenHtml(email) {
  return '<div class="gate-card">' +
    '<div class="gate-mark">' + icon('clock', 22) + '</div>' +
    '<h1>Access not granted yet</h1>' +
    '<p class="gate-sub">You are signed in as <b>' + esc(toDisplayName(email)) + '</b>, but this account has not been given access to the CRM. Ask an administrator to grant it.</p>' +
    '<button class="btn btn-outline" onclick="signOut()">Sign out</button>' +
  '</div>';
}

async function doSignIn() {
  const email = (document.getElementById('gate-email').value || '').trim();
  const password = document.getElementById('gate-password').value || '';
  const msg = document.getElementById('gate-msg');
  const btn = document.getElementById('gate-btn');
  if (!email || !password) { msg.textContent = 'Enter your username and password.'; return; }
  btn.disabled = true; btn.textContent = 'Signing in…';
  const res = await signIn(email, password);
  btn.disabled = false; btn.textContent = 'Sign in';
  if (res.error) {
    msg.textContent = /invalid/i.test(res.error.message)
      ? 'That username and password combination was not recognised.'
      : res.error.message;
  }
  /* A success fires onAuthStateChange, which takes it from here. */
}

function setUserBadge(email, role) {
  const el = document.getElementById('user-badge');
  if (!el) return;
  if (!email) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML =
    '<div class="av" style="width:24px;height:24px;font-size:9px;background:' + avatarColor(email) + '">' +
      esc((email[0] || '?').toUpperCase()) + '</div>' +
    '<div class="ub-text"><div class="ub-email">' + esc(toDisplayName(email)) + '</div>' +
    '<div class="ub-role">' + (role === 'admin' ? 'Admin' : 'Read only') + '</div></div>' +
    '<button class="btn btn-ghost btn-xs" onclick="signOut()" title="Sign out">' + icon('logout', 13) + '</button>';
}

async function onSignedIn(session) {
  state.email = (session.user.email || '').toLowerCase();
  state.role = await currentRole(session.user.id);

  if (state.role !== 'admin' && state.role !== 'viewer') {
    showGate(pendingScreenHtml(state.email));
    return;
  }

  await load();
  setUserBadge(state.email, state.role);
  hideGate();

  const p = new URLSearchParams(location.search);
  let view = p.get('view') || 'dashboard';
  const id = p.get('id');
  if ((view === 'detail' || view === 'org-map') && !getOfftaker(id).id) view = 'offtakers';
  if (view === 'sector' && !sectorOf(id)) view = 'sectors';
  nav(view, id ? { id } : {}, true);
}

async function boot() {
  document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon, 17); });
  showGate('<div class="gate-card"><div class="gate-spinner"></div><p class="gate-sub">Checking your session…</p></div>');

  await initSupabase();
  const { data } = await supabaseClient.auth.getSession();
  if (data && data.session) await onSignedIn(data.session);
  else showGate(signInScreenHtml());

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) await onSignedIn(session);
    else if (event === 'SIGNED_OUT') {
      state.role = null; state.email = null;
      setUserBadge(null);
      showGate(signInScreenHtml());
    }
  });
}
document.addEventListener('DOMContentLoaded', boot);
