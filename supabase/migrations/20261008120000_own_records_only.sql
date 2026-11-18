-- Sales team see only their own quotes, orders and invoices (owner decision,
-- 2 October 2026).
--
-- Plain-English summary:
-- * Roles get a setting "only their own documents" (`own_records_only`). It's
--   switched on for the Sales team.
-- * Someone sees ALL quotes, orders, invoices, credit notes, purchase orders
--   and recurring invoices if they're an admin, or if at least one of their
--   roles gives Quotes & Invoices access without that setting (e.g. Directors,
--   Finance, Operations). Otherwise they only see documents where they are the
--   salesperson — and can't hand a document to someone else.
-- * This is enforced by the database itself (row-level security), so every
--   page, chart and search follows it automatically.
-- * Customers stay visible to everyone with Customers access, so salespeople
--   can still quote any customer.
-- * `my_sales_rank` lets a salesperson see their place on the leaderboard
--   without seeing anyone else's figures.

alter table public.roles add column own_records_only boolean not null default false;
update public.roles set own_records_only = true where name = 'Sales team';

create function public.sees_all_sales()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      join public.role_permissions rp on rp.role_id = r.id
     where ur.user_id = auth.uid()
       and not r.own_records_only
       and rp.feature = 'quotes' and rp.action = 'view'
  );
$$;

create function public.can_see_sales_owner(p_owner uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.sees_all_sales() or (p_owner is not null and p_owner = auth.uid());
$$;

-- For child rows (lines, email log): look at the parent document's owner.
create function public.can_see_sales_document(p_document uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.sees_all_sales()
      or exists (select 1 from public.sales_documents d where d.id = p_document and d.owner_id = auth.uid());
$$;

create function public.can_see_purchase_order(p_po uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.sees_all_sales()
      or exists (select 1 from public.purchase_orders p where p.id = p_po and p.owner_id = auth.uid());
$$;

create function public.can_see_recurring_invoice(p_recurring uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.sees_all_sales()
      or exists (select 1 from public.recurring_invoices r where r.id = p_recurring and r.owner_id = auth.uid());
$$;

-- Replace the policies on the document tables.
do $$
declare
  t record;
begin
  for t in select * from (values
    ('sales_documents', 'sales', 'public.can_see_sales_owner(owner_id)'),
    ('sales_document_lines', 'sales', 'public.can_see_sales_document(document_id)'),
    ('purchase_orders', 'purchasing', 'public.can_see_sales_owner(owner_id)'),
    ('purchase_order_lines', 'purchasing', 'public.can_see_purchase_order(purchase_order_id)'),
    ('recurring_invoices', 'recurring', 'public.can_see_sales_owner(owner_id)'),
    ('recurring_invoice_lines', 'recurring', 'public.can_see_recurring_invoice(recurring_invoice_id)')
  ) as v(tbl, word, rule) loop
    execute format('drop policy "View %s" on public.%I', t.word, t.tbl);
    execute format('drop policy "Add %s" on public.%I', t.word, t.tbl);
    execute format('drop policy "Change %s" on public.%I', t.word, t.tbl);
    execute format('drop policy "Remove %s" on public.%I', t.word, t.tbl);
    execute format('create policy "View %s" on public.%I for select to authenticated using (public.has_permission(''quotes'', ''view'') and %s)', t.word, t.tbl, t.rule);
    execute format('create policy "Add %s" on public.%I for insert to authenticated with check (public.has_permission(''quotes'', ''edit'') and %s)', t.word, t.tbl, t.rule);
    execute format('create policy "Change %s" on public.%I for update to authenticated using (public.has_permission(''quotes'', ''edit'') and %s) with check (public.has_permission(''quotes'', ''edit'') and %s)', t.word, t.tbl, t.rule, t.rule);
    execute format('create policy "Remove %s" on public.%I for delete to authenticated using (public.has_permission(''quotes'', ''delete'') and %s)', t.word, t.tbl, t.rule);
  end loop;
end $$;

drop policy "View email log" on public.email_log;
drop policy "Record emails" on public.email_log;
create policy "View email log" on public.email_log for select to authenticated using (
  public.has_permission('quotes', 'view') and (
    public.sees_all_sales()
    or (sales_document_id is not null and public.can_see_sales_document(sales_document_id))
    or (purchase_order_id is not null and public.can_see_purchase_order(purchase_order_id))
  )
);
create policy "Record emails" on public.email_log for insert to authenticated with check (
  public.has_permission('quotes', 'edit') and (
    public.sees_all_sales()
    or (sales_document_id is not null and public.can_see_sales_document(sales_document_id))
    or (purchase_order_id is not null and public.can_see_purchase_order(purchase_order_id))
  )
);

-- A salesperson's place on this month's leaderboard (by invoiced value),
-- without revealing anyone else's figures.
create function public.my_sales_rank(p_from date, p_to date)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with totals as (
    select d.owner_id,
           sum(case when d.doc_type = 'invoice' then d.subtotal else -d.subtotal end) as invoiced
      from public.sales_documents d
     where d.owner_id is not null
       and d.issue_date between p_from and p_to
       and ((d.doc_type = 'invoice' and d.status in ('issued', 'paid')) or (d.doc_type = 'credit_note' and d.status = 'issued'))
     group by d.owner_id
  ),
  ranked as (
    select owner_id, rank() over (order by invoiced desc) as place from totals
  )
  select jsonb_build_object(
    'rank', (select place from ranked where owner_id = auth.uid()),
    'of', (select count(*) from ranked)
  )
  where public.is_active_user();
$$;

revoke execute on function public.sees_all_sales() from anon, public;
revoke execute on function public.can_see_sales_owner(uuid) from anon, public;
revoke execute on function public.can_see_sales_document(uuid) from anon, public;
revoke execute on function public.can_see_purchase_order(uuid) from anon, public;
revoke execute on function public.can_see_recurring_invoice(uuid) from anon, public;
revoke execute on function public.my_sales_rank(date, date) from anon, public;
grant execute on function public.sees_all_sales() to authenticated;
grant execute on function public.can_see_sales_owner(uuid) to authenticated;
grant execute on function public.can_see_sales_document(uuid) to authenticated;
grant execute on function public.can_see_purchase_order(uuid) to authenticated;
grant execute on function public.can_see_recurring_invoice(uuid) to authenticated;
grant execute on function public.my_sales_rank(date, date) to authenticated;
