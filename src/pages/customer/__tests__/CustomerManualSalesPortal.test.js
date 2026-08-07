import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(
  process.cwd(),
  'src',
  'pages',
  'customer',
  'CustomerPortal.js',
), 'utf8');

describe('customer portal manual delivery history', () => {
  it('loads manual history initially and during activity refreshes', () => {
    expect(source).toMatch(/getCustomerManualSalesHistory,/);
    expect(source.match(/getCustomerManualSalesHistory\(\)/g)).toHaveLength(2);
    expect(source).toMatch(/setManualSales\(nextManualSales\)/);
  });

  it('renders manual sales separately from customer-placed order history', () => {
    const orderHistory = source.indexOf('id="customer-order-history"');
    const manualHistory = source.indexOf('id="customer-manual-deliveries"');
    const invoices = source.indexOf('id="customer-invoices"');
    expect(orderHistory).toBeGreaterThan(-1);
    expect(manualHistory).toBeGreaterThan(orderHistory);
    expect(invoices).toBeGreaterThan(manualHistory);
    expect(source).toMatch(/Deliveries entered by the team before or outside portal ordering appear here separately/);
    expect(source).toMatch(/manualSales\.map/);
  });
});
