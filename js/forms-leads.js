/* ════════════════════════════════════════════════════════════════
   Sales path
   The lead form that used to live here is gone: leads and offtakers are
   one record type, so a company is added and edited through the offtaker
   form like any other.
   ════════════════════════════════════════════════════════════════ */
'use strict';

/* ─── INTO THE PIPELINE ─────────────────────────
   The act that turns a researched name into a working opportunity. It is
   deliberately explicit rather than something that happens by looking at a
   record: everything downstream — the board, the funnel, the conversion
   figures, the stall warnings — only means anything if being in the
   pipeline is a decision somebody made. */
function addToPipeline(id) {
  if (state.role !== 'admin') { toast('Read-only access — ask an admin to move this', 'warn'); return; }
  const rec = state.offtakers.find(o => o.id === id);
  if (!rec) return;
  if (inPipeline(rec)) { toast('Already in the pipeline'); return; }

  rec.sfStage = 'prospecting';
  /* A parked account coming back onto the board is live again. */
  if (rec.status === 'parked' || !rec.status) rec.status = 'prospect';
  pushOfftaker(rec);

  const entry = {
    id: uid('int'),
    offtakerId: rec.id,
    date: todayISO(), type: 'stage change',
    summary: 'Moved into the pipeline at Prospecting.',
  };
  state.interactions.push(entry);
  pushInteraction(entry);
  save();
  toast((rec.short || rec.name) + ' is in the pipeline');
  render();
}

/* ─── SALES PATH ────────────────────────────────
   Moving an offtaker along the Salesforce path. The stage is written on the
   record, the status is kept in step so every existing badge and filter
   stays truthful, and the move is logged — a stage change with no trace of
   why is how a pipeline stops being believed.

   Only for accounts already in the pipeline. Dropping a card onto the
   board from elsewhere is not possible, because a company that is not
   being worked has no path to move along. */
/* Take the stage an account's opportunities imply. Used by the drift
   card, which is the only place that offers it — it exists to close a
   disagreement the app did not create, so it logs what it did and why
   rather than moving a company silently. */
function reconcileAccountStage(id) {
  if (state.role !== 'admin') { toast('Read-only access — ask an admin to move this', 'warn'); return; }
  const rec = state.offtakers.find(o => o.id === id);
  if (!rec) return;
  const from = sfStageLabel(rec);
  const to = applyAccountStageFromDeals(id);
  if (!to) { toast('Already in step with its opportunities'); return; }

  const entry = {
    id: uid('int'),
    offtakerId: rec.id,
    date: todayISO(), type: 'stage change',
    summary: 'Sales stage moved from ' + from + ' to ' + to +
      ' to match its opportunities.',
  };
  state.interactions.push(entry);
  pushInteraction(entry);
  save();
  toast((rec.short || rec.name) + ' moved to ' + to);
  render();
}

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

  const moved = moveDealsWithAccount(rec.id, stage, won);

  const to = st.label + (stage === 'closed' ? (won ? ' won' : ' lost') : '');
  const entry = {
    id: uid('int'),
    offtakerId: rec.id,
    date: todayISO(), type: 'stage change',
    summary: 'Sales stage moved from ' + from + ' to ' + to + '.' +
      (moved ? ' ' + moved + ' opportunit' + (moved === 1 ? 'y' : 'ies') + ' moved with it.' : ''),
  };
  state.interactions.push(entry);
  pushInteraction(entry);
  save();
  toast('Moved to ' + to + (moved ? ' — ' + moved + ' opportunit' + (moved === 1 ? 'y' : 'ies') + ' with it' : ''));
  render();
}

/* The other half of holding the two boards together: the account has just
   moved, so its opportunities move to the same stage. Every live one goes,
   forwards or back, because the whole point is that the two readings agree
   — leaving a deal at Negotiation under an account at Proposal is exactly
   the drift this is here to stop.

   Opportunities already written off stay written off: 'lost' is an outcome,
   not a position on the path, and closing an account lost writes it onto
   the rest rather than parking them at Closed as though they were signed. */
function moveDealsWithAccount(id, stage, won) {
  const target = stage === 'closed' && !won ? 'lost' : stage;
  let n = 0;
  dealsFor(id).forEach(d => {
    if (d.stage === 'lost' || d.stage === target) return;
    d.stage = target;
    if (target !== 'lost') d.probability = stageProbability(target) ?? d.probability;
    pushDeal(d);
    n++;
  });
  return n;
}
