-- Clarify single-rider delivery notifications for Ready / Picked up / Delivered.

begin;

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
        when 'assigned' then 'Your order is ready'
        when 'picked_up' then 'Your order has been picked up'
        when 'en_route' then 'Your rider is on the way'
        when 'nearby' then 'Your rider is nearby'
        else 'Delivery tracking updated'
      end,
      case new.tracking_status
        when 'assigned' then 'Your water is packed and ready for delivery to your saved address.'
        when 'picked_up' then 'The rider has your order and is heading to the address on your profile.'
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

revoke all on function public.notify_delivery_tracking_update()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
