-- Dashboards section: Revenue and Pipeline figures (15 October 2026).
--
-- Plain-English summary:
-- * dashboard_revenue: invoiced (net of VAT) and gross profit for a date
--   range, by month, by account manager, by sales account and top customers.
--   Issued credit notes are taken off — both their value and their cost — on
--   the date the credit note was issued.
-- * dashboard_pipeline: quotes sent in a date range, won and lost by month and
--   by person, average days from quote to win, reasons for losing, and all
--   quotes still waiting for an answer (by age, and the biggest ones).
-- * Both run as the person asking, so the usual rules apply: sales staff only
--   ever see their own documents.
-- * Sales, Finance, Operations and Marketing can now open the Dashboards
--   section. Which tabs they see depends on their role (in the app).

create function public.dashboard_revenue(p_from date, p_to date, p_owner uuid default null)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with signed as (
    select d.id, d.issue_date, d.owner_id, d.customer_id, d.doc_type,
           case when d.doc_type = 'credit_note' then -1 else 1 end as sign,
           d.subtotal, d.cost_total
      from public.sales_documents d
     where d.issue_date between p_from and p_to
       and ((d.doc_type = 'invoice' and d.status in ('issued', 'paid'))
         or (d.doc_type = 'credit_note' and d.status = 'issued'))
       and (p_owner is null or d.owner_id = p_owner)
  ),
  monthly as (
    select to_char(date_trunc('month', issue_date), 'YYYY-MM') as month,
           sum(sign * subtotal) as net, sum(sign * cost_total) as cost
      from signed group by 1
  ),
  owners as (
    select owner_id, sum(sign * subtotal) as net, sum(sign * cost_total) as cost,
           count(*) filter (where doc_type = 'invoice') as invoices
      from signed group by 1
  ),
  accounts as (
    select l.account_code, sum(s.sign * l.line_net) as net, sum(s.sign * l.line_cost) as cost
      from signed s join public.sales_document_lines l on l.document_id = s.id
     group by 1
  ),
  top_customers as (
    select customer_id, sum(sign * subtotal) as net, sum(sign * cost_total) as cost
      from signed group by 1 order by 2 desc limit 10
  )
  select jsonb_build_object(
    'months', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'net', net, 'cost', cost) order by month) from monthly), '[]'::jsonb),
    'owners', coalesce((
      select jsonb_agg(jsonb_build_object('owner_id', o.owner_id, 'name', coalesce(p.full_name, p.email, 'No account manager'),
                                          'net', o.net, 'cost', o.cost, 'invoices', o.invoices) order by o.net desc)
        from owners o left join public.profiles p on p.id = o.owner_id), '[]'::jsonb),
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object('code', a.account_code,
                                          'name', coalesce(sa.name, a.account_code, 'No sales account'),
                                          'net', a.net, 'cost', a.cost) order by a.net desc)
        from accounts a left join public.sales_accounts sa on sa.code = a.account_code), '[]'::jsonb),
    'customers', coalesce((
      select jsonb_agg(jsonb_build_object('customer_id', c.customer_id, 'name', coalesce(cu.name, 'Unknown customer'),
                                          'net', c.net, 'cost', c.cost) order by c.net desc)
        from top_customers c left join public.customers cu on cu.id = c.customer_id), '[]'::jsonb)
  );
$$;

create function public.dashboard_pipeline(p_from date, p_to date, p_owner uuid default null)
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
    'biggest', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'number', b.number, 'title', b.title, 'value', b.subtotal,
                                          'issue_date', b.issue_date, 'valid_until', b.valid_until,
                                          'customer', cu.name, 'owner', coalesce(p.full_name, p.email)) order by b.subtotal desc)
        from biggest b
        left join public.customers cu on cu.id = b.customer_id
        left join public.profiles p on p.id = b.owner_id), '[]'::jsonb)
  );
$$;

revoke execute on function public.dashboard_revenue(date, date, uuid) from anon, public;
revoke execute on function public.dashboard_pipeline(date, date, uuid) from anon, public;
grant execute on function public.dashboard_revenue(date, date, uuid) to authenticated;
grant execute on function public.dashboard_pipeline(date, date, uuid) to authenticated;

insert into public.role_permissions (role_id, feature, action)
select r.id, 'dashboards', 'view'
  from public.roles r
 where r.name in ('Sales team', 'Finance team', 'Operations team', 'Marketing team')
on conflict do nothing;
