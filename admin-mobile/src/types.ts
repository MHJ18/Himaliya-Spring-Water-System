export type Customer = {
  id: string; name: string; phone: string; address: string; email?: string; photo?: string;
  source?: string; auth_user_id?: string | null; created_at: string;
};
export type Sale = {
  id: string; customer_id: string; bottle_type: string; quantity: number;
  price_per_bottle: number; total_amount: number; notes?: string; created_at: string;
  customers?: Pick<Customer, 'name'>;
};
export type Order = {
  id: string; customer_id: string; bottle_type: string; quantity: number; unit_price: number;
  total_amount: number; delivery_address?: string; delivery_date?: string; notes?: string;
  status: string; admin_note?: string; created_at: string; customers?: Customer;
};
export type Invoice = {
  id: string; customer_id: string; invoice_number: string; invoice_date: string;
  total_amount: number; total_qty: number; payment_status: string; validated: boolean; payload?: any;
};
export type Inventory = Record<string, number>;
export type InvoicePayload = {
  company: { name: string; phone: string; address: string };
  customer: { id: string; name: string; phone: string; email?: string; address: string };
  preparedBy: { name: string; email: string; role: string };
  history: Array<{ date: string; bottleType: string; quantity: number; pricePerBottle: number; totalAmount: number }>;
  summary: { entryCount: number; totalAmount: number; totalQty: number; issuedAt: string; dueDate: string; paymentTermsDays: number };
};
export type AdminProfile = {
  id: string; auth_user_id: string; name: string; email: string; role: string; active: boolean;
};
export type Notification = {
  id: string; title: string; detail: string; type?: string; read: boolean; created_at: string;
};
