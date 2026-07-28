-- Keep invoices private to their signed-in customer while also supporting
-- invoices created for a manually entered customer before that customer
-- created an account. Those legacy records cannot always share the same UUID,
-- so they may be matched only within the same owner's customer list by the
-- verified email address or normalized phone number saved in the invoice.

alter table public.customer_invoices enable row level security;

drop policy if exists "Active customers read own invoices"
  on public.customer_invoices;

create policy "Active customers read own invoices"
  on public.customer_invoices
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.customers as customer
      where customer.owner_id = customer_invoices.owner_id
        and customer.auth_user_id = (select auth.uid())
        and customer.active is true
        and (
          customer.id = customer_invoices.customer_id
          or (
            nullif(lower(trim(customer.email)), '') is not null
            and lower(trim(customer.email)) = lower(trim(
              coalesce(customer_invoices.payload -> 'customer' ->> 'email', '')
            ))
          )
          or (
            regexp_replace(coalesce(customer.phone, ''), '\\D', '', 'g') <> ''
            and regexp_replace(coalesce(customer.phone, ''), '\\D', '', 'g') = regexp_replace(
              coalesce(customer_invoices.payload -> 'customer' ->> 'phone', ''),
              '\\D',
              '',
              'g'
            )
          )
        )
    )
  );

grant select on public.customer_invoices to authenticated;

notify pgrst, 'reload schema';
