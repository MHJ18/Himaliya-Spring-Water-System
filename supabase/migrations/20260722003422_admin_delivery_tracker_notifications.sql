begin;

create or replace function public.notify_admin_delivery_tracker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_name text;
  event_title text;
  event_detail text;
begin
  if tg_op = 'INSERT' and new.status = 'accepted' then
    event_title := 'Delivery added to tracker';
    event_detail := 'An automatically accepted order is ready in the delivery tracker.';
  elsif tg_op = 'UPDATE'
    and old.status is distinct from new.status
    and new.status = 'accepted' then
    event_title := 'Delivery added to tracker';
    event_detail := 'An accepted customer order is ready for rider assignment.';
  elsif tg_op = 'UPDATE'
    and old.tracking_status is distinct from new.tracking_status
    and new.tracking_status in ('assigned', 'picked_up', 'nearby') then
    event_title := case new.tracking_status
      when 'assigned' then 'Rider assigned'
      when 'picked_up' then 'Delivery is on the way'
      when 'nearby' then 'Rider is near the customer'
    end;
    event_detail := 'The delivery tracker has a new rider update.';
  else
    return new;
  end if;

  select name into customer_name
  from public.customers
  where owner_id = new.owner_id and id = new.customer_id
  limit 1;

  insert into public.customer_notifications (
    owner_id, audience, type, title, detail, order_id
  ) values (
    new.owner_id,
    'admin',
    'tracking',
    event_title,
    coalesce(customer_name, 'Customer') || ': ' || event_detail,
    new.id
  );

  return new;
end
$$;

revoke all on function public.notify_admin_delivery_tracker() from public, anon, authenticated;

drop trigger if exists customer_orders_notify_admin_tracker on public.customer_orders;
create trigger customer_orders_notify_admin_tracker
after insert or update on public.customer_orders
for each row execute function public.notify_admin_delivery_tracker();

commit;
