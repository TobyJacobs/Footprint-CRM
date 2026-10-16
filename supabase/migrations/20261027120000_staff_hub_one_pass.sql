-- Faster Staff hub, take two (15 October 2026).
--
-- Plain-English summary: team_stats_history worked out each month one after
-- another, reading every document each time, which made the Staff hub slower.
-- This version reads the documents once and works out every month in the same
-- pass. Same figures as team_month_stats (checked when applied). Runs as the
-- person asking, so sales staff still only see their own figures.

create or replace function public.team_stats_history(p_ranges jsonb)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with ranges as (
    select r ->> 'key' as key, (r ->> 'from')::date as f, (r ->> 'to')::date as t
      from jsonb_array_elements(p_ranges) r
  ),
  docs as materialized (
    select d.owner_id, d.doc_type, d.status, d.issue_date, d.paid_at::date as paid_on, d.subtotal, d.cost_total, d.total
      from public.sales_documents d
     where d.status <> 'draft'
  ),
  per_owner as (
    select g.key, d.owner_id,
           coalesce(sum(d.subtotal) filter (where d.doc_type = 'invoice' and d.status in ('issued', 'paid') and d.issue_date between g.f and g.t), 0)
           - coalesce(sum(d.subtotal) filter (where d.doc_type = 'credit_note' and d.status = 'issued' and d.issue_date between g.f and g.t), 0) as invoiced,
           coalesce(sum(d.cost_total) filter (where d.doc_type = 'invoice' and d.status in ('issued', 'paid') and d.issue_date between g.f and g.t), 0)
           - coalesce(sum(d.cost_total) filter (where d.doc_type = 'credit_note' and d.status = 'issued' and d.issue_date between g.f and g.t), 0) as cost,
           coalesce(sum(d.subtotal) filter (where d.doc_type = 'invoice' and d.status = 'paid' and d.paid_on between g.f and g.t), 0) as paid_net,
           coalesce(sum(d.cost_total) filter (where d.doc_type = 'invoice' and d.status = 'paid' and d.paid_on between g.f and g.t), 0) as paid_cost,
           coalesce(sum(d.total) filter (where d.doc_type = 'invoice' and d.status = 'paid' and d.paid_on between g.f and g.t), 0) as paid_gross,
           count(*) filter (where d.doc_type = 'quote' and d.issue_date between g.f and g.t) as quotes_sent,
           coalesce(sum(d.subtotal) filter (where d.doc_type = 'quote' and d.issue_date between g.f and g.t), 0) as quotes_value,
           count(*) filter (where d.doc_type = 'quote' and d.status in ('accepted', 'converted') and d.issue_date between g.f and g.t) as won,
           coalesce(sum(d.subtotal) filter (where d.doc_type = 'quote' and d.status in ('accepted', 'converted') and d.issue_date between g.f and g.t), 0) as won_value,
           count(*) filter (where d.doc_type = 'quote' and d.status = 'declined' and d.issue_date between g.f and g.t) as lost,
           count(*) filter (where d.doc_type = 'quote' and d.status = 'sent') as open_quotes,
           coalesce(sum(d.subtotal) filter (where d.doc_type = 'quote' and d.status = 'sent'), 0) as open_value,
           count(*) filter (where d.doc_type = 'credit_note' and d.status = 'issued' and d.issue_date between g.f and g.t) as credit_notes,
           coalesce(sum(d.total) filter (where d.doc_type = 'credit_note' and d.status = 'issued' and d.issue_date between g.f and g.t), 0) as credit_value
      from ranges g
      cross join docs d
     group by g.key, d.owner_id
  ),
  per_month as (
    select o.key,
           jsonb_agg(jsonb_build_object(
             'owner_id', o.owner_id,
             'name', coalesce(p.full_name, p.email, 'No salesperson'),
             'invoiced', o.invoiced, 'cost', o.cost,
             'paid_net', o.paid_net, 'paid_cost', o.paid_cost, 'paid_gross', o.paid_gross,
             'quotes_sent', o.quotes_sent, 'quotes_value', o.quotes_value,
             'won', o.won, 'won_value', o.won_value, 'lost', o.lost,
             'open_quotes', o.open_quotes, 'open_value', o.open_value,
             'credit_notes', o.credit_notes, 'credit_value', o.credit_value)
             order by o.invoiced desc) as rows
      from per_owner o
      left join public.profiles p on p.id = o.owner_id
     group by o.key
  )
  select coalesce(jsonb_object_agg(g.key, coalesce(m.rows, '[]'::jsonb)), '{}'::jsonb)
    from ranges g
    left join per_month m on m.key = g.key;
$$;
