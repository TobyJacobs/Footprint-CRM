-- Possible duplicates while someone is typing a new customer (owner request,
-- 5 October 2026).
--
-- Plain-English summary: as a new customer's name, phone or email is typed,
-- this lists existing customers that might be the same company:
--   - "same name": the same once "Ltd", punctuation etc. are ignored;
--   - "similar name": the name contains what's been typed (3+ letters), or is
--     spelt almost the same (e.g. "Copse Joinry" vs "Copse Joinery");
--   - "same phone" / "same email".
-- Closest matches come first. Runs as the person asking, so permissions apply.

create function public.possible_duplicate_customers(p_name text, p_phone text default null, p_email text default null)
returns table (id uuid, name text, billing_city text, billing_postcode text, phone text, email text, reasons text[])
language sql stable security invoker set search_path = ''
as $$
  with input as (
    select public.customer_name_key(p_name) as name_key,
           nullif(trim(coalesce(p_name, '')), '') as typed,
           public.customer_phone_key(p_phone) as phone_key,
           nullif(lower(trim(coalesce(p_email, ''))), '') as email_key
  ),
  hits as (
    select c.id, c.name, c.billing_city, c.billing_postcode, c.phone, c.email,
           array_remove(array[
             case when c.name_key = i.name_key then 'same name' end,
             case when c.name_key is distinct from i.name_key and length(i.typed) >= 3
                       and (c.name ilike '%' || replace(replace(replace(i.typed, '\', '\\'), '%', '\%'), '_', '\_') || '%'
                            or (length(i.name_key) >= 3 and c.name_key like i.name_key || '%')
                            or (length(i.typed) >= 5 and extensions.similarity(lower(c.name), lower(i.typed)) >= 0.5))
                  then 'similar name' end,
             case when c.phone_key = i.phone_key then 'same phone' end,
             case when c.email_key = i.email_key then 'same email' end
           ], null) as reasons
      from public.customers c, input i
     where c.erased_at is null
  )
  select * from hits
   where cardinality(reasons) > 0
   order by ('same name' = any(reasons) or 'same phone' = any(reasons) or 'same email' = any(reasons)) desc,
            cardinality(reasons) desc, name
   limit 20;
$$;
revoke execute on function public.possible_duplicate_customers(text, text, text) from anon, public;
grant execute on function public.possible_duplicate_customers(text, text, text) to authenticated;
