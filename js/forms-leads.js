/* ════════════════════════════════════════════════════════════════
   Sales path
   The lead form that used to live here is gone: leads and offtakers are
   one record type, so a company is added and edited through the offtaker
   form like any other.
   ════════════════════════════════════════════════════════════════ */
'use strict';

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
    date: todayISO(), type: 'stage change',
    summary: 'Sales stage moved from ' + from + ' to ' + to + '.',
  };
  state.interactions.push(entry);
  pushInteraction(entry);
  save();
  toast('Moved to ' + to);
  render();
}
