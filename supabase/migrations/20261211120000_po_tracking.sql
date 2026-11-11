-- Delivery tracking on purchase orders (DJ, 11 November 2026).
--
-- Plain-English summary:
-- * A purchase order can hold the courier's tracking link and an optional
--   note (courier name or tracking number). The page shows a "Track delivery"
--   button. Only ordinary web links (http/https) are accepted.

alter table public.purchase_orders
  add column tracking_url  text check (tracking_url is null or (tracking_url ~* '^https?://[^[:space:]]+$' and length(tracking_url) <= 1000)),
  add column tracking_note text check (tracking_note is null or length(tracking_note) <= 200);
