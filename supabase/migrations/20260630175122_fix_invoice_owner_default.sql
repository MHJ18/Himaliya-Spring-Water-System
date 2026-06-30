-- Restore the owner default used by authenticated admin inserts after the invoice rebuild.
alter table public.customer_invoices
  alter column owner_id set default private.current_owner_id();

grant select, insert, update, delete on table public.customer_invoices to authenticated;
notify pgrst, 'reload schema';

select column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'customer_invoices'
  and column_name = 'owner_id';
