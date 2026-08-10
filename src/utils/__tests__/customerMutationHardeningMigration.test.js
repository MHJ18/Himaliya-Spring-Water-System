import fs from 'fs';
import path from 'path';

const migration = fs.readFileSync(path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260808154500_harden_customer_mutations.sql',
), 'utf8');

describe('customer mutation hardening migration', () => {
  it('removes broad customer profile and order update policies', () => {
    expect(migration).toMatch(
      /drop policy if exists "Customers update active own canonical account"[\s\S]+?on public\.customers/i,
    );
    expect(migration).toMatch(
      /drop policy if exists "Active customers cancel own pending orders"[\s\S]+?on public\.customer_orders/i,
    );
  });

  it('cancels only the caller own pending order without accepting a patch', () => {
    const rpc = migration.slice(migration.indexOf(
      'create or replace function public.cancel_customer_order',
    ));
    expect(rpc).toMatch(/set status = 'canceled',[\s\S]+?updated_at = now\(\)/i);
    expect(rpc).toMatch(/order_row\.auth_user_id = request_uid/i);
    expect(rpc).toMatch(/order_row\.status = 'pending'/i);
    expect(rpc).toMatch(/private\.customer_account_is_active\(\)/i);
    expect(rpc).toMatch(/allowCustomerCancellation/i);
    expect(rpc).not.toMatch(/p_(items|quantity|price|address|status)/i);
  });

  it('exposes only the narrow RPC to authenticated users', () => {
    expect(migration).toMatch(/security definer[\s\S]+?set search_path = ''/i);
    expect(migration).toMatch(
      /revoke all on function public\.cancel_customer_order\(uuid\)[\s\S]+?from public, anon, authenticated[\s\S]+?grant execute[\s\S]+?to authenticated/i,
    );
  });
});
