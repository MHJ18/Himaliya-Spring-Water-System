create schema if not exists private;

create or replace function private.default_owner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select auth_user_id
  from public.admin_profiles
  where role = 'Owner' and active = true
  order by created_at asc
  limit 1
$$;

revoke all on function private.default_owner_id() from public, anon;
grant execute on function private.default_owner_id() to authenticated;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default private.default_owner_id() references auth.users(id),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  linked_customer_id text,
  name text not null,
  email text not null,
  phone text not null,
  address text not null default '',
  company_name text not null default 'Himaliya Spring Water',
  contract_label text not null default 'Monthly 19L water delivery contract',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_profiles_auth_user_key unique (auth_user_id),
  constraint customer_profiles_owner_customer_fkey
    foreign key (owner_id, linked_customer_id)
    references public.customers (owner_id, id)
    on delete set null
);

create index if not exists customer_profiles_owner_created_idx
  on public.customer_profiles (owner_id, created_at desc);

create index if not exists customer_profiles_auth_user_idx
  on public.customer_profiles (auth_user_id);

create or replace function public.link_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is null then
    new.owner_id := private.default_owner_id();
  end if;

  if new.linked_customer_id is null then
    select c.id into new.linked_customer_id
    from public.customers c
    where c.owner_id = new.owner_id
      and (
        lower(c.email) = lower(new.email)
        or regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = regexp_replace(coalesce(new.phone, ''), '\D', '', 'g')
      )
    order by c.created_at asc
    limit 1;
  end if;

  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists customer_profiles_link_before_write on public.customer_profiles;
create trigger customer_profiles_link_before_write
before insert or update on public.customer_profiles
for each row execute function public.link_customer_profile();

revoke all on function public.link_customer_profile() from public, anon, authenticated;

create table if not exists public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default private.default_owner_id() references auth.users(id),
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  auth_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  linked_customer_id text,
  quantity integer not null default 1 check (quantity > 0),
  bottle_type text not null default '19L Gallon',
  delivery_address text not null,
  delivery_date date,
  notes text not null default '',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'delivered', 'canceled', 'rejected')),
  admin_note text not null default '',
  accepted_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_orders_owner_customer_fkey
    foreign key (owner_id, linked_customer_id)
    references public.customers (owner_id, id)
    on delete set null
);

create index if not exists customer_orders_owner_status_created_idx
  on public.customer_orders (owner_id, status, created_at desc);

create index if not exists customer_orders_auth_user_created_idx
  on public.customer_orders (auth_user_id, created_at desc);

create table if not exists public.customer_notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  auth_user_id uuid references auth.users(id) on delete cascade,
  audience text not null check (audience in ('admin', 'customer')),
  type text not null default 'order',
  title text not null,
  detail text not null default '',
  order_id uuid references public.customer_orders(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists customer_notifications_owner_created_idx
  on public.customer_notifications (owner_id, audience, created_at desc);

create index if not exists customer_notifications_auth_created_idx
  on public.customer_notifications (auth_user_id, audience, created_at desc);

create or replace function public.prepare_customer_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_row public.customer_profiles;
begin
  select * into profile_row
  from public.customer_profiles
  where id = new.customer_profile_id
    and auth_user_id = (select auth.uid())
  limit 1;

  if profile_row.id is null then
    raise exception 'Customer profile not found for this user';
  end if;

  new.owner_id := profile_row.owner_id;
  new.auth_user_id := profile_row.auth_user_id;
  new.linked_customer_id := profile_row.linked_customer_id;
  new.updated_at := now();

  if new.delivery_address is null or length(trim(new.delivery_address)) = 0 then
    new.delivery_address := profile_row.address;
  end if;

  return new;
end
$$;

drop trigger if exists customer_orders_prepare_before_insert on public.customer_orders;
create trigger customer_orders_prepare_before_insert
before insert on public.customer_orders
for each row execute function public.prepare_customer_order();

revoke all on function public.prepare_customer_order() from public, anon, authenticated;

create or replace function public.notify_customer_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.customer_notifications (
      owner_id, audience, type, title, detail, order_id
    ) values (
      new.owner_id,
      'admin',
      'order',
      'New customer order',
      concat('A customer placed an order for ', new.quantity, ' ', new.bottle_type, '.'),
      new.id
    );
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

drop trigger if exists customer_orders_notify_after_insert on public.customer_orders;
create trigger customer_orders_notify_after_insert
after insert on public.customer_orders
for each row execute function public.notify_customer_order();

drop trigger if exists customer_orders_notify_after_update on public.customer_orders;
create trigger customer_orders_notify_after_update
after update on public.customer_orders
for each row execute function public.notify_customer_order();

revoke all on function public.notify_customer_order() from public, anon, authenticated;

alter table public.customer_profiles enable row level security;
alter table public.customer_orders enable row level security;
alter table public.customer_notifications enable row level security;

drop policy if exists "Customers manage own portal profile" on public.customer_profiles;
create policy "Customers manage own portal profile" on public.customer_profiles
for all to authenticated
using (auth_user_id = (select auth.uid()))
with check (auth_user_id = (select auth.uid()));

drop policy if exists "Admins manage customer portal profiles" on public.customer_profiles;
create policy "Admins manage customer portal profiles" on public.customer_profiles
for all to authenticated
using (owner_id = (select private.current_owner_id()))
with check (owner_id = (select private.current_owner_id()));

drop policy if exists "Customers create own orders" on public.customer_orders;
create policy "Customers create own orders" on public.customer_orders
for insert to authenticated
with check (auth_user_id = (select auth.uid()));

drop policy if exists "Customers view own orders" on public.customer_orders;
create policy "Customers view own orders" on public.customer_orders
for select to authenticated
using (auth_user_id = (select auth.uid()));

drop policy if exists "Customers cancel own pending orders" on public.customer_orders;
create policy "Customers cancel own pending orders" on public.customer_orders
for update to authenticated
using (auth_user_id = (select auth.uid()) and status = 'pending')
with check (auth_user_id = (select auth.uid()) and status in ('pending', 'canceled'));

drop policy if exists "Admins manage customer orders" on public.customer_orders;
create policy "Admins manage customer orders" on public.customer_orders
for all to authenticated
using (owner_id = (select private.current_owner_id()))
with check (owner_id = (select private.current_owner_id()));

drop policy if exists "Customers read own notifications" on public.customer_notifications;
create policy "Customers read own notifications" on public.customer_notifications
for select to authenticated
using (audience = 'customer' and auth_user_id = (select auth.uid()));

drop policy if exists "Customers mark own notifications" on public.customer_notifications;
create policy "Customers mark own notifications" on public.customer_notifications
for update to authenticated
using (audience = 'customer' and auth_user_id = (select auth.uid()))
with check (audience = 'customer' and auth_user_id = (select auth.uid()));

drop policy if exists "Admins manage customer notifications" on public.customer_notifications;
create policy "Admins manage customer notifications" on public.customer_notifications
for all to authenticated
using (owner_id = (select private.current_owner_id()))
with check (owner_id = (select private.current_owner_id()));

alter table public.customer_invoices
  add column if not exists payment_status text not null default 'paid';

drop policy if exists "Customers read own paid invoices" on public.customer_invoices;
create policy "Customers read own paid invoices" on public.customer_invoices
for select to authenticated
using (
  payment_status = 'paid'
  and exists (
    select 1
    from public.customer_profiles profile
    where profile.owner_id = customer_invoices.owner_id
      and profile.linked_customer_id = customer_invoices.customer_id
      and profile.auth_user_id = (select auth.uid())
  )
);

revoke all on table public.customer_profiles, public.customer_orders, public.customer_notifications from anon;
grant select, insert, update on table public.customer_profiles, public.customer_orders, public.customer_notifications to authenticated;
grant select on table public.customer_invoices to authenticated;

notify pgrst, 'reload schema';
