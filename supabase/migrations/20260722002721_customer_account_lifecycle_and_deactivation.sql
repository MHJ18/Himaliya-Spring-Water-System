begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- A single indexed lookup is reused by every customer-facing RLS policy.
create or replace function private.customer_account_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.customers
    where auth_user_id = (select auth.uid())
      and active = true
  )
$$;

revoke all on function private.customer_account_is_active() from public, anon;
grant execute on function private.customer_account_is_active() to authenticated;

-- Claim an admin-created customer when that person later creates an app login.
-- Email is verified against auth.users. Phone and name matching are scoped to the
-- configured business and only accepted when the match is unambiguous.
create or replace function public.claim_customer_account(
  p_name text,
  p_email text,
  p_phone text,
  p_address text,
  p_preferences jsonb default null,
  p_customer_id text default null
)
returns public.customers
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_uid uuid := (select auth.uid());
  owner_uuid uuid;
  auth_email text;
  normalized_name text := lower(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'));
  normalized_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  candidate_id text;
  candidate_count integer := 0;
  match_method text := 'new customer';
  customer_row public.customers;
begin
  if request_uid is null then
    raise exception 'Sign in is required to create a customer profile';
  end if;

  select lower(email) into auth_email
  from auth.users
  where id = request_uid;

  if auth_email is null or auth_email <> lower(trim(coalesce(p_email, ''))) then
    raise exception 'The signup email does not match the authenticated account';
  end if;
  if normalized_name = '' then raise exception 'Full name is required'; end if;
  if normalized_phone = '' then raise exception 'Phone number is required'; end if;
  if trim(coalesce(p_address, '')) = '' then raise exception 'Delivery address is required'; end if;
  if p_preferences is not null and jsonb_typeof(p_preferences) <> 'object' then
    raise exception 'Customer preferences must be an object';
  end if;

  owner_uuid := private.default_owner_id();
  if owner_uuid is null then
    raise exception 'An active Owner administrator is required before customers can sign up';
  end if;

  select * into customer_row
  from public.customers
  where auth_user_id = request_uid
  for update;

  if customer_row.id is not null then
    if customer_row.active is not true then
      raise exception 'This customer account has been deactivated. Contact Himaliya Spring Water.';
    end if;

    update public.customers
    set name = trim(p_name),
        email = auth_email,
        phone = trim(p_phone),
        address = trim(p_address),
        source = case when source = 'admin' then 'both' else source end,
        preferences = case
          when p_preferences is null then preferences
          else preferences || p_preferences
        end,
        updated_at = now()
    where id = customer_row.id
    returning * into customer_row;
    return customer_row;
  end if;

  -- Optional customer ID is only accepted with a second matching identifier.
  if nullif(trim(coalesce(p_customer_id, '')), '') is not null then
    select count(*), min(id) into candidate_count, candidate_id
    from public.customers
    where owner_id = owner_uuid
      and id = trim(p_customer_id)
      and auth_user_id is null
      and (
        lower(trim(coalesce(email, ''))) = auth_email
        or regexp_replace(coalesce(phone, ''), '\D', '', 'g') = normalized_phone
        or lower(regexp_replace(trim(name), '\s+', ' ', 'g')) = normalized_name
      );
    if candidate_count = 1 then match_method := 'customer ID'; end if;
  end if;

  if candidate_count <> 1 then
    select count(*), min(id) into candidate_count, candidate_id
    from public.customers
    where owner_id = owner_uuid
      and auth_user_id is null
      and nullif(trim(coalesce(email, '')), '') is not null
      and lower(trim(email)) = auth_email;
    if candidate_count = 1 then match_method := 'email'; end if;
  end if;

  if candidate_count <> 1 then
    select count(*), min(id) into candidate_count, candidate_id
    from public.customers
    where owner_id = owner_uuid
      and auth_user_id is null
      and regexp_replace(coalesce(phone, ''), '\D', '', 'g') = normalized_phone;
    if candidate_count = 1 then match_method := 'phone number'; end if;
  end if;

  if candidate_count <> 1 then
    select count(*), min(id) into candidate_count, candidate_id
    from public.customers
    where owner_id = owner_uuid
      and auth_user_id is null
      and lower(regexp_replace(trim(name), '\s+', ' ', 'g')) = normalized_name;
    if candidate_count = 1 then match_method := 'full name'; end if;
  end if;

  if candidate_count = 1 and candidate_id is not null then
    update public.customers
    set auth_user_id = request_uid,
        name = trim(p_name),
        email = auth_email,
        phone = trim(p_phone),
        address = trim(p_address),
        source = case when source = 'admin' then 'both' else 'portal' end,
        preferences = case
          when p_preferences is null then preferences
          else preferences || p_preferences
        end,
        updated_at = now()
    where owner_id = owner_uuid and id = candidate_id and auth_user_id is null
    returning * into customer_row;
  else
    insert into public.customers (
      owner_id, auth_user_id, name, email, phone, address, source, preferences
    ) values (
      owner_uuid, request_uid, trim(p_name), auth_email, trim(p_phone),
      trim(p_address), 'portal',
      jsonb_build_object(
        'theme', 'dark',
        'browserNotifications', true,
        'orderUpdates', true,
        'invoiceAlerts', true,
        'defaultBottleType', 'Gallon',
        'defaultQuantity', 1
      ) || coalesce(p_preferences, '{}'::jsonb)
    )
    returning * into customer_row;
  end if;

  if customer_row.id is null then
    raise exception 'Customer account creation could not be completed';
  end if;

  insert into public.customer_notifications (
    owner_id, auth_user_id, audience, type, title, detail
  ) values (
    owner_uuid,
    request_uid,
    'admin',
    'account',
    customer_row.name || ' signed up',
    case
      when match_method = 'new customer' then customer_row.name || ' created a new customer app account.'
      else customer_row.name || ' signed up and was linked to the existing customer by ' || match_method || '.'
    end
  );

  return customer_row;
end
$$;

revoke all on function public.claim_customer_account(text, text, text, text, jsonb, text)
  from public, anon;
grant execute on function public.claim_customer_account(text, text, text, text, jsonb, text)
  to authenticated;

create or replace function public.get_customer_account_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_build_object('exists', true, 'active', active, 'customerId', id)
      from public.customers
      where auth_user_id = (select auth.uid())
      limit 1
    ),
    jsonb_build_object('exists', false, 'active', false)
  )
$$;

revoke all on function public.get_customer_account_status() from public, anon;
grant execute on function public.get_customer_account_status() to authenticated;

create index if not exists customer_notifications_admin_unread_type_idx
  on public.customer_notifications (owner_id, type, created_at desc)
  where audience = 'admin' and read = false;

-- Deactivation is enforced at the data layer so an existing browser session
-- cannot continue reading or mutating customer data.
drop policy if exists "Customers create own canonical account" on public.customers;
drop policy if exists "Customers read own canonical account" on public.customers;
create policy "Customers read active own canonical account" on public.customers
for select to authenticated
using (auth_user_id = (select auth.uid()) and active = true);
drop policy if exists "Customers update own canonical account" on public.customers;
create policy "Customers update active own canonical account" on public.customers
for update to authenticated
using (auth_user_id = (select auth.uid()) and active = true)
with check (
  auth_user_id = (select auth.uid())
  and owner_id = (select private.default_owner_id())
  and active = true
);

drop policy if exists "Customers view own orders" on public.customer_orders;
create policy "Active customers view own orders" on public.customer_orders
for select to authenticated
using (auth_user_id = (select auth.uid()) and (select private.customer_account_is_active()));
drop policy if exists "Customers create own orders" on public.customer_orders;
create policy "Active customers create own orders" on public.customer_orders
for insert to authenticated
with check (auth_user_id = (select auth.uid()) and (select private.customer_account_is_active()));
drop policy if exists "Customers cancel own pending orders" on public.customer_orders;
create policy "Active customers cancel own pending orders" on public.customer_orders
for update to authenticated
using (
  auth_user_id = (select auth.uid())
  and status = 'pending'
  and (select private.customer_account_is_active())
  and private.workflow_boolean(owner_id, 'allowCustomerCancellation', true)
)
with check (
  auth_user_id = (select auth.uid())
  and status in ('pending', 'canceled')
  and (select private.customer_account_is_active())
  and private.workflow_boolean(owner_id, 'allowCustomerCancellation', true)
);

drop policy if exists "Customers read own notifications" on public.customer_notifications;
create policy "Active customers read own notifications" on public.customer_notifications
for select to authenticated
using (
  audience = 'customer'
  and auth_user_id = (select auth.uid())
  and (select private.customer_account_is_active())
);
drop policy if exists "Customers mark own notifications" on public.customer_notifications;
create policy "Active customers mark own notifications" on public.customer_notifications
for update to authenticated
using (
  audience = 'customer'
  and auth_user_id = (select auth.uid())
  and (select private.customer_account_is_active())
)
with check (
  audience = 'customer'
  and auth_user_id = (select auth.uid())
  and (select private.customer_account_is_active())
);

drop policy if exists "Customers read own invoices" on public.customer_invoices;
create policy "Active customers read own invoices" on public.customer_invoices
for select to authenticated
using (exists (
  select 1 from public.customers customer
  where customer.owner_id = customer_invoices.owner_id
    and customer.id = customer_invoices.customer_id
    and customer.auth_user_id = (select auth.uid())
    and customer.active = true
));

drop policy if exists "Customers read own bottle prices" on public.customer_bottle_prices;
create policy "Active customers read own bottle prices" on public.customer_bottle_prices
for select to authenticated
using (exists (
  select 1 from public.customers customer
  where customer.owner_id = customer_bottle_prices.owner_id
    and customer.id = customer_bottle_prices.customer_id
    and customer.auth_user_id = (select auth.uid())
    and customer.active = true
));

drop policy if exists "Customers read own conversations" on public.customer_conversations;
create policy "Active customers read own conversations" on public.customer_conversations
for select to authenticated
using (auth_user_id = (select auth.uid()) and (select private.customer_account_is_active()));

drop policy if exists "Customers read own messages" on public.customer_messages;
create policy "Active customers read own messages" on public.customer_messages
for select to authenticated
using (
  (select private.customer_account_is_active())
  and exists (
    select 1 from public.customer_conversations conversation
    where conversation.id = customer_messages.conversation_id
      and conversation.auth_user_id = (select auth.uid())
  )
);
drop policy if exists "Customers send own messages" on public.customer_messages;
create policy "Active customers send own messages" on public.customer_messages
for insert to authenticated
with check (
  (select private.customer_account_is_active())
  and sender_role = 'customer'
  and sender_auth_user_id = (select auth.uid())
  and exists (
    select 1 from public.customer_conversations conversation
    where conversation.id = customer_messages.conversation_id
      and conversation.auth_user_id = (select auth.uid())
  )
);

notify pgrst, 'reload schema';

commit;
