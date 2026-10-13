/* The opportunity page (js/views-opportunity.js): what a row on the Pipeline opens.
 *
 * Runs the real page against a small stub book with the real stage list, playbook and
 * outreach rules, no browser, and checks what a person would read on it.
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

function run(over) {
  const out = { page: null, content: '', navs: [] };
  const state = Object.assign({
    view: 'opportunity', detailId: 'f', role: 'admin', province: '',
    offtakers: [ferro, lead],
    deals: [{ id: 'd1', offtakerId: 'f', name: 'Ferro 40 MW', mw: 40, tariff: 1.1, tenor: 20, stage: 'online-meeting', probability: 10, closeDate: '2027-06-30' }],
    contacts: [
      { id: 'c1', offtakerId: 'f', first: 'Thandi', last: 'M', title: 'VP Sustainability', role: 'decision' },
      { id: 'c2', offtakerId: 'f', first: 'Jan', last: 'W', title: 'Head of Engineering', role: 'technical' },
    ],
    interactions: [
      { id: 'i1', offtakerId: 'f', date: '2026-10-06', type: 'email', channel: 'email', contactIds: ['c2'], touchNo: 1, outcome: 'sent', followUpOn: '2026-10-13', summary: 'Email to Jan.', createdAt: '1' },
      { id: 'i2', offtakerId: 'f', date: '2026-10-08', type: 'meeting', channel: 'online-meeting', contactIds: ['c1'], outcome: 'held', summary: 'Intro call with Thandi.', createdAt: '2' },
      { id: 'i3', offtakerId: 'f', date: '2026-10-08', type: 'stage change', summary: 'Sales stage moved from Outreach to Online meeting. Online meeting held on 2026-10-08.', createdAt: '3' },
    ],
    projects: [],
  }, over);
  const ctx = vm.createContext({
    ...scopeStubs(state), console, state, esc, num, icon: () => '', jsStr: v => esc(JSON.stringify(String(v == null ? '' : v))),
    fmtNum: v => String(Math.round(num(v))), fmtR: v => 'R' + Math.round(num(v) / 1e6) + 'm', relTime: () => 'recently', sectorName: s => s,
    todayISO: () => '2026-10-13', getOfftaker: id => state.offtakers.find(o => o.id === id) || {},
    contactsFor: id => state.contacts.filter(c => c.offtakerId === id), dealsFor: id => state.deals.filter(d => d.offtakerId === id),
    logsForAccount: o => state.interactions.filter(i => i.offtakerId === o.id).sort((a, b) => b.date.localeCompare(a.date)),
    inPipeline: o => !!o.sfStage, isUnworked: () => false, isStalled: () => false, stageDwell: () => ({ days: 5 }),
    dwellChipHtml: () => '<span class="chip">5d</span>', dwellSentenceHtml: () => '', sfStageBadge: o => '<span class="badge">' + o.sfStage + '</span>',
    sfPathHtml: o => '<div class="sfpath">PATH ' + o.sfStage + '</div>', weightedValue: d => num(d.mw) * 1e6, dealLifetimeValue: d => num(d.mw) * 1e7,
    nearestProject: () => null, distanceLabel: () => '—', sectorIcon: () => '', WHEELING_LABEL: { likely: 'Likely' },
    recordCardHtml: (ic, name, chips, desc, acts) => '<div class="record-head"><h3>' + esc(name) + '</h3><div class="rh-chips">' + chips + '</div><div class="rh-actions">' + acts + '</div></div>',
    entryMetaText: i => i.type, AE_LADDER: [{ k: 'sustain', label: 'Sustainability / ESG', re: /sustain/i }, { k: 'eng', label: 'Engineering', re: /engineer/i }, { k: 'finance', label: 'CFO / finance', re: /cfo|financ/i }],
    aeSeatMatch: (s, c) => s.re.test((c && c.title) || ''),
    setPage: (t, s, a, opts) => { out.page = { t, s, a, opts }; }, setContent: h => { out.content = h; }, nav: (v, x) => out.navs.push([v, x && x.id]),
  });
  vm.runInContext(read('data/seed.js') + '\n' + read('js/followups.js') + '\n' + read('js/outreach.js') + '\n' +
    read('js/views-dashboard.js').match(/function isLiveDeal[\s\S]*?\n}/)[0] + '\n' +
    /* core.js's stage helpers, over the real stage list */
    'function sfStageFor(o) { return o.sfStage || "outreach"; }\n' +
    'function sfStageOf(id) { return SF_STAGES.find(s => s.id === id) || null; }\n' +
    'function sfStageIndex(id) { return SF_STAGES.findIndex(s => s.id === id); }\n' +
    'function stageProbability(id) { return (sfStageOf(id) || {}).prob; }\n' +
    read('js/views-pipeline.js') + '\n' + read('js/views-opportunity.js') + '\nrenderOpportunity();', ctx);
  return out;
}

console.log('\nThe page');
test('it is a record page named for the opportunity, with its place in the header', () => {
  const o = run({});
  assert.strictEqual(o.page.t, 'Ferro');
  assert.ok(o.page.s.includes('eMalahleni') && o.page.opts.record);
});
test('the header carries the stage, who to chase, and the actions', () => {
  const h = run({}).content;
  assert.ok(h.includes('class="badge">online-meeting'));
  assert.ok(h.includes('Chase Jan · today'), 'Jan is owed a follow-up today');
  ['Log touch', 'Edit opportunity', 'Org map', 'Company record'].forEach(t => assert.ok(h.includes(t), t));
});
test('the key figures: stage, MW, weighted value, probability, close date, load, next step', () => {
  const h = run({}).content;
  ['Stage', 'Open MW', 'Weighted value', 'Probability', 'Close date', 'Annual load', 'Next step'].forEach(t => assert.ok(h.includes('<div class="op-kl">' + t + '</div>'), t));
  assert.ok(h.includes('Online meeting · 5d') && h.includes('40 MW') && h.includes('10%') && h.includes('30 Jun 2027') && h.includes('900 GWh'));
});

console.log('\nThe path and what it takes to move on');
test('the sales path, the stage\'s exit checklist and its guidance', () => {
  const h = run({}).content;
  assert.ok(h.includes('PATH online-meeting'));
  assert.ok(h.includes('To move on from Online meeting'));
  assert.ok(h.includes('Guidance for this stage') && h.includes('Agree the next meeting before you hang up.'));
});
test('only what the record shows is ticked', () => {
  const h = run({}).content;
  const ticks = [...h.matchAll(/class="op-check( on)?"[^>]*>[\s\S]*?<span>([^<]*)/g)].map(m => (m[1] ? '✓ ' : '  ') + m[2]);
  assert.deepStrictEqual(ticks, ['✓ An online meeting held', '✓ A decision maker on file', '  An in-person meeting or site visit held']);
});
test('at Outreach, three people reached and a reply tick their items', () => {
  const extra = [{ id: 'c3', offtakerId: 'f', first: 'Pat', last: 'R', title: 'CFO', role: 'decision' }];
  const logs = [
    { id: 'a', offtakerId: 'f', date: '2026-10-01', type: 'email', channel: 'email', contactIds: ['c1', 'c2', 'c3'], outcome: 'sent', summary: 'x', createdAt: '1' },
    { id: 'b', offtakerId: 'f', date: '2026-10-02', type: 'email', channel: 'email', contactIds: ['c3'], outcome: 'replied', summary: 'y', createdAt: '2' },
  ];
  const h = run({ offtakers: [Object.assign({}, ferro, { sfStage: 'outreach' })], interactions: logs,
    contacts: [{ id: 'c1', offtakerId: 'f', first: 'T', last: 'M', title: 'VP Sustainability' }, { id: 'c2', offtakerId: 'f', first: 'J', last: 'W', title: 'Head of Engineering' }].concat(extra) }).content;
  const ticks = [...h.matchAll(/class="op-check( on)?"/g)].map(m => !!m[1]);
  assert.deepStrictEqual(ticks, [true, true, false]);
});

console.log('\nThe three columns');
test('details, the MW opportunities and the stage history', () => {
  const h = run({}).content;
  const about = h.slice(h.indexOf('rg-about'), h.indexOf('rg-main'));
  ['Annual load', 'Peak demand', 'Supply', 'Wheeling', 'Current tariff', 'Nearest site'].forEach(t => assert.ok(about.includes('<dt>' + t + '</dt>'), t));
  assert.ok(about.includes('Ferro 40 MW') && about.includes('40 MW · R1.10/kWh · 20 yrs'));
  assert.ok(about.includes('Stage history') && about.includes('from Outreach to Online meeting'));
});
test('activity: who to chase, then every touch and stage move, newest first', () => {
  const h = run({}).content;
  const main = h.slice(h.indexOf('rg-main'), h.indexOf('rg-side'));
  assert.ok(main.includes('Chase') && main.includes('Jan W') && main.includes('Due today'));
  assert.ok(main.indexOf('Intro call with Thandi.') < main.indexOf('Email to Jan.'), 'newest first');
});
test('stakeholders seat by seat, with where each stands and the seats nobody fills', () => {
  const h = run({}).content;
  const side = h.slice(h.indexOf('rg-side'));
  assert.ok(side.includes('2 of 2 reached · 1 engaging'));
  assert.ok(/Sustainability \/ ESG[\s\S]*?Thandi M[\s\S]*?Engaging/.test(side));
  assert.ok(/Engineering[\s\S]*?Jan W[\s\S]*?Contacted/.test(side));
  assert.ok(side.includes('Nobody on file:') && side.includes('CFO / finance'));
});

console.log('\nWhere it does not apply');
test('a lead has no sales process, so its page is the company record', () => {
  const o = run({ detailId: 'l' });
  assert.deepStrictEqual(o.navs, [['detail', 'l']]);
});
test('an unknown id goes back to the Pipeline', () => {
  assert.deepStrictEqual(run({ detailId: 'nope' }).navs, [['pipeline', undefined]]);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
