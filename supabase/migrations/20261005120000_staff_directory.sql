-- Director's improvements (items 1 and 2, plus pre-listing): staff access
-- comes from Microsoft 365.
--
-- Plain-English summary:
-- * `staff_directory` is a copy of everyone in Microsoft 365 (name, email, job
--   title, department, whether their Microsoft account is switched on). It is
--   filled by a sync — daily, or when an admin presses "Sync now" — so people
--   appear in Admin → Users before they ever sign in.
-- * `job_role_rules` say which role a job title gets, e.g. job titles
--   containing "Sales" → the "Sales" role. An admin can also pick a role for
--   one person, which wins over the rules.
-- * Roles given this way are marked as coming from the directory
--   (`user_roles.source = 'directory'`), so they're kept up to date when a job
--   title changes, without touching roles an admin added by hand.
-- * When someone first signs in, they're matched to their directory entry by
--   email and get their role straight away.
-- * If someone's Microsoft account is switched off (or removed), the sync
--   switches off their access here too. Switching someone back on stays a
--   manual admin decision.
-- * Only admins can see or change any of this. The daily sync proves itself
--   with a secret key whose fingerprint (hash) is stored here; the key itself
--   only lives in Netlify.

-- ─── Tables ─────────────────────────────────────────────────────────────────

create table public.staff_directory (
  id               uuid primary key default gen_random_uuid(),
  entra_id         text not null unique,
  email            text not null,
  display_name     text,
  job_title        text,
  department       text,
  office_location  text,
  account_enabled  boolean not null default true,
  in_entra         boolean not null default true,
  profile_id       uuid unique references public.profiles (id) on delete set null,
  role_id          uuid references public.roles (id) on delete set null,
  first_seen_at    timestamptz not null default now(),
  last_synced_at   timestamptz,
  updated_at       timestamptz not null default now()
);
create index staff_directory_email_idx on public.staff_directory (lower(email));

create table public.job_role_rules (
  id          uuid primary key default gen_random_uuid(),
  match_text  text not null check (length(trim(match_text)) > 0),
  role_id     uuid not null references public.roles (id) on delete cascade,
  priority    integer not null default 100,
  created_at  timestamptz not null default now(),
  unique (match_text, role_id)
);

create table public.directory_sync_runs (
  id            uuid primary key default gen_random_uuid(),
  ran_at        timestamptz not null default now(),
  trigger       text not null check (trigger in ('manual', 'scheduled')),
  run_by        uuid references public.profiles (id) on delete set null,
  users_seen    integer not null default 0,
  added         integer not null default 0,
  switched_off  integer not null default 0,
  status        text not null check (status in ('ok', 'failed')),
  error         text
);

create table public.directory_sync_settings (
  id             boolean primary key default true check (id),
  cron_key_hash  text,
  key_set_at     timestamptz
);
insert into public.directory_sync_settings (id) values (true);

alter table public.user_roles
  add column source text not null default 'manual' check (source in ('manual', 'directory'));

-- ─── Security ───────────────────────────────────────────────────────────────

alter table public.staff_directory enable row level security;
alter table public.job_role_rules enable row level security;
alter table public.directory_sync_runs enable row level security;
alter table public.directory_sync_settings enable row level security;

create policy "Admins read the directory" on public.staff_directory for select to authenticated using (public.is_admin());
create policy "Admins set directory roles" on public.staff_directory for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage job role rules" on public.job_role_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins read sync runs" on public.directory_sync_runs for select to authenticated using (public.is_admin());
create policy "Admins read sync settings" on public.directory_sync_settings for select to authenticated using (public.is_admin());
revoke all on public.staff_directory, public.job_role_rules, public.directory_sync_runs, public.directory_sync_settings from anon;

create trigger audit_staff_directory after insert or update or delete on public.staff_directory
  for each row execute function public.audit_row();
create trigger audit_job_role_rules after insert or update or delete on public.job_role_rules
  for each row execute function public.audit_row();

-- Admins (and only admins) may change admin/active flags — or the directory
-- sync, which sets a flag for the length of its own transaction. The flag
-- can't be set through the API: only these functions run raw SQL.
create or replace function public.protect_profile_flags()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (new.is_admin is distinct from old.is_admin or new.is_active is distinct from old.is_active) then
    if coalesce(current_setting('footprint.directory_sync', true), '') = 'on'
       and new.is_admin is not distinct from old.is_admin
       and new.is_active = false then
      -- The directory sync switching off a leaver: allowed.
      null;
    else
      if not public.is_admin() then
        raise exception 'Only admins can change admin or active status';
      end if;
      if new.id = auth.uid() then
        raise exception 'You cannot change your own admin or active status';
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ─── Matching job titles to roles ───────────────────────────────────────────

-- The role a job title gets: the first rule whose text appears in the title
-- (ignoring capitals). Lower priority number wins; then the longest match.
create function public.suggested_role(p_job_title text)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select r.role_id
    from public.job_role_rules r
   where p_job_title is not null
     and position(lower(trim(r.match_text)) in lower(p_job_title)) > 0
   order by r.priority, length(r.match_text) desc
   limit 1;
$$;

-- Bring one person's directory role (and active status) up to date.
create function public._apply_directory_access(p_profile_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  d public.staff_directory%rowtype;
  wanted uuid;
begin
  select * into d from public.staff_directory where profile_id = p_profile_id;
  if not found then
    return;
  end if;
  wanted := coalesce(d.role_id, public.suggested_role(d.job_title));

  delete from public.user_roles
   where user_id = p_profile_id and source = 'directory'
     and (wanted is null or role_id <> wanted);
  if wanted is not null then
    insert into public.user_roles (user_id, role_id, source)
    values (p_profile_id, wanted, 'directory')
    on conflict (user_id, role_id) do nothing;
  end if;

  if not d.account_enabled or not d.in_entra then
    perform set_config('footprint.directory_sync', 'on', true);
    update public.profiles set is_active = false where id = p_profile_id and is_active;
    perform set_config('footprint.directory_sync', '', true);
  end if;
end;
$$;

-- Admin changed a rule or a person's chosen role: re-apply to everyone linked.
create function public.reapply_directory_roles()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  p uuid;
  n integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Only admins can do this';
  end if;
  for p in select profile_id from public.staff_directory where profile_id is not null loop
    perform public._apply_directory_access(p);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ─── The sync ───────────────────────────────────────────────────────────────

-- Receives the list of Microsoft 365 users (fetched by the app) and updates
-- the directory. Allowed for a signed-in admin, or for the daily job when it
-- presents the right key.
create function public.directory_sync_apply(p_users jsonb, p_key text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  scheduled boolean := false;
  seen integer;
  added integer;
  off_before integer;
  off_after integer;
  p uuid;
begin
  if not public.is_admin() then
    if p_key is null or length(p_key) < 32
       or encode(sha256(convert_to(p_key, 'UTF8')), 'hex') is distinct from
          (select cron_key_hash from public.directory_sync_settings where id) then
      raise exception 'Not allowed';
    end if;
    scheduled := true;
  end if;

  if jsonb_typeof(p_users) <> 'array' or jsonb_array_length(p_users) = 0 then
    -- Never treat an empty answer from Microsoft as "everyone has left".
    insert into public.directory_sync_runs (trigger, run_by, status, error)
    values (case when scheduled then 'scheduled' else 'manual' end, auth.uid(), 'failed', 'Microsoft returned no users');
    return jsonb_build_object('ok', false, 'error', 'Microsoft returned no users');
  end if;

  select count(*) into off_before from public.profiles where not is_active;
  select count(*) into added from public.staff_directory;

  insert into public.staff_directory as d
    (entra_id, email, display_name, job_title, department, office_location, account_enabled, in_entra, last_synced_at)
  select u ->> 'id', lower(trim(u ->> 'email')), nullif(trim(u ->> 'displayName'), ''),
         nullif(trim(u ->> 'jobTitle'), ''), nullif(trim(u ->> 'department'), ''),
         nullif(trim(u ->> 'officeLocation'), ''), coalesce((u ->> 'accountEnabled')::boolean, true), true, now()
    from jsonb_array_elements(p_users) u
   where coalesce(u ->> 'id', '') <> '' and coalesce(u ->> 'email', '') like '%@%'
  on conflict (entra_id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    job_title = excluded.job_title,
    department = excluded.department,
    office_location = excluded.office_location,
    account_enabled = excluded.account_enabled,
    in_entra = true,
    last_synced_at = now(),
    updated_at = now();

  seen := jsonb_array_length(p_users);
  select count(*) - added into added from public.staff_directory;

  -- Anyone no longer in Microsoft 365 has left.
  update public.staff_directory set in_entra = false, updated_at = now()
   where in_entra
     and not exists (select 1 from jsonb_array_elements(p_users) u where u ->> 'id' = staff_directory.entra_id);

  -- Link people who have already signed in.
  update public.staff_directory d set profile_id = pr.id
    from public.profiles pr
   where d.profile_id is null and lower(pr.email) = d.email
     and not exists (select 1 from public.staff_directory x where x.profile_id = pr.id);

  for p in select profile_id from public.staff_directory where profile_id is not null loop
    perform public._apply_directory_access(p);
  end loop;

  select count(*) into off_after from public.profiles where not is_active;

  insert into public.directory_sync_runs (trigger, run_by, users_seen, added, switched_off, status)
  values (case when scheduled then 'scheduled' else 'manual' end, auth.uid(), seen, added,
          greatest(off_after - off_before, 0), 'ok');

  return jsonb_build_object('ok', true, 'seen', seen, 'added', added, 'switched_off', greatest(off_after - off_before, 0));
end;
$$;

-- Admin records the fingerprint of a new daily-sync key (the key itself is
-- shown once in the admin's browser and pasted into Netlify).
create function public.set_directory_sync_key_hash(p_hash text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can do this';
  end if;
  if p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid key fingerprint';
  end if;
  update public.directory_sync_settings set cron_key_hash = p_hash, key_set_at = now() where id;
end;
$$;

-- ─── First sign-in ──────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
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

  -- Already listed from Microsoft 365? Link them and give them their role.
  update public.staff_directory set profile_id = new.id
   where profile_id is null and email = lower(coalesce(new.email, ''));
  perform public._apply_directory_access(new.id);
  return new;
end;
$$;

revoke execute on function public.suggested_role(text) from anon, public;
revoke execute on function public._apply_directory_access(uuid) from anon, authenticated, public;
revoke execute on function public.reapply_directory_roles() from anon, public;
revoke execute on function public.set_directory_sync_key_hash(text) from anon, public;
revoke execute on function public.directory_sync_apply(jsonb, text) from public;
grant execute on function public.suggested_role(text) to authenticated;
grant execute on function public.reapply_directory_roles() to authenticated;
grant execute on function public.set_directory_sync_key_hash(text) to authenticated;
grant execute on function public.directory_sync_apply(jsonb, text) to anon, authenticated;
