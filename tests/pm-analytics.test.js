/* Tests for the project analytics numbers (js/pmanalytics-core.js): which
 * bucket a task falls in, how progress is weighed, planned against actual, and
 * the per-project, per-person, per-month and per-phase tallies.
 *
 *   node tests/pm-analytics.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'pmanalytics-core.js'), 'utf8') +
  '\nthis.api = { paHealth, paStage, paFilter, paSummary, paPlannedPct, paActualPct, paSCurve, paByProject, paByMonth, paByPerson, paByPhase, paOverdue, paUpcoming, paTags, paSpan, paPos, paPhaseKey };', ctx);
const A = ctx.api;
const plain = v => JSON.parse(JSON.stringify(v));

const TODAY = '2026-10-03';
let id = 0;
const T = o => ({ id: 't' + (++id), projectId: 'p1', wbs: '1.1', level: 2, progress: 0, assignees: [], tags: [], ...o });

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

test('a task is done, overdue, due soon, later or unscheduled', () => {
  assert.strictEqual(A.paHealth(T({ progress: 100, plannedFinish: '2026-01-01' }), TODAY), 'done');
  assert.strictEqual(A.paHealth(T({ plannedFinish: '2026-10-02' }), TODAY), 'overdue');
  assert.strictEqual(A.paHealth(T({ plannedFinish: '2026-10-03' }), TODAY), 'soon', 'due today is not yet late');
  assert.strictEqual(A.paHealth(T({ plannedFinish: '2026-10-17' }), TODAY), 'soon', '14 days out is the edge');
  assert.strictEqual(A.paHealth(T({ plannedFinish: '2026-10-18' }), TODAY), 'later');
  assert.strictEqual(A.paHealth(T({}), TODAY), 'unscheduled');
  assert.strictEqual(A.paHealth(T({ progress: 100 }), TODAY), 'done', 'done wins even with no date');
});

test('stage follows the percentage', () => {
  assert.strictEqual(A.paStage(T({ progress: 0 })), 'notstarted');
  assert.strictEqual(A.paStage(T({ progress: 1 })), 'inprogress');
  assert.strictEqual(A.paStage(T({ progress: 99 })), 'inprogress');
  assert.strictEqual(A.paStage(T({ progress: 100 })), 'done');
  assert.strictEqual(A.paStage(T({ progress: 140 })), 'done', 'over 100 is still done');
});

test('phase rows are never counted as tasks', () => {
  const tasks = [T({ isSummary: true, wbs: '1', level: 1 }), T({ wbs: '1.1' })];
  assert.strictEqual(A.paFilter(tasks, {}, TODAY).length, 1);
});

test('filters combine: project, person, stage, health, month, phase, tag', () => {
  const tasks = [
    T({ projectId: 'a', wbs: '1.1', plannedFinish: '2026-09-01', progress: 50, assignees: [{ id: 'u1' }], tags: ['Risk'] }),
    T({ projectId: 'a', wbs: '2.1', plannedFinish: '2026-11-20', assignees: [{ id: 'u2' }] }),
    T({ projectId: 'b', wbs: '1.1', plannedFinish: '2026-09-15', progress: 100 }),
  ];
  const f = F => A.paFilter(tasks, F, TODAY).length;
  assert.strictEqual(f({}), 3);
  assert.strictEqual(f({ project: 'a' }), 2);
  assert.strictEqual(f({ who: 'u1' }), 1);
  assert.strictEqual(f({ stage: 'done' }), 1);
  assert.strictEqual(f({ health: 'overdue' }), 1);
  assert.strictEqual(f({ month: '2026-11' }), 1);
  assert.strictEqual(f({ phase: 'a|2' }), 1);
  assert.strictEqual(f({ tag: 'Risk' }), 1);
  assert.strictEqual(f({ project: 'a', health: 'overdue', tag: 'Risk' }), 1);
  assert.strictEqual(f({ project: 'b', who: 'u1' }), 0);
});

test('the summary counts every task once in a stage and once in a health bucket', () => {
  const tasks = [T({ progress: 100 }), T({ progress: 40, plannedFinish: '2026-09-01' }), T({ plannedFinish: '2026-10-10' }), T({ plannedFinish: '2027-03-01' }), T({})];
  const s = A.paSummary(tasks, TODAY);
  assert.strictEqual(s.total, 5);
  assert.strictEqual(s.done + s.inprogress + s.notstarted, 5);
  assert.strictEqual(s.done + s.overdue + s.soon + s.later + s.unscheduled, 5);
  assert.deepStrictEqual(plain({ d: s.done, o: s.overdue, so: s.soon, l: s.later, u: s.unscheduled }), { d: 1, o: 1, so: 1, l: 1, u: 1 });
});

test('progress is weighed by effort, so a big task counts for more', () => {
  const tasks = [T({ progress: 100, plannedEffortMin: 60 }), T({ progress: 0, plannedEffortMin: 540 })];
  assert.strictEqual(A.paSummary(tasks, TODAY).progress, 10, '1 hour done of 10 is 10%, not 50%');
  const noEffort = [T({ progress: 100 }), T({ progress: 0 })];
  assert.strictEqual(A.paSummary(noEffort, TODAY).progress, 50, 'with no effort anywhere every task counts equally');
  assert.strictEqual(A.paSummary([], TODAY).progress, 0);
});

test('planned progress runs straight from start to finish', () => {
  const t = [T({ plannedStart: '2026-09-01', plannedFinish: '2026-11-01', plannedEffortMin: 60 })];
  assert.strictEqual(A.paPlannedPct(t, '2026-08-01'), 0);
  assert.strictEqual(A.paPlannedPct(t, '2026-11-01'), 100);
  assert.strictEqual(A.paPlannedPct(t, '2026-12-31'), 100);
  const mid = A.paPlannedPct(t, '2026-10-02');
  assert.ok(mid >= 49 && mid <= 51, 'about halfway: ' + mid);
});

test('the S-curve reports planned against actual, with a schedule index', () => {
  const tasks = [T({ plannedStart: '2026-09-03', plannedFinish: '2026-11-03', progress: 25, plannedEffortMin: 60 })];
  const c = A.paSCurve(tasks, TODAY);
  assert.ok(c.points.length >= 7);
  assert.strictEqual(c.points[0].planned, 0);
  assert.strictEqual(c.points[c.points.length - 1].planned, 100);
  assert.strictEqual(c.actual, 25);
  assert.ok(c.planned >= 48 && c.planned <= 52, 'planned today ~50: ' + c.planned);
  assert.ok(c.index > 0.4 && c.index < 0.6, 'index ~0.5 (behind): ' + c.index);
  assert.strictEqual(A.paSCurve([], TODAY).points.length, 0);
});

test('projects are tallied, templates left out', () => {
  const projects = [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }, { id: 'tpl', name: 'Template', isTemplate: true }];
  const tasks = [T({ projectId: 'a', progress: 100, plannedStart: '2026-01-01', plannedFinish: '2026-02-01' }), T({ projectId: 'a', plannedStart: '2026-03-01', plannedFinish: '2026-12-31' }), T({ projectId: 'b' }), T({ projectId: 'tpl' })];
  const rows = A.paByProject(tasks, projects, TODAY);
  assert.strictEqual(rows.length, 2);
  const a = rows.find(r => r.id === 'a');
  assert.strictEqual(a.total, 2); assert.strictEqual(a.done, 1);
  assert.strictEqual(a.start, '2026-01-01'); assert.strictEqual(a.finish, '2026-12-31');
});

test('months split done, open and overdue, in order', () => {
  const tasks = [T({ plannedFinish: '2026-09-05', progress: 100 }), T({ plannedFinish: '2026-09-20' }), T({ plannedFinish: '2026-11-02' }), T({ plannedFinish: '2026-11-20' })];
  const m = A.paByMonth(tasks, TODAY);
  assert.strictEqual(m.map(r => r.month).join(','), '2026-09,2026-11');
  assert.deepStrictEqual(plain({ d: m[0].done, o: m[0].overdue }), { d: 1, o: 1 });
  assert.strictEqual(m[1].open, 2);
});

test('workload per person counts open work, late work and allocated hours', () => {
  const tasks = [
    T({ assignees: [{ id: 'u1', name: 'Karen', allocatedEffort: 120 }], plannedFinish: '2026-09-01' }),
    T({ assignees: [{ id: 'u1', name: 'Karen', allocatedEffort: 60 }], progress: 100 }),
    T({ assignees: [{ id: 'u1', name: 'Karen' }, { id: 'u2', name: 'Darrin' }], plannedEffortMin: 240, plannedFinish: '2026-10-05' }),
  ];
  const p = A.paByPerson(tasks, TODAY);
  const k = p.find(r => r.id === 'u1'), d = p.find(r => r.id === 'u2');
  assert.deepStrictEqual(plain({ total: k.total, done: k.done, open: k.open, overdue: k.overdue, soon: k.soon }), { total: 3, done: 1, open: 2, overdue: 1, soon: 1 });
  assert.strictEqual(k.hours, 5, '2h + 1h + half of 4h');
  assert.strictEqual(d.hours, 2);
  assert.strictEqual(p[0].id, 'u1', 'busiest first');
});

test('phases are the top-level groups with their own progress', () => {
  const tasks = [
    T({ isSummary: true, wbs: '1', level: 1, name: 'Studies' }), T({ wbs: '1.1', progress: 100 }), T({ wbs: '1.2' }),
    T({ isSummary: true, wbs: '2', level: 1, name: 'Permits' }), T({ wbs: '2.1', progress: 50 }),
    T({ isSummary: true, wbs: '3', level: 1, name: 'Empty' }),
  ];
  const ph = A.paByPhase(tasks, 'p1', TODAY);
  assert.strictEqual(ph.map(p => p.name).join(','), 'Studies,Permits', 'a phase with no tasks is left out');
  assert.strictEqual(ph[0].total, 2); assert.strictEqual(ph[0].progress, 50);
});

test('the late list is worst first and the upcoming list soonest first', () => {
  const tasks = [T({ name: 'a', plannedFinish: '2026-09-30' }), T({ name: 'b', plannedFinish: '2026-08-01' }), T({ name: 'c', plannedFinish: '2026-10-20' }), T({ name: 'd', plannedFinish: '2026-10-05' }), T({ name: 'e', plannedFinish: '2027-06-01' })];
  assert.strictEqual(A.paOverdue(tasks, TODAY, 5).map(x => x.t.name).join(','), 'b,a');
  assert.strictEqual(A.paOverdue(tasks, TODAY, 5)[0].late, 63);
  assert.strictEqual(A.paUpcoming(tasks, TODAY, 30, 5).map(t => t.name).join(','), 'd,c', 'next 30 days only');
});

test('tags are counted', () => {
  assert.deepStrictEqual(plain(A.paTags([T({ tags: ['Risk', 'KM'] }), T({ tags: ['Risk'] }), T({})])), { Risk: 2, KM: 1 });
});

test('the timeline spans whole months and positions dates within it', () => {
  const span = A.paSpan([{ start: '2026-09-15', finish: '2026-11-10' }, { start: '2026-10-01', finish: '2026-10-31' }]);
  assert.strictEqual(span.from, '2026-09-01'); assert.strictEqual(span.to, '2026-11-30');
  assert.strictEqual(span.ticks.join(','), '2026-09,2026-10,2026-11');
  assert.strictEqual(A.paPos(span, '2026-09-01'), 0);
  assert.ok(A.paPos(span, '2026-10-16') > 45 && A.paPos(span, '2026-10-16') < 55);
  assert.strictEqual(A.paSpan([]), null);
});

console.log('\n' + n + ' passed');
