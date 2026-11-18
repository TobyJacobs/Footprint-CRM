-- Proposals like the quote builder (9 November 2026, DJ: "proposals need to
-- mimic quotes.footprintgroup.uk").
--
-- Plain-English summary:
-- * Each product and each quote line is one-off, monthly or included (free,
--   shown as part of the package). Proposals show one-off and monthly totals
--   separately.
-- * Products can belong to a catalogue group (e.g. Website, Hosting, YLK
--   Add-Ons); proposals pick from the catalogue by group.
-- * A proposal can spread its one-off costs over 3, 6 or 9 months at 0%, and
--   ask for a 25% or 50% deposit on acceptance. Monthly costs are billed
--   separately. The payment schedule is shown to the customer; invoices are
--   still raised by staff (owner, 9 November 2026).
-- * The customer's quote page is given the line types, the plan, the deposit
--   and who prepared it.

alter table public.products
  add column billing text not null default 'oneoff' check (billing in ('oneoff', 'monthly', 'included')),
  add column category text check (category is null or length(trim(category)) between 1 and 60);
create index products_category_idx on public.products (category) where category is not null;

alter table public.sales_document_lines
  add column billing text not null default 'oneoff' check (billing in ('oneoff', 'monthly', 'included'));

alter table public.sales_documents
  add column plan_months integer check (plan_months in (3, 6, 9)),
  add column deposit_percent integer not null default 0 check (deposit_percent in (0, 25, 50));

-- The customer's quote page, now with the line types, plan, deposit and who
-- prepared it (otherwise as before).
create or replace function public.get_quote_by_token(p_token uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'number', d.number,
    'title', d.title,
    'status', d.status,
    'issue_date', d.issue_date,
    'valid_until', d.valid_until,
    'customer_reference', d.customer_reference,
    'notes', d.notes,
    'terms', d.terms,
    'subtotal', d.subtotal,
    'vat_total', d.vat_total,
    'total', d.total,
    'responded_at', d.responded_at,
    'response_name', d.response_name,
    'customer_name', c.name,
    'contact_name', nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
               'description', l.description, 'quantity', l.quantity, 'unit_price', l.unit_price,
               'discount_percent', l.discount_percent, 'tax_rate', l.tax_rate,
               'line_net', l.line_net, 'billing', l.billing) order by l.position)
        from public.sales_document_lines l where l.document_id = d.id), '[]'::jsonb),
    'quote_kind', d.quote_kind,
    'plan_months', d.plan_months,
    'deposit_percent', d.deposit_percent,
    'prepared_by', (select nullif(trim(coalesce(o.full_name, '')), '') from public.profiles o where o.id = d.owner_id),
    'first_advert_month', (select min(i.month) from public.sales_document_lines l
                             join public.magazine_issues i on i.id = l.magazine_issue_id
                            where l.document_id = d.id),
    'company', (select jsonb_build_object(
                  'company_name', s.company_name, 'address', s.address, 'phone', s.phone,
                  'email', s.email, 'website', s.website, 'vat_number', s.vat_number,
                  'company_number', s.company_number)
                  from public.company_settings s)
  )
  from public.sales_documents d
  join public.customers c on c.id = d.customer_id
  left join public.contacts p on p.id = d.contact_id
  where d.public_token = p_token
    and d.doc_type = 'quote'
    and d.status in ('sent', 'accepted', 'declined', 'converted');
$$;
