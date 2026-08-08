begin;

-- Web Push endpoints for the browser/PWA clients (admins, riders, customers).
-- The Expo rider app keeps using public.rider_devices; this table is for the
-- W3C Push API subscriptions that a service worker produces, which is the only
-- way a phone can receive a notification while the site is closed.

-- Resolve the business a signed-in user belongs to, whichever role they hold.
create or replace function private.current_push_owner_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select owner_id from public.admin_profiles
      where auth_user_id = (select auth.uid()) and active = true limit 1),
    (select owner_id from public.customers
      where auth_user_id = (select auth.uid()) and active = true limit 1)
  )
$$;

revoke all on function private.current_push_owner_id() from public, anon;
grant execute on function private.current_push_owner_id() to authenticated;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  -- Subqueries are not allowed in a DEFAULT expression, so these are plain
  -- function calls; RLS still pins both columns on insert.
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  owner_id uuid not null default private.current_push_owner_id(),
  -- The endpoint is the push service URL and is globally unique per browser
  -- install, which makes it the natural conflict target for re-subscribes.
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  platform text not null default 'desktop'
    check (platform in ('android', 'ios', 'desktop')),
  user_agent text,
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_owner_active_idx
  on public.push_subscriptions (owner_id, active, updated_at desc);
create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id, active);

alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from public, anon;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;

-- A device may only ever manage its own subscription rows.
drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions" on public.push_subscriptions
for all to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and owner_id = (select private.current_push_owner_id())
);

-- Admins need to read the endpoints of their own business to send to them.
-- Read only: an admin must not be able to forge or retarget a subscription.
drop policy if exists "Admins read business push subscriptions" on public.push_subscriptions;
create policy "Admins read business push subscriptions" on public.push_subscriptions
for select to authenticated
using (
  (select private.is_active_admin())
  and owner_id = (select private.current_owner_id())
);

create or replace function public.touch_push_subscription()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

revoke all on function public.touch_push_subscription() from public, anon, authenticated;

drop trigger if exists push_subscriptions_touch on public.push_subscriptions;
create trigger push_subscriptions_touch
before update on public.push_subscriptions
for each row execute function public.touch_push_subscription();

-- Deliberately outside the owner reset: rows hang off auth.users, which the
-- reset preserves, so a team that resets business data keeps its devices
-- subscribed. Rows disappear only when the auth user is deleted.
comment on table public.push_subscriptions is
  'Web Push endpoints per browser install. Survives the owner database reset; removed with the auth user.';

commit;
