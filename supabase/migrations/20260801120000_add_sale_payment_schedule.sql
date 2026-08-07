begin;

-- A customer's billing profile can stay monthly while an individual delivery
-- is paid at the door. Keep that per-sale decision on the sale itself so it
-- survives later profile changes and remains visible in analytics/invoices.
alter table public.sales
  add column if not exists payment_schedule text not null default 'monthly';

alter table public.sales
  drop constraint if exists sales_payment_schedule_check;
alter table public.sales
  add constraint sales_payment_schedule_check
  check (payment_schedule in ('monthly', 'on_delivery'));

update public.sales sale
set payment_schedule = 'on_delivery'
from public.customer_billing_profiles billing
where billing.owner_id = sale.owner_id
  and billing.customer_id = sale.customer_id
  and billing.payment_schedule = 'on_delivery'
  and sale.payment_schedule = 'monthly';

create index if not exists sales_payment_schedule_idx
  on public.sales (owner_id, payment_schedule, created_at);

notify pgrst, 'reload schema';
commit;
