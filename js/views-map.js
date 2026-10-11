/* ═══════════════════════════════════════════════════════════════════
   Map: offtakers against generation sites
   A side panel and the map. The panel says how many are plotted, lists the AEE sites and each
   sector group as a checklist (any number of them at once), and explains what size and colour
   mean. The map takes the rest of the width and the screen's height. Marker colour and size
   are unchanged, and the map follows the province scope.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

let _map = null;

/* Matches the .b-grp-* badge palette in styles.css, so a group reads the
   same colour on the map as it does on a card. */
const GROUP_COLOR = {
  'heavy-industry': '#C0452B', 'manufacturing': '#C48A1E', 'commercial': '#8A5FA3',
  'digital': '#BE4F7A', 'logistics': '#3F7F9A', 'utilities-public': '#7C8A94',
  'primary': '#6F8A2E', 'emerging': '#3F8A74',
};

/* What is hidden is what the checklist has unticked: the AEE sites ("projects") and any
   sector group. Everything is shown to begin with. */
function mapShowKeys() { return ['projects'].concat(Object.keys(SECTOR_GROUPS)); }
function toggleMapShow(key) {
  const h = state.mapHidden || [];
  state.mapHidden = h.includes(key) ? h.filter(k => k !== key) : h.concat(key);
  renderMap();
}
function setMapShow(which) { state.mapHidden = which === 'none' ? mapShowKeys() : []; renderMap(); }

/* The off-takers in each sector group, so a line says how many it would add to the map. */
function mapGroupCounts(offtakers) {
  const counts = {};
  Object.keys(SECTOR_GROUPS).forEach(g => { counts[g] = 0; });
  offtakers.forEach(o => { const g = sectorGroup(o.sector); counts[g] = (counts[g] || 0) + 1; });
  return counts;
}

/* Exactly what is drawn. An early-stage site has no place on the map yet, and a hidden group
   or the hidden sites leave nothing behind. */
function mapPlot(offtakers, projects, hidden) {
  const h = hidden || [];
  return {
    offtakers: offtakers.filter(o => !h.includes(sectorGroup(o.sector))),
    sites: h.includes('projects') ? [] : projects.filter(p => p.status !== 'pipeline'),
  };
}

function renderMap() {
  setPage('Map', 'Offtaker load against generation sites across South Africa', '');
  const offtakers = scopedOfftakers();
  const sites = scopedProjects().filter(p => p.status !== 'pipeline');
  const hidden = state.mapHidden || [];
  const plot = mapPlot(offtakers, scopedProjects(), hidden);
  const counts = mapGroupCounts(offtakers);

  const row = (key, label, color, n) =>
    '<label class="map-row"><input type="checkbox" class="map-check"' + (hidden.includes(key) ? '' : ' checked') +
    ' onchange="toggleMapShow(\'' + key + '\')"><span class="map-dot" style="background:' + color + '"></span>' +
    '<span class="map-lbl">' + esc(label) + '</span><span class="map-n">' + n + '</span></label>';

  const panel = '<aside class="map-panel card">' +
    '<div class="map-plotted"><b>' + (plot.offtakers.length + plot.sites.length) + '</b> plotted</div>' +
    '<div class="map-sec"><span>Show</span><span><button class="btn btn-ghost btn-xs" onclick="setMapShow(\'all\')">All</button>' +
      '<button class="btn btn-ghost btn-xs" onclick="setMapShow(\'none\')">None</button></span></div>' +
    row('projects', 'AEE sites', 'var(--accent)', sites.length) +
    Object.entries(SECTOR_GROUPS).map(([k, v]) => row(k, v, GROUP_COLOR[k] || '#7C8A94', counts[k] || 0)).join('') +
    '<div class="map-sec"><span>Legend</span></div>' +
    '<div class="map-key"><span class="map-key-circle small"></span><span class="map-key-circle big"></span> Circle size is annual consumption</div>' +
    '<div class="map-key"><span class="map-key-site">' + icon('sun', 12) + '</span> An AEE generation site</div>' +
    '<div class="fg-hint" style="margin-top:10px">Colour is the sector group. Offtakers without exact coordinates are placed at the centre of their province.</div>' +
  '</aside>';

  setContent('<div class="map-layout">' + panel + '<div class="map-main"><div id="map-canvas"></div></div></div>');
  setTimeout(initMap, 60);
}

/* The basemap follows the page theme: forced by data-theme, else the system setting. */
function mapIsDark() {
  const t = document.documentElement.dataset.theme;
  if (t) return t === 'dark';
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function initMap() {
  const el = document.getElementById('map-canvas');
  if (!el || typeof L === 'undefined') return;
  /* Ticking a box redraws the page, so keep where the rep had panned and zoomed to. */
  const view = _map ? { c: _map.getCenter(), z: _map.getZoom() } : null;
  if (_map) { _map.remove(); _map = null; }
  _map = L.map(el, { scrollWheelZoom: true }).setView(view ? view.c : [-28.8, 25.0], view ? view.z : 5.4);
  /* Esri's gray canvas, light or dark — keyless, and the same basemap the other regional
     CRMs use, so the maps read consistently side by side. Labels come as a
     separate reference layer drawn over the markers' basemap. */
  const tone = mapIsDark() ? 'Dark' : 'Light';
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_' + tone + '_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri', maxZoom: 16,
  }).addTo(_map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_' + tone + '_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 16, pane: 'shadowPane',
  }).addTo(_map);

  const plot = mapPlot(scopedOfftakers(), scopedProjects(), state.mapHidden);

  plot.sites.forEach(p => {
    L.marker([p.lat, p.lng], {
      icon: L.divIcon({
        className: '', iconSize: [26, 26], iconAnchor: [13, 13],
        html: '<div style="width:26px;height:26px;border-radius:7px;background:var(--accent);' +
          'display:flex;align-items:center;justify-content:center;color:var(--on-accent);box-shadow:0 2px 10px rgba(31,20,16,.35)">' +
          icon('sun', 15) + '</div>',
      }),
    }).addTo(_map).bindPopup(
      '<b style="color:var(--accent)">' + esc(p.name) + '</b><br>' +
      fmtNum(p.mw) + ' MW · ' + esc(p.town) + ', ' + esc(p.province) + '<br>' +
      '<span style="color:var(--muted)">COD ' + esc(p.cod) + '</span>');
  });

  plot.offtakers.forEach(o => {
    const [lat, lng] = offtakerCoords(o);
    const r = Math.max(7, Math.min(26, Math.sqrt(num(o.annualGwh)) * 0.55));
    const color = GROUP_COLOR[sectorGroup(o.sector)] || '#7C8A94';
    L.circleMarker([lat, lng], {
      radius: r, color, weight: 1.5, fillColor: color, fillOpacity: .28,
    }).addTo(_map).bindPopup(
      '<b>' + esc(o.name) + '</b><br>' +
      fmtNum(o.annualGwh) + ' GWh/yr · ' + fmtNum(o.peakMw) + ' MW peak<br>' +
      esc(sectorName(o.sector)) + '<br>R' + num(o.tariff).toFixed(2) + '/kWh · fit ' + fitScore(o) + '/100<br>' +
      '<span style="color:var(--accent);cursor:pointer" onclick="nav(\'detail\',{id:\'' + o.id + '\'})">Open record &rarr;</span>');
  });
}
