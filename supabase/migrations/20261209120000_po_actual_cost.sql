-- What a purchase order line should cost vs what we bought it for (DJ,
-- 11 November 2026).
--
-- Plain-English summary:
-- * Each purchase order line already has its expected cost ("what it should
--   cost"). It now also has an optional actual cost each ("how much we bought
--   it for"), entered when the goods or the supplier's bill arrive. The
--   purchase order shows both and the difference.
-- * The PO's subtotal and totals stay based on the expected cost (what was
--   ordered); the actual figures are worked out from the lines.

alter table public.purchase_order_lines
  add column actual_unit_cost numeric(12,2) check (actual_unit_cost is null or actual_unit_cost >= 0),
  add column actual_line_net  numeric(12,2) generated always as (round(quantity * actual_unit_cost, 2)) stored;
