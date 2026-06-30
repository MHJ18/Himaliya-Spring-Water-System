-- Convert the original single-tenant, authenticated-only schema into an
-- owner-scoped schema. Existing business data is preserved and assigned to
-- the earliest active Owner profile.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter table public.admin_profiles add column if not exists owner_id uuid references auth.users(id);

update public.admin_profiles
set owner_id = auth_user_id
where role = 'Owner' and owner_id is null;

update public.admin_profiles as profile
set owner_id = (
  select owner.auth_user_id
  from public.admin_profiles as owner
  where owner.role = 'Owner' and owner.active = true
  order by owner.created_at asc
  limit 1
)
where profile.owner_id is null;

do $$
begin
  if exists (select 1 from public.admin_profiles where owner_id is null) then
    raise exception 'Cannot secure schema: an active Owner profile is required';
  end if;
end
$$;

alter table public.admin_profiles alter column owner_id set not null;
create index if not exists admin_profiles_owner_id_idx on public.admin_profiles (owner_id);

create or replace function private.current_owner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profile.owner_id
  from public.admin_profiles as profile
  where profile.auth_user_id = (select auth.uid())
    and profile.active = true
  limit 1
$$;

revoke all on function private.current_owner_id() from public, anon;
grant execute on function private.current_owner_id() to authenticated;

alter table public.customers add column if not exists owner_id uuid references auth.users(id);
alter table public.sales add column if not exists owner_id uuid references auth.users(id);
alter table public.bottle_prices add column if not exists owner_id uuid references auth.users(id);
alter table public.app_settings add column if not exists owner_id uuid references auth.users(id);

do $$
declare
  first_owner uuid;
begin
  select auth_user_id into first_owner
  from public.admin_profiles
  where role = 'Owner' and active = true
  order by created_at asc
  limit 1;

  if first_owner is null then
    raise exception 'Cannot backfill business data: an active Owner profile is required';
  end if;

  update public.customers set owner_id = first_owner where owner_id is null;
  update public.sales set owner_id = first_owner where owner_id is null;
  update public.bottle_prices set owner_id = first_owner where owner_id is null;
  update public.app_settings set owner_id = first_owner where owner_id is null;
end
$$;

alter table public.customers alter column owner_id set default private.current_owner_id();
alter table public.sales alter column owner_id set default private.current_owner_id();
alter table public.bottle_prices alter column owner_id set default private.current_owner_id();
alter table public.app_settings alter column owner_id set default private.current_owner_id();

alter table public.customers alter column owner_id set not null;
alter table public.sales alter column owner_id set not null;
alter table public.bottle_prices alter column owner_id set not null;
alter table public.app_settings alter column owner_id set not null;

alter table public.customers drop constraint if exists customers_phone_key;
alter table public.customers add constraint customers_owner_phone_key unique (owner_id, phone);
alter table public.customers add constraint customers_owner_id_key unique (owner_id, id);

alter table public.sales drop constraint if exists sales_customer_id_fkey;
alter table public.sales add constraint sales_owner_customer_fkey
  foreign key (owner_id, customer_id)
  references public.customers (owner_id, id)
  on delete cascade;

alter table public.bottle_prices drop constraint if exists bottle_prices_pkey;
alter table public.bottle_prices add constraint bottle_prices_pkey primary key (owner_id, bottle_type);

alter table public.app_settings drop constraint if exists app_settings_pkey;
alter table public.app_settings add constraint app_settings_pkey primary key (owner_id, id);

create index if not exists customers_owner_created_idx on public.customers (owner_id, created_at desc);
create index if not exists sales_owner_created_idx on public.sales (owner_id, created_at desc);
create index if not exists sales_owner_customer_idx on public.sales (owner_id, customer_id);

alter table public.customers enable row level security;
alter table public.sales enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.bottle_prices enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "Authenticated customers access" on public.customers;
drop policy if exists "Owner customers access" on public.customers;
create policy "Owner customers access" on public.customers
for all to authenticated
using (owner_id = (select private.current_owner_id()))
with check (owner_id = (select private.current_owner_id()));

drop policy if exists "Authenticated sales access" on public.sales;
drop policy if exists "Owner sales access" on public.sales;
create policy "Owner sales access" on public.sales
for all to authenticated
using (owner_id = (select private.current_owner_id()))
with check (owner_id = (select private.current_owner_id()));

drop policy if exists "Authenticated admin profile access" on public.admin_profiles;
drop policy if exists "Owner admin profile access" on public.admin_profiles;
create policy "Owner admin profile access" on public.admin_profiles
for all to authenticated
using (owner_id = (select private.current_owner_id()))
with check (owner_id = (select private.current_owner_id()));

drop policy if exists "Authenticated bottle price access" on public.bottle_prices;
drop policy if exists "Owner bottle price access" on public.bottle_prices;
create policy "Owner bottle price access" on public.bottle_prices
for all to authenticated
using (owner_id = (select private.current_owner_id()))
with check (owner_id = (select private.current_owner_id()));

drop policy if exists "Authenticated settings access" on public.app_settings;
drop policy if exists "Owner settings access" on public.app_settings;
create policy "Owner settings access" on public.app_settings
for all to authenticated
using (owner_id = (select private.current_owner_id()))
with check (owner_id = (select private.current_owner_id()));

revoke all on table public.customers, public.sales, public.admin_profiles,
  public.bottle_prices, public.app_settings from anon;
grant select, insert, update, delete on table public.customers, public.sales,
  public.admin_profiles, public.bottle_prices, public.app_settings to authenticated;
