/* ══════════════════════════════════════════════════════════════════
   Leads and the sales path.

   Capturing a lead, and moving an account — an offtaker or a lead — along
   the Salesforce sales process: Prospecting, Needs Analysis, Proposal,
   Negotiation, Closed. The stages themselves are SF_STAGES in data/seed.js;
   the PPA-specific deal stages on the pipeline board are separate and
   unchanged.
   ═════════════════════════════════════════════════════════════════ */
'use strict';

/* ─── LEAD / PROSPECT ─────────────────────────────
   A lead is captured here and lives in the prospect list. It carries no
   verified load, so it is never fit-scored — promoting it is what moves it
   across to an offtaker and starts it being ranked. */
const PROSPECT_FIELDS = ['mp-name', 'mp-note', 'mp-town', 'mp-website', 'mp-phone', 'mp-email',
  'mp-address', 'mp-source', 'mp-gwhlow', 'mp-gwhhigh', 'mp-peak', 'mp-method', 'mp-blurb', 'mp-notes'];

function fillProspectSelects(p) {
  document.getElementById('mp-sector').innerHTML = sectorOptions((p && p.sectorId) || '');
  document.getElementById('mp-site').innerHTML = projectOptions((p && p.nearSite) || '');
}

function openAddProspect() {
  state.editProspectId = null;
  document.getElementById('mp-title').textContent = 'Add lead';
  PROSPECT_FIELDS.forEach(id => setVal(id, ''));
  fillProspectSelects(null);
  setVal('mp-status', 'new');
  setVal('mp-province', '');
  setVal('mp-basis', 'unknown');
  document.getElementById('mp-delete').style.display = 'none';
  openModal('modal-prospect');
  setTimeout(() => document.getElementById('mp-name').focus(), 60);
}

function openEditProspect(id) {
  const p = getProspect(id);
  if (!p) return;
  state.editProspectId = id;
  document.getElementById('mp-title').textContent = 'Edit ' + p.name;
  fillProspectSelects(p);
  setVal('mp-name', p.name); setVal('mp-note', p.note); setVal('mp-town', p.town);
  setVal('mp-province', p.province); setVal('mp-website', p.website); setVal('mp-phone', p.phone);
  setVal('mp-email', p.email); setVal('mp-address', p.address); setVal('mp-source', p.contactSource);
  setVal('mp-gwhlow', p.gwhLow); setVal('mp-gwhhigh', p.gwhHigh); setVal('mp-peak', p.peakMwEst);
  setVal('mp-basis', p.loadBasis || 'unknown'); setVal('mp-method', p.loadMethod);
  setVal('mp-blurb', p.blurb); setVal('mp-notes', p.notes);
  /* A promoted lead keeps its own status — the offtaker is where the work
     happens now, and losing the link would orphan it. */
  setVal('mp-status', p.status === 'promoted' ? 'researching' : p.status);
  document.getElementById('mp-delete').style.display = '';
  openModal('modal-prospect');
}

/* A blank number field means "not established", which is not the same as
   zero — so it is stored as null rather than being coerced to 0. */
function optNum(id) {
  const v = val(id);
  return v === '' ? null : num(v);
}

function saveProspect() {
  const name = val('mp-name');
  if (!name) { toast('A lead needs a company name', 'warn'); return; }
  const rec = {
    name, sectorId: val('mp-sector'), note: val('mp-note'),
    town: val('mp-town'), province: val('mp-province'),
    website: val('mp-website'), phone: val('mp-phone'), email: val('mp-email'),
    address: val('mp-address'), contactSource: val('mp-source'), nearSite: val('mp-site'),
    gwhLow: optNum('mp-gwhlow'), gwhHigh: optNum('mp-gwhhigh'), peakMwEst: optNum('mp-peak'),
    loadBasis: val('mp-basis'), loadMethod: val('mp-method'),
    blurb: val('mp-blurb'), notes: val('mp-notes'),
  };
  let saved;
  if (state.editProspectId) {
    const i = state.prospects.findIndex(p => p.id === state.editProspectId);
    /* Coordinates and the promotion link are set elsewhere and are not on
       this form, so they are carried over rather than blanked. */
    const was = state.prospects[i];
    saved = state.prospects[i] = {
      ...was, ...rec,
      status: was.status === 'promoted' ? 'promoted' : val('mp-status'),
    };
  } else {
    saved = {
      id: 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
      status: val('mp-status'), promotedTo: '', lat: null, lng: null, ...rec,
    };
    state.prospects.push(saved);
  }
  save();
  pushProspect(saved);
  closeModal('modal-prospect');
  toast(state.editProspectId ? 'Lead updated' : 'Lead added');
  state.editProspectId = null;
  render();
}

function deleteProspect(id) {
  const target = id || state.editProspectId;
  const p = target ? getProspect(target) : null;
  if (!p) return;
  const opps = dealsForProspect(p.id);
  const logs = interactionsForProspect(p.id);
  const extra = (opps.length || logs.length)
    ? '\n\nIts ' + opps.length + ' opportunit' + (opps.length === 1 ? 'y' : 'ies') +
      ' and ' + logs.length + ' log entr' + (logs.length === 1 ? 'y' : 'ies') + ' go with it.'
    : '';
  if (!confirm('Delete ' + p.name + '?' + extra)) return;

  opps.forEach(d => removeRow('aee_deals', d.id));
  logs.forEach(i => removeRow('aee_interactions', i.id));
  removeRow('aee_prospects', p.id);
  state.deals = state.deals.filter(d => d.prospectId !== p.id);
  state.interactions = state.interactions.filter(i => i.prospectId !== p.id);
  state.prospects = state.prospects.filter(x => x.id !== p.id);
  save();
  closeModal('modal-prospect');
  state.editProspectId = null;
  toast('Lead deleted');
  if (state.view === 'prospect' && state.detailId === p.id) { nav('prospects'); return; }
  render();
}

/* ─── SALES PATH ────────────────────────────────
   Moving an offtaker along the Salesforce path. The stage is written on the
   record, the status is kept in step so every existing badge and filter
   stays truthful, and the move is logged — a stage change with no trace of
   why is how a pipeline stops being believed.

   Offtakers only. A prospect has no verified load and no sales process to
   be partway through; promoting it is what starts one. */
function setSfStage(id, stage) {
  if (state.role !== 'admin') { toast('Read-only access — ask an admin to move this', 'warn'); return; }
  const st = sfStageOf(stage);
  if (!st) return;
  const rec = state.offtakers.find(o => o.id === id);
  if (!rec) return;

  const from = sfStageLabel(rec) + (sfStageFor(rec) === 'closed' ? (sfIsClosedLost(rec) ? ' lost' : ' won') : '');
  if (sfStageFor(rec) === stage && stage !== 'closed') return;

  /* Closed is two outcomes wearing one label, and which one it was is the
     part anybody reading this later actually needs. */
  let won = true;
  if (stage === 'closed') {
    won = confirm('Closing ' + (rec.short || rec.name) + '.\n\n' +
      'OK — closed WON\nCancel — closed LOST');
  }

  rec.sfStage = stage;
  rec.status = stage === 'closed' ? (won ? 'contracted' : 'lost') : st.status;
  pushOfftaker(rec);

  const to = st.label + (stage === 'closed' ? (won ? ' won' : ' lost') : '');
  const entry = {
    id: uid('int'),
    offtakerId: rec.id,
    prospectId: '',
    date: todayISO(), type: 'stage change',
    summary: 'Sales stage moved from ' + from + ' to ' + to + '.',
  };
  state.interactions.push(entry);
  pushInteraction(entry);
  save();
  toast('Moved to ' + to);
  render();
}
