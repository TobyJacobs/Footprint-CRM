-- Staff are switched on by an admin, with an invite (owner request,
-- 5 October 2026).
--
-- Plain-English summary:
-- * Only licensed Microsoft 365 users are listed (the app filters out shared
--   mailboxes and other unlicensed accounts before syncing).
-- * Everyone in the staff directory starts NOT activated. Being in Microsoft
--   365, or signing in, gives no access until an admin presses "Activate".
--   Admins are never switched off by this, so nobody can lock the platform.
-- * Activating someone switches them on with their role and creates an
--   invite link (`invite_token`). The link only leads to the welcome / sign-in
--   page: it grants nothing by itself; they still sign in with Microsoft.
-- * "Deactivate" switches them off again.
-- * Statuses: not activated → invited (activated, hasn't signed in yet) →
--   active (has signed in).

alter table public.staff_directory
  add column activated     boolean not null default false,
  add column activated_at  timestamptz,
  add column activated_by  uuid references public.profiles (id) on delete set null,
  add column invite_token  uuid unique,
  add column invited_at    timestamptz,
  add column joined_at     timestamptz;

-- The directory sync may now switch people on as well as off (only for
-- activated staff), still never touching admin rights.
create or replace function public.protect_profile_flags()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (new.is_admin is distinct from old.is_admin or new.is_active is distinct from old.is_active) then
    if coalesce(current_setting('footprint.directory_sync', true), '') = 'on'
       and new.is_admin is not distinct from old.is_admin then
      null;  -- staff activation / deactivation by the directory functions
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

-- Bring one person's role and on/off status in line with the directory.
create or replace function public._apply_directory_access(p_profile_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  d public.staff_directory%rowtype;
  wanted uuid;
  should_be_active boolean;
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

  should_be_active := d.activated and d.account_enabled and d.in_entra;
  perform set_config('footprint.directory_sync', 'on', true);
  update public.profiles set is_active = should_be_active
   where id = p_profile_id
     and is_active is distinct from should_be_active
     and not is_admin;            -- admins are never switched on/off from here
  perform set_config('footprint.directory_sync', '', true);
end;
$$;

-- First sign-in: only the very first person (who becomes admin) or someone an
-- admin has activated gets access straight away.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  make_admin boolean;
  activated boolean;
begin
  perform pg_advisory_xact_lock(hashtext('footprint_first_admin'));
  select not exists (select 1 from public.profiles where is_admin) into make_admin;
  select coalesce(bool_or(d.activated and d.account_enabled and d.in_entra), false) into activated
    from public.staff_directory d where d.email = lower(coalesce(new.email, ''));

  insert into public.profiles (id, email, full_name, is_admin, is_active)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    make_admin,
    make_admin or activated
  );

  update public.staff_directory
     set profile_id = new.id,
         joined_at = case when activated then coalesce(joined_at, now()) else joined_at end
   where profile_id is null and email = lower(coalesce(new.email, ''));
  perform public._apply_directory_access(new.id);
  return new;
end;
$$;

-- Admin: switch someone on and get their invite link token.
create function public.activate_staff(p_directory_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  d public.staff_directory%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admins can activate staff';
  end if;
  update public.staff_directory set
    activated = true,
    activated_at = coalesce(activated_at, now()),
    activated_by = coalesce(activated_by, auth.uid()),
    invite_token = coalesce(invite_token, gen_random_uuid()),
    invited_at = now(),
    updated_at = now()
  where id = p_directory_id and in_entra and account_enabled
  returning * into d;
  if not found then
    raise exception 'This person isn''t a current, switched-on Microsoft 365 user';
  end if;
  if d.profile_id is not null then
    perform public._apply_directory_access(d.profile_id);
  end if;
  return jsonb_build_object('token', d.invite_token, 'email', d.email, 'name', d.display_name);
end;
$$;

-- Admin: switch someone off (their invite link stops being shown as valid).
create function public.deactivate_staff(p_directory_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  d public.staff_directory%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admins can deactivate staff';
  end if;
  select * into d from public.staff_directory where id = p_directory_id;
  if not found then
    raise exception 'Not found';
  end if;
  if d.profile_id = auth.uid() then
    raise exception 'You cannot deactivate yourself';
  end if;
  if exists (select 1 from public.profiles p where p.id = d.profile_id and p.is_admin) then
    raise exception 'Remove their admin rights first (Admin → Users → their page)';
  end if;
  update public.staff_directory set activated = false, invite_token = null, updated_at = now()
   where id = p_directory_id;
  if d.profile_id is not null then
    perform public._apply_directory_access(d.profile_id);
  end if;
end;
$$;

-- The welcome page: who an invite link is for (first name only), if valid.
create function public.get_staff_invite(p_token uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('first_name', split_part(coalesce(d.display_name, ''), ' ', 1))
    from public.staff_directory d
   where d.invite_token = p_token and d.activated and d.in_entra and d.account_enabled;
$$;

-- Sign-in records when an activated person first joins.
create function public.mark_staff_joined()
returns void
language sql security definer set search_path = ''
as $$
  update public.staff_directory set joined_at = now()
   where profile_id = auth.uid() and activated and joined_at is null;
$$;

revoke execute on function public.activate_staff(uuid) from anon, public;
revoke execute on function public.deactivate_staff(uuid) from anon, public;
revoke execute on function public.get_staff_invite(uuid) from public;
revoke execute on function public.mark_staff_joined() from anon, public;
grant execute on function public.activate_staff(uuid) to authenticated;
grant execute on function public.deactivate_staff(uuid) to authenticated;
grant execute on function public.get_staff_invite(uuid) to anon, authenticated;
grant execute on function public.mark_staff_joined() to authenticated;

-- Everyone already listed starts not activated (admins keep their access).
update public.staff_directory set activated = false;
do $$
declare p uuid;
begin
  for p in select profile_id from public.staff_directory where profile_id is not null loop
    perform public._apply_directory_access(p);
  end loop;
end $$;
