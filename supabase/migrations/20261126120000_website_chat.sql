-- Website chat (9 November 2026), Wave 8 Marketing: replacing the GoHighLevel
-- chat box on Footprint's own websites (footprintgroup.uk and
-- forgetmenotonline.org).
--
-- Plain-English summary:
-- * Marketing sets up a chat box per website: its greeting, what the bot
--   knows about the business, which lead pipeline it feeds and who is emailed.
--   A line of code on the website shows a chat bubble (/c/<public id>).
-- * A visitor's messages are answered by a Grok bot (when an xAI key is set
--   in Netlify). When a question is too complex, or there's no bot, the chat
--   is "handed over": the visitor leaves their name, email and phone, which
--   makes a lead (or adds to their open one) and emails the chat to the
--   chosen people.
-- * Only FootprintOS itself can write chats: it must give the same secret key
--   the customer portal uses (PORTAL_LINK_KEY, Netlify only). Visitors are
--   known only by a random code kept in their browser (stored here as a
--   fingerprint).
-- * Spam and cost limits: 30 messages an hour from one connection, 40 visitor
--   messages per chat, 2,000 a day per chat box. Chats are deleted after 12
--   months; the connection is kept only as a fingerprint (UK GDPR).
-- * The chats are read in Customer support (and by anyone with lead access);
--   Customer support edit or Marketing edit marks them as dealt with.
--   Marketing edit changes the chat boxes' set-up.

create table public.chat_widgets (
  id           uuid primary key default gen_random_uuid(),
  public_id    text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  name         text not null check (length(trim(name)) between 1 and 100),
  site_name    text not null check (length(trim(site_name)) between 1 and 100),
  greeting     text not null default 'Hi! How can we help today?' check (length(trim(greeting)) between 1 and 500),
  knowledge    text not null default '' check (length(knowledge) <= 12000),
  pipeline_id  uuid not null references public.lead_pipelines (id) on delete restrict,
  owner_id     uuid references public.profiles (id) on delete set null,
  notify_ids   uuid[] not null default '{}',
  privacy_url  text check (privacy_url is null or privacy_url ~ '^https://[^\s]{3,300}$'),
  bot_enabled  boolean not null default true,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid
);

create table public.chat_conversations (
  id              uuid primary key default gen_random_uuid(),
  widget_id       uuid not null references public.chat_widgets (id) on delete cascade,
  visitor_hash    text not null unique check (visitor_hash ~ '^[0-9a-f]{64}$'),
  status          text not null default 'bot' check (status in ('bot', 'handover', 'closed')),
  name            text check (name is null or length(name) <= 200),
  email           text check (email is null or length(email) <= 320),
  phone           text check (phone is null or length(phone) <= 50),
  lead_id         uuid references public.leads (id) on delete set null,
  page            text check (page is null or length(page) <= 300),
  ip_hash         text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  started_at      timestamptz not null default now(),
  last_at         timestamptz not null default now(),
  handed_over_at  timestamptz,
  closed_at       timestamptz,
  closed_by       uuid references public.profiles (id) on delete set null
);
create index chat_conversations_widget_idx on public.chat_conversations (widget_id, last_at desc);
create index chat_conversations_last_idx on public.chat_conversations (last_at);
create index chat_conversations_ip_idx on public.chat_conversations (ip_hash);

create table public.chat_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.chat_conversations (id) on delete cascade,
  role             text not null check (role in ('visitor', 'bot', 'system')),
  body             text not null check (length(body) between 1 and 2000),
  ip_hash          text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  created_at       timestamptz not null default now()
);
create index chat_messages_conversation_idx on public.chat_messages (conversation_id, created_at);
create index chat_messages_ip_idx on public.chat_messages (ip_hash, created_at) where ip_hash is not null;

alter table public.chat_widgets enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

create policy "See chat boxes" on public.chat_widgets for select to authenticated using ((select public._leads_view()));
create policy "Set up chat boxes" on public.chat_widgets for all to authenticated
  using ((select public.has_permission('marketing', 'edit'))) with check ((select public.has_permission('marketing', 'edit')));
create policy "See chats" on public.chat_conversations for select to authenticated
  using ((select public._leads_view()) or (select public.has_permission('support', 'view')));
-- Staff only mark a chat as dealt with (or reopen it); everything else is
-- written by the functions below.
create policy "Mark chats" on public.chat_conversations for update to authenticated
  using ((select public.has_permission('marketing', 'edit')) or (select public.has_permission('support', 'edit')))
  with check ((select public.has_permission('marketing', 'edit')) or (select public.has_permission('support', 'edit')));
create policy "See chat messages" on public.chat_messages for select to authenticated
  using ((select public._leads_view()) or (select public.has_permission('support', 'view')));

create trigger chat_widgets_touch before update on public.chat_widgets
  for each row execute function public.touch_row();
create trigger audit_chat_widgets after insert or update or delete on public.chat_widgets
  for each row execute function public.audit_row();

-- ─── The public side (called by FootprintOS with the secret key) ────────────

create function public._chat_key_ok(p_key text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_key is not null and length(p_key) >= 32
     and public._portal_hash(p_key) = (select link_key_hash from public.portal_settings where id);
$$;
revoke execute on function public._chat_key_ok(text) from public, anon, authenticated;

-- What the chat box shows before anyone types: only active boxes, only their wording.
create function public.public_chat_widget(p_public_id text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('public_id', w.public_id, 'site_name', w.site_name, 'greeting', w.greeting, 'privacy_url', w.privacy_url)
    from public.chat_widgets w
   where w.public_id = p_public_id and w.active;
$$;
revoke execute on function public.public_chat_widget(text) from public;
grant execute on function public.public_chat_widget(text) to anon, authenticated;

-- A visitor's chat so far (their messages and the replies; no staff notes).
create function public.chat_history(p_key text, p_public_id text, p_visitor text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_conv public.chat_conversations;
begin
  if not public._chat_key_ok(p_key) then
    raise exception 'Not allowed';
  end if;
  select c.* into v_conv from public.chat_conversations c join public.chat_widgets w on w.id = c.widget_id
   where c.visitor_hash = public._portal_hash(p_visitor) and w.public_id = p_public_id;
  if v_conv.id is null then
    return jsonb_build_object('status', 'new', 'messages', '[]'::jsonb, 'has_details', false);
  end if;
  return jsonb_build_object(
    'status', v_conv.status,
    'has_details', v_conv.email is not null,
    'messages', coalesce((select jsonb_agg(jsonb_build_object('role', m.role, 'body', m.body) order by m.created_at)
                            from public.chat_messages m where m.conversation_id = v_conv.id and m.role <> 'system'), '[]'::jsonb));
end;
$$;

-- A visitor sends a message. Returns what the bot needs to answer it (the
-- business information and the last 16 messages), or raises 'Too many
-- messages' when a limit is hit.
create function public.chat_visitor_message(p_key text, p_public_id text, p_visitor text, p_body text, p_page text, p_ip_hash text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_widget public.chat_widgets;
  v_conv public.chat_conversations;
  v_body text := left(trim(coalesce(p_body, '')), 1000);
  v_hash text;
begin
  if not public._chat_key_ok(p_key) then
    raise exception 'Not allowed';
  end if;
  if p_visitor is null or p_visitor !~ '^[0-9a-f]{32,64}$' or (p_ip_hash is not null and p_ip_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'Bad request';
  end if;
  select * into v_widget from public.chat_widgets where public_id = p_public_id and active;
  if v_widget.id is null then
    raise exception 'This chat is closed';
  end if;
  if length(v_body) = 0 then
    raise exception 'Please type a message';
  end if;
  v_hash := public._portal_hash(p_visitor);
  select * into v_conv from public.chat_conversations where visitor_hash = v_hash;
  if v_conv.id is not null and v_conv.widget_id <> v_widget.id then
    raise exception 'Bad request';
  end if;

  if (p_ip_hash is not null and (select count(*) from public.chat_messages
        where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 30)
     or (v_conv.id is not null and (select count(*) from public.chat_messages
        where conversation_id = v_conv.id and role = 'visitor') >= 40)
     or (select count(*) from public.chat_messages m join public.chat_conversations c on c.id = m.conversation_id
        where c.widget_id = v_widget.id and m.role = 'visitor' and m.created_at > now() - interval '1 day') >= 2000 then
    raise exception 'Too many messages';
  end if;

  -- Old chats go after 12 months (UK GDPR).
  delete from public.chat_conversations where last_at < now() - interval '12 months';

  if v_conv.id is null then
    insert into public.chat_conversations (widget_id, visitor_hash, page, ip_hash)
    values (v_widget.id, v_hash, nullif(left(trim(coalesce(p_page, '')), 300), ''), p_ip_hash)
    returning * into v_conv;
  else
    update public.chat_conversations set last_at = now(), status = case when status = 'closed' then 'bot' else status end,
           closed_at = case when status = 'closed' then null else closed_at end
     where id = v_conv.id returning * into v_conv;
  end if;
  insert into public.chat_messages (conversation_id, role, body, ip_hash) values (v_conv.id, 'visitor', v_body, p_ip_hash);

  return jsonb_build_object(
    'conversation_id', v_conv.id,
    'status', v_conv.status,
    'has_details', v_conv.email is not null,
    'bot_enabled', v_widget.bot_enabled,
    'site_name', v_widget.site_name,
    'knowledge', v_widget.knowledge,
    'history', coalesce((select jsonb_agg(jsonb_build_object('role', x.role, 'body', x.body) order by x.created_at)
                           from (select m.role, m.body, m.created_at from public.chat_messages m
                                  where m.conversation_id = v_conv.id and m.role <> 'system'
                                  order by m.created_at desc limit 16) x), '[]'::jsonb));
end;
$$;

-- The bot's reply (or a note for staff, role 'system'), and whether it's
-- handing the chat over to a person.
create function public.chat_reply(p_key text, p_conversation uuid, p_role text, p_body text, p_handover boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public._chat_key_ok(p_key) then
    raise exception 'Not allowed';
  end if;
  if p_role not in ('bot', 'system') then
    raise exception 'Bad request';
  end if;
  insert into public.chat_messages (conversation_id, role, body) values (p_conversation, p_role, left(trim(p_body), 2000));
  update public.chat_conversations
     set last_at = now(),
         status = case when p_handover then 'handover' else status end,
         handed_over_at = case when p_handover then coalesce(handed_over_at, now()) else handed_over_at end
   where id = p_conversation;
end;
$$;

-- The visitor leaves their details: the chat becomes a lead (or is added to
-- their open lead in the box's pipeline). Returns who to email and the chat.
create function public.chat_handover(p_key text, p_public_id text, p_visitor text, p_name text, p_email text, p_phone text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_widget public.chat_widgets;
  v_conv public.chat_conversations;
  v_name text := left(trim(coalesce(p_name, '')), 200);
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := nullif(left(trim(coalesce(p_phone, '')), 50), '');
  v_chat text;
  v_note text;
  v_lead uuid;
  v_repeat boolean := false;
  v_stage uuid;
begin
  if not public._chat_key_ok(p_key) then
    raise exception 'Not allowed';
  end if;
  select * into v_widget from public.chat_widgets where public_id = p_public_id and active;
  select * into v_conv from public.chat_conversations where visitor_hash = public._portal_hash(p_visitor) and widget_id = v_widget.id;
  if v_widget.id is null or v_conv.id is null then
    raise exception 'This chat is closed';
  end if;
  if length(v_name) = 0 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_email) > 320 then
    raise exception 'Please give your name and a valid email address';
  end if;
  if v_conv.email is not null and v_conv.handed_over_at > now() - interval '1 hour' and v_conv.lead_id is not null then
    raise exception 'Already sent';
  end if;

  select string_agg(case m.role when 'visitor' then 'Visitor: ' when 'bot' then 'Bot: ' else 'Note: ' end || m.body, e'\n' order by m.created_at)
    into v_chat from public.chat_messages m where m.conversation_id = v_conv.id;
  v_note := concat_ws(e'\n',
    format('Website chat (%s, %s)', v_widget.name, to_char(now() at time zone 'Europe/London', 'DD/MM/YYYY HH24:MI')),
    case when v_conv.page is not null then 'From: ' || v_conv.page end,
    e'\n' || coalesce(v_chat, ''));

  select l.id into v_lead
    from public.leads l join public.lead_stages s on s.id = l.stage_id
   where l.pipeline_id = v_widget.pipeline_id and s.kind = 'open' and lower(trim(l.email)) = v_email
   order by l.created_at desc limit 1;
  if v_lead is not null then
    v_repeat := true;
    update public.leads set notes = left(concat_ws(e'\n\n', notes, v_note), 5000), phone = coalesce(phone, v_phone) where id = v_lead;
  else
    select id into v_stage from public.lead_stages where pipeline_id = v_widget.pipeline_id and kind = 'open' order by position limit 1;
    if v_stage is null then
      raise exception 'This chat''s pipeline has no open stage';
    end if;
    insert into public.leads (pipeline_id, stage_id, name, email, phone, source, owner_id, notes)
    values (v_widget.pipeline_id, v_stage, v_name, v_email, v_phone, 'Website chat', v_widget.owner_id, left(v_note, 5000))
    returning id into v_lead;
  end if;

  update public.chat_conversations
     set name = v_name, email = v_email, phone = v_phone, lead_id = v_lead, status = 'handover',
         handed_over_at = coalesce(handed_over_at, now()), last_at = now()
   where id = v_conv.id;

  return jsonb_build_object(
    'conversation_id', v_conv.id,
    'lead_id', v_lead,
    'pipeline_id', v_widget.pipeline_id,
    'widget_name', v_widget.name,
    'repeat', v_repeat,
    'page', v_conv.page,
    'chat', coalesce(v_chat, ''),
    'notify', coalesce((select jsonb_agg(distinct p.email) from public.profiles p
                         where p.is_active and p.email is not null
                           and (p.id = v_widget.owner_id or p.id = any (v_widget.notify_ids))), '[]'::jsonb));
end;
$$;

revoke execute on function public.chat_history(text, text, text) from public;
revoke execute on function public.chat_visitor_message(text, text, text, text, text, text) from public;
revoke execute on function public.chat_reply(text, uuid, text, text, boolean) from public;
revoke execute on function public.chat_handover(text, text, text, text, text, text) from public;
grant execute on function public.chat_history(text, text, text) to anon, authenticated;
grant execute on function public.chat_visitor_message(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.chat_reply(text, uuid, text, text, boolean) to anon, authenticated;
grant execute on function public.chat_handover(text, text, text, text, text, text) to anon, authenticated;
