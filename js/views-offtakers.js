/* ═══════════════════════════════════════════════════════════════════
   Offtakers — the target list, and the detail page a rep works from
   before and after a call.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

function offSortVal(o, field) {
  switch (field) {
    case 'fit': return fitScore(o);
    case 'load': return num(o.annualGwh);
    case 'peak': return num(o.peakMw);
    case 'tariff': return num(o.tariff);
    case 'contacts': return contactsFor(o.id).length;
    case 'sector': return sectorName(o.sector);
    case 'status': return ['prospect', 'engaged', 'qualified', 'negotiating', 'contracted', 'lost'].indexOf(o.status);
    case 'distance': { const np = nearestProject(o); return np ? np.km : 99999; }
    default: return String(o[field] || '');
  }
}

function filteredOfftakers() {
  const term = state.offSearch.toLowerCase();
  let list = state.offtakers.filter(o => {
    if (term && !(o.name + ' ' + o.short + ' ' + o.city + ' ' + o.province + ' ' + o.description).toLowerCase().includes(term)) return false;
    if (state.offSector && o.sector !== state.offSector) return false;
    if (state.offStatus && o.status !== state.offStatus) return false;
    if (state.offProvince && o.province !== state.offProvince) return false;
    return true;
  });
  return sortBy(list, state.offSort, offSortVal);
}

function renderOfftakers() {
  const list = filteredOfftakers();
  const totalGwh = list.reduce((s, o) => s + num(o.annualGwh), 0);
  setPage('Offtakers', state.offtakers.length + ' companies tracked · ' + fmtNum(totalGwh) + ' GWh/yr addressable',
    viewToggle('offView') +
    '<button class="btn btn-outline btn-sm" data-admin-only onclick="openImport(\'offtakers\')">' + icon('upload', 14) + ' Import CSV</button>' +
    '<button class="btn btn-outline btn-sm" onclick="exportOfftakers()">' + icon('download', 14) + ' Export</button>' +
    '<button class="btn btn-primary btn-sm" data-admin-only onclick="openAddOfftaker()">' + icon('plus', 14) + ' Add offtaker</button>');

  const provinces = [...new Set(state.offtakers.map(o => o.province))].sort();
  const toolbar =
    '<div class="toolbar">' +
      '<div class="search-wrap"><span class="search-icon">' + icon('search', 14) + '</span>' +
      '<input placeholder="Search company, city or notes..." value="' + esc(state.offSearch) + '" ' +
      'oninput="state.offSearch=this.value;state.offPage=1;renderOfftakers()"></div>' +
      '<select class="flt" onchange="state.offSector=this.value;state.offPage=1;renderOfftakers()">' +
        '<option value="">All sectors</option>' + sectorOptions(state.offSector) + '</select>' +
      selectFlt('offStatus', 'All statuses', Object.entries(STATUS_LABEL)) +
      selectFlt('offProvince', 'All provinces', provinces.map(p => [p, p])) +
      '<span class="result-count">' + list.length + ' result' + (list.length === 1 ? '' : 's') + '</span>' +
    '</div>';

  if (!list.length) {
    setContent(toolbar + '<div class="empty"><div class="ei">' + icon('search', 30) + '</div>' +
      '<h3>No offtakers match</h3><p>Loosen the filters, or add a company you are working that is not on the list yet.</p></div>');
    return;
  }

  if (state.offView === 'grid') {
    setContent(toolbar + '<div class="ent-grid">' + list.map(offtakerCardHtml).join('') + '</div>');
  } else {
    setContent(toolbar + offtakerTableHtml(list));
  }
  growBars();
}

function selectFlt(key, allLabel, pairs) {
  return '<select class="flt" onchange="state.' + key + '=this.value;state.offPage=1;renderOfftakers()">' +
    '<option value="">' + esc(allLabel) + '</option>' +
    pairs.map(([v, l]) => '<option value="' + esc(v) + '"' + (state[key] === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('') +
    '</select>';
}

function offtakerCardHtml(o) {
  const f = fitScore(o);
  const np = nearestProject(o);
  const cc = contactsFor(o.id).length;
  const lf = Math.round(loadFactor(o) * 100);
  return '<div class="ec" onclick="nav(\'detail\',{id:\'' + o.id + '\'})">' +
    '<div class="ec-head">' +
      '<div class="ec-icon">' + sectorIcon(o.sector, 18) + '</div>' +
      sectorBadge(o.sector) +
    '</div>' +
    '<h3>' + esc(o.name) + '</h3>' +
    (o.short ? '<div class="short">' + esc(o.short) + '</div>' : '') +
    '<div class="meta">' + icon('pin', 13) + esc(o.city) + ', ' + esc(o.province) + '</div>' +
    '<div class="ec-metrics">' +
      '<div class="ec-metric"><div class="ec-metric-v">' + fmtNum(o.annualGwh) + '</div><div class="ec-metric-l">GWh / yr</div></div>' +
      '<div class="ec-metric"><div class="ec-metric-v">R' + num(o.tariff).toFixed(2) + '</div><div class="ec-metric-l">per kWh now</div></div>' +
      '<div class="ec-metric"><div class="ec-metric-v">' + fmtNum(o.peakMw) + ' MW</div><div class="ec-metric-l">peak demand</div></div>' +
      '<div class="ec-metric"><div class="ec-metric-v">' + lf + '%</div><div class="ec-metric-l">load factor</div></div>' +
    '</div>' +
    '<div class="fit-row"><span>Fit score</span><span style="color:' + fitColor(f) + '">' + f + ' / 100</span></div>' +
    '<div class="fit-bar"><span data-w="' + f + '" style="background:' + fitColor(f) + '"></span></div>' +
    '<div class="ec-footer">' +
      '<span>' + (np ? esc(np.project.town) + ' · ' + distanceLabel(np) : 'no nearby site') + '</span>' +
      '<span class="badge b-' + o.status + '">' + esc(STATUS_LABEL[o.status] || o.status) + '</span>' +
    '</div>' +
    '<div class="ec-footer" style="border-top:none;padding-top:0;margin-top:6px">' +
      '<span>' + icon('contacts', 13) + ' ' + cc + ' contact' + (cc === 1 ? '' : 's') + '</span>' +
      '<div class="ec-actions">' +
        '<button class="btn btn-xs btn-outline" data-admin-only onclick="event.stopPropagation();openEditOfftaker(\'' + o.id + '\')">' + icon('edit', 12) + '</button>' +
        '<button class="btn btn-xs btn-danger" data-admin-only onclick="event.stopPropagation();confirmDelete(\'offtaker\',\'' + o.id + '\')">' + icon('trash', 12) + '</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function offtakerTableHtml(list) {
  const s = state.offSort;
  const th = (field, label) => '<th class="' + thClass(field, s) + '" onclick="toggleSort(state.offSort,\'' + field + '\',renderOfftakers)">' + label + sortArrow(field, s) + '</th>';
  return '<div class="table-wrap"><table><thead><tr>' +
    th('name', 'Offtaker') + th('sector', 'Sector') + th('province', 'Province') +
    th('load', 'GWh/yr') + th('peak', 'Peak MW') + th('tariff', 'R/kWh') +
    th('distance', 'Nearest site') + th('fit', 'Fit') + th('status', 'Status') + th('contacts', 'Contacts') +
    '<th>Actions</th></tr></thead><tbody>' +
    list.map(o => {
      const f = fitScore(o), np = nearestProject(o);
      return '<tr class="clickable" onclick="nav(\'detail\',{id:\'' + o.id + '\'})">' +
        '<td><div class="name-cell"><span style="opacity:.6;display:flex">' + sectorIcon(o.sector, 15) + '</span>' +
          '<div><div style="font-weight:700">' + esc(o.name) + '</div>' +
          '<div style="font-size:10.5px;color:var(--muted)">' + esc(o.city) + '</div></div></div></td>' +
        '<td>' + sectorBadge(o.sector) + '</td>' +
        '<td>' + esc(o.province) + '</td>' +
        '<td class="num">' + fmtNum(o.annualGwh) + '</td>' +
        '<td class="num">' + fmtNum(o.peakMw) + '</td>' +
        '<td class="num">' + num(o.tariff).toFixed(2) + '</td>' +
        '<td>' + (np ? esc(np.project.town) + ' <span style="color:var(--muted)">' + distanceLabel(np) + '</span>' : '—') + '</td>' +
        '<td class="num" style="color:' + fitColor(f) + ';font-weight:800">' + f + '</td>' +
        '<td><span class="badge b-' + o.status + '">' + esc(STATUS_LABEL[o.status] || o.status) + '</span></td>' +
        '<td class="num">' + contactsFor(o.id).length + '</td>' +
        '<td onclick="event.stopPropagation()" style="white-space:nowrap">' +
          (safeHref(o.website) ? '<a class="ext-link" href="' + esc(safeHref(o.website)) + '" target="_blank" rel="noopener">Site</a> ' : '') +
          '<button class="btn btn-xs btn-outline" data-admin-only onclick="openEditOfftaker(\'' + o.id + '\')">' + icon('edit', 12) + '</button> ' +
          '<button class="btn btn-xs btn-danger" data-admin-only onclick="confirmDelete(\'offtaker\',\'' + o.id + '\')">' + icon('trash', 12) + '</button>' +
        '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

/* ═══════════════════════════════════════════════════════════════
   DETAIL — everything a rep needs on one screen before dialling
   ═══════════════════════════════════════════════════════════════ */
function renderDetail() {
  const o = getOfftaker(state.detailId);
  if (!o.id) { nav('offtakers'); return; }

  const f = fitScore(o);
  const np = nearestProject(o);
  const people = contactsFor(o.id);
  const deals = dealsFor(o.id);
  const logs = interactionsFor(o.id);
  const model = savingsModel(o.annualGwh, o.tariff, DEFAULT_PPA_TARIFF, 100, 20, ESKOM_ESCALATION, DEFAULT_ESCALATION);

  setPage(o.short || o.name, sectorName(o.sector) + ' · ' + esc(o.city) + ', ' + esc(o.province),
    '<button class="btn btn-outline btn-sm" onclick="nav(\'org-map\',{id:\'' + o.id + '\'})" title="Visual org chart: who sits where">' + icon('grid', 14) + ' Org map</button>' +
    '<button class="btn btn-outline btn-sm" onclick="openLogInteraction(\'' + o.id + '\')">' + icon('note', 14) + ' Log activity</button>' +
    '<button class="btn btn-outline btn-sm" onclick="openAddContact(\'' + o.id + '\')">' + icon('plus', 14) + ' Add contact</button>' +
    '<button class="btn btn-primary btn-sm" onclick="openAddDeal(\'' + o.id + '\')">' + icon('bolt', 14) + ' New opportunity</button>');

  const hero =
    '<div class="detail-hero">' +
      '<div class="dh-top">' +
        '<div class="dh-icon">' + sectorIcon(o.sector, 24) + '</div>' +
        '<div style="flex:1;min-width:220px">' +
          '<div class="dh-title">' + esc(o.name) + '</div>' +
          '<div class="dh-sub">' +
            sectorBadge(o.sector) +
            '<span class="badge b-' + o.status + '">' + esc(STATUS_LABEL[o.status] || o.status) + '</span>' +
            '<span class="badge b-' + o.priority + '">' + esc(o.priority) + ' priority</span>' +
            (o.estimated ? '<span class="chip" title="Load figures are desk estimates — verify with the customer">' + icon('alert', 11) + ' estimated load</span>' : '') +
            (safeHref(o.website) ? '<a class="ext-link" href="' + esc(safeHref(o.website)) + '" target="_blank" rel="noopener">Website</a>' : '') +
          '</div>' +
          (o.description ? '<p style="font-size:12.5px;color:var(--muted2);line-height:1.6;margin-top:10px;max-width:70ch">' + esc(o.description) + '</p>' : '') +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-shrink:0">' +
          '<button class="btn btn-outline btn-sm" onclick="openEditOfftaker(\'' + o.id + '\')">' + icon('edit', 13) + ' Edit</button>' +
        '</div>' +
      '</div>' +
      '<div class="dh-metrics">' +
        dhMetric(fmtNum(o.annualGwh), 'GWh a year', true) +
        dhMetric(fmtNum(o.peakMw) + ' MW', 'Peak demand') +
        dhMetric(Math.round(loadFactor(o) * 100) + '%', 'Load factor') +
        dhMetric('R' + num(o.tariff).toFixed(2), 'Current tariff') +
        dhMetric(f + '/100', 'Fit score', true) +
        dhMetric(distanceLabel(np), np ? 'to ' + np.project.town + (np.approx ? ' (approx)' : '') : 'no nearby site') +
      '</div>' +
    '</div>';

  /* The pitch block — the numbers a rep quotes on the call. */
  const pitch =
    '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">The pitch</div>' +
      '<div class="card-sub">Indicative, at R' + DEFAULT_PPA_TARIFF.toFixed(2) + '/kWh over 20 years, full load covered</div></div>' +
      '<button class="btn btn-ghost btn-xs" onclick="openCalcFor(\'' + o.id + '\')">Model it</button></div>' +
      '<div class="calc-out">' +
        '<div class="calc-tile"><div class="calc-tile-v">' + fmtR(model.year1Saving) + '</div>' +
        '<div class="calc-tile-l">Year one saving</div>' +
        '<div class="calc-tile-s">' + fmtR(model.year1Current) + ' now vs ' + fmtR(model.year1Ppa) + ' on a PPA</div></div>' +
        '<div class="calc-tile amber"><div class="calc-tile-v">' + fmtR(model.totalSaving) + '</div>' +
        '<div class="calc-tile-l">20-year saving</div>' +
        '<div class="calc-tile-s">' + model.pctSaving.toFixed(0) + '% below the projected tariff path</div></div>' +
        '<div class="calc-tile blue"><div class="calc-tile-v">' + fmtNum(model.co2) + ' t</div>' +
        '<div class="calc-tile-l">CO₂e avoided a year</div>' +
        '<div class="calc-tile-s">at ' + GRID_EMISSION_FACTOR + ' t/MWh grid factor</div></div>' +
      '</div>' +
      '<div class="fg-hint" style="margin-top:12px">Assumes ' + ESKOM_ESCALATION + '% a year on the current tariff and ' +
      DEFAULT_ESCALATION + '% on the PPA. Quote as indicative until half-hourly data has been modelled.</div>' +
    '</div>';

  /* What the desk knows about this sector as a whole. */
  const sec = sectorOf(o.sector);
  const sectorCard = sec ? '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">Sector — ' + esc(sec.name) + '</div>' +
      '<div class="card-sub">Tier ' + sec.tier + ' · PPA fit ' + sec.ppaFit + '/5 · ' + esc(sec.cycleMonths) + ' month cycle</div></div>' +
      '<button class="btn btn-ghost btn-xs" onclick="nav(\'sector\',{id:\'' + sec.id + '\'})">Open</button></div>' +
      '<dl class="kv">' +
        '<dt>Typical load</dt><dd>' + esc(sec.loadMw) + ' MW</dd>' +
        '<dt>Typical deal</dt><dd>' + esc(sec.dealMw) + ' MW</dd>' +
        '<dt>Load profile</dt><dd>' + esc(sec.profile) + '</dd>' +
        '<dt>Solar match</dt><dd>' + esc(sec.solarMatch) + '</dd>' +
      '</dl>' +
      '<div class="form-section-title" style="margin-top:14px">Structures that work here</div>' +
      '<ul class="check-list">' + sec.structures.slice(0, 3).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
    '</div>' : '';

  const supply =
    '<div class="card">' +
      '<div class="card-header"><div class="card-title">Supply &amp; connection</div></div>' +
      '<dl class="kv">' +
        '<dt>Supply authority</dt><dd>' + esc({ eskom: 'Eskom direct', municipal: 'Municipal', mixed: 'Mixed' }[o.supply] || o.supply || '—') + '</dd>' +
        '<dt>Wheeling</dt><dd>' + esc(WHEELING_LABEL[o.wheeling] || '—') + '</dd>' +
        '<dt>Notified max demand</dt><dd>' + (num(o.nmd) ? fmtNum(o.nmd) + ' MVA' : '—') + '</dd>' +
        '<dt>Nearest AEE site</dt><dd>' + (np ? esc(np.project.name) + ' — ' + distanceLabel(np) : '—') + '</dd>' +
        '<dt>Site capacity</dt><dd>' + (np ? fmtNum(np.project.mw) + ' MW, COD ' + esc(np.project.cod) : '—') + '</dd>' +
      '</dl>' +
      (np && np.approx ? '<div class="fg-hint" style="margin-top:12px;color:var(--warn)">' + esc(APPROX_DISTANCE_NOTE) + '</div>' : '') +
      (np ? '<div class="fg-hint" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">' + esc(np.project.note) + '</div>' : '') +
    '</div>';

  /* The contacts card. Rendered from views-orgmap.js so the "who is
     here" panel above it and this list stay in step — the panel's
     segments filter exactly what this card shows. */
  const contactsHtml = contactsCardHtml(o);

  const dealsHtml =
    '<div class="card">' +
      '<div class="card-header"><div class="card-title">Opportunities (' + deals.length + ')</div>' +
      '<button class="btn btn-ghost btn-xs" onclick="openAddDeal(\'' + o.id + '\')">Add</button></div>' +
      (deals.length ? deals.map(d => {
        const st = PIPELINE_STAGES.find(s => s.id === d.stage) || {};
        return '<div class="person-row" style="cursor:pointer" onclick="openEditDeal(\'' + d.id + '\')">' +
          '<div style="min-width:0;flex:1">' +
            '<div class="person-name">' + fmtNum(d.mw) + ' MW · ' + esc(getProject(d.projectId).town || 'unassigned') + '</div>' +
            '<div class="person-title">' + esc(st.label || d.stage) + ' · ' + num(d.tenor) + ' yr at R' + num(d.tariff).toFixed(2) + '/kWh · ' + num(d.probability) + '% likely</div>' +
          '</div>' +
          '<div class="person-actions"><span style="font-weight:800;color:var(--accent);font-size:12.5px">' + fmtR(dealAnnualValue(d)) + '/yr</span></div>' +
        '</div>';
      }).join('')
        : '<div class="empty" style="padding:26px 10px"><h3>No opportunity yet</h3><p>Create one once you know roughly how many MW they could take.</p></div>') +
    '</div>';

  const logHtml =
    '<div class="card">' +
      '<div class="card-header"><div class="card-title">Activity (' + logs.length + ')</div>' +
      '<button class="btn btn-ghost btn-xs" onclick="openLogInteraction(\'' + o.id + '\')">Log</button></div>' +
      (logs.length ? logs.map(i =>
        '<div class="int-row"><div class="int-dot"></div><div class="int-body">' +
        '<div class="int-meta">' + esc(i.type) + ' · ' + esc(i.date) + ' · ' + relTime(i.date) + '</div>' +
        '<div class="int-text">' + esc(i.summary) + '</div></div>' +
        '<button class="btn btn-xs btn-ghost" data-admin-only onclick="deleteInteraction(\'' + i.id + '\')">' + icon('trash', 11) + '</button></div>').join('')
        : '<div class="empty" style="padding:26px 10px"><h3>Nothing logged</h3><p>Log every call. The next rep to pick this account up will thank you.</p></div>') +
    '</div>';

  const outreach =
    '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">Outreach templates</div>' +
      '<div class="card-sub">Pre-filled with this offtaker\'s details</div></div>' +
      '<button class="btn btn-ghost btn-xs" onclick="nav(\'playbook\')">Full playbook</button></div>' +
      PLAYBOOK.filter(p => p.tag === 'Cold email' || p.tag === 'Follow-up').map(p =>
        '<div class="person-row" style="cursor:pointer" onclick="copyTemplate(\'' + p.id + '\',\'' + o.id + '\')">' +
          '<div style="min-width:0;flex:1"><div class="person-name">' + esc(p.title) + '</div>' +
          '<div class="person-title">' + esc(p.tag) + ' — click to copy, filled in for ' + esc(o.short || o.name) + '</div></div>' +
          '<div class="person-actions">' + icon('copy', 14) + '</div>' +
        '</div>').join('') +
    '</div>';

  /* The sector workbook's own questions and objections, filtered to this
     account's sector. Reference material a rep reads once and then keeps
     open, rather than something they act on first — so it sits at the
     bottom of the page, full width, below everything account-specific. */
  const qCard = questionsCardHtml(o.sector, 'For ' + sectorName(o.sector));
  const oCard = objectionsCardHtml(o.sector);
  const reference = (qCard || oCard)
    ? '<div class="cols-2" style="margin-top:14px">' + qCard + oCard + '</div>'
    : '';

  setContent(hero + pitch +
    '<div style="margin-top:14px">' + contactMixHtml(o, people) + '</div>' +
    '<div class="cols-2" style="margin-top:14px">' +
      '<div style="display:flex;flex-direction:column;gap:14px">' + contactsHtml + logHtml + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:14px">' + supply + sectorCard + dealsHtml + outreach + '</div>' +
    '</div>' + reference);
}

function dhMetric(value, label, hl) {
  return '<div class="dh-metric' + (hl ? ' hl' : '') + '"><div class="dh-metric-v">' + value + '</div>' +
    '<div class="dh-metric-l">' + esc(label) + '</div></div>';
}

/* Fill a playbook template for a given offtaker and put it on the clipboard. */
function fillTemplate(body, o) {
  const np = nearestProject(o);
  const c = contactsFor(o.id)[0];
  const map = {
    name: o.name, firstName: (c && c.first) || 'there', city: o.city, province: o.province,
    annualGwh: fmtNum(o.annualGwh), mw: fmtNum(Math.round(num(o.peakMw) * 0.4)),
    project: np ? np.project.name : 'our nearest project',
    projectMw: np ? fmtNum(np.project.mw) : '',
    projectProvince: np ? np.project.province : '',
    cod: np ? np.project.cod : '',
    distance: np && !np.approx ? np.km + ' km' : 'a short wheeling distance',
    sender: 'Your name, African Earth Energy',
  };
  return body.replace(/\{\{(\w+)\}\}/g, (m, k) => (map[k] !== undefined ? map[k] : m));
}

function copyTemplate(templateId, offtakerId) {
  const t = PLAYBOOK.find(p => p.id === templateId);
  if (!t) return;
  const text = offtakerId ? fillTemplate(t.body, getOfftaker(offtakerId)) : t.body;
  navigator.clipboard.writeText(text)
    .then(() => toast('Copied "' + t.title + '" to the clipboard'))
    .catch(() => {
      /* Clipboard API needs a secure context — fall back to a selectable box. */
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Copied to the clipboard'); }
      catch (e) { toast('Could not copy — select the text manually', 'warn'); }
      document.body.removeChild(ta);
    });
}

/* ═══════════════════════════════════════════════════════════════
   CONTACTS
   ═══════════════════════════════════════════════════════════════ */
const ROLE_LABEL = { decision: 'Decision maker', influencer: 'Influencer', technical: 'Technical', gatekeeper: 'Gatekeeper' };

function contactSortVal(c, field) {
  switch (field) {
    case 'offtaker': return getOfftaker(c.offtakerId).name || 'zzz';
    case 'role': return ['decision', 'influencer', 'technical', 'gatekeeper'].indexOf(c.role);
    case 'priority': return ['high', 'medium', 'low'].indexOf(c.priority);
    default: return String(c[field] || '');
  }
}

function renderContacts() {
  const term = state.contactSearch.toLowerCase();
  let list = state.contacts.filter(c => {
    const o = getOfftaker(c.offtakerId);
    if (term && !((c.first + ' ' + c.last + ' ' + c.title + ' ' + c.dept + ' ' + (o.name || '')).toLowerCase().includes(term))) return false;
    if (state.contactOfftaker && c.offtakerId !== state.contactOfftaker) return false;
    if (state.contactRole && c.role !== state.contactRole) return false;
    return true;
  });
  list = sortBy(list, state.contactSort, contactSortVal);

  setPage('Contacts', state.contacts.length + ' people across ' +
    new Set(state.contacts.map(c => c.offtakerId).filter(Boolean)).size + ' offtakers',
    viewToggle('contactView') +
    '<button class="btn btn-outline btn-sm" data-admin-only onclick="openImport(\'contacts\')">' + icon('upload', 14) + ' Import CSV</button>' +
    '<button class="btn btn-outline btn-sm" onclick="exportContacts()">' + icon('download', 14) + ' Export</button>' +
    '<button class="btn btn-primary btn-sm" data-admin-only onclick="openAddContact()">' + icon('plus', 14) + ' Add contact</button>');

  const toolbar =
    '<div class="toolbar">' +
      '<div class="search-wrap"><span class="search-icon">' + icon('search', 14) + '</span>' +
      '<input placeholder="Search name, title or company..." value="' + esc(state.contactSearch) + '" ' +
      'oninput="state.contactSearch=this.value;state.contactPage=1;renderContacts()"></div>' +
      '<select class="flt" onchange="state.contactOfftaker=this.value;state.contactPage=1;renderContacts()">' +
        '<option value="">All offtakers</option>' +
        state.offtakers.map(o => '<option value="' + esc(o.id) + '"' + (state.contactOfftaker === o.id ? ' selected' : '') + '>' + esc(o.short || o.name) + '</option>').join('') +
      '</select>' +
      '<select class="flt" onchange="state.contactRole=this.value;state.contactPage=1;renderContacts()">' +
        '<option value="">All roles</option>' +
        Object.entries(ROLE_LABEL).map(([v, l]) => '<option value="' + v + '"' + (state.contactRole === v ? ' selected' : '') + '>' + l + '</option>').join('') +
      '</select>' +
      '<span class="result-count">' + list.length + ' result' + (list.length === 1 ? '' : 's') + '</span>' +
    '</div>';

  if (!list.length) {
    setContent(toolbar + '<div class="empty"><div class="ei">' + icon('contacts', 30) + '</div>' +
      '<h3>No contacts match</h3><p>Import a list from CSV, or add someone manually.</p></div>');
    return;
  }

  const pages = Math.ceil(list.length / PER_PAGE);
  state.contactPage = Math.min(Math.max(1, state.contactPage), pages);
  const page = list.slice((state.contactPage - 1) * PER_PAGE, state.contactPage * PER_PAGE);

  const body = state.contactView === 'grid'
    ? '<div class="ent-grid">' + page.map(contactCardHtml).join('') + '</div>'
    : contactTableHtml(page);

  setContent(toolbar + body +
    (pages > 1 ? '<div class="pagination">' +
      '<button class="pg-btn" ' + (state.contactPage === 1 ? 'disabled' : '') + ' onclick="state.contactPage--;renderContacts()">Previous</button>' +
      '<span class="pg-info">Page ' + state.contactPage + ' of ' + pages + '</span>' +
      '<button class="pg-btn" ' + (state.contactPage === pages ? 'disabled' : '') + ' onclick="state.contactPage++;renderContacts()">Next</button>' +
    '</div>' : ''));
}

function contactCardHtml(c) {
  const o = getOfftaker(c.offtakerId);
  return '<div class="ec" style="cursor:default">' +
    '<div class="ec-head">' +
      '<div class="name-cell"><div class="av" style="background:' + avatarColor(c.first + c.last) + '">' +
        esc(initials(c.first, c.last).toUpperCase()) + '</div>' +
        '<div style="min-width:0"><div style="font-weight:700;font-size:12.5px;color:var(--text2)">' +
          esc(c.first + ' ' + c.last) + '</div>' +
        '<div style="font-size:10.5px;color:var(--muted)">' + esc(c.title || '—') +
          (c.dept ? ' · ' + esc(c.dept) : '') + '</div></div></div>' +
      '<span class="badge b-' + c.priority + '">' + esc(c.priority) + '</span>' +
    '</div>' +
    '<div class="meta">' + icon('building', 13) +
      (o.id ? '<span class="ext-link" style="cursor:pointer" onclick="nav(\'detail\',{id:\'' + o.id + '\'})">' + esc(o.short || o.name) + '</span>'
        : '<span style="color:var(--muted)">unassigned</span>') + '</div>' +
    '<div class="meta">' + icon('contacts', 13) +
      '<span class="badge ' + (c.role === 'decision' ? 'b-contracted' : 'b-prospect') + '">' +
      esc(ROLE_LABEL[c.role] || c.role) + '</span></div>' +
    '<div class="meta">' + icon('mail', 13) +
      (c.email ? '<a class="ext-link" href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>'
        : '<span style="color:var(--muted)">no email on file</span>') + '</div>' +
    '<div class="meta">' + icon('phone', 13) +
      (c.phone ? esc(c.phone) : '<span style="color:var(--muted)">no number on file</span>') + '</div>' +
    '<div class="ec-footer">' +
      '<span>' + (o.id ? 'Org map available' : 'Not linked to an offtaker') + '</span>' +
      '<div style="display:flex;gap:4px">' +
        (o.id ? '<button class="btn btn-xs btn-outline" title="Org map for ' + esc(o.short || o.name) + '" onclick="nav(\'org-map\',{id:\'' + o.id + '\'})">' + icon('grid', 12) + '</button>' : '') +
        (safeHref(c.linkedin) ? '<a class="btn btn-xs btn-outline" href="' + esc(safeHref(c.linkedin)) + '" target="_blank" rel="noopener">' + icon('link', 12) + '</a>' : '') +
        '<button class="btn btn-xs btn-outline" data-admin-only onclick="openEditContact(\'' + c.id + '\')">' + icon('edit', 12) + '</button>' +
        '<button class="btn btn-xs btn-danger" data-admin-only onclick="confirmDelete(\'contact\',\'' + c.id + '\')">' + icon('trash', 12) + '</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function contactTableHtml(page) {
  const s = state.contactSort;
  const th = (field, label) => '<th class="' + thClass(field, s) + '" onclick="toggleSort(state.contactSort,\'' + field + '\',renderContacts)">' + label + sortArrow(field, s) + '</th>';
  return '<div class="table-wrap"><table><thead><tr>' +
      th('last', 'Name') + th('title', 'Title') + th('offtaker', 'Offtaker') +
      th('role', 'Role') + '<th>Email</th><th>Phone</th>' + th('priority', 'Priority') + '<th>Actions</th>' +
    '</tr></thead><tbody>' +
    page.map(c => {
      const o = getOfftaker(c.offtakerId);
      return '<tr>' +
        '<td><div class="name-cell"><div class="av" style="background:' + avatarColor(c.first + c.last) + '">' +
          esc(initials(c.first, c.last).toUpperCase()) + '</div><div style="font-weight:700">' + esc(c.first + ' ' + c.last) + '</div></div></td>' +
        '<td>' + esc(c.title) + (c.dept ? '<div style="font-size:10.5px;color:var(--muted)">' + esc(c.dept) + '</div>' : '') + '</td>' +
        '<td>' + (o.id ? '<span class="ext-link" style="cursor:pointer" onclick="nav(\'detail\',{id:\'' + o.id + '\'})">' + esc(o.short || o.name) + '</span>'
          : '<span class="badge b-low">unassigned</span>') + '</td>' +
        '<td><span class="badge ' + (c.role === 'decision' ? 'b-contracted' : 'b-prospect') + '">' + esc(ROLE_LABEL[c.role] || c.role) + '</span></td>' +
        '<td>' + (c.email ? '<a class="ext-link" href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>' : '<span style="color:var(--muted)">—</span>') + '</td>' +
        '<td>' + (c.phone ? esc(c.phone) : '<span style="color:var(--muted)">—</span>') + '</td>' +
        '<td><span class="badge b-' + c.priority + '">' + esc(c.priority) + '</span></td>' +
        '<td style="white-space:nowrap">' +
          (o.id ? '<button class="btn btn-xs btn-outline" title="Org map for ' + esc(o.short || o.name) + '" onclick="nav(\'org-map\',{id:\'' + o.id + '\'})">' + icon('grid', 11) + '</button> ' : '') +
          (safeHref(c.linkedin) ? '<a class="btn btn-xs btn-outline" href="' + esc(safeHref(c.linkedin)) + '" target="_blank" rel="noopener">' + icon('link', 11) + '</a> ' : '') +
          '<button class="btn btn-xs btn-outline" data-admin-only onclick="openEditContact(\'' + c.id + '\')">' + icon('edit', 11) + '</button> ' +
          '<button class="btn btn-xs btn-danger" data-admin-only onclick="confirmDelete(\'contact\',\'' + c.id + '\')">' + icon('trash', 11) + '</button>' +
        '</td></tr>';
    }).join('') + '</tbody></table></div>';
}
