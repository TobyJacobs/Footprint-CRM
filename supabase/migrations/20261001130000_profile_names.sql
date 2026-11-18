-- Fill in people's names from Microsoft when they sign in.
--
-- The first sign-ins only asked Microsoft for email, so names were blank.
-- Now that sign-in also asks for the profile (name), this copies the name
-- onto the person's profile each time they sign in — but only if their
-- profile has no name yet, so a name set by an admin is never overwritten.

create function public.sync_profile_name()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  new_name text := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name');
begin
  if new_name is not null and length(trim(new_name)) > 0 then
    update public.profiles
       set full_name = new_name
     where id = new.id
       and (full_name is null or length(trim(full_name)) = 0);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_updated_name
  after update of raw_user_meta_data on auth.users
  for each row execute function public.sync_profile_name();

revoke execute on function public.sync_profile_name() from anon, public;
