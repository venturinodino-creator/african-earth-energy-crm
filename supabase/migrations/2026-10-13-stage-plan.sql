-- Opportunity page: next steps (with a due date), account notes, stage notes
-- and hand-ticked checklist items. Safe to re-run. Also in schema.sql.
-- kind: step | note (one stage) | account-note | check (stage + item position).

create table if not exists public.aee_stage_items (
  id          text primary key,
  offtaker_id text not null,
  stage       text not null,
  kind        text not null check (kind in ('step','note','account-note','check')),
  body        text not null,
  due_date    date,
  done_at     timestamptz,
  author      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists aee_stage_items_offtaker_idx on public.aee_stage_items(offtaker_id);

alter table public.aee_stage_items enable row level security;

-- Granted users read, admins write: the same rule as every other CRM table.
drop policy if exists aee_stage_items_read   on public.aee_stage_items;
drop policy if exists aee_stage_items_insert on public.aee_stage_items;
drop policy if exists aee_stage_items_update on public.aee_stage_items;
drop policy if exists aee_stage_items_delete on public.aee_stage_items;
create policy aee_stage_items_read   on public.aee_stage_items for select to authenticated using (public.has_crm_access());
create policy aee_stage_items_insert on public.aee_stage_items for insert to authenticated with check (public.is_crm_admin());
create policy aee_stage_items_update on public.aee_stage_items for update to authenticated using (public.is_crm_admin()) with check (public.is_crm_admin());
create policy aee_stage_items_delete on public.aee_stage_items for delete to authenticated using (public.is_crm_admin());

drop trigger if exists aee_stage_items_touch on public.aee_stage_items;
create trigger aee_stage_items_touch before update on public.aee_stage_items
  for each row execute function public.touch_updated_at();
