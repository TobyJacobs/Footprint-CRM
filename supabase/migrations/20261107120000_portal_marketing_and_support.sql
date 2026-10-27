-- Customer portal: marketing and customer support (27 October 2026).
--
-- Plain-English summary:
-- * The portal also shows each customer's marketing: their content calendar
--   (not early ideas), ad campaigns and digital retainers. Internal notes and
--   who's working on what are never shown.
-- * Customer support: a signed-in customer sends a change request or a
--   question. It arrives in the new Customer support tab (the "support"
--   permission; admins always have it) and admins get an email. Staff reply in
--   FootprintOS; the customer sees the conversation in their portal.
-- * A customer only ever sees the conversations they started, for companies
--   where they're still a contact.

-- ─── Support conversations ──────────────────────────────────────────────────

create table public.support_tickets (
  id               uuid primary key default gen_random_uuid(),
  number           integer generated always as identity unique,
  customer_id      uuid not null references public.customers (id) on delete cascade,
  contact_email    text not null,
  contact_name     text,
  kind             text not null check (kind in ('change', 'question')),
  subject          text not null check (length(trim(subject)) > 0),
  status           text not null default 'new' check (status in ('new', 'in_progress', 'done')),
  last_message_at  timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);
create index support_tickets_status_idx on public.support_tickets (status, last_message_at desc);
create index support_tickets_customer_idx on public.support_tickets (customer_id);
create index support_tickets_email_idx on public.support_tickets (contact_email);

create table public.support_messages (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null references public.support_tickets (id) on delete cascade,
  from_customer  boolean not null,
  author_id      uuid references public.profiles (id) on delete set null,
  body           text not null check (length(trim(body)) > 0 and length(body) <= 5000),
  created_at     timestamptz not null default now()
);
create index support_messages_ticket_idx on public.support_messages (ticket_id, created_at);
create index support_messages_author_idx on public.support_messages (author_id);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

create policy "View support" on public.support_tickets for select to authenticated
  using ((select public.has_permission('support', 'view')));
create policy "Change support" on public.support_tickets for update to authenticated
  using ((select public.has_permission('support', 'edit')))
  with check ((select public.has_permission('support', 'edit')));
create policy "View support messages" on public.support_messages for select to authenticated
  using ((select public.has_permission('support', 'view')));
-- Staff replies only: customers' messages come in through the portal functions.
create policy "Reply to support" on public.support_messages for insert to authenticated
  with check ((select public.has_permission('support', 'edit')) and not from_customer and author_id = (select auth.uid()));

create trigger support_tickets_touch before update on public.support_tickets
  for each row execute function public.touch_row();
create trigger audit_support_tickets after insert or update or delete on public.support_tickets
  for each row execute function public.audit_row();
create trigger audit_support_messages after insert or update or delete on public.support_messages
  for each row execute function public.audit_row();

-- A new message moves the conversation along: a staff reply marks a new one
-- "in progress"; a customer writing again reopens a finished one.
create function public.support_message_added()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.support_tickets
     set last_message_at = new.created_at,
         status = case
           when new.from_customer and status = 'done' then 'new'
           when not new.from_customer and status = 'new' then 'in_progress'
           else status end
   where id = new.ticket_id;
  return new;
end;
$$;
revoke execute on function public.support_message_added() from anon, public;
create trigger support_messages_added after insert on public.support_messages
  for each row execute function public.support_message_added();

-- ─── Portal functions ───────────────────────────────────────────────────────

-- Everything the portal's home page shows (replaces the first version).
create or replace function public.portal_overview(p_session text)
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
       where h.customer_id in (select public._portal_customer_ids(v_email))), '[]'::jsonb),
    'content', coalesce((
      select jsonb_agg(x.j order by x.d desc nulls last)
        from (select jsonb_build_object(
                       'title', ci.title,
                       'channel', ci.channel,
                       'publish_date', ci.publish_date,
                       'status', ci.status,
                       'link', ci.link,
                       'customer_name', cu.name) j, ci.publish_date d
                from public.content_items ci
                join public.customers cu on cu.id = ci.customer_id
               where ci.status <> 'idea'
                 and ci.customer_id in (select public._portal_customer_ids(v_email))
               order by ci.publish_date desc nulls last
               limit 100) x), '[]'::jsonb),
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', a.name,
               'platform', a.platform,
               'status', a.status,
               'start_date', a.start_date,
               'end_date', a.end_date,
               'budget', a.budget,
               'spend', a.spend,
               'leads', a.leads,
               'results', a.results,
               'customer_name', cu.name)
             order by a.start_date desc nulls last, a.name)
        from public.ad_campaigns a
        join public.customers cu on cu.id = a.customer_id
       where a.customer_id in (select public._portal_customer_ids(v_email))), '[]'::jsonb),
    'retainers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', r.name,
               'status', r.status,
               'monthly_fee', r.monthly_fee,
               'budget_hours', r.budget_hours,
               'customer_name', cu.name)
             order by cu.name, r.name)
        from public.retainers r
        join public.customers cu on cu.id = r.customer_id
       where r.customer_id in (select public._portal_customer_ids(v_email))), '[]'::jsonb),
    'tickets', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id,
               'number', t.number,
               'kind', t.kind,
               'subject', t.subject,
               'status', t.status,
               'last_message_at', t.last_message_at,
               'customer_name', cu.name)
             order by t.last_message_at desc)
        from public.support_tickets t
        join public.customers cu on cu.id = t.customer_id
       where t.contact_email = v_email
         and t.customer_id in (select public._portal_customer_ids(v_email))), '[]'::jsonb)
  );
end;
$$;

-- No more than 10 support messages an hour from one customer.
create function public._portal_support_busy(p_email text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select count(*) >= 10
    from public.support_messages m
    join public.support_tickets t on t.id = m.ticket_id
   where t.contact_email = p_email and m.from_customer and m.created_at > now() - interval '1 hour';
$$;

-- A customer starts a conversation. Returns its id.
create function public.portal_create_ticket(p_session text, p_customer_id uuid, p_kind text, p_subject text, p_body text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := public._portal_session_email(p_session);
  v_id uuid;
begin
  if v_email is null then
    raise exception 'Please sign in again';
  end if;
  if p_customer_id is null or p_customer_id not in (select public._portal_customer_ids(v_email)) then
    raise exception 'Not allowed';
  end if;
  if p_kind not in ('change', 'question') or length(trim(coalesce(p_subject, ''))) = 0 or length(trim(coalesce(p_body, ''))) = 0 then
    raise exception 'Please fill in a subject and your message';
  end if;
  if public._portal_support_busy(v_email) then
    raise exception 'You''ve sent a lot of messages in the last hour. Please try again later.';
  end if;
  insert into public.support_tickets (customer_id, contact_email, contact_name, kind, subject)
  values (
    p_customer_id, v_email,
    (select nullif(trim(coalesce(c.first_name, '') || ' ' || c.last_name), '')
       from public.contacts c
      where c.customer_id = p_customer_id and c.email is not null and lower(trim(c.email)) = v_email
      limit 1),
    p_kind, left(trim(p_subject), 200))
  returning id into v_id;
  insert into public.support_messages (ticket_id, from_customer, body)
  values (v_id, true, left(trim(p_body), 5000));
  return v_id;
end;
$$;

-- One of the customer's own conversations, with its messages (null otherwise).
create function public.portal_ticket(p_session text, p_ticket_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
           'id', t.id,
           'number', t.number,
           'kind', t.kind,
           'subject', t.subject,
           'status', t.status,
           'created_at', t.created_at,
           'customer_name', cu.name,
           'messages', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'from_customer', m.from_customer,
                      'author', case when m.from_customer then null
                                     else coalesce(nullif(split_part(coalesce(p.full_name, ''), ' ', 1), ''), 'Footprint') end,
                      'body', m.body,
                      'created_at', m.created_at)
                    order by m.created_at)
               from public.support_messages m
               left join public.profiles p on p.id = m.author_id
              where m.ticket_id = t.id), '[]'::jsonb))
    from public.support_tickets t
    join public.customers cu on cu.id = t.customer_id
   where t.id = p_ticket_id
     and t.contact_email = public._portal_session_email(p_session)
     and t.customer_id in (select public._portal_customer_ids(t.contact_email));
$$;

-- The customer writes again in one of their own conversations.
create function public.portal_reply(p_session text, p_ticket_id uuid, p_body text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := public._portal_session_email(p_session);
begin
  if v_email is null then
    raise exception 'Please sign in again';
  end if;
  if not exists (select 1 from public.support_tickets t
                  where t.id = p_ticket_id and t.contact_email = v_email
                    and t.customer_id in (select public._portal_customer_ids(v_email))) then
    raise exception 'Not allowed';
  end if;
  if length(trim(coalesce(p_body, ''))) = 0 then
    raise exception 'Please write a message';
  end if;
  if public._portal_support_busy(v_email) then
    raise exception 'You''ve sent a lot of messages in the last hour. Please try again later.';
  end if;
  insert into public.support_messages (ticket_id, from_customer, body)
  values (p_ticket_id, true, left(trim(p_body), 5000));
end;
$$;

-- Who to email about a new support message: everyone who can work on support
-- (admins and anyone given the permission). Only FootprintOS can ask (it
-- gives the portal key), so customers can't read staff email addresses.
create function public.portal_support_alert_recipients(p_key text)
returns text[]
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_hash text := (select link_key_hash from public.portal_settings where id);
begin
  if v_hash is null or p_key is null or length(p_key) < 32 or public._portal_hash(p_key) <> v_hash then
    raise exception 'Not allowed';
  end if;
  return coalesce((
    select array_agg(distinct p.email)
      from public.profiles p
     where p.is_active and p.email <> ''
       and (p.is_admin or exists (
             select 1 from public.user_roles ur
               join public.role_permissions rp on rp.role_id = ur.role_id
              where ur.user_id = p.id and rp.feature = 'support' and rp.action = 'edit'))), '{}');
end;
$$;

revoke execute on function public._portal_support_busy(text) from public, anon, authenticated;
revoke execute on function public.portal_create_ticket(text, uuid, text, text, text) from public;
revoke execute on function public.portal_ticket(text, uuid) from public;
revoke execute on function public.portal_reply(text, uuid, text) from public;
revoke execute on function public.portal_support_alert_recipients(text) from public;
grant execute on function public.portal_create_ticket(text, uuid, text, text, text) to anon, authenticated;
grant execute on function public.portal_ticket(text, uuid) to anon, authenticated;
grant execute on function public.portal_reply(text, uuid, text) to anon, authenticated;
grant execute on function public.portal_support_alert_recipients(text) to anon, authenticated;
