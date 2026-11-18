-- Marketing team role (14 October 2026).
--
-- Plain-English summary:
-- * New role "Marketing team" for marketing, social media, content and design
--   staff. Until Design Workload (Wave 4) needs its own role, designers sit
--   here too.
-- * Access: see customers (no editing), work on projects and log time, see
--   Design and Marketing, and the Staff hub. No quotes, invoices or finance.
-- * Home page: the general one.
-- * Job title rules so Microsoft 365 titles containing these words get the
--   role automatically. Directors still win (lower priority number).
-- Admins can change any of this in Roles and Admin → Microsoft 365.

insert into public.roles (name, description, dashboard) values
  ('Marketing team', 'Marketing, social media, content and design. Customers (view only), projects and time, design and marketing.', 'general')
on conflict (name) do nothing;

insert into public.role_permissions (role_id, feature, action)
select r.id, p.feature, p.action
  from public.roles r
  join (values
    ('customers', 'view'),
    ('projects', 'view'), ('projects', 'edit'),
    ('design', 'view'),
    ('marketing', 'view'),
    ('hub', 'view')
  ) as p(feature, action) on true
 where r.name = 'Marketing team'
on conflict do nothing;

insert into public.job_role_rules (match_text, role_id, priority)
select m.match_text, r.id, 60
  from (values ('Marketing'), ('Social Media'), ('Content'), ('Design')) as m(match_text)
  join public.roles r on r.name = 'Marketing team'
on conflict do nothing;
