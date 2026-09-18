/* ════════════════════════════════════════════════════════════════
   Sales path
   The lead form that used to live here is gone: leads and offtakers are
   one record type, so a company is added and edited through the offtaker
   form like any other.
   ════════════════════════════════════════════════════════════════ */
'use strict';

/* ─── OUT OF PROSPECTS, INTO THE PIPELINE ───────
   "Work it". The act that turns a researched lead into an opportunity
   somebody is working, and the only way a record crosses between the two
   folders. It is deliberately explicit rather than something that happens
   by looking at a record: everything downstream — the board, the funnel,
   the conversion figures, the stall warnings — only means anything if
   being in the pipeline is a decision somebody made.

   Writing the stage is what performs the move: inPipeline() reads it, the
   Prospects list drops anything it returns true for, and the record has a
   position on the accounts board from the same render. */
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
  toast((rec.short || rec.name) + ' moved into the pipeline at Prospecting');
  /* Land on the board it has just joined. The record has left Prospects,
     so staying put would leave a rep looking at a list its row vanished
     from, which reads as a delete rather than a move. The accounts board
     is where it now has a position, so that is where it opens — first
     card of the Prospecting column. */
  state.pipeView = 'accounts';
  nav('pipeline');
}

/* ─── BACK OUT OF THE PIPELINE ──────────────────
   The undo for addToPipeline, for the company somebody moved in by
   mistake. Clearing the stage is not enough on its own: inPipeline()
   also reads the opportunities filed against the record and the status
   it was moved to, so all three have to go back or the account is on the
   board again on the next render.

   The opportunities are the destructive part and are counted in the
   confirm rather than disappearing quietly. The activity log stays —
   what was said to a company happened whether or not it turned out to be
   the wrong company to be saying it to. */
function removeFromPipeline(id) {
  if (state.role !== 'admin') { toast('Read-only access — ask an admin to move this', 'warn'); return; }
  const rec = state.offtakers.find(o => o.id === id);
  if (!rec) return;
  if (!inPipeline(rec)) { toast('Not in the pipeline'); return; }

  /* An executed PPA is a contract, not a mistaken entry. It would be
     deleted with the speculative ones and take its MW out of Signed with
     it, and the confirm counts opportunities without saying that one of
     them is signed. Refuse instead of asking: voiding a PPA has to be a
     deliberate act on that opportunity, not a side effect of tidying an
     account off the board. */
  const signed = dealsFor(id).filter(d => normalizeDealStage(d.stage) === 'closed');
  if (signed.length) {
    toast((rec.short || rec.name) + ' has ' +
      (signed.length === 1 ? 'an executed PPA' : signed.length + ' executed PPAs') +
      ' — delete ' + (signed.length === 1 ? 'it' : 'them') + ' first if that is really meant', 'warn');
    return;
  }

  const deals = dealsFor(id);
  const name = rec.short || rec.name;
  const cost = deals.length
    ? '\n\nIts ' + deals.length + ' opportunit' + (deals.length === 1 ? 'y' : 'ies') +
      ' (' + fmtNum(deals.reduce((s, d) => s + num(d.mw), 0)) + ' MW) will be deleted. That cannot be undone.'
    : '';
  if (!confirm('Take ' + name + ' out of the pipeline?\n\n' +
    'It goes back to Off-taker Prospects as a lead: a researched name with no sales stage, ' +
    'no board position and no stall clock.' + cost)) return;

  deals.forEach(d => removeRow('aee_deals', d.id));
  state.deals = state.deals.filter(d => d.offtakerId !== id);

  rec.sfStage = '';
  rec.status = 'prospect';
  pushOfftaker(rec);

  const entry = {
    id: uid('int'), offtakerId: rec.id,
    date: todayISO(), type: 'stage change',
    summary: 'Taken out of the pipeline and back to Off-taker Prospects' +
      (deals.length ? ', with ' + deals.length + ' opportunit' + (deals.length === 1 ? 'y' : 'ies') + ' deleted' : '') + '.',
  };
  state.interactions.push(entry);
  pushInteraction(entry);
  save();
  toast(name + ' is back in Off-taker Prospects');
  nav('offtakers');
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
