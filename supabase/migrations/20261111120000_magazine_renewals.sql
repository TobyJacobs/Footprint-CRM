-- Magazine renewals (27 October 2026), like Mag Manager's renewals list.
--
-- Plain-English summary:
-- * For a month, every advertiser who booked an earlier issue but nothing in
--   this one, scored by how recently they last booked and whether they have
--   bookings after this month (Mag Manager's scores; themed-issue scores are
--   left out as we don't record issue themes):
--     last month 20 (19 with future bookings), 2 months ago 16 (15),
--     3 months ago 12 (11), 4–6 months ago 8 (7), 7–12 months ago 4 (3).
-- * The opportunity is what they spent in their last booked month.
-- * Staff can mark each renewal Contacted, Carried forward or Definitely out,
--   with a note. "Definitely out" keeps them off later months' lists until
--   they book again.
-- * Booked = adverts on sales orders that aren't cancelled. Needs Magazines
--   view to see, Magazines or Sales edit to mark.

create table public.magazine_renewal_marks (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers (id) on delete cascade,
  month        date not null check (extract(day from month) = 1),
  status       text not null check (status in ('contacted', 'carried_forward', 'out')),
  note         text check (note is null or length(note) <= 2000),
  updated_at   timestamptz not null default now(),
  updated_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (customer_id, month)
);
create index magazine_renewal_marks_month_idx on public.magazine_renewal_marks (month);
alter table public.magazine_renewal_marks enable row level security;
create policy "View renewal marks" on public.magazine_renewal_marks for select to authenticated
  using ((select public.has_permission('magazines', 'view')));
create policy "Add renewal marks" on public.magazine_renewal_marks for insert to authenticated
  with check ((select public.has_permission('magazines', 'edit')) or (select public.has_permission('quotes', 'edit')));
create policy "Change renewal marks" on public.magazine_renewal_marks for update to authenticated
  using ((select public.has_permission('magazines', 'edit')) or (select public.has_permission('quotes', 'edit')))
  with check ((select public.has_permission('magazines', 'edit')) or (select public.has_permission('quotes', 'edit')));
create policy "Remove renewal marks" on public.magazine_renewal_marks for delete to authenticated
  using ((select public.has_permission('magazines', 'edit')) or (select public.has_permission('quotes', 'edit')));
create trigger magazine_renewal_marks_touch before update on public.magazine_renewal_marks
  for each row execute function public.touch_row();
create trigger audit_magazine_renewal_marks after insert or update or delete on public.magazine_renewal_marks
  for each row execute function public.audit_row();

create function public.magazine_renewals(p_month date)
returns table (
  customer_id uuid, customer_name text, owner_id uuid, owner_name text, last_month date, months_ago integer,
  has_future boolean, score integer, reason text, opportunity numeric, mark text, note text
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
begin
  if not public.has_permission('magazines', 'view') then
    raise exception 'Not allowed';
  end if;
  return query
  with booked as (
    -- Every customer's advert months on live sales orders.
    select d.customer_id, i.month, sum(l.line_net) net, max(d.owner_id::text)::uuid owner_id
      from public.sales_document_lines l
      join public.magazine_issues i on i.id = l.magazine_issue_id
      join public.sales_documents d on d.id = l.document_id
     where d.doc_type = 'sales_order' and d.status <> 'cancelled' and d.customer_id is not null
     group by d.customer_id, i.month
  ),
  last_before as (
    select distinct on (b.customer_id) b.customer_id, b.month, b.net, b.owner_id
      from booked b
     where b.month < v_month and b.month >= (v_month - interval '12 months')::date
     order by b.customer_id, b.month desc
  ),
  candidates as (
    select lb.*,
           ((extract(year from v_month) - extract(year from lb.month)) * 12
             + extract(month from v_month) - extract(month from lb.month))::integer gap,
           exists (select 1 from booked f where f.customer_id = lb.customer_id and f.month > v_month) future
      from last_before lb
     where not exists (select 1 from booked t where t.customer_id = lb.customer_id and t.month = v_month)
       -- "Definitely out" in an earlier month, and not booked since.
       and not exists (select 1 from public.magazine_renewal_marks m
                        where m.customer_id = lb.customer_id and m.status = 'out' and m.month < v_month
                          and not exists (select 1 from booked a where a.customer_id = lb.customer_id and a.month >= m.month))
  )
  select c.customer_id, cu.name, coalesce(cu.owner_id, c.owner_id), coalesce(p.full_name, p.email),
         c.month, c.gap, c.future,
         (case when c.gap = 1 then 20 when c.gap = 2 then 16 when c.gap = 3 then 12 when c.gap <= 6 then 8 else 4 end
           - case when c.future then 1 else 0 end)::integer,
         'Booked ' || case when c.gap = 1 then 'last month' else c.gap || ' months ago' end
           || ', not this month – ' || case when c.future then 'has future bookings' else 'no future bookings' end,
         c.net, m.status, m.note
    from candidates c
    join public.customers cu on cu.id = c.customer_id
    left join public.profiles p on p.id = coalesce(cu.owner_id, c.owner_id)
    left join public.magazine_renewal_marks m on m.customer_id = c.customer_id and m.month = v_month
   order by 8 desc, c.net desc, cu.name;
end;
$$;
revoke execute on function public.magazine_renewals(date) from public, anon;
grant execute on function public.magazine_renewals(date) to authenticated;
