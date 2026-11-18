-- Flatplan page files (1 November 2026).
--
-- Plain-English summary:
-- * Instead of one PDF for the whole issue, each page on the flatplan has its
--   own upload: a PDF, JPG or PNG of the finished page (owner's request).
-- * When every page has a file, "Put the flipbook online" publishes the
--   page-turning flipbook at /read/<edition>/<month>, built from the page
--   files in order. Replacing a page's file updates the flipbook straight away.
-- * Files are public once uploaded (as with the printed magazine); only
--   Magazines edit can add, replace or remove them. No whole-issue PDF had been
--   uploaded, so nothing existing changes.

create table public.magazine_issue_pages (
  id            uuid primary key default gen_random_uuid(),
  issue_id      uuid not null references public.magazine_issues (id) on delete cascade,
  page          integer not null check (page between 1 and 400),
  path          text not null,
  content_type  text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid,
  unique (issue_id, page),
  check (path like issue_id::text || '/pages/%')
);

alter table public.magazine_issue_pages enable row level security;
create policy "View page files" on public.magazine_issue_pages for select to authenticated
  using ((select public.has_permission('magazines', 'view')));
create policy "Add page files" on public.magazine_issue_pages for insert to authenticated
  with check ((select public.has_permission('magazines', 'edit')));
create policy "Change page files" on public.magazine_issue_pages for update to authenticated
  using ((select public.has_permission('magazines', 'edit'))) with check ((select public.has_permission('magazines', 'edit')));
create policy "Remove page files" on public.magazine_issue_pages for delete to authenticated
  using ((select public.has_permission('magazines', 'edit')));
create trigger magazine_issue_pages_touch before update on public.magazine_issue_pages
  for each row execute function public.touch_row();
create trigger audit_magazine_issue_pages after insert or update or delete on public.magazine_issue_pages
  for each row execute function public.audit_row();

-- Page files can be images as well as PDFs.
update storage.buckets
   set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
 where id = 'flipbooks';

-- Replacing a file needs "update" on storage too (upsert), for Magazines edit.
create policy "Replace flipbook files" on storage.objects for update to authenticated
  using (bucket_id = 'flipbooks' and public.has_permission('magazines', 'edit'))
  with check (bucket_id = 'flipbooks' and public.has_permission('magazines', 'edit'));

-- ─── What the public flipbook page needs ────────────────────────────────────
-- An issue is online when it has been published and has page files. Returns
-- its pages in order, plus the other online months for moving between issues.

create or replace function public.get_flipbook(p_slug text, p_month date)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with e as (
    select id, code, name, slug from public.magazine_editions where slug = lower(p_slug) and active
  ),
  published as (
    select i.id, i.month
      from public.magazine_issues i join e on e.id = i.edition_id
     where i.flipbook_published_at is not null
       and exists (select 1 from public.magazine_issue_pages p where p.issue_id = i.id)
  ),
  chosen as (
    select * from published
     where (p_month is null or month = date_trunc('month', p_month)::date)
     order by month desc
     limit 1
  )
  select jsonb_build_object(
           'code', e.code,
           'name', e.name,
           'slug', e.slug,
           'month', c.month,
           'pages', (select jsonb_agg(jsonb_build_object('page', p.page, 'path', p.path, 'type', p.content_type) order by p.page)
                       from public.magazine_issue_pages p where p.issue_id = c.id),
           'months', (select jsonb_agg(p.month order by p.month desc) from published p))
    from e join chosen c on true;
$$;
revoke execute on function public.get_flipbook(text, date) from public;
grant execute on function public.get_flipbook(text, date) to anon, authenticated;
