-- Operational order controls stored in app_settings.payload.
-- Existing settings and orders are preserved.

update public.app_settings
set payload = jsonb_build_object(
      'autoAcceptOrders', false,
      'adminOrderNotifications', true,
      'requireDeliveryConfirmation', true,
      'allowCustomerCancellation', true,
      'invoiceDueDays', 7,
      'lowStockThreshold', 20,
      'orderCutoffTime', '18:00'
    ) || coalesce(payload, '{}'::jsonb),
    updated_at = now();

create or replace function private.workflow_boolean(
  p_owner_id uuid,
  p_key text,
  p_default boolean
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select case lower(setting.payload ->> p_key)
        when 'true' then true
        when 'false' then false
        else p_default
      end
      from public.app_settings setting
      where setting.owner_id = p_owner_id and setting.id = 'main'
      limit 1
    ),
    p_default
  )
$$;

revoke all on function private.workflow_boolean(uuid, text, boolean) from public, anon;
grant execute on function private.workflow_boolean(uuid, text, boolean) to authenticated;

create or replace function public.prepare_customer_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_row public.customers;
  auto_accept boolean;
begin
  select * into customer_row
  from public.customers
  where auth_user_id = (select auth.uid()) and active = true
  limit 1;

  if customer_row.id is null then
    raise exception 'Customer account not found for this user';
  end if;

  new.owner_id := customer_row.owner_id;
  new.auth_user_id := customer_row.auth_user_id;
  new.customer_id := customer_row.id;
  new.updated_at := now();
  if coalesce(trim(new.delivery_address), '') = '' then new.delivery_address := customer_row.address; end if;

  auto_accept := private.workflow_boolean(customer_row.owner_id, 'autoAcceptOrders', false);
  if auto_accept then
    new.status := 'accepted';
    new.accepted_at := now();
  else
    new.status := 'pending';
    new.accepted_at := null;
  end if;
  return new;
end
$$;
revoke all on function public.prepare_customer_order() from public, anon, authenticated;

create or replace function public.notify_customer_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if private.workflow_boolean(new.owner_id, 'adminOrderNotifications', true) then
      insert into public.customer_notifications (owner_id, audience, type, title, detail, order_id)
      values (new.owner_id, 'admin', 'order', 'New customer order',
        concat('A customer placed an order for ', new.quantity, ' ', new.bottle_type, '.'), new.id);
    end if;

    if new.status = 'accepted' then
      insert into public.customer_notifications (owner_id, auth_user_id, audience, type, title, detail, order_id)
      values (new.owner_id, new.auth_user_id, 'customer', 'order', 'Your order was accepted',
        'Himaliya Spring Water automatically accepted your delivery request.', new.id);
    end if;
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.customer_notifications (owner_id, auth_user_id, audience, type, title, detail, order_id)
    values (
      new.owner_id, new.auth_user_id, 'customer', 'order',
      case new.status
        when 'accepted' then 'Your order was accepted'
        when 'delivered' then 'Your order was delivered'
        when 'rejected' then 'Your order was rejected'
        when 'canceled' then 'Your order was canceled'
        else 'Your order status changed'
      end,
      case new.status
        when 'accepted' then 'Himaliya Spring Water accepted your delivery request.'
        when 'delivered' then 'Your water delivery has been marked delivered.'
        when 'rejected' then coalesce(nullif(new.admin_note, ''), 'The team could not accept this order.')
        when 'canceled' then 'This order has been canceled.'
        else concat('Current status: ', new.status)
      end,
      new.id
    );
  end if;
  return new;
end
$$;
revoke all on function public.notify_customer_order() from public, anon, authenticated;

drop policy if exists "Customers cancel own pending orders" on public.customer_orders;
create policy "Customers cancel own pending orders" on public.customer_orders
for update to authenticated
using (
  auth_user_id = (select auth.uid())
  and status = 'pending'
  and private.workflow_boolean(owner_id, 'allowCustomerCancellation', true)
)
with check (
  auth_user_id = (select auth.uid())
  and status in ('pending', 'canceled')
  and private.workflow_boolean(owner_id, 'allowCustomerCancellation', true)
);

notify pgrst, 'reload schema';

select
  private.workflow_boolean(owner_id, 'autoAcceptOrders', false) as auto_accept_orders,
  private.workflow_boolean(owner_id, 'adminOrderNotifications', true) as admin_notifications
from public.app_settings
where id = 'main';
