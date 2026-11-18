-- Reports tab, first set (28 October 2026).
--
-- Plain-English summary:
-- * Sales and profit, Money owed and Customers count money the same way as the
--   Dashboards: invoices issued or paid, before VAT, less issued credit notes.
--   They run as the person asking, so sales staff only ever see their own
--   customers' documents (as everywhere else).
-- * Magazine MI covers the whole business (like the Magazines dashboard) and
--   needs Magazines view. Booked = adverts on sales orders that aren't
--   cancelled.
-- * Directors and Finance can open Reports; admins can give other roles access
--   in Admin → Roles.

-- ─── Sales and profit ───────────────────────────────────────────────────────
-- One row per group: month, salesperson, business unit, sales account or customer.
create function public.report_sales(p_from date, p_to date, p_group text)
returns table (key text, label text, net numeric, cost numeric, docs bigint)
language sql stable security invoker set search_path = ''
as $$
  with signed as (
    select d.id, d.issue_date, d.owner_id, d.customer_id, d.business_unit, d.doc_type,
           case when d.doc_type = 'credit_note' then -1 else 1 end as sign, d.subtotal, d.cost_total
      from public.sales_documents d
     where d.issue_date between p_from and p_to
       and ((d.doc_type = 'invoice' and d.status in ('issued', 'paid'))
         or (d.doc_type = 'credit_note' and d.status = 'issued'))
  )
  select g.key, g.label, sum(g.net), sum(g.cost), sum(g.docs)::bigint
    from (
      select case p_group
               when 'month' then to_char(date_trunc('month', s.issue_date), 'YYYY-MM')
               when 'salesperson' then coalesce(s.owner_id::text, 'none')
               when 'business_unit' then coalesce(s.business_unit, 'none')
               when 'customer' then coalesce(s.customer_id::text, 'none')
             end as key,
             case p_group
               when 'month' then to_char(date_trunc('month', s.issue_date), 'FMMonth YYYY')
               when 'salesperson' then coalesce(p.full_name, p.email, 'No salesperson')
               when 'business_unit' then coalesce(s.business_unit, 'No business unit')
               when 'customer' then coalesce(c.name, 'Unknown customer')
             end as label,
             s.sign * s.subtotal as net, s.sign * s.cost_total as cost,
             case when s.doc_type = 'invoice' then 1 else 0 end as docs
        from signed s
        left join public.profiles p on p.id = s.owner_id
        left join public.customers c on c.id = s.customer_id
       where p_group <> 'account'
      union all
      select coalesce(l.account_code, 'none'), coalesce(sa.name, l.account_code, 'No sales account'),
             s.sign * l.line_net, s.sign * l.line_cost, 0
        from signed s
        join public.sales_document_lines l on l.document_id = s.id
        left join public.sales_accounts sa on sa.code = l.account_code
       where p_group = 'account'
    ) g
   group by g.key, g.label;
$$;

-- ─── Money owed ─────────────────────────────────────────────────────────────
-- Every issued, unpaid invoice with what's still owed after issued credit
-- notes (part payments aren't recorded in FootprintOS yet).
create function public.report_debt()
returns table (
  id uuid, number text, customer_id uuid, customer_name text, owner_name text,
  issue_date date, due_date date, total numeric, owed numeric
)
language sql stable security invoker set search_path = ''
as $$
  select d.id, d.number, d.customer_id, c.name, coalesce(p.full_name, p.email), d.issue_date, d.due_date, d.total,
         d.total - coalesce((select sum(cn.total) from public.sales_documents cn
                              where cn.source_document_id = d.id and cn.doc_type = 'credit_note' and cn.status = 'issued'), 0)
    from public.sales_documents d
    left join public.customers c on c.id = d.customer_id
    left join public.profiles p on p.id = d.owner_id
   where d.doc_type = 'invoice' and d.status = 'issued';
$$;

-- ─── Customers ──────────────────────────────────────────────────────────────
-- Customers invoiced in the period (with their first ever invoice date and
-- what they buy), and customers who bought in the period before but not now.
create function public.report_customers(p_from date, p_to date)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with signed as (
    select d.id, d.issue_date, d.customer_id, d.doc_type,
           case when d.doc_type = 'credit_note' then -1 else 1 end as sign, d.subtotal, d.cost_total
      from public.sales_documents d
     where d.customer_id is not null
       and ((d.doc_type = 'invoice' and d.status in ('issued', 'paid'))
         or (d.doc_type = 'credit_note' and d.status = 'issued'))
  ),
  now_period as (
    select customer_id, sum(sign * subtotal) net, sum(sign * cost_total) cost,
           count(*) filter (where doc_type = 'invoice') invoices, max(issue_date) last_date
      from signed where issue_date between p_from and p_to group by 1
  ),
  before_period as (
    select customer_id, sum(sign * subtotal) net, max(issue_date) last_date
      from signed where issue_date between p_from - (p_to - p_from + 1) and p_from - 1 group by 1
  ),
  firsts as (
    select customer_id, min(issue_date) first_date from signed where doc_type = 'invoice' group by 1
  )
  select jsonb_build_object(
    'customers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', n.customer_id, 'name', c.name, 'net', n.net, 'cost', n.cost, 'invoices', n.invoices,
               'last_date', n.last_date, 'first_date', f.first_date,
               'before_net', coalesce(b.net, 0),
               'buys', (select jsonb_agg(x.name order by x.net desc) from (
                          select coalesce(sa.name, l.account_code) as name, sum(s.sign * l.line_net) as net
                            from signed s join public.sales_document_lines l on l.document_id = s.id
                            left join public.sales_accounts sa on sa.code = l.account_code
                           where s.customer_id = n.customer_id and s.issue_date between p_from and p_to and l.account_code is not null
                           group by 1 order by 2 desc limit 3) x))
             order by n.net desc)
        from now_period n
        join public.customers c on c.id = n.customer_id
        left join before_period b on b.customer_id = n.customer_id
        left join firsts f on f.customer_id = n.customer_id), '[]'::jsonb),
    'lost', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.customer_id, 'name', c.name, 'before_net', b.net, 'last_date', b.last_date)
             order by b.net desc)
        from before_period b
        join public.customers c on c.id = b.customer_id
       where b.net > 0 and not exists (select 1 from now_period n where n.customer_id = b.customer_id)), '[]'::jsonb)
  );
$$;

-- ─── Magazine MI ────────────────────────────────────────────────────────────
create function public.report_magazines(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_from date := date_trunc('month', p_from)::date;
  v_to date := date_trunc('month', p_to)::date;
begin
  if not public.has_permission('magazines', 'view') then
    raise exception 'Not allowed';
  end if;
  return (
    with booked as (
      select l.id, l.line_net, i.month, i.edition_id, d.customer_id, d.owner_id, sz.name size_name,
             coalesce(sz.page_fraction, 0) * l.quantity pages
        from public.sales_document_lines l
        join public.magazine_issues i on i.id = l.magazine_issue_id
        join public.sales_documents d on d.id = l.document_id
        left join public.advert_sizes sz on sz.id = l.advert_size_id
       where d.doc_type = 'sales_order' and d.status <> 'cancelled'
    ),
    in_range as (select * from booked where month between v_from and v_to),
    first_month as (select customer_id, min(month) first_month from booked group by 1)
    select jsonb_build_object(
      'editions', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'code', e.code, 'name', e.name,
                 'net', coalesce((select sum(b.line_net) from in_range b where b.edition_id = e.id), 0),
                 'pages_booked', coalesce((select sum(b.pages) from in_range b where b.edition_id = e.id), 0),
                 'adverts', (select count(*) from in_range b where b.edition_id = e.id),
                 'pages', coalesce((select sum(i.pages) from public.magazine_issues i where i.edition_id = e.id and i.month between v_from and v_to), 0),
                 'target', coalesce((select sum(i.sales_target) from public.magazine_issues i where i.edition_id = e.id and i.month between v_from and v_to), 0))
               order by e.code)
          from public.magazine_editions e where e.active), '[]'::jsonb),
      'months', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'month', m.month,
                 'net', coalesce((select sum(b.line_net) from in_range b where b.month = m.month), 0),
                 'target', coalesce((select sum(i.sales_target) from public.magazine_issues i join public.magazine_editions e on e.id = i.edition_id where e.active and i.month = m.month), 0),
                 'advertisers', (select count(distinct b.customer_id) from in_range b where b.month = m.month),
                 'new_advertisers', (select count(distinct b.customer_id) from in_range b join first_month f on f.customer_id = b.customer_id
                                      where b.month = m.month and f.first_month = m.month))
               order by m.month)
          from (select distinct month from public.magazine_issues where month between v_from and v_to) m), '[]'::jsonb),
      'sizes', coalesce((
        select jsonb_agg(jsonb_build_object('size', x.size_name, 'adverts', x.n, 'net', x.net) order by x.net desc)
          from (select coalesce(size_name, 'No size') size_name, count(*) n, sum(line_net) net from in_range group by 1) x), '[]'::jsonb),
      'salespeople', coalesce((
        select jsonb_agg(jsonb_build_object('name', x.name, 'adverts', x.n, 'net', x.net) order by x.net desc)
          from (select coalesce(p.full_name, p.email, 'No salesperson') name, count(*) n, sum(b.line_net) net
                  from in_range b left join public.profiles p on p.id = b.owner_id group by 1) x), '[]'::jsonb)
    )
  );
end;
$$;

revoke execute on function public.report_sales(date, date, text) from public, anon;
revoke execute on function public.report_debt() from public, anon;
revoke execute on function public.report_customers(date, date) from public, anon;
revoke execute on function public.report_magazines(date, date) from public, anon;
grant execute on function public.report_sales(date, date, text) to authenticated;
grant execute on function public.report_debt() to authenticated;
grant execute on function public.report_customers(date, date) to authenticated;
grant execute on function public.report_magazines(date, date) to authenticated;

-- ─── Who can open Reports ───────────────────────────────────────────────────
insert into public.role_permissions (role_id, feature, action)
select r.id, 'reports', 'view' from public.roles r where r.name in ('Directors', 'Finance team')
on conflict do nothing;
