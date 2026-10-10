/* The Projects area in the shared frame: the Projects page and a site's profile.
 *
 * Projects: Sites / Analytics / Project plans are tabs under the page header
 * (they were a switch inside it); the sites table sits in a table card with a
 * footer and the grid/table switch is in the filter bar; the plans section has
 * its own tabs as view tabs. A site's profile opens with a breadcrumb and a
 * header card, then the guide card, then Overview / Project plan tabs; the
 * overview cards are one card grid. Runs the real views against the real
 * portfolio and a small sample plan, no browser.
 *
 *   node tests/projects-layout.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
const root = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function env(over) {
  const out = { page: null, content: '' };
  const state = Object.assign({
    view: 'projects', role: 'admin', projectId: 'middelburg', projectsMode: 'sites', projectView: 'table',
    offtakers: [], deals: [{ id: 'd1', projectId: 'middelburg', offtakerId: 'sib', mw: 20, stage: 'proposal' }],
    pm: {
      projects: [{ id: 'pm1', name: 'AEEG Middelburg 49MW Solar Farm', progress: 31, manager: 'Karen', status: 'Planning', plannedStart: '2026-01-01', plannedFinish: '2028-01-01' }],
      tasks: [{ id: 't1', projectId: 'pm1', wbs: '1.1', name: 'Heritage', progress: 100, plannedFinish: '2026-05-01', assignees: [] }, { id: 't2', projectId: 'pm1', wbs: '1.2', name: 'Grid', progress: 0, plannedFinish: '2099-01-01', assignees: [] }],
      notes: [], history: [], edits: {}, people: [], tags: [], sync: {},
    },
  }, over);
  const store = {};
  const ctx = vm.createContext({
    console, window: {}, CSS: { escape: s => s }, document: { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null }, setTimeout: () => 0,
    esc, num: v => Number(v) || 0, fmtNum: v => String(v), fmtR: v => 'R' + v, icon: () => '', growBars() {}, jsStr: v => esc(JSON.stringify(String(v == null ? '' : v))),
    statTile: (i, c, label, value, sub) => '<div class="stat-card">' + label + ': ' + value + ' | ' + sub + '</div>',
    viewToggle: k => '<div class="view-toggle" data-key="' + k + '"></div>', CAPACITY_FACTOR: 0.3, contractedMw: () => 20, pipelineMw: () => 20,
    getOfftaker: id => ({ sib: { id: 'sib', name: 'Sibanye-Stillwater', short: 'Sibanye' } }[id] || {}), PIPELINE_STAGES: [{ id: 'proposal', label: 'Proposal' }],
    toast() {}, uid: p => p + '_1', pmAddNote: async () => {}, pmTaskNotes: () => [], pmWhen: () => '03 Oct', pmCanEdit: () => true,
    inProvince: (o, p) => String((o && o.province) || '').split('/').map(s => s.trim()).includes(p),
    lsGet: (k, d) => (k in store ? store[k] : d), lsSet: (k, v) => { store[k] = v; }, nav() {},
    setPage: (t, s, a, opts) => { out.page = { t, s, a, opts }; }, setContent: h => { out.content = h; }, state,
  });
  vm.runInContext(root('data/seed.js') + '\nthis.SITES = AEE_PROJECTS;', ctx);
  state.projects = ctx.SITES;
  ['js/layout.js', 'js/pmanalytics-core.js', 'js/views-projectplans.js', 'js/views-projectanalytics.js', 'js/views-projectprofile.js', 'js/views-tools.js']
    .forEach(f => vm.runInContext(root(f) + '\n', ctx, { filename: f }));
  return { ctx, out, state, run: fn => { vm.runInContext(fn + '();', ctx); return out; } };
}
const tabLabels = html => [...html.matchAll(/class="view-tab( active)?"[^>]*>([^<]*)/g)].map(m => (m[1] ? '*' : '') + m[2].trim());

console.log('\nProjects page');
test('Sites, Analytics and Project plans are tabs under the page header, with no switch in it', () => {
  const o = env().run('renderProjects');
  assert.deepStrictEqual(tabLabels(o.content).slice(0, 3), ['*Sites', 'Analytics', 'Project plans']);
  assert.ok(!o.page.a.includes('vt-btn') && !o.page.a.includes('view-toggle'), 'the page header holds no mode switch');
  assert.ok(/setProjectsMode\('analytics'\)/.test(o.content));
});
test('the sites mode keeps the KPI row and the plans banner, and tabs come first', () => {
  const o = env().run('renderProjects');
  assert.ok(o.content.indexOf('view-tabs') < o.content.indexOf('stat-card'));
  assert.strictEqual((o.content.match(/class="stat-card"/g) || []).length, 4);
});
test('the sites table is one card with a footer counting the sites', () => {
  const e = env(), o = e.run('renderProjects');
  const n = vm.runInContext('SITES.length', e.ctx);
  assert.ok(o.content.includes('<div class="table-card">'));
  assert.ok(o.content.includes('Showing 1–' + n + ' of ' + n + ' sites'), o.content.match(/Showing[^<]*/));
  assert.ok(o.content.slice(o.content.indexOf('class="toolbar"')).includes('view-toggle'), 'grid/table switch is in the filter bar');
});
test('the grid view keeps a standalone footer', () => {
  const o = env({ projectView: 'grid' }).run('renderProjects');
  assert.ok(o.content.includes('class="ent-grid"') && o.content.includes('class="table-foot standalone"') && !o.content.includes('class="table-card"'));
});
test('the Analytics mode opens with the same tabs and no mode switch in the header', () => {
  const o = env({ projectsMode: 'analytics' }).run('renderProjects');
  assert.deepStrictEqual(tabLabels(o.content).slice(0, 3), ['Sites', '*Analytics', 'Project plans']);
  assert.ok(!o.page.a.includes('vt-btn'));
});
test('the Plans mode has the mode tabs, and the plans section\'s own tabs are view tabs', () => {
  const o = env({ projectsMode: 'plans' }).run('renderProjects');
  const labels = tabLabels(o.content);
  assert.deepStrictEqual(labels.slice(0, 3), ['Sites', 'Analytics', '*Project plans']);
  assert.deepStrictEqual(labels.slice(3), ['*Team summary', 'Portfolio summary', 'Plan', 'Notes &amp; changes', 'Activity']);
  assert.ok(!o.content.includes('vt-btn'), 'no old switch buttons left');
  assert.ok(o.content.includes('id="pm-section"'), 'the section still has the id the refresh looks for');
});

console.log('\nSite profile');
const profile = over => env(Object.assign({ view: 'project' }, over)).run('renderProject');
test('the profile is a record page: breadcrumb in the header, name in the card', () => {
  const o = profile();
  assert.ok(o.page.opts && o.page.opts.record === true);
  const head = o.content.slice(o.content.indexOf('class="record-head"'), o.content.indexOf('What you are looking at'));
  assert.strictEqual((head.match(/Middelburg Solar Farm/g) || []).length, 1, 'the name once');
  ['49', 'MW', 'COD', 'Mpumalanga'].forEach(s => assert.ok(head.includes(s), 'head lacks ' + s));
});
test('order: header card, guide card, tabs, content; the old back button is gone', () => {
  const o = profile(), h = o.content;
  assert.ok(h.indexOf('record-head') < h.indexOf('What you are looking at') && h.indexOf('What you are looking at') < h.indexOf('view-tabs'), 'head, guide, tabs');
  assert.ok(!h.includes('All projects'), 'the breadcrumb replaces the back button');
  assert.deepStrictEqual(tabLabels(h), ['*Overview', 'Project plan (2 tasks)']);
});
test('the overview cards are one card grid, the site card across the full width', () => {
  const h = profile().content;
  assert.ok(h.includes('<div class="card-grid">'));
  assert.ok(/class="card span-all"[\s\S]*?The site/.test(h), 'The site spans the grid');
  ['Delivery', 'Buyers', 'Prospects in Mpumalanga'].forEach(t => assert.ok(h.includes(t), 'missing ' + t));
  const cards = h.slice(h.indexOf('<div class="card-grid">'));
  assert.ok(!cards.includes('grid-2') && !cards.includes('margin-top:14px'), 'no ad-hoc layout left in the card region');
});
test('the plan tab shows the plan under the same header and tabs', () => {
  const h = profile({ projectTab: 'plan', projectTabFor: 'middelburg' }).content;
  assert.deepStrictEqual(tabLabels(h), ['Overview', '*Project plan (2 tasks)']);
  assert.ok(h.includes('record-head'));
});
test('a site with no linked plan still has the header card and the commercial cards', () => {
  const o = profile({ projectId: 'limpopo300', pm: { projects: [], tasks: [], notes: [], history: [], edits: {} } });
  assert.ok(o.content.includes('record-head') && o.content.includes('Buyers') && o.content.includes('No ProjectManager.com plan is linked'));
});
test('no profile text says undefined or NaN', () => {
  assert.ok(!/undefined|NaN|\[object/.test(profile().content));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
