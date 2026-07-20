-- Rider dispatch tracking for customer delivery orders.
-- The order table remains protected by RLS. Public tracking is available only
-- through a narrowly scoped bearer-token function.

begin;

alter table public.customer_orders
  add column if not exists tracking_token uuid not null default gen_random_uuid(),
  add column if not exists rider_name text not null default '',
  add column if not exists rider_phone text not null default '',
  add column if not exists rider_lat double precision,
  add column if not exists rider_lng double precision,
  add column if not exists rider_heading double precision,
  add column if not exists tracking_status text not null default 'unassigned',
  add column if not exists location_updated_at timestamptz;

alter table public.customer_orders
  drop constraint if exists customer_orders_tracking_status_check;

alter table public.customer_orders
  add constraint customer_orders_tracking_status_check
  check (tracking_status in (
    'unassigned',
    'assigned',
    'picked_up',
    'en_route',
    'nearby',
    'delivered'
  ));

alter table public.customer_orders
  drop constraint if exists customer_orders_rider_lat_check,
  drop constraint if exists customer_orders_rider_lng_check,
  drop constraint if exists customer_orders_rider_heading_check;

alter table public.customer_orders
  add constraint customer_orders_rider_lat_check
    check (rider_lat is null or rider_lat between -90 and 90),
  add constraint customer_orders_rider_lng_check
    check (rider_lng is null or rider_lng between -180 and 180),
  add constraint customer_orders_rider_heading_check
    check (rider_heading is null or rider_heading between 0 and 360);

create unique index if not exists customer_orders_tracking_token_key
  on public.customer_orders (tracking_token);

create index if not exists customer_orders_owner_tracking_status_idx
  on public.customer_orders (owner_id, tracking_status, location_updated_at desc);

create or replace function public.prepare_delivery_tracking_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.rider_lat is distinct from old.rider_lat
     or new.rider_lng is distinct from old.rider_lng
     or new.rider_heading is distinct from old.rider_heading then
    new.location_updated_at := now();
  end if;

  if new.tracking_status is distinct from old.tracking_status then
    if new.tracking_status <> 'unassigned'
       and new.status = 'pending' then
      new.status := 'accepted';
      new.accepted_at := coalesce(new.accepted_at, now());
    end if;

    if new.tracking_status = 'delivered' then
      new.status := 'delivered';
      new.delivered_at := coalesce(new.delivered_at, now());
    end if;
  end if;

  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists customer_orders_prepare_tracking_update
  on public.customer_orders;
create trigger customer_orders_prepare_tracking_update
before update of tracking_status, rider_name, rider_phone, rider_lat, rider_lng, rider_heading
on public.customer_orders
for each row execute function public.prepare_delivery_tracking_update();

revoke all on function public.prepare_delivery_tracking_update()
  from public, anon, authenticated;

create or replace function public.notify_delivery_tracking_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.tracking_status is distinct from new.tracking_status
     and new.tracking_status in ('assigned', 'picked_up', 'en_route', 'nearby') then
    insert into public.customer_notifications (
      owner_id,
      auth_user_id,
      audience,
      type,
      title,
      detail,
      order_id
    ) values (
      new.owner_id,
      new.auth_user_id,
      'customer',
      'tracking',
      case new.tracking_status
        when 'assigned' then 'A rider has been assigned'
        when 'picked_up' then 'Your order is ready to leave'
        when 'en_route' then 'Your rider is on the way'
        when 'nearby' then 'Your rider is nearby'
        else 'Delivery tracking updated'
      end,
      case new.tracking_status
        when 'assigned' then concat(
          coalesce(nullif(new.rider_name, ''), 'Your delivery rider'),
          ' is preparing your order.'
        )
        when 'picked_up' then 'Your water order has been picked up for delivery.'
        when 'en_route' then 'Follow the live rider location from your tracking link.'
        when 'nearby' then 'Please keep empty gallons ready for collection.'
        else 'Your delivery progress has changed.'
      end,
      new.id
    );
  end if;
  return new;
end
$$;

drop trigger if exists customer_orders_notify_tracking_update
  on public.customer_orders;
create trigger customer_orders_notify_tracking_update
after update of tracking_status on public.customer_orders
for each row execute function public.notify_delivery_tracking_update();

revoke all on function public.notify_delivery_tracking_update()
  from public, anon, authenticated;

create or replace function public.get_delivery_tracking(p_tracking_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'order_id', delivery.id,
    'tracking_token', delivery.tracking_token,
    'customer_name', split_part(trim(customer.name), ' ', 1),
    'quantity', delivery.quantity,
    'bottle_type', delivery.bottle_type,
    'delivery_address', delivery.delivery_address,
    'delivery_date', delivery.delivery_date,
    'order_status', delivery.status,
    'tracking_status', delivery.tracking_status,
    'rider_name', nullif(delivery.rider_name, ''),
    'rider_phone', nullif(delivery.rider_phone, ''),
    'rider_lat', delivery.rider_lat,
    'rider_lng', delivery.rider_lng,
    'rider_heading', delivery.rider_heading,
    'location_updated_at', delivery.location_updated_at,
    'accepted_at', delivery.accepted_at,
    'delivered_at', delivery.delivered_at,
    'created_at', delivery.created_at
  )
  from public.customer_orders as delivery
  join public.customers as customer
    on customer.owner_id = delivery.owner_id
   and customer.id = delivery.customer_id
  where delivery.tracking_token = p_tracking_token
    and delivery.status not in ('canceled', 'rejected')
  limit 1
$$;

revoke all on function public.get_delivery_tracking(uuid) from public;
grant execute on function public.get_delivery_tracking(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

commit;

select
  count(*) as orders_with_tracking_tokens,
  count(*) filter (where tracking_status <> 'unassigned') as active_tracking_orders
from public.customer_orders;
