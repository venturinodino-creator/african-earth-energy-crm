/* Tests for the Analytics dashboard (js/views-projectanalytics.js): what it
 * shows, that every click sets a filter, that the filters show as chips you can
 * remove, that the task list at the foot is exactly what the filters leave, and
 * that on a site's own profile it is locked to that project.
 *
 *   node tests/pm-analytics-page.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const read = f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const iso = d => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

let nid = 0;
const task = o => ({ id: 't' + (++nid), progress: 0, assignees: [], tags: [], level: 2, ...o });

function env({ role = 'admin', many = 0 } = {}) {
  const tasks = [
    task({ projectId: 'p1', wbs: '1', level: 1, isSummary: true, name: 'Studies' }),
    task({ projectId: 'p1', wbs: '1.1', name: 'Heritage', progress: 100, plannedStart: iso(-90), plannedFinish: iso(-60), plannedEffortMin: 480, assignees: [{ id: 'u1', name: 'Karen' }] }),
    task({ projectId: 'p1', wbs: '1.2', name: 'Rezoning', progress: 30, plannedStart: iso(-60), plannedFinish: iso(-10), plannedEffortMin: 960, assignees: [{ id: 'u1', name: 'Karen' }], tags: ['Risk'] }),
    task({ projectId: 'p1', wbs: '1.3', name: 'Grid study', plannedStart: iso(-5), plannedFinish: iso(9), plannedEffortMin: 240, assignees: [{ id: 'u2', name: 'Darrin' }] }),
    task({ projectId: 'p1', wbs: '1.4', name: 'Design', plannedStart: iso(10), plannedFinish: iso(120), plannedEffortMin: 960, assignees: [{ id: 'u2', name: 'Darrin' }] }),
    task({ projectId: 'p2', wbs: '1.1', name: 'Survey', plannedStart: iso(-20), plannedFinish: iso(-1), plannedEffortMin: 480, assignees: [{ id: 'u2', name: 'Darrin' }], tags: ['Issue'] }),
    task({ projectId: 'tpl', wbs: '1.1', name: 'Template task', plannedFinish: iso(30) }),
  ];
  for (let i = 0; i < many; i++) tasks.push(task({ projectId: 'p2', wbs: '9.' + i, name: 'Filler ' + i, plannedFinish: iso(40 + i) }));
  const calls = { renders: 0, projects: 0 };
  const ctx = {
    console, esc, fmtNum: v => String(Math.round(Number(v) || 0)), pmShortDate: d => String(d || '').slice(0, 10), pmCanEdit: () => role === 'admin',
    pmSiteIdFor: () => null, pmSiteGuessFor: () => null, nav() {}, setPage() {}, setContent() {}, projectsModeToggle: () => '',
    renderProject() { calls.renders++; }, renderProjects() { calls.projects++; },
    state: { view: 'projects', pm: {
      projects: [{ id: 'p1', name: 'AEEG Alpha Farm' }, { id: 'p2', name: 'AEEG Beta Farm' }, { id: 'tpl', name: 'Template', isTemplate: true }],
      people: [{ id: 'u1', name: 'Karen' }, { id: 'u2', name: 'Darrin' }], tasks } },
  };
  vm.createContext(ctx);
  vm.runInContext(read('pmanalytics-core.js') + '\n' + read('views-projectanalytics.js'), ctx);
  const html = opts => vm.runInContext('paHtml(' + JSON.stringify(opts || null) + ')', ctx);
  const run = c => vm.runInContext(c, ctx);
  return { ctx, html, run, calls };
}
const count = (h, re) => (h.match(re) || []).length;

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

test('the dashboard shows tiles, the progress chart, the timeline, workload and the task list', () => {
  const h = env().html();
  ['Tasks', 'Complete', 'Overdue', 'Due in 14 days', 'Planned effort', 'Progress against plan', 'Where the work stands', 'Timeline', 'Workload by person', 'Tasks finishing each month', 'Most overdue', 'Due in the next 30 days'].forEach(t => assert.ok(h.includes(t), t));
  assert.ok(h.includes('Alpha Farm') && h.includes('Beta Farm'));
  assert.ok(!h.includes('Template task'), 'a template project is not analysed');
});

test('the numbers are right: 5 tasks in scope, 1 done, 2 overdue, 1 due soon', () => {
  const e = env(); const h = e.html();
  assert.ok(/pa-tile-l">Tasks<\/div><div class="pa-tile-v">5</.test(h));
  assert.ok(/pa-tile-l">Overdue<\/div><div class="pa-tile-v"[^>]*>2</.test(h), 'Rezoning and Survey are late');
  assert.ok(/pa-tile-l">Due in 14 days<\/div><div class="pa-tile-v"[^>]*>1</.test(h), 'Grid study');
  assert.ok(/pa-tile-l">Done<\/div><div class="pa-tile-v"[^>]*>1</.test(h));
});

test('clicking a tile sets its filter, and the list shrinks to exactly those tasks', () => {
  const e = env(); e.html();
  e.run("paSet('health', 'overdue')");
  assert.strictEqual(e.run('state.paF.health'), 'overdue');
  assert.ok(e.calls.projects >= 1, 'the page redraws');
  const h = e.html();
  assert.ok(/<tbody>[\s\S]*Rezoning[\s\S]*Survey[\s\S]*<\/tbody>/.test(h.slice(h.indexOf('exactly the tasks'))));
  const list = h.slice(h.indexOf('exactly the tasks'));
  assert.ok(!list.includes('Grid study') && !list.includes('Heritage') && !list.includes('Design'));
  assert.ok(h.includes('pa-chip') && h.includes('Schedule: <b>Overdue</b>'), 'shown as a chip');
});

test('clicking the same thing again clears it; Clear all clears everything', () => {
  const e = env();
  e.run("paSet('health', 'overdue')"); e.run("paSet('health', 'overdue')");
  assert.ok(!e.run('state.paF.health'));
  e.run("paSet('health', 'soon'); paSet('stage', 'inprogress')");
  assert.ok(e.html().includes('Clear all'));
  e.run('paClear()');
  assert.strictEqual(JSON.stringify(e.run('state.paF')), '{}');
});

test('filters stack: project then person then tag', () => {
  const e = env();
  e.run("paSet('project', 'p1'); paSet('who', 'u1'); paSet('tag', 'Risk')");
  const h = e.html(); const list = h.slice(h.indexOf('exactly the tasks'));
  assert.ok(list.includes('Rezoning') && !list.includes('Heritage') && !list.includes('Survey'));
  assert.strictEqual(count(h, /class="pa-chip"/g), 3);
});

test('each chart click is wired to a filter', () => {
  const h = env().html();
  ['health', 'stage', 'project', 'who', 'month', 'tag'].forEach(k => assert.ok(h.includes("paSet('" + k + "'"), k + ' is clickable'));
});

test('picking a project shows its phases on the timeline', () => {
  const e = env(); e.run("paSet('project', 'p1')");
  const h = e.html();
  assert.ok(h.includes('1 Studies'), 'the phase appears');
  assert.ok(h.includes('Phases'));
});

test('the progress chart reports planned against actual', () => {
  const h = env().html();
  assert.ok(h.includes('Planned today') && h.includes('Actual') && h.includes('Schedule index'));
  assert.ok(/<svg[^>]*viewBox/.test(h) && h.includes('<polyline'));
});

test('on a site profile it is locked to that project: no project picker, and the project cannot be cleared', () => {
  const e = env();
  const free = e.html();
  assert.ok(free.includes('All projects'));
  const locked = e.html({ lockProject: 'p1' });
  assert.ok(!locked.includes('All projects'), 'no project picker');
  assert.ok(locked.includes('1 Studies'), 'phases, since a project is chosen');
  assert.ok(!locked.includes('Survey'), 'only that project');
  e.run("state.view = 'project'; paClear()");
  assert.strictEqual(e.run('state.paF.project'), 'p1', 'Clear all keeps the lock');
  assert.ok(e.calls.renders >= 1, 'a profile redraws itself, not the Projects page');
});

test('leaving a site profile does not leave the Projects page stuck on that project', () => {
  const e = env(); e.html({ lockProject: 'p1' });
  e.run('state.view = "projects"; renderProjectAnalytics()');
  assert.ok(!e.run('state.paF.project'));
});

test('the task list is capped at 40 until you ask for all of it; only an admin gets Edit', () => {
  const e = env({ many: 80 });
  const h = e.html();
  assert.ok(h.includes('Show all 85 tasks'));
  assert.strictEqual(count(h.slice(h.indexOf('exactly the tasks')), /<tr><td class="num"/g), 40);
  e.run('paShowAll()');
  assert.strictEqual(count(e.html().slice(e.html().indexOf('exactly the tasks')), /<tr><td class="num"/g), 85);
  assert.ok(h.includes('pmOpenTask('));
  assert.ok(!env({ role: 'viewer' }).html().includes('pmOpenTask('));
});

test('no tasks match: a plain message, not an empty or broken chart', () => {
  const e = env(); e.run("paSet('who', 'u1'); paSet('health', 'later')");
  const h = e.html();
  assert.ok(h.includes('No tasks match these filters'));
  assert.ok(!/undefined|NaN/.test(h));
});

test('no project plans loaded: a message, not an error', () => {
  const e = env(); e.run('state.pm = null');
  assert.ok(e.html().includes('Loading the project plans'));
  e.run('state.pm = { error: true }');
  assert.ok(e.html().includes('could not be loaded'));
});

console.log('\n' + n + ' passed');
