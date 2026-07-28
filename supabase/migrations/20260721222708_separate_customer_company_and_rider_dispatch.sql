-- Keep customer support private to the customer and company. Riders use a
-- separate dispatch thread that is scoped to their business and rider profile.

begin;

create table if not exists public.rider_dispatch_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  rider_id uuid not null references public.admin_profiles(id) on delete cascade,
  sender_role text not null check (sender_role in ('admin', 'rider')),
  sender_auth_user_id uuid references auth.users(id) on delete set null,
  body text not null check (
    char_length(trim(body)) > 0
    and char_length(body) <= 2000
  ),
  admin_read boolean not null default false,
  rider_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists rider_dispatch_owner_rider_created_idx
  on public.rider_dispatch_messages (owner_id, rider_id, created_at asc);

create index if not exists rider_dispatch_admin_unread_idx
  on public.rider_dispatch_messages (owner_id, created_at desc)
  where admin_read = false and sender_role = 'rider';

create index if not exists rider_dispatch_rider_unread_idx
  on public.rider_dispatch_messages (rider_id, created_at desc)
  where rider_read = false and sender_role = 'admin';

alter table public.rider_dispatch_messages enable row level security;

drop policy if exists "Admins read business rider dispatch" on public.rider_dispatch_messages;
create policy "Admins read business rider dispatch"
on public.rider_dispatch_messages
for select to authenticated
using (owner_id = (select private.current_owner_id()));

drop policy if exists "Riders read own dispatch" on public.rider_dispatch_messages;
create policy "Riders read own dispatch"
on public.rider_dispatch_messages
for select to authenticated
using (rider_id = (select private.current_rider_profile_id()));

-- New Supabase projects no longer expose new public tables automatically.
-- The app only needs SELECT; writes go through the checked functions below.
revoke all on table public.rider_dispatch_messages from anon;
revoke all on table public.rider_dispatch_messages from authenticated;
grant select on table public.rider_dispatch_messages to authenticated;
grant all on table public.rider_dispatch_messages to service_role;

create or replace function public.send_rider_dispatch_message(
  p_rider_id uuid,
  p_body text
)
returns public.rider_dispatch_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_uuid uuid := (select auth.uid());
  admin_owner_uuid uuid := (select private.current_owner_id());
  current_rider_uuid uuid := (select private.current_rider_profile_id());
  rider_row public.admin_profiles;
  clean_body text := trim(coalesce(p_body, ''));
  sender_kind text;
  message_row public.rider_dispatch_messages;
begin
  if actor_uuid is null then raise exception 'Authentication required'; end if;
  if char_length(clean_body) = 0 then raise exception 'Write a message before sending'; end if;
  if char_length(clean_body) > 2000 then raise exception 'Messages can be up to 2,000 characters'; end if;

  if current_rider_uuid is not null then
    if p_rider_id is distinct from current_rider_uuid then
      raise exception 'Riders can only use their own dispatch thread';
    end if;
    select * into rider_row
    from public.admin_profiles
    where id = current_rider_uuid
      and auth_user_id = actor_uuid
      and role = 'Rider'
      and active = true
    limit 1;
    sender_kind := 'rider';
  elsif admin_owner_uuid is not null then
    select * into rider_row
    from public.admin_profiles
    where id = p_rider_id
      and owner_id = admin_owner_uuid
      and role = 'Rider'
      and active = true
    limit 1;
    sender_kind := 'admin';
  else
    raise exception 'Active admin or rider access required';
  end if;

  if rider_row.id is null then raise exception 'Select an active rider from this business'; end if;

  insert into public.rider_dispatch_messages (
    owner_id,
    rider_id,
    sender_role,
    sender_auth_user_id,
    body,
    admin_read,
    rider_read
  ) values (
    rider_row.owner_id,
    rider_row.id,
    sender_kind,
    actor_uuid,
    clean_body,
    sender_kind = 'admin',
    sender_kind = 'rider'
  )
  returning * into message_row;

  if sender_kind = 'rider' then
    insert into public.customer_notifications (
      owner_id, audience, type, title, detail
    ) values (
      rider_row.owner_id,
      'admin',
      'message',
      concat('Message from ', rider_row.name),
      left(clean_body, 140)
    );
  end if;

  return message_row;
end
$$;

revoke all on function public.send_rider_dispatch_message(uuid, text)
  from public, anon;
grant execute on function public.send_rider_dispatch_message(uuid, text)
  to authenticated;

create or replace function public.mark_rider_dispatch_read(p_rider_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_uuid uuid := (select auth.uid());
  admin_owner_uuid uuid := (select private.current_owner_id());
  current_rider_uuid uuid := (select private.current_rider_profile_id());
  rider_row public.admin_profiles;
  changed_count integer := 0;
begin
  if actor_uuid is null then raise exception 'Authentication required'; end if;

  if current_rider_uuid is not null then
    if p_rider_id is distinct from current_rider_uuid then
      raise exception 'Riders can only open their own dispatch thread';
    end if;
    update public.rider_dispatch_messages
    set rider_read = true
    where rider_id = current_rider_uuid
      and sender_role = 'admin'
      and rider_read = false;
  elsif admin_owner_uuid is not null then
    select * into rider_row
    from public.admin_profiles
    where id = p_rider_id
      and owner_id = admin_owner_uuid
      and role = 'Rider'
    limit 1;
    if rider_row.id is null then raise exception 'Rider not found for this business'; end if;

    update public.rider_dispatch_messages
    set admin_read = true
    where owner_id = admin_owner_uuid
      and rider_id = rider_row.id
      and sender_role = 'rider'
      and admin_read = false;
  else
    raise exception 'Active admin or rider access required';
  end if;

  get diagnostics changed_count = row_count;
  return changed_count;
end
$$;

revoke all on function public.mark_rider_dispatch_read(uuid)
  from public, anon;
grant execute on function public.mark_rider_dispatch_read(uuid)
  to authenticated;

-- Riders no longer participate in customer support conversations.
drop policy if exists "Riders read assigned conversations" on public.customer_conversations;
drop policy if exists "Riders read assigned messages" on public.customer_messages;
drop policy if exists "Riders send assigned messages" on public.customer_messages;
drop policy if exists "Customers read assigned rider profile" on public.admin_profiles;

drop trigger if exists customer_orders_sync_rider_conversation on public.customer_orders;
drop function if exists public.sync_order_rider_conversation();

-- Preserve previous rider replies as company replies, then tighten the role
-- checks so no new rider message can enter a customer conversation.
update public.customer_messages
set sender_role = 'admin',
    sender_auth_user_id = owner_id
where sender_role = 'rider';

update public.customer_conversations
set last_sender_role = 'admin'
where last_sender_role = 'rider';

update public.customer_conversations
set rider_id = null,
    rider_auth_user_id = null,
    rider_unread_count = 0
where rider_id is not null
   or rider_auth_user_id is not null
   or rider_unread_count <> 0;

alter table public.customer_messages
  drop constraint if exists customer_messages_sender_role_check;
alter table public.customer_messages
  add constraint customer_messages_sender_role_check
  check (sender_role in ('admin', 'customer'));

alter table public.customer_conversations
  drop constraint if exists customer_conversations_last_sender_role_check;
alter table public.customer_conversations
  add constraint customer_conversations_last_sender_role_check
  check (last_sender_role in ('admin', 'customer'));

create or replace function public.prepare_customer_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversation_row public.customer_conversations;
  customer_name text;
  preview text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  select * into conversation_row
  from public.customer_conversations
  where id = new.conversation_id
  limit 1;
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
  else
    raise exception 'Customer messages can only be sent to the company';
  end if;

  update public.customer_conversations
  set last_message_at = now(),
      last_message_preview = preview,
      last_sender_role = new.sender_role,
      admin_unread_count = admin_unread_count
        + case when new.sender_role = 'customer' then 1 else 0 end,
      customer_unread_count = customer_unread_count
        + case when new.sender_role = 'admin' then 1 else 0 end,
      rider_unread_count = 0,
      updated_at = now()
  where id = conversation_row.id;

  if new.sender_role = 'customer' then
    select name into customer_name
    from public.customers
    where owner_id = conversation_row.owner_id
      and id = conversation_row.customer_id
    limit 1;

    insert into public.customer_notifications (
      owner_id, audience, type, title, detail
    ) values (
      conversation_row.owner_id,
      'admin',
      'message',
      concat('Message from ', coalesce(customer_name, 'customer')),
      preview
    );
  else
    insert into public.customer_notifications (
      owner_id, auth_user_id, audience, type, title, detail
    ) values (
      conversation_row.owner_id,
      conversation_row.auth_user_id,
      'customer',
      'message',
      'New message from Himaliya',
      preview
    );
  end if;

  return new;
end
$$;

revoke all on function public.prepare_customer_message()
  from public, anon, authenticated;

create or replace function public.mark_conversation_read(
  p_conversation_id uuid,
  p_reader_role text
)
returns public.customer_conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversation_row public.customer_conversations;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  select * into conversation_row
  from public.customer_conversations
  where id = p_conversation_id
  limit 1;
  if conversation_row.id is null then raise exception 'Conversation not found'; end if;

  if p_reader_role = 'customer'
     and conversation_row.auth_user_id = (select auth.uid()) then
    update public.customer_conversations
    set customer_unread_count = 0, updated_at = now()
    where id = conversation_row.id
    returning * into conversation_row;
  elsif p_reader_role = 'admin'
        and (select private.current_owner_id()) = conversation_row.owner_id then
    update public.customer_conversations
    set admin_unread_count = 0, updated_at = now()
    where id = conversation_row.id
    returning * into conversation_row;
  else
    raise exception 'You cannot mark this customer conversation as read';
  end if;

  return conversation_row;
end
$$;

revoke all on function public.mark_conversation_read(uuid, text)
  from public, anon;
grant execute on function public.mark_conversation_read(uuid, text)
  to authenticated;

-- Include the customer name in every new admin order notification.
create or replace function public.notify_customer_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_name text;
begin
  if tg_op = 'INSERT' then
    if private.workflow_boolean(new.owner_id, 'adminOrderNotifications', true) then
      select name into customer_name
      from public.customers
      where owner_id = new.owner_id and id = new.customer_id
      limit 1;

      insert into public.customer_notifications (
        owner_id, audience, type, title, detail, order_id
      ) values (
        new.owner_id,
        'admin',
        'order',
        concat('New order from ', coalesce(customer_name, 'customer')),
        concat(
          coalesce(customer_name, 'A customer'),
          ' ordered ', new.quantity, ' x ', new.bottle_type, '.'
        ),
        new.id
      );
    end if;

    if new.status = 'accepted' then
      insert into public.customer_notifications (
        owner_id, auth_user_id, audience, type, title, detail, order_id
      ) values (
        new.owner_id,
        new.auth_user_id,
        'customer',
        'order',
        'Your order was accepted',
        'Himaliya Spring Water automatically accepted your delivery request.',
        new.id
      );
    end if;
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.customer_notifications (
      owner_id, auth_user_id, audience, type, title, detail, order_id
    ) values (
      new.owner_id,
      new.auth_user_id,
      'customer',
      'order',
      case new.status
        when 'accepted' then 'Your order was accepted'
        when 'delivered' then 'Your order was delivered'
        when 'rejected' then 'Your order was rejected'
        when 'canceled' then 'Your order was canceled'
        else 'Your order status changed'
      end,
      case new.status
        when 'accepted' then 'Himaliya Spring Water accepted your delivery request.'
        when 'delivered' then 'Your water delivery has been marked delivered.'
        when 'rejected' then coalesce(nullif(new.admin_note, ''), 'The team could not accept this order.')
        when 'canceled' then 'This order has been canceled.'
        else concat('Current status: ', new.status)
      end,
      new.id
    );
  end if;

  return new;
end
$$;

revoke all on function public.notify_customer_order()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
