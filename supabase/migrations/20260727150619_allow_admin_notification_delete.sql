-- The existing "Admins manage customer notifications" RLS policy limits
-- deletion to notifications owned by the current admin's company.
grant delete on table public.customer_notifications to authenticated;

notify pgrst, 'reload schema';
