-- Portal customers belong to the configured business owner, not the
-- currently authenticated admin profile. Customer sessions do not have an
-- admin_profiles row, so current_owner_id() returns NULL for them.

begin;

create or replace function private.default_owner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(owner_id, auth_user_id)
  from public.admin_profiles
  where role = 'Owner' and active = true
  order by created_at asc
  limit 1
$$;

revoke all on function private.default_owner_id() from public, anon;
grant execute on function private.default_owner_id() to authenticated;

alter table public.customers
  alter column owner_id set default private.default_owner_id();

create or replace function private.assign_portal_customer_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is null then
    new.owner_id := private.default_owner_id();
  end if;

  if new.owner_id is null then
    raise exception 'An active Owner administrator is required before customers can sign up';
  end if;

  return new;
end
$$;

revoke all on function private.assign_portal_customer_owner() from public, anon, authenticated;

drop trigger if exists customers_assign_portal_owner on public.customers;
create trigger customers_assign_portal_owner
before insert on public.customers
for each row execute function private.assign_portal_customer_owner();

drop policy if exists "Customers create own canonical account" on public.customers;
create policy "Customers create own canonical account" on public.customers
for insert to authenticated
with check (
  auth_user_id = (select auth.uid())
  and owner_id = (select private.default_owner_id())
);

notify pgrst, 'reload schema';

commit;
