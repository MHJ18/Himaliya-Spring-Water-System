import fs from 'fs';
import path from 'path';

const migration = fs.readFileSync(path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260808143743_require_email_otp_for_existing_customer_links.sql',
), 'utf8');

describe('existing customer email OTP linking migration', () => {
  it('allows a genuinely new customer without an OTP', () => {
    expect(migration).toMatch(
      /candidate_id := coalesce\(email_candidate_id, phone_candidate_id\)[\s\S]+?if candidate_id is not null then[\s\S]+?else[\s\S]+?insert into public\.customers/i,
    );
  });

  it('uses phone only to discover a candidate and requires its stored email', () => {
    expect(migration).toMatch(
      /private\.normalize_customer_phone\(phone\) = normalized_phone/i,
    );
    expect(migration).toMatch(
      /candidate_email is null or candidate_email = '' or candidate_email <> auth_email[\s\S]+?Use the email already on that record/i,
    );
    expect(migration).not.toMatch(/phone_confirmed_at/i);
  });

  it('binds the email OTP to one customer, Auth user, and Auth session', () => {
    expect(migration).toMatch(
      /create table if not exists private\.customer_link_email_attestations[\s\S]+?auth_user_id uuid primary key[\s\S]+?customer_id text not null[\s\S]+?auth_session_id text not null/i,
    );
    expect(migration).toMatch(
      /create or replace function public\.attest_customer_link_email_otp[\s\S]+?private\.has_recent_customer_email_otp\(candidate_email\)[\s\S]+?insert into private\.customer_link_email_attestations/i,
    );
  });

  it('consumes the exact short-lived attestation before linking history', () => {
    const claim = migration.slice(migration.indexOf(
      'create or replace function public.claim_customer_account',
    ));
    expect(claim).toMatch(
      /delete from private\.customer_link_email_attestations proof[\s\S]+?proof\.auth_user_id = request_uid[\s\S]+?proof\.customer_id = candidate_id[\s\S]+?proof\.auth_session_id = nullif\(\(select auth\.jwt\(\) ->> 'session_id'\), ''\)[\s\S]+?proof\.expires_at > now\(\)/i,
    );
    expect(claim).toMatch(/returning proof\.auth_user_id into attested_uid/i);
  });

  it('keeps helper data private and fails old clients closed', () => {
    expect(migration).toMatch(
      /revoke all on table private\.customer_link_email_attestations[\s\S]+?from public, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /public\.get_customer_claim_requirements\(text,text\)[\s\S]+?revoke all on function %s from public, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /revoke all on function public\.attest_customer_link_email_otp\(text, text\)[\s\S]+?grant execute[\s\S]+?to authenticated/i,
    );
  });
});
