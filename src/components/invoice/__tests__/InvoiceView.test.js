import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import InvoiceView from '../InvoiceView';

describe('InvoiceView payment totals', () => {
  it('shows gross, paid, and due values for a partial payment', () => {
    const markup = renderToStaticMarkup(
      <InvoiceView
        invoice={{
          invoice_number: 'HSW-PARTIAL',
          total_amount: 350,
          payload: {
            history: [{
              id: 'sale-1',
              date: '2026-07-29T10:00:00.000Z',
              bottleType: 'Gallon',
              quantity: 2,
              pricePerBottle: 300,
              grossAmount: 600,
              amountPaid: 250,
              balanceDue: 350,
            }],
            summary: {
              grossAmount: 600,
              amountPaid: 250,
              totalAmount: 350,
              totalQty: 2,
            },
          },
        }}
      />,
    );

    expect(markup).toContain('Gross');
    expect(markup).toContain('Payments applied');
    expect(markup).toContain('Amount due');
    expect(markup).toContain('Paid on delivery</th>');
    expect(markup).toContain('Due</th>');
  });

  it('omits the daily-paid column from a monthly account invoice', () => {
    const markup = renderToStaticMarkup(
      <InvoiceView
        invoice={{
          invoice_number: 'HSW-MONTHLY',
          total_amount: 350,
          payload: {
            history: [{
              id: 'sale-monthly-1',
              date: '2026-07-29T10:00:00.000Z',
              bottleType: 'Gallon',
              quantity: 2,
              pricePerBottle: 300,
              grossAmount: 600,
              amountPaid: 250,
              balanceDue: 350,
              paymentSchedule: 'monthly',
            }],
            summary: {
              grossAmount: 600,
              amountPaid: 250,
              totalAmount: 350,
              totalQty: 2,
            },
          },
        }}
      />,
    );

    expect(markup).toContain('Account payments');
    expect(markup).toContain('Monthly account');
    expect(markup).not.toContain('Paid on delivery</th>');
  });

  it('recovers a legacy history-only amount instead of rendering zero due', () => {
    const markup = renderToStaticMarkup(
      <InvoiceView
        invoice={{
          invoice_number: 'HSW-LEGACY',
          total_amount: 0,
          payload: {
            history: [{
              date: '2026-06-01T10:00:00.000Z',
              bottleType: 'Gallon',
              quantity: 3,
              pricePerBottle: 250,
              totalAmount: 0,
            }],
          },
        }}
      />,
    );

    expect(markup).toContain('750');
    expect(markup).not.toContain('Amount due</span><strong>PKR&nbsp;0');
  });

  it('renders a void invoice as Void rather than Unpaid', () => {
    const markup = renderToStaticMarkup(
      <InvoiceView
        showStatus
        invoice={{
          invoice_number: 'HSW-VOID',
          payment_status: 'void',
          total_amount: 350,
          payload: {
            history: [],
            summary: { totalAmount: 350 },
          },
        }}
      />,
    );

    expect(markup).toContain('invoice-view__status--void');
    expect(markup).toContain('>Void<');
    expect(markup).not.toContain('>Unpaid<');
  });
});
