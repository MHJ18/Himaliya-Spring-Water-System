alter table public.customer_invoices enable row level security;

drop policy if exists "Customers read own paid invoices" on public.customer_invoices;
drop policy if exists "Customers read own invoices" on public.customer_invoices;

create policy "Customers read own invoices" on public.customer_invoices
for select
to authenticated
using (
  exists (
    select 1
    from public.customer_profiles profile
    where profile.owner_id = customer_invoices.owner_id
      and profile.auth_user_id = (select auth.uid())
      and (
        profile.linked_customer_id = customer_invoices.customer_id
        or profile.id::text = customer_invoices.customer_id
        or lower(coalesce(profile.email, '')) = lower(coalesce(customer_invoices.payload->'customer'->>'email', ''))
        or regexp_replace(coalesce(profile.phone, ''), '\D', '', 'g') =
           regexp_replace(coalesce(customer_invoices.payload->'customer'->>'phone', ''), '\D', '', 'g')
      )
  )
);

grant select on table public.customer_invoices to authenticated;
