-- UK GDPR tools: subject access exports and erasure ("right to be forgotten").
--
-- Plain-English summary:
-- * Only admins can export or erase personal data.
-- * Erasing a person blanks their personal details but keeps the record
--   (marked "Removed (GDPR)") so history and totals still add up.
-- * Their details are also cleaned out of the audit log, otherwise the log
--   would still hold what we were asked to remove. The log keeps a note that
--   an erasure happened, when, and who did it.
-- * `erased_at` marks erased records so the Zoho import / nightly copy never
--   brings them back.
-- * Exports are recorded in the audit log too.

alter table public.customers add column erased_at timestamptz;
alter table public.contacts  add column erased_at timestamptz;

-- Record an admin-only event (e.g. an export) in the audit log.
create function public.log_admin_event(p_action text, p_table text, p_record jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can do this';
  end if;
  insert into public.audit_log (actor_id, actor_email, action, table_name, record)
  values (auth.uid(), (select email from public.profiles where id = auth.uid()), p_action, p_table, p_record);
end;
$$;

-- Replace audit entries that match with a placeholder that keeps only the
-- record's id (so the trail of *when* things changed survives).
create function public.redact_audit(p_table text, p_key text, p_value text)
returns void
language sql security definer set search_path = ''
as $$
  update public.audit_log
     set record   = jsonb_build_object('id', record ->> 'id', 'redacted', 'GDPR erasure'),
         old_data = case when old_data is null then null else jsonb_build_object('redacted', 'GDPR erasure') end,
         new_data = case when new_data is null then null else jsonb_build_object('redacted', 'GDPR erasure') end
   where table_name = p_table
     and record ->> p_key = p_value;
$$;

-- Erase one contact.
create function public.gdpr_erase_contact(p_contact_id uuid, p_delete_activity boolean default true)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can erase personal data';
  end if;
  if not exists (select 1 from public.contacts where id = p_contact_id) then
    raise exception 'Contact not found';
  end if;

  -- Timeline entries about this person.
  if p_delete_activity then
    delete from public.customer_activity where contact_id = p_contact_id;
  else
    update public.customer_activity set contact_id = null where contact_id = p_contact_id;
  end if;

  update public.contacts set
    salutation = null, first_name = null, last_name = 'Removed (GDPR)',
    job_title = null, department = null,
    email = null, secondary_email = null, phone = null, mobile = null, home_phone = null,
    street = null, city = null, county = null, postcode = null, country = null,
    reports_to_id = null, notes = null, lead_source = null,
    email_opt_out = true, include_in_emails = false, marketing_lists = '{}',
    is_primary = false, erased_at = now()
  where id = p_contact_id;

  update public.contacts set reports_to_id = null where reports_to_id = p_contact_id;

  -- Clean the audit log (including the entries the steps above just created).
  perform public.redact_audit('contacts', 'id', p_contact_id::text);
  perform public.redact_audit('customer_activity', 'contact_id', p_contact_id::text);

  insert into public.audit_log (actor_id, actor_email, action, table_name, record)
  values (auth.uid(), (select email from public.profiles where id = auth.uid()),
          'gdpr_erase', 'contacts', jsonb_build_object('id', p_contact_id));
end;
$$;

-- Erase a whole customer (e.g. a sole trader) and all its people.
create function public.gdpr_erase_customer(p_customer_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  c record;
  cid text := p_customer_id::text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can erase personal data';
  end if;
  if not exists (select 1 from public.customers where id = p_customer_id) then
    raise exception 'Customer not found';
  end if;

  for c in select id from public.contacts where customer_id = p_customer_id loop
    perform public.gdpr_erase_contact(c.id, true);
  end loop;

  delete from public.customer_activity where customer_id = p_customer_id;

  update public.hosting_plans set
    third_party_username = null, credentials_location = null, admin_url = null,
    third_party_url = null, notes = null
  where customer_id = p_customer_id;

  update public.hosting_items set domain = null
  where hosting_plan_id in (select id from public.hosting_plans where customer_id = p_customer_id);

  update public.retainers set notes = null, future_opportunity = null
  where customer_id = p_customer_id;

  update public.customers set
    name = 'Removed customer (GDPR)', website = null, phone = null, email = null,
    description = null,
    billing_street = null, billing_city = null, billing_county = null, billing_postcode = null, billing_country = null,
    shipping_street = null, shipping_city = null, shipping_county = null, shipping_postcode = null, shipping_country = null,
    follow_up_at = null, last_contacted_on = null, erased_at = now()
  where id = p_customer_id;

  perform public.redact_audit('customers', 'id', cid);
  perform public.redact_audit('customer_activity', 'customer_id', cid);
  perform public.redact_audit('hosting_plans', 'customer_id', cid);
  perform public.redact_audit('retainers', 'customer_id', cid);
  update public.audit_log
     set record   = jsonb_build_object('id', record ->> 'id', 'redacted', 'GDPR erasure'),
         old_data = case when old_data is null then null else jsonb_build_object('redacted', 'GDPR erasure') end,
         new_data = case when new_data is null then null else jsonb_build_object('redacted', 'GDPR erasure') end
   where table_name = 'hosting_items'
     and record ->> 'hosting_plan_id' in (select id::text from public.hosting_plans where customer_id = p_customer_id);

  insert into public.audit_log (actor_id, actor_email, action, table_name, record)
  values (auth.uid(), (select email from public.profiles where id = auth.uid()),
          'gdpr_erase', 'customers', jsonb_build_object('id', p_customer_id));
end;
$$;

revoke execute on function public.log_admin_event(text, text, jsonb) from anon, public;
revoke execute on function public.redact_audit(text, text, text) from anon, public, authenticated;
revoke execute on function public.gdpr_erase_contact(uuid, boolean) from anon, public;
revoke execute on function public.gdpr_erase_customer(uuid) from anon, public;
grant execute on function public.log_admin_event(text, text, jsonb) to authenticated;
grant execute on function public.gdpr_erase_contact(uuid, boolean) to authenticated;
grant execute on function public.gdpr_erase_customer(uuid) to authenticated;
