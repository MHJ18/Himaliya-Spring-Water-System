begin;

-- Snapshot the terms on each portal order. Changing a customer's billing
-- profile later must not retroactively move an already delivered order between
-- monthly and pay-on-delivery ledgers. Existing rows have no historical terms,
-- so their one-time backfill uses the current profile as the safest available
-- evidence.
alter table public.customer_orders
  add column if not exists payment_schedule text not null default 'monthly';

alter table public.customer_orders
  drop constraint if exists customer_orders_payment_schedule_check;
alter table public.customer_orders
  add constraint customer_orders_payment_schedule_check
  check (payment_schedule in ('monthly', 'on_delivery'));

update public.customer_orders customer_order
set payment_schedule = billing.payment_schedule
from public.customer_billing_profiles billing
where billing.owner_id = customer_order.owner_id
  and billing.customer_id = customer_order.customer_id;

create or replace function private.snapshot_customer_order_payment_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select billing.payment_schedule into new.payment_schedule
  from public.customer_billing_profiles billing
  where billing.owner_id = new.owner_id
    and billing.customer_id = new.customer_id;

  new.payment_schedule := coalesce(new.payment_schedule, 'monthly');
  return new;
end
$$;

revoke all on function private.snapshot_customer_order_payment_schedule()
  from public, anon, authenticated;

drop trigger if exists customer_orders_snapshot_payment_schedule
  on public.customer_orders;
-- PostgreSQL runs same-event triggers alphabetically. "snapshot" follows the
-- existing "prepare" trigger, which first pins owner_id and customer_id.
create trigger customer_orders_snapshot_payment_schedule
before insert on public.customer_orders
for each row execute function private.snapshot_customer_order_payment_schedule();

-- Payments are dated business events. Their allocations are immutable source
-- lines, so invoice reversal can reverse the payment event without rewriting
-- sale/order facts or guessing which later payment belonged to which entry.
create table if not exists public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id text not null,
  invoice_id uuid references public.customer_invoices(id) on delete cascade,
  payment_type text not null,
  amount numeric(12, 2) not null,
  status text not null default 'applied',
  received_at timestamptz not null default now(),
  recorded_by uuid,
  reversed_at timestamptz,
  reversed_by uuid,
  created_at timestamptz not null default now(),
  constraint customer_payments_owner_customer_fkey
    foreign key (owner_id, customer_id)
    references public.customers(owner_id, id)
    on delete cascade,
  constraint customer_payments_type_check
    check (payment_type in ('monthly', 'invoice')),
  constraint customer_payments_amount_check
    check (amount > 0),
  constraint customer_payments_status_check
    check (status in ('applied', 'reversed')),
  constraint customer_payments_invoice_type_check
    check (
      (payment_type = 'invoice' and invoice_id is not null)
      or (payment_type = 'monthly' and invoice_id is null)
    ),
  constraint customer_payments_reversal_check
    check (
      (status = 'applied' and reversed_at is null)
      or (status = 'reversed' and reversed_at is not null)
    ),
  constraint customer_payments_owner_customer_id_key
    unique (owner_id, customer_id, id)
);

create unique index if not exists customer_payments_active_invoice_idx
  on public.customer_payments (invoice_id)
  where invoice_id is not null and status = 'applied';

create index if not exists customer_payments_customer_received_idx
  on public.customer_payments (owner_id, customer_id, received_at desc);

create table if not exists public.customer_payment_allocations (
  payment_id uuid not null,
  owner_id uuid not null,
  customer_id text not null,
  source_key text not null,
  source_type text not null,
  amount numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  primary key (payment_id, source_key),
  constraint customer_payment_allocations_payment_fkey
    foreign key (owner_id, customer_id, payment_id)
    references public.customer_payments(owner_id, customer_id, id)
    on delete cascade,
  constraint customer_payment_allocations_owner_customer_fkey
    foreign key (owner_id, customer_id)
    references public.customers(owner_id, id)
    on delete cascade,
  constraint customer_payment_allocations_source_key_check
    check (length(btrim(source_key)) between 1 and 250),
  constraint customer_payment_allocations_source_type_check
    check (source_type in ('sale', 'customer_order')),
  constraint customer_payment_allocations_amount_check
    check (amount > 0)
);

create index if not exists customer_payment_allocations_source_idx
  on public.customer_payment_allocations (owner_id, source_key, payment_id);

create index if not exists customer_payment_allocations_customer_idx
  on public.customer_payment_allocations (owner_id, customer_id, created_at desc);

alter table public.customer_payments enable row level security;
alter table public.customer_payment_allocations enable row level security;

drop policy if exists "Admins read customer payments" on public.customer_payments;
create policy "Admins read customer payments"
on public.customer_payments
for select
to authenticated
using (owner_id = (select private.current_owner_id()));

drop policy if exists "Admins read customer payment allocations"
  on public.customer_payment_allocations;
create policy "Admins read customer payment allocations"
on public.customer_payment_allocations
for select
to authenticated
using (owner_id = (select private.current_owner_id()));

revoke all on table public.customer_payments, public.customer_payment_allocations
  from public, anon, authenticated;
grant select on table public.customer_payments, public.customer_payment_allocations
  to authenticated;
grant all on table public.customer_payments, public.customer_payment_allocations
  to service_role;

-- The app only needs active totals per immutable source key. security_invoker
-- keeps the underlying administrator-only RLS policies in force.
create or replace view public.customer_active_payment_allocations
with (security_invoker = true, security_barrier = true)
as
select
  allocation.owner_id,
  allocation.customer_id,
  allocation.source_key,
  allocation.source_type,
  sum(allocation.amount)::numeric(12, 2) as amount
from public.customer_payment_allocations allocation
join public.customer_payments payment
  on payment.id = allocation.payment_id
 and payment.owner_id = allocation.owner_id
 and payment.customer_id = allocation.customer_id
where payment.status = 'applied'
group by
  allocation.owner_id,
  allocation.customer_id,
  allocation.source_key,
  allocation.source_type;

revoke all on table public.customer_active_payment_allocations
  from public, anon, authenticated;
grant select on table public.customer_active_payment_allocations to authenticated;
grant all on table public.customer_active_payment_allocations to service_role;

-- Resolve exactly the same delivered-order line total used by the application.
-- The source key remains customer-order:<order uuid>:<zero-based line index>.
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
    unit_price_value := greatest(0, coalesce(order_row.unit_price, 0));
  end if;

  if saved_total > 0 then return saved_total; end if;
  return greatest(0, quantity_value) * greatest(0, unit_price_value);
end
$$;

revoke all on function private.customer_order_line_total(uuid, integer)
  from public, anon, authenticated;

-- Keep one canonical interpretation of an invoice line's unpaid balance. This
-- is used both for the one-time legacy conversion and for every new invoice.
create or replace function private.customer_invoice_line_balance(p_line jsonb)
returns numeric
language sql
immutable
security definer
set search_path = ''
as $$
  select greatest(0, coalesce(
    nullif(p_line ->> 'balanceDue', '')::numeric,
    nullif(p_line ->> 'balance_due', '')::numeric,
    greatest(
      0,
      coalesce(
        nullif(p_line ->> 'grossAmount', '')::numeric,
        nullif(p_line ->> 'totalAmount', '')::numeric,
        0
      ) - coalesce(nullif(p_line ->> 'amountPaid', '')::numeric, 0)
    )
  ))
$$;

revoke all on function private.customer_invoice_line_balance(jsonb)
  from public, anon, authenticated;

-- A paid legacy invoice is safe to convert only when every positive line has
-- a unique active claim belonging to that invoice and those line balances add
-- up to the saved invoice total. Anything ambiguous remains untouched.
create or replace function private.paid_invoice_fully_reconcilable(
  p_invoice_id uuid,
  p_owner_id uuid,
  p_customer_id text,
  p_payload jsonb,
  p_total_amount numeric
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with source_lines as (
    select
      btrim(coalesce(line.item ->> 'id', '')) as source_key,
      case
        when coalesce(
          line.item ->> 'recordType',
          line.item ->> 'record_type',
          ''
        ) = 'customer_order'
          or btrim(coalesce(line.item ->> 'id', '')) like 'customer-order:%'
          then 'customer_order'
        else 'sale'
      end as source_type,
      private.customer_invoice_line_balance(line.item) as line_due
    from jsonb_array_elements(
      case
        when jsonb_typeof(p_payload -> 'history') = 'array'
          then p_payload -> 'history'
        else '[]'::jsonb
      end
    ) as line(item)
  )
  select
    coalesce(sum(source_lines.line_due), 0) > 0
    and abs(
      coalesce(sum(source_lines.line_due), 0)
      - greatest(0, coalesce(p_total_amount, 0))
    ) <= 0.005
    and count(*) filter (where source_lines.line_due > 0)
      = count(distinct source_lines.source_key)
        filter (where source_lines.line_due > 0)
    and not exists (
      select 1
      from source_lines positive_line
      where positive_line.line_due > 0
        and (
          positive_line.source_key = ''
          or not exists (
            select 1
            from public.customer_invoice_line_claims claim
            where claim.invoice_id = p_invoice_id
              and claim.owner_id = p_owner_id
              and claim.customer_id = p_customer_id
              and claim.source_key = positive_line.source_key
              and claim.source_type = positive_line.source_type
              and claim.released_at is null
          )
        )
    )
  from source_lines
$$;

revoke all on function private.paid_invoice_fully_reconcilable(
  uuid, uuid, text, jsonb, numeric
) from public, anon, authenticated;

-- Earlier clients marked paid invoice sales by overwriting amount_paid with the
-- sale gross. Convert only that exact legacy signature back to the invoice-time
-- direct-payment baseline before creating an auditable invoice payment event.
with paid_sale_lines as (
  select
    invoice.owner_id,
    invoice.customer_id,
    claim.source_key,
    greatest(0, coalesce(
      nullif(line.item ->> 'grossAmount', '')::numeric,
      nullif(line.item ->> 'totalAmount', '')::numeric,
      0
    )) as gross_amount,
    greatest(0, coalesce(
      nullif(line.item ->> 'amountPaid', '')::numeric,
      0
    )) as baseline_paid
  from public.customer_invoices invoice
  join public.customer_invoice_line_claims claim
    on claim.invoice_id = invoice.id
   and claim.owner_id = invoice.owner_id
   and claim.source_type = 'sale'
   and claim.released_at is null
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(invoice.payload -> 'history') = 'array'
        then invoice.payload -> 'history'
      else '[]'::jsonb
    end
  ) as line(item)
  where invoice.payment_status = 'paid'
    and private.paid_invoice_fully_reconcilable(
      invoice.id,
      invoice.owner_id,
      invoice.customer_id,
      invoice.payload,
      invoice.total_amount
    )
    and btrim(coalesce(line.item ->> 'id', '')) = claim.source_key
)
update public.sales sale
set amount_paid = least(
  sale.total_amount,
  paid_line.baseline_paid
)
from paid_sale_lines paid_line
where sale.owner_id = paid_line.owner_id
  and sale.customer_id = paid_line.customer_id
  and sale.id::text = paid_line.source_key
  and paid_line.baseline_paid < paid_line.gross_amount
  and abs(coalesce(sale.amount_paid, 0) - paid_line.gross_amount) <= 0.005;

-- Backfill keyed paid invoices. Old invoices without stable source IDs are left
-- untouched because fabricating a source match would make reversal destructive.
insert into public.customer_payments (
  id,
  owner_id,
  customer_id,
  invoice_id,
  payment_type,
  amount,
  status,
  received_at,
  recorded_by,
  created_at
)
select
  invoice.id,
  invoice.owner_id,
  invoice.customer_id,
  invoice.id,
  'invoice',
  invoice.total_amount,
  'applied',
  coalesce(invoice.paid_at, invoice.updated_at, invoice.invoice_date, invoice.created_at),
  invoice.paid_by,
  coalesce(invoice.paid_at, invoice.updated_at, invoice.created_at)
from public.customer_invoices invoice
where invoice.payment_status = 'paid'
  and invoice.total_amount > 0
  and private.paid_invoice_fully_reconcilable(
    invoice.id,
    invoice.owner_id,
    invoice.customer_id,
    invoice.payload,
    invoice.total_amount
  )
on conflict (id) do nothing;

insert into public.customer_payment_allocations (
  payment_id,
  owner_id,
  customer_id,
  source_key,
  source_type,
  amount,
  created_at
)
select
  invoice.id,
  invoice.owner_id,
  invoice.customer_id,
  claim.source_key,
  claim.source_type,
  private.customer_invoice_line_balance(line.item),
  coalesce(invoice.paid_at, invoice.updated_at, invoice.created_at)
from public.customer_invoices invoice
join public.customer_payments payment
  on payment.id = invoice.id
 and payment.invoice_id = invoice.id
join public.customer_invoice_line_claims claim
  on claim.invoice_id = invoice.id
 and claim.owner_id = invoice.owner_id
 and claim.released_at is null
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(invoice.payload -> 'history') = 'array'
      then invoice.payload -> 'history'
    else '[]'::jsonb
  end
) as line(item)
where invoice.payment_status = 'paid'
  and private.paid_invoice_fully_reconcilable(
    invoice.id,
    invoice.owner_id,
    invoice.customer_id,
    invoice.payload,
    invoice.total_amount
  )
  and btrim(coalesce(line.item ->> 'id', '')) = claim.source_key
  and private.customer_invoice_line_balance(line.item) > 0
on conflict (payment_id, source_key) do nothing;

-- Source facts become immutable once they participate in invoice or payment
-- history. No-op upserts and edits to non-financial notes remain allowed.
create or replace function private.prevent_referenced_sale_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_invoice_history boolean := false;
  has_payment_history boolean := false;
begin
  if tg_op = 'UPDATE'
     and new.id is not distinct from old.id
     and new.owner_id is not distinct from old.owner_id
     and new.customer_id is not distinct from old.customer_id
     and new.bottle_type is not distinct from old.bottle_type
     and new.quantity is not distinct from old.quantity
     and new.price_per_bottle is not distinct from old.price_per_bottle
     and new.total_amount is not distinct from old.total_amount
     and new.amount_paid is not distinct from old.amount_paid
     and new.payment_schedule is not distinct from old.payment_schedule
     and new.created_at is not distinct from old.created_at then
    return new;
  end if;

  select exists (
    select 1
    from public.customer_invoice_line_claims claim
    where claim.owner_id = old.owner_id
      and claim.customer_id = old.customer_id
      and claim.source_key = old.id::text
      and claim.source_type = 'sale'
  ) into has_invoice_history;

  select exists (
    select 1
    from public.customer_payment_allocations allocation
    where allocation.owner_id = old.owner_id
      and allocation.customer_id = old.customer_id
      and allocation.source_key = old.id::text
      and allocation.source_type = 'sale'
  ) into has_payment_history;

  if has_invoice_history or has_payment_history then
    raise exception 'Sale entry is referenced by invoice or payment history and its financial fields cannot be changed or deleted'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

revoke all on function private.prevent_referenced_sale_mutation()
  from public, anon, authenticated;

drop trigger if exists sales_prevent_referenced_mutation on public.sales;
create trigger sales_prevent_referenced_mutation
before update of id, owner_id, customer_id, bottle_type, quantity,
  price_per_bottle, total_amount, amount_paid, payment_schedule, created_at
or delete on public.sales
for each row execute function private.prevent_referenced_sale_mutation();

-- Invoice creation must validate balances and claim sources under the same
-- customer-scoped transaction lock used by both payment RPCs.
create or replace function private.require_transactional_invoice_create()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('app.transactional_invoice_create', true) is distinct from 'on' then
    raise exception 'Use create_customer_invoice to create an invoice'
      using errcode = '55000';
  end if;
  return new;
end
$$;

revoke all on function private.require_transactional_invoice_create()
  from public, anon, authenticated;

drop trigger if exists customer_invoices_require_transactional_create
  on public.customer_invoices;
create trigger customer_invoices_require_transactional_create
before insert on public.customer_invoices
for each row execute function private.require_transactional_invoice_create();

create or replace function public.create_customer_invoice(
  p_customer_id text,
  p_invoice_number text,
  p_invoice_date timestamptz,
  p_payload jsonb,
  p_total_amount numeric,
  p_total_qty integer
)
returns public.customer_invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_uid uuid := (select auth.uid());
  owner_uuid uuid := private.current_owner_id();
  invoice_row public.customer_invoices;
  sale_row public.sales;
  order_row public.customer_orders;
  invoice_history jsonb;
  line_item jsonb;
  seen_keys text[] := array[]::text[];
  source_key_value text;
  source_type_value text;
  order_uuid uuid;
  order_line_index integer;
  line_due numeric := 0;
  invoice_line_total numeric := 0;
  source_total numeric := 0;
  source_direct_paid numeric := 0;
  source_allocated numeric := 0;
  source_remaining numeric := 0;
begin
  if caller_uid is null or owner_uuid is null then
    raise exception 'An active administrator session is required to create invoices'
      using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_customer_id, '')), '') is null then
    raise exception 'A customer is required to create an invoice'
      using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_invoice_number, '')), '') is null then
    raise exception 'An invoice number is required'
      using errcode = '22023';
  end if;
  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'Invoices require an unpaid balance greater than zero'
      using errcode = '23514';
  end if;
  if p_total_qty is null or p_total_qty < 0 then
    raise exception 'Invoice quantity cannot be negative'
      using errcode = '23514';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'Invoice payload must be a JSON object'
      using errcode = '22023';
  end if;

  invoice_history := case
    when jsonb_typeof(p_payload -> 'history') = 'array'
      then p_payload -> 'history'
    else '[]'::jsonb
  end;
  if jsonb_array_length(invoice_history) = 0 then
    raise exception 'Invoices require at least one source line'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(owner_uuid::text),
    hashtext(p_customer_id)
  );
  perform 1
  from public.customers customer
  where customer.owner_id = owner_uuid
    and customer.id = p_customer_id
  for update;
  if not found then
    raise exception 'Customer not found for this business'
      using errcode = 'P0002';
  end if;

  for line_item in select value from jsonb_array_elements(invoice_history)
  loop
    source_key_value := btrim(coalesce(line_item ->> 'id', ''));
    source_type_value := case
      when coalesce(
        line_item ->> 'recordType',
        line_item ->> 'record_type',
        ''
      ) = 'customer_order'
        or source_key_value like 'customer-order:%'
        then 'customer_order'
      else 'sale'
    end;
    line_due := private.customer_invoice_line_balance(line_item);

    if source_key_value = '' then
      raise exception 'Every invoice line needs a stable source ID'
        using errcode = '22023';
    end if;
    if source_key_value = any(seen_keys) then
      raise exception 'An invoice cannot contain the same source more than once'
        using errcode = '22023';
    end if;
    seen_keys := array_append(seen_keys, source_key_value);

    if exists (
      select 1
      from public.customer_invoice_line_claims claim
      where claim.owner_id = owner_uuid
        and claim.source_key = source_key_value
        and claim.released_at is null
    ) then
      raise exception 'One or more invoice source lines are already claimed by another active invoice'
        using errcode = '23505';
    end if;

    select coalesce(sum(allocation.amount), 0)
    into source_allocated
    from public.customer_payment_allocations allocation
    join public.customer_payments payment
      on payment.id = allocation.payment_id
     and payment.status = 'applied'
    where allocation.owner_id = owner_uuid
      and allocation.customer_id = p_customer_id
      and allocation.source_key = source_key_value;

    if source_type_value = 'sale' then
      select * into sale_row
      from public.sales sale
      where sale.owner_id = owner_uuid
        and sale.customer_id = p_customer_id
        and sale.id::text = source_key_value
      for update;
      if sale_row.id is null then
        raise exception 'Invoice sale source % no longer exists', source_key_value
          using errcode = 'P0002';
      end if;
      source_total := greatest(0, coalesce(sale_row.total_amount, 0));
      source_direct_paid := greatest(0, coalesce(sale_row.amount_paid, 0));
    else
      if source_key_value !~ '^customer-order:[0-9a-fA-F-]{36}:[0-9]+$' then
        raise exception 'Invoice order source % is invalid', source_key_value
          using errcode = '22023';
      end if;
      begin
        order_uuid := split_part(source_key_value, ':', 2)::uuid;
        order_line_index := split_part(source_key_value, ':', 3)::integer;
      exception when invalid_text_representation then
        raise exception 'Invoice order source % is invalid', source_key_value
          using errcode = '22023';
      end;

      select * into order_row
      from public.customer_orders customer_order
      where customer_order.owner_id = owner_uuid
        and customer_order.customer_id = p_customer_id
        and customer_order.id = order_uuid
        and customer_order.status in ('delivered', 'fulfilled', 'completed')
      for update;
      if order_row.id is null then
        raise exception 'Invoice delivered-order source % no longer exists', source_key_value
          using errcode = 'P0002';
      end if;
      source_total := private.customer_order_line_total(order_uuid, order_line_index);
      source_direct_paid := 0;
      if source_total is null then
        raise exception 'Invoice delivered-order line % no longer exists', source_key_value
          using errcode = 'P0002';
      end if;
    end if;

    source_remaining := greatest(
      0,
      source_total - source_direct_paid - source_allocated
    );
    if abs(line_due - source_remaining) > 0.005 then
      raise exception 'Invoice source % balance changed from % to %; refresh and try again',
        source_key_value, line_due, source_remaining
        using errcode = '23514';
    end if;
    invoice_line_total := invoice_line_total + line_due;
  end loop;

  if abs(invoice_line_total - p_total_amount) > 0.005 then
    raise exception 'Invoice lines total % but invoice amount is %',
      invoice_line_total, p_total_amount using errcode = '23514';
  end if;

  perform set_config('app.transactional_invoice_create', 'on', true);
  insert into public.customer_invoices (
    owner_id,
    customer_id,
    invoice_number,
    invoice_date,
    payload,
    total_amount,
    total_qty,
    payment_status,
    validated
  ) values (
    owner_uuid,
    p_customer_id,
    btrim(p_invoice_number),
    coalesce(p_invoice_date, now()),
    p_payload,
    p_total_amount,
    p_total_qty,
    'unpaid',
    false
  )
  returning * into invoice_row;

  return invoice_row;
end
$$;

revoke all on function public.create_customer_invoice(
  text, text, timestamptz, jsonb, numeric, integer
) from public, anon;
grant execute on function public.create_customer_invoice(
  text, text, timestamptz, jsonb, numeric, integer
) to authenticated;

-- Once the settlement RPC exists, direct status patches are unsafe because they
-- can bypass source allocations. The transaction-local flag is set only by the
-- authorized RPC below.
create or replace function private.require_transactional_invoice_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_status is distinct from old.payment_status
     and current_setting('app.transactional_invoice_status', true) is distinct from 'on' then
    raise exception 'Use set_customer_invoice_payment_status to change invoice payment status'
      using errcode = '55000';
  end if;
  return new;
end
$$;

revoke all on function private.require_transactional_invoice_status()
  from public, anon, authenticated;

drop trigger if exists customer_invoices_require_transactional_status
  on public.customer_invoices;
create trigger customer_invoices_require_transactional_status
before update of payment_status on public.customer_invoices
for each row execute function private.require_transactional_invoice_status();

create or replace function public.set_customer_invoice_payment_status(
  p_invoice_id uuid default null,
  p_invoice_number text default null,
  p_paid boolean default true
)
returns public.customer_invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_uid uuid := (select auth.uid());
  owner_uuid uuid := private.current_owner_id();
  invoice_row public.customer_invoices;
  sale_row public.sales;
  order_row public.customer_orders;
  line_item jsonb;
  invoice_history jsonb;
  source_key_value text;
  source_type_value text;
  payment_uuid uuid;
  order_uuid uuid;
  order_line_index integer;
  line_due numeric := 0;
  source_total numeric := 0;
  source_direct_paid numeric := 0;
  source_allocated numeric := 0;
  source_remaining numeric := 0;
  payment_allocation_total numeric := 0;
  saved_allocation numeric := 0;
begin
  if caller_uid is null or owner_uuid is null then
    raise exception 'An active administrator session is required to settle invoices'
      using errcode = '42501';
  end if;
  if p_paid is null then
    raise exception 'A paid or unpaid status is required' using errcode = '22023';
  end if;

  if p_invoice_id is not null then
    select * into invoice_row
    from public.customer_invoices invoice
    where invoice.owner_id = owner_uuid
      and invoice.id = p_invoice_id
      and (
        nullif(btrim(coalesce(p_invoice_number, '')), '') is null
        or upper(invoice.invoice_number) = upper(btrim(p_invoice_number))
      )
    for update;
  elsif nullif(btrim(coalesce(p_invoice_number, '')), '') is not null then
    select * into invoice_row
    from public.customer_invoices invoice
    where invoice.owner_id = owner_uuid
      and upper(invoice.invoice_number) = upper(btrim(p_invoice_number))
    for update;
  else
    raise exception 'Invoice ID or invoice number is required' using errcode = '22023';
  end if;

  if invoice_row.id is null then
    raise exception 'Invoice not found for this business' using errcode = 'P0002';
  end if;
  if invoice_row.payment_status = 'void' then
    raise exception 'A void invoice cannot be marked paid or unpaid' using errcode = '55000';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(invoice_row.owner_id::text),
    hashtext(invoice_row.customer_id)
  );
  perform 1
  from public.customers customer
  where customer.owner_id = invoice_row.owner_id
    and customer.id = invoice_row.customer_id
  for update;
  if not found then
    raise exception 'Invoice customer no longer exists' using errcode = 'P0002';
  end if;

  if p_paid then
    invoice_history := case
      when jsonb_typeof(invoice_row.payload -> 'history') = 'array'
        then invoice_row.payload -> 'history'
      else '[]'::jsonb
    end;
    if jsonb_array_length(invoice_history) = 0 then
      raise exception 'Invoice has no stable source history and cannot be settled safely'
        using errcode = '55000';
    end if;

    select payment.id into payment_uuid
    from public.customer_payments payment
    where payment.invoice_id = invoice_row.id
      and payment.status = 'applied'
    for update;

    if payment_uuid is null then
      insert into public.customer_payments (
        owner_id,
        customer_id,
        invoice_id,
        payment_type,
        amount,
        status,
        received_at,
        recorded_by
      ) values (
        invoice_row.owner_id,
        invoice_row.customer_id,
        invoice_row.id,
        'invoice',
        invoice_row.total_amount,
        'applied',
        now(),
        caller_uid
      )
      returning id into payment_uuid;
    elsif not exists (
      select 1
      from public.customer_payments payment
      where payment.id = payment_uuid
        and abs(payment.amount - invoice_row.total_amount) <= 0.005
    ) then
      raise exception 'Saved invoice payment amount does not match the invoice total'
        using errcode = '23514';
    end if;

    for line_item in select value from jsonb_array_elements(invoice_history)
    loop
      source_key_value := btrim(coalesce(line_item ->> 'id', ''));
      source_type_value := case
        when coalesce(
          line_item ->> 'recordType',
          line_item ->> 'record_type',
          ''
        ) = 'customer_order'
          or source_key_value like 'customer-order:%'
          then 'customer_order'
        else 'sale'
      end;
      line_due := greatest(0, coalesce(
        nullif(line_item ->> 'balanceDue', '')::numeric,
        nullif(line_item ->> 'balance_due', '')::numeric,
        greatest(
          0,
          coalesce(
            nullif(line_item ->> 'grossAmount', '')::numeric,
            nullif(line_item ->> 'totalAmount', '')::numeric,
            0
          ) - coalesce(nullif(line_item ->> 'amountPaid', '')::numeric, 0)
        )
      ));

      if source_key_value = '' then
        raise exception 'Every invoice line needs a stable source ID'
          using errcode = '22023';
      end if;
      if line_due <= 0 then continue; end if;
      if not exists (
        select 1
        from public.customer_invoice_line_claims claim
        where claim.invoice_id = invoice_row.id
          and claim.owner_id = invoice_row.owner_id
          and claim.customer_id = invoice_row.customer_id
          and claim.source_key = source_key_value
          and claim.source_type = source_type_value
          and claim.released_at is null
      ) then
        raise exception 'Invoice source % is not actively claimed by this invoice', source_key_value
          using errcode = '55000';
      end if;

      select coalesce(sum(allocation.amount), 0)
      into source_allocated
      from public.customer_payment_allocations allocation
      join public.customer_payments payment
        on payment.id = allocation.payment_id
       and payment.status = 'applied'
      where allocation.owner_id = invoice_row.owner_id
        and allocation.customer_id = invoice_row.customer_id
        and allocation.source_key = source_key_value
        and allocation.payment_id <> payment_uuid;

      if source_type_value = 'sale' then
        select * into sale_row
        from public.sales sale
        where sale.owner_id = invoice_row.owner_id
          and sale.customer_id = invoice_row.customer_id
          and sale.id::text = source_key_value
        for update;
        if sale_row.id is null then
          raise exception 'Invoice sale source % no longer exists', source_key_value
            using errcode = 'P0002';
        end if;
        source_total := greatest(0, coalesce(sale_row.total_amount, 0));
        source_direct_paid := greatest(0, coalesce(sale_row.amount_paid, 0));
      else
        if source_key_value !~ '^customer-order:[0-9a-fA-F-]{36}:[0-9]+$' then
          raise exception 'Invoice order source % is invalid', source_key_value
            using errcode = '22023';
        end if;
        begin
          order_uuid := split_part(source_key_value, ':', 2)::uuid;
          order_line_index := split_part(source_key_value, ':', 3)::integer;
        exception when invalid_text_representation then
          raise exception 'Invoice order source % is invalid', source_key_value
            using errcode = '22023';
        end;

        select * into order_row
        from public.customer_orders customer_order
        where customer_order.owner_id = invoice_row.owner_id
          and customer_order.customer_id = invoice_row.customer_id
          and customer_order.id = order_uuid
          and customer_order.status in ('delivered', 'fulfilled', 'completed')
        for update;
        if order_row.id is null then
          raise exception 'Invoice delivered-order source % no longer exists', source_key_value
            using errcode = 'P0002';
        end if;
        source_total := private.customer_order_line_total(order_uuid, order_line_index);
        source_direct_paid := 0;
        if source_total is null then
          raise exception 'Invoice delivered-order line % no longer exists', source_key_value
            using errcode = 'P0002';
        end if;
      end if;

      source_remaining := greatest(
        0,
        source_total - source_direct_paid - source_allocated
      );
      if line_due > source_remaining + 0.005 then
        raise exception 'Invoice source % has only % remaining, not %',
          source_key_value, source_remaining, line_due
          using errcode = '23514';
      end if;

      insert into public.customer_payment_allocations (
        payment_id,
        owner_id,
        customer_id,
        source_key,
        source_type,
        amount
      ) values (
        payment_uuid,
        invoice_row.owner_id,
        invoice_row.customer_id,
        source_key_value,
        source_type_value,
        line_due
      )
      on conflict (payment_id, source_key) do nothing;

      select allocation.amount into saved_allocation
      from public.customer_payment_allocations allocation
      where allocation.payment_id = payment_uuid
        and allocation.source_key = source_key_value;
      if saved_allocation is null or abs(saved_allocation - line_due) > 0.005 then
        raise exception 'Saved allocation for source % does not match the invoice', source_key_value
          using errcode = '23514';
      end if;
    end loop;

    select coalesce(sum(allocation.amount), 0)
    into payment_allocation_total
    from public.customer_payment_allocations allocation
    where allocation.payment_id = payment_uuid;
    if abs(payment_allocation_total - invoice_row.total_amount) > 0.005 then
      raise exception 'Invoice allocations total % but invoice amount is %',
        payment_allocation_total, invoice_row.total_amount
        using errcode = '23514';
    end if;

    perform set_config('app.transactional_invoice_status', 'on', true);
    update public.customer_invoices
    set payment_status = 'paid'
    where id = invoice_row.id
    returning * into invoice_row;
  else
    if invoice_row.payment_status = 'paid'
       and not exists (
         select 1
         from public.customer_payments payment
         where payment.invoice_id = invoice_row.id
           and payment.status = 'applied'
       ) then
      raise exception 'This legacy paid invoice has no reversible payment allocation'
        using errcode = '55000';
    end if;

    update public.customer_payments
    set status = 'reversed',
        reversed_at = now(),
        reversed_by = caller_uid
    where invoice_id = invoice_row.id
      and status = 'applied';

    perform set_config('app.transactional_invoice_status', 'on', true);
    update public.customer_invoices
    set payment_status = 'unpaid'
    where id = invoice_row.id
    returning * into invoice_row;
  end if;

  return invoice_row;
end
$$;

revoke all on function public.set_customer_invoice_payment_status(uuid, text, boolean)
  from public, anon;
grant execute on function public.set_customer_invoice_payment_status(uuid, text, boolean)
  to authenticated;

-- The client calculates oldest-first allocation for presentation, while this
-- RPC validates every amount against locked server rows before persisting it.
create or replace function public.record_customer_monthly_payment(
  p_customer_id text,
  p_amount numeric,
  p_allocations jsonb
)
returns public.customer_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_uid uuid := (select auth.uid());
  owner_uuid uuid := private.current_owner_id();
  payment_row public.customer_payments;
  sale_row public.sales;
  order_row public.customer_orders;
  allocation_line jsonb;
  seen_keys text[] := array[]::text[];
  source_key_value text;
  source_type_value text;
  order_uuid uuid;
  order_line_index integer;
  line_amount numeric := 0;
  allocation_sum numeric := 0;
  source_total numeric := 0;
  source_direct_paid numeric := 0;
  source_allocated numeric := 0;
  source_remaining numeric := 0;
begin
  if caller_uid is null or owner_uuid is null then
    raise exception 'An active administrator session is required to record payments'
      using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero' using errcode = '22023';
  end if;
  if jsonb_typeof(p_allocations) is distinct from 'array'
     or jsonb_array_length(p_allocations) = 0 then
    raise exception 'At least one payment allocation is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(owner_uuid::text), hashtext(p_customer_id));
  perform 1
  from public.customers customer
  where customer.owner_id = owner_uuid
    and customer.id = p_customer_id
  for update;
  if not found then
    raise exception 'Customer not found for this business' using errcode = 'P0002';
  end if;

  insert into public.customer_payments (
    owner_id,
    customer_id,
    payment_type,
    amount,
    status,
    received_at,
    recorded_by
  ) values (
    owner_uuid,
    p_customer_id,
    'monthly',
    p_amount,
    'applied',
    now(),
    caller_uid
  )
  returning * into payment_row;

  for allocation_line in select value from jsonb_array_elements(p_allocations)
  loop
    source_key_value := btrim(coalesce(
      allocation_line ->> 'sourceKey',
      allocation_line ->> 'source_key',
      ''
    ));
    source_type_value := btrim(coalesce(
      allocation_line ->> 'sourceType',
      allocation_line ->> 'source_type',
      ''
    ));
    line_amount := coalesce(nullif(allocation_line ->> 'amount', '')::numeric, 0);

    if source_key_value = '' or source_type_value not in ('sale', 'customer_order') then
      raise exception 'Every allocation needs a valid source key and type'
        using errcode = '22023';
    end if;
    if source_key_value = any(seen_keys) then
      raise exception 'A payment cannot allocate the same source twice'
        using errcode = '22023';
    end if;
    if line_amount <= 0 then
      raise exception 'Every allocation amount must be greater than zero'
        using errcode = '22023';
    end if;
    seen_keys := array_append(seen_keys, source_key_value);

    if exists (
      select 1
      from public.customer_invoice_line_claims claim
      join public.customer_invoices invoice on invoice.id = claim.invoice_id
      where claim.owner_id = owner_uuid
        and claim.customer_id = p_customer_id
        and claim.source_key = source_key_value
        and claim.released_at is null
        and invoice.payment_status <> 'void'
    ) then
      raise exception 'Source % is already covered by an active invoice; settle that invoice instead',
        source_key_value using errcode = '55000';
    end if;

    select coalesce(sum(allocation.amount), 0)
    into source_allocated
    from public.customer_payment_allocations allocation
    join public.customer_payments payment
      on payment.id = allocation.payment_id
     and payment.status = 'applied'
    where allocation.owner_id = owner_uuid
      and allocation.customer_id = p_customer_id
      and allocation.source_key = source_key_value;

    if source_type_value = 'sale' then
      select * into sale_row
      from public.sales sale
      where sale.owner_id = owner_uuid
        and sale.customer_id = p_customer_id
        and sale.id::text = source_key_value
      for update;
      if sale_row.id is null then
        raise exception 'Sale source % does not exist', source_key_value
          using errcode = 'P0002';
      end if;
      if coalesce(sale_row.payment_schedule, 'monthly') <> 'monthly' then
        raise exception 'Pay-on-delivery sale % cannot receive a monthly allocation', source_key_value
          using errcode = '23514';
      end if;
      source_total := greatest(0, coalesce(sale_row.total_amount, 0));
      source_direct_paid := greatest(0, coalesce(sale_row.amount_paid, 0));
    else
      if source_key_value !~ '^customer-order:[0-9a-fA-F-]{36}:[0-9]+$' then
        raise exception 'Delivered-order source % is invalid', source_key_value
          using errcode = '22023';
      end if;
      begin
        order_uuid := split_part(source_key_value, ':', 2)::uuid;
        order_line_index := split_part(source_key_value, ':', 3)::integer;
      exception when invalid_text_representation then
        raise exception 'Delivered-order source % is invalid', source_key_value
          using errcode = '22023';
      end;

      select * into order_row
      from public.customer_orders customer_order
      where customer_order.owner_id = owner_uuid
        and customer_order.customer_id = p_customer_id
        and customer_order.id = order_uuid
        and customer_order.status in ('delivered', 'fulfilled', 'completed')
      for update;
      if order_row.id is null then
        raise exception 'Delivered-order source % does not exist', source_key_value
          using errcode = 'P0002';
      end if;
      if coalesce(order_row.payment_schedule, 'monthly') <> 'monthly' then
        raise exception 'Pay-on-delivery customer orders cannot receive a monthly allocation'
          using errcode = '23514';
      end if;
      source_total := private.customer_order_line_total(order_uuid, order_line_index);
      source_direct_paid := 0;
      if source_total is null then
        raise exception 'Delivered-order line % does not exist', source_key_value
          using errcode = 'P0002';
      end if;
    end if;

    source_remaining := greatest(
      0,
      source_total - source_direct_paid - source_allocated
    );
    if line_amount > source_remaining + 0.005 then
      raise exception 'Payment allocation for % exceeds its remaining balance of %',
        source_key_value, source_remaining using errcode = '23514';
    end if;

    insert into public.customer_payment_allocations (
      payment_id,
      owner_id,
      customer_id,
      source_key,
      source_type,
      amount
    ) values (
      payment_row.id,
      owner_uuid,
      p_customer_id,
      source_key_value,
      source_type_value,
      line_amount
    );
    allocation_sum := allocation_sum + line_amount;
  end loop;

  if abs(allocation_sum - p_amount) > 0.005 then
    raise exception 'Payment allocations total % but payment amount is %',
      allocation_sum, p_amount using errcode = '23514';
  end if;

  return payment_row;
end
$$;

revoke all on function public.record_customer_monthly_payment(text, numeric, jsonb)
  from public, anon;
grant execute on function public.record_customer_monthly_payment(text, numeric, jsonb)
  to authenticated;

-- Linked customers can review manual deliveries without receiving SELECT on
-- the business-wide sales table. Identity is derived exclusively from the
-- authenticated user; no customer or owner identifier is accepted as input.
create or replace function public.get_customer_manual_sales_history()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_uid uuid := (select auth.uid());
  linked_owner_id uuid;
  linked_customer_id text;
  result jsonb;
begin
  if caller_uid is null then
    raise exception 'An authenticated customer session is required'
      using errcode = '42501';
  end if;

  select customer.owner_id, customer.id
  into linked_owner_id, linked_customer_id
  from public.customers customer
  where customer.auth_user_id = caller_uid
    and customer.active = true
  limit 1;

  if linked_customer_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sale.id,
        'bottle_type', sale.bottle_type,
        'quantity', sale.quantity,
        'price_per_bottle', sale.price_per_bottle,
        'total_amount', sale.total_amount,
        'amount_paid', least(
          greatest(0, coalesce(sale.total_amount, 0)),
          greatest(0, coalesce(sale.amount_paid, 0))
            + greatest(0, coalesce(active_allocation.amount, 0))
        ),
        'balance_due', greatest(
          0,
          greatest(0, coalesce(sale.total_amount, 0))
            - greatest(0, coalesce(sale.amount_paid, 0))
            - greatest(0, coalesce(active_allocation.amount, 0))
        ),
        'payment_schedule', coalesce(sale.payment_schedule, 'monthly'),
        'created_at', sale.created_at
      )
      order by sale.created_at desc, sale.id::text desc
    ),
    '[]'::jsonb
  ) into result
  from public.sales sale
  left join lateral (
    select coalesce(sum(allocation.amount), 0) as amount
    from public.customer_payment_allocations allocation
    join public.customer_payments payment
      on payment.id = allocation.payment_id
     and payment.owner_id = allocation.owner_id
     and payment.customer_id = allocation.customer_id
     and payment.status = 'applied'
    where allocation.owner_id = sale.owner_id
      and allocation.customer_id = sale.customer_id
      and allocation.source_key = sale.id::text
      and allocation.source_type = 'sale'
  ) active_allocation on true
  where sale.owner_id = linked_owner_id
    and sale.customer_id = linked_customer_id;

  return result;
end
$$;

revoke all on function public.get_customer_manual_sales_history()
  from public, anon;
grant execute on function public.get_customer_manual_sales_history()
  to authenticated;

-- Public invoice verification needs display data, not internal customer, sale,
-- order, or allocation identifiers.
create or replace function public.lookup_invoice_by_number(p_invoice_number text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select
    jsonb_set(
      jsonb_set(
        invoice.payload,
        '{customer}',
        coalesce(invoice.payload -> 'customer', '{}'::jsonb) - 'id',
        true
      ),
      '{history}',
      coalesce(
        (
          select jsonb_agg(
            line.item - 'id' - 'orderId' - 'order_id'
            order by line.position
          )
          from jsonb_array_elements(
            case
              when jsonb_typeof(invoice.payload -> 'history') = 'array'
                then invoice.payload -> 'history'
              else '[]'::jsonb
            end
          ) with ordinality as line(item, position)
        ),
        '[]'::jsonb
      ),
      true
    ) || jsonb_build_object(
      'invoice_number', invoice.invoice_number,
      'invoice_date', invoice.invoice_date,
      'total_amount', invoice.total_amount,
      'total_qty', invoice.total_qty,
      'payment_status', invoice.payment_status,
      'validated', invoice.validated
    )
  from public.customer_invoices invoice
  where upper(invoice.invoice_number) = upper(btrim(p_invoice_number))
  limit 1
$$;

revoke all on function public.lookup_invoice_by_number(text) from public;
grant execute on function public.lookup_invoice_by_number(text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
