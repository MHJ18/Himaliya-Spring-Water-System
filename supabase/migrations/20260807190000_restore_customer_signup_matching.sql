begin;

-- Reality check performed against the live database before writing this
-- migration: despite local migration files existing for
-- 20260807151416_link_manual_customers_by_verified_identity and
-- 20260807155116_harden_customer_signup_verification, NEITHER was ever
-- applied to this project (private.normalize_customer_phone,
-- private.customer_phone_verification_reservations,
-- private.customer_email_confirmation_attestations, and
-- public.get_customer_claim_requirements all do not exist here). The live
-- claim_customer_account is still the original, permissive, matching-only
-- version from 20260722002721_customer_account_lifecycle_and_deactivation.
--
-- The actual signup lockout was entirely client-side: customerPortalApi.js's
-- registerCustomer() called a hard-coded ensureEmailConfirmationEnabled()
-- gate before ever reaching Supabase, and treated an immediate session
-- (returned because Confirm Email is disabled) as an attack to reject. That
-- client bug is already fixed. This migration only adds the one function the
-- fixed client now calls that was missing on this project --
-- get_customer_claim_requirements -- and tightens claim_customer_account's
-- existing matching logic slightly (ambiguity now raises a clear error
-- instead of silently creating a duplicate customer row; the loose
-- full-name-only match tier is dropped since two unrelated customers can
-- share a name). No email/SMS confirmation proof is required, matching the
-- "matching-only" approach already chosen for this project.
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
  normalized_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  candidate_id text;
  candidate_count integer := 0;
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

  select * into customer_row
  from public.customers
  where auth_user_id = request_uid
  for update;

  if customer_row.id is not null then
    if customer_row.active is not true then
      raise exception 'This customer account has been deactivated. Contact Himaliya Spring Water.';
    end if;

    update public.customers
    set name = btrim(p_name),
        email = auth_email,
        phone = btrim(p_phone),
        address = btrim(p_address),
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

  -- An explicit customer ID is only a hint; it still needs a matching email
  -- or phone number before any historical row can be claimed.
  if nullif(btrim(coalesce(p_customer_id, '')), '') is not null then
    select count(*), min(id) into candidate_count, candidate_id
    from public.customers
    where owner_id = owner_uuid
      and id = btrim(p_customer_id)
      and auth_user_id is null
      and (
        lower(btrim(coalesce(email, ''))) = auth_email
        or regexp_replace(coalesce(phone, ''), '\D', '', 'g') = normalized_phone
      );
    if candidate_count = 1 then match_method := 'customer ID'; end if;
    if candidate_count > 1 then
      raise exception 'Multiple customer records match this customer ID. Contact Himaliya Spring Water to merge them safely.';
    end if;
  end if;

  if candidate_count <> 1 then
    select count(*), min(id) into candidate_count, candidate_id
    from public.customers
    where owner_id = owner_uuid
      and auth_user_id is null
      and nullif(btrim(coalesce(email, '')), '') is not null
      and lower(btrim(email)) = auth_email;
    if candidate_count = 1 then match_method := 'email'; end if;
    if candidate_count > 1 then
      raise exception 'Multiple customer records match this email. Contact Himaliya Spring Water to merge them safely.';
    end if;
  end if;

  if candidate_count <> 1 then
    select count(*), min(id) into candidate_count, candidate_id
    from public.customers
    where owner_id = owner_uuid
      and auth_user_id is null
      and nullif(btrim(coalesce(phone, '')), '') is not null
      and regexp_replace(phone, '\D', '', 'g') = normalized_phone;
    if candidate_count = 1 then match_method := 'phone number'; end if;
    if candidate_count > 1 then
      raise exception 'Multiple customer records match this phone number. Contact Himaliya Spring Water to merge them safely.';
    end if;
  end if;

  if candidate_count = 1 and candidate_id is not null then
    update public.customers
    set auth_user_id = request_uid,
        name = btrim(p_name),
        email = auth_email,
        phone = btrim(p_phone),
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
  else
    insert into public.customers (
      owner_id, auth_user_id, name, email, phone, address, source, preferences
    ) values (
      owner_uuid, request_uid, btrim(p_name), auth_email, btrim(p_phone),
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

-- The client (customerPortalApi.js) calls this immediately after signing in
-- to decide whether to show a phone-OTP step. This project does not use
-- phone/email OTP verification for linking, so it is a cheap no-op that only
-- confirms the caller is signed in.
create or replace function public.get_customer_claim_requirements(
  p_email text,
  p_phone text
)
returns table (phone_verification_required boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_uid uuid := (select auth.uid());
begin
  if request_uid is null then
    raise exception 'Sign in is required to check customer account linking';
  end if;

  phone_verification_required := false;
  return next;
end
$$;

revoke all on function public.get_customer_claim_requirements(text, text)
  from public, anon;
grant execute on function public.get_customer_claim_requirements(text, text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
