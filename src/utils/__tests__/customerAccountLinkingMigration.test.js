import fs from 'fs';
import path from 'path';

const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260807151416_link_manual_customers_by_verified_identity.sql',
);
const migration = fs.readFileSync(migrationPath, 'utf8');

describe('manual customer account linking migration', () => {
  it('only trusts identities confirmed by Supabase Auth', () => {
    expect(migration).toMatch(/email_confirmed_at is not null/i);
    expect(migration).toMatch(/phone_confirmed_at is not null/i);
    expect(migration).toMatch(
      /phone_is_confirmed[\s\S]+?auth_phone = normalized_phone[\s\S]+?normalize_customer_phone\(phone\) = auth_phone/i,
    );
    expect(migration).toMatch(
      /if candidate_count <> 1 then\s+select count\(\*\), min\(id\)[\s\S]+?lower\(trim\(email\)\) = auth_email/i,
    );
    expect(migration).toMatch(
      /if candidate_count <> 1 and phone_is_confirmed and auth_phone = normalized_phone then\s+select count\(\*\), min\(id\)[\s\S]+?normalize_customer_phone\(phone\) = auth_phone/i,
    );
    expect(migration).not.toMatch(/lower\(regexp_replace\(trim\(name\)/i);
    expect(migration).not.toMatch(/match_method\s*:=\s*'full name'/i);
  });

  it('normalizes common Pakistan phone formats before matching', () => {
    expect(migration).toMatch(/digits like '0092%' then substr\(digits, 3\)/i);
    expect(migration).toMatch(/digits like '0%' then '92' \|\| substr\(digits, 2\)/i);
    expect(migration).toMatch(/length\(digits\) = 10 then '92' \|\| digits/i);
  });

  it('claims the canonical row instead of moving historical records', () => {
    expect(migration).toMatch(
      /update public\.customers[\s\S]+?set auth_user_id = request_uid[\s\S]+?where owner_id = owner_uuid and id = candidate_id/i,
    );
    expect(migration).not.toMatch(/update public\.(sales|customer_orders|customer_invoices)\s+set customer_id/i);
  });

  it('keeps the public RPC authenticated and its helper private', () => {
    expect(migration).toMatch(/security definer[\s\S]+?set search_path = ''/i);
    expect(migration).toMatch(
      /revoke all on function private\.normalize_customer_phone\(text\)[\s\S]+?from public, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.claim_customer_account[\s\S]+?to authenticated/i,
    );
    expect(migration).not.toMatch(/on public\.customers \(owner_id, private\.normalize_customer_phone/i);
  });
});
