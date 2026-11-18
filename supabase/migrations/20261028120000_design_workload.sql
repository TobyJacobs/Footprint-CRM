-- Design Workload, part 4a (19 October 2026). Replaces monday.com.
--
-- Plain-English summary:
-- * Design jobs: one row per piece of design work, with a brief, the customer
--   (empty = Footprint's own work), an optional sales order and project, the
--   designer, a due date, a high-priority flag and a stage:
--   To do → In design → With customer → Amends → Approved → Sent to production → Done.
-- * Files on a job: proofs (numbered v1, v2, v3…) and brief files (logos,
--   photos, reference material from the customer). Stored privately.
-- * Notes: a running comment thread on each job.
-- * Access uses the "Design" permission:
--     view   → see every job, raise a new request, add notes and files
--     edit   → change jobs (stage, designer, dates…)
--     delete → delete jobs and files
--   Marketing team (where the designers sit), Directors and Operations team
--   can edit; Marketing team and Directors can delete; the Sales team can now
--   view, so they can raise jobs from their orders. Admins can change this in Roles.
-- * Every change is recorded in the audit log.

-- ─── Tables ─────────────────────────────────────────────────────────────────

create table public.design_jobs (
  id                uuid primary key default gen_random_uuid(),
  number            integer not null generated always as identity (start with 1001) unique,
  title             text not null check (length(trim(title)) > 0),
  brief             text,
  customer_id       uuid references public.customers (id) on delete cascade,        -- empty = Footprint's own
  sales_order_id    uuid references public.sales_documents (id) on delete set null,
  project_id        uuid references public.projects (id) on delete set null,
  designer_id       uuid references public.profiles (id) on delete set null,
  requested_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  due_date          date,
  high_priority     boolean not null default false,
  stage             text not null default 'todo'
                    check (stage in ('todo', 'in_design', 'with_customer', 'amends', 'approved', 'production', 'done')),
  stage_changed_at  timestamptz not null default now(),
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  created_by        uuid default auth.uid(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid
);
create index design_jobs_stage_idx on public.design_jobs (stage, due_date);
create index design_jobs_designer_idx on public.design_jobs (designer_id, stage);
create index design_jobs_customer_idx on public.design_jobs (customer_id);
create index design_jobs_order_idx on public.design_jobs (sales_order_id);
create index design_jobs_project_idx on public.design_jobs (project_id);
create index design_jobs_requested_by_idx on public.design_jobs (requested_by);

create table public.design_job_files (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.design_jobs (id) on delete cascade,
  kind          text not null default 'proof' check (kind in ('proof', 'brief')),
  version       integer,  -- proofs only: 1, 2, 3… (set automatically)
  path          text not null unique,
  file_name     text not null,
  size_bytes    bigint,
  content_type  text,
  note          text,
  uploaded_by   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at    timestamptz not null default now()
);
create index design_job_files_job_idx on public.design_job_files (job_id, kind, version);
create index design_job_files_uploaded_by_idx on public.design_job_files (uploaded_by);

create table public.design_job_notes (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.design_jobs (id) on delete cascade,
  body        text not null check (length(trim(body)) > 0),
  author_id   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index design_job_notes_job_idx on public.design_job_notes (job_id, created_at);
create index design_job_notes_author_idx on public.design_job_notes (author_id);

-- ─── Automatic stamps ───────────────────────────────────────────────────────

-- Remember when the stage last changed (for "days in this stage") and when the
-- job was finished.
create function public.stamp_design_job_stage()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    new.stage_changed_at := now();
  end if;
  if new.stage = 'done' and new.completed_at is null then
    new.completed_at := now();
  elsif new.stage <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;
create trigger design_jobs_stage before insert or update on public.design_jobs
  for each row execute function public.stamp_design_job_stage();

-- Number each new proof on a job: v1, v2, v3…
create function public.number_design_proof()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.kind = 'proof' then
    -- One at a time per job, so two uploads at once can't both become the same version.
    perform pg_advisory_xact_lock(hashtext('design_proof:' || new.job_id::text));
    select coalesce(max(version), 0) + 1 into new.version
      from public.design_job_files
     where job_id = new.job_id and kind = 'proof';
  else
    new.version := null;
  end if;
  return new;
end;
$$;
create trigger design_job_files_version before insert on public.design_job_files
  for each row execute function public.number_design_proof();

-- Trigger functions are never called directly (see the 15 October tune-up).
revoke execute on function public.stamp_design_job_stage() from public, anon, authenticated;
revoke execute on function public.number_design_proof() from public, anon, authenticated;

-- ─── Security ───────────────────────────────────────────────────────────────

alter table public.design_jobs enable row level security;
create policy "View design jobs" on public.design_jobs for select to authenticated
  using (public.has_permission('design', 'view'));
create policy "Raise design jobs" on public.design_jobs for insert to authenticated
  with check (public.has_permission('design', 'view'));
create policy "Change design jobs" on public.design_jobs for update to authenticated
  using (public.has_permission('design', 'edit')) with check (public.has_permission('design', 'edit'));
create policy "Delete design jobs" on public.design_jobs for delete to authenticated
  using (public.has_permission('design', 'delete'));

alter table public.design_job_files enable row level security;
create policy "View design files" on public.design_job_files for select to authenticated
  using (public.has_permission('design', 'view'));
create policy "Add design files" on public.design_job_files for insert to authenticated
  with check (uploaded_by = (select auth.uid()) and public.has_permission('design', 'view'));
create policy "Delete design files" on public.design_job_files for delete to authenticated
  using (public.has_permission('design', 'delete'));

alter table public.design_job_notes enable row level security;
create policy "View design notes" on public.design_job_notes for select to authenticated
  using (public.has_permission('design', 'view'));
create policy "Add design notes" on public.design_job_notes for insert to authenticated
  with check (author_id = (select auth.uid()) and public.has_permission('design', 'view'));
create policy "Delete own or (designers) any notes" on public.design_job_notes for delete to authenticated
  using (author_id = (select auth.uid()) or public.has_permission('design', 'delete'));

create trigger design_jobs_touch before update on public.design_jobs
  for each row execute function public.touch_row();
create trigger audit_design_jobs after insert or update or delete on public.design_jobs
  for each row execute function public.audit_row();
create trigger audit_design_job_files after insert or update or delete on public.design_job_files
  for each row execute function public.audit_row();
create trigger audit_design_job_notes after insert or update or delete on public.design_job_notes
  for each row execute function public.audit_row();

revoke all on public.design_jobs, public.design_job_files, public.design_job_notes from anon;

-- ─── Private file store for proofs and brief files ──────────────────────────
-- Files live at "<job id>/<random>-<name>". Only people with Design access can
-- read them, through short-lived links.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('design-files', 'design-files', false, 26214400, array[
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'
])
on conflict (id) do nothing;

create policy "Upload design files" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'design-files'
    and public.has_permission('design', 'view')
    and exists (select 1 from public.design_jobs j where j.id::text = (storage.foldername(name))[1])
  );
create policy "Read design files" on storage.objects for select to authenticated
  using (bucket_id = 'design-files' and public.has_permission('design', 'view'));
create policy "Remove design files" on storage.objects for delete to authenticated
  using (bucket_id = 'design-files' and public.has_permission('design', 'delete'));

-- ─── Who can do what ────────────────────────────────────────────────────────

insert into public.role_permissions (role_id, feature, action)
select r.id, p.feature, p.action
  from public.roles r
  join (values
    ('Marketing team', 'design', 'view'), ('Marketing team', 'design', 'edit'), ('Marketing team', 'design', 'delete'),
    ('Directors', 'design', 'view'), ('Directors', 'design', 'edit'), ('Directors', 'design', 'delete'),
    ('Operations team', 'design', 'view'), ('Operations team', 'design', 'edit'),
    ('Sales team', 'design', 'view')
  ) as p(role_name, feature, action) on p.role_name = r.name
on conflict do nothing;
