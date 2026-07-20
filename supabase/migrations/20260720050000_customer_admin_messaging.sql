-- Two-way messaging between admins and customer portal accounts.

begin;

create table if not exists public.customer_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default private.default_owner_id() references auth.users(id),
  customer_id text not null,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  last_message_at timestamptz,
  last_message_preview text not null default '',
  last_sender_role text not null default 'customer'
    check (last_sender_role in ('admin', 'customer')),
  admin_unread_count integer not null default 0 check (admin_unread_count >= 0),
  customer_unread_count integer not null default 0 check (customer_unread_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_conversations_owner_customer_fkey
    foreign key (owner_id, customer_id)
    references public.customers (owner_id, id)
    on delete cascade,
  constraint customer_conversations_owner_customer_key unique (owner_id, customer_id)
);

create index if not exists customer_conversations_owner_last_message_idx
  on public.customer_conversations (owner_id, last_message_at desc nulls last);

create index if not exists customer_conversations_auth_user_idx
  on public.customer_conversations (auth_user_id, last_message_at desc nulls last);

create table if not exists public.customer_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.customer_conversations(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  sender_role text not null check (sender_role in ('admin', 'customer')),
  sender_auth_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists customer_messages_conversation_created_idx
  on public.customer_messages (conversation_id, created_at asc);

create index if not exists customer_messages_owner_created_idx
  on public.customer_messages (owner_id, created_at desc);

create or replace function public.prepare_customer_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversation_row public.customer_conversations;
  preview text;
begin
  select * into conversation_row
  from public.customer_conversations
  where id = new.conversation_id
  limit 1;

  if conversation_row.id is null then
    raise exception 'Conversation not found';
  end if;

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
    raise exception 'Invalid sender role';
  end if;

  update public.customer_conversations
  set
    last_message_at = now(),
    last_message_preview = preview,
    last_sender_role = new.sender_role,
    admin_unread_count = case
      when new.sender_role = 'customer' then admin_unread_count + 1
      else admin_unread_count
    end,
    customer_unread_count = case
      when new.sender_role = 'admin' then customer_unread_count + 1
      else customer_unread_count
    end,
    updated_at = now()
  where id = conversation_row.id;

  if new.sender_role = 'customer' then
    insert into public.customer_notifications (
      owner_id, audience, type, title, detail
    ) values (
      conversation_row.owner_id,
      'admin',
      'message',
      'New customer message',
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

drop trigger if exists customer_messages_prepare on public.customer_messages;
create trigger customer_messages_prepare
before insert on public.customer_messages
for each row execute function public.prepare_customer_message();

revoke all on function public.prepare_customer_message() from public, anon, authenticated;

create or replace function public.open_customer_conversation()
returns public.customer_conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_row public.customers;
  conversation_row public.customer_conversations;
begin
  select * into customer_row
  from public.customers
  where auth_user_id = (select auth.uid())
    and active = true
  limit 1;

  if customer_row.id is null then
    raise exception 'Customer account not found';
  end if;

  select * into conversation_row
  from public.customer_conversations
  where owner_id = customer_row.owner_id
    and customer_id = customer_row.id
  limit 1;

  if conversation_row.id is null then
    insert into public.customer_conversations (
      owner_id, customer_id, auth_user_id
    ) values (
      customer_row.owner_id, customer_row.id, customer_row.auth_user_id
    )
    returning * into conversation_row;
  end if;

  return conversation_row;
end
$$;

revoke all on function public.open_customer_conversation() from public, anon;
grant execute on function public.open_customer_conversation() to authenticated;

create or replace function public.open_admin_customer_conversation(p_customer_id text)
returns public.customer_conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_uuid uuid := (select private.current_owner_id());
  customer_row public.customers;
  conversation_row public.customer_conversations;
begin
  if owner_uuid is null then
    raise exception 'Admin access required';
  end if;

  select * into customer_row
  from public.customers
  where owner_id = owner_uuid
    and id = p_customer_id
    and auth_user_id is not null
    and active = true
  limit 1;

  if customer_row.id is null then
    raise exception 'Customer portal account not found';
  end if;

  select * into conversation_row
  from public.customer_conversations
  where owner_id = owner_uuid
    and customer_id = customer_row.id
  limit 1;

  if conversation_row.id is null then
    insert into public.customer_conversations (
      owner_id, customer_id, auth_user_id
    ) values (
      owner_uuid, customer_row.id, customer_row.auth_user_id
    )
    returning * into conversation_row;
  end if;

  return conversation_row;
end
$$;

revoke all on function public.open_admin_customer_conversation(text) from public, anon;
grant execute on function public.open_admin_customer_conversation(text) to authenticated;

create or replace function public.mark_conversation_read(p_conversation_id uuid, p_reader_role text)
returns public.customer_conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversation_row public.customer_conversations;
begin
  select * into conversation_row
  from public.customer_conversations
  where id = p_conversation_id
  limit 1;

  if conversation_row.id is null then
    raise exception 'Conversation not found';
  end if;

  if p_reader_role = 'customer' then
    if conversation_row.auth_user_id is distinct from (select auth.uid()) then
      raise exception 'You can only open your own conversation';
    end if;
    update public.customer_conversations
    set customer_unread_count = 0, updated_at = now()
    where id = conversation_row.id
    returning * into conversation_row;
  elsif p_reader_role = 'admin' then
    if (select private.current_owner_id()) is distinct from conversation_row.owner_id then
      raise exception 'Admin access required';
    end if;
    update public.customer_conversations
    set admin_unread_count = 0, updated_at = now()
    where id = conversation_row.id
    returning * into conversation_row;
  else
    raise exception 'Invalid reader role';
  end if;

  return conversation_row;
end
$$;

revoke all on function public.mark_conversation_read(uuid, text) from public, anon;
grant execute on function public.mark_conversation_read(uuid, text) to authenticated;

alter table public.customer_conversations enable row level security;
alter table public.customer_messages enable row level security;

drop policy if exists "Admins manage conversations" on public.customer_conversations;
create policy "Admins manage conversations" on public.customer_conversations
for all to authenticated
using (owner_id = (select private.current_owner_id()))
with check (owner_id = (select private.current_owner_id()));

drop policy if exists "Customers read own conversations" on public.customer_conversations;
create policy "Customers read own conversations" on public.customer_conversations
for select to authenticated
using (auth_user_id = (select auth.uid()));

drop policy if exists "Admins manage messages" on public.customer_messages;
create policy "Admins manage messages" on public.customer_messages
for all to authenticated
using (owner_id = (select private.current_owner_id()))
with check (owner_id = (select private.current_owner_id()));

drop policy if exists "Customers read own messages" on public.customer_messages;
create policy "Customers read own messages" on public.customer_messages
for select to authenticated
using (
  exists (
    select 1
    from public.customer_conversations as conversation
    where conversation.id = customer_messages.conversation_id
      and conversation.auth_user_id = (select auth.uid())
  )
);

drop policy if exists "Customers send own messages" on public.customer_messages;
create policy "Customers send own messages" on public.customer_messages
for insert to authenticated
with check (
  sender_role = 'customer'
  and sender_auth_user_id = (select auth.uid())
  and exists (
    select 1
    from public.customer_conversations as conversation
    where conversation.id = conversation_id
      and conversation.auth_user_id = (select auth.uid())
  )
);

revoke all on table public.customer_conversations, public.customer_messages from anon;
grant select, insert, update, delete on table public.customer_conversations to authenticated;
grant select, insert on table public.customer_messages to authenticated;

notify pgrst, 'reload schema';

commit;
