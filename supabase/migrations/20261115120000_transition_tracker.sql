-- Transition tracker (28 October 2026): the FootprintAI transition programme.
--
-- Plain-English summary:
-- * Four workstreams, four phases, the Wednesday meeting weeks, decision gates
--   and the actions (each with an owner from the Microsoft 365 staff list, a
--   due date and a status). Reviewed every Wednesday.
-- * The plan itself is NOT in this file: the GitHub repository is public and
--   some actions are board-only, so it's loaded straight into the database by
--   scripts/import-transition.mjs from the owner's own copy.
-- * Who sees what (enforced here, in the database):
--     Admins and Directors: everything, including board-only actions; can
--       add, change, reassign and delete.
--     The invite list (staff list people, e.g. Mitch, Jyron, Toby): every
--       action except board-only ones; can add and change those.
--     An action's owner: their own actions; can change only the status and
--       notes.
--     Everyone else: nothing.
-- * Every change is in the audit log. The week an action falls in is worked
--   out from its due date (the next meeting Wednesday on or after it).

-- ─── Who's who ──────────────────────────────────────────────────────────────

create table public.transition_members (
  directory_id  uuid primary key references public.staff_directory (id) on delete cascade,
  added_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  added_at      timestamptz not null default now()
);
create index transition_members_added_by_idx on public.transition_members (added_by);

-- Admins and anyone with the Directors role.
create function public._transition_full()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      join public.profiles p on p.id = ur.user_id
     where ur.user_id = auth.uid() and p.is_active and r.name = 'Directors');
$$;

-- The signed-in person's entry in the Microsoft 365 staff list.
create function public._my_directory_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select d.id from public.staff_directory d
    join public.profiles p on p.id = d.profile_id
   where d.profile_id = auth.uid() and p.is_active
   limit 1;
$$;

create function public._transition_member()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.transition_members m where m.directory_id = public._my_directory_id());
$$;

-- ─── The programme ──────────────────────────────────────────────────────────

create table public.transition_streams (
  key          text primary key check (key ~ '^[a-z]+$'),
  name         text not null,
  subtitle     text,
  description  text,
  sort         integer not null default 0
);

create table public.transition_phases (
  number  integer primary key,
  name    text not null,
  label   text
);

create table public.transition_weeks (
  number        integer primary key,
  meeting_date  date not null unique,
  label         text not null,
  phase         integer references public.transition_phases (number) on delete set null
);

create table public.transition_gates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  date         date not null,
  description  text,
  is_launch    boolean not null default false,
  unique (name, date)
);

create table public.transition_actions (
  id            uuid primary key default gen_random_uuid(),
  ref           text not null unique check (ref ~ '^T-[0-9]{3,}$'),
  phase         integer references public.transition_phases (number) on delete set null,
  stream        text not null references public.transition_streams (key),
  title         text not null check (length(trim(title)) between 1 and 300),
  detail        text check (detail is null or length(detail) <= 5000),
  owner_id      uuid references public.staff_directory (id) on delete set null,
  due_date      date not null,
  status        text not null default 'not_started' check (status in ('not_started', 'in_progress', 'blocked', 'done')),
  visibility    text not null default 'all' check (visibility in ('all', 'board')),
  notes         text check (notes is null or length(notes) <= 5000),
  sort          integer not null default 0,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid,
  completed_at  timestamptz
);
create index transition_actions_due_idx on public.transition_actions (due_date);
create index transition_actions_owner_idx on public.transition_actions (owner_id, status);
create index transition_actions_stream_idx on public.transition_actions (stream);
create index transition_actions_created_by_idx on public.transition_actions (created_by);

create table public.transition_action_updates (
  id          uuid primary key default gen_random_uuid(),
  action_id   uuid not null references public.transition_actions (id) on delete cascade,
  author_id   uuid default auth.uid() references public.profiles (id) on delete set null,
  body        text not null check (length(trim(body)) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index transition_action_updates_action_idx on public.transition_action_updates (action_id, created_at);
create index transition_action_updates_author_idx on public.transition_action_updates (author_id);

-- Does the signed-in person own any action? (Owners see the section too.)
create function public._transition_owner()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.transition_actions a where a.owner_id = public._my_directory_id());
$$;

-- What the signed-in person can do here: 'full', 'member', 'owner' or null.
create function public.transition_access()
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when public._transition_full() then 'full'
    when public._transition_member() then 'member'
    when public._transition_owner() then 'owner'
  end;
$$;

-- ─── Access rules ───────────────────────────────────────────────────────────

alter table public.transition_members enable row level security;
alter table public.transition_streams enable row level security;
alter table public.transition_phases enable row level security;
alter table public.transition_weeks enable row level security;
alter table public.transition_gates enable row level security;
alter table public.transition_actions enable row level security;
alter table public.transition_action_updates enable row level security;

create policy "Full access manages the invite list" on public.transition_members for all to authenticated
  using ((select public._transition_full())) with check ((select public._transition_full()));

do $$
declare t text;
begin
  foreach t in array array['transition_streams', 'transition_phases', 'transition_weeks', 'transition_gates'] loop
    execute format('create policy "See the programme" on public.%I for select to authenticated using ((select public.transition_access()) is not null)', t);
    execute format('create policy "Full access changes the programme" on public.%I for all to authenticated using ((select public._transition_full())) with check ((select public._transition_full()))', t);
  end loop;
end $$;

-- Board-only actions are invisible to everyone without full access, even in
-- a direct query.
create policy "See actions" on public.transition_actions for select to authenticated
  using ((select public._transition_full())
      or (visibility = 'all' and (select public._transition_member()))
      or owner_id = (select public._my_directory_id()));
create policy "Add actions" on public.transition_actions for insert to authenticated
  with check ((select public._transition_full()) or (visibility = 'all' and (select public._transition_member())));
create policy "Change actions" on public.transition_actions for update to authenticated
  using ((select public._transition_full())
      or (visibility = 'all' and (select public._transition_member()))
      or owner_id = (select public._my_directory_id()))
  with check ((select public._transition_full())
      or (visibility = 'all' and (select public._transition_member()))
      or owner_id = (select public._my_directory_id()));
create policy "Delete actions" on public.transition_actions for delete to authenticated
  using ((select public._transition_full()));

create policy "See updates on visible actions" on public.transition_action_updates for select to authenticated
  using (exists (select 1 from public.transition_actions a where a.id = action_id));
create policy "Add updates to visible actions" on public.transition_action_updates for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (select 1 from public.transition_actions a where a.id = action_id));
create policy "Full access removes updates" on public.transition_action_updates for delete to authenticated
  using ((select public._transition_full()));

-- Owners (without wider access) may change only the status and notes; the
-- finish time follows the status.
create function public.transition_action_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not public._transition_full()
     and not (public._transition_member() and old.visibility = 'all')
     and (new.ref, new.phase, new.stream, new.title, new.detail, new.owner_id, new.due_date, new.visibility, new.sort)
         is distinct from
         (old.ref, old.phase, old.stream, old.title, old.detail, old.owner_id, old.due_date, old.visibility, old.sort) then
    raise exception 'As the owner you can change the status and notes only';
  end if;
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;
revoke execute on function public.transition_action_guard() from anon, authenticated, public;
create trigger transition_actions_guard before update on public.transition_actions
  for each row execute function public.transition_action_guard();
create trigger transition_actions_touch before update on public.transition_actions
  for each row execute function public.touch_row();

do $$
declare t text;
begin
  foreach t in array array['transition_members', 'transition_streams', 'transition_phases', 'transition_weeks',
                           'transition_gates', 'transition_actions', 'transition_action_updates'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', 'audit_' || t, t);
  end loop;
end $$;

-- ─── People for the owner list and names ────────────────────────────────────
-- The staff list itself is admin-only, so this gives names (not emails) to
-- anyone who can see the programme.
create function public.transition_people()
returns table (id uuid, name text, is_member boolean)
language sql stable security definer set search_path = ''
as $$
  select d.id, coalesce(d.display_name, d.email), exists (select 1 from public.transition_members m where m.directory_id = d.id)
    from public.staff_directory d
   where public.transition_access() is not null
     and ((d.in_entra and d.account_enabled) or exists (select 1 from public.transition_actions a where a.owner_id = d.id))
   order by 2;
$$;

revoke execute on function public._transition_full() from public, anon;
revoke execute on function public._my_directory_id() from public, anon;
revoke execute on function public._transition_member() from public, anon;
revoke execute on function public._transition_owner() from public, anon;
revoke execute on function public.transition_access() from public, anon;
revoke execute on function public.transition_people() from public, anon;
grant execute on function public._transition_full() to authenticated;
grant execute on function public._my_directory_id() to authenticated;
grant execute on function public._transition_member() to authenticated;
grant execute on function public._transition_owner() to authenticated;
grant execute on function public.transition_access() to authenticated;
grant execute on function public.transition_people() to authenticated;
