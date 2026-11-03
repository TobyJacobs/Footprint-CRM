-- Magazine rate card (3 November 2026).
--
-- Plain-English summary:
-- * The Forget Me Not rate card: a price per advert, per month, for each
--   rate-card product (Full page, Half page… and the special positions such
--   as Front cover), for short bookings (under 6 months) and long ones (6
--   months or more), and for the 1st to 5th area (edition) booked; every area
--   after the fifth costs the same as the fifth. Prices are before VAT and
--   belong to a year (2026 now; 2027 when it's ready).
-- * Each advert size says which rate-card product it uses (half page portrait
--   and landscape are both "Half page"). Sizes without one (e.g. Three
--   quarter page) have no rate-card price and are priced by hand. Premium
--   positions (front cover, inside covers…) use their own products; the app
--   links them (lib/magazine-options).
-- * The prices themselves aren't in this file (the code is public): they're
--   loaded from the business's rate card and can be changed in Magazines →
--   Setup. Seeing them needs Magazines or Sales view; changing them needs
--   Magazines edit.

create table public.magazine_rate_products (
  key       text primary key check (key ~ '^[a-z0-9_]+$'),
  label     text not null,
  position  integer not null default 0
);

create table public.magazine_rates (
  year      integer not null check (year between 2020 and 2100),
  product   text not null references public.magazine_rate_products (key) on delete cascade,
  term      text not null check (term in ('short', 'long')),
  area      integer not null check (area between 1 and 5),
  price     numeric(10,2) not null check (price >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (year, product, term, area)
);

alter table public.advert_sizes add column rate_product text references public.magazine_rate_products (key) on delete set null;

insert into public.magazine_rate_products (key, label, position) values
  ('full', 'Full page', 1), ('two_thirds', 'Two thirds', 2), ('half', 'Half page', 3), ('third', 'Third', 4),
  ('quarter', 'Quarter', 5), ('sixth', 'Sixth', 6), ('eighth', 'Eighth', 7), ('small', 'Small ads', 8),
  ('page3', 'Page 3', 9), ('dps', 'Double page spread', 10), ('centre', 'Centre page', 11),
  ('front', 'Front cover', 12), ('inside', 'Inside front or inside back', 13), ('back', 'Back cover', 14);

update public.advert_sizes s set rate_product = m.product
  from (values
    ('Small Ad', 'small'), ('Eighth Page', 'eighth'), ('Sixth Page - Portrait', 'sixth'),
    ('Quarter Page - Portrait', 'quarter'), ('Quarter Page - Landscape', 'quarter'),
    ('Third Page - Landscape', 'third'), ('Half Page - Landscape', 'half'), ('Half Page - Portrait', 'half'),
    ('Two Third Page', 'two_thirds'), ('Full Page', 'full'), ('Double Page Spread', 'dps')
  ) as m(size_name, product)
 where s.name = m.size_name;

-- ─── Access ─────────────────────────────────────────────────────────────────

alter table public.magazine_rate_products enable row level security;
alter table public.magazine_rates enable row level security;
do $$
declare t text;
begin
  foreach t in array array['magazine_rate_products', 'magazine_rates'] loop
    execute format('create policy "See the rate card" on public.%I for select to authenticated using ((select public.has_permission(''magazines'', ''view'')) or (select public.has_permission(''quotes'', ''view'')))', t);
    execute format('create policy "Change the rate card" on public.%I for all to authenticated using ((select public.has_permission(''magazines'', ''edit''))) with check ((select public.has_permission(''magazines'', ''edit'')))', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', 'audit_' || t, t);
  end loop;
end $$;
create trigger magazine_rates_touch before update on public.magazine_rates
  for each row execute function public.touch_row();

create index magazine_rates_product_idx on public.magazine_rates (product);
