-- Marketing home page (15 October 2026).
--
-- Plain-English summary:
-- * Roles can now have a "marketing" home page, like Directors, Sales,
--   Finance and Operations.
-- * The Marketing team role uses it: their tasks, content due this week,
--   content waiting for client approval and ad campaigns that need a look.
-- Admins can change a role's home page in Admin → Roles.

do $$
declare
  c text;
begin
  select conname into c
    from pg_constraint
   where conrelid = 'public.roles'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%dashboard%';
  if c is not null then
    execute format('alter table public.roles drop constraint %I', c);
  end if;
end $$;

alter table public.roles add constraint roles_dashboard_check
  check (dashboard in ('director', 'sales', 'finance', 'operations', 'marketing', 'general'));

update public.roles
   set dashboard = 'marketing',
       description = 'Marketing, social media, content and design. Home page shows their tasks, content due, client approvals and ad campaigns.'
 where name = 'Marketing team';
