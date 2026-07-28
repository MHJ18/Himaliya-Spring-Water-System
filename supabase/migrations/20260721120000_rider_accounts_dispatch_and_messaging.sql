-- Dedicated rider accounts, secure order assignment, rider delivery updates,
-- automatic dispatch, and shared admin/customer/rider conversations.
-- Prerequisite: run 20260720050000_customer_admin_messaging.sql first.

begin;

do $$
begin
  if to_regclass('public.customer_conversations') is null then
    raise exception 'Missing prerequisite: run 20260720050000_customer_admin_messaging.sql before this rider migration';
  end if;
end
$$;

alter table public.admin_profiles
  add column if not exists phone text not null default '';

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.admin_profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.admin_profiles drop constraint %I', constraint_name);
  end loop;
end
$$;

alter table public.admin_profiles
  add constraint admin_profiles_role_check
  check (role in ('Owner', 'Admin', 'Manager', 'Rider'));

create or replace function private.current_owner_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select owner_id from public.admin_profiles
  where auth_user_id = (select auth.uid()) and active = true and role <> 'Rider'
  limit 1
$$;

create or replace function private.is_active_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.admin_profiles
    where auth_user_id = (select auth.uid()) and active = true and role <> 'Rider'
  )
$$;

create or replace function private.current_rider_profile_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select id from public.admin_profiles
  where auth_user_id = (select auth.uid()) and active = true and role = 'Rider'
  limit 1
$$;

create or replace function private.current_rider_owner_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select owner_id from public.admin_profiles
  where auth_user_id = (select auth.uid()) and active = true and role = 'Rider'
  limit 1
$$;

revoke all on function private.current_owner_id(), private.is_active_admin(),
  private.current_rider_profile_id(), private.current_rider_owner_id()
  from public, anon;
grant execute on function private.current_owner_id(), private.is_active_admin(),
  private.current_rider_profile_id(), private.current_rider_owner_id()
  to authenticated;

drop policy if exists "Riders read own profile" on public.admin_profiles;
create policy "Riders read own profile" on public.admin_profiles
for select to authenticated
using (auth_user_id = (select auth.uid()) and role = 'Rider' and active = true);

alter table public.customer_orders
  add column if not exists assigned_rider_id uuid,
  add column if not exists assigned_at timestamptz,
  add column if not exists bottles_collected integer not null default 0,
  add column if not exists bottles_dropped_off integer not null default 0;

alter table public.customer_orders
  drop constraint if exists customer_orders_assigned_rider_fkey,
  drop constraint if exists customer_orders_bottles_collected_check,
  drop constraint if exists customer_orders_bottles_dropped_off_check;

alter table public.customer_orders
  add constraint customer_orders_assigned_rider_fkey
    foreign key (assigned_rider_id) references public.admin_profiles(id) on delete set null,
  add constraint customer_orders_bottles_collected_check
    check (bottles_collected between 0 and quantity),
  add constraint customer_orders_bottles_dropped_off_check
    check (bottles_dropped_off between 0 and quantity);

create index if not exists customer_orders_assigned_rider_status_idx
  on public.customer_orders (assigned_rider_id, status, delivery_date, created_at desc);

alter table public.customer_conversations
  add column if not exists rider_id uuid,
  add column if not exists rider_auth_user_id uuid,
  add column if not exists rider_unread_count integer not null default 0;

alter table public.customer_conversations
  drop constraint if exists customer_conversations_rider_id_fkey,
  drop constraint if exists customer_conversations_rider_auth_user_id_fkey,
  drop constraint if exists customer_conversations_rider_unread_count_check,
  drop constraint if exists customer_conversations_last_sender_role_check;

alter table public.customer_conversations
  add constraint customer_conversations_rider_id_fkey
    foreign key (rider_id) references public.admin_profiles(id) on delete set null,
  add constraint customer_conversations_rider_auth_user_id_fkey
    foreign key (rider_auth_user_id) references auth.users(id) on delete set null,
  add constraint customer_conversations_rider_unread_count_check
    check (rider_unread_count >= 0),
  add constraint customer_conversations_last_sender_role_check
    check (last_sender_role in ('admin', 'customer', 'rider'));

alter table public.customer_messages
  drop constraint if exists customer_messages_sender_role_check;
alter table public.customer_messages
  add constraint customer_messages_sender_role_check
  check (sender_role in ('admin', 'customer', 'rider'));

create index if not exists customer_conversations_rider_auth_user_idx
  on public.customer_conversations (rider_auth_user_id, last_message_at desc nulls last);

drop policy if exists "Customers read assigned rider profile" on public.admin_profiles;
create policy "Customers read assigned rider profile" on public.admin_profiles
for select to authenticated
using (
  role = 'Rider'
  and exists (
    select 1 from public.customer_conversations conversation
    where conversation.rider_id = admin_profiles.id
      and conversation.auth_user_id = (select auth.uid())
  )
);

create or replace function public.prepare_rider_assignment()
returns trigger language plpgsql security definer set search_path = ''
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
      select id into new.assigned_rider_id
      from public.admin_profiles
      where owner_id = new.owner_id and role = 'Rider' and active = true
      order by (id = configured_rider_id) desc, created_at asc
      limit 1;
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
      select * into rider_row from public.admin_profiles
      where id = new.assigned_rider_id and owner_id = new.owner_id
        and role = 'Rider' and active = true
      limit 1;
      if rider_row.id is null then raise exception 'Select an active rider from this business'; end if;
      new.assigned_at := now();
      new.rider_name := rider_row.name;
      new.rider_phone := rider_row.phone;
      if new.status = 'pending' then
        new.status := 'accepted';
        new.accepted_at := coalesce(new.accepted_at, now());
      end if;
      if new.tracking_status = 'unassigned' then new.tracking_status := 'assigned'; end if;
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists zz_customer_orders_prepare_rider_assignment on public.customer_orders;
create trigger zz_customer_orders_prepare_rider_assignment
before insert or update of status, assigned_rider_id on public.customer_orders
for each row execute function public.prepare_rider_assignment();
revoke all on function public.prepare_rider_assignment() from public, anon, authenticated;

create or replace function public.sync_order_rider_conversation()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  customer_row public.customers;
  rider_row public.admin_profiles;
begin
  if new.assigned_rider_id is null then return new; end if;
  select * into customer_row from public.customers
  where owner_id = new.owner_id and id = new.customer_id limit 1;
  select * into rider_row from public.admin_profiles
  where id = new.assigned_rider_id and owner_id = new.owner_id limit 1;
  if customer_row.auth_user_id is not null and rider_row.auth_user_id is not null then
    insert into public.customer_conversations
      (owner_id, customer_id, auth_user_id, rider_id, rider_auth_user_id)
    values
      (new.owner_id, new.customer_id, customer_row.auth_user_id,
       rider_row.id, rider_row.auth_user_id)
    on conflict (owner_id, customer_id) do update
      set rider_id = excluded.rider_id,
          rider_auth_user_id = excluded.rider_auth_user_id,
          rider_unread_count = 0,
          updated_at = now();
  end if;
  return new;
end
$$;

drop trigger if exists customer_orders_sync_rider_conversation on public.customer_orders;
create trigger customer_orders_sync_rider_conversation
after insert or update of assigned_rider_id on public.customer_orders
for each row execute function public.sync_order_rider_conversation();
revoke all on function public.sync_order_rider_conversation() from public, anon, authenticated;

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
language plpgsql security definer set search_path = ''
as $$
declare
  rider_uuid uuid := (select private.current_rider_profile_id());
  order_row public.customer_orders;
begin
  if rider_uuid is null then raise exception 'Active rider access required'; end if;
  if p_tracking_status not in ('assigned', 'picked_up', 'en_route', 'nearby', 'delivered') then
    raise exception 'Invalid delivery status';
  end if;
  select * into order_row from public.customer_orders
  where id = p_order_id and assigned_rider_id = rider_uuid for update;
  if order_row.id is null then raise exception 'This delivery is not assigned to you'; end if;
  if p_bottles_collected < 0 or p_bottles_collected > order_row.quantity
     or p_bottles_dropped_off < 0 or p_bottles_dropped_off > order_row.quantity then
    raise exception 'Bottle counts must be between zero and the order quantity';
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

revoke all on function public.update_rider_delivery(uuid, text, integer, integer, double precision, double precision, double precision)
  from public, anon;
grant execute on function public.update_rider_delivery(uuid, text, integer, integer, double precision, double precision, double precision)
  to authenticated;

drop policy if exists "Riders read assigned orders" on public.customer_orders;
create policy "Riders read assigned orders" on public.customer_orders
for select to authenticated
using (assigned_rider_id = (select private.current_rider_profile_id()));

drop policy if exists "Riders read assigned customers" on public.customers;
create policy "Riders read assigned customers" on public.customers
for select to authenticated
using (
  exists (
    select 1 from public.customer_orders delivery
    where delivery.owner_id = customers.owner_id
      and delivery.customer_id = customers.id
      and delivery.assigned_rider_id = (select private.current_rider_profile_id())
  )
);

create or replace function public.prepare_customer_message()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  conversation_row public.customer_conversations;
  preview text;
begin
  select * into conversation_row from public.customer_conversations
  where id = new.conversation_id limit 1;
  if conversation_row.id is null then raise exception 'Conversation not found'; end if;
  new.owner_id := conversation_row.owner_id;
  new.body := trim(new.body);
  preview := left(new.body, 140);

  if new.sender_role = 'customer' then
    if conversation_row.auth_user_id is distinct from (select auth.uid()) then
      raise exception 'You can only send messages in your own conversation';
    end if;
    new.sender_auth_user_id := conversation_row.auth_user_id;
  elsif new.sender_role = 'admin' then
    if (select private.current_owner_id()) is distinct from conversation_row.owner_id then
      raise exception 'Admin access required for this conversation';
    end if;
    new.sender_auth_user_id := (select auth.uid());
  elsif new.sender_role = 'rider' then
    if conversation_row.rider_auth_user_id is distinct from (select auth.uid()) then
      raise exception 'This conversation is not assigned to you';
    end if;
    new.sender_auth_user_id := conversation_row.rider_auth_user_id;
  else
    raise exception 'Invalid sender role';
  end if;

  update public.customer_conversations
  set last_message_at = now(), last_message_preview = preview,
      last_sender_role = new.sender_role,
      admin_unread_count = admin_unread_count + case when new.sender_role <> 'admin' then 1 else 0 end,
      customer_unread_count = customer_unread_count + case when new.sender_role <> 'customer' then 1 else 0 end,
      rider_unread_count = rider_unread_count + case
        when rider_auth_user_id is not null and new.sender_role <> 'rider' then 1 else 0 end,
      updated_at = now()
  where id = conversation_row.id;
  return new;
end
$$;
revoke all on function public.prepare_customer_message() from public, anon, authenticated;

create or replace function public.mark_conversation_read(p_conversation_id uuid, p_reader_role text)
returns public.customer_conversations
language plpgsql security definer set search_path = ''
as $$
declare conversation_row public.customer_conversations;
begin
  select * into conversation_row from public.customer_conversations
  where id = p_conversation_id limit 1;
  if conversation_row.id is null then raise exception 'Conversation not found'; end if;
  if p_reader_role = 'customer' and conversation_row.auth_user_id = (select auth.uid()) then
    update public.customer_conversations set customer_unread_count = 0, updated_at = now()
    where id = conversation_row.id returning * into conversation_row;
  elsif p_reader_role = 'admin' and (select private.current_owner_id()) = conversation_row.owner_id then
    update public.customer_conversations set admin_unread_count = 0, updated_at = now()
    where id = conversation_row.id returning * into conversation_row;
  elsif p_reader_role = 'rider' and conversation_row.rider_auth_user_id = (select auth.uid()) then
    update public.customer_conversations set rider_unread_count = 0, updated_at = now()
    where id = conversation_row.id returning * into conversation_row;
  else
    raise exception 'You cannot mark this conversation as read';
  end if;
  return conversation_row;
end
$$;

revoke all on function public.mark_conversation_read(uuid, text) from public, anon;
grant execute on function public.mark_conversation_read(uuid, text) to authenticated;

drop policy if exists "Riders read assigned conversations" on public.customer_conversations;
create policy "Riders read assigned conversations" on public.customer_conversations
for select to authenticated
using (rider_auth_user_id = (select auth.uid()));

drop policy if exists "Riders read assigned messages" on public.customer_messages;
create policy "Riders read assigned messages" on public.customer_messages
for select to authenticated
using (
  exists (
    select 1 from public.customer_conversations conversation
    where conversation.id = customer_messages.conversation_id
      and conversation.rider_auth_user_id = (select auth.uid())
  )
);

drop policy if exists "Riders send assigned messages" on public.customer_messages;
create policy "Riders send assigned messages" on public.customer_messages
for insert to authenticated
with check (
  sender_role = 'rider'
  and sender_auth_user_id = (select auth.uid())
  and exists (
    select 1 from public.customer_conversations conversation
    where conversation.id = conversation_id
      and conversation.rider_auth_user_id = (select auth.uid())
  )
);

notify pgrst, 'reload schema';

commit;
