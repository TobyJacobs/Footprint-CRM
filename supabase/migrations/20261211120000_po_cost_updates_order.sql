-- What we bought it for flows into the sales order's GP (owner, 11 November
-- 2026).
--
-- Plain-English summary:
-- * When a purchase order line gets a "bought for" figure, the matching line on
--   its sales order (same product, or the same name when there's no product)
--   takes that as its cost, so the order's gross profit shows the real profit.
-- * If the item came from more than one supplier (e.g. after a shortfall), the
--   cost is the average of what was actually paid per item.
-- * The original estimate is kept in `estimated_unit_cost`, so it can still be
--   shown. Clearing the bought-for figures puts the estimate back.
-- * Lines with a GP override are left alone (the override decides their cost).
--   Cancelled purchase orders don't count.

alter table public.sales_document_lines
  add column estimated_unit_cost numeric(12,2);

create function public._sync_order_line_costs(p_order uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  l record;
  paid numeric;
  qty numeric;
  key_of text;
begin
  if p_order is null then
    return;
  end if;
  for l in
    select id, product_id, description, unit_cost, estimated_unit_cost
      from public.sales_document_lines
     where document_id = p_order and gp_override is null
  loop
    key_of := lower(trim(split_part(l.description, E'\n', 1)));
    select sum(pl.actual_line_net), sum(coalesce(pl.bought_quantity, pl.quantity))
      into paid, qty
      from public.purchase_order_lines pl
      join public.purchase_orders po on po.id = pl.purchase_order_id
     where po.sales_document_id = p_order
       and po.status <> 'cancelled'
       and pl.actual_unit_cost is not null
       and (case when l.product_id is not null then pl.product_id = l.product_id
                 else pl.product_id is null and lower(trim(split_part(pl.description, E'\n', 1))) = key_of end);
    if qty is not null and qty > 0 then
      update public.sales_document_lines
         set estimated_unit_cost = coalesce(estimated_unit_cost, unit_cost),
             unit_cost = round(paid / qty, 2)
       where id = l.id
         and unit_cost is distinct from round(paid / qty, 2);
    elsif l.estimated_unit_cost is not null then
      -- No bought-for figures any more: back to the estimate.
      update public.sales_document_lines
         set unit_cost = estimated_unit_cost, estimated_unit_cost = null
       where id = l.id;
    end if;
  end loop;
end;
$$;
revoke execute on function public._sync_order_line_costs(uuid) from public, anon, authenticated;

create function public._po_lines_sync_order()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._sync_order_line_costs(
    (select po.sales_document_id from public.purchase_orders po
      where po.id = coalesce(new.purchase_order_id, old.purchase_order_id)));
  return null;
end;
$$;
revoke execute on function public._po_lines_sync_order() from public, anon, authenticated;
create trigger purchase_order_lines_sync_order
  after insert or delete or update of actual_unit_cost, bought_quantity, quantity, product_id, description
  on public.purchase_order_lines
  for each row execute function public._po_lines_sync_order();

create function public._po_sync_order()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._sync_order_line_costs(new.sales_document_id);
  if old.sales_document_id is distinct from new.sales_document_id then
    perform public._sync_order_line_costs(old.sales_document_id);
  end if;
  return null;
end;
$$;
revoke execute on function public._po_sync_order() from public, anon, authenticated;
create trigger purchase_orders_sync_order
  after update of status, sales_document_id on public.purchase_orders
  for each row execute function public._po_sync_order();
