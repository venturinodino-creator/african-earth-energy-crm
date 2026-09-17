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
    /* Unknown sorts as the longest wait rather than as zero: a record with
       no evidence at all is not a fresh one. */
    case 'dwell': { const d = stageDwell(o); return d ? d.days : 99999; }
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
    /* Filtering by stage has to mean "in the pipeline at this stage".
       sfStageFor answers for any record, including the hundreds nobody has
       picked up — so asking for Prospecting without the membership test
       returns the whole research bench. sfStageFor rather than o.sfStage,
       though: an account that predates the path reads its position out of
       its status and should still be found by the stage it is plainly at. */
    if (state.offStage === 'none') { if (inPipeline(o)) return false; }
    else if (state.offStage && (!inPipeline(o) || sfStageFor(o) !== state.offStage)) return false;
    if (state.offStalled === 'stalled' && !isStalled(o)) return false;
    if (state.offProvince && o.province !== state.offProvince) return false;
    return true;
  });
  return sortBy(list, state.offSort, offSortVal);
}

function renderOfftakers() {
  const list = filteredOfftakers();
  const totalGwh = list.reduce((s, o) => s + num(o.annualGwh), 0);
  setPage('Off-taker Prospects', state.offtakers.length + ' companies tracked · ' + fmtNum(totalGwh) + ' GWh/yr addressable',
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
      selectFlt('offStage', 'Any sales stage', SF_STAGES.map(st => [st.id, st.label]).concat([['none', 'Not in the pipeline']])) +
      selectFlt('offStalled', 'Stalled or not', [['stalled', 'Stalled only']]) +
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
      '<div style="display:flex;align-items:center;gap:6px">' + dwellChipHtml(o) +
      '<span class="badge b-' + o.status + '">' + esc(STATUS_LABEL[o.status] || o.status) + '</span></div>' +
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
    th('distance', 'Nearest site') + th('fit', 'Fit') + th('status', 'Status') +
    th('dwell', 'In stage') + th('contacts', 'Contacts') +
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
        '<td>' + dwellChipHtml(o) + '</td>' +
        '<td class="num">' + contactsFor(o.id).length + '</td>' +
        '<td onclick="event.stopPropagation()" style="white-space:nowrap">' +
          (safeHref(o.website) ? '<a class="ext-link" href="' + esc(safeHref(o.website)) + '" target="_blank" rel="noopener">Site</a> ' : '') +
          '<button class="btn btn-xs btn-outline" data-admin-only onclick="openEditOfftaker(\'' + o.id + '\')">' + icon('edit', 12) + '</button> ' +
          '<button class="btn btn-xs btn-danger" data-admin-only onclick="confirmDelete(\'offtaker\',\'' + o.id + '\')">' + icon('trash', 12) + '</button>' +
        '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

/* ═══════════════════════════════════════════════════════════════
   DETAIL — what is known about a company, and where it stands

   Deliberately three things and no more: who they are, what the desk has
   researched, and who works there. The pitch, the sector briefing, the
   supply notes and the outreach templates all used to sit here too, and
   between them they buried the two cards anybody actually reads.

   The sales path sits at the top for a company being worked, because the
   pipeline sends you here to move it. A company nobody has picked up gets
   the way in instead. Opportunities and activity are still logged from the
   header buttons; they are just not read here.
   ═══════════════════════════════════════════════════════════════ */
function renderDetail() {
  const o = getOfftaker(state.detailId);
  if (!o.id) { nav('offtakers'); return; }

  const f = fitScore(o);
  const np = nearestProject(o);
  const people = contactsFor(o.id);

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
       of the record where Salesforce puts it. A company nobody has started
       working gets the greyed-out version, which carries the move that
       starts the process rather than claiming one already exists. */
    (inPipeline(o) ? sfPathCardHtml(o) : sfNotStartedCardHtml(o)) +
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

