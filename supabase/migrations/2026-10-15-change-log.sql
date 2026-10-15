-- Change log, ticket 1: the change table, and next steps / notes / ticks recorded
-- with their author. Safe to re-run. Also in schema.sql.
--
-- The author is stamped by the database from the sign-in that made the change,
-- never taken from what the page sends (docs/adr/0002-database-stamps-the-author.md).

-- ─── CHANGE LOG ────────────────────────────────────────────────────
-- One row per change, append-only. Written only by record_change(), which runs
-- with the owner's rights; admins read it; nobody writes it through the API.
--   kind     created | edited | deleted (sign-ins and role changes come later)
--   fields   {"column": {"old": …, "new": …}} for an edit, the new values for a
--            create; bookkeeping columns (updated_at, synced_at) are left out
--   deleted_row  the whole row as it was, for a deletion
create table if not exists public.aee_changes (
  id           bigint generated always as identity primary key,
  at           timestamptz not null default now(),
  author_id    uuid,                -- auth.uid() of the sign-in; null outside the API
  author_email text,                -- that account's email at the time
  agent        text,                -- the agent's job name, when one declares itself
  table_name   text not null,
  record_id    text,
  offtaker_id  text,                -- the account it belongs to, so a company's history is one filter
  kind         text not null check (kind in ('created','edited','deleted','signed-in','role-changed')),
  fields       jsonb,
  deleted_row  jsonb
);
create index if not exists aee_changes_at_idx       on public.aee_changes(at desc);
create index if not exists aee_changes_offtaker_idx on public.aee_changes(offtaker_id);
create index if not exists aee_changes_author_idx   on public.aee_changes(author_id);

alter table public.aee_changes enable row level security;
drop policy if exists aee_changes_read on public.aee_changes;
create policy aee_changes_read on public.aee_changes
  for select to authenticated using (public.is_crm_admin());
revoke insert, update, delete, truncate on public.aee_changes from public, anon, authenticated;

create or replace function public.record_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  r jsonb := coalesce(n, o);
  diff jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(e.key, jsonb_build_object('old', o -> e.key, 'new', e.value)) into diff
      from jsonb_each(n) e
     where e.key not in ('updated_at','synced_at') and (o -> e.key) is distinct from e.value;
    if diff is null then return null; end if;   -- nothing a person changed
  elsif tg_op = 'INSERT' then
    select jsonb_object_agg(e.key, jsonb_build_object('old', null, 'new', e.value)) into diff
      from jsonb_each(n) e
     where e.key not in ('updated_at','synced_at') and e.value <> 'null'::jsonb;
  end if;
  insert into public.aee_changes (author_id, author_email, table_name, record_id, offtaker_id, kind, fields, deleted_row)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), tg_table_name, r ->> 'id',
          coalesce(r ->> 'offtaker_id', case when tg_table_name = 'aee_offtakers' then r ->> 'id' end),
          case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'edited' else 'deleted' end,
          diff, case when tg_op = 'DELETE' then o end);
  return null;
end;
$$;

-- The name a byline shows for the sign-in: the login without @aeeg.co.za, as
-- toDisplayName() in js/supabase.js does; another domain keeps the whole email.
create or replace function public.author_display_name() returns text
language sql stable security definer set search_path = public as $$
  select case when lower(email) like '%@aeeg.co.za' then split_part(email, '@', 1) else email end
    from auth.users where id = auth.uid();
$$;

-- Bylines stored on the row are stamped too: a new row gets the sign-in's
-- name whatever the page sent, and an edit keeps the name it had.
create or replace function public.stamp_author() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.author := public.author_display_name();
  else
    new.author := old.author;
  end if;
  return new;
end;
$$;

revoke all on function public.record_change()       from public, anon, authenticated;
revoke all on function public.author_display_name() from public, anon, authenticated;
revoke all on function public.stamp_author()        from public, anon, authenticated;

-- Next steps, notes and checklist ticks.
drop trigger if exists aee_stage_items_stamp_author on public.aee_stage_items;
create trigger aee_stage_items_stamp_author
  before insert or update on public.aee_stage_items
  for each row execute function public.stamp_author();
drop trigger if exists aee_stage_items_record_change on public.aee_stage_items;
create trigger aee_stage_items_record_change
  after insert or update or delete on public.aee_stage_items
  for each row execute function public.record_change();

notify pgrst, 'reload schema';
