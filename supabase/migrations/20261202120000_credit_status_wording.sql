-- Credit status wording (DJ, 11 November 2026; owner chose how to switch
-- existing customers over). "N Day Terms Available to Client" → "Net N";
-- both pay-first options → "Upfront payment"; the Direct Debit option is
-- cleared, as Direct Debit has its own field.
update public.customers set credit_status = case credit_status
    when '7 Day Terms Available to Client' then 'Net 7'
    when '14 Day Terms Available to Client' then 'Net 14'
    when '30 Day Terms Available to Client' then 'Net 30'
    when '60 Day Terms Available to Client' then 'Net 60'
    when 'Payment Required before we order goods' then 'Upfront payment'
    when 'No Credit Available - Must Pay Up Front - Before Goods Ordered' then 'Upfront payment'
    when 'Direct Debit Service Available to Client' then null
  end
where credit_status in (
  '7 Day Terms Available to Client', '14 Day Terms Available to Client',
  '30 Day Terms Available to Client', '60 Day Terms Available to Client',
  'Payment Required before we order goods',
  'No Credit Available - Must Pay Up Front - Before Goods Ordered',
  'Direct Debit Service Available to Client'
);
