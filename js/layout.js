/* ═══════════════════════════════════════════════════════════════════
   Page-layout builders shared by every list page.

   The shell and the page header are in index.html and core.js; this file is
   the next layer down: the pieces that make a list page read the same
   wherever it is. View tabs sit above a filter bar, which sits above one
   table card whose footer says how much of the list is on screen.

   Pure string builders: they take data and return markup, and know nothing
   about any one page. Loaded after icons.js and before the views.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* The tabs above a list: saved filters, one of which is on. Each tab is
   { label, count?, active, on } where `on` is the onclick expression. Changing
   tab changes which rows show, never which columns exist. */
function viewTabsHtml(tabs) {
  return '<div class="view-tabs" role="tablist">' + tabs.map(t =>
    '<button class="view-tab' + (t.active ? ' active' : '') + '" role="tab" aria-selected="' + (t.active ? 'true' : 'false') + '" ' +
    'onclick="' + t.on + '">' + esc(t.label) +
    (t.count != null ? ' <span class="vt-n">' + esc(t.count) + '</span>' : '') + '</button>').join('') + '</div>';
}

/* The strip under a table or grid: how much is on screen, and the pager when
   there is more than one page. { from, to, total, all, noun, page, pages, prev, next }
   - `standalone` draws it on its own (under a grid) rather than inside a table card.
   - `total` is what the filters leave; `all` is the whole book, shown only when
   the filters have hidden some of it, so a short list never looks like a short book. */
function tableFooterHtml(o) {
  const noun = o.noun || 'rows';
  const hidden = o.all != null && o.all > o.total;
  const range = o.total === 0 ? 'Showing 0' : 'Showing ' + (o.from === o.to ? o.from : o.from + '–' + o.to) + ' of ' + o.total;
  const pager = o.pages > 1
    ? '<div class="pager">' +
        '<button class="pg-btn" ' + (o.page <= 1 ? 'disabled ' : '') + 'onclick="' + o.prev + '">‹ Prev</button>' +
        '<span class="pg-info">' + o.page + ' / ' + o.pages + '</span>' +
        '<button class="pg-btn" ' + (o.page >= o.pages ? 'disabled ' : '') + 'onclick="' + o.next + '">Next ›</button>' +
      '</div>'
    : '';
  return '<div class="table-foot' + (o.standalone ? ' standalone' : '') + '"><span>' + range + ' ' + esc(noun) +
    (hidden ? ' <span class="tf-note">· filters hide ' + (o.all - o.total) + ' of ' + o.all + '</span>' : '') + '</span>' + pager + '</div>';
}

/* One card around a table and its footer. The table builders keep returning
   their own scroll wrapper, so a wide table scrolls inside the card. */
function tableCardHtml(tableHtml, footerHtml) {
  return '<div class="table-card">' + tableHtml + (footerHtml || '') + '</div>';
}

/* The card that opens a record page: an icon, the name, chips for what state it
   is in, one quiet line of description, and the actions that can be taken on it.
   The account page, a site, a sector and a municipality all open with this one,
   so every record page starts the same way. The page header above it keeps only
   the breadcrumb (see setPage's `record` option). Arguments are ready-made
   markup, except `desc`, which is plain text. */
function recordCardHtml(iconHtml, name, chipsHtml, desc, actionsHtml) {
  return '<div class="record-head">' +
    '<div class="rh-icon">' + iconHtml + '</div>' +
    '<div class="rh-text">' +
      '<h3 class="rh-title">' + esc(name) + '</h3>' +
      '<div class="rh-chips">' + (chipsHtml || '') + '</div>' +
      (desc ? '<p class="rh-desc">' + esc(desc) + '</p>' : '') +
    '</div>' +
    '<div class="rh-actions">' + (actionsHtml || '') + '</div>' +
  '</div>';
}

/* A fact list for the About card on a record page: [label, value, highlight?]
   rows, values already escaped. */
function factListHtml(rows) {
  return '<dl class="kv rec-kv">' + rows.map(([label, value, hl]) =>
    '<dt>' + esc(label) + '</dt><dd' + (hl ? ' class="hl"' : '') + '>' + value + '</dd>').join('') + '</dl>';
}
