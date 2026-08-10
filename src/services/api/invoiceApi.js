import { dbRequest, isSupabaseConfigured } from '../cloud/supabaseClient';
import { DEFAULT_SETTINGS } from '../../data/constants';
import { generateInvoiceNumber } from '../../utils/invoiceNumber';
import { getCurrentAdmin } from '../../utils/adminAuth';
import {
  normalizeInvoiceHistory,
  resolveInvoiceDocument,
} from '../../utils/invoiceTotals';

function invoiceSourceKey(item) {
  return String((item && item.id) || '').trim();
}

function validateInvoiceSourceKeys(historyItems) {
  const keys = historyItems.map(invoiceSourceKey);
  if (keys.some((key) => !key)) {
    throw new Error('Every invoice entry needs a stable sale or delivered-order ID.');
  }
  if (new Set(keys).size !== keys.length) {
    throw new Error('The invoice contains the same sale or delivered-order entry more than once.');
  }
  return keys;
}

async function getClaimedInvoiceSourceKeys(customerId) {
  try {
    const rows = await dbRequest(
      `/customer_invoice_line_claims?customer_id=eq.${encodeURIComponent(customerId)}&released_at=is.null&select=source_key`,
    );
    return new Set((rows || []).map((row) => String(row.source_key || '').trim()).filter(Boolean));
  } catch (error) {
    const missingClaimsTable = error.code === 'PGRST205'
      || error.code === '42P01'
      || /customer_invoice_line_claims|schema cache/i.test(error.message || '');
    if (missingClaimsTable) {
      throw new Error('Invoice claim storage is not installed in Supabase. Apply the latest payment migration, then try again.');
    }
    throw error;
  }
}

function buildInvoicePayload(customer, historyItems, company) {
  const admin = getCurrentAdmin() || {};
  const issuedAt = new Date();
  const dueAt = new Date(issuedAt);
  dueAt.setDate(dueAt.getDate() + Math.max(0, Number(company.invoiceDueDays) || 0));
  const normalizedHistory = normalizeInvoiceHistory(historyItems);
  const grossAmount = normalizedHistory.reduce((sum, item) => sum + item.grossAmount, 0);
  const amountPaid = normalizedHistory.reduce((sum, item) => sum + item.amountPaid, 0);
  const totalAmount = normalizedHistory.reduce((sum, item) => sum + item.balanceDue, 0);
  const totalQty = normalizedHistory.reduce((sum, item) => sum + item.quantity, 0);

  return {
    company: {
      name: company.businessName || DEFAULT_SETTINGS.businessName,
      phone: company.businessPhone || DEFAULT_SETTINGS.businessPhone,
      email: company.businessEmail || DEFAULT_SETTINGS.businessEmail,
      address: company.businessAddress || DEFAULT_SETTINGS.businessAddress,
      serviceArea: company.serviceArea || DEFAULT_SETTINGS.serviceArea,
      footer: company.invoiceFooter || DEFAULT_SETTINGS.invoiceFooter,
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
    history: normalizedHistory.map((item) => ({
      id: item.id,
      recordType: item.recordType || (String(item.id || '').startsWith('customer-order:')
        ? 'customer_order'
        : 'sale'),
      paymentSchedule: item.paymentSchedule || item.payment_schedule || 'monthly',
      date: item.date,
      bottleType: item.bottleType,
      quantity: Number(item.quantity) || 0,
      pricePerBottle: Number(item.pricePerBottle) || 0,
      totalAmount: Number(item.totalAmount) || 0,
      grossAmount: Number(item.grossAmount) || 0,
      amountPaid: Number(item.amountPaid) || 0,
      balanceDue: Number(item.balanceDue) || 0,
    })),
    summary: {
      entryCount: historyItems.length,
      grossAmount,
      amountPaid,
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
  const document = resolveInvoiceDocument(row);
  const payload = document.payload;
  return {
    id: row.id,
    customerId: row.customer_id,
    invoiceNumber: row.invoice_number,
    invoiceDate: row.invoice_date,
    totalAmount: document.totalAmount,
    grossAmount: document.grossAmount,
    amountPaid: document.amountPaid,
    totalQty: document.totalQty,
    paymentStatus: row.payment_status || 'unpaid',
    validated: row.validated === true,
    payload,
    company: payload.company || {},
    customer: payload.customer || {},
    preparedBy: payload.preparedBy || {},
    history: document.history,
    summary: document.summary,
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

function invoiceSettlementSelector(invoiceOrId) {
  if (typeof invoiceOrId === 'object' && invoiceOrId) {
    return {
      id: isUuid(invoiceOrId.id) ? invoiceOrId.id : null,
      number: String(invoiceOrId.invoiceNumber || invoiceOrId.invoice_number || '').trim() || null,
    };
  }
  return isUuid(invoiceOrId)
    ? { id: invoiceOrId, number: null }
    : { id: null, number: String(invoiceOrId || '').trim() || null };
}

async function setInvoicePaymentStatus(invoiceOrId, paid) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is required to update invoices.');
  }
  const selector = invoiceSettlementSelector(invoiceOrId);
  if (!selector.id && !selector.number) throw new Error('Invoice ID or invoice number is required.');

  let result;
  try {
    result = await dbRequest('/rpc/set_customer_invoice_payment_status', {
      method: 'POST',
      body: JSON.stringify({
        p_invoice_id: selector.id,
        p_invoice_number: selector.number,
        p_paid: Boolean(paid),
      }),
    });
  } catch (error) {
    const missingSettlementRpc = error.code === 'PGRST202'
      || error.code === '42883'
      || /set_customer_invoice_payment_status|schema cache/i.test(error.message || '');
    if (missingSettlementRpc) {
      throw new Error(
        'Transactional invoice settlement is not installed in Supabase. Apply the latest ledger migration before changing invoice status.'
      );
    }
    throw error;
  }

  const row = Array.isArray(result) ? result[0] : result;
  const updated = rowToInvoice(row);
  if (!updated) throw new Error('Invoice settlement did not return an updated invoice.');
  return updated;
}

export const invoiceApi = {
  async createFromCustomer(customer, historyItems, company = DEFAULT_SETTINGS) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is required to create invoices.');
    }

    const requestedHistory = Array.isArray(historyItems) ? historyItems : [];
    const requestedBalance = normalizeInvoiceHistory(requestedHistory)
      .reduce((sum, item) => sum + item.balanceDue, 0);
    if (requestedBalance <= 0) {
      throw new Error('There is no unpaid balance to invoice.');
    }
    if (!customer || !customer.id) {
      throw new Error('A customer is required to create an invoice.');
    }

    const sourceKeys = validateInvoiceSourceKeys(requestedHistory);
    const claimedSourceKeys = await getClaimedInvoiceSourceKeys(customer.id);
    const unclaimedHistory = requestedHistory.filter((item, index) => (
      !claimedSourceKeys.has(sourceKeys[index])
    ));
    const payload = buildInvoicePayload(customer, unclaimedHistory, company);
    if (payload.summary.totalAmount <= 0) {
      throw new Error('Every unpaid entry in this period is already covered by an active invoice.');
    }

    const invoiceNumber = generateInvoiceNumber();
    const createBody = {
      p_customer_id: customer.id,
      p_invoice_number: invoiceNumber,
      p_invoice_date: new Date().toISOString(),
      p_payload: payload,
      p_total_amount: payload.summary.totalAmount,
      p_total_qty: payload.summary.totalQty,
    };

    let rows;
    try {
      rows = await dbRequest('/rpc/create_customer_invoice', {
        method: 'POST',
        body: JSON.stringify(createBody),
      });
    } catch (error) {
      const claimedSourceConflict = error.code === '23505'
        && /claim|source|customer_invoice_line_claims/i.test(error.message || '');
      if (claimedSourceConflict) {
        throw new Error('One or more entries were just claimed by another active invoice. Refresh the customer record and try again.');
      }
      const missingCreateRpc = error.code === 'PGRST202'
        || error.code === '42883'
        || /create_customer_invoice|schema cache/i.test(error.message || '');
      if (missingCreateRpc) {
        throw new Error(
          'Transactional invoice creation is not installed in Supabase. Apply the latest ledger migration before creating invoices.'
        );
      }
      const staleBalance = error.code === '23514'
        && /balance changed|invoice lines total/i.test(error.message || '');
      if (staleBalance) {
        throw new Error('One or more balances changed while the invoice was being created. Refresh the customer record and try again.');
      }
      throw error;
    }

    const createdInvoice = rowToInvoice(Array.isArray(rows) ? rows[0] : rows);
    if (!createdInvoice) throw new Error('Invoice creation did not return the saved invoice.');
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
    return setInvoicePaymentStatus(invoiceOrId, true);
  },

  async markAsUnpaid(invoiceOrId) {
    return setInvoicePaymentStatus(invoiceOrId, false);
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

    if (options.authenticatedFallback) {
      const encodedNumber = encodeURIComponent(normalized);
      const rows = await dbRequest(
        `/customer_invoices?select=*&invoice_number=ilike.${encodedNumber}&limit=1`,
      );
      return rowToInvoice(rows && rows[0]);
    }

    return dbRequest('/rpc/lookup_invoice_by_number', {
      method: 'POST',
      useUserToken: false,
      body: JSON.stringify({ p_invoice_number: normalized }),
    });
  },
};
