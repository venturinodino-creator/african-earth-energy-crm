-- ═══════════════════════════════════════════════════════════════════
-- African Earth Energy Offtaker CRM — database schema
--
-- Reference copy of what is live in the Supabase project
-- "Energy Lead Dashboard" (pkzfazjtpswqjmnzzrgt, eu-west-1), captured
-- 2026-09-15. The project holds the authoritative migration history;
-- this file exists so the structure and — more importantly — the
-- access rules are recoverable from the repository alone.
--
-- Running this against an empty project reproduces the schema and the
-- security model. It does NOT reproduce the data: offtakers, contacts,
-- prospects and the pipeline are customer records and are not committed
-- to a public repository. Use the app's CSV export for a data backup.
--
-- Access model, enforced here rather than in the JavaScript:
--   pending  new account, sees nothing at all (the default)
--   viewer   reads every record
--   admin    reads and writes
-- ═══════════════════════════════════════════════════════════════════

-- ─── TABLES ────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null default 'pending' check (role in ('admin','viewer','pending')),
  created_at timestamptz not null default now()
);

create table if not exists public.aee_offtakers (
  id          text primary key,
  name        text not null,
  short       text,
  sector      text,          -- sector id from data/sectors.js
  province    text,
  city        text,
  website     text,
  lat         double precision,
  lng         double precision,
  annual_gwh  numeric,
  peak_mw     numeric,
  tariff      numeric,       -- current blended tariff, R/kWh
  nmd         numeric,       -- notified maximum demand, MVA
  supply      text,          -- eskom | municipal | mixed
  wheeling    text,          -- yes | likely | unknown | no
  status      text,          -- prospect | engaged | qualified | negotiating | contracted | lost
  -- Where the account sits in the Salesforce sales process. Coarser than
  -- status and kept in step with it; see SF_STAGES in data/seed.js.
  sf_stage    text check (sf_stage in
                ('prospecting','needs-analysis','proposal','negotiation','closed')),
  priority    text,
  description text,
  estimated   boolean not null default true,
  updated_at  timestamptz not null default now()
);

create table if not exists public.aee_contacts (
  id          text primary key,
  offtaker_id text,
  first       text,
  last        text,
  title       text,
  dept        text,
  email       text,
  phone       text,
  linkedin    text,
  role        text,          -- decision | influencer | technical | gatekeeper
  priority    text,
  status      text,
  notes       text,
  updated_at  timestamptz not null default now()
);

-- An opportunity hangs off an offtaker, or — before anyone has established
-- the load — off a prospect. Exactly one of the two is set; promoting a
-- prospect moves its opportunities across to the new offtaker.
create table if not exists public.aee_deals (
  id          text primary key,
  offtaker_id text,
  prospect_id text,
  project_id  text,          -- AEE_PROJECTS id from data/seed.js
  name        text,
  mw          numeric,
  tariff      numeric,
  tenor       integer,
  stage       text,
  probability integer,
  close_date  text,
  notes       text,
  created_at  text,
  updated_at  timestamptz not null default now()
);

-- Logged against whichever account it happened on: an offtaker, or a
-- prospect still being worked.
create table if not exists public.aee_interactions (
  id          text primary key,
  offtaker_id text,
  prospect_id text,
  date        text,
  type        text,
  summary     text,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

-- The long prospecting list. Deliberately separate from aee_offtakers:
-- a prospect has a name, a place and a sector but no load data, so it
-- is not fit-scored. Promoting one moves it across, and that is when it
-- starts being ranked.
create table if not exists public.aee_prospects (
  id             text primary key,
  name           text not null,
  sector_id      text,
  note           text,
  status         text not null default 'new'
                   check (status in ('new','researching','promoted','parked','rejected')),
  -- The same sales-process path the offtakers run on, so a lead that is
  -- already being worked reads the same way before it is promoted.
  sf_stage       text check (sf_stage in
                   ('prospecting','needs-analysis','proposal','negotiation','closed')),
  promoted_to    text,       -- aee_offtakers.id once promoted
  notes          text,
  -- Location of the SITE being targeted, not the group head office.
  town           text,
  province       text,
  lat            double precision,
  lng            double precision,
  near_site      text,       -- AEE_PROJECTS id this was identified against
  -- Published company contacts. Named individuals live in aee_contacts
  -- and are only added once a real person has been identified.
  website        text,
  phone          text,
  email          text,
  address        text,
  contact_source text,       -- where the detail came from, so it can be re-verified
  -- Load is stored as a BAND with its basis, never as a bare number. A
  -- single figure reads as fact and ends up in a quote; a band plus a
  -- stated basis stays honest about what is actually known.
  annual_gwh_low  numeric,
  annual_gwh_high numeric,
  peak_mw_est     numeric,
  load_basis      text check (load_basis in ('disclosed','derived','sector-range','unknown')),
  load_method     text,      -- the citation, or the working behind a derivation
  updated_at     timestamptz not null default now()
);

-- Pre-existing table from earlier work in this project. Left in place,
-- but brought behind the same role gate — it previously carried an
-- "Allow public read access" policy that exposed stakeholder names and
-- email addresses to anyone holding the publishable key.
create table if not exists public.mining_leads (
  id                   bigint generated by default as identity primary key,
  created_at           timestamptz not null default timezone('utc', now()),
  company_name         text not null,
  sector               text,
  location             text,
  mw_demand            integer check (mw_demand >= 30 and mw_demand <= 100),
  monthly_energy_spend text,
  stakeholder_name     text,
  stakeholder_surname  text,
  stakeholder_title    text,
  stakeholder_email    text unique
);

-- ─── CONTACT FINDER ────────────────────────────────────────────────
-- A discovery run is a request: which offtakers the desk pointed the
-- agent at, and which roles it wanted found. The agent claims a queued
-- run, appends to aee_found_contacts, then marks the run done.
create table if not exists public.aee_contact_runs (
  id           text primary key,
  created      date,
  status       text,            -- queued | running | done | failed
  industry     text,            -- sector group key, or 'all'
  roles        text[],          -- decision | technical | influencer | gatekeeper
  offtaker_ids text[],
  found        integer not null default 0,
  note         text,
  claimed_at   timestamptz,
  finished_at  timestamptz,
  updated_at   timestamptz not null default now()
);

-- A person the agent believes it found. Deliberately NOT aee_contacts:
-- a scraped person is a claim about a real human until someone checks
-- it, and accepting a row here is what writes the contact. Keeping the
-- two apart is what stops an agent's mistake becoming a number a rep
-- dials.
create table if not exists public.aee_found_contacts (
  id          text primary key,
  run_id      text,
  offtaker_id text,
  first       text,
  last        text,
  title       text,
  role        text,             -- decision | influencer | technical | gatekeeper
  phone       text,
  email       text,
  source      text,             -- the page the agent read it from
  confidence  numeric,
  status      text,             -- pending | approved | discarded
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists aee_contacts_offtaker_idx     on public.aee_contacts(offtaker_id);
create index if not exists aee_deals_offtaker_idx        on public.aee_deals(offtaker_id);
create index if not exists aee_deals_stage_idx           on public.aee_deals(stage);
create index if not exists aee_interactions_offtaker_idx on public.aee_interactions(offtaker_id);
create index if not exists aee_prospects_sector_idx      on public.aee_prospects(sector_id);
create index if not exists aee_prospects_status_idx      on public.aee_prospects(status);
create index if not exists aee_prospects_near_site_idx   on public.aee_prospects(near_site);
create index if not exists aee_prospects_province_idx    on public.aee_prospects(province);
create index if not exists aee_prospects_load_basis_idx  on public.aee_prospects(load_basis);
create index if not exists aee_deals_prospect_idx        on public.aee_deals(prospect_id);
create index if not exists aee_interactions_prospect_idx on public.aee_interactions(prospect_id);
create index if not exists aee_offtakers_sf_stage_idx    on public.aee_offtakers(sf_stage);
-- The agent's hot path is "give me the oldest queued run"; a reviewer's
-- is "everything still pending".
create index if not exists aee_contact_runs_status_idx    on public.aee_contact_runs(status);
create index if not exists aee_found_contacts_run_idx     on public.aee_found_contacts(run_id);
create index if not exists aee_found_contacts_status_idx  on public.aee_found_contacts(status);
create index if not exists aee_found_contacts_offtaker_idx on public.aee_found_contacts(offtaker_id);

-- ─── UPGRADES ──────────────────────────────────────────────────────
-- `create table if not exists` leaves an existing table alone, so columns
-- added after a project was first provisioned have to be stated again here.
-- Idempotent: re-running the whole file on a live project is safe.

alter table public.aee_offtakers add column if not exists sf_stage text;
alter table public.aee_prospects add column if not exists sf_stage text;
alter table public.aee_deals     add column if not exists prospect_id text;
alter table public.aee_interactions add column if not exists prospect_id text;

do $$
begin
  alter table public.aee_offtakers add constraint aee_offtakers_sf_stage_check
    check (sf_stage in ('prospecting','needs-analysis','proposal','negotiation','closed'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.aee_prospects add constraint aee_prospects_sf_stage_check
    check (sf_stage in ('prospecting','needs-analysis','proposal','negotiation','closed'));
exception when duplicate_object then null;
end $$;

-- ─── ROLE HELPERS ──────────────────────────────────────────────────
-- security definer so the policies can read profiles without the
-- profiles policies recursing into themselves.

create or replace function public.has_crm_access() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','viewer'));
$$;

create or replace function public.is_crm_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- The first account created becomes admin so the owner can set
-- themselves up without a password passing through anyone else's hands.
-- Every account after it starts on 'pending', so this cannot later be
-- used to escalate.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare is_first boolean;
begin
  select count(*) = 0 into is_first from public.profiles;
  insert into public.profiles (id, email, role)
  values (new.id, new.email, case when is_first then 'admin' else 'pending' end)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['aee_offtakers','aee_contacts','aee_deals','aee_prospects',
                           'aee_contact_runs','aee_found_contacts']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      t || '_touch', t);
  end loop;
end $$;

-- These helpers were reachable as anonymous RPC endpoints
-- (/rest/v1/rpc/...). has_crm_access and is_crm_admin must stay
-- executable by `authenticated`, because RLS policy expressions are
-- evaluated with the querying role's privileges and every policy calls
-- them. `anon` never needs them: the policies are declared
-- `to authenticated`, so they are not evaluated for anonymous requests.
revoke all on function public.handle_new_user()   from public, anon, authenticated;
revoke all on function public.touch_updated_at()  from public, anon, authenticated;
revoke all on function public.has_crm_access()    from public, anon;
revoke all on function public.is_crm_admin()      from public, anon;
grant execute on function public.has_crm_access() to authenticated;
grant execute on function public.is_crm_admin()   to authenticated;

-- ─── ROW LEVEL SECURITY ────────────────────────────────────────────

alter table public.profiles         enable row level security;
alter table public.aee_offtakers    enable row level security;
alter table public.aee_contacts     enable row level security;
alter table public.aee_deals        enable row level security;
alter table public.aee_interactions enable row level security;
alter table public.aee_prospects    enable row level security;
alter table public.mining_leads     enable row level security;
alter table public.aee_contact_runs   enable row level security;
alter table public.aee_found_contacts enable row level security;

drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all to authenticated using (public.is_crm_admin()) with check (public.is_crm_admin());

-- Granted users read, admins write. One policy per table per action, so
-- an anonymous caller (no auth.uid()) matches nothing and receives an
-- empty result rather than data.
do $$
declare t text;
begin
  foreach t in array array['aee_offtakers','aee_contacts','aee_deals',
                           'aee_interactions','aee_prospects','mining_leads',
                           'aee_contact_runs','aee_found_contacts']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_read',   t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.has_crm_access())',
      t || '_read', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_crm_admin())',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_crm_admin()) with check (public.is_crm_admin())',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_crm_admin())',
      t || '_delete', t);
  end loop;
end $$;
