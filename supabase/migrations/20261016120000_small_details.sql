-- A batch of small details (owner list, 5 October 2026).
--
-- Plain-English summary:
-- 1. GP override: on a quote, order or invoice, the operations team (and
--    admins) can set the gross profit to a figure they know is right when the
--    calculated one is wrong. It records who and why, and can be removed.
-- 5. Services follow orders: when a sales order has lines for, say, a print
--    product, the customer's "services" get Print ticked automatically (and
--    "date last ordered" is updated). Which products mean which service is in
--    two small tables an admin can change.
-- 6. Customer status is now just Active or Cancelled; existing customers are
--    moved across.
-- 8. Email templates for customer emails (e.g. setting up a Direct Debit),
--    and customer emails can now be logged without a document.
-- 3. Files and images on roadmap requests: a private storage bucket plus a
--    table listing each attachment.

-- ─── 1. GP override ─────────────────────────────────────────────────────────

alter table public.sales_documents
  add column gp_override         numeric(12,2),
  add column gp_override_reason  text,
  add column gp_override_by      uuid references public.profiles (id) on delete set null,
  add column gp_override_at      timestamptz;

create function public.can_override_gp()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or 'operations' = any(public.my_dashboards());
$$;

-- Totals: when a GP override is set, cost is whatever makes gross profit equal it.
create or replace function public.recalc_sales_document()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  doc uuid := coalesce(new.document_id, old.document_id);
  sub numeric(12,2);
begin
  select coalesce(sum(line_net), 0) into sub from public.sales_document_lines where document_id = doc;
  update public.sales_documents d set
    subtotal   = sub,
    vat_total  = coalesce((select sum(line_vat) from public.sales_document_lines where document_id = doc), 0),
    total      = coalesce((select sum(line_net + line_vat) from public.sales_document_lines where document_id = doc), 0),
    cost_total = case when d.gp_override is not null then sub - d.gp_override
                      else coalesce((select sum(line_cost) from public.sales_document_lines where document_id = doc), 0) end
  where d.id = doc;
  return null;
end;
$$;

create function public.apply_gp_override()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.can_override_gp() then
    raise exception 'Only the operations team and admins can override gross profit';
  end if;
  if new.gp_override is not null then
    if new.gp_override_reason is null or length(trim(new.gp_override_reason)) = 0 then
      raise exception 'Please give a reason for the override';
    end if;
    new.cost_total := new.subtotal - new.gp_override;
    new.gp_override_by := auth.uid();
    new.gp_override_at := now();
  else
    new.gp_override_reason := null;
    new.gp_override_by := null;
    new.gp_override_at := null;
    new.cost_total := coalesce((select sum(line_cost) from public.sales_document_lines where document_id = new.id), 0);
  end if;
  return new;
end;
$$;
create trigger sales_documents_gp_override before update of gp_override, gp_override_reason on public.sales_documents
  for each row execute function public.apply_gp_override();

revoke execute on function public.can_override_gp() from anon, public;
grant execute on function public.can_override_gp() to authenticated;

-- ─── 5. Services follow orders ──────────────────────────────────────────────

create table public.account_services (
  account_code  text primary key references public.sales_accounts (code) on update cascade on delete cascade,
  service       text not null
);
create table public.product_service_keywords (
  keyword  text primary key check (keyword = lower(keyword)),
  service  text not null
);
alter table public.account_services enable row level security;
alter table public.product_service_keywords enable row level security;
create policy "View service map" on public.account_services for select to authenticated using (true);
create policy "Admins edit service map" on public.account_services for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "View keyword map" on public.product_service_keywords for select to authenticated using (true);
create policy "Admins edit keyword map" on public.product_service_keywords for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.account_services, public.product_service_keywords from anon;

insert into public.account_services (account_code, service) values
  ('4000', 'Print'), ('4001', 'Advertising'), ('4002', 'Print'), ('4003', 'Advertising'),
  ('4004', 'Print'), ('4005', 'Merchandise'), ('4006', 'Digital Marketing'), ('4007', 'Digital Marketing'),
  ('4008', 'Merchandise'), ('4009', 'Print'), ('4010', 'Print'), ('4011', 'Signage'),
  ('4014', 'Merchandise'), ('4016', 'Print');
insert into public.product_service_keywords (keyword, service) values
  ('website', 'Web'), ('hosting', 'Web'), ('domain', 'Web'),
  ('social media', 'Social'), ('social ads', 'Social'),
  ('vehicle', 'Vehicle Graphics'), ('van graphics', 'Vehicle Graphics'),
  ('lead kit', 'YLK');

create function public.services_for_line(p_account_code text, p_product_name text)
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(distinct s), '{}') from (
    select service as s from public.account_services where account_code = p_account_code
    union
    select service from public.product_service_keywords where lower(coalesce(p_product_name, '')) like '%' || keyword || '%'
  ) x;
$$;

-- When a sales order gets a line, add the matching services to the customer.
create function public.tick_services_from_order()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  d record;
  matched text[];
  pname text;
begin
  select doc_type, customer_id into d from public.sales_documents where id = new.document_id;
  if d.doc_type is distinct from 'sales_order' then
    return new;
  end if;
  select name into pname from public.products where id = new.product_id;
  matched := public.services_for_line(new.account_code, coalesce(pname, new.description));
  update public.customers c set
    services = (select array_agg(distinct x order by x) from unnest(c.services || matched) x),
    date_last_ordered = current_date
  where c.id = d.customer_id
    and (not (c.services @> matched) or c.date_last_ordered is distinct from current_date);
  return new;
end;
$$;
create trigger sales_order_lines_services after insert or update of product_id, description on public.sales_document_lines
  for each row execute function public.tick_services_from_order();

revoke execute on function public.services_for_line(text, text) from anon, public;
revoke execute on function public.tick_services_from_order() from anon, authenticated, public;
grant execute on function public.services_for_line(text, text) to authenticated;

-- ─── 6. Customer status: Active or Cancelled ────────────────────────────────

update public.customers set status = case
  when status in ('Cancelled Services', 'Client Not Active - Awaiting Deletion', 'Client Not Active – Awaiting Deletion') then 'Cancelled'
  when status is null then 'Active'
  else 'Active'
end
where status is distinct from 'Active' and status is distinct from 'Cancelled';

-- ─── 8. Email templates ─────────────────────────────────────────────────────

create table public.email_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) > 0),
  subject     text not null,
  body        text not null,
  active      boolean not null default true,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
alter table public.email_templates enable row level security;
create policy "Staff read templates" on public.email_templates for select to authenticated
  using (public.has_permission('customers', 'view') or public.has_permission('quotes', 'view'));
create policy "Admins manage templates" on public.email_templates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.email_templates from anon;
create trigger email_templates_touch before update on public.email_templates for each row execute function public.touch_row();
create trigger audit_email_templates after insert or update or delete on public.email_templates for each row execute function public.audit_row();

insert into public.email_templates (name, subject, body, position) values
  ('Setting up a Direct Debit',
   'Setting up your Direct Debit with {{our_company}}',
   E'Hi {{first_name}},\n\nThanks for choosing to pay {{company_name}}''s invoices by Direct Debit. It''s the easiest way to pay: once it''s set up, your invoices are collected automatically on their due date, and you don''t need to remember to pay.\n\nWhat happens next:\n1. We''ll send you a separate secure link to set up the Direct Debit.\n2. You enter your bank details on that secure page only. Please never send bank details by email.\n3. Once it''s set up, we''ll confirm by email, and you''ll be told before each collection.\n\nIf you have any questions, just reply to this email.\n\nKind regards,\n{{sender_name}}\n{{our_company}}', 1),
  ('Welcome, new customer',
   'Welcome to {{our_company}}',
   E'Hi {{first_name}},\n\nWelcome to {{our_company}}, and thank you for choosing us. It''s great to have {{company_name}} on board.\n\nYour main contact is {{sender_name}}. If you need anything, just reply to this email or give us a call.\n\nKind regards,\n{{sender_name}}\n{{our_company}}', 2),
  ('Following up a quote',
   'Following up your quote',
   E'Hi {{first_name}},\n\nI wanted to check in on the quote we sent over. Have you had a chance to look at it?\n\nIf you have any questions, or you''d like anything changed, just let me know and I''ll update it straight away.\n\nKind regards,\n{{sender_name}}\n{{our_company}}', 3),
  ('Thank you for your order',
   'Thank you for your order',
   E'Hi {{first_name}},\n\nThank you for your order. We''ve got it in hand and will keep you updated as it moves through production.\n\nIf anything needs to change, please let us know as soon as you can.\n\nKind regards,\n{{sender_name}}\n{{our_company}}', 4),
  ('Payment reminder',
   'A friendly reminder about your invoice',
   E'Hi {{first_name}},\n\nJust a quick reminder that we haven''t yet received payment for your outstanding invoice.\n\nIf you''ve already paid, thank you, and please ignore this email. If there''s a problem, or you''d like to talk about it, just reply and we''ll sort it out.\n\nKind regards,\n{{sender_name}}\n{{our_company}}', 5),
  ('Hosting plan renewal',
   'Your hosting plan is coming up for renewal',
   E'Hi {{first_name}},\n\nYour hosting plan with {{our_company}} is coming up for renewal. There''s nothing you need to do: it will carry on as normal and we''ll send your invoice shortly.\n\nIf you''d like to change anything, or have any questions, just let me know.\n\nKind regards,\n{{sender_name}}\n{{our_company}}', 6);

-- Emails to a customer that aren't about a document (templates) can be logged
-- by anyone who can edit customers, and seen by anyone who can view them.
drop policy "View email log" on public.email_log;
drop policy "Record emails" on public.email_log;
create policy "View email log" on public.email_log for select to authenticated using (
  (public.has_permission('quotes', 'view') and (
    public.sees_all_sales()
    or (sales_document_id is not null and public.can_see_sales_document(sales_document_id))
    or (purchase_order_id is not null and public.can_see_purchase_order(purchase_order_id))
  ))
  or (sales_document_id is null and purchase_order_id is null and public.has_permission('customers', 'view'))
);
create policy "Record emails" on public.email_log for insert to authenticated with check (
  (public.has_permission('quotes', 'edit') and (
    public.sees_all_sales()
    or (sales_document_id is not null and public.can_see_sales_document(sales_document_id))
    or (purchase_order_id is not null and public.can_see_purchase_order(purchase_order_id))
  ))
  or (sales_document_id is null and purchase_order_id is null and public.has_permission('customers', 'edit'))
);

-- ─── 3. Files and images on roadmap requests ────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('request-attachments', 'request-attachments', false, 10485760, array[
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
])
on conflict (id) do nothing;

create policy "Upload own request files" on storage.objects for insert to authenticated
  with check (bucket_id = 'request-attachments' and (storage.foldername(name))[1] = auth.uid()::text and public.can_see_roadmap());
create policy "Read own or (admins) all request files" on storage.objects for select to authenticated
  using (bucket_id = 'request-attachments' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "Admins remove request files" on storage.objects for delete to authenticated
  using (bucket_id = 'request-attachments' and public.is_admin());

create table public.feedback_attachments (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.feedback_requests (id) on delete cascade,
  path          text not null unique,
  file_name     text not null,
  size_bytes    bigint,
  content_type  text,
  uploaded_by   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at    timestamptz not null default now()
);
create index feedback_attachments_request_idx on public.feedback_attachments (request_id);
alter table public.feedback_attachments enable row level security;
create policy "View attachments on visible requests" on public.feedback_attachments for select to authenticated
  using (exists (select 1 from public.feedback_requests r where r.id = request_id));
create policy "Attach to own requests" on public.feedback_attachments for insert to authenticated
  with check (uploaded_by = auth.uid() and exists (select 1 from public.feedback_requests r where r.id = request_id and r.submitted_by = auth.uid()));
create policy "Admins remove attachments" on public.feedback_attachments for delete to authenticated using (public.is_admin());
revoke all on public.feedback_attachments from anon;

-- ─── Back-fill for existing orders (test data) ──────────────────────────────

update public.customers c set services = (
  select array_agg(distinct x order by x) from unnest(c.services || coalesce((
    select array_agg(distinct s) from public.sales_document_lines l
      join public.sales_documents d on d.id = l.document_id and d.doc_type = 'sales_order' and d.customer_id = c.id
      cross join lateral unnest(public.services_for_line(l.account_code, l.description)) s
  ), '{}')) x)
where exists (select 1 from public.sales_documents d where d.customer_id = c.id and d.doc_type = 'sales_order');
