-- "No project needed" on sales orders (DJ, 11 November 2026: most orders
-- don't have projects).
--
-- Plain-English summary:
-- * A sales order can be marked "No project needed". Its stage bar then shows
--   the Project step as not needed instead of waiting for one, so the order
--   moves on to the next step. It can be undone, and a project can still be
--   created later.

alter table public.sales_documents
  add column project_not_needed boolean not null default false;
