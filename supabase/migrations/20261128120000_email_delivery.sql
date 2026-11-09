-- Email delivery confirmation (9 November 2026, owner: "some emails don't
-- send, so can we get a verification once the email has reached the
-- customer").
--
-- Plain-English summary:
-- * "Sent" only ever meant SendGrid accepted the email. SendGrid now reports
--   back what happened next (its Event Webhook): delivered to the customer's
--   mail server, delayed, bounced, dropped (e.g. a known bad address) or
--   marked as spam. Each recorded email shows that.
-- * Only FootprintOS can record a report: it first checks SendGrid's
--   signature on the report, then passes the same secret key the customer
--   portal uses (PORTAL_LINK_KEY), so nobody can fake a delivery.
-- * When an email bounces or is dropped, FootprintOS is told who sent it, so
--   they can be alerted to fix the address and send it again.

alter table public.email_log
  add column delivery_status text check (delivery_status in ('delivered', 'deferred', 'bounced', 'dropped', 'spam')),
  add column delivery_detail text check (delivery_detail is null or length(delivery_detail) <= 500),
  add column delivery_at timestamptz;
create index email_log_message_idx on public.email_log (provider_message_id) where provider_message_id is not null;

-- One report from SendGrid about one email. SendGrid's message id is the id we
-- saved when sending, plus a suffix (e.g. "abc123.filter0001..."). A worse
-- outcome replaces a better one only where it makes sense: a bounce after a
-- delay counts, but a late "delayed" never hides "delivered". Returns the
-- email's details when it has just failed (so the sender can be told), else null.
create function public.email_delivery_event(p_key text, p_message_id text, p_event text, p_detail text, p_at timestamptz)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_status text;
  v_row public.email_log;
  v_rank_new int;
  v_rank_old int;
begin
  if not public._chat_key_ok(p_key) then
    raise exception 'Not allowed';
  end if;
  v_status := case p_event
    when 'delivered' then 'delivered'
    when 'deferred' then 'deferred'
    when 'bounce' then 'bounced'
    when 'blocked' then 'bounced'
    when 'dropped' then 'dropped'
    when 'spamreport' then 'spam'
  end;
  if v_status is null or coalesce(p_message_id, '') = '' then
    return null;
  end if;
  select * into v_row from public.email_log
   where provider_message_id = split_part(p_message_id, '.', 1)
   order by sent_at desc limit 1;
  if v_row.id is null then
    return null;
  end if;
  -- How settled each outcome is: a later report only moves it forward.
  v_rank_new := case v_status when 'deferred' then 1 when 'delivered' then 2 else 3 end;
  v_rank_old := case when v_row.delivery_status is null then 0 when v_row.delivery_status = 'deferred' then 1
                     when v_row.delivery_status = 'delivered' then 2 else 3 end;
  if v_rank_new < v_rank_old or (v_rank_new = v_rank_old and v_row.delivery_status = v_status) then
    return null;
  end if;
  update public.email_log
     set delivery_status = v_status,
         delivery_detail = nullif(left(trim(coalesce(p_detail, '')), 500), ''),
         delivery_at = coalesce(p_at, now())
   where id = v_row.id;
  if v_status in ('bounced', 'dropped') and v_row.delivery_status is distinct from v_status then
    return jsonb_build_object(
      'to', v_row.to_addresses, 'subject', v_row.subject, 'detail', p_detail,
      'sales_document_id', v_row.sales_document_id, 'purchase_order_id', v_row.purchase_order_id, 'customer_id', v_row.customer_id,
      'sender_email', (select p.email from public.profiles p where p.id = v_row.sent_by and p.is_active));
  end if;
  return null;
end;
$$;
revoke execute on function public.email_delivery_event(text, text, text, text, timestamptz) from public;
grant execute on function public.email_delivery_event(text, text, text, text, timestamptz) to anon, authenticated;
