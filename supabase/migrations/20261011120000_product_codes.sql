-- Product numbers on every line (owner request, 5 October 2026).
--
-- Plain-English summary: quote, order, invoice, credit note, recurring and
-- purchase order lines get a `product_code`: the product number (SKU) copied
-- from Zoho. The database fills it in automatically from the chosen product,
-- so it travels from quote to order to invoice, and on to Xero, which matches
-- items by this number.

alter table public.sales_document_lines add column product_code text;
alter table public.recurring_invoice_lines add column product_code text;
alter table public.purchase_order_lines add column product_code text;

create function public.set_line_product_code()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.product_id is null then
    new.product_code := null;
  elsif new.product_code is null or (tg_op = 'UPDATE' and new.product_id is distinct from old.product_id) then
    new.product_code := (select nullif(trim(p.sku), '') from public.products p where p.id = new.product_id);
  end if;
  return new;
end;
$$;
revoke execute on function public.set_line_product_code() from anon, authenticated, public;

create trigger sales_document_lines_product_code before insert or update of product_id on public.sales_document_lines
  for each row execute function public.set_line_product_code();
create trigger recurring_invoice_lines_product_code before insert or update of product_id on public.recurring_invoice_lines
  for each row execute function public.set_line_product_code();
create trigger purchase_order_lines_product_code before insert or update of product_id on public.purchase_order_lines
  for each row execute function public.set_line_product_code();

-- Fill in existing lines.
update public.sales_document_lines l set product_code = nullif(trim(p.sku), '') from public.products p where p.id = l.product_id;
update public.recurring_invoice_lines l set product_code = nullif(trim(p.sku), '') from public.products p where p.id = l.product_id;
update public.purchase_order_lines l set product_code = nullif(trim(p.sku), '') from public.products p where p.id = l.product_id;

create index products_sku_idx on public.products (lower(sku));
