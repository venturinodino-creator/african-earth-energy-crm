/* ═══════════════════════════════════════════════════════════════════
   Quick create: + New opens one drawer, whatever you are creating.

   The four create forms (off-taker, contact, opportunity, activity) keep their
   fields, their validation and their save rules; they live in index.html and
   forms.js. What this adds is the way they are presented. Creating opens a
   drawer from the right with a row of pills to switch between the four, so a
   rep can create any of them without going back to the menu. Editing a record
   keeps the centred dialog: the drawer means "new" and the dialog means "change".

   Off-takers and contacts also warn, as you type, when the record looks like one
   already on file. A warning never hides the form. Saving still refuses an exact
   copy, as it always did, because the same company or person twice is the
   commonest way the book goes wrong.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* The four kinds, in the order the + New menu lists them. `save` and `open` are the ids
   of the form's own buttons; only a kind with a page of its own has a Create & open. */
const QC_KINDS = [
  { key: 'offtaker', label: 'Off-taker',   modal: 'modal-offtaker',    save: 'mo-save', open: 'mo-save-open', dupe: 'mo-dupe' },
  { key: 'contact',  label: 'Contact',     modal: 'modal-contact',     save: 'mc-save', open: 'mc-save-open', dupe: 'mc-dupe' },
  { key: 'deal',     label: 'Opportunity', modal: 'modal-deal',        save: 'md-save' },
  { key: 'activity', label: 'Activity',    modal: 'modal-interaction', save: 'mi-save' },
];

function qcPillsHtml(active) {
  return '<div class="qc-pills" role="tablist" aria-label="What to create">' + QC_KINDS.map(k =>
    '<button class="qc-pill' + (k.key === active ? ' active' : '') + '" role="tab" aria-selected="' + (k.key === active ? 'true' : 'false') +
    '" onclick="quickCreate(\'' + k.key + '\')">' + esc(k.label) + '</button>').join('') + '</div>';
}

/* Switch to another kind: close every form, open that one fresh. Nothing half-typed is
   carried across, and nothing that was saved is touched. */
function quickCreate(kind) {
  if (!QC_KINDS.some(k => k.key === kind)) return;
  QC_KINDS.forEach(k => closeModal(k.modal));
  ({ offtaker: openAddOfftaker, contact: openAddContact, deal: openAddDeal, activity: openLogInteraction })[kind]();
}

/* Present a form as the drawer (creating) or the dialog (editing). */
function qcMode(modalId, asDrawer) {
  const kind = QC_KINDS.find(k => k.modal === modalId);
  if (!kind) return;
  document.getElementById(modalId).classList.toggle('drawer', !!asDrawer);
  document.getElementById(modalId + '-pills').innerHTML = asDrawer ? qcPillsHtml(kind.key) : '';
  document.getElementById(kind.save).textContent = asDrawer ? 'Create' : 'Save';
  if (kind.open) document.getElementById(kind.open).style.display = asDrawer ? '' : 'none';
  if (kind.dupe) document.getElementById(kind.dupe).hidden = true;
}

/* ─── DUPLICATES ──────────────────────────────────────────────── */
/* Names compared the way a person would: case, spaces and punctuation ignored. */
function qcKey(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

/* The words of a name, lower case, punctuation gone: "Samancor Chrome — Middelburg" is
   " samancor chrome middelburg ". The spaces at each end are what let a whole run of
   words be found inside it, and never half of one ("rain" is not inside "rainbow"). */
function qcWords(s) { return ' ' + String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' '; }

/* Is this name one already on file? `exact` is the same name; `near` are names that contain
   it, or sit inside it, as whole words ("Samancor Chrome" against "Samancor Chrome —
   Middelburg"): at most three, and never from anything under four letters, which would
   match almost any name. */
function findOfftakerDupes(name, records) {
  const key = qcKey(name);
  if (!key) return { exact: null, near: [] };
  const exact = records.find(r => qcKey(r.name) === key) || null;
  const typed = qcWords(name);
  const near = key.length < 4 ? [] : records.filter(r => {
    if (r === exact) return false;
    return [r.name, r.short].some(n => qcKey(n).length >= 4 && (qcWords(n).includes(typed) || typed.includes(qcWords(n))));
  }).sort((a, b) => Math.abs(qcKey(a.name).length - key.length) - Math.abs(qcKey(b.name).length - key.length)).slice(0, 3);
  return { exact, near };
}

/* The same person, two ways: the same name at the same company, or the same email anywhere.
   The contact being edited is never a duplicate of itself. */
function findContactDupes(c, contacts) {
  const others = contacts.filter(x => x.id !== c.id);
  const first = qcKey(c.first), last = qcKey(c.last);
  const email = String(c.email || '').trim().toLowerCase();
  return {
    sameCompany: (first || last) ? others.find(x => String(x.offtakerId || '') === String(c.offtakerId || '') &&
      qcKey(x.first) === first && qcKey(x.last) === last) || null : null,
    sameEmail: email ? others.find(x => String(x.email || '').trim().toLowerCase() === email) || null : null,
  };
}

function qcShow(id, html) {
  const el = document.getElementById(id);
  el.innerHTML = html || '';
  el.hidden = !html;
}
function qcLink(rec) {
  return '<a class="qc-link" onclick="qcOpenRecord(\'' + esc(rec.id) + '\')">' + esc(rec.name) + '</a>';
}

/* Called as the name is typed. Never changes the form. */
function qcCheckOfftaker() {
  if (state.editOfftakerId) { qcShow('mo-dupe', ''); return; }
  const records = state.offtakers.concat((state.archived || []).map(a => Object.assign({}, a, { archived: true })));
  const d = findOfftakerDupes(val('mo-name'), records);
  let html = '';
  if (d.exact) {
    html = d.exact.archived
      ? '<b>' + esc(d.exact.name) + '</b> is already in the Archive. Restore it from there instead of adding a second copy.'
      : 'Already on file: ' + qcLink(d.exact) + '. A second copy will not be saved.';
  } else if (d.near.length) {
    html = 'Possible duplicate: ' + d.near.map(r => r.archived ? esc(r.name) + ' (in the Archive)' : qcLink(r)).join(', ') + '.';
  }
  qcShow('mo-dupe', html);
}

function qcCheckContact() {
  const c = { id: state.editContactId, first: val('mc-first'), last: val('mc-last'), offtakerId: val('mc-offtaker'), email: val('mc-email') };
  const d = findContactDupes(c, state.contacts);
  const parts = [];
  if (d.sameCompany) parts.push('<b>' + esc((c.first + ' ' + c.last).trim()) + '</b> is already on file for this company. Edit that record instead.');
  if (d.sameEmail) parts.push('That email is already on file for <b>' + esc((d.sameEmail.first + ' ' + d.sameEmail.last).trim()) + '</b>.');
  qcShow('mc-dupe', parts.join(' '));
}

/* A link in a warning: leave the form and open that company. */
function qcOpenRecord(id) {
  QC_KINDS.forEach(k => closeModal(k.modal));
  nav('detail', { id });
}
