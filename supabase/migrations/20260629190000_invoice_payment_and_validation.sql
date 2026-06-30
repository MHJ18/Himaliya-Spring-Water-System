alter table public.customer_invoices
  add column if not exists validated boolean not null default false;

alter table public.customer_invoices
  alter column payment_status set default 'unpaid';

drop policy if exists "Customers read own paid invoices" on public.customer_invoices;
drop policy if exists "Customers read own invoices" on public.customer_invoices;

create policy "Customers read own invoices" on public.customer_invoices
for select to authenticated
using (
  exists (
    select 1
    from public.customer_profiles profile
    where profile.owner_id = customer_invoices.owner_id
      and profile.auth_user_id = (select auth.uid())
      and profile.active = true
      and (
        profile.linked_customer_id = customer_invoices.customer_id
        or profile.id::text = customer_invoices.customer_id
        or lower(coalesce(profile.email, '')) = lower(coalesce(customer_invoices.payload->'customer'->>'email', ''))
        or regexp_replace(coalesce(profile.phone, ''), '\D', '', 'g') =
           regexp_replace(coalesce(customer_invoices.payload->'customer'->>'phone', ''), '\D', '', 'g')
      )
  )
);

grant select, insert, update on table public.customer_invoices to authenticated;

create or replace function public.lookup_invoice_by_number(p_invoice_number text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(payload, '{}'::jsonb) || jsonb_build_object(
    'id', id,
    'invoice_number', invoice_number,
    'invoice_date', invoice_date,
    'total_amount', total_amount,
    'total_qty', total_qty,
    'payment_status', payment_status,
    'validated', validated
  )
  from public.customer_invoices
  where upper(invoice_number) = upper(trim(p_invoice_number))
  limit 1;
$$;

revoke all on function public.lookup_invoice_by_number(text) from public;
grant execute on function public.lookup_invoice_by_number(text) to anon, authenticated;

notify pgrst, 'reload schema';
