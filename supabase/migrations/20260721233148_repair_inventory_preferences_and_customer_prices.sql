begin;

-- Repair schema pieces that existed in the application but were missing from
-- the linked database.
alter table public.customers
  add column if not exists preferences jsonb not null default
    '{"theme":"dark","browserNotifications":true,"orderUpdates":true,"invoiceAlerts":true,"defaultBottleType":"Gallon","defaultQuantity":1}'::jsonb;

alter table public.customers
  drop constraint if exists customers_preferences_object_check;
alter table public.customers
  add constraint customers_preferences_object_check
  check (jsonb_typeof(preferences) = 'object');

create table if not exists public.inventory_stock (
  owner_id uuid not null default private.current_owner_id()
    references auth.users(id) on delete cascade,
  bottle_type text not null,
  quantity integer not null default 0 check (quantity >= 0),
  last_low_stock_alert_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (owner_id, bottle_type)
);

alter table public.inventory_stock enable row level security;
drop policy if exists "Owner inventory access" on public.inventory_stock;
create policy "Owner inventory access"
on public.inventory_stock
for all to authenticated
using (owner_id = (select private.current_owner_id()))
with check (owner_id = (select private.current_owner_id()));

revoke all on table public.inventory_stock from public, anon, authenticated;
grant select, insert, update, delete on table public.inventory_stock to authenticated;
grant all on table public.inventory_stock to service_role;

create table if not exists public.customer_bottle_prices (
  owner_id uuid not null default private.current_owner_id()
    references auth.users(id) on delete cascade,
  customer_id text not null,
  bottle_type text not null,
  price numeric(12,2) not null check (price >= 0),
  updated_at timestamptz not null default now(),
  primary key (owner_id, customer_id, bottle_type),
  foreign key (owner_id, customer_id)
    references public.customers (owner_id, id) on delete cascade
);

alter table public.customer_bottle_prices enable row level security;

drop policy if exists "Admins manage customer bottle prices" on public.customer_bottle_prices;
create policy "Admins manage customer bottle prices"
on public.customer_bottle_prices
for all to authenticated
using (owner_id = (select private.current_owner_id()))
with check (owner_id = (select private.current_owner_id()));

drop policy if exists "Customers read own bottle prices" on public.customer_bottle_prices;
create policy "Customers read own bottle prices"
on public.customer_bottle_prices
for select to authenticated
using (
  exists (
    select 1
    from public.customers customer
    where customer.owner_id = customer_bottle_prices.owner_id
      and customer.id = customer_bottle_prices.customer_id
      and customer.auth_user_id = (select auth.uid())
  )
);

revoke all on table public.customer_bottle_prices from public, anon, authenticated;
grant select, insert, update, delete on table public.customer_bottle_prices to authenticated;
grant all on table public.customer_bottle_prices to service_role;

-- Preserve the latest historical sale price only when an explicit customer
-- price has not already been configured.
insert into public.customer_bottle_prices (
  owner_id, customer_id, bottle_type, price, updated_at
)
select latest.owner_id, latest.customer_id, latest.bottle_type,
  latest.price_per_bottle, latest.created_at
from (
  select distinct on (sale.owner_id, sale.customer_id, sale.bottle_type)
    sale.owner_id,
    sale.customer_id,
    sale.bottle_type,
    sale.price_per_bottle,
    sale.created_at
  from public.sales sale
  where sale.price_per_bottle >= 0
  order by sale.owner_id, sale.customer_id, sale.bottle_type, sale.created_at desc
) latest
on conflict (owner_id, customer_id, bottle_type) do nothing;

create or replace function public.persist_customer_price_from_manual_sale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.customer_bottle_prices (
    owner_id, customer_id, bottle_type, price, updated_at
  ) values (
    new.owner_id, new.customer_id, new.bottle_type, new.price_per_bottle, now()
  )
  on conflict (owner_id, customer_id, bottle_type)
  do update set price = excluded.price, updated_at = now();
  return new;
end
$$;

revoke all on function public.persist_customer_price_from_manual_sale()
  from public, anon, authenticated;

drop trigger if exists sales_persist_customer_price on public.sales;
create trigger sales_persist_customer_price
after insert on public.sales
for each row execute function public.persist_customer_price_from_manual_sale();

create or replace function public.consume_inventory_for_sale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining integer;
  threshold_value integer;
  last_alert timestamptz;
begin
  insert into public.inventory_stock (owner_id, bottle_type, quantity, updated_at)
  values (new.owner_id, new.bottle_type, 0, now())
  on conflict (owner_id, bottle_type)
  do update set
    quantity = greatest(0, public.inventory_stock.quantity - new.quantity::integer),
    updated_at = now()
  returning quantity, last_low_stock_alert_at into remaining, last_alert;

  select coalesce(nullif(setting.payload ->> 'lowStockThreshold', '')::integer, 20)
  into threshold_value
  from public.app_settings setting
  where setting.owner_id = new.owner_id and setting.id = 'main';
  threshold_value := coalesce(threshold_value, 20);

  if remaining <= threshold_value
     and (last_alert is null or last_alert < now() - interval '12 hours') then
    insert into public.customer_notifications (owner_id, audience, type, title, detail)
    values (
      new.owner_id,
      'admin',
      'stock',
      'Low stock alert',
      concat(new.bottle_type, ' stock is down to ', remaining, ' units.')
    );
    update public.inventory_stock
    set last_low_stock_alert_at = now()
    where owner_id = new.owner_id and bottle_type = new.bottle_type;
  end if;
  return new;
end
$$;

revoke all on function public.consume_inventory_for_sale()
  from public, anon, authenticated;

drop trigger if exists consume_inventory_after_sale on public.sales;
create trigger consume_inventory_after_sale
after insert on public.sales
for each row execute function public.consume_inventory_for_sale();

-- A rider may collect empties from older deliveries, so collection is not
-- limited by the quantity on today's order. Full bottles remain capped by it.
alter table public.customer_orders
  drop constraint if exists customer_orders_bottles_collected_check;
alter table public.customer_orders
  add constraint customer_orders_bottles_collected_check
  check (bottles_collected >= 0);

create or replace function public.apply_delivered_bottle_handover()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_customer_delta integer := 0;
  new_customer_delta integer := 0;
  customer_delta integer;
  stock_delta integer;
  customer_name text;
begin
  if old.tracking_status = 'delivered' then
    old_customer_delta := old.bottles_dropped_off - old.bottles_collected;
  end if;
  if new.tracking_status = 'delivered' then
    new_customer_delta := new.bottles_dropped_off - new.bottles_collected;
  end if;

  customer_delta := new_customer_delta - old_customer_delta;
  stock_delta := -customer_delta;

  if customer_delta <> 0 then
    update public.customers
    set bottles_held = greatest(0, bottles_held + customer_delta),
        updated_at = now()
    where owner_id = new.owner_id and id = new.customer_id;

    insert into public.inventory_stock (
      owner_id, bottle_type, quantity, updated_at
    ) values (
      new.owner_id, new.bottle_type, greatest(0, stock_delta), now()
    )
    on conflict (owner_id, bottle_type)
    do update set
      quantity = greatest(0, public.inventory_stock.quantity + stock_delta),
      updated_at = now();
  end if;

  if old.tracking_status is distinct from 'delivered'
     and new.tracking_status = 'delivered' then
    select name into customer_name
    from public.customers
    where owner_id = new.owner_id and id = new.customer_id
    limit 1;

    insert into public.customer_notifications (
      owner_id, audience, type, title, detail, order_id
    ) values (
      new.owner_id,
      'admin',
      'delivery',
      'Delivery completed',
      concat(
        coalesce(nullif(new.rider_name, ''), 'A rider'),
        ' completed the delivery for ', coalesce(customer_name, 'a customer'),
        '. Full bottles: ', new.bottles_dropped_off,
        '; empty bottles collected: ', new.bottles_collected, '.'
      ),
      new.id
    );
  end if;
  return new;
end
$$;

revoke all on function public.apply_delivered_bottle_handover()
  from public, anon, authenticated;

create or replace function public.update_rider_delivery(
  p_order_id uuid,
  p_tracking_status text,
  p_bottles_collected integer default 0,
  p_bottles_dropped_off integer default 0,
  p_rider_lat double precision default null,
  p_rider_lng double precision default null,
  p_rider_heading double precision default null
)
returns public.customer_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  rider_uuid uuid := (select private.current_rider_profile_id());
  order_row public.customer_orders;
begin
  if rider_uuid is null then raise exception 'Active rider access required'; end if;
  if p_tracking_status not in ('assigned', 'picked_up', 'en_route', 'nearby', 'delivered') then
    raise exception 'Invalid delivery status';
  end if;

  select * into order_row
  from public.customer_orders
  where id = p_order_id and assigned_rider_id = rider_uuid
  for update;

  if order_row.id is null then raise exception 'This delivery is not assigned to you'; end if;
  if order_row.tracking_status = 'delivered' then raise exception 'Completed deliveries cannot be changed'; end if;
  if p_bottles_collected < 0 then
    raise exception 'Empty bottles taken back cannot be negative';
  end if;
  if p_bottles_dropped_off < 0 or p_bottles_dropped_off > order_row.quantity then
    raise exception 'Full bottles given must be between zero and the order quantity';
  end if;

  update public.customer_orders
  set tracking_status = p_tracking_status,
      bottles_collected = p_bottles_collected,
      bottles_dropped_off = p_bottles_dropped_off,
      rider_lat = p_rider_lat,
      rider_lng = p_rider_lng,
      rider_heading = p_rider_heading,
      updated_at = now()
  where id = order_row.id
  returning * into order_row;
  return order_row;
end
$$;

revoke all on function public.update_rider_delivery(
  uuid, text, integer, integer, double precision, double precision, double precision
) from public, anon;
grant execute on function public.update_rider_delivery(
  uuid, text, integer, integer, double precision, double precision, double precision
) to authenticated;

notify pgrst, 'reload schema';

commit;
