-- Magazine flipbooks (27 October 2026).
--
-- Plain-English summary:
-- * Each issue can have its finished PDF uploaded (Magazines edit). It's then
--   published as a public, page-turning flipbook at /read/<edition>/<month>,
--   and /read/<edition> always shows that edition's latest one. This replaces
--   Mag Manager's flipbook link.
-- * Editions get a short web name (e.g. "fareham", "meon-valley") for those
--   addresses.
-- * The PDFs are public (anyone with the address can read the magazine, as
--   with the printed copy). Only Magazines edit can add, replace or remove them.

alter table public.magazine_editions add column slug text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
update public.magazine_editions
   set slug = trim(both '-' from regexp_replace(regexp_replace(replace(lower(name), '''', ''), '&', ' ', 'g'), '[^a-z0-9]+', '-', 'g'));
alter table public.magazine_editions alter column slug set not null;

alter table public.magazine_issues
  add column flipbook_path text,
  add column flipbook_published_at timestamptz;

-- ─── Public file store for issue PDFs ───────────────────────────────────────
-- Files live at "<issue id>/<random>.pdf".

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('flipbooks', 'flipbooks', true, 52428800, array['application/pdf'])
on conflict (id) do nothing;

create policy "Upload flipbooks" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'flipbooks'
    and public.has_permission('magazines', 'edit')
    and exists (select 1 from public.magazine_issues i where i.id::text = (storage.foldername(name))[1])
  );
create policy "Remove flipbooks" on storage.objects for delete to authenticated
  using (bucket_id = 'flipbooks' and public.has_permission('magazines', 'edit'));

-- ─── What the public flipbook page needs ────────────────────────────────────
-- One edition's published issue for a month (or its latest), plus the other
-- published months for moving between issues. Null if there's nothing.

create function public.get_flipbook(p_slug text, p_month date)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with e as (
    select id, code, name, slug from public.magazine_editions where slug = lower(p_slug) and active
  ),
  published as (
    select i.month, i.flipbook_path
      from public.magazine_issues i join e on e.id = i.edition_id
     where i.flipbook_path is not null
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
           'path', c.flipbook_path,
           'months', (select jsonb_agg(p.month order by p.month desc) from published p))
    from e join chosen c on true;
$$;
revoke execute on function public.get_flipbook(text, date) from public;
grant execute on function public.get_flipbook(text, date) to anon, authenticated;
