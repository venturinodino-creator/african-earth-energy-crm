/* ═══════════════════════════════════════════════════════════════════
   ProjectManager.com snapshot — the delivery side of the portfolio.

   Read from the Portfolio Summary page of AEEG's ProjectManager.com
   workspace on 2026-10-02. It is a dated snapshot, not a live feed:
   ProjectManager.com sits behind a login, so nothing here syncs on its
   own. To refresh it, re-read that page (or export the portfolio to
   CSV/Excel) and update this file; asOf says how old it is.

   Not captured because the signed-in account may not see it: cost and
   budget (the page says "You do not have permission to view this item").
   Totals shown there were €0 for every project.

   siteId links a ProjectManager.com project to a site in AEE_PROJECTS
   (data/seed.js). Only exact name matches are linked. The rest carry
   suggestedSiteId, a guess for someone who knows the portfolio to confirm
   or correct — it is NOT used to join data.

   Indicator colours are recorded as the page shows them. Their exact
   meaning is ProjectManager.com's (green/grey/orange); the page does not
   say in words, so the app prints the colour and does not interpret it.
   ═══════════════════════════════════════════════════════════════════ */

const PM_SNAPSHOT = {
  asOf: '2026-10-02',
  source: 'https://9vbldqaexk6.app.projectmanager.com/home/portfolio-summary',
  phase: 'Planning',          // all 8 projects sit in the Planning column of the pipeline chart
  projects: [
    { name: 'AEEG Mapela Solar Farm 300MW',               mw: 300, progress: 0,  tasks: '0/44',  time: 'green', cost: 'grey', workload: 'orange', siteId: null, suggestedSiteId: 'limpopo300' },
    { name: 'AEEG Middelburg 49MW Solar Farm',            mw: 49,  progress: 31, tasks: '15/43', time: 'green', cost: 'grey', workload: 'orange', siteId: 'middelburg' },
    { name: 'AEEG Oudtshoorn Solar Farm 75MW',            mw: 75,  progress: 3,  tasks: '5/44',  time: 'green', cost: 'grey', workload: 'orange', siteId: 'oudtshoorn' },
    { name: 'AEEG Riverlands Solar Farm 9MW',             mw: 9,   progress: 0,  tasks: '0/44',  time: 'green', cost: 'grey', workload: 'orange', siteId: 'riverlands' },
    { name: 'AEEG Sable Hills Eco Park Solar Farm 100MW', mw: 100, progress: 0,  tasks: '0/44',  time: 'green', cost: 'grey', workload: 'orange', siteId: null, suggestedSiteId: 'lephalale' },
    { name: 'AEEG Stanford Solar Farm 9MW',               mw: 9,   progress: 0,  tasks: '0/44',  time: 'green', cost: 'grey', workload: 'orange', siteId: null, suggestedSiteId: 'overberg' },
    { name: 'AEEG Project Template',                      mw: null, progress: 0, tasks: '0/22',  time: 'green', cost: 'grey', workload: 'orange', siteId: null, template: true },
    { name: 'Project Workflow',                           mw: null, progress: 0, tasks: '0/0',   time: 'green', cost: 'grey', workload: 'orange', siteId: null, template: true },
  ],
  /* "Team utilization" as listed on the page; the page gives no unit. */
  team: [
    { name: 'Karen Metcalf',      load: 285 },
    { name: 'Darrin Arendse',     load: 239 },
    { name: 'Zea September',      load: 33 },
    { name: "Shakira O'Malley",   load: 25 },
    { name: 'Kimberley Coetsee',  load: 12 },
    { name: 'Candy Monga',        load: 6 },
    { name: 'Adriana Giles',      load: 0 },
  ],
};
