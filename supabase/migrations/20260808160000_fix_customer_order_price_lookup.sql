begin;

-- prepare_customer_order() (20260808154500_harden_customer_mutations.sql) stopped
-- trusting the client-submitted unitPrice and instead looks up the price
-- server-side. It only checked public.bottle_prices (the owner-wide default
-- catalog), but the customer portal actually prices and displays bottle types
-- from public.customer_bottle_prices (per-customer overrides, via
-- get_customer_bottle_prices / getOwnCustomerBottlePrices). Any bottle type
-- priced only per-customer -- Gallon being the reported case -- showed up as
-- orderable in the dashboard but was then rejected server-side with
-- "Bottle type ... is unavailable or has no configured price" because no
-- matching row existed in bottle_prices. Check the customer-specific price
-- first, and fall back to the owner-wide default so both pricing paths work.
create or replace function public.prepare_customer_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_row public.customers;
  auto_accept boolean;
  item jsonb;
  normalized_items jsonb := '[]'::jsonb;
  item_type text;
  item_quantity_text text;
  item_quantity integer;
  canonical_type text;
  canonical_price numeric;
  first_type text := '';
  first_price numeric := 0;
  total_quantity integer := 0;
  order_total numeric := 0;
begin
  select * into customer_row
  from public.customers
  where auth_user_id = (select auth.uid()) and active = true
  limit 1;

  if customer_row.id is null then
    raise exception 'Customer account not found for this user';
  end if;

  if jsonb_typeof(new.items) is distinct from 'array'
    or jsonb_array_length(new.items) = 0
    or jsonb_array_length(new.items) > 20 then
    raise exception 'Choose between 1 and 20 bottle items';
  end if;

  for item in select value from jsonb_array_elements(new.items)
  loop
    item_type := btrim(coalesce(item ->> 'bottleType', item ->> 'bottle_type', ''));
    item_quantity_text := btrim(coalesce(item ->> 'quantity', ''));
    if item_type = '' or item_quantity_text !~ '^[0-9]+$' then
      raise exception 'Every order item needs a valid bottle type and whole-number quantity';
    end if;

    item_quantity := item_quantity_text::integer;
    if item_quantity < 1 or item_quantity > 500 then
      raise exception 'Every order item quantity must be between 1 and 500';
    end if;

    canonical_type := null;
    canonical_price := null;

    select cbp.bottle_type, cbp.price
    into canonical_type, canonical_price
    from public.customer_bottle_prices cbp
    where cbp.owner_id = customer_row.owner_id
      and cbp.customer_id = customer_row.id
      and (
        lower(btrim(cbp.bottle_type)) = lower(item_type)
        or (
          lower(item_type) in ('gallon', '19l gallon')
          and lower(btrim(cbp.bottle_type)) in ('gallon', '19l gallon')
        )
      )
    order by
      case when lower(btrim(cbp.bottle_type)) = lower(item_type) then 0 else 1 end,
      cbp.updated_at desc nulls last
    limit 1;

    if canonical_type is null then
      select prices.bottle_type, prices.price
      into canonical_type, canonical_price
      from public.bottle_prices prices
      where prices.owner_id = customer_row.owner_id
        and (
          lower(btrim(prices.bottle_type)) = lower(item_type)
          or (
            lower(item_type) in ('gallon', '19l gallon')
            and lower(btrim(prices.bottle_type)) in ('gallon', '19l gallon')
          )
        )
      order by
        case when lower(btrim(prices.bottle_type)) = lower(item_type) then 0 else 1 end,
        prices.updated_at desc nulls last
      limit 1;
    end if;

    if canonical_type is null or canonical_price is null or canonical_price <= 0 then
      raise exception 'Bottle type % is unavailable or has no configured price', item_type;
    end if;

    total_quantity := total_quantity + item_quantity;
    if total_quantity > 500 then
      raise exception 'An order cannot contain more than 500 bottles in total';
    end if;

    canonical_price := round(canonical_price, 2);
    if first_type = '' then
      first_type := canonical_type;
      first_price := canonical_price;
    end if;
    order_total := order_total + (canonical_price * item_quantity);
    normalized_items := normalized_items || jsonb_build_array(jsonb_build_object(
      'bottleType', canonical_type,
      'quantity', item_quantity,
      'unitPrice', canonical_price,
      'totalAmount', round(canonical_price * item_quantity, 2)
    ));
  end loop;

  -- Overwrite every identity, pricing, assignment, tracking, delivery-state,
  -- and timestamp field that is not part of the customer request contract.
  new.id := gen_random_uuid();
  new.owner_id := customer_row.owner_id;
  new.auth_user_id := customer_row.auth_user_id;
  new.customer_id := customer_row.id;
  new.items := normalized_items;
  new.bottle_type := first_type;
  new.quantity := total_quantity;
  new.unit_price := case
    when jsonb_array_length(normalized_items) = 1 then first_price
    else 0
  end;
  new.total_amount := round(order_total, 2);
  new.admin_note := '';
  new.assigned_rider_id := null;
  new.assigned_at := null;
  new.rider_name := '';
  new.rider_phone := '';
  new.rider_lat := null;
  new.rider_lng := null;
  new.rider_heading := null;
  new.location_updated_at := null;
  new.tracking_token := gen_random_uuid();
  new.tracking_status := 'unassigned';
  new.bottles_collected := 0;
  new.bottles_dropped_off := 0;
  new.delivered_items := '[]'::jsonb;
  new.delivered_at := null;
  new.created_at := now();
  new.updated_at := now();

  if coalesce(btrim(new.delivery_address), '') = '' then
    new.delivery_address := customer_row.address;
  end if;

  auto_accept := private.workflow_boolean(customer_row.owner_id, 'autoAcceptOrders', false);
  if auto_accept then
    new.status := 'accepted';
    new.accepted_at := now();
  else
    new.status := 'pending';
    new.accepted_at := null;
  end if;
  return new;
end
$$;

revoke all on function public.prepare_customer_order()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
