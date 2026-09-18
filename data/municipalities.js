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

/* ─── POPULATION ───────────────────────────────────────
   Census 2022, from Statistics South Africa's "Census 2022: Provinces at
   a Glance" (2023, ISBN 978-0-621-51559-6), transcribed via the
   consolidated table on Wikipedia's List of municipalities in South
   Africa rather than read off the PDF by hand.

   All 257 carry a figure. Districts are included, and a district's number
   is the sum of the locals inside it — so adding up a column that mixes
   the two double-counts. Anything ranking PLACES has to pick one tier;
   muniPopulationRank() below uses metros and locals and leaves districts
   out for exactly this reason.

   What it is for: a municipality is a large electricity consumer in its
   own right, and how many people live there is the roughest possible
   proxy for that load. Rough, and worth saying how rough. Bushbuckridge
   has three quarters of a million people and almost no industrial
   demand; Steve Tshwete has a quarter of that and a ferrochrome complex.
   Population sizes the municipal load — pumping, street lighting, civic
   buildings — and says next to nothing about what else is in the
   boundary. For that, look at the offtakers.

   Keyed on the CODE THIS FILE USES, which for five municipalities is not
   the official one — see the note above MUNI_MAIN_CODES. The figures were
   matched to municipalities by name and province, not by code, so each
   number belongs to the place named beside it regardless. */
const MUNI_POPULATION = {
  /* Western Cape */
  'CPT':      4772846,  /* City of Cape Town */
  'DC1':       497394,  /* West Coast */
  'DC2':       862703,  /* Cape Winelands */
  'DC3':       359446,  /* Overberg */
  'DC4':       838457,  /* Garden Route */
  'DC5':       102173,  /* Central Karoo */
  'WC011':      69043,  /* Matzikama */
  'WC012':      55108,  /* Cederberg */
  'WC013':      70276,  /* Bergrivier */
  'WC014':     154635,  /* Saldanha Bay */
  'WC015':     148331,  /* Swartland */
  'WC022':     103765,  /* Witzenberg */
  'WC023':     276800,  /* Drakenstein */
  'WC024':     175411,  /* Stellenbosch */
  'WC025':     212682,  /* Breede Valley */
  'WC026':      94045,  /* Langeberg */
  'WC031':     139563,  /* Theewaterskloof */
  'WC032':     132495,  /* Overstrand */
  'WC033':      40274,  /* Cape Agulhas */
  'WC034':      47114,  /* Swellendam */
  'WC041':      31986,  /* Kannaland */
  'WC042':      71918,  /* Hessequa */
  'WC043':     140075,  /* Mossel Bay */
  'WC044':     294929,  /* George */
  'WC045':     138257,  /* Oudtshoorn */
  'WC047':      65240,  /* Bitou */
  'WC048':      96055,  /* Knysna */
  'WC051':      11366,  /* Laingsburg */
  'WC052':      17836,  /* Prince Albert */
  'WC053':      72972,  /* Beaufort West */
  /* Eastern Cape */
  'BUF':       975255,  /* Buffalo City */
  'DC10':      533253,  /* Sarah Baartman */
  'DC12':      871601,  /* Amathole */
  'DC13':      828387,  /* Chris Hani */
  'DC14':      393048,  /* Joe Gqabi */
  'DC15':     1501702,  /* OR Tambo */
  'DC44':      936462,  /* Alfred Nzo */
  'EC101':     101001,  /* Dr Beyers Naudé */
  'EC102':      49883,  /* Blue Crane Route */
  'EC104':      97815,  /* Makana */
  'EC105':      87797,  /* Ndlambe */
  'EC106':      53256,  /* Sundays River Valley */
  'EC107':     107014,  /* Kouga */
  'EC108':      36487,  /* Kou-Kamma */
  'EC121':     240020,  /* Mbhashe */
  'EC122':     232993,  /* Mnquma */
  'EC123':      35990,  /* Great Kei */
  'EC124':     115703,  /* Amahlathi */
  'EC126':      68300,  /* Ngqushwa */
  'EC129':     178594,  /* Raymond Mhlaba */
  'EC131':      77578,  /* Inxuba Yethemba */
  'EC135':     128101,  /* Intsika Yethu */
  'EC136':     128873,  /* Emalahleni */
  'EC137':     132799,  /* Engcobo */
  'EC138':      63981,  /* Sakhisizwe */
  'EC139':     297055,  /* Enoch Mgijima */
  'EC141':     141762,  /* Elundini */
  'EC142':     147073,  /* Senqu */
  'EC145':     104213,  /* Walter Sisulu */
  'EC153':     354573,  /* Ngquza Hill */
  'EC154':     179325,  /* Port St Johns */
  'EC155':     304856,  /* Nyandeni */
  'EC156':     186391,  /* Mhlontlo */
  'EC157':     476558,  /* King Sabata Dalindyebo */
  'EC441':     225562,  /* Matatiele */
  'EC442':     214477,  /* Umzimvubu */
  'EC443':     350000,  /* Winnie Madikizela-Mandela */
  'EC444':     146423,  /* Ntabankulu */
  'NMA':      1190496,  /* Nelson Mandela Bay */
  /* Northern Cape */
  'DC45':      272454,  /* John Taolo Gaetsewe */
  'DC6':       148935,  /* Namakwa */
  'DC7':       216589,  /* Pixley ka Seme */
  'DC8':       283624,  /* ZF Mgcawu */
  'DC9':       434343,  /* Frances Baard */
  'NC061':      24235,  /* Richtersveld */
  'NC062':      67089,  /* Nama Khoi */
  'NC064':      15130,  /* Kamiesberg */
  'NC065':      22281,  /* Hantam */
  'NC066':      11691,  /* Karoo Hoogland */
  'NC067':       8510,  /* Khâi-Ma */
  'NC071':      15836,  /* Ubuntu */
  'NC072':      29555,  /* Umsobomvu */
  'NC073':      46587,  /* Emthanjeni */
  'NC074':      10961,  /* Kareeberg */
  'NC075':      10843,  /* Renosterberg */
  'NC076':      22542,  /* Thembelihle */
  'NC077':      27102,  /* Siyathemba */
  'NC078':      53165,  /* Siyancuma */
  'NC082':      85104,  /* !Kai! Garib */
  'NC084':      21954,  /* !Kheis */
  'NC085':      30969,  /* Tsantsabane */
  'NC086':      19854,  /* Kgatelopele */
  'NC087':     125744,  /* Dawid Kruiper */
  'NC091':     270078,  /* Sol Plaatje */
  'NC092':      56967,  /* Dikgatlong */
  'NC093':      26816,  /* Magareng */
  'NC094':      80481,  /* Phokwane */
  'NC451':     125420,  /* Joe Morolong */
  'NC452':     117454,  /* Ga-Segonyana */
  'NC453':      29580,  /* Gamagara */
  /* Free State */
  'DC16':      131901,  /* Xhariep */
  'DC18':      679746,  /* Lejweleputswa */
  'DC19':      831421,  /* Thabo Mofutsanyana */
  'DC20':      509912,  /* Fezile Dabi */
  'FS161':      43101,  /* Letsemeng */
  'FS162':      51832,  /* Kopanong */
  'FS163':      36968,  /* Mohokare */
  'FS181':      63800,  /* Masilonyana */
  'FS182':      29455,  /* Tokologo */
  'FS183':      56896,  /* Tswelopele */
  'FS184':     439034,  /* Matjhabeng */
  'FS185':      90561,  /* Nala */
  'FS191':     127918,  /* Setsoto */
  'FS192':     130434,  /* Dihlabeng */
  'FS193':      66488,  /* Nketoana */
  'FS194':     398459,  /* Maluti-a-Phofung */
  'FS195':      52224,  /* Phumelela */
  'FS196':      55897,  /* Mantsopa */
  'FS201':     155410,  /* Moqhaka */
  'FS203':     134962,  /* Ngwathe */
  'FS204':     158391,  /* Metsimaholo */
  'FS205':      61150,  /* Mafube */
  'MAN':       811431,  /* Mangaung */
  /* KwaZulu-Natal */
  'DC21':      773402,  /* Ugu */
  'DC22':     1235715,  /* uMgungundlovu */
  'DC23':      789092,  /* uThukela */
  'DC24':      649261,  /* uMzinyathi */
  'DC25':      687408,  /* Amajuba */
  'DC26':      942794,  /* Zululand */
  'DC27':      738437,  /* uMkhanyakude */
  'DC28':     1021344,  /* King Cetshwayo */
  'DC29':      782661,  /* iLembe */
  'DC43':      563893,  /* Harry Gwala */
  'ETH':      4239901,  /* eThekwini */
  'KZN212':    156443,  /* uMdoni */
  'KZN213':    139045,  /* uMzumbe */
  'KZN214':    115780,  /* uMuziwabantu */
  'KZN216':    362134,  /* Ray Nkonyeni */
  'KZN221':    118478,  /* uMshwathi */
  'KZN222':    105069,  /* uMngeni */
  'KZN223':     33382,  /* Mpofana */
  'KZN224':     36648,  /* Impendle */
  'KZN225':    817725,  /* Msunduzi */
  'KZN226':     61660,  /* Mkhambathini */
  'KZN227':     62754,  /* Richmond */
  'KZN235':    143132,  /* Okhahlamba */
  'KZN237':    230924,  /* Inkosi Langalibalele */
  'KZN238':    415036,  /* Alfred Duma */
  'KZN241':    100085,  /* Endumeni */
  'KZN242':    201133,  /* Nquthu */
  'KZN244':    206001,  /* Msinga */
  'KZN245':    142042,  /* uMvoti */
  'KZN252':    507710,  /* Newcastle */
  'KZN253':     36948,  /* eMadlangeni */
  'KZN254':    142750,  /* Dannhauser */
  'KZN261':     96735,  /* eDumbe */
  'KZN262':    151541,  /* uPhongolo */
  'KZN263':    247263,  /* AbaQulusi */
  'KZN265':    225278,  /* Nongoma */
  'KZN266':    221977,  /* Ulundi */
  'KZN271':    191660,  /* uMhlabuyalingana */
  'KZN272':    199153,  /* Jozini */
  'KZN275':    215869,  /* Mtubatuba */
  'KZN276':    131755,  /* Big 5 Hlabisa */
  'KZN281':    159668,  /* uMfolozi */
  'KZN282':    412075,  /* uMhlathuze */
  'KZN284':    241416,  /* uMlalazi */
  'KZN285':     99289,  /* Mthonjaneni */
  'KZN286':    108896,  /* Nkandla */
  'KZN291':    180939,  /* Mandeni */
  'KZN292':    324912,  /* KwaDukuza */
  'KZN293':    165826,  /* Ndwedwe */
  'KZN294':    110983,  /* Maphumulo */
  'KZN433':     81676,  /* Greater Kokstad */
  'KZN434':    133032,  /* Ubuhlebezwe */
  'KZN435':    220620,  /* Umzimkhulu */
  'KZN436':    128565,  /* Dr Nkosazana Dlamini Zuma */
  /* North West */
  'DC37':     1624428,  /* Bojanala Platinum */
  'DC38':      937723,  /* Ngaka Modiri Molema */
  'DC39':      508192,  /* Dr Ruth Segomotsi Mompati */
  'DC40':      734203,  /* Dr Kenneth Kaunda */
  'NW371':     219120,  /* Moretele */
  'NW372':     522566,  /* Madibeng */
  'NW373':     562315,  /* Rustenburg */
  'NW374':      54759,  /* Kgetlengrivier */
  'NW375':     265668,  /* Moses Kotane */
  'NW381':     128766,  /* Ratlou */
  'NW382':     128672,  /* Tswaing */
  'NW383':     354504,  /* Mahikeng */
  'NW384':     164176,  /* Ditsobotla */
  'NW385':     161605,  /* Ramotshere Moiloa */
  'NW392':      63755,  /* Naledi */
  'NW393':      70483,  /* Mamusa */
  'NW394':     202009,  /* Greater Taung */
  'NW396':      59815,  /* Lekwa-Teemane */
  'NW397':     112130,  /* Kagisano-Molopo */
  'NW403':     431231,  /* City of Matlosana */
  'NW404':      90302,  /* Maquassi Hills */
  'NW405':     212670,  /* JB Marks */
  /* Gauteng */
  'DC42':     1190688,  /* Sedibeng */
  'DC48':      998466,  /* West Rand */
  'EKU':      4066691,  /* City of Ekurhuleni */
  'GT421':     945650,  /* Emfuleni */
  'GT422':     112254,  /* Midvaal */
  'GT423':     132783,  /* Lesedi */
  'GT481':     438217,  /* Mogale City */
  'GT484':     225476,  /* Merafong City */
  'GT485':     334773,  /* Rand West City */
  'JHB':      4803262,  /* City of Johannesburg */
  'TSH':      4040315,  /* City of Tshwane */
  /* Mpumalanga */
  'DC30':     1283459,  /* Gert Sibande */
  'DC31':     1588968,  /* Nkangala */
  'DC32':     2270897,  /* Ehlanzeni */
  'MP301':     247664,  /* Chief Albert Luthuli */
  'MP302':     199314,  /* Msukaligwa */
  'MP303':     255411,  /* Mkhondo */
  'MP304':     115304,  /* Dr Pixley Ka Isaka Seme */
  'MP305':     119669,  /* Lekwa */
  'MP306':      35980,  /* Dipaleseng */
  'MP307':     310117,  /* Govan Mbeki */
  'MP311':     106149,  /* Victor Khanye */
  'MP312':     434522,  /* Emalahleni */
  'MP313':     242031,  /* Steve Tshwete */
  'MP314':      50165,  /* Emakhazeni */
  'MP315':     431248,  /* Thembisile Hani */
  'MP316':     324855,  /* Dr JS Moroka */
  'MP321':     118474,  /* Thaba Chweu */
  'MP324':     591928,  /* Nkomazi */
  'MP325':     750821,  /* Bushbuckridge */
  'MP326':     809674,  /* City of Mbombela */
  /* Limpopo */
  'DC33':     1372873,  /* Mopani */
  'DC34':     1653077,  /* Vhembe */
  'DC35':     1447103,  /* Capricorn */
  'DC36':      762862,  /* Waterberg */
  'DC47':     1336805,  /* Sekhukhune */
  'LIM331':    316841,  /* Greater Giyani */
  'LIM332':    261038,  /* Greater Letaba */
  'LIM333':    478254,  /* Greater Tzaneen */
  'LIM334':    188603,  /* Ba-Phalaborwa */
  'LIM335':    128137,  /* Maruleng */
  'LIM341':    130899,  /* Musina */
  'LIM343':    575929,  /* Thulamela */
  'LIM344':    502452,  /* Makhado */
  'LIM345':    443798,  /* Collins Chabane */
  'LIM351':    192109,  /* Blouberg */
  'LIM352':    127130,  /* Molemole */
  'LIM353':    843459,  /* Polokwane */
  'LIM354':    284404,  /* Lepelle-Nkumpi */
  'LIM361':     65047,  /* Thabazimbi */
  'LIM362':    125198,  /* Lephalale */
  'LIM366':     64306,  /* Bela-Bela */
  'LIM367':    378198,  /* Mogalakwena */
  'LIM368':    130113,  /* Modimolle-Mookgophong */
  'LIM471':    132468,  /* Ephraim Mogale */
  'LIM472':    288049,  /* Elias Motsoaledi */
  'LIM473':    340328,  /* Makhuduthamaga */
  'LIM476':    575960,  /* Fetakgomo Tubatse */
};

/* ─── THE MAIN MUNICIPALITIES ─────────────────────────
   A, B and C above are fixed by the Municipal Structures Act and are not
   a judgement about anything. This list IS a judgement: the eight metros
   plus the twelve largest urban economies outside them.

   SIZE ONLY, and size is the whole of it. An earlier version also
   carried towns that were on it for the load plugged in there rather
   than for how big they are; Middelburg, Secunda, Richards Bay and
   Lephalale were cut on that basis. Load is not a property of a
   municipality anyway — the smelter at Richards Bay and the refinery at
   Secunda are offtaker records, tracked and fit-scored as offtakers. A
   municipality is on this list because of its own size as a consumer and
   as the distributor a wheeled PPA has to cross.

   Rustenburg and Witbank were cut with them and then put back, because
   cutting them was the wrong call: both are large municipalities in
   their own right and by population sit above several others here. They
   are on this list on size, the same as the rest — that they also
   happen to sit on the platinum belt and the coal belt is not the
   reason, and is not a reason to remove them either.

   It cuts across the legal categories on purpose — every metro is here,
   and so are twelve Category B locals. No district is: a district holds
   very little load of its own, and the seat it governs from is usually a
   local municipality already on this list.

   NOT A POPULATION RANKING, and now that MUNI_POPULATION exists that
   has to be said out loud rather than left to be assumed. Twenty-nine
   municipalities that are NOT on this list have more people in them than
   Sol Plaatje, which is. Bushbuckridge has 750,821 and is the thirteenth
   most populous place in the country; it is not on this list and should
   not be, because it is rural, low-income and has no industrial demand
   worth wheeling to. Thulamela, Makhado, Collins Chabane and Greater
   Tzaneen are the same story.

   The word doing the work is ECONOMY. These are the commercial and
   industrial centres outside the metros — the places with a CBD, a rate
   base, an industrial area and a municipal distribution network with
   real load on it. Population is one input to that judgement and a weak
   one, which is why this list is hand-kept and not computed.

   NOT AN OFFICIAL LIST either. Add and cut freely; the only rule is that
   a code has to exist, which is checked at load.

   CODE WARNING. Five entries in this file carry a code that is not the
   official one, because two sequences were compressed when a dissolved
   municipality was dropped instead of leaving its code retired:

     Kouga           here EC107,  officially EC108
     Kou-Kamma       here EC108,  officially EC109
     Molemole        here LIM352, officially LIM353
     Polokwane       here LIM353, officially LIM354
     Lepelle-Nkumpi  here LIM354, officially LIM355

   'LIM353' below means Polokwane because that is what LIM353 is IN THIS
   FILE. Correcting the codes without correcting this list at the same
   time would silently re-point it at Molemole, a small rural
   municipality, and the tile would go on looking right. The codes are
   also record ids — contacts hang off 'mun_' + code — so fixing them is
   a migration rather than an edit.

   Keyed on CODE, never on name, and this list is the reason the rule
   matters rather than an illustration of it: Emalahleni exists twice.
   EC136 is Lady Frere in the Eastern Cape, a small rural municipality;
   MP312 is Witbank on the coal belt, and MP312 is the one below. A name
   match would take whichever came first and be wrong about half the
   time. */
const MUNI_MAIN_CODES = new Set([
  /* The eight metros, all of them. */
  'CPT', 'JHB', 'ETH', 'TSH', 'EKU', 'NMA', 'BUF', 'MAN',

  /* The twelve largest urban economies outside a metro, roughly in that
     order. Roughly, because the order is a reading rather than a sum —
     see the note above about there being no figure here to rank on. */
  'GT421',   /* Emfuleni — Vanderbijlpark and Vereeniging                */
  'LIM353',  /* Polokwane                                                */
  'KZN225',  /* Msunduzi — Pietermaritzburg                              */
  'MP326',   /* City of Mbombela — Nelspruit                             */
  'NW373',   /* Rustenburg                                               */
  'FS184',   /* Matjhabeng — Welkom                                      */
  'NW403',   /* City of Matlosana — Klerksdorp                           */
  'MP312',   /* Emalahleni — Witbank. NOT EC136, which is Lady Frere     */
  'KZN252',  /* Newcastle                                                */
  'WC023',   /* Drakenstein — Paarl                                      */
  'NC091',   /* Sol Plaatje — Kimberley                                  */
  'WC044',   /* George — the Garden Route centre                         */
]);

/* Flattened, one record per municipality. Ids are namespaced with a
   "mun_" prefix so a municipality and an offtaker can never collide in
   the contacts table, which both of them hang off. */
const SA_MUNICIPALITIES = [];
Object.entries(MUNI_TREE).forEach(([province, block]) => {
  block.metros.forEach(([code, name, seat]) => {
    SA_MUNICIPALITIES.push({
      id: 'mun_' + code, code, name, seat, province,
      cat: 'A', main: MUNI_MAIN_CODES.has(code),
      population: MUNI_POPULATION[code] ?? null,
      districtCode: null, districtName: null,
    });
  });
  block.districts.forEach(d => {
    SA_MUNICIPALITIES.push({
      id: 'mun_' + d.code, code: d.code, name: d.name, seat: d.seat, province,
      cat: 'C', main: MUNI_MAIN_CODES.has(d.code),
      population: MUNI_POPULATION[d.code] ?? null,
      districtCode: null, districtName: null,
    });
    d.locals.forEach(([code, name, seat]) => {
      SA_MUNICIPALITIES.push({
        id: 'mun_' + code, code, name, seat, province,
        cat: 'B', main: MUNI_MAIN_CODES.has(code),
        population: MUNI_POPULATION[code] ?? null,
        districtCode: d.code, districtName: d.name,
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
  /* Every municipality carries a figure today. A new one arriving without
     is not an error, but it silently drops out of every ranking and every
     sort, so it gets named. */
  const noPop = SA_MUNICIPALITIES.filter(m => m.population === null);
  if (noPop.length) {
    console.warn('No population on file for:', noPop.map(m => m.code + ' ' + m.name));
  }
})();

/* Rank by population, as a position out of the places ranked.

   Metros and locals only. A district's population is the sum of the
   locals inside it, so ranking all three tiers together puts a district
   above every local it contains and compares a place with a container of
   places. Districts get null rather than a rank they would win by
   double-counting. */
const MUNI_RANKED = SA_MUNICIPALITIES
  .filter(m => m.cat !== 'C' && m.population !== null)
  .sort((a, b) => b.population - a.population);
MUNI_RANKED.forEach((m, i) => { m.populationRank = i + 1; });
const MUNI_RANKED_TOTAL = MUNI_RANKED.length;
