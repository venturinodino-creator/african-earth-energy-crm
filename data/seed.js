/* ═══════════════════════════════════════════════════════════════════
   Seed data — African Earth Energy Offtaker CRM
   Loaded as a plain script so the app works from file:// and GitHub
   Pages alike (no fetch, no server needed).

   AEE_PROJECTS  — the generation portfolio, from aeeg.co.za/en/projects
   SEED_OFFTAKERS — candidate energy buyers for the sales team to work
   SEED_CONTACTS  — people at those offtakers
   PLAYBOOK       — outreach scripts the sales team can copy/paste

   Offtaker and contact records are STARTING POINTS for the sales team:
   names of real companies with publicly known operations, plus
   estimated load figures flagged as estimates. Verify before quoting.
   ═══════════════════════════════════════════════════════════════════ */

const AEE_PROJECTS = [
  { id:'middelburg', name:'Middelburg Solar Farm + BESS', tech:'solar+bess', mw:49, province:'Mpumalanga', town:'Middelburg',
    lat:-25.775, lng:29.464, cod:'2029', status:'development', contracted:0,
    note:'Wheeled PPA structure aimed at C&I offtakers in the Samancor smelter corridor.' },
  { id:'limpopo300', name:'Limpopo Solar PV + BESS', tech:'solar+bess', mw:300, province:'Limpopo', town:'Polokwane',
    lat:-23.904, lng:29.469, cod:'2029', status:'development', contracted:0,
    note:'Largest single site in the portfolio. Anchor-offtaker led — targeting mining and smelting load.' },
  { id:'limpopo150', name:'Limpopo Solar Farm + BESS', tech:'solar+bess', mw:150, province:'Limpopo', town:'Musina',
    lat:-22.351, lng:30.040, cod:'2029', status:'development', contracted:0,
    note:'Northern corridor site with strong irradiance and available grid capacity.' },
  { id:'lephalale', name:'Lephalale Eco Farm + BESS', tech:'solar+bess', mw:100, province:'Limpopo', town:'Lephalale',
    lat:-23.669, lng:27.751, cod:'2028', status:'development', contracted:0,
    note:'Adjacent to the Waterberg coal complex — natural fit for coal-exposed industrial buyers.' },
  { id:'oudtshoorn', name:'Oudtshoorn Solar Farm + BESS', tech:'solar+bess', mw:75, province:'Western Cape', town:'Oudtshoorn',
    lat:-33.596, lng:22.201, cod:'2028', status:'development', contracted:0,
    note:'Serves Western Cape C&I load via wheeling; agriculture and agri-processing nearby.' },
  { id:'mokopane', name:'Mokopane Solar Farm + BESS', tech:'solar+bess', mw:30, province:'Limpopo', town:'Mokopane',
    lat:-24.195, lng:29.009, cod:'2028', status:'development', contracted:0,
    note:'Platinum belt site. Sized for a single anchor mining offtaker plus residual wheeling.' },
  { id:'overberg', name:'Overberg Solar Farm + BESS', tech:'solar+bess', mw:12, province:'Western Cape', town:'Caledon',
    lat:-34.229, lng:19.424, cod:'2028', status:'development', contracted:0,
    note:'Small distributed site — good fit for a retail or cold-chain portfolio buyer.' },
  { id:'riverlands', name:'Riverlands Solar Farm + BESS', tech:'solar+bess', mw:9, province:'Western Cape', town:'Malmesbury',
    lat:-33.463, lng:18.733, cod:'2028', status:'development', contracted:0,
    note:'Swartland site close to Cape Town industrial load.' },
  { id:'pipeline-early', name:'Early-stage Pipeline', tech:'solar+bess', mw:600, province:'Multiple', town:'Various',
    lat:-28.500, lng:24.700, cod:'2028–2029', status:'pipeline', contracted:0,
    note:'~600 MW in early development. Sites disclosed at financial close.' },
];

const PROVINCE_COORDS = {
  'Gauteng':[-26.20,28.05], 'Mpumalanga':[-25.77,29.46], 'Limpopo':[-23.90,29.47],
  'Western Cape':[-33.92,18.42], 'Eastern Cape':[-33.02,27.91], 'KwaZulu-Natal':[-29.86,31.02],
  'North West':[-25.86,25.64], 'Free State':[-29.12,26.21], 'Northern Cape':[-28.74,24.76], 'Multiple':[-28.50,24.70],
};

/* Offtaker fields
   annualGwh   estimated annual consumption, GWh/yr
   peakMw      estimated maximum demand, MW
   tariff      current blended tariff, R/kWh
   supply      'eskom' | 'municipal' | 'mixed'
   wheeling    'yes' | 'likely' | 'unknown' | 'no'   — wheeling feasibility
   status      prospect | engaged | qualified | negotiating | contracted | lost
   priority    high | medium | low
   nearest     AEE_PROJECTS id
   estimated   true when load figures are desk estimates, not verified
*/
const SEED_OFFTAKERS = [
  { id:'samancor', name:'Samancor Chrome — Middelburg Ferrochrome', short:'Samancor', sector:'smelter',
    province:'Mpumalanga', city:'Middelburg', website:'https://www.samancorcr.com', lat:-25.775, lng:29.464,
    annualGwh:2400, peakMw:310, tariff:1.42, supply:'eskom', wheeling:'likely', nmd:340,
    status:'engaged', priority:'high', nearest:'middelburg', estimated:true,
    description:'Ferrochrome smelting complex. Electricity is the dominant input cost and the smelter sits inside the Middelburg project corridor.' },

  { id:'glencore-merafe', name:'Glencore–Merafe Chrome Venture', short:'Merafe', sector:'smelter',
    province:'Mpumalanga', city:'Steelpoort', website:'https://www.merafe.co.za', lat:-24.727, lng:30.208,
    annualGwh:1900, peakMw:250, tariff:1.40, supply:'eskom', wheeling:'likely', nmd:280,
    status:'prospect', priority:'high', nearest:'middelburg', estimated:true,
    description:'Ferrochrome joint venture with several smelters. Has publicly cited power cost and load curtailment as key constraints.' },

  { id:'implats', name:'Impala Platinum — Rustenburg', short:'Implats', sector:'mining',
    province:'North West', city:'Rustenburg', website:'https://www.implats.co.za', lat:-25.667, lng:27.242,
    annualGwh:1600, peakMw:210, tariff:1.38, supply:'eskom', wheeling:'yes', nmd:240,
    status:'qualified', priority:'high', nearest:'mokopane', estimated:true,
    description:'Platinum mining and processing. Active renewable procurement programme with a stated decarbonisation target.' },

  { id:'angloplat', name:'Anglo American Platinum — Mogalakwena', short:'Amplats', sector:'mining',
    province:'Limpopo', city:'Mokopane', website:'https://www.angloamericanplatinum.com', lat:-24.195, lng:29.009,
    annualGwh:1350, peakMw:180, tariff:1.36, supply:'eskom', wheeling:'yes', nmd:200,
    status:'negotiating', priority:'high', nearest:'mokopane', estimated:true,
    description:'Largest open-pit PGM operation in the world. Sits ~25 km from the Mokopane project site.' },

  { id:'exxaro', name:'Exxaro Resources — Grootegeluk', short:'Exxaro', sector:'mining',
    province:'Limpopo', city:'Lephalale', website:'https://www.exxaro.com', lat:-23.669, lng:27.751,
    annualGwh:900, peakMw:120, tariff:1.34, supply:'eskom', wheeling:'yes', nmd:150,
    status:'engaged', priority:'high', nearest:'lephalale', estimated:true,
    description:'Coal miner with an explicit diversification strategy into renewables. Directly adjacent to the Lephalale Eco Farm site.' },

  { id:'sibanye', name:'Sibanye-Stillwater — Rustenburg Operations', short:'Sibanye', sector:'mining',
    province:'North West', city:'Rustenburg', website:'https://www.sibanyestillwater.com', lat:-25.667, lng:27.242,
    annualGwh:1500, peakMw:200, tariff:1.39, supply:'eskom', wheeling:'yes', nmd:230,
    status:'prospect', priority:'high', nearest:'mokopane', estimated:true,
    description:'Deep-level gold and PGM mining. Running a multi-hundred-MW renewable procurement pipeline.' },

  { id:'northam', name:'Northam Platinum — Zondereinde', short:'Northam', sector:'mining',
    province:'Limpopo', city:'Thabazimbi', website:'https://www.northam.co.za', lat:-24.591, lng:27.411,
    annualGwh:620, peakMw:85, tariff:1.37, supply:'eskom', wheeling:'likely', nmd:100,
    status:'prospect', priority:'medium', nearest:'lephalale', estimated:true,
    description:'PGM producer on the western limb. Deep mine with a stable, high load factor — attractive baseload profile.' },

  { id:'arcelormittal', name:'ArcelorMittal South Africa — Vanderbijlpark', short:'AMSA', sector:'smelter',
    province:'Gauteng', city:'Vanderbijlpark', website:'https://www.arcelormittalsa.com', lat:-26.708, lng:27.838,
    annualGwh:2100, peakMw:270, tariff:1.41, supply:'eskom', wheeling:'likely', nmd:310,
    status:'prospect', priority:'high', nearest:'middelburg', estimated:true,
    description:'Integrated steel works. Power cost is existential for the plant; strong motivation for a fixed-price PPA.' },

  { id:'columbus', name:'Columbus Stainless', short:'Columbus', sector:'smelter',
    province:'Mpumalanga', city:'Middelburg', website:'https://www.columbus.co.za', lat:-25.775, lng:29.464,
    annualGwh:780, peakMw:105, tariff:1.40, supply:'municipal', wheeling:'likely', nmd:130,
    status:'engaged', priority:'high', nearest:'middelburg', estimated:true,
    description:'Stainless steel producer inside the Middelburg corridor. Municipal supply point — wheeling needs Steve Tshwete agreement.' },

  { id:'sasol-secunda', name:'Sasol — Secunda Operations', short:'Sasol', sector:'industrial',
    province:'Mpumalanga', city:'Secunda', website:'https://www.sasol.com', lat:-26.516, lng:29.202,
    annualGwh:3200, peakMw:420, tariff:1.33, supply:'mixed', wheeling:'yes', nmd:480,
    status:'qualified', priority:'high', nearest:'middelburg', estimated:true,
    description:'Synfuels complex with a published 1.2 GW renewable procurement target and existing wheeling agreements in place.' },

  { id:'pnp', name:'Pick n Pay — National Portfolio', short:'PnP', sector:'retail',
    province:'Western Cape', city:'Cape Town', website:'https://www.picknpay.co.za', lat:-33.925, lng:18.424,
    annualGwh:420, peakMw:70, tariff:2.05, supply:'municipal', wheeling:'likely', nmd:90,
    status:'engaged', priority:'medium', nearest:'riverlands', estimated:true,
    description:'National retail estate with refrigeration-heavy load across many metered sites. Aggregated wheeling candidate.' },

  { id:'shoprite', name:'Shoprite Holdings — Distribution Network', short:'Shoprite', sector:'retail',
    province:'Western Cape', city:'Brackenfell', website:'https://www.shopriteholdings.co.za', lat:-33.873, lng:18.698,
    annualGwh:560, peakMw:88, tariff:2.10, supply:'municipal', wheeling:'likely', nmd:110,
    status:'prospect', priority:'medium', nearest:'riverlands', estimated:true,
    description:'Large cold-chain distribution footprint. Already an active renewable buyer — competitive process likely.' },

  { id:'teraco', name:'Teraco Data Environments', short:'Teraco', sector:'datacentre',
    province:'Gauteng', city:'Isando', website:'https://www.teraco.co.za', lat:-26.135, lng:28.208,
    annualGwh:640, peakMw:95, tariff:1.55, supply:'municipal', wheeling:'yes', nmd:130,
    status:'qualified', priority:'high', nearest:'middelburg', estimated:true,
    description:'Colocation operator with a stated 100% renewable commitment and an existing wheeling framework. Flat 24/7 load — ideal for solar+BESS.' },

  { id:'vodacom', name:'Vodacom South Africa — Network Estate', short:'Vodacom', sector:'commercial',
    province:'Gauteng', city:'Midrand', website:'https://www.vodacom.co.za', lat:-25.999, lng:28.126,
    annualGwh:380, peakMw:58, tariff:1.72, supply:'mixed', wheeling:'likely', nmd:80,
    status:'prospect', priority:'medium', nearest:'middelburg', estimated:true,
    description:'Base-station and data-centre estate. Distributed load across metros — aggregation contract shape.' },

  { id:'distell', name:'Heineken Beverages (Distell) — Stellenbosch', short:'Heineken Bev', sector:'industrial',
    province:'Western Cape', city:'Stellenbosch', website:'https://www.heinekenbeverages.com', lat:-33.934, lng:18.86,
    annualGwh:210, peakMw:34, tariff:1.88, supply:'municipal', wheeling:'likely', nmd:48,
    status:'prospect', priority:'medium', nearest:'riverlands', estimated:true,
    description:'Beverage production and bottling. Group-level science-based emissions target creates a clear PPA driver.' },

  { id:'astral', name:'Astral Foods — Processing Plants', short:'Astral', sector:'agriculture',
    province:'Gauteng', city:'Pretoria', website:'https://www.astralfoods.com', lat:-25.746, lng:28.188,
    annualGwh:290, peakMw:44, tariff:1.79, supply:'mixed', wheeling:'likely', nmd:62,
    status:'prospect', priority:'medium', nearest:'middelburg', estimated:true,
    description:'Poultry processing with continuous refrigeration load. Has publicly quantified load-shedding cost impact.' },

  { id:'clover', name:'Clover SA — Queensburgh & Clayville', short:'Clover', sector:'agriculture',
    province:'Gauteng', city:'Clayville', website:'https://www.clover.co.za', lat:-25.996, lng:28.283,
    annualGwh:160, peakMw:26, tariff:1.83, supply:'municipal', wheeling:'unknown', nmd:38,
    status:'prospect', priority:'low', nearest:'middelburg', estimated:true,
    description:'Dairy processing and cold chain. Smaller load — candidate for a portfolio/aggregated wheeling deal.' },

  { id:'pgbison', name:'PG Bison — Ugie Mill', short:'PG Bison', sector:'industrial',
    province:'Eastern Cape', city:'Ugie', website:'https://www.pgbison.co.za', lat:-31.213, lng:28.222,
    annualGwh:240, peakMw:36, tariff:1.44, supply:'eskom', wheeling:'unknown', nmd:52,
    status:'prospect', priority:'low', nearest:'oudtshoorn', estimated:true,
    description:'Board manufacturing mill with continuous process load in a weak-grid area.' },

  { id:'sanlam', name:'Sanlam — Bellville Campus & Property Portfolio', short:'Sanlam', sector:'commercial',
    province:'Western Cape', city:'Bellville', website:'https://www.sanlam.com', lat:-33.898, lng:18.63,
    annualGwh:95, peakMw:16, tariff:2.12, supply:'municipal', wheeling:'likely', nmd:24,
    status:'prospect', priority:'low', nearest:'riverlands', estimated:true,
    description:'Corporate campus plus managed property portfolio. ESG-reporting-driven buyer rather than cost-driven.' },

  { id:'stellenbosch-muni', name:'Stellenbosch Municipality', short:'Stellenbosch', sector:'municipality',
    province:'Western Cape', city:'Stellenbosch', website:'https://www.stellenbosch.gov.za', lat:-33.936, lng:18.86,
    annualGwh:480, peakMw:76, tariff:1.30, supply:'eskom', wheeling:'yes', nmd:105,
    status:'engaged', priority:'medium', nearest:'riverlands', estimated:true,
    description:'One of the municipalities with an active IPP procurement process under the amended ERA framework.' },
];

const SEED_CONTACTS = [
  { id:'c-sam-1', offtakerId:'samancor', first:'Procurement', last:'Lead', title:'Group Energy Procurement Manager',
    dept:'Supply Chain', email:'', phone:'', linkedin:'', role:'decision', priority:'high', status:'active',
    notes:'Placeholder — confirm the name before outreach. Owns the electricity contract.' },
  { id:'c-sam-2', offtakerId:'samancor', first:'Plant', last:'Engineering', title:'Head of Plant Engineering',
    dept:'Operations', email:'', phone:'', linkedin:'', role:'influencer', priority:'medium', status:'active',
    notes:'Technical sign-off on the connection point and supply quality.' },
  { id:'c-imp-1', offtakerId:'implats', first:'Renewables', last:'Programme', title:'Head of Renewable Energy Programme',
    dept:'Group Technical', email:'', phone:'', linkedin:'', role:'decision', priority:'high', status:'active',
    notes:'Runs the group renewable procurement process. Prefers structured RFPs over inbound approaches.' },
  { id:'c-amp-1', offtakerId:'angloplat', first:'Energy', last:'Manager', title:'Group Energy Manager',
    dept:'Sustainability', email:'', phone:'', linkedin:'', role:'decision', priority:'high', status:'active',
    notes:'Mogalakwena is the anchor site nearest the Mokopane project.' },
  { id:'c-exx-1', offtakerId:'exxaro', first:'Cennergi', last:'Team', title:'Business Development — Cennergi',
    dept:'Energy Business', email:'', phone:'', linkedin:'', role:'decision', priority:'high', status:'active',
    notes:'Exxaro develops its own renewables through Cennergi — position AEE as complementary, not competing.' },
  { id:'c-ter-1', offtakerId:'teraco', first:'Energy', last:'Strategy', title:'Head of Energy Strategy',
    dept:'Infrastructure', email:'', phone:'', linkedin:'', role:'decision', priority:'high', status:'active',
    notes:'Already wheeling. Needs firmed 24/7 supply — lead with the BESS component.' },
  { id:'c-col-1', offtakerId:'columbus', first:'Utilities', last:'Manager', title:'Utilities Manager',
    dept:'Operations', email:'', phone:'', linkedin:'', role:'influencer', priority:'high', status:'active',
    notes:'Municipal supply — a tripartite agreement with Steve Tshwete LM will be needed.' },
  { id:'c-sas-1', offtakerId:'sasol-secunda', first:'Renewable', last:'Procurement', title:'Renewable Procurement Lead',
    dept:'Energy Business', email:'', phone:'', linkedin:'', role:'decision', priority:'high', status:'active',
    notes:'Runs large competitive RFPs. Pre-qualification is the realistic first goal.' },
  { id:'c-pnp-1', offtakerId:'pnp', first:'Sustainability', last:'Lead', title:'Head of Sustainability',
    dept:'Group Services', email:'', phone:'', linkedin:'', role:'influencer', priority:'medium', status:'active',
    notes:'Drives the renewable mandate; finance signs the PPA.' },
  { id:'c-stb-1', offtakerId:'stellenbosch-muni', first:'Electrical', last:'Services', title:'Director: Electrical Services',
    dept:'Infrastructure', email:'', phone:'', linkedin:'', role:'decision', priority:'medium', status:'active',
    notes:'Municipal IPP procurement must follow MFMA process — expect a formal tender.' },
];

/* Stages the sales team moves a PPA opportunity through. */
const PIPELINE_STAGES = [
  { id:'identified', label:'Identified',      hint:'Load and site confirmed as a fit' },
  { id:'contacted',  label:'Contacted',       hint:'First meeting booked or held' },
  { id:'qualified',  label:'Qualified',       hint:'Load data shared, wheeling route understood' },
  { id:'proposal',   label:'Term Sheet',      hint:'Indicative tariff and volume on the table' },
  { id:'diligence',  label:'Due Diligence',   hint:'Technical, legal and credit review' },
  { id:'negotiation',label:'PPA Negotiation', hint:'Drafting and negotiating the agreement' },
  { id:'signed',     label:'Signed',          hint:'PPA executed' },
];

const SECTOR_LABEL = {
  mining:'Mining', smelter:'Smelter / Metals', industrial:'Heavy Industry', commercial:'Commercial',
  agriculture:'Agri-processing', datacentre:'Data Centre', retail:'Retail', municipality:'Municipality',
};

const STATUS_LABEL = {
  prospect:'Prospect', engaged:'Engaged', qualified:'Qualified',
  negotiating:'Negotiating', contracted:'Contracted', lost:'Lost',
};

const WHEELING_LABEL = { yes:'Confirmed', likely:'Likely', unknown:'Unknown', no:'Not feasible' };

/* Copy-and-send outreach material. Placeholders in {{braces}} are filled
   from the offtaker record when a template is opened from a detail page. */
const PLAYBOOK = [
  { id:'pb-cold-mining', tag:'Cold email', title:'Mining / smelter — cost-led opener',
    body:`Subject: Fixed-price renewable power for {{name}} — {{mw}} MW available from {{project}}

Hi {{firstName}},

African Earth Energy is developing {{project}} ({{projectMw}} MW solar with battery storage) in {{projectProvince}}, roughly {{distance}} from your {{city}} operation.

We are contracting wheeled power to industrial offtakers ahead of financial close. For a load of your size the structure is straightforward:

• 15–20 year PPA, rand-denominated, fixed escalation you can budget against
• Wheeled over the existing Eskom network — no change to your plant or connection
• Solar plus storage, so the shape matches your production profile rather than just daylight hours

On an indicative basis that typically lands 15–25% below a blended Megaflex tariff over the contract life, and removes exposure to above-inflation tariff increases.

Would a 30-minute call make sense to compare it against your current supply cost? If you can share a year of half-hourly data we will come back with a firm indicative tariff.

Regards,
{{sender}}
African Earth Energy | Energy from the ground up` },

  { id:'pb-cold-esg', tag:'Cold email', title:'Corporate / retail — ESG-led opener',
    body:`Subject: Additional renewable supply for {{name}} — verified, South African, additional

Hi {{firstName}},

We are contracting offtake from {{project}}, a {{projectMw}} MW solar and storage project in {{projectProvince}} reaching commercial operation in {{cod}}.

For a buyer with a public renewable target, three things usually matter:

• Additionality — this is new build, not resold attributes from existing plant
• Traceability — metered, wheeled electrons with certificates that stand up to assurance
• Certainty — a long-dated fixed-escalation price instead of an annual tariff surprise

{{name}}'s reported load of roughly {{annualGwh}} GWh a year could be covered in whole or in part, and we can start with a single site to prove the structure.

Could we put 30 minutes in the diary to walk through the contract shape?

Regards,
{{sender}}
African Earth Energy` },

  { id:'pb-followup', tag:'Follow-up', title:'No-reply follow-up (day 7)',
    body:`Hi {{firstName}},

Following up on my note about wheeled supply from {{project}}.

One thing worth knowing: allocation at this site is being committed ahead of financial close, and anchor offtakers get first call on both volume and tariff. That window is genuinely finite.

If renewable procurement sits with a colleague, I would be glad to be pointed their way.

Regards,
{{sender}}` },

  { id:'pb-discovery', tag:'Call script', title:'Discovery call — the ten questions',
    body:`Open: "Before I talk about our projects, I want to understand how you buy power today — otherwise I'm guessing."

LOAD
1. What is your annual consumption, and how has it moved over the last three years?
2. What does the daily and seasonal shape look like — is it flat, or does it follow production?
3. What is your notified maximum demand?

COMMERCIAL
4. What are you paying on a blended basis, all-in, per kWh?
5. Which tariff are you on, and are you exposed to Megaflex peak pricing?
6. What is load-shedding or curtailment costing you a year?

CONTRACT
7. Who signs an electricity supply agreement — and who else has to say yes?
8. What contract tenor could you realistically commit to?
9. Do you have a board-level renewable or emissions target with a date on it?

GRID
10. Who is your supply authority — Eskom direct, or a municipality?

Close: "If you can send a year of half-hourly data, we'll model your actual shape against our generation profile and come back with a real number rather than a brochure figure. Can we agree a date for that?"` },

  { id:'pb-objections', tag:'Objections', title:'Objection handling',
    body:`"We already have solar on the roof."
Rooftop typically covers 10–20% of an industrial load and does nothing at night. Wheeled utility-scale plus storage covers the rest. The two are complementary, not competing.

"Eskom is cheaper right now."
Compare over the contract life, not this month. Price the tariff path you expect over 15 years against a fixed escalation, and add what an unplanned outage costs you per hour.

"Your project only reaches COD in 2028/29."
That is exactly why we are talking now. Anchor offtakers set the terms and get first allocation; buyers who arrive after financial close take what is left, at the price that is left.

"Wheeling is too complicated."
It is a well-trodden path in South Africa now — there are existing wheeling agreements running with Eskom and with several municipalities. We handle the use-of-system application and the metering. Your plant does not change.

"We can't commit to 15 years."
We can shape it — a shorter firm term with extension options, or a partial volume that grows. Start with one site.

"How do we know you'll actually build it?"
Fair question. Ask for the environmental authorisation, the grid cost estimate letter, and the land agreements. We will show you all three.` },

  { id:'pb-qualify', tag:'Checklist', title:'Qualification checklist — is this a real deal?',
    body:`Score each. Four or more yes answers means it is worth a term sheet.

☐ Annual consumption above 20 GWh (below that, the transaction cost rarely justifies itself)
☐ Load factor above 50% — flat load matches solar+BESS far better than a spiky one
☐ You have identified the person who actually signs, not just the person who is interested
☐ A board-level renewable or cost mandate exists, with a date attached
☐ The supply authority is known and wheeling is feasible at their connection point
☐ Creditworthy counterparty — a lender will have to take a view on them
☐ They have shared, or agreed to share, half-hourly consumption data
☐ Their timeline is compatible with our COD

Red flags: no named signatory after three meetings; "send us a proposal" with no data shared; a procurement process already at RFP stage that we were not invited to.` },
];
