/* The docs say what the repo is. The README's file map had drifted six scripts behind, and its test
 * count had gone stale, because nothing noticed. This checks that every script the app loads is in
 * the map, that every path the map names exists, that the test count is right, and that the glossary
 * and ADR-0001 carry the terms and the decision the layout work added.
 *
 *   node tests/docs.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const readme = read('README.md'), glossary = read('GLOSSARY.md'), adr = read('docs/adr/0001-wireframe-layout-not-engine.md'), index = read('index.html');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

/* The README's "Layout" code block: the left-hand path of each line. */
const block = readme.slice(readme.indexOf('## Layout')).match(/```\n([\s\S]*?)\n```/)[1];
const mapped = block.split('\n').map(l => l.match(/^(\S+)\s{2,}\S/)).filter(Boolean).map(m => m[1]);

console.log('\nREADME');
test('every script index.html loads has a line in the file map', () => {
  const loaded = [...index.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
  assert.ok(loaded.length > 30, 'the scripts were found');
  loaded.forEach(s => assert.ok(mapped.includes(s) || (s.startsWith('animations') && mapped.includes('animations.css/.js')), s + ' is not in the README file map'));
});
test('every script in js/ is loaded by index.html, so none is left behind', () => {
  fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).forEach(f =>
    assert.ok(index.includes('<script src="js/' + f + '">'), 'js/' + f + ' is not loaded'));
});
test('every path the file map names exists', () => {
  mapped.filter(p => !p.includes('/.')).forEach(p => assert.ok(fs.existsSync(path.join(ROOT, p)), p + ' does not exist'));
});
test('the README says how many test files there are', () => {
  const n = fs.readdirSync(path.join(ROOT, 'tests')).filter(f => f.endsWith('.test.js')).length;
  const said = Number((readme.match(/There are (\d+) files\./) || [])[1]);
  assert.strictEqual(said, n, 'README says ' + said + ' test files; there are ' + n);
});

console.log('\nGlossary and ADR');
test('the glossary defines the terms the layout work added', () => {
  ['Province scope', 'Selection bar', 'Drawer', 'Wizard', 'Follow-up'].forEach(t =>
    assert.ok(new RegExp('^\\*\\*' + t + '\\*\\*:\\n', 'm').test(glossary), t + ' is not defined'));
});
test('the glossary says what each of them is, in the app\'s own words', () => {
  assert.ok(/\*\*Province scope\*\*:\n[^\n]*remembered on this device/.test(glossary));
  assert.ok(/\*\*Selection bar\*\*:\n[^\n]*Export selected/.test(glossary));
  assert.ok(/\*\*Drawer\*\*:\n[^\n]*new records only/.test(glossary));
  assert.ok(/\*\*Wizard\*\*:\n[^\n]*Import CSV/.test(glossary));
  assert.ok(/\*\*Follow-up\*\*:\n[^\n]*target close date[^\n]*revisit date/.test(glossary));
});
test('ADR-0001 records that the four exclusions were reversed, and what stayed the same', () => {
  assert.ok(adr.includes('## Amended 2026-10-11'));
  ['province scope', 'bulk select', 'per-page export', 'full-page import'].forEach(t => assert.ok(adr.includes(t), 'the amendment names ' + t));
  assert.ok(adr.includes('all four exclusions were reversed'));
  assert.ok(/blue palette is still not adopted/.test(adr) && /layout reference only/.test(adr));
  assert.ok(adr.startsWith('# Take WireFrame\'s layout, not its engine') && adr.includes('Decided 2026-10-10'), 'the decision itself is amended, not replaced');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
