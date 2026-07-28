begin;

-- Rider clients read a very small active set on startup and load recent history
-- only when the History tab is opened. These partial indexes mirror those
-- filters without adding write overhead to unrelated orders.
create index if not exists customer_orders_rider_active_route_idx
  on public.customer_orders (assigned_rider_id, assigned_at, created_at desc)
  where assigned_rider_id is not null
    and tracking_status in ('assigned', 'picked_up', 'en_route', 'nearby');

create index if not exists customer_orders_rider_delivery_history_idx
  on public.customer_orders (assigned_rider_id, delivered_at desc)
  where assigned_rider_id is not null
    and tracking_status = 'delivered';

-- Location writes are intentionally separate from delivery-status updates.
-- The compact timestamp response avoids returning the full order row for each
-- GPS point, and the server-side guard protects egress if an older app sends
-- stationary updates too frequently.
create or replace function public.update_rider_location(
  p_order_id uuid,
  p_rider_lat double precision,
  p_rider_lng double precision,
  p_rider_heading double precision default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  rider_uuid uuid := (select private.current_rider_profile_id());
  order_row public.customer_orders;
begin
  if rider_uuid is null then
    raise exception 'Active rider access required';
  end if;
  if p_rider_lat is null or p_rider_lat not between -90 and 90 then
    raise exception 'Invalid rider latitude';
  end if;
  if p_rider_lng is null or p_rider_lng not between -180 and 180 then
    raise exception 'Invalid rider longitude';
  end if;
  if p_rider_heading is not null and p_rider_heading not between 0 and 360 then
    raise exception 'Invalid rider heading';
  end if;

  select *
    into order_row
  from public.customer_orders
  where id = p_order_id
    and assigned_rider_id = rider_uuid
  for update;

  if order_row.id is null then
    raise exception 'This delivery is not assigned to you';
  end if;
  if order_row.tracking_status not in ('picked_up', 'en_route', 'nearby') then
    return order_row.location_updated_at;
  end if;

  if order_row.location_updated_at is not null
     and order_row.location_updated_at > now() - interval '20 seconds' then
    return order_row.location_updated_at;
  end if;

  if order_row.location_updated_at is not null
     and order_row.location_updated_at > now() - interval '2 minutes'
     and order_row.rider_lat is not null
     and order_row.rider_lng is not null
     and abs(order_row.rider_lat - p_rider_lat) < 0.00035
     and abs(order_row.rider_lng - p_rider_lng) < 0.00035 then
    return order_row.location_updated_at;
  end if;

  update public.customer_orders
  set rider_lat = p_rider_lat,
      rider_lng = p_rider_lng,
      rider_heading = p_rider_heading,
      location_updated_at = now()
  where id = order_row.id
  returning location_updated_at into order_row.location_updated_at;

  return order_row.location_updated_at;
end
$$;

revoke all on function public.update_rider_location(
  uuid, double precision, double precision, double precision
) from PUBLIC, anon;

grant execute on function public.update_rider_location(
  uuid, double precision, double precision, double precision
) to authenticated;

notify pgrst, 'reload schema';

commit;
