/* ═══════════════════════════════════════════════════════════════════
   REGIONS — each generation site against the industrial load inside
   its catchment.

   This answers the question wheeling actually turns on: who can we
   physically sell this site's output to? Distance organises the whole
   screen, because a short wheeling path means a lower use-of-system
   charge, and that gap is frequently the entire margin.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* Beyond roughly 250–300 km the wheeling charge starts eating the
   saving, so these bands are commercial rather than cartographic. */
const CATCHMENT_BANDS = [
  { max: 50, label: 'On the doorstep' },
  { max: 150, label: 'Short wheel' },
  { max: 300, label: 'Same corridor' },
];

/* Everything carrying coordinates — offtakers and prospects alike —
   measured from one generation site. */
function loadNearSite(project, maxKm) {
  const rows = [];

  state.offtakers.forEach(o => {
    const [lat, lng] = offtakerCoords(o);
    const km = haversineKm(lat, lng, project.lat, project.lng);
    if (km <= maxKm) {
      rows.push({ kind: 'offtaker', id: o.id, name: o.name, sectorId: o.sector,
        km, gwh: num(o.annualGwh), status: o.status, town: o.city });
    }
  });

  state.prospects.forEach(p => {
    if (!num(p.lat) || !num(p.lng)) return;
    if (p.status === 'promoted') return;   // already tracked as an offtaker
    const km = haversineKm(p.lat, p.lng, project.lat, project.lng);
    if (km <= maxKm) {
      rows.push({ kind: 'prospect', id: p.id, name: p.name, sectorId: p.sectorId,
        km, gwh: 0, status: p.status, town: p.town, note: p.note });
    }
  });

  return rows.sort((a, b) => a.km - b.km);
}

function siteCommitted(p) {
  return state.deals
    .filter(d => d.projectId === p.id && d.stage !== 'lost')
    .reduce((s, d) => s + num(d.mw), 0);
}

function renderRegions() {
  const sites = state.projects
    .filter(p => p.status !== 'pipeline')
    .map(p => {
      const committed = siteCommitted(p);
      return { p, committed, unsold: Math.max(0, num(p.mw) - committed), near: loadNearSite(p, 300) };
    })
    .sort((a, b) => b.unsold - a.unsold);

  const totalUnsold = sites.reduce((s, x) => s + x.unsold, 0);
  const located = state.prospects.filter(x => num(x.lat)).length;

  setPage('Regions', fmtNum(totalUnsold) + ' MW unsold across ' + sites.length + ' sites · ' + located + ' located prospects',
    '<button class="btn btn-outline btn-sm" onclick="exportRegions()">' + icon('download', 14) + ' Export</button>' +
    '<button class="btn btn-outline btn-sm" onclick="nav(\'map\')">' + icon('map', 14) + ' Map</button>');

  const intro =
    '<div class="card" style="margin-bottom:14px;border-left:3px solid var(--accent2)">' +
      '<div class="card-title" style="margin-bottom:6px">Sold by proximity, not by sector</div>' +
      '<div style="font-size:12px;color:var(--muted2);line-height:1.6;max-width:92ch">' +
      'Sites are ordered by unsold capacity, so whichever needs the most attention comes first. ' +
      'Within each site, load is ordered by distance: a buyer 20 km away carries a materially lower ' +
      'use-of-system charge than one 200 km away. Prospects deliberately carry no consumption figure ' +
      'until someone establishes it — an invented MW number would find its way into a quote.' +
      '</div></div>';

  const cards = sites.map(({ p, committed, unsold, near }) => {
    const pct = Math.min(100, (committed / Math.max(1, num(p.mw))) * 100);
    const offtakers = near.filter(x => x.kind === 'offtaker');
    const prospects = near.filter(x => x.kind === 'prospect');
    const knownGwh = offtakers.reduce((s, x) => s + x.gwh, 0);

    const bands = CATCHMENT_BANDS.map((band, i) => {
      const lo = i === 0 ? 0 : CATCHMENT_BANDS[i - 1].max;
      /* The first band is inclusive at its lower bound, or a buyer sitting
         on the site itself (0 km) falls through every band and vanishes. */
      const inBand = near.filter(x => (i === 0 ? x.km >= lo : x.km > lo) && x.km <= band.max);
      if (!inBand.length) return '';
      return '<div class="form-section-title" style="margin-top:14px">' +
          esc(band.label) + ' — ' + lo + '–' + band.max + ' km (' + inBand.length + ')</div>' +
        inBand.map(regionRowHtml).join('');
    }).join('');

    return '<div class="card">' +
      '<div class="card-header">' +
        '<div><div class="card-title">' + esc(p.town) + ' — ' + esc(p.name) + '</div>' +
        '<div class="card-sub">' + esc(p.province) + ' · ' + fmtNum(p.mw) + ' MW · COD ' + esc(p.cod) + '</div></div>' +
        '<span class="badge ' + (unsold > 50 ? 'b-high' : unsold > 5 ? 'b-medium' : 'b-contracted') + '">' +
        fmtNum(unsold) + ' MW unsold</span>' +
      '</div>' +
      '<div class="fit-bar" style="margin-bottom:12px"><span data-w="' + pct + '" style="background:' +
        (pct >= 90 ? 'var(--danger)' : pct >= 50 ? 'var(--accent2)' : 'var(--accent)') + '"></span></div>' +
      '<div class="calc-out" style="margin-bottom:4px">' +
        '<div class="calc-tile"><div class="calc-tile-v">' + near.length + '</div>' +
        '<div class="calc-tile-l">Load in catchment</div>' +
        '<div class="calc-tile-s">' + offtakers.length + ' tracked, ' + prospects.length + ' to work</div></div>' +
        '<div class="calc-tile amber"><div class="calc-tile-v">' + (knownGwh ? fmtNum(knownGwh) + ' GWh' : '—') + '</div>' +
        '<div class="calc-tile-l">Known annual load</div>' +
        '<div class="calc-tile-s">from tracked offtakers only</div></div>' +
        '<div class="calc-tile blue"><div class="calc-tile-v">' + (near[0] ? near[0].km + ' km' : '—') + '</div>' +
        '<div class="calc-tile-l">Nearest load</div>' +
        '<div class="calc-tile-s">' + (near[0] ? esc(near[0].name) : 'nothing located yet') + '</div></div>' +
      '</div>' +
      (bands || '<div class="fg-hint" style="margin-top:12px">No located load within 300 km yet. ' +
        'Either the sweep has not reached this district, or it genuinely has little industrial demand — ' +
        'in which case the site needs a buyer further out, or an aggregated deal.</div>') +
    '</div>';
  }).join('');

  setContent(intro + '<div class="grid-2">' + cards + '</div>');
  growBars();
}

function regionRowHtml(x) {
  const go = x.kind === 'offtaker'
    ? 'nav(\'detail\',{id:\'' + x.id + '\'})'
    : 'openProspectFromRegion(' + jsStr(x.name) + ')';
  return '<div class="person-row" style="cursor:pointer" onclick="' + go + '">' +
    '<div style="min-width:0;flex:1">' +
      '<div class="person-name">' + esc(x.name) +
        (x.kind === 'offtaker' ? ' <span class="badge b-contracted" style="font-size:9px">offtaker</span>' : '') +
      '</div>' +
      '<div class="person-title">' + esc(sectorName(x.sectorId)) +
        (x.town ? ' · ' + esc(x.town) : '') +
        (x.gwh ? ' · ' + fmtNum(x.gwh) + ' GWh/yr' : '') +
      '</div>' +
    '</div>' +
    '<span style="font-size:11.5px;color:var(--muted2);font-variant-numeric:tabular-nums;white-space:nowrap">' +
      x.km + ' km</span>' +
  '</div>';
}

/* Jump to the prospect list filtered to one company. */
function openProspectFromRegion(name) {
  state.prospectSearch = name;
  state.prospectSector = ''; state.prospectTier = ''; state.prospectStatus = '';
  state.prospectPage = 1;
  nav('prospects');
}

function exportRegions() {
  const head = ['site', 'site_province', 'site_mw', 'unsold_mw', 'company', 'kind',
    'sector', 'town', 'distance_km', 'known_gwh', 'status'];
  const rows = [head];
  state.projects.filter(p => p.status !== 'pipeline').forEach(p => {
    const unsold = Math.max(0, num(p.mw) - siteCommitted(p));
    loadNearSite(p, 300).forEach(x => {
      rows.push([p.town, p.province, p.mw, unsold, x.name, x.kind,
        sectorName(x.sectorId), x.town || '', x.km, x.gwh || '', x.status]);
    });
  });
  downloadCSV('aee-regional-targets-' + todayISO() + '.csv', rows);
  toast('Exported ' + (rows.length - 1) + ' site and company pairs');
}
