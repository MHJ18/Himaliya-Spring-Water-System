-- Expose only the current customer's non-sensitive ordering controls and
-- enforce the configured daily cutoff in the database.

create or replace function public.get_customer_order_controls()
returns table (allow_cancellation boolean, order_cutoff_time text, ordering_open boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.workflow_boolean(customer.owner_id, 'allowCustomerCancellation', true),
    coalesce(setting.payload ->> 'orderCutoffTime', '18:00'),
    (now() at time zone 'Asia/Karachi')::time <= coalesce(nullif(setting.payload ->> 'orderCutoffTime', ''), '18:00')::time
  from public.customers customer
  left join public.app_settings setting on setting.owner_id = customer.owner_id and setting.id = 'main'
  where customer.auth_user_id = (select auth.uid()) and customer.active = true
  limit 1
$$;

revoke all on function public.get_customer_order_controls() from public, anon;
grant execute on function public.get_customer_order_controls() to authenticated;

create or replace function public.enforce_customer_order_cutoff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_record uuid;
  cutoff_value time;
begin
  select customer.owner_id into owner_record
  from public.customers customer
  where customer.auth_user_id = (select auth.uid()) and customer.active = true
  limit 1;

  if owner_record is null then raise exception 'Customer account not found'; end if;

  select coalesce(nullif(setting.payload ->> 'orderCutoffTime', ''), '18:00')::time
  into cutoff_value
  from public.app_settings setting
  where setting.owner_id = owner_record and setting.id = 'main';
  cutoff_value := coalesce(cutoff_value, '18:00'::time);

  if (now() at time zone 'Asia/Karachi')::time > cutoff_value then
    raise exception 'Orders are closed for today after %', to_char(cutoff_value, 'HH12:MI AM');
  end if;
  return new;
end
$$;

revoke all on function public.enforce_customer_order_cutoff() from public, anon, authenticated;
drop trigger if exists customer_order_cutoff_guard on public.customer_orders;
create trigger customer_order_cutoff_guard before insert on public.customer_orders
for each row execute function public.enforce_customer_order_cutoff();

notify pgrst, 'reload schema';
