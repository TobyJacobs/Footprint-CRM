-- Marketing team workspace (14 October 2026).
--
-- Plain-English summary:
-- * Content calendar: one row per planned post, blog, email or video, for a
--   client (or for Footprint itself when no client is set). It moves through
--   idea → drafting → client approval → scheduled → published.
-- * Ad campaigns: one row per client ad campaign, with dates, budget, the spend
--   so far and key results, so the team can see when spend runs ahead.
-- * Both use the "Marketing" permission. The Marketing team and Directors can
--   view, add, change and delete. Admins can change this in Roles.
-- * Four ready-made marketing project templates with stages, tasks and time
--   estimates (editable in Projects → Templates).
-- * Every change is recorded in the audit log.

-- ─── Tables ─────────────────────────────────────────────────────────────────

create table public.content_items (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid references public.customers (id) on delete cascade,  -- empty = Footprint's own
  retainer_id   uuid references public.retainers (id) on delete set null,
  project_id    uuid references public.projects (id) on delete set null,
  title         text not null check (length(trim(title)) > 0),
  channel       text not null check (channel in ('Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'X', 'YouTube', 'Google Business', 'Blog', 'Email', 'Website', 'Video', 'Other')),
  publish_date  date,
  status        text not null default 'idea' check (status in ('idea', 'drafting', 'client_approval', 'scheduled', 'published')),
  assignee_id   uuid references public.profiles (id) on delete set null,
  link          text,
  notes         text,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);
create index content_items_date_idx on public.content_items (publish_date);
create index content_items_customer_idx on public.content_items (customer_id, publish_date);
create index content_items_assignee_idx on public.content_items (assignee_id, status, publish_date);

create table public.ad_campaigns (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.customers (id) on delete cascade,
  retainer_id       uuid references public.retainers (id) on delete set null,
  project_id        uuid references public.projects (id) on delete set null,
  name              text not null check (length(trim(name)) > 0),
  platform          text not null check (platform in ('Google', 'Meta', 'LinkedIn', 'TikTok', 'Microsoft', 'Other')),
  status            text not null default 'planned' check (status in ('planned', 'live', 'paused', 'ended')),
  start_date        date,
  end_date          date,
  budget            numeric(10,2) check (budget is null or budget >= 0),
  spend             numeric(10,2) not null default 0 check (spend >= 0),
  spend_updated_at  timestamptz,
  leads             integer check (leads is null or leads >= 0),
  results           text,
  owner_id          uuid references public.profiles (id) on delete set null,
  notes             text,
  created_at        timestamptz not null default now(),
  created_by        uuid default auth.uid(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid,
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index ad_campaigns_status_idx on public.ad_campaigns (status, end_date);
create index ad_campaigns_customer_idx on public.ad_campaigns (customer_id);

-- Stamp when a piece of content is first marked published.
create function public.stamp_content_published()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  elsif new.status <> 'published' then
    new.published_at := null;
  end if;
  return new;
end;
$$;
revoke execute on function public.stamp_content_published() from anon, public;
create trigger content_items_published before insert or update on public.content_items
  for each row execute function public.stamp_content_published();

-- ─── Security ───────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array['content_items', 'ad_campaigns'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "View marketing" on public.%I for select to authenticated using (public.has_permission(''marketing'', ''view''))', t);
    execute format('create policy "Add marketing" on public.%I for insert to authenticated with check (public.has_permission(''marketing'', ''edit''))', t);
    execute format('create policy "Change marketing" on public.%I for update to authenticated using (public.has_permission(''marketing'', ''edit'')) with check (public.has_permission(''marketing'', ''edit''))', t);
    execute format('create policy "Remove marketing" on public.%I for delete to authenticated using (public.has_permission(''marketing'', ''delete''))', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_row()', t || '_touch', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', 'audit_' || t, t);
  end loop;
end $$;
revoke all on public.content_items, public.ad_campaigns from anon;

insert into public.role_permissions (role_id, feature, action)
select r.id, p.feature, p.action
  from public.roles r
  join (values
    ('Marketing team', 'marketing', 'edit'), ('Marketing team', 'marketing', 'delete'),
    ('Directors', 'marketing', 'edit'), ('Directors', 'marketing', 'delete')
  ) as p(role_name, feature, action) on p.role_name = r.name
on conflict do nothing;

-- ─── Marketing project templates ────────────────────────────────────────────

insert into public.project_templates (name, description, project_group, business_unit, is_default) values
  ('Monthly social media', 'One month of social media content for a retained client.', 'Marketing Retained', 'Digital', false),
  ('Ad campaign launch', 'Plan, build, run and report on a paid ads campaign.', 'Marketing Retained', 'Digital', false),
  ('Website and blog content', 'Blog posts or web page copy, from topics to publishing.', 'Marketing Retained', 'Digital', false),
  ('Email campaign', 'A one-off email to a client''s consenting contacts.', 'Marketing Retained', 'Digital', false)
on conflict (name) do nothing;

insert into public.project_template_tasks (template_id, stage, position, title, due_offset_days, estimated_minutes)
select t.id, v.stage, v.position, v.title, v.due, v.minutes
  from public.project_templates t
  join (values
    ('Monthly social media', 'Plan', 1, 'Content plan and calendar drafted', 2, 120),
    ('Monthly social media', 'Plan', 2, 'Content plan approved by client', 5, 15),
    ('Monthly social media', 'Create', 3, 'Captions written', 10, 180),
    ('Monthly social media', 'Create', 4, 'Graphics and video made', 12, 240),
    ('Monthly social media', 'Create', 5, 'Posts approved by client', 14, 30),
    ('Monthly social media', 'Publish', 6, 'Posts scheduled', 15, 60),
    ('Monthly social media', 'Publish', 7, 'Comments and messages answered', 28, 120),
    ('Monthly social media', 'Report', 8, 'Monthly report sent', 30, 90),

    ('Ad campaign launch', 'Plan', 1, 'Goal, audience and budget agreed', 2, 60),
    ('Ad campaign launch', 'Plan', 2, 'Tracking and pixels checked', 4, 60),
    ('Ad campaign launch', 'Build', 3, 'Ad copy and creative made', 7, 240),
    ('Ad campaign launch', 'Build', 4, 'Campaign built in the ad platform', 8, 120),
    ('Ad campaign launch', 'Build', 5, 'Ads approved by client', 10, 30),
    ('Ad campaign launch', 'Live', 6, 'Launched and first-day checks', 11, 30),
    ('Ad campaign launch', 'Live', 7, 'Week 1 optimisation', 18, 60),
    ('Ad campaign launch', 'Live', 8, 'Mid-campaign review', 25, 60),
    ('Ad campaign launch', 'Report', 9, 'End of campaign report', 35, 120),

    ('Website and blog content', 'Plan', 1, 'Topics and keywords agreed', 3, 60),
    ('Website and blog content', 'Write', 2, 'Drafts written', 10, 240),
    ('Website and blog content', 'Write', 3, 'Images found or made', 11, 90),
    ('Website and blog content', 'Write', 4, 'Approved by client', 14, 30),
    ('Website and blog content', 'Publish', 5, 'Published with SEO checks', 16, 60),
    ('Website and blog content', 'Publish', 6, 'Shared on social media', 17, 30),

    ('Email campaign', 'Plan', 1, 'Goal agreed and mailing list consent checked', 2, 45),
    ('Email campaign', 'Create', 2, 'Copy and design', 6, 180),
    ('Email campaign', 'Create', 3, 'Test send and proof checks', 7, 30),
    ('Email campaign', 'Create', 4, 'Approved by client', 8, 15),
    ('Email campaign', 'Send', 5, 'Scheduled and sent', 9, 15),
    ('Email campaign', 'Report', 6, 'Results report sent', 16, 45)
  ) as v(template_name, stage, position, title, due, minutes) on v.template_name = t.name
 where not exists (select 1 from public.project_template_tasks x where x.template_id = t.id);
