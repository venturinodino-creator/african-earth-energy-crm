/* ═══════════════════════════════════════════════════════════════════
   Contact finder — scaffolding for the contact-discovery agent.

   The desk picks which offtakers it wants people found for, and which
   roles it wants, and queues a run. An agent then goes and finds the
   people and writes them back for review.

   THE AGENT DOES NOT EXIST YET. Everything here is the surface it will
   plug into, so runs queue and sit at 'queued' rather than pretending to
   search. The contract is deliberately small:

     A run  (state.contactRuns)   { id, created, status, scope, roles,
                                    offtakerIds, found, note }
       status: 'queued' | 'running' | 'done' | 'failed'
       The agent claims a queued run, sets status 'running', appends
       results to state.foundContacts, then sets 'done' and `found`.

     A find (state.foundContacts) { id, runId, offtakerId, first, last,
                                    title, role, phone, email, source,
                                    confidence, status }
       status: 'pending' | 'approved' | 'discarded'

   Nothing the agent finds enters the real contact book on its own —
   a person approves each row, and approval is what writes an
   aee_contacts record. Scraped people are a claim about a real human,
   so a rep sees the source before it becomes a number they will dial.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* Roles the run can ask for. Same vocabulary as a real contact, so an
   approved find needs no translation. */
const FINDER_ROLES = ['decision', 'technical', 'influencer', 'gatekeeper'];

const FIND_STATUS_LABEL = { pending: 'Needs review', approved: 'Approved', discarded: 'Discarded' };
const RUN_STATUS_LABEL = { queued: 'Queued', running: 'Running', done: 'Done', failed: 'Failed' };

function loadFinderState() {
  state.contactRuns = lsGet('contact_runs', []);
  state.foundContacts = lsGet('found_contacts', []);
}
function saveFinderState() {
  lsSet('contact_runs', state.contactRuns);
  lsSet('found_contacts', state.foundContacts);
}

/* The offtakers a run would cover, given the scope pickers. */
function finderScopeOfftakers() {
  return state.offtakers.filter(o => {
    if (state.cfSector && o.sector !== state.cfSector) return false;
    if (state.cfStatus && o.status !== state.cfStatus) return false;
    if (state.cfProvince && o.province !== state.cfProvince) return false;
    if (state.cfOnlyEmpty && contactsFor(o.id).length) return false;
    return true;
  });
}

function finderScopeLabel(scope) {
  const bits = [];
  if (scope.sector) bits.push(sectorName(scope.sector));
  if (scope.status) bits.push(STATUS_LABEL[scope.status] || scope.status);
  if (scope.province) bits.push(scope.province);
  if (scope.onlyEmpty) bits.push('no contacts yet');
  return bits.length ? bits.join(' · ') : 'Every offtaker';
}

function renderContactFinder() {
  if (!state.contactRuns) loadFinderState();

  const scoped = finderScopeOfftakers();
  const withNone = scoped.filter(o => !contactsFor(o.id).length).length;
  const pending = state.foundContacts.filter(f => f.status === 'pending');

  setPage('Contact finder',
    'Find people at the offtakers you choose · ' + state.contacts.length + ' contacts on file',
    '<button class="btn btn-outline btn-sm" onclick="nav(\'prospect-companies\')">' +
      icon('building', 14) + ' Prospect companies</button>' +
    '<button class="btn btn-outline btn-sm" onclick="exportFoundContacts()">' +
      icon('download', 14) + ' Export finds</button>');

  const stats =
    '<div class="stats-grid">' +
      statTile('building', 'green', 'Offtakers in scope', scoped.length, finderScopeLabel({
        sector: state.cfSector, status: state.cfStatus, province: state.cfProvince, onlyEmpty: state.cfOnlyEmpty })) +
      statTile('target', 'amber', 'No contacts yet', withNone, 'nobody to call at these accounts') +
      statTile('search', 'blue', 'Runs queued', state.contactRuns.filter(r => r.status === 'queued').length,
        'waiting for an agent to claim them') +
      statTile('contacts', 'purple', 'Finds to review', pending.length, 'not in the contact book until approved') +
    '</div>';

  setContent(stats + finderNoticeHtml() + finderScopeHtml(scoped) +
    finderRunsHtml() + finderFindsHtml());
}

/* Says plainly that nothing is searching yet, so a queued run that never
   moves reads as "not built" rather than "broken". */
function finderNoticeHtml() {
  return '<div class="news-sample-banner">' + icon('alert', 14) +
    '<span><strong>No agent connected yet.</strong> Runs you queue here are recorded and sit at ' +
    '<em>Queued</em> — nothing is searching. This page is the surface the agent will plug into: it ' +
    'claims a queued run, appends what it finds, and a person approves each row before it becomes ' +
    'a contact.</span></div>';
}

function finderScopeHtml(scoped) {
  const provinces = [...new Set(state.offtakers.map(o => o.province).filter(Boolean))].sort();
  const sel = (key, allLabel, pairs) =>
    '<select class="flt" onchange="state.' + key + '=this.value;renderContactFinder()">' +
      '<option value="">' + esc(allLabel) + '</option>' +
      pairs.map(([v, l]) => '<option value="' + esc(v) + '"' + (state[key] === v ? ' selected' : '') +
        '>' + esc(l) + '</option>').join('') +
    '</select>';

  const roleBoxes = FINDER_ROLES.map(r =>
    '<label class="cf-role' + (state.cfRoles.includes(r) ? ' on' : '') + '">' +
      '<input type="checkbox" ' + (state.cfRoles.includes(r) ? 'checked' : '') +
      ' onchange="toggleFinderRole(\'' + r + '\')">' + esc(ROLE_LABEL[r] || r) +
    '</label>').join('');

  return '<div class="card">' +
    '<div class="card-header"><div><div class="card-title">What should the agent work on?</div>' +
    '<div class="card-sub">Pick the offtakers, then the roles worth finding at each one</div></div></div>' +

    '<div class="form-section-title">Offtaker type</div>' +
    '<div class="toolbar" style="margin-bottom:10px">' +
      '<select class="flt" onchange="state.cfSector=this.value;renderContactFinder()">' +
        '<option value="">All sectors</option>' + sectorOptions(state.cfSector) + '</select>' +
      sel('cfStatus', 'All statuses', Object.entries(STATUS_LABEL)) +
      sel('cfProvince', 'All provinces', provinces.map(p => [p, p])) +
      '<label class="cf-role' + (state.cfOnlyEmpty ? ' on' : '') + '">' +
        '<input type="checkbox" ' + (state.cfOnlyEmpty ? 'checked' : '') +
        ' onchange="state.cfOnlyEmpty=this.checked;renderContactFinder()">Only where we have nobody</label>' +
      '<span class="result-count">' + scoped.length + ' offtaker' + (scoped.length === 1 ? '' : 's') + '</span>' +
    '</div>' +

    '<div class="form-section-title">Roles to find</div>' +
    '<div class="cf-roles">' + roleBoxes + '</div>' +

    '<div class="cf-submit">' +
      '<button class="btn btn-primary btn-sm" data-admin-only ' +
        (scoped.length && state.cfRoles.length ? '' : 'disabled ') +
        'onclick="queueContactRun()">' + icon('search', 14) + ' Queue discovery run</button>' +
      '<span class="fg-hint" style="margin:0">' +
        (!scoped.length ? 'No offtakers match this scope.'
          : !state.cfRoles.length ? 'Pick at least one role.'
          : 'Will ask for ' + state.cfRoles.length + ' role' + (state.cfRoles.length === 1 ? '' : 's') +
            ' across ' + scoped.length + ' offtaker' + (scoped.length === 1 ? '' : 's') + '.') +
      '</span>' +
    '</div>' +
  '</div>';
}

function toggleFinderRole(r) {
  const i = state.cfRoles.indexOf(r);
  if (i === -1) state.cfRoles.push(r); else state.cfRoles.splice(i, 1);
  renderContactFinder();
}

function queueContactRun() {
  if (state.role !== 'admin') { toast('Read-only access — ask an admin to queue a run', 'warn'); return; }
  const scoped = finderScopeOfftakers();
  if (!scoped.length || !state.cfRoles.length) return;

  const run = {
    id: uid('run'),
    created: todayISO(),
    status: 'queued',
    scope: { sector: state.cfSector, status: state.cfStatus, province: state.cfProvince, onlyEmpty: !!state.cfOnlyEmpty },
    roles: state.cfRoles.slice(),
    offtakerIds: scoped.map(o => o.id),
    found: 0,
    note: '',
  };
  state.contactRuns.unshift(run);
  saveFinderState();
  toast('Run queued for ' + scoped.length + ' offtaker' + (scoped.length === 1 ? '' : 's'));
  renderContactFinder();
}

function deleteContactRun(id) {
  state.contactRuns = state.contactRuns.filter(r => r.id !== id);
  saveFinderState();
  renderContactFinder();
}

function finderRunsHtml() {
  if (!state.contactRuns.length) {
    return '<div class="card"><div class="card-header"><div class="card-title">Discovery runs</div></div>' +
      '<div class="empty"><div class="ei">' + icon('search', 30) + '</div><h3>No runs yet</h3>' +
      '<p>Choose a scope above and queue one. It will wait here until an agent picks it up.</p></div></div>';
  }
  return '<div class="card">' +
    '<div class="card-header"><div><div class="card-title">Discovery runs</div>' +
    '<div class="card-sub">Newest first · a run records what was asked for, not what was found</div></div></div>' +
    '<div class="table-wrap" style="border:none;background:transparent"><table><thead><tr>' +
      '<th>Queued</th><th>Scope</th><th>Roles</th><th class="num">Offtakers</th>' +
      '<th class="num">Found</th><th>Status</th><th></th>' +
    '</tr></thead><tbody>' +
    state.contactRuns.map(r =>
      '<tr>' +
        '<td style="white-space:nowrap">' + esc(r.created) + '</td>' +
        '<td>' + esc(finderScopeLabel(r.scope || {})) + '</td>' +
        '<td>' + r.roles.map(x => '<span class="badge b-prospect">' + esc(ROLE_LABEL[x] || x) + '</span>').join(' ') + '</td>' +
        '<td class="num">' + (r.offtakerIds || []).length + '</td>' +
        '<td class="num">' + num(r.found) + '</td>' +
        '<td><span class="badge ' + (r.status === 'done' ? 'b-contracted' : r.status === 'failed' ? 'b-high' : 'b-medium') + '">' +
          esc(RUN_STATUS_LABEL[r.status] || r.status) + '</span></td>' +
        '<td style="white-space:nowrap"><button class="btn btn-xs btn-danger" data-admin-only ' +
          'onclick="deleteContactRun(\'' + r.id + '\')">' + icon('trash', 11) + '</button></td>' +
      '</tr>').join('') +
    '</tbody></table></div></div>';
}

/* ═══════════════════════════════════════════════════════════════
   FINDS — what the agent brings back, before anyone trusts it
   ═══════════════════════════════════════════════════════════════ */
function finderFindsHtml() {
  const finds = state.foundContacts.filter(f => f.status !== 'discarded');
  if (!finds.length) {
    return '<div class="card"><div class="card-header"><div><div class="card-title">Found contacts</div>' +
      '<div class="card-sub">Company, name, title, role, phone and email — one row per person</div></div></div>' +
      '<div class="empty"><div class="ei">' + icon('contacts', 30) + '</div><h3>Nothing found yet</h3>' +
      '<p>Once an agent runs, the people it finds land here for review. Approving a row is what ' +
      'creates the contact — nothing reaches the contact book unchecked.</p></div></div>';
  }
  return '<div class="card">' +
    '<div class="card-header"><div><div class="card-title">Found contacts</div>' +
    '<div class="card-sub">Approve a row to create the contact · ' +
      finds.filter(f => f.status === 'pending').length + ' awaiting review</div></div></div>' +
    '<div class="table-wrap" style="border:none;background:transparent"><table><thead><tr>' +
      '<th>Company</th><th>Name</th><th>Surname</th><th>Title</th><th>Role</th>' +
      '<th>Phone</th><th>Email</th><th>Source</th><th>Status</th><th>Actions</th>' +
    '</tr></thead><tbody>' +
    finds.map(f => {
      const o = getOfftaker(f.offtakerId);
      const href = safeHref(f.source);
      return '<tr>' +
        '<td>' + (o.id
          ? '<span class="ext-link" style="cursor:pointer" onclick="nav(\'detail\',{id:\'' + o.id + '\'})">' + esc(o.short || o.name) + '</span>'
          : '<span class="badge b-low">unknown</span>') + '</td>' +
        '<td style="font-weight:700">' + esc(f.first) + '</td>' +
        '<td style="font-weight:700">' + esc(f.last) + '</td>' +
        '<td>' + esc(f.title || '—') + '</td>' +
        '<td><span class="badge ' + (f.role === 'decision' ? 'b-contracted' : 'b-prospect') + '">' +
          esc(ROLE_LABEL[f.role] || f.role || '—') + '</span></td>' +
        '<td>' + (f.phone ? esc(f.phone) : '<span style="color:var(--muted)">—</span>') + '</td>' +
        '<td>' + (f.email ? '<a class="ext-link" href="mailto:' + esc(f.email) + '">' + esc(f.email) + '</a>'
          : '<span style="color:var(--muted)">—</span>') + '</td>' +
        '<td>' + (href ? '<a class="ext-link" href="' + esc(href) + '" target="_blank" rel="noopener">source</a>'
          : '<span style="color:var(--muted)">—</span>') + '</td>' +
        '<td><span class="badge ' + (f.status === 'approved' ? 'b-contracted' : 'b-medium') + '">' +
          esc(FIND_STATUS_LABEL[f.status] || f.status) + '</span></td>' +
        '<td style="white-space:nowrap">' +
          (f.status === 'pending'
            ? '<button class="btn btn-xs btn-primary" data-admin-only onclick="approveFoundContact(\'' + f.id + '\')">Approve</button> ' +
              '<button class="btn btn-xs btn-outline" data-admin-only onclick="discardFoundContact(\'' + f.id + '\')">Discard</button>'
            : '<span style="color:var(--muted);font-size:11px">in the contact book</span>') +
        '</td></tr>';
    }).join('') +
    '</tbody></table></div></div>';
}

/* Approval is the only path from a find into aee_contacts. */
async function approveFoundContact(id) {
  if (state.role !== 'admin') { toast('Read-only access — ask an admin to approve', 'warn'); return; }
  const f = state.foundContacts.find(x => x.id === id);
  if (!f || f.status !== 'pending') return;

  const contact = {
    id: uid('con'), offtakerId: f.offtakerId,
    first: f.first, last: f.last, title: f.title || '', dept: '',
    email: f.email || '', phone: f.phone || '', linkedin: '',
    role: f.role || 'influencer', priority: f.role === 'decision' ? 'high' : 'medium',
    status: 'active',
    notes: 'Found by the contact finder' + (f.source ? ' — ' + f.source : '') + '.',
  };
  state.contacts.push(contact);
  f.status = 'approved';
  saveFinderState();
  save();

  /* Paint before syncing. A failed server write used to reject out of this
     function and skip the re-render, leaving the approved row on screen and
     the page half-drawn — the local state was already correct, so the user
     was shown a lie about a write that had in fact happened locally. */
  renderContactFinder();
  toast('Added ' + f.first + ' ' + f.last + ' to contacts');

  try {
    await pushContact(contact);
  } catch (e) {
    console.warn('Contact saved locally but not synced:', e);
    toast('Saved locally — the server write failed and will need a re-sync', 'warn');
  }
}

function discardFoundContact(id) {
  const f = state.foundContacts.find(x => x.id === id);
  if (!f) return;
  f.status = 'discarded';
  saveFinderState();
  toast('Discarded');
  renderContactFinder();
}

function exportFoundContacts() {
  const head = ['company', 'first_name', 'surname', 'title', 'role', 'phone', 'email', 'source', 'status'];
  const rows = [head].concat(state.foundContacts.map(f => {
    const o = getOfftaker(f.offtakerId);
    return [o.name || '', f.first, f.last, f.title || '', ROLE_LABEL[f.role] || f.role || '',
      f.phone || '', f.email || '', f.source || '', FIND_STATUS_LABEL[f.status] || f.status];
  }));
  downloadCSV('aee-found-contacts-' + todayISO() + '.csv', rows);
  toast('Exported ' + (rows.length - 1) + ' find' + (rows.length === 2 ? '' : 's'));
}
