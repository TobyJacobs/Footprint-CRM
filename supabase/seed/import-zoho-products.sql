-- Import (or refresh) the product list from Zoho Books.
--
-- How it's used (see docs/runbooks/IMPORT-PRODUCTS.md): the product list is
-- read from Zoho Books in the browser and put in place of __PRODUCTS_JSON__
-- below, then the whole script is run in the Supabase SQL editor. The data
-- itself is never saved in this repository.
--
-- Safe to run again: products are matched on their Zoho ID and updated.
-- Products not from Zoho (the made-up demo ones) are marked "not for sale".
-- Each item: z = Zoho ID, n = name, s = product number (SKU), d = description,
-- u = unit, r = selling price, c = cost price, t = VAT %, sup = supplier,
-- a = active, ac = sales account code (from Zoho's chart of accounts).

-- Written as one statement on purpose: the Supabase SQL editor runs each
-- statement separately, so temporary tables don't survive between them.
with src as (
  select * from jsonb_to_recordset('__PRODUCTS_JSON__'::jsonb)
    as x(z text, n text, s text, d text, u text, r numeric, c numeric, t numeric, tn text, sup text, a boolean, ty text, ac text)
),
new_sup as (
  -- Suppliers that don't exist yet (matched ignoring capitals).
  insert into public.suppliers (name)
  select distinct on (lower(trim(sup))) trim(sup) from src
   where coalesce(trim(sup), '') <> ''
     and not exists (select 1 from public.suppliers s where lower(s.name) = lower(trim(src.sup)))
  returning id, name
),
up as (
  insert into public.products (name, description, sku, unit, sale_price, cost_price, supplier_id, tax_rate_id, sales_account_code, active, zoho_id)
  select trim(z.n), nullif(trim(z.d), ''), nullif(trim(z.s), ''), nullif(trim(z.u), ''), coalesce(z.r, 0), nullif(z.c, 0),
         coalesce((select ns.id from new_sup ns where lower(ns.name) = lower(trim(z.sup)) limit 1),
                  (select s.id from public.suppliers s where lower(s.name) = lower(trim(z.sup)) limit 1)),
         (select t.id from public.tax_rates t where t.rate = coalesce(z.t, 20) and t.active order by t.is_default desc, t.name limit 1),
         (select sa.code from public.sales_accounts sa where sa.code = z.ac),
         coalesce(z.a, true), z.z
    from src z
  on conflict (zoho_id) do update set
    name = excluded.name, description = excluded.description, sku = excluded.sku, unit = excluded.unit,
    sale_price = excluded.sale_price, cost_price = excluded.cost_price, supplier_id = excluded.supplier_id,
    tax_rate_id = excluded.tax_rate_id, sales_account_code = excluded.sales_account_code, active = excluded.active
  returning 1
)
select (select count(*) from up) as products_imported, (select count(*) from new_sup) as suppliers_added;

-- Made-up demo products (no Zoho ID, or a FAKE- one) are no longer offered.
update public.products set active = false where (zoho_id is null or zoho_id like 'FAKE-%') and active;
