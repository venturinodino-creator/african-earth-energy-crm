/* ═══════════════════════════════════════════════════════════════════
   South African municipalities — the full set of 257.

   Why this list is in the CRM at all: a municipality is two different
   counterparties at once. It is a large electricity CONSUMER in its own
   right (water and sewage pumping, street lighting, depots, civic
   buildings — pumping alone is often the biggest line on a local
   municipality's budget), and it is the DISTRIBUTOR that a wheeled PPA
   has to cross to reach a customer inside its supply area. The first
   makes it a target; the second makes it a gatekeeper for every other
   target in its boundary. Both conversations start with the same people,
   so both are worked from the same record.

   Structure, per the Municipal Structures Act:
     Category A  metropolitan — 8, single-tier, no district above them
     Category C  district     — 44, sit above a group of locals
     Category B  local        — 205, inside a district

   Counts here reconcile to 8 / 44 / 205 = 257, which is the official
   split after the 2016 demarcation. That reconciliation is asserted at
   the bottom of this file, so a typo that drops or doubles an entry
   fails loudly at load rather than quietly skewing every count in the
   app.

   VERIFY BEFORE RELYING ON IT: names and codes are as recorded here from
   public reference material, not pulled from the Municipal Demarcation
   Board's own feed. Metros and districts are stable and safe. Local
   municipality names moved a lot in the 2016 amalgamations (Emalahleni
   exists twice, in two provinces; several were renamed after people),
   so spot-check a local's spelling before it goes on a letter.

   Seats are the administrative seat — the town the council sits in, and
   in practice the town a rep drives to.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* [code, name, seat] */
const MUNI_TREE = {
  'Western Cape': {
    metros: [['CPT', 'City of Cape Town', 'Cape Town']],
    districts: [
      { code: 'DC1', name: 'West Coast', seat: 'Moorreesburg', locals: [
        ['WC011', 'Matzikama', 'Vredendal'],
        ['WC012', 'Cederberg', 'Clanwilliam'],
        ['WC013', 'Bergrivier', 'Piketberg'],
        ['WC014', 'Saldanha Bay', 'Vredenburg'],
        ['WC015', 'Swartland', 'Malmesbury'],
      ] },
      { code: 'DC2', name: 'Cape Winelands', seat: 'Worcester', locals: [
        ['WC022', 'Witzenberg', 'Ceres'],
        ['WC023', 'Drakenstein', 'Paarl'],
        ['WC024', 'Stellenbosch', 'Stellenbosch'],
        ['WC025', 'Breede Valley', 'Worcester'],
        ['WC026', 'Langeberg', 'Ashton'],
      ] },
      { code: 'DC3', name: 'Overberg', seat: 'Bredasdorp', locals: [
        ['WC031', 'Theewaterskloof', 'Caledon'],
        ['WC032', 'Overstrand', 'Hermanus'],
        ['WC033', 'Cape Agulhas', 'Bredasdorp'],
        ['WC034', 'Swellendam', 'Swellendam'],
      ] },
      { code: 'DC4', name: 'Garden Route', seat: 'George', locals: [
        ['WC041', 'Kannaland', 'Ladismith'],
        ['WC042', 'Hessequa', 'Riversdale'],
        ['WC043', 'Mossel Bay', 'Mossel Bay'],
        ['WC044', 'George', 'George'],
        ['WC045', 'Oudtshoorn', 'Oudtshoorn'],
        ['WC047', 'Bitou', 'Plettenberg Bay'],
        ['WC048', 'Knysna', 'Knysna'],
      ] },
      { code: 'DC5', name: 'Central Karoo', seat: 'Beaufort West', locals: [
        ['WC051', 'Laingsburg', 'Laingsburg'],
        ['WC052', 'Prince Albert', 'Prince Albert'],
        ['WC053', 'Beaufort West', 'Beaufort West'],
      ] },
    ],
  },

  'Eastern Cape': {
    metros: [
      ['BUF', 'Buffalo City', 'East London'],
      ['NMA', 'Nelson Mandela Bay', 'Gqeberha'],
    ],
    districts: [
      { code: 'DC10', name: 'Sarah Baartman', seat: 'Gqeberha', locals: [
        ['EC101', 'Dr Beyers Naudé', 'Graaff-Reinet'],
        ['EC102', 'Blue Crane Route', 'Somerset East'],
        ['EC104', 'Makana', 'Makhanda'],
        ['EC105', 'Ndlambe', 'Port Alfred'],
        ['EC106', 'Sundays River Valley', 'Kirkwood'],
        ['EC107', 'Kouga', 'Jeffreys Bay'],
        ['EC108', 'Kou-Kamma', 'Kareedouw'],
      ] },
      { code: 'DC12', name: 'Amathole', seat: 'East London', locals: [
        ['EC121', 'Mbhashe', 'Dutywa'],
        ['EC122', 'Mnquma', 'Butterworth'],
        ['EC123', 'Great Kei', 'Komga'],
        ['EC124', 'Amahlathi', 'Stutterheim'],
        ['EC126', 'Ngqushwa', 'Peddie'],
        ['EC129', 'Raymond Mhlaba', 'Fort Beaufort'],
      ] },
      { code: 'DC13', name: 'Chris Hani', seat: 'Komani', locals: [
        ['EC131', 'Inxuba Yethemba', 'Cradock'],
        ['EC135', 'Intsika Yethu', 'Cofimvaba'],
        ['EC136', 'Emalahleni', 'Lady Frere'],
        ['EC137', 'Engcobo', 'Engcobo'],
        ['EC138', 'Sakhisizwe', 'Cala'],
        ['EC139', 'Enoch Mgijima', 'Komani'],
      ] },
      { code: 'DC14', name: 'Joe Gqabi', seat: 'Barkly East', locals: [
        ['EC141', 'Elundini', 'Mount Fletcher'],
        ['EC142', 'Senqu', 'Lady Grey'],
        ['EC145', 'Walter Sisulu', 'Burgersdorp'],
      ] },
      { code: 'DC15', name: 'OR Tambo', seat: 'Mthatha', locals: [
        ['EC153', 'Ngquza Hill', 'Flagstaff'],
        ['EC154', 'Port St Johns', 'Port St Johns'],
        ['EC155', 'Nyandeni', 'Libode'],
        ['EC156', 'Mhlontlo', 'Qumbu'],
        ['EC157', 'King Sabata Dalindyebo', 'Mthatha'],
      ] },
      { code: 'DC44', name: 'Alfred Nzo', seat: 'Mount Ayliff', locals: [
        ['EC441', 'Matatiele', 'Matatiele'],
        ['EC442', 'Umzimvubu', 'Mount Frere'],
        ['EC443', 'Winnie Madikizela-Mandela', 'Bizana'],
        ['EC444', 'Ntabankulu', 'Ntabankulu'],
      ] },
    ],
  },

  'Northern Cape': {
    metros: [],
    districts: [
      { code: 'DC6', name: 'Namakwa', seat: 'Springbok', locals: [
        ['NC061', 'Richtersveld', 'Port Nolloth'],
        ['NC062', 'Nama Khoi', 'Springbok'],
        ['NC064', 'Kamiesberg', 'Garies'],
        ['NC065', 'Hantam', 'Calvinia'],
        ['NC066', 'Karoo Hoogland', 'Williston'],
        ['NC067', 'Khâi-Ma', 'Pofadder'],
      ] },
      { code: 'DC7', name: 'Pixley ka Seme', seat: 'De Aar', locals: [
        ['NC071', 'Ubuntu', 'Victoria West'],
        ['NC072', 'Umsobomvu', 'Colesberg'],
        ['NC073', 'Emthanjeni', 'De Aar'],
        ['NC074', 'Kareeberg', 'Carnarvon'],
        ['NC075', 'Renosterberg', 'Petrusville'],
        ['NC076', 'Thembelihle', 'Hopetown'],
        ['NC077', 'Siyathemba', 'Prieska'],
        ['NC078', 'Siyancuma', 'Douglas'],
      ] },
      { code: 'DC8', name: 'ZF Mgcawu', seat: 'Upington', locals: [
        ['NC082', '!Kai! Garib', 'Kakamas'],
        ['NC084', '!Kheis', 'Groblershoop'],
        ['NC085', 'Tsantsabane', 'Postmasburg'],
        ['NC086', 'Kgatelopele', 'Danielskuil'],
        ['NC087', 'Dawid Kruiper', 'Upington'],
      ] },
      { code: 'DC9', name: 'Frances Baard', seat: 'Kimberley', locals: [
        ['NC091', 'Sol Plaatje', 'Kimberley'],
        ['NC092', 'Dikgatlong', 'Barkly West'],
        ['NC093', 'Magareng', 'Warrenton'],
        ['NC094', 'Phokwane', 'Hartswater'],
      ] },
      { code: 'DC45', name: 'John Taolo Gaetsewe', seat: 'Kuruman', locals: [
        ['NC451', 'Joe Morolong', 'Mothibistad'],
        ['NC452', 'Ga-Segonyana', 'Kuruman'],
        ['NC453', 'Gamagara', 'Kathu'],
      ] },
    ],
  },

  'Free State': {
    metros: [['MAN', 'Mangaung', 'Bloemfontein']],
    districts: [
      { code: 'DC16', name: 'Xhariep', seat: 'Trompsburg', locals: [
        ['FS161', 'Letsemeng', 'Koffiefontein'],
        ['FS162', 'Kopanong', 'Trompsburg'],
        ['FS163', 'Mohokare', 'Zastron'],
      ] },
      { code: 'DC18', name: 'Lejweleputswa', seat: 'Welkom', locals: [
        ['FS181', 'Masilonyana', 'Theunissen'],
        ['FS182', 'Tokologo', 'Boshof'],
        ['FS183', 'Tswelopele', 'Bultfontein'],
        ['FS184', 'Matjhabeng', 'Welkom'],
        ['FS185', 'Nala', 'Bothaville'],
      ] },
      { code: 'DC19', name: 'Thabo Mofutsanyana', seat: 'Phuthaditjhaba', locals: [
        ['FS191', 'Setsoto', 'Ficksburg'],
        ['FS192', 'Dihlabeng', 'Bethlehem'],
        ['FS193', 'Nketoana', 'Reitz'],
        ['FS194', 'Maluti-a-Phofung', 'Phuthaditjhaba'],
        ['FS195', 'Phumelela', 'Vrede'],
        ['FS196', 'Mantsopa', 'Ladybrand'],
      ] },
      { code: 'DC20', name: 'Fezile Dabi', seat: 'Sasolburg', locals: [
        ['FS201', 'Moqhaka', 'Kroonstad'],
        ['FS203', 'Ngwathe', 'Parys'],
        ['FS204', 'Metsimaholo', 'Sasolburg'],
        ['FS205', 'Mafube', 'Frankfort'],
      ] },
    ],
  },

  'KwaZulu-Natal': {
    metros: [['ETH', 'eThekwini', 'Durban']],
    districts: [
      { code: 'DC21', name: 'Ugu', seat: 'Port Shepstone', locals: [
        ['KZN212', 'uMdoni', 'Scottburgh'],
        ['KZN213', 'uMzumbe', 'Hibberdene'],
        ['KZN214', 'uMuziwabantu', 'Harding'],
        ['KZN216', 'Ray Nkonyeni', 'Port Shepstone'],
      ] },
      { code: 'DC22', name: 'uMgungundlovu', seat: 'Pietermaritzburg', locals: [
        ['KZN221', 'uMshwathi', 'Wartburg'],
        ['KZN222', 'uMngeni', 'Howick'],
        ['KZN223', 'Mpofana', 'Mooi River'],
        ['KZN224', 'Impendle', 'Impendle'],
        ['KZN225', 'Msunduzi', 'Pietermaritzburg'],
        ['KZN226', 'Mkhambathini', 'Camperdown'],
        ['KZN227', 'Richmond', 'Richmond'],
      ] },
      { code: 'DC23', name: 'uThukela', seat: 'Ladysmith', locals: [
        ['KZN235', 'Okhahlamba', 'Bergville'],
        ['KZN237', 'Inkosi Langalibalele', 'Estcourt'],
        ['KZN238', 'Alfred Duma', 'Ladysmith'],
      ] },
      { code: 'DC24', name: 'uMzinyathi', seat: 'Dundee', locals: [
        ['KZN241', 'Endumeni', 'Dundee'],
        ['KZN242', 'Nquthu', 'Nquthu'],
        ['KZN244', 'Msinga', 'Tugela Ferry'],
        ['KZN245', 'uMvoti', 'Greytown'],
      ] },
      { code: 'DC25', name: 'Amajuba', seat: 'Newcastle', locals: [
        ['KZN252', 'Newcastle', 'Newcastle'],
        ['KZN253', 'eMadlangeni', 'Utrecht'],
        ['KZN254', 'Dannhauser', 'Dannhauser'],
      ] },
      { code: 'DC26', name: 'Zululand', seat: 'Ulundi', locals: [
        ['KZN261', 'eDumbe', 'Paulpietersburg'],
        ['KZN262', 'uPhongolo', 'Pongola'],
        ['KZN263', 'AbaQulusi', 'Vryheid'],
        ['KZN265', 'Nongoma', 'Nongoma'],
        ['KZN266', 'Ulundi', 'Ulundi'],
      ] },
      { code: 'DC27', name: 'uMkhanyakude', seat: 'Mkuze', locals: [
        ['KZN271', 'uMhlabuyalingana', 'Manguzi'],
        ['KZN272', 'Jozini', 'Jozini'],
        ['KZN275', 'Mtubatuba', 'Mtubatuba'],
        ['KZN276', 'Big 5 Hlabisa', 'Hlabisa'],
      ] },
      { code: 'DC28', name: 'King Cetshwayo', seat: 'Richards Bay', locals: [
        ['KZN281', 'uMfolozi', 'KwaMbonambi'],
        ['KZN282', 'uMhlathuze', 'Richards Bay'],
        ['KZN284', 'uMlalazi', 'Eshowe'],
        ['KZN285', 'Mthonjaneni', 'Melmoth'],
        ['KZN286', 'Nkandla', 'Nkandla'],
      ] },
      { code: 'DC29', name: 'iLembe', seat: 'KwaDukuza', locals: [
        ['KZN291', 'Mandeni', 'Mandeni'],
        ['KZN292', 'KwaDukuza', 'Stanger'],
        ['KZN293', 'Ndwedwe', 'Ndwedwe'],
        ['KZN294', 'Maphumulo', 'Maphumulo'],
      ] },
      { code: 'DC43', name: 'Harry Gwala', seat: 'Ixopo', locals: [
        ['KZN433', 'Greater Kokstad', 'Kokstad'],
        ['KZN434', 'Ubuhlebezwe', 'Ixopo'],
        ['KZN435', 'Umzimkhulu', 'Umzimkhulu'],
        ['KZN436', 'Dr Nkosazana Dlamini Zuma', 'Creighton'],
      ] },
    ],
  },

  'North West': {
    metros: [],
    districts: [
      { code: 'DC37', name: 'Bojanala Platinum', seat: 'Rustenburg', locals: [
        ['NW371', 'Moretele', 'Makapanstad'],
        ['NW372', 'Madibeng', 'Brits'],
        ['NW373', 'Rustenburg', 'Rustenburg'],
        ['NW374', 'Kgetlengrivier', 'Koster'],
        ['NW375', 'Moses Kotane', 'Mogwase'],
      ] },
      { code: 'DC38', name: 'Ngaka Modiri Molema', seat: 'Mahikeng', locals: [
        ['NW381', 'Ratlou', 'Setlagole'],
        ['NW382', 'Tswaing', 'Delareyville'],
        ['NW383', 'Mahikeng', 'Mahikeng'],
        ['NW384', 'Ditsobotla', 'Lichtenburg'],
        ['NW385', 'Ramotshere Moiloa', 'Zeerust'],
      ] },
      { code: 'DC39', name: 'Dr Ruth Segomotsi Mompati', seat: 'Vryburg', locals: [
        ['NW392', 'Naledi', 'Vryburg'],
        ['NW393', 'Mamusa', 'Schweizer-Reneke'],
        ['NW394', 'Greater Taung', 'Taung'],
        ['NW396', 'Lekwa-Teemane', 'Christiana'],
        ['NW397', 'Kagisano-Molopo', 'Ganyesa'],
      ] },
      { code: 'DC40', name: 'Dr Kenneth Kaunda', seat: 'Klerksdorp', locals: [
        ['NW403', 'City of Matlosana', 'Klerksdorp'],
        ['NW404', 'Maquassi Hills', 'Wolmaransstad'],
        ['NW405', 'JB Marks', 'Potchefstroom'],
      ] },
    ],
  },

  'Gauteng': {
    metros: [
      ['JHB', 'City of Johannesburg', 'Johannesburg'],
      ['EKU', 'City of Ekurhuleni', 'Germiston'],
      ['TSH', 'City of Tshwane', 'Pretoria'],
    ],
    districts: [
      { code: 'DC42', name: 'Sedibeng', seat: 'Vereeniging', locals: [
        ['GT421', 'Emfuleni', 'Vanderbijlpark'],
        ['GT422', 'Midvaal', 'Meyerton'],
        ['GT423', 'Lesedi', 'Heidelberg'],
      ] },
      { code: 'DC48', name: 'West Rand', seat: 'Randfontein', locals: [
        ['GT481', 'Mogale City', 'Krugersdorp'],
        ['GT484', 'Merafong City', 'Carletonville'],
        ['GT485', 'Rand West City', 'Randfontein'],
      ] },
    ],
  },

  'Mpumalanga': {
    metros: [],
    districts: [
      { code: 'DC30', name: 'Gert Sibande', seat: 'Ermelo', locals: [
        ['MP301', 'Chief Albert Luthuli', 'Carolina'],
        ['MP302', 'Msukaligwa', 'Ermelo'],
        ['MP303', 'Mkhondo', 'Piet Retief'],
        ['MP304', 'Dr Pixley Ka Isaka Seme', 'Volksrust'],
        ['MP305', 'Lekwa', 'Standerton'],
        ['MP306', 'Dipaleseng', 'Balfour'],
        ['MP307', 'Govan Mbeki', 'Secunda'],
      ] },
      { code: 'DC31', name: 'Nkangala', seat: 'Middelburg', locals: [
        ['MP311', 'Victor Khanye', 'Delmas'],
        ['MP312', 'Emalahleni', 'eMalahleni'],
        ['MP313', 'Steve Tshwete', 'Middelburg'],
        ['MP314', 'Emakhazeni', 'Belfast'],
        ['MP315', 'Thembisile Hani', 'KwaMhlanga'],
        ['MP316', 'Dr JS Moroka', 'Siyabuswa'],
      ] },
      { code: 'DC32', name: 'Ehlanzeni', seat: 'Mbombela', locals: [
        ['MP321', 'Thaba Chweu', 'Lydenburg'],
        ['MP324', 'Nkomazi', 'Malalane'],
        ['MP325', 'Bushbuckridge', 'Bushbuckridge'],
        ['MP326', 'City of Mbombela', 'Mbombela'],
      ] },
    ],
  },

  'Limpopo': {
    metros: [],
    districts: [
      { code: 'DC33', name: 'Mopani', seat: 'Giyani', locals: [
        ['LIM331', 'Greater Giyani', 'Giyani'],
        ['LIM332', 'Greater Letaba', 'Modjadjiskloof'],
        ['LIM333', 'Greater Tzaneen', 'Tzaneen'],
        ['LIM334', 'Ba-Phalaborwa', 'Phalaborwa'],
        ['LIM335', 'Maruleng', 'Hoedspruit'],
      ] },
      { code: 'DC34', name: 'Vhembe', seat: 'Thohoyandou', locals: [
        ['LIM341', 'Musina', 'Musina'],
        ['LIM343', 'Thulamela', 'Thohoyandou'],
        ['LIM344', 'Makhado', 'Louis Trichardt'],
        ['LIM345', 'Collins Chabane', 'Malamulele'],
      ] },
      { code: 'DC35', name: 'Capricorn', seat: 'Polokwane', locals: [
        ['LIM351', 'Blouberg', 'Senwabarwana'],
        ['LIM352', 'Molemole', 'Mogwadi'],
        ['LIM353', 'Polokwane', 'Polokwane'],
        ['LIM354', 'Lepelle-Nkumpi', 'Lebowakgomo'],
      ] },
      { code: 'DC36', name: 'Waterberg', seat: 'Modimolle', locals: [
        ['LIM361', 'Thabazimbi', 'Thabazimbi'],
        ['LIM362', 'Lephalale', 'Lephalale'],
        ['LIM366', 'Bela-Bela', 'Bela-Bela'],
        ['LIM367', 'Mogalakwena', 'Mokopane'],
        ['LIM368', 'Modimolle-Mookgophong', 'Modimolle'],
      ] },
      { code: 'DC47', name: 'Sekhukhune', seat: 'Groblersdal', locals: [
        ['LIM471', 'Ephraim Mogale', 'Marble Hall'],
        ['LIM472', 'Elias Motsoaledi', 'Groblersdal'],
        ['LIM473', 'Makhuduthamaga', 'Jane Furse'],
        ['LIM476', 'Fetakgomo Tubatse', 'Burgersfort'],
      ] },
    ],
  },
};

const MUNI_CATEGORY = {
  A: 'Metro',
  B: 'Local',
  C: 'District',
};
const MUNI_CATEGORY_LONG = {
  A: 'Metropolitan municipality',
  B: 'Local municipality',
  C: 'District municipality',
};

/* ─── THE MAIN MUNICIPALITIES ─────────────────────────
   A, B and C above are fixed by the Municipal Structures Act and are not
   a judgement about anything. This list IS a judgement: the eight metros
   plus the non-metro municipalities big enough, or industrial enough, to
   be worth a call before the other two hundred.

   It cuts across the legal categories on purpose — every metro is here,
   and so are sixteen Category B locals. No district is: a district holds
   very little load of its own, and the seat it governs from is usually a
   local municipality already on this list.

   NOT AN OFFICIAL LIST. There is no population or load figure in this
   file to rank on, so this is a starting set, and it is a starting set
   chosen for AEE: the larger secondary cities, plus the towns that carry
   the industrial loads a wheeled PPA is actually aimed at — Middelburg
   and Secunda in Mpumalanga, Richards Bay in KwaZulu-Natal, Rustenburg
   on the platinum belt, Lephalale at Medupi. Add and cut freely; the
   only rule is that a code has to exist, which is checked at load.

   Keyed on CODE, never on name. Emalahleni exists twice — EC136 is Lady
   Frere in the Eastern Cape and MP312 is Witbank — and it is the second
   one that carries the coal-belt load. Matching on the name would take
   whichever came first and be wrong roughly half the time. */
const MUNI_MAIN_CODES = new Set([
  /* The eight metros, all of them. */
  'CPT', 'JHB', 'ETH', 'TSH', 'EKU', 'NMA', 'BUF', 'MAN',

  /* Larger secondary cities — the biggest urban economies outside a metro. */
  'KZN225',  /* Msunduzi — Pietermaritzburg, the largest non-metro       */
  'LIM353',  /* Polokwane                                                */
  'GT421',   /* Emfuleni — Vanderbijlpark and Vereeniging, steel         */
  'MP326',   /* City of Mbombela — Nelspruit                             */
  'FS184',   /* Matjhabeng — Welkom, the Free State goldfields           */
  'NC091',   /* Sol Plaatje — Kimberley                                  */
  'WC044',   /* George — the Garden Route centre                         */
  'WC023',   /* Drakenstein — Paarl                                      */
  'NW403',   /* City of Matlosana — Klerksdorp                           */
  'KZN252',  /* Newcastle                                                */

  /* Industrial centres. Smaller towns, but the load is the reason this
     CRM exists — each of these is a smelter, a refinery or a power
     station's own municipality. */
  'MP312',   /* Emalahleni — Witbank, the coal belt (NOT EC136)          */
  'MP313',   /* Steve Tshwete — Middelburg, where AEE's own site sits    */
  'MP307',   /* Govan Mbeki — Secunda, Sasol                             */
  'KZN282',  /* uMhlathuze — Richards Bay, the smelters and the port     */
  'NW373',   /* Rustenburg — the platinum belt                           */
  'LIM362',  /* Lephalale — Medupi and Matimba                           */
]);

/* Flattened, one record per municipality. Ids are namespaced with a
   "mun_" prefix so a municipality and an offtaker can never collide in
   the contacts table, which both of them hang off. */
const SA_MUNICIPALITIES = [];
Object.entries(MUNI_TREE).forEach(([province, block]) => {
  block.metros.forEach(([code, name, seat]) => {
    SA_MUNICIPALITIES.push({
      id: 'mun_' + code, code, name, seat, province,
      cat: 'A', main: MUNI_MAIN_CODES.has(code), districtCode: null, districtName: null,
    });
  });
  block.districts.forEach(d => {
    SA_MUNICIPALITIES.push({
      id: 'mun_' + d.code, code: d.code, name: d.name, seat: d.seat, province,
      cat: 'C', main: MUNI_MAIN_CODES.has(d.code), districtCode: null, districtName: null,
    });
    d.locals.forEach(([code, name, seat]) => {
      SA_MUNICIPALITIES.push({
        id: 'mun_' + code, code, name, seat, province,
        cat: 'B', main: MUNI_MAIN_CODES.has(code), districtCode: d.code, districtName: d.name,
      });
    });
  });
});

const MUNI_BY_ID = Object.fromEntries(SA_MUNICIPALITIES.map(m => [m.id, m]));
const MUNI_PROVINCES = Object.keys(MUNI_TREE);

/* A typo that drops or doubles an entry would quietly skew every count
   on the page, so the official 8 / 44 / 205 split is checked at load and
   complained about loudly rather than absorbed. */
(function verifyMunicipalityCounts() {
  const by = c => SA_MUNICIPALITIES.filter(m => m.cat === c).length;
  const got = { A: by('A'), C: by('C'), B: by('B'), total: SA_MUNICIPALITIES.length };
  const want = { A: 8, C: 44, B: 205, total: 257 };
  const ids = new Set(SA_MUNICIPALITIES.map(m => m.id));
  if (ids.size !== SA_MUNICIPALITIES.length) {
    console.error('Municipality list has duplicate codes.');
  }
  if (got.A !== want.A || got.C !== want.C || got.B !== want.B || got.total !== want.total) {
    console.error('Municipality counts are off. Expected', want, 'got', got);
  }
  /* A code in MUNI_MAIN_CODES that matches nothing is silent otherwise:
     the tile just counts one lower than intended and nobody can tell by
     looking. Name the misses instead. */
  const codes = new Set(SA_MUNICIPALITIES.map(m => m.code));
  const missing = [...MUNI_MAIN_CODES].filter(c => !codes.has(c));
  if (missing.length) {
    console.error('MUNI_MAIN_CODES names municipalities that do not exist:', missing);
  }
})();
