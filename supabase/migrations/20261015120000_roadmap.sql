-- Roadmap and requests (owner request, 5 October 2026).
--
-- Plain-English summary:
-- * `roadmap_waves` and `roadmap_tasks`: every wave of the project and the
--   tasks to finish it, ticked off as work is done. Admins tick tasks;
--   management (anyone with the "Roadmap" permission) can see them.
-- * `feedback_requests`: bugs and suggestions sent in by management, about a
--   wave and/or a page. Admins approve, deny or query them. Approving adds a
--   task to that wave's roadmap (so Claude knows to build it); when that task
--   is ticked off, the request shows as done.
-- * `feedback_comments`: the back-and-forth when an admin queries a request.
-- * New permission "roadmap" (view), given to the Directors role.

create table public.roadmap_waves (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,        -- "0", "1", "2", "Final"…
  title        text not null,
  description  text,
  on_hold      boolean not null default false,
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);

create table public.roadmap_tasks (
  id           uuid primary key default gen_random_uuid(),
  wave_id      uuid not null references public.roadmap_waves (id) on delete cascade,
  title        text not null check (length(trim(title)) > 0),
  details      text,
  done         boolean not null default false,
  done_at      timestamptz,
  done_by      uuid references public.profiles (id) on delete set null,
  position     integer not null default 0,
  request_id   uuid,                         -- set when the task came from a request
  created_at   timestamptz not null default now()
);
create index roadmap_tasks_wave_idx on public.roadmap_tasks (wave_id, position);

create table public.feedback_requests (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('bug', 'suggestion')),
  title         text not null check (length(trim(title)) > 0),
  details       text,
  wave_id       uuid references public.roadmap_waves (id) on delete set null,
  page          text,                         -- section / page it's about
  status        text not null default 'pending' check (status in ('pending', 'query', 'approved', 'denied', 'done')),
  admin_note    text,
  submitted_by  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  submitted_at  timestamptz not null default now(),
  decided_by    uuid references public.profiles (id) on delete set null,
  decided_at    timestamptz,
  task_id       uuid references public.roadmap_tasks (id) on delete set null
);
create index feedback_requests_status_idx on public.feedback_requests (status, submitted_at desc);
alter table public.roadmap_tasks
  add constraint roadmap_tasks_request_fk foreign key (request_id) references public.feedback_requests (id) on delete set null;

create table public.feedback_comments (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.feedback_requests (id) on delete cascade,
  author_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body        text not null check (length(trim(body)) > 0),
  created_at  timestamptz not null default now()
);
create index feedback_comments_request_idx on public.feedback_comments (request_id, created_at);

-- Ticking a task stamps who/when; ticking a request's task marks it done.
create function public.stamp_roadmap_task()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.done and (tg_op = 'INSERT' or not old.done) then
    new.done_at := now();
    new.done_by := auth.uid();
  elsif not new.done then
    new.done_at := null;
    new.done_by := null;
  end if;
  if new.request_id is not null then
    update public.feedback_requests
       set status = case when new.done then 'done' else 'approved' end
     where id = new.request_id and status in ('approved', 'done');
  end if;
  return new;
end;
$$;
create trigger roadmap_tasks_stamp before insert or update of done on public.roadmap_tasks
  for each row execute function public.stamp_roadmap_task();

-- ─── Security ───────────────────────────────────────────────────────────────

alter table public.roadmap_waves enable row level security;
alter table public.roadmap_tasks enable row level security;
alter table public.feedback_requests enable row level security;
alter table public.feedback_comments enable row level security;

create function public.can_see_roadmap()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or public.has_permission('roadmap', 'view');
$$;

create policy "View waves" on public.roadmap_waves for select to authenticated using (public.can_see_roadmap());
create policy "Admins manage waves" on public.roadmap_waves for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "View tasks" on public.roadmap_tasks for select to authenticated using (public.can_see_roadmap());
create policy "Admins manage tasks" on public.roadmap_tasks for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Requests: people see their own; admins see all. Only admins decide.
create policy "View own or all (admins) requests" on public.feedback_requests for select to authenticated
  using (public.is_admin() or (submitted_by = auth.uid() and public.can_see_roadmap()));
create policy "Send requests" on public.feedback_requests for insert to authenticated
  with check (public.can_see_roadmap() and submitted_by = auth.uid() and status = 'pending');
create policy "Admins decide requests" on public.feedback_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admins remove requests" on public.feedback_requests for delete to authenticated
  using (public.is_admin());

create policy "View comments on visible requests" on public.feedback_comments for select to authenticated
  using (exists (select 1 from public.feedback_requests r where r.id = request_id));
create policy "Comment on visible requests" on public.feedback_comments for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.feedback_requests r where r.id = request_id));

revoke all on public.roadmap_waves, public.roadmap_tasks, public.feedback_requests, public.feedback_comments from anon;
revoke execute on function public.can_see_roadmap() from anon, public;
grant execute on function public.can_see_roadmap() to authenticated;

create trigger audit_roadmap_tasks after insert or update or delete on public.roadmap_tasks for each row execute function public.audit_row();
create trigger audit_feedback_requests after insert or update or delete on public.feedback_requests for each row execute function public.audit_row();

-- When the person who sent a queried request replies, it goes back to the
-- admins' "to review" list.
create function public.feedback_reply_reopens()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.feedback_requests set status = 'pending'
   where id = new.request_id and status = 'query' and submitted_by = new.author_id;
  return new;
end;
$$;
create trigger feedback_comments_reopen after insert on public.feedback_comments
  for each row execute function public.feedback_reply_reopens();

-- Management can see the roadmap.
insert into public.role_permissions (role_id, feature, action)
select id, 'roadmap', 'view' from public.roles where name = 'Directors'
on conflict do nothing;

-- ─── The roadmap so far (5 October 2026) ────────────────────────────────────

insert into public.roadmap_waves (code, title, description, on_hold, position) values
  ('0', 'Foundations', 'Sign-in, users, teams, roles, security, layout and hosting.', false, 0),
  ('0+', 'Password manager and Teams chat', 'Move off Zoho Vault and Zoho Cliq (no building).', false, 1),
  ('1', 'Customers', 'One place for every customer, contact, hosting plan and retainer.', false, 2),
  ('2', 'Quote to Invoice', 'Quotes, orders, invoices, purchase orders, recurring billing, email, payments and Xero.', false, 3),
  ('Staff', 'Staff, roles and home pages', 'Microsoft 365 staff list, activation, role home pages, targets and commission.', false, 4),
  ('3', 'Projects, Time and Dashboards', 'Projects and tasks for each job, time tracking, and switching off Zoho One.', true, 5),
  ('4', 'Design Workload', 'The design team''s work list (replaces monday.com).', false, 6),
  ('5', 'Magazines', 'Forget Me Not editions, ad bookings, flatplans, artwork and billing (replaces Mag Manager).', false, 7),
  ('6', 'Customer Portal and Online Booking', 'Customers log in to see their quotes, invoices and hosting, and book adverts.', false, 8),
  ('7', 'Reporting', 'Reports across the business (replaces the custom HTML reports).', false, 9),
  ('8', 'Marketing', 'Footprint''s own email and SMS campaigns (replaces internal GoHighLevel).', false, 10),
  ('Final', 'Go-live', 'Live database, real data imports, training and switching off the old tools.', false, 11);

insert into public.roadmap_tasks (wave_id, title, done, position)
select w.id, t.title, t.done, t.pos
  from public.roadmap_waves w
  join (values
    ('0', 'Sign in with Microsoft 365', true, 1),
    ('0', 'Users, teams, roles and permissions', true, 2),
    ('0', 'Database security (each person only sees what their role allows)', true, 3),
    ('0', 'Audit log of every change', true, 4),
    ('0', 'Branded layout that works on phones', true, 5),
    ('0', 'Error alerts (Sentry)', true, 6),
    ('0', 'Automatic publishing from GitHub', true, 7),
    ('0', 'Backups written up', true, 8),
    ('0', 'Test restoring a backup', false, 9),
    ('0+', 'Choose a password manager and move passwords from Zoho Vault', false, 1),
    ('0+', 'Move team chat from Zoho Cliq to Microsoft Teams', false, 2),
    ('1', 'Customer records with multiple contacts', true, 1),
    ('1', 'Hosting plans and digital retainers', true, 2),
    ('1', 'Activity timeline per customer', true, 3),
    ('1', 'Search and filters', true, 4),
    ('1', 'GDPR tools (export, erase, marketing consent)', true, 5),
    ('1', 'Possible duplicate warnings', true, 6),
    ('1', 'Add a new customer straight from a quote', true, 7),
    ('1', 'Import all ~15,000 customers from Zoho (at go-live)', false, 8),
    ('2', 'Quotes with online approval', true, 1),
    ('2', 'Approval creates the sales order automatically', true, 2),
    ('2', 'Sales orders, invoices and credit notes', true, 3),
    ('2', 'Purchase orders, emailed to suppliers', true, 4),
    ('2', 'Recurring billing', true, 5),
    ('2', 'Email quotes and invoices (Postmark, test mode)', true, 6),
    ('2', 'Charts and the sales overview', true, 7),
    ('2', 'Real product list from Zoho, with product numbers and sales accounts', true, 8),
    ('2', 'Sales team only see their own documents', true, 9),
    ('2', 'Set up Postmark so emails are really sent', false, 10),
    ('2', 'Payments by Direct Debit (GoCardless)', false, 11),
    ('2', 'Xero sync', false, 12),
    ('2', 'Import quote and invoice history from Zoho (at go-live)', false, 13),
    ('2', 'Run alongside Zoho for one billing cycle', false, 14),
    ('Staff', 'Staff list from Microsoft 365 (licensed users only)', true, 1),
    ('Staff', 'Activate staff and send invite links', true, 2),
    ('Staff', 'Home page for each role (Directors, Sales, Finance, Operations)', true, 3),
    ('Staff', 'Staff hub, targets and commission (examples)', true, 4),
    ('Staff', 'Daily automatic Microsoft 365 sync (sync key in Netlify)', false, 5),
    ('Staff', 'Job titles in Microsoft 365 (or use Microsoft groups) for automatic roles', false, 6),
    ('Staff', 'Real targets and commission rules', false, 7),
    ('Staff', 'Choose the platform''s name', false, 8),
    ('3', 'Projects, tasks and time database', true, 1),
    ('3', 'Project list and project pages', false, 2),
    ('3', 'Stages and checklist tasks from templates', false, 3),
    ('3', 'Timer, time entries and weekly timesheet', false, 4),
    ('3', 'Edit project templates', false, 5),
    ('3', 'Staff cost rates and profit after time', false, 6),
    ('3', 'Import projects and time from Zoho Projects', false, 7),
    ('3', 'Switch off Zoho One', false, 8),
    ('4', 'Design work items with status and priority', false, 1),
    ('4', 'Attach drafts and notes', false, 2),
    ('4', 'Link work to customers, orders and projects', false, 3),
    ('4', 'Import from monday.com', false, 4),
    ('5', 'Agree the Mag Manager feature list with the magazine team', false, 1),
    ('5', 'Editions and issues', false, 2),
    ('5', 'Advert bookings', false, 3),
    ('5', 'Flatplans and artwork', false, 4),
    ('5', 'Advertiser billing (to Xero)', false, 5),
    ('5', 'Import from Mag Manager', false, 6),
    ('6', 'Customer login', false, 1),
    ('6', 'Customers see quotes, invoices and hosting plans', false, 2),
    ('6', 'Online advert booking', false, 3),
    ('7', 'Reports tab', false, 1),
    ('7', 'Move the custom HTML reports into the platform', false, 2),
    ('8', 'Email and SMS campaigns', false, 1),
    ('8', 'Marketing pipelines', false, 2),
    ('Final', 'Create the live database (London)', false, 1),
    ('Final', 'Rehearse and run the real data imports', false, 2),
    ('Final', 'Test restoring a backup of the live database', false, 3),
    ('Final', 'Train staff', false, 4),
    ('Final', 'Switch off the old tools', false, 5)
  ) as t(code, title, done, pos) on t.code = w.code;
