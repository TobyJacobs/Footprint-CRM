-- How many we actually bought on a purchase order line (DJ, 11 November 2026:
-- e.g. a supplier only had 5 in stock but we needed 10).
--
-- Plain-English summary:
-- * Each purchase order line can record the quantity bought, if it's different
--   from the quantity ordered. Blank means "as ordered".
-- * What we bought it for is now worked out on the quantity bought, so the
--   comparison with what it should cost stays fair.
-- * The shortfall can be ordered from another supplier on a new purchase order
--   (done in the app).

alter table public.purchase_order_lines
  add column bought_quantity numeric(12,3) check (bought_quantity is null or bought_quantity >= 0);

alter table public.purchase_order_lines drop column actual_line_net;
alter table public.purchase_order_lines
  add column actual_line_net numeric(12,2) generated always as (round(coalesce(bought_quantity, quantity) * actual_unit_cost, 2)) stored;
