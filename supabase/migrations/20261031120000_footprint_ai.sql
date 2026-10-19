-- FootprintAI (19 October 2026). Invite-only workspace for the Footprint AI
-- programme (brief: "Footprint AI Roadmap", Mitch, 14 October 2026).
--
-- Plain-English summary:
-- * Invite list: only admins, and people an admin has added to the list, can
--   see FootprintAI. Roles don't give access to it. Everyone else gets nothing
--   from the database, not even the names of the projects.
-- * Projects: each AI agent or system being built, with owner, testing wave,
--   stage (Planned → Shadow → Assisted → Supervised → Live), the decision at the
--   end of testing (scale / fix / stop), pilot job, tools and human check.
-- * Updates: a running log of progress on each project (by hand, or by Claude).
-- * Test log: each time an agent is tried on a real task: time by hand
--   (baseline), time with the agent including checking, usable or not, errors,
--   cost. These give the live figures on the scorecard.
-- * Scorecard: the brief's seven rows per project (quality, time saved, errors,
--   cost, safety, adoption, repeatability), each not started / on track / pass /
--   fail, with the evidence.
-- * Members can add and change everything; only admins delete projects and
--   manage the invite list. Every change is in the audit log.
-- * Starts with the six agents and the SSL renewal system from the brief.

-- ─── Invite list ────────────────────────────────────────────────────────────

create table public.ai_members (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  added_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  added_at   timestamptz not null default now()
);
create index ai_members_added_by_idx on public.ai_members (added_by);

-- True for admins and for active people on the invite list.
create function public.is_ai_member()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.ai_members m
      join public.profiles p on p.id = m.user_id
     where m.user_id = auth.uid() and p.is_active
  );
$$;
revoke execute on function public.is_ai_member() from public, anon;
grant execute on function public.is_ai_member() to authenticated;

-- ─── Projects ───────────────────────────────────────────────────────────────

create table public.ai_projects (
  id             uuid primary key default gen_random_uuid(),
  title          text not null check (length(trim(title)) > 0),
  kind           text not null default 'agent' check (kind in ('agent', 'system', 'project')),
  summary        text,
  owner_id       uuid references public.profiles (id) on delete set null,
  wave           text,                          -- testing wave, e.g. "Wave 1"
  stage          text not null default 'planned'
                 check (stage in ('planned', 'shadow', 'assisted', 'supervised', 'live', 'on_hold')),
  decision       text check (decision in ('scale', 'fix', 'stop')),
  pilot_job      text,
  tools          text,
  human_check    text,
  next_step      text,
  start_date     date,
  decision_date  date,                          -- when the scorecard decision is due
  position       integer not null default 0,
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);
create index ai_projects_owner_idx on public.ai_projects (owner_id);

create table public.ai_project_updates (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.ai_projects (id) on delete cascade,
  body        text not null check (length(trim(body)) > 0),
  author_id   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index ai_project_updates_project_idx on public.ai_project_updates (project_id, created_at);
create index ai_project_updates_author_idx on public.ai_project_updates (author_id);

create table public.ai_test_runs (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.ai_projects (id) on delete cascade,
  run_date         date not null default current_date,
  task             text not null check (length(trim(task)) > 0),
  stage            text check (stage in ('planned', 'shadow', 'assisted', 'supervised', 'live', 'on_hold')),
  manual_minutes   integer check (manual_minutes >= 0),   -- baseline: by hand
  agent_minutes    integer check (agent_minutes >= 0),    -- with the agent, checking included
  usable           boolean,                               -- usable with light or no edits
  errors           integer not null default 0 check (errors >= 0),
  serious_error    boolean not null default false,        -- would have reached a client / broken something
  cost             numeric(10, 2) check (cost >= 0),      -- model and tool spend, £
  notes            text,
  logged_by        uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now()
);
create index ai_test_runs_project_idx on public.ai_test_runs (project_id, run_date);
create index ai_test_runs_logged_by_idx on public.ai_test_runs (logged_by);

create table public.ai_scores (
  project_id  uuid not null references public.ai_projects (id) on delete cascade,
  criterion   text not null check (criterion in ('quality', 'time_saved', 'errors', 'cost', 'safety', 'adoption', 'repeatability')),
  status      text not null default 'not_started' check (status in ('not_started', 'on_track', 'pass', 'fail')),
  evidence    text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  primary key (project_id, criterion)
);
create index ai_scores_updated_by_idx on public.ai_scores (updated_by);

-- Every project starts with all seven scorecard rows "not started".
create function public.ai_project_scorecard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.ai_scores (project_id, criterion)
  select new.id, c from unnest(array['quality', 'time_saved', 'errors', 'cost', 'safety', 'adoption', 'repeatability']) as c
  on conflict do nothing;
  return new;
end;
$$;
create trigger ai_projects_scorecard after insert on public.ai_projects
  for each row execute function public.ai_project_scorecard();

create function public.touch_ai_score()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
create trigger ai_scores_touch before update on public.ai_scores
  for each row execute function public.touch_ai_score();

revoke execute on function public.ai_project_scorecard() from public, anon, authenticated;
revoke execute on function public.touch_ai_score() from public, anon, authenticated;

-- ─── Security ───────────────────────────────────────────────────────────────

alter table public.ai_members enable row level security;
create policy "Members see the invite list" on public.ai_members for select to authenticated
  using (public.is_ai_member());
create policy "Admins add to the invite list" on public.ai_members for insert to authenticated
  with check (public.is_admin());
create policy "Admins remove from the invite list" on public.ai_members for delete to authenticated
  using (public.is_admin());

alter table public.ai_projects enable row level security;
create policy "Members see AI projects" on public.ai_projects for select to authenticated using (public.is_ai_member());
create policy "Members add AI projects" on public.ai_projects for insert to authenticated with check (public.is_ai_member());
create policy "Members change AI projects" on public.ai_projects for update to authenticated
  using (public.is_ai_member()) with check (public.is_ai_member());
create policy "Admins delete AI projects" on public.ai_projects for delete to authenticated using (public.is_admin());

alter table public.ai_project_updates enable row level security;
create policy "Members see AI updates" on public.ai_project_updates for select to authenticated using (public.is_ai_member());
create policy "Members add AI updates" on public.ai_project_updates for insert to authenticated
  with check (public.is_ai_member() and author_id = (select auth.uid()));
create policy "Delete own AI updates (admins any)" on public.ai_project_updates for delete to authenticated
  using (public.is_ai_member() and (author_id = (select auth.uid()) or public.is_admin()));

alter table public.ai_test_runs enable row level security;
create policy "Members see AI test runs" on public.ai_test_runs for select to authenticated using (public.is_ai_member());
create policy "Members log AI test runs" on public.ai_test_runs for insert to authenticated
  with check (public.is_ai_member() and logged_by = (select auth.uid()));
create policy "Delete own AI test runs (admins any)" on public.ai_test_runs for delete to authenticated
  using (public.is_ai_member() and (logged_by = (select auth.uid()) or public.is_admin()));

alter table public.ai_scores enable row level security;
create policy "Members see AI scores" on public.ai_scores for select to authenticated using (public.is_ai_member());
create policy "Members change AI scores" on public.ai_scores for update to authenticated
  using (public.is_ai_member()) with check (public.is_ai_member());

revoke all on public.ai_members, public.ai_projects, public.ai_project_updates, public.ai_test_runs, public.ai_scores from anon;

create trigger ai_projects_touch before update on public.ai_projects
  for each row execute function public.touch_row();
create trigger audit_ai_members after insert or update or delete on public.ai_members
  for each row execute function public.audit_row();
create trigger audit_ai_projects after insert or update or delete on public.ai_projects
  for each row execute function public.audit_row();
create trigger audit_ai_project_updates after insert or update or delete on public.ai_project_updates
  for each row execute function public.audit_row();
create trigger audit_ai_test_runs after insert or update or delete on public.ai_test_runs
  for each row execute function public.audit_row();
create trigger audit_ai_scores after insert or update or delete on public.ai_scores
  for each row execute function public.audit_row();

-- ─── Starting projects, from the brief ──────────────────────────────────────

insert into public.ai_projects (title, kind, wave, stage, summary, pilot_job, tools, human_check, start_date, decision_date, position)
values
  ('Account management agent', 'agent', 'Wave 1', 'planned', null,
   'Summarise client status, prepare check-in notes, draft renewal and update emails',
   'Zoho CRM, Microsoft email and calendar, Mailgun', 'Account manager approves every client-facing message',
   '2026-11-02', '2026-12-18', 1),
  ('Web dev and tickets agent', 'agent', 'Wave 1', 'planned', null,
   'Triage tickets, draft fixes as GitHub pull requests, preview on Netlify',
   'GitHub, Netlify, 20i, Claude', 'Developer reviews every pull request before merge',
   '2026-11-02', '2026-12-18', 2),
  ('Marketing agent', 'agent', 'Wave 1', 'planned', null,
   'Draft content, campaign ideas and reports in the Footprint brand voice',
   'Claude, ChatGPT, Mailgun', 'Marketer approves before publishing',
   '2026-11-02', '2026-12-18', 3),
  ('Sales agent', 'agent', 'Wave 2', 'planned', null,
   'Qualify enquiries, draft follow-ups and proposals from past examples, log CRM notes',
   'Zoho CRM, Microsoft, Claude', 'Salesperson approves anything sent or priced',
   '2026-11-23', '2026-12-18', 4),
  ('Design agent', 'agent', 'Wave 2', 'planned', null,
   'Produce first-draft layouts, social assets and variations to brand guidelines',
   'Adobe, Claude, ChatGPT', 'Designer reviews every asset against the brand',
   '2026-11-23', '2026-12-18', 5),
  ('AI systems builder', 'agent', 'Wave 2', 'planned', null,
   'Scope and prototype a small client-style system, such as the SSL nudge, from a brief',
   'Claude, GitHub, Netlify', 'Senior developer reviews design, security and cost',
   '2026-11-23', '2026-12-18', 6),
  ('SSL renewal notifications', 'system', null, 'live',
   'Nudges hosting customers about SSL renewals using 20i and Zoho CRM data. The first live proof point and candidate case study, once its results are confirmed.',
   null, '20i, Zoho CRM, Mailgun', null, null, null, 7);
