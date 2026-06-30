-- Keep the persisted company location aligned across settings, invoices and public pages.
update public.app_settings
set payload = jsonb_set(
      coalesce(payload, '{}'::jsonb),
      '{businessAddress}',
      to_jsonb('Sialkot Cantt'::text),
      true
    ),
    updated_at = now();

update public.customer_invoices
set payload = jsonb_set(
      coalesce(payload, '{}'::jsonb),
      '{company,address}',
      to_jsonb('Sialkot Cantt'::text),
      true
    ),
    updated_at = now();

notify pgrst, 'reload schema';

select
  (select payload ->> 'businessAddress' from public.app_settings where id = 'main' limit 1) as business_address,
  (select count(*) from public.customer_invoices where payload #>> '{company,address}' = 'Sialkot Cantt') as updated_invoices;
