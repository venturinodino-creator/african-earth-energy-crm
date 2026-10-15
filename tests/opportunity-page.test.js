/* The opportunity page (js/views-opportunity.js): what a row on the Pipeline opens.
 *
 * Runs the real page against a small stub book with the real stage list, playbook and
 * outreach rules, no browser, and checks what a person would read and do on it: the next
 * step and account notes, the key figures, the stage tabs (which open a stage and never
 * move the account), the checklist ticked from the record or by hand, stage notes, the
 * activity of each stage, All activity folded away, and the columns underneath.
 *
 *   node tests/opportunity-page.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const scopeStubs = require('./scope-stubs');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : (d || 0));

const ferro = {
  id: 'f', name: 'Ferro Smelter Ltd', short: 'Ferro', sector: 'mining', city: 'eMalahleni', province: 'Mpumalanga',
  annualGwh: 900, peakMw: 120, nmd: 0, tariff: 1.3, supply: 'eskom', wheeling: 'likely', status: 'engaged', sfStage: 'online-meeting', estimated: false,
};
const lead = { id: 'l', name: 'Lead Co', short: 'Lead', sector: 'mining', status: 'prospect', sfStage: '' };
const LOG = [
  { id: 'i1', offtakerId: 'f', date: '2026-10-01', type: 'email', channel: 'email', contactIds: ['c1'], touchNo: 1, outcome: 'sent', summary: 'First email to Thandi.', createdAt: '1' },
  { id: 'i2', offtakerId: 'f', date: '2026-10-06', type: 'email', channel: 'email', contactIds: ['c2'], touchNo: 1, outcome: 'sent', followUpOn: '2026-10-13', summary: 'Email to Jan.', createdAt: '2' },
  { id: 'i3', offtakerId: 'f', date: '2026-10-08', type: 'stage change', summary: 'Sales stage moved from Outreach to Online meeting. Online meeting held on 2026-10-08.', createdAt: '3' },
  { id: 'i4', offtakerId: 'f', date: '2026-10-08', type: 'meeting', channel: 'online-meeting', contactIds: ['c1'], outcome: 'held', summary: 'Intro call with Thandi.', createdAt: '4' },
];

function run(over, after) {
  const out = { page: null, content: '', navs: [], pushed: [], moved: [], toasts: [] };
  const state = Object.assign({
    view: 'opportunity', detailId: 'f', role: 'admin', province: '', email: 'dino@aeeg.co.za',
    offtakers: [Object.assign({}, ferro), lead],
    deals: [{ id: 'd1', offtakerId: 'f', name: 'Ferro 40 MW', mw: 40, tariff: 1.1, tenor: 20, stage: 'online-meeting', probability: 10, closeDate: '2027-06-30' }],
    contacts: [
      { id: 'c1', offtakerId: 'f', first: 'Thandi', last: 'M', title: 'VP Sustainability', role: 'decision' },
      { id: 'c2', offtakerId: 'f', first: 'Jan', last: 'W', title: 'Head of Engineering', role: 'technical' },
    ],
    interactions: LOG.slice(), stageItems: [], projects: [],
  }, over);
  const inputs = {};
  const ctx = vm.createContext({
    ...scopeStubs(state), console, state, esc, num, icon: () => '', jsStr: v => esc(JSON.stringify(String(v == null ? '' : v))),
    fmtNum: v => String(Math.round(num(v))), fmtR: v => 'R' + Math.round(num(v) / 1e6) + 'm', relTime: () => 'recently', sectorName: s => s,
    todayISO: () => '2026-10-13', getOfftaker: id => state.offtakers.find(o => o.id === id) || {},
    /* layout.js's chip, tested in record-layout.test.js; here only where it sits. */
    lastChangedHtml: o => '<span class="chip rh-changed">' + (o.lastChangedBy ? 'Last changed by ' + esc(o.lastChangedBy) : 'Last change not recorded') + '</span>',
    contactsFor: id => state.contacts.filter(c => c.offtakerId === id), dealsFor: id => state.deals.filter(d => d.offtakerId === id),
    logsForAccount: o => state.interactions.filter(i => i.offtakerId === o.id).sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt))),
    inPipeline: o => !!o.sfStage, isUnworked: () => false, isStalled: () => false, stageDwell: () => ({ days: 5 }),
    dwellChipHtml: () => '<span class="chip">5d</span>', sfStageBadge: o => '<span class="badge">' + o.sfStage + '</span>',
    weightedValue: d => num(d.mw) * 1e6, dealLifetimeValue: d => num(d.mw) * 1e7,
    nearestProject: () => null, distanceLabel: () => '—', sectorIcon: () => '', WHEELING_LABEL: { likely: 'Likely' },
    recordCardHtml: (ic, name, chips, desc, acts) => '<div class="record-head"><h3>' + esc(name) + '</h3><div class="rh-chips">' + chips + '</div><div class="rh-actions">' + acts + '</div></div>',
    entryMetaText: i => i.type, AE_LADDER: [{ k: 'sustain', label: 'Sustainability / ESG', re: /sustain/i }, { k: 'eng', label: 'Engineering', re: /engineer/i }, { k: 'finance', label: 'CFO / finance', re: /cfo|financ/i }],
    aeSeatMatch: (s, c) => s.re.test((c && c.title) || ''),
    toDisplayName: e => String(e).split('@')[0], uid: p => p + '_' + (out.pushed.length + 1), val: id => inputs[id] || '',
    toast: m => out.toasts.push(m), save() {}, pushStageItem: i => out.pushed.push(i), removeRow() {}, confirm: () => true,
    setSfStage: (id, stage) => { out.moved.push([id, stage]); state.offtakers.find(o => o.id === id).sfStage = stage; },
    setPage: (t, s, a, opts) => { out.page = { t, s, a, opts }; }, setContent: h => { out.content = h; }, nav: (v, x) => out.navs.push([v, x && x.id]),
    supaFetchAll: async q => { (out.fetched = out.fetched || []).push(q); return []; }, render() {},
  });
  vm.runInContext(read('data/seed.js') + '\n' + read('js/followups.js') + '\n' + read('js/outreach.js') + '\n' +
    read('js/views-dashboard.js').match(/function isLiveDeal[\s\S]*?\n}/)[0] + '\n' +
    /* core.js's stage helpers, over the real stage list */
    'function sfStageFor(o) { return o.sfStage || "outreach"; }\n' +
    'function sfStageOf(id) { return SF_STAGES.find(s => s.id === id) || null; }\n' +
    'function sfStageIndex(id) { return SF_STAGES.findIndex(s => s.id === id); }\n' +
    'function stageProbability(id) { return (sfStageOf(id) || {}).prob; }\n' +
    read('js/views-pipeline.js') + '\n' + read('js/views-changelog.js') + '\n' + read('js/views-opportunity.js') + '\nrenderOpportunity();', ctx);
  if (after) after(ctx, inputs);
  return out;
}

console.log('\nThe page');
test('a record page named for the opportunity, header with stage, chase and actions', () => {
  const o = run({});
  assert.strictEqual(o.page.t, 'Ferro');
  assert.ok(o.page.opts.record);
  assert.ok(o.content.includes('class="badge">online-meeting') && o.content.includes('Chase Jan · today'));
  ['Log touch', 'Edit opportunity', 'Org map', 'Company record'].forEach(t => assert.ok(o.content.includes(t), t));
});
test('the header says who last changed the company', () => {
  const o = run({ offtakers: [Object.assign({}, ferro, { lastChangedBy: 'thabo' }), lead] });
  const head = o.content.slice(o.content.indexOf('record-head'), o.content.indexOf('op-keys'));
  assert.ok(head.includes('Last changed by thabo'));
});
test('top to bottom: header, key figures, Sales stages, then Next step beside Account notes, then the rest', () => {
  const h = run({}).content;
  /* Cards by their fold toggle: "Next step" is also a label in the key figures. */
  const card = k => 'toggleFold(&quot;' + k + '&quot;)';
  const order = ['record-head', 'op-keys', card('opp:stages'), card('opp:next'), card('opp:notes'), card('opp:details'), card('opp:people')].map(s => h.indexOf(s));
  assert.ok(order.every(i => i >= 0), order.join(','));
  assert.deepStrictEqual(order.slice().sort((x, y) => x - y), order, order.join(','));
  assert.ok(h.includes('No next step set') && h.includes('No account notes yet'));
});
test('Next step and Account notes are one equal-height row of their own', () => {
  const h = run({}).content;
  const row = h.slice(h.indexOf('op-two op-pair'), h.indexOf('op-bottom'));
  const card = k => 'toggleFold(&quot;' + k + '&quot;)';
  assert.ok(row.includes(card('opp:next')) && row.includes(card('opp:notes')), 'both in the pair row');
  assert.ok(!row.includes(card('opp:stages')) && !row.includes(card('opp:details')) && !row.includes('op-keys'), 'and nothing else');
  const css = read('styles.css');
  assert.ok(/\.op-pair\{align-items:stretch\}/.test(css), 'the row stretches both to the taller one');
});

console.log('\nNext step');
const steps = [
  { id: 's1', offtakerId: 'f', stage: 'outreach', kind: 'step', body: 'Find the CFO', dueDate: '2026-10-09', doneAt: '', author: 'dino', createdAt: '2026-10-02T00:00:00Z' },
  { id: 's2', offtakerId: 'f', stage: 'online-meeting', kind: 'step', body: 'Send the indicative tariff', dueDate: '2026-10-15', doneAt: '', author: 'dino', createdAt: '2026-10-08T00:00:00Z' },
  { id: 's3', offtakerId: 'f', stage: 'outreach', kind: 'step', body: 'Send the one-pager', dueDate: '2026-10-01', doneAt: '2026-10-01T10:00:00Z', author: 'dino', createdAt: '2026-09-30T00:00:00Z' },
];
test('open steps soonest first, the first highlighted, each with its due date; done ones struck through', () => {
  const h = run({ stageItems: steps }).content;
  const order = [...h.matchAll(/class="op-ns( lead| done)?"[\s\S]*?class="op-ns-t">([^<]*)/g)].map(m => (m[1] || '').trim() + ':' + m[2]);
  assert.deepStrictEqual(order, ['lead:Find the CFO', ':Send the indicative tariff', 'done:Send the one-pager']);
  assert.ok(h.includes('Overdue · 9 Oct 2026') && h.includes('Due 15 Oct 2026') && h.includes('>Done<'));
});
test('the key figures show the next step and when it is due', () => {
  const h = run({ stageItems: steps }).content;
  const k = h.slice(h.indexOf('op-keys'), h.indexOf('op-keys') + 3000);
  assert.ok(/Next step<\/div><div class="op-kv">Find the CFO <span class="op-due late">Overdue · 9 Oct 2026/.test(k));
});
test('adding a step needs words and a date, and files it on the current stage', () => {
  const o = run({}, (ctx, inputs) => {
    inputs['op-ns-text'] = 'Book the site visit';
    vm.runInContext('addNextStep("f")', ctx);
    assert.strictEqual(vm.runInContext('state.stageItems.length', ctx), 0, 'no date, nothing saved');
    inputs['op-ns-due'] = '2026-10-20';
    vm.runInContext('addNextStep("f")', ctx);
  });
  assert.strictEqual(o.pushed.length, 1);
  assert.deepStrictEqual([o.pushed[0].kind, o.pushed[0].stage, o.pushed[0].body, o.pushed[0].dueDate], ['step', 'online-meeting', 'Book the site visit', '2026-10-20']);
  assert.ok(o.toasts[0].includes('due by'));
});
test('ticking a step done saves it; a viewer cannot', () => {
  const o = run({ stageItems: steps.slice() }, ctx => vm.runInContext('toggleStepDone("s1")', ctx));
  assert.ok(o.pushed[0].doneAt, 'done');
  const v = run({ role: 'viewer', stageItems: steps.slice() }, ctx => vm.runInContext('toggleStepDone("s1")', ctx));
  assert.strictEqual(v.pushed.length, 0);
});

console.log('\nAccount notes and stage notes');
const notes = [
  { id: 'n1', offtakerId: 'f', stage: 'account', kind: 'account-note', body: 'Net zero by 2050.', author: 'dino', createdAt: '2026-10-02T00:00:00Z' },
  { id: 'n2', offtakerId: 'f', stage: 'outreach', kind: 'note', body: 'Engineering never answers.', author: 'dino', createdAt: '2026-10-03T00:00:00Z' },
  { id: 'n3', offtakerId: 'f', stage: 'online-meeting', kind: 'note', body: 'They care about price certainty.', author: 'dino', createdAt: '2026-10-08T00:00:00Z' },
];
test('account notes show whatever the stage; stage notes only on their own stage', () => {
  const h = run({ stageItems: notes }).content;
  assert.ok(h.includes('Net zero by 2050.'));
  assert.ok(h.includes('They care about price certainty.') && !h.includes('Engineering never answers.'), 'the current stage\'s notes');
  const out = run({ stageItems: notes, oppStage: 'outreach', oppStageFor: 'f' }).content;
  assert.ok(out.includes('Engineering never answers.') && !out.includes('They care about price certainty.'), 'the Outreach tab\'s notes');
});
test('a stage note is filed on the stage that is open', () => {
  const o = run({ oppStage: 'outreach', oppStageFor: 'f' }, (ctx, inputs) => { inputs['op-sn-text'] = 'Try the COO.'; vm.runInContext('addOppNote("f","note","outreach","op-sn-text")', ctx); });
  assert.deepStrictEqual([o.pushed[0].kind, o.pushed[0].stage, o.pushed[0].body], ['note', 'outreach', 'Try the COO.']);
});
test('every next step and note says who added it and when', () => {
  const h = run({ stageItems: steps.concat(notes) }).content;
  assert.ok(h.includes('Set at Online meeting · by dino · 8 Oct 2026'), 'the step\'s byline');
  assert.ok(h.includes('by dino · 2 Oct 2026'), 'the account note\'s byline');
  assert.ok(h.includes('by dino · 8 Oct 2026<'), 'the stage note\'s byline');
});
test('re-ticking a hand tick keeps when it was first ticked and by whom', () => {
  const first = { id: 'chk_f_online-meeting_0', offtakerId: 'f', stage: 'online-meeting', kind: 'check', body: '0', doneAt: '', author: 'karen', createdAt: '2026-10-01T00:00:00Z' };
  const o = run({ stageItems: [first] }, ctx => vm.runInContext('toggleOppCheck("f","online-meeting",0,false)', ctx));
  assert.deepStrictEqual([o.pushed[0].createdAt, o.pushed[0].author], ['2026-10-01T00:00:00Z', 'karen']);
  assert.ok(o.pushed[0].doneAt, 'and it is ticked');
});
test('an item from before authors were recorded says so rather than guessing', () => {
  const h = run({ stageItems: [Object.assign({}, steps[1], { author: '' }), Object.assign({}, notes[0], { author: null })] }).content;
  assert.ok(h.includes('Set at Online meeting · not recorded · 8 Oct 2026'), 'the step');
  assert.ok(h.includes('not recorded · 2 Oct 2026'), 'the note');
  assert.ok(!h.includes('— · '), 'no dash for a missing author');
});

console.log('\nSales stages');
test('seven tabs; the current one marked and open by default', () => {
  const h = run({}).content;
  const tabs = [...h.matchAll(/class="op-tab( done)?( now)?( view)?"[^>]*>([^<]*)<span>([^<]*)/g)].map(m => (m[2] ? '*' : '') + (m[3] ? '>' : '') + m[4] + ' (' + m[5] + ')');
  assert.strictEqual(tabs.length, 7);
  assert.strictEqual(tabs[1], '*>Online meeting (current)');
  assert.ok(tabs[0].startsWith('Outreach ('), tabs[0]);
});
test('clicking a tab opens that stage and does not move the account', () => {
  const o = run({}, ctx => { vm.runInContext('viewOppStage("outreach")', ctx); });
  assert.deepStrictEqual(o.moved, []);
  assert.ok(o.content.includes('To move on from Outreach') && o.content.includes('a stage already passed'));
  assert.ok(o.content.includes('Move the account to Outreach'), 'moving is a separate button');
});
test('on the current stage the button completes it and moves to the next', () => {
  assert.ok(run({}).content.includes('Mark stage complete, move to In-person meeting'));
  const o = run({}, ctx => vm.runInContext('moveOppStage("f","in-person")', ctx));
  assert.deepStrictEqual(o.moved, [['f', 'in-person']]);
  assert.ok(o.content.includes('To move on from In-person meeting'), 'the page opens the stage it moved to');
});
test('the checklist ticks from the record, says so, and can be ticked by hand either way', () => {
  const h = run({}).content;
  const ticks = [...h.matchAll(/class="op-ck"><button type="button" class="op-tick( on)?"[\s\S]*?<span>([^<]*)(?:<span class="op-why">([^<]*))?/g)].map(m => (m[1] ? '✓ ' : '  ') + m[2].trim() + (m[3] ? ' [' + m[3] + ']' : ''));
  assert.deepStrictEqual(ticks, ['✓ An online meeting held [from activity]', '✓ A decision maker on file [from activity]', '  An in-person meeting or site visit held']);
  const o = run({}, ctx => vm.runInContext('toggleOppCheck("f","online-meeting",2,false)', ctx));
  assert.deepStrictEqual([o.pushed[0].id, o.pushed[0].kind, !!o.pushed[0].doneAt], ['chk_f_online-meeting_2', 'check', true]);
  const handed = run({ stageItems: [Object.assign({}, o.pushed[0]), { id: 'chk_f_online-meeting_0', offtakerId: 'f', stage: 'online-meeting', kind: 'check', body: '0', doneAt: '' }] }).content;
  assert.ok(/aria-label="Untick: An in-person meeting or site visit held"[\s\S]*?ticked by hand/.test(handed), 'ticked by hand');
  assert.ok(/aria-label="Tick: An online meeting held"[\s\S]*?ticked by hand/.test(handed), 'and unticked by hand, over the record');
});
test('activity in this stage: only what was logged while the account sat there', () => {
  const box = s => s.slice(s.indexOf('Activity in this stage'), s.indexOf('op-box op-all'));
  const cur = run({}).content;
  assert.ok(box(cur).includes('Intro call with Thandi.') && box(cur).includes('from Outreach to Online meeting'));
  assert.ok(!box(cur).includes('Email to Jan.'));
  const past = run({ oppStage: 'outreach', oppStageFor: 'f' }).content;
  assert.ok(box(past).includes('Email to Jan.') && box(past).includes('First email to Thandi.') && !box(past).includes('Intro call'));
  const future = run({ oppStage: 'proposal', oppStageFor: 'f' }).content;
  assert.ok(box(future).includes('Not reached yet'));
});
test('All activity is under every stage, folded away until opened', () => {
  const shut = run({}).content;
  assert.ok(shut.includes('aria-expanded="false"') && shut.includes('All activity <span class="pf-n">4</span>'));
  assert.ok(!shut.slice(shut.indexOf('op-box op-all')).includes('Email to Jan.'), 'folded');
  const opened = run({}, ctx => vm.runInContext('toggleOppAll()', ctx)).content;
  const all = opened.slice(opened.indexOf('op-box op-all'));
  ['First email to Thandi.', 'Email to Jan.', 'Intro call with Thandi.'].forEach(t => assert.ok(all.includes(t), t));
  assert.ok(all.includes('Chase') && all.includes('Due today'));
  assert.ok(run({ oppStage: 'proposal', oppStageFor: 'f' }).content.includes('op-box op-all'), 'there on a stage not reached too');
});

console.log('\nFolding');
/* The browser store and the page re-render, as the real app has them, inside the sandbox. */
const withStore = ctx => vm.runInContext('var stored = []; function lsSet(k, v) { stored.push([k, v]); } function render() { renderOpportunity(); }', ctx);
const toggleOf = (key, open) => 'aria-expanded="' + open + '" onclick="toggleFold(&quot;' + key + '&quot;)"';
const FOLDABLE = ['opp:next', 'opp:notes', 'opp:stages', 'opp:checks', 'opp:stagenotes', 'opp:stageact', 'opp:details', 'opp:deals', 'opp:history', 'opp:people'];
test('every card below the header folds, and all start open but History', () => {
  const h = run({}).content;
  FOLDABLE.forEach(k => assert.ok(h.includes(toggleOf(k, true)), k));
  assert.deepStrictEqual([...h.matchAll(/aria-expanded="false" onclick="toggleFold\(&quot;([^&]*)&quot;\)"/g)].map(m => m[1]), ['opp:changes']);
});

console.log('\nHistory');
const at = h => '2026-10-1' + h + 'T12:00:00+00:00';
const CHANGES = [
  { id: 3, at: at(4), author_email: 'lebo@aeeg.co.za', agent: null, table_name: 'aee_contacts', record_id: 'c1', offtaker_id: 'f', kind: 'edited', fields: { title: { old: 'CFO', new: 'VP Sustainability' } } },
  { id: 2, at: at(3), author_email: 'thabo@aeeg.co.za', agent: 'apollo-daily', table_name: 'aee_found_contacts', record_id: 'x', offtaker_id: 'f', kind: 'created', fields: { first: { new: 'Jan' } } },
  { id: 1, at: at(2), author_email: null, agent: null, table_name: 'aee_contacts', record_id: 'c9', offtaker_id: 'f', kind: 'deleted', deleted_row: { first: 'Old', last: 'Person', title: 'COO' } },
];
const opened = over => run(Object.assign({ foldedCards: ['opp:changes'] }, over));
const historyOf = h => h.slice(h.indexOf('toggleFold(&quot;opp:changes&quot;)'));
test('History sits at the bottom, folded, and fetches nothing until opened', () => {
  const o = run({});
  const h = o.content;
  assert.ok(h.indexOf('toggleFold(&quot;opp:changes&quot;)') > h.indexOf('op-bottom'), 'after the two columns');
  assert.ok(/>History</.test(historyOf(h)));
  assert.ok(!o.fetched, 'a folded History costs nothing');
});
test('opening History fetches that account\'s changes, newest first', () => {
  const o = opened({});
  assert.deepStrictEqual(o.fetched, ['aee_changes?select=*&offtaker_id=eq.f&order=at.desc,id.desc']);
  assert.ok(/Loading/.test(historyOf(o.content)));
});
test('the changes read as in the Change log: when, who and what, agents as themselves', () => {
  const hist = historyOf(opened({ accountHistory: { id: 'f', rows: CHANGES, loadedAt: Date.now() } }).content);
  const lines = [...hist.matchAll(/<div class="hist-row">([\s\S]*?)<\/div>\s*(?=<div class="hist-row">|<div class="hist-foot|<\/div>)/g)].map(m => m[1]);
  assert.strictEqual(lines.length, 3, hist);
  assert.ok(/lebo/.test(lines[0]) && /Title CFO → VP Sustainability/.test(lines[0]) && /14 Oct 2026/.test(lines[0]), lines[0]);
  assert.ok(/apollo-daily \(run as thabo\)/.test(lines[1]) && /added a find “Jan”/.test(lines[1]), lines[1]);
  assert.ok(/not recorded/.test(lines[2]) && /deleted a contact “Old Person”/.test(lines[2]) && /What was deleted/.test(lines[2]), lines[2]);
  assert.strictEqual(opened({ accountHistory: { id: 'f', rows: CHANGES, loadedAt: Date.now() } }).fetched, undefined, 'fresh: not fetched again');
});
test('an account with no recorded changes says so', () => {
  assert.ok(/No changes recorded for this account yet/.test(historyOf(opened({ accountHistory: { id: 'f', rows: [], loadedAt: Date.now() } }).content)));
});
test('a long history shows the latest 50 and offers the rest in the Change log, for admins', () => {
  const many = Array.from({ length: 60 }, (_, i) => Object.assign({}, CHANGES[0], { id: 100 - i }));
  const hist = historyOf(opened({ accountHistory: { id: 'f', rows: many, loadedAt: Date.now() } }).content);
  assert.strictEqual((hist.match(/class="hist-row"/g) || []).length, 50);
  assert.ok(/data-admin-only[^>]*onclick="openChangeLogFor\(&quot;f&quot;\)"[^>]*>See all 60 in the Change log/.test(hist), hist.slice(-400));
});
test('viewers see History too', () => {
  const hist = historyOf(opened({ role: 'viewer', accountHistory: { id: 'f', rows: CHANGES, loadedAt: Date.now() } }).content);
  assert.strictEqual((hist.match(/class="hist-row"/g) || []).length, 3);
});
test('folding Activity in this stage and Stage history hides their lines but keeps the titles and counts', () => {
  const open = run({}).content;
  const folded = run({ foldedCards: ['opp:stageact', 'opp:history'] }).content;
  const actOf = h => h.slice(h.indexOf('toggleFold(&quot;opp:stageact&quot;)'), h.indexOf('op-box op-all'));
  assert.ok(actOf(open).includes('pp-ti') && !actOf(folded).includes('pp-ti'), 'the stage activity folds');
  assert.ok(open.includes('class="op-hist"') && !folded.includes('class="op-hist"'), 'the stage history folds');
  assert.ok(folded.includes('Activity in this stage <span class="pf-n">') && folded.includes('Stage history <span class="pf-n">1</span>'), 'titles and counts stay');
});
test('a folded card keeps its header buttons', () => {
  const h = run({ foldedCards: ['opp:stages', 'opp:deals', 'opp:people'] }).content;
  ['Log touch', 'openAddDeal(', 'openAddContact('].forEach(t => assert.ok(h.includes(t), t));
  assert.ok(!h.includes('class="op-tab'), 'the stage tabs fold with Sales stages');
  assert.ok(!h.includes('Ferro 40 MW'), 'the MW opportunities fold');
});
test('a fold is remembered under one key in the browser, and opens again', () => {
  let saved;
  const o = run({}, ctx => { withStore(ctx); vm.runInContext('toggleFold("opp:history"); toggleFold("opp:details")', ctx); saved = vm.runInContext('stored', ctx); });
  assert.ok(o.content.includes(toggleOf('opp:history', false)) && o.content.includes(toggleOf('opp:details', false)));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(saved)), [['folded_cards', ['opp:history']], ['folded_cards', ['opp:history', 'opp:details']]]);
  const back = run({}, ctx => { withStore(ctx); vm.runInContext('toggleFold("opp:history"); toggleFold("opp:history")', ctx); });
  assert.ok(back.content.includes(toggleOf('opp:history', true)));
});
test('Add next step on a folded Next step opens the card with the form showing', () => {
  const o = run({ foldedCards: ['opp:next'] }, ctx => { withStore(ctx); vm.runInContext('toggleOppStepForm()', ctx); });
  assert.ok(o.content.includes('id="op-ns-text"'));
  assert.ok(o.content.includes(toggleOf('opp:next', true)));
});

console.log('\nUnderneath');
test('details, MW opportunities and stage history on the left, stakeholders on the right', () => {
  const h = run({}).content;
  const bottom = h.slice(h.indexOf('op-bottom'));
  ['Annual load', 'Peak demand', 'Wheeling', 'Current tariff'].forEach(t => assert.ok(bottom.includes('<dt>' + t + '</dt>'), t));
  assert.ok(bottom.includes('Ferro 40 MW') && bottom.includes('Stage history'));
  assert.ok(/Sustainability \/ ESG[\s\S]*?Thandi M[\s\S]*?Engaging/.test(bottom) && bottom.includes('CFO / finance'));
});

console.log('\nWhere it does not apply');
test('a lead has no sales process, so its page is the company record', () => {
  assert.deepStrictEqual(run({ detailId: 'l' }).navs, [['detail', 'l']]);
});
test('an unknown id goes back to the Pipeline', () => {
  assert.deepStrictEqual(run({ detailId: 'nope' }).navs, [['pipeline', undefined]]);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
