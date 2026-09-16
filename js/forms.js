/* ═══════════════════════════════════════════════════════════════════
   Create / edit / delete for offtakers, contacts, opportunities and
   activity log entries. Each opener fills the modal, each saver writes
   back to state, persists and re-renders the current view.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

function val(id) { return document.getElementById(id).value.trim(); }
function setVal(id, v) { document.getElementById(id).value = v == null ? '' : v; }

/* ─── OFFTAKER ────────────────────────────────────────────────── */
function openAddOfftaker() {
  state.editOfftakerId = null;
  document.getElementById('mo-title').textContent = 'Add offtaker';
  ['mo-name', 'mo-short', 'mo-city', 'mo-website', 'mo-desc', 'mo-nmd', 'mo-revisit'].forEach(id => setVal(id, ''));
  document.getElementById('mo-sector').innerHTML = sectorOptions('');
  setVal('mo-sector', 'automotive-manufacturing');
  setVal('mo-province', 'Gauteng');
  setVal('mo-gwh', '');
  setVal('mo-peak', '');
  setVal('mo-tariff', DEFAULT_CURRENT_TARIFF.toFixed(2));
  setVal('mo-supply', 'eskom');
  setVal('mo-wheeling', 'unknown');
  setVal('mo-status', 'prospect');
  setVal('mo-priority', 'medium');
  openModal('modal-offtaker');
}

function openEditOfftaker(id) {
  const o = getOfftaker(id);
  if (!o.id) return;
  state.editOfftakerId = id;
  document.getElementById('mo-title').textContent = 'Edit ' + (o.short || o.name);
  document.getElementById('mo-sector').innerHTML = sectorOptions(o.sector);
  setVal('mo-name', o.name); setVal('mo-short', o.short); setVal('mo-sector', o.sector);
  setVal('mo-province', o.province); setVal('mo-city', o.city); setVal('mo-website', o.website);
  setVal('mo-gwh', o.annualGwh); setVal('mo-peak', o.peakMw); setVal('mo-tariff', o.tariff);
  setVal('mo-supply', o.supply); setVal('mo-wheeling', o.wheeling); setVal('mo-nmd', o.nmd);
  setVal('mo-status', o.status); setVal('mo-priority', o.priority); setVal('mo-desc', o.description);
  setVal('mo-revisit', o.revisitDate || '');
  openModal('modal-offtaker');
}

function saveOfftaker() {
  const name = val('mo-name');
  if (!name) { toast('An offtaker needs a name', 'warn'); return; }
  const rec = {
    name, short: val('mo-short'), sector: val('mo-sector'), province: val('mo-province'),
    city: val('mo-city'), website: val('mo-website'),
    annualGwh: num(val('mo-gwh')), peakMw: num(val('mo-peak')), tariff: num(val('mo-tariff')),
    supply: val('mo-supply'), wheeling: val('mo-wheeling'), nmd: num(val('mo-nmd')),
    status: val('mo-status'), priority: val('mo-priority'), description: val('mo-desc'),
    revisitDate: val('mo-revisit'),
  };
  let saved;
  if (state.editOfftakerId) {
    const i = state.offtakers.findIndex(o => o.id === state.editOfftakerId);
    /* Keep the estimated flag and any coordinates already on the record. */
    saved = state.offtakers[i] = { ...state.offtakers[i], ...rec };
  } else {
    saved = { id: uid('off'), estimated: true, ...rec };
    state.offtakers.push(saved);
  }
  save();
  pushOfftaker(saved);
  closeModal('modal-offtaker');
  toast(state.editOfftakerId ? 'Offtaker updated' : 'Offtaker added');
  state.editOfftakerId = null;
  render();
}

/* ─── CONTACT ─────────────────────────────────────────────────── */
function offtakerOptions(selected) {
  return '<option value="">— unassigned —</option>' +
    state.offtakers.map(o => '<option value="' + esc(o.id) + '"' + (o.id === selected ? ' selected' : '') + '>' +
      esc(o.short || o.name) + '</option>').join('');
}

/* Offtakers and prospects in one list. A prospect is prefixed so the two
   id spaces cannot collide, and so a saver knows which column to write. */
function accountOptions(selected) {
  const offs = state.offtakers.map(o =>
    '<option value="' + esc(o.id) + '"' + (o.id === selected ? ' selected' : '') + '>' +
    esc(o.short || o.name) + '</option>').join('');
  const pros = state.prospects.filter(p => p.status !== 'promoted').map(p =>
    '<option value="p:' + esc(p.id) + '"' + ('p:' + p.id === selected ? ' selected' : '') + '>' +
    esc(p.name) + '</option>').join('');
  return '<option value="">— pick an account —</option>' +
    (offs ? '<optgroup label="Offtakers">' + offs + '</optgroup>' : '') +
    (pros ? '<optgroup label="Prospects (leads)">' + pros + '</optgroup>' : '');
}
function accountKey(offtakerId, prospectId) {
  return prospectId ? 'p:' + prospectId : (offtakerId || '');
}
function parseAccountKey(v) {
  const s = String(v || '');
  return s.startsWith('p:')
    ? { offtakerId: '', prospectId: s.slice(2) }
    : { offtakerId: s, prospectId: '' };
}

function openAddContact(offtakerId) {
  state.editContactId = null;
  document.getElementById('mc-title').textContent = 'Add contact';
  ['mc-first', 'mc-last', 'mc-jobtitle', 'mc-dept', 'mc-email', 'mc-phone', 'mc-linkedin', 'mc-notes'].forEach(id => setVal(id, ''));
  document.getElementById('mc-offtaker').innerHTML = offtakerOptions(offtakerId || '');
  setVal('mc-role', 'influencer');
  setVal('mc-priority', 'medium');
  setVal('mc-status', 'active');
  openModal('modal-contact');
}

function openEditContact(id) {
  const c = state.contacts.find(x => x.id === id);
  if (!c) return;
  state.editContactId = id;
  document.getElementById('mc-title').textContent = 'Edit ' + c.first + ' ' + c.last;
  document.getElementById('mc-offtaker').innerHTML = offtakerOptions(c.offtakerId);
  setVal('mc-first', c.first); setVal('mc-last', c.last); setVal('mc-jobtitle', c.title);
  setVal('mc-dept', c.dept); setVal('mc-email', c.email); setVal('mc-phone', c.phone);
  setVal('mc-linkedin', c.linkedin); setVal('mc-role', c.role);
  setVal('mc-priority', c.priority); setVal('mc-status', c.status); setVal('mc-notes', c.notes);
  openModal('modal-contact');
}

function saveContact() {
  const first = val('mc-first'), last = val('mc-last');
  if (!first && !last) { toast('A contact needs a name', 'warn'); return; }
  const rec = {
    offtakerId: val('mc-offtaker'), first, last, title: val('mc-jobtitle'), dept: val('mc-dept'),
    email: val('mc-email'), phone: val('mc-phone'), linkedin: val('mc-linkedin'),
    role: val('mc-role'), priority: val('mc-priority'), status: val('mc-status'), notes: val('mc-notes'),
  };
  let saved;
  if (state.editContactId) {
    const i = state.contacts.findIndex(c => c.id === state.editContactId);
    saved = state.contacts[i] = { ...state.contacts[i], ...rec };
  } else {
    saved = { id: uid('c'), ...rec };
    state.contacts.push(saved);
  }
  save();
  pushContact(saved);
  closeModal('modal-contact');
  toast(state.editContactId ? 'Contact updated' : 'Contact added');
  state.editContactId = null;
  render();
}

/* ─── OPPORTUNITY ─────────────────────────────────────────────── */
function projectOptions(selected) {
  return '<option value="">— no site assigned —</option>' +
    state.projects.filter(p => p.status !== 'pipeline').map(p =>
      '<option value="' + esc(p.id) + '"' + (p.id === selected ? ' selected' : '') + '>' +
      esc(p.town) + ' — ' + fmtNum(p.mw) + ' MW</option>').join('');
}

function openAddDeal(offtakerId, prospectId) {
  state.editDealId = null;
  document.getElementById('md-title').textContent = 'New opportunity';
  document.getElementById('md-offtaker').innerHTML = accountOptions(accountKey(offtakerId, prospectId));
  const o = offtakerId ? getOfftaker(offtakerId) : {};
  const p = prospectId ? getProspect(prospectId) : null;
  /* A prospect has no verified load and was filed against a site by hand,
     so that site is the sensible default rather than the nearest one to a
     coordinate nobody has confirmed. */
  const np = o.id ? nearestProject(o) : null;
  const siteId = np ? np.project.id : (p && p.nearSite) || '';
  document.getElementById('md-project').innerHTML = projectOptions(siteId);
  const peak = o.id ? num(o.peakMw) : (p ? num(p.peakMwEst) : 0);
  setVal('md-mw', peak ? Math.round(peak * 0.35) : 20);
  setVal('md-tariff', DEFAULT_PPA_TARIFF.toFixed(2));
  setVal('md-tenor', 20);
  setVal('md-stage', 'identified');
  setVal('md-probability', 10);
  setVal('md-close', '');
  setVal('md-notes', '');
  document.getElementById('md-delete').style.display = 'none';
  openModal('modal-deal');
  updateDealPreview();
}

function openEditDeal(id) {
  const d = state.deals.find(x => x.id === id);
  if (!d) return;
  state.editDealId = id;
  document.getElementById('md-title').textContent = 'Edit opportunity';
  document.getElementById('md-offtaker').innerHTML = accountOptions(accountKey(d.offtakerId, d.prospectId));
  document.getElementById('md-project').innerHTML = projectOptions(d.projectId);
  setVal('md-mw', d.mw); setVal('md-tariff', d.tariff); setVal('md-tenor', d.tenor);
  setVal('md-stage', d.stage); setVal('md-probability', d.probability);
  setVal('md-close', d.closeDate); setVal('md-notes', d.notes);
  document.getElementById('md-delete').style.display = '';
  openModal('modal-deal');
  updateDealPreview();
}

function updateDealPreview() {
  const d = {
    mw: num(val('md-mw')), tariff: num(val('md-tariff')),
    tenor: num(val('md-tenor')), probability: num(val('md-probability')),
  };
  const projectId = val('md-project');
  const p = getProject(projectId);
  const committed = state.deals
    .filter(x => x.projectId === projectId && x.id !== state.editDealId && x.stage !== 'lost')
    .reduce((s, x) => s + num(x.mw), 0);
  const over = p.id && (committed + d.mw) > num(p.mw);
  document.getElementById('md-preview').innerHTML =
    '<div style="display:flex;gap:16px;flex-wrap:wrap">' +
      '<div><div class="dh-metric-v">' + fmtR(dealAnnualValue(d)) + '</div><div class="dh-metric-l">Annual value</div></div>' +
      '<div><div class="dh-metric-v">' + fmtR(dealLifetimeValue(d)) + '</div><div class="dh-metric-l">Contract life</div></div>' +
      '<div><div class="dh-metric-v">' + fmtR(weightedValue(d)) + '</div><div class="dh-metric-l">Weighted</div></div>' +
      '<div><div class="dh-metric-v">' + fmtNum(num(d.mw) * 8760 * CAPACITY_FACTOR / 1000, 1) + ' GWh</div><div class="dh-metric-l">Annual volume</div></div>' +
    '</div>' +
    (over ? '<div style="margin-top:9px;font-size:11px;color:var(--warn);display:flex;gap:6px;align-items:center">' +
      icon('alert', 13) + ' This would oversubscribe ' + esc(p.town) + ' — ' + fmtNum(committed + d.mw) + ' MW committed against ' + fmtNum(p.mw) + ' MW.</div>' : '');
}

function saveDeal() {
  const acc = parseAccountKey(val('md-offtaker'));
  if (!acc.offtakerId && !acc.prospectId) { toast('Pick an account for this opportunity', 'warn'); return; }
  const account = acc.prospectId
    ? (getProspect(acc.prospectId) || {}).name
    : (getOfftaker(acc.offtakerId).short || getOfftaker(acc.offtakerId).name);
  const rec = {
    offtakerId: acc.offtakerId, prospectId: acc.prospectId,
    projectId: val('md-project'), mw: num(val('md-mw')),
    tariff: num(val('md-tariff')), tenor: num(val('md-tenor')), stage: val('md-stage'),
    probability: num(val('md-probability')), closeDate: val('md-close'), notes: val('md-notes'),
    name: (account || 'Opportunity') + ' — ' + fmtNum(num(val('md-mw'))) + ' MW PPA',
  };
  let saved;
  if (state.editDealId) {
    const i = state.deals.findIndex(d => d.id === state.editDealId);
    saved = state.deals[i] = { ...state.deals[i], ...rec };
  } else {
    saved = { id: uid('deal'), createdAt: todayISO(), ...rec };
    state.deals.push(saved);
  }
  save();
  pushDeal(saved);
  closeModal('modal-deal');
  toast(state.editDealId ? 'Opportunity updated' : 'Opportunity created');
  state.editDealId = null;
  render();
}

function deleteDeal() {
  if (!state.editDealId) return;
  if (!confirm('Delete this opportunity?')) return;
  removeRow('aee_deals', state.editDealId);
  state.deals = state.deals.filter(d => d.id !== state.editDealId);
  save();
  closeModal('modal-deal');
  state.editDealId = null;
  toast('Opportunity deleted');
  render();
}

/* ─── ACTIVITY LOG ────────────────────────────────────────────── */
function openLogInteraction(offtakerId, prospectId) {
  const here = state.view === 'prospect' ? 'p:' + state.detailId : state.detailId;
  document.getElementById('mi-offtaker').innerHTML =
    accountOptions(accountKey(offtakerId, prospectId) || here || '');
  setVal('mi-date', todayISO());
  setVal('mi-type', 'call');
  setVal('mi-summary', '');
  openModal('modal-interaction');
  setTimeout(() => document.getElementById('mi-summary').focus(), 60);
}

function saveInteraction() {
  const acc = parseAccountKey(val('mi-offtaker'));
  const summary = val('mi-summary');
  if (!acc.offtakerId && !acc.prospectId) { toast('Pick an account', 'warn'); return; }
  if (!summary) { toast('Write a one-line summary — future you will need it', 'warn'); return; }
  const entry = {
    id: uid('int'), offtakerId: acc.offtakerId, prospectId: acc.prospectId,
    date: val('mi-date') || todayISO(), type: val('mi-type'), summary,
  };
  state.interactions.push(entry);
  pushInteraction(entry);
  /* Logging the first real contact nudges a cold account forward, so the
     record stops lying about where it stands. */
  const o = state.offtakers.find(x => x.id === acc.offtakerId);
  if (o && o.status === 'prospect') {
    o.status = 'engaged'; o.sfStage = 'needs-analysis'; pushOfftaker(o);
  }
  const lead = acc.prospectId ? getProspect(acc.prospectId) : null;
  if (lead && lead.status === 'new') { lead.status = 'researching'; pushProspect(lead); }
  save();
  closeModal('modal-interaction');
  toast('Activity logged');
  render();
}

function deleteInteraction(id) {
  if (!confirm('Delete this log entry?')) return;
  removeRow('aee_interactions', id);
  state.interactions = state.interactions.filter(i => i.id !== id);
  save();
  toast('Entry deleted');
  render();
}

/* ─── DELETE ──────────────────────────────────────────────────── */
function confirmDelete(kind, id) {
  const name = kind === 'offtaker'
    ? (getOfftaker(id).name || 'this offtaker')
    : kind === 'prospect'
    ? ((getProspect(id) || {}).name || 'this prospect')
    : (() => { const c = state.contacts.find(x => x.id === id); return c ? c.first + ' ' + c.last : 'this contact'; })();

  /* Say what else goes with it. A prospect that was already converted
     keeps its offtaker — deleting the lead row must not read as deleting
     the account somebody is now working. */
  let extra = '';
  if (kind === 'offtaker') {
    extra = '\n\nIts contacts, opportunities and activity log will be deleted too.';
  } else if (kind === 'prospect') {
    const p = getProspect(id) || {};
    const kids = dealsForProspect(id).length + interactionsForProspect(id).length;
    if (kids) extra = '\n\nIts ' + kids +
      (kids === 1 ? ' opportunity or log entry' : ' opportunities and log entries') + ' will be deleted too.';
    if (p.promotedTo) extra += '\n\nThe offtaker it was converted into is NOT deleted.';
  }
  if (!confirm('Delete ' + name + '?' + extra)) return;

  if (kind === 'offtaker') {
    /* Delete the children first: the database has no cascade on these,
       so removing the parent alone would orphan them. */
    contactsFor(id).forEach(c => removeRow('aee_contacts', c.id));
    dealsFor(id).forEach(d => removeRow('aee_deals', d.id));
    interactionsFor(id).forEach(i => removeRow('aee_interactions', i.id));
    removeRow('aee_offtakers', id);
    state.offtakers = state.offtakers.filter(o => o.id !== id);
    state.contacts = state.contacts.filter(c => c.offtakerId !== id);
    state.deals = state.deals.filter(d => d.offtakerId !== id);
    state.interactions = state.interactions.filter(i => i.offtakerId !== id);
    /* A lead that was promoted into this offtaker would otherwise keep a
       link to a record that is gone, and read as already handled. */
    state.prospects.filter(p => p.promotedTo === id).forEach(p => {
      p.promotedTo = ''; p.status = 'researching'; pushProspect(p);
    });
    /* A lead that was promoted into this offtaker would otherwise keep a
       link to a record that is gone, and read as already handled. */
    state.prospects.filter(p => p.promotedTo === id).forEach(p => {
      p.promotedTo = ''; p.status = 'researching'; pushProspect(p);
    });
    if (state.detailId === id) { save(); nav('offtakers'); toast('Offtaker deleted'); return; }
  } else if (kind === 'prospect') {
    /* No cascade in the database, so the children go first or they are
       orphaned — the same reason the offtaker branch does it. */
    dealsForProspect(id).forEach(d => removeRow('aee_deals', d.id));
    interactionsForProspect(id).forEach(i => removeRow('aee_interactions', i.id));
    removeRow('aee_prospects', id);
    state.prospects = state.prospects.filter(p => p.id !== id);
    state.deals = state.deals.filter(d => d.prospectId !== id);
    state.interactions = state.interactions.filter(i => i.prospectId !== id);
    /* Standing on the profile of the row just deleted would render an
       empty page, so step back to the list. */
    if (state.view === 'prospect' && state.detailId === id) {
      save(); nav('prospect-companies'); toast('Prospect deleted'); return;
    }
  } else {
    removeRow('aee_contacts', id);
    state.contacts = state.contacts.filter(c => c.id !== id);
  }
  save();
  toast('Deleted');
  render();
}
