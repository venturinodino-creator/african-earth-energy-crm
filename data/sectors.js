/* ═══════════════════════════════════════════════════════════════════
   Offtaker sector taxonomy — South Africa, non-mining.

   Source: AEEG-offtaker-sectors.xlsx v1.1.0, generated 2026-09-14.
   29 sectors, 164 sub-sectors, 107 qualifying questions, 39 objections
   and 22 contact roles, plus the market context the desk works to.

   This is market knowledge rather than pipeline, so it ships with the
   app and needs no sync. The company prospecting list from the same
   workbook is NOT here — it is the target list, so it lives in
   Supabase behind Row Level Security like every other customer record.

   The taxonomy deliberately excludes mining: AEE's mining prospects are
   tracked as offtakers in their own right, and MINING_SECTOR below keeps
   a home for them alongside the 29.

   Point in time: tariff benchmarks and sector figures are as at
   2026-Q3. Re-verify before putting any number in front of a client.
   ═══════════════════════════════════════════════════════════════════ */

/* Tier 1 = prospect now. 2 = real pipeline, longer cycle.
   3 = opportunistic or inbound only.
   ppaFit 1-5 = how readily the load, connection and procurement suit a PPA. */
const SECTORS = [
 {
  "id": "automotive-manufacturing",
  "name": "Automotive & Heavy Manufacturing",
  "tier": 1,
  "group": "manufacturing",
  "ppaFit": 5,
  "why": "Paint shops, press lines, robotic body shops and compressed air systems. Paint ovens and air handling dominate and run through both shifts, and OEM parent companies impose renewable targets from Europe and Japan.",
  "loadMw": "5 - 60",
  "annualGwh": "30 - 400",
  "profile": "Two-shift (≈16h, weekday-weighted)",
  "solarMatch": "medium",
  "grid": "MV, usually municipal (Kariega, Tshwane, East London IDZ, Durban, Gqeberha)",
  "structures": [
   "Physical wheeled PPA (Eskom or municipal network)",
   "Behind-the-meter generation (rooftop / ground-mount on site)",
   "Virtual / financial PPA (CfD)"
  ],
  "dealMw": "10 - 80",
  "cycleMonths": "9-18",
  "triggers": [
   "OEM, retailer or lender pushing renewable supply down the chain",
   "Published Scope 2 / net-zero target with a near date",
   "CBAM or export customer carbon requirement",
   "Eskom / municipal tariff increase",
   "Supply interruption or curtailment exposure"
  ],
  "roles": [
   "Site General Manager",
   "Energy Manager",
   "Head of ESG / Group Sustainability Manager",
   "Chief Financial Officer",
   "Head of Procurement / Chief Procurement Officer",
   "Group Engineering Manager / Technical Director"
  ],
  "subSectors": [
   "Vehicle assembly (OEM)",
   "Component & tier-1 suppliers",
   "Tyre manufacturing",
   "Rail & heavy equipment",
   "Appliance manufacturing"
  ],
  "companyCount": 14
 },
 {
  "id": "chemicals-petrochemicals",
  "name": "Chemicals & Petrochemicals",
  "tier": 1,
  "group": "heavy-industry",
  "ppaFit": 5,
  "why": "Continuous process plants with electrolysis, compression, cryogenic separation and pumping running without interruption. Chlor-alkali and industrial gas plants in particular are effectively electricity converted into product.",
  "loadMw": "10 - 600",
  "annualGwh": "80 - 4000",
  "profile": "Flat baseload (24/7)",
  "solarMatch": "low",
  "grid": "MV/HV, often a dedicated substation on an industrial complex",
  "structures": [
   "Physical wheeled PPA (Eskom or municipal network)",
   "Hybrid solar + wind + storage",
   "Virtual / financial PPA (CfD)"
  ],
  "dealMw": "30 - 300",
  "cycleMonths": "9-24",
  "triggers": [
   "Eskom / municipal tariff increase",
   "Published Scope 2 / net-zero target with a near date",
   "Carbon tax phase-down of allowances",
   "CBAM or export customer carbon requirement",
   "New plant, line or site needing a grid connection"
  ],
  "roles": [
   "Energy Director / Group Head of Energy",
   "Chief Sustainability Officer",
   "Chief Operating Officer",
   "Chief Financial Officer",
   "Plant / Works Manager",
   "Head of Procurement / Chief Procurement Officer"
  ],
  "subSectors": [
   "Chlor-alkali",
   "Industrial gases (air separation)",
   "Fertiliser & explosives",
   "Polymers & plastics",
   "Synthetic fuels",
   "Paints & coatings",
   "Pharmaceutical manufacturing"
  ],
  "companyCount": 12
 },
 {
  "id": "property-reits-malls",
  "name": "Commercial Property, REITs & Shopping Centres",
  "tier": 1,
  "group": "commercial",
  "ppaFit": 5,
  "why": "A regional mall runs 5-15MW of HVAC, lighting, escalators and tenant supply. Landlords buy bulk and resell to tenants through embedded networks, so electricity is a revenue line as well as a cost — which makes the margin on cheaper energy directly attributable.",
  "loadMw": "2 - 200",
  "annualGwh": "15 - 900",
  "profile": "Daytime-peaked (business hours)",
  "solarMatch": "high",
  "grid": "MV bulk supply point per property, mostly municipal",
  "structures": [
   "Physical wheeled PPA (Eskom or municipal network)",
   "Behind-the-meter generation (rooftop / ground-mount on site)",
   "Virtual wheeling"
  ],
  "dealMw": "20 - 150",
  "cycleMonths": "9-18",
  "triggers": [
   "Eskom / municipal tariff increase",
   "Published Scope 2 / net-zero target with a near date",
   "Supply interruption or curtailment exposure",
   "Heavy backup diesel or generator spend",
   "New plant, line or site needing a grid connection"
  ],
  "roles": [
   "Head of Asset Management (REIT)",
   "Facilities / Property Director",
   "Head of Utilities / Utilities Manager",
   "Head of ESG / Group Sustainability Manager",
   "Chief Financial Officer",
   "Head of Procurement / Chief Procurement Officer"
  ],
  "subSectors": [
   "Super-regional & regional malls",
   "Office parks & P-grade office",
   "Industrial & logistics parks",
   "Mixed-use precincts",
   "Student accommodation"
  ],
  "companyCount": 14
 },
 {
  "id": "data-centres",
  "name": "Data Centres & Digital Infrastructure",
  "tier": 1,
  "group": "digital",
  "ppaFit": 5,
  "why": "The purest baseload in the economy — IT load plus cooling, 8,760 hours a year, growing with every AI deployment. Power availability is now the binding constraint on new capacity in Johannesburg and Cape Town.",
  "loadMw": "5 - 250",
  "annualGwh": "40 - 2000",
  "profile": "Flat baseload (24/7)",
  "solarMatch": "low",
  "grid": "HV/MV, dedicated feeds, often with a firm capacity reservation",
  "structures": [
   "Physical wheeled PPA (Eskom or municipal network)",
   "Hybrid solar + wind + storage",
   "Virtual / financial PPA (CfD)"
  ],
  "dealMw": "30 - 300",
  "cycleMonths": "9-24",
  "triggers": [
   "New plant, line or site needing a grid connection",
   "Published Scope 2 / net-zero target with a near date",
   "OEM, retailer or lender pushing renewable supply down the chain",
   "Eskom / municipal tariff increase",
   "Supply interruption or curtailment exposure"
  ],
  "roles": [
   "CTO / Chief Technology Officer",
   "Head of Infrastructure / Data Centre Operations",
   "Energy Director / Group Head of Energy",
   "Chief Financial Officer",
   "Head of ESG / Group Sustainability Manager",
   "CEO / Managing Director"
  ],
  "subSectors": [
   "Colocation & carrier-neutral facilities",
   "Hyperscale cloud regions",
   "AI / GPU compute facilities",
   "Enterprise & banking data centres",
   "Edge facilities"
  ],
  "companyCount": 12
 },
 {
  "id": "retail-multi-site",
  "name": "Retail Chains (Multi-Site)",
  "tier": 1,
  "group": "commercial",
  "ppaFit": 5,
  "why": "No single store is large, but a national chain aggregates to hundreds of GWh across thousands of meters, dominated by refrigeration, HVAC and lighting through trading hours.",
  "loadMw": "20 - 250",
  "annualGwh": "150 - 1500",
  "profile": "Distributed low-voltage estate",
  "solarMatch": "medium",
  "grid": "Mostly LV across many municipalities; DCs and large hypermarkets at MV",
  "structures": [
   "Virtual wheeling",
   "Behind-the-meter generation (rooftop / ground-mount on site)",
   "Virtual / financial PPA (CfD)"
  ],
  "dealMw": "30 - 200",
  "cycleMonths": "9-18",
  "triggers": [
   "Eskom / municipal tariff increase",
   "Published Scope 2 / net-zero target with a near date",
   "Heavy backup diesel or generator spend",
   "Supply interruption or curtailment exposure"
  ],
  "roles": [
   "Head of ESG / Group Sustainability Manager",
   "Facilities / Property Director",
   "Energy Manager",
   "Chief Financial Officer",
   "Head of Procurement / Chief Procurement Officer",
   "Operations Director"
  ],
  "subSectors": [
   "Grocery & supermarkets",
   "Discount & general merchandise",
   "Fashion & speciality",
   "Pharmacy & health retail",
   "Fuel forecourts & convenience",
   "Quick-service restaurant chains"
  ],
  "companyCount": 13
 },
 {
  "id": "smelting-ferroalloys",
  "name": "Smelting, Ferroalloys & Primary Metals",
  "tier": 1,
  "group": "heavy-industry",
  "ppaFit": 5,
  "why": "Electric arc and submerged arc furnaces convert electricity directly into process heat. Power is typically 30-50% of the cash cost of a tonne of ferrochrome or aluminium — it is the single largest input, not an overhead.",
  "loadMw": "30 - 1400",
  "annualGwh": "250 - 10000",
  "profile": "Flat baseload (24/7)",
  "solarMatch": "low",
  "grid": "Transmission or 132kV+ distribution, frequently Eskom-supplied direct",
  "structures": [
   "Hybrid solar + wind + storage",
   "Physical wheeled PPA (Eskom or municipal network)",
   "Virtual / financial PPA (CfD)"
  ],
  "dealMw": "50 - 400",
  "cycleMonths": "12-30",
  "triggers": [
   "Eskom / municipal tariff increase",
   "CBAM or export customer carbon requirement",
   "Supply interruption or curtailment exposure",
   "Carbon tax phase-down of allowances",
   "Published Scope 2 / net-zero target with a near date"
  ],
  "roles": [
   "Energy Director / Group Head of Energy",
   "Chief Operating Officer",
   "Chief Financial Officer",
   "Site General Manager",
   "Group Engineering Manager / Technical Director",
   "Head of Procurement / Chief Procurement Officer"
  ],
  "subSectors": [
   "Ferrochrome",
   "Ferromanganese",
   "Aluminium",
   "Silicon & silicon metal",
   "Steel (EAF & integrated)",
   "Stainless steel",
   "Vanadium & titanium processing"
  ],
  "companyCount": 12
 },
 {
  "id": "telecoms-towers",
  "name": "Telecommunications & Tower Networks",
  "tier": 1,
  "group": "digital",
  "ppaFit": 5,
  "why": "Base stations, switching centres and core network sites run continuously across tens of thousands of distributed points. Backup diesel and battery replacement after outages has been a very large cost line for SA operators.",
  "loadMw": "20 - 200",
  "annualGwh": "150 - 1200",
  "profile": "Distributed low-voltage estate",
  "solarMatch": "medium",
  "grid": "Predominantly LV across a very large number of municipalities, with MV at core sites",
  "structures": [
   "Virtual wheeling",
   "Virtual / financial PPA (CfD)",
   "Behind-the-meter generation (rooftop / ground-mount on site)"
  ],
  "dealMw": "40 - 200",
  "cycleMonths": "9-18",
  "triggers": [
   "Heavy backup diesel or generator spend",
   "Published Scope 2 / net-zero target with a near date",
   "Eskom / municipal tariff increase",
   "Supply interruption or curtailment exposure"
  ],
  "roles": [
   "CTO / Chief Technology Officer",
   "Head of Infrastructure / Data Centre Operations",
   "Energy Manager",
   "Head of ESG / Group Sustainability Manager",
   "Chief Financial Officer",
   "Head of Procurement / Chief Procurement Officer"
  ],
  "subSectors": [
   "Mobile network operators",
   "Tower companies",
   "Fibre network operators",
   "Satellite & broadcast"
  ],
  "companyCount": 11
 },
 {
  "id": "cement-lime-aggregates",
  "name": "Cement, Lime, Glass & Building Materials",
  "tier": 1,
  "group": "heavy-industry",
  "ppaFit": 4,
  "why": "Kilns, grinding mills and glass furnaces run continuously. Electricity is 15-25% of cement production cost and glass furnaces cannot be switched off without destroying the tank.",
  "loadMw": "8 - 90",
  "annualGwh": "60 - 700",
  "profile": "Flat baseload (24/7)",
  "solarMatch": "low",
  "grid": "MV, often rural or peri-urban Eskom supply near quarries",
  "structures": [
   "Physical wheeled PPA (Eskom or municipal network)",
   "Behind-the-meter generation (rooftop / ground-mount on site)",
   "Hybrid solar + wind + storage"
  ],
  "dealMw": "15 - 120",
  "cycleMonths": "9-18",
  "triggers": [
   "Eskom / municipal tariff increase",
   "Carbon tax phase-down of allowances",
   "Published Scope 2 / net-zero target with a near date",
   "Supply interruption or curtailment exposure"
  ],
  "roles": [
   "Operations Director",
   "Energy Manager",
   "Plant / Works Manager",
   "Chief Financial Officer",
   "Head of ESG / Group Sustainability Manager"
  ],
  "subSectors": [
   "Cement & clinker",
   "Lime",
   "Container & float glass",
   "Bricks & ceramics",
   "Aggregates & ready-mix"
  ],
  "companyCount": 11
 },
 {
  "id": "food-beverage-processing",
  "name": "Food & Beverage Processing",
  "tier": 1,
  "group": "manufacturing",
  "ppaFit": 4,
  "why": "Refrigeration, pasteurisation, milling, ovens and CIP cleaning. Refrigeration alone is typically 40-60% of a processing plant's electricity, and it runs continuously.",
  "loadMw": "2 - 40",
  "annualGwh": "15 - 300",
  "profile": "Two-shift (≈16h, weekday-weighted)",
  "solarMatch": "medium",
  "grid": "MV, mixed Eskom and municipal",
  "structures": [
   "Behind-the-meter generation (rooftop / ground-mount on site)",
   "Physical wheeled PPA (Eskom or municipal network)",
   "Aggregated / pooled PPA"
  ],
  "dealMw": "5 - 60",
  "cycleMonths": "6-15",
  "triggers": [
   "Eskom / municipal tariff increase",
   "Supply interruption or curtailment exposure",
   "Heavy backup diesel or generator spend",
   "OEM, retailer or lender pushing renewable supply down the chain",
   "Published Scope 2 / net-zero target with a near date"
  ],
  "roles": [
   "Operations Director",
   "Group Engineering Manager / Technical Director",
   "Chief Financial Officer",
   "Energy Manager",
   "Head of ESG / Group Sustainability Manager"
  ],
  "subSectors": [
   "Poultry & abattoirs",
   "Dairy",
   "Breweries & beverages",
   "Milling & baking",
   "Sugar",
   "Fruit & vegetable processing",
   "Fishing & fish processing",
   "Edible oils"
  ],
  "companyCount": 18
 },
 {
  "id": "financial-services-bpo",
  "name": "Banking, Insurance & BPO / Contact Centres",
  "tier": 2,
  "group": "commercial",
  "ppaFit": 4,
  "why": "Head-office campuses, national branch estates, ATM networks and — in the BPO case — dense floors of workstations running long shifts. South Africa's offshore contact-centre industry has built very large, always-lit facilities in Cape Town, Durban and Johannesburg.",
  "loadMw": "5 - 120",
  "annualGwh": "40 - 700",
  "profile": "Distributed low-voltage estate",
  "solarMatch": "medium",
  "grid": "MV at campuses and data centres, LV across branches",
  "structures": [
   "Virtual wheeling",
   "Physical wheeled PPA (Eskom or municipal network)",
   "Virtual / financial PPA (CfD)"
  ],
  "dealMw": "15 - 100",
  "cycleMonths": "9-20",
  "triggers": [
   "Published Scope 2 / net-zero target with a near date",
   "Eskom / municipal tariff increase",
   "Heavy backup diesel or generator spend",
   "OEM, retailer or lender pushing renewable supply down the chain",
   "Supply interruption or curtailment exposure"
  ],
  "roles": [
   "Head of ESG / Group Sustainability Manager",
   "Facilities / Property Director",
   "Head of Utilities / Utilities Manager",
   "Chief Financial Officer",
   "Head of Procurement / Chief Procurement Officer",
   "Chief Operating Officer"
  ],
  "subSectors": [
   "Retail banking branch networks",
   "Head-office campuses",
   "Insurance & asset management",
   "BPO / offshore contact centres",
   "Payment processing"
  ],
  "companyCount": 6
 },
 {
  "id": "cold-chain-logistics",
  "name": "Cold Chain, Warehousing & Logistics",
  "tier": 2,
  "group": "logistics",
  "ppaFit": 4,
  "why": "Refrigerated and frozen warehouses draw continuously regardless of throughput, and large distribution centres add lighting, MHE charging and increasingly electric fleet charging.",
  "loadMw": "1 - 20",
  "annualGwh": "8 - 150",
  "profile": "Flat baseload (24/7)",
  "solarMatch": "low",
  "grid": "MV, mostly municipal or metro-supplied industrial parks",
  "structures": [
   "Behind-the-meter generation (rooftop / ground-mount on site)",
   "Aggregated / pooled PPA",
   "Physical wheeled PPA (Eskom or municipal network)"
  ],
  "dealMw": "3 - 40",
  "cycleMonths": "6-12",
  "triggers": [
   "Eskom / municipal tariff increase",
   "Supply interruption or curtailment exposure",
   "Heavy backup diesel or generator spend",
   "New plant, line or site needing a grid connection",
   "Published Scope 2 / net-zero target with a near date"
  ],
  "roles": [
   "Facilities / Property Director",
   "Head of Supply Chain / Logistics Director",
   "Energy Manager",
   "Operations Director",
   "Chief Financial Officer"
  ],
  "subSectors": [
   "Cold storage operators",
   "Retail distribution centres",
   "Third-party logistics parks",
   "Port cold stores",
   "Fleet charging depots"
  ],
  "companyCount": 10
 },
 {
  "id": "green-hydrogen-newindustry",
  "name": "Green Hydrogen, Ammonia & New Industrial Demand",
  "tier": 2,
  "group": "emerging",
  "ppaFit": 4,
  "why": "Electrolysis is the most electricity-intensive industrial process there is — a green ammonia plant is a renewable energy project with a chemical plant attached. Demand does not exist until the supply is contracted, so the PPA is the project.",
  "loadMw": "50 - 2000",
  "annualGwh": "400 - 15000",
  "profile": "Flat baseload (24/7)",
  "solarMatch": "low",
  "grid": "Dedicated HV, usually co-located with generation in the Northern or Eastern Cape",
  "structures": [
   "Hybrid solar + wind + storage",
   "Physical wheeled PPA (Eskom or municipal network)",
   "Virtual / financial PPA (CfD)"
  ],
  "dealMw": "100 - 1000",
  "cycleMonths": "18-48",
  "triggers": [
   "New plant, line or site needing a grid connection",
   "CBAM or export customer carbon requirement",
   "OEM, retailer or lender pushing renewable supply down the chain",
   "Published Scope 2 / net-zero target with a near date"
  ],
  "roles": [
   "CEO / Managing Director",
   "Strategy Director",
   "CTO / Chief Technology Officer",
   "Chief Financial Officer",
   "Energy Director / Group Head of Energy"
  ],
  "subSectors": [
   "Green hydrogen & ammonia",
   "Sustainable aviation fuel",
   "Battery & cathode manufacturing",
   "Vertical farming & controlled-environment agriculture",
   "Bitcoin & crypto mining"
  ],
  "companyCount": 5
 },
 {
  "id": "healthcare",
  "name": "Hospital Groups & Healthcare",
  "tier": 2,
  "group": "commercial",
  "ppaFit": 4,
  "why": "Hospitals run 24/7 with HVAC, sterilisation, imaging, medical gas plant and no tolerance for interruption. Load is flat, credit is strong and continuity risk is the dominant concern.",
  "loadMw": "1 - 60",
  "annualGwh": "10 - 450",
  "profile": "Flat baseload (24/7)",
  "solarMatch": "low",
  "grid": "MV per facility, mostly municipal",
  "structures": [
   "Virtual wheeling",
   "Behind-the-meter generation (rooftop / ground-mount on site)",
   "Physical wheeled PPA (Eskom or municipal network)"
  ],
  "dealMw": "10 - 60",
  "cycleMonths": "9-18",
  "triggers": [
   "Eskom / municipal tariff increase",
   "Heavy backup diesel or generator spend",
   "Supply interruption or curtailment exposure",
   "Published Scope 2 / net-zero target with a near date"
  ],
  "roles": [
   "Facilities / Property Director",
   "Group Engineering Manager / Technical Director",
   "Chief Financial Officer",
   "Head of ESG / Group Sustainability Manager",
   "Head of Procurement / Chief Procurement Officer"
  ],
  "subSectors": [
   "Private hospital groups",
   "Public hospitals",
   "Pathology & laboratory networks",
   "Pharmaceutical manufacturing",
   "Day clinics"
  ],
  "companyCount": 10
 },
 {
  "id": "mineral-beneficiation",
  "name": "Mineral Beneficiation & Processing (Non-Mine)",
  "tier": 2,
  "group": "heavy-industry",
  "ppaFit": 4,
  "why": "Standalone concentrators, refineries, tailings retreatment plants and beneficiation facilities that sit outside a mining right and buy power in their own name. Comminution — crushing and milling — is the single largest electricity consumer in any mineral value chain.",
  "loadMw": "5 - 150",
  "annualGwh": "40 - 1100",
  "profile": "Flat baseload (24/7)",
  "solarMatch": "low",
  "grid": "MV/HV, Eskom-supplied on plant sites",
  "structures": [
   "Physical wheeled PPA (Eskom or municipal network)",
   "Hybrid solar + wind + storage",
   "Behind-the-meter generation (rooftop / ground-mount on site)"
  ],
  "dealMw": "15 - 150",
  "cycleMonths": "9-20",
  "triggers": [
   "Eskom / municipal tariff increase",
   "CBAM or export customer carbon requirement",
   "Published Scope 2 / net-zero target with a near date",
   "OEM, retailer or lender pushing renewable supply down the chain",
   "New plant, line or site needing a grid connection"
  ],
  "roles": [
   "Energy Director / Group Head of Energy",
   "Operations Director",
   "Plant / Works Manager",
   "Chief Financial Officer",
   "Chief Sustainability Officer",
   "Group Engineering Manager / Technical Director"
  ],
  "subSectors": [
   "Precious metals refining",
   "Base metal refineries",
   "Tailings retreatment",
   "Standalone concentrators & toll milling",
   "Mineral sands separation",
   "Diamond cutting & polishing"
  ],
  "companyCount": 7
 },
 {
  "id": "agriculture-agriprocessing",
  "name": "Agriculture, Irrigation & Agri-Processing",
  "tier": 2,
  "group": "primary",
  "ppaFit": 3,
  "why": "Centre-pivot and drip irrigation pumping, pack-house pre-cooling, controlled-atmosphere storage and grain drying. Load peaks in daylight hours in summer, which is the best natural solar match of any sector.",
  "loadMw": "0.5 - 25",
  "annualGwh": "2 - 120",
  "profile": "Strongly seasonal",
  "solarMatch": "variable",
  "grid": "Rural Eskom MV, often at the end of long, weak feeders",
  "structures": [
   "Behind-the-meter generation (rooftop / ground-mount on site)",
   "Aggregated / pooled PPA",
   "Physical wheeled PPA (Eskom or municipal network)"
  ],
  "dealMw": "1 - 30",
  "cycleMonths": "4-12",
  "triggers": [
   "Eskom / municipal tariff increase",
   "Supply interruption or curtailment exposure",
   "Heavy backup diesel or generator spend",
   "OEM, retailer or lender pushing renewable supply down the chain"
  ],
  "roles": [
   "Farm / Estate Manager",
   "Operations Director",
   "Chief Financial Officer",
   "Group Engineering Manager / Technical Director",
   "CEO / Managing Director"
  ],
  "subSectors": [
   "Irrigated row crops & orchards",
   "Table grapes & citrus",
   "Pack-houses & pre-cooling",
   "Grain storage & silos",
   "Intensive livestock & poultry houses",
   "Greenhouses & protected cropping",
   "Wine cellars"
  ],
  "companyCount": 11
 },
 {
  "id": "foundries-fabrication",
  "name": "Foundries, Galvanising & Metal Fabrication",
  "tier": 2,
  "group": "manufacturing",
  "ppaFit": 3,
  "why": "Induction and arc melting furnaces, heat treatment ovens and hot-dip galvanising kettles held at temperature continuously. Smaller than a smelter but the same physics, and there are hundreds of them clustered around Gauteng and Gqeberha.",
  "loadMw": "1 - 25",
  "annualGwh": "5 - 150",
  "profile": "Two-shift (≈16h, weekday-weighted)",
  "solarMatch": "medium",
  "grid": "MV, mostly municipal industrial townships",
  "structures": [
   "Aggregated / pooled PPA",
   "Behind-the-meter generation (rooftop / ground-mount on site)",
   "Physical wheeled PPA (Eskom or municipal network)"
  ],
  "dealMw": "3 - 30",
  "cycleMonths": "6-14",
  "triggers": [
   "Eskom / municipal tariff increase",
   "Supply interruption or curtailment exposure",
   "Carbon tax phase-down of allowances",
   "OEM, retailer or lender pushing renewable supply down the chain"
  ],
  "roles": [
   "Plant / Works Manager",
   "Operations Director",
   "Chief Financial Officer",
   "Group Engineering Manager / Technical Director",
   "CEO / Managing Director"
  ],
  "subSectors": [
   "Iron & steel foundries",
   "Non-ferrous foundries",
   "Hot-dip galvanising",
   "Heat treatment",
   "Structural steel fabrication",
   "Wire & cable drawing",
   "Forging & pressing"
  ],
  "companyCount": 8
 },
 {
  "id": "municipalities-public",
  "name": "Municipalities & Public Sector Estates",
  "tier": 2,
  "group": "utilities-public",
  "ppaFit": 3,
  "why": "Metros buy bulk from Eskom and resell to residents and businesses, and separately run their own estate of street lighting, water works, depots and buildings. Several metros now procure directly from IPPs to reduce Eskom dependence.",
  "loadMw": "20 - 3000",
  "annualGwh": "150 - 12000",
  "profile": "Flat baseload (24/7)",
  "solarMatch": "low",
  "grid": "Bulk HV intake plus a distributed estate",
  "structures": [
   "Physical wheeled PPA (Eskom or municipal network)",
   "Aggregated / pooled PPA",
   "Virtual / financial PPA (CfD)"
  ],
  "dealMw": "50 - 500",
  "cycleMonths": "18-42",
  "triggers": [
   "Eskom / municipal tariff increase",
   "Supply interruption or curtailment exposure",
   "New plant, line or site needing a grid connection",
   "Published Scope 2 / net-zero target with a near date"
  ],
  "roles": [
   "Municipal Electrical Engineer / Head of Energy",
   "Head of Utilities / Utilities Manager",
   "Municipal Supply Chain Manager",
   "Chief Financial Officer",
   "Strategy Director"
  ],
  "subSectors": [
   "Metropolitan municipalities",
   "District & local municipalities",
   "Provincial government estates",
   "National departments & SOEs",
   "Public housing"
  ],
  "companyCount": 11
 },
 {
  "id": "oil-refining-terminals",
  "name": "Oil Refining, Fuel Terminals & Pipelines",
  "tier": 2,
  "group": "heavy-industry",
  "ppaFit": 3,
  "why": "Refineries and depots run large pump and compressor trains, tank heating and vapour recovery continuously. Even mothballed or converted refineries retain very significant terminal and storage loads.",
  "loadMw": "3 - 120",
  "annualGwh": "25 - 900",
  "profile": "Flat baseload (24/7)",
  "solarMatch": "low",
  "grid": "MV/HV at coastal terminals and inland depots",
  "structures": [
   "Physical wheeled PPA (Eskom or municipal network)",
   "Behind-the-meter generation (rooftop / ground-mount on site)",
   "Virtual / financial PPA (CfD)"
  ],
  "dealMw": "10 - 100",
  "cycleMonths": "12-24",
  "triggers": [
   "Eskom / municipal tariff increase",
   "Published Scope 2 / net-zero target with a near date",
   "Carbon tax phase-down of allowances",
   "Supply interruption or curtailment exposure"
  ],
  "roles": [
   "Energy Manager",
   "Plant / Works Manager",
   "Operations Director",
   "Head of ESG / Group Sustainability Manager",
   "Chief Financial Officer",
   "Head of Procurement / Chief Procurement Officer"
  ],
  "subSectors": [
   "Crude refining",
   "Import terminals & tank farms",
   "Pipeline pumping stations",
   "LPG storage & filling",
   "Lubricants blending",
   "Bitumen plants"
  ],
  "companyCount": 6
 },
 {
  "id": "transport-ports-rail",
  "name": "Ports, Rail & Transport Infrastructure",
  "tier": 2,
  "group": "utilities-public",
  "ppaFit": 3,
  "why": "Electrified rail traction, ship-to-shore cranes, reefer plug points at container terminals and airport terminal HVAC. Transnet's traction load alone is among the largest single consumers in the country.",
  "loadMw": "5 - 500",
  "annualGwh": "40 - 3000",
  "profile": "Two-shift (≈16h, weekday-weighted)",
  "solarMatch": "medium",
  "grid": "HV traction supply and MV terminal supply",
  "structures": [
   "Physical wheeled PPA (Eskom or municipal network)",
   "Hybrid solar + wind + storage",
   "Behind-the-meter generation (rooftop / ground-mount on site)"
  ],
  "dealMw": "20 - 250",
  "cycleMonths": "18-36",
  "triggers": [
   "Eskom / municipal tariff increase",
   "Published Scope 2 / net-zero target with a near date",
   "OEM, retailer or lender pushing renewable supply down the chain",
   "New plant, line or site needing a grid connection"
  ],
  "roles": [
   "Head of Utilities / Utilities Manager",
   "Group Engineering Manager / Technical Director",
   "Operations Director",
   "Chief Financial Officer",
   "Head of Procurement / Chief Procurement Officer",
   "Head of ESG / Group Sustainability Manager"
  ],
  "subSectors": [
   "Container & bulk ports",
   "Electrified freight rail",
   "Airports",
   "Passenger rail",
   "Pipeline pumping",
   "EV charging networks"
  ],
  "companyCount": 6
 },
 {
  "id": "pulp-paper-packaging",
  "name": "Pulp, Paper & Packaging",
  "tier": 2,
  "group": "heavy-industry",
  "ppaFit": 3,
  "why": "Paper machines, refiners and pulping lines run 24/7 with very high motor loads. Mills are among the largest single industrial consumers in KwaZulu-Natal and Mpumalanga.",
  "loadMw": "5 - 150",
  "annualGwh": "40 - 1100",
  "profile": "Flat baseload (24/7)",
  "solarMatch": "low",
  "grid": "MV/HV, mill-scale substations",
  "structures": [
   "Physical wheeled PPA (Eskom or municipal network)",
   "Virtual / financial PPA (CfD)",
   "Behind-the-meter generation (rooftop / ground-mount on site)"
  ],
  "dealMw": "10 - 100",
  "cycleMonths": "9-20",
  "triggers": [
   "Eskom / municipal tariff increase",
   "Published Scope 2 / net-zero target with a near date",
   "OEM, retailer or lender pushing renewable supply down the chain",
   "Carbon tax phase-down of allowances"
  ],
  "roles": [
   "Energy Manager",
   "Group Engineering Manager / Technical Director",
   "Operations Director",
   "Head of ESG / Group Sustainability Manager",
   "Chief Financial Officer"
  ],
  "subSectors": [
   "Pulp mills",
   "Paper & board mills",
   "Corrugated packaging",
   "Tissue",
   "Rigid & flexible plastics packaging"
  ],
  "companyCount": 5
 },
 {
  "id": "water-wastewater",
  "name": "Water Utilities, Bulk Water & Wastewater",
  "tier": 2,
  "group": "utilities-public",
  "ppaFit": 3,
  "why": "Pumping is pure electricity. Bulk water boards move billions of litres uphill continuously, and wastewater treatment works aerate 24/7. Water infrastructure is one of the largest non-industrial electricity consumers in the country.",
  "loadMw": "5 - 300",
  "annualGwh": "40 - 2000",
  "profile": "Flat baseload (24/7)",
  "solarMatch": "low",
  "grid": "MV/HV at pump stations and treatment works, often rural Eskom supply",
  "structures": [
   "Physical wheeled PPA (Eskom or municipal network)",
   "Behind-the-meter generation (rooftop / ground-mount on site)",
   "Aggregated / pooled PPA"
  ],
  "dealMw": "10 - 150",
  "cycleMonths": "18-36",
  "triggers": [
   "Eskom / municipal tariff increase",
   "New plant, line or site needing a grid connection",
   "Supply interruption or curtailment exposure",
   "Published Scope 2 / net-zero target with a near date"
  ],
  "roles": [
   "Head of Utilities / Utilities Manager",
   "Group Engineering Manager / Technical Director",
   "Chief Financial Officer",
   "Municipal Electrical Engineer / Head of Energy",
   "Municipal Supply Chain Manager",
   "Operations Director"
  ],
  "subSectors": [
   "Bulk water boards",
   "Municipal water & sanitation",
   "Wastewater treatment works",
   "Desalination",
   "Mine water treatment",
   "Irrigation schemes"
  ],
  "companyCount": 10
 },
 {
  "id": "aquaculture-marine",
  "name": "Aquaculture, Abalone & Marine Processing",
  "tier": 3,
  "group": "primary",
  "ppaFit": 3,
  "why": "Land-based abalone and fish farms pump and oxygenate seawater 24 hours a day, every day, forever — an interruption kills stock. It is one of the most unforgiving continuous pumping loads in the country and sits right on the wind-rich southern coast.",
  "loadMw": "0.5 - 12",
  "annualGwh": "4 - 90",
  "profile": "Flat baseload (24/7)",
  "solarMatch": "low",
  "grid": "Rural and coastal Eskom MV, often weak feeders",
  "structures": [
   "Behind-the-meter generation (rooftop / ground-mount on site)",
   "Aggregated / pooled PPA",
   "Hybrid solar + wind + storage"
  ],
  "dealMw": "1 - 15",
  "cycleMonths": "5-12",
  "triggers": [
   "Supply interruption or curtailment exposure",
   "Heavy backup diesel or generator spend",
   "Eskom / municipal tariff increase",
   "OEM, retailer or lender pushing renewable supply down the chain"
  ],
  "roles": [
   "Operations Director",
   "Farm / Estate Manager",
   "CEO / Managing Director",
   "Chief Financial Officer",
   "Group Engineering Manager / Technical Director"
  ],
  "subSectors": [
   "Abalone farms",
   "Land-based finfish & RAS",
   "Oyster & mussel farms",
   "Fish processing & freezing",
   "Squid & pelagic processing"
  ],
  "companyCount": 6
 },
 {
  "id": "hospitality-leisure",
  "name": "Hotels, Gaming & Leisure",
  "tier": 3,
  "group": "commercial",
  "ppaFit": 3,
  "why": "HVAC, hot water, kitchens and — in the case of casinos and resorts — very large continuously lit and cooled floors. Guest-facing outage tolerance is zero, so backup diesel spend is high.",
  "loadMw": "0.5 - 30",
  "annualGwh": "5 - 200",
  "profile": "Evening/morning-peaked",
  "solarMatch": "low",
  "grid": "LV and MV mixed; resorts at MV",
  "structures": [
   "Virtual wheeling",
   "Behind-the-meter generation (rooftop / ground-mount on site)",
   "Aggregated / pooled PPA"
  ],
  "dealMw": "5 - 40",
  "cycleMonths": "6-15",
  "triggers": [
   "Eskom / municipal tariff increase",
   "Heavy backup diesel or generator spend",
   "Supply interruption or curtailment exposure",
   "Published Scope 2 / net-zero target with a near date"
  ],
  "roles": [
   "Facilities / Property Director",
   "Operations Director",
   "Chief Financial Officer",
   "Head of ESG / Group Sustainability Manager",
   "Group Engineering Manager / Technical Director"
  ],
  "subSectors": [
   "Hotel groups",
   "Casinos & resorts",
   "Conference & exhibition centres",
   "Game lodges",
   "Stadiums & arenas"
  ],
  "companyCount": 5
 },
 {
  "id": "research-science-facilities",
  "name": "Research Infrastructure & Science Facilities",
  "tier": 3,
  "group": "utilities-public",
  "ppaFit": 3,
  "why": "Radio telescope arrays, particle accelerators, nuclear research reactors and supercomputing centres draw large, uninterruptible loads — often in remote, sun-rich locations with weak grid connections, which makes local generation genuinely attractive rather than merely cheaper.",
  "loadMw": "2 - 60",
  "annualGwh": "15 - 400",
  "profile": "Flat baseload (24/7)",
  "solarMatch": "low",
  "grid": "MV, frequently at the end of long rural feeders",
  "structures": [
   "Behind-the-meter generation (rooftop / ground-mount on site)",
   "Hybrid solar + wind + storage",
   "Physical wheeled PPA (Eskom or municipal network)"
  ],
  "dealMw": "5 - 50",
  "cycleMonths": "15-36",
  "triggers": [
   "New plant, line or site needing a grid connection",
   "Supply interruption or curtailment exposure",
   "Eskom / municipal tariff increase",
   "Published Scope 2 / net-zero target with a near date"
  ],
  "roles": [
   "Head of Utilities / Utilities Manager",
   "Group Engineering Manager / Technical Director",
   "CTO / Chief Technology Officer",
   "Facilities / Property Director",
   "Municipal Supply Chain Manager"
  ],
  "subSectors": [
   "Radio astronomy arrays",
   "Nuclear research & isotopes",
   "Particle accelerators",
   "High-performance computing",
   "National laboratories"
  ],
  "companyCount": 5
 },
 {
  "id": "education-campuses",
  "name": "Universities, Colleges & Campuses",
  "tier": 3,
  "group": "commercial",
  "ppaFit": 3,
  "why": "A large university campus is effectively a small town — lecture halls, laboratories, data centres, residences and hospitals under one bulk supply point, with a strong institutional sustainability mandate.",
  "loadMw": "2 - 40",
  "annualGwh": "15 - 250",
  "profile": "Daytime-peaked (business hours)",
  "solarMatch": "high",
  "grid": "MV campus bulk supply, mostly municipal",
  "structures": [
   "Behind-the-meter generation (rooftop / ground-mount on site)",
   "Physical wheeled PPA (Eskom or municipal network)",
   "Aggregated / pooled PPA"
  ],
  "dealMw": "5 - 40",
  "cycleMonths": "12-24",
  "triggers": [
   "Eskom / municipal tariff increase",
   "Published Scope 2 / net-zero target with a near date",
   "Supply interruption or curtailment exposure",
   "New plant, line or site needing a grid connection"
  ],
  "roles": [
   "Facilities / Property Director",
   "Head of Utilities / Utilities Manager",
   "Chief Financial Officer",
   "Head of ESG / Group Sustainability Manager",
   "Municipal Supply Chain Manager"
  ],
  "subSectors": [
   "Universities",
   "TVET colleges",
   "Private school groups",
   "Research institutions"
  ],
  "companyCount": 11
 },
 {
  "id": "waste-recycling",
  "name": "Waste Management, Recycling & Metal Recovery",
  "tier": 3,
  "group": "manufacturing",
  "ppaFit": 3,
  "why": "Shredders, granulators, extruders and induction furnaces. Plastics recycling in particular is extrusion-led and effectively a manufacturing load, and e-waste and battery recovery add smelting.",
  "loadMw": "0.5 - 20",
  "annualGwh": "4 - 120",
  "profile": "Two-shift (≈16h, weekday-weighted)",
  "solarMatch": "medium",
  "grid": "MV industrial",
  "structures": [
   "Behind-the-meter generation (rooftop / ground-mount on site)",
   "Aggregated / pooled PPA",
   "Physical wheeled PPA (Eskom or municipal network)"
  ],
  "dealMw": "2 - 25",
  "cycleMonths": "5-12",
  "triggers": [
   "Eskom / municipal tariff increase",
   "OEM, retailer or lender pushing renewable supply down the chain",
   "Published Scope 2 / net-zero target with a near date",
   "Supply interruption or curtailment exposure"
  ],
  "roles": [
   "CEO / Managing Director",
   "Operations Director",
   "Plant / Works Manager",
   "Chief Financial Officer",
   "Head of ESG / Group Sustainability Manager"
  ],
  "subSectors": [
   "Scrap metal recovery",
   "Plastics recycling & extrusion",
   "Paper recycling",
   "E-waste processing",
   "Battery recycling & lead smelting",
   "Landfill gas & waste-to-energy"
  ],
  "companyCount": 6
 },
 {
  "id": "broadcast-studios-media",
  "name": "Broadcast, Film Studios & Media",
  "tier": 3,
  "group": "digital",
  "ppaFit": 2,
  "why": "Transmitter networks run continuously at high power, studio lighting and HVAC are intense while in production, and post-production render farms are a data-centre load in miniature.",
  "loadMw": "0.5 - 30",
  "annualGwh": "4 - 200",
  "profile": "Two-shift (≈16h, weekday-weighted)",
  "solarMatch": "medium",
  "grid": "MV at studio campuses and transmitter sites; LV at remote transmitters",
  "structures": [
   "Behind-the-meter generation (rooftop / ground-mount on site)",
   "Virtual wheeling",
   "Aggregated / pooled PPA"
  ],
  "dealMw": "2 - 25",
  "cycleMonths": "6-15",
  "triggers": [
   "OEM, retailer or lender pushing renewable supply down the chain",
   "Eskom / municipal tariff increase",
   "Heavy backup diesel or generator spend",
   "Published Scope 2 / net-zero target with a near date"
  ],
  "roles": [
   "Facilities / Property Director",
   "CTO / Chief Technology Officer",
   "Operations Director",
   "Chief Financial Officer",
   "Head of Infrastructure / Data Centre Operations"
  ],
  "subSectors": [
   "Terrestrial transmitter networks",
   "Satellite uplink & playout",
   "Film & TV studios",
   "Post-production & render farms",
   "Live venues & arenas"
  ],
  "companyCount": 5
 },
 {
  "id": "defence-aerospace-rail",
  "name": "Defence, Aerospace & Rail Manufacturing",
  "tier": 3,
  "group": "manufacturing",
  "ppaFit": 2,
  "why": "Test facilities, propellant and explosives manufacture, autoclaves, paint booths and large hangar HVAC. Explosives production in particular is continuous and energy-hungry.",
  "loadMw": "1 - 40",
  "annualGwh": "8 - 250",
  "profile": "Two-shift (≈16h, weekday-weighted)",
  "solarMatch": "medium",
  "grid": "MV, often on dedicated secure estates",
  "structures": [
   "Behind-the-meter generation (rooftop / ground-mount on site)",
   "Physical wheeled PPA (Eskom or municipal network)",
   "Aggregated / pooled PPA"
  ],
  "dealMw": "3 - 35",
  "cycleMonths": "12-30",
  "triggers": [
   "Eskom / municipal tariff increase",
   "Supply interruption or curtailment exposure",
   "New plant, line or site needing a grid connection",
   "OEM, retailer or lender pushing renewable supply down the chain"
  ],
  "roles": [
   "Plant / Works Manager",
   "Group Engineering Manager / Technical Director",
   "Operations Director",
   "Chief Financial Officer",
   "Head of Procurement / Chief Procurement Officer"
  ],
  "subSectors": [
   "Explosives & propellants",
   "Ammunition manufacture",
   "Aerospace components & MRO",
   "Rolling stock manufacture",
   "Shipbuilding & repair",
   "Armoured vehicle manufacture"
  ],
  "companyCount": 7
 },
 {
  "id": "textiles-timber-light",
  "name": "Textiles, Timber & Light Manufacturing",
  "tier": 3,
  "group": "manufacturing",
  "ppaFit": 2,
  "why": "Dyeing and finishing lines, kiln drying of timber, board presses and compressed air. Individually modest but concentrated in KwaZulu-Natal, the Western Cape and Mpumalanga where they cluster usefully.",
  "loadMw": "0.5 - 15",
  "annualGwh": "4 - 100",
  "profile": "Two-shift (≈16h, weekday-weighted)",
  "solarMatch": "medium",
  "grid": "MV industrial, municipal",
  "structures": [
   "Behind-the-meter generation (rooftop / ground-mount on site)",
   "Aggregated / pooled PPA"
  ],
  "dealMw": "1 - 20",
  "cycleMonths": "4-10",
  "triggers": [
   "Eskom / municipal tariff increase",
   "OEM, retailer or lender pushing renewable supply down the chain",
   "Supply interruption or curtailment exposure",
   "Published Scope 2 / net-zero target with a near date"
  ],
  "roles": [
   "Plant / Works Manager",
   "CEO / Managing Director",
   "Chief Financial Officer",
   "Operations Director",
   "Group Engineering Manager / Technical Director"
  ],
  "subSectors": [
   "Textile dyeing & finishing",
   "Apparel manufacture",
   "Tanneries & leather",
   "Sawmilling & kiln drying",
   "Board & laminate manufacture",
   "Furniture manufacture",
   "Commercial printing",
   "Industrial laundries"
  ],
  "companyCount": 7
 }
];

/* AEE's mining prospects sit outside the non-mining taxonomy but still
   need a sector to be filed under. */
const MINING_SECTOR = {
  id: 'mining', name: 'Mining & Minerals (Producer)', tier: 1, group: 'heavy-industry', ppaFit: 5,
  why: 'Hoisting, milling, ventilation and refrigeration run continuously. Electricity is the largest controllable cost on most operations.',
  loadMw: '20 - 400', annualGwh: '150 - 3000', profile: 'Flat baseload (24/7)', solarMatch: 'low',
  grid: 'HV, usually supplied directly by Eskom on a dedicated feed',
  structures: ['Physical wheeled PPA (Eskom or municipal network)', 'Hybrid solar + wind and/or BESS', 'Behind-the-meter generation (rooftop / ground-mount on site)'],
  dealMw: '30 - 300', cycleMonths: '12-24',
  triggers: ['Eskom tariff increase', 'Published Scope 2 / net-zero target', 'Load curtailment or supply interruption', 'Investor or lender pressure on emissions'],
  roles: ['Head of Renewable Energy Programme', 'Group Energy Manager', 'Chief Operating Officer', 'Head of Procurement / Chief Procurement Officer'],
  subSectors: ['PGM mining', 'Gold mining', 'Coal mining', 'Chrome & manganese mining', 'Diamond mining'],
  companyCount: 0,
};

/* Every sector the app knows about, mining included. */
const ALL_SECTORS = [MINING_SECTOR].concat(SECTORS);
const SECTOR_BY_ID = Object.fromEntries(ALL_SECTORS.map(s => [s.id, s]));

/* Sector id -> label, for the badges and dropdowns. */
const SECTOR_LABEL = Object.fromEntries(ALL_SECTORS.map(s => [s.id, s.name]));

/* Broad groups, used for colour and for the analytics roll-up. */
const SECTOR_GROUPS = {
  'heavy-industry': 'Heavy industry',
  'manufacturing': 'Manufacturing',
  'commercial': 'Commercial',
  'digital': 'Digital',
  'logistics': 'Logistics',
  'utilities-public': 'Utilities & public',
  'primary': 'Primary',
  'emerging': 'Emerging',
};

/* Qualifying questions to ask on a first call, keyed by sector id. */
const SECTOR_QUESTIONS = {
 "automotive-manufacturing": [
  "What renewable electricity target has your parent company set for this plant, and by when?",
  "Does your municipality have an approved wheeling framework and tariff in place?",
  "How much roof and adjacent land is available at the plant?",
  "Is export volume to the EU exposed to CBAM or to OEM supplier scorecards?"
 ],
 "chemicals-petrochemicals": [
  "Do you have on-site cogeneration or steam turbines already, and what do they cover?",
  "What is your Scope 2 target year and how much of the gap is still unfunded?",
  "Which of your sites is the single biggest electricity consumer, and is it Eskom or municipally supplied?",
  "How does an unplanned outage translate into product loss — what is an hour of downtime worth?"
 ],
 "property-reits-malls": [
  "How many assets are in the portfolio and what is the group's total annual consumption?",
  "Do you operate as an embedded network operator and resell to tenants?",
  "Which municipalities are your biggest assets in, and do those municipalities have a wheeling tariff?",
  "What is the current green-star or net-zero commitment across the portfolio?",
  "What did the portfolio spend on generator diesel in the last financial year?"
 ],
 "data-centres": [
  "What is your contracted grid capacity today and what is the expansion plan over five years?",
  "Do your anchor tenants have 24/7 carbon-free energy or 100% renewable requirements?",
  "Is grid capacity or land the binding constraint on your next facility?",
  "How much renewable supply is already contracted and what is the remaining gap in MW?"
 ],
 "retail-multi-site": [
  "How many sites are in the estate, how many are owned versus leased, and across how many municipalities?",
  "Do you have smart metering across the estate or only at the large formats?",
  "What is your published renewable electricity target and how much is already contracted?",
  "How many rooftop installations have you done and what percentage of consumption do they cover?"
 ],
 "smelting-ferroalloys": [
  "What share of your cash cost per tonne is electricity today, and what did it do over the last three tariff cycles?",
  "Are you on a Negotiated Price Agreement with Eskom, and when does it come up for review?",
  "How much production did you lose to curtailment or load curtailment instructions in the last 12 months?",
  "Do your European or US customers require a carbon intensity declaration on shipments?",
  "Is your connection Eskom-direct or through a municipality?"
 ],
 "telecoms-towers": [
  "How many grid-connected sites are in the estate and across how many municipalities?",
  "What is the annual spend on backup power — diesel, batteries and replacement after theft?",
  "Are your sites metered in a way that supports hourly settlement?",
  "What renewable electricity commitment has the group published and by when?"
 ],
 "cement-lime-aggregates": [
  "Do you own land adjacent to the plant or quarry that is not on the mining right?",
  "How do you currently manage grinding around Eskom peak TOU windows?",
  "What is the carbon tax exposure on the clinker line after allowances step down?"
 ],
 "food-beverage-processing": [
  "How many processing sites are in the group and what are the three largest by consumption?",
  "What did you spend on diesel for backup generation last year?",
  "What does an hour of refrigeration loss cost you in product?",
  "Are your retail customers (Shoprite, Woolworths, Pick n Pay) asking for emissions data on supply?"
 ],
 "financial-services-bpo": [
  "How many branches and campuses are in the estate, and across how many municipalities?",
  "What is the group's net-zero commitment date and how much of Scope 2 is still unabated?",
  "Do your offshore BPO clients impose renewable electricity requirements in their contracts?",
  "What is the annual generator and UPS diesel spend?"
 ],
 "cold-chain-logistics": [
  "Do you own or lease the warehouse, and how long is left on the lease?",
  "Is refrigeration on a thermal store or ice bank that could shift load out of peak?",
  "Are you planning electric fleet charging at this depot in the next five years?"
 ],
 "green-hydrogen-newindustry": [
  "What development stage is the project at — concept, pre-feasibility, bankable feasibility or FID?",
  "Is there a signed offtake for the hydrogen or ammonia product itself?",
  "Who is funding development and what is the target FID date?",
  "Is the project inside a Special Economic Zone with grid allocation reserved?"
 ],
 "healthcare": [
  "How many facilities are in the group and what is combined annual consumption?",
  "What is the annual diesel spend across the estate for generator runtime?",
  "Are facilities owned or leased, and is there a group property company?"
 ],
 "mineral-beneficiation": [
  "Is the plant supplied under the parent mine's connection or its own?",
  "What is the milling circuit's share of total site consumption?",
  "Is this a long-life tailings or toll-treatment operation with a defined resource horizon?",
  "Do your metal customers — battery makers, autocatalyst producers — ask for a carbon intensity per tonne?"
 ],
 "agriculture-agriprocessing": [
  "What is the irrigation season and how many hours a day do the pumps run at peak?",
  "Is the farm on Ruraflex or Landrate, and what is the notified maximum demand?",
  "Can the co-op or group aggregate several members under one contract?",
  "Do your export customers in the EU or UK ask for carbon footprint data on the consignment?"
 ],
 "foundries-fabrication": [
  "Do you already schedule melts around Eskom peak periods, and what does that cost you in throughput?",
  "What is the notified maximum demand on the connection versus what you actually draw?",
  "Are you in an industrial park where several tenants could be bundled into one contract?",
  "Does your galvanising kettle stay hot over weekends?"
 ],
 "municipalities-public": [
  "Does the municipality have an approved wheeling framework and a published wheeling tariff?",
  "Has an IPP procurement programme been approved by council, and at what stage is it?",
  "Is the intention to buy energy for the municipality's own estate or for onward resale?",
  "What Section 33 or Treasury approvals are required for the tenor you need?"
 ],
 "oil-refining-terminals": [
  "Is energy procurement decided locally or by the international parent?",
  "What is the site's load after any conversion from refining to import terminal?",
  "Is there non-hazardous land outside the classified zone that could host generation?"
 ],
 "transport-ports-rail": [
  "Is the traction supply contracted separately from terminal and facility load?",
  "Is there land within the port or rail reserve available for co-located generation?",
  "What procurement instrument would a long-term energy contract run under?",
  "Are shipping-line customers asking for green port credentials?"
 ],
 "pulp-paper-packaging": [
  "What percentage of the mill's electricity is self-generated from biomass or black liquor today?",
  "What is your net import from Eskom in GWh after self-generation?",
  "Are any of your FMCG customers asking for renewable-supplied packaging?"
 ],
 "water-wastewater": [
  "What proportion of the entity's operating budget is electricity?",
  "Can pumping be shifted out of Eskom peak TOU windows using reservoir storage?",
  "Is there land available at the pump station or treatment works?",
  "What procurement route applies — open tender, Section 33 long-term contract, or an existing framework?"
 ],
 "aquaculture-marine": [
  "What happens to stock if pumping stops for four hours?",
  "What is the current spend on standby generation and fuel?",
  "Is the farm on a feeder with capacity for a local generation connection?",
  "Do your Asian export buyers ask about production emissions?"
 ],
 "hospitality-leisure": [
  "How many properties, and how many are owned rather than managed on behalf of an owner?",
  "What proportion of consumption sits in Eskom evening peak?",
  "Do the casino properties run a flat 24-hour load separate from the hotel component?"
 ],
 "research-science-facilities": [
  "Is grid capacity currently limiting the facility's expansion?",
  "Does radio-quiet or electromagnetic interference restriction affect what can be installed on site?",
  "Is funding national, international consortium, or both — and who contracts?"
 ],
 "education-campuses": [
  "Is the campus on a single bulk supply point or multiple municipal accounts?",
  "Is there undeveloped land on or adjacent to campus?",
  "What sustainability commitment has council or senate adopted, and is it funded?",
  "Does research infrastructure create a 24-hour load beneath the daytime peak?"
 ],
 "waste-recycling": [
  "Do your brand-owner customers audit the carbon footprint of recycled material?",
  "Is extrusion or shredding the dominant load, and does it run at night?",
  "Do you have landfill gas or biomass on site that could firm a hybrid?"
 ],
 "broadcast-studios-media": [
  "Do inbound international productions require a carbon budget or green production certification?",
  "How many transmitter sites are grid-connected and how many run on backup?",
  "Is the render farm load separable and growing?"
 ],
 "defence-aerospace-rail": [
  "Is there undeveloped land inside the secure perimeter?",
  "Is the entity state-owned, and if so what procurement instrument applies?",
  "Does explosives or propellant production run continuously?"
 ],
 "textiles-timber-light": [
  "Do the retailers you supply ask for emissions data on the order?",
  "Is there biomass or offcut residue on site that could firm a hybrid?",
  "Are you in a cluster or park where several manufacturers share a feeder?"
 ]
};

/* Objections you will hear, and a response that works, by sector id. */
const SECTOR_OBJECTIONS = {
 "automotive-manufacturing": [
  {
   "objection": "Global procurement handles energy contracts.",
   "response": "Then the useful step is a local feasibility pack the plant can put into the global process — most groups require a country-level business case before they will approve anything."
  },
  {
   "objection": "Our municipality doesn't allow wheeling.",
   "response": "Several don't yet. That's what virtual wheeling and a financial PPA are for, and we can also look at behind-the-meter on your own roof in the meantime."
  }
 ],
 "chemicals-petrochemicals": [
  {
   "objection": "We generate our own steam and power already.",
   "response": "Cogeneration usually covers steam-led demand and leaves an electricity gap, especially outside turnaround periods. We size against the residual import, not the whole load."
  },
  {
   "objection": "Our process cannot tolerate variability.",
   "response": "A wheeled PPA does not change your physical supply — Eskom still delivers to your connection. It changes who you buy the energy from and at what price."
  }
 ],
 "property-reits-malls": [
  {
   "objection": "Our tenants pay for electricity, so cheaper power doesn't help us.",
   "response": "It helps twice: it protects the margin on what you resell, and it is now a leasing argument — large national tenants are asking about green supply before they sign."
  },
  {
   "objection": "We're already installing rooftop PV across the portfolio.",
   "response": "Rooftop typically covers 10-25% of a mall's consumption because the roof is smaller than the load. Wheeling is the only route to the other 75%."
  }
 ],
 "data-centres": [
  {
   "objection": "We need 24/7 firm power, not intermittent renewables.",
   "response": "Agreed — which is why the structure is a hybrid with storage plus grid firming, and why the contract is about annual matching and price certainty rather than physical islanding."
  },
  {
   "objection": "We already have a PPA in place.",
   "response": "Most facilities have contracted a first tranche against current load. The question is the next 100MW of expansion, which is usually uncontracted."
  }
 ],
 "retail-multi-site": [
  {
   "objection": "Our sites are LV and spread across 100+ municipalities — wheeling doesn't work for us.",
   "response": "It didn't, until virtual wheeling. Eskom's platform settles hourly across the whole estate through a licensed trader, which is precisely how Vodacom solved the same problem across 15,000 sites."
  },
  {
   "objection": "We already have solar on 100+ stores.",
   "response": "That covers the roof-limited portion. The remaining 80% of consumption is the wheeling conversation."
  }
 ],
 "smelting-ferroalloys": [
  {
   "objection": "Our NPA rate is already below anything you can offer.",
   "response": "Compare the escalation curve, not today's rate. A 15-year fixed CPI-linked price against a tariff path that is being renegotiated upward is a hedge, not just a discount — and the NPA does not give you a carbon intensity number for CBAM."
  },
  {
   "objection": "Solar can't run a furnace.",
   "response": "Correct, and we don't propose it as one. The structure is a hybrid layer that displaces 30-60% of annual consumption, with Eskom remaining the firming supplier under the same connection."
  },
  {
   "objection": "We can't commit for 15 years with commodity prices where they are.",
   "response": "Size the contracted volume to the floor of your production range, not the average, and keep flexibility above that."
  }
 ],
 "telecoms-towers": [
  {
   "objection": "Our sites are tiny and scattered — no generator can serve them.",
   "response": "None has to. Virtual wheeling matches generation to the aggregate of the estate hour by hour and settles financially; the physical electrons stay exactly as they are."
  }
 ],
 "cement-lime-aggregates": [
  {
   "objection": "Most of our emissions are process emissions from limestone, not electricity.",
   "response": "True, which is exactly why the electricity share is the part you can actually abate — and it's the part that is priced at R2+/kWh today."
  },
  {
   "objection": "Demand in construction is too weak to commit.",
   "response": "Contract to the kiln's minimum sustainable run rate and structure the balance as merchant."
  }
 ],
 "food-beverage-processing": [
  {
   "objection": "We're already putting solar on our roofs.",
   "response": "Rooftop typically tops out around 10-20% of a refrigerated plant's consumption. Wheeling is what covers the rest, and the two stack rather than compete."
  },
  {
   "objection": "Each plant has its own budget.",
   "response": "That's the argument for a group-level PPA — one contract, allocated internally, at a price no single plant could negotiate."
  }
 ],
 "financial-services-bpo": [
  {
   "objection": "Energy is a rounding error on our cost base.",
   "response": "It is — which is why this is not a cost conversation for you, it's a Scope 2 and disclosure conversation, and it happens to save money rather than cost it."
  }
 ],
 "cold-chain-logistics": [
  {
   "objection": "We lease the building, so we can't put anything on the roof.",
   "response": "Then the deal is with the landlord and we structure it so you take the energy and they take the asset — or we skip the roof entirely and wheel."
  }
 ],
 "green-hydrogen-newindustry": [
  {
   "objection": "We can't contract energy until we have product offtake.",
   "response": "Understood — and your product offtaker will want to see a credible energy price before they sign. A conditional term sheet lets both sides move at once."
  }
 ],
 "healthcare": [
  {
   "objection": "Clinical continuity is non-negotiable — we won't experiment with supply.",
   "response": "Nothing about your physical supply or your generators changes. A wheeled or virtual PPA changes the commercial counterparty for the energy, not the reliability of the connection."
  }
 ],
 "mineral-beneficiation": [
  {
   "objection": "The parent group negotiates all energy contracts.",
   "response": "Often true for the mines, less often for a separately incorporated processing entity with its own NERSA connection. Worth confirming who actually signs."
  }
 ],
 "agriculture-agriprocessing": [
  {
   "objection": "Our load is only four months of the year.",
   "response": "That's what aggregation is for — pair your summer irrigation profile with a pack-house or a processor whose load runs year-round, under one generation asset."
  },
  {
   "objection": "Our Eskom feeder is too weak to take anything.",
   "response": "A weak feeder is an argument for local generation at the load, not against it."
  }
 ],
 "foundries-fabrication": [
  {
   "objection": "We're too small for anyone to build a solar farm for.",
   "response": "You are, alone. Bundled with four or five neighbours on the same feeder you are not, and the price you get is the price a 30MW buyer gets."
  }
 ],
 "municipalities-public": [
  {
   "objection": "Cheaper energy erodes our electricity surplus, which cross-subsidises other services.",
   "response": "That's the real constraint and worth modelling explicitly — but the surplus is already eroding as large users leave the grid. Wheeling keeps them on your network paying use-of-system charges instead of going fully behind-the-meter."
  }
 ],
 "oil-refining-terminals": [
  {
   "objection": "We're a fossil fuel business — renewables aren't our story.",
   "response": "Your Scope 2 is separable from your product, and it's the part investors ask about that you can actually fix at a lower cost than you pay today."
  }
 ],
 "transport-ports-rail": [
  {
   "objection": "Procurement will take years.",
   "response": "It will, which is why the right first step is a technical feasibility and a market-sounding note now, so the tender when it comes is one you helped shape."
  }
 ],
 "pulp-paper-packaging": [
  {
   "objection": "We already generate most of our own power.",
   "response": "Then the conversation is about the import gap and about the converting plants, which typically have none."
  }
 ],
 "water-wastewater": [
  {
   "objection": "We can't sign a 15-year contract under MFMA without a Section 33 process.",
   "response": "Correct, and that process is well-trodden for energy now. We can structure a shorter initial tenor or work through a licensed trader so the entity contracts for supply rather than for infrastructure."
  }
 ],
 "aquaculture-marine": [
  {
   "objection": "We cannot risk any change to supply.",
   "response": "Nothing physical changes — and adding local generation plus storage on a weak coastal feeder makes you more resilient, not less."
  }
 ],
 "hospitality-leisure": [
  {
   "objection": "We use most of our power at night when the sun isn't shining.",
   "response": "Then the deal isn't solar alone. Storage for peak-shaving plus a wind or hybrid allocation is what fits the profile — and the annual matching still works financially."
  }
 ],
 "research-science-facilities": [
  {
   "objection": "Electromagnetic interference rules out inverters near the instruments.",
   "response": "It constrains siting, not the deal. Generation goes outside the radio-quiet zone and the energy is wheeled in."
  }
 ],
 "education-campuses": [
  {
   "objection": "We have no capital budget for energy projects.",
   "response": "A PPA requires none. You buy energy at a tariff, not infrastructure at a price."
  }
 ],
 "waste-recycling": [
  {
   "objection": "Our margins are too thin for a long contract.",
   "response": "Thin margins are the argument, not the objection — a 30% cut in your largest controllable input is worth more to you than to a business with fat margins."
  }
 ],
 "broadcast-studios-media": [
  {
   "objection": "Our load is lumpy — big during a shoot, nothing between.",
   "response": "That's what annual matching handles. You contract to average consumption, not to peak week."
  }
 ],
 "defence-aerospace-rail": [
  {
   "objection": "Security clearance makes third-party infrastructure on site impossible.",
   "response": "Then we wheel from outside the fence — the contract works identically and nobody needs access to your site."
  }
 ],
 "textiles-timber-light": [
  {
   "objection": "We can't compete with imports as it is.",
   "response": "Which is precisely why locking your energy price for 15 years while your competitors ride the tariff escalator is a competitiveness move, not a green one."
  }
 ]
};

/* Role taxonomy — titles worth approaching directly, classified by
   their part in the decision. */
const CONTACT_ROLES = [
 {
  "id": "ceo",
  "title": "CEO / Managing Director",
  "part": "sponsor",
  "sectors": [
   "Data Centres & Digital Infrastructure",
   "Green Hydrogen, Ammonia & New Industrial Demand",
   "Agriculture, Irrigation & Agri-Processing",
   "Foundries, Galvanising & Metal Fabrication",
   "Aquaculture, Abalone & Marine Processing",
   "Waste Management, Recycling & Metal Recovery",
   "Textiles, Timber & Light Manufacturing"
  ]
 },
 {
  "id": "coo",
  "title": "Chief Operating Officer",
  "part": "economic-buyer",
  "sectors": [
   "Chemicals & Petrochemicals",
   "Smelting, Ferroalloys & Primary Metals",
   "Banking, Insurance & BPO / Contact Centres"
  ]
 },
 {
  "id": "cfo",
  "title": "Chief Financial Officer",
  "part": "economic-buyer",
  "sectors": [
   "Automotive & Heavy Manufacturing",
   "Chemicals & Petrochemicals",
   "Commercial Property, REITs & Shopping Centres",
   "Data Centres & Digital Infrastructure",
   "Retail Chains (Multi-Site)",
   "Smelting, Ferroalloys & Primary Metals",
   "Telecommunications & Tower Networks",
   "Cement, Lime, Glass & Building Materials",
   "Food & Beverage Processing",
   "Banking, Insurance & BPO / Contact Centres",
   "Cold Chain, Warehousing & Logistics",
   "Green Hydrogen, Ammonia & New Industrial Demand",
   "Hospital Groups & Healthcare",
   "Mineral Beneficiation & Processing (Non-Mine)",
   "Agriculture, Irrigation & Agri-Processing",
   "Foundries, Galvanising & Metal Fabrication",
   "Municipalities & Public Sector Estates",
   "Oil Refining, Fuel Terminals & Pipelines",
   "Ports, Rail & Transport Infrastructure",
   "Pulp, Paper & Packaging",
   "Water Utilities, Bulk Water & Wastewater",
   "Aquaculture, Abalone & Marine Processing",
   "Hotels, Gaming & Leisure",
   "Universities, Colleges & Campuses",
   "Waste Management, Recycling & Metal Recovery",
   "Broadcast, Film Studios & Media",
   "Defence, Aerospace & Rail Manufacturing",
   "Textiles, Timber & Light Manufacturing"
  ]
 },
 {
  "id": "cso",
  "title": "Chief Sustainability Officer",
  "part": "champion",
  "sectors": [
   "Chemicals & Petrochemicals",
   "Mineral Beneficiation & Processing (Non-Mine)"
  ]
 },
 {
  "id": "head-esg",
  "title": "Head of ESG / Group Sustainability Manager",
  "part": "champion",
  "sectors": [
   "Automotive & Heavy Manufacturing",
   "Commercial Property, REITs & Shopping Centres",
   "Data Centres & Digital Infrastructure",
   "Retail Chains (Multi-Site)",
   "Telecommunications & Tower Networks",
   "Cement, Lime, Glass & Building Materials",
   "Food & Beverage Processing",
   "Banking, Insurance & BPO / Contact Centres",
   "Hospital Groups & Healthcare",
   "Oil Refining, Fuel Terminals & Pipelines",
   "Ports, Rail & Transport Infrastructure",
   "Pulp, Paper & Packaging",
   "Hotels, Gaming & Leisure",
   "Universities, Colleges & Campuses",
   "Waste Management, Recycling & Metal Recovery"
  ]
 },
 {
  "id": "energy-director",
  "title": "Energy Director / Group Head of Energy",
  "part": "economic-buyer",
  "sectors": [
   "Chemicals & Petrochemicals",
   "Data Centres & Digital Infrastructure",
   "Smelting, Ferroalloys & Primary Metals",
   "Green Hydrogen, Ammonia & New Industrial Demand",
   "Mineral Beneficiation & Processing (Non-Mine)"
  ]
 },
 {
  "id": "energy-manager",
  "title": "Energy Manager",
  "part": "technical-buyer",
  "sectors": [
   "Automotive & Heavy Manufacturing",
   "Retail Chains (Multi-Site)",
   "Telecommunications & Tower Networks",
   "Cement, Lime, Glass & Building Materials",
   "Food & Beverage Processing",
   "Cold Chain, Warehousing & Logistics",
   "Oil Refining, Fuel Terminals & Pipelines",
   "Pulp, Paper & Packaging"
  ]
 },
 {
  "id": "strategy-director",
  "title": "Strategy Director",
  "part": "sponsor",
  "sectors": [
   "Green Hydrogen, Ammonia & New Industrial Demand",
   "Municipalities & Public Sector Estates"
  ]
 },
 {
  "id": "ops-director",
  "title": "Operations Director",
  "part": "economic-buyer",
  "sectors": [
   "Retail Chains (Multi-Site)",
   "Cement, Lime, Glass & Building Materials",
   "Food & Beverage Processing",
   "Cold Chain, Warehousing & Logistics",
   "Mineral Beneficiation & Processing (Non-Mine)",
   "Agriculture, Irrigation & Agri-Processing",
   "Foundries, Galvanising & Metal Fabrication",
   "Oil Refining, Fuel Terminals & Pipelines",
   "Ports, Rail & Transport Infrastructure",
   "Pulp, Paper & Packaging",
   "Water Utilities, Bulk Water & Wastewater",
   "Aquaculture, Abalone & Marine Processing",
   "Hotels, Gaming & Leisure",
   "Waste Management, Recycling & Metal Recovery",
   "Broadcast, Film Studios & Media",
   "Defence, Aerospace & Rail Manufacturing",
   "Textiles, Timber & Light Manufacturing"
  ]
 },
 {
  "id": "head-procurement",
  "title": "Head of Procurement / Chief Procurement Officer",
  "part": "gatekeeper",
  "sectors": [
   "Automotive & Heavy Manufacturing",
   "Chemicals & Petrochemicals",
   "Commercial Property, REITs & Shopping Centres",
   "Retail Chains (Multi-Site)",
   "Smelting, Ferroalloys & Primary Metals",
   "Telecommunications & Tower Networks",
   "Banking, Insurance & BPO / Contact Centres",
   "Hospital Groups & Healthcare",
   "Oil Refining, Fuel Terminals & Pipelines",
   "Ports, Rail & Transport Infrastructure",
   "Defence, Aerospace & Rail Manufacturing"
  ]
 },
 {
  "id": "group-engineer",
  "title": "Group Engineering Manager / Technical Director",
  "part": "technical-buyer",
  "sectors": [
   "Automotive & Heavy Manufacturing",
   "Smelting, Ferroalloys & Primary Metals",
   "Food & Beverage Processing",
   "Hospital Groups & Healthcare",
   "Mineral Beneficiation & Processing (Non-Mine)",
   "Agriculture, Irrigation & Agri-Processing",
   "Foundries, Galvanising & Metal Fabrication",
   "Ports, Rail & Transport Infrastructure",
   "Pulp, Paper & Packaging",
   "Water Utilities, Bulk Water & Wastewater",
   "Aquaculture, Abalone & Marine Processing",
   "Hotels, Gaming & Leisure",
   "Research Infrastructure & Science Facilities",
   "Defence, Aerospace & Rail Manufacturing",
   "Textiles, Timber & Light Manufacturing"
  ]
 },
 {
  "id": "plant-manager",
  "title": "Plant / Works Manager",
  "part": "technical-buyer",
  "sectors": [
   "Chemicals & Petrochemicals",
   "Cement, Lime, Glass & Building Materials",
   "Mineral Beneficiation & Processing (Non-Mine)",
   "Foundries, Galvanising & Metal Fabrication",
   "Oil Refining, Fuel Terminals & Pipelines",
   "Waste Management, Recycling & Metal Recovery",
   "Defence, Aerospace & Rail Manufacturing",
   "Textiles, Timber & Light Manufacturing"
  ]
 },
 {
  "id": "site-gm",
  "title": "Site General Manager",
  "part": "economic-buyer",
  "sectors": [
   "Automotive & Heavy Manufacturing",
   "Smelting, Ferroalloys & Primary Metals"
  ]
 },
 {
  "id": "facilities-director",
  "title": "Facilities / Property Director",
  "part": "economic-buyer",
  "sectors": [
   "Commercial Property, REITs & Shopping Centres",
   "Retail Chains (Multi-Site)",
   "Banking, Insurance & BPO / Contact Centres",
   "Cold Chain, Warehousing & Logistics",
   "Hospital Groups & Healthcare",
   "Hotels, Gaming & Leisure",
   "Research Infrastructure & Science Facilities",
   "Universities, Colleges & Campuses",
   "Broadcast, Film Studios & Media"
  ]
 },
 {
  "id": "head-property",
  "title": "Head of Asset Management (REIT)",
  "part": "economic-buyer",
  "sectors": [
   "Commercial Property, REITs & Shopping Centres"
  ]
 },
 {
  "id": "head-utilities",
  "title": "Head of Utilities / Utilities Manager",
  "part": "technical-buyer",
  "sectors": [
   "Commercial Property, REITs & Shopping Centres",
   "Banking, Insurance & BPO / Contact Centres",
   "Municipalities & Public Sector Estates",
   "Ports, Rail & Transport Infrastructure",
   "Water Utilities, Bulk Water & Wastewater",
   "Research Infrastructure & Science Facilities",
   "Universities, Colleges & Campuses"
  ]
 },
 {
  "id": "head-supply-chain",
  "title": "Head of Supply Chain / Logistics Director",
  "part": "influencer",
  "sectors": [
   "Cold Chain, Warehousing & Logistics"
  ]
 },
 {
  "id": "cto",
  "title": "CTO / Chief Technology Officer",
  "part": "economic-buyer",
  "sectors": [
   "Data Centres & Digital Infrastructure",
   "Telecommunications & Tower Networks",
   "Green Hydrogen, Ammonia & New Industrial Demand",
   "Research Infrastructure & Science Facilities",
   "Broadcast, Film Studios & Media"
  ]
 },
 {
  "id": "head-infrastructure",
  "title": "Head of Infrastructure / Data Centre Operations",
  "part": "technical-buyer",
  "sectors": [
   "Data Centres & Digital Infrastructure",
   "Telecommunications & Tower Networks",
   "Broadcast, Film Studios & Media"
  ]
 },
 {
  "id": "farm-manager",
  "title": "Farm / Estate Manager",
  "part": "technical-buyer",
  "sectors": [
   "Agriculture, Irrigation & Agri-Processing",
   "Aquaculture, Abalone & Marine Processing"
  ]
 },
 {
  "id": "municipal-engineer",
  "title": "Municipal Electrical Engineer / Head of Energy",
  "part": "technical-buyer",
  "sectors": [
   "Municipalities & Public Sector Estates",
   "Water Utilities, Bulk Water & Wastewater"
  ]
 },
 {
  "id": "supply-chain-mm",
  "title": "Municipal Supply Chain Manager",
  "part": "gatekeeper",
  "sectors": [
   "Municipalities & Public Sector Estates",
   "Water Utilities, Bulk Water & Wastewater",
   "Research Infrastructure & Science Facilities",
   "Universities, Colleges & Campuses"
  ]
 }
];

/* Sub-sectors, so an account can be tagged more precisely than at
   sector level. */
const SUB_SECTORS = [
 {
  "name": "Vehicle assembly (OEM)",
  "sectorId": "automotive-manufacturing"
 },
 {
  "name": "Component & tier-1 suppliers",
  "sectorId": "automotive-manufacturing"
 },
 {
  "name": "Tyre manufacturing",
  "sectorId": "automotive-manufacturing"
 },
 {
  "name": "Rail & heavy equipment",
  "sectorId": "automotive-manufacturing"
 },
 {
  "name": "Appliance manufacturing",
  "sectorId": "automotive-manufacturing"
 },
 {
  "name": "Chlor-alkali",
  "sectorId": "chemicals-petrochemicals"
 },
 {
  "name": "Industrial gases (air separation)",
  "sectorId": "chemicals-petrochemicals"
 },
 {
  "name": "Fertiliser & explosives",
  "sectorId": "chemicals-petrochemicals"
 },
 {
  "name": "Polymers & plastics",
  "sectorId": "chemicals-petrochemicals"
 },
 {
  "name": "Synthetic fuels",
  "sectorId": "chemicals-petrochemicals"
 },
 {
  "name": "Paints & coatings",
  "sectorId": "chemicals-petrochemicals"
 },
 {
  "name": "Pharmaceutical manufacturing",
  "sectorId": "chemicals-petrochemicals"
 },
 {
  "name": "Super-regional & regional malls",
  "sectorId": "property-reits-malls"
 },
 {
  "name": "Office parks & P-grade office",
  "sectorId": "property-reits-malls"
 },
 {
  "name": "Industrial & logistics parks",
  "sectorId": "property-reits-malls"
 },
 {
  "name": "Mixed-use precincts",
  "sectorId": "property-reits-malls"
 },
 {
  "name": "Student accommodation",
  "sectorId": "property-reits-malls"
 },
 {
  "name": "Colocation & carrier-neutral facilities",
  "sectorId": "data-centres"
 },
 {
  "name": "Hyperscale cloud regions",
  "sectorId": "data-centres"
 },
 {
  "name": "AI / GPU compute facilities",
  "sectorId": "data-centres"
 },
 {
  "name": "Enterprise & banking data centres",
  "sectorId": "data-centres"
 },
 {
  "name": "Edge facilities",
  "sectorId": "data-centres"
 },
 {
  "name": "Grocery & supermarkets",
  "sectorId": "retail-multi-site"
 },
 {
  "name": "Discount & general merchandise",
  "sectorId": "retail-multi-site"
 },
 {
  "name": "Fashion & speciality",
  "sectorId": "retail-multi-site"
 },
 {
  "name": "Pharmacy & health retail",
  "sectorId": "retail-multi-site"
 },
 {
  "name": "Fuel forecourts & convenience",
  "sectorId": "retail-multi-site"
 },
 {
  "name": "Quick-service restaurant chains",
  "sectorId": "retail-multi-site"
 },
 {
  "name": "Ferrochrome",
  "sectorId": "smelting-ferroalloys"
 },
 {
  "name": "Ferromanganese",
  "sectorId": "smelting-ferroalloys"
 },
 {
  "name": "Aluminium",
  "sectorId": "smelting-ferroalloys"
 },
 {
  "name": "Silicon & silicon metal",
  "sectorId": "smelting-ferroalloys"
 },
 {
  "name": "Steel (EAF & integrated)",
  "sectorId": "smelting-ferroalloys"
 },
 {
  "name": "Stainless steel",
  "sectorId": "smelting-ferroalloys"
 },
 {
  "name": "Vanadium & titanium processing",
  "sectorId": "smelting-ferroalloys"
 },
 {
  "name": "Mobile network operators",
  "sectorId": "telecoms-towers"
 },
 {
  "name": "Tower companies",
  "sectorId": "telecoms-towers"
 },
 {
  "name": "Fibre network operators",
  "sectorId": "telecoms-towers"
 },
 {
  "name": "Satellite & broadcast",
  "sectorId": "telecoms-towers"
 },
 {
  "name": "Cement & clinker",
  "sectorId": "cement-lime-aggregates"
 },
 {
  "name": "Lime",
  "sectorId": "cement-lime-aggregates"
 },
 {
  "name": "Container & float glass",
  "sectorId": "cement-lime-aggregates"
 },
 {
  "name": "Bricks & ceramics",
  "sectorId": "cement-lime-aggregates"
 },
 {
  "name": "Aggregates & ready-mix",
  "sectorId": "cement-lime-aggregates"
 },
 {
  "name": "Poultry & abattoirs",
  "sectorId": "food-beverage-processing"
 },
 {
  "name": "Dairy",
  "sectorId": "food-beverage-processing"
 },
 {
  "name": "Breweries & beverages",
  "sectorId": "food-beverage-processing"
 },
 {
  "name": "Milling & baking",
  "sectorId": "food-beverage-processing"
 },
 {
  "name": "Sugar",
  "sectorId": "food-beverage-processing"
 },
 {
  "name": "Fruit & vegetable processing",
  "sectorId": "food-beverage-processing"
 },
 {
  "name": "Fishing & fish processing",
  "sectorId": "food-beverage-processing"
 },
 {
  "name": "Edible oils",
  "sectorId": "food-beverage-processing"
 },
 {
  "name": "Retail banking branch networks",
  "sectorId": "financial-services-bpo"
 },
 {
  "name": "Head-office campuses",
  "sectorId": "financial-services-bpo"
 },
 {
  "name": "Insurance & asset management",
  "sectorId": "financial-services-bpo"
 },
 {
  "name": "BPO / offshore contact centres",
  "sectorId": "financial-services-bpo"
 },
 {
  "name": "Payment processing",
  "sectorId": "financial-services-bpo"
 },
 {
  "name": "Cold storage operators",
  "sectorId": "cold-chain-logistics"
 },
 {
  "name": "Retail distribution centres",
  "sectorId": "cold-chain-logistics"
 },
 {
  "name": "Third-party logistics parks",
  "sectorId": "cold-chain-logistics"
 },
 {
  "name": "Port cold stores",
  "sectorId": "cold-chain-logistics"
 },
 {
  "name": "Fleet charging depots",
  "sectorId": "cold-chain-logistics"
 },
 {
  "name": "Green hydrogen & ammonia",
  "sectorId": "green-hydrogen-newindustry"
 },
 {
  "name": "Sustainable aviation fuel",
  "sectorId": "green-hydrogen-newindustry"
 },
 {
  "name": "Battery & cathode manufacturing",
  "sectorId": "green-hydrogen-newindustry"
 },
 {
  "name": "Vertical farming & controlled-environment agriculture",
  "sectorId": "green-hydrogen-newindustry"
 },
 {
  "name": "Bitcoin & crypto mining",
  "sectorId": "green-hydrogen-newindustry"
 },
 {
  "name": "Private hospital groups",
  "sectorId": "healthcare"
 },
 {
  "name": "Public hospitals",
  "sectorId": "healthcare"
 },
 {
  "name": "Pathology & laboratory networks",
  "sectorId": "healthcare"
 },
 {
  "name": "Pharmaceutical manufacturing",
  "sectorId": "healthcare"
 },
 {
  "name": "Day clinics",
  "sectorId": "healthcare"
 },
 {
  "name": "Precious metals refining",
  "sectorId": "mineral-beneficiation"
 },
 {
  "name": "Base metal refineries",
  "sectorId": "mineral-beneficiation"
 },
 {
  "name": "Tailings retreatment",
  "sectorId": "mineral-beneficiation"
 },
 {
  "name": "Standalone concentrators & toll milling",
  "sectorId": "mineral-beneficiation"
 },
 {
  "name": "Mineral sands separation",
  "sectorId": "mineral-beneficiation"
 },
 {
  "name": "Diamond cutting & polishing",
  "sectorId": "mineral-beneficiation"
 },
 {
  "name": "Irrigated row crops & orchards",
  "sectorId": "agriculture-agriprocessing"
 },
 {
  "name": "Table grapes & citrus",
  "sectorId": "agriculture-agriprocessing"
 },
 {
  "name": "Pack-houses & pre-cooling",
  "sectorId": "agriculture-agriprocessing"
 },
 {
  "name": "Grain storage & silos",
  "sectorId": "agriculture-agriprocessing"
 },
 {
  "name": "Intensive livestock & poultry houses",
  "sectorId": "agriculture-agriprocessing"
 },
 {
  "name": "Greenhouses & protected cropping",
  "sectorId": "agriculture-agriprocessing"
 },
 {
  "name": "Wine cellars",
  "sectorId": "agriculture-agriprocessing"
 },
 {
  "name": "Iron & steel foundries",
  "sectorId": "foundries-fabrication"
 },
 {
  "name": "Non-ferrous foundries",
  "sectorId": "foundries-fabrication"
 },
 {
  "name": "Hot-dip galvanising",
  "sectorId": "foundries-fabrication"
 },
 {
  "name": "Heat treatment",
  "sectorId": "foundries-fabrication"
 },
 {
  "name": "Structural steel fabrication",
  "sectorId": "foundries-fabrication"
 },
 {
  "name": "Wire & cable drawing",
  "sectorId": "foundries-fabrication"
 },
 {
  "name": "Forging & pressing",
  "sectorId": "foundries-fabrication"
 },
 {
  "name": "Metropolitan municipalities",
  "sectorId": "municipalities-public"
 },
 {
  "name": "District & local municipalities",
  "sectorId": "municipalities-public"
 },
 {
  "name": "Provincial government estates",
  "sectorId": "municipalities-public"
 },
 {
  "name": "National departments & SOEs",
  "sectorId": "municipalities-public"
 },
 {
  "name": "Public housing",
  "sectorId": "municipalities-public"
 },
 {
  "name": "Crude refining",
  "sectorId": "oil-refining-terminals"
 },
 {
  "name": "Import terminals & tank farms",
  "sectorId": "oil-refining-terminals"
 },
 {
  "name": "Pipeline pumping stations",
  "sectorId": "oil-refining-terminals"
 },
 {
  "name": "LPG storage & filling",
  "sectorId": "oil-refining-terminals"
 },
 {
  "name": "Lubricants blending",
  "sectorId": "oil-refining-terminals"
 },
 {
  "name": "Bitumen plants",
  "sectorId": "oil-refining-terminals"
 },
 {
  "name": "Container & bulk ports",
  "sectorId": "transport-ports-rail"
 },
 {
  "name": "Electrified freight rail",
  "sectorId": "transport-ports-rail"
 },
 {
  "name": "Airports",
  "sectorId": "transport-ports-rail"
 },
 {
  "name": "Passenger rail",
  "sectorId": "transport-ports-rail"
 },
 {
  "name": "Pipeline pumping",
  "sectorId": "transport-ports-rail"
 },
 {
  "name": "EV charging networks",
  "sectorId": "transport-ports-rail"
 },
 {
  "name": "Pulp mills",
  "sectorId": "pulp-paper-packaging"
 },
 {
  "name": "Paper & board mills",
  "sectorId": "pulp-paper-packaging"
 },
 {
  "name": "Corrugated packaging",
  "sectorId": "pulp-paper-packaging"
 },
 {
  "name": "Tissue",
  "sectorId": "pulp-paper-packaging"
 },
 {
  "name": "Rigid & flexible plastics packaging",
  "sectorId": "pulp-paper-packaging"
 },
 {
  "name": "Bulk water boards",
  "sectorId": "water-wastewater"
 },
 {
  "name": "Municipal water & sanitation",
  "sectorId": "water-wastewater"
 },
 {
  "name": "Wastewater treatment works",
  "sectorId": "water-wastewater"
 },
 {
  "name": "Desalination",
  "sectorId": "water-wastewater"
 },
 {
  "name": "Mine water treatment",
  "sectorId": "water-wastewater"
 },
 {
  "name": "Irrigation schemes",
  "sectorId": "water-wastewater"
 },
 {
  "name": "Abalone farms",
  "sectorId": "aquaculture-marine"
 },
 {
  "name": "Land-based finfish & RAS",
  "sectorId": "aquaculture-marine"
 },
 {
  "name": "Oyster & mussel farms",
  "sectorId": "aquaculture-marine"
 },
 {
  "name": "Fish processing & freezing",
  "sectorId": "aquaculture-marine"
 },
 {
  "name": "Squid & pelagic processing",
  "sectorId": "aquaculture-marine"
 },
 {
  "name": "Hotel groups",
  "sectorId": "hospitality-leisure"
 },
 {
  "name": "Casinos & resorts",
  "sectorId": "hospitality-leisure"
 },
 {
  "name": "Conference & exhibition centres",
  "sectorId": "hospitality-leisure"
 },
 {
  "name": "Game lodges",
  "sectorId": "hospitality-leisure"
 },
 {
  "name": "Stadiums & arenas",
  "sectorId": "hospitality-leisure"
 },
 {
  "name": "Radio astronomy arrays",
  "sectorId": "research-science-facilities"
 },
 {
  "name": "Nuclear research & isotopes",
  "sectorId": "research-science-facilities"
 },
 {
  "name": "Particle accelerators",
  "sectorId": "research-science-facilities"
 },
 {
  "name": "High-performance computing",
  "sectorId": "research-science-facilities"
 },
 {
  "name": "National laboratories",
  "sectorId": "research-science-facilities"
 },
 {
  "name": "Universities",
  "sectorId": "education-campuses"
 },
 {
  "name": "TVET colleges",
  "sectorId": "education-campuses"
 },
 {
  "name": "Private school groups",
  "sectorId": "education-campuses"
 },
 {
  "name": "Research institutions",
  "sectorId": "education-campuses"
 },
 {
  "name": "Scrap metal recovery",
  "sectorId": "waste-recycling"
 },
 {
  "name": "Plastics recycling & extrusion",
  "sectorId": "waste-recycling"
 },
 {
  "name": "Paper recycling",
  "sectorId": "waste-recycling"
 },
 {
  "name": "E-waste processing",
  "sectorId": "waste-recycling"
 },
 {
  "name": "Battery recycling & lead smelting",
  "sectorId": "waste-recycling"
 },
 {
  "name": "Landfill gas & waste-to-energy",
  "sectorId": "waste-recycling"
 },
 {
  "name": "Terrestrial transmitter networks",
  "sectorId": "broadcast-studios-media"
 },
 {
  "name": "Satellite uplink & playout",
  "sectorId": "broadcast-studios-media"
 },
 {
  "name": "Film & TV studios",
  "sectorId": "broadcast-studios-media"
 },
 {
  "name": "Post-production & render farms",
  "sectorId": "broadcast-studios-media"
 },
 {
  "name": "Live venues & arenas",
  "sectorId": "broadcast-studios-media"
 },
 {
  "name": "Explosives & propellants",
  "sectorId": "defence-aerospace-rail"
 },
 {
  "name": "Ammunition manufacture",
  "sectorId": "defence-aerospace-rail"
 },
 {
  "name": "Aerospace components & MRO",
  "sectorId": "defence-aerospace-rail"
 },
 {
  "name": "Rolling stock manufacture",
  "sectorId": "defence-aerospace-rail"
 },
 {
  "name": "Shipbuilding & repair",
  "sectorId": "defence-aerospace-rail"
 },
 {
  "name": "Armoured vehicle manufacture",
  "sectorId": "defence-aerospace-rail"
 },
 {
  "name": "Textile dyeing & finishing",
  "sectorId": "textiles-timber-light"
 },
 {
  "name": "Apparel manufacture",
  "sectorId": "textiles-timber-light"
 },
 {
  "name": "Tanneries & leather",
  "sectorId": "textiles-timber-light"
 },
 {
  "name": "Sawmilling & kiln drying",
  "sectorId": "textiles-timber-light"
 },
 {
  "name": "Board & laminate manufacture",
  "sectorId": "textiles-timber-light"
 },
 {
  "name": "Furniture manufacture",
  "sectorId": "textiles-timber-light"
 },
 {
  "name": "Commercial printing",
  "sectorId": "textiles-timber-light"
 },
 {
  "name": "Industrial laundries",
  "sectorId": "textiles-timber-light"
 }
];

/* Ranked shortlists — where to point the desk first. */
const SECTOR_SHORTLISTS = [
 {
  "name": "Fastest paths",
  "meaning": "Shortest cycle from first call to signature. Start here.",
  "sectors": [
   "Automotive & Heavy Manufacturing",
   "Data Centres & Digital Infrastructure",
   "Commercial Property, REITs & Shopping Centres",
   "Retail Chains (Multi-Site)",
   "Cold Chain, Warehousing & Logistics",
   "Waste Management, Recycling & Metal Recovery",
   "Foundries, Galvanising & Metal Fabrication"
  ]
 },
 {
  "name": "Biggest prizes",
  "meaning": "Largest MW, longest cycle. Worth resourcing separately.",
  "sectors": [
   "Smelting, Ferroalloys & Primary Metals",
   "Chemicals & Petrochemicals",
   "Data Centres & Digital Infrastructure",
   "Municipalities & Public Sector Estates",
   "Green Hydrogen, Ammonia & New Industrial Demand",
   "Mineral Beneficiation & Processing (Non-Mine)",
   "Oil Refining, Fuel Terminals & Pipelines"
  ]
 },
 {
  "name": "Best solar load match",
  "meaning": "Load shape aligns with generation, so solar-only works.",
  "sectors": [
   "Agriculture, Irrigation & Agri-Processing",
   "Commercial Property, REITs & Shopping Centres",
   "Universities, Colleges & Campuses",
   "Automotive & Heavy Manufacturing",
   "Banking, Insurance & BPO / Contact Centres"
  ]
 },
 {
  "name": "Needs virtual wheeling",
  "meaning": "Many small LV sites across municipalities — traditional wheeling cannot reach them.",
  "sectors": [
   "Retail Chains (Multi-Site)",
   "Telecommunications & Tower Networks",
   "Hospital Groups & Healthcare",
   "Hotels, Gaming & Leisure",
   "Banking, Insurance & BPO / Contact Centres"
  ]
 },
 {
  "name": "Aggregation candidates",
  "meaning": "Individually sub-scale. Bundle via a park, co-op or association.",
  "sectors": [
   "Foundries, Galvanising & Metal Fabrication",
   "Textiles, Timber & Light Manufacturing",
   "Waste Management, Recycling & Metal Recovery",
   "Agriculture, Irrigation & Agri-Processing",
   "Aquaculture, Abalone & Marine Processing",
   "Cold Chain, Warehousing & Logistics"
  ]
 },
 {
  "name": "Adjacent to mining",
  "meaning": "Separate legal buyers with their own connection, next to the mining pipeline.",
  "sectors": [
   "Mineral Beneficiation & Processing (Non-Mine)",
   "Smelting, Ferroalloys & Primary Metals",
   "Foundries, Galvanising & Metal Fabrication"
  ]
 },
 {
  "name": "Prioritisation logic",
  "meaning": "Rank an account by (annual GWh × tariff exposure × PPA structure fit × credit strength) and discount heavily for procurement friction. A 40MW automotive plant with a European parent target beats a 300MW state-owned entity that tenders every 36 months.",
  "sectors": []
 },
 {
  "name": "Opening question, any account",
  "meaning": "What did you pay per kWh last month, all-in, and what is that number going to be in five years?",
  "sectors": []
 }
];

/* ═══════════════════════════════════════════════════════════════
   MARKET CONTEXT — South Africa, as at 2026-Q3.
   Re-verify before putting any figure in front of a client.
   ═══════════════════════════════════════════════════════════════ */
const MARKET = {
  asAt: '2026-Q3',

  /* All-in ZAR/kWh. The Megaflex band is what an offtaker is escaping;
     the wheeled bands are what AEE can offer against it. */
  tariffs: [
    { id: 'megaflex', label: 'Eskom Megaflex (all-in)', low: 2.00, high: 2.60,
      note: 'Typical blended large-user rate. Municipal resale is higher.' },
    { id: 'solar',  label: 'Wheeled solar',  low: 1.15, high: 1.45, note: 'Generation plus wheeling and losses.' },
    { id: 'wind',   label: 'Wheeled wind',   low: 1.20, high: 1.55, note: '' },
    { id: 'hybrid', label: 'Wheeled hybrid', low: 1.35, high: 1.75, note: 'Solar plus wind and/or BESS.' },
  ],

  ppaTerms: [
    { label: 'Tenor', value: '10–20 years, commonly 15' },
    { label: 'Escalation', value: 'CPI-linked, sometimes capped or partially utility-indexed' },
    { label: 'Minimum offtake', value: '70–85% take-or-pay' },
    { label: 'Delivery shape', value: 'Pay-as-produced unless firmed with storage' },
  ],

  /* An account must clear all of these to be worth a term sheet. */
  qualifiers: [
    'Connected at medium voltage or higher, on a time-of-use tariff (Megaflex or municipal equivalent) — otherwise route to virtual wheeling or behind-the-meter',
    'Located in a municipality with a working wheeling framework, or supplied directly by Eskom',
    'Creditworthy over a 10–15 year tenor, or able to provide a parent guarantee',
    'Load of roughly 10 GWh/yr and up to stand alone; below that, aggregate',
  ],

  disqualifiers: [
    'Annual consumption below roughly 5 GWh with no group to aggregate into',
    'No credit standing over a 10-year tenor and no parent guarantee available',
    'Site in a municipality with no wheeling framework and no appetite for a virtual structure',
    'Lease expiring inside three years with no renewal certainty (behind-the-meter only)',
  ],

  watchItems: [
    'Grid losses of 6–10% are often quoted separately and hide about 10c/kWh of real cost — disclose them up front to win trust',
    'Curtailment risk allocation is the most contested clause in current negotiations',
    'Municipal wheeling frameworks remain immature outside the major metros',
    'Negotiated Price Agreements for heavy industry are being reworked and change the comparison baseline for smelters',
  ],

  /* Rank an account by (annual GWh x tariff exposure x structure fit x
     credit strength) and discount heavily for procurement friction. */
  prioritisation: 'A 40 MW automotive plant with a European parent target beats a 300 MW state-owned entity that tenders every 36 months.',
  openingQuestion: 'What did you pay per kWh last month, all-in, and what is that number going to be in five years?',
};

/* Midpoints, used as the calculator's starting assumptions so the
   default quote reflects the real market rather than a guess. */
const MARKET_MEGAFLEX_MID = (2.00 + 2.60) / 2;   // R2.30
const MARKET_SOLAR_MID    = (1.15 + 1.45) / 2;   // R1.30

/* ═══════════════════════════════════════════════════════════════
   STAKEHOLDER LADDER — who to approach, in what order, and the
   reason each one takes the call.

   Source: Repo - Data.xlsx, Stakeholders sheet. This complements
   CONTACT_ROLES above rather than repeating it: CONTACT_ROLES maps a
   title to the sectors where it is the primary contact, while this
   gives the approach ORDER and, more usefully on a cold call, why the
   person on the other end has a reason to listen.

   It also carries the mining and joint-venture roles that the
   non-mining sector taxonomy has no home for.
   ═══════════════════════════════════════════════════════════════ */
const STAKEHOLDER_TIERS = [
  {
    id: 'open',
    label: 'Tier 1 — open here',
    hint: 'These people have the problem and want the call.',
    roles: [
      { title: 'Energy Director / Group Head of Energy',            why: 'Owns the energy cost line and the supply strategy' },
      { title: 'Group Energy Manager / Energy & Utilities Manager', why: 'Day-to-day owner of tariffs, load and Eskom exposure' },
      { title: 'Head of Energy Transition / Decarbonisation Manager', why: 'Has a target and a deadline, needs MW to hit it' },
      { title: 'Chief Sustainability Officer',                      why: 'Owns the Scope 2 commitment publicly' },
      { title: 'Head of ESG / Carbon Manager',                      why: 'Reports the emissions number; a renewable PPA is their fix' },
      { title: 'Utilities Manager (site)',                          why: 'At smelters, concentrators and refineries — huge continuous load' },
    ],
  },
  {
    id: 'multithread',
    label: 'Tier 2 — multithread once Tier 1 engages',
    hint: 'Bring these in after you have a champion, not before.',
    roles: [
      { title: 'COO / Operations Director',                  why: 'Cost-per-tonne owner; energy is a top-three input' },
      { title: 'CFO',                                        why: 'Signs a 15–20 year commitment; cares about tariff escalation certainty' },
      { title: 'Strategy Director',                          why: 'Owns the long-range energy security thesis' },
      { title: 'CEO / Managing Director',                    why: 'At mid-tier miners, genuinely reachable and often decisive' },
      { title: 'General Manager (site/complex)',             why: 'Real budget holder per operation' },
      { title: 'Mine Manager',                               why: 'Operational sponsor at site level' },
      { title: 'Engineering Manager (2.13.1 appointee)',     why: 'Technical validation — reticulation and connection point' },
      { title: 'Category Manager: Energy & Utilities',       why: 'Runs the RFP. Find them before the RFP is written, not after' },
      { title: 'Head of Procurement / Supply Chain',         why: 'Relevant at group level for large miners' },
    ],
  },
  {
    id: 'jv',
    label: 'Consortium / JV only',
    hint: 'Where the buyer is a joint venture rather than a single company.',
    roles: [
      { title: 'Programme Director / JV Project Director', why: "Owns the consortium's energy workstream" },
      { title: 'Shareholder Representative',               why: 'One per member company — each needs its own champion' },
    ],
  },
];

/* Flat title -> reason lookup, so a role shown anywhere in the app can
   carry its "why they take the meeting" line. */
const STAKEHOLDER_WHY = Object.fromEntries(
  STAKEHOLDER_TIERS.flatMap(t => t.roles.map(r => [r.title, r.why]))
);
