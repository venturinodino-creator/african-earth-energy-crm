/* ═══════════════════════════════════════════════════════════════════
   Contact finder — people at the offtakers, found by an agent.

   Laid out like the pending-contacts screen in the Netherlands CRM: a
   chip row that both filters the list and sets what the next run will
   target, then the found people in a flat table a reviewer works down.

   THE AGENT DOES NOT EXIST YET. "Find contacts now" records a run and
   leaves it queued rather than pretending to search. The contract:

     run   (state.contactRuns)   { id, created, status, industry, roles,
                                   offtakerIds, found, note }
           status: 'queued' | 'running' | 'done' | 'failed'
     find  (state.foundContacts) { id, runId, offtakerId, first, last,
                                   title, role, phone, email, source,
                                   confidence, status }
           status: 'pending' | 'approved' | 'discarded'

   The agent claims a queued run, appends finds, marks the run done.
   Nothing it finds enters the contact book on its own — a person
   accepts each row, and accepting is what writes the aee_contacts
   record. A scraped person is a claim about a real human, so the
   reviewer sees the source before it becomes a number they dial.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* Roles worth finding, in the order the desk works them. */
const FINDER_ROLES = ['decision', 'technical', 'influencer', 'gatekeeper'];
const FIND_STATUS_LABEL = { pending: 'Needs review', approved: 'Accepted', discarded: 'Discarded' };
const RUN_STATUS_LABEL = { queued: 'Queued', running: 'Running', done: 'Done', failed: 'Failed' };

/* Runs and finds live in Supabase — the agent writes them from outside
   the browser, so localStorage is only ever a cache to paint from while
   the fetch is in flight, and a fallback when the server is unreachable.
   Same shape as load() uses for the rest of the CRM. */
function loadFinderCache() {
  state.contactRuns = lsGet('contact_runs', []);
  state.foundContacts = lsGet('found_contacts', []);
}
function saveFinderState() {
  lsSet('contact_runs', state.contactRuns);
  lsSet('found_contacts', state.foundContacts);
}

let _finderLoading = false;

/* Paints from cache first, then replaces it with the server's copy. The
   agent may have appended finds since this browser last looked, so what
   is on screen is stale by definition until this lands. */
async function refreshFinderFromServer(announce) {
  if (_finderLoading) return;
  _finderLoading = true;
  try {
    const { runs, finds } = await fetchFinderData();
    state.contactRuns = runs;
    state.foundContacts = finds;
    saveFinderState();
    if (announce) toast('Refreshed · ' + runs.length + ' run' + (runs.length === 1 ? '' : 's') +
      ', ' + finds.length + ' find' + (finds.length === 1 ? '' : 's'));
  } catch (e) {
    console.warn('Could not reach Supabase for the contact finder:', e);
    if (announce) toast('Could not reach the server — showing the cached copy', 'warn');
  } finally {
    _finderLoading = false;
    /* Repaint whichever screen is reading this data, and only if it is
       still on screen — the user may have navigated away while the
       request was in flight. The dashboard's agents card reads the same
       runs, so it has to be woken too or it sits on the cached copy
       until something else happens to re-render it. The prospect list
       carries the pending count in its header for the same reason. */
    if (state.view === 'prospects') renderContactFinder();
    else if (state.view === 'dashboard') renderDashboard();
    else if (state.view === 'offtakers') renderOfftakers();
    applyRoleUI();
  }
}

/* The industry chips are the sector groups — the coarse cut of "what
   kind of business", which is how energy intensity actually varies.
   Heavy industry and smelting run a flat 24/7 load; a retail chain does
   not. Ordered heaviest first so the ones worth calling lead. */
const FINDER_INDUSTRIES = [
  'heavy-industry', 'primary', 'manufacturing', 'digital',
  'logistics', 'commercial', 'utilities-public', 'emerging',
];

/* Municipalities are a target here as much as the industries are, but
   they are not an industry: they come from reference data rather than
   the offtaker list, and only the main ones are worth a run today. The
   chip row carries them as one more key so both agents' output is
   reviewed in the same table — municipalities already hang off the same
   contacts machinery, so nothing below this line had to be duplicated. */
const FINDER_MUNI = 'municipal';

function finderIsMuni(key) { return key === FINDER_MUNI; }
function finderAccountIsMuni(id) { return String(id || '').startsWith('mun_'); }

function industryColor(key) {
  if (finderIsMuni(key)) return '#38bdf8';
  return (typeof GROUP_COLOR !== 'undefined' && GROUP_COLOR[key]) || '#7a90a8';
}
function industryLabel(key) {
  if (key === 'all') return 'All industries';
  if (finderIsMuni(key)) return 'Main municipalities';
  return SECTOR_GROUPS[key] || key;
}

/* The accounts a run would cover. The chip is the primary cut; the two
   selects narrow it further. Municipalities and offtakers are different
   record types, so this returns the shape they have in common — an id,
   a name and a province — which is all a run or this page needs. */
function finderScopeOfftakers() {
  if (finderIsMuni(state.cfIndustry)) {
    return SA_MUNICIPALITIES.filter(m => {
      if (!muniIsMain(m)) return false;
      if (state.cfProvince && m.province !== state.cfProvince) return false;
      if (state.cfOnlyEmpty && contactsFor(m.id).length) return false;
      return true;
    }).map(muniAsAccount);
  }
  return state.offtakers.filter(o => {
    if (state.cfIndustry !== 'all' && sectorGroup(o.sector) !== state.cfIndustry) return false;
    if (state.cfProvince && o.province !== state.cfProvince) return false;
    if (state.cfOnlyEmpty && contactsFor(o.id).length) return false;
    return true;
  });
}

/* Whether a run's scope is municipalities, read off the ids it carries
   rather than off the industry string — the ids are what the agent was
   actually pointed at. */
function finderRunIsMuni(r) {
  return finderIsMuni(r.industry) || (r.offtakerIds || []).some(finderAccountIsMuni);
}

function finderIndustryOf(find) {
  if (finderAccountIsMuni(find.offtakerId)) return FINDER_MUNI;
  const o = getOfftaker(find.offtakerId);
  return o.id ? sectorGroup(o.sector) : null;
}

/* The account a find belongs to, whichever list it came from. */
function finderAccountOf(id) {
  if (finderAccountIsMuni(id)) {
    const m = muniOf(id);
    return m ? muniAsAccount(m) : {};
  }
  const o = getOfftaker(id);
  return o.id ? o : {};
}

function renderContactFinder() {
  if (!state.contactRuns) { loadFinderCache(); refreshFinderFromServer(false); }

  const live = state.foundContacts.filter(f => f.status !== 'discarded');
  const counts = { all: live.length };
  FINDER_INDUSTRIES.concat([FINDER_MUNI]).forEach(k => { counts[k] = 0; });
  live.forEach(f => { const k = finderIndustryOf(f); if (counts[k] != null) counts[k]++; });

  const filtered = state.cfIndustry === 'all'
    ? live : live.filter(f => finderIndustryOf(f) === state.cfIndustry);
  const pending = filtered.filter(f => f.status === 'pending');
  const scoped = finderScopeOfftakers();

  const findLabel = state.cfIndustry === 'all'
    ? 'Find contacts now'
    : 'Find ' + industryLabel(state.cfIndustry) + ' contacts now';

  setPage('Contact finder',
    'Contacts found by the agent, awaiting review — accept to add to the CRM, discard to drop',
    '<button class="btn btn-outline btn-sm" data-admin-only onclick="queueContactRun()"' +
      (scoped.length && state.cfRoles.length ? '' : ' disabled') + '>' +
      icon('search', 14) + ' ' + esc(findLabel) + '</button>' +
    (pending.length
      ? '<button class="btn btn-primary btn-sm" data-admin-only onclick="acceptAllFound()">' +
        'Accept all (' + pending.length + ')</button>'
      : '') +
    '<button class="btn btn-outline btn-sm" onclick="nav(\'prospect-companies\')">' +
      icon('building', 14) + ' Prospect companies</button>' +
    '<button class="btn btn-outline btn-sm" onclick="refreshFinderFromServer(true)">' +
      icon('refresh', 14) + ' Refresh</button>' +
    '<button class="btn btn-outline btn-sm" onclick="exportFoundContacts()">' +
      icon('download', 14) + ' Export</button>');

  setContent(
    finderTargetBar(counts) +
    finderRoleBar(scoped) +
    finderNoticeHtml() +
    finderRunStrip() +
    (live.length ? finderTableHtml(filtered) : finderEmptyHtml()));
}

/* ═══════════════════════════════════════════════════════════════
   THE CHIP ROW — filters the list and sets the next run's target,
   which is one control because they are one decision.
   ═══════════════════════════════════════════════════════════════ */
function finderTargetBar(counts) {
  const chip = (key) => {
    const active = state.cfIndustry === key;
    const colour = key === 'all' ? '#f1f5f9' : industryColor(key);
    const n = key === 'all' ? counts.all : (counts[key] || 0);
    return '<button class="cf-chip" onclick="setFinderIndustry(\'' + key + '\')" style="' +
      'border-color:' + (active ? colour : 'var(--border2)') + ';' +
      'background:' + (active ? colour + '22' : 'transparent') + ';' +
      'color:' + (active ? colour : 'var(--muted)') + '">' +
      esc(industryLabel(key)) + ' (' + n + ')</button>';
  };
  return '<div class="cf-bar">' +
    '<span class="cf-bar-label">Filter / next scrape target:</span>' +
    ['all'].concat(FINDER_INDUSTRIES).map(chip).join('') +
    '<span class="cf-bar-sep"></span>' + chip(FINDER_MUNI) +
  '</div>';
}

function setFinderIndustry(key) {
  state.cfIndustry = key;
  renderContactFinder();
}

/* Roles use the same chip language, plus the two narrowing selects. */
function finderRoleBar(scoped) {
  const muni = finderIsMuni(state.cfIndustry);
  const noun = muni ? 'municipalit' : 'offtaker';
  const provinces = muni
    ? MUNI_PROVINCES.slice()
    : [...new Set(state.offtakers.map(o => o.province).filter(Boolean))].sort();
  const roleChips = FINDER_ROLES.map(r => {
    const on = state.cfRoles.includes(r);
    return '<button class="cf-chip" onclick="toggleFinderRole(\'' + r + '\')" style="' +
      'border-color:' + (on ? 'var(--accent)' : 'var(--border2)') + ';' +
      'background:' + (on ? 'rgba(61,220,132,.13)' : 'transparent') + ';' +
      'color:' + (on ? 'var(--accent)' : 'var(--muted)') + '">' +
      esc(ROLE_LABEL[r] || r) + '</button>';
  }).join('');

  return '<div class="cf-bar">' +
    '<span class="cf-bar-label">Roles to find:</span>' + roleChips +
    '<select class="flt cf-flt" onchange="state.cfProvince=this.value;renderContactFinder()">' +
      '<option value="">All provinces</option>' +
      provinces.map(p => '<option value="' + esc(p) + '"' +
        (state.cfProvince === p ? ' selected' : '') + '>' + esc(p) + '</option>').join('') +
    '</select>' +
    '<label class="cf-chip cf-check' + (state.cfOnlyEmpty ? ' on' : '') + '">' +
      '<input type="checkbox" ' + (state.cfOnlyEmpty ? 'checked' : '') +
      ' onchange="state.cfOnlyEmpty=this.checked;renderContactFinder()">Only where we have nobody</label>' +
    '<span class="cf-scope">' + scoped.length + ' ' + noun + (scoped.length === 1 ? (muni ? 'y' : '') : (muni ? 'ies' : 's')) +
      ' in scope' + (state.cfRoles.length ? '' : ' · pick a role') + '</span>' +
  '</div>';
}

function toggleFinderRole(r) {
  const i = state.cfRoles.indexOf(r);
  if (i === -1) state.cfRoles.push(r); else state.cfRoles.splice(i, 1);
  renderContactFinder();
}

/* The run does not start itself. Queuing writes the request; an operator
   then points an agent at it from a terminal. Saying so plainly is the
   whole job of this banner — a queue that looks self-serving is how a
   run sits untouched for a week. */
function finderNoticeHtml() {
  return '<div class="news-sample-banner">' + icon('alert', 14) +
    '<span><strong>Queuing a run does not start it.</strong> "Find contacts now" records the request ' +
    'and leaves it <em>Queued</em>. An operator runs the agent against it — see ' +
    '<code>docs/contact-finder-agents.md</code> — and it appends what it finds here. ' +
    'Nothing becomes a contact until someone accepts the row.</span></div>';
}

/* One line per run rather than a table — a run is a request, and the
   interesting part is what came back, which is the table below. */
function finderRunStrip() {
  if (!state.contactRuns.length) return '';
  return '<div class="cf-runs">' +
    state.contactRuns.slice(0, 5).map(r =>
      '<div class="cf-run">' +
        '<span class="badge ' + (r.status === 'done' ? 'b-contracted' : r.status === 'failed' ? 'b-high' : 'b-medium') + '">' +
          esc(RUN_STATUS_LABEL[r.status] || r.status) + '</span>' +
        '<span class="cf-run-t">' + esc(industryLabel(r.industry || 'all')) + '</span>' +
        '<span class="cf-run-m">' + (r.offtakerIds || []).length +
          (finderRunIsMuni(r) ? ' municipalities · ' : ' offtakers · ') +
          (r.roles || []).map(x => esc(ROLE_LABEL[x] || x)).join(', ') + '</span>' +
        '<span class="cf-run-m">' + num(r.found) + ' found</span>' +
        '<span class="cf-run-m">' + esc(r.created) + '</span>' +
        '<button class="btn btn-xs btn-danger" data-admin-only onclick="deleteContactRun(\'' + r.id + '\')">' +
          icon('trash', 11) + '</button>' +
      '</div>').join('') +
  '</div>';
}

function queueContactRun() {
  if (state.role !== 'admin') { toast('Read-only access — ask an admin to queue a run', 'warn'); return; }
  const scoped = finderScopeOfftakers();
  if (!scoped.length) { toast('Nothing matches this target', 'warn'); return; }
  if (!state.cfRoles.length) { toast('Pick at least one role to find', 'warn'); return; }

  const run = {
    id: uid('run'), created: todayISO(), status: 'queued',
    industry: state.cfIndustry,
    roles: state.cfRoles.slice(),
    offtakerIds: scoped.map(o => o.id),
    found: 0, note: '',
  };
  state.contactRuns.unshift(run);
  saveFinderState();
  toast('Queued · ' + industryLabel(state.cfIndustry) + ' · ' + scoped.length +
    (finderIsMuni(state.cfIndustry) ? ' municipalities' : ' offtakers'));
  renderContactFinder();
  /* The run only means anything once it is on the server — that is where
     the agent looks for work. */
  pushContactRun(run);
}

function deleteContactRun(id) {
  state.contactRuns = state.contactRuns.filter(r => r.id !== id);
  saveFinderState();
  renderContactFinder();
  removeRow('aee_contact_runs', id);
}

/* ═══════════════════════════════════════════════════════════════
   THE REVIEW TABLE — everything a rep needs to judge a find
   ═══════════════════════════════════════════════════════════════ */
function finderEmptyHtml() {
  return '<div class="empty"><div class="ei">' + icon('contacts', 30) + '</div>' +
    '<h3>No pending contacts</h3>' +
    '<p>Pick an industry above and click "Find contacts now" to queue a run. ' +
    'People the agent finds land here for review before they reach the contact book.</p></div>';
}

function finderTableHtml(list) {
  if (!list.length) {
    return '<div class="empty"><p style="font-size:13px;color:var(--muted)">No <b>' +
      esc(industryLabel(state.cfIndustry)) + '</b> contacts pending. Try another filter.</p></div>';
  }
  return '<div class="table-wrap"><table><thead><tr>' +
    '<th>Name</th><th>Title</th><th>Role</th><th>Company</th>' +
    '<th>Phone</th><th>Email</th><th>Source</th><th>Status</th><th>Action</th>' +
    '</tr></thead><tbody>' +
    list.map(f => {
      const o = finderAccountOf(f.offtakerId);
      const isMuni = finderAccountIsMuni(f.offtakerId);
      const href = safeHref(f.source);
      return '<tr>' +
        '<td><div class="name-cell"><div class="av" style="background:' + avatarColor(f.first + f.last) + '">' +
          esc(initials(f.first, f.last).toUpperCase()) + '</div>' +
          '<div style="font-weight:700">' + esc(f.first) + ' ' + esc(f.last) + '</div></div></td>' +
        '<td>' + esc(f.title || '—') + '</td>' +
        '<td><span class="badge ' + (f.role === 'decision' ? 'b-contracted' : 'b-prospect') + '">' +
          esc(ROLE_LABEL[f.role] || f.role || '—') + '</span></td>' +
        '<td>' + (!o.id
          ? '<span class="badge b-low">unknown</span>'
          : isMuni
            ? '<span class="badge b-prospect">' + esc(o.short || o.name) + '</span>'
            : '<span class="badge b-grp-' + sectorGroup(o.sector) + '">' + esc(o.short || o.name) + '</span>') + '</td>' +
        '<td>' + (f.phone ? esc(f.phone) : '<span style="color:var(--muted)">—</span>') + '</td>' +
        '<td>' + (f.email ? '<a class="ext-link" href="mailto:' + esc(f.email) + '">' + esc(f.email) + '</a>'
          : '<span style="color:var(--muted)">—</span>') + '</td>' +
        '<td>' + (href ? '<a class="ext-link" href="' + esc(href) + '" target="_blank" rel="noopener">Source</a>'
          : '<span style="color:var(--muted)">—</span>') + '</td>' +
        '<td><span class="badge ' + (f.status === 'approved' ? 'b-contracted' : 'b-medium') + '">' +
          esc(FIND_STATUS_LABEL[f.status] || f.status) + '</span></td>' +
        '<td style="white-space:nowrap">' +
          (f.status === 'pending'
            ? '<button class="btn btn-xs btn-primary" data-admin-only onclick="approveFoundContact(\'' + f.id + '\')">Accept</button> ' +
              '<button class="btn btn-xs btn-danger" data-admin-only onclick="discardFoundContact(\'' + f.id + '\')">Discard</button>'
            : '<span style="color:var(--muted);font-size:11px">in the contact book</span>') +
        '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

/* Accepting is the only path from a find into aee_contacts. */
function foundToContact(f) {
  return {
    id: uid('con'), offtakerId: f.offtakerId,
    first: f.first, last: f.last, title: f.title || '', dept: '',
    email: f.email || '', phone: f.phone || '', linkedin: '',
    role: f.role || 'influencer', priority: f.role === 'decision' ? 'high' : 'medium',
    status: 'active',
    notes: 'Found by the contact finder' + (f.source ? ' — ' + f.source : '') + '.',
  };
}

async function approveFoundContact(id) {
  if (state.role !== 'admin') { toast('Read-only access — ask an admin to accept', 'warn'); return; }
  const f = state.foundContacts.find(x => x.id === id);
  if (!f || f.status !== 'pending') return;

  const contact = foundToContact(f);
  state.contacts.push(contact);
  f.status = 'approved';
  saveFinderState();
  save();

  /* Paint before syncing. Awaiting the write first meant a failed one
     rejected out of here and skipped the re-render, leaving the screen
     contradicting local state that had already changed. */
  renderContactFinder();
  toast('Accepted ' + f.first + ' ' + f.last);

  try {
    await pushContact(contact);
    await pushFoundContact(f);
  } catch (e) {
    console.warn('Contact saved locally but not synced:', e);
    toast('Saved locally — the server write failed and will need a re-sync', 'warn');
  }
}

async function acceptAllFound() {
  if (state.role !== 'admin') { toast('Read-only access — ask an admin to accept', 'warn'); return; }
  await acceptFinds(state.foundContacts.filter(f => f.status === 'pending' &&
    (state.cfIndustry === 'all' || finderIndustryOf(f) === state.cfIndustry)));
}

/* The same acceptance from outside the finder: every pending find,
   companies and municipalities alike, ignoring whatever chip the finder
   was last filtered to. The prospect list offers this so the whole
   review queue can be ingested into the accounts in one press. */
async function acceptAllFoundEverywhere() {
  if (state.role !== 'admin') { toast('Read-only access — ask an admin to accept', 'warn'); return; }
  if (!state.foundContacts) loadFinderCache();
  await acceptFinds(state.foundContacts.filter(f => f.status === 'pending'));
}

async function acceptFinds(live) {
  if (!live.length) return;

  const made = live.map(f => { const c = foundToContact(f); state.contacts.push(c); f.status = 'approved'; return c; });
  saveFinderState();
  save();
  /* render(), not renderContactFinder() — this now runs from the
     prospect list too, and the repaint has to land on whichever screen
     the press came from. */
  render();
  toast('Accepted ' + made.length + ' contact' + (made.length === 1 ? '' : 's'));

  let failed = 0;
  for (const c of made) {
    try { await pushContact(c); } catch (e) { failed++; }
  }
  for (const f of live) {
    try { await pushFoundContact(f); } catch (e) {}
  }
  if (failed) toast(failed + ' of ' + made.length + ' saved locally only — they will need a re-sync', 'warn');
}

function discardFoundContact(id) {
  const f = state.foundContacts.find(x => x.id === id);
  if (!f) return;
  f.status = 'discarded';
  saveFinderState();
  toast('Discarded');
  renderContactFinder();
  pushFoundContact(f);
}

function exportFoundContacts() {
  const head = ['first_name', 'surname', 'title', 'role', 'company', 'industry', 'phone', 'email', 'source', 'status'];
  const rows = [head].concat(state.foundContacts.map(f => {
    const o = getOfftaker(f.offtakerId);
    return [f.first, f.last, f.title || '', ROLE_LABEL[f.role] || f.role || '',
      o.name || '', industryLabel(finderIndustryOf(f) || 'all'),
      f.phone || '', f.email || '', f.source || '', FIND_STATUS_LABEL[f.status] || f.status];
  }));
  downloadCSV('aee-found-contacts-' + todayISO() + '.csv', rows);
  toast('Exported ' + (rows.length - 1) + ' find' + (rows.length === 2 ? '' : 's'));
}
