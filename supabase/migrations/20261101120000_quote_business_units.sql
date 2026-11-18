-- Quote business units (20 October 2026).
--
-- Plain-English summary:
-- * Quotes now use Footprint's own business units: Print/Merch, Advertising,
--   Footprint AI and Signage (the owner's choice). Orders, invoices, recurring
--   invoices and products keep Zoho's list (Print, Account Sales, Digital).
-- * Existing quotes marked "Print" become "Print/Merch". Other old values
--   (Account Sales, Digital) are left as they are.
-- * Business unit is free text in the database, so nothing else changes.
--   NOTE for the Go-live Zoho import: map quote "Print" to "Print/Merch" there too.

update public.sales_documents
   set business_unit = 'Print/Merch'
 where doc_type = 'quote'
   and business_unit = 'Print';
