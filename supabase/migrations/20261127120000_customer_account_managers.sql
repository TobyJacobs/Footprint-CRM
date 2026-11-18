-- Account managers per area (9 November 2026, DJ's improvements).
--
-- Plain-English summary:
-- * A customer keeps one main account manager (the existing "account owner")
--   and can also have an account manager for each area of the business:
--   Advertising, Marketing, Print/Merch, Signage and Footprint AI.
-- * Seen by anyone who can see customers; set by anyone who can edit them.
--   Removing a member of staff removes them as an area's account manager.

create table public.customer_account_managers (
  customer_id  uuid not null references public.customers (id) on delete cascade,
  area         text not null check (area in ('Advertising', 'Marketing', 'Print/Merch', 'Signage', 'Footprint AI')),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  primary key (customer_id, area)
);
create index customer_account_managers_profile_idx on public.customer_account_managers (profile_id);

alter table public.customer_account_managers enable row level security;
create policy "View account managers" on public.customer_account_managers for select to authenticated
  using ((select public.has_permission('customers', 'view')));
create policy "Set account managers" on public.customer_account_managers for all to authenticated
  using ((select public.has_permission('customers', 'edit'))) with check ((select public.has_permission('customers', 'edit')));
create trigger customer_account_managers_touch before update on public.customer_account_managers
  for each row execute function public.touch_row();
create trigger audit_customer_account_managers after insert or update or delete on public.customer_account_managers
  for each row execute function public.audit_row();
