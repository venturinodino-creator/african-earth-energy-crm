/* ═══════════════════════════════════════════════════════════════════
   Contact intelligence — who is at this account, and where they sit.

   Two things live here:

   1. The "Who is here, and what they hold" panel on an offtaker's page.
   2. The org map — a visual chart of the tracked contacts at one
      offtaker, by department and seniority.

   Both are pure functions of state.contacts, so a contact added, edited
   or imported shows up the next time either renders. Nothing to wire.

   Three rules the panel follows:

   1. Count people, not rows. The same person is sometimes stored twice
      (a CSV import on top of a manual add), so row counts overstate the
      list. Every number below counts de-duplicated people.
   2. Never dress a hand-typed flag as a job title. "Flagged by hand" is
      a priority someone set; every other tier is read off the title.
   3. A gap IS a finding here — unlike a missing data point, having no
      CFO on file is the thing a rep needs to act on, so gaps get a tile
      rather than being hidden.

   Every segment, row and tile is a control: clicking one filters the
   Contacts card beneath it.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* ─── WHO MATTERS FOR A PPA ───────────────────────────────────────
   This is the sales ladder from the workbook (STAKEHOLDER_TIERS),
   expressed as title patterns so an imported contact lands in the
   right band without anyone re-tagging it by hand.

   Procurement is tested first, deliberately: "Category Manager:
   Energy & Utilities" reads as an energy lead on a naive match, but
   they run the RFP — a different conversation, at a different time. */
const AE_PROC_RE    = /\bprocure\w*\b|\bsupply\s+chain\b|\bcategory\s+manager\b|\bsourcing\b|\bcontracts?\s+manager\b|\bbuyer\b|\btender\w*\b/i;
const AE_ENERGY_RE  = /\b(?:energy|utilit\w*|electricity|power)\b[^,;|]{0,32}\b(?:director|head|chief|manager|lead|executive)\b|\b(?:director|head|chief|manager|lead|executive)\b[^,;|]{0,32}\b(?:energy|utilit\w*|electricity|power)\b/i;
const AE_SUSTAIN_RE = /\bchief\s+sustainability\s+officer\b|\b(?:sustainab\w*|esg|carbon|decarbonis\w*|decarboniz\w*|climate|environment\w*|net[-\s]?zero|energy\s+transition)\b[^,;|]{0,32}\b(?:director|head|chief|manager|lead|officer)\b|\b(?:director|head|chief|manager|lead|officer)\b[^,;|]{0,32}\b(?:sustainab\w*|esg|carbon|decarbonis\w*|climate|environment\w*|energy\s+transition)\b/i;
const AE_FINANCE_RE = /\bchief\s+financial\s+officer\b|\bcfo\b|\bfinanc\w*\s+director\b|\bhead\s+of\s+financ\w*\b|\bfinancial\s+manager\b|\bgroup\s+financ\w*\b|\btreasur\w*\b/i;
const AE_EXEC_RE    = /\bchief\s+executive(?:\s+officer)?\b|\bceo\b|\bmanaging\s+director\b|\bexecutive\s+chairman\b|\bchairman\b|\bstrategy\s+director\b|\bdirector\s+of\s+strategy\b/i;
const AE_OPS_RE     = /\bchief\s+operating\s+officer\b|\bcoo\b|\boperations?\b[^,;|]{0,28}\b(?:director|head|manager|executive)\b|\b(?:director|head|manager|executive)\b[^,;|]{0,28}\boperations?\b|\bgeneral\s+manager\b|\b(?:plant|mine|mill|works|site|production)\s+manager\b/i;
const AE_ENG_RE     = /\bengineer\w*\b|\btechnical\b[^,;|]{0,28}\b(?:director|head|manager|lead)\b|\bmaintenance\b|\bprojects?\s+manager\b|\basset\s+manager\b|\breticulation\b/i;

/* The bands the seniority bar is drawn from. Colours are the app's own
   palette, ordered so the two bands a rep opens with read as the
   brightest thing in the chart. */
const AE_TIERS = [
  { r: 0, label: 'Energy & utilities lead',  hex: '#3ddc84' },
  { r: 1, label: 'Sustainability & ESG',     hex: '#38bdf8' },
  { r: 2, label: 'Exec & finance',           hex: '#a78bfa' },
  { r: 3, label: 'Operations & site',        hex: '#818cf8' },
  { r: 4, label: 'Engineering & technical',  hex: '#60a5fa' },
  { r: 5, label: 'Procurement',              hex: '#f472b6' },
  { r: 6, label: 'Flagged by hand',          hex: '#fbbf24' },
  { r: 7, label: 'Other staff',              hex: '#64748b' },
];
/* Ranks 0–2 are the people who decide a PPA: the one who owns the
   tariff, the one who owns the Scope 2 number, and the one who signs
   a twenty-year commitment. Reach is measured against these, not
   against the whole list — coverage of everybody is not a question
   anyone actually has. */
const AE_LEAD_MAX = 2;

function aeRoleRank(c) {
  const t = String((c && c.title) || '');
  if (AE_PROC_RE.test(t)) return 5;
  if (AE_ENERGY_RE.test(t)) return 0;
  if (AE_SUSTAIN_RE.test(t)) return 1;
  if (AE_EXEC_RE.test(t) || AE_FINANCE_RE.test(t)) return 2;
  if (AE_OPS_RE.test(t)) return 3;
  if (AE_ENG_RE.test(t)) return 4;
  if ((c && c.role) === 'decision' || (c && c.priority) === 'high') return 6;
  return 7;
}

/* The ladder coverage tiles. Each is a seat at the table this desk
   needs filled before a PPA can be signed; the "why" is the reason
   that person takes the call, straight from the workbook. */
const AE_LADDER = [
  { k: 'energy',  label: 'Energy / utilities',   why: 'Owns the tariff, the load and the Eskom exposure',   re: AE_ENERGY_RE },
  { k: 'sustain', label: 'Sustainability / ESG', why: 'Owns the Scope 2 number publicly',                   re: AE_SUSTAIN_RE },
  { k: 'finance', label: 'CFO / finance',        why: 'Signs a 15–20 year commitment',                      re: AE_FINANCE_RE },
  { k: 'exec',    label: 'CEO / MD',             why: 'Sponsor, and often decisive at mid-tier',            re: AE_EXEC_RE },
  { k: 'ops',     label: 'Operations / site',    why: 'Cost-per-tonne owner; energy is a top-three input',  re: AE_OPS_RE },
  { k: 'eng',     label: 'Engineering',          why: 'Validates reticulation and the connection point',    re: AE_ENG_RE },
  { k: 'proc',    label: 'Procurement',          why: 'Runs the RFP — reach them before it is written',     re: AE_PROC_RE },
];

/* Seats follow the same precedence the seniority bands do. Without
   this, "Category Manager: Energy & Utilities" fills the energy seat
   as well as the procurement one, and the panel tells a rep they have
   the person who owns the tariff when what they have is the buyer who
   will eventually run the RFP. A procurement title fills exactly one
   seat: procurement. */
function aeSeatMatch(seat, c) {
  const t = String((c && c.title) || '');
  if (!seat || !seat.re.test(t)) return false;
  return seat.k === 'proc' || !AE_PROC_RE.test(t);
}

/* ─── THE FILTER ──────────────────────────────────────────────────
   Scoped to one offtaker, so opening another account does not arrive
   pre-filtered by a segment clicked three accounts ago. */
window.AE_CX_FILTER = null;   // {kind:'role'|'lead'|'dept'|'email'|'dupe'|'ladder', value, oid}

function aeSetFilter(kind, value) {
  /* Where the panel is shown without a contacts list beneath it, a filter
     would narrow something the reader cannot see. Send them to the org
     map, which is where the names are. */
  if (window.AE_CX_NO_LIST) { nav('org-map', { id: state.detailId }); return; }
  const f = window.AE_CX_FILTER;
  window.AE_CX_FILTER = (f && f.kind === kind && String(f.value) === String(value))
    ? null : { kind, value, oid: state.detailId };
  /* render, not renderDetail: the panel sits on a municipality page too,
     and renderDetail there finds no offtaker for the id and bounces to the
     company list, which is how filtering a municipality's contacts has
     always thrown the reader off the page. */
  render();
}
function aeClearFilter() { window.AE_CX_FILTER = null; render(); }
function aeActiveFilter(oid) {
  const f = window.AE_CX_FILTER;
  if (f && f.oid !== oid) { window.AE_CX_FILTER = null; return null; }
  return f;
}

function aeNameKey(c) {
  return ((c.first || '') + ' ' + (c.last || '')).toLowerCase().replace(/\s+/g, ' ').trim();
}
function aeMatches(c) {
  const f = window.AE_CX_FILTER;
  if (!f) return true;
  if (f.kind === 'role')   return aeRoleRank(c) === Number(f.value);
  if (f.kind === 'lead')   return aeRoleRank(c) <= AE_LEAD_MAX;
  if (f.kind === 'dept')   return (c.dept || '—') === f.value;
  if (f.kind === 'email')  return f.value === 'missing' ? !(c.email || c.phone) : !!(c.email || c.phone);
  if (f.kind === 'dupe')   return (window.AE_DUPE_KEYS || []).includes(aeNameKey(c));
  if (f.kind === 'ladder') {
    const seat = AE_LADDER.find(s => s.k === f.value);
    return aeSeatMatch(seat, c);
  }
  return true;
}

/* Collapses the rows to one entry per person. Where a name appears
   twice, the record kept is the one that says the most: the most
   senior title first, then whichever carries an email, then a phone. */
function aePeople(contacts) {
  const by = new Map();
  contacts.forEach(c => {
    const k = aeNameKey(c);
    const prev = by.get(k);
    if (!prev) { by.set(k, c); return; }
    const score = x => (9 - aeRoleRank(x)) * 4 + (x.email ? 2 : 0) + (x.phone ? 1 : 0);
    if (score(c) > score(prev)) by.set(k, c);
  });
  return [...by.values()];
}

/* Normalises a department label so "Group Energy" and "Energy" are not
   counted as two different places. */
function aeDeptKey(d) {
  return String(d || '—').toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\b(?:group|corporate|head\s+office|division|dept\.?|department)\b/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim() || '—';
}

/* ═══════════════════════════════════════════════════════════════
   THE PANEL
   ═══════════════════════════════════════════════════════════════ */
function contactMixHtml(o, contacts, opts) {
  /* Whether a contacts card follows this panel on the page. It does on a
     municipality; it no longer does on a company. */
  const hasList = !(opts && opts.noList);
  window.AE_CX_NO_LIST = !hasList;
  const f = hasList ? aeActiveFilter(o.id) : null;

  const people = aePeople(contacts);
  const dupeKeys = [];
  const seen = new Set();
  contacts.forEach(c => {
    const k = aeNameKey(c);
    if (seen.has(k)) { if (!dupeKeys.includes(k)) dupeKeys.push(k); } else seen.add(k);
  });
  window.AE_DUPE_KEYS = dupeKeys;

  if (!people.length) {
    return '<div class="card ia-card">' +
      '<div class="card-header"><div><div class="card-title">Who is here, and what they hold</div>' +
      '<div class="card-sub">Nobody on file at ' + esc(o.short || o.name) + ' yet</div></div>' +
      '<button class="btn btn-primary btn-xs" data-admin-only onclick="openAddContact(\'' + o.id + '\')">Add the first contact</button></div>' +
      '<div class="fg-hint">Start with whoever owns the electricity bill — a Group Energy Manager or Head of Utilities ' +
      'takes this call. The person who signs it is the CFO, and you will want both before a PPA gets anywhere.</div>' +
    '</div>';
  }

  /* ── seniority ─────────────────────────────────────────────── */
  const tierCounts = {};
  people.forEach(c => { const r = aeRoleRank(c); tierCounts[r] = (tierCounts[r] || 0) + 1; });
  const tiers = AE_TIERS.filter(t => tierCounts[t.r]);
  const leaders = people.filter(c => aeRoleRank(c) <= AE_LEAD_MAX);

  const roleBar = tiers.map(t => {
    const on = f && f.kind === 'role' && Number(f.value) === t.r;
    return '<button class="ia-seg" title="' + esc(t.label) + ': ' + tierCounts[t.r] + '" aria-pressed="' + !!on + '" ' +
      'onclick="aeSetFilter(\'role\',' + t.r + ')" style="flex:' + tierCounts[t.r] + ';background:' + t.hex +
      ';opacity:' + (f && !on ? '.28' : '1') + '"></button>';
  }).join('');

  const roleKey = tiers.map(t => {
    const on = f && f.kind === 'role' && Number(f.value) === t.r;
    return '<button class="ia-key" onclick="aeSetFilter(\'role\',' + t.r + ')" aria-pressed="' + !!on + '">' +
      '<i style="background:' + t.hex + '"></i>' + esc(t.label) +
      (t.r === 6 ? '<u title="Priority or decision-maker flag typed in by hand, not read from a job title">?</u>' : '') +
      ' <b>' + tierCounts[t.r] + '</b></button>';
  }).join('');

  /* ── departments ───────────────────────────────────────────── */
  const deptMap = {};
  people.forEach(c => {
    const k = aeDeptKey(c.dept);
    (deptMap[k] = deptMap[k] || { label: c.dept || '—', n: 0, variants: new Set() });
    deptMap[k].n++; deptMap[k].variants.add(c.dept || '—');
  });
  const depts = Object.values(deptMap).sort((a, b) => b.n - a.n).slice(0, 7);
  const deptMax = Math.max(...depts.map(d => d.n), 1);
  const deptRows = depts.map(d => {
    const on = f && f.kind === 'dept' && d.variants.has(f.value);
    return '<button class="ia-row" onclick="aeSetFilter(\'dept\',' + jsStr([...d.variants][0]) + ')" aria-pressed="' + !!on + '">' +
      '<span class="ia-row-l">' + esc(d.label) +
      (d.variants.size > 1 ? ' <em title="Also stored as: ' + esc([...d.variants].join(', ')) + '">+' + (d.variants.size - 1) + ' spelling</em>' : '') +
      '</span><span class="ia-row-bar"><span style="width:' + Math.round(d.n / deptMax * 100) + '%"></span></span>' +
      '<span class="ia-row-n">' + d.n + '</span></button>';
  }).join('');

  /* ── can you actually reach them? ──────────────────────────── */
  const leadReach = leaders.filter(c => c.email || c.phone).length;
  const noReach = people.filter(c => !c.email && !c.phone).length;
  const reachPct = leaders.length ? Math.round(leadReach / leaders.length * 100) : 0;

  /* ── the ladder ────────────────────────────────────────────── */
  const seats = AE_LADDER.map(seat => {
    const hits = people.filter(c => aeSeatMatch(seat, c));
    const on = f && f.kind === 'ladder' && f.value === seat.k;
    const held = hits.length > 0;
    const who = held
      ? esc(hits[0].first + ' ' + hits[0].last) + (hits.length > 1 ? ' +' + (hits.length - 1) : '')
      : 'No one on file';
    /* A held seat filters the list to that person. An empty one has
       nothing to filter to, so it stays inert and simply reads as the
       gap it is — the panel never offers a click it cannot honour. */
    const inner =
      '<span class="ia-prod-n">' + esc(seat.label) + '</span>' +
      '<span class="ia-prod-s" style="color:' + (held ? '#3ddc84' : '#fb923c') + '">' + who + '</span>' +
      '<span class="' + (held ? 'ia-prod-r' : 'ia-prod-x') + '">' + esc(seat.why) + '</span>';
    return held
      ? '<button class="ia-prod is-linked" style="background:rgba(61,220,132,.10);border-color:rgba(61,220,132,.28)" ' +
        'aria-pressed="' + !!on + '" onclick="aeSetFilter(\'ladder\',\'' + seat.k + '\')" ' +
        'title="' + (hasList ? 'Show only ' + esc(seat.label) + ' contacts' : 'Open the org map') + '">' + inner + '</button>'
      : '<div class="ia-prod" style="background:rgba(251,146,60,.07);border-color:rgba(251,146,60,.22)">' + inner + '</div>';
  }).join('');
  const seatsHeld = AE_LADDER.filter(s => people.some(c => aeSeatMatch(s, c))).length;

  const filterChip = f ? '<button class="ia-clear" onclick="aeClearFilter()">Showing ' +
    (f.kind === 'role' ? esc((AE_TIERS.find(t => t.r === Number(f.value)) || {}).label || '')
      : f.kind === 'lead' ? 'the decision makers'
      : f.kind === 'dept' ? esc(f.value)
      : f.kind === 'dupe' ? 'the duplicated name'
      : f.kind === 'ladder' ? esc((AE_LADDER.find(s => s.k === f.value) || {}).label || '')
      : f.value === 'missing' ? 'contacts with no email or phone' : 'contacts you can reach') +
    ' <span>&times;</span></button>' : '';

  const countLine = contacts.length === people.length
    ? people.length + (people.length === 1 ? ' person' : ' people')
    : people.length + ' people in ' + contacts.length + ' records';

  return '<div class="card ia-card">' +
    '<div class="card-header" style="margin-bottom:14px">' +
      '<div><div class="card-title">Who is here, and what they hold</div>' +
      '<div class="card-sub">Read off job titles — click any band to ' +
        (hasList ? 'filter the contacts below' : 'open the people behind it') + '</div></div>' +
      filterChip +
    '</div>' +
    '<div class="ia-grid">' +
      '<div class="ia-panel">' +
        '<div class="ia-h">Seniority <b>' + countLine + '</b></div>' +
        '<div class="ia-bar">' + roleBar + '</div>' +
        '<div class="ia-keys">' + roleKey + '</div>' +
        '<p class="ia-note">' + (leaders.length
          ? '<b>' + leaders.length + '</b> of ' + people.length + ' own the tariff, the carbon number or the signature.'
          : 'Nobody here owns energy, sustainability or the budget yet — you are talking to the wrong floor.') + '</p>' +
      '</div>' +

      '<div class="ia-panel">' +
        '<div class="ia-h">Departments <b>' + Object.keys(deptMap).length + ' distinct</b></div>' +
        '<div class="ia-rows">' + (deptRows || '<p class="ia-empty">No departments recorded.</p>') + '</div>' +
      '</div>' +

      '<div class="ia-panel">' +
        '<div class="ia-h">Reachability</div>' +
        '<div class="ia-mini">' +
          '<button class="ia-tile" onclick="aeSetFilter(\'lead\',1)" aria-pressed="' + !!(f && f.kind === 'lead') + '">' +
            '<span class="ia-tile-n" style="color:' + (leaders.length && leadReach === leaders.length ? '#3ddc84' : leaders.length ? '#fb923c' : 'var(--muted)') + '">' +
            leadReach + '<em>/' + leaders.length + '</em></span>' +
            '<span class="ia-tile-l">Decision makers you can reach</span>' +
            '<span class="ia-tile-s">' + (leaders.length ? (reachPct === 100 ? 'all reachable' : reachPct + '% of them') : 'none identified yet') + '</span>' +
          '</button>' +
          '<button class="ia-tile" onclick="aeSetFilter(\'email\',\'missing\')" aria-pressed="' + !!(f && f.kind === 'email' && f.value === 'missing') + '">' +
            '<span class="ia-tile-n" style="color:' + (noReach ? '#fb923c' : '#3ddc84') + '">' + noReach + '</span>' +
            '<span class="ia-tile-l">No email or phone</span>' +
            '<span class="ia-tile-s">' + (noReach ? 'cannot be contacted yet' : 'everyone contactable') + '</span>' +
          '</button>' +
        '</div>' +
        (dupeKeys.length ? '<button class="ia-flag" onclick="aeSetFilter(\'dupe\',1)" aria-pressed="' + !!(f && f.kind === 'dupe') + '">' +
          '&#9888; ' + dupeKeys.length + ' name' + (dupeKeys.length === 1 ? '' : 's') + ' stored twice — ' +
          esc(dupeKeys.slice(0, 2).map(d => d.replace(/\b\w/g, m => m.toUpperCase())).join(', ')) + (dupeKeys.length > 2 ? '…' : '') +
          '<u>show the records</u></button>' : '') +
      '</div>' +

      '<div class="ia-panel ia-panel-link" onclick="nav(\'org-map\',{id:\'' + o.id + '\'})" role="button" tabindex="0" ' +
        'onkeydown="if(event.key===\'Enter\')nav(\'org-map\',{id:\'' + o.id + '\'})" ' +
        'title="Open the visual org chart for ' + esc(o.short || o.name) + '">' +
        '<div class="ia-h">Org map <b>' + people.length + (people.length === 1 ? ' person' : ' people') + '</b></div>' +
        '<div style="display:flex;align-items:center;gap:12px">' +
          '<span style="color:var(--accent);display:flex">' + icon('grid', 26) + '</span>' +
          '<span style="font-size:12px;font-weight:600;color:var(--text2)">Who sits where, by department and seniority &rarr;</span>' +
        '</div>' +
      '</div>' +

      '<div class="ia-panel ia-wide">' +
        '<div class="ia-h">Stakeholder ladder <b>' + seatsHeld + ' of ' + AE_LADDER.length + ' seats covered</b></div>' +
        '<div class="ia-prods">' + seats + '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

/* ═══════════════════════════════════════════════════════════════
   THE CONTACTS CARD — the most-used card on the page, and the one
   the panel above filters.
   ═══════════════════════════════════════════════════════════════ */
function contactsCardHtml(o) {
  const all = contactsFor(o.id);
  const f = aeActiveFilter(o.id);
  /* Sorted by the ladder, not alphabetically: the person who owns the
     tariff should be the first name a rep sees, every time. */
  const shown = all.filter(aeMatches)
    .slice().sort((a, b) => aeRoleRank(a) - aeRoleRank(b) || (a.last || '').localeCompare(b.last || ''));

  const head = '<div class="card-header"><div><div class="card-title">Contacts (' + shown.length +
    (f && shown.length !== all.length ? ' of ' + all.length : '') + ')</div>' +
    (f ? '<div class="card-sub">Filtered — <span class="ext-link" style="cursor:pointer" onclick="aeClearFilter()">show all ' + all.length + '</span></div>'
       : '<div class="card-sub">Most senior first, by who owns the electricity decision</div>') + '</div>' +
    '<div style="display:flex;gap:6px">' +
    (all.length ? '<button class="btn btn-ghost btn-xs" onclick="nav(\'org-map\',{id:\'' + o.id + '\'})">' + icon('grid', 12) + ' Org map</button>' : '') +
    '<button class="btn btn-ghost btn-xs" onclick="openAddContact(\'' + o.id + '\')">Add</button></div></div>';

  if (!all.length) {
    return '<div class="card">' + head +
      '<div class="empty" style="padding:26px 10px"><h3>No contacts yet</h3>' +
      '<p>Add the person who signs the electricity contract, not just the person who answers the phone.</p></div></div>';
  }
  if (!shown.length) {
    return '<div class="card">' + head +
      '<div class="empty" style="padding:26px 10px"><h3>Nobody matches that filter</h3>' +
      '<p><button class="btn btn-outline btn-sm" onclick="aeClearFilter()">Show all ' + all.length + ' contacts</button></p></div></div>';
  }

  return '<div class="card">' + head + shown.map(c => {
    const tier = AE_TIERS.find(t => t.r === aeRoleRank(c)) || {};
    return '<div class="person-row">' +
      '<div class="av" style="background:' + avatarColor(c.first + c.last) + '">' + esc(initials(c.first, c.last).toUpperCase()) + '</div>' +
      '<div style="min-width:0;flex:1">' +
        '<div class="person-name">' + esc(c.first + ' ' + c.last) +
        (c.role === 'decision' ? ' <span class="badge b-contracted" style="font-size:9px">decision maker</span>' : '') + '</div>' +
        '<div class="person-title">' + esc(c.title) + (c.dept ? ' · ' + esc(c.dept) : '') + '</div>' +
        (tier.hex ? '<div class="cx-tier"><i style="background:' + tier.hex + '"></i>' + esc(tier.label) + '</div>' : '') +
        (c.email || c.phone ? '<div class="person-title" style="margin-top:2px">' +
          (c.email ? '<a class="ext-link" href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a> ' : '') +
          (c.phone ? esc(c.phone) : '') + '</div>' : '') +
      '</div>' +
      '<div class="person-actions">' +
        (safeHref(c.linkedin) ? '<a class="btn btn-xs btn-outline" href="' + esc(safeHref(c.linkedin)) + '" target="_blank" rel="noopener">' + icon('link', 11) + '</a>' : '') +
        '<button class="btn btn-xs btn-outline" data-admin-only onclick="openEditContact(\'' + c.id + '\')">' + icon('edit', 11) + '</button>' +
        '<button class="btn btn-xs btn-danger" data-admin-only onclick="confirmDelete(\'contact\',\'' + c.id + '\')">' + icon('trash', 11) + '</button>' +
      '</div>' +
    '</div>';
  }).join('') + '</div>';
}

/* ═══════════════════════════════════════════════════════════════
   THE ORG MAP

   A genuine hierarchy rank, unlike aeRoleRank above — that one ranks
   "who do I talk to about a PPA", so a Group Energy Manager outranks
   a CFO. Here a CEO always outranks a department head, because this
   is a picture of the company, not of the sale.

   A Vice-/Deputy-/Acting- qualifier demotes a title by one tier, but
   "does the title contain 'deputy' anywhere" is not enough to decide
   that: "Managing Director & Deputy Chair" carries an unqualified top
   word and a qualified one, and the unqualified one should win.
   aeOrgQual() resolves it by checking only the text immediately
   around each match rather than the whole string — so "Deputy
   Director" is caught by its own local "deputy", while "Director &
   Deputy Chair" still reads as a full Director.
   ═══════════════════════════════════════════════════════════════ */
const AE_ORG_TIER_LABEL = {
  0: 'CEO / Managing Director', 1: 'Exco / C-suite',
  2: 'Director / General Manager', 3: 'Deputy / Senior Manager',
  4: 'Manager / Superintendent', 5: 'Engineer / Officer / Specialist', 6: 'Other',
};
const AE_ORG_QUAL_RE   = /\b(?:vice|deputy|assistant|associate|acting|second)\b/i;
const AE_ORG_TOP_RE    = /\bchief\s+executive(?:\s+officer)?\b|\bceo\b|\bmanaging\s+director\b|\bexecutive\s+chairman\b|\bchairman\b|\bpresident\b|\bgroup\s+chief\s+executive\b/i;
const AE_ORG_CSUITE_RE = /\bchief\s+\w+(?:\s+\w+)?\s+officer\b|\bcfo\b|\bcoo\b|\bcto\b|\bcio\b|\bcso\b|\bchro\b|\bexecutive\s+director\b|\bgroup\s+executive\b|\bboard\s+member\b|\bmember\s+of\s+the\s+(?:executive\s+)?board\b/i;
const AE_ORG_DIR_RE    = /\bdirector\b|\bgeneral\s+manager\b|\bhead\s+of\b|\bdivisional\s+head\b|\b(?:mine|plant|works|mill)\s+manager\b|\bvice\s+president\b/i;
const AE_ORG_MGR_RE    = /\bmanager\b|\bsuperintendent\b|\bco[oö]rdinator\b|\bteam\s+lead(?:er)?\b|\bforeman\b|\bsupervisor\b|\bcontroller\b|\blead\b/i;
const AE_ORG_STAFF_RE  = /\bengineer\w*\b|\bofficer\b|\bspecialist\b|\banalyst\b|\badvis[oe]r\b|\bconsultant\b|\btechnician\b|\bbuyer\b|\baccountant\b|\bplanner\b|\bartisan\b|\bmillwright\b|\bassistant\b/i;

function aeOrgQual(t, nounRe) {
  const re = new RegExp(nounRe.source, 'gi');
  let m, found = false;
  while ((m = re.exec(t))) {
    found = true;
    const before = t.slice(Math.max(0, m.index - 20), m.index);
    const afterM = t.slice(m.index + m[0].length).match(/^\s*([^,&()/–—-]{0,20})/);
    if (!AE_ORG_QUAL_RE.test(before) && !AE_ORG_QUAL_RE.test(afterM ? afterM[1] : '')) return 'unqualified';
  }
  return found ? 'qualified' : null;
}
function aeOrgRank(title) {
  const t = String(title || '');
  const top = aeOrgQual(t, AE_ORG_TOP_RE);
  if (top === 'unqualified') return 0;
  if (top === 'qualified') return 1;
  if (AE_ORG_CSUITE_RE.test(t)) return 1;
  const dir = aeOrgQual(t, AE_ORG_DIR_RE);
  if (dir === 'unqualified') return 2;
  if (dir === 'qualified') return 3;
  if (AE_ORG_MGR_RE.test(t)) return 4;
  if (AE_ORG_STAFF_RE.test(t)) return 5;
  return 6;
}

/* Executive-committee departments form the leadership row at the top
   of the chart rather than a peer branch beside Operations, Finance
   and the rest — which is how a group exco actually sits. Anyone at
   exco rank with no department recorded joins that row too, rather
   than being filed under "Unassigned" at the bottom of the page. */
const AE_EXEC_DEPT_RE = /\bexco\b|\bexecutive\s+(?:committee|board|office|team|management)\b|\bboard\s+of\s+directors\b|\bgroup\s+(?:executive|leadership)\b|\bhead\s+office\b|\bc-?suite\b/i;
function aeIsExec(c) {
  return AE_EXEC_DEPT_RE.test(String((c && c.dept) || '')) || aeOrgRank(c && c.title) <= 1;
}
function aeBranchKey(c) {
  const d = String((c && c.dept) || '').replace(/\s+/g, ' ').trim();
  return d || '￿Unassigned';
}

function renderOrgMap() {
  const o = getOfftaker(state.detailId);
  if (!o.id) { nav('offtakers'); return; }
  const contacts = contactsFor(o.id);

  setPage((o.short || o.name) + ' — Org map',
    'Who sits where — a visual map of tracked contacts by department and seniority',
    '<button class="btn btn-outline btn-sm" onclick="nav(\'detail\',{id:\'' + o.id + '\'})">Back to the account</button>' +
    '<button class="btn btn-primary btn-sm" data-admin-only onclick="openAddContact(\'' + o.id + '\')">' + icon('plus', 14) + ' Add contact</button>');

  if (!contacts.length) {
    setContent('<div class="empty" style="padding:60px 30px"><div class="ei">' + icon('contacts', 30) + '</div>' +
      '<h3>No contacts yet at ' + esc(o.short || o.name) + '</h3>' +
      '<p>Add contacts on this account\'s page and they appear here automatically, grouped by department and seniority.</p>' +
      '<p><button class="btn btn-primary btn-sm" data-admin-only onclick="openAddContact(\'' + o.id + '\')">' + icon('plus', 14) + ' Add the first contact</button></p></div>');
    return;
  }

  const byRank = (a, b) => aeOrgRank(a.title) - aeOrgRank(b.title) || (a.last || '').localeCompare(b.last || '');
  const execs = contacts.filter(aeIsExec).slice().sort(byRank);

  const branchMap = new Map();
  contacts.filter(c => !aeIsExec(c)).forEach(c => {
    const k = aeBranchKey(c);
    if (!branchMap.has(k)) branchMap.set(k, []);
    branchMap.get(k).push(c);
  });
  const branches = [...branchMap.entries()]
    .map(([key, list]) => ({
      key,
      label: key === '￿Unassigned' ? 'No department recorded' : key,
      list: list.slice().sort(byRank),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  function cardHtml(c) {
    const tier = AE_TIERS.find(t => t.r === aeRoleRank(c)) || {};
    return '<div class="orgmap-card" onclick="openEditContact(\'' + c.id + '\')" title="Click to edit">' +
      (tier.hex ? '<span class="orgmap-pip" style="background:' + tier.hex + '" title="' + esc(tier.label) + '"></span>' : '') +
      '<div class="name">' + esc(c.first + ' ' + c.last) + '</div>' +
      '<div class="title">' + esc(c.title || 'No title on file') + '</div>' +
      (c.email ? '<div class="email"><a href="mailto:' + esc(c.email) + '" onclick="event.stopPropagation()">' + esc(c.email) + '</a></div>' : '') +
    '</div>';
  }

  /* Groups consecutive same-rank people into one row at the top, and
     drops a tier label between rank changes inside a branch — this is
     what actually shows "director, then manager, then engineer"
     stacking within one department, which is the map's whole point. */
  function execRows(list) {
    const rows = [];
    let cur = null;
    list.forEach(c => {
      const r = aeOrgRank(c.title);
      if (!cur || cur.rank !== r) { cur = { rank: r, people: [] }; rows.push(cur); }
      cur.people.push(c);
    });
    return rows.map(row => '<div class="orgmap-vline"></div>' +
      '<div class="orgmap-row">' + row.people.map(cardHtml).join('') + '</div>').join('');
  }

  function branchHtml(b) {
    const out = [];
    let last = null;
    b.list.forEach(c => {
      const r = aeOrgRank(c.title);
      if (r !== last) { out.push('<div class="orgmap-tier-badge">' + esc(AE_ORG_TIER_LABEL[r] || 'Other') + '</div>'); last = r; }
      out.push(cardHtml(c));
    });
    return '<div class="orgmap-branch">' +
      '<div class="orgmap-branch-header">' + esc(b.label) + '<span class="orgmap-branch-count">' + b.list.length + '</span></div>' +
      '<div class="orgmap-branch-cards">' + out.join('') + '</div></div>';
  }

  const legend = AE_TIERS.filter(t => contacts.some(c => aeRoleRank(c) === t.r))
    .map(t => '<span class="orgmap-leg"><i style="background:' + t.hex + '"></i>' + esc(t.label) + '</span>').join('');

  setContent(
    '<div class="orgmap-wrap"><div class="orgmap-tree">' +
      '<div class="orgmap-inst-node">' + esc(o.short || o.name) + '</div>' +
      (execs.length ? execRows(execs) : '') +
      (branches.length ? '<div class="orgmap-vline"></div><div class="orgmap-branches">' +
        branches.map(branchHtml).join('') + '</div>' : '') +
    '</div></div>' +
    '<div class="orgmap-foot">' +
      '<div class="orgmap-legend">' + legend + '</div>' +
      '<div>' + contacts.length + ' contact' + (contacts.length === 1 ? '' : 's') +
      ' mapped · click a card to edit · updates as contacts are added</div>' +
    '</div>');
}
