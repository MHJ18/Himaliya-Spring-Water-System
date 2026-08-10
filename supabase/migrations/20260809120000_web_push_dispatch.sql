begin;

-- Turn every new notification into a real Web Push delivery.
--
-- public.customer_notifications is already the single choke point for every
-- alert the app raises (orders, deliveries, payments, messages, overdue
-- invoices). Rows land here whether the recipient's browser is open or not, so
-- it is the natural place to fan out background push. This migration adds an
-- after-insert trigger that hands the new row's id to the send-push Edge
-- Function over pg_net; that function does the VAPID signing and per-endpoint
-- encryption the database cannot.
--
-- Nothing here embeds a URL or key: both live in a locked-down config row so the
-- same migration runs in every environment and the trigger simply no-ops until
-- an operator points it at a deployed function.

create schema if not exists private;
create extension if not exists pg_net with schema extensions;

-- Where to send, and the shared secret the function checks. Kept in the private
-- schema (never exposed through PostgREST, all grants revoked) because the
-- secret must not be readable by any signed-in admin or customer. A one-row
-- singleton: id is fixed true so a second insert conflicts instead of piling up.
create table if not exists private.push_dispatch_config (
  id boolean primary key default true check (id),
  function_url text not null,
  dispatch_secret text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

revoke all on table private.push_dispatch_config from public, anon, authenticated;

comment on table private.push_dispatch_config is
  'Singleton config for the send-push Edge Function: its URL and the x-push-secret it requires. Set once per environment.';

create or replace function public.dispatch_notification_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg_url text;
  cfg_secret text;
  cfg_enabled boolean;
begin
  select function_url, dispatch_secret, enabled
    into cfg_url, cfg_secret, cfg_enabled
  from private.push_dispatch_config
  where id = true
  limit 1;

  -- Unconfigured or paused: the in-app notification still exists, we just skip
  -- the background push. This is the "app open only" state the UI describes.
  if cfg_url is null or cfg_enabled is not true or length(trim(cfg_url)) = 0 then
    return new;
  end if;

  perform net.http_post(
    url := cfg_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', cfg_secret
    ),
    body := jsonb_build_object('notificationId', new.id),
    timeout_milliseconds := 5000
  );

  return new;
exception when others then
  -- A push-sending failure must never roll back the notification insert that
  -- triggered it. Delivery is best-effort; the record is authoritative.
  return new;
end;
$$;

revoke all on function public.dispatch_notification_push() from public, anon, authenticated;

drop trigger if exists customer_notifications_dispatch_push on public.customer_notifications;
create trigger customer_notifications_dispatch_push
after insert on public.customer_notifications
for each row execute function public.dispatch_notification_push();

-- To switch background delivery on for an environment, run this once with the
-- service role (values are project-specific; keep the secret out of the client):
--
--   insert into private.push_dispatch_config (function_url, dispatch_secret)
--   values (
--     'https://<project-ref>.supabase.co/functions/v1/send-push',
--     '<the same value set as the PUSH_DISPATCH_SECRET function secret>'
--   )
--   on conflict (id) do update
--     set function_url = excluded.function_url,
--         dispatch_secret = excluded.dispatch_secret,
--         enabled = true,
--         updated_at = now();

commit;
