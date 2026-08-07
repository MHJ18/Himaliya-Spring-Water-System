import fs from 'fs';
import path from 'path';

const migration = fs.readFileSync(path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260807155116_harden_customer_signup_verification.sql',
), 'utf8');

describe('customer signup hardening migration', () => {
  it('requires a recent, session-bound email confirmation attestation', () => {
    expect(migration).toMatch(/create or replace function public\.attest_customer_email_confirmation/i);
    expect(migration).toMatch(/claims jsonb := \(select auth\.jwt\(\)\)/i);
    expect(migration).toMatch(/method ->> 'method' = 'otp'/i);
    expect(migration).toMatch(/customer_email_confirmation_attestations proof[\s\S]+?proof\.auth_session_id = \(select auth\.jwt\(\) ->> 'session_id'\)/i);
    expect(migration).toMatch(/email_confirmed_at is not null and exists/i);
  });

  it('serializes normalized email and phone duplicate checks', () => {
    expect((migration.match(/pg_advisory_xact_lock/gi) || []).length).toBeGreaterThanOrEqual(3);
    expect(migration).toMatch(/lower\(btrim\(customer\.email\)\) = normalized_email/i);
    expect(migration).toMatch(/normalize_customer_phone\(customer\.phone\) = normalized_phone/i);
    expect(migration).toMatch(/hashtext\('customer-phone-verification'\)/i);
  });

  it('preserves an unverified matching phone record for OTP or admin review', () => {
    expect(migration).toMatch(/phone_candidate_count = 1[\s\S]+?phone_proof_verified and auth_phone = normalized_phone/i);
    expect(migration).toMatch(/Verify the phone by OTP or contact Himaliya Spring Water/i);
  });
});
