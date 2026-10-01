-- MADE-UP products for the TEST database only. Never run on live.
-- Safe to re-run: removes previous fake rows first (zoho_id starts 'FAKE-').
begin;

delete from public.products where zoho_id like 'FAKE-%';

insert into public.products (zoho_id, name, description, unit, sale_price, cost_price, supplier_id, tax_rate_id, business_unit)
select v.zoho_id, v.name, v.description, v.unit, v.sale_price, v.cost_price,
       (select id from public.suppliers where name = v.supplier),
       (select id from public.tax_rates where name = v.vat),
       v.bu
from (values
  ('FAKE-I1',  'A5 leaflets (500)',          '130gsm silk, full colour both sides',          'pack', 89.00,  32.00, 'Digiprint',               'VAT 20%',    'Print'),
  ('FAKE-I2',  'A5 leaflets (1000)',         '130gsm silk, full colour both sides',          'pack', 119.00, 45.00, 'Digiprint',               'VAT 20%',    'Print'),
  ('FAKE-I3',  'Business cards (250)',       '400gsm matt laminated, double sided',          'pack', 45.00,  12.50, 'Footprint',               'VAT 20%',    'Print'),
  ('FAKE-I4',  'Pull-up banner',             '850 x 2000mm, with carry case',                'each', 95.00,  38.00, 'Colour Graphics',         'VAT 20%',    'Print'),
  ('FAKE-I5',  'Window vinyl (per sqm)',     'Printed self-adhesive vinyl, fitted',          'sqm',  65.00,  22.00, 'Footprint',               'VAT 20%',    'Print'),
  ('FAKE-I6',  'Van livery – small van',     'Design, print and fit, part wrap',             'each', 850.00, 340.00,'Footprint',               'VAT 20%',    'Print'),
  ('FAKE-I7',  'Design time',                'Graphic design, per hour',                     'hour', 55.00,  20.00, 'Footprint Design Service','VAT 20%',    'Print'),
  ('FAKE-I8',  'Embroidered polo shirt',     'Left-chest logo embroidery',                   'each', 18.50,  9.20,  'Pencarrie',               'VAT 20%',    'Print'),
  ('FAKE-I9',  'Café menu boards (set)',     'A4 menu holders, set of 10',                   'set',  120.00, 70.00, 'Cafe Menu Systems',       'VAT 20%',    'Print'),
  ('FAKE-I10', 'Social media management',    'Monthly content and scheduling',               'month',450.00, 180.00,'Footprint',               'VAT 20%',    'Digital'),
  ('FAKE-I11', 'Google Ads management',      'Monthly campaign management (excl. ad spend)', 'month',250.00, 90.00, 'Footprint',               'VAT 20%',    'Digital'),
  ('FAKE-I12', 'Printed books (children''s)','Zero-rated printed books',                     'each', 6.50,   2.80,  'Digiprint',               'Zero rated', 'Print')
) as v(zoho_id, name, description, unit, sale_price, cost_price, supplier, vat, bu);

commit;
