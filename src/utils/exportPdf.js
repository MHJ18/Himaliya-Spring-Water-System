import { jsPDF } from 'jspdf';
import * as autoTableModule from 'jspdf-autotable';
import { DEFAULT_SETTINGS } from '../data/constants';
import { formatCurrency, formatDate } from './formatters';
import { generateInvoiceNumber } from './invoiceNumber';
import { normalizeInvoiceHistory, resolveInvoiceDocument } from './invoiceTotals';

const autoTable = autoTableModule.default || autoTableModule.autoTable || autoTableModule;

function safeText(value, fallback = '—') {
  const text = value === null || value === undefined ? '' : String(value).trim();
  return text || fallback;
}

// Invoice numbers are unpredictable secrets (see invoiceNumber.js) and can run
// 30+ characters, so their on-page size can't be a fixed constant — it has to
// shrink with length or long numbers spill past the page edge. Courier is a
// fixed-pitch face (~0.6em per glyph at any weight), so the size that makes a
// string exactly fill a given width can be solved arithmetically instead of
// needing a real text-measurement pass.
function fitMonoFontSize(text, maxWidthMm, { min = 6.5, max = 11 } = {}) {
  const chars = Math.max(String(text).length, 1);
  const pointsPerChar = 0.6;
  const mmPerPoint = 0.3528;
  const size = maxWidthMm / (chars * pointsPerChar * mmPerPoint);
  return Math.min(max, Math.max(min, size));
}

function drawCompanyLogo(doc, x, y, size) {
  const centerX = x + (size / 2);
  doc.setFillColor(15, 111, 184);
  doc.roundedRect(x, y, size, size, 5, 5, 'F');

  // A simple vector water drop stays crisp at every PDF zoom level.
  doc.setFillColor(125, 226, 255);
  doc.triangle(centerX, y + (size * 0.16), x + (size * 0.28), y + (size * 0.58), x + (size * 0.72), y + (size * 0.58), 'F');
  doc.circle(centerX, y + (size * 0.58), size * 0.22, 'F');
  doc.setFillColor(255, 255, 255);
  doc.circle(x + (size * 0.44), y + (size * 0.49), size * 0.045, 'F');

  doc.setDrawColor(221, 248, 255);
  doc.setLineWidth(0.55);
  doc.line(x + (size * 0.22), y + (size * 0.82), x + (size * 0.78), y + (size * 0.82));
  doc.setDrawColor(91, 205, 245);
  doc.line(x + (size * 0.31), y + (size * 0.9), x + (size * 0.69), y + (size * 0.9));
}

function buildLocalInvoice(customer, historyItems = [], company = DEFAULT_SETTINGS) {
  const normalizedHistory = normalizeInvoiceHistory(historyItems);
  const grossAmount = normalizedHistory.reduce((sum, item) => sum + item.grossAmount, 0);
  const amountPaid = normalizedHistory.reduce((sum, item) => sum + item.amountPaid, 0);
  const totalAmount = normalizedHistory.reduce((sum, item) => sum + item.balanceDue, 0);
  const totalQty = normalizedHistory.reduce((sum, item) => sum + item.quantity, 0);
  // Local (non-persisted) invoices still populate the public verify URL printed
  // on the PDF, so they need the same unguessable, capability-secret-grade
  // number as server-created invoices rather than one derived from customer data.
  const invoiceNumber = generateInvoiceNumber();

  return {
    invoiceNumber,
    invoiceDate: new Date().toISOString(),
    payload: {
      company: {
        name: company.businessName || DEFAULT_SETTINGS.businessName,
        phone: company.businessPhone || DEFAULT_SETTINGS.businessPhone,
        address: company.businessAddress || DEFAULT_SETTINGS.businessAddress,
      },
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address || '',
      },
      preparedBy: {
        name: company.ownerName || 'Himaliya Owner',
        email: company.ownerEmail || 'admin@himaliya.com',
        role: company.ownerRole || 'Owner',
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
      },
    },
    totalAmount,
    totalQty,
  };
}

function getVerifyUrl(invoiceNumber) {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return `${window.location.origin}/invoice/${encodeURIComponent(invoiceNumber)}`;
  }
  return `/invoice/${invoiceNumber}`;
}

export function exportInvoicePdf(invoice) {
  const document = resolveInvoiceDocument(invoice);
  const payload = document.payload;
  const company = payload.company || {};
  const customer = payload.customer || {};
  const preparedBy = payload.preparedBy || {};
  const history = document.history;
  const summary = document.summary;
  const invoiceNumber = invoice.invoiceNumber || invoice.invoice_number || '—';
  const billDate = new Date(invoice.invoiceDate || invoice.invoice_date || Date.now());
  const visibleHistory = history.slice(0, 10);
  const isMonthlyAccountInvoice = history.length > 0
    && history.every((item) => item.paymentSchedule !== 'on_delivery');
  const showPaidColumn = history.some((item) => item.paymentSchedule === 'on_delivery');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Design tokens — kept in one place so the header, panels, table and
  // footer all read as one consistent system instead of ad-hoc colors.
  const accent = [37, 99, 235];
  const ink = [15, 23, 42];
  const muted = [100, 116, 139];
  const subtle = [148, 163, 184];
  const border = [226, 232, 240];
  const surface = [248, 250, 252];
  const headerBg = [224, 236, 255];
  const headerMuted = [65, 90, 133];

  const pageLeft = 14;
  const pageRight = 196;
  const contentWidth = pageRight - pageLeft;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 297, 'F');

  // ---- Header -------------------------------------------------------
  doc.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 40, 210, 1.2, 'F');

  drawCompanyLogo(doc, pageLeft, 9, 22);

  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(safeText(company.name, 'Himaliya Spring Water'), 42, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(headerMuted[0], headerMuted[1], headerMuted[2]);
  doc.text('Premium water delivery and customer account record', 42, 24.5);
  doc.text(
    `${safeText(company.address, 'Sialkot Cantt')}   |   ${safeText(company.phone, '')}`,
    42,
    30,
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text('INVOICE', pageRight, 15, { align: 'right' });

  // ---- Bill to / prepared by -----------------------------------------
  const billToTop = 48;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text('BILL TO', pageLeft, billToTop);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.text(safeText(customer.name, 'Customer'), pageLeft, billToTop + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text(`Phone: ${safeText(customer.phone)}`, pageLeft, billToTop + 13);
  doc.text(`Address: ${safeText(customer.address)}`, pageLeft, billToTop + 18);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(subtle[0], subtle[1], subtle[2]);
  doc.text(
    `Prepared by ${safeText(preparedBy.name, 'Admin')} · ${safeText(preparedBy.role, 'Owner')}`,
    pageLeft,
    billToTop + 24.5,
  );
  doc.text(`Email: ${safeText(preparedBy.email)}`, pageLeft, billToTop + 29);
  const billToBottom = billToTop + 29;

  // ---- Invoice detail panel (the invoice number now gets a full row of
  // its own, sized to the panel width, instead of being crammed into a
  // small badge — that mismatch is what pushed it off the page before) ---
  const panelX = 110;
  const panelW = pageRight - panelX;
  const panelY = 47;
  const panelRowH = 12;
  const panelRows = [
    { label: 'Invoice no.', value: invoiceNumber, mono: true },
    { label: 'Issue date', value: billDate.toLocaleDateString('en-PK') },
  ];
  if (summary.dueDate) {
    panelRows.push({ label: 'Due date', value: new Date(summary.dueDate).toLocaleDateString('en-PK') });
  }
  const panelH = (panelRows.length * panelRowH) + 6;

  doc.setDrawColor(border[0], border[1], border[2]);
  doc.setFillColor(surface[0], surface[1], surface[2]);
  doc.roundedRect(panelX, panelY, panelW, panelH, 2.5, 2.5, 'FD');

  panelRows.forEach((row, index) => {
    const rowTop = panelY + 7 + (index * panelRowH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(row.label.toUpperCase(), panelX + 5, rowTop);

    if (row.mono) {
      doc.setFont('courier', 'bold');
      doc.setFontSize(fitMonoFontSize(row.value, panelW - 10));
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
    }
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text(String(row.value), panelX + 5, rowTop + 5.5);
  });
  const panelBottom = panelY + panelH;

  const tableStartY = Math.max(billToBottom, panelBottom) + 14;

  // ---- Line-item table -------------------------------------------------
  const tableHead = showPaidColumn
    ? ['Date', 'Bottle', 'Qty', 'Unit', 'Gross', 'Paid on delivery', 'Due']
    : ['Date', 'Bottle', 'Qty', 'Unit', 'Gross', 'Due'];
  const tableBody = visibleHistory.length
    ? visibleHistory.map((item) => {
        const cells = [
          formatDate(item.date),
          safeText(item.bottleType, '—'),
          String(item.quantity || 0),
          formatCurrency(item.pricePerBottle),
          formatCurrency(item.grossAmount),
        ];
        if (showPaidColumn) {
          cells.push(item.paymentSchedule === 'on_delivery' ? formatCurrency(item.amountPaid) : '—');
        }
        cells.push(formatCurrency(item.balanceDue));
        return cells;
      })
    : [tableHead.map((value, index) => (index === 0 ? 'No transactions recorded' : ''))];

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: pageLeft, right: 210 - pageRight },
    theme: 'plain',
    head: [tableHead],
    body: tableBody,
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 2.6, right: 2.5, bottom: 2.6, left: 2.5 },
      textColor: ink,
      lineColor: border,
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: surface,
      textColor: ink,
      fontStyle: 'bold',
      fontSize: 7.5,
      lineWidth: { bottom: 0.6 },
      lineColor: accent,
    },
    alternateRowStyles: {
      fillColor: [250, 251, 253],
    },
    columnStyles: showPaidColumn ? {
      0: { cellWidth: 25 },
      1: { cellWidth: 39 },
      2: { halign: 'center', cellWidth: 12 },
      3: { halign: 'right', cellWidth: 25 },
      4: { halign: 'right', cellWidth: 27 },
      5: { halign: 'right', cellWidth: 27 },
      6: { halign: 'right', cellWidth: 27, fontStyle: 'bold' },
    } : {
      0: { cellWidth: 27 },
      1: { cellWidth: 43 },
      2: { halign: 'center', cellWidth: 12 },
      3: { halign: 'right', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 33 },
      5: { halign: 'right', cellWidth: 37, fontStyle: 'bold' },
    },
  });

  const tableEndY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 140;
  let cursorY = tableEndY + 8;

  if (history.length > visibleHistory.length) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(`Showing ${visibleHistory.length} of ${history.length} line items.`, pageLeft, cursorY);
    cursorY += 6;
  }

  // ---- Totals callout + policy notes -----------------------------------
  const totalBoxW = 68;
  const totalBoxH = 18;
  const totalBoxX = pageRight - totalBoxW;

  doc.setFillColor(ink[0], ink[1], ink[2]);
  doc.roundedRect(totalBoxX, cursorY, totalBoxW, totalBoxH, 2.5, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(subtle[0], subtle[1], subtle[2]);
  doc.text('AMOUNT DUE', totalBoxX + 6, cursorY + 7);
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(formatCurrency(summary.totalAmount), totalBoxX + 6, cursorY + 14.5);

  let noteY = cursorY + 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  const notes = [
    isMonthlyAccountInvoice
      ? 'Payment terms: monthly account. No daily-paid column is included.'
      : 'Payment terms: cash on delivery or monthly account.',
    'Policies: sanitized bottles, sealed delivery, and routine water quality checks.',
    'Returns: empty bottles should be returned on the next delivery.',
  ];
  notes.forEach((line) => {
    doc.text(line, pageLeft, noteY);
    noteY += 5;
  });

  cursorY = Math.max(cursorY + totalBoxH, noteY) + 8;

  // ---- Verify chip -------------------------------------------------
  const verifyUrl = getVerifyUrl(invoiceNumber);
  const verifyBoxH = 16;
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.setFillColor(surface[0], surface[1], surface[2]);
  doc.roundedRect(pageLeft, cursorY, contentWidth, verifyBoxH, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text('VERIFY THIS INVOICE ONLINE', pageLeft + 6, cursorY + 6.5);
  doc.setFont('courier', 'normal');
  doc.setFontSize(fitMonoFontSize(verifyUrl, contentWidth - 12, { min: 6.5, max: 9 }));
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.text(verifyUrl, pageLeft + 6, cursorY + 12.5);

  // ---- Footer -------------------------------------------------------
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.line(pageLeft, 278, pageRight, 278);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text('Thank you for choosing Himaliya Spring Water.', pageLeft, 284);
  doc.text('Authorized company record', pageRight, 284, { align: 'right' });

  doc.save(`invoice-${String(invoiceNumber).toLowerCase()}.pdf`);
}

export async function exportCustomerHistoryPdf(customer, historyItems, createInvoice) {
  const invoice = typeof createInvoice === 'function'
    ? await createInvoice(customer, historyItems)
    : buildLocalInvoice(customer, historyItems);

  exportInvoicePdf(invoice);
  return invoice;
}
