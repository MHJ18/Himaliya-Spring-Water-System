import React, { createContext, useContext, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCustomers } from './CustomerContext';

const SalesContext = createContext(null);

export function SalesProvider({ children }) {
  const { addTransaction } = useCustomers();

  const recordSale = useCallback(async ({ customerId, bottleType, quantity, pricePerBottle, notes }) => {
    const qty = Number(quantity);
    const price = Number(pricePerBottle);
    const transaction = {
      id: uuidv4(),
      date: new Date().toISOString(),
      bottleType,
      quantity: qty,
      pricePerBottle: price,
      totalAmount: qty * price,
      notes: notes || '',
    };
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
