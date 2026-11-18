-- Spot possible duplicate customers (owner request, 5 October 2026).
--
-- Plain-English summary:
-- * Each customer gets three "match keys", worked out automatically:
--   - name key: the name in lower case without punctuation, spaces and common
--     extras like "Ltd", "Limited", "PLC", "The", "&"/"and", "UK"
--     (so "Itchen Vets" and "Itchen Vets Ltd." match);
--   - phone key: the last 10 digits of the phone number (+44 / 0 don't matter);
--   - email key: the email address in lower case.
-- * Two customers are a "possible duplicate" if any key matches, unless
--   someone has marked the pair as "not a duplicate" (e.g. two branches).
-- * `customers_with_flags` is the customer list plus a "possible duplicate"
--   flag, for lists and searches. It runs as the person asking, so the
--   normal permission rules still apply.
-- * `customer_duplicates(ids)` lists the matching records and why.

create function public.customer_name_key(p_name text)
returns text
language sql immutable set search_path = ''
as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(coalesce(p_name, '')), '&', ' and ', 'g'),
        '[^a-z0-9]+', ' ', 'g'),
      '(^| )(the|ltd|limited|plc|llp|llc|inc|co|company|and|uk)(?= |$)|\s+', '', 'g'),
    '');
$$;

create function public.customer_phone_key(p_phone text)
returns text
language sql immutable set search_path = ''
as $$
  select case when length(d) >= 9 then right(d, 10) end
    from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d) x;
$$;

alter table public.customers
  add column name_key  text generated always as (public.customer_name_key(name)) stored,
  add column phone_key text generated always as (public.customer_phone_key(phone)) stored,
  add column email_key text generated always as (nullif(lower(trim(coalesce(email, ''))), '')) stored;

create index customers_name_key_idx on public.customers (name_key) where erased_at is null;
create index customers_phone_key_idx on public.customers (phone_key) where erased_at is null;
create index customers_email_key_idx on public.customers (email_key) where erased_at is null;

-- Pairs someone has checked and confirmed are NOT the same company.
create table public.customer_not_duplicates (
  customer_a  uuid not null references public.customers (id) on delete cascade,
  customer_b  uuid not null references public.customers (id) on delete cascade,
  marked_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  marked_at   timestamptz not null default now(),
  primary key (customer_a, customer_b),
  check (customer_a < customer_b)
);
alter table public.customer_not_duplicates enable row level security;
create policy "View checked pairs" on public.customer_not_duplicates for select to authenticated
  using (public.has_permission('customers', 'view'));
create policy "Mark pairs" on public.customer_not_duplicates for insert to authenticated
  with check (public.has_permission('customers', 'edit'));
create policy "Unmark pairs" on public.customer_not_duplicates for delete to authenticated
  using (public.has_permission('customers', 'edit'));
revoke all on public.customer_not_duplicates from anon;
create trigger audit_customer_not_duplicates after insert or delete on public.customer_not_duplicates
  for each row execute function public.audit_row();

-- Every possible duplicate pair (both directions), with the reasons.
create view public.customer_duplicate_pairs
with (security_invoker = true)
as
  select a.id as customer_id, b.id as other_id, b.name as other_name, b.billing_city as other_city,
         array_remove(array[
           case when a.name_key = b.name_key then 'same name' end,
           case when a.phone_key = b.phone_key then 'same phone' end,
           case when a.email_key = b.email_key then 'same email' end
         ], null) as reasons
    from public.customers a
    join public.customers b
      on b.id <> a.id
     and b.erased_at is null
     and (a.name_key = b.name_key or a.phone_key = b.phone_key or a.email_key = b.email_key)
   where a.erased_at is null
     and not exists (
       select 1 from public.customer_not_duplicates n
        where n.customer_a = least(a.id, b.id) and n.customer_b = greatest(a.id, b.id)
     );

-- Customers plus a "possible duplicate" flag, for lists and searches.
create view public.customers_with_flags
with (security_invoker = true)
as
  select c.*,
         exists (
           select 1 from public.customers b
            where b.id <> c.id and b.erased_at is null and c.erased_at is null
              and (b.name_key = c.name_key or b.phone_key = c.phone_key or b.email_key = c.email_key)
              and not exists (
                select 1 from public.customer_not_duplicates n
                 where n.customer_a = least(c.id, b.id) and n.customer_b = greatest(c.id, b.id)
              )
         ) as has_duplicate
    from public.customers c;

grant select on public.customer_duplicate_pairs, public.customers_with_flags to authenticated;
revoke all on public.customer_duplicate_pairs, public.customers_with_flags from anon;

-- Customers that would match a new one (used before adding a customer).
create function public.find_matching_customers(p_name text, p_phone text default null, p_email text default null)
returns table (id uuid, name text, billing_city text, credit_status text, reasons text[])
language sql stable security invoker set search_path = ''
as $$
  select c.id, c.name, c.billing_city, c.credit_status,
         array_remove(array[
           case when c.name_key = public.customer_name_key(p_name) then 'same name' end,
           case when c.phone_key = public.customer_phone_key(p_phone) then 'same phone' end,
           case when c.email_key = nullif(lower(trim(coalesce(p_email, ''))), '') then 'same email' end
         ], null)
    from public.customers c
   where c.erased_at is null
     and (c.name_key = public.customer_name_key(p_name)
          or c.phone_key = public.customer_phone_key(p_phone)
          or c.email_key = nullif(lower(trim(coalesce(p_email, ''))), ''))
   order by c.name
   limit 5;
$$;
revoke execute on function public.find_matching_customers(text, text, text) from anon, public;
grant execute on function public.find_matching_customers(text, text, text) to authenticated;
