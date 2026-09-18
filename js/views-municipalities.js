/* ═══════════════════════════════════════════════════════════════════
   Municipalities — all 257, as their own target list.

   Scaffolding. The list itself is reference data (data/municipalities.js)
   and never changes from inside the app; what the team adds on top is
   contacts, activity and a working status. So there is no "Add
   municipality" button and no import: a municipality either exists in
   South Africa or it does not.

   Everything a rep accumulates against one hangs off the SAME contacts
   table the offtakers use, keyed on the same column. That is deliberate
   rather than lazy: municipality ids are namespaced "mun_<code>", so
   they cannot collide with an offtaker id, and in exchange every piece
   of machinery already built for offtaker contacts — the seniority
   panel, the stakeholder ladder, the org map, the CSV contact import —
   works here on day one with nothing rewritten.

   The working state (prospect / engaged / …) is NOT stored on the
   reference record. It is derived from what the team has actually done:
   a municipality with contacts on file is being worked, one without is
   not. When a real status field is wanted it should go to Supabase as
   its own table, not into this file.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

function muniOf(id) { return MUNI_BY_ID[id] || null; }

/* A municipality wearing just enough of an offtaker's shape for the
   contact panel, the contacts card and the org map to render it. Those
   three read .id, .name and .short and nothing else, so this is the
   whole adapter. */
function muniAsAccount(m) {
  return m ? { id: m.id, name: m.name + ' Municipality', short: m.name } : {};
}

/* Municipalities are worked when someone is on file, not before. */
function muniContacts(m) { return contactsFor(m.id); }
function muniIsWorked(m) { return contactsFor(m.id).length > 0; }

/* The ones worth a call first. Unlike A/B/C this is a judgement rather
   than a legal category, it cuts across all three, and the list behind
   it is in data/municipalities.js with the reasoning attached. */
function muniIsMain(m) { return !!(m && m.main); }

function muniSortVal(m, field) {
  switch (field) {
    case 'contacts': return contactsFor(m.id).length;
    case 'cat': return ['A', 'C', 'B'].indexOf(m.cat);
    case 'district': return m.districtName || '';
    default: return String(m[field] || '');
  }
}

function filteredMunicipalities() {
  const term = state.muniSearch.toLowerCase();
  const list = SA_MUNICIPALITIES.filter(m => {
    if (term && !(m.name + ' ' + m.code + ' ' + m.seat + ' ' + m.province + ' ' +
      (m.districtName || '')).toLowerCase().includes(term)) return false;
    if (state.muniProvince && m.province !== state.muniProvince) return false;
    /* 'main' shares the category dropdown but is not a category: it is
       eight metros and sixteen locals, so it is answered before the
       A/B/C comparison rather than through it. */
    if (state.muniCat === 'main') { if (!muniIsMain(m)) return false; }
    else if (state.muniCat && m.cat !== state.muniCat) return false;
    if (state.muniWorked === 'yes' && !muniIsWorked(m)) return false;
    if (state.muniWorked === 'no' && muniIsWorked(m)) return false;
    return true;
  });
  return sortBy(list, state.muniSort, muniSortVal);
}

function renderMunicipalities() {
  const list = filteredMunicipalities();
  const worked = SA_MUNICIPALITIES.filter(muniIsWorked).length;
  const people = state.contacts.filter(c => muniOf(c.offtakerId)).length;

  setPage('Municipalities',
    SA_MUNICIPALITIES.length + ' municipalities · ' + worked + ' with someone on file',
    viewToggle('muniView') +
    '<button class="btn btn-outline btn-sm" data-admin-only onclick="openImport(\'contacts\')">' +
      icon('upload', 14) + ' Import contacts</button>' +
    '<button class="btn btn-outline btn-sm" onclick="exportMunicipalities()">' +
      icon('download', 14) + ' Export</button>');

  const counts = { A: 0, B: 0, C: 0 };
  SA_MUNICIPALITIES.forEach(m => { counts[m.cat]++; });
  const mainList = SA_MUNICIPALITIES.filter(muniIsMain);

  const stats =
    '<div class="stats-grid">' +
      statTile('building', 'green', 'Metros', counts.A,
        'single-tier, the biggest municipal loads', "muniSetCat('A')") +
      statTile('grid', 'blue', 'District municipalities', counts.C,
        'sit above the locals', "muniSetCat('C')") +
      statTile('pin', 'amber', 'Local municipalities', counts.B,
        'the distributor for most of the country', "muniSetCat('B')") +
      statTile('target', 'green', 'Main municipalities', mainList.length,
        'metros and the big secondary cities', "muniSetCat('main')") +
      statTile('contacts', 'purple', 'People on file', people,
        worked + ' of ' + SA_MUNICIPALITIES.length + ' municipalities covered',
        "muniSetWorked('yes')") +
    '</div>';

  const toolbar =
    '<div class="toolbar">' +
      '<div class="search-wrap"><span class="search-icon">' + icon('search', 14) + '</span>' +
      '<input placeholder="Search municipality, code, seat or district..." value="' + esc(state.muniSearch) + '" ' +
      'oninput="state.muniSearch=this.value;state.muniPage=1;renderMunicipalities()"></div>' +
      muniFlt('muniProvince', 'All provinces', MUNI_PROVINCES.map(p => [p, p])) +
      muniFlt('muniCat', 'All categories',
        Object.entries(MUNI_CATEGORY_LONG).concat([['main', 'Main municipalities']])) +
      muniFlt('muniWorked', 'Worked or not', [['yes', 'Has contacts'], ['no', 'Nobody on file yet']]) +
      '<span class="result-count">' + list.length + ' result' + (list.length === 1 ? '' : 's') + '</span>' +
    '</div>';

  if (!list.length) {
    setContent(stats + toolbar + '<div class="empty"><div class="ei">' + icon('search', 30) + '</div>' +
      '<h3>No municipalities match</h3><p>Loosen the filters — every one of the 257 is in here.</p></div>');
    return;
  }

  const pages = Math.ceil(list.length / PER_PAGE);
  state.muniPage = Math.min(Math.max(1, state.muniPage), pages);
  const page = list.slice((state.muniPage - 1) * PER_PAGE, state.muniPage * PER_PAGE);

  setContent(stats + toolbar +
    (state.muniView === 'table' ? muniTableHtml(page) :
      '<div class="ent-grid">' + page.map(muniCardHtml).join('') + '</div>') +
    (pages > 1 ? '<div class="pagination">' +
      '<button class="pg-btn" ' + (state.muniPage === 1 ? 'disabled' : '') + ' onclick="state.muniPage--;renderMunicipalities()">Previous</button>' +
      '<span class="pg-info">Page ' + state.muniPage + ' of ' + pages + ' · ' + list.length + ' municipalities</span>' +
      '<button class="pg-btn" ' + (state.muniPage === pages ? 'disabled' : '') + ' onclick="state.muniPage++;renderMunicipalities()">Next</button>' +
    '</div>' : ''));
}

function muniFlt(key, allLabel, pairs) {
  return '<select class="flt" onchange="state.' + key + '=this.value;state.muniPage=1;renderMunicipalities()">' +
    '<option value="">' + esc(allLabel) + '</option>' +
    pairs.map(([v, l]) => '<option value="' + esc(v) + '"' + (state[key] === v ? ' selected' : '') + '>' +
      esc(l) + '</option>').join('') + '</select>';
}
function muniSetCat(c) { state.muniCat = state.muniCat === c ? '' : c; state.muniPage = 1; renderMunicipalities(); }
function muniSetWorked(w) { state.muniWorked = state.muniWorked === w ? '' : w; state.muniPage = 1; renderMunicipalities(); }

function muniCatBadge(cat) {
  const cls = { A: 'b-contracted', C: 'b-prospect', B: 'b-low' }[cat] || 'b-low';
  return '<span class="badge ' + cls + '" title="' + esc(MUNI_CATEGORY_LONG[cat]) + '">' +
    esc(MUNI_CATEGORY[cat]) + '</span>';
}

function muniCardHtml(m) {
  const cc = contactsFor(m.id).length;
  const logs = interactionsFor(m.id).length;
  return '<div class="ec" onclick="nav(\'municipality\',{id:\'' + m.id + '\'})">' +
    '<div class="ec-head">' +
      '<div class="ec-icon">' + icon('building', 18) + '</div>' +
      muniCatBadge(m.cat) +
    '</div>' +
    '<h3>' + esc(m.name) + '</h3>' +
    '<div class="short">' + esc(m.code) + '</div>' +
    '<div class="meta">' + icon('pin', 13) + esc(m.seat) + ', ' + esc(m.province) + '</div>' +
    (m.districtName ? '<div class="meta">' + icon('grid', 13) + esc(m.districtName) + ' District</div>' : '') +
    '<div class="ec-footer" style="margin-top:12px">' +
      '<span>' + icon('contacts', 13) + ' ' + cc + ' contact' + (cc === 1 ? '' : 's') + '</span>' +
      (logs ? '<span>' + logs + ' logged</span>'
            : '<span style="color:var(--muted)">not worked yet</span>') +
    '</div>' +
  '</div>';
}

function muniTableHtml(list) {
  const s = state.muniSort;
  const th = (field, label) => '<th class="' + thClass(field, s) + '" onclick="toggleSort(state.muniSort,\'' + field + '\',renderMunicipalities)">' + label + sortArrow(field, s) + '</th>';
  return '<div class="table-wrap"><table><thead><tr>' +
    th('name', 'Municipality') + th('code', 'Code') + th('cat', 'Category') +
    th('province', 'Province') + th('seat', 'Seat') + th('district', 'District') +
    th('contacts', 'Contacts') + '</tr></thead><tbody>' +
    list.map(m => {
      const cc = contactsFor(m.id).length;
      return '<tr class="clickable" onclick="nav(\'municipality\',{id:\'' + m.id + '\'})">' +
        '<td><div class="name-cell"><span style="opacity:.6;display:flex">' + icon('building', 15) + '</span>' +
          '<div style="font-weight:700">' + esc(m.name) + '</div></div></td>' +
        '<td style="font-variant-numeric:tabular-nums;color:var(--muted)">' + esc(m.code) + '</td>' +
        '<td>' + muniCatBadge(m.cat) + '</td>' +
        '<td>' + esc(m.province) + '</td>' +
        '<td>' + esc(m.seat) + '</td>' +
        '<td>' + (m.districtName ? esc(m.districtName) : '<span style="color:var(--muted)">—</span>') + '</td>' +
        '<td class="num">' + (cc || '<span style="color:var(--muted)">—</span>') + '</td>' +
      '</tr>';
    }).join('') + '</tbody></table></div>';
}

/* ═══════════════════════════════════════════════════════════════
   ONE MUNICIPALITY
   ═══════════════════════════════════════════════════════════════ */
function renderMunicipality() {
  const m = muniOf(state.detailId);
  if (!m) { nav('municipalities'); return; }
  const acct = muniAsAccount(m);
  const people = contactsFor(m.id);
  const logs = interactionsFor(m.id);

  /* Locals inside a district, and the district above a local — the two
     directions a rep actually needs, because the load sits with the
     local and the political cover often sits with the district. */
  const children = m.cat === 'C'
    ? SA_MUNICIPALITIES.filter(x => x.districtCode === m.code) : [];
  const parent = m.districtCode ? SA_MUNICIPALITIES.find(x => x.code === m.districtCode) : null;

  setPage(m.name, MUNI_CATEGORY_LONG[m.cat] + ' · ' + m.code + ' · ' + m.seat + ', ' + m.province,
    '<button class="btn btn-outline btn-sm" onclick="nav(\'org-map\',{id:\'' + m.id + '\'})" title="Visual org chart: who sits where">' +
      icon('grid', 14) + ' Org map</button>' +
    '<button class="btn btn-outline btn-sm" onclick="openLogInteraction(\'' + m.id + '\')">' + icon('note', 14) + ' Log activity</button>' +
    '<button class="btn btn-primary btn-sm" data-admin-only onclick="openAddContact(\'' + m.id + '\')">' + icon('plus', 14) + ' Add contact</button>');

  const hero =
    '<div class="detail-hero">' +
      '<div class="dh-top">' +
        '<div class="dh-icon">' + icon('building', 24) + '</div>' +
        '<div style="flex:1;min-width:220px">' +
          '<div class="dh-title">' + esc(m.name) + '</div>' +
          '<div class="dh-sub">' +
            muniCatBadge(m.cat) +
            '<span class="chip">' + esc(m.code) + '</span>' +
            (parent ? '<span class="ext-link" style="cursor:pointer" onclick="nav(\'municipality\',{id:\'' + parent.id + '\'})">' +
              esc(parent.name) + ' District &rarr;</span>' : '') +
          '</div>' +
          '<p style="font-size:12.5px;color:var(--muted2);line-height:1.6;margin-top:10px;max-width:70ch">' +
            esc(muniPitchLine(m)) + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="dh-metrics">' +
        dhMetric(esc(m.seat), 'Council seat') +
        dhMetric(esc(m.province), 'Province') +
        dhMetric(people.length, 'Contacts on file', true) +
        dhMetric(logs.length, 'Activity logged') +
        dhMetric(m.cat === 'C' ? children.length : (parent ? '1' : '—'),
          m.cat === 'C' ? 'Local municipalities' : 'District above') +
      '</div>' +
    '</div>';

  /* The two roles a municipality plays. Kept as plain text rather than
     numbers, because no load figures exist for any of these yet and a
     zero would read as a measurement. */
  const roleCard =
    '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">Why this one matters</div>' +
      '<div class="card-sub">A municipality is a customer and a gatekeeper at the same time</div></div></div>' +
      '<dl class="kv">' +
        '<dt>As a customer</dt><dd>' + esc(MUNI_ROLE_CUSTOMER[m.cat]) + '</dd>' +
        '<dt>As a distributor</dt><dd>' + esc(MUNI_ROLE_DISTRIBUTOR[m.cat]) + '</dd>' +
        '<dt>Supply area</dt><dd>' + esc(m.cat === 'C'
          ? children.length + ' local municipalities'
          : m.seat + ' and surrounds') + '</dd>' +
      '</dl>' +
      '<div class="fg-hint" style="margin-top:12px">Load, tariff and licence detail are not on file for any ' +
      'municipality yet — this list is the scaffolding, and the numbers come from the first conversation.</div>' +
    '</div>';

  const childCard = children.length
    ? '<div class="card">' +
        '<div class="card-header"><div><div class="card-title">Local municipalities (' + children.length + ')</div>' +
        '<div class="card-sub">Where the distribution licence and the load actually sit</div></div></div>' +
        children.map(c => {
          const cc = contactsFor(c.id).length;
          return '<div class="person-row" style="cursor:pointer" onclick="nav(\'municipality\',{id:\'' + c.id + '\'})">' +
            '<div style="min-width:0;flex:1">' +
              '<div class="person-name">' + esc(c.name) + '</div>' +
              '<div class="person-title">' + esc(c.code) + ' · ' + esc(c.seat) + '</div></div>' +
            '<div class="person-actions">' + (cc
              ? '<span class="badge b-contracted">' + cc + ' contact' + (cc === 1 ? '' : 's') + '</span>'
              : '<span style="color:var(--muted);font-size:11px">nobody yet</span>') + '</div>' +
          '</div>';
        }).join('') +
      '</div>'
    : '';

  const logHtml =
    '<div class="card">' +
      '<div class="card-header"><div class="card-title">Activity (' + logs.length + ')</div>' +
      '<button class="btn btn-ghost btn-xs" onclick="openLogInteraction(\'' + m.id + '\')">Log</button></div>' +
      (logs.length ? logs.map(i =>
        '<div class="int-row"><div class="int-dot"></div><div class="int-body">' +
        '<div class="int-meta">' + esc(i.type) + ' · ' + esc(i.date) + ' · ' + relTime(i.date) + '</div>' +
        '<div class="int-text">' + esc(i.summary) + '</div></div>' +
        '<button class="btn btn-xs btn-ghost" data-admin-only onclick="deleteInteraction(\'' + i.id + '\')">' + icon('trash', 11) + '</button></div>').join('')
        : '<div class="empty" style="padding:26px 10px"><h3>Nothing logged</h3>' +
          '<p>Log the first call. Municipal officials rotate, and the next rep will need the history.</p></div>') +
    '</div>';

  setContent(hero +
    '<div style="margin-top:14px">' + contactMixHtml(acct, people) + '</div>' +
    '<div class="cols-2" style="margin-top:14px">' +
      '<div style="display:flex;flex-direction:column;gap:14px">' + contactsCardHtml(acct) + logHtml + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:14px">' + roleCard + childCard + '</div>' +
    '</div>');
}

/* One line of orientation per category. Deliberately about the shape of
   the organisation rather than about any specific municipality — there
   is nothing on file yet that would justify saying more. */
const MUNI_ROLE_CUSTOMER = {
  A: 'Very large own consumption — water and sewage pumping, street lighting, depots and civic buildings across a whole metro. Typically the biggest single non-industrial account in its province.',
  C: 'Limited own consumption. A district runs offices and shared services; the pumping and street lighting sit with the locals beneath it.',
  B: 'Water and sewage pumping is usually the largest line on the budget, followed by street lighting. Load is small per site but continuous and spread across many points of supply.',
};
const MUNI_ROLE_DISTRIBUTOR = {
  A: 'Holds its own distribution licence and network. A wheeled PPA to any customer inside the metro crosses this network and needs a use-of-system agreement with it.',
  C: 'Not a distributor. Relevant for political cover and for introductions to the locals, not for a wheeling agreement.',
  B: 'Most locals hold a distribution licence for the town centre while Eskom supplies the surrounding area — so who supplies a given site has to be confirmed before a wheeling route can be assumed.',
};

/* Used as the one-line summary under the name on the detail page. */
function muniPitchLine(m) {
  if (m.cat === 'A') return 'Metropolitan municipality — single tier, its own distribution network, and one of the largest electricity accounts in the country.';
  if (m.cat === 'C') return 'District municipality — sits above its local municipalities. Worth knowing for access and cover; the load and the licence sit below it.';
  return 'Local municipality in the ' + (m.districtName || '') + ' District. Pumping and street lighting are the load; the distribution licence decides whether a wheeled PPA can reach customers here.';
}

/* Export is the whole reference list plus whatever the team has added,
   so it can be worked offline or handed to someone without a login. */
function exportMunicipalities() {
  const rows = [['code', 'name', 'category', 'province', 'seat', 'district', 'contacts', 'activity']];
  SA_MUNICIPALITIES.forEach(m => {
    rows.push([m.code, m.name, MUNI_CATEGORY_LONG[m.cat], m.province, m.seat,
      m.districtName || '', contactsFor(m.id).length, interactionsFor(m.id).length]);
  });
  downloadCSV('aee-municipalities.csv', rows);
}
