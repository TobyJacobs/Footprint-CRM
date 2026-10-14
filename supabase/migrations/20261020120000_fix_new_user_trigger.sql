-- Fix: first-time sign-in failed with "Database error saving new user".
--
-- In handle_new_user() a variable called "activated" had the same name as the
-- staff_directory column "activated", so the UPDATE inside it was ambiguous and
-- Postgres refused it. Nothing else changes: the variable is renamed.

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  make_admin boolean;
  v_activated boolean;
begin
  perform pg_advisory_xact_lock(hashtext('footprint_first_admin'));
  select not exists (select 1 from public.profiles where is_admin) into make_admin;

  select coalesce(bool_or(d.activated and d.account_enabled and d.in_entra), false) into v_activated
    from public.staff_directory d where d.email = lower(coalesce(new.email, ''));

  insert into public.profiles (id, email, full_name, is_admin, is_active)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    make_admin,
    make_admin or v_activated
  );

  update public.staff_directory d
     set profile_id = new.id,
         joined_at = case when v_activated then coalesce(d.joined_at, now()) else d.joined_at end
   where d.profile_id is null and d.email = lower(coalesce(new.email, ''));

  perform public._apply_directory_access(new.id);
  return new;
end;
$$;

insert into supabase_migrations.schema_migrations (version, name) values ('20261020120000', 'fix_new_user_trigger');
