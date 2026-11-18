-- Wave 0 foundations: users, teams, roles, permissions and the audit log.
--
-- Plain-English summary:
-- * Everyone who signs in gets a row in `profiles`.
-- * The very first person to sign in becomes an admin (so someone can set
--   everything else up). After that, only admins can make other admins.
-- * Admins create `teams` and `roles`. A role is a named set of permissions,
--   e.g. "Sales" can view Customers and edit Quotes.
-- * Permissions are (feature, action) pairs. Features match the keys in
--   src/lib/features.ts. Actions are view, edit and delete.
-- * Row-level security means the database itself refuses anything a user is
--   not allowed to do, even if there is a bug in a page.
-- * Every change to these tables is written to `audit_log` automatically.

-- ─── Tables ─────────────────────────────────────────────────────────────────

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  is_admin    boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) > 0),
  description text,
  created_at  timestamptz not null default now()
);

create table public.team_members (
  team_id  uuid not null references public.teams (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (team_id, user_id)
);

create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) > 0),
  description text,
  created_at  timestamptz not null default now()
);

create table public.role_permissions (
  role_id  uuid not null references public.roles (id) on delete cascade,
  feature  text not null,
  action   text not null check (action in ('view', 'edit', 'delete')),
  primary key (role_id, feature, action)
);

create table public.user_roles (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  role_id  uuid not null references public.roles (id) on delete cascade,
  primary key (user_id, role_id)
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid,
  actor_email text,
  action      text not null,
  table_name  text not null,
  record      jsonb,
  old_data    jsonb,
  new_data    jsonb
);

create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_table_idx on public.audit_log (table_name, at desc);

-- ─── Permission helpers ─────────────────────────────────────────────────────
-- SECURITY DEFINER so they can read the permission tables regardless of the
-- caller's row-level security; search_path is pinned for safety.

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select p.is_admin and p.is_active from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create function public.is_active_user()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select p.is_active from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create function public.has_permission(p_feature text, p_action text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and p.is_active
      and rp.feature = p_feature
      and rp.action = p_action
  );
$$;

-- Everything the signed-in user may do, for building menus.
create function public.my_permissions()
returns table (feature text, action text)
language sql stable security definer set search_path = ''
as $$
  select distinct rp.feature, rp.action
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.profiles p on p.id = ur.user_id
  where ur.user_id = auth.uid() and p.is_active;
$$;

-- ─── New sign-ins get a profile; the first one becomes admin ────────────────

create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  make_admin boolean;
begin
  -- Serialise sign-ups so two people can't both become the first admin.
  perform pg_advisory_xact_lock(hashtext('footprint_first_admin'));
  select not exists (select 1 from public.profiles where is_admin) into make_admin;

  insert into public.profiles (id, email, full_name, is_admin)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    make_admin
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only admins may change admin/active flags; nobody may change their own.
create function public.protect_profile_flags()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (new.is_admin is distinct from old.is_admin or new.is_active is distinct from old.is_active) then
    if not public.is_admin() then
      raise exception 'Only admins can change admin or active status';
    end if;
    if new.id = auth.uid() then
      raise exception 'You cannot change your own admin or active status';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_protect_flags
  before update on public.profiles
  for each row execute function public.protect_profile_flags();

-- ─── Audit log ──────────────────────────────────────────────────────────────

create function public.audit_row()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.audit_log (actor_id, actor_email, action, table_name, record, old_data, new_data)
  values (
    auth.uid(),
    (select email from public.profiles where id = auth.uid()),
    lower(tg_op),
    tg_table_name,
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function public.audit_row();
create trigger audit_teams after insert or update or delete on public.teams
  for each row execute function public.audit_row();
create trigger audit_team_members after insert or update or delete on public.team_members
  for each row execute function public.audit_row();
create trigger audit_roles after insert or update or delete on public.roles
  for each row execute function public.audit_row();
create trigger audit_role_permissions after insert or update or delete on public.role_permissions
  for each row execute function public.audit_row();
create trigger audit_user_roles after insert or update or delete on public.user_roles
  for each row execute function public.audit_row();

-- ─── Row-level security ─────────────────────────────────────────────────────

alter table public.profiles         enable row level security;
alter table public.teams            enable row level security;
alter table public.team_members     enable row level security;
alter table public.roles            enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles       enable row level security;
alter table public.audit_log        enable row level security;

-- Active staff can see who's who (needed for assigning work later).
create policy "Active users can read profiles" on public.profiles
  for select to authenticated using (public.is_active_user());
create policy "Admins can update profiles" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Active users can read teams" on public.teams
  for select to authenticated using (public.is_active_user());
create policy "Admins manage teams" on public.teams
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Active users can read team members" on public.team_members
  for select to authenticated using (public.is_active_user());
create policy "Admins manage team members" on public.team_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Active users can read roles" on public.roles
  for select to authenticated using (public.is_active_user());
create policy "Admins manage roles" on public.roles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Active users can read role permissions" on public.role_permissions
  for select to authenticated using (public.is_active_user());
create policy "Admins manage role permissions" on public.role_permissions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Users see their own roles; admins see all" on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "Admins manage user roles" on public.user_roles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Audit log: admins can read; nobody can write directly (only the trigger).
create policy "Admins can read the audit log" on public.audit_log
  for select to authenticated using (public.is_admin());

-- Nothing is available to signed-out visitors.
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on function public.is_admin(), public.is_active_user(),
  public.has_permission(text, text), public.my_permissions() to authenticated;
