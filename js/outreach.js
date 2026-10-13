/* ═══════════════════════════════════════════════════════════════════
   Outreach. Pure functions, no DOM.

   A touch is one logged activity aimed at one or more people at an
   off-taker: an email, a LinkedIn request or message, a call, or a
   meeting. Each touch records who it went to (contact ids), how
   (OUTREACH_CHANNELS in data/seed.js), which touch it was in the round,
   what came of it (OUTREACH_OUTCOMES), and when to follow up if nothing
   does. Everything below is worked out from those entries, so nothing is
   typed twice: a person's engagement, the next touch number, the follow-up
   date and the stage a held meeting moves an account to.

   The Activity page, the log form and the follow-up list all read this
   file, so they never disagree about where a person or an account stands.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

function outreachChannel(id) { return OUTREACH_CHANNELS.find(c => c.id === id) || null; }
function outreachOutcome(id) { return OUTREACH_OUTCOMES.find(c => c.id === id) || null; }

/* The channel an entry was made on. Entries logged before channels existed
   carry only the older type, so read the nearest channel back out of it. */
const TYPE_TO_CHANNEL = { email: 'email', call: 'call', meeting: 'online-meeting', 'site visit': 'site-visit', proposal: 'proposal', note: 'note', linkedin: 'linkedin-message' };
function channelOfEntry(i) {
  if (i && i.channel && outreachChannel(i.channel)) return i.channel;
  return TYPE_TO_CHANNEL[i && i.type] || '';
}

function isOutreachTouch(i) { const c = outreachChannel(channelOfEntry(i)); return !!(c && c.outreach); }
function isMeetingEntry(i) { const c = outreachChannel(channelOfEntry(i)); return !!(c && c.meeting); }

/* A calendar date plus whole working days, Monday to Friday. Public holidays
   are not modelled: a follow-up landing on one is a day early at worst. */
function addWorkdays(iso, n) {
  const d = new Date(String(iso) + 'T12:00:00Z');
  if (!Number.isFinite(d.getTime())) return '';
  let left = Math.max(0, Math.round(Number(n) || 0));
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}

/* What a touch on this channel most likely produced, so the form opens on
   the usual answer: a meeting being logged was held, an email or message
   was sent. A proposal or note has no outcome. */
function defaultOutcome(channelId) {
  const c = outreachChannel(channelId);
  if (!c) return '';
  if (c.meeting) return 'held';
  if (c.outreach) return 'sent';
  return '';
}

/* When to chase if nothing comes back (decision D4: five working days).
   Only for a reaching-out touch still waiting on an answer; a reply, a
   booked meeting or a refusal is the answer. */
function defaultFollowUp(date, channelId, outcomeId) {
  const c = outreachChannel(channelId);
  if (!c || !c.outreach) return '';
  if (outcomeId && outcomeId !== 'sent' && outcomeId !== 'no-answer') return '';
  return addWorkdays(date, OUTREACH_FOLLOW_UP_WORKDAYS);
}

/* Entries in date order, oldest first; on the same day, in the order they
   were made. An entry with no creation time sorts first on its day. */
function byWhen(a, b) {
  return String(a.date || '').localeCompare(String(b.date || '')) ||
    String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
}

/* The touches that went to one person, oldest first. */
function touchesTo(contactId, interactions) {
  return interactions.filter(i => (i.contactIds || []).includes(contactId)).slice().sort(byWhen);
}

/* The number the next reaching-out touch to these people would carry: one
   more than the most anyone among them has had. A meeting or a note is not
   a touch in the round, so it does not count, and neither is their reply
   logged as an email: that is them reaching us. */
function isRoundTouch(i) { return isOutreachTouch(i) && i.outcome !== 'replied'; }
function nextTouchNumber(contactIds, interactions) {
  const ids = (contactIds || []).filter(Boolean);
  if (!ids.length) return 1;
  const most = Math.max(0, ...ids.map(id => touchesTo(id, interactions).filter(isRoundTouch).length));
  return most + 1;
}

/* Where one person stands, from what has been logged against them:

     not-contacted  nothing logged
     contacted      reached out to, no answer yet
     replied        answered, but no meeting yet
     engaging       a meeting booked or held with them
     declined       said no
     cold           OUTREACH_MAX_TOUCHES or more unanswered touches, and the
                    last one more than OUTREACH_FOLLOW_UP_WORKDAYS working
                    days ago

   The strongest signal wins, so a meeting last month still reads as
   engaging after a later unanswered email. A refusal after a meeting is a
   refusal. */
const ENGAGEMENT_LABEL = {
  'not-contacted': 'Not contacted', contacted: 'Contacted', replied: 'Replied',
  engaging: 'Engaging', declined: 'Declined', cold: 'Gone cold',
};
function contactEngagement(contactId, interactions, today) {
  const mine = touchesTo(contactId, interactions);
  if (!mine.length) return 'not-contacted';
  const last = mine[mine.length - 1];
  if (last.outcome === 'declined') return 'declined';
  if (mine.some(i => isMeetingEntry(i) || i.outcome === 'meeting-booked' || i.outcome === 'held')) return 'engaging';
  if (mine.some(i => i.outcome === 'replied')) return 'replied';
  const unanswered = mine.filter(isOutreachTouch).length;
  if (unanswered >= OUTREACH_MAX_TOUCHES && today && addWorkdays(last.date, OUTREACH_FOLLOW_UP_WORKDAYS) < today) return 'cold';
  return 'contacted';
}

/* The stage a logged entry moves its account forward to, or '' for none.
   Only a meeting logged as held moves anything (decision D1); booking one
   is a promise, not a meeting. A reaching-out touch on a company that is
   not in the pipeline yet starts it at Outreach. The caller applies this
   forward only and never moves an account backwards. */
function stageFromEntry(entry, inPipelineAlready) {
  const c = outreachChannel(channelOfEntry(entry));
  if (!c) return '';
  if (c.meeting && c.stage && (!entry.outcome || entry.outcome === 'held')) return c.stage;
  if (!inPipelineAlready && (c.outreach || c.meeting)) return 'outreach';
  return '';
}

/* Follow-ups owed on outreach: a touch with a follow-up date that nothing
   since has answered. It is answered person by person: a later entry on
   the same account that names someone clears that person, so an email to
   three people stays open, named for the two still silent, after the third
   replies. A touch logged without people is cleared by any later entry on
   the account. That is how a follow-up is completed: by logging the next
   touch or the reply, where the work is done anyway, so there is no
   separate task to tick off. The items have the same shape as followUps()
   in js/followups.js. */
function outreachFollowUps(interactions, offtakers, contacts) {
  const byId = {};
  offtakers.forEach(o => { byId[o.id] = o; });
  const people = {};
  (contacts || []).forEach(c => { people[c.id] = c; });
  const nameOf = o => o.short || o.name;
  const sorted = interactions.slice().sort(byWhen);
  const out = [];
  sorted.forEach((t, at) => {
    if (!t.followUpOn) return;
    const o = byId[t.offtakerId];
    if (!o) return;
    const ids = t.contactIds || [];
    /* A stage change is the app's own note, not an answer from anybody. */
    const later = sorted.slice(at + 1).filter(n => n.offtakerId === t.offtakerId && n.type !== 'stage change');
    if (!ids.length && later.length) return;
    const open = ids.filter(id => !later.some(n => (n.contactIds || []).includes(id)));
    if (ids.length && !open.length) return;
    const c = outreachChannel(channelOfEntry(t));
    const who = open.map(id => people[id]).filter(Boolean).map(p => (p.first + ' ' + p.last).trim());
    out.push({
      kind: 'outreach', id: t.id, key: 'touch-' + t.id, accountId: o.id, account: nameOf(o), date: t.followUpOn, people: open.slice(),
      title: 'Follow up' + (who.length ? ' with ' + who.join(', ') : ''),
      detail: (c ? c.label : 'Touch') + (t.touchNo ? ' · touch ' + t.touchNo : '') + ' on ' + (fuDate(t.date) || t.date) + ', no reply logged',
    });
  });
  return out;
}

/* The words that go before a log entry's summary: channel, touch number,
   the people and the outcome. Plain text; the page escapes it. */
function entryHeadline(i, contacts) {
  const c = outreachChannel(channelOfEntry(i));
  const parts = [c ? c.label : (i.type || 'note')];
  if (i.touchNo && c && c.outreach) parts.push('touch ' + i.touchNo);
  const people = {};
  (contacts || []).forEach(p => { people[p.id] = p; });
  const who = (i.contactIds || []).map(id => people[id]).filter(Boolean).map(p => (p.first + ' ' + p.last).trim());
  if (who.length) parts.push(who.join(', '));
  const out = outreachOutcome(i.outcome);
  if (out) parts.push(out.label);
  return parts.join(' · ');
}

/* A one-line summary for a touch logged without one, so a round of four
   emails can be logged in four clicks. A meeting or a note still asks for
   words: what was said is the point of logging it. */
function autoSummary(entry, contacts) {
  const c = outreachChannel(entry.channel);
  if (!c || !c.outreach) return '';
  const people = {};
  (contacts || []).forEach(p => { people[p.id] = p; });
  const who = (entry.contactIds || []).map(id => people[id]).filter(Boolean)
    .map(p => (p.first + ' ' + p.last).trim() + (p.title ? ' (' + p.title + ')' : ''));
  if (!who.length) return '';
  return c.label + (entry.touchNo ? ', touch ' + entry.touchNo : '') + ' to ' + who.join(', ') + '.';
}

/* ─── ON THE PIPELINE ─────────────────────────────────────────────
   What a pipeline card and the account panel read about an account's
   people and outreach. All pure: the ladder and the rule that says whether
   a person fills a seat are passed in (AE_LADDER and aeSeatMatch in
   js/views-orgmap.js), so the board and the org map can never disagree
   about who sits where. */

/* Strongest first, for picking the best answer when two people fill one
   seat. A gap, nobody on file, is weakest of all. */
const ENGAGEMENT_RANK = { gap: 0, 'not-contacted': 1, cold: 2, declined: 2, contacted: 3, replied: 4, engaging: 5 };

/* Each seat on the ladder with the strongest engagement among the people
   who fill it, or 'gap' when nobody does. */
function seatCoverage(contacts, interactions, today, ladder, fills) {
  return (ladder || []).map(seat => {
    let best = 'gap';
    const who = [];
    (contacts || []).forEach(c => {
      if (!fills(seat, c)) return;
      who.push(c);
      const e = contactEngagement(c.id, interactions, today);
      if (ENGAGEMENT_RANK[e] > ENGAGEMENT_RANK[best]) best = e;
    });
    return { k: seat.k, label: seat.label, state: best, people: who };
  });
}

/* People reached (anything logged against them) and people engaging. */
function reachSummary(contacts, interactions, today) {
  const states = (contacts || []).map(c => ({ c, e: contactEngagement(c.id, interactions, today) }));
  return {
    total: states.length,
    reached: states.filter(s => s.e !== 'not-contacted').length,
    engaging: states.filter(s => s.e === 'engaging').map(s => s.c),
  };
}

/* The latest thing anybody did, leaving out the app's own stage notes. */
function lastTouchEntry(interactions) {
  return (interactions || []).filter(i => i.type !== 'stage change').slice().sort(byWhen).pop() || null;
}

/* The stage move in the last `days` days, if the latest one went forward:
   the newest stage-change entry in the window, and only when its sentence
   reads forward. An account moved forward and then back again this week
   has not moved forward, so it gets nothing. `direction` is the pipeline's
   own reader of those sentences (stageMoveDirection). */
function recentForwardMove(interactions, today, days, direction) {
  const since = addDays(today, -days);
  const moves = (interactions || []).filter(i => i.type === 'stage change' && String(i.date || '') >= since && direction(i.summary) !== 0)
    .slice().sort(byWhen);
  const last = moves.pop();
  return last && direction(last.summary) > 0 ? last : null;
}

/* ─── WHICH STAGE AN ENTRY BELONGS TO ─────────────────────────────
   The opportunity page shows, for each stage, what was logged while the
   account sat there. Nothing records that on an entry, so it is read back
   out of the stage-change sentences the app writes ("Sales stage moved from
   Outreach to Online meeting.", "Moved into the pipeline at Outreach."):
   walking the log oldest first, every entry belongs to the stage the
   account was at when it was made, and a stage change belongs to the stage
   it moved into. Before the first move, the account was at that move's
   "from" stage; with no move at all, at `currentStage`. Old stage names are
   read through LEGACY_STAGE_LABELS, like the pipeline's Flow page does. */
function stageIdFromLabel(label) {
  const t = String(label || '').trim().replace(/\s+(won|lost)$/i, '').toLowerCase();
  const hit = SF_STAGES.find(s => s.label.toLowerCase() === t);
  if (hit) return hit.id;
  return LEGACY_STAGE_LABELS[t] || '';
}
function readStageMove(summary) {
  const s = String(summary || '');
  const m = /from (.+?) to ([^.]+?)\s*(?:\.|$)/.exec(s);
  if (m) return { from: stageIdFromLabel(m[1]), to: stageIdFromLabel(m[2]) };
  const p = /pipeline at ([^.]+?)\s*(?:\.|$)/i.exec(s);
  if (p) return { from: '', to: stageIdFromLabel(p[1]) };
  return null;
}
function entryStages(interactions, currentStage) {
  const list = (interactions || []).slice().sort(byWhen);
  const firstMove = list.map(i => i.type === 'stage change' ? readStageMove(i.summary) : null).find(Boolean);
  let at = firstMove ? (firstMove.from || firstMove.to) : (currentStage || '');
  const out = {};
  list.forEach(i => {
    if (i.type === 'stage change') {
      const mv = readStageMove(i.summary);
      if (mv && mv.to) at = mv.to;
    }
    out[i.id] = at || currentStage || '';
  });
  return out;
}
