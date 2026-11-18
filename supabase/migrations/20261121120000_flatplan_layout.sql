-- Flatplan layout (2 November 2026).
--
-- Plain-English summary:
-- * Each item on a flatplan page can now have a position on the page (where
--   its top-left corner sits, in millimetres from the top-left of the page),
--   so adverts and editorial can be dragged to exactly where they go.
-- * An advert's width and height come from its booked size (e.g. Half Page -
--   Landscape is 130 × 90 mm). Editorial items get the width and height of the
--   size chosen for them.
-- * The page area is the Full Page size (130 × 190 mm). Items placed before
--   this change have no position; the flatplan lays them out until moved.

alter table public.magazine_flatplan_items
  add column x_mm numeric(6,1) check (x_mm is null or x_mm between 0 and 300),
  add column y_mm numeric(6,1) check (y_mm is null or y_mm between 0 and 300),
  add column width_mm numeric(6,1) check (width_mm is null or width_mm between 1 and 300),
  add column height_mm numeric(6,1) check (height_mm is null or height_mm between 1 and 300);

-- Everything the flatplan page shows for one issue, now with sizes in mm and
-- positions.
create or replace function public.magazine_flatplan(p_issue uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_issue record;
begin
  if not public.has_permission('magazines', 'view') then
    raise exception 'Not allowed';
  end if;
  select i.id, i.month, i.pages, i.complete, e.id edition_id, e.code, e.name
    into v_issue
    from public.magazine_issues i join public.magazine_editions e on e.id = i.edition_id
   where i.id = p_issue;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'issue', jsonb_build_object('id', v_issue.id, 'month', v_issue.month, 'pages', v_issue.pages, 'complete', v_issue.complete,
                                'edition_id', v_issue.edition_id, 'code', v_issue.code, 'name', v_issue.name),
    'placed', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.id,
               'page', f.page,
               'kind', case when f.line_id is null then 'editorial' else 'advert' end,
               'line_id', f.line_id,
               'title', coalesce(f.title, c.name, l.description),
               'size', sz.name,
               'fraction', coalesce(f.page_fraction, sz.page_fraction, 0),
               'width_mm', coalesce(f.width_mm, sz.width_mm),
               'height_mm', coalesce(f.height_mm, sz.height_mm),
               'x_mm', f.x_mm,
               'y_mm', f.y_mm,
               'order_id', d.id,
               'order_number', d.number,
               'cancelled', coalesce(d.status = 'cancelled', false),
               'artwork_stage', j.stage,
               'artwork_job_id', j.id)
             order by f.page, f.created_at)
        from public.magazine_flatplan_items f
        left join public.sales_document_lines l on l.id = f.line_id
        left join public.sales_documents d on d.id = l.document_id
        left join public.customers c on c.id = d.customer_id
        left join public.advert_sizes sz on sz.id = l.advert_size_id
        left join public.design_jobs j on j.sales_order_id = d.id and j.advert_size_id = l.advert_size_id
       where f.issue_id = p_issue), '[]'::jsonb),
    'unplaced', coalesce((
      select jsonb_agg(jsonb_build_object(
               'line_id', l.id,
               'title', coalesce(c.name, l.description),
               'size', sz.name,
               'fraction', coalesce(sz.page_fraction, 0),
               'width_mm', sz.width_mm,
               'height_mm', sz.height_mm,
               'order_id', d.id,
               'order_number', d.number,
               'artwork_stage', j.stage,
               'artwork_job_id', j.id)
             order by sz.page_fraction desc nulls last, c.name)
        from public.sales_document_lines l
        join public.sales_documents d on d.id = l.document_id
        left join public.customers c on c.id = d.customer_id
        left join public.advert_sizes sz on sz.id = l.advert_size_id
        left join public.design_jobs j on j.sales_order_id = d.id and j.advert_size_id = l.advert_size_id
       where l.magazine_issue_id = p_issue
         and d.doc_type = 'sales_order' and d.status <> 'cancelled'
         and not exists (select 1 from public.magazine_flatplan_items f where f.line_id = l.id)), '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.magazine_flatplan(uuid) from public, anon;
grant execute on function public.magazine_flatplan(uuid) to authenticated;
