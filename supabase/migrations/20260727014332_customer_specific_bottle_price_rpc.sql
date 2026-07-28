begin;

-- Return only the prices assigned to the requested customer. RLS remains in
-- force because this function deliberately runs with the caller's privileges.
create or replace function public.get_customer_bottle_prices(
  p_customer_id text default null
)
returns table (
  bottle_type text,
  price numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select assigned.bottle_type, assigned.price
  from public.customer_bottle_prices assigned
  join public.customers customer
    on customer.owner_id = assigned.owner_id
   and customer.id = assigned.customer_id
  where (p_customer_id is null or customer.id = p_customer_id)
    and (
      (
        customer.auth_user_id = (select auth.uid())
        and customer.active = true
      )
      or (
        customer.owner_id = (select private.current_owner_id())
        and (select private.is_active_admin())
      )
    )
  order by assigned.bottle_type
$$;

-- Save the complete per-customer price map atomically under the current
-- administrator's owner account. The table policy still authorizes the write.
create or replace function public.set_customer_bottle_prices(
  p_customer_id text,
  p_prices jsonb
)
returns table (
  bottle_type text,
  price numeric
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  admin_owner_id uuid := (select private.current_owner_id());
begin
  if admin_owner_id is null or not (select private.is_active_admin()) then
    raise exception 'Active administrator access required';
  end if;

  if jsonb_typeof(p_prices) is distinct from 'object' then
    raise exception 'Customer prices must be a JSON object';
  end if;

  if not exists (
    select 1
    from public.customers customer
    where customer.owner_id = admin_owner_id
      and customer.id = p_customer_id
  ) then
    raise exception 'Customer not found';
  end if;

  insert into public.customer_bottle_prices (
    owner_id,
    customer_id,
    bottle_type,
    price,
    updated_at
  )
  select
    admin_owner_id,
    p_customer_id,
    entry.key,
    greatest(0, entry.value::numeric),
    now()
  from jsonb_each_text(p_prices) entry
  where entry.key in ('Small Bottle', 'Medium Bottle', 'Large Bottle', 'Gallon')
  on conflict on constraint customer_bottle_prices_pkey
  do update set
    price = excluded.price,
    updated_at = excluded.updated_at;

  return query
  select assigned.bottle_type, assigned.price
  from public.customer_bottle_prices assigned
  where assigned.owner_id = admin_owner_id
    and assigned.customer_id = p_customer_id
  order by assigned.bottle_type;
end
$$;

revoke all on function public.get_customer_bottle_prices(text)
  from public, anon;
grant execute on function public.get_customer_bottle_prices(text)
  to authenticated;

revoke all on function public.set_customer_bottle_prices(text, jsonb)
  from public, anon;
grant execute on function public.set_customer_bottle_prices(text, jsonb)
  to authenticated;

notify pgrst, 'reload schema';

commit;
