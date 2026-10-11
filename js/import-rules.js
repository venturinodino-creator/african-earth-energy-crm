/* ═══════════════════════════════════════════════════════════════════
   CSV import rules. Pure functions, no DOM.

   The Import wizard (views-import.js) reads a file, asks which CRM field each column is,
   shows what would happen and only then writes. Everything that decides "what would
   happen" is here, so it can be tested without a page and so the wizard cannot drift from
   the rules.

   One importer, two shapes. A contacts file has people on its rows; an off-takers file has
   companies. The wizard asks which it is, because the answer was never worth guessing, and
   the wrong-file check below catches the one mix-up that does damage: a contacts file fed to
   the off-taker importer would create companies named after people.

   A mapping is an array with one entry per column of the file: the key of the CRM field
   the column feeds, or '' for a column that is skipped. A field is fed by one column and a
   column feeds one field. Header recognition fills the mapping in; the person can change
   any entry, and a change always wins over the recognition.

   Rows are judged against the book as it stands: { offtakers, contacts }. Each judged row is
   { line, status: 'import' | 'skip', reason, detail, draft }, where `line` is its line in
   the file (the header is line 1) and `draft` is what would be stored, minus its id.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* The fields each kind of file can carry, and the header names that mean each one. The
   names are tried in the order listed, so "email" beats "email address" wherever the
   columns sit. No name belongs to two fields of one kind. */
const IMPORT_KINDS = {
  contacts: {
    label: 'Contacts', noun: 'contact', nouns: 'contacts', view: 'contacts',
    fields: [
      { key: 'first', label: 'First name', aliases: ['first', 'first name', 'firstname', 'given name'] },
      { key: 'last', label: 'Last name', aliases: ['last', 'last name', 'lastname', 'surname', 'family name'] },
      { key: 'title', label: 'Job title', aliases: ['title', 'job title', 'position', 'role'] },
      { key: 'dept', label: 'Department', aliases: ['department', 'dept', 'division'] },
      { key: 'company', label: 'Company', aliases: ['company', 'organisation', 'organization', 'offtaker', 'account'] },
      { key: 'email', label: 'Work email', aliases: ['email', 'email address', 'e-mail'] },
      { key: 'phone', label: 'Phone', aliases: ['phone', 'mobile', 'telephone', 'cell'] },
      { key: 'linkedin', label: 'LinkedIn', aliases: ['linkedin', 'linkedin url', 'profile'] },
      { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'comment'] },
      { key: 'province', label: 'Province', aliases: ['province', 'region'] },
    ],
  },
  offtakers: {
    label: 'Off-takers', noun: 'off-taker', nouns: 'off-takers', view: 'offtakers',
    fields: [
      { key: 'name', label: 'Company name', aliases: ['name', 'company', 'offtaker', 'organisation', 'organization', 'account'] },
      { key: 'short', label: 'Short name', aliases: ['short', 'short name', 'shortname'] },
      { key: 'sector', label: 'Sector', aliases: ['sector', 'industry'] },
      { key: 'province', label: 'Province', aliases: ['province', 'region'] },
      { key: 'city', label: 'City or town', aliases: ['city', 'town', 'location'] },
      { key: 'website', label: 'Website', aliases: ['website', 'url', 'web'] },
      { key: 'gwh', label: 'Annual GWh', aliases: ['gwh', 'annual gwh', 'annualgwh', 'gwh/yr', 'annual use'] },
      { key: 'peak', label: 'Peak MW', aliases: ['peak mw', 'peakmw', 'peak', 'peak demand'] },
      { key: 'tariff', label: 'Tariff (R/kWh)', aliases: ['tariff', 'r/kwh', 'current tariff'] },
      { key: 'nmd', label: 'Notified max demand', aliases: ['nmd', 'notified max demand', 'mva'] },
      { key: 'supply', label: 'Supply authority', aliases: ['supply', 'supply authority'] },
      { key: 'wheeling', label: 'Wheeling', aliases: ['wheeling'] },
      { key: 'status', label: 'Status', aliases: ['status'] },
      { key: 'priority', label: 'Priority', aliases: ['priority'] },
      { key: 'description', label: 'Description', aliases: ['description', 'notes', 'note'] },
    ],
  },
};

/* Why a row is held back, in the order the Review step lists them. */
const IMPORT_REASONS = {
  contacts: [
    { code: 'no-email', label: 'No work email' },
    { code: 'ambiguous', label: 'Municipality unclear' },
    { code: 'duplicate', label: 'Already on file' },
  ],
  offtakers: [
    { code: 'duplicate', label: 'Already on file' },
  ],
};

function importKind(kind) { return IMPORT_KINDS[kind] ? kind : 'contacts'; }
function importFieldLabel(kind, key) {
  const f = IMPORT_KINDS[importKind(kind)].fields.find(x => x.key === key);
  return f ? f.label : '';
}

/* ─── HEADERS AND MAPPING ─────────────────────────────────────── */
function importHeader(h) { return String(h == null ? '' : h).trim().toLowerCase(); }

/* The mapping header recognition gives: each field takes the first column whose header is
   one of its names. */
function importAutoMap(kind, headers) {
  const heads = headers.map(importHeader);
  const mapping = headers.map(() => '');
  IMPORT_KINDS[importKind(kind)].fields.forEach(f => {
    for (const alias of f.aliases) {
      const i = heads.indexOf(alias);
      if (i < 0) continue;
      if (!mapping[i]) mapping[i] = f.key;
      break;
    }
  });
  return mapping;
}

/* The mapping after the person points `col` at `key`, or at nothing. The field leaves any
   column that had it, since a field is fed by one column. An unknown key skips the column. */
function importRemap(kind, mapping, col, key) {
  const known = IMPORT_KINDS[importKind(kind)].fields.some(f => f.key === key);
  const next = mapping.map(k => (known && k === key ? '' : k));
  if (col >= 0 && col < next.length) next[col] = known ? key : '';
  return next;
}

/* The first three values a column holds, so the person can tell what it is. */
function importSamples(table, col, n) {
  const out = [];
  for (let r = 1; r < table.length && out.length < (n || 3); r++) {
    const v = String((table[r] || [])[col] == null ? '' : table[r][col]).trim();
    if (v) out.push(v);
  }
  return out;
}

/* A file that has a first or last name column and no column headed "name" is a list of
   people. Fed to the off-taker importer it would make companies named after them. */
function importLooksLikeContacts(headers) {
  const heads = headers.map(importHeader);
  const person = IMPORT_KINDS.contacts.fields.filter(f => f.key === 'first' || f.key === 'last')
    .some(f => f.aliases.some(a => heads.includes(a)));
  return person && !heads.includes('name');
}

/* What stops the file going on to Review, or null. `code` tells the page which way out to
   offer; `text` is plain words, for the page to escape. */
function importProblem(kind, headers, mapping) {
  kind = importKind(kind);
  if (kind === 'offtakers') {
    /* The guard stands unless the person has pointed Company name at a column of their own
       choosing, which is them saying this really is a list of companies. */
    const chosen = mapping.indexOf('name') !== importAutoMap('offtakers', headers).indexOf('name');
    if (importLooksLikeContacts(headers) && !chosen) {
      return { code: 'contacts-file', text: 'This looks like a contacts file: it has first or last name columns and no column headed "name". ' +
        'Importing it here would add companies named after people. Import it as contacts, or, if it really is a list of companies, ' +
        'match the column that holds the company to Company name.' };
    }
    if (mapping.indexOf('name') < 0) {
      return { code: 'no-name', text: 'No column is matched to Company name. Choose the column that holds the company, or the importer has nothing to add.' };
    }
    return null;
  }
  if (mapping.indexOf('first') < 0 && mapping.indexOf('last') < 0) {
    return { code: 'no-person', text: 'No column is matched to First name or Last name. Choose the columns that name the person. ' +
      'If this is a list of companies, import it as off-takers instead.' };
  }
  return null;
}

/* Something worth saying that does not stop the file going on, or null. A contacts file with no
   column matched to Work email holds back every row, and "Work Email" and "Email 1" are headers
   people really use, so say so on the Map step instead of letting Review explain it row by row. */
function importWarning(kind, headers, mapping) {
  if (importKind(kind) === 'contacts' && mapping.indexOf('email') < 0) {
    return { code: 'no-email-column', text: 'No column is matched to Work email, so every row would be held back. Choose the column that holds the address.' };
  }
  return null;
}

/* ─── ROWS ────────────────────────────────────────────────────── */
function importReader(table, mapping) {
  const col = key => mapping.indexOf(key);
  return (row, key) => { const i = col(key); return i >= 0 ? String(row[i] == null ? '' : row[i]).trim() : ''; };
}
const importLower = v => String(v == null ? '' : v).toLowerCase();

/* The line of the file a row starts on, when the reader knew it, else its place among the rows. */
function importLineOf(table, n) { return (table.lines && table.lines[n + 1]) || n + 2; }

/* Contacts. The email gate: a bulk file is where phone-only people slip into the book
   unnoticed (63 came in through one in a day and were deleted again by hand), so a row
   without a work email is held back. The company column is one column for both kinds of
   account: an off-taker match wins, so a mine in a town is never mistaken for the council
   of that town; a municipality is found by name, id (mun_MP312) or code (MP312). A name that
   fits more than one municipality is held back with its candidates, because filing a Witbank
   official under Lady Frere would not be noticed until a letter went to the wrong council. */
function importContactRows(table, mapping, book) {
  const get = importReader(table, mapping);
  const rows = [];
  let ignored = 0;
  const emailMapped = mapping.indexOf('email') >= 0;

  /* A big file against a big book must not be a scan of the book per row. The book is indexed once
     (emails, and name-at-company keys), rows taken from the file are indexed as they go, and a
     company text is looked up once however many rows carry it. A key uses an account id only when
     the contact has a text one, because the old comparison was strict and a missing id never
     equalled a row's. */
  const nameKey = (first, last, id) => importLower(first) + '\u0001' + importLower(last) + '\u0001' + id;
  const bookEmails = new Set(), bookNames = new Set(), fileEmails = new Set(), fileNames = new Set();
  book.contacts.forEach(c => {
    if (c.email) bookEmails.add(importLower(c.email));
    if (typeof c.offtakerId === 'string') bookNames.add(nameKey(c.first, c.last, c.offtakerId));
  });
  const offtakers = book.offtakers.map(o => ({ o, name: importLower(o.name), short: importLower(o.short) }));
  const matches = new Map(), municipalities = new Map();
  const offtakerFor = text => {
    if (!matches.has(text)) {
      const want = text.toLowerCase();
      const hit = offtakers.find(x => x.name.includes(want) || x.short === want);
      matches.set(text, hit ? hit.o : null);
    }
    return matches.get(text);
  };
  const municipalitiesFor = (text, province) => {
    const k = text + '\u0001' + province;
    if (!municipalities.has(k)) municipalities.set(k, municipalitiesFromText(text, province));
    return municipalities.get(k);
  };

  table.slice(1).forEach((r, n) => {
    const first = get(r, 'first'), last = get(r, 'last');
    if (!first && !last) { ignored++; return; }
    const companyName = get(r, 'company');
    const match = companyName ? offtakerFor(companyName) : null;
    const munis = match ? [] : municipalitiesFor(companyName, get(r, 'province'));
    const draft = {
      first, last, title: get(r, 'title'), dept: get(r, 'dept'),
      email: get(r, 'email'), phone: get(r, 'phone'), linkedin: get(r, 'linkedin'), notes: get(r, 'notes'),
      companyName,
      offtakerId: match ? match.id : munis.length === 1 ? munis[0].id : '',
      ambiguous: munis.length > 1 ? munis.map(m => ({ id: m.id, name: m.name, code: m.code, province: m.province })) : null,
    };
    const row = { line: importLineOf(table, n), at: n + 1, status: 'import', reason: '', detail: '', draft };
    const skip = (reason, detail) => { row.status = 'skip'; row.reason = reason; row.detail = detail; };
    if (!findHasEmail(draft)) {
      skip('no-email', emailMapped ? 'No work email. Add the address to the file and import again.'
        : 'No column is matched to Work email. Go back to Map columns and choose it.');
    } else if (draft.ambiguous) {
      skip('ambiguous', draft.ambiguous.length + ' municipalities fit (' +
        draft.ambiguous.map(m => m.name + ', ' + m.province + ', ' + m.code).join('; ') +
        '). Add a province column, or write the code.');
    } else {
      const email = importLower(draft.email), name = nameKey(first, last, draft.offtakerId);
      if (bookEmails.has(email) || bookNames.has(name)) skip('duplicate', 'Already in the CRM: same email, or same name at the same company.');
      else if (fileEmails.has(email) || fileNames.has(name)) skip('duplicate', 'Repeats an earlier row in this file.');
      else { fileEmails.add(email); fileNames.add(name); }
    }
    rows.push(row);
  });
  return { rows, ignored };
}

/* Off-takers. A target list is usually names and places; the GWh comes later, from the
   customer. A record with no load is honest about it and sorts to the bottom until someone
   fills it in. What it must not do is wear the "estimated load" badge, which promises a desk
   estimate that nobody made. Two kinds of duplicate, both held back: a company already in
   the CRM (by name or short name) and one repeated inside the file (by name). */
function importOfftakerRows(table, mapping, book) {
  const get = importReader(table, mapping);
  const rows = [], seen = new Set();
  const bookNames = new Set(book.offtakers.map(x => importLower(x.name)));
  const bookShorts = new Set(book.offtakers.map(x => importLower(x.short)));
  let ignored = 0;
  table.slice(1).forEach((r, n) => {
    const name = get(r, 'name');
    if (!name) { ignored++; return; }
    const gwh = num(get(r, 'gwh'));
    const draft = {
      name, short: get(r, 'short') || name,
      sector: sectorIdFromText(get(r, 'sector')), sectorRaw: get(r, 'sector'),
      province: provinceFromText(get(r, 'province')), provinceRaw: get(r, 'province'),
      city: get(r, 'city'), website: get(r, 'website'),
      annualGwh: gwh, peakMw: num(get(r, 'peak')), tariff: num(get(r, 'tariff')), nmd: num(get(r, 'nmd')),
      supply: enumFromText(get(r, 'supply'), ['eskom', 'municipal', 'mixed'], 'eskom'),
      wheeling: enumFromText(get(r, 'wheeling'), ['yes', 'likely', 'unknown', 'no'], 'unknown'),
      status: enumFromText(get(r, 'status'), Object.keys(STATUS_LABEL), 'prospect'),
      priority: enumFromText(get(r, 'priority'), ['high', 'medium', 'low'], 'medium'),
      description: get(r, 'description'),
      estimated: gwh > 0,
    };
    const key = name.toLowerCase();
    const onFile = bookNames.has(key) || bookShorts.has(draft.short.toLowerCase());
    const repeat = seen.has(key);
    seen.add(key);
    const row = { line: importLineOf(table, n), at: n + 1, status: onFile || repeat ? 'skip' : 'import', reason: '', detail: '', draft };
    if (onFile) { row.reason = 'duplicate'; row.detail = 'Already in the CRM: same name or short name.'; }
    else if (repeat) { row.reason = 'duplicate'; row.detail = 'Repeats an earlier row in this file.'; }
    rows.push(row);
  });
  return { rows, ignored };
}

/* What Review shows and Import does: every judged row, how many were not rows at all, and
   the counts the page speaks in. */
function importPlan(kind, table, mapping, book) {
  kind = importKind(kind);
  const built = kind === 'offtakers' ? importOfftakerRows(table, mapping, book) : importContactRows(table, mapping, book);
  const going = built.rows.filter(r => r.status === 'import');
  const held = {};
  IMPORT_REASONS[kind].forEach(x => { held[x.code] = built.rows.filter(r => r.reason === x.code).length; });
  /* `read` is every data row in the file; `total` leaves out the rows with no name at all. */
  const counts = { total: built.rows.length, read: built.rows.length + built.ignored, importing: going.length, held, ignored: built.ignored };
  if (kind === 'contacts') {
    counts.toOfftaker = going.filter(r => r.draft.offtakerId && !isMunicipalityId(r.draft.offtakerId)).length;
    counts.toMunicipality = going.filter(r => isMunicipalityId(r.draft.offtakerId)).length;
    counts.unassigned = going.length - counts.toOfftaker - counts.toMunicipality;
  } else {
    counts.noLoad = going.filter(r => !r.draft.annualGwh).length;
    const noSector = going.filter(r => !r.draft.sector);
    counts.noSector = noSector.length;
    counts.noSectorExample = noSector.length ? noSector[0].draft.sectorRaw : '';
    /* A province that is not one of the nine leaves the record without coordinates, so it
       never shows on the map or under Regions. */
    const badProvince = going.filter(r => r.draft.provinceRaw && !PROVINCE_COORDS[r.draft.province]);
    counts.badProvince = badProvince.length;
    counts.badProvinceExample = badProvince.length ? badProvince[0].draft.provinceRaw : '';
  }
  return { kind, rows: built.rows, counts };
}

/* The rows held back, as a file to fix and import again: each as the file had it, with the
   reason and the line it was on added at the end. */
function importHeldCsv(table, plan) {
  const labels = {};
  IMPORT_REASONS[plan.kind].forEach(x => { labels[x.code] = x.label; });
  return [table[0].concat(['Held because', 'Details', 'Line'])].concat(plan.rows
    .filter(r => r.status === 'skip')
    .map(r => table[r.at].concat([labels[r.reason] || r.reason, r.detail, r.line])));
}

/* The records a judged row becomes, less the id the caller gives them. A company with no
   sector we could match is filed under Mining, and Review says so before it happens. */
function importContactRecord(d) {
  return {
    offtakerId: d.offtakerId, first: d.first, last: d.last, title: d.title, dept: d.dept,
    email: d.email, phone: d.phone, linkedin: d.linkedin,
    role: 'influencer', priority: 'medium', status: 'active', notes: d.notes,
  };
}
function importOfftakerRecord(d) {
  return {
    name: d.name, short: d.short, sector: d.sector || 'mining', province: d.province, city: d.city, website: d.website,
    annualGwh: d.annualGwh, peakMw: d.peakMw, tariff: d.tariff, nmd: d.nmd,
    supply: d.supply, wheeling: d.wheeling, status: d.status, priority: d.priority,
    description: d.description, estimated: d.estimated,
  };
}
