begin;

alter table public.customer_orders
  drop constraint if exists customer_orders_payment_type_check,
  drop constraint if exists customer_orders_rider_fee_check,
  drop column if exists payment_type,
  drop column if exists rider_fee,
  add column if not exists items jsonb not null default '[]'::jsonb;

update public.customer_orders
set items = jsonb_build_array(jsonb_build_object(
  'bottleType', bottle_type,
  'quantity', greatest(1, quantity)
))
where jsonb_typeof(items) is distinct from 'array'
   or jsonb_array_length(items) = 0;

alter table public.customer_orders
  drop constraint if exists customer_orders_items_check,
  add constraint customer_orders_items_check check (
    jsonb_typeof(items) = 'array'
    and jsonb_array_length(items) > 0
  );

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
  total_quantity integer := 0;
  first_type text := '';
  item_type text;
  item_quantity integer;
begin
  select * into customer_row
  from public.customers
  where auth_user_id = (select auth.uid()) and active = true
  limit 1;

  if customer_row.id is null then
    raise exception 'Customer account not found for this user';
  end if;

  if jsonb_typeof(new.items) is distinct from 'array' or jsonb_array_length(new.items) = 0 then
    new.items := jsonb_build_array(jsonb_build_object(
      'bottleType', new.bottle_type,
      'quantity', greatest(1, new.quantity)
    ));
  end if;

  for item in select value from jsonb_array_elements(new.items)
  loop
    item_type := trim(coalesce(item ->> 'bottleType', ''));
    item_quantity := coalesce((item ->> 'quantity')::integer, 0);
    if item_type = '' or item_quantity < 1 or item_quantity > 500 then
      raise exception 'Every order item needs a bottle type and quantity between 1 and 500';
    end if;
    if first_type = '' then first_type := item_type; end if;
    total_quantity := total_quantity + item_quantity;
    normalized_items := normalized_items || jsonb_build_array(jsonb_build_object(
      'bottleType', item_type,
      'quantity', item_quantity,
      'unitPrice', greatest(0, coalesce((item ->> 'unitPrice')::numeric, 0))
    ));
  end loop;

  new.items := normalized_items;
  new.bottle_type := first_type;
  new.quantity := total_quantity;
  new.owner_id := customer_row.owner_id;
  new.auth_user_id := customer_row.auth_user_id;
  new.customer_id := customer_row.id;
  new.updated_at := now();
  if coalesce(trim(new.delivery_address), '') = '' then new.delivery_address := customer_row.address; end if;

  auto_accept := private.workflow_boolean(customer_row.owner_id, 'autoAcceptOrders', false);
  if auto_accept then
    new.status := 'accepted';
    new.accepted_at := now();
  else
    new.status := 'pending';
    new.accepted_at := null;
  end if;
  return new;
end;
$$;

revoke all on function public.prepare_customer_order() from public, anon, authenticated;

create or replace function public.queue_rider_assignment_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  device_row public.rider_devices;
  customer_name text := 'Customer';
  event_uuid uuid;
  request_uuid bigint;
  sound_name text;
  channel_name text;
begin
  if new.assigned_rider_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.assigned_rider_id is not distinct from old.assigned_rider_id then return new; end if;

  insert into public.rider_push_events (
    owner_id, rider_profile_id, order_id, delivery_status
  ) values (
    new.owner_id, new.assigned_rider_id, new.id, 'no_device'
  )
  on conflict (order_id, rider_profile_id, event_type) do nothing
  returning id into event_uuid;

  if event_uuid is null then return new; end if;

  select * into device_row
  from public.rider_devices
  where rider_profile_id = new.assigned_rider_id and active = true
  order by updated_at desc
  limit 1;
  if device_row.id is null then return new; end if;

  select coalesce(nullif(name, ''), 'Customer') into customer_name
  from public.customers where id = new.customer_id limit 1;

  sound_name := case device_row.notification_tone
    when 'water_drop' then 'water_drop.wav'
    when 'bright_chime' then 'bright_chime.wav'
    when 'soft_bell' then 'soft_bell.wav'
    else 'default'
  end;
  channel_name := 'rider-orders-' || replace(device_row.notification_tone, '_', '-');

  select net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := jsonb_build_object(
      'to', device_row.expo_push_token,
      'title', 'New delivery · ' || customer_name,
      'body', 'Open the rider app for the address and bottle list.',
      'sound', sound_name,
      'channelId', channel_name,
      'priority', 'high',
      'data', jsonb_build_object(
        'type', 'order_assigned',
        'orderId', new.id::text,
        'url', 'himaliya-admin://rider/order/' || new.id::text
      )
    ),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 5000
  ) into request_uuid;

  update public.rider_push_events
  set delivery_status = 'queued', request_id = request_uuid
  where id = event_uuid;
  return new;
exception when others then
  if event_uuid is not null then
    update public.rider_push_events set delivery_status = 'failed' where id = event_uuid;
  end if;
  return new;
end;
$$;

revoke all on function public.queue_rider_assignment_push() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
