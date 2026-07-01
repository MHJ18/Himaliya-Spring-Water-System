import { dbRequest, isSupabaseConfigured } from '../cloud/supabaseClient';
import { DEFAULT_SETTINGS } from '../../data/constants';
import { generateInvoiceNumber } from '../../utils/invoiceNumber';
import { getCurrentAdmin } from '../../utils/adminAuth';

function buildInvoicePayload(customer, historyItems, company) {
  const admin = getCurrentAdmin() || {};
  const issuedAt = new Date();
  const dueAt = new Date(issuedAt);
  dueAt.setDate(dueAt.getDate() + Math.max(0, Number(company.invoiceDueDays) || 0));
  const totalAmount = historyItems.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
  const totalQty = historyItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return {
    company: {
      name: company.businessName || DEFAULT_SETTINGS.businessName,
      phone: company.businessPhone || DEFAULT_SETTINGS.businessPhone,
      address: company.businessAddress || DEFAULT_SETTINGS.businessAddress,
    },
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address || '',
    },
    preparedBy: {
      name: admin.name || 'Himaliya Admin',
      email: admin.email || '',
      role: admin.role || 'Owner',
    },
    history: historyItems.map((item) => ({
      date: item.date,
      bottleType: item.bottleType,
      quantity: Number(item.quantity) || 0,
      pricePerBottle: Number(item.pricePerBottle) || 0,
      totalAmount: Number(item.totalAmount) || 0,
    })),
    summary: {
      entryCount: historyItems.length,
      totalAmount,
      totalQty,
      issuedAt: issuedAt.toISOString(),
      dueDate: dueAt.toISOString(),
      paymentTermsDays: Math.max(0, Number(company.invoiceDueDays) || 0),
    },
  };
}

export function rowToInvoice(row) {
  if (!row) return null;
  const payload = row.payload || {};
  return {
    id: row.id,
    customerId: row.customer_id,
    invoiceNumber: row.invoice_number,
    invoiceDate: row.invoice_date,
    totalAmount: Number(row.total_amount || 0),
    totalQty: Number(row.total_qty || 0),
    paymentStatus: row.payment_status || 'unpaid',
    validated: row.validated === true,
    payload,
    company: payload.company || {},
    customer: payload.customer || {},
    preparedBy: payload.preparedBy || {},
    history: payload.history || [],
    summary: payload.summary || {},
    invoice_number: row.invoice_number,
    invoice_date: row.invoice_date,
    payment_status: row.payment_status || 'unpaid',
  };
}

function customerIdsForLookup(customer) {
  const ids = new Set();
  if (!customer) return [];
  if (customer.id) ids.add(customer.id);
  if (customer.linkedCustomerId) ids.add(customer.linkedCustomerId);
  return [...ids].filter(Boolean);
}

function invoiceInFilter(ids) {
  return ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',');
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function updateTarget(api, invoiceOrId, patch) {
  if (typeof invoiceOrId === 'object' && invoiceOrId && invoiceOrId.id) {
    return api.updateInvoice(invoiceOrId.id, patch);
  }
  if (isUuid(invoiceOrId)) {
    return api.updateInvoice(invoiceOrId, patch);
  }
  return api.updateInvoiceByNumber(invoiceOrId, patch);
}

export const invoiceApi = {
  async createFromCustomer(customer, historyItems, company = DEFAULT_SETTINGS) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is required to create invoices.');
    }

    const payload = buildInvoicePayload(customer, historyItems, company);
    const invoiceNumber = generateInvoiceNumber();
    const createBody = {
      customer_id: customer.id,
      invoice_number: invoiceNumber,
      invoice_date: new Date().toISOString(),
      payload,
      total_amount: payload.summary.totalAmount,
      total_qty: payload.summary.totalQty,
      payment_status: 'unpaid',
      validated: false,
    };

    let rows;
    try {
      rows = await dbRequest('/customer_invoices', {
        method: 'POST',
        body: JSON.stringify([createBody]),
      });
    } catch (error) {
      const schemaCacheMiss = error.code === 'PGRST204' ||
        /schema cache|validated|payment_status/i.test(error.message || '');
      if (schemaCacheMiss) {
        const { validated, payment_status, ...legacyBody } = createBody;
        rows = await dbRequest('/customer_invoices', {
          method: 'POST',
          body: JSON.stringify([legacyBody]),
        });
      } else {
        const missingTable = error.code === 'PGRST205'
          || error.code === '42P01'
          || /could not find (?:the )?table[^\n]*customer_invoices|relation[^\n]*customer_invoices[^\n]*does not exist/i.test(error.message || '');
        if (missingTable) {
          throw new Error('Invoice storage is not installed in Supabase. Apply the customer invoices migration, then try again.');
        }
        throw error;
      }
    }

    const createdInvoice = rowToInvoice(rows && rows[0]);
    if (createdInvoice && createdInvoice.paymentStatus !== 'unpaid' && createdInvoice.id) {
      try {
        const correctedRows = await dbRequest(`/customer_invoices?id=eq.${encodeURIComponent(createdInvoice.id)}&select=*`, {
          method: 'PATCH',
          body: JSON.stringify({ payment_status: 'unpaid' }),
        });
        return rowToInvoice(correctedRows && correctedRows[0]) || { ...createdInvoice, paymentStatus: 'unpaid', payment_status: 'unpaid' };
      } catch {
        return { ...createdInvoice, paymentStatus: 'unpaid', payment_status: 'unpaid' };
      }
    }
    return createdInvoice;
  },

  async getByCustomer(customer) {
    if (!isSupabaseConfigured()) return [];
    const ids = customerIdsForLookup(customer);
    if (!ids.length) return [];
    const rows = await dbRequest(
      `/customer_invoices?customer_id=in.(${invoiceInFilter(ids)})&select=*&order=invoice_date.desc`,
    );
    return rows.map(rowToInvoice);
  },

  async getAll() {
    if (!isSupabaseConfigured()) return [];
    const rows = await dbRequest('/customer_invoices?select=*&order=invoice_date.desc');
    return rows.map(rowToInvoice);
  },

  async updateInvoice(invoiceId, patch) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is required to update invoices.');
    }
    const rows = await dbRequest(`/customer_invoices?id=eq.${encodeURIComponent(invoiceId)}&select=*`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    const updated = rowToInvoice(rows && rows[0]);
    if (!updated) throw new Error('Invoice was not updated. Check your admin permission and try again.');
    return updated;
  },

  async updateInvoiceByNumber(invoiceNumber, patch) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is required to update invoices.');
    }
    const normalized = String(invoiceNumber || '').trim();
    const rows = await dbRequest(
      `/customer_invoices?invoice_number=ilike.${encodeURIComponent(normalized)}&select=*`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
    );
    const updated = rowToInvoice(rows && rows[0]);
    if (!updated) throw new Error('Invoice was not updated. Check your admin permission and try again.');
    return updated;
  },

  async markAsPaid(invoiceOrId) {
    return updateTarget(this, invoiceOrId, { payment_status: 'paid' });
  },

  async markAsUnpaid(invoiceOrId) {
    return updateTarget(this, invoiceOrId, { payment_status: 'unpaid' });
  },

  async setValidated(invoiceOrId, validated = true) {
    return updateTarget(this, invoiceOrId, { validated: Boolean(validated) });
  },

  async lookupByNumber(invoiceNumber, options = {}) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is required to look up invoices.');
    }

    const normalized = String(invoiceNumber || '').trim();
    if (!normalized) return null;

    try {
      return await dbRequest('/rpc/lookup_invoice_by_number', {
        method: 'POST',
        useUserToken: false,
        body: JSON.stringify({ p_invoice_number: normalized }),
      });
    } catch (error) {
      const missingRpc = error.code === 'PGRST202'
        || /lookup_invoice_by_number|schema cache/i.test(error.message || '');
      if (!missingRpc || !options.authenticatedFallback) throw error;

      const encodedNumber = encodeURIComponent(normalized);
      const rows = await dbRequest(
        `/customer_invoices?select=id,payload,invoice_number,invoice_date,total_amount,total_qty,payment_status,validated&invoice_number=ilike.${encodedNumber}&limit=1`,
      );
      return rowToInvoice(rows && rows[0]);
    }
  },
};
