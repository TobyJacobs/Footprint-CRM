# Importing the product list from Zoho Books

_First done on 5 October 2026 (135 products). Repeat at go-live so prices are current._

The product list is business data, not personal data. It is still **never saved in this repository**: it goes straight from Zoho Books to the database.

1. Sign in to Zoho Books (business.footprintsouth.co.uk) in Chrome.
2. On any Zoho Books page, read every item (active and inactive) through Zoho Books' own `/api/v3/items` list, using the signed-in session.
3. Turn each item into `{ z: item_id, n: name, s: sku, d: description, u: unit, r: rate, c: purchase_rate, t: tax_percentage, sup: cf_suppliers or vendor_name, a: active }`.
4. Put that list (as JSON, with `'` doubled) in place of `__PRODUCTS_JSON__` in `supabase/seed/import-zoho-products.sql`.
5. Run the result in the Supabase SQL editor of the right project (test, or live at go-live).
6. Check:
   - Quotes & Invoices → Products shows the products with their product numbers.
   - Choosing one on a quote puts the product number in the description.

It's safe to run again: products are matched on their Zoho ID and updated, and new suppliers are added.
