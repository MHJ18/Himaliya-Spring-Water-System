begin;

-- New orders, rider messages, low stock, and completed deliveries already have
-- dedicated admin notifications. Intermediate tracker changes are visible in
-- real time on the delivery screen and should not create inbox noise.
drop trigger if exists customer_orders_notify_admin_tracker
  on public.customer_orders;

drop function if exists public.notify_admin_delivery_tracker();

commit;
