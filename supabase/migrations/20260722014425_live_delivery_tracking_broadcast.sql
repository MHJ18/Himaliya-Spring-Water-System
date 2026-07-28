-- Broadcast only non-sensitive route fields to the bearer-token tracking channel.
-- The public tracking RPC remains the source of truth and enforces token access.
create or replace function public.broadcast_delivery_tracking_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tracking_token is not null and (
    old.tracking_status is distinct from new.tracking_status
    or old.rider_lat is distinct from new.rider_lat
    or old.rider_lng is distinct from new.rider_lng
    or old.rider_heading is distinct from new.rider_heading
    or old.location_updated_at is distinct from new.location_updated_at
    or old.delivered_at is distinct from new.delivered_at
  ) then
    perform realtime.send(
      jsonb_build_object(
        'orderId', new.id,
        'trackingStatus', new.tracking_status,
        'riderLat', new.rider_lat,
        'riderLng', new.rider_lng,
        'riderHeading', new.rider_heading,
        'locationUpdatedAt', new.location_updated_at,
        'deliveredAt', new.delivered_at
      ),
      'tracking_update',
      'delivery:' || new.tracking_token::text,
      false
    );
  end if;
  return new;
end;
$$;

drop trigger if exists broadcast_delivery_tracking_update on public.customer_orders;
create trigger broadcast_delivery_tracking_update
after update of tracking_status, rider_lat, rider_lng, rider_heading, location_updated_at, delivered_at
on public.customer_orders
for each row
execute function public.broadcast_delivery_tracking_update();

revoke all on function public.broadcast_delivery_tracking_update() from public, anon, authenticated;
