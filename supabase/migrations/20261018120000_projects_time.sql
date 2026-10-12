-- Wave 3: Projects, tasks and time tracking (7 October 2026).
--
-- Plain-English summary:
-- * Projects: optionally linked to a customer and a sales order (internal
--   projects with no customer are allowed). Each has an owner, status,
--   deadline and an optional hours budget.
-- * Tasks inside a project, with an assigned person, due date and status.
-- * Time entries: hours someone worked on a project (and optionally a task)
--   on a day.
-- * Who sees what: anyone with Projects & Time access sees all projects and
--   tasks. Time entries are private to the person who logged them, except for
--   managers (admins, and roles given "delete" on Projects & Time, which the
--   Directors get) who see everyone's and can fix or remove entries.
-- * Everyone with Projects & Time access can log their own time. Starting
--   permissions: Directors, Operations, Sales and Finance can view and edit;
--   Directors can also delete. Admins can change this in Roles.
-- * Every change is written to the audit log.

create table public.projects (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(trim(name)) > 0),
  customer_id      uuid references public.customers (id) on delete set null,
  sales_document_id uuid references public.sales_documents (id) on delete set null,
  owner_id         uuid references public.profiles (id) on delete set null,
  status           text not null default 'active' check (status in ('planned', 'active', 'on_hold', 'done', 'cancelled')),
  start_date       date,
  due_date         date,
  budget_hours     numeric(8,2) check (budget_hours is null or budget_hours >= 0),
  description      text,
  created_at       timestamptz not null default now(),
  created_by       uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles (id) on delete set null
);
create index projects_customer_idx on public.projects (customer_id);
create index projects_owner_idx on public.projects (owner_id);
create index projects_status_idx on public.projects (status);

create table public.project_tasks (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects (id) on delete cascade,
  title          text not null check (length(trim(title)) > 0),
  details        text,
  assignee_id    uuid references public.profiles (id) on delete set null,
  status         text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  due_date       date,
  estimate_hours numeric(6,2) check (estimate_hours is null or estimate_hours >= 0),
  position       integer not null default 0,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.profiles (id) on delete set null
);
create index project_tasks_project_idx on public.project_tasks (project_id, position);
create index project_tasks_assignee_idx on public.project_tasks (assignee_id);

create table public.time_entries (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  task_id     uuid references public.project_tasks (id) on delete set null,
  user_id     uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  work_date   date not null default current_date,
  hours       numeric(5,2) not null check (hours > 0 and hours <= 24),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null
);
create index time_entries_user_date_idx on public.time_entries (user_id, work_date);
create index time_entries_project_idx on public.time_entries (project_id, work_date);

create trigger projects_touch before update on public.projects for each row execute function public.touch_row();
create trigger project_tasks_touch before update on public.project_tasks for each row execute function public.touch_row();
create trigger time_entries_touch before update on public.time_entries for each row execute function public.touch_row();

-- Stamp when a task is finished.
create function public.stamp_task_done()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;
create trigger project_tasks_done before insert or update of status on public.project_tasks
  for each row execute function public.stamp_task_done();

create trigger audit_projects after insert or update or delete on public.projects for each row execute function public.audit_row();
create trigger audit_project_tasks after insert or update or delete on public.project_tasks for each row execute function public.audit_row();
create trigger audit_time_entries after insert or update or delete on public.time_entries for each row execute function public.audit_row();

-- Managers: admins, and roles that can delete in Projects & Time.
create function public.is_projects_manager()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or public.has_permission('projects', 'delete');
$$;
revoke execute on function public.is_projects_manager() from anon, public;
grant execute on function public.is_projects_manager() to authenticated;

alter table public.projects enable row level security;
alter table public.project_tasks enable row level security;
alter table public.time_entries enable row level security;

create policy "View projects" on public.projects for select to authenticated using (public.has_permission('projects', 'view'));
create policy "Add projects" on public.projects for insert to authenticated with check (public.has_permission('projects', 'edit'));
create policy "Change projects" on public.projects for update to authenticated using (public.has_permission('projects', 'edit')) with check (public.has_permission('projects', 'edit'));
create policy "Remove projects" on public.projects for delete to authenticated using (public.has_permission('projects', 'delete'));

create policy "View project tasks" on public.project_tasks for select to authenticated using (public.has_permission('projects', 'view'));
create policy "Add project tasks" on public.project_tasks for insert to authenticated with check (public.has_permission('projects', 'edit'));
create policy "Change project tasks" on public.project_tasks for update to authenticated using (public.has_permission('projects', 'edit')) with check (public.has_permission('projects', 'edit'));
create policy "Remove project tasks" on public.project_tasks for delete to authenticated using (public.has_permission('projects', 'edit'));

create policy "View time" on public.time_entries for select to authenticated
  using (public.has_permission('projects', 'view') and (user_id = auth.uid() or public.is_projects_manager()));
create policy "Log time" on public.time_entries for insert to authenticated
  with check (public.has_permission('projects', 'edit') and (user_id = auth.uid() or public.is_projects_manager()));
create policy "Change time" on public.time_entries for update to authenticated
  using (public.has_permission('projects', 'edit') and (user_id = auth.uid() or public.is_projects_manager()))
  with check (public.has_permission('projects', 'edit') and (user_id = auth.uid() or public.is_projects_manager()));
create policy "Remove time" on public.time_entries for delete to authenticated
  using (public.has_permission('projects', 'edit') and (user_id = auth.uid() or public.is_projects_manager()));

revoke all on public.projects, public.project_tasks, public.time_entries from anon;

-- Total hours per project (visible to anyone who can see the project, without
-- exposing who logged what).
create function public.project_hours()
returns table (project_id uuid, hours numeric)
language sql stable security definer set search_path = ''
as $$
  select t.project_id, sum(t.hours)
    from public.time_entries t
   where public.has_permission('projects', 'view')
   group by t.project_id;
$$;
revoke execute on function public.project_hours() from anon, public;
grant execute on function public.project_hours() to authenticated;

-- Starting permissions.
insert into public.role_permissions (role_id, feature, action)
select r.id, p.feature, p.action
  from public.roles r
  join (values
    ('Directors', 'projects', 'view'), ('Directors', 'projects', 'edit'), ('Directors', 'projects', 'delete'),
    ('Operations team', 'projects', 'view'), ('Operations team', 'projects', 'edit'),
    ('Sales team', 'projects', 'view'), ('Sales team', 'projects', 'edit'),
    ('Finance team', 'projects', 'view'), ('Finance team', 'projects', 'edit')
  ) as p(role_name, feature, action) on p.role_name = r.name
on conflict do nothing;
