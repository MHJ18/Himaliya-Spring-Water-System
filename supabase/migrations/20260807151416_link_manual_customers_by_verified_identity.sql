begin;

-- Keep customer identity matching consistent with the application's +92 phone
-- normalization. This also covers legacy rows saved as 03xx or 0092 numbers.
create or replace function private.normalize_customer_phone(p_phone text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when digits like '0092%' then substr(digits, 3)
    when digits like '92%' then digits
    when digits like '0%' then '92' || substr(digits, 2)
    when length(digits) = 10 then '92' || digits
    else digits
  end
  from (
    select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as digits
  ) normalized
$$;

revoke all on function private.normalize_customer_phone(text)
  from public, anon, authenticated;

-- Keep the verified-email lookup bounded to the current business. The phone
-- normalizer remains private and is intentionally not used in an expression
-- index, so ordinary authenticated writes never need EXECUTE on that helper.
create index if not exists customers_owner_unclaimed_email_idx
  on public.customers (owner_id, lower(trim(email)))
  where auth_user_id is null and nullif(trim(coalesce(email, '')), '') is not null;

-- Claim the existing canonical customer row so sales, orders and invoices keep
-- their original customer_id. A full name is deliberately not an identity:
-- automatic history linking requires a confirmed Auth email or confirmed Auth
-- phone number and refuses ambiguous duplicates for an administrator to review.
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
  auth_phone text;
  email_is_confirmed boolean := false;
  phone_is_confirmed boolean := false;
  normalized_phone text := private.normalize_customer_phone(p_phone);
  candidate_id text;
  candidate_count integer := 0;
  match_method text := 'new customer';
  customer_row public.customers;
begin
  if request_uid is null then
    raise exception 'Sign in is required to create a customer profile';
  end if;

  select
    lower(trim(email)),
    private.normalize_customer_phone(phone),
    email_confirmed_at is not null,
    phone_confirmed_at is not null
  into auth_email, auth_phone, email_is_confirmed, phone_is_confirmed
  from auth.users
  where id = request_uid;

  if email_is_confirmed is not true then
    raise exception 'Confirm your signup email before creating a customer profile';
  end if;
  if auth_email is null or auth_email <> lower(trim(coalesce(p_email, ''))) then
    raise exception 'The signup email does not match the authenticated account';
  end if;
  if trim(coalesce(p_name, '')) = '' then raise exception 'Full name is required'; end if;
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
        phone = normalized_phone,
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

  -- An explicit customer ID is only a hint; it still needs a matching verified
  -- email or normalized phone number before any historical row can be claimed.
  if nullif(trim(coalesce(p_customer_id, '')), '') is not null then
    select count(*), min(id) into candidate_count, candidate_id
    from public.customers
    where owner_id = owner_uuid
      and id = trim(p_customer_id)
      and auth_user_id is null
      and (
        lower(trim(coalesce(email, ''))) = auth_email
        or (
          phone_is_confirmed
          and auth_phone = normalized_phone
          and private.normalize_customer_phone(phone) = auth_phone
        )
      );
    if candidate_count = 1 then match_method := 'customer ID and verified identity'; end if;
  end if;

  if candidate_count <> 1 then
    select count(*), min(id) into candidate_count, candidate_id
    from public.customers
    where owner_id = owner_uuid
      and auth_user_id is null
      and nullif(trim(coalesce(email, '')), '') is not null
      and lower(trim(email)) = auth_email;
    if candidate_count = 1 then match_method := 'email'; end if;
    if candidate_count > 1 then
      raise exception 'Multiple customer records match this email. Contact Himaliya Spring Water to merge them safely.';
    end if;
  end if;

  if candidate_count <> 1 and phone_is_confirmed and auth_phone = normalized_phone then
    select count(*), min(id) into candidate_count, candidate_id
    from public.customers
    where owner_id = owner_uuid
      and auth_user_id is null
      and nullif(trim(coalesce(phone, '')), '') is not null
      and private.normalize_customer_phone(phone) = auth_phone;
    if candidate_count = 1 then match_method := 'phone number'; end if;
    if candidate_count > 1 then
      raise exception 'Multiple customer records match this phone number. Contact Himaliya Spring Water to merge them safely.';
    end if;
  end if;

  if candidate_count = 1 and candidate_id is not null then
    update public.customers
    set auth_user_id = request_uid,
        name = trim(p_name),
        email = auth_email,
        phone = normalized_phone,
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
      owner_uuid, request_uid, trim(p_name), auth_email, normalized_phone,
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

notify pgrst, 'reload schema';

commit;
