begin;

-- Billing terms are deliberately kept outside public.customers. Customers can
-- update their own contact profile, while only administrators should be able
-- to decide whether an account pays on delivery or at month end.
create table if not exists public.customer_billing_profiles (
  owner_id uuid not null default private.current_owner_id()
    references auth.users(id) on delete cascade,
  customer_id text not null,
  payment_schedule text not null default 'monthly',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, customer_id),
  constraint customer_billing_profiles_owner_customer_fkey
    foreign key (owner_id, customer_id)
    references public.customers (owner_id, id)
    on delete cascade,
  constraint customer_billing_profiles_payment_schedule_check
    check (payment_schedule in ('monthly', 'on_delivery'))
);

create index if not exists customer_billing_profiles_schedule_idx
  on public.customer_billing_profiles (owner_id, payment_schedule, customer_id);

alter table public.customer_billing_profiles enable row level security;

drop policy if exists "Admins manage customer billing profiles"
  on public.customer_billing_profiles;
create policy "Admins manage customer billing profiles"
on public.customer_billing_profiles
for all
to authenticated
using (owner_id = (select private.current_owner_id()))
with check (owner_id = (select private.current_owner_id()));

revoke all on table public.customer_billing_profiles
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.customer_billing_profiles
  to authenticated;
grant all on table public.customer_billing_profiles to service_role;

-- Preserve the existing end-of-month behavior for every current customer.
insert into public.customer_billing_profiles (
  owner_id,
  customer_id,
  payment_schedule,
  created_at,
  updated_at
)
select
  customer.owner_id,
  customer.id,
  'monthly',
  coalesce(customer.created_at, now()),
  now()
from public.customers customer
on conflict (owner_id, customer_id) do nothing;

-- Guarantee that portal signups and any other direct customer inserts receive
-- a secure default profile even when they do not pass through the admin UI.
create or replace function private.create_default_customer_billing_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.customer_billing_profiles (
    owner_id,
    customer_id,
    payment_schedule,
    created_at,
    updated_at
  ) values (
    new.owner_id,
    new.id,
    'monthly',
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (owner_id, customer_id) do nothing;

  return new;
end
$$;

revoke all on function private.create_default_customer_billing_profile()
  from public, anon, authenticated;

drop trigger if exists customers_create_default_billing_profile
  on public.customers;
create trigger customers_create_default_billing_profile
after insert on public.customers
for each row execute function private.create_default_customer_billing_profile();

-- Manual sales can now record a full or partial payment without overpaying the
-- sale. Existing sales remain unpaid because no reliable historical mapping
-- exists between invoice payload lines and individual sale IDs.
alter table public.sales
  add column if not exists amount_paid numeric(12, 2) not null default 0;

alter table public.sales
  drop constraint if exists sales_amount_paid_check;
alter table public.sales
  add constraint sales_amount_paid_check
  check (
    amount_paid >= 0
    and amount_paid <= total_amount
  );

-- Invoice source claims make invoicing idempotent. A sale or delivered order
-- line can belong to only one non-void invoice at a time. Claims are released
-- when an invoice is voided and reactivated if that invoice is restored.
create table if not exists public.customer_invoice_line_claims (
  owner_id uuid not null
    references auth.users(id) on delete cascade,
  invoice_id uuid not null
    references public.customer_invoices(id) on delete cascade,
  customer_id text not null,
  source_key text not null,
  source_type text not null,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (invoice_id, source_key),
  constraint customer_invoice_line_claims_owner_customer_fkey
    foreign key (owner_id, customer_id)
    references public.customers(owner_id, id)
    on delete cascade,
  constraint customer_invoice_line_claims_source_key_check
    check (length(btrim(source_key)) between 1 and 250),
  constraint customer_invoice_line_claims_source_type_check
    check (source_type in ('sale', 'customer_order'))
);

create unique index if not exists customer_invoice_line_claims_active_source_idx
  on public.customer_invoice_line_claims (owner_id, source_key)
  where released_at is null;

create index if not exists customer_invoice_line_claims_customer_active_idx
  on public.customer_invoice_line_claims (owner_id, customer_id, source_key)
  where released_at is null;

alter table public.customer_invoice_line_claims enable row level security;

drop policy if exists "Admins read customer invoice line claims"
  on public.customer_invoice_line_claims;
create policy "Admins read customer invoice line claims"
on public.customer_invoice_line_claims
for select
to authenticated
using (owner_id = (select private.current_owner_id()));

revoke all on table public.customer_invoice_line_claims
  from public, anon, authenticated;
grant select on table public.customer_invoice_line_claims to authenticated;
grant all on table public.customer_invoice_line_claims to service_role;

-- Backfill claims from invoices already generated by payment-aware clients.
-- Older invoices without stable line IDs remain readable, but are deliberately
-- not guessed from dates and amounts because a false match could hide a valid
-- customer balance.
with saved_invoice_lines as (
  select
    invoice.owner_id,
    invoice.id as invoice_id,
    invoice.customer_id,
    btrim(line.item ->> 'id') as source_key,
    case
      when coalesce(
        line.item ->> 'recordType',
        line.item ->> 'record_type',
        ''
      ) = 'customer_order'
        or btrim(line.item ->> 'id') like 'customer-order:%'
        then 'customer_order'
      else 'sale'
    end as source_type,
    invoice.created_at
  from public.customer_invoices invoice
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(invoice.payload -> 'history') = 'array'
        then invoice.payload -> 'history'
      else '[]'::jsonb
    end
  ) as line(item)
  where invoice.payment_status <> 'void'
    and nullif(btrim(line.item ->> 'id'), '') is not null
),
deduplicated_invoice_lines as (
  select distinct on (owner_id, source_key)
    owner_id,
    invoice_id,
    customer_id,
    source_key,
    source_type,
    created_at
  from saved_invoice_lines
  order by owner_id, source_key, created_at, invoice_id
)
insert into public.customer_invoice_line_claims (
  owner_id,
  invoice_id,
  customer_id,
  source_key,
  source_type,
  created_at
)
select
  owner_id,
  invoice_id,
  customer_id,
  source_key,
  source_type,
  created_at
from deduplicated_invoice_lines
on conflict do nothing;

create or replace function private.sync_customer_invoice_line_claims()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice_history jsonb;
  history_count integer;
  keyed_count integer;
  distinct_key_count integer;
begin
  if tg_op = 'INSERT' then
    if new.total_amount <= 0 then
      raise exception 'Invoices require an unpaid balance greater than zero'
        using errcode = '23514';
    end if;

    invoice_history := case
      when jsonb_typeof(new.payload -> 'history') = 'array'
        then new.payload -> 'history'
      else '[]'::jsonb
    end;

    select
      count(*),
      count(*) filter (
        where nullif(btrim(invoice_line.item ->> 'id'), '') is not null
      ),
      count(distinct nullif(btrim(invoice_line.item ->> 'id'), ''))
    into history_count, keyed_count, distinct_key_count
    from jsonb_array_elements(invoice_history) as invoice_line(item);

    if history_count = 0 then
      raise exception 'Invoices require at least one source line'
        using errcode = '22023';
    end if;

    if keyed_count <> history_count or distinct_key_count <> history_count then
      raise exception 'Every invoice source line requires a unique source ID'
        using errcode = '22023';
    end if;

    insert into public.customer_invoice_line_claims (
      owner_id,
      invoice_id,
      customer_id,
      source_key,
      source_type,
      released_at,
      created_at
    )
    select
      new.owner_id,
      new.id,
      new.customer_id,
      btrim(invoice_line.item ->> 'id'),
      case
        when coalesce(
          invoice_line.item ->> 'recordType',
          invoice_line.item ->> 'record_type',
          ''
        ) = 'customer_order'
          or btrim(invoice_line.item ->> 'id') like 'customer-order:%'
          then 'customer_order'
        else 'sale'
      end,
      case when new.payment_status = 'void' then now() else null end,
      coalesce(new.created_at, now())
    from jsonb_array_elements(invoice_history) as invoice_line(item)
    order by btrim(invoice_line.item ->> 'id');

    return new;
  end if;

  if new.owner_id is distinct from old.owner_id
     or new.customer_id is distinct from old.customer_id
     or new.payload is distinct from old.payload
     or new.total_amount is distinct from old.total_amount
     or new.total_qty is distinct from old.total_qty then
    raise exception 'Saved invoice source lines and totals are immutable'
      using errcode = '23514';
  end if;

  if old.payment_status is distinct from new.payment_status then
    if new.payment_status = 'void' then
      update public.customer_invoice_line_claims
      set released_at = now()
      where invoice_id = new.id
        and released_at is null;
    elsif old.payment_status = 'void' then
      update public.customer_invoice_line_claims
      set released_at = null
      where invoice_id = new.id;
    end if;
  end if;

  return new;
exception
  when unique_violation then
    raise exception 'One or more invoice source lines are already claimed by another active invoice'
      using errcode = '23505';
end;
$$;

revoke all on function private.sync_customer_invoice_line_claims()
  from public, anon, authenticated;

drop trigger if exists customer_invoices_sync_line_claims_after_insert
  on public.customer_invoices;
create trigger customer_invoices_sync_line_claims_after_insert
after insert on public.customer_invoices
for each row execute function private.sync_customer_invoice_line_claims();

drop trigger if exists customer_invoices_sync_line_claims_after_update
  on public.customer_invoices;
create trigger customer_invoices_sync_line_claims_after_update
after update of owner_id, customer_id, payload, total_amount, total_qty, payment_status
on public.customer_invoices
for each row execute function private.sync_customer_invoice_line_claims();

-- Trim historical rows before installing the ongoing retention trigger.
-- Admin alerts are one inbox per owner. Customer alerts are separate inboxes
-- per authenticated customer, even when they belong to the same owner.
with ranked_notifications as (
  select
    notification.id,
    row_number() over (
      partition by
        notification.owner_id,
        notification.audience,
        case
          when notification.audience = 'customer'
            then notification.auth_user_id
          else null
        end
      order by notification.created_at desc, notification.id desc
    ) as inbox_position
  from public.customer_notifications notification
)
delete from public.customer_notifications notification
using ranked_notifications ranked
where notification.id = ranked.id
  and ranked.inbox_position > 30;

create or replace function private.prune_customer_notification_inbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serialize pruning for a business so concurrent notification inserts cannot
  -- both observe the same pre-prune inbox size and leave more than 30 rows.
  perform pg_advisory_xact_lock(
    hashtext('customer_notifications'),
    hashtext(new.owner_id::text)
  );

  delete from public.customer_notifications notification
  where notification.id in (
    select retained_candidate.id
    from public.customer_notifications retained_candidate
    where retained_candidate.owner_id = new.owner_id
      and retained_candidate.audience = new.audience
      and (
        new.audience = 'admin'
        or retained_candidate.auth_user_id is not distinct from new.auth_user_id
      )
    order by retained_candidate.created_at desc, retained_candidate.id desc
    offset 30
  );

  return null;
end
$$;

revoke all on function private.prune_customer_notification_inbox()
  from public, anon, authenticated;

drop trigger if exists customer_notifications_prune_after_insert
  on public.customer_notifications;
create trigger customer_notifications_prune_after_insert
after insert on public.customer_notifications
for each row execute function private.prune_customer_notification_inbox();

drop trigger if exists customer_notifications_prune_after_partition_update
  on public.customer_notifications;
create trigger customer_notifications_prune_after_partition_update
after update of owner_id, auth_user_id, audience, created_at
on public.customer_notifications
for each row execute function private.prune_customer_notification_inbox();

-- Customers only need to acknowledge their own alerts. Keep the inbox identity
-- columns immutable at the privilege layer and pin ownership again in RLS.
drop policy if exists "Active customers mark own notifications"
  on public.customer_notifications;
create policy "Active customers mark own notifications"
on public.customer_notifications
for update
to authenticated
using (
  audience = 'customer'
  and auth_user_id = (select auth.uid())
  and exists (
    select 1
    from public.customers customer
    where customer.owner_id = customer_notifications.owner_id
      and customer.auth_user_id = (select auth.uid())
      and customer.active is true
  )
)
with check (
  audience = 'customer'
  and auth_user_id = (select auth.uid())
  and exists (
    select 1
    from public.customers customer
    where customer.owner_id = customer_notifications.owner_id
      and customer.auth_user_id = (select auth.uid())
      and customer.active is true
  )
);

revoke insert, update on table public.customer_notifications
  from authenticated;
grant update (read) on table public.customer_notifications
  to authenticated;
grant all on table public.customer_notifications to service_role;

notify pgrst, 'reload schema';

commit;
