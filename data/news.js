/* ═══════════════════════════════════════════════════════════════════
   Mining-industry news — the topics the desk watches, and the feed.

   The taxonomy is fixed; the articles are not. Everything in NEWS_ARTICLES
   below is SAMPLE data carrying sample:true, written to show the page
   working before a real feed is wired in. Nothing here is a report of a
   real event, no article names a real company, and none carries a URL —
   a rep must never mistake a placeholder for a story they can act on.
   Replace the array wholesale once a scraper or an editor is feeding it.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* The eight cuts the desk reads the market through. Order is the order
   the filter chips appear in. */
const NEWS_TOPICS = {
  renewable_energy: { label: 'Renewable Energy',   color: '#3ddc84' },
  strategy:         { label: 'Strategy',           color: '#38bdf8' },
  ppa_contracts:    { label: 'PPA Contracts',      color: '#a78bfa' },
  new_ppa:          { label: 'New PPA Agreements', color: '#22d3ee' },
  renewals:         { label: 'Renewals',           color: '#ec4899' },
  consortia:        { label: 'Consortia',          color: '#f5a524' },
  mine_expansion:   { label: 'Mine Expansion',     color: '#fb923c' },
};

/* Provinces a story can be tagged to. Mirrors PROVINCE_COORDS in seed.js,
   minus the 'Multiple' catch-all, which stories use freely. */
const NEWS_PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
  'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape', 'Multiple',
];

/* Sample feed. Deliberately unattributed and link-free — see the header. */
const NEWS_ARTICLES = [
  {
    id: 'news-sample-01', topic: 'new_ppa', province: 'Limpopo', date: '2026-09-14',
    title: 'Platinum producer signs 120 MW wheeled solar PPA for a Limpopo complex',
    summary: 'A 15-year agreement covering roughly a third of the complex\'s baseload, wheeled over the Eskom network from a Northern Cape site. Tariff is indexed below the Megaflex escalation path.',
    whyItMatters: 'Sets a reference tariff other platinum operators will ask us to match.',
    sample: true,
  },
  {
    id: 'news-sample-02', topic: 'mine_expansion', province: 'Northern Cape', date: '2026-09-13',
    title: 'Manganese expansion adds an estimated 40 MW of load near Kathu',
    summary: 'Board approval for a processing expansion lifting site demand materially from the 2028 commissioning date, with the grid connection application already lodged.',
    whyItMatters: 'New load in a district where we hold uncommitted capacity.',
    sample: true,
  },
  {
    id: 'news-sample-03', topic: 'consortia', province: 'Mpumalanga', date: '2026-09-12',
    title: 'Four coal-belt operators form a buying consortium for wheeled power',
    summary: 'The group intends to aggregate demand across neighbouring operations to reach a scale that justifies a dedicated generation build rather than several smaller agreements.',
    whyItMatters: 'Aggregated demand changes who we negotiate with — one deal, not four.',
    sample: true,
  },
  {
    id: 'news-sample-04', topic: 'renewals', province: 'North West', date: '2026-09-11',
    title: 'Chrome smelter\'s legacy supply agreement reaches its final year',
    summary: 'A long-dated supply contract covering a North West smelter expires at the end of the coming financial year, with the operator signalling it will test the market rather than roll over.',
    whyItMatters: 'A renewal window is the one moment an incumbent can be displaced.',
    sample: true,
  },
  {
    id: 'news-sample-05', topic: 'renewable_energy', province: 'Northern Cape', date: '2026-09-11',
    title: 'Two solar projects reach financial close in the Upington corridor',
    summary: 'Combined capacity of roughly 300 MW, both targeting commercial and industrial offtake rather than the public procurement programme.',
    whyItMatters: 'Competing capacity chasing the same offtakers we are.',
    sample: true,
  },
  {
    id: 'news-sample-06', topic: 'strategy', province: 'Multiple', date: '2026-09-10',
    title: 'Diversified miner sets a 2030 target to source half its power off-grid',
    summary: 'A group-level commitment covering operations in three provinces, to be met through a mix of self-build, wheeled PPAs and on-site storage.',
    whyItMatters: 'A stated target is a budget line — and a reason to call now.',
    sample: true,
  },
  {
    id: 'news-sample-07', topic: 'ppa_contracts', province: 'Gauteng', date: '2026-09-09',
    title: 'Regulator clarifies wheeling rules for multi-site industrial offtakers',
    summary: 'Guidance addresses how a single generator may serve several delivery points under one agreement, a structure that had been handled case by case.',
    whyItMatters: 'Removes a structuring objection we hear on every multi-site deal.',
    sample: true,
  },
  {
    id: 'news-sample-08', topic: 'mine_expansion', province: 'Limpopo', date: '2026-09-08',
    title: 'Vanadium operation restarts a mothballed processing line',
    summary: 'The restart brings roughly 18 MW of load back onto the network in a district with limited local generation.',
    whyItMatters: 'Returning load with no incumbent renewable supplier attached.',
    sample: true,
  },
  {
    id: 'news-sample-09', topic: 'new_ppa', province: 'North West', date: '2026-09-07',
    title: 'Ferrochrome producer contracts 80 MW across two generation sites',
    summary: 'Split between a wind site and a solar site to flatten the delivered profile against a continuous smelting load.',
    whyItMatters: 'Shows the blended-profile structure winning against single-technology bids.',
    sample: true,
  },
  {
    id: 'news-sample-10', topic: 'renewable_energy', province: 'Eastern Cape', date: '2026-09-06',
    title: 'Wind capacity in the Eastern Cape passes a new corridor milestone',
    summary: 'Cumulative installed capacity in the province continues to grow, with several projects now selling directly to industrial buyers.',
    whyItMatters: 'Useful proof point for offtakers who doubt wheeled wind is real.',
    sample: true,
  },
  {
    id: 'news-sample-11', topic: 'consortia', province: 'Northern Cape', date: '2026-09-05',
    title: 'Junior miners explore a shared grid connection in the Kalahari',
    summary: 'Several smaller operations are assessing a common connection point to share the cost of network upgrades none could justify alone.',
    whyItMatters: 'A shared connection makes small loads worth quoting as one.',
    sample: true,
  },
  {
    id: 'news-sample-12', topic: 'strategy', province: 'Mpumalanga', date: '2026-09-04',
    title: 'Coal operator reframes energy spend as a competitiveness issue',
    summary: 'Management commentary shifts the internal argument for wheeled power from emissions reporting to unit cost per tonne.',
    whyItMatters: 'Tells us which argument lands with this buyer — cost, not carbon.',
    sample: true,
  },
  {
    id: 'news-sample-13', topic: 'renewals', province: 'KwaZulu-Natal', date: '2026-09-03',
    title: 'Smelter reopens tender for supply from the 2027 contract year',
    summary: 'An existing arrangement runs to the end of 2026, with the operator inviting proposals well ahead of expiry.',
    whyItMatters: 'Early tender means the shortlist forms months before expiry.',
    sample: true,
  },
  {
    id: 'news-sample-14', topic: 'ppa_contracts', province: 'Western Cape', date: '2026-09-02',
    title: 'Municipal wheeling tariff schedule published for the coming year',
    summary: 'Updated use-of-system charges affect the delivered cost of any agreement crossing the municipal boundary.',
    whyItMatters: 'Directly changes the delivered number in every Western Cape quote.',
    sample: true,
  },
];
