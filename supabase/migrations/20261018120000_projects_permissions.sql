-- Who can use Projects & Time (7 October 2026).
--
-- Plain-English summary:
-- * Sales and Finance get view + edit on Projects & Time, like Directors and
--   Operations already have, so everyone can see projects and log time.
-- * Directors also get "delete", which lets them delete projects and correct
--   or remove other people's time entries.
-- Admins can change any of this in Roles.

insert into public.role_permissions (role_id, feature, action)
select r.id, p.feature, p.action
  from public.roles r
  join (values
    ('Directors', 'projects', 'delete'),
    ('Sales team', 'projects', 'view'), ('Sales team', 'projects', 'edit'),
    ('Finance team', 'projects', 'view'), ('Finance team', 'projects', 'edit')
  ) as p(role_name, feature, action) on p.role_name = r.name
on conflict do nothing;
