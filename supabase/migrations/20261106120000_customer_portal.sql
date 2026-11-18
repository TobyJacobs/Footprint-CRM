-- Customer portal, first half (27 October 2026).
--
-- Plain-English summary:
-- * Customers sign in at /portal with a one-time link emailed to them. Anyone
--   listed as a contact (with that email) on a customer can sign in.
-- * Customers are kept completely apart from staff: they never get a staff
--   account. Their sign-in links and sessions live in their own tables, which
--   nobody can read directly (no access rules = no access).
-- * Everything a customer sees comes from the functions below, which only ever
--   return records for the companies where their email is a contact. Removing
--   or changing a contact's email locks them out on their next click.
-- * They see their sent / accepted / declined quotes (never drafts) and their
--   hosting plans, without internal notes, logins or costs.
-- * Only FootprintOS itself can create sign-in links: it must give a secret
--   key whose fingerprint is stored in portal_settings.

-- ─── Settings: the sign-in link key's fingerprint ───────────────────────────

create table public.portal_settings (
  id             boolean primary key default true check (id),
  link_key_hash  text,
  updated_at     timestamptz not null default now()
);
insert into public.portal_settings (id) values (true);
alter table public.portal_settings enable row level security;

-- ─── Sign-in links (emailed, one use, 30 minutes) ───────────────────────────

create table public.portal_links (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index portal_links_email_idx on public.portal_links (email, created_at desc);
alter table public.portal_links enable row level security;

-- ─── Sessions (signed-in customers, 14 days) ────────────────────────────────

create table public.portal_sessions (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  token_hash    text not null unique,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);
create index portal_sessions_email_idx on public.portal_sessions (email);
alter table public.portal_sessions enable row level security;

create function public._portal_hash(p text)
returns text
language sql immutable set search_path = ''
as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;

-- The customers whose contacts include this email.
create function public._portal_customer_ids(p_email text)
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select distinct c.customer_id
    from public.contacts c
   where c.customer_id is not null
     and c.email is not null
     and lower(trim(c.email)) = p_email;
$$;

-- The email behind a valid session, or null.
create function public._portal_session_email(p_session text)
returns text
language sql stable security definer set search_path = ''
as $$
  select s.email
    from public.portal_sessions s
   where p_session is not null
     and length(p_session) >= 64
     and s.token_hash = public._portal_hash(p_session)
     and s.expires_at > now()
     and exists (select 1 from public._portal_customer_ids(s.email));
$$;

-- FootprintOS asks for a sign-in link. It makes the random token itself and
-- sends only its fingerprint; it emails the link only if this returns true.
-- Refused without the secret key, so nobody else can make links.
create function public.portal_request_link(p_key text, p_email text, p_token_hash text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_hash text := (select link_key_hash from public.portal_settings where id);
begin
  if v_hash is null or p_key is null or length(p_key) < 32 or public._portal_hash(p_key) <> v_hash then
    raise exception 'Not allowed';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Bad token';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or not exists (select 1 from public._portal_customer_ids(v_email)) then
    return false;
  end if;
  -- At most 5 links per email per hour.
  if (select count(*) from public.portal_links
       where email = v_email and created_at > now() - interval '1 hour') >= 5 then
    return false;
  end if;
  delete from public.portal_links where expires_at < now() - interval '1 day';
  insert into public.portal_links (email, token_hash, expires_at)
  values (v_email, p_token_hash, now() + interval '30 minutes');
  return true;
end;
$$;

-- The customer clicks Sign in on the link's page: swap the one-use link for a
-- session. Returns the session token (kept in a browser cookie), or null.
create function public.portal_sign_in(p_link text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text;
  v_session text := replace(gen_random_uuid()::text || gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if p_link is null or length(p_link) < 64 then
    return null;
  end if;
  update public.portal_links
     set used_at = now()
   where token_hash = public._portal_hash(p_link)
     and used_at is null
     and expires_at > now()
  returning email into v_email;
  if v_email is null or not exists (select 1 from public._portal_customer_ids(v_email)) then
    return null;
  end if;
  delete from public.portal_sessions where expires_at < now();
  insert into public.portal_sessions (email, token_hash, expires_at)
  values (v_email, public._portal_hash(v_session), now() + interval '14 days');
  return v_session;
end;
$$;

create function public.portal_sign_out(p_session text)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.portal_sessions where token_hash = public._portal_hash(coalesce(p_session, ''));
$$;

-- Everything the portal shows, for a signed-in customer only (null otherwise).
create function public.portal_overview(p_session text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := public._portal_session_email(p_session);
begin
  if v_email is null then
    return null;
  end if;
  update public.portal_sessions set last_seen_at = now()
   where token_hash = public._portal_hash(p_session) and last_seen_at < now() - interval '5 minutes';

  return jsonb_build_object(
    'email', v_email,
    'first_name', (select c.first_name from public.contacts c
                    where c.email is not null and lower(trim(c.email)) = v_email and c.first_name is not null
                    order by c.is_primary desc, c.created_at limit 1),
    'customers', coalesce((
      select jsonb_agg(jsonb_build_object('id', cu.id, 'name', cu.name) order by cu.name)
        from public.customers cu
       where cu.id in (select public._portal_customer_ids(v_email))), '[]'::jsonb),
    'quotes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'number', d.number,
               'title', d.title,
               'kind', d.quote_kind,
               'status', d.status,
               'issue_date', d.issue_date,
               'valid_until', d.valid_until,
               'total', d.total,
               'customer_name', cu.name,
               'token', d.public_token)
             order by d.issue_date desc, d.number desc)
        from public.sales_documents d
        join public.customers cu on cu.id = d.customer_id
       where d.doc_type = 'quote'
         and d.status in ('sent', 'accepted', 'declined', 'converted')
         and d.customer_id in (select public._portal_customer_ids(v_email))), '[]'::jsonb),
    'hosting', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', h.name,
               'plan_type', h.plan_type,
               'status', h.status,
               'price', h.price,
               'billing_frequency', h.billing_frequency,
               'renewal_month', h.renewal_month,
               'customer_name', cu.name,
               'items', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'kind', i.kind,
                          'plan', i.plan,
                          'domain', i.domain,
                          'mailbox_qty', i.mailbox_qty,
                          'email_platform', i.email_platform)
                        order by i.kind desc, i.domain)
                   from public.hosting_items i
                  where i.hosting_plan_id = h.id), '[]'::jsonb))
             order by cu.name, h.name)
        from public.hosting_plans h
        join public.customers cu on cu.id = h.customer_id
       where h.customer_id in (select public._portal_customer_ids(v_email))), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public._portal_hash(text) from public, anon, authenticated;
revoke execute on function public._portal_customer_ids(text) from public, anon, authenticated;
revoke execute on function public._portal_session_email(text) from public, anon, authenticated;
revoke execute on function public.portal_request_link(text, text, text) from public;
revoke execute on function public.portal_sign_in(text) from public;
revoke execute on function public.portal_sign_out(text) from public;
revoke execute on function public.portal_overview(text) from public;
grant execute on function public.portal_request_link(text, text, text) to anon, authenticated;
grant execute on function public.portal_sign_in(text) to anon, authenticated;
grant execute on function public.portal_sign_out(text) to anon, authenticated;
grant execute on function public.portal_overview(text) to anon, authenticated;
