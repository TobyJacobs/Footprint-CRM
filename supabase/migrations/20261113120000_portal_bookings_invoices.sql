-- Customer portal part 2 (27 October 2026): advertisers' bookings and invoices.
--
-- Plain-English summary:
-- * The portal now also lists the customer's Forget Me Not adverts (from three
--   months ago onwards): month, edition, size, order number and how the
--   artwork is getting on. Cancelled orders and quotes are left out.
-- * And their invoices: issued and paid only (never drafts or void ones), with
--   what's still owed after any issued credit notes, and the private link to
--   view or download each one.
-- * Same rule as before: only the companies where their email is a contact.

create or replace function public.portal_overview(p_session text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := public._portal_session_email(p_session);
begin
  if v_email is null then
    return null;
  end if;
  update public.portal_sessions set last_seen_at = now()
   where token_hash = public._portal_hash(p_session) and last_seen_at < now() - interval '5 minutes';

  return jsonb_build_object(
    'email', v_email,
    'first_name', (select c.first_name from public.contacts c
                    where c.email is not null and lower(trim(c.email)) = v_email and c.first_name is not null
                    order by c.is_primary desc, c.created_at limit 1),
    'customers', coalesce((
      select jsonb_agg(jsonb_build_object('id', cu.id, 'name', cu.name) order by cu.name)
        from public.customers cu
       where cu.id in (select public._portal_customer_ids(v_email))), '[]'::jsonb),
    'quotes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'number', d.number,
               'title', d.title,
               'kind', d.quote_kind,
               'status', d.status,
               'issue_date', d.issue_date,
               'valid_until', d.valid_until,
               'total', d.total,
               'customer_name', cu.name,
               'token', d.public_token)
             order by d.issue_date desc, d.number desc)
        from public.sales_documents d
        join public.customers cu on cu.id = d.customer_id
       where d.doc_type = 'quote'
         and d.status in ('sent', 'accepted', 'declined', 'converted')
         and d.customer_id in (select public._portal_customer_ids(v_email))), '[]'::jsonb),
    'hosting', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', h.name,
               'plan_type', h.plan_type,
               'status', h.status,
               'price', h.price,
               'billing_frequency', h.billing_frequency,
               'renewal_month', h.renewal_month,
               'customer_name', cu.name,
               'items', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'kind', i.kind,
                          'plan', i.plan,
                          'domain', i.domain,
                          'mailbox_qty', i.mailbox_qty,
                          'email_platform', i.email_platform)
                        order by i.kind desc, i.domain)
                   from public.hosting_items i
                  where i.hosting_plan_id = h.id), '[]'::jsonb))
             order by cu.name, h.name)
        from public.hosting_plans h
        join public.customers cu on cu.id = h.customer_id
       where h.customer_id in (select public._portal_customer_ids(v_email))), '[]'::jsonb),
    'content', coalesce((
      select jsonb_agg(x.j order by x.d desc nulls last)
        from (select jsonb_build_object(
                       'title', ci.title,
                       'channel', ci.channel,
                       'publish_date', ci.publish_date,
                       'status', ci.status,
                       'link', ci.link,
                       'customer_name', cu.name) j, ci.publish_date d
                from public.content_items ci
                join public.customers cu on cu.id = ci.customer_id
               where ci.status <> 'idea'
                 and ci.customer_id in (select public._portal_customer_ids(v_email))
               order by ci.publish_date desc nulls last
               limit 100) x), '[]'::jsonb),
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', a.name,
               'platform', a.platform,
               'status', a.status,
               'start_date', a.start_date,
               'end_date', a.end_date,
               'budget', a.budget,
               'spend', a.spend,
               'leads', a.leads,
               'results', a.results,
               'customer_name', cu.name)
             order by a.start_date desc nulls last, a.name)
        from public.ad_campaigns a
        join public.customers cu on cu.id = a.customer_id
       where a.customer_id in (select public._portal_customer_ids(v_email))), '[]'::jsonb),
    'retainers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', r.name,
               'status', r.status,
               'monthly_fee', r.monthly_fee,
               'budget_hours', r.budget_hours,
               'customer_name', cu.name)
             order by cu.name, r.name)
        from public.retainers r
        join public.customers cu on cu.id = r.customer_id
       where r.customer_id in (select public._portal_customer_ids(v_email))), '[]'::jsonb),
    'tickets', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id,
               'number', t.number,
               'kind', t.kind,
               'subject', t.subject,
               'status', t.status,
               'last_message_at', t.last_message_at,
               'customer_name', cu.name)
             order by t.last_message_at desc)
        from public.support_tickets t
        join public.customers cu on cu.id = t.customer_id
       where t.contact_email = v_email
         and t.customer_id in (select public._portal_customer_ids(v_email))), '[]'::jsonb),
    'adverts', coalesce((
      select jsonb_agg(jsonb_build_object(
               'month', i.month,
               'edition', e.code || '. ' || e.name,
               'size', sz.name,
               'order_number', d.number,
               'customer_name', cu.name,
               'artwork_stage', j.stage,
               'artwork_source', j.artwork_source)
             order by i.month, e.code)
        from public.sales_document_lines l
        join public.magazine_issues i on i.id = l.magazine_issue_id
        join public.magazine_editions e on e.id = i.edition_id
        join public.sales_documents d on d.id = l.document_id
        join public.customers cu on cu.id = d.customer_id
        left join public.advert_sizes sz on sz.id = l.advert_size_id
        left join public.design_jobs j on j.sales_order_id = d.id and j.advert_size_id = l.advert_size_id
       where d.doc_type = 'sales_order' and d.status <> 'cancelled'
         and i.month >= (date_trunc('month', current_date) - interval '3 months')::date
         and d.customer_id in (select public._portal_customer_ids(v_email))), '[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(jsonb_build_object(
               'number', d.number,
               'title', d.title,
               'status', d.status,
               'issue_date', d.issue_date,
               'due_date', d.due_date,
               'total', d.total,
               'owed', case when d.status = 'paid' then 0
                            else greatest(0, d.total - coalesce((
                              select sum(cn.total) from public.sales_documents cn
                               where cn.source_document_id = d.id and cn.doc_type = 'credit_note' and cn.status = 'issued'), 0)) end,
               'customer_name', cu.name,
               'token', d.public_token)
             order by d.issue_date desc, d.number desc)
        from public.sales_documents d
        join public.customers cu on cu.id = d.customer_id
       where d.doc_type = 'invoice'
         and d.status in ('issued', 'paid')
         and d.customer_id in (select public._portal_customer_ids(v_email))), '[]'::jsonb)
  );
end;
$$;
