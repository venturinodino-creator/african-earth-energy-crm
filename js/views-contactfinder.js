/* ═══════════════════════════════════════════════════════════════════
   Contact finder — people at the offtakers and the main municipalities,
   found by an agent.

   Laid out like the pending-contacts screen in the Netherlands CRM: a
   target selector and role chips that set what the next run will
   cover, then the found people in a flat table a reviewer works down.

   Two Claude Code agents do the finding (.claude/agents/
   offtaker-contact-finder and municipality-contact-finder), driven
   through scripts/finder-agent.js — see docs/contact-finder-agents.md.
   "Find contacts now" only records a run and leaves it queued; it does
   not search. The contract:

     run   (state.contactRuns)   { id, created, status, industry, roles,
                                   offtakerIds, found, note }
           status: 'queued' | 'running' | 'done' | 'failed'
     find  (state.foundContacts) { id, runId, offtakerId, first, last,
                                   title, role, phone, email, source,
                                   confidence, status }
           status: 'pending' | 'approved' | 'discarded'

   An agent claims a queued run, appends finds, marks the run done.
   Nothing it finds enters the contact book on its own — a person
   accepts each row, and accepting is what writes the aee_contacts
   record. A scraped person is a claim about a real human, so the
   reviewer sees the source before it becomes a number they dial.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* Roles worth finding, in the order the desk works them. */
const FINDER_ROLES = ['decision', 'technical', 'influencer'];
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

/* The target is one piece of screen state (state.cfTarget): a sector id,
   or FINDER_MUNI for the main municipalities. It opens on mining and is
   not remembered between loads — the default is the point. The selector
   lists only targets that still have people missing, so the screen stays
   as quiet as the mining-only version was. Everything that follows from
   the target is a pure function of the data passed in, so it can be
   tested without a browser (tests/finder-targets.test.js). */
const FINDER_DEFAULT_TARGET = 'mining';
/* The sector's full name is "Mining & Minerals (Producer)", which is
   right in a taxonomy and wrong on a button. */
const FINDER_MINING_LABEL = 'Mining';

/* Municipalities are a target here as much as the sectors are, but they
   are not a sector: they come from reference data rather than the
   offtaker list, and only the main ones are worth a run. Both agents'
   output is reviewed in the same table — municipalities already hang
   off the same contacts machinery, so nothing below had to be
   duplicated. */
const FINDER_MUNI = 'municipal';
const FINDER_MUNI_LABEL = 'Main municipalities';

function finderIsMuni(key) { return key === FINDER_MUNI; }
function finderAccountIsMuni(id) { return String(id || '').startsWith('mun_'); }

/* Run history, empty state and export all label by this. Unknown keys
   fall back to the key itself so an old row never breaks, and a
   sector-group key from an older run still reads. */
function industryLabel(key) {
  if (key === FINDER_DEFAULT_TARGET) return FINDER_MINING_LABEL;
  if (key === 'all') return 'All industries';
  if (finderIsMuni(key)) return FINDER_MUNI_LABEL;
  return SECTOR_LABEL[key] || SECTOR_GROUPS[key] || key;
}

/* An account needs people when nobody is on file and it is not parked —
   a parked account is not being worked, so a gap there is not a gap.
   withContacts is the set of account ids that have someone. */
function finderNeedsPeople(o, withContacts) {
  return o.status !== 'parked' && !withContacts.has(o.id);
}

/* What the selector offers: mining always, the selected target always,
   every other sector with at least one account needing people, and the
   main municipalities when the data holds any. Each carries how many of
   its accounts need people. */
function finderTargetOptions(offtakers, withContacts, mainMunis, labelOf, selected) {
  const bySector = new Map();
  offtakers.forEach(o => {
    if (!bySector.has(o.sector)) bySector.set(o.sector, { needs: 0, total: 0 });
    const t = bySector.get(o.sector);
    t.total++;
    if (finderNeedsPeople(o, withContacts)) t.needs++;
  });
  const sectorOption = key => {
    const t = bySector.get(key) || { needs: 0, total: 0 };
    return { key, label: labelOf(key), needs: t.needs, total: t.total };
  };
  const others = [...bySector.keys()]
    .filter(k => k !== FINDER_DEFAULT_TARGET && k !== selected && bySector.get(k).needs > 0)
    .map(sectorOption)
    .sort((a, b) => a.label.localeCompare(b.label));
  const list = [sectorOption(FINDER_DEFAULT_TARGET)];
  if (selected !== FINDER_DEFAULT_TARGET && !finderIsMuni(selected)) list.push(sectorOption(selected));
  list.push(...others);

  if (mainMunis.length) {
    list.push({
      key: FINDER_MUNI, label: FINDER_MUNI_LABEL, total: mainMunis.length,
      needs: mainMunis.filter(m => !withContacts.has(m.id)).length,
    });
  }
  return list;
}

/* The accounts a run would cover: every account in the target, narrowed
   by province if one is picked. No "only where we have nobody" — a run
   is pointed at the target and the reviewer decides per row. */
function finderScopeAccounts(target, offtakers, mainMunis, province) {
  /* Filtered again here so a caller handing over every municipality
     still gets only the main ones. */
  const pool = finderIsMuni(target) ? mainMunis.filter(muniIsMain) : offtakers.filter(o => o.sector === target);
  return province ? pool.filter(a => a.province === province) : pool;
}

/* The provinces present in the target, so the filter cannot offer an
   empty set. */
function finderProvinces(target, offtakers, mainMunis) {
  return [...new Set(finderScopeAccounts(target, offtakers, mainMunis, '')
    .map(a => a.province).filter(Boolean))].sort();
}

/* The run that queuing writes. The ids are what the agent is pointed at:
   a municipality run carries mun_ ids and the industry the screen
   already labels as municipal, so the municipality agent's target
   command resolves every account with no change on its side. */
function finderRunRecord(target, scope, roles, id, created) {
  return {
    id, created, status: 'queued',
    industry: target,
    roles: roles.slice(),
    offtakerIds: scope.map(a => a.id),
    found: 0, note: '',
  };
}

/* The screen's reading of the above, over live state. */
function finderMainMunis() { return SA_MUNICIPALITIES.filter(muniIsMain); }
function finderWithContacts() {
  return new Set(state.contacts
    .filter(c => !c.status || c.status === 'active').map(c => c.offtakerId));
}
function finderScopeOfftakers() {
  return finderScopeAccounts(state.cfTarget, state.offtakers, finderMainMunis(), state.cfProvince);
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

  /* Only what still needs a decision is reviewed here. An accepted find
     has become a contact and lives on the Contacts page under its
     company — keeping it in this table too made the queue read as
     never-ending. A find waiting from an earlier run is still shown. */
  const pending = state.foundContacts.filter(f => f.status === 'pending');
  const accepted = state.foundContacts.filter(f => f.status === 'approved').length;
  const noEmail = pending.filter(f => !findHasEmail(f)).length;
  const scoped = finderScopeOfftakers();

  const findLabel = 'Find ' + industryLabel(state.cfTarget).toLowerCase() + ' contacts now';

  /* Accept all is always on the bar, greyed when there is nothing to
     take, so a reviewer never has to hunt for it after a run lands.
     One press ingests every pending find into its municipality or
     company. A missing email is flagged on the row, not held against
     it — the reviewer can add one later on the contact itself. */
  const acceptTitle = pending.length
    ? 'Add every pending find to its municipality or company' +
      (noEmail ? ' · ' + noEmail + ' without an email' : '')
    : 'Nothing pending';

  setPage('Contact finder',
    pending.length + ' awaiting review' +
      (accepted ? ' · ' + accepted + ' accepted and filed under Contacts' : '') +
      ' — accept to add to the CRM, discard to drop',
    '<button class="btn btn-outline btn-sm" data-admin-only onclick="queueContactRun()"' +
      (scoped.length && state.cfRoles.length ? '' : ' disabled') + '>' +
      icon('search', 14) + ' ' + esc(findLabel) + '</button>' +
    '<button class="btn btn-primary btn-sm" data-admin-only onclick="acceptAllFound()"' +
      (pending.length ? '' : ' disabled') + ' title="' + esc(acceptTitle) + '">' +
      'Accept all (' + pending.length + ')' +
      (noEmail ? ' <span style="opacity:.75;font-weight:400">· ' + noEmail + ' without email</span>' : '') +
      '</button>' +
    '<button class="btn btn-outline btn-sm" onclick="nav(\'prospect-companies\')">' +
      icon('building', 14) + ' Prospect companies</button>' +
    '<button class="btn btn-outline btn-sm" onclick="refreshFinderFromServer(true)">' +
      icon('refresh', 14) + ' Refresh</button>' +
    '<button class="btn btn-outline btn-sm" onclick="exportFoundContacts()">' +
      icon('download', 14) + ' Export</button>');

  setContent(
    finderTargetBar() +
    finderRoleBar(scoped) +
    finderNoticeHtml() +
    finderRunStrip() +
    (pending.length ? finderTableHtml(pending) : finderEmptyHtml(accepted)));
}

/* The target selector. Lists only targets with people missing (plus
   mining and whatever is selected), each with how many need people. */
function finderTargetBar() {
  const options = finderTargetOptions(state.offtakers, finderWithContacts(),
    finderMainMunis(), industryLabel, state.cfTarget);
  return '<div class="cf-bar">' +
    '<span class="cf-bar-label">Next scrape target:</span>' +
    '<select class="flt cf-flt" onchange="setFinderTarget(this.value)">' +
      options.map(o => '<option value="' + esc(o.key) + '"' +
        (state.cfTarget === o.key ? ' selected' : '') + '>' +
        esc(o.label) + ' · ' + o.needs + ' need people</option>').join('') +
    '</select>' +
  '</div>';
}

/* A province that is not in the new target would filter it to nothing,
   so it is cleared rather than carried across. */
function setFinderTarget(key) {
  state.cfTarget = key;
  if (state.cfProvince &&
      !finderProvinces(key, state.offtakers, finderMainMunis()).includes(state.cfProvince)) {
    state.cfProvince = '';
  }
  renderContactFinder();
}

/* Roles use the same chip language, plus the narrowing select. */
function finderRoleBar(scoped) {
  const provinces = finderProvinces(state.cfTarget, state.offtakers, finderMainMunis());
  const isMuni = finderIsMuni(state.cfTarget);
  const nounOne = isMuni ? 'municipality' : 'offtaker';
  const nounPlural = isMuni ? 'municipalities' : 'offtakers';
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
    '<span class="cf-scope">' + scoped.length + ' ' + (scoped.length === 1 ? nounOne : nounPlural) +
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
    'Nothing becomes a contact until someone accepts the row — <strong>Accept all</strong> takes ' +
    'every pending row and files each one under its municipality or company. A row without a ' +
    'work email is flagged, not held back; add the address on the row or on the contact later.</span></div>';
}

/* Whether a find carries a work email. It is a flag, not a gate: a
   find without one is still accepted, and the missing address shows
   on the row and the contact so someone fills it in. The check is
   deliberately loose (shape only): whether the address is REAL is
   what the source link and the reviewer are for. */
const FIND_EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function findHasEmail(f) { return FIND_EMAIL_RE.test(String(f.email || '').trim()); }

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

  const run = finderRunRecord(state.cfTarget, scoped, state.cfRoles, uid('run'), todayISO());
  state.contactRuns.unshift(run);
  saveFinderState();
  toast('Queued · ' + industryLabel(state.cfTarget) + ' · ' + scoped.length +
    (finderIsMuni(state.cfTarget) ? ' municipalities' : ' offtakers'));
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
function finderEmptyHtml(accepted) {
  return '<div class="empty"><div class="ei">' + icon('contacts', 30) + '</div>' +
    '<h3>Nothing awaiting review</h3>' +
    (accepted
      ? '<p>' + accepted + ' find' + (accepted === 1 ? ' has' : 's have') + ' been accepted and filed under ' +
        '<span class="ext-link" style="cursor:pointer" onclick="nav(&#39;contacts&#39;)">Contacts</span>.</p>'
      : '') +
    '<p>Pick a target and the roles you want, then click "Find ' + esc(industryLabel(state.cfTarget).toLowerCase()) +
    ' contacts now" to queue a run. ' +
    'People the agent finds land here for review before they reach the contact book — ' +
    'everything already accepted is on the <span class="ext-link" style="cursor:pointer" ' +
    'onclick="nav(\'contacts\')">Contacts page</span>, filed under its company.</p></div>';
}

function finderTableHtml(list) {
  if (!list.length) {
    return '<div class="empty"><p style="font-size:13px;color:var(--muted)">Nothing pending review.</p></div>';
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
          : f.status === 'pending'
            ? '<span class="badge b-medium" title="No work email yet — accepting still files the contact; add the address on the row or later">No email</span>'
            : '<span style="color:var(--muted)">—</span>') + '</td>' +
        '<td>' + (href ? '<a class="ext-link" href="' + esc(href) + '" target="_blank" rel="noopener">Source</a>'
          : '<span style="color:var(--muted)">—</span>') + '</td>' +
        '<td><span class="badge ' + (f.status === 'approved' ? 'b-contracted' : 'b-medium') + '">' +
          esc(FIND_STATUS_LABEL[f.status] || f.status) + '</span></td>' +
        '<td style="white-space:nowrap">' +
          (f.status === 'pending'
            ? '<button class="btn btn-xs btn-primary" data-admin-only onclick="approveFoundContact(\'' + f.id + '\')">Accept</button> ' +
              (findHasEmail(f) ? ''
                : '<button class="btn btn-xs btn-outline" data-admin-only onclick="addEmailAndAccept(\'' + f.id + '\')" ' +
                  'title="Enter the work email first, then accept">Add email &amp; accept</button> ') +
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

/* The person a find describes, if they are already in the book on the
   same account. Matched on name rather than email: the imports that
   put most of the book there carried no email, and supplying one is
   the whole point of the find. */
function contactOnFileFor(f) {
  const key = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return state.contacts.find(c => c.offtakerId === f.offtakerId &&
    key(c.first) === key(f.first) && key(c.last) === key(f.last)) || null;
}

/* What accepting a find does to the book: a new contact, or — when the
   person is already on file — the existing one with its blanks filled
   from the find. It used to always be the former, which is how one
   review pass left every Bauba, Blyvoor and Copper 360 name in the book
   twice: once from the CSV import, once from the finder. */
function acceptFindInto(f) {
  const existing = contactOnFileFor(f);
  if (!existing) {
    const c = foundToContact(f);
    state.contacts.push(c);
    f.status = 'approved';
    return { contact: c, reused: false };
  }
  if (!existing.email && f.email) existing.email = f.email;
  if (!existing.phone && f.phone) existing.phone = f.phone;
  if (!existing.title && f.title) existing.title = f.title;
  existing.notes = ((existing.notes || '').trim() + ' Confirmed by the contact finder' +
    (f.source ? ' — ' + f.source : '') + '.').trim();
  f.status = 'approved';
  return { contact: existing, reused: true };
}

async function approveFoundContact(id) {
  if (state.role !== 'admin') { toast('Read-only access — ask an admin to accept', 'warn'); return; }
  const f = state.foundContacts.find(x => x.id === id);
  if (!f || f.status !== 'pending') return;

  const { contact, reused } = acceptFindInto(f);
  saveFinderState();
  save();

  /* Paint before syncing. Awaiting the write first meant a failed one
     rejected out of here and skipped the re-render, leaving the screen
     contradicting local state that had already changed. */
  renderContactFinder();
  toast(reused
    ? f.first + ' ' + f.last + ' was already on file — details filled in'
    : 'Accepted ' + f.first + ' ' + f.last);

  try {
    await pushContact(contact);
    await pushFoundContact(f);
  } catch (e) {
    console.warn('Contact saved locally but not synced:', e);
    toast('Saved locally — the server write failed and will need a re-sync', 'warn');
  }
}

/* Accept with an address typed in first: the reviewer has found it
   themselves (the source page, a signature, the switchboard). It is
   written back to the find so the row shows where the contact's email
   came from — a person, not the agent. */
async function addEmailAndAccept(id) {
  if (state.role !== 'admin') { toast('Read-only access — ask an admin to accept', 'warn'); return; }
  const f = state.foundContacts.find(x => x.id === id);
  if (!f || f.status !== 'pending') return;
  const typed = prompt('Work email for ' + f.first + ' ' + f.last + ' (' + (f.title || 'no title') + '):', f.email || '');
  if (typed === null) return;
  const email = String(typed).trim().toLowerCase();
  if (!FIND_EMAIL_RE.test(email)) { toast('That does not look like an email address', 'warn'); return; }
  f.email = email;
  saveFinderState();
  await approveFoundContact(id);
}

async function acceptAllFound() {
  if (state.role !== 'admin') { toast('Read-only access — ask an admin to accept', 'warn'); return; }
  await acceptFinds(state.foundContacts.filter(f => f.status === 'pending'));
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

/* Every find handed in is filed under the account its offtakerId names
   — a municipality (mun_…) or a company — which is what the contact
   book, the municipality page and the offtaker page all read from.
   Finds without an email go in too, counted in the toast so the
   reviewer knows how many addresses are still to be filled. */
async function acceptFinds(live) {
  if (!live.length) { toast('Nothing pending to accept'); return; }
  const noEmail = live.filter(f => !findHasEmail(f)).length;

  const results = live.map(acceptFindInto);
  const made = results.map(r => r.contact);
  const reused = results.filter(r => r.reused).length;
  saveFinderState();
  save();
  /* render(), not renderContactFinder() — this now runs from the
     prospect list too, and the repaint has to land on whichever screen
     the press came from. */
  render();
  toast('Accepted ' + made.length + ' contact' + (made.length === 1 ? '' : 's') +
    (reused ? ' · ' + reused + ' already on file, details filled in' : '') +
    (noEmail ? ' · ' + noEmail + ' without an email' : ''));

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
