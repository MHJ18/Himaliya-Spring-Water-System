create table if not exists public.customer_invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default private.current_owner_id() references auth.users(id),
  customer_id text not null,
  invoice_number text not null,
  invoice_date timestamptz not null default now(),
  payload jsonb not null,
  total_amount numeric(12, 2) not null default 0,
  total_qty integer not null default 0,
  created_at timestamptz not null default now(),
  constraint customer_invoices_owner_customer_fkey
    foreign key (owner_id, customer_id)
    references public.customers (owner_id, id)
    on delete cascade,
  constraint customer_invoices_number_key unique (invoice_number)
);

create index if not exists customer_invoices_owner_created_idx
  on public.customer_invoices (owner_id, created_at desc);

create index if not exists customer_invoices_customer_idx
  on public.customer_invoices (owner_id, customer_id);

alter table public.customer_invoices enable row level security;

drop policy if exists "Owner customer invoices access" on public.customer_invoices;
create policy "Owner customer invoices access" on public.customer_invoices
for all to authenticated
using (owner_id = (select private.current_owner_id()))
with check (owner_id = (select private.current_owner_id()));

revoke all on table public.customer_invoices from anon;
grant select, insert on table public.customer_invoices to authenticated;

create or replace function public.lookup_invoice_by_number(p_invoice_number text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select payload || jsonb_build_object(
    'invoice_number', invoice_number,
    'invoice_date', invoice_date,
    'total_amount', total_amount,
    'total_qty', total_qty
  )
  from public.customer_invoices
  where upper(invoice_number) = upper(trim(p_invoice_number))
  limit 1;
$$;

revoke all on function public.lookup_invoice_by_number(text) from public;
grant execute on function public.lookup_invoice_by_number(text) to anon, authenticated;

notify pgrst, 'reload schema';
