-- Website enquiry forms (1 November 2026), Wave 8 Marketing: replacing the
-- GoHighLevel forms on Footprint's own websites. (Customers' marketing stays
-- on GoHighLevel.)
--
-- Plain-English summary:
-- * Marketing sets up a form: which lead pipeline it feeds, who the leads go
--   to, who is emailed, and its wording. Each form has a public address
--   (/f/<public id>) and a snippet to paste into a website.
-- * Anyone can fill a form in, but only FootprintOS itself can save an
--   enquiry: it must give the same secret key the customer portal uses
--   (PORTAL_LINK_KEY, Netlify only), so nobody can write leads directly.
-- * An enquiry becomes a lead in the pipeline's first stage, with the message
--   in its notes. If the same email already has an open lead in that
--   pipeline, the message is added to that lead instead of making a duplicate.
-- * Spam limits: 10 an hour from one connection, 3 an hour from one email,
--   100 an hour per form. The log behind these limits keeps only a fingerprint
--   of the connection and is cleared after 30 days (UK GDPR).

create table public.lead_forms (
  id            uuid primary key default gen_random_uuid(),
  public_id     text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  name          text not null check (length(trim(name)) between 1 and 100),
  pipeline_id   uuid not null references public.lead_pipelines (id) on delete restrict,
  owner_id      uuid references public.profiles (id) on delete set null,
  notify_ids    uuid[] not null default '{}',
  heading       text check (heading is null or length(heading) <= 200),
  intro         text check (intro is null or length(intro) <= 1000),
  button_label  text not null default 'Send' check (length(trim(button_label)) between 1 and 40),
  thank_you     text not null default 'Thanks for getting in touch. We''ll be back to you soon.' check (length(trim(thank_you)) between 1 and 500),
  show_phone    boolean not null default true,
  show_company  boolean not null default true,
  show_message  boolean not null default true,
  privacy_url   text check (privacy_url is null or privacy_url ~ '^https://[^\s]{3,300}$'),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);
create index lead_forms_pipeline_idx on public.lead_forms (pipeline_id);
create index lead_forms_owner_idx on public.lead_forms (owner_id);

create table public.lead_form_submissions (
  id          uuid primary key default gen_random_uuid(),
  form_id     uuid not null references public.lead_forms (id) on delete cascade,
  lead_id     uuid references public.leads (id) on delete set null,
  email       text not null,
  ip_hash     text,
  created_at  timestamptz not null default now()
);
create index lead_form_submissions_form_idx on public.lead_form_submissions (form_id, created_at desc);
create index lead_form_submissions_ip_idx on public.lead_form_submissions (ip_hash, created_at desc);
create index lead_form_submissions_email_idx on public.lead_form_submissions (email, created_at desc);
create index lead_form_submissions_lead_idx on public.lead_form_submissions (lead_id);

alter table public.lead_forms enable row level security;
alter table public.lead_form_submissions enable row level security;

create policy "See forms" on public.lead_forms for select to authenticated
  using ((select public._leads_view()));
create policy "Set up forms" on public.lead_forms for all to authenticated
  using ((select public.has_permission('marketing', 'edit')))
  with check ((select public.has_permission('marketing', 'edit')));
-- Counts only (how many enquiries a form has had); written by submit_lead_form.
create policy "See form submissions" on public.lead_form_submissions for select to authenticated
  using ((select public.has_permission('marketing', 'edit')));

create trigger lead_forms_touch before update on public.lead_forms
  for each row execute function public.touch_row();
create trigger audit_lead_forms after insert or update or delete on public.lead_forms
  for each row execute function public.audit_row();

-- ─── The public form ────────────────────────────────────────────────────────

-- What the public form page shows. Only active forms, and only their wording.
create function public.public_lead_form(p_public_id text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'public_id', f.public_id, 'heading', f.heading, 'intro', f.intro,
    'button_label', f.button_label, 'thank_you', f.thank_you,
    'show_phone', f.show_phone, 'show_company', f.show_company, 'show_message', f.show_message,
    'privacy_url', f.privacy_url)
    from public.lead_forms f
   where f.public_id = p_public_id and f.active;
$$;
revoke execute on function public.public_lead_form(text) from public;
grant execute on function public.public_lead_form(text) to anon, authenticated;

-- FootprintOS saves an enquiry. Returns the lead and who to email, or raises
-- 'Too many enquiries' when a spam limit is hit.
create function public.submit_lead_form(
  p_key text, p_public_id text, p_name text, p_email text, p_phone text,
  p_company text, p_message text, p_page text, p_ip_hash text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_hash text := (select link_key_hash from public.portal_settings where id);
  v_form public.lead_forms;
  v_name text := left(trim(coalesce(p_name, '')), 200);
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := nullif(left(trim(coalesce(p_phone, '')), 50), '');
  v_company text := nullif(left(trim(coalesce(p_company, '')), 200), '');
  v_message text := nullif(left(trim(coalesce(p_message, '')), 3000), '');
  v_page text := nullif(left(trim(coalesce(p_page, '')), 300), '');
  v_note text;
  v_lead uuid;
  v_repeat boolean := false;
  v_stage uuid;
begin
  if v_hash is null or p_key is null or length(p_key) < 32 or public._portal_hash(p_key) <> v_hash then
    raise exception 'Not allowed';
  end if;
  select * into v_form from public.lead_forms where public_id = p_public_id and active;
  if v_form.id is null then
    raise exception 'This form is no longer taking enquiries';
  end if;
  if length(v_name) = 0 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_email) > 320 then
    raise exception 'Please give your name and a valid email address';
  end if;
  if p_ip_hash is not null and p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Bad request';
  end if;

  if (p_ip_hash is not null and (select count(*) from public.lead_form_submissions
        where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 10)
     or (select count(*) from public.lead_form_submissions
        where email = v_email and created_at > now() - interval '1 hour') >= 3
     or (select count(*) from public.lead_form_submissions
        where form_id = v_form.id and created_at > now() - interval '1 hour') >= 100 then
    raise exception 'Too many enquiries';
  end if;

  v_note := concat_ws(e'\n',
    format('Website enquiry (%s, %s)', v_form.name, to_char(now() at time zone 'Europe/London', 'DD/MM/YYYY HH24:MI')),
    case when v_page is not null then 'From: ' || v_page end,
    case when v_message is not null then e'\n' || v_message end);

  -- Same person, still open in this pipeline: add to that lead.
  select l.id into v_lead
    from public.leads l
    join public.lead_stages s on s.id = l.stage_id
   where l.pipeline_id = v_form.pipeline_id and s.kind = 'open'
     and lower(trim(l.email)) = v_email
   order by l.created_at desc
   limit 1;

  if v_lead is not null then
    v_repeat := true;
    update public.leads
       set notes = left(concat_ws(e'\n\n', notes, v_note), 5000),
           phone = coalesce(phone, v_phone),
           company = coalesce(company, v_company)
     where id = v_lead;
  else
    select id into v_stage from public.lead_stages
     where pipeline_id = v_form.pipeline_id and kind = 'open'
     order by position limit 1;
    if v_stage is null then
      raise exception 'This form''s pipeline has no open stage';
    end if;
    insert into public.leads (pipeline_id, stage_id, name, company, email, phone, source, owner_id, notes)
    values (v_form.pipeline_id, v_stage, v_name, v_company, v_email, v_phone, 'Website form', v_form.owner_id, left(v_note, 5000))
    returning id into v_lead;
  end if;

  delete from public.lead_form_submissions where created_at < now() - interval '30 days';
  insert into public.lead_form_submissions (form_id, lead_id, email, ip_hash)
  values (v_form.id, v_lead, v_email, p_ip_hash);

  return jsonb_build_object(
    'lead_id', v_lead,
    'pipeline_id', v_form.pipeline_id,
    'form_name', v_form.name,
    'repeat', v_repeat,
    'notify', coalesce((
      select jsonb_agg(distinct p.email)
        from public.profiles p
       where p.is_active and p.email is not null
         and (p.id = v_form.owner_id or p.id = any (v_form.notify_ids))), '[]'::jsonb));
end;
$$;
revoke execute on function public.submit_lead_form(text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_lead_form(text, text, text, text, text, text, text, text, text) to anon, authenticated;
