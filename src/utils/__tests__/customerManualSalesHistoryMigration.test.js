import fs from 'fs';
import path from 'path';

const migration = fs.readFileSync(path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260807155107_transactional_customer_ledger_settlements.sql',
), 'utf8');

const rpc = migration.match(
  /create or replace function public\.get_customer_manual_sales_history\(\)[\s\S]+?grant execute on function public\.get_customer_manual_sales_history\(\)[\s\S]+?to authenticated;/i,
)[0];

const forwardMigration = fs.readFileSync(path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260807165226_install_customer_manual_sales_history.sql',
), 'utf8');

describe('customer manual sales history migration', () => {
  it('derives the linked active customer only from the authenticated user', () => {
    expect(rpc).toMatch(/security definer[\s\S]+?set search_path = ''/i);
    expect(rpc).toMatch(/caller_uid uuid := \(select auth\.uid\(\)\)/i);
    expect(rpc).toMatch(/customer\.auth_user_id = caller_uid[\s\S]+?customer\.active = true/i);
    expect(rpc).toMatch(/sale\.owner_id = linked_owner_id[\s\S]+?sale\.customer_id = linked_customer_id/i);
    expect(rpc).not.toMatch(/p_customer_id|p_owner_id/i);
  });

  it('returns sanitized sale facts with active ledger allocations', () => {
    expect(rpc).toMatch(/jsonb_build_object\([\s\S]+?'bottle_type'[\s\S]+?'balance_due'[\s\S]+?'created_at'/i);
    expect(rpc).toMatch(/public\.customer_payment_allocations[\s\S]+?payment\.status = 'applied'/i);
    expect(rpc).not.toMatch(/'owner_id',\s*sale\.owner_id|'customer_id',\s*sale\.customer_id/i);
    expect(rpc).not.toMatch(/'notes'/i);
  });

  it('keeps direct sales access closed and grants only authenticated RPC execution', () => {
    expect(rpc).toMatch(/revoke all on function public\.get_customer_manual_sales_history\(\)[\s\S]+?from public, anon/i);
    expect(rpc).toMatch(/grant execute on function public\.get_customer_manual_sales_history\(\)[\s\S]+?to authenticated/i);
    expect(migration).not.toMatch(/grant select on (?:table )?public\.sales[\s\S]{0,80}authenticated/i);
  });

  it('ships the RPC in a forward-only migration for projects with the ledger already applied', () => {
    expect(forwardMigration).toMatch(/create or replace function public\.get_customer_manual_sales_history\(\)/i);
    expect(forwardMigration).toMatch(/revoke all on function public\.get_customer_manual_sales_history\(\)[\s\S]+?from public, anon/i);
    expect(forwardMigration).toMatch(/grant execute on function public\.get_customer_manual_sales_history\(\)[\s\S]+?to authenticated/i);
    expect(forwardMigration).toMatch(/notify pgrst, 'reload schema'/i);
  });
});
