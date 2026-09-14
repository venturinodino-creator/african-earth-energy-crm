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
  projects: [],

  role: null,   // 'admin' | 'viewer' | 'pending' | null (signed out)
  email: null,

  view: 'dashboard',
  detailId: null,
  editOfftakerId: null,
  editContactId: null,
  editDealId: null,
  deleteTarget: null,

  offView: localStorage.getItem(STORE_PREFIX + 'off_view') || 'grid',
  offSearch: '', offSector: '', offStatus: '', offProvince: '',
  offSort: { field: 'fit', dir: 'desc' },
  offPage: 1,

  contactSearch: '', contactOfftaker: '', contactRole: '',
  contactSort: { field: 'last', dir: 'asc' },
  contactPage: 1,

  mapFilter: 'all',
  pbFilter: '',
};

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

function getOfftaker(id) { return state.offtakers.find(o => o.id === id) || {}; }
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
function nearestProject(o) {
  const [lat, lng] = offtakerCoords(o);
  let best = null, bestKm = Infinity;
  for (const p of state.projects) {
    if (p.status === 'pipeline') continue;
    const km = haversineKm(lat, lng, p.lat, p.lng);
    if (km < bestKm) { bestKm = km; best = p; }
  }
  return best ? { project: best, km: bestKm } : null;
}

/* Fit score, 0–100. A single number the sales team can sort by so the
   call list starts with the offtakers most likely to sign. Weighted:
   size of load, how flat it is, current tariff headroom, wheeling
   feasibility, and distance to the nearest generation site. */
function fitScore(o) {
  const gwh = num(o.annualGwh);
  const sizeScore = Math.min(30, (gwh / 1000) * 30);                       // 1 TWh+ maxes out

  const peak = num(o.peakMw);
  const lf = peak > 0 ? Math.min(1, (gwh * 1000) / (peak * 8760)) : 0;     // load factor
  const shapeScore = lf * 22;                                              // flat load suits solar+BESS

  const tariffScore = Math.max(0, Math.min(20, (num(o.tariff) - 1.10) * 22)); // headroom vs our ~R1.10 target

  const wheelScore = { yes: 16, likely: 11, unknown: 5, no: 0 }[o.wheeling] ?? 5;

  const np = nearestProject(o);
  const distScore = np ? Math.max(0, 12 - (np.km / 60)) : 0;               // 0 km = 12, 720 km+ = 0

  return Math.round(Math.max(0, Math.min(100, sizeScore + shapeScore + tariffScore + wheelScore + distScore)));
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
const DEFAULT_PPA_TARIFF = 1.10;   // R/kWh, indicative
const DEFAULT_ESCALATION = 5.0;    // % a year
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
      supaFetch('aee_offtakers?select=*&order=name'),
      supaFetch('aee_contacts?select=*&order=last'),
      supaFetch('aee_deals?select=*&order=mw.desc'),
      supaFetch('aee_interactions?select=*&order=date.desc'),
    ]);
    state.offtakers = (offtakers || []).map(rowToOfftaker);
    state.contacts = (contacts || []).map(rowToContact);
    state.deals = (deals || []).map(rowToDeal);
    state.interactions = (interactions || []).map(rowToInteraction);
    cacheLocally();
  } catch (e) {
    console.warn('Could not reach Supabase, falling back to the local cache:', e);
    const cache = lsGet('cache', null);
    if (cache) {
      state.offtakers = cache.offtakers || [];
      state.contacts = cache.contacts || [];
      state.deals = cache.deals || [];
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
    offtakers: state.offtakers, contacts: state.contacts,
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

/* ─── ROUTING ─────────────────────────────────────────────────── */
const ID_SCOPED_VIEWS = new Set(['detail']);

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
  if (extra.id) state.detailId = extra.id;
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
  if (ID_SCOPED_VIEWS.has(view) && !(id && getOfftaker(id).id)) { view = 'offtakers'; id = null; }
  if (id) state.detailId = id;
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
    contacts: renderContacts,
    projects: renderProjects,
    map: renderMap,
    analytics: renderAnalytics,
    calculator: renderCalculator,
    playbook: renderPlaybook,
    activity: renderActivity,
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
      rows.push({ t: o.name, s: SECTOR_LABEL[o.sector] + ' · ' + o.city, go: "nav('detail',{id:'" + o.id + "'})" });
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
    return [o.id, o.name, o.short, SECTOR_LABEL[o.sector] || o.sector, o.province, o.city, o.website,
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
    return [c.first, c.last, c.title, c.dept, o.name || '', SECTOR_LABEL[o.sector] || '', o.province || '',
      c.email, c.phone, c.linkedin, c.role, c.priority, c.status, c.notes];
  }));
  downloadCSV('aee-contacts-' + todayISO() + '.csv', rows);
  toast('Exported ' + state.contacts.length + ' contacts');
}

function exportPipeline() {
  const head = ['opportunity', 'offtaker', 'project', 'mw', 'stage', 'tariff_r_kwh', 'tenor_years',
    'probability_pct', 'annual_value_r', 'lifetime_value_r', 'weighted_value_r', 'close_date', 'notes'];
  const rows = [head].concat(state.deals.map(d => {
    const stage = PIPELINE_STAGES.find(s => s.id === d.stage);
    return [d.name, getOfftaker(d.offtakerId).name || '', getProject(d.projectId).name || '', d.mw,
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

let _importRows = [];
function openImport() {
  _importRows = [];
  document.getElementById('imp-file').value = '';
  document.getElementById('imp-preview').innerHTML =
    '<div class="fg-hint">Choose a CSV with a header row. Recognised columns: first, last, title, department, company, email, phone, linkedin, notes.</div>';
  document.getElementById('imp-go').disabled = true;
  openModal('modal-import');
}
function previewImport(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCSV(String(reader.result));
    if (rows.length < 2) { document.getElementById('imp-preview').innerHTML = '<div class="fg-hint">That file has no data rows.</div>'; return; }
    const head = rows[0].map(h => h.trim().toLowerCase());
    const find = (...names) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
    const idx = {
      first: find('first', 'first name', 'firstname', 'given name'),
      last: find('last', 'last name', 'lastname', 'surname', 'family name'),
      title: find('title', 'job title', 'position', 'role'),
      dept: find('department', 'dept', 'division'),
      company: find('company', 'organisation', 'organization', 'offtaker', 'account'),
      email: find('email', 'email address', 'e-mail'),
      phone: find('phone', 'mobile', 'telephone', 'cell'),
      linkedin: find('linkedin', 'linkedin url', 'profile'),
      notes: find('notes', 'note', 'comment'),
    };
    if (idx.first < 0 && idx.last < 0) {
      document.getElementById('imp-preview').innerHTML = '<div class="fg-hint" style="color:var(--warn)">No name column found. Add a "First" and "Last" column and try again.</div>';
      return;
    }
    _importRows = rows.slice(1).map(r => {
      const v = i => (i >= 0 ? String(r[i] || '').trim() : '');
      const companyName = v(idx.company);
      const match = state.offtakers.find(o =>
        companyName && (o.name.toLowerCase().includes(companyName.toLowerCase()) ||
          (o.short || '').toLowerCase() === companyName.toLowerCase()));
      return {
        first: v(idx.first), last: v(idx.last), title: v(idx.title), dept: v(idx.dept),
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
  };
  reader.readAsText(file);
}
function runImport() {
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
  const view = p.get('view') || 'dashboard';
  const id = p.get('id');
  if (id) state.detailId = id;
  nav(ID_SCOPED_VIEWS.has(view) && !getOfftaker(id).id ? 'offtakers' : view, id ? { id } : {}, true);
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
