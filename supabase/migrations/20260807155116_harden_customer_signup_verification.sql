begin;

-- A database trigger closes the race between two administrator clients. It
-- also leaves historical duplicate rows intact for an explicit merge instead
-- of making this migration guess which customer owns the history.
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

  perform pg_advisory_xact_lock(
    hashtext(new.owner_id::text),
    hashtext(normalized_email)
  );

  if exists (
    select 1
    from public.customers customer
    where customer.owner_id = new.owner_id
      and customer.id is distinct from new.id
      and nullif(btrim(coalesce(customer.email, '')), '') is not null
      and lower(btrim(customer.email)) = normalized_email
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

  perform pg_advisory_xact_lock(
    hashtext(new.owner_id::text),
    hashtext(normalized_phone)
  );

  if exists (
    select 1
    from public.customers customer
    where customer.owner_id = new.owner_id
      and customer.id is distinct from new.id
      and nullif(btrim(coalesce(customer.phone, '')), '') is not null
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

-- Reserve one phone-change challenge per Auth user and normalized number. This
-- prevents two app clients from creating the ambiguous phone_change state that
-- Supabase Auth otherwise has to resolve by phone number alone.
create table if not exists private.customer_phone_verification_reservations (
  normalized_phone text primary key,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  challenge_sent_at timestamptz,
  verified_at timestamptz,
  expires_at timestamptz not null
);

revoke all on table private.customer_phone_verification_reservations
  from public, anon, authenticated;

create table if not exists private.customer_email_confirmation_attestations (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  normalized_email text not null,
  auth_session_id text not null,
  verified_at timestamptz not null,
  expires_at timestamptz not null
);

revoke all on table private.customer_email_confirmation_attestations
  from public, anon, authenticated;

-- confirmation_sent_at is cleared by GoTrue after confirmation. Instead,
-- capture the short-lived callback JWT only when its official AMR claim proves
-- an OTP/email-signup authentication method. Password and auto-confirm sessions
-- cannot establish this attestation.
create or replace function public.attest_customer_email_confirmation()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_uid uuid := (select auth.uid());
  claims jsonb := (select auth.jwt());
  auth_email text;
  jwt_email text := lower(btrim(coalesce(claims ->> 'email', '')));
  jwt_session_id text := nullif(claims ->> 'session_id', '');
  jwt_issued_at timestamptz;
  has_confirmation_amr boolean := false;
begin
  if request_uid is null or jwt_session_id is null then
    raise exception 'A valid email confirmation session is required';
  end if;

  begin
    jwt_issued_at := to_timestamp((claims ->> 'iat')::double precision);
  exception when others then
    raise exception 'The email confirmation token is missing its issue time';
  end;

  select exists (
    select 1
    from jsonb_array_elements(coalesce(claims -> 'amr', '[]'::jsonb)) method
    where (
        method ->> 'method' = 'email/signup'
        or (
          method ->> 'method' = 'otp'
          and nullif(btrim(coalesce(claims ->> 'phone', '')), '') is null
        )
      )
      and coalesce(method ->> 'timestamp', '') ~ '^\d+$'
      and to_timestamp((method ->> 'timestamp')::double precision) >= now() - interval '10 minutes'
  ) into has_confirmation_amr;

  select lower(btrim(email)) into auth_email
  from auth.users
  where id = request_uid and email_confirmed_at is not null;

  if has_confirmation_amr is not true
    or auth_email is null
    or auth_email <> jwt_email
    or jwt_issued_at is null
    or jwt_issued_at < now() - interval '10 minutes' then
    raise exception 'Use the recent signup confirmation link to verify this email. Password sessions cannot link customer history.';
  end if;

  insert into private.customer_email_confirmation_attestations (
    auth_user_id, normalized_email, auth_session_id, verified_at, expires_at
  ) values (
    request_uid, auth_email, jwt_session_id, now(), now() + interval '1 hour'
  )
  on conflict (auth_user_id) do update
  set normalized_email = excluded.normalized_email,
      auth_session_id = excluded.auth_session_id,
      verified_at = excluded.verified_at,
      expires_at = excluded.expires_at;
  return true;
end
$$;

revoke all on function public.attest_customer_email_confirmation()
  from public, anon;
grant execute on function public.attest_customer_email_confirmation()
  to authenticated;

-- Decide whether this signup actually needs an SMS. Verified email remains
-- sufficient when it matches the same canonical customer row; OTP is required
-- only for a phone-only historical match.
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
  owner_uuid uuid;
  auth_email text;
  auth_phone text;
  email_proof_verified boolean := false;
  phone_proof_verified boolean := false;
  normalized_phone text := private.normalize_customer_phone(p_phone);
  email_candidate_id text;
  email_candidate_count integer := 0;
  phone_candidate_id text;
  phone_candidate_auth_user_id uuid;
  phone_candidate_count integer := 0;
begin
  if request_uid is null then
    raise exception 'Sign in is required to check customer account linking';
  end if;

  select
    lower(btrim(email)),
    private.normalize_customer_phone(phone),
    email_confirmed_at is not null and exists (
      select 1
      from private.customer_email_confirmation_attestations proof
      where proof.auth_user_id = request_uid
        and proof.normalized_email = lower(btrim(auth.users.email))
        and proof.auth_session_id = (select auth.jwt() ->> 'session_id')
        and proof.expires_at > now()
    ),
    exists (
      select 1
      from private.customer_phone_verification_reservations proof
      where proof.auth_user_id = request_uid
        and proof.normalized_phone = private.normalize_customer_phone(phone)
        and proof.challenge_sent_at is not null
        and proof.verified_at is not null
        and proof.expires_at > now()
    )
  into auth_email, auth_phone, email_proof_verified, phone_proof_verified
  from auth.users
  where id = request_uid;

  if email_proof_verified is not true then
    raise exception 'Verify your email using the signup confirmation link before checking customer history.';
  end if;
  if auth_email is null or auth_email <> lower(btrim(coalesce(p_email, ''))) then
    raise exception 'The signup email does not match the authenticated account';
  end if;
  if normalized_phone = '' then raise exception 'Phone number is required'; end if;

  owner_uuid := private.default_owner_id();
  if owner_uuid is null then
    raise exception 'An active Owner administrator is required before customers can sign up';
  end if;

  select count(*), min(id)
  into email_candidate_count, email_candidate_id
  from public.customers
  where owner_id = owner_uuid
    and auth_user_id is null
    and nullif(btrim(coalesce(email, '')), '') is not null
    and lower(btrim(email)) = auth_email;

  if email_candidate_count > 1 then
    raise exception 'Multiple customer records match this email. Contact Himaliya Spring Water to merge them safely.';
  end if;

  select count(*), min(id)
  into phone_candidate_count, phone_candidate_id
  from public.customers
  where owner_id = owner_uuid
    and nullif(btrim(coalesce(phone, '')), '') is not null
    and private.normalize_customer_phone(phone) = normalized_phone;

  if phone_candidate_count > 1 then
    raise exception 'Multiple customer records match this phone number. Contact Himaliya Spring Water to merge them safely.';
  end if;

  if phone_candidate_count = 1 then
    select auth_user_id into phone_candidate_auth_user_id
    from public.customers
    where owner_id = owner_uuid and id = phone_candidate_id;

    if phone_candidate_auth_user_id is not null and phone_candidate_auth_user_id <> request_uid then
      raise exception 'This phone number is already linked to another customer account. Contact Himaliya Spring Water.';
    end if;
    if email_candidate_count = 1 and email_candidate_id is distinct from phone_candidate_id then
      raise exception 'The verified email and phone match different customer records. Contact Himaliya Spring Water to merge them safely.';
    end if;
  end if;

  phone_verification_required := phone_candidate_count = 1
    and phone_candidate_auth_user_id is null
    and email_candidate_id is distinct from phone_candidate_id
    and not (phone_proof_verified and auth_phone = normalized_phone);
  return next;
end
$$;

revoke all on function public.get_customer_claim_requirements(text, text)
  from public, anon;
grant execute on function public.get_customer_claim_requirements(text, text)
  to authenticated;

create or replace function public.begin_customer_phone_verification(p_phone text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_uid uuid := (select auth.uid());
  requested_phone text := private.normalize_customer_phone(p_phone);
  email_proof_verified boolean := false;
begin
  if request_uid is null then raise exception 'Sign in is required to verify a phone number'; end if;
  if requested_phone = '' then raise exception 'Phone number is required'; end if;

  select email_confirmed_at is not null and exists (
    select 1
    from private.customer_email_confirmation_attestations proof
    where proof.auth_user_id = request_uid
      and proof.normalized_email = lower(btrim(auth.users.email))
      and proof.auth_session_id = (select auth.jwt() ->> 'session_id')
      and proof.expires_at > now()
  )
  into email_proof_verified
  from auth.users
  where id = request_uid;
  if email_proof_verified is not true then
    raise exception 'Verify your signup email before verifying a phone number';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('customer-phone-verification'),
    hashtext(requested_phone)
  );

  if exists (
    select 1 from auth.users
    where id <> request_uid
      and private.normalize_customer_phone(phone) = requested_phone
      and phone_confirmed_at is not null
  ) then
    raise exception 'This phone number already belongs to another Auth account. Contact Himaliya Spring Water.';
  end if;

  -- Fail closed rather than letting /verify choose between duplicate
  -- phone_change rows. An administrator can clear an abandoned Auth challenge.
  if exists (
    select 1 from auth.users
    where id <> request_uid
      and nullif(btrim(coalesce(phone_change, '')), '') is not null
      and private.normalize_customer_phone(phone_change) = requested_phone
  ) then
    raise exception 'A phone verification is already pending for this number. Contact Himaliya Spring Water if it was abandoned.';
  end if;

  delete from private.customer_phone_verification_reservations
  where expires_at <= now() or auth_user_id = request_uid;

  if exists (
    select 1 from private.customer_phone_verification_reservations
    where normalized_phone = requested_phone
      and auth_user_id <> request_uid
      and expires_at > now()
  ) then
    raise exception 'A phone verification is already in progress for this number. Try again later.';
  end if;

  insert into private.customer_phone_verification_reservations (
    normalized_phone, auth_user_id, created_at, challenge_sent_at, verified_at, expires_at
  ) values (
    requested_phone, request_uid, now(), null, null, now() + interval '15 minutes'
  )
  on conflict (normalized_phone) do update
  set auth_user_id = excluded.auth_user_id,
      created_at = excluded.created_at,
      challenge_sent_at = null,
      verified_at = null,
      expires_at = excluded.expires_at;

  return true;
end
$$;

revoke all on function public.begin_customer_phone_verification(text)
  from public, anon;
grant execute on function public.begin_customer_phone_verification(text)
  to authenticated;

-- Called immediately after Auth PUT /user and before the OTP is accepted. It
-- records the matching phone_change challenge because GoTrue clears the
-- phone_change fields after successful verification.
create or replace function public.attest_customer_phone_challenge(p_phone text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_uid uuid := (select auth.uid());
  requested_phone text := private.normalize_customer_phone(p_phone);
  pending_phone text;
  pending_sent_at timestamptz;
begin
  if request_uid is null then raise exception 'Sign in is required to attest a phone challenge'; end if;

  select private.normalize_customer_phone(phone_change), phone_change_sent_at
  into pending_phone, pending_sent_at
  from auth.users
  where id = request_uid;

  if pending_phone <> requested_phone or pending_sent_at is null then
    raise exception 'Supabase did not create a verifiable SMS phone-change challenge';
  end if;

  update private.customer_phone_verification_reservations
  set challenge_sent_at = pending_sent_at,
      verified_at = null
  where auth_user_id = request_uid
    and normalized_phone = requested_phone
    and expires_at > now();
  if not found then raise exception 'The phone verification reservation expired'; end if;
  return true;
end
$$;

revoke all on function public.attest_customer_phone_challenge(text)
  from public, anon;
grant execute on function public.attest_customer_phone_challenge(text)
  to authenticated;

create or replace function public.cancel_customer_phone_verification(p_phone text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_uid uuid := (select auth.uid());
  requested_phone text := private.normalize_customer_phone(p_phone);
begin
  if request_uid is null then return false; end if;
  delete from private.customer_phone_verification_reservations
  where auth_user_id = request_uid
    and normalized_phone = requested_phone;
  return true;
end
$$;

revoke all on function public.cancel_customer_phone_verification(text)
  from public, anon;
grant execute on function public.cancel_customer_phone_verification(text)
  to authenticated;

create or replace function public.complete_customer_phone_verification(p_phone text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_uid uuid := (select auth.uid());
  requested_phone text := private.normalize_customer_phone(p_phone);
  verified_auth_phone text;
  confirmed_at timestamptz;
  reserved_challenge_sent_at timestamptz;
begin
  if request_uid is null then raise exception 'Sign in is required to verify a phone number'; end if;

  select challenge_sent_at into reserved_challenge_sent_at
  from private.customer_phone_verification_reservations
  where auth_user_id = request_uid
    and normalized_phone = requested_phone
    and challenge_sent_at is not null
    and expires_at > now()
  for update;
  if not found then
    raise exception 'The phone verification request expired. Request a new code.';
  end if;

  select
    private.normalize_customer_phone(phone),
    phone_confirmed_at
  into verified_auth_phone, confirmed_at
  from auth.users
  where id = request_uid;

  if verified_auth_phone <> requested_phone
    or confirmed_at is null
    or confirmed_at < reserved_challenge_sent_at then
    raise exception 'The submitted phone number has not been verified for this account';
  end if;

  update private.customer_phone_verification_reservations
  set verified_at = now()
  where auth_user_id = request_uid and normalized_phone = requested_phone;

  -- /verify may rotate to a new Auth session. Transfer the email attestation
  -- only after the reserved phone challenge has independently been proven.
  update private.customer_email_confirmation_attestations
  set auth_session_id = (select auth.jwt() ->> 'session_id')
  where auth_user_id = request_uid and expires_at > now();
  if not found then raise exception 'The verified email confirmation expired'; end if;
  return true;
end
$$;

revoke all on function public.complete_customer_phone_verification(text)
  from public, anon;
grant execute on function public.complete_customer_phone_verification(text)
  to authenticated;

-- Confirm Email disabled in Supabase implicitly populates email_confirmed_at,
-- but no mailbox was proven. History linking therefore requires a short-lived,
-- session-bound attestation created from the confirmation callback JWT's AMR.
-- Phone matching remains available only for an Auth phone proven by the OTP
-- challenge implemented above.
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
  email_proof_verified boolean := false;
  phone_proof_verified boolean := false;
  normalized_phone text := private.normalize_customer_phone(p_phone);
  candidate_id text;
  candidate_count integer := 0;
  phone_candidate_id text;
  phone_candidate_count integer := 0;
  match_method text := 'new customer';
  customer_row public.customers;
begin
  if request_uid is null then
    raise exception 'Sign in is required to create a customer profile';
  end if;

  select
    lower(btrim(email)),
    private.normalize_customer_phone(phone),
    email_confirmed_at is not null and exists (
      select 1
      from private.customer_email_confirmation_attestations proof
      where proof.auth_user_id = request_uid
        and proof.normalized_email = lower(btrim(auth.users.email))
        and proof.auth_session_id = (select auth.jwt() ->> 'session_id')
        and proof.expires_at > now()
    ),
    exists (
      select 1
      from private.customer_phone_verification_reservations proof
      where proof.auth_user_id = request_uid
        and proof.normalized_phone = private.normalize_customer_phone(phone)
        and proof.challenge_sent_at is not null
        and proof.verified_at is not null
        and proof.expires_at > now()
    )
  into auth_email, auth_phone, email_proof_verified, phone_proof_verified
  from auth.users
  where id = request_uid;

  if email_proof_verified is not true then
    raise exception 'Verify your email using the signup confirmation link before creating a customer profile. Confirm Email must be enabled.';
  end if;
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
    delete from private.customer_phone_verification_reservations
    where auth_user_id = request_uid;
    delete from private.customer_email_confirmation_attestations
    where auth_user_id = request_uid;
    return customer_row;
  end if;

  -- An explicit ID is a hint, never proof. It must still match the verified
  -- mailbox or a separately OTP-verified Auth phone.
  if nullif(btrim(coalesce(p_customer_id, '')), '') is not null then
    select count(*), min(id) into candidate_count, candidate_id
    from public.customers
    where owner_id = owner_uuid
      and id = btrim(p_customer_id)
      and auth_user_id is null
      and (
        lower(btrim(coalesce(email, ''))) = auth_email
        or (
          phone_proof_verified
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
      and nullif(btrim(coalesce(email, '')), '') is not null
      and lower(btrim(email)) = auth_email;
    if candidate_count = 1 then match_method := 'verified email'; end if;
    if candidate_count > 1 then
      raise exception 'Multiple customer records match this email. Contact Himaliya Spring Water to merge them safely.';
    end if;
  end if;

  -- Detect a manual record with the submitted phone even when the phone cannot
  -- yet be trusted. Never insert a second customer over that history.
  select count(*), min(id) into phone_candidate_count, phone_candidate_id
  from public.customers
  where owner_id = owner_uuid
    and auth_user_id is null
    and nullif(btrim(coalesce(phone, '')), '') is not null
    and private.normalize_customer_phone(phone) = normalized_phone;

  if phone_candidate_count > 1 then
    raise exception 'Multiple customer records match this phone number. Contact Himaliya Spring Water to merge them safely.';
  end if;

  if phone_candidate_count = 1 then
    if candidate_count = 1 and candidate_id = phone_candidate_id then
      -- The verified email already proves ownership of this same row.
      null;
    elsif phone_proof_verified and auth_phone = normalized_phone then
      if candidate_count = 1 and candidate_id is distinct from phone_candidate_id then
        raise exception 'The verified email and phone match different customer records. Contact Himaliya Spring Water to merge them safely.';
      end if;
      candidate_count := 1;
      candidate_id := phone_candidate_id;
      match_method := 'verified phone number';
    else
      raise exception 'An existing customer uses this phone number. Verify the phone by OTP or contact Himaliya Spring Water to link the account safely.';
    end if;
  end if;

  if candidate_count = 1 and candidate_id is not null then
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
  else
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

  if customer_row.id is null then
    raise exception 'Customer account creation could not be completed';
  end if;

  delete from private.customer_phone_verification_reservations
  where auth_user_id = request_uid;
  delete from private.customer_email_confirmation_attestations
  where auth_user_id = request_uid;

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
