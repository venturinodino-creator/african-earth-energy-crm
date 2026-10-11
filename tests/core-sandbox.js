/* A vm sandbox with the real data files and js/core.js loaded, so a test can run the app's own
 * helpers (CSV reading, province, sector and municipality matching) instead of copies of them.
 * Anything a test needs beyond that goes in `files`, loaded after core.js, or `over`, set on
 * the context before anything runs.
 *
 *   const { ctx, run } = require('./core-sandbox')({ files: ['js/import-rules.js'] });
 *
 * `run(code)` evaluates code in the sandbox and hands back plain JSON, because an array made
 * inside a vm is not an Array to the test's own realm and deepStrictEqual would say so.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const noop = () => {};
const el = () => ({
  style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, addEventListener: noop, appendChild: noop,
  setAttribute: noop, querySelector: () => null, querySelectorAll: () => [], getAttribute: () => null,
  innerHTML: '', innerText: '', textContent: '', value: '', focus: noop, scrollIntoView: noop,
});

module.exports = function sandbox(opts) {
  opts = opts || {};
  const win = { addEventListener: noop, matchMedia: () => ({ matches: false }), location: { search: '', pathname: '/' }, localStorage: { getItem: () => null, setItem: noop }, scrollTo: noop };
  const ctx = vm.createContext(Object.assign({
    console, setTimeout: noop, clearTimeout: noop, setInterval: noop,
    document: { getElementById: () => el(), createElement: () => el(), querySelector: () => el(), querySelectorAll: () => [], addEventListener: noop, body: el(), documentElement: el() },
    window: win, localStorage: win.localStorage, location: win.location, history: { state: null, pushState: noop }, addEventListener: noop,
    navigator: { userAgent: 'node' }, matchMedia: win.matchMedia, scrollTo: noop, Intl, URLSearchParams, URL, fetch: async () => ({ ok: false }), CSS: { escape: s => s },
  }, opts.over));
  const files = ['data/sectors.js', 'data/seed.js', 'data/municipalities.js', 'js/icons.js', 'js/layout.js', 'js/supabase.js', 'js/core.js'].concat(opts.files || []);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8') + '\n', ctx, { filename: f });
  const run = code => {
    const v = vm.runInContext(code, ctx);
    return v === undefined ? null : JSON.parse(JSON.stringify(v));
  };
  return { ctx, run };
};
