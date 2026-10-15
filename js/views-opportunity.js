/* ═══════════════════════════════════════════════════════════════════
   The opportunity page.

   What a row on the Pipeline opens: everything about one opportunity on
   one page, the way Salesforce opens an opportunity record. From the top:

     the header        who it is, its stage and chase, and the actions
     Next step         what happens next and the date it is due by
     Account notes     anything about the account, whatever the stage
     key figures       stage, MW, value, probability, close date, next step
     Sales stages      a tab per stage. Clicking one OPENS it, it never
                       moves the account: that is the button in the bar
                       under the tabs. Each stage has its exit checklist
                       (ticked from the record where the CRM can tell, and
                       by hand by anyone), its guidance, its own notes, and
                       the activity logged while the account sat there.
                       Under every stage, All activity: everything, folded
                       away until opened.
     Details, MW opportunities, stage history, stakeholders.

   Next steps, notes and hand ticks are stage items (state.stageItems, the
   aee_stage_items table). An opportunity is a company in the pipeline
   (inPipeline in core.js); a lead has no sales process, so its page is the
   company record instead.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* Which of a stage's exit items (STAGE_PLAYBOOK in data/seed.js) the
   record already shows are done. Only what the data shows is ticked; an
   item it cannot judge (a term sheet signed, diligence) is left for a
   person, never ticked on a guess. */
function opportunityChecks(o, info, stageId) {
  const logs = info.logs;
  const has = fn => logs.some(fn);
  const held = ids => has(i => ids.includes(channelOfEntry(i)) && (!i.outcome || i.outcome === 'held'));
  const deals = dealsFor(o.id).filter(isLiveDeal);
  const decision = info.people.some(c => c.role === 'decision');
  const finance = info.seats.some(s => s.k === 'finance' && s.state !== 'gap');
  const loadKnown = num(o.annualGwh) > 0 && !o.estimated;
  const proposalAt = logs.filter(i => channelOfEntry(i) === 'proposal').map(i => i.date).sort().pop() || '';
  switch (stageId) {
    case 'outreach': return [info.reach.reached >= 3, has(i => i.outcome === 'replied'), held(['online-meeting', 'in-person', 'conference', 'site-visit'])];
    case 'online-meeting': return [held(['online-meeting']), decision, held(['in-person', 'conference', 'site-visit'])];
    case 'in-person': return [held(['in-person', 'conference', 'site-visit']), loadKnown, finance];
    case 'needs-analysis': return [loadKnown && num(o.peakMw) > 0, o.wheeling === 'yes' || o.wheeling === 'likely', deals.some(d => d.closeDate)];
    case 'proposal': return [!!proposalAt, !!proposalAt && has(i => i.date > proposalAt && i.type !== 'stage change'), deals.some(d => num(d.tariff) > 0 && num(d.tenor) > 0)];
    default: return [];
  }
}

/* An item ticked by hand wins over what the record shows, either way. */
function checkItemId(oid, stage, i) { return 'chk_' + oid + '_' + stage + '_' + i; }
function handTick(oid, stage, i) {
  const it = state.stageItems.find(x => x.id === checkItemId(oid, stage, i));
  return it ? !!it.doneAt : undefined;
}

function stageItemsFor(oid, kind, stage) {
  return state.stageItems.filter(i => i.offtakerId === oid && i.kind === kind && (stage === undefined || i.stage === stage));
}
/* The byline shown until the next load. The saved author is the database's,
   stamped from the sign-in (ADR 0002); this is the same name, shown at once. */
function authorName() { return state.email ? toDisplayName(state.email) : 'You'; }

/* ─── ACTIONS ──────────────────────────────────────────────────── */
function saveStageItem(item) {
  const i = state.stageItems.findIndex(x => x.id === item.id);
  if (i >= 0) state.stageItems[i] = item; else state.stageItems.push(item);
  pushStageItem(item);
  save();
}
function needAdmin() {
  if (state.role === 'admin') return false;
  toast('Read-only access — ask an admin to change this', 'warn');
  return true;
}
function toggleOppStepForm() {
  state.oppStepForm = !state.oppStepForm;
  /* The form lives in the card's body: opening it on a folded card unfolds it. */
  if (state.oppStepForm && isFolded('opp:next')) { toggleFold('opp:next'); return; }
  renderOpportunity();
}
function addNextStep(oid) {
  if (needAdmin()) return;
  const body = val('op-ns-text').trim(), due = val('op-ns-due');
  if (!body || !due) { toast('Write the step and pick the date it is due by', 'warn'); return; }
  const o = getOfftaker(oid);
  saveStageItem({ id: uid('st'), offtakerId: oid, stage: sfStageFor(o), kind: 'step', body, dueDate: due, doneAt: '', author: authorName(), createdAt: new Date().toISOString() });
  state.oppStepForm = false;
  toast('Next step saved');
  renderOpportunity();
}
function toggleStepDone(id) {
  if (needAdmin()) return;
  const it = state.stageItems.find(x => x.id === id);
  if (!it) return;
  saveStageItem({ ...it, doneAt: it.doneAt ? '' : new Date().toISOString() });
  renderOpportunity();
}
function deleteStageItem(id) {
  if (needAdmin()) return;
  if (!confirm('Delete this?')) return;
  state.stageItems = state.stageItems.filter(x => x.id !== id);
  removeRow('aee_stage_items', id);
  save();
  renderOpportunity();
}
function addOppNote(oid, kind, stage, inputId) {
  if (needAdmin()) return;
  const body = val(inputId).trim();
  if (!body) { toast('Write the note first', 'warn'); return; }
  saveStageItem({ id: uid('sn'), offtakerId: oid, stage, kind, body, dueDate: '', doneAt: '', author: authorName(), createdAt: new Date().toISOString() });
  toast('Note saved');
  renderOpportunity();
}
function toggleOppCheck(oid, stage, i, nowOn) {
  if (needAdmin()) return;
  const id = checkItemId(oid, stage, i);
  /* A tick toggled before keeps its first date and author, as the database does. */
  const was = state.stageItems.find(x => x.id === id);
  saveStageItem({ id, offtakerId: oid, stage, kind: 'check', body: String(i),
    dueDate: '', doneAt: nowOn ? '' : new Date().toISOString(),
    author: was ? was.author : authorName(), createdAt: was ? was.createdAt : new Date().toISOString() });
  renderOpportunity();
}
function viewOppStage(stage) { state.oppStage = stage; renderOpportunity(); }
function toggleOppAll() { state.oppAllOpen = !state.oppAllOpen; renderOpportunity(); }
/* Moving the account is setSfStage, the one path every move takes (it logs
   the move and brings the opportunities along); the page then opens the
   stage it moved to. */
function moveOppStage(oid, stage) {
  setSfStage(oid, stage);
  state.oppStage = sfStageFor(getOfftaker(oid));
  if (state.view === 'opportunity') renderOpportunity();
}

/* ─── THE PAGE ─────────────────────────────────────────────────── */
function renderOpportunity() {
  const o = getOfftaker(state.detailId);
  if (!o.id) { nav('pipeline'); return; }
  if (!inPipeline(o)) { nav('detail', { id: o.id }); return; }
  /* The open stage tab belongs to one opportunity: arriving at another one
     opens its current stage. */
  if (state.oppStageFor !== o.id) { state.oppStageFor = o.id; state.oppStage = ''; state.oppStepForm = false; }
  _pipeInfo = new Map();
  const info = pipeInfo(o);
  const today = todayISO();
  const current = sfStageFor(o);
  const curIdx = sfStageIndex(current);
  const viewId = SF_STAGES.some(s => s.id === state.oppStage) ? state.oppStage : current;
  const viewIdx = sfStageIndex(viewId);
  const vst = sfStageOf(viewId) || {};
  const play = STAGE_PLAYBOOK[viewId] || { exit: [], guidance: [] };
  const deals = dealsFor(o.id);
  const open = deals.filter(isLiveDeal);
  const mw = open.reduce((a, d) => a + num(d.mw), 0);
  const weighted = open.reduce((a, d) => a + weightedValue(d), 0);
  const close = open.map(d => d.closeDate).filter(Boolean).sort()[0] || '';
  const dwell = stageDwell(o);
  const muted = t => '<span style="color:var(--muted)">' + t + '</span>';
  const name = o.short || o.name;
  const admin = state.role === 'admin';
  const dueLabel = d => !d ? 'No date' : d < today ? 'Overdue · ' + fuDate(d) : d === today ? 'Due today' : 'Due ' + fuDate(d);
  const dueCls = (d, done) => done ? 'op-due done' : !d ? 'op-due' : d < today ? 'op-due late' : daysBetween(today, d) <= 3 ? 'op-due soon' : 'op-due';
  const by = it => (it.author ? 'by ' + esc(it.author) : 'not recorded') + ' · ' + esc(fuDate(String(it.createdAt).slice(0, 10)) || '');

  setPage(name, sectorName(o.sector) + (o.city ? ' · ' + o.city : '') + (o.province ? ', ' + o.province : ''), '', { record: true });

  /* ── Header ──────────────────────────────────────────────────── */
  const head = recordCardHtml(sectorIcon(o.sector, 24), o.name,
    sfStageBadge(o) + (current === 'closed' ? '' : ' ' + dwellChipHtml(o)) + ' ' + chasePillHtml(info) + ' ' + movedPillHtml(info) + ' ' + lastChangedHtml(o),
    null,
    '<button class="btn btn-primary btn-sm" data-admin-only onclick="openLogInteraction(' + jsStr(o.id) + ')">' + icon('plus', 14) + ' Log touch</button>' +
    (open.length === 1
      ? '<button class="btn btn-outline btn-sm" data-admin-only onclick="openEditDeal(' + jsStr(open[0].id) + ')">' + icon('edit', 14) + ' Edit opportunity</button>'
      : '<button class="btn btn-outline btn-sm" data-admin-only onclick="openAddDeal(' + jsStr(o.id) + ')">' + icon('plus', 14) + ' Add MW opportunity</button>') +
    '<button class="btn btn-outline btn-sm" onclick="nav(\'org-map\',{id:' + jsStr(o.id) + '})">' + icon('grid', 14) + ' Org map</button>' +
    '<button class="btn btn-outline btn-sm" onclick="nav(\'detail\',{id:' + jsStr(o.id) + '})">' + icon('building', 14) + ' Company record</button>');

  /* ── Next step and account notes ─────────────────────────────── */
  const open_steps = openSteps(state.stageItems, o.id);
  const done_steps = stageItemsFor(o.id, 'step').filter(i => i.doneAt).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt))).slice(0, 5);
  const stepRow = (it, main) => '<div class="op-ns' + (it.doneAt ? ' done' : main ? ' lead' : '') + '">' +
    '<button type="button" class="op-tick' + (it.doneAt ? ' on' : '') + '" data-admin-only aria-pressed="' + !!it.doneAt + '" ' +
      'aria-label="' + esc((it.doneAt ? 'Mark not done: ' : 'Mark done: ') + it.body) + '" onclick="toggleStepDone(' + jsStr(it.id) + ')">' + (it.doneAt ? '✓' : '') + '</button>' +
    '<div style="min-width:0"><div class="op-ns-t">' + esc(it.body) + '</div>' +
      '<div class="pp-sub">Set at ' + esc((sfStageOf(it.stage) || {}).label || it.stage) + ' · ' + by(it) + '</div></div>' +
    '<span class="' + dueCls(it.dueDate, !!it.doneAt) + '">' + esc(it.doneAt ? 'Done' : dueLabel(it.dueDate)) + '</span>' +
    '<button type="button" class="op-x" data-admin-only aria-label="Delete step" onclick="deleteStageItem(' + jsStr(it.id) + ')">&times;</button>' +
  '</div>';
  const nextCard = '<div class="card"><div class="card-header">' + foldTitle('opp:next', 'Next step', 'card-title') +
      '<button class="btn btn-outline btn-xs" data-admin-only onclick="toggleOppStepForm()">' + (state.oppStepForm ? 'Cancel' : icon('plus', 12) + ' Add next step') + '</button></div>' +
    foldBody('opp:next', (state.oppStepForm ? '<div class="op-form">' +
      '<div class="fg"><label for="op-ns-text">What needs to happen</label><input id="op-ns-text" type="text" placeholder="Send the indicative tariff to the energy lead"></div>' +
      '<div class="fg"><label for="op-ns-due">Do it by</label><input id="op-ns-due" type="date"></div>' +
      '<button class="btn btn-primary btn-sm" onclick="addNextStep(' + jsStr(o.id) + ')">Save step</button></div>' : '') +
    (open_steps.length || done_steps.length
      ? open_steps.map((it, n) => stepRow(it, n === 0)).join('') + done_steps.map(it => stepRow(it, false)).join('')
      : '<div class="pp-sub">No next step set. Add one so nobody has to guess what happens next.</div>')) +
  '</div>';
  const notesList = items => items.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map(it =>
    '<div class="op-note"><div class="pp-th">' + by(it) +
      '<button type="button" class="op-x" data-admin-only aria-label="Delete note" onclick="deleteStageItem(' + jsStr(it.id) + ')">&times;</button></div>' +
    '<div class="op-note-b">' + esc(it.body) + '</div></div>').join('');
  const acctNotes = stageItemsFor(o.id, 'account-note');
  const notesCard = '<div class="card"><div class="card-header"><div>' + foldTitle('opp:notes', 'Account notes', 'card-title') +
      '<div class="card-sub">About the account, whatever the stage</div></div></div>' +
    foldBody('opp:notes', '<div class="op-form op-form-note" data-admin-only><div class="fg"><label for="op-an-text">Add a note</label>' +
      '<textarea id="op-an-text" placeholder="E.g. group target of 30% renewable power by 2030; new energy lead started in October."></textarea></div>' +
      '<button class="btn btn-primary btn-sm" onclick="addOppNote(' + jsStr(o.id) + ',\'account-note\',\'account\',\'op-an-text\')">Save note</button></div>' +
    (acctNotes.length ? notesList(acctNotes) : '<div class="pp-sub">No account notes yet.</div>')) +
  '</div>';

  /* ── Key figures ─────────────────────────────────────────────── */
  const ns = open_steps[0];
  const next = ns ? esc(ns.body.length > 44 ? ns.body.slice(0, 43) + '…' : ns.body) + ' <span class="' + dueCls(ns.dueDate) + '">' + esc(dueLabel(ns.dueDate)) + '</span>'
    : info.due.length ? chasePillHtml(info)
    : current === 'closed' ? 'Hand over to delivery' : muted('None set');
  const key = (label, value) => '<div class="op-key"><div class="op-kl">' + esc(label) + '</div><div class="op-kv">' + value + '</div></div>';
  const keys = '<div class="card op-keys">' +
    key('Stage', esc((sfStageOf(current) || {}).label || '—') + (dwell && current !== 'closed' ? ' · ' + dwell.days + 'd' : '')) +
    key('Open MW', open.length ? fmtNum(mw) + ' MW' : muted('not sized yet')) +
    key('Weighted value', open.length ? fmtR(weighted) : muted('—')) +
    key('Probability', (stageProbability(current) ?? '—') + '%') +
    key('Close date', close ? esc(fuDate(close)) : muted('—')) +
    key('Annual load', isUnworked(o) ? muted('not established') : fmtNum(o.annualGwh) + ' GWh') +
    key('Next step', next) +
  '</div>';

  /* ── Sales stages ────────────────────────────────────────────── */
  const stageOf = entryStages(info.logs, current);
  const logsNewest = logsForAccount(o);
  const stageNotesAll = stageItemsFor(o.id, 'note');
  const countIn = id => logsNewest.filter(i => stageOf[i.id] === id && i.type !== 'stage change').length + stageNotesAll.filter(n => n.stage === id).length;
  const tabs = '<div class="op-tabs" role="tablist" aria-label="Sales stages">' + SF_STAGES.map((s, i) => {
    const c = countIn(s.id);
    const sub = i === curIdx ? 'current' : c ? c + ' item' + (c === 1 ? '' : 's') : i < curIdx ? 'passed' : '—';
    return '<button type="button" role="tab" aria-selected="' + (i === viewIdx) + '" class="op-tab' + (i < curIdx ? ' done' : i === curIdx ? ' now' : '') + (i === viewIdx ? ' view' : '') + '" ' +
      'title="' + esc(s.hint) + '" onclick="viewOppStage(' + jsStr(s.id) + ')">' + esc(s.label) + '<span>' + esc(sub) + '</span></button>';
  }).join('') + '</div>';
  const nextStage = SF_STAGES[curIdx + 1];
  const bar = '<div class="op-bar"><div><b>' + esc(vst.label) + '</b> <span class="pp-sub">· ' +
      (viewIdx === curIdx ? 'the current stage. ' + esc(vst.hint || '') : viewIdx < curIdx ? 'a stage already passed' : 'not reached yet') + '</span></div>' +
    (viewIdx === curIdx && nextStage
      ? '<button class="btn btn-primary btn-sm" data-admin-only onclick="moveOppStage(' + jsStr(o.id) + ',' + jsStr(nextStage.id) + ')">✓ Mark stage complete, move to ' + esc(nextStage.label) + '</button>'
      : viewIdx !== curIdx ? '<button class="btn btn-outline btn-sm" data-admin-only onclick="moveOppStage(' + jsStr(o.id) + ',' + jsStr(viewId) + ')">Move the account to ' + esc(vst.label) + '</button>' : '') +
  '</div>';
  const autoTicks = opportunityChecks(o, info, viewId);
  const checks = play.exit.map((t, i) => {
    const hand = handTick(o.id, viewId, i);
    const on = hand === undefined ? !!autoTicks[i] : hand;
    const why = hand !== undefined ? 'ticked by hand' : autoTicks[i] ? 'from activity' : '';
    return '<div class="op-ck"><button type="button" class="op-tick' + (on ? ' on' : '') + '" aria-pressed="' + on + '" ' +
      'aria-label="' + esc((on ? 'Untick: ' : 'Tick: ') + t) + '" onclick="toggleOppCheck(' + jsStr(o.id) + ',' + jsStr(viewId) + ',' + i + ',' + on + ')"' + (admin ? '' : ' disabled') + '>' + (on ? '✓' : '') + '</button>' +
      '<span>' + esc(t) + (why ? ' <span class="op-why">' + why + '</span>' : '') + '</span></div>';
  }).join('');
  const checkBox = '<div class="op-box">' + foldTitle('opp:checks', 'To move on from ' + esc(vst.label), 'op-h') +
    foldBody('opp:checks', (checks || '<div class="pp-sub">Nothing left to clear: this is the end of the path.</div>') +
    (play.guidance.length ? '<div class="op-h" style="margin-top:10px">Guidance for this stage</div><ul class="op-guide">' +
      play.guidance.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '')) + '</div>';
  const stageNotes = stageNotesAll.filter(n => n.stage === viewId);
  const notesBox = '<div class="op-box">' + foldTitle('opp:stagenotes', 'Stage notes · ' + esc(vst.label), 'op-h') +
    foldBody('opp:stagenotes', '<div class="op-form op-form-note" data-admin-only><div class="fg"><label for="op-sn-text">Add a note for this stage</label>' +
      '<textarea id="op-sn-text" placeholder="What did you learn at this stage?"></textarea></div>' +
      '<button class="btn btn-primary btn-sm" onclick="addOppNote(' + jsStr(o.id) + ',\'note\',' + jsStr(viewId) + ',\'op-sn-text\')">Save</button></div>' +
    (stageNotes.length ? notesList(stageNotes) : '<div class="pp-sub">No notes on this stage yet.</div>')) + '</div>';
  const line = i => '<div class="pp-ti"><span class="pp-dot' + (i.type === 'stage change' ? ' stage' : '') + '"></span><div style="min-width:0">' +
    '<div class="pp-th">' + esc(entryMetaText(i)) + ' · ' + esc(fuDate(i.date) || i.date) + '</div>' +
    '<div>' + esc(i.summary) + '</div></div></div>';
  const inStage = logsNewest.filter(i => stageOf[i.id] === viewId);
  const stageAct = '<div class="op-box">' + foldTitle('opp:stageact', 'Activity in this stage <span class="pf-n">' + inStage.length + '</span>', 'op-h') +
    foldBody('opp:stageact', inStage.length ? inStage.map(line).join('')
      : '<div class="pp-sub">' + (viewIdx > curIdx ? 'Not reached yet. What is logged while the account is at ' + esc(vst.label) + ' will show here.' : 'Nothing was logged while the account was at this stage.') + '</div>') + '</div>';
  const chaseHtml = info.chases.length
    ? info.chases.map(c => '<div class="pp-chase"><div style="min-width:0"><div class="pp-name">' +
        esc((c.people || []).map(id => { const p = info.people.find(x => x.id === id); return p ? (p.first + ' ' + p.last).trim() : ''; }).filter(Boolean).join(', ') || c.title) + '</div>' +
        '<div class="pp-sub">' + esc(c.detail) + '</div></div>' +
        '<span class="pc-chase' + (c.date <= today ? ' due' : '') + '">' + esc(c.date < today ? 'Overdue · ' + fuDate(c.date) : c.date === today ? 'Due today' : 'Due ' + fuDate(c.date)) + '</span></div>').join('')
    : '';
  const allAct = '<div class="op-box op-all">' +
    '<button type="button" class="op-coll" aria-expanded="' + !!state.oppAllOpen + '" onclick="toggleOppAll()">' +
      '<span class="op-chev' + (state.oppAllOpen ? ' open' : '') + '" aria-hidden="true">▸</span> All activity <span class="pf-n">' + logsNewest.length + '</span>' +
      '<span class="pp-sub" style="margin-left:auto">Every touch and stage move, whatever stage is open</span></button>' +
    (state.oppAllOpen
      ? (chaseHtml ? '<div class="op-h" style="margin-top:8px">Chase</div>' + chaseHtml : '') +
        '<div class="op-h" style="margin-top:8px">Touches and moves</div>' +
        (logsNewest.length ? logsNewest.map(line).join('') : '<div class="pp-sub">Nothing logged yet.</div>')
      : '') + '</div>';
  const stagesCard = '<div class="card"><div class="card-header"><div>' + foldTitle('opp:stages', 'Sales stages', 'card-title') +
      '<div class="card-sub">Click a stage to open it. Moving the account is the button under the tabs, so looking never moves anything.</div></div>' +
      '<button class="btn btn-primary btn-xs" data-admin-only onclick="openLogInteraction(' + jsStr(o.id) + ')">' + icon('plus', 12) + ' Log touch</button></div>' +
    foldBody('opp:stages', tabs + bar +
    '<div class="op-stagegrid">' + checkBox + notesBox + '</div>' +
    stageAct + allAct) +
  '</div>';

  /* ── Details, MW opportunities, history, stakeholders ────────── */
  const np = nearestProject(o);
  const dl = rows => '<dl class="op-dl">' + rows.map(([k, v]) => '<dt>' + esc(k) + '</dt><dd>' + v + '</dd>').join('') + '</dl>';
  const supply = { eskom: 'Eskom', municipal: 'Municipal', mixed: 'Eskom and municipal' }[o.supply] || o.supply || '—';
  const details = '<div class="card"><div class="card-header">' + foldTitle('opp:details', 'Details', 'card-title') + '</div>' +
    foldBody('opp:details', dl([
      ['Sector', esc(sectorName(o.sector))],
      ['Location', esc([o.city, o.province].filter(Boolean).join(', ') || '—')],
      ['Annual load', isUnworked(o) ? muted('not established') : fmtNum(o.annualGwh) + ' GWh/yr' + (o.estimated ? ' ' + muted('(estimate)') : '')],
      ['Peak demand', num(o.peakMw) ? fmtNum(o.peakMw) + ' MW' : muted('—')],
      ['Notified max demand', num(o.nmd) ? fmtNum(o.nmd) + ' MVA' : muted('—')],
      ['Supply', esc(supply)],
      ['Wheeling', esc(WHEELING_LABEL[o.wheeling] || o.wheeling || '—')],
      ['Current tariff', num(o.tariff) ? 'R' + num(o.tariff).toFixed(2) + '/kWh' : muted('—')],
      ['Nearest site', np ? esc(np.project.name) + ' ' + muted('· ' + esc(distanceLabel(np))) : muted('—')],
    ])) + '</div>';
  const dealsCard = '<div class="card"><div class="card-header">' + foldTitle('opp:deals', 'MW opportunities', 'card-title') +
    '<button class="btn btn-ghost btn-xs" data-admin-only onclick="openAddDeal(' + jsStr(o.id) + ')">' + icon('plus', 12) + ' Add</button></div>' +
    foldBody('opp:deals', deals.length ? deals.map(d => '<div class="op-deal">' +
        '<div style="min-width:0"><div class="pp-name">' + esc(d.name || 'Opportunity') + '</div>' +
        '<div class="pp-sub">' + fmtNum(d.mw) + ' MW · R' + num(d.tariff).toFixed(2) + '/kWh · ' + num(d.tenor, 20) + ' yrs · ' +
          esc((PIPELINE_STAGES.find(s => s.id === d.stage) || { label: d.stage === 'lost' ? 'Lost' : d.stage }).label) +
          (d.closeDate ? ' · close ' + esc(fuDate(d.closeDate)) : '') + '</div>' +
        '<div class="pp-sub">' + fmtR(dealLifetimeValue(d)) + ' over the contract · ' + fmtR(weightedValue(d)) + ' weighted</div></div>' +
        '<button class="btn btn-xs btn-outline" data-admin-only onclick="openEditDeal(' + jsStr(d.id) + ')" title="Edit">' + icon('edit', 11) + '</button>' +
      '</div>').join('')
      : '<div class="pp-sub">No MW on the table yet. Add one once the load is understood.</div>') +
  '</div>';
  const moves = info.logs.filter(i => i.type === 'stage change').slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const history = '<div class="card"><div class="card-header">' + foldTitle('opp:history', 'Stage history <span class="pf-n">' + moves.length + '</span>', 'card-title') + '</div>' +
    foldBody('opp:history', moves.length ? moves.map(i => '<div class="op-hist"><b>' + esc(fuDate(i.date) || i.date) + '</b> ' + esc(String(i.summary).split('. ')[0].replace(/^Sales stage moved /, '')) + '</div>').join('')
      : '<div class="pp-sub">No stage change logged yet.</div>') + '</div>';
  const seatOf = c => (AE_LADDER.find(s => aeSeatMatch(s, c)) || {}).label || 'Other';
  const people = info.people.map(c => ({ c, e: contactEngagement(c.id, info.logs, today) }))
    .sort((a, b) => ENGAGEMENT_RANK[b.e] - ENGAGEMENT_RANK[a.e] || (a.c.last || '').localeCompare(b.c.last || ''));
  const gaps = info.seats.filter(s => s.state === 'gap');
  const stakeholders = '<div class="card"><div class="card-header"><div>' + foldTitle('opp:people', 'Stakeholders', 'card-title') +
      '<div class="card-sub">' + esc(reachText(info)) + '</div></div>' +
      '<button class="btn btn-ghost btn-xs" data-admin-only onclick="openAddContact(' + jsStr(o.id) + ')">' + icon('plus', 12) + ' Add</button></div>' +
    foldBody('opp:people', seatBarHtml(info) +
    (people.length ? people.map(({ c, e }) => {
      const n = info.logs.filter(i => (i.contactIds || []).includes(c.id)).length;
      return '<div class="pp-person op-person"><div class="pp-seat">' + esc(seatOf(c)) + '</div>' +
        '<div style="min-width:0"><div class="pp-name">' + esc((c.first + ' ' + c.last).trim() || 'Unnamed') + '</div>' +
        '<div class="pp-sub">' + esc(c.title || '—') + ' · ' + n + ' touch' + (n === 1 ? '' : 'es') + '</div></div>' +
        '<span class="ow-eng ow-' + e + '">' + esc(ENGAGEMENT_LABEL[e]) + '</span></div>';
    }).join('') : '<div class="pp-sub" style="margin-top:8px">Nobody on file yet. Add someone, or type them in when you log a touch.</div>') +
    (gaps.length ? '<div class="pp-gaps"><span class="pp-sub">Nobody on file:</span>' +
      gaps.map(s => '<span class="pp-gap">' + esc(s.label) + '</span>').join('') + '</div>' : '')) +
  '</div>';

  /* Top to bottom: who it is, where it stands (key figures, then the stage
     workspace), what happens next beside what we know (one row, equal height),
     then the reference cards. */
  setContent('<div class="rec-block">' + head + '</div>' +
    '<div class="rec-block">' + keys + '</div>' +
    '<div class="rec-block">' + stagesCard + '</div>' +
    '<div class="rec-block op-two op-pair">' + nextCard + notesCard + '</div>' +
    '<div class="op-two op-bottom"><div class="op-col">' + details + dealsCard + history + '</div><div class="op-col">' + stakeholders + '</div></div>' +
    /* Who did what to the account, folded until wanted (js/views-changelog.js). */
    '<div class="op-history">' + accountHistoryCardHtml(o) + '</div>');
}
