-- Director's improvements (item 8): email purchase orders to suppliers.
--
-- Plain-English summary: the email log can now record emails about a purchase
-- order as well as about a quote, order or invoice.

alter table public.email_log
  add column purchase_order_id uuid references public.purchase_orders (id) on delete set null;

create index email_log_po_idx on public.email_log (purchase_order_id, sent_at desc);
