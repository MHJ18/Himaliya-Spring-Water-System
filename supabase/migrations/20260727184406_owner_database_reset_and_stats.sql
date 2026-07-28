begin;

create or replace function public.get_owner_database_stats()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_owner_id uuid;
  customer_count bigint := 0;
  sale_count bigint := 0;
  order_count bigint := 0;
  invoice_count bigint := 0;
  message_count bigint := 0;
  notification_count bigint := 0;
  rider_count bigint := 0;
  team_count bigint := 0;
  gross_revenue numeric := 0;
  outstanding_revenue numeric := 0;
  bottles_sold numeric := 0;
  inventory_units bigint := 0;
  tenant_bytes bigint := 0;
begin
  select profile.owner_id
  into caller_owner_id
  from public.admin_profiles profile
  where profile.auth_user_id = (select auth.uid())
    and profile.active = true
    and profile.role <> 'Rider'
  limit 1;

  if caller_owner_id is null then
    raise exception 'Active administrator access required';
  end if;

  select count(*) into customer_count
  from public.customers where owner_id = caller_owner_id;
  select count(*), coalesce(sum(total_amount), 0), coalesce(sum(quantity), 0)
  into sale_count, gross_revenue, bottles_sold
  from public.sales where owner_id = caller_owner_id;
  select count(*) into order_count
  from public.customer_orders where owner_id = caller_owner_id;
  select count(*),
    coalesce(sum(total_amount) filter (where payment_status <> 'paid'), 0)
  into invoice_count, outstanding_revenue
  from public.customer_invoices where owner_id = caller_owner_id;
  select count(*) into message_count
  from public.customer_messages where owner_id = caller_owner_id;
  select count(*) into notification_count
  from public.customer_notifications where owner_id = caller_owner_id;
  select
    count(*) filter (where role = 'Rider'),
    count(*)
  into rider_count, team_count
  from public.admin_profiles
  where owner_id = caller_owner_id;
  select coalesce(sum(quantity), 0) into inventory_units
  from public.inventory_stock where owner_id = caller_owner_id;

  select
    coalesce((select sum(pg_column_size(row_value)) from public.admin_profiles row_value where owner_id = caller_owner_id), 0)
    + coalesce((select sum(pg_column_size(row_value)) from public.app_settings row_value where owner_id = caller_owner_id), 0)
    + coalesce((select sum(pg_column_size(row_value)) from public.bottle_prices row_value where owner_id = caller_owner_id), 0)
    + coalesce((select sum(pg_column_size(row_value)) from public.customer_bottle_prices row_value where owner_id = caller_owner_id), 0)
    + coalesce((select sum(pg_column_size(row_value)) from public.customer_conversations row_value where owner_id = caller_owner_id), 0)
    + coalesce((select sum(pg_column_size(row_value)) from public.customer_invoices row_value where owner_id = caller_owner_id), 0)
    + coalesce((select sum(pg_column_size(row_value)) from public.customer_messages row_value where owner_id = caller_owner_id), 0)
    + coalesce((select sum(pg_column_size(row_value)) from public.customer_notifications row_value where owner_id = caller_owner_id), 0)
    + coalesce((select sum(pg_column_size(row_value)) from public.customer_orders row_value where owner_id = caller_owner_id), 0)
    + coalesce((select sum(pg_column_size(row_value)) from public.customers row_value where owner_id = caller_owner_id), 0)
    + coalesce((select sum(pg_column_size(row_value)) from public.inventory_stock row_value where owner_id = caller_owner_id), 0)
    + coalesce((select sum(pg_column_size(row_value)) from public.rider_devices row_value where owner_id = caller_owner_id), 0)
    + coalesce((select sum(pg_column_size(row_value)) from public.rider_dispatch_messages row_value where owner_id = caller_owner_id), 0)
    + coalesce((select sum(pg_column_size(row_value)) from public.rider_push_events row_value where owner_id = caller_owner_id), 0)
    + coalesce((select sum(pg_column_size(row_value)) from public.sales row_value where owner_id = caller_owner_id), 0)
  into tenant_bytes;

  return jsonb_build_object(
    'customers', customer_count,
    'salesEntries', sale_count,
    'orders', order_count,
    'invoices', invoice_count,
    'messages', message_count,
    'notifications', notification_count,
    'riders', rider_count,
    'teamAccounts', team_count,
    'grossRevenue', gross_revenue,
    'outstandingRevenue', outstanding_revenue,
    'bottlesSold', bottles_sold,
    'inventoryUnits', inventory_units,
    'operationalRecords',
      customer_count + sale_count + order_count + invoice_count + message_count + notification_count,
    'tenantDataBytes', tenant_bytes,
    'databaseBytes', pg_database_size(current_database()),
    'generatedAt', now()
  );
end
$$;

revoke all on function public.get_owner_database_stats() from public, anon;
grant execute on function public.get_owner_database_stats() to authenticated;

create or replace function public.reset_owner_business_data(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_owner_id uuid;
  deleted_rows bigint := 0;
  affected_rows bigint := 0;
begin
  select profile.owner_id
  into caller_owner_id
  from public.admin_profiles profile
  where profile.auth_user_id = (select auth.uid())
    and profile.active = true
    and profile.role = 'Owner'
    and coalesce(profile.must_change_password, false) = false
  limit 1;

  if caller_owner_id is null then
    raise exception 'Only an active owner can reset business data';
  end if;
  if p_confirmation is distinct from 'RESET DATABASE' then
    raise exception 'Type RESET DATABASE exactly to confirm';
  end if;

  delete from public.rider_devices where owner_id = caller_owner_id;
  get diagnostics affected_rows = row_count;
  deleted_rows := deleted_rows + affected_rows;

  delete from public.rider_dispatch_messages where owner_id = caller_owner_id;
  get diagnostics affected_rows = row_count;
  deleted_rows := deleted_rows + affected_rows;

  delete from public.rider_push_events where owner_id = caller_owner_id;
  get diagnostics affected_rows = row_count;
  deleted_rows := deleted_rows + affected_rows;

  delete from public.customer_messages where owner_id = caller_owner_id;
  get diagnostics affected_rows = row_count;
  deleted_rows := deleted_rows + affected_rows;

  delete from public.customer_notifications where owner_id = caller_owner_id;
  get diagnostics affected_rows = row_count;
  deleted_rows := deleted_rows + affected_rows;

  delete from public.customer_conversations where owner_id = caller_owner_id;
  get diagnostics affected_rows = row_count;
  deleted_rows := deleted_rows + affected_rows;

  delete from public.customer_invoices where owner_id = caller_owner_id;
  get diagnostics affected_rows = row_count;
  deleted_rows := deleted_rows + affected_rows;

  delete from public.customer_orders where owner_id = caller_owner_id;
  get diagnostics affected_rows = row_count;
  deleted_rows := deleted_rows + affected_rows;

  delete from public.sales where owner_id = caller_owner_id;
  get diagnostics affected_rows = row_count;
  deleted_rows := deleted_rows + affected_rows;

  delete from public.customer_bottle_prices where owner_id = caller_owner_id;
  get diagnostics affected_rows = row_count;
  deleted_rows := deleted_rows + affected_rows;

  delete from public.customers where owner_id = caller_owner_id;
  get diagnostics affected_rows = row_count;
  deleted_rows := deleted_rows + affected_rows;

  delete from public.inventory_stock where owner_id = caller_owner_id;
  get diagnostics affected_rows = row_count;
  deleted_rows := deleted_rows + affected_rows;

  delete from public.bottle_prices where owner_id = caller_owner_id;
  get diagnostics affected_rows = row_count;
  deleted_rows := deleted_rows + affected_rows;

  delete from public.app_settings where owner_id = caller_owner_id;
  get diagnostics affected_rows = row_count;
  deleted_rows := deleted_rows + affected_rows;

  return jsonb_build_object(
    'deletedRows', deleted_rows,
    'usersPreserved', (
      select count(*) from public.admin_profiles where owner_id = caller_owner_id
    ),
    'completedAt', now()
  );
end
$$;

revoke all on function public.reset_owner_business_data(text) from public, anon;
grant execute on function public.reset_owner_business_data(text) to authenticated;

notify pgrst, 'reload schema';

commit;
