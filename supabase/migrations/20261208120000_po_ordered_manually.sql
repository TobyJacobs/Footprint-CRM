-- Purchase orders placed without email (DJ, 11 November 2026).
--
-- Plain-English summary:
-- * A purchase order can be marked "ordered manually": by phone, on the
--   supplier's website, in person or another way, with an optional note. It
--   records how, who and when (the "when" is the existing sent date).
-- * Emailing a PO to the supplier records "email" as how it was ordered.

alter table public.purchase_orders
  add column ordered_via  text check (ordered_via in ('email', 'phone', 'website', 'in_person', 'other')),
  add column ordered_note text check (ordered_note is null or length(ordered_note) <= 500),
  add column ordered_by   uuid references public.profiles (id) on delete set null;
create index purchase_orders_ordered_by_idx on public.purchase_orders (ordered_by);
