/* ═══════════════════════════════════════════════════════════════════
   Mining-industry news — the topics the desk watches, and the feed.

   Every entry below is a real, published story: the headline, date,
   publication and URL are as published, and each was checked against the
   source before it was added. Nothing here is written or paraphrased into
   a claim the source does not make — the `summary` restates the article,
   while `whyItMatters` is our own read and is clearly a separate line.

   Curated by hand as at 2026-09-16. When a scan job eventually feeds this
   page, it should write the same shape and keep the same rule: a story
   without a working source link does not belong in the feed.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* The seven cuts the desk reads the market through. Order is the order
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
   plus the 'Multiple' catch-all for national stories. */
const NEWS_PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
  'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape', 'Multiple',
];

const NEWS_ARTICLES = [
  {
    id: 'news-bnef-corporate-ppa-2026',
    topic: 'ppa_contracts', province: 'Multiple', date: '2026-09-08',
    title: 'Corporate PPAs to outpace public procurement in South Africa for first time in 2026 – BNEF',
    summary: 'BloombergNEF expects corporate buyers to support 73% of the 2.3 GW of solar and wind ' +
      'additions anticipated in 2026 — more capacity than government auctions — and to remain the ' +
      'dominant driver of renewables build through 2030. Sibanye-Stillwater, Rio Tinto and Sasol are ' +
      'named among the largest corporate buyers.',
    whyItMatters: 'The private PPA market is now the main channel, not the alternative one. Every offtaker conversation can start from that.',
    source: 'Mining Weekly',
    url: 'https://www.miningweekly.com/article/corporate-ppas-to-outpace-public-procurement-in-south-africa-for-first-time-in-2026-bnef-2026-09-08',
  },
  {
    id: 'news-ummbila-emoyeni-cod-2026',
    topic: 'renewable_energy', province: 'Mpumalanga', date: '2026-08-05',
    title: 'Ummbila Emoyeni wind farm phase one enters commercial operation',
    summary: 'The 155 MW first phase of Seriti Green\'s Ummbila Emoyeni complex near Bethal reached ' +
      'commercial operation ahead of schedule, becoming the first operating wind farm in Mpumalanga. ' +
      'The full complex is planned at about 900 MW of wind and solar with battery storage, targeted ' +
      'for completion in 2027.',
    whyItMatters: 'Generation is arriving in the coal belt itself — short wheeling paths to the loads we are quoting there.',
    source: 'Energy Global',
    url: 'https://www.energyglobal.com/wind/05082026/ummbila-emoyeni-wind-farm-phase-one-enters-commercial-operation/',
  },
  {
    id: 'news-exxaro-matla-mine1-2026',
    topic: 'mine_expansion', province: 'Mpumalanga', date: '2026-05-15',
    title: 'Exxaro opens new Mine 1 at Matla',
    summary: 'Exxaro officially opened the new Mine 1 operation at its Matla coal mine, an expansion ' +
      'supporting continuous mining and the volumes required under its coal supply agreement with Eskom.',
    whyItMatters: 'Expansion means new connected load in a district where we hold uncommitted capacity.',
    source: 'Mining Weekly',
    url: 'https://www.miningweekly.com/article/exxaro-opens-new-mine-1-at-matla-2026-05-15',
  },
  {
    id: 'news-northern-cape-r105bn-2026',
    topic: 'mine_expansion', province: 'Northern Cape', date: '2026-04-16',
    title: 'Investors commit R105-billion-plus to Northern Cape development',
    summary: 'Pledges across mining, renewable energy and agriculture were announced at the inaugural ' +
      'Northern Cape Investment and Jobs Conference in Kimberley, with about 19 800 jobs expected. ' +
      'They include R17-billion from Vedanta Zinc International for the Gamsberg expansion and ' +
      'R30-billion from IPPO for renewable energy infrastructure.',
    whyItMatters: 'A pipeline of new Northern Cape load, in the province where our unsold capacity is largest.',
    source: 'Mining Weekly',
    url: 'https://www.miningweekly.com/article/investors-commit-r105-billion-plus-to-northern-cape-development-2026-04-16',
  },
  {
    id: 'news-envusa-koruson2-2026',
    topic: 'consortia', province: 'Eastern Cape', date: '2026-04-07',
    title: 'More renewable power for South Africa\'s platinum, iron-ore, diamond mines',
    summary: 'Envusa Energy — the Anglo American and EDF joint venture, with Pele Green Energy — brought ' +
      'the 140 MW Umsobomvu wind farm and 240 MW Mooi Plaats solar plant into commercial operation, ' +
      '380 MW of the 520 MW Koruson 2 cluster. The power serves Valterra platinum, Kumba iron-ore and ' +
      'De Beers operations.',
    whyItMatters: 'The JV-plus-cluster structure is how the majors are buying. Expect to be compared against it.',
    source: 'Mining Weekly',
    url: 'https://www.miningweekly.com/article/more-renewable-power-for-south-africas-platinum-iron-ore-diamond-mines-2026-04-07',
  },
  {
    id: 'news-exxaro-eskom-matla-csa-2026',
    topic: 'renewals', province: 'Mpumalanga', date: '2026-04-02',
    title: 'Future of Matla mine, power station secured as Exxaro, Eskom ink CSA to 2043',
    summary: 'Exxaro and Eskom signed a long-term coal supply agreement running from 1 April 2026 to ' +
      '30 November 2043, replacing an arrangement first struck in 1983. Matla mine supplies roughly ' +
      '9.3-million tonnes a year to the adjacent Matla power station.',
    whyItMatters: 'Shows how far ahead of expiry these renewals are decided — the window opens years early.',
    source: 'Mining Weekly',
    url: 'https://www.miningweekly.com/article/future-of-matla-mine-power-station-secured-as-exxaro-eskom-ink-csa-to-2043-2026-04-02',
  },
  {
    id: 'news-northern-cape-hub-2026',
    topic: 'strategy', province: 'Northern Cape', date: '2026-03-30',
    title: 'Northern Cape can be South Africa\'s next mining hub, says Minerals Council economist',
    summary: 'Minerals Council acting chief economist Bongani Motsa said the province\'s manganese and ' +
      'rare earth reserves could drive growth and beneficiation, arguing planning must start now. ' +
      'Premier Zamani Saul pointed to abundant green energy and infrastructure as the province\'s advantage.',
    whyItMatters: 'The province is selling itself on cheap green power — that argument does our work for us.',
    source: 'Mining Weekly',
    url: 'https://www.miningweekly.com/article/northern-cape-can-be-south-africas-next-mining-hub-says-minerals-council-economist-2026-03-29',
  },
  {
    id: 'news-sibanye-etana-220mw-2026',
    topic: 'new_ppa', province: 'Multiple', date: '2026-02-06',
    title: 'More renewable energy secured for Sibanye-Stillwater\'s South African mines',
    summary: 'Sibanye-Stillwater signed a ten-year power purchase agreement with Etana Energy for 220 MW ' +
      'of wheeled wind and solar — close to 600 GWh a year — across its South African gold and PGM ' +
      'operations, operational from late 2027. The company reports an expected reduction of about ' +
      '648 000 tCO₂e a year.',
    whyItMatters: 'The reference deal in this market. Expect its tariff and tenor quoted back at us.',
    source: 'Mining Weekly',
    url: 'https://www.miningweekly.com/article/more-renewable-energy-secured-by-sibanye-stillwater-for-its-south-african-mines-2026-02-06',
  },
];
