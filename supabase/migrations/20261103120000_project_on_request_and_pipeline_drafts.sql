-- 26 October 2026 (owner): Footprint's flow is customer -> new opportunity
-- (in the pipeline) -> sales order -> Create project, Create design, Create PO.
--
-- 1. A sales order no longer gets a project automatically; staff press
--    "Create project" on the order. Orders that already have one keep it.
-- 2. The pipeline also returns draft opportunities, for a separate area.

drop trigger if exists sales_orders_create_project on public.sales_documents;
drop function if exists public._create_project_for_order();

-- "Create project" on a sales order: same project as before (template by
-- business unit, tasks, activity note), made on request. Returns the existing
-- project if the order already has one.
create function public.create_project_for_sales_order(p_order uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_permission('projects', 'edit') then
    raise exception 'You don''t have permission to create projects';
  end if;
  if not public.can_see_sales_document(p_order) then
    raise exception 'Sales order not found';
  end if;
  return public._create_project_for_sales_order(p_order);
end;
$$;
revoke execute on function public.create_project_for_sales_order(uuid) from anon, public;
grant execute on function public.create_project_for_sales_order(uuid) to authenticated;

create or replace function public.dashboard_pipeline(p_from date, p_to date, p_owner uuid default null)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with q as (
    select d.id, d.number, d.title, d.status, d.issue_date, d.valid_until, d.responded_at, d.reason_for_loss,
           d.owner_id, d.customer_id, d.subtotal
      from public.sales_documents d
     where d.doc_type = 'quote' and d.status <> 'draft'
       and (p_owner is null or d.owner_id = p_owner)
  ),
  in_range as (select * from q where issue_date between p_from and p_to),
  monthly as (
    select to_char(date_trunc('month', issue_date), 'YYYY-MM') as month,
           count(*) as quoted_count, sum(subtotal) as quoted,
           count(*) filter (where status in ('accepted', 'converted')) as won_count,
           coalesce(sum(subtotal) filter (where status in ('accepted', 'converted')), 0) as won,
           count(*) filter (where status = 'declined') as lost_count,
           coalesce(sum(subtotal) filter (where status = 'declined'), 0) as lost
      from in_range group by 1
  ),
  owners as (
    select owner_id, count(*) as quoted_count, sum(subtotal) as quoted,
           count(*) filter (where status in ('accepted', 'converted')) as won_count,
           coalesce(sum(subtotal) filter (where status in ('accepted', 'converted')), 0) as won,
           count(*) filter (where status = 'declined') as lost_count,
           coalesce(sum(subtotal) filter (where status = 'declined'), 0) as lost
      from in_range group by 1
  ),
  wins as (
    -- Won date: the online acceptance, or else the first order raised from it.
    select greatest(0, coalesce(r.responded_at::date,
                                (select min(o.issue_date) from public.sales_documents o where o.source_document_id = r.id)) - r.issue_date) as days
      from in_range r where r.status in ('accepted', 'converted')
  ),
  reasons as (
    select coalesce(nullif(trim(reason_for_loss), ''), 'No reason given') as reason, count(*) as n, sum(subtotal) as value
      from in_range where status = 'declined' group by 1
  ),
  open_quotes as (select * from q where status = 'sent'),
  -- Draft opportunities (not sent yet): shown in their own area, never in
  -- the figures above (owner, 26 October 2026).
  drafts as (
    select d.id, d.number, d.title, d.issue_date, d.customer_id, d.owner_id, d.subtotal
      from public.sales_documents d
     where d.doc_type = 'quote' and d.status = 'draft'
       and (p_owner is null or d.owner_id = p_owner)
  ),
  ages as (
    select case when current_date - issue_date <= 30 then 1
                when current_date - issue_date <= 60 then 2
                when current_date - issue_date <= 90 then 3 else 4 end as bucket,
           count(*) as n, sum(subtotal) as value
      from open_quotes group by 1
  ),
  biggest as (select * from open_quotes order by subtotal desc limit 10)
  select jsonb_build_object(
    'months', coalesce((select jsonb_agg(to_jsonb(m) order by m.month) from monthly m), '[]'::jsonb),
    'owners', coalesce((
      select jsonb_agg(to_jsonb(o) || jsonb_build_object('name', coalesce(p.full_name, p.email, 'No salesperson')) order by o.quoted desc)
        from owners o left join public.profiles p on p.id = o.owner_id), '[]'::jsonb),
    'avg_days_to_win', (select round(avg(days), 1) from wins where days is not null),
    'reasons', coalesce((select jsonb_agg(to_jsonb(r) order by r.n desc) from reasons r), '[]'::jsonb),
    'open_count', (select count(*) from open_quotes),
    'open_value', (select coalesce(sum(subtotal), 0) from open_quotes),
    'open_expired', (select count(*) from open_quotes where valid_until < current_date),
    'ages', coalesce((select jsonb_agg(to_jsonb(a) order by a.bucket) from ages a), '[]'::jsonb),
    'draft_count', (select count(*) from drafts),
    'draft_value', (select coalesce(sum(subtotal), 0) from drafts),
    'drafts', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'number', x.number, 'title', x.title, 'value', x.subtotal,
                                          'issue_date', x.issue_date, 'customer', cu.name, 'owner', coalesce(p.full_name, p.email))
                       order by x.issue_date desc, x.number desc)
        from (select * from drafts order by issue_date desc, number desc limit 15) x
        left join public.customers cu on cu.id = x.customer_id
        left join public.profiles p on p.id = x.owner_id), '[]'::jsonb),
    'biggest', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'number', b.number, 'title', b.title, 'value', b.subtotal,
                                          'issue_date', b.issue_date, 'valid_until', b.valid_until,
                                          'customer', cu.name, 'owner', coalesce(p.full_name, p.email)) order by b.subtotal desc)
        from biggest b
        left join public.customers cu on cu.id = b.customer_id
        left join public.profiles p on p.id = b.owner_id), '[]'::jsonb)
  );
$$;
