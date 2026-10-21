-- Opportunity types (20 October 2026).
--
-- Plain-English summary:
-- * A new opportunity is now one of three types: a standard Quote, an
--   Advertising quote (advert space in Forget Me Not) or a Proposal (a bigger
--   piece of work). Each type has its own version of the quote page.
-- * The type is saved on the quote so lists and pages can show it. Existing
--   quotes are standard quotes. It's carried over when a quote becomes an
--   order or invoice (it has no effect there yet).

alter table public.sales_documents
  add column quote_kind text not null default 'quote'
  check (quote_kind in ('quote', 'advertising', 'proposal'));
