/* The province scope as the layout tests meet it: no province chosen, so every
 * accessor hands back the whole set and no page adds a note to its subtitle.
 * Not a test itself (the suite runs tests/*.test.js); the layout tests that load a
 * real view into a sandbox spread this into their stubs. The scope's own rules are
 * tested in province-scope.test.js and province-scope-pages.test.js.
 */
'use strict';

module.exports = function scopeStubs(state) {
  return {
    scopedOfftakers: () => state.offtakers,
    scopedDeals: () => state.deals,
    scopedContacts: () => state.contacts,
    scopedInteractions: () => state.interactions,
    scopedProjects: () => state.projects,
    accountInScope: () => true,
    scopeNote: () => '',
  };
};
