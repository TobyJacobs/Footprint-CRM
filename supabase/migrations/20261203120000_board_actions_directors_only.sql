-- Board-only FootprintAI actions: Directors only (owner, 11 November 2026).
--
-- Plain-English summary:
-- * Before: admins and Directors saw board-only actions, and every staff
--   member is an admin, so everyone could see them.
-- * Now: only people with the Directors role see, add, change or delete
--   board-only actions, even in a direct query. Being an admin or owning the
--   action isn't enough. Everything else about the tracker is unchanged.

-- Has the signed-in person (active) got the Directors role? No admin bypass.
create function public._transition_director()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      join public.profiles p on p.id = ur.user_id
     where ur.user_id = auth.uid() and p.is_active and r.name = 'Directors');
$$;
revoke execute on function public._transition_director() from public, anon;
grant execute on function public._transition_director() to authenticated;

-- Owning only board-only actions no longer opens the section for non-directors.
create or replace function public._transition_owner()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.transition_actions a
     where a.owner_id = public._my_directory_id()
       and (a.visibility = 'all' or public._transition_director()));
$$;

drop policy "See actions" on public.transition_actions;
drop policy "Add actions" on public.transition_actions;
drop policy "Change actions" on public.transition_actions;
drop policy "Delete actions" on public.transition_actions;

create policy "See actions" on public.transition_actions for select to authenticated
  using (case when visibility = 'board' then (select public._transition_director())
              else (select public._transition_full())
                or (select public._transition_member())
                or owner_id = (select public._my_directory_id()) end);
create policy "Add actions" on public.transition_actions for insert to authenticated
  with check (case when visibility = 'board' then (select public._transition_director())
                   else (select public._transition_full()) or (select public._transition_member()) end);
create policy "Change actions" on public.transition_actions for update to authenticated
  using (case when visibility = 'board' then (select public._transition_director())
              else (select public._transition_full())
                or (select public._transition_member())
                or owner_id = (select public._my_directory_id()) end)
  with check (case when visibility = 'board' then (select public._transition_director())
                   else (select public._transition_full())
                     or (select public._transition_member())
                     or owner_id = (select public._my_directory_id()) end);
create policy "Delete actions" on public.transition_actions for delete to authenticated
  using ((select public._transition_full())
     and (visibility = 'all' or (select public._transition_director())));
