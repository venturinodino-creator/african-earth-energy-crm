/* ═══════════════════════════════════════════════════════════════════
   The opportunity page.

   What a row on the Pipeline opens: everything about one opportunity on
   one page, the way Salesforce opens an opportunity record. The header
   carries who it is and what can be done; under it the key figures, the
   sales path with what it takes to leave the current stage and how to get
   there; then three columns: the details and the opportunities' own
   numbers, the activity (who to chase, and every touch and stage move),
   and the stakeholders seat by seat.

   An opportunity is a company in the pipeline (inPipeline in core.js). A
   company that is only a lead has no sales process to show, so its page is
   the company record instead. The company record stays one button away.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* Which of the current stage's exit items (STAGE_PLAYBOOK in data/seed.js)
   the CRM can already see are done. Only what the data shows is ticked; an
   item it cannot judge from the record (a term sheet signed, diligence) is
   left for the rep, never ticked on a guess. */
function opportunityChecks(o, info) {
  const logs = info.logs;
  const has = fn => logs.some(fn);
  const held = ids => has(i => ids.includes(channelOfEntry(i)) && (!i.outcome || i.outcome === 'held'));
  const deals = dealsFor(o.id).filter(isLiveDeal);
  const decision = info.people.some(c => c.role === 'decision');
  const finance = info.seats.some(s => s.k === 'finance' && s.state !== 'gap');
  const loadKnown = num(o.annualGwh) > 0 && !o.estimated;
  const proposalAt = logs.filter(i => channelOfEntry(i) === 'proposal').map(i => i.date).sort().pop() || '';
  switch (sfStageFor(o)) {
    case 'outreach': return [info.reach.reached >= 3, has(i => i.outcome === 'replied'), held(['online-meeting', 'in-person', 'conference', 'site-visit'])];
    case 'online-meeting': return [held(['online-meeting']), decision, held(['in-person', 'conference', 'site-visit'])];
    case 'in-person': return [held(['in-person', 'conference', 'site-visit']), loadKnown, finance];
    case 'needs-analysis': return [loadKnown && num(o.peakMw) > 0, o.wheeling === 'yes' || o.wheeling === 'likely', deals.some(d => d.closeDate)];
    case 'proposal': return [!!proposalAt, !!proposalAt && has(i => i.date > proposalAt && i.type !== 'stage change'), deals.some(d => num(d.tariff) > 0 && num(d.tenor) > 0)];
    default: return [];
  }
}

function renderOpportunity() {
  const o = getOfftaker(state.detailId);
  if (!o.id) { nav('pipeline'); return; }
  if (!inPipeline(o)) { nav('detail', { id: o.id }); return; }
  _pipeInfo = new Map();
  const info = pipeInfo(o);
  const today = todayISO();
  const stageId = sfStageFor(o);
  const st = sfStageOf(stageId) || {};
  const play = STAGE_PLAYBOOK[stageId] || { exit: [], guidance: [] };
  const deals = dealsFor(o.id);
  const open = deals.filter(isLiveDeal);
  const mw = open.reduce((a, d) => a + num(d.mw), 0);
  const weighted = open.reduce((a, d) => a + weightedValue(d), 0);
  const close = open.map(d => d.closeDate).filter(Boolean).sort()[0] || '';
  const dwell = stageDwell(o);
  const muted = t => '<span style="color:var(--muted)">' + t + '</span>';
  const name = o.short || o.name;

  setPage(name, sectorName(o.sector) + (o.city ? ' · ' + o.city : '') + (o.province ? ', ' + o.province : ''), '', { record: true });

  /* ── Header: who, where it stands, what can be done ───────────── */
  const head = recordCardHtml(sectorIcon(o.sector, 24), o.name,
    sfStageBadge(o) + (stageId === 'closed' ? '' : ' ' + dwellChipHtml(o)) + ' ' + chasePillHtml(info) + ' ' + movedPillHtml(info),
    null,
    '<button class="btn btn-primary btn-sm" data-admin-only onclick="openLogInteraction(' + jsStr(o.id) + ')">' + icon('plus', 14) + ' Log touch</button>' +
    (open.length === 1
      ? '<button class="btn btn-outline btn-sm" data-admin-only onclick="openEditDeal(' + jsStr(open[0].id) + ')">' + icon('edit', 14) + ' Edit opportunity</button>'
      : '<button class="btn btn-outline btn-sm" data-admin-only onclick="openAddDeal(' + jsStr(o.id) + ')">' + icon('plus', 14) + ' Add MW opportunity</button>') +
    '<button class="btn btn-outline btn-sm" onclick="nav(\'org-map\',{id:' + jsStr(o.id) + '})">' + icon('grid', 14) + ' Org map</button>' +
    '<button class="btn btn-outline btn-sm" onclick="nav(\'detail\',{id:' + jsStr(o.id) + '})">' + icon('building', 14) + ' Company record</button>');

  const next = info.due.length ? chasePillHtml(info)
    : info.chases.length ? 'Chase on ' + esc(fuDate(info.chases[0].date))
    : stageId === 'closed' ? 'Hand over to delivery' : 'Book the next meeting';
  const key = (label, value) => '<div class="op-key"><div class="op-kl">' + esc(label) + '</div><div class="op-kv">' + value + '</div></div>';
  const keys = '<div class="card op-keys">' +
    key('Stage', esc(st.label || '—') + (dwell && stageId !== 'closed' ? ' · ' + dwell.days + 'd' : '')) +
    key('Open MW', open.length ? fmtNum(mw) + ' MW' : muted('not sized yet')) +
    key('Weighted value', open.length ? fmtR(weighted) : muted('—')) +
    key('Probability', (stageProbability(stageId) ?? '—') + '%') +
    key('Close date', close ? esc(fuDate(close)) : muted('—')) +
    key('Annual load', isUnworked(o) ? muted('not established') : fmtNum(o.annualGwh) + ' GWh') +
    key('Next step', next) +
  '</div>';

  /* ── The path, and what it takes to move on ──────────────────── */
  const checks = opportunityChecks(o, info);
  const pathCard = '<div class="card">' +
    '<div class="card-header"><div><div class="card-title">Sales stage</div>' +
      '<div class="card-sub">' + esc(st.hint || '') + ' ' + dwellSentenceHtml(o) + '</div></div></div>' +
    sfPathHtml(o) +
    (play.exit.length || play.guidance.length ? '<div class="op-play">' +
      (play.exit.length ? '<div><div class="op-h">To move on from ' + esc(st.label) + '</div>' +
        play.exit.map((t, i) => '<div class="op-check' + (checks[i] ? ' on' : '') + '"><span class="op-box" aria-hidden="true">' + (checks[i] ? '✓' : '') + '</span>' +
          '<span>' + esc(t) + (checks[i] ? '<span class="sr-only"> (done)</span>' : '') + '</span></div>').join('') + '</div>' : '') +
      (play.guidance.length ? '<div><div class="op-h">Guidance for this stage</div><ul class="op-guide">' +
        play.guidance.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>' : '') +
    '</div>' : '') +
  '</div>';

  /* ── Details: the company's numbers and the opportunity's own ── */
  const np = nearestProject(o);
  const dl = rows => '<dl class="op-dl">' + rows.map(([k, v]) => '<dt>' + esc(k) + '</dt><dd>' + v + '</dd>').join('') + '</dl>';
  const supply = { eskom: 'Eskom', municipal: 'Municipal', mixed: 'Eskom and municipal' }[o.supply] || o.supply || '—';
  const details = '<div class="card"><div class="card-header"><div class="card-title">Details</div></div>' +
    dl([
      ['Sector', esc(sectorName(o.sector))],
      ['Location', esc([o.city, o.province].filter(Boolean).join(', ') || '—')],
      ['Annual load', isUnworked(o) ? muted('not established') : fmtNum(o.annualGwh) + ' GWh/yr' + (o.estimated ? ' ' + muted('(estimate)') : '')],
      ['Peak demand', num(o.peakMw) ? fmtNum(o.peakMw) + ' MW' : muted('—')],
      ['Notified max demand', num(o.nmd) ? fmtNum(o.nmd) + ' MVA' : muted('—')],
      ['Supply', esc(supply)],
      ['Wheeling', esc(WHEELING_LABEL[o.wheeling] || o.wheeling || '—')],
      ['Current tariff', num(o.tariff) ? 'R' + num(o.tariff).toFixed(2) + '/kWh' : muted('—')],
      ['Nearest site', np ? esc(np.project.name) + ' ' + muted('· ' + esc(distanceLabel(np))) : muted('—')],
    ]) + '</div>';
  const dealsCard = '<div class="card"><div class="card-header"><div class="card-title">MW opportunities</div>' +
    '<button class="btn btn-ghost btn-xs" data-admin-only onclick="openAddDeal(' + jsStr(o.id) + ')">' + icon('plus', 12) + ' Add</button></div>' +
    (deals.length ? deals.map(d => '<div class="op-deal">' +
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
  const history = '<div class="card"><div class="card-header"><div class="card-title">Stage history</div></div>' +
    (moves.length ? moves.map(i => '<div class="op-hist"><b>' + esc(fuDate(i.date) || i.date) + '</b> ' + esc(String(i.summary).split('. ')[0].replace(/^Sales stage moved /, '')) + '</div>').join('')
      : '<div class="pp-sub">No stage change logged yet.</div>') + '</div>';

  /* ── Activity: who to chase, then everything logged ───────────── */
  const nameOf = id => { const p = info.people.find(x => x.id === id); return p ? (p.first + ' ' + p.last).trim() : ''; };
  const chaseHtml = info.chases.length
    ? '<div class="op-h">Chase</div>' + info.chases.map(c =>
        '<div class="pp-chase"><div style="min-width:0"><div class="pp-name">' + esc((c.people || []).map(nameOf).filter(Boolean).join(', ') || c.title) + '</div>' +
        '<div class="pp-sub">' + esc(c.detail) + '</div></div>' +
        '<span class="pc-chase' + (c.date <= today ? ' due' : '') + '">' +
          esc(c.date < today ? 'Overdue · ' + fuDate(c.date) : c.date === today ? 'Due today' : 'Due ' + fuDate(c.date)) + '</span></div>').join('')
    : '';
  const logs = logsForAccount(o);
  const activity = '<div class="card"><div class="card-header"><div class="card-title">Activity</div>' +
    '<button class="btn btn-primary btn-xs" data-admin-only onclick="openLogInteraction(' + jsStr(o.id) + ')">' + icon('plus', 12) + ' Log touch</button></div>' +
    chaseHtml +
    '<div class="op-h" style="margin-top:' + (chaseHtml ? '10px' : '0') + '">Touches and moves</div>' +
    (logs.length ? logs.map(i =>
      '<div class="pp-ti"><span class="pp-dot' + (i.type === 'stage change' ? ' stage' : '') + '"></span><div style="min-width:0">' +
        '<div class="pp-th">' + esc(entryMetaText(i)) + ' · ' + esc(fuDate(i.date) || i.date) + '</div>' +
        '<div>' + esc(i.summary) + '</div></div></div>').join('')
      : '<div class="pp-sub">Nothing logged yet. Log the first touch: tick who it went to, and the follow-up date sets itself.</div>') +
  '</div>';

  /* ── Stakeholders, seat by seat ──────────────────────────────── */
  const seatOf = c => (AE_LADDER.find(s => aeSeatMatch(s, c)) || {}).label || 'Other';
  const people = info.people.map(c => ({ c, e: contactEngagement(c.id, info.logs, today) }))
    .sort((a, b) => ENGAGEMENT_RANK[b.e] - ENGAGEMENT_RANK[a.e] || (a.c.last || '').localeCompare(b.c.last || ''));
  const gaps = info.seats.filter(s => s.state === 'gap');
  const stakeholders = '<div class="card"><div class="card-header"><div><div class="card-title">Stakeholders</div>' +
      '<div class="card-sub">' + esc(reachText(info)) + '</div></div>' +
      '<button class="btn btn-ghost btn-xs" data-admin-only onclick="openAddContact(' + jsStr(o.id) + ')">' + icon('plus', 12) + ' Add</button></div>' +
    seatBarHtml(info) +
    (people.length ? people.map(({ c, e }) => {
      const n = info.logs.filter(i => (i.contactIds || []).includes(c.id)).length;
      return '<div class="pp-person"><div class="pp-seat">' + esc(seatOf(c)) + '</div>' +
        '<div style="min-width:0"><div class="pp-name">' + esc((c.first + ' ' + c.last).trim() || 'Unnamed') + '</div>' +
        '<div class="pp-sub">' + esc(c.title || '—') + ' · ' + n + ' touch' + (n === 1 ? '' : 'es') + '</div></div>' +
        '<span class="ow-eng ow-' + e + '">' + esc(ENGAGEMENT_LABEL[e]) + '</span></div>';
    }).join('') : '<div class="pp-sub" style="margin-top:8px">Nobody on file yet. Add someone, or type them in when you log a touch.</div>') +
    (gaps.length ? '<div class="pp-gaps"><span class="pp-sub">Nobody on file:</span>' +
      gaps.map(s => '<span class="pp-gap">' + esc(s.label) + '</span>').join('') + '</div>' : '') +
  '</div>';

  setContent('<div class="rec-block">' + head + '</div>' +
    '<div class="rec-block">' + keys + '</div>' +
    '<div class="rec-block">' + pathCard + '</div>' +
    '<div class="rec-grid">' +
      '<div class="rg-about">' + details + dealsCard + history + '</div>' +
      '<div class="rg-main">' + activity + '</div>' +
      '<div class="rg-side">' + stakeholders + '</div>' +
    '</div>');
}
