-- Cross-sell on the customer page (owner, 20 November 2026).
-- Footprint's services are shown as bought or an opportunity. Someone can mark
-- an opportunity "Not interested" (with an optional reason) so it stops being
-- suggested; this table remembers that. People who can see customers can read
-- it; people who can edit customers or quotes can change it.

create table public.customer_cross_sell_dismissals (
  customer_id  uuid not null references public.customers (id) on delete cascade,
  service      text not null check (service in ('Print', 'Digital Marketing', 'Web', 'Social', 'Advertising', 'Signage', 'Vehicle Graphics', 'Merchandise', 'YLK')),
  reason       text check (reason is null or length(reason) <= 300),
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  primary key (customer_id, service)
);

alter table public.customer_cross_sell_dismissals enable row level security;
create policy "View cross-sell" on public.customer_cross_sell_dismissals for select to authenticated
  using ((select public.has_permission('customers', 'view')));
create policy "Change cross-sell" on public.customer_cross_sell_dismissals for all to authenticated
  using ((select public.has_permission('customers', 'edit')) or (select public.has_permission('quotes', 'edit')))
  with check ((select public.has_permission('customers', 'edit')) or (select public.has_permission('quotes', 'edit')));
create trigger audit_customer_cross_sell_dismissals after insert or update or delete on public.customer_cross_sell_dismissals
  for each row execute function public.audit_row();
