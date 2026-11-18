-- Database tune-up after Supabase's advisors (15 October 2026).
--
-- Plain-English summary:
-- * Speed: access rules that check "who is signed in?" now do it once per
--   query instead of once per row (Supabase's "Auth RLS Initialization Plan").
-- * Speed: every link between tables gets an index, so looking up related
--   records stays quick as the data grows (Supabase's "unindexed foreign keys").
-- * Security tidy-up: functions that only ever run automatically (triggers)
--   can no longer be called directly by anyone. Functions that must stay
--   callable — the customer quote and invoice links, staff invite links, the
--   daily staff sync (checked with its secret key) and the app's own helpers —
--   are left as they are.
-- * Margins: the Sales Overview and home page figures now take issued credit
--   notes off the cost as well as the sales value, matching the Dashboards.
-- Written to work on any copy of the database (test now, London later).

-- ─── Speed: check the signed-in person once per query ───────────────────────

do $$
declare
  pol record;
  new_using text;
  new_check text;
  stmt text;
begin
  for pol in
    select tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') ~ 'auth\.(uid|jwt)\(\)' or coalesce(with_check, '') ~ 'auth\.(uid|jwt)\(\)')
  loop
    new_using := regexp_replace(pol.qual, '(?<!select )auth\.(uid|jwt)\(\)', '(select auth.\1())', 'gi');
    new_check := regexp_replace(pol.with_check, '(?<!select )auth\.(uid|jwt)\(\)', '(select auth.\1())', 'gi');
    stmt := format('alter policy %I on public.%I', pol.policyname, pol.tablename);
    if new_using is not null then stmt := stmt || format(' using (%s)', new_using); end if;
    if new_check is not null then stmt := stmt || format(' with check (%s)', new_check); end if;
    if new_using is distinct from pol.qual or new_check is distinct from pol.with_check then
      execute stmt;
    end if;
  end loop;
end $$;

-- ─── Speed: an index for every link between tables ──────────────────────────

do $$
declare
  fk record;
begin
  for fk in
    select c.conrelid::regclass as tbl, a.attname as col, c.conrelid as relid
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f'
       and c.connamespace = 'public'::regnamespace
       and array_length(c.conkey, 1) = 1
       and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])
  loop
    execute format('create index if not exists %I on %s (%I)',
                   left(replace(fk.tbl::text, 'public.', '') || '_' || fk.col || '_fk_idx', 63), fk.tbl, fk.col);
  end loop;
end $$;

-- ─── Security tidy-up: trigger functions can't be called directly ───────────
-- (Triggers still run as before; calling them by hand was never needed.)

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- ─── Margins: credit notes take off their cost too ──────────────────────────

create or replace function public.sales_stats(p_from date, p_owner uuid default null)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with docs as (
    select d.*
      from public.sales_documents d
     where d.issue_date >= p_from
       and d.status <> 'draft'
       and (p_owner is null or d.owner_id = p_owner)
  ),
  monthly as (
    select to_char(date_trunc('month', issue_date), 'YYYY-MM') as month,
           coalesce(sum(subtotal) filter (where doc_type = 'quote'), 0) as quoted,
           coalesce(sum(subtotal) filter (where doc_type = 'quote' and status in ('accepted', 'converted')), 0) as won,
           coalesce(sum(subtotal) filter (where doc_type = 'quote' and status = 'declined'), 0) as lost,
           coalesce(sum(subtotal) filter (where doc_type = 'invoice' and status in ('issued', 'paid')), 0) as invoiced,
           coalesce(sum(subtotal) filter (where doc_type = 'credit_note' and status = 'issued'), 0) as credited,
           coalesce(sum(subtotal) filter (where doc_type = 'invoice' and status = 'paid'), 0) as paid,
           coalesce(sum(subtotal) filter (where doc_type = 'invoice' and status = 'issued'), 0) as unpaid,
           coalesce(sum(cost_total) filter (where doc_type = 'invoice' and status in ('issued', 'paid')), 0)
           - coalesce(sum(cost_total) filter (where doc_type = 'credit_note' and status = 'issued'), 0) as cost
      from docs
     group by 1
  ),
  quotes as (
    select count(*) filter (where doc_type = 'quote' and status in ('accepted', 'converted')) as won,
           count(*) filter (where doc_type = 'quote' and status = 'declined') as lost,
           count(*) filter (where doc_type = 'quote' and status = 'sent') as open_count,
           coalesce(sum(subtotal) filter (where doc_type = 'quote' and status = 'sent'), 0) as open_value
      from docs
  ),
  top_customers as (
    select c.name,
           sum(case when d.doc_type = 'invoice' then d.subtotal else -d.subtotal end) as value
      from docs d
      join public.customers c on c.id = d.customer_id
     where (d.doc_type = 'invoice' and d.status in ('issued', 'paid'))
        or (d.doc_type = 'credit_note' and d.status = 'issued')
     group by c.id, c.name
    having sum(case when d.doc_type = 'invoice' then d.subtotal else -d.subtotal end) > 0
     order by 2 desc
     limit 8
  ),
  owed as (
    select i.due_date,
           i.total - coalesce((select sum(cn.total) from public.sales_documents cn
                                where cn.source_document_id = i.id and cn.doc_type = 'credit_note'
                                  and cn.status = 'issued'), 0) as balance
      from public.sales_documents i
     where i.doc_type = 'invoice' and i.status = 'issued'
       and (p_owner is null or i.owner_id = p_owner)
  )
  select jsonb_build_object(
    'months', coalesce((select jsonb_agg(to_jsonb(m) order by m.month) from monthly m), '[]'::jsonb),
    'quotes', (select to_jsonb(q) from quotes q),
    'top', coalesce((select jsonb_agg(jsonb_build_object('name', t.name, 'value', t.value) order by t.value desc) from top_customers t), '[]'::jsonb),
    'owed', (select jsonb_build_object(
               'not_due', coalesce(sum(balance) filter (where due_date is null or due_date >= current_date), 0),
               'd30', coalesce(sum(balance) filter (where current_date - due_date between 1 and 30), 0),
               'd60', coalesce(sum(balance) filter (where current_date - due_date between 31 and 60), 0),
               'd90', coalesce(sum(balance) filter (where current_date - due_date between 61 and 90), 0),
               'over90', coalesce(sum(balance) filter (where current_date - due_date > 90), 0))
               from owed where balance > 0)
  );
$$;

create or replace function public.team_month_stats(p_from date, p_to date)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with docs as (
    select d.* from public.sales_documents d where d.status <> 'draft'
  ),
  per_owner as (
    select d.owner_id,
           -- invoiced in the range, after credit notes
           coalesce(sum(d.subtotal) filter (where d.doc_type = 'invoice' and d.status in ('issued', 'paid') and d.issue_date between p_from and p_to), 0)
           - coalesce(sum(d.subtotal) filter (where d.doc_type = 'credit_note' and d.status = 'issued' and d.issue_date between p_from and p_to), 0) as invoiced,
           -- cost of what was invoiced, after credit notes
           coalesce(sum(d.cost_total) filter (where d.doc_type = 'invoice' and d.status in ('issued', 'paid') and d.issue_date between p_from and p_to), 0)
           - coalesce(sum(d.cost_total) filter (where d.doc_type = 'credit_note' and d.status = 'issued' and d.issue_date between p_from and p_to), 0) as cost,
           -- paid in the range (for commission "when paid" and cash received)
           coalesce(sum(d.subtotal) filter (where d.doc_type = 'invoice' and d.status = 'paid' and d.paid_at::date between p_from and p_to), 0) as paid_net,
           coalesce(sum(d.cost_total) filter (where d.doc_type = 'invoice' and d.status = 'paid' and d.paid_at::date between p_from and p_to), 0) as paid_cost,
           coalesce(sum(d.total) filter (where d.doc_type = 'invoice' and d.status = 'paid' and d.paid_at::date between p_from and p_to), 0) as paid_gross,
           count(*) filter (where d.doc_type = 'quote' and d.issue_date between p_from and p_to) as quotes_sent,
           coalesce(sum(d.subtotal) filter (where d.doc_type = 'quote' and d.issue_date between p_from and p_to), 0) as quotes_value,
           count(*) filter (where d.doc_type = 'quote' and d.status in ('accepted', 'converted') and d.issue_date between p_from and p_to) as won,
           coalesce(sum(d.subtotal) filter (where d.doc_type = 'quote' and d.status in ('accepted', 'converted') and d.issue_date between p_from and p_to), 0) as won_value,
           count(*) filter (where d.doc_type = 'quote' and d.status = 'declined' and d.issue_date between p_from and p_to) as lost,
           count(*) filter (where d.doc_type = 'quote' and d.status = 'sent') as open_quotes,
           coalesce(sum(d.subtotal) filter (where d.doc_type = 'quote' and d.status = 'sent'), 0) as open_value,
           count(*) filter (where d.doc_type = 'credit_note' and d.status = 'issued' and d.issue_date between p_from and p_to) as credit_notes,
           coalesce(sum(d.total) filter (where d.doc_type = 'credit_note' and d.status = 'issued' and d.issue_date between p_from and p_to), 0) as credit_value
      from docs d
     group by d.owner_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'owner_id', o.owner_id,
           'name', coalesce(p.full_name, p.email, 'No salesperson'),
           'invoiced', o.invoiced, 'cost', o.cost,
           'paid_net', o.paid_net, 'paid_cost', o.paid_cost, 'paid_gross', o.paid_gross,
           'quotes_sent', o.quotes_sent, 'quotes_value', o.quotes_value,
           'won', o.won, 'won_value', o.won_value, 'lost', o.lost,
           'open_quotes', o.open_quotes, 'open_value', o.open_value,
           'credit_notes', o.credit_notes, 'credit_value', o.credit_value)
           order by o.invoiced desc), '[]'::jsonb)
    from per_owner o
    left join public.profiles p on p.id = o.owner_id;
$$;
