/* ═══════════════════════════════════════════════════════════════════
   Supabase — authentication and the data layer.

   Access model, enforced by Row Level Security in the database rather
   than by anything in this file:

     pending  new account, sees nothing at all (the default)
     viewer   can read every record
     admin    can read and write

   The URL and publishable key below are meant to be public. They
   identify the project; they grant nothing on their own. An
   unauthenticated request reads an empty list and cannot write.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const SUPA_URL = 'https://pkzfazjtpswqjmnzzrgt.supabase.co';
const SUPA_KEY = 'sb_publishable_jqCjOPRXZEIKjgNDVsL3uw_ldx-I-tO';

/* Supabase Auth always identifies an account by email address — there is no
   username provider. So the team signs in with a plain username and this is
   the domain it is completed to: "dino" becomes "dino@aeeg.co.za", which is
   what the account is actually stored under. Anything typed WITH an @ is
   passed through untouched, so a real address still works.

   Accounts created on a domain that cannot receive mail have no working
   "forgot password" route — resetting one means an admin setting a new
   password in the Supabase dashboard. For that reason the owner account is
   deliberately on a real, reachable address and signs in with it in full. */
const AUTH_DOMAIN = 'aeeg.co.za';

function toAuthEmail(input) {
  const v = String(input || '').trim();
  if (!v) return '';
  return v.includes('@') ? v.toLowerCase() : v.toLowerCase().replace(/\s+/g, '.') + '@' + AUTH_DOMAIN;
}

/* The inverse, for display: hide the synthetic domain but keep a genuinely
   external address visible in full. */
function toDisplayName(email) {
  const v = String(email || '');
  return v.toLowerCase().endsWith('@' + AUTH_DOMAIN) ? v.slice(0, v.lastIndexOf('@')) : v;
}

let supabaseClient = null;

async function initSupabase() {
  if (supabaseClient) return supabaseClient;
  const mod = await import('https://esm.sh/@supabase/supabase-js@2');
  supabaseClient = mod.createClient(SUPA_URL, SUPA_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'aee-crm-auth' },
  });
  return supabaseClient;
}

/* PostgREST call carrying the signed-in user's access token, so the
   database evaluates the request as that user rather than as `anon`. */
async function supaFetch(path, opts = {}) {
  let authKey = SUPA_KEY;
  if (supabaseClient) {
    const { data } = await supabaseClient.auth.getSession();
    if (data && data.session && data.session.access_token) authKey = data.session.access_token;
  }
  const res = await fetch(SUPA_URL + '/rest/v1/' + path, {
    ...opts,
    headers: {
      apikey: SUPA_KEY,
      Authorization: 'Bearer ' + authKey,
      'Content-Type': 'application/json',
      ...(opts.method && opts.method !== 'GET' ? { Prefer: 'resolution=merge-duplicates,return=minimal' } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error((await res.text()) || res.status);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/* ─── ROW MAPPING ─────────────────────────────────────────────────
   The database uses snake_case, the app uses camelCase. These four
   pairs are the only place the two spellings meet. */
function rowToOfftaker(r) {
  return {
    id: r.id, name: r.name, short: r.short || '', sector: r.sector || 'industrial',
    province: r.province || '', city: r.city || '', website: r.website || '',
    lat: r.lat, lng: r.lng,
    annualGwh: Number(r.annual_gwh) || 0, peakMw: Number(r.peak_mw) || 0,
    tariff: Number(r.tariff) || 0, nmd: Number(r.nmd) || 0,
    supply: r.supply || 'eskom', wheeling: r.wheeling || 'unknown',
    status: r.status || 'prospect', priority: r.priority || 'medium',
    sfStage: r.sf_stage || '',
    description: r.description || '', estimated: r.estimated !== false,
  };
}
function offtakerToRow(o) {
  return {
    id: o.id, name: o.name, short: o.short, sector: o.sector, province: o.province,
    city: o.city, website: o.website, lat: o.lat ?? null, lng: o.lng ?? null,
    annual_gwh: num(o.annualGwh), peak_mw: num(o.peakMw), tariff: num(o.tariff), nmd: num(o.nmd),
    supply: o.supply, wheeling: o.wheeling, status: o.status, priority: o.priority,
    sf_stage: o.sfStage || null,
    description: o.description, estimated: o.estimated !== false,
  };
}
function rowToContact(r) {
  return {
    id: r.id, offtakerId: r.offtaker_id || '', first: r.first || '', last: r.last || '',
    title: r.title || '', dept: r.dept || '', email: r.email || '', phone: r.phone || '',
    linkedin: r.linkedin || '', role: r.role || 'influencer', priority: r.priority || 'medium',
    status: r.status || 'active', notes: r.notes || '',
  };
}
function contactToRow(c) {
  return {
    id: c.id, offtaker_id: c.offtakerId || null, first: c.first, last: c.last, title: c.title,
    dept: c.dept, email: c.email, phone: c.phone, linkedin: c.linkedin,
    role: c.role, priority: c.priority, status: c.status, notes: c.notes,
  };
}
function rowToDeal(r) {
  return {
    id: r.id, offtakerId: r.offtaker_id || '', prospectId: r.prospect_id || '',
    projectId: r.project_id || '', name: r.name || '',
    mw: Number(r.mw) || 0, tariff: Number(r.tariff) || 0, tenor: Number(r.tenor) || 20,
    stage: r.stage || 'identified', probability: Number(r.probability) || 0,
    closeDate: r.close_date || '', notes: r.notes || '', createdAt: r.created_at || '',
  };
}
function dealToRow(d) {
  return {
    id: d.id, offtaker_id: d.offtakerId || null, prospect_id: d.prospectId || null,
    project_id: d.projectId || null, name: d.name,
    mw: num(d.mw), tariff: num(d.tariff), tenor: Math.round(num(d.tenor, 20)),
    stage: d.stage, probability: Math.round(num(d.probability)),
    close_date: d.closeDate || null, notes: d.notes, created_at: d.createdAt || null,
  };
}
function rowToProspect(r) {
  return {
    id: r.id, name: r.name || '', sectorId: r.sector_id || '', note: r.note || '',
    status: r.status || 'new', promotedTo: r.promoted_to || '', notes: r.notes || '',
    sfStage: r.sf_stage || '',
    blurb: r.blurb || '',
    town: r.town || '', province: r.province || '',
    lat: r.lat, lng: r.lng, nearSite: r.near_site || '',
    website: r.website || '', phone: r.phone || '', email: r.email || '',
    address: r.address || '', contactSource: r.contact_source || '',
    gwhLow: r.annual_gwh_low, gwhHigh: r.annual_gwh_high, peakMwEst: r.peak_mw_est,
    loadBasis: r.load_basis || 'unknown', loadMethod: r.load_method || '',
  };
}
function prospectToRow(p) {
  return {
    id: p.id, name: p.name, sector_id: p.sectorId || null, note: p.note,
    status: p.status, promoted_to: p.promotedTo || null, notes: p.notes,
    sf_stage: p.sfStage || null,
    blurb: p.blurb || null,
    town: p.town || null, province: p.province || null,
    lat: p.lat ?? null, lng: p.lng ?? null, near_site: p.nearSite || null,
    website: p.website || null, phone: p.phone || null, email: p.email || null,
    address: p.address || null, contact_source: p.contactSource || null,
    annual_gwh_low: p.gwhLow ?? null, annual_gwh_high: p.gwhHigh ?? null,
    peak_mw_est: p.peakMwEst ?? null,
    load_basis: p.loadBasis || 'unknown', load_method: p.loadMethod || null,
  };
}
function rowToInteraction(r) {
  return {
    id: r.id, offtakerId: r.offtaker_id || '', prospectId: r.prospect_id || '',
    date: r.date || '', type: r.type || 'note', summary: r.summary || '',
  };
}
function interactionToRow(i) {
  return {
    id: i.id, offtaker_id: i.offtakerId || null, prospect_id: i.prospectId || null,
    date: i.date, type: i.type, summary: i.summary,
  };
}

/* ─── WRITES ──────────────────────────────────────────────────────
   Every write is fire-and-report: the local state has already been
   updated by the caller, so a failure surfaces as a toast rather than
   rolling the UI back. Viewers never reach these — the buttons that
   call them are hidden, and RLS refuses them regardless. */
function upsert(table, row) {
  return supaFetch(table + '?on_conflict=id', { method: 'POST', body: JSON.stringify(row) });
}
async function pushOfftaker(o) { await guardWrite(() => upsert('aee_offtakers', offtakerToRow(o))); }
async function pushContact(c) { await guardWrite(() => upsert('aee_contacts', contactToRow(c))); }
async function pushDeal(d) { await guardWrite(() => upsert('aee_deals', dealToRow(d))); }
async function pushInteraction(i) { await guardWrite(() => upsert('aee_interactions', interactionToRow(i))); }
async function pushProspect(p) { await guardWrite(() => upsert('aee_prospects', prospectToRow(p))); }
async function removeRow(table, id) {
  await guardWrite(() => supaFetch(table + '?id=eq.' + encodeURIComponent(id), { method: 'DELETE' }));
}

async function guardWrite(fn) {
  try { await fn(); }
  catch (e) {
    console.warn('Write failed:', e);
    toast('Could not save that change to the server — it is only in this browser', 'warn');
  }
}

/* ─── AUTH ────────────────────────────────────────────────────── */
async function signIn(usernameOrEmail, password) {
  await initSupabase();
  return supabaseClient.auth.signInWithPassword({ email: toAuthEmail(usernameOrEmail), password });
}
async function signOut() {
  if (supabaseClient) await supabaseClient.auth.signOut();
  try { localStorage.removeItem(STORE_PREFIX + 'cache'); } catch (e) {}
  location.href = 'landing.html';
}
async function currentRole(userId) {
  try {
    const rows = await supaFetch('profiles?select=role&id=eq.' + userId);
    return (rows && rows[0] && rows[0].role) || 'pending';
  } catch (e) {
    console.warn('Could not read profile role:', e);
    return 'pending';
  }
}
