-- Outreach-led sales flow: run once in the Supabase SQL editor BEFORE the
-- branch that ships it is merged. Safe to re-run. Everything here is also in
-- schema.sql; this file exists so the change can be applied on its own.

begin;

-- 1. The seven-stage path. 'prospecting' stays allowed so a browser still
--    running the old page cannot fail a save; the app reads it as Outreach.
alter table public.aee_offtakers drop constraint if exists aee_offtakers_sf_stage_check;
alter table public.aee_offtakers add constraint aee_offtakers_sf_stage_check
  check (sf_stage in ('outreach','online-meeting','in-person','needs-analysis','proposal','negotiation','closed','prospecting'));

-- 2. Prospecting is now Outreach. The other stage ids are unchanged.
update public.aee_offtakers set sf_stage = 'outreach' where sf_stage = 'prospecting';
update public.aee_deals     set stage    = 'outreach' where stage in ('prospecting','identified');

-- 3. Outreach detail on each logged activity. All optional.
alter table public.aee_interactions add column if not exists contact_ids  text[];
alter table public.aee_interactions add column if not exists channel      text;
alter table public.aee_interactions add column if not exists touch_no     integer;
alter table public.aee_interactions add column if not exists outcome      text;
alter table public.aee_interactions add column if not exists follow_up_on date;
create index if not exists aee_interactions_follow_up_idx
  on public.aee_interactions(follow_up_on) where follow_up_on is not null;

commit;
