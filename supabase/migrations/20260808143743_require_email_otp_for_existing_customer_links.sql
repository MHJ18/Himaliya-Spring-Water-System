begin;

-- New customers may create a fresh portal profile without proving an email.
-- Linking an existing customer row is different: that row can expose delivery
-- addresses, orders, invoices, and payment history. A recent email OTP for the
-- email already stored on that row is therefore mandatory before it is linked.

create schema if not exists private;

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

-- Email OTP and phone OTP both appear as `otp` in the JWT AMR list. Customer
-- linking accepts the proof only when the token carries the expected email and
-- no phone identity, which prevents an attacker from proving their own phone
-- while claiming a different customer's email record.
create or replace function private.has_recent_customer_email_otp(p_expected_email text)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  claims jsonb := (select auth.jwt());
  issued_at timestamptz;
begin
  if (select auth.uid()) is null
    or nullif(claims ->> 'session_id', '') is null
    or lower(btrim(coalesce(claims ->> 'email', ''))) <> lower(btrim(coalesce(p_expected_email, '')))
    or nullif(btrim(coalesce(claims ->> 'phone', '')), '') is not null then
    return false;
  end if;

  begin
    issued_at := to_timestamp((claims ->> 'iat')::double precision);
  exception when others then
    return false;
  end;

  if issued_at < now() - interval '10 minutes' then return false; end if;

  return exists (
    select 1
    from jsonb_array_elements(coalesce(claims -> 'amr', '[]'::jsonb)) method
    where method ->> 'method' = 'otp'
      and coalesce(method ->> 'timestamp', '') ~ '^\d+$'
      and to_timestamp((method ->> 'timestamp')::double precision) >= now() - interval '10 minutes'
  );
end
$$;

revoke all on function private.has_recent_customer_email_otp(text)
  from public, anon, authenticated;

-- The Auth OTP proves control of an email address, but the claim also needs to
-- prove which customer row was approved. Keep that binding private, scoped to
-- one Auth user/session, short-lived, and single-use.
create table if not exists private.customer_link_email_attestations (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  auth_session_id text not null,
  normalized_email text not null,
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint customer_link_email_attestations_expiry_check
    check (expires_at > verified_at)
);

revoke all on table private.customer_link_email_attestations
  from public, anon, authenticated;

-- Serialize new customer identities at the database boundary as well as in
-- the claim RPC. Existing historical duplicates remain untouched for an
-- administrator to merge deliberately.
create or replace function private.prevent_duplicate_customer_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(coalesce(new.email, '')));
begin
  if normalized_email = '' then return new; end if;

  perform pg_advisory_xact_lock(hashtext(new.owner_id::text), hashtext(normalized_email));
  if exists (
    select 1
    from public.customers customer
    where customer.owner_id = new.owner_id
      and customer.id is distinct from new.id
      and lower(btrim(coalesce(customer.email, ''))) = normalized_email
  ) then
    raise exception 'A customer with this email address already exists'
      using errcode = '23505';
  end if;

  new.email := normalized_email;
  return new;
end
$$;

revoke all on function private.prevent_duplicate_customer_email()
  from public, anon, authenticated;

drop trigger if exists customers_prevent_duplicate_email on public.customers;
create trigger customers_prevent_duplicate_email
before insert or update of owner_id, email on public.customers
for each row execute function private.prevent_duplicate_customer_email();

create or replace function private.prevent_duplicate_customer_phone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_phone text := private.normalize_customer_phone(new.phone);
begin
  if normalized_phone = '' then return new; end if;

  perform pg_advisory_xact_lock(hashtext(new.owner_id::text), hashtext(normalized_phone));
  if exists (
    select 1
    from public.customers customer
    where customer.owner_id = new.owner_id
      and customer.id is distinct from new.id
      and private.normalize_customer_phone(customer.phone) = normalized_phone
  ) then
    raise exception 'A customer with this phone number already exists'
      using errcode = '23505';
  end if;

  return new;
end
$$;

revoke all on function private.prevent_duplicate_customer_phone()
  from public, anon, authenticated;

drop trigger if exists customers_prevent_duplicate_phone on public.customers;
create trigger customers_prevent_duplicate_phone
before insert or update of owner_id, phone on public.customers
for each row execute function private.prevent_duplicate_customer_phone();

create or replace function public.get_customer_link_requirement(
  p_email text,
  p_phone text
)
returns table (email_otp_required boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_uid uuid := (select auth.uid());
  owner_uuid uuid;
  auth_email text;
  normalized_phone text := private.normalize_customer_phone(p_phone);
  email_candidate_id text;
  email_candidate_count integer := 0;
  phone_candidate_id text;
  phone_candidate_count integer := 0;
  candidate_id text;
  candidate_email text;
  candidate_auth_user_id uuid;
  candidate_active boolean;
begin
  if request_uid is null then
    raise exception 'Sign in is required to check customer account linking';
  end if;

  select lower(btrim(email)) into auth_email
  from auth.users
  where id = request_uid;

  if auth_email is null or auth_email <> lower(btrim(coalesce(p_email, ''))) then
    raise exception 'The signup email does not match the authenticated account';
  end if;
  if normalized_phone = '' then raise exception 'Phone number is required'; end if;

  owner_uuid := private.default_owner_id();
  if owner_uuid is null then
    raise exception 'An active Owner administrator is required before customers can sign up';
  end if;

  if exists (
    select 1 from public.customers
    where owner_id = owner_uuid and auth_user_id = request_uid
  ) then
    email_otp_required := false;
    return next;
    return;
  end if;

  select count(*), min(id)
  into email_candidate_count, email_candidate_id
  from public.customers
  where owner_id = owner_uuid
    and nullif(btrim(coalesce(email, '')), '') is not null
    and lower(btrim(email)) = auth_email;

  select count(*), min(id)
  into phone_candidate_count, phone_candidate_id
  from public.customers
  where owner_id = owner_uuid
    and nullif(btrim(coalesce(phone, '')), '') is not null
    and private.normalize_customer_phone(phone) = normalized_phone;

  if email_candidate_count > 1 or phone_candidate_count > 1 then
    raise exception 'Multiple customer records match these details. Contact Himaliya Spring Water to merge them safely.';
  end if;
  if email_candidate_id is not null and phone_candidate_id is not null
    and email_candidate_id is distinct from phone_candidate_id then
    raise exception 'The email and phone match different customer records. Contact Himaliya Spring Water to merge them safely.';
  end if;

  candidate_id := coalesce(email_candidate_id, phone_candidate_id);
  if candidate_id is null then
    email_otp_required := false;
    return next;
    return;
  end if;

  select lower(btrim(email)), auth_user_id, active
  into candidate_email, candidate_auth_user_id, candidate_active
  from public.customers
  where owner_id = owner_uuid and id = candidate_id;

  if candidate_active is not true then
    raise exception 'This customer account has been deactivated. Contact Himaliya Spring Water.';
  end if;
  if candidate_auth_user_id is not null and candidate_auth_user_id <> request_uid then
    raise exception 'This customer record is already linked. Sign in to the existing account or reset its password.';
  end if;
  if candidate_email is null or candidate_email = '' or candidate_email <> auth_email then
    raise exception 'These details match an existing customer record. Use the email already on that record or contact Himaliya Spring Water.';
  end if;

  email_otp_required := true;
  return next;
end
$$;

revoke all on function public.get_customer_link_requirement(text, text)
  from public, anon;
grant execute on function public.get_customer_link_requirement(text, text)
  to authenticated;

-- Bind a just-completed email OTP to the exact existing customer discovered
-- from the submitted email/phone. A phone match selects a candidate only; the
-- candidate's stored email must still equal the authenticated, OTP-proven
-- email. No stored email value is returned to the caller.
create or replace function public.attest_customer_link_email_otp(
  p_email text,
  p_phone text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_uid uuid := (select auth.uid());
  request_session_id text := nullif((select auth.jwt() ->> 'session_id'), '');
  owner_uuid uuid;
  auth_email text;
  normalized_phone text := private.normalize_customer_phone(p_phone);
  email_candidate_id text;
  email_candidate_count integer := 0;
  phone_candidate_id text;
  phone_candidate_count integer := 0;
  candidate_id text;
  candidate_email text;
  candidate_auth_user_id uuid;
  candidate_active boolean;
begin
  if request_uid is null or request_session_id is null then
    raise exception 'A current customer session is required to verify this link';
  end if;

  select lower(btrim(email)) into auth_email
  from auth.users
  where id = request_uid;

  if auth_email is null or auth_email <> lower(btrim(coalesce(p_email, ''))) then
    raise exception 'The signup email does not match the authenticated account';
  end if;
  if normalized_phone = '' then raise exception 'Phone number is required'; end if;

  owner_uuid := private.default_owner_id();
  if owner_uuid is null then
    raise exception 'An active Owner administrator is required before customers can sign up';
  end if;

  perform pg_advisory_xact_lock(hashtext(owner_uuid::text), hashtext(auth_email));
  perform pg_advisory_xact_lock(hashtext(owner_uuid::text), hashtext(normalized_phone));

  select count(*), min(id)
  into email_candidate_count, email_candidate_id
  from public.customers
  where owner_id = owner_uuid
    and nullif(btrim(coalesce(email, '')), '') is not null
    and lower(btrim(email)) = auth_email;

  select count(*), min(id)
  into phone_candidate_count, phone_candidate_id
  from public.customers
  where owner_id = owner_uuid
    and nullif(btrim(coalesce(phone, '')), '') is not null
    and private.normalize_customer_phone(phone) = normalized_phone;

  if email_candidate_count > 1 or phone_candidate_count > 1
    or (
      email_candidate_id is not null
      and phone_candidate_id is not null
      and email_candidate_id is distinct from phone_candidate_id
    ) then
    raise exception 'These details cannot be linked automatically. Contact Himaliya Spring Water.';
  end if;

  candidate_id := coalesce(email_candidate_id, phone_candidate_id);
  if candidate_id is null then
    raise exception 'No existing customer link is awaiting email verification';
  end if;

  select lower(btrim(email)), auth_user_id, active
  into candidate_email, candidate_auth_user_id, candidate_active
  from public.customers
  where owner_id = owner_uuid and id = candidate_id
  for update;

  if candidate_active is not true
    or candidate_auth_user_id is not null
    or candidate_email is null
    or candidate_email = ''
    or candidate_email <> auth_email then
    raise exception 'These details match an existing customer record. Use the email already on that record or contact Himaliya Spring Water.';
  end if;

  if private.has_recent_customer_email_otp(candidate_email) is not true then
    raise exception 'Enter the recent verification code sent to the email on this customer record before linking its history.';
  end if;

  delete from private.customer_link_email_attestations
  where auth_user_id = request_uid
    and expires_at <= now();

  insert into private.customer_link_email_attestations (
    auth_user_id,
    customer_id,
    auth_session_id,
    normalized_email,
    verified_at,
    expires_at
  ) values (
    request_uid,
    candidate_id,
    request_session_id,
    candidate_email,
    now(),
    now() + interval '10 minutes'
  )
  on conflict (auth_user_id) do update
  set customer_id = excluded.customer_id,
      auth_session_id = excluded.auth_session_id,
      normalized_email = excluded.normalized_email,
      verified_at = excluded.verified_at,
      expires_at = excluded.expires_at;

  return true;
end
$$;

revoke all on function public.attest_customer_link_email_otp(text, text)
  from public, anon, authenticated;
grant execute on function public.attest_customer_link_email_otp(text, text)
  to authenticated;

-- Older clients must fail closed instead of using the former unconditional
-- `phone_verification_required := false` response.
do $$
declare
  legacy_signature text;
begin
  foreach legacy_signature in array array[
    'public.get_customer_claim_requirements(text,text)',
    'public.attest_customer_email_confirmation()',
    'public.begin_customer_phone_verification(text)',
    'public.attest_customer_phone_challenge(text)',
    'public.cancel_customer_phone_verification(text)',
    'public.complete_customer_phone_verification(text)'
  ] loop
    if to_regprocedure(legacy_signature) is not null then
      execute format(
        'revoke all on function %s from public, anon, authenticated',
        legacy_signature
      );
    end if;
  end loop;
end
$$;

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
  normalized_phone text := private.normalize_customer_phone(p_phone);
  email_candidate_id text;
  email_candidate_count integer := 0;
  phone_candidate_id text;
  phone_candidate_count integer := 0;
  candidate_id text;
  candidate_email text;
  candidate_auth_user_id uuid;
  candidate_active boolean;
  attested_uid uuid;
  match_method text := 'new customer';
  customer_row public.customers;
begin
  if request_uid is null then
    raise exception 'Sign in is required to create a customer profile';
  end if;

  select lower(btrim(email)) into auth_email
  from auth.users
  where id = request_uid;

  if auth_email is null or auth_email <> lower(btrim(coalesce(p_email, ''))) then
    raise exception 'The signup email does not match the authenticated account';
  end if;
  if btrim(coalesce(p_name, '')) = '' then raise exception 'Full name is required'; end if;
  if normalized_phone = '' then raise exception 'Phone number is required'; end if;
  if btrim(coalesce(p_address, '')) = '' then raise exception 'Delivery address is required'; end if;
  if p_preferences is not null and jsonb_typeof(p_preferences) <> 'object' then
    raise exception 'Customer preferences must be an object';
  end if;

  owner_uuid := private.default_owner_id();
  if owner_uuid is null then
    raise exception 'An active Owner administrator is required before customers can sign up';
  end if;

  perform pg_advisory_xact_lock(hashtext(owner_uuid::text), hashtext(auth_email));
  perform pg_advisory_xact_lock(hashtext(owner_uuid::text), hashtext(normalized_phone));

  select * into customer_row
  from public.customers
  where owner_id = owner_uuid and auth_user_id = request_uid
  for update;

  if customer_row.id is not null then
    if customer_row.active is not true then
      raise exception 'This customer account has been deactivated. Contact Himaliya Spring Water.';
    end if;

    update public.customers
    set name = btrim(p_name),
        email = auth_email,
        phone = normalized_phone,
        address = btrim(p_address),
        source = case when source = 'admin' then 'both' else source end,
        preferences = case
          when p_preferences is null then preferences
          else preferences || p_preferences
        end,
        updated_at = now()
    where id = customer_row.id
    returning * into customer_row;

    delete from private.customer_link_email_attestations
    where auth_user_id = request_uid;
    return customer_row;
  end if;

  select count(*), min(id)
  into email_candidate_count, email_candidate_id
  from public.customers
  where owner_id = owner_uuid
    and nullif(btrim(coalesce(email, '')), '') is not null
    and lower(btrim(email)) = auth_email;

  select count(*), min(id)
  into phone_candidate_count, phone_candidate_id
  from public.customers
  where owner_id = owner_uuid
    and nullif(btrim(coalesce(phone, '')), '') is not null
    and private.normalize_customer_phone(phone) = normalized_phone;

  if email_candidate_count > 1 or phone_candidate_count > 1 then
    raise exception 'Multiple customer records match these details. Contact Himaliya Spring Water to merge them safely.';
  end if;
  if email_candidate_id is not null and phone_candidate_id is not null
    and email_candidate_id is distinct from phone_candidate_id then
    raise exception 'The email and phone match different customer records. Contact Himaliya Spring Water to merge them safely.';
  end if;

  candidate_id := coalesce(email_candidate_id, phone_candidate_id);
  if candidate_id is not null then
    select lower(btrim(email)), auth_user_id, active
    into candidate_email, candidate_auth_user_id, candidate_active
    from public.customers
    where owner_id = owner_uuid and id = candidate_id
    for update;

    if candidate_active is not true then
      raise exception 'This customer account has been deactivated. Contact Himaliya Spring Water.';
    end if;
    if candidate_auth_user_id is not null and candidate_auth_user_id <> request_uid then
      raise exception 'This customer record is already linked. Sign in to the existing account or reset its password.';
    end if;
    if candidate_email is null or candidate_email = '' or candidate_email <> auth_email then
      raise exception 'These details match an existing customer record. Use the email already on that record or contact Himaliya Spring Water.';
    end if;
    delete from private.customer_link_email_attestations proof
    where proof.auth_user_id = request_uid
      and proof.customer_id = candidate_id
      and proof.auth_session_id = nullif((select auth.jwt() ->> 'session_id'), '')
      and proof.normalized_email = candidate_email
      and proof.expires_at > now()
    returning proof.auth_user_id into attested_uid;

    if attested_uid is null then
      raise exception 'Enter the recent verification code sent to the email on this customer record before linking its history.';
    end if;

    match_method := case
      when email_candidate_id is not null and phone_candidate_id is not null then 'verified email and phone'
      when email_candidate_id is not null then 'verified email'
      else 'verified account email'
    end;

    update public.customers
    set auth_user_id = request_uid,
        name = btrim(p_name),
        email = auth_email,
        phone = normalized_phone,
        address = btrim(p_address),
        source = case when source = 'admin' then 'both' else 'portal' end,
        preferences = case
          when p_preferences is null then preferences
          else preferences || p_preferences
        end,
        updated_at = now()
    where owner_id = owner_uuid
      and id = candidate_id
      and auth_user_id is null
    returning * into customer_row;

    if customer_row.id is null then
      raise exception 'This customer record was linked by another request. Sign in or contact Himaliya Spring Water.';
    end if;
  else
    -- A fresh profile never needs an OTP. Remove any stale proof from an
    -- abandoned earlier attempt before creating it.
    delete from private.customer_link_email_attestations
    where auth_user_id = request_uid;

    insert into public.customers (
      owner_id, auth_user_id, name, email, phone, address, source, preferences
    ) values (
      owner_uuid, request_uid, btrim(p_name), auth_email, normalized_phone,
      btrim(p_address), 'portal',
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
  from public, anon, authenticated;
grant execute on function public.claim_customer_account(text, text, text, text, jsonb, text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
