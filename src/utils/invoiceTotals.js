function amount(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function quantity(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function firstValue() {
  for (let index = 0; index < arguments.length; index += 1) {
    if (arguments[index] !== undefined && arguments[index] !== null) return arguments[index];
  }
  return 0;
}

export function normalizeInvoiceHistory(history) {
  return (Array.isArray(history) ? history : []).map((item) => {
    const lineQuantity = quantity(item && item.quantity);
    const pricePerBottle = amount(firstValue(
      item && item.pricePerBottle,
      item && item.unitPrice,
      item && item.unit_price,
    ));
    const savedTotal = amount(firstValue(
      item && item.grossAmount,
      item && item.gross_amount,
      item && item.totalAmount,
      item && item.total_amount,
    ));
    const grossAmount = savedTotal || (lineQuantity * pricePerBottle);
    const amountPaid = Math.min(grossAmount, amount(firstValue(
      item && item.amountPaid,
      item && item.amount_paid,
    )));
    const savedBalance = firstValue(
      item && item.balanceDue,
      item && item.balance_due,
      item && item.amountDue,
      item && item.amount_due,
    );
    const hasSavedBalance = [
      item && item.balanceDue,
      item && item.balance_due,
      item && item.amountDue,
      item && item.amount_due,
    ].some((value) => value !== undefined && value !== null);
    const balanceDue = hasSavedBalance
      ? Math.min(grossAmount, amount(savedBalance))
      : Math.max(0, grossAmount - amountPaid);
    const savedPaymentSchedule = firstValue(
      item && item.paymentSchedule,
      item && item.payment_schedule,
      '',
    );
    const paymentSchedule = savedPaymentSchedule === 'on_delivery'
      ? 'on_delivery'
      : savedPaymentSchedule === 'monthly'
        ? 'monthly'
        // Before per-sale terms were stored, a captured-at-sale payment was the
        // only supported paid-line behavior. Keep those legacy invoices readable.
        : amountPaid > 0 ? 'on_delivery' : 'monthly';
    return {
      ...item,
      quantity: lineQuantity,
      pricePerBottle,
      totalAmount: grossAmount,
      grossAmount,
      amountPaid,
      balanceDue,
      paymentSchedule,
    };
  });
}

export function resolveInvoiceTotals(row = {}) {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  const summary = payload.summary && typeof payload.summary === 'object' ? payload.summary : {};
  const history = normalizeInvoiceHistory(payload.history);
  const historyAmount = history.reduce((sum, item) => sum + item.balanceDue, 0);
  const historyGrossAmount = history.reduce((sum, item) => sum + item.grossAmount, 0);
  const historyPaidAmount = history.reduce((sum, item) => sum + item.amountPaid, 0);
  const historyQuantity = history.reduce((sum, item) => sum + item.quantity, 0);
  return {
    totalAmount: amount(firstValue(row.total_amount, row.totalAmount))
      || amount(firstValue(summary.totalAmount, summary.total_amount))
      || historyAmount,
    grossAmount: amount(firstValue(summary.grossAmount, summary.gross_amount))
      || historyGrossAmount,
    amountPaid: amount(firstValue(summary.amountPaid, summary.amount_paid))
      || historyPaidAmount,
    totalQty: quantity(firstValue(row.total_qty, row.totalQty))
      || quantity(firstValue(summary.totalQty, summary.total_qty))
      || historyQuantity,
    history,
  };
}

export function resolveInvoiceDocument(invoice = {}) {
  const embeddedPayload = invoice.payload && typeof invoice.payload === 'object'
    ? invoice.payload
    : invoice;
  const totals = resolveInvoiceTotals({
    ...invoice,
    payload: embeddedPayload,
  });
  const savedSummary = embeddedPayload.summary && typeof embeddedPayload.summary === 'object'
    ? embeddedPayload.summary
    : {};
  const savedEntryCount = Number(savedSummary.entryCount);
  const summary = {
    ...savedSummary,
    entryCount: Number.isFinite(savedEntryCount) && savedEntryCount >= 0
      ? savedEntryCount
      : totals.history.length,
    grossAmount: totals.grossAmount,
    amountPaid: totals.amountPaid,
    totalAmount: totals.totalAmount,
    totalQty: totals.totalQty,
  };
  const payload = {
    ...embeddedPayload,
    history: totals.history,
    summary,
  };

  return {
    payload,
    history: totals.history,
    summary,
    totalAmount: totals.totalAmount,
    grossAmount: totals.grossAmount,
    amountPaid: totals.amountPaid,
    totalQty: totals.totalQty,
  };
}
