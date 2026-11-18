-- Wave 2c (part 2): emailing documents.
--
-- Plain-English summary:
-- * `email_log` records every email the platform sends: who to, subject,
--   which document, whether Postmark accepted it, and who sent it.
-- * `get_public_document` lets someone holding a document's private link view
--   an invoice, credit note or sales order (read-only) without signing in —
--   like the quote approval link. Drafts are never shown.

create table public.email_log (
  id                   uuid primary key default gen_random_uuid(),
  sales_document_id    uuid references public.sales_documents (id) on delete set null,
  customer_id          uuid references public.customers (id) on delete set null,
  to_addresses         text not null,
  cc_addresses         text,
  subject              text not null,
  body                 text,
  status               text not null check (status in ('sent', 'failed', 'test')),
  provider_message_id  text,
  error                text,
  sent_by              uuid default auth.uid() references public.profiles (id) on delete set null,
  sent_at              timestamptz not null default now()
);

create index email_log_doc_idx on public.email_log (sales_document_id, sent_at desc);
create index email_log_customer_idx on public.email_log (customer_id, sent_at desc);

alter table public.email_log enable row level security;
create policy "View email log" on public.email_log for select to authenticated using (public.has_permission('quotes', 'view'));
create policy "Record emails" on public.email_log for insert to authenticated with check (public.has_permission('quotes', 'edit'));
revoke all on public.email_log from anon;

create trigger audit_email_log after insert on public.email_log
  for each row execute function public.audit_row();

-- Read-only view of a non-draft invoice, credit note or sales order by its
-- private link. Quotes keep using get_quote_by_token (which can accept).
create function public.get_public_document(p_token uuid)
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
    'customer_address', concat_ws(chr(10), c.billing_street, c.billing_city, c.billing_county, c.billing_postcode),
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

revoke execute on function public.get_public_document(uuid) from public;
grant execute on function public.get_public_document(uuid) to anon, authenticated;
