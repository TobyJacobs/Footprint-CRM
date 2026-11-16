-- Sales commission (Jack Burton's rules, 16 November 2026).
--
-- Plain-English summary:
-- * Each salesperson can have one or more monthly targets: what counts
--   (revenue = sales before VAT, or gross profit), which business areas (none
--   = all), whether it's their own sales or the whole group's, the target in
--   pounds, and bands: reach X% of the target and get Y% of the figure, or a
--   fixed £ bonus. The highest band reached applies, on all of the figure.
-- * Sales count when invoiced (issued or paid invoices in the month; credit
--   notes take away). A person's sales are the documents they own, so they
--   need to have signed in to FootprintOS once.
-- * Only people with the Directors role and named commission viewers (Jack
--   Burton) can see or change any of it. The figures themselves are loaded
--   into the database, not kept in the code (the code is public).

-- ─── Who can see commission ─────────────────────────────────────────────────

create table public.commission_viewers (
  profile_id  uuid primary key references public.profiles (id) on delete cascade,
  added_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  added_at    timestamptz not null default now()
);
create index commission_viewers_added_by_idx on public.commission_viewers (added_by);

create function public.can_see_commission()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_director() or exists (
    select 1 from public.commission_viewers v
      join public.profiles p on p.id = v.profile_id
     where v.profile_id = auth.uid() and p.is_active);
$$;
revoke execute on function public.can_see_commission() from public, anon;
grant execute on function public.can_see_commission() to authenticated;

alter table public.commission_viewers enable row level security;
create policy "Commission viewers see the list" on public.commission_viewers for select to authenticated
  using ((select public.can_see_commission()));
create policy "Directors manage commission viewers" on public.commission_viewers for all to authenticated
  using ((select public.is_director())) with check ((select public.is_director()));
grant select, insert, delete on public.commission_viewers to authenticated;
revoke all on public.commission_viewers from anon;

-- ─── Targets and bands ──────────────────────────────────────────────────────

create table public.commission_targets (
  id              uuid primary key default gen_random_uuid(),
  staff_id        uuid not null references public.staff_directory (id) on delete cascade,
  label           text not null check (length(trim(label)) between 1 and 120),
  measure         text not null check (measure in ('revenue', 'gp')),
  scope           text not null default 'own' check (scope in ('own', 'group')),
  business_units  text[] not null default '{}',
  target          numeric(12,2) not null check (target > 0),
  payout          text not null check (payout in ('percent', 'fixed')),
  position        integer not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid
);
create index commission_targets_staff_idx on public.commission_targets (staff_id, position);

create table public.commission_bands (
  id         uuid primary key default gen_random_uuid(),
  target_id  uuid not null references public.commission_targets (id) on delete cascade,
  threshold  numeric(6,2) not null check (threshold > 0 and threshold <= 1000),  -- % of the target reached
  amount     numeric(12,2) not null check (amount >= 0),                         -- % of the figure, or £ fixed
  unique (target_id, threshold)
);
create index commission_bands_target_idx on public.commission_bands (target_id, threshold);

alter table public.commission_targets enable row level security;
alter table public.commission_bands enable row level security;
create policy "Commission viewers see targets" on public.commission_targets for select to authenticated using ((select public.can_see_commission()));
create policy "Commission viewers change targets" on public.commission_targets for all to authenticated
  using ((select public.can_see_commission())) with check ((select public.can_see_commission()));
create policy "Commission viewers see bands" on public.commission_bands for select to authenticated using ((select public.can_see_commission()));
create policy "Commission viewers change bands" on public.commission_bands for all to authenticated
  using ((select public.can_see_commission())) with check ((select public.can_see_commission()));
grant select, insert, update, delete on public.commission_targets, public.commission_bands to authenticated;
revoke all on public.commission_targets, public.commission_bands from anon;

create trigger commission_targets_touch before update on public.commission_targets for each row execute function public.touch_row();
create trigger audit_commission_targets after insert or update or delete on public.commission_targets for each row execute function public.audit_row();
create trigger audit_commission_bands after insert or update or delete on public.commission_bands for each row execute function public.audit_row();
create trigger audit_commission_viewers after insert or update or delete on public.commission_viewers for each row execute function public.audit_row();

-- ─── The monthly report ─────────────────────────────────────────────────────

-- Each active target for a month: the figure, % of target, band reached,
-- commission, and how far to the next band. Commission viewers only.
create function public.commission_report(p_month date)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_from date := date_trunc('month', p_month)::date;
  v_to date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
begin
  if not public.can_see_commission() then
    raise exception 'Not allowed';
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(r)::jsonb order by r.person, r.position, r.label)
      from (
        select t.id, t.label, t.measure, t.scope, t.business_units, t.target, t.payout, t.position,
               s.display_name as person, s.profile_id is not null as has_login,
               x.actual,
               round(x.actual / t.target * 100, 1) as reached,
               b.threshold as band, b.amount as band_amount,
               case when b.threshold is null then 0
                    when t.payout = 'percent' then round(greatest(x.actual, 0) * b.amount / 100, 2)
                    else b.amount end as commission,
               nb.threshold as next_band,
               case when nb.threshold is null then null else round(t.target * nb.threshold / 100 - x.actual, 2) end as to_next
          from public.commission_targets t
          join public.staff_directory s on s.id = t.staff_id
          cross join lateral (
            select coalesce(sum(case when d.doc_type = 'credit_note' then -1 else 1 end
                                * case when t.measure = 'revenue' then d.subtotal else d.subtotal - d.cost_total end), 0) as actual
              from public.sales_documents d
             where d.doc_type in ('invoice', 'credit_note')
               and d.status in ('issued', 'paid')
               and d.issue_date between v_from and v_to
               and (t.scope = 'group' or (s.profile_id is not null and d.owner_id = s.profile_id))
               and (cardinality(t.business_units) = 0 or d.business_unit = any (t.business_units))
          ) x
          left join lateral (
            select cb.threshold, cb.amount from public.commission_bands cb
             where cb.target_id = t.id and cb.threshold <= x.actual / t.target * 100
             order by cb.threshold desc limit 1
          ) b on true
          left join lateral (
            select cb.threshold from public.commission_bands cb
             where cb.target_id = t.id and cb.threshold > x.actual / t.target * 100
             order by cb.threshold limit 1
          ) nb on true
         where t.active
      ) r), '[]'::jsonb);
end;
$$;
revoke execute on function public.commission_report(date) from public, anon;
grant execute on function public.commission_report(date) to authenticated;
