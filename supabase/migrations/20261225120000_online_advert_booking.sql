-- Online advert booking (owner, 18 November 2026).
--
-- Plain-English summary:
-- * A public booking page (shown on forgetmenotonline.org) lets advertisers
--   choose editions, an advert size or premium position, how many months and
--   a start month, and see live prices (from the rate card) and availability.
-- * Availability: a premium position (front/back cover, inside front/back,
--   first page, centre spread) is Taken once it's on a sales order or a sent or
--   accepted quote for that issue; other sizes are Available, Limited or Full
--   from the pages sold on sales orders against the pages in the issue.
-- * Sending the form makes a DRAFT advertising quote for the team to check
--   and send (they confirm within a working day, as the website promises). It
--   finds the customer by email or adds them, and logs it on their timeline.
--   Nothing is paid online yet.
-- * Only FootprintOS's own server can use these (it holds the secret key).
--   Spam: limits per connection and per email, plus the page's own checks.

-- ─── Settings ───────────────────────────────────────────────────────────────

create table public.online_booking_settings (
  id          boolean primary key default true check (id),
  active      boolean not null default true,
  owner_id    uuid references public.profiles (id) on delete set null,  -- salesperson on new booking quotes
  notify_ids  uuid[] not null default '{}',                              -- who gets the alert email
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
insert into public.online_booking_settings (id) values (true);
alter table public.online_booking_settings enable row level security;
create policy "Magazine staff see online booking settings" on public.online_booking_settings for select to authenticated
  using ((select public.has_permission('magazines', 'view')));
create policy "Magazine editors change online booking settings" on public.online_booking_settings for update to authenticated
  using ((select public.has_permission('magazines', 'edit'))) with check ((select public.has_permission('magazines', 'edit')));
grant select, update on public.online_booking_settings to authenticated;
revoke all on public.online_booking_settings from anon;
create trigger online_booking_settings_touch before update on public.online_booking_settings for each row execute function public.touch_row();
create trigger audit_online_booking_settings after insert or update or delete on public.online_booking_settings for each row execute function public.audit_row();

-- Requests, for the spam limits (and kept 90 days).
create table public.online_booking_requests (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid references public.sales_documents (id) on delete set null,
  email       text not null,
  ip_hash     text not null,
  created_at  timestamptz not null default now()
);
create index online_booking_requests_ip_idx on public.online_booking_requests (ip_hash, created_at desc);
create index online_booking_requests_email_idx on public.online_booking_requests (email, created_at desc);
create index online_booking_requests_quote_idx on public.online_booking_requests (quote_id);
alter table public.online_booking_requests enable row level security;
revoke all on public.online_booking_requests from anon, authenticated;

-- ─── Space taken per issue ──────────────────────────────────────────────────

-- For each issue from p_from: its pages, pages sold on sales orders (not
-- cancelled), and the premium positions already taken.
create function public._issue_space(p_from date)
returns table (issue_id uuid, edition_id uuid, month date, pages integer, complete boolean, booked_pages numeric, taken text[])
language sql stable security definer set search_path = ''
as $$
  select i.id, i.edition_id, i.month, i.pages, i.complete,
         coalesce((select sum(coalesce(sz.page_fraction, 0) * l.quantity)
                     from public.sales_document_lines l
                     join public.sales_documents d on d.id = l.document_id
                     left join public.advert_sizes sz on sz.id = l.advert_size_id
                    where l.magazine_issue_id = i.id and d.doc_type = 'sales_order' and d.status <> 'cancelled'), 0),
         coalesce((select array_agg(distinct l.premium_position)
                     from public.sales_document_lines l
                     join public.sales_documents d on d.id = l.document_id
                    where l.magazine_issue_id = i.id and l.premium_position is not null
                      and ((d.doc_type = 'sales_order' and d.status <> 'cancelled')
                        or (d.doc_type = 'quote' and d.status in ('sent', 'accepted')))), '{}')
    from public.magazine_issues i
    join public.magazine_editions e on e.id = i.edition_id and e.active
   where i.month >= p_from;
$$;
revoke execute on function public._issue_space(date) from public, anon, authenticated;

-- ─── What the booking page needs ────────────────────────────────────────────

create function public.online_booking_setup(p_key text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_from date := (date_trunc('month', (now() at time zone 'Europe/London')) + interval '1 month')::date;
begin
  if not public._chat_key_ok(p_key) then
    raise exception 'Not allowed';
  end if;
  if not (select active from public.online_booking_settings) then
    return null;
  end if;
  return jsonb_build_object(
    'editions', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'code', e.code, 'name', e.name, 'distribution', e.distribution) order by e.code)
                            from public.magazine_editions e where e.active), '[]'::jsonb),
    'sizes', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'width_mm', s.width_mm, 'height_mm', s.height_mm,
                                                          'page_fraction', s.page_fraction, 'rate_product', s.rate_product) order by s.position)
                         from public.advert_sizes s where s.active and s.rate_product is not null), '[]'::jsonb),
    'rates', coalesce((select jsonb_agg(jsonb_build_object('year', r.year, 'product', r.product, 'term', r.term, 'area', r.area, 'price', r.price))
                         from public.magazine_rates r), '[]'::jsonb),
    'issues', coalesce((select jsonb_agg(jsonb_build_object('id', x.issue_id, 'edition_id', x.edition_id, 'month', x.month, 'pages', x.pages,
                                                           'complete', x.complete, 'booked_pages', x.booked_pages, 'taken', x.taken) order by x.month)
                          from public._issue_space(v_from) x), '[]'::jsonb));
end;
$$;
revoke execute on function public.online_booking_setup(text) from public;
grant execute on function public.online_booking_setup(text) to anon, authenticated;

-- ─── Sending a booking request ──────────────────────────────────────────────

-- p_booking: { company, name, email, phone, street, city, postcode,
--   artwork, message, lines: [{ issue_id, advert_size_id, premium_position,
--   description, unit_price }] }. Prices are worked out by FootprintOS's
-- server from the rate card; this checks space again and saves a draft quote.
create function public.submit_online_booking(p_key text, p_booking jsonb, p_ip_hash text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_settings public.online_booking_settings%rowtype;
  v_email text := lower(trim(p_booking ->> 'email'));
  v_company text := left(trim(coalesce(p_booking ->> 'company', '')), 200);
  v_name text := left(trim(coalesce(p_booking ->> 'name', '')), 200);
  v_phone text := nullif(left(trim(coalesce(p_booking ->> 'phone', '')), 50), '');
  v_customer uuid;
  v_contact uuid;
  v_quote uuid;
  v_number text;
  v_tax public.tax_rates%rowtype;
  v_line jsonb;
  v_pos integer := 0;
  v_problem text;
  v_first date;
  v_new_customer boolean := false;
begin
  if not public._chat_key_ok(p_key) then
    raise exception 'Not allowed';
  end if;
  select * into v_settings from public.online_booking_settings;
  if not v_settings.active then
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

  -- Spam limits: 5 an hour per connection, 3 an hour per email.
  delete from public.online_booking_requests where created_at < now() - interval '90 days';
  if (select count(*) from public.online_booking_requests where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.online_booking_requests where email = v_email and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Too many requests';
  end if;

  -- Check the space again (it may have gone since the page was opened).
  select string_agg(distinct msg, '; ') into v_problem
    from (
      select case
               when l ->> 'premium_position' is not null and (l ->> 'premium_position') = any (s.taken)
                 then (l ->> 'premium_position') || ' is taken in ' || e.name || ', ' || to_char(s.month, 'FMMonth YYYY')
               when l ->> 'premium_position' is null and s.pages > 0
                    and s.booked_pages + coalesce(sz.page_fraction, 0) > s.pages
                 then e.name || ', ' || to_char(s.month, 'FMMonth YYYY') || ' is full'
               when s.complete then e.name || ', ' || to_char(s.month, 'FMMonth YYYY') || ' is closed'
             end as msg
        from jsonb_array_elements(p_booking -> 'lines') l
        join public._issue_space('2000-01-01') s on s.issue_id = (l ->> 'issue_id')::uuid
        join public.magazine_editions e on e.id = s.edition_id
        left join public.advert_sizes sz on sz.id = (l ->> 'advert_size_id')::uuid
    ) m where msg is not null;
  if v_problem is not null then
    raise exception 'Sorry, % — please choose again', v_problem;
  end if;

  -- The customer: by the contact's email, else the customer's email, else new.
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

  -- The draft quote.
  select * into v_tax from public.tax_rates where is_default limit 1;
  v_number := public._take_document_number('quote');
  select min(i.month) into v_first from jsonb_array_elements(p_booking -> 'lines') l join public.magazine_issues i on i.id = (l ->> 'issue_id')::uuid;
  insert into public.sales_documents (doc_type, number, status, customer_id, contact_id, owner_id, title, quote_kind, business_unit,
                                      issue_date, valid_until, expected_date, probability, notes, internal_notes)
  values ('quote', v_number, 'draft', v_customer, v_contact, v_settings.owner_id, 'Advertising in Forget Me Not (online booking)',
          'advertising', 'Advertising', (now() at time zone 'Europe/London')::date, ((now() at time zone 'Europe/London')::date + 30),
          case when v_first <= (date_trunc('month', now() at time zone 'Europe/London') + interval '1 month')::date then 'Next Month' else 'Future' end,
          'Confident',
          nullif(left(trim(coalesce(p_booking ->> 'message', '')), 2000), ''),
          'Online booking request from the website. Artwork: ' || coalesce(nullif(p_booking ->> 'artwork', ''), 'not said') || '.')
  returning id into v_quote;

  for v_line in select * from jsonb_array_elements(p_booking -> 'lines') loop
    insert into public.sales_document_lines (document_id, position, description, quantity, unit_price, discount_percent,
                                             tax_rate_id, tax_rate, magazine_issue_id, advert_size_id, premium_position)
    values (v_quote, v_pos, left(v_line ->> 'description', 500), 1, greatest(0, (v_line ->> 'unit_price')::numeric), 0,
            v_tax.id, coalesce(v_tax.rate, 20), (v_line ->> 'issue_id')::uuid, nullif(v_line ->> 'advert_size_id', '')::uuid,
            nullif(v_line ->> 'premium_position', ''));
    v_pos := v_pos + 1;
  end loop;

  insert into public.online_booking_requests (quote_id, email, ip_hash) values (v_quote, v_email, p_ip_hash);
  insert into public.customer_activity (customer_id, contact_id, kind, body)
  values (v_customer, v_contact, 'system', 'Online advert booking request from the website: quote ' || v_number || ' (draft, to check and send).');

  return jsonb_build_object(
    'quote_id', v_quote, 'number', v_number, 'customer', (select name from public.customers where id = v_customer),
    'new_customer', v_new_customer,
    'total', (select total from public.sales_documents where id = v_quote),
    'notify', coalesce((select jsonb_agg(distinct p.email) from public.profiles p
                         where p.is_active and (p.id = v_settings.owner_id or p.id = any (v_settings.notify_ids))), '[]'::jsonb));
end;
$$;
revoke execute on function public.submit_online_booking(text, jsonb, text) from public;
grant execute on function public.submit_online_booking(text, jsonb, text) to anon, authenticated;
