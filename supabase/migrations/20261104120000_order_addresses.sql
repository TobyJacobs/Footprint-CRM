-- 26 October 2026 (owner): a sales order has its own billing address, delivery
-- address ("where to deliver to") and delivery notes. They start as the
-- customer's addresses and can be changed on the order; the billing address is
-- carried to the invoice. Older documents leave them empty and keep showing
-- the customer's billing address.

alter table public.sales_documents
  add column billing_address  text check (billing_address is null or length(billing_address) <= 1000),
  add column delivery_address text check (delivery_address is null or length(delivery_address) <= 1000),
  add column delivery_notes   text check (delivery_notes is null or length(delivery_notes) <= 1000);

-- The customer's view of an order or invoice uses them too.
create or replace function public.get_public_document(p_token uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'doc_type', d.doc_type,
    'number', d.number,
    'title', d.title,
    'status', d.status,
    'issue_date', d.issue_date,
    'due_date', d.due_date,
    'customer_reference', d.customer_reference,
    'credit_reason', d.credit_reason,
    'notes', d.notes,
    'terms', d.terms,
    'subtotal', d.subtotal,
    'vat_total', d.vat_total,
    'total', d.total,
    'customer_name', c.name,
    -- The document's own billing address if it has one, else the customer's.
    'customer_address', coalesce(nullif(trim(d.billing_address), ''),
                                 concat_ws(chr(10), c.billing_street, c.billing_city, c.billing_county, c.billing_postcode)),
    'delivery_address', case when d.doc_type = 'sales_order' then nullif(trim(d.delivery_address), '') end,
    'delivery_notes', case when d.doc_type = 'sales_order' then nullif(trim(d.delivery_notes), '') end,
    'contact_name', nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
               'description', l.description, 'quantity', l.quantity, 'unit_price', l.unit_price,
               'discount_percent', l.discount_percent, 'tax_rate', l.tax_rate,
               'line_net', l.line_net) order by l.position)
        from public.sales_document_lines l where l.document_id = d.id), '[]'::jsonb),
    'company', (select jsonb_build_object(
                  'company_name', s.company_name, 'address', s.address, 'phone', s.phone,
                  'email', s.email, 'website', s.website, 'vat_number', s.vat_number,
                  'company_number', s.company_number,
                  'bank_details', case when d.doc_type = 'invoice' then s.bank_details end)
                  from public.company_settings s)
  )
  from public.sales_documents d
  join public.customers c on c.id = d.customer_id
  left join public.contacts p on p.id = d.contact_id
  where d.public_token = p_token
    and d.doc_type in ('invoice', 'credit_note', 'sales_order')
    and d.status <> 'draft';
$$;
