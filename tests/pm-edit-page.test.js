/* Tests for the project plan editor on the Projects page (js/views-pmedit.js).
 *
 * Loads the page code into a sandbox with a stub document and a stub
 * database, then drives the edit form the way a person would: open a task,
 * change fields, save, revert, add a task, add a note.
 *
 *   node tests/pm-edit-page.test.js
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

function makeEnv(role) {
  const writes = []; let ticks = 0;
  /* Any element asked for exists, empty, so a test can set a field before the page reads it. */
  const els = new Proxy({}, { get: (t, k) => t[k] || (t[k] = { id: k, value: '', innerHTML: '', classList: { add() {}, remove() {} } }) });
  const checked = { '.pe-who:checked': [], '.pe-tag:checked': [] };
  const doc = {
    getElementById: id => els[id],
    createElement: () => ({ className: '', id: '', innerHTML: '', classList: { add() {}, remove() {} } }),
    body: { appendChild(el) { els[el.id] = el; } },
    querySelectorAll: sel => checked[sel] || [],
    querySelector: () => null,
  };
  const ctx = {
    console, document: doc, esc, num: v => Number(v) || 0, fmtNum: v => String(v), icon: () => '', growBars() {},
    uid: p => p + '_' + (++ticks), toast(m, k) { ctx._toasts.push([m, k || '']); }, _toasts: [], confirm: () => true,
    JSON, Object, Map, Set, Promise, Date, String, Number, Math, Array,
    supaFetch: async (p, o) => { writes.push({ p, method: (o && o.method) || 'GET', body: o && o.body ? JSON.parse(o.body) : null }); return null; },
    supaFetchAll: async p => ({
      'aee_pm_task_edits': ctx._edits, 'aee_pm_notes': ctx._notes, 'aee_pm_history': ctx._history,
    }[p.split('?')[0]] || []),
    _edits: [], _notes: [], _history: [],
    state: { role, email: 'tester@aeeg.co.za', pmProject: 'p1', pmTab: 'plan', pmF: null,
      pm: { projects: [{ id: 'p1', name: 'AEEG Test Farm' }], tags: [{ name: 'Risk' }, { name: 'KM' }],
        people: [{ id: 'u1', name: 'Karen Metcalf' }, { id: 'u2', name: 'Darrin Arendse' }],
        tasks: [
          { id: 't1', projectId: 'p1', wbs: '1', level: 1, name: 'Phase one', isSummary: true, status: 'To Do', progress: 0 },
          { id: 't2', projectId: 'p1', wbs: '1.1', level: 2, name: 'Heritage Assessment', status: 'To Do', progress: 0, plannedStart: '2026-09-15', plannedFinish: '2026-10-30', assignees: [{ id: 'u1', name: 'Karen Metcalf', initials: 'KM' }], tags: [], fieldValues: [{ name: 'Dataroom', value: 'SLD' }], description: 'orig' },
          { id: 't3', projectId: 'p1', wbs: '1.2', level: 2, name: 'Rezoning', status: 'Doing', progress: 50, tags: [] },
        ] } },
    refreshed: 0, avatarColor: () => '#000', statTile: () => '', openProject() {},
  };
  vm.createContext(ctx);
  vm.runInContext(read('pmedit-core.js') + '\n' + read('views-projectplans.js') + '\n' + read('views-pmedit.js') +
    '\npmRefresh = function () { refreshed++; };', ctx);
  return { ctx, writes, els, checked, doc };
}
const run = (env, code) => vm.runInContext(code, env.ctx);

let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok - ' + name); };

(async () => {
  await test('edits, new tasks and deletions are laid over the copy on load', async () => {
    const e = makeEnv('admin');
    e.ctx._edits = [
      { task_id: 't3', project_id: 'p1', patch: { progress: 80 }, is_new: false, is_deleted: false },
      { task_id: 'crm_1', project_id: 'p1', patch: { name: 'Made here', wbs: '2', level: 1, status: 'To Do', progress: 0 }, is_new: true, is_deleted: false },
      { task_id: 't2', project_id: 'p1', patch: {}, is_new: false, is_deleted: true },
    ];
    await run(e, 'pmLoadEdits(state.pm)');
    const t = run(e, 'state.pm.tasks.map(x => x.id + ":" + x.progress + ":" + (x._edited ? "E" : "") + (x._new ? "N" : ""))').join(',');
    assert.strictEqual(t, 't1:0:,t3:80:E,crm_1:0:EN');
    assert.strictEqual(run(e, 'state.pm.rawTasks.length'), 3, 'the copy is kept whole');
  });

  await test('the plan table shows Edit and notes only to an admin', async () => {
    const admin = makeEnv('admin'); const viewer = makeEnv('viewer');
    for (const e of [admin, viewer]) { e.ctx._notes = [{ id: 'n1', task_id: 't3', project_id: 'p1', body: 'hello', author: 'x', author_kind: 'agent', created_at: '2026-10-03T08:00:00Z' }]; await run(e, 'pmLoadEdits(state.pm)'); }
    const hAdmin = run(admin, 'pmPlanTabHtml()'); const hViewer = run(viewer, 'pmPlanTabHtml()');
    assert.ok(/pmOpenTask\(&#39;|pmOpenTask\(\\'t3/.test(hAdmin) || hAdmin.includes("pmOpenTask("), 'admin has Edit buttons');
    assert.ok(hAdmin.includes('+ New task'));
    assert.ok(!hViewer.includes('pmOpenTask(') && !hViewer.includes('+ New task'), 'a viewer sees none');
    assert.ok(hViewer.includes('1 note'), 'a viewer still sees the notes count');
  });

  await test('saving a changed % writes one patch and its history, status follows', async () => {
    const e = makeEnv('admin'); await run(e, 'pmLoadEdits(state.pm)');
    run(e, "pmOpenTask('t2')");
    e.els['pe-name'].value = 'Heritage Assessment'; e.els['pe-status'].value = 'To Do'; e.els['pe-progress'].value = '100';
    e.els['pe-start'].value = '2026-09-15'; e.els['pe-finish'].value = '2026-10-30'; e.els['pe-effort'].value = '';
    e.els['pe-milestone'].value = ''; e.els['pe-desc'].value = 'orig';
    e.checked['.pe-who:checked'] = [{ value: 'u1' }];
    await run(e, 'pmSaveTask()');
    const edit = e.writes.find(w => w.p.startsWith('aee_pm_task_edits')).body;
    assert.strictEqual(JSON.stringify(edit.patch), JSON.stringify({ progress: 100, status: 'Done' }));
    assert.strictEqual(edit.task_id, 't2');
    assert.strictEqual(edit.updated_by, 'tester@aeeg.co.za');
    const hist = e.writes.find(w => w.p.startsWith('aee_pm_history')).body;
    assert.strictEqual(hist.map(h => h.field).sort().join(','), 'progress,status');
    assert.ok(hist.every(h => h.kind === 'user' && h.by === 'tester@aeeg.co.za'));
    assert.strictEqual(run(e, "pmTaskById('t2').status"), 'Done');
    assert.strictEqual(run(e, "pmTaskById('t2')._orig.progress"), 0, 'the original is remembered');
  });

  await test('saving with nothing changed writes nothing', async () => {
    const e = makeEnv('admin'); await run(e, 'pmLoadEdits(state.pm)');
    run(e, "pmOpenTask('t3')");
    e.els['pe-name'].value = 'Rezoning'; e.els['pe-status'].value = 'Doing'; e.els['pe-progress'].value = '50';
    e.els['pe-start'].value = ''; e.els['pe-finish'].value = ''; e.els['pe-effort'].value = ''; e.els['pe-milestone'].value = ''; e.els['pe-desc'].value = '';
    await run(e, 'pmSaveTask()');
    assert.strictEqual(e.writes.length, 0);
  });

  await test('a bad date is refused with a message and nothing is written', async () => {
    const e = makeEnv('admin'); await run(e, 'pmLoadEdits(state.pm)');
    run(e, "pmOpenTask('t2')");
    e.els['pe-name'].value = 'Heritage Assessment'; e.els['pe-status'].value = 'To Do'; e.els['pe-progress'].value = '0';
    e.els['pe-start'].value = '2026-09-15'; e.els['pe-finish'].value = '2026-01-01'; e.els['pe-effort'].value = ''; e.els['pe-milestone'].value = ''; e.els['pe-desc'].value = 'orig';
    e.checked['.pe-who:checked'] = [{ value: 'u1' }];
    await run(e, 'pmSaveTask()');
    assert.strictEqual(e.writes.length, 0);
    assert.ok(e.ctx._toasts.some(t => /finish date is before/.test(t[0])));
  });

  await test('changing the assignee keeps the other person out and records names', async () => {
    const e = makeEnv('admin'); await run(e, 'pmLoadEdits(state.pm)');
    run(e, "pmOpenTask('t2')");
    e.els['pe-name'].value = 'Heritage Assessment'; e.els['pe-status'].value = 'To Do'; e.els['pe-progress'].value = '0';
    e.els['pe-start'].value = '2026-09-15'; e.els['pe-finish'].value = '2026-10-30'; e.els['pe-effort'].value = ''; e.els['pe-milestone'].value = ''; e.els['pe-desc'].value = 'orig';
    e.checked['.pe-who:checked'] = [{ value: 'u2' }];
    await run(e, 'pmSaveTask()');
    const hist = e.writes.find(w => w.p.startsWith('aee_pm_history')).body;
    assert.strictEqual(hist[0].old_value, 'Karen Metcalf');
    assert.strictEqual(hist[0].new_value, 'Darrin Arendse');
  });

  await test('reverting deletes the edit and logs it', async () => {
    const e = makeEnv('admin');
    e.ctx._edits = [{ task_id: 't3', project_id: 'p1', patch: { progress: 80 }, is_new: false, is_deleted: false }];
    await run(e, 'pmLoadEdits(state.pm)');
    run(e, "pmOpenTask('t3')");
    await run(e, 'pmRevertTask()');
    assert.ok(e.writes.some(w => w.method === 'DELETE' && w.p.includes('task_id=eq.t3')));
    assert.strictEqual(run(e, "pmTaskById('t3').progress"), 50);
    assert.ok(e.writes.find(w => w.p.startsWith('aee_pm_history')).body[0].field === '_reverted');
  });

  await test('a new task is numbered under its phase and stored whole', async () => {
    const e = makeEnv('admin'); await run(e, 'pmLoadEdits(state.pm)');
    run(e, "pmOpenTask('new')");
    e.els['pe-name'].value = 'Soil survey'; e.els['pe-status'].value = 'To Do'; e.els['pe-progress'].value = '0';
    e.els['pe-start'].value = ''; e.els['pe-finish'].value = ''; e.els['pe-effort'].value = '16'; e.els['pe-milestone'].value = ''; e.els['pe-desc'].value = '';
    e.els['pe-parent'] = { value: 't1' };
    await run(e, 'pmSaveTask()');
    const row = e.writes.find(w => w.p.startsWith('aee_pm_task_edits')).body;
    assert.strictEqual(row.is_new, true);
    assert.strictEqual(row.patch.wbs, '1.3', 'after 1.1 and 1.2');
    assert.strictEqual(row.patch.plannedEffortMin, 960);
    assert.strictEqual(row.project_id, 'p1');
    assert.ok(run(e, "pmTaskById('" + row.task_id + "')._new"));
  });

  await test('a deleted task disappears and can be seen in the change log', async () => {
    const e = makeEnv('admin'); await run(e, 'pmLoadEdits(state.pm)');
    run(e, "pmOpenTask('t3')");
    await run(e, 'pmDeleteTask()');
    assert.strictEqual(run(e, "pmTaskById('t3')"), undefined);
    assert.strictEqual(e.writes.find(w => w.p.startsWith('aee_pm_task_edits')).body.is_deleted, true);
  });

  await test('a non-admin cannot open the form or add a note', async () => {
    const e = makeEnv('viewer'); await run(e, 'pmLoadEdits(state.pm)');
    run(e, "pmOpenTask('t2')");
    assert.strictEqual(run(e, 'state.pmEditing'), undefined);
    await run(e, "pmAddNote('p1')");
    assert.strictEqual(e.writes.length, 0);
  });

  await test('a note is saved as a person, and shows in the Notes tab with agent notes', async () => {
    const e = makeEnv('admin');
    e.ctx._notes = [{ id: 'n0', task_id: 't3', project_id: 'p1', body: 'Agent says hi', author: 'Finder', author_kind: 'agent', created_at: '2026-10-03T08:00:00Z' }];
    await run(e, 'pmLoadEdits(state.pm)');
    e.els['pn-body'] = { value: 'Project is on hold' };
    await run(e, "pmAddNote('p1')");
    const row = e.writes.find(w => w.p.startsWith('aee_pm_notes')).body[0];
    assert.strictEqual(row.author_kind, 'user');
    assert.strictEqual(row.task_id, null);
    assert.strictEqual(row.project_id, 'p1');
    const tab = run(e, 'pmNotesTabHtml()');
    assert.ok(tab.includes('Project is on hold') && tab.includes('Agent says hi') && tab.includes('Agent</span>'));
  });

  await test('the form shows notes, history and what changed from ProjectManager.com', async () => {
    const e = makeEnv('admin');
    e.ctx._edits = [{ task_id: 't3', project_id: 'p1', patch: { progress: 80 }, is_new: false, is_deleted: false }];
    e.ctx._notes = [{ id: 'n1', task_id: 't3', project_id: 'p1', body: 'Waiting on consultant', author: 'Karen', author_kind: 'user', created_at: '2026-10-03T08:00:00Z' }];
    e.ctx._history = [{ id: 'h1', task_id: 't3', project_id: 'p1', field: 'progress', old_value: '50%', new_value: '80%', by: 'Karen', kind: 'user', at: '2026-10-03T08:00:00Z' }];
    await run(e, 'pmLoadEdits(state.pm)');
    run(e, "pmOpenTask('t3')");
    const html = e.els['modal-pmtask'].innerHTML;
    assert.ok(html.includes('Waiting on consultant') && html.includes('50%') && html.includes('80%'));
    assert.ok(/Changed from ProjectManager\.com: Done was <b>50%/.test(html));
    assert.ok(html.includes('Revert to ProjectManager.com'));
  });

  console.log('\n' + n + ' passed');
})().catch(e => { console.error(e); process.exit(1); });
