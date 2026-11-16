-- Xero sync, part 1 (16 November 2026): invoices and credit notes go to Xero
-- as drafts, with the customer matched to (or created as) a Xero contact.
--
-- Plain-English summary:
-- * An admin connects FootprintOS to Footprint's Xero once (Admin → Xero).
--   The Xero sign-in is kept encrypted; nobody can read it from the database.
-- * Safety catches (owner's real Xero is connected while FootprintOS still
--   holds test data): nothing is sent automatically until an admin turns
--   "Send automatically" on, and only invoices issued on or after a chosen
--   date are ever sent automatically. Any invoice can also be sent by hand.
-- * When an invoice or credit note is issued, a job is queued. FootprintOS
--   works through the queue every few minutes (and straight away when someone
--   presses "Send to Xero" or "Sync now"). Every attempt is logged.
-- * Invoice numbers: FootprintOS's by default; an admin can switch to Xero's.
-- * The background job proves itself with a key made from the Xero app
--   secret (kept in Netlify only); the database keeps just its fingerprint.

create table public.xero_settings (
  id                boolean primary key default true check (id),
  key_hash          text,
  tenant_id         text,
  tenant_name       text,
  token_blob        text,
  token_expires_at  timestamptz,
  connected_at      timestamptz,
  connected_by      uuid references public.profiles (id) on delete set null,
  auto_send         boolean not null default false,
  send_from         date,
  use_os_numbers    boolean not null default true,
  -- FootprintOS VAT rate id → Xero tax type for sales, e.g. {"<id>": "OUTPUT2"}.
  tax_map           jsonb not null default '{}',
  last_sync_at      timestamptz,
  last_error        text,
  updated_at        timestamptz not null default now(),
  updated_by        uuid
);
insert into public.xero_settings (id) values (true);
alter table public.xero_settings enable row level security;
-- Admins read the settings through xero_admin_settings (never the token).

create table public.xero_sync_jobs (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('invoice', 'credit_note')),
  record_id    uuid not null,
  status       text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  attempts     integer not null default 0,
  last_error   text,
  xero_id      text,
  queued_by    uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index xero_sync_jobs_open_idx on public.xero_sync_jobs (kind, record_id) where status in ('pending', 'failed');
create index xero_sync_jobs_status_idx on public.xero_sync_jobs (status, created_at);
create index xero_sync_jobs_record_idx on public.xero_sync_jobs (record_id);
alter table public.xero_sync_jobs enable row level security;
create policy "Admins see Xero jobs" on public.xero_sync_jobs for select to authenticated using ((select public.is_admin()));

-- What's in Xero for each invoice / credit note.
alter table public.sales_documents
  add column xero_id text,
  add column xero_number text,
  add column xero_synced_at timestamptz;
alter table public.suppliers add column xero_contact_id text;

-- ─── Queueing ───────────────────────────────────────────────────────────────

-- Issuing an invoice or credit note queues it, when automatic sending is on
-- and it's dated on or after the start date.
create function public.xero_queue_on_issue()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  s public.xero_settings;
begin
  if new.doc_type not in ('invoice', 'credit_note') or new.xero_id is not null then
    return new;
  end if;
  if new.status not in ('issued', 'paid') or (tg_op = 'UPDATE' and old.status in ('issued', 'paid')) then
    return new;
  end if;
  select * into s from public.xero_settings where id;
  if not s.auto_send or s.tenant_id is null or s.send_from is null or new.issue_date < s.send_from then
    return new;
  end if;
  insert into public.xero_sync_jobs (kind, record_id, queued_by)
  values (new.doc_type, new.id, auth.uid())
  on conflict do nothing;
  return new;
end;
$$;
revoke execute on function public.xero_queue_on_issue() from public, anon, authenticated;
create trigger sales_documents_xero_queue after insert or update of status on public.sales_documents
  for each row execute function public.xero_queue_on_issue();

-- "Send to Xero" by hand (admins and Finance-style editors of sales), for an
-- issued invoice or credit note not yet in Xero. Returns the job id.
create function public.xero_queue_document(p_document uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  d record;
  v_id uuid;
begin
  if not (public.is_admin() or public.has_permission('quotes', 'edit')) then
    raise exception 'Not allowed';
  end if;
  if not public.can_see_sales_document(p_document) then
    raise exception 'Not allowed';
  end if;
  select doc_type, status, xero_id into d from public.sales_documents where id = p_document;
  if d.doc_type not in ('invoice', 'credit_note') or d.status not in ('issued', 'paid') then
    raise exception 'Only issued invoices and credit notes go to Xero';
  end if;
  if d.xero_id is not null then
    raise exception 'This is already in Xero';
  end if;
  if (select tenant_id from public.xero_settings where id) is null then
    raise exception 'Xero isn''t connected yet (Admin → Xero)';
  end if;
  insert into public.xero_sync_jobs (kind, record_id, queued_by) values (d.doc_type, p_document, auth.uid())
  on conflict (kind, record_id) where status in ('pending', 'failed') do update set status = 'pending', updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.xero_queue_document(uuid) from public, anon;
grant execute on function public.xero_queue_document(uuid) to authenticated;

-- ─── Admin settings ─────────────────────────────────────────────────────────

create function public.xero_admin_settings()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case when public.is_admin() then jsonb_build_object(
    'connected', s.tenant_id is not null, 'tenant_name', s.tenant_name, 'connected_at', s.connected_at,
    'connected_by', (select coalesce(p.full_name, p.email) from public.profiles p where p.id = s.connected_by),
    'auto_send', s.auto_send, 'send_from', s.send_from, 'use_os_numbers', s.use_os_numbers, 'tax_map', s.tax_map,
    'last_sync_at', s.last_sync_at, 'last_error', s.last_error) end
    from public.xero_settings s where s.id;
$$;

create function public.xero_save_admin_settings(p_auto_send boolean, p_send_from date, p_use_os_numbers boolean, p_tax_map jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  if p_auto_send and p_send_from is null then
    raise exception 'Choose the date to start sending from before turning automatic sending on';
  end if;
  update public.xero_settings
     set auto_send = coalesce(p_auto_send, false), send_from = p_send_from, use_os_numbers = coalesce(p_use_os_numbers, true),
         tax_map = coalesce(p_tax_map, '{}'), updated_at = now(), updated_by = auth.uid()
   where id;
end;
$$;

revoke execute on function public.xero_admin_settings() from public, anon;
revoke execute on function public.xero_save_admin_settings(boolean, date, boolean, jsonb) from public, anon;
grant execute on function public.xero_admin_settings() to authenticated;
grant execute on function public.xero_save_admin_settings(boolean, date, boolean, jsonb) to authenticated;

-- ─── For FootprintOS's server only (must give the key) ──────────────────────

create function public._xero_key_ok(p_key text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_key is not null and length(p_key) >= 32
     and (select key_hash from public.xero_settings where id) is not null
     and encode(sha256(convert_to(p_key, 'UTF8')), 'hex') = (select key_hash from public.xero_settings where id);
$$;
revoke execute on function public._xero_key_ok(text) from public, anon, authenticated;

-- An admin has just signed in to Xero: remember the organisation and the
-- (encrypted) sign-in, and the key's fingerprint.
create function public.xero_connect(p_key text, p_tenant_id text, p_tenant_name text, p_token_blob text, p_expires_at timestamptz)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  if p_key is null or length(p_key) < 32 or coalesce(p_tenant_id, '') = '' or coalesce(p_token_blob, '') = '' then
    raise exception 'Bad connection details';
  end if;
  update public.xero_settings
     set key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex'), tenant_id = p_tenant_id, tenant_name = p_tenant_name,
         token_blob = p_token_blob, token_expires_at = p_expires_at, connected_at = now(), connected_by = auth.uid(),
         last_error = null, updated_at = now(), updated_by = auth.uid()
   where id;
end;
$$;

create function public.xero_disconnect()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  update public.xero_settings
     set tenant_id = null, tenant_name = null, token_blob = null, token_expires_at = null, auto_send = false,
         updated_at = now(), updated_by = auth.uid()
   where id;
end;
$$;

-- The connection, for the server to talk to Xero.
create function public.xero_connection(p_key text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case when public._xero_key_ok(p_key) then
    jsonb_build_object('tenant_id', s.tenant_id, 'token_blob', s.token_blob, 'token_expires_at', s.token_expires_at,
                       'use_os_numbers', s.use_os_numbers, 'tax_map', s.tax_map) end
    from public.xero_settings s where s.id;
$$;

create function public.xero_save_token(p_key text, p_token_blob text, p_expires_at timestamptz)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public._xero_key_ok(p_key) then
    raise exception 'Not allowed';
  end if;
  update public.xero_settings set token_blob = p_token_blob, token_expires_at = p_expires_at where id;
end;
$$;

-- Up to p_limit queued jobs with everything needed to send them.
create function public.xero_next_jobs(p_key text, p_limit integer, p_only uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not public._xero_key_ok(p_key) then
    raise exception 'Not allowed';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'job_id', j.id, 'kind', j.kind, 'attempts', j.attempts,
             'document', jsonb_build_object(
               'id', d.id, 'doc_type', d.doc_type, 'number', d.number, 'status', d.status, 'issue_date', d.issue_date,
               'due_date', d.due_date, 'reference', coalesce(d.customer_reference, d.title), 'xero_id', d.xero_id,
               'source_xero_id', (select s2.xero_id from public.sales_documents s2 where s2.id = d.source_document_id)),
             'customer', jsonb_build_object(
               'id', c.id, 'name', c.name, 'email', coalesce(c.email, (select ct.email from public.contacts ct where ct.customer_id = c.id and ct.email is not null order by ct.is_primary desc nulls last limit 1)),
               'phone', c.phone, 'xero_contact_id', c.xero_contact_id,
               'street', c.billing_street, 'city', c.billing_city, 'county', c.billing_county, 'postcode', c.billing_postcode, 'country', c.billing_country),
             'lines', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'description', l.description, 'quantity', l.quantity, 'unit_price', l.unit_price,
                        'discount_percent', l.discount_percent, 'tax_rate', l.tax_rate, 'tax_rate_id', l.tax_rate_id,
                        'account_code', l.account_code) order by l.position)
                 from public.sales_document_lines l where l.document_id = d.id), '[]'::jsonb))
           order by j.created_at)
      from (select * from public.xero_sync_jobs
             where status = 'pending' and attempts < 5 and (p_only is null or id = p_only)
             order by created_at limit greatest(1, least(coalesce(p_limit, 20), 50))) j
      join public.sales_documents d on d.id = j.record_id
      join public.customers c on c.id = d.customer_id), '[]'::jsonb);
end;
$$;

-- Record how a job went. On success, remember the Xero ids.
create function public.xero_job_result(p_key text, p_job uuid, p_ok boolean, p_error text, p_xero_id text, p_xero_number text, p_contact_id text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  j public.xero_sync_jobs;
begin
  if not public._xero_key_ok(p_key) then
    raise exception 'Not allowed';
  end if;
  select * into j from public.xero_sync_jobs where id = p_job;
  if j.id is null then
    return;
  end if;
  if p_contact_id is not null then
    update public.customers c set xero_contact_id = p_contact_id
      from public.sales_documents d where d.id = j.record_id and c.id = d.customer_id and c.xero_contact_id is distinct from p_contact_id;
  end if;
  if p_ok then
    update public.xero_sync_jobs set status = 'done', xero_id = p_xero_id, last_error = null, attempts = attempts + 1, updated_at = now() where id = p_job;
    update public.sales_documents set xero_id = p_xero_id, xero_number = p_xero_number, xero_synced_at = now() where id = j.record_id;
  else
    update public.xero_sync_jobs
       set attempts = attempts + 1, last_error = left(p_error, 1000), updated_at = now(),
           status = case when attempts + 1 >= 5 then 'failed' else 'pending' end
     where id = p_job;
  end if;
  update public.xero_settings set last_sync_at = now(), last_error = case when p_ok then last_error else left(p_error, 1000) end where id;
end;
$$;

-- Try a failed job again (admins).
create function public.xero_retry_job(p_job uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.xero_sync_jobs set status = 'pending', attempts = 0, updated_at = now()
   where id = p_job and status = 'failed' and public.is_admin();
$$;

revoke execute on function public.xero_connect(text, text, text, text, timestamptz) from public, anon;
revoke execute on function public.xero_disconnect() from public, anon;
revoke execute on function public.xero_retry_job(uuid) from public, anon;
grant execute on function public.xero_connect(text, text, text, text, timestamptz) to authenticated;
grant execute on function public.xero_disconnect() to authenticated;
grant execute on function public.xero_retry_job(uuid) to authenticated;
-- Key-checked; called by the server, sometimes with no one signed in (the
-- every-few-minutes job).
revoke execute on function public.xero_connection(text) from public;
revoke execute on function public.xero_save_token(text, text, timestamptz) from public;
revoke execute on function public.xero_next_jobs(text, integer, uuid) from public;
revoke execute on function public.xero_job_result(text, uuid, boolean, text, text, text, text) from public;
grant execute on function public.xero_connection(text) to anon, authenticated;
grant execute on function public.xero_save_token(text, text, timestamptz) to anon, authenticated;
grant execute on function public.xero_next_jobs(text, integer, uuid) to anon, authenticated;
grant execute on function public.xero_job_result(text, uuid, boolean, text, text, text, text) to anon, authenticated;
