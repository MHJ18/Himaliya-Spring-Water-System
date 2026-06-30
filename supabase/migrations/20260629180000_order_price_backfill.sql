create or replace function public.prepare_customer_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_row public.customer_profiles;
  resolved_unit_price numeric(12,2);
begin
  select * into profile_row
  from public.customer_profiles
  where id = new.customer_profile_id
    and auth_user_id = (select auth.uid())
  limit 1;

  if profile_row.id is null then
    raise exception 'Customer profile not found for this user';
  end if;

  new.owner_id := profile_row.owner_id;
  new.auth_user_id := profile_row.auth_user_id;
  new.linked_customer_id := profile_row.linked_customer_id;
  new.updated_at := now();

  if new.delivery_address is null or length(trim(new.delivery_address)) = 0 then
    new.delivery_address := profile_row.address;
  end if;

  if coalesce(new.unit_price, 0) = 0 then
    select bp.price into resolved_unit_price
    from public.bottle_prices as bp
    where bp.owner_id = new.owner_id
      and (
        bp.bottle_type = new.bottle_type
        or bp.bottle_type = case new.bottle_type
          when 'Gallon' then '19L Gallon'
          when '19L Gallon' then 'Gallon'
          else new.bottle_type
        end
      )
    order by bp.updated_at desc nulls last
    limit 1;

    new.unit_price := coalesce(resolved_unit_price, 0);
  end if;

  if coalesce(new.total_amount, 0) = 0 and coalesce(new.unit_price, 0) > 0 then
    new.total_amount := new.unit_price * new.quantity;
  end if;

  return new;
end
$$;

update public.customer_orders as co
set
  unit_price = coalesce(nullif(co.unit_price, 0), price_lookup.price, 0),
  total_amount = case
    when coalesce(co.total_amount, 0) > 0 then co.total_amount
    else coalesce(nullif(co.unit_price, 0), price_lookup.price, 0) * co.quantity
  end
from lateral (
  select bp.price
  from public.bottle_prices as bp
  where bp.owner_id = co.owner_id
    and (
      bp.bottle_type = co.bottle_type
      or bp.bottle_type = case co.bottle_type
        when 'Gallon' then '19L Gallon'
        when '19L Gallon' then 'Gallon'
        else co.bottle_type
      end
    )
  order by bp.updated_at desc nulls last
  limit 1
) as price_lookup
where coalesce(co.total_amount, 0) = 0
   or coalesce(co.unit_price, 0) = 0;

notify pgrst, 'reload schema';
