/* ═══════════════════════════════════════════════════════════════════
   Row selection on the list tables, and the export of exactly the rows picked.

   A rep ticks rows (or the header box for the page), a bar appears with the count,
   and Export selected downloads the page's own CSV columns for those rows only.
   There is nothing else to do with a selection: no bulk delete, no bulk edit.

   The selection belongs to one list showing one thing. Each list tells it what it is
   showing (`selectionSync(kind, signature)`) every time it draws; if the list or the
   signature differs from the held one, the selection is dropped. So changing the page,
   a tab, a filter, the search or the page number can never leave a row selected that
   the rep can no longer see, and a re-draw of the same page keeps it.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const SELECTION = { kind: '', sig: '', ids: new Set() };

function selectionSync(kind, sig) {
  if (SELECTION.kind !== kind || SELECTION.sig !== sig) {
    SELECTION.kind = kind; SELECTION.sig = sig; SELECTION.ids = new Set();
  }
}
function selectionHas(id) { return SELECTION.ids.has(id); }
function selectionCount() { return SELECTION.ids.size; }
function selectionClear() { SELECTION.ids = new Set(); selectionRefresh(); }

/* Ticking a box on a list the selection does not belong to starts that list afresh. */
function selectionAdopt(kind) {
  if (SELECTION.kind !== kind) { SELECTION.kind = kind; SELECTION.sig = ''; SELECTION.ids = new Set(); }
}
function selectionToggle(kind, id, on) {
  selectionAdopt(kind);
  if (on) SELECTION.ids.add(id); else SELECTION.ids.delete(id);
  selectionRefresh();
}
/* The header box acts on the rows of this page only, so rows picked elsewhere stay picked. */
function selectionTogglePage(kind, ids, on) {
  selectionAdopt(kind);
  ids.forEach(id => { if (on) SELECTION.ids.add(id); else SELECTION.ids.delete(id); });
  selectionRefresh();
}
/* 'none', 'some' or 'all' of these rows. An empty page is never "all". */
function selectionPageState(ids) {
  const n = ids.filter(id => SELECTION.ids.has(id)).length;
  return n === 0 ? 'none' : n === ids.length ? 'all' : 'some';
}

/* ─── MARKUP ──────────────────────────────────────────────────── */
function selectionBarHtml() {
  const n = SELECTION.ids.size;
  if (!n) return '';
  return '<div class="sel-bar"><span class="sel-n"><b>' + n + '</b> selected</span>' +
    '<button class="btn btn-outline btn-sm" onclick="selectionExport()">' + icon('download', 14) + ' Export selected</button>' +
    '<button class="btn btn-ghost btn-sm" onclick="selectionClear()">Clear</button></div>';
}
/* Where the bar goes, above the table. Always in the page so it can appear without a re-draw. */
function selectionSlotHtml(kind) {
  return '<div id="sel-bar" class="sel-slot" data-kind="' + esc(kind) + '">' + selectionBarHtml() + '</div>';
}
function selectionCellHtml(kind, id, label) {
  return '<td class="sel-cell" onclick="event.stopPropagation()"><input type="checkbox" class="sel-row" ' +
    'data-id="' + esc(id) + '"' + (SELECTION.ids.has(id) ? ' checked' : '') +
    ' aria-label="Select ' + esc(label) + '" onchange="selectionToggle(\'' + kind + '\', this.dataset.id, this.checked)"></td>';
}
function selectionHeadCellHtml(kind, ids) {
  return '<th class="sel-cell"><input type="checkbox" class="sel-head"' +
    (selectionPageState(ids) === 'all' ? ' checked' : '') +
    ' aria-label="Select every row on this page" onchange="selectionTogglePage(\'' + kind + '\', ' +
    esc(JSON.stringify(ids)) + ', this.checked)"></th>';
}

/* Redraw the bar and the header box after a tick, without redrawing the page. */
function selectionRefresh() {
  const slot = document.getElementById('sel-bar');
  if (slot) slot.innerHTML = selectionBarHtml();
  const head = document.querySelectorAll('input.sel-head')[0];
  if (!head) return;
  const ids = Array.from(document.querySelectorAll('input.sel-row')).map(b => b.dataset.id);
  const st = selectionPageState(ids);
  head.checked = st === 'all';
  head.indeterminate = st === 'some';
}

/* ─── EXPORT SELECTED ─────────────────────────────────────────── */
/* What each list exports: the same row builders as its own Export button, run over
   the chosen records. Selected pipeline accounts export the opportunities open on
   them, because the pipeline's Export is a list of opportunities. */
const SELECTION_SOURCES = {
  offtakers: { file: 'aee-offtakers', noun: 'off-taker', none: 'Nothing to export for that selection',
    rows: ids => offtakerCsvRows(state.offtakers.filter(o => ids.has(o.id))) },
  contacts: { file: 'aee-contacts', noun: 'contact', none: 'Nothing to export for that selection',
    rows: ids => contactCsvRows(state.contacts.filter(c => ids.has(c.id))) },
  municipalities: { file: 'aee-municipalities', noun: 'municipalit', plural: 'ies', one: 'y', none: 'Nothing to export for that selection',
    rows: ids => muniCsvRows(SA_MUNICIPALITIES.filter(m => ids.has(m.id))) },
  pipeline: { file: 'aee-pipeline', noun: 'opportunit', plural: 'ies', one: 'y', none: 'No opportunities on the selected accounts',
    rows: ids => pipelineCsvRows(state.deals.filter(d => ids.has(d.offtakerId))) },
};

function selectionExport() {
  const src = SELECTION_SOURCES[SELECTION.kind];
  if (!src || !SELECTION.ids.size) return;
  const rows = src.rows(SELECTION.ids);
  const n = rows.length - 1;
  if (n < 1) { toast(src.none); return; }
  downloadCSV(src.file + '-selected-' + todayISO() + '.csv', rows);
  toast('Exported ' + n + ' ' + src.noun + (src.plural ? (n === 1 ? src.one : src.plural) : (n === 1 ? '' : 's')));
}
