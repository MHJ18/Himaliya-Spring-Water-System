alter table public.customer_orders
  add column if not exists unit_price numeric(12,2) not null default 0,
  add column if not exists total_amount numeric(12,2) not null default 0;

update public.customer_orders
set total_amount = quantity * unit_price
where total_amount is null;

notify pgrst, 'reload schema';
