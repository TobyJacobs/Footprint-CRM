-- Wave 3 (part 1): projects, tasks and time (replaces Zoho Projects).
--
-- Plain-English summary:
-- * `projects`: one per job, numbered FO-… (continuing Zoho's numbers),
--   linked to the customer and normally to a sales order (and its quote).
--   Status: active, on hold, completed or cancelled. Group: Swindon –
--   Production, Swindon – Studio, Web Project, Marketing Retained (as in Zoho).
-- * `project_tasks`: checklist tasks grouped into stages (Zoho's "task
--   lists"), each with an assignee, due date and status.
-- * `project_templates` and their tasks: the standard stages and steps for
--   each kind of job. Editable by anyone who can edit projects.
-- * Every new sales order automatically gets a project from the template
--   matching its business unit (or the default template).
-- * `time_logs`: time against a project (and optionally a task): a running
--   timer or hours typed in, billable or not. People manage their own time;
--   those who can delete projects can correct anyone's.
-- * `staff_cost_rates`: hourly cost per person, to show profit after staff
--   time. Only admins, directors and finance can see them; admins change them.
-- * Also fixes document numbers being cut short once they outgrow their
--   padding (e.g. FO-10000).
--
-- Access uses the existing "projects" permission (view / edit / delete).

-- ─── Numbering ──────────────────────────────────────────────────────────────

insert into public.number_sequences (doc_type, prefix, next_number, padding)
values ('project', 'FO-', 1498, 4)
on conflict (doc_type) do nothing;

create or replace function public._take_document_number(p_doc_type text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  s public.number_sequences%rowtype;
  n text;
begin
  update public.number_sequences
     set next_number = next_number + 1
   where doc_type = p_doc_type
  returning * into s;
  if not found then
    raise exception 'Unknown document type %', p_doc_type;
  end if;
  n := (s.next_number - 1)::text;
  return s.prefix || lpad(n, greatest(s.padding, length(n)), '0');
end;
$$;
revoke execute on function public._take_document_number(text) from anon, authenticated, public;

create or replace function public.next_document_number(p_doc_type text)
returns text
language plpgsql security definer set search_path = ''
as $$
begin
  if p_doc_type = 'project' then
    if not public.has_permission('projects', 'edit') then
      raise exception 'Not allowed';
    end if;
  elsif not public.has_permission('quotes', 'edit') then
    raise exception 'Not allowed';
  end if;
  return public._take_document_number(p_doc_type);
end;
$$;

-- ─── Templates ──────────────────────────────────────────────────────────────

create table public.project_templates (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique check (length(trim(name)) > 0),
  description    text,
  project_group  text,
  business_unit  text,            -- sales orders with this business unit use it
  is_default     boolean not null default false,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);
create unique index project_templates_one_default on public.project_templates ((is_default)) where is_default;

create table public.project_template_tasks (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.project_templates (id) on delete cascade,
  stage        text not null default 'General',
  position     integer not null default 0,
  title        text not null check (length(trim(title)) > 0),
  due_offset_days integer        -- due this many days after the project starts (optional)
);
create index project_template_tasks_idx on public.project_template_tasks (template_id, position);

-- ─── Projects ───────────────────────────────────────────────────────────────

create table public.projects (
  id                 uuid primary key default gen_random_uuid(),
  number             text not null unique,
  name               text not null check (length(trim(name)) > 0),
  customer_id        uuid references public.customers (id) on delete restrict,
  sales_document_id  uuid references public.sales_documents (id) on delete set null,
  owner_id           uuid references public.profiles (id) on delete set null,
  template_id        uuid references public.project_templates (id) on delete set null,
  project_group      text,
  status             text not null default 'active' check (status in ('active', 'on_hold', 'completed', 'cancelled')),
  start_date         date not null default current_date,
  due_date           date,
  overview           text,
  completed_at       timestamptz,
  zoho_id            text unique,
  created_at         timestamptz not null default now(),
  created_by         uuid default auth.uid(),
  updated_at         timestamptz not null default now(),
  updated_by         uuid
);
create index projects_customer_idx on public.projects (customer_id);
create index projects_status_idx on public.projects (status, due_date);
create unique index projects_one_per_order on public.projects (sales_document_id) where sales_document_id is not null;

create table public.project_tasks (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  stage         text not null default 'General',
  position      integer not null default 0,
  title         text not null check (length(trim(title)) > 0),
  notes         text,
  assignee_id   uuid references public.profiles (id) on delete set null,
  due_date      date,
  status        text not null default 'open' check (status in ('open', 'in_progress', 'done')),
  completed_at  timestamptz,
  completed_by  uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);
create index project_tasks_project_idx on public.project_tasks (project_id, position);
create index project_tasks_assignee_idx on public.project_tasks (assignee_id, status, due_date);

-- Fill in / clear the "completed" stamps when a task's status changes.
create function public.stamp_task_completion()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := now();
    new.completed_by := auth.uid();
  elsif new.status <> 'done' then
    new.completed_at := null;
    new.completed_by := null;
  end if;
  return new;
end;
$$;
create trigger project_tasks_completion before insert or update of status on public.project_tasks
  for each row execute function public.stamp_task_completion();

create function public.stamp_project_completion()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := now();
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;
create trigger projects_completion before update of status on public.projects
  for each row execute function public.stamp_project_completion();

-- ─── Time ───────────────────────────────────────────────────────────────────

create table public.time_logs (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  task_id      uuid references public.project_tasks (id) on delete set null,
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  log_date     date not null default current_date,
  minutes      integer check (minutes is null or (minutes > 0 and minutes <= 24 * 60)),
  started_at   timestamptz,    -- set while a timer is running (minutes is then empty)
  billable     boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  check (minutes is not null or started_at is not null)
);
create index time_logs_project_idx on public.time_logs (project_id, log_date);
create index time_logs_user_idx on public.time_logs (user_id, log_date);
create unique index time_logs_one_running_timer on public.time_logs (user_id) where minutes is null;

create table public.staff_cost_rates (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  hourly_cost  numeric(8,2) not null check (hourly_cost >= 0),
  is_example   boolean not null default false,
  updated_at   timestamptz not null default now(),
  updated_by   uuid
);

-- The cost rate used for anyone without their own (example to start).
alter table public.company_settings
  add column default_hourly_cost numeric(8,2) not null default 25,
  add column default_hourly_cost_is_example boolean not null default true;

-- ─── Security ───────────────────────────────────────────────────────────────

alter table public.project_templates enable row level security;
alter table public.project_template_tasks enable row level security;
alter table public.projects enable row level security;
alter table public.project_tasks enable row level security;
alter table public.time_logs enable row level security;
alter table public.staff_cost_rates enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['project_templates', 'project_template_tasks', 'projects', 'project_tasks'] loop
    execute format('create policy "View projects" on public.%I for select to authenticated using (public.has_permission(''projects'', ''view''))', t);
    execute format('create policy "Add projects" on public.%I for insert to authenticated with check (public.has_permission(''projects'', ''edit''))', t);
    execute format('create policy "Change projects" on public.%I for update to authenticated using (public.has_permission(''projects'', ''edit'')) with check (public.has_permission(''projects'', ''edit''))', t);
    execute format('create policy "Remove projects" on public.%I for delete to authenticated using (public.has_permission(''projects'', ''delete''))', t);
  end loop;
end $$;

-- Anyone who can see projects can see the time logged on them, and record
-- their own. Changing or removing someone else's time needs "delete".
create policy "View time" on public.time_logs for select to authenticated
  using (public.has_permission('projects', 'view'));
create policy "Log own time" on public.time_logs for insert to authenticated
  with check (public.has_permission('projects', 'view') and user_id = auth.uid());
create policy "Change own time" on public.time_logs for update to authenticated
  using (public.has_permission('projects', 'view') and (user_id = auth.uid() or public.has_permission('projects', 'delete')))
  with check (public.has_permission('projects', 'view') and (user_id = auth.uid() or public.has_permission('projects', 'delete')));
create policy "Remove own time" on public.time_logs for delete to authenticated
  using (public.has_permission('projects', 'view') and (user_id = auth.uid() or public.has_permission('projects', 'delete')));

create policy "Directors, finance and admins see cost rates" on public.staff_cost_rates for select to authenticated
  using (public.is_admin() or public.my_dashboards() && array['director', 'finance']);
create policy "Admins manage cost rates" on public.staff_cost_rates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.project_templates, public.project_template_tasks, public.projects,
  public.project_tasks, public.time_logs, public.staff_cost_rates from anon;

do $$
declare
  t text;
begin
  foreach t in array array['project_templates', 'projects', 'project_tasks', 'time_logs', 'staff_cost_rates'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_row()', t || '_touch', t);
  end loop;
  foreach t in array array['project_templates', 'project_template_tasks', 'projects', 'project_tasks', 'time_logs', 'staff_cost_rates'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', 'audit_' || t, t);
  end loop;
end $$;

-- Cost of staff time on each project, worked out with the rates, but only
-- returned to people allowed to see rates (otherwise null).
create function public.project_time_costs(p_project_ids uuid[])
returns table (project_id uuid, minutes bigint, billable_minutes bigint, cost numeric)
language sql stable security definer set search_path = ''
as $$
  select t.project_id,
         sum(t.minutes)::bigint,
         sum(t.minutes) filter (where t.billable)::bigint,
         case when public.is_admin() or public.my_dashboards() && array['director', 'finance']
              then round(sum(t.minutes * coalesce(r.hourly_cost, s.default_hourly_cost) / 60.0), 2) end
    from public.time_logs t
    left join public.staff_cost_rates r on r.user_id = t.user_id
    cross join (select default_hourly_cost from public.company_settings limit 1) s
   where t.project_id = any(p_project_ids) and t.minutes is not null
     and public.has_permission('projects', 'view')
   group by t.project_id;
$$;
revoke execute on function public.project_time_costs(uuid[]) from anon, public;
grant execute on function public.project_time_costs(uuid[]) to authenticated;

-- ─── New sales order → new project ──────────────────────────────────────────

-- Creates the project for a sales order (once). Used by the trigger below,
-- and to back-fill existing orders.
create function public._create_project_for_sales_order(p_order uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  so public.sales_documents%rowtype;
  tpl public.project_templates%rowtype;
  pid uuid;
  num text;
  cust_name text;
begin
  select * into so from public.sales_documents where id = p_order and doc_type = 'sales_order';
  if not found then
    return null;
  end if;
  select id into pid from public.projects where sales_document_id = so.id;
  if found then
    return pid;
  end if;

  select * into tpl from public.project_templates
   where active and business_unit is not null and business_unit = so.business_unit
   order by name limit 1;
  if not found then
    select * into tpl from public.project_templates where active and is_default limit 1;
  end if;

  select name into cust_name from public.customers where id = so.customer_id;
  num := public._take_document_number('project');

  insert into public.projects
    (number, name, customer_id, sales_document_id, owner_id, template_id, project_group, start_date, due_date)
  values
    (num, left(coalesce(cust_name, 'Customer') || ' – ' || coalesce(nullif(trim(so.title), ''), 'Order ' || so.number), 200),
     so.customer_id, so.id, so.owner_id, tpl.id, tpl.project_group, coalesce(so.issue_date, current_date), so.deadline_date)
  returning id into pid;

  if tpl.id is not null then
    insert into public.project_tasks (project_id, stage, position, title, due_date)
    select pid, tt.stage, tt.position, tt.title,
           case when tt.due_offset_days is not null then coalesce(so.issue_date, current_date) + tt.due_offset_days end
      from public.project_template_tasks tt
     where tt.template_id = tpl.id;
  end if;

  insert into public.customer_activity (customer_id, kind, body)
  values (so.customer_id, 'system', 'Project ' || num || ' started for sales order ' || so.number || '.');
  return pid;
end;
$$;
revoke execute on function public._create_project_for_sales_order(uuid) from anon, authenticated, public;

create function public._create_project_for_order()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.doc_type = 'sales_order' then
    perform public._create_project_for_sales_order(new.id);
  end if;
  return new;
end;
$$;
revoke execute on function public._create_project_for_order() from anon, authenticated, public;

create trigger sales_orders_create_project after insert on public.sales_documents
  for each row execute function public._create_project_for_order();

-- ─── Starting templates (based on Zoho Projects today; edit freely) ─────────

insert into public.project_templates (name, description, project_group, business_unit, is_default) values
  ('Production job', 'Print, signage and merchandise jobs made in Swindon.', 'Swindon – Production', 'Print', true),
  ('Studio / design job', 'Design work done by the studio.', 'Swindon – Studio', null, false),
  ('Web project', 'New websites and website updates.', 'Web Project', null, false),
  ('Marketing retainer', 'Monthly digital marketing work.', 'Marketing Retained', 'Digital', false);

insert into public.project_template_tasks (template_id, stage, position, title, due_offset_days)
select t.id, v.stage, v.position, v.title, v.due
  from public.project_templates t
  join (values
    ('Production job', 'Production', 1, 'Artwork approved by customer', 2),
    ('Production job', 'Production', 2, 'Materials ordered / due in', 3),
    ('Production job', 'Production', 3, 'Print', 5),
    ('Production job', 'Production', 4, 'Laminate', 5),
    ('Production job', 'Production', 5, 'Cut', 6),
    ('Production job', 'Production', 6, 'Mount / finish', 6),
    ('Production job', 'Production', 7, 'Installed or dispatched', 8),
    ('Production job', 'Production', 8, 'Job completed', 8),
    ('Production job', 'Finance & invoicing', 9, 'Passed to finance', 9),
    ('Production job', 'Finance & invoicing', 10, 'Invoiced', 10),
    ('Studio / design job', 'Design', 1, 'Brief received', 1),
    ('Studio / design job', 'Design', 2, 'First proof sent', 3),
    ('Studio / design job', 'Design', 3, 'Amends done', 5),
    ('Studio / design job', 'Design', 4, 'Customer approved', 6),
    ('Studio / design job', 'Design', 5, 'Files supplied / sent to production', 7),
    ('Studio / design job', 'Finance & invoicing', 6, 'Passed to finance', 8),
    ('Studio / design job', 'Finance & invoicing', 7, 'Invoiced', 9),
    ('Web project', 'Discovery', 1, 'Kick-off call', 3),
    ('Web project', 'Discovery', 2, 'Sitemap and content gathered', 10),
    ('Web project', 'Build', 3, 'Design mock-up approved', 17),
    ('Web project', 'Build', 4, 'Build', 31),
    ('Web project', 'Build', 5, 'Testing and customer review', 38),
    ('Web project', 'Build', 6, 'Go live', 42),
    ('Web project', 'Finance & invoicing', 7, 'Passed to finance', 43),
    ('Web project', 'Finance & invoicing', 8, 'Invoiced', 45),
    ('Marketing retainer', 'This month', 1, 'Content plan agreed', 3),
    ('Marketing retainer', 'This month', 2, 'Content created and scheduled', 10),
    ('Marketing retainer', 'This month', 3, 'Ads reviewed and optimised', 20),
    ('Marketing retainer', 'This month', 4, 'Monthly report sent', 28)
  ) as v(template_name, stage, position, title, due) on v.template_name = t.name;
