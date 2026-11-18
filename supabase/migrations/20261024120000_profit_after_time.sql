-- Profit after staff time, with hourly costs per role (15 October 2026).
--
-- Plain-English summary:
-- * The owner chose hourly costs per ROLE (not per person). `role_cost_rates`
--   holds one hourly cost (wages and overheads) for each role. Someone with
--   several roles uses the highest; anyone without a rate uses the company
--   default. The starting figures are MADE-UP examples until replaced.
-- * Staff time cost on a project now uses these role rates.
-- * project_profit: for each project, what was invoiced (from the sales
--   order's invoices, less credit notes — or the order itself if nothing is
--   invoiced yet), the cost of materials and suppliers, the cost of staff
--   time, and so the profit after time.
-- * Only admins, directors and finance can see rates, costs and profit.
--   Everyone else gets nothing back.

create table public.role_cost_rates (
  role_id      uuid primary key references public.roles (id) on delete cascade,
  hourly_cost  numeric(8,2) not null check (hourly_cost >= 0),
  is_example   boolean not null default false,
  updated_at   timestamptz not null default now(),
  updated_by   uuid
);

alter table public.role_cost_rates enable row level security;
create policy "Directors, finance and admins see role cost rates" on public.role_cost_rates for select to authenticated
  using (public.is_admin() or public.my_dashboards() && array['director', 'finance']);
create policy "Admins manage role cost rates" on public.role_cost_rates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.role_cost_rates from anon;
create trigger role_cost_rates_touch before update on public.role_cost_rates for each row execute function public.touch_row();
create trigger audit_role_cost_rates after insert or update or delete on public.role_cost_rates for each row execute function public.audit_row();

-- Made-up starting figures (UK creative agency, wages plus overheads).
insert into public.role_cost_rates (role_id, hourly_cost, is_example)
select r.id, v.rate, true
  from public.roles r
  join (values ('Directors', 45), ('Finance team', 26), ('Sales team', 24), ('Operations team', 22), ('Marketing team', 24)) as v(name, rate)
    on v.name = r.name
on conflict (role_id) do nothing;

-- One person's hourly cost: the highest rate of their roles, else the default.
create function public.person_hourly_cost(p_user uuid)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select max(rc.hourly_cost) from public.user_roles ur join public.role_cost_rates rc on rc.role_id = ur.role_id where ur.user_id = p_user),
    (select default_hourly_cost from public.company_settings limit 1),
    25);
$$;
revoke execute on function public.person_hourly_cost(uuid) from anon, public, authenticated;

-- Staff time on each project, now costed with role rates.
create or replace function public.project_time_costs(p_project_ids uuid[])
returns table (project_id uuid, minutes bigint, billable_minutes bigint, cost numeric)
language sql stable security definer set search_path = ''
as $$
  with people as (
    select distinct t.user_id from public.time_logs t where t.project_id = any(p_project_ids)
  ),
  rates as (select p.user_id, public.person_hourly_cost(p.user_id) as rate from people p)
  select t.project_id,
         sum(t.minutes)::bigint,
         sum(t.minutes) filter (where t.billable)::bigint,
         case when public.is_admin() or public.my_dashboards() && array['director', 'finance']
              then round(sum(t.minutes * r.rate / 60.0), 2) end
    from public.time_logs t
    join rates r on r.user_id = t.user_id
   where t.project_id = any(p_project_ids) and t.minutes is not null
     and public.has_permission('projects', 'view')
   group by t.project_id;
$$;

-- Invoiced, materials, staff time and profit after time for each project.
create function public.project_profit(p_project_ids uuid[])
returns table (project_id uuid, basis text, invoiced numeric, materials numeric, minutes bigint, time_cost numeric, profit numeric)
language sql stable security definer set search_path = ''
as $$
  with allowed as (
    select (public.is_admin() or public.my_dashboards() && array['director', 'finance']) and public.has_permission('projects', 'view') as ok
  ),
  p as (
    select pr.id, pr.sales_document_id from public.projects pr, allowed a where a.ok and pr.id = any(p_project_ids)
  ),
  inv as (
    select p.id as project_id,
           sum(case when i.doc_type = 'credit_note' then -i.subtotal else i.subtotal end) as net,
           sum(case when i.doc_type = 'credit_note' then -i.cost_total else i.cost_total end) as cost,
           count(*) filter (where i.doc_type = 'invoice') as n
      from p
      join public.sales_documents i
        on (i.doc_type = 'invoice' and i.status in ('issued', 'paid') and i.source_document_id = p.sales_document_id)
        or (i.doc_type = 'credit_note' and i.status = 'issued'
            and i.source_document_id in (select x.id from public.sales_documents x where x.doc_type = 'invoice' and x.source_document_id = p.sales_document_id))
     group by p.id
  ),
  ord as (
    select p.id as project_id, o.subtotal as net, o.cost_total as cost
      from p join public.sales_documents o on o.id = p.sales_document_id and o.status <> 'cancelled'
  ),
  t as (select * from public.project_time_costs((select coalesce(array_agg(id), '{}') from p)))
  select p.id,
         case when coalesce(inv.n, 0) > 0 then 'invoiced' when ord.project_id is not null then 'order' else 'none' end,
         coalesce(case when coalesce(inv.n, 0) > 0 then inv.net end, ord.net, 0),
         coalesce(case when coalesce(inv.n, 0) > 0 then inv.cost end, ord.cost, 0),
         coalesce(t.minutes, 0),
         coalesce(t.cost, 0),
         coalesce(case when coalesce(inv.n, 0) > 0 then inv.net - inv.cost end, ord.net - ord.cost, 0) - coalesce(t.cost, 0)
    from p
    left join inv on inv.project_id = p.id
    left join ord on ord.project_id = p.id
    left join t on t.project_id = p.id;
$$;
revoke execute on function public.project_profit(uuid[]) from anon, public;
grant execute on function public.project_profit(uuid[]) to authenticated;
