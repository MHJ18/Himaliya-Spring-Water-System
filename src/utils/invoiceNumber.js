import { createId } from './id';

export function generateInvoiceNumber() {
  // Invoice numbers unlock public verification pages. Generate them from a
  // full secure UUID so future invoice URLs cannot be predicted or feasibly
  // enumerated from prior ones. Treat the number as a capability secret.
  const suffix = createId().replace(/-/g, '').toUpperCase();
  return `HSW-${suffix}`;
}
