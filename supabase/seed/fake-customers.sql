-- MADE-UP test customers for the TEST database only. Never run on live.
-- Every name, email and phone number here is fictional (example.com /
-- Ofcom drama numbers 01632 960xxx and 07700 900xxx).
-- Safe to re-run: removes previous fake rows first (zoho_id starts 'FAKE-').

begin;

delete from public.customers where zoho_id like 'FAKE-%';

with
  first_names as (select array['Amelia','Oliver','Isla','George','Ava','Harry','Mia','Jack','Freya','Noah','Lily','Leo','Grace','Arthur','Ella','Oscar','Sophie','Alfie','Poppy','Theo'] as a),
  last_names  as (select array['Hughes','Patel','Clarke','Walsh','Bennett','Khan','Turner','Morgan','Price','Foster','Reid','Shaw','Doyle','Barker','Lloyd','Murray','Payne','Day','Kemp','Rowe'] as a),
  biz_a as (select array['Solent','Hamble','Meon','Itchen','Test Valley','Swanwick','Wessex','Harbour','Forest','Downs','Riverside','Chalk Hill','Copse','Tidal','Heathland'] as a),
  biz_b as (select array['Bakery','Plumbing','Dental Care','Joinery','Florists','Accountants','Garage','Physio','Lettings','Electrical','Cafe','Roofing','Vets','Fitness','Interiors'] as a),
  towns as (select array['Fareham','Gosport','Hedge End','Chandler''s Ford','Swindon','Southampton','Eastleigh','Whiteley','Locks Heath','Portchester'] as a),
  statuses as (select array['Client Active','Client Active','Client Active','No Current Services','Cancelled Services','Client Information Update Required'] as a),
  credit as (select array['30 Day Terms Available to Client','14 Day Terms Available to Client','Direct Debit Service Available to Client','No Credit Available - Must Pay Up Front - Before Goods Ordered','ON STOP contact OPS/Finance Team'] as a),
  svc as (select array['Print','Digital Marketing','Web','Social','Advertising','Signage','Vehicle Graphics','Merchandise','YLK'] as a),
  heard as (select array['Website Enquiry','Referral','Social','Paid Ad','Existing Client - FMN','Walk in'] as a),
  n as (select g from generate_series(1, 60) g)
insert into public.customers (
  zoho_id, name, account_type, status, phone, email, website, industry,
  billing_street, billing_city, billing_county, billing_postcode, billing_country,
  services, heard_about_us, credit_status, direct_debit_status,
  invoice_due_days, invoice_due_terms, date_last_ordered, last_contacted_on
)
select
  'FAKE-C' || g,
  (select a[1 + (g * 7) % 15] from biz_a) || ' ' || (select a[1 + (g * 3) % 15] from biz_b) || case when g % 9 = 0 then ' Ltd' else '' end,
  case when g % 11 = 0 then 'Prospect' else 'Business Customer' end,
  (select a[1 + g % 6] from statuses),
  '01632 960' || lpad((100 + g)::text, 3, '0'),
  'hello' || g || '@example.com',
  'www.example-' || g || '.co.uk',
  case g % 4 when 0 then 'Hospitality' when 1 then 'Trades' when 2 then 'Health' else 'Retail' end,
  (10 + g) || ' Example Street',
  (select a[1 + g % 10] from towns),
  case when g % 10 = 4 then 'Wiltshire' else 'Hampshire' end,
  'XX' || (1 + g % 9) || ' ' || (1 + g % 9) || 'ZZ',
  'United Kingdom',
  array(select distinct (select a[1 + ((g * k) % 9)] from svc) from generate_series(1, 1 + g % 3) k),
  array[(select a[1 + g % 6] from heard)],
  (select a[1 + g % 5] from credit),
  case when g % 3 = 0 then 'Active' else 'Not Signed Up' end,
  case when g % 2 = 0 then 30 else 14 end,
  'day(s) after bill date',
  current_date - (g * 5),
  current_date - (g * 2)
from n;

-- One or two contacts per customer.
insert into public.contacts (zoho_id, customer_id, first_name, last_name, job_title, email, phone, mobile, is_primary, financial_status, email_opt_out, include_in_emails)
select
  'FAKE-P' || c.g || '-' || k,
  c.id,
  (select a[1 + ((c.g + k * 5) % 20)] from (select array['Amelia','Oliver','Isla','George','Ava','Harry','Mia','Jack','Freya','Noah','Lily','Leo','Grace','Arthur','Ella','Oscar','Sophie','Alfie','Poppy','Theo'] as a) f),
  (select a[1 + ((c.g * 3 + k) % 20)] from (select array['Hughes','Patel','Clarke','Walsh','Bennett','Khan','Turner','Morgan','Price','Foster','Reid','Shaw','Doyle','Barker','Lloyd','Murray','Payne','Day','Kemp','Rowe'] as a) l),
  case k when 1 then 'Owner' else 'Office Manager' end,
  'contact' || c.g || '.' || k || '@example.com',
  '01632 960' || lpad((500 + c.g)::text, 3, '0'),
  '07700 900' || lpad((100 + c.g * 2 + k)::text, 3, '0'),
  k = 1,
  case when c.g % 17 = 0 then 'ON STOP' else 'Active' end,
  c.g % 7 = 0,
  c.g % 7 <> 0
from (select id, substring(zoho_id from 7)::int as g from public.customers where zoho_id like 'FAKE-C%') c
cross join lateral generate_series(1, 1 + c.g % 2) k;

-- Hosting plans for every 4th customer.
with plans as (
  insert into public.hosting_plans (zoho_id, customer_id, name, plan_type, status, price, billing_frequency, renewal_month, hosting_platform, credentials_location)
  select 'FAKE-H' || c.g, c.id, 'Website hosting',
         case when c.g % 8 = 0 then 'Annual Business Pro Plan' else 'Monthly Business Pro Plan' end,
         case when c.g % 12 = 0 then 'Cancelled' else 'Active' end,
         case when c.g % 8 = 0 then 360 else 35 end,
         case when c.g % 8 = 0 then 'Annually' else 'Monthly' end,
         (array['January','March','May','July','September','November'])[1 + c.g % 6],
         '20i',
         '1Password: ' || c.name || ' – hosting'
  from (select id, name, substring(zoho_id from 7)::int as g from public.customers where zoho_id like 'FAKE-C%') c
  where c.g % 4 = 0
  returning id, zoho_id
)
insert into public.hosting_items (hosting_plan_id, kind, plan, domain, included_hours, on_20i, mailbox_qty, email_platform, footprint_hosted)
select id, 'web', 'Hosting - Business Pro', 'example-' || substring(zoho_id from 7) || '.co.uk', '1 Hour', true, null, null, null from plans
union all
select id, 'email', null, null, null, false, 3, 'Office 365', false from plans;

-- Digital retainers for every 6th customer.
with r as (
  insert into public.retainers (zoho_id, customer_id, name, status, monthly_fee, budget_hours)
  select 'FAKE-R' || c.g, c.id, 'Social & Ads retainer',
         (array['Live','Live','Paused','Cancelled'])[1 + c.g % 4],
         450 + (c.g % 5) * 150, 6 + c.g % 6
  from (select id, substring(zoho_id from 7)::int as g from public.customers where zoho_id like 'FAKE-C%') c
  where c.g % 6 = 0
  returning id
)
insert into public.retainer_services (retainer_id, service, qty_per_month, platforms, ad_spend)
select id, 'Social Media Content', 12, 'Facebook, Instagram', null from r
union all
select id, 'Meta Ads', 1, 'Facebook, Instagram', 300 from r;

-- A few timeline notes.
insert into public.customer_activity (customer_id, kind, body, occurred_at)
select id, (array['note','call','email'])[1 + g % 3],
       (array['Called about reprinting leaflets for spring.',
              'Sent proof for new shop sign; awaiting sign-off.',
              'Asked for a quote for vehicle graphics on two vans.'])[1 + g % 3],
       now() - (g || ' days')::interval
from (select id, substring(zoho_id from 7)::int as g from public.customers where zoho_id like 'FAKE-C%') c
where g % 2 = 0;

commit;
