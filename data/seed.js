/* ═══════════════════════════════════════════════════════════════════
   Seed data — African Earth Energy Offtaker CRM
   Loaded as a plain script so the app works from file:// and GitHub
   Pages alike (no fetch, no server needed).

   AEE_PROJECTS    — the generation portfolio, from aeeg.co.za/en/projects
   PIPELINE_STAGES — the deal stages the kanban board is built from
   PLAYBOOK        — outreach scripts the sales team can copy/paste

   The sector taxonomy lives in data/sectors.js, which also defines
   SECTOR_LABEL.

   Only public, non-sensitive reference data lives here. The offtaker
   target list, the contacts and the pipeline are NOT in this file —
   they are in Supabase behind Row Level Security, so they are visible
   only to a signed-in account that has been granted a role.
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

/* Stages the sales team moves an opportunity through. These are the same
   seven stages the account sales path runs on (SF_STAGES below), deliberately
   so: the stage on the board reads the same as the stage on the account, and
   the pipeline page gives the position of every opportunity at a glance
   without opening each one.

   The order follows how AEEG actually sells power: reach several people at
   the company by email and LinkedIn, meet them online, meet them in person,
   then work out the need, put a commercial proposition on the table and
   finalise the PPA. The ids of the last four are the ones the five-stage
   path used, so accounts and opportunities already at those stages need no
   rewriting; only Prospecting became Outreach (see the legacy maps below). */
const PIPELINE_STAGES = [
  { id:'outreach',       label:'Outreach',               hint:'Reaching several people at the company by email, LinkedIn and phone. No meeting yet.' },
  { id:'online-meeting', label:'Online meeting',         hint:'First call or video meeting held, one-to-one or as a group.' },
  { id:'in-person',      label:'In-person meeting',      hint:'Met face to face: at their office, on site or at a conference.' },
  { id:'needs-analysis', label:'Needs analysis',         hint:'Establishing load, tariff, supply route, timing and who decides.' },
  { id:'proposal',       label:'Commercial proposition', hint:'Indicative tariff, volume and tenor on the table.' },
  { id:'negotiation',    label:'PPA finalisation',       hint:'Term sheet, diligence and the PPA being drafted and signed.' },
  { id:'closed',         label:'Closed',                 hint:'PPA executed.' },
];

/* Opportunities saved under older boards still carry their ids. Read those
   onto the stages above so nothing sits off the board. 'prospecting' is the
   first stage of the five-stage path, renamed Outreach. 'lost' has never
   had a column and is left as it is. */
const LEGACY_DEAL_STAGES = {
  prospecting: 'outreach',
  identified: 'outreach', contacted: 'needs-analysis', qualified: 'needs-analysis',
  proposal: 'proposal', diligence: 'negotiation', negotiation: 'negotiation', signed: 'closed',
};
/* The same for stage names quoted in logged sentences: a move written
   before a rename says "moved from Prospecting to Proposal", and without
   this the whole history reads as directionless. */
const LEGACY_STAGE_LABELS = {
  'prospecting': 'outreach', 'needs analysis': 'needs-analysis', 'proposal': 'proposal', 'negotiation': 'negotiation',
  'identified': 'outreach', 'contacted': 'needs-analysis', 'qualified': 'needs-analysis',
  'term sheet': 'proposal', 'due diligence': 'negotiation', 'ppa negotiation': 'negotiation',
  'signed': 'closed',
};

function normalizeDealStage(stage) {
  const s = String(stage || '');
  if (s === 'lost' || PIPELINE_STAGES.some(x => x.id === s)) return s;
  return LEGACY_DEAL_STAGES[s] || 'outreach';
}

/* The account's stored stage, read onto the current path. Empty stays
   empty: a lead has no stage, and that is what keeps it off the Pipeline. */
function normalizeSfStage(stage) {
  const s = String(stage || '');
  if (!s) return '';
  if (SF_STAGES.some(x => x.id === s)) return s;
  return LEGACY_DEAL_STAGES[s] || '';
}


/* The Salesforce sales process, run on the ACCOUNT rather than on a single
   opportunity. PIPELINE_STAGES above carries the same seven stages for the
   deal board, so the two read alike — this is the same question asked of a
   company rather than of one opportunity: where is this one in the process?

   `status` is the same idea in this app's own words, so the two are kept in
   step: moving an account along the path writes the matching status, which
   is what the badges, filters and dashboards already read. Closed is split
   on the way in — won becomes contracted, lost becomes lost. */
/* stallDays: how long an account may sit at a stage before it is worth a
   nudge. Not an SLA and nothing enforces it — a PPA runs a 9 to 18 month
   cycle, so these are the points at which silence starts to mean something
   rather than deadlines. Closed does not stall; it is finished.

   Outreach gets 21 days: three email touches five working days apart run
   about that long, and an account still without a single meeting after a
   full round needs a new angle (another person, another channel). */
const SF_STAGES = [
  { id:'outreach',       label:'Outreach',               prob:5,   status:'prospect',    stallDays:21,
    hint:'Reaching several people at the company by email, LinkedIn and phone. Moves on when a first meeting is held.' },
  { id:'online-meeting', label:'Online meeting',         prob:10,  status:'engaged',     stallDays:30,
    hint:'First call or video meeting held, one-to-one or as a group. Moves on when you meet in person, or skip straight to needs analysis.' },
  { id:'in-person',      label:'In-person meeting',      prob:15,  status:'engaged',     stallDays:30,
    hint:'Met face to face: at their office, on site or at a conference. Moves on when they agree to share consumption data.' },
  { id:'needs-analysis', label:'Needs analysis',         prob:25,  status:'engaged',     stallDays:45,
    hint:'Establishing load, tariff, supply route, when they need power and who decides.' },
  { id:'proposal',       label:'Commercial proposition', prob:50,  status:'qualified',   stallDays:30,
    hint:'Indicative tariff, volume and tenor with the customer.' },
  { id:'negotiation',    label:'PPA finalisation',       prob:75,  status:'negotiating', stallDays:60,
    hint:'Term sheet, diligence and the PPA being drafted and signed.' },
  { id:'closed',         label:'Closed',                 prob:100, status:'contracted',  stallDays:null,
    hint:'Signed, or closed lost. Either way it is off the working board.' },
];

/* What it takes to leave each stage, and how to get there: the checklist and
   the guidance on an opportunity's page (js/views-opportunity.js), the way
   Salesforce shows "key fields" and "guidance for success" under its path.
   `exit` items are ticked from what the CRM already holds where it can tell
   (see opportunityChecks); the rest stay for a rep to judge. */
const STAGE_PLAYBOOK = {
  'outreach': {
    exit: ['At least three people reached', 'A reply from someone at the company', 'A first meeting held'],
    guidance: ['Email the energy, sustainability and engineering leads one by one, not as one group mail.',
      'Send each of them a LinkedIn connection request the same week.',
      'Three touches per person, five working days apart. After that, try somebody else.'],
  },
  'online-meeting': {
    exit: ['An online meeting held', 'A decision maker on file', 'An in-person meeting or site visit held'],
    guidance: ['Lead with their tariff exposure and Scope 2 target, not with our project.',
      'Ask who else has to be in the room for a PPA.', 'Agree the next meeting before you hang up.'],
  },
  'in-person': {
    exit: ['Met in person: office, site or conference', 'Their load established (not a desk estimate)', 'Somebody in finance on file'],
    guidance: ['Walk the site if you can: connection point, substation, load.',
      'Ask for twelve months of half-hourly data.', 'Find out how the board signs off a 15 to 20 year contract.'],
  },
  'needs-analysis': {
    exit: ['Annual load and peak confirmed', 'Wheeling route likely or confirmed', 'A target close date on the opportunity'],
    guidance: ['Model the saving against their Eskom or municipal tariff.',
      'Check grid capacity on the wheeling path.', 'Map the approval chain: energy, finance, board.'],
  },
  'proposal': {
    exit: ['Proposal sent', 'Feedback logged since the proposal', 'Tariff and tenor set on the opportunity'],
    guidance: ['Put tariff, escalation, tenor and volume on one page.',
      'Name the site the power comes from.', 'Book the feedback meeting when you send it.'],
  },
  'negotiation': {
    exit: ['Term sheet signed', 'Diligence complete', 'PPA signed'],
    guidance: ['Keep a list of open legal points and who owns each.',
      'Line up credit approval early.', 'Agree the signing date with both boards.'],
  },
  'closed': { exit: [], guidance: ['Hand over to delivery, and log the signed MW against the site.'] },
};

/* Records created before the path existed carry no stage, so read it back
   out of the status they already have. That means the board is populated
   on the first load rather than every account sitting in Outreach. Engaged
   reads as Needs analysis, not as a meeting stage, because that is what it
   meant on the five-stage path. */
const STATUS_TO_SF_STAGE = {
  prospect:'outreach', engaged:'needs-analysis', qualified:'proposal',
  negotiating:'negotiation', contracted:'closed', lost:'closed',
};

/* ─── OUTREACH ────────────────────────────────────────────────────
   How a touch was made. `type` is the older, coarser activity type the
   log has always carried, kept so every page that reads it (calendar,
   timeline, exports) still works. `outreach` marks the channels that count
   as reaching out to a person, and so get a touch number and a follow-up.
   `stage` is where the account is moved forward to when a meeting of that
   kind is logged as held: never backward, and only for meetings. */
const OUTREACH_CHANNELS = [
  { id:'email',          label:'Email',                       type:'email',      outreach:true },
  { id:'linkedin-connect', label:'LinkedIn connection request', type:'linkedin', outreach:true },
  { id:'linkedin-message', label:'LinkedIn message',          type:'linkedin',   outreach:true },
  { id:'call',           label:'Call',                        type:'call',       outreach:true },
  { id:'online-meeting', label:'Online meeting',              type:'meeting',    meeting:true, stage:'online-meeting' },
  { id:'in-person',      label:'In-person meeting',           type:'meeting',    meeting:true, stage:'in-person' },
  { id:'conference',     label:'Met at a conference or event', type:'meeting',   meeting:true, stage:'in-person' },
  { id:'site-visit',     label:'Site visit',                  type:'site visit', meeting:true, stage:'in-person' },
  { id:'proposal',       label:'Proposal sent',               type:'proposal' },
  { id:'note',           label:'Note',                        type:'note' },
];

/* What came of it. `result` marks the outcomes the rollups count as a
   result (decision D3): a reply, a booked meeting and a held meeting are
   counted separately; a plain send is activity, not a result. */
const OUTREACH_OUTCOMES = [
  { id:'sent',           label:'Sent' },
  { id:'replied',        label:'Replied',          result:true },
  { id:'meeting-booked', label:'Meeting booked',   result:true },
  { id:'held',           label:'Meeting held',     result:true },
  { id:'declined',       label:'Declined' },
  { id:'no-answer',      label:'No answer' },
];

/* Decision D4: three touches per person, five working days apart. After
   the third unanswered touch the person reads as cold. */
const OUTREACH_FOLLOW_UP_WORKDAYS = 5;
const OUTREACH_MAX_TOUCHES = 3;


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
