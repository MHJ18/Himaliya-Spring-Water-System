begin;

create table if not exists public.customer_bottle_prices (
  owner_id uuid not null default private.current_owner_id() references auth.users(id) on delete cascade,
  customer_id text not null,
  bottle_type text not null,
  price numeric(12,2) not null check (price >= 0),
  updated_at timestamptz not null default now(),
  primary key (owner_id, customer_id, bottle_type),
  foreign key (owner_id, customer_id)
    references public.customers (owner_id, id) on delete cascade
);

alter table public.customer_bottle_prices enable row level security;

drop policy if exists "Admins manage customer bottle prices" on public.customer_bottle_prices;
create policy "Admins manage customer bottle prices" on public.customer_bottle_prices
for all to authenticated
using (owner_id = (select private.current_owner_id()))
with check (owner_id = (select private.current_owner_id()));

drop policy if exists "Customers read own bottle prices" on public.customer_bottle_prices;
create policy "Customers read own bottle prices" on public.customer_bottle_prices
for select to authenticated
using (
  exists (
    select 1
    from public.customers as customer
    where customer.owner_id = customer_bottle_prices.owner_id
      and customer.id = customer_bottle_prices.customer_id
      and customer.auth_user_id = (select auth.uid())
  )
);

grant select, insert, update, delete on table public.customer_bottle_prices to authenticated;

notify pgrst, 'reload schema';

commit;
