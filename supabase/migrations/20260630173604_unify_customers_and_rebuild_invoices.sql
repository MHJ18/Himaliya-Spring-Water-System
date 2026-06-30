-- Canonical customer and invoice rebuild.
-- Existing profiles, customers and invoices are migrated before legacy tables are removed.

begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter table public.customers add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
alter table public.customers add column if not exists company_name text not null default 'Himaliya Spring Water';
alter table public.customers add column if not exists contract_label text not null default 'Monthly water delivery contract';
alter table public.customers add column if not exists active boolean not null default true;
alter table public.customers add column if not exists updated_at timestamptz not null default now();
alter table public.customers add column if not exists source text not null default 'admin';
alter table public.customers alter column id set default (gen_random_uuid()::text);

alter table public.customers drop constraint if exists customers_source_check;
alter table public.customers add constraint customers_source_check
  check (source in ('admin', 'portal', 'both'));

create unique index if not exists customers_auth_user_unique
  on public.customers (auth_user_id) where auth_user_id is not null;
create index if not exists customers_owner_source_created_idx
  on public.customers (owner_id, source, created_at desc);

-- Merge every legacy portal profile into the canonical customer row.
do $$
declare
  profile record;
  canonical_id text;
begin
  if to_regclass('public.customer_profiles') is null then
    return;
  end if;

  for profile in select * from public.customer_profiles order by created_at asc loop
    canonical_id := null;

    select customer.id into canonical_id
    from public.customers as customer
    where customer.owner_id = profile.owner_id
      and (
        customer.id = profile.linked_customer_id
        or customer.auth_user_id = profile.auth_user_id
        or (coalesce(profile.email, '') <> '' and lower(customer.email) = lower(profile.email))
        or (
          regexp_replace(coalesce(profile.phone, ''), '\D', '', 'g') <> ''
          and regexp_replace(coalesce(customer.phone, ''), '\D', '', 'g') =
              regexp_replace(coalesce(profile.phone, ''), '\D', '', 'g')
        )
      )
    order by (customer.id = profile.linked_customer_id) desc, customer.created_at asc
    limit 1;

    if canonical_id is null then
      canonical_id := profile.id::text;
      insert into public.customers (
        id, owner_id, auth_user_id, name, email, phone, address, photo,
        source, company_name, contract_label, active, created_at, updated_at
      ) values (
        canonical_id, profile.owner_id, profile.auth_user_id, profile.name,
        lower(coalesce(profile.email, '')), coalesce(profile.phone, ''),
        coalesce(profile.address, ''), '', 'portal', profile.company_name,
        profile.contract_label, profile.active, profile.created_at, profile.updated_at
      );
    else
      update public.customers
      set auth_user_id = profile.auth_user_id,
          name = coalesce(nullif(profile.name, ''), public.customers.name),
          email = coalesce(nullif(lower(profile.email), ''), public.customers.email),
          phone = coalesce(nullif(profile.phone, ''), public.customers.phone),
          address = coalesce(nullif(profile.address, ''), public.customers.address),
          company_name = profile.company_name,
          contract_label = profile.contract_label,
          active = profile.active,
          source = case when public.customers.source = 'admin' then 'both' else 'portal' end,
          updated_at = greatest(public.customers.updated_at, profile.updated_at)
      where owner_id = profile.owner_id and id = canonical_id;
    end if;

    update public.customer_orders
    set linked_customer_id = canonical_id
    where customer_profile_id = profile.id;
  end loop;
end
$$;

-- Orders now point directly at customers. There is no second user/profile table.
alter table public.customer_orders add column if not exists customer_id text;
update public.customer_orders set customer_id = linked_customer_id where customer_id is null;

alter table public.customer_orders drop constraint if exists customer_orders_owner_customer_fkey;
alter table public.customer_orders drop constraint if exists customer_orders_customer_profile_id_fkey;
alter table public.customer_orders drop constraint if exists customer_orders_customer_profile_fkey;
alter table public.customer_orders drop column if exists customer_profile_id;
alter table public.customer_orders drop column if exists linked_customer_id;
alter table public.customer_orders alter column customer_id set not null;
alter table public.customer_orders add constraint customer_orders_owner_customer_fkey
  foreign key (owner_id, customer_id) references public.customers(owner_id, id) on delete cascade;
create index if not exists customer_orders_owner_customer_created_idx
  on public.customer_orders(owner_id, customer_id, created_at desc);

create or replace function public.prepare_customer_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_row public.customers;
begin
  select * into customer_row
  from public.customers
  where auth_user_id = (select auth.uid()) and active = true
  limit 1;

  if customer_row.id is null then
    raise exception 'Customer account not found for this user';
  end if;

  new.owner_id := customer_row.owner_id;
  new.auth_user_id := customer_row.auth_user_id;
  new.customer_id := customer_row.id;
  new.updated_at := now();
  if coalesce(trim(new.delivery_address), '') = '' then
    new.delivery_address := customer_row.address;
  end if;
  return new;
end
$$;
revoke all on function public.prepare_customer_order() from public, anon, authenticated;

-- Rebuild invoices as one authoritative ledger with an auditable payment lifecycle.
drop function if exists public.lookup_invoice_by_number(text);
drop table if exists public.customer_invoices_rebuilt;
create table public.customer_invoices_rebuilt (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default private.current_owner_id() references auth.users(id),
  customer_id text not null,
  invoice_number text not null,
  invoice_date timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  total_qty integer not null default 0 check (total_qty >= 0),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'void')),
  validated boolean not null default false,
  paid_at timestamptz,
  paid_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_invoices_rebuilt_owner_customer_fkey
    foreign key (owner_id, customer_id) references public.customers(owner_id, id) on delete cascade,
  constraint customer_invoices_rebuilt_owner_number_key unique (owner_id, invoice_number)
);

insert into public.customer_invoices_rebuilt (
  id, owner_id, customer_id, invoice_number, invoice_date, payload,
  total_amount, total_qty, payment_status, validated, paid_at, paid_by, created_at, updated_at
)
select invoice.id, invoice.owner_id, invoice.customer_id, invoice.invoice_number,
       invoice.invoice_date, coalesce(invoice.payload, '{}'::jsonb),
       greatest(coalesce(invoice.total_amount, 0), 0), greatest(coalesce(invoice.total_qty, 0), 0),
       case when invoice.payment_status in ('paid', 'void') then invoice.payment_status else 'unpaid' end,
       coalesce(invoice.validated, false),
       case when invoice.payment_status = 'paid' then coalesce(invoice.invoice_date, invoice.created_at) end,
       null, invoice.created_at, coalesce(invoice.created_at, now())
from public.customer_invoices as invoice
where exists (
  select 1 from public.customers customer
  where customer.owner_id = invoice.owner_id and customer.id = invoice.customer_id
);

drop table public.customer_invoices;
alter table public.customer_invoices_rebuilt rename to customer_invoices;
alter table public.customer_invoices rename constraint customer_invoices_rebuilt_owner_customer_fkey to customer_invoices_owner_customer_fkey;
alter table public.customer_invoices rename constraint customer_invoices_rebuilt_owner_number_key to customer_invoices_owner_number_key;
create index customer_invoices_owner_created_idx on public.customer_invoices(owner_id, created_at desc);
create index customer_invoices_customer_created_idx on public.customer_invoices(owner_id, customer_id, created_at desc);

create or replace function public.audit_invoice_payment()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.payment_status is distinct from old.payment_status then
    if new.payment_status = 'paid' then
      new.paid_at := now();
      new.paid_by := (select auth.uid());
    else
      new.paid_at := null;
      new.paid_by := null;
    end if;
  end if;
  new.updated_at := now();
  return new;
end
$$;
create trigger customer_invoices_audit_before_update
before update on public.customer_invoices
for each row execute function public.audit_invoice_payment();

create or replace function public.lookup_invoice_by_number(p_invoice_number text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select invoice.payload || jsonb_build_object(
    'invoice_number', invoice.invoice_number,
    'invoice_date', invoice.invoice_date,
    'total_amount', invoice.total_amount,
    'total_qty', invoice.total_qty,
    'payment_status', invoice.payment_status,
    'validated', invoice.validated
  )
  from public.customer_invoices invoice
  where upper(invoice.invoice_number) = upper(trim(p_invoice_number))
  limit 1
$$;
revoke all on function public.lookup_invoice_by_number(text) from public;
grant execute on function public.lookup_invoice_by_number(text) to anon, authenticated;

-- Remove the obsolete duplicate profile model only after all references are migrated.
drop trigger if exists customer_profiles_link_before_write on public.customer_profiles;
drop function if exists public.link_customer_profile();
drop table if exists public.customer_profiles cascade;

alter table public.customers enable row level security;
alter table public.customer_invoices enable row level security;

drop policy if exists "Owner customers access" on public.customers;
drop policy if exists "Customers manage own canonical account" on public.customers;
create policy "Admins manage business customers" on public.customers
for all to authenticated
using (owner_id = (select private.current_owner_id()))
with check (owner_id = (select private.current_owner_id()));
create policy "Customers read own canonical account" on public.customers
for select to authenticated using (auth_user_id = (select auth.uid()));
create policy "Customers create own canonical account" on public.customers
for insert to authenticated with check (auth_user_id = (select auth.uid()));
create policy "Customers update own canonical account" on public.customers
for update to authenticated
using (auth_user_id = (select auth.uid()))
with check (auth_user_id = (select auth.uid()) and owner_id = private.default_owner_id());

create policy "Admins manage invoices" on public.customer_invoices
for all to authenticated
using (owner_id = (select private.current_owner_id()))
with check (owner_id = (select private.current_owner_id()));
create policy "Customers read own invoices" on public.customer_invoices
for select to authenticated
using (exists (
  select 1 from public.customers customer
  where customer.owner_id = customer_invoices.owner_id
    and customer.id = customer_invoices.customer_id
    and customer.auth_user_id = (select auth.uid())
));

revoke all on table public.customers, public.customer_invoices from anon;
grant select, insert, update, delete on table public.customers, public.customer_invoices to authenticated;

notify pgrst, 'reload schema';
commit;

select
  (select count(*) from public.customers) as canonical_customers,
  (select count(*) from public.customers where auth_user_id is not null) as signed_up_customers,
  (select count(*) from public.customer_invoices where payment_status = 'paid') as paid_invoices,
  (select count(*) from public.customer_invoices where payment_status = 'unpaid') as unpaid_invoices;
