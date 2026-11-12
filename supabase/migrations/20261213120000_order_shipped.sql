-- "Shipped" on sales orders (DJ, 12 November 2026).
--
-- Plain-English summary:
-- * A sales order can be marked as shipped. It records when and by whom, and
--   the order's progress bar shows a Shipped step after In production. It can
--   be undone.

alter table public.sales_documents
  add column shipped_at timestamptz,
  add column shipped_by uuid references public.profiles (id) on delete set null;
create index sales_documents_shipped_by_idx on public.sales_documents (shipped_by);
