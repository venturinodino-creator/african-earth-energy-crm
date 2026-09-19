/* ═══════════════════════════════════════════════════════════════════
   Off-taker Prospects — the LEAD list, and the record behind it.

   This view holds one half of the book: companies nobody has started
   working. The other half lives on the Pipeline board, and inPipeline()
   in core.js is the line between them. A lead has no sales stage, no
   board position and no dwell clock, so none of those are drawn here.
   "Work it" is the one control that moves a record across.
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

/* Open the company list showing exactly the rows a number was made of.
   Every other filter is cleared first: a figure on the dashboard counts
   the whole book, so landing on a list still narrowed by whatever was
   set last would contradict the number that was just clicked. */
function openOfftakersFiltered(filters) {
  state.offSearch = ''; state.offSector = '';
  state.offStatus = ''; state.offProvince = '';
  Object.assign(state, filters);
  state.offPage = 1;
  nav('offtakers');
}

/* Every company that is still a lead. */
function prospectRecords() { return state.offtakers.filter(o => !inPipeline(o)); }

function filteredOfftakers() {
  const term = state.offSearch.toLowerCase();
  let list = prospectRecords().filter(o => {
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
  const leads = prospectRecords();
  const working = state.offtakers.length - leads.length;
  const totalGwh = list.reduce((s, o) => s + num(o.annualGwh), 0);

  /* The finder's review queue surfaces here too: one press ingests every
     pending find into its company or municipality, so the queue can be
     cleared without walking the finder's filter chips. Loading mirrors
     renderContactFinder — cache first, server refresh repaints. */
  if (!state.contactRuns) { loadFinderCache(); refreshFinderFromServer(false); }
  const pendingFinds = state.foundContacts.filter(f => f.status === 'pending').length;

  setPage('Off-taker Prospects',
    leads.length + ' lead' + (leads.length === 1 ? '' : 's') + ' nobody is working yet · ' +
    fmtNum(totalGwh) + ' GWh/yr in view · ' + working + ' already in the pipeline',
    (pendingFinds
      ? '<button class="btn btn-primary btn-sm" data-admin-only onclick="acceptAllFoundEverywhere()">' +
        'Accept all ' + pendingFinds + ' found contact' + (pendingFinds === 1 ? '' : 's') + '</button>'
      : '') +
    viewToggle('offView') +
    '<button class="btn btn-outline btn-sm" data-admin-only onclick="openImport(\'offtakers\')">' + icon('upload', 14) + ' Import CSV</button>' +
    '<button class="btn btn-outline btn-sm" onclick="exportOfftakers()">' + icon('download', 14) + ' Export</button>' +
    '<button class="btn btn-primary btn-sm" data-admin-only onclick="openAddOfftaker()">' + icon('plus', 14) + ' Add offtaker</button>');

  const provinces = [...new Set(leads.map(o => o.province))].filter(Boolean).sort();
  /* Only the statuses a lead can actually carry. Anything past 'prospect'
     puts a record in the pipeline by definition, so offering all six here
     would be five dead options and one live one. */
  const statuses = [...new Set(leads.map(o => o.status))].filter(Boolean).sort();
  const toolbar =
    '<div class="toolbar">' +
      '<div class="search-wrap"><span class="search-icon">' + icon('search', 14) + '</span>' +
      '<input placeholder="Search company, city or notes..." value="' + esc(state.offSearch) + '" ' +
      'oninput="state.offSearch=this.value;state.offPage=1;renderOfftakers()"></div>' +
      '<select class="flt" onchange="state.offSector=this.value;state.offPage=1;renderOfftakers()">' +
        '<option value="">All sectors</option>' + sectorOptions(state.offSector) + '</select>' +
      /* No sales-stage or stalled filter here. Neither exists on a lead:
         a stage is what the Pipeline gives a record, and a clock that
         measures time-in-stage has nothing to measure without one. */
      selectFlt('offStatus', 'All statuses', statuses.map(st => [st, STATUS_LABEL[st] || st])) +
      selectFlt('offProvince', 'All provinces', provinces.map(p => [p, p])) +
      '<span class="result-count">' + list.length + ' result' + (list.length === 1 ? '' : 's') + '</span>' +
    '</div>';

  /* Said on the page rather than assumed: a rep who cannot find a company
     here needs to know it is not missing, it has moved across. */
  const note = '<div class="fg-hint" style="margin-top:12px">' +
    'These are leads — researched names nobody has picked up. They carry no sales stage on purpose. ' +
    'Open one and press <b>Work it</b> to move it into the Pipeline; that is where it becomes an ' +
    'opportunity and picks up the stages, the board and the stall clock. ' +
    (working
      ? working + ' compan' + (working === 1 ? 'y has' : 'ies have') + ' already gone across — ' +
        '<span class="ext-link" style="cursor:pointer" onclick="nav(&#39;pipeline&#39;)">open the Pipeline</span>.'
      : 'Nothing has gone across yet.') +
    '</div>';

  if (!list.length) {
    setContent(toolbar + '<div class="empty"><div class="ei">' + icon('search', 30) + '</div>' +
      '<h3>No leads match</h3><p>' +
      (leads.length
        ? 'Loosen the filters, or add a company that is not on the list yet.'
        : 'Every company on file has been moved into the pipeline. Add a new one, or open the ' +
          'Pipeline to see what is being worked.') +
      '</p></div>' + note);
    return;
  }

  if (state.offView === 'grid') {
    setContent(toolbar + '<div class="ent-grid">' + list.map(offtakerCardHtml).join('') + '</div>' + note);
  } else {
    setContent(toolbar + offtakerTableHtml(list) + note);
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
      /* No dwell chip: time-in-stage is a pipeline measurement and these
         records have no stage to have been sitting at. */
      '<span class="badge b-' + o.status + '">' + esc(STATUS_LABEL[o.status] || o.status) + '</span>' +
    '</div>' +
    '<div class="ec-footer" style="border-top:none;padding-top:0;margin-top:6px">' +
      '<span>' + icon('contacts', 13) + ' ' + cc + ' contact' + (cc === 1 ? '' : 's') + '</span>' +
      '<div class="ec-actions">' +
        workItButtonHtml(o, true) +
        '<button class="btn btn-xs btn-outline" data-admin-only onclick="event.stopPropagation();openEditOfftaker(\'' + o.id + '\')">' + icon('edit', 12) + '</button>' +
        '<button class="btn btn-xs btn-danger" data-admin-only onclick="event.stopPropagation();confirmDelete(\'offtaker\',\'' + o.id + '\')">' + icon('trash', 12) + '</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

/* Move a lead across without opening it.

   This is the one action in the list that changes what the row IS rather
   than editing its fields - it takes the record out of Prospects and puts
   it in the Pipeline - so it leads the actions cell.

   The membership test stays even though this list only ever holds leads
   now: the function is the single definition of the button, and a guard
   that can never fire is cheaper than one that was removed on the
   assumption it could not.

   The card passes stopProp because its whole surface opens the record;
   the table cell already stops propagation for every control in it. */
function workItButtonHtml(o, stopProp) {
  if (inPipeline(o)) return '';
  return '<button class="btn btn-xs btn-primary" data-admin-only ' +
    'title="Move out of Prospects and into the Pipeline at Prospecting - this is where it becomes an opportunity" ' +
    'onclick="' + (stopProp ? 'event.stopPropagation();' : '') + 'addToPipeline(' + jsStr(o.id) + ')">' +
    icon('target', 12) + ' Work it</button> ';
}

function offtakerTableHtml(list) {
  const s = state.offSort;
  const th = (field, label) => '<th class="' + thClass(field, s) + '" onclick="toggleSort(state.offSort,\'' + field + '\',renderOfftakers)">' + label + sortArrow(field, s) + '</th>';
  return '<div class="table-wrap"><table><thead><tr>' +
    th('name', 'Offtaker') + th('sector', 'Sector') + th('province', 'Province') +
    th('load', 'GWh/yr') + th('peak', 'Peak MW') + th('tariff', 'R/kWh') +
    th('distance', 'Nearest site') + th('fit', 'Fit') + th('status', 'Status') +
    /* No "In stage" column: a lead has no stage, so every cell in it was
       reporting a sales process for a company that is not in one. */
    th('contacts', 'Contacts') +
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
          workItButtonHtml(o) +
          (safeHref(o.website) ? '<a class="ext-link" href="' + esc(safeHref(o.website)) + '" target="_blank" rel="noopener">Site</a> ' : '') +
          '<button class="btn btn-xs btn-outline" data-admin-only onclick="openEditOfftaker(\'' + o.id + '\')">' + icon('edit', 12) + '</button> ' +
          '<button class="btn btn-xs btn-danger" data-admin-only onclick="confirmDelete(\'offtaker\',\'' + o.id + '\')">' + icon('trash', 12) + '</button>' +
        '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

/* ═══════════════════════════════════════════════════════════════
   DETAIL — one record, read two ways

   A LEAD (Off-taker Prospects) gets exactly three cards and no more:

     1  the hero        who they are and the numbers the desk has
     2  the overview    what was researched and what would make them buy
     3  who is here     the people on file and the seats still empty

   No sales stage, no path, no dwell clock and no "New opportunity". None
   of those exist for a company nobody is working, and drawing them claims
   a process that has not started. What a lead's header has instead is
   "Work it", the one control that moves it out of Prospects.

   An ACCOUNT IN THE PIPELINE gets the sales path above the overview,
   because that is the control a rep uses every day and the board sends
   you here to move it, plus the button to open an opportunity on it.
   Activity is logged from the header on either reading.
   ═══════════════════════════════════════════════════════════════ */
function renderDetail() {
  const o = getOfftaker(state.detailId);
  if (!o.id) { nav('offtakers'); return; }

  const f = fitScore(o);
  const np = nearestProject(o);
  const people = contactsFor(o.id);
  const working = inPipeline(o);

  setPage(o.short || o.name, sectorName(o.sector) + ' · ' + esc(o.city) + ', ' + esc(o.province),
    '<button class="btn btn-outline btn-sm" onclick="nav(\'org-map\',{id:\'' + o.id + '\'})" title="Visual org chart: who sits where">' + icon('grid', 14) + ' Org map</button>' +
    '<button class="btn btn-outline btn-sm" onclick="openLogInteraction(\'' + o.id + '\')">' + icon('note', 14) + ' Log activity</button>' +
    '<button class="btn btn-outline btn-sm" onclick="openAddContact(\'' + o.id + '\')">' + icon('plus', 14) + ' Add contact</button>' +
    /* An opportunity is a pipeline object. Offering one on a lead would
       move the record across as a side effect of a form nobody opened for
       that reason, so a lead is given the move itself instead. */
    (working
      ? '<button class="btn btn-primary btn-sm" onclick="openAddDeal(' + jsStr(o.id) + ')">' +
        icon('bolt', 14) + ' New opportunity</button>'
      : '<button class="btn btn-primary btn-sm" data-admin-only ' +
        'title="Move this lead out of Prospects and into the Pipeline at Prospecting" ' +
        'onclick="addToPipeline(' + jsStr(o.id) + ')">' +
        icon('target', 14) + ' Work it</button>'));

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
            /* A parked account only comes back if the date that unparks it is
               visible. Due dates read as live, future ones as a reminder. */
            (o.revisitDate
              ? '<span class="chip"' +
                (o.revisitDate <= todayISO() ? ' style="color:var(--danger);border-color:var(--danger)"' : '') +
                ' title="Revisit this account">' + icon('clock', 11) + ' revisit ' + esc(o.revisitDate) + '</span>'
              : '') +
            (safeHref(o.website) ? '<a class="ext-link" href="' + esc(safeHref(o.website)) + '" target="_blank" rel="noopener">Website</a>' : '') +
          '</div>' +
          (o.description ? '<p style="font-size:12.5px;color:var(--muted2);line-height:1.6;margin-top:10px;max-width:70ch">' + esc(o.description) + '</p>' : '') +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-shrink:0">' +
          '<button class="btn btn-outline btn-sm" onclick="openEditOfftaker(\'' + o.id + '\')">' + icon('edit', 13) + ' Edit</button>' +
        '</div>' +
      '</div>' +
      '<div class="dh-metrics">' +
        dhMetric(isUnworked(o) ? loadBandText(o) : fmtNum(o.annualGwh),
                 isUnworked(o) ? 'Estimated load' : 'GWh a year', true) +
        dhMetric(isUnworked(o) ? '—' : fmtNum(o.peakMw) + ' MW', 'Peak demand') +
        dhMetric(isUnworked(o) ? '—' : Math.round(loadFactor(o) * 100) + '%', 'Load factor') +
        dhMetric(num(o.tariff) ? 'R' + num(o.tariff).toFixed(2) : '—', 'Current tariff') +
        dhMetric(isUnworked(o) ? 'not scored' : f + '/100', 'Fit score', true) +
        dhMetric(distanceLabel(np), np ? 'to ' + np.project.town + (np.approx ? ' (approx)' : '') : 'no nearby site') +
      '</div>' +
    '</div>';

  /* The researched overview, and how to approach the call. Both came
     across when leads and offtakers became one record type, and they are
     the only thing a company nobody has sized yet actually has. */
  const overview = (o.blurb || o.notes || o.phone || o.email)
    ? '<div class="card" style="margin-bottom:14px">' +
        '<div class="card-header"><div><div class="card-title">Company overview</div>' +
        '<div class="card-sub">Scale, ownership, load shape and what would make them buy</div></div></div>' +
        (o.blurb ? '<div class="blurb">' + proseHtml(o.blurb) + '</div>' : '') +
        (o.notes
          ? '<div class="blurb" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">' +
            proseHtml(o.notes) + '</div>'
          : '') +
        (o.contactSource
          ? '<div class="fg-hint" style="margin-top:12px">Contact details from: ' + esc(o.contactSource) + '</div>'
          : '') +
      '</div>'
    : '';

  setContent(hero +
    /* The path is the control a rep uses every day, so it sits at the top
       of the record where Salesforce puts it — for an account in the
       pipeline. A lead gets nothing here at all: not a greyed-out path,
       not an empty stage badge. It has no sales stage, and the page says
       so by not drawing one. */
    (working ? sfPathCardHtml(o) : '') +
    overview +
    /* No contacts list under it any more, so the panel's segments have
       nothing on this page to narrow — they open the people instead. */
    '<div style="margin-top:14px">' + contactMixHtml(o, people, { noList: true }) + '</div>');
}

/* Blank-line-separated text into real paragraphs. The blurbs were written
   as prose and used to render as one pre-line block, which the column
   layout has no way to avoid breaking mid-sentence — a <p> it can keep
   whole. A single newline stays a line break inside its paragraph. */
function proseHtml(text) {
  return String(text || '').split(/\n\s*\n/)
    .map(p => p.trim()).filter(Boolean)
    .map(p => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join('');
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

/* The account a contact hangs off, offtaker or municipality alike. The
   page groups on this, so a municipality resolves to its name and its
   own page rather than rendering as "unassigned". */
function contactAccountOf(c) { return finderAccountOf(c.offtakerId); }

function contactSortVal(c, field) {
  switch (field) {
    case 'offtaker': return contactAccountOf(c).name || 'zzz';
    case 'role': return ['decision', 'influencer', 'technical', 'gatekeeper'].indexOf(c.role);
    case 'priority': return ['high', 'medium', 'low'].indexOf(c.priority);
    default: return String(c[field] || '');
  }
}

function renderContacts() {
  const term = state.contactSearch.toLowerCase();
  let list = state.contacts.filter(c => {
    const o = contactAccountOf(c);
    if (term && !((c.first + ' ' + c.last + ' ' + c.title + ' ' + c.dept + ' ' + (o.name || '')).toLowerCase().includes(term))) return false;
    if (state.contactOfftaker && c.offtakerId !== state.contactOfftaker) return false;
    if (state.contactRole && c.role !== state.contactRole) return false;
    return true;
  });
  list = sortBy(list, state.contactSort, contactSortVal);

  /* Group by account. A stable re-sort on the account's name keeps the
     chosen column order intact inside each group, so the page reads as
     one company after another with its people sorted within. Contacts
     nobody has filed under an account sink to the bottom together. */
  const accKey = c => c.offtakerId || '';
  const accName = c => { const a = contactAccountOf(c); return a.id ? (a.short || a.name) : ''; };
  list.sort((a, b) => {
    const an = accName(a), bn = accName(b);
    if (an === bn) return 0;
    if (!an) return 1;
    if (!bn) return -1;
    return an.localeCompare(bn);
  });
  const groupCount = {};
  list.forEach(c => { groupCount[accKey(c)] = (groupCount[accKey(c)] || 0) + 1; });

  setPage('Contacts', state.contacts.length + ' people across ' +
    new Set(state.contacts.map(c => c.offtakerId).filter(Boolean)).size + ' companies',
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
        '<option value="">All companies</option>' +
        state.offtakers.map(o => '<option value="' + esc(o.id) + '"' + (state.contactOfftaker === o.id ? ' selected' : '') + '>' + esc(o.short || o.name) + '</option>').join('') +
        SA_MUNICIPALITIES.filter(m => contactsFor(m.id).length)
          .map(m => '<option value="' + esc(m.id) + '"' + (state.contactOfftaker === m.id ? ' selected' : '') + '>' + esc(m.name) + ' Municipality</option>').join('') +
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
    ? contactGroupedGridHtml(page, groupCount)
    : contactTableHtml(page, groupCount);

  setContent(toolbar + body +
    (pages > 1 ? '<div class="pagination">' +
      '<button class="pg-btn" ' + (state.contactPage === 1 ? 'disabled' : '') + ' onclick="state.contactPage--;renderContacts()">Previous</button>' +
      '<span class="pg-info">Page ' + state.contactPage + ' of ' + pages + '</span>' +
      '<button class="pg-btn" ' + (state.contactPage === pages ? 'disabled' : '') + ' onclick="state.contactPage++;renderContacts()">Next</button>' +
    '</div>' : ''));
}

/* One heading per account, shared by the grid and the table so both
   views group identically. The count is the group's size across the
   whole filtered list, not just this page of it. */
function contactGroupHeadHtml(c, groupCount) {
  const a = contactAccountOf(c);
  const n = groupCount[c.offtakerId || ''] || 0;
  const label = a.id ? esc(a.short || a.name) : 'Not linked to a company';
  const open = a.id ? ' style="cursor:pointer" onclick="nav(\'' + accountView(a.id) + '\',{id:\'' + a.id + '\'})"' : '';
  return '<div class="contact-group-head" style="display:flex;align-items:center;gap:7px;' +
    'margin:16px 2px 8px;padding-bottom:5px;border-bottom:1px solid var(--border)">' +
    icon(isMunicipalityId(a.id) ? 'pin' : 'building', 14) +
    '<span class="ext-link"' + open + ' style="font-weight:700;color:var(--text2);cursor:' + (a.id ? 'pointer' : 'default') + '">' + label + '</span>' +
    '<span style="font-size:11px;color:var(--muted)">' + n + ' ' + (n === 1 ? 'person' : 'people') + '</span>' +
  '</div>';
}

function contactGroupedGridHtml(page, groupCount) {
  let html = '', cur = null, buf = [];
  const flush = () => { if (buf.length) { html += '<div class="ent-grid">' + buf.join('') + '</div>'; buf = []; } };
  page.forEach(c => {
    if ((c.offtakerId || '') !== cur) { flush(); cur = c.offtakerId || ''; html += contactGroupHeadHtml(c, groupCount); }
    buf.push(contactCardHtml(c));
  });
  flush();
  return html;
}

function contactCardHtml(c) {
  const o = contactAccountOf(c);
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
    '<div class="meta">' + icon(isMunicipalityId(o.id) ? 'pin' : 'building', 13) +
      (o.id ? '<span class="ext-link" style="cursor:pointer" onclick="nav(\'' + accountView(o.id) + '\',{id:\'' + o.id + '\'})">' + esc(o.short || o.name) + '</span>'
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
      '<span>' + (o.id ? (isMunicipalityId(o.id) ? 'Municipality contact' : 'Org map available') : 'Not linked to a company') + '</span>' +
      '<div style="display:flex;gap:4px">' +
        (o.id && !isMunicipalityId(o.id) ? '<button class="btn btn-xs btn-outline" title="Org map for ' + esc(o.short || o.name) + '" onclick="nav(\'org-map\',{id:\'' + o.id + '\'})">' + icon('grid', 12) + '</button>' : '') +
        (safeHref(c.linkedin) ? '<a class="btn btn-xs btn-outline" href="' + esc(safeHref(c.linkedin)) + '" target="_blank" rel="noopener">' + icon('link', 12) + '</a>' : '') +
        '<button class="btn btn-xs btn-outline" data-admin-only onclick="openEditContact(\'' + c.id + '\')">' + icon('edit', 12) + '</button>' +
        '<button class="btn btn-xs btn-danger" data-admin-only onclick="confirmDelete(\'contact\',\'' + c.id + '\')">' + icon('trash', 12) + '</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function contactTableHtml(page, groupCount) {
  const s = state.contactSort;
  const th = (field, label) => '<th class="' + thClass(field, s) + '" onclick="toggleSort(state.contactSort,\'' + field + '\',renderContacts)">' + label + sortArrow(field, s) + '</th>';
  let cur = null;
  return '<div class="table-wrap"><table><thead><tr>' +
      th('last', 'Name') + th('title', 'Title') + th('offtaker', 'Company') +
      th('role', 'Role') + '<th>Email</th><th>Phone</th>' + th('priority', 'Priority') + '<th>Actions</th>' +
    '</tr></thead><tbody>' +
    page.map(c => {
      const o = contactAccountOf(c);
      let head = '';
      if ((c.offtakerId || '') !== cur) {
        cur = c.offtakerId || '';
        head = '<tr><td colspan="8" style="padding:0 8px">' + contactGroupHeadHtml(c, groupCount) + '</td></tr>';
      }
      return head + '<tr>' +
        '<td><div class="name-cell"><div class="av" style="background:' + avatarColor(c.first + c.last) + '">' +
          esc(initials(c.first, c.last).toUpperCase()) + '</div><div style="font-weight:700">' + esc(c.first + ' ' + c.last) + '</div></div></td>' +
        '<td>' + esc(c.title) + (c.dept ? '<div style="font-size:10.5px;color:var(--muted)">' + esc(c.dept) + '</div>' : '') + '</td>' +
        '<td>' + (o.id ? '<span class="ext-link" style="cursor:pointer" onclick="nav(\'' + accountView(o.id) + '\',{id:\'' + o.id + '\'})">' + esc(o.short || o.name) + '</span>'
          : '<span class="badge b-low">unassigned</span>') + '</td>' +
        '<td><span class="badge ' + (c.role === 'decision' ? 'b-contracted' : 'b-prospect') + '">' + esc(ROLE_LABEL[c.role] || c.role) + '</span></td>' +
        '<td>' + (c.email ? '<a class="ext-link" href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>' : '<span style="color:var(--muted)">—</span>') + '</td>' +
        '<td>' + (c.phone ? esc(c.phone) : '<span style="color:var(--muted)">—</span>') + '</td>' +
        '<td><span class="badge b-' + c.priority + '">' + esc(c.priority) + '</span></td>' +
        '<td style="white-space:nowrap">' +
          (o.id && !isMunicipalityId(o.id) ? '<button class="btn btn-xs btn-outline" title="Org map for ' + esc(o.short || o.name) + '" onclick="nav(\'org-map\',{id:\'' + o.id + '\'})">' + icon('grid', 11) + '</button> ' : '') +
          (safeHref(c.linkedin) ? '<a class="btn btn-xs btn-outline" href="' + esc(safeHref(c.linkedin)) + '" target="_blank" rel="noopener">' + icon('link', 11) + '</a> ' : '') +
          '<button class="btn btn-xs btn-outline" data-admin-only onclick="openEditContact(\'' + c.id + '\')">' + icon('edit', 11) + '</button> ' +
          '<button class="btn btn-xs btn-danger" data-admin-only onclick="confirmDelete(\'contact\',\'' + c.id + '\')">' + icon('trash', 11) + '</button>' +
        '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

