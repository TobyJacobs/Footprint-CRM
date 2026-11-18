-- Contact due on the customer list (DJ, 11 November 2026).
--
-- Plain-English summary:
-- * The customer list view gains `last_activity_on`: the UK date of the
--   newest entry on the customer's timeline (null if there's none). The list
--   uses it for the "Contact due" badge and filter (nothing logged for over
--   3 months). It still runs as the person asking, so permissions apply.
-- * The view is rebuilt (rather than replaced) so it picks up every current
--   customer column.

drop view public.customers_with_flags;
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
         ) as has_duplicate,
         (select (max(a.occurred_at) at time zone 'Europe/London')::date
            from public.customer_activity a where a.customer_id = c.id) as last_activity_on
    from public.customers c;

grant select on public.customers_with_flags to authenticated;
revoke all on public.customers_with_flags from anon;
