/* Tests for the project plan edit rules (js/pmedit-core.js).
 *
 *   node tests/pm-edit.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
/* The file is plain browser script; load it into a sandbox and take its functions. */
const sandbox = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'pmedit-core.js'), 'utf8') +
  '\nthis.api = { pmCleanPatch, pmDiff, pmApplyEdit, pmDescribe };', sandbox);
const { pmCleanPatch, pmDiff, pmApplyEdit, pmDescribe } = sandbox.api;

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

const task = { id: 't1', name: 'Heritage Assessment', status: 'To Do', progress: 0, plannedStart: '2026-09-15', plannedFinish: '2026-10-30', tags: [] };

test('progress 100 makes the task Done', () => {
  const { patch, problems } = pmCleanPatch(task, { progress: 100 });
  assert.strictEqual(problems.length, 0);
  assert.strictEqual(patch.status, 'Done');
});
test('any progress starts a To Do task', () => {
  assert.strictEqual(pmCleanPatch(task, { progress: 40 }).patch.status, 'Doing');
});
test('setting Done sets progress to 100, To Do sets it to 0', () => {
  assert.strictEqual(pmCleanPatch(task, { status: 'Done' }).patch.progress, 100);
  assert.strictEqual(pmCleanPatch({ ...task, status: 'Doing', progress: 50 }, { status: 'To Do' }).patch.progress, 0);
});
test('moving a Done task back below 100 reopens it', () => {
  const done = { ...task, status: 'Done', progress: 100 };
  assert.strictEqual(pmCleanPatch(done, { progress: 60 }).patch.status, 'Doing');
  assert.strictEqual(pmCleanPatch(done, { progress: 0 }).patch.status, 'To Do');
});
test('progress is clamped and rounded; junk is refused', () => {
  assert.strictEqual(pmCleanPatch(task, { progress: 140 }).patch.progress, 100);
  assert.strictEqual(pmCleanPatch(task, { progress: -5 }).patch.progress, 0);
  assert.strictEqual(pmCleanPatch(task, { progress: 33.6 }).patch.progress, 34);
  assert.ok(pmCleanPatch(task, { progress: 'lots' }).problems.length);
});
test('a bad status or empty name is refused', () => {
  assert.ok(pmCleanPatch(task, { status: 'Stuck' }).problems.length);
  assert.ok(pmCleanPatch(task, { name: '   ' }).problems.length);
});
test('finish before start is refused, against the existing dates too', () => {
  assert.ok(pmCleanPatch(task, { plannedFinish: '2026-09-01' }).problems.length);
  assert.ok(pmCleanPatch(task, { plannedStart: '2026-12-01' }).problems.length);
  assert.strictEqual(pmCleanPatch(task, { plannedFinish: '2026-11-15' }).problems.length, 0);
});
test('fields outside the whitelist are dropped', () => {
  const { patch } = pmCleanPatch(task, { name: 'X', id: 'hack', projectId: 'other', wbs: '9' });
  assert.strictEqual(JSON.stringify(Object.keys(patch)), '["name"]');
});
test('an empty date clears it; tags are de-duplicated', () => {
  assert.strictEqual(pmCleanPatch(task, { plannedStart: '' }).patch.plannedStart, null);
  assert.strictEqual(JSON.stringify(pmCleanPatch(task, { tags: ['Risk', 'Risk', 'KM', ''] }).patch.tags), '["Risk","KM"]');
});
test('empty, missing, false and [] all count as "not set", so a form does not invent changes', () => {
  const bare = { id: 't', name: 'A', status: 'To Do', progress: 0 };
  const d = pmDiff(bare, { description: '', tags: [], isMilestone: false, plannedStart: null, plannedEffortMin: null });
  assert.strictEqual(d.length, 0);
  assert.strictEqual(pmDiff({ ...bare, description: 'x' }, { description: '' }).length, 1, 'clearing a real value is a change');
  assert.strictEqual(pmDiff(bare, { isMilestone: true }).length, 1);
  assert.strictEqual(pmDiff(bare, { progress: 0 }).length, 0);
});
test('diff lists only what changed', () => {
  const d = pmDiff(task, { name: 'Heritage Assessment', progress: 10, tags: [] });
  assert.strictEqual(JSON.stringify(d.map(x => x.field)), '["progress"]');
});
test('apply lays the patch over the original and remembers the original', () => {
  const t = pmApplyEdit(task, { patch: { progress: 50, status: 'Doing' } });
  assert.strictEqual(t.progress, 50);
  assert.strictEqual(t._edited, true);
  assert.strictEqual(JSON.stringify(t._orig), JSON.stringify({ progress: 0, status: 'To Do' }));
  assert.strictEqual(task.progress, 0, 'the original object is not changed');
  assert.strictEqual(pmApplyEdit(task, { patch: {} }), task);
});
test('descriptions read plainly', () => {
  assert.strictEqual(pmDescribe('progress', 40), '40%');
  assert.strictEqual(pmDescribe('plannedEffortMin', 480), '8 h');
  assert.strictEqual(pmDescribe('assignees', [{ name: 'A' }, { name: 'B' }]), 'A, B');
  assert.strictEqual(pmDescribe('description', ''), '(empty)');
});

console.log('\n' + n + ' passed');
