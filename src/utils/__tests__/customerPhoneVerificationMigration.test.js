import fs from 'fs';
import path from 'path';

const migration = fs.readFileSync(path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260807155116_harden_customer_signup_verification.sql',
), 'utf8');

describe('verified customer identity proof migration', () => {
  it('attests a recent email-signup/OTP callback session instead of cleared Auth columns', () => {
    expect(migration).toMatch(/create or replace function public\.attest_customer_email_confirmation\(\)/i);
    expect(migration).toMatch(/method ->> 'method' = 'email\/signup'/i);
    expect(migration).toMatch(/method ->> 'method' = 'otp'[\s\S]+?claims ->> 'phone'/i);
    expect(migration).toMatch(/proof\.auth_session_id = \(select auth\.jwt\(\) ->> 'session_id'\)/i);
    expect(migration).toMatch(/jwt_issued_at is null/i);

    const claim = migration.slice(migration.indexOf('create or replace function public.claim_customer_account'));
    expect(claim).not.toMatch(/email_confirmed_at is not null and confirmation_sent_at is not null/i);
    expect(claim).toMatch(/customer_email_confirmation_attestations proof/i);
  });

  it('reserves a unique phone and rejects ambiguous pending phone_change rows', () => {
    expect(migration).toMatch(/customer_phone_verification_reservations[\s\S]+?normalized_phone text primary key/i);
    expect(migration).toMatch(/auth_user_id uuid not null unique/i);
    expect(migration).toMatch(/private\.normalize_customer_phone\(phone_change\) = requested_phone/i);
    expect(migration).toMatch(/A phone verification is already pending for this number/i);
    expect(migration).toMatch(/pg_advisory_xact_lock[\s\S]+?customer-phone-verification/i);
  });

  it('captures the challenge before verify and survives GoTrue clearing phone_change_sent_at', () => {
    expect(migration).toMatch(/create or replace function public\.attest_customer_phone_challenge/i);
    expect(migration).toMatch(/select private\.normalize_customer_phone\(phone_change\), phone_change_sent_at/i);
    expect(migration).toMatch(/set challenge_sent_at = pending_sent_at/i);

    const completeStart = migration.indexOf('create or replace function public.complete_customer_phone_verification');
    const completeEnd = migration.indexOf('revoke all on function public.complete_customer_phone_verification');
    const completion = migration.slice(completeStart, completeEnd);
    expect(completion).not.toMatch(/phone_change_sent_at/i);
    expect(completion).toMatch(/confirmed_at < reserved_challenge_sent_at/i);
    expect(completion).toMatch(/set verified_at = now\(\)/i);
  });

  it('lets the claim trust only an unexpired verified reservation', () => {
    const claim = migration.slice(migration.indexOf('create or replace function public.claim_customer_account'));
    expect(claim).toMatch(/customer_phone_verification_reservations proof/i);
    expect(claim).toMatch(/proof\.challenge_sent_at is not null/i);
    expect(claim).toMatch(/proof\.verified_at is not null/i);
    expect(claim).toMatch(/proof\.expires_at > now\(\)/i);
    expect(claim).not.toMatch(/phone_confirmed_at is not null\s+and phone_change_sent_at is not null/i);
  });
});
