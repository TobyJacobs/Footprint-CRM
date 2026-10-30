-- Lead pipelines (28 October 2026), Wave 8 Marketing: replacing GoHighLevel's
-- pipelines for Footprint's own leads.
--
-- Plain-English summary:
-- * A lead is a person or business who's shown interest but isn't a quote yet.
--   Leads move through a pipeline's stages (e.g. New lead → Contacted →
--   Meeting booked → Quote sent → Won / Lost). When ready, one click makes the
--   lead a customer (or links an existing one) and starts a quote, which then
--   carries on in the Sales pipeline.
-- * One pipeline per business area to start: Print/Merch, Signage, Advertising
--   (Forget Me Not) and FootprintAI, each with stages that can be renamed,
--   reordered or added to.
-- * Marketing and Sales both use them: anyone with Marketing or Sales view can
--   see leads; Marketing or Sales edit can add and change them. Sales staff who
--   only see their own records see their own leads and unassigned ones.
-- * Leads hold personal data (UK GDPR): delete a lead when it's no longer
--   needed. Every change is in the audit log.

create table public.lead_pipelines (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique check (length(trim(name)) > 0),
  business_unit  text,
  position       integer not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);

create table public.lead_stages (
  id           uuid primary key default gen_random_uuid(),
  pipeline_id  uuid not null references public.lead_pipelines (id) on delete cascade,
  name         text not null check (length(trim(name)) > 0),
  position     integer not null default 0,
  kind         text not null default 'open' check (kind in ('open', 'won', 'lost')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  unique (pipeline_id, name)
);
create index lead_stages_pipeline_idx on public.lead_stages (pipeline_id, position);

create table public.leads (
  id                uuid primary key default gen_random_uuid(),
  pipeline_id       uuid not null references public.lead_pipelines (id) on delete restrict,
  stage_id          uuid not null references public.lead_stages (id) on delete restrict,
  name              text not null check (length(trim(name)) between 1 and 200),
  company           text check (company is null or length(company) <= 200),
  email             text check (email is null or length(email) <= 320),
  phone             text check (phone is null or length(phone) <= 50),
  source            text,
  value_estimate    numeric(12,2) check (value_estimate is null or value_estimate >= 0),
  owner_id          uuid references public.profiles (id) on delete set null,
  next_follow_up    date,
  notes             text check (notes is null or length(notes) <= 5000),
  lost_reason       text,
  customer_id       uuid references public.customers (id) on delete set null,
  stage_changed_at  timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  created_by        uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at        timestamptz not null default now(),
  updated_by        uuid
);
create index leads_board_idx on public.leads (pipeline_id, stage_id);
create index leads_stage_idx on public.leads (stage_id);
create index leads_owner_idx on public.leads (owner_id);
create index leads_customer_idx on public.leads (customer_id);
create index leads_created_by_idx on public.leads (created_by);
create index leads_follow_up_idx on public.leads (next_follow_up) where next_follow_up is not null;

-- ─── Access ─────────────────────────────────────────────────────────────────

create function public._leads_view() returns boolean language sql stable security definer set search_path = ''
as $$ select public.has_permission('marketing', 'view') or public.has_permission('quotes', 'view'); $$;
create function public._leads_edit() returns boolean language sql stable security definer set search_path = ''
as $$ select public.has_permission('marketing', 'edit') or public.has_permission('quotes', 'edit'); $$;
create function public._leads_delete() returns boolean language sql stable security definer set search_path = ''
as $$ select public.has_permission('marketing', 'delete') or public.has_permission('quotes', 'delete'); $$;
revoke execute on function public._leads_view() from public, anon;
revoke execute on function public._leads_edit() from public, anon;
revoke execute on function public._leads_delete() from public, anon;
grant execute on function public._leads_view() to authenticated;
grant execute on function public._leads_edit() to authenticated;
grant execute on function public._leads_delete() to authenticated;

alter table public.lead_pipelines enable row level security;
alter table public.lead_stages enable row level security;
alter table public.leads enable row level security;

do $$
declare t text;
begin
  foreach t in array array['lead_pipelines', 'lead_stages'] loop
    execute format('create policy "See pipelines" on public.%I for select to authenticated using ((select public._leads_view()))', t);
    execute format('create policy "Set up pipelines" on public.%I for all to authenticated using ((select public.has_permission(''marketing'', ''edit''))) with check ((select public.has_permission(''marketing'', ''edit'')))', t);
  end loop;
end $$;

-- Own-records-only sales staff: their own leads and unassigned ones.
create policy "See leads" on public.leads for select to authenticated
  using ((select public._leads_view()) and ((select public.sees_all_sales()) or (select public.has_permission('marketing', 'view')) or owner_id is null or owner_id = (select auth.uid())));
create policy "Add leads" on public.leads for insert to authenticated
  with check ((select public._leads_edit()));
create policy "Change leads" on public.leads for update to authenticated
  using ((select public._leads_edit()) and ((select public.sees_all_sales()) or (select public.has_permission('marketing', 'edit')) or owner_id is null or owner_id = (select auth.uid())))
  with check ((select public._leads_edit()));
create policy "Delete leads" on public.leads for delete to authenticated
  using ((select public._leads_delete()) and ((select public.sees_all_sales()) or (select public.has_permission('marketing', 'delete')) or owner_id = (select auth.uid())));

-- A lead's stage must belong to its pipeline; moving stage stamps the time.
create function public.lead_stage_check()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.lead_stages s where s.id = new.stage_id and s.pipeline_id = new.pipeline_id) then
    raise exception 'That stage isn''t in this pipeline';
  end if;
  if tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id then
    new.stage_changed_at := now();
  end if;
  return new;
end;
$$;
revoke execute on function public.lead_stage_check() from anon, authenticated, public;
create trigger leads_stage_check before insert or update on public.leads
  for each row execute function public.lead_stage_check();

do $$
declare t text;
begin
  foreach t in array array['lead_pipelines', 'lead_stages', 'leads'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_row()', t || '_touch', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', 'audit_' || t, t);
  end loop;
end $$;

-- ─── Starting pipelines ─────────────────────────────────────────────────────

insert into public.lead_pipelines (name, business_unit, position) values
  ('Print/Merch', 'Print/Merch', 1),
  ('Signage', 'Signage', 2),
  ('Advertising (Forget Me Not)', 'Advertising', 3),
  ('FootprintAI', 'Footprint AI', 4);

insert into public.lead_stages (pipeline_id, name, position, kind)
select p.id, s.name, s.position, s.kind
  from public.lead_pipelines p
 cross join (values
   ('New lead', 1, 'open'), ('Contacted', 2, 'open'), ('Meeting booked', 3, 'open'),
   ('Quote sent', 4, 'open'), ('Won', 5, 'won'), ('Lost', 6, 'lost')
 ) as s(name, position, kind);
