import fs from 'fs';
import path from 'path';

const migration = fs.readFileSync(path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260808153000_redact_public_invoice_lookup.sql',
), 'utf8');

describe('public invoice lookup privacy migration', () => {
  it('keeps printed invoice numbers usable while returning a summary only', () => {
    expect(migration).toMatch(/create or replace function public\.lookup_invoice_by_number/i);
    expect(migration).toMatch(/upper\(invoice\.invoice_number\) = upper\(btrim\(p_invoice_number\)\)/i);
    expect(migration).toMatch(/'public_redacted', true/i);
    expect(migration).toMatch(/'history', '\[\]'::jsonb/i);
  });

  it('does not copy customer, staff, or transaction payload objects', () => {
    expect(migration).toMatch(/'customer', jsonb_build_object\('name', 'Customer'\)/i);
    expect(migration).toMatch(/'preparedBy', jsonb_build_object\([\s\S]+?'Himaliya Spring Water'/i);
    expect(migration).not.toMatch(/payload\s*->\s*'customer'/i);
    expect(migration).not.toMatch(/payload\s*->\s*'preparedBy'/i);
    expect(migration).not.toMatch(/jsonb_array_elements/i);
  });

  it('retains anonymous execute only on the redacted function', () => {
    expect(migration).toMatch(
      /revoke all on function public\.lookup_invoice_by_number\(text\)[\s\S]+?from public, anon, authenticated[\s\S]+?grant execute[\s\S]+?to anon, authenticated/i,
    );
  });
});
