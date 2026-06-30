create or replace function private.current_admin_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select profile.role
  from public.admin_profiles as profile
  where profile.auth_user_id = (select auth.uid())
    and profile.active = true
  limit 1
$$;

revoke all on function private.current_admin_role() from public, anon;
grant execute on function private.current_admin_role() to authenticated;

drop policy if exists "Owner admin profile access" on public.admin_profiles;
drop policy if exists "Active admins view profiles" on public.admin_profiles;
drop policy if exists "Owners create profiles" on public.admin_profiles;
drop policy if exists "Owners update profiles" on public.admin_profiles;
drop policy if exists "Owners delete profiles" on public.admin_profiles;
drop policy if exists "Business admins can view profiles" on public.admin_profiles;
drop policy if exists "Owners can create profiles" on public.admin_profiles;
drop policy if exists "Owners can update profiles" on public.admin_profiles;
drop policy if exists "Owners can delete profiles" on public.admin_profiles;

create policy "Business admins can view profiles" on public.admin_profiles
for select to authenticated
using (owner_id = (select private.current_owner_id()));

create policy "Owners can create profiles" on public.admin_profiles
for insert to authenticated
with check (
  owner_id = (select private.current_owner_id())
  and (select private.current_admin_role()) = 'Owner'
);

create policy "Owners can update profiles" on public.admin_profiles
for update to authenticated
using (
  owner_id = (select private.current_owner_id())
  and (select private.current_admin_role()) = 'Owner'
)
with check (
  owner_id = (select private.current_owner_id())
  and (select private.current_admin_role()) = 'Owner'
);

create policy "Owners can delete profiles" on public.admin_profiles
for delete to authenticated
using (
  owner_id = (select private.current_owner_id())
  and (select private.current_admin_role()) = 'Owner'
);
