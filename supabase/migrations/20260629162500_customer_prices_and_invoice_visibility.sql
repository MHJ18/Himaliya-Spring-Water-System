alter table public.customer_invoices
  add column if not exists payment_status text not null default 'paid';

drop policy if exists "Customers read business bottle prices" on public.bottle_prices;
create policy "Customers read business bottle prices" on public.bottle_prices
for select to authenticated
using (true);

create or replace function public.get_business_bottle_prices()
returns table (
  bottle_type text,
  price numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (prices.bottle_type)
    prices.bottle_type,
    prices.price
  from public.bottle_prices as prices
  order by prices.bottle_type, prices.updated_at desc nulls last;
$$;

revoke all on function public.get_business_bottle_prices() from public;
grant execute on function public.get_business_bottle_prices() to authenticated;

drop policy if exists "Customers read own paid invoices" on public.customer_invoices;
create policy "Customers read own paid invoices" on public.customer_invoices
for select to authenticated
using (
  payment_status = 'paid'
  and exists (
    select 1
    from public.customer_profiles profile
    where profile.owner_id = customer_invoices.owner_id
      and profile.auth_user_id = (select auth.uid())
      and profile.active = true
      and (
        profile.linked_customer_id = customer_invoices.customer_id
        or lower(coalesce(profile.email, '')) = lower(coalesce(customer_invoices.payload->'customer'->>'email', ''))
        or regexp_replace(coalesce(profile.phone, ''), '\D', '', 'g') =
           regexp_replace(coalesce(customer_invoices.payload->'customer'->>'phone', ''), '\D', '', 'g')
      )
  )
);

grant select on table public.bottle_prices, public.customer_invoices to authenticated;

notify pgrst, 'reload schema';
