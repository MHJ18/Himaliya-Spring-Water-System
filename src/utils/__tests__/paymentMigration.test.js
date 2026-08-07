import fs from 'fs';
import path from 'path';

const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260729132436_add_customer_payment_terms_and_notification_retention.sql',
);
const migration = fs.readFileSync(migrationPath, 'utf8');

describe('payment and notification migration invariants', () => {
  it('enforces one active invoice claim per source and rejects zero invoices', () => {
    expect(migration).toMatch(/create table if not exists public\.customer_invoice_line_claims/i);
    expect(migration).toMatch(
      /create unique index[\s\S]+?\(owner_id,\s*source_key\)[\s\S]+?where released_at is null/i,
    );
    expect(migration).toMatch(/Invoices require an unpaid balance greater than zero/i);
    expect(migration).toMatch(/after insert on public\.customer_invoices/i);
    expect(migration).toMatch(/new\.payment_status = 'void'[\s\S]+?set released_at = now\(\)/i);
  });

  it('keeps notification partition fields immutable to customers and reprunes updates', () => {
    expect(migration).toMatch(
      /after update of owner_id,\s*auth_user_id,\s*audience,\s*created_at[\s\S]+?public\.customer_notifications/i,
    );
    expect(migration).toMatch(
      /revoke insert,\s*update on table public\.customer_notifications[\s\S]+?from authenticated/i,
    );
    expect(migration).toMatch(
      /grant update \(read\) on table public\.customer_notifications[\s\S]+?to authenticated/i,
    );
  });
});
