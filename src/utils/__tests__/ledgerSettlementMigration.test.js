import fs from 'fs';
import path from 'path';

const migration = fs.readFileSync(path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260807155107_transactional_customer_ledger_settlements.sql',
), 'utf8');

describe('transactional ledger settlement migration', () => {
  it('keeps payment events and immutable per-source allocations', () => {
    expect(migration).toMatch(/create table if not exists public\.customer_payments/i);
    expect(migration).toMatch(/create table if not exists public\.customer_payment_allocations/i);
    expect(migration).toMatch(/primary key \(payment_id, source_key\)/i);
    expect(migration).toMatch(/payment\.status = 'applied'/i);
  });

  it('authorizes invoice creation and both settlement RPCs as active administrators', () => {
    expect(migration).toMatch(/create or replace function public\.create_customer_invoice[\s\S]+?security definer[\s\S]+?set search_path = ''/i);
    expect(migration).toMatch(/create or replace function public\.set_customer_invoice_payment_status[\s\S]+?security definer[\s\S]+?set search_path = ''/i);
    expect(migration).toMatch(/create or replace function public\.record_customer_monthly_payment[\s\S]+?security definer[\s\S]+?set search_path = ''/i);
    expect(migration.match(/owner_uuid uuid := private\.current_owner_id\(\)/gi)).toHaveLength(3);
    expect(migration).toMatch(/revoke all on function public\.create_customer_invoice[\s\S]+?from public, anon/i);
    expect(migration).toMatch(/revoke all on function public\.set_customer_invoice_payment_status[\s\S]+?from public, anon/i);
  });

  it('serializes invoice creation with payments and validates current source balances', () => {
    const createRpc = migration.match(
      /create or replace function public\.create_customer_invoice[\s\S]+?revoke all on function public\.create_customer_invoice/i,
    )[0];
    expect(createRpc).toMatch(/pg_advisory_xact_lock\([\s\S]+?hashtext\(owner_uuid::text\)[\s\S]+?hashtext\(p_customer_id\)/i);
    expect(createRpc).toMatch(/from public\.sales sale[\s\S]+?for update/i);
    expect(createRpc).toMatch(/from public\.customer_orders customer_order[\s\S]+?for update/i);
    expect(createRpc).toMatch(/source_total - source_direct_paid - source_allocated/i);
    expect(createRpc).toMatch(/abs\(line_due - source_remaining\) > 0\.005/i);
    expect(migration).toMatch(/customer_invoices_require_transactional_create/i);
    expect(migration).toMatch(/Use create_customer_invoice to create an invoice/i);
  });

  it('protects referenced sales while allowing unchanged financial upserts', () => {
    expect(migration).toMatch(/create or replace function private\.prevent_referenced_sale_mutation/i);
    expect(migration).toMatch(/new\.total_amount is not distinct from old\.total_amount/i);
    expect(migration).toMatch(/new\.amount_paid is not distinct from old\.amount_paid/i);
    expect(migration).toMatch(/new\.payment_schedule is not distinct from old\.payment_schedule/i);
    expect(migration).toMatch(/new\.bottle_type is not distinct from old\.bottle_type/i);
    expect(migration).toMatch(/new\.quantity is not distinct from old\.quantity/i);
    expect(migration).toMatch(/new\.price_per_bottle is not distinct from old\.price_per_bottle/i);
    expect(migration).toMatch(/new\.created_at is not distinct from old\.created_at/i);
    expect(migration).toMatch(/from public\.customer_invoice_line_claims claim/i);
    expect(migration).toMatch(/from public\.customer_payment_allocations allocation/i);
    expect(migration).toMatch(/before update of id, owner_id, customer_id, bottle_type, quantity,[\s\S]+?price_per_bottle, total_amount, amount_paid, payment_schedule, created_at[\s\S]+?or delete on public\.sales/i);
  });

  it('backfills only fully keyed and fully reconciled legacy paid invoices', () => {
    expect(migration).toMatch(/create or replace function private\.paid_invoice_fully_reconcilable/i);
    expect(migration).toMatch(/abs\([\s\S]+?p_total_amount[\s\S]+?\) <= 0\.005/i);
    expect(migration).toMatch(/count\(distinct source_lines\.source_key\)/i);
    expect(migration).toMatch(/positive_line\.source_key = ''[\s\S]+?not exists[\s\S]+?customer_invoice_line_claims/i);
    expect(migration.match(/private\.paid_invoice_fully_reconcilable\(/gi).length).toBeGreaterThanOrEqual(4);
  });

  it('settles delivered order lines and rejects monthly allocations for pay-on-delivery sources', () => {
    expect(migration).toMatch(/add column if not exists payment_schedule text not null default 'monthly'/i);
    expect(migration).toMatch(/customer_orders_snapshot_payment_schedule/i);
    expect(migration).toMatch(/private\.customer_order_line_total\(order_uuid, order_line_index\)/i);
    expect(migration).toMatch(/Pay-on-delivery sale % cannot receive a monthly allocation/i);
    expect(migration).toMatch(/Pay-on-delivery customer orders cannot receive a monthly allocation/i);
    expect(migration).toMatch(/coalesce\(order_row\.payment_schedule, 'monthly'\) <> 'monthly'/i);
  });

  it('reverses payment events rather than deleting allocations or rewriting sources', () => {
    expect(migration).toMatch(/set status = 'reversed',[\s\S]+?reversed_at = now\(\)/i);
    expect(migration).not.toMatch(/delete from public\.customer_payment_allocations/i);
    expect(migration).toMatch(/This legacy paid invoice has no reversible payment allocation/i);
  });

  it('removes internal source IDs from anonymous invoice lookup', () => {
    expect(migration).toMatch(/line\.item - 'id' - 'orderId' - 'order_id'/i);
    expect(migration).toMatch(/coalesce\(invoice\.payload -> 'customer', '\{\}'::jsonb\) - 'id'/i);
  });
});
