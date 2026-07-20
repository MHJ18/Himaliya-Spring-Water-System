begin;

create table if not exists public.bottle_prices (
  bottle_type text not null,
  price numeric not null default 0,
  updated_at timestamptz not null default now(),
  owner_id uuid not null default private.current_owner_id()
    references auth.users(id) on delete cascade,
  constraint bottle_prices_pkey primary key (owner_id, bottle_type)
);

alter table public.bottle_prices enable row level security;

drop policy if exists "Owner bottle price access" on public.bottle_prices;
create policy "Owner bottle price access" on public.bottle_prices
for all to authenticated
using (owner_id = (select private.current_owner_id()))
with check (owner_id = (select private.current_owner_id()));

drop policy if exists "Active admins manage bottle prices" on public.bottle_prices;
create policy "Active admins manage bottle prices" on public.bottle_prices
for all to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));

drop policy if exists "Customers read business bottle prices" on public.bottle_prices;
create policy "Customers read business bottle prices" on public.bottle_prices
for select to authenticated
using (true);

create or replace function public.get_business_bottle_prices()
returns table (bottle_type text, price numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (prices.bottle_type)
    prices.bottle_type,
    prices.price
  from public.bottle_prices as prices
  order by prices.bottle_type, prices.updated_at desc nulls last;
$$;

revoke all on table public.bottle_prices from anon;
grant select, insert, update, delete on table public.bottle_prices to authenticated;
revoke all on function public.get_business_bottle_prices() from public, anon;
grant execute on function public.get_business_bottle_prices() to authenticated;

notify pgrst, 'reload schema';

commit;
