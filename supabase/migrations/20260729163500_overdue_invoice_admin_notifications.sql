begin;

-- An overdue alert is unique per invoice for each business. The notification
-- title contains the immutable invoice number, so it is safe to use for
-- idempotency without adding a nullable invoice foreign key to the shared inbox.
create unique index if not exists customer_notifications_overdue_invoice_idx
  on public.customer_notifications (owner_id, type, title)
  where audience = 'admin' and type = 'invoice_overdue';

create or replace function public.sync_overdue_invoice_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_owner_id uuid := (select private.current_owner_id());
  due_days integer := 7;
  inserted_count integer := 0;
begin
  if caller_owner_id is null or not exists (
    select 1
    from public.admin_profiles profile
    where profile.auth_user_id = (select auth.uid())
      and profile.owner_id = caller_owner_id
      and profile.active is true
      and lower(coalesce(profile.role, '')) <> 'rider'
  ) then
    raise exception 'An active administrator account is required'
      using errcode = '42501';
  end if;

  select greatest(
    0,
    coalesce(nullif(setting.payload ->> 'invoiceDueDays', '')::integer, 7)
  )
  into due_days
  from public.app_settings setting
  where setting.owner_id = caller_owner_id
  order by setting.updated_at desc nulls last
  limit 1;

  due_days := coalesce(due_days, 7);

  perform pg_advisory_xact_lock(
    hashtext('overdue_invoice_notifications'),
    hashtext(caller_owner_id::text)
  );

  insert into public.customer_notifications (
    owner_id,
    audience,
    type,
    title,
    detail,
    read,
    created_at
  )
  select
    invoice.owner_id,
    'admin',
    'invoice_overdue',
    'Invoice ' || invoice.invoice_number || ' is overdue',
    coalesce(customer.name, 'Customer')
      || ' has not paid '
      || trim(to_char(invoice.total_amount, 'FM999G999G999G990D00'))
      || ' PKR. Due '
      || to_char(invoice.invoice_date + make_interval(days => due_days), 'DD Mon YYYY')
      || '.',
    false,
    now()
  from public.customer_invoices invoice
  left join public.customers customer
    on customer.owner_id = invoice.owner_id
   and customer.id = invoice.customer_id
  where invoice.owner_id = caller_owner_id
    and invoice.payment_status = 'unpaid'
    and invoice.invoice_date + make_interval(days => due_days) < now()
  on conflict (owner_id, type, title)
    where audience = 'admin' and type = 'invoice_overdue'
    do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.sync_overdue_invoice_notifications()
  from public, anon;
grant execute on function public.sync_overdue_invoice_notifications()
  to authenticated;

notify pgrst, 'reload schema';

commit;
