alter table public.customers
  add column if not exists source text not null default 'admin';

alter table public.customers
  drop constraint if exists customers_source_check;

alter table public.customers
  add constraint customers_source_check
  check (source in ('admin', 'portal', 'both'));

update public.customers
set source = 'admin'
where source is null;

update public.customers as customer
set source = case
  when customer.source = 'admin' then 'both'
  else customer.source
end
where exists (
  select 1
  from public.customer_profiles profile
  where profile.owner_id = customer.owner_id
    and profile.linked_customer_id = customer.id
);

create or replace function public.link_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_customer_id text;
begin
  if new.owner_id is null then
    new.owner_id := private.default_owner_id();
  end if;

  select c.id into existing_customer_id
  from public.customers c
  where c.owner_id = new.owner_id
    and (
      lower(coalesce(c.email, '')) = lower(coalesce(new.email, ''))
      or regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = regexp_replace(coalesce(new.phone, ''), '\D', '', 'g')
    )
  order by c.created_at asc
  limit 1;

  if existing_customer_id is null then
    insert into public.customers (
      id,
      owner_id,
      name,
      phone,
      address,
      email,
      photo,
      source,
      created_at
    )
    values (
      new.id::text,
      new.owner_id,
      new.name,
      new.phone,
      coalesce(new.address, ''),
      lower(coalesce(new.email, '')),
      '',
      'portal',
      now()
    )
    on conflict (owner_id, phone) do update
      set name = excluded.name,
          address = excluded.address,
          email = excluded.email,
          source = case
            when public.customers.source = 'admin' then 'both'
            else public.customers.source
          end
    returning id into existing_customer_id;
  else
    update public.customers
    set source = case
      when source = 'admin' then 'both'
      else source
    end
    where owner_id = new.owner_id
      and id = existing_customer_id;
  end if;

  new.linked_customer_id := existing_customer_id;
  new.updated_at := now();
  return new;
end
$$;

revoke all on function public.link_customer_profile() from public, anon, authenticated;

drop policy if exists "Customers read own invoices" on public.customer_invoices;
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
        or profile.id::text = customer_invoices.customer_id
        or lower(coalesce(profile.email, '')) = lower(coalesce(customer_invoices.payload->'customer'->>'email', ''))
        or regexp_replace(coalesce(profile.phone, ''), '\D', '', 'g') =
           regexp_replace(coalesce(customer_invoices.payload->'customer'->>'phone', ''), '\D', '', 'g')
      )
  )
);

grant select, insert, update, delete on table public.customers to authenticated;
grant select on table public.customer_invoices to authenticated;

notify pgrst, 'reload schema';
