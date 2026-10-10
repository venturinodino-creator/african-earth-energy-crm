/* The shell contract: the frame every page sits in.
 *
 * Checks what a user would meet, not how it is styled: every sidebar link and
 * bottom-bar tab leads to a real page, the page header receives the title,
 * subtitle and actions a page supplies, + New offers the create actions that
 * exist and is admin-only, and the account menu carries what the old user badge
 * did. Reads index.html and the scripts as text and runs the small shell
 * functions in a stub document, so no browser is needed.
 *
 *   node tests/shell-layout.test.js
 *
 * No framework and no dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = read('index.html');
const core = read('js/core.js');
const allJs = fs.readdirSync(path.join(ROOT, 'js')).map(f => read('js/' + f)).join('\n');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

/* The router: the keys of the views table inside render(). */
const routerBlock = /function render\(\) \{\s*const views = \{([\s\S]*?)\n  \};/.exec(core);
const routerKeys = new Set([...routerBlock[1].matchAll(/^\s*'?([a-z-]+)'?\s*:/gm)].map(m => m[1]));

const between = (src, open, close) => {
  const a = src.indexOf(open); if (a < 0) return '';
  const b = src.indexOf(close, a); return b < 0 ? src.slice(a) : src.slice(a, b);
};
const sidebar = between(html, '<nav class="sb"', '</nav>');
const topbar = between(html, '<div class="topbar"', '<header class="page-head"');
const pageHead = between(html, '<header class="page-head"', '</header>');
const bottomBar = between(html, '<nav class="bottom-bar"', '</nav>');

/* Pull one top-level function out of core.js and run it against stubs. */
function fn(name, stubs) {
  const m = new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(core);
  if (!m) throw new Error(name + ' not found in core.js');
  const ctx = vm.createContext(Object.assign({ console }, stubs));
  vm.runInContext(m[0], ctx);
  return ctx[name];
}
/* A stub document that remembers what was written to each id. */
function stubDoc() {
  const els = {};
  const el = id => els[id] || (els[id] = { id, textContent: '', innerHTML: '', style: {}, hidden: false, classList: {
    set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); },
    toggle(c, on) { const want = on === undefined ? !this.set.has(c) : on; want ? this.set.add(c) : this.set.delete(c); return want; },
    contains(c) { return this.set.has(c); } } });
  return { els, document: { getElementById: el, querySelector: () => null, querySelectorAll: () => [] } };
}

console.log('\nSidebar');
const EXPECTED_VIEWS = ['dashboard', 'pipeline', 'offtakers', 'contacts', 'prospects', 'agenthq', 'municipalities', 'news',
  'projects', 'regions', 'map', 'sectors', 'calculator', 'playbook', 'analytics', 'activity'];
const sidebarViews = [...sidebar.matchAll(/data-view="([a-z-]+)"/g)].map(m => m[1]);
test('every current link is still in the sidebar, once', () => {
  EXPECTED_VIEWS.forEach(v => assert.strictEqual(sidebarViews.filter(x => x === v).length, 1, v + ' should appear exactly once'));
});
test('every sidebar link leads to a real page', () => {
  sidebarViews.forEach(v => assert.ok(routerKeys.has(v), v + ' has no router entry'));
});
test('the data actions and both count badges are kept', () => {
  ["openImport('contacts')", "openImport('offtakers')", 'exportOfftakers()', 'id="nav-offtakers-badge"', 'id="nav-activity-badge"', 'Synced to Supabase']
    .forEach(s => assert.ok(sidebar.includes(s), 'sidebar lost ' + s));
});
test('the sidebar is light: it no longer reads off the deep-earth band', () => {
  const css = read('styles.css');
  const rule = /\n\.sb\{[\s\S]*?\}/.exec(css)[0];
  assert.ok(!/var\(--earth\)/.test(rule), '.sb still paints the --earth band');
});

console.log('\nTop bar');
test('the top bar holds search, + New and the account, and no page title', () => {
  assert.ok(topbar.includes('id="global-search-input"'));
  assert.ok(topbar.includes('id="new-menu"'));
  assert.ok(topbar.includes('id="user-badge"'));
  assert.ok(!topbar.includes('page-title'), 'page title still in the top bar');
  assert.ok(!topbar.includes('mobile-toggle'), 'hamburger still in the top bar');
});
test('+ New offers the four create actions, each of which exists', () => {
  const menu = between(html, 'id="new-menu-wrap"', 'id="user-badge"');
  ['openAddOfftaker()', 'openAddContact()', 'openAddDeal()', 'openLogInteraction()'].forEach(call => {
    assert.ok(menu.includes('onclick="' + call.replace('()', '()') + '"') || menu.includes(call), '+ New lacks ' + call);
    const name = call.replace('()', '');
    assert.ok(new RegExp('function ' + name + '\\(').test(allJs), name + ' is not defined');
  });
});
test('+ New is admin-only', () => {
  assert.ok(/id="new-menu-wrap"[^>]*data-admin-only|data-admin-only[^>]*id="new-menu-wrap"/.test(html), 'wrapper is not data-admin-only');
});

console.log('\nPage header');
test('the page header carries title, subtitle, actions and the way back', () => {
  ['id="page-title"', 'id="page-sub"', 'id="page-actions"', 'id="back-to-main"'].forEach(s => assert.ok(pageHead.includes(s), 'page header lacks ' + s));
  assert.ok(html.indexOf('<header class="page-head"') < html.indexOf('id="content"'), 'page header must come before the content');
});
test('setPage writes title, subtitle and actions into the page header', () => {
  const d = stubDoc();
  fn('setPage', { document: d.document })('Pipeline', 'Two boards', '<button>Go</button>');
  assert.strictEqual(d.els['page-title'].textContent, 'Pipeline');
  assert.strictEqual(d.els['page-sub'].textContent, 'Two boards');
  assert.strictEqual(d.els['page-actions'].innerHTML, '<button>Go</button>');
});
test('setPage with no subtitle or actions clears the old ones', () => {
  const d = stubDoc();
  const set = fn('setPage', { document: d.document });
  set('A', 'sub', '<b>x</b>'); set('B');
  assert.strictEqual(d.els['page-sub'].textContent, '');
  assert.strictEqual(d.els['page-actions'].innerHTML, '');
});

console.log('\nBreadcrumb');
{
  const book = { a: { id: 'a', name: 'Alpha Mining', short: 'Alpha' }, b: { id: 'b', name: 'Beta Steel', short: '' } };
  const stubs = (view, id, inPipe) => ({
    state: { view, detailId: id }, getOfftaker: x => book[x] || {}, inPipeline: o => !!inPipe[o.id],
    esc: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), jsStr: v => JSON.stringify(String(v)).replace(/"/g, '&quot;'),
  });
  /* Array.from: an array built inside the vm has the vm's prototype, which deepStrictEqual rejects. */
  const crumbs = (view, id, inPipe) => Array.from(fn('crumbsFor', stubs(view, id, inPipe))(view));
  test('a lead sits under Off-taker Prospects; a worked account under Pipeline', () => {
    assert.deepStrictEqual(crumbs('detail', 'a', {}).map(c => c.label), ['Off-taker Prospects', 'Alpha']);
    assert.deepStrictEqual(crumbs('detail', 'b', { b: true }).map(c => c.label), ['Pipeline', 'Beta Steel']);
  });
  test('the org map adds a step and links back to the account', () => {
    const c = crumbs('org-map', 'a', {});
    assert.deepStrictEqual(c.map(x => x.label), ['Off-taker Prospects', 'Alpha', 'Org map']);
    assert.ok(/nav\('detail'/.test(c[1].on), 'account crumb links to the account');
    assert.ok(!c[2].on, 'the current page is not a link');
  });
  test('a site is under Projects', () => {
    const f = fn('crumbsFor', Object.assign(stubs('project', null, {}), { state: { view: 'project', projectId: 's1', projects: [{ id: 's1', name: 'Middelburg Solar Farm' }] } }));
    assert.deepStrictEqual(Array.from(f('project')).map(c => c.label), ['Projects', 'Middelburg Solar Farm']);
  });
  test('every other page keeps the plain way back to the Dashboard', () => {
    const c = crumbs('news', null, {});
    assert.deepStrictEqual(c.map(x => x.label), ['Dashboard']);
    assert.strictEqual(c[0].back, true);
    assert.deepStrictEqual(crumbs('dashboard', null, {}), []);
  });
  test('the breadcrumb is drawn into the page header, and a record page hides the duplicate title', () => {
    const d = stubDoc();
    const render = fn('renderBackToMain', Object.assign(stubs('detail', 'a', {}), { document: d.document, crumbsFor: fn('crumbsFor', stubs('detail', 'a', {})) }));
    render();
    const h = d.els['back-to-main'].innerHTML;
    assert.ok(h.includes('Off-taker Prospects') && h.includes('Alpha') && h.includes('class="crumbs"'), h);
    const set = fn('setPage', { document: d.document });
    set('Alpha', 'sub', '', { record: true });
    assert.ok(d.els['page-head'].classList.contains('is-record'));
    set('Pipeline', 'sub', '');
    assert.ok(!d.els['page-head'].classList.contains('is-record'), 'the next page is an ordinary page again');
  });
}

console.log('\nAccount menu');
test('the account menu shows initials, username, role and Sign out', () => {
  const d = stubDoc();
  const set = fn('setUserBadge', { document: d.document, esc: s => String(s), toDisplayName: e => e.split('@')[0], avatarColor: () => '#123', icon: () => '' });
  set('dino@aeeg.co.za', 'admin');
  const h = d.els['user-badge'].innerHTML;
  assert.ok(h.includes('>D<'), 'initial avatar');
  assert.ok(h.includes('dino'), 'username');
  assert.ok(h.includes('Admin'), 'role');
  assert.ok(h.includes('signOut()'), 'sign out');
  set('v@aeeg.co.za', 'viewer');
  assert.ok(d.els['user-badge'].innerHTML.includes('Read only'));
});
test('signed out hides the account menu', () => {
  const d = stubDoc();
  fn('setUserBadge', { document: d.document, esc: String, toDisplayName: String, avatarColor: () => '', icon: () => '' })('', '');
  assert.strictEqual(d.els['user-badge'].style.display, 'none');
});

console.log('\nPhone bottom bar');
test('five tabs: Dashboard, Prospects, Pipeline, Contacts, More', () => {
  const tabs = [...bottomBar.matchAll(/<(?:a|button|div)[^>]*class="bb-tab[^"]*"[^>]*>([\s\S]*?)<\/(?:a|button|div)>/g)]
    .map(m => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
  assert.deepStrictEqual(tabs, ['Dashboard', 'Prospects', 'Pipeline', 'Contacts', 'More']);
});
test('each of the four page tabs leads to a real page; More opens the sidebar', () => {
  const views = [...bottomBar.matchAll(/data-view="([a-z-]+)"/g)].map(m => m[1]);
  assert.deepStrictEqual(views, ['dashboard', 'offtakers', 'pipeline', 'contacts']);
  views.forEach(v => assert.ok(routerKeys.has(v), v + ' has no router entry'));
  assert.ok(bottomBar.includes('toggleSidebar('), 'More does not open the sidebar');
});
test('the active tab follows the page; record pages light none', () => {
  const tabFor = fn('bottomTabFor', {});
  assert.strictEqual(tabFor('dashboard'), 'dashboard');
  assert.strictEqual(tabFor('offtakers'), 'offtakers');
  assert.strictEqual(tabFor('pipeline'), 'pipeline');
  assert.strictEqual(tabFor('contacts'), 'contacts');
  assert.strictEqual(tabFor('agenthq'), 'more');
  assert.strictEqual(tabFor('project'), 'more');
  assert.strictEqual(tabFor('detail'), null);
});
test('toggleSidebar opens and closes the sheet, and can be forced shut', () => {
  const d = stubDoc();
  const sb = d.els.sidebar = d.document.getElementById('sidebar');
  const scrim = d.document.getElementById('sb-scrim');
  const t = fn('toggleSidebar', { document: d.document });
  t(); assert.ok(sb.classList.contains('open'));
  t(); assert.ok(!sb.classList.contains('open'));
  t(true); assert.ok(sb.classList.contains('open') && scrim.classList.contains('open'));
  t(false); assert.ok(!sb.classList.contains('open') && !scrim.classList.contains('open'));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
