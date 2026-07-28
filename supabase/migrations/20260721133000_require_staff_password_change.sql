begin;

alter table public.admin_profiles
  add column if not exists must_change_password boolean not null default false;

alter table public.admin_profiles
  alter column must_change_password set default true;

create or replace function private.current_owner_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select owner_id from public.admin_profiles
  where auth_user_id = (select auth.uid())
    and active = true
    and role <> 'Rider'
    and must_change_password = false
  limit 1
$$;

create or replace function private.is_active_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.admin_profiles
    where auth_user_id = (select auth.uid())
      and active = true
      and role <> 'Rider'
      and must_change_password = false
  )
$$;

create or replace function private.current_rider_profile_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select id from public.admin_profiles
  where auth_user_id = (select auth.uid())
    and active = true
    and role = 'Rider'
    and must_change_password = false
  limit 1
$$;

create or replace function private.current_rider_owner_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select owner_id from public.admin_profiles
  where auth_user_id = (select auth.uid())
    and active = true
    and role = 'Rider'
    and must_change_password = false
  limit 1
$$;

revoke all on function private.current_owner_id(), private.is_active_admin(),
  private.current_rider_profile_id(), private.current_rider_owner_id()
  from public, anon;
grant execute on function private.current_owner_id(), private.is_active_admin(),
  private.current_rider_profile_id(), private.current_rider_owner_id()
  to authenticated;

drop policy if exists "Staff read own profile" on public.admin_profiles;
create policy "Staff read own profile" on public.admin_profiles
for select to authenticated
using (auth_user_id = (select auth.uid()) and active = true);

create or replace function public.complete_staff_password_change()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  update public.admin_profiles
  set must_change_password = false
  where auth_user_id = (select auth.uid())
    and active = true;

  if not found then
    raise exception 'Active staff profile not found';
  end if;

  return true;
end
$$;

revoke all on function public.complete_staff_password_change() from public, anon;
grant execute on function public.complete_staff_password_change() to authenticated;

notify pgrst, 'reload schema';

commit;
