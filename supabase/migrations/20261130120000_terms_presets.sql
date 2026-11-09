-- Terms presets (9 November 2026, DJ: "add presets for terms in proposals etc").
--
-- Plain-English summary:
-- * Named sets of terms and conditions (e.g. "Standard proposal terms",
--   "Website build terms") that staff pick from a dropdown to fill the Terms
--   box on a quote, advertising quote, proposal, sales order or invoice, then
--   edit if needed. Each preset says which of those it's offered on.
-- * Admins manage them in Admin → Terms (like email templates); anyone who
--   can see sales can use them.
-- * Starts with the quote builder's standard proposal terms, plus the
--   company's current quote, order and invoice terms (from Company settings).

create table public.terms_presets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) between 1 and 100),
  body        text not null check (length(trim(body)) between 1 and 20000),
  applies_to  text[] not null default '{quote,advertising,proposal,sales_order,invoice}'
              check (applies_to <@ array['quote', 'advertising', 'proposal', 'sales_order', 'invoice'] and cardinality(applies_to) > 0),
  active      boolean not null default true,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
alter table public.terms_presets enable row level security;
create policy "Staff read terms presets" on public.terms_presets for select to authenticated
  using ((select public.has_permission('quotes', 'view')));
create policy "Admins manage terms presets" on public.terms_presets for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.terms_presets from anon;
create trigger terms_presets_touch before update on public.terms_presets for each row execute function public.touch_row();
create trigger audit_terms_presets after insert or update or delete on public.terms_presets for each row execute function public.audit_row();

insert into public.terms_presets (name, body, applies_to, position) values
  ('Standard proposal terms', E'1. This quotation is valid for 30 days from the date issued unless otherwise stated.
2. All prices are shown exclusive of VAT, which is charged at the prevailing rate.
3. A deposit or first instalment may be required before work commences; full payment terms will be confirmed on order.
4. One-off project costs may be split into instalments as selected on this quote; ongoing subscription/monthly costs are billed separately and continue until cancelled with notice.
5. Ownership of final artwork, website files and deliverables transfers to the client upon receipt of payment in full.
6. Any changes to the agreed scope of work may be subject to additional charges, to be agreed in writing before proceeding.
7. Cancellation of ongoing services requires 30 days'' written notice.
8. This quotation does not constitute a contract. A formal agreement will be issued upon acceptance.', array['proposal'], 1);
insert into public.terms_presets (name, body, applies_to, position)
  select 'Standard quote terms', quote_terms, array['quote', 'advertising'], 2 from public.company_settings where coalesce(trim(quote_terms), '') <> '';
insert into public.terms_presets (name, body, applies_to, position)
  select 'Standard order terms', order_terms, array['sales_order'], 3 from public.company_settings where coalesce(trim(order_terms), '') <> '';
insert into public.terms_presets (name, body, applies_to, position)
  select 'Standard invoice terms', invoice_terms, array['invoice'], 4 from public.company_settings where coalesce(trim(invoice_terms), '') <> '';
