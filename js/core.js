/* ═══════════════════════════════════════════════════════════════════
   Core — state, persistence, helpers, routing, modals.
   The data lives in Supabase, so the whole team sees the same records;
   localStorage only caches the last successful read so a dropped
   connection shows the last known data instead of an empty app. CSV
   export/import is for sharing and backup.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const STORE_PREFIX = 'aee_crm_';
const SEED_VERSION = 'v1';
const PER_PAGE = 20;

/* The nine provinces, in the order the top-bar switcher lists them. */
const SA_PROVINCES = ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
  'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'];

let state = {
  offtakers: [],
  pm: null,              // ProjectManager.com copy (Projects page); null until loaded
  pmTab: 'team', pmProject: null, pmF: null,
  archived: [],          // shelved companies, Archive tab only
  archivedContacts: [],  // contacts that belong to them, kept out of every other list
  offArchive: false,     // Off-taker Prospects: false = priority list, true = Archive tab
  contacts: [],
  deals: [],
  interactions: [],
  projects: [],

  role: null,   // 'admin' | 'viewer' | 'pending' | null (signed out)
  email: null,

  view: 'dashboard',
  detailId: null,
  /* Set by a dashboard bar on the way to the generation portfolio, read
     once on arrival and cleared. Not a selection — just "this is the one
     you clicked", said out loud in a grid of nine. */
  focusProjectId: null,
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
  muniView: storedView('muniView', 'table'),
  projectView: storedView('projectView', 'grid'),
  activityView: storedView('activityView', 'timeline'),
  /* The Activity page: which reading (follow-ups, all activity, calendar), the month the
     calendar shows ("YYYY-MM", blank for this month) and a day it is narrowed to, if any. */
  activityTab: 'followups', actMonth: '', actDay: '',
  /* The import wizard: the file being imported and the step it is on. Held in memory only,
     so a reload starts the wizard over; null until Import CSV is opened. */
  imp: null,
  /* Accounts, not Deals. The deal board only holds records that already
     have an opportunity filed, which is the narrower half of the pipeline —
     an account moved in with "Work it" has a stage but no deal yet, so it
     is invisible there and the move reads as having done nothing. The
     account board answers the question the nav item asks: who are we
     working. Deals stays one click away. */
  pipeView: storedView('pipeView', 'accounts'),
  /* Set by "Stalled only" on the Flow page and read by the accounts board.
     It narrows the pipeline, so it lives here rather than with the
     Prospects filters — a lead has no stage and so cannot stall. */
  pipeStalled: '',

  /* The province scope: one filter for the whole app, set from the top bar and
     remembered on this device. The province filters the pages grew for themselves
     (offProvince, muniProvince, newsProvince, cfProvince) are the same setting
     under their old names; see linkProvinceFilters. */
  province: storedProvince(),

  offSearch: '', offSector: '', offStatus: '',
  offSort: { field: 'fit', dir: 'desc' },
  offPage: 1,

  contactSearch: '', contactOfftaker: '', contactRole: '',
  contactSort: { field: 'last', dir: 'asc' },
  contactPage: 1,

  sectorId: null,
  projectId: null,
  sectorSearch: '', sectorTier: '', sectorGroup: '',

  prospectSearch: '', prospectSector: '', prospectTier: '', prospectStatus: '',
  prospectPage: 1,

  muniSearch: '', muniCat: '', muniWorked: '',
  muniSort: { field: 'name', dir: 'asc' },
  muniPage: 1,

  newsTopic: 'all', newsSearch: '',
  /* News: publishers unticked in the Filters card, the "only stories that name an off-taker"
     switch, and the Save / Dismiss marks (loaded from this browser on first use). */
  newsSourcesOff: [], newsMatchedOnly: false, newsMarks: null,

  /* Contact finder: the scope a discovery run will be queued against. */
  cfTarget: 'mining',
  cfRoles: ['decision'],
  contactRuns: null, foundContacts: null,

  /* The Map's Show checklist: what has been unticked ("projects" is the AEE sites, the rest are
     sector groups). Nothing is hidden to begin with. */
  mapHidden: [],
  pbFilter: '',
};
linkProvinceFilters(state);

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
/* Numbers as people write them. The app prints "1 234 568" with spaces, South
   African spreadsheets use a decimal comma ("3,5") and others a thousands comma
   ("1,200"), so a typed or imported cell must survive all three. Number("1 200")
   is NaN, which used to turn the cell into 0 without a word. */
function numText(s) {
  let t = String(s).trim().replace(/[\s\u00a0\u202f]/g, '');
  if (/^-?\d+,\d{1,2}$/.test(t) || /^-?\d{1,3}(?:\.\d{3})+,\d+$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
  return t;
}
function num(v, d) {
  const n = typeof v === 'string' ? Number(numText(v)) : Number(v);
  return Number.isFinite(n) ? n : (d === undefined ? 0 : d);
}
function fmtNum(n, dp) { return num(n).toLocaleString('en-ZA', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp === undefined ? 0 : dp }); }
function fmtR(n) {
  const v = num(n);
  if (v < 0) return '-' + fmtR(-v);
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
  const colors = ['#A04A2A', '#8A6A1C', '#3F6F82', '#7A5390', '#A8466A', '#6F7A2E', '#B0603C', '#4F6A8A'];
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
/* Leads and offtakers are one record type. A company nobody has
   established a load for is not a different kind of thing — it is an
   account at the start of the process, so "unworked" is a question about
   the figures, not about which table the row sits in. */
function isUnworked(o) { return !num(o && o.annualGwh); }
/* What to show in place of a firm annual figure when nobody has
   established one. A band with its basis attached stays honest; a bare
   number reads as fact and ends up in a quote. */
function loadBandText(o) {
  const lo = num(o.gwhLow), hi = num(o.gwhHigh);
  if (!lo && !hi) return 'not established';
  if (lo && hi) return fmtNum(lo) + '–' + fmtNum(hi);
  return fmtNum(lo || hi);
}
/* Contacts, interactions and the org map all hang off one id column, and
   that id is now either an offtaker or a municipality. Anything generic
   resolves through getAccount; getOfftaker stays offtaker-only, so an
   offtaker-specific screen cannot quietly accept a municipality and
   render half a page from an empty object. */
function isMunicipalityId(id) {
  return typeof MUNI_BY_ID !== 'undefined' && !!MUNI_BY_ID[id];
}
function getAccount(id) {
  const o = state.offtakers.find(x => x.id === id);
  if (o) return o;
  return isMunicipalityId(id) ? muniAsAccount(MUNI_BY_ID[id]) : {};
}
/* Which detail view an id belongs to, for anything that links to "the
   record this contact or log entry is filed against". */
function accountView(id) { return isMunicipalityId(id) ? 'municipality' : 'detail'; }
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
  if (score >= 30) return 'var(--c-blue)';
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
    const [offtakers, contacts, deals, interactions] = await Promise.all([
      supaFetchAll('aee_offtakers?select=*&order=name,id'),
      supaFetchAll('aee_contacts?select=*&order=last,id'),
      supaFetchAll('aee_deals?select=*&order=mw.desc,id'),
      supaFetchAll('aee_interactions?select=*&order=date.desc,id'),
    ]);
    const everyone = (offtakers || []).map(rowToOfftaker);
    state.offtakers = everyone.filter(o => !o.archived);
    state.archived = everyone.filter(o => o.archived);
    /* Whatever hangs off an archived company goes with it. Contacts for a
       shelved account would otherwise crowd the Contacts page and the
       finder with people nobody is working. */
    const shelved = new Set(state.archived.map(o => o.id));
    const allContacts = (contacts || []).map(rowToContact);
    state.contacts = allContacts.filter(c => !shelved.has(c.offtakerId));
    state.archivedContacts = allContacts.filter(c => shelved.has(c.offtakerId));
    state.deals = (deals || []).map(rowToDeal).filter(d => !shelved.has(d.offtakerId));
    state.interactions = (interactions || []).map(rowToInteraction).filter(i => !shelved.has(i.offtakerId));
    /* The project plans are read under the same sign-in; a failure there must not
       take the CRM down, so the loader catches its own errors. */
    await loadProjectPlans();
    cacheLocally();
  } catch (e) {
    console.warn('Could not reach Supabase, falling back to the local cache:', e);
    const cache = lsGet('cache', null);
    if (cache) {
      state.offtakers = cache.offtakers || [];
      state.archived = cache.archived || [];
      state.archivedContacts = cache.archivedContacts || [];
      state.contacts = cache.contacts || [];
      state.deals = (cache.deals || []).map(d => ({ ...d, stage: normalizeDealStage(d.stage) }));
      state.interactions = cache.interactions || [];
      toast('Working from a cached copy — changes will not be saved', 'warn');
    } else {
      state.offtakers = []; state.contacts = []; state.deals = []; state.interactions = [];
      toast('Could not load the CRM data', 'danger');
    }
  }
}

/* A read-only snapshot so a dropped connection shows the last known data
   instead of an empty app. Never written back to the server. */
function cacheLocally() {
  lsSet('cache', {
    offtakers: state.offtakers, archived: state.archived,
    contacts: state.contacts, archivedContacts: state.archivedContacts,
    deals: state.deals, interactions: state.interactions,
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
   before it has been promoted. The deal board runs the same five stages
   on one opportunity at a time; this is the same question asked of the
   company itself, and the two are kept in step (see below). */
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

/* ─── ONE STAGE, TWO BOARDS ──────────────────────────────────────
   The deal board and the account path run the same five stages, so they
   are held together rather than left to drift apart: an account sits
   where its furthest-along opportunity sits, and moving the account
   brings its opportunities with it.

   Lost opportunities are ignored on the way up. A deal that died says
   nothing about where the company is now, and counting it would drag an
   account backwards every time one was written off. An account whose
   opportunities are all lost keeps whatever stage somebody put it at —
   closing it is a decision, not an arithmetic result. */
/* Probability that goes with a stage. SF_STAGES already carries one per
   stage, so the board reads that rather than keeping a second table that
   would quietly disagree with it. */
function stageProbability(stage) { return (sfStageOf(stage) || {}).prob; }

/* Accounts whose stored stage disagrees with their opportunities.

   Everything inside the app now writes both together, so a disagreement
   means something arrived from outside it — a CSV import, an edit made
   straight against the database, a stage rename that back-filled deals
   but not accounts. That is how four accounts sat at Prospecting while
   their opportunities were as far along as Negotiation, and nothing
   said so until somebody happened to open one.

   Reported, never corrected on the quiet. A stage is a claim about a
   conversation somebody had, so the repair is a decision to take rather
   than a number to recompute — the board shows the disagreement and
   offers the move. */
function stageMismatches() {
  return state.offtakers.reduce((out, rec) => {
    const fromDeals = accountStageFromDeals(rec.id);
    if (!fromDeals) return out;
    const current = sfStageFor(rec);
    if (current === fromDeals) return out;
    out.push({ rec, current, fromDeals, behind: sfStageIndex(current) < sfStageIndex(fromDeals) });
    return out;
  }, []);
}

function accountStageFromDeals(id) {
  const live = dealsFor(id).filter(d => d.stage !== 'lost').map(d => normalizeDealStage(d.stage));
  if (!live.length) return null;
  return live.reduce((best, st) => sfStageIndex(st) > sfStageIndex(best) ? st : best, live[0]);
}

/* Write that stage onto the account. Returns the label it moved to, or
   null if it was already there — the caller uses that to say so in the
   log rather than filing a second entry nobody asked for.

   Only real accounts: a deal can be filed against a municipality, which
   is assembled from the reference data and has no record to write to.
   Closed reached this way is always won — an opportunity only gets to
   Closed by being signed, and losing one sets 'lost' instead.

   forwardOnly is for opening a NEW opportunity: a fresh one starts early
   by definition, and a company already in negotiation should not be sent
   back to Prospecting for having a second deal opened on it. Moving an
   existing opportunity back IS a step back and is allowed to say so. */
function applyAccountStageFromDeals(id, forwardOnly) {
  const rec = state.offtakers.find(o => o.id === id);
  if (!rec) return null;
  const target = accountStageFromDeals(id);
  if (!target) return null;
  const st = sfStageOf(target);
  if (!st) return null;
  /* Filing the first opportunity against a lead IS the move into the
     pipeline, so the stage is written even when it matches the one the
     record's status already implied. Without this a lead picks up an
     opportunity at Prospecting, reads as already being there, and keeps an
     empty stage column - which is the one thing that decides whether it
     sits in Prospects or in the Pipeline. */
  const already = sfStageFor(rec) === target;
  if (already && rec.sfStage) return null;
  if (!already && forwardOnly && sfStageIndex(target) < sfStageIndex(sfStageFor(rec))) return null;
  rec.sfStage = target;
  rec.status = target === 'closed' ? 'contracted' : st.status;
  pushOfftaker(rec);
  /* Stamped, but nothing actually moved - so the caller logs no move. */
  return already ? null : st.label;
}

/* ─── THE LINE BETWEEN A LEAD AND AN OPPORTUNITY ───────────────
   This predicate decides which of two folders a company lives in, and a
   record is in exactly one of them:

     false  Off-taker Prospects — a lead. Researched, nobody working it.
            No sales stage, no board position, no dwell clock, nothing
            that measures a process, because there is no process yet.
     true   Pipeline — an opportunity somebody is actually working. It
            picks up the sales path, the stage budgets and the funnel.

   Crossing the line is an act somebody takes ("Work it"), never something
   that happens by looking at a record, and the stage on the record IS
   that act — which is why a lead carries no stage rather than defaulting
   to Prospecting. Without the distinction the first column of the board
   is three hundred cards nobody has called, every conversion figure is
   measured against a list of strangers, and both lists show the same
   companies while answering different questions. */
function inPipeline(rec) {
  if (!rec) return false;
  if (rec.sfStage && sfStageOf(rec.sfStage)) return true;
  /* An opportunity filed against a company is a sales process by
     definition, whatever the stage column says. */
  if (dealsFor(rec.id).length) return true;
  /* Records that predate the stage but have plainly been worked: a status
     past prospect only gets written by somebody moving them along. */
  return !!rec.status && rec.status !== 'prospect' && rec.status !== 'parked';
}
/* The accounts being worked, within the province scope. Only the Dashboard and the
   Pipeline ask, and both follow the scope. */
function pipelineAccounts() { return scopedOfftakers().filter(inPipeline); }

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

/* ─── DAYS IN STAGE ────────────────────────────────────
   Nothing records when an account entered its stage, so this reads the
   best evidence there is and says which one it used. In order:

     stage     the last logged stage change — the real answer
     activity  no move logged, so the last thing anybody did here
     record    nothing logged at all, so when the row itself last changed

   The weaker two are not padding. An account with no stage change and no
   call in four months is exactly what "stalled" is meant to surface, and
   refusing to show a number for it would hide the worst cases. What is
   not done is pretending they are the same measurement: the basis travels
   with the number everywhere it is shown. */
function logsForAccount(rec) {
  if (!rec || !rec.id) return [];
  return state.interactions
    .filter(i => i.offtakerId === rec.id)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

function daysSince(when) {
  const day = String(when || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const then = Date.parse(day + 'T00:00:00Z');
  if (!Number.isFinite(then)) return null;
  const today = Date.parse(todayISO() + 'T00:00:00Z');
  return Math.max(0, Math.round((today - then) / 86400000));
}

function stageDwell(rec) {
  const logs = logsForAccount(rec);
  const moved = logs.find(i => i.type === 'stage change');
  if (moved && daysSince(moved.date) !== null) {
    return { days: daysSince(moved.date), basis: 'stage', since: String(moved.date).slice(0, 10) };
  }
  if (logs.length && daysSince(logs[0].date) !== null) {
    return { days: daysSince(logs[0].date), basis: 'activity', since: String(logs[0].date).slice(0, 10) };
  }
  const days = rec ? daysSince(rec.updatedAt) : null;
  return days === null ? null : { days, basis: 'record', since: String(rec.updatedAt).slice(0, 10) };
}

const DWELL_BASIS_NOTE = {
  stage: 'since the stage last changed',
  activity: 'no stage change logged — since the last activity here',
  record: 'nothing logged at all — since the record itself last changed',
};

function stallLimit(rec) { return (sfStageOf(sfStageFor(rec)) || {}).stallDays || null; }

function isStalled(rec) {
  const d = stageDwell(rec);
  const limit = stallLimit(rec);
  return !!(d && limit && d.days > limit);
}

/* The number as a chip, for a card or a table cell. Amber once it is past
   the stage's own patience, with the basis and the date in the tooltip so
   nobody has to trust a bare figure. */
function dwellChipHtml(rec) {
  /* Time at a stage only means something once there is a stage. Leads
     have none, and stageDwell falls back to the last activity or the
     record's own timestamp, so without this guard every lead reports a
     number for a sales process it is not in. Off-taker Prospects no
     longer draws this chip at all; the guard stays for the callers that
     take any account, municipalities included. */
  if (!inPipeline(rec)) return '<span style="color:var(--muted)">—</span>';
  const d = stageDwell(rec);
  if (!d) return '<span style="color:var(--muted)">—</span>';
  const stalled = isStalled(rec);
  const limit = stallLimit(rec);
  const title = d.days + ' days — ' + DWELL_BASIS_NOTE[d.basis] + ' (' + d.since + ')' +
    (limit ? '. ' + (stalled ? 'Past' : 'Within') + ' the ' + limit + ' days this stage is given.' : '');
  return '<span class="chip' + (stalled ? ' chip-stalled' : '') + '" title="' + esc(title) + '">' +
    (stalled ? icon('alert', 11) + ' ' : '') + d.days + 'd</span>';
}

/* The same thing as a sentence, for the top of a record. */
function dwellSentenceHtml(rec) {
  const d = stageDwell(rec);
  if (!d) return '';
  const stage = (sfStageOf(sfStageFor(rec)) || {}).label || '';
  const head = d.basis === 'stage'
    ? d.days + ' day' + (d.days === 1 ? '' : 's') + ' at ' + stage
    : d.days + ' day' + (d.days === 1 ? '' : 's') + ' untouched';
  return '<span class="dwell-note' + (isStalled(rec) ? ' stalled' : '') + '" title="' +
    esc(DWELL_BASIS_NOTE[d.basis] + ' (' + d.since + ')') + '">' + esc(head) +
    (isStalled(rec) ? ' — worth a nudge' : '') + '</span>';
}

/* The path itself. Salesforce draws it as chevrons across the top of a
   record and it is the one control a rep uses every day, so it sits on the
   page rather than behind an edit form: one click moves the account. */
function sfPathHtml(rec) {
  const current = sfStageFor(rec);
  const at = sfStageIndex(current);
  const lost = sfIsClosedLost(rec);
  return '<div class="sfpath">' + SF_STAGES.map((st, i) => {
    const label = st.id === 'closed' && i === at ? (lost ? 'Closed lost' : 'Closed won') : st.label;
    const cls = i < at ? ' done' : i === at ? (lost ? ' current lost' : ' current') : '';
    return '<button class="sfp-step' + cls + '" title="' + esc(st.hint) + '" ' +
      'onclick="setSfStage(' + jsStr(rec.id) + ',' + jsStr(st.id) + ')">' +
      esc(label) + '</button>';
  }).join('') + '</div>';
}

/* There is deliberately no card for a company outside the pipeline. A
   greyed-out path used to sit on every lead, and drawing the five stages
   at all - even idle - claims a sales process that does not exist. The
   move that starts one is the "Work it" button in the record's header;
   the stages appear the moment it lands in the Pipeline. */

/* The card the path sits in, with the stage's own one-line definition
   underneath so nobody has to guess what "Needs Analysis" means here. */
function sfPathCardHtml(rec) {
  const st = sfStageOf(sfStageFor(rec)) || {};
  return '<div class="card">' +
    '<div class="card-header"><div><div class="card-title">Sales stage</div>' +
    '<div class="card-sub">' + esc(st.hint || '') + '</div></div>' +
    '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px">' + dwellSentenceHtml(rec) + sfStageBadge(rec) +
      '<button class="btn btn-outline btn-xs" data-admin-only ' +
      'title="Put this back on Off-taker Prospects with no sales stage - for a company moved in by mistake" ' +
      'onclick="removeFromPipeline(' + jsStr(rec.id) + ')">' +
      icon('logout', 12) + ' Take out of the pipeline</button>' +
    '</div></div>' +
    sfPathHtml(rec) +
  '</div>';
}

/* ─── OPPORTUNITY OWNERSHIP ───────────────────────────────────────
   A deal hangs off an offtaker, or off a prospect while the load is still
   unknown. Everything that renders a deal asks here rather than reaching
   for offtakerId directly, so a prospect's opportunity is never shown as
   belonging to an unknown company. */
/* Kept for the few callers that still ask "what is filed against this
   company" without knowing it is now always an offtaker. */
function dealsForProspect(id) { return dealsFor(id); }
function interactionsForProspect(id) {
  return state.interactions.filter(i => i.offtakerId === id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function dealAccount(d) {
  if (d && d.offtakerId) {
    /* getAccount, not getOfftaker: the id column carries municipalities
       too, and a deal filed against one has to resolve to its own page
       rather than reading as an unknown account. */
    const o = getAccount(d.offtakerId);
    if (o.id) return { id: o.id, name: o.short || o.name, view: accountView(o.id), kind: 'offtaker' };
  }
  return { id: '', name: 'Unknown account', view: '', kind: 'none' };
}

/* ─── ROUTING ─────────────────────────────────────────────────── */
const ID_SCOPED_VIEWS = new Set(['detail', 'sector', 'org-map', 'project']);

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
  if (typeof selectionReset === 'function') selectionReset();   // a ticked row belongs to the page it was ticked on
  if (extra.id) { if (view === 'sector') state.sectorId = extra.id; else if (view === 'project') state.projectId = extra.id; else state.detailId = extra.id; }
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const target = document.querySelector('[data-view="' + (view === 'project' ? 'projects' : view) + '"]');
  if (target) target.classList.add('active');
  toggleSidebar(false);
  closeMenus();
  const tab = bottomTabFor(view);
  document.querySelectorAll('.bb-tab').forEach(el =>
    el.classList.toggle('active', tab === 'more' ? el.hasAttribute('data-more') : el.dataset.view === tab));

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
  if (view === 'project' && !(id && state.projects.some(p => p.id === id))) { view = 'projects'; id = null; }
  if (id) { if (view === 'sector') state.sectorId = id; else if (view === 'project') state.projectId = id; else state.detailId = id; }
  nav(view, id ? { id } : {}, true);
});

/* The trail above a page's title. A record page is a child of a list: a lead's
   is under Off-taker Prospects, an account in the pipeline's under Pipeline, and
   the org map is a step below its account. Everything else keeps the plain way
   back to the Dashboard. Each step is { label, on? }; the last has no link. */
function crumbsFor(view) {
  if (view === 'dashboard') return [];
  if (view === 'detail' || view === 'org-map') {
    const o = getOfftaker(state.detailId);
    if (o.id) {
      const parent = inPipeline(o) ? { label: 'Pipeline', on: "nav('pipeline')" } : { label: 'Off-taker Prospects', on: "nav('offtakers')" };
      const name = o.short || o.name;
      return view === 'detail'
        ? [parent, { label: name }]
        : [parent, { label: name, on: 'nav(\'detail\',{id:' + jsStr(o.id) + '})' }, { label: 'Org map' }];
    }
  }
  if (view === 'project') {
    const site = state.projects.find(p => p.id === state.projectId);
    if (site) return [{ label: 'Projects', on: "nav('projects')" }, { label: site.name }];
  }
  if (view === 'sector') {
    const s = sectorOf(state.sectorId);
    if (s) return [{ label: 'Sectors', on: "nav('sectors')" }, { label: s.name }];
  }
  if (view === 'municipality') {
    const m = muniOf(state.detailId);
    if (m) return [{ label: 'Municipalities', on: "nav('municipalities')" }, { label: m.name }];
  }
  /* The import wizard belongs to the list it fills. */
  if (view === 'import') {
    const k = importKind(state.imp && state.imp.kind);
    return [{ label: k === 'offtakers' ? 'Off-taker Prospects' : 'Contacts', on: "nav('" + IMPORT_KINDS[k].view + "')" }, { label: 'Import CSV' }];
  }
  return [{ label: 'Dashboard', on: "nav('dashboard')", back: true }];
}

function renderBackToMain() {
  const host = document.getElementById('back-to-main');
  if (!host) return;
  const crumbs = crumbsFor(state.view);
  if (!crumbs.length) { host.innerHTML = ''; return; }
  if (crumbs.length === 1 && crumbs[0].back) {
    host.innerHTML = '<div class="back-btn" onclick="' + crumbs[0].on + '">&larr; Back to ' + esc(crumbs[0].label) + '</div>';
    return;
  }
  host.innerHTML = '<nav class="crumbs" aria-label="Breadcrumb">' + crumbs.map(c => c.on
    ? '<a onclick="' + c.on + '">' + esc(c.label) + '</a>'
    : '<span aria-current="page">' + esc(c.label) + '</span>').join('<i>/</i>') + '</nav>';
}

function render() {
  const views = {
    dashboard: renderDashboard,
    pipeline: renderPipeline,
    offtakers: renderOfftakers,
    detail: renderDetail,
    municipalities: renderMunicipalities,
    municipality: renderMunicipality,
    'org-map': renderOrgMap,
    sectors: renderSectors,
    sector: renderSector,
    prospects: renderContactFinder,
    regions: renderRegions,
    contacts: renderContacts,
    projects: renderProjects,
    map: renderMap,
    analytics: renderAnalytics,
    calculator: renderCalculator,
    playbook: renderPlaybook,
    activity: renderActivity,
    news: renderNews,
    project: renderProject,
    agenthq: renderAgentHQ,
    settings: renderSettings,
    import: renderImport,
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

/* `opts.record` marks a record page: its header card carries the name and the
   actions, so the page header keeps only the breadcrumb (the title stays in the
   page for screen readers). Every other page resets it. */
function setPage(title, sub, actions, opts) {
  document.getElementById('page-title').textContent = title;
  const note = scopeNote(state.view, state.province);
  document.getElementById('page-sub').textContent = [sub, note].filter(Boolean).join(' · ');
  document.getElementById('page-actions').innerHTML = actions || '';
  document.getElementById('page-head').classList.toggle('is-record', !!(opts && opts.record));
}
function setContent(html) { document.getElementById('content').innerHTML = html; }

function updateNavBadges() {
  /* The badge is a count of what is waiting in Prospects. Anything moved
     into the pipeline is being worked and is not a lead any more, so it
     drops out of the badge on the way across. */
  const hot = state.offtakers.filter(o => !inPipeline(o) && fitScore(o) >= 70).length;
  const el = document.getElementById('nav-offtakers-badge');
  if (el) { el.textContent = hot; el.style.display = hot ? '' : 'none'; }
  const dueEl = document.getElementById('nav-activity-badge');
  const due = state.deals.filter(d => d.closeDate && d.closeDate <= todayISO() && d.stage !== 'closed').length;
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
  if (e.key === 'Escape') {
    document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open'));
    closeMenus();
    toggleSidebar(false);
  }
});
document.addEventListener('click', e => {
  if (e.target.classList && e.target.classList.contains('overlay')) e.target.classList.remove('open');
  /* A click anywhere outside an open menu closes it. */
  if (!(e.target.closest && e.target.closest('.menu-wrap'))) closeMenus();
});

/* ─── SHELL: menus, sidebar sheet, bottom bar ─────────────────── */
/* The top bar's two menus (+ New and the account). Only one is open at a time. */
function closeMenus() {
  document.querySelectorAll('.menu').forEach(m => { m.hidden = true; });
  document.querySelectorAll('.menu-wrap [aria-expanded]').forEach(b => b.setAttribute('aria-expanded', 'false'));
}
function toggleMenu(id, ev) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  const menu = document.getElementById(id);
  if (!menu) return;
  const open = menu.hidden;
  closeMenus();
  menu.hidden = !open;
  const trigger = menu.parentElement && menu.parentElement.querySelector('[aria-expanded]');
  if (trigger) trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
}

/* The sidebar is a slide-over sheet on a phone; the bottom bar's More opens it. */
function toggleSidebar(force) {
  const sb = document.getElementById('sidebar');
  const scrim = document.getElementById('sb-scrim');
  if (!sb) return;
  const on = sb.classList.toggle('open', force);
  if (scrim) scrim.classList.toggle('open', on);
}

/* Which bottom-bar tab is lit for a page. Record pages light none of them;
   everything that has no tab of its own lives under More. */
function bottomTabFor(view) {
  if (['dashboard', 'offtakers', 'pipeline', 'contacts'].includes(view)) return view;
  if (['detail', 'org-map', 'sector', 'municipality'].includes(view)) return null;
  return 'more';
}

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

/* "/" jumps to the search box from anywhere that is not a field, and Escape in the box clears it
   and lets go. A "/" typed into a field that takes text, or with Ctrl, Cmd or Alt held, is left alone;
   so is one pressed while a dialog or drawer is open, or before sign-in, when there is no search to
   reach. An open menu or the phone's sidebar sheet is closed first, so focus never lands behind it.
   A checkbox, radio or button takes no text (a row's tick box keeps focus after a click), so it is
   not a field for this purpose. */
const NON_TEXT_INPUTS = ['button', 'checkbox', 'radio', 'range', 'color', 'file', 'image', 'reset', 'submit'];
function isTypingTarget(el) {
  const tag = el && el.tagName;
  if (tag === 'INPUT') return !NON_TEXT_INPUTS.includes(String(el.type || 'text').toLowerCase());
  return tag === 'TEXTAREA' || tag === 'SELECT' || !!(el && el.isContentEditable);
}
function searchShortcut(e) {
  const shell = document.getElementById('app-shell');
  return e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing && !isTypingTarget(e.target) &&
    !(shell && shell.style.display === 'none') && !document.querySelector('.overlay.open');
}
function searchKey(e) {
  if (e.key !== 'Escape') return;
  closeSearch();
  e.target.blur();
}
document.addEventListener('keydown', e => {
  if (!searchShortcut(e)) return;
  e.preventDefault();
  closeMenus();
  toggleSidebar(false);
  document.getElementById('global-search-input').focus();
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

/* Each export is a row builder over any list, and a button that downloads it. A page's own
   Export passes the list its filters leave; called bare (the sidebar's Export offtakers)
   it exports the whole book. Export selected on a table uses the same builders. */
function offtakerCsvRows(list) {
  const head = ['id', 'name', 'short', 'sector', 'province', 'city', 'website', 'annual_gwh', 'peak_mw',
    'current_tariff_r_kwh', 'supply', 'wheeling', 'nmd_mva', 'status', 'priority', 'fit_score',
    'nearest_project', 'distance_km', 'contacts', 'description'];
  return [head].concat(list.map(o => {
    const np = nearestProject(o);
    return [o.id, o.name, o.short, sectorName(o.sector), o.province, o.city, o.website,
      o.annualGwh, o.peakMw, o.tariff, o.supply, WHEELING_LABEL[o.wheeling] || o.wheeling, o.nmd,
      STATUS_LABEL[o.status] || o.status, o.priority, fitScore(o),
      np ? np.project.name : '', np ? np.km : '', contactsFor(o.id).length, o.description];
  }));
}
function exportOfftakers(list) {
  const rows = list || state.offtakers;
  downloadCSV('aee-offtakers-' + todayISO() + '.csv', offtakerCsvRows(rows));
  toast('Exported ' + rows.length + ' offtakers');
}

/* A contact's company is an off-taker or a municipality, so the company and province
   columns are read from the account, not from the off-taker table alone. */
function contactCsvRows(list) {
  const head = ['first', 'last', 'title', 'department', 'offtaker', 'sector', 'province', 'email', 'phone', 'linkedin', 'role', 'priority', 'status', 'notes'];
  return [head].concat(list.map(c => {
    const o = getAccount(c.offtakerId);
    return [c.first, c.last, c.title, c.dept, o.name || '', o.sector ? sectorName(o.sector) : '', provinceOfAccount(c.offtakerId),
      c.email, c.phone, c.linkedin, c.role, c.priority, c.status, c.notes];
  }));
}
function exportContacts(list) {
  const rows = list || state.contacts;
  downloadCSV('aee-contacts-' + todayISO() + '.csv', contactCsvRows(rows));
  toast('Exported ' + rows.length + ' contacts');
}

function pipelineCsvRows(deals) {
  const head = ['opportunity', 'account', 'account_type', 'project', 'mw', 'stage', 'tariff_r_kwh', 'tenor_years',
    'probability_pct', 'annual_value_r', 'lifetime_value_r', 'weighted_value_r', 'close_date', 'notes'];
  return [head].concat(deals.map(d => {
    const stage = PIPELINE_STAGES.find(s => s.id === d.stage);
    const acc = dealAccount(d);
    return [d.name, acc.name, acc.kind, getProject(d.projectId).name || '', d.mw,
      stage ? stage.label : d.stage, d.tariff, d.tenor, d.probability,
      Math.round(dealAnnualValue(d)), Math.round(dealLifetimeValue(d)), Math.round(weightedValue(d)),
      d.closeDate, d.notes];
  }));
}
function exportPipeline(deals) {
  const rows = deals || state.deals;
  downloadCSV('aee-pipeline-' + todayISO() + '.csv', pipelineCsvRows(rows));
  toast('Exported ' + rows.length + ' opportunities');
}

/* The separator a file uses. Excel on South African settings saves "CSV" with
   semicolons (the comma is its decimal mark) and some tools write tabs; read
   it off the header line, ignoring anything inside quotes. */
function csvDelimiter(text) {
  let q = false; const n = { ',': 0, ';': 0, '\t': 0 };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') q = !q;
    else if (!q) { if (ch === '\n') break; if (ch in n) n[ch]++; }
  }
  return n[';'] > n[','] && n[';'] >= n['\t'] ? ';' : n['\t'] > n[','] ? '\t' : ',';
}
/* The rows of a CSV, blank rows dropped. The array also carries `lines`: for each row, the line of
   the file it starts on (the first line is 1), so a page can point at the row a person has to fix
   even when blank rows were dropped or a quoted cell ran over several lines. */
function parseCSV(text) {
  text = String(text).replace(/^\uFEFF/, '');
  const sep = csvDelimiter(text);
  const rows = [], starts = []; let row = [], cell = '', q = false, line = 1, start = 1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n') line++;
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); starts.push(start); row = []; cell = ''; start = line; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); starts.push(start); }
  const out = [];
  out.lines = [];
  rows.forEach((r, i) => { if (r.some(c => String(c).trim())) { out.push(r); out.lines.push(starts[i]); } });
  return out;
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

/* A company can span provinces; its province then reads "Mpumalanga / Limpopo",
   and the earlier loads wrote some of them with "KZN". Filters and "same
   province" matching work on the individual provinces, so a company in two is
   found under either, not stranded under a combination nobody would pick. */
function provincesOf(text) {
  return String(text || '').split('/').map(p => provinceFromText(p)).filter(Boolean);
}
function inProvince(o, province) { return provincesOf(o && o.province).includes(province); }
/* The provinces a list can be filtered by. The chosen province stays on offer even when
   nothing in this list sits there, so a select always shows what is narrowing the page. */
function provinceChoices(list) {
  const found = list.flatMap(o => provincesOf(o.province));
  return [...new Set(state.province ? found.concat(state.province) : found)].sort();
}

/* ─── PROVINCE SCOPE ──────────────────────────────────────────────
   One province filter for the whole app. The switcher in the top bar sets it;
   every page that lists records narrows to it. It is remembered on this device.
   "" means all provinces. A company that spans provinces is in scope for either. */
function storedProvince() {
  try {
    const v = localStorage.getItem(STORE_PREFIX + 'province');
    return SA_PROVINCES.includes(v) ? v : '';
  } catch (e) { return ''; }
}

/* Is a record whose province reads `provinceText` inside `scope`? */
function provinceInScope(scope, provinceText) {
  return !scope || provincesOf(provinceText).includes(scope);
}
function inScope(o) { return provinceInScope(state.province, o && o.province); }

/* Anything that is not one of the nine provinces means all of them, so a stale or
   mistyped value can never narrow the app to nothing. True when the scope changed. */
function setProvince(p) {
  const v = SA_PROVINCES.includes(p) ? p : '';
  const changed = v !== state.province;
  state.province = v;
  try { localStorage.setItem(STORE_PREFIX + 'province', v); } catch (e) {}
  syncProvinceSwitch();
  return changed;
}

/* The pages that grew their own province select keep their old names for it
   (offProvince, muniProvince, newsProvince, cfProvince). They are now the same
   setting as the switcher: reading one gives the scope, writing one sets it, so
   there is one province filter in the app and never two that disagree. */
function linkProvinceFilters(s) {
  ['offProvince', 'muniProvince', 'newsProvince', 'cfProvince'].forEach(k =>
    Object.defineProperty(s, k, { get: () => s.province, set: v => { setProvince(v); }, enumerable: false, configurable: true }));
}

function provinceSwitchHtml(chosen) {
  return '<option value="">All provinces</option>' + SA_PROVINCES.map(p =>
    '<option value="' + p + '"' + (p === chosen ? ' selected' : '') + '>' + p + '</option>').join('');
}
function syncProvinceSwitch() {
  const el = document.getElementById('province-switch');
  if (!el) return;
  el.innerHTML = provinceSwitchHtml(state.province);
  el.value = state.province;
  el.classList.toggle('on', !!state.province);
}

/* The top-bar switcher. Sizes change with the scope, so every list goes back to page one,
   and a company filter that has fallen out of scope is dropped rather than left to
   show an empty page that looks broken. */
function onProvinceSwitch(p) {
  setProvince(p);
  state.offPage = state.contactPage = state.muniPage = state.prospectPage = 1;
  if (state.contactOfftaker && !accountInScope(state.contactOfftaker)) state.contactOfftaker = '';
  render();
}

/* What the scope leaves in. Each hands back the whole set, not a copy, when no
   province is chosen. A deal, a contact or a log entry is filed against an account, and
   that account is an off-taker or a municipality, so it takes that account's province.
   A record filed against nothing is in no single province. */
function provinceOfAccount(id) {
  const o = state.offtakers.find(x => x.id === id);
  if (o) return o.province || '';
  return isMunicipalityId(id) ? (MUNI_BY_ID[id].province || '') : '';
}
function accountInScope(id) { return provinceInScope(state.province, provinceOfAccount(id)); }
function scopedOfftakers() { return state.province ? state.offtakers.filter(inScope) : state.offtakers; }
function scopedDeals() { return state.province ? state.deals.filter(d => accountInScope(d.offtakerId)) : state.deals; }
function scopedContacts() { return state.province ? state.contacts.filter(c => accountInScope(c.offtakerId)) : state.contacts; }
function scopedInteractions() { return state.province ? state.interactions.filter(i => accountInScope(i.offtakerId)) : state.interactions; }
function scopedProjects() { return state.province ? state.projects.filter(p => provinceInScope(state.province, p.province)) : state.projects; }

/* Which pages follow the scope and which do not, so the page header can say so while a
   province is chosen. A switcher that quietly covers only some pages is read as covering
   all of them. Record pages (one company, one site) are not labelled either way. */
const SCOPED_VIEWS = new Set(['dashboard', 'offtakers', 'contacts', 'municipalities', 'prospects',
  'pipeline', 'activity', 'news', 'map']);
const UNSCOPED_VIEWS = new Set(['projects', 'regions', 'sectors', 'analytics', 'agenthq',
  'calculator', 'playbook']);
function scopeNote(view, province) {
  if (!province) return '';
  if (SCOPED_VIEWS.has(view)) return province;
  if (UNSCOPED_VIEWS.has(view)) return 'all provinces';
  return '';
}

/* A municipality named in a contact file's company column. Accepts what
   people actually write — "Polokwane", "Polokwane Local Municipality",
   "City of Cape Town Metro" — and what an agent writes, the id
   "mun_MP312" or the bare code "MP312", which is the form the finder
   docs insist on.

   Names are NOT unique: Emalahleni is MP312 (Witbank) in Mpumalanga and
   EC136 (Lady Frere) in the Eastern Cape. So a name that fits more than
   one comes back as every candidate rather than the first, and the
   caller narrows by province or leaves the row unassigned. Picking one
   here would file a Witbank official under Lady Frere and nobody would
   notice until a letter went to the wrong council. */
function municipalitiesFromText(text, province) {
  const raw = String(text || '').trim();
  if (!raw || typeof SA_MUNICIPALITIES === 'undefined') return [];

  /* An id or code anywhere in the cell wins outright — it is exact. Only
     a token that LOOKS like a code counts (WC023, MP312, or a metro's
     three capitals), so a name word is never mistaken for one. */
  for (const tok of raw.split(/[^A-Za-z0-9_]+/)) {
    if (MUNI_BY_ID[tok]) return [MUNI_BY_ID[tok]];
    if (/^[A-Z]{2,3}\d{3}$/.test(tok) || /^[A-Z]{3}$/.test(tok)) {
      if (MUNI_BY_ID['mun_' + tok]) return [MUNI_BY_ID['mun_' + tok]];
    }
  }

  const key = t => String(t || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(city of|metropolitan|metro|local|district|municipality)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
  const want = key(raw);
  if (!want) return [];

  let hits = SA_MUNICIPALITIES.filter(m => key(m.name) === want);
  if (hits.length > 1 && province) {
    const p = provinceFromText(province);
    const narrowed = hits.filter(m => m.province === p);
    if (narrowed.length) hits = narrowed;
  }
  return hits;
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
    '<div class="gate-mark brand"><svg viewBox="0 0 44 44" width="46" height="46" aria-hidden="true"><use href="#aeeg-mark" fill="url(#aeeg-mk)"/></svg></div>' +
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
  el.style.display = '';
  el.innerHTML =
    '<button class="acct-btn" onclick="toggleMenu(\'acct-menu\', event)" aria-haspopup="menu" aria-expanded="false" ' +
      'aria-label="Account" title="' + esc(toDisplayName(email)) + '">' +
      '<span class="av" style="background:' + avatarColor(email) + '">' + esc((email[0] || '?').toUpperCase()) + '</span></button>' +
    '<div class="menu menu-right" id="acct-menu" role="menu" hidden>' +
      '<div class="menu-head"><div class="ub-email">' + esc(toDisplayName(email)) + '</div>' +
      '<div class="ub-role">' + (role === 'admin' ? 'Admin' : 'Read only') + '</div></div>' +
      '<button class="menu-item" role="menuitem" onclick="signOut()">' + icon('logout', 14) + ' Sign out</button>' +
    '</div>';
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
  if (view === 'project' && !state.projects.some(p => p.id === id)) view = 'projects';
  nav(view, id ? { id } : {}, true);
}

async function boot() {
  document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon, 17); });
  syncProvinceSwitch();
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
