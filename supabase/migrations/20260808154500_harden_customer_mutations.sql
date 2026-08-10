begin;

-- Customer profile changes already go through claim_customer_account, which
-- allow-lists the editable fields and derives identity/ownership server-side.
-- Removing the broad table policy prevents a customer from PATCHing protected
-- columns such as bottles_held, owner_id, source, or account state directly.
drop policy if exists "Customers update active own canonical account"
  on public.customers;
drop policy if exists "Customers update own canonical account"
  on public.customers;
drop policy if exists "Customers create own canonical account"
  on public.customers;

-- Retain the staff policy unchanged. Authenticated customers create and edit
-- their canonical row only through claim_customer_account.

-- Some linked projects dropped the legacy scalar price columns after moving
-- to JSON lines. Re-add them as canonical order totals so every environment
-- enforces the same insert contract.
alter table public.customer_orders
  add column if not exists unit_price numeric(12, 2) not null default 0,
  add column if not exists total_amount numeric(12, 2) not null default 0;

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

drop policy if exists "Active customers create own orders"
  on public.customer_orders;
drop policy if exists "Customers create own orders"
  on public.customer_orders;

create or replace function public.create_customer_order(
  p_items jsonb,
  p_delivery_address text default null,
  p_delivery_date date default null,
  p_notes text default ''
)
returns public.customer_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_uid uuid := (select auth.uid());
  created_order public.customer_orders;
begin
  if request_uid is null or (select private.customer_account_is_active()) is not true then
    raise exception 'An active customer account is required to place an order';
  end if;
  if length(coalesce(p_notes, '')) > 1000 then
    raise exception 'Order notes cannot exceed 1000 characters';
  end if;
  if p_delivery_date is not null and p_delivery_date < current_date then
    raise exception 'Delivery date cannot be in the past';
  end if;

  insert into public.customer_orders (
    items,
    delivery_address,
    delivery_date,
    notes
  ) values (
    p_items,
    coalesce(btrim(p_delivery_address), ''),
    p_delivery_date,
    coalesce(p_notes, '')
  )
  returning * into created_order;

  return created_order;
end
$$;

revoke all on function public.create_customer_order(jsonb, text, date, text)
  from public, anon, authenticated;
grant execute on function public.create_customer_order(jsonb, text, date, text)
  to authenticated;

-- The former UPDATE policy checked only the resulting status. A crafted REST
-- PATCH could therefore rewrite items, prices, addresses, tracking data, and
-- other order fields while leaving the status pending/canceled. Expose one
-- narrow cancellation operation instead.
drop policy if exists "Active customers cancel own pending orders"
  on public.customer_orders;
drop policy if exists "Customers cancel own pending orders"
  on public.customer_orders;

create or replace function public.cancel_customer_order(p_order_id uuid)
returns public.customer_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_uid uuid := (select auth.uid());
  canceled_order public.customer_orders;
begin
  if request_uid is null then
    raise exception 'Sign in is required to cancel an order';
  end if;

  update public.customer_orders order_row
  set status = 'canceled',
      updated_at = now()
  where order_row.id = p_order_id
    and order_row.auth_user_id = request_uid
    and order_row.status = 'pending'
    and (select private.customer_account_is_active())
    and private.workflow_boolean(order_row.owner_id, 'allowCustomerCancellation', true)
  returning order_row.* into canceled_order;

  if canceled_order.id is null then
    raise exception 'This order can no longer be canceled';
  end if;

  return canceled_order;
end
$$;

revoke all on function public.cancel_customer_order(uuid)
  from public, anon, authenticated;
grant execute on function public.cancel_customer_order(uuid)
  to authenticated;

drop policy if exists "Active customers mark own notifications"
  on public.customer_notifications;
drop policy if exists "Customers mark own notifications"
  on public.customer_notifications;

create or replace function public.mark_customer_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_uid uuid := (select auth.uid());
  marked_count integer := 0;
begin
  if request_uid is null or (select private.customer_account_is_active()) is not true then
    raise exception 'An active customer account is required to update notifications';
  end if;

  update public.customer_notifications notification
  set read = true
  where notification.auth_user_id = request_uid
    and notification.audience = 'customer'
    and notification.read = false;
  get diagnostics marked_count = row_count;
  return marked_count;
end
$$;

revoke all on function public.mark_customer_notifications_read()
  from public, anon, authenticated;
grant execute on function public.mark_customer_notifications_read()
  to authenticated;

notify pgrst, 'reload schema';

commit;
