begin;

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
    'items', delivery.items,
    'delivered_items', delivery.delivered_items,
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
