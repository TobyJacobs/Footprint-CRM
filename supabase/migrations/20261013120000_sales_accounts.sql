-- Sales accounts on products and lines (owner request, 5 October 2026).
--
-- Plain-English summary:
-- * `sales_accounts`: the income accounts from the chart of accounts (the same
--   codes Zoho Books and Xero use, e.g. 4010 Print Outsource), so a product's
--   sales account can be picked from a list.
-- * Each product has a sales account (copied from Zoho Books).
-- * Quote, order, invoice, credit note and recurring lines record the
--   account code from their product automatically (`account_code`), so the
--   Xero sync can post each line to the right income account.

create table public.sales_accounts (
  code    text primary key,
  name    text not null,
  active  boolean not null default true
);
alter table public.sales_accounts enable row level security;
create policy "View sales accounts" on public.sales_accounts for select to authenticated
  using (public.has_permission('quotes', 'view'));
create policy "Admins manage sales accounts" on public.sales_accounts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.sales_accounts from anon;
create trigger audit_sales_accounts after insert or update or delete on public.sales_accounts
  for each row execute function public.audit_row();

-- Income accounts from Zoho Books' chart of accounts (5 October 2026).
insert into public.sales_accounts (code, name) values
  ('200', 'Sales (200)'),
  ('201', 'Sales (201)'),
  ('270', 'PDQ / card and Stripe fees'),
  ('4000', 'Leaflet Design'),
  ('4001', 'Leaflet Distribution'),
  ('4002', 'Leaflet Print Income'),
  ('4003', 'Magazine Advertising'),
  ('4004', 'Artwork Design'),
  ('4005', 'Clothing'),
  ('4006', 'Digital Sales - Project'),
  ('4007', 'Digital Sales - Recurring'),
  ('4008', 'Merchandise'),
  ('4009', 'Print In House'),
  ('4010', 'Print Outsource'),
  ('4011', 'Signage'),
  ('4012', 'Delivery'),
  ('4014', 'Merchandise Revenue 2023'),
  ('4016', 'Revenue from Artwork Design 2023'),
  ('4017', 'Revenue under £10 from 2023'),
  ('4109', 'Shipping charges'),
  ('4200', 'Sale of Assets'),
  ('4400', 'Credit charges (late payments)'),
  ('4900', 'Miscellaneous income'),
  ('4901', 'Royalties received'),
  ('4902', 'Commissions received'),
  ('4903', 'Insurance claims'),
  ('4904', 'Rent income'),
  ('4909', 'Other income (4909)')
on conflict (code) do nothing;

alter table public.products
  add column sales_account_code text references public.sales_accounts (code) on update cascade on delete set null;

alter table public.sales_document_lines add column account_code text;
alter table public.recurring_invoice_lines add column account_code text;

-- Copy the product's sales account onto the line (like the product number).
create function public.set_line_account_code()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.product_id is null then
    null;  -- typed-in lines keep whatever was set (Xero falls back to the customer's or default account)
  elsif new.account_code is null or (tg_op = 'UPDATE' and new.product_id is distinct from old.product_id) then
    new.account_code := (select p.sales_account_code from public.products p where p.id = new.product_id);
  end if;
  return new;
end;
$$;
revoke execute on function public.set_line_account_code() from anon, authenticated, public;

create trigger sales_document_lines_account_code before insert or update of product_id on public.sales_document_lines
  for each row execute function public.set_line_account_code();
create trigger recurring_invoice_lines_account_code before insert or update of product_id on public.recurring_invoice_lines
  for each row execute function public.set_line_account_code();
