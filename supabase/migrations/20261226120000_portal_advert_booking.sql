-- Book more adverts from the customer portal (owner, 18 November 2026).
--
-- Plain-English summary:
-- * A customer signed in to the portal can request more adverts with the same
--   booking page as the website (live prices and availability), without
--   typing their details: it's booked for one of their own companies.
-- * Like a website request, it becomes a DRAFT advertising quote for the team
--   to check and send, and the same space checks and request limits apply.
-- * The website booking is rearranged to share the same steps (space check
--   and making the quote); it works exactly as before.

-- What's wrong with the space for these lines (null if all fine).
create function public._booking_space_problem(p_lines jsonb)
returns text
language sql stable security definer set search_path = ''
as $$
  select string_agg(distinct msg, '; ')
    from (
      select case
               when l ->> 'premium_position' is not null and (l ->> 'premium_position') = any (s.taken)
                 then (l ->> 'premium_position') || ' is taken in ' || e.name || ', ' || to_char(s.month, 'FMMonth YYYY')
               when l ->> 'premium_position' is null and s.pages > 0
                    and s.booked_pages + coalesce(sz.page_fraction, 0) > s.pages
                 then e.name || ', ' || to_char(s.month, 'FMMonth YYYY') || ' is full'
               when s.complete then e.name || ', ' || to_char(s.month, 'FMMonth YYYY') || ' is closed'
             end as msg
        from jsonb_array_elements(p_lines) l
        join public._issue_space('2000-01-01') s on s.issue_id = (l ->> 'issue_id')::uuid
        join public.magazine_editions e on e.id = s.edition_id
        left join public.advert_sizes sz on sz.id = (l ->> 'advert_size_id')::uuid
    ) m where msg is not null;
$$;
revoke execute on function public._booking_space_problem(jsonb) from public, anon, authenticated;

-- Make the draft advertising quote and its lines, and log it on the timeline.
create function public._create_booking_quote(p_customer uuid, p_contact uuid, p_booking jsonb, p_source text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_settings public.online_booking_settings%rowtype;
  v_tax public.tax_rates%rowtype;
  v_quote uuid;
  v_number text;
  v_first date;
  v_line jsonb;
  v_pos integer := 0;
begin
  select * into v_settings from public.online_booking_settings;
  select * into v_tax from public.tax_rates where is_default limit 1;
  v_number := public._take_document_number('quote');
  select min(i.month) into v_first from jsonb_array_elements(p_booking -> 'lines') l join public.magazine_issues i on i.id = (l ->> 'issue_id')::uuid;
  insert into public.sales_documents (doc_type, number, status, customer_id, contact_id, owner_id, title, quote_kind, business_unit,
                                      issue_date, valid_until, expected_date, probability, notes, internal_notes)
  values ('quote', v_number, 'draft', p_customer, p_contact,
          coalesce(v_settings.owner_id, (select c.owner_id from public.customers c where c.id = p_customer)),
          'Advertising in Forget Me Not (' || case p_source when 'website' then 'online booking' else 'portal booking' end || ')',
          'advertising', 'Advertising', (now() at time zone 'Europe/London')::date, ((now() at time zone 'Europe/London')::date + 30),
          case when v_first <= (date_trunc('month', now() at time zone 'Europe/London') + interval '1 month')::date then 'Next Month' else 'Future' end,
          'Confident',
          nullif(left(trim(coalesce(p_booking ->> 'message', '')), 2000), ''),
          'Online booking request from the ' || p_source || '. Artwork: ' || coalesce(nullif(p_booking ->> 'artwork', ''), 'not said') || '.')
  returning id into v_quote;

  for v_line in select * from jsonb_array_elements(p_booking -> 'lines') loop
    insert into public.sales_document_lines (document_id, position, description, quantity, unit_price, discount_percent,
                                             tax_rate_id, tax_rate, magazine_issue_id, advert_size_id, premium_position)
    values (v_quote, v_pos, left(v_line ->> 'description', 500), 1, greatest(0, (v_line ->> 'unit_price')::numeric), 0,
            v_tax.id, coalesce(v_tax.rate, 20), (v_line ->> 'issue_id')::uuid, nullif(v_line ->> 'advert_size_id', '')::uuid,
            nullif(v_line ->> 'premium_position', ''));
    v_pos := v_pos + 1;
  end loop;

  insert into public.customer_activity (customer_id, contact_id, kind, body)
  values (p_customer, p_contact, 'system', 'Online advert booking request from the ' || p_source || ': quote ' || v_number || ' (draft, to check and send).');

  return jsonb_build_object(
    'quote_id', v_quote, 'number', v_number, 'customer', (select name from public.customers where id = p_customer),
    'total', (select total from public.sales_documents where id = v_quote),
    'notify', coalesce((select jsonb_agg(distinct p.email) from public.profiles p
                         where p.is_active and (p.id = v_settings.owner_id or p.id = any (v_settings.notify_ids)
                                                or (v_settings.owner_id is null and p.id = (select c.owner_id from public.customers c where c.id = p_customer)))),
                       '[]'::jsonb));
end;
$$;
revoke execute on function public._create_booking_quote(uuid, uuid, jsonb, text) from public, anon, authenticated;

-- The website booking, now using the shared steps (same behaviour).
create or replace function public.submit_online_booking(p_key text, p_booking jsonb, p_ip_hash text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(trim(p_booking ->> 'email'));
  v_company text := left(trim(coalesce(p_booking ->> 'company', '')), 200);
  v_name text := left(trim(coalesce(p_booking ->> 'name', '')), 200);
  v_phone text := nullif(left(trim(coalesce(p_booking ->> 'phone', '')), 50), '');
  v_customer uuid;
  v_contact uuid;
  v_problem text;
  v_new_customer boolean := false;
  v_result jsonb;
begin
  if not public._chat_key_ok(p_key) then
    raise exception 'Not allowed';
  end if;
  if not (select active from public.online_booking_settings) then
    raise exception 'Online booking is closed';
  end if;
  if v_email !~ '^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$' or length(v_email) > 254 then
    raise exception 'Please give a valid email address';
  end if;
  if length(v_company) < 2 or length(v_name) < 2 then
    raise exception 'Please give your business and your name';
  end if;
  if jsonb_typeof(p_booking -> 'lines') <> 'array' or jsonb_array_length(p_booking -> 'lines') = 0
     or jsonb_array_length(p_booking -> 'lines') > 400 then
    raise exception 'Please choose your editions, size and months';
  end if;

  delete from public.online_booking_requests where created_at < now() - interval '90 days';
  if (select count(*) from public.online_booking_requests where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.online_booking_requests where email = v_email and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Too many requests';
  end if;

  v_problem := public._booking_space_problem(p_booking -> 'lines');
  if v_problem is not null then
    raise exception 'Sorry, % — please choose again', v_problem;
  end if;

  select ct.customer_id, ct.id into v_customer, v_contact
    from public.contacts ct join public.customers c on c.id = ct.customer_id
   where lower(ct.email) = v_email and ct.erased_at is null and c.erased_at is null
   order by ct.is_primary desc, ct.created_at limit 1;
  if v_customer is null then
    select c.id into v_customer from public.customers c where lower(c.email) = v_email and c.erased_at is null order by c.created_at limit 1;
  end if;
  if v_customer is null then
    insert into public.customers (name, email, phone, billing_street, billing_city, billing_postcode)
    values (v_company, v_email, v_phone,
            nullif(left(trim(coalesce(p_booking ->> 'street', '')), 200), ''),
            nullif(left(trim(coalesce(p_booking ->> 'city', '')), 100), ''),
            nullif(left(upper(trim(coalesce(p_booking ->> 'postcode', ''))), 12), ''))
    returning id into v_customer;
    v_new_customer := true;
  end if;
  if v_contact is null then
    insert into public.contacts (customer_id, first_name, last_name, email, phone, is_primary)
    values (v_customer,
            case when position(' ' in v_name) = 0 then null else split_part(v_name, ' ', 1) end,
            case when position(' ' in v_name) = 0 then v_name else trim(substr(v_name, position(' ' in v_name) + 1)) end,
            v_email, v_phone, v_new_customer)
    returning id into v_contact;
  end if;

  v_result := public._create_booking_quote(v_customer, v_contact, p_booking, 'website');
  insert into public.online_booking_requests (quote_id, email, ip_hash) values ((v_result ->> 'quote_id')::uuid, v_email, p_ip_hash);
  return v_result || jsonb_build_object('new_customer', v_new_customer);
end;
$$;

-- From the portal: for one of the signed-in person's own companies.
create function public.submit_portal_booking(p_key text, p_session text, p_customer_id uuid, p_booking jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text;
  v_contact uuid;
  v_problem text;
  v_result jsonb;
begin
  if not public._chat_key_ok(p_key) then
    raise exception 'Not allowed';
  end if;
  v_email := public._portal_session_email(p_session);
  if v_email is null then
    raise exception 'Please sign in again';
  end if;
  if p_customer_id is null or p_customer_id not in (select public._portal_customer_ids(v_email)) then
    raise exception 'Not allowed';
  end if;
  if not (select active from public.online_booking_settings) then
    raise exception 'Online booking is closed';
  end if;
  if jsonb_typeof(p_booking -> 'lines') <> 'array' or jsonb_array_length(p_booking -> 'lines') = 0
     or jsonb_array_length(p_booking -> 'lines') > 400 then
    raise exception 'Please choose your editions, size and months';
  end if;
  if (select count(*) from public.online_booking_requests where email = v_email and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Too many requests';
  end if;
  v_problem := public._booking_space_problem(p_booking -> 'lines');
  if v_problem is not null then
    raise exception 'Sorry, % — please choose again', v_problem;
  end if;

  select ct.id into v_contact from public.contacts ct
   where ct.customer_id = p_customer_id and lower(trim(ct.email)) = v_email and ct.erased_at is null
   order by ct.is_primary desc limit 1;
  v_result := public._create_booking_quote(p_customer_id, v_contact, p_booking, 'portal');
  insert into public.online_booking_requests (quote_id, email, ip_hash) values ((v_result ->> 'quote_id')::uuid, v_email, 'portal');
  return v_result || jsonb_build_object('email', v_email,
    'first_name', (select ct.first_name from public.contacts ct where ct.id = v_contact));
end;
$$;
revoke execute on function public.submit_portal_booking(text, text, uuid, jsonb) from public;
grant execute on function public.submit_portal_booking(text, text, uuid, jsonb) to anon, authenticated;
