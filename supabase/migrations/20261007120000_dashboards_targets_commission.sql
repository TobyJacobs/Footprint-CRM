-- Director's improvements (items 6, 7 and 10): role dashboards, targets and
-- commission.
--
-- Plain-English summary:
-- * Each role has a "dashboard" type (director, sales, finance, operations or
--   general). The home page shows the dashboard(s) for the person's roles, so
--   new roles added later just pick one — no code change needed.
-- * Invoices now record when they were paid (`paid_at`), set automatically
--   when an invoice is marked paid. Needed for commission and cash received.
-- * `monthly_targets`: the group's monthly goal (£300,000 to start), a target
--   margin %, and optional per-person sales targets. A target with no month
--   applies to every month; one with a month overrides it for that month.
-- * `commission_rules`: a default rule for everyone (an EXAMPLE to start:
--   10% of gross profit on paid invoices) and optional per-person rules.
-- * Targets and commission can be read by the person they're about, by
--   directors and finance, and by admins. Only admins can change them.
-- * `team_month_stats` adds up each salesperson's figures for a date range,
--   as the person asking (row-level security still applies).
-- * Creates the four starting roles: Directors, Sales team, Finance team and
--   Operations team, plus a "Staff hub" permission for everyone in them.

-- ─── Dashboard type per role ────────────────────────────────────────────────

alter table public.roles
  add column dashboard text not null default 'general'
    check (dashboard in ('director', 'sales', 'finance', 'operations', 'general'));

-- The dashboard types of the signed-in person's roles.
create function public.my_dashboards()
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(distinct r.dashboard), '{}')
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
   where ur.user_id = auth.uid() and public.is_active_user();
$$;

-- ─── When an invoice was paid ───────────────────────────────────────────────

alter table public.sales_documents add column paid_at timestamptz;

create function public.set_paid_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') and new.paid_at is null then
    new.paid_at := now();
  elsif new.status <> 'paid' then
    new.paid_at := null;
  end if;
  return new;
end;
$$;

create trigger sales_documents_paid_at
  before insert or update of status on public.sales_documents
  for each row execute function public.set_paid_at();

-- Existing paid invoices: best guess is when the record last changed.
update public.sales_documents set paid_at = updated_at where status = 'paid' and paid_at is null;

-- ─── Targets ────────────────────────────────────────────────────────────────

create table public.monthly_targets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (id) on delete cascade,  -- empty = whole group
  metric      text not null check (metric in ('invoiced', 'gross_profit', 'margin_pct')),
  month       date check (month is null or extract(day from month) = 1), -- empty = every month
  amount      numeric(12,2) not null check (amount >= 0),
  is_example  boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  unique nulls not distinct (user_id, metric, month)
);

create table public.commission_rules (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid unique references public.profiles (id) on delete cascade,  -- empty = default for everyone
  basis         text not null default 'gross_profit' check (basis in ('gross_profit', 'invoiced')),
  rate          numeric(5,2) not null check (rate >= 0 and rate <= 100),
  counted_when  text not null default 'paid' check (counted_when in ('invoiced', 'paid')),
  is_example    boolean not null default false,
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);
create unique index commission_rules_one_default on public.commission_rules ((user_id is null)) where user_id is null;

alter table public.monthly_targets enable row level security;
alter table public.commission_rules enable row level security;

create policy "Read own, group and (for directors/finance) all targets" on public.monthly_targets
  for select to authenticated using (
    public.is_active_user() and (
      user_id is null or user_id = auth.uid() or public.is_admin()
      or public.my_dashboards() && array['director', 'finance']
    )
  );
create policy "Admins manage targets" on public.monthly_targets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Read own, default and (for directors/finance) all commission rules" on public.commission_rules
  for select to authenticated using (
    public.is_active_user() and (
      user_id is null or user_id = auth.uid() or public.is_admin()
      or public.my_dashboards() && array['director', 'finance']
    )
  );
create policy "Admins manage commission rules" on public.commission_rules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.monthly_targets, public.commission_rules from anon;

create trigger monthly_targets_touch before update on public.monthly_targets for each row execute function public.touch_row();
create trigger commission_rules_touch before update on public.commission_rules for each row execute function public.touch_row();
create trigger audit_monthly_targets after insert or update or delete on public.monthly_targets for each row execute function public.audit_row();
create trigger audit_commission_rules after insert or update or delete on public.commission_rules for each row execute function public.audit_row();

insert into public.monthly_targets (user_id, metric, month, amount, is_example) values
  (null, 'invoiced', null, 300000, true),
  (null, 'margin_pct', null, 45, true);
insert into public.commission_rules (user_id, basis, rate, counted_when, is_example) values
  (null, 'gross_profit', 10, 'paid', true);

-- ─── Per-person figures for a date range ────────────────────────────────────

create function public.team_month_stats(p_from date, p_to date)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with docs as (
    select d.* from public.sales_documents d where d.status <> 'draft'
  ),
  per_owner as (
    select d.owner_id,
           -- invoiced in the range, after credit notes
           coalesce(sum(d.subtotal) filter (where d.doc_type = 'invoice' and d.status in ('issued', 'paid') and d.issue_date between p_from and p_to), 0)
           - coalesce(sum(d.subtotal) filter (where d.doc_type = 'credit_note' and d.status = 'issued' and d.issue_date between p_from and p_to), 0) as invoiced,
           coalesce(sum(d.cost_total) filter (where d.doc_type = 'invoice' and d.status in ('issued', 'paid') and d.issue_date between p_from and p_to), 0) as cost,
           -- paid in the range (for commission "when paid" and cash received)
           coalesce(sum(d.subtotal) filter (where d.doc_type = 'invoice' and d.status = 'paid' and d.paid_at::date between p_from and p_to), 0) as paid_net,
           coalesce(sum(d.cost_total) filter (where d.doc_type = 'invoice' and d.status = 'paid' and d.paid_at::date between p_from and p_to), 0) as paid_cost,
           coalesce(sum(d.total) filter (where d.doc_type = 'invoice' and d.status = 'paid' and d.paid_at::date between p_from and p_to), 0) as paid_gross,
           count(*) filter (where d.doc_type = 'quote' and d.issue_date between p_from and p_to) as quotes_sent,
           coalesce(sum(d.subtotal) filter (where d.doc_type = 'quote' and d.issue_date between p_from and p_to), 0) as quotes_value,
           count(*) filter (where d.doc_type = 'quote' and d.status in ('accepted', 'converted') and d.issue_date between p_from and p_to) as won,
           coalesce(sum(d.subtotal) filter (where d.doc_type = 'quote' and d.status in ('accepted', 'converted') and d.issue_date between p_from and p_to), 0) as won_value,
           count(*) filter (where d.doc_type = 'quote' and d.status = 'declined' and d.issue_date between p_from and p_to) as lost,
           count(*) filter (where d.doc_type = 'quote' and d.status = 'sent') as open_quotes,
           coalesce(sum(d.subtotal) filter (where d.doc_type = 'quote' and d.status = 'sent'), 0) as open_value,
           count(*) filter (where d.doc_type = 'credit_note' and d.status = 'issued' and d.issue_date between p_from and p_to) as credit_notes,
           coalesce(sum(d.total) filter (where d.doc_type = 'credit_note' and d.status = 'issued' and d.issue_date between p_from and p_to), 0) as credit_value
      from docs d
     group by d.owner_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'owner_id', o.owner_id,
           'name', coalesce(p.full_name, p.email, 'No salesperson'),
           'invoiced', o.invoiced, 'cost', o.cost,
           'paid_net', o.paid_net, 'paid_cost', o.paid_cost, 'paid_gross', o.paid_gross,
           'quotes_sent', o.quotes_sent, 'quotes_value', o.quotes_value,
           'won', o.won, 'won_value', o.won_value, 'lost', o.lost,
           'open_quotes', o.open_quotes, 'open_value', o.open_value,
           'credit_notes', o.credit_notes, 'credit_value', o.credit_value)
           order by o.invoiced desc), '[]'::jsonb)
    from per_owner o
    left join public.profiles p on p.id = o.owner_id;
$$;

revoke execute on function public.my_dashboards() from anon, public;
revoke execute on function public.team_month_stats(date, date) from anon, public;
revoke execute on function public.set_paid_at() from anon, public;
grant execute on function public.my_dashboards() to authenticated;
grant execute on function public.team_month_stats(date, date) to authenticated;

-- ─── The four starting roles ────────────────────────────────────────────────

insert into public.roles (name, description, dashboard) values
  ('Directors', 'Sees everything. Home page shows the group''s goal, profit, team and cash.', 'director'),
  ('Sales team', 'Customers and quotes. Home page shows their own sales, target and commission.', 'sales'),
  ('Finance team', 'Invoices, payments and reports. Home page shows budget, margin and money owed.', 'finance'),
  ('Operations team', 'Orders, purchase orders and production. Home page shows orders and deliveries.', 'operations')
on conflict (name) do update set dashboard = excluded.dashboard, description = excluded.description;

insert into public.role_permissions (role_id, feature, action)
select r.id, p.feature, p.action
  from public.roles r
  join (values
    ('Directors', 'customers', 'view'), ('Directors', 'customers', 'edit'), ('Directors', 'customers', 'delete'),
    ('Directors', 'quotes', 'view'), ('Directors', 'quotes', 'edit'), ('Directors', 'quotes', 'delete'),
    ('Directors', 'projects', 'view'), ('Directors', 'projects', 'edit'),
    ('Directors', 'dashboards', 'view'), ('Directors', 'design', 'view'), ('Directors', 'magazines', 'view'),
    ('Directors', 'reports', 'view'), ('Directors', 'marketing', 'view'), ('Directors', 'hub', 'view'),
    ('Sales team', 'customers', 'view'), ('Sales team', 'customers', 'edit'),
    ('Sales team', 'quotes', 'view'), ('Sales team', 'quotes', 'edit'),
    ('Sales team', 'hub', 'view'),
    ('Finance team', 'customers', 'view'), ('Finance team', 'customers', 'edit'),
    ('Finance team', 'quotes', 'view'), ('Finance team', 'quotes', 'edit'), ('Finance team', 'quotes', 'delete'),
    ('Finance team', 'reports', 'view'), ('Finance team', 'hub', 'view'),
    ('Operations team', 'customers', 'view'),
    ('Operations team', 'quotes', 'view'), ('Operations team', 'quotes', 'edit'),
    ('Operations team', 'projects', 'view'), ('Operations team', 'projects', 'edit'),
    ('Operations team', 'design', 'view'), ('Operations team', 'hub', 'view')
  ) as p(role_name, feature, action) on p.role_name = r.name
on conflict do nothing;

-- Starting guesses for job titles (edit in Admin → Microsoft 365).
insert into public.job_role_rules (match_text, role_id, priority)
select m.match_text, r.id, m.priority
  from (values
    ('Director', 'Directors', 10),
    ('Sales', 'Sales team', 50),
    ('Account Manager', 'Sales team', 50),
    ('Business Development', 'Sales team', 50),
    ('Finance', 'Finance team', 40),
    ('Accounts', 'Finance team', 40),
    ('Bookkeep', 'Finance team', 40),
    ('Operations', 'Operations team', 60),
    ('Production', 'Operations team', 60),
    ('Print', 'Operations team', 70)
  ) as m(match_text, role_name, priority)
  join public.roles r on r.name = m.role_name
on conflict do nothing;
