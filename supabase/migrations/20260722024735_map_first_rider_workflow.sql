begin;

create extension if not exists pg_net with schema extensions;

alter table public.admin_profiles
  add column if not exists rider_available boolean not null default false,
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_assigned_at timestamptz;

alter table public.customer_orders
  add column if not exists payment_type text not null default 'COD',
  add column if not exists rider_fee numeric(12, 2) not null default 0;

alter table public.customer_orders
  drop constraint if exists customer_orders_payment_type_check,
  add constraint customer_orders_payment_type_check
    check (payment_type in ('COD', 'prepaid')),
  drop constraint if exists customer_orders_rider_fee_check,
  add constraint customer_orders_rider_fee_check check (rider_fee >= 0);

create table if not exists public.rider_devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  rider_profile_id uuid not null references public.admin_profiles(id) on delete cascade,
  expo_push_token text not null,
  platform text not null default 'android' check (platform in ('android', 'ios')),
  notification_tone text not null default 'water_drop'
    check (notification_tone in ('water_drop', 'bright_chime', 'soft_bell', 'default')),
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rider_profile_id),
  unique (expo_push_token)
);

create index if not exists rider_devices_owner_active_idx
  on public.rider_devices (owner_id, active, updated_at desc);

alter table public.rider_devices enable row level security;
revoke all on table public.rider_devices from public, anon;
grant select, insert, update, delete on table public.rider_devices to authenticated;

drop policy if exists "Riders manage own device" on public.rider_devices;
create policy "Riders manage own device" on public.rider_devices
for all to authenticated
using (rider_profile_id = (select private.current_rider_profile_id()))
with check (
  rider_profile_id = (select private.current_rider_profile_id())
  and owner_id = (select private.current_rider_owner_id())
);

drop policy if exists "Admins read business rider devices" on public.rider_devices;
create policy "Admins read business rider devices" on public.rider_devices
for select to authenticated
using (owner_id = (select private.current_owner_id()));

create table if not exists public.rider_push_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  rider_profile_id uuid not null references public.admin_profiles(id) on delete cascade,
  order_id uuid not null references public.customer_orders(id) on delete cascade,
  event_type text not null default 'order_assigned' check (event_type = 'order_assigned'),
  delivery_status text not null default 'queued'
    check (delivery_status in ('no_device', 'queued', 'failed')),
  request_id bigint,
  created_at timestamptz not null default now(),
  unique (order_id, rider_profile_id, event_type)
);

create index if not exists rider_push_events_rider_created_idx
  on public.rider_push_events (rider_profile_id, created_at desc);

alter table public.rider_push_events enable row level security;
revoke all on table public.rider_push_events from public, anon;
grant select on table public.rider_push_events to authenticated;

drop policy if exists "Riders read own push events" on public.rider_push_events;
create policy "Riders read own push events" on public.rider_push_events
for select to authenticated
using (rider_profile_id = (select private.current_rider_profile_id()));

drop policy if exists "Admins read business rider push events" on public.rider_push_events;
create policy "Admins read business rider push events" on public.rider_push_events
for select to authenticated
using (owner_id = (select private.current_owner_id()));

create or replace function public.prepare_rider_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rider_row public.admin_profiles;
  configured_rider_id uuid;
  assignment_mode text;
  assignment_changed boolean;
begin
  if new.status = 'accepted' and new.assigned_rider_id is null then
    select coalesce(payload ->> 'riderAssignmentMode', 'manual'),
           nullif(payload ->> 'defaultRiderId', '')::uuid
      into assignment_mode, configured_rider_id
    from public.app_settings
    where owner_id = new.owner_id and id = 'main'
    limit 1;

    if assignment_mode = 'auto' then
      select * into rider_row
      from public.admin_profiles
      where owner_id = new.owner_id
        and role = 'Rider'
        and active = true
        and rider_available = true
      order by (id = configured_rider_id) desc,
               last_assigned_at asc nulls first,
               created_at asc
      for update skip locked
      limit 1;
      new.assigned_rider_id := rider_row.id;
    end if;
  end if;

  if tg_op = 'INSERT' then
    assignment_changed := new.assigned_rider_id is not null;
  else
    assignment_changed := new.assigned_rider_id is distinct from old.assigned_rider_id;
  end if;

  if assignment_changed then
    if new.assigned_rider_id is null then
      new.assigned_at := null;
      new.rider_name := '';
      new.rider_phone := '';
      if new.tracking_status <> 'delivered' then new.tracking_status := 'unassigned'; end if;
    else
      if rider_row.id is null or rider_row.id <> new.assigned_rider_id then
        select * into rider_row
        from public.admin_profiles
        where id = new.assigned_rider_id
          and owner_id = new.owner_id
          and role = 'Rider'
          and active = true
        limit 1;
      end if;
      if rider_row.id is null then raise exception 'Select an active rider from this business'; end if;
      new.assigned_at := now();
      new.rider_name := rider_row.name;
      new.rider_phone := rider_row.phone;
      if new.status = 'pending' then
        new.status := 'accepted';
        new.accepted_at := coalesce(new.accepted_at, now());
      end if;
      if new.tracking_status = 'unassigned' then new.tracking_status := 'assigned'; end if;
      update public.admin_profiles
      set last_assigned_at = now()
      where id = rider_row.id;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.prepare_rider_assignment() from public, anon, authenticated;

create or replace function public.update_rider_mobile_settings(
  p_available boolean,
  p_notification_tone text default 'water_drop',
  p_expo_push_token text default null,
  p_platform text default 'android'
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
begin
  if rider_uuid is null or owner_uuid is null then raise exception 'Active rider access required'; end if;
  if tone not in ('water_drop', 'bright_chime', 'soft_bell', 'default') then
    raise exception 'Select a valid notification tone';
  end if;
  if p_platform not in ('android', 'ios') then raise exception 'Select a valid device platform'; end if;

  update public.admin_profiles
  set rider_available = coalesce(p_available, false),
      last_seen_at = now(),
      preferences = jsonb_set(
        jsonb_set(coalesce(preferences, '{}'::jsonb), '{notificationTone}', to_jsonb(tone), true),
        '{riderAvailable}', to_jsonb(coalesce(p_available, false)), true
      )
  where id = rider_uuid and owner_id = owner_uuid and role = 'Rider' and active = true;

  if token is not null then
    delete from public.rider_devices
    where expo_push_token = token and rider_profile_id <> rider_uuid;

    insert into public.rider_devices (
      owner_id, rider_profile_id, expo_push_token, platform,
      notification_tone, active, last_seen_at, updated_at
    ) values (
      owner_uuid, rider_uuid, token, p_platform,
      tone, true, now(), now()
    )
    on conflict (rider_profile_id) do update
      set expo_push_token = excluded.expo_push_token,
          platform = excluded.platform,
          notification_tone = excluded.notification_tone,
          active = true,
          last_seen_at = now(),
          updated_at = now();
  else
    update public.rider_devices
    set notification_tone = tone,
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
    'pushRegistered', token is not null or exists (
      select 1 from public.rider_devices where rider_profile_id = rider_uuid and active = true
    )
  );
end;
$$;

revoke all on function public.update_rider_mobile_settings(boolean, text, text, text)
  from public, anon;
grant execute on function public.update_rider_mobile_settings(boolean, text, text, text)
  to authenticated;

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
  settings_payload jsonb := '{}'::jsonb;
begin
  if rider_uuid is null or owner_uuid is null then raise exception 'Active rider access required'; end if;
  select * into profile_row from public.admin_profiles where id = rider_uuid and active = true;
  select payload into settings_payload from public.app_settings
  where owner_id = owner_uuid and id = 'main' limit 1;
  return jsonb_build_object(
    'businessName', coalesce(settings_payload ->> 'businessName', 'Himaliya Spring Water'),
    'pickupAddress', coalesce(settings_payload ->> 'businessAddress', 'Sialkot Cantt'),
    'businessPhone', coalesce(settings_payload ->> 'businessPhone', ''),
    'available', profile_row.rider_available,
    'notificationTone', coalesce(profile_row.preferences ->> 'notificationTone', 'water_drop')
  );
end;
$$;

revoke all on function public.get_rider_mobile_config() from public, anon;
grant execute on function public.get_rider_mobile_config() to authenticated;

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
      'body', new.quantity || ' × ' || new.bottle_type || ' · ' || new.delivery_address,
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

drop trigger if exists customer_orders_queue_rider_assignment_push on public.customer_orders;
create trigger customer_orders_queue_rider_assignment_push
after insert or update of assigned_rider_id on public.customer_orders
for each row execute function public.queue_rider_assignment_push();

update public.app_settings
set payload = jsonb_set(
      jsonb_set(payload, '{autoAcceptOrders}', 'true'::jsonb, true),
      '{riderAssignmentMode}', '"auto"'::jsonb, true
    ),
    updated_at = now()
where id = 'main';

notify pgrst, 'reload schema';

commit;
