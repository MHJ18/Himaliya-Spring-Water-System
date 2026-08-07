import {
  deleteCloudSale,
  getCloudCustomers,
  saveCloudCustomers,
} from '../cloud/himalayaDb';
import { adminDeleteCustomerAccount, dbRequest } from '../cloud/supabaseClient';

const LEGACY_KEYS = ['ws_customers', 'ws_customers_csv', 'ws_sales_csv', 'ws_cloud_sync_status'];

async function migrateLegacyCustomers(cloudCustomers) {
  let legacyCustomers = [];
  try {
    legacyCustomers = JSON.parse(localStorage.getItem('ws_customers') || '[]');
  } catch {
    legacyCustomers = [];
  }
  if (Array.isArray(legacyCustomers) && legacyCustomers.length) {
    const merged = new Map(cloudCustomers.map((customer) => [customer.id, customer]));
    legacyCustomers.forEach((customer) => merged.set(customer.id, customer));
    const customers = [...merged.values()];
    await saveCloudCustomers(customers);
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
    return customers;
  }
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
  return cloudCustomers;
}

export const customerApi = {
  async getAll() {
    const cloudCustomers = await getCloudCustomers();
    return migrateLegacyCustomers(cloudCustomers || []);
  },
  async saveAll(customers) {
    await saveCloudCustomers(customers);
    return customers;
  },
  async saveOne(customer) {
    await saveCloudCustomers([customer]);
    return customer;
  },
  async delete(customerId) {
    await adminDeleteCustomerAccount(customerId);
    return customerId;
  },
  async deleteTransaction(transactionId) {
    await deleteCloudSale(transactionId);
    return transactionId;
  },
  async recordMonthlyPayment(customerId, amount, allocations) {
    try {
      const result = await dbRequest('/rpc/record_customer_monthly_payment', {
        method: 'POST',
        body: JSON.stringify({
          p_customer_id: customerId,
          p_amount: amount,
          p_allocations: allocations,
        }),
      });
      return Array.isArray(result) ? result[0] : result;
    } catch (error) {
      const missingRpc = error.code === 'PGRST202'
        || error.code === '42883'
        || /record_customer_monthly_payment|schema cache/i.test(error.message || '');
      if (missingRpc) {
        throw new Error(
          'Transactional payment allocation is not installed in Supabase. Apply the latest ledger migration, then try again.'
        );
      }
      throw error;
    }
  },
};
