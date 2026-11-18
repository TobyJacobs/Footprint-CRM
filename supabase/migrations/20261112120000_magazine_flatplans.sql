-- Magazine flatplans (27 October 2026).
--
-- Plain-English summary:
-- * A flatplan is a page-by-page plan of one issue (one edition, one month).
--   Each item on it sits on a page: either a booked advert (an advert line on
--   a sales order for that issue) or an editorial item (e.g. Editor's Letter),
--   with how much of the page it takes.
-- * An advert can only be on the flatplan of its own issue, once, and only on
--   a page that exists in that issue. Removing an advert from its order also
--   removes it from the flatplan.
-- * The page plan, with customer names and artwork status, needs Magazines
--   view; placing and moving items needs Magazines edit.

create table public.magazine_flatplan_items (
  id             uuid primary key default gen_random_uuid(),
  issue_id       uuid not null references public.magazine_issues (id) on delete cascade,
  page           integer not null check (page >= 1),
  line_id        uuid unique references public.sales_document_lines (id) on delete cascade,
  title          text check (title is null or length(trim(title)) between 1 and 200),
  page_fraction  numeric(6,4) check (page_fraction is null or (page_fraction > 0 and page_fraction <= 2)),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid,
  -- An advert (its size comes from the booking) or editorial (title and size).
  check ((line_id is not null and title is null and page_fraction is null)
      or (line_id is null and title is not null and page_fraction is not null))
);
create index magazine_flatplan_items_issue_idx on public.magazine_flatplan_items (issue_id, page);

alter table public.magazine_flatplan_items enable row level security;
create policy "View flatplans" on public.magazine_flatplan_items for select to authenticated
  using ((select public.has_permission('magazines', 'view')));
create policy "Add to flatplans" on public.magazine_flatplan_items for insert to authenticated
  with check ((select public.has_permission('magazines', 'edit')));
create policy "Change flatplans" on public.magazine_flatplan_items for update to authenticated
  using ((select public.has_permission('magazines', 'edit'))) with check ((select public.has_permission('magazines', 'edit')));
create policy "Remove from flatplans" on public.magazine_flatplan_items for delete to authenticated
  using ((select public.has_permission('magazines', 'edit')));

-- Adverts only on their own issue's flatplan; pages must exist in the issue.
create function public.check_flatplan_item()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_pages integer;
begin
  select pages into v_pages from public.magazine_issues where id = new.issue_id;
  if new.page > coalesce(v_pages, 0) then
    raise exception 'This issue has % pages', coalesce(v_pages, 0);
  end if;
  if new.line_id is not null and not exists (
    select 1 from public.sales_document_lines l
      join public.sales_documents d on d.id = l.document_id
     where l.id = new.line_id and l.magazine_issue_id = new.issue_id and d.doc_type = 'sales_order'
  ) then
    raise exception 'That advert isn''t booked in this issue';
  end if;
  return new;
end;
$$;
revoke execute on function public.check_flatplan_item() from anon, authenticated, public;
create trigger magazine_flatplan_items_check before insert or update on public.magazine_flatplan_items
  for each row execute function public.check_flatplan_item();
create trigger magazine_flatplan_items_touch before update on public.magazine_flatplan_items
  for each row execute function public.touch_row();
create trigger audit_magazine_flatplan_items after insert or update or delete on public.magazine_flatplan_items
  for each row execute function public.audit_row();

-- Everything the flatplan page shows for one issue.
create function public.magazine_flatplan(p_issue uuid)
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
