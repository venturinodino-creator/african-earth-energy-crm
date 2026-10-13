/* ═══════════════════════════════════════════════════════════════════
   Settings
   One home for the things that belong to the person and to the book rather than to
   any one page: who is signed in, how the pipeline is worked out, where the book sits
   by province, and the whole-book exports and both imports. (A page's own export stays on
   that page.) A sub-navigation on the left, one card on the right.

   It reads and shows; it does not edit. The stages, sectors and provinces are defined
   in the code, so every account and every report reads the same definition, and the
   page says so rather than leaving anyone to look for an edit button.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const SETTINGS_TABS = [
  ['account', 'Account'], ['stages', 'Pipeline stages'], ['provinces', 'Provinces'], ['data', 'Data and backup'],
];

function setSettingsTab(t) { state.settingsTab = t; renderSettings(); }

function renderSettings() {
  const tab = SETTINGS_TABS.some(([k]) => k === state.settingsTab) ? state.settingsTab : 'account';
  setPage('Settings', 'Your account, how the pipeline is worked out, and where your data lives', '');
  const nav = '<nav class="set-nav" aria-label="Settings sections">' + SETTINGS_TABS.map(([k, label]) =>
    '<button class="set-nav-item' + (k === tab ? ' active' : '') + '" onclick="setSettingsTab(\'' + k + '\')">' + esc(label) + '</button>').join('') + '</nav>';
  const body = { account: settingsAccountHtml, stages: settingsStagesHtml, provinces: settingsProvincesHtml, data: settingsDataHtml }[tab]();
  setContent('<div class="settings-layout">' + nav + '<div class="card set-card">' + body + '</div></div>');
}

function settingsHeadHtml(title, sub) {
  return '<div class="card-header"><div><div class="card-title">' + esc(title) + '</div>' +
    '<div class="card-sub">' + esc(sub) + '</div></div></div>';
}

/* ─── ACCOUNT ─────────────────────────────────────────────────── */
function settingsAccountHtml() {
  const admin = state.role === 'admin';
  return settingsHeadHtml('Account', 'Who you are signed in as') +
    factListHtml([
      ['Signed in as', esc(toDisplayName(state.email))],
      ['Access', admin ? 'Admin: can add, edit and delete records' : 'Read only: can look at everything, and change nothing'],
      ['Appearance', 'Follows your device, light or dark'],
      ['Data', 'Saved in Supabase, so the whole team sees the same records'],
    ]) +
    '<div class="set-actions"><button class="btn btn-outline" onclick="signOut()">' + icon('logout', 14) + ' Sign out</button></div>';
}

/* ─── PIPELINE STAGES ─────────────────────────────────────────── */
function settingsStagesHtml() {
  return settingsHeadHtml('Pipeline stages', 'The seven stages every account and opportunity moves through') +
    '<div class="table-wrap"><table><thead><tr><th>Stage</th><th>What it means</th><th class="num">Default probability</th>' +
    '<th>Counts as stalled after</th></tr></thead><tbody>' +
    SF_STAGES.map(s =>
      '<tr><td><b>' + esc(s.label) + '</b></td><td>' + esc(s.hint) + '</td>' +
      '<td class="num">' + esc(s.prob) + '%</td>' +
      '<td>' + (s.stallDays ? esc(s.stallDays) + ' days' : '<span style="color:var(--muted)">Never</span>') + '</td></tr>').join('') +
    '</tbody></table></div>' +
    '<p class="fg-hint set-note">The default probability is what a new opportunity starts with, and what the weighted value is worked out from. ' +
    'Stages, sectors and provinces are changed in the code (data/seed.js), not here, so every account and every report reads the same definition.</p>';
}

/* ─── PROVINCES ───────────────────────────────────────────────── */
/* Off-takers by province, counted the way every filter counts them: a company that spans two
   provinces is in both. Companies with no province are named, so the rows are never mistaken
   for the whole book. */
function settingsProvinceCounts() {
  const rows = SA_PROVINCES.map(p => {
    const inP = state.offtakers.filter(o => provincesOf(o.province).includes(p));
    const working = inP.filter(inPipeline).length;
    return { province: p, total: inP.length, leads: inP.length - working, working };
  });
  const none = state.offtakers.filter(o => !provincesOf(o.province).length).length;
  return { rows, none };
}

function openProvince(p) { setProvince(p); state.offPage = 1; nav('offtakers'); }

function settingsProvincesHtml() {
  const { rows, none } = settingsProvinceCounts();
  return settingsHeadHtml('Provinces', 'Where the book sits. Open one to see Off-taker Prospects narrowed to it') +
    '<div class="table-wrap"><table><thead><tr><th>Province</th><th class="num">Off-takers</th><th class="num">Leads</th>' +
    '<th class="num">In the pipeline</th></tr></thead><tbody>' +
    rows.map(r =>
      '<tr data-province="' + esc(r.province) + '">' +
      '<td><span class="ext-link" style="cursor:pointer" onclick="openProvince(\'' + esc(r.province) + '\')">' + esc(r.province) + '</span></td>' +
      '<td class="num">' + fmtNum(r.total) + '</td><td class="num">' + fmtNum(r.leads) + '</td><td class="num">' + fmtNum(r.working) + '</td></tr>').join('') +
    '</tbody></table></div>' +
    '<p class="fg-hint set-note">A company in two provinces is counted in both, so the rows add up to more than the book. ' +
    (none ? fmtNum(none) + ' off-taker' + (none === 1 ? ' has' : 's have') + ' no province and ' + (none === 1 ? 'is' : 'are') + ' counted above in none of them. ' : '') +
    'The province list is changed in the code, not here.</p>';
}

/* ─── DATA AND BACKUP ─────────────────────────────────────────── */
/* The whole-book exports and both imports, in one place. The sidebar keeps the ones it always had, and a
   page's own export (Analytics' summary, Export selected on a table) stays on that page. */
function settingsDataHtml() {
  const exp = [
    ['Off-takers', state.offtakers.length, 'exportOfftakers()', 'Every company on file, with load, fit and contacts'],
    ['Contacts', state.contacts.length, 'exportContacts()', 'Everyone, with their company and role'],
    ['Opportunities', state.deals.length, 'exportPipeline()', 'Every opportunity, with its stage and value'],
    ['Municipalities', SA_MUNICIPALITIES.length, 'exportMunicipalities()', 'The reference list, with who is on file'],
    ['News', allNews().length, 'exportNews()', 'The stories on the News page'],
  ];
  const imp = [
    ['Contacts', "openImport('contacts')", 'A CSV of people; each needs a work email'],
    ['Off-takers', "openImport('offtakers')", 'A CSV of companies, with sector and province'],
  ];
  return settingsHeadHtml('Data and backup', 'Everything is saved in Supabase. These files are for backup and for sharing') +
    '<div class="section-title" style="margin-top:6px">Export</div>' +
    exp.map(([label, n, call, what]) =>
      '<div class="set-row"><div class="set-row-text"><b>' + esc(label) + '</b> <span class="set-n">' + fmtNum(n) + '</span>' +
      '<div class="fg-hint">' + esc(what) + '</div></div>' +
      '<button class="btn btn-outline btn-sm" onclick="' + call + '">' + icon('download', 14) + ' Export</button></div>').join('') +
    '<div class="section-title">Import</div>' +
    imp.map(([label, call, what]) =>
      '<div class="set-row"><div class="set-row-text"><b>' + esc(label) + '</b>' +
      '<div class="fg-hint">' + esc(what) + '</div></div>' +
      '<button class="btn btn-outline btn-sm" data-admin-only onclick="' + call + '">' + icon('upload', 14) + ' Import CSV</button></div>').join('') +
    '<p class="fg-hint set-note">Importing is for admins. A page\'s own Export downloads what its filters show; the files here are the whole book.</p>';
}
