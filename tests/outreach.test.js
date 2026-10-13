/* Tests for the outreach rules (js/outreach.js): touch numbers, follow-up dates, where a
 * person stands, which stage a logged entry moves an account to, and the follow-ups a
 * touch leaves until somebody answers it.
 *
 *   node tests/outreach.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const ctx = vm.createContext({ console });
vm.runInContext(read('data/seed.js') + '\n' + read('js/followups.js') + '\n' + read('js/outreach.js'), ctx);
/* Plain JSON back out of the sandbox, so deepStrictEqual compares values, not realms. */
const call = code => JSON.parse(JSON.stringify(vm.runInContext(code, ctx)));
const J = v => JSON.stringify(v);

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

const people = [
  { id: 'c1', offtakerId: 'o1', first: 'Thandi', last: 'Mokoena', title: 'VP Sustainability' },
  { id: 'c2', offtakerId: 'o1', first: 'Jan', last: 'van Wyk', title: 'Head of Engineering' },
];
const offtakers = [{ id: 'o1', name: 'Highveld Ferro', short: 'Highveld' }];

console.log('\nThe stages');
test('seven stages, in the order AEEG sells', () => {
  assert.deepStrictEqual(call('SF_STAGES.map(s => s.id)'),
    ['outreach', 'online-meeting', 'in-person', 'needs-analysis', 'proposal', 'negotiation', 'closed']);
  assert.deepStrictEqual(call('PIPELINE_STAGES.map(s => s.id)'), call('SF_STAGES.map(s => s.id)'), 'the deal board runs the same stages');
});
test('Prospecting, stored before the rename, reads as Outreach; a lead keeps no stage', () => {
  assert.strictEqual(call('normalizeSfStage("prospecting")'), 'outreach');
  assert.strictEqual(call('normalizeDealStage("prospecting")'), 'outreach');
  assert.strictEqual(call('normalizeSfStage("")'), '');
  assert.strictEqual(call('normalizeSfStage("proposal")'), 'proposal', 'later stages kept their ids');
});
test('a logged move between old stage names still reads in the right direction', () => {
  assert.strictEqual(call('LEGACY_STAGE_LABELS["prospecting"]'), 'outreach');
  assert.strictEqual(call('LEGACY_STAGE_LABELS["negotiation"]'), 'negotiation');
});

console.log('\nWorking days and defaults');
test('five working days skips the weekend', () => {
  assert.strictEqual(call('addWorkdays("2026-10-13", 5)'), '2026-10-20', 'Tuesday to the next Tuesday');
  assert.strictEqual(call('addWorkdays("2026-10-16", 1)'), '2026-10-19', 'Friday to Monday');
  assert.strictEqual(call('addWorkdays("not a date", 5)'), '');
});
test('an email opens as sent with a follow-up five working days on; a meeting as held with none', () => {
  assert.strictEqual(call('defaultOutcome("email")'), 'sent');
  assert.strictEqual(call('defaultOutcome("online-meeting")'), 'held');
  assert.strictEqual(call('defaultOutcome("note")'), '');
  assert.strictEqual(call('defaultFollowUp("2026-10-13", "email", "sent")'), '2026-10-20');
  assert.strictEqual(call('defaultFollowUp("2026-10-13", "linkedin-connect", "")'), '2026-10-20');
  assert.strictEqual(call('defaultFollowUp("2026-10-13", "email", "replied")'), '', 'a reply is the answer');
  assert.strictEqual(call('defaultFollowUp("2026-10-13", "online-meeting", "held")'), '');
});

console.log('\nTouch numbers');
test('the next touch is one more than the most a ticked person has had', () => {
  const log = [
    { id: 'a', offtakerId: 'o1', date: '2026-10-01', channel: 'email', contactIds: ['c1', 'c2'] },
    { id: 'b', offtakerId: 'o1', date: '2026-10-08', channel: 'email', contactIds: ['c2'] },
    { id: 'm', offtakerId: 'o1', date: '2026-10-09', channel: 'online-meeting', contactIds: ['c2'] },
  ];
  assert.strictEqual(call('nextTouchNumber(["c1"], ' + J(log) + ')'), 2);
  assert.strictEqual(call('nextTouchNumber(["c2"], ' + J(log) + ')'), 3, 'a meeting is not a touch in the round');
  assert.strictEqual(call('nextTouchNumber(["c1","c2"], ' + J(log) + ')'), 3);
  assert.strictEqual(call('nextTouchNumber([], ' + J(log) + ')'), 1);
});

console.log('\nWhere a person stands');
test('nothing logged, contacted, replied, engaging, declined', () => {
  const t = (log, id) => call('contactEngagement(' + J(id || 'c1') + ', ' + J(log) + ', "2026-10-13")');
  assert.strictEqual(t([]), 'not-contacted');
  assert.strictEqual(t([{ date: '2026-10-10', channel: 'email', outcome: 'sent', contactIds: ['c1'] }]), 'contacted');
  assert.strictEqual(t([{ date: '2026-10-10', channel: 'email', outcome: 'replied', contactIds: ['c1'] }]), 'replied');
  assert.strictEqual(t([{ date: '2026-10-10', channel: 'email', outcome: 'meeting-booked', contactIds: ['c1'] }]), 'engaging');
  assert.strictEqual(t([
    { date: '2026-09-01', channel: 'online-meeting', outcome: 'held', contactIds: ['c1'] },
    { date: '2026-10-10', channel: 'email', outcome: 'sent', contactIds: ['c1'] },
  ]), 'engaging', 'a meeting last month still counts after a later unanswered email');
  assert.strictEqual(t([{ date: '2026-10-10', channel: 'email', outcome: 'declined', contactIds: ['c1'] }]), 'declined');
});
test('three unanswered touches, the last one a week old, has gone cold; two has not', () => {
  const touch = d => ({ date: d, channel: 'email', outcome: 'sent', contactIds: ['c1'] });
  const t = log => call('contactEngagement("c1", ' + J(log) + ', "2026-10-13")');
  assert.strictEqual(t([touch('2026-09-15'), touch('2026-09-22'), touch('2026-09-29')]), 'cold');
  assert.strictEqual(t([touch('2026-09-22'), touch('2026-09-29')]), 'contacted');
  assert.strictEqual(t([touch('2026-10-01'), touch('2026-10-08'), touch('2026-10-12')]), 'contacted', 'the third is too recent to give up on');
});

console.log('\nStage moves');
test('a held meeting moves to its stage; a booked one does not', () => {
  assert.strictEqual(call('stageFromEntry({ channel: "online-meeting", outcome: "held" }, true)'), 'online-meeting');
  assert.strictEqual(call('stageFromEntry({ channel: "conference", outcome: "held" }, true)'), 'in-person');
  assert.strictEqual(call('stageFromEntry({ channel: "site-visit", outcome: "" }, true)'), 'in-person');
  assert.strictEqual(call('stageFromEntry({ channel: "online-meeting", outcome: "meeting-booked" }, true)'), '');
  assert.strictEqual(call('stageFromEntry({ channel: "email", outcome: "sent" }, true)'), '', 'an email to a worked account moves nothing');
});
test('the first touch on a lead starts it at Outreach; a note on a lead does not', () => {
  assert.strictEqual(call('stageFromEntry({ channel: "email", outcome: "sent" }, false)'), 'outreach');
  assert.strictEqual(call('stageFromEntry({ channel: "note" }, false)'), '');
});

console.log('\nFollow-ups');
test('a touch waiting on a reply is a follow-up, named for the people', () => {
  const log = [{ id: 't1', offtakerId: 'o1', date: '2026-10-13', channel: 'email', touchNo: 1, contactIds: ['c1'], outcome: 'sent', followUpOn: '2026-10-20', createdAt: '1' }];
  const items = call('outreachFollowUps(' + J(log) + ', ' + J(offtakers) + ', ' + J(people) + ')');
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].date, '2026-10-20');
  assert.strictEqual(items[0].title, 'Follow up with Thandi Mokoena');
  assert.ok(/Email · touch 1/.test(items[0].detail));
  assert.strictEqual(items[0].kind, 'outreach');
});
test('an email to two people stays open, named for the one still silent, after the other replies', () => {
  const both = { id: 't1', offtakerId: 'o1', date: '2026-10-13', channel: 'email', contactIds: ['c1', 'c2'], followUpOn: '2026-10-20', createdAt: '1' };
  const reply = { id: 't2', offtakerId: 'o1', date: '2026-10-14', channel: 'email', outcome: 'replied', contactIds: ['c1'], createdAt: '2' };
  const items = call('outreachFollowUps(' + J([both, reply]) + ', ' + J(offtakers) + ', ' + J(people) + ')');
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].title, 'Follow up with Jan van Wyk');
});
test('the next touch or the reply to the same person clears it; one to somebody else does not', () => {
  const first = { id: 't1', offtakerId: 'o1', date: '2026-10-13', channel: 'email', contactIds: ['c1'], followUpOn: '2026-10-20', createdAt: '1' };
  const other = { id: 't2', offtakerId: 'o1', date: '2026-10-14', channel: 'email', contactIds: ['c2'], createdAt: '2' };
  const reply = { id: 't3', offtakerId: 'o1', date: '2026-10-15', channel: 'email', outcome: 'replied', contactIds: ['c1'], createdAt: '3' };
  const stage = { id: 's', offtakerId: 'o1', date: '2026-10-15', type: 'stage change', createdAt: '4' };
  const n = log => call('outreachFollowUps(' + J(log) + ', ' + J(offtakers) + ', ' + J(people) + ')').length;
  assert.strictEqual(n([first, other]), 1);
  assert.strictEqual(n([first, other, reply]), 0);
  assert.strictEqual(n([Object.assign({}, first, { contactIds: [] }), stage]), 1, 'the app\'s own stage note answers nothing');
});
test('a touch on a company outside the list is left out', () => {
  const log = [{ id: 't1', offtakerId: 'ghost', date: '2026-10-13', channel: 'email', contactIds: [], followUpOn: '2026-10-20' }];
  assert.strictEqual(call('outreachFollowUps(' + J(log) + ', ' + J(offtakers) + ', ' + J(people) + ')').length, 0);
});

console.log('\nWhat the log says');
test('the headline names the channel, touch, people and outcome', () => {
  const h = call('entryHeadline(' + J({ channel: 'email', touchNo: 2, contactIds: ['c1', 'c2'], outcome: 'replied' }) + ', ' + J(people) + ')');
  assert.strictEqual(h, 'Email · touch 2 · Thandi Mokoena, Jan van Wyk · Replied');
  assert.strictEqual(call('entryHeadline({ type: "call" }, [])'), 'Call', 'an entry from before channels reads as its type');
  assert.strictEqual(call('entryHeadline({ type: "stage change" }, [])'), 'stage change');
});
test('a touch logged with no summary gets one; a meeting does not', () => {
  assert.strictEqual(call('autoSummary(' + J({ channel: 'linkedin-connect', touchNo: 1, contactIds: ['c2'] }) + ', ' + J(people) + ')'),
    'LinkedIn connection request, touch 1 to Jan van Wyk (Head of Engineering).');
  assert.strictEqual(call('autoSummary(' + J({ channel: 'online-meeting', contactIds: ['c2'] }) + ', ' + J(people) + ')'), '');
  assert.strictEqual(call('autoSummary(' + J({ channel: 'email', contactIds: [] }) + ', ' + J(people) + ')'), '', 'nobody ticked, nothing to say');
});

console.log('\nOn the pipeline');
test('a reply logged as an email is not one of our touches', () => {
  const log = [
    { offtakerId: 'o1', date: '2026-10-01', channel: 'email', outcome: 'sent', contactIds: ['c1'] },
    { offtakerId: 'o1', date: '2026-10-02', channel: 'email', outcome: 'replied', contactIds: ['c1'] },
  ];
  assert.strictEqual(call('nextTouchNumber(["c1"], ' + J(log) + ')'), 2);
});
test('each seat takes the strongest answer among the people who fill it, or is a gap', () => {
  const ladder = '[{ k: "sustain", label: "Sustainability", re: /sustain/i }, { k: "eng", label: "Engineering", re: /engineer/i }, { k: "proc", label: "Procurement", re: /procure/i }]';
  const log = [{ date: '2026-10-10', channel: 'online-meeting', outcome: 'held', contactIds: ['c1'] }, { date: '2026-10-10', channel: 'email', outcome: 'sent', contactIds: ['c2'] }];
  const seats = call('seatCoverage(' + J(people) + ', ' + J(log) + ', "2026-10-13", ' + ladder + ', (s, c) => s.re.test(c.title)).map(s => s.k + ":" + s.state)');
  assert.deepStrictEqual(seats, ['sustain:engaging', 'eng:contacted', 'proc:gap']);
});
test('reach counts the people with anything logged, and names the ones engaging', () => {
  const log = [{ date: '2026-10-10', channel: 'online-meeting', outcome: 'held', contactIds: ['c1'] }];
  const r = call('reachSummary(' + J(people) + ', ' + J(log) + ', "2026-10-13")');
  assert.strictEqual(r.total, 2); assert.strictEqual(r.reached, 1); assert.strictEqual(r.engaging[0].first, 'Thandi');
});
test('the last touch leaves out the app\'s own stage notes; a forward move this week is found', () => {
  const log = [
    { id: 'a', date: '2026-10-08', channel: 'online-meeting', outcome: 'held', createdAt: '1' },
    { id: 's', date: '2026-10-08', type: 'stage change', summary: 'Sales stage moved from Outreach to Online meeting.', createdAt: '2' },
    { id: 'old', date: '2026-09-01', type: 'stage change', summary: 'Sales stage moved from Outreach to Online meeting.', createdAt: '0' },
  ];
  assert.strictEqual(call('lastTouchEntry(' + J(log) + ').id'), 'a');
  const dir = 's => /from Outreach to/.test(s) ? 1 : 0';
  assert.strictEqual(call('(recentForwardMove(' + J(log) + ', "2026-10-13", 7, ' + dir + ') || {}).id'), 's');
  assert.strictEqual(call('recentForwardMove(' + J(log) + ', "2026-10-20", 7, ' + dir + ')'), null, 'not when it is over a week old');
  const back = log.concat([{ id: 'b', date: '2026-10-13', type: 'stage change', summary: 'Sales stage moved from Online meeting to Outreach.', createdAt: '3' }]);
  const dir2 = 's => /from Outreach to/.test(s) ? 1 : /to Outreach/.test(s) ? -1 : 0';
  assert.strictEqual(call('recentForwardMove(' + J(back) + ', "2026-10-13", 7, ' + dir2 + ')'), null, 'moved forward then back this week: no tag');
});

console.log('\nWhich stage an entry belongs to');
test('each entry belongs to the stage the account was at; a move belongs to where it went', () => {
  const log = [
    { id: 'a', date: '2026-09-20', type: 'email', summary: 'x', createdAt: '1' },
    { id: 'm1', date: '2026-10-01', type: 'stage change', summary: 'Sales stage moved from Outreach to Online meeting. Online meeting held.', createdAt: '2' },
    { id: 'b', date: '2026-10-02', type: 'call', summary: 'y', createdAt: '3' },
    { id: 'm2', date: '2026-10-05', type: 'stage change', summary: 'Sales stage moved from Online meeting to Outreach.', createdAt: '4' },
    { id: 'c', date: '2026-10-06', type: 'email', summary: 'z', createdAt: '5' },
  ];
  assert.deepStrictEqual(call('entryStages(' + J(log) + ', "outreach")'), { a: 'outreach', m1: 'online-meeting', b: 'online-meeting', m2: 'outreach', c: 'outreach' });
});
test('old stage names and "into the pipeline" read too; with no move, everything is at the current stage', () => {
  const log = [
    { id: 'p', date: '2026-09-01', type: 'stage change', summary: 'Moved into the pipeline at Prospecting.', createdAt: '1' },
    { id: 'q', date: '2026-09-02', type: 'email', summary: 'x', createdAt: '2' },
    { id: 'r', date: '2026-09-10', type: 'stage change', summary: 'Sales stage moved from Prospecting to Proposal.', createdAt: '3' },
  ];
  assert.deepStrictEqual(call('entryStages(' + J(log) + ', "proposal")'), { p: 'outreach', q: 'outreach', r: 'proposal' });
  assert.deepStrictEqual(call('entryStages(' + J([{ id: 'z', date: '2026-10-01', type: 'note', summary: 'n' }]) + ', "needs-analysis")'), { z: 'needs-analysis' });
});
test('the next open step is the soonest due; done steps are not next', () => {
  const items = [
    { id: '1', offtakerId: 'o1', kind: 'step', body: 'later', dueDate: '2026-10-20', doneAt: '' },
    { id: '2', offtakerId: 'o1', kind: 'step', body: 'sooner', dueDate: '2026-10-15', doneAt: '' },
    { id: '3', offtakerId: 'o1', kind: 'step', body: 'done', dueDate: '2026-10-01', doneAt: '2026-10-01' },
    { id: '4', offtakerId: 'o1', kind: 'note', body: 'a note', dueDate: '2026-10-02' },
  ];
  assert.strictEqual(call('nextStepOf(' + J(items) + ', "o1").body'), 'sooner');
  const fu = call('stepFollowUps(' + J(items) + ', ' + J(offtakers) + ', s => s)');
  assert.deepStrictEqual(fu.map(f => f.title + '@' + f.date + ':' + f.kind), ['sooner@2026-10-15:step', 'later@2026-10-20:step']);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
if (fail) process.exit(1);
