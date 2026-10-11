/* ═══════════════════════════════════════════════════════════════════
   Import wizard
   Four steps on a page of their own: Upload, Map columns, Review, Import. Nothing is
   written until the person presses Import on the last step, so leaving at any step, or
   picking the wrong file, costs nothing.

   The page holds the file in memory (state.imp) and asks import-rules.js what each step
   should say. The rules are there, not here: this file reads a file, draws the steps and,
   at the end, stores what Review promised.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const IMPORT_STEPS = ['Upload', 'Map columns', 'Review', 'Import'];

/* What a person needs to know before choosing a file, kind by kind. Plain text, escaped when drawn. */
const IMPORT_NOTES = {
  contacts: [
    'Company matches an off-taker by name, or a municipality by name, id (mun_MP312) or code (MP312). Where a municipality name is not unique ' +
      '(there are two Emalahlenis) the province column settles it; if it still fits more than one, the row is held back.',
    'A work email is required. A row without one is held back: add the address to the file and import again.',
  ],
  offtakers: [
    'Sector accepts either the id (mining) or the full name (Mining & Minerals (Producer)).',
    'Province accepts abbreviations (WC, KZN, Limpopo) and is what places the record on the map.',
    'Load figures can wait. A company with no GWh sits at the bottom of the list until someone adds them.',
  ],
};

/* ─── STATE AND ENTRY ─────────────────────────────────────────── */
function importFresh(kind) {
  return { kind: importKind(kind), step: 1, fileName: '', table: null, mapping: [], error: '', result: null, busy: false };
}
function importState() {
  if (!state.imp) state.imp = importFresh('contacts');
  return state.imp;
}

/* Every Import button, sidebar link and Settings row calls this. A fresh wizard each time, so
   a file chosen earlier is never carried into the next import. */
function openImport(kind) {
  if (state.role !== 'admin') { toast('Read-only access — ask an admin to import', 'warn'); return; }
  state.imp = importFresh(kind);
  nav('import');
}

/* The choice at the top of step one. It drops any file already chosen, since the file was
   read for the other kind. */
function setImportKind(kind) {
  state.imp = importFresh(kind);
  renderImport();
}

/* The wrong-file way out: the file stays, and is read again as the other kind. */
function importUseKind(kind) {
  const s = importState();
  if (!s.table) return setImportKind(kind);
  s.kind = importKind(kind);
  s.mapping = importAutoMap(s.kind, s.table[0]);
  s.step = 2;
  renderImport();
}

function cancelImport() {
  const kind = importState().kind;
  state.imp = null;
  nav(IMPORT_KINDS[kind].view);
}

function importMore() { openImport(importState().kind); }

/* ─── READING THE FILE ────────────────────────────────────────── */
function importFileChosen(input) {
  const file = input.files && input.files[0];
  if (file) importReadFile(file);
}
function importFileDropped(ev) {
  ev.preventDefault();
  const file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
  if (file) importReadFile(file);
}
function importReadFile(file) {
  const reader = new FileReader();
  reader.onload = () => importLoadText(String(reader.result), file.name);
  reader.onerror = () => { const s = importState(); s.error = 'That file could not be read.'; renderImport(); };
  reader.readAsText(file);
}

/* The file's text arrives: parse it, recognise the headers and go to Map columns. A file
   with no data rows stays on Upload and says so. */
function importLoadText(text, name) {
  const s = importState();
  const table = parseCSV(text);
  s.fileName = name || '';
  s.result = null;
  if (table.length < 2) {
    s.table = null; s.mapping = []; s.step = 1; s.error = 'That file has no data rows.';
  } else {
    s.table = table; s.mapping = importAutoMap(s.kind, table[0]); s.step = 2; s.error = '';
  }
  renderImport();
}

/* ─── MOVING BETWEEN STEPS ────────────────────────────────────── */
function importProblemFor(s) { return s.table ? importProblem(s.kind, s.table[0], s.mapping) : null; }
function importPlanFor(s) { return importPlan(s.kind, s.table, s.mapping, { offtakers: state.offtakers, contacts: state.contacts }); }

function setImportMap(col, key) {
  const s = importState();
  if (!s.table || s.step !== 2) return;
  s.mapping = importRemap(s.kind, s.mapping, col, key);
  renderImport();
  const el = document.getElementById('imp-map-' + col);
  if (el) el.focus();
}

/* Back to a step already passed. Forward only by Continue, which checks the mapping, and
   step four only by Import. */
function goImportStep(n) {
  const s = importState();
  if (s.step === 4 || n >= s.step || n < 1) return;
  if (n > 1 && !s.table) return;
  s.step = n;
  window.scrollTo({ top: 0 });
  renderImport();
}
function importContinue() {
  const s = importState();
  if (!s.table || importProblemFor(s)) return;
  s.step = 3;
  window.scrollTo({ top: 0 });
  renderImport();
}

/* ─── IMPORT ──────────────────────────────────────────────────── */
/* The one place the wizard writes. The rows are judged again against the book as it stands
   now, so a record added since Review is not added twice. */
async function runImportNow() {
  const s = importState();
  if (state.role !== 'admin') { toast('Read-only access — ask an admin to import', 'warn'); return; }
  if (s.busy || !s.table || s.step !== 3 || importProblemFor(s)) return;
  const plan = importPlanFor(s);
  const going = plan.rows.filter(r => r.status === 'import');
  if (!going.length) return;
  s.busy = true;

  const made = going.map(r => s.kind === 'offtakers'
    ? Object.assign({ id: uid('o') }, importOfftakerRecord(r.draft))
    : Object.assign({ id: uid('c') }, importContactRecord(r.draft)));
  const book = s.kind === 'offtakers' ? state.offtakers : state.contacts;
  made.forEach(rec => book.push(rec));
  save();
  updateNavBadges();

  const held = plan.counts.total - plan.counts.importing;
  s.result = { kind: s.kind, added: made.length, held: plan.counts.held, heldTotal: held, saving: true, failed: 0 };
  s.step = 4; s.busy = false;
  toast('Imported ' + made.length + ' new ' + (made.length === 1 ? IMPORT_KINDS[s.kind].noun : IMPORT_KINDS[s.kind].nouns) +
    (held ? ' · ' + held + ' held back' : ''));
  window.scrollTo({ top: 0 });
  renderImport();

  /* save() is the local cache only; each record is also sent to the server. A send the
     server refuses toasts from guardWrite and the record stays in this browser. Contacts go
     one at a time and off-takers together, as each importer always did. */
  let failed = 0;
  if (s.kind === 'offtakers') {
    await Promise.all(made.map(rec => pushOfftaker(rec).catch(() => { failed++; })));
  } else {
    for (const rec of made) {
      try { await pushContact(rec); } catch (e) { failed++; }
    }
  }
  if (s.result) { s.result.saving = false; s.result.failed = failed; }
  if (failed) toast(failed + ' of ' + made.length + ' saved locally only — they will need a re-sync', 'warn');
  if (state.view === 'import' && state.imp === s) renderImport();
}

/* ─── RENDER ──────────────────────────────────────────────────── */
function renderImport() {
  if (state.role !== 'admin') {
    setPage('Import CSV', 'Read only', '');
    setContent('<div class="card"><div class="empty"><div class="ei">' + icon('lock', 30) + '</div><h3>Importing is for admins</h3>' +
      '<p>Your account can look at everything and change nothing. Ask an admin to import this file.</p></div></div>');
    return;
  }
  const s = importState();
  if (s.step > 1 && !s.table) s.step = 1;
  if (s.step === 3 && importProblemFor(s)) s.step = 2;
  const k = IMPORT_KINDS[s.kind];
  setPage('Import ' + k.nouns, 'Bring a CSV of ' + k.nouns + ' into the book in four steps', '');
  const body = { 1: importUploadHtml, 2: importMapHtml, 3: importReviewHtml, 4: importDoneHtml }[s.step](s);
  setContent('<div class="wiz">' + importStepsHtml(s) + '<div class="card wiz-card">' + body + '</div></div>');
}

function importStepsHtml(s) {
  return '<ol class="wiz-steps" aria-label="Import steps">' + IMPORT_STEPS.map((label, i) => {
    const n = i + 1, cls = n < s.step ? 'done' : n === s.step ? 'cur' : 'todo';
    const inner = '<span class="wiz-n">' + (n < s.step ? icon('check', 12) : n) + '</span><span class="wiz-l">' + esc(label) + '</span>';
    const back = n < s.step && s.step < 4;
    return '<li class="wiz-step ' + cls + '"' + (n === s.step ? ' aria-current="step"' : '') + '>' +
      (back ? '<button class="wiz-btn" onclick="goImportStep(' + n + ')" title="Go back to ' + esc(label) + '">' + inner + '</button>'
        : '<span class="wiz-btn">' + inner + '</span>') + '</li>';
  }).join('') + '</ol>';
}

function importHeadHtml(title, sub, right) {
  return '<div class="card-header"><div><div class="card-title">' + esc(title) + '</div><div class="card-sub">' + esc(sub) + '</div></div>' +
    (right || '') + '</div>';
}
function importNoticeHtml(text, extra) {
  return '<div class="wiz-warn" role="alert">' + icon('alert', 15) + '<div>' + esc(text) + (extra || '') + '</div></div>';
}

/* ─── STEP 1: UPLOAD ──────────────────────────────────────────── */
function importUploadHtml(s) {
  const k = IMPORT_KINDS[s.kind];
  const kinds = viewTabsHtml(['contacts', 'offtakers'].map(key => ({
    label: IMPORT_KINDS[key].label, active: key === s.kind, on: "setImportKind('" + key + "')",
  })));
  const recognised = k.fields.map(f => '<tr><td><b>' + esc(f.label) + '</b></td><td>' +
    f.aliases.map((a, i) => i === 0 ? '<b>' + esc(a) + '</b>' : esc(a)).join(', ') + '</td></tr>').join('');
  return importHeadHtml('Choose a file', 'A CSV with a header row. Excel, Google Sheets, LinkedIn and Apollo exports all work.') +
    '<div class="wiz-label">This file is a list of</div>' + kinds +
    (s.error ? importNoticeHtml(s.error) : '') +
    '<label class="wiz-drop" ondragover="event.preventDefault()" ondrop="importFileDropped(event)">' +
      '<input type="file" accept=".csv,text/csv" onchange="importFileChosen(this)">' +
      '<span class="wiz-drop-ic">' + icon('upload', 22) + '</span>' +
      '<span class="wiz-drop-t">Choose a CSV file</span><span class="wiz-drop-s">or drop it here</span>' +
    '</label>' +
    '<div class="wiz-label">Columns it recognises</div>' +
    '<div class="table-wrap wiz-recog"><table><thead><tr><th>CRM field</th><th>Header names that match it</th></tr></thead><tbody>' + recognised + '</tbody></table></div>' +
    '<ul class="wiz-notes">' + IMPORT_NOTES[s.kind].map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' +
    '<div class="wiz-foot"><button class="btn btn-ghost btn-sm" onclick="cancelImport()">Cancel</button></div>';
}

/* ─── STEP 2: MAP COLUMNS ─────────────────────────────────────── */
function importMapHtml(s) {
  const k = IMPORT_KINDS[s.kind];
  const headers = s.table[0];
  const problem = importProblemFor(s);
  const matched = s.mapping.filter(Boolean).length;
  const options = key => '<option value="">Don\'t import</option>' + k.fields.map(f =>
    '<option value="' + f.key + '"' + (f.key === key ? ' selected' : '') + '>' + esc(f.label) + '</option>').join('');
  const rows = headers.map((h, i) => {
    const key = s.mapping[i] || '';
    const samples = importSamples(s.table, i, 3).map(v => esc(v.length > 30 ? v.slice(0, 29) + '…' : v));
    return '<div class="imp-row' + (key ? '' : ' skip') + '">' +
      '<div class="imp-col"><b>' + esc(String(h).trim() || '(no header)') + '</b><span class="imp-n">column ' + (i + 1) + '</span></div>' +
      '<div class="imp-samples">' + (samples.length ? samples.join('<i>·</i>') : '<span class="imp-none">no values</span>') + '</div>' +
      '<div class="imp-field"><select id="imp-map-' + i + '" onchange="setImportMap(' + i + ',this.value)" aria-label="CRM field for column ' + (i + 1) + '">' + options(key) + '</select></div>' +
      '<div class="imp-state">' + (key ? '<span class="badge b-contracted">Matched</span>' : '<span class="badge b-low">Skip</span>') + '</div>' +
    '</div>';
  }).join('');
  const unused = k.fields.filter(f => s.mapping.indexOf(f.key) < 0).map(f => f.label);
  const switchTo = s.kind === 'offtakers' ? 'contacts' : 'offtakers';
  const way = problem && (problem.code === 'contacts-file' || problem.code === 'no-person')
    ? ' <button class="btn btn-outline btn-xs" onclick="importUseKind(\'' + switchTo + '\')">Import it as ' + IMPORT_KINDS[switchTo].nouns + '</button>' : '';
  return importHeadHtml('Match your columns', s.fileName + ' · ' + (s.table.length - 1) + ' rows · ' + headers.length + ' columns',
      '<span class="badge b-contracted">' + matched + ' matched</span>') +
    (problem ? importNoticeHtml(problem.text, way) : '') +
    '<div class="imp-list"><div class="imp-row imp-head" aria-hidden="true"><div>Column in your file</div><div>Sample values</div><div>CRM field</div><div></div></div>' + rows + '</div>' +
    (unused.length ? '<p class="wiz-unused">No column for: ' + esc(unused.join(', ')) + '.</p>' : '') +
    '<div class="wiz-foot"><button class="btn btn-ghost btn-sm" onclick="cancelImport()">Cancel</button><span class="wiz-gap"></span>' +
      '<button class="btn btn-outline btn-sm" onclick="goImportStep(1)">Back</button>' +
      '<button class="btn btn-primary btn-sm" onclick="importContinue()"' + (problem ? ' disabled' : '') + '>Continue</button></div>';
}

/* ─── STEP 3: REVIEW ──────────────────────────────────────────── */
function importRowsTableHtml(head, rows) {
  return '<div class="table-wrap"><table><thead><tr>' + head.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
    rows.join('') + '</tbody></table></div>';
}
function importWho(kind, d) { return kind === 'offtakers' ? d.name : (d.first + ' ' + d.last).trim(); }

function importMatchedHtml(d) {
  if (!d.offtakerId) return '<span class="badge b-low">unassigned</span>';
  if (isMunicipalityId(d.offtakerId)) {
    const m = MUNI_BY_ID[d.offtakerId];
    return '<span class="badge b-prospect">' + esc(m.name) + '</span> <span class="wiz-sub">municipality · ' + esc(m.code) + '</span>';
  }
  return '<span class="badge b-contracted">' + esc(getOfftaker(d.offtakerId).short || '') + '</span>';
}

function importReviewHtml(s) {
  const k = IMPORT_KINDS[s.kind];
  const plan = importPlanFor(s);
  const c = plan.counts;
  const held = c.total - c.importing;
  const noun = n => (n === 1 ? k.noun : k.nouns);
  const stats = '<div class="wiz-stats">' +
    '<div class="wiz-stat"><span class="wiz-stat-n">' + c.importing + '</span><span class="wiz-stat-l">will be imported</span></div>' +
    '<div class="wiz-stat' + (held ? ' warn' : '') + '"><span class="wiz-stat-n">' + held + '</span><span class="wiz-stat-l">held back</span></div>' +
    '<div class="wiz-stat"><span class="wiz-stat-n">' + c.total + '</span><span class="wiz-stat-l">rows read</span></div></div>';

  let lead;
  if (s.kind === 'contacts') {
    lead = c.importing
      ? c.toOfftaker + ' matched to an off-taker, ' + c.toMunicipality + ' to a municipality; ' + c.unassigned +
        ' will be filed as unassigned and can be linked later.'
      : 'Nothing in this file can be imported.';
  } else {
    lead = !c.importing ? 'Nothing in this file can be imported.'
      : c.noLoad === 1 ? '1 carries no load figure yet, so it sits at the bottom of the list until someone adds one.'
      : c.noLoad ? c.noLoad + ' carry no load figures yet, so they sit at the bottom of the list until someone adds them.' : '';
  }
  const warnings = [];
  if (s.kind === 'offtakers' && c.noSector) {
    warnings.push(c.noSector + ' row' + (c.noSector === 1 ? '' : 's') + ' had no sector that could be matched' +
      (c.noSectorExample ? ' (e.g. “' + c.noSectorExample + '”)' : '') + '. Those are filed under Mining & Minerals. Fix the sector column to place them properly.');
  }
  if (s.kind === 'offtakers' && c.badProvince) {
    warnings.push(c.badProvince + ' row' + (c.badProvince === 1 ? '' : 's') + ' had a province that could not be matched (e.g. “' + c.badProvinceExample +
      '”). Those fall back to the centre of the country, so they sit in the wrong place on the map and under Regions. Worth fixing the province column first.');
  }
  if (c.ignored) warnings.push(c.ignored + ' row' + (c.ignored === 1 ? ' has' : 's have') + ' no name and ' + (c.ignored === 1 ? 'is' : 'are') + ' ignored.');

  const heldHtml = IMPORT_REASONS[s.kind].map(reason => {
    const rows = plan.rows.filter(r => r.reason === reason.code);
    if (!rows.length) return '';
    return '<div class="wiz-group"><div class="wiz-group-h"><b>' + esc(reason.label) + '</b><span class="set-n">' + rows.length + '</span></div>' +
      importRowsTableHtml(['Line', k.noun === 'contact' ? 'Person' : 'Company', 'Why'], rows.slice(0, 25).map(r =>
        '<tr><td class="num">' + r.line + '</td><td>' + esc(importWho(s.kind, r.draft)) + (s.kind === 'contacts' && r.draft.companyName ? ' <span class="wiz-sub">' + esc(r.draft.companyName) + '</span>' : '') +
        '</td><td class="wiz-why">' + esc(r.detail) + '</td></tr>')) +
      (rows.length > 25 ? '<div class="wiz-more">and ' + (rows.length - 25) + ' more</div>' : '') + '</div>';
  }).join('');

  const going = plan.rows.filter(r => r.status === 'import');
  const sample = s.kind === 'contacts'
    ? importRowsTableHtml(['Name', 'Title', 'Company', 'Email', 'Matched'], going.slice(0, 8).map(r => '<tr><td>' + esc(importWho('contacts', r.draft)) + '</td><td>' + esc(r.draft.title) +
        '</td><td>' + esc(r.draft.companyName) + '</td><td>' + esc(r.draft.email) + '</td><td>' + importMatchedHtml(r.draft) + '</td></tr>'))
    : importRowsTableHtml(['Company', 'Sector', 'Province', 'GWh/yr'], going.slice(0, 10).map(r => '<tr><td>' + esc(r.draft.name) + '</td><td>' +
        (r.draft.sector ? sectorBadge(r.draft.sector) : '<span class="badge b-low">unmatched</span>') + '</td><td>' + esc(r.draft.province || '—') +
        '</td><td class="num">' + (r.draft.annualGwh || '—') + '</td></tr>'));

  return importHeadHtml('Review', s.fileName + ' · nothing is saved until you press Import') + stats +
    (lead ? '<p class="wiz-lead">' + esc(lead) + '</p>' : '') +
    warnings.map(w => '<div class="wiz-warn">' + icon('alert', 15) + '<div>' + esc(w) + '</div></div>').join('') +
    (c.importing ? '<div class="wiz-group"><div class="wiz-group-h"><b>Will be imported</b><span class="set-n">' + c.importing + '</span></div>' + sample +
      (going.length > (s.kind === 'contacts' ? 8 : 10) ? '<div class="wiz-more">showing the first ' + (s.kind === 'contacts' ? 8 : 10) + '</div>' : '') + '</div>' : '') +
    heldHtml +
    '<div class="wiz-foot"><button class="btn btn-ghost btn-sm" onclick="cancelImport()">Cancel</button><span class="wiz-gap"></span>' +
      '<button class="btn btn-outline btn-sm" onclick="goImportStep(2)">Back</button>' +
      '<button class="btn btn-primary btn-sm" onclick="runImportNow()"' + (c.importing ? '' : ' disabled') + '>Import ' + c.importing + ' ' + noun(c.importing) + '</button></div>';
}

/* ─── STEP 4: IMPORT ──────────────────────────────────────────── */
function importDoneHtml(s) {
  const r = s.result || { kind: s.kind, added: 0, held: {}, heldTotal: 0, saving: false, failed: 0 };
  const k = IMPORT_KINDS[r.kind];
  const lines = IMPORT_REASONS[r.kind].filter(x => r.held[x.code]).map(x => '<li>' + r.held[x.code] + ' · ' + esc(x.label.toLowerCase()) + '</li>');
  const status = r.saving ? 'Saving to the server…'
    : r.failed ? r.failed + ' of ' + r.added + ' are saved in this browser only and will need a re-sync.'
    : 'Finished saving. A record the server refused stays in this browser, and a warning says so.';
  return importHeadHtml('Import', s.fileName) +
    '<div class="wiz-done"><div class="wiz-done-ic">' + icon('check', 22) + '</div>' +
    '<h3>Imported ' + r.added + ' new ' + (r.added === 1 ? k.noun : k.nouns) + '</h3>' +
    '<p class="wiz-status' + (r.failed ? ' warn' : '') + '">' + esc(status) + '</p>' +
    (r.heldTotal ? '<p>' + r.heldTotal + ' held back:</p><ul class="wiz-held">' + lines.join('') + '</ul>' : '') + '</div>' +
    '<div class="wiz-foot"><button class="btn btn-outline btn-sm" onclick="importMore()">Import another file</button><span class="wiz-gap"></span>' +
      '<button class="btn btn-primary btn-sm" onclick="nav(\'' + k.view + '\')">View ' + esc(k.nouns) + '</button></div>';
}
