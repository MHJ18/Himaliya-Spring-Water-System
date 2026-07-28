begin;

alter table public.customer_orders
  add column if not exists delivered_items jsonb not null default '[]'::jsonb;

update public.customer_orders
set delivered_items = case
  when tracking_status = 'delivered' and bottles_dropped_off = quantity then items
  when tracking_status = 'delivered' and bottles_dropped_off > 0 then
    jsonb_build_array(jsonb_build_object(
      'bottleType', bottle_type,
      'quantity', bottles_dropped_off
    ))
  else '[]'::jsonb
end
where jsonb_typeof(delivered_items) is distinct from 'array'
   or (tracking_status = 'delivered' and jsonb_array_length(delivered_items) = 0);

alter table public.customer_orders
  drop constraint if exists customer_orders_delivered_items_check,
  add constraint customer_orders_delivered_items_check check (
    jsonb_typeof(delivered_items) = 'array'
  );

create or replace function public.update_rider_delivery(
  p_order_id uuid,
  p_tracking_status text,
  p_bottles_collected integer,
  p_bottles_dropped_off integer,
  p_rider_lat double precision,
  p_rider_lng double precision,
  p_rider_heading double precision,
  p_delivered_items jsonb
)
returns public.customer_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  rider_uuid uuid := (select private.current_rider_profile_id());
  order_row public.customer_orders;
  item jsonb;
  clean_items jsonb := '[]'::jsonb;
  item_type text;
  item_quantity integer;
  ordered_quantity integer;
  delivered_total integer := 0;
begin
  if rider_uuid is null then raise exception 'Active rider access required'; end if;
  if p_tracking_status not in ('assigned', 'picked_up', 'en_route', 'nearby', 'delivered') then
    raise exception 'Invalid delivery status';
  end if;

  select * into order_row
  from public.customer_orders
  where id = p_order_id and assigned_rider_id = rider_uuid
  for update;

  if order_row.id is null then raise exception 'This delivery is not assigned to you'; end if;
  if order_row.tracking_status = 'delivered' then raise exception 'Completed deliveries cannot be changed'; end if;
  if p_bottles_collected < 0 then
    raise exception 'Empty bottles taken back cannot be negative';
  end if;
  if p_bottles_dropped_off < 0 or p_bottles_dropped_off > order_row.quantity then
    raise exception 'Full bottles given must be between zero and the order quantity';
  end if;

  if p_tracking_status = 'delivered' then
    if p_delivered_items is null
       or jsonb_typeof(p_delivered_items) is distinct from 'array'
       or jsonb_array_length(p_delivered_items) = 0 then
      if p_bottles_dropped_off = order_row.quantity then
        clean_items := order_row.items;
      elsif p_bottles_dropped_off > 0 then
        clean_items := jsonb_build_array(jsonb_build_object(
          'bottleType', order_row.bottle_type,
          'quantity', p_bottles_dropped_off
        ));
      end if;
    else
      for item in select value from jsonb_array_elements(p_delivered_items)
      loop
        item_type := trim(coalesce(item ->> 'bottleType', ''));
        item_quantity := coalesce((item ->> 'quantity')::integer, 0);
        select coalesce(sum((ordered ->> 'quantity')::integer), 0)
          into ordered_quantity
        from jsonb_array_elements(order_row.items) ordered
        where ordered ->> 'bottleType' = item_type;

        if item_type = '' or item_quantity < 0 or item_quantity > ordered_quantity then
          raise exception 'Delivered quantities must match bottle types in this order';
        end if;
        if item_quantity > 0 then
          clean_items := clean_items || jsonb_build_array(jsonb_build_object(
            'bottleType', item_type,
            'quantity', item_quantity
          ));
          delivered_total := delivered_total + item_quantity;
        end if;
      end loop;

      if delivered_total <> p_bottles_dropped_off then
        raise exception 'Delivered bottle total does not match the item quantities';
      end if;
    end if;
  else
    clean_items := order_row.delivered_items;
  end if;

  update public.customer_orders
  set tracking_status = p_tracking_status,
      bottles_collected = p_bottles_collected,
      bottles_dropped_off = p_bottles_dropped_off,
      delivered_items = clean_items,
      rider_lat = p_rider_lat,
      rider_lng = p_rider_lng,
      rider_heading = p_rider_heading,
      updated_at = now()
  where id = order_row.id
  returning * into order_row;
  return order_row;
end
$$;

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
language sql
security definer
set search_path = ''
as $$
  select public.update_rider_delivery(
    p_order_id,
    p_tracking_status,
    p_bottles_collected,
    p_bottles_dropped_off,
    p_rider_lat,
    p_rider_lng,
    p_rider_heading,
    null::jsonb
  );
$$;

revoke all on function public.update_rider_delivery(
  uuid, text, integer, integer, double precision, double precision, double precision, jsonb
) from public, anon;
grant execute on function public.update_rider_delivery(
  uuid, text, integer, integer, double precision, double precision, double precision, jsonb
) to authenticated;

revoke all on function public.update_rider_delivery(
  uuid, text, integer, integer, double precision, double precision, double precision
) from public, anon;
grant execute on function public.update_rider_delivery(
  uuid, text, integer, integer, double precision, double precision, double precision
) to authenticated;

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
  returned_delta integer := 0;
  return_type text;
  inventory_row record;
  customer_name text;
  item_summary text;
begin
  if old.tracking_status = 'delivered' then
    old_customer_delta := old.bottles_dropped_off - old.bottles_collected;
  end if;
  if new.tracking_status = 'delivered' then
    new_customer_delta := new.bottles_dropped_off - new.bottles_collected;
  end if;

  customer_delta := new_customer_delta - old_customer_delta;
  if customer_delta <> 0 then
    update public.customers
    set bottles_held = greatest(0, bottles_held + customer_delta),
        updated_at = now()
    where owner_id = new.owner_id and id = new.customer_id;
  end if;

  for inventory_row in
    with old_items as (
      select item ->> 'bottleType' as bottle_type,
             sum((item ->> 'quantity')::integer) as quantity
      from jsonb_array_elements(
        case when old.tracking_status = 'delivered' then old.delivered_items else '[]'::jsonb end
      ) item
      group by item ->> 'bottleType'
    ),
    new_items as (
      select item ->> 'bottleType' as bottle_type,
             sum((item ->> 'quantity')::integer) as quantity
      from jsonb_array_elements(
        case when new.tracking_status = 'delivered' then new.delivered_items else '[]'::jsonb end
      ) item
      group by item ->> 'bottleType'
    ),
    bottle_types as (
      select bottle_type from old_items
      union
      select bottle_type from new_items
    )
    select bottle_types.bottle_type,
           coalesce(new_items.quantity, 0) - coalesce(old_items.quantity, 0) as delivered_delta
    from bottle_types
    left join old_items using (bottle_type)
    left join new_items using (bottle_type)
  loop
    if inventory_row.delivered_delta <> 0 then
      insert into public.inventory_stock (owner_id, bottle_type, quantity, updated_at)
      values (
        new.owner_id,
        inventory_row.bottle_type,
        greatest(0, -inventory_row.delivered_delta),
        now()
      )
      on conflict (owner_id, bottle_type)
      do update set
        quantity = greatest(0, public.inventory_stock.quantity - inventory_row.delivered_delta),
        updated_at = now();
    end if;
  end loop;

  if old.tracking_status = 'delivered' then returned_delta := -old.bottles_collected; end if;
  if new.tracking_status = 'delivered' then returned_delta := returned_delta + new.bottles_collected; end if;
  if returned_delta <> 0 then
    select coalesce(
      (
        select item ->> 'bottleType'
        from jsonb_array_elements(new.items) item
        where lower(item ->> 'bottleType') like '%gallon%'
        limit 1
      ),
      new.bottle_type
    ) into return_type;

    insert into public.inventory_stock (owner_id, bottle_type, quantity, updated_at)
    values (new.owner_id, return_type, greatest(0, returned_delta), now())
    on conflict (owner_id, bottle_type)
    do update set
      quantity = greatest(0, public.inventory_stock.quantity + returned_delta),
      updated_at = now();
  end if;

  if old.tracking_status is distinct from 'delivered'
     and new.tracking_status = 'delivered' then
    select name into customer_name
    from public.customers
    where owner_id = new.owner_id and id = new.customer_id
    limit 1;

    select string_agg(
      (item ->> 'quantity') || ' x ' || (item ->> 'bottleType'),
      ', '
    ) into item_summary
    from jsonb_array_elements(new.delivered_items) item;

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
        '. Delivered: ', coalesce(nullif(item_summary, ''), 'none'),
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
after update of tracking_status, bottles_collected, bottles_dropped_off, delivered_items
on public.customer_orders
for each row execute function public.apply_delivered_bottle_handover();

revoke all on function public.apply_delivered_bottle_handover()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
