begin;

alter table public.rider_devices
  add column if not exists notifications_enabled boolean not null default true,
  add column if not exists vibration_enabled boolean not null default true,
  add column if not exists location_mode text not null default 'balanced';

alter table public.rider_devices
  drop constraint if exists rider_devices_location_mode_check,
  add constraint rider_devices_location_mode_check
    check (location_mode in ('balanced', 'data_saver'));

create or replace function public.update_rider_mobile_settings(
  p_available boolean,
  p_notification_tone text default 'water_drop',
  p_expo_push_token text default null,
  p_platform text default 'android',
  p_notifications_enabled boolean default true,
  p_vibration_enabled boolean default true,
  p_location_mode text default 'balanced',
  p_reduced_motion boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rider_uuid uuid := (select private.current_rider_profile_id());
  owner_uuid uuid := (select private.current_rider_owner_id());
  tone text := coalesce(nullif(trim(p_notification_tone), ''), 'water_drop');
  token text := nullif(trim(p_expo_push_token), '');
  clean_location_mode text := coalesce(nullif(trim(p_location_mode), ''), 'balanced');
begin
  if rider_uuid is null or owner_uuid is null then
    raise exception 'Active rider access required';
  end if;
  if tone not in ('water_drop', 'bright_chime', 'soft_bell', 'default') then
    raise exception 'Select a valid notification tone';
  end if;
  if p_platform not in ('android', 'ios') then
    raise exception 'Select a valid device platform';
  end if;
  if clean_location_mode not in ('balanced', 'data_saver') then
    raise exception 'Select a valid location mode';
  end if;

  update public.admin_profiles
  set rider_available = coalesce(p_available, false),
      last_seen_at = now(),
      preferences = coalesce(preferences, '{}'::jsonb)
        || jsonb_build_object(
          'notificationTone', tone,
          'notificationsEnabled', coalesce(p_notifications_enabled, true),
          'vibrationEnabled', coalesce(p_vibration_enabled, true),
          'locationMode', clean_location_mode,
          'reducedMotion', coalesce(p_reduced_motion, false),
          'riderAvailable', coalesce(p_available, false)
        )
  where id = rider_uuid
    and owner_id = owner_uuid
    and role = 'Rider'
    and active = true;

  if token is not null then
    delete from public.rider_devices
    where expo_push_token = token
      and rider_profile_id <> rider_uuid;

    insert into public.rider_devices (
      owner_id,
      rider_profile_id,
      expo_push_token,
      platform,
      notification_tone,
      notifications_enabled,
      vibration_enabled,
      location_mode,
      active,
      last_seen_at,
      updated_at
    ) values (
      owner_uuid,
      rider_uuid,
      token,
      p_platform,
      tone,
      coalesce(p_notifications_enabled, true),
      coalesce(p_vibration_enabled, true),
      clean_location_mode,
      true,
      now(),
      now()
    )
    on conflict (rider_profile_id) do update
      set expo_push_token = excluded.expo_push_token,
          platform = excluded.platform,
          notification_tone = excluded.notification_tone,
          notifications_enabled = excluded.notifications_enabled,
          vibration_enabled = excluded.vibration_enabled,
          location_mode = excluded.location_mode,
          active = true,
          last_seen_at = now(),
          updated_at = now();
  else
    update public.rider_devices
    set notification_tone = tone,
        notifications_enabled = coalesce(p_notifications_enabled, true),
        vibration_enabled = coalesce(p_vibration_enabled, true),
        location_mode = clean_location_mode,
        active = true,
        last_seen_at = now(),
        updated_at = now()
    where rider_profile_id = rider_uuid;
  end if;

  if coalesce(p_available, false) then
    update public.customer_orders
    set assigned_rider_id = rider_uuid,
        updated_at = now()
    where owner_id = owner_uuid
      and status = 'accepted'
      and assigned_rider_id is null
      and tracking_status = 'unassigned';
  end if;

  return jsonb_build_object(
    'riderId', rider_uuid,
    'available', coalesce(p_available, false),
    'notificationTone', tone,
    'notificationsEnabled', coalesce(p_notifications_enabled, true),
    'vibrationEnabled', coalesce(p_vibration_enabled, true),
    'locationMode', clean_location_mode,
    'reducedMotion', coalesce(p_reduced_motion, false),
    'pushRegistered', token is not null or exists (
      select 1
      from public.rider_devices
      where rider_profile_id = rider_uuid
        and active = true
    )
  );
end;
$$;

revoke all on function public.update_rider_mobile_settings(
  boolean, text, text, text, boolean, boolean, text, boolean
) from public, anon;
grant execute on function public.update_rider_mobile_settings(
  boolean, text, text, text, boolean, boolean, text, boolean
) to authenticated;

create or replace function public.get_rider_mobile_config()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  rider_uuid uuid := (select private.current_rider_profile_id());
  owner_uuid uuid := (select private.current_rider_owner_id());
  profile_row public.admin_profiles;
  device_row public.rider_devices;
  settings_payload jsonb := '{}'::jsonb;
begin
  if rider_uuid is null or owner_uuid is null then
    raise exception 'Active rider access required';
  end if;

  select * into profile_row
  from public.admin_profiles
  where id = rider_uuid
    and owner_id = owner_uuid
    and active = true;

  select * into device_row
  from public.rider_devices
  where rider_profile_id = rider_uuid
  limit 1;

  select payload into settings_payload
  from public.app_settings
  where owner_id = owner_uuid
    and id = 'main'
  limit 1;

  return jsonb_build_object(
    'businessName', coalesce(settings_payload ->> 'businessName', 'Himaliya Spring Water'),
    'pickupAddress', coalesce(settings_payload ->> 'businessAddress', 'Sialkot Cantt'),
    'businessPhone', coalesce(settings_payload ->> 'businessPhone', ''),
    'available', profile_row.rider_available,
    'notificationTone', coalesce(
      device_row.notification_tone,
      profile_row.preferences ->> 'notificationTone',
      'water_drop'
    ),
    'notificationsEnabled', coalesce(
      device_row.notifications_enabled,
      (profile_row.preferences ->> 'notificationsEnabled')::boolean,
      true
    ),
    'vibrationEnabled', coalesce(
      device_row.vibration_enabled,
      (profile_row.preferences ->> 'vibrationEnabled')::boolean,
      true
    ),
    'locationMode', coalesce(
      device_row.location_mode,
      profile_row.preferences ->> 'locationMode',
      'balanced'
    ),
    'reducedMotion', coalesce(
      (profile_row.preferences ->> 'reducedMotion')::boolean,
      false
    )
  );
end;
$$;

revoke all on function public.get_rider_mobile_config() from public, anon;
grant execute on function public.get_rider_mobile_config() to authenticated;

create or replace function public.update_rider_stop_location(
  p_order_ids uuid[],
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
  updated_time timestamptz := now();
  valid_order_count integer;
begin
  if rider_uuid is null then raise exception 'Active rider access required'; end if;
  if p_order_ids is null or cardinality(p_order_ids) < 1 or cardinality(p_order_ids) > 50 then
    raise exception 'Select between one and 50 assigned orders';
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

  select count(distinct id) into valid_order_count
  from public.customer_orders
  where id = any(p_order_ids)
    and assigned_rider_id = rider_uuid
    and tracking_status in ('picked_up', 'en_route', 'nearby');

  if valid_order_count <> cardinality(p_order_ids) then
    raise exception 'Every delivery in this stop must be assigned to you and active';
  end if;

  update public.customer_orders
  set rider_lat = p_rider_lat,
      rider_lng = p_rider_lng,
      rider_heading = p_rider_heading,
      location_updated_at = updated_time,
      updated_at = updated_time
  where id = any(p_order_ids)
    and (
      rider_lat is null
      or rider_lng is null
      or abs(rider_lat - p_rider_lat) >= 0.00035
      or abs(rider_lng - p_rider_lng) >= 0.00035
      or location_updated_at is null
      or location_updated_at < updated_time - interval '2 minutes'
    );

  return updated_time;
end;
$$;

revoke all on function public.update_rider_stop_location(
  uuid[], double precision, double precision, double precision
) from public, anon;
grant execute on function public.update_rider_stop_location(
  uuid[], double precision, double precision, double precision
) to authenticated;

create or replace function public.update_rider_delivery_stop(
  p_order_ids uuid[],
  p_tracking_status text,
  p_bottles_collected integer default 0,
  p_rider_lat double precision default null,
  p_rider_lng double precision default null,
  p_rider_heading double precision default null,
  p_delivered_items jsonb default null
)
returns setof public.customer_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  rider_uuid uuid := (select private.current_rider_profile_id());
  valid_order_count integer;
  distinct_stop_count integer;
  order_row public.customer_orders;
  updated_row public.customer_orders;
  supplied_item jsonb;
  ordered_item jsonb;
  item_type text;
  item_quantity integer;
  ordered_quantity integer;
  remaining_quantity integer;
  allocated_quantity integer;
  order_delivery_total integer;
  order_delivery_items jsonb;
  remaining_items jsonb := '{}'::jsonb;
  is_first_order boolean := true;
begin
  if rider_uuid is null then raise exception 'Active rider access required'; end if;
  if p_order_ids is null or cardinality(p_order_ids) < 1 or cardinality(p_order_ids) > 50 then
    raise exception 'Select between one and 50 assigned orders';
  end if;
  if p_tracking_status not in ('assigned', 'picked_up', 'en_route', 'nearby', 'delivered') then
    raise exception 'Invalid delivery status';
  end if;
  if coalesce(p_bottles_collected, 0) < 0 then
    raise exception 'Empty bottles taken back cannot be negative';
  end if;

  perform 1
  from public.customer_orders
  where id = any(p_order_ids)
  order by assigned_at nulls last, created_at, id
  for update;

  select count(distinct orders.id),
         count(distinct (
           coalesce(orders.customer_id::text, 'unknown-customer')
           || '::'
           || regexp_replace(
             lower(trim(coalesce(nullif(orders.delivery_address, ''), customers.address, ''))),
             '\s+',
             ' ',
             'g'
           )
         ))
    into valid_order_count, distinct_stop_count
  from public.customer_orders orders
  left join public.customers customers
    on customers.id = orders.customer_id
   and customers.owner_id = orders.owner_id
  where orders.id = any(p_order_ids)
    and orders.assigned_rider_id = rider_uuid
    and orders.tracking_status <> 'delivered';

  if valid_order_count <> cardinality(p_order_ids) then
    raise exception 'Every delivery in this stop must be assigned to you and active';
  end if;
  if distinct_stop_count <> 1 then
    raise exception 'Orders from different customers or addresses cannot be completed together';
  end if;

  if p_tracking_status = 'delivered' then
    if p_delivered_items is null
       or jsonb_typeof(p_delivered_items) is distinct from 'array'
       or jsonb_array_length(p_delivered_items) = 0 then
      raise exception 'Confirm at least one delivered bottle';
    end if;

    for supplied_item in
      select value from jsonb_array_elements(p_delivered_items)
    loop
      item_type := trim(coalesce(supplied_item ->> 'bottleType', ''));
      item_quantity := coalesce((supplied_item ->> 'quantity')::integer, 0);
      if item_type = '' or item_quantity < 0 then
        raise exception 'Delivered bottle quantities are invalid';
      end if;

      select coalesce(sum((item ->> 'quantity')::integer), 0)
        into ordered_quantity
      from public.customer_orders orders
      cross join lateral jsonb_array_elements(orders.items) item
      where orders.id = any(p_order_ids)
        and item ->> 'bottleType' = item_type;

      if ordered_quantity = 0 then
        raise exception 'Delivered bottle types must exist in this stop';
      end if;

      remaining_quantity := coalesce((remaining_items ->> item_type)::integer, 0);
      if remaining_quantity + item_quantity > ordered_quantity then
        raise exception 'Delivered bottle quantities cannot exceed this stop';
      end if;
      remaining_items := jsonb_set(
        remaining_items,
        array[item_type],
        to_jsonb(remaining_quantity + item_quantity),
        true
      );
    end loop;
  end if;

  for order_row in
    select *
    from public.customer_orders
    where id = any(p_order_ids)
    order by assigned_at nulls last, created_at, id
  loop
    if p_tracking_status = 'delivered' then
      order_delivery_items := '[]'::jsonb;
      order_delivery_total := 0;

      for ordered_item in
        select value from jsonb_array_elements(order_row.items)
      loop
        item_type := trim(coalesce(ordered_item ->> 'bottleType', ''));
        ordered_quantity := coalesce((ordered_item ->> 'quantity')::integer, 0);
        remaining_quantity := coalesce((remaining_items ->> item_type)::integer, 0);
        allocated_quantity := least(ordered_quantity, remaining_quantity);
        if allocated_quantity > 0 then
          order_delivery_items := order_delivery_items || jsonb_build_array(
            jsonb_build_object('bottleType', item_type, 'quantity', allocated_quantity)
          );
          order_delivery_total := order_delivery_total + allocated_quantity;
          remaining_items := jsonb_set(
            remaining_items,
            array[item_type],
            to_jsonb(remaining_quantity - allocated_quantity),
            true
          );
        end if;
      end loop;

      select * into updated_row
      from public.update_rider_delivery(
        order_row.id,
        p_tracking_status,
        case when is_first_order then coalesce(p_bottles_collected, 0) else 0 end,
        order_delivery_total,
        coalesce(p_rider_lat, order_row.rider_lat),
        coalesce(p_rider_lng, order_row.rider_lng),
        coalesce(p_rider_heading, order_row.rider_heading),
        order_delivery_items
      );
    else
      select * into updated_row
      from public.update_rider_delivery(
        order_row.id,
        p_tracking_status,
        order_row.bottles_collected,
        order_row.bottles_dropped_off,
        coalesce(p_rider_lat, order_row.rider_lat),
        coalesce(p_rider_lng, order_row.rider_lng),
        coalesce(p_rider_heading, order_row.rider_heading),
        order_row.delivered_items
      );
    end if;

    is_first_order := false;
    return next updated_row;
  end loop;

  if p_tracking_status = 'delivered'
     and exists (
       select 1
       from jsonb_each_text(remaining_items)
       where value::integer <> 0
     ) then
    raise exception 'Delivered bottle quantities could not be assigned to the selected orders';
  end if;

  return;
end;
$$;

revoke all on function public.update_rider_delivery_stop(
  uuid[], text, integer, double precision, double precision, double precision, jsonb
) from public, anon;
grant execute on function public.update_rider_delivery_stop(
  uuid[], text, integer, double precision, double precision, double precision, jsonb
) to authenticated;

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
  item_summary text;
begin
  if new.assigned_rider_id is null then return new; end if;
  if tg_op = 'UPDATE'
     and new.assigned_rider_id is not distinct from old.assigned_rider_id then
    return new;
  end if;

  insert into public.rider_push_events (
    owner_id,
    rider_profile_id,
    order_id,
    delivery_status
  ) values (
    new.owner_id,
    new.assigned_rider_id,
    new.id,
    'no_device'
  )
  on conflict (order_id, rider_profile_id, event_type) do nothing
  returning id into event_uuid;

  if event_uuid is null then return new; end if;

  select * into device_row
  from public.rider_devices
  where rider_profile_id = new.assigned_rider_id
    and active = true
    and notifications_enabled = true
  order by updated_at desc
  limit 1;

  if device_row.id is null then return new; end if;

  select coalesce(nullif(name, ''), 'Customer') into customer_name
  from public.customers
  where id = new.customer_id
    and owner_id = new.owner_id
  limit 1;

  select string_agg(
    (item ->> 'quantity') || ' x ' || (item ->> 'bottleType'),
    ' + '
  ) into item_summary
  from jsonb_array_elements(new.items) item;

  sound_name := case device_row.notification_tone
    when 'water_drop' then 'water_drop.wav'
    when 'bright_chime' then 'bright_chime.wav'
    when 'soft_bell' then 'soft_bell.wav'
    else 'default'
  end;
  channel_name := 'rider-orders-'
    || replace(device_row.notification_tone, '_', '-')
    || case when device_row.vibration_enabled then '-vibrate' else '-quiet' end;

  select net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := jsonb_build_object(
      'to', device_row.expo_push_token,
      'title', 'New delivery - ' || customer_name,
      'body', coalesce(nullif(item_summary, ''), new.quantity || ' x ' || new.bottle_type)
        || ' - ' || coalesce(nullif(new.delivery_address, ''), 'Open the app for the address'),
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
  set delivery_status = 'queued',
      request_id = request_uuid
  where id = event_uuid;

  return new;
exception when others then
  if event_uuid is not null then
    update public.rider_push_events
    set delivery_status = 'failed'
    where id = event_uuid;
  end if;
  return new;
end;
$$;

revoke all on function public.queue_rider_assignment_push()
  from public, anon, authenticated;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'customer_orders'
    ) then
      alter publication supabase_realtime
        add table public.customer_orders;
    end if;

    if to_regclass('public.rider_dispatch_messages') is not null
       and not exists (
         select 1
         from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = 'rider_dispatch_messages'
       ) then
      alter publication supabase_realtime
        add table public.rider_dispatch_messages;
    end if;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
