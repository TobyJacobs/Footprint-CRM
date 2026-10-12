-- Estimated time for each project task (and each template step), in minutes.
-- New projects copy the estimate from their template.

alter table public.project_template_tasks
  add column estimated_minutes integer check (estimated_minutes is null or (estimated_minutes >= 0 and estimated_minutes <= 24 * 60 * 30));

alter table public.project_tasks
  add column estimated_minutes integer check (estimated_minutes is null or (estimated_minutes >= 0 and estimated_minutes <= 24 * 60 * 30));

-- Same as before, but copying each step's estimate into the new project's tasks.
create or replace function public._create_project_for_sales_order(p_order uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  so public.sales_documents%rowtype;
  tpl public.project_templates%rowtype;
  pid uuid;
  num text;
  cust_name text;
begin
  select * into so from public.sales_documents where id = p_order and doc_type = 'sales_order';
  if not found then
    return null;
  end if;

  select id into pid from public.projects where sales_document_id = so.id;
  if found then
    return pid;
  end if;

  select * into tpl from public.project_templates
   where active and business_unit is not null and business_unit = so.business_unit
   order by name limit 1;
  if not found then
    select * into tpl from public.project_templates where active and is_default limit 1;
  end if;

  select name into cust_name from public.customers where id = so.customer_id;
  num := public._take_document_number('project');

  insert into public.projects
    (number, name, customer_id, sales_document_id, owner_id, template_id, project_group, start_date, due_date)
  values
    (num, left(coalesce(cust_name, 'Customer') || ' – ' || coalesce(nullif(trim(so.title), ''), 'Order ' || so.number), 200),
     so.customer_id, so.id, so.owner_id, tpl.id, tpl.project_group, coalesce(so.issue_date, current_date), so.deadline_date)
  returning id into pid;

  if tpl.id is not null then
    insert into public.project_tasks (project_id, stage, position, title, due_date, estimated_minutes)
    select pid, tt.stage, tt.position, tt.title,
           case when tt.due_offset_days is not null then coalesce(so.issue_date, current_date) + tt.due_offset_days end,
           tt.estimated_minutes
      from public.project_template_tasks tt
     where tt.template_id = tpl.id;
  end if;

  insert into public.customer_activity (customer_id, kind, body)
  values (so.customer_id, 'system', 'Project ' || num || ' started for sales order ' || so.number || '.');

  return pid;
end;
$$;
revoke execute on function public._create_project_for_sales_order(uuid) from anon, authenticated, public;

insert into supabase_migrations.schema_migrations (version, name) values ('20261019120000', 'task_estimates');
