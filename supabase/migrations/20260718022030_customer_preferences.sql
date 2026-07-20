begin;

alter table public.customers
  add column if not exists preferences jsonb not null default
    '{"theme":"dark","browserNotifications":true,"orderUpdates":true,"invoiceAlerts":true,"defaultBottleType":"Gallon","defaultQuantity":1}'::jsonb;

alter table public.customers
  drop constraint if exists customers_preferences_object_check;

alter table public.customers
  add constraint customers_preferences_object_check
  check (jsonb_typeof(preferences) = 'object');

comment on column public.customers.preferences is
  'Customer-owned portal appearance, notification and order defaults. Protected by the existing customer ownership RLS policies.';

notify pgrst, 'reload schema';

commit;
