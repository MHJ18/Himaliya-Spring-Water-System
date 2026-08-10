begin;

-- Some linked environments moved fully to JSON order lines without retaining
-- the legacy customer_orders.unit_price column. Resolve that optional fallback
-- through the row's JSON representation so the helper works on both schemas
-- and plpgsql_check no longer treats the missing composite field as an error.
create or replace function private.customer_order_line_total(
  p_order_id uuid,
  p_line_index integer
)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  order_row public.customer_orders;
  source_items jsonb;
  line_item jsonb;
  ordered_item jsonb;
  item_count integer := 0;
  bottle_type text := '';
  quantity_value numeric := 0;
  unit_price_value numeric := 0;
  saved_total numeric := 0;
begin
  if p_line_index is null or p_line_index < 0 then return null; end if;

  select * into order_row
  from public.customer_orders
  where id = p_order_id;

  if order_row.id is null then return null; end if;

  source_items := case
    when jsonb_typeof(order_row.delivered_items) = 'array'
      and jsonb_array_length(order_row.delivered_items) > 0
      then order_row.delivered_items
    when jsonb_typeof(order_row.items) = 'array'
      then order_row.items
    else '[]'::jsonb
  end;
  item_count := jsonb_array_length(source_items);

  select item.value into line_item
  from jsonb_array_elements(source_items) with ordinality as item(value, position)
  where item.position = p_line_index + 1;

  if line_item is null then return null; end if;

  bottle_type := btrim(coalesce(
    line_item ->> 'bottleType',
    line_item ->> 'bottle_type',
    order_row.bottle_type,
    ''
  ));
  quantity_value := coalesce(
    nullif(line_item ->> 'quantity', '')::numeric,
    nullif(line_item ->> 'qty', '')::numeric,
    0
  );
  saved_total := coalesce(
    nullif(line_item ->> 'totalAmount', '')::numeric,
    nullif(line_item ->> 'total_amount', '')::numeric,
    0
  );
  unit_price_value := coalesce(
    nullif(line_item ->> 'unitPrice', '')::numeric,
    nullif(line_item ->> 'unit_price', '')::numeric,
    0
  );

  if unit_price_value <= 0 and jsonb_typeof(order_row.items) = 'array' then
    select item.value into ordered_item
    from jsonb_array_elements(order_row.items) as item(value)
    where btrim(coalesce(
      item.value ->> 'bottleType',
      item.value ->> 'bottle_type',
      ''
    )) = bottle_type
    limit 1;

    unit_price_value := coalesce(
      nullif(ordered_item ->> 'unitPrice', '')::numeric,
      nullif(ordered_item ->> 'unit_price', '')::numeric,
      0
    );
  end if;

  if unit_price_value <= 0 and item_count = 1 then
    unit_price_value := greatest(
      0,
      coalesce(
        nullif(to_jsonb(order_row) ->> 'unit_price', '')::numeric,
        0
      )
    );
  end if;

  if saved_total > 0 then return saved_total; end if;
  return greatest(0, quantity_value) * greatest(0, unit_price_value);
end
$$;

revoke all on function private.customer_order_line_total(uuid, integer)
  from public, anon, authenticated;

commit;
