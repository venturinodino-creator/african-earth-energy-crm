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
    date: todayISO(), type: 'stage change',
    summary: 'Sales stage moved from ' + from + ' to ' + to + '.',
  };
  state.interactions.push(entry);
  pushInteraction(entry);
  save();
  toast('Moved to ' + to);
  render();
}
