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
    const savedTotal = amount(firstValue(item && item.totalAmount, item && item.total_amount));
    return {
      ...item,
      quantity: lineQuantity,
      pricePerBottle,
      totalAmount: savedTotal || (lineQuantity * pricePerBottle),
    };
  });
}

export function resolveInvoiceTotals(row = {}) {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  const summary = payload.summary && typeof payload.summary === 'object' ? payload.summary : {};
  const history = normalizeInvoiceHistory(payload.history);
  const historyAmount = history.reduce((sum, item) => sum + item.totalAmount, 0);
  const historyQuantity = history.reduce((sum, item) => sum + item.quantity, 0);
  return {
    totalAmount: amount(firstValue(row.total_amount, row.totalAmount))
      || amount(firstValue(summary.totalAmount, summary.total_amount))
      || historyAmount,
    totalQty: quantity(firstValue(row.total_qty, row.totalQty))
      || quantity(firstValue(summary.totalQty, summary.total_qty))
      || historyQuantity,
    history,
  };
}
