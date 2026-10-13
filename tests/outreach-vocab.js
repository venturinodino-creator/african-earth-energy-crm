/* The outreach vocabulary from data/seed.js (channels, outcomes and the follow-up rhythm),
 * for a test that loads a real view into a sandbox with its own stub stage lists and so
 * cannot load seed.js whole. Read out of the real file, so a test never runs on a copy.
 * Not a test itself (the suite runs tests/*.test.js).
 *
 *   const ctx = vm.createContext({ ...outreachVocab(), ... });
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let cached = null;
module.exports = function outreachVocab() {
  if (!cached) {
    const ctx = vm.createContext({ console });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data', 'seed.js'), 'utf8'), ctx);
    cached = vm.runInContext('({ OUTREACH_CHANNELS, OUTREACH_OUTCOMES, OUTREACH_FOLLOW_UP_WORKDAYS, OUTREACH_MAX_TOUCHES })', ctx);
  }
  return Object.assign({}, cached);
};
