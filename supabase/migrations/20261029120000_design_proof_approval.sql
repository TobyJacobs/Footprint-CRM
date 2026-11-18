-- Design Workload, part 4b (19 October 2026): online proof approval.
--
-- Plain-English summary:
-- * The design team sends a proof to the customer by email. The email has a
--   private link (like the quote approval link) where the customer sees the
--   proof and chooses "Approve" or "Request changes" (with what to change).
-- * One row per proof sent for approval. Sending a newer proof withdraws the
--   older link, so the customer can only ever answer the latest one.
-- * The proof file stays in private storage. When it's sent, FootprintOS makes
--   a private file link that lasts 30 days; after that the approval link
--   says it has expired and asks the customer to contact us.
-- * The customer's answer moves the job on: Approve → "Approved";
--   Request changes → "Amends". It's also written on the job's notes (marked
--   as from the customer) and on the customer's timeline.
-- * Only the two functions at the bottom can be used without signing in, and
--   only with the private token.

-- ─── Approval requests ──────────────────────────────────────────────────────

create table public.design_proof_approvals (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.design_jobs (id) on delete cascade,
  file_id         uuid not null references public.design_job_files (id) on delete cascade,
  token           uuid not null unique default gen_random_uuid(),
  file_url        text not null,            -- private link to the proof file, valid until expires_at
  expires_at      timestamptz not null,
  sent_to         text not null,
  message         text,
  status          text not null default 'waiting'
                  check (status in ('waiting', 'approved', 'changes', 'withdrawn')),
  response_name   text,
  response_note   text,
  response_ip     text,
  responded_at    timestamptz,
  created_at      timestamptz not null default now(),
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid
);
create index design_proof_approvals_job_idx on public.design_proof_approvals (job_id, created_at);
create index design_proof_approvals_file_idx on public.design_proof_approvals (file_id);
create index design_proof_approvals_created_by_idx on public.design_proof_approvals (created_by);

-- Notes the customer leaves through the approval link are marked as theirs.
alter table public.design_job_notes add column from_customer boolean not null default false;

-- ─── Security ───────────────────────────────────────────────────────────────

alter table public.design_proof_approvals enable row level security;
create policy "View proof approvals" on public.design_proof_approvals for select to authenticated
  using (public.has_permission('design', 'view'));
create policy "Send proofs for approval" on public.design_proof_approvals for insert to authenticated
  with check (public.has_permission('design', 'edit'));
create policy "Withdraw proof approvals" on public.design_proof_approvals for update to authenticated
  using (public.has_permission('design', 'edit')) with check (public.has_permission('design', 'edit'));
create policy "Delete proof approvals" on public.design_proof_approvals for delete to authenticated
  using (public.has_permission('design', 'edit'));

create trigger design_proof_approvals_touch before update on public.design_proof_approvals
  for each row execute function public.touch_row();
create trigger audit_design_proof_approvals after insert or update or delete on public.design_proof_approvals
  for each row execute function public.audit_row();

revoke all on public.design_proof_approvals from anon;

-- ─── What the customer sees (no sign-in, private token only) ───────────────

-- Everything the approval page needs. Returns null for an unknown token.
-- The file link is left out once the request is withdrawn or has expired.
create function public.get_proof_by_token(p_token uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'status', a.status,
    'expired', a.expires_at < now(),
    'expires_at', a.expires_at,
    'sent_at', a.created_at,
    'message', a.message,
    'file_url', case when a.status <> 'withdrawn' and a.expires_at >= now() then a.file_url end,
    'file_name', f.file_name,
    'content_type', f.content_type,
    'version', f.version,
    'job_number', j.number,
    'job_title', j.title,
    'customer_name', c.name,
    'response_name', a.response_name,
    'response_note', a.response_note,
    'responded_at', a.responded_at,
    'company', (select jsonb_build_object('company_name', s.company_name, 'phone', s.phone, 'email', s.email)
                  from public.company_settings s)
  )
  from public.design_proof_approvals a
  join public.design_job_files f on f.id = a.file_id
  join public.design_jobs j on j.id = a.job_id
  left join public.customers c on c.id = j.customer_id
  where a.token = p_token;
$$;

-- The customer's answer. Only works once, only while the link is current.
-- Returns a message to show the customer if something is wrong, else null.
create function public.respond_to_proof(
  p_token uuid, p_approve boolean, p_name text, p_note text, p_ip text
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  a public.design_proof_approvals%rowtype;
  j public.design_jobs%rowtype;
  v_version integer;
  v_name text := left(trim(coalesce(p_name, '')), 200);
  v_note text := nullif(left(trim(coalesce(p_note, '')), 5000), '');
begin
  if length(v_name) < 2 then
    return 'Please type your name.';
  end if;
  if not p_approve and v_note is null then
    return 'Please tell us what you''d like changed.';
  end if;

  select * into a from public.design_proof_approvals where token = p_token for update;
  if not found then
    return 'This link is not valid.';
  end if;
  if a.status = 'withdrawn' then
    return 'A newer proof has been sent, so this one can no longer be answered. Please use the link in our latest email.';
  end if;
  if a.status <> 'waiting' then
    return 'This proof has already been answered.';
  end if;
  if a.expires_at < now() then
    return 'This link has expired. Please contact us and we''ll send a new one.';
  end if;

  update public.design_proof_approvals set
    status = case when p_approve then 'approved' else 'changes' end,
    response_name = v_name,
    response_note = v_note,
    response_ip = left(p_ip, 100),
    responded_at = now()
  where id = a.id;

  select * into j from public.design_jobs where id = a.job_id for update;
  select version into v_version from public.design_job_files where id = a.file_id;

  -- Move the job on, unless the team has already taken it further.
  if p_approve and j.stage in ('todo', 'in_design', 'with_customer', 'amends') then
    update public.design_jobs set stage = 'approved' where id = j.id;
  elsif not p_approve and j.stage in ('todo', 'in_design', 'with_customer', 'approved') then
    update public.design_jobs set stage = 'amends' where id = j.id;
  end if;

  insert into public.design_job_notes (job_id, body, author_id, from_customer)
  values (j.id,
          v_name || case when p_approve then ' APPROVED proof v' || v_version || ' online.'
                         else ' asked for changes to proof v' || v_version || ' online.' end ||
          coalesce(E'\n\n' || v_note, ''),
          null, true);

  if j.customer_id is not null then
    insert into public.customer_activity (customer_id, kind, body)
    values (j.customer_id, 'system',
            'Design job DJ-' || j.number || ': proof v' || v_version ||
            case when p_approve then ' was APPROVED' else ' needs changes' end ||
            ' (answered online by ' || v_name || ').');
  end if;
  return null;
end;
$$;

revoke execute on function public.get_proof_by_token(uuid) from public;
revoke execute on function public.respond_to_proof(uuid, boolean, text, text, text) from public;
grant execute on function public.get_proof_by_token(uuid) to anon, authenticated;
grant execute on function public.respond_to_proof(uuid, boolean, text, text, text) to anon, authenticated;
