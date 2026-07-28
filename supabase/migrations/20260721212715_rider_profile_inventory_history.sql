begin;

alter table public.admin_profiles
  add column if not exists photo text not null default '',
  add column if not exists preferences jsonb not null default '{"theme":"light"}'::jsonb;

alter table public.customers
  add column if not exists bottles_held integer not null default 0;

alter table public.customers
  drop constraint if exists customers_bottles_held_check;
alter table public.customers
  add constraint customers_bottles_held_check check (bottles_held >= 0);

-- Rebuild current balances from delivery records already captured by riders.
update public.customers customer
set bottles_held = greatest(0, coalesce(balance.held, 0))
from (
  select owner_id, customer_id,
    sum(bottles_dropped_off - bottles_collected)::integer as held
  from public.customer_orders
  where tracking_status = 'delivered'
  group by owner_id, customer_id
) balance
where customer.owner_id = balance.owner_id
  and customer.id = balance.customer_id;

create or replace function public.update_rider_profile(
  p_name text,
  p_phone text,
  p_photo text,
  p_theme text
)
returns public.admin_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  rider_row public.admin_profiles;
  clean_name text := trim(coalesce(p_name, ''));
  clean_phone text := trim(coalesce(p_phone, ''));
  clean_photo text := coalesce(p_photo, '');
  clean_theme text := lower(trim(coalesce(p_theme, 'light')));
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if char_length(clean_name) < 2 or char_length(clean_name) > 100 then
    raise exception 'Name must contain between 2 and 100 characters';
  end if;
  if char_length(clean_phone) > 40 then raise exception 'Phone number is too long'; end if;
  if clean_theme not in ('light', 'dark') then raise exception 'Invalid rider theme'; end if;
  if char_length(clean_photo) > 400000 then raise exception 'Profile photo is too large'; end if;
  if clean_photo <> '' and clean_photo !~ '^data:image/(jpeg|png|webp);base64,' then
    raise exception 'Use a JPEG, PNG, or WebP profile photo';
  end if;

  update public.admin_profiles
  set name = clean_name,
      phone = clean_phone,
      photo = clean_photo,
      preferences = coalesce(preferences, '{}'::jsonb) || jsonb_build_object('theme', clean_theme)
  where auth_user_id = (select auth.uid())
    and role = 'Rider'
    and active = true
  returning * into rider_row;

  if rider_row.id is null then raise exception 'Active rider profile not found'; end if;
  return rider_row;
end
$$;

revoke all on function public.update_rider_profile(text, text, text, text) from public, anon;
grant execute on function public.update_rider_profile(text, text, text, text) to authenticated;

create or replace function public.apply_delivered_bottle_handover()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_customer_delta integer := 0;
  new_customer_delta integer := 0;
  customer_delta integer;
  stock_delta integer;
  customer_name text;
begin
  if old.tracking_status = 'delivered' then
    old_customer_delta := old.bottles_dropped_off - old.bottles_collected;
  end if;
  if new.tracking_status = 'delivered' then
    new_customer_delta := new.bottles_dropped_off - new.bottles_collected;
  end if;

  customer_delta := new_customer_delta - old_customer_delta;
  stock_delta := -customer_delta;

  if customer_delta <> 0 then
    update public.customers
    set bottles_held = greatest(0, bottles_held + customer_delta),
        updated_at = now()
    where owner_id = new.owner_id and id = new.customer_id;

    -- Inventory is adjusted only when this bottle type has been configured.
    update public.inventory_stock
    set quantity = greatest(0, quantity + stock_delta), updated_at = now()
    where owner_id = new.owner_id and bottle_type = new.bottle_type;
  end if;

  if old.tracking_status is distinct from 'delivered'
     and new.tracking_status = 'delivered' then
    select name into customer_name
    from public.customers
    where owner_id = new.owner_id and id = new.customer_id
    limit 1;

    insert into public.customer_notifications (
      owner_id, audience, type, title, detail, order_id
    ) values (
      new.owner_id,
      'admin',
      'delivery',
      'Delivery completed',
      concat(
        coalesce(nullif(new.rider_name, ''), 'A rider'),
        ' completed the delivery for ', coalesce(customer_name, 'a customer'),
        '. Full bottles: ', new.bottles_dropped_off,
        '; empty bottles collected: ', new.bottles_collected, '.'
      ),
      new.id
    );
  end if;

  return new;
end
$$;

drop trigger if exists customer_orders_apply_bottle_handover on public.customer_orders;
create trigger customer_orders_apply_bottle_handover
after update of tracking_status, bottles_collected, bottles_dropped_off
on public.customer_orders
for each row execute function public.apply_delivered_bottle_handover();

revoke all on function public.apply_delivered_bottle_handover() from public, anon, authenticated;

create or replace function public.update_rider_delivery(
  p_order_id uuid,
  p_tracking_status text,
  p_bottles_collected integer default 0,
  p_bottles_dropped_off integer default 0,
  p_rider_lat double precision default null,
  p_rider_lng double precision default null,
  p_rider_heading double precision default null
)
returns public.customer_orders
language plpgsql security definer set search_path = ''
as $$
declare
  rider_uuid uuid := (select private.current_rider_profile_id());
  order_row public.customer_orders;
begin
  if rider_uuid is null then raise exception 'Active rider access required'; end if;
  if p_tracking_status not in ('assigned', 'picked_up', 'en_route', 'nearby', 'delivered') then
    raise exception 'Invalid delivery status';
  end if;

  select * into order_row from public.customer_orders
  where id = p_order_id and assigned_rider_id = rider_uuid for update;
  if order_row.id is null then raise exception 'This delivery is not assigned to you'; end if;
  if order_row.tracking_status = 'delivered' then raise exception 'Completed deliveries cannot be changed'; end if;
  if p_bottles_collected < 0 or p_bottles_collected > order_row.quantity
     or p_bottles_dropped_off < 0 or p_bottles_dropped_off > order_row.quantity then
    raise exception 'Bottle counts must be between zero and the order quantity';
  end if;

  update public.customer_orders
  set tracking_status = p_tracking_status,
      bottles_collected = p_bottles_collected,
      bottles_dropped_off = p_bottles_dropped_off,
      rider_lat = p_rider_lat,
      rider_lng = p_rider_lng,
      rider_heading = p_rider_heading,
      updated_at = now()
  where id = order_row.id
  returning * into order_row;
  return order_row;
end
$$;

revoke all on function public.update_rider_delivery(uuid, text, integer, integer, double precision, double precision, double precision)
  from public, anon;
grant execute on function public.update_rider_delivery(uuid, text, integer, integer, double precision, double precision, double precision)
  to authenticated;

notify pgrst, 'reload schema';

commit;
