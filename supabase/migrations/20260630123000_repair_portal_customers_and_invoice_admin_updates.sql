-- Repair customer portal linking and invoice admin updates.
-- Safe to run more than once. Preserves existing customer, invoice, and sales data.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter table public.customers
  add column if not exists source text not null default 'admin';

alter table public.customers
  drop constraint if exists customers_source_check;

alter table public.customers
  add constraint customers_source_check
  check (source in ('admin', 'portal', 'both'));

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

revoke all on function private.default_owner_id() from public, anon;
revoke all on function private.current_owner_id() from public, anon;
grant execute on function private.default_owner_id() to authenticated;
grant execute on function private.current_owner_id() to authenticated;

create or replace function public.link_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_customer_id text;
  normalized_profile_phone text;
begin
  if new.owner_id is null then
    new.owner_id := private.default_owner_id();
  end if;

  normalized_profile_phone := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');

  select customer.id
    into matched_customer_id
  from public.customers as customer
  where customer.owner_id = new.owner_id
    and (
      (
        normalized_profile_phone <> ''
        and regexp_replace(coalesce(customer.phone, ''), '\D', '', 'g') = normalized_profile_phone
      )
      or (
        coalesce(new.email, '') <> ''
        and coalesce(customer.email, '') <> ''
        and lower(customer.email) = lower(new.email)
      )
      or customer.id = new.id::text
    )
  order by customer.created_at asc
  limit 1;

  if matched_customer_id is null then
    matched_customer_id := new.id::text;

    insert into public.customers (
      id,
      owner_id,
      name,
      phone,
      address,
      email,
      photo,
      source,
      created_at
    )
    values (
      matched_customer_id,
      new.owner_id,
      new.name,
      coalesce(new.phone, ''),
      coalesce(new.address, ''),
      lower(coalesce(new.email, '')),
      '',
      'portal',
      coalesce(new.created_at, now())
    );
  else
    update public.customers
    set name = coalesce(nullif(public.customers.name, ''), new.name),
        phone = coalesce(nullif(public.customers.phone, ''), coalesce(new.phone, '')),
        address = coalesce(nullif(public.customers.address, ''), coalesce(new.address, '')),
        email = coalesce(nullif(public.customers.email, ''), lower(coalesce(new.email, ''))),
        source = case
          when public.customers.source = 'admin' then 'both'
          else public.customers.source
        end
    where public.customers.owner_id = new.owner_id
      and public.customers.id = matched_customer_id;
  end if;

  new.linked_customer_id := matched_customer_id;
  new.updated_at := now();
  return new;
exception
  when unique_violation then
    select customer.id
      into matched_customer_id
    from public.customers as customer
    where customer.owner_id = new.owner_id
      and (
        customer.id = new.id::text
        or (
          normalized_profile_phone <> ''
          and regexp_replace(coalesce(customer.phone, ''), '\D', '', 'g') = normalized_profile_phone
        )
        or (
          coalesce(new.email, '') <> ''
          and coalesce(customer.email, '') <> ''
          and lower(customer.email) = lower(new.email)
        )
      )
    order by customer.created_at asc
    limit 1;

    if matched_customer_id is null then
      raise;
    end if;

    new.linked_customer_id := matched_customer_id;
    new.updated_at := now();
    return new;
end
$$;

revoke all on function public.link_customer_profile() from public, anon, authenticated;

drop trigger if exists customer_profiles_link_before_write on public.customer_profiles;
create trigger customer_profiles_link_before_write
before insert or update on public.customer_profiles
for each row execute function public.link_customer_profile();

do $$
declare
  profile_record record;
  matched_customer_id text;
  normalized_profile_phone text;
begin
  for profile_record in
    select profile.*
    from public.customer_profiles as profile
    where profile.linked_customer_id is null
       or not exists (
         select 1
         from public.customers as customer
         where customer.owner_id = profile.owner_id
           and customer.id = profile.linked_customer_id
       )
  loop
    normalized_profile_phone := regexp_replace(coalesce(profile_record.phone, ''), '\D', '', 'g');
    matched_customer_id := null;

    select customer.id
      into matched_customer_id
    from public.customers as customer
    where customer.owner_id = profile_record.owner_id
      and (
        (
          normalized_profile_phone <> ''
          and regexp_replace(coalesce(customer.phone, ''), '\D', '', 'g') = normalized_profile_phone
        )
        or (
          coalesce(profile_record.email, '') <> ''
          and coalesce(customer.email, '') <> ''
          and lower(customer.email) = lower(profile_record.email)
        )
        or customer.id = profile_record.id::text
      )
    order by customer.created_at asc
    limit 1;

    if matched_customer_id is null then
      matched_customer_id := profile_record.id::text;

      begin
        insert into public.customers (
          id,
          owner_id,
          name,
          phone,
          address,
          email,
          photo,
          source,
          created_at
        )
        values (
          matched_customer_id,
          profile_record.owner_id,
          profile_record.name,
          coalesce(profile_record.phone, ''),
          coalesce(profile_record.address, ''),
          lower(coalesce(profile_record.email, '')),
          '',
          'portal',
          coalesce(profile_record.created_at, now())
        );
      exception
        when unique_violation then
          select customer.id
            into matched_customer_id
          from public.customers as customer
          where customer.owner_id = profile_record.owner_id
            and (
              customer.id = profile_record.id::text
              or (
                normalized_profile_phone <> ''
                and regexp_replace(coalesce(customer.phone, ''), '\D', '', 'g') = normalized_profile_phone
              )
              or (
                coalesce(profile_record.email, '') <> ''
                and coalesce(customer.email, '') <> ''
                and lower(customer.email) = lower(profile_record.email)
              )
            )
          order by customer.created_at asc
          limit 1;
      end;
    end if;

    update public.customers
    set source = case
          when public.customers.source = 'admin' then 'both'
          else public.customers.source
        end,
        email = coalesce(nullif(public.customers.email, ''), lower(coalesce(profile_record.email, ''))),
        address = coalesce(nullif(public.customers.address, ''), coalesce(profile_record.address, ''))
    where public.customers.owner_id = profile_record.owner_id
      and public.customers.id = matched_customer_id;

    update public.customer_profiles
    set linked_customer_id = matched_customer_id,
        updated_at = now()
    where id = profile_record.id;
  end loop;
end
$$;

update public.customers as customer
set source = case
      when customer.source = 'admin' then 'both'
      else customer.source
    end
from public.customer_profiles as profile
where profile.owner_id = customer.owner_id
  and profile.linked_customer_id = customer.id;

alter table public.customer_invoices
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists validated boolean not null default false;

alter table public.customer_invoices
  alter column payment_status set default 'unpaid',
  alter column validated set default false;

update public.customer_invoices
set payment_status = 'unpaid'
where payment_status is null or payment_status = '';

update public.customer_invoices
set validated = false
where validated is null;

drop policy if exists "Owner customer invoices access" on public.customer_invoices;
drop policy if exists "Admins manage customer invoices" on public.customer_invoices;
create policy "Admins manage customer invoices" on public.customer_invoices
for all
to authenticated
using (owner_id = (select private.current_owner_id()))
with check (owner_id = (select private.current_owner_id()));

drop policy if exists "Customers read own paid invoices" on public.customer_invoices;
drop policy if exists "Customers read own invoices" on public.customer_invoices;
create policy "Customers read own invoices" on public.customer_invoices
for select
to authenticated
using (
  exists (
    select 1
    from public.customer_profiles as profile
    where profile.owner_id = customer_invoices.owner_id
      and profile.auth_user_id = (select auth.uid())
      and (
        profile.linked_customer_id = customer_invoices.customer_id
        or profile.id::text = customer_invoices.customer_id
      )
  )
);

grant select, insert, update, delete on table public.customer_invoices to authenticated;
grant select, insert, update, delete on table public.customer_profiles to authenticated;
grant select, insert, update, delete on table public.customers to authenticated;

select
  'schema repair completed' as status,
  (select count(*) from public.customer_profiles) as customer_profiles,
  (select count(*) from public.customer_profiles where linked_customer_id is null) as unlinked_profiles,
  (select count(*) from public.customers where source in ('portal', 'both')) as linked_app_customers,
  (select count(*) from public.customer_invoices) as customer_invoices;
