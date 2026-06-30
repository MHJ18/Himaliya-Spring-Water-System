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
      now()
    )
    on conflict (owner_id, phone) do update
      set name = excluded.name,
          address = excluded.address,
          email = excluded.email
    returning id into existing_customer_id;
  end if;

  new.linked_customer_id := existing_customer_id;
  new.updated_at := now();
  return new;
end
$$;

revoke all on function public.link_customer_profile() from public, anon, authenticated;

update public.customer_profiles
set updated_at = now();

grant select, insert, update, delete on table public.customer_profiles to authenticated;
grant select, insert, update on table public.customer_orders, public.customer_notifications to authenticated;

notify pgrst, 'reload schema';
