/* Finds identifiers that resolve to nothing at runtime.
 *
 *   node scripts/check-refs.js
 *
 * Exits 0 when clean, 1 when it finds something, so it can gate a commit.
 *
 * WHY THIS EXISTS
 * The app is a set of plain scripts sharing one global scope, with no build
 * step and no module graph — which is what makes it deployable by pushing a
 * folder, and also what makes a rename silent. Delete a variable and miss a
 * call site and nothing complains until somebody opens the page that reads
 * it, at which point a ReferenceError takes down the whole render. Three had
 * been sitting in the tree:
 *
 *   - `prospects` in renderSector, after leads and offtakers became one
 *     record type. Every sector page opened blank.
 *   - `p` in openAddDeal, left behind by the same merge. New opportunity
 *     threw whenever there was no nearest site to default to.
 *   - `IMPORT_HINT`, after it was split in two. An offtaker CSV with no name
 *     column died instead of saying which columns are recognised.
 *
 * None of them were syntax errors, so `node --check` sees nothing. All three
 * are one identifier that no longer exists, which is exactly what this looks
 * for.
 *
 * HOW IT READS THE CODE
 * Each HTML document is its own universe: the scripts it loads, in order,
 * plus any inline block. Pass 1 collects every name declared at the top level
 * of those scripts — that is the global scope the browser would build. Pass 2
 * walks each script tracking nested scopes and reports references that are in
 * neither. Pass 3 does the same for the function names quoted in inline
 * handlers (onclick="doThing()"), which are strings to a parser and so
 * invisible to pass 2, but are the app's main way of wiring a button.
 *
 * Scope collection is deliberately generous — a name counted as declared when
 * it is not only costs a missed report, never a false one. A checker that
 * cries wolf stops being run.
 *
 * ACORN
 * Resolving a reference properly needs a real parser, and vendoring one would
 * put 6000 lines of someone else's code next to 4000 of ours. So acorn is
 * fetched once into the OS temp directory and cached there. Nothing lands in
 * the repo, and the first run says what it is doing.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(os.tmpdir(), 'aee-check-refs');

function loadAcorn() {
  for (const base of [ROOT, CACHE]) {
    try { return require(path.join(base, 'node_modules', 'acorn')); } catch (e) { /* keep looking */ }
  }
  try { return require('acorn'); } catch (e) { /* not installed anywhere */ }

  process.stderr.write('Fetching acorn once into ' + CACHE + ' ...\n');
  try {
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(path.join(CACHE, 'package.json'), '{"name":"aee-check-refs","private":true}\n');
    execFileSync('npm', ['install', 'acorn', '--silent', '--no-audit', '--no-fund'],
      { cwd: CACHE, stdio: 'inherit', shell: process.platform === 'win32' });
    return require(path.join(CACHE, 'node_modules', 'acorn'));
  } catch (e) {
    process.stderr.write('\nCould not fetch acorn (' + e.message + ').\n' +
      'Install it anywhere on the require path and run again, e.g.\n' +
      '  npm install acorn --prefix "' + CACHE + '"\n');
    process.exit(2);
  }
}
const acorn = loadAcorn();

/* Names the browser supplies. Anything here is not our problem. Leaflet's `L`
   is in the list because the map pages use it and it arrives from a CDN. */
const BUILTINS = new Set(`
window document console Math JSON Object Array String Number Boolean Date RegExp Error TypeError RangeError
Promise Set Map WeakMap WeakSet Symbol Proxy Reflect BigInt globalThis undefined NaN Infinity arguments
parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent encodeURI decodeURI
setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame queueMicrotask
fetch localStorage sessionStorage location history navigator alert confirm prompt getComputedStyle matchMedia
CSS Intl URL URLSearchParams FormData Blob File FileReader Event CustomEvent Element HTMLElement Node NodeList
crypto structuredClone AbortController AbortSignal TextEncoder TextDecoder Headers Request Response
performance screen atob btoa addEventListener removeEventListener dispatchEvent getSelection
innerWidth innerHeight scrollTo scrollX scrollY scrollBy print open close focus blur
IntersectionObserver MutationObserver ResizeObserver DOMParser XMLHttpRequest Image Audio
Uint8Array Int32Array Float64Array ArrayBuffer Function eval self top parent frames closed
L
`.trim().split(/\s+/));

/* ─── the pieces of one HTML document ───────────────────────────── */
function unitsFor(htmlFile) {
  const src = fs.readFileSync(path.join(ROOT, htmlFile), 'utf8');
  const units = [];
  const tag = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>|<script\s[^>]*\/>/g;
  for (const m of src.matchAll(tag)) {
    const attrs = m[0].slice(0, m[0].indexOf('>'));
    const href = (attrs.match(/\bsrc="([^"]+)"/) || [])[1];
    if (href) {
      if (/^https?:/.test(href)) continue;          // a CDN file is not ours to check
      units.push({ file: href, src: fs.readFileSync(path.join(ROOT, href), 'utf8'), lineOffset: 0 });
    } else if (m[1] && m[1].trim()) {
      units.push({ file: htmlFile, src: m[1], lineOffset: src.slice(0, m.index).split('\n').length - 1 });
    }
  }
  return { html: { file: htmlFile, src }, units };
}

/* Every node in a tree, in no particular order. */
function eachNode(node, fn) {
  if (!node || typeof node.type !== 'string') return;
  fn(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    const c = node[key];
    if (Array.isArray(c)) c.forEach(x => eachNode(x, fn));
    else if (c && typeof c.type === 'string') eachNode(c, fn);
  }
}

/* ─── binding names inside a declaration pattern ─────────────────── */
function declaredNames(node, out) {
  if (!node) return;
  switch (node.type) {
    case 'Identifier': out.push(node.name); break;
    case 'ObjectPattern': node.properties.forEach(p => declaredNames(p.value || p.argument, out)); break;
    case 'ArrayPattern': node.elements.forEach(e => declaredNames(e, out)); break;
    case 'AssignmentPattern': declaredNames(node.left, out); break;
    case 'RestElement': declaredNames(node.argument, out); break;
  }
}

/* Every name bound anywhere in a body, not descending into nested function
   bodies — those get a scope of their own on the way down. */
function collectDecls(node, names, depth) {
  if (!node || typeof node.type !== 'string') return;
  const t = node.type;
  if ((t === 'FunctionDeclaration' || t === 'ClassDeclaration') && node.id) names.add(node.id.name);
  if (t === 'VariableDeclaration') node.declarations.forEach(d => {
    const out = []; declaredNames(d.id, out); out.forEach(x => names.add(x));
  });
  if (depth > 0 && (t === 'FunctionDeclaration' || t === 'FunctionExpression' || t === 'ArrowFunctionExpression')) return;
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    const c = node[key];
    if (Array.isArray(c)) c.forEach(x => x && x.type && collectDecls(x, names, depth + 1));
    else if (c && typeof c.type === 'string') collectDecls(c, names, depth + 1);
  }
}

/* Is this Identifier reading a binding, or just a name being written down —
   a property key, a parameter, the thing being declared? */
function isReference(parent, key) {
  const p = parent.type;
  if (p === 'MemberExpression' && key === 'property' && !parent.computed) return false;
  if (p === 'Property' && key === 'key' && !parent.computed) return false;
  if (p === 'MethodDefinition' && key === 'key' && !parent.computed) return false;
  if (key === 'id' || key === 'params' || key === 'param') return false;
  if (p === 'LabeledStatement' || p === 'BreakStatement' || p === 'ContinueStatement') return false;
  if (p === 'ObjectPattern' || p === 'ArrayPattern' || p === 'RestElement') return false;
  if (p === 'AssignmentPattern' && key === 'left') return false;
  return true;
}

function checkDocument(htmlFile) {
  const { html, units } = unitsFor(htmlFile);
  units.forEach(u => {
    try {
      u.ast = acorn.parse(u.src, { ecmaVersion: 2022, sourceType: 'script', locations: true });
    } catch (e) {
      u.parseError = e.message;
    }
  });

  const globals = new Set();
  units.filter(u => u.ast).forEach(u => u.ast.body.forEach(n => {
    if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) globals.add(n.id.name);
    if (n.type === 'VariableDeclaration') n.declarations.forEach(d => {
      const out = []; declaredNames(d.id, out); out.forEach(x => globals.add(x));
    });
  }));
  /* `window.doLogin = ...` defines a global just as surely as a top-level
     declaration does, and the landing page uses that form throughout. It
     can sit at any depth, so this looks everywhere rather than at the top
     level only. */
  units.filter(u => u.ast).forEach(u => eachNode(u.ast, n => {
    if (n.type !== 'AssignmentExpression') return;
    const l = n.left;
    if (l.type !== 'MemberExpression' || l.computed) return;
    if (l.object.type !== 'Identifier') return;
    if (!['window', 'globalThis', 'self'].includes(l.object.name)) return;
    if (l.property.type === 'Identifier') globals.add(l.property.name);
  }));

  const found = [];
  function walk(node, scopes, unit, parent, key) {
    if (!node || typeof node.type !== 'string') return;
    const t = node.type;

    if (t === 'Identifier') {
      if (parent && isReference(parent, key)) {
        const n = node.name;
        if (!BUILTINS.has(n) && !globals.has(n) && !scopes.some(s => s.has(n))) {
          found.push({ file: unit.file, line: node.loc.start.line + unit.lineOffset, name: n, kind: 'reference' });
        }
      }
      return;
    }

    let scope = scopes;
    if (t === 'FunctionDeclaration' || t === 'FunctionExpression' || t === 'ArrowFunctionExpression') {
      const names = new Set();
      node.params.forEach(p => { const o = []; declaredNames(p, o); o.forEach(x => names.add(x)); });
      if (node.id) names.add(node.id.name);
      collectDecls(node.body, names, 0);
      scope = scopes.concat([names]);
    } else if (t === 'BlockStatement' || t === 'Program') {
      const names = new Set(); collectDecls(node, names, 0);
      scope = scopes.concat([names]);
    } else if (t === 'CatchClause' && node.param) {
      const names = new Set(); const o = []; declaredNames(node.param, o); o.forEach(x => names.add(x));
      scope = scopes.concat([names]);
    } else if (t === 'ForStatement' || t === 'ForInStatement' || t === 'ForOfStatement') {
      const names = new Set();
      const init = node.init || node.left;
      if (init && init.type === 'VariableDeclaration') init.declarations.forEach(d => {
        const o = []; declaredNames(d.id, o); o.forEach(x => names.add(x));
      });
      scope = scopes.concat([names]);
    }

    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'start' || k === 'end') continue;
      const c = node[k];
      if (Array.isArray(c)) c.forEach(x => walk(x, scope, unit, node, k));
      else if (c && typeof c.type === 'string') walk(c, scope, unit, node, k);
    }
  }
  units.filter(u => u.ast).forEach(u => walk(u.ast, [], u, null, null));

  /* An inline handler is a string as far as the parser is concerned, so the
     function it names has to be looked up by hand. Only a bare call counts:
     `event.stopPropagation()` is a method on something already in hand. */
  const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function', 'new', 'delete', 'void', 'in', 'of']);
  const HANDLER = /\bon[a-z]+="([^"]*)"/g;
  units.concat([html]).forEach(({ file, src, lineOffset }) => {
    for (const m of src.matchAll(HANDLER)) {
      for (const c of m[1].matchAll(/(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) {
        const name = c[1];
        if (BUILTINS.has(name) || globals.has(name) || KEYWORDS.has(name)) continue;
        found.push({
          file, name, kind: 'handler',
          line: src.slice(0, m.index).split('\n').length + (lineOffset || 0),
        });
      }
    }
  });

  units.filter(u => u.parseError).forEach(u =>
    found.push({ file: u.file, line: 1, name: u.parseError, kind: 'parse error' }));

  return { htmlFile, scripts: units.length, globals: globals.size, found };
}

/* ─── run it over every page in the app ──────────────────────────── */
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();
let total = 0;

pages.forEach(page => {
  const r = checkDocument(page);
  console.log(r.htmlFile + ' — ' + r.scripts + ' script' + (r.scripts === 1 ? '' : 's') +
    ', ' + r.globals + ' globals');
  const seen = new Set();
  r.found.filter(x => {
    const k = x.file + x.line + x.name;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  }).forEach(x => {
    total++;
    console.log('  ' + x.file + ':' + x.line + '  ' + x.name +
      (x.kind === 'handler' ? '() — named in an inline handler, never defined' :
       x.kind === 'parse error' ? ' — will not parse' : ' — not defined in any enclosing scope'));
  });
});

console.log('');
console.log(total ? total + ' unresolved reference' + (total === 1 ? '' : 's') + '.'
                  : 'Clean — every identifier resolves.');
process.exit(total ? 1 : 0);
