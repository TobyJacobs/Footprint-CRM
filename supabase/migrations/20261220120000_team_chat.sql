-- Team chat (16 November 2026): a simple staff chat inside FootprintOS.
-- (Not the website chat, which is chat_conversations.)
--
-- Plain-English summary:
-- * Channels (e.g. General, Sales) and direct messages between two or more
--   staff. Messages can have files, @mentions, and be edited or deleted by
--   whoever wrote them.
-- * Every active member of staff can use it. Open channels can be read and
--   joined by all staff; private channels and direct messages only by the
--   people in them. Nobody else, not even admins, can read a direct message
--   or private channel (owner's decision, 16 November 2026).
-- * Messages and their files are deleted automatically after 2 years (owner's
--   decision; UK GDPR). Files of deleted messages go on a list and are removed
--   from storage the next time someone opens Team chat.
-- * New messages reach open screens instantly (Supabase Realtime), still
--   filtered by these same rules.

create function public._chat_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active); $$;

create table public.team_chat_channels (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null default 'channel' check (kind in ('channel', 'direct')),
  name             text check (name is null or length(trim(name)) between 1 and 60),
  topic            text check (topic is null or length(topic) <= 300),
  private          boolean not null default false,
  archived         boolean not null default false,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz,
  check ((kind = 'channel' and name is not null) or (kind = 'direct' and name is null and private))
);
create unique index team_chat_channels_name_idx on public.team_chat_channels (lower(trim(name))) where kind = 'channel';

create table public.team_chat_members (
  channel_id    uuid not null references public.team_chat_channels (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  last_read_at  timestamptz not null default now(),
  joined_at     timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create index team_chat_members_user_idx on public.team_chat_members (user_id);

create table public.team_chat_messages (
  id           uuid primary key default gen_random_uuid(),
  channel_id   uuid not null references public.team_chat_channels (id) on delete cascade,
  author_id    uuid default auth.uid() references public.profiles (id) on delete set null,
  body         text not null default '' check (length(body) <= 4000),
  -- Files: [{path, name, size, type}], stored at "<channel id>/<random id>".
  attachments  jsonb not null default '[]' check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 10),
  mentions     uuid[] not null default '{}',
  created_at   timestamptz not null default now(),
  edited_at    timestamptz,
  check (length(trim(body)) > 0 or jsonb_array_length(attachments) > 0)
);
create index team_chat_messages_channel_idx on public.team_chat_messages (channel_id, created_at desc);
create index team_chat_messages_author_idx on public.team_chat_messages (author_id);
create index team_chat_messages_created_idx on public.team_chat_messages (created_at);

-- Files waiting to be removed from storage (their message was deleted).
create table public.team_chat_file_deletions (
  path        text primary key,
  queued_at   timestamptz not null default now()
);

-- ─── Who can see what ───────────────────────────────────────────────────────

create function public._chat_member(p_channel uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.team_chat_members m where m.channel_id = p_channel and m.user_id = auth.uid()); $$;

-- Open channels: any active staff. Private channels and direct messages: members only.
create function public._chat_can_read(p_channel uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public._chat_staff() and exists (
    select 1 from public.team_chat_channels c
     where c.id = p_channel
       and (not c.private or exists (select 1 from public.team_chat_members m where m.channel_id = c.id and m.user_id = auth.uid())));
$$;

create function public._chat_file_queued(p_path text)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.team_chat_file_deletions d where d.path = p_path); $$;

revoke execute on function public._chat_staff() from public, anon;
revoke execute on function public._chat_member(uuid) from public, anon;
revoke execute on function public._chat_can_read(uuid) from public, anon;
revoke execute on function public._chat_file_queued(text) from public, anon;
grant execute on function public._chat_staff() to authenticated;
grant execute on function public._chat_member(uuid) to authenticated;
grant execute on function public._chat_can_read(uuid) to authenticated;
grant execute on function public._chat_file_queued(text) to authenticated;

alter table public.team_chat_channels enable row level security;
alter table public.team_chat_members enable row level security;
alter table public.team_chat_messages enable row level security;
alter table public.team_chat_file_deletions enable row level security;

create policy "See channels" on public.team_chat_channels for select to authenticated
  using ((select public._chat_staff()) and (not private or (select public._chat_member(id))));
-- Channels and direct messages are made with create_team_channel / open_direct_chat.
create policy "Rename channels" on public.team_chat_channels for update to authenticated
  using (kind = 'channel' and (created_by = (select auth.uid()) or (select public.is_admin())) and (select public._chat_can_read(id)))
  with check (kind = 'channel');

create policy "See members" on public.team_chat_members for select to authenticated
  using ((select public._chat_can_read(channel_id)));
-- Join an open channel yourself; members of a private channel can add others.
create policy "Join or add" on public.team_chat_members for insert to authenticated
  with check (
    (select public._chat_staff())
    and exists (select 1 from public.team_chat_channels c where c.id = channel_id and c.kind = 'channel')
    and ((user_id = (select auth.uid()) and (select public._chat_can_read(channel_id)))
      or (select public._chat_member(channel_id)))
    and exists (select 1 from public.profiles p where p.id = user_id and p.is_active));
-- Only your own "read up to" mark.
create policy "Mark read" on public.team_chat_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Leave" on public.team_chat_members for delete to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.team_chat_channels c where c.id = channel_id and c.kind = 'channel'));

create policy "Read messages" on public.team_chat_messages for select to authenticated
  using ((select public._chat_can_read(channel_id)));
create policy "Send messages" on public.team_chat_messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select public._chat_can_read(channel_id))
    and exists (select 1 from public.team_chat_channels c where c.id = channel_id and not c.archived)
    and ((select public._chat_member(channel_id))
      or exists (select 1 from public.team_chat_channels c where c.id = channel_id and c.kind = 'channel' and not c.private)));
create policy "Edit own messages" on public.team_chat_messages for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
-- Your own, or (admins) any in a channel they can read, e.g. to remove something unsuitable.
create policy "Delete messages" on public.team_chat_messages for delete to authenticated
  using (author_id = (select auth.uid()) or ((select public.is_admin()) and (select public._chat_can_read(channel_id)) and
         exists (select 1 from public.team_chat_channels c where c.id = channel_id and c.kind = 'channel')));

-- ─── Keeping things tidy ────────────────────────────────────────────────────

create function public.team_chat_message_written()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Posting in an open channel joins it; the sender has read their own message.
    insert into public.team_chat_members (channel_id, user_id, last_read_at)
    values (new.channel_id, new.author_id, new.created_at)
    on conflict (channel_id, user_id) do update set last_read_at = greatest(public.team_chat_members.last_read_at, excluded.last_read_at);
    update public.team_chat_channels set last_message_at = new.created_at where id = new.channel_id;
  end if;
  return new;
end;
$$;

-- Tidy what was sent: only real staff can be mentioned; files must be in the
-- channel's own folder; an edit keeps the original time and files.
create function public.team_chat_message_check()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.mentions := coalesce((select array_agg(distinct m) from unnest(new.mentions) m
                             join public.profiles p on p.id = m and p.is_active), '{}');
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.edited_at := null;
    if exists (select 1 from jsonb_array_elements(new.attachments) a
                where coalesce(a->>'path', '') not like new.channel_id::text || '/%' or (a->>'path') like '%..%') then
      raise exception 'Those files don''t belong to this chat';
    end if;
  else
    new.channel_id := old.channel_id;
    new.author_id := old.author_id;
    new.created_at := old.created_at;
    new.attachments := old.attachments;
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create function public.team_chat_message_removed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.team_chat_file_deletions (path)
  select a->>'path' from jsonb_array_elements(old.attachments) a where a->>'path' is not null
  on conflict do nothing;
  return old;
end;
$$;

revoke execute on function public.team_chat_message_written() from public, anon, authenticated;
revoke execute on function public.team_chat_message_check() from public, anon, authenticated;
revoke execute on function public.team_chat_message_removed() from public, anon, authenticated;
create trigger team_chat_messages_check before insert or update on public.team_chat_messages
  for each row execute function public.team_chat_message_check();
create trigger team_chat_messages_written after insert on public.team_chat_messages
  for each row execute function public.team_chat_message_written();
create trigger team_chat_messages_removed after delete on public.team_chat_messages
  for each row execute function public.team_chat_message_removed();

-- ─── Starting and listing chats ─────────────────────────────────────────────

-- A new channel, with its creator (and anyone named) as members. Returns its id.
create function public.create_team_channel(p_name text, p_topic text, p_private boolean, p_members uuid[])
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public._chat_staff() then
    raise exception 'Not allowed';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Give the channel a name';
  end if;
  if exists (select 1 from public.team_chat_channels where kind = 'channel' and lower(trim(name)) = lower(trim(p_name))) then
    raise exception 'There''s already a channel called "%"', trim(p_name);
  end if;
  insert into public.team_chat_channels (kind, name, topic, private, created_by)
  values ('channel', left(trim(p_name), 60), nullif(left(trim(coalesce(p_topic, '')), 300), ''), coalesce(p_private, false), auth.uid())
  returning id into v_id;
  insert into public.team_chat_members (channel_id, user_id)
  select v_id, p.id from public.profiles p
   where p.is_active and (p.id = auth.uid() or p.id = any (coalesce(p_members, '{}')))
  on conflict do nothing;
  return v_id;
end;
$$;

-- The direct message between you and these people: the existing one with
-- exactly the same people, or a new one. Returns its id.
create function public.open_direct_chat(p_people uuid[])
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_people uuid[];
  v_id uuid;
begin
  if not public._chat_staff() then
    raise exception 'Not allowed';
  end if;
  select array_agg(distinct p.id order by p.id) into v_people
    from public.profiles p
   where p.is_active and (p.id = auth.uid() or p.id = any (coalesce(p_people, '{}')));
  if coalesce(array_length(v_people, 1), 0) < 2 then
    raise exception 'Choose who to message';
  end if;
  if array_length(v_people, 1) > 12 then
    raise exception 'A direct message can have up to 12 people; make a private channel instead';
  end if;
  select c.id into v_id
    from public.team_chat_channels c
   where c.kind = 'direct'
     and (select array_agg(m.user_id order by m.user_id) from public.team_chat_members m where m.channel_id = c.id) = v_people
   limit 1;
  if v_id is null then
    insert into public.team_chat_channels (kind, private, created_by) values ('direct', true, auth.uid()) returning id into v_id;
    insert into public.team_chat_members (channel_id, user_id) select v_id, unnest(v_people);
  end if;
  return v_id;
end;
$$;

-- Everything the side list needs: the chats you're in (with unread messages
-- and mentions), and open channels you could join.
create function public.team_chat_overview()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case when not public._chat_staff() then '[]'::jsonb else coalesce((
    select jsonb_agg(x order by x.sort_kind, x.sort_name)
      from (
        select c.id, c.kind, c.name, c.topic, c.private, c.archived, c.last_message_at,
               (m.user_id is not null) as joined,
               case when m.user_id is null then 0 else
                 (select count(*) from public.team_chat_messages t
                   where t.channel_id = c.id and t.created_at > m.last_read_at and t.author_id is distinct from auth.uid()) end as unread,
               case when m.user_id is null then 0 else
                 (select count(*) from public.team_chat_messages t
                   where t.channel_id = c.id and t.created_at > m.last_read_at and auth.uid() = any (t.mentions)) end as mentions,
               case when c.kind = 'direct' then
                 (select string_agg(coalesce(p.full_name, p.email), ', ' order by coalesce(p.full_name, p.email))
                    from public.team_chat_members o join public.profiles p on p.id = o.user_id
                   where o.channel_id = c.id and o.user_id <> auth.uid()) end as people,
               case when c.kind = 'channel' then 0 else 1 end as sort_kind,
               lower(coalesce(c.name, '')) as sort_name
          from public.team_chat_channels c
          left join public.team_chat_members m on m.channel_id = c.id and m.user_id = auth.uid()
         where (m.user_id is not null or (c.kind = 'channel' and not c.private and not c.archived))
      ) x), '[]'::jsonb) end;
$$;

-- Unread messages across the chats you're in (for the menu).
create function public.team_chat_unread()
returns integer
language sql stable security definer set search_path = ''
as $$
  select coalesce((select count(*)::integer
    from public.team_chat_members m
    join public.team_chat_messages t on t.channel_id = m.channel_id and t.created_at > m.last_read_at and t.author_id is distinct from auth.uid()
   where m.user_id = auth.uid() and public._chat_staff()), 0);
$$;

-- Messages you can see that contain the words searched for (newest first).
create function public.search_team_chat(p_query text)
returns table (id uuid, channel_id uuid, author_name text, body text, created_at timestamptz)
language sql stable security invoker set search_path = ''
as $$
  select t.id, t.channel_id, coalesce(p.full_name, p.email), t.body, t.created_at
    from public.team_chat_messages t
    left join public.profiles p on p.id = t.author_id
   where length(trim(coalesce(p_query, ''))) >= 2
     and t.body ilike '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
   order by t.created_at desc
   limit 50;
$$;

-- File paths waiting to be removed from storage (FootprintOS removes them,
-- then calls team_chat_files_removed).
create function public.team_chat_files_to_remove()
returns setof text
language sql stable security definer set search_path = ''
as $$ select d.path from public.team_chat_file_deletions d where public._chat_staff() order by d.queued_at limit 100; $$;

create function public.team_chat_files_removed(p_paths text[])
returns void
language sql security definer set search_path = ''
as $$ delete from public.team_chat_file_deletions where public._chat_staff() and path = any (coalesce(p_paths, '{}')); $$;

revoke execute on function public.create_team_channel(text, text, boolean, uuid[]) from public, anon;
revoke execute on function public.open_direct_chat(uuid[]) from public, anon;
revoke execute on function public.team_chat_overview() from public, anon;
revoke execute on function public.team_chat_unread() from public, anon;
revoke execute on function public.search_team_chat(text) from public, anon;
revoke execute on function public.team_chat_files_to_remove() from public, anon;
revoke execute on function public.team_chat_files_removed(text[]) from public, anon;
grant execute on function public.create_team_channel(text, text, boolean, uuid[]) to authenticated;
grant execute on function public.open_direct_chat(uuid[]) to authenticated;
grant execute on function public.team_chat_overview() to authenticated;
grant execute on function public.team_chat_unread() to authenticated;
grant execute on function public.search_team_chat(text) to authenticated;
grant execute on function public.team_chat_files_to_remove() to authenticated;
grant execute on function public.team_chat_files_removed(text[]) to authenticated;

-- ─── Files ──────────────────────────────────────────────────────────────────
-- Private store; files sit in their chat's folder and can only be opened by
-- people who can read that chat.

insert into storage.buckets (id, name, public, file_size_limit)
values ('team-chat', 'team-chat', false, 20971520)
on conflict (id) do nothing;

create policy "Team chat files: read" on storage.objects for select to authenticated
  using (bucket_id = 'team-chat' and public._chat_can_read(((storage.foldername(name))[1])::uuid));
create policy "Team chat files: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'team-chat' and public._chat_can_read(((storage.foldername(name))[1])::uuid));
create policy "Team chat files: remove" on storage.objects for delete to authenticated
  using (bucket_id = 'team-chat' and public._chat_staff() and public._chat_file_queued(name));

-- ─── After 2 years ──────────────────────────────────────────────────────────

create function public.team_chat_cleanup()
returns void
language sql security definer set search_path = ''
as $$
  delete from public.team_chat_messages where created_at < now() - interval '2 years';
  delete from public.team_chat_channels c
   where c.kind = 'direct' and not exists (select 1 from public.team_chat_messages t where t.channel_id = c.id)
     and c.created_at < now() - interval '2 years';
$$;
revoke execute on function public.team_chat_cleanup() from public, anon, authenticated;
select cron.schedule('team-chat-cleanup', '30 3 * * *', 'select public.team_chat_cleanup()');

-- ─── Live updates ───────────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.team_chat_messages;
  end if;
end $$;

-- ─── A channel to start with ────────────────────────────────────────────────

insert into public.team_chat_channels (kind, name, topic) values ('channel', 'General', 'For everyone at Footprint');
