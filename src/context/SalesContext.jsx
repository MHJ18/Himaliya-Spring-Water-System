import React, { createContext, useContext, useCallback } from 'react';
import { useCustomers } from './CustomerContext';
import { createId } from '../utils/id';

const SalesContext = createContext(null);

export function buildSaleTransaction({
  id = createId(),
  date = new Date().toISOString(),
  bottleType,
  quantity,
  pricePerBottle,
  amountPaid,
  paymentSchedule,
  notes,
}) {
  const qty = Number(quantity);
  const price = Number(pricePerBottle);
  const totalAmount = qty * price;
  const schedule = paymentSchedule === 'on_delivery' ? 'on_delivery' : 'monthly';
  const requestedPayment = Math.max(0, Number(amountPaid) || 0);
  // Monthly deliveries enter the account ledger unpaid. Cash received for a
  // monthly account is recorded separately and allocated oldest balance first.
  const paid = schedule === 'on_delivery'
    ? Math.min(totalAmount, requestedPayment)
    : 0;

  return {
    id,
    date,
    bottleType,
    quantity: qty,
    pricePerBottle: price,
    totalAmount,
    amountPaid: paid,
    amountDue: Math.max(0, totalAmount - paid),
    paymentSchedule: schedule,
    notes: notes || '',
  };
}

export function SalesProvider({ children }) {
  const { addTransaction } = useCustomers();

  const recordSale = useCallback(async ({
    customerId,
    bottleType,
    quantity,
    pricePerBottle,
    amountPaid,
    paymentSchedule,
    notes,
  }) => {
    const transaction = buildSaleTransaction({
      bottleType,
      quantity,
      pricePerBottle,
      amountPaid,
      paymentSchedule,
      notes,
    });
    await addTransaction(customerId, transaction);
    return transaction;
  }, [addTransaction]);

  return (
    <SalesContext.Provider value={{ recordSale }}>
      {children}
    </SalesContext.Provider>
  );
}

export function useSales() {
  const ctx = useContext(SalesContext);
  if (!ctx) throw new Error('useSales requires SalesProvider');
  return ctx;
}
