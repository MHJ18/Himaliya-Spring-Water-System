-- Keep customer identities and administrator identities mutually exclusive.
-- Admin creation also performs a server-side check, but these triggers are the
-- final authority for every write path, including direct REST and SQL writes.

begin;

-- Remove admin access accidentally granted to an existing customer identity.
-- Preserve a sole active Owner so this migration can never lock the business
-- out; in that exceptional case the customer login link is removed instead.
delete from public.admin_profiles as admin
using public.customers as customer
where customer.auth_user_id is not null
  and admin.auth_user_id = customer.auth_user_id
  and not (
    admin.role = 'Owner'
    and admin.active = true
    and (
      select count(*)
      from public.admin_profiles as owner_profile
      where owner_profile.role = 'Owner'
        and owner_profile.active = true
    ) = 1
  );

update public.customers as customer
set auth_user_id = null,
    source = case when customer.source = 'portal' then 'admin' else customer.source end,
    updated_at = now()
where customer.auth_user_id is not null
  and exists (
    select 1
    from public.admin_profiles as admin
    where admin.auth_user_id = customer.auth_user_id
  );

create or replace function private.prevent_admin_customer_identity_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.auth_user_id is not null and exists (
    select 1
    from public.customers as customer
    where customer.auth_user_id = new.auth_user_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'Customer accounts cannot be granted administrator access.';
  end if;

  if coalesce(trim(new.email), '') <> '' and exists (
    select 1
    from public.customers as customer
    where coalesce(trim(customer.email), '') <> ''
      and lower(trim(customer.email)) = lower(trim(new.email))
  ) then
    raise exception using
      errcode = '23514',
      message = 'This email already belongs to a customer account.';
  end if;

  return new;
end
$$;

create or replace function private.prevent_customer_admin_identity_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.auth_user_id is not null and exists (
    select 1
    from public.admin_profiles as admin
    where admin.auth_user_id = new.auth_user_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'Administrator accounts cannot be registered as customers.';
  end if;

  if coalesce(trim(new.email), '') <> '' and exists (
    select 1
    from public.admin_profiles as admin
    where coalesce(trim(admin.email), '') <> ''
      and lower(trim(admin.email)) = lower(trim(new.email))
  ) then
    raise exception using
      errcode = '23514',
      message = 'This email already belongs to an administrator account.';
  end if;

  return new;
end
$$;

revoke all on function private.prevent_admin_customer_identity_overlap()
  from public, anon, authenticated;
revoke all on function private.prevent_customer_admin_identity_overlap()
  from public, anon, authenticated;

drop trigger if exists admin_profiles_prevent_customer_identity
  on public.admin_profiles;
create trigger admin_profiles_prevent_customer_identity
before insert or update of auth_user_id, email
on public.admin_profiles
for each row execute function private.prevent_admin_customer_identity_overlap();

drop trigger if exists customers_prevent_admin_identity
  on public.customers;
create trigger customers_prevent_admin_identity
before insert or update of auth_user_id, email
on public.customers
for each row execute function private.prevent_customer_admin_identity_overlap();

notify pgrst, 'reload schema';

commit;

select
  count(*) filter (where customer.auth_user_id is not null) as remaining_identity_overlaps
from public.customers as customer
join public.admin_profiles as admin
  on admin.auth_user_id = customer.auth_user_id;
