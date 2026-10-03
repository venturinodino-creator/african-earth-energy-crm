/* Tests for the project profile page (js/views-projectprofile.js).
 *
 * Renders the profile for the real portfolio sites, with sample deals and a
 * sample ProjectManager.com plan, and checks what a person would read on it.
 *
 *   node tests/project-profile.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function env({ role = 'admin' } = {}) {
  let page = {}, html = '', navs = [];
  const today = new Date().toISOString().slice(0, 10);
  const ctx = {
    console, esc, num: v => Number(v) || 0, fmtNum: v => String(v), icon: () => '', growBars() {},
    statTile: (i, c, label, value, sub) => '[' + label + ': ' + value + ' | ' + sub + ']',
    setPage: (t, s) => { page = { t, s }; }, setContent: h => { html = h; },
    nav: (v, x) => navs.push([v, x && x.id]), CAPACITY_FACTOR: 0.30,
    getOfftaker: id => ({ sib: { id: 'sib', name: 'Sibanye-Stillwater' } }[id] || {}),
    PIPELINE_STAGES: [{ id: 'proposal', label: 'Proposal' }],
    toast() {}, uid: p => p + '_1', pmAddNote: async () => {},
    state: {
      view: 'project', role, projectId: 'middelburg', projectsMode: 'sites',
      projects: [], offtakers: [
        { id: 'a', name: 'Big Smelter', province: 'Mpumalanga', city: 'Middelburg', peakMw: 120 },
        { id: 'b', name: 'Small Mill', province: 'Mpumalanga', city: 'Witbank', peakMw: 12 },
        { id: 'c', name: 'Cape Co', province: 'Western Cape', peakMw: 99 },
      ],
      deals: [{ id: 'd1', projectId: 'middelburg', offtakerId: 'sib', mw: 20, stage: 'proposal', closeDate: '2027-01-31' }],
      pm: {
        projects: [
          { id: 'pm1', name: 'AEEG Middelburg 49MW Solar Farm', progress: 31, manager: 'Karen Metcalf', status: 'Planning', plannedStart: '2026-01-01', plannedFinish: '2028-01-01' },
          { id: 'pm2', name: 'AEEG Mapela Solar Farm 300MW', progress: 0, status: 'Planning' },
          { id: 'pmT', name: 'AEEG Project Template', isTemplate: true, progress: 0 },
        ],
        tasks: [
          { id: 't1', projectId: 'pm1', wbs: '1', name: 'Phase', isSummary: true },
          { id: 't2', projectId: 'pm1', wbs: '1.1', name: 'Heritage Assessment', progress: 100, plannedFinish: '2026-05-01', assignees: [{ name: 'Darrin Arendse' }] },
          { id: 't3', projectId: 'pm1', wbs: '1.2', name: 'Rezoning', progress: 20, plannedFinish: '2026-06-01', assignees: [] },
          { id: 't4', projectId: 'pm1', wbs: '1.3', name: 'Grid study', progress: 0, plannedFinish: '2099-01-01', assignees: [{ name: 'Karen Metcalf' }] },
        ],
        notes: [{ id: 'n1', project_id: 'pm1', task_id: 't3', body: 'Waiting on the municipality', author: 'Finder agent', author_kind: 'agent', created_at: '2026-10-03T08:00:00Z' }],
        history: [], edits: {},
      },
    },
    pmWhen: () => '03 Oct', pmCanEdit: () => role === 'admin',
  };
  vm.createContext(ctx);
  vm.runInContext(root('data/seed.js') + '\nthis.SITES = AEE_PROJECTS;', ctx);
  ctx.state.projects = ctx.SITES;
  vm.runInContext(root('js/views-projectplans.js') + '\n' + root('js/views-projectprofile.js') + `
    function projectCommitted(p) { return state.deals.filter(d => d.projectId === p.id && d.stage !== 'lost').reduce((s, d) => s + num(d.mw), 0); }
    function projectSigned(p) { return state.deals.filter(d => d.projectId === p.id && d.stage === 'closed').reduce((s, d) => s + num(d.mw), 0); }
    function allocationColor(pct) { return 'var(--accent)'; }`, ctx);
  return { ctx, get html() { return html; }, get page() { return page; }, navs, today };
}
const render = (e, id) => { e.ctx.state.projectId = id; vm.runInContext('renderProject()', e.ctx); return e.html; };

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

test('a site with a linked plan shows its sale, its delivery and its buyers', () => {
  const e = env(); const h = render(e, 'middelburg');
  assert.strictEqual(e.page.t, 'Middelburg Solar Farm + BESS');
  assert.ok(/Capacity: 49 MW/.test(h) && /Still to sell: 29 MW/.test(h), 'capacity and unsold');
  assert.ok(h.includes('Sibanye-Stillwater') && h.includes('Proposal') && h.includes('20 MW'), 'the buyer');
  assert.ok(h.includes('31%') && h.includes('Karen Metcalf'), 'delivery progress and manager');
  assert.ok(h.includes('1 / 3'), 'one of three leaf tasks done (the phase row does not count)');
  assert.ok(/Rezoning/.test(h) && /Grid study/.test(h), 'due next lists the open tasks');
  assert.ok(h.indexOf('Rezoning') < h.indexOf('Grid study'), 'soonest first');
});

test('the plan link is offered and goes to the plan tab for that project', () => {
  const e = env(); const h = render(e, 'middelburg');
  assert.ok(h.includes("projectOpenPlan('pm1')"));
  vm.runInContext("projectOpenPlan('pm1')", e.ctx);
  assert.strictEqual(e.ctx.state.pmProject, 'pm1');
  assert.strictEqual(e.ctx.state.pmTab, 'plan');
  assert.strictEqual(e.ctx.state.projectsMode, 'plans');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(e.navs.pop())), ['projects', null]);
});

test('a probable plan is labelled as unconfirmed, and a site with none says so', () => {
  const e = env();
  const guess = render(e, 'limpopo300');
  assert.ok(/probable match, not confirmed/.test(guess));
  const noPlan = render(e, e.ctx.state.projects.find(p => !['middelburg', 'limpopo300', 'oudtshoorn', 'riverlands', 'lephalale', 'overberg'].includes(p.id)).id);
  assert.ok(/No ProjectManager\.com plan is linked/.test(noPlan));
});

test('prospects in the same province are listed, biggest first, and others left out', () => {
  const h = render(env(), 'middelburg');
  assert.ok(h.includes('Big Smelter') && h.includes('Small Mill'));
  assert.ok(h.indexOf('Big Smelter') < h.indexOf('Small Mill'));
  assert.ok(!h.includes('Cape Co'));
});

test('notes from agents show with an Agent badge; only an admin gets the note box', () => {
  const admin = render(env({ role: 'admin' }), 'middelburg');
  const viewer = render(env({ role: 'viewer' }), 'middelburg');
  assert.ok(admin.includes('Waiting on the municipality') && admin.includes('Agent</span>') && admin.includes('Rezoning'));
  assert.ok(admin.includes('projectAddNote'));
  assert.ok(viewer.includes('Waiting on the municipality') && !viewer.includes('projectAddNote'));
});

test('every portfolio site renders without error', () => {
  const e = env();
  e.ctx.state.projects.forEach(p => { assert.ok(render(e, p.id).length > 500, p.id); });
});

test('an unknown site goes back to the list', () => {
  const e = env(); render(e, 'no-such-site');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(e.navs.pop())), ['projects', null]);
});

console.log('\n' + n + ' passed');
