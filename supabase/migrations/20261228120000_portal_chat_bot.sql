-- Customer portal assistant (18 November 2026): a chat bot inside the
-- customer portal.
--
-- Plain-English summary:
-- * A signed-in customer can ask the assistant questions. It answers from
--   what Footprint tells it (editable by Marketing or Customer support) and
--   from the customer's OWN portal records (quotes, orders, design work,
--   adverts, invoices, hosting, support), the same things the portal already
--   shows them. It can only write replies: it can't change anything.
-- * When it can't help, or the customer asks, the chat is sent to the team as
--   a Customer support conversation (a ticket), with the whole chat in it.
-- * Only FootprintOS itself can write chats (the portal's secret key,
--   PORTAL_LINK_KEY, Netlify only), so the chat in a ticket is what was really
--   said.
-- * Limits: 20 messages an hour and 60 a day per customer, 3,000 a day in
--   all. Chats are deleted after 90 days (anything sent to the team is kept
--   in the ticket).

alter table public.portal_settings
  add column bot_enabled   boolean not null default true,
  add column bot_greeting  text not null default 'Hi! I can answer questions about your orders, design work, adverts, invoices and more. What can I help with?'
    check (length(trim(bot_greeting)) between 1 and 500),
  add column bot_knowledge text not null default '' check (length(bot_knowledge) <= 12000);

create table public.portal_bot_messages (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (length(email) <= 320),
  role        text not null check (role in ('customer', 'bot')),
  body        text not null check (length(body) between 1 and 2000),
  cleared     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index portal_bot_messages_email_idx on public.portal_bot_messages (email, created_at);
create index portal_bot_messages_created_idx on public.portal_bot_messages (created_at);
-- No policies: only the functions below read or write it.
alter table public.portal_bot_messages enable row level security;

-- ─── Staff: the assistant's set-up ──────────────────────────────────────────

create function public._portal_bot_editor()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.has_permission('marketing', 'edit') or public.has_permission('support', 'edit');
$$;
revoke execute on function public._portal_bot_editor() from public, anon;
grant execute on function public._portal_bot_editor() to authenticated;

create function public.portal_bot_settings()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public._portal_bot_editor() then
    return null;
  end if;
  return (select jsonb_build_object('enabled', bot_enabled, 'greeting', bot_greeting, 'knowledge', bot_knowledge)
            from public.portal_settings where id);
end;
$$;

create function public.portal_bot_save_settings(p_enabled boolean, p_greeting text, p_knowledge text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public._portal_bot_editor() then
    raise exception 'Not allowed';
  end if;
  update public.portal_settings
     set bot_enabled = coalesce(p_enabled, true),
         bot_greeting = left(trim(coalesce(p_greeting, '')), 500),
         bot_knowledge = left(coalesce(p_knowledge, ''), 12000),
         updated_at = now()
   where id;
end;
$$;

-- ─── The customer's side (called by FootprintOS with the secret key) ────────

-- The chat so far: messages not yet cleared, from the last day.
create function public._portal_bot_chat(p_email text, p_limit int)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('role', x.role, 'body', x.body) order by x.created_at), '[]'::jsonb)
    from (select m.role, m.body, m.created_at from public.portal_bot_messages m
           where m.email = p_email and not m.cleared and m.created_at > now() - interval '1 day'
           order by m.created_at desc limit p_limit) x;
$$;
revoke execute on function public._portal_bot_chat(text, int) from public, anon, authenticated;

create function public.portal_bot_history(p_key text, p_session text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_email text := public._portal_session_email(p_session);
begin
  if not public._chat_key_ok(p_key) then
    raise exception 'Not allowed';
  end if;
  if v_email is null then
    raise exception 'Please sign in again';
  end if;
  return (select jsonb_build_object('enabled', s.bot_enabled, 'greeting', s.bot_greeting, 'messages', public._portal_bot_chat(v_email, 60))
            from public.portal_settings s where s.id);
end;
$$;

-- The customer sends a message. Returns what the bot needs (the business
-- information and the last 16 messages), or raises 'Too many messages'.
create function public.portal_bot_message(p_key text, p_session text, p_body text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := public._portal_session_email(p_session);
  v_body text := left(trim(coalesce(p_body, '')), 1000);
  v_settings public.portal_settings;
begin
  if not public._chat_key_ok(p_key) then
    raise exception 'Not allowed';
  end if;
  if v_email is null then
    raise exception 'Please sign in again';
  end if;
  if length(v_body) = 0 then
    raise exception 'Please type a message';
  end if;
  select * into v_settings from public.portal_settings where id;
  if not v_settings.bot_enabled then
    raise exception 'The assistant is switched off';
  end if;
  if (select count(*) from public.portal_bot_messages
       where email = v_email and role = 'customer' and created_at > now() - interval '1 hour') >= 20
     or (select count(*) from public.portal_bot_messages
       where email = v_email and role = 'customer' and created_at > now() - interval '1 day') >= 60
     or (select count(*) from public.portal_bot_messages
       where role = 'customer' and created_at > now() - interval '1 day') >= 3000 then
    raise exception 'Too many messages';
  end if;

  -- Old chats go after 90 days (UK GDPR).
  delete from public.portal_bot_messages where created_at < now() - interval '90 days';

  insert into public.portal_bot_messages (email, role, body) values (v_email, 'customer', v_body);
  return jsonb_build_object('knowledge', v_settings.bot_knowledge, 'history', public._portal_bot_chat(v_email, 16));
end;
$$;

create function public.portal_bot_reply(p_key text, p_session text, p_body text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := public._portal_session_email(p_session);
begin
  if not public._chat_key_ok(p_key) then
    raise exception 'Not allowed';
  end if;
  if v_email is null then
    raise exception 'Please sign in again';
  end if;
  insert into public.portal_bot_messages (email, role, body) values (v_email, 'bot', left(trim(p_body), 2000));
end;
$$;

-- Start a fresh chat.
create function public.portal_bot_clear(p_key text, p_session text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := public._portal_session_email(p_session);
begin
  if not public._chat_key_ok(p_key) then
    raise exception 'Not allowed';
  end if;
  if v_email is null then
    raise exception 'Please sign in again';
  end if;
  update public.portal_bot_messages set cleared = true where email = v_email and not cleared;
end;
$$;

-- Send the chat to the team: a Customer support conversation for one of the
-- customer's companies, with the whole chat in it. The chat then starts
-- afresh. Returns the conversation's id.
create function public.portal_bot_handover(p_key text, p_session text, p_customer_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := public._portal_session_email(p_session);
  v_chat text;
  v_first text;
  v_id uuid;
begin
  if not public._chat_key_ok(p_key) then
    raise exception 'Not allowed';
  end if;
  if v_email is null then
    raise exception 'Please sign in again';
  end if;
  select string_agg(case when m.role = 'customer' then 'Customer: ' else 'Assistant: ' end || m.body, E'\n\n' order by m.created_at)
    into v_chat
    from public.portal_bot_messages m
   where m.email = v_email and not m.cleared and m.created_at > now() - interval '1 day';
  if v_chat is null then
    raise exception 'Please type a message first';
  end if;
  select m.body into v_first from public.portal_bot_messages m
   where m.email = v_email and not m.cleared and m.role = 'customer' and m.created_at > now() - interval '1 day'
   order by m.created_at desc limit 1;
  -- portal_create_ticket checks the company is theirs and the hourly limit.
  v_id := public.portal_create_ticket(
    p_session, p_customer_id, 'question',
    'Chat: ' || left(regexp_replace(coalesce(v_first, 'Question'), '\s+', ' ', 'g'), 80),
    'Sent from the portal assistant chat.' || E'\n\n' || right(v_chat, 4900));
  update public.portal_bot_messages set cleared = true where email = v_email and not cleared;
  return v_id;
end;
$$;

revoke execute on function public.portal_bot_settings() from public, anon;
revoke execute on function public.portal_bot_save_settings(boolean, text, text) from public, anon;
grant execute on function public.portal_bot_settings() to authenticated;
grant execute on function public.portal_bot_save_settings(boolean, text, text) to authenticated;
revoke execute on function public.portal_bot_history(text, text) from public;
revoke execute on function public.portal_bot_message(text, text, text) from public;
revoke execute on function public.portal_bot_reply(text, text, text) from public;
revoke execute on function public.portal_bot_clear(text, text) from public;
revoke execute on function public.portal_bot_handover(text, text, uuid) from public;
grant execute on function public.portal_bot_history(text, text) to anon, authenticated;
grant execute on function public.portal_bot_message(text, text, text) to anon, authenticated;
grant execute on function public.portal_bot_reply(text, text, text) to anon, authenticated;
grant execute on function public.portal_bot_clear(text, text) to anon, authenticated;
grant execute on function public.portal_bot_handover(text, text, uuid) to anon, authenticated;
