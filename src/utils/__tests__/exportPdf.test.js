import { formatCurrency } from '../formatters';

const mockPdfDocument = {
  setFillColor: jest.fn(),
  roundedRect: jest.fn(),
  triangle: jest.fn(),
  circle: jest.fn(),
  setDrawColor: jest.fn(),
  setLineWidth: jest.fn(),
  line: jest.fn(),
  setTextColor: jest.fn(),
  setFont: jest.fn(),
  setFontSize: jest.fn(),
  text: jest.fn(),
  rect: jest.fn(),
  save: jest.fn(),
  lastAutoTable: null,
};

const mockAutoTable = jest.fn((document) => {
  document.lastAutoTable = { finalY: 140 };
});

jest.mock('jspdf', () => ({
  jsPDF: jest.fn(() => mockPdfDocument),
}));

jest.mock('jspdf-autotable', () => ({
  __esModule: true,
  default: (...args) => mockAutoTable(...args),
}));

const { exportInvoicePdf } = require('../exportPdf');

describe('invoice PDF totals', () => {
  beforeEach(() => {
    Object.values(mockPdfDocument).forEach((value) => {
      if (value && typeof value.mockClear === 'function') value.mockClear();
    });
    mockPdfDocument.lastAutoTable = null;
    mockAutoTable.mockClear();
  });

  it('prints a recovered legacy balance instead of zero', () => {
    exportInvoicePdf({
      invoiceNumber: 'HSW-LEGACY',
      totalAmount: 0,
      payload: {
        history: [{
          date: '2026-06-01T10:00:00.000Z',
          bottleType: 'Gallon',
          quantity: 3,
          pricePerBottle: 250,
          totalAmount: 0,
        }],
      },
    });

    const printedText = mockPdfDocument.text.mock.calls.map(([value]) => value);
    expect(printedText).toContain(formatCurrency(750));
    expect(mockPdfDocument.save).toHaveBeenCalledWith('invoice-hsw-legacy.pdf');
  });

  it('removes the daily-paid table column for monthly invoices', () => {
    exportInvoicePdf({
      invoiceNumber: 'HSW-MONTHLY',
      totalAmount: 350,
      payload: {
        history: [{
          date: '2026-08-01T10:00:00.000Z',
          bottleType: 'Gallon',
          quantity: 2,
          pricePerBottle: 300,
          grossAmount: 600,
          amountPaid: 250,
          balanceDue: 350,
          paymentSchedule: 'monthly',
        }],
      },
    });

    const tableOptions = mockAutoTable.mock.calls[0][1];
    expect(tableOptions.head[0]).toEqual(['Date', 'Bottle', 'Qty', 'Unit', 'Gross', 'Due']);
    expect(tableOptions.body[0]).toHaveLength(6);
    expect(mockPdfDocument.text).toHaveBeenCalledWith(
      'Payment terms: monthly account. No daily-paid column is included.',
      14,
      expect.any(Number),
    );
  });
});
